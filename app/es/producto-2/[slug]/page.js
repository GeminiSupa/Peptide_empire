import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Blocks from '@/components/blocks';
import Container from '@/components/ui/container';
import ProductSummary from '@/components/product-summary';
import { bySpanishSlug, spanishParams } from '@/content/pages/products';
import { alternates } from '@/lib/routes';

/**
 * Spanish product pages at `/es/producto-2/<slug>/`.
 *
 * The `-2` is not a typo and must not be tidied up. It is a WordPress slug
 * collision that is now permanent, indexed SEO on the live site; changing it
 * would break every indexed Spanish product URL. See docs/url-inventory.md.
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

export default async function ProductEs({ params }) {
  const { slug } = await params;
  const page = bySpanishSlug(slug);
  if (!page) notFound();

  return (
    <>
      <SiteHeader lang="es" path={page.es} />
      <main className="flex-1">
        <Container className="pt-10 sm:pt-14">
          <ProductSummary lang="es" product={page} />
        </Container>
        <Blocks blocks={page.blocks} demoteH1 lang="es" />
      </main>
      <SiteFooter lang="es" />
    </>
  );
}
