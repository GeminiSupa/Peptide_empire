// Copied from the catalog (src/lib/businessFirstOrderExtra.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
/**
 * A one-time extra commission on a business account's next order.
 *
 * Staff set it on the business ("Melissa, 10%"). The first order the business
 * places after that carries it automatically, through the same
 * additional_commission_* columns the Order Details box writes, so payouts,
 * refunds and the commission reports treat it exactly like one added by hand.
 * The sales rep on the account keeps their own agreed commission untouched.
 *
 * Deliberately free of `@/` imports so tests/ can load it under `node --test`.
 */

import { planAdditionalCommission } from './additionalCommission.mjs';
import { canOwnReturningCustomer } from './salesAgentAffiliate.mjs';

const text = (value) => String(value ?? '').trim();

/** Armed = a person and a percent are saved and no order has taken it yet. */
export function firstOrderExtraArmed(business) {
  const rate = Number(business?.first_order_extra_pct);
  return Boolean(
    text(business?.first_order_extra_user_id)
    && Number.isFinite(rate) && rate > 0 && rate <= 100
    && !business?.first_order_extra_used_at,
  );
}

/**
 * Turns what the admin form posted into the columns to write.
 *
 * Returns an empty patch when nothing changed, so an ordinary edit of the
 * business (new discount, new minimum) never re-arms a setting that has already
 * been used and never touches columns the database may not have yet. Choosing a
 * different person or percent arms it again.
 */
export function planFirstOrderExtraSetting({ body, previous, repUserId, profiles }) {
  if (!Object.hasOwn(body || {}, 'first_order_extra_user_id')) return { ok: true, patch: {} };
  const userId = text(body.first_order_extra_user_id);
  const before = text(previous?.first_order_extra_user_id);
  const rearmed = { first_order_extra_used_at: null, first_order_extra_order_number: null };

  if (!userId) {
    if (!before) return { ok: true, patch: {} };
    return { ok: true, patch: { first_order_extra_user_id: null, first_order_extra_pct: null, ...rearmed } };
  }

  const rate = Number(body.first_order_extra_pct);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
    return { ok: false, error: 'Extra commission must be greater than 0 and no more than 100%.' };
  }
  const recipient = (profiles || []).find((row) => row.user_id === userId);
  if (!canOwnReturningCustomer(recipient)) {
    return { ok: false, error: 'Choose an active team member for the one-time extra commission.' };
  }
  if (text(repUserId) === userId) {
    return { ok: false, error: 'The one-time extra must go to someone other than the assigned sales rep. Change the rep commission % to pay them more.' };
  }
  if (userId === before && rate === Number(previous?.first_order_extra_pct)) return { ok: true, patch: {} };
  return { ok: true, patch: { first_order_extra_user_id: userId, first_order_extra_pct: rate, ...rearmed } };
}

/**
 * What to stamp on a business order that is about to be saved, or why not.
 *
 * Re-checks the person with the same rules as the Order Details box, so a team
 * member who has since been suspended, or who became the account's rep, never
 * gets stamped. A refusal returns `skipped` and the order saves without it.
 */
export function planFirstOrderExtra({ business, order, profiles, now = new Date().toISOString() }) {
  if (!firstOrderExtraArmed(business)) return { apply: false };
  if (business.status !== 'approved') return { apply: false, skipped: 'The business account is not approved.' };
  const plan = planAdditionalCommission(
    order,
    {
      additional_commission_user_id: text(business.first_order_extra_user_id),
      additional_commission_pct: Number(business.first_order_extra_pct),
      additional_commission_reason: `First order for ${text(business.legal_name) || 'this business'}: one-time extra commission set on the business account`,
    },
    profiles,
    now,
  );
  if (!plan.ok) return { apply: false, skipped: plan.error };
  return {
    apply: true,
    patch: plan.patch,
    activity: { at: now, type: 'additional_commission_updated', by: 'system', message: plan.message },
  };
}
