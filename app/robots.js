import { ALLOW_INDEXING, SITE_URL } from '@/lib/indexing';

/**
 * robots.txt, generated rather than static.
 *
 * It replaces public/robots.txt, which hardcoded a blanket Disallow that had to
 * be hand-edited in lockstep with the noindex metadata in app/layout.js. Two
 * places to remember on launch day is one place too many — both now read
 * lib/indexing.js, so they cannot contradict each other.
 */
export default function robots() {
  if (!ALLOW_INDEXING) {
    // Pre-launch: a replica of a live site must not compete with the original.
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
