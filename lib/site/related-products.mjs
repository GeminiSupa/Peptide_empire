/**
 * Which other products a product page offers: the "More in …" grid under the
 * page and the second item in "Frequently ordered together".
 *
 * Staff choose per product in the catalog admin (Products tab → "Related
 * products"), saved in `site_settings` row `related_products`:
 *
 *   { products: { "<compound name, lower case>": { mode, picks } } }
 *
 * - no entry, or mode "auto": same shelf, in stock, as the page always did.
 * - mode "none": no other products at all (Google Ads compliance on ad
 *   landing pages: owner's team, 10 Nov 2026).
 * - mode "pick": only the compounds named in `picks`, in that order, and only
 *   while they are on sale and in stock.
 *
 * The key is the compound name as stored (the catalog's name, before this
 * site's display names), lower-cased — the same name the admin shows.
 *
 * `settings` of null means the row could not be read. Then no product page
 * offers other products: showing a product staff switched off on an ad
 * landing page is worse than a missing upsell until the next refresh.
 *
 * The free BAC Water in "Frequently ordered together" is a supply sold with
 * every order, not a related product, and is not affected.
 */

export const RELATED_SETTINGS_ID = 'related_products';

/** The key a compound name is stored under. */
export function relatedKey(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** This compound's setting: { mode: 'auto' | 'none' | 'pick', picks: string[] }. */
export function relatedSettingFor(settings, compound) {
  if (!settings) return { mode: 'none', picks: [] };
  const products = settings && typeof settings.products === 'object' ? settings.products : {};
  const entry = products[relatedKey(compound?.storedName || compound?.name)];
  if (entry?.mode === 'none') return { mode: 'none', picks: [] };
  if (entry?.mode === 'pick') {
    const picks = Array.isArray(entry.picks) ? entry.picks.filter((name) => typeof name === 'string') : [];
    return { mode: 'pick', picks };
  }
  return { mode: 'auto', picks: [] };
}

/** The other compounds this page shows, at most `n`. */
export function relatedCompounds(compound, compounds, settings, n) {
  const setting = relatedSettingFor(settings, compound);
  const others = (compounds || []).filter((entry) => entry.slug !== compound.slug && entry.inStock);
  if (setting.mode === 'none') return [];
  if (setting.mode === 'pick') {
    const byKey = new Map(others.map((entry) => [relatedKey(entry.storedName || entry.name), entry]));
    const chosen = [];
    for (const name of setting.picks) {
      const match = byKey.get(relatedKey(name));
      if (match && !chosen.includes(match)) chosen.push(match);
    }
    return chosen.slice(0, n);
  }
  return others.filter((entry) => entry.shelf === compound.shelf).slice(0, n);
}

/**
 * The product offered beside this one in "Frequently ordered together", or
 * null. Automatic: a best seller from the same shelf, else the first one.
 * Chosen: the first chosen product.
 */
export function companionCompound(compound, compounds, settings) {
  const setting = relatedSettingFor(settings, compound);
  if (setting.mode === 'none') return null;
  const near = relatedCompounds(compound, compounds, settings, 10);
  if (setting.mode === 'pick') return near[0] || null;
  return near.find((entry) => entry.best) || near[0] || null;
}
