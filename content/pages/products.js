/**
 * The WooCommerce product pages.
 *
 * Kept out of content/pages/registry.js on purpose. That registry serves the
 * single-segment root namespace and keys pages by their last path segment;
 * products live under their own prefix — `/product/<slug>/` in English and
 * `/es/producto-2/<slug>/` in Spanish — so keying them the same way would let a
 * product collide with a city or guide of the same name.
 *
 * The `-2` in `producto-2` is a permanent WordPress slug collision that is now
 * indexed SEO. It is reproduced exactly; see docs/url-inventory.md.
 *
 * This project sells nothing. Product pages display price and specification and
 * send every buy action to the catalog site, which owns the cart and orders.
 */
import productData from '@/data/pages/wooProduct.json';
import storeData from '@/data/wp/store-products.json';

const segment = (path) => path.replace(/^\/|\/$/g, '').split('/').pop();

/** Live commerce fields — price, image, categories — keyed by product slug. */
const STORE = new Map((storeData?.products ?? []).map((p) => [p.slug, p]));

const PAGES = productData.pages.map((page) => ({
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
