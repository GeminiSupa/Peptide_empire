import { getPublishedPage } from '@/lib/site-cms';
import { notFound } from 'next/navigation';
import ProductRoute, { NewProductRoute, newProductFor, newProductMetadata, productFor } from '@/components/site/product-route';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import Container from '@/components/ui/container';
import ProductSummary from '@/components/product-summary';
import { byEnglishSlug, englishParams } from '@/content/pages/products';
import { alternates } from '@/lib/routes';
import { metaTitle } from '@/lib/page-title';
import { metadataForPath } from '@/lib/seo';

/**
 * English product pages at `/product/<slug>/` — the live site's own path.
 *
 * Display only. The catalog site owns the cart; see components/product-summary.
 */
// Open, so a compound the catalog adds later gets its page without a rebuild
// (newProductFor); any other unknown slug is still a 404.
export const dynamicParams = true;

export function generateStaticParams() {
  return englishParams();
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = await getPublishedPage(byEnglishSlug(slug));
  if (!page) {
    const product = await newProductFor(slug, 'en');
    return product ? newProductMetadata(product, 'en') : {};
  }
  const alt = alternates(page.en);
  return metadataForPath(page.en, {
    title: metaTitle(page, 'en'),
    description: page.head.description_en,
    en: alt.en,
    es: alt.es,
  });
}

export default async function ProductEn({ params }) {
  const { slug } = await params;
  const page = await getPublishedPage(byEnglishSlug(slug));
  if (!page) {
    const product = await newProductFor(slug, 'en');
    if (product) return <NewProductRoute lang="en" product={product} />;
    notFound();
  }

  // Product pages are in the new design; a page whose product the catalog
  // no longer sells keeps its old layout rather than 404ing.
  const product = await productFor(page, 'en');
  if (product) return <ProductRoute page={page} lang="en" product={product} />;

  return (
    <>
      <SiteHeader lang="en" path={page.en} />
      <main className="flex-1">
        <Container className="pt-10 sm:pt-14">
          <ProductSummary lang="en" product={page} />
        </Container>
        <Sections demoteH1 lang="en" sections={page.sections} />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
