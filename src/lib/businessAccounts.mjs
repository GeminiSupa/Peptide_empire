export const BUSINESS_FIELDS = ['legal_name', 'trading_name', 'corporation_number', 'contact_name', 'phone', 'billing_address', 'delivery_address'];

export function businessDetails(body = {}) {
  const result = {};
  for (const key of BUSINESS_FIELDS) result[key] = String(body[key] || '').trim().slice(0, key.endsWith('address') ? 1000 : 200);
  result.corporation_number = result.corporation_number.replace(/[\s-]/g, '');
  if (!result.legal_name || !result.contact_name || !result.phone || !result.billing_address) throw new Error('Legal name, contact, phone and billing address are required.');
  if (!/^\d{10}$/.test(result.corporation_number)) throw new Error('Enter the 10-digit cédula jurídica.');
  return result;
}

export function businessDiscountPct(business) {
  const pct = Number(business?.discount_pct);
  return business?.status === 'approved' && Number.isFinite(pct) && pct > 0 && pct <= 100 ? pct : 0;
}

// Only call with the email returned by Supabase getUser, never a checkout field.
export async function findBusinessAccount(admin, verifiedEmail) {
  if (!verifiedEmail) return null;
  const { data, error } = await admin.from('business_accounts').select('*').eq('email', verifiedEmail.toLowerCase().trim()).maybeSingle();
  // An ordinary storefront remains usable before the additive migration lands.
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return null;
  if (error) throw new Error('Business pricing is temporarily unavailable. Please try again.');
  if (data) return { ...data, member_role: 'owner' };
  const membership = await admin.from('business_members').select('business_id,role').eq('email', verifiedEmail.toLowerCase().trim()).eq('active',true).maybeSingle();
  if (membership.error && ['42P01','PGRST205'].includes(membership.error.code)) return null;
  if (membership.error) throw new Error('Business membership is temporarily unavailable.');
  if (!membership.data) return null;
  const company = await admin.from('business_accounts').select('*').eq('id',membership.data.business_id).maybeSingle();
  if (company.error) throw new Error('Business account is temporarily unavailable.');
  return company.data ? { ...company.data, member_role: membership.data.role } : null;
}
