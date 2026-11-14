// The outbound order webhooks: one when an order becomes paid, and one when a
// paid order is later cancelled or refunded.
//
// The owner runs paid ads to dedicated landing pages and wants an external
// system told when a sale settles, carrying the landing ref and the click ids
// so the ad platform can be credited. Every path that settles an order — the
// gateway webhook, the direct card charge, a staff "mark as paid", and an order
// typed in already paid — calls this one helper, so the shape never drifts
// between them.
//
// order.paid fires ONCE, only on the real unpaid -> paid transition.
// isFirstPaidTransition is the same test the paid-confirmation email uses, so
// re-saving an order that is already paid sends nothing. Two settle paths can
// never both fire for one order either: the first flips the row to paid, and
// the second then sees a paid previous status and stands down.
//
// order.cancelled / order.refunded fire only when the order was paid-like
// before the change — i.e. only for sales the receiver was already told about,
// so it can take them out of revenue. Cancelling an order that never paid
// sends nothing, because nothing was ever counted.
//
// Only orders that came through a paid ad are sent (see isPaidAdOrder): the
// receiver matches sales to ad clicks, so an organic or WhatsApp sale carries
// nothing for it to match on. ORDER_WEBHOOK_ALL_ORDERS=true sends every one.
//
// It is best-effort by contract: with no ORDER_WEBHOOK_URL set it does nothing,
// and any failure (bad URL, timeout, non-2xx) is logged, never thrown — a down
// receiver must never break a payment confirmation. A network error or a 5xx is
// retried a couple of times; a 4xx is not, because a rejected body will be
// rejected again, and the refusal is logged with the receiver's own words so we
// can see which field it objected to.
//
// The payload shape was agreed with the media buyer on 2026-11-14:
// a plain `amount` + `currency`, the product slug, and ref / cid / ttclid.
// To change a field later, only buildOrderWebhookPayload moves; the callers are
// untouched.

import crypto from 'node:crypto';

import { isFirstPaidTransition, isPaidLike } from './orderStatusEmails.mjs';
import { isGiftLine } from './bacWater.mjs';

const DEFAULT_TIMEOUT_MS = 5000;

/** Tries in total (first attempt + retries) for a network error or a 5xx. */
const MAX_ATTEMPTS = 3;

/** Backoff before the 2nd and 3rd attempt. Short: this runs inside a payment
 *  confirmation request, which must not be held up. */
const RETRY_DELAY_MS = [400, 1200];

/**
 * Whether this order came through a paid ad, and so is the receiver's business.
 *
 * The receiver exists to match sales to ad clicks; an organic or WhatsApp sale
 * carries nothing for it to match on and would only be rejected, so it is not
 * sent at all (owner's call, 15 Nov 2026). Any one of the three tags is enough:
 * the ref names the landing page, and either click id names the click.
 *
 * Set ORDER_WEBHOOK_ALL_ORDERS=true to send every paid order instead.
 */
export function isPaidAdOrder(order) {
  return Boolean(order?.landing_ref || order?.landing_cid || order?.landing_ttclid);
}

function shouldSendOrder(order) {
  if (String(process.env.ORDER_WEBHOOK_ALL_ORDERS || '').toLowerCase() === 'true') return true;
  return isPaidAdOrder(order);
}

export const ORDER_WEBHOOK_EVENT_PAID = 'order.paid';
export const ORDER_WEBHOOK_EVENT_CANCELLED = 'order.cancelled';
export const ORDER_WEBHOOK_EVENT_REFUNDED = 'order.refunded';

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * A stable, URL-safe id for a product line.
 *
 * The receiver wants to know which product sold, as a slug ("bpc-157-10mg").
 * Our products have no slug or SKU column — `items[].product` is the display
 * name, in Spanish, accents and all — so the slug is derived from that name:
 * accents stripped, lowercased, anything that is not a letter or digit turned
 * into a single hyphen. "GLP-1 (RT) – Agonista Triple 15mg" becomes
 * "glp-1-rt-agonista-triple-15mg". It is stable as long as the product is not
 * renamed, and the raw name travels alongside it so the other side can map it.
 */
export function productSlug(name) {
  const text = String(name ?? '').trim();
  if (!text) return null;
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || null;
}

/**
 * The product lines of an order, as the webhook reports them.
 *
 * Free gift lines (the BAC water that rides along with a GLP order) are kept
 * out: they are not what was bought, and leaving them in would make the main
 * product ambiguous.
 */
function webhookProducts(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items
    .filter((item) => !isGiftLine(item))
    .map((item) => ({
      product: productSlug(item?.product ?? item?.name),
      name: String(item?.product ?? item?.name ?? '') || null,
      qty: num(item?.qty),
      price: num(item?.price),
    }))
    .filter((line) => line.product);
}

/**
 * The JSON body POSTed to ORDER_WEBHOOK_URL.
 *
 * `amount` is a plain number in `currency` — the figure actually charged, in
 * colones for a CRC order — with both currencies also given separately so the
 * other side can reconcile without converting. `product` is the single biggest
 * line, which is what an ad platform wants when it can only hold one SKU per
 * conversion; `products` carries every line for anything that can hold more.
 *
 * @param {object} order a full orders row, after the status change
 * @param {object} [opts]
 * @param {string} [opts.event] one of the ORDER_WEBHOOK_EVENT_* values
 * @returns {object}
 */
export function buildOrderWebhookPayload(order, { event = ORDER_WEBHOOK_EVENT_PAID } = {}) {
  const currency = String(order?.currency || '').toUpperCase() === 'USD' ? 'USD' : 'CRC';
  const amountUsd = num(order?.total_usd);
  const amountCrc = num(order?.total_crc);
  const products = webhookProducts(order);
  // The biggest line by what it actually brought in, so a 5-vial order is not
  // reported as the cheap add-on that happened to be listed first.
  const main = products.reduce(
    (best, line) => (!best || line.price * line.qty > best.price * best.qty ? line : best),
    null,
  );
  const occurredAt = new Date().toISOString();

  const payload = {
    event,
    status: order?.status ?? null,
    orderId: order?.id != null ? String(order.id) : null,
    orderNumber: order?.order_number ?? null,
    // Which landing page won the click, and the click ids that tie the sale to
    // one ad click. Null on an organic order.
    ref: order?.landing_ref ?? null,
    cid: order?.landing_cid ?? null,
    ttclid: order?.landing_ttclid ?? null,
    product: main?.product ?? null,
    productName: main?.name ?? null,
    products,
    amount: currency === 'USD' ? amountUsd : amountCrc,
    currency,
    amountUsd,
    amountCrc,
    occurredAt,
  };

  if (event === ORDER_WEBHOOK_EVENT_PAID) {
    // Kept under its agreed name as well, so the receiver's existing mapping of
    // the paid event does not have to change.
    payload.paidAt = occurredAt;
  } else {
    const refundedUsd = num(order?.refunded_amount_usd);
    const refundedCrc = num(order?.refunded_amount_crc);
    if (refundedUsd || refundedCrc) {
      payload.refundedAmount = currency === 'USD' ? refundedUsd : refundedCrc;
      payload.refundedAmountUsd = refundedUsd;
      payload.refundedAmountCrc = refundedCrc;
    }
  }

  return payload;
}

/**
 * Back-compatible name for the paid payload. Callers and tests that only ever
 * wanted the paid event keep working.
 */
export function buildOrderPaidWebhookPayload(order) {
  return buildOrderWebhookPayload(order, { event: ORDER_WEBHOOK_EVENT_PAID });
}

/**
 * POST the payload, with retries for the failures a retry can fix.
 *
 * Signed two ways because receivers differ: the shared secret as a plain
 * header, and an HMAC-SHA256 hex digest of the exact bytes sent, under
 * ORDER_WEBHOOK_SIGNATURE_HEADER (default X-Webhook-Signature). Both come from
 * ORDER_WEBHOOK_SECRET; with no secret set, neither header is sent.
 */
async function postWebhook(url, payload, logPrefix) {
  const body = JSON.stringify(payload);
  const secret = process.env.ORDER_WEBHOOK_SECRET;
  const signatureHeader = process.env.ORDER_WEBHOOK_SIGNATURE_HEADER || 'X-Webhook-Signature';
  const timeoutMs = Number(process.env.ORDER_WEBHOOK_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const headers = { 'Content-Type': 'application/json' };
  if (secret) {
    headers['X-Webhook-Secret'] = secret;
    headers[signatureHeader] = crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  const label = payload.orderNumber || payload.orderId;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) {
        console.log(`${logPrefix} ${payload.event} sent for ${label}`);
        return { fired: true, ok: true, status: response.status, attempts: attempt };
      }

      // A 4xx means the receiver read the body and refused it (it answers 422
      // when a click id is missing, for instance). Retrying sends the same
      // bytes to the same verdict, so log its own words and stop.
      if (response.status < 500 && response.status !== 429) {
        let detail = '';
        try { detail = (await response.text()).slice(0, 200); } catch { /* body is optional */ }
        console.warn(`${logPrefix} ${payload.event} REFUSED ${response.status} for ${label}${detail ? `: ${detail}` : ''}`);
        return { fired: true, ok: false, status: response.status, refused: true, attempts: attempt };
      }

      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => { setTimeout(resolve, RETRY_DELAY_MS[attempt - 1] ?? 1200); });
    }
  }

  console.warn(`${logPrefix} ${payload.event} failed for ${label} after ${MAX_ATTEMPTS} tries: ${lastError}`);
  return { fired: true, ok: false, attempts: MAX_ATTEMPTS, error: true, reason: lastError };
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
    if (!shouldSendOrder(order)) {
      return { fired: false, reason: 'not_an_ad_order' };
    }

    const url = process.env.ORDER_WEBHOOK_URL;
    if (!url) return { fired: false, reason: 'not_configured' };

    return await postWebhook(url, buildOrderPaidWebhookPayload(order), logPrefix);
  } catch (error) {
    console.warn(`${logPrefix} failed: ${error?.message || String(error)}`);
    return { fired: false, error: true };
  }
}

/**
 * Fire "order cancelled" / "order refunded" for a sale the receiver has already
 * been told about, so it can drop it out of revenue. Never throws.
 *
 * Only a previously paid-like order qualifies: if it never paid, no order.paid
 * was ever sent and there is nothing to take back.
 *
 * @param {object} order the order row AFTER the change
 * @param {object} opts
 * @param {string} opts.event ORDER_WEBHOOK_EVENT_CANCELLED or _REFUNDED
 * @param {string|null|undefined} opts.previousStatus the status before this change
 * @param {string} [opts.logPrefix] log tag for the calling route
 */
export async function fireOrderClosedWebhook(order, { event, previousStatus, logPrefix = '[order-closed-webhook]' } = {}) {
  try {
    if (event !== ORDER_WEBHOOK_EVENT_CANCELLED && event !== ORDER_WEBHOOK_EVENT_REFUNDED) {
      return { fired: false, reason: 'unknown_event' };
    }
    if (!isPaidLike(previousStatus)) {
      return { fired: false, reason: 'was_never_paid' };
    }
    // Same gate as the paid event, so the receiver is never told to take back
    // a sale it was never told about.
    if (!shouldSendOrder(order)) {
      return { fired: false, reason: 'not_an_ad_order' };
    }

    const url = process.env.ORDER_WEBHOOK_URL;
    if (!url) return { fired: false, reason: 'not_configured' };

    return await postWebhook(url, buildOrderWebhookPayload(order, { event }), logPrefix);
  } catch (error) {
    console.warn(`${logPrefix} failed: ${error?.message || String(error)}`);
    return { fired: false, error: true };
  }
}
