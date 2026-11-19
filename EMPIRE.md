# Peptide Empire — start here

This repo is **one codebase + one Supabase database** that runs **four
country storefronts** and **one shared admin/CRM**. Everything is separated per
country by a `site_id` on each row and a per-country logo/currency/price.

This file is the single source of truth for the Empire setup. The older
`README.md` / `PROJECT_CONTEXT.md` in this repo are a leftover clone of the
Costa Rica project (`peptidescostarica.net`) — treat their Costa-Rica-specific
details as history, not as how Empire works.

## The two apps (two branches, each its own Vercel project)

| Branch | App | What it is |
| --- | --- | --- |
| `main` | **Storefronts** | The public shops, one per country. New design. |
| `catalog` | **Admin / CRM** | One shared back office for all four countries, with a country switcher. Has `/admin`. The storefront pages here are not used for Empire. |

Never merge `main` and `catalog` into each other.

## The four countries

| id | Brand | Domain | Currency | USD→local rate |
| --- | --- | --- | --- | --- |
| `co` | Peptidos Colombia | peptidoscolombia.co | COP | ~4000 (live feed) |
| `mx` | Peptidos Mexico | comprarpeptidosmexico.com | MXN | 17 (fixed) |
| `ar` | Peptidos Argentina | comprarpeptidosargentina.com | ARS | 1000 (fixed) |
| `ca` | Peptides Canada | canadapeptidesdirect.com | CAD | 1.4 (fixed) |

Config: `lib/site/countries.mjs` (storefront) and `src/lib/sites.mjs` (admin).

## How a country is chosen

`lib/site/currentSite()` resolves the country for each request:
1. **`NEXT_PUBLIC_SITE_ID`** env var if set (`co`/`mx`/`ar`/`ca`) — pins a whole
   deployment to one country, including statically built pages. This is how each
   storefront runs as its own Vercel project.
2. Otherwise the **request host** (the domain, or a `mx.localhost:3000`
   subdomain / `pe_site` cookie locally).

## What is per country vs shared

- **Per country:** logo (full + white + molecule icon + favicons, in
  `public/site/logo-<id>.*`), currency, prices, products, orders, customers,
  business accounts, leads, carts, deals/flash sales, blogs, ad spend, and —
  in the admin — which data each screen shows (filtered by `site_id`) and which
  countries each staff member may see.
- **Shared:** the Supabase database, the admin app itself, and the super admin.

## Deploying

**Each storefront = its own Vercel project** building `main`, with
`NEXT_PUBLIC_SITE_ID=<id>` plus `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Colombia may run with no `SITE_ID` (it is the
default). Add the country domain under the project's Domains later.

**The admin = one Vercel project** building `catalog` (Production Branch =
`catalog`, Root Directory default), with `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. No
`NEXT_PUBLIC_SITE_ID` (it runs all countries). A `NEXT_PUBLIC_*` var only takes
effect after a redeploy.

## Admin login

The super admin logs in at the **admin project's** `…/admin` (the `/admin` page
has its own login box) with the super-admin email + password. One login runs
every country; switch with the **Country** dropdown in the sidebar. Regular
staff see only the countries granted in Team Management → their profile
(`admin_profiles.allowed_sites`); the super admin sees all.

## SQL migrations (run in the Supabase SQL editor)

Base multi-country setup (already applied this session): `empire-schema.sql`,
`add-site-id.sql`, `enable-public-read.sql`, `admin-rls.sql`,
`add-admin-site-scope.sql`. **Still to run:** `add-deals-per-country.sql`
(makes "one live deal per kind" per country) before launching any real sale.

## Known remaining gaps

- **Order/commission pricing** uses one shared colón rate under the hood; true
  per-country order pricing needs a live exchange-rate feed per currency. The
  storefronts already price orders correctly per country before they reach the
  admin, so this does not currently misprice customer orders.
- **"Costa Rica / colones / CRC" wording** still appears deeper in the admin and
  in outbound order emails; "CRC" is the internal token for "local currency".
- Per-country **contact phone / WhatsApp** must be entered in admin Business
  info (the support email already defaults to each country's own domain).
- `admin-rls.sql` opens all tables to any authenticated user — tighten before
  enabling customer logins.
