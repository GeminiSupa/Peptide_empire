// Copied from the catalog (src/app/api/whatsapp/open/route.js) by scripts/sync-catalog-checkout.mjs. Do not edit.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/catalog/lib/supabaseAdmin';
import { readAdClick, sanitizeAdAttribution } from '@/catalog/lib/adClickAttribution.mjs';
import { appendWhatsAppReference, createWhatsAppReference } from '@/catalog/lib/whatsappGoogleAttribution.mjs';
import { orderAttributionColumns, readTouchCookie } from '@/catalog/lib/channelAttribution.mjs';
import { writeDroppingMissingColumns } from '@/catalog/lib/optionalColumns.mjs';

export const dynamic = 'force-dynamic';

// add-order-channel-attribution.sql. Until it is run the tap still gets its
// ref and keeps the Google click; only the visit's source is lost.
const TOUCH_COLUMNS = ['visitor_id', 'first_touch', 'last_touch', 'ft_channel', 'lt_channel'];

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

  const cookie = request.headers.get('cookie') || '';
  const adAttribution = readAdClick({ cookie }) || clickFromReferrer(request);
  // Where this visitor came from (revenue by channel). Every tap that has a
  // source gets a ref, not only Google clicks: the ref is how the order staff
  // later create from this chat learns its source.
  const touch = orderAttributionColumns(readTouchCookie(cookie), 'whatsapp_ref');
  delete touch.captured_by;
  let outboundMessage = message;

  if (adAttribution || touch.lt_channel) {
    const token = createWhatsAppReference();
    try {
      const admin = getSupabaseAdmin();
      const { error } = await writeDroppingMissingColumns(
        {
          source: 'tracked_whatsapp_redirect',
          attribution_token: token,
          ad_attribution: adAttribution || null,
          clicked_at: new Date().toISOString(),
          ...touch,
        },
        TOUCH_COLUMNS,
        (row) => admin.from('whatsapp_leads').insert(row),
      );
      if (!error) outboundMessage = appendWhatsAppReference(message, token);
      else console.warn('[WhatsApp attribution] Could not save click reference:', error.message);
    } catch (error) {
      console.warn('[WhatsApp attribution] Could not initialize click reference:', error.message);
    }
  }

  return NextResponse.redirect(`https://wa.me/${phone}?text=${encodeURIComponent(outboundMessage)}`, 307);
}
