-- Fixed monthly pay for team accounts. Run once in Supabase SQL Editor.
-- Does not change any existing user's amount or create/pay any payouts.
BEGIN;
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS salary_frequency text NOT NULL DEFAULT 'weekly' CHECK (salary_frequency IN ('weekly','monthly'));
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS monthly_salary numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_salary BETWEEN 0 AND 1000000);
ALTER TABLE public.commission_payouts ADD COLUMN IF NOT EXISTS salary_frequency text NOT NULL DEFAULT 'weekly' CHECK (salary_frequency IN ('weekly','monthly'));
-- Rejected records remain visible; a replacement can be generated for that month.
CREATE UNIQUE INDEX IF NOT EXISTS commission_payouts_one_monthly_pay
  ON public.commission_payouts (agent_email, start_date, end_date)
  WHERE salary_frequency = 'monthly' AND status <> 'Rejected';
COMMIT;
NOTIFY pgrst, 'reload schema';
