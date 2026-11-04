'use client';

import { useEffect, useMemo, useState } from 'react';

import { useCustomerSession, useStorefrontLang } from '@/hooks/useCustomerSession';
import { getCustomerAccessToken } from '@/lib/customerSupabase';
import AccountShell from '../AccountShell';

export default function DosingGuidesPage() {
  const { user } = useCustomerSession();
  const [lang] = useStorefrontLang();
  const [guides, setGuides] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState('');
  const en = lang === 'en';

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const token = await getCustomerAccessToken();
        const response = await fetch('/api/account/dosing-guides', { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) setGuides(data.guides || []);
      } catch { if (active) setError(en ? 'Unable to load the guide library.' : 'No se pudo cargar la biblioteca de guías.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user, en]);

  const visibleGuides = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? guides.filter((guide) => guide.title.toLocaleLowerCase().includes(needle)) : guides;
  }, [guides, query]);

  async function openGuide(guide) {
    setOpening(guide.filename); setError('');
    try {
      const token = await getCustomerAccessToken();
      const response = await fetch(`/api/account/dosing-guides/${encodeURIComponent(guide.filename)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError(en ? 'Unable to open this guide. Please try again.' : 'No se pudo abrir esta guía. Inténtelo de nuevo.'); }
    finally { setOpening(''); }
  }

  return <AccountShell title={{ en: 'Dosing guides', es: 'Guías de dosificación' }}>
    <section className="account-card dosing-guide-intro"><span className="dosing-guide-eyebrow">{en ? 'ACCOUNT-ONLY LIBRARY' : 'BIBLIOTECA SOLO PARA CUENTAS'}</span><h2>{en ? 'Find a guide by product and vial size' : 'Busque una guía por producto y tamaño de vial'}</h2><p>{en ? 'Available only while signed in to your customer account.' : 'Disponible únicamente al iniciar sesión en su cuenta.'}</p></section>
    {error && <p className="account-notice is-error" role="alert">{error}</p>}
    <section className="account-card dosing-guide-library"><label htmlFor="guide-search">{en ? 'Search guides' : 'Buscar guías'}</label><input id="guide-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? 'Example: Tirzepatide 30mg' : 'Ejemplo: Tirzepatide 30mg'} autoComplete="off" /><p className="account-muted dosing-guide-count">{loading ? (en ? 'Loading guides…' : 'Cargando guías…') : en ? `${visibleGuides.length} of ${guides.length} guides` : `${visibleGuides.length} de ${guides.length} guías`}</p>{!loading && (visibleGuides.length ? <ul className="dosing-guide-grid">{visibleGuides.map((guide) => <li key={guide.filename}><div className="dosing-guide-icon" aria-hidden="true">PDF</div><div><strong>{guide.title}</strong><span>{en ? 'Account reference guide' : 'Guía de referencia de cuenta'}</span></div><button type="button" className="account-btn-link" disabled={opening === guide.filename} onClick={() => openGuide(guide)}>{opening === guide.filename ? (en ? 'Opening…' : 'Abriendo…') : (en ? 'Open' : 'Abrir')}</button></li>)}</ul> : <p className="account-empty">{en ? 'No guides match that search.' : 'No hay guías que coincidan con la búsqueda.'}</p>)}</section>
    <aside className="account-card dosing-guide-notice"><strong>{en ? 'Important information' : 'Información importante'}</strong><p>{en ? 'These documents are provided for general reference and do not replace advice from a licensed healthcare professional. Verify the product, concentration, and calculations before relying on any guide.' : 'Estos documentos se ofrecen como referencia general y no sustituyen el consejo de un profesional de salud autorizado. Verifique el producto, la concentración y los cálculos antes de usar cualquier guía.'}</p></aside>
  </AccountShell>;
}
