-- Run before configuring or enabling BAC payments.
-- Existing site_settings policies may permit all authenticated users to write.
-- Restrictive policies protect this one setting even when those policies exist.
BEGIN;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BAC settings server only" ON public.site_settings;
CREATE POLICY "BAC settings server only"
ON public.site_settings AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (id <> 'bac_payment_settings')
WITH CHECK (id <> 'bac_payment_settings');
COMMIT;
