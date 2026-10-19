import { getPublishedPage } from '@/lib/site-cms';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import Container from '@/components/ui/container';
import ProductSummary from '@/components/product-summary';
import { bySpanishSlug, spanishParams } from '@/content/pages/products';
import { alternates } from '@/lib/routes';
import { metaTitle } from '@/lib/page-title';
import { metadataForPath } from '@/lib/seo';

/** Spanish product pages at the live canonical `/es/producto/<slug>/`. */
export const dynamicParams = false;

export function generateStaticParams() {
  return spanishParams();
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = await getPublishedPage(bySpanishSlug(slug));
  if (!page) return {};
  const alt = alternates(page.en);
  return metadataForPath(page.es, {
    title: metaTitle(page, 'es'),
    description: page.head.description_es,
    en: alt.en,
    es: alt.es,
  });
}

export default async function ProductEs({ params }) {
  const { slug } = await params;
  const page = await getPublishedPage(bySpanishSlug(slug));
  if (!page) notFound();

  return (
    <>
      <SiteHeader lang="es" path={page.es} />
      <main className="flex-1">
        <Container className="pt-10 sm:pt-14">
          <ProductSummary lang="es" product={page} />
        </Container>
        <Sections demoteH1 lang="es" sections={page.sections} />
      </main>
      <SiteFooter lang="es" />
    </>
  );
}

