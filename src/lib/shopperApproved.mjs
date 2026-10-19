/**
 * Shopper Approved: checkout survey + public review display.
 *
 * Survey: thank-you page only. Needs site id + survey token in the browser.
 * Display (seal, /reviews widget): needs only the site id. The survey token and
 * API token must never be sent to those surfaces.
 *
 * Env (gitignored locally, Vercel project settings in production):
 *   SHOPPER_APPROVED_SITE_ID
 *   SHOPPER_APPROVED_SURVEY_TOKEN   — survey only
 *   SHOPPER_APPROVED_DOMAIN         — optional; certificate host, default below
 */

/** One-shot handoff from checkout to the thank-you page. Not the Google key. */
export const SA_STORAGE_KEY = 'sa_review_optin';

/** Certificate page host when `SHOPPER_APPROVED_DOMAIN` is not set. */
export const SA_DEFAULT_DOMAIN = 'peptidescostarica.net';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_ID_PATTERN = /^\d{2,12}$/;
const SURVEY_TOKEN_PATTERN = /^[A-Za-z0-9]{4,64}$/;
const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9.-]{0,120}\.[a-z]{2,24}$/i;
const PRESET_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const clean = (value, limit = 240) => String(value ?? '').trim().slice(0, limit);

/**
 * Site id alone, for seals and the reviews-page widget. No token.
 *
 * @param {object} [env]
 * @returns {string | null}
 */
export function shopperApprovedSiteId(env = process.env) {
  const siteId = clean(env?.SHOPPER_APPROVED_SITE_ID, 12);
  return SITE_ID_PATTERN.test(siteId) ? siteId : null;
}

/**
 * The site id and survey token, or null when they are not configured.
 *
 * Reads only `SHOPPER_APPROVED_SITE_ID` and `SHOPPER_APPROVED_SURVEY_TOKEN`.
 * Anything else in the environment, including an API token, is ignored.
 *
 * @param {object} [env]
 * @returns {{ siteId: string, token: string } | null}
 */
export function shopperApprovedConfig(env = process.env) {
  const siteId = shopperApprovedSiteId(env);
  const token = clean(env?.SHOPPER_APPROVED_SURVEY_TOKEN, 64);
  if (!siteId) return null;
  if (!SURVEY_TOKEN_PATTERN.test(token)) return null;
  return { siteId, token };
}

/**
 * Public display values (no survey token). Null when the site id is missing.
 *
 * @param {object} [env]
 * @returns {{ siteId: string, certificateUrl: string, reviewPagePreset: string } | null}
 */
export function shopperApprovedDisplayConfig(env = process.env) {
  const siteId = shopperApprovedSiteId(env);
  if (!siteId) return null;

  const rawDomain = clean(env?.SHOPPER_APPROVED_DOMAIN, 120).toLowerCase() || SA_DEFAULT_DOMAIN;
  const domain = DOMAIN_PATTERN.test(rawDomain) ? rawDomain : SA_DEFAULT_DOMAIN;
  const presetRaw = clean(env?.SHOPPER_APPROVED_REVIEW_PAGE_PRESET, 64) || 'default';
  const reviewPagePreset = PRESET_PATTERN.test(presetRaw) ? presetRaw : 'default';

  return {
    siteId,
    certificateUrl: `https://www.shopperapproved.com/reviews/${domain}/`,
    reviewPagePreset,
  };
}

/**
 * What checkout hands to the thank-you page for this survey.
 *
 * The email stays out of the URL. Session storage keeps it for this tab only.
 */
export function buildShopperApprovedRecord({ orderId, email, name } = {}) {
  return {
    orderId: clean(orderId, 120),
    email: clean(email, 240).toLowerCase(),
    name: clean(name, 160),
  };
}

/**
 * The object their thank-you script expects, or null when this order should
 * not be asked.
 *
 * A missing order number or email means the page was opened without a purchase
 * just made in this tab. Showing the survey then would ask the wrong person.
 *
 * @returns {object | null}
 */
export function shopperApprovedValues({ siteId, token, record = {} } = {}) {
  const config = shopperApprovedConfig({
    SHOPPER_APPROVED_SITE_ID: siteId,
    SHOPPER_APPROVED_SURVEY_TOKEN: token,
  });
  if (!config) return null;

  const orderId = clean(record.orderId, 120);
  const email = clean(record.email, 240).toLowerCase();
  const name = clean(record.name, 160);
  if (!orderId) return null;
  if (!EMAIL_PATTERN.test(email)) return null;

  const values = {
    site: Number(config.siteId),
    token: config.token,
    orderid: orderId,
    email,
  };
  if (name) values.name = name;
  return values;
}

/** Script address for a site id that has already passed the digit check. */
export function shopperApprovedScriptUrl(siteId) {
  if (!SITE_ID_PATTERN.test(clean(siteId, 12))) return null;
  return `https://www.shopperapproved.com/thankyou/rate/${clean(siteId, 12)}.js`;
}

/**
 * Their reviews-page widget. Preset defaults to `default` (dashboard default).
 * Optional env `SHOPPER_APPROVED_REVIEW_PAGE_PRESET` for a custom preset id.
 */
export function shopperApprovedReviewPageScriptUrl(siteId, preset = 'default') {
  const id = clean(siteId, 12);
  const presetId = clean(preset, 64) || 'default';
  if (!SITE_ID_PATTERN.test(id)) return null;
  if (!PRESET_PATTERN.test(presetId)) return null;
  return `https://www.shopperapproved.com/widgets/${id}/merchant/review-page/${presetId}.js`;
}

/** Classic medium seal image. Shows nothing useful until they have ~10 reviews. */
export function shopperApprovedSealImageUrl(siteId) {
  const id = clean(siteId, 12);
  if (!SITE_ID_PATTERN.test(id)) return null;
  return `https://www.shopperapproved.com/seals/${id}-m.gif`;
}

/** Makes the classic seal open their certificate popup on click. */
export function shopperApprovedCertificateScriptUrl() {
  return 'https://www.shopperapproved.com/seals/certificate.js';
}
