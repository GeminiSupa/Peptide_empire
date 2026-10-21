import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrderSalesAmounts, commissionPricingOrder } from '../src/lib/commissionSalesAmounts.mjs';
import { computeOrderCommissionAmounts, summarizeOrderCommissions } from '../src/lib/orderCommission.mjs';
import { stampOverrideOrder, priceStampedOverrideOrders } from '../src/lib/subUserCommission.mjs';

const order = {
  currency: 'CRC', items: [{ product: 'GLP-1', qty: 1, price: 464427 }],
  manual_discount_type: 'percentage', manual_discount_value: 30,
  total_crc: 276334, total_usd: 606.90,
};

test('agent pay and weekly totals use only the special discount', () => {
  const sales = getOrderSalesAmounts(order);
  assert.equal(Math.round(sales.crc), 325099);
  const commission = computeOrderCommissionAmounts(order, 10, getOrderSalesAmounts);
  assert.equal(commission.crcCommission, 32509.9);
  assert.equal(summarizeOrderCommissions([order], 10, getOrderSalesAmounts).crcCommission, 32509.9);
  assert.equal(order.total_crc, 276334);
});

test('refunds and per-order commission overrides are retained', () => {
  const commission = computeOrderCommissionAmounts({
    ...order, refunded_amount_crc: 10000, refunded_amount_usd: 20,
    agent_commission_rate_override: 20,
  }, 10, getOrderSalesAmounts);
  assert.equal(commission.rate, 20);
  assert.equal(commission.crcCommission, 63019.8);
});

test('ordinary orders and incomplete historical snapshots retain their saved totals', () => {
  assert.deepEqual(getOrderSalesAmounts({ total_usd: 100, total_crc: 50000 }), { usd: 100, crc: 50000 });
  const snapshot = { ...order, items: undefined };
  assert.equal(commissionPricingOrder(snapshot), snapshot);
  assert.equal(getOrderSalesAmounts(snapshot).crc, 276334);
});

test('parent agent override uses the same corrected commission base', () => {
  const stamped = stampOverrideOrder(order, { rate: 2, name: 'Parent' });
  const summary = priceStampedOverrideOrders([stamped], getOrderSalesAmounts);
  assert.equal(summary.salesCrc, 325099);
  assert.equal(summary.overrideCrc, 6501.98);
});
