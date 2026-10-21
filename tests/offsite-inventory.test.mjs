import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  planOffsiteTransfer,
  nextOffsiteAfterStockChange,
  summariseOffsiteStock,
  onSiteOf,
} from '../src/lib/offsiteInventory.mjs';
import { inventoryReservationPlan } from '../src/lib/orderInventoryServer.js';
import { adminPermissionsForPath } from '../src/lib/adminApiPermissions.mjs';
import { resolveAdminTabAccess } from '../src/lib/adminModules.js';

const product = (overrides = {}) => ({
  id: 'p1',
  product: 'GHK-Cu 50mg',
  inventory_count: 20,
  offsite_inventory_count: 8,
  ...overrides,
});

test('giving him vials raises offsite without touching total', () => {
  const plan = planOffsiteTransfer(product(), { qty: 3, direction: 'to_offsite' });
  assert.equal(plan.ok, true);
  assert.equal(plan.after, 11);
  assert.equal(plan.total, 20);
  assert.equal(onSiteOf({ ...product(), offsite_inventory_count: plan.after }), 9);
});

test('cannot give him more than is on site', () => {
  const plan = planOffsiteTransfer(product(), { qty: 13, direction: 'to_offsite' });
  assert.equal(plan.ok, false);
  assert.match(plan.error, /Only 12/);
});

test('taking back lowers offsite only', () => {
  const plan = planOffsiteTransfer(product(), { qty: 5, direction: 'from_offsite' });
  assert.equal(plan.ok, true);
  assert.equal(plan.after, 3);
  assert.equal(plan.total, 20);
});

test('cannot take back more than he holds', () => {
  const plan = planOffsiteTransfer(product(), { qty: 9, direction: 'from_offsite' });
  assert.equal(plan.ok, false);
  assert.match(plan.error, /only holds 8/);
});

test('paid order deducts offsite with the same delta', () => {
  // 20 → 15 total, he held 8 → 3
  const result = nextOffsiteAfterStockChange(20, 15, 8);
  assert.equal(result.after, 3);
  assert.equal(result.shortfall, 0);
  assert.equal(result.delta, -5);
});

test('order shortfall when he packed more than logged', () => {
  // Need 10, he only had 3 logged → offsite hits 0, shortfall 7
  const result = nextOffsiteAfterStockChange(20, 10, 3);
  assert.equal(result.after, 0);
  assert.equal(result.shortfall, 7);
});

test('restore adds the same delta back to offsite', () => {
  const result = nextOffsiteAfterStockChange(10, 15, 2);
  assert.equal(result.after, 7);
  assert.equal(result.shortfall, 0);
});

test('reservation plan carries offsite after + shortfall', () => {
  const plan = inventoryReservationPlan(
    [],
    [{ product: 'GHK-Cu 50mg', qty: 5 }],
    [product({ inventory_count: 20, offsite_inventory_count: 8 })],
  );
  assert.equal(plan.ok, true);
  assert.equal(plan.changes[0].after, 15);
  assert.equal(plan.changes[0].offsiteAfter, 3);
  assert.equal(plan.changes[0].offsiteShortfall, 0);
});

test('reservation plan flags offsite shortfall', () => {
  const plan = inventoryReservationPlan(
    [],
    [{ product: 'GHK-Cu 50mg', qty: 10 }],
    [product({ inventory_count: 20, offsite_inventory_count: 2 })],
  );
  assert.equal(plan.ok, true);
  assert.equal(plan.changes[0].offsiteAfter, 0);
  assert.equal(plan.changes[0].offsiteShortfall, 8);
});

test('summarise puts empty-offsite products first', () => {
  const rows = summariseOffsiteStock([
    product({ id: 'a', product: 'AAA', inventory_count: 5, offsite_inventory_count: 2 }),
    product({ id: 'b', product: 'BBB', inventory_count: 5, offsite_inventory_count: 0 }),
  ]);
  assert.equal(rows[0].product, 'BBB');
  assert.equal(rows[0].low, true);
  assert.equal(rows[1].onSite, 3);
});

test('offsite API and tab are permission-gated', () => {
  assert.deepEqual(adminPermissionsForPath('/api/admin/offsite-inventory'), ['offsite_inventory']);
  assert.equal(
    resolveAdminTabAccess('offsite_inventory', {
      is_superadmin: true,
      status: 'active',
      tier: 'staff',
    }),
    true,
  );
  assert.equal(
    resolveAdminTabAccess('offsite_inventory', {
      is_superadmin: false,
      status: 'active',
      tier: 'staff',
      permissions: ['orders'],
    }),
    false,
  );
  assert.equal(
    resolveAdminTabAccess('offsite_inventory', {
      is_superadmin: false,
      status: 'active',
      tier: 'staff',
      permissions: ['offsite_inventory'],
    }),
    true,
  );
});
