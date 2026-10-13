import seoData from '@/data/seo.json';
import { SITE_URL } from '@/lib/indexing';

const DEFAULT_SHARE_IMAGE =
  '/wp-content/uploads/2026/06/WhatsApp-Image-2026-06-10-at-9.27.04-PM-1.jpeg';

const absolute = (value) => {
  if (!value) return undefined;
  return new URL(value, SITE_URL).toString();
};

export function seoForPath(path) {
  return seoData.pages[path] || null;
}
/**
 * Reproduce the live site's page-level metadata while fixing two WordPress
 * defects that should not be carried into the migration: blank social titles
 * on articles, and missing canonical tags on some Elementor pages.
 */
export function metadataForPath(path, fallback = {}) {
  const seo = seoForPath(path);
  const title = seo?.title || fallback.title;
  const description = seo?.description || fallback.description;
  const hreflang = seo?.hreflang || {};
  const en = hreflang['en-US'] || fallback.en;
  const es = hreflang['es-CR'] || fallback.es;
  const canonical = seo?.canonical || absolute(path);
  const socialDescription =
    description ||
    'Research-grade peptides, transparent product information, and reliable local delivery across Costa Rica.';

  const og = seo?.openGraph || {};
  const image = og['og:image'] || seo?.twitter?.['twitter:image'] || DEFAULT_SHARE_IMAGE;
  const openGraph = {
    title: og['og:title'] || title,
    description: og['og:description'] || socialDescription,
    url: og['og:url'] || canonical,
    siteName: og['og:site_name'] || 'Peptides Costa Rica',
    locale: og['og:locale'] || (path.startsWith('/es/') ? 'es_CR' : 'en_US'),
    type: og['og:type'] || 'website',
    images: image ? [{ url: absolute(image) }] : undefined,
  };

  const twitter = seo?.twitter || {};
  const twitterImage = twitter['twitter:image'] || image;

  return {
    title: title ? { absolute: title } : undefined,
    description: description || undefined,
    alternates: {
      canonical,
      languages: {
        ...(en ? { 'en-US': en } : {}),
        ...(es ? { 'es-CR': es } : {}),
        'x-default': en || absolute('/'),
      },
    },
    openGraph,
    twitter: {
      card: twitter['twitter:card'] || 'summary_large_image',
      title: twitter['twitter:title'] || openGraph.title,
      description: twitter['twitter:description'] || openGraph.description,
      images: twitterImage ? [absolute(twitterImage)] : undefined,
    },
  };
}

