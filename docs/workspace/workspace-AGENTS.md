# Shared context for every agent working in this folder

This file is the single source of truth for project context. `CLAUDE.md` is a
one-line import of this file. **Do not create a second context file.** If you
are Codex, Claude, or any other agent and you want to record context, a to-do
list, or a status update, put it here or in the relevant project's own
`AGENTS.md` — do not invent a new name.

## What is in this folder

Two applications, one GitHub repo (`GeminiSupa/peptidecosta`), two branches
checked out as sibling folders:

- `peptidecosta/` — branch `main`. The shop: catalog, cart, checkout, orders,
  admin portal, CRM, WhatsApp bot, deals and pricing. Live at
  `catalog.peptidescostarica.net` via the Vercel project `peptidecosta`.
- `peptidecosta-website/` — branch `website`. The site that replaces the
  current WordPress site, and now carries the storefront too. Not live yet.
  Deploys to the Vercel project `peptidecostarica-website`.

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
