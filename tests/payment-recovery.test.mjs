import test from 'node:test';
import assert from 'node:assert/strict';

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
