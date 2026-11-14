import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  buildOrderPaidWebhookPayload,
  buildOrderWebhookPayload,
  fireOrderPaidWebhook,
  fireOrderClosedWebhook,
  isPaidAdOrder,
  productSlug,
  ORDER_WEBHOOK_EVENT_CANCELLED,
  ORDER_WEBHOOK_EVENT_REFUNDED,
} from '../src/lib/orderPaidWebhook.mjs';

// The outbound order webhooks must fire exactly once — on the real move into
// paid — carry the fields the receiver agreed on, and never break a payment
// confirmation when the receiver is down, slow or refusing the body.

const paidOrder = {
  id: 42,
  order_number: 'W-ABC123',
  status: 'Paid',
  landing_ref: 'glptz_fb_oct',
  landing_cid: 'cid_abc123',
  landing_ttclid: 'E.C.P2_ABC',
  total_usd: 90.57,
  total_crc: 46000,
  currency: 'CRC',
  items: [
    { qty: 1, price: 46000, product: 'GLP-1 (RT) – Agonista Triple 15mg' },
    { qty: 1, price: 0, product: 'Agua Bacteriostática 3ml (Regalo)' },
  ],
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

function withFetch(handler, fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  return (async () => {
    try { return await fn(); }
    finally { globalThis.fetch = originalFetch; }
  })();
}

test('payload carries the agreed fields', () => {
  const payload = buildOrderPaidWebhookPayload(paidOrder);
  assert.equal(payload.event, 'order.paid');
  assert.equal(payload.status, 'Paid');
  assert.equal(payload.orderId, '42');
  assert.equal(payload.orderNumber, 'W-ABC123');
  assert.equal(payload.ref, 'glptz_fb_oct');
  assert.equal(payload.cid, 'cid_abc123');
  assert.equal(payload.ttclid, 'E.C.P2_ABC');
  assert.equal(typeof payload.paidAt, 'string');
});

test('amount is a plain number in the order currency, both currencies alongside', () => {
  const crc = buildOrderPaidWebhookPayload(paidOrder);
  assert.equal(crc.amount, 46000);
  assert.equal(crc.currency, 'CRC');
  assert.equal(crc.amountUsd, 90.57);
  assert.equal(crc.amountCrc, 46000);

  const usd = buildOrderPaidWebhookPayload({ ...paidOrder, currency: 'USD' });
  assert.equal(usd.amount, 90.57);
  assert.equal(usd.currency, 'USD');
});

test('product is the biggest real line, gifts left out', () => {
  const payload = buildOrderPaidWebhookPayload(paidOrder);
  assert.equal(payload.product, 'glp-1-rt-agonista-triple-15mg');
  assert.equal(payload.productName, 'GLP-1 (RT) – Agonista Triple 15mg');
  assert.equal(payload.products.length, 1);
  assert.equal(payload.products[0].qty, 1);
});

test('the biggest line wins, not the first one', () => {
  const payload = buildOrderPaidWebhookPayload({
    ...paidOrder,
    items: [
      { qty: 1, price: 5000, product: 'BPC-157 5mg' },
      { qty: 2, price: 46000, product: 'Tirzepatida 10mg' },
    ],
  });
  assert.equal(payload.product, 'tirzepatida-10mg');
  assert.equal(payload.products.length, 2);
});

test('product slugs are stable and URL-safe', () => {
  assert.equal(productSlug('GLP-1 (RT) – Agonista Triple 15mg'), 'glp-1-rt-agonista-triple-15mg');
  assert.equal(productSlug('Agua Bacteriostática 3ml'), 'agua-bacteriostatica-3ml');
  assert.equal(productSlug('   '), null);
  assert.equal(productSlug(null), null);
});

test('ref and click ids are null for an organic order', () => {
  const payload = buildOrderPaidWebhookPayload({
    ...paidOrder, landing_ref: null, landing_cid: null, landing_ttclid: null,
  });
  assert.equal(payload.ref, null);
  assert.equal(payload.cid, null);
  assert.equal(payload.ttclid, null);
});

test('fires on the unpaid -> paid transition, signed both ways', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook', ORDER_WEBHOOK_SECRET: 's3cret' }, async () => {
    const calls = [];
    await withFetch(async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200 }; }, async () => {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Pending - Card' });
      assert.equal(result.fired, true);
      assert.equal(result.ok, true);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://example.test/hook');
      assert.equal(calls[0].opts.headers['X-Webhook-Secret'], 's3cret');
      const expected = crypto.createHmac('sha256', 's3cret').update(calls[0].opts.body).digest('hex');
      assert.equal(calls[0].opts.headers['X-Webhook-Signature'], expected);
      const body = JSON.parse(calls[0].opts.body);
      assert.equal(body.ref, 'glptz_fb_oct');
      assert.equal(body.amount, 46000);
    });
  });
});

test('no secret, no signature headers', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook', ORDER_WEBHOOK_SECRET: undefined }, async () => {
    const calls = [];
    await withFetch(async (url, opts) => { calls.push(opts); return { ok: true, status: 200 }; }, async () => {
      await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Pending' });
      assert.equal(calls[0].headers['X-Webhook-Secret'], undefined);
      assert.equal(calls[0].headers['X-Webhook-Signature'], undefined);
    });
  });
});

test('the signature header name can be changed without a deploy', async () => {
  await withEnv({
    ORDER_WEBHOOK_URL: 'https://example.test/hook',
    ORDER_WEBHOOK_SECRET: 's3cret',
    ORDER_WEBHOOK_SIGNATURE_HEADER: 'X-Signature',
  }, async () => {
    const calls = [];
    await withFetch(async (url, opts) => { calls.push(opts); return { ok: true, status: 200 }; }, async () => {
      await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Pending' });
      assert.equal(typeof calls[0].headers['X-Signature'], 'string');
      assert.equal(calls[0].headers['X-Webhook-Signature'], undefined);
    });
  });
});

test('does NOT fire when the order was already paid', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    let called = false;
    await withFetch(async () => { called = true; return { ok: true, status: 200 }; }, async () => {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Paid' });
      assert.equal(result.fired, false);
      assert.equal(result.reason, 'not_paid_transition');
      assert.equal(called, false);
    });
  });
});

test('does nothing (no throw) when no URL is configured', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: undefined }, async () => {
    let called = false;
    await withFetch(async () => { called = true; return { ok: true, status: 200 }; }, async () => {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Pending' });
      assert.equal(result.fired, false);
      assert.equal(result.reason, 'not_configured');
      assert.equal(called, false);
    });
  });
});

test('a receiver error is retried, then swallowed — never thrown', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; throw new Error('connection refused'); }, async () => {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Pending' });
      assert.equal(result.ok, false);
      assert.equal(result.error, true);
      assert.equal(calls, 3);
    });
  });
});

test('a 5xx is retried and a later success counts', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    let calls = 0;
    await withFetch(async () => {
      calls += 1;
      return calls === 1 ? { ok: false, status: 502, text: async () => 'bad gateway' } : { ok: true, status: 200 };
    }, async () => {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Pending' });
      assert.equal(result.ok, true);
      assert.equal(result.attempts, 2);
      assert.equal(calls, 2);
    });
  });
});

test('a 422 refusal is not retried and is reported as refused', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    let calls = 0;
    await withFetch(async () => {
      calls += 1;
      return { ok: false, status: 422, text: async () => 'cid is required' };
    }, async () => {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: 'Pending' });
      assert.equal(calls, 1);
      assert.equal(result.ok, false);
      assert.equal(result.refused, true);
      assert.equal(result.status, 422);
    });
  });
});

test('a fresh order born paid (no previous status) fires once', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; return { ok: true, status: 200 }; }, async () => {
      const result = await fireOrderPaidWebhook(paidOrder, { previousStatus: null });
      assert.equal(result.fired, true);
      assert.equal(calls, 1);
    });
  });
});

test('an organic sale is not sent at all', async () => {
  // The receiver matches sales to ad clicks. A sale with no ref and no click
  // ids has nothing to match on, so it is never sent (owner, 15 Nov 2026).
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    let called = false;
    await withFetch(async () => { called = true; return { ok: true, status: 200 }; }, async () => {
      const organic = { ...paidOrder, landing_ref: null, landing_cid: null, landing_ttclid: null };
      const result = await fireOrderPaidWebhook(organic, { previousStatus: 'Pending' });
      assert.equal(result.fired, false);
      assert.equal(result.reason, 'not_an_ad_order');
      assert.equal(called, false);
    });
  });
});

test('any one of the three tags is enough to count as an ad order', () => {
  assert.equal(isPaidAdOrder({ landing_ref: 'tiktok-glp1-a' }), true);
  assert.equal(isPaidAdOrder({ landing_cid: 'abc123' }), true);
  assert.equal(isPaidAdOrder({ landing_ttclid: 'E.C.P2_ABC' }), true);
  assert.equal(isPaidAdOrder({ landing_ref: null, landing_cid: null, landing_ttclid: null }), false);
  assert.equal(isPaidAdOrder({}), false);
  assert.equal(isPaidAdOrder(null), false);
});

test('ORDER_WEBHOOK_ALL_ORDERS=true sends organic sales too', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook', ORDER_WEBHOOK_ALL_ORDERS: 'true' }, async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; return { ok: true, status: 200 }; }, async () => {
      const organic = { ...paidOrder, landing_ref: null, landing_cid: null, landing_ttclid: null };
      const result = await fireOrderPaidWebhook(organic, { previousStatus: 'Pending' });
      assert.equal(result.ok, true);
      assert.equal(calls, 1);
    });
  });
});

test('an organic sale that is cancelled is not reported either', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    let called = false;
    await withFetch(async () => { called = true; return { ok: true, status: 200 }; }, async () => {
      const result = await fireOrderClosedWebhook(
        { ...paidOrder, status: 'Cancelled', landing_ref: null, landing_cid: null, landing_ttclid: null },
        { event: ORDER_WEBHOOK_EVENT_CANCELLED, previousStatus: 'Paid' },
      );
      assert.equal(result.fired, false);
      assert.equal(result.reason, 'not_an_ad_order');
      assert.equal(called, false);
    });
  });
});

test('cancelling a paid order reports it so revenue can be corrected', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    const bodies = [];
    await withFetch(async (url, opts) => { bodies.push(JSON.parse(opts.body)); return { ok: true, status: 200 }; }, async () => {
      const result = await fireOrderClosedWebhook(
        { ...paidOrder, status: 'Cancelled' },
        { event: ORDER_WEBHOOK_EVENT_CANCELLED, previousStatus: 'Paid' },
      );
      assert.equal(result.ok, true);
      assert.equal(bodies[0].event, 'order.cancelled');
      assert.equal(bodies[0].orderId, '42');
      assert.equal(bodies[0].status, 'Cancelled');
      assert.equal(bodies[0].paidAt, undefined);
      assert.equal(typeof bodies[0].occurredAt, 'string');
    });
  });
});

test('cancelling an order that never paid reports nothing', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    let called = false;
    await withFetch(async () => { called = true; return { ok: true, status: 200 }; }, async () => {
      const result = await fireOrderClosedWebhook(
        { ...paidOrder, status: 'Cancelled' },
        { event: ORDER_WEBHOOK_EVENT_CANCELLED, previousStatus: 'Pending' },
      );
      assert.equal(result.fired, false);
      assert.equal(result.reason, 'was_never_paid');
      assert.equal(called, false);
    });
  });
});

test('a refund reports how much went back', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    const bodies = [];
    await withFetch(async (url, opts) => { bodies.push(JSON.parse(opts.body)); return { ok: true, status: 200 }; }, async () => {
      await fireOrderClosedWebhook(
        { ...paidOrder, status: 'Partly Refunded', refunded_amount_usd: 45, refunded_amount_crc: 23000 },
        { event: ORDER_WEBHOOK_EVENT_REFUNDED, previousStatus: 'Paid' },
      );
      assert.equal(bodies[0].event, 'order.refunded');
      assert.equal(bodies[0].refundedAmount, 23000);
      assert.equal(bodies[0].refundedAmountUsd, 45);
      assert.equal(bodies[0].amount, 46000);
    });
  });
});

test('an unknown event is refused rather than invented', async () => {
  await withEnv({ ORDER_WEBHOOK_URL: 'https://example.test/hook' }, async () => {
    let called = false;
    await withFetch(async () => { called = true; return { ok: true, status: 200 }; }, async () => {
      const result = await fireOrderClosedWebhook(paidOrder, { event: 'order.shipped', previousStatus: 'Paid' });
      assert.equal(result.fired, false);
      assert.equal(result.reason, 'unknown_event');
      assert.equal(called, false);
    });
  });
});

test('the cancelled payload still carries the click ids', () => {
  const payload = buildOrderWebhookPayload({ ...paidOrder, status: 'Cancelled' }, { event: ORDER_WEBHOOK_EVENT_CANCELLED });
  assert.equal(payload.cid, 'cid_abc123');
  assert.equal(payload.ttclid, 'E.C.P2_ABC');
  assert.equal(payload.product, 'glp-1-rt-agonista-triple-15mg');
});
