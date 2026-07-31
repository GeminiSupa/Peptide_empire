-- ============================================================================
-- TABLE NAMES ARE PREFIXED site_cms_* DELIBERATELY.
--
-- The production database already has a LIVE `site_settings` table, read by
-- roughly 15 files in the CRM/catalog application. An unprefixed table here
-- would collide with it, and `create table` against the wrong database could
-- take down the admin that runs the shop.
--
-- Every table in this file is namespaced so that an accidental run cannot
-- touch anything that already exists. Do not remove the prefix.
--
-- THIS MIGRATION HAS NEVER BEEN RUN. It is a design artifact only.
-- ============================================================================

-- =====================================================================
-- Peptides Costa Rica — marketing site CMS schema
--
-- REVIEW BEFORE RUNNING. This file has not been executed against any
-- database. Run it yourself after review.
--
-- Scope: the editable marketing site at peptidescostarica.net.
-- It adds NEW tables only and does not touch existing tables. Products,
-- blog posts, promo codes and banners already live in this project and
-- are referenced, never duplicated.
--
-- Naming: everything here is prefixed `site_` to keep it clearly
-- separate from the catalog/commerce tables in the same project.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Draft vs published
--
-- Every editable table carries a `state`. The admin edits 'draft' rows;
-- this website only ever reads 'published' rows. Publishing replaces the
-- published rows for a page from its draft rows inside one transaction,
-- so a page goes live all at once — reorders, additions and deletions
-- included. That is what stops half-finished edits appearing.
-- ---------------------------------------------------------------------
create type public.site_cms_content_state as enum ('draft', 'published');

-- ---------------------------------------------------------------------
-- Pages
--
-- `slug` is the real route, stored exactly as it appears in the URL,
-- with leading and trailing slashes (e.g. '/', '/about/',
-- '/bpc-157-costa-rica/'). Matching the live WordPress paths character
-- for character is what preserves the site's SEO.
--
-- Spanish is NOT a separate page row. One row serves both languages;
-- the _en/_es fields inside the content JSON supply the translations,
-- and the site renders the same row at '/about/' and '/es/about/'.
-- ---------------------------------------------------------------------
create table public.site_cms_pages (
  slug          text primary key,
  name          text not null,               -- admin-facing label
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint site_cms_pages_slug_format
    check (slug = '/' or (slug like '/%' and slug like '%/'))
);

comment on table  public.site_cms_pages is 'One row per marketing route. Slug must match the live URL exactly.';
comment on column public.site_cms_pages.slug is 'Real URL path with leading and trailing slash. Changing this breaks SEO.';

-- ---------------------------------------------------------------------
-- Section type registry
--
-- Each type maps to exactly one React component in the website repo.
-- `field_schema` describes the editable fields so the admin can build
-- its form without hardcoding a layout per type. Adding a new type is
-- the only change that needs a code deploy.
-- ---------------------------------------------------------------------
create table public.site_cms_section_types (
  type          text primary key,
  name          text not null,
  description   text,
  field_schema  jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true
);

comment on table public.site_cms_section_types is 'Registry of renderable section types. One type = one React component.';

-- ---------------------------------------------------------------------
-- Page sections
--
-- The ordered list of blocks that makes up a page.
--
-- All user-visible text lives in `content`, with _en / _es variants for
-- every string. Image URLs point at Supabase Storage. No copy, image or
-- link is hardcoded in the website repo.
-- ---------------------------------------------------------------------
create table public.site_cms_page_sections (
  id            uuid primary key default gen_random_uuid(),
  page_slug     text not null references public.site_cms_pages(slug) on delete cascade,
  state         public.site_cms_content_state not null default 'draft',
  section_type  text not null references public.site_cms_section_types(type),
  sort_order    integer not null default 0,
  is_visible    boolean not null default true,
  content       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index site_cms_page_sections_render_idx
  on public.site_cms_page_sections (page_slug, state, sort_order)
  where is_visible;

comment on column public.site_cms_page_sections.content is
  'All copy, image URLs and links. Every text key has _en and _es variants.';

-- ---------------------------------------------------------------------
-- Per-page SEO
--
-- One row per page per state. `noindex` stays true site-wide until
-- launch day; see the launch checklist in README.md.
-- ---------------------------------------------------------------------
create table public.site_cms_page_seo (
  page_slug        text not null references public.site_cms_pages(slug) on delete cascade,
  state            public.site_cms_content_state not null default 'draft',
  title_en         text,
  title_es         text,
  description_en   text,
  description_es   text,
  og_image_url     text,
  canonical_url    text,
  noindex          boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (page_slug, state)
);

-- ---------------------------------------------------------------------
-- Global settings — header, footer, nav, contact details, disclaimer
--
-- Keyed JSON rather than more tables. Navigation is a tree, and storing
-- a tree as rows means every draft row needs a second parent_id for its
-- published twin, which gets messy fast. A JSON document per key
-- publishes atomically and keeps the admin form simple.
--
-- Expected keys:
--   'announcement'  free-shipping bar
--   'contact'       phones, email, WhatsApp, location
--   'nav.header'    header menu tree
--   'nav.footer'    footer link columns
--   'disclaimer'    the legal notice required on every page
--   'social'        social profile URLs
-- ---------------------------------------------------------------------
create table public.site_cms_settings (
  key         text not null,
  state       public.site_cms_content_state not null default 'draft',
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (key, state)
);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.site_cms_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger site_cms_pages_touch
  before update on public.site_cms_pages
  for each row execute function public.site_cms_touch_updated_at();

create trigger site_cms_page_sections_touch
  before update on public.site_cms_page_sections
  for each row execute function public.site_cms_touch_updated_at();

create trigger site_cms_page_seo_touch
  before update on public.site_cms_page_seo
  for each row execute function public.site_cms_touch_updated_at();

create trigger site_cms_settings_touch
  before update on public.site_cms_settings
  for each row execute function public.site_cms_touch_updated_at();

-- ---------------------------------------------------------------------
-- Publish / revert
--
-- publish_page copies a page's draft rows over its published rows in one
-- transaction. Called by the ADMIN (service role), never by this site.
--
-- SECURITY INVOKER is deliberate: these must not be callable by anon.
-- The grants at the bottom of this file only expose them to the admin.
-- ---------------------------------------------------------------------
create or replace function public.site_cms_publish_page(p_slug text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.site_cms_page_sections
   where page_slug = p_slug and state = 'published';

  insert into public.site_cms_page_sections
    (page_slug, state, section_type, sort_order, is_visible, content)
  select page_slug, 'published', section_type, sort_order, is_visible, content
    from public.site_cms_page_sections
   where page_slug = p_slug and state = 'draft';

  delete from public.site_cms_page_seo
   where page_slug = p_slug and state = 'published';

  insert into public.site_cms_page_seo
    (page_slug, state, title_en, title_es, description_en, description_es,
     og_image_url, canonical_url, noindex)
  select page_slug, 'published', title_en, title_es, description_en, description_es,
         og_image_url, canonical_url, noindex
    from public.site_cms_page_seo
   where page_slug = p_slug and state = 'draft';
end;
$$;

-- Pull published back into draft, to discard in-progress edits.
create or replace function public.site_cms_revert_page(p_slug text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.site_cms_page_sections
   where page_slug = p_slug and state = 'draft';

  insert into public.site_cms_page_sections
    (page_slug, state, section_type, sort_order, is_visible, content)
  select page_slug, 'draft', section_type, sort_order, is_visible, content
    from public.site_cms_page_sections
   where page_slug = p_slug and state = 'published';
end;
$$;

create or replace function public.site_cms_publish_settings(p_key text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.site_cms_settings (key, state, value)
  select key, 'published', value
    from public.site_cms_settings
   where key = p_key and state = 'draft'
  on conflict (key, state) do update set value = excluded.value;
end;
$$;

-- =====================================================================
-- Row Level Security
--
-- This website connects with the ANON key and must be able to read
-- published content and nothing else. Draft content must be invisible to
-- it — not merely filtered in application code, but unreadable.
--
-- The admin uses the service role, which bypasses RLS entirely, so no
-- write policies are defined here.
-- =====================================================================
alter table public.site_cms_pages          enable row level security;
alter table public.site_cms_section_types  enable row level security;
alter table public.site_cms_page_sections  enable row level security;
alter table public.site_cms_page_seo       enable row level security;
alter table public.site_cms_settings       enable row level security;

create policy site_cms_pages_anon_read
  on public.site_cms_pages for select to anon
  using (is_active);

create policy site_cms_section_types_anon_read
  on public.site_cms_section_types for select to anon
  using (is_active);

create policy site_cms_page_sections_anon_read
  on public.site_cms_page_sections for select to anon
  using (state = 'published');

create policy site_cms_page_seo_anon_read
  on public.site_cms_page_seo for select to anon
  using (state = 'published');

create policy site_cms_settings_anon_read
  on public.site_cms_settings for select to anon
  using (state = 'published');

-- Read-only, published-only. No insert/update/delete grants for anon.
grant select on public.site_cms_pages         to anon;
grant select on public.site_cms_section_types to anon;
grant select on public.site_cms_page_sections to anon;
grant select on public.site_cms_page_seo      to anon;
grant select on public.site_cms_settings      to anon;

revoke execute on function public.site_cms_publish_page(text)     from anon, public;
revoke execute on function public.site_cms_revert_page(text)      from anon, public;
revoke execute on function public.site_cms_publish_settings(text) from anon, public;

-- =====================================================================
-- Seed: section type registry
--
-- These 14 types cover all 19 blocks on the current home page — several
-- blocks reuse the same type with different content, which is why the
-- count is lower. Derived from the live site on 2026-07-26.
-- =====================================================================
insert into public.site_cms_section_types (type, name, description, field_schema) values
  ('hero', 'Hero',
   'Page-top heading, intro, trust chips and primary CTA.',
   '{"fields":["eyebrow","title","intro","body","chips[]","cta_label","cta_href","image_url"]}'),

  ('press_band', 'Press band',
   'Thin "AS SEEN IN" strip with outlet name and article link.',
   '{"fields":["eyebrow","outlet","text","cta_label","cta_href"]}'),

  ('feature_cards', 'Feature cards',
   'Grid of icon + title + body cards. Used by "We do things differently", "What We Offer", "Who This Is For" and "Why Choose Us".',
   '{"fields":["eyebrow","title","intro","columns","cards[]:{icon,title,body}","cta_label","cta_href"]}'),

  ('category_chips', 'Category chips',
   'Row of pill links to category pages.',
   '{"fields":["title","categories[]:{label,href}"]}'),

  ('product_grid', 'Product grid',
   'Grid of products. References existing product rows by id — copy and prices are NOT duplicated here.',
   '{"fields":["title","product_refs[]","columns","show_price","show_cta"]}'),

  ('transformation', 'Customer transformation',
   'Before/after block with privacy disclaimers.',
   '{"fields":["eyebrow","title","body","image_url","disclaimers[]","cta_label","cta_href"]}'),

  ('promo_banner', 'Promo banner',
   'Full-width coloured band. Used by the bulk-offer strip.',
   '{"fields":["eyebrow","title","body","cta_label","cta_href","background"]}'),

  ('info_duo', 'Two info panels',
   'Side-by-side panels. Used by "Laboratory-Tested Purity" and "Research-Grade Peptides".',
   '{"fields":["panels[]:{title,body,cta_label,cta_href}"]}'),

  ('text_cta', 'Centred text + CTA',
   'Heading, paragraph and a button. Used by "Your Trusted Peptide Supplier".',
   '{"fields":["eyebrow","title","body","cta_label","cta_href"]}'),

  ('call_to_order_cards', 'Call-to-order cards',
   'Featured product cards with badge, price and bullet benefits.',
   '{"fields":["badge","cta_label","cards[]:{name,price,benefits[],href}"]}'),

  ('testimonials', 'Testimonials',
   'Customer quotes.',
   '{"fields":["eyebrow","title","body","items[]:{quote,author,location,rating}"]}'),

  ('faq_accordion', 'FAQ accordion',
   'Expandable question and answer list.',
   '{"fields":["eyebrow","title","intro","items[]:{question,answer}"]}'),

  ('bulk_program', 'Bulk savings program',
   'Bulk discount summary with note and CTA.',
   '{"fields":["title","subtitle","note","cta_label","cta_href"]}'),

  ('rich_text', 'Rich text',
   'Free-form formatted content, for long-form pages such as About and Our Story.',
   '{"fields":["title","body_html"]}');

-- =====================================================================
-- Seed: page rows
--
-- Slugs match the live site exactly. See docs/url-inventory.md for the
-- full harvested list, including the /product/* namespace still pending
-- a decision.
-- =====================================================================
insert into public.site_cms_pages (slug, name) values
  ('/',                             'Home'),
  ('/about/',                       'About'),
  ('/our-story/',                   'Our Story'),
  ('/bulk-discounts/',              'Bulk Discounts'),
  ('/lab-tests-coa-results/',       'COA Database'),
  ('/affiliate-program/',           'Affiliate Program'),
  ('/faq-costa-rica/',              'FAQ'),
  ('/contact-costa-rica/',          'Contact'),
  ('/info-center/',                 'Info Center'),
  ('/peptide-guides/',              'How-to-Use Guides'),
  ('/customer-feedback/',           'Customer Feedback'),
  ('/our-service-locations/',       'Service Locations'),
  ('/all-peptide-products-costa-rica/', 'All Products'),
  ('/privacy-policy/',              'Privacy Policy'),
  ('/shipping-policy/',             'Shipping Policy'),
  ('/return-refund-policy/',        'Returns & Refunds'),
  ('/html-sitemap/',                'HTML Sitemap');

-- =====================================================================
-- Storage
--
-- Content images live in a public bucket and are referenced by URL from
-- section JSON. Never commit content images to the website repo.
-- Writes are admin-only; no anon insert policy is created.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('site-content', 'site-content', true)
on conflict (id) do nothing;

create policy site_cms_content_anon_read
  on storage.objects for select to anon
  using (bucket_id = 'site-content');
