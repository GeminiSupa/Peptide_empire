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

CREATE TABLE IF NOT EXISTS public.business_account_intelligence (
  business_id uuid PRIMARY KEY REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  lifecycle_stage text NOT NULL DEFAULT '' CHECK (lifecycle_stage IN ('', 'prospect', 'onboarding', 'active', 'growth', 'at_risk', 'dormant')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  tags text[] NOT NULL DEFAULT '{}',
  internal_note text NOT NULL DEFAULT '' CHECK (length(internal_note) <= 4000),
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  last_contacted_channel text NOT NULL DEFAULT '' CHECK (last_contacted_channel IN ('', 'email', 'whatsapp', 'phone')),
  updated_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_intelligence_follow_up_idx
  ON public.business_account_intelligence (next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.business_contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  actor_email text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'phone')),
  recipient text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_contact_business_time_idx
  ON public.business_contact_events (business_id, occurred_at DESC);

ALTER TABLE public.business_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_account_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_contact_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_activity_events, public.business_account_intelligence, public.business_contact_events FROM anon, authenticated;
GRANT ALL ON public.business_activity_events, public.business_account_intelligence, public.business_contact_events TO service_role;

-- Realtime makes the event/CRM tables ready for future direct subscriptions.
-- The dashboard also polls every 30 seconds, so it stays live even when the
-- publication is disabled or a browser temporarily loses its socket.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'business_activity_events') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.business_activity_events;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'business_account_intelligence') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.business_account_intelligence;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'business_contact_events') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.business_contact_events;
    END IF;
  END IF;
END $$;

COMMIT;
