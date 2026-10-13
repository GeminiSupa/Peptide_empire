/**
 * Money the weekly commission scan cannot see yet.
 *
 * The scan counts an order once it reaches COMMISSION_ELIGIBLE_ORDER_STATUSES.
 * 'Processing' is not one of them, and deliberately so: it is money received
 * with the parcel not yet sent, which is a sale in progress rather than a
 * closed one. The problem is the clock. The scan runs Monday 08:00 Costa Rica,
 * and the team closes out the weekend's parcels later that morning. On
 * 12 Oct 2026 that gap cost one agent eight orders — ₡818,841 — which simply
 * dropped out of her week with nothing anywhere saying so.
 *
 * This module does not change what anybody is paid. It finds the orders that
 * were paid inside the reporting period but had not been closed by the time the
 * scan ran, so the report can say "this money exists and is not counted here"
 * instead of quietly understating a week.
 *
 * Why only 'Processing', and not every status outside the eligible list:
 *
 *   Pending → Payment Pending / Pending - Card / Pending - Card 3DS → Paid
 *          → Processing → Order Complete
 *
 * 'Processing' is the one status that sits after payment and before the scan can
 * count it. Everything else outside the eligible list is either money that never
 * arrived (Pending, Declined, Error, Payment Blocked) or a deliberate reversal —
 * production holds several orders that were marked Paid and then moved back to
 * Pending minutes later, which is somebody correcting a mistake, not fulfilment
 * running late. Alerting on those would put permanent noise in the report and
 * train people to ignore it.
 */

/** Statuses that mean: the customer has paid, and the scan still cannot count it. */
export const HELD_BACK_ORDER_STATUSES = ['Processing'];

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
      && /\b(paid|completed|order complete|partly refunded)\b/i.test(String(entry?.message || ''))
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
 * The payment event when the log has one. Otherwise created_at — and only
 * because the caller has already established the status is 'Processing', which
 * this system treats as money received. Production holds eleven such orders
 * from June to August 2026 that were moved straight from Pending to Processing
 * with no payment event ever written; between them they are over a million
 * colones that no commission report has ever counted. Dating those by the log
 * alone would make this warning blind to the very case it exists to catch.
 *
 * This fallback is safe here and would not be in the scan itself: it is reached
 * only for a status that already means paid, never for a Pending order that
 * merely happens to have been created inside the period.
 */
export function heldBackSinceMs(order) {
  const paidAt = orderPaidEventMs(order);
  if (Number.isFinite(paidAt)) return paidAt;
  const createdAt = order?.created_at ? new Date(order.created_at).getTime() : Number.NaN;
  return Number.isFinite(createdAt) ? createdAt : Number.NaN;
}

/**
 * Orders paid inside [startMs, endMs] that the scan will leave out.
 *
 * Dated by the payment event for the same reason the scan dates its own orders
 * that way: an order taken on Saturday and paid on Sunday belongs to the week it
 * was paid in, whatever day it was created.
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
