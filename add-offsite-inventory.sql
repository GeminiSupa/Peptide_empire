-- Second stock pile: vials stored off site with the packing ops person.
--
-- products.inventory_count stays "everything we own".
-- products.offsite_inventory_count is the subset sitting with him.
-- On-site (with us) = inventory_count - offsite_inventory_count.
--
-- Hand vials to him → raise offsite (total unchanged).
-- An order is packed/paid → both total and offsite fall.
--
-- Run in the Supabase SQL editor before relying on the Off-site stock tab.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS offsite_inventory_count INTEGER DEFAULT 0;

COMMENT ON COLUMN public.products.offsite_inventory_count IS
  'Vials currently held off site for packing. Subset of inventory_count; never raised above total.';

-- Existing rows: treat missing as zero so the tab and order deductions have a number.
UPDATE public.products
SET offsite_inventory_count = 0
WHERE offsite_inventory_count IS NULL;
