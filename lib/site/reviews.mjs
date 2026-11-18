/**
 * The review scores the site shows, from each platform.
 *
 * Trustpilot and Shopper Approved are read live, at most once an hour: the
 * Trustpilot figure from the same data its own TrustBox loads, the Shopper
 * Approved one from the text of its live seal. Google and Facebook have no
 * public feed, so their 5.0 is fixed here, as it was on the live site.
 *
 * If a platform cannot be reached the last figure written here stands in, so
 * a slow vendor never breaks a page; the review count is left out then rather
 * than shown stale.
 */

/** Each platform's review page, where a score links to. */
export const REVIEW_LINKS = {
  trustpilot: 'https://www.trustpilot.com/review/peptidescostarica.net',
  google: 'https://maps.app.goo.gl/MN4ozARktFp51Hkc6',
  facebook: 'https://www.facebook.com/people/Peptides-CR/61595088776299/',
  shopperApproved: 'https://www.shopperapproved.com/reviews/peptidescostarica.net',
};

const TRUSTPILOT_DATA = 'https://widget.trustpilot.com/trustbox-data/5419b6a8b0d04a076446a9ad?businessUnitId=6a035f4f4881dbf345f5fc8f&locale=en-US';
const SHOPPER_APPROVED_SEAL = 'https://www.shopperapproved.com/svg-seal/42340/default-sa-seal.svg';

const FALLBACK = {
  trustpilot: { score: 4.6, count: null },
  google: { score: 5.0, count: null },
  facebook: { score: 5.0, count: null },
  shopperApproved: { score: 4.8, count: null },
};

/** Trustpilot's TrustBox data -> { score, count }, or null. */
export function parseTrustpilot(data) {
  const unit = data?.businessUnit;
  const score = Number(unit?.trustScore);
  const count = Number(unit?.numberOfReviews?.total);
  if (!Number.isFinite(score) || score <= 0) return null;
  return { score, count: Number.isFinite(count) && count > 0 ? count : null };
}

/** The Shopper Approved seal's SVG -> { score, count }, or null. */
export function parseShopperApprovedSeal(svg) {
  const text = String(svg || '');
  const score = Number(text.match(/id="Rating"[^>]*>\s*<tspan[^>]*>([\d.]+)</)?.[1]);
  const count = Number(text.match(/id="\(".*?<tspan[^>]*>\(<\/tspan>.*?<tspan[^>]*>(\d+)<\/tspan>/s)?.[1]);
  if (!Number.isFinite(score) || score <= 0 || score > 5) return null;
  return { score, count: Number.isFinite(count) && count > 0 ? count : null };
}

async function fetchWithin(url, as) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, { signal: controller.signal, next: { revalidate: 3600 } });
    if (!response.ok) return null;
    return as === 'json' ? await response.json() : await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** { trustpilot, google, facebook, shopperApproved }, each { score, count, url }. */
export async function getReviewScores() {
  // Colombia has no review platforms yet: show no scores, and don't pull Costa
  // Rica's Trustpilot/Shopper Approved. Returns {} so the review bars render
  // nothing; wire real Colombian review sources here when they exist.
  return {};
}
