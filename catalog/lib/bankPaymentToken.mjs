// Copied from the catalog (src/lib/bankPaymentToken.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
import { createHmac, timingSafeEqual } from 'node:crypto';
function signature(payload) {
  const secret = process.env.BANK_PAYMENT_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Bank payment token secret is missing');
  return createHmac('sha256', secret).update(`bac-payment:${payload}`).digest('base64url');
}
export function createBankPaymentToken(id, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ id, exp: now + 7 * 86400000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
export function verifyBankPaymentToken(token, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 1024) return null;
    const [payload, sig, extra] = token.split('.');
    if (!payload || !sig || extra) return null;
    const expected = Buffer.from(signature(payload));
    const supplied = Buffer.from(sig);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof claims.id === 'string' && Number.isFinite(claims.exp) && claims.exp > now ? claims : null;
  } catch { return null; }
}
