import { t } from '@/lib/i18n';

/**
 * The customer reviews under "Customer Success Stories".
 *
 * Rendered as a static wall rather than the live site's carousel, so every
 * review is in the served HTML and readable without JavaScript — the same
 * reasoning as components/faq-accordion.js and components/category-tabs.js.
 *
 * The review text is NOT translated and has no `_es` variant: these are
 * customers' own words, and running them through machine translation would
 * change what a named person is quoted as saying. The live site leaves them in
 * whichever language they were written in, so the Spanish page shows the same
 * mixture the original does.
 *
 * See extractReviews() in scripts/harvest-blocks.mjs for why these have to be
 * scraped from the page DOM instead of the Elementor widget tree.
 */
export default function ReviewWall({ content, lang }) {
  const reviews = content.reviews ?? [];
  if (!reviews.length) return null;

  const summary = t(content, 'summary', lang);

  return (
    <div className="mt-10 w-full">
      {summary && (
        <p className="text-center text-sm font-semibold text-text-muted">{summary}</p>
      )}

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {reviews.map((review, i) => (
          <li
            className="flex min-h-[206px] flex-col rounded-xl bg-[#f7f7f7] p-5 shadow-sm"
            key={`${review.author}-${i}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {review.author?.trim()?.charAt(0) || 'P'}
                </span>
                <div>
                  <p className="text-sm font-bold text-black">{review.author}</p>
                  <p className="text-xs text-text-muted">1 month ago</p>
                </div>
              </div>
              {review.source && (
                <span className="shrink-0 text-lg font-bold text-[#4285F4]" aria-label={review.source}>
                  G
                </span>
              )}
            </div>

            {review.stars > 0 && (
              <p
                aria-label={`Rated ${review.stars} out of 5`}
                className="mt-2 text-sm text-amber-400"
                role="img"
              >
                {'★'.repeat(review.stars)}
                <span className="text-slate-300">{'★'.repeat(Math.max(0, 5 - review.stars))}</span>
              </p>
            )}

            <p className="mt-2 flex-1 text-sm leading-relaxed text-black">
              {review.text || 'This user only left a rating.'}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
