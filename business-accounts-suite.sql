-- Run after business-accounts.sql. All new data is accessed through verified
-- server endpoints; no public grants or broader order-ledger policies.
BEGIN;
ALTER TABLE public.business_accounts
  ADD COLUMN IF NOT EXISTS minimum_units integer NOT NULL DEFAULT 0 CHECK (minimum_units BETWEEN 0 AND 5000),
  ADD COLUMN IF NOT EXISTS minimum_order_usd numeric(12,2) NOT NULL DEFAULT 0 CHECK (minimum_order_usd >= 0),
  ADD COLUMN IF NOT EXISTS rep_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rep_commission_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (rep_commission_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE TABLE IF NOT EXISTS public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('owner','manager','buyer')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.business_members (business_id,email,role)
SELECT id,email,'owner' FROM public.business_accounts
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_business_owner_membership()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO public.business_members (business_id,email,role)
  VALUES (NEW.id,NEW.email,'owner');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS business_owner_membership ON public.business_accounts;
CREATE TRIGGER business_owner_membership AFTER INSERT ON public.business_accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_business_owner_membership();

CREATE TABLE IF NOT EXISTS public.business_product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  product text NOT NULL,
  unit_price_usd numeric(12,2) NOT NULL CHECK (unit_price_usd >= 0),
  UNIQUE (business_id,product)
);
CREATE TABLE IF NOT EXISTS public.business_saved_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  created_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id,name)
);
CREATE TABLE IF NOT EXISTS public.business_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  requested_by_email text NOT NULL,
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  customer_note text NOT NULL DEFAULT '',
  staff_note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','declined','cancelled')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.business_referral_codes (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{4,40}$'),
  label text NOT NULL,
  rep_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.business_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  event_key text NOT NULL UNIQUE,
  recipient text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.claim_business_email(mail_id uuid)
RETURNS SETOF public.business_email_outbox LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.business_email_outbox SET status='sending',attempts=attempts+1,updated_at=now()
  WHERE id=mail_id AND (status IN ('pending','failed') OR (status='sending' AND updated_at < now()-interval '5 minutes'))
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_business_email(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_business_email(uuid) TO service_role;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS business_account_id uuid REFERENCES public.business_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_quote_id uuid REFERENCES public.business_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_snapshot jsonb;
CREATE INDEX IF NOT EXISTS orders_business_created_idx ON public.orders(business_account_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS orders_business_quote_unique ON public.orders(business_quote_id) WHERE business_quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS business_quotes_business_idx ON public.business_quotes(business_id,created_at DESC);
CREATE INDEX IF NOT EXISTS business_lists_business_idx ON public.business_saved_lists(business_id,created_at DESC);

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['business_members','business_product_prices','business_saved_lists','business_quotes','business_referral_codes','business_email_outbox'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',table_name);
  END LOOP;
END $$;
COMMIT;
