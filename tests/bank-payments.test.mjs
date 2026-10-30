import test from 'node:test';
import assert from 'node:assert/strict';
import { bankAvailability, normalizeBankSettings, bankPaymentSnapshot, validCostaRicaIban } from '../src/lib/bankPayments.mjs';
import { createBankPaymentToken, verifyBankPaymentToken } from '../src/lib/bankPaymentToken.mjs';

test('bank methods remain coming soon until explicitly enabled with complete details', () => {
  assert.deepEqual(bankAvailability(), { sinpe: false, bank_transfer: false });
  const details = { recipient: 'Example SA', legalId: '3101000000', sinpePhone: '88888888', ibanCrc: 'CR05015202001026284066' };
  assert.equal(validCostaRicaIban(details.ibanCrc), true);
  assert.deepEqual(bankAvailability(details), { sinpe: false, bank_transfer: false });
  assert.deepEqual(bankAvailability({ ...details, sinpeEnabled: true, transferEnabled: true }), { sinpe: true, bank_transfer: true });
  assert.deepEqual(bankAvailability({ sinpeEnabled: true, transferEnabled: true }), { sinpe: false, bank_transfer: false });
  assert.equal(bankAvailability({ ...details, transferEnabled: true, ibanCrc: 'CR00000000000000000000' }).bank_transfer, false);
  assert.equal(normalizeBankSettings({ sinpeEnabled: 'true' }).sinpeEnabled, false);
});

test('instructions use saved authoritative CRC total and copy recipient details', () => {
  const settings = { recipient: 'Example SA', legalId: '123', sinpePhone: '+506 8888-8888' };
  const payment = bankPaymentSnapshot(settings, { payment_method: 'sinpe', total_crc: 51200, order_number: 'WPCR-TEST' });
  settings.recipient = 'Changed';
  assert.equal(payment.recipient, 'Example SA');
  assert.equal(payment.amount, 51200);
  assert.equal(payment.destination, '88888888');
  assert.equal(payment.currency, 'CRC');
  assert.throws(() => bankPaymentSnapshot(settings, { total_crc: -1 }));
});

test('bank payment links reject tampering and expire', () => {
  const previous = process.env.BANK_PAYMENT_TOKEN_SECRET;
  process.env.BANK_PAYMENT_TOKEN_SECRET = 'test-bank-only-secret';
  try {
    const token = createBankPaymentToken('order-id', 1000);
    assert.equal(verifyBankPaymentToken(token, 2000).id, 'order-id');
    assert.equal(verifyBankPaymentToken(token + 'x', 2000), null);
    assert.equal(verifyBankPaymentToken(token, 1000 + 8 * 86400000), null);
    assert.equal(verifyBankPaymentToken('invalid'), null);
  } finally {
    if (previous === undefined) delete process.env.BANK_PAYMENT_TOKEN_SECRET;
    else process.env.BANK_PAYMENT_TOKEN_SECRET = previous;
  }
});
