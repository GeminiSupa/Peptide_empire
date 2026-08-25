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
    ];
  },
};

export default nextConfig;
