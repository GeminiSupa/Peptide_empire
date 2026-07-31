import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Blocks from '@/components/blocks';
import { byEnglishSlug, englishParams } from '@/content/pages/city';
import { alternates } from '@/lib/routes';

/**
 * Single-segment English pages. Currently the 93 city pages; the product
 * landers, guides and marketing category pages share this shape and will be
 * added here as each group is harvested.
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
    title: page.head.title_en || undefined,
    description: page.head.description_en || undefined,
    alternates: {
      canonical: page.en,
      languages: { 'en-US': alt.en, 'es-CR': alt.es },
    },
  };
}

export default async function CityPageEn({ params }) {
  const { slug } = await params;
  const page = byEnglishSlug(slug);
  if (!page) notFound();

  return (
    <>
      <SiteHeader lang="en" path={page.en} />
      <main className="flex-1">
        <Blocks blocks={page.blocks} lang="en" />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
