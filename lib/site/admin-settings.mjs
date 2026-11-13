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
 * - `related_products` (admin → Products → Related products): which other
 *   products each product page offers; see related-products.mjs.
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

const SETTINGS_URL = `${SUPABASE_URL}/rest/v1/site_settings?select=id,value&id=in.(business_links,announcement_banners,related_products)`;
// The catalog's own badge query: opted in, active, and never a hidden code.
const BADGE_URL = `${SUPABASE_URL}/rest/v1/promo_codes`
  + '?select=code,discount_pct,is_active,hidden,show_sale_badge,badge_style,badge_text,badge_text_es,target_product,valid_from,valid_until,usage_limit,usage_count'
  + '&show_sale_badge=eq.true&is_active=eq.true&hidden=eq.false';

const digits = (value) => String(value || '').replace(/\D/g, '');

/**
 * Numbers the business may no longer use (owner, 9 Nov 2026: WhatsApp blocked
 * +506 8404-6973; staff must not be reached on it). A saved admin value that
 * is one of these is ignored, so the site's own number wins even while the
 * admin row still holds the old one.
 */
const RETIRED_NUMBERS = new Set(['50684046973']);
const retired = (value) => {
  const d = digits(value);
  return RETIRED_NUMBERS.has(d) || RETIRED_NUMBERS.has(`506${d}`);
};

/** The site's contact details, with every value the admin has set taking over. */
export function contactFrom(links = {}) {
  const wa = retired(links.whatsappNumber) ? '' : digits(links.whatsappNumber);
  const us = digits(links.apiWhatsAppNumber);
  const email = String(links.supportEmail || '').trim();
  const display = String(links.whatsappDisplay || '').trim();
  return {
    whatsapp: wa || CONTACT.whatsapp,
    phoneCr: (retired(display) ? '' : display) || CONTACT.phoneCr,
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

/**
 * The YouTube channel the business links to. Staff set it in the catalog
 * admin's Business info CMS (business_links.youtubeUrl); an empty field falls
 * back to the canonical channel, so the link is right even before anyone edits
 * it from the dashboard.
 */
const CANONICAL_YOUTUBE_URL = 'https://www.youtube.com/@PeptidesCostaRica-g9k';
export function youtubeUrlFrom(links = {}) {
  return String(links.youtubeUrl || '').trim() || CANONICAL_YOUTUBE_URL;
}

const safeSocialUrl = (value) => {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) ? url : '';
};

const FOOTER_SOCIALS = [
  ['Facebook', ''],
  ['Instagram', ''],
  ['LinkedIn', 'https://www.linkedin.com/company/peptides-costa-rica/'],
  ['X', 'https://x.com/Peptides_CR'],
  ['Pinterest', 'https://www.pinterest.com/peptidescr/'],
  ['Bluesky', 'https://bsky.app/profile/peptidescostarica.bsky.social'],
];

/**
 * Footer profiles controlled by the catalog CMS. A blank Facebook or
 * Instagram field means "hide it"; it must not revive a hardcoded profile.
 */
export function socialLinksFrom(links = {}) {
  const controlled = {
    Facebook: safeSocialUrl(links.facebookUrl),
    Instagram: safeSocialUrl(links.instagramUrl),
  };
  return [
    ...FOOTER_SOCIALS.map(([name, href]) => [name, Object.hasOwn(controlled, name) ? controlled[name] : href])
      .filter(([, href]) => href),
    ['YouTube', youtubeUrlFrom(links)],
  ];
}

/**
 * The footer's social list with its YouTube entry pointed at `youtubeUrl`.
 * Overrides the entry when the global document already has one, and adds it
 * when it does not, so the dashboard controls the link either way.
 */
export function socialWithYoutube(social = [], youtubeUrl = CANONICAL_YOUTUBE_URL) {
  const list = Array.isArray(social) ? social.map((entry) => ({ ...entry })) : [];
  const index = list.findIndex((entry) => /youtube/i.test(entry?.name || ''));
  if (index >= 0) list[index].href = youtubeUrl;
  else list.push({ name: 'Youtube', href: youtubeUrl });
  return list;
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
  let settingsRead = true;
  const [settings, badges] = await Promise.all([
    read(SETTINGS_URL).catch((error) => {
      console.error('[admin settings] site_settings unavailable:', error.message);
      settingsRead = false;
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
    // Null when unread, so product pages offer no other products until the
    // next refresh rather than ones staff switched off (related-products.mjs).
    relatedProducts: settingsRead ? (value('related_products') || {}) : null,
  };
}
