import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

import fs from 'node:fs';
import {
  createChargxCardCheckout,
  normalizeChargxPaymentType,
  opaqueDataFromTokenResponse,
  transactionFromChargxResponse,
  verifyChargxWebhookSignature,
  withChargxCheckoutDetails,
} from '../src/lib/chargxPay.mjs';

test('a descriptor token is passed through and a bare token is wrapped', () => {
  assert.deepEqual(
    opaqueDataFromTokenResponse({
      opaqueData: { dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT', dataValue: 'abc' },
    }),
    { dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT', dataValue: 'abc' },
  );
  assert.deepEqual(opaqueDataFromTokenResponse({ token: 'tok_1' }), { token: 'tok_1' });
});

test('a tokenize error is raised without echoing the card', () => {
  assert.throws(
    () => opaqueDataFromTokenResponse({
      messages: { resultCode: 'Error', message: [{ text: 'The card number is invalid.' }] },
    }),
    /card number is invalid/,
  );
});

test('an Ok charge with their order id is an approval', () => {
  const txn = transactionFromChargxResponse({
    message: 'Ok',
    result: { orderId: 'order_01ABC', orderDisplayId: '79' },
  }, true);
  assert.equal(txn.status, 'Approved');
  assert.equal(txn.id, 'order_01ABC');
  assert.equal(txn.authorization, '79');
});

test('a decline body stays a decline even when HTTP is not ok', () => {
  const txn = transactionFromChargxResponse({
    message: 'Error creating transaction',
    error: [{ errorCode: '44', errorText: 'This transaction has been declined.' }],
  }, false);
  assert.equal(txn.status, 'Declined');
  assert.equal(txn.error.message, 'This transaction has been declined.');
});

test('an Ok body with no transaction id is not treated as paid', () => {
  assert.equal(transactionFromChargxResponse({ message: 'Ok', result: {} }, true), null);
});

test('the Chargex page link carries our order number', () => {
  const url = withChargxCheckoutDetails('https://dashboard.chargx.io/payment-form/abc', {
    orderNumber: 'CARD-1',
    email: 'buyer@example.com',
    billing: { address: 'Calle 1', city: 'San Jose', state: 'San Jose', postal_code: '10101', country: 'CR' },
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('external_order_id'), 'CARD-1');
  assert.equal(parsed.searchParams.get('country'), 'CR');
  assert.equal(parsed.searchParams.get('email'), 'buyer@example.com');
});

test('webhook signatures accept the v1= prefix and reject a tampered body', () => {
  const secret = 'whsec_test';
  const rawBody = '{"type":"payment.succeeded"}';
  const timestamp = '1710000000';
  const hex = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  assert.equal(verifyChargxWebhookSignature({
    secret, timestamp, signatureHeader: `v1=${hex}`, rawBody,
  }), true);
  assert.equal(verifyChargxWebhookSignature({
    secret, timestamp, signatureHeader: `v1=${hex}`, rawBody: `${rawBody} `,
  }), false);
});

// ---------------------------------------------------------------------------
// ACH and crypto ride the same hosted page as cards; only `type` changes.
// ---------------------------------------------------------------------------

test('only card, ach and crypto are accepted; anything else is a card', () => {
  assert.equal(normalizeChargxPaymentType('ach'), 'ach');
  assert.equal(normalizeChargxPaymentType(' CRYPTO '), 'crypto');
  assert.equal(normalizeChargxPaymentType('card'), 'card');
  assert.equal(normalizeChargxPaymentType('paypal'), 'card');
  assert.equal(normalizeChargxPaymentType(undefined), 'card');
});

async function sentTypeFor(type) {
  const realFetch = globalThis.fetch;
  const previousKey = process.env.CHARGX_PUBLISHABLE_API_KEY;
  process.env.CHARGX_PUBLISHABLE_API_KEY = 'pk_test_not_real';
  let sentBody = null;
  globalThis.fetch = async (_url, init) => {
    sentBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      payment_request: { id: 'pr_1', checkout_url: 'https://dashboard.chargx.io/payment-form/pr_1', isProduction: true },
    }), { status: 200 });
  };
  try {
    const page = await createChargxCardCheckout({
      amount: 50, successUrl: 'https://example.com/ok', ...(type === undefined ? {} : { type }),
    });
    return { sentBody, page };
  } finally {
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.CHARGX_PUBLISHABLE_API_KEY;
    else process.env.CHARGX_PUBLISHABLE_API_KEY = previousKey;
  }
}

test('the payment request carries the chosen type, and defaults to card', async () => {
  assert.equal((await sentTypeFor('ach')).sentBody.type, 'ach');
  assert.equal((await sentTypeFor('crypto')).sentBody.type, 'crypto');
  assert.equal((await sentTypeFor(undefined)).sentBody.type, 'card');
  assert.equal((await sentTypeFor('bitcoin-atm')).sentBody.type, 'card');
  assert.equal((await sentTypeFor('ach')).page.payment_type, 'ach');
});

test('the storefront offers ACH and crypto, and the server passes the type on', () => {
  const catalog = fs.readFileSync('src/app/catalog/page.js', 'utf8');
  const route = fs.readFileSync('src/app/api/chargx/process-card/route.js', 'utf8');
  assert.match(catalog, /value: 'ach'/);
  assert.match(catalog, /value: 'crypto'/);
  assert.match(catalog, /payType: chargxPayType/);
  // Enter in a form field must not fall through to the manual-order path.
  assert.match(catalog, /paymentMethod === 'card' \|\| paymentMethod === 'ach' \|\| paymentMethod === 'crypto'\) \{\s*\/\/ Card, ACH and crypto/);
  assert.match(route, /normalizeChargxPaymentType\(body\?\.payType\)/);
  assert.match(route, /type: payType/);
  // The order is still saved as a card order, so no other path changes.
  assert.match(catalog, /payment_method: 'card',\s*status: 'Pending - Card'/);
});
