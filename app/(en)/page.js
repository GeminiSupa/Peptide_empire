import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import homeData from '@/data/pages/homeBlocks.json';
import { alternates } from '@/lib/routes';

/**
 * English home at `/`.
 *
 * Renders through the same block pipeline as the other 316 pages. It previously
 * used a bespoke harvest into 11 hand-authored section components whose layout
 * was invented rather than reproduced, and which captured text only — none of
 * the page's 45 images and only 12 of its 63 headings.
 */
const page = homeData.pages[0];

/**
 * Without this the page inherited the root layout's `title.default`, which is
 * the SPANISH title — so the English home page, the site's most important URL,
 * announced itself in Spanish in the tab, the search result and every share
 * card. The correct English title was in the harvested data the whole time.
 */
export function generateMetadata() {
  const alt = alternates('/');
  return {
    title: page.head.title_en || undefined,
    description: page.head.description_en || undefined,
    alternates: { canonical: '/', languages: { 'en-US': alt.en, 'es-CR': alt.es } },
  };
}

export default function HomeEn() {
  return (
    <>
      <SiteHeader lang="en" path="/" />
      <main className="flex-1">
        <Sections lang="en" sections={page.sections} />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
