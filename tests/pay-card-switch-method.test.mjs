import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bankPaymentSnapshot } from '../src/lib/bankPayments.mjs';
import { isAwaitingPayment } from '../src/lib/orderAwaitingPayment.mjs';

const route = fs.readFileSync('src/app/api/card-payment-link/switch-to-bank/route.js', 'utf8');
const page = fs.readFileSync('src/app/pay-card/page.js', 'utf8');

test('the card page offers the other ways to pay the same order', () => {
  // The dead end this fixes: one button, and a customer who wanted SINPE or a
  // transfer could only go back and order again (18 Nov 2026).
  assert.match(page, /Or pay another way — your order is saved/);
  assert.match(page, /O pague de otra forma — su pedido está guardado/);
  // It lives inside the payment panel, under the Pay button. Below the
  // notices it was off the screen, and nobody scrolls for a payment method
  // (Omer, 18 Nov 2026).
  const form = page.slice(page.indexOf('card-pay-panel card-pay-form'), page.indexOf('</form>'));
  assert.ok(form.includes('card-pay-switch'), 'the choice is inside the payment panel');
  assert.ok(form.indexOf('card-pay-switch') > form.indexOf('type="submit"'), 'under the pay button');
  assert.match(page, /switchToBank\('sinpe'\)/);
  assert.match(page, /switchToBank\('bank_transfer'\)/);
  // Only the methods staff have switched on, as on the checkout's own tiles.
  assert.match(page, /bankMethods\.sinpe && \(/);
  assert.match(page, /bankMethods\.bank_transfer && \(/);
  assert.match(page, /fetch\('\/api\/bank-payments\/settings'\)/);
  // A way out that never depends on a bank method being on.
  assert.match(page, /I would like to pay by another method/);
});

test('the page names the store that will actually take the payment', () => {
  // Card went to Givver on 12 Nov 2026 while this page still said "Chargex"
  // in five places (Omer, 18 Nov 2026). The server decides the gateway
  // (CARD_GATEWAY / ACH_GATEWAY), so the server has to name it.
  const orderRoute = fs.readFileSync('src/app/api/card-payment-link/order/route.js', 'utf8');
  assert.match(orderRoute, /gatewayLabel: gatewayLabelForPaymentType\(payType\)/);
  assert.match(page, /type: payType/);
  assert.match(page, /const processor = gatewayLabel \|\|/);
  // Nothing customer-facing may hard-code a brand again.
  const render = page.slice(page.indexOf('card-pay-panel card-pay-form') - 8000);
  assert.doesNotMatch(render, /Chargex/, 'no hard-coded processor name in the page the customer reads');
  // Bank (ACH) is the same page pointed at the gateway's ACH form.
  assert.match(page, /type=ach/);
});

test('switching keeps the order and carries the bank token in the hash', () => {
  assert.match(page, /fetch\('\/api\/card-payment-link\/switch-to-bank'/);
  assert.match(page, /body: JSON\.stringify\(\{ order: orderNumber, token, method \}\)/);
  // The bank link puts its token after the #, so it stays out of server logs —
  // the same shape checkout's own bank orders use.
  assert.match(page, /\/pay-bank\?lang=\$\{isEn \? 'en' : 'es'\}#\$\{encodeURIComponent\(data\.bankPaymentToken\)\}/);
});

test('the switch route proves ownership and refuses anything but an unpaid order', () => {
  // The signed card link is the proof: the same token the page loaded with.
  assert.match(route, /verifyCardPaymentAccessToken\(orderNumber, token\)/);
  assert.match(route, /cardPaymentAccessMatchesOrder\(access, order\)/);
  // Paid, refused, and mid-charge orders ('Processing - Card', written by the
  // card lock) all fail this, so a switch cannot race a charge.
  assert.match(route, /if \(!isAwaitingPayment\(order\.status\)\)/);
  assert.equal(isAwaitingPayment('Processing - Card'), false);
  assert.equal(isAwaitingPayment('Paid'), false);
  assert.equal(isAwaitingPayment('Pending - Card'), true);
  // Only a method staff have switched on.
  assert.match(route, /if \(!isBankMethod\(method\)\)/);
  assert.match(route, /if \(!bankAvailability\(settings\)\[method\]\)/);
});

test('the switch writes the same instructions checkout writes, and cannot overwrite a paid order', () => {
  assert.match(route, /type: 'bank_payment_instructions'/);
  assert.match(route, /type: 'payment_method_changed'/);
  // Compare-and-swap on what it read: if the webhook marked the order paid in
  // between, the update matches no row and the customer is told to refresh.
  assert.match(route, /\.eq\('status', order\.status\)\s*\n\s*\.eq\('payment_method', order\.payment_method\)/);
  assert.match(route, /createBankPaymentToken\(String\(order\.id\)\)/);
});

test('a switched order is told to pay its own total, to its own reference', () => {
  const settings = {
    recipient: 'Example SA', legalId: '123', sinpePhone: '88888888',
    ibanCrc: 'CR15010200009745624493', accountCrc: '974562449',
    ibanUsd: 'CR14010200009745624317', accountUsd: '974562431',
  };
  const order = { order_number: 'W-TEST', currency: 'CRC', total_crc: 51200, total_usd: 100 };
  const sinpe = bankPaymentSnapshot(settings, { ...order, payment_method: 'sinpe' });
  assert.deepEqual(
    [sinpe.method, sinpe.currency, sinpe.amount, sinpe.destination, sinpe.reference],
    ['sinpe', 'CRC', 51200, '88888888', 'W-TEST'],
  );
  const transfer = bankPaymentSnapshot(settings, { ...order, payment_method: 'bank_transfer' });
  assert.deepEqual(
    [transfer.method, transfer.currency, transfer.amount, transfer.destination],
    ['bank_transfer', 'CRC', 51200, 'CR15010200009745624493'],
  );
});
