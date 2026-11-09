/**
 * The Google ad click travels from the landing-page lead to the order staff
 * create later, so the Google Ads upload can send it. Before this, 0 of 117
 * uploaded orders carried a click ID: the /lp and /glp-1 forms never kept it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leadClickForOrder, loadLeadClicks } from '../src/lib/leadAdClick.mjs';
import { runGoogleAdsImport } from '../src/lib/googleAdsImport.mjs';

const DAY = 86400000;
const now = Date.now();
const paid = new Date(now - 1000).toISOString();
const order = { id: 'order1', order_number: 'WPCR-LEAD01', payment_method: 'whatsapp', status: 'Paid', total_usd: 200, ad_attribution: null, customer_email: 'Buyer@Example.com', customer_phone: '+506 8888-7777' };
const lead = (patch = {}) => ({ email: null, phone: null, contact_value: null, ad_attribution: { gclid: 'lead-gclid', clicked_at: now - 2 * DAY }, ...patch });

test('matches the lead by phone whatever its formatting, or by email in any case', () => {
  assert.equal(leadClickForOrder(order, [lead({ phone: '50688887777' })], paid)?.gclid, 'lead-gclid');
  assert.equal(leadClickForOrder(order, [lead({ contact_value: '8888 7777' })], paid)?.gclid, 'lead-gclid');
  assert.equal(leadClickForOrder(order, [lead({ email: ' buyer@example.COM ' })], paid)?.gclid, 'lead-gclid');
  assert.equal(leadClickForOrder(order, [lead({ phone: '50611112222', email: 'someone@else.com' })], paid), null);
});

test('takes the newest click, never one after the payment or older than 90 days', () => {
  const older = lead({ phone: '88887777', ad_attribution: { gclid: 'older', clicked_at: now - 10 * DAY } });
  const newer = lead({ phone: '88887777', ad_attribution: { gbraid: 'newer', clicked_at: now - DAY } });
  assert.equal(leadClickForOrder(order, [older, newer], paid)?.gbraid, 'newer');
  const afterPayment = lead({ phone: '88887777', ad_attribution: { gclid: 'late', clicked_at: Date.parse(paid) + 30000 } });
  assert.equal(leadClickForOrder(order, [afterPayment], paid), null);
  const expired = lead({ phone: '88887777', ad_attribution: { gclid: 'old', clicked_at: now - 91 * DAY } });
  assert.equal(leadClickForOrder(order, [expired], paid), null);
  assert.equal(leadClickForOrder({ ...order, customer_email: '', customer_phone: '' }, [lead({ phone: '88887777' })], paid), null);
});

test('a missing column or read error leaves uploads on email/phone, as before', async () => {
  const failing = { from: () => ({ select() { return this; }, gte() { return this; }, limit: async () => ({ error: { message: 'column catalog_leads.ad_attribution does not exist' } }) }) };
  assert.deepEqual(await loadLeadClicks(failing), []);
  const throwing = { from() { throw new Error('offline'); } };
  assert.deepEqual(await loadLeadClicks(throwing), []);
});

function fixture({ orderRow, leads }) {
  const queue = [{ id: 'q1', order_id: orderRow.id, paid_at: paid, status: 'leased', attempts: 1 }];
  const orderUpdates = [], queueWrites = [], leadReads = [];
  const admin = {
    async rpc() { return { data: queue.splice(0) }; },
    from(table) {
      let values, filters = {};
      const q = {
        select() { return q; },
        eq(key, value) { filters[key] = value; return q; },
        is(key, value) { filters[`is:${key}`] = value; return q; },
        gte(key, value) { filters[`gte:${key}`] = value; return q; },
        order() { return q; },
        async limit() { if (table === 'catalog_leads') { leadReads.push(filters); return { data: leads }; } return { data: [] }; },
        update(v) { values = v; return q; },
        async maybeSingle() { return { data: orderRow }; },
        then(resolve) {
          (table === 'orders' ? orderUpdates : queueWrites).push({ ...filters, ...values });
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return q;
    },
  };
  return { admin, orderUpdates, queueWrites, leadReads };
}

test('upload sends the lead\'s click for a CRM order and records it on the order', async () => {
  const f = fixture({ orderRow: order, leads: [lead({ phone: '88887777' })] });
  let sent;
  const summary = await runGoogleAdsImport(f.admin, { destination: 'unit', upload: async event => { sent = event; return { requestId: 'r1' }; } });
  assert.equal(summary.submitted, 1);
  assert.equal(sent.adIdentifiers.gclid, 'lead-gclid');
  assert.equal(f.orderUpdates.length, 1);
  assert.equal(f.orderUpdates[0].id, 'order1');
  assert.equal(f.orderUpdates[0]['is:ad_attribution'], null);
  assert.equal(f.orderUpdates[0].ad_attribution.gclid, 'lead-gclid');
  assert.equal(f.leadReads[0]['gte:ad_attribution->>clicked_at'].length, 13);
});

test('an order with its own click keeps it, and no lead is read', async () => {
  const own = { ...order, ad_attribution: { gclid: 'checkout-gclid', clicked_at: now - DAY } };
  const f = fixture({ orderRow: own, leads: [lead({ phone: '88887777' })] });
  let sent;
  await runGoogleAdsImport(f.admin, { destination: 'unit', upload: async event => { sent = event; return { requestId: 'r2' }; } });
  assert.equal(sent.adIdentifiers.gclid, 'checkout-gclid');
  assert.equal(f.orderUpdates.length, 0);
  assert.equal(f.leadReads.length, 0);
});

test('no matching lead: uploads exactly as before, on hashed email/phone', async () => {
  const f = fixture({ orderRow: order, leads: [] });
  let sent;
  await runGoogleAdsImport(f.admin, { destination: 'unit', upload: async event => { sent = event; return { requestId: 'r3' }; } });
  assert.equal(sent.adIdentifiers, undefined);
  assert.ok(sent.userData.userIdentifiers.length);
  assert.equal(f.orderUpdates.length, 0);
});

test('both ad landing pages keep the click and the lead route saves it', () => {
  for (const page of ['../public/lp/index.html', '../public/glp-1/index.html']) {
    const html = readFileSync(new URL(page, import.meta.url), 'utf8');
    assert.match(html, /document\.cookie = "pcr_google_click="/, page);
    assert.match(html, /endpoint": ?"\/api\/leads\/contact"|endpoint: "\/api\/leads\/contact"/, page);
  }
  const route = readFileSync(new URL('../src/app/api/leads/contact/route.js', import.meta.url), 'utf8');
  assert.match(route, /readAdClick\(\{ cookie: request\.headers\.get\('cookie'\)/);
  assert.match(route, /\.\.\.\(adClick \? \{ ad_attribution: adClick \} : \{\}\)/);
  assert.match(route, /'ad_attribution',\r?\n {4}\];/,'must stay droppable so a lead is never lost before the migration runs');
  const sql = readFileSync(new URL('../add-lead-ad-attribution.sql', import.meta.url), 'utf8');
  assert.match(sql, /ALTER TABLE public\.catalog_leads ADD COLUMN IF NOT EXISTS ad_attribution jsonb/);
});
