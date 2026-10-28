-- Run after customer-accounts-foundation.sql. Additive and safe to rerun.
CREATE TABLE IF NOT EXISTS public.business_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  legal_name text NOT NULL,
  trading_name text NOT NULL DEFAULT '',
  corporation_number text NOT NULL UNIQUE CHECK (corporation_number ~ '^[0-9]{10}$'),
  contact_name text NOT NULL,
  phone text NOT NULL,
  billing_address text NOT NULL,
  delivery_address text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
  discount_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_accounts FROM anon, authenticated;
-- All changes and reads go through authenticated server endpoints. Customers
-- cannot alter approval, the login email or negotiated pricing through RLS.
GRANT ALL ON public.business_accounts TO service_role;
DROP TRIGGER IF EXISTS business_accounts_touch_updated_at ON public.business_accounts;
CREATE TRIGGER business_accounts_touch_updated_at BEFORE UPDATE ON public.business_accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_customer_account_updated_at();
