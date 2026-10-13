import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { bySpanishSlug } from '@/content/pages/registry';
import { allRoutes, alternates } from '@/lib/routes';
import { metaTitle, pageTitle } from '@/lib/page-title';
import { metadataForPath } from '@/lib/seo';

const PREFIX = '/es/hojas-de-especificaciones-de-peptidos/';

export const dynamicParams = false;

export function generateStaticParams() {
  return allRoutes
    .filter((route) => route.es?.startsWith(PREFIX) && route.es !== PREFIX)
    .map((route) => ({ slug: route.es.slice(PREFIX.length).replace(/\/$/, '') }));
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = bySpanishSlug(slug);
  if (!page) return {};
  const alt = alternates(page.en);
  return metadataForPath(page.es, {
    title: metaTitle(page, 'es'),
    description: page.head.description_es,
    en: alt.en,
    es: alt.es,
  });
}

export default async function SpecificationSheetEs({ params }) {
  const { slug } = await params;
  const page = bySpanishSlug(slug);
  if (!page || !page.es?.startsWith(PREFIX)) notFound();

  return (
    <>
      <SiteHeader lang="es" path={page.es} />
      <main className="flex-1">
        <Sections lang="es" pageTitle={pageTitle(page, 'es')} sections={page.sections} />
      </main>
      <SiteFooter lang="es" />
    </>
  );
}

