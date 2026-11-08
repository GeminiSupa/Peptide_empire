import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkoutUrl } from '../lib/storefront/catalog-origin.mjs';

test('switched off, checkout and payment pages stay on the catalog, unchanged', () => {
  assert.equal(checkoutUrl('/api/orders/create', false), 'https://catalog.peptidescostarica.net/api/orders/create');
  assert.equal(checkoutUrl('/pay-card/W-1/tok', false), 'https://catalog.peptidescostarica.net/pay-card/W-1/tok');
  assert.equal(checkoutUrl('/pay-bank?lang=es#t', false), 'https://catalog.peptidescostarica.net/pay-bank?lang=es#t');
});

test('switched on, they are this site\'s own paths, with the trailing slash it serves', () => {
  assert.equal(checkoutUrl('/api/orders/create', true), '/api/orders/create/');
  assert.equal(checkoutUrl('/pay-card/W-1/tok', true), '/pay-card/W-1/tok/');
  assert.equal(checkoutUrl('/pay-card?order=W-1&token=t&type=ach', true), '/pay-card/?order=W-1&token=t&type=ach');
  assert.equal(checkoutUrl('/pay-bank?lang=es#t', true), '/pay-bank/?lang=es#t');
});

test('every page and route the switch sends a customer to exists in this site', () => {
  for (const file of [
    'app/api/orders/create/route.js',
    'app/(pay)/pay-card/page.js',
    'app/(pay)/pay-card/[order]/[token]/page.js',
    'app/(pay)/pay-bank/page.js',
    'app/(pay)/order-confirmation/page.js',
  ]) {
    assert.ok(fs.existsSync(new URL(`../${file}`, import.meta.url)), file);
  }
});
