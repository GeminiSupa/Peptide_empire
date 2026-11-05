import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyCronRequest } from '@/lib/cronAuth';
import { getPublicSiteUrl } from '@/lib/publicUrl';
import { PAYMENT_RECOVERY_REMINDER_HOURS, buildPaymentRetryPath } from '@/lib/paymentRecovery.mjs';
import { sendPaymentRecoveryReminderEmail } from '@/lib/paymentResultEmail.mjs';
import { sendPaymentRecoveryWhatsApp } from '@/lib/paymentRecoveryWhatsApp.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - PAYMENT_RECOVERY_REMINDER_HOURS * 60 * 60 * 1000).toISOString();
  const { data: orders, error } = await supabase.from('orders').select('*')
    .in('status', ['Declined', 'Pending - Card 3DS', 'Pending - 3DS Card'])
    .is('payment_recovery_reminded_at', null).lte('created_at', cutoff).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const baseUrl = getPublicSiteUrl(request.url);
  let reminded = 0;
  for (const order of orders || []) {
    const retryPath = buildPaymentRetryPath(order.order_number);
    const retryUrl = retryPath
      ? `${baseUrl}${retryPath}`
      : `${baseUrl}/payment-help?order=${encodeURIComponent(order.order_number)}`;
    const [email, whatsapp] = await Promise.all([
      sendPaymentRecoveryReminderEmail(baseUrl, order, order.order_number),
      sendPaymentRecoveryWhatsApp(supabase, order, retryUrl, { reminder: true }),
    ]);
    if (email.sent || whatsapp.sent) {
      await supabase.from('orders').update({ payment_recovery_reminded_at: new Date().toISOString() }).eq('id', order.id);
      reminded += 1;
    }
  }
  return NextResponse.json({ ok: true, checked: orders?.length || 0, reminded });
}
