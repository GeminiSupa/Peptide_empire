/**
 * WooCommerce category archives — listing pages at `/product-category/<slug>/`
 * and `/es/categoria-de-producto/<slug>/`.
 *
 * As with products, these are kept out of the single-segment registry because
 * they live under their own prefix and would otherwise collide with a root-level
 * page of the same slug. WordPress now uses `/es/categoria-de-producto/` as the
 * canonical Spanish base; the former base redirects in next.config.
 *
 * The product list is resolved at render time from the store harvest rather than
 * frozen in, so re-running scripts/harvest-store.mjs is enough to pick up a
 * product moving between categories.
 */
import categoryData from '@/data/pages/wooCategory.json';
import { inCategory } from '@/content/pages/products';

const segment = (path) => path.replace(/^\/|\/$/g, '').split('/').pop();

const BY_SLUG = new Map(categoryData.pages.map((p) => [p.slug, p]));
const BY_ES = new Map(categoryData.pages.filter((p) => p.es).map((p) => [segment(p.es), p]));

export const categories = categoryData.pages;

export const byEnglishSlug = (slug) => BY_SLUG.get(slug) ?? null;
export const bySpanishSlug = (slug) => BY_ES.get(slug) ?? null;

export const englishParams = () => [...BY_SLUG.keys()].map((slug) => ({ slug }));
export const spanishParams = () => [...BY_ES.keys()].map((slug) => ({ slug }));

/** Renderable archive body; the product list stays live to the store snapshot. */
export const sectionsFor = (page) => [
  {
    type: 'category_header',
    content: {
      heading_en: page.heading_en,
      heading_es: page.heading_es,
      intro_en:
        page.intro_en ||
        `Browse ${page.heading_en.toLowerCase()} available from Peptides Costa Rica. Compare research compounds, product formats, current specifications, pricing, and local ordering information for delivery within Costa Rica.`,
      intro_es:
        page.intro_es ||
        `Explore ${page.heading_es.toLowerCase()} disponibles en Péptidos Costa Rica. Compare compuestos de investigación, formatos, especificaciones, precios e información de pedidos locales con entrega dentro de Costa Rica.`,
    },
  },
  { type: 'product_grid_dynamic', content: { categorySlug: page.slug } },
];

/** The products this archive lists, in name order. */
export const productsFor = (slug) =>
  inCategory(slug).sort((a, b) => (a.store?.name ?? '').localeCompare(b.store?.name ?? ''));
