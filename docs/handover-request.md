# What still has to come from the WordPress maintainer

Short version: **almost nothing.**

The live site leaves `/wp-json/` open and unauthenticated, so the entire English
corpus was pulled directly on 2026-07-31. A WXR export is no longer needed.

## Already obtained — do not ask for these

`node scripts/harvest-wp.mjs` → `data/wp/`

| | |
|---|---:|
| Pages (incl. all Elementor layouts, rendered) | 240 |
| Posts | 15 |
| Products | 67 |
| Product categories | 15 |
| Media records | 399 |
| Authors | 5 |

Also established without asking anyone:

- **643 URLs** mapped EN↔ES from the sitemaps (`data/routes.json`).
- **DNS** — nameservers are `dns1/dns2.registrar-servers.com`, i.e. the domain
  sits at **Namecheap**. Hosting is `157.245.213.33`, a **DigitalOcean** box
  running nginx. No Cloudflare in front.
- **Plugin stack** — Elementor + Elementor Pro, WooCommerce, TranslatePress,
  Astra child theme, Xagio SEO (this is what generates the four XML sitemaps —
  there is no Rank Math or Yoast), Breeze cache, plus currency, reviews and
  search add-ons.
- **No redirect layer is configured.** Unknown URLs return a plain 404 with no
  `Location` header, so there is no existing redirect map to inherit or
  preserve.
- **`/blog-2/` and `/return-refund-policy-2/` are already gone** (404 on the
  live site). Two fewer leftovers to decide about than previously documented.
- **7 of the 9 "missing" images were recovered.** They were never lost — they
  are in the Media Library under a *double extension*: the site references
  `IGF-1mg.jpg` while the actual upload is `IGF-1mg.jpg.jpeg`. Byte-verified
  and now wired into `scripts/download-images.mjs` (`RECOVERED`). These are
  broken for real visitors on the live site today; the rebuild fixes them.

## Still genuinely blocked

### 1. Spanish translations — the only real gap

TranslatePress keeps translations in its own `wp_trp_dictionary_*` tables and
**does not expose them over REST**. Verified: `?lang=es`,
`trp-edit-translation=preview`, and `/es/wp-json/…` all return English.

There is a working fallback — scraping the rendered `/es/` HTML, which is how
the home page was built — so this is not blocking, just slower and needing a
verification pass per page. A dump of those tables would make 321 Spanish pages
exact instead of scraped.

**Worth asking for. Not worth waiting for.**

### 2. Two images that are genuinely gone

`peptides-59-1` and `Untitled-design-6-1` return nothing from the Media Library
search in any form. Either replacements are needed, or the references get
removed.

### 3. Four unreachable media rows

`X-WP-Total` reports 403 media items; the API serves 399. Paging by date, id and
title each return the identical 399, so 4 rows exist in the database that REST
counts and then withholds — most likely orphaned attachment rows. Probably
nothing, but it is the kind of thing that turns out to be the two missing images
above.

### 4. Things no API can answer

- Drafts, scheduled posts, anything unpublished — REST returns published only.
  Is anything in flight?
- Who holds the **Namecheap** login (DNS is confirmed to be there) and the
  **DigitalOcean** account.
- The 4 surviving leftover URLs — `/test-script/`,
  `/basic-template-homepage/`, `/our-authors/`, `/product/pt-141-10mgtest/`
  (a test product, live and indexed). Redirect or let them 404?

---

## Paste-ready

> Hey! Quick one on the peptidescostarica.net rebuild — I've already pulled the
> page content, so I only need a few bits:
>
> 1. The TranslatePress translation data — a dump of the `wp_trp_dictionary_*`
>    tables. That's the one thing not in the API, and it's all 321 Spanish
>    pages.
> 2. Two images seem to be gone for good — `peptides-59-1` and
>    `Untitled-design-6-1`. Any originals lying around?
> 3. Anything sitting in drafts or scheduled to publish?
> 4. Do you know who has the Namecheap and DigitalOcean logins?
>
> Also — `/test-script/`, `/basic-template-homepage/`, `/our-authors/` and
> `/product/pt-141-10mgtest/` look like leftovers. Drop them, or redirect
> somewhere?
>
> No passwords needed. Nothing's changing on the live site.
