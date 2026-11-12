import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { test } from 'node:test';
import {
  createChargxCardCheckout,
  gatewayForWebhookSignature,
  gatewayIdForPaymentType,
  gatewayLabelForPaymentType,
  isChargxConfigured,
  isGatewayConfigured,
  webhookGatewayIds,
} from '../src/lib/chargxPay.mjs';

// Nov 2026: card and crypto moved to Givver (11% instead of 12%), bank
// transfer stayed on Chargex because Givver has not turned ACH on. Both
// gateways are live at once, each with its own keys and its own webhook, and
// the payment type the customer picked is what decides where they are sent.

const ENV_KEYS = [
  'CARD_GATEWAY', 'ACH_GATEWAY',
  'CHARGX_PUBLISHABLE_API_KEY', 'CHARGX_WEBHOOK_SECRET',
  'GIVVER_PUBLISHABLE_API_KEY', 'GIVVER_WEBHOOK_SECRET',
  'GIVVER_API_BASE_URL', 'CHARGX_API_BASE_URL',
];

function withEnv(values, run) {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  try {
    return run();
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('card and crypto follow CARD_GATEWAY, bank transfer follows ACH_GATEWAY', () => {
  withEnv({ CARD_GATEWAY: 'givver', ACH_GATEWAY: 'chargx' }, () => {
    assert.equal(gatewayIdForPaymentType('card'), 'givver');
    assert.equal(gatewayIdForPaymentType('crypto'), 'givver');
    assert.equal(gatewayIdForPaymentType('ach'), 'chargx');
    assert.equal(gatewayLabelForPaymentType('card'), 'Givver');
    assert.equal(gatewayLabelForPaymentType('ach'), 'Chargex');
  });
});

test('dropping ACH_GATEWAY sends bank transfer to the card gateway too', () => {
  // This is the one change to make the day Givver turns ACH on.
  withEnv({ CARD_GATEWAY: 'givver' }, () => {
    assert.equal(gatewayIdForPaymentType('ach'), 'givver');
  });
});

test('with neither variable set, every payment stays on Chargex', () => {
  withEnv({}, () => {
    for (const type of ['card', 'ach', 'crypto', 'nonsense', undefined]) {
      assert.equal(gatewayIdForPaymentType(type), 'chargx', String(type));
    }
  });
});

test('a misspelled gateway name falls back to Chargex, never to nothing', () => {
  withEnv({ CARD_GATEWAY: 'giver', ACH_GATEWAY: '' }, () => {
    assert.equal(gatewayIdForPaymentType('card'), 'chargx');
    assert.equal(gatewayIdForPaymentType('ach'), 'chargx');
  });
});

test('"is it configured" asks the gateway that type is pointed at', () => {
  withEnv({ CARD_GATEWAY: 'givver', ACH_GATEWAY: 'chargx', CHARGX_PUBLISHABLE_API_KEY: 'pk_chargx' }, () => {
    // Givver has no key yet: cards are not payable, ACH still is.
    assert.equal(isChargxConfigured('live', 'card'), false);
    assert.equal(isChargxConfigured('live', 'ach'), true);
    // And the admin sandbox tool always means the Chargex store.
    assert.equal(isGatewayConfigured('chargx', 'live'), true);
    assert.equal(isGatewayConfigured('givver', 'live'), false);
  });
});

async function checkoutCallFor(type) {
  const realFetch = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (url, init) => {
    sent = { url: String(url), key: init.headers['x-publishable-api-key'], body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      payment_request: { id: 'pr_1', checkout_url: 'https://dashboard.givver.cards/payment-form/pr_1', isProduction: true },
    }), { status: 200 });
  };
  try {
    const page = await createChargxCardCheckout({ amount: 50, successUrl: 'https://example.com/ok', type }, { mode: 'live' });
    return { sent, page };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('the payment page is created on the right store, with that store’s key', async () => {
  const env = {
    CARD_GATEWAY: 'givver',
    ACH_GATEWAY: 'chargx',
    GIVVER_PUBLISHABLE_API_KEY: 'pk_givver_not_real',
    CHARGX_PUBLISHABLE_API_KEY: 'pk_chargx_not_real',
  };
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  try {
    const card = await checkoutCallFor('card');
    assert.equal(card.sent.url, 'https://api.givver.cards/v1/payment-request');
    assert.equal(card.sent.key, 'pk_givver_not_real');
    assert.equal(card.sent.body.type, 'card');
    assert.equal(card.page.gateway, 'givver');
    assert.equal(card.page.gateway_label, 'Givver');

    const crypto_ = await checkoutCallFor('crypto');
    assert.equal(crypto_.sent.url, 'https://api.givver.cards/v1/payment-request');
    assert.equal(crypto_.sent.body.type, 'crypto');

    const ach = await checkoutCallFor('ach');
    assert.equal(ach.sent.url, 'https://api.chargx.io/v1/payment-request');
    assert.equal(ach.sent.key, 'pk_chargx_not_real');
    assert.equal(ach.sent.body.type, 'ach');
    assert.equal(ach.page.gateway_label, 'Chargex');
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

function sign(secret, timestamp, rawBody) {
  return `v1=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

test('the webhook handler recognises whichever gateway signed it', () => {
  const rawBody = JSON.stringify({ type: 'payment.succeeded', data: { object: { external_order_id: 'W-1' } } });
  const timestamp = '1794400000';
  withEnv({ CHARGX_WEBHOOK_SECRET: 'chargx_secret', GIVVER_WEBHOOK_SECRET: 'givver_secret' }, () => {
    assert.deepEqual(webhookGatewayIds(), ['chargx', 'givver']);
    assert.equal(gatewayForWebhookSignature({
      timestamp, signatureHeader: sign('givver_secret', timestamp, rawBody), rawBody,
    })?.label, 'Givver');
    assert.equal(gatewayForWebhookSignature({
      timestamp, signatureHeader: sign('chargx_secret', timestamp, rawBody), rawBody,
    })?.label, 'Chargex');
    // A signature from neither secret is nobody, and the route answers 400.
    assert.equal(gatewayForWebhookSignature({
      timestamp, signatureHeader: sign('stolen_secret', timestamp, rawBody), rawBody,
    }), null);
  });
});

test('a gateway with no secret set cannot sign anything', () => {
  const rawBody = '{}';
  const timestamp = '1794400000';
  withEnv({ CHARGX_WEBHOOK_SECRET: 'chargx_secret' }, () => {
    assert.deepEqual(webhookGatewayIds(), ['chargx']);
    assert.equal(gatewayForWebhookSignature({
      timestamp, signatureHeader: sign('givver_secret', timestamp, rawBody), rawBody,
    }), null);
  });
});

test('both gateway webhook URLs end in the one handler', () => {
  // Two handlers would mean two order updates, two stock deductions and two
  // receipts for one payment.
  const givver = fs.readFileSync('src/app/api/givver/webhook/route.js', 'utf8');
  assert.match(givver, /export \{ POST \} from '\.\.\/\.\.\/chargx\/webhook\/route'/);
});

test('the storefront charge route checks the gateway for the chosen type', () => {
  const route = fs.readFileSync('src/app/api/chargx/process-card/route.js', 'utf8');
  const link = fs.readFileSync('src/app/api/card-payment-link/pay/route.js', 'utf8');
  for (const source of [route, link]) {
    assert.match(source, /isChargxConfigured\('live', payType\)/);
    assert.match(source, /gatewayLabelForPaymentType\(payType\)/);
    // The order records which store took it, for refunds and reconciliation.
    assert.match(source, /descriptor_text: page\.gateway_label \|\| 'Chargex'/);
  }
});
