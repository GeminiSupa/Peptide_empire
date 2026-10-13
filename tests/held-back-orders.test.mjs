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

test('held-back statuses never overlap the statuses the scan already counts', () => {
  for (const status of HELD_BACK_ORDER_STATUSES) {
    assert.equal(
      COMMISSION_ELIGIBLE_ORDER_STATUSES.some((s) => s.toLowerCase() === status.toLowerCase()),
      false,
      `${status} is already counted by the scan; alerting on it would double-report`,
    );
  }
});

test('Processing is held back; nothing else in the lifecycle is', () => {
  assert.equal(isHeldBackStatus('Processing'), true);
  assert.equal(isHeldBackStatus('  processing  '), true, 'case and padding must not matter');
  for (const status of [
    'Pending', 'Payment Pending', 'Pending - Card', 'Pending - Card 3DS',
    'Declined', 'Error', 'Payment Blocked', 'Paid', 'Order Complete',
    'Partly Refunded', 'Refunded', 'Cancelled', '', null, undefined,
  ]) {
    assert.equal(isHeldBackStatus(status), false, `${status} must not be reported as held back`);
  }
});

test('the paid date comes from the log, and never falls back to created_at', () => {
  const paid = order({ status: 'Processing', activity_log: paidOn('2026-10-08T18:00:00.000Z') });
  assert.equal(orderPaidEventMs(paid), new Date('2026-10-08T18:00:00.000Z').getTime());

  const neverPaid = order({ status: 'Processing', created_at: '2026-10-08T18:00:00.000Z', activity_log: [] });
  assert.ok(Number.isNaN(orderPaidEventMs(neverPaid)), 'no payment event means no payment date');
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

test('an order paid before or after the week is not this week\'s problem', () => {
  const tooEarly = order({ status: 'Processing', activity_log: paidOn('2026-10-04T23:00:00.000Z') });
  const tooLate = order({ status: 'Processing', activity_log: paidOn('2026-10-12T07:00:00.000Z') });
  const inside = order({ status: 'Processing', activity_log: paidOn('2026-10-08T18:00:00.000Z') });
  const found = findHeldBackOrders([tooEarly, tooLate, inside], { startMs: START, endMs: END });
  assert.deepEqual(found, [inside]);
});

test('the window edges are inclusive, matching the scan', () => {
  const first = order({ order_number: 'FIRST', status: 'Processing', activity_log: paidOn(new Date(START).toISOString()) });
  const last = order({ order_number: 'LAST', status: 'Processing', activity_log: paidOn(new Date(END).toISOString()) });
  const found = findHeldBackOrders([first, last], { startMs: START, endMs: END });
  assert.deepEqual(found.map((o) => o.order_number), ['FIRST', 'LAST']);
});

test('a deliberate reversal is not reported as held-back money', () => {
  // Production holds several of these: marked Paid, then moved back to Pending
  // minutes later by a person. That is a correction, not fulfilment running late.
  const reversed = order({
    status: 'Pending',
    activity_log: [
      { type: 'status_change', at: '2026-10-09T19:36:00.000Z', message: 'Status changed to Paid' },
      { type: 'status_change', at: '2026-10-09T19:36:30.000Z', message: 'Status changed to Pending' },
    ],
  });
  assert.deepEqual(findHeldBackOrders([reversed], { startMs: START, endMs: END }), []);
});

test('a Processing order with no payment ever logged still counts, dated by its created day', () => {
  // Eleven of these sit in production: moved straight from Pending to
  // Processing with no payment event written. Over a million colones that no
  // commission report has ever counted. Dating by the log alone would leave
  // this warning blind to them.
  const neverLogged = order({
    order_number: 'WPCR-MQFVAKCH',
    customer_name: 'Ricardo Sanchez Gaitan',
    status: 'Processing',
    total_crc: 763528,
    created_at: '2026-10-07T18:00:00.000Z',
    activity_log: [{ type: 'status_change', at: '2026-10-07T18:01:00.000Z', message: 'Status changed to Processing' }],
  });
  assert.equal(heldBackSinceMs(neverLogged), new Date('2026-10-07T18:00:00.000Z').getTime());
  assert.deepEqual(findHeldBackOrders([neverLogged], { startMs: START, endMs: END }), [neverLogged]);
  assert.equal(describeHeldBackOrders([neverLogged], amounts)[0].paymentNeverLogged, true);

  // Outside the week it is still somebody else's problem, not this report's.
  const older = order({ status: 'Processing', created_at: '2026-06-15T18:00:00.000Z', activity_log: [] });
  assert.deepEqual(findHeldBackOrders([older], { startMs: START, endMs: END }), []);
});

test('a logged payment always beats created_at', () => {
  const both = order({
    status: 'Processing',
    created_at: '2026-10-06T12:00:00.000Z',
    activity_log: paidOn('2026-10-08T12:00:00.000Z'),
  });
  assert.equal(heldBackSinceMs(both), new Date('2026-10-08T12:00:00.000Z').getTime());
  assert.equal(describeHeldBackOrders([both], amounts)[0].paymentNeverLogged, false);
});

test('a Processing order with no usable date at all is dropped, not thrown on', () => {
  const undated = order({ status: 'Processing', created_at: null, activity_log: [] });
  const garbage = order({ status: 'Processing', created_at: 'not a date', activity_log: [] });
  assert.ok(Number.isNaN(heldBackSinceMs(undated)));
  assert.deepEqual(findHeldBackOrders([undated, garbage], { startMs: START, endMs: END }), []);
});

test('an unpaid order sitting in the week is not reported as missing money', () => {
  const pending = order({ status: 'Pending', created_at: '2026-10-07T12:00:00.000Z', activity_log: [] });
  const declined = order({ status: 'Declined', created_at: '2026-10-07T12:00:00.000Z', activity_log: [] });
  assert.deepEqual(findHeldBackOrders([pending, declined], { startMs: START, endMs: END }), []);
});

test('a bad window returns nothing rather than throwing', () => {
  const held = order({ status: 'Processing', activity_log: paidOn('2026-10-08T18:00:00.000Z') });
  assert.deepEqual(findHeldBackOrders([held], {}), []);
  assert.deepEqual(findHeldBackOrders([held], { startMs: Number.NaN, endMs: END }), []);
  assert.deepEqual(findHeldBackOrders(null, { startMs: START, endMs: END }), []);
});

test('the summary adds up in both currencies and survives a missing pricer', () => {
  const orders = [
    order({ status: 'Processing', total_crc: 25330, total_usd: 55.48, activity_log: paidOn('2026-10-07T19:15:00.000Z') }),
    order({ status: 'Processing', total_crc: 150548, total_usd: 330, activity_log: paidOn('2026-10-08T18:10:44.000Z') }),
  ];
  const summary = summarizeHeldBackOrders(orders, amounts);
  assert.equal(summary.count, 2);
  assert.equal(summary.crc, 175878);
  assert.equal(Number(summary.usd.toFixed(2)), 385.48);

  const blank = summarizeHeldBackOrders(orders, undefined);
  assert.deepEqual(blank, { count: 2, usd: 0, crc: 0 });
  assert.deepEqual(summarizeHeldBackOrders([], amounts), { count: 0, usd: 0, crc: 0 });
});

test('each held-back order describes itself for the email', () => {
  const held = order({
    order_number: 'CARD-MUYHH69T',
    customer_name: 'Alexandra Gómez Rodríguez',
    status: 'Processing',
    total_crc: 25330,
    total_usd: 55.48,
    activity_log: paidOn('2026-10-07T19:15:00.000Z'),
  });
  assert.deepEqual(describeHeldBackOrders([held], amounts), [{
    orderNumber: 'CARD-MUYHH69T',
    customerName: 'Alexandra Gómez Rodríguez',
    status: 'Processing',
    paidAt: '2026-10-07T19:15:00.000Z',
    paymentNeverLogged: false,
    usd: 55.48,
    crc: 25330,
  }]);
});

test('replays the real 12 Oct 2026 miss: all eight orders, ₡818,841', () => {
  // Taken from production. Every one was paid inside the week, still sat at
  // 'Processing' when the scan ran at 08:00:10 Costa Rica on Monday 12 Oct, and
  // was closed by fulfilment between 09:28 and 12:00 that same morning.
  const real = [
    ['CARD-MUYHH69T', 'Alexandra Gómez Rodríguez', 25330, '2026-10-07T19:15:00.000Z'],
    ['WPCR-MUZUQ3OH', 'Mitchelle', 150548, '2026-10-08T18:10:44.000Z'],
    ['WPCR-MV06NL94', 'Grettel Oconitrillo Zamora', 107209, '2026-10-08T23:58:00.000Z'],
    ['WPCR-MV0HAATF', 'Francella González Madrigal', 158670, '2026-10-09T04:42:01.000Z'],
    ['CARD-MV15JXBL', 'Jessica Lugo', 50163, '2026-10-09T16:05:00.000Z'],
    ['CARD-MV1GJNTO', 'Ericka Ramirez', 113481, '2026-10-09T21:12:00.000Z'],
    ['WPCR-MV2P7NPX', 'Davide Grilli', 104568, '2026-10-10T18:31:00.000Z'],
    ['WPCR-MV2PQPYS', 'Jamie Atherton', 108872, '2026-10-11T16:09:01.000Z'],
  ].map(([num, name, crc, at]) => order({
    order_number: num, customer_name: name, status: 'Processing', total_crc: crc, total_usd: 0,
    activity_log: paidOn(at),
  }));

  // Orders the same scan correctly counted, which must not be flagged as well.
  const alreadyCounted = [
    order({ order_number: 'WPCR-MUZTRZQS', status: 'Paid', total_crc: 85539, activity_log: paidOn('2026-10-08T19:59:23.000Z') }),
    order({ order_number: 'WPCR-MUYDHNPY', status: 'Order Complete', total_crc: 95885, activity_log: paidOn('2026-10-07T17:34:26.000Z') }),
  ];

  const found = findHeldBackOrders([...real, ...alreadyCounted], { startMs: START, endMs: END });
  assert.equal(found.length, 8, 'all eight, and only the eight');
  assert.equal(summarizeHeldBackOrders(found, amounts).crc, 818841);
});
