import { computeOrderTotals } from '../catalog-pricing/pricing.mjs';
import { buildBacAwareOrderItems } from '../catalog-pricing/bacWater.mjs';
import { catalogUrl } from './catalog-origin.mjs';
import { orderAttribution } from '../site/attribution.mjs';

/**
 * Submitting an order.
 *
 * This site does not price, save, email or deduct anything. It posts the
 * order to the catalog's `/api/orders/create` — the single door every public
 * order already goes through — which prices the cart from current product
 * rows, awards the best live offer, writes the row, raises the dashboard bell,
 * sends the customer confirmation and the staff alert, and mints the card
 * checkout token.
 *
 * Nothing in this file decides what anyone pays. It states a total so that
 * checkout can refuse it if the two disagree, which is the protection that
 * keeps the number on the button and the number on the invoice the same.
 */

/** Checkout accepts these two, and no others. */
export const PAYMENT_METHODS = ['card', 'whatsapp'];

/** Wording the customer agrees to; checkout stamps its own time against it. */
export const RESEARCH_ACK_VERSION = '2026-09-research-only';

/** Checkout strips this key before the insert. */
export const HONEYPOT_FIELD = 'pcr_hp';

/**
 * How the customer said they will pay, when it is not a card.
 *
 * Checkout stores one of two payment methods, so SINPE and cash on delivery
 * are both `whatsapp` orders — the same thing the catalog's own checkout
 * posts. Which of the two they chose is written into the order's notes, so
 * whoever packs the box can see it.
 */
export const OFF_CARD_METHODS = ['sinpe', 'cash'];

/**
 * A new order number.
 *
 * Must satisfy checkout's /^[A-Za-z0-9-]{6,64}$/. The `W` marks it as coming
 * from the website rather than the catalog, which also means it can never
 * collide with a number the catalog minted.
 */
export function newOrderNumber(now = Date.now(), random = Math.random) {
  const stamp = now.toString(36).toUpperCase();
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let tail = '';
  for (let i = 0; i < 4; i += 1) {
    tail += alphabet[Math.floor(random() * alphabet.length)];
  }
  return `W-${stamp}-${tail}`;
}

/**
 * A phone number as it should be stored: digits, with a leading `+` kept.
 *
 * Normalised here rather than trusted from the caller. A number typed
 * "8404 6973" is the same number, but stored with the space it does not match
 * the customer's other orders, so the CRM shows them as two people and the
 * WhatsApp alert goes to a number that needs cleaning by hand first.
 */
export function normalizePhone(value) {
  const raw = String(value ?? '').trim();
  const digits = raw.replace(/[^\d]/g, '');
  return raw.startsWith('+') ? `+${digits}` : digits;
}

/** The unit price of a cart line in the active currency. */
export function unitPrice(line, currency) {
  return currency === 'USD' ? Number(line.priceUsd || 0) : Number(line.priceCrc || 0);
}

/**
 * What the cart costs, by the catalog's own arithmetic.
 *
 * Returns the catalog's `computeOrderTotals` shape: subtotal, the volume
 * discount it earns, the BAC charge, shipping and the total.
 */
export function cartTotals(cart, currency, exchangeRate) {
  return computeOrderTotals(
    (cart || []).map((line) => ({
      product: line.product,
      qty: line.qty,
      unitPrice: unitPrice(line, currency),
    })),
    currency,
    exchangeRate,
  );
}

/**
 * The order lines as the customer, the database and the packing list should
 * see them — including the free BAC water the cart earns, which the catalog's
 * own module resolves into explicit lines.
 */
export function orderItems(cart, { currency, exchangeRate, lang }) {
  return buildBacAwareOrderItems(cart || [], {
    currency,
    exchangeRate,
    lang,
    priceOf: (line) => unitPrice(line, currency),
  });
}

/**
 * Build the payload checkout expects.
 *
 * `offCardMethod` is how a non-card customer intends to pay; it is recorded in
 * the notes rather than in `payment_method`, which checkout limits to two
 * values.
 */
export function buildOrderPayload({
  cart,
  customer,
  paymentMethod,
  offCardMethod = null,
  currency = 'CRC',
  exchangeRate,
  lang = 'en',
  orderNumber = newOrderNumber(),
  honeypot = '',
  quote = null,
}) {
  // With a quote (lib/site/quote.mjs, checkout's own pricing run with the
  // live deal), the stated total is the deal-inclusive one the shopper saw.
  // Without one, the volume-tier total.
  const totals = quote
    ? { total: quote.total, shipping: quote.shipping }
    : cartTotals(cart, currency, exchangeRate);
  const items = orderItems(cart, { currency, exchangeRate, lang });

  const shippingUsd = currency === 'USD'
    ? Number(totals.shipping.toFixed(2))
    : Number((totals.shipping / exchangeRate).toFixed(2));
  const shippingCrc = currency === 'CRC'
    ? Math.round(totals.shipping)
    : Math.round(totals.shipping * exchangeRate);

  const note = offCardMethod
    ? `Website order · intends to pay by ${offCardMethod === 'sinpe' ? 'SINPE Móvil' : 'cash on delivery'}`
    : 'Website order';

  return {
    order_number: orderNumber,
    customer_name: String(customer.name || '').trim().replace(/\s+/g, ' '),
    customer_phone: normalizePhone(customer.phone),
    customer_email: String(customer.email || '').trim() || null,
    shipping_address: String(customer.address || '').trim() || null,
    customer_id_type: customer.idType || null,
    customer_id_number: customer.idNumber || null,
    items,
    total_usd: currency === 'USD' ? totals.total : Math.round(totals.total / exchangeRate),
    total_crc: currency === 'CRC' ? Math.round(totals.total) : Math.round(totals.total * exchangeRate),
    shipping_cost_usd: shippingUsd,
    shipping_cost_crc: shippingCrc,
    currency,
    payment_method: paymentMethod,
    // Checkout derives the real opening status itself; this matches what the
    // catalog's own checkout posts.
    status: paymentMethod === 'card' ? 'Pending - Card' : 'Pending',
    lang,
    internal_notes: note,
    research_ack: { accepted: true, version: RESEARCH_ACK_VERSION },
    [HONEYPOT_FIELD]: honeypot,
    // Agent link, email campaign, Google Ads click and GA4 visit — the same
    // fields the catalog's checkout sends (lib/site/attribution.mjs).
    ...orderAttribution(),
  };
}

/**
 * Post one order.
 *
 * ── The reprice path ───────────────────────────────────────────────────────
 *
 * Checkout refuses an order whose posted total disagrees with the total it
 * computes, and colón totals are compared to the exact colón. The rate this
 * page rendered with can be an hour old, so a disagreement is ordinary rather
 * than exceptional — and the customer can do nothing about it. So a refusal
 * is handled here instead of being shown to her: the server's own total is
 * adopted and the order re-posted.
 *
 * She is interrupted only when the new total is HIGHER than the one she
 * agreed to. Nobody is charged more than the figure on the button without
 * being shown it first.
 *
 * @returns {Promise<object>} `{ ok: true, id, orderNumber, paymentToken }`,
 *   or `{ ok: false, error, errorCode }`, or
 *   `{ ok: false, errorCode: 'price_increased', pricing, exchangeRate }`.
 */
export async function submitOrder(payload, { repriceRetriesLeft = 1 } = {}) {
  let response;
  let data = {};

  try {
    response = await fetch(catalogUrl('/api/orders/create'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Checkout reads the order from `body.order`, as the catalog's own
      // checkout sends it. A bare order is refused as "Missing order payload".
      body: JSON.stringify({ order: payload }),
    });
    data = await response.json().catch(() => ({}));
  } catch (error) {
    return { ok: false, error: error.message || 'Network error', errorCode: 'network' };
  }

  if (response.ok && data.ok) {
    return {
      ok: true,
      id: data.id,
      orderNumber: data.orderNumber || payload.order_number,
      paymentToken: data.paymentToken || null,
    };
  }

  if (data.errorCode === 'price_changed' && data.pricing) {
    const shown = payload.currency === 'USD'
      ? Number(payload.total_usd || 0)
      : Number(payload.total_crc || 0);
    const server = payload.currency === 'USD'
      ? Number(data.pricing.totalUsd || 0)
      : Number(data.pricing.totalCrc || 0);

    // Same price or cheaper: she loses nothing, so finish the order she
    // already asked for rather than making her agree to a number she would
    // not even notice changing.
    if (repriceRetriesLeft > 0 && server <= shown) {
      return submitOrder(
        { ...payload, total_usd: data.pricing.totalUsd, total_crc: data.pricing.totalCrc },
        { repriceRetriesLeft: repriceRetriesLeft - 1 },
      );
    }

    return {
      ok: false,
      errorCode: 'price_increased',
      error: data.error,
      pricing: data.pricing,
      exchangeRate: data.exchangeRate,
    };
  }

  return {
    ok: false,
    error: data.error || response.statusText || 'Order could not be saved',
    errorCode: data.errorCode || null,
    status: response.status,
  };
}

/** Where a card customer continues, on the catalog's own secure page. */
export function cardPaymentUrl(orderNumber, paymentToken) {
  return catalogUrl(
    `/pay-card/${encodeURIComponent(orderNumber)}/${encodeURIComponent(paymentToken)}`,
  );
}
