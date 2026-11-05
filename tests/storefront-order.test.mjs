import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  HONEYPOT_FIELD,
  PAYMENT_METHODS,
  RESEARCH_ACK_VERSION,
  buildOrderPayload,
  cardPaymentUrl,
  newOrderNumber,
  submitOrder,
} from '../lib/storefront/order.mjs';

const RATE = 454.48;
const realFetch = globalThis.fetch;

afterEach(() => { globalThis.fetch = realFetch; });

function line(product, priceUsd, qty, extra = {}) {
  return {
    product, priceUsd, priceCrc: Math.round(priceUsd * RATE), qty, name: product, size: '10 mg', ...extra,
  };
}

const CUSTOMER = {
  name: '  Ana   Rojas ',
  phone: '8404 6973',
  email: 'ana@example.test',
  address: '200 m norte de la iglesia, Granadilla, Curridabat, San José',
};

function payload(overrides = {}) {
  return buildOrderPayload({
    cart: [line('BPC-157 10mg', 90, 5)],
    customer: CUSTOMER,
    paymentMethod: 'whatsapp',
    currency: 'CRC',
    exchangeRate: RATE,
    lang: 'en',
    orderNumber: 'W-TEST-ABCD',
    ...overrides,
  });
}

test('an order number satisfies checkout\'s own pattern', () => {
  for (let i = 0; i < 50; i += 1) {
    assert.match(newOrderNumber(), /^[A-Za-z0-9-]{6,64}$/);
  }
  // The W marks it as the website's, so it can never collide with a number
  // the catalog minted.
  assert.match(newOrderNumber(), /^W-/);
});

test('only the two payment methods checkout accepts', () => {
  assert.deepEqual(PAYMENT_METHODS, ['card', 'whatsapp']);
});

test('the payload carries what checkout requires', () => {
  const order = payload();

  for (const field of ['order_number', 'customer_name', 'customer_phone', 'items']) {
    assert.ok(order[field], `${field} is required by checkout`);
  }
  assert.equal(order.customer_name, 'Ana Rojas', 'collapsed, as a phone keyboard adds spaces');
  assert.equal(order.customer_phone, '84046973');
  assert.deepEqual(order.research_ack, { accepted: true, version: RESEARCH_ACK_VERSION });
  assert.ok(HONEYPOT_FIELD in order, 'the honeypot travels and checkout strips it');
  assert.equal(order.payment_method, 'whatsapp');
  assert.equal(order.status, 'Pending');
  assert.ok(order.items.length >= 1);
  assert.equal(order.items[0].product, 'BPC-157 10mg', 'the stored product string, unaltered');
});

test('the free BAC vial is an explicit line, priced at zero', () => {
  const order = payload({
    cart: [line('BPC-157 10mg', 90, 2, {
      freeBacWater: true, freeBacSizeMl: 3, freeBacVialsPerItem: 1,
    })],
  });

  const gift = order.items.find((item) => Number(item.price) === 0);
  assert.ok(gift, 'the gift the cart earns is listed, so the packing list and the total agree');
  assert.match(gift.product, /Bacteriostatic Water 3ml/);
  assert.equal(gift.qty, 2, 'one per peptide vial');
});

test('both totals are stated, and shipping with them', () => {
  const order = payload({ currency: 'CRC' });
  assert.ok(order.total_crc > 0);
  assert.ok(order.total_usd > 0);
  assert.ok('shipping_cost_usd' in order && 'shipping_cost_crc' in order);
  assert.equal(order.currency, 'CRC');
});

test('a card order is marked for the card flow', () => {
  const order = payload({ paymentMethod: 'card' });
  assert.equal(order.payment_method, 'card');
  assert.equal(order.status, 'Pending - Card');
});

test('how an off-card customer intends to pay is recorded in the notes', () => {
  // Checkout stores two payment methods, so SINPE and cash are both
  // `whatsapp` orders; which one was chosen still has to reach the packer.
  assert.match(payload({ offCardMethod: 'sinpe' }).internal_notes, /SINPE/);
  assert.match(payload({ offCardMethod: 'cash' }).internal_notes, /cash on delivery/);
});

test('the order is posted inside `order`, the shape checkout reads', async () => {
  // The catalog's /api/orders/create reads `body.order` and answers a bare
  // order with 400 "Missing order payload" -- every order would be lost.
  let posted;
  globalThis.fetch = async (url, options) => {
    posted = { url, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ ok: true, id: 'row-0', orderNumber: 'W-TEST-ABCD' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };

  const order = payload();
  await submitOrder(order);
  assert.match(posted.url, /\/api\/orders\/create$/);
  assert.deepEqual(Object.keys(posted.body), ['order']);
  assert.equal(posted.body.order.order_number, order.order_number);
  assert.equal(posted.body.order.total_crc, order.total_crc);
});

test('a successful save returns the order and its card token', async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({ ok: true, id: 'row-1', orderNumber: 'W-TEST-ABCD', paymentToken: 'tok' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

  const result = await submitOrder(payload({ paymentMethod: 'card' }));
  assert.equal(result.ok, true);
  assert.equal(result.orderNumber, 'W-TEST-ABCD');
  assert.equal(result.paymentToken, 'tok');
});

test('a cheaper reprice is adopted silently and the order goes through', async () => {
  // The rate this page rendered with can be an hour old, so a disagreement is
  // ordinary. The shopper can do nothing about it and must not be asked to.
  const posted = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body).order;
    posted.push(body);
    if (posted.length === 1) {
      return new Response(JSON.stringify({
        error: 'Prices moved.',
        errorCode: 'price_changed',
        exchangeRate: 460,
        pricing: { ok: true, totalCrc: body.total_crc - 500, totalUsd: body.total_usd - 1 },
      }), { status: 409, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true, id: 'row-2', orderNumber: body.order_number }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };

  const result = await submitOrder(payload());
  assert.equal(result.ok, true);
  assert.equal(posted.length, 2, 're-posted once at the server\'s own figure');
  assert.equal(posted[1].total_crc, posted[0].total_crc - 500);
});

test('a dearer reprice stops and asks, rather than charging more', async () => {
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body).order;
    return new Response(JSON.stringify({
      error: 'Prices moved.',
      errorCode: 'price_changed',
      pricing: { ok: true, totalCrc: body.total_crc + 9000, totalUsd: body.total_usd + 20 },
    }), { status: 409, headers: { 'content-type': 'application/json' } });
  };

  const result = await submitOrder(payload());
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'price_increased');
  assert.ok(result.pricing, 'the new pricing comes back so the shopper can be shown it');
});

test('a reprice loop cannot run forever', async () => {
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    const body = JSON.parse(options.body).order;
    return new Response(JSON.stringify({
      errorCode: 'price_changed',
      error: 'Prices moved.',
      pricing: { ok: true, totalCrc: body.total_crc - 1, totalUsd: body.total_usd },
    }), { status: 409, headers: { 'content-type': 'application/json' } });
  };

  const result = await submitOrder(payload());
  assert.equal(result.ok, false);
  assert.equal(calls, 2, 'one retry, then it reports instead of hammering the limiter');
});

test('a network failure is reported, not thrown', async () => {
  globalThis.fetch = async () => { throw new Error('offline'); };
  const result = await submitOrder(payload());
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'network');
});

test('the card page is the catalog\'s, with the order and token in the path', () => {
  const url = cardPaymentUrl('W-TEST-ABCD', 'tok/en');
  assert.match(url, /^https:\/\/catalog\.peptidescostarica\.net\/pay-card\//);
  assert.ok(url.includes('tok%2Fen'), 'the token is encoded, not left to break the path');
});

test('a quote states the deal-inclusive total the shopper saw', () => {
  const quoted = payload({ quote: { total: 150000, shipping: 0 } });
  assert.equal(quoted.total_crc, 150000);
  assert.equal(quoted.total_usd, Math.round(150000 / RATE));
  assert.equal(quoted.shipping_cost_crc, 0);
  // Without one, the volume-tier total is stated as before.
  assert.notEqual(payload().total_crc, 150000);
});

test('an order carries the visitor\'s agent link, ad click and GA4 visit', () => {
  // The browser state captureAttribution() leaves behind after a visitor
  // arrives on ?sales_agent=maria&gclid=... with GA4 cookies set.
  const store = new Map([
    ['checkout_sales_agent', 'maria'],
    ['lead_utm_source', 'google'],
    ['lead_utm_campaign', 'Brand CR'],
  ]);
  const click = encodeURIComponent(JSON.stringify({ clicked_at: Date.now() - 60000, gclid: 'Cj0KCQabc-123' }));
  globalThis.window = {
    localStorage: { getItem: (key) => (store.has(key) ? store.get(key) : null) },
    document: { cookie: `pcr_google_click=${click}; _ga=GA1.1.123456789.1700000000` },
  };
  try {
    const order = payload();
    assert.equal(order.sales_agent, 'maria');
    assert.equal(order.ad_attribution.gclid, 'Cj0KCQabc-123');
    assert.equal(order.ga_client_id, '123456789.1700000000');
    assert.equal(order.utm_campaign, 'Brand CR');
    // Not columns the catalog's checkout writes; one unknown column fails the order.
    for (const key of ['utm_source', 'utm_medium', 'gclid', 'referrer']) {
      assert.equal(key in order, false, `${key} must not be sent`);
    }
  } finally {
    delete globalThis.window;
  }
});
