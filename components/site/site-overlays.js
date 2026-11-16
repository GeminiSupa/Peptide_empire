'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { ecommerceData, pushEvent } from '@/lib/site/analytics.mjs';
import { useRouter } from 'next/navigation';
import { LAST_ORDER_KEY } from '@/components/site/thank-you';
import Ms from '@/components/storefront/icon';
import CartSheet from '@/components/storefront/cart-sheet';
import { useSite } from '@/components/site/site-provider';
import SiteSearch from '@/components/site/site-search';
import { cartCount, freeShippingThreshold } from '@/lib/storefront/cart-math.mjs';
import { deliveryProgress } from '@/lib/site/quote.mjs';

/**
 * Everything that floats over the page: the order bar, the toast, the cart
 * sheet and the search overlay.
 */
export default function SiteOverlays({ compounds, categories, freeShippingLabel, links }) {
  const {
    t, lang, currency, exchangeRate, cart, quote, money, whatsapp, dealView,
    sheetOpen, setSheetOpen, addToCart, setQty, clear, toast, setToast,
    promo, applyPromo, removePromo,
  } = useSite();

  const router = useRouter();
  const onPlaced = useCallback((order) => {
    try {
      window.sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    } catch {
      // The thank-you page then shows its steps without the order summary.
    }
    setSheetOpen(false);
    router.push(links['thank-you']);
  }, [router, links, setSheetOpen]);

  // The catalog's cart funnel events, priced as checkout prices the cart.
  const track = useCallback((event, extras = {}) => {
    if (!cart.length) return;
    pushEvent({
      event,
      ecommerce: ecommerceData(
        cart.map((line) => ({ ...line, category: compounds.find((compound) => compound.slug === line.slug)?.category })),
        { discountPct: quote?.discountPct || 0, extras },
      ),
    });
  }, [cart, compounds, quote]);
  useEffect(() => {
    if (sheetOpen) track('view_cart');
    // Once per opening, not on every cart change while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  const hrefFor = useCallback(
    (slug) => compounds.find((compound) => compound.slug === slug)?.href || links.catalog,
    [compounds, links.catalog],
  );
  const count = cartCount(cart);
  // Read off the quote, so a running deal counts toward free delivery
  // exactly as checkout counts it.
  const progress = useMemo(
    () => deliveryProgress(quote, freeShippingThreshold(currency, exchangeRate)),
    [quote, currency, exchangeRate],
  );
  const total = quote ? quote.total : 0;

  return (
    <>
      {count && !sheetOpen ? (
        <div className="obar" style={{ transform: 'none' }}>
          <div className="info">
            <b className="num">{t(`${count} item${count === 1 ? '' : 's'} · ${money(total, total)}`)}</b>
            <small>
              {progress.reached
                ? t('Free delivery unlocked · free BAC Water included')
                : t(`${money(progress.remaining, progress.remaining)} to free delivery · free BAC Water included`)}
            </small>
            <div className="mini"><i style={{ width: `${Math.round(progress.percent)}%` }} /></div>
          </div>
          <button className="btn" type="button" onClick={() => setSheetOpen(true)}>{t('View order')}</button>
        </div>
      ) : null}

      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
        <Ms name="check_circle" filled />
        <span>{toast}</span>
        <button type="button" onClick={() => { setToast(''); setSheetOpen(true); }}>{t('View')}</button>
      </div>

      <CartSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        cart={cart}
        compounds={compounds}
        onChangeQty={setQty}
        onAdd={addToCart}
        onClear={clear}
        money={money}
        t={t}
        lang={lang}
        currency={currency}
        exchangeRate={exchangeRate}
        whatsappFor={whatsapp}
        hrefFor={hrefFor}
        freeShippingLabel={freeShippingLabel}
        quote={quote}
        dealName={dealView?.name || ''}
        dealNote={dealView?.headline || ''}
        dealRunning={Boolean(dealView)}
        onPlaced={onPlaced}
        track={track}
        promo={promo}
        onApplyPromo={applyPromo}
        onRemovePromo={removePromo}
      />

      <SiteSearch compounds={compounds} categories={categories} />
    </>
  );
}
