'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Ms from '@/components/storefront/icon';
import StoreHeader from '@/components/storefront/store-header';
import Hero from '@/components/storefront/hero';
import Catalog from '@/components/storefront/catalog';
import ProductView from '@/components/storefront/product-view';
import CartSheet from '@/components/storefront/cart-sheet';
import OrderBar from '@/components/storefront/order-bar';
import StoreFooter from '@/components/storefront/store-footer';
import { formatMoney, translator } from '@/lib/storefront/i18n.mjs';
import { useCart, useCurrency } from '@/lib/storefront/use-cart';
import {
  cartCount,
  freeDeliveryProgress,
  freeShippingThreshold,
  totalsFor,
} from '@/lib/storefront/cart-math.mjs';
import { WHATSAPP_NUMBER } from '@/lib/storefront/content.mjs';
import '@/app/storefront.css';

const LOGO_SRC = '/wp-content/uploads/2026/02/COSTA-RICA-1-e1771916272916.png';

/**
 * The shop.
 *
 * One client component holds the cart, the currency and which compound is
 * being viewed; everything else is presentational. Product views are a query
 * parameter (`?p=slug`) rather than a route of their own, deliberately: this
 * site already serves ~516 indexed English URLs including `/product/[slug]`
 * for the WordPress product pages, and a second route tree on the same paths
 * would fight them. A query parameter is shareable, back-button-correct, and
 * collides with nothing.
 *
 * Prices and stock arrive from the server already grouped (see `feed.js`).
 * Nothing here prices anything: see `lib/storefront/order.js`.
 */
export default function Storefront({
  compounds,
  exchangeRate,
  feedOk,
  lang = 'en',
  initialSlug = '',
  homeHref = '/',
  altHref = '/es/',
}) {
  const t = useMemo(() => translator(lang), [lang]);
  const [currency, setCurrency] = useCurrency();
  const { cart, add, setQty, clear } = useCart();

  const [slug, setSlug] = useState(initialSlug);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState({});
  const [toast, setToast] = useState('');
  const [filters, setFilters] = useState({
    shelf: 'all', query: '', sort: 'pop', inStockOnly: false,
  });
  const searchRef = useRef(null);

  const money = useCallback(
    (amountCrc, amountUsd) => formatMoney(amountCrc, amountUsd, currency),
    [currency],
  );

  const whatsappFor = useCallback(
    (message) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
    [],
  );

  const hrefFor = useCallback(
    (compoundSlug) => `${homeHref}?p=${encodeURIComponent(compoundSlug)}`,
    [homeHref],
  );

  const compound = useMemo(
    () => compounds.find((entry) => entry.slug === slug) || null,
    [compounds, slug],
  );

  // Keep the URL and the view in step, both ways: a click pushes history, and
  // the back button puts the shopper where they expect to land.
  const show = useCallback((nextSlug) => {
    setSlug(nextSlug);
    const url = nextSlug ? `${homeHref}?p=${encodeURIComponent(nextSlug)}` : homeHref;
    window.history.pushState({ p: nextSlug }, '', url);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [homeHref]);

  useEffect(() => {
    const onPop = () => {
      const param = new URLSearchParams(window.location.search).get('p') || '';
      setSlug(param);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Intercept clicks on product links so the view swaps without a page load.
  const onNavigate = useCallback((event) => {
    const link = event.target.closest?.('a[href*="?p="]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const href = link.getAttribute('href') || '';
    const param = new URLSearchParams(href.split('?')[1] || '').get('p');
    if (!param) return;
    event.preventDefault();
    show(param);
  }, [show]);

  const onCrumb = useCallback((event) => {
    const link = event.target.closest?.('a.crumb, a[data-home]');
    if (!link || event.metaKey || event.ctrlKey || event.button !== 0) return;
    event.preventDefault();
    show('');
  }, [show]);

  const onAdd = useCallback((item, variant, qty = 1) => {
    add(item, variant, qty);
    setToast(t(`${item.name} ${variant.size} added`));
    setSelectedSizes((current) => ({ ...current, [item.slug]: variant.size }));
  }, [add, t]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // The sheet is a modal: the page behind it must not scroll under the thumb.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [sheetOpen]);

  const onSelectSize = useCallback((compoundSlug, size) => {
    setSelectedSizes((current) => ({ ...current, [compoundSlug]: size }));
  }, []);

  const focusSearch = useCallback(() => {
    show('');
    setTimeout(() => searchRef.current?.focus(), 60);
  }, [show]);

  const totals = useMemo(() => totalsFor(cart, currency, exchangeRate), [cart, currency, exchangeRate]);
  const progress = useMemo(
    () => freeDeliveryProgress(cart, currency, exchangeRate),
    [cart, currency, exchangeRate],
  );
  const freeShippingLabel = useMemo(() => {
    const threshold = freeShippingThreshold(currency, exchangeRate);
    return formatMoney(threshold, threshold, currency);
  }, [currency, exchangeRate]);

  const picks = useMemo(() => compounds
    .filter((entry) => entry.best && entry.inStock)
    .slice(0, 3)
    .map((entry) => ({
      ...entry,
      fromPriceUsd: entry.fromPriceUsd,
      fromPriceCrc: Math.min(...entry.variants.map((variant) => variant.priceCrc)),
    })), [compounds]);

  return (
    <div className="storefront" onClickCapture={onNavigate}>
      {/* The design's icons are Material Symbols ligatures; `.ms` sizes them
          with font-size in 39 rules, so the font is loaded rather than
          swapped for an SVG set. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400..600,0..1,0&display=block"
      />

      <StoreHeader
        t={t}
        lang={lang}
        currency={currency}
        onCurrency={setCurrency}
        altHref={altHref}
        homeHref={homeHref}
        cartCount={cartCount(cart)}
        freeShippingLabel={freeShippingLabel}
        onOpenCart={() => setSheetOpen(true)}
        onFocusSearch={focusSearch}
        whatsappHref={whatsappFor('Hi! I have a question about an order.')}
        logoSrc={LOGO_SRC}
      />

      <main onClickCapture={onCrumb}>
        {!feedOk ? (
          <div className="wrap">
            <div className="empty" style={{ padding: '56px 0' }}>
              <Ms name="cloud_off" style={{ fontSize: '40px' }} />
              <p style={{ marginTop: '8px' }}>
                {t('The catalog is briefly unavailable. Please try again in a moment, or')}{' '}
                <a
                  style={{ textDecoration: 'underline' }}
                  href={whatsappFor('Hi! The website catalog is not loading — can you help me order?')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('ask us on WhatsApp')}
                </a>
                .
              </p>
            </div>
          </div>
        ) : compound ? (
          <ProductView
            compound={compound}
            compounds={compounds}
            selectedSize={selectedSizes[compound.slug]}
            onSelectSize={onSelectSize}
            onAdd={onAdd}
            money={money}
            t={t}
            lang={lang}
            currency={currency}
            exchangeRate={exchangeRate}
            hrefFor={hrefFor}
            homeHref={homeHref}
            whatsappFor={whatsappFor}
            cart={cart}
            onChangeQty={setQty}
            selectedSizes={selectedSizes}
          />
        ) : (
          <>
            <Hero
              t={t}
              compoundCount={compounds.length}
              picks={picks}
              money={money}
              homeHref={homeHref}
            />
            <Catalog
              compounds={compounds}
              filters={filters}
              onFilters={setFilters}
              searchRef={searchRef}
              selectedSizes={selectedSizes}
              onSelectSize={onSelectSize}
              cart={cart}
              onAdd={onAdd}
              onChangeQty={setQty}
              money={money}
              t={t}
              lang={lang}
              hrefFor={hrefFor}
              whatsappFor={whatsappFor}
            />
          </>
        )}
      </main>

      <StoreFooter t={t} lang={lang} />

      <OrderBar
        t={t}
        count={cartCount(cart)}
        total={money(totals.total, totals.total)}
        progress={progress}
        onOpen={() => setSheetOpen(true)}
        hidden={sheetOpen}
      />

      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
        <Ms name="check_circle" filled />
        <span>{toast}</span>
        <button type="button" onClick={() => { setToast(''); setSheetOpen(true); }}>
          {t('View')}
        </button>
      </div>

      <CartSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        cart={cart}
        compounds={compounds}
        onChangeQty={setQty}
        onAdd={onAdd}
        onClear={clear}
        money={money}
        t={t}
        lang={lang}
        currency={currency}
        exchangeRate={exchangeRate}
        whatsappFor={whatsappFor}
        hrefFor={hrefFor}
        freeShippingLabel={freeShippingLabel}
      />
    </div>
  );
}
