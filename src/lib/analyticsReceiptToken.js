import crypto from 'node:crypto';
const secret = () => process.env.ANALYTICS_RECEIPT_SECRET || process.env.CARD_PAYMENT_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
export function createAnalyticsReceiptToken(orderNumber, orderId, now = Date.now()) {
  if (!secret()) return null;
  const payload = Buffer.from(JSON.stringify({ orderNumber, orderId, exp: now + 7 * 86400000 })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', secret()).update(payload).digest('base64url')}`;
}
export function verifyAnalyticsReceiptToken(token, now = Date.now()) {
  try {
    if (!secret() || typeof token !== 'string' || token.length > 1200) return null;
    const [payload, signature, extra] = token.split('.'); if (!payload || !signature || extra) return null;
    const expected = crypto.createHmac('sha256', secret()).update(payload).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > now && data.orderId && data.orderNumber ? data : null;
  } catch { return null; }
}
