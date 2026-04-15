-- Migration 013: Enable RLS on all tables and define access policies
-- Fail-closed: RLS enabled = deny by default. Only explicit policies grant access.

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bir_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bir_form_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bir_tax_form_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper: admin role check subquery
-- Used as: (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
-- ============================================================================

-- ============================================================================
-- users: SELECT/UPDATE own row. Admin can SELECT all.
-- ============================================================================

CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_select_admin ON users
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- leads: All authenticated users CRUD
-- ============================================================================

CREATE POLICY leads_select ON leads
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY leads_insert ON leads
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY leads_update ON leads
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY leads_delete ON leads
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Service role for website-created leads (no auth context)
CREATE POLICY leads_service_insert ON leads
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- lead_activity_log: All authenticated SELECT. INSERT via service role or trigger.
-- ============================================================================

CREATE POLICY lead_activity_log_select ON lead_activity_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY lead_activity_log_insert_service ON lead_activity_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- clients: All authenticated users CRUD
-- ============================================================================

CREATE POLICY clients_select ON clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY clients_insert ON clients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY clients_update ON clients
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY clients_delete ON clients
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- client_activity_log: All authenticated SELECT. INSERT via service role or trigger.
-- ============================================================================

CREATE POLICY client_activity_log_select ON client_activity_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY client_activity_log_insert_service ON client_activity_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- gmail_connections: Admin role only (SELECT/UPDATE)
-- ============================================================================

CREATE POLICY gmail_connections_select ON gmail_connections
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY gmail_connections_insert ON gmail_connections
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY gmail_connections_update ON gmail_connections
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY gmail_connections_delete ON gmail_connections
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- email_notifications: All authenticated SELECT. INSERT/UPDATE via service role.
-- ============================================================================

CREATE POLICY email_notifications_select ON email_notifications
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY email_notifications_insert_service ON email_notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY email_notifications_update_service ON email_notifications
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- document_attachments: All authenticated SELECT. INSERT/UPDATE via service role.
-- ============================================================================

CREATE POLICY document_attachments_select ON document_attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY document_attachments_insert_service ON document_attachments
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY document_attachments_update_service ON document_attachments
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- chart_of_accounts: All authenticated SELECT. Admin full CRUD.
-- ============================================================================

CREATE POLICY chart_of_accounts_select ON chart_of_accounts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY chart_of_accounts_insert_admin ON chart_of_accounts
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY chart_of_accounts_update_admin ON chart_of_accounts
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY chart_of_accounts_delete_admin ON chart_of_accounts
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- transactions: All authenticated CRUD. DELETE restricted to admin.
-- ============================================================================

CREATE POLICY transactions_select ON transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY transactions_insert ON transactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY transactions_update ON transactions
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY transactions_delete_admin ON transactions
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Service role for Edge Function inserts (document processing)
CREATE POLICY transactions_service_insert ON transactions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- ai_corrections: All authenticated SELECT/INSERT. DELETE restricted to admin.
-- ============================================================================

CREATE POLICY ai_corrections_select ON ai_corrections
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY ai_corrections_insert ON ai_corrections
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY ai_corrections_insert_service ON ai_corrections
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ai_corrections_delete_admin ON ai_corrections
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- invoices: All authenticated users CRUD
-- ============================================================================

CREATE POLICY invoices_select ON invoices
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY invoices_insert ON invoices
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY invoices_update ON invoices
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY invoices_delete ON invoices
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- invoice_line_items: All authenticated users CRUD
-- ============================================================================

CREATE POLICY invoice_line_items_select ON invoice_line_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY invoice_line_items_insert ON invoice_line_items
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY invoice_line_items_update ON invoice_line_items
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY invoice_line_items_delete ON invoice_line_items
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- tasks: All authenticated users CRUD
-- ============================================================================

CREATE POLICY tasks_select ON tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY tasks_insert ON tasks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY tasks_update ON tasks
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY tasks_delete ON tasks
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- deadlines: All authenticated users CRUD
-- ============================================================================

CREATE POLICY deadlines_select ON deadlines
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY deadlines_insert ON deadlines
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY deadlines_update ON deadlines
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY deadlines_delete ON deadlines
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Service role for cron-generated deadlines
CREATE POLICY deadlines_service_insert ON deadlines
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- financial_reports: All authenticated SELECT/INSERT. UPDATE for narrative approval.
-- ============================================================================

CREATE POLICY financial_reports_select ON financial_reports
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY financial_reports_insert ON financial_reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY financial_reports_update ON financial_reports
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- bir_form_templates: All authenticated SELECT. Admin full CRUD.
-- ============================================================================

CREATE POLICY bir_form_templates_select ON bir_form_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY bir_form_templates_insert_admin ON bir_form_templates
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY bir_form_templates_update_admin ON bir_form_templates
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY bir_form_templates_delete_admin ON bir_form_templates
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- bir_form_field_mappings: All authenticated SELECT. Admin full CRUD.
-- ============================================================================

CREATE POLICY bir_form_field_mappings_select ON bir_form_field_mappings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY bir_form_field_mappings_insert_admin ON bir_form_field_mappings
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY bir_form_field_mappings_update_admin ON bir_form_field_mappings
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY bir_form_field_mappings_delete_admin ON bir_form_field_mappings
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- bir_tax_form_records: All authenticated SELECT/INSERT. UPDATE for overrides.
-- ============================================================================

CREATE POLICY bir_tax_form_records_select ON bir_tax_form_records
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY bir_tax_form_records_insert ON bir_tax_form_records
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY bir_tax_form_records_update ON bir_tax_form_records
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- system_settings: Admin role only
-- ============================================================================

CREATE POLICY system_settings_select ON system_settings
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY system_settings_update ON system_settings
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY system_settings_insert ON system_settings
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY system_settings_delete ON system_settings
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
