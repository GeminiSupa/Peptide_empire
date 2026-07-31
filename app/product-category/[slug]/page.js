import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Container from '@/components/ui/container';
import ProductList from '@/components/product-list';
import { byEnglishSlug, englishParams, productsFor } from '@/content/pages/categories';
import { alternates } from '@/lib/routes';

/** English WooCommerce category archives at `/product-category/<slug>/`. */
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

export default async function CategoryEn({ params }) {
  const { slug } = await params;
  const page = byEnglishSlug(slug);
  if (!page) notFound();

  return (
    <>
      <SiteHeader lang="en" path={page.en} />
      <main className="flex-1">
        <Container className="py-12 sm:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
            {page.heading_en}
          </h1>
          {page.intro_en && (
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-text-main">
              {page.intro_en}
            </p>
          )}
          <ProductList
            emptyLabel="No products are currently listed in this category."
            lang="en"
            products={productsFor(slug)}
          />
        </Container>
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
