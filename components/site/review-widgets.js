'use client';

import { useEffect } from 'react';

/**
 * Shopper Approved's live rotating review widget: the vendor's own script and
 * markup. The site's review scores are drawn by components/site/review-bar.js.
 */

const SHOPPER_APPROVED_SCRIPT = 'https://www.shopperapproved.com/widgets/42340/merchant/rotating-widget/default.js';

/**
 * Shopper Approved's rotating review widget. It renders into the element with
 * id `SA_wrapper_default`, so a page shows at most one.
 */
export function ShopperRotating({ lang = 'en' }) {
  useEffect(() => {
    window.sa_interval = 5000;
    document.querySelectorAll('script[data-sa]').forEach((script) => script.remove());
    const script = document.createElement('script');
    // No cache-busting query: it made every visitor re-download the widget on
    // every page (Lighthouse's "use efficient cache lifetimes"). Appending the
    // element re-runs the script whether or not it came from the cache, which
    // is all the remount needs.
    script.src = SHOPPER_APPROVED_SCRIPT;
    script.async = true;
    script.dataset.sa = '1';
    document.head.appendChild(script);
  }, []);
  return (
    <div className="sawrap">
      <div id="SA_wrapper_default" className="SA__wrapper" lang={lang} />
    </div>
  );
}
