import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firstOrderExtraArmed, planFirstOrderExtra, planFirstOrderExtraSetting } from '../src/lib/businessFirstOrderExtra.mjs';
import { additionalCommissionOrders } from '../src/lib/additionalCommission.mjs';
import { priceStampedOverrideOrders } from '../src/lib/subUserCommission.mjs';
import { computeOrderCommissionAmounts } from '../src/lib/orderCommission.mjs';
import { getOrderSalesAmounts } from '../src/lib/commissionSalesAmounts.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const dani = { user_id: 'dani', name: 'Dani', email: 'dani@example.invalid', status: 'active', tier: 'staff', is_superadmin: true };
const melissa = { user_id: 'melissa', name: 'Melissa López Sánchez', email: 'melissa@example.invalid', status: 'active', tier: 'staff' };
const profiles = [dani, melissa];
const now = '2026-11-03T10:00:00Z';
const business = { id: 'biz', legal_name: 'Skin Care Center Dr. Pedrosa', status: 'approved', rep_user_id: 'dani', rep_commission_pct: 10, first_order_extra_user_id: 'melissa', first_order_extra_pct: 10, first_order_extra_used_at: null };
// What applyBusinessOrderAttribution leaves on a business order: rep credited at their agreed rate.
const order = { order_number: 'PCR-TEST-1', sales_agent: 'Dani', agent_commission_source: 'business_account', agent_commission_rate_override: 10, status: 'Paid', total_usd: 100, total_crc: 50000, created_at: '2026-11-03T00:00:00Z', items: [{ product: 'BPC-157', qty: 1, price: 100 }] };

test('first order gets Melissa 10% while the rep keeps 10% and ownership', () => {
  const plan = planFirstOrderExtra({ business, order, profiles, now });
  assert.equal(plan.apply, true);
  assert.equal(plan.patch.additional_commission_user_id, 'melissa');
  assert.equal(plan.patch.additional_commission_pct, 10);
  assert.equal(plan.patch.additional_commission_assigned_at, now);
  assert.ok(plan.patch.additional_commission_reason.length >= 5 && plan.patch.additional_commission_reason.length <= 500);
  assert.equal(plan.patch.sales_agent, undefined);
  assert.equal(plan.patch.agent_commission_rate_override, undefined);
  assert.equal(plan.activity.type, 'additional_commission_updated');
  assert.match(plan.activity.message, /Melissa López Sánchez 10% alongside Dani/);

  const saved = { ...order, ...plan.patch };
  // Melissa's report line: 10% of the net sale.
  assert.equal(priceStampedOverrideOrders(additionalCommissionOrders([saved], melissa), getOrderSalesAmounts).overrideUsd, 10);
  // Dani's own commission on the same order is still her agreed 10%.
  assert.equal(computeOrderCommissionAmounts(saved, 20, getOrderSalesAmounts).usdCommission, 10);
  // Nothing about Dani appears on Melissa's report and vice versa.
  assert.equal(additionalCommissionOrders([saved], dani).length, 0);
});

test('a spent, unset, or unapproved setting stamps nothing', () => {
  assert.equal(firstOrderExtraArmed(business), true);
  assert.equal(planFirstOrderExtra({ business: { ...business, first_order_extra_used_at: now }, order, profiles }).apply, false);
  assert.equal(planFirstOrderExtra({ business: { ...business, first_order_extra_user_id: null, first_order_extra_pct: null }, order, profiles }).apply, false);
  assert.equal(planFirstOrderExtra({ business: { ...business, first_order_extra_pct: 0 }, order, profiles }).apply, false);
  // Before the migration the columns simply do not exist.
  assert.equal(planFirstOrderExtra({ business: { id: 'biz', status: 'approved' }, order, profiles }).apply, false);
  const pending = planFirstOrderExtra({ business: { ...business, status: 'suspended' }, order, profiles });
  assert.equal(pending.apply, false);
  assert.ok(pending.skipped);
});

test('re-checks the person at order time instead of trusting the saved setting', () => {
  const suspended = planFirstOrderExtra({ business, order, profiles: [dani, { ...melissa, status: 'suspended' }] });
  assert.equal(suspended.apply, false);
  assert.ok(suspended.skipped);
  const sameAsRep = planFirstOrderExtra({ business, order: { ...order, sales_agent: 'Melissa López Sánchez' }, profiles });
  assert.equal(sameAsRep.apply, false);
  assert.ok(sameAsRep.skipped);
});

test('admin form: changing person or percent arms it, an ordinary edit does not', () => {
  const body = { first_order_extra_user_id: 'melissa', first_order_extra_pct: '10' };
  const fresh = planFirstOrderExtraSetting({ body, previous: null, repUserId: 'dani', profiles });
  assert.deepEqual(fresh.patch, { first_order_extra_user_id: 'melissa', first_order_extra_pct: 10, first_order_extra_used_at: null, first_order_extra_order_number: null });

  const spent = { first_order_extra_user_id: 'melissa', first_order_extra_pct: 10, first_order_extra_used_at: now, first_order_extra_order_number: 'PCR-1' };
  assert.deepEqual(planFirstOrderExtraSetting({ body, previous: spent, repUserId: 'dani', profiles }).patch, {}, 'saving other terms must not re-arm a spent extra');
  assert.equal(planFirstOrderExtraSetting({ body: { ...body, first_order_extra_pct: 12 }, previous: spent, repUserId: 'dani', profiles }).patch.first_order_extra_used_at, null);

  assert.deepEqual(planFirstOrderExtraSetting({ body: {}, previous: spent, repUserId: 'dani', profiles }).patch, {}, 'a form from before the migration touches nothing');
  assert.deepEqual(planFirstOrderExtraSetting({ body: { first_order_extra_user_id: '' }, previous: null, repUserId: 'dani', profiles }).patch, {}, 'a new business with no extra writes no new columns');
  const cleared = planFirstOrderExtraSetting({ body: { first_order_extra_user_id: '' }, previous: spent, repUserId: 'dani', profiles });
  assert.equal(cleared.patch.first_order_extra_user_id, null);
  assert.equal(cleared.patch.first_order_extra_pct, null);
});

test('admin form refuses a bad person, the rep themselves, or a bad percent', () => {
  const ok = { first_order_extra_user_id: 'melissa', first_order_extra_pct: 10 };
  assert.equal(planFirstOrderExtraSetting({ body: ok, previous: null, repUserId: 'melissa', profiles }).ok, false);
  assert.equal(planFirstOrderExtraSetting({ body: ok, previous: null, repUserId: 'dani', profiles: [dani, { ...melissa, status: 'suspended' }] }).ok, false);
  assert.equal(planFirstOrderExtraSetting({ body: { ...ok, first_order_extra_user_id: 'ghost' }, previous: null, repUserId: 'dani', profiles }).ok, false);
  for (const pct of [0, -5, 101, 'abc', '']) assert.equal(planFirstOrderExtraSetting({ body: { ...ok, first_order_extra_pct: pct }, previous: null, repUserId: 'dani', profiles }).ok, false, `pct ${pct}`);
});

function sourceFunctions(path, names, dependencies) {
  const source = read(path).replace(/^import .*;\r?\n/gm, '').replace(/export (?=(?:async )?function)/g, '');
  return new Function(...Object.keys(dependencies), `${source}\nreturn {${names.join(',')}};`)(...Object.values(dependencies));
}
// A just-enough Supabase stand-in that records the claim update and can lose the race.
function fakeAdmin({ winsClaim = true, claimError = null } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const query = { table, filters: [] };
      const builder = {
        select() { return table === 'admin_profiles' ? Promise.resolve({ data: profiles, error: null }) : builder; },
        update(payload) { query.update = payload; return builder; },
        insert(payload) { calls.push({ table, insert: payload }); return Promise.resolve({ error: null }); },
        eq(column, value) { query.filters.push(['eq', column, value]); return builder; },
        is(column, value) { query.filters.push(['is', column, value]); return builder; },
        async maybeSingle() { calls.push(query); return claimError ? { data: null, error: claimError } : { data: winsClaim ? { id: 'biz' } : null, error: null }; },
        then(resolve) { calls.push(query); resolve({ error: null }); },
      };
      return builder;
    },
  };
}
const deps = { firstOrderExtraArmed, planFirstOrderExtra };

test('the claim is one conditional update, and only the winner gets the extra', async () => {
  const { claimFirstOrderExtraCommission } = sourceFunctions('src/lib/businessSuiteServer.js', ['claimFirstOrderExtraCommission'], deps);
  const winner = fakeAdmin();
  const result = await claimFirstOrderExtraCommission(winner, order, business);
  assert.equal(result.patch.additional_commission_user_id, 'melissa');
  const claim = winner.calls.find((call) => call.update);
  assert.equal(claim.table, 'business_accounts');
  assert.equal(claim.update.first_order_extra_order_number, 'PCR-TEST-1');
  assert.deepEqual(claim.filters.find(([kind]) => kind === 'is'), ['is', 'first_order_extra_used_at', null], 'must only claim while unused');

  assert.equal(await claimFirstOrderExtraCommission(fakeAdmin({ winsClaim: false }), order, business), null, 'the second simultaneous order gets nothing');
});

test('a problem never blocks the sale and tells the team to add it by hand', async () => {
  const { claimFirstOrderExtraCommission } = sourceFunctions('src/lib/businessSuiteServer.js', ['claimFirstOrderExtraCommission'], deps);
  const broken = fakeAdmin({ claimError: { message: 'boom' } });
  assert.equal(await claimFirstOrderExtraCommission(broken, order, business), null);
  const note = broken.calls.find((call) => call.insert);
  assert.equal(note.insert.type, 'first_order_extra_skipped');
  assert.match(note.insert.body, /by hand/);
  const quiet = fakeAdmin();
  assert.equal(await claimFirstOrderExtraCommission(quiet, order, { ...business, first_order_extra_user_id: null }), null);
  assert.equal(quiet.calls.length, 0, 'nothing configured means nothing touched');
});

test('customers never see what the team earns on their account', () => {
  const { publicBusiness } = sourceFunctions('src/lib/businessSuiteServer.js', ['publicBusiness'], deps);
  const shown = publicBusiness({ ...business, first_order_extra_used_at: now, first_order_extra_order_number: 'PCR-1' });
  for (const key of ['rep_user_id', 'rep_commission_pct', 'first_order_extra_user_id', 'first_order_extra_pct', 'first_order_extra_used_at', 'first_order_extra_order_number']) assert.equal(Object.hasOwn(shown, key), false, key);
  assert.equal(shown.legal_name, 'Skin Care Center Dr. Pedrosa');
});

test('checkout takes the extra just before saving, hands it back on failure, and still ignores the browser', () => {
  const route = read('src/app/api/orders/create/route.js');
  const strip = route.indexOf('delete order.additional_commission_user_id');
  const claim = route.indexOf('claimFirstOrderExtraCommission(supabase, orderRow, business)');
  const bankLog = route.indexOf('orderRow.activity_log = [{ at: new Date().toISOString(), type: \'bank_payment_instructions\'');
  const insert = route.indexOf(".from('orders').insert(row)");
  assert.ok(strip > 0 && claim > strip, 'browser-sent extra fields are stripped before ours is added');
  assert.ok(claim > bankLog, 'taken after the bank-instructions log so that log is not overwritten');
  assert.ok(claim < insert, 'taken before the order is saved');
  const failureAt = route.indexOf('if (error) {\n      if (firstOrderExtra)');
  assert.ok(failureAt > insert, 'the hand-back sits in the insert-failed branch');
  assert.match(route.slice(failureAt, failureAt + 200),/releaseFirstOrderExtraCommission\(supabase, business, orderRow\.order_number\)/);
});

test('admin portal can set it and refuses to save silently without the migration', () => {
  const api = read('src/app/api/admin/business-accounts/route.js');
  assert.match(api, /planFirstOrderExtraSetting/);
  assert.match(api, /add-business-first-order-extra\.sql/);
  const panel = read('src/components/admin/BusinessAccountsPanel.js');
  assert.match(panel, /One-time extra commission for/);
  assert.match(panel, /first_order_extra_pct/);
  assert.match(read('add-business-first-order-extra.sql'), /first_order_extra_used_at/);
});
