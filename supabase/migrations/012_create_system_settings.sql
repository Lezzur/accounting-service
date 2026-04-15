-- 012_create_system_settings.sql
-- Key-value store for configurable thresholds and system parameters

CREATE TABLE system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings_select_authenticated"
  ON system_settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "system_settings_modify_admin"
  ON system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Seed default thresholds
INSERT INTO system_settings (key, value, description) VALUES
  ('category_confidence_threshold', '0.85', 'Minimum confidence for auto-assigning transaction categories'),
  ('email_classification_confidence_threshold', '0.70', 'Minimum confidence to surface email as document notification'),
  ('ocr_low_confidence_threshold', '0.80', 'Below this, flag extracted amount with warning'),
  ('ai_cost_alert_threshold', '25.00', 'USD amount to trigger cost alert'),
  ('ai_cost_ceiling', '30.00', 'USD monthly cost ceiling');
