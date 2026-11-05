import { catalogCompoundAndSize, isMetabolicCategory } from './catalogCategories.mjs';

export const UPSELL_PRIORITY = Object.freeze([
  { compound: 'nad+', size: '1000mg' },
  { compound: 'epithalon' },
  { compound: 'ss-31' },
  { compound: 'mots-c' },
  { compound: 'pinealon' },
  { compound: 'selank' },
]);

function normalized(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function compoundKey(product) {
  return normalized(catalogCompoundAndSize(product).compound);
}

function sizeKey(product) {
  return normalized(catalogCompoundAndSize(product).size);
}

function categoryKey(category) {
  // All old/new GLP-1 labels are one category for exclusion purposes.
  return isMetabolicCategory(category) ? 'metabolic-glp-1' : normalized(category);
}

function isInStock(product) {
  if (Number(product?.inventoryCount) === 0) return false;
  const status = String(product?.status ?? '').trim().toLowerCase();
  return status === 'in stock' || status === 'disponible';
}

function isBacWater(product) {
  const text = `${product?.product ?? ''} ${product?.category ?? ''}`.toLowerCase();
  return /\bbac(?:teriostatic)?\s*water\b/.test(text)
    || text.includes('bacteriostatic water');
}

function preferredVariant(rows, priorityRule) {
  if (priorityRule.size) {
    const requested = rows.find((row) => sizeKey(row) === normalized(priorityRule.size));
    if (requested) return requested;
  }
  return rows.find((row) => row.isDefaultSize === true) || rows[0];
}

/**
 * Cart cross-sells, ranked by a short and deliberately predictable rule set.
 *
 * `products` must be in best-seller order. The storefront already loads the
 * catalog in its owner-managed priority order, so that order is the fallback
 * after the six explicitly promoted compounds.
 */
export function buildUpsellRecommendations({
  cart = [],
  products = [],
  limit = 3,
  isListable = () => true,
} = {}) {
  if (!cart.length || !products.length || limit <= 0) return [];

  const cartCompounds = new Set(cart.map(compoundKey));
  const cartCategories = new Set(cart.map((item) => categoryKey(item?.category)).filter(Boolean));

  const eligible = products.filter((product) => {
    const compound = compoundKey(product);
    if (!compound || cartCompounds.has(compound)) return false;
    if (cartCategories.has(categoryKey(product?.category))) return false;
    return isListable(product) && isInStock(product) && !isBacWater(product);
  });

  // A compound can have several vial sizes, but an upsell should show one card,
  // not spend multiple slots on variants of the same product.
  const byCompound = new Map();
  for (const product of eligible) {
    const key = compoundKey(product);
    if (!byCompound.has(key)) byCompound.set(key, []);
    byCompound.get(key).push(product);
  }

  const selected = [];
  const selectedCompounds = new Set();
  for (const rule of UPSELL_PRIORITY) {
    const rows = byCompound.get(rule.compound);
    if (!rows?.length) continue;
    selected.push(preferredVariant(rows, rule));
    selectedCompounds.add(rule.compound);
    if (selected.length === limit) return selected;
  }

  // Remaining rows retain the catalog's best-seller/priority order.
  for (const product of eligible) {
    const key = compoundKey(product);
    if (selectedCompounds.has(key)) continue;
    selected.push(preferredVariant(byCompound.get(key), {}));
    selectedCompounds.add(key);
    if (selected.length === limit) break;
  }

  return selected;
}
