/**
 * Canonical and hreflang links, derived from the route inventory
 * (data/routes.json) instead of copied from WordPress.
 *
 * WordPress's own tags (harvested into data/seo.json) were wrong in two ways
 * that this replaces with rules:
 *
 *  1. 15 Spanish mixing guides declared the ENGLISH guide as their canonical,
 *     telling Google the Spanish page is a duplicate not worth indexing.
 *     Rule: every page is its own canonical, except the duplicates below.
 *  2. 8 pages named the wrong translation (GHRP-6, HMG, SNAP-8 and VIP-5 all
 *     pointed at the Adamax page; two blog posts at unrelated posts).
 *     Rule: the language pair comes from the route inventory — the same map
 *     the language switcher uses — and is only emitted when both pages name
 *     each other.
 *
 * `/product/lp-<slug>/` pages are WooCommerce copies of `/product/<slug>/`
 * made for ads: same title, heading and content. They keep serving (ads link
 * to them) but declare the regular product as canonical, carry no hreflang of
 * their own, and stay out of the sitemap.
 *
 * Pure functions over the route list, so tests can run them on every page.
 */

const withSlash = (path) => (typeof path === 'string' && path.startsWith('/') && !path.endsWith('/') ? `${path}/` : path);

/** `{ enToEs, esToEn, enPaths }` from data/routes.json's `routes`. */
export function buildRouteIndex(routes, omitted = new Set()) {
  const enToEs = new Map();
  const esToEn = new Map();
  const enPaths = new Set();
  for (const { en, es } of routes) {
    if (!en || omitted.has(en)) continue;
    enPaths.add(en);
    if (!es) continue;
    enToEs.set(en, es);
    const existing = esToEn.get(es);
    // A landing copy shares its product's Spanish URL; the product owns it.
    if (!existing || (isLandingCopy(existing) && !isLandingCopy(en))) esToEn.set(es, en);
  }
  return { enToEs, esToEn, enPaths };
}

export function isLandingCopy(path) {
  return /^\/product\/lp-[^/]+\/$/.test(String(path || ''));
}

/** The page a path should name as canonical (a path, not a URL). */
export function canonicalPath(path, index) {
  const p = withSlash(path);
  if (isLandingCopy(p)) {
    const regular = p.replace('/product/lp-', '/product/');
    if (index.enPaths.has(regular)) return regular;
  }
  return p;
}

/**
 * `{ en, es }` paths for the hreflang tags of `path`, or null when the page
 * should carry none (a duplicate that canonicalises elsewhere). A language is
 * left out unless the two pages name each other. Paths not in the inventory
 * (pages the new design adds) use `fallback`.
 */
export function languagePair(path, index, fallback = {}) {
  const p = withSlash(path);
  if (canonicalPath(p, index) !== p) return null;
  const isSpanish = p === '/es/' || p.startsWith('/es/');
  const en = isSpanish ? index.esToEn.get(p) : (index.enPaths.has(p) ? p : undefined);
  if (!en) {
    return {
      en: withSlash(fallback.en) || (isSpanish ? undefined : p),
      es: withSlash(fallback.es) || (isSpanish ? p : undefined),
    };
  }
  const es = index.enToEs.get(en);
  const reciprocal = Boolean(es) && index.esToEn.get(es) === en && (!isSpanish || es === p);
  if (reciprocal) return { en, es };
  // Not a clean pair: name only this page's own language.
  return isSpanish ? { en: undefined, es: p } : { en, es: undefined };
}

/** Whether a path belongs in the sitemap: only pages that are their own canonical. */
export function isSitemapPath(path, index) {
  return canonicalPath(path, index) === withSlash(path);
}
