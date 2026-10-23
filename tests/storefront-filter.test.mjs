import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyFilters, shelfChips } from '../lib/storefront/filter.mjs';

const CATALOG = [
  {
    slug: 'glp-1', name: 'GLP-1', storedName: 'GLP-1 (RT) – Agonista Triple', shelf: 'metabolic',
    best: true, priority: 0, inStock: true, fromPriceUsd: 100,
    variants: [{ size: '5 mg' }, { size: '20 mg' }],
  },
  {
    slug: 'ghk-cu', name: 'GHK-Cu', storedName: 'GHK-CU', shelf: 'derm',
    best: true, priority: 90, inStock: true, fromPriceUsd: 70,
    variants: [{ size: '50 mg' }],
  },
  {
    slug: 'bpc-157', name: 'BPC-157', storedName: 'BPC-157', shelf: 'repair',
    best: false, priority: 20, inStock: true, fromPriceUsd: 90,
    variants: [{ size: '10 mg' }],
  },
  {
    slug: 'mots-c', name: 'MOTS-c', storedName: 'MOTS-C', shelf: 'mito',
    best: false, priority: 10, inStock: false, fromPriceUsd: 150,
    variants: [{ size: '40 mg' }],
  },
];

test('most popular puts best sellers first, then the catalog\'s own order', () => {
  const order = applyFilters(CATALOG, { sort: 'pop' }).map((c) => c.slug);
  assert.deepEqual(order, ['glp-1', 'ghk-cu', 'mots-c', 'bpc-157']);
});

test('price sorts run on the cheapest strength', () => {
  assert.deepEqual(
    applyFilters(CATALOG, { sort: 'low' }).map((c) => c.slug),
    ['ghk-cu', 'bpc-157', 'glp-1', 'mots-c'],
  );
  assert.deepEqual(
    applyFilters(CATALOG, { sort: 'high' }).map((c) => c.slug),
    ['mots-c', 'glp-1', 'bpc-157', 'ghk-cu'],
  );
});

test('A–Z sorts by the displayed name', () => {
  assert.deepEqual(
    applyFilters(CATALOG, { sort: 'az' }).map((c) => c.name),
    ['BPC-157', 'GHK-Cu', 'GLP-1', 'MOTS-c'],
  );
});

test('a shelf shows only its own compounds; best sellers is its own shelf', () => {
  assert.deepEqual(applyFilters(CATALOG, { shelf: 'repair' }).map((c) => c.slug), ['bpc-157']);
  assert.deepEqual(applyFilters(CATALOG, { shelf: 'best' }).map((c) => c.slug), ['glp-1', 'ghk-cu']);
  assert.equal(applyFilters(CATALOG, { shelf: 'all' }).length, 4);
});

test('search covers the name, the strengths and the shelf', () => {
  assert.deepEqual(applyFilters(CATALOG, { query: 'glp' }).map((c) => c.slug), ['glp-1']);
  assert.deepEqual(applyFilters(CATALOG, { query: '20 mg' }).map((c) => c.slug), ['glp-1']);
  assert.deepEqual(applyFilters(CATALOG, { query: 'tissue' }).map((c) => c.slug), ['bpc-157']);
  // The stored name is searchable too, so the Spanish listing name still finds it.
  assert.deepEqual(applyFilters(CATALOG, { query: 'agonista' }).map((c) => c.slug), ['glp-1']);
  assert.equal(applyFilters(CATALOG, { query: 'nothing here' }).length, 0);
});

test('search ignores case and surrounding space', () => {
  assert.deepEqual(applyFilters(CATALOG, { query: '  GHK  ' }).map((c) => c.slug), ['ghk-cu']);
});

test('the stock filter hides what cannot be bought', () => {
  const shown = applyFilters(CATALOG, { inStockOnly: true }).map((c) => c.slug);
  assert.ok(!shown.includes('mots-c'));
  assert.equal(shown.length, 3);
});

test('chips count what is on each shelf and skip the empty ones', () => {
  const chips = shelfChips(CATALOG, 'en');
  const byId = Object.fromEntries(chips.map((chip) => [chip.id, chip]));

  assert.equal(byId.all.count, 4);
  assert.ok(byId.best, 'best sellers get a chip when there are any');
  assert.equal(byId.repair.count, 1);
  assert.equal(byId.gh, undefined, 'a shelf holding nothing is not offered');
  assert.equal(byId.derm.label, 'Copper & dermatological');
  assert.equal(shelfChips(CATALOG, 'es').find((c) => c.id === 'derm').label, 'Cobre y dermatológicos');
});

test('an empty catalog filters to nothing without throwing', () => {
  assert.deepEqual(applyFilters([], { sort: 'pop' }), []);
  assert.deepEqual(applyFilters(undefined, {}), []);
  assert.equal(shelfChips([]).length, 1, 'only the All chip, counting zero');
});
