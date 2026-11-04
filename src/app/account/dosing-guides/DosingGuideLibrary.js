'use client';

import { useMemo, useState } from 'react';

import { useStorefrontLang } from '@/hooks/useCustomerSession';
import AccountShell from '../AccountShell';

export default function DosingGuideLibrary({ guides }) {
  const [lang] = useStorefrontLang();
  const [query, setQuery] = useState('');
  const isEn = lang === 'en';
  const visibleGuides = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return guides;
    return guides.filter((guide) => guide.title.toLocaleLowerCase().includes(needle));
  }, [guides, query]);

  return (
    <AccountShell title={{ en: 'Dosing guides', es: 'Guías de dosificación' }}>
      <section className="account-card dosing-guide-intro">
        <span className="dosing-guide-eyebrow">{isEn ? 'REFERENCE LIBRARY' : 'BIBLIOTECA DE REFERENCIA'}</span>
        <h2>{isEn ? 'Find a guide by product and vial size' : 'Busque una guía por producto y tamaño de vial'}</h2>
        <p>{isEn ? 'Browse the supplied PDF reference guides from one searchable library.' : 'Consulte las guías de referencia en PDF desde una biblioteca con buscador.'}</p>
      </section>

      <section className="account-card dosing-guide-library">
        <label htmlFor="guide-search">{isEn ? 'Search guides' : 'Buscar guías'}</label>
        <input id="guide-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isEn ? 'Example: Tirzepatide 30mg' : 'Ejemplo: Tirzepatide 30mg'} autoComplete="off" />
        <p className="account-muted dosing-guide-count">{isEn ? `${visibleGuides.length} of ${guides.length} guides` : `${visibleGuides.length} de ${guides.length} guías`}</p>
        {visibleGuides.length ? (
          <ul className="dosing-guide-grid">
            {visibleGuides.map((guide) => (
              <li key={guide.filename}>
                <div className="dosing-guide-icon" aria-hidden="true">PDF</div>
                <div><strong>{guide.title}</strong><span>{isEn ? 'Reference guide' : 'Guía de referencia'}</span></div>
                <a href={guide.href} target="_blank" rel="noopener noreferrer">{isEn ? 'Open' : 'Abrir'}</a>
              </li>
            ))}
          </ul>
        ) : <p className="account-empty">{isEn ? 'No guides match that search.' : 'No hay guías que coincidan con la búsqueda.'}</p>}
      </section>

      <aside className="account-card dosing-guide-notice">
        <strong>{isEn ? 'Important information' : 'Información importante'}</strong>
        <p>{isEn ? 'These documents are provided for general reference and do not replace advice from a licensed healthcare professional. Verify the product, concentration, and calculations before relying on any guide.' : 'Estos documentos se ofrecen como referencia general y no sustituyen el consejo de un profesional de salud autorizado. Verifique el producto, la concentración y los cálculos antes de usar cualquier guía.'}</p>
      </aside>
    </AccountShell>
  );
}
