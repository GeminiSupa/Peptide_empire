import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isLabTier } from '@/lib/subUserTier.mjs';
import { LAB_PORTAL_MIGRATION, isLabPortalMissing, labPartnerIdForProfile } from '@/lib/labPortal.mjs';

/**
 * The one door into every lab screen.
 *
 * Returns { profile, user, lab, supabaseAdmin } or { error }. The lab is looked
 * up from the signed-in user's id and nothing else: no lab id is accepted from
 * the query string or the body anywhere in this feature, so "lab A reads lab
 * B's batches" has nothing to aim at.
 *
 * Only the lab tier gets through. A staff login reaching these routes is
 * refused here too, so the lab routes stay closed in that direction as well
 * (staff review uploads from the Lab batches tab, on their own routes).
 */
export async function requireLabSession(request) {
  const session = await verifyAdminSession(request, {
    allowLab: true,
    skipPathPermission: true,
  });
  if (session.error) return { error: session.error };

  if (!isLabTier(session.profile)) {
    return {
      error: NextResponse.json({ error: 'This page is for lab partner logins only.' }, { status: 403 }),
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: labs, error } = await supabaseAdmin
    .from('lab_partners')
    .select('id, name, admin_profile_user_id')
    .eq('admin_profile_user_id', session.profile.user_id);

  if (error) {
    if (isLabPortalMissing(error)) {
      return {
        error: NextResponse.json(
          { error: `The lab portal is not switched on yet. Run ${LAB_PORTAL_MIGRATION} in Supabase first.` },
          { status: 503 }
        ),
      };
    }
    console.error('[Lab] Could not load the lab for this login:', error.message);
    return { error: NextResponse.json({ error: 'Could not load your lab account' }, { status: 500 }) };
  }

  const labId = labPartnerIdForProfile(session.profile, labs || []);
  const lab = (labs || []).find((row) => row.id === labId) || null;
  if (!lab) {
    return {
      error: NextResponse.json({ error: 'This login is not linked to a lab account' }, { status: 403 }),
    };
  }

  return { profile: session.profile, user: session.user, lab, supabaseAdmin };
}
