// Copied from the catalog (src/lib/accountPreview.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
// Launch gate for the customer account area.
//
// The whole feature ships, but customers see "coming soon" until the screens
// are finished. A preview link opens the real pages before launch.
//
// This gate decides what to RENDER. It is not a security boundary and must
// never be treated as one — what a signed-in customer can actually read is
// decided by RLS on the database (orders_customer_read_own and friends).
// Someone who works out the preview parameter sees an unfinished feature, not
// anyone else's data.

/** localStorage key holding a granted preview, so the param is needed once. */
export const PREVIEW_STORAGE_KEY = 'account_preview_granted';

/** Query parameter that grants preview access, mirroring `?admin_preview=true`. */
export const PREVIEW_PARAM = 'account_preview';

/**
 * Has the feature been launched for everyone?
 *
 * Closed by default. An explicit launch flag opens the customer experience;
 * preview access remains available before launch.
 */
export function isAccountsLive(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

/**
 * Should this visitor see the real account area?
 *
 * True when the feature is live for everyone, or when this browser has been
 * granted preview access — either by carrying the parameter right now, or by
 * having carried it earlier in the session.
 */
export function resolveAccountAccess({ live, paramValue, stored } = {}) {
  if (live) return true;
  if (String(paramValue ?? '').trim().toLowerCase() === 'true') return true;
  return stored === true || String(stored ?? '') === 'true';
}
