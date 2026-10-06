import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { bySpanishSlug, spanishParams } from '@/content/pages/posts';
import { alternates } from '@/lib/routes';
import { metaTitle } from '@/lib/page-title';

/** Spanish blog posts. The `/blog/` segment is kept but the post slug is translated. */
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
    title: metaTitle(page, 'es'),
    description: page.head.description_es || undefined,
    alternates: { canonical: page.es, languages: { 'en-US': alt.en, 'es-CR': alt.es } },
  };
}

export default async function BlogPostEs({ params }) {
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
