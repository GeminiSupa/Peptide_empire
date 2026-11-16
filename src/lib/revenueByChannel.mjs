/**
 * The revenue-by-channel report, worked out from CRM orders alone.
 *
 * Every order that became money counts once, in one channel, so the channel
 * rows always add up to the revenue on the Today tiles. What counts as money,
 * and how much, is orderRevenue.mjs's decision — this file never re-decides it.
 *
 * Pure, no '@/lib' imports: the API route feeds it rows, the tests feed it
 * fixtures.
 */

import { CHANNELS, channelInfo, classifyTouch, CHANNEL_KEYS } from './channelAttribution.mjs';
import { orderCountsAsSale, orderNetRevenue } from './orderRevenue.mjs';

const CR_OFFSET_MS = 6 * 3600000; // Costa Rica is UTC-6 all year.
const DAY_MS = 86400000;

const lower = (value) => String(value ?? '').trim().toLowerCase();
const phoneKey = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-8) : '';
};
const emailKey = (value) => {
  const email = lower(value);
  return email.includes('@') ? email : '';
};

/** When the order became money: the moment it was first paid, else when it was placed. */
export function orderPaidAt(order) {
  const paid = Date.parse(order?.ads_paid_at || '');
  if (Number.isFinite(paid)) return paid;
  const created = Date.parse(order?.created_at || '');
  return Number.isFinite(created) ? created : NaN;
}

/** "2026-11-08" in Costa Rica time. */
export function crDayKey(ms) {
  return new Date(ms - CR_OFFSET_MS).toISOString().slice(0, 10);
}

function legacyTouch(order) {
  // Orders placed before channel tracking still carry some of their source:
  // Google's click (ad_attribution), the media buyer's landing ref and click
  // ids, an email journey or campaign, an affiliate.
  const ad = order?.ad_attribution && typeof order.ad_attribution === 'object' ? order.ad_attribution : {};
  const touch = {
    gclid: ad.gclid || '',
    gbraid: ad.gbraid || '',
    wbraid: ad.wbraid || '',
    ttclid: order?.landing_ttclid || '',
    cid: order?.landing_cid || '',
    lref: order?.landing_ref || '',
  };
  if (touch.gclid || touch.gbraid || touch.wbraid || touch.ttclid || touch.cid || touch.lref) {
    const channel = classifyTouch(touch);
    if (channel !== 'referral' && channel !== 'direct') return channel;
  }
  if (order?.journey_id || order?.campaign_id || order?.journey_enrollment_id) return 'email';
  if (order?.affiliate_id) return 'agent_referral';
  return null;
}

/**
 * The order's last-touch and first-touch channels and how its source was
 * captured. Falls back to whatever older orders carry, then to unknown.
 */
export function orderChannels(order) {
  const valid = (key) => (CHANNEL_KEYS.has(key) ? key : null);
  const lt = valid(order?.lt_channel);
  const ft = valid(order?.ft_channel);
  const captured = lower(order?.captured_by);
  if (lt || ft) {
    return {
      last: lt || ft,
      first: ft || lt,
      capturedBy: ['website', 'whatsapp_ref', 'agent', 'partner_api'].includes(captured) ? captured : 'website',
    };
  }
  const legacy = legacyTouch(order);
  if (legacy) return { last: legacy, first: legacy, capturedBy: order?.affiliate_id && legacy === 'agent_referral' ? 'agent' : 'website' };
  return { last: 'unknown', first: 'unknown', capturedBy: 'unknown' };
}

function orderPrefix(order) {
  return String(order?.order_number || '').split('-')[0].toUpperCase();
}

/**
 * Orders that became money, each once. A customer who tried a card (CARD-…)
 * and then paid on WhatsApp (WPCR-…) within a day for the same amount is one
 * sale: the first paid one is kept.
 */
export function countableOrders(orders, rate) {
  const sales = [];
  for (const order of orders || []) {
    if (!orderCountsAsSale(order)) continue;
    const money = orderNetRevenue(order, rate);
    // A 100% test code, or a fully refunded sale, leaves nothing to count.
    if (!(money.usd > 0)) continue;
    const paidAt = orderPaidAt(order);
    if (!Number.isFinite(paidAt)) continue;
    // The colones the order was charged. A dollar-only row (no colón figure)
    // is read at the given rate, the same fallback orderRevenue uses the other way.
    const crc = money.crc > 0 ? money.crc : Math.round(money.usd * (Number(rate) > 0 ? Number(rate) : 0));
    sales.push({ order, paidAt, usd: money.usd, crc });
  }
  sales.sort((a, b) => a.paidAt - b.paidAt);
  const kept = [];
  for (const sale of sales) {
    const phone = phoneKey(sale.order.customer_phone);
    const prefix = orderPrefix(sale.order);
    const duplicate = phone && kept.some((other) => (
      phoneKey(other.order.customer_phone) === phone
      && orderPrefix(other.order) !== prefix
      && ['CARD', 'WPCR'].includes(prefix) && ['CARD', 'WPCR'].includes(orderPrefix(other.order))
      && Math.abs(other.usd - sale.usd) < 0.01
      && sale.paidAt - other.paidAt < DAY_MS
    ));
    if (!duplicate) kept.push(sale);
  }
  return kept;
}

/** The customer's key for new-vs-returning: phone first, then email. */
export function customerKey(order) {
  const phone = phoneKey(order?.customer_phone);
  if (phone) return `p:${phone}`;
  const email = emailKey(order?.customer_email);
  return email ? `e:${email}` : `o:${order?.id || order?.order_number || ''}`;
}

/** Each customer's first paid order id, across all time. */
export function firstOrderByCustomer(sales) {
  const first = new Map();
  for (const sale of [...sales].sort((a, b) => a.paidAt - b.paidAt)) {
    const key = customerKey(sale.order);
    if (!first.has(key)) first.set(key, sale.order.id ?? sale.order.order_number);
  }
  return first;
}

const emptyTotals = () => ({ orders: 0, usd: 0, crc: 0 });
const round2 = (value) => Math.round(value * 100) / 100;
const emptyDay = (day) => ({ day, paid: 0, organic: 0, unknown: 0, paidCrc: 0, organicCrc: 0, unknownCrc: 0 });
const DAY_FIELDS = ['paid', 'organic', 'unknown', 'paidCrc', 'organicCrc', 'unknownCrc'];

/**
 * The whole report for one window.
 *
 * @param {object[]} allOrders every order (needed to tell new from returning)
 * @param {object} opts
 *   from, to          ms bounds on the paid date (to exclusive)
 *   view              'last' | 'first'
 *   customers         'all' | 'new' | 'returning'
 *   agent             '' or a sales_agent name
 *   rate              USD→CRC fallback rate
 *   adSpend           [{ week_start, channel, amount_usd }]
 *   goLive            ms when channel tracking started (chart marker)
 */
export function buildRevenueByChannel(allOrders, opts = {}) {
  const { from, to, view = 'last', customers = 'all', agent = '', rate, adSpend = [] } = opts;
  const sales = countableOrders(allOrders, rate);
  const firstOrders = firstOrderByCustomer(sales);

  const inWindow = (sale, start, end) => sale.paidAt >= start && sale.paidAt < end;
  const matchesFilters = (sale) => {
    const isNew = firstOrders.get(customerKey(sale.order)) === (sale.order.id ?? sale.order.order_number);
    if (customers === 'new' && !isNew) return false;
    if (customers === 'returning' && isNew) return false;
    if (agent && lower(sale.order.sales_agent) !== lower(agent)) return false;
    return true;
  };

  const span = to - from;
  const current = sales.filter((sale) => inWindow(sale, from, to) && matchesFilters(sale));
  const previous = sales.filter((sale) => inWindow(sale, from - span, from) && matchesFilters(sale));

  const rows = new Map(CHANNELS.map((channel) => [channel.key, {
    ...channel, ...emptyTotals(), newCustomers: 0, assisted: 0, spendUsd: 0, firstUsd: 0, lastUsd: 0, firstCrc: 0, lastCrc: 0,
  }]));
  const totals = { ...emptyTotals(), newCustomers: 0, returning: 0 };
  const byType = { paid: emptyTotals(), organic: emptyTotals(), unknown: emptyTotals() };
  const coverage = { website: 0, whatsapp_ref: 0, agent: 0, partner_api: 0, unknown: 0 };
  const clickIds = { googleWith: 0, google: 0, metaWith: 0, meta: 0 };
  const days = new Map();
  const drill = [];

  for (const sale of current) {
    const channels = orderChannels(sale.order);
    const key = view === 'first' ? channels.first : channels.last;
    const row = rows.get(key) || rows.get('unknown');
    const isNew = firstOrders.get(customerKey(sale.order)) === (sale.order.id ?? sale.order.order_number);

    row.orders += 1; row.usd += sale.usd; row.crc += sale.crc;
    if (isNew) row.newCustomers += 1;
    totals.orders += 1; totals.usd += sale.usd; totals.crc += sale.crc;
    if (isNew) totals.newCustomers += 1; else totals.returning += 1;
    const type = byType[row.type] || byType.unknown;
    type.orders += 1; type.usd += sale.usd; type.crc += sale.crc;

    rows.get(channels.first).firstUsd += sale.usd;
    rows.get(channels.last).lastUsd += sale.usd;
    rows.get(channels.first).firstCrc += sale.crc;
    rows.get(channels.last).lastCrc += sale.crc;
    if (channels.first !== channels.last && channels.first !== 'unknown') rows.get(channels.first).assisted += 1;

    coverage[channels.capturedBy] = (coverage[channels.capturedBy] || 0) + 1;
    if (channels.last === 'google_ads') {
      clickIds.google += 1;
      const lt = sale.order.last_touch || {};
      const ad = sale.order.ad_attribution || {};
      if (lt.gclid || lt.gbraid || lt.wbraid || ad.gclid || ad.gbraid || ad.wbraid) clickIds.googleWith += 1;
    }
    if (channels.last === 'meta_ads') {
      clickIds.meta += 1;
      if ((sale.order.last_touch || {}).fbclid) clickIds.metaWith += 1;
    }

    const day = crDayKey(sale.paidAt);
    const bucket = days.get(day) || emptyDay(day);
    bucket[row.type] = (bucket[row.type] || 0) + sale.usd;
    bucket[`${row.type}Crc`] = (bucket[`${row.type}Crc`] || 0) + sale.crc;
    days.set(day, bucket);

    drill.push({
      id: sale.order.id,
      orderNumber: sale.order.order_number,
      paidAt: sale.paidAt,
      usd: round2(sale.usd),
      crc: sale.crc,
      paymentMethod: sale.order.payment_method || '',
      channel: key,
      first: channels.first,
      last: channels.last,
      campaign: (sale.order.last_touch || {}).cmp || sale.order.landing_ref || '',
      capturedBy: channels.capturedBy,
      customerType: isNew ? 'new' : 'returning',
      agent: sale.order.sales_agent || '',
    });
  }

  for (const spend of adSpend || []) {
    const start = Date.parse(`${spend.week_start}T06:00:00Z`);
    if (!Number.isFinite(start) || start < from - 6 * DAY_MS || start >= to) continue;
    const row = rows.get(spend.channel);
    if (row) row.spendUsd += Number(spend.amount_usd) || 0;
  }

  const previousUsd = previous.reduce((sum, sale) => sum + sale.usd, 0);
  const previousCrc = previous.reduce((sum, sale) => sum + sale.crc, 0);
  const channels = [...rows.values()]
    .map((row) => ({
      key: row.key,
      label: row.label,
      type: row.type,
      orders: row.orders,
      usd: round2(row.usd),
      crc: row.crc,
      share: totals.usd > 0 ? row.usd / totals.usd : 0,
      avgUsd: row.orders ? round2(row.usd / row.orders) : 0,
      avgCrc: row.orders ? Math.round(row.crc / row.orders) : 0,
      newCustomers: row.newCustomers,
      assisted: row.assisted,
      spendUsd: round2(row.spendUsd),
      roas: row.type === 'paid' && row.spendUsd > 0 ? round2(row.usd / row.spendUsd) : null,
      firstUsd: round2(row.firstUsd),
      lastUsd: round2(row.lastUsd),
      firstCrc: row.firstCrc,
      lastCrc: row.lastCrc,
    }))
    .filter((row) => row.orders > 0 || row.spendUsd > 0 || row.firstUsd > 0)
    .sort((a, b) => b.usd - a.usd);

  const spendTotal = channels.reduce((sum, row) => sum + row.spendUsd, 0);
  const paidUsd = channels.filter((row) => row.type === 'paid').reduce((sum, row) => sum + row.usd, 0);

  return {
    window: { from, to, view, customers, agent },
    totals: {
      orders: totals.orders,
      usd: round2(totals.usd),
      crc: totals.crc,
      avgUsd: totals.orders ? round2(totals.usd / totals.orders) : 0,
      avgCrc: totals.orders ? Math.round(totals.crc / totals.orders) : 0,
      newCustomers: totals.newCustomers,
      returning: totals.returning,
      previousUsd: round2(previousUsd),
      previousCrc,
      changePct: previousUsd > 0 ? (totals.usd - previousUsd) / previousUsd : null,
      spendUsd: round2(spendTotal),
      roas: spendTotal > 0 ? round2(paidUsd / spendTotal) : null,
    },
    byType: Object.fromEntries(Object.entries(byType).map(([type, value]) => [type, {
      orders: value.orders,
      usd: round2(value.usd),
      crc: value.crc,
      share: totals.usd > 0 ? value.usd / totals.usd : 0,
    }])),
    channels,
    days: dailySeries(days, from, to),
    coverage: Object.entries(coverage).map(([key, orders]) => ({
      key, orders, share: totals.orders ? orders / totals.orders : 0,
    })),
    clickIds,
    orders: drill.sort((a, b) => b.paidAt - a.paidAt),
  };
}

/** One bar per Costa Rica day (or per week past 31 days), gaps filled with zero. */
function dailySeries(days, from, to) {
  const out = [];
  for (let t = from; t < to; t += DAY_MS) {
    const day = crDayKey(t);
    const bucket = days.get(day) || emptyDay(day);
    out.push({
      day,
      paid: round2(bucket.paid), organic: round2(bucket.organic), unknown: round2(bucket.unknown),
      paidCrc: bucket.paidCrc, organicCrc: bucket.organicCrc, unknownCrc: bucket.unknownCrc,
    });
  }
  if (out.length <= 31) return out;
  const weeks = [];
  for (let i = 0; i < out.length; i += 7) {
    const slice = out.slice(i, i + 7);
    const week = { day: slice[0].day, week: true };
    for (const field of DAY_FIELDS) {
      const sum = slice.reduce((s, d) => s + d[field], 0);
      week[field] = field.endsWith('Crc') ? sum : round2(sum);
    }
    weeks.push(week);
  }
  return weeks;
}

/** CSV of the drill-down rows, for the Export button. */
export function revenueByChannelCsv(report) {
  const head = ['order', 'paid_at_cr', 'value_usd', 'value_crc', 'payment', 'channel', 'first_touch', 'last_touch', 'campaign', 'captured_by', 'customer', 'agent'];
  const esc = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [head.join(',')];
  for (const row of report.orders) {
    lines.push([
      row.orderNumber,
      new Date(row.paidAt - CR_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 16),
      row.usd, row.crc, row.paymentMethod,
      channelInfo(row.channel).label, channelInfo(row.first).label, channelInfo(row.last).label,
      row.campaign, row.capturedBy, row.customerType, row.agent,
    ].map(esc).join(','));
  }
  return lines.join('\n');
}
