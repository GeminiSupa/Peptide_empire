'use client';

import { trackLead } from '@/lib/dataLayer.mjs';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AccountShell from '../AccountShell';
import { useCustomerSession, useStorefrontLang } from '@/hooks/useCustomerSession';
import { getCustomerAccessToken } from '@/lib/customerSupabase';
import { BUSINESS_REFERRAL_STORAGE_KEY } from '@/lib/businessHandoff.mjs';

const FIELDS = [
  ['legal_name', 'Legal company name', 'Razón social'],
  ['trading_name', 'Trading name (optional)', 'Nombre comercial (opcional)'],
  ['corporation_number', 'Corporation number · cédula jurídica', 'Cédula jurídica'],
  ['contact_name', 'Contact person', 'Persona de contacto'],
  ['phone', 'Business phone', 'Teléfono de la empresa'],
  ['billing_address', 'Billing address', 'Dirección de facturación'],
  ['delivery_address', 'Delivery address (optional)', 'Dirección de entrega (opcional)'],
];

export default function BusinessAccountPage() {
  const { user } = useCustomerSession();
  const [lang] = useStorefrontLang();
  const en = lang === 'en';
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [values, setValues] = useState({});
  const [referral,setReferral]=useState('');
  useEffect(()=>{
    try {
      const code=new URLSearchParams(window.location.search).get('ref');
      if(code && /^[A-Za-z0-9_-]{4,40}$/.test(code)) sessionStorage.setItem(BUSINESS_REFERRAL_STORAGE_KEY,code.toUpperCase());
      setReferral(sessionStorage.getItem(BUSINESS_REFERRAL_STORAGE_KEY)||'');
    }catch{}
  },[]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const token = await getCustomerAccessToken();
        const res = await fetch('/api/account/business', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (active) setBusiness(data.business);
      } catch { if (active) setError(en ? 'Unable to load your account. Please refresh to try again.' : 'No se pudo cargar su cuenta. Actualice la página para reintentar.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user, en]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const token = await getCustomerAccessToken();
      const res = await fetch('/api/account/business', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({...values,referral_code:referral}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBusiness(data.business);
      trackLead('pro_account');
      setNotice(data.emailSent
        ? (en ? 'Application received. A confirmation email is on its way.' : 'Solicitud recibida. Le enviamos un correo de confirmación.')
        : (en ? 'Application saved. We could not deliver the confirmation email. You can check your status here.' : 'Solicitud guardada. No pudimos entregar el correo de confirmación. Puede consultar su estado aquí.'));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const statuses = en ? { approved: 'Approved partner', pending: 'Application under review', suspended: 'Account on hold' } : { approved: 'Socio aprobado', pending: 'Solicitud en revisión', suspended: 'Cuenta en pausa' };
  return <AccountShell title={{ en: 'Business account', es: 'Cuenta empresarial' }}>
    <section className="account-card business-hero">
      <span className="business-eyebrow">PEPTIDES COSTA RICA · BUSINESS</span>
      <h2>{business?.trading_name || business?.legal_name || (en ? 'Your business, taken care of.' : 'Su empresa, en buenas manos.')}</h2>
      <p>{en ? 'One account for your company details, orders and partner benefits.' : 'Una cuenta para los datos de su empresa, sus pedidos y beneficios.'}</p>
      <div className="business-badges"><span>{en ? '✓ Email verified' : '✓ Correo verificado'}</span>{business && <span>{statuses[business.status]}</span>}</div>
    </section>
    {error && <p className="account-notice is-error" role="alert">{error}</p>}
    {notice && <p className="account-notice" role="status">{notice}</p>}
    {!business&&referral&&<p className="account-notice">{en?'Brochure referral':'Referencia del folleto'}: {referral} <button type="button" className="account-btn-link" onClick={()=>{setReferral('');try{sessionStorage.removeItem(BUSINESS_REFERRAL_STORAGE_KEY);}catch{}}}>{en?'Remove':'Quitar'}</button></p>}
    {loading ? <p role="status">{en ? 'Loading your business account…' : 'Cargando su cuenta empresarial…'}</p> : business ? <>
      <div className="business-grid">
        <section className="account-card"><h2>{en?'Your business workspace':'Su espacio empresarial'}</h2><p>{en?'Quick orders, saved lists, quotes, team buyers and company billing documents.':'Pedidos rápidos, listas, cotizaciones, compradores y documentos de su empresa.'}</p><Link href="/account/business/tools" className="account-btn-primary">{en?'Open business tools':'Abrir herramientas'}</Link>{Number(business.minimum_units)>0||Number(business.minimum_order_usd)>0?<p>{en?'Order minimums':'Mínimos de compra'}: {business.minimum_units||0} {en?'units':'unidades'} · US${Number(business.minimum_order_usd||0).toFixed(2)}</p>:null}</section>
        <section className="account-card"><h2>{en ? 'Your partner pricing' : 'Su precio de socio'}</h2><strong className="business-rate">{business.status === 'approved' ? `${business.discount_pct}%` : '—'}</strong><p>{business.status === 'approved' ? (en ? 'Off eligible products, automatically at checkout when signed in. Offers do not stack; the best available price applies. Excludes BAC water and shipping.' : 'En productos elegibles, automáticamente al comprar con su sesión iniciada. Las ofertas no se acumulan; aplicamos el mejor precio. Excluye agua BAC y envío.') : (en ? 'Your pricing becomes available after approval. We will email you when your account is ready.' : 'Sus precios estarán disponibles después de la aprobación. Le enviaremos un correo cuando su cuenta esté lista.')}</p><Link className="account-btn-primary" href={`/catalog?lang=${lang}`}>{en ? 'Shop the catalog' : 'Ver catálogo'}</Link></section>
        <section className="account-card"><h2>{en ? 'Your orders' : 'Sus pedidos'}</h2><p>{en ? 'Track deliveries, review purchases and order again from your customer account.' : 'Consulte sus compras, siga sus entregas y vuelva a pedir desde su cuenta.'}</p><Link className="account-btn-primary" href="/account/orders">{en ? 'View orders' : 'Ver pedidos'}</Link></section>
        <section className="account-card"><h2>{en ? 'Dosing guide library' : 'Biblioteca de guías de dosificación'}</h2><p>{en ? 'Quickly find the supplied PDF reference guide for a product and vial size.' : 'Encuentre rápidamente la guía de referencia en PDF por producto y tamaño de vial.'}</p><Link className="account-btn-primary" href="/account/dosing-guides">{en ? 'Browse guides' : 'Ver guías'}</Link></section>
      </div>
      <section className="account-card"><h2>{en ? 'Company information' : 'Información de la empresa'}</h2><dl className="business-details"><div><dt>{en ? 'Verified login email' : 'Correo de acceso verificado'}</dt><dd>{user?.email}</dd></div>{FIELDS.map(([key, english, spanish]) => <div key={key}><dt>{en ? english : spanish}</dt><dd>{business[key] || '—'}</dd></div>)}</dl><p>{en ? 'Need to update your company details or agreement?' : '¿Necesita actualizar los datos de su empresa o su acuerdo?'} <Link href="/account/help">{en ? 'Contact our team' : 'Contacte a nuestro equipo'}</Link></p></section>
    </> : !error && <section className="account-card"><h2>{en ? 'Apply for a business account' : 'Solicitar una cuenta empresarial'}</h2><p>{en ? 'Share your company details. Our team will review your application and confirm your agreed pricing by email.' : 'Comparta los datos de su empresa. Nuestro equipo revisará su solicitud y confirmará sus precios por correo.'}</p><form onSubmit={submit}>{FIELDS.map(([key, english, spanish]) => <div className="account-field" key={key}><label htmlFor={key}>{en ? english : spanish}</label><input id={key} value={values[key] || ''} onChange={e => setValues({ ...values, [key]: e.target.value })} required={!['trading_name', 'delivery_address'].includes(key)} maxLength={key.endsWith('address') ? 1000 : 200} inputMode={key === 'corporation_number' ? 'numeric' : undefined} /></div>)}<button className="account-btn-primary" disabled={busy}>{busy ? (en ? 'Submitting…' : 'Enviando…') : (en ? 'Submit application' : 'Enviar solicitud')}</button></form></section>}
  </AccountShell>;
}
