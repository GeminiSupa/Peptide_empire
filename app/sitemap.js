import { allRoutes, harvestedAt, OMITTED_ROUTE_PATHS } from '@/lib/routes';
import { SITE_URL } from '@/lib/indexing';
import { buildRouteIndex, isSitemapPath } from '@/lib/seo-links.mjs';
import { blogPaths, getPublishedBlogs } from '@/lib/blog-cms.mjs';

// Only pages that are their own canonical (lib/seo-links.mjs): the
// /product/lp-…/ ad copies point Google at the regular product instead.
const ROUTE_INDEX = buildRouteIndex(allRoutes, OMITTED_ROUTE_PATHS);

const OMIT = new Set([
  'excludeCandidate',
]);
const OMIT_PATHS = new Set(['/lp/', '/es/lp/']);

/**
 * One canonical XML sitemap for every preserved English and Spanish route.
 * WordPress's current Xagio feeds expose only one language in several files;
 * generating this from the verified bilingual inventory avoids that defect.
 */
export default async function sitemap() {
  const modified = new Date(harvestedAt);
  const entries = [];
  const seen = new Set();

  for (const route of allRoutes) {
    if (OMIT.has(route.group) || OMITTED_ROUTE_PATHS.has(route.en)) continue;
    for (const path of [route.en, route.es]) {
      if (!path || seen.has(path) || OMIT_PATHS.has(path) || !isSitemapPath(path, ROUTE_INDEX)) continue;
      seen.add(path);
      entries.push({
        url: new URL(path, SITE_URL).toString(),
        lastModified: modified,
        changeFrequency: route.group === 'wooProduct' ? 'daily' : 'weekly',
        priority: path === '/' || path === '/es/' ? 1 : 0.7,
      });
    }
  }

  for (const blog of await getPublishedBlogs()) {
    const paths = blogPaths(blog);
    for (const path of [paths.en, paths.es]) {
      if (!path || seen.has(path)) continue;
      seen.add(path);
      entries.push({
        url: new URL(path, SITE_URL).toString(),
        lastModified: new Date(blog.updated_at || blog.published_at || blog.created_at),
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: { languages: { en: new URL(paths.en, SITE_URL).toString(), es: new URL(paths.es, SITE_URL).toString() } },
        ...(blog.image_url ? { images: [blog.image_url] } : {}),
      });
    }
  }

  return entries;
}
