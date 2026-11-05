import { buildCardPaymentPath, canSignCardPaymentLinks } from './cardPaymentLink.js';

export const PAYMENT_RECOVERY_REMINDER_HOURS = 2;

export function paymentRecoveryKind(status = '') {
  return String(status).toLowerCase().includes('3ds') ? '3ds' : 'declined';
}

export function buildPaymentRecoveryPath(orderNumber, status = 'Declined') {
  const params = new URLSearchParams({
    order: String(orderNumber || ''),
    reason: paymentRecoveryKind(status),
  });
  return `/payment-help?${params.toString()}`;
}

export function buildPaymentRetryPath(orderNumber) {
  return canSignCardPaymentLinks() && orderNumber ? buildCardPaymentPath(orderNumber) : null;
}

export function isPaymentRecoveryPending(status = '') {
  const normalized = String(status).trim().toLowerCase();
  return normalized === 'declined'
    || normalized === 'pending - card 3ds'
    || normalized === 'pending - 3ds card';
}
