-- 018_create_rpc_functions.sql
-- PostgREST RPC functions for complex queries

-- get_financial_summary
-- Dashboard widget: revenue/expense totals and transaction counts for a client and period
CREATE OR REPLACE FUNCTION get_financial_summary(
  p_client_id    uuid,
  p_period_start date,
  p_period_end   date
)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'total_revenue',      COALESCE(SUM(t.amount) FILTER (WHERE coa.account_type = 'revenue'  AND t.status = 'approved'), 0),
    'total_expenses',     COALESCE(SUM(t.amount) FILTER (WHERE coa.account_type = 'expense'  AND t.status = 'approved'), 0),
    'transaction_count',  COUNT(*),
    'pending_count',      COUNT(*) FILTER (WHERE t.status = 'pending'),
    'approved_count',     COUNT(*) FILTER (WHERE t.status = 'approved')
  )
  FROM transactions t
  LEFT JOIN chart_of_accounts coa ON coa.code = t.category_code
  WHERE t.client_id   = p_client_id
    AND t.date        >= p_period_start
    AND t.date        <= p_period_end;
$$;

-- get_correction_rates
-- Admin dashboard: AI accuracy metrics grouped by corrected field
CREATE OR REPLACE FUNCTION get_correction_rates(
  p_days integer
)
RETURNS TABLE (
  field_name             text,
  corrections            bigint,
  transactions_corrected bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ac.field_name,
    COUNT(*)                    AS corrections,
    COUNT(DISTINCT ac.transaction_id) AS transactions_corrected
  FROM ai_corrections ac
  WHERE ac.created_at >= now() - (p_days || ' days')::interval
  GROUP BY ac.field_name
  ORDER BY corrections DESC;
$$;
