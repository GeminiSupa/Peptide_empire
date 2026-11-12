-- Run in Supabase SQL Editor before deploying the CMS editor.
-- The public website reads these optional fields from the same blogs table.
ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS slug_es TEXT,
  ADD COLUMN IF NOT EXISTS seo_title_en TEXT,
  ADD COLUMN IF NOT EXISTS seo_title_es TEXT,
  ADD COLUMN IF NOT EXISTS seo_description_en TEXT,
  ADD COLUMN IF NOT EXISTS seo_description_es TEXT,
  ADD COLUMN IF NOT EXISTS focus_keyword_en TEXT,
  ADD COLUMN IF NOT EXISTS focus_keyword_es TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_en TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_es TEXT,
  ADD COLUMN IF NOT EXISTS author_name TEXT DEFAULT 'Peptides Costa Rica',
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Research journal',
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS faq_en JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faq_es JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE public.blogs
SET slug_es = COALESCE(NULLIF(slug_es, ''), slug),
    published_at = CASE WHEN published THEN COALESCE(published_at, created_at) ELSE published_at END
WHERE slug_es IS NULL OR slug_es = '' OR (published AND published_at IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS blogs_slug_es_unique
  ON public.blogs (slug_es)
  WHERE slug_es IS NOT NULL AND slug_es <> '';
