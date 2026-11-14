import { NextResponse } from 'next/server';
import { deliverCampaign } from '@/lib/campaignDelivery';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const STALLED_SEND_MINUTES = 15;

export async function GET(request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdmin();

  // A send whose serverless function was killed mid-batch leaves the campaign
  // parked in `sending`: the cron only looks for `scheduled`, and the admin UI
  // refuses to retry with "Campaign is already sending". Hand those back.
  const stalledBefore = new Date(Date.now() - STALLED_SEND_MINUTES * 60 * 1000).toISOString();
  const { data: stalled } = await supabase.from('email_campaigns')
    .select('id')
    .eq('status', 'sending')
    .lt('updated_at', stalledBefore)
    .limit(5);
  const recovered = (stalled || []).map(campaign => campaign.id);
  if (recovered.length) {
    console.warn('[Scheduled campaign] Recovering stalled sends', recovered);
    await supabase.from('email_campaigns')
      .update({ status: 'scheduled', scheduled_for: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in('id', recovered)
      .eq('status', 'sending');
  }

  const { data: campaigns, error } = await supabase.from('email_campaigns')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(5);
  if (error) return NextResponse.json({ error: 'Unable to load scheduled campaigns' }, { status: 500 });

  const results = [];
  for (const campaign of campaigns || []) {
    try {
      results.push(await deliverCampaign(campaign.id));
    } catch (deliveryError) {
      console.error('[Scheduled campaign]', campaign.id, deliveryError);
      results.push({ campaignId: campaign.id, error: deliveryError.message });
    }
  }

  // Drain a campaign continuously instead of waiting for the next 5-minute cron
  // tick. A batch that finished with work still owed and no deliberate gap
  // (nextBatchAt already due) self-triggers one more run, exactly as the
  // broadcast sender does. If this fetch is dropped the campaign is still parked
  // as `scheduled_for = now`, so the ordinary cron picks it up within 5 minutes —
  // the chain only makes it faster, it is never the only thing moving the send.
  const hasImmediateContinuation = results.some(result =>
    result && !result.error && !result.held && result.completed === false
    && result.nextBatchAt && Date.parse(result.nextBatchAt) <= Date.now());
  if (hasImmediateContinuation) {
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    // Fire-and-forget: this run returns now, the next batch runs in the
    // triggered invocation. Never awaited, so a slow continuation cannot push
    // this function past its time limit.
    fetch(`${protocol}://${host}/api/cron/process-campaigns`, {
      method: 'GET',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, recovered, processed: results.length, chained: hasImmediateContinuation, results });
}
