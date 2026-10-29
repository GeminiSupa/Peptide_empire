-- Business account comments (Oct 28 2026). Run in the Supabase SQL editor
-- BEFORE deploying the code that uses it. Additive and safe to rerun.
--
-- 1. Each business has a language for its emails and account pages. Staff
--    choose it in the admin, and the business can change it on its dashboard.
-- 2. Business emails can carry a branded HTML version next to the plain text.
-- 3. Customers can leave a WhatsApp number on the "You" page.

ALTER TABLE public.business_accounts
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'es';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_accounts_preferred_language_check') THEN
    ALTER TABLE public.business_accounts
      ADD CONSTRAINT business_accounts_preferred_language_check CHECK (preferred_language IN ('es', 'en'));
  END IF;
END $$;

ALTER TABLE public.business_email_outbox
  ADD COLUMN IF NOT EXISTS html text;

-- Same body as business-accounts-suite.sql; recreated so RETURNING * carries
-- the new html column.
CREATE OR REPLACE FUNCTION public.claim_business_email(mail_id uuid)
RETURNS SETOF public.business_email_outbox LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.business_email_outbox SET status='sending',attempts=attempts+1,updated_at=now()
  WHERE id=mail_id AND (status IN ('pending','failed') OR (status='sending' AND updated_at < now()-interval '5 minutes'))
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_business_email(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_business_email(uuid) TO service_role;

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

NOTIFY pgrst, 'reload schema';
