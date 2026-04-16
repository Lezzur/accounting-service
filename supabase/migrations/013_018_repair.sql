-- 013_018_repair.sql
-- Idempotent repair script for migrations 013-018.
-- Run via Supabase SQL Editor. Safe to re-run.

-- ============================================================================
-- 013: RLS policies
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is naturally idempotent.
-- CREATE POLICY is not — wrap each in an exception handler.
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

DO $$ BEGIN

-- users
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY users_select_admin ON users FOR SELECT USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- leads
DO $$ BEGIN
CREATE POLICY leads_select ON leads FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY leads_update ON leads FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY leads_delete ON leads FOR DELETE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY leads_service_insert ON leads FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- lead_activity_log
DO $$ BEGIN
CREATE POLICY lead_activity_log_select ON lead_activity_log FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY lead_activity_log_insert_service ON lead_activity_log FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- clients
DO $$ BEGIN
CREATE POLICY clients_select ON clients FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY clients_insert ON clients FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY clients_update ON clients FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY clients_delete ON clients FOR DELETE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- client_activity_log
DO $$ BEGIN
CREATE POLICY client_activity_log_select ON client_activity_log FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY client_activity_log_insert_service ON client_activity_log FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- gmail_connections
DO $$ BEGIN
CREATE POLICY gmail_connections_select ON gmail_connections FOR SELECT USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY gmail_connections_insert ON gmail_connections FOR INSERT WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY gmail_connections_update ON gmail_connections FOR UPDATE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin') WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY gmail_connections_delete ON gmail_connections FOR DELETE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- email_notifications
DO $$ BEGIN
CREATE POLICY email_notifications_select ON email_notifications FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY email_notifications_insert_service ON email_notifications FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY email_notifications_update_service ON email_notifications FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- document_attachments
DO $$ BEGIN
CREATE POLICY document_attachments_select ON document_attachments FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY document_attachments_insert_service ON document_attachments FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY document_attachments_update_service ON document_attachments FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- chart_of_accounts
DO $$ BEGIN
CREATE POLICY chart_of_accounts_select ON chart_of_accounts FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY chart_of_accounts_insert_admin ON chart_of_accounts FOR INSERT WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY chart_of_accounts_update_admin ON chart_of_accounts FOR UPDATE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin') WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY chart_of_accounts_delete_admin ON chart_of_accounts FOR DELETE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- transactions
DO $$ BEGIN
CREATE POLICY transactions_select ON transactions FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY transactions_insert ON transactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY transactions_update ON transactions FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY transactions_delete_admin ON transactions FOR DELETE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY transactions_service_insert ON transactions FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- ai_corrections
DO $$ BEGIN
CREATE POLICY ai_corrections_select ON ai_corrections FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY ai_corrections_insert ON ai_corrections FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY ai_corrections_insert_service ON ai_corrections FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY ai_corrections_delete_admin ON ai_corrections FOR DELETE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- invoices
DO $$ BEGIN
CREATE POLICY invoices_select ON invoices FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY invoices_insert ON invoices FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY invoices_update ON invoices FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY invoices_delete ON invoices FOR DELETE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- invoice_line_items
DO $$ BEGIN
CREATE POLICY invoice_line_items_select ON invoice_line_items FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY invoice_line_items_insert ON invoice_line_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY invoice_line_items_update ON invoice_line_items FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY invoice_line_items_delete ON invoice_line_items FOR DELETE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- tasks
DO $$ BEGIN
CREATE POLICY tasks_select ON tasks FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY tasks_insert ON tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY tasks_update ON tasks FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY tasks_delete ON tasks FOR DELETE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- deadlines
DO $$ BEGIN
CREATE POLICY deadlines_select ON deadlines FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY deadlines_insert ON deadlines FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY deadlines_update ON deadlines FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY deadlines_delete ON deadlines FOR DELETE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY deadlines_service_insert ON deadlines FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- financial_reports
DO $$ BEGIN
CREATE POLICY financial_reports_select ON financial_reports FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY financial_reports_insert ON financial_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY financial_reports_update ON financial_reports FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- bir_form_templates
DO $$ BEGIN
CREATE POLICY bir_form_templates_select ON bir_form_templates FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY bir_form_templates_insert_admin ON bir_form_templates FOR INSERT WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY bir_form_templates_update_admin ON bir_form_templates FOR UPDATE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin') WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY bir_form_templates_delete_admin ON bir_form_templates FOR DELETE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- bir_form_field_mappings
DO $$ BEGIN
CREATE POLICY bir_form_field_mappings_select ON bir_form_field_mappings FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY bir_form_field_mappings_insert_admin ON bir_form_field_mappings FOR INSERT WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY bir_form_field_mappings_update_admin ON bir_form_field_mappings FOR UPDATE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin') WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY bir_form_field_mappings_delete_admin ON bir_form_field_mappings FOR DELETE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- bir_tax_form_records
DO $$ BEGIN
CREATE POLICY bir_tax_form_records_select ON bir_tax_form_records FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY bir_tax_form_records_insert ON bir_tax_form_records FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY bir_tax_form_records_update ON bir_tax_form_records FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- system_settings
DO $$ BEGIN
CREATE POLICY system_settings_select ON system_settings FOR SELECT USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY system_settings_update ON system_settings FOR UPDATE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin') WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY system_settings_insert ON system_settings FOR INSERT WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN
CREATE POLICY system_settings_delete ON system_settings FOR DELETE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- ============================================================================
-- 014: Triggers
-- CREATE OR REPLACE FUNCTION is idempotent. Triggers need exception handlers.
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_gmail_connections_updated_at BEFORE UPDATE ON gmail_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_email_notifications_updated_at BEFORE UPDATE ON email_notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_chart_of_accounts_updated_at BEFORE UPDATE ON chart_of_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_deadlines_updated_at BEFORE UPDATE ON deadlines FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_bir_form_templates_updated_at BEFORE UPDATE ON bir_form_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_bir_tax_form_records_updated_at BEFORE UPDATE ON bir_tax_form_records FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- Lead activity logging triggers
CREATE OR REPLACE FUNCTION fn_log_lead_created()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO lead_activity_log (lead_id, action, details, performed_by)
  VALUES (NEW.id, 'created', jsonb_build_object('stage', NEW.stage), NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN CREATE TRIGGER trg_lead_created AFTER INSERT ON leads FOR EACH ROW EXECUTE FUNCTION fn_log_lead_created(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

CREATE OR REPLACE FUNCTION fn_log_lead_updated()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO lead_activity_log (lead_id, action, details)
    VALUES (NEW.id, 'stage_changed', jsonb_build_object('from', OLD.stage, 'to', NEW.stage));
  ELSIF OLD.notes IS DISTINCT FROM NEW.notes THEN
    INSERT INTO lead_activity_log (lead_id, action, details)
    VALUES (NEW.id, 'notes_updated', jsonb_build_object('updated_field', 'notes'));
  ELSIF OLD.close_reason IS DISTINCT FROM NEW.close_reason THEN
    INSERT INTO lead_activity_log (lead_id, action, details)
    VALUES (NEW.id, 'close_reason_set', jsonb_build_object('reason', NEW.close_reason));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN CREATE TRIGGER trg_lead_updated AFTER UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION fn_log_lead_updated(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- ============================================================================
-- 015: Draft emails table
-- ============================================================================

CREATE TABLE IF NOT EXISTS draft_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  deadline_id uuid REFERENCES deadlines(id) ON DELETE SET NULL,
  template_type text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'sent', 'discarded')),
  reviewed_by uuid REFERENCES users(id),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN CREATE INDEX idx_draft_emails_client_deadline ON draft_emails(client_id, deadline_id); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE INDEX idx_draft_emails_status ON draft_emails(status) WHERE status IN ('pending_review', 'approved'); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE TRIGGER trg_draft_emails_updated_at BEFORE UPDATE ON draft_emails FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

ALTER TABLE draft_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY draft_emails_select ON draft_emails FOR SELECT USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE POLICY draft_emails_insert ON draft_emails FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE POLICY draft_emails_update ON draft_emails FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE POLICY draft_emails_delete ON draft_emails FOR DELETE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN CREATE POLICY draft_emails_service_insert ON draft_emails FOR INSERT WITH CHECK (auth.role() = 'service_role'); EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- ============================================================================
-- 016: Seed chart of accounts (already idempotent via ON CONFLICT)
-- ============================================================================

INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, display_order) VALUES
  ('1000', 'Assets',                      'asset',     'debit',  1),
  ('1100', 'Cash and Cash Equivalents',   'asset',     'debit',  2),
  ('1110', 'Cash on Hand',                'asset',     'debit',  3),
  ('1120', 'Cash in Bank',                'asset',     'debit',  4),
  ('1200', 'Accounts Receivable',         'asset',     'debit',  5),
  ('1300', 'Inventory',                   'asset',     'debit',  6),
  ('1400', 'Prepaid Expenses',            'asset',     'debit',  7),
  ('1500', 'Property and Equipment',      'asset',     'debit',  8),
  ('2000', 'Liabilities',                 'liability', 'credit', 20),
  ('2100', 'Accounts Payable',            'liability', 'credit', 21),
  ('2200', 'Accrued Expenses',            'liability', 'credit', 22),
  ('2300', 'Output VAT Payable',          'liability', 'credit', 23),
  ('2400', 'Income Tax Payable',          'liability', 'credit', 24),
  ('2500', 'Withholding Tax Payable',     'liability', 'credit', 25),
  ('2600', 'Loans Payable',               'liability', 'credit', 26),
  ('3000', 'Equity',                      'equity',    'credit', 30),
  ('3100', 'Owner''s Capital',            'equity',    'credit', 31),
  ('3200', 'Retained Earnings',           'equity',    'credit', 32),
  ('3300', 'Owner''s Withdrawals',        'equity',    'debit',  33),
  ('4000', 'Revenue',                     'revenue',   'credit', 40),
  ('4100', 'Service Revenue',             'revenue',   'credit', 41),
  ('4200', 'Sales Revenue',               'revenue',   'credit', 42),
  ('4300', 'Other Income',                'revenue',   'credit', 43),
  ('5000', 'Expenses',                    'expense',   'debit',  50),
  ('5100', 'Cost of Services',            'expense',   'debit',  51),
  ('5200', 'Salaries and Wages',          'expense',   'debit',  52),
  ('5300', 'Rent Expense',                'expense',   'debit',  53),
  ('5400', 'Utilities Expense',           'expense',   'debit',  54),
  ('5500', 'Office Supplies',             'expense',   'debit',  55),
  ('5600', 'Transportation',              'expense',   'debit',  56),
  ('5700', 'Professional Fees',           'expense',   'debit',  57),
  ('5800', 'Depreciation Expense',        'expense',   'debit',  58),
  ('5900', 'Bank Charges',                'expense',   'debit',  59),
  ('5950', 'Interest Expense',            'expense',   'debit',  60),
  ('5990', 'Miscellaneous Expense',       'expense',   'debit',  61)
ON CONFLICT (code) DO NOTHING;

UPDATE chart_of_accounts SET parent_code = '1000' WHERE code IN ('1100', '1200', '1300', '1400', '1500') AND parent_code IS DISTINCT FROM '1000';
UPDATE chart_of_accounts SET parent_code = '1100' WHERE code IN ('1110', '1120') AND parent_code IS DISTINCT FROM '1100';
UPDATE chart_of_accounts SET parent_code = '2000' WHERE code IN ('2100', '2200', '2300', '2400', '2500', '2600') AND parent_code IS DISTINCT FROM '2000';
UPDATE chart_of_accounts SET parent_code = '3000' WHERE code IN ('3100', '3200', '3300') AND parent_code IS DISTINCT FROM '3000';
UPDATE chart_of_accounts SET parent_code = '4000' WHERE code IN ('4100', '4200', '4300') AND parent_code IS DISTINCT FROM '4000';
UPDATE chart_of_accounts SET parent_code = '5000' WHERE code IN ('5100', '5200', '5300', '5400', '5500', '5600', '5700', '5800', '5900', '5950', '5990') AND parent_code IS DISTINCT FROM '5000';

-- ============================================================================
-- 017: Seed BIR templates (already idempotent via WHERE NOT EXISTS)
-- ============================================================================

INSERT INTO bir_form_templates (form_number, version, form_title, applicable_to, is_current, template_layout)
SELECT v.form_number, v.version, v.form_title, v.applicable_to, true, v.template_layout
FROM (VALUES
  ('2551Q','2024-01','Quarterly Percentage Tax Return',ARRAY['non_vat'],'{"sections":[{"id":"part_1","title":"Part I - Background Information"},{"id":"part_2","title":"Part II - Computation of Percentage Tax"}]}'::jsonb),
  ('2550M','2024-01','Monthly VAT Declaration',ARRAY['vat'],'{"sections":[{"id":"part_1","title":"Part I - Background Information"},{"id":"part_2","title":"Part II - Computation of Tax"},{"id":"part_3","title":"Part III - Tax Due / (Overpayment)"}]}'::jsonb),
  ('2550Q','2024-01','Quarterly VAT Return',ARRAY['vat'],'{"sections":[{"id":"part_1","title":"Part I - Background Information"},{"id":"part_2","title":"Part II - Computation of Sales / Receipts"},{"id":"part_3","title":"Part III - Tax Due / (Overpayment)"}]}'::jsonb),
  ('1701','2024-01','Annual Income Tax Return for Individuals',ARRAY['sole_prop'],'{"sections":[{"id":"part_1","title":"Part I - Background Information"},{"id":"part_2","title":"Part II - Total Tax Payable"},{"id":"part_3","title":"Part III - Income from Business / Profession"},{"id":"part_4","title":"Part IV - Deductions"}]}'::jsonb),
  ('1701Q','2024-01','Quarterly Income Tax Return for Individuals',ARRAY['sole_prop'],'{"sections":[{"id":"part_1","title":"Part I - Background Information"},{"id":"part_2","title":"Part II - Computation of Tax Due"}]}'::jsonb),
  ('1702','2024-01','Annual Income Tax Return for Corporations and Partnerships',ARRAY['opc','corporation'],'{"sections":[{"id":"part_1","title":"Part I - Background Information"},{"id":"part_2","title":"Part II - Total Tax Payable"},{"id":"part_3","title":"Part III - Gross Income"},{"id":"part_4","title":"Part IV - Deductions"},{"id":"part_5","title":"Part V - Tax Relief / Incentives"}]}'::jsonb),
  ('1702Q','2024-01','Quarterly Income Tax Return for Corporations and Partnerships',ARRAY['opc','corporation'],'{"sections":[{"id":"part_1","title":"Part I - Background Information"},{"id":"part_2","title":"Part II - Computation of Tax Due"}]}'::jsonb),
  ('1601-C','2024-01','Monthly Remittance Return of Income Taxes Withheld on Compensation',ARRAY['sole_prop','opc','corporation'],'{"sections":[{"id":"part_1","title":"Part I - Background Information"},{"id":"part_2","title":"Part II - Computation of Tax Withheld"}]}'::jsonb),
  ('1601-EQ','2024-01','Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded)',ARRAY['sole_prop','opc','corporation'],'{"sections":[{"id":"part_1","title":"Part I - Background Information"},{"id":"part_2","title":"Part II - Computation of Tax Withheld"}]}'::jsonb),
  ('0619-E','2024-01','Monthly Remittance Form of Creditable Income Taxes Withheld (Expanded)',ARRAY['sole_prop','opc','corporation'],'{"sections":[{"id":"part_1","title":"Part I - Background Information"},{"id":"part_2","title":"Part II - Remittance Details"}]}'::jsonb),
  ('0619-F','2024-01','Monthly Remittance Form of Final Taxes Withheld',ARRAY['sole_prop','opc','corporation'],'{"sections":[{"id":"part_1","title":"Part I - Background Information"},{"id":"part_2","title":"Part II - Remittance Details"}]}'::jsonb)
) AS v(form_number, version, form_title, applicable_to, template_layout)
WHERE NOT EXISTS (
  SELECT 1 FROM bir_form_templates t WHERE t.form_number = v.form_number AND t.is_current = true
);

-- 2550Q field mappings
INSERT INTO bir_form_field_mappings (template_id, field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type, v.mapping_expression::jsonb, v.is_required, v.is_editable, v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin','Taxpayer Identification Number','client_field','{"field":"tin"}',true,false,1,'part_1'),
  ('registered_name','Registered Name','client_field','{"field":"business_name"}',true,false,2,'part_1'),
  ('total_sales','Total Sales / Receipts','sum_account_type','{"account_type":"revenue","transaction_type":"credit"}',true,true,10,'part_3'),
  ('output_vat','Output VAT (12%)','computed','{"formula":"field:total_sales * 0.12"}',true,true,11,'part_3')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '2550Q' AND t.is_current = true
  AND NOT EXISTS (SELECT 1 FROM bir_form_field_mappings m WHERE m.template_id = t.id AND m.field_code = v.field_code);

-- System settings
INSERT INTO system_settings (key, value, description) VALUES
  ('category_confidence_threshold','0.85','Minimum confidence for auto-assigning transaction categories'),
  ('email_classification_confidence_threshold','0.70','Minimum confidence to surface email as document notification'),
  ('ocr_low_confidence_threshold','0.80','Below this, flag extracted amount with warning'),
  ('ai_cost_alert_threshold','25.00','USD amount to trigger cost alert'),
  ('ai_cost_ceiling','30.00','USD monthly cost ceiling')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 018: RPC functions (already idempotent via CREATE OR REPLACE)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_financial_summary(p_client_id uuid, p_period_start date, p_period_end date)
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_build_object(
    'total_revenue',     COALESCE(SUM(t.amount) FILTER (WHERE coa.account_type = 'revenue' AND t.status = 'approved'), 0),
    'total_expenses',    COALESCE(SUM(t.amount) FILTER (WHERE coa.account_type = 'expense' AND t.status = 'approved'), 0),
    'transaction_count', COUNT(*),
    'pending_count',     COUNT(*) FILTER (WHERE t.status = 'pending'),
    'approved_count',    COUNT(*) FILTER (WHERE t.status = 'approved')
  )
  FROM transactions t
  LEFT JOIN chart_of_accounts coa ON coa.code = t.category_code
  WHERE t.client_id = p_client_id AND t.date >= p_period_start AND t.date <= p_period_end;
$$;

CREATE OR REPLACE FUNCTION get_correction_rates(p_days integer)
RETURNS TABLE (field_name text, corrections bigint, transactions_corrected bigint)
LANGUAGE sql STABLE AS $$
  SELECT ac.field_name, COUNT(*) AS corrections, COUNT(DISTINCT ac.transaction_id) AS transactions_corrected
  FROM ai_corrections ac
  WHERE ac.created_at >= now() - (p_days || ' days')::interval
  GROUP BY ac.field_name
  ORDER BY corrections DESC;
$$;
