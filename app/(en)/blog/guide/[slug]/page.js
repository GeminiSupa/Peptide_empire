import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { byEnglishSlug, englishParams } from '@/content/pages/mixing-guides';
import { alternates } from '@/lib/routes';

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
  const page = byEnglishSlug(slug);
  if (!page) return {};
  const alt = alternates(page.en);
  return {
    title: page.head.title_en || undefined,
    description: page.head.description_en || undefined,
    alternates: { canonical: page.en, languages: { 'en-US': alt.en, 'es-CR': alt.es } },
  };
}

export default async function MixingGuideEn({ params }) {
  const { slug } = await params;
  const page = byEnglishSlug(slug);
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
