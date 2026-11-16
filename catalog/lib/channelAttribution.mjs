// Copied from the catalog (src/lib/channelAttribution.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
/**
 * Where a sale came from: one channel per order, from the visit that brought
 * the customer (Belhassen's revenue-by-channel brief, 9 Nov 2026).
 *
 * A "touch" is one arrival on the site — its UTM tags, ad click ids, the page
 * it landed on and the site that sent it. Every visitor carries two:
 *   - first touch: the arrival that introduced them, kept for 90 days;
 *   - last touch: the latest arrival that came from somewhere (a plain direct
 *     visit never overwrites it — "last non-direct touch").
 * Both ride in one first-party cookie on .peptidescostarica.net, so the main
 * site and the catalog share them, and checkout copies them onto the order.
 *
 * Each touch is filed under exactly one channel from a fixed list, so channel
 * totals always add up to the real revenue — unlike Google Ads and Meta, which
 * both claim the same sale.
 *
 * Pure, no '@/lib' imports, so tests load it under `node --test` and the
 * browser tracker, checkout and the report all use the same rules.
 */

export const TOUCH_COOKIE = 'pcr_touch';
export const TOUCH_TTL_MS = 90 * 86400000;

/** The fixed channel list. `type` is how the report splits paid from organic. */
export const CHANNELS = [
  { key: 'google_ads', type: 'paid', label: 'Google Ads' },
  { key: 'meta_ads', type: 'paid', label: 'Meta Ads' },
  { key: 'tiktok_ads', type: 'paid', label: 'TikTok Ads' },
  { key: 'meta_lead_form', type: 'paid', label: 'Meta lead forms' },
  { key: 'email', type: 'organic', label: 'Email' },
  { key: 'whatsapp_sms_campaign', type: 'organic', label: 'WhatsApp / SMS campaigns' },
  { key: 'organic_search', type: 'organic', label: 'Organic search' },
  { key: 'organic_social', type: 'organic', label: 'Organic social' },
  { key: 'agent_referral', type: 'organic', label: 'Agent / referral' },
  { key: 'partner_site', type: 'organic', label: 'Partner sites' },
  { key: 'referral', type: 'organic', label: 'Referral sites' },
  { key: 'direct', type: 'organic', label: 'Direct' },
  { key: 'unknown', type: 'unknown', label: 'Unknown' },
];

export const CHANNEL_KEYS = new Set(CHANNELS.map((channel) => channel.key));
const CHANNEL_BY_KEY = new Map(CHANNELS.map((channel) => [channel.key, channel]));

export function channelInfo(key) {
  return CHANNEL_BY_KEY.get(key) || CHANNEL_BY_KEY.get('unknown');
}

/** How an order got its source. */
export const CAPTURED_BY = ['website', 'whatsapp_ref', 'agent', 'partner_api', 'unknown'];

const PAID_MEDIUMS = new Set(['cpc', 'ppc', 'paid', 'paidsocial', 'paid_social', 'social_paid', 'paid-social', 'cpm', 'cpv', 'display', 'ads', 'ad']);
const GOOGLE_SOURCES = new Set(['google', 'adwords', 'googleads', 'google_ads', 'youtube_ads']);
const META_SOURCES = new Set(['facebook', 'instagram', 'meta', 'fb', 'ig', 'facebook_ads', 'meta_ads']);
const TIKTOK_SOURCES = new Set(['tiktok', 'tiktok_ads', 'tt']);
const SEARCH_ENGINES = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu|brave)\./;
const SOCIAL_SITES = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|tiktok\.com|youtube\.com|youtu\.be)$/;
// Our own sites and the payment pages a customer returns from must never be
// taken for the place that sent them.
const IGNORED_REFERRERS = /(^|\.)(peptidescostarica\.net|chargx\.io|givver\.com|givver\.io|localhost)$/;

const lower = (value) => String(value ?? '').trim().toLowerCase();
const clip = (value, max) => {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : '';
};
const CLICK_ID = /^[A-Za-z0-9_.~+=/-]{1,400}$/;
const cleanClickId = (value) => (CLICK_ID.test(String(value ?? '')) ? String(value) : '');

/** The bare host of a referrer URL, or '' when there is none. */
export function referrerHost(referrer) {
  try {
    return referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, '') : '';
  } catch {
    return '';
  }
}

export function isIgnoredReferrer(host) {
  return Boolean(host) && IGNORED_REFERRERS.test(host);
}

/**
 * One channel for a touch. First match wins, in the brief's order.
 *
 * Server-side touches (`via`) — an agent, a partner site, a Meta lead form —
 * are decided by where the record came from, not by a URL.
 */
export function classifyTouch(touch) {
  if (!touch || typeof touch !== 'object') return 'unknown';
  if (touch.via === 'agent_referral') return 'agent_referral';
  if (touch.via === 'partner_site') return 'partner_site';
  if (touch.via === 'meta_lead_form') return 'meta_lead_form';
  if (touch.via && CHANNEL_KEYS.has(touch.via)) return touch.via;

  const src = lower(touch.src);
  const med = lower(touch.med);
  const host = lower(touch.ref);
  const lref = lower(touch.lref);
  const paidMedium = PAID_MEDIUMS.has(med);

  if (touch.gclid || touch.gbraid || touch.wbraid || (GOOGLE_SOURCES.has(src) && paidMedium)) return 'google_ads';
  if ((touch.fbclid && paidMedium) || (META_SOURCES.has(src) && paidMedium)) return 'meta_ads';
  if (touch.ttclid || (TIKTOK_SOURCES.has(src) && paidMedium)) return 'tiktok_ads';
  // The media buyer's paid landing links: ?ref=tiktok-glp1-a&cid=… name the
  // platform in the ref rather than in UTM tags.
  if (lref || touch.cid) {
    if (/tiktok|(^|[-_])tt([-_]|$)/.test(lref)) return 'tiktok_ads';
    if (/meta|facebook|(^|[-_])(fb|ig)([-_]|$)|instagram/.test(lref)) return 'meta_ads';
    if (/google|adwords|(^|[-_])gads([-_]|$)/.test(lref)) return 'google_ads';
  }
  if (med === 'email') return 'email';
  if (med === 'whatsapp' || med === 'sms') return 'whatsapp_sms_campaign';
  if (host && !isIgnoredReferrer(host)) {
    if (SEARCH_ENGINES.test(host)) return 'organic_search';
    if (SOCIAL_SITES.test(host) && !paidMedium) return 'organic_social';
  }
  // Facebook adds fbclid to every outbound link, paid or not.
  if (touch.fbclid) return 'organic_social';
  if (src || med || touch.cmp || lref || touch.cid) return 'referral';
  if (host && !isIgnoredReferrer(host)) return 'referral';
  return 'direct';
}

/**
 * The touch a page load represents, read from its URL and referrer.
 * Returns null for a page reached from our own site: that is the same visit
 * moving around, not an arrival.
 */
export function touchFromVisit({ href, referrer = '', now = Date.now() } = {}) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const params = url.searchParams;
  const host = referrerHost(referrer);
  const touch = {
    at: now,
    src: clip(lower(params.get('utm_source')), 80),
    med: clip(lower(params.get('utm_medium')), 60),
    cmp: clip(params.get('utm_campaign'), 120),
    cnt: clip(params.get('utm_content'), 80),
    trm: clip(params.get('utm_term'), 80),
    gclid: cleanClickId(params.get('gclid')),
    gbraid: cleanClickId(params.get('gbraid')),
    wbraid: cleanClickId(params.get('wbraid')),
    fbclid: cleanClickId(params.get('fbclid')),
    ttclid: cleanClickId(params.get('ttclid')),
    cid: cleanClickId(params.get('cid')),
    lref: clip(params.get('ref'), 80),
    ref: isIgnoredReferrer(host) ? '' : host,
    lp: clip(`${url.hostname.replace(/^www\./, '')}${url.pathname}`, 160),
  };
  const tagged = touch.src || touch.med || touch.cmp || touch.gclid || touch.gbraid || touch.wbraid
    || touch.fbclid || touch.ttclid || touch.cid || touch.lref;
  if (!tagged && isIgnoredReferrer(host)) return null;
  touch.ch = classifyTouch(touch);
  return compactTouch(touch);
}

/** Drop empty fields so the cookie stays small. */
function compactTouch(touch) {
  return Object.fromEntries(Object.entries(touch).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

const TOUCH_FIELDS = {
  src: 80, med: 60, cmp: 120, cnt: 80, trm: 80, lref: 80, ref: 120, lp: 160, via: 40, detail: 160,
};
const CLICK_FIELDS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'cid'];

/** A touch from outside (cookie, request body), kept only if well-formed and in date. */
export function sanitizeTouch(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const at = Number(value.at);
  if (!Number.isFinite(at) || at > now + 60000 || now - at > TOUCH_TTL_MS) return null;
  const touch = { at };
  for (const [key, max] of Object.entries(TOUCH_FIELDS)) {
    const text = clip(value[key], max);
    if (text) touch[key] = text;
  }
  for (const key of CLICK_FIELDS) {
    const id = cleanClickId(value[key]);
    if (id) touch[key] = id;
  }
  touch.ch = classifyTouch(touch);
  return touch;
}

/** The visitor's {v, ft, lt}, cleaned. Null when nothing usable is left. */
export function sanitizeTouchState(value, now = Date.now()) {
  if (!value || typeof value !== 'object') return null;
  const v = /^[A-Za-z0-9-]{8,64}$/.test(String(value.v || '')) ? String(value.v) : '';
  const ft = sanitizeTouch(value.ft, now);
  const lt = sanitizeTouch(value.lt, now);
  if (!ft && !lt) return null;
  return { ...(v ? { v } : {}), ...(ft ? { ft } : {}), ...(lt ? { lt } : {}) };
}

/**
 * Fold one arrival into the visitor's state.
 * First touch is set once (or again once it is over 90 days old); last touch
 * follows every arrival that came from somewhere, never a plain direct visit.
 */
export function mergeTouch(state, touch, now = Date.now()) {
  const current = sanitizeTouchState(state, now) || {};
  const next = { ...current };
  if (!next.v && state?.v) next.v = state.v;
  if (!touch) return next;
  if (!next.ft) next.ft = touch;
  if (!next.lt || touch.ch !== 'direct') next.lt = touch;
  return next;
}

export function encodeTouchState(state) {
  return encodeURIComponent(JSON.stringify(state));
}

export function decodeTouchState(raw, now = Date.now()) {
  try {
    return sanitizeTouchState(JSON.parse(decodeURIComponent(raw)), now);
  } catch {
    return null;
  }
}

/** The touch state from a Cookie header (or `document.cookie`). */
export function readTouchCookie(cookieHeader, now = Date.now()) {
  const raw = String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TOUCH_COOKIE}=`));
  return raw ? decodeTouchState(raw.slice(TOUCH_COOKIE.length + 1), now) : null;
}

/**
 * The gclid Google's Conversion Linker saved in `_gcl_aw` ("GCL.<seconds>.<gclid>"),
 * for an order whose landing URL lost it. Null when absent or older than 90 days.
 */
export function gclidFromConversionLinker(cookieHeader, now = Date.now()) {
  const raw = String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('_gcl_aw='));
  if (!raw) return null;
  const [, seconds, ...rest] = decodeURIComponent(raw.slice(8)).split('.');
  const gclid = cleanClickId(rest.join('.'));
  const at = Number(seconds) * 1000;
  if (!gclid || !Number.isFinite(at) || now - at > TOUCH_TTL_MS || at > now + 60000) return null;
  return { gclid, clicked_at: at };
}

/**
 * The attribution columns an order gets from a visitor's state.
 * `capturedBy` says how the source reached the order.
 */
export function orderAttributionColumns(state, capturedBy = 'website') {
  if (!state || (!state.ft && !state.lt)) return {};
  const lt = state.lt || state.ft;
  const ft = state.ft || state.lt;
  return {
    visitor_id: state.v || null,
    first_touch: ft,
    last_touch: lt,
    ft_channel: ft.ch || classifyTouch(ft),
    lt_channel: lt.ch || classifyTouch(lt),
    captured_by: CAPTURED_BY.includes(capturedBy) ? capturedBy : 'unknown',
  };
}

/**
 * The source columns for a lead form: the shared cookie, else the copy a form
 * on the main site sends as `touch`, else a touch built from the UTM tags and
 * Google click the form already posts.
 */
export function leadAttributionColumns({ cookie = '', touch = null, utmSource = '', utmMedium = '', utmCampaign = '', referrer = '', adClick = null } = {}, now = Date.now()) {
  const state = readTouchCookie(cookie, now) || sanitizeTouchState(touch, now);
  if (state) return orderAttributionColumns(state, 'website');
  const built = sanitizeTouch({
    at: now,
    src: lower(utmSource),
    med: lower(utmMedium),
    cmp: utmCampaign,
    ref: isIgnoredReferrer(referrerHost(referrer)) ? '' : referrerHost(referrer),
    gclid: adClick?.gclid,
    gbraid: adClick?.gbraid,
    wbraid: adClick?.wbraid,
  }, now);
  if (!built || built.ch === 'direct') return {};
  return orderAttributionColumns({ ft: built, lt: built }, 'website');
}

/**
 * "Where did this customer come from?" on an order staff create by hand.
 * The channel list, plus the two answers a person can honestly give.
 */
export const AGENT_SOURCE_OPTIONS = [
  ...CHANNELS.filter((channel) => channel.key !== 'unknown').map(({ key, label }) => ({ key, label })),
  { key: 'returning', label: 'Returning customer, no new ad or link' },
  { key: 'not_sure', label: 'Not sure' },
];
const AGENT_SOURCE_KEYS = new Set(AGENT_SOURCE_OPTIONS.map((option) => option.key));

/**
 * The columns an agent's answer gives an order. A tracked WhatsApp tap or lead
 * form for the same phone replaces them in the database (the order trigger in
 * add-order-channel-attribution.sql), because a click is better evidence.
 */
export function agentSourceColumns(choice, note = '', now = Date.now()) {
  const key = String(choice || '').trim();
  if (!AGENT_SOURCE_KEYS.has(key)) return {};
  const detail = clip(note, 160);
  const base = { agent_source: key, ...(detail ? { source_note: detail } : {}) };
  if (key === 'not_sure') return base;
  const touch = sanitizeTouch({ at: now, via: key === 'returning' ? 'direct' : key, ...(detail ? { detail } : {}) }, now);
  return { ...base, ...orderAttributionColumns({ ft: touch, lt: touch }, 'agent') };
}

/** The columns orders/leads gain; dropped (not failed) on a database without the migration. */
export const ORDER_CHANNEL_COLUMNS = ['visitor_id', 'first_touch', 'last_touch', 'ft_channel', 'lt_channel', 'captured_by'];
