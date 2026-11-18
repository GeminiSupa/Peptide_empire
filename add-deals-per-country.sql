-- Deals, blogs and ad spend belong to one country in the multi-country admin.
--
-- The storefront deals (weekly deal + flash sales) are per country: a flash
-- sale launched for Mexico must not change Colombia's prices. The "only one
-- live deal per kind" rule therefore has to be one live deal per kind PER
-- COUNTRY, not one across the whole business -- otherwise Mexico launching a
-- weekly deal would block Colombia from having one.
--
-- Run in the Supabase SQL editor before deploying per-country deals.

BEGIN;

-- Replace the global "one live deal per kind" index with a per-country one.
DROP INDEX IF EXISTS idx_deals_single_live_per_kind;
CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_single_live_per_kind_site
  ON public.deals(site_id, kind)
  WHERE status = 'live';

-- An older single-live index (pre-flash-sales) would also be global; drop it
-- if it is still around so it cannot block a second country's live deal.
DROP INDEX IF EXISTS idx_deals_single_live;

COMMIT;

-- PostgREST caches the schema; reload it so the change takes effect at once.
NOTIFY pgrst, 'reload schema';
