import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scopedAdmin } from '@/lib/siteScopedAdmin.mjs';
import { assignableOwnerNames } from '@/lib/orderOwnership.mjs';
import { isInternalStaff } from '@/lib/subUserTier.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The authoritative roster used by order-owner dropdowns. */
export async function GET(request) {
  const auth = await verifyAdminSession(request);
  if (auth.error) return auth.error;

  const supabase = scopedAdmin(auth.activeSite);
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('user_id, name, email, tier, status, is_superadmin')
    .order('name', { ascending: true });

  if (error) {
    console.error('[admin/orders/agents]', error);
    return Response.json({ error: 'Could not load the team roster.' }, { status: 500 });
  }

  const profiles = (data || [])
    .filter(isInternalStaff)
    .map((profile) => ({
      ...profile,
      name: String(profile.name || '').trim() || null,
      email: String(profile.email || '').trim() || null,
    }));

  return Response.json(
    { agents: assignableOwnerNames(profiles), profiles },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
