-- =========================================================================
-- LAB BATCHES, QR STICKERS & PACKING SCAN
-- Run in the Supabase SQL editor BEFORE the code that uses it deploys.
-- Adds columns only. Nothing is deleted or rewritten.
-- =========================================================================

-- 1. The batches table already exists (add-product-supplier-batch-forecasting.sql).
--    Repeated here so this file also works on a database that never ran that one.
CREATE TABLE IF NOT EXISTS public.product_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    supplier_name TEXT,
    vial_count INTEGER DEFAULT 0,
    unit_cost_usd NUMERIC DEFAULT 0,
    manufactured_date TIMESTAMPTZ,
    expiry_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. What a sticker carries. `code` is the short text inside the QR
--    (e.g. BPC10-2610-A). Once stickers are printed it must never change.
ALTER TABLE public.product_batches ADD COLUMN IF NOT EXISTS code TEXT;
-- 'batch' = a real production / supplier batch.
-- 'old_stock' = one per product, for vials already on the shelf with no batch.
ALTER TABLE public.product_batches ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'batch';
ALTER TABLE public.product_batches ADD COLUMN IF NOT EXISTS coa_url TEXT;
ALTER TABLE public.product_batches ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_batches_code
    ON public.product_batches (code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_batches_product_id
    ON public.product_batches (product_id);

-- 3. Batches are read and written only by the server (service role).
--    The old policies let ANY signed-in user - customer accounts included -
--    read and edit this table straight from the browser. Nothing in the app
--    uses that, and a batch now holds the lab report link customers will see.
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access to product_batches" ON public.product_batches;
DROP POLICY IF EXISTS "Allow authenticated write access to product_batches" ON public.product_batches;

-- 4. The packing record on each order: which sticker went into the box.
--    packed_items = [{ product, batch_code, batch_id, qty, method: 'scan' | 'manual' }]
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS packed_items JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS packed_by TEXT;

-- "Which orders got batch X" (the recall list) searches inside packed_items.
CREATE INDEX IF NOT EXISTS idx_orders_packed_items
    ON public.orders USING GIN (packed_items jsonb_path_ops);

NOTIFY pgrst, 'reload schema';
