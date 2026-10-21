/** Lowercase keys used to match order.sales_agent to a profile. */
// Defined in agentAttribution.mjs so the attribution unit tests can import it
// without pulling in the `@/` alias this file depends on. Re-exported here so
// existing callers keep working.
export { COMMISSION_ELIGIBLE_ORDER_STATUSES } from './agentAttribution.mjs';
import { COMMISSION_ELIGIBLE_ORDER_STATUSES } from './agentAttribution.mjs';

export function isCommissionEligibleOrder(order) {
  const status = String(order?.status || '').trim().toLowerCase();
  return COMMISSION_ELIGIBLE_ORDER_STATUSES.some(
    (eligibleStatus) => eligibleStatus.toLowerCase() === status
  );
}

export function agentMatchKeys(profile) {
  const keys = new Set();
  if (!profile) return keys;
  const name = String(profile.name || '').trim().toLowerCase();
  const email = String(profile.email || '').trim().toLowerCase();
  if (name) keys.add(name);
  if (email) {
    keys.add(email);
    const local = email.split('@')[0];
    if (local) keys.add(local);
  }
  return keys;
}

/** Order is credited to this agent (for pay / commission). */
export function orderBelongsToAgent(order, profile) {
  if (!order || !profile) return false;
  const orderAgent = String(order.sales_agent || '').trim().toLowerCase();
  if (!orderAgent) return false;
  return agentMatchKeys(profile).has(orderAgent);
}

/** Orders tab: shared order ledger for all admin staff. */
export function filterOrdersVisibleToAgent(orders) {
  return orders || [];
}

/** Strict filter — only orders assigned to this agent (My Pay, earnings). */
export function filterOrdersForAgent(orders, profile) {
  if (!profile || profile.is_superadmin) return orders || [];
  return (orders || []).filter((o) => orderBelongsToAgent(o, profile));
}

export { getOrderSalesAmounts } from './commissionSalesAmounts.mjs';

export function orderVisibleToAgent() {
  return true;
}
