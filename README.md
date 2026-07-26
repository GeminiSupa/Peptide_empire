# Peptides Costa Rica — website

Next.js rebuild of **https://peptidescostarica.net/** (currently WordPress +
WooCommerce + Elementor + Astra).

This is a **re-platform, not a redesign**. The visual result should match the
existing site: same layout, sections, order, and wording.

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

## The two-sites rule

The business runs **two** separate websites. Do not confuse them.

| | This repo | Catalog site |
|---|---|---|
| Domain | `peptidescostarica.net` | `catalog.peptidescostarica.net` |
| Role | Marketing site | Live catalog, cart, checkout, admin |
| Repo | this one | separate private repo |

**Never** copy the catalog site's cron jobs, `/admin` panel, API routes, or
environment variables into this project. That site sends real email and takes
real payments — duplicating any of it would double-charge or double-email real
customers. The only thing this project needs from it is its public URL, for
linking.

## Rules this repo must not break

1. **Every URL path stays identical.** Paths like `/bpc-157-costa-rica/` are the
   site's SEO. Any path that must change requires a 301 redirect from the old one.
2. **Spanish stays at `/es/`.** English at `/`, Spanish at `/es/`. Do not switch
   to a `?lang=es` query parameter — that is the *catalog* site's convention, and
   changing it would break Spanish SEO.
3. **Never hardcode a `*.vercel.app` URL** in shipped code, content, or metadata.
   Use the real domain or relative paths.
4. **Search engines are blocked until launch** — see below.
5. **No admin panel, cron jobs, or marketing automation.** Those live on the
   catalog site. This project is a website, not a second backend.
6. **Ask before adding any third-party script** (analytics, chat, pixels).

## Pre-launch: indexing is blocked

`public/robots.txt` serves `Disallow: /` and the root layout emits `noindex`.
Both are deliberate and must stay until launch day. See the launch checklist
below.

## Launch-day checklist

- [ ] Every old URL exists at the same path, or has a 301 redirect
- [ ] `/es/` Spanish pages complete
- [ ] `robots.txt` `Disallow` removed **and** `noindex` removed from the layout
- [ ] `sitemap.xml` generated with the real domain
- [ ] Canonical URLs point at `https://peptidescostarica.net`
- [ ] All shop buttons point where the cart decision landed (see below)
- [ ] Confirm who controls DNS for `peptidescostarica.net`; agree cutover time
- [ ] Keep WordPress running and reachable for 2 weeks after cutover (rollback)
- [ ] After cutover, verify `catalog.peptidescostarica.net` still works

## Open decision: where does "Add to Cart" go?

The WordPress site has a working WooCommerce checkout, and the catalog site also
has a working checkout. Two stores, one business. Pending client decision:

- **Option A — marketing site only (recommended).** Products and prices are shown
  here, but every buy button links to the catalog site. One cart, one checkout,
  one order list. No payment code in this repo.
- **Option B — keep selling on this domain.** This repo then needs its own product
  data, cart, checkout, payment gateway, and order handling, and orders split
  across two systems.

Static and marketing pages are being built first, so this decision does not block
progress.

## Legal disclaimer (must appear in the footer of every page)

> Products offered by Peptides Costa Rica are intended strictly for laboratory
> research use only. Not approved for the prevention, diagnosis, treatment, or
> cure of any disease. Not for human or veterinary use.
