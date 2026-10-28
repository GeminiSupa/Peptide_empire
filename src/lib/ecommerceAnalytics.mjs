import { conversionEmail, conversionPhone } from './conversionIdentity.mjs';
import { catalogCompoundAndSize } from './catalogCategories.mjs';
export const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export function numericPrice(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.max(0, n) : 0; }
const slug = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function analyticsItem(product, { rate = 502, currency = 'USD' } = {}) {
  const name = String(product.product || product.name || '');
  const { compound, size } = catalogCompoundAndSize({ ...product, product: name.replace(/\s*\((?:free|gratis|gift|regalo).*$/i, '') });
  const displayName = compound;
  const usd = product.priceUsd ?? product.price_usd;
  const crc = product.priceCrc ?? product.price_crc;
  const price = usd != null ? numericPrice(usd) : crc != null ? numericPrice(crc) / rate : numericPrice(product.price) / (currency === 'CRC' ? rate : 1);
  return { item_id: slug(`${displayName}-${String(size).replace(/\s/g, '')}`), item_name: displayName, item_variant: String(size).replace(/(\d)\s*(mg|ml|mcg|iu)\b/gi, '$1 $2'), item_category: product.category || product.item_category || '', price: money(price), quantity: Math.max(1, Number(product.qty || product.quantity) || 1), discount: 0 };
}
export function ecommerceData(products, { rate = 502, currency = 'USD', value, shipping = 0, discountPct = 0 } = {}) {
  const items = (products || []).map(product => analyticsItem(product, { rate, currency }));
  for (const item of items) item.discount = money(item.price * Math.min(100, Math.max(0, discountPct)) / 100);
  const listTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const net = value == null ? listTotal * (1 - Math.min(100, Math.max(0, discountPct)) / 100) : Math.max(0, Number(value));
  if (value != null && listTotal > 0) for (const item of items) item.discount = money(item.price * Math.max(0, 1 - net / listTotal));
  return { currency: 'USD', value: money(net), ...(shipping ? { shipping: money(shipping) } : {}), items };
}
export function orderEcommerceSnapshot(order, pricing, rate) {
  const rows = (pricing.items || order.items || []).map(line => {
    const product = (pricing.products || []).find(row => row.product === line.product);
    return { ...product, ...line, ...(Number(line.price) === 0 ? { priceUsd: 0 } : {}), category: product?.category || line.category || '' };
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
