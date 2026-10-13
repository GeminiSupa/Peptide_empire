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

`app/robots.js` serves `Disallow: /` and both language layouts emit `noindex`
unless `NEXT_PUBLIC_ALLOW_INDEXING=true`. This is deliberate and must stay false
on local and preview deployments. At cutover, set the variable to `true` only in
the production environment; robots and page metadata switch together.

## Launch-day checklist

- [ ] Every old URL exists at the same path, or has a 301 redirect
- [ ] `/es/` Spanish pages complete
- [ ] Set production `NEXT_PUBLIC_ALLOW_INDEXING=true` at the domain cutover
- [ ] `sitemap.xml` generated with the real domain
- [ ] Canonical URLs point at `https://peptidescostarica.net`
- [ ] All shop buttons point at `catalog.peptidescostarica.net`
- [ ] Verify `/robots.txt`, `/sitemap.xml`, canonical, hreflang and schema on production
- [ ] Submit the new sitemap in Google Search Console after cutover
- [ ] Keep the existing Search Console property; do **not** use Change of Address
- [ ] Run `node scripts/post-launch-check.mjs` against the production domain
- [ ] Confirm who controls DNS for `peptidescostarica.net`; agree cutover time
- [ ] Keep WordPress running and reachable for 2 weeks after cutover (rollback)
- [ ] After cutover, verify `catalog.peptidescostarica.net` still works

## Settled decisions (client, 2026-07-31)

**"Add to Cart" links to the catalog site.** Products and prices are shown here,
but every buy button links to `catalog.peptidescostarica.net`. One cart, one
checkout, one order list. This repo gets **no** cart, checkout, payment gateway,
or order handling — see the two-sites rule above.

**Visuals match the live site exactly**, because this is a re-platform, not a
redesign: white page background, Open Sans body / Inter headings. The brief's
brand kit (`#F4F6F9`, Montserrat) is deliberately *not* applied.

**The blog is CMS-backed** (Supabase), per `docs/data-model.md` — not MDX files,
not headless WordPress.

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
