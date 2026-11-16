import test from 'node:test';
import assert from 'node:assert/strict';
import { dealHidesVolumePresets, dealOfferForProduct, describeDeal } from '../lib/site/deal-view.mjs';
import { quoteCart } from '../lib/site/quote.mjs';
import { isBacWater, isGiftLine, stripGiftSuffix } from '../lib/catalog-pricing/bacWater.mjs';

// The shape of the live "Black Friday Early Bird" deal (16 Nov 2026).
const blackFriday = {
  id: 'bf',
  product_names: ['Tirzepatide 10mg', 'BPC-157 10mg'],
  discount_pct: 0.2,
  starts_at: '2026-11-16T10:00:00Z',
  ends_at: '2026-11-23T05:59:59Z',
  pricing_mode: 'offers',
  offers: {
    items: [{
      id: 'mix-1', type: 'bundle', enabled: true, buy_qty: 4, free_qty: 1,
      count_mode: 'any_mix', max_free_qty: 0,
      name_en: 'Black Friday Early Bird', name_es: 'Black Friday anticipado',
      product_names: ['Tirzepatide 10mg', 'BPC-157 10mg'],
    }],
  },
};
const now = Date.parse('2026-11-17T12:00:00Z');

test('a buy X get Y deal carries its offer for the product card', () => {
  const view = describeDeal(blackFriday, 'en', now);
  assert.equal(view.headline, 'Buy 4, get 1 free');
  assert.deepEqual(
    { type: view.primary.type, buyQty: view.primary.buyQty, freeQty: view.primary.freeQty, anyMix: view.primary.anyMix },
    { type: 'bundle', buyQty: 4, freeQty: 1, anyMix: true },
  );
  const offer = dealOfferForProduct(view, ['Tirzepatide 10mg']);
  assert.equal(offer?.type, 'bundle');
  assert.equal(dealHidesVolumePresets(offer), true);
  assert.equal(dealOfferForProduct(view, ['Semaglutide 10mg']), null, 'a product outside the deal keeps volume pricing');
});

test('a spend ladder or free-shipping deal gets no red card', () => {
  const spend = {
    ...blackFriday,
    offers: { items: [{ id: 's', type: 'spend', enabled: true, min_total_usd: 300, discount_pct: 0.1, product_names: ['Tirzepatide 10mg'] }] },
  };
  assert.equal(dealOfferForProduct(describeDeal(spend, 'en', now), ['Tirzepatide 10mg']), null);
  const ship = {
    ...blackFriday,
    offers: { items: [{ id: 'f', type: 'free_shipping', enabled: true, min_units: 1, product_names: ['Tirzepatide 10mg'] }] },
  };
  assert.equal(dealOfferForProduct(describeDeal(ship, 'en', now), ['Tirzepatide 10mg']), null);
});

test('the pooled quote gives the free vial at 4 and beats the 15% volume tier at 5', () => {
  const line = (qty) => [{ product: 'Tirzepatide 10mg', priceUsd: 155, priceCrc: 77500, category: 'GLP', qty }];
  const freeOf = (quote) => (quote?.items || [])
    .filter((item) => isGiftLine(item) && !isBacWater(stripGiftSuffix(item.product)))
    .reduce((sum, item) => sum + item.qty, 0);
  const opts = { currency: 'USD', exchangeRate: 500, deal: blackFriday, now: new Date(now) };
  assert.equal(freeOf(quoteCart(line(3), opts)), 0);
  assert.equal(freeOf(quoteCart(line(4), opts)), 1);
  const five = quoteCart(line(5), opts);
  assert.equal(freeOf(five), 1, 'the free vial, not 15% off');
  assert.equal(five.dealApplied, true);
  assert.equal(five.discountPct, 0);
});
