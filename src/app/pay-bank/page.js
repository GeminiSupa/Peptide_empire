'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function BankPaymentPage() {
  const [token, setToken] = useState('');
  const [en, setEn] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [payer, setPayer] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  async function load(paymentToken, action, fields = {}) {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/bank-payments/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: paymentToken, action, ...fields }) });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setData(result);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const value = decodeURIComponent(window.location.hash.slice(1));
    setEn(new URLSearchParams(window.location.search).get('lang') === 'en');
    setToken(value);
    if (value) load(value); else setError('Payment link missing / Falta el enlace de pago');
  }, []);
  async function copy(value) {
    try { await navigator.clipboard.writeText(String(value)); setCopied(String(value)); }
    catch { setError(en ? 'Please select and copy the value manually.' : 'Seleccione y copie el dato manualmente.'); }
  }
  const p = data?.payment;
  return <main style={{ maxWidth: 640, margin: '40px auto', padding: 24, lineHeight: 1.6 }}>
    <h1>{en ? 'Pay your order' : 'Pagar su pedido'} · BAC</h1>
    <p>{en ? 'Your order is saved. Payment is confirmed after we verify receipt in BAC.' : 'Su pedido está guardado. El pago se confirma después de verificar los fondos en BAC.'}</p>
    {busy && <p role="status">{en ? 'Loading…' : 'Cargando…'}</p>}
    {error && <p role="alert">{error}</p>}
    {p && <>
      <h2>{p.method === 'sinpe' ? 'SINPE Móvil' : (en ? 'Bank transfer' : 'Transferencia bancaria')}</h2>
      <p><strong>{en ? 'Order' : 'Pedido'}: {p.reference}</strong></p>
      <p role="status">{en ? 'Order status' : 'Estado del pedido'}: {data.status}</p>
      {data.awaitingPayment && <>
        <p>{en ? 'Send the exact amount in colones from your banking app. Include the order number in the transfer description.' : 'Envíe el monto exacto en colones desde su aplicación bancaria. Incluya el número de pedido en el detalle de la transferencia.'}</p>
        <dl>{[
          [en ? 'Recipient' : 'Beneficiario', p.recipient],
          [en ? 'Legal ID' : 'Cédula jurídica', p.legalId],
          [p.method === 'sinpe' ? 'SINPE Móvil' : 'IBAN CRC', p.destination],
          [en ? 'Amount (CRC)' : 'Monto (CRC)', p.amount],
          [en ? 'Payment description' : 'Detalle del pago', p.reference],
        ].map(([label, value]) => <div key={label} style={{ padding: '12px 0', borderBottom: '1px solid #aaa' }}><dt>{label}</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}><strong>{label.includes('(CRC)') ? `₡${Number(value).toLocaleString()}` : value}</strong>{' '}<button type="button" onClick={() => copy(value)}>{copied === String(value) ? (en ? 'Copied' : 'Copiado') : (en ? 'Copy' : 'Copiar')}</button></dd></div>)}</dl>
        {data.reported ? <p role="status">{en ? 'Payment reported. We will verify receipt in BAC before confirming your payment. Please do not send another payment.' : 'Pago reportado. Verificaremos los fondos en BAC antes de confirmar su pago. No envíe otro pago.'}</p> : <form onSubmit={e => { e.preventDefault(); load(token, 'report', { reference, payer }); }} style={{ display: 'grid', gap: 16 }}>
          <label>{en ? 'Name of the person who paid' : 'Nombre de quien realizó el pago'}<input required maxLength={120} value={payer} onChange={e => setPayer(e.target.value)} style={{ display: 'block', width: '100%', padding: 12 }} /></label>
          <label>{en ? 'Bank transaction reference' : 'Número de referencia bancaria'}<input required maxLength={100} value={reference} onChange={e => setReference(e.target.value)} style={{ display: 'block', width: '100%', padding: 12 }} /></label>
          <button disabled={busy}>{en ? 'I have sent the payment' : 'Ya realicé el pago'}</button>
        </form>}
      </>}
      <button disabled={busy} onClick={() => load(token)} style={{ marginTop: 20 }}>{en ? 'Refresh payment status' : 'Actualizar estado del pago'}</button>
    </>}
    <p><Link href="/catalog">{en ? 'Back to catalog' : 'Volver al catálogo'}</Link></p>
  </main>;
}
