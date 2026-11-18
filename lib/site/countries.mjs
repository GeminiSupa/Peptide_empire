/**
 * The countries this one codebase serves. Each request is resolved to one of
 * these by its host (see current-site.mjs), and the storefront then loads that
 * country's products, currency and copy.
 *
 * `rate` is a rough USD->local placeholder so prices render; wire each to a live
 * feed or the admin's exchange-rate setting per country before launch.
 */
export const SITES = {
  co: { id: 'co', name: 'Colombia', brand: 'Peptidos Colombia', country: 'Colombia', currency: 'COP', symbol: '$', rate: 4000, locale: 'es-CO', lang: 'es', timezone: 'America/Bogota', domain: 'peptidoscolombia.co' },
  mx: { id: 'mx', name: 'Mexico', brand: 'Peptidos Mexico', country: 'Mexico', currency: 'MXN', symbol: '$', rate: 17, locale: 'es-MX', lang: 'es', timezone: 'America/Mexico_City', domain: 'comprarpeptidosmexico.com' },
  ar: { id: 'ar', name: 'Argentina', brand: 'Peptidos Argentina', country: 'Argentina', currency: 'ARS', symbol: '$', rate: 1000, locale: 'es-AR', lang: 'es', timezone: 'America/Argentina/Buenos_Aires', domain: 'comprarpeptidosargentina.com' },
  ca: { id: 'ca', name: 'Canada', brand: 'Peptides Canada', country: 'Canada', currency: 'CAD', symbol: '$', rate: 1.4, locale: 'en-CA', lang: 'en', timezone: 'America/Toronto', domain: 'canadapeptidesdirect.com' },
};

export const DEFAULT_SITE_ID = 'co';

/** The site whose domain matches this host, or the default. */
export function siteForHost(host) {
  const h = String(host || '').toLowerCase();
  // Production domains.
  for (const site of Object.values(SITES)) {
    const key = site.domain.split('.')[0]; // e.g. "comprarpeptidosmexico"
    if (h.includes(site.domain) || h.includes(key)) return site;
  }
  // Local dev: use a subdomain like mx.localhost:3000 or a ?site= / cookie override.
  const sub = h.split('.')[0]; // "mx" from "mx.localhost"
  if (SITES[sub]) return SITES[sub];
  return SITES[DEFAULT_SITE_ID];
}

/** A site by id, or the default. */
export function siteById(id) {
  return SITES[id] || SITES[DEFAULT_SITE_ID];
}
