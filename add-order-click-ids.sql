-- Keep the paid-ad click ids on the order: ?cid= and ?ttclid=.
--
-- A landing ref says which page won the click (add-order-landing-ref.sql).
-- These two say which click: ?cid= is the ad tracker's own click id and
-- ?ttclid= is TikTok's, both set on the landing URL, e.g.
--   ?ref=tiktok-glp1-a&cid=abc123&ttclid=E.C.P2_ABC
-- Checkout saves them on arrival and the order carries them here, so the
-- outbound "order paid" webhook can hand them back and the ad platform can
-- credit the exact click that produced the sale. The receiver refuses a sale
-- that arrives without a click id, so without this column no CR sale can be
-- attributed at all.
--
-- The insert writes both columns defensively (writeDroppingMissingColumns), so
-- checkout keeps working whether or not this file has been run. Running it just
-- means the click ids are stored instead of dropped and logged.
--
-- Run in the Supabase SQL Editor BEFORE deploying the code. Safe to re-run.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS landing_cid TEXT,
  ADD COLUMN IF NOT EXISTS landing_ttclid TEXT;

CREATE INDEX IF NOT EXISTS orders_landing_cid_idx
  ON public.orders (landing_cid, created_at DESC)
  WHERE landing_cid IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_landing_ttclid_idx
  ON public.orders (landing_ttclid, created_at DESC)
  WHERE landing_ttclid IS NOT NULL;

COMMENT ON COLUMN public.orders.landing_cid IS
  'The ?cid= click id from the paid-ad landing URL. Null for organic / direct orders.';
COMMENT ON COLUMN public.orders.landing_ttclid IS
  'The ?ttclid= TikTok click id from the paid-ad landing URL. Null for organic / direct orders.';

NOTIFY pgrst, 'reload schema';

-- Paid sales that carry a click id, once this has been collecting for a while:
--
--   SELECT landing_ref, landing_cid, landing_ttclid, order_number, total_usd
--   FROM public.orders
--   WHERE landing_cid IS NOT NULL OR landing_ttclid IS NOT NULL
--   ORDER BY created_at DESC;
