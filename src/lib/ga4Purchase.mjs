import { hasConfirmedPayment, money, receiptEvent } from './ecommerceAnalytics.mjs';
import { sanitizeGaIdentity } from './gaIdentity.mjs';

// A paid WhatsApp order is confirmed by staff after the shopper has left, so the
// browser can never send its `purchase`. This sends it to GA4 from the server
// (Measurement Protocol) once the order is confirmed paid: event `purchase`,
// payment_type "whatsapp". The browser keeps sending `whatsapp_order` at checkout.
export const GA4_COLLECT_URL = 'https://www.google-analytics.com/mp/collect';
export const GA4_DEBUG_URL = 'https://www.google-analytics.com/debug/mp/collect';
// GA4 refuses events more than 72 hours old; stay inside that with margin.
export const GA4_MAX_AGE_MS = 70 * 3600000;
const MAX_ATTEMPTS = 5;

export function ga4Config(env) {
  const measurementId = String(env.GA4_MEASUREMENT_ID || '').trim();
  const apiSecret = String(env.GA4_API_SECRET || '').trim();
  const missing = [];
  if (!/^G-[A-Z0-9]{6,14}$/.test(measurementId)) missing.push('GA4_MEASUREMENT_ID');
  if (!apiSecret) missing.push('GA4_API_SECRET');
  return { missing, measurementId, apiSecret };
}

export function ga4PurchaseEvent(order, paidAt, { now = Date.now(), skipAgeCheck = false } = {}) {
  if (String(order.payment_method).toLowerCase() !== 'whatsapp' || !hasConfirmedPayment(order)) throw new Error('Order is not a confirmed WhatsApp sale.');
  if (order.stats_override === 'exclude' || /\bTEST\b/i.test(`${order.internal_notes || ''} ${order.notes || ''}`)) throw new Error('Test or excluded order.');
  const paidMs = Date.parse(paidAt);
  if (!Number.isFinite(paidMs)) throw new Error('Missing payment confirmation time.');
  if (!skipAgeCheck && now - paidMs > GA4_MAX_AGE_MS) throw new Error('Payment is too old for GA4 to accept.');
  // The same snapshot the card purchase uses, so both read alike in GA4.
  const ecommerce = receiptEvent(order)?.ecommerce;
  if (!ecommerce?.items?.length || !(Number(ecommerce.value) > 0)) throw new Error('Missing confirmed USD amount.');
  const identity = sanitizeGaIdentity(order);
  const params = {
    transaction_id: String(order.order_number),
    currency: 'USD',
    value: money(ecommerce.value),
    ...(ecommerce.shipping ? { shipping: money(ecommerce.shipping) } : {}),
    ...(ecommerce.coupon ? { coupon: String(ecommerce.coupon) } : {}),
    payment_type: 'whatsapp',
    ...(identity.ga_session_id ? { session_id: Number(identity.ga_session_id) } : {}),
    engagement_time_msec: 1,
    // GA4 wants the discounted unit price in `price`, with the discount alongside.
    items: ecommerce.items.map(item => ({
      item_id: item.item_id, item_name: item.item_name,
      ...(item.item_variant ? { item_variant: item.item_variant } : {}),
      ...(item.item_category ? { item_category: item.item_category } : {}),
      price: money(Number(item.price) - Number(item.discount || 0)), quantity: item.quantity, discount: money(item.discount || 0),
    })),
  };
  return {
    attributed: Boolean(identity.ga_client_id),
    // No browser ID (a CRM/manual order) still counts as revenue, as a new visitor.
    body: { client_id: identity.ga_client_id || `pcr-offline-${order.order_number}`, timestamp_micros: paidMs * 1000, events: [{ name: 'purchase', params }] },
  };
}

// The API secret travels in the URL, so nothing here may log or return the URL or a raw error.
export async function sendGa4Event(event, config, { fetcher = fetch, debug = false } = {}) {
  const url = `${debug ? GA4_DEBUG_URL : GA4_COLLECT_URL}?measurement_id=${encodeURIComponent(config.measurementId)}&api_secret=${encodeURIComponent(config.apiSecret)}`;
  let response;
  try { response = await fetcher(url, { method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event.body) }); }
  catch { throw new Error('GA4 request failed before a response was received.'); }
  if (!response.ok) throw new Error(`GA4 answered HTTP ${response.status}.`);
  return debug ? await response.json() : { status: response.status };
}

export async function runGa4PurchaseExport(admin, config, { fetcher = fetch, now = Date.now(), limit = 100 } = {}) {
  const summary = { sent: 0, skipped: 0, failed: 0 };
  const since = new Date(now - GA4_MAX_AGE_MS).toISOString();
  // ads_paid_at is stamped once, when an order first becomes paid (add-google-ads-conversions.sql).
  const orders = await admin.from('orders').select('*').eq('payment_method', 'whatsapp').gte('ads_paid_at', since).order('ads_paid_at').limit(limit);
  if (orders.error) throw new Error('Could not read paid WhatsApp orders. Run add-google-ads-conversions.sql first.');
  const rows = orders.data || [];
  if (!rows.length) return summary;
  const done = await admin.from('ga4_purchase_exports').select('order_id,status,attempts').in('order_id', rows.map(row => row.id));
  if (done.error) throw new Error('Run add-ga4-whatsapp-purchases.sql before enabling the GA4 import.');
  const state = new Map((done.data || []).map(row => [row.order_id, row]));
  for (const order of rows) {
    const known = state.get(order.id);
    if (known && (known.status !== 'failed' || known.attempts >= MAX_ATTEMPTS)) continue;
    const attempts = (known?.attempts || 0) + 1;
    async function save(values) {
      const result = await admin.from('ga4_purchase_exports').upsert({ order_id: order.id, attempts, ...values }, { onConflict: 'order_id' });
      if (result.error) throw new Error('Could not persist GA4 upload state.');
    }
    let event;
    try { event = ga4PurchaseEvent(order, order.ads_paid_at, { now }); }
    catch (error) { await save({ status: 'skipped', last_error: error.message }); summary.skipped++; continue; }
    try {
      await sendGa4Event(event, config, { fetcher });
      await save({ status: 'sent', sent_at: new Date(now).toISOString(), client_id_source: event.attributed ? 'browser' : 'synthetic', last_error: null });
      summary.sent++;
    } catch (error) { await save({ status: 'failed', last_error: error.message }); summary.failed++; }
  }
  return summary;
}
