// Copied from the catalog (src/lib/paidClickIds.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
// The paid-ad click ids an order can carry: ?cid= and ?ttclid=.
//
// A click id is the only thing that ties one sale back to one ad click. The ad
// platform (or the media buyer's tracker) puts it on the landing URL, the
// landing page passes it on to checkout, and the order keeps it so the outbound
// "order paid" webhook can hand it back. Without it a sale can be counted but
// never attributed, which is exactly the hole this closes:
//
//   ?ref=tiktok-glp1-a&cid=abc123&ttclid=E.C.P2_ABC
//
//   ref    — which landing page (see landingRef.mjs)
//   cid    — the tracker's own click id, required by the receiver
//   ttclid — TikTok's click id, set by TikTok on the outbound click
//
// Same contract as the landing ref: this is user-controlled text off a query
// string, so it is trimmed and length-capped before it reaches the database,
// and anything unusable becomes null rather than failing the order. A sale is
// worth more than its tracking tag.
//
// Kept free of '@/lib' imports so tests/ can load it under `node --test`.

/** How much of a click id we keep. Real ones are well under this; the cap only
 *  guards against a pathological query string being pasted onto the row. */
export const CLICK_ID_MAX_LENGTH = 300;

/**
 * Returns a trimmed, length-capped click id, or null when there is nothing
 * usable. Never throws.
 *
 * @param {unknown} value the raw ?cid= / ?ttclid= value from the checkout payload
 * @returns {string|null}
 */
export function sanitizeClickId(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, CLICK_ID_MAX_LENGTH);
}
