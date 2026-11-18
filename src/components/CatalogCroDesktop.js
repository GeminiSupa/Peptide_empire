"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BadgePercent, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBulkWholesaleCampaign } from '@/hooks/useBulkWholesaleCampaign';
import { dealCountdownParts } from '@/lib/bulkWholesaleCampaign.mjs';
import { STANDARD_FIVE_PLUS_PCT, tenPlusDiscountPct } from '@/lib/bulkDeal.mjs';
import { DEFAULT_LANDING_PAGE_SETTINGS } from '@/lib/landingContent';
import { FACEBOOK_REVIEW_URL, TRUSTPILOT_RATING, getFacebookReviewUrl, getTrustpilotReviewUrl } from '@/lib/businessLinks';
import styles from './CatalogCroDesktop.module.css';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8C3.9 20.5 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.7 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2.1C1.4 8.6 1 10.2 1 12s.4 3.4 1.1 4.9l3.6-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 2.1 15 1 12 1 7.7 1 3.9 3.5 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

function TrustpilotMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#00b67a" />
      <path fill="#fff" d="M12 4.6l2.1 6.2h6.5l-5.3 3.8 2 6.2L12 17l-5.3 3.8 2-6.2-5.3-3.8h6.5z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M13.4 19.5v-6.1h2.1l.3-2.4h-2.4V9.4c0-.7.2-1.2 1.2-1.2h1.3V6.1c-.2 0-1-.1-1.9-.1-1.9 0-3.1 1.1-3.1 3.2V11H8.8v2.4h2.1v6.1h2.5z" />
    </svg>
  );
}

/* Browsers may require a tap to play audio, so the slot needs a control.
   Drawn here rather than pulled from the icon set, like
   the review marks above. */
function SoundOnMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function SoundOffMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="m17 9 5 6" />
      <path d="m22 9-5 6" />
    </svg>
  );
}

function standingLines(lang) {
  const en = lang === 'en';
  const ten = tenPlusDiscountPct();
  return [
    en
      ? `Buy 5+ vials, save ${STANDARD_FIVE_PLUS_PCT}%`
      : `5+ viales, ${STANDARD_FIVE_PLUS_PCT}% de descuento`,
    en
      ? `Buy 10+ vials, save ${ten}%`
      : `10+ viales, ${ten}% de descuento`,
  ];
}

function offerLines(lang, campaign) {
  const live = campaign.active
    ? ((lang === 'en' ? campaign.summariesEn : campaign.summariesEs) || []).filter(Boolean)
    : [];
  // A live deal already states its own 5+ and 10+ rules. Adding the standing
  // 15% beside "20% off at 5 vials" would show two discounts for one order.
  if (live.length) return live.slice(0, 4);
  return standingLines(lang);
}

export function CatalogCroTicker({ lang = 'es' }) {
  const campaign = useBulkWholesaleCampaign();
  const en = lang === 'en';
  const ten = tenPlusDiscountPct();
  const live = campaign.active
    ? ((en ? campaign.summariesEn : campaign.summariesEs) || []).filter(Boolean)
    : [];
  const parts = live.length
    ? [...live]
    : [
      en ? `${STANDARD_FIVE_PLUS_PCT}% OFF 5+ Vials` : `${STANDARD_FIVE_PLUS_PCT}% en 5+ viales`,
      en ? `${ten}% OFF 10+ Vials` : `${ten}% en 10+ viales`,
      en ? 'Mix & Match Allowed' : 'Se pueden combinar',
    ];
  parts.push(en ? 'Free Shipping Over $200' : 'Envío gratis sobre $200');
  parts.push(en ? 'No Promo Code Needed' : 'Sin código de promoción');
  const line = parts.join('   •   ');
  // Long enough to read, short enough that the line is obviously moving.
  const duration = Math.max(16, Math.min(36, Math.round(line.length / 6)));

  return (
    <div className={styles.ticker}>
      <div className={styles.track} style={{ animationDuration: `${duration}s` }}>
        <p>{line}</p>
        <p aria-hidden="true">{line}</p>
      </div>
    </div>
  );
}

/**
 * The deal card's picture slot is a carousel: the slides sit side by side on a
 * track that slides left, rather than fading in place.
 *
 * `index` can run one past the last slide onto a clone of the first, so the
 * track always travels the same way instead of rewinding. On reaching the
 * clone the transition is switched off for one frame and the track is snapped
 * back to the start, which the eye cannot see because the clone and the first
 * slide are the same picture.
 *
 * The slot is the same size for every slide, so sliding never moves anything
 * else on the page.
 *
 * Nothing stops the timer. Two earlier versions did and both left the banner
 * stuck on one picture: first an on-screen check that could report "not
 * visible", then pausing while the card was hovered or focused, which never
 * un-paused after someone clicked a dot, because the click leaves the pointer
 * on the card and the focus on the button.
 */
function useVisualCarousel(count, intervalMs = 6000, slideMs = 600) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  // Bumped when someone picks a slide, so the timer starts counting from that
  // slide instead of moving on a moment later.
  const [restart, setRestart] = useState(0);
  // When true the auto-advance timer keeps ticking but does not move — used so
  // the product reel can finish before the carousel leaves it.
  const holdRef = useRef(false);

  useEffect(() => {
    if (count < 2) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return undefined;
    const timer = window.setInterval(() => {
      if (holdRef.current) return;
      setIndex((value) => value + 1);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [count, intervalMs, restart]);

  // Landed on the clone: let the slide finish, then jump back without animating.
  useEffect(() => {
    if (index < count) return undefined;
    const timer = window.setTimeout(() => {
      setAnimate(false);
      setIndex(0);
    }, slideMs + 50);
    return () => window.clearTimeout(timer);
  }, [index, count, slideMs]);

  // Re-arm the transition only after the browser has painted the jump.
  useEffect(() => {
    if (animate) return undefined;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAnimate(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [animate]);

  const goTo = useCallback((next) => {
    setIndex(next);
    setRestart((value) => value + 1);
  }, []);

  return { index, active: index % count, animate, goTo, holdRef };
}

const REEL_SLIDE = 0;
// How long the carousel will wait for the reel before moving on regardless.
// The clip is 17s; the slack covers a slow start on a weak connection.
const REEL_MAX_MS = 24000;
const PRODUCT_SLIDE = 1;
const SPONSOR_SLIDE = 2;

export function CatalogCroHero({ lang = 'es', rating = '', settings, links = {} }) {
  const campaign = useBulkWholesaleCampaign();
  const [now, setNow] = useState(() => Date.now());
  // Reel first so it is on screen immediately; vials → Ziggy after it finishes.
  const { index: slideIndex, active: slide, animate, goTo, holdRef } = useVisualCarousel(3, 7000);
  const reelRef = useRef(null);
  // Muted until the shopper turns sound on with the button.
  // Mirror the choice into a ref so toggling it does not restart the clip.
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(false);

  useEffect(() => {
    if (!campaign.validUntil) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [campaign.validUntil]);

  // Hold the carousel on the reel until the clip ends (no loop), then step on.
  // Keep inline playback and retry muted when the browser requires a tap.
  useEffect(() => {
    const video = reelRef.current;
    holdRef.current = slide === REEL_SLIDE;
    if (!video) return undefined;

    if (slide !== REEL_SLIDE) {
      video.pause();
      return undefined;
    }

    const tryPlay = () => {
      video.muted = !soundRef.current;
      const play = video.play();
      // A browser may refuse sound without a gesture. Left there the clip would
      // never start, never end, and the hold below would park the carousel on
      // this slide for good - so drop back to muted and play anyway.
      if (play?.catch) play.catch(() => {
        if (video.muted) return;
        video.muted = true;
        soundRef.current = false;
        setSoundOn(false);
        const retry = video.play();
        if (retry?.catch) retry.catch(() => {});
      });
    };

    // Rewinding and then waiting for 'loadeddata' parked the reel on its own
    // last frame every second time round. That event fires once per load and
    // never after a seek, while the seek itself can drop readyState below 2 for
    // long enough to take that branch - so the play was never asked for, the
    // clip never ended, and the hold below kept the carousel there for good.
    // Ask to play outright (the browser starts once it has data) and keep
    // 'canplay' beside 'loadeddata' so a cold start is still covered.
    if (Math.abs(video.currentTime) > 0.05) video.currentTime = 0;
    tryPlay();
    video.addEventListener('loadeddata', tryPlay, { once: true });
    video.addEventListener('canplay', tryPlay, { once: true });

    const onEnded = () => goTo(PRODUCT_SLIDE);
    video.addEventListener('ended', onEnded);

    // The hold stops the auto-advance timer, so anything that keeps the clip
    // from ending - autoplay refused, a stalled download - would strand the
    // carousel on this slide. Move on by the clock if that happens.
    const release = window.setTimeout(() => goTo(PRODUCT_SLIDE), REEL_MAX_MS);

    return () => {
      window.clearTimeout(release);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('loadeddata', tryPlay);
      video.removeEventListener('canplay', tryPlay);
    };
  }, [slide, goTo, holdRef]);

  // The track only ever travels forward on its own. Stepping back from the
  // first slide goes straight to the last one rather than through the clone,
  // which would need a silent jump first.
  const goPrev = useCallback(() => goTo(slide === REEL_SLIDE ? SPONSOR_SLIDE : slide - 1), [goTo, slide]);
  // One past the last slide is the clone, so forward from the sponsor keeps
  // sliding the same way instead of rewinding.
  const goNext = useCallback(() => goTo(slide + 1), [goTo, slide]);

  const toggleSound = useCallback(() => {
    const video = reelRef.current;
    const next = !soundRef.current;
    soundRef.current = next;
    setSoundOn(next);
    if (!video) return;
    video.muted = !next;
    // The click allows sound even when the browser blocked audible autoplay.
    if (next) {
      const play = video.play();
      if (play?.catch) play.catch(() => {});
    }
  }, []);

  const en = lang === 'en';
  const countdown = campaign.active ? dealCountdownParts(campaign.validUntil, now) : null;
  const showClock = countdown && !countdown.expired;
  const lines = offerLines(lang, campaign);
  const pressItems = (Array.isArray(settings?.pressItems) && settings.pressItems.length
    ? settings.pressItems
    : DEFAULT_LANDING_PAGE_SETTINGS.pressItems
  ).filter((item) => item?.outlet);
  const press = settings?.pressActive === false
    ? null
    : (pressItems.find((item) => /tico times/i.test(item.outlet || '')) || pressItems[0]);
  const quote = en ? '"Serving Quality peptide products"' : '"Productos de péptidos de calidad"';
  const score = rating ? String(rating) : TRUSTPILOT_RATING;
  // No GOOGLE_REVIEW_URL fallback: it meant an emptied admin field still linked
  // out from this badge alone. Empty renders the badge without an href, which is
  // not a link but keeps every .scores style.
  const googleHref = links.googleReviewUrl || links.googleMapsUrl;
  const trustpilotHref = getTrustpilotReviewUrl(lang, links);
  const facebookHref = getFacebookReviewUrl(links) || FACEBOOK_REVIEW_URL;

  const sponsorAlt = en
    ? 'Proudly sponsored by Peptidos Colombia - boxer Ziggy Myrie'
    : 'Orgullosamente patrocinado por Peptidos Colombia - el boxeador Ziggy Myrie';
  const reelAlt = en
    ? 'Peptidos Colombia product reel'
    : 'Video de productos Peptidos Colombia';
  const slideLabels = [
    en ? 'Product reel' : 'Video de producto',
    en ? 'Deal of the Week' : 'Oferta de la Semana',
    en ? 'Ziggy Myrie sponsorship' : 'Patrocinio de Ziggy Myrie',
  ];
  const pressHref = press?.url && !/ticotimes\.net/i.test(press.url) ? press.url : '';
  const PressTag = pressHref ? 'a' : 'span';
  // Rendered twice: once as the first slide and once as the clone that follows
  // the last one. The clone has to be identical, press badge included — a clone
  // missing it made the badge pop in every time the track looped.
  const slidePosition = (position) => ({
    left: `${position * 100}%`,
    zIndex: position === slideIndex ? 2 : 1,
  });
  const productSlide = (position, clone) => (
    <div className={styles.slide} style={slidePosition(position)} aria-hidden={clone ? 'true' : undefined}>
      <img src="/figma/catalog-hero-vials-crop.webp" alt="" />
      {press && (
        <PressTag
          className={styles.press}
          {...(clone ? { tabIndex: -1 } : {})}
          {...(pressHref ? { href: pressHref, target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <small>{en ? 'As seen in' : 'Visto en'}</small>
          <img src={press.logoUrl || '/tico-times-logo.png'} alt={clone ? '' : press.outlet} />
          {quote && <em>{quote}</em>}
        </PressTag>
      )}
    </div>
  );
  // Clone of the reel for the infinite-track seam. Paused — only the live
  // reelRef instance plays.
  const reelSlide = (position, { live = false, clone = false } = {}) => (
    <div
      className={`${styles.slide} ${styles.slideReel}`}
      style={slidePosition(position)}
      aria-hidden={clone || slide !== REEL_SLIDE ? 'true' : undefined}
    >
      <video
        ref={live ? reelRef : undefined}
        src="/catalog-hero-reel.mp4"
        muted={live ? !soundOn : true}
        playsInline
        autoPlay={live}
        preload={live ? 'auto' : 'metadata'}
        aria-label={clone ? '' : reelAlt}
      />
    </div>
  );

  return (
    <section className={styles.hero} aria-label={en ? 'Deal of the Week' : 'Oferta de la Semana'}>
      <div className={styles.copy}>
        <h2>{campaign.active
          ? (en ? 'Deal of the Week' : 'Oferta de la Semana')
          : (en ? 'Save more as you add vials' : 'Ahorra más al agregar viales')}</h2>
        <ul>
          {lines.map((line) => (
            <li key={line}>
              <BadgePercent size={18} aria-hidden="true" />
              <span>{line}</span>
            </li>
          ))}
          <li className={styles.note}>
            {en ? 'The best saving is applied. These do not combine.' : 'Se aplica el mayor ahorro. No se combinan.'}
          </li>
        </ul>
        <div className={styles.scores} aria-label={en ? 'Review scores' : 'Puntajes'}>
          <a href={trustpilotHref} target="_blank" rel="noopener noreferrer">
            <TrustpilotMark />
            <span>{score}</span>
          </a>
          <a href={facebookHref} target="_blank" rel="noopener noreferrer">
            <FacebookMark />
            <span>5.0</span>
          </a>
          <a
            href={googleHref || undefined}
            target={googleHref ? '_blank' : undefined}
            rel={googleHref ? 'noopener noreferrer' : undefined}
          >
            <GoogleMark />
            <span>5.0</span>
          </a>
        </div>
        <div className={styles.actions}>
          <Link className={styles.claim} href={`/deal-of-the-week?lang=${en ? 'en' : 'es'}`}>
            {en ? 'Claim offer' : 'Tomar la oferta'}
          </Link>
          {showClock && (
            <div className={styles.clock} role="timer">
              {countdown.days > 0 && (
                <span><b>{String(countdown.days).padStart(2, '0')}</b><small>{en ? 'Days' : 'Días'}</small></span>
              )}
              <span><b>{String(countdown.hours).padStart(2, '0')}</b><small>{en ? 'Hrs' : 'Hrs'}</small></span>
              <span><b>{String(countdown.minutes).padStart(2, '0')}</b><small>{en ? 'Min' : 'Min'}</small></span>
              {countdown.days < 1 && (
                <span><b>{String(countdown.seconds).padStart(2, '0')}</b><small>{en ? 'Sec' : 'Seg'}</small></span>
              )}
            </div>
          )}
        </div>
        <p className={styles.proof}>
          <span className={styles.faces} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {en
            ? '244 researchers started using our products last week alone.'
            : '244 investigadores empezaron a usar nuestros productos solo la semana pasada.'}
        </p>
      </div>
      <div className={`${styles.visual}${slide === SPONSOR_SLIDE ? ` ${styles.visualSponsor}` : ''}${slide === REEL_SLIDE ? ` ${styles.visualReel}` : ''}`}>
        <div
          className={styles.slides}
          style={{
            transform: `translate3d(-${slideIndex * 100}%, 0, 0)`,
            transition: animate ? undefined : 'none',
          }}
        >
          {reelSlide(REEL_SLIDE, { live: true })}
          {productSlide(PRODUCT_SLIDE, false)}
          <div className={`${styles.slide} ${styles.slideSponsor}`} style={slidePosition(SPONSOR_SLIDE)} aria-hidden={slide !== SPONSOR_SLIDE}>
            {/* One banner at every size; where the slot is a different shape the
                spare space is filled with the banner's own blue. Kept inside
                <picture> so the generic `.slide > img` rules do not apply. */}
            <picture>
              <img src="/ziggy-myrie-sponsor.webp" alt={sponsorAlt} />
            </picture>
          </div>
          {/* Clone of the first slide, so the track always travels one way. */}
          {reelSlide(3, { clone: true })}
        </div>
        <button
          type="button"
          className={`${styles.arrow} ${styles.arrowPrev}`}
          onClick={goPrev}
          aria-label={en ? 'Previous slide' : 'Diapositiva anterior'}
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${styles.arrow} ${styles.arrowNext}`}
          onClick={goNext}
          aria-label={en ? 'Next slide' : 'Siguiente diapositiva'}
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>
        {slide === REEL_SLIDE && (
          <button
            type="button"
            className={styles.sound}
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn
              ? (en ? 'Mute the video' : 'Silenciar el video')
              : (en ? 'Turn the video sound on' : 'Activar el sonido del video')}
          >
            {soundOn ? <SoundOnMark /> : <SoundOffMark />}
            <span>{soundOn ? (en ? 'Sound on' : 'Con sonido') : (en ? 'Sound off' : 'Sin sonido')}</span>
          </button>
        )}
        <div className={styles.dots} role="tablist" aria-label={en ? 'Slides' : 'Diapositivas'}>
          {slideLabels.map((label, dot) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={slide === dot}
              aria-label={label}
              className={slide === dot ? styles.dotOn : undefined}
              onClick={() => goTo(dot)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function CatalogCroTrust({ lang = 'es' }) {
  const en = lang === 'en';
  const items = en
    ? [
      'Free Shipping Over $200',
      '+3,400 verified researchers',
      'Research Grade. Verified Purity',
      'Lab-Tested & Certified',
    ]
    : [
      'Envío gratis sobre $200',
      '+3,400 investigadores verificados',
      'Grado de investigación. Pureza verificada',
      'Analizado en laboratorio y certificado',
    ];
  return (
    <ul className={styles.trust}>
      {items.map((item) => (
        <li key={item}><Check size={16} aria-hidden="true" /> {item}</li>
      ))}
    </ul>
  );
}

export function CatalogCroStats({ lang = 'es', productCount = 0, rating = '' }) {
  const en = lang === 'en';
  const products = Number(productCount) > 0 ? `${productCount}+` : '50+';
  const score = rating ? String(rating) : TRUSTPILOT_RATING;
  const items = [
    { value: '3400+', label: en ? 'Customers Served' : 'Clientes atendidos' },
    { value: `${score} ★`, label: en ? 'Average Rating' : 'Calificación promedio' },
    { value: products, label: en ? 'Peptide Products' : 'Productos de péptidos' },
    { value: '99.9%', label: en ? 'Purity Guaranteed' : 'Pureza garantizada' },
  ];

  return (
    <section className={styles.stats} aria-label={en ? 'Trusted by thousands' : 'La confianza de miles'}>
      <p>{en ? 'Trusted by thousands' : 'La confianza de miles'}</p>
      <div>
        {items.map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
