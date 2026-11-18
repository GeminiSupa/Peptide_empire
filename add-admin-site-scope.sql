-- Country access for staff in the multi-country admin.
--
-- `allowed_sites` lists the country codes (sites.id: 'co','mx','ar','ca') a
-- staff member may work in. A superadmin ignores it and sees every country.
-- NULL or an empty array means "no country chosen yet" for ordinary staff:
-- they are shown nothing until a superadmin grants at least one country, which
-- keeps a new hire from seeing another country's orders by default.
--
-- The active country a person is currently viewing is NOT stored here; it is a
-- per-session choice (the `pe_admin_site` cookie the country switcher sets),
-- always validated against this list on the server.
--
-- Run in the Supabase SQL editor before deploying the country switcher.

ALTER TABLE admin_profiles
  ADD COLUMN IF NOT EXISTS allowed_sites text[];

-- The existing super admin already sees everything via is_superadmin, so no
-- backfill is required. Grant ordinary staff their countries from Team
-- Management (or here, e.g.):
--   UPDATE admin_profiles SET allowed_sites = ARRAY['mx'] WHERE email = 'someone@example.com';

COMMENT ON COLUMN admin_profiles.allowed_sites IS
  'Country codes (sites.id) this staff member may work in; superadmin ignores it and sees all.';
