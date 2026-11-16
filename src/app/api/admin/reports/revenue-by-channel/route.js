import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getDatabaseBackedUsdToCrcRate } from '@/lib/exchangeRate';
import { CHANNELS, CHANNEL_KEYS } from '@/lib/channelAttribution.mjs';
import { buildRevenueByChannel, revenueByChannelCsv } from '@/lib/revenueByChannel.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAY_MS = 86400000;
const PAGE = 1000;
const MAX_ROWS = 50000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Every order is read (not just the window) because "new customer" means their
// first paid order ever. Only the columns the report needs.
const BASE_COLUMNS = [
  'id', 'order_number', 'status', 'stats_override', 'currency', 'total_usd', 'total_crc',
  'refunded_amount_usd', 'refunded_amount_crc', 'customer_phone', 'customer_email',
  'created_at', 'ads_paid_at', 'payment_method', 'sales_agent', 'ad_attribution',
  'landing_ref', 'landing_cid', 'landing_ttclid', 'journey_id', 'journey_enrollment_id',
  'campaign_id', 'affiliate_id',
];
// add-order-channel-attribution.sql. Read without them on a database where it
// has not been run, so the report still opens (everything as Unknown).
const CHANNEL_COLUMNS = ['lt_channel', 'ft_channel', 'captured_by', 'last_touch'];

async function access(request) {
  return verifyAdminSession(request, { requirePermission: 'revenue_channel' });
}

async function loadOrders(supabase) {
  for (const columns of [[...BASE_COLUMNS, ...CHANNEL_COLUMNS], BASE_COLUMNS]) {
    const rows = [];
    let failed = null;
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await supabase
        .from('orders')
        .select(columns.join(','))
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) { failed = error; break; }
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    if (!failed) return { rows, tracked: columns.length > BASE_COLUMNS.length };
    if (!/column|schema cache|does not exist/i.test(failed.message || '')) throw failed;
  }
  return { rows: [], tracked: false };
}

async function loadAdSpend(supabase) {
  const { data, error } = await supabase
    .from('ad_spend')
    .select('week_start, channel, amount_usd, entered_by, updated_at')
    .order('week_start', { ascending: false })
    .limit(500);
  if (error) return { rows: [], ready: false };
  return { rows: data || [], ready: true };
}

/** Costa Rica midnight of a YYYY-MM-DD, in ms. */
const crMidnight = (date) => Date.parse(`${date}T06:00:00Z`);

export async function GET(request) {
  const auth = await access(request);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const today = new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10);
    const toDate = DATE_RE.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : today;
    const fromDefault = new Date(crMidnight(toDate) - 6 * DAY_MS - 6 * 3600000).toISOString().slice(0, 10);
    const fromDate = DATE_RE.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : fromDefault;
    const from = crMidnight(fromDate);
    const to = crMidnight(toDate) + DAY_MS;
    if (!(to > from) || to - from > 400 * DAY_MS) {
      return NextResponse.json({ error: 'Choose a date range of up to 400 days.' }, { status: 400 });
    }
    const view = url.searchParams.get('view') === 'first' ? 'first' : 'last';
    const customers = ['new', 'returning'].includes(url.searchParams.get('customers')) ? url.searchParams.get('customers') : 'all';
    const agent = String(url.searchParams.get('agent') || '').slice(0, 120);

    const supabase = getSupabaseAdmin();
    const [{ rows: orders, tracked }, spend, rate] = await Promise.all([
      loadOrders(supabase),
      loadAdSpend(supabase),
      getDatabaseBackedUsdToCrcRate().catch(() => null),
    ]);

    const report = buildRevenueByChannel(orders, { from, to, view, customers, agent, rate, adSpend: spend.rows });

    if (url.searchParams.get('format') === 'csv') {
      return new NextResponse(revenueByChannelCsv(report), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="revenue-by-channel-${fromDate}-to-${toDate}.csv"`,
        },
      });
    }

    const firstTracked = orders.find((order) => order.lt_channel)?.created_at || null;
    const agents = [...new Set(orders.map((order) => String(order.sales_agent || '').trim()).filter(Boolean))].sort();
    return NextResponse.json({
      ...report,
      fromDate,
      toDate,
      rate,
      agents,
      channelsList: CHANNELS,
      tracking: { ready: tracked, adSpendReady: spend.ready, goLive: firstTracked },
      adSpend: spend.rows.slice(0, 60),
    });
  } catch (error) {
    console.error('[reports/revenue-by-channel]', error.message);
    return NextResponse.json({ error: 'Could not build the report.' }, { status: 500 });
  }
}

/** Save one week's ad spend for one channel. An amount of 0 removes it. */
export async function POST(request) {
  const auth = await access(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const week = String(body.week_start || '');
    const channel = String(body.channel || '');
    const amount = Math.round(Number(body.amount_usd) * 100) / 100;
    if (!DATE_RE.test(week) || !Number.isFinite(Date.parse(week))) {
      return NextResponse.json({ error: 'Pick the week (its Monday).' }, { status: 400 });
    }
    if (!CHANNEL_KEYS.has(channel) || CHANNELS.find((c) => c.key === channel)?.type !== 'paid') {
      return NextResponse.json({ error: 'Ad spend is for paid channels only.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0 || amount > 10000000) {
      return NextResponse.json({ error: 'Enter the amount in dollars.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const enteredBy = auth.profile?.full_name || auth.profile?.name || auth.user?.email || 'admin';
    const { error } = amount === 0
      ? await supabase.from('ad_spend').delete().eq('week_start', week).eq('channel', channel)
      : await supabase.from('ad_spend').upsert(
        { week_start: week, channel, amount_usd: amount, entered_by: enteredBy, updated_at: new Date().toISOString() },
        { onConflict: 'week_start,channel' },
      );
    if (error) {
      const missing = /ad_spend|schema cache|does not exist/i.test(error.message || '');
      return NextResponse.json({
        error: missing ? 'Run add-order-channel-attribution.sql in Supabase first.' : error.message,
      }, { status: missing ? 409 : 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[reports/revenue-by-channel] ad spend', error.message);
    return NextResponse.json({ error: 'Could not save the ad spend.' }, { status: 500 });
  }
}
