'use client';

import { useEffect, useMemo, useState } from 'react';
import Ms from '@/components/storefront/icon';
import ProductCard from '@/components/storefront/product-card';
import { applyFilters, shelfChips } from '@/lib/storefront/filter.mjs';

/**
 * The filter rail and the shelf itself.
 *
 * The grid is 2 columns on a phone, 3 from 720px and 4 from 1000px — the
 * design's own breakpoints, in `storefront.css`.
 */
export default function Catalog({
  compounds,
  filters,
  onFilters,
  searchRef,
  selectedSizes,
  onSelectSize,
  cart,
  onAdd,
  onChangeQty,
  money,
  t,
  lang,
  hrefFor,
  whatsappFor,
}) {
  const chips = useMemo(() => shelfChips(compounds, lang), [compounds, lang]);
  const shown = useMemo(() => applyFilters(compounds, filters, lang), [compounds, filters, lang]);

  const qtyOf = (product) => cart.find((line) => line.product === product)?.qty || 0;

  // Beside the sort menu on a phone the search box is ~130px, and the full
  // placeholder needs ~245px, so it read "Search compou". A placeholder
  // cannot be set from CSS, hence the media query here.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 559px)');
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return (
    <>
      <div className="rail">
        <div className="wrap">
          <div className="searchrow">
            <label className="search">
              <Ms name="search" />
              <input
                ref={searchRef}
                type="search"
                autoComplete="off"
                aria-label={t('Search compounds')}
                placeholder={narrow ? t('Search') : t('Search compounds or strengths')}
                value={filters.query}
                onChange={(event) => onFilters({ ...filters, query: event.target.value })}
              />
            </label>

            <select
              className="sort"
              aria-label={t('Sort')}
              value={filters.sort}
              onChange={(event) => onFilters({ ...filters, sort: event.target.value })}
            >
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
                onClick={() => onFilters({ ...filters, shelf: chip.id })}
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
            <input
              type="checkbox"
              checked={filters.inStockOnly}
              onChange={(event) => onFilters({ ...filters, inStockOnly: event.target.checked })}
            />
            <i />
            {t('In stock only')}
          </label>
        </div>

        <div className="grid">
          {shown.length ? (
            shown.map((compound) => (
              <ProductCard
                key={compound.slug}
                compound={compound}
                selectedSize={selectedSizes[compound.slug]}
                onSelectSize={onSelectSize}
                inCartQty={qtyOf(
                  (compound.variants.find(
                    (variant) => variant.size === (selectedSizes[compound.slug] || compound.defaultSize),
                  ) || compound.variants[0]).product,
                )}
                onAdd={onAdd}
                onChangeQty={onChangeQty}
                money={money}
                t={t}
                lang={lang}
                href={hrefFor(compound.slug)}
                whatsappFor={whatsappFor}
              />
            ))
          ) : (
            <div className="empty">
              <Ms name="search_off" style={{ fontSize: '36px' }} />
              <p>
                {t('No compounds match. Try another name, or')}{' '}
                <a
                  style={{ textDecoration: 'underline' }}
                  href={whatsappFor(`Hi! I'm looking for ${filters.query}.`)}
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
