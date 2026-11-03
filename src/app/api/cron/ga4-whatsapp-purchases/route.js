import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ga4Config, runGa4PurchaseExport } from '@/lib/ga4Purchase.mjs';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export async function GET(request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  if (process.env.GA4_OFFLINE_ENABLED !== 'true') return Response.json({ skipped: 'GA4 purchase import is off until GA4_OFFLINE_ENABLED=true.' });
  const config = ga4Config(process.env);
  if (config.missing.length) return Response.json({ skipped: 'GA4 is not configured.', missing: config.missing });
  try {
    const summary = await runGa4PurchaseExport(getSupabaseAdmin(), config);
    return Response.json(summary, { status: summary.failed ? 207 : 200 });
  } catch (error) { return Response.json({ error: error.message }, { status: 503 }); }
}
