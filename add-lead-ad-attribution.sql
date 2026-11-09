-- Keep the Google ad click (gclid / gbraid / wbraid) on the lead.
-- Ad visitors fill in the /lp or /glp-1 form and staff create their order in
-- the CRM later, so the order never had the click. /api/leads/contact now
-- saves it here, and the Google Ads upload copies it onto the order.
-- Run in the Supabase SQL Editor. Safe to run twice. Until it is run, leads
-- save exactly as before (the column is dropped from the write) and uploads
-- keep matching on email/phone only.
ALTER TABLE public.catalog_leads ADD COLUMN IF NOT EXISTS ad_attribution jsonb;
NOTIFY pgrst, 'reload schema';
