import { allPages } from '@/content/pages/registry';
import { products } from '@/content/pages/products';
import { posts } from '@/content/pages/posts';
import { categories } from '@/content/pages/categories';
import { localePath } from '@/lib/routes';
import { t } from '@/lib/i18n';

/**
 * A title index of every page on the site, for the header search.
 *
 * Built at build time from the harvested content, so search covers what the
 * site actually contains rather than pointing at a WordPress database that this
 * project does not have.
 *
 * Titles only. Full-text over ~200,000 words would need a real search index
 * and a server to query it; that is a separate piece of work, and shipping the
 * whole corpus to the browser to fake it would be worse.
 */

/** Page titles carry the site suffix; the search list wants the page name. */
function cleanTitle(raw, fallback) {
  const title = (raw || '').split('|')[0].split('–')[0].trim();
  return title || fallback;
}

export function searchIndex(lang) {
  const seen = new Set();
  const entries = [];

  const add = (enPath, title) => {
    if (!enPath || !title || seen.has(enPath)) return;
    seen.add(enPath);
    entries.push({ href: localePath(enPath, lang), title });
  };

  for (const page of allPages) {
    add(page.en, cleanTitle(t(page.head ?? {}, 'title', lang), page.slug));
  }
  for (const page of posts) {
    add(page.en, cleanTitle(t(page.head ?? {}, 'title', lang), page.slug));
  }
  for (const page of products) {
    add(page.en, page.store?.name ?? cleanTitle(t(page.head ?? {}, 'title', lang), page.slug));
  }
  for (const page of categories) {
    add(page.en, cleanTitle(t(page.head ?? {}, 'title', lang), page.slug));
  }

  return entries.sort((a, b) => a.title.localeCompare(b.title));
}
