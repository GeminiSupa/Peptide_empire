# Launch readiness — 2026-10-13

The custom Next.js site is ready for a controlled cutover from WordPress. The
checks below were run against a production build served by `next start`.

## Verification results

| Gate | Result |
|---|---:|
| Production build | 1,001 static outputs, passed |
| Full route/content crawl | 1,019 pages, 0 issues |
| Live metadata comparison | 985 pages, 0 differences |
| Structured data retained | 377 schema-bearing pages |
| Built image references | 1,840 distinct URLs, 0 missing |
| XML sitemap | 983 canonical URLs |

The SEO comparison checks titles, descriptions, canonical URLs, hreflang,
Open Graph, Twitter metadata, and JSON-LD against the captured live WordPress
snapshot. The custom site also fixes broken or blank social fields without
dropping the original page metadata or schema.

## Performance comparison

Lighthouse was run against both homepages with the same Chrome installation,
mobile throttling profile, and Lighthouse version.

| Metric | Custom Next.js | Live WordPress | Change |
|---|---:|---:|---:|
| Performance score | 54 | 28 | +26 points |
| First Contentful Paint | 2.19 s | 5.14 s | 57% faster |
| Largest Contentful Paint | 6.14 s | 6.59 s | 7% faster |
| Speed Index | 5.99 s | 10.57 s | 43% faster |
| Total Blocking Time | 667 ms | 8,380 ms | 92% lower |
| Time to Interactive | 6.25 s | 23.96 s | 74% faster |
| Requests | 43 | 195 | 78% fewer |
| Transfer size | 1.20 MB | 2.75 MB | 56% smaller |
| Cumulative Layout Shift | 0 | 0.006 | no measurable shift |

The local Lighthouse SEO score is intentionally reduced only by the preview
deployment's `noindex` protection. Every other Lighthouse SEO audit passed. The
production cutover variable below enables crawling and the sitemap together.

## Production cutover

1. In the Vercel production environment, set:
   - `NEXT_PUBLIC_SITE_URL=https://peptidescostarica.net`
   - `NEXT_PUBLIC_IMAGE_BASE=` (empty; assets are local)
   - `NEXT_PUBLIC_ALLOW_INDEXING=true`
2. Deploy the verified commit and test its generated Vercel URL while indexing
   remains disabled on preview deployments.
3. Attach `peptidescostarica.net` and `www.peptidescostarica.net`, then change DNS
   during the agreed cutover window.
4. Verify the homepage, representative English and Spanish pages, old-path 301s,
   `/robots.txt`, `/sitemap.xml`, canonical tags, hreflang, and JSON-LD on the
   production domain.
5. Submit `https://peptidescostarica.net/sitemap.xml` in Google Search Console.
6. Keep WordPress available for at least two weeks as a rollback target and
   monitor 404s, crawl errors, indexing, and Core Web Vitals.

This is a same-domain hosting migration, so keep the existing Search Console
property and do **not** use Google's Change of Address tool. The old Xagio
sitemap URLs remain available as HTTP 200 aliases of `/sitemap.xml`, including
`/sitemap-xag.xml`, its four child sitemap URLs, and `/sitemap_index.xml`. This
keeps any sitemap URL already saved in Search Console readable during the move.

Immediately after DNS has switched, run:

```bash
node scripts/post-launch-check.mjs
```

Then use Search Console URL Inspection on the English homepage, Spanish
homepage, shop, one product, one category, and one article. Confirm **Page fetch:
Successful**, **Indexing allowed: Yes**, and that Google's selected canonical
matches the declared canonical. Request indexing for those representative URLs;
use the sitemap—not hundreds of individual requests—for the rest of the site.

Check the Page Indexing, Sitemaps, HTTPS, Core Web Vitals, Manual Actions, and
Security Issues reports daily for the first week, then twice weekly for the next
three weeks. Compare clicks, impressions, indexed pages, 404s, and server errors
against the pre-cutover baseline.

## Rollback

If a material production issue appears, point DNS back to WordPress and set
`NEXT_PUBLIC_ALLOW_INDEXING=false` on the custom deployment. Do not delete the
WordPress host until the monitoring window has passed.
