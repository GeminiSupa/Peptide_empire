# Product integration — proposals

Status: **proposed, awaiting sign-off.** Nothing here has been migrated or built.

Source of truth is the existing `public.products` table. This site reads it with
the anon key; RLS is already open for SELECT and no policies are added.

---

## 1. SEO URLs — slug column vs mapping table

The requirement is URLs like `/bpc-157-costa-rica/`, and `products` has no slug.

### The fact that decides it

The relationship between products and marketing URLs is **many-to-one**, not
one-to-one. From the live site:

| Marketing page | Product rows behind it |
|---|---|
| `/ghk-cu-costa-rica/` | GHK-CU 50mg (₡31,814) **and** GHK-CU 100mg (₡45,448) |
| `/retatrutide-costa-rica/` | Retatrutide 24mg (₡74,989) **and** Retatrutide 50mg (₡110,055) |
| `/bpc-157-costa-rica/` | BPC-157 10mg **and** the BPC-157 + TB-500 combo |

And each product also has a second live URL in the `/product/*` namespace
(`/product/ghk-cu-50mg/`, `/product/ghk-cu-100mg/`) — 23 of them, all currently
indexed.

### Option A — add `slug` to `public.products`

**For:** one lookup, no join. A product and its URL are created together. A
unique index makes collisions impossible.

**Against:**
- **It cannot represent the existing URLs.** Two GHK-CU rows both need
  `/ghk-cu-costa-rica/`; a unique slug column forbids that, and a non-unique one
  isn't a key. The many-to-one cases above are not edge cases — they are the
  current site.
- One column holds one URL, so the 23 `/product/*` URLs still need a separate
  redirect mechanism anyway.
- It is a schema change to a table the catalog site owns, and it puts this
  site's SEO scheme (`-costa-rica` suffix) inside a shared commerce table.

### Option B — CMS-owned mapping table `site_product_routes` — **recommended**

**For:**
- Represents many-to-one natively: several products attach to one route.
- Holds **every** URL for a product, including the `/product/*` ones, each
  flagged canonical or redirecting. That turns the 301s into editable data
  instead of a hardcoded list, and answers open question 2 in the same stroke.
- Keeps the marketing URL scheme in the marketing schema. Zero change to the
  catalog's table.
- Retired slugs stay as redirect rows, so old links never 404.

**Against:**
- A join on every product page. Negligible at this size, and cached anyway.
- A new product has no route until someone creates one, so the admin needs a
  "create page for this product" step or new products are invisible here. This
  is the real cost, and it's an admin-UX cost, not a data one.

### Sketch

```sql
create table public.site_product_routes (
  route         text primary key references public.site_pages(slug) on delete cascade,
  is_canonical  boolean not null default true,
  redirect_to   text references public.site_pages(slug),
  updated_at    timestamptz not null default now()
);

create table public.site_product_route_items (
  route       text not null references public.site_product_routes(route) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  sort_order  integer not null default 0,
  primary key (route, product_id)
);
```

**One decision inside the decision:** that foreign key to `products(id)` is the
only place my schema touches the catalog's. It lives on my table, and
`on delete cascade` means deleting a product silently cleans up my rows rather
than blocking their delete. If you'd rather have literally zero coupling, drop
the FK and store a plain `uuid` — integrity then falls to the admin. I lean
toward keeping the FK; say the word and I'll drop it.

---

## 2. Category mapping

`products.category` is free text in catalog style ("Metabolic Research"); the
marketing site groups by WordPress style ("Peptides For Energy"). The two
vocabularies will keep drifting, because two different teams edit them.

**Proposal: a CMS-owned mapping table, many source values to one marketing
category.**

```sql
create table public.site_categories (
  slug              text primary key references public.site_pages(slug) on delete cascade,
  label_en          text not null,
  label_es          text not null,
  source_categories text[] not null default '{}',   -- values found in products.category
  sort_order        integer not null default 0,
  is_visible        boolean not null default true
);
```

A marketing category pulls in every product whose `category` appears in
`source_categories`. That gives:

- **Many-to-one**, so "Metabolic Research" and "Weight Management" can both feed
  `/peptides-for-weight-loss/`.
- **A product in several marketing categories** — nothing stops the same source
  value appearing in two rows.
- **Drift is fixable by the client**, in the admin, without a deploy. When the
  catalog team invents a new category string, products stop appearing here
  rather than appearing in the wrong place, and the fix is adding one array
  element.

Rejected: normalising `products.category` into a proper FK. That is the correct
database answer and the wrong project answer — it's the catalog's table, it would
need their migration, and it risks their filters.

**What I need to seed it:** the output of

```sql
select category, count(*) from public.products group by category order by 2 desc;
```

Until I see the real values, any mapping I write is guesswork.

---

## 3. Prices are TEXT

Treated as **display strings**. The site renders `price_usd` / `price_crc`
exactly as stored, picking the column from the currency toggle.

Rules the code will follow:

- **No sorting or comparison on price columns.** Ordering uses `priority`
  (integer), which already exists for this purpose.
- **No arithmetic in the page.** The one place arithmetic is tempting is the
  "15% off 5+ vials" figure. Parsing `"₡ 40,903"` means stripping a symbol,
  spaces and thousands separators, and it breaks the first time someone types
  `"₡40.903"` or `"Call for price"`. Proposal: **don't compute it** — state the
  discount as a percentage, exactly as the live site does today, and let the
  catalog checkout calculate the actual total. That keeps one system doing money.
- If a derived number is ever genuinely required, the parser returns `null` on
  anything unexpected and the UI **hides** the derived figure rather than
  printing `NaN` or a wrong price.
- `original_price_*` renders as a strikethrough only when it is non-empty **and**
  differs from the current price.
- Sale windows use `sale_start_time` / `sale_end_time` — timestamp comparison,
  never price comparison.

### Stock — one trap worth naming

`status` is the display source of truth: `'In Stock'`, `'Out of Stock'`,
`'Coming Soon'`.

`inventory_count IS NULL` means **not tracked / unlimited**, not zero. A naive
`inventory_count > 0` check would hide every untracked product on the site.
`inventory_count` is used only to refine low-stock messaging, and only when it is
non-null, against `low_stock_threshold` (default 5).

`'Coming Soon'` has no equivalent on the live WordPress site, which shows only
in-stock and `OUT OF STOCK`. See question 5 below.

---

## 4. Long-form product content

`products` carries only `description_en` / `description_es`, both short. The
live `/bpc-157-costa-rica/` page has a price list, four "Potential Effects"
subsections, "Why Researchers Choose…", and a nine-question FAQ.

That body content belongs in the CMS tables and needs no new mechanism: a
product page is a `site_pages` row plus its `site_page_sections`, exactly like
any other page, with `site_product_routes` linking it to the product rows whose
live price and stock get injected into the `product_grid` section.

So the split is:

| Comes from `products` | Comes from the CMS |
|---|---|
| name, price, currency, stock status, image, COA link, short description | headings, long-form body, effects sections, FAQ, SEO, section order |

---

## 5. Spanish content sourcing

Machine translation is out. Sources, in order:

1. **Page copy** — harvested from `peptidescostarica.net/es/`, which is
   human-reviewed TranslatePress output.
2. **Product short descriptions** — `products.description_es`.

I'll harvest `/es/` page by page alongside the English when seeding, so both
languages land in the same section rows.

The Spanish strings currently in `lib/nav.js` and `lib/site.js` are mine and are
**not** to be shipped. They're superseded by the seed harvest.
