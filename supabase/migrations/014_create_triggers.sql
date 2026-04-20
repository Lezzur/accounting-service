-- Migration 014: Trigger functions for updated_at and lead activity logging

-- ============================================================================
-- Generic set_updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_gmail_connections_updated_at ON gmail_connections;
CREATE TRIGGER trg_gmail_connections_updated_at
  BEFORE UPDATE ON gmail_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_email_notifications_updated_at ON email_notifications;
CREATE TRIGGER trg_email_notifications_updated_at
  BEFORE UPDATE ON email_notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_chart_of_accounts_updated_at ON chart_of_accounts;
CREATE TRIGGER trg_chart_of_accounts_updated_at
  BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_deadlines_updated_at ON deadlines;
CREATE TRIGGER trg_deadlines_updated_at
  BEFORE UPDATE ON deadlines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_bir_form_templates_updated_at ON bir_form_templates;
CREATE TRIGGER trg_bir_form_templates_updated_at
  BEFORE UPDATE ON bir_form_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_bir_tax_form_records_updated_at ON bir_tax_form_records;
CREATE TRIGGER trg_bir_tax_form_records_updated_at
  BEFORE UPDATE ON bir_tax_form_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON system_settings;
CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Lead activity logging triggers
-- SECURITY DEFINER: triggers run as the function owner to bypass RLS on
-- lead_activity_log (which only allows service_role INSERT).
-- ============================================================================

-- Log lead creation
CREATE OR REPLACE FUNCTION fn_log_lead_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO lead_activity_log (lead_id, action, details, performed_by)
  VALUES (
    NEW.id,
    'created',
    jsonb_build_object('stage', NEW.stage),
    NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_created ON leads;
CREATE TRIGGER trg_lead_created
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION fn_log_lead_created();

-- Log lead stage changes and field updates
CREATE OR REPLACE FUNCTION fn_log_lead_updated()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO lead_activity_log (lead_id, action, details)
    VALUES (
      NEW.id,
      'stage_changed',
      jsonb_build_object('from', OLD.stage, 'to', NEW.stage)
    );
  ELSIF OLD.notes IS DISTINCT FROM NEW.notes THEN
    INSERT INTO lead_activity_log (lead_id, action, details)
    VALUES (
      NEW.id,
      'notes_updated',
      jsonb_build_object('updated_field', 'notes')
    );
  ELSIF OLD.close_reason IS DISTINCT FROM NEW.close_reason THEN
    INSERT INTO lead_activity_log (lead_id, action, details)
    VALUES (
      NEW.id,
      'close_reason_set',
      jsonb_build_object('reason', NEW.close_reason)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_updated ON leads;
CREATE TRIGGER trg_lead_updated
  AFTER UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION fn_log_lead_updated();
