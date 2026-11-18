import { getPublishedPage } from '@/lib/site-cms';
import SiteShell from '@/components/site/site-shell';
import HomePage from '@/components/site/home-page';
import { getSiteData } from '@/lib/site/data';
import { liveH1 } from '@/lib/site/live-h1';
import homeData from '@/data/pages/homeBlocks.json';
import { alternates } from '@/lib/routes';
import { metadataForPath } from '@/lib/seo';
import { currentSite } from '@/lib/site/current-site.mjs';
import { brandSwap } from '@/lib/storefront/i18n.mjs';

/**
 * English home at `/` — the new design's home page (docs/design/).
 *
 * The title and description come from the CMS, re-branded to the current
 * country (brandSwap), and the H1 is the live page's own.
 */
const sourcePage = homeData.pages[0];

export async function generateMetadata() {
  const [page, site] = await Promise.all([getPublishedPage(sourcePage), currentSite()]);
  const alt = alternates('/');
  return await metadataForPath('/', {
    title: page.head.title_en,
    description: page.head.description_en,
    en: alt.en,
    es: alt.es,
  }, site);
}

export default async function HomeEn() {
  const [page, site, country] = await Promise.all([
    getPublishedPage(sourcePage),
    getSiteData('en'),
    currentSite(),
  ]);
  return (
    <SiteShell lang="en" altHref="/es/">
      <HomePage lang="en" h1={liveH1(page, 'en')} site={site} country={country} />
    </SiteShell>
  );
}
