import { allRoutes, harvestedAt, OMITTED_ROUTE_PATHS } from '@/lib/routes';
import { SITE_URL } from '@/lib/indexing';

const OMIT = new Set([
  'excludeCandidate',
]);
const OMIT_PATHS = new Set(['/lp/', '/es/lp/']);

/**
 * One canonical XML sitemap for every preserved English and Spanish route.
 * WordPress's current Xagio feeds expose only one language in several files;
 * generating this from the verified bilingual inventory avoids that defect.
 */
export default function sitemap() {
  const modified = new Date(harvestedAt);
  const entries = [];
  const seen = new Set();

  for (const route of allRoutes) {
    if (OMIT.has(route.group) || OMITTED_ROUTE_PATHS.has(route.en)) continue;
    for (const path of [route.en, route.es]) {
      if (!path || seen.has(path) || OMIT_PATHS.has(path)) continue;
      seen.add(path);
      entries.push({
        url: new URL(path, SITE_URL).toString(),
        lastModified: modified,
        changeFrequency: route.group === 'wooProduct' ? 'daily' : 'weekly',
        priority: path === '/' || path === '/es/' ? 1 : 0.7,
      });
    }
  }

  return entries;
}
