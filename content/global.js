/**
 * Site-wide chrome: announcement bar, header nav, footer.
 *
 * The values come from data/global.json, harvested from the live site in BOTH
 * languages by scripts/harvest-global.mjs. Nothing here is typed by hand —
 * earlier hand-written Spanish in lib/nav.js and lib/site.js turned out not to
 * match the live site and has been dropped.
 *
 * This module is the seam where the future CMS plugs in: today it reads a JSON
 * file, later it reads the `site_cms_settings` table. Components import from
 * here and never from data/ directly, so that swap touches one file.
 */
import globalData from '@/data/global.json';

export const announcement = globalData.announcement;
export const headerContact = globalData.headerContact;
export const nav = globalData.nav;
export const footer = globalData.footer;
export const harvestedAt = globalData.harvestedAt;

/**
 * Contact details used outside the harvested chrome (buy buttons, WhatsApp).
 * Verified against the live site's footer on 2026-07-27.
 */
export const CONTACT = {
  crPhoneHref: 'tel:+50684046973',
  usPhoneHref: 'tel:+18314715559',
  email: 'info@peptidescostarica.net',
  emailHref: 'mailto:info@peptidescostarica.net',
  whatsappHref: 'https://wa.me/50684046973',
};

/**
 * The catalog site owns the cart, checkout and orders. This project is
 * marketing only: every buy button links out to it. Never add checkout here.
 */
const CATALOG_BASE = 'https://catalog.peptidescostarica.net/catalog';

export function catalogUrl(lang = 'es') {
  return `${CATALOG_BASE}?lang=${lang === 'en' ? 'en' : 'es'}`;
}
