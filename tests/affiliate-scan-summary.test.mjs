import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAffiliateScan, affiliateScanMessage } from '../src/lib/affiliateScanSummary.mjs';

const affiliates = [
  { id: 'tat', name: 'Tatiana', affiliate_kind: 'sales_agent', admin_profile_user_id: 'u-tat' },
  { id: 'dani', name: 'Dani', affiliate_kind: 'sales_agent', admin_profile_user_id: 'u-dani' },
  { id: 'zig', name: 'Ziggy', affiliate_kind: 'external', admin_profile_user_id: null },
  // Labelled sales agent with no login: paid on the affiliate run, not Team.
  { id: 'pp', name: 'PeptidePrices', affiliate_kind: 'sales_agent', admin_profile_user_id: null },
];

const allTime = { period: { start: '2020-01-01T06:00:00.000Z', end: '2026-10-25T18:00:00.000Z' }, periodKey: 'all-time' };

test('an empty all-time scan names the sales agents and where they are paid', () => {
  const summary = summarizeAffiliateScan({
    orders: [
      { id: 'o1', affiliate_id: 'tat' },
      { id: 'o2', affiliate_id: 'dani' },
      { id: 'o3', affiliate_id: 'tat' },
    ],
    affiliates,
  });
  assert.deepEqual(summary.salesAgentOrders, [{ name: 'Tatiana', count: 2 }, { name: 'Dani', count: 1 }]);

  const message = affiliateScanMessage({ ...allTime, payoutReport: [], summary });
  assert.match(message, /No unpaid affiliate commission for all time\./);
  assert.match(message, /3 paid orders came through sales agents: Tatiana \(2\), Dani \(1\)/);
  assert.match(message, /Team → Commission Payouts/);
});

test('picking a sales agent says they are paid in Team, with their count', () => {
  const summary = summarizeAffiliateScan({
    orders: [{ id: 'o1', affiliate_id: 'tat' }],
    affiliates: affiliates.filter((a) => a.id === 'tat'),
    targetAffiliateId: 'tat',
  });
  const message = affiliateScanMessage({ ...allTime, payoutReport: [], summary });
  assert.match(message, /^Tatiana is a sales agent, so their referrals are paid under Team → Commission Payouts/);
  assert.match(message, /1 paid referral order for all time/);
});

test('a scan with no affiliate orders at all says so plainly', () => {
  const summary = summarizeAffiliateScan({ orders: [], affiliates });
  const message = affiliateScanMessage({ ...allTime, payoutReport: [], summary });
  assert.match(message, /No paid order in this period used an affiliate code or link/);
});

test('orders already paid out are explained, not silently dropped', () => {
  const summary = summarizeAffiliateScan({
    orders: [{ id: 'o9', affiliate_id: 'zig' }],
    affiliates,
    paidOrderIds: new Set(['o9']),
  });
  assert.equal(summary.alreadyOnPayout, 1);
  const message = affiliateScanMessage({ ...allTime, payoutReport: [], summary });
  assert.match(message, /1 order already on an approved or paid affiliate payout/);
});

test('a no-login sales_agent affiliate counts as an ordinary affiliate', () => {
  const summary = summarizeAffiliateScan({ orders: [{ id: 'o5', affiliate_id: 'pp' }], affiliates });
  assert.deepEqual(summary.salesAgentOrders, []);
});

test('found payouts and failed saves are both reported', () => {
  const message = affiliateScanMessage({
    period: { start: '2026-10-19T06:00:00.000Z', end: '2026-10-26T05:59:59.999Z' },
    periodKey: 'previous',
    payoutReport: [
      { name: 'Ziggy', savedSuccessfully: true },
      { name: 'Jean Paul', savedSuccessfully: false, saveError: 'boom' },
    ],
    summary: { salesAgentOrders: [], alreadyOnPayout: 0 },
  });
  assert.match(message, /Commission found for 1 affiliate from Oct 19 to Oct 25, 2026 \(Costa Rica time\)/);
  assert.match(message, /Could not save the payout for Jean Paul: boom\./);
});
