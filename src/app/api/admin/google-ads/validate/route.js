import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scopedAdmin } from '@/lib/siteScopedAdmin.mjs';
import { googleAdsClient } from '@/lib/googleAdsClient';
import { offlineConversionEvent } from '@/lib/googleAdsConversions.mjs';
export async function POST(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  let body; try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!/^[0-9a-f-]{36}$/i.test(body.orderId || '')) return Response.json({ error: 'Choose an order ID.' }, { status: 400 });
  const result = await scopedAdmin(auth.activeSite).from('orders').select('*').eq('id', body.orderId).maybeSingle();
  if (result.error || !result.data) return Response.json({ error: 'Order not available.' }, { status: 404 });
  try {
    const event = offlineConversionEvent(result.data, result.data.ads_paid_at);
    const google = await googleAdsClient();
    const response = await google.upload(event, true, String(result.data.payment_method || '').toLowerCase());
    return Response.json({ validated: true, uploaded: false, warnings: response.fieldWarnings?.length || 0 });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}
