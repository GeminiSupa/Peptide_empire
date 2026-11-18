/**
 * The countries this one admin runs. Each is its own storefront (its own
 * domain and currency) but they all share this database and this admin app,
 * separated by each row's `site_id`.
 *
 * The country switcher in the admin header lists these; a staff member only
 * sees the ones in their `admin_profiles.allowed_sites` (a superadmin sees all).
 */
export const ADMIN_SITES = [
  { id: 'co', name: 'Colombia', flag: '🇨🇴', currency: 'COP' },
  { id: 'mx', name: 'Mexico', flag: '🇲🇽', currency: 'MXN' },
  { id: 'ar', name: 'Argentina', flag: '🇦🇷', currency: 'ARS' },
  { id: 'ca', name: 'Canada', flag: '🇨🇦', currency: 'CAD' },
];

export const ADMIN_SITE_IDS = ADMIN_SITES.map((s) => s.id);

/**
 * Tables whose rows belong to one country (they carry a `site_id`). The admin
 * filters these to the active country. Tables left out are shared across every
 * country (e.g. `blogs`, which both sites publish, and `product_reviews`).
 */
export const SITE_SCOPED_TABLES = new Set([
  'orders',
  'catalog_leads',
  'abandoned_carts',
  'product_views',
  'customer_profiles',
  'business_accounts',
  'products',
  'analytics_events',
  'deals',
  'blogs',
  'ad_spend',
]);

/** The country the switcher last stored in this browser (its cookie), or ''. */
export function readSiteCookie() {
  if (typeof document === 'undefined') return '';
  const hit = document.cookie.split('; ').find((row) => row.startsWith('pe_admin_site='));
  return hit ? decodeURIComponent(hit.split('=')[1]) : '';
}

export const siteById = (id) => ADMIN_SITES.find((s) => s.id === id) || null;

export const isValidSiteId = (id) => ADMIN_SITE_IDS.includes(id);

/**
 * The countries a profile may work in. A superadmin gets all of them; everyone
 * else gets exactly what `allowed_sites` lists (and nothing until it is set).
 */
export function allowedSitesFor(profile) {
  if (profile?.is_superadmin) return ADMIN_SITE_IDS.slice();
  const list = Array.isArray(profile?.allowed_sites) ? profile.allowed_sites.filter(isValidSiteId) : [];
  return list;
}

/**
 * The country whose data to show this request: the one the switcher asked for
 * (cookie), if the person is allowed it, else their first allowed country.
 * Null means "all countries" — only ever returned for a superadmin who has
 * explicitly chosen the "All countries" view (requested === 'all').
 */
export function resolveActiveSite(profile, requested) {
  const allowed = allowedSitesFor(profile);
  if (profile?.is_superadmin && requested === 'all') return null;
  if (requested && allowed.includes(requested)) return requested;
  return allowed[0] || null;
}
