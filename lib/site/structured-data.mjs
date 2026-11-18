/**
 * Structured data (schema.org JSON-LD) for the new design.
 *
 * Built from what each page SHOWS — its breadcrumb, its FAQ accordion, the
 * products it lists, the live catalog prices — never from WordPress's
 * harvested graph (data/seo.json). That graph was unreliable: city pages
 * carried an empty LocalBusiness (blank address, logo and description), some
 * pages named another page's URL or the Spanish URL on an English page, and
 * its Product offers carry old WordPress prices.
 *
 * Google's rules this follows (developers.google.com/search/docs/appearance/
 * structured-data): markup must describe content visible on the page; at
 * most one FAQPage per page; breadcrumb items in order, the last one the
 * page itself; all URLs absolute on the canonical host.
 *
 * Pure functions: tests/structured-data.test.mjs runs them, and
 * scripts/check-structured-data.mjs audits every page of a running site.
 */

export const ORG_NAME = 'Peptidos Colombia';
export const LOGO_PATH = '/logo.png'; // 714 × 600 PNG

export const plainText = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#0?39;|&apos;/g, '\'')
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

/** An absolute URL on `base` (the canonical origin) for a path or URL. */
export function absoluteUrl(base, pathOrUrl) {
  if (!pathOrUrl) return undefined;
  return new URL(pathOrUrl, base).toString();
}

const orgId = (base) => `${absoluteUrl(base, '/')}#organization`;
const siteId = (base, lang) => `${absoluteUrl(base, lang === 'es' ? '/es/' : '/')}#website`;

/** The business. Emitted on the home pages; other nodes refer to it by @id. */
export function organizationNode({ base, contact = {}, sameAs = [] }) {
  const phones = [contact.phoneCr, contact.phoneUs].map(plainText).filter(Boolean);
  return {
    '@type': 'Organization',
    '@id': orgId(base),
    name: ORG_NAME,
    url: absoluteUrl(base, '/'),
    logo: { '@type': 'ImageObject', url: absoluteUrl(base, LOGO_PATH), width: 714, height: 600 },
    ...(contact.email ? { email: plainText(contact.email) } : {}),
    ...(phones[0] ? { telephone: phones[0] } : {}),
    contactPoint: phones.map((telephone, index) => ({
      '@type': 'ContactPoint',
      telephone,
      contactType: index === 0 ? 'customer service' : 'sales',
      areaServed: index === 0 ? 'CO' : 'US',
      availableLanguage: ['Spanish', 'English'],
    })),
    areaServed: { '@type': 'Country', name: 'Colombia' },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** The website, per language. */
export function websiteNode({ base, lang }) {
  return {
    '@type': 'WebSite',
    '@id': siteId(base, lang),
    name: ORG_NAME,
    url: absoluteUrl(base, lang === 'es' ? '/es/' : '/'),
    inLanguage: lang === 'es' ? 'es-CR' : 'en-US',
    publisher: { '@id': orgId(base) },
  };
}

/**
 * BreadcrumbList from the visible breadcrumb: `[{ name, href }]`, home first,
 * the current page last (its `href` may be omitted; `url` is used).
 */
export function breadcrumbNode({ base, url, items }) {
  const list = items
    .map((item, index) => ({
      name: plainText(item.name),
      item: absoluteUrl(base, index === items.length - 1 ? (item.href || url) : item.href),
    }))
    .filter((item) => item.name && item.item);
  if (list.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absoluteUrl(base, url)}#breadcrumb`,
    itemListElement: list.map((item, index) => ({ '@type': 'ListItem', position: index + 1, ...item })),
  };
}

/**
 * One FAQPage for every question shown on the page, in order, from
 * `[[question, answer], …]` lists (several accordions merge into one; a
 * question shown twice is listed once).
 */
export function faqNode({ base, url, lists }) {
  const seen = new Set();
  const entries = [];
  for (const [question, answer] of lists.flat()) {
    const q = plainText(question);
    const a = plainText(answer);
    if (!q || !a || seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    entries.push({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } });
  }
  if (!entries.length) return null;
  return { '@type': 'FAQPage', '@id': `${absoluteUrl(base, url)}#faq`, url: absoluteUrl(base, url), mainEntity: entries };
}

/** A page that lists products: CollectionPage with its ItemList. */
export function collectionNodes({ base, url, name, description, lang, products }) {
  const pageUrl = absoluteUrl(base, url);
  // Only real pages: a catalog filter link (`?…`) is not an item's own URL.
  const list = products.filter((product) => product.href && product.name && !String(product.href).includes('?'));
  return [
    {
      '@type': 'CollectionPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: plainText(name),
      ...(description ? { description: plainText(description) } : {}),
      inLanguage: lang === 'es' ? 'es-CR' : 'en-US',
      isPartOf: { '@id': siteId(base, lang) },
      ...(list.length ? { mainEntity: { '@id': `${pageUrl}#itemlist` } } : {}),
    },
    ...(list.length ? [{
      '@type': 'ItemList',
      '@id': `${pageUrl}#itemlist`,
      numberOfItems: list.length,
      itemListElement: list.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: plainText(product.name),
        url: absoluteUrl(base, product.href),
      })),
    }] : []),
  ];
}

/** A blog post or guide. Dates only when WordPress recorded them. */
export function articleNode({ base, url, headline, description, image, lang, section, dates }) {
  const pageUrl = absoluteUrl(base, url);
  return {
    '@type': 'BlogPosting',
    '@id': `${pageUrl}#article`,
    mainEntityOfPage: pageUrl,
    headline: plainText(headline).slice(0, 110),
    ...(description ? { description: plainText(description) } : {}),
    ...(image ? { image: [absoluteUrl(base, image)] } : {}),
    inLanguage: lang === 'es' ? 'es-CR' : 'en-US',
    ...(section ? { articleSection: plainText(section) } : {}),
    ...(dates?.published ? { datePublished: dates.published } : {}),
    ...(dates?.modified ? { dateModified: dates.modified } : {}),
    author: { '@id': orgId(base) },
    publisher: { '@id': orgId(base) },
  };
}

/** One JSON-LD document holding several nodes; null nodes are dropped. */
export function graph(nodes) {
  const list = nodes.flat().filter(Boolean);
  if (!list.length) return null;
  return { '@context': 'https://schema.org', '@graph': list };
}

/** JSON for a <script type="application/ld+json">, safe inside HTML. */
export function jsonLdText(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
