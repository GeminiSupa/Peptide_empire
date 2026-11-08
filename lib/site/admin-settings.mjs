/**
 * The settings staff change in the catalog admin, which this site follows
 * exactly as the catalog does (owner, 8 Nov 2026: one admin controls both).
 *
 * - `business_links` (admin → Business info): the WhatsApp number, phones,
 *   support email and review links shown everywhere on the site.
 * - `announcement_banners` (admin → banners): the active banners lead the
 *   strip at the top of every page.
 * - Promo codes with "show sale badge" on: the ribbon on the products the
 *   code covers (the catalog's own promoBadge rules).
 *
 * Product sale prices (the "was" price and its start/end times) ride on the
 * product rows themselves; see lib/storefront/sale-price.mjs.
 *
 * Read with the public key, as the catalog's own pages read them, and
 * refreshed every 60 seconds like the products.
 */

import { CONTACT } from './contact.mjs';
import { getPromoBadgeForProduct } from '../catalog-pricing/promoBadge.mjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cbanvzipzfmllexraiei.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zmywxSKfQ6uJmsQGSjzsBA_JRGHLLR2';

const SETTINGS_URL = `${SUPABASE_URL}/rest/v1/site_settings?select=id,value&id=in.(business_links,announcement_banners)`;
// The catalog's own badge query: opted in, active, and never a hidden code.
const BADGE_URL = `${SUPABASE_URL}/rest/v1/promo_codes`
  + '?select=code,discount_pct,is_active,hidden,show_sale_badge,badge_style,badge_text,badge_text_es,target_product,valid_from,valid_until,usage_limit,usage_count'
  + '&show_sale_badge=eq.true&is_active=eq.true&hidden=eq.false';

const digits = (value) => String(value || '').replace(/\D/g, '');

/** The site's contact details, with every value the admin has set taking over. */
export function contactFrom(links = {}) {
  const wa = digits(links.whatsappNumber);
  const us = digits(links.apiWhatsAppNumber);
  const email = String(links.supportEmail || '').trim();
  return {
    whatsapp: wa || CONTACT.whatsapp,
    phoneCr: String(links.whatsappDisplay || '').trim() || CONTACT.phoneCr,
    phoneCrHref: wa ? `tel:+${wa}` : CONTACT.phoneCrHref,
    phoneUs: String(links.apiWhatsAppDisplay || '').trim() || CONTACT.phoneUs,
    phoneUsHref: us ? `tel:+${us}` : CONTACT.phoneUsHref,
    email: email || CONTACT.email,
  };
}

/**
 * [from, to] pairs that turn the design's contact details, wherever they are
 * written into a page's text or links, into the admin's. Empty while the two
 * agree.
 */
export function contactReplacements(contact) {
  const pairs = [
    [CONTACT.phoneCr, contact.phoneCr],
    [CONTACT.phoneUs, contact.phoneUs],
    [CONTACT.email, contact.email],
    [CONTACT.phoneCrHref, contact.phoneCrHref],
    [CONTACT.phoneUsHref, contact.phoneUsHref],
    [`wa.me/${CONTACT.whatsapp}`, `wa.me/${contact.whatsapp}`],
  ];
  return pairs.filter(([from, to]) => from && to && from !== to);
}

/** Review page links the admin has set, per platform, in the page's language. */
export function reviewLinksFrom(links = {}, lang = 'en') {
  const out = {};
  const trustpilot = (lang === 'es' ? links.trustpilotUrlEs : links.trustpilotUrlEn) || links.trustpilotUrl;
  if (trustpilot) out.trustpilot = trustpilot;
  if (links.googleReviewUrl) out.google = links.googleReviewUrl;
  if (links.facebookReviewUrl) out.facebook = links.facebookReviewUrl;
  return out;
}

const USD_PLACEHOLDER = /\{\{usd_(\d+(?:\.\d+)?)\}\}/g;
const FULL_LINK = /^\s*\[([\s\S]+?)\]\(([^)\s]+)\)\s*$/;
const INLINE_LINK = /\[([^\]]+)\]\(([^)]+)\)/;

function safeHref(href) {
  const value = String(href || '').trim();
  return /^(\/|#|https?:\/\/|mailto:|tel:)/.test(value) || value === 'whatsapp' ? value : '';
}

/**
 * The active banners as `{ id, text, href }` in `lang`, written the way the
 * catalog writes them: `{{usd_200}}` becomes `$200`, a markdown link becomes
 * the banner's link, markdown emphasis is dropped.
 */
export function bannersFrom(value, lang = 'es') {
  const suffix = lang === 'en' ? 'En' : 'Es';
  return (Array.isArray(value) ? value : [])
    .filter((banner) => banner?.isActive)
    .map((banner) => {
      const raw = String(banner[`text${suffix}`] || banner.textEn || banner.textEs || banner.text || '')
        .replace(USD_PLACEHOLDER, (_, amount) => `$${Number(amount)}`);
      const full = raw.match(FULL_LINK);
      const href = safeHref(full ? full[2] : raw.match(INLINE_LINK)?.[2] || banner.href || banner.url || banner.link);
      const text = (full ? full[1] : raw)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/[*_`~]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return { id: String(banner.id || text), text, href };
    })
    .filter((banner) => banner.text);
}

/** The ribbon for one product, or null — the catalog's own choice of badge. */
export function ribbonFor(promos, productName, lang = 'es', now = new Date()) {
  return getPromoBadgeForProduct(promos, productName, lang, now)?.text || null;
}

async function read(url) {
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('no array');
  return rows;
}

/**
 * Everything above, read once per request. If a read fails, that part shows
 * what the design shipped with (the contact details in links.mjs, no banner,
 * no ribbons) and the failure is logged; the next refresh tries again.
 */
export async function getAdminSettings() {
  const [settings, badges] = await Promise.all([
    read(SETTINGS_URL).catch((error) => {
      console.error('[admin settings] site_settings unavailable:', error.message);
      return [];
    }),
    read(BADGE_URL).catch((error) => {
      console.error('[admin settings] promo badges unavailable:', error.message);
      return [];
    }),
  ]);
  const value = (id) => settings.find((row) => row.id === id)?.value;
  return {
    businessLinks: value('business_links') || {},
    banners: value('announcement_banners') || [],
    badgePromos: badges,
  };
}
