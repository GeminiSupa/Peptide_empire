// Copied from the catalog (src/app/api/analytics/order-receipt/route.js) by scripts/sync-catalog-checkout.mjs. Do not edit.
import { getSupabaseAdmin } from '@/catalog/lib/supabaseAdmin';
import { verifyAnalyticsReceiptToken } from '@/catalog/lib/analyticsReceiptToken';
import { receiptEvent, receiptEvents } from '@/catalog/lib/ecommerceAnalytics.mjs';
export async function POST(request) {
  let body; try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const claims = verifyAnalyticsReceiptToken(body.token);
  if (!claims) return Response.json({ error: 'Invalid receipt.' }, { status: 403 });
  const { data, error } = await getSupabaseAdmin().from('orders').select('*').eq('id', claims.orderId).eq('order_number', claims.orderNumber).maybeSingle();
  if (error) return Response.json({ error: 'Receipt temporarily unavailable.' }, { status: 503 });
  if (!data) return Response.json({ error: 'Receipt not found.' }, { status: 404 });
  const event = receiptEvent(data);
  return Response.json({ event, events: receiptEvents(data), pending: data.payment_method === 'card' && !event && /pending|processing/i.test(data.status || '') }, { headers: { 'Cache-Control': 'private, no-store' } });
}
