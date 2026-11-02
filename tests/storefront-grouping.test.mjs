import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compoundName,
  formatSize,
  groupRows,
  slugify,
} from '../lib/storefront/group-products.mjs';

const RATE = 454.48;

/** A products row, with the columns the feed reads. */
function row(overrides = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    product: 'BPC-157 10mg',
    category: 'Tissue Repair Compounds',
    price_usd: '$90',
    status: 'In Stock',
    coa: '',
    image_url: 'https://example.test/vial.png',
    priority: 10,
    inventory_count: 25,
    vial_size: '10mg',
    is_default_size: false,
    description_en: '',
    description_es: '',
    ...overrides,
  };
}

test('one compound per name, one variant per size, cheapest first', () => {
  const [compound] = groupRows([
    row({ product: 'NAD+ 1000mg', vial_size: '1000mg', price_usd: '$149' }),
    row({ product: 'NAD+ 500mg', vial_size: '500mg', price_usd: '$114' }),
  ], RATE);

  assert.equal(compound.name, 'NAD+');
  assert.equal(compound.slug, 'nad-plus');
  assert.deepEqual(compound.variants.map((v) => v.size), ['500 mg', '1000 mg']);
  assert.equal(compound.fromPriceUsd, 114);
});

test('the stored product string is passed through untouched', () => {
  // This is the string /api/orders/create prices by. A tidied copy of it is a
  // product checkout cannot find, so an order carrying one is refused.
  const stored = 'GLP-1 (RT) – Agonista Triple 20mg';
  const [compound] = groupRows([row({
    product: stored, vial_size: '20mg', category: 'Metabolic & GLP-1 Compounds',
  })], RATE);

  assert.equal(compound.variants[0].product, stored);
  // ...while what the shopper reads is the tidy name.
  assert.equal(compound.name, 'GLP-1');
});

test('colón prices come from the dollar price at the given rate', () => {
  const [compound] = groupRows([row({ price_usd: '$150' })], RATE);
  assert.equal(compound.variants[0].priceUsd, 150);
  assert.equal(compound.variants[0].priceCrc, Math.round(150 * RATE));
});

test('the withdrawn 2ml BAC row cannot be sold, the 3ml and 10ml can', () => {
  const compounds = groupRows([
    row({ product: 'BAC Water 2ml', vial_size: '2ml', category: 'Bacteriostatic Water', price_usd: '$8' }),
    row({ product: 'BAC Water 3ml', vial_size: '3ml', category: 'Bacteriostatic Water', price_usd: '$10' }),
    row({ product: 'BAC Water 10ml', vial_size: '10ml', category: 'Bacteriostatic Water', price_usd: '$20' }),
  ], RATE);

  const [water] = compounds;
  assert.deepEqual(water.variants.map((v) => v.size), ['3 ml', '10 ml']);
  assert.equal(water.shelf, 'supplies');
  assert.equal(water.liquid, true);
});

test('a row with no parseable price is not put on the shelf', () => {
  // A ₡0 card with a working Add button is worse than no card.
  assert.deepEqual(groupRows([row({ price_usd: '' })], RATE), []);
  assert.deepEqual(groupRows([row({ price_usd: '$0' })], RATE), []);
});

test('hand-typed sizes are normalised, and a sizeless row gets no chip', () => {
  assert.equal(formatSize('50IU'), '50 IU');
  assert.equal(formatSize('30 IU'), '30 IU');
  assert.equal(formatSize('5 mg'), '5 mg');
  assert.equal(formatSize('5mg'), '5 mg');
  assert.equal(formatSize('10000 IU'), '10000 IU');
  assert.equal(formatSize(''), '');

  // One row in the table carries no size at all; the picker hides itself
  // rather than drawing a chip labelled with the whole product name.
  const [compound] = groupRows([row({
    product: 'CJC-1295 without DAC + Ipamorelin',
    vial_size: null,
    category: 'Growth Hormone Secretagogues',
  })], RATE);
  assert.equal(compound.variants[0].size, '');
  assert.equal(compound.name, 'CJC-1295 + Ipamorelin');
});

test('availability follows the status string, not the stock count', () => {
  const [compound] = groupRows([
    row({ product: 'DSIP 5mg', vial_size: '5mg', status: 'In Stock', price_usd: '$100' }),
    row({ product: 'DSIP 10mg', vial_size: '10mg', status: 'Out of Stock', price_usd: '$115' }),
  ], RATE);

  assert.equal(compound.inStock, true);
  assert.equal(compound.variants.find((v) => v.size === '10 mg').inStock, false);
  // The default strength is one that can actually be bought.
  assert.equal(compound.defaultSize, '5 mg');
});

test('an explicitly marked default size wins over availability', () => {
  const [compound] = groupRows([
    row({ product: 'HGH 12 IU', vial_size: '12 IU', price_usd: '$70' }),
    row({ product: 'HGH 30 IU', vial_size: '30 IU', price_usd: '$124', is_default_size: true }),
  ], RATE);
  assert.equal(compound.defaultSize, '30 IU');
});

test('best sellers are the designer\'s picks, not the admin display order', () => {
  const compounds = groupRows([
    row({ product: 'Semaglutide 10mg', vial_size: '10mg', category: 'Metabolic & GLP-1 Compounds', priority: 1, price_usd: '$218' }),
    row({ product: 'GHK-CU 50mg', vial_size: '50mg', category: 'Copper & Dermatological Peptides', priority: 90, price_usd: '$70' }),
  ], RATE);

  const bySlug = Object.fromEntries(compounds.map((c) => [c.slug, c]));
  assert.equal(bySlug['ghk-cu'].best, true, 'GHK-Cu is a pick despite ranking last');
  assert.equal(bySlug.semaglutide.best, false, 'priority 1 does not make a best seller');
});

test('compounds are shelved for browsing, keeping the catalog category', () => {
  const compounds = groupRows([
    // Two compounds share one category but the design shelves them apart.
    row({ product: 'Glutathione 1500mg', vial_size: '1500mg', category: 'Immune & Antioxidant', price_usd: '$100' }),
    row({ product: 'VIP 5mg', vial_size: '5mg', category: 'Immune & Antioxidant', price_usd: '$124' }),
  ], RATE);

  const bySlug = Object.fromEntries(compounds.map((c) => [c.slug, c]));
  assert.equal(bySlug.glutathione.shelf, 'derm');
  assert.equal(bySlug.vip.shelf, 'neuro');
  // The catalog's own category is kept, because the business runs on it.
  assert.equal(bySlug.vip.category, 'Immune & Antioxidant');
});

test('slugs and name stripping', () => {
  assert.equal(slugify('NAD+'), 'nad-plus');
  assert.equal(slugify('BPC-157 + TB-500'), 'bpc-157-plus-tb-500');
  assert.equal(slugify('5-Amino-1MQ'), '5-amino-1mq');
  assert.equal(compoundName('Tirzepatide 120mg', '120mg'), 'Tirzepatide');
  assert.equal(compoundName('HGH 12 IU', '12 IU'), 'HGH');
  // A size that is not actually in the name leaves the name alone.
  assert.equal(compoundName('Mystery Peptide', '10mg'), 'Mystery Peptide');
  // A size typed into the name over and over is dropped with its repeats.
  assert.equal(compoundName('GLP-1 (RT) - USA Manufactured 60 60 60 60 60 60 60 60 60', '60'), 'GLP-1 (RT) - USA Manufactured');
  assert.equal(compoundName('Tirzepatide – USA Manufactured 100 100 100', '100'), 'Tirzepatide – USA Manufactured');
  // A number that belongs to the name stays.
  assert.equal(compoundName('BPC-157 10mg', '10mg'), 'BPC-157');
});
