// The town a city page is about, and its H1 with the live site's template
// placeholders filled in.
//
// 138 of the live city pages print their H1 from a WordPress template whose
// tokens were never replaced: "Premium Peptides in [location] Alajuela",
// "Péptidos Premium en [location], [region]". The brief keeps each page's H1;
// these keep their wording with the town and province put where the template
// meant them to go. The town comes from the page title, which was filled in
// correctly ("Research Products in Sarchí, Alajuela – Peptides Costa Rica").

const titleCase = (slug) => slug.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

/** `{ town, region }` for a city page, in `lang`. */
export function cityPlace(page, lang = 'en') {
  const title = String(page?.head?.[`title_${lang}`] || page?.head?.title_en || '');
  const match = title.match(lang === 'es' ? /\ben ([^|–]+?)(?:\s*[|–]|$)/ : /\bin ([^|–]+?)(?:\s*[|–]|$)/);
  const parts = (match ? match[1] : '').split(',').map((part) => part.trim()).filter(Boolean);
  const segments = String(page?.slug || '').split('-');
  const regionFromSlug = segments.length > 1 ? titleCase(segments[segments.length - 1]) : '';
  return {
    town: parts[0] || titleCase(String(page?.slug || '')),
    region: parts[1] || (parts[0] && regionFromSlug && parts[0] !== regionFromSlug ? regionFromSlug : ''),
  };
}

/** The H1 with `[location]` and `[region]` filled in. Unchanged when it has neither. */
export function cityH1(h1, page, lang = 'en') {
  const text = String(h1 || '');
  if (!text.includes('[')) return text;
  const { town, region } = cityPlace(page, lang);
  return text
    .replace(/\[location\],?\s*\[region\]/, region ? `${town}, ${region}` : town)
    .replace(/\[location\],?\s*/, region ? `${town}, ` : town)
    .replace(/\[region\]/, region)
    .replace(/,\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
