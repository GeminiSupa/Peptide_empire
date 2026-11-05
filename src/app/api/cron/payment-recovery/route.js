import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyCronRequest } from '@/lib/cronAuth';
import { getPublicSiteUrl } from '@/lib/publicUrl';
import {
  PAYMENT_RECOVERY_FOLLOW_UP_STATUSES,
  PAYMENT_RECOVERY_REMINDER_HOURS,
  buildPaymentRetryPath,
  paymentRecoveryFollowUpWindow,
} from '@/lib/paymentRecovery.mjs';
import { sendPaymentRecoveryFollowUpEmail, sendPaymentRecoveryReminderEmail } from '@/lib/paymentResultEmail.mjs';
import { sendPaymentRecoveryWhatsApp } from '@/lib/paymentRecoveryWhatsApp.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;
  const supabase = getSupabaseAdmin();
  const baseUrl = getPublicSiteUrl(request.url);

  // 1) The 15-minute email, for customers still stuck on Chargex's page.
  // Its own query, so a missing column (add-payment-recovery-followup.sql not
  // run yet) skips only this step and the two-hour reminder still goes out.
  let followedUp = 0;
  let followUpError = null;
  const followUpWindow = paymentRecoveryFollowUpWindow();
  const { data: stuck, error: stuckError } = await supabase.from('orders').select('*')
    .in('status', PAYMENT_RECOVERY_FOLLOW_UP_STATUSES)
    .is('payment_recovery_followup_sent_at', null)
    .is('payment_recovery_reminded_at', null)
    .gt('created_at', followUpWindow.placedAfter)
    .lte('created_at', followUpWindow.placedBefore)
    .limit(50);
  if (stuckError) {
    followUpError = stuckError.message;
    console.error('[Payment recovery] 15-minute email skipped:', stuckError.message);
  }
  for (const order of stuck || []) {
    if (!String(order.customer_email || '').trim()) continue;
    const email = await sendPaymentRecoveryFollowUpEmail(baseUrl, order, order.order_number);
    if (email.sent) {
      await supabase.from('orders').update({ payment_recovery_followup_sent_at: new Date().toISOString() }).eq('id', order.id);
      followedUp += 1;
    }
  }

  // 2) The two-hour reminder.
  const cutoff =new Date(Date.now() - PAYMENT_RECOVERY_REMINDER_HOURS * 60 * 60 * 1000).toISOString();
  const { data: orders, error } = await supabase.from('orders').select('*')
    .in('status', ['Declined', 'Pending - Card 3DS', 'Pending - 3DS Card'])
    .is('payment_recovery_reminded_at', null).lte('created_at', cutoff).limit(50);
  if (error) return NextResponse.json({ error: error.message, followedUp }, { status: 500 });

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
  return NextResponse.json({
    ok: true,
    followUpChecked: stuck?.length || 0,
    followedUp,
    followUpError,
    checked: orders?.length || 0,
    reminded,
  });
}
