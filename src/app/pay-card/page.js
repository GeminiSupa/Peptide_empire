'use client';
import { stashReceipt } from '@/lib/dataLayer.mjs';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CreditCard, Lock, AlertCircle, CheckCircle2, Wrench } from 'lucide-react';
import { cardCheckoutMessage } from '@/lib/cardCheckoutMessages.mjs';
import { cardDeclineRules } from '@/lib/cardDeclineRules.mjs';
import { areCardPaymentsPausedForClient } from '@/lib/cardPaymentsPaused.mjs';
import { buildWhatsAppLink } from '@/lib/whatsappLink.mjs';
import { useBusinessLinks } from '@/hooks/useBusinessLinks';
import { safeSessionStorage } from '@/lib/storage';
import { SA_STORAGE_KEY, buildShopperApprovedRecord } from '@/lib/shopperApproved.mjs';

// Read once at module scope: this is a build-time constant, and re-reading it
// per render would only invite someone to think it can change mid-session.
const CARD_PAYMENTS_PAUSED = areCardPaymentsPausedForClient();

function formatMoney(value, currency = 'USD') {
  const amount = Number(value || 0);
  if (currency === 'CRC') return `CRC ${Math.round(amount).toLocaleString('en-US')}`;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CardPaymentContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order') || '';
  const token = searchParams.get('token') || '';
  // card (default), ach or crypto — the website's Bank (ACH) and Crypto
  // options land here too, as the catalog checkout's own tiles do.
  const requestedType = String(searchParams.get('type') || '').toLowerCase();
  const payType = requestedType === 'ach' || requestedType === 'crypto' ? requestedType : 'card';
  const { links } = useBusinessLinks();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  // Synchronous double-submit guard. `paying` (React state) updates too late to
  // stop a fast second click, so a ref blocks re-entry the instant submit fires —
  // a repeated charge attempt is what trips the gateway's "attempts allowed" error.
  const submitLockRef = useRef(false);
  const [form, setForm] = useState({ email: '' });
  // The other ways to pay this same order. Which of them staff have switched
  // on is public (the checkout's own tiles read the same route), so the page
  // asks for it directly rather than carrying it on the signed link.
  const [bankMethods, setBankMethods] = useState({ sinpe: false, bank_transfer: false });
  const [switching, setSwitching] = useState('');
  const [switchError, setSwitchError] = useState('');

  const stashShopperApprovedReview = () => {
    if (!order) return;
    try {
      safeSessionStorage.setItem(SA_STORAGE_KEY, JSON.stringify(buildShopperApprovedRecord({
        orderId: order.orderNumber,
        email: order.customerEmail || form.email,
        name: order.customerName,
        // Paid lines only: free items are not products to review.
        products: (order.items || [])
          .filter((item) => Number(item.price) > 0)
          .map((item) => item.product),
      })));
    } catch {
      // A missing survey is not a reason to block payment or confirmation.
    }
  };

  const lang = useMemo(() => (order?.currency === 'CRC' ? 'es' : 'en'), [order?.currency]);
  const isEn = lang === 'en';

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ order: orderNumber, token });
        const res = await fetch(`/api/card-payment-link/order?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Payment link could not be loaded');
        if (cancelled) return;
        setOrder(data.order);
        stashReceipt(data.order.orderNumber, data.analyticsReceiptToken);
        setForm(prev => ({
          ...prev,
          email: data.order.customerEmail || prev.email || '',
        }));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Nothing to load during a pause — the page shows the apology instead of a
    // form, so fetching the order would only put a loading flash in front of it.
    if (CARD_PAYMENTS_PAUSED) {
      setLoading(false);
      return () => {};
    }

    if (!orderNumber || !token) {
      setError('Invalid payment link');
      setLoading(false);
      return () => {};
    }

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderNumber, token]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/bank-payments/settings')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBankMethods({ sinpe: data?.sinpe === true, bank_transfer: data?.bank_transfer === true });
      })
      .catch(() => {
        // Not worth a message: the card form is still there, and the WhatsApp
        // way out below never depends on this.
      });
    return () => { cancelled = true; };
  }, []);

  /**
   * Move this order to SINPE Móvil or bank transfer.
   *
   * The order already exists, so nothing is re-ordered: the server changes the
   * method on this row and hands back the bank link, which carries its token in
   * the hash, exactly as checkout's own bank orders do.
   */
  const switchToBank = async (method) => {
    if (switching) return;
    setSwitching(method);
    setSwitchError('');
    try {
      const res = await fetch('/api/card-payment-link/switch-to-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderNumber, token, method }),
      });
      const data = await res.json();
      if (!res.ok || !data.bankPaymentToken) throw new Error(data.error || (isEn ? 'Could not change the payment method.' : 'No se pudo cambiar el método de pago.'));
      window.location.href = `/pay-bank?lang=${isEn ? 'en' : 'es'}#${encodeURIComponent(data.bankPaymentToken)}`;
    } catch (err) {
      setSwitchError(err.message);
      setSwitching('');
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    if (submitLockRef.current) return; // a charge is already in flight — ignore repeat clicks
    setError('');

    if (!form.email.trim()) {
      setError(isEn ? 'Email is required for the receipt.' : 'El correo es necesario para el recibo.');
      return;
    }

    submitLockRef.current = true;
    setPaying(true);
    // Keep this Costa Peptides tab on the recovery instructions while Chargex
    // handles the card in a separate tab. Chargex can reject an invalid card
    // without returning to us, so this is the only reliable browser-side exit.
    // Card only, as in the catalog checkout: ACH and crypto open in this tab.
    const hostedPaymentWindow = payType === 'card' ? window.open('', '_blank') : null;
    if (hostedPaymentWindow) {
      hostedPaymentWindow.document.title = isEn ? 'Opening secure payment…' : 'Abriendo pago seguro…';
      hostedPaymentWindow.document.body.textContent = isEn
        ? 'Opening the secure card page…'
        : 'Abriendo la página segura de pago…';
    }
    try {
      const res = await fetch('/api/card-payment-link/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          token,
          lang,
          customerEmail: form.email.trim(),
          payType,
        }),
      });
      const data = await res.json();

      if (data.paymentUrl) {
        // The gateway returns straight to /thank-you. Leave the review record
        // in this tab before it departs, just as the catalog checkout does.
        stashShopperApprovedReview();
        if (hostedPaymentWindow && !hostedPaymentWindow.closed) {
          hostedPaymentWindow.opener = null;
          hostedPaymentWindow.location.href = data.paymentUrl;
          window.location.href = data.recoveryUrl
            || `/payment-help?order=${encodeURIComponent(orderNumber)}&reason=3ds&lang=${encodeURIComponent(lang)}`;
        } else {
          window.location.href = data.paymentUrl;
        }
        return;
      }

      if (!res.ok || !data.ok) {
        hostedPaymentWindow?.close();
        if (data.recoveryUrl) {
          window.location.href = data.recoveryUrl;
          return;
        }
        throw new Error(data.error || (isEn ? 'Card payment failed' : 'El pago con tarjeta falló'));
      }

      hostedPaymentWindow?.close();
      setPaid(true);
    } catch (err) {
      hostedPaymentWindow?.close();
      setError(err.message);
    } finally {
      setPaying(false);
      submitLockRef.current = false; // released so a genuine retry (e.g. new card) can proceed
    }
  };

  return (
    <main className="card-pay-page">
      <section className="card-pay-shell">
        <div className="card-pay-brand">
          <img src="/logo.png" alt="Peptides Costa Rica" />
          <span>
            {payType === 'ach'
              ? (isEn ? 'Secure bank payment (ACH)' : 'Pago bancario seguro (ACH)')
              : payType === 'crypto'
                ? (isEn ? 'Secure crypto payment' : 'Pago seguro con cripto')
                : (isEn ? 'Secure card payment' : 'Pago seguro con tarjeta')}
          </span>
        </div>

        {/* First branch in the chain on purpose. A link that arrived before the
            pause began is still a valid, signed link, so without this the
            customer would be shown a working-looking card form and only find
            out at submit time. Both languages, because the order is never
            loaded during a pause and isEn has nothing to go on. */}
        {CARD_PAYMENTS_PAUSED ? (
          <div className="card-pay-panel card-pay-message">
            <Wrench size={28} />
            <h1>Pagos con tarjeta en mantenimiento</h1>
            <p>{cardCheckoutMessage('paused', 'es').message}</p>
            <h2 style={{ fontSize: '1rem', marginTop: '18px' }}>Card payments under maintenance</h2>
            <p>{cardCheckoutMessage('paused', 'en').message}</p>

            {/* The order already exists and is already agreed — this customer
                only needs a way to pay it. So the way out is a message that
                names the order, not a trip back to the catalog to start over. */}
            <a
              className="whatsapp-btn card-paused-whatsapp"
              href={buildWhatsAppLink(
                links.whatsappNumber,
                orderNumber
                  ? `Hola / Hi! Order #${orderNumber} — quiero pagar por otro medio / I would like to pay by another method.`
                  : 'Hola / Hi! Quiero pagar mi pedido por otro medio / I would like to pay for my order by another method.',
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              Pagar por WhatsApp / Pay via WhatsApp
            </a>

            <Link href="/catalog">Volver al catálogo / Return to catalog</Link>
          </div>
        ) : loading ? (
          <div className="card-pay-panel">
            <p className="card-pay-muted">{isEn ? 'Loading payment link...' : 'Cargando enlace de pago...'}</p>
          </div>
        ) : error && !order ? (
          <div className="card-pay-panel card-pay-message">
            <AlertCircle size={28} />
            <h1>{isEn ? 'Payment link unavailable' : 'Enlace de pago no disponible'}</h1>
            <p>{error}</p>
            <Link href="/catalog">{isEn ? 'Return to catalog' : 'Volver al catálogo'}</Link>
          </div>
        ) : paid ? (
          <div className="card-pay-panel card-pay-message card-pay-success">
            <CheckCircle2 size={34} />
            <h1>{isEn ? 'Payment received' : 'Pago recibido'}</h1>
            <p>
              {isEn
                ? `Thank you. Your payment for order ${order.orderNumber} was approved.`
                : `Gracias. Su pago para la orden ${order.orderNumber} fue aprobado.`}
            </p>
            <Link
              href={`/thank-you?lang=${lang}&order=${encodeURIComponent(order.orderNumber)}`}
              onClick={stashShopperApprovedReview}
            >
              {isEn ? 'View confirmation' : 'Ver confirmación'}
            </Link>
          </div>
        ) : (
          <div className="card-pay-grid">
            <aside className="card-pay-panel card-pay-summary">
              <p className="card-pay-kicker">{isEn ? 'Order summary' : 'Resumen de orden'}</p>
              <h1>#{order.orderNumber}</h1>
              <div className="card-pay-customer">{order.customerName || (isEn ? 'Customer' : 'Cliente')}</div>
              <div className="card-pay-items">
                {(order.items || []).map((item, index) => (
                  <div key={`${item.product}-${index}`}>
                    <span>{item.product}</span>
                    <strong>x{item.qty}</strong>
                  </div>
                ))}
              </div>
              <div className="card-pay-total-row">
                <span>
                  {payType === 'card'
                    ? (isEn ? 'Card charge' : 'Cargo a tarjeta')
                    : (isEn ? 'Amount to pay' : 'Monto a pagar')}
                </span>
                <strong>{formatMoney(order.cardAmountUsd, 'USD')}</strong>
              </div>
              {order.currency === 'CRC' && (
                <p className="card-pay-muted">
                  {isEn ? 'Order total' : 'Total de la orden'}: {formatMoney(order.totalCrc, 'CRC')}
                </p>
              )}
              {payType === 'card' && (<>
              <p className="card-pay-note">
                <Lock size={14} />
                {isEn
                  ? 'Card details are processed by Chargex and are not stored by Costa Peptides.'
                  : 'Los datos de tarjeta son procesados por Chargex y no se almacenan en Costa Peptides.'}
              </p>
              <div className="card-pay-statement-notice">
                <p className="card-pay-statement-notice__heading">
                  🏦 {isEn ? 'What you will see on your statement:' : 'Lo que verás en tu estado de cuenta:'}
                </p>
                <ul className="card-pay-statement-notice__list">
                  <li>
                    {isEn
                      ? <>Charged in <strong>US dollars</strong> by Chargex. Your order stays with us in Costa Rica.</>
                      : <>Se cobra en <strong>dólares</strong> a través de Chargex. Tu pedido sigue con nosotros en Costa Rica.</>}
                  </li>
                  <li>
                    {isEn
                      ? <>Statement name: <strong>&ldquo;Agile disruptive tech&rdquo;</strong> — this is our payment processor. <strong>Do not dispute</strong> this charge.</>
                      : <>Nombre en el estado de cuenta: <strong>&ldquo;Agile disruptive tech&rdquo;</strong> — este es nuestro procesador de pagos. <strong>No disputes</strong> este cargo.</>}
                  </li>
                </ul>
              </div>
              {/* Bank declines: 3 tries, call the bank after the first, then
                  a 1-hour block (cardDeclineRules.mjs). */}
              <div className="card-pay-statement-notice card-decline-rules">
                <p className="card-pay-statement-notice__heading">
                  ⚠️ {cardDeclineRules(lang).title}
                </p>
                <ul className="card-pay-statement-notice__list">
                  {cardDeclineRules(lang).lines.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
              </>)}
            </aside>

            <form className="card-pay-panel card-pay-form" onSubmit={submitPayment}>
              <div className="card-pay-form-title">
                <CreditCard size={20} />
                <h2>{isEn ? 'Pay on Chargex' : 'Pagar en Chargex'}</h2>
              </div>
              <p className="card-pay-muted">
                {payType === 'ach'
                  ? (isEn
                    ? 'The next page is Chargex, our payment processor. You enter your US bank account details there. We never see them.'
                    : 'La siguiente página es Chargex, nuestro procesador de pagos. Ahí escribe los datos de su cuenta bancaria de EE. UU. Nosotros nunca los vemos.')
                  : payType === 'crypto'
                    ? (isEn
                      ? 'The next page is Chargex, our payment processor. You send the crypto payment from there. We never handle your wallet.'
                      : 'La siguiente página es Chargex, nuestro procesador de pagos. Desde ahí envía el pago en cripto. Nosotros nunca manejamos su billetera.')
                    : (isEn
                      ? 'The next page is Chargex. You enter the card there. We never see the card number.'
                      : 'La siguiente página es Chargex. Ahí escribe la tarjeta. Nosotros nunca vemos el número.')}
              </p>
              <label>
                <span>{isEn ? 'Email for receipt' : 'Correo para recibo'}</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </label>

              {error && (
                <div className="card-pay-error">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button type="submit" disabled={paying}>
                {paying
                  ? (isEn ? 'Processing...' : 'Procesando...')
                  : (isEn ? `Continue to pay ${formatMoney(order.cardAmountUsd, 'USD')}` : `Continuar a pagar ${formatMoney(order.cardAmountUsd, 'USD')}`)}
              </button>

              {/* Another way to pay the order that already exists.
                  Without this the page was a dead end: one button, and a
                  customer who wanted SINPE or a transfer could only go back and
                  order again, leaving the first order "Pending - Card" for
                  staff to clean up. It sits inside the payment panel, right
                  under the button: below the notices it was off the screen,
                  and nobody scrolls for a payment method (Omer, 18 Nov 2026). */}
              <div className="card-pay-switch">
                <p className="card-pay-switch-title">
                  {isEn ? 'Or pay another way — your order is saved' : 'O pague de otra forma — su pedido está guardado'}
                </p>
                {switchError && (
                  <div className="card-pay-error">
                    <AlertCircle size={16} />
                    {switchError}
                  </div>
                )}
                <div className="card-pay-switch-row">
                  {bankMethods.sinpe && (
                    <button type="button" disabled={Boolean(switching)} onClick={() => switchToBank('sinpe')}>
                      {switching === 'sinpe' ? (isEn ? 'Switching…' : 'Cambiando…') : 'SINPE Móvil'}
                    </button>
                  )}
                  {bankMethods.bank_transfer && (
                    <button type="button" disabled={Boolean(switching)} onClick={() => switchToBank('bank_transfer')}>
                      {switching === 'bank_transfer'
                        ? (isEn ? 'Switching…' : 'Cambiando…')
                        : (isEn ? 'Bank transfer' : 'Transferencia bancaria')}
                    </button>
                  )}
                  <a
                    className="whatsapp-btn"
                    href={buildWhatsAppLink(
                      links.whatsappNumber,
                      isEn
                        ? `Hi! Order #${order.orderNumber} — I would like to pay by another method.`
                        : `¡Hola! Pedido #${order.orderNumber} — quiero pagar por otro medio.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

export default function CardPaymentPage() {
  return (
    <Suspense fallback={<main className="card-pay-page"><section className="card-pay-shell"><div className="card-pay-panel">Loading...</div></section></main>}>
      <CardPaymentContent />
    </Suspense>
  );
}
