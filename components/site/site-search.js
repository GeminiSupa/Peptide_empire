'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSite } from '@/components/site/site-provider';
import { SHELVES } from '@/lib/storefront/shelves.mjs';

/** Lowercase, accents and punctuation removed — "GHK-Cu" finds "ghkcu". */
function norm(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9+]/g, '');
}

function shelfName(id, lang) {
  const shelf = SHELVES.find((entry) => entry.id === id);
  return shelf ? shelf[lang === 'es' ? 'es' : 'en'] : '';
}

/** "<mark>BPC</mark>-157" for a query "bpc". */
function Highlight({ text, query }) {
  if (!query) return text;
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

/**
 * The prototype's full-screen product search: popular compounds and the
 * categories before typing, ranked matches after. Opened by the header's
 * search button or the `/` key.
 */
export default function SiteSearch({ compounds, categories = [] }) {
  const { t, lang, money, whatsapp, searchOpen, setSearchOpen } = useSite();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('sxlock', searchOpen);
    if (!searchOpen) return;
    setQuery('');
    setActive(-1);
    setTimeout(() => inputRef.current?.focus(), 30);
    window.dataLayer?.push({ event: 'search_open' });
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && searchOpen) { setSearchOpen(false); return; }
      if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, setSearchOpen]);

  const q = norm(query);
  const results = useMemo(() => {
    if (!q) return compounds.filter((compound) => compound.best).slice(0, 6);
    return compounds
      .map((compound) => {
        const name = norm(compound.name);
        let score = 0;
        if (name === q) score = 100;
        else if (name.startsWith(q)) score = 80;
        else if (name.includes(q)) score = 60;
        else if (norm(compound.slug).includes(q)) score = 50;
        else if (norm(shelfName(compound.shelf, 'en')).includes(q)) score = 30;
        else if (q.length > 2 && compound.variants.some((variant) => norm(variant.size).includes(q))) score = 10;
        return { compound, score: score + (compound.best ? 2 : 0) };
      })
      .filter((entry) => entry.score > 2)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.compound);
  }, [compounds, q]);
  const shown = q ? results.slice(0, 8) : results;

  const pick = (compound) => {
    window.dataLayer?.push({ event: 'search', search_term: query, item_id: compound.slug });
    setSearchOpen(false);
    router.push(compound.href);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!shown.length) return;
      setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length);
    } else if (event.key === 'Enter') {
      const compound = shown[active < 0 ? 0 : active];
      if (compound) pick(compound);
    }
  };

  const row = (compound, index) => {
    const outOfStock = !compound.inStock;
    const fromCrc = Math.min(...compound.variants.map((variant) => variant.priceCrc));
    return (
      <a
        key={compound.slug}
        className={`sxi${index === active ? ' on' : ''}`}
        href={compound.href}
        role="option"
        aria-selected={index === active}
        onClick={(event) => { event.preventDefault(); pick(compound); }}
      >
        <span className="sxim"><img src={compound.image} alt="" /></span>
        <span className="sxn">
          <b><Highlight text={compound.name} query={query.trim()} /></b>
          <small>{shelfName(compound.shelf, lang)} · {compound.variants.map((variant) => variant.size).join(', ')}</small>
        </span>
        <span className="sxpr">
          {outOfStock
            ? <small className="oos">{t('Out of stock')}</small>
            : <><small>{t('from')}</small><b className="num">{money(fromCrc, compound.fromPriceUsd)}</b></>}
        </span>
      </a>
    );
  };

  return (
    <div
      className={`sx${searchOpen ? ' on' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('Search products')}
      onClick={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}
    >
      <div className="sxp">
        <div className="sxbar">
          <span className="ms">search</span>
          <input
            ref={inputRef}
            type="search"
            autoComplete="off"
            spellCheck="false"
            placeholder={t('Search compounds, e.g. BPC-157, GLP-1, NAD+')}
            aria-autocomplete="list"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(-1); }}
            onKeyDown={onKeyDown}
          />
          <button type="button" className="sxx" aria-label={t('Close search')} onClick={() => setSearchOpen(false)}>
            <span className="ms">close</span>
          </button>
        </div>
        <div className="sxr" role="listbox">
          {!q ? (
            <>
              <div className="sxh">{t('Popular right now')}</div>
              {shown.map(row)}
              <div className="sxh">{t('Browse by category')}</div>
              <div className="sxcats">
                {categories.map((category) => (
                  <a key={category.href} href={category.href} onClick={() => setSearchOpen(false)}>{t(category.name)}</a>
                ))}
              </div>
            </>
          ) : shown.length ? (
            <>
              <div className="sxh">{t(`${results.length} result${results.length === 1 ? '' : 's'}`)}</div>
              {shown.map(row)}
            </>
          ) : (
            <div className="sxnone">
              <span className="ms">search_off</span>
              <b>{t(`No compound matches “${query.trim()}”`)}</b>
              <small>{t('Try another name, or ask us on WhatsApp.')}</small>
              <a className="btn sm" href={whatsapp(t(`Hi! Do you have ${query.trim()}?`))} target="_blank" rel="noopener noreferrer">
                {t('Ask on WhatsApp')}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
