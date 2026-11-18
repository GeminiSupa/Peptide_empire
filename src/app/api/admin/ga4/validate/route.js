import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scopedAdmin } from '@/lib/siteScopedAdmin.mjs';
import { ga4Config, ga4PurchaseEvent, sendGa4Event } from '@/lib/ga4Purchase.mjs';
// Sends one confirmed WhatsApp order to GA4's validation endpoint. Nothing is
// recorded in GA4 and no state is saved; Google answers with any problems it
// sees in the event. Run this before setting GA4_OFFLINE_ENABLED=true.
export async function POST(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  let body; try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const config = ga4Config(process.env);
  if (config.missing.length) return Response.json({ error: 'GA4 is not configured.', missing: config.missing }, { status: 409 });
  if (!/^[0-9a-f-]{36}$/i.test(body.orderId || '')) return Response.json({ error: 'Choose an order ID.' }, { status: 400 });
  const result = await scopedAdmin(auth.activeSite).from('orders').select('*').eq('id', body.orderId).maybeSingle();
  if (result.error || !result.data) return Response.json({ error: 'Order not available.' }, { status: 404 });
  try {
    const event = ga4PurchaseEvent(result.data, result.data.ads_paid_at || new Date().toISOString(), { skipAgeCheck: true });
    const answer = await sendGa4Event(event, config, { debug: true });
    const messages = answer.validationMessages || [];
    return Response.json({ validated: messages.length === 0, validationMessages: messages, attributedToVisit: event.attributed, sent: false });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}
