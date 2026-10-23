'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The cart, kept in this browser.
 *
 * A line is one compound at one strength, keyed by the catalog's exact
 * `product` string — the same string checkout prices by, so a line can never
 * drift from the row it represents.
 *
 * Nothing here is authoritative. The cart holds the prices it was rendered
 * with so the shopper sees stable numbers while they shop; checkout re-prices
 * everything from the database when the order is posted.
 */

const STORAGE_KEY = 'pcr_store_cart';
const PREF_KEY = 'pcr_store_pref';

function read(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing, or storage disabled. The cart still works for this
    // page view; it just will not survive a reload.
  }
}

export function useCart() {
  const [cart, setCart] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // Read after mount, not during render: the server has no localStorage, and
  // rendering a restored cart on the server would mismatch on hydration.
  useEffect(() => {
    const stored = read(STORAGE_KEY, []);
    if (Array.isArray(stored)) setCart(stored.filter((line) => line && line.product && line.qty > 0));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) write(STORAGE_KEY, cart);
  }, [cart, hydrated]);

  const add = useCallback((compound, variant, qty = 1) => {
    setCart((current) => {
      const existing = current.find((line) => line.product === variant.product);
      if (existing) {
        return current.map((line) => (
          line.product === variant.product
            ? { ...line, qty: Math.min(99, line.qty + qty) }
            : line
        ));
      }
      return [...current, {
        product: variant.product,
        slug: compound.slug,
        name: compound.name,
        size: variant.size,
        shelf: compound.shelf,
        priceUsd: variant.priceUsd,
        priceCrc: variant.priceCrc,
        image: variant.image || compound.image,
        qty: Math.min(99, qty),
        // Carried so the catalog's BAC-water rules can decide what free vials
        // this line earns without another lookup.
        freeBacWater: variant.freeBacWater,
        freeBacSizeMl: variant.freeBacSizeMl,
        freeBacVialsPerItem: variant.freeBacVialsPerItem,
      }];
    });
  }, []);

  const setQty = useCallback((product, qty) => {
    const wanted = Math.max(0, Math.min(99, Math.floor(Number(qty) || 0)));
    setCart((current) => (
      wanted === 0
        ? current.filter((line) => line.product !== product)
        : current.map((line) => (line.product === product ? { ...line, qty: wanted } : line))
    ));
  }, []);

  const remove = useCallback((product) => {
    setCart((current) => current.filter((line) => line.product !== product));
  }, []);

  const clear = useCallback(() => setCart([]), []);

  return { cart, hydrated, add, setQty, remove, clear };
}

/** The shopper's currency choice, remembered between visits. */
export function useCurrency(initial = 'CRC') {
  const [currency, setCurrency] = useState(initial);

  useEffect(() => {
    const pref = read(PREF_KEY, null);
    if (pref?.currency === 'USD' || pref?.currency === 'CRC') setCurrency(pref.currency);
  }, []);

  const choose = useCallback((next) => {
    setCurrency(next);
    write(PREF_KEY, { currency: next });
  }, []);

  return [currency, choose];
}
