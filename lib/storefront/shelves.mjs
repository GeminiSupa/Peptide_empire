/**
 * The nine shelves the storefront browses by, and how the catalog's own
 * sixteen categories land on them.
 *
 * The catalog's `products.category` is the source of truth for what a compound
 * IS — it drives the admin, the bot and the order record. It is not a
 * navigation scheme: it has sixteen values, four of which hold a single
 * product, so browsing by it gives shelves of one. These nine are the
 * browsing scheme, and nothing but navigation reads them.
 *
 * Keeping both means a compound can be shelved where a shopper looks for it
 * without touching the category the rest of the business runs on.
 */

export const SHELVES = [
  { id: 'metabolic', en: 'Metabolic & GLP-1', es: 'Metabólicos y GLP-1' },
  { id: 'repair', en: 'Tissue repair', es: 'Reparación de tejidos' },
  { id: 'gh', en: 'GH secretagogues', es: 'Secretagogos de GH' },
  { id: 'derm', en: 'Copper & dermatological', es: 'Cobre y dermatológicos' },
  { id: 'mito', en: 'Mitochondrial', es: 'Mitocondriales' },
  { id: 'neuro', en: 'Nootropic & neuropeptides', es: 'Nootrópicos y neuropéptidos' },
  { id: 'bio', en: 'Bioregulators', es: 'Bioreguladores' },
  { id: 'repro', en: 'Reproductive signalling', es: 'Señalización reproductiva' },
  { id: 'supplies', en: 'Lab supplies', es: 'Insumos de laboratorio' },
];

export const SHELF_IDS = SHELVES.map((shelf) => shelf.id);

/**
 * Catalog category -> shelf. Every category live in the products table on
 * 23 Oct 2026 is listed; an unrecognised one falls through to `metabolic`
 * only after being reported by `shelfFor`, so a new category shows up as a
 * build-log line rather than as a silently miscategorised product.
 */
const SHELF_BY_CATEGORY = {
  'Metabolic & GLP-1 Compounds': 'metabolic',
  'Tissue Repair Compounds': 'repair',
  'Anti-Inflammatory': 'repair',
  'Growth Hormone Secretagogues': 'gh',
  'Somatropin & Related Compounds': 'gh',
  'Copper & Dermatological Peptides': 'derm',
  'Skin & Anti-Aging': 'derm',
  'Collagen Peptides': 'derm',
  'Mitochondrial Compounds': 'mito',
  'Nootropic & Neuropeptides': 'neuro',
  'Sleep-Related Neuropeptides': 'neuro',
  'Bioregulator Peptides': 'bio',
  'Immune System Modulation': 'bio',
  'Reproductive Signalling Peptides': 'repro',
  'Bacteriostatic Water': 'supplies',
  // Holds two compounds the designer shelved apart from each other, so this
  // category alone cannot decide; see SHELF_BY_SLUG.
  'Immune & Antioxidant': 'bio',
};

/**
 * Compounds the design shelves somewhere other than their category implies.
 * Each of these is a deliberate choice from the supplied design, not a guess:
 *
 *   glutathione   Immune & Antioxidant -> derm, sold as a skin compound
 *   vip           Immune & Antioxidant -> neuro, a neuropeptide
 *   slu-pp-332    Mitochondrial        -> metabolic, sold for metabolic work
 *   amino-acid-blend Metabolic         -> mito, shelved with the blends
 */
const SHELF_BY_SLUG = {
  glutathione: 'derm',
  vip: 'neuro',
  'slu-pp-332': 'metabolic',
  'amino-acid-blend': 'mito',
};

const reportedCategories = new Set();

/** The shelf a compound browses under. */
export function shelfFor(slug, category) {
  const bySlug = SHELF_BY_SLUG[slug];
  if (bySlug) return bySlug;

  const byCategory = SHELF_BY_CATEGORY[category];
  if (byCategory) return byCategory;

  if (category && !reportedCategories.has(category)) {
    reportedCategories.add(category);
    console.warn(
      `[storefront] product category ${JSON.stringify(category)} has no shelf; `
      + 'showing it under Metabolic & GLP-1. Add it to SHELF_BY_CATEGORY.',
    );
  }
  return 'metabolic';
}

/** Shelf label in the reader's language. */
export function shelfLabel(id, lang = 'en') {
  const shelf = SHELVES.find((entry) => entry.id === id);
  if (!shelf) return '';
  return lang === 'es' ? shelf.es : shelf.en;
}
