// Where every link in the new design goes.
//
// The prototype links with `#key` routes. Here each key resolves to the live
// site's real path, and the Spanish path comes from data/routes.json through
// `localePath`, so a link is written once, in English, and is right in both
// languages.

import { localePath } from '@/lib/routes';

/** Prototype page keys that already exist on the live site. */
const LIVE_PAGES = {
  home: '/',
  catalog: '/all-peptide-products-costa-rica/',
  shop: '/shop/',
  about: '/about/',
  'our-story': '/our-story/',
  'bulk-discounts': '/bulk-discounts/',
  'lab-tests-coa-results': '/lab-tests-coa-results/',
  'affiliate-program': '/affiliate-program/',
  'faq-costa-rica': '/faq-costa-rica/',
  'contact-costa-rica': '/contact-costa-rica/',
  blog: '/blog/',
  'info-center': '/info-center/',
  'peptide-guides': '/peptide-guides/',
  'customer-feedback': '/customer-feedback/',
  'our-service-locations': '/our-service-locations/',
  'privacy-policy': '/privacy-policy/',
  'shipping-policy': '/shipping-policy/',
  'return-refund-policy': '/return-refund-policy/',
  'html-sitemap': '/html-sitemap/',
};

/**
 * Pages the new design adds. They have no live URL to keep, so their Spanish
 * slugs are chosen here rather than harvested.
 */
export const NEW_PAGES = {
  'our-process': { en: '/our-process/', es: '/es/nuestro-proceso/' },
  'explore-our-app': { en: '/explore-our-app/', es: '/es/explora-nuestra-app/' },
  'for-professionals': { en: '/for-professionals/', es: '/es/para-profesionales/' },
  'deal-of-the-week': { en: '/deal-of-the-week/', es: '/es/oferta-de-la-semana/' },
  'thank-you': { en: '/thank-you/', es: '/es/gracias/' },
};

/** The path for a prototype page key, in `lang`. */
export function pageHref(key, lang = 'en') {
  const added = NEW_PAGES[key];
  if (added) return added[lang === 'es' ? 'es' : 'en'];
  const en = LIVE_PAGES[key];
  if (!en) throw new Error(`unknown page key: ${key}`);
  return localePath(en, lang);
}

/** Any English path, in `lang`. */
export function pathHref(enPath, lang = 'en') {
  return localePath(enPath, lang);
}

/**
 * Compound display name -> the slug of its live lander page
 * (`/bpc-157-costa-rica/`). From the prototype's NET table, which records the
 * live URL of every product page — several are not derivable from the name
 * (GLP-1 lives at /retatrutide-costa-rica/).
 */
export const LANDER_SLUGS = {
  Adamax: 'adamax-costa-rica',
  'AA Water': 'aa-water-costa-rica',
  '5-Amino-1MQ': '5-amino-1mq-costa-rica',
  // Live under their old WordPress names.
  'Amino Acid Blend': 'super-human-blend-costa-rica',
  AICAR: 'aicar-costa-rica',
  'BPC-157': 'bpc-157-costa-rica',
  'BAC Water': 'bac-water-costa-rica',
  'BPC-157 + TB-500': 'bpc-157-tb-500-wolverine-stack',
  'CJC-1295 with DAC': 'cjc-with-dac-costa-rica',
  'CJC-1295 + Ipamorelin': 'cjc-1295-without-dac-ipa-costa-rica',
  Cartalax: 'cartalax-costa-rica',
  DSIP: 'dsip-costa-rica',
  Epithalon: 'epithalon-costa-rica',
  Glutathione: 'glutathione-costa-rica',
  GLOW: 'glow-costa-rica',
  'GHK-Cu': 'ghk-cu-costa-rica',
  'GHRP-6': 'ghrp-6-costa-rica',
  'GLP-1': 'retatrutide-costa-rica',
  HGH: 'hgh-costa-rica',
  HCG: 'hcg-costa-rica',
  HMG: 'hmg-75-iu-costa-rica',
  Ipamorelin: 'ipamorelin-costa-rica',
  'IGF-1 LR3': 'igf-1lr3-costa-rica',
  KLOW: 'klow-costa-rica',
  'Kisspeptin-10': 'kisspeptin-10-costa-rica',
  KPV: 'kpv-costa-rica',
  'MOTS-c': 'mots-c-costa-rica',
  'MT-II': 'mt-ii-costa-rica',
  'NAD+': 'nad-costa-rica',
  'Oxytocin Acetate': 'oxytocin-acetate-costa-rica',
  'PT-141': 'pt-141-costa-rica',
  Pinealon: 'pinealon-costa-rica',
  'SS-31': 'ss-31-costa-rica',
  Semax: 'semax-costa-rica',
  Selank: 'selank-costa-rica',
  Semaglutide: 'semaglutide-costa-rica',
  'SNAP-8': 'snap-8-costa-rica',
  Sermorelin: 'sermorelin-costa-rica',
  'SLU-PP-332': 'slu-pp332-costa-rica',
  Thymalin: 'thymalin-costa-rica',
  'TB-4': 'tb-4-costa-rica',
  'Thymosin Alpha-1': 'thymosin-alpha-1-costa-rica',
  Tirzepatide: 'tirzepatide-costa-rica',
  Tesamorelin: 'tesamorelin-costa-rica',
  VIP: 'vip-5-costa-rica',
  'Lipotropic Blend': 'fat-blaster-costa-rica',
};

/**
 * Compounds the live site sells without a lander page: their only URL is
 * the WooCommerce product page.
 */
const PRODUCT_PAGE_ONLY = {
  'AHK-Cu': '/product/ahk-cu-50mg/',
  'TB-500': '/product/tb-500-10mg/',
};

const SLUG_TO_NAME = new Map(Object.entries(LANDER_SLUGS).map(([name, slug]) => [slug, name]));

/** The compound name a lander slug sells, or null. */
export function compoundForLander(slug) {
  return SLUG_TO_NAME.get(slug) || null;
}

/** Whether the live site already has a page for this compound. */
export function hasLivePage(name) {
  return Boolean(LANDER_SLUGS[name] || PRODUCT_PAGE_ONLY[name]);
}

/**
 * The page of a compound the catalog added after the live site was
 * harvested: `/product/<slug>/` beside the WooCommerce vial pages, and
 * `/es/producto/<slug>/` in Spanish (app/(en)/product/[slug]).
 */
export function newProductPath(slug, lang = 'en') {
  return lang === 'es' ? `/es/producto/${slug}/` : `/product/${slug}/`;
}

/** A compound's product page — its live page, or a new one if it has none yet. */
export function compoundHref(compound, lang = 'en') {
  const slug = LANDER_SLUGS[compound?.name];
  if (slug) return localePath(`/${slug}/`, lang);
  const only = PRODUCT_PAGE_ONLY[compound?.name];
  if (only) return localePath(only, lang);
  if (compound?.slug) return newProductPath(compound.slug, lang);
  return `${pageHref('catalog', lang)}?q=${encodeURIComponent(compound?.name || '')}`;
}

/**
 * The live category pages, with the research-framed name each one shows and
 * the compounds it lists. From the prototype's NCATS table; the URLs are the
 * live site's own and stay for SEO even where the visible name changed.
 */
export const CATEGORIES = [
  { slug: 'peptides-for-weight-loss', name: 'Metabolic & GLP-1 Compounds', icon: 'monitoring', compounds: ['GLP-1', 'Tirzepatide', 'Semaglutide', '5-Amino-1MQ', 'AICAR', 'SLU-PP-332', 'Lipotropic Blend'] },
  { slug: 'peptides-for-muscle-growth', name: 'Growth Hormone Secretagogues', icon: 'trending_up', compounds: ['Tesamorelin', 'Ipamorelin', 'CJC-1295 + Ipamorelin', 'CJC-1295 with DAC', 'Sermorelin', 'GHRP-6'] },
  { slug: 'peptides-for-healing', name: 'Tissue Repair Compounds', icon: 'healing', compounds: ['BPC-157', 'TB-500', 'BPC-157 + TB-500', 'KPV', 'TB-4'] },
  { slug: 'peptides-for-skin', name: 'Copper & Dermatological Peptides', icon: 'spa', compounds: ['GHK-Cu', 'KLOW', 'GLOW', 'AHK-Cu', 'SNAP-8', 'Glutathione', 'MT-II'] },
  { slug: 'copper-peptides', name: 'Copper Peptides', icon: 'deblur', compounds: ['GHK-Cu', 'AHK-Cu', 'GLOW', 'KLOW'] },
  { slug: 'collagen-peptides-costa-rica', name: 'Collagen Peptides', icon: 'grain', compounds: ['GHK-Cu', 'GLOW', 'KLOW', 'SNAP-8'] },
  { slug: 'peptides-for-anti-aging', name: 'Bioregulator Peptides', icon: 'hourglass', compounds: ['Epithalon', 'Thymalin', 'Pinealon', 'Cartalax', 'Thymosin Alpha-1'] },
  { slug: 'peptides-for-energy', name: 'Mitochondrial Compounds', icon: 'bolt', compounds: ['NAD+', 'MOTS-c', 'SS-31', 'Amino Acid Blend'] },
  { slug: 'peptide-for-cognitive-function', name: 'Nootropic & Neuropeptides', icon: 'psychology', compounds: ['Selank', 'Semax', 'Adamax', 'VIP'] },
  { slug: 'peptides-for-sleep', name: 'Sleep-Related Neuropeptides', icon: 'bedtime', compounds: ['DSIP', 'Pinealon'] },
  { slug: 'peptide-for-cardiovascular-costa-rica', name: 'Cardiovascular Research Compounds', icon: 'ecg_heart', compounds: ['SS-31', 'MOTS-c', 'VIP'] },
  { slug: 'peptides-for-fertility', name: 'Reproductive Signalling Peptides', icon: 'genetics', compounds: ['PT-141', 'Kisspeptin-10', 'HCG', 'HMG', 'Oxytocin Acetate'] },
  { slug: 'hgh-human-growth-hormone', name: 'Somatropin & Related Compounds', icon: 'biotech', compounds: ['HGH', 'IGF-1 LR3'] },
  { slug: 'peptides-for-bac-water', name: 'Bacteriostatic Water', icon: 'water_drop', compounds: ['BAC Water', 'AA Water'] },
];

export function categoryHref(category, lang = 'en') {
  return localePath(`/${category.slug}/`, lang);
}

export function categoryBySlug(slug) {
  return CATEGORIES.find((category) => category.slug === slug) || null;
}

/** The compounds a category lists, in its order, from the live catalog. */
export function categoryCompounds(category, compounds) {
  return category.compounds
    .map((name) => compounds.find((compound) => compound.name === name))
    .filter(Boolean);
}

export const CONTACT = {
  whatsapp: '50684046973',
  phoneCr: '+506 8404-6973',
  phoneCrHref: 'tel:+50684046973',
  phoneUs: '+1 (831) 471-5559',
  phoneUsHref: 'tel:+18314715559',
  email: 'info@peptidescostarica.net',
};

/** The mobile app, with the tracking parameters the owner gave (PROJECT_CONTEXT.md). */
export function appUrl(lang = 'en') {
  return `https://app.peptidescostarica.net/?utm_source=catalog_nav&utm_medium=web&utm_campaign=app_launch&lang=${lang === 'es' ? 'es' : 'en'}`;
}

export const SOCIALS = [
  ['Facebook', 'https://www.facebook.com/people/Peptides-CR/61595088776299/'],
  ['Instagram', 'https://www.instagram.com/researchpeptidescr'],
  ['LinkedIn', 'https://www.linkedin.com/company/peptides-costa-rica/'],
  ['X', 'https://x.com/Peptides_CR'],
  ['Pinterest', 'https://www.pinterest.com/peptidescr/'],
  ['Bluesky', 'https://bsky.app/profile/peptidescostarica.bsky.social'],
];

export const REVIEW_LINKS = {
  google: 'https://maps.app.goo.gl/MN4ozARktFp51Hkc6',
  facebook: 'https://www.facebook.com/people/Peptides-CR/61595088776299/',
  trustpilot: 'https://www.trustpilot.com/review/peptidescostarica.net',
  shopperApproved: 'https://www.shopperapproved.com/reviews/peptidescostarica.net',
};
