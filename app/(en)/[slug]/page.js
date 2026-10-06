import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { byEnglishSlug, englishParams } from '@/content/pages/registry';
import { alternates } from '@/lib/routes';
import { metaTitle, pageTitle } from '@/lib/page-title';

/**
 * Single-segment English pages — the city pages and the long-form guides today,
 * with the product landers and marketing category pages to follow. The registry
 * resolves the slug and declares which renderer it needs.
 *
 * `dynamicParams = false` means a slug with no harvested content 404s instead
 * of rendering an empty shell — the site should never serve a blank page at a
 * URL that is live and indexed today.
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
    title: metaTitle(page, 'en'),
    description: page.head.description_en || undefined,
    alternates: {
      canonical: page.en,
      languages: { 'en-US': alt.en, 'es-CR': alt.es },
    },
  };
}

export default async function PageEn({ params }) {
  const { slug } = await params;
  const page = byEnglishSlug(slug);
  if (!page) notFound();

  return (
    <>
      <SiteHeader lang="en" path={page.en} />
      <main className="flex-1">
        <Sections
          lang="en"
          pageTitle={pageTitle(page, 'en')}
          sections={page.sections}
        />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
