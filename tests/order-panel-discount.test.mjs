import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAdminOrderTotals, orderDiscountReplacesVolume } from '../src/lib/adminOrderTotals.mjs';

test('order panel preserves saved volume stacking before the 30% manual discount', () => {
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
  assert.equal(Math.round(totals.discountAmount), 69664);
  assert.equal(Math.round(totals.manualDiscountAmount), 118429);
  assert.equal(Math.round(totals.total), 276334);
});

test('saved opt-out and legacy source defaults are retained', () => {
  assert.equal(orderDiscountReplacesVolume({ source: 'website', apply_volume_discount: false }, 'none', 0), true);
  for (const flag of [undefined, null]) {
    assert.equal(orderDiscountReplacesVolume({ source: 'admin_manual', apply_volume_discount: flag }, 'percentage', 30), true);
    assert.equal(orderDiscountReplacesVolume({ source: 'website', apply_volume_discount: flag }, 'percentage', 30), false);
  }
  assert.equal(orderDiscountReplacesVolume({ source: 'admin_manual', apply_volume_discount: true }, 'fixed', 100), false);
});

test('volume toggle removes and restores stacking while retaining the manual discount', () => {
  const items = [{ product: 'BPC-157', qty: 5, price: 100 }];
  const savedOrder = { source: 'admin_manual', apply_volume_discount: true };
  for (const [enabled, expected] of [[false, 350], [true, 297.5]]) {
    const totals = calculateAdminOrderTotals(items, 0, {
      manualDiscountType: 'percentage',
      manualDiscountValue: 30,
      replaceVolumeDiscount: orderDiscountReplacesVolume(
        { ...savedOrder, apply_volume_discount: enabled }, 'percentage', 30,
      ),
    });
    assert.equal(totals.total, expected);
    assert.equal(totals.discountPct, enabled ? 15 : 0);
  }
});
