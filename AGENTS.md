# Clone website branch

This branch contains the website for `peptidescostarica.net`. The `main`
branch of this repository contains the separate live catalog application for
`catalog.peptidescostarica.net`.

## Where this is going

This site is becoming the shop. The owner's decision (23 Oct 2026) is to
retire the catalog application and let this site be the catalog, under a new
design. That is a change of direction: until then this branch was a marketing
clone whose shop buttons linked out to the catalog, and an earlier version of
this file told agents not to bring cart or checkout code here. It is now the
place both live.

**The catalog is still live and still takes every real order.** Nothing on
this branch may change it. Read its code freely; do not edit it, and do not
merge into `main`.

## How the storefront works

The storefront sells the catalog's products without owning any of its money
logic:

- **Products** come from the catalog's Supabase `products` table, read with
  the public anon key — prices, stock and bilingual descriptions, every 60
  seconds. One row per vial; `lib/storefront/group-products.mjs` groups them
  into compounds with a size picker.
- **Prices** are displayed using the catalog's own pricing functions, copied
  verbatim into `lib/catalog-pricing/`. **Do not edit those four files and do
  not write pricing arithmetic anywhere else.** See their `README.md`.
- **Orders** are posted to the catalog's `/api/orders/create`, which is the
  single door every public order goes through. It prices the cart itself,
  awards the live offers, writes the row, alerts staff and mints the card
  token. This site states a total only so that checkout can refuse it if the
  two disagree; on `409 price_changed` it re-posts at the server's figure.
- **Card payments** continue on the catalog's own `/pay-card` page. No card
  number ever reaches this site.
- **There is no service-role key here, and none is needed.** If you find
  yourself wanting one, you are about to write a second implementation of
  something checkout already does.

Still on the catalog and not here: the admin portal, CRM, WhatsApp bot,
affiliate dashboards, cron jobs and every migration.

### The order-submission constraint

`/api/orders/create` accepts a browser POST only from the catalog's own origin
or a `*.peptidescostarica.net` host. So **orders cannot be submitted from a
`*.vercel.app` preview URL** — the catalog will refuse them, by design, as a
CSRF control. To take real orders from a preview, give the Vercel project a
company subdomain such as `new.peptidescostarica.net`.

Pointing the bare `peptidescostarica.net` at Vercel is the owner's cutover
decision and a separate step: the WordPress site is still live there, on
157.245.213.33. `NEXT_PUBLIC_ALLOW_INDEXING` stays `false` until then.

## Rules

- Read `README.md` and the relevant guide under `node_modules/next/dist/docs/`
  before changing Next.js code. This installed Next.js version differs from
  older conventions.
- Preserve the existing URL paths, trailing slashes, and Spanish `/es/`
  routes. The site has ~516 English and ~512 Spanish routes that are live and
  indexed today; a redesign of the shop must not 404 any of them.
- The storefront design system is `app/storefront.css`, every rule scoped
  under `.storefront`. The older tokens in `app/globals.css` clone the live
  WordPress site and still style the blog, guides, spec sheets and legacy
  pages, which this phase deliberately leaves alone. Do not "unify" the two
  without being asked — the mixture is a known, staged state. Note that
  `globals.css` sets bare `h1`–`h6` and `body` rules that reach inside the
  scope; `storefront.css` ends with the handful of overrides that corrects.
- Treat changes on `main` and `website` as independent. Do not merge
  either branch into the other unless the owner explicitly requests it.
- Before committing in this repository, use Git author
  `GeminiSupa <pgemini6780@gmail.com>` and retain the
  `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.
