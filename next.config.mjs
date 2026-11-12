/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/account/dosing-guides/*': ['./private/dosing-guides/**/*'],
  },
  allowedDevOrigins: ['192.168.100.71', '192.168.18.57'],

  compress: true,

  // Baileys (WhatsApp) is ESM-only with optional native deps — let Node.js handle it at runtime
  serverExternalPackages: ['@whiskeysockets/baileys', 'jimp', 'sharp'],

  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    dangerouslyAllowSVG: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'peptidescostarica.net',
      },
      {
        protocol: 'https',
        hostname: 'catalog.peptidescostarica.net',
      },
    ],
  },

  // Retire the vercel.app URL without killing old links: any request arriving
  // on the deployment alias is permanently redirected to the live domain, path
  // and query intact. This covers every stale link in old mailers, QR codes and
  // bookmarks. The host match is exact, so branch preview deployments
  // (peptidecosta-git-*.vercel.app etc.) are untouched.
  //
  // Do NOT "shut down" the Vercel project itself - catalog.peptidescostarica.net
  // is a custom domain ON this project; removing the project takes the live
  // site with it.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.catalog.peptidescostarica.net' }],
        destination: 'https://catalog.peptidescostarica.net/:path*',
        permanent: true,
      },
      {
        source: '/:path((?!api(?:/|$)).*)',
        has: [{ type: 'host', value: 'peptidecosta.vercel.app' }],
        destination: 'https://catalog.peptidescostarica.net/:path*',
        permanent: true,
      },
      // /our-story and /about told the same founder story. /about is canonical:
      // it carries a page-specific <title>, the richer narrative, and the
      // existing sitemap history. Redirect rather than drop, so any shared
      // links keep working.
      {
        source: '/our-story',
        destination: '/about',
        permanent: true,
      },
      // The metabolic ad shop page moved off its "GLP" address (10 Nov 2026).
      // Old QA and shared links follow it; the query string (gclid) is kept.
      {
        source: '/lp-testing/glp-1',
        destination: '/lp-testing/metabolic-research-compound',
        permanent: false,
      },
      {
        source: '/lp/glp-1',
        destination: '/lp/metabolic-research-compound',
        permanent: false,
      },
      // The two single-product pages were approved on 12 Nov 2026, so their
      // preview addresses are gone. The QA links already shared keep working
      // by landing on the real page, which is also what the ads use.
      {
        source: '/lp-testing/glutathione-1500mg',
        destination: '/lp/glutathione-1500mg',
        permanent: false,
      },
      {
        source: '/lp-testing/nad-plus',
        destination: '/lp/nad-plus',
        permanent: false,
      },
    ];
  },

  // The Google Ads landing page ships as a standalone file at
  // public/lp/index.html rather than as a route, so it stays a straight copy of
  // what the contractor delivered. Static files only answer on their exact path,
  // so bare /lp would 404 — this gives the ads a clean URL to point at. Array
  // rewrites run after the filesystem check, so /lp/index.html keeps serving
  // itself and nothing else on the site is affected.
  async rewrites() {
    return [
      // The lead-form landing page. Google Ads counts leads on /lp/thank-you and
      // the CRM gets the lead (with its click ID) from this form, so it stays.
      {
        source: '/lp',
        destination: '/lp/index.html',
      },
      // New Google Ads shop pages, QA preview only (owner, 10 Nov 2026). On
      // /lp-testing the pages load no Tag Manager, keep no ad click, and mark
      // their orders TEST so the Google uploads skip them. Once approved, they
      // move to their real /lp addresses and these preview rules go.
      // The metabolic page's address must not say "GLP" (Google Ads, 10 Nov
      // 2026); it lives at /lp/metabolic-research-compound.
      {
        source: '/lp-testing',
        destination: '/lp/metabolic-research-compound/index.html',
      },
      {
        source: '/lp-testing/metabolic-research-compound',
        destination: '/lp/metabolic-research-compound/index.html',
      },
      {
        source: '/lp-testing/bac-water',
        destination: '/lp/bac-water/index.html',
      },
      // Their real addresses, for the ads once approved (tracking on). Vercel
      // happens to serve a folder's index.html, but `next dev`/`next start` do
      // not, so say it explicitly.
      {
        source: '/lp/metabolic-research-compound',
        destination: '/lp/metabolic-research-compound/index.html',
      },
      {
        source: '/lp/bac-water',
        destination: '/lp/bac-water/index.html',
      },
      {
        source: '/lp/glutathione-1500mg',
        destination: '/lp/glutathione-1500mg/index.html',
      },
      {
        source: '/lp/nad-plus',
        destination: '/lp/nad-plus/index.html',
      },
      // The landing page's confirmation, the destination URL Google Ads counts
      // a lead on. It is public/lp/thank-you.html, so it always answers on its
      // own exact path; this is only what gives it the tidy URL the ad account
      // is pointed at. Upstream gets the same effect from cleanUrls in
      // vercel.json, which is not used here because it would strip .html across
      // every route in the app rather than this one page.
      {
        source: '/lp/thank-you',
        destination: '/lp/thank-you.html',
      },
      // The GLP-1 variant, a second ad landing page run alongside /lp so the two
      // can be tested against each other. Same standalone-file arrangement, same
      // reason for the rewrites; it is public/glp-1/index.html.
      {
        source: '/glp-1',
        destination: '/glp-1/index.html',
      },
      {
        source: '/glp-1/thank-you',
        destination: '/glp-1/thank-you.html',
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // The landing page's confirmation must never be indexed. Ranking it would
      // send people who never submitted anything to the page that counts a
      // conversion, and the Ads figure would climb on its own. The page carries
      // a robots meta tag; this covers crawlers that only read the header. Both
      // paths are listed because header rules match the URL as requested, before
      // the rewrite above resolves it. no-store keeps a back-button visit from
      // replaying a cached copy of someone else's confirmation.
      // The QA preview of the new ad shop pages stays out of Google.
      {
        source: '/lp-testing/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      // The two single-product ad pages stay out of Google (12 Nov 2026). The
      // main site already has its own pages for these compounds, and two of our
      // own pages competing for the same search is the one thing we don't want.
      // Google Ads does not read this, so the ads are unaffected.
      {
        source: '/lp/glutathione-1500mg',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }],
      },
      {
        source: '/lp/nad-plus',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }],
      },
      {
        source: '/lp/thank-you',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/lp/thank-you.html',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      // The admin login is linked from the footer, so Google can find the URL.
      // noindex tells it not to list the page. Both paths: the login itself and
      // anything under it, such as the automations screen.
      // The camera is allowed here and nowhere else: packers scan vial stickers
      // with it in Fulfillment (Scan & pack). This later rule overrides the
      // site-wide camera=() above for admin pages only; microphone and
      // geolocation stay exactly as the site-wide rule sets them.
      {
        source: '/admin',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
      // Same reasoning for the GLP-1 variant's confirmation page.
      {
        source: '/glp-1/thank-you',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/glp-1/thank-you.html',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      // Long-lived cache for static assets
      {
        source: '/(.*)\\.(png|jpg|jpeg|webp|avif|svg|gif|ico|woff|woff2)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
