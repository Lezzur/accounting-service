-- 024_fix_rls_recursion.sql
-- Fix infinite recursion in RLS policies caused by the pattern
--   USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
-- applied to the `users` table itself and referenced from other tables.
--
-- Root cause: `users_select_admin` (on `users`) runs a subquery against
-- `users`, which is subject to the same policy, which runs the subquery
-- again, ad infinitum. Any other policy referencing the same subquery
-- (gmail_connections, system_settings, bir_form_*, chart_of_accounts,
-- etc.) triggers the same loop the moment it needs to read `users`.
--
-- Fix: replace every admin-gated policy with a SECURITY DEFINER helper
-- that reads `users.role` bypassing RLS, so evaluating it does not
-- re-enter the policy system.
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY, and
-- CREATE OR REPLACE FUNCTION for the helper. Safe to re-run even if
-- earlier ad-hoc SQL already changed some policies to
-- `auth.uid() IS NOT NULL`.

-- ============================================================================
-- Helper: is_admin()
-- SECURITY DEFINER runs with the function owner's privileges (postgres),
-- which bypasses RLS on the users table it reads.
-- STABLE so Postgres can cache the result within a single statement.
-- search_path is pinned to public to prevent search_path hijacks.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM users WHERE id = auth.uid()),
    false
  );
$$;

-- Limit EXECUTE to authenticated sessions; anon shouldn't be calling it.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ============================================================================
-- users: SELECT own + SELECT all for admin (via is_admin(), not subquery)
-- ============================================================================

DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS users_select_admin ON users;
CREATE POLICY users_select_admin ON users
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- gmail_connections: admin-only CRUD
-- ============================================================================

DROP POLICY IF EXISTS gmail_connections_select ON gmail_connections;
CREATE POLICY gmail_connections_select ON gmail_connections
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS gmail_connections_insert ON gmail_connections;
CREATE POLICY gmail_connections_insert ON gmail_connections
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS gmail_connections_update ON gmail_connections;
CREATE POLICY gmail_connections_update ON gmail_connections
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS gmail_connections_delete ON gmail_connections;
CREATE POLICY gmail_connections_delete ON gmail_connections
  FOR DELETE USING (public.is_admin());

-- ============================================================================
-- chart_of_accounts: authenticated SELECT, admin insert/update/delete
-- ============================================================================

DROP POLICY IF EXISTS chart_of_accounts_insert_admin ON chart_of_accounts;
CREATE POLICY chart_of_accounts_insert_admin ON chart_of_accounts
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS chart_of_accounts_update_admin ON chart_of_accounts;
CREATE POLICY chart_of_accounts_update_admin ON chart_of_accounts
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS chart_of_accounts_delete_admin ON chart_of_accounts;
CREATE POLICY chart_of_accounts_delete_admin ON chart_of_accounts
  FOR DELETE USING (public.is_admin());

-- ============================================================================
-- transactions: admin DELETE
-- ============================================================================

DROP POLICY IF EXISTS transactions_delete_admin ON transactions;
CREATE POLICY transactions_delete_admin ON transactions
  FOR DELETE USING (public.is_admin());

-- ============================================================================
-- ai_corrections: admin DELETE
-- ============================================================================

DROP POLICY IF EXISTS ai_corrections_delete_admin ON ai_corrections;
CREATE POLICY ai_corrections_delete_admin ON ai_corrections
  FOR DELETE USING (public.is_admin());

-- ============================================================================
-- bir_form_templates: admin insert/update/delete
-- ============================================================================

DROP POLICY IF EXISTS bir_form_templates_insert_admin ON bir_form_templates;
CREATE POLICY bir_form_templates_insert_admin ON bir_form_templates
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS bir_form_templates_update_admin ON bir_form_templates;
CREATE POLICY bir_form_templates_update_admin ON bir_form_templates
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS bir_form_templates_delete_admin ON bir_form_templates;
CREATE POLICY bir_form_templates_delete_admin ON bir_form_templates
  FOR DELETE USING (public.is_admin());

-- ============================================================================
-- bir_form_field_mappings: admin insert/update/delete
-- ============================================================================

DROP POLICY IF EXISTS bir_form_field_mappings_insert_admin ON bir_form_field_mappings;
CREATE POLICY bir_form_field_mappings_insert_admin ON bir_form_field_mappings
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS bir_form_field_mappings_update_admin ON bir_form_field_mappings;
CREATE POLICY bir_form_field_mappings_update_admin ON bir_form_field_mappings
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS bir_form_field_mappings_delete_admin ON bir_form_field_mappings;
CREATE POLICY bir_form_field_mappings_delete_admin ON bir_form_field_mappings
  FOR DELETE USING (public.is_admin());

-- ============================================================================
-- system_settings: admin only
-- ============================================================================

DROP POLICY IF EXISTS system_settings_select ON system_settings;
CREATE POLICY system_settings_select ON system_settings
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS system_settings_insert ON system_settings;
CREATE POLICY system_settings_insert ON system_settings
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS system_settings_update ON system_settings;
CREATE POLICY system_settings_update ON system_settings
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS system_settings_delete ON system_settings;
CREATE POLICY system_settings_delete ON system_settings
  FOR DELETE USING (public.is_admin());
