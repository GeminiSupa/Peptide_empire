import routeData from '@/data/routes.json';

/**
 * URL resolution for both languages.
 *
 * Spanish paths CANNOT be derived from English ones. The live site runs
 * TranslatePress with translated slugs, so `/about/` is served at
 * `/es/acerca-de/` — and 131 of 321 Spanish slugs are *not* translated at all.
 * There is no rule; it is per-page data harvested from the live site into
 * data/routes.json by scripts/harvest-routes.mjs.
 *
 * Content files therefore store the ENGLISH canonical path for every internal
 * link, and rendering resolves it here. That keeps one link in the data and
 * both languages correct.
 */

export const DEFAULT_LANG = 'es';
export const LANGS = ['es', 'en'];

const EN_TO_ES = new Map();
const ES_TO_EN = new Map();
const GROUP_BY_EN = new Map();

/**
 * WordPress records that are deliberately not published by the custom site.
 * Keep this list next to URL resolution so a duplicate translated slug cannot
 * make a language switcher point back at an intentionally missing test page.
 */
export const OMITTED_ROUTE_PATHS = new Set(['/product/pt-141-10mgtest/']);

for (const { en, es, group } of routeData.routes) {
  if (OMITTED_ROUTE_PATHS.has(en)) continue;
  GROUP_BY_EN.set(en, group);
  if (!es) continue;
  EN_TO_ES.set(en, es);
  const existing = ES_TO_EN.get(es);
  if (!existing) {
    ES_TO_EN.set(es, en);
  } else if (existing !== en) {
    // Landing products share the regular product's Spanish URL. The regular
    // product is the canonical English destination when switching back.
    const existingIsLanding = existing.startsWith('/product/lp-');
    const candidateIsLanding = en.startsWith('/product/lp-');
    if (existingIsLanding && !candidateIsLanding) ES_TO_EN.set(es, en);
    else if (!existingIsLanding && !candidateIsLanding) {
      throw new Error(`Conflicting Spanish route ${es}: ${existing} and ${en}`);
    }
  }
}

/** Normalise to the trailing-slash form the live site uses. */
function withSlash(path) {
  if (!path || typeof path !== 'string') return path;
  if (!path.startsWith('/')) return path; // external or mailto:/tel:
  return path.endsWith('/') ? path : `${path}/`;
}

const isInternal = (href) => typeof href === 'string' && href.startsWith('/');

/**
 * Resolve an English canonical path to the path for `lang`.
 * Non-internal hrefs (mailto:, tel:, https://) pass through untouched.
 */
export function localePath(enPath, lang = DEFAULT_LANG) {
  if (!isInternal(enPath)) return enPath;
  const path = withSlash(enPath);
  if (lang !== 'es') return path;
  return EN_TO_ES.get(path) ?? path;
}

/** The English canonical path for any known path, in either language. */
export function toEnglishPath(path) {
  const p = withSlash(path);
  return ES_TO_EN.get(p) ?? p;
}

/**
 * The same page in the other language — what the header toggle links to.
 * Falls back to that language's home page rather than a 404.
 */
export function alternatePath(currentPath, currentLang) {
  const en = toEnglishPath(currentPath);
  const other = currentLang === 'es' ? 'en' : 'es';
  const resolved = localePath(en, other);
  if (resolved) return resolved;
  return other === 'es' ? '/es/' : '/';
}

/** Both language URLs for a page, for hreflang tags. */
export function alternates(enPath) {
  return { en: localePath(enPath, 'en'), es: localePath(enPath, 'es') };
}

export function routeGroup(enPath) {
  return GROUP_BY_EN.get(withSlash(enPath)) ?? null;
}

/** Every English path in a group — used to generate static routes. */
export function pathsInGroup(group) {
  return routeData.routes.filter((r) => r.group === group).map((r) => r.en);
}

export const allRoutes = routeData.routes;
export const harvestedAt = routeData.harvestedAt;
