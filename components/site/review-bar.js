/**
 * The site's review scores, drawn one way everywhere: Trustpilot, Google,
 * Facebook and Shopper Approved as matching cards, each with its mark, score,
 * stars and review count, linking to that platform's reviews.
 *
 * `reviews` comes from lib/site/reviews.mjs (site data). `variant` "rows" is
 * the footer's stacked card; the default is a row of white cards that wraps.
 * No hooks, so server and client components can both draw it.
 */

import ShopperApprovedLogo from '@/components/site/shopper-approved-logo';

const MARKS = {
  trustpilot: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#00B67A" />
      <path fill="#fff" d="M12 4.6l2.1 5 5.4.4-4.1 3.5 1.3 5.3L12 16l-4.7 2.8 1.3-5.3-4.1-3.5 5.4-.4z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M15.1 12.6l.4-2.8h-2.7V8c0-.8.4-1.5 1.6-1.5h1.2V4.1s-1.1-.2-2.2-.2c-2.2 0-3.7 1.4-3.7 3.8v2.1H7.3v2.8h2.4V20c.5.1 1 .1 1.5.1s1 0 1.5-.1v-7.4h2.4z" />
    </svg>
  ),
  shopperApproved: (
    <ShopperApprovedLogo width={48} decorative />
  ),
};

const SOURCES = [
  ['trustpilot', 'Trustpilot'],
  ['google', 'Google'],
  ['facebook', 'Facebook'],
  ['shopperApproved', 'Shopper Approved'],
];

/** A platform's mark, for a one-line mention such as a proof strip. */
export function ReviewMark({ source }) {
  const isShopperApproved = source === 'shopperApproved';
  return (
    <span
      className="rbmark"
      style={isShopperApproved ? { width: '48px', height: '24px' } : undefined}
    >
      {MARKS[source]}
    </span>
  );
}

/** Five stars filled to the score, so a 4.6 reads as 4.6 and not as five. */
export function Stars({ score, lang = 'en' }) {
  const label = lang === 'es' ? `${score.toFixed(1)} de 5 estrellas` : `${score.toFixed(1)} out of 5 stars`;
  return (
    <span className="rstars" role="img" aria-label={label} style={{ '--rpct': `${Math.max(0, Math.min(100, (score / 5) * 100))}%` }}>
      <span aria-hidden="true">★★★★★</span>
    </span>
  );
}

export default function ReviewBar({ reviews, lang = 'en', variant = 'cards', className = '' }) {
  if (!reviews) return null;
  const reviewsWord = (count) => (lang === 'es' ? `${count} reseñas` : `${count} reviews`);
  return (
    <div className={`reviewbar rb-${variant}${className ? ` ${className}` : ''}`}>
      {SOURCES.map(([key, name]) => {
        const entry = reviews[key];
        if (!entry) return null;
        return (
          <a className="rbcard" key={key} href={entry.url} target="_blank" rel="noopener noreferrer">
            <ReviewMark source={key} />
            <span className="rbtext">
              <span className="rbscore"><b>{entry.score.toFixed(1)}</b><Stars score={entry.score} lang={lang} /></span>
              <small>{name}{entry.count ? <span className="rbcount"> · {reviewsWord(entry.count)}</span> : null}</small>
            </span>
          </a>
        );
      })}
    </div>
  );
}
