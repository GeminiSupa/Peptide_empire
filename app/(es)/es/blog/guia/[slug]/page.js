import { getPublishedPage } from '@/lib/site-cms';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { bySpanishSlug, spanishParams } from '@/content/pages/mixing-guides';
import { alternates } from '@/lib/routes';
import { metaTitle } from '@/lib/page-title';
import { metadataForPath } from '@/lib/seo';

/**
 * Spanish mixing & dosage guides at `/es/blog/guia/<slug>/`.
 *
 * TranslatePress translates the post-type segment too, so this is `guia` rather
 * than `guide` — the English segment only 301s here on the live site.
 */
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

export default async function MixingGuideEs({ params }) {
  const { slug } = await params;
  const page = await getPublishedPage(bySpanishSlug(slug));
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
