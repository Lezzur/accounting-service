-- 022_fix_bir_field_mappings.sql
-- Realign BIR field mappings with the frontend form templates so prefill actually
-- populates visible fields. Also expand the mapping_type CHECK to allow 'period_part'
-- for fields derived from the filing period (year / quarter / month / fiscal_year_end).
--
-- Idempotent: drops and recreates the CHECK constraint, wipes existing mappings
-- for the 11 supported forms, and re-inserts a canonical set keyed by the field
-- ids used in apps/toolbox/.../workdesk/tax-prep/page.tsx FORM_TEMPLATES.

-- ---------------------------------------------------------------------------
-- Expand CHECK constraint to allow 'period_part'
-- ---------------------------------------------------------------------------

ALTER TABLE bir_form_field_mappings
  DROP CONSTRAINT IF EXISTS bir_form_field_mappings_mapping_type_check;

ALTER TABLE bir_form_field_mappings
  ADD CONSTRAINT bir_form_field_mappings_mapping_type_check
  CHECK (mapping_type IN (
    'sum_category',
    'sum_account_type',
    'computed',
    'static',
    'client_field',
    'period_part'
  ));

-- ---------------------------------------------------------------------------
-- Wipe existing mappings for the 11 supported forms so the reseed is clean.
-- Tax form records reference template_id, not mapping ids, so no FK issue.
-- ---------------------------------------------------------------------------

DELETE FROM bir_form_field_mappings
WHERE template_id IN (
  SELECT id FROM bir_form_templates
  WHERE form_number IN (
    '2550Q', '2550M', '2551Q',
    '1701', '1701Q', '1702', '1702Q',
    '1601-C', '1601-EQ',
    '0619-E', '0619-F'
  )
  AND is_current = true
);

-- ---------------------------------------------------------------------------
-- Helper macro pattern: insert (template_id, field_code, field_label,
--   mapping_type, mapping_expression, is_required, is_editable, display_order, section)
-- Using one multi-row INSERT per form keeps it readable.
-- ---------------------------------------------------------------------------

-- =====================================================================
-- 2550Q — Quarterly VAT Return
-- =====================================================================
INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type,
       v.mapping_expression::jsonb, v.is_required, v.is_editable,
       v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin',                 'Taxpayer Identification Number',       'client_field',    '{"field":"tin"}',                                             true,  false,  1, 'part_1'),
  ('rdo_code',            'RDO Code',                             'static',          '{"value":""}',                                                false, false,  2, 'part_1'),
  ('taxpayer_name',       'Taxpayer''s Name / Business Name',     'client_field',    '{"field":"business_name"}',                                   true,  false,  3, 'part_1'),
  ('registered_address',  'Registered Address',                   'client_field',    '{"field":"registered_address"}',                              true,  false,  4, 'part_1'),
  ('quarter',             'Quarter',                              'period_part',     '{"part":"quarter"}',                                          true,  false,  5, 'part_1'),
  ('year',                'Year',                                 'period_part',     '{"part":"year"}',                                             true,  false,  6, 'part_1'),
  ('taxable_sales',       'Taxable Sales / Receipts',             'sum_account_type','{"account_type":"revenue","transaction_type":"credit"}',      true,  true,  10, 'part_2'),
  ('output_tax',          'Output Tax (12%)',                     'computed',        '{"formula":"field:taxable_sales * 0.12"}',                    true,  false, 11, 'part_2'),
  ('zero_rated_sales',    'Zero-Rated Sales / Receipts',          'static',          '{"value":"0.00"}',                                            false, true,  12, 'part_2'),
  ('vat_exempt_sales',    'VAT-Exempt Sales / Receipts',          'static',          '{"value":"0.00"}',                                            false, true,  13, 'part_2'),
  ('total_sales',         'Total Sales / Receipts',               'computed',        '{"formula":"field:taxable_sales + field:zero_rated_sales + field:vat_exempt_sales"}', false, false, 14, 'part_2'),
  ('input_tax_cf',        'Input Tax Carried Forward',            'static',          '{"value":"0.00"}',                                            false, true,  20, 'part_3'),
  ('current_input_tax',   'Current Quarter Creditable Input Tax', 'static',          '{"value":"0.00"}',                                            true,  true,  21, 'part_3'),
  ('total_input_tax',     'Total Available Input Tax',            'computed',        '{"formula":"field:input_tax_cf + field:current_input_tax"}', false, false, 22, 'part_3'),
  ('input_tax_applied',   'Input Tax Applied Against Output Tax', 'computed',        '{"formula":"Math.min(field:total_input_tax, field:output_tax)"}', false, false, 23, 'part_3'),
  ('excess_input_tax',    'Excess Input Tax Carried Over',        'computed',        '{"formula":"Math.max(0, field:total_input_tax - field:output_tax)"}', false, false, 24, 'part_3'),
  ('vat_payable',         'VAT Payable / (Overpayment)',          'computed',        '{"formula":"Math.max(0, field:output_tax - field:total_input_tax)"}', true,  false, 30, 'part_4'),
  ('tax_credits',         'Less: Tax Credits / Payments',         'static',          '{"value":"0.00"}',                                            false, true,  31, 'part_4'),
  ('net_vat_payable',     'Net VAT Payable',                      'computed',        '{"formula":"Math.max(0, field:vat_payable - field:tax_credits)"}', false, false, 32, 'part_4'),
  ('surcharge',           'Add: Surcharge',                       'static',          '{"value":"0.00"}',                                            false, true,  33, 'part_4'),
  ('interest',            'Add: Interest',                        'static',          '{"value":"0.00"}',                                            false, true,  34, 'part_4'),
  ('compromise',          'Add: Compromise Penalty',              'static',          '{"value":"0.00"}',                                            false, true,  35, 'part_4'),
  ('total_amount_due',    'Total Amount Due',                     'computed',        '{"formula":"field:net_vat_payable + field:surcharge + field:interest + field:compromise"}', true, false, 36, 'part_4')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '2550Q' AND t.is_current = true;

-- =====================================================================
-- 2550M — Monthly VAT Declaration
-- =====================================================================
INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type,
       v.mapping_expression::jsonb, v.is_required, v.is_editable,
       v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin',                 'Taxpayer Identification Number',       'client_field',    '{"field":"tin"}',                                             true,  false,  1, 'part_1'),
  ('taxpayer_name',       'Taxpayer''s Name / Business Name',     'client_field',    '{"field":"business_name"}',                                   true,  false,  2, 'part_1'),
  ('month',               'Month',                                'period_part',     '{"part":"month"}',                                            true,  false,  3, 'part_1'),
  ('year',                'Year',                                 'period_part',     '{"part":"year"}',                                             true,  false,  4, 'part_1'),
  ('taxable_sales',       'Taxable Sales / Receipts',             'sum_account_type','{"account_type":"revenue","transaction_type":"credit"}',      true,  true,  10, 'part_2'),
  ('output_tax',          'Output Tax (12%)',                     'computed',        '{"formula":"field:taxable_sales * 0.12"}',                    false, false, 11, 'part_2'),
  ('zero_rated_sales',    'Zero-Rated Sales / Receipts',          'static',          '{"value":"0.00"}',                                            false, true,  12, 'part_2'),
  ('vat_exempt_sales',    'VAT-Exempt Sales / Receipts',          'static',          '{"value":"0.00"}',                                            false, true,  13, 'part_2'),
  ('input_tax',           'Current Month Creditable Input Tax',   'static',          '{"value":"0.00"}',                                            true,  true,  20, 'part_3'),
  ('vat_payable',         'VAT Payable',                          'computed',        '{"formula":"Math.max(0, field:output_tax - field:input_tax)"}', true,  false, 21, 'part_3'),
  ('tax_credits',         'Less: Tax Credits / Payments',         'static',          '{"value":"0.00"}',                                            false, true,  22, 'part_3'),
  ('net_vat_payable',     'Net VAT Payable',                      'computed',        '{"formula":"Math.max(0, field:vat_payable - field:tax_credits)"}', false, false, 23, 'part_3'),
  ('total_amount_due',    'Total Amount Due',                     'computed',        '{"formula":"field:net_vat_payable"}',                         true,  false, 24, 'part_3')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '2550M' AND t.is_current = true;

-- =====================================================================
-- 2551Q — Quarterly Percentage Tax
-- =====================================================================
INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type,
       v.mapping_expression::jsonb, v.is_required, v.is_editable,
       v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin',                 'Taxpayer Identification Number',       'client_field',    '{"field":"tin"}',                                             true,  false,  1, 'part_1'),
  ('taxpayer_name',       'Taxpayer''s Name / Business Name',     'client_field',    '{"field":"business_name"}',                                   true,  false,  2, 'part_1'),
  ('quarter',             'Quarter',                              'period_part',     '{"part":"quarter"}',                                          true,  false,  3, 'part_1'),
  ('year',                'Year',                                 'period_part',     '{"part":"year"}',                                             true,  false,  4, 'part_1'),
  ('gross_receipts',      'Gross Receipts / Sales',               'sum_account_type','{"account_type":"revenue","transaction_type":"credit"}',      true,  true,  10, 'part_2'),
  ('tax_rate',            'Tax Rate',                             'static',          '{"value":"3%"}',                                              false, false, 11, 'part_2'),
  ('percentage_tax',      'Percentage Tax Due',                   'computed',        '{"formula":"field:gross_receipts * 0.03"}',                   true,  false, 12, 'part_2'),
  ('tax_credits',         'Less: Tax Credits / Payments',         'static',          '{"value":"0.00"}',                                            false, true,  13, 'part_2'),
  ('net_tax_payable',     'Net Tax Payable',                      'computed',        '{"formula":"Math.max(0, field:percentage_tax - field:tax_credits)"}', false, false, 14, 'part_2'),
  ('surcharge',           'Add: Surcharge',                       'static',          '{"value":"0.00"}',                                            false, true,  15, 'part_2'),
  ('interest',            'Add: Interest',                        'static',          '{"value":"0.00"}',                                            false, true,  16, 'part_2'),
  ('total_amount_due',    'Total Amount Due',                     'computed',        '{"formula":"field:net_tax_payable + field:surcharge + field:interest"}', true, false, 17, 'part_2')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '2551Q' AND t.is_current = true;

-- =====================================================================
-- 1701 — Annual Individual Income Tax Return
-- =====================================================================
INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type,
       v.mapping_expression::jsonb, v.is_required, v.is_editable,
       v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin',                   'Taxpayer Identification Number',     'client_field',    '{"field":"tin"}',                                             true,  false,  1, 'part_1'),
  ('taxpayer_name',         'Taxpayer''s Name',                   'client_field',    '{"field":"business_name"}',                                   true,  false,  2, 'part_1'),
  ('registered_address',    'Registered Address',                 'client_field',    '{"field":"registered_address"}',                              true,  false,  3, 'part_1'),
  ('year',                  'Taxable Year',                       'period_part',     '{"part":"year"}',                                             true,  false,  4, 'part_1'),
  ('gross_compensation',    'Gross Compensation Income',          'static',          '{"value":"0.00"}',                                            false, true,  10, 'part_2'),
  ('gross_business_income', 'Gross Business Income',              'sum_account_type','{"account_type":"revenue","transaction_type":"credit"}',      true,  true,  11, 'part_2'),
  ('total_gross_income',    'Total Gross Income',                 'computed',        '{"formula":"field:gross_compensation + field:gross_business_income"}', true, false, 12, 'part_2'),
  ('allowable_deductions',  'Less: Allowable Deductions',         'sum_account_type','{"account_type":"expense","transaction_type":"debit"}',       false, true,  13, 'part_2'),
  ('taxable_income',        'Taxable Income',                     'computed',        '{"formula":"Math.max(0, field:total_gross_income - field:allowable_deductions)"}', true, false, 14, 'part_2'),
  ('income_tax_due',        'Income Tax Due',                     'computed',        '{"formula":"field:taxable_income * 0.25"}',                   true,  false, 15, 'part_2'),
  ('quarterly_payments',    'Total Quarterly Payments Made',      'static',          '{"value":"0.00"}',                                            false, true,  20, 'part_3'),
  ('creditable_wt',         'Creditable Withholding Tax',         'static',          '{"value":"0.00"}',                                            false, true,  21, 'part_3'),
  ('total_tax_credits',     'Total Tax Credits / Payments',       'computed',        '{"formula":"field:quarterly_payments + field:creditable_wt"}', false, false, 22, 'part_3'),
  ('tax_still_due',         'Tax Still Due / (Overpayment)',      'computed',        '{"formula":"field:income_tax_due - field:total_tax_credits"}', true,  false, 23, 'part_3'),
  ('surcharge',             'Add: Surcharge',                     'static',          '{"value":"0.00"}',                                            false, true,  24, 'part_3'),
  ('interest',              'Add: Interest',                      'static',          '{"value":"0.00"}',                                            false, true,  25, 'part_3'),
  ('total_amount_due',      'Total Amount Due',                   'computed',        '{"formula":"Math.max(0, field:tax_still_due) + field:surcharge + field:interest"}', true, false, 26, 'part_3')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '1701' AND t.is_current = true;

-- =====================================================================
-- 1701Q — Quarterly Individual Income Tax Return
-- =====================================================================
INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type,
       v.mapping_expression::jsonb, v.is_required, v.is_editable,
       v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin',                  'Taxpayer Identification Number',     'client_field',    '{"field":"tin"}',                                             true,  false,  1, 'part_1'),
  ('taxpayer_name',        'Taxpayer''s Name / Business Name',   'client_field',    '{"field":"business_name"}',                                   true,  false,  2, 'part_1'),
  ('quarter',              'Quarter',                            'period_part',     '{"part":"quarter"}',                                          true,  false,  3, 'part_1'),
  ('year',                 'Year',                               'period_part',     '{"part":"year"}',                                             true,  false,  4, 'part_1'),
  ('gross_income',         'Total Gross Income',                 'sum_account_type','{"account_type":"revenue","transaction_type":"credit"}',      true,  true,  10, 'part_2'),
  ('allowable_deductions', 'Less: Allowable Deductions',         'sum_account_type','{"account_type":"expense","transaction_type":"debit"}',       false, true,  11, 'part_2'),
  ('taxable_income',       'Taxable Income',                     'computed',        '{"formula":"Math.max(0, field:gross_income - field:allowable_deductions)"}', true, false, 12, 'part_2'),
  ('income_tax_due',       'Income Tax Due',                     'computed',        '{"formula":"field:taxable_income * 0.25"}',                   true,  false, 13, 'part_2'),
  ('prior_quarter_tax',    'Less: Tax Paid in Prior Quarters',   'static',          '{"value":"0.00"}',                                            false, true,  14, 'part_2'),
  ('net_tax_payable',      'Net Tax Payable',                    'computed',        '{"formula":"Math.max(0, field:income_tax_due - field:prior_quarter_tax)"}', true, false, 15, 'part_2'),
  ('total_amount_due',     'Total Amount Due',                   'computed',        '{"formula":"field:net_tax_payable"}',                         true,  false, 16, 'part_2')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '1701Q' AND t.is_current = true;

-- =====================================================================
-- 1702 — Annual Corporate Income Tax Return
-- =====================================================================
INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type,
       v.mapping_expression::jsonb, v.is_required, v.is_editable,
       v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin',                  'Taxpayer Identification Number',     'client_field',    '{"field":"tin"}',                                             true,  false,  1, 'part_1'),
  ('corporation_name',     'Corporation / Partnership Name',     'client_field',    '{"field":"business_name"}',                                   true,  false,  2, 'part_1'),
  ('registered_address',   'Registered Address',                 'client_field',    '{"field":"registered_address"}',                              true,  false,  3, 'part_1'),
  ('fiscal_year_end',      'Fiscal Year End',                    'period_part',     '{"part":"fiscal_year_end"}',                                  true,  false,  4, 'part_1'),
  ('gross_revenue',        'Gross Revenue / Receipts',           'sum_account_type','{"account_type":"revenue","transaction_type":"credit"}',      true,  true,  10, 'part_2'),
  ('cost_of_sales',        'Less: Cost of Sales / Services',     'static',          '{"value":"0.00"}',                                            true,  true,  11, 'part_2'),
  ('gross_income',         'Gross Income',                       'computed',        '{"formula":"field:gross_revenue - field:cost_of_sales"}',     true,  false, 12, 'part_2'),
  ('operating_expenses',   'Less: Operating Expenses',           'sum_account_type','{"account_type":"expense","transaction_type":"debit"}',       false, true,  13, 'part_2'),
  ('taxable_income',       'Net Taxable Income',                 'computed',        '{"formula":"Math.max(0, field:gross_income - field:operating_expenses)"}', true, false, 14, 'part_2'),
  ('income_tax_due',       'Normal Corporate Income Tax (NCIT)', 'computed',        '{"formula":"field:taxable_income * 0.25"}',                   true,  false, 20, 'part_3'),
  ('mcit',                 'Minimum Corporate Income Tax (MCIT)', 'computed',       '{"formula":"field:gross_income * 0.02"}',                     false, false, 21, 'part_3'),
  ('tax_due',              'Income Tax Due',                     'computed',        '{"formula":"Math.max(field:income_tax_due, field:mcit)"}',    true,  false, 22, 'part_3'),
  ('quarterly_payments',   'Less: Quarterly Payments',           'static',          '{"value":"0.00"}',                                            false, true,  23, 'part_3'),
  ('creditable_wt',        'Less: Creditable Withholding Tax',   'static',          '{"value":"0.00"}',                                            false, true,  24, 'part_3'),
  ('tax_still_due',        'Tax Still Due / (Overpayment)',      'computed',        '{"formula":"field:tax_due - field:quarterly_payments - field:creditable_wt"}', true, false, 25, 'part_3'),
  ('surcharge',            'Add: Surcharge',                     'static',          '{"value":"0.00"}',                                            false, true,  26, 'part_3'),
  ('interest',             'Add: Interest',                      'static',          '{"value":"0.00"}',                                            false, true,  27, 'part_3'),
  ('total_amount_due',     'Total Amount Due',                   'computed',        '{"formula":"Math.max(0, field:tax_still_due) + field:surcharge + field:interest"}', true, false, 28, 'part_3')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '1702' AND t.is_current = true;

-- =====================================================================
-- 1702Q — Quarterly Corporate Income Tax Return
-- =====================================================================
INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type,
       v.mapping_expression::jsonb, v.is_required, v.is_editable,
       v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin',                  'Taxpayer Identification Number',     'client_field',    '{"field":"tin"}',                                             true,  false,  1, 'part_1'),
  ('corporation_name',     'Corporation / Partnership Name',     'client_field',    '{"field":"business_name"}',                                   true,  false,  2, 'part_1'),
  ('quarter',              'Quarter',                            'period_part',     '{"part":"quarter"}',                                          true,  false,  3, 'part_1'),
  ('fiscal_year_end',      'Fiscal Year End',                    'period_part',     '{"part":"fiscal_year_end"}',                                  true,  false,  4, 'part_1'),
  ('gross_income',         'Cumulative Gross Income',            'sum_account_type','{"account_type":"revenue","transaction_type":"credit"}',      true,  true,  10, 'part_2'),
  ('allowable_deductions', 'Cumulative Allowable Deductions',    'sum_account_type','{"account_type":"expense","transaction_type":"debit"}',       false, true,  11, 'part_2'),
  ('taxable_income',       'Cumulative Net Taxable Income',      'computed',        '{"formula":"Math.max(0, field:gross_income - field:allowable_deductions)"}', true, false, 12, 'part_2'),
  ('income_tax_due',       'Cumulative Income Tax Due',          'computed',        '{"formula":"field:taxable_income * 0.25"}',                   true,  false, 13, 'part_2'),
  ('prior_quarter_tax',    'Less: Tax Paid in Prior Quarters',   'static',          '{"value":"0.00"}',                                            false, true,  14, 'part_2'),
  ('net_tax_payable',      'Net Tax Payable',                    'computed',        '{"formula":"Math.max(0, field:income_tax_due - field:prior_quarter_tax)"}', true, false, 15, 'part_2'),
  ('total_amount_due',     'Total Amount Due',                   'computed',        '{"formula":"field:net_tax_payable"}',                         true,  false, 16, 'part_2')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '1702Q' AND t.is_current = true;

-- =====================================================================
-- 1601-C — Monthly Remittance of Compensation Withholding
-- =====================================================================
INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type,
       v.mapping_expression::jsonb, v.is_required, v.is_editable,
       v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin',                 'Taxpayer Identification Number',     'client_field',    '{"field":"tin"}',                                             true,  false,  1, 'part_1'),
  ('taxpayer_name',       'Taxpayer''s Name / Business Name',   'client_field',    '{"field":"business_name"}',                                   true,  false,  2, 'part_1'),
  ('month',               'Month',                              'period_part',     '{"part":"month"}',                                            true,  false,  3, 'part_1'),
  ('year',                'Year',                               'period_part',     '{"part":"year"}',                                             true,  false,  4, 'part_1'),
  ('total_compensation',  'Total Compensation Paid',            'static',          '{"value":"0.00"}',                                            true,  true,  10, 'part_2'),
  ('total_employees',     'Number of Employees',                'static',          '{"value":"0"}',                                               true,  true,  11, 'part_2'),
  ('tax_withheld',        'Total Tax Withheld on Compensation', 'static',          '{"value":"0.00"}',                                            true,  true,  12, 'part_2'),
  ('tax_remitted',        'Less: Tax Remitted in Prior Month',  'static',          '{"value":"0.00"}',                                            false, true,  13, 'part_2'),
  ('net_tax_due',         'Net Tax Due',                        'computed',        '{"formula":"Math.max(0, field:tax_withheld - field:tax_remitted)"}', true, false, 14, 'part_2'),
  ('surcharge',           'Add: Surcharge',                     'static',          '{"value":"0.00"}',                                            false, true,  15, 'part_2'),
  ('interest',            'Add: Interest',                      'static',          '{"value":"0.00"}',                                            false, true,  16, 'part_2'),
  ('total_amount_due',    'Total Amount Due',                   'computed',        '{"formula":"field:net_tax_due + field:surcharge + field:interest"}', true, false, 17, 'part_2')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '1601-C' AND t.is_current = true;

-- =====================================================================
-- 1601-EQ — Quarterly Remittance of Expanded Withholding
-- =====================================================================
INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type,
       v.mapping_expression::jsonb, v.is_required, v.is_editable,
       v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin',                      'Taxpayer Identification Number', 'client_field', '{"field":"tin"}',                                                 true,  false,  1, 'part_1'),
  ('taxpayer_name',            'Taxpayer''s Name',               'client_field', '{"field":"business_name"}',                                       true,  false,  2, 'part_1'),
  ('quarter',                  'Quarter',                        'period_part',  '{"part":"quarter"}',                                              true,  false,  3, 'part_1'),
  ('year',                     'Year',                           'period_part',  '{"part":"year"}',                                                 true,  false,  4, 'part_1'),
  ('professional_fees_income', 'Professional Fees — Income',     'static',       '{"value":"0.00"}',                                                false, true,  10, 'part_2'),
  ('professional_fees_tax',    'Professional Fees — Tax Withheld','static',      '{"value":"0.00"}',                                                false, true,  11, 'part_2'),
  ('rental_income',            'Rent — Income Payments',         'static',       '{"value":"0.00"}',                                                false, true,  12, 'part_2'),
  ('rental_tax',               'Rent — Tax Withheld',            'static',       '{"value":"0.00"}',                                                false, true,  13, 'part_2'),
  ('other_income',             'Other Income Payments',          'static',       '{"value":"0.00"}',                                                false, true,  14, 'part_2'),
  ('other_tax',                'Other Tax Withheld',             'static',       '{"value":"0.00"}',                                                false, true,  15, 'part_2'),
  ('total_tax_withheld',       'Total Tax Withheld',             'computed',     '{"formula":"field:professional_fees_tax + field:rental_tax + field:other_tax"}', true, false, 16, 'part_2'),
  ('total_amount_due',         'Total Amount Due',               'computed',     '{"formula":"field:total_tax_withheld"}',                          true,  false, 17, 'part_2')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '1601-EQ' AND t.is_current = true;

-- =====================================================================
-- 0619-E — Monthly Remittance of Expanded Withholding
-- =====================================================================
INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type,
       v.mapping_expression::jsonb, v.is_required, v.is_editable,
       v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin',                   'Taxpayer Identification Number',   'client_field', '{"field":"tin"}',                                               true,  false,  1, 'part_1'),
  ('taxpayer_name',         'Taxpayer''s Name / Business Name', 'client_field', '{"field":"business_name"}',                                     true,  false,  2, 'part_1'),
  ('month',                 'Month',                            'period_part',  '{"part":"month"}',                                              true,  false,  3, 'part_1'),
  ('year',                  'Year',                             'period_part',  '{"part":"year"}',                                               true,  false,  4, 'part_1'),
  ('total_income_payments', 'Total Income Payments',            'static',       '{"value":"0.00"}',                                              true,  true,  10, 'part_2'),
  ('total_tax_withheld',    'Total Tax Withheld',               'static',       '{"value":"0.00"}',                                              true,  true,  11, 'part_2'),
  ('tax_remitted',          'Less: Amount Remitted Previously', 'static',       '{"value":"0.00"}',                                              false, true,  12, 'part_2'),
  ('net_tax_due',           'Net Tax Due',                      'computed',     '{"formula":"Math.max(0, field:total_tax_withheld - field:tax_remitted)"}', true, false, 13, 'part_2'),
  ('surcharge',             'Add: Surcharge',                   'static',       '{"value":"0.00"}',                                              false, true,  14, 'part_2'),
  ('interest',              'Add: Interest',                    'static',       '{"value":"0.00"}',                                              false, true,  15, 'part_2'),
  ('total_amount_due',      'Total Amount Due',                 'computed',     '{"formula":"field:net_tax_due + field:surcharge + field:interest"}', true, false, 16, 'part_2')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '0619-E' AND t.is_current = true;

-- =====================================================================
-- 0619-F — Monthly Remittance of Final Withholding
-- =====================================================================
INSERT INTO bir_form_field_mappings
  (template_id, field_code, field_label, mapping_type, mapping_expression,
   is_required, is_editable, display_order, section)
SELECT t.id, v.field_code, v.field_label, v.mapping_type,
       v.mapping_expression::jsonb, v.is_required, v.is_editable,
       v.display_order, v.section
FROM bir_form_templates t
CROSS JOIN (VALUES
  ('tin',                'Taxpayer Identification Number',   'client_field', '{"field":"tin"}',                                                    true,  false,  1, 'part_1'),
  ('taxpayer_name',      'Taxpayer''s Name / Business Name', 'client_field', '{"field":"business_name"}',                                          true,  false,  2, 'part_1'),
  ('month',              'Month',                            'period_part',  '{"part":"month"}',                                                   true,  false,  3, 'part_1'),
  ('year',               'Year',                             'period_part',  '{"part":"year"}',                                                    true,  false,  4, 'part_1'),
  ('dividends_income',   'Dividends — Income Payments',      'static',       '{"value":"0.00"}',                                                   false, true,  10, 'part_2'),
  ('dividends_tax',      'Dividends — Tax Withheld',         'static',       '{"value":"0.00"}',                                                   false, true,  11, 'part_2'),
  ('interest_income',    'Interest — Income Payments',       'static',       '{"value":"0.00"}',                                                   false, true,  12, 'part_2'),
  ('interest_tax',       'Interest — Tax Withheld',          'static',       '{"value":"0.00"}',                                                   false, true,  13, 'part_2'),
  ('royalties_income',   'Royalties — Income Payments',      'static',       '{"value":"0.00"}',                                                   false, true,  14, 'part_2'),
  ('royalties_tax',      'Royalties — Tax Withheld',         'static',       '{"value":"0.00"}',                                                   false, true,  15, 'part_2'),
  ('total_tax_withheld', 'Total Final Withholding Tax',      'computed',     '{"formula":"field:dividends_tax + field:interest_tax + field:royalties_tax"}', true, false, 16, 'part_2'),
  ('surcharge',          'Add: Surcharge',                   'static',       '{"value":"0.00"}',                                                   false, true,  17, 'part_2'),
  ('interest',           'Add: Interest',                    'static',       '{"value":"0.00"}',                                                   false, true,  18, 'part_2'),
  ('total_amount_due',   'Total Amount Due',                 'computed',     '{"formula":"field:total_tax_withheld + field:surcharge + field:interest"}', true, false, 19, 'part_2')
) AS v(field_code, field_label, mapping_type, mapping_expression, is_required, is_editable, display_order, section)
WHERE t.form_number = '0619-F' AND t.is_current = true;
