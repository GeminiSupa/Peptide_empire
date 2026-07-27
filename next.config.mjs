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
};

export default nextConfig;
