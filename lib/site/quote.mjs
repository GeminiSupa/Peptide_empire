// What the cart costs, decided the way checkout decides it.
//
// This runs the catalog's own `authoritativeCheckout` — the function
// `/api/orders/create` charges with — over the cart, with the live deal. That
// is what makes the rule "the bigger discount applies, never both" hold on the
// page: the deal and the volume tiers are compared by the same code that will
// charge the order, not by a second copy of the rule.
//
// Relative imports so the unit tests can load this directly.

import { activeDealForOrder, authoritativeCheckout } from '../catalog-pricing/authoritativeCheckout.mjs';
import { OFFERS_PRICING_MODE } from '../catalog-pricing/dealOffers.mjs';
import { checkUnitLimits, countPromoEligibleUnits } from '../catalog-pricing/promoEligibility.mjs';

function dealMode(deal) {
  return deal?.pricing_mode || 'shelf';
}

/**
 * The live deal, if this cart qualifies for it — checkout only applies a deal
 * to an order that contains at least one of its products.
 */
export function matchedDeal(deal, cart, now = new Date()) {
  if (!deal) return null;
  const items = (cart || []).map((line) => ({ product: line.product }));
  return activeDealForOrder([{ ...deal, status: 'live' }], items, now);
}

/**
 * Price `cart` in `currency`.
 *
 * Returns checkout's own result (`subtotal`, `volumeDiscountPct`,
 * `volumeDiscountAmount`, `promoDiscount`, `dealOffer`, `shipping`, `total`)
 * plus two figures the page needs: `savings`, everything taken off, and
 * `discountPct`, that saving as a share of the subtotal. Returns null for an
 * empty cart.
 */
/**
 * The promo code to price `cart` with: the validated code, but only while the
 * cart meets its unit conditions — the same `checkUnitLimits` gate checkout
 * runs before it applies a code. Null otherwise.
 */
export function usablePromo(promo, cart) {
  if (!promo?.code) return null;
  const items = (cart || []).map((line) => ({ product: line.product, qty: line.qty }));
  return checkUnitLimits(promo, countPromoEligibleUnits(promo, items)).ok ? promo : null;
}

export function quoteCart(cart, { currency = 'CRC', exchangeRate, deal = null, promo = null, now = new Date() } = {}) {
  const lines = (cart || []).filter((line) => line && line.product && line.qty > 0);
  if (!lines.length) return null;

  const items = lines.map((line) => ({ product: line.product, qty: line.qty }));
  const products = lines.map((line) => ({
    product: line.product,
    price_usd: line.priceUsd,
    category: line.category || '',
    // The cart only holds what was in stock when it was added; checkout
    // re-checks stock against the live rows when the order is placed.
    status: 'In Stock',
    inventory_count: null,
  }));

  const matched = matchedDeal(deal, lines, now);
  const result = authoritativeCheckout({
    postedOrder: { items, currency },
    products,
    exchangeRate,
    // A code the cart qualifies for, as checkout's `resolvedPromo`. Checkout
    // compares it with the deal and charges the better of the two; so does
    // this, because it is the same function.
    promo: usablePromo(promo, lines),
    dealOffers: matched && dealMode(matched) === OFFERS_PRICING_MODE ? matched.offers : null,
    // A shelf deal has already marked the product rows down, so checkout
    // turns the volume tiers off rather than stacking them.
    suppressVolumeDiscount: Boolean(matched && dealMode(matched) === 'shelf'),
  });
  if (!result.ok) return null;

  const savings = (result.volumeDiscountAmount || 0) + (result.promoDiscount || 0);
  return {
    ...result,
    savings,
    discountPct: result.subtotal > 0 ? savings / result.subtotal : 0,
    dealApplied: Boolean(result.dealOffer && result.dealOffer !== 'volume' && result.dealOffer !== 'none'),
  };
}

/**
 * Progress toward free delivery, read off a quote: delivery is free exactly
 * when checkout charged none, and the distance left is measured on the
 * discounted items, as checkout measures it. `threshold` is in the quote's
 * currency.
 */
export function deliveryProgress(quote, threshold) {
  const items = quote ? quote.total - quote.shipping : 0;
  const reached = Boolean(quote) && quote.shipping === 0 && items > 0;
  return {
    threshold,
    items,
    reached,
    remaining: reached ? 0 : Math.max(0, threshold - items),
    percent: threshold > 0 ? Math.min(100, (items / threshold) * 100) : 0,
  };
}

/** A cart line for `variant` of `compound`, as use-cart stores one. */
export function lineFor(compound, variant, qty) {
  return {
    product: variant.product,
    slug: compound.slug,
    name: compound.name,
    size: variant.size,
    shelf: compound.shelf,
    category: compound.category,
    priceUsd: variant.priceUsd,
    priceCrc: variant.priceCrc,
    qty,
  };
}

/** `cart` with `line` in place of whatever it held for that product. */
export function withLine(cart, line) {
  return [...(cart || []).filter((entry) => entry.product !== line.product), line];
}
