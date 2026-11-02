'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { formatMoney, translator } from '@/lib/storefront/i18n.mjs';
import { useCart, useCurrency } from '@/lib/storefront/use-cart';
import { quoteCart } from '@/lib/site/quote.mjs';
import { CONTACT } from '@/lib/site/links.mjs';
import { ecommerceData, pushEvent } from '@/lib/site/analytics.mjs';

const SiteContext = createContext(null);

/** Everything the new design's interactive pieces share. */
export function useSite() {
  const value = useContext(SiteContext);
  if (!value) throw new Error('useSite must be used inside <SiteProvider>');
  return value;
}

/**
 * State for one page of the new design: language, currency, cart, the open
 * panels and the toast.
 *
 * The cart lives in localStorage (see use-cart), so it survives moving between
 * pages even though each page mounts its own provider. Prices are worked out
 * by `quoteCart`, which runs checkout's own pricing; nothing here does sums.
 */
export default function SiteProvider({ lang, exchangeRate, deal, dealView = null, children }) {
  const t = useMemo(() => translator(lang), [lang]);
  const [currency, setCurrency] = useCurrency();
  const { cart, hydrated, add, setQty, remove, clear } = useCart();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState('');

  const money = useCallback(
    (amountCrc, amountUsd) => formatMoney(amountCrc, amountUsd, currency),
    [currency],
  );

  /** A colón amount in the shopper's currency, converted at the catalog's rate. */
  const moneyCrc = useCallback(
    (amountCrc) => formatMoney(amountCrc, amountCrc / exchangeRate, currency),
    [currency, exchangeRate],
  );

  /** Any cart, priced as checkout would price it — for "if you add this" figures. */
  const quoteFor = useCallback(
    (lines) => quoteCart(lines, { currency, exchangeRate, deal }),
    [currency, exchangeRate, deal],
  );
  const quote = useMemo(() => quoteFor(cart), [quoteFor, cart]);

  const whatsapp = useCallback(
    (message) => `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`,
    [],
  );

  const addToCart = useCallback((compound, variant, qty = 1) => {
    add(compound, variant, qty);
    setToast(t(`${compound.name} ${variant.size} added`));
    pushEvent({
      event: 'add_to_cart',
      ecommerce: ecommerceData([{ name: compound.name, size: variant.size, priceUsd: variant.priceUsd, qty, category: compound.category }]),
    });
  }, [add, t]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // The cart sheet and the menu drawer are modal: the page behind must not
  // scroll under the thumb. The design locks it with this class.
  useEffect(() => {
    const locked = sheetOpen || drawerOpen;
    document.body.classList.toggle('noscroll', locked);
    if (!locked) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') { setSheetOpen(false); setDrawerOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen, drawerOpen]);

  const value = useMemo(() => ({
    lang, t, currency, setCurrency, exchangeRate, deal, dealView,
    cart, hydrated, addToCart, setQty, remove, clear, quote, quoteFor,
    money, moneyCrc, whatsapp,
    sheetOpen, setSheetOpen, drawerOpen, setDrawerOpen, searchOpen, setSearchOpen,
    toast, setToast,
  }), [
    lang, t, currency, setCurrency, exchangeRate, deal, dealView,
    cart, hydrated, addToCart, setQty, remove, clear, quote, quoteFor,
    money, moneyCrc, whatsapp, sheetOpen, drawerOpen, searchOpen, toast,
  ]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
