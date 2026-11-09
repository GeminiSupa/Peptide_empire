/**
 * Rebuild a public checkout from database product rows.
 *
 * The browser is a display surface, not a price authority. This module replaces
 * every posted unit price and total with current catalog values, then reports
 * whether the shopper must review a changed price before the order is saved.
 */

import {
  buildBacAwareOrderItems,
  checkBacOnlyMinimum,
  isBacWater,
  isGiftLine,
  isSellableBacWater,
  stripGiftSuffix,
  summarizeBacWater,
} from './bacWater.mjs';
import { chooseDealOffer, freeVialLine } from './dealOffers.mjs';
import { effectiveVolumeDiscountPct, isFullOrderPromo } from './promoEligibility.mjs';
import { computeOrderTotals, getUnitPrice, getVolumeDiscountPct } from './pricing.js';

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const roundCurrency = (value, currency) => currency === 'USD' ? round2(value) : Math.round(Number(value || 0));
const normalize = (value) => String(value || '').trim().toLowerCase();
// Looser than normalize: also ignores dashes, spaces and other punctuation, so
// a product renamed "Slu-pp332 5mg" -> "SLU-PP-332 5mg" still matches the
// orders saved under its old name.
const looseKey = (value) => normalize(value).normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Build a lookup that finds a catalog row by name. An exact (case-insensitive)
 * match wins; otherwise a match that ignores dashes and spaces is used, but
 * only when exactly one product has that shape, so two genuinely different
 * products are never merged.
 */
const LANDING_PAGE_ALIASES = [
  [/tirzepatide/i, 'GLP-1 (TRZ)'],
  [/semaglutide/i, 'GLP-1 (SEM)'],
  [/retatrutide/i, 'GLP-1 (RT)'],
];

export function productNameResolver(products) {
  const exact = new Map();
  const loose = new Map();
  for (const product of products || []) {
    const name = product?.product;
    if (!name) continue;
    exact.set(normalize(name), product);
    const key = looseKey(name);
    loose.set(key, loose.has(key) ? null : product);

    // Names used on the Google Ads shop pages (/lp/glp-1, /lp/bac-water):
    // "GLP-1 (TRZ|SEM|RT)". A real product name always wins over an alias, and
    // an alias shape shared by two products resolves to nothing.
    for (const [pattern, label] of LANDING_PAGE_ALIASES) {
      if (!pattern.test(name)) continue;
      const alias = name.replace(pattern, label);
      if (!exact.has(normalize(alias))) exact.set(normalize(alias), product);
      const aliasKey = looseKey(alias);
      loose.set(aliasKey, loose.has(aliasKey) ? null : product);
    }
  }
  return (name) => {
    if (!name) return null;
    return exact.get(normalize(name)) || loose.get(looseKey(name)) || null;
  };
}

function qtyOf(item) {
  const qty = Number.parseInt(item?.qty ?? item?.quantity ?? 0, 10);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

function promoDiscountAmount(cart, totals, promo, currency) {
  if (!promo) return 0;
  const pct = Math.min(1, Math.max(0, Number(promo.discount_pct || 0)));
  if (!Number.isFinite(pct) || pct <= 0) return 0;

  let base = totals.discountableSubtotal;
  if (promo.is_flash_sale && promo.target_product) {
    const targets = String(promo.target_product)
      .split(',')
      .map(normalize)
      .filter(Boolean);
    const targetMatches = (name, target) => promo.exact_target_match
      ? normalize(name) === target
      : normalize(name).includes(target);
    base = cart
      .filter((item) => !isBacWater(item.product) && targets.some((target) => targetMatches(item.product, target)))
      .reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
  }
  if (totals.discountPct > 0) base *= (1 - totals.discountPct / 100);
  return roundCurrency(base * pct, currency);
}

export function authoritativeCheckout({
  postedOrder,
  // The language the refusal messages are written in. English unless the public
  // checkout asks otherwise, so admin screens and callers that never passed a
  // language keep reading exactly what they always have.
  messageLang = 'en',
  products,
  promo = null,
  exchangeRate,
  // Set only by the admin order routes, for a manual order carrying a
  // negotiated discount: that discount replaces the volume tier rather than
  // stacking on top of it. Never set from the public checkout.
  suppressVolumeDiscount = false,
  // The volume rate this order was originally priced at, for the admin edit
  // route only. Re-pricing an existing order must not move it onto today's
  // tier: an order taken during a deal week would otherwise lose the rate the
  // customer agreed to the moment the deal lapsed. Null/undefined means "work
  // it out from the cart", which is what every new order does.
  volumeDiscountPctOverride = null,
  // The live two-offer Deal of the Week's `offers`, when the cart contains one
  // of its products and no promo code applies. The server works out which
  // offer applies and which vials are free; nothing about it is read from the
  // posted order.
  dealOffers = null,
  // Admin routes only: a free vial already on the order (a zero-priced
  // "(Free Gift)" peptide line from a deal) is kept as it is. The public
  // checkout never sets this, so a posted free line cannot be smuggled in.
  keepPostedGifts = false,
  // Server-resolved approved business terms. Never read from postedOrder.
  businessDiscountPct = 0,
  businessProductPrices = [],
}) {
  const currency = postedOrder?.currency === 'USD' ? 'USD' : 'CRC';
  const findProduct = productNameResolver(products);
  const requestedByName = new Map();
  const missing = [];
  const postedPeptideGifts = [];

  for (const item of postedOrder?.items || []) {
    if (isGiftLine(item)) {
      const giftName = stripGiftSuffix(item?.product || item?.name);
      if (keepPostedGifts && !isBacWater(giftName) && qtyOf(item) > 0) {
        postedPeptideGifts.push({ product: item.product || item.name, qty: qtyOf(item), price: 0 });
      }
      continue;
    }
    const productName = stripGiftSuffix(item?.product || item?.name);
    const qty = qtyOf(item);
    if (!productName || qty <= 0) continue;
    const product = findProduct(productName);
    if (!product) {
      missing.push(productName);
      continue;
    }
    const key = normalize(product.product);
    const existing = requestedByName.get(key);
    if (existing) {
      existing.qty += qty;
    } else {
      requestedByName.set(key, {
        product: product.product,
        qty,
        unitPrice: getUnitPrice(product, currency, exchangeRate),
        category: product.category || '',
        priceUsd: product.price_usd,
        priceCrc: product.price_crc,
        status: product.status,
        inventoryCount: product.inventory_count,
      });
    }
  }

  const requested = [...requestedByName.values()];
  const inEs = messageLang === 'es';

  if (missing.length > 0) {
    const names = [...new Set(missing)].join(', ');
    return { ok: false, error: inEs ? `Estos productos ya no están disponibles: ${names}` : `These products are no longer available: ${names}` };
  }
  if (requested.length === 0) return { ok: false, error: inEs ? 'El pedido no tiene artículos para comprar.' : 'The order has no purchasable items.' };

  const retiredWater = requested.filter((item) => isBacWater(item.product) && !isSellableBacWater(item.product));
  if (retiredWater.length > 0) {
    const names = retiredWater.map((item) => item.product).join(', ');
    return { ok: false, error: inEs ? `Estos productos ya no se venden: ${names}` : `These products are no longer sold: ${names}` };
  }

  // A null inventory_count means this product is not quantity-tracked. Most
  // legacy catalog rows use that shape and rely on the explicit In Stock / Out
  // of Stock status. Number(null) is 0, so treating the nullable column as a
  // number rejected every untracked product as sold out.
  const unavailable = requested.filter((item) => (
    item.status !== 'In Stock'
    || (item.inventoryCount !== null && Number(item.inventoryCount) <= 0)
  ));
  if (unavailable.length > 0) {
    const names = unavailable.map((item) => item.product).join(', ');
    return { ok: false, error: inEs ? `Estos productos están agotados: ${names}` : `These products are out of stock: ${names}` };
  }
  const overStock = requested.filter((item) => (
    item.inventoryCount !== null && item.qty > Number(item.inventoryCount)
  ));
  if (overStock.length > 0) {
    return {
      ok: false,
      error: overStock.map((item) => (
        inEs ? `${item.product}: solo hay ${item.inventoryCount} disponibles` : `${item.product}: only ${item.inventoryCount} available`
      )).join('; '),
    };
  }

  const bacMinimum = checkBacOnlyMinimum(requested);
  if (bacMinimum.blocked) {
    return {
      ok: false,
      error: inEs
        ? `Los pedidos solo de agua requieren al menos ${bacMinimum.minUnits} viales; agrega ${bacMinimum.shortfall} más.`
        : `Water-only orders require at least ${bacMinimum.minUnits} vials; add ${bacMinimum.shortfall} more.`,
    };
  }

  if (promo?.is_flash_sale && promo?.target_product) {
    const targets = String(promo.target_product).split(',').map(normalize).filter(Boolean);
    const hasTarget = requested.some((item) => (
      !isBacWater(item.product) && targets.some((target) => (
        promo.exact_target_match ? normalize(item.product) === target : normalize(item.product).includes(target)
      ))
    ));
    if (!hasTarget) {
      return { ok: false, error: inEs ? `Este código requiere ${promo.target_product} en el carrito.` : `This promo requires ${promo.target_product} in the cart.` };
    }
  }

  const vialCount = requested.filter((item) => !isBacWater(item.product)).reduce((sum, item) => sum + item.qty, 0);
  const overridePct = Number(volumeDiscountPctOverride);
  const hasOverride = volumeDiscountPctOverride !== null
    && volumeDiscountPctOverride !== undefined
    && volumeDiscountPctOverride !== ''
    && Number.isFinite(overridePct)
    && overridePct >= 0;
  let volumeDiscountPct = suppressVolumeDiscount
    ? 0
    : (hasOverride
      ? effectiveVolumeDiscountPct(promo, overridePct)
      : effectiveVolumeDiscountPct(promo, getVolumeDiscountPct(vialCount)));

  // A deal and a promo code are two ways to discount the same cart and they
  // never combine. Rather than letting whichever was resolved first win - which
  // let a 10% code silently cancel a 50% flash sale - both are priced and the
  // cheaper one is charged. Customers are told the same thing in the cart:
  // offers do not stack, you always get the biggest saving.
  const bacCharge = summarizeBacWater(requested, currency, exchangeRate).charge;

  const priceWith = ({ useDeal, usePromo }) => {
    let tierPct = volumeDiscountPct;
    const offer = useDeal && dealOffers
      ? chooseDealOffer(dealOffers, requested, { volumePct: tierPct, bacCharge, currency, exchangeRate })
      : null;
    if (offer && offer.kind !== 'volume' && offer.kind !== 'none') tierPct = 0;

    const lineTotals = computeOrderTotals(requested, currency, exchangeRate, { volumeDiscountPct: tierPct });
    const fullOrderPromo = usePromo && isFullOrderPromo(promo);
    let discount;
    if (fullOrderPromo) {
      discount = lineTotals.discountedTotal;
    } else if (offer?.kind === 'mix' || offer?.kind === 'spend') {
      // "10% off your entire order": totals.subtotal is the merchandise plus
      // the paid BAC water, so the water is discounted too. A Spend & Save
      // step takes its percentage off the same whole order.
      discount = roundCurrency(lineTotals.subtotal * (Number(offer.offer?.discount_pct ?? offer.mix.discountPct) || 0), currency);
    } else if (offer?.kind === 'flat' || offer?.kind === 'pair') {
      // A flash sale marks down only its own products. A "2nd vial" offer
      // marks down only the discounted vials in each pair. chooseDealOffer
      // already measured that against the same lines, so its figure is the discount.
      discount = roundCurrency(offer.savings, currency);
    } else {
      discount = promoDiscountAmount(requested, lineTotals, usePromo ? promo : null, currency);
    }
    const pricedTotals = fullOrderPromo ? { ...lineTotals, shipping: 0 } : lineTotals;
    return {
      dealOffer: offer,
      volumeDiscountPct: tierPct,
      totals: pricedTotals,
      promoDiscount: discount,
      total: roundCurrency(pricedTotals.discountedTotal - discount + pricedTotals.shipping, currency),
    };
  };

  const withDeal = priceWith({ useDeal: true, usePromo: false });
  // The code's own price only matters when one was actually entered.
  const withPromo = promo ? priceWith({ useDeal: false, usePromo: true }) : null;
  // Ties stay with the deal: it needs no code and is already on the shelf.
  let chosen = withPromo && withPromo.total < withDeal.total ? withPromo : withDeal;
  const businessPct = Number(businessDiscountPct);
  if (Number.isFinite(businessPct) && businessPct > 0 && businessPct <= 100) {
    const businessTotals = computeOrderTotals(requested, currency, exchangeRate, { volumeDiscountPct: businessPct });
    const businessPrice = {
      businessApplied: true,
      dealOffer: null, volumeDiscountPct: businessPct, totals: businessTotals,
      promoDiscount: 0, total: roundCurrency(businessTotals.discountedTotal + businessTotals.shipping, currency),
    };
    if (businessPrice.total <= chosen.total) chosen = businessPrice;
  }
  if (Array.isArray(businessProductPrices) && businessProductPrices.length) {
    const contracts=new Map(businessProductPrices.map(row=>[normalize(row.product),Number(row.unit_price_usd)]));
    const contractLines=requested.map(item=>{
      const usd=contracts.get(normalize(item.product));
      const catalogBusinessPrice=isBacWater(item.product)?item.unitPrice:item.unitPrice*(1-Math.max(0,Math.min(100,Number(businessPct)||0))/100);
      const contractPrice=Number.isFinite(usd) && usd>=0 && !isBacWater(item.product)?(currency==='USD'?round2(usd):Math.round(usd*exchangeRate)):catalogBusinessPrice;
      return {...item,unitPrice:roundCurrency(Math.min(catalogBusinessPrice,contractPrice),currency)};
    });
    const contractTotals=computeOrderTotals(contractLines,currency,exchangeRate,{volumeDiscountPct:0});
    const contractPrice={businessApplied:true,contractApplied:true,contractLines,dealOffer:null,volumeDiscountPct:0,totals:contractTotals,promoDiscount:0,total:roundCurrency(contractTotals.discountedTotal+contractTotals.shipping,currency)};
    if(contractPrice.total<=chosen.total) chosen=contractPrice;
  }
  const promoBeatDeal = chosen === withPromo;

  const dealOffer = chosen.dealOffer;
  volumeDiscountPct = chosen.volumeDiscountPct;
  const totals = chosen.totals;
  const promoDiscount = chosen.promoDiscount;
  const finalTotal = chosen.total;

  const orderLang = postedOrder?.lang || 'es';
  const canonicalItems = buildBacAwareOrderItems(chosen.contractLines || requested, {
    currency,
    exchangeRate,
    priceOf: (item) => item.unitPrice,
    lang: orderLang,
  });
  if (dealOffer?.kind === 'bundle') {
    for (const free of dealOffer.bundle.freeLines) canonicalItems.push(freeVialLine(free.product, free.qty, orderLang));
  } else if (!dealOffers) {
    canonicalItems.push(...postedPeptideGifts);
  }
  const postedTotal = currency === 'USD'
    ? Number(postedOrder?.total_usd || 0)
    : Number(postedOrder?.total_crc || 0);
  const tolerance = currency === 'USD' ? 0.009 : 0;

  return {
    ok: true,
    changed: Math.abs(postedTotal - finalTotal) > tolerance,
    currency,
    products: requested.map((item) => ({
      product: item.product,
      category: item.category,
      priceUsd: item.priceUsd,
      priceCrc: item.priceCrc,
      status: item.status,
      inventoryCount: item.inventoryCount,
    })),
    items: canonicalItems,
    subtotal: totals.subtotal,
    volumeDiscountPct,
    volumeDiscountAmount: totals.discountAmount,
    promoDiscount,
    dealOffer: dealOffer ? dealOffer.kind : null,
    // True when the entered code beat every running offer, so callers can say
    // which one was honoured instead of guessing.
    promoApplied: Boolean(promo) && promoBeatDeal,
    businessApplied: Boolean(chosen.businessApplied),
    contractApplied: Boolean(chosen.contractApplied),
    businessSavings: chosen.contractApplied ? roundCurrency(computeOrderTotals(requested,currency,exchangeRate,{volumeDiscountPct:0}).subtotal-totals.subtotal,currency) : 0,
    // Which deal's offer won, when the weekly deal and a flash sale were both
    // in the running. Null when the winner came from a single unpooled deal.
    dealOfferDealId: dealOffer?.dealId || null,
    shipping: totals.shipping,
    total: finalTotal,
    totalUsd: currency === 'USD' ? finalTotal : round2(finalTotal / exchangeRate),
    totalCrc: currency === 'CRC' ? finalTotal : Math.round(finalTotal * exchangeRate),
  };
}

export function activeDealForOrder(deals, items, now = new Date()) {
  const names = new Set((items || []).map((item) => normalize(stripGiftSuffix(item?.product || item?.name))));
  const instant = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return (deals || []).find((deal) => (
    deal?.status === 'live'
    && (!deal.starts_at || instant >= Date.parse(deal.starts_at))
    && (!deal.ends_at || instant <= Date.parse(deal.ends_at))
    && (deal.product_names || []).some((name) => names.has(normalize(name)))
  )) || null;
}
