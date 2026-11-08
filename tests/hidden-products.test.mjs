import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hiddenNamesFrom, withoutHidden } from '../lib/storefront/hidden-products.mjs';

const rows = [
  { product: 'Tirzepatide 40mg' },
  { product: 'Tirzepatide – USA Manufactured 50mg' },
  { product: 'Pinealon 10mg' },
  { product: 'Pinealon 20mg' },
];

test('reads the names out of the site_settings row', () => {
  const names = hiddenNamesFrom([{ value: { names: ['Pinealon 10mg', 42, null] } }]);
  assert.deepEqual([...names], ['Pinealon 10mg']);
});

test('an empty, missing or malformed setting hides nothing', () => {
  for (const input of [[], null, undefined, {}, [{}], [{ value: {} }], [{ value: { names: 'Pinealon 10mg' } }]]) {
    assert.equal(hiddenNamesFrom(input).size, 0);
    assert.equal(withoutHidden(rows, hiddenNamesFrom(input)), rows);
  }
});

test('drops exactly the hidden rows, matched on the full product string', () => {
  const hidden = hiddenNamesFrom([{ value: { names: ['Tirzepatide – USA Manufactured 50mg', 'Pinealon 10mg', 'Pinealon'] } }]);
  assert.deepEqual(withoutHidden(rows, hidden).map((row) => row.product), ['Tirzepatide 40mg', 'Pinealon 20mg']);
});
