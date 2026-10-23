'use client';

import { useEffect, useRef, useState } from 'react';
import Ms from '@/components/storefront/icon';
import WhatsAppIcon from '@/components/storefront/whatsapp-glyph';
import { ANNOUNCEMENTS } from '@/lib/storefront/content.mjs';
import { imageUrl } from '@/lib/images';

/**
 * The announcement bar and the sticky header.
 *
 * The free-delivery amount in the bar is passed in rather than written into
 * the copy: it is $200 at the catalog's current rate, so a fixed colón figure
 * would go stale the moment the rate moved.
 */
export default function StoreHeader({
  t,
  lang,
  currency,
  onCurrency,
  altHref,
  cartCount,
  freeShippingLabel,
  onOpenCart,
  onFocusSearch,
  whatsappHref,
  logoSrc,
  homeHref,
}) {
  const [prefOpen, setPrefOpen] = useState(false);
  const prefRef = useRef(null);

  // Close the menu on an outside click or Escape, the way a menu should
  // behave; without this it stays open behind the sheet.
  useEffect(() => {
    if (!prefOpen) return undefined;
    const onDown = (event) => {
      if (prefRef.current && !prefRef.current.contains(event.target)) setPrefOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setPrefOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [prefOpen]);

  return (
    <>
      <div className="announce">
        <div className="wrap">
          {ANNOUNCEMENTS.map((item) => (
            <span key={item.icon}>
              <Ms name={item.icon} />
              {t(item.text).replace('{amount}', freeShippingLabel)}
            </span>
          ))}
        </div>
      </div>

      <header className="top">
        <div className="wrap">
          <a href={homeHref} aria-label={t('Catalog home')}>
            {/* eslint-disable-next-line @next/next/no-img-element -- mirrored asset, no loader */}
            <img className="logo" src={imageUrl(logoSrc)} alt="Peptides Costa Rica" />
          </a>

          <div className="pref" ref={prefRef}>
            <button
              className="prefbtn"
              type="button"
              aria-haspopup="true"
              aria-expanded={prefOpen}
              aria-label={t('Language and currency')}
              onClick={() => setPrefOpen((open) => !open)}
            >
              <Ms name="language" />
              {`${lang.toUpperCase()} · ${currency === 'USD' ? 'US$' : '₡'}`}
            </button>

            <div className="prefmenu" hidden={!prefOpen}>
              <small>Language · Idioma</small>
              <div className="seg">
                <a href={lang === 'en' ? homeHref : altHref} aria-pressed={lang === 'en'}>English</a>
                <a href={lang === 'es' ? homeHref : altHref} aria-pressed={lang === 'es'}>Español</a>
              </div>
              <small>Currency · Moneda</small>
              <div className="seg">
                <button type="button" aria-pressed={currency === 'CRC'} onClick={() => onCurrency('CRC')}>
                  ₡ Colones
                </button>
                <button type="button" aria-pressed={currency === 'USD'} onClick={() => onCurrency('USD')}>
                  US$ Dollars
                </button>
              </div>
            </div>
          </div>

          <button className="icbtn" type="button" aria-label={t('Search')} onClick={onFocusSearch}>
            <Ms name="search" />
          </button>

          <button className="icbtn" type="button" aria-label={t('View my order')} onClick={onOpenCart}>
            <Ms name="shopping_bag" />
            <span className={`cnt${cartCount ? '' : ' zero'}`}>{cartCount}</span>
          </button>

          <a className="btn sm" href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon />
            <span>WhatsApp</span>
          </a>
        </div>
      </header>
    </>
  );
}
