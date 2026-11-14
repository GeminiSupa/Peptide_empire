// Copied from the catalog (src/app/api/givver/webhook/route.js) by scripts/sync-catalog-checkout.mjs. Do not edit.
/**
 * Givver's webhook address.
 *
 * It is the same handler as /api/chargx/webhook on purpose: both gateways send
 * the same event shape with the same signature scheme, and one handler means
 * one order update — a second copy of that logic is how an order gets paid,
 * stocked or emailed twice. This exists so Givver's dashboard can be given a
 * URL with its own name on it, and so either gateway can be pointed away
 * without touching the other.
 */
export { POST } from '../../chargx/webhook/route.js';

export const runtime = 'nodejs';
