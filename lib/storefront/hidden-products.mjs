/**
 * Products the catalog admin has switched off.
 *
 * The admin's hide switch (Products tab) does not delete a row: it adds the
 * row's exact `product` string to `site_settings` row `hidden_products`,
 * `value.names`. The catalog storefront, its WhatsApp bot and its Shopper
 * Approved feed all leave those rows out, and so must this site — otherwise a
 * product staff took off sale is still shown and can still be ordered here.
 *
 * Matching is by the exact `product` string, as the catalog matches it
 * (`hiddenProducts.includes(p.product)` in its catalog page).
 */

/** The hidden names out of a `site_settings` query result. Anything else → none. */
export function hiddenNamesFrom(settingsRows) {
  const names = Array.isArray(settingsRows) ? settingsRows[0]?.value?.names : null;
  return new Set(Array.isArray(names) ? names.filter((name) => typeof name === 'string') : []);
}

/** The product rows without the ones the admin hid. */
export function withoutHidden(rows, hiddenNames) {
  if (!hiddenNames?.size) return rows;
  return rows.filter((row) => !hiddenNames.has(row?.product));
}
