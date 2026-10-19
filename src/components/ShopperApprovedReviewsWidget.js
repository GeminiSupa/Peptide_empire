'use client';

import { useEffect } from 'react';
import { shopperApprovedReviewPageScriptUrl } from '@/lib/shopperApproved.mjs';

/**
 * Shopper Approved's store reviews list for /reviews.
 *
 * Site id and preset come from the server. Their script paints into
 * #SA_review_wrapper.
 */
export default function ShopperApprovedReviewsWidget({ siteId, preset = 'default' }) {
  useEffect(() => {
    const src = shopperApprovedReviewPageScriptUrl(siteId, preset);
    if (!src) return undefined;

    window.sa_interval = 5000;
    if (typeof window.shopper_first !== 'undefined') {
      // Already loaded on this page (Strict Mode remount / navigated back).
      return undefined;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
    window.shopper_first = true;

    return () => {
      script.remove();
      try {
        delete window.shopper_first;
      } catch {
        window.shopper_first = undefined;
      }
    };
  }, [siteId, preset]);

  return (
    <div id="SA_review_wrapper" className="shopper-approved-reviews">
      {/* Their script fills this. Non-breaking space keeps some CMS sanitizers
          from stripping an empty div. */}
      {'\u00a0'}
    </div>
  );
}
