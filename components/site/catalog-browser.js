'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Ms from '@/components/storefront/icon';
import ProductCard from '@/components/storefront/product-card';
import { useSite } from '@/components/site/site-provider';
import { applyFilters, shelfChips } from '@/lib/storefront/filter.mjs';

/**
 * The catalog's rail (search, sort, shelf chips, in-stock toggle) and grid.
 *
 * The server renders the full, unfiltered grid, so every compound and price
 * is in the page source; filtering only happens once someone uses the rail.
 * A `?q=` in the URL — where links to a compound without its own page land —
 * fills the search box on arrival.
 */
export default function CatalogBrowser({ compounds }) {
  const { t, lang, money, cart, addToCart, setQty, whatsapp } = useSite();
  const [filters, setFilters] = useState({ shelf: 'all', query: '', sort: 'pop', inStockOnly: false });
  const [sizes, setSizes] = useState({});
  const [narrow, setNarrow] = useState(false);
  const onSelectSize = useCallback((slug, size) => setSizes((current) => ({ ...current, [slug]: size })), []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('q');
    if (query) setFilters((current) => ({ ...current, query }));
    // Beside the sort menu on a phone the search box is too narrow for the
    // full placeholder, and a placeholder cannot be set from CSS.
    const media = window.matchMedia('(max-width: 559px)');
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const query = filters.query.trim();
    if (!query) return undefined;
    const timer = setTimeout(() => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'search', search_term: query });
    }, 800);
    return () => clearTimeout(timer);
  }, [filters.query]);

  const chips = useMemo(() => shelfChips(compounds, lang), [compounds, lang]);
  const shown = useMemo(() => applyFilters(compounds, filters, lang), [compounds, filters, lang]);
  const set = (patch) => setFilters((current) => ({ ...current, ...patch }));

  return (
    <>
      <div className="rail">
        <div className="wrap">
          <div className="searchrow">
            <label className="search">
              <Ms name="search" />
              <input
                type="search"
                autoComplete="off"
                aria-label={t('Search compounds')}
                placeholder={narrow ? t('Search') : t('Search compounds or strengths')}
                value={filters.query}
                onChange={(event) => set({ query: event.target.value })}
              />
            </label>
            <select className="sort" aria-label={t('Sort')} value={filters.sort} onChange={(event) => set({ sort: event.target.value })}>
              <option value="pop">{t('Most popular')}</option>
              <option value="low">{t('Price: low to high')}</option>
              <option value="high">{t('Price: high to low')}</option>
              <option value="az">{t('Name A–Z')}</option>
            </select>
          </div>
          <div className="chips">
            {chips.map((chip) => (
              <button
                className="chip"
                type="button"
                key={chip.id}
                aria-pressed={filters.shelf === chip.id}
                onClick={() => set({ shelf: chip.id })}
              >
                {chip.translated ? chip.label : t(chip.label)}
                {chip.count != null ? <span className="c">{chip.count}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="resinfo">
          <span className="num">{t(`${shown.length} compound${shown.length === 1 ? '' : 's'}`)}</span>
          <label className="tgl">
            <input type="checkbox" checked={filters.inStockOnly} onChange={(event) => set({ inStockOnly: event.target.checked })} />
            <i />
            {t('In stock only')}
          </label>
        </div>

        <div className="grid">
          {shown.length ? shown.map((compound) => {
            const variant = compound.variants.find((entry) => entry.size === (sizes[compound.slug] || compound.defaultSize))
              || compound.variants[0];
            return (
              <ProductCard
                key={compound.slug}
                compound={compound}
                selectedSize={sizes[compound.slug]}
                onSelectSize={onSelectSize}
                inCartQty={cart.find((line) => line.product === variant.product)?.qty || 0}
                onAdd={addToCart}
                onChangeQty={setQty}
                money={money}
                t={t}
                lang={lang}
                href={compound.href}
                whatsappFor={whatsapp}
              />
            );
          }) : (
            <div className="empty">
              <Ms name="search_off" style={{ fontSize: '36px' }} />
              <p>
                {t('No compounds match. Try another name, or')}{' '}
                <a
                  style={{ textDecoration: 'underline' }}
                  href={whatsapp(`Hi! I'm looking for ${filters.query}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('ask us on WhatsApp')}
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
