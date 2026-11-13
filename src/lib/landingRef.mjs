// The paid-ad landing page's ?ref= value, cleaned for storage on an order.
//
// Paid ads point at dedicated landing pages, each carrying a ?ref=... that says
// which page produced the click. Checkout forwards whatever sits in that
// parameter, so it is user-controlled text and has to be bounded before it
// reaches the `orders.landing_ref` column: a sale is worth more than a tidy
// tag, so anything unusable is dropped rather than failing the order.
//
// Kept free of '@/lib' imports so tests/ can load it under `node --test`.

/** How much of the ref we keep. A real landing slug is short; this only guards
 *  against a pathological query string being pasted onto the row. */
export const LANDING_REF_MAX_LENGTH = 200;

/**
 * Returns a trimmed, length-capped landing ref, or null when there is nothing
 * usable. Never throws — a bad value becomes null, it does not fail checkout.
 *
 * @param {unknown} value the raw ?ref= value from the checkout payload
 * @returns {string|null}
 */
export function sanitizeLandingRef(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, LANDING_REF_MAX_LENGTH);
}
