import test from 'node:test';
import assert from 'node:assert/strict';
import { flashSaleBanner } from '../lib/site/flash-sale-banner.mjs';

const flash = {
  id: 'flash-20',
  offers: { items: [{ type: 'flat', enabled: true, discount_pct: 0.2 }] },
};

test('website gets a concise bilingual banner from the live flash sale', () => {
  assert.match(flashSaleBanner(flash, 'en').text, /20% OFF/);
  assert.match(flashSaleBanner(flash, 'es').text, /20% DE DESCUENTO/);
  assert.equal(flashSaleBanner(flash, 'en').id, 'deal-flash-20');
});

test('website does not invent a banner without a valid sale percentage', () => {
  assert.equal(flashSaleBanner(null), null);
  assert.equal(flashSaleBanner({ id: 'x', offers: { items: [] } }), null);
});
