import { canOwnReturningCustomer } from './salesAgentAffiliate.mjs';

export function businessEmailAgentFromProfile(profile) {
  if (!canOwnReturningCustomer(profile)) return { name: '', photoUrl: '', whatsapp: '', phone: '', email: '' };
  let photoUrl = '';
  try { const url = new URL(profile.avatar_url); if (url.protocol === 'https:') photoUrl = url.href; } catch {}
  const digits = String(profile.whatsapp_number || '').replace(/\D/g, '');
  const whatsapp = /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
  return { name: profile.name || '', photoUrl, whatsapp, phone: whatsapp ? `+${whatsapp}` : '', email: String(profile.email || '').trim().toLowerCase() };
}

export async function resolveBusinessEmailAgent(admin, business) {
  if (!business.rep_user_id) return businessEmailAgentFromProfile(null);
  const { data, error } = await admin.from('admin_profiles').select('*').eq('user_id', business.rep_user_id).maybeSingle();
  if (error) throw error;
  return businessEmailAgentFromProfile(data);
}
