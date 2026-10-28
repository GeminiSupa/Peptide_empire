import { monthlyPayPeriod, monthlyPayAmounts, salaryFrequency } from './teamSalary.mjs';
import { isActiveProfile, isAffiliateTier, isSubUser } from './subUserTier.mjs';

export async function generateMonthlyTeamPay(admin, profile, month, rate, now = new Date()) {
  if (!profile || !isActiveProfile(profile) || isAffiliateTier(profile) || isSubUser(profile)) throw new Error('Choose an active team account.');
  if (salaryFrequency(profile) !== 'monthly') throw new Error('Set this team account to Monthly pay first.');
  const period = monthlyPayPeriod(month, now);
  const amounts = monthlyPayAmounts(profile.monthly_salary, profile.salary_currency, rate);
  const email = profile.email.trim().toLowerCase();
  async function existing() {
    const result = await admin.from('commission_payouts').select('*').eq('agent_email', email).eq('salary_frequency', 'monthly').eq('start_date', period.start).eq('end_date', period.end).neq('status', 'Rejected').maybeSingle();
    if (result.error) throw new Error('Monthly pay is unavailable. Check add-team-monthly-pay.sql and try again.');
    return result.data;
  }
  const saved = await existing();
  if (saved) return { payout: saved, existing: true };
  const row = {
    agent_id: profile.user_id, agent_email: email, agent_name: profile.name || email,
    start_date: period.start, end_date: period.end, salary_frequency: 'monthly',
    weekly_salary_paid: Number(profile.monthly_salary), salary_currency: profile.salary_currency,
    usd_sales: 0, crc_sales: 0, commission_rate: 0, usd_commission: 0, crc_commission: 0,
    total_payout_usd: amounts.usd, total_payout_crc: amounts.crc, orders_data: [], status: 'Pending',
    admin_notes: `Fixed monthly pay · ${period.label}. No commission included.`,
  };
  const result = await admin.from('commission_payouts').insert(row).select('*').single();
  if (result.error?.code === '23505') { const raced = await existing(); if (raced) return { payout: raced, existing: true }; }
  if (result.error) throw new Error('Could not create monthly pay. Check add-team-monthly-pay.sql and try again.');
  return { payout: result.data, existing: false };
}
