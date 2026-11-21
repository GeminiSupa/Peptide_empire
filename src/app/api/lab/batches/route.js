import { NextResponse } from 'next/server';
import { requireLabSession } from '@/lib/labSession';
import { groupSubmissionsByBatch } from '@/lib/labPortal.mjs';
import { recordSignInOnce } from '@/lib/adminActivityLog.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Everything the /lab page shows: the lab's own name, the batches assigned to
 * it, and each batch's uploads with their status.
 *
 * Filtered by the session's lab id and nothing else. Batches are trimmed to
 * what a lab needs (labSafeBatch): no cost, supplier or internal notes.
 */
export async function GET(request) {
  const session = await requireLabSession(request);
  if (session.error) return session.error;
  const { lab, profile, supabaseAdmin } = session;

  // First thing the page asks for, so the sign-in is recorded here (the staff
  // sign-in route refuses the lab tier). One row per half hour at most.
  await recordSignInOnce(supabaseAdmin, { actor: profile, request });

  const [batchesResult, submissionsResult] = await Promise.all([
    supabaseAdmin
      .from('product_batches')
      .select('id, code, batch_number, manufactured_date, expiry_date, coa_url, lab_partner_id, products(product)')
      .eq('lab_partner_id', lab.id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('lab_coa_submissions')
      .select('id, batch_id, file_name, purity_percent, test_date, lab_notes, status, review_note, reviewed_at, created_at')
      .eq('lab_partner_id', lab.id)
      .order('created_at', { ascending: false }),
  ]);

  if (batchesResult.error || submissionsResult.error) {
    console.error('[lab/batches]', batchesResult.error?.message || submissionsResult.error?.message);
    return NextResponse.json({ error: 'Could not load your batches' }, { status: 500 });
  }

  // Only submissions for batches still assigned to this lab are shown. A batch
  // moved to another lab takes its history with it out of this view.
  return NextResponse.json({
    ok: true,
    lab: { name: lab.name },
    batches: groupSubmissionsByBatch(batchesResult.data || [], submissionsResult.data || []),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
