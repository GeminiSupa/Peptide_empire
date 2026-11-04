'use client';

import { useEffect, useRef, useState } from 'react';
import { REVIEW_LINKS } from '@/lib/site/links.mjs';

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
 *
 * It follows the section it sits in: centred under a centred call to action,
 * left-aligned beside left-aligned copy, and white on a dark background. That
 * is read from the surrounding layout, so a section never has to say so.
 */
export function TrustpilotCount({ dark = false, lang = 'en', className = 'tpcount' }) {
  const ref = useRef(null);
  const [look, setLook] = useState({ dark, center: false, measured: false });

  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const style = getComputedStyle(parent);
    const center = style.textAlign === 'center'
      || (style.display.includes('flex') && style.flexDirection.startsWith('column') && style.alignItems === 'center');
    setLook({ dark: isLight(style.color), center, measured: true });
  }, []);

  useEffect(() => {
    if (!look.measured) return undefined;
    let cancelled = false;
    loadScript(TRUSTPILOT_SCRIPT, 'tp-bootstrap').then(() => {
      if (!cancelled && ref.current && window.Trustpilot) window.Trustpilot.loadFromElement(ref.current, true);
    });
    return () => { cancelled = true; };
  }, [look]);

  return (
    <div
      ref={ref}
      className={`trustpilot-widget ${className}${look.center ? ' tpcenter' : ''}`}
      data-locale={lang === 'es' ? 'es-ES' : 'en-US'}
      data-template-id="5419b6a8b0d04a076446a9ad"
      data-businessunit-id={TRUSTPILOT_BUSINESS_UNIT}
      data-style-height="24px"
      data-style-width="100%"
      data-theme={look.dark ? 'dark' : 'light'}
      data-min-review-count="10"
      data-style-alignment={look.center ? 'center' : 'left'}
    >
      <a className="tpfb3" href="https://www.trustpilot.com/review/peptidescostarica.net" target="_blank" rel="noopener noreferrer">
        {lang === 'es' ? 'Vea nuestras ' : 'See our '}
        <u>{lang === 'es' ? 'reseñas' : 'reviews'}</u>
        {lang === 'es' ? ' en ' : ' on '}
        <img src={look.dark ? '/site/trustpilot-wordmark-white.webp' : '/site/trustpilot-wordmark.webp'} alt="Trustpilot" />
      </a>
    </div>
  );
}

const GOOGLE_ICON = (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);

const FACEBOOK_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#1877F2" />
    <path fill="#fff" d="M15.1 12.6l.4-2.8h-2.7V8c0-.8.4-1.5 1.6-1.5h1.2V4.1s-1.1-.2-2.2-.2c-2.2 0-3.7 1.4-3.7 3.8v2.1H7.3v2.8h2.4V20c.5.1 1 .1 1.5.1s1 0 1.5-.1v-7.4h2.4z" />
  </svg>
);

/**
 * The Google and Facebook ratings beside the live Shopper Approved seal, as
 * one row of matching cards. Each card links to that platform's reviews.
 */
export function RatingBadges({ lang = 'en', className = '' }) {
  const reviews = lang === 'es' ? 'Reseñas en ' : '';
  const suffix = lang === 'es' ? '' : ' reviews';
  return (
    <div className={`ratebar${className ? ` ${className}` : ''}`}>
      {[['google', 'Google', GOOGLE_ICON], ['facebook', 'Facebook', FACEBOOK_ICON]].map(([key, name, icon]) => (
        <a className="ratechip" key={key} href={REVIEW_LINKS[key]} target="_blank" rel="noopener noreferrer">
          <span className="ratei">{icon}</span>
          <span className="ratet">
            <span><b>5.0</b><span className="st" aria-label="5 / 5">★★★★★</span></span>
            <small><span className="ratew">{reviews}</span>{name}<span className="ratew">{suffix}</span></small>
          </span>
        </a>
      ))}
      <span className="ratechip sachip"><ShopperSeal bare /></span>
    </div>
  );
}

/** Whether a computed `rgb(...)` text colour is a light one, i.e. sits on a dark background. */
function isLight(color) {
  const [r, g, b] = (color.match(/[\d.]+/g) || []).map(Number);
  if (b === undefined) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
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
