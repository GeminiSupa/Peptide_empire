import { parsePrice } from '../catalog-pricing/pricing.mjs';

/**
 * The "was" price (USD) of a product row on sale, exactly when the catalog shows
 * one: the row has a discount, its sale window is open, and the original
 * price is above today's. Null otherwise. Checkout charges `price_usd` either
 * way; this is only the struck-through figure.
 */
export function salePrice(row, now = new Date()) {
  if (!row?.discount) return null;
  if (row.sale_start_time && new Date(row.sale_start_time) > now) return null;
  if (row.sale_end_time && new Date(row.sale_end_time) < now) return null;
  const wasUsd = parsePrice(row.original_price_usd);
  const nowUsd = parsePrice(row.price_usd);
  return wasUsd > nowUsd ? wasUsd : null;
}
