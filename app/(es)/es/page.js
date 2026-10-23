import { getPublishedPage } from '@/lib/site-cms';
import Storefront from '@/components/storefront/storefront';
import { getStorefrontCatalog } from '@/lib/storefront/feed';
import homeData from '@/data/pages/homeBlocks.json';
import { alternates } from '@/lib/routes';
import { metadataForPath } from '@/lib/seo';

/**
 * Spanish home at `/es/` — the shop, on the live site's own path.
 *
 * The English counterpart carries the note on why `/` is now the storefront.
 * The Spanish copy is the designer's own, looked up while rendering rather
 * than swapped into the DOM afterwards; see `lib/storefront/i18n.mjs`.
 */
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

export default async function HomeEs({ searchParams }) {
  const [{ compounds, exchangeRate, ok }, params] = await Promise.all([
    getStorefrontCatalog(),
    searchParams,
  ]);

  return (
    <Storefront
      compounds={compounds}
      exchangeRate={exchangeRate}
      feedOk={ok}
      lang="es"
      initialSlug={typeof params?.p === 'string' ? params.p : ''}
      homeHref="/es/"
      altHref="/"
    />
  );
}
