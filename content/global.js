/**
 * Site-wide chrome: announcement bar, header nav, footer.
 *
 * The values come from data/global.json, harvested from the live site in BOTH
 * languages by scripts/harvest-global.mjs. Nothing here is typed by hand —
 * earlier hand-written Spanish in lib/nav.js and lib/site.js turned out not to
 * match the live site and has been dropped.
 *
 * This module is the seam where the future CMS plugs in: today it reads a JSON
 * file, later it reads the `site_cms_settings` table. Components import from
 * here and never from data/ directly, so that swap touches one file.
 */
import globalData from '@/data/global.json';

export const announcement = globalData.announcement;
export const headerContact = globalData.headerContact;
export const nav = globalData.nav;
export const footer = globalData.footer;
export const harvestedAt = globalData.harvestedAt;

/**
 * Interface labels — the only strings the site writes itself.
 *
 * Everything else on the site is harvested page content. These are the words
 * around it: button labels, empty states, the note next to a price. They live
 * here rather than inside components so that no copy is trapped in JSX, and so
 * they become editable rows alongside page content when the CMS lands.
 *
 * Read with `t(ui, 'key', lang)` exactly like harvested content.
 */
export const ui = {
  viewInCatalog_en: 'View in catalog',
  viewInCatalog_es: 'Ver en el catálogo',
  buyOnCatalog_en: 'Buy on our catalog',
  buyOnCatalog_es: 'Comprar en nuestro catálogo',
  priceShownIn_en: 'Price shown in',
  priceShownIn_es: 'Precio mostrado en',
  downloadPdf_en: 'Download PDF',
  downloadPdf_es: 'Descargar PDF',
  noProducts_en: 'No products are currently listed in this category.',
  noProducts_es: 'Actualmente no hay productos en esta categoría.',
  searchPlaceholder_en: 'Search Peptide Products Or Information',
  searchPlaceholder_es: 'Buscar productos peptídicos o información',
  cart_en: 'Cart',
  cart_es: 'Carrito',
  // Build scaffolding, not site copy — see the transformation section.
  pendingImage_en: 'Before / after image (pending)',
  pendingImage_es: 'Imagen antes / después (pendiente)',
};

/**
 * Contact details used outside the harvested chrome (buy buttons, WhatsApp).
 * Verified against the live site's footer on 2026-07-27.
 */
export const CONTACT = {
  crPhoneHref: 'tel:+50684046973',
  usPhoneHref: 'tel:+18314715559',
  email: 'info@peptidescostarica.net',
  emailHref: 'mailto:info@peptidescostarica.net',
  whatsappHref: 'https://wa.me/50684046973',
};

/**
 * The catalog site owns the cart, checkout and orders. This project is
 * marketing only: every buy button links out to it. Never add checkout here.
 */
const CATALOG_BASE = 'https://catalog.peptidescostarica.net/catalog';

export function catalogUrl(lang = 'es') {
  return `${CATALOG_BASE}?lang=${lang === 'en' ? 'en' : 'es'}`;
}
