import { createHash } from 'node:crypto';
import { hashableEmail, conversionPhone } from './conversionIdentity.mjs';
import { hasConfirmedPayment, money } from './ecommerceAnalytics.mjs';
import { sanitizeAdAttribution } from './adClickAttribution.mjs';
export function costaRicaTimestamp(date) {
  const value = new Date(date); if (!Number.isFinite(value.getTime())) throw new Error('Missing payment confirmation time.');
  return new Date(value.getTime() - 6 * 3600000).toISOString().replace('Z', '-06:00');
}
export function offlineConversionEvent(order, paidAt) {
  const paymentMethod = String(order.payment_method).toLowerCase();
  if (!['whatsapp', 'card'].includes(paymentMethod) || !hasConfirmedPayment(order)) throw new Error('Order is not a confirmed Google Ads sale.');
  if (order.stats_override === 'exclude' || /\bTEST\b/i.test(`${order.internal_notes || ''} ${order.notes || ''}`)) throw new Error('Test or excluded order.');
  const click = sanitizeAdAttribution(order.ad_attribution);
  const email = hashableEmail(order.customer_email), phone = conversionPhone(order.customer_phone);
  const hash = value => createHash('sha256').update(value).digest('hex');
  const userIdentifiers = [...(email ? [{ emailAddress: hash(email) }] : []), ...(phone ? [{ phoneNumber: hash(phone) }] : [])];
  if (!click && !userIdentifiers.length) throw new Error('No eligible Google click identifier or customer match data.');
  if (click && new Date(paidAt).getTime() < click.clicked_at) throw new Error('Payment precedes the ad click.');
  const value = Number(order.total_usd) - Number(order.refunded_amount_usd || 0);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Missing confirmed USD amount.');
  // One click ID per sale. A link often carries gclid and gbraid together;
  // Google refuses a BRAID on a one-per-click action (e.g. "Converted lead"),
  // which dropped real sales. gclid matches every click, so it wins.
  const clickKey = ['gclid', 'gbraid', 'wbraid'].find(key => click?.[key]);
  const adIdentifiers = clickKey ? { [clickKey]: click[clickKey] } : {};
  return { transactionId: order.order_number, eventTimestamp: costaRicaTimestamp(paidAt), eventSource: 'WEB', eventName: 'purchase', additionalEventParameters: [{ parameterName: 'payment_type', value: paymentMethod }], currency: 'USD', conversionValue: money(value), ...(click ? { adIdentifiers } : {}), ...(userIdentifiers.length ? { userData: { userIdentifiers } } : {}) };
}
export function googleAdsActionId(env, paymentMethod = 'whatsapp') {
  return String(paymentMethod === 'card' ? env.GOOGLE_ADS_CARD_CONVERSION_ACTION_ID : env.GOOGLE_ADS_WHATSAPP_CONVERSION_ACTION_ID || '');
}
export function googleAdsDestination(env, paymentMethod = 'whatsapp') {
  const accountId = String(env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
  const actionId = googleAdsActionId(env, paymentMethod);
  if (!/^\d{10}$/.test(accountId) || !/^\d+$/.test(actionId)) throw new Error('Google Ads customer ID and WhatsApp conversion action ID must be configured.');
  const destination = { operatingAccount: { accountType: 'GOOGLE_ADS', accountId }, productDestinationId: actionId };
  if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) destination.loginAccount = { accountType: 'GOOGLE_ADS', accountId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '') };
  return destination;
}
export function googleRequestState(result) {
  const destinations = result.requestStatusPerDestination || [];
  if (!destinations.length || destinations.some(row => !row.requestStatus || ['PROCESSING','REQUEST_STATUS_UNKNOWN'].includes(row.requestStatus))) return 'submitted';
  if (destinations.every(row => row.requestStatus === 'SUCCESS')) return 'accepted';
  const reasons = destinations.flatMap(row => row.errorInfo?.errorCounts || []).map(row => row.reason);
  if (reasons.length && reasons.every(reason => /DUPLICATE_TRANSACTION_ID/.test(reason))) return 'accepted';
  return 'failed';
}
/** Google's own reasons for a rejected upload, e.g. "PROCESSING_ERROR_REASON_INVALID_GCLID x1". */
export function googleRequestErrors(result) {
  const reasons = (result?.requestStatusPerDestination || [])
    .flatMap(row => row.errorInfo?.errorCounts || [])
    .filter(row => row?.reason)
    .map(row => `${row.reason}${row.recordCount ? ` x${row.recordCount}` : ''}`);
  return [...new Set(reasons)].join(', ').slice(0, 500);
}
