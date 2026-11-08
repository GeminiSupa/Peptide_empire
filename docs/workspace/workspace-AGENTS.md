# Shared context for every agent working in this folder

This file is the single source of truth for project context. `CLAUDE.md` is a
one-line import of this file. **Do not create a second context file.** If you
are Codex, Claude, or any other agent and you want to record context, a to-do
list, or a status update, put it here or in the relevant project's own
`AGENTS.md` — do not invent a new name.

## THE GOAL — read this before anything else (owner, 8 Nov 2026)

The new site (`peptidecosta-website`, now at `new.peptidescostarica.net`,
moving to `peptidescostarica.net` to replace WordPress) **is the main business
site**. It is not a marketing clone or a preview, and "not live yet" is never a
reason to skip back-end work.

1. **It must run the whole Costa Rica business on its own.** If
   `catalog.peptidescostarica.net` is ever shut down, customers and staff must
   notice nothing: checkout, every payment method, the card and bank payment
   pages, customer and business accounts, admin and CRM, the WhatsApp bot and
   cart recovery, scheduled jobs, links in emails and WhatsApp messages, GA4 /
   Tag Manager and Google Ads conversions. Today most of that still runs on the
   catalog app; anything that only works because the catalog subdomain exists
   is a gap to close, not an acceptable dependency.
2. **While both are running, nothing may duplicate or conflict:** one order
   per checkout, no double purchase/conversion events, no double CRM leads,
   carts or WhatsApp messages, no scheduled job running twice, only one site
   indexed by Google, no price shown on one that is charged differently on the
   other.

Judge every change against those two rules.

## What is in this folder

Two applications, one GitHub repo (`GeminiSupa/peptidecosta`), two branches
checked out as sibling folders:

- `peptidecosta/` — branch `main`. The shop: catalog, cart, checkout, orders,
  admin portal, CRM, WhatsApp bot, deals and pricing. Live at
  `catalog.peptidescostarica.net` via the Vercel project `peptidecosta`.
- `peptidecosta-website/` — branch `website`. The main business site that
  replaces the WordPress site. Live for testing at `new.peptidescostarica.net`
  (Vercel project `peptidecostarica-website`); the owner moves it onto
  `peptidescostarica.net` when he decides.

**Retired, never work there:** the old standalone repo
`GeminiSupa/peptidecostarica-website` and its local copies
(`C:\Users\Maaz\Projects\peptidecostarica-website`,
`H:\Joe Webster\peptidecostarica-website`). It stopped on 18 Oct 2026, nothing
builds from it, and its `.vercel` link still points at the live website
project, so a `vercel` command there would overwrite the new site.

`peptidecosta-website` is a git worktree of the same repo. Running `git` inside
it operates on the `website` branch (named `clone-website` until 23 Oct 2026).
Never merge `website` into `main` — the two applications have deliberately
separate file layouts and histories.

## Hard rules

- **Work in one folder at a time.** Fixing a marketing page never means editing
  the shop, and vice versa. If a change seems to need both, stop and say so.
- **The WordPress site is still live** at `peptidescostarica.net`
  (157.245.213.33 — not Vercel). Nothing you do may point that domain at
  Vercel. `NEXT_PUBLIC_ALLOW_INDEXING` stays `false` in the clone until the
  owner cuts over.
- **Each project has its own `AGENTS.md`** with the real detail — pricing
  parity, QA rules, migrations, offer types. Read the one for the folder you
  are working in before changing code.
- **Environment files.** Both projects read the same Supabase database, so the
  website's `.env.local` reuses the catalog's `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The website additionally needs
  `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ALLOW_INDEXING` and
  `NEXT_PUBLIC_IMAGE_BASE`. The clone does not need a service-role key. Never
  commit any `.env` file; never print key values.

## How the two sites relate at runtime

The catalog owns product prices, stock, orders, checkout and payments. The
website reads the catalog's product rows and published copy from Supabase, and
posts the orders its storefront takes to the catalog's `/api/orders/create`.
It prices nothing and saves nothing itself: that endpoint re-prices every
order and is the only thing that decides what is charged.

Because that endpoint only accepts orders from a `*.peptidescostarica.net`
host, the website can take real orders only once it is served from one.

## Deploying

Two Vercel projects, both fed from this one repo. The catalog project builds
`main`; the website project builds `website`. Vercel bills per team member and
per usage — adding a project costs nothing.
