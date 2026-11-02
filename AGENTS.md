<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# The website on the `website` branch depends on this app

This repository holds two applications. `main` (this branch) is the catalog,
live at `catalog.peptidescostarica.net`. The `website` branch is the new
public site that will replace the WordPress site at `peptidescostarica.net`
and sell the catalog's products under a new design. It is not live yet; it
deploys to the separate Vercel project `peptidecostarica-website`. The team
checks both branches out side by side in one folder; see
`docs/workspace/workspace-AGENTS.md` and `docs/workspace/HOW-TO-USE.md`.

The website owns no prices, stock or orders. It relies on this app for all
of them, so the following are a contract with it. Change them deliberately,
and say so to the owner, because a change here can break the website without
any change on its branch:

- **The `products` table**, read with the public anon key: `product`,
  `category`, `price_usd`, `status`, `coa`, `image_url`, `priority`,
  `inventory_count`, `vial_size`, `is_default_size`, `description_en/_es`,
  `discount`, `free_bac_*`. The `product` string is what it posts back to
  checkout.
- **`/api/deals/current`** (the Deal of the Week and flash sales) and
  **`/api/exchange-rate`**.
- **`/api/orders/create`**: the website posts its orders here (only from a
  `*.peptidescostarica.net` origin) and handles `409 price_changed` by
  re-posting at the server's total.
- **`/pay-card`**: card payments from the website finish on this page,
  unchanged, and its thank-you page fires the `purchase` event.
- **Pricing code**: the website runs verbatim copies of `src/lib/pricing.js`,
  `bacWater.mjs`, `bulkDeal.mjs`, `fallbackExchangeRate.mjs`,
  `authoritativeCheckout.mjs`, `dealOffers.mjs`, `catalogFilters.mjs`,
  `promoEligibility.mjs`, `promoBadge.mjs` and `checkoutBreakdown.mjs`, so
  its prices match checkout to the colón. When you change one, the website's
  copy in `lib/catalog-pricing/` must be updated to match; its parity test
  fails until it is.
- **Tracking**: the website uses this app's GTM container (`GTM-M2GVDQ44`)
  and the same event names and `ecommerce` shape as `src/lib/dataLayer.mjs`
  and `src/lib/ecommerceAnalytics.mjs`. Renaming an event here means renaming
  it there too, or the shared tags stop firing for one of the two sites.

Rules for both branches: work in one application at a time, and never merge
`website` into `main` or `main` into `website`.

# Commit as the repo owner

Cloud sessions start with a global git identity of `Claude
<noreply@anthropic.com>`. GitHub and Vercel pick the avatar on a commit from
the author's email, so commits made with that default show an Anthropic icon
instead of the owner's.

Before your first commit, set the identity on this clone:

```
git config user.name  "GeminiSupa"
git config user.email "pgemini6780@gmail.com"
```

Keep adding the `Co-Authored-By: Claude ...` trailer. Authorship is the owner's;
the trailer is what records that the work was AI-assisted.
