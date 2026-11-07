-- Customer account workspace: searchable metrics and summary KPIs.
-- Run after customer-accounts-foundation.sql.
CREATE INDEX IF NOT EXISTS customer_profiles_created_user_idx ON public.customer_profiles (created_at DESC, user_id DESC);
CREATE INDEX IF NOT EXISTS customer_profiles_account_kind_idx ON public.customer_profiles (account_kind) WHERE account_kind IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_customer_account_analytics_idx ON public.orders (customer_user_id, created_at DESC) INCLUDE (total_usd, status) WHERE customer_user_id IS NOT NULL;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS customer_profiles_search_idx ON public.customer_profiles USING gin ((coalesce(display_name, '') || ' ' || email || ' ' || coalesce(phone, '') || ' ' || coalesce(organization_name, '')) gin_trgm_ops);

CREATE OR REPLACE VIEW public.customer_account_metrics WITH (security_invoker = true) AS
SELECT profile.user_id, profile.email, profile.display_name, profile.phone, profile.locale, profile.created_at, profile.account_kind, profile.organization_name,
  count(order_row.id)::integer AS order_count,
  coalesce(sum(CASE WHEN lower(coalesce(order_row.status, '')) NOT IN ('cancelled', 'canceled') THEN coalesce(order_row.total_usd, 0) ELSE 0 END), 0)::numeric AS lifetime_value,
  max(order_row.created_at) AS last_order_at
FROM public.customer_profiles AS profile LEFT JOIN public.orders AS order_row ON order_row.customer_user_id = profile.user_id
GROUP BY profile.user_id, profile.email, profile.display_name, profile.phone, profile.locale, profile.created_at, profile.account_kind, profile.organization_name;

CREATE OR REPLACE FUNCTION public.admin_customer_account_summary()
RETURNS TABLE (total_accounts bigint, new_accounts_30d bigint, purchasing_accounts bigint, total_lifetime_value numeric, individual_accounts bigint, research_accounts bigint, clinic_accounts bigint, other_accounts bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*)::bigint, count(*) FILTER (WHERE profile.created_at >= now() - interval '30 days')::bigint,
    count(*) FILTER (WHERE metric.order_count > 0)::bigint, coalesce(sum(metric.lifetime_value), 0)::numeric,
    count(*) FILTER (WHERE profile.account_kind = 'individual')::bigint, count(*) FILTER (WHERE profile.account_kind = 'research')::bigint,
    count(*) FILTER (WHERE profile.account_kind = 'clinic')::bigint, count(*) FILTER (WHERE profile.account_kind = 'other')::bigint
  FROM public.customer_profiles AS profile LEFT JOIN public.customer_account_metrics AS metric ON metric.user_id = profile.user_id;
$$;
REVOKE ALL ON FUNCTION public.admin_customer_account_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_customer_account_summary() TO service_role;
