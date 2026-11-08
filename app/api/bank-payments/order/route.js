// Copied from the catalog (src/app/api/bank-payments/order/route.js) by scripts/sync-catalog-checkout.mjs. Do not edit.
import { getSupabaseAdmin } from '@/catalog/lib/supabaseAdmin';
import { verifyBankPaymentToken } from '@/catalog/lib/bankPaymentToken.mjs';
import { isAwaitingPayment } from '@/catalog/lib/orderAwaitingPayment.mjs';
import { readLimitedJson } from '@/catalog/lib/publicApiSecurity.mjs';

export async function POST(request) {
  try {
    const { body } = await readLimitedJson(request, 4096);
    const claims = verifyBankPaymentToken(body?.token);
    if (!claims) return Response.json({ error: 'Invalid or expired payment link / Enlace inválido o vencido' }, { status: 401 });
    const db = getSupabaseAdmin();
    const { data: order, error } = await db.from('orders').select('id,order_number,status,payment_method,currency,total_crc,total_usd,activity_log').eq('id', claims.id).single();
    if (error || !order) return Response.json({ error: 'Order unavailable' }, { status: 404 });
    const log = Array.isArray(order.activity_log) ? order.activity_log : [];
    const payment = log.find(e => e.type === 'bank_payment_instructions')?.payment;
    if (!payment || payment.method !== order.payment_method) return Response.json({ error: 'Payment method has changed. Contact support.' }, { status: 409 });
    const authoritativeAmount = payment.currency === 'USD' ? Number(order.total_usd) : Number(order.total_crc);
    if (isAwaitingPayment(order.status) && payment.amount !== authoritativeAmount) return Response.json({ error: 'The order total has changed. Contact support for updated payment instructions. / El total cambió. Contacte a soporte para recibir instrucciones actualizadas.' }, { status: 409 });
    let reported = log.some(e => e.type === 'bank_payment_reported');
    if (body.action === 'report') {
      if (!isAwaitingPayment(order.status)) return Response.json({ error: 'This order is no longer awaiting payment.' }, { status: 409 });
      const reference = String(body.reference || '').trim();
      const payer = String(body.payer || '').trim();
      if (!reference || reference.length > 100 || !payer || payer.length > 120) return Response.json({ error: 'Enter the payer name and bank transaction reference.' }, { status: 422 });
      if (!reported) {
        const activity_log = [{ at: new Date().toISOString(), type: 'bank_payment_reported', by: 'customer', message: `Payment reported — verify funds in BAC. Payer: ${payer}. Bank reference: ${reference}.`, payer, reference }, ...log].slice(0, 100);
        // Compare-and-swap prevents a customer report from overwriting a staff update.
        const { data: updated, error: updateError } = await db.from('orders').update({ activity_log }).eq('id', order.id).eq('status', order.status).eq('activity_log', JSON.stringify(order.activity_log)).select('id');
        if (updateError || !updated?.length) return Response.json({ error: 'Order changed. Refresh and try again.' }, { status: 409 });
        reported = true;
      }
    }
    return Response.json({ payment, status: order.status, reported, awaitingPayment: isAwaitingPayment(order.status) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Could not load payment. Please try again.' }, { status: 503 }); }
}
