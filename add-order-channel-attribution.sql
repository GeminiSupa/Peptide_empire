-- Revenue by channel: every order carries where it came from.
-- (Belhassen's brief, 9 Nov 2026 — Admin → Revenue by channel.)
--
-- What this adds:
--   1. On orders, leads and WhatsApp clicks: the visitor's first and last
--      touch (UTM tags, ad click ids, referrer, landing page), the channel each
--      one falls in, and how the source was captured.
--   2. ad_spend: the weekly ad spend typed in on the report, for ROAS.
--   3. A trigger that gives an order the source of the WhatsApp tap ("Ref:
--      PCR-…") or the lead form that brought that customer in, matched on the
--      last 8 phone digits within 90 days — so the orders staff create by hand
--      from a WhatsApp chat get the real source too.
--
-- Checkout, the lead forms and the WhatsApp button keep working before this is
-- run: the new columns are dropped from their writes (writeDroppingMissingColumns)
-- and the report shows every order as Unknown. Run it in the Supabase SQL
-- Editor BEFORE deploying the code. Safe to run twice.

BEGIN;

-- 1. Orders ---------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS visitor_id   text,
  ADD COLUMN IF NOT EXISTS first_touch  jsonb,
  ADD COLUMN IF NOT EXISTS last_touch   jsonb,
  ADD COLUMN IF NOT EXISTS ft_channel   text,
  ADD COLUMN IF NOT EXISTS lt_channel   text,
  ADD COLUMN IF NOT EXISTS captured_by  text,
  ADD COLUMN IF NOT EXISTS whatsapp_ref text,
  ADD COLUMN IF NOT EXISTS agent_source text,
  ADD COLUMN IF NOT EXISTS source_note  text;

COMMENT ON COLUMN public.orders.ft_channel IS
  'Channel of the visit that first brought this customer (google_ads, meta_ads, email, direct, …). See src/lib/channelAttribution.mjs.';
COMMENT ON COLUMN public.orders.lt_channel IS
  'Channel of the last non-direct visit before this order. The report''s default credit.';
COMMENT ON COLUMN public.orders.captured_by IS
  'How the source reached the order: website, whatsapp_ref, agent, partner_api.';
COMMENT ON COLUMN public.orders.agent_source IS
  'The channel staff picked on a hand-made order with no tracked source.';

CREATE INDEX IF NOT EXISTS orders_lt_channel_idx ON public.orders (lt_channel, created_at DESC);

-- 2. Leads (the /lp and /glp-1 forms, the API intake) -------------------------
ALTER TABLE public.catalog_leads
  ADD COLUMN IF NOT EXISTS visitor_id  text,
  ADD COLUMN IF NOT EXISTS first_touch jsonb,
  ADD COLUMN IF NOT EXISTS last_touch  jsonb,
  ADD COLUMN IF NOT EXISTS ft_channel  text,
  ADD COLUMN IF NOT EXISTS lt_channel  text,
  ADD COLUMN IF NOT EXISTS captured_by text;

-- 3. WhatsApp button taps ("Ref: PCR-…") ---------------------------------------
ALTER TABLE public.whatsapp_leads
  ADD COLUMN IF NOT EXISTS visitor_id  text,
  ADD COLUMN IF NOT EXISTS first_touch jsonb,
  ADD COLUMN IF NOT EXISTS last_touch  jsonb,
  ADD COLUMN IF NOT EXISTS ft_channel  text,
  ADD COLUMN IF NOT EXISTS lt_channel  text;

CREATE INDEX IF NOT EXISTS whatsapp_leads_wa_id_touch_idx
  ON public.whatsapp_leads (wa_id, reference_received_at DESC)
  WHERE lt_channel IS NOT NULL;

-- 4. Weekly ad spend, typed in on the report ------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_spend (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start  date NOT NULL,
  channel     text NOT NULL,
  amount_usd  numeric(12, 2) NOT NULL CHECK (amount_usd >= 0),
  entered_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start, channel)
);
-- Read and written only by the server with the service key.
ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;

-- 5. Copy the source onto the order -----------------------------------------
-- Only fills an order that has no tracked source (or only the one staff picked
-- by hand): a tap on the WhatsApp button or a lead form is better evidence.
CREATE OR REPLACE FUNCTION public.attach_order_channel_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  phone_tail text;
  tap record;
  lead record;
BEGIN
  IF NEW.lt_channel IS NOT NULL AND coalesce(NEW.captured_by, '') <> 'agent' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.lt_channel IS NOT NULL THEN RETURN NEW; END IF;

  phone_tail := right(regexp_replace(coalesce(NEW.whatsapp_wa_id, NEW.customer_phone, ''), '\D', '', 'g'), 8);
  IF length(phone_tail) < 8 THEN RETURN NEW; END IF;

  SELECT w.attribution_token, w.visitor_id, w.first_touch, w.last_touch, w.ft_channel, w.lt_channel
    INTO tap
    FROM public.whatsapp_leads w
   WHERE w.lt_channel IS NOT NULL
     AND w.reference_received_at >= now() - interval '90 days'
     AND right(regexp_replace(coalesce(w.wa_id, ''), '\D', '', 'g'), 8) = phone_tail
   ORDER BY w.reference_received_at DESC
   LIMIT 1;

  IF FOUND THEN
    NEW.visitor_id   := coalesce(NEW.visitor_id, tap.visitor_id);
    NEW.first_touch  := tap.first_touch;
    NEW.last_touch   := tap.last_touch;
    NEW.ft_channel   := tap.ft_channel;
    NEW.lt_channel   := tap.lt_channel;
    NEW.captured_by  := 'whatsapp_ref';
    NEW.whatsapp_ref := 'PCR-' || tap.attribution_token;
    RETURN NEW;
  END IF;

  SELECT l.visitor_id, l.first_touch, l.last_touch, l.ft_channel, l.lt_channel, l.captured_by
    INTO lead
    FROM public.catalog_leads l
   WHERE l.lt_channel IS NOT NULL
     AND l.created_at >= now() - interval '90 days'
     AND right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 8) = phone_tail
   ORDER BY coalesce(l.last_enquiry_at, l.created_at) DESC
   LIMIT 1;

  IF FOUND THEN
    NEW.visitor_id  := coalesce(NEW.visitor_id, lead.visitor_id);
    NEW.first_touch := lead.first_touch;
    NEW.last_touch  := lead.last_touch;
    NEW.ft_channel  := lead.ft_channel;
    NEW.lt_channel  := lead.lt_channel;
    NEW.captured_by := coalesce(lead.captured_by, 'website');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_attach_channel_attribution ON public.orders;
CREATE TRIGGER orders_attach_channel_attribution
  BEFORE INSERT OR UPDATE OF customer_phone, whatsapp_wa_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.attach_order_channel_attribution();

COMMIT;
NOTIFY pgrst, 'reload schema';

-- After a week of orders, how much is still Unknown:
--   SELECT coalesce(lt_channel, 'unknown') AS channel, count(*)
--   FROM public.orders WHERE created_at >= now() - interval '7 days'
--   GROUP BY 1 ORDER BY 2 DESC;
