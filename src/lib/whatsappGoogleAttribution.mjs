import { randomBytes } from 'node:crypto';

const REFERENCE_PATTERN = /\bPCR-([A-HJ-NP-Z2-9]{12})\b/i;

export function createWhatsAppReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(12);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export function appendWhatsAppReference(message, token) {
  const cleanToken = String(token || '').toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{12}$/.test(cleanToken)) return String(message || '');
  return `${String(message || '').trim()}\n\nRef: PCR-${cleanToken}`.trim();
}

export function extractWhatsAppReference(message) {
  return String(message || '').match(REFERENCE_PATTERN)?.[1]?.toUpperCase() || null;
}

export async function claimWhatsAppGoogleAttribution(supabase, message, waId) {
  const token = extractWhatsAppReference(message);
  const cleanWaId = String(waId || '').replace(/\D/g, '');
  if (!supabase || !token || cleanWaId.length < 8) return null;

  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data, error } = await supabase
    .from('whatsapp_leads')
    .update({ wa_id: cleanWaId, reference_received_at: new Date().toISOString() })
    .eq('attribution_token', token)
    .gte('clicked_at', cutoff)
    .select('ad_attribution')
    .maybeSingle();

  if (error || !data?.ad_attribution) return null;

  await supabase
    .from('orders')
    .update({ whatsapp_wa_id: cleanWaId })
    .or(`customer_phone.ilike.%${cleanWaId.slice(-8)}%,whatsapp_wa_id.eq.${cleanWaId}`);

  return data.ad_attribution;
}
