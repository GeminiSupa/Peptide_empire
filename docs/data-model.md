# Data model — CMS-driven marketing site

Status: **proposed, awaiting sign-off.** The migration in
`supabase/migrations/0001_cms_schema.sql` has **not** been run.

## Principle

No user-visible text, image URL, or button link lives in this repo. The code
ships components and layout; Supabase ships everything a visitor reads. Adding a
new *kind* of section is the only change that needs a deploy.

## Tables

All new tables are prefixed `site_` so they never get confused with the
commerce/catalog tables already in the project.

| Table | Holds |
|---|---|
| `site_pages` | One row per route. `slug` is the literal URL. |
| `site_section_types` | Registry of renderable types + field schema for the admin form builder. |
| `site_page_sections` | The ordered blocks of each page. All copy lives here. |
| `site_page_seo` | Title, description, OG image, canonical, noindex — per page, per language. |
| `site_settings` | Header, footer, nav, contact details, disclaimer, social. |

### Why nav is JSON, not rows

Navigation is a tree. With a row-per-item table, every draft row needs a
`parent_id` pointing at a *different* row than its published twin, and publishing
has to remap the whole tree. Storing each menu as one JSON document under
`site_settings` publishes atomically and keeps the admin form simple. Menus are
edited rarely and read as a unit, so nothing is lost.

## Draft vs published

Every editable table carries `state` — `'draft'` or `'published'`.

- The admin edits **draft** rows.
- This website reads **published** rows, and *only* published rows.
- `site_publish_page(slug)` replaces the published rows from the draft rows in
  one transaction.

Publishing the whole page atomically — rather than row by row — is what stops a
half-finished edit going live. It also handles reordering, added sections, and
deleted sections correctly, which a per-row `is_published` flag does not.

`site_revert_page(slug)` copies published back over draft, to throw away
in-progress edits.

Draft invisibility is enforced by RLS, not by application code: the anon role's
policy is `using (state = 'published')`, so this site physically cannot read a
draft even if a query forgot to filter.

## Bilingual content

**One page row serves both languages.** There is no separate Spanish page row.
Every text key inside `content` has `_en` and `_es` variants, and the site picks
the pair based on which route rendered it:

```jsonc
{
  "title_en": "Premium Peptides in Costa Rica",
  "title_es": "Péptidos Premium en Costa Rica",
  "chips": [
    { "label_en": "Verified quality", "label_es": "Calidad verificada" }
  ],
  "cta_label_en": "Browse All Peptide Products",
  "cta_label_es": "Ver Todos Los Productos",
  "cta_href": "/all-peptide-products-costa-rica/",
  "image_url": "https://<project>.supabase.co/storage/v1/object/public/site-content/hero.webp"
}
```

Links are stored **language-neutral**. `/about/` is stored once; the site renders
it as `/about/` in English and `/es/about/` in Spanish. This keeps Spanish on the
`/es/` path convention and out of the catalog site's `?lang=` convention.

> **Open question 4 below:** what should render if `_es` is empty — fall back to
> English, or hide the section?

## Rendering pipeline

```
/[route]  →  fetch published sections for slug, ordered by sort_order
          →  for each: look up section_type in the component registry
          →  render <Component content={content} lang={lang} />
```

The registry is the one place code and data meet:

```js
// components/sections/registry.js
export const SECTION_COMPONENTS = {
  hero: Hero,
  press_band: PressBand,
  feature_cards: FeatureCards,
  // ...
};
```

An unknown `section_type` renders nothing in production rather than crashing the
page — a section type can exist in the database before its component ships.

## Caching and revalidation

Next.js 16 with `cacheComponents: true`:

- Each data function is wrapped in `use cache` and tagged with `cacheTag`.
- Tags: `page:<slug>`, `seo:<slug>`, `settings`, `products`.
- `cacheLife('max')` — long cache, because we invalidate explicitly rather than
  waiting for a timer. This is what the Next docs recommend for a CMS.
- `POST /api/revalidate` accepts a tag from the admin and calls
  `revalidateTag(tag, 'max')`.

So the site is served from cache (fast) but updates the moment the client hits
publish (no long cache wait). Authenticated with a shared secret in
`REVALIDATE_SECRET`.

## Reused, not duplicated

Products, blog posts, promo codes and banners stay in their existing tables.
A `product_grid` section stores only **references**:

```jsonc
{ "title_en": "Popular Products", "product_refs": ["<id>", "<id>"] }
```

The site resolves those against the existing product table at render time, so
prices and stock have exactly one source of truth. **This needs the existing
schema — see question 1.**

## Security

| | |
|---|---|
| This site | anon key, `SELECT` only, published rows only |
| Admin | service role, in the catalog repo, never here |

The service role key must never appear in this project — not in code, not in
`.env`, not in Vercel's env for this project. RLS grants anon `select` and
nothing else; the publish functions are explicitly revoked from anon.

Environment variables this site needs (set by the client, not committed):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
REVALIDATE_SECRET
```

## Images

Supabase Storage bucket `site-content`, public read, admin-only write. URLs are
stored in section JSON. No content images in the repo.

`next.config.mjs` needs the Supabase hostname in `images.remotePatterns` before
`next/image` will serve them.

## Open questions

1. **Existing table schema.** I need the table and primary-key column names for
   products, blog posts, promo codes and banners, plus the product columns the
   grid should display (name, price, currency, stock, image, slug). Without this
   I can't write the resolver, and I'd rather ask than guess at a schema I can't
   see.
2. **`/product/*` URLs.** 23 live WooCommerce URLs (see
   `docs/url-inventory.md`). With no cart here, do they become plain product
   pages, or 301 to their `-costa-rica` equivalent?
3. **Header/footer.** I've assumed the announcement bar, nav, contact details and
   legal disclaimer are all editable too, per "no user-visible text in code".
   Confirm — it's the difference between `site_settings` being used or unused.
4. **Empty Spanish.** Fall back to English, or hide the section?
5. **Who seeds the content?** The migration seeds page rows and section types but
   no copy. Either I write a one-off seed script transcribing the live site, or
   the client types it into the admin once it exists. The former is a lot faster
   and less error-prone.
