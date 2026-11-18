import { getPublishedPage } from '@/lib/site-cms';
import SiteShell from '@/components/site/site-shell';
import HomePage from '@/components/site/home-page';
import { getSiteData } from '@/lib/site/data';
import { liveH1 } from '@/lib/site/live-h1';
import homeData from '@/data/pages/homeBlocks.json';
import { alternates } from '@/lib/routes';
import { metadataForPath } from '@/lib/seo';
import { currentSite } from '@/lib/site/current-site.mjs';

/** Spanish home at `/es/`; see the English page for notes. */
const sourcePage = homeData.pages[0];

/** Stated explicitly rather than inherited, so it cannot drift from the English side. */
export async function generateMetadata() {
  const [page, site] = await Promise.all([getPublishedPage(sourcePage), currentSite()]);
  const alt = alternates('/es/');
  return await metadataForPath('/es/', {
    title: page.head.title_es,
    description: page.head.description_es,
    en: alt.en,
    es: alt.es,
  }, site);
}

export default async function HomeEs() {
  const [page, site, country] = await Promise.all([
    getPublishedPage(sourcePage),
    getSiteData('es'),
    currentSite(),
  ]);
  return (
    <SiteShell lang="es" altHref="/">
      <HomePage lang="es" h1={liveH1(page, 'es')} site={site} country={country} />
    </SiteShell>
  );
}
