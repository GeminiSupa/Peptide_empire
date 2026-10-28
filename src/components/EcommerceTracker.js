'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { captureAdClick } from '@/lib/adClickAttribution.mjs';
import { pushEvent, whatsappLocation, WHATSAPP_LOCATIONS } from '@/lib/dataLayer.mjs';
export default function EcommerceTracker() {
  const path = usePathname();
  useEffect(() => { if (!/^\/(admin|embed)(\/|$)/.test(path || '')) captureAdClick(window.location, document); }, [path]);
  useEffect(() => {
    function click(event) {
      if (/^\/(admin|embed)(\/|$)/.test(window.location.pathname)) return;
      const target = event.target?.closest?.('a,button,[data-whatsapp-location]');
      if (!target || target.dataset.whatsappOrder === 'true') return;
      const href = target.getAttribute('href') || '';
      const explicit = target.dataset.whatsappLocation;
      if (!explicit && !/^(?:https?:\/\/(wa\.me|wa\.link|api\.whatsapp\.com|web\.whatsapp\.com)\/|whatsapp:\/\/)/i.test(href)) return;
      if (target.dataset.whatsappShare === 'true') return;
      const location = WHATSAPP_LOCATIONS.has(explicit) ? explicit : whatsappLocation({ path: window.location.pathname, text: target.textContent, hint: target.getAttribute('aria-label') || target.id });
      pushEvent({ event: 'whatsapp_click', click_location: location, ...(target.closest('[data-analytics-item-id]')?.dataset.analyticsItemId ? { item_id: target.closest('[data-analytics-item-id]').dataset.analyticsItemId } : {}) });
    }
    document.addEventListener('click', click, true); return () => document.removeEventListener('click', click, true);
  }, []);
  return null;
}
