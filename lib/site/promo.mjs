/**
 * Promo and affiliate codes on the site.
 *
 * The catalog owns every code: `/api/promo/validate` (reached through this
 * site's relay) says whether one is good, and `/api/orders/create` checks it
 * again and prices the order with it. This file only remembers the code the
 * shopper entered and reads one off an affiliate link. The discount itself is
 * worked out by the catalog's own `authoritativeCheckout` (lib/site/quote.mjs).
 */

const STORAGE_KEY = 'pcr_store_promo';

/** The URL parameters an affiliate or QR link may carry a code in — the catalog's. */
const URL_PARAMS = ['promo_code', 'promo', 'coupon', 'discount'];

export function promoFromUrl(search = '') {
  const params = new URLSearchParams(search);
  for (const name of URL_PARAMS) {
    const value = String(params.get(name) || '').trim();
    if (value) return value.slice(0, 60);
  }
  return '';
}

/** The fields checkout's pricing and the order need, from the catalog's answer. */
export function promoFromReply(reply) {
  if (!reply?.code) return null;
  return {
    code: String(reply.code).toUpperCase(),
    discount_pct: Number(reply.discount_pct) || 0,
    min_units: Number(reply.min_units) || 0,
    max_units: reply.max_units ?? null,
    target_product: reply.target_product || null,
    is_flash_sale: reply.is_flash_sale === true,
    affiliate_id: reply.affiliate_id || null,
  };
}

export function readPromo(win = typeof window !== 'undefined' ? window : null) {
  try {
    const stored = JSON.parse(win?.localStorage?.getItem(STORAGE_KEY) || 'null');
    return stored?.code ? promoFromReply(stored) : null;
  } catch {
    return null;
  }
}

export function writePromo(promo, win = typeof window !== 'undefined' ? window : null) {
  try {
    if (promo) win?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(promo));
    else win?.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // The code still applies for this page view.
  }
}

/** Ask the catalog about `code`. Never throws: a failure reads as invalid. */
export async function validatePromo(code, { lang = 'es', items = [] } = {}, fetchImpl = fetch) {
  const clean = String(code || '').trim();
  if (!clean) return { valid: false, error: null };
  try {
    const response = await fetchImpl('/api/catalog/promo-validate/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: clean,
        lang,
        items,
        unitCount: items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0),
      }),
    });
    const data = await response.json().catch(() => ({}));
    return { valid: data.valid === true, pending: data.pending === true, error: data.error || null, ...data };
  } catch {
    return {
      valid: false,
      error: lang === 'en' ? 'Could not check the code. Please try again.' : 'No se pudo verificar el código. Intente de nuevo.',
    };
  }
}

/** The order fields the catalog's checkout reads a code from. */
export function promoOrderFields(promo) {
  return promo?.code ? { promo_code: promo.code, affiliate_id: promo.affiliate_id || null } : {};
}
