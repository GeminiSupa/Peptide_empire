import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { normalizeChargxPaymentType, CHARGX_PAYMENT_TYPES } from '../src/lib/chargxPay.mjs';

// The website's Bank (ACH) and Crypto options finish on /pay-card, as the
// catalog checkout's own tiles finish on /api/chargx/process-card. Both must
// open the same Chargex page for the same choice, and anything else is a card.

const route = fs.readFileSync('src/app/api/card-payment-link/pay/route.js', 'utf8');
const page = fs.readFileSync('src/app/pay-card/page.js', 'utf8');

test('only card, ach and crypto exist; anything else is a card', () => {
  assert.deepEqual(CHARGX_PAYMENT_TYPES, ['card', 'ach', 'crypto']);
  assert.equal(normalizeChargxPaymentType('ach'), 'ach');
  assert.equal(normalizeChargxPaymentType('CRYPTO'), 'crypto');
  for (const junk of [undefined, null, '', 'paypal', 'card ', '<script>']) {
    assert.equal(normalizeChargxPaymentType(junk), 'card', String(junk));
  }
});

test('the payment-link route opens the Chargex page the shopper chose', () => {
  assert.match(route, /const payType = normalizeChargxPaymentType\(body\?\.payType\);/);
  assert.match(route, /type: payType,/);
  assert.match(route, /&payment=\$\{payType\}`/);
});

test('the one-payment-at-a-time claim still runs before Chargex is called', () => {
  const claim = route.indexOf('claimOrderForPayment(supabase, order.order_number)');
  const chargex = route.indexOf('createChargxCardCheckout({');
  assert.ok(claim > 0 && chargex > claim, 'the claim must come first');
});

test('the page passes the choice through and only opens a new tab for cards', () => {
  assert.match(page, /requestedType === 'ach' \|\| requestedType === 'crypto' \? requestedType : 'card'/);
  assert.match(page, /payType === 'card' \? window\.open\('', '_blank'\) : null/);
  assert.match(page, /customerEmail: form\.email\.trim\(\),\s*payType,/);
});
