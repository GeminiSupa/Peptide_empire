import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { googleAdsClient } from '@/lib/googleAdsClient';
import { runGoogleAdsImport } from '@/lib/googleAdsImport.mjs';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export async function GET(request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  if (process.env.GOOGLE_ADS_OFFLINE_ENABLED !== 'true') return Response.json({ skipped: 'Offline import is disabled until configuration and validation are complete.' });
  try {
    const google = await googleAdsClient(); const admin = getSupabaseAdmin();
    const summary = await runGoogleAdsImport(admin, google);
    return Response.json(summary, { status: summary.failed ? 207 : 200 });
  } catch (error) { return Response.json({ error: error.message }, { status: 503 }); }
}
