import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { bySpanishSlug, spanishParams } from '@/content/pages/categories';
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
        <Sections lang="es" sections={page.sections} />
      </main>
      <SiteFooter lang="es" />
    </>
  );
}
