import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dealProductNamesMatch,
  resolveDealProductName,
  productInDeal,
} from '../src/lib/catalogFilters.mjs';
import { chooseDealOffer } from '../src/lib/dealOffers.mjs';

test('renamed GLP-1 deal names still match the live catalog spelling', () => {
  assert.equal(
    dealProductNamesMatch('GLP-1 30mg', 'GLP-1 (RT) – Agonista Triple 30mg'),
    true,
  );
  assert.equal(
    dealProductNamesMatch('GLP-1 5mg', 'GLP-1 (RT) – Agonista Triple 15mg'),
    false,
    '5mg must not match 15mg',
  );
  assert.equal(
    resolveDealProductName('GLP-1 30mg', [
      'GLP-1 (RT) – Agonista Triple 20mg',
      'GLP-1 (RT) – Agonista Triple 30mg',
    ]),
    'GLP-1 (RT) – Agonista Triple 30mg',
  );
  assert.equal(
    productInDeal(
      { product: 'GLP-1 (RT) – Agonista Triple 30mg' },
      ['GLP-1 30mg', 'Tirzepatide 10mg'],
    ),
    true,
  );
});

test('a cart with the renamed GLP still qualifies for the deal offer', () => {
  const offers = {
    items: [{
      id: 'bundle-1',
      type: 'bundle',
      enabled: true,
      buy_qty: 3,
      free_qty: 1,
      max_free_qty: 1,
      count_mode: 'any_mix',
      product_names: ['GLP-1 30mg', 'Tirzepatide 10mg'],
    }],
  };
  const choice = chooseDealOffer(offers, [
    { product: 'GLP-1 (RT) – Agonista Triple 30mg', qty: 3, unitPrice: 180 },
  ]);
  assert.equal(choice.kind, 'bundle');
  assert.equal(choice.savings, 180);
});
