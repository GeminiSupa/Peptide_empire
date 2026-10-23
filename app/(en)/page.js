import { getPublishedPage } from '@/lib/site-cms';
import Storefront from '@/components/storefront/storefront';
import { getStorefrontCatalog } from '@/lib/storefront/feed';
import homeData from '@/data/pages/homeBlocks.json';
import { alternates } from '@/lib/routes';
import { metadataForPath } from '@/lib/seo';

/**
 * English home at `/` — the shop.
 *
 * This URL used to render the harvested WordPress marketing home through the
 * block pipeline. It is now the storefront: the owner's decision (23 Oct 2026)
 * is that this site becomes the catalog. The marketing home's content is
 * untouched in the CMS and still in git history; it is simply no longer what
 * `/` renders.
 *
 * The title and description still come from the CMS, so the owner's admin keeps
 * control of the metadata on the site's most important indexed URL.
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

export default async function HomeEn({ searchParams }) {
  const [{ compounds, exchangeRate, ok }, params] = await Promise.all([
    getStorefrontCatalog(),
    searchParams,
  ]);

  return (
    <Storefront
      compounds={compounds}
      exchangeRate={exchangeRate}
      feedOk={ok}
      lang="en"
      initialSlug={typeof params?.p === 'string' ? params.p : ''}
      homeHref="/"
      altHref="/es/"
    />
  );
}
