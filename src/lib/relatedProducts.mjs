/**
 * "Related products" per product, set in the admin's Products tab.
 *
 * Decides which other products the main website's product page
 * (peptidescostarica.net, branch `main`) offers: the "More in …" grid and
 * the second item in "Frequently ordered together". Asked for on 10 Nov 2026
 * so Google Ads landing pages can show no other products, or only ones the
 * ads team cleared (NAD+, Glutathione).
 *
 * Stored in `site_settings` row `related_products`, read by the website with
 * the public key (lib/site/related-products.mjs on `main` — keep the shape and
 * the key in step with it):
 *
 *   { products: { "<compound name, lower case>": { mode, picks } } }
 *
 * - no entry: automatic (same category, in stock) — what the site always did.
 * - mode "none": no other products.
 * - mode "pick": only the compounds named in `picks`, in that order.
 *
 * The compound name is the one the admin grid shows in its Product column
 * (the stored name with its size taken off, splitStoredProductForAdmin). On
 * 10 Nov 2026 that matched the website's own compound name for all 89 rows.
 */

import { splitStoredProductForAdmin } from './catalogCategories.mjs';

export const RELATED_SETTINGS_ID = 'related_products';
export const RELATED_MODES = ['auto', 'none', 'pick'];
export const MAX_RELATED_PICKS = 12;

/** The key a compound name is stored under. */
export function relatedKey(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** A database row's compound name, as the admin grid shows it. */
export function compoundNameOfRow(product, vialSize) {
  return splitStoredProductForAdmin(String(product || ''), vialSize).product.replace(/\s+/g, ' ').trim();
}

const cleanName = (name) => String(name || '').replace(/\s+/g, ' ').trim();

function cleanEntry(entry, ownKey) {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.mode === 'none') return { mode: 'none' };
  if (entry.mode !== 'pick') return null;
  const seen = new Set([ownKey]);
  const picks = [];
  for (const raw of Array.isArray(entry.picks) ? entry.picks : []) {
    const name = cleanName(raw);
    const key = relatedKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picks.push(name);
    if (picks.length >= MAX_RELATED_PICKS) break;
  }
  return { mode: 'pick', picks };
}

/** The stored value, cleaned: only valid entries survive. */
export function normalizeRelatedSettings(value) {
  const products = value && typeof value === 'object' && value.products && typeof value.products === 'object'
    ? value.products
    : {};
  const out = {};
  for (const [rawKey, entry] of Object.entries(products)) {
    const key = relatedKey(rawKey);
    const clean = key ? cleanEntry(entry, key) : null;
    if (clean) out[key] = clean;
  }
  return { products: out };
}

/** One compound's setting: { mode, picks }. */
export function relatedSettingFor(settings, compoundName) {
  const entry = normalizeRelatedSettings(settings).products[relatedKey(compoundName)];
  return entry ? { mode: entry.mode, picks: entry.picks || [] } : { mode: 'auto', picks: [] };
}

/**
 * The settings with one compound's choice replaced. Automatic removes the
 * entry. A product cannot be its own related product.
 */
export function withRelatedSetting(settings, compoundName, { mode, picks } = {}) {
  const key = relatedKey(compoundName);
  const next = normalizeRelatedSettings(settings);
  if (!key) return next;
  const entry = cleanEntry({ mode, picks }, key);
  if (entry) next.products[key] = entry;
  else delete next.products[key];
  return next;
}

/**
 * After products are renamed, carry each setting (and each pick) from the old
 * compound name to the new one — but only once no product still has the old
 * name, so renaming one size of a compound leaves the compound's setting alone.
 *
 * @param {object} settings the stored value
 * @param {{from: string, to: string}[]} renames compound names, old -> new
 * @param {string[]} existingNames every compound name in the products table now
 */
export function remapRelatedSettings(settings, renames = [], existingNames = []) {
  const current = normalizeRelatedSettings(settings);
  const existing = new Set(existingNames.map(relatedKey));
  const moves = new Map();
  for (const { from, to } of renames) {
    const fromKey = relatedKey(from);
    const toName = cleanName(to);
    if (!fromKey || !toName || fromKey === relatedKey(toName) || existing.has(fromKey)) continue;
    moves.set(fromKey, toName);
  }
  if (!moves.size) return current;

  const products = {};
  for (const [key, entry] of Object.entries(current.products)) {
    const moved = moves.has(key) ? relatedKey(moves.get(key)) : key;
    // A setting already saved under the new name wins over the carried one.
    if (moved !== key && current.products[moved]) continue;
    const picks = entry.picks?.map((name) => moves.get(relatedKey(name)) || name);
    const clean = cleanEntry({ ...entry, picks }, moved);
    if (clean) products[moved] = clean;
  }
  return { products };
}
