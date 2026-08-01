import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import homeData from '@/data/pages/homeBlocks.json';

/**
 * Spanish home at `/es/` — the live site's own path.
 *
 * Renders through the same block pipeline as the other 316 pages. It previously
 * used a bespoke harvest into 11 hand-authored section components whose layout
 * was invented rather than reproduced, and which captured text only — none of
 * the page's 45 images and only 12 of its 63 headings.
 */
const page = homeData.pages[0];

export default function HomeEs() {
  return (
    <>
      <SiteHeader lang="es" path="/es/" />
      <main className="flex-1">
        <Sections lang="es" sections={page.sections} />
      </main>
      <SiteFooter lang="es" />
    </>
  );
}
