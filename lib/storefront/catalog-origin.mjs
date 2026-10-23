/**
 * Where the catalog application lives.
 *
 * This storefront reads prices from Supabase directly, but it does not price
 * or save orders: it posts them to the catalog's `/api/orders/create`, the one
 * door every public order already goes through. Card payments then continue on
 * the catalog's own `/pay-card` page.
 *
 * ── Why the host matters ───────────────────────────────────────────────────
 *
 * `/api/orders/create` accepts a browser POST only when the request's Origin
 * is the catalog itself or a `*.peptidescostarica.net` host (the catalog's
 * `isTrustedStorefrontRequest`, a CSRF control). So this site can submit
 * orders when it is served from the company domain, and cannot when it is
 * served from a `*.vercel.app` preview URL — a preview will be refused.
 *
 * To take real orders from a preview, give the Vercel project a company
 * subdomain (for example `new.peptidescostarica.net`). Pointing the bare
 * `peptidescostarica.net` at Vercel is a separate, deliberate cutover: the
 * WordPress site is still live there.
 */

export const CATALOG_ORIGIN = (
  process.env.NEXT_PUBLIC_CATALOG_ORIGIN || 'https://catalog.peptidescostarica.net'
).replace(/\/+$/, '');

/** A path on the catalog. */
export function catalogUrl(path) {
  return `${CATALOG_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Whether the browser's current origin is one the catalog will accept an
 * order from. Used to tell a tester "this preview cannot submit orders"
 * instead of letting them fill in a form that is going to be refused.
 */
export function canSubmitOrdersFrom(origin) {
  if (!origin) return false;
  let host;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') {
      // The catalog only relaxes this for localhost when IT is not in
      // production, which the live catalog always is.
      return false;
    }
    host = url.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return false;
  }
  return host === 'peptidescostarica.net'
    || host.endsWith('.peptidescostarica.net');
}
