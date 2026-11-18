import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scopedAdmin } from '@/lib/siteScopedAdmin.mjs';
import { planPayoutSettlement } from '@/lib/payoutSettlement.mjs';
import { recordAdminActivity } from '@/lib/adminActivityLog.mjs';
import { sendTaxRecordsPaymentReceipt } from '@/lib/taxRecordsEmail.mjs';
import { resolveTaxRecordsMailer } from '@/lib/taxRecordsSmtp.mjs';

export async function POST(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    if (!body.payoutId) return NextResponse.json({ error: 'payoutId is required' }, { status: 400 });
    const supabase = scopedAdmin(auth.activeSite);
    const { data: payout, error: fetchError } = await supabase
      .from('affiliate_payouts').select('*').eq('id', body.payoutId).single();
    if (fetchError || !payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });

    const plan = planPayoutSettlement(payout.status, {
      ...body,
      recordedBy: auth.user.email,
      paymentInitiatedAt: payout.payment_initiated_at,
    });
    if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.status });
    const { data, error } = await supabase.from('affiliate_payouts')
      .update(plan.patch).eq('id', payout.id).select('*').single();
    if (error) throw error;
    await recordAdminActivity(supabase, {
      actor: auth.profile,
      action: 'payout.settled',
      subjectType: 'payout',
      subjectId: payout.id,
      subjectLabel: payout.affiliate_name || payout.affiliate_email,
      detail: {
        status: { from: String(payout.status || ''), to: String(data?.status || '') },
        // One payout stated in two currencies, never a sum of the two.
        amount: { from: '', to: `$${payout.usd_commission || 0} or $${payout.crc_commission || 0}` },
      },
      request,
    });

    // Same rule as the team payouts: the accountant gets the proof of payment
    // when, and only when, the payout is saved as Paid. Never throws.
    let accountingCopy = { sent: false, skipped: 'not paid' };
    if (data.status === 'Paid') {
      const mailer = resolveTaxRecordsMailer();
      accountingCopy = await sendTaxRecordsPaymentReceipt({
        transporter: mailer.transporter,
        from: mailer.from,
        payout: {
          kind: 'afiliado',
          name: data.affiliate_name || data.affiliate_email,
          email: data.affiliate_email,
          period: data.start_date && data.end_date
            ? `${String(data.start_date).slice(0, 10)} → ${String(data.end_date).slice(0, 10)}`
            : null,
          usd: data.usd_commission,
          crc: data.crc_commission,
        },
        payment: {
          method: data.payment_method,
          reference: data.payment_reference,
          receiptUrl: data.payment_receipt_url,
          paidAt: data.paid_at,
          recordedBy: data.payment_recorded_by,
        },
        logPrefix: '[Affiliate Payment Receipt]',
      });
      accountingCopy.transport = mailer.source;
    }

    return NextResponse.json({ success: true, payout: data, accountingCopy });
  } catch (error) {
    console.error('[affiliates/payouts/settle]', error);
    return NextResponse.json({ error: error.message || 'Could not record payout settlement' }, { status: 500 });
  }
}
