/**
 * WooCommerce category archives — listing pages at `/product-category/<slug>/`
 * and `/es/categoria-producto-2/<slug>/`.
 *
 * As with products, these are kept out of the single-segment registry because
 * they live under their own prefix and would otherwise collide with a root-level
 * page of the same slug. The `-2` in `categoria-producto-2` is permanent indexed
 * SEO; see docs/url-inventory.md.
 *
 * The product list is resolved at render time from the store harvest rather than
 * frozen in, so re-running scripts/harvest-store.mjs is enough to pick up a
 * product moving between categories.
 */
import categoryData from '@/data/pages/wooCategory.json';
import { inCategory } from '@/content/pages/products';

const BY_SLUG = new Map(categoryData.pages.map((p) => [p.slug, p]));
const BY_ES = new Map(
  categoryData.pages
    .filter((p) => p.es)
    .map((p) => [p.es.replace(/^\/es\/categoria-producto-2\//, '').replace(/\/$/, ''), p]),
);

export const categories = categoryData.pages;

export const byEnglishSlug = (slug) => BY_SLUG.get(slug) ?? null;
export const bySpanishSlug = (slug) => BY_ES.get(slug) ?? null;

export const englishParams = () => [...BY_SLUG.keys()].map((slug) => ({ slug }));
export const spanishParams = () => [...BY_ES.keys()].map((slug) => ({ slug }));

/** The products this archive lists, in name order. */
export const productsFor = (slug) =>
  inCategory(slug).sort((a, b) => (a.store?.name ?? '').localeCompare(b.store?.name ?? ''));
