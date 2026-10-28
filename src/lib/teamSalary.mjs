export function salaryFrequency(profile) { return profile?.salary_frequency === 'monthly' ? 'monthly' : 'weekly'; }
export function weeklyBasePay(profile) { return salaryFrequency(profile) === 'monthly' ? 0 : Number(profile?.weekly_salary || 0); }
export function validateSalarySettings(body) {
  const frequency = body.salary_frequency ?? 'weekly';
  if (!['weekly', 'monthly'].includes(frequency)) throw new Error('Choose Weekly or Monthly pay.');
  const currency = body.salary_currency ?? 'USD';
  if (!['USD', 'CRC'].includes(currency)) throw new Error('Choose USD or CRC for base pay.');
  const amount = Number(frequency === 'monthly' ? body.monthly_salary ?? 0 : body.weekly_salary ?? 0);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) throw new Error('Base pay must be between 0 and 1,000,000.');
  return { salary_frequency: frequency, salary_currency: currency, weekly_salary: frequency === 'weekly' ? amount : 0, monthly_salary: frequency === 'monthly' ? amount : 0 };
}
export function monthlyPayPeriod(month, now = new Date()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) throw new Error('Choose a valid payment month.');
  const [year, number] = month.split('-').map(Number);
  if (year < 2020 || year > 2100) throw new Error('Choose a payment year between 2020 and 2100.');
  // Compare numeric year/month: Intl punctuation varies across runtimes.
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const current = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
  if (month > current) throw new Error('Future months cannot be generated yet.');
  const start = new Date(Date.UTC(year, number - 1, 1, 6));
  const end = new Date(Date.UTC(year, number, 1, 6) - 1);
  return { start: start.toISOString(), end: end.toISOString(), month, label: new Intl.DateTimeFormat('en', { timeZone: 'America/Costa_Rica', month: 'long', year: 'numeric' }).format(start) };
}
export function monthlyPayAmounts(amount, currency, rate) {
  if (!Number.isFinite(Number(rate)) || Number(rate) <= 0) throw new Error('A valid exchange rate is required.');
  const settings = validateSalarySettings({ salary_frequency: 'monthly', monthly_salary: amount, salary_currency: currency });
  if (settings.monthly_salary <= 0) throw new Error('Set a positive monthly amount on this team account first.');
  return { usd: Math.round((currency === 'USD' ? settings.monthly_salary : settings.monthly_salary / rate) * 100) / 100, crc: Math.round((currency === 'CRC' ? settings.monthly_salary : settings.monthly_salary * rate) * 100) / 100 };
}
