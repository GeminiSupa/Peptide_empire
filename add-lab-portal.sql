-- =========================================================================
--            LAB PARTNER PORTAL: LAB LOGINS, BATCH ASSIGNMENT, COA REVIEW
-- =========================================================================
-- Run this in the Supabase SQL Editor BEFORE deploying the code that needs it,
-- and AFTER lock-empire-rls.sql. Safe to run more than once.
--
-- What it does, in plain terms:
--   1. Lets an admin_profiles row be a 'lab': an outside testing lab with a
--      login, which is not on the team and never a superadmin.
--   2. Adds lab_partners (one row per lab) and a lab_partner_id on each batch,
--      so a lab only ever sees the batches the owner assigned to it.
--   3. Adds lab_coa_submissions: every certificate a lab uploads waits here,
--      pending, until a staff member approves or rejects it. Only an approved
--      one is copied to the public COA link the batch QR sticker opens.
--   4. Creates the PRIVATE storage bucket lab uploads land in. A pending or
--      rejected certificate is never reachable by URL.
--
-- Nothing here changes an existing row. Every current profile keeps its tier.
--
-- SECURITY: lock-empire-rls.sql's empire_is_staff() only counts tiers staff
-- and sub_user, so a lab login gets NO direct table access. Every lab read and
-- write goes through the server (/api/lab/*), which works out the lab from the
-- signed-in user and never from the request. The two new tables below are
-- revoked from the browser keys entirely, the same as affiliate_change_requests.

-- -------------------------------------------------------------------------
-- 0. Refuse to run before lock-empire-rls.sql
-- -------------------------------------------------------------------------
-- Under the old admin-rls.sql, ANY login could read and write every table
-- straight through the REST API. Handing an outside lab a login on that
-- database would hand it everything, so this file stops here until the lock is
-- in place.
DO $$
BEGIN
  IF to_regprocedure('public.empire_is_staff()') IS NULL THEN
    RAISE EXCEPTION 'Run lock-empire-rls.sql first: empire_is_staff() is missing, so any login could still read every table.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND policyname = 'staff full access'
  ) THEN
    RAISE EXCEPTION 'Run lock-empire-rls.sql first: the old "staff full access" (any login) policy is still on some tables.';
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 1. The lab tier
-- -------------------------------------------------------------------------
ALTER TABLE public.admin_profiles DROP CONSTRAINT IF EXISTS admin_profiles_tier_check;
ALTER TABLE public.admin_profiles
  ADD CONSTRAINT admin_profiles_tier_check
  CHECK (tier IN ('staff', 'sub_user', 'affiliate', 'lab'));

-- A lab has no parent, like staff and affiliates. Only a sub-user has one.
ALTER TABLE public.admin_profiles DROP CONSTRAINT IF EXISTS sub_user_has_parent;
ALTER TABLE public.admin_profiles
  ADD CONSTRAINT sub_user_has_parent CHECK (
    (tier = 'sub_user' AND parent_agent_id IS NOT NULL)
    OR
    (tier IN ('staff', 'affiliate', 'lab') AND parent_agent_id IS NULL)
  );

-- A lab is never a superadmin: that single flag would hand an outside lab the
-- whole back office and every RLS policy at once.
ALTER TABLE public.admin_profiles DROP CONSTRAINT IF EXISTS lab_never_superadmin;
ALTER TABLE public.admin_profiles
  ADD CONSTRAINT lab_never_superadmin CHECK (
    NOT (tier = 'lab' AND is_superadmin = true)
  );

-- -------------------------------------------------------------------------
-- 2. Labs, and which batches each one tests
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  -- The login. One login per lab, one lab per login.
  admin_profile_user_id UUID UNIQUE,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.product_batches
  ADD COLUMN IF NOT EXISTS lab_partner_id UUID REFERENCES public.lab_partners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_product_batches_lab_partner
  ON public.product_batches (lab_partner_id) WHERE lab_partner_id IS NOT NULL;

-- What the approved certificate says, kept on the batch next to its public link.
ALTER TABLE public.product_batches ADD COLUMN IF NOT EXISTS coa_purity_percent NUMERIC(6,3);
ALTER TABLE public.product_batches ADD COLUMN IF NOT EXISTS coa_test_date DATE;
ALTER TABLE public.product_batches ADD COLUMN IF NOT EXISTS coa_submission_id UUID;

-- -------------------------------------------------------------------------
-- 3. Lab uploads waiting on staff
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_coa_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE CASCADE,
  lab_partner_id UUID NOT NULL REFERENCES public.lab_partners(id) ON DELETE CASCADE,
  -- Path inside the private lab-coa-submissions bucket. Never a public URL.
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  purity_percent NUMERIC(6,3) NOT NULL CHECK (purity_percent >= 0 AND purity_percent <= 100),
  test_date DATE NOT NULL,
  lab_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by_user_id UUID,
  submitted_by_email TEXT,
  reviewed_by_email TEXT,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  -- Set on approval: the public copy the batch QR opens.
  published_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One certificate waiting per batch, so staff never approve two versions of
-- the same test and wonder which one the QR shows.
CREATE UNIQUE INDEX IF NOT EXISTS lab_coa_submissions_one_pending
  ON public.lab_coa_submissions (batch_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS lab_coa_submissions_status_idx
  ON public.lab_coa_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS lab_coa_submissions_lab_idx
  ON public.lab_coa_submissions (lab_partner_id, created_at DESC);

-- Read and written only by the server. No browser access at all: the people
-- these tables are about have logins.
ALTER TABLE public.lab_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_coa_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lab_partners FROM anon, authenticated;
REVOKE ALL ON TABLE public.lab_coa_submissions FROM anon, authenticated;

-- -------------------------------------------------------------------------
-- 4. The private bucket lab uploads land in
-- -------------------------------------------------------------------------
-- public = false: an object here has no public URL. Staff open it through a
-- short-lived signed link from the server. No storage.objects policy is added,
-- so neither the public key nor any login can list, read or write it directly.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lab-coa-submissions', 'lab-coa-submissions', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

NOTIFY pgrst, 'reload schema';

-- -------------------------------------------------------------------------
-- 5. Check it landed
-- -------------------------------------------------------------------------
--   SELECT tier, count(*) FROM public.admin_profiles GROUP BY 1;
--   SELECT id, public FROM storage.buckets WHERE id = 'lab-coa-submissions';  -- public must be false
--   SELECT count(*) FROM public.lab_coa_submissions;
--   -- Expect ZERO rows (no browser key may touch the lab tables):
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND table_name IN ('lab_partners', 'lab_coa_submissions')
--      AND grantee IN ('anon', 'authenticated');
