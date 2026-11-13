import test from 'node:test';
import assert from 'node:assert/strict';
import { flashSaleBanner } from '../src/lib/flashSaleBanner.mjs';

const flash = {
  id: 'flash-20',
  offers: { items: [{ type: 'flat', enabled: true, discount_pct: 0.2 }] },
};

test('active flash sale becomes a concise bilingual fallback banner', () => {
  const es = flashSaleBanner(flash, 'es', '/catalog?lang=es');
  const en = flashSaleBanner(flash, 'en', '/catalog?lang=en');
  assert.match(es.text, /20% DE DESCUENTO/);
  assert.match(en.text, /20% OFF/);
  assert.equal(es.id, 'deal-flash-20');
  assert.equal(es.href, '/catalog?lang=es');
});

test('invalid deal does not create a banner', () => {
  assert.equal(flashSaleBanner(null), null);
  assert.equal(flashSaleBanner({ id: 'x', offers: { items: [] } }), null);
});
