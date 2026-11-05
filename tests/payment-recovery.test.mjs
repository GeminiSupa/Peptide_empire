import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildPaymentRecoveryPath, isPaymentRecoveryPending, paymentRecoveryKind } from '../src/lib/paymentRecovery.mjs';

test('payment recovery distinguishes declines from incomplete 3DS', () => {
  assert.equal(paymentRecoveryKind('Pending - Card 3DS'), '3ds');
  assert.equal(paymentRecoveryKind('Declined'), 'declined');
  assert.equal(buildPaymentRecoveryPath('CARD-123', 'Pending - Card 3DS'), '/payment-help?order=CARD-123&reason=3ds');
});

test('only recoverable unpaid card states receive reminders', () => {
  assert.equal(isPaymentRecoveryPending('Declined'), true);
  assert.equal(isPaymentRecoveryPending('Pending - Card 3DS'), true);
  assert.equal(isPaymentRecoveryPending('Paid'), false);
});

test('hosted card payment leaves recovery instructions open in the original tab', () => {
  const catalog = fs.readFileSync('src/app/catalog/page.js', 'utf8');
  const paymentLink = fs.readFileSync('src/app/pay-card/page.js', 'utf8');
  const processRoute = fs.readFileSync('src/app/api/chargx/process-card/route.js', 'utf8');
  const paymentLinkRoute = fs.readFileSync('src/app/api/card-payment-link/pay/route.js', 'utf8');

  for (const source of [catalog, paymentLink]) {
    assert.match(source, /window\.open\('', '_blank'\)/);
    assert.match(source, /hostedPaymentWindow\.location\.href = data\.paymentUrl/);
    assert.match(source, /window\.location\.href = data\.recoveryUrl/);
  }
  for (const source of [processRoute, paymentLinkRoute]) {
    const redirectReply = source.slice(source.indexOf('paymentUrl: transaction.redirect_url'));
    assert.match(redirectReply, /recoveryUrl:/);
  }
});
