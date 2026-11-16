import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRevenueByChannel,
  countableOrders,
  crDayKey,
  orderChannels,
  revenueByChannelCsv,
} from '../src/lib/revenueByChannel.mjs';

const RATE = 500;
const day = (iso) => Date.parse(iso);
let seq = 0;
const order = (fields) => ({
  id: `o${++seq}`,
  order_number: `WPCR-${seq}`,
  status: 'Paid',
  total_usd: 100,
  total_crc: 50000,
  customer_phone: `8888${String(seq).padStart(4, '0')}`,
  created_at: '2026-11-03T15:00:00Z',
  ...fields,
});

const window = { from: day('2026-11-02T06:00:00Z'), to: day('2026-11-09T06:00:00Z'), rate: RATE };

test('channel totals add up to the revenue, each order counted once', () => {
  const orders = [
    order({ lt_channel: 'google_ads', ft_channel: 'meta_ads', captured_by: 'website' }),
    order({ lt_channel: 'email', ft_channel: 'email', captured_by: 'website', total_usd: 50, total_crc: 25000 }),
    order({}),
  ];
  const report = buildRevenueByChannel(orders, window);
  assert.equal(report.totals.usd, 250);
  assert.equal(report.channels.reduce((sum, row) => sum + row.usd, 0), 250);
  assert.equal(report.byType.paid.usd, 100);
  assert.equal(report.byType.organic.usd, 50);
  assert.equal(report.byType.unknown.usd, 100);
  const meta = report.channels.find((row) => row.key === 'meta_ads');
  assert.equal(meta.assisted, 1, 'Meta started the sale Google closed');
  assert.equal(meta.firstUsd, 100);
});

test('first-touch view credits the opening channel', () => {
  const orders = [order({ lt_channel: 'google_ads', ft_channel: 'meta_ads' })];
  const report = buildRevenueByChannel(orders, { ...window, view: 'first' });
  assert.equal(report.channels[0].key, 'meta_ads');
});

test('unpaid, cancelled, excluded and $0 test orders never count', () => {
  const orders = [
    order({ status: 'Pending - Card 3DS' }),
    order({ status: 'Cancelled' }),
    order({ status: 'Refunded' }),
    order({ stats_override: 'exclude' }),
    order({ total_usd: 0, total_crc: 0 }),
    order({ status: 'Order Complete' }),
  ];
  assert.equal(countableOrders(orders, RATE).length, 1);
});

test('a card try then a WhatsApp payment for the same amount is one sale', () => {
  const orders = [
    order({ order_number: 'CARD-1', customer_phone: '50688887777', created_at: '2026-11-03T15:00:00Z' }),
    order({ order_number: 'WPCR-2', customer_phone: '88887777', created_at: '2026-11-03T18:00:00Z' }),
    order({ order_number: 'WPCR-3', customer_phone: '88887777', created_at: '2026-11-06T18:00:00Z' }),
  ];
  assert.equal(countableOrders(orders, RATE).length, 2, 'the third is a real repeat order days later');
});

test('new vs returning: first paid order ever, matched by phone then email', () => {
  const orders = [
    order({ customer_phone: '88001122', created_at: '2026-10-01T15:00:00Z' }),
    order({ customer_phone: '50688001122', created_at: '2026-11-04T15:00:00Z' }),
    order({ customer_phone: '', customer_email: 'NEW@x.com', created_at: '2026-11-05T15:00:00Z' }),
  ];
  const report = buildRevenueByChannel(orders, window);
  assert.equal(report.totals.newCustomers, 1);
  assert.equal(report.totals.returning, 1);
  assert.equal(buildRevenueByChannel(orders, { ...window, customers: 'new' }).totals.orders, 1);
});

test('older orders keep what source they carried', () => {
  assert.equal(orderChannels(order({ ad_attribution: { gclid: 'abc' } })).last, 'google_ads');
  assert.equal(orderChannels(order({ landing_ttclid: 'E.C' })).last, 'tiktok_ads');
  assert.equal(orderChannels(order({ landing_ref: 'tiktok-glp1-a', landing_cid: 'x' })).last, 'tiktok_ads');
  assert.equal(orderChannels(order({ journey_id: 'j' })).last, 'email');
  assert.equal(orderChannels(order({ affiliate_id: 'a' })).last, 'agent_referral');
  assert.deepEqual(orderChannels(order({})), { last: 'unknown', first: 'unknown', capturedBy: 'unknown' });
});

test('paid date is when it was paid, in Costa Rica days, compared to the week before', () => {
  const orders = [
    order({ created_at: '2026-10-30T15:00:00Z', ads_paid_at: '2026-11-02T07:00:00Z' }),
    order({ created_at: '2026-10-28T15:00:00Z' }),
  ];
  const report = buildRevenueByChannel(orders, window);
  assert.equal(report.totals.orders, 1);
  assert.equal(report.totals.previousUsd, 100);
  assert.equal(report.totals.changePct, 0);
  assert.equal(report.days.length, 7);
  assert.equal(report.days[0].day, '2026-11-02');
  assert.equal(report.days[0].unknown, 100);
  assert.equal(crDayKey(day('2026-11-03T05:59:00Z')), '2026-11-02', '11:59 pm in Costa Rica is still the 2nd');
});

test('ad spend and ROAS for paid channels only', () => {
  const orders = [order({ lt_channel: 'google_ads', total_usd: 300 })];
  const report = buildRevenueByChannel(orders, { ...window, adSpend: [{ week_start: '2026-11-02', channel: 'google_ads', amount_usd: 100 }] });
  const google = report.channels.find((row) => row.key === 'google_ads');
  assert.equal(google.spendUsd, 100);
  assert.equal(google.roas, 3);
  assert.equal(report.totals.roas, 3);
});

test('tracking coverage and click-id share', () => {
  const orders = [
    order({ lt_channel: 'google_ads', captured_by: 'website', last_touch: { gclid: 'g' } }),
    order({ lt_channel: 'google_ads', captured_by: 'whatsapp_ref', last_touch: {} }),
  ];
  const report = buildRevenueByChannel(orders, window);
  assert.equal(report.clickIds.google, 2);
  assert.equal(report.clickIds.googleWith, 1);
  assert.equal(report.coverage.find((row) => row.key === 'whatsapp_ref').orders, 1);
});

test('CSV export has one row per order', () => {
  const report = buildRevenueByChannel([order({ lt_channel: 'email', last_touch: { cmp: 'bf, week 1' } })], window);
  const csv = revenueByChannelCsv(report).split('\n');
  assert.equal(csv.length, 2);
  assert.match(csv[1], /"bf, week 1"/);
});

test('colones are what each order was charged, not dollars times the current rate', () => {
  const orders = [
    order({ lt_channel: 'google_ads', total_usd: 100, total_crc: 45000 }),
    order({ lt_channel: 'email', total_usd: 50, total_crc: 0 }),
  ];
  const report = buildRevenueByChannel(orders, { ...window, rate: 450 });
  assert.equal(report.totals.crc, 45000 + 22500, 'a dollar-only order is read at the given rate');
  assert.equal(report.channels.find((row) => row.key === 'google_ads').crc, 45000);
  assert.equal(report.days.reduce((sum, d) => sum + d.paidCrc + d.organicCrc + d.unknownCrc, 0), 67500);
  assert.equal(report.totals.avgCrc, 33750);
});
