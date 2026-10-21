import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAdminOrderTotals, orderDiscountReplacesVolume, recordedAdminOrderTotals, singleDiscountOrderTotals } from '../src/lib/adminOrderTotals.mjs';

test('paid legacy order displays the receipt amounts despite the new no-stacking rule', () => {
  const order = {
    currency: 'CRC', source: 'admin_manual', apply_volume_discount: true,
    items: [{ product: 'BPC-157', qty: 1, price: 464427 }],
    manual_discount_type: 'percentage', manual_discount_value: 30,
    manual_discount_amount_crc: 118429, total_crc: 276334,
  };
  const totals = recordedAdminOrderTotals(order);
  assert.equal(totals.total, 276334);
  assert.equal(totals.manualDiscountAmount, 118429);
  assert.equal(totals.discountAmount, 69664);
  assert.equal(totals.discountPct, 15);
  assert.equal(orderDiscountReplacesVolume(order, 'percentage', 30), true);
  const corrected = singleDiscountOrderTotals(order);
  assert.equal(Math.round(corrected.total), 325099);
  assert.equal(corrected.discountAmount, 0);
  assert.equal(Math.round(corrected.manualDiscountAmount), 139328);
  assert.equal(order.total_crc, 276334);
});

test('recorded USD amounts include shipping and promo without repricing', () => {
  const totals = recordedAdminOrderTotals({
    currency: 'USD', items: [{ product: 'BPC-157', qty: 5, price: 100 }],
    discount_amount_usd: 50, manual_discount_amount_usd: 0,
    shipping_cost_usd: 10, total_usd: 460,
  });
  assert.equal(totals.total, 460);
  assert.equal(totals.promoDiscountAmount, 50);
  assert.equal(totals.discountAmount, 0);
});

test('volume toggle still works without a special discount', () => {
  const items = [{ product: 'BPC-157', qty: 5, price: 100 }];
  for (const enabled of [false, true]) {
    const totals = calculateAdminOrderTotals(items, 0, {
      replaceVolumeDiscount: orderDiscountReplacesVolume(
        { apply_volume_discount: enabled }, 'none', 0,
      ),
    });
    assert.equal(totals.total, enabled ? 425 : 500);
  }
});

test('30% custom discount replaces saved volume stacking', () => {
  const order = { source: 'admin_manual', apply_volume_discount: true };
  const totals = calculateAdminOrderTotals([
    { product: 'GLP-1', qty: 5, price: 68298 },
    { product: 'BPC-157', qty: 1, price: 122937 },
    { product: 'Agua Bacteriostática 3ml (Regalo)', qty: 6, price: 0 },
  ], 0, {
    volumeDiscountPct: 15,
    manualDiscountType: 'percentage',
    manualDiscountValue: 30,
    replaceVolumeDiscount: orderDiscountReplacesVolume(order, 'percentage', 30),
  });
  assert.equal(totals.itemsSubtotal, 464427);
  assert.equal(totals.discountAmount, 0);
  assert.equal(Math.round(totals.manualDiscountAmount), 139328);
  assert.equal(Math.round(totals.total), 325099);
});

test('saved opt-out and legacy source defaults are retained', () => {
  assert.equal(orderDiscountReplacesVolume({ source: 'website', apply_volume_discount: false }, 'none', 0), true);
  for (const flag of [undefined, null]) {
    assert.equal(orderDiscountReplacesVolume({ source: 'admin_manual', apply_volume_discount: flag }, 'percentage', 30), true);
    assert.equal(orderDiscountReplacesVolume({ source: 'website', apply_volume_discount: flag }, 'percentage', 30), true);
  }
  assert.equal(orderDiscountReplacesVolume({ source: 'admin_manual', apply_volume_discount: true }, 'fixed', 100), true);
});

test('volume toggle cannot stack with a custom discount', () => {
  const items = [{ product: 'BPC-157', qty: 5, price: 100 }];
  const savedOrder = { source: 'admin_manual', apply_volume_discount: true };
  for (const [enabled, expected] of [[false, 350], [true, 350]]) {
    const totals = calculateAdminOrderTotals(items, 0, {
      manualDiscountType: 'percentage',
      manualDiscountValue: 30,
      replaceVolumeDiscount: orderDiscountReplacesVolume(
        { ...savedOrder, apply_volume_discount: enabled }, 'percentage', 30,
      ),
    });
    assert.equal(totals.total, expected);
    assert.equal(totals.discountPct, 0);
  }
});
