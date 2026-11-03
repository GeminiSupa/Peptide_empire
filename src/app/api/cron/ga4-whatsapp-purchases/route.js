import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ga4Config, runGa4PurchaseExport } from '@/lib/ga4Purchase.mjs';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
// Every outcome prints one line to the Vercel runtime logs. Names and counts
// only: never the API secret, and the Measurement ID only by its first two
// characters and length (enough to spot a UA- ID or a stray space).
export async function GET(request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[ga4-cron] refused: missing or wrong CRON_SECRET bearer token.');
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (process.env.GA4_OFFLINE_ENABLED !== 'true') {
    console.log(`[ga4-cron] skipped: GA4_OFFLINE_ENABLED is ${JSON.stringify(process.env.GA4_OFFLINE_ENABLED ?? null)}; it must be exactly "true" in the Production environment, and the project must be redeployed after it is changed.`);
    return Response.json({ skipped: 'GA4 purchase import is off until GA4_OFFLINE_ENABLED=true.' });
  }
  const config = ga4Config(process.env);
  if (config.missing.length) {
    console.log(`[ga4-cron] skipped: missing or malformed ${config.missing.join(', ')} (measurement ID starts with ${JSON.stringify(config.measurementId.slice(0, 2))}, length ${config.measurementId.length}; API secret ${config.apiSecret ? 'set' : 'not set'}).`);
    return Response.json({ skipped: 'GA4 is not configured.', missing: config.missing });
  }
  try {
    const summary = await runGa4PurchaseExport(getSupabaseAdmin(), config);
    console.log(`[ga4-cron] ran: sent ${summary.sent}, skipped ${summary.skipped}, failed ${summary.failed}.`);
    return Response.json(summary, { status: summary.failed ? 207 : 200 });
  } catch (error) {
    console.error(`[ga4-cron] failed: ${error.message}`);
    return Response.json({ error: error.message }, { status: 503 });
  }
}
