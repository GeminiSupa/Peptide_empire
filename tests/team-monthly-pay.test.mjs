import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSalarySettings, weeklyBasePay, monthlyPayPeriod, monthlyPayAmounts } from '../src/lib/teamSalary.mjs';
import { generateMonthlyTeamPay } from '../src/lib/monthlyTeamPay.mjs';
const now = new Date('2026-10-28T12:00:00Z');
const ziggy = { user_id: 'ziggy', name: 'Ziggy', email: 'ziggy@example.invalid', status: 'active', tier: 'staff', salary_frequency: 'monthly', monthly_salary: 500, salary_currency: 'USD', weekly_salary: 100 };
function fixture() {
  const rows = []; let inserts = 0;
  const admin = { from() { let filters = [], inserted;
    return { select() { return this; }, eq(key, value) { filters.push(row => row[key] === value); return this; }, neq(key, value) { filters.push(row => row[key] !== value); return this; },
      async maybeSingle() { return { data: rows.find(row => filters.every(fn => fn(row))) || null }; },
      insert(row) { inserted = row; return this; },
      async single() { inserts++; if (rows.some(row => row.agent_email === inserted.agent_email && row.start_date === inserted.start_date && row.end_date === inserted.end_date && row.status !== 'Rejected')) return { error: { code: '23505' } }; const row = { id: String(inserts), ...inserted }; rows.push(row); return { data: row }; },
    };
  } };
  return { admin, rows };
}
test('monthly salary never becomes weekly pay, and existing weekly pay is unchanged', () => {
  assert.equal(weeklyBasePay(ziggy), 0); assert.equal(weeklyBasePay({ weekly_salary: 100 }), 100);
  assert.deepEqual(validateSalarySettings({ ...ziggy }), { salary_frequency: 'monthly', salary_currency: 'USD', weekly_salary: 0, monthly_salary: 500 });
  assert.deepEqual(validateSalarySettings({ salary_frequency: 'weekly', weekly_salary: 75, monthly_salary: 500 }), { salary_frequency: 'weekly', salary_currency: 'USD', weekly_salary: 75, monthly_salary: 0 });
});
test('invalid salaries, frequencies and currencies are refused', () => {
  for (const amount of [-1, NaN, Infinity, 1000001]) assert.throws(() => validateSalarySettings({ ...ziggy, monthly_salary: amount }));
  assert.throws(() => validateSalarySettings({ salary_frequency: 'daily' })); assert.throws(() => validateSalarySettings({ salary_currency: 'EUR' }));
});
test('calendar months use Costa Rica boundaries, including leap years', () => {
  assert.deepEqual(monthlyPayPeriod('2024-02', now), { month: '2024-02', label: 'February 2024', start: '2024-02-01T06:00:00.000Z', end: '2024-03-01T05:59:59.999Z' });
  assert.equal(monthlyPayPeriod('2026-12', new Date('2027-01-01T03:00:00Z')).end, '2027-01-01T05:59:59.999Z');
  for (const month of ['2026-00','2026-13','2026-2','junk','2026-11']) assert.throws(() => monthlyPayPeriod(month, now));
});
test('USD and CRC monthly pay remain alternative equivalent amounts', () => {
  assert.deepEqual(monthlyPayAmounts(500, 'USD', 500), { usd: 500, crc: 250000 });
  assert.deepEqual(monthlyPayAmounts(250000, 'CRC', 500), { usd: 500, crc: 250000 });
  assert.throws(() => monthlyPayAmounts(0, 'USD', 500)); assert.throws(() => monthlyPayAmounts(500, 'USD', 0));
});
test('monthly generation is idempotent, including concurrent requests', async () => {
  const f = fixture();
  const results = await Promise.all([generateMonthlyTeamPay(f.admin, ziggy, '2026-10', 500, now), generateMonthlyTeamPay(f.admin, ziggy, '2026-10', 500, now)]);
  assert.equal(f.rows.length, 1); assert.equal(results.filter(row => row.existing).length, 1);
  assert.equal(f.rows[0].weekly_salary_paid, 500); assert.equal(f.rows[0].status, 'Pending'); assert.deepEqual(f.rows[0].orders_data, []); assert.equal(f.rows[0].commission_rate, 0);
});
test('approved monthly pay cannot be overwritten; each month gets its own row', async () => {
  const f = fixture(); await generateMonthlyTeamPay(f.admin, ziggy, '2026-09', 500, now); f.rows[0].status = 'Paid';
  const again = await generateMonthlyTeamPay(f.admin, { ...ziggy, monthly_salary: 900 }, '2026-09', 500, now);
  assert.equal(again.existing, true); assert.equal(f.rows[0].weekly_salary_paid, 500);
  await generateMonthlyTeamPay(f.admin, ziggy, '2026-10', 500, now); assert.equal(f.rows.length, 2);
});
test('rejected monthly pay can be replaced', async () => {
  const f = fixture(); await generateMonthlyTeamPay(f.admin, ziggy, '2026-10', 500, now); f.rows[0].status = 'Rejected';
  const next = await generateMonthlyTeamPay(f.admin, ziggy, '2026-10', 500, now); assert.equal(next.existing, false); assert.equal(f.rows.length, 2);
});
test('inactive, commission-only and weekly accounts cannot generate monthly pay', async () => {
  for (const patch of [{ status: 'pending' }, { status: 'suspended' }, { tier: 'affiliate' }, { tier: 'sub_user' }, { salary_frequency: 'weekly' }]) {
    const f = fixture(); await assert.rejects(generateMonthlyTeamPay(f.admin, { ...ziggy, ...patch }, '2026-10', 500, now)); assert.equal(f.rows.length, 0);
  }
});
test('missing monthly schema fails closed instead of generating a weekly payout', async () => {
  const f = fixture(); const base = f.admin.from;
  f.admin.from = function() { const q = base(); q.maybeSingle = async () => ({ error: { code: '42703' } }); return q; };
  await assert.rejects(generateMonthlyTeamPay(f.admin, ziggy, '2026-10', 500, now), /add-team-monthly-pay.sql/); assert.equal(f.rows.length, 0);
});
import { readFileSync } from 'node:fs';
function monthlyRoute(dependencies) {
  const source = readFileSync(new URL('../src/app/api/admin/commissions/monthly-pay/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export async function POST', 'async function POST');
  return new Function(...Object.keys(dependencies), `${source}; return POST;`)(...Object.values(dependencies));
}
test('monthly route refuses unauthorized requests before touching payroll', async () => {
  const POST = monthlyRoute({ NextResponse: Response, verifyAdminSession: async () => ({ error: Response.json({ error: 'Forbidden' }, { status: 403 }) }), getSupabaseAdmin() { throw new Error('Must not read'); } });
  const response = await POST(new Request('https://example.invalid', { method: 'POST', body: '{}' })); assert.equal(response.status, 403);
});
test('monthly route uses saved account terms, ignoring posted amounts and status', async () => {
  const f = fixture(); let received;
  const POST = monthlyRoute({ NextResponse: Response, verifyAdminSession: async () => ({ profile: { is_superadmin: true } }), getSupabaseAdmin: () => ({ from: () => ({ select() { return this; }, eq(key, value) { assert.equal(key, 'user_id'); assert.equal(value, 'ziggy'); return this; }, async maybeSingle() { return { data: ziggy }; } }) }), getDatabaseBackedUsdToCrcRate: async () => ({ rate: 500 }), generateMonthlyTeamPay: async (admin, profile, month, rate) => { received = profile; return generateMonthlyTeamPay(f.admin, profile, month, rate, now); } });
  const response = await POST(new Request('https://example.invalid', { method: 'POST', body: JSON.stringify({ userId: 'ziggy', month: '2026-10', monthly_salary: 999999, salary_currency: 'CRC', status: 'Paid' }) }));
  assert.equal(response.status, 200); assert.equal(received.monthly_salary, 500); assert.equal(f.rows[0].status, 'Pending'); assert.equal(f.rows[0].weekly_salary_paid, 500);
});
