# Website app — branch `main`, Vercel project `peptidecostarica-website`, peptidescostarica.net

**Shared context for both apps** (the goal, current status, the people,
branches and deploys, env vars, open items) is in `README.md` on branch
`catalog`: https://github.com/GeminiSupa/peptidecosta/blob/catalog/README.md.
Read it first; from this branch: `git fetch origin catalog && git show origin/catalog:README.md`.
This file holds the website's own rules. `AGENTS.md` and `CLAUDE.md` only
point to these two files; never put context in them.

Next.js rebuild of **https://peptidescostarica.net/** under a new design. It
replaced the WordPress + WooCommerce + Elementor + Astra site on 9 Nov 2026.

## Stack

| | |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| React | 19.2.4 |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) |
| Icons | lucide-react |
| Animation | framer-motion (used sparingly) |
| Language | JavaScript (no TypeScript) |
| Hosting | Vercel |

## Getting started

```bash
npm install
npm run dev
```

## Rules this repo must not break

1. **Every URL path stays identical.** Paths like `/bpc-157-costa-rica/` are the
   site's SEO. Any path that must change requires a 301 redirect from the old one.
2. **Spanish stays at `/es/`.** English at `/`, Spanish at `/es/`. Do not switch
   to a `?lang=es` query parameter — that is the *catalog* site's convention, and
   changing it would break Spanish SEO.
3. **Never hardcode a `*.vercel.app` URL** in shipped code, content, or metadata.
   Use the real domain or relative paths.
4. **Indexing is controlled by one variable** — see below.
5. **Back-end work moves here deliberately, never by copy-paste.** Admin, cron
   jobs and automation still run on the catalog; bringing one over must switch
   the catalog's copy off at the same time so nothing runs twice.
6. **Ask before adding any third-party script** (analytics, chat, pixels).

## Indexing

`app/robots.js` serves `Disallow: /` and both language layouts emit `noindex`
unless `NEXT_PUBLIC_ALLOW_INDEXING=true`. It must stay false on local and
preview deployments, and be `true` in the Production environment now that the
real domain is here; robots and page metadata switch together.

## Launch checklist (domain moved 9 Nov 2026; unticked items still open)

- [ ] Every old URL exists at the same path, or has a 301 redirect
- [ ] `/es/` Spanish pages complete
- [ ] Set production `NEXT_PUBLIC_ALLOW_INDEXING=true` at the domain cutover
- [ ] `sitemap.xml` generated with the real domain
- [ ] Canonical URLs point at `https://peptidescostarica.net`
- [ ] Verify `/robots.txt`, `/sitemap.xml`, canonical, hreflang and schema on production
- [ ] Submit the new sitemap in Google Search Console after cutover
- [ ] Keep the existing Search Console property; do **not** use Change of Address
- [ ] Run `node scripts/post-launch-check.mjs` against the production domain
- [x] Point `peptidescostarica.net` at this Vercel project (9 Nov 2026)
- [ ] Redirect `www.` to the apex, and remove the retired `new.` subdomain (Vercel + Namecheap)
- [ ] Keep WordPress running and reachable for 2 weeks after cutover (rollback)
- [ ] After cutover, verify `catalog.peptidescostarica.net` still works

## Settled decisions

The 31 Jul 2026 decisions ("Add to Cart links to the catalog", "no cart or
checkout here", "visuals match WordPress exactly") were **reversed** on
23 Oct and 1 Nov 2026: this site has its own cart and new design, and posts
orders to the catalog's `/api/orders/create`. Current decisions are under
"How the website is built" below.

**The blog is CMS-backed** (Supabase), per `docs/data-model.md` — not MDX files,
not headless WordPress.

The working editor is Admin → CMS → Blog on the `catalog` app. It writes the
shared `blogs` table; this website reads published rows every 30 seconds and
merges them above the harvested WordPress articles. English uses `/blog/<slug>/`
and Spanish uses `/es/blog/<slug_es>/`. This website owns the canonical URL,
metadata, BlogPosting/FAQ structured data and sitemap entries; the catalog's
copy canonicalises here so the two sites do not compete in search. The extra
fields require `add-blog-seo-fields.sql` from the `catalog` branch. Existing
blog rows still render if that migration has not run, but the enhanced editor
must not deploy before it. No extra env var is needed because both apps already
use the same Supabase URL and anon key.

The new-design footer reads Facebook and Instagram from the catalog CMS
Business info fields. Clearing either field hides that profile on the website;
there is deliberately no hardcoded fallback for those two links.

## Open: the WordPress handover

The live WordPress is maintained by a different developer. What to request from
them, and why each item matters, is in `docs/handover-request.md`.

Nothing is blocked on it — content can be harvested from the public HTML, which
is how the home page was built. The one item with no public-HTML fallback is the
TranslatePress `wp_trp_dictionary_*` tables.

## Legal disclaimer (must appear in the footer of every page)

> Products offered by Peptides Costa Rica are intended strictly for laboratory
> research use only. Not approved for the prevention, diagnosis, treatment, or
> cure of any disease. Not for human or veterinary use.

# How the website is built

## Where this is going

This site is becoming the shop. The owner's decision (23 Oct 2026) is to
let this site be the catalog, under a new design. (Clarified 8 Nov 2026: the
catalog app is not being switched off — customers still reach it directly, so
both run side by side for a long time. This site must simply be able to run
everything without it.) That is a change of direction: until then this branch was a marketing
clone whose shop buttons linked out to the catalog, and an earlier version of
this file told agents not to bring cart or checkout code here. It is now the
place both live.

**The catalog is still live and still takes every real order.** Nothing on
this branch may change it. Read its code freely; do not edit it, and do not
merge into `catalog`.

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

### Own checkout (8 Nov 2026, owner's decision: "full copy")

So the business survives without the catalog subdomain, this site carries a
**verbatim copy** of the catalog's checkout and payment code:
`/api/orders/create`, card/ACH/crypto (`/api/card-payment-link/*`,
`/api/chargx/*`, `/pay-card/`), SINPE and bank (`/api/bank-payments/*`,
`/pay-bank/`), order emails (`/api/order-notification`), the purchase receipt
and the catalog's thank-you page, here at **`/order-confirmation/`** (this
site's own `/thank-you/` is the WhatsApp one). Helpers live in `catalog/`;
the pages in `app/(pay)/`, a separate root layout loading the catalog's CSS.

- **Never hand-edit** anything listed in `catalog/.synced-files.json`. Fix the
  catalog (branch `catalog`), then `node scripts/sync-catalog-checkout.mjs`.
  `--check` fails when the copy has drifted; run it before every push.
  The few deliberate differences are the `PATCHES` in that script.
- It is **off** until `NEXT_PUBLIC_OWN_CHECKOUT=true` is set in the Vercel
  project together with the catalog's server keys (service-role key, ChargX,
  WhatsApp, secrets). Off, the cart posts to the catalog as before
  (`checkoutUrl()` in `lib/storefront/catalog-origin.mjs`).
- Both apps write the same database, and each order is posted once, to one
  of them, so nothing doubles. ChargX's webhook stays on the catalog until it
  is deliberately moved; a payment is recorded by whichever URL ChargX calls.
- Never copy the catalog's `NEXT_PUBLIC_SITE_URL` here: it would point
  canonicals and payment returns at the catalog.

Still on the catalog and not here: the admin portal, CRM, WhatsApp bot,
affiliate dashboards, cron jobs and every migration, plus deals, the
exchange rate, analytics tracking and the lead endpoints this site still
fetches from the catalog (`catalogUrl()` callers).

### The order-submission constraint

`/api/orders/create` accepts a browser POST only from the catalog's own origin
or a `*.peptidescostarica.net` host. So **orders cannot be submitted from a
`*.vercel.app` preview URL** — the catalog will refuse them, by design, as a
CSRF control. To take real orders from a preview, give the Vercel project a
company subdomain. The apex
`peptidescostarica.net` is accepted too, so the live site takes orders.

**Indexing:** `NEXT_PUBLIC_ALLOW_INDEXING` switches `robots.txt` and the
robots meta. Now that the real domain is here it must be `true` in the
Vercel project's Production environment (and only there). It was set on
9 Nov 2026; the live site sends `index, follow`.

## The new design (build started 1 Nov 2026)

The designer's prototype is `docs/design/peptides-costa-rica-site.html`: one
file, every page drawn by JavaScript behind `#` routes. It is being rebuilt
here as real server-rendered pages. Run `npm run dev` beside a static server on
that file to compare page for page.

**The brief's rules:** every current URL keeps its exact path (English, `/es/`
and product variant URLs); every page keeps today's title, meta description
and H1; content is in the page source; pages the prototype doesn't draw (blog
posts, guides, city pages) use the nearest prototype template. Keep the
Trustpilot and Shopper Approved embeds as real widgets. Products, prices,
stock, the exchange rate and the Deal of the Week come from the catalog.

**Owner decisions:** card payments keep going to the catalog's existing
`/pay-card` (ChargX), unchanged — the catalog is not edited for this. GTM
uses the catalog's container, `GTM-M2GVDQ44` (decided 2 Nov 2026), and loads
on any `peptidescostarica.net` host (or anywhere when
`NEXT_PUBLIC_ALLOW_INDEXING=true`), never on localhost or `*.vercel.app`, so
test traffic never reaches the reports (`components/site/site-tracking.js`).

**How it is built:**

- `app/site.css` is the prototype's stylesheet, generated by
  `scripts/import-prototype.mjs` and scoped under `.pcr-site`. Never hand-edit it;
  re-run the script on a new prototype file. Hand-written additions go in
  `app/site-base.css`.
- `components/site/` holds the new design's components; `lib/site/` its data
  and translation. The older `components/storefront/` (the `?p=` shop on `/`)
  is replaced by these as each page moves over.
- Prices still go through `lib/catalog-pricing/` only. The deal and the volume
  discount never combine; the catalog's checkout picks the larger, and so does
  the display.

**URL → template:**

| URLs | template |
| --- | --- |
| `/`, `/es/` | home |
| `/shop/`, `/all-peptide-products-costa-rica/` | catalog |
| `/<compound>-costa-rica/` (productLander) | product view |
| `/product/<slug>/` (variant URLs) | product view, that strength preselected |
| `/product/<compound-slug>/`, `/es/producto/<compound-slug>/` | product view for a compound the catalog added after the live site was harvested (no live URL); new URLs, title from the name, description from the catalog row |
| marketing categories and `/product-category/<slug>/` | category |
| core pages (about, bulk discounts, COA, FAQ, contact…) | their prototype page |
| legal pages | policy page |
| city pages | location page |
| blog, guides, mixing guides | blog index / post |

- Templates that draw a live page take its H1 from `lib/site/live-h1.js` and
  its text from `lib/site/live-copy.mjs`, which lifts every heading,
  paragraph, item and FAQ out of the harvested Elementor tree;
  `components/site/copy-block.js` lays a block out. The prototype's
  "Existing copy migrates here" notes are filled this way, never by
  rewriting. Copy the CMS scrubs for stale prices (`withoutHarvestedCommerce`)
  stays scrubbed.
- Routing: `components/site/product-route.js` (landers and `/product/`
  vial pages; `lib/site/product-pages.mjs` maps a vial slug to its compound
  and strength) and `components/site/page-route.js` (a table of English path
  → template). A page whose product the catalog no longer sells keeps its old
  layout rather than 404ing.

- Pages the designer drew as finished marketing pages (about, our story, our
  process, bulk discounts, affiliate, pros, contact, FAQ, info center, service
  locations, feedback, app, COA database, the three policies, and the city
  template) are snapshots of the prototype's own rendering:
  `docs/design/rendered/*.html` → `scripts/import-pages.mjs` →
  `data/site/pages/*.json` → `components/site/proto-page.js`, which resolves
  `#` links to live URLs, translates, fills in live figures, keeps the live
  H1 (as the kicker when the design's headline differs) and swaps in live
  widgets (`$products`, `$categories`, review widgets, calculators, the lead
  forms in `lead-forms.js`, the COA list). Marketing photos of the old vial
  design are left out (`RETIRED_IMAGES` in `proto-page.js`) until new photos
  exist; don't bring them back. Those pages use the designer's new
  copy; product, category, catalog and city pages keep the live copy below the
  design. Lead forms have no backend: they open WhatsApp with the answers.
- Templates by URL and page kind: `components/site/page-route.js`. Articles
  (blog posts, guides, mixing guides) use `post-page.js` around the live
  article HTML. Pages the design adds (`/our-process/`, `/explore-our-app/`,
  `/for-professionals/`, `/deal-of-the-week/`, `/thank-you/` and their `/es/`
  twins) have their own route folders.
- City H1s on the live site print an unfilled template ("Premium Peptides in
  [location] Alajuela"); `lib/site/city.mjs` fills in the town from the page
  title. 60 live city titles are also broken ("Research Products in , –") and
  are kept as-is until the owner decides.
- `app/globals.css` excludes `docs/` and `scripts/` from Tailwind's scan: the
  3 MB prototype stalled the dev server.
- `scripts/check-parity.mjs` checks every live URL for 200, the live title and
  description, and one H1, against a running build.

**Progress:** all templates built: shell, home, catalog, product, category,
cart (deal-inclusive totals; WhatsApp orders land on the thank-you page),
deal of the week, core pages, legal, city, blog and guides, Spanish, GTM.
- Tracking: `lib/site/analytics.mjs` pushes the catalog's own events in the
  catalog's own shape (USD values, same item ids): `view_item`,
  `add_to_cart`, `view_cart`, `begin_checkout`, `add_payment_info`,
  `whatsapp_order` (thank-you page, once per order), `generate_lead`,
  `whatsapp_click`, plus `search`, `view_promotion`, `select_promotion`.
  Card `purchase` fires on the catalog's own thank-you page, as before.

To test deal mode while no deal runs, point `getLiveDeal` at a saved
`/api/deals/current` body with a future `ends_at`, locally, and revert.

## Page speed

Mobile PageSpeed was 75 on 11 Nov 2026, and the loss was entirely third-party:
paint and layout already scored full marks (FCP 1.1 s, LCP 1.1 s, CLS 0) while
TBT was 900 ms and Speed Index 5.1 s. Two things caused it, both now fixed on
this branch (not yet pushed).

- **Icons are a subset, never the whole family.** The design draws icons as
  Material Symbols ligatures. Asking fonts.googleapis.com for the family with
  open axis ranges returned the entire variable font — **3 MB of a 5.1 MB
  page**. `lib/site/icon-names.mjs` is **generated**: run
  `node scripts/collect-icon-names.mjs` after adding an icon and commit the
  result; `--check` and `tests/icon-names.test.mjs` fail when it drifts. Both
  shells build the URL with `materialSymbolsHref()` so they share one cached
  font (**33 KB**, 49 KB with every page's icons). Never paste a
  `fonts.googleapis.com/css2?family=Material` URL into a component.
  `data/material-symbols.txt` is Google's published name list, used only to
  tell an icon name from an ordinary string while scanning.
- **A ligature must reach the font untransformed.** `bolt` inside an uppercase
  badge renders as the word "BOLT", which is what the Volume pricing badge was
  doing. `app/site-base.css` sets `text-transform: none` on the icon classes.
- **Tag Manager waits for the visitor.** The container (GTM, GA4, Google Ads
  and Clarity) is 519 KB and held the main thread for ~990 ms — effectively the
  whole TBT. `components/site/site-tracking.js` now loads it on the first
  interaction, or after `FALLBACK_MS` (5 s), whichever comes first. Events
  raised earlier queue in `dataLayer` and GTM replays them, so no order or
  conversion is lost. The cost: a visitor who leaves without scrolling or
  tapping inside that window is never counted, so GA4 pageviews may read
  slightly lower. Change `FALLBACK_MS` in that file to trade back.
- Clarity is loaded **by the GTM container**, not by this repo; removing or
  deferring it further is a change in GTM, not in code.

Still open: product images come from Supabase as PNGs outside `next/image`
(667 KB on the home page, "improve image delivery" ≈ 228 KB) and carry no
width/height. That needs the Supabase hostname in `next.config.mjs`
`images.remotePatterns` and is not done.

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
- Treat changes on `catalog` and `main` (this site) as independent. Do not merge
  either branch into the other unless the owner explicitly requests it.
- Before committing in this repository, use Git author
  `GeminiSupa <pgemini6780@gmail.com>` and retain the
  `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.
