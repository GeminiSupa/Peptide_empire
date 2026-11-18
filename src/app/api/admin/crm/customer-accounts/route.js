import { NextResponse } from 'next/server';

import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scopedAdmin } from '@/lib/siteScopedAdmin.mjs';
import { canDeleteCustomerAccount } from '@/lib/accountBonuses.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;
const METRIC_COLUMNS = 'user_id,email,display_name,phone,locale,created_at,account_kind,organization_name,order_count,lifetime_value,last_order_at';
const PROFILE_COLUMNS = 'user_id,email,display_name,phone,locale,created_at,account_kind,organization_name';
const BASIC_COLUMNS = 'user_id,email,display_name,phone,locale,created_at';

function pageNumber(value) {
  const parsed = Number.parseInt(value || '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100000) : 1;
}

function buildQuery(source, columns, { query, kind, page }) {
  let request = source.select(columns, { count: 'exact' });
  if (query) {
    const safe = query.replaceAll(',', ' ').replaceAll('(', '').replaceAll(')', '').slice(0, 100);
    request = request.or(`display_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,organization_name.ilike.%${safe}%`);
  }
  if (kind) request = request.eq('account_kind', kind);
  return request.order('created_at', { ascending: false }).order('user_id', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
}

export async function GET(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const query = String(url.searchParams.get('q') || '').trim();
  const kind = ['individual', 'research', 'clinic', 'other'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : '';
  const page = pageNumber(url.searchParams.get('page'));
  const admin = scopedAdmin(auth.activeSite);
  // The analytics view is supplied by customer-account-analytics.sql. A
  // profile fallback keeps account management usable until it is applied.
  let result = await buildQuery(admin.from('customer_account_metrics'), METRIC_COLUMNS, { query, kind, page });
  const analyticsReady = !result.error;

  let questionsReady = true;
  if (result.error) {
    result = await buildQuery(admin.from('customer_profiles'), PROFILE_COLUMNS, { query, kind, page });
    if (result.error && /account_kind|organization_name|schema cache/i.test(result.error.message || '')) {
      questionsReady = false;
      let fallback = admin.from('customer_profiles').select(BASIC_COLUMNS, { count: 'exact' });
      if (query) {
        const safe = query.replaceAll(',', ' ').replaceAll('(', '').replaceAll(')', '').slice(0, 100);
        fallback = fallback.or(`display_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
      }
      result = fallback.order('created_at', { ascending: false }).order('user_id', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    }
  }

  if (result.error) {
    console.error('[admin/customer-accounts] list', result.error);
    return NextResponse.json({ error: 'Could not load customer accounts' }, { status: 500 });
  }

  let summary = null;
  if (analyticsReady) {
    const summaryResult = await admin.rpc('admin_customer_account_summary');
    if (!summaryResult.error) summary = summaryResult.data?.[0] || null;
  }
  return NextResponse.json({ accounts: result.data || [], total: result.count || 0, page, pageSize: PAGE_SIZE, query, kind, questionsReady, analyticsReady, summary }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function DELETE(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  if (!auth.profile.is_superadmin) {
    return NextResponse.json({ error: 'Only a superadmin can delete a customer account.' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request' }, { status: 400 });
  }

  const userId = String(body?.userId || '').trim();
  if (!userId) {
    return NextResponse.json({ error: 'A customer account id is required.' }, { status: 400 });
  }

  const admin = scopedAdmin(auth.activeSite);
  const { data: staff } = await admin
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!canDeleteCustomerAccount({ userId, staffUserIds: staff ? [staff.user_id] : [] })) {
    return NextResponse.json({ error: 'That login is a staff account, so it was not deleted.' }, { status: 409 });
  }

  const { data: profile } = await admin
    .from('customer_profiles')
    .select('user_id, email')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'No customer account matched that id.' }, { status: 404 });
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[admin/customer-accounts] delete', error);
    return NextResponse.json({ error: 'The account could not be deleted.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    email: profile.email,
    message: 'The login was deleted. Their orders stay. Saved addresses and the profile are gone.',
  });
}
