import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { recordAdminActivity } from '@/lib/adminActivityLog.mjs';
import { LAB_PORTAL_MIGRATION, isLabPortalMissing } from '@/lib/labPortal.mjs';
import { describeLabLogin } from '@/lib/labAdminAccess.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lab partners and their logins — from the Lab batches tab.
 *
 * Superadmin only, all of it: handing an outside lab a login is not something
 * a staff permission should cover. The login this route makes can only ever be
 * tier 'lab', which verifyAdminSession refuses everywhere except /api/lab/*.
 *
 * IT NEVER TOUCHES A TEAM LOGIN. If the email already signs in as somebody,
 * creation is refused rather than converting them; revoking only removes a
 * login that is tier 'lab'. Same rule as the affiliate Logins & Access screen.
 */

const MIN_PASSWORD = 8;
const PROFILE_COLUMNS = 'user_id, name, email, tier, status, is_superadmin';

function migrationResponse() {
  return NextResponse.json(
    { error: `Lab logins are not switched on yet. Run ${LAB_PORTAL_MIGRATION} in Supabase first.`, migration: LAB_PORTAL_MIGRATION },
    { status: 503 }
  );
}

/** GET — every lab, its login state and how many batches it has. */
export async function GET(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true, skipPathPermission: true });
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  const [labsResult, batchesResult] = await Promise.all([
    supabase.from('lab_partners').select('*').order('name'),
    supabase.from('product_batches').select('lab_partner_id').not('lab_partner_id', 'is', null),
  ]);
  if (labsResult.error) {
    if (isLabPortalMissing(labsResult.error)) return migrationResponse();
    console.error('[lab-partners]', labsResult.error.message);
    return NextResponse.json({ error: 'Could not load labs' }, { status: 500 });
  }

  const userIds = (labsResult.data || []).map((lab) => lab.admin_profile_user_id).filter(Boolean);
  const { data: profiles } = userIds.length
    ? await supabase.from('admin_profiles').select(PROFILE_COLUMNS).in('user_id', userIds)
    : { data: [] };

  const batchCount = new Map();
  for (const row of batchesResult.data || []) {
    batchCount.set(row.lab_partner_id, (batchCount.get(row.lab_partner_id) || 0) + 1);
  }

  return NextResponse.json({
    ok: true,
    labs: (labsResult.data || []).map((lab) => ({
      id: lab.id,
      name: lab.name,
      contactEmail: lab.contact_email || '',
      notes: lab.notes || '',
      batchCount: batchCount.get(lab.id) || 0,
      ...describeLabLogin(lab, profiles || []),
    })),
  });
}

/**
 * POST { action, ... }
 *   create        { name, email, password? }  add a lab (and its login if a password is given)
 *   create_login  { labId, password }         give an existing lab a login
 *   revoke_login  { labId }                   remove the lab's login; the lab and its history stay
 */
export async function POST(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true, skipPathPermission: true });
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();
  const actor = auth.profile;

  if (body.action === 'create') {
    const name = String(body.name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().toLowerCase();
    if (!name) return NextResponse.json({ error: 'Enter the lab name.' }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'That email address does not look right.' }, { status: 400 });
    }
    const password = String(body.password || '');
    if (password && password.length < MIN_PASSWORD) {
      return NextResponse.json({ error: `The password must be at least ${MIN_PASSWORD} characters.` }, { status: 400 });
    }
    if (password && !email) {
      return NextResponse.json({ error: 'A login needs an email address to sign in with.' }, { status: 400 });
    }

    const { data: lab, error } = await supabase
      .from('lab_partners')
      .insert({ name, contact_email: email || null, notes: String(body.notes || '').trim() || null, created_by: actor.email })
      .select('*')
      .single();
    if (error) {
      if (isLabPortalMissing(error)) return migrationResponse();
      console.error('[lab-partners] create:', error.message);
      return NextResponse.json({ error: 'Could not add the lab.' }, { status: 500 });
    }

    await recordAdminActivity(supabase, {
      actor,
      action: 'lab_partner.created',
      subjectType: 'lab_partner',
      subjectId: lab.id,
      subjectLabel: name,
      request,
    });

    if (!password) return NextResponse.json({ ok: true, message: `${name} added. Give it a login when you are ready.` });
    return createLogin({ supabase, lab, password, actor, request });
  }

  const labId = String(body.labId || '').trim();
  if (!labId) return NextResponse.json({ error: 'Which lab?' }, { status: 400 });
  const { data: lab, error: labError } = await supabase.from('lab_partners').select('*').eq('id', labId).maybeSingle();
  if (labError) {
    if (isLabPortalMissing(labError)) return migrationResponse();
    return NextResponse.json({ error: 'Could not load that lab.' }, { status: 500 });
  }
  if (!lab) return NextResponse.json({ error: 'That lab no longer exists.' }, { status: 404 });

  if (body.action === 'create_login') {
    return createLogin({ supabase, lab, password: String(body.password || ''), actor, request });
  }
  if (body.action === 'revoke_login') {
    return revokeLogin({ supabase, lab, actor, request });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

async function createLogin({ supabase, lab, password, actor, request }) {
  if (lab.admin_profile_user_id) {
    return NextResponse.json({ error: `${lab.name} already has a login.` }, { status: 409 });
  }
  const email = String(lab.contact_email || '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Add an email address to this lab first — it is what they sign in with.' }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `Set a password of at least ${MIN_PASSWORD} characters for them to sign in with.` }, { status: 400 });
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: lab.name },
  });
  if (authError) {
    const duplicate = /already been registered|already exists/i.test(authError.message || '');
    console.error('[lab-partners] createUser:', authError.message);
    return NextResponse.json(
      {
        error: duplicate
          ? 'Somebody already signs in with that email. Use a separate address for the lab login.'
          : 'Could not create the login.',
      },
      { status: duplicate ? 409 : 500 }
    );
  }

  const userId = authData.user.id;
  const { error: profileError } = await supabase.from('admin_profiles').insert({
    user_id: userId,
    name: lab.name,
    email,
    tier: 'lab',
    status: 'active',
    is_superadmin: false,
    permissions: [],
    approved_at: new Date().toISOString(),
    approved_by: actor.email,
  });
  if (profileError) {
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    console.error('[lab-partners] profile insert:', profileError.message);
    // The tier CHECK refusing 'lab' means the migration has not run.
    const notReady = /tier_check|violates check constraint|column .* does not exist|schema cache/i.test(profileError.message || '');
    return notReady ? migrationResponse() : NextResponse.json({ error: 'Could not create the login.' }, { status: 500 });
  }

  // Linked only if still unlinked, so two clicks cannot leave two logins.
  const { data: linked, error: linkError } = await supabase
    .from('lab_partners')
    .update({ admin_profile_user_id: userId })
    .eq('id', lab.id)
    .is('admin_profile_user_id', null)
    .select('id');
  if (linkError || !linked?.length) {
    await supabase.from('admin_profiles').delete().eq('user_id', userId);
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    console.error('[lab-partners] link:', linkError?.message || 'already linked');
    return NextResponse.json({ error: 'Could not link the login to the lab. Reload and try again.' }, { status: 409 });
  }

  await recordAdminActivity(supabase, {
    actor,
    action: 'account.lab_login_created',
    subjectType: 'account',
    subjectId: userId,
    subjectLabel: email,
    detail: { access: { from: 'no login', to: `lab portal (${lab.name})` } },
    request,
  });

  return NextResponse.json({ ok: true, message: `${lab.name} can now sign in at /lab with ${email}.` });
}

async function revokeLogin({ supabase, lab, actor, request }) {
  const userId = lab.admin_profile_user_id;
  if (!userId) return NextResponse.json({ error: 'That lab has no login.' }, { status: 400 });

  const { data: profile } = await supabase.from('admin_profiles').select(PROFILE_COLUMNS).eq('user_id', userId).maybeSingle();
  const state = describeLabLogin(lab, profile ? [profile] : []);

  // Unlink first: from this moment the login resolves to no lab and every
  // /api/lab route refuses it, even if a later step fails.
  await supabase.from('lab_partners').update({ admin_profile_user_id: null }).eq('id', lab.id);

  if (state.loginState === 'lab_login') {
    await supabase.from('admin_profiles').delete().eq('user_id', userId);
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
  } else if (profile) {
    // Not a lab login (a team member was linked by hand). Unlinked, not deleted.
    console.warn(`[lab-partners] ${actor.email} unlinked non-lab login ${profile.email} from ${lab.name}; account kept`);
  }

  await recordAdminActivity(supabase, {
    actor,
    action: 'account.lab_login_revoked',
    subjectType: 'account',
    subjectId: userId,
    subjectLabel: state.loginEmail || lab.contact_email || lab.name,
    detail: { access: { from: `lab portal (${lab.name})`, to: 'removed' } },
    request,
  });

  return NextResponse.json({ ok: true, message: `${lab.name}'s login has been removed. Its batches and uploads are kept.` });
}
