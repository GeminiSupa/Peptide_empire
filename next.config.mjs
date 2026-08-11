/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * REQUIRED — do not remove.
   *
   * Every one of the 643 live URLs ends in a trailing slash (`/about/`, not
   * `/about`). Next.js 16 strips trailing slashes by default and would redirect
   * `/about/` → `/about`, which changes every indexed URL on the site.
   *
   * See docs/url-inventory.md.
   */
  trailingSlash: true,

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
   * The XML sitemap lists /tirzepatide-costa-rica/, but that URL 301s on the
   * live site to /tirzepatida-costa-rica/ — which is the page the nav actually
   * links to. Harvesting the sitemap without following redirects put the
   * redirect URL in our route table and no page at the real one, so the
   * "Tirzepatide" item in the SHOP BY PRODUCT menu 404'd on all 630 pages.
   */
  async redirects() {
    return [
      {
        source: '/tirzepatide-costa-rica',
        destination: '/tirzepatida-costa-rica/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
