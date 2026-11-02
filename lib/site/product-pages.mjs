// Which compound, and which strength, a live product URL sells.
//
// The live site has two kinds of product page: a lander per compound
// (`/bpc-157-costa-rica/`, mapped in links.mjs) and a WooCommerce page per
// vial (`/product/bpc-157-10mg/`). Both render the same product view; a vial
// page opens with its own strength selected. The vial slugs were typed by
// hand in WordPress, so the compound is found by name and a few aliases
// rather than derived.
//
// Relative imports so the unit tests can load this directly.

import { slugify } from '../storefront/group-products.mjs';

/** Slug prefixes that do not read as the compound's name. */
const ALIASES = {
  reta: 'GLP-1',
  retatrutide: 'GLP-1',
  'bpc-157-tb-500': 'BPC-157 + TB-500',
  'cjc-with-dac': 'CJC-1295 with DAC',
  'cjc-1295-without-dac-ipa': 'CJC-1295 + Ipamorelin',
  'igf-1lr3': 'IGF-1 LR3',
  nad: 'NAD+',
  'fat-blaster': 'Lipotropic Blend',
  'super-human-blend': 'Amino Acid Blend',
};

const SIZE = /(\d[\d,.]*)-?(mg|iu|ml)(?=-|$)/g;

/** `{ prefix, amount, unit }` from a vial slug such as `hcg-10000-iu`. */
export function parseVialSlug(slug) {
  const clean = String(slug || '').replace(/^lp-/, '');
  const matches = [...clean.matchAll(SIZE)];
  const last = matches[matches.length - 1];
  if (!last) return { prefix: clean, amount: null, unit: null };
  return {
    prefix: clean.slice(0, last.index).replace(/-+$/, ''),
    amount: Number(last[1].replace(/,/g, '')),
    unit: last[2],
  };
}

const sizeKey = (amount, unit) => `${amount}${String(unit).toLowerCase()}`;

function sizeOf(variant) {
  const match = String(variant.size || '').match(/^([\d,.]+)\s*(\S+)/);
  return match ? sizeKey(Number(match[1].replace(/,/g, '')), match[2]) : null;
}

/**
 * The compound and strength a `/product/<slug>/` page sells, or null.
 *
 * `size` is null when the slug names no strength (`/product/mt-ii/`), or
 * names one the catalog no longer stocks — the view then opens on the
 * compound's default strength rather than a vial that is not for sale.
 */
export function resolveVialPage(slug, compounds) {
  const { prefix, amount, unit } = parseVialSlug(slug);
  const name = ALIASES[prefix];
  const compound = (compounds || []).find((entry) => (
    name ? entry.name === name : slugify(entry.name) === prefix
  ));
  if (!compound) return null;
  const want = amount != null ? sizeKey(amount, unit) : null;
  const variant = want ? compound.variants.find((entry) => sizeOf(entry) === want) : null;
  return { compound, size: variant?.size || null };
}
