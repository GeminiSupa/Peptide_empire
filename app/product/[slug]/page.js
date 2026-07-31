import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Blocks from '@/components/blocks';
import Container from '@/components/ui/container';
import ProductSummary from '@/components/product-summary';
import { byEnglishSlug, englishParams } from '@/content/pages/products';
import { alternates } from '@/lib/routes';

/**
 * English product pages at `/product/<slug>/` — the live site's own path.
 *
 * Display only. The catalog site owns the cart; see components/product-summary.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return englishParams();
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = byEnglishSlug(slug);
  if (!page) return {};
  const alt = alternates(page.en);
  return {
    title: page.head.title_en || undefined,
    description: page.head.description_en || undefined,
    alternates: { canonical: page.en, languages: { 'en-US': alt.en, 'es-CR': alt.es } },
  };
}

export default async function ProductEn({ params }) {
  const { slug } = await params;
  const page = byEnglishSlug(slug);
  if (!page) notFound();

  return (
    <>
      <SiteHeader lang="en" path={page.en} />
      <main className="flex-1">
        <Container className="pt-10 sm:pt-14">
          <ProductSummary lang="en" product={page} />
        </Container>
        <Blocks blocks={page.blocks} demoteH1 lang="en" />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
