import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAnalyticsReceiptToken } from '@/lib/analyticsReceiptToken';
import { receiptEvent } from '@/lib/ecommerceAnalytics.mjs';
export async function POST(request) {
  let body; try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const claims = verifyAnalyticsReceiptToken(body.token);
  if (!claims) return Response.json({ error: 'Invalid receipt.' }, { status: 403 });
  const { data, error } = await getSupabaseAdmin().from('orders').select('*').eq('id', claims.orderId).eq('order_number', claims.orderNumber).maybeSingle();
  if (error) return Response.json({ error: 'Receipt temporarily unavailable.' }, { status: 503 });
  if (!data) return Response.json({ error: 'Receipt not found.' }, { status: 404 });
  const event = receiptEvent(data);
  return Response.json({ event, pending: data.payment_method === 'card' && !event && /pending|processing/i.test(data.status || '') }, { headers: { 'Cache-Control': 'private, no-store' } });
}
