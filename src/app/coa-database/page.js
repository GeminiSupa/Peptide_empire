"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FlaskConical, Search, CheckCircle, FileText } from 'lucide-react';
import { useBusinessLinks } from '@/hooks/useBusinessLinks';
import { usePublicPageContent, localized } from '@/hooks/usePublicPageContent';
import { StorefrontFooter, StorefrontHeader } from '@/components/StorefrontChrome';
import MobileActionBar from '@/components/MobileActionBar';
import { supabase } from '@/lib/supabase';
import { catalogFacingName, productCatalogPath } from '@/lib/catalogCategories.mjs';
import { coaLinkLabel, coaLinks } from '@/lib/coaLinks.mjs';
import '../landing.css';

/**
 * Every product's lab reports, read straight from the COA field on the product.
 * Adding a COA link to a product in the admin puts it here; there is no second
 * list to keep in step.
 */
function useProductCoas() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!supabase) {
      setRows([]);
      return;
    }
    supabase
      .from('products')
      .select('product, vial_size, coa')
      .not('coa', 'is', null)
      .order('product', { ascending: true })
      .then(({ data }) => {
        setRows((data || [])
          .map((row) => ({ ...row, links: coaLinks(row.coa) }))
          .filter((row) => row.links.length));
      });
  }, []);
  return rows;
}

export default function CoaDatabasePage() {
  const { lang, setLang, landingSettings, pageSettings } = usePublicPageContent('page_coa_database');
  const { links } = useBusinessLinks();
  const rows = useProductCoas();
  const [query, setQuery] = useState('');
  const en = lang === 'en';

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (rows || []).filter((row) => {
      const haystack = `${row.product} ${catalogFacingName(row.product, lang)} ${row.links.join(' ')}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [rows, query, lang]);

  return (
    <div className="clone-home">
      <StorefrontHeader lang={lang} onLanguage={setLang} settings={landingSettings} />

      <main style={{ paddingTop: '48px', paddingBottom: '80px' }}>
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ background: 'rgba(0, 39, 102, 0.1)', color: 'var(--text-primary)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <FlaskConical size={40} />
          </div>
          <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)' }}>
            {localized(pageSettings, 'heroTitle', lang)}
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '48px', lineHeight: '1.6' }}>
            {localized(pageSettings, 'heroText', lang)}
          </p>

          <div style={{ background: 'var(--card-bg)', padding: '32px', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'left', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileText color="#C8530C" />
              {en ? 'Lab reports by product' : 'Informes de laboratorio por producto'}
            </h2>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={en ? 'Search a product, e.g. BPC-157 or 12mg' : 'Busque un producto, p. ej. BPC-157 o 12mg'}
              aria-label={en ? 'Search lab reports' : 'Buscar informes de laboratorio'}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '1rem', marginBottom: '16px', background: 'var(--bg-color, #fff)', color: 'var(--text-main)' }}
            />
            {rows === null ? (
              <p style={{ color: 'var(--text-muted)' }}>{en ? 'Loading lab reports…' : 'Cargando informes…'}</p>
            ) : shown.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>{en ? 'No lab report matches that search.' : 'Ningún informe coincide con esa búsqueda.'}</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {shown.map((row) => (
                  <li key={row.product} style={{ padding: '12px 0', borderTop: '1px solid var(--border-color)' }}>
                    <Link href={productCatalogPath(row, `lang=${lang}`)} style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {catalogFacingName(row.product, lang)}
                    </Link>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: '6px' }}>
                      {row.links.map((link, index) => (
                        <a key={`${link}-${index}`} href={link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: '3px', fontSize: '0.95rem' }}>
                          <FileText size={15} /> {coaLinkLabel(link, row.links, lang)}
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ background: 'var(--card-bg)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'left', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Search color="#C8530C" />
              {localized(pageSettings, 'howTitle', lang)}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(pageSettings.points || []).map((point, index) => (
                <div key={`${point.titleEn}-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <CheckCircle size={20} color="#25D366" style={{ marginTop: '4px' }} />
                  <div>
                    <h4 style={{ fontWeight: 'bold' }}>{localized(point, 'title', lang)}</h4>
                    <p style={{ color: 'var(--text-muted)' }}>{localized(point, 'text', lang)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link href={`/catalog?lang=${lang}`} className="btn-hero-primary" style={{ display: 'inline-flex' }}>
            {localized(pageSettings, 'ctaButton', lang)}
          </Link>
        </div>
      </main>

      <StorefrontFooter lang={lang} settings={landingSettings} />
      <MobileActionBar lang={lang} whatsappHref={`https://wa.me/${links.whatsappNumber}`} />
    </div>
  );
}
