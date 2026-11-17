import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Old WordPress ad landing page → this site's page for the same product.
 *
 * WordPress served each ad copy twice: at `/lp-<slug>/` and at
 * `/product/lp-<slug>/`. Only the second survived the 9 Nov 2026 move, so
 * every ad still pointing at the short address 404s and the click is paid for
 * and lost. The first five were found one at a time as Google Ads reported
 * them; on 13 Nov 2026 the ads team reported two more, so the rest of the
 * family was checked against the live site in one go and every one that was
 * still 404ing is listed here. Each destination was confirmed to answer 200.
 */
export const OLD_AD_LANDING_PAGES = [
  ['lp-klow-80mg', '/product/lp-klow-80mg/'],
  ['lp-aicar-50mg', '/product/lp-aicar-50mg/'],
  ['lp-oxytocin-acetate-5mg', '/product/lp-oxytocin-acetate-5mg/'],
  ['lp-pt-141-10mg', '/product/lp-pt-141-10mg/'],
  ['lp-bac-water-10ml', '/product/bac-water-10ml/'],
  // Reported by the ads team, 13 Nov 2026.
  ['lp-ghk-cu-100mg', '/product/lp-ghk-cu-100mg/'],
  ['lp-ipamorelin-10mg', '/product/lp-ipamorelin-10mg/'],
  // The rest of the same family, all 404ing on the same day.
  ['lp-5-amino-1mq-50mg', '/product/lp-5-amino-1mq-50mg/'],
  ['lp-5-amino-1mq-5mg', '/product/lp-5-amino-1mq-5mg/'],
  ['lp-cartalax-20mg', '/product/lp-cartalax-20mg/'],
  ['lp-ghk-cu-50mg', '/product/lp-ghk-cu-50mg/'],
  ['lp-glow-50mg', '/product/lp-glow-50mg/'],
  ['lp-glow-70mg', '/product/lp-glow-70mg/'],
  ['lp-glutathione-1500mg', '/product/lp-glutathione-1500mg/'],
  ['lp-igf-1lr3-1mg', '/product/lp-igf-1lr3-1mg/'],
  ['lp-kisspeptin-10-10mg', '/product/lp-kisspeptin-10-10mg/'],
  ['lp-kpv-10mg', '/product/lp-kpv-10mg/'],
  ['lp-nad-1000mg', '/product/lp-nad-1000mg/'],
  ['lp-pinealon-20mg', '/product/lp-pinealon-20mg/'],
  ['lp-selank-10mg', '/product/lp-selank-10mg/'],
  ['lp-sermorelin-10mg', '/product/lp-sermorelin-10mg/'],
  ['lp-slu-pp-332-5mg', '/product/lp-slu-pp-332-5mg/'],
  ['lp-ss-31-10mg', '/product/lp-ss-31-10mg/'],
  ['lp-super-human-blend-10ml', '/product/lp-super-human-blend-10ml/'],
  ['lp-tb-4-10mg', '/product/lp-tb-4-10mg/'],
  ['lp-thymalin-10mg', '/product/lp-thymalin-10mg/'],
  ['lp-thymosin-alpha-1-10mg', '/product/lp-thymosin-alpha-1-10mg/'],
];

/**
 * The Google Ads landing pages, served here at `/lp/<slug>/`.
 *
 * Each is a standalone 600 KB file copied from the catalog into
 * `public/lp/<slug>/index.html` by `scripts/sync-landing-pages.mjs`, which is
 * where the why lives. They ran at `catalog.peptidescostarica.net/lp/<slug>`
 * until the owner asked (17 Nov 2026) for the ads to land on the main domain.
 *
 * A static file only answers on its exact path, so without the rewrites below
 * `/lp/ghk-cu-100mg/` would 404 and the paid click would be lost. Vercel
 * happens to serve a folder's `index.html`; `next dev` and `next start` do not,
 * so say it explicitly — the catalog's config does the same for its copies.
 */
export const AD_LANDING_PAGES = ['ghk-cu-100mg', 'ipamorelin-10mg', 'tesa-compound', 'klow-80mg', 'glow-70mg'];

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
      // Short addresses people type or print (owner, 9 Nov 2026: /contact 404'd).
      {
        source: '/contact',
        destination: '/contact-costa-rica/',
        permanent: true,
      },
      {
        source: '/es/contacto',
        destination: '/es/contactar-costa-rica/',
        permanent: true,
      },
      {
        source: '/es/contact',
        destination: '/es/contactar-costa-rica/',
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
      // Old WordPress ad landing pages that Google Ads still sends ~3,300
      // clicks/week to (they 404'd after the 9 Nov 2026 domain move).
      //
      // These were 307 redirects for two days. The ads team's answer was that
      // the address should BE the page, not bounce to one (13 Nov 2026), and
      // they are right: the URL in the ad is what Google reviews and reports
      // on, and a redirect puts a hop between the click and the landing.
      // So each old address now serves this site's page for the same product
      // itself, HTTP 200, exactly like the sitemap aliases below.
      //
      // Safe against duplicate content: the page states its canonical from its
      // own route (lib/seo-links.mjs), so a page served here still names
      // /product/<slug>/ as the original, and none of these addresses is in
      // the sitemap. The query string rides along, so gclid/gbraid/wbraid
      // still reach the order (visitor-tracker → attribution.mjs).
      // /lp-glutathione/ is a real page on this site and is not in the list.
      ...OLD_AD_LANDING_PAGES.map(([page, destination]) => ({
        source: `/${page}`,
        destination,
      })),
      // The ad landing pages copied from the catalog (AD_LANDING_PAGES above).
      ...AD_LANDING_PAGES.map((slug) => ({
        source: `/lp/${slug}`,
        destination: `/lp/${slug}/index.html`,
      })),
      ...[
        '/sitemap_index.xml',
        '/sitemap-xag.xml',
        '/sitemap-xagio-post.xml',
        '/sitemap-xagio-page.xml',
        '/sitemap-xagio-product.xml',
        '/sitemap-xagio-product_cat.xml',
        '/wp-sitemap.xml',
      ].map((source) => ({ source, destination: '/sitemap.xml' })),
    ];
  },
};

export default nextConfig;
