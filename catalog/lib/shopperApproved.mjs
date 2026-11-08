// Copied from the catalog (src/lib/shopperApproved.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
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
 *
 * Product reviews: the thank-you page also names what was bought
 * (`window.sa_products`), and /api/shopper-approved/products.csv is the product
 * feed their dashboard reads. Both use shopperApprovedProductId, or a review
 * cannot be matched to its product.
 */

import { catalogCompoundAndSize, catalogFacingName, productUrlSlug } from './catalogCategories.mjs';

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

/** No cart is this long; it bounds what one order can put in storage. */
const MAX_ORDER_PRODUCTS = 50;

/** Shown as the brand in the feed. The vials are sold under the store's name. */
const FEED_BRAND = 'Peptides Costa Rica';

/**
 * The product id Shopper Approved files a review under: the stored product
 * name as a slug, "GHK-Cu 50mg" -> "ghk-cu-50mg".
 *
 * The feed and the thank-you page must send the same id. The stored name is
 * the one thing every checkout path has: the cart, the saved order and the
 * card-payment page all carry it, and none carries the row id. So renaming a
 * product in the admin gives it a new id, and its reviews start again.
 */
export function shopperApprovedProductId(storedName) {
  return clean(storedName, 160)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The name Shopper Approved shows for a product: the catalog's English name. */
export function shopperApprovedProductName(storedName) {
  return catalogFacingName(clean(storedName, 160), 'en');
}

function cleanProductNames(names) {
  if (!Array.isArray(names)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of names) {
    const name = clean(raw, 160);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= MAX_ORDER_PRODUCTS) break;
  }
  return out;
}

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
 * `products` is the stored names of the paid lines, for product reviews.
 */
export function buildShopperApprovedRecord({ orderId, email, name, products } = {}) {
  const record = {
    orderId: clean(orderId, 120),
    email: clean(email, 240).toLowerCase(),
    name: clean(name, 160),
  };
  const productNames = cleanProductNames(products);
  if (productNames.length) record.products = productNames;
  return record;
}

/**
 * Their product bolt-on: `{ productId: productName }` for what was bought, or
 * null when the record names nothing. Their survey script reads it as
 * `window.sa_products`, so it must be set before that script loads.
 *
 * @returns {Record<string, string> | null}
 */
export function shopperApprovedProducts(record = {}) {
  const products = {};
  for (const storedName of cleanProductNames(record?.products)) {
    const id = shopperApprovedProductId(storedName);
    if (id && !(id in products)) products[id] = shopperApprovedProductName(storedName);
  }
  return Object.keys(products).length ? products : null;
}

/**
 * One feed row per product, with the same ids the thank-you page sends.
 *
 * There is no GTIN or manufacturer part number for these vials. Their guide
 * says to use the product id as the MPN in that case. The parent id groups the
 * sizes of one compound, so a review of the 50mg also counts for the 100mg.
 *
 * `google_id` is the id a product has in a Google Shopping feed, which they use
 * to send stars to Google. Their rule: a product not in that feed carries its
 * MPN there. This site sends Google no product feed, so every row is the MPN.
 *
 * @param {Array<{ product: string, vialSize?: string, imageUrl?: string }>} products
 * @param {string} siteUrl live origin, no trailing slash
 */
export function shopperApprovedFeedRows(products = [], siteUrl = '') {
  const origin = clean(siteUrl, 200).replace(/\/+$/, '');
  const absolute = (url) => {
    const text = clean(url, 1000);
    if (!text) return '';
    if (/^https?:\/\//i.test(text)) return text;
    return `${origin}${text.startsWith('/') ? '' : '/'}${text}`;
  };

  const seen = new Set();
  const rows = [];
  for (const product of products || []) {
    const storedName = clean(product?.product, 160);
    const id = shopperApprovedProductId(storedName);
    // Two names that slug alike would file reviews together. The first one
    // listed keeps the id rather than the feed carrying it twice.
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const { compound } = catalogCompoundAndSize({ product: storedName, vialSize: product?.vialSize });
    rows.push({
      id,
      title: shopperApprovedProductName(storedName),
      link: `${origin}/catalog/${productUrlSlug({ product: storedName, vialSize: product?.vialSize })}`,
      image_link: absolute(product?.imageUrl),
      brand: FEED_BRAND,
      mpn: id,
      gtin: '',
      item_group_id: shopperApprovedProductId(compound) || id,
      google_id: id,
    });
  }
  return rows;
}

const FEED_COLUMNS = ['id', 'title', 'link', 'image_link', 'brand', 'mpn', 'gtin', 'item_group_id', 'google_id'];

/** The feed as CSV, every field quoted so a comma in a name cannot shift a column. */
export function shopperApprovedFeedCsv(rows = []) {
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [FEED_COLUMNS.join(',')];
  for (const row of rows) lines.push(FEED_COLUMNS.map((column) => quote(row[column])).join(','));
  return `${lines.join('\r\n')}\r\n`;
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
