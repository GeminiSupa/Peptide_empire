import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { recordAdminActivity } from '@/lib/adminActivityLog.mjs';
import {
  COA_MAX_BYTES,
  COA_STATUS_APPROVED,
  COA_STATUS_PENDING,
  COA_STATUS_REJECTED,
  COA_STATUSES,
  LAB_PORTAL_MIGRATION,
  LAB_SUBMISSIONS_BUCKET,
  PUBLIC_COA_BUCKET,
  SIGNED_URL_SECONDS,
  canReviewSubmission,
  isLabPortalMissing,
  parseReviewDecision,
  publishedStoragePath,
} from '@/lib/labPortal.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The staff review queue for lab COA uploads (Lab batches tab).
 *
 * Nothing a lab uploads is public until it passes through here. Approving
 * copies the PDF from the private bucket to the public COA bucket and only
 * then points the batch's coa_url at it — which is what the /b/<code> sticker
 * QR opens. Rejecting leaves the batch untouched and tells the lab why.
 *
 * Gated on the lab_batches permission (the same people who can already set a
 * batch's COA link by hand). A lab login is refused by verifyAdminSession.
 */

const SUBMISSION_COLUMNS = 'id, batch_id, lab_partner_id, file_path, file_name, file_size, purity_percent, test_date, lab_notes, status, submitted_by_email, reviewed_by_email, review_note, reviewed_at, published_url, created_at, product_batches(code, batch_number, coa_url, products(product)), lab_partners(name)';

function shape(row, signedUrl = null) {
  return {
    id: row.id,
    batchId: row.batch_id,
    batchCode: row.product_batches?.code || '',
    batchNumber: row.product_batches?.batch_number || '',
    product: row.product_batches?.products?.product || '',
    labName: row.lab_partners?.name || '',
    fileName: row.file_name || 'coa.pdf',
    fileSize: Number(row.file_size) || 0,
    purityPercent: row.purity_percent === null ? null : Number(row.purity_percent),
    testDate: row.test_date,
    labNotes: row.lab_notes || '',
    status: row.status,
    submittedBy: row.submitted_by_email || '',
    reviewedBy: row.reviewed_by_email || '',
    reviewNote: row.review_note || '',
    reviewedAt: row.reviewed_at,
    publishedUrl: row.published_url || '',
    createdAt: row.created_at,
    viewUrl: signedUrl,
  };
}

function migrationResponse() {
  return NextResponse.json(
    { error: `Run ${LAB_PORTAL_MIGRATION} in the Supabase SQL editor first.`, migration: LAB_PORTAL_MIGRATION },
    { status: 503 }
  );
}

/** GET ?status=pending|approved|rejected (default pending) — the queue, with a short-lived view link per PDF. */
export async function GET(request) {
  const auth = await verifyAdminSession(request, { requirePermission: 'lab_batches' });
  if (auth.error) return auth.error;

  const requested = String(new URL(request.url).searchParams.get('status') || COA_STATUS_PENDING).toLowerCase();
  const status = COA_STATUSES.includes(requested) ? requested : COA_STATUS_PENDING;

  const supabase = getSupabaseAdmin();
  const [{ data, error }, { count: pendingCount }] = await Promise.all([
    supabase
      .from('lab_coa_submissions')
      .select(SUBMISSION_COLUMNS)
      .eq('status', status)
      .order('created_at', { ascending: status === COA_STATUS_PENDING })
      .limit(100),
    supabase
      .from('lab_coa_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', COA_STATUS_PENDING),
  ]);
  if (error) {
    if (isLabPortalMissing(error)) return migrationResponse();
    console.error('[lab-coa] list:', error.message);
    return NextResponse.json({ error: 'Could not load lab uploads' }, { status: 500 });
  }

  const rows = data || [];
  let signed = [];
  if (rows.length) {
    const result = await supabase.storage
      .from(LAB_SUBMISSIONS_BUCKET)
      .createSignedUrls(rows.map((row) => row.file_path), SIGNED_URL_SECONDS);
    signed = result.data || [];
  }
  const urlByPath = new Map(signed.filter((item) => item?.signedUrl).map((item) => [item.path, item.signedUrl]));

  return NextResponse.json({
    ok: true,
    status,
    pendingCount: pendingCount || 0,
    submissions: rows.map((row) => shape(row, urlByPath.get(row.file_path) || null)),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/** POST { id, decision: 'approve' | 'reject', note? } — a note is required to reject. */
export async function POST(request) {
  const auth = await verifyAdminSession(request, { requirePermission: 'lab_batches' });
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  const decision = parseReviewDecision(body.decision);
  const note = String(body.note || '').trim().slice(0, 1000);
  if (!id) return NextResponse.json({ error: 'Which upload?' }, { status: 400 });
  if (!decision) return NextResponse.json({ error: 'Approve or reject?' }, { status: 400 });
  if (decision === 'reject' && !note) {
    return NextResponse.json({ error: 'Say why it is rejected, so the lab can fix it.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase.from('lab_coa_submissions').select(SUBMISSION_COLUMNS).eq('id', id).maybeSingle();
  if (error) {
    if (isLabPortalMissing(error)) return migrationResponse();
    return NextResponse.json({ error: 'Could not load that upload.' }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: 'That upload no longer exists.' }, { status: 404 });
  if (!canReviewSubmission(row)) {
    return NextResponse.json({ error: `This upload was already ${row.status}.` }, { status: 409 });
  }

  const reviewer = auth.profile.email || auth.profile.name || 'staff';
  const reviewedAt = new Date().toISOString();
  const label = `${row.product_batches?.code || ''} · ${row.product_batches?.products?.product || ''}`;

  if (decision === 'reject') {
    const { data: updated, error: updateError } = await supabase
      .from('lab_coa_submissions')
      .update({ status: COA_STATUS_REJECTED, reviewed_by_email: reviewer, review_note: note, reviewed_at: reviewedAt })
      .eq('id', id)
      .eq('status', COA_STATUS_PENDING)
      .select('id');
    if (updateError) return NextResponse.json({ error: 'Could not save the decision.' }, { status: 500 });
    if (!updated?.length) return NextResponse.json({ error: 'Somebody else decided this upload first.' }, { status: 409 });

    await recordAdminActivity(supabase, {
      actor: auth.profile,
      action: 'lab_coa.rejected',
      subjectType: 'product_batch',
      subjectId: row.batch_id,
      subjectLabel: label,
      detail: `${row.lab_partners?.name || 'Lab'}: ${note}`,
      request,
    });
    return NextResponse.json({ ok: true, message: 'Rejected. The lab will see your note.' });
  }

  // --- approve -------------------------------------------------------------
  // 1. Copy the PDF from the private bucket to the public one.
  const publicPath = publishedStoragePath(row.product_batches?.code || row.batch_id, row.id);
  let publishedUrl = '';
  try {
    const downloaded = await supabase.storage.from(LAB_SUBMISSIONS_BUCKET).download(row.file_path);
    if (downloaded.error || !downloaded.data) throw downloaded.error || new Error('file missing');
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());

    const created = await supabase.storage.createBucket(PUBLIC_COA_BUCKET, {
      public: true,
      fileSizeLimit: COA_MAX_BYTES,
      allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    });
    if (created.error && !/already exists|duplicate/i.test(created.error.message || '')) throw created.error;

    const uploaded = await supabase.storage
      .from(PUBLIC_COA_BUCKET)
      .upload(publicPath, bytes, { contentType: 'application/pdf', cacheControl: '31536000', upsert: true });
    if (uploaded.error) throw uploaded.error;
    publishedUrl = supabase.storage.from(PUBLIC_COA_BUCKET).getPublicUrl(publicPath).data.publicUrl;
  } catch (err) {
    console.error('[lab-coa] publish copy:', err?.message || err);
    return NextResponse.json({ error: 'Could not publish the PDF. Nothing was changed.' }, { status: 500 });
  }

  const removePublished = () => supabase.storage.from(PUBLIC_COA_BUCKET).remove([publicPath]).catch(() => {});

  // 2. Claim the decision. Only one reviewer can move it out of pending.
  const { data: claimed, error: claimError } = await supabase
    .from('lab_coa_submissions')
    .update({
      status: COA_STATUS_APPROVED,
      reviewed_by_email: reviewer,
      review_note: note || null,
      reviewed_at: reviewedAt,
      published_url: publishedUrl,
    })
    .eq('id', id)
    .eq('status', COA_STATUS_PENDING)
    .select('id');
  if (claimError || !claimed?.length) {
    await removePublished();
    return NextResponse.json(
      { error: claimError ? 'Could not save the decision.' : 'Somebody else decided this upload first.' },
      { status: claimError ? 500 : 409 }
    );
  }

  // 3. Point the batch (and so its QR sticker) at the approved certificate.
  const { error: batchError } = await supabase
    .from('product_batches')
    .update({
      coa_url: publishedUrl,
      coa_purity_percent: row.purity_percent,
      coa_test_date: row.test_date,
      coa_submission_id: row.id,
    })
    .eq('id', row.batch_id);
  if (batchError) {
    // Put it back in the queue rather than leave "approved" with no public COA.
    await supabase
      .from('lab_coa_submissions')
      .update({ status: COA_STATUS_PENDING, reviewed_by_email: null, review_note: null, reviewed_at: null, published_url: null })
      .eq('id', id);
    await removePublished();
    console.error('[lab-coa] batch update:', batchError.message);
    return NextResponse.json({ error: 'Could not update the batch. The upload is still waiting.' }, { status: 500 });
  }

  await recordAdminActivity(supabase, {
    actor: auth.profile,
    action: 'lab_coa.approved',
    subjectType: 'product_batch',
    subjectId: row.batch_id,
    subjectLabel: label,
    detail: `${row.lab_partners?.name || 'Lab'}: purity ${row.purity_percent}%, tested ${row.test_date}${row.product_batches?.coa_url ? ' (replaced the previous COA)' : ''}`,
    request,
  });

  return NextResponse.json({ ok: true, message: 'Approved. The batch QR now opens this COA.', publishedUrl });
}
