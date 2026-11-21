import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  COA_MAX_BYTES,
  canReviewSubmission,
  cleanFileName,
  formatTestDate,
  groupSubmissionsByBatch,
  isLabPortalMissing,
  labOwnsBatch,
  labPartnerIdForProfile,
  labSafeBatch,
  labSafeSubmission,
  looksLikePdf,
  normalizeCoaStatus,
  parsePurity,
  parseReviewDecision,
  parseTestDate,
  publishedStoragePath,
  submissionStoragePath,
  validateCoaSubmission,
} from '../src/lib/labPortal.mjs';
import { describeLabLogin } from '../src/lib/labAdminAccess.mjs';
import {
  ADMIN_MODULES,
  ASSIGNABLE_ADMIN_MODULE_IDS,
  resolveAdminTabAccess,
} from '../src/lib/adminModules.js';
import { profileHasAnyAdminPermission } from '../src/lib/adminApiPermissions.mjs';
import {
  isAffiliateTier,
  isInternalStaff,
  isLabTier,
  isStaff,
  isSubUser,
  profileTier,
} from '../src/lib/subUserTier.mjs';

/**
 * A lab login belongs to an outside testing lab. These are the break-in
 * attempts, written down: the admin it must not reach, the batches and files
 * it must not see, and the certificate it must not be able to publish itself.
 */

const lab = { user_id: 'lab-user-1', tier: 'lab', status: 'active', permissions: [] };
const otherLab = { user_id: 'lab-user-2', tier: 'lab', status: 'active' };
const staff = { user_id: 'staff-1', tier: 'staff', status: 'active', permissions: ['lab_batches'] };
const superadmin = { user_id: 'super-1', is_superadmin: true, status: 'active' };

const labRows = [
  { id: 'LAB-A', admin_profile_user_id: 'lab-user-1' },
  { id: 'LAB-B', admin_profile_user_id: 'lab-user-2' },
  { id: 'LAB-C', admin_profile_user_id: null },
];

const pdfBytes = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n');
const pdf = (overrides = {}) => ({ name: 'coa.pdf', size: pdfBytes.length, type: 'application/pdf', bytes: pdfBytes, ...overrides });
const NOW = new Date('2026-11-21T12:00:00Z');

// ---------------------------------------------------------------------------
// The tier
// ---------------------------------------------------------------------------

test('the lab tier is recognised and is not team, staff or affiliate', () => {
  assert.equal(profileTier(lab), 'lab');
  assert.equal(profileTier({ tier: ' LAB ' }), 'lab');
  assert.equal(isLabTier(lab), true);
  assert.equal(isStaff(lab), false);
  assert.equal(isSubUser(lab), false);
  assert.equal(isAffiliateTier(lab), false);
  // Lead rotation, order ownership and team chat all ask this question.
  assert.equal(isInternalStaff(lab), false);
  assert.equal(isInternalStaff(staff), true);
  // A row written before the migration has no tier and must still be staff.
  assert.equal(isLabTier({ user_id: 'x' }), false);
  assert.equal(profileTier({ user_id: 'x' }), 'staff');
});

test('a lab login reaches no admin tab at all, alwaysAvailable ones included', () => {
  for (const tab of ADMIN_MODULES) {
    assert.equal(resolveAdminTabAccess(tab.id, lab), false, `${tab.id} must be refused to a lab`);
  }
  // A permissions list (hand-edited row, bad update) changes nothing.
  const sneaky = { ...lab, permissions: ['lab_batches', 'orders', 'team', 'spreadsheet'] };
  for (const tabId of ['lab_batches', 'orders', 'team', 'spreadsheet', 'home', 'team_chat', 'messenger']) {
    assert.equal(resolveAdminTabAccess(tabId, sneaky), false, `${tabId} leaked to a lab`);
  }
  // Which is what the path-permission gate on every admin route asks.
  assert.equal(profileHasAnyAdminPermission(sneaky, ['lab_batches']), false);
  assert.equal(profileHasAnyAdminPermission(sneaky, ['lab_batches', 'spreadsheet']), false);
});

test('staff with lab_batches can still review; the tier change took nothing from them', () => {
  assert.equal(resolveAdminTabAccess('lab_batches', staff), true);
  assert.equal(profileHasAnyAdminPermission(staff, ['lab_batches']), true);
  assert.equal(resolveAdminTabAccess('lab_batches', superadmin), true);
  assert.equal(ASSIGNABLE_ADMIN_MODULE_IDS.has('lab_batches'), true);
});

// ---------------------------------------------------------------------------
// Which lab, which batch
// ---------------------------------------------------------------------------

test('a lab is resolved from its login, never from a request', () => {
  assert.equal(labPartnerIdForProfile(lab, labRows), 'LAB-A');
  assert.equal(labPartnerIdForProfile(otherLab, labRows), 'LAB-B');
  // No link means no lab, not every lab.
  assert.equal(labPartnerIdForProfile({ user_id: 'nobody' }, labRows), null);
  assert.equal(labPartnerIdForProfile({}, labRows), null);
  assert.equal(labPartnerIdForProfile(lab, []), null);
  // An unlinked lab row must never match a profile with no user_id.
  assert.equal(labPartnerIdForProfile({ user_id: undefined }, labRows), null);
  assert.equal(labPartnerIdForProfile({ user_id: null }, labRows), null);
});

test('a lab owns only the batches assigned to it', () => {
  const mine = { id: 'LAB-A' };
  assert.equal(labOwnsBatch(mine, { id: 'b1', lab_partner_id: 'LAB-A' }), true);
  assert.equal(labOwnsBatch(mine, { id: 'b2', lab_partner_id: 'LAB-B' }), false);
  assert.equal(labOwnsBatch(mine, { id: 'b3', lab_partner_id: null }), false);
  assert.equal(labOwnsBatch({ id: null }, { id: 'b4', lab_partner_id: null }), false);
  assert.equal(labOwnsBatch(null, { id: 'b5', lab_partner_id: 'LAB-A' }), false);
  assert.equal(labOwnsBatch(mine, null), false);
});

test('a batch sent to a lab carries no cost, supplier or internal notes', () => {
  const safe = labSafeBatch({
    id: 'b1',
    code: 'BPC10-2611-A',
    batch_number: 'L-77',
    manufactured_date: '2026-11-01T06:00:00Z',
    expiry_date: '2028-11-01T06:00:00Z',
    coa_url: 'https://example.test/coa.pdf',
    unit_cost_usd: 3.1,
    supplier_name: 'Secret Supplier Ltd',
    notes: 'internal',
    vial_count: 500,
    created_by: 'Owner',
    lab_partner_id: 'LAB-A',
    products: { product: 'BPC-157 10mg' },
  });
  assert.deepEqual(Object.keys(safe).sort(), ['batchNumber', 'code', 'expiryDate', 'hasPublishedCoa', 'id', 'madeDate', 'product']);
  assert.equal(safe.product, 'BPC-157 10mg');
  assert.equal(safe.hasPublishedCoa, true);
});

test('a lab sees its own upload and the decision, not the reviewer or the storage path', () => {
  const safe = labSafeSubmission({
    id: 's1',
    batch_id: 'b1',
    lab_partner_id: 'LAB-A',
    file_path: 'LAB-A/bpc10-2611-a/1-x.pdf',
    file_name: 'report.pdf',
    purity_percent: '99.120',
    test_date: '2026-11-18',
    status: 'rejected',
    review_note: 'Wrong batch number on page 1',
    reviewed_by_email: 'owner@example.test',
    published_url: null,
    submitted_by_email: 'lab@example.test',
  });
  assert.equal(safe.purityPercent, 99.12);
  assert.equal(safe.reviewNote, 'Wrong batch number on page 1');
  for (const leaked of ['file_path', 'reviewed_by_email', 'reviewedBy', 'lab_partner_id', 'published_url']) {
    assert.equal(leaked in safe, false, `${leaked} must not reach a lab`);
  }
});

test('batches are grouped with their own uploads, newest first', () => {
  const grouped = groupSubmissionsByBatch(
    [{ id: 'b1', code: 'A' }, { id: 'b2', code: 'B' }],
    [
      { id: 's1', batch_id: 'b1', status: 'rejected', created_at: '2026-11-01T00:00:00Z' },
      { id: 's2', batch_id: 'b1', status: 'pending', created_at: '2026-11-10T00:00:00Z' },
      { id: 's3', batch_id: 'b-elsewhere', status: 'approved', created_at: '2026-11-11T00:00:00Z' },
    ]
  );
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped[0].submissions.map((row) => row.id), ['s2', 's1']);
  assert.equal(grouped[0].latestStatus, 'pending');
  assert.equal(grouped[0].hasPending, true);
  assert.equal(grouped[1].submissions.length, 0);
  assert.equal(grouped[1].latestStatus, null);
});

// ---------------------------------------------------------------------------
// The upload
// ---------------------------------------------------------------------------

test('only a real PDF is accepted, whatever the browser claims', () => {
  assert.equal(looksLikePdf(pdfBytes), true);
  assert.equal(looksLikePdf(Buffer.from('<html><script>')), false);
  assert.equal(looksLikePdf(Buffer.from('%PD')), false);
  assert.equal(looksLikePdf(null), false);

  const ok = validateCoaSubmission({ file: pdf(), purity: '99.12', testDate: '2026-11-18' }, NOW);
  assert.equal(ok.ok, true);
  assert.deepEqual(
    { purity: ok.value.purityPercent, date: ok.value.testDate },
    { purity: 99.12, date: '2026-11-18' }
  );

  // An HTML file renamed .pdf and sent as application/pdf.
  const html = Buffer.from('<html><body onload=alert(1)>');
  assert.equal(validateCoaSubmission({ file: pdf({ bytes: html }), purity: '99', testDate: '2026-11-18' }, NOW).ok, false);
  // A PDF-looking file with neither a .pdf name nor a PDF type.
  assert.equal(validateCoaSubmission({ file: pdf({ name: 'coa.exe', type: 'application/octet-stream' }), purity: '99', testDate: '2026-11-18' }, NOW).ok, false);
  assert.equal(validateCoaSubmission({ file: pdf({ size: COA_MAX_BYTES + 1 }), purity: '99', testDate: '2026-11-18' }, NOW).ok, false);
  assert.equal(validateCoaSubmission({ file: null, purity: '99', testDate: '2026-11-18' }, NOW).ok, false);
  assert.equal(validateCoaSubmission({ file: pdf({ size: 0 }), purity: '99', testDate: '2026-11-18' }, NOW).ok, false);
});

test('purity is a percentage between 0 and 100', () => {
  assert.equal(parsePurity('99.12'), 99.12);
  assert.equal(parsePurity('99,5'), 99.5);
  assert.equal(parsePurity('98.7%'), 98.7);
  assert.equal(parsePurity('100'), 100);
  assert.equal(parsePurity('0'), 0);
  for (const bad of ['', '100.1', '101', '-1', 'abc', '99.12345', '1e2', null, undefined, ' ']) {
    assert.equal(parsePurity(bad), null, `"${bad}" must be refused`);
  }
});

test('the test date is a real day and not in the future', () => {
  assert.equal(parseTestDate('2026-11-18', NOW), '2026-11-18');
  assert.equal(parseTestDate('2026-11-22', NOW), '2026-11-22'); // a day of grace for time zones
  for (const bad of ['2026-11-30', '2027-01-01', '2026-02-30', '18/11/2026', '', '1999-12-31', 'today']) {
    assert.equal(parseTestDate(bad, NOW), null, `"${bad}" must be refused`);
  }
});

test('storage paths come from trusted ids, never from the uploaded file name', () => {
  const p = submissionStoragePath('LAB-A', 'BPC10-2611-A', 'abc123', 1700000000000);
  assert.equal(p, 'lab-a/bpc10-2611-a/1700000000000-abc123.pdf');
  // Traversal in any input cannot climb out of the lab's folder.
  const evil = submissionStoragePath('../../coa-documents', '../x', '../../y', 1);
  assert.equal(evil.includes('..'), false);
  assert.equal(evil.split('/').length, 3);
  assert.equal(publishedStoragePath('BPC10-2611-A', 's1'), 'lab-approved/bpc10-2611-a/s1.pdf');
  assert.equal(cleanFileName('C:\\Users\\lab\\report.pdf'), 'report.pdf');
  assert.equal(cleanFileName('../../etc/passwd'), 'passwd');
  assert.equal(cleanFileName(''), 'coa.pdf');
});

// ---------------------------------------------------------------------------
// The review
// ---------------------------------------------------------------------------

test('an unknown status is read as pending, never as approved', () => {
  assert.equal(normalizeCoaStatus('approved'), 'approved');
  assert.equal(normalizeCoaStatus('REJECTED'), 'rejected');
  for (const junk of ['', null, undefined, 'published', 'live', 'true']) {
    assert.equal(normalizeCoaStatus(junk), 'pending');
  }
});

test('only a pending upload can be decided, and only approve or reject', () => {
  assert.equal(canReviewSubmission({ id: 's1', status: 'pending' }), true);
  assert.equal(canReviewSubmission({ id: 's1', status: 'approved' }), false);
  assert.equal(canReviewSubmission({ id: 's1', status: 'rejected' }), false);
  assert.equal(canReviewSubmission({ status: 'pending' }), false);
  assert.equal(parseReviewDecision('approve'), 'approve');
  assert.equal(parseReviewDecision(' Reject '), 'reject');
  for (const bad of ['publish', 'approved', '', null, 'delete']) {
    assert.equal(parseReviewDecision(bad), null);
  }
});

test('the owner panel reports what a lab login really is', () => {
  assert.equal(describeLabLogin({ admin_profile_user_id: null }, []).loginState, 'no_login');
  assert.equal(describeLabLogin({ admin_profile_user_id: 'u1' }, []).loginState, 'missing_profile');
  const real = describeLabLogin({ admin_profile_user_id: 'lab-user-1' }, [lab]);
  assert.equal(real.loginState, 'lab_login');
  assert.equal(real.loginActive, true);
  assert.equal(describeLabLogin({ admin_profile_user_id: 'lab-user-1' }, [{ ...lab, status: 'suspended' }]).loginActive, false);
  // A team login linked to a lab by hand is reported, and /lab refuses it.
  assert.equal(describeLabLogin({ admin_profile_user_id: 'staff-1' }, [staff]).loginState, 'not_lab_login');
});

test('a test date is shown as the calendar day it is', () => {
  assert.equal(formatTestDate('2026-11-18'), '18 Nov 2026');
  assert.equal(formatTestDate('2026-01-01'), '1 Jan 2026');
  assert.equal(formatTestDate(''), '—');
  assert.equal(formatTestDate(null), '—');
});

test('missing-migration errors are recognised only for this feature', () => {
  assert.equal(isLabPortalMissing({ message: 'column product_batches.lab_partner_id does not exist' }), true);
  assert.equal(isLabPortalMissing({ message: "Could not find the table 'public.lab_coa_submissions' in the schema cache" }), true);
  assert.equal(isLabPortalMissing({ message: 'column orders.packed_items does not exist' }), false);
  assert.equal(isLabPortalMissing({ message: 'duplicate key value violates unique constraint' }), false);
});

// ---------------------------------------------------------------------------
// Static guards: the rules above are only true while the routes keep to them.
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}
const read = (file) => fs.readFileSync(file, 'utf8');

test('verifyAdminSession refuses the lab tier unless a route opts in', () => {
  const source = read('src/lib/adminAuth.js');
  assert.match(source, /allowLab\s*=\s*false/, 'allowLab must default to false');
  assert.match(source, /isLabTier\(profile\)\s*&&\s*!allowLab/, 'the lab tier must be refused by default');
  assert.match(
    source,
    /isLabTier\(profile\)\s*&&\s*\(requireSuperadmin\s*\|\|\s*requirePermission\s*\|\|\s*requireAnyPermission\)/,
    'allowLab must not combine with a superadmin or permission requirement'
  );
});

test('only the lab session helper lets a lab in', () => {
  const offenders = [];
  for (const file of walk('src')) {
    if (!read(file).includes('allowLab')) continue;
    const normalised = file.split(path.sep).join('/');
    const allowed = normalised.endsWith('src/lib/adminAuth.js')
      || normalised.endsWith('src/lib/labSession.js')
      // Name the flag in doc comments, and call nothing.
      || normalised.endsWith('src/lib/labPortal.mjs')
      || normalised.endsWith('src/lib/subUserTier.mjs');
    if (!allowed) offenders.push(normalised);
  }
  assert.deepEqual(offenders, [], `these open a route to labs outside /api/lab:\n${offenders.join('\n')}`);
  assert.match(read('src/lib/labSession.js'), /allowLab:\s*true/);
  assert.match(read('src/lib/labSession.js'), /isLabTier\(session\.profile\)/, 'a staff login must not pass as a lab');
});

test('every lab route resolves the lab from the session, never the request', () => {
  const routes = walk('src/app/api/lab');
  assert.ok(routes.length >= 2, 'expected the lab routes');
  for (const file of routes) {
    const source = read(file);
    assert.ok(source.includes('requireLabSession'), `${file} must resolve the lab from the session`);
    assert.equal(source.includes('verifyAdminSession'), false, `${file} must not use a staff gate`);
    assert.equal(
      /searchParams\.get\(\s*['"]lab/i.test(source)
        || /form\.get\(\s*['"]lab/i.test(source)
        || /body\.lab/i.test(source),
      false,
      `${file} takes a lab id from the request - it must come from the session`
    );
    // Every query on the lab side is narrowed to the session's lab.
    if (source.includes(".from('product_batches')") || source.includes(".from('lab_coa_submissions')")) {
      assert.match(source, /\.eq\('lab_partner_id', lab\.id\)/, `${file} must filter by the session's lab`);
    }
    // A lab never writes the public link the QR opens, and never chooses a status.
    assert.equal(source.includes('coa_url:'), false, `${file} writes coa_url`);
    assert.equal(/status:\s*(?!COA_STATUS_PENDING)['"A-Za-z_]/.test(source.replace(/status: s\.color/g, '')), false, `${file} sets a status other than pending`);
    assert.equal(source.includes('PUBLIC_COA_BUCKET'), false, `${file} touches the public COA bucket`);
  }
});

test('a lab route never sends cost, supplier or internal notes', () => {
  for (const file of walk('src/app/api/lab')) {
    const source = read(file);
    for (const column of ['unit_cost_usd', 'supplier_name', 'packed_items', 'created_by', 'vial_count']) {
      assert.equal(source.includes(column), false, `${file} selects ${column}`);
    }
    // The batch's internal notes column (lab_notes is the lab's own).
    for (const [, columns] of source.matchAll(/\.select\(\s*'([^']*)'/g)) {
      assert.equal(/(?<![a-z_])notes\b/.test(columns), false, `${file} selects the batch notes`);
    }
  }
});

test('lab uploads stay private until a reviewer publishes them', () => {
  const upload = read('src/app/api/lab/coa/route.js');
  assert.match(upload, /LAB_SUBMISSIONS_BUCKET/);
  assert.match(upload, /public:\s*false/);
  assert.equal(upload.includes('getPublicUrl'), false, 'a lab upload must never get a public URL');

  const review = read('src/app/api/admin/lab-coa/route.js');
  assert.match(review, /requirePermission:\s*'lab_batches'/);
  // The batch link is set only after the decision is claimed out of pending.
  const claim = review.indexOf(".eq('status', COA_STATUS_PENDING)\n    .select('id');\n  if (claimError");
  const publish = review.indexOf('coa_url: publishedUrl');
  assert.ok(claim > 0 && publish > claim, 'coa_url must be set only after the approval is claimed');
});

test('the owner routes are superadmin-only and the review route is staff-only', () => {
  const partners = read('src/app/api/admin/lab-partners/route.js');
  const gates = partners.match(/verifyAdminSession\([^)]*\)/g) || [];
  assert.ok(gates.length >= 2);
  for (const gate of gates) assert.match(gate, /requireSuperadmin:\s*true/);
  assert.match(partners, /tier:\s*'lab'/, 'a login made here is always tier lab');
  assert.match(partners, /is_superadmin:\s*false/);
  assert.equal(profileHasAnyAdminPermission(lab, ['lab_batches']), false);
});

test('the migration widens the tier and locks the new tables and bucket', () => {
  const sql = read('add-lab-portal.sql');
  assert.match(sql, /CHECK \(tier IN \('staff', 'sub_user', 'affiliate', 'lab'\)\)/);
  assert.match(sql, /lab_never_superadmin/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.lab_partners FROM anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.lab_coa_submissions FROM anon, authenticated/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /'lab-coa-submissions', 'lab-coa-submissions', false/);
  assert.match(sql, /SET public = false/);
  // It will not run on a database where any login can still read every table.
  assert.match(sql, /to_regprocedure\('public\.empire_is_staff\(\)'\) IS NULL/);
  assert.match(sql, /policyname = 'staff full access'/);
  assert.ok(sql.indexOf('RAISE EXCEPTION') < sql.indexOf('ADD CONSTRAINT admin_profiles_tier_check'),
    'the guard must run before the tier is widened');
  // No policy is opened for the lab tier anywhere.
  assert.equal(/CREATE POLICY/i.test(sql), false, 'the lab migration must not add a browser policy');
});

test('the RLS lock still counts only staff and sub-users as staff', () => {
  const file = ['lock-empire-rls.sql', '../peptide-empire-admin/lock-empire-rls.sql'].find((p) => fs.existsSync(p));
  if (!file) return; // not committed on this branch yet
  const sql = read(file);
  const helper = sql.slice(sql.indexOf('FUNCTION public.empire_is_staff()'), sql.indexOf('FUNCTION public.empire_is_superadmin()'));
  assert.match(helper, /p\.tier IN \('staff', 'sub_user'\)/);
  assert.equal(helper.includes("'lab'"), false, 'a lab must never count as staff in RLS');
});
