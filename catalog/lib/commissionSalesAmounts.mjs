// Copied from the catalog (src/lib/commissionSalesAmounts.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
import { ADMIN_FALLBACK_EXCHANGE_RATE, singleDiscountOrderCurrencyPair } from './adminOrderTotals.mjs';

// Only complete pricing rows can be corrected. Older payout snapshots without
// items must retain their saved amounts rather than being repriced as zero.
export function commissionPricingOrder(order) {
  if (!Array.isArray(order?.items) || order.items.length === 0
    || !['percentage', 'fixed'].includes(order.manual_discount_type)
    || !(Number(order.manual_discount_value) > 0)) return order;
  const pair = singleDiscountOrderCurrencyPair(order);
  return { ...order, total_usd: pair.usd, total_crc: pair.crc };
}

export function getOrderSalesAmounts(order, exchangeRate = ADMIN_FALLBACK_EXCHANGE_RATE) {
  const priced = commissionPricingOrder(order);
  let usd = Number(priced.total_usd || 0);
  let crc = Number(priced.total_crc || 0);
  if (!usd && !crc && priced.total != null) {
    if (priced.currency === 'USD') usd = Number(priced.total || 0);
    else crc = Number(priced.total || 0);
  }
  if (usd > 0 && crc === 0) crc = usd * exchangeRate;
  else if (crc > 0 && usd === 0) usd = crc / exchangeRate;
  return {
    usd: Math.max(0, usd - Number(priced.refunded_amount_usd || 0)),
    crc: Math.max(0, crc - Number(priced.refunded_amount_crc || 0)),
  };
}
