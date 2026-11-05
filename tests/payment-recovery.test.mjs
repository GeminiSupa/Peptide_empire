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

test('15-minute email covers orders placed between 15 minutes and 2 hours ago', async () => {
  const { paymentRecoveryFollowUpWindow, PAYMENT_RECOVERY_FOLLOW_UP_STATUSES } = await import('../src/lib/paymentRecovery.mjs');
  const now = Date.parse('2026-11-05T12:00:00.000Z');
  const window = paymentRecoveryFollowUpWindow(now);
  assert.equal(window.placedBefore, '2026-11-05T11:45:00.000Z');
  assert.equal(window.placedAfter, '2026-11-05T10:00:00.000Z');
  // A plain decline already got its "payment declined" email on the spot.
  assert.deepEqual(PAYMENT_RECOVERY_FOLLOW_UP_STATUSES, ['Pending - Card 3DS', 'Pending - 3DS Card']);
});

async function capturedRecoveryMail(sendFn) {
  let posted = null;
  const fetchImpl = async (url, init) => {
    posted = { url, body: JSON.parse(init.body) };
    return { status: 200, json: async () => ({ results: { customerReceipt: { sent: true } } }) };
  };
  const order = {
    order_number: 'CARD-1',
    status: 'Pending - Card 3DS',
    customer_name: 'Test',
    customer_email: 'test@example.com',
    currency: 'USD',
    items: [],
    payment_method: 'Card',
  };
  const result = await sendFn('https://catalog.example', order, 'CARD-1', { fetchImpl, internalSecret: 'test-secret' });
  return { result, posted };
}

test('15-minute email reaches the mail route flagged, customer copy only', async () => {
  const { sendPaymentRecoveryFollowUpEmail } = await import('../src/lib/paymentResultEmail.mjs');
  const { result, posted } = await capturedRecoveryMail(sendPaymentRecoveryFollowUpEmail);
  assert.equal(result.sent, true);
  assert.equal(posted.url, 'https://catalog.example/api/order-notification');
  assert.equal(posted.body.isPaymentRecoveryFollowUp, true);
  assert.equal(posted.body.isPaymentRecoveryReminder, undefined);
  assert.equal(posted.body.customerReceiptOnly, true);
  assert.equal(posted.body.adminNotificationOnly, false);
  assert.match(posted.body.paymentRecoveryUrl, /\/payment-help\?order=CARD-1&reason=3ds/);
});

test('two-hour reminder keeps its "Reminder" flag on the way to the mail route', async () => {
  const { sendPaymentRecoveryReminderEmail } = await import('../src/lib/paymentResultEmail.mjs');
  const { posted } = await capturedRecoveryMail(sendPaymentRecoveryReminderEmail);
  assert.equal(posted.body.isPaymentRecoveryReminder, true);
  assert.equal(posted.body.isPaymentRecoveryFollowUp, undefined);
});

test('mail route gives the 15-minute email its own subject in both languages', () => {
  const route = fs.readFileSync('src/app/api/order-notification/route.js', 'utf8');
  assert.match(route, /order\.isPaymentRecoveryFollowUp === true/);
  assert.match(route, /Your payment has not gone through yet - Order #/);
  assert.match(route, /Su pago aún no se ha completado - Pedido #/);
});

test('recovery job sends the 15-minute email once, never to old orders, and still runs the 2-hour reminder', () => {
  const cron = fs.readFileSync('src/app/api/cron/payment-recovery/route.js', 'utf8');
  const followUp = cron.slice(cron.indexOf('paymentRecoveryFollowUpWindow()'), cron.indexOf('// 2) The two-hour reminder.'));
  assert.match(followUp, /\.in\('status', PAYMENT_RECOVERY_FOLLOW_UP_STATUSES\)/);
  assert.match(followUp, /\.is\('payment_recovery_followup_sent_at', null\)/);
  assert.match(followUp, /\.gt\('created_at', followUpWindow\.placedAfter\)/);
  assert.match(followUp, /\.lte\('created_at', followUpWindow\.placedBefore\)/);
  assert.match(followUp, /payment_recovery_followup_sent_at: new Date\(\)\.toISOString\(\)/);
  // A failed 15-minute query must not stop the 2-hour reminder.
  assert.doesNotMatch(followUp, /return NextResponse/);
  assert.ok(cron.indexOf('// 2) The two-hour reminder.') > 0);

  const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const job = vercel.crons.find((entry) => entry.path === '/api/cron/payment-recovery');
  assert.equal(job.schedule, '*/5 * * * *');
});
