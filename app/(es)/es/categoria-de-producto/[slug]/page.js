import { getPublishedPage } from '@/lib/site-cms';
import { notFound } from 'next/navigation';
import PageRoute from '@/components/site/page-route';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { bySpanishSlug, spanishParams, sectionsFor } from '@/content/pages/categories';
import { alternates } from '@/lib/routes';
import { metaTitle } from '@/lib/page-title';
import { metadataForPath } from '@/lib/seo';

/** Spanish category archives at `/es/categoria-de-producto/<slug>/`. */
export const dynamicParams = false;

export function generateStaticParams() {
  return spanishParams();
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = await getPublishedPage(bySpanishSlug(slug));
  if (!page) return {};
  const alt = alternates(page.en);
  return await metadataForPath(page.es, {
    title: metaTitle(page, 'es'),
    description: page.head.description_es,
    en: alt.en,
    es: alt.es,
  });
}

export default async function CategoryEs({ params }) {
  const { slug } = await params;
  const page = await getPublishedPage(bySpanishSlug(slug));
  if (!page) notFound();

  // The new design's category view, listing the catalog's live compounds.
  return <PageRoute page={{ ...page, group: 'wooCategory' }} lang="es" />;

  return (
    <>
      <SiteHeader lang="es" path={page.es} />
      <main className="flex-1">
        <Sections lang="es" sections={sectionsFor(page)} />
      </main>
      <SiteFooter lang="es" />
    </>
  );
}

