import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpsellRecommendations } from '../src/lib/upsellRecommendations.mjs';

const product = (name, category, extra = {}) => ({
  product: name,
  category,
  status: 'In Stock',
  inventoryCount: 10,
  ...extra,
});

const metabolic = 'Metabolic & GLP-1 Compounds';
const mitochondrial = 'Mitochondrial Compounds';
const longevity = 'Anti-Aging & Longevity';
const cognitive = 'Cognitive & Mood';

test('uses the requested priority and selects NAD+ 1000mg over 500mg', () => {
  const products = [
    product('NAD+ 500mg', mitochondrial, { isDefaultSize: true }),
    product('Selank 10mg', cognitive),
    product('SS-31 25mg', longevity),
    product('NAD+ 1000mg', mitochondrial),
    product('Epithalon 50mg', longevity),
  ];
  const result = buildUpsellRecommendations({ cart: [product('BPC-157 10mg', 'Tissue Repair')], products });
  assert.deepEqual(result.map((row) => row.product), ['NAD+ 1000mg', 'Epithalon 50mg', 'SS-31 25mg']);
});

test('excludes every size of a compound already in the cart', () => {
  const products = [
    product('NAD+ 500mg', mitochondrial),
    product('NAD+ 1000mg', mitochondrial),
    product('Pinealon 20mg', cognitive),
  ];
  const result = buildUpsellRecommendations({ cart: [product('NAD+ 250mg', 'Custom NAD category')], products });
  assert.deepEqual(result.map((row) => row.product), ['Pinealon 20mg']);
});

test('excludes all cart categories and treats legacy metabolic labels as GLP-1', () => {
  const products = [
    product('Semaglutide 5mg', metabolic),
    product('Tirzepatide 10mg', 'Weight Loss & Metabolism'),
    product('NAD+ 1000mg', mitochondrial),
    product('Epithalon 50mg', longevity),
  ];
  const result = buildUpsellRecommendations({
    cart: [product('GLP-1 10mg', 'Weight Loss & Metabolism'), product('Selank 10mg', cognitive)],
    products,
  });
  assert.deepEqual(result.map((row) => row.product), ['NAD+ 1000mg', 'Epithalon 50mg']);
});

test('skips sold-out, zero-inventory, BAC water, and hidden products', () => {
  const products = [
    product('NAD+ 1000mg', mitochondrial, { status: 'Out of Stock' }),
    product('Epithalon 50mg', longevity, { inventoryCount: 0 }),
    product('BAC Water 10ml', 'Bacteriostatic Water'),
    product('SS-31 25mg', longevity, { hidden: true }),
    product('Pinealon 20mg', cognitive),
  ];
  const result = buildUpsellRecommendations({
    cart: [product('BPC-157 10mg', 'Tissue Repair')],
    products,
    isListable: (row) => !row.hidden,
  });
  assert.deepEqual(result.map((row) => row.product), ['Pinealon 20mg']);
});

test('fills open slots in catalog best-seller order with one size per compound', () => {
  const products = [
    product('BPC-157 10mg', 'Tissue Repair'),
    product('BPC-157 5mg', 'Tissue Repair', { isDefaultSize: true }),
    product('GHK-Cu 50mg', 'Copper Peptides'),
    product('Tesamorelin 10mg', 'Growth Hormone Secretagogues'),
  ];
  const result = buildUpsellRecommendations({ cart: [product('GLP-1 10mg', metabolic)], products });
  assert.deepEqual(result.map((row) => row.product), ['BPC-157 5mg', 'GHK-Cu 50mg', 'Tesamorelin 10mg']);
});
