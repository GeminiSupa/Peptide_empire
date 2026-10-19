import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HELD_BACK_ORDER_STATUSES,
  isHeldBackStatus,
  orderPaidEventMs,
  heldBackSinceMs,
  findHeldBackOrders,
  summarizeHeldBackOrders,
  describeHeldBackOrders,
} from '../src/lib/heldBackOrders.mjs';
import { COMMISSION_ELIGIBLE_ORDER_STATUSES } from '../src/lib/agentAttribution.mjs';

// The Oct 5-11 2026 reporting week, in Costa Rica time.
const START = new Date('2026-10-05T06:00:00.000Z').getTime();
const END = new Date('2026-10-12T05:59:59.999Z').getTime();
const amounts = (order) => ({ usd: Number(order.total_usd || 0), crc: Number(order.total_crc || 0) });

const order = (fields) => ({
  order_number: 'X',
  customer_name: 'Someone',
  total_crc: 100000,
  total_usd: 220,
  activity_log: [],
  ...fields,
});

const paidOn = (iso) => [{ type: 'status_change', at: iso, message: 'Status changed to Paid' }];

test('Processing now earns commission — nothing is held back for it', () => {
  assert.ok(
    COMMISSION_ELIGIBLE_ORDER_STATUSES.some((s) => s.toLowerCase() === 'processing'),
    'Processing must be commission-eligible',
  );
  assert.deepEqual(HELD_BACK_ORDER_STATUSES, []);
  assert.equal(isHeldBackStatus('Processing'), false);
});

test('held-back statuses never overlap the statuses the scan already counts', () => {
  for (const status of HELD_BACK_ORDER_STATUSES) {
    assert.equal(
      COMMISSION_ELIGIBLE_ORDER_STATUSES.some((s) => s.toLowerCase() === status.toLowerCase()),
      false,
      `${status} is already counted by the scan; alerting on it would double-report`,
    );
  }
});

test('the paid date comes from the log, and never falls back to created_at', () => {
  const paid = order({ status: 'Processing', activity_log: paidOn('2026-10-08T18:00:00.000Z') });
  assert.equal(orderPaidEventMs(paid), new Date('2026-10-08T18:00:00.000Z').getTime());

  const neverPaid = order({ status: 'Processing', created_at: '2026-10-08T18:00:00.000Z', activity_log: [] });
  assert.ok(Number.isNaN(orderPaidEventMs(neverPaid)), 'no payment event means no payment date');
});

test('a Processing transition counts as a payment event for dating', () => {
  const processingOnly = order({
    status: 'Processing',
    activity_log: [
      { type: 'status_change', at: '2026-10-08T12:00:00.000Z', message: 'Status changed to Processing' },
    ],
  });
  assert.equal(orderPaidEventMs(processingOnly), new Date('2026-10-08T12:00:00.000Z').getTime());
});

test('Processing - Card is not a payment event', () => {
  const card = order({
    status: 'Pending - Card',
    activity_log: [
      { type: 'status_change', at: '2026-10-08T12:00:00.000Z', message: 'Status changed to Processing - Card' },
    ],
  });
  assert.ok(Number.isNaN(orderPaidEventMs(card)));
});

test('the earliest payment event wins when an order was reopened and closed again', () => {
  const reopened = order({
    status: 'Processing',
    activity_log: [
      { type: 'status_change', at: '2026-10-09T12:00:00.000Z', message: 'Status changed to Order Complete' },
      { type: 'status_change', at: '2026-10-07T12:00:00.000Z', message: 'Status changed to Paid' },
      { type: 'status_change', at: '2026-10-08T12:00:00.000Z', message: 'Status changed to Processing' },
    ],
  });
  assert.equal(orderPaidEventMs(reopened), new Date('2026-10-07T12:00:00.000Z').getTime());
});

test('findHeldBackOrders returns nothing while the held-back list is empty', () => {
  const inside = order({ status: 'Processing', activity_log: paidOn('2026-10-08T18:00:00.000Z') });
  assert.deepEqual(findHeldBackOrders([inside], { startMs: START, endMs: END }), []);
  assert.deepEqual(findHeldBackOrders([inside], {}), []);
  assert.deepEqual(findHeldBackOrders(null, { startMs: START, endMs: END }), []);
});

test('summarize and describe still add up when handed rows directly', () => {
  const rows = [
    order({ status: 'Processing', total_crc: 25330, total_usd: 55.48, activity_log: paidOn('2026-10-07T19:15:00.000Z') }),
    order({ status: 'Processing', total_crc: 150548, total_usd: 330, activity_log: paidOn('2026-10-08T18:10:44.000Z') }),
  ];
  assert.deepEqual(summarizeHeldBackOrders(rows, amounts), {
    count: 2,
    usd: 385.48,
    crc: 175878,
  });
  const described = describeHeldBackOrders(rows, amounts);
  assert.equal(described.length, 2);
  assert.equal(described[0].crc, 25330);
  assert.equal(heldBackSinceMs(rows[0]), new Date('2026-10-07T19:15:00.000Z').getTime());
});
