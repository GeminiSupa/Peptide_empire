-- Keep the paid-ad landing page's ?ref= on the order.
--
-- Paid ads send traffic to dedicated landing pages, each carrying a ?ref=...
-- in its URL (e.g. ?ref=glptz_fb_oct). Checkout now reads that value and the
-- order carries it here, so a sale can be traced back to the landing page that
-- produced it.
--
-- The insert writes this column defensively (writeDroppingMissingColumns), so
-- checkout keeps working whether or not this file has been run. Running it just
-- means the ref is stored instead of dropped and logged. It is also the ref
-- carried on the "order became paid" outbound webhook.
--
-- Run in the Supabase SQL Editor BEFORE deploying the code. Safe to re-run.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS landing_ref TEXT;

CREATE INDEX IF NOT EXISTS orders_landing_ref_idx
  ON public.orders (landing_ref, created_at DESC)
  WHERE landing_ref IS NOT NULL;

COMMENT ON COLUMN public.orders.landing_ref IS
  'The ?ref= value from the paid-ad landing page this order came through. Null for organic / direct orders.';

NOTIFY pgrst, 'reload schema';

-- Sales by landing page, once this has been collecting for a while:
--
--   SELECT landing_ref, count(*) AS orders, sum(total_usd) AS usd
--   FROM public.orders
--   WHERE landing_ref IS NOT NULL
--   GROUP BY landing_ref
--   ORDER BY orders DESC;
