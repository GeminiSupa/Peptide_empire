-- Analytics snapshots and reliable paid-WhatsApp conversion queue.
-- Run in Supabase SQL Editor before enabling the Google Ads import.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ad_attribution jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS analytics_snapshot jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ads_paid_at timestamptz;
CREATE TABLE IF NOT EXISTS public.google_ads_conversion_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  paid_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','submitted','accepted','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  request_id text,
  destination text,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  submitted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_ads_conversion_exports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_ads_conversion_exports FROM anon, authenticated;
GRANT ALL ON public.google_ads_conversion_exports TO service_role;
CREATE INDEX IF NOT EXISTS google_ads_exports_due ON public.google_ads_conversion_exports(status,next_attempt_at);
-- Use AFTER for inserts because the queue references the persisted order.
CREATE OR REPLACE FUNCTION public.enqueue_paid_whatsapp_conversion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.ads_paid_at IS NOT NULL AND lower(coalesce(NEW.payment_method,'')) = 'whatsapp'
    AND lower(trim(coalesce(NEW.status,''))) IN ('paid','order complete','completed','complete','shipped','delivered') THEN
    IF TG_OP = 'INSERT' OR OLD.ads_paid_at IS NULL THEN
      INSERT INTO public.google_ads_conversion_exports(order_id,paid_at) VALUES(NEW.id,NEW.ads_paid_at) ON CONFLICT(order_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
-- The BEFORE trigger stamps only; enqueue AFTER satisfies the foreign key.
CREATE OR REPLACE FUNCTION public.stamp_ads_paid_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.ads_paid_at IS NOT NULL THEN NEW.ads_paid_at := OLD.ads_paid_at;
  ELSIF lower(trim(coalesce(NEW.status,''))) IN ('paid','order complete','completed','complete','shipped','delivered') THEN
    IF TG_OP = 'INSERT' THEN NEW.ads_paid_at := now();
    ELSIF lower(trim(coalesce(OLD.status,''))) NOT IN ('paid','order complete','completed','complete','shipped','delivered') THEN NEW.ads_paid_at := now();
    ELSE NEW.ads_paid_at := NULL; -- Legacy paid rows have no known payment time; never invent one.
    END IF;
  ELSE NEW.ads_paid_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_stamp_ads_paid_at ON public.orders;
CREATE TRIGGER orders_stamp_ads_paid_at BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.stamp_ads_paid_at();
DROP TRIGGER IF EXISTS orders_queue_google_conversion ON public.orders;
CREATE TRIGGER orders_queue_google_conversion AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.enqueue_paid_whatsapp_conversion();
CREATE OR REPLACE FUNCTION public.claim_google_ads_exports(batch_size integer DEFAULT 20)
RETURNS SETOF public.google_ads_conversion_exports LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.google_ads_conversion_exports q SET status='leased', lease_until=now()+interval '10 minutes', attempts=attempts+1
  WHERE q.id IN (SELECT id FROM public.google_ads_conversion_exports
    WHERE ((status IN ('pending','failed') AND next_attempt_at<=now()) OR (status='leased' AND lease_until<now()))
      AND attempts<20 ORDER BY paid_at LIMIT least(greatest(batch_size,1),50) FOR UPDATE SKIP LOCKED)
  RETURNING q.*;
$$;
REVOKE ALL ON FUNCTION public.claim_google_ads_exports(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_google_ads_exports(integer) TO service_role;
COMMIT;
NOTIFY pgrst,'reload schema';
