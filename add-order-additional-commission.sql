-- An extra team-member commission is independent of orders.sales_agent.
BEGIN;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS additional_commission_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS additional_commission_pct numeric(5,2) CHECK (additional_commission_pct > 0 AND additional_commission_pct <= 100),
  ADD COLUMN IF NOT EXISTS additional_commission_reason text,
  ADD COLUMN IF NOT EXISTS additional_commission_assigned_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_additional_commission_recipient_idx
ON public.orders(additional_commission_user_id) WHERE additional_commission_user_id IS NOT NULL;
-- No customer grants or policies are added. Only the authenticated superadmin
-- order endpoint accepts these fields; public checkout discards them.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_additional_commission_complete') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_additional_commission_complete CHECK (
      (additional_commission_user_id IS NULL AND additional_commission_pct IS NULL AND additional_commission_reason IS NULL AND additional_commission_assigned_at IS NULL)
      OR (additional_commission_user_id IS NOT NULL AND additional_commission_pct IS NOT NULL AND additional_commission_reason IS NOT NULL AND additional_commission_pct > 0 AND additional_commission_pct <= 100 AND length(trim(additional_commission_reason)) BETWEEN 5 AND 500 AND additional_commission_assigned_at IS NOT NULL)
    );
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.guard_additional_order_commission()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE changed boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    changed := NEW.additional_commission_user_id IS NOT NULL OR NEW.additional_commission_pct IS NOT NULL OR NEW.additional_commission_reason IS NOT NULL OR NEW.additional_commission_assigned_at IS NOT NULL;
  ELSE
    changed := (NEW.additional_commission_user_id,NEW.additional_commission_pct,NEW.additional_commission_reason,NEW.additional_commission_assigned_at) IS DISTINCT FROM (OLD.additional_commission_user_id,OLD.additional_commission_pct,OLD.additional_commission_reason,OLD.additional_commission_assigned_at);
  END IF;
  IF changed AND current_user IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'Additional commissions must be changed through the authorized server endpoint';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS orders_guard_additional_commission ON public.orders;
CREATE TRIGGER orders_guard_additional_commission BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_additional_order_commission();
COMMIT;
