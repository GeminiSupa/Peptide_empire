import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Container from '@/components/ui/container';
import ProductList from '@/components/product-list';
import { bySpanishSlug, spanishParams, productsFor } from '@/content/pages/categories';
import { alternates } from '@/lib/routes';

/**
 * Spanish category archives at `/es/categoria-producto-2/<slug>/`.
 *
 * The `-2` is permanent, indexed SEO on the live site, not a mistake to tidy.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return spanishParams();
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = bySpanishSlug(slug);
  if (!page) return {};
  const alt = alternates(page.en);
  return {
    title: page.head.title_es || undefined,
    description: page.head.description_es || undefined,
    alternates: { canonical: page.es, languages: { 'en-US': alt.en, 'es-CR': alt.es } },
  };
}

export default async function CategoryEs({ params }) {
  const { slug } = await params;
  const page = bySpanishSlug(slug);
  if (!page) notFound();

  return (
    <>
      <SiteHeader lang="es" path={page.es} />
      <main className="flex-1">
        <Container className="py-12 sm:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
            {page.heading_es}
          </h1>
          {page.intro_es && (
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-text-main">
              {page.intro_es}
            </p>
          )}
          <ProductList
            emptyLabel="Actualmente no hay productos en esta categoría."
            lang="es"
            products={productsFor(page.slug)}
          />
        </Container>
      </main>
      <SiteFooter lang="es" />
    </>
  );
}
