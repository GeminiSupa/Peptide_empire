// Saved email HTML is HTML-encoded: the editor writes `?a=1&amp;b=2` inside an
// href. A browser decodes that before following the link, but the tracking
// rewrite reads the raw text, so the literal "&amp;" used to ride through to
// the landing page and turn `utm_medium` into a parameter called `amp;utm_medium`.
export function decodeUrlAmpersands(value) {
  let url = String(value ?? '');
  // Looped so a double-encoded `&amp;amp;` still comes out as a single `&`.
  for (let pass = 0; pass < 4; pass += 1) {
    const next = url.replace(/&(?:amp|#0*38|#x0*26);/gi, '&');
    if (next === url) break;
    url = next;
  }
  return url;
}

/**
 * The address a campaign link finally lands on: decoded, absolute, and carrying
 * UTM tags. A UTM tag the author already wrote is kept as written; only the
 * missing ones are added, so a link is never sent with two `utm_campaign`s.
 */
export function buildCampaignDestination(rawUrl, campaignId, domain) {
  const decoded = decodeUrlAmpersands(rawUrl);
  const absolute = decoded.startsWith('/') ? `${domain}${decoded}` : decoded;

  const hashAt = absolute.indexOf('#');
  const base = hashAt === -1 ? absolute : absolute.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : absolute.slice(hashAt);

  const queryAt = base.indexOf('?');
  const existing = new Set(
    (queryAt === -1 ? '' : base.slice(queryAt + 1))
      .split('&')
      .map((pair) => pair.split('=')[0].toLowerCase())
      .filter(Boolean),
  );

  const missing = [
    ['utm_source', 'email'],
    ['utm_medium', 'campaign'],
    ['utm_campaign', campaignId],
  ]
    .filter(([key]) => !existing.has(key))
    .map(([key, value]) => `${key}=${value}`);

  if (!missing.length) return `${base}${hash}`;
  const separator = queryAt === -1 ? '?' : (base.endsWith('?') || base.endsWith('&') ? '' : '&');
  return `${base}${separator}${missing.join('&')}${hash}`;
}
