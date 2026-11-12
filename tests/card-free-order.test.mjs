// A card order a 100%-off code fully covers has nothing to charge.
//
// It used to reach the card route, be refused ("no usable stored USD total"),
// and sit as "Pending - Card" forever: the customer saw "payment did not go
// through", never reached the thank-you page, and no conversion could fire.
// These tests run the real route with a fake gateway and database.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { classifyPaymentOutcome, declineReasonFrom, gatewayStatusToOrderStatus, ORDER_STATUS } from '../src/lib/paymentOutcome.mjs';
import { cardCheckoutMessage } from '../src/lib/cardCheckoutMessages.mjs';
import { isFreeCardOrder, hasNothingToPay } from '../src/lib/freeOrder.mjs';
import { withPaymentStatusActivity } from '../src/lib/paymentStatusActivity.mjs';
import { normalizeChargxPaymentType, gatewayLabelForPaymentType } from '../src/lib/chargxPay.mjs';

const person = {
  customer_name: 'Test Buyer', customer_phone: '+50688888888',
  customer_email: 'buyer@example.com', shipping_address: 'Calle 1, San Jose',
};
const freeRow = { id: 'id1', order_number: 'CARD-T1', payment_method: 'card', status: 'Processing - Card', items: [], total_usd: 0, total_crc: 0, currency: 'CRC', promo_code: 'FREE100', ...person };

function loadRoute() {
  const calls = { gateway: [], released: [], updates: [], notes: [], inventory: [], emails: [], after: [] };
  let row = freeRow;
  const supabase = {
    from(table) {
      if (table === 'admin_notifications') return { insert: async (note) => { calls.notes.push(note); return { error: null }; } };
      return {
        update(patch) { calls.updates.push(patch); return { eq: async () => ({ error: null }) }; },
        select() { return { eq() { return { maybeSingle: async () => ({ data: { ...row, status: calls.updates.at(-1)?.status ?? row.status } }) }; } }; },
      };
    },
  };
  class RequestBodyError extends Error {}
  const deps = {
    NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
    after: (fn) => calls.after.push(fn),
    getSupabaseAdmin: () => supabase,
    isChargxConfigured: () => true,
    createChargxCardCheckout: async (args) => { calls.gateway.push(args); return { id: 'tx1', status: 'Redirect', redirect_url: 'https://pay.test/x' }; },
    withChargxCheckoutDetails: (url) => url,
    normalizeChargxPaymentType,
    gatewayLabelForPaymentType,
    claimOrderForPayment: async () => ({ claimed: true, order: row }),
    releaseOrderClaim: async (_s, number) => { calls.released.push(number); },
    describeOrderPaymentState: async () => 'processing',
    classifyPaymentOutcome, declineReasonFrom, gatewayStatusToOrderStatus, ORDER_STATUS,
    sendPaymentResultEmails: async (_b, order, number, opts) => { calls.emails.push({ status: order.status, number, opts }); return { sent: true }; },
    sendAdminOrderEmail: async () => {},
    cardCheckoutMessage,
    areCardPaymentsPaused: () => false,
    markActiveAbandonedCartsConvertedForOrder: async () => ({ error: null }),
    getPublicSiteUrl: () => 'https://test.invalid',
    sendCustomerOrderConfirmation: async () => {},
    parseBillingAddress: () => ({}),
    withPaymentStatusActivity,
    reservePaidOrderInventory: async (_s, order) => { calls.inventory.push(order.order_number); },
    verifyCardCheckoutToken: (token) => (token === 'ok' ? { orderId: 'id1' } : null),
    consumeDurableRateLimit: async () => ({ allowed: true }),
    getRequestIp: () => '203.0.113.9',
    isTrustedStorefrontRequest: () => true,
    rateLimitHeaders: () => ({}),
    readLimitedJson: async (req) => ({ body: req.body }),
    RequestBodyError,
    isFreeCardOrder,
  };
  const source = fs.readFileSync(new URL('../src/app/api/chargx/process-card/route.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '')
    .replace(/^export const /gm, 'const ')
    .replace('export async function POST', 'async function POST');
  const POST = new Function(...Object.keys(deps), `${source}; return POST;`)(...Object.values(deps));
  return { POST, calls, setRow: (next) => { row = next; } };
}
const request = (amount) => ({ body: { amount, currency: 'USD', orderNumber: 'CARD-T1', paymentToken: 'ok', lang: 'en' } });

test('a $0 card order skips the gateway, is marked Paid and is settled like any paid order', async () => {
  const { POST, calls } = loadRoute();
  const res = await POST(request(0));
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.orderStatus, 'Paid');
  assert.equal(calls.gateway.length, 0, 'nothing is charged');
  assert.equal(calls.updates[0].status, 'Paid');
  assert.equal(calls.updates[0].payment_transaction_id, null);
  assert.match(calls.updates[0].payment_descriptor, /No charge/);
  assert.deepEqual(calls.inventory, ['CARD-T1']);
  assert.equal(calls.emails.length, 1);
  assert.equal(calls.emails[0].opts.firstTeamAlert, true);
  assert.equal(calls.after.length, 1, 'the customer confirmation is queued');
  assert.match(calls.notes[0].title, /^Free order confirmed/);
  assert.doesNotMatch(calls.notes[0].body, /Chargex/);
  assert.deepEqual(calls.released, []);
});

test('a $0 total with no promo code behind it is still refused and releases its lock', async () => {
  const { POST, calls, setRow } = loadRoute();
  setRow({ ...freeRow, promo_code: null });
  const res = await POST(request(0));
  assert.equal(res.status, 400);
  assert.equal(calls.gateway.length, 0);
  assert.deepEqual(calls.released, ['CARD-T1']);
  assert.equal(calls.updates.length, 0, 'never marked Paid');
});

test('a row with no totals is not free, whatever the request says', async () => {
  for (const totals of [{ total_usd: null, total_crc: null }, { total_usd: 0, total_crc: null }, { total_usd: '', total_crc: '' }, { total_usd: 0, total_crc: 500 }]) {
    const { POST, calls, setRow } = loadRoute();
    setRow({ ...freeRow, ...totals });
    const res = await POST(request(0));
    assert.equal(res.status, 400, JSON.stringify(totals));
    assert.equal(calls.updates.length, 0);
    assert.equal(calls.gateway.length, 0);
  }
});

test('posting $0 for a real order still charges the stored total, never the posted one', async () => {
  const { POST, calls, setRow } = loadRoute();
  setRow({ ...freeRow, total_usd: 50, total_crc: 25000, promo_code: 'TEN' });
  const res = await POST(request(0));
  assert.equal(calls.gateway.length, 1);
  assert.equal(calls.gateway[0].amount, '50.00');
  assert.equal(res.body.orderStatus, 'Pending - Card 3DS');
  assert.notEqual(calls.updates[0].status, 'Paid');
});

test('an ACH or crypto request opens that Chargex page; anything else stays a card', async () => {
  for (const [sent, expected] of [['ach', 'ach'], ['crypto', 'crypto'], ['card', 'card'], [undefined, 'card'], ['paypal', 'card']]) {
    const { POST, calls, setRow } = loadRoute();
    setRow({ ...freeRow, total_usd: 50, total_crc: 25000, promo_code: null });
    const res = await POST({ body: { amount: 50, currency: 'USD', orderNumber: 'CARD-T1', paymentToken: 'ok', lang: 'en', payType: sent } });
    assert.equal(calls.gateway.length, 1, String(sent));
    assert.equal(calls.gateway[0].type, expected, String(sent));
    assert.match(calls.gateway[0].successUrl, new RegExp(`payment=${expected}$`), String(sent));
    assert.equal(res.body.orderStatus, 'Pending - Card 3DS', String(sent));
  }
});

test('only a real zero with a code is free', () => {
  assert.equal(isFreeCardOrder({ total_usd: 0, total_crc: 0, promo_code: 'X' }), true);
  assert.equal(isFreeCardOrder({ total_usd: '0', total_crc: '0', promo_code: ' X ' }), true);
  assert.equal(isFreeCardOrder({ total_usd: 0, total_crc: 0, promo_code: '' }), false);
  assert.equal(isFreeCardOrder({ total_usd: 0, total_crc: 0 }), false);
  assert.equal(isFreeCardOrder({ total_usd: null, total_crc: null, promo_code: 'X' }), false);
  assert.equal(hasNothingToPay({ total_usd: 0.4, total_crc: 0 }), false);
  assert.equal(hasNothingToPay(undefined), false);
});

test('the claim returns the promo code the free-order rule needs', () => {
  assert.match(fs.readFileSync(new URL('../src/lib/cardPaymentLock.js', import.meta.url), 'utf8'), /\.select\('[^']*promo_code[^']*'\)/);
});

test('the thank-you page keeps the card-statement note off a $0 order', () => {
  assert.match(fs.readFileSync(new URL('../src/app/thank-you/page.js', import.meta.url), 'utf8'), /setPaidByCard\(result\.event\.payment_type === 'card' && Number\(result\.event\.ecommerce\?\.value\) \+ Number\(result\.event\.ecommerce\?\.shipping \|\| 0\) > 0\)/);
});
