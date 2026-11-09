# Structured data — QA sheet (owner sign-off)

What changed (Nov 2026): the new site describes every page to Google from what
the page shows — its breadcrumb, its FAQ, its products and live prices —
instead of WordPress's old data, which was missing on most pages and wrong on
many others (empty business record on city pages, wrong URLs, old prices).

Automated checks run before this reaches you:

- `node --test tests/structured-data.test.mjs tests/seo-links.test.mjs`
- `node scripts/check-structured-data.mjs https://peptidescostarica.net`
  (every page in the sitemap: parses, one FAQ block, FAQ questions visible,
  breadcrumb ends at the page, product prices printed on the page, URLs on
  the main domain, and a list of anything WordPress had that is now gone).

## Your part: Google's own test, 10 pages

Open <https://search.google.com/test/rich-results>, paste each URL, press
**Test URL**, and note the result in the last column. A pass is "Page is
eligible for rich results" with the items listed and **no red errors**
(yellow "non-critical issues" are fine; list them anyway).

| # | Page | URL | Google should find | Result |
|---|------|-----|--------------------|--------|
| 1 | Home (English) | https://peptidescostarica.net/ | Organization, FAQ | |
| 2 | Home (Spanish) | https://peptidescostarica.net/es/ | Organization, FAQ | |
| 3 | Product landing | https://peptidescostarica.net/bpc-157-costa-rica/ | Product snippets, Merchant listings, Breadcrumbs, FAQ | |
| 4 | Product strength page | https://peptidescostarica.net/product/bpc-157-10mg/ | Product snippets, Merchant listings, Breadcrumbs, FAQ | |
| 5 | Spanish product | https://peptidescostarica.net/es/producto/5-amino-1mq-50mg/ | Product snippets, Merchant listings, Breadcrumbs, FAQ | |
| 6 | Category | https://peptidescostarica.net/peptides-for-weight-loss/ | Breadcrumbs, FAQ | |
| 7 | Blog post | https://peptidescostarica.net/blog/bpc-157-for-gut-health/ | Articles, Breadcrumbs | |
| 8 | Spanish mixing guide | https://peptidescostarica.net/es/blog/guia/guia-de-mezcla-de-retatrutida-30-mg/ | Articles, Breadcrumbs | |
| 9 | City page | https://peptidescostarica.net/alajuela/ | Breadcrumbs, FAQ | |
| 10 | FAQ page | https://peptidescostarica.net/faq-costa-rica/ | Breadcrumbs, FAQ | |

Also check one product page by eye: the price in Google's test result
(Merchant listings → Offers → price) must equal the price on the page for
one vial.

Note: Google shows FAQ rich results in search only for well-known government
and health sites (since Aug 2023), so the FAQ will be **detected** in the
test but is not expected to appear as a dropdown in search. It still helps
Google and AI answers understand the page.

## After it is live: Search Console (1–2 weeks)

In Search Console → **Enhancements** (left menu), check after a few days:

- **Breadcrumbs**, **Product snippets**, **Merchant listings**: the count of
  valid items should rise; open any **Invalid** row and send it to the
  developer.
- **Pages → Why pages aren't indexed**: the 25 `/product/lp-…/` ad pages will
  appear under "Alternate page with proper canonical tag". That is intended:
  they point Google at the regular product page.
- The Spanish mixing guides (`/es/blog/guia/…`) should move to **Indexed**.

## Sign-off

| Who | Date | All 10 pass? | Notes |
|-----|------|--------------|-------|
| | | | |
