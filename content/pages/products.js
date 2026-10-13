/**
 * The WooCommerce product pages.
 *
 * Kept out of content/pages/registry.js on purpose. That registry serves the
 * single-segment root namespace and keys pages by their last path segment;
 * products live under their own prefix — `/product/<slug>/` in English and
 * `/es/producto/<slug>/` in Spanish — so keying them the same way would let a
 * product collide with a city or guide of the same name.
 *
 * WordPress now uses `/es/producto/` as the canonical Spanish base. The former
 * `/es/producto-2/` paths are retained as permanent redirects in next.config.
 *
 * This project sells nothing. Product pages display price and specification and
 * send every buy action to the catalog site, which owns the cart and orders.
 */
import productData from '@/data/pages/wooProduct.json';
import storeData from '@/data/wp/store-products.json';

const segment = (path) => path.replace(/^\/|\/$/g, '').split('/').pop();

/** Live commerce fields — price, image, categories — keyed by product slug. */
const STORE = new Map((storeData?.products ?? []).map((p) => [p.slug, p]));

/**
 * Products that must NOT get a page.
 *
 * `pt-141-10mgtest` is a test product left live and indexed on the WordPress
 * site. The client's decision is that the junk URLs 404 rather than redirect,
 * so it is excluded here — where routing reads from — and no route is
 * generated for it in either language. It stays in the harvested data so a
 * re-harvest does not quietly resurrect it as a surprise.
 */
const EXCLUDED = new Set(['pt-141-10mgtest']);

const PAGES = productData.pages
  .filter((page) => !EXCLUDED.has(page.slug))
  .map((page) => ({
    ...page,
    kind: 'blocks',
    group: 'wooProduct',
    store: STORE.get(page.slug) ?? null,
  }));

const BY_EN = new Map(PAGES.map((p) => [segment(p.en), p]));
const BY_ES = new Map(PAGES.filter((p) => p.es).map((p) => [segment(p.es), p]));

export const products = PAGES;

export const byEnglishSlug = (slug) => BY_EN.get(slug) ?? null;
export const bySpanishSlug = (slug) => BY_ES.get(slug) ?? null;

export const englishParams = () => [...BY_EN.keys()].map((slug) => ({ slug }));
export const spanishParams = () => [...BY_ES.keys()].map((slug) => ({ slug }));

/** Products in a category, for the category archives. */
export const inCategory = (categorySlug) =>
  PAGES.filter((p) => (p.store?.categories ?? []).some((c) => c.slug === categorySlug));
