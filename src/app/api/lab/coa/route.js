import { NextResponse } from 'next/server';
import { requireLabSession } from '@/lib/labSession';
import { recordAdminActivity } from '@/lib/adminActivityLog.mjs';
import {
  COA_MAX_BYTES,
  COA_STATUS_PENDING,
  LAB_SUBMISSIONS_BUCKET,
  SIGNED_URL_SECONDS,
  labOwnsBatch,
  labSafeSubmission,
  submissionStoragePath,
  validateCoaSubmission,
} from '@/lib/labPortal.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensurePrivateBucket(supabase) {
  // The migration creates it; this only covers a database where it has not run
  // yet. public: false either way — a lab upload must never have a public URL.
  const created = await supabase.storage.createBucket(LAB_SUBMISSIONS_BUCKET, {
    public: false,
    fileSizeLimit: COA_MAX_BYTES,
    allowedMimeTypes: ['application/pdf'],
  });
  if (created.error && !/already exists|duplicate/i.test(created.error.message || '')) throw created.error;
}

/**
 * Upload a COA for one of this lab's batches. Multipart form:
 *   batchId, file (PDF), purity (0–100), testDate (YYYY-MM-DD), notes?
 *
 * The batch id names WHICH of the lab's batches; whether it is the lab's at all
 * is checked against the session's lab id before anything is stored. The new
 * row is always 'pending' — nothing a lab sends can publish a certificate.
 */
export async function POST(request) {
  const session = await requireLabSession(request);
  if (session.error) return session.error;
  const { lab, profile, user, supabaseAdmin } = session;

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Send the COA as a file upload.' }, { status: 400 });
  }

  const batchId = String(form.get('batchId') || '').trim();
  if (!batchId) return NextResponse.json({ error: 'Which batch is this COA for?' }, { status: 400 });

  const { data: batch, error: batchError } = await supabaseAdmin
    .from('product_batches')
    .select('id, code, lab_partner_id, products(product)')
    .eq('id', batchId)
    .eq('lab_partner_id', lab.id)
    .maybeSingle();
  if (batchError) {
    console.error('[lab/coa] batch lookup:', batchError.message);
    return NextResponse.json({ error: 'Could not check that batch.' }, { status: 500 });
  }
  // Same answer for "does not exist" and "not yours", so ids cannot be probed.
  if (!batch || !labOwnsBatch(lab, batch)) {
    return NextResponse.json({ error: 'That batch is not assigned to your lab.' }, { status: 404 });
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Choose the COA PDF to upload.' }, { status: 400 });
  }
  if (file.size > COA_MAX_BYTES) {
    return NextResponse.json({ error: 'The COA must be 20 MB or smaller.' }, { status: 413 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());

  const checked = validateCoaSubmission({
    file: { name: file.name, size: bytes.length, type: file.type, bytes },
    purity: form.get('purity'),
    testDate: form.get('testDate'),
    notes: form.get('notes'),
  });
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  // One waiting certificate per batch. Checked here for a readable message;
  // the unique index in the migration is what actually guarantees it.
  const { data: waiting } = await supabaseAdmin
    .from('lab_coa_submissions')
    .select('id')
    .eq('batch_id', batch.id)
    .eq('status', COA_STATUS_PENDING)
    .limit(1);
  if (waiting?.length) {
    return NextResponse.json(
      { error: 'A COA for this batch is already waiting for review. You can upload again once it is decided.' },
      { status: 409 }
    );
  }

  const path = submissionStoragePath(lab.id, batch.code || batch.id);
  try {
    await ensurePrivateBucket(supabaseAdmin);
    const uploaded = await supabaseAdmin.storage
      .from(LAB_SUBMISSIONS_BUCKET)
      .upload(path, bytes, { contentType: 'application/pdf', upsert: false });
    if (uploaded.error) throw uploaded.error;
  } catch (err) {
    console.error('[lab/coa] upload:', err?.message || err);
    return NextResponse.json({ error: 'The upload failed. Try again.' }, { status: 500 });
  }

  const { data: row, error: insertError } = await supabaseAdmin
    .from('lab_coa_submissions')
    .insert({
      batch_id: batch.id,
      lab_partner_id: lab.id,
      file_path: path,
      file_name: checked.value.fileName,
      file_size: checked.value.fileSize,
      purity_percent: checked.value.purityPercent,
      test_date: checked.value.testDate,
      lab_notes: checked.value.labNotes,
      status: COA_STATUS_PENDING,
      submitted_by_user_id: user.id,
      submitted_by_email: profile.email || user.email || null,
    })
    .select('id, batch_id, file_name, purity_percent, test_date, lab_notes, status, review_note, reviewed_at, created_at')
    .single();

  if (insertError) {
    // No orphan file left behind in the bucket.
    await supabaseAdmin.storage.from(LAB_SUBMISSIONS_BUCKET).remove([path]).catch(() => {});
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'A COA for this batch is already waiting for review.' },
        { status: 409 }
      );
    }
    console.error('[lab/coa] insert:', insertError.message);
    return NextResponse.json({ error: 'Could not save your upload.' }, { status: 500 });
  }

  await recordAdminActivity(supabaseAdmin, {
    actor: profile,
    action: 'lab_coa.submitted',
    subjectType: 'product_batch',
    subjectId: batch.id,
    subjectLabel: `${batch.code || ''} · ${batch.products?.product || ''}`,
    detail: `${lab.name}: purity ${checked.value.purityPercent}%, tested ${checked.value.testDate}`,
    request,
  });

  return NextResponse.json({ ok: true, submission: labSafeSubmission(row) });
}

/**
 * GET ?id=<submission id> — a short-lived link to the lab's OWN uploaded PDF.
 * The submission must belong to the session's lab; anything else is a 404.
 */
export async function GET(request) {
  const session = await requireLabSession(request);
  if (session.error) return session.error;
  const { lab, supabaseAdmin } = session;

  const id = String(new URL(request.url).searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ error: 'Which upload?' }, { status: 400 });

  const { data: row } = await supabaseAdmin
    .from('lab_coa_submissions')
    .select('id, file_path, lab_partner_id')
    .eq('id', id)
    .eq('lab_partner_id', lab.id)
    .maybeSingle();
  if (!row || row.lab_partner_id !== lab.id) {
    return NextResponse.json({ error: 'Upload not found.' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(LAB_SUBMISSIONS_BUCKET)
    .createSignedUrl(row.file_path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Could not open that file.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: data.signedUrl }, { headers: { 'Cache-Control': 'private, no-store' } });
}
