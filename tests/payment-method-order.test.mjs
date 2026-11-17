import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalog = await readFile(new URL('../src/app/catalog/page.js', import.meta.url), 'utf8');

test('checkout payment methods follow the customer-facing priority order', () => {
  const paymentGrid = catalog.slice(
    catalog.indexOf('className="payment-method-grid"'),
    catalog.indexOf('].map(method =>', catalog.indexOf('className="payment-method-grid"')),
  );
  // Apple Pay right after Card; crypto removed (Joey, 15 Nov 2026).
  const positions = ['whatsapp', 'card', 'apple_pay', 'sinpe', 'bank_transfer', 'ach']
    .map((method) => paymentGrid.indexOf(`value: '${method}'`));
  assert.ok(positions.every((position) => position >= 0), 'every payment method is present');
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.equal(paymentGrid.indexOf("value: 'crypto'"), -1, 'crypto is not offered');
});

test('Apple Pay is its own tile, offered to every device', () => {
  // No device test: the wallet is on the gateway's page, which offers it in
  // Chrome on Windows and on Apple devices (Omer, 18 Nov 2026).
  assert.match(catalog, /const applePayOffered = APPLE_PAY_LIVE;/);
  assert.doesNotMatch(catalog, /canMakePayments/);
  assert.match(catalog, /\.\.\.\(applePayOffered \? \[\{\s*value: 'apple_pay'/);
  // The Card tile no longer names it, and its logo row has no Apple mark.
  assert.doesNotMatch(catalog, /Credit\/Debit\$\{applePayOffered/);
  const cardMarks = catalog.slice(catalog.indexOf('function CardBrandMarks()'), catalog.indexOf('function CostaRicaBankMarks()'));
  assert.doesNotMatch(cardMarks, /M13\.3 5\.7/, 'no Apple logo on the Card tile');
  // It pays through the card flow: same gateway page, saved as a card order.
  assert.match(catalog, /const chargxPayType = paymentMethod === 'ach' \|\| paymentMethod === 'crypto' \? paymentMethod : 'card'/);
  assert.match(catalog, /paymentMethod === 'apple_pay' && !cardRetryBlocked && \(\s*<button[\s\S]{0,200}apple-pay-btn--full[\s\S]{0,700}onClick=\{startCardCheckout\}/);
});

test('Costa Rican bank transfer shows the requested bank marks without claiming exclusivity', () => {
  assert.match(catalog, /payment-bank-mark--bac">BAC/);
  assert.match(catalog, /payment-bank-mark--bn">BNCR/);
  assert.match(catalog, /payment-bank-mark--bcr">BCR/);
  assert.match(catalog, /Cualquier banco de Costa Rica/);
});
