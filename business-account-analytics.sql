-- First-party product analytics for the business-account workspace.
-- Run after business-accounts-suite.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS public.business_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  member_email text NOT NULL CHECK (member_email = lower(trim(member_email))),
  event_type text NOT NULL CHECK (event_type ~ '^[a-z0-9_]{2,60}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_activity_business_time_idx
  ON public.business_activity_events (business_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS business_activity_type_time_idx
  ON public.business_activity_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS business_activity_member_time_idx
  ON public.business_activity_events (member_email, occurred_at DESC);

ALTER TABLE public.business_activity_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_activity_events FROM anon, authenticated;
GRANT ALL ON public.business_activity_events TO service_role;

COMMIT;
