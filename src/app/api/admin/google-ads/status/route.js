import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { GOOGLE_ADS_REQUIRED_ENV } from '@/lib/googleAdsClient';
export async function GET(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  const missing = GOOGLE_ADS_REQUIRED_ENV.filter(key => !process.env[key]);
  const admin = getSupabaseAdmin(), queue = {};
  for (const status of ['pending','leased','submitted','accepted','failed','skipped']) {
    const result = await admin.from('google_ads_conversion_exports').select('id', { count: 'exact', head: true }).eq('status', status);
    if (result.error) return Response.json({ enabled: false, missing, schemaReady: false, migration: 'add-google-ads-conversions.sql' });
    queue[status] = result.count;
  }
  return Response.json({ enabled: process.env.GOOGLE_ADS_OFFLINE_ENABLED === 'true', schemaReady: true, missing, queue }, { headers: { 'Cache-Control': 'no-store' } });
}
