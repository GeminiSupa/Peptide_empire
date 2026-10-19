import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * REQUIRED — do not remove.
   *
   * Every live HTML URL ends in a trailing slash (`/about/`, not
   * `/about`). Next.js 16 strips trailing slashes by default and would redirect
   * `/about/` → `/about`, which changes every indexed URL on the site.
   *
   * See docs/url-inventory.md.
   */
  trailingSlash: true,

  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },

  // The harvested site has over a thousand routes. Keep concurrent CMS reads
  // bounded during prerendering so Supabase and the build worker stay responsive.
  experimental: { staticGenerationMaxConcurrency: 2 },

  images: {
    // Content images are referenced by path and resolved through
    // lib/images.js. During the rebuild that base points at the live
    // WordPress site; it moves to local/Supabase before launch.
    remotePatterns: [{ protocol: 'https', hostname: 'peptidescostarica.net' }],
  },

  /**
   * Redirects the live site already serves, reproduced so no indexed URL
   * changes behaviour when we cut over.
   *
   * REVERSED 2026-08-21, because the live site reversed it. The tirzepatide
   * lander has two slugs, one with the Spanish spelling; whichever is not
   * canonical 301s to the other. It used to serve /tirzepatida-costa-rica/ and
   * redirect the -e- spelling to it. It now does the opposite: the -e- spelling
   * is the 200 and /tirzepatida-costa-rica/ is the 301.
   *
   * Three places carried the old direction and all three are now aligned on the
   * canonical URL — this redirect, the nav href (scripts/fix-links.mjs) and the
   * route table. They have to agree: when they disagreed, the "Tirzepatide"
   * item in the SHOP BY PRODUCT menu was a dead link on every page.
   */
  async redirects() {
    return [
      {
        source: '/tirzepatida-costa-rica',
        destination: '/tirzepatide-costa-rica/',
        permanent: true,
      },
      {
        source: '/es/tienda',
        destination: '/es/shop/',
        permanent: true,
      },
      {
        source: '/es/producto-2/:slug*',
        destination: '/es/producto/:slug*/',
        permanent: true,
      },
      {
        source: '/es/categoria-producto-2/:slug*',
        destination: '/es/categoria-de-producto/:slug*/',
        permanent: true,
      },
      {
        source: '/lp',
        destination: '/',
        permanent: true,
      },
      {
        source: '/es/lp',
        destination: '/es/',
        permanent: true,
      },
    ];
  },

  /**
   * Keep every sitemap URL exposed by the WordPress/Xagio installation alive.
   * Search Console does not follow a redirect when fetching a submitted
   * sitemap, so these are internal aliases (HTTP 200), not redirects. They can
   * remain indefinitely while /sitemap.xml is the canonical sitemap URL.
   */
  async rewrites() {
    return [
      '/sitemap_index.xml',
      '/sitemap-xag.xml',
      '/sitemap-xagio-post.xml',
      '/sitemap-xagio-page.xml',
      '/sitemap-xagio-product.xml',
      '/sitemap-xagio-product_cat.xml',
      '/wp-sitemap.xml',
    ].map((source) => ({ source, destination: '/sitemap.xml' }));
  },
};

export default nextConfig;
