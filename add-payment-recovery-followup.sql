-- The 15-minute "your payment has not gone through" email.
-- Records when it was sent so each order gets it once.
-- Safe to run more than once. Until it is run, the job skips only this email;
-- the two-hour reminder keeps working.
alter table public.orders
  add column if not exists payment_recovery_followup_sent_at timestamptz;
