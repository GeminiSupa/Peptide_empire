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
  useEffect(() => {
    if (!load || document.getElementById('gtm-loader')) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const script = document.createElement('script');
    script.id = 'gtm-loader';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.appendChild(script);
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
