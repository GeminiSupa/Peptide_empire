// Copied from the catalog (src/lib/dealOffers.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
/**
 * Flexible deal offers. Admins can add any number of three proven pricing
 * mechanics: "Mix & Match", "Buy X, Get Y Free" and a straight "% off".
 *
 *   Mix & Match — N or more vials from the chosen products takes a percentage
 *   off the WHOLE order, BAC water included. BAC water never counts toward N.
 *
 *   Buy X Get Y — every X vials of one chosen product earn Y more of that same
 *   product free. The customer adds X; the free vials are added for them as
 *   zero-priced "(Free Gift)" lines, so stock, packing list and emails all see
 *   them. BAC water never qualifies.
 *
 *   Flat % off — a percentage off the chosen products themselves, with no
 *   minimum and no code. This is what a flash sale is made of: one vial of one
 *   product at half price qualifies on its own. It discounts only its own
 *   products, never the rest of the cart, so it cannot quietly mark down an
 *   order that happens to contain one sale item.
 *
 *   2nd vial half off — once the cart has two or more qualifying vials, the
 *   single cheapest one is a percentage off (this week's deal is 50%). Buying
 *   three or four still discounts only that one vial. The rest of the cart,
 *   and BAC water, stay full price.
 *
 *   Spend & Save — spending a dollar amount or more on the chosen products
 *   takes a percentage off the WHOLE order, BAC water included, exactly as
 *   Mix & Match does for a vial count. BAC water never counts toward the
 *   amount. Several of them make tiers ($150+ 10%, $250+ 15% …); the highest
 *   one reached saves the most, so it is the one that wins.
 *
 * The offers never stack with each other, with promo codes, or with the
 * automatic volume tiers: the order gets whichever ONE saves the most, the
 * volume tier included, so a deal week can never leave a customer paying more
 * than an ordinary week would have.
 *
 * Pure on purpose. The catalog cart and the server's authoritative checkout
 * both call chooseDealOffer with the same lines, so the total the customer
 * sees is the total the server charges.
 */

import { isBacWater } from './bacWater.mjs';
import { dealProductNamesMatch } from './catalogFilters.mjs';

export const OFFERS_PRICING_MODE = 'offers';
export const MIX_OFFER_TYPE = 'mix';
export const FLAT_OFFER_TYPE = 'flat';
export const BUNDLE_OFFER_TYPE = 'bundle';
/** A bundle counts the buy quantity per product, or across any of its products. */
export const SAME_PRODUCT_COUNT = 'same_product';
export const ANY_MIX_COUNT = 'any_mix';
export const PAIR_OFFER_TYPE = 'pair';
export const SPEND_OFFER_TYPE = 'spend';
export const FREE_SHIPPING_OFFER_TYPE = 'free_shipping';
export const GIFT_OFFER_TYPE = 'gift';

const nameKey = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

function toInt(value, fallback) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

function names(list) {
  return [...new Set((Array.isArray(list) ? list : [])
    .map((name) => String(name ?? '').trim())
    .filter(Boolean))];
}

function offerId(value, index, type) {
  const clean = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  return clean || `${type}-${index + 1}`;
}

function rawOfferItems(raw) {
  if (Array.isArray(raw?.items)) return raw.items;
  const items = [];
  if (raw?.mix) items.push({ ...raw.mix, type: MIX_OFFER_TYPE, id: raw.mix.id || 'mix-1' });
  if (raw?.bundle) items.push({ ...raw.bundle, type: BUNDLE_OFFER_TYPE, id: raw.bundle.id || 'bundle-1' });
  return items;
}

function offerType(raw) {
  if (raw?.type === BUNDLE_OFFER_TYPE) return BUNDLE_OFFER_TYPE;
  if (raw?.type === FLAT_OFFER_TYPE) return FLAT_OFFER_TYPE;
  if (raw?.type === PAIR_OFFER_TYPE) return PAIR_OFFER_TYPE;
  if (raw?.type === SPEND_OFFER_TYPE) return SPEND_OFFER_TYPE;
  if (raw?.type === FREE_SHIPPING_OFFER_TYPE) return FREE_SHIPPING_OFFER_TYPE;
  if (raw?.type === GIFT_OFFER_TYPE) return GIFT_OFFER_TYPE;
  return MIX_OFFER_TYPE;
}

function normalizeOffer(raw, index) {
  const type = offerType(raw);
  const base = {
    id: offerId(raw?.id, index, type),
    type,
    enabled: raw?.enabled === true,
    product_names: names(raw?.product_names),
    name_en: String(raw?.name_en || '').trim().slice(0, 100),
    name_es: String(raw?.name_es || '').trim().slice(0, 100),
    // Which deal contributed this offer. Set when two live deals are merged
    // into one storefront view, so the winning offer can be credited to the
    // deal that owns it rather than to whichever deal was read first.
    deal_id: String(raw?.deal_id || '').trim() || null,
  };
  if (type === BUNDLE_OFFER_TYPE) {
    // max_free_qty is the ceiling on free vials for the whole order. 0 is no
    // ceiling, which is how every bundle stored before this field behaved.
    // count_mode says whether the buy quantity must be one product or may be
    // any mix of the offer's products. Older bundles have no mode and keep
    // counting per product, which is what they have always done.
    return {
      ...base,
      buy_qty: Math.max(1, toInt(raw?.buy_qty, 4)),
      free_qty: Math.max(1, toInt(raw?.free_qty, 1)),
      max_free_qty: Math.max(0, toInt(raw?.max_free_qty, 0)),
      count_mode: raw?.count_mode === ANY_MIX_COUNT ? ANY_MIX_COUNT : SAME_PRODUCT_COUNT,
    };
  }
  if (type === FLAT_OFFER_TYPE || type === PAIR_OFFER_TYPE) {
    return { ...base, discount_pct: Number(raw?.discount_pct) || 0 };
  }
  if (type === SPEND_OFFER_TYPE) {
    // The minimum is always in dollars, whatever currency the cart is in. The
    // reward is EITHER a percentage of the whole order (discount_pct) OR a flat
    // dollar amount off it (discount_usd, also always in dollars); a fixed
    // amount is used whenever it is set.
    return {
      ...base,
      min_total_usd: Math.max(0, Number(raw?.min_total_usd) || 0),
      discount_pct: Number(raw?.discount_pct) || 0,
      discount_usd: Math.max(0, Number(raw?.discount_usd) || 0),
    };
  }
  if (type === FREE_SHIPPING_OFFER_TYPE) {
    return { ...base, min_units: Math.max(1, toInt(raw?.min_units, 1)) };
  }
  if (type === GIFT_OFFER_TYPE) {
    return {
      ...base,
      min_units: Math.max(1, toInt(raw?.min_units, 1)),
      gift_product_name: String(raw?.gift_product_name || '').trim(),
      gift_qty: Math.max(1, toInt(raw?.gift_qty, 1)),
    };
  }
  return { ...base, min_units: Math.max(1, toInt(raw?.min_units, 2)), discount_pct: Number(raw?.discount_pct) || 0 };
}

const disabledMix = () => ({ id: 'mix-1', type: MIX_OFFER_TYPE, enabled: false, product_names: [], name_en: '', name_es: '', min_units: 2, discount_pct: 0 });
const disabledBundle = () => ({ id: 'bundle-1', type: BUNDLE_OFFER_TYPE, enabled: false, product_names: [], name_en: '', name_es: '', buy_qty: 4, free_qty: 1, max_free_qty: 0, count_mode: SAME_PRODUCT_COUNT });

/** A stored or posted offers object, cleaned into one extensible shape. */
export function normalizeDealOffers(raw) {
  const items = rawOfferItems(raw).map(normalizeOffer);
  return {
    items,
    // Compatibility fields keep old deals and older callers working while the
    // flexible builder stores any number of offers in `items`.
    mix: items.find((item) => item.type === MIX_OFFER_TYPE) || disabledMix(),
    bundle: items.find((item) => item.type === BUNDLE_OFFER_TYPE) || disabledBundle(),
  };
}

/** Every product either offer covers, for matching, attribution and the page. */
export function dealOfferProductNames(offers) {
  const clean = normalizeDealOffers(offers);
  return names(clean.items.filter((item) => item.enabled).flatMap((item) => item.product_names));
}

/** '' when the offers can be launched, otherwise what the admin must fix. */
export function dealOffersError(offers) {
  const items = rawOfferItems(offers);
  if (!items.some((item) => item?.enabled === true)) return 'Turn on at least one offer.';
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] || {};
    if (item.enabled !== true) continue;
    const label = `Offer #${index + 1}`;
    if (![MIX_OFFER_TYPE, BUNDLE_OFFER_TYPE, FLAT_OFFER_TYPE, PAIR_OFFER_TYPE, SPEND_OFFER_TYPE, FREE_SHIPPING_OFFER_TYPE, GIFT_OFFER_TYPE].includes(item.type)) return `${label}: choose a supported offer type.`;
    if (names(item.product_names).length === 0) return `${label}: choose which products qualify.`;
    if (names(item.product_names).some(isBacWater)) return `${label}: BAC Water cannot be an offer product.`;
    if (item.type === FLAT_OFFER_TYPE || item.type === PAIR_OFFER_TYPE) {
      if (!(Number(item.discount_pct) > 0 && Number(item.discount_pct) < 1)) return `${label}: the discount must be between 1% and 99%.`;
    } else if (item.type === SPEND_OFFER_TYPE) {
      if (!(Number(item.min_total_usd) > 0)) return `${label}: the minimum spend must be more than $0.`;
      const hasUsd = Number(item.discount_usd) > 0;
      const pct = Number(item.discount_pct);
      if (hasUsd && pct > 0) return `${label}: set either a percentage or a dollar amount off, not both.`;
      if (!hasUsd && !(pct > 0 && pct < 1)) return `${label}: set a discount — a percentage (1% to 99%) or a dollar amount.`;
      if (hasUsd && Number(item.discount_usd) >= Number(item.min_total_usd)) return `${label}: the dollar discount must be less than the minimum spend.`;
    } else if (item.type === MIX_OFFER_TYPE) {
      if (!Number.isInteger(Number(item.min_units)) || Number(item.min_units) < 1) return `${label}: the vial minimum must be a whole number of 1 or more.`;
      if (!(Number(item.discount_pct) > 0 && Number(item.discount_pct) < 1)) return `${label}: the discount must be between 1% and 99%.`;
    } else if (item.type === FREE_SHIPPING_OFFER_TYPE) {
      if (!Number.isInteger(Number(item.min_units)) || Number(item.min_units) < 1) return `${label}: the vial minimum must be a whole number of 1 or more.`;
    } else if (item.type === GIFT_OFFER_TYPE) {
      if (!Number.isInteger(Number(item.min_units)) || Number(item.min_units) < 1) return `${label}: the vial minimum must be a whole number of 1 or more.`;
      if (!String(item.gift_product_name || '').trim()) return `${label}: choose the product the customer receives free.`;
      if (isBacWater(item.gift_product_name)) return `${label}: use the existing BAC Water gift setting instead.`;
      if (!Number.isInteger(Number(item.gift_qty)) || Number(item.gift_qty) < 1) return `${label}: the gift quantity must be a whole number of 1 or more.`;
    } else {
      if (!Number.isInteger(Number(item.buy_qty)) || Number(item.buy_qty) < 1) return `${label}: the buy quantity must be a whole number of 1 or more.`;
      if (!Number.isInteger(Number(item.free_qty)) || Number(item.free_qty) < 1) return `${label}: the free quantity must be a whole number of 1 or more.`;
      if (Number(item.free_qty) > Number(item.buy_qty)) return `${label}: the free vials cannot outnumber the vials bought.`;
      const cap = Number(item.max_free_qty ?? 0);
      if (!Number.isInteger(cap) || cap < 0) return `${label}: the most free vials per order must be a whole number, or 0 for no limit.`;
      if (cap > 0 && cap < Number(item.free_qty)) return `${label}: the most free vials per order cannot be less than the ${item.free_qty} this offer gives away.`;
    }
  }
  return '';
}

/**
 * Which offer this cart gets.
 *
 * @param offers  the deal's offers (any shape normalizeDealOffers accepts)
 * @param lines   paid cart lines: { product, qty, unitPrice, inventoryCount? }.
 *                Gift lines must already be left out. inventoryCount null or
 *                undefined means the product is not quantity-tracked.
 * @param opts.volumePct  the volume tier this cart would get with no deal
 * @param opts.bacCharge  the paid BAC water total, which Mix & Match discounts
 * @param opts.currency   'USD' or 'CRC', the currency the line prices are in
 * @param opts.exchangeRate  colones per dollar, for a CRC cart. A Spend & Save
 *                minimum is in dollars; without a currency (or, in colones,
 *                without a rate) it cannot be judged and does not apply.
 * @param opts.shippingCharge  the shipping fee this cart would otherwise pay.
 * @param opts.giftProducts  catalog products available as a configured gift:
 *                { product, unitPrice, inventoryCount? }.
 * @returns {{
 *   kind: 'mix'|'bundle'|'flat'|'pair'|'spend'|'volume'|'none',
 *   savings: number,
 *   mix: { enabled: boolean, units: number, minUnits: number, qualifies: boolean, discountPct: number, savings: number },
 *   bundle: { enabled: boolean, qualifies: boolean, freeLines: Array<{product: string, qty: number, unitPrice: number}>, savings: number, shortByStock: string[] },
 *   volumeSavings: number,
 * }}
 */
export function chooseDealOffer(offers, lines = [], { volumePct = 0, bacCharge = 0, currency = null, exchangeRate = null, shippingCharge = 0, giftProducts = [] } = {}) {
  const clean = normalizeDealOffers(offers);
  // Line-currency units per dollar, for comparing a cart with a dollar minimum.
  const spendRate = currency === 'USD'
    ? 1
    : (currency === 'CRC' && Number(exchangeRate) > 0 ? Number(exchangeRate) : 0);
  let merchSubtotal = 0;
  const paidLines = [];
  for (const line of lines || []) {
    const qty = Math.max(0, toInt(line?.qty, 0));
    if (!qty || isBacWater(line?.product)) continue;
    const unitPrice = Number(line?.unitPrice) || 0;
    merchSubtotal += unitPrice * qty;
    paidLines.push({ ...line, qty, unitPrice, key: nameKey(line.product) });
  }

  const offerResults = clean.items.filter((item) => item.enabled).map((item) => {
    // Exact name, or the same product under an older deal spelling after a
    // rename ("GLP-1 30mg" still matches "GLP-1 (RT) – Agonista Triple 30mg").
    const lineEligible = (line) => item.product_names.some((candidate) => dealProductNamesMatch(candidate, line.product));
    if (item.type === FLAT_OFFER_TYPE) {
      // Only the sale products are discounted, so the saving is measured on
      // their own lines. One vial is enough: there is no minimum to reach.
      let eligibleSubtotal = 0;
      let units = 0;
      for (const line of paidLines) {
        if (!lineEligible(line)) continue;
        eligibleSubtotal += line.unitPrice * line.qty;
        units += line.qty;
      }
      const savings = item.discount_pct * eligibleSubtotal;
      return { id: item.id, dealId: item.deal_id, type: item.type, config: item, qualifies: units > 0 && savings > 0, savings, units, minUnits: 0 };
    }
    if (item.type === MIX_OFFER_TYPE) {
      const units = paidLines.reduce((sum, line) => sum + (lineEligible(line) ? line.qty : 0), 0);
      const qualifies = units >= item.min_units;
      const savings = qualifies ? item.discount_pct * (merchSubtotal + (Number(bacCharge) || 0)) : 0;
      return { id: item.id, dealId: item.deal_id, type: item.type, config: item, qualifies, savings, units, minUnits: item.min_units };
    }
    if (item.type === SPEND_OFFER_TYPE) {
      // Only the offer's own products count toward the amount, so BAC water
      // never does. Once it is reached the whole order is discounted, BAC
      // water included, the same base Mix & Match uses.
      let spent = 0;
      let units = 0;
      for (const line of paidLines) {
        if (!lineEligible(line)) continue;
        spent += line.unitPrice * line.qty;
        units += line.qty;
      }
      const minSpend = spendRate > 0 ? item.min_total_usd * spendRate : 0;
      // A colón price is the dollar price rounded per vial, so a cart worth
      // exactly the minimum in dollars can come up half a colón a vial short.
      const slack = spendRate > 1 ? units * 0.5 : 0;
      const qualifies = minSpend > 0 && spent + slack >= minSpend;
      const orderBase = merchSubtotal + (Number(bacCharge) || 0);
      let savings = 0;
      if (qualifies) {
        if (Number(item.discount_usd) > 0) {
          // A flat dollar amount off the whole order, in the cart's currency,
          // never more than the order is worth. Rounding is left to checkout,
          // exactly as the percentage branch leaves it.
          const fixed = spendRate > 0 ? item.discount_usd * spendRate : 0;
          savings = Math.min(Math.max(0, fixed), orderBase);
        } else {
          savings = item.discount_pct * orderBase;
        }
      }
      return { id: item.id, dealId: item.deal_id, type: item.type, config: item, qualifies, savings, units, spent, minSpend };
    }
    if (item.type === PAIR_OFFER_TYPE) {
      // One discount per order: the single cheapest qualifying vial, and only
      // after a second vial is in the cart. A third or a fourth does not earn
      // another half-price vial.
      const prices = [];
      for (const line of paidLines) {
        if (!lineEligible(line)) continue;
        for (let i = 0; i < line.qty; i += 1) prices.push(line.unitPrice);
      }
      const cheapest = prices.length >= 2 ? Math.min(...prices) : 0;
      const savings = cheapest * item.discount_pct;
      return {
        id: item.id,
        dealId: item.deal_id,
        type: item.type,
        config: item,
        qualifies: savings > 0,
        savings,
        units: prices.length,
        minUnits: 2,
      };
    }
    if (item.type === FREE_SHIPPING_OFFER_TYPE) {
      const units = paidLines.reduce((sum, line) => sum + (lineEligible(line) ? line.qty : 0), 0);
      const qualifies = units >= item.min_units && Number(shippingCharge) > 0;
      return {
        id: item.id, dealId: item.deal_id, type: item.type, config: item,
        qualifies, savings: qualifies ? Number(shippingCharge) : 0, units, minUnits: item.min_units,
      };
    }
    if (item.type === GIFT_OFFER_TYPE) {
      const units = paidLines.reduce((sum, line) => sum + (lineEligible(line) ? line.qty : 0), 0);
      const gift = (giftProducts || []).find((product) => dealProductNamesMatch(item.gift_product_name, product?.product));
      const requestedGiftQty = item.gift_qty;
      const boughtGiftQty = paidLines.reduce((sum, line) => sum + (dealProductNamesMatch(item.gift_product_name, line.product) ? line.qty : 0), 0);
      const tracked = gift?.inventoryCount !== null && gift?.inventoryCount !== undefined && gift?.inventoryCount !== '';
      const available = tracked ? Math.max(0, toInt(gift.inventoryCount, 0) - boughtGiftQty) : requestedGiftQty;
      const enoughStock = Boolean(gift) && available >= requestedGiftQty;
      const qualifies = units >= item.min_units && enoughStock && Number(gift?.unitPrice) > 0;
      const freeLines = qualifies ? [{ product: gift.product, qty: requestedGiftQty, unitPrice: Number(gift.unitPrice) }] : [];
      return {
        id: item.id, dealId: item.deal_id, type: item.type, config: item,
        qualifies, savings: qualifies ? Number(gift.unitPrice) * requestedGiftQty : 0,
        units, minUnits: item.min_units, freeLines, shortByStock: units >= item.min_units && !enoughStock,
      };
    }

    const quantities = new Map();
    for (const line of paidLines) {
      if (!lineEligible(line)) continue;
      // One product can arrive on two lines; the vials still count together.
      const entry = quantities.get(line.key) || { product: line.product, qty: 0, unitPrice: line.unitPrice, inventoryCount: line.inventoryCount };
      entry.qty += line.qty;
      quantities.set(line.key, entry);
    }
    // A free vial has to exist to be given; the paid ones take stock first.
    const trackedSpare = (entry) => {
      const tracked = entry.inventoryCount !== null && entry.inventoryCount !== undefined && entry.inventoryCount !== '';
      return tracked ? Math.max(0, toInt(entry.inventoryCount, 0) - entry.qty) : null;
    };
    let freeLines = [];
    const shortByStock = [];
    if (item.count_mode === ANY_MIX_COUNT) {
      // Mix & match: every vial the offer covers counts toward the same buy
      // quantity, so 2 of one product and 1 of another reach "buy 3". The
      // cheapest vials are the ones given away, as elsewhere in this file.
      const pooled = [...quantities.values()].reduce((sum, entry) => sum + entry.qty, 0);
      let owed = Math.floor(pooled / item.buy_qty) * item.free_qty;
      // Counted one vial at a time, not one product at a time. Giving away as
      // many as possible of the cheapest product first handed a customer two
      // free vials of something they had bought one of, and charged them more
      // than the two genuinely cheapest vials would have. A paid vial can be
      // matched by a free one at most once, and only if the shelf has a spare.
      const candidates = [];
      for (const entry of quantities.values()) {
        const spare = trackedSpare(entry);
        const giveable = spare === null ? entry.qty : Math.min(entry.qty, spare);
        if (spare !== null && spare < entry.qty) shortByStock.push(entry.product);
        for (let i = 0; i < giveable; i += 1) candidates.push(entry);
      }
      candidates.sort((a, b) => a.unitPrice - b.unitPrice);
      const given = new Map();
      for (const entry of candidates) {
        if (owed <= 0) break;
        given.set(entry, (given.get(entry) || 0) + 1);
        owed -= 1;
      }
      for (const [entry, qty] of given) {
        freeLines.push({ product: entry.product, qty, unitPrice: entry.unitPrice });
      }
    } else {
      for (const entry of quantities.values()) {
        let free = Math.floor(entry.qty / item.buy_qty) * item.free_qty;
        if (free <= 0) continue;
        const spare = trackedSpare(entry);
        if (spare !== null && spare < free) {
          shortByStock.push(entry.product);
          free = spare;
        }
        if (free > 0) freeLines.push({ product: entry.product, qty: free, unitPrice: entry.unitPrice });
      }
    }
    // The buy/get pattern repeats per product, so without a ceiling a large
    // mixed cart gives away a free vial for every qualifying product at once.
    // The cheapest free vials are the ones kept, matching the 2nd-vial offer's
    // "the cheaper one" rule. A cap of 0 leaves the old behaviour untouched.
    const maxFree = Math.max(0, toInt(item.max_free_qty, 0));
    const earnedFree = freeLines.reduce((sum, line) => sum + line.qty, 0);
    const cappedByMax = maxFree > 0 && earnedFree > maxFree;
    if (cappedByMax) {
      let remaining = maxFree;
      freeLines = [...freeLines]
        .sort((a, b) => a.unitPrice - b.unitPrice)
        .map((line) => {
          const qty = Math.min(line.qty, remaining);
          remaining -= qty;
          return { ...line, qty };
        })
        .filter((line) => line.qty > 0);
    }
    const savings = freeLines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
    return { id: item.id, dealId: item.deal_id, type: item.type, config: item, qualifies: freeLines.length > 0, savings, freeLines, shortByStock, cappedByMax };
  });

  const volumeSavings = Math.max(0, Number(volumePct) || 0) / 100 * merchSubtotal;

  // Strictly greater wins, in the admin's displayed order. An exact tie stays
  // with the first weekly offer rather than silently switching to another one.
  let winner = null;
  for (const result of offerResults) {
    if (result.qualifies && result.savings > (winner?.savings || 0)) winner = result;
  }
  let kind = winner?.type || 'none';
  let savings = winner?.savings || 0;
  if (volumeSavings > savings) { kind = 'volume'; savings = volumeSavings; winner = null; }

  const firstMix = offerResults.find((item) => item.type === MIX_OFFER_TYPE);
  const firstBundle = offerResults.find((item) => item.type === BUNDLE_OFFER_TYPE);

  return {
    kind,
    savings,
    offerId: winner?.id || null,
    // The deal the winning offer came from, so an order is credited to the
    // flash sale or to the weekly deal — whichever actually discounted it.
    dealId: winner?.dealId || null,
    offer: winner?.config || null,
    offers: offerResults,
    // The currency the lines were priced in, so a "spend $X more" nudge can
    // say the amount in the money the customer is looking at.
    currency: spendRate > 0 ? currency : null,
    mix: {
      enabled: Boolean(firstMix),
      units: firstMix?.units || 0,
      minUnits: firstMix?.config.min_units || 0,
      qualifies: firstMix?.qualifies || false,
      discountPct: firstMix?.config.discount_pct || 0,
      savings: firstMix?.savings || 0,
    },
    bundle: {
      enabled: Boolean(firstBundle),
      qualifies: firstBundle?.qualifies || false,
      freeLines: kind === BUNDLE_OFFER_TYPE ? (winner?.freeLines || []) : [],
      possibleFreeLines: firstBundle?.freeLines || [],
      savings: firstBundle?.savings || 0,
      shortByStock: firstBundle?.shortByStock || [],
      maxFreeQty: firstBundle?.config.max_free_qty || 0,
      cappedByMax: firstBundle?.cappedByMax || false,
    },
    gift: {
      freeLines: kind === GIFT_OFFER_TYPE ? (winner?.freeLines || []) : [],
      shortByStock: kind === GIFT_OFFER_TYPE ? Boolean(winner?.shortByStock) : false,
    },
    volumeSavings,
  };
}

/** The order line for free vials, tagged the way every gift line already is. */
export function freeVialLine(product, qty, lang = 'es') {
  const isEn = String(lang).toLowerCase().startsWith('en');
  return { product: `${product} ${isEn ? '(Free Gift)' : '(Regalo)'}`, qty, price: 0 };
}

function offerDisplayName(item, lang) {
  const isEn = String(lang).toLowerCase().startsWith('en');
  return String(isEn ? item?.name_en : item?.name_es).trim();
}

/** "$150" or "$149.50": a Spend & Save minimum, always stated in dollars. */
function dollars(amount) {
  const value = Math.round((Number(amount) || 0) * 100) / 100;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** "$30" for a fixed Spend & Save reward, or "30%" for a percentage one. */
function spendRewardLabel(item) {
  return Number(item?.discount_usd) > 0
    ? dollars(item.discount_usd)
    : `${Math.round((Number(item?.discount_pct) || 0) * 100)}%`;
}

/** An amount still to spend, in the cart's own currency, rounded up. */
function cartMoney(amount, currency) {
  if (currency === 'CRC') return `₡${Math.ceil(Number(amount) || 0).toLocaleString('en-US')}`;
  return dollars(Math.ceil((Number(amount) || 0) * 100) / 100);
}

function offerSummary(item, lang = 'en') {
  const isEn = String(lang).toLowerCase().startsWith('en');
  const customName = offerDisplayName(item, lang);
  const pct = Math.round(item.discount_pct * 100);
  const terms = item.type === SPEND_OFFER_TYPE
    ? (isEn
      ? `Spend ${dollars(item.min_total_usd)}+, get ${spendRewardLabel(item)} off your whole order`
      : `Gasta ${dollars(item.min_total_usd)}+ y obtén ${spendRewardLabel(item)} de descuento en todo tu pedido`)
    : item.type === FREE_SHIPPING_OFFER_TYPE
    ? (isEn
      ? `Buy ${item.min_units}+ qualifying vials and get free shipping`
      : `Compra ${item.min_units}+ viales participantes y recibe envío gratis`)
    : item.type === GIFT_OFFER_TYPE
    ? (isEn
      ? `Buy ${item.min_units}+ qualifying vials and get ${item.gift_qty} × ${item.gift_product_name} free`
      : `Compra ${item.min_units}+ viales participantes y recibe ${item.gift_qty} × ${item.gift_product_name} gratis`)
    : item.type === FLAT_OFFER_TYPE
    ? (isEn
      ? `${pct}% off ${item.product_names.join(', ')}`
      : `${pct}% de descuento en ${item.product_names.join(', ')}`)
    : item.type === PAIR_OFFER_TYPE
    ? (isEn
      ? `Buy 1, get your 2nd vial ${pct}% off — the cheaper one, once per order`
      : `Compra 1 y el 2.º vial queda con ${pct}% de descuento — el más barato, una sola vez por pedido`)
    : item.type === BUNDLE_OFFER_TYPE
    ? (isEn
      ? `Buy ${item.buy_qty} ${item.count_mode === ANY_MIX_COUNT ? 'vials in any mix' : 'of the same vial'}, get ${item.free_qty} free of equal or lesser value${item.max_free_qty > 0 ? ` — up to ${item.max_free_qty} free per order` : ''}`
      : `Compra ${item.buy_qty} ${item.count_mode === ANY_MIX_COUNT ? 'viales combinados como quieras' : 'del mismo vial'} y llévate ${item.free_qty} gratis de igual o menor valor${item.max_free_qty > 0 ? ` — máximo ${item.max_free_qty} gratis por pedido` : ''}`)
    : (isEn
      ? `Buy ${item.min_units}+ vials, get ${pct}% off your whole order`
      : `Compra ${item.min_units}+ viales y obtén ${pct}% de descuento en todo tu pedido`);
  return customName ? `${customName}: ${terms}` : terms;
}

/**
 * The next Mix & Match step this cart has not reached yet.
 * Counts only that offer's own products. BAC water is already left out of
 * `units` by chooseDealOffer.
 */
function nextUnreachedMix(choice) {
  const pending = (choice?.offers || [])
    .filter((item) => item.type === MIX_OFFER_TYPE && item.config && !item.qualifies)
    .map((item) => ({
      units: item.units || 0,
      minUnits: item.minUnits || item.config.min_units,
      pct: Number(item.config.discount_pct) || 0,
    }))
    .filter((item) => item.minUnits > item.units && item.pct > 0)
    .sort((a, b) => a.minUnits - b.minUnits || b.pct - a.pct);
  return pending[0] || null;
}

function mixTierNudgeText(next, lang) {
  const toGo = next.minUnits - next.units;
  const pct = Math.round(next.pct * 100);
  const isEn = String(lang).toLowerCase().startsWith('en');
  return isEn
    ? `Add ${toGo} more ${toGo === 1 ? 'vial' : 'vials'} to unlock ${pct}% off.`
    : `Agrega ${toGo} ${toGo === 1 ? 'vial' : 'viales'} más para desbloquear ${pct}% de descuento.`;
}

/**
 * The loud cart line: how many more deal vials until the next Mix & Match
 * step. Empty once the top step is reached, and empty when a different offer
 * (free vials, a flash sale, or the everyday volume discount) is what the
 * cart actually gets — those messages must not be replaced by a step the
 * checkout will not apply.
 */
/** How many more vials, and what percent, until the next Mix & Match step.
 *  Null when checkout would not apply that step. */
export function dealOfferNextTierGap(choice) {
  if (!choice || (choice.kind !== MIX_OFFER_TYPE && choice.kind !== 'none')) return null;
  const next = nextUnreachedMix(choice);
  if (!next) return null;
  const toGo = next.minUnits - next.units;
  const pct = Math.round(next.pct * 100);
  if (toGo <= 0 || pct <= 0) return null;
  return { toGo, pct };
}

export function dealOfferNextTierNudge(choice, lang = 'en') {
  if (dealOfferNextTierGap(choice)) {
    const next = nextUnreachedMix(choice);
    if (next) return mixTierNudgeText(next, lang);
  }
  const spend = spendTierNudge(choice, lang);
  if (spend) return spend;
  return pairShortNudge(choice, lang);
}

/**
 * "Add $70 more to unlock 15% off": the next Spend & Save step above what the
 * cart already gets. Only while a Spend & Save step (or nothing) is what the
 * cart gets, for the same reason as the Mix & Match nudge.
 */
function spendTierNudge(choice, lang) {
  if (!choice || (choice.kind !== SPEND_OFFER_TYPE && choice.kind !== 'none')) return '';
  // A tier's "value" is its fixed dollars when set, otherwise its percentage.
  // Deals keep their spend tiers one kind or the other, so this orders them
  // whether they are $30/$70/$150 or 10%/15%/20%.
  const tierValue = (config) => (Number(config?.discount_usd) > 0 ? Number(config.discount_usd) : Number(config?.discount_pct) || 0);
  const reachedValue = choice.kind === SPEND_OFFER_TYPE ? tierValue(choice.offer) : 0;
  const next = (choice.offers || [])
    .filter((item) => item.type === SPEND_OFFER_TYPE && item.config && !item.qualifies && item.minSpend > 0)
    .map((item) => ({ toGo: item.minSpend - item.spent, value: tierValue(item.config), config: item.config }))
    .filter((item) => item.toGo > 0 && item.value > reachedValue)
    .sort((a, b) => a.toGo - b.toGo || b.value - a.value)[0];
  if (!next) return '';
  const amount = cartMoney(next.toGo, choice.currency);
  const off = spendRewardLabel(next.config);
  const isEn = String(lang).toLowerCase().startsWith('en');
  return isEn
    ? `Add ${amount} more to unlock ${off} off your whole order.`
    : `Agrega ${amount} más para desbloquear ${off} de descuento en todo tu pedido.`;
}

function pairShortNudge(choice, lang) {
  const pending = (choice?.offers || []).find((item) => item.type === PAIR_OFFER_TYPE && item.config && !item.qualifies);
  if (!pending) return '';
  const have = pending.units || 0;
  const toGo = 2 - have;
  const pct = Math.round((Number(pending.config.discount_pct) || 0) * 100);
  if (toGo <= 0 || pct <= 0) return '';
  const isEn = String(lang).toLowerCase().startsWith('en');
  return isEn
    ? `Add ${toGo} more ${toGo === 1 ? 'vial' : 'vials'} and the lower-priced one is ${pct}% off.`
    : `Agrega ${toGo} ${toGo === 1 ? 'vial' : 'viales'} más y el de menor precio queda con ${pct}% de descuento.`;
}

/** One line for the cart: which offer applied, or how to reach one. */
export function dealOfferCartMessage(choice, deal, lang = 'en') {
  if (!choice) return '';
  const isEn = String(lang).toLowerCase().startsWith('en');
  const clean = normalizeDealOffers(deal?.offers);
  const winning = choice.offer || clean.items.find((item) => item.id === choice.offerId);
  const winningResult = choice.offers?.find((item) => item.id === choice.offerId);

  if (choice.kind === MIX_OFFER_TYPE && winning) {
    const nudge = dealOfferNextTierNudge(choice, lang);
    if (nudge) return nudge;
    const pct = Math.round(winning.discount_pct * 100);
    return isEn
      ? `Deal of the Week — ${offerDisplayName(winning, lang) || 'Mix & Match'}: ${pct}% off your whole order is applied. Offers do not stack.`
      : `Oferta de la Semana — ${offerDisplayName(winning, lang) || 'Combina'}: ${pct}% de descuento en todo tu pedido aplicado. Las ofertas no se acumulan.`;
  }
  if (choice.kind === SPEND_OFFER_TYPE && winning) {
    const nudge = dealOfferNextTierNudge(choice, lang);
    if (nudge) return nudge;
    return isEn
      ? `Deal of the Week — ${offerDisplayName(winning, lang) || 'Spend & Save'}: ${spendRewardLabel(winning)} off your whole order is applied. Offers do not stack.`
      : `Oferta de la Semana — ${offerDisplayName(winning, lang) || 'Gasta y ahorra'}: ${spendRewardLabel(winning)} de descuento en todo tu pedido aplicado. Las ofertas no se acumulan.`;
  }
  if (choice.kind === BUNDLE_OFFER_TYPE && winning) {
    const free = (winningResult?.freeLines || []).map((line) => `${line.qty} × ${line.product}`).join(', ');
    const short = winningResult?.shortByStock?.length
      ? (isEn ? ' (limited by stock)' : ' (limitado por inventario)')
      : '';
    return isEn
      ? `Deal of the Week — ${offerDisplayName(winning, lang) || 'Buy & Get Free'}: ${free} FREE added to your order${short}. Offers do not stack.`
      : `Oferta de la Semana — ${offerDisplayName(winning, lang) || 'Compra y recibe gratis'}: ${free} GRATIS en tu pedido${short}. Las ofertas no se acumulan.`;
  }
  if (choice.kind === FREE_SHIPPING_OFFER_TYPE && winning) {
    return isEn
      ? `Deal of the Week — ${offerDisplayName(winning, lang) || 'Free Shipping'}: shipping is FREE. Offers do not stack.`
      : `Oferta de la Semana — ${offerDisplayName(winning, lang) || 'Envío gratis'}: el envío es GRATIS. Las ofertas no se acumulan.`;
  }
  if (choice.kind === GIFT_OFFER_TYPE && winning) {
    const free = (winningResult?.freeLines || []).map((line) => `${line.qty} × ${line.product}`).join(', ');
    return isEn
      ? `Deal of the Week — ${offerDisplayName(winning, lang) || 'Free Gift'}: ${free} FREE added to your order. Offers do not stack.`
      : `Oferta de la Semana — ${offerDisplayName(winning, lang) || 'Regalo gratis'}: ${free} GRATIS agregado a tu pedido. Las ofertas no se acumulan.`;
  }
  if (choice.kind === FLAT_OFFER_TYPE && winning) {
    const pct = Math.round(winning.discount_pct * 100);
    const what = winning.product_names.join(', ');
    return isEn
      ? `Flash sale — ${pct}% off ${what} is applied. Offers do not stack, so you always get the biggest saving.`
      : `Oferta relámpago — ${pct}% de descuento en ${what} aplicado. Las ofertas no se acumulan; siempre recibes el mayor ahorro.`;
  }
  if (choice.kind === PAIR_OFFER_TYPE && winning) {
    const pct = Math.round(winning.discount_pct * 100);
    return isEn
      ? `Deal of the Week — ${offerDisplayName(winning, lang) || '2nd vial'}: ${pct}% off the cheaper vial, once per order. Offers do not stack.`
      : `Oferta de la Semana — ${offerDisplayName(winning, lang) || '2.º vial'}: ${pct}% de descuento en el vial más barato, una sola vez por pedido. Las ofertas no se acumulan.`;
  }
  if (choice.kind === 'volume') {
    return isEn
      ? 'Your volume discount saves more than this week\'s offers, so it is applied instead.'
      : 'Tu descuento por volumen ahorra más que las ofertas de esta semana, así que se aplica ese.';
  }

  const nudge = dealOfferNextTierNudge(choice, lang);
  // Mix & Match and Spend & Save steps are described by the nudge above, not
  // as hints; the fallthrough below would call them "buy undefined get …".
  const hints = clean.items.filter((item) => item.enabled && item.type !== MIX_OFFER_TYPE && item.type !== SPEND_OFFER_TYPE).map((item) => {
    if (item.type === FLAT_OFFER_TYPE) {
      const pct = Math.round(item.discount_pct * 100);
      return isEn
        ? `add a sale item for ${pct}% off`
        : `agrega un producto en oferta para ${pct}% de descuento`;
    }
    if (item.type === PAIR_OFFER_TYPE) {
      const pct = Math.round(item.discount_pct * 100);
      return isEn
        ? `add a 2nd vial for ${pct}% off the cheaper one`
        : `agrega un 2.º vial para ${pct}% en el más barato`;
    }
    if (item.type === FREE_SHIPPING_OFFER_TYPE) {
      return isEn
        ? `buy ${item.min_units} qualifying vials for free shipping`
        : `compra ${item.min_units} viales participantes para envío gratis`;
    }
    if (item.type === GIFT_OFFER_TYPE) {
      return isEn
        ? `buy ${item.min_units} qualifying vials for ${item.gift_qty} × ${item.gift_product_name} free`
        : `compra ${item.min_units} viales participantes para recibir ${item.gift_qty} × ${item.gift_product_name} gratis`;
    }
    // Keep this short: the cart drawer is small, and the long "qualifying vials
    // in any combination…" wording filled half the screen on a phone.
    return isEn
      ? `buy ${item.buy_qty} get ${item.free_qty} free`
      : `compra ${item.buy_qty} y llévate ${item.free_qty} gratis`;
  });
  if (nudge && hints.length === 0) return nudge;
  const parts = nudge ? [nudge.replace(/\.$/, ''), ...hints] : hints;
  if (parts.length === 0) return '';
  const joined = parts.join(isEn ? ', or ' : ', o ');
  return isEn
    ? `Deal of the Week: ${joined}.`
    : `Oferta de la Semana: ${joined}.`;
}

/** Short offer summaries for banners, the bot and broadcasts. */
export function dealOfferSummaries(offers, lang = 'en') {
  const clean = normalizeDealOffers(offers);
  return clean.items.filter((item) => item.enabled).map((item) => offerSummary(item, lang));
}

/**
 * The complete customer-facing rules for the configured offers.
 *
 * Kept beside the pricing engine so the storefront page and the admin review
 * cannot drift into describing different rules. Every number comes from the
 * saved deal; changing a threshold in admin changes this copy automatically.
 */
export function dealOfferRuleSummaries(offers, lang = 'en') {
  const clean = normalizeDealOffers(offers);
  const isEn = String(lang).toLowerCase().startsWith('en');
  const rules = [];

  for (const item of clean.items.filter((offer) => offer.enabled)) {
    const customName = offerDisplayName(item, lang);
    const prefix = customName || (item.type === MIX_OFFER_TYPE
      ? (isEn ? 'Mix & Match' : 'Combina')
      : item.type === SPEND_OFFER_TYPE
        ? (isEn ? 'Spend & Save' : 'Gasta y ahorra')
      : item.type === FREE_SHIPPING_OFFER_TYPE
        ? (isEn ? 'Free Shipping' : 'Envío gratis')
      : item.type === GIFT_OFFER_TYPE
        ? (isEn ? 'Free Gift' : 'Regalo gratis')
      : item.type === FLAT_OFFER_TYPE
        ? (isEn ? 'Flash sale' : 'Oferta relámpago')
        : item.type === PAIR_OFFER_TYPE
          ? (isEn ? '2nd vial' : '2.º vial')
          : (isEn ? 'Buy & Get Free' : 'Compra y recibe gratis'));
    if (item.type === FLAT_OFFER_TYPE) {
      const pct = Math.round(item.discount_pct * 100);
      const names = item.product_names.join(', ');
      rules.push(isEn
        ? `${prefix}: ${pct}% off ${names}, from a single vial, with no minimum and no code. The discount applies to those products only, not to the rest of the order.`
        : `${prefix}: ${pct}% de descuento en ${names}, desde un solo vial, sin mínimo y sin código. El descuento aplica solo a esos productos, no al resto del pedido.`);
    } else if (item.type === PAIR_OFFER_TYPE) {
      const pct = Math.round(item.discount_pct * 100);
      rules.push(isEn
        ? `${prefix}: once the order has 2 or more qualifying vials, the single cheapest one is ${pct}% off. Buying 3 or 4 still discounts only that one vial. The rest of the order stays full price.`
        : `${prefix}: con 2 o más viales participantes, solo el más barato queda con ${pct}% de descuento. Si compras 3 o 4, el descuento sigue siendo un solo vial. El resto del pedido se paga completo.`);
    } else if (item.type === SPEND_OFFER_TYPE) {
      rules.push(isEn
        ? `${prefix}: spend ${dollars(item.min_total_usd)} or more on qualifying products (before shipping) and get ${spendRewardLabel(item)} off your entire order.`
        : `${prefix}: gasta ${dollars(item.min_total_usd)} o más en productos participantes (antes del envío) y obtén ${spendRewardLabel(item)} de descuento en todo tu pedido.`);
    } else if (item.type === MIX_OFFER_TYPE) {
      const pct = Math.round(item.discount_pct * 100);
      rules.push(isEn
        ? `${prefix}: buy ${item.min_units} or more qualifying peptide vials in any combination and get ${pct}% off your entire order.`
        : `${prefix}: compra ${item.min_units} o más viales de péptidos participantes en cualquier combinación y obtén ${pct}% de descuento en todo tu pedido.`);
    } else if (item.type === FREE_SHIPPING_OFFER_TYPE) {
      rules.push(isEn
        ? `${prefix}: buy ${item.min_units} or more qualifying peptide vials in any combination and checkout removes the shipping fee.`
        : `${prefix}: compra ${item.min_units} o más viales de péptidos participantes en cualquier combinación y el pago elimina el costo de envío.`);
    } else if (item.type === GIFT_OFFER_TYPE) {
      rules.push(isEn
        ? `${prefix}: buy ${item.min_units} or more qualifying peptide vials in any combination and checkout adds ${item.gift_qty} × ${item.gift_product_name} free, while stock lasts.`
        : `${prefix}: compra ${item.min_units} o más viales de péptidos participantes en cualquier combinación y el pago agrega ${item.gift_qty} × ${item.gift_product_name} gratis, hasta agotar existencias.`);
    } else {
      const { buy_qty: buy, free_qty: free } = item;
      const cap = Number(item.max_free_qty) || 0;
      rules.push(item.count_mode === ANY_MIX_COUNT
        ? (isEn
          ? `${prefix}: every ${buy} paid qualifying vials, in any combination of products and sizes, add ${free} free (${buy * 2} → ${free * 2} free, ${buy * 3} → ${free * 3} free). Free vials must be equal or lesser value — checkout always gives the cheapest qualifying vial(s) free. You cannot choose a more expensive product as the free gift.`
          : `${prefix}: cada ${buy} viales participantes pagados, en cualquier combinación de productos y tamaños, agregan ${free} gratis (${buy * 2} → ${free * 2} gratis, ${buy * 3} → ${free * 3} gratis). Los viales gratis deben ser de igual o menor valor: el pago siempre regala el/los vial(es) más barato(s). No puedes elegir un producto más caro como regalo.`)
        : (isEn
          ? `${prefix}: every ${buy} paid vials of the exact same product and size add ${free} more of that same item free (${buy * 2} → ${free * 2} free, ${buy * 3} → ${free * 3} free). The free vial is that same product and size only — equal value, not a different or more expensive product.`
          : `${prefix}: cada ${buy} viales pagados del mismo producto y tamaño agregan ${free} más del mismo artículo gratis (${buy * 2} → ${free * 2} gratis, ${buy * 3} → ${free * 3} gratis). El vial gratis es solo ese mismo producto y tamaño — igual valor, no un producto distinto o más caro.`));
      if (cap > 0) {
        rules.push(isEn
          ? `${prefix}: no more than ${cap} free ${cap === 1 ? 'vial' : 'vials'} per order in total, however many qualifying products the order holds. When an order earns more than that, the ${cap === 1 ? 'cheapest one is the vial' : `${cap} cheapest are the vials`} given free (equal or lesser value).`
          : `${prefix}: máximo ${cap} ${cap === 1 ? 'vial gratis' : 'viales gratis'} por pedido en total, sin importar cuántos productos participantes lleve el pedido. Si el pedido genera más, ${cap === 1 ? 'el vial gratis es el más barato' : `los ${cap} viales gratis son los más baratos`} (igual o menor valor).`);
      }
    }
  }

  rules.push(isEn
    ? 'If more than one deal or the normal volume discount qualifies, checkout automatically applies only the option that saves the customer the most. Promo codes and promotions never stack.'
    : 'Si califica más de una oferta o el descuento normal por volumen, el pago aplica automáticamente solo la opción que más ahorra al cliente. Los códigos y promociones nunca se acumulan.');
  const hasMix = clean.items.some((item) => item.enabled && item.type === MIX_OFFER_TYPE);
  const hasBundle = clean.items.some((item) => item.enabled && item.type === BUNDLE_OFFER_TYPE);
  const hasPair = clean.items.some((item) => item.enabled && item.type === PAIR_OFFER_TYPE);
  const hasSpend = clean.items.some((item) => item.enabled && item.type === SPEND_OFFER_TYPE);
  if (hasMix && hasBundle) {
    rules.push(isEn
      ? 'BAC Water does not count toward the Mix & Match minimum and cannot earn a free vial. Once Mix & Match is unlocked, its whole-order discount still includes BAC Water.'
      : 'El agua bacteriostática no cuenta para el mínimo de Combina y no puede generar un vial gratis. Cuando se activa Combina, su descuento para todo el pedido sí incluye el agua bacteriostática.');
  } else if (hasMix) {
    rules.push(isEn
      ? 'BAC Water does not count toward the Mix & Match minimum. Once the offer is unlocked, its whole-order discount still includes BAC Water.'
      : 'El agua bacteriostática no cuenta para el mínimo de Combina. Cuando se activa la oferta, su descuento para todo el pedido sí incluye el agua bacteriostática.');
  } else if (hasSpend && !hasBundle) {
    rules.push(isEn
      ? 'BAC Water does not count toward the spend minimum. Once the offer is unlocked, its whole-order discount still includes BAC Water.'
      : 'El agua bacteriostática no cuenta para el monto mínimo. Cuando se activa la oferta, su descuento para todo el pedido sí incluye el agua bacteriostática.');
  } else if (hasPair && !hasBundle) {
    rules.push(isEn
      ? 'BAC Water does not qualify and is not discounted.'
      : 'El agua bacteriostática no califica y no tiene descuento.');
  } else {
    rules.push(isEn
      ? 'BAC Water does not qualify and cannot earn a free vial.'
      : 'El agua bacteriostática no califica y no puede generar un vial gratis.');
  }
  rules.push(isEn
    ? 'The winning offer is applied automatically at checkout. No code is needed.'
    : 'La oferta ganadora se aplica automáticamente al pagar. No se necesita código.');

  return rules;
}

/**
 * The catalog ribbon for a product carried by a live flat offer.
 *
 * A flat offer is the only offer type whose saving is knowable from one
 * product alone - Mix & Match and Buy X Get Y both depend on what else is in
 * the cart, so neither can honestly label a single card. The shape matches
 * getPromoBadgeForProduct so the card's existing ribbon and struck-through
 * price need no special case; unlike a promo ribbon, this discount needs no
 * code, so the price shown is the price charged.
 */
export function flatOfferBadgeForProduct(offers, productName, lang = 'es') {
  const name = nameKey(productName);
  if (!name) return null;
  const isEn = String(lang).toLowerCase().startsWith('en');
  let best = null;
  for (const item of normalizeDealOffers(offers).items) {
    if (item.type !== FLAT_OFFER_TYPE || !item.enabled) continue;
    if (!item.product_names.some((candidate) => dealProductNamesMatch(candidate, productName))) continue;
    const pct = Math.round((Number(item.discount_pct) || 0) * 100);
    if (pct <= 0 || pct >= 100) continue;
    if (!best || pct > best.discountPct) {
      best = { text: isEn ? `Save ${pct}%` : `Ahorra ${pct}%`, discountPct: pct, code: null };
    }
  }
  return best;
}
