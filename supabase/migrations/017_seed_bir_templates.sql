-- 017_seed_bir_templates.sql
-- Seed BIR form templates and representative field mappings for 2550Q
-- Also seeds system_settings defaults (idempotent — safe to re-run alongside 012)

-- ---------------------------------------------------------------------------
-- BIR Form Templates
-- All versions set to '2024-01'. is_current = true.
-- Idempotent: ON CONFLICT on the partial unique index (form_number WHERE is_current)
-- is not directly supported, so we guard with a WHERE NOT EXISTS check.
-- ---------------------------------------------------------------------------

INSERT INTO bir_form_templates (form_number, version, form_title, applicable_to, is_current, template_layout)
SELECT v.form_number, v.version, v.form_title, v.applicable_to, true, v.template_layout
FROM (VALUES
  (
    '2551Q',
    '2024-01',
    'Quarterly Percentage Tax Return',
    ARRAY['non_vat'],
    '{"sections": [
      {"id": "part_1", "title": "Part I - Background Information"},
      {"id": "part_2", "title": "Part II - Computation of Percentage Tax"}
    ]}'::jsonb
  ),
  (
    '2550M',
    '2024-01',
    'Monthly VAT Declaration',
    ARRAY['vat'],
    '{"sections": [
      {"id": "part_1", "title": "Part I - Background Information"},
      {"id": "part_2", "title": "Part II - Computation of Tax"},
      {"id": "part_3", "title": "Part III - Tax Due / (Overpayment)"}
    ]}'::jsonb
  ),
  (
    '2550Q',
    '2024-01',
    'Quarterly VAT Return',
    ARRAY['vat'],
    '{"sections": [
      {"id": "part_1", "title": "Part I - Background Information"},
      {"id": "part_2", "title": "Part II - Computation of Sales / Receipts"},
      {"id": "part_3", "title": "Part III - Tax Due / (Overpayment)"}
    ]}'::jsonb
  ),
  (
    '1701',
    '2024-01',
    'Annual Income Tax Return for Individuals',
    ARRAY['sole_prop'],
    '{"sections": [
      {"id": "part_1", "title": "Part I - Background Information"},
      {"id": "part_2", "title": "Part II - Total Tax Payable"},
      {"id": "part_3", "title": "Part III - Income from Business / Profession"},
      {"id": "part_4", "title": "Part IV - Deductions"}
    ]}'::jsonb
  ),
  (
    '1701Q',
    '2024-01',
    'Quarterly Income Tax Return for Individuals',
    ARRAY['sole_prop'],
    '{"sections": [
      {"id": "part_1", "title": "Part I - Background Information"},
      {"id": "part_2", "title": "Part II - Computation of Tax Due"}
    ]}'::jsonb
  ),
  (
    '1702',
    '2024-01',
    'Annual Income Tax Return for Corporations and Partnerships',
    ARRAY['opc', 'corporation'],
    '{"sections": [
      {"id": "part_1", "title": "Part I - Background Information"},
      {"id": "part_2", "title": "Part II - Total Tax Payable"},
      {"id": "part_3", "title": "Part III - Gross Income"},
      {"id": "part_4", "title": "Part IV - Deductions"},
      {"id": "part_5", "title": "Part V - Tax Relief / Incentives"}
    ]}'::jsonb
  ),
  (
    '1702Q',
    '2024-01',
    'Quarterly Income Tax Return for Corporations and Partnerships',
    ARRAY['opc', 'corporation'],
    '{"sections": [
      {"id": "part_1", "title": "Part I - Background Information"},
      {"id": "part_2", "title": "Part II - Computation of Tax Due"}
    ]}'::jsonb
  ),
  (
    '1601-C',
    '2024-01',
    'Monthly Remittance Return of Income Taxes Withheld on Compensation',
    ARRAY['sole_prop', 'opc', 'corporation'],
    '{"sections": [
      {"id": "part_1", "title": "Part I - Background Information"},
      {"id": "part_2", "title": "Part II - Computation of Tax Withheld"}
    ]}'::jsonb
  ),
  (
    '1601-EQ',
    '2024-01',
    'Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded)',
    ARRAY['sole_prop', 'opc', 'corporation'],
    '{"sections": [
      {"id": "part_1", "title": "Part I - Background Information"},
      {"id": "part_2", "title": "Part II - Computation of Tax Withheld"}
    ]}'::jsonb
  ),
  (
    '0619-E',
    '2024-01',
    'Monthly Remittance Form of Creditable Income Taxes Withheld (Expanded)',
    ARRAY['sole_prop', 'opc', 'corporation'],
    '{"sections": [
      {"id": "part_1", "title": "Part I - Background Information"},
      {"id": "part_2", "title": "Part II - Remittance Details"}
    ]}'::jsonb
  ),
  (
    '0619-F',
    '2024-01',
    'Monthly Remittance Form of Final Taxes Withheld',
    ARRAY['sole_prop', 'opc', 'corporation'],
    '{"sections": [
      {"id": "part_1", "title": "Part I - Background Information"},
      {"id": "part_2", "title": "Part II - Remittance Details"}
    ]}'::jsonb
  )
) AS v(form_number, version, form_title, applicable_to, template_layout)
WHERE NOT EXISTS (
  SELECT 1 FROM bir_form_templates t
  WHERE t.form_number = v.form_number AND t.is_current = true
);

-- ---------------------------------------------------------------------------
-- Field mappings for 2550Q (Quarterly VAT Return) — most complete example
-- Covers: background info fields, total sales, and computed output VAT
-- ---------------------------------------------------------------------------

INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT
  t.id,
  v.field_code,
  v.field_label,
  v.mapping_type,
  v.mapping_expression::jsonb,
  v.is_required,
  v.is_editable,
  v.display_order,
  v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  (
    'tin',
    'Taxpayer Identification Number',
    'client_field',
    '{"field": "tin"}',
    true,
    false,
    1,
    'part_1'
  ),
  (
    'registered_name',
    'Registered Name',
    'client_field',
    '{"field": "business_name"}',
    true,
    false,
    2,
    'part_1'
  ),
  (
    'total_sales',
    'Total Sales / Receipts',
    'sum_account_type',
    '{"account_type": "revenue", "transaction_type": "credit"}',
    true,
    true,
    10,
    'part_3'
  ),
  (
    'output_vat',
    'Output VAT (12%)',
    'computed',
    '{"formula": "field:total_sales * 0.12"}',
    true,
    true,
    11,
    'part_3'
  )
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '2550Q'
  AND t.is_current = true
  AND NOT EXISTS (
    SELECT 1 FROM bir_form_field_mappings m
    WHERE m.template_id = t.id AND m.field_code = v.field_code
  );

-- ---------------------------------------------------------------------------
-- System settings defaults
-- Idempotent: ON CONFLICT DO NOTHING — safe alongside 012 which also seeds these
-- ---------------------------------------------------------------------------

INSERT INTO system_settings (key, value, description) VALUES
  ('category_confidence_threshold',            '0.85', 'Minimum confidence for auto-assigning transaction categories'),
  ('email_classification_confidence_threshold','0.70', 'Minimum confidence to surface email as document notification'),
  ('ocr_low_confidence_threshold',             '0.80', 'Below this, flag extracted amount with warning'),
  ('ai_cost_alert_threshold',                  '25.00','USD amount to trigger cost alert'),
  ('ai_cost_ceiling',                          '30.00','USD monthly cost ceiling')
ON CONFLICT (key) DO NOTHING;
