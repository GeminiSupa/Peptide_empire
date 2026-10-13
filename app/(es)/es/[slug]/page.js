import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Sections from '@/components/sections';
import { bySpanishSlug, spanishParams } from '@/content/pages/registry';
import { alternates } from '@/lib/routes';
import { metaTitle, pageTitle } from '@/lib/page-title';
import { metadataForPath } from '@/lib/seo';

/**
 * The Spanish twins of app/[slug]. These slugs are NOT `/es/` + the English
 * slug — TranslatePress runs with translated slugs, and 131 of the 321 Spanish
 * paths keep the English slug while the rest do not. There is no rule, so the
 * params come from the harvested route map rather than from a transform.
 *
 * See docs/url-inventory.md.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return spanishParams();
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

export default async function PageEs({ params }) {
  const { slug } = await params;
  const page = bySpanishSlug(slug);
  if (!page) notFound();

  return (
    <>
      <SiteHeader lang="es" path={page.es} />
      <main className="flex-1">
        <Sections
          lang="es"
          pageTitle={pageTitle(page, 'es')}
          sections={page.sections}
        />
      </main>
      <SiteFooter lang="es" />
    </>
  );
}
