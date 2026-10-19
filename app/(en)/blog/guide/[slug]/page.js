import { getPublishedPage } from '@/lib/site-cms';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { byEnglishSlug, englishParams } from '@/content/pages/mixing-guides';
import { alternates } from '@/lib/routes';
import { metaTitle } from '@/lib/page-title';
import { metadataForPath } from '@/lib/seo';

/**
 * English mixing & dosage guides at `/blog/guide/<slug>/`.
 *
 * The static `guide` segment takes precedence over the sibling `[slug]`
 * dynamic route, so a blog post can never swallow one of these.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return englishParams();
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = await getPublishedPage(byEnglishSlug(slug));
  if (!page) return {};
  const alt = alternates(page.en);
  return metadataForPath(page.en, {
    title: metaTitle(page, 'en'),
    description: page.head.description_en,
    en: alt.en,
    es: alt.es,
  });
}

export default async function MixingGuideEn({ params }) {
  const { slug } = await params;
  const page = await getPublishedPage(byEnglishSlug(slug));
  if (!page) notFound();

  return (
    <>
      <SiteHeader lang="en" path={page.en} />
      <main className="flex-1">
        <Sections lang="en" sections={page.sections} />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
