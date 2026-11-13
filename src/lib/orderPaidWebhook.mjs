// One outbound webhook, fired the moment an order becomes paid.
//
// The owner runs paid ads to dedicated landing pages and wants an external
// system told when a sale settles, carrying the landing ref so the ad platform
// can be credited. Every path that settles an order — the gateway webhook, the
// direct card charge, a staff "mark as paid", and an order typed in already
// paid — calls this one helper, so the shape never drifts between them.
//
// It fires ONCE, only on the real unpaid -> paid transition. isFirstPaidTransition
// is the same test the paid-confirmation email uses, so re-saving an order that
// is already paid sends nothing. Two settle paths can never both fire for one
// order either: the first flips the row to paid, and the second then sees a
// paid previous status and stands down.
//
// It is best-effort by contract: with no ORDER_WEBHOOK_URL set it does nothing,
// and any failure (bad URL, timeout, non-2xx) is logged, never thrown — a down
// receiver must never break a payment confirmation.
//
// The payload shape below was approved by the owner on 2026-11-13. To change a
// field later, only buildOrderPaidWebhookPayload moves; the callers are untouched.

import { isFirstPaidTransition } from './orderStatusEmails.mjs';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * The JSON body POSTed to ORDER_WEBHOOK_URL when an order settles.
 *
 * @param {object} order a full orders row (status already 'Paid'/'Completed')
 * @returns {object}
 */
export function buildOrderPaidWebhookPayload(order) {
  const currency = String(order?.currency || '').toUpperCase() === 'USD' ? 'USD' : 'CRC';
  return {
    event: 'order.paid',
    status: order?.status ?? null,
    orderId: order?.id != null ? String(order.id) : null,
    orderNumber: order?.order_number ?? null,
    ref: order?.landing_ref ?? null,
    amount: {
      usd: Number(order?.total_usd ?? 0) || 0,
      crc: Number(order?.total_crc ?? 0) || 0,
      currency,
    },
    paidAt: new Date().toISOString(),
  };
}

/**
 * Fire the "order paid" webhook if, and only if, this is the transition into
 * paid. Returns a small result object for the caller's logs; never throws.
 *
 * @param {object} order the order row AFTER it was settled (status is paid-like)
 * @param {object} opts
 * @param {string|null|undefined} opts.previousStatus the status before this change
 * @param {string} [opts.logPrefix] log tag for the calling route
 */
export async function fireOrderPaidWebhook(order, { previousStatus, logPrefix = '[order-paid-webhook]' } = {}) {
  try {
    if (!isFirstPaidTransition(previousStatus, order?.status)) {
      return { fired: false, reason: 'not_paid_transition' };
    }

    const url = process.env.ORDER_WEBHOOK_URL;
    if (!url) return { fired: false, reason: 'not_configured' };

    const payload = buildOrderPaidWebhookPayload(order);
    const secret = process.env.ORDER_WEBHOOK_SECRET;
    const timeoutMs = Number(process.env.ORDER_WEBHOOK_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Webhook-Secret': secret } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.warn(`${logPrefix} target returned ${response.status} for ${payload.orderNumber || payload.orderId}`);
      return { fired: true, ok: false, status: response.status };
    }
    console.log(`${logPrefix} sent for ${payload.orderNumber || payload.orderId}`);
    return { fired: true, ok: true };
  } catch (error) {
    console.warn(`${logPrefix} failed: ${error?.message || String(error)}`);
    return { fired: false, error: true };
  }
}
