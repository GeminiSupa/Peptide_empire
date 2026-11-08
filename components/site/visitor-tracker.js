'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { catalogUrl } from '@/lib/storefront/catalog-origin.mjs';
import { captureAttribution, ATTRIBUTION_KEYS } from '@/lib/site/attribution.mjs';
import { recordReferralScan } from '@/lib/site/crm.mjs';

/**
 * Saves where the visitor came from, and reports the visit to the CRM.
 *
 * 1. Every page: the landing URL's agent link, campaign tags and Google Ads
 *    click are saved (lib/site/attribution.mjs), so a later order or lead is
 *    credited to them. This always runs; it only writes to this browser.
 * 2. When `enabled`: a page view and a 15-second heartbeat go to the
 *    catalog's `/api/analytics/track`, which fills the CRM's live visitors
 *    and traffic sources. This is the catalog's own `AnalyticsTracker`,
 *    ported unchanged apart from where it reads the cart and contact details.
 *    The catalog accepts it only from a `*.peptidescostarica.net` origin.
 *
 * `enabled` is the same launch switch as Tag Manager
 * (NEXT_PUBLIC_ALLOW_INDEXING), so test visits never reach the reports.
 */

const VISITOR_COOKIE = 'pcr_visitor_id';
const SESSION_KEY = 'pcr_analytics_session_id';
const CART_KEY = 'pcr_store_cart';
const DETAILS_KEY = 'pcr_store_details';

const randomId = (prefix) => {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${value}`;
};

const readCookie = (name) => {
  const raw = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const getVisitorId = () => {
  const existing = readCookie(VISITOR_COOKIE) || localStorage.getItem(VISITOR_COOKIE);
  if (existing) return existing;
  const created = randomId('visitor');
  const sharedDomain = location.hostname === 'peptidescostarica.net' || location.hostname.endsWith('.peptidescostarica.net');
  document.cookie = `${VISITOR_COOKIE}=${encodeURIComponent(created)}; Max-Age=31536000; Path=/; SameSite=Lax${sharedDomain ? '; Domain=.peptidescostarica.net; Secure' : ''}`;
  localStorage.setItem(VISITOR_COOKIE, created);
  return created;
};

const getSessionId = () => {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = randomId('session');
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
};

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
};

const cartItemCount = () => {
  const cart = readJson(CART_KEY, []);
  return Array.isArray(cart) ? cart.reduce((sum, item) => sum + (Number(item?.qty) || 1), 0) : 0;
};

/** Lets the CRM mark a returning customer; saved by the checkout form. */
const contactHint = () => {
  const details = readJson(DETAILS_KEY, {}) || {};
  return {
    email: typeof details.email === 'string' ? details.email : '',
    phone: typeof details.phone === 'string' ? details.phone : '',
  };
};

/**
 * The last page view sent. Every page renders its own shell, so moving to a
 * new page can mount this twice in quick succession (and React mounts twice
 * in development); one visit to one page must count once in the CRM.
 */
let lastPageView = { key: '', at: 0 };

export default function VisitorTracker({ enabled }) {
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution();
    if (!enabled) return undefined;
    // A QR code or agent / affiliate link: count the landing for the CRM.
    recordReferralScan();

    let base;
    try {
      const params = new URLSearchParams(location.search);
      base = {
        visitorId: getVisitorId(),
        sessionId: getSessionId(),
        hostname: location.hostname,
        path: `${location.pathname}${location.search}`,
        pageTitle: document.title,
        referrer: document.referrer,
        utmSource: params.get('utm_source') || localStorage.getItem(ATTRIBUTION_KEYS.utmSource) || '',
        utmMedium: params.get('utm_medium') || localStorage.getItem(ATTRIBUTION_KEYS.utmMedium) || '',
        utmCampaign: params.get('utm_campaign') || localStorage.getItem(ATTRIBUTION_KEYS.utmCampaign) || '',
        gclid: params.get('gclid') || '',
        fbclid: params.get('fbclid') || '',
      };
    } catch {
      return undefined; // Storage blocked: skip analytics rather than break the page.
    }

    const send = (eventType) => fetch(catalogUrl('/api/analytics/track'), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...base, eventType, contact: contactHint(), cartItems: cartItemCount() }),
    }).catch(() => {});

    const key = `${base.sessionId}|${base.path}`;
    const now = Date.now();
    if (lastPageView.key !== key || now - lastPageView.at > 2000) {
      lastPageView = { key, at: now };
      send('page_view');
    }
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') send('heartbeat');
    }, 15000);
    return () => clearInterval(heartbeat);
  }, [pathname, enabled]);

  return null;
}
