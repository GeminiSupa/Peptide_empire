// What the cart needs to know on top of the totals: which bulk tier it is in,
// how far off the next one is, and how far off free delivery.
//
// Relative imports so the unit tests can load this directly.

import {
  FREE_SHIPPING_USD_THRESHOLD,
  computeOrderTotals,
  getVolumeDiscountPct,
} from '../catalog-pricing/pricing.mjs';
import { splitCartUnits } from '../catalog-pricing/bacWater.mjs';
import { STANDARD_FIVE_PLUS_PCT, tenPlusDiscountPct } from '../catalog-pricing/bulkDeal.mjs';

/** The unit price of a cart line in the active currency. */
export function unitPrice(line, currency) {
  return currency === 'USD' ? Number(line.priceUsd || 0) : Number(line.priceCrc || 0);
}

/** The cart in the shape the catalog's pricing functions expect. */
export function toLineItems(cart, currency) {
  return (cart || []).map((line) => ({
    product: line.product,
    qty: line.qty,
    unitPrice: unitPrice(line, currency),
  }));
}

/** Everything the cart costs, by the catalog's own arithmetic. */
export function totalsFor(cart, currency, exchangeRate) {
  return computeOrderTotals(toLineItems(cart, currency), currency, exchangeRate);
}

/**
 * The next bulk tier, and how many vials away it is — the nudge that turns a
 * four-vial cart into a five-vial one.
 *
 * BAC water is excluded, because it never counts toward a tier. Returns null
 * once the best tier is reached.
 */
export function nextTier(cart) {
  const { discountUnits } = splitCartUnits(cart || []);
  const tiers = [
    { at: 5, pct: STANDARD_FIVE_PLUS_PCT },
    { at: 10, pct: tenPlusDiscountPct() },
  ];

  for (const tier of tiers) {
    if (discountUnits < tier.at && tier.pct > getVolumeDiscountPct(discountUnits)) {
      return { ...tier, add: tier.at - discountUnits };
    }
  }
  return null;
}

/** The free-delivery threshold in the active currency. */
export function freeShippingThreshold(currency, exchangeRate) {
  return currency === 'USD'
    ? FREE_SHIPPING_USD_THRESHOLD
    : Math.round(FREE_SHIPPING_USD_THRESHOLD * exchangeRate);
}

/**
 * Progress toward free delivery.
 *
 * Measured against the discounted item total, which is the figure the catalog
 * tests the threshold on — not the pre-discount subtotal, and not the total
 * with shipping already added.
 */
export function freeDeliveryProgress(cart, currency, exchangeRate) {
  const totals = totalsFor(cart, currency, exchangeRate);
  const threshold = freeShippingThreshold(currency, exchangeRate);
  const reached = totals.shipping === 0 && totals.discountedTotal > 0;
  const remaining = reached ? 0 : Math.max(0, threshold - totals.discountedTotal);

  return {
    threshold,
    remaining,
    reached,
    percent: threshold > 0
      ? Math.min(100, Math.round((totals.discountedTotal / threshold) * 100))
      : 0,
  };
}

/** A stable key for a cart line: one compound at one strength. */
export function lineKey(product) {
  return String(product || '');
}

/** The number of vials in the cart, for the header badge. */
export function cartCount(cart) {
  return (cart || []).reduce((total, line) => total + Number(line.qty || 0), 0);
}
