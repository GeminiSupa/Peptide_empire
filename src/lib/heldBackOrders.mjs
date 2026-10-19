/**
 * Money the weekly commission scan cannot see yet.
 *
 * Historical note (Oct 2026): this module existed because 'Processing' meant
 * money received but the scan refused to count it until the parcel was closed.
 * That gap cost agents real weeks of commission when orders sat at Processing
 * over a Monday scan. Processing is now in COMMISSION_ELIGIBLE_ORDER_STATUSES,
 * so there is nothing left to warn about under the current status set.
 *
 * The helpers stay so the weekly-report route and TeamManagement can keep
 * calling them; with an empty status list they simply report nothing. If a
 * future status again means "paid but not countable", add it here — and keep
 * it out of COMMISSION_ELIGIBLE_ORDER_STATUSES.
 */

import { REPORTABLE_STATUS_CHANGE_RE } from './agentAttribution.mjs';

/** Statuses that mean: the customer has paid, and the scan still cannot count it. */
export const HELD_BACK_ORDER_STATUSES = [];

const HELD_BACK_SET = new Set(HELD_BACK_ORDER_STATUSES.map((status) => status.toLowerCase()));

/** True when this order's current status is paid-but-not-yet-countable. */
export function isHeldBackStatus(status) {
  return HELD_BACK_SET.has(String(status || '').trim().toLowerCase());
}

/**
 * The first moment this order's own log says the money arrived.
 *
 * Deliberately NOT orderReportableAtMs: that one falls back to created_at when
 * the log has no payment event, which is right for an order already known to be
 * paid, and wrong here. A never-paid order created inside the period would
 * inherit a payment date it never had and be reported as missing money.
 * Returns NaN when the log does not show a payment, and the caller drops it.
 */
export function orderPaidEventMs(order) {
  const times = (Array.isArray(order?.activity_log) ? order.activity_log : [])
    .filter((entry) => (
      entry?.type === 'status_change'
      && REPORTABLE_STATUS_CHANGE_RE.test(String(entry?.message || ''))
    ))
    .map((entry) => {
      const at = entry?.at ? new Date(entry.at).getTime() : Number.NaN;
      return Number.isFinite(at) ? at : Number.NaN;
    })
    .filter(Number.isFinite);
  return times.length ? Math.min(...times) : Number.NaN;
}

/**
 * When this order's money should be counted as having arrived.
 *
 * The payment event when the log has one. Otherwise created_at — only reached
 * for a status that already means paid (see HELD_BACK_ORDER_STATUSES).
 */
export function heldBackSinceMs(order) {
  const paidAt = orderPaidEventMs(order);
  if (Number.isFinite(paidAt)) return paidAt;
  const createdAt = order?.created_at ? new Date(order.created_at).getTime() : Number.NaN;
  return Number.isFinite(createdAt) ? createdAt : Number.NaN;
}

/**
 * Orders paid inside [startMs, endMs] that the scan will leave out.
 */
export function findHeldBackOrders(orders = [], { startMs, endMs } = {}) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];
  return (orders || []).filter((order) => {
    if (!isHeldBackStatus(order?.status)) return false;
    const since = heldBackSinceMs(order);
    return Number.isFinite(since) && since >= startMs && since <= endMs;
  });
}

/**
 * What the held-back orders are worth, in both currencies.
 *
 * getAmounts is injected rather than imported, exactly as the override pricing
 * does it: resolving an order to USD and CRC needs the live exchange rate, which
 * lives behind an import alias this module stays clear of so the tests can run
 * it without the bundler.
 */
export function summarizeHeldBackOrders(orders = [], getAmounts) {
  const resolve = typeof getAmounts === 'function' ? getAmounts : () => ({ usd: 0, crc: 0 });
  let usd = 0;
  let crc = 0;
  for (const order of orders || []) {
    const amounts = resolve(order) || {};
    usd += Number(amounts.usd || 0);
    crc += Number(amounts.crc || 0);
  }
  return { count: (orders || []).length, usd, crc };
}

/**
 * One line per held-back order, for the warning block in the admin email.
 * Plain data only — the route escapes it on the way into the HTML.
 */
export function describeHeldBackOrders(orders = [], getAmounts) {
  const resolve = typeof getAmounts === 'function' ? getAmounts : () => ({ usd: 0, crc: 0 });
  return (orders || []).map((order) => {
    const amounts = resolve(order) || {};
    return {
      orderNumber: order?.order_number || order?.id || '',
      customerName: order?.customer_name || '',
      status: order?.status || '',
      paidAt: Number.isFinite(orderPaidEventMs(order))
        ? new Date(orderPaidEventMs(order)).toISOString()
        : null,
      // True when the order carries no payment event at all, so the date shown
      // is the day it was raised rather than the day the money landed.
      paymentNeverLogged: !Number.isFinite(orderPaidEventMs(order)),
      usd: Number(amounts.usd || 0),
      crc: Number(amounts.crc || 0),
    };
  });
}
