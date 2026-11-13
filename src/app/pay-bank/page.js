'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, BadgeCheck, Building2, Check, CircleAlert, Clock3, Copy, LoaderCircle, RefreshCw, Send, ShieldCheck, Smartphone } from 'lucide-react';
import styles from './pay-bank.module.css';
import { safeSessionStorage } from '@/lib/storage';
import { SA_STORAGE_KEY, buildShopperApprovedRecord } from '@/lib/shopperApproved.mjs';

function formatMoney(amount, currency) {
  return `${currency === 'USD' ? '$' : '₡'}${Number(amount).toLocaleString(currency === 'USD' ? 'en-US' : 'es-CR', { minimumFractionDigits: currency === 'USD' ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function formatSinpe(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : value;
}

export default function BankPaymentPage() {
  const [token, setToken] = useState('');
  const [en, setEn] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [payer, setPayer] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  function stashShopperApprovedReview(result = data) {
    if (!result?.review) return;
    try {
      safeSessionStorage.setItem(SA_STORAGE_KEY, JSON.stringify(buildShopperApprovedRecord(result.review)));
    } catch {
      // A missing survey is not a reason to block payment or confirmation.
    }
  }

  async function load(paymentToken, action, fields = {}) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/bank-payments/order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: paymentToken, action, ...fields }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
      return result;
    } catch (loadError) {
      setError(loadError.message);
      return null;
    } finally { setBusy(false); }
  }

  useEffect(() => {
    const value = decodeURIComponent(window.location.hash.slice(1));
    setEn(new URLSearchParams(window.location.search).get('lang') === 'en');
    setToken(value);
    if (value) load(value); else setError('Payment link missing / Falta el enlace de pago');
  }, []);

  async function copy(value, key) {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1800);
    } catch { setError(en ? 'Please select and copy the value manually.' : 'Seleccione y copie el dato manualmente.'); }
  }

  async function reportPayment(event) {
    event.preventDefault();
    const result = await load(token, 'report', { reference, payer });
    if (result?.reported) {
      stashShopperApprovedReview(result);
      window.location.href = `/thank-you?lang=${en ? 'en' : 'es'}&order=${encodeURIComponent(result.payment.reference)}&payment=bank_reported`;
    }
  }

  const payment = data?.payment;
  const isSinpe = payment?.method === 'sinpe';
  const copyRows = payment ? [
    { key: 'recipient', label: en ? 'Recipient' : 'Beneficiario', value: payment.recipient, display: payment.recipient },
    ...(payment.legalId ? [{ key: 'legal-id', label: en ? 'Legal ID' : 'Cédula jurídica', value: payment.legalId, display: payment.legalId }] : []),
    ...(payment.accountNumber ? [{ key: 'account', label: en ? `BAC account (${payment.currency})` : `Cuenta BAC (${payment.currency})`, value: payment.accountNumber, display: payment.accountNumber }] : []),
    { key: 'destination', label: isSinpe ? 'SINPE Móvil' : `IBAN ${payment.currency}`, value: payment.destination, display: isSinpe ? formatSinpe(payment.destination) : payment.destination, featured: true },
    { key: 'amount', label: en ? `Exact amount (${payment.currency})` : `Monto exacto (${payment.currency})`, value: payment.amount, display: formatMoney(payment.amount, payment.currency), featured: true },
    { key: 'detail', label: en ? 'Payment description' : 'Detalle del pago', value: payment.reference, display: payment.reference },
  ] : [];

  return (
    <main className={`${styles.page} ${isSinpe ? styles.sinpe : styles.transfer}`}>
      <div className={styles.glowOne} /><div className={styles.glowTwo} />
      <header className={styles.header}>
        <Link href="/catalog" className={styles.brand} aria-label={en ? 'Back to catalog' : 'Volver al catálogo'}><Image src="/catalog-logo.webp" alt="Peptides Costa Rica" width={210} height={60} priority /></Link>
        <div className={styles.securePill}><ShieldCheck size={16} /> {en ? 'Secure instructions' : 'Instrucciones seguras'}</div>
      </header>

      <div className={styles.shell}>
        <aside className={styles.intro}>
          <div className={styles.methodIcon}>{isSinpe ? <Smartphone size={30} /> : <Building2 size={30} />}</div>
          <p className={styles.eyebrow}>{isSinpe ? 'SINPE MÓVIL' : (en ? 'BANK TRANSFER' : 'TRANSFERENCIA BANCARIA')}</p>
          <h1>{en ? 'Complete your payment' : 'Complete su pago'}</h1>
          <p className={styles.lead}>{en ? 'Pay from your preferred bank. Your order is reserved while you send us the confirmation for verification.' : 'Pague desde el banco de su preferencia. Su pedido está reservado mientras nos envía la confirmación para verificarla.'}</p>
          <ol className={styles.steps}>
            <li><span>1</span><div><strong>{en ? 'Send the exact amount' : 'Envíe el monto exacto'}</strong><small>{en ? 'Use the payment details shown here.' : 'Use los datos de pago indicados.'}</small></div></li>
            <li><span>2</span><div><strong>{en ? 'Keep your reference' : 'Guarde la referencia'}</strong><small>{en ? 'Find it on your bank confirmation.' : 'La encontrará en el comprobante bancario.'}</small></div></li>
            <li><span>3</span><div><strong>{en ? 'Report your payment' : 'Reporte su pago'}</strong><small>{en ? 'We verify it in the receiving account.' : 'Lo verificamos en la cuenta receptora.'}</small></div></li>
          </ol>
          <div className={styles.trustNote}><Clock3 size={19} /><p><strong>{en ? 'Manual verification' : 'Verificación manual'}</strong><span>{en ? 'Your order is confirmed as paid after the funds reach our receiving account.' : 'Su pedido se confirma como pagado cuando los fondos llegan a nuestra cuenta receptora.'}</span></p></div>
        </aside>

        <section className={styles.card} aria-live="polite">
          {busy && !payment && <div className={styles.centerState}><LoaderCircle className={styles.spinner} size={34} /><p>{en ? 'Loading payment details…' : 'Cargando datos de pago…'}</p></div>}
          {error && <div className={styles.error} role="alert"><CircleAlert size={19} /><span>{error}</span></div>}
          {payment && <>
            <div className={styles.cardHead}><div><p>{en ? 'ORDER' : 'PEDIDO'}</p><h2>#{payment.reference}</h2></div><span className={styles.status}><span />{data.status}</span></div>
            {data.awaitingPayment ? <>
              <div className={styles.amountHero}><span>{en ? 'Amount to send' : 'Monto a enviar'}</span><strong>{formatMoney(payment.amount, payment.currency)}</strong><small>{payment.currency} · {isSinpe ? 'SINPE Móvil' : 'BAC'}</small></div>
              <p className={styles.instruction}>{en ? `Send the exact amount in ${payment.currency === 'USD' ? 'US dollars' : 'colones'} and use the order number as the payment description.` : `Envíe el monto exacto en ${payment.currency === 'USD' ? 'dólares' : 'colones'} y use el número de pedido como detalle del pago.`}</p>
              <dl className={styles.details}>{copyRows.map((row) => <div key={row.key} className={row.featured ? styles.featuredRow : ''}><dt>{row.label}</dt><dd><span>{row.display}</span><button type="button" onClick={() => copy(row.value, row.key)} aria-label={`${en ? 'Copy' : 'Copiar'} ${row.label}`}>{copied === row.key ? <Check size={17} /> : <Copy size={17} />}<em>{copied === row.key ? (en ? 'Copied' : 'Copiado') : (en ? 'Copy' : 'Copiar')}</em></button></dd></div>)}</dl>
              {data.reported ? <div className={styles.reported}><BadgeCheck size={35} /><div><strong>{en ? 'Payment already reported' : 'Pago ya reportado'}</strong><p>{en ? 'We are checking the receiving account. Please do not send another payment.' : 'Estamos verificando la cuenta receptora. No envíe otro pago.'}</p></div><Link onClick={() => stashShopperApprovedReview()} href={`/thank-you?lang=${en ? 'en' : 'es'}&order=${encodeURIComponent(payment.reference)}&payment=bank_reported`}>{en ? 'Continue' : 'Continuar'}</Link></div> :
                <form className={styles.form} onSubmit={reportPayment}>
                  <div className={styles.formTitle}><BadgeCheck size={22} /><div><strong>{en ? 'I made the payment' : 'Ya realicé el pago'}</strong><p>{en ? 'Enter the details from your receipt.' : 'Ingrese los datos de su comprobante.'}</p></div></div>
                  <label>{en ? 'Name of the person who paid' : 'Nombre de quien realizó el pago'}<input required autoComplete="name" maxLength={120} value={payer} onChange={(event) => setPayer(event.target.value)} placeholder={en ? 'Full name' : 'Nombre completo'} /></label>
                  <label>{en ? 'Bank transaction reference' : 'Número de referencia bancaria'}<input required maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} placeholder={en ? 'Reference from your receipt' : 'Referencia del comprobante'} /></label>
                  <button className={styles.primaryButton} disabled={busy}>{busy ? <LoaderCircle className={styles.spinner} size={19} /> : <Send size={18} />}{busy ? (en ? 'Sending…' : 'Enviando…') : (en ? 'Confirm payment sent' : 'Confirmar pago enviado')}</button>
                  <p className={styles.privacy}><ShieldCheck size={14} />{en ? 'We only use these details to match your payment.' : 'Solo usamos estos datos para identificar su pago.'}</p>
                </form>}
              <button className={styles.refresh} disabled={busy} onClick={() => load(token)}><RefreshCw size={15} />{en ? 'Refresh payment status' : 'Actualizar estado del pago'}</button>
            </> : <div className={styles.reported}><BadgeCheck size={35} /><div><strong>{en ? 'Payment status updated' : 'Estado de pago actualizado'}</strong><p>{en ? 'Continue to your order confirmation.' : 'Continúe a la confirmación de su pedido.'}</p></div><Link onClick={() => stashShopperApprovedReview()} href={`/thank-you?lang=${en ? 'en' : 'es'}&order=${encodeURIComponent(payment.reference)}`}>{en ? 'View confirmation' : 'Ver confirmación'}</Link></div>}
          </>}
        </section>
      </div>
      <footer className={styles.footer}><Link href="/catalog"><ArrowLeft size={15} />{en ? 'Back to catalog' : 'Volver al catálogo'}</Link><span>Peptides Costa Rica · {en ? 'Secure payment' : 'Pago seguro'}</span></footer>
    </main>
  );
}
