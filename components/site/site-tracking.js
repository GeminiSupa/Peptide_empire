'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { pushEvent, whatsappLocation } from '@/lib/site/analytics.mjs';

/** The Google Tag Manager container the catalog already reports to. */
export const GTM_ID = 'GTM-M2GVDQ44';

const WHATSAPP_LINK = /^(?:https?:\/\/(wa\.me|wa\.link|api\.whatsapp\.com|web\.whatsapp\.com)\/|whatsapp:\/\/)/i;

/**
 * Google Tag Manager, and the catalog's `whatsapp_click` event.
 *
 * `enabled` is the launch switch (NEXT_PUBLIC_ALLOW_INDEXING): until the real
 * domain points here, the container is not loaded, so previews and test
 * visits never reach the reports. The events are still pushed to
 * `dataLayer`, where GTM's preview mode can inspect them.
 */
export default function SiteTracking({ enabled }) {
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

  if (!enabled) return null;
  return (
    <>
      <noscript>
        <iframe
          title="Google Tag Manager"
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
      <Script id="gtm" strategy="lazyOnload">
        {`window.dataLayer=window.dataLayer||[];(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
    </>
  );
}
