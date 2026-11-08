// Copied from the catalog (src/lib/ecommerceAnalytics.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
import { isBacWater, bacUnitPrice, getBacWaterSizeMl } from './bacWater.mjs';
import { conversionEmail, conversionPhone } from './conversionIdentity.mjs';
import { catalogCompoundAndSize } from './catalogCategories.mjs';
import { hasNothingToPay } from './freeOrder.mjs';
export const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export function numericPrice(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.max(0, n) : 0; }
const slug = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function analyticsItem(product, { rate = 502, currency = 'USD' } = {}) {
  const name = String(product.product || product.name || '');
  const { compound, size: parsedSize } = catalogCompoundAndSize({ ...product, product: name.replace(/\s*\((?:free|gratis|gift|regalo).*$/i, '') });
  const waterSize = isBacWater(name) ? getBacWaterSizeMl(name) : null;
  const size = waterSize ? `${waterSize}ml` : parsedSize;
  const displayName = isBacWater(name) ? 'BAC Water' : compound;
  const usd = product.priceUsd ?? product.price_usd;
  const crc = product.priceCrc ?? product.price_crc;
  const price = product.analytics_gift ? 0 : isBacWater(name) && usd != null ? bacUnitPrice('USD', rate, numericPrice(usd), name) : usd != null ? numericPrice(usd) : crc != null ? numericPrice(crc) / rate : numericPrice(product.price) / (currency === 'CRC' ? rate : 1);
  return { item_id: slug(`${displayName}-${String(size).replace(/\s/g, '')}`), item_name: displayName, item_variant: String(size).replace(/(\d)\s*(mg|ml|mcg|iu)\b/gi, '$1 $2'), item_category: product.category || product.item_category || '', price: money(price), quantity: Math.max(1, Number(product.qty || product.quantity) || 1), discount: money(product.analytics_discount || 0) };
}
export function ecommerceData(products, { rate = 502, currency = 'USD', value, shipping = 0, discountPct } = {}) {
  const items = (products || []).map(product => analyticsItem(product, { rate, currency }));
  if (discountPct != null) for (const item of items) item.discount = isBacWater(item.item_name) ? 0 : money(item.price * Math.min(100, Math.max(0, discountPct)) / 100);
  const listTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const net = value == null ? items.reduce((sum, item) => sum + (item.price - (discountPct != null && !isBacWater(item.item_name) ? item.price * Math.min(100, Math.max(0, discountPct)) / 100 : item.discount)) * item.quantity, 0) : Math.max(0, Number(value));
  if (value != null && discountPct == null && !products.some(product => product.analytics_discount != null) && listTotal > 0) for (const item of items) item.discount = money(item.price * Math.max(0, 1 - net / listTotal));
  return { currency: 'USD', value: money(net), ...(shipping ? { shipping: money(shipping) } : {}), items };
}
// view_item_list is one event per list the shopper is shown, named for the list
// (not the plugin default "General Product List"). GA4 keeps 200 items per event.
export const HOME_BEST_SELLERS_LIST = 'Home - Best sellers';
export const SHOP_LIST = 'Shop';
export const DEAL_LIST = 'Deal of the Week';
export const MAX_LIST_ITEMS = 200;
export function catalogListName({ category = 'all', dealOnly = false } = {}) {
  if (dealOnly) return DEAL_LIST;
  const name = String(category || '').trim();
  return name && name !== 'all' ? name : SHOP_LIST;
}
export function listViewData(products, listName, { rate = 502, currency = 'USD' } = {}) {
  const item_list_id = slug(listName);
  const items = (products || []).slice(0, MAX_LIST_ITEMS).map((product, index) => {
    const item = analyticsItem(product, { rate, currency });
    delete item.quantity; delete item.discount;
    return { ...item, index: index + 1, item_list_id, item_list_name: listName };
  });
  return { item_list_id, item_list_name: listName, items };
}
export function orderEcommerceSnapshot(order, pricing, rate) {
  const rows = (pricing.items || order.items || []).map(line => {
    const product = (pricing.products || []).find(row => row.product === line.product);
    const row = { ...product, ...line, ...(Number(line.price) === 0 ? { priceUsd: 0, analytics_gift: true } : {}), category: product?.category || line.category || '' };
    const list = analyticsItem(row, { rate, currency: order.currency }).price;
    const chargedUnit = numericPrice(line.price) / (order.currency === 'CRC' ? rate : 1);
    const pct = isBacWater(line.product) ? 0 : Number(pricing.volumeDiscountPct ?? order.volume_discount_pct ?? 0);
    row.analytics_discount = Math.max(0, list - chargedUnit * (1 - pct / 100));
    return row;
  });
  const shipping = Number(order.shipping_cost_usd || 0);
  return { ...ecommerceData(rows, { rate, currency: order.currency, value: Math.max(0, Number(order.total_usd) - shipping), shipping }), shipping: money(shipping), transaction_id: order.order_number, coupon: pricing.promoApplied ? String(order.promo_code || '') : '' };
}
export function confirmedPaid(status) { return ['paid', 'order complete', 'completed', 'complete', 'shipped', 'delivered'].includes(String(status || '').trim().toLowerCase()); }
export function hasConfirmedPayment(order) {
  if (/pending|cancel|refund|declin|fail|unpaid/i.test(String(order.status || ''))) return false;
  return confirmedPaid(order.status) || Boolean(order.ads_paid_at && Number.isFinite(Date.parse(order.ads_paid_at)));
}
export function receiptEvent(order) {
  if (!order?.order_number || !Array.isArray(order.items) || !order.items.length) return null;
  const total = Number(order.total_usd);
  if (!Number.isFinite(total) || total < 0) return null;
  const snapshot = order.analytics_snapshot;
  const sameValue = snapshot && Math.abs(Number(snapshot.value) + Number(snapshot.shipping || 0) - total) < .02;
  const rate = total > 0 && Number(order.total_crc) > 0 ? Number(order.total_crc) / total : 502;
  const ecommerce = sameValue ? snapshot : orderEcommerceSnapshot(order, { items: order.items }, rate);
  const method = String(order.payment_method || '').toLowerCase();
  if (!['card','whatsapp'].includes(method)) return null;
  if (method === 'card' && !hasConfirmedPayment(order)) return null;
  const email = conversionEmail(order.customer_email), phone = conversionPhone(order.customer_phone);
  return { event: method === 'card' ? 'purchase' : 'whatsapp_order', payment_type: method, ecommerce, user_data: { ...(email ? { email } : {}), ...(phone ? { phone } : {}) } };
}
// Nothing owed, so nothing left to pay: a 100%-off order has no payment to wait for.
export const isFreeOrder = hasNothingToPay;
// What the thank-you page pushes. A WhatsApp order with a real total is only a
// `whatsapp_order` here: its `purchase` is sent once staff confirm payment (GA4
// server send, Google Ads import), so unpaid orders never count as sales. A $0
// WhatsApp order has nothing to pay, so it is also a `purchase` straight away.
// Card stays a single `purchase`, and only once payment is confirmed.
export function receiptEvents(order) {
  const event = receiptEvent(order);
  if (!event) return [];
  return event.event === 'whatsapp_order' && isFreeOrder(order) ? [event, { ...event, event: 'purchase' }] : [event];
}
