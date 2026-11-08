// Copied from the catalog (src/lib/publicUrl.js) by scripts/sync-catalog-checkout.mjs. Do not edit.
/**
 * The public origin customers should be sent to — payment redirects, links in email.
 *
 * Precedence matters here. VERCEL_URL is ALWAYS set on Vercel and points at the
 * deployment host (something.vercel.app), never the live domain. Older code checked
 * it before falling back to a domain constant, so in production it always won and
 * paying customers were redirected cross-origin mid-checkout. That loses their
 * browser storage — the cart and the "checkout completed" marker both live per
 * origin — which leaves a phantom abandoned cart behind for a customer who paid.
 *
 * So VERCEL_URL is now only used for preview deployments, where it is the correct
 * host to come back to.
 */

export const LIVE_SITE_URL = 'https://catalog.peptidescostarica.net';

/**
 * @param {string} [requestUrl] incoming request URL, used only as a local-dev fallback
 * @returns {string} origin with no trailing slash
 */
export function getPublicSiteUrl(requestUrl) {
  const strip = (u) => String(u).replace(/\/+$/, '');

  if (process.env.NEXT_PUBLIC_SITE_URL) return strip(process.env.NEXT_PUBLIC_SITE_URL);

  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return strip(`https://${process.env.VERCEL_URL}`);
  }

  // Website copy (scripts/sync-catalog-checkout.mjs): the company host the
  // request came in on (new.peptidescostarica.net now, peptidescostarica.net
  // after the move), so a customer is never sent to the catalog mid-payment.
  if (requestUrl) {
    try {
      const origin = new URL(requestUrl).origin;
      if (/^https:\/\/([a-z0-9-]+\.)*peptidescostarica\.net$/i.test(origin)) return origin;
    } catch {
      /* fall through */
    }
  }

  if (process.env.VERCEL_ENV === 'production') return LIVE_SITE_URL;

  // Local dev / unknown host: honour the origin the request actually came in on.
  if (requestUrl) {
    try {
      return strip(new URL(requestUrl).origin);
    } catch {
      /* fall through */
    }
  }

  return LIVE_SITE_URL;
}
