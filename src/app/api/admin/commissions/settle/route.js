import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { planPayoutSettlement } from '@/lib/payoutSettlement.mjs';
import { formatPayoutPeriod } from '@/lib/commissionPayouts';
import { sendTaxRecordsPaymentReceipt } from '@/lib/taxRecordsEmail.mjs';
import { resolveTaxRecordsMailer } from '@/lib/taxRecordsSmtp.mjs';

export async function POST(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    if (!body.payoutId) return NextResponse.json({ error: 'payoutId is required' }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data: payout, error: fetchError } = await supabase
      .from('commission_payouts').select('*').eq('id', body.payoutId).single();
    if (fetchError || !payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });

    const plan = planPayoutSettlement(payout.status, {
      ...body,
      recordedBy: auth.user.email,
      paymentInitiatedAt: payout.payment_initiated_at,
    });
    if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.status });
    const { data, error } = await supabase.from('commission_payouts')
      .update(plan.patch).eq('id', payout.id).select('*').single();
    if (error) throw error;

    // Only a payment that has really been made is the accountant's receipt;
    // "Payment Initiated" and "Failed" are not. After the save on purpose, so a
    // failed email can never undo the record, and reported rather than swallowed
    // so the admin knows whether accounting has it.
    let accountingCopy = { sent: false, skipped: 'not paid' };
    if (data.status === 'Paid') {
      const mailer = resolveTaxRecordsMailer();
      accountingCopy = await sendTaxRecordsPaymentReceipt({
        transporter: mailer.transporter,
        from: mailer.from,
        payout: {
          kind: data.salary_frequency === 'monthly' ? 'pago mensual' : 'comisión',
          name: data.agent_name || data.agent_email,
          email: data.agent_email,
          period: formatPayoutPeriod(data.start_date, data.end_date),
          usd: data.total_payout_usd,
          crc: data.total_payout_crc,
        },
        payment: {
          method: data.payment_method,
          reference: data.payment_reference,
          receiptUrl: data.payment_receipt_url,
          paidAt: data.paid_at,
          recordedBy: data.payment_recorded_by,
        },
        logPrefix: '[Commission Payment Receipt]',
      });
      accountingCopy.transport = mailer.source;
    }

    return NextResponse.json({ success: true, payout: data, accountingCopy });
  } catch (error) {
    console.error('[commissions/settle]', error);
    return NextResponse.json({ error: error.message || 'Could not record payout settlement' }, { status: 500 });
  }
}
