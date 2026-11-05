-- Preserve Google click attribution when a visitor leaves the site for WhatsApp.
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ad_attribution jsonb;

ALTER TABLE public.whatsapp_leads
  ADD COLUMN IF NOT EXISTS attribution_token text,
  ADD COLUMN IF NOT EXISTS ad_attribution jsonb,
  ADD COLUMN IF NOT EXISTS wa_id text,
  ADD COLUMN IF NOT EXISTS reference_received_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_leads_attribution_token_idx
  ON public.whatsapp_leads (attribution_token)
  WHERE attribution_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_leads_wa_id_attribution_idx
  ON public.whatsapp_leads (wa_id, reference_received_at DESC)
  WHERE ad_attribution IS NOT NULL;

CREATE OR REPLACE FUNCTION public.attach_whatsapp_google_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inherited_attribution jsonb;
  phone_digits text;
BEGIN
  IF NEW.ad_attribution IS NOT NULL THEN RETURN NEW; END IF;
  phone_digits := regexp_replace(coalesce(NEW.whatsapp_wa_id, NEW.customer_phone, ''), '\D', '', 'g');
  IF length(phone_digits) < 8 THEN RETURN NEW; END IF;

  SELECT lead.ad_attribution
    INTO inherited_attribution
    FROM public.whatsapp_leads lead
   WHERE lead.ad_attribution IS NOT NULL
     AND lead.reference_received_at >= now() - interval '90 days'
     AND right(regexp_replace(coalesce(lead.wa_id, ''), '\D', '', 'g'), 8) = right(phone_digits, 8)
   ORDER BY lead.reference_received_at DESC
   LIMIT 1;

  IF inherited_attribution IS NOT NULL THEN NEW.ad_attribution := inherited_attribution; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_attach_whatsapp_google_attribution ON public.orders;
CREATE TRIGGER orders_attach_whatsapp_google_attribution
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.attach_whatsapp_google_attribution();

COMMIT;
NOTIFY pgrst, 'reload schema';
