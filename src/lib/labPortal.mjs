/**
 * The lab partner portal: outside testing labs upload certificates of analysis
 * (COAs) for the batches assigned to them, and staff approve each one before
 * it goes public on the batch QR sticker.
 *
 * THE RULES, AND WHERE EACH ONE IS ENFORCED
 *
 *   A lab login reaches /lab and nothing else.
 *     verifyAdminSession refuses tier 'lab' on every route; only /api/lab/*
 *     opts in, with { allowLab: true }. resolveAdminTabAccess gives a lab no
 *     admin tab. RLS (lock-empire-rls.sql) gives it no table.
 *
 *   Which lab is this? — answered from the session, never from the request.
 *     labPartnerIdForProfile below is the only way a lab is chosen. No lab id
 *     is read from a query string or a body anywhere in the feature.
 *
 *   A lab sees and uploads for its own batches only.
 *     Every batch query on the lab side is filtered by the session's lab id;
 *     labOwnsBatch double-checks the row before anything is written.
 *
 *   Nothing a lab uploads is public until staff approve it.
 *     Uploads land in a PRIVATE bucket. Approval copies the file to the public
 *     COA bucket and only then sets product_batches.coa_url, which is what the
 *     /b/<code> QR redirect reads.
 *
 * Kept free of '@/lib' imports so tests/ can load it under `node --test`.
 */

export const LAB_PORTAL_MIGRATION = 'add-lab-portal.sql';

/** Where lab uploads wait. Private: no object here has a public URL. */
export const LAB_SUBMISSIONS_BUCKET = 'lab-coa-submissions';
/** Where an approved certificate is published (same bucket the admin COA upload uses). */
export const PUBLIC_COA_BUCKET = 'coa-documents';

export const COA_MAX_BYTES = 20 * 1024 * 1024;

export const COA_STATUS_PENDING = 'pending';
export const COA_STATUS_APPROVED = 'approved';
export const COA_STATUS_REJECTED = 'rejected';
export const COA_STATUSES = [COA_STATUS_PENDING, COA_STATUS_APPROVED, COA_STATUS_REJECTED];

/** How long a staff member's or lab's "view PDF" link stays valid. */
export const SIGNED_URL_SECONDS = 5 * 60;

/**
 * The lab row this login belongs to, or null.
 *
 * `lab_partners.admin_profile_user_id` is the join, and the ONLY way any lab
 * screen decides whose batches to show. A login with no link reaches nothing
 * rather than everything, which is the safe direction to fail in.
 */
export function labPartnerIdForProfile(profile, labs = []) {
  const userId = profile?.user_id;
  if (!userId) return null;
  const match = (labs || []).find((row) => row?.admin_profile_user_id && row.admin_profile_user_id === userId);
  return match?.id || null;
}

/** Does this batch belong to this lab? Both ids must be present and equal. */
export function labOwnsBatch(lab, batch) {
  const labId = lab?.id;
  return Boolean(labId && batch?.lab_partner_id && batch.lab_partner_id === labId);
}

/**
 * What a lab is allowed to know about a batch it tests.
 *
 * The product, the sticker code and the batch details it needs to match a
 * sample to a report. Deliberately no cost, no supplier, no internal notes and
 * no packing record: a lab login must not become a view of the supply chain.
 */
export function labSafeBatch(batch) {
  if (!batch) return null;
  return {
    id: batch.id,
    code: batch.code ?? null,
    product: batch.products?.product ?? batch.product ?? null,
    batchNumber: batch.batch_number ?? null,
    madeDate: batch.manufactured_date ?? null,
    expiryDate: batch.expiry_date ?? null,
    hasPublishedCoa: Boolean(batch.coa_url),
  };
}

/**
 * A submission as the lab sees it: its own upload and the decision on it.
 * The reviewer's identity stays internal; the note is what the lab needs to
 * fix a rejected report.
 */
export function labSafeSubmission(row) {
  if (!row) return null;
  return {
    id: row.id,
    batchId: row.batch_id,
    fileName: row.file_name ?? null,
    purityPercent: row.purity_percent === null || row.purity_percent === undefined ? null : Number(row.purity_percent),
    testDate: row.test_date ?? null,
    labNotes: row.lab_notes ?? null,
    status: normalizeCoaStatus(row.status),
    reviewNote: row.review_note ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

/** Anything unrecognised reads as pending: never shown as approved by accident. */
export function normalizeCoaStatus(value) {
  const status = String(value ?? '').trim().toLowerCase();
  return COA_STATUSES.includes(status) ? status : COA_STATUS_PENDING;
}

/** A real PDF starts with "%PDF-". The browser's MIME type is not trusted. */
export function looksLikePdf(bytes) {
  if (!bytes || bytes.length < 5) return false;
  const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
  return head === '%PDF-';
}

/** "98.7" -> 98.7. Up to three decimals, 0–100 inclusive, or null. */
export function parsePurity(value) {
  const text = String(value ?? '').trim().replace('%', '').replace(',', '.');
  if (!/^\d{1,3}(?:\.\d{1,3})?$/.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0 || number > 100) return null;
  return number;
}

/** A YYYY-MM-DD test date that is a real calendar day, not in the future. */
export function parseTestDate(value, now = new Date()) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return null;
  if (text < '2000-01-01') return null;
  // A day's grace for a lab ahead of UTC.
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (text > tomorrow) return null;
  return text;
}

/**
 * Check one upload before anything is stored. Returns { ok, error, value }.
 * `file` is { name, size, type, bytes } where bytes is the first few bytes
 * (or all of them) of the file.
 */
export function validateCoaSubmission({ file, purity, testDate, notes } = {}, now = new Date()) {
  if (!file || !file.size) return { ok: false, error: 'Choose the COA PDF to upload.' };
  if (file.size > COA_MAX_BYTES) return { ok: false, error: 'The COA must be 20 MB or smaller.' };
  const nameIsPdf = /\.pdf$/i.test(String(file.name || ''));
  const typeIsPdf = String(file.type || '').toLowerCase() === 'application/pdf';
  if (!(nameIsPdf || typeIsPdf) || !looksLikePdf(file.bytes)) {
    return { ok: false, error: 'The COA must be a PDF file.' };
  }
  const purityPercent = parsePurity(purity);
  if (purityPercent === null) return { ok: false, error: 'Enter the purity as a percentage between 0 and 100.' };
  const testDay = parseTestDate(testDate, now);
  if (!testDay) return { ok: false, error: 'Enter the date the sample was tested (not in the future).' };
  const labNotes = String(notes ?? '').trim().slice(0, 1000) || null;
  return {
    ok: true,
    error: null,
    value: {
      purityPercent,
      testDate: testDay,
      labNotes,
      fileName: cleanFileName(file.name),
      fileSize: Number(file.size) || 0,
    },
  };
}

/** A display name for the uploaded file: no path, no control characters. */
export function cleanFileName(name) {
  const base = String(name || '').split(/[\\/]/).pop() || '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f]+/g, '').trim().slice(0, 120);
  return cleaned || 'coa.pdf';
}

function slug(value, fallback) {
  const cleaned = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return cleaned || fallback;
}

/**
 * Storage path for a lab upload: <lab id>/<batch code>/<time>-<random>.pdf.
 * Built only from ids the server already trusts, never from the file name.
 */
export function submissionStoragePath(labId, batchCode, random = Math.random().toString(36).slice(2, 10), at = Date.now()) {
  return `${slug(labId, 'lab')}/${slug(batchCode, 'batch')}/${at}-${slug(random, 'x')}.pdf`;
}

/** Public path for an approved certificate, under the batch's code. */
export function publishedStoragePath(batchCode, submissionId) {
  return `lab-approved/${slug(batchCode, 'batch')}/${slug(submissionId, 'coa')}.pdf`;
}

/** Can staff still decide on this submission? Only while it is pending. */
export function canReviewSubmission(row) {
  return normalizeCoaStatus(row?.status) === COA_STATUS_PENDING && Boolean(row?.id);
}

/** Staff decision from a request body: 'approve' | 'reject' | null. */
export function parseReviewDecision(value) {
  const decision = String(value ?? '').trim().toLowerCase();
  return decision === 'approve' || decision === 'reject' ? decision : null;
}

/**
 * The lab's batches with each one's submissions attached, newest first, plus
 * the status a lab should read at a glance for that batch.
 */
export function groupSubmissionsByBatch(batches = [], submissions = []) {
  const byBatch = new Map();
  for (const row of submissions || []) {
    const safe = labSafeSubmission(row);
    if (!safe?.batchId) continue;
    const list = byBatch.get(safe.batchId) || [];
    list.push(safe);
    byBatch.set(safe.batchId, list);
  }
  return (batches || []).map((batch) => {
    const safe = labSafeBatch(batch);
    const list = (byBatch.get(safe.id) || [])
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return {
      ...safe,
      submissions: list,
      latestStatus: list[0]?.status || null,
      hasPending: list.some((row) => row.status === COA_STATUS_PENDING),
    };
  });
}

/** Missing-migration errors from Supabase that name one of this feature's tables or columns. */
export function isLabPortalMissing(error) {
  const message = String(error?.message || '').toLowerCase();
  const ours = ['lab_partners', 'lab_coa_submissions', 'lab_partner_id', 'coa_purity_percent', 'coa_test_date', 'coa_submission_id']
    .some((name) => message.includes(name));
  return ours && (message.includes('schema cache') || message.includes('does not exist') || message.includes('could not find'));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "2026-11-20" -> "20 Nov 2026". A test date is a calendar day, not a moment:
 * running it through a time zone would show the day before for anyone west of
 * UTC, so it is formatted from its own digits.
 */
export function formatTestDate(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '—';
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month} ${match[1]}` : '—';
}
