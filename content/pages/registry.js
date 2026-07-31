/**
 * One lookup across every harvested single-segment page group.
 *
 * The site puts several groups at the root of the URL space —
 * `/naranjo-alajuela/` (city), `/kpv-complete-guide/` (guide),
 * `/bpc-157-costa-rica/` (product lander) — so they share one Next.js route and
 * need one place that answers "what lives at this slug?".
 *
 * Each entry declares a `kind`, which picks the renderer:
 *   blocks  — a generic block list (components/blocks.js)
 *   article — a self-contained HTML article (components/guide-article.js)
 *
 * Adding a group means harvesting it and adding it to SOURCES. Nothing else
 * changes: routing, metadata and static params all read from here.
 */
import categoryData from '@/data/pages/category.json';
import cityData from '@/data/pages/city.json';
import coreData from '@/data/pages/core.json';
import guideData from '@/data/pages/guide.json';
import indexData from '@/data/pages/index.json';
import legalData from '@/data/pages/legal.json';
import landerPages from '@/data/pages/productLander.json';

const segment = (path) => path.replace(/^\/|\/$/g, '').split('/').pop();

const SOURCES = [
  { kind: 'blocks', group: 'city', pages: cityData.pages },
  { kind: 'blocks', group: 'productLander', pages: landerPages.pages },
  { kind: 'blocks', group: 'category', pages: categoryData.pages },
  { kind: 'blocks', group: 'core', pages: coreData.pages },
  { kind: 'blocks', group: 'legal', pages: legalData.pages },
  { kind: 'article', group: 'guide', pages: guideData.pages },
  // The three listing pages. Their bodies are a `link_list` section that
  // resolves from harvested data at build time, not a frozen list.
  { kind: 'blocks', group: 'index', pages: indexData.pages },
];

const BY_EN = new Map();
const BY_ES = new Map();

for (const { kind, group, pages } of SOURCES) {
  for (const page of pages) {
    const entry = { ...page, kind, group };
    const en = segment(page.en);
    // First registration wins, so a slug collision between groups cannot
    // silently swap one page for another. Collisions are reported below.
    if (!BY_EN.has(en)) BY_EN.set(en, entry);
    if (page.es) {
      const es = segment(page.es);
      if (!BY_ES.has(es)) BY_ES.set(es, entry);
    }
  }
}

export const byEnglishSlug = (slug) => BY_EN.get(slug) ?? null;
export const bySpanishSlug = (slug) => BY_ES.get(slug) ?? null;

export const englishParams = () => [...BY_EN.keys()].map((slug) => ({ slug }));
export const spanishParams = () => [...BY_ES.keys()].map((slug) => ({ slug }));

/** Every registered page, for sitemap and audit scripts. */
export const allPages = [...BY_EN.values()];

export const counts = SOURCES.reduce(
  (acc, s) => ({ ...acc, [s.group]: s.pages.length }),
  { total: BY_EN.size },
);
