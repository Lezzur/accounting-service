-- 002_create_leads.sql
-- Sales pipeline: leads and lead activity log

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  source text NOT NULL CHECK (source IN ('website_form', 'cal_booking', 'referral', 'manual')),
  stage text NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'contacted', 'call_booked', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost')),
  close_reason text CHECK (length(close_reason) <= 500),
  notes text CHECK (length(notes) <= 10000),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_source ON leads(source);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_all_authenticated"
  ON leads FOR ALL
  USING (auth.role() = 'authenticated');

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Lead activity log: immutable audit trail
CREATE TABLE lead_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  performed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_activity_lead_id ON lead_activity_log(lead_id, created_at DESC);

ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_activity_select_authenticated"
  ON lead_activity_log FOR SELECT
  USING (auth.role() = 'authenticated');

-- Trigger: log lead creation
CREATE OR REPLACE FUNCTION fn_log_lead_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO lead_activity_log (lead_id, action, details, performed_by)
  VALUES (NEW.id, 'created', jsonb_build_object('stage', NEW.stage), NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_created
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION fn_log_lead_created();

-- Trigger: log lead stage changes and field updates
CREATE OR REPLACE FUNCTION fn_log_lead_updated()
RETURNS TRIGGER AS $$
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

CREATE TRIGGER trg_lead_updated
  AFTER UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION fn_log_lead_updated();
