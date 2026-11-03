import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { parseGaClientId, parseGaSessionId, readGaIdentity, sanitizeGaIdentity } from '../src/lib/gaIdentity.mjs';
import { ga4Config, ga4PurchaseEvent, sendGa4Event, runGa4PurchaseExport, GA4_COLLECT_URL, GA4_DEBUG_URL, GA4_MAX_AGE_MS } from '../src/lib/ga4Purchase.mjs';
import { offlineConversionEvent } from '../src/lib/googleAdsConversions.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const now = Date.parse('2026-11-03T12:00:00Z');
const paid = new Date(now - 3600000).toISOString();
const order = {
  id: 'order-1', order_number: 'WPCR-GA4TEST', payment_method: 'whatsapp', status: 'Paid', currency: 'USD',
  total_usd: 95, total_crc: 47500, shipping_cost_usd: 15, promo_code: '', ads_paid_at: paid,
  items: [{ product: 'BPC-157 5mg', qty: 2, price: 40 }],
  ga_client_id: '1234567890.1700000000', ga_session_id: '1730000000',
};
const config = { measurementId: 'G-UNITTEST01', apiSecret: 'unit-secret-value' };

test('reads the GA4 client and session IDs from Google cookies, old and new format', () => {
  assert.equal(parseGaClientId('GA1.1.1234567890.1700000000'), '1234567890.1700000000');
  assert.equal(parseGaClientId('GA1.2.123.456'), null);
  assert.equal(parseGaClientId('<script>'), null);
  assert.equal(parseGaSessionId('GS1.1.1730000000.3.1.1730000100.0.0.0'), '1730000000');
  assert.equal(parseGaSessionId('GS2.1.s1730000001$o3$g1$t1730000100$j0$l0$h0'), '1730000001');
  assert.equal(parseGaSessionId('GS2.1.s1730000001'), '1730000001');
  assert.equal(parseGaSessionId('nonsense'), null);
  const document = { cookie: '_ga=GA1.1.1234567890.1700000000; theme=dark; _ga_OLDSTREAM=GS1.1.1730000000.1.1.1730000050.0.0.0; _ga_NEWSTREAM=GS2.1.s1730009999$o2$g1$t1730010000$j0$l0$h0' };
  assert.deepEqual(readGaIdentity(document), { ga_client_id: '1234567890.1700000000', ga_session_id: '1730009999' });
  assert.deepEqual(readGaIdentity({ cookie: 'theme=dark' }), {});
  assert.deepEqual(readGaIdentity({ cookie: '%E0%A4%A' }), {});
  assert.deepEqual(readGaIdentity(null), {});
});

test('what the browser sends is kept only when it is shaped like a real GA4 ID', () => {
  assert.deepEqual(sanitizeGaIdentity({ ga_client_id: '1234567890.1700000000', ga_session_id: '1730000000' }), { ga_client_id: '1234567890.1700000000', ga_session_id: '1730000000' });
  assert.deepEqual(sanitizeGaIdentity({ ga_client_id: "1'; drop table orders;--", ga_session_id: 'abc' }), { ga_client_id: null, ga_session_id: null });
  assert.deepEqual(sanitizeGaIdentity(undefined), { ga_client_id: null, ga_session_id: null });
});

test('a paid WhatsApp order becomes a GA4 purchase with payment_type whatsapp', () => {
  const event = ga4PurchaseEvent(order, paid, { now });
  assert.equal(event.attributed, true);
  assert.equal(event.body.client_id, '1234567890.1700000000');
  assert.equal(event.body.timestamp_micros, Date.parse(paid) * 1000);
  assert.equal(event.body.events.length, 1);
  const { name, params } = event.body.events[0];
  assert.equal(name, 'purchase');
  assert.equal(params.payment_type, 'whatsapp');
  assert.equal(params.transaction_id, 'WPCR-GA4TEST');
  assert.equal(params.currency, 'USD');
  assert.equal(params.value, 80, 'net product value, delivery kept separate');
  assert.equal(params.shipping, 15);
  assert.equal(params.session_id, 1730000000);
  assert.ok(params.items.length >= 1);
  assert.equal(params.items.reduce((sum, item) => sum + item.price * item.quantity, 0), params.value);
  assert.equal(JSON.stringify(event).includes('email'), false, 'no contact details go to GA4');
});

test('an order with no browser IDs is still counted, as a new visitor, and says so', () => {
  const event = ga4PurchaseEvent({ ...order, ga_client_id: null, ga_session_id: null }, paid, { now });
  assert.equal(event.attributed, false);
  assert.equal(event.body.client_id, 'pcr-offline-WPCR-GA4TEST');
  assert.equal(event.body.events[0].params.session_id, undefined);
});

test('unpaid, card, test, excluded, free, empty and stale orders are never sent', () => {
  for (const patch of [
    { status: 'Pending' }, { status: 'Unpaid' }, { status: 'Canceled' }, { status: 'Refunded' },
    { payment_method: 'card' }, { stats_override: 'exclude' }, { internal_notes: 'TEST order' }, { notes: 'this is a TEST' },
    { total_usd: 0, shipping_cost_usd: 0 }, { items: [] },
  ]) assert.throws(() => ga4PurchaseEvent({ ...order, ...patch }, paid, { now }), undefined, JSON.stringify(patch));
  assert.throws(() => ga4PurchaseEvent(order, 'not a date', { now }), /payment confirmation time/);
  const stale = new Date(now - GA4_MAX_AGE_MS - 60000).toISOString();
  assert.throws(() => ga4PurchaseEvent(order, stale, { now }), /too old/);
  assert.doesNotThrow(() => ga4PurchaseEvent(order, stale, { now, skipAgeCheck: true }), 'the validate route can check older orders');
});

test('the Google Ads upload does not change and never receives GA4 IDs', () => {
  // The Ads rules judge click age against the real clock, so this test uses it too.
  const realNow = Date.now();
  const adsOrder = { ...order, ad_attribution: { gclid: 'test-gclid', clicked_at: realNow - 100000 }, customer_email: 'a@b.co', customer_phone: '88888888' };
  const ads = offlineConversionEvent(adsOrder, new Date(realNow - 1000).toISOString());
  assert.equal(ads.eventName, 'purchase');
  assert.deepEqual(ads.adIdentifiers, { gclid: 'test-gclid' });
  assert.equal(JSON.stringify(ads).includes('1234567890.1700000000'), false);
});

test('configuration is checked by name and the secret never appears in an error', async () => {
  assert.deepEqual(ga4Config({}).missing, ['GA4_MEASUREMENT_ID', 'GA4_API_SECRET']);
  assert.deepEqual(ga4Config({ GA4_MEASUREMENT_ID: 'UA-123', GA4_API_SECRET: 'x' }).missing, ['GA4_MEASUREMENT_ID']);
  assert.deepEqual(ga4Config({ GA4_MEASUREMENT_ID: 'G-ABC123XYZ9', GA4_API_SECRET: 'x' }).missing, []);
  const event = ga4PurchaseEvent(order, paid, { now });
  const calls = [];
  const ok = async (url, options) => { calls.push({ url, options }); return { ok: true, status: 204 }; };
  await sendGa4Event(event, config, { fetcher: ok });
  assert.ok(calls[0].url.startsWith(`${GA4_COLLECT_URL}?measurement_id=G-UNITTEST01&api_secret=`));
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), event.body);
  const debug = async url => ({ ok: true, status: 200, json: async () => ({ validationMessages: [], seen: url }) });
  assert.ok((await sendGa4Event(event, config, { fetcher: debug, debug: true })).seen.startsWith(GA4_DEBUG_URL));
  for (const fetcher of [async url => { throw new Error(`socket hang up for ${url}`); }, async () => ({ ok: false, status: 400 })]) {
    await assert.rejects(() => sendGa4Event(event, config, { fetcher }), error => !/unit-secret-value|api_secret|G-UNITTEST01/.test(error.message));
  }
});

function fixture(orders) {
  const exportsTable = new Map(), upserts = [];
  const admin = {
    from(table) {
      if (table === 'orders') {
        const q = { select() { return q; }, eq() { return q; }, gte() { return q; }, order() { return q; }, limit() { return Promise.resolve({ data: orders }); } };
        return q;
      }
      return {
        select() { return { in: () => Promise.resolve({ data: [...exportsTable.values()] }) }; },
        async upsert(values) { upserts.push(values); exportsTable.set(values.order_id, { ...exportsTable.get(values.order_id), ...values }); return {}; },
      };
    },
  };
  return { admin, exportsTable, upserts };
}

test('the sender sends each confirmed order once, skips what GA4 should not get, and retries failures a few times', async () => {
  const orders = [
    order,
    { ...order, id: 'order-2', order_number: 'WPCR-TESTNOTE', internal_notes: 'TEST' },
    { ...order, id: 'order-3', order_number: 'WPCR-FREE', total_usd: 0, shipping_cost_usd: 0 },
    { ...order, id: 'order-4', order_number: 'WPCR-CRM', ga_client_id: null, ga_session_id: null },
  ];
  const { admin, exportsTable } = fixture(orders);
  const sentIds = [];
  const fetcher = async (_url, options) => { sentIds.push(JSON.parse(options.body).events[0].params.transaction_id); return { ok: true, status: 204 }; };
  assert.deepEqual(await runGa4PurchaseExport(admin, config, { fetcher, now }), { sent: 2, skipped: 2, failed: 0 });
  assert.deepEqual(sentIds, ['WPCR-GA4TEST', 'WPCR-CRM']);
  assert.equal(exportsTable.get('order-1').client_id_source, 'browser');
  assert.equal(exportsTable.get('order-4').client_id_source, 'synthetic');
  assert.match(exportsTable.get('order-2').last_error, /Test or excluded/);
  // A second run (the next 15 minutes) sends nothing again.
  assert.deepEqual(await runGa4PurchaseExport(admin, config, { fetcher, now }), { sent: 0, skipped: 0, failed: 0 });
  assert.equal(sentIds.length, 2);

  const flaky = fixture([order]);
  let tries = 0;
  const down = async () => { tries++; return { ok: false, status: 503 }; };
  for (let run = 0; run < 8; run++) await runGa4PurchaseExport(flaky.admin, config, { fetcher: down, now });
  assert.equal(tries, 5, 'gives up after five attempts');
  assert.equal(flaky.exportsTable.get('order-1').status, 'failed');
  assert.match(flaky.exportsTable.get('order-1').last_error, /HTTP 503/);
});

test('the sender says which SQL to run when its table or the order columns are missing', async () => {
  const missingTable = { from(table) { return table === 'orders' ? { select() { return this; }, eq() { return this; }, gte() { return this; }, order() { return this; }, limit: () => Promise.resolve({ data: [order] }) } : { select: () => ({ in: () => Promise.resolve({ error: { message: 'relation does not exist' } }) }) }; } };
  await assert.rejects(() => runGa4PurchaseExport(missingTable, config, { now }), /add-ga4-whatsapp-purchases\.sql/);
  const noAdsColumn = { from: () => ({ select() { return this; }, eq() { return this; }, gte() { return this; }, order() { return this; }, limit: () => Promise.resolve({ error: { message: 'column ads_paid_at does not exist' } }) }) };
  await assert.rejects(() => runGa4PurchaseExport(noAdsColumn, config, { now }), /add-google-ads-conversions\.sql/);
});

test('checkout saves the visitor IDs without ever letting a missing column block an order', () => {
  const route = read('src/app/api/orders/create/route.js');
  assert.match(route, /import \{ sanitizeGaIdentity \} from '@\/lib\/gaIdentity\.mjs';/);
  assert.match(route, /Object\.assign\(order, sanitizeGaIdentity\(order\)\);/);
  const droppable = route.slice(route.indexOf('await writeDroppingMissingColumns('), route.indexOf('await writeDroppingMissingColumns(') + 400);
  assert.match(droppable, /'ga_client_id', 'ga_session_id'/);
  const page = read('src/app/catalog/page.js');
  assert.match(page, /\.\.\.readGaIdentity\(document\),/);
  assert.ok(page.indexOf('readAdClick(document)') < page.indexOf('...readGaIdentity(document)'));
});

test('the cron is scheduled, guarded like the Ads one, and off until switched on', () => {
  const cron = JSON.parse(read('vercel.json')).crons.find(row => row.path === '/api/cron/ga4-whatsapp-purchases');
  assert.equal(cron.schedule, '*/15 * * * *');
  const route = read('src/app/api/cron/ga4-whatsapp-purchases/route.js');
  assert.match(route, /Bearer \$\{process\.env\.CRON_SECRET\}/);
  assert.match(route, /GA4_OFFLINE_ENABLED !== 'true'/);
  assert.match(route, /config\.missing\.length/);
  const validate = read('src/app/api/admin/ga4/validate/route.js');
  assert.match(validate, /requireSuperadmin: true/);
  assert.match(validate, /debug: true/);
  assert.match(validate, /sent: false/);
});

test('no GA4 API secret is written into the code, the docs or the SQL', () => {
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = `${dir}/${name}`;
      if (statSync(path).isDirectory()) walk(path); else if (/\.(js|mjs|md|sql|json)$/.test(name)) files.push(path);
    }
  })(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  files.push(new URL('../docs/google-ads-ecommerce-tracking.md', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), new URL('../add-ga4-whatsapp-purchases.sql', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  assert.ok(files.length > 50);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.equal(/api_secret=[A-Za-z0-9_-]{12,}/.test(text), false, `${file} contains an API secret`);
    assert.equal(/GA4_API_SECRET\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}/.test(text), false, `${file} assigns GA4_API_SECRET a value`);
  }
});
