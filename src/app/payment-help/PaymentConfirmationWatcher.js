"use client";

import { useEffect } from 'react';
import { pushReceiptOnce } from '@/lib/dataLayer.mjs';

export default function PaymentConfirmationWatcher({ orderNumber, lang }) {
  useEffect(() => {
    if (!/^[A-Za-z0-9-]{6,64}$/.test(orderNumber || '')) return undefined;

    let token;
    try { token = sessionStorage.getItem(`pcr_receipt:${orderNumber}`); } catch { return undefined; }
    if (!token) return undefined;

    let stopped = false;
    let timer;
    let attempts = 0;
    const retry = () => {
      if (!stopped && ++attempts < 120) timer = setTimeout(checkPayment, 5000);
    };

    async function checkPayment() {
      try {
        const response = await fetch('/api/analytics/order-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (stopped) return;
        if (!response.ok) { if (response.status >= 500) retry(); return; }

        const result = await response.json();
        const events = result.events?.length ? result.events : result.event ? [result.event] : [];
        const paidCard = events.find((event) => event.event === 'purchase' && event.payment_type === 'card');
        if (paidCard) {
          // localStorage is shared with the Chargex return window. Whichever
          // window sees the confirmed payment first records the conversion;
          // the other one is deduplicated by transaction id.
          pushReceiptOnce(paidCard, localStorage);
          window.location.replace(`/thank-you?lang=${encodeURIComponent(lang)}&order=${encodeURIComponent(orderNumber)}&payment=card`);
          return;
        }
        if (result.pending) retry();
      } catch { retry(); }
    }

    checkPayment();
    return () => { stopped = true; clearTimeout(timer); };
  }, [lang, orderNumber]);

  return null;
}
