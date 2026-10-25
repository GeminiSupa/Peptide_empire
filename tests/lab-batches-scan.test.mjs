import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  batchCodeBase,
  cleanReportUrl,
  nextBatchCode,
  oldStockCode,
  parseStickerCode,
  productCodePrefix,
  stickerUrl,
} from '../src/lib/labBatches.mjs';
import {
  checkScan,
  packingLinesForOrder,
  packingProgress,
  productMatchKey,
  verifyPackingEntries,
} from '../src/lib/packingScan.mjs';
import { adminPermissionsForPath } from '../src/lib/adminApiPermissions.mjs';
import { ASSIGNABLE_ADMIN_MODULE_IDS } from '../src/lib/adminModules.js';

// ── Sticker codes ────────────────────────────────────────────────────────────

test('code prefixes read like the product, using real catalog names', () => {
  assert.equal(productCodePrefix('BPC-157 10mg'), 'BPC10');
  assert.equal(productCodePrefix('AA Water 3ml'), 'AA3');
  assert.equal(productCodePrefix('GHK-Cu 50mg'), 'GHKC50');
  assert.equal(productCodePrefix('5-Amino-1MQ 50mg'), 'AMIN50');
  assert.equal(productCodePrefix('BPC-157 + TB-500 (Wolverine Stack) 20mg'), 'BPC20');
  assert.equal(productCodePrefix(''), 'P');
});

test('batch codes use the Costa Rica month, not the reader\'s clock', () => {
  // 03:00 UTC on 1 Nov is still 31 Oct in Costa Rica.
  assert.equal(batchCodeBase('BPC-157 10mg', new Date('2026-11-01T03:00:00Z')), 'BPC10-2610');
});

test('the next free batch code skips taken ones', () => {
  assert.equal(nextBatchCode('BPC10-2610', []), 'BPC10-2610-A');
  assert.equal(nextBatchCode('BPC10-2610', ['BPC10-2610-A', 'bpc10-2610-b']), 'BPC10-2610-C');
  const allSingles = Array.from({ length: 26 }, (_, i) => `X-2610-${String.fromCharCode(65 + i)}`);
  assert.equal(nextBatchCode('X-2610', allSingles), 'X-2610-AA');
});

test('two products that share a prefix still get different old-stock codes', () => {
  assert.equal(oldStockCode('BPC-157 20mg', []), 'BPC20-OLD');
  assert.equal(oldStockCode('BPC-157 + TB-500 (Wolverine Stack) 20mg', ['BPC20-OLD']), 'BPC20-OLD-2');
});

test('a sticker link round-trips back to its code', () => {
  assert.equal(stickerUrl('bpc10-2610-a'), 'https://catalog.peptidescostarica.net/b/BPC10-2610-A');
  assert.equal(parseStickerCode(stickerUrl('BPC10-2610-A')), 'BPC10-2610-A');
});

test('scanner output is reduced to the code, even when the keyboard layout mangles it', () => {
  assert.equal(parseStickerCode('https://catalog.peptidescostarica.net/b/BPC10-2610-A\n'), 'BPC10-2610-A');
  assert.equal(parseStickerCode('HTTPS://CATALOG.PEPTIDESCOSTARICA.NET/B/AA3-2610-B'), 'AA3-2610-B');
  // A scanner on a different layout from the PC: "/" and ":" come out wrong.
  assert.equal(parseStickerCode('httpsÑ&&catalog.peptidescostarica.net&b&GHKC50-2610-A'), 'GHKC50-2610-A');
  assert.equal(parseStickerCode('https--catalog.peptidescostarica.net-b-GHKC50-2610-A'), 'GHKC50-2610-A');
  assert.equal(parseStickerCode('bpc20-old-2'), 'BPC20-OLD-2');
  assert.equal(parseStickerCode('  '), '');
});

test('only web addresses are kept as lab report links', () => {
  assert.equal(cleanReportUrl('janoshik.com/tests/123'), 'https://janoshik.com/tests/123');
  assert.equal(cleanReportUrl('javascript:alert(1)'), '');
  assert.equal(cleanReportUrl(''), '');
});

// ── Packing check ────────────────────────────────────────────────────────────

// A slice of the real products table, spellings as they are stored.
const products = [
  { id: 'p-bpc10', product: 'BPC-157 10mg' },
  { id: 'p-bpc5', product: 'BPC-157 5mg' },
  { id: 'p-tb5', product: 'TB-500 5mg' },
  { id: 'p-bac3', product: 'BAC Water 3ml' },
  { id: 'p-bac10', product: 'BAC Water 10ml' },
  { id: 'p-glp30', product: 'GLP-1 (RT) – Agonista Triple 30mg' },
  { id: 'p-cjc', product: 'CJC-1295 without DAC + Ipamorelin 10mg' },
];

// Spelled the way real orders are: a Spanish BAC line, a gift, a pre-rename name.
const order = {
  items: [
    { product: 'BPC-157 10mg', qty: 2, price: 45 },
    { product: 'Agua Bacteriostática 3ml', qty: 1, price: 5 },
    { product: 'BAC Water 3ml (Free gift)', qty: 1, price: 0 },
    { product: 'GLP-1 30mg', qty: 1, price: 120 },
  ],
};

const batches = new Map([
  ['BPC10-2610-A', { id: 'b1', product_id: 'p-bpc10', product: 'BPC-157 10mg' }],
  ['BPC10-OLD', { id: 'b2', product_id: 'p-bpc10', product: 'BPC-157 10mg' }],
  ['BAC3-OLD', { id: 'b3', product_id: 'p-bac3', product: 'BAC Water 3ml' }],
  ['TB5-2610-A', { id: 'b4', product_id: 'p-tb5', product: 'TB-500 5mg' }],
  ['BPC5-2610-A', { id: 'b5', product_id: 'p-bpc5', product: 'BPC-157 5mg' }],
  ['GLP30-2610-A', { id: 'b6', product_id: 'p-glp30', product: 'GLP-1 (RT) – Agonista Triple 30mg' }],
]);
const keyOf = (code) => productMatchKey({ id: batches.get(code).product_id, product: batches.get(code).product });

test('order names resolve to their product: Spanish BAC water, gifts and renamed products', () => {
  const lines = packingLinesForOrder(order, products);
  assert.deepEqual(
    lines.map((line) => [line.product, line.catalogName, line.needed, line.scannable]),
    [
      ['BPC-157 10mg', 'BPC-157 10mg', 2, true],
      ['Agua Bacteriostática 3ml', 'BAC Water 3ml', 2, true],
      ['GLP-1 30mg', 'GLP-1 (RT) – Agonista Triple 30mg', 1, true],
    ],
  );
});

test('a name with its size missing matches only when one product fits', () => {
  const [line] = packingLinesForOrder({ items: [{ product: 'CJC-1295 without DAC + Ipamorelin', qty: 1 }] }, products);
  assert.equal(line.catalogName, 'CJC-1295 without DAC + Ipamorelin 10mg');
  // "BPC-157" fits both 5mg and 10mg: never guess the size.
  const [ambiguous] = packingLinesForOrder({ items: [{ product: 'BPC-157', qty: 1 }] }, products);
  assert.equal(ambiguous.scannable, false);
});

test('a scan is refused for the wrong size and for one too many', () => {
  const lines = packingLinesForOrder(order, products);
  assert.equal(checkScan(lines, [], keyOf('BPC5-2610-A')).reason, 'not_in_order');
  const two = [{ key: keyOf('BPC10-2610-A') }, { key: keyOf('BPC10-OLD') }];
  assert.equal(checkScan(lines, two, keyOf('BPC10-2610-A')).reason, 'already_complete');
  assert.equal(checkScan(lines, two, keyOf('BAC3-OLD')).ok, true);
  assert.equal(packingProgress(lines, two).complete, false);
});

test('the server takes the product from the database, never from the browser', () => {
  const lying = [{ method: 'scan', code: 'TB5-2610-A', product: 'BPC-157 10mg', key: 'id:p-bpc10' }];
  const verdict = verifyPackingEntries(order, lying, batches, products);
  assert.equal(verdict.ok, false);
  assert.match(verdict.error, /TB-500 5mg is not in this order/);
});

test('an unknown sticker or an unfinished box is not saved', () => {
  assert.match(verifyPackingEntries(order, [{ method: 'scan', code: 'NOPE-0000-A' }], batches, products).error, /not a known batch/);
  assert.match(
    verifyPackingEntries(order, [{ method: 'scan', code: 'BPC10-2610-A' }], batches, products).error,
    /Only 1 of 5 items are checked/,
  );
});

test("a complete box saves which batch went in, grouped, in the order's own spelling", () => {
  const verdict = verifyPackingEntries(order, [
    { method: 'scan', code: 'BPC10-2610-A' },
    { method: 'scan', code: 'bpc10-old' },
    { method: 'scan', code: 'BAC3-OLD' },
    { method: 'manual', key: 'bac:3' },
    { method: 'scan', code: 'GLP30-2610-A' },
  ], batches, products);
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.packedItems, [
    { product: 'BPC-157 10mg', batch_code: 'BPC10-2610-A', batch_id: 'b1', qty: 1, method: 'scan' },
    { product: 'BPC-157 10mg', batch_code: 'BPC10-OLD', batch_id: 'b2', qty: 1, method: 'scan' },
    { product: 'Agua Bacteriostática 3ml', batch_code: 'BAC3-OLD', batch_id: 'b3', qty: 1, method: 'scan' },
    { product: 'Agua Bacteriostática 3ml', batch_code: null, batch_id: null, qty: 1, method: 'manual' },
    { product: 'GLP-1 30mg', batch_code: 'GLP30-2610-A', batch_id: 'b6', qty: 1, method: 'scan' },
  ]);
});

test('a hand check for a line that is not in the order is refused', () => {
  const verdict = verifyPackingEntries(order, [{ method: 'manual', key: 'id:p-tb5' }], batches, products);
  assert.equal(verdict.ok, false);
});

// ── Access ───────────────────────────────────────────────────────────────────

test('the new routes sit behind their own tabs', () => {
  assert.deepEqual(adminPermissionsForPath('/api/admin/lab-batches'), ['lab_batches']);
  assert.deepEqual(adminPermissionsForPath('/api/admin/packing'), ['fulfillment']);
  assert.equal(ASSIGNABLE_ADMIN_MODULE_IDS.has('lab_batches'), true);
});
