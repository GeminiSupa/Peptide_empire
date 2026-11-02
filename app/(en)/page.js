import { getPublishedPage } from '@/lib/site-cms';
import SiteShell from '@/components/site/site-shell';
import HomePage from '@/components/site/home-page';
import { getSiteData } from '@/lib/site/data';
import { liveH1 } from '@/lib/site/live-h1';
import homeData from '@/data/pages/homeBlocks.json';
import { alternates } from '@/lib/routes';
import { metadataForPath } from '@/lib/seo';

/**
 * English home at `/` — the new design's home page (docs/design/).
 *
 * The title and description still come from the CMS, so the owner's admin keeps
 * control of the metadata on the site's most important indexed URL, and the H1
 * is the live page's own.
 */
const sourcePage = homeData.pages[0];

export async function generateMetadata() {
  const page = await getPublishedPage(sourcePage);
  const alt = alternates('/');
  return metadataForPath('/', {
    title: page.head.title_en,
    description: page.head.description_en,
    en: alt.en,
    es: alt.es,
  });
}

export default async function HomeEn() {
  const [page, site] = await Promise.all([getPublishedPage(sourcePage), getSiteData('en')]);
  return (
    <SiteShell lang="en" altHref="/es/">
      <HomePage lang="en" h1={liveH1(page, 'en')} site={site} />
    </SiteShell>
  );
}
