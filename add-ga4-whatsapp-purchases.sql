-- GA4 purchase for paid WhatsApp orders (server-side, Measurement Protocol).
-- Run in the Supabase SQL Editor BEFORE turning on GA4_OFFLINE_ENABLED.
-- Needs add-google-ads-conversions.sql (already applied): it stamps
-- orders.ads_paid_at, the moment an order first becomes paid.
--
--   orders.ga_client_id / ga_session_id  the shopper's GA4 cookie IDs, saved at
--                                        checkout so the sale joins their visit
--   ga4_purchase_exports                 one row per order the sender has
--                                        handled, so nothing is sent twice
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ga_client_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ga_session_id text;
CREATE TABLE IF NOT EXISTS public.ga4_purchase_exports (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('sent','skipped','failed')),
  attempts integer NOT NULL DEFAULT 0,
  client_id_source text CHECK (client_id_source IN ('browser','synthetic')),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ga4_purchase_exports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ga4_purchase_exports FROM anon, authenticated;
GRANT ALL ON public.ga4_purchase_exports TO service_role;
COMMIT;
NOTIFY pgrst,'reload schema';
