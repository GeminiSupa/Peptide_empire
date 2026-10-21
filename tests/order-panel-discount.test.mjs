import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAdminOrderTotals, orderDiscountReplacesVolume } from '../src/lib/adminOrderTotals.mjs';

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
