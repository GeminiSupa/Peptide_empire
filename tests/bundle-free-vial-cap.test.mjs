import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseDealOffer, dealOffersError, dealOfferRuleSummaries, dealOfferSummaries, normalizeDealOffers } from '../src/lib/dealOffers.mjs';

// The two offers the owner wants live: buy 3 get 1 free and buy 5 get 2 free,
// with no order ever giving away more than 2 free vials.
const CAPPED = {
  items: [
    { id: 'b3', type: 'bundle', enabled: true, product_names: ['BPC-157 10mg', 'GHK-CU 50mg', 'KPV 10mg'], buy_qty: 3, free_qty: 1, max_free_qty: 2 },
  ],
};
const line = (product, qty, unitPrice, inventoryCount = null) => ({ product, qty, unitPrice, inventoryCount });

test('an uncapped bundle still repeats per product, as it always did', () => {
  const uncapped = { items: [{ ...CAPPED.items[0], max_free_qty: 0 }] };
  const choice = chooseDealOffer(uncapped, [
    line('BPC-157 10mg', 6, 100),
    line('GHK-CU 50mg', 6, 80),
  ]);
  assert.equal(choice.kind, 'bundle');
  assert.equal(choice.bundle.freeLines.reduce((n, l) => n + l.qty, 0), 4);
  assert.equal(choice.bundle.cappedByMax, false);
});

test('the cap holds the whole order to 2 free vials across products', () => {
  const choice = chooseDealOffer(CAPPED, [
    line('BPC-157 10mg', 6, 100),
    line('GHK-CU 50mg', 6, 80),
  ]);
  assert.equal(choice.kind, 'bundle');
  assert.equal(choice.bundle.freeLines.reduce((n, l) => n + l.qty, 0), 2);
  assert.equal(choice.bundle.cappedByMax, true);
});

test('the cheapest vials are the free ones once the cap bites', () => {
  const choice = chooseDealOffer(CAPPED, [
    line('BPC-157 10mg', 3, 100),
    line('GHK-CU 50mg', 3, 80),
    line('KPV 10mg', 3, 40),
  ]);
  // Earned 3 (one per product); the cap keeps the two cheapest, 40 and 80.
  assert.deepEqual(choice.bundle.freeLines, [
    { product: 'KPV 10mg', qty: 1, unitPrice: 40 },
    { product: 'GHK-CU 50mg', qty: 1, unitPrice: 80 },
  ]);
  assert.equal(choice.savings, 120);
});

test('a cap larger than the order earns changes nothing', () => {
  const choice = chooseDealOffer(CAPPED, [line('BPC-157 10mg', 3, 100)]);
  assert.equal(choice.bundle.freeLines.reduce((n, l) => n + l.qty, 0), 1);
  assert.equal(choice.bundle.cappedByMax, false);
});

test('one product alone cannot run past the cap either', () => {
  const choice = chooseDealOffer(CAPPED, [line('BPC-157 10mg', 12, 100)]);
  assert.equal(choice.bundle.freeLines[0].qty, 2); // earned 4, capped to 2
  assert.equal(choice.savings, 200);
});

test('buy-5-get-2 wins over buy-3-get-1 on a 5-vial cart, both capped at 2', () => {
  const both = {
    items: [
      { id: 'b3', type: 'bundle', enabled: true, product_names: ['BPC-157 10mg'], buy_qty: 3, free_qty: 1, max_free_qty: 2 },
      { id: 'b5', type: 'bundle', enabled: true, product_names: ['BPC-157 10mg'], buy_qty: 5, free_qty: 2, max_free_qty: 2 },
    ],
  };
  const choice = chooseDealOffer(both, [line('BPC-157 10mg', 5, 100)]);
  assert.equal(choice.offerId, 'b5');
  assert.equal(choice.savings, 200);
});

test('the cap is rejected when it is below what the offer gives away', () => {
  assert.match(
    dealOffersError({ items: [{ type: 'bundle', enabled: true, product_names: ['X'], buy_qty: 5, free_qty: 2, max_free_qty: 1 }] }),
    /cannot be less than/,
  );
  assert.match(
    dealOffersError({ items: [{ type: 'bundle', enabled: true, product_names: ['X'], buy_qty: 5, free_qty: 2, max_free_qty: -1 }] }),
    /whole number/,
  );
  assert.equal(
    dealOffersError({ items: [{ type: 'bundle', enabled: true, product_names: ['X'], buy_qty: 5, free_qty: 2, max_free_qty: 2 }] }),
    '',
  );
  // No cap at all stays valid, so older deals keep launching.
  assert.equal(
    dealOffersError({ items: [{ type: 'bundle', enabled: true, product_names: ['X'], buy_qty: 3, free_qty: 1 }] }),
    '',
  );
});

test('the cap survives normalization and reaches the customer copy', () => {
  assert.equal(normalizeDealOffers(CAPPED).items[0].max_free_qty, 2);
  assert.match(dealOfferSummaries(CAPPED, 'en')[0], /up to 2 free per order/);
  assert.match(dealOfferSummaries(CAPPED, 'es')[0], /máximo 2 gratis por pedido/);
  assert.match(dealOfferRuleSummaries(CAPPED, 'en').join(' '), /no more than 2 free vials per order/);
  assert.match(dealOfferRuleSummaries(CAPPED, 'es').join(' '), /máximo 2 viales gratis por pedido/);
  // An uncapped offer must not grow a "max" clause out of nowhere.
  const uncapped = { items: [{ ...CAPPED.items[0], max_free_qty: 0 }] };
  assert.doesNotMatch(dealOfferSummaries(uncapped, 'en')[0], /up to/);
});
