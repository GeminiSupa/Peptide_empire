import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderPaidWebhookPayload, fireOrderPaidWebhook } from '../src/lib/orderPaidWebhook.mjs';

// The outbound "order paid" webhook must fire exactly once — on the real move
// into paid — and never break a payment confirmation when the receiver is down
// or no URL is configured.

const paidOrder = {
  id: 42,
  order_number: 'W-ABC123',
  status: 'Paid',
  landing_ref: 'glptz_fb_oct',
  total_usd: 90.57,
  total_crc: 46000,
  currency: 'CRC',
};

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return (async () => {
    try { return await fn(); }
    finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  })();
}

test('payload carries the agreed fields', () => {
  const payload = buildOrderPaidWebhookPayload(paidOrder);
  assert.equal(payload.event, 'order.paid');
  assert.equal(payload.status, 'Paid');
  assert.equal(payload.orderId, '42');
  assert.equal(payload.orderNumber, 'W-ABC123');
  assert.equal(payload.ref, 'glptz_fb_oct');
  assert.equal(payload.amount.usd, 90.57);
  assert.equal(payload.amount.crc, 46000);
  assert.equal(payload.amount.currency, 'CRC');
  assert.equal(typeof payload.paidAt, 'string');
});

test('ref is null for an organic order', () => {
  const payload = buildOrderPaidWebhookPayload({ ...paidOrder, landing_ref: null });
  assert.equal(payload.ref, null);
});

test('fires on the unpaid -> paid transition', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook', ORDER_WEBHOOK_SECRET: 's3cret' }, async () => {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200 }; };
    try {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Pending - Card' });
      assert.deepEqual(result, { fired: true, ok: true });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://example.test/hook');
      assert.equal(calls[0].opts.headers['X-Webhook-Secret'], 's3cret');
      const body = JSON.parse(calls[0].opts.body);
      assert.equal(body.ref, 'glptz_fb_oct');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('does NOT fire when the order was already paid', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    let called = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { called = true; return { ok: true, status: 200 }; };
    try {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Paid' });
      assert.equal(result.fired, false);
      assert.equal(result.reason, 'not_paid_transition');
      assert.equal(called, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('does nothing (no throw) when no URL is configured', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: undefined }, async () => {
    let called = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { called = true; return { ok: true, status: 200 }; };
    try {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Pending' });
      assert.equal(result.fired, false);
      assert.equal(result.reason, 'not_configured');
      assert.equal(called, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('a receiver error is swallowed, never thrown', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('connection refused'); };
    try {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Pending' });
      assert.equal(result.fired, false);
      assert.equal(result.error, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('a fresh order born paid (no previous status) fires once', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { calls += 1; return { ok: true, status: 200 }; };
    try {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: null });
      assert.equal(result.fired, true);
      assert.equal(calls, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
