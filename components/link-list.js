import Link from 'next/link';
import { t } from '@/lib/i18n';
import { localePath } from '@/lib/routes';
import { posts } from '@/content/pages/posts';
import { products } from '@/content/pages/products';
import guideData from '@/data/pages/guide.json';

/**
 * An index of pages, resolved from the site's own harvested data.
 *
 * The section stores only a SOURCE name, never a copy of the list. Publishing a
 * guide or product and re-running its harvest updates every index that lists
 * it, with no page edit — which is the whole reason /blog/, /peptide-guides/
 * and /shop/ could not be harvested as static content.
 *
 * An unknown source renders nothing rather than crashing, matching how the rest
 * of the vocabulary behaves.
 */
const SOURCES = {
  blogPost: () => posts,
  guide: () => guideData.pages,
  wooProduct: () => products,
};

/** The link text for an entry: its own page title, in the requested language. */
function titleFor(page, lang) {
  const fromHead = t(page.head ?? {}, 'title', lang);
  if (fromHead) {
    // Page titles carry the site suffix; the list wants just the article name.
    return fromHead.split('|')[0].split('–')[0].trim() || fromHead;
  }
  return page.store?.name ?? page.slug;
}

export default function LinkList({ content, lang }) {
  const entries = SOURCES[content.source]?.() ?? [];
  if (!entries.length) return null;

  const items = entries
    .map((page) => ({ page, title: titleFor(page, lang) }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2">
      {items.map(({ page, title }) => (
        <li key={page.en}>
          <Link
            className="flex h-full flex-col rounded-xl border border-primary/10 bg-white p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
            href={localePath(page.en, lang)}
          >
            <span className="text-sm font-bold text-primary">{title}</span>
            {t(page.head ?? {}, 'description', lang) && (
              <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">
                {t(page.head, 'description', lang)}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
