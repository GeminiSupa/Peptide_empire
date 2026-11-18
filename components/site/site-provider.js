'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { formatMoney, translator } from '@/lib/storefront/i18n.mjs';
import { useCart, useCurrency } from '@/lib/storefront/use-cart';
import { lineFor, quoteCart } from '@/lib/site/quote.mjs';
import { flashCoversProduct } from '@/lib/site/deal-view.mjs';
import { CONTACT } from '@/lib/site/links.mjs';
import { ecommerceData, pushEvent } from '@/lib/site/analytics.mjs';
import { promoFromReply, promoFromUrl, readPromo, validatePromo, writePromo } from '@/lib/site/promo.mjs';
import { whatsappHref } from '@/lib/site/whatsapp-link.mjs';

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
export default function SiteProvider({ lang, country = null, exchangeRate, deal, dealView = null, flashView = null, contact = CONTACT, children }) {
  const t = useMemo(() => translator(lang, country), [lang, country]);
  const [currency, setCurrency] = useCurrency();
  const { cart, hydrated, add, setQty: setCartQty, remove: removeLine, clear } = useCart();

  // GA4 `remove_from_cart` (Belhassen's spec; the catalog has no such event
  // yet), in the same `ecommerce` shape as add_to_cart.
  const pushRemoval = useCallback((line, qty) => {
    if (!line || qty <= 0) return;
    pushEvent({
      event: 'remove_from_cart',
      ecommerce: ecommerceData([{ name: line.name, size: line.size, priceUsd: line.priceUsd, qty, category: line.category }]),
    });
  }, []);
  const setQty = useCallback((product, qty) => {
    const line = cart.find((entry) => entry.product === product);
    const wanted = Math.max(0, Math.floor(Number(qty) || 0));
    if (line && wanted < line.qty) pushRemoval(line, line.qty - wanted);
    setCartQty(product, qty);
  }, [cart, pushRemoval, setCartQty]);
  const remove = useCallback((product) => {
    const line = cart.find((entry) => entry.product === product);
    if (line) pushRemoval(line, line.qty);
    removeLine(product);
  }, [cart, pushRemoval, removeLine]);
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

  // The promo / affiliate code, as the catalog validated it. Kept in this
  // browser so it survives moving between pages, as the cart does.
  const [promo, setPromo] = useState(null);
  useEffect(() => {
    setPromo(readPromo());
  }, []);
  const savePromo = useCallback((next) => {
    setPromo(next);
    writePromo(next);
  }, []);

  /**
   * Check `code` with the catalog and keep it if it is valid, or valid once the
   * cart is big enough. Returns the catalog's answer for the cart to show.
   */
  const applyPromo = useCallback(async (code, lines = cart) => {
    const items = lines.map((line) => ({ product: line.product, qty: line.qty }));
    const reply = await validatePromo(code, { lang, items });
    if (reply.valid || reply.pending) savePromo(promoFromReply(reply));
    return reply;
  }, [cart, lang, savePromo]);
  const removePromo = useCallback(() => savePromo(null), [savePromo]);

  // An affiliate or QR link carries its code in the URL (?promo=, as the
  // catalog reads it). Applied on landing, quietly: a bad code in a link is
  // the link's fault, not the shopper's.
  useEffect(() => {
    const code = promoFromUrl(window.location.search);
    if (code) applyPromo(code, []).catch(() => {});
    // Once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Any cart, priced as checkout would price it — for "if you add this" figures. */
  const quoteFor = useCallback(
    (lines) => quoteCart(lines, { currency, exchangeRate, deal, promo }),
    [currency, exchangeRate, deal, promo],
  );
  const quote = useMemo(() => quoteFor(cart), [quoteFor, cart]);

  /**
   * One vial's price during a flash sale, as checkout charges it, formatted in
   * the shopper's currency — for product cards, which otherwise show the shelf
   * price. Null when no flash covers the vial or checkout gives it no deal.
   */
  const flashPriceFor = useCallback((compound, variant) => {
    if (!variant || !flashCoversProduct(flashView, [variant.product])) return null;
    const single = quoteFor([lineFor(compound, variant, 1)]);
    if (!single?.dealApplied || !(single.savings > 0)) return null;
    const charged = single.subtotal - single.savings;
    return formatMoney(charged, charged, currency);
  }, [flashView, quoteFor, currency]);

  const whatsapp = useCallback(
    (message) => whatsappHref(contact.whatsapp, message),
    [contact.whatsapp],
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
    lang, country, t, currency, setCurrency, exchangeRate, deal, dealView, flashView,
    cart, hydrated, addToCart, setQty, remove, clear, quote, quoteFor, flashPriceFor,
    promo, applyPromo, removePromo, contact,
    money, moneyCrc, whatsapp,
    sheetOpen, setSheetOpen, drawerOpen, setDrawerOpen, searchOpen, setSearchOpen,
    toast, setToast,
  }), [
    lang, country, t, currency, setCurrency, exchangeRate, deal, dealView, flashView,
    cart, hydrated, addToCart, setQty, remove, clear, quote, quoteFor, flashPriceFor,
    promo, applyPromo, removePromo, contact,
    money, moneyCrc, whatsapp, sheetOpen, drawerOpen, searchOpen, toast,
  ]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
