-- One-time extra commission on a business account's next order.
-- Run in the Supabase SQL editor BEFORE deploying the code that uses it.
-- Additive and safe to rerun. Needs add-order-additional-commission.sql
-- (already applied) because the extra is stored on the order through the same
-- additional_commission_* columns.
--
--   first_order_extra_user_id      who earns the extra (a team member)
--   first_order_extra_pct          the percent of that order's net sales
--   first_order_extra_used_at      set the moment an order takes it; the setting
--                                  is then spent and never applies again
--   first_order_extra_order_number the order that took it
--
-- business_accounts already blocks all anon/authenticated access (see
-- business-accounts.sql), so customers cannot read or change these.
ALTER TABLE public.business_accounts
  ADD COLUMN IF NOT EXISTS first_order_extra_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_order_extra_pct numeric(5,2)
    CHECK (first_order_extra_pct IS NULL OR (first_order_extra_pct > 0 AND first_order_extra_pct <= 100)),
  ADD COLUMN IF NOT EXISTS first_order_extra_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_order_extra_order_number text;
