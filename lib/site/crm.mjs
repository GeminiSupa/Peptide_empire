/**
 * What the catalog's CRM learns from this site, sent the way the catalog's own
 * pages send it.
 *
 * - Abandoned carts → the catalog's `abandoned_carts`, through `/api/cart/track`
 *   (relayed: lib/site/catalog-relay.mjs). The admin's cart list and the
 *   WhatsApp recovery job read that table.
 * - Product views → `product_views`, inserted with the public key exactly as
 *   the catalog's product pages do. The CRM's lead profiles read it.
 * - QR / agent / affiliate landings → `/api/referral-scan`, once per landing.
 * - Newsletter and WhatsApp consent → `/api/newsletter`, `/api/leads/optin`.
 *
 * Every call is fire-and-forget and swallows its own failure: tracking must
 * never slow down or break shopping.
 */

const SESSION_KEY = 'cart_session_id';

/**
 * Passive tracking (carts, views) reaches the CRM only once the site is live
 * on the real domain — the same launch switch as Tag Manager and the visitor
 * tracker (NEXT_PUBLIC_ALLOW_INDEXING) — so test visits never land in the
 * reports or the WhatsApp recovery queue. `localStorage.pcr_crm_test = '1'`
 * turns it on in one browser for testing.
 */
export function crmTrackingOn(win = typeof window !== 'undefined' ? window : null) {
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true') return true;
  try {
    return win?.localStorage?.getItem('pcr_crm_test') === '1';
  } catch {
    return false;
  }
}
const SCAN_KEY = 'referral_scan_logged';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cbanvzipzfmllexraiei.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zmywxSKfQ6uJmsQGSjzsBA_JRGHLLR2';

const store = (win) => {
  try {
    return win?.localStorage || null;
  } catch {
    return null;
  }
};

function post(path, body, fetchImpl = fetch) {
  return fetchImpl(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).then((response) => response.json().catch(() => ({})).then((data) => ({ status: response.status, ...data })));
}

/** This browser's cart session, in the shape the catalog accepts (8–128 of [A-Za-z0-9_-]). */
export function cartSessionId(win = typeof window !== 'undefined' ? window : null) {
  const s = store(win);
  let id = s?.getItem(SESSION_KEY) || '';
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) {
    const random = win?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    id = `web-${random}`.replace(/[^A-Za-z0-9_-]/g, '');
    try { s?.setItem(SESSION_KEY, id); } catch { /* one session per page view, then */ }
  }
  return id;
}

/** Whether the catalog would keep this cart: it only tracks shoppers it can contact. */
export function isContactable(details = {}) {
  return Boolean(
    String(details.name || '').trim()
    || String(details.phone || '').replace(/\D/g, '').length >= 8
    || /@/.test(String(details.email || '')),
  );
}

export function saveAbandonedCart({ cart, details, lang, currency }, fetchImpl = fetch) {
  if (!crmTrackingOn() || !cart?.length || !isContactable(details)) return Promise.resolve(null);
  return post('/api/catalog/cart-track/', {
    action: 'save',
    sessionId: cartSessionId(),
    cart,
    customerName: String(details.name || '').trim() || null,
    customerPhone: String(details.phone || '').replace(/\D/g, '') || null,
    customerEmail: String(details.email || '').trim() || null,
    lang,
    currency,
  }, fetchImpl).catch(() => null);
}

/** The order was placed (or the cart emptied): nothing left to recover. */
export function clearAbandonedCart(fetchImpl = fetch) {
  if (!crmTrackingOn()) return Promise.resolve(null);
  return post('/api/catalog/cart-track/', { action: 'clear', sessionId: cartSessionId() }, fetchImpl).catch(() => null);
}

/** One product page opened, for the CRM's lead profiles. */
export function recordProductView({ product, productId = null, contact = null }, fetchImpl = fetch) {
  if (!product || !crmTrackingOn()) return Promise.resolve(null);
  return fetchImpl(`${SUPABASE_URL}/rest/v1/product_views`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([{
      session_id: cartSessionId(),
      contact_value: contact || null,
      product_id: productId || product,
      product_name: product,
    }]),
    keepalive: true,
  }).catch(() => null);
}

/** The scan to record for a landing URL, or null when it carries no agent, code or referral. */
export function scanFromUrl(search = '') {
  const params = new URLSearchParams(search);
  const salesAgent = params.get('sales_agent');
  const promoCode = params.get('promo_code') || params.get('promo');
  const referral = params.get('ref') || params.get('referral');
  if (!salesAgent && !promoCode && !referral) return null;
  return {
    salesAgent,
    promoCode,
    referral,
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
  };
}

/** Count a QR / agent / affiliate landing. The catalog de-duplicates reloads. */
export function recordReferralScan(win = typeof window !== 'undefined' ? window : null, fetchImpl = fetch) {
  const scan = scanFromUrl(win?.location?.search || '');
  if (!scan) return Promise.resolve(null);
  const s = store(win);
  const firstVisit = !s?.getItem(SCAN_KEY);
  return post('/api/catalog/referral-scan/', { ...scan, sessionId: cartSessionId(win), isFirstVisit: firstVisit }, fetchImpl)
    .then((result) => {
      try { s?.setItem(SCAN_KEY, '1'); } catch { /* counted anyway */ }
      return result;
    })
    .catch(() => null);
}

/** `{ ok, already }` — an address already on the list counts as success. */
export function subscribeNewsletter(email, fetchImpl = fetch) {
  return post('/api/catalog/newsletter/', { email }, fetchImpl)
    .then((result) => ({ ok: result.success === true || result.status === 409, already: result.status === 409 }))
    .catch(() => ({ ok: false }));
}

/** The shopper agreed to WhatsApp updates and offers. */
export function whatsappOptIn({ phone, lang }, fetchImpl = fetch) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return Promise.resolve(null);
  return post('/api/catalog/whatsapp-optin/', { phone: digits, language: lang }, fetchImpl).catch(() => null);
}
