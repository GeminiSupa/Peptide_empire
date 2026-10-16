import { t } from '@/lib/i18n';
import { imageUrl } from '@/lib/images';

const PLATFORM_LOGOS = {
  Google: '/wp-content/uploads/2026/03/4de77119-3608-45d9-b440-e34488b88e61.png',
  Trustpilot: '/wp-content/uploads/2026/08/icons8-trustpilot.svg',
};

const TRUSTPILOT_LOGO = '/wp-content/uploads/2026/08/icons8-trustpilot.svg';

const COPY = {
  en: { ratingOnly: '5-star rating', outOf: 'out of 5', reviews: 'Independent rating' },
  es: { ratingOnly: 'Calificación de 5 estrellas', outOf: 'de 5', reviews: 'Calificación independiente' },
};

function RatingSquares({ score, best = 5, large = false }) {
  const normalized = Math.max(0, Math.min(best, Number(score) || 0));
  return (
    <span aria-label={`Rated ${normalized} out of ${best}`} className={`flex ${large ? 'gap-1.5' : 'gap-1'}`} role="img">
      {Array.from({ length: best }, (_, index) => {
        const fill = Math.max(0, Math.min(1, normalized - index)) * 100;
        return (
          <span
            aria-hidden="true"
            className={`flex items-center justify-center rounded-[3px] leading-none text-white ${large ? 'h-8 w-8 text-lg' : 'h-5 w-5 text-[12px]'}`}
            key={index}
            style={{ background: `linear-gradient(90deg, #00b67a ${fill}%, #d8dde3 ${fill}%)` }}
          >
            ★
          </span>
        );
      })}
    </span>
  );
}

export function TrustpilotSummary({ content, lang }) {
  const score = Number(content.score) || 0;
  return (
    <a
      className="trustpilot-summary mx-auto mt-6 flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-5 text-center text-white transition hover:bg-white/15"
      href={content.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="text-lg font-bold">Trustpilot</span>
      <RatingSquares large score={score} />
      <span className="text-sm font-semibold">
        {lang === 'es' ? `Calificación ${score} de 5` : `Rated ${score} out of 5`}
      </span>
      <span className="text-xs font-semibold underline underline-offset-2">
        {lang === 'es' ? 'Leer reseñas' : 'Read reviews'}
      </span>
    </a>
  );
}

export default function ReviewWall({ content, lang }) {
  const reviews = content.reviews ?? [];
  if (!reviews.length) return null;

  const copy = COPY[lang] || COPY.en;
  const summary = t(content, 'summary', lang);
  const aggregate = content.aggregate;

  return (
    <div className="review-wall mt-8 w-full">
      {summary && (
        <p className="text-center text-sm font-semibold text-white/80">{summary}</p>
      )}

      <ul className={`${summary ? 'mt-5' : ''} grid gap-4 sm:grid-cols-2`}>
        {reviews.map((review, i) => (
          <li
            className="flex flex-col rounded-2xl border border-white/15 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
            key={`${review.author}-${i}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white ring-4 ring-primary/10">
                  {review.author?.trim()?.charAt(0) || 'P'}
                </span>
                <p className="min-w-0 text-sm font-bold leading-5 text-slate-950">{review.author}</p>
              </div>
              {review.source && (
                <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-slate-600">
                  {PLATFORM_LOGOS[review.source] && (
                    <img alt="" aria-hidden="true" className="h-5 w-5 object-contain" loading="lazy" src={imageUrl(PLATFORM_LOGOS[review.source])} />
                  )}
                  {review.source}
                </span>
              )}
            </div>

            {review.stars > 0 && (
              <p
                aria-label={`Rated ${review.stars} out of 5`}
                className="mt-4 text-base tracking-[0.08em] text-amber-400"
                role="img"
              >
                {'★'.repeat(review.stars)}
                <span className="text-slate-300">{'★'.repeat(Math.max(0, 5 - review.stars))}</span>
              </p>
            )}

            <p className={`mt-2 text-sm leading-6 ${review.text ? 'text-slate-800' : 'font-semibold text-slate-500'}`}>
              {review.text || copy.ratingOnly}
            </p>
            {review.href && (
              <a className="mt-3 w-fit text-xs font-bold text-primary underline-offset-2 hover:underline" href={review.href} rel="noopener noreferrer" target="_blank">
                {lang === 'es' ? `Ver en ${review.source}` : `Read on ${review.source}`}
              </a>
            )}
          </li>
        ))}
      </ul>

      {aggregate && (
        <a
          className="mx-auto mt-6 flex w-fit flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-white transition hover:bg-white/15"
          href={(lang === 'es' ? aggregate.href_es : aggregate.href) || aggregate.href}
          rel="noopener noreferrer"
          target="_blank"
        >
          <img alt="" aria-hidden="true" className="h-7 w-7" src={imageUrl(TRUSTPILOT_LOGO)} />
          <span>
            <span className="block text-[11px] font-bold tracking-[0.12em] text-white/65 uppercase">{copy.reviews}</span>
            <span className="block text-sm font-extrabold">{aggregate.source}</span>
          </span>
          <RatingSquares best={aggregate.best || 5} score={aggregate.score} />
          <span className="text-sm font-bold">{aggregate.score} {copy.outOf}</span>
        </a>
      )}
    </div>
  );
}
