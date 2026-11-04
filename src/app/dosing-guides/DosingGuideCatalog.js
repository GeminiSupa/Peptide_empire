'use client';

import { useMemo, useState } from 'react';
import { FileText, Search } from 'lucide-react';

import MobileActionBar from '@/components/MobileActionBar';
import { StorefrontFooter, StorefrontHeader } from '@/components/StorefrontChrome';
import { useBusinessLinks } from '@/hooks/useBusinessLinks';
import { usePublicPageContent } from '@/hooks/usePublicPageContent';
import '../landing.css';

export default function DosingGuideCatalog({ guides }) {
  const { lang, setLang, landingSettings } = usePublicPageContent('page_info_center');
  const { links } = useBusinessLinks();
  const [query, setQuery] = useState('');
  const en = lang === 'en';
  const visibleGuides = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? guides.filter((guide) => guide.title.toLocaleLowerCase().includes(needle)) : guides;
  }, [guides, query]);

  return (
    <div className="clone-home">
      <StorefrontHeader lang={lang} onLanguage={setLang} settings={landingSettings} active="guides" />
      <main>
        <section className="guide-public-hero clone-shell">
          <span>{en ? 'REFERENCE LIBRARY' : 'BIBLIOTECA DE REFERENCIA'}</span>
          <h1>{en ? 'Dosing guides' : 'Guías de dosificación'}</h1>
          <p>{en ? 'Search the supplied PDF guides by product, strength, or vial size.' : 'Busque las guías en PDF por producto, concentración o tamaño de vial.'}</p>
          <label className="guide-public-search" htmlFor="public-guide-search">
            <Search size={19} aria-hidden="true" />
            <input id="public-guide-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? 'Example: Tirzepatide 30mg' : 'Ejemplo: Tirzepatide 30mg'} autoComplete="off" />
          </label>
          <small>{en ? `${visibleGuides.length} of ${guides.length} guides` : `${visibleGuides.length} de ${guides.length} guías`}</small>
        </section>
        <section className="guide-public-section clone-shell">
          {visibleGuides.length ? <ul className="guide-public-grid">{visibleGuides.map((guide) => <li key={guide.filename}><FileText size={22} aria-hidden="true" /><div><strong>{guide.title}</strong><span>PDF · {en ? 'Reference guide' : 'Guía de referencia'}</span></div><a href={guide.href} target="_blank" rel="noopener noreferrer">{en ? 'Open' : 'Abrir'}</a></li>)}</ul> : <p className="guide-public-empty">{en ? 'No guides match that search.' : 'No hay guías que coincidan con la búsqueda.'}</p>}
        </section>
        <aside className="guide-public-notice clone-shell">
          <strong>{en ? 'Important information' : 'Información importante'}</strong>
          <p>{en ? 'These documents are provided for general reference and do not replace advice from a licensed healthcare professional. Verify the product, concentration, and calculations before relying on any guide.' : 'Estos documentos se ofrecen como referencia general y no sustituyen el consejo de un profesional de salud autorizado. Verifique el producto, la concentración y los cálculos antes de usar cualquier guía.'}</p>
        </aside>
      </main>
      <StorefrontFooter lang={lang} settings={landingSettings} />
      <MobileActionBar lang={lang} whatsappHref={`https://wa.me/${links.whatsappNumber}`} />
    </div>
  );
}
