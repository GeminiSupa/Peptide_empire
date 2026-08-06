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
    <div className="mt-10">
      {summary && (
        <p className="text-center text-sm font-semibold text-text-muted">{summary}</p>
      )}

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review, i) => (
          <li
            className="flex h-full flex-col rounded-xl border border-slate-200 bg-bg-card p-6 shadow-sm"
            key={`${review.author}-${i}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-primary">{review.author}</p>
              {review.source && (
                <span className="shrink-0 text-xs font-semibold text-text-muted">
                  {review.source}
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

            <p className="mt-4 flex-1 text-sm leading-relaxed text-text-muted">{review.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
