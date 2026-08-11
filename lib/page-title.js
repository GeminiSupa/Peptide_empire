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
