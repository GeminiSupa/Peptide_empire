// Navigation structure mirroring the live site's menus.
// Paths are deliberately identical to the WordPress site — see
// docs/url-inventory.md. Changing any path here breaks that page's SEO.

export const CATEGORIES = [
  { slug: '/peptides-for-weight-loss/', en: 'Peptides For Weight Loss', es: 'Péptidos Para Pérdida De Peso' },
  { slug: '/peptides-for-muscle-growth/', en: 'Peptides For Muscle Growth', es: 'Péptidos Para Crecimiento Muscular' },
  { slug: '/peptides-for-anti-aging/', en: 'Peptides For Anti Aging', es: 'Péptidos Para Antienvejecimiento' },
  { slug: '/peptides-for-healing/', en: 'Peptides For Healing', es: 'Péptidos Para Sanación' },
  { slug: '/peptides-for-energy/', en: 'Peptides For Energy', es: 'Péptidos Para Energía' },
  { slug: '/peptides-for-fertility/', en: 'Peptides For Fertility', es: 'Péptidos Para Fertilidad' },
  { slug: '/peptides-for-skin/', en: 'Peptides For Skin', es: 'Péptidos Para La Piel' },
  { slug: '/peptides-for-sleep/', en: 'Peptides For Sleep', es: 'Péptidos Para Dormir' },
  { slug: '/copper-peptides/', en: 'Copper Peptides', es: 'Péptidos De Cobre' },
  { slug: '/collagen-peptides-costa-rica/', en: 'Collagen Peptides', es: 'Péptidos De Colágeno' },
  { slug: '/peptides-for-bac-water/', en: 'BAC Water', es: 'Agua BAC' },
  { slug: '/hgh-human-growth-hormone/', en: 'HGH (Human Growth Hormone)', es: 'HGH (Hormona Del Crecimiento)' },
  // Note the SINGULAR "peptide" in these two slugs — matches the live site.
  { slug: '/peptide-for-cognitive-function/', en: 'Peptides For Cognitive Function', es: 'Péptidos Para Función Cognitiva' },
  { slug: '/peptide-for-cardiovascular-costa-rica/', en: 'Peptides For Cardiovascular', es: 'Péptidos Para Cardiovascular' },
];

const ABOUT_CHILDREN = [
  { href: '/our-story/', en: 'Our Story', es: 'Nuestra Historia' },
  { href: '/bulk-discounts/', en: 'Bulk Discounts', es: 'Descuentos Por Volumen' },
  { href: '/lab-tests-coa-results/', en: 'COA Database', es: 'Base De Datos COA' },
  { href: '/affiliate-program/', en: 'Affiliate Program', es: 'Programa De Afiliados' },
  { href: '/faq-costa-rica/', en: 'FAQ', es: 'Preguntas Frecuentes' },
  { href: '/blog/', en: 'Blog', es: 'Blog' },
];

export const MAIN_NAV = [
  { href: '/about/', en: 'ABOUT', es: 'ACERCA DE', children: ABOUT_CHILDREN },
  {
    href: '/all-peptide-products-costa-rica/',
    en: 'SHOP BY PRODUCT',
    es: 'COMPRAR POR PRODUCTO',
  },
  {
    href: null,
    en: 'SHOP BY CATEGORY',
    es: 'COMPRAR POR CATEGORÍA',
    children: CATEGORIES.map((c) => ({ href: c.slug, en: c.en, es: c.es })),
  },
  { href: '/info-center/', en: 'INFO CENTER', es: 'CENTRO DE INFORMACIÓN' },
];

export const FOOTER_QUICK_LINKS = [
  { href: '/', en: 'Home', es: 'Inicio' },
  { href: '/about/', en: 'About us', es: 'Acerca De Nosotros' },
  { href: '/bulk-discounts/', en: 'Bulk Discounts', es: 'Descuentos Por Volumen' },
  { href: '/faq-costa-rica/', en: 'FAQ', es: 'Preguntas Frecuentes' },
  { href: '/our-service-locations/', en: 'Our Service Locations', es: 'Zonas De Servicio' },
  { href: '/contact-costa-rica/', en: 'Contact Us', es: 'Contáctenos' },
  { href: '/shipping-policy/', en: 'Shipping Policy', es: 'Política De Envío' },
  { href: '/return-refund-policy/', en: 'Returns/Refunds', es: 'Devoluciones/Reembolsos' },
  { href: '/customer-feedback/', en: 'Customer Feedback', es: 'Opiniones De Clientes' },
  { href: '/affiliate-program/', en: 'Affiliate Program', es: 'Programa De Afiliados' },
  { href: '/privacy-policy/', en: 'Privacy Policy', es: 'Política De Privacidad' },
  { href: '/html-sitemap/', en: 'HTML Sitemap', es: 'Mapa Del Sitio' },
  { href: '/blog/', en: 'Blog', es: 'Blog' },
  { href: '/peptide-guides/', en: 'How-to-Use Guides', es: 'Guías De Uso' },
];

export const FOOTER_CATEGORIES = [
  CATEGORIES[0],
  CATEGORIES[1],
  CATEGORIES[2],
  CATEGORIES[3],
];

/** Pick the label for a language, falling back to English. */
export function label(item, lang) {
  return item[lang] || item.en;
}
