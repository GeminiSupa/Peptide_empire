import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { byEnglishSlug, englishParams } from '@/content/pages/categories';
import { alternates } from '@/lib/routes';
import { metaTitle } from '@/lib/page-title';

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
    title: metaTitle(page, 'en'),
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
        <Sections lang="en" sections={page.sections} />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
