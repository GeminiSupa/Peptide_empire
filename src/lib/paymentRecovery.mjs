import { buildCardPaymentPath, canSignCardPaymentLinks } from './cardPaymentLink.js';

export const PAYMENT_RECOVERY_REMINDER_HOURS = 2;

// Chargex never tells us when a card fails on its own page: no failure
// webhook, no failure return address, no status lookup (checked against
// docs.chargx.io, Nov 2026). So an order still waiting on Chargex this long
// after it was placed is treated as failed, and the customer is emailed the
// retry steps instead of hearing nothing until the two-hour reminder.
export const PAYMENT_RECOVERY_FOLLOW_UP_MINUTES = 15;

// Only orders still sitting on the Chargex hand-off. A plain decline already
// got its "payment declined" email the moment it happened.
export const PAYMENT_RECOVERY_FOLLOW_UP_STATUSES = ['Pending - Card 3DS', 'Pending - 3DS Card'];

/**
 * Which orders are due the 15-minute email: placed at least 15 minutes ago,
 * but not so long ago that the two-hour reminder already covers them. The
 * lower bound is what keeps weeks-old abandoned orders from being mailed the
 * day this ships.
 */
export function paymentRecoveryFollowUpWindow(nowMs = Date.now()) {
  return {
    placedAfter: new Date(nowMs - PAYMENT_RECOVERY_REMINDER_HOURS * 60 * 60 * 1000).toISOString(),
    placedBefore: new Date(nowMs - PAYMENT_RECOVERY_FOLLOW_UP_MINUTES * 60 * 1000).toISOString(),
  };
}

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
