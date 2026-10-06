/**
 * A page's own title, without the site suffix WordPress appends to <title>.
 *
 * WordPress stores the title outside the body and lets the theme print it as
 * the <h1>. Renderers that inject a stored HTML body (the guides) therefore
 * need it passed in, or the page ships with no <h1> — which 24 guides did.
 */
export function pageTitle(page, lang) {
  const raw = page?.head?.[`title_${lang}`] || page?.head?.title_en || '';
  return raw.split('|')[0].split('–')[0].trim();
}

/**
 * A page's `<title>` with the brand suffix removed, so the root layout's
 * `template: '%s | Peptides Costa Rica'` can add it back exactly once.
 *
 * The harvested titles are inconsistent: WordPress/Yoast left the brand on most
 * of them ("About Us | Peptides Costa Rica") but not all. Passing those verbatim
 * through the template produced a doubled suffix on every nested page in both
 * languages — "About Us | Peptides Costa Rica | Peptides Costa Rica". Stripping a
 * trailing brand here first means every page ends in a single brand, whether the
 * harvest carried one or not. Both spellings (English "Peptides", Spanish
 * "Péptidos") are stripped, after any of the separators WordPress uses (| – —).
 */
const BRAND_SUFFIX = /\s*[|–—-]\s*(?:p[ée]ptid[eo]s)\s+costa\s+rica\s*$/i;

export function metaTitle(page, lang) {
  const raw = (page?.head?.[`title_${lang}`] || page?.head?.title_en || '').trim();
  if (!raw) return undefined;
  const cleaned = raw.replace(BRAND_SUFFIX, '').trim();
  return cleaned || raw;
}
