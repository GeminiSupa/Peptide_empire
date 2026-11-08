// Copied from the catalog (src/lib/appStorefront.js) by scripts/sync-catalog-checkout.mjs. Do not edit.
/**
 * Web app at app.peptidescostarica.net — same destination the launch email,
 * QR, thank-you page, and storefront nav/footer point at. UTM keeps each
 * surface countable in analytics.
 */
export const APP_STOREFRONT_URL = 'https://app.peptidescostarica.net';

export function appStorefrontHref({ source = 'web', lang = 'es' } = {}) {
  const safeLang = lang === 'en' ? 'en' : 'es';
  const utm = new URLSearchParams({
    utm_source: String(source || 'web'),
    utm_medium: 'web',
    utm_campaign: 'app_launch',
    lang: safeLang,
  });
  return `${APP_STOREFRONT_URL}/?${utm.toString()}`;
}
