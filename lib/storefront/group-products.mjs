// Grouping the catalog's vial rows into the compounds the storefront sells.
//
// Relative imports, not `@/`: the alias only resolves inside the Next bundler,
// and the unit tests have to be able to load this directly — the same reason
// the catalog keeps its own pricing module import-clean.

import { getUnitPrice, parsePrice } from '../catalog-pricing/pricing.mjs';
import { isSellableBacWater, isBacWater } from '../catalog-pricing/bacWater.mjs';
import { shelfFor } from './shelves.mjs';
import { salePrice } from './sale-price.mjs';

/**
 * The catalog's `products` table stores one row per sellable vial — "GLP-1
 * (RT) – Agonista Triple 20mg" is a row, and so are its nine siblings. The
 * storefront sells compounds with a size picker, so the rows are grouped here
 * into one entry per compound with a variant per size.
 *
 * ── The one field that must not be touched ─────────────────────────────────
 *
 * Every variant carries `product`: the row's exact `products.product` string.
 * That string is what /api/orders/create looks the price up by. A tidied,
 * title-cased or re-spaced copy of it is a product checkout cannot find, and
 * an order it cannot price is an order it refuses. Display names are derived
 * separately and are never sent.
 */

/**
 * The compounds that carry a "Best seller" badge.
 *
 * There is no best-seller column on `products`, and `priority` is not one:
 * it is the admin's display order, which currently ranks Semaglutide and
 * Tesamorelin above GHK-Cu and KLOW. These four are the picks from the
 * supplied design, and the same three lead its weekly-deal card. When the
 * catalog grows a real flag, read it instead of this list.
 */
export const BEST_SELLER_SLUGS = ['glp-1', 'ghk-cu', 'tirzepatide', 'klow'];

/**
 * Display names for rows whose stored name is not what a shopper should read.
 *
 * The stored strings are the catalog's and stay exactly as they are — they are
 * what the admin, the courier label and checkout all key on. These are only
 * the labels drawn on the page.
 */
export const DISPLAY_NAMES = {
  'GLP-1 (RT) – Agonista Triple': 'GLP-1',
  'BPC-157 + TB-500 (Wolverine Stack)': 'BPC-157 + TB-500',
  'CJC-1295 without DAC + Ipamorelin': 'CJC-1295 + Ipamorelin',
  'GHK-CU': 'GHK-Cu',
  'AHK-CU': 'AHK-Cu',
  'MOTS-C': 'MOTS-c',
  'KissPeptin-10': 'Kisspeptin-10',
};

/** A `+` becomes `plus` so two compounds in one vial get a readable slug. */
export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A vial size as it should read. The column is hand-typed and inconsistent —
 * "50IU", "30 IU", "5 mg" and "5mg" are all in there today — so the number and
 * the unit are split apart and rejoined with one space.
 */
export function formatSize(vialSize) {
  const raw = String(vialSize || '').trim();
  if (!raw) return '';
  const match = raw.match(/^([\d.,]+)\s*(.*)$/);
  if (!match) return raw;
  const [, amount, unit] = match;
  if (!unit) return amount;
  return `${amount} ${unit.toLowerCase() === 'iu' ? 'IU' : unit.toLowerCase()}`;
}

/** The compound name, i.e. the row name with its size taken off the end. */
export function compoundName(product, vialSize) {
  const name = String(product || '').trim();
  if (!vialSize) return name;
  const size = String(vialSize).trim();
  const at = name.toLowerCase().lastIndexOf(size.toLowerCase());
  if (at === -1) return name;
  const stripped = `${name.slice(0, at)}${name.slice(at + size.length)}`.replace(/\s+/g, ' ').trim();
  // Some rows carry the size typed into the name several times over
  // ("… USA Manufactured 60 60 60 60 60 60 60 60 60", size "60"). The name
  // drawn on the page drops the repeats; the stored string is untouched.
  const amount = size.match(/^[\d.,]+/)?.[0];
  if (!amount) return stripped;
  const repeats = new RegExp(`(\\s+${amount.replace(/[.,]/g, '\\$&')})+$`);
  return stripped.replace(repeats, '').trim();
}

/** The catalog's own in-stock rule: the status string says so. */
export function inStock(row) {
  return String(row.status || '').toLowerCase().includes('in stock');
}

/** A liquid ships ready to use; a powder needs reconstituting. */
function isLiquid(vialSize) {
  return /ml\b/i.test(String(vialSize || ''));
}

/**
 * Group product rows into compounds.
 *
 * @param {Array<object>} rows   `products` rows
 * @param {number} exchangeRate  USD -> CRC, for the colón prices
 */
export function groupRows(rows, exchangeRate) {
  const byCompound = new Map();

  for (const row of rows || []) {
    // A 2ml BAC row still exists in the table and must not be sellable. The
    // rule lives in the catalog's own module so this site cannot sell
    // something the catalog has withdrawn.
    if (isBacWater(row.product) && !isSellableBacWater(row.product)) continue;
    // A row with no parseable price is a draft, not a product. Showing it
    // would put a ₡0 card on the shelf and send checkout a line it refuses.
    if (!parsePrice(row.price_usd)) continue;

    const stored = compoundName(row.product, row.vial_size);
    const name = DISPLAY_NAMES[stored] || stored;
    const slug = slugify(name);
    if (!slug) continue;

    if (!byCompound.has(slug)) {
      byCompound.set(slug, {
        slug,
        name,
        storedName: stored,
        category: row.category || '',
        shelf: shelfFor(slug, row.category),
        priority: Number(row.priority ?? 9999),
        liquid: isLiquid(row.vial_size),
        image: row.image_url || '',
        coa: row.coa || '',
        descriptionEn: row.description_en || '',
        descriptionEs: row.description_es || '',
        variants: [],
      });
    }

    const compound = byCompound.get(slug);
    // The lowest-priority row in the group decides where the compound ranks.
    compound.priority = Math.min(compound.priority, Number(row.priority ?? 9999));
    if (!compound.image && row.image_url) compound.image = row.image_url;
    if (!compound.coa && row.coa) compound.coa = row.coa;
    if (!compound.descriptionEn && row.description_en) compound.descriptionEn = row.description_en;
    if (!compound.descriptionEs && row.description_es) compound.descriptionEs = row.description_es;

    compound.variants.push({
      // Never altered: this is what checkout prices by.
      product: row.product,
      id: row.id,
      // Empty when the row carries no size at all (one row does today:
      // "CJC-1295 without DAC + Ipamorelin"). The size picker hides itself
      // rather than drawing a chip labelled with the whole product name.
      size: formatSize(row.vial_size),
      rawSize: row.vial_size || '',
      priceUsd: getUnitPrice(row, 'USD'),
      priceCrc: getUnitPrice(row, 'CRC', exchangeRate),
      // The admin's sale: the price before it, struck through beside the
      // price above (which is what checkout charges). Null when no sale runs.
      ...(() => {
        const wasUsd = salePrice(row);
        return { wasUsd, wasCrc: wasUsd ? Math.round(wasUsd * exchangeRate) : null };
      })(),
      inStock: inStock(row),
      stock: row.inventory_count === null || row.inventory_count === undefined
        ? null
        : Number(row.inventory_count),
      isDefault: row.is_default_size === true,
      image: row.image_url || '',
      discount: row.discount || '',
      freeBacWater: row.free_bac_water,
      freeBacSizeMl: row.free_bac_size_ml,
      freeBacVialsPerItem: row.free_bac_vials_per_item,
    });
  }

  const compounds = [...byCompound.values()];

  for (const compound of compounds) {
    // Cheapest first, which is also smallest first for every compound in the
    // table — sorting on the price avoids parsing "10000 IU" against "5 mg".
    compound.variants.sort((a, b) => a.priceUsd - b.priceUsd);
    const marked = compound.variants.find((variant) => variant.isDefault);
    const available = compound.variants.find((variant) => variant.inStock);
    compound.defaultSize = (marked || available || compound.variants[0]).size;
    compound.fromPriceUsd = Math.min(...compound.variants.map((variant) => variant.priceUsd));
    compound.inStock = compound.variants.some((variant) => variant.inStock);
  }

  compounds.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  for (const compound of compounds) {
    compound.best = BEST_SELLER_SLUGS.includes(compound.slug);
  }

  return compounds;
}

/** One variant of a compound, by its displayed size. Falls back to the default. */
export function variantFor(compound, size) {
  if (!compound) return null;
  return compound.variants.find((variant) => variant.size === size)
    || compound.variants.find((variant) => variant.size === compound.defaultSize)
    || compound.variants[0]
    || null;
}
