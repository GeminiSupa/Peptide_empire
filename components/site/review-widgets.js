'use client';

import { useEffect, useRef } from 'react';

/**
 * The live review widgets, embedded exactly as the prototype embeds them: the
 * Trustpilot TrustBox and the Shopper Approved seal and rotating widget. They
 * are the vendors' own scripts and markup, not images of them.
 */

const TRUSTPILOT_SCRIPT = 'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js';
const TRUSTPILOT_BUSINESS_UNIT = '6a035f4f4881dbf345f5fc8f';
const SHOPPER_APPROVED_SCRIPT = 'https://www.shopperapproved.com/widgets/42340/merchant/rotating-widget/default.js';
const SHOPPER_APPROVED_REVIEWS = 'https://www.shopperapproved.com/reviews/peptidescostarica.net';

function loadScript(src, id) {
  return new Promise((resolve) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded) resolve();
      else existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => { script.dataset.loaded = '1'; resolve(); }, { once: true });
    document.head.appendChild(script);
  });
}

/**
 * Trustpilot's "Micro Review Count" TrustBox. The link inside is what shows
 * until Trustpilot's script swaps the live widget in, and what a visitor with
 * scripts blocked sees.
 */
export function TrustpilotCount({ dark = false, lang = 'en', className = 'tpcount' }) {
  const ref = useRef(null);
  useEffect(() => {
    let cancelled = false;
    loadScript(TRUSTPILOT_SCRIPT, 'tp-bootstrap').then(() => {
      if (!cancelled && ref.current && window.Trustpilot) window.Trustpilot.loadFromElement(ref.current, true);
    });
    return () => { cancelled = true; };
  }, []);
  return (
    <div
      ref={ref}
      className={`trustpilot-widget ${className}`}
      data-locale={lang === 'es' ? 'es-ES' : 'en-US'}
      data-template-id="5419b6a8b0d04a076446a9ad"
      data-businessunit-id={TRUSTPILOT_BUSINESS_UNIT}
      data-style-height="24px"
      data-style-width="100%"
      data-theme={dark ? 'dark' : 'light'}
      data-min-review-count="10"
      data-style-alignment="left"
    >
      <a className="tpfb3" href="https://www.trustpilot.com/review/peptidescostarica.net" target="_blank" rel="noopener noreferrer">
        {lang === 'es' ? 'Vea nuestras ' : 'See our '}
        <u>{lang === 'es' ? 'reseñas' : 'reviews'}</u>
        {lang === 'es' ? ' en ' : ' on '}
        <img src={dark ? '/site/trustpilot-wordmark-white.webp' : '/site/trustpilot-wordmark.webp'} alt="Trustpilot" />
      </a>
    </div>
  );
}

/** The Shopper Approved seal, which opens the reviews in a popup as the vendor's own code does. */
export function ShopperSeal({ className = 'hseal', bare = false }) {
  const onClick = (event) => {
    const width = window.innerWidth < 1400 ? 620 : 940;
    const popup = window.open(
      SHOPPER_APPROVED_REVIEWS,
      'shopperapproved',
      `location=no,scrollbars=yes,width=${width},height=${window.screen.availHeight - 90},menubar=no,toolbar=no`,
    );
    if (popup) event.preventDefault();
  };
  const link = (
    <a
      href={SHOPPER_APPROVED_REVIEWS}
      className="shopperlink new-sa-seals placement-default"
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
    >
      <img src="https://www.shopperapproved.com/svg-seal/42340/default-sa-seal.svg" style={{ borderRadius: 4 }} alt="Customer Reviews" />
    </a>
  );
  // `bare` is the link alone, for markup that already has its wrapper.
  if (bare) return link;
  return <div className={className}>{link}</div>;
}

/**
 * Shopper Approved's rotating review widget. It renders into the element with
 * id `SA_wrapper_default`, so a page shows at most one.
 */
export function ShopperRotating({ lang = 'en' }) {
  useEffect(() => {
    window.sa_interval = 5000;
    document.querySelectorAll('script[data-sa]').forEach((script) => script.remove());
    const script = document.createElement('script');
    script.src = `${SHOPPER_APPROVED_SCRIPT}?v=${Date.now()}`;
    script.dataset.sa = '1';
    document.head.appendChild(script);
  }, []);
  return (
    <div className="sawrap">
      <div id="SA_wrapper_default" className="SA__wrapper" lang={lang} />
    </div>
  );
}
