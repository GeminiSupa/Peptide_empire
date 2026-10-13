import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { byEnglishSlug } from '@/content/pages/registry';
import { allRoutes, alternates } from '@/lib/routes';
import { metaTitle, pageTitle } from '@/lib/page-title';
import { metadataForPath } from '@/lib/seo';

const PREFIX = '/peptide-specification-sheets/';

export const dynamicParams = false;

export function generateStaticParams() {
  return allRoutes
    .filter((route) => route.en.startsWith(PREFIX) && route.en !== PREFIX)
    .map((route) => ({ slug: route.en.slice(PREFIX.length).replace(/\/$/, '') }));
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = byEnglishSlug(slug);
  if (!page) return {};
  const alt = alternates(page.en);
  return metadataForPath(page.en, {
    title: metaTitle(page, 'en'),
    description: page.head.description_en,
    en: alt.en,
    es: alt.es,
  });
}

export default async function SpecificationSheetEn({ params }) {
  const { slug } = await params;
  const page = byEnglishSlug(slug);
  if (!page || !page.en.startsWith(PREFIX)) notFound();

  return (
    <>
      <SiteHeader lang="en" path={page.en} />
      <main className="flex-1">
        <Sections lang="en" pageTitle={pageTitle(page, 'en')} sections={page.sections} />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}

