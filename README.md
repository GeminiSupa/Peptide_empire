# Peptides Costa Rica — website

> **Agents: read `AGENTS.md` first.** It is the current source of truth and
> overrides anything older in this file. In short: this is the `website` branch
> of `GeminiSupa/peptidecosta` (the catalog is the `main` branch of the same
> repo). Vercel project `peptidecostarica-website` builds this branch and serves
> `new.peptidescostarica.net`. This site is becoming the main business site and
> must eventually run checkout, accounts, admin and CRM on its own.
>
> The old standalone repo `GeminiSupa/peptidecostarica-website` (local copies in
> `C:\Users\Maaz\Projects\` and `H:\Joe Webster\`) is **retired**: it stopped at
> 18 Oct 2026, nothing builds from it, and work done there is lost. Never work
> or run `vercel` from it.

Next.js rebuild of **https://peptidescostarica.net/** (currently WordPress +
WooCommerce + Elementor + Astra), now under a new design.

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

## The two sites

| | This branch (`website`) | Catalog (`main`) |
|---|---|---|
| Domain | `new.peptidescostarica.net` → `peptidescostarica.net` at cutover | `catalog.peptidescostarica.net` |
| Vercel project | `peptidecostarica-website` | `peptidecosta` |
| Role | The main business site (taking over shop, checkout, accounts, admin) | Still takes every real order today |
| Repo | `GeminiSupa/peptidecosta`, branch `website` | same repo, branch `main` |

While both run, nothing may duplicate: one order per checkout, no double
conversion events, CRM leads, WhatsApp messages or cron runs. See `AGENTS.md`.

## Rules this repo must not break

1. **Every URL path stays identical.** Paths like `/bpc-157-costa-rica/` are the
   site's SEO. Any path that must change requires a 301 redirect from the old one.
2. **Spanish stays at `/es/`.** English at `/`, Spanish at `/es/`. Do not switch
   to a `?lang=es` query parameter — that is the *catalog* site's convention, and
   changing it would break Spanish SEO.
3. **Never hardcode a `*.vercel.app` URL** in shipped code, content, or metadata.
   Use the real domain or relative paths.
4. **Search engines are blocked until launch** — see below.
5. **Back-end work moves here deliberately, never by copy-paste.** Admin, cron
   jobs and automation still run on the catalog; bringing one over must switch
   the catalog's copy off at the same time so nothing runs twice.
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
- [ ] Verify `/robots.txt`, `/sitemap.xml`, canonical, hreflang and schema on production
- [ ] Submit the new sitemap in Google Search Console after cutover
- [ ] Keep the existing Search Console property; do **not** use Change of Address
- [ ] Run `node scripts/post-launch-check.mjs` against the production domain
- [ ] Confirm who controls DNS for `peptidescostarica.net`; agree cutover time
- [ ] Keep WordPress running and reachable for 2 weeks after cutover (rollback)
- [ ] After cutover, verify `catalog.peptidescostarica.net` still works

## Settled decisions

The 31 Jul 2026 decisions ("Add to Cart links to the catalog", "no cart or
checkout here", "visuals match WordPress exactly") were **reversed** on
23 Oct and 1 Nov 2026: this site has its own cart and new design, and posts
orders to the catalog's `/api/orders/create`. Current decisions are in
`AGENTS.md`.

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
