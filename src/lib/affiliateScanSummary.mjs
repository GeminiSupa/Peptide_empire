/**
 * What the affiliate commission scan found, in words the person running it can
 * act on.
 *
 * The scan used to answer every run with "Affiliate commissions synced!", so
 * "All affiliates, all time" coming back blank read as a broken payout system.
 * It was not: every paid referral so far belonged to a sales agent, and sales
 * agents are paid on the Team tab's Commission Payouts. Nothing on this screen
 * said so, and you had to already know which of the two reports a person is on.
 *
 * Kept free of '@/lib' imports so tests/ can load it under `node --test`.
 */

import { isSalesAgentAffiliate } from './salesAgentAffiliate.mjs';
import { formatCrDate } from './crTime.mjs';

export const SALES_AGENT_PAYOUT_SCREEN = 'Team → Commission Payouts';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Counts, from the orders the scan looked at, everything it did not invoice.
 *
 * @param {object} input
 * @param {object[]} input.orders paid orders in the period carrying an affiliate_id
 * @param {object[]} input.affiliates the affiliate rows the scan considered
 * @param {Set<string>} input.paidOrderIds orders already on an approved/paid payout
 * @param {string|null} input.targetAffiliateId the one affiliate picked, if any
 */
export function summarizeAffiliateScan({
  orders = [],
  affiliates = [],
  paidOrderIds = new Set(),
  targetAffiliateId = null,
} = {}) {
  const byId = new Map((affiliates || []).map((row) => [row.id, row]));
  const agentCounts = new Map();
  let alreadyOnPayout = 0;

  for (const order of orders || []) {
    const affiliate = byId.get(order?.affiliate_id);
    if (!affiliate) continue;
    if (isSalesAgentAffiliate(affiliate)) {
      const name = String(affiliate.name || affiliate.email || 'Unnamed').trim();
      agentCounts.set(name, (agentCounts.get(name) || 0) + 1);
    } else if (paidOrderIds.has(order.id)) {
      alreadyOnPayout += 1;
    }
  }

  const target = targetAffiliateId ? byId.get(targetAffiliateId) : null;

  return {
    ordersFound: (orders || []).length,
    salesAgentOrders: [...agentCounts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    alreadyOnPayout,
    targetSalesAgent: target && isSalesAgentAffiliate(target)
      ? String(target.name || target.email || '').trim()
      : null,
  };
}

/**
 * The message shown after a scan. Says what was found, and for anything not
 * invoiced, why and where it is paid instead.
 *
 * @param {object} input
 * @param {{start?: string, end?: string}} input.period the instants the scan covered
 * @param {string} input.periodKey 'previous' | 'current' | 'all-time' | 'custom'
 * @param {object[]} input.payoutReport the route's per-affiliate results
 * @param {object} [input.summary] summarizeAffiliateScan's result
 */
export function affiliateScanMessage({ period = {}, periodKey = '', payoutReport = [], summary = {} } = {}) {
  const span = periodKey === 'all-time'
    ? 'for all time'
    : `from ${formatCrDate(period.start, { month: 'short', day: 'numeric' })} to ${formatCrDate(period.end, { month: 'short', day: 'numeric', year: 'numeric' })} (Costa Rica time)`;

  const agentOrders = Array.isArray(summary?.salesAgentOrders) ? summary.salesAgentOrders : [];
  const saved = (payoutReport || []).filter((row) => row?.savedSuccessfully !== false);
  const failed = (payoutReport || []).filter((row) => row?.savedSuccessfully === false);
  const lines = [];

  if (summary?.targetSalesAgent) {
    const own = agentOrders.find((row) => row.name === summary.targetSalesAgent);
    lines.push(
      `${summary.targetSalesAgent} is a sales agent, so their referrals are paid under ${SALES_AGENT_PAYOUT_SCREEN}, not here.`
      + (own ? ` They have ${plural(own.count, 'paid referral order')} ${span}.` : '')
    );
    return lines.join('\n\n');
  }

  if (saved.length) {
    lines.push(`Commission found for ${plural(saved.length, 'affiliate')} ${span}. Review and approve it below.`);
  } else if (!failed.length) {
    lines.push(`No unpaid affiliate commission ${span}.`);
  }

  for (const row of failed) {
    lines.push(`Could not save the payout for ${row.name || row.email}: ${row.saveError || 'unknown error'}.`);
  }

  if (agentOrders.length) {
    const total = agentOrders.reduce((sum, row) => sum + row.count, 0);
    const names = agentOrders.map((row) => `${row.name} (${row.count})`).join(', ');
    lines.push(
      `${plural(total, 'paid order')} came through sales agents: ${names}. `
      + `Sales agents are paid under ${SALES_AGENT_PAYOUT_SCREEN}, not here.`
    );
  }

  if (summary?.alreadyOnPayout) {
    lines.push(`${plural(summary.alreadyOnPayout, 'order')} already on an approved or paid affiliate payout, so not counted again.`);
  }

  if (!saved.length && !failed.length && !agentOrders.length && !summary?.alreadyOnPayout) {
    lines.push('No paid order in this period used an affiliate code or link. Pending, declined and cancelled orders do not count.');
  }

  return lines.join('\n\n');
}
