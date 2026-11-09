# Shared context for every agent working in this folder

This file is the single source of truth for project context. `CLAUDE.md` is a
one-line import of this file. **Do not create a second context file.** If you
are Codex, Claude, or any other agent and you want to record context, a to-do
list, or a status update, put it here or in the relevant project's own
`AGENTS.md` — do not invent a new name. A copy of this file is kept in Git at
`peptidecosta-website/docs/workspace/workspace-AGENTS.md`; when you change
one, copy it over the other.

## Where things stand (9 Nov 2026)

- **`peptidescostarica.net` is the new site.** The owner moved the domain from
  WordPress to Vercel on 9 Nov 2026. `peptidescostarica.net` (and
  `www.peptidescostarica.net`, to be redirected to it) serve the
  Vercel project (`peptidecostarica-website`, branch `website`). Every page
  declares `https://peptidescostarica.net/...` as its canonical. WordPress no
  longer serves the public domain.
- **`new.peptidescostarica.net` is retired** (owner, 9 Nov 2026). It was the
  pre-launch test address. Never link, configure or rely on it; it is being
  removed from Vercel and DNS.
- **`catalog.peptidescostarica.net` is still live and still needed.** Customers,
  ads, emails and WhatsApp links still send traffic there, and moving them
  takes time. Both sites run side by side for the foreseeable future; do not
  plan to switch the catalog off.
- **Checkout today:** the new site's cart posts every order to the catalog's
  `/api/orders/create`, and card/bank payment and their confirmation pages run
  on the catalog. A full copy of that code now exists in the website branch,
  switched off (see "Own checkout" below).
- **Indexing is on** (9 Nov 2026): `NEXT_PUBLIC_ALLOW_INDEXING=true` is set in
  the website's Vercel project (Production); `peptidescostarica.net` sends
  `index, follow`, `robots.txt` allows all and points at `/sitemap.xml`.

## THE GOAL — read this before anything else (owner, 8 Nov 2026)

The new site (`peptidecosta-website`, served at `peptidescostarica.net`) **is
the main business site**. It is not a marketing clone or a preview, and "not
live yet" is never a reason to skip back-end work.

1. **It must be able to run the whole Costa Rica business on its own.** If
   `catalog.peptidescostarica.net` were ever shut down, customers and staff must
   notice nothing: checkout, every payment method, the card and bank payment
   pages, customer and business accounts, admin and CRM, the WhatsApp bot and
   cart recovery, scheduled jobs, links in emails and WhatsApp messages, GA4 /
   Tag Manager and Google Ads conversions. Today most of that still runs on the
   catalog app; anything that only works because the catalog subdomain exists
   is a gap to close, not an acceptable dependency. (The catalog is not being
   shut down — this is the safety net.)
2. **While both are running, nothing may duplicate or conflict:** one order
   per checkout, no double purchase/conversion events, no double CRM leads,
   carts or WhatsApp messages, no scheduled job running twice, only one site's
   pages competing in Google for the same content, no price shown on one that
   is charged differently on the other.

Judge every change against those two rules.

## What is in this folder

Two applications, one GitHub repo (`GeminiSupa/peptidecosta`), two branches
checked out as sibling folders:

| Folder | Branch | App | Vercel project | Domains |
| --- | --- | --- | --- | --- |
| `peptidecosta/` | `main` | The shop: catalog, cart, checkout, orders, payments, admin portal, CRM, WhatsApp bot, deals, pricing, 18 cron jobs, every DB migration | `peptidecosta` | `catalog.peptidescostarica.net` |
| `peptidecosta-website/` | `website` | The main business site (new design, its own cart; replaced WordPress) | `peptidecostarica-website` | `peptidescostarica.net` (+ `www.`) |

`peptidecosta-website` is a git worktree of the same repo; `git` inside it
operates on the `website` branch (named `clone-website` until 23 Oct 2026).
**Never merge `website` into `main` or the reverse** — the two applications
have deliberately separate file layouts and histories.

The local `peptidecosta/` folder holds uncommitted edits from other people and
is behind `origin/main`. Do not commit, reset or stash there; to change the
catalog, use a separate worktree from `origin/main`.

**Retired, never work there:** the old standalone repo
`GeminiSupa/peptidecostarica-website` and its local copies
(`C:\Users\Maaz\Projects\peptidecostarica-website`,
`H:\Joe Webster\peptidecostarica-website`). It stopped on 18 Oct 2026, nothing
builds from it, and its `.vercel` link still points at the live website
project, so a `vercel` command there would overwrite the main site.

## Context files and the people using them

- **One context file per place: `AGENTS.md`.** Codex reads `AGENTS.md`;
  Claude Code reads `CLAUDE.md`, which in every place is only `@AGENTS.md`.
  So every rule goes in `AGENTS.md`, never in `CLAUDE.md`. Places: this
  folder (not in Git; copied to `docs/workspace/workspace-AGENTS.md` on both
  branches), and the root of each branch.
- **Two developers, equals.** Both direct Claude Code and Codex, do QA,
  decide what ships and push. One works in this folder; the other works
  remotely from GitHub and Vercel only (sees the branches, not this folder).
  Treat both the same; "the owner" in these files means whichever of them you
  are working for.
- **Feature branches** on GitHub (`codex/…`, `catalog-…`, etc.) are real,
  unfinished catalog work. Don't delete, rebase or merge them unless the
  developer you work for says so. Catalog branches merge into `main` only.

## Hard rules

- **Work in one folder at a time.** Fixing a marketing page never means editing
  the shop, and vice versa. If a change seems to need both, stop and say so.
- **Each project has its own `AGENTS.md`** with the real detail — pricing
  parity, QA rules, migrations, offer types, the checkout copy. Read the one
  for the folder you are working in before changing code.
- **Pushing `website` deploys `peptidescostarica.net`; pushing `main` deploys
  the catalog.** Both are production. Get the owner's OK before pushing.
- **Prices are decided only by the catalog's pricing code.** The website shows
  prices with a verbatim copy (`lib/catalog-pricing/`) and never does its own
  arithmetic.
- **Secrets.** Never commit an `.env` file, never print or paste key values
  (in chat, logs, commits or docs). Refer to variables by name only.

## How the two sites relate at runtime

- Both read and write the **same Supabase database**.
- The website reads products, prices, stock, banners, hidden products, reviews
  and business links from Supabase with the public anon key, and shows prices
  with the catalog's pricing functions.
- Orders: the website's cart posts to the catalog's `/api/orders/create`,
  which re-prices every order and is the only thing that decides what is
  charged. It accepts browser orders only from a `peptidescostarica.net` host
  (apex or any subdomain), so the main domain can take orders.
- Card / ACH / crypto payment continues on the catalog's `/pay-card` (ChargX);
  SINPE and bank transfer on the catalog's `/pay-bank`; ChargX's webhook calls
  the catalog.
- Still fetched from the catalog by the website: the deal of the week, the
  exchange rate, visitor analytics, lead forms, and the relayed CRM endpoints
  (promo validation, abandoned-cart save/clear, newsletter, referral scans,
  WhatsApp opt-in) — see `catalogUrl()` callers in the website.
- Only on the catalog: admin portal, CRM, WhatsApp bot, customer/business
  accounts, affiliate dashboards, cron jobs, migrations.
- GTM `GTM-M2GVDQ44` (GA4 `G-3B3PP5CKLE`, Google Ads `AW-18193858920`) loads
  on both sites, only on `peptidescostarica.net` hosts.

### Own checkout (website branch, 8 Nov 2026 — committed, not yet pushed)

The owner chose a **full copy** of the catalog's checkout and payments into the
website, so the business survives without the catalog. Details in
`peptidecosta-website/AGENTS.md`. In short: `scripts/sync-catalog-checkout.mjs`
copies the catalog's files verbatim (with a short list of patches) and
`--check` fails if they drift; it is switched on by
`NEXT_PUBLIC_OWN_CHECKOUT=true` once the website's Vercel project has the
catalog's server keys. Card/bank confirmation lives at `/order-confirmation/`
on the website (its `/thank-you/` is the WhatsApp one).

## Environment variables

- **Website Vercel project (`peptidecostarica-website`):** runs on built-in defaults (Supabase URL + anon key, catalog
  origin, site URL), plus `NEXT_PUBLIC_ALLOW_INDEXING=true` (set 9 Nov,
  Production only). To switch on its own checkout it also needs the
  catalog's server keys plus `NEXT_PUBLIC_OWN_CHECKOUT=true` — but **never**
  the catalog's `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_BASE_URL`.
- **Catalog Vercel project (`peptidecosta`):** 105 production variables. Most
  are marked **Sensitive**: Vercel never shows or downloads their values, so
  they cannot be copied project-to-project from the dashboard.
- **Local files (gitignored):**
  - `peptidecosta/.env.local` — the owner's working copy (63 names).
  - `peptidecosta/.env.production.local` — merged 9 Nov from Vercel + the
    owner's and the other developer's env files: 107 names, **30 blank**
    because they exist only as Sensitive values in Vercel (incl.
    `INTERNAL_API_SECRET`, `ORDER_RECEIPT_BCC`, `CHARGX_WEBHOOK_SECRET`, the
    `TAX_RECORDS_SMTP_*` and `CAMPAIGN_SMTP_*` sets, `CRON_SECRET`,
    `GA4_API_SECRET`, `OPENAI_API_KEY`). Only whoever entered them can supply
    them.
  - `peptidecosta-website/.env.local` — Supabase URL and anon key only.
- The website does not need a service-role key until its own checkout is
  switched on.

## Deploying

Two Vercel projects, both fed from this one repo. The catalog project builds
`main`; the website project builds `website`. A `NEXT_PUBLIC_*` variable only
takes effect after a redeploy. Vercel bills per team member and per usage —
adding a project costs nothing.

## Open items (keep this list current)

Owner (Omer) to do or decide:
1. ~~Turn indexing on~~ — done 9 Nov 2026.
2. Owner does not want `new.peptidescostarica.net` (9 Nov): remove it in
   Vercel → `peptidecostarica-website` → Domains, and delete its `new` CNAME
   at Namecheap (DNS for the domain is Namecheap, `registrar-servers.com`).
   Nothing in code depends on it. Make `www.` redirect (308) to the apex.
3. Submit `sitemap.xml` in Google Search Console. The existing property is
   verified by the two `google-site-verification` meta tags kept from
   WordPress (in `app/(en)/layout.js`); which Google account owns it is
   unknown — check the owner's accounts, else ask the former WordPress
   developer to add him as Owner, or verify a Domain property by DNS TXT.
4. ~~Push the switched-off checkout copy~~ (pushed 9 Nov). Get the 30 Sensitive
   values from the other developer; then add keys + `NEXT_PUBLIC_OWN_CHECKOUT`
   and place one test order.
5. OK to push the catalog fix that refuses orders for hidden products
   (branch `fix/hidden-products-checkout`, worktree `catalog-hidden-fix`).
6. Decide: customer/business accounts on the website; the 29 unsaved Codex
   Spanish translation files in the retired repo; Joey's page editor (Codex
   branch `codex/website-admin` vs fresh); card page opening ChargX in a new
   tab; cancel the 7 "Omer Test" orders (`W-MW7…` numbers).
7. Later: send `catalog.peptidescostarica.net` traffic to the main site
   (Belhassen's request) — only once the website does everything the catalog
   does.

Agents:
- Move the rest of the catalog-only back end to the website, one piece at a
  time, switching the catalog's copy off as each moves: deals/exchange
  rate/analytics/leads, then admin/CRM, WhatsApp bot, crons, ChargX webhook.
- Order emails load their logo from `catalog.peptidescostarica.net/logo.png`.
- Security: the anon key can read all `promo_codes`, including hidden ones
  (catalog RLS) — fix in the catalog.
- Shopper Approved display, the catalog's landing-page setting and GA4
  `sign_up` are not on the website yet.
- SEO, fixed 9 Nov 2026 on the website branch (commits a5b1e1db, fae69bca;
  live once pushed). Rules for anyone touching SEO there:
  - **Canonical and hreflang** come from `lib/seo-links.mjs` (route map),
    never from WordPress's harvested `data/seo.json`: every page is its own
    canonical; language pairs only when both pages name each other; the 25
    `/product/lp-…/` ad copies canonicalise to the regular product and stay
    out of the sitemap. `tests/seo-links.test.mjs` checks every page.
  - **Structured data** comes from `lib/site/structured-data.mjs`, built from
    what each page shows (breadcrumb component, FAQ accordions, live prices).
    Never re-add WordPress's harvested JSON-LD (old prices, wrong URLs).
    `node scripts/check-structured-data.mjs <base>` audits every sitemap page
    (966/966 passed on a production build).
  - Owner QA: `peptidecosta-website/docs/seo/structured-data-qa.md` (Google
    Rich Results Test on 10 URLs, then Search Console → Enhancements).
  - Not covered: ~30 old-layout pages (spec sheets, two leftover affiliate
    pages, discontinued Pinealon/TB-4) carry no structured data.
