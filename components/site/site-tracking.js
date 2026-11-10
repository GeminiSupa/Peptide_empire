'use client';

import { useEffect, useState } from 'react';
import { pushEvent, whatsappLocation } from '@/lib/site/analytics.mjs';
import { onCompanyDomain } from '@/lib/site/crm.mjs';

/** The Google Tag Manager container the catalog already reports to. */
export const GTM_ID = 'GTM-M2GVDQ44';

const WHATSAPP_LINK = /^(?:https?:\/\/(wa\.me|wa\.link|api\.whatsapp\.com|web\.whatsapp\.com)\/|whatsapp:\/\/)/i;

/**
 * Google Tag Manager, and the catalog's `whatsapp_click` event.
 *
 * The container loads on the company domain (new.peptidescostarica.net now,
 * peptidescostarica.net after the move), or anywhere when `enabled`
 * (NEXT_PUBLIC_ALLOW_INDEXING). Localhost and *.vercel.app previews never
 * load it, so they never reach the reports; their events still go to
 * `dataLayer`, where GTM's preview mode can inspect them. Decided after
 * mount, so the server and browser render the same markup.
 */
export default function SiteTracking({ enabled }) {
  const [load, setLoad] = useState(Boolean(enabled));
  useEffect(() => {
    if (!enabled && onCompanyDomain()) setLoad(true);
  }, [enabled]);

  useEffect(() => {
    const onClick = (event) => {
      const link = event.target?.closest?.('a');
      const href = link?.getAttribute('href') || '';
      if (!WHATSAPP_LINK.test(href)) return;
      pushEvent({
        event: 'whatsapp_click',
        click_location: whatsappLocation({ path: window.location.pathname, text: link.textContent }),
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // The container, added the way Google's own snippet adds it. Injected here
  // rather than through next/script: switched on after mount (the company
  // domain is known only in the browser), next/script's lazyOnload never
  // fired, so the tag silently never loaded.
  //
  // Held back until the visitor does something, or FALLBACK_MS passes.
  // The container (GTM + the GA4 and Google Ads tags inside it, plus Clarity)
  // is 519 KB and occupied the main thread for ~990 ms on a mid-range phone —
  // essentially all of the page's 900 ms Total Blocking Time, while the site's
  // own JavaScript was not the problem. Loading it a moment later costs
  // nothing: events raised before it arrives sit in `dataLayer` and GTM
  // processes the queue on load, so no `add_to_cart`, `begin_checkout` or
  // conversion is lost — they all follow an interaction anyway.
  //
  // What it does cost: a visitor who opens a page and leaves within
  // FALLBACK_MS without scrolling, tapping or typing is never counted in GA4.
  // Scrolling counts, so this is a small slice of real traffic, but GA4's
  // session and pageview totals may read slightly lower than before. Raise
  // FALLBACK_MS to trade speed back for more of those visits, or set it to 0
  // to load the container immediately as it used to.
  useEffect(() => {
    if (!load || document.getElementById('gtm-loader')) return undefined;
    window.dataLayer = window.dataLayer || [];

    const FALLBACK_MS = 5000;
    const WAKE = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    let timer;
    let started = false;

    const stopWaiting = () => {
      WAKE.forEach((name) => window.removeEventListener(name, startGtm));
      window.clearTimeout(timer);
    };

    function startGtm() {
      if (started) return;
      started = true;
      stopWaiting();
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      const script = document.createElement('script');
      script.id = 'gtm-loader';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
      document.head.appendChild(script);
    }

    WAKE.forEach((name) => window.addEventListener(name, startGtm, { once: true, passive: true }));
    timer = window.setTimeout(startGtm, FALLBACK_MS);
    return stopWaiting;
  }, [load]);

  if (!load) return null;
  return (
    <noscript>
      <iframe
        title="Google Tag Manager"
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
