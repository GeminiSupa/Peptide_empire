import { getPublishedPage } from '@/lib/site-cms';
import SiteShell from '@/components/site/site-shell';
import HomePage from '@/components/site/home-page';
import { getSiteData } from '@/lib/site/data';
import { liveH1 } from '@/lib/site/live-h1';
import homeData from '@/data/pages/homeBlocks.json';
import { alternates } from '@/lib/routes';
import { metadataForPath } from '@/lib/seo';

/** Spanish home at `/es/`; see the English page for notes. */
const sourcePage = homeData.pages[0];

/** Stated explicitly rather than inherited, so it cannot drift from the English side. */
export async function generateMetadata() {
  const page = await getPublishedPage(sourcePage);
  const alt = alternates('/es/');
  return metadataForPath('/es/', {
    title: page.head.title_es,
    description: page.head.description_es,
    en: alt.en,
    es: alt.es,
  });
}

export default async function HomeEs() {
  const [page, site] = await Promise.all([getPublishedPage(sourcePage), getSiteData('es')]);
  return (
    <SiteShell lang="es" altHref="/">
      <HomePage lang="es" h1={liveH1(page, 'es')} site={site} />
    </SiteShell>
  );
}
