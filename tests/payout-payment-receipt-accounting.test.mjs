import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildTaxRecordsPaymentReceiptCopy,
  sendTaxRecordsPaymentReceipt,
  taxRecordsRecipients,
} from '../src/lib/taxRecordsEmail.mjs';

const payout = {
  kind: 'pago mensual',
  name: 'Ziggy Myrie',
  email: 'ziggy.myrie.s@gmail.com',
  period: 'Oct 1 – Oct 31, 2026',
  usd: 0.8,
  crc: 400000,
};
const payment = {
  method: 'SINPE',
  reference: 'REF-<123>',
  receiptUrl: 'https://example.test/receipt.png',
  paidAt: '2026-11-02T20:00:00.000Z',
  recordedBy: 'info@peptidescostarica.net',
};

test('the payment receipt goes to the accounting address and names payee, amount, method and reference', () => {
  const message = buildTaxRecordsPaymentReceiptCopy({ payout, payment });

  assert.equal(message.to, taxRecordsRecipients().join(', '));
  assert.match(message.to, /pbagcr@peptidescostarica\.net/);
  assert.match(message.subject, /Comprobante de pago/);
  assert.match(message.subject, /Ziggy Myrie/);
  assert.match(message.text, /₡400,000/);
  assert.match(message.text, /SINPE/);
  assert.match(message.text, /REF-<123>/);
  assert.match(message.text, /https:\/\/example\.test\/receipt\.png/);
  // Costa Rica clock, not the server's.
  assert.match(message.text, /02\/11\/2026, 14:00 \(CR\)/);
});

test('the receipt escapes what the admin typed and never carries a non-http link', () => {
  const message = buildTaxRecordsPaymentReceiptCopy({
    payout,
    payment: { ...payment, reference: '<script>x</script>', receiptUrl: 'javascript:alert(1)' },
  });

  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /&lt;script&gt;/);
  assert.doesNotMatch(message.html, /javascript:/);
  assert.doesNotMatch(message.text, /javascript:/);
});

test('the receipt is sent through the accounting transport and never reaches the payee', async () => {
  const sent = [];
  const result = await sendTaxRecordsPaymentReceipt({
    transporter: { sendMail: async (m) => { sent.push(m); return { messageId: 'r-1' }; } },
    from: 'Records <records@example.test>',
    payout,
    payment,
  });

  assert.equal(result.sent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, taxRecordsRecipients().join(', '));
  assert.equal(sent[0].cc, undefined);
  assert.equal(sent[0].bcc, undefined);
  assert.doesNotMatch(sent[0].to, /ziggy/i);
});

test('a refused or missing accounting mailbox is reported, never thrown', async () => {
  const none = await sendTaxRecordsPaymentReceipt({ transporter: null, payout, payment });
  assert.equal(none.sent, false);
  assert.equal(none.error, 'no transporter');

  const primary = taxRecordsRecipients()[0];
  const refused = await sendTaxRecordsPaymentReceipt({
    transporter: { sendMail: async () => ({ messageId: 'x', rejected: [primary] }) },
    from: 'Records <records@example.test>',
    payout,
    payment,
  });
  assert.equal(refused.sent, false);
  assert.match(refused.error, /refused/);
});

test('both settle routes email the accountant only once the payout is saved as Paid', () => {
  for (const path of [
    'src/app/api/admin/commissions/settle/route.js',
    'src/app/api/admin/affiliates/payouts/settle/route.js',
  ]) {
    const route = fs.readFileSync(path, 'utf8');
    const save = route.indexOf('.update(plan.patch)');
    const send = route.indexOf('sendTaxRecordsPaymentReceipt(');
    const gate = route.indexOf("data.status === 'Paid'");

    assert.ok(save > -1 && send > -1 && gate > -1, `${path} is missing a piece`);
    assert.ok(save < gate && gate < send, `${path} must save first, then check Paid, then send`);
    assert.match(route, /resolveTaxRecordsMailer\(/);
    assert.match(route, /accountingCopy/);
    // Accounting's mailbox only: the payee is never mailed from a settle route.
    assert.doesNotMatch(route, /nodemailer/);
  }
});

test('the settlement dialog tells the admin whether accounting got the receipt', () => {
  const dialog = fs.readFileSync('src/components/admin/PayoutSettlementDialog.js', 'utf8');
  assert.match(dialog, /data\.accountingCopy/);
  assert.match(dialog, /did NOT reach the accountant/);
});
