import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { readAdClick, sanitizeAdAttribution } from '@/lib/adClickAttribution.mjs';
import { appendWhatsAppReference, createWhatsAppReference } from '@/lib/whatsappGoogleAttribution.mjs';

export const dynamic = 'force-dynamic';

function clickFromReferrer(request) {
  try {
    const referrer = new URL(request.headers.get('referer') || 'https://invalid.local');
    const params = referrer.searchParams;
    return sanitizeAdAttribution({
      gclid: params.get('gclid'),
      gbraid: params.get('gbraid'),
      wbraid: params.get('wbraid'),
      clicked_at: Date.now(),
    });
  } catch {
    return null;
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const phone = String(url.searchParams.get('phone') || '').replace(/\D/g, '');
  const message = String(url.searchParams.get('text') || '').slice(0, 1800);
  if (!/^\d{8,15}$/.test(phone)) return NextResponse.json({ error: 'Invalid WhatsApp destination.' }, { status: 400 });

  const adAttribution = readAdClick({ cookie: request.headers.get('cookie') || '' }) || clickFromReferrer(request);
  let outboundMessage = message;

  if (adAttribution) {
    const token = createWhatsAppReference();
    try {
      const admin = getSupabaseAdmin();
      const { error } = await admin.from('whatsapp_leads').insert({
        source: 'tracked_whatsapp_redirect',
        attribution_token: token,
        ad_attribution: adAttribution,
        clicked_at: new Date().toISOString(),
      });
      if (!error) outboundMessage = appendWhatsAppReference(message, token);
      else console.warn('[WhatsApp attribution] Could not save click reference:', error.message);
    } catch (error) {
      console.warn('[WhatsApp attribution] Could not initialize click reference:', error.message);
    }
  }

  return NextResponse.redirect(`https://wa.me/${phone}?text=${encodeURIComponent(outboundMessage)}`, 307);
}
