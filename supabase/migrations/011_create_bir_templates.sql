-- 011_create_bir_templates.sql
-- BIR form templates, field mappings, and tax form records

-- BIR form definitions — data-driven, no code deployment needed for form updates
CREATE TABLE IF NOT EXISTS bir_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_number text NOT NULL,
  version text NOT NULL,
  form_title text NOT NULL,
  applicable_to text[] NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  template_layout jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one current version per form number
CREATE UNIQUE INDEX IF NOT EXISTS idx_bir_templates_form_current ON bir_form_templates(form_number) WHERE is_current = true;

ALTER TABLE bir_form_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bir_form_templates_all_authenticated" ON bir_form_templates;
CREATE POLICY "bir_form_templates_all_authenticated"
  ON bir_form_templates FOR ALL
  USING (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS trg_bir_form_templates_updated_at ON bir_form_templates;
CREATE TRIGGER trg_bir_form_templates_updated_at
  BEFORE UPDATE ON bir_form_templates
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Maps chart of accounts categories to specific BIR form fields
CREATE TABLE IF NOT EXISTS bir_form_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES bir_form_templates(id) ON DELETE CASCADE,
  field_code text NOT NULL,
  field_label text NOT NULL,
  mapping_type text NOT NULL CHECK (mapping_type IN (
    'sum_category',
    'sum_account_type',
    'computed',
    'static',
    'client_field'
  )),
  mapping_expression jsonb NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  is_editable boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL,
  section text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bir_field_map_template ON bir_form_field_mappings(template_id, display_order);

ALTER TABLE bir_form_field_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bir_form_field_mappings_all_authenticated" ON bir_form_field_mappings;
CREATE POLICY "bir_form_field_mappings_all_authenticated"
  ON bir_form_field_mappings FOR ALL
  USING (auth.role() = 'authenticated');

-- Instances of pre-filled BIR forms for a client and period
CREATE TABLE IF NOT EXISTS bir_tax_form_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  template_id uuid NOT NULL REFERENCES bir_form_templates(id),
  form_number text NOT NULL,
  filing_period text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'prefill_pending',
    'prefill_complete',
    'exported'
  )),
  prefill_data jsonb NOT NULL DEFAULT '{}',
  manual_overrides jsonb NOT NULL DEFAULT '{}',
  exported_pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bir_records_client ON bir_tax_form_records(client_id, form_number, filing_period);
CREATE INDEX IF NOT EXISTS idx_bir_records_status ON bir_tax_form_records(status) WHERE status != 'exported';

ALTER TABLE bir_tax_form_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bir_tax_form_records_all_authenticated" ON bir_tax_form_records;
CREATE POLICY "bir_tax_form_records_all_authenticated"
  ON bir_tax_form_records FOR ALL
  USING (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS trg_bir_tax_form_records_updated_at ON bir_tax_form_records;
CREATE TRIGGER trg_bir_tax_form_records_updated_at
  BEFORE UPDATE ON bir_tax_form_records
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
