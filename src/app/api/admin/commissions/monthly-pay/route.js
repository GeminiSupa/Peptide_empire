import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getDatabaseBackedUsdToCrcRate } from '@/lib/exchangeRate';
import { generateMonthlyTeamPay } from '@/lib/monthlyTeamPay.mjs';

export async function POST(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!body.userId || !body.month) return NextResponse.json({ error: 'Choose a team member and month.' }, { status: 400 });
  try {
    const admin = getSupabaseAdmin();
    const result = await admin.from('admin_profiles').select('*').eq('user_id', body.userId).maybeSingle();
    if (result.error) return NextResponse.json({ error: 'Could not read this team account.' }, { status: 503 });
    const { rate } = await getDatabaseBackedUsdToCrcRate();
    const generated = await generateMonthlyTeamPay(admin, result.data, body.month, rate);
    return NextResponse.json({ success: true, ...generated });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
