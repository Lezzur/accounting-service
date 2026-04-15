-- 016_seed_chart_of_accounts.sql
-- Seed Philippine SMB chart of accounts
-- Idempotent: ON CONFLICT DO NOTHING — safe to re-run even though 004 already inserts this data

INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, display_order) VALUES
  -- Assets
  ('1000', 'Assets',                      'asset',     'debit',  1),
  ('1100', 'Cash and Cash Equivalents',   'asset',     'debit',  2),
  ('1110', 'Cash on Hand',                'asset',     'debit',  3),
  ('1120', 'Cash in Bank',                'asset',     'debit',  4),
  ('1200', 'Accounts Receivable',         'asset',     'debit',  5),
  ('1300', 'Inventory',                   'asset',     'debit',  6),
  ('1400', 'Prepaid Expenses',            'asset',     'debit',  7),
  ('1500', 'Property and Equipment',      'asset',     'debit',  8),
  -- Liabilities
  ('2000', 'Liabilities',                 'liability', 'credit', 20),
  ('2100', 'Accounts Payable',            'liability', 'credit', 21),
  ('2200', 'Accrued Expenses',            'liability', 'credit', 22),
  ('2300', 'Output VAT Payable',          'liability', 'credit', 23),
  ('2400', 'Income Tax Payable',          'liability', 'credit', 24),
  ('2500', 'Withholding Tax Payable',     'liability', 'credit', 25),
  ('2600', 'Loans Payable',               'liability', 'credit', 26),
  -- Equity
  ('3000', 'Equity',                      'equity',    'credit', 30),
  ('3100', 'Owner''s Capital',            'equity',    'credit', 31),
  ('3200', 'Retained Earnings',           'equity',    'credit', 32),
  ('3300', 'Owner''s Withdrawals',        'equity',    'debit',  33),
  -- Revenue
  ('4000', 'Revenue',                     'revenue',   'credit', 40),
  ('4100', 'Service Revenue',             'revenue',   'credit', 41),
  ('4200', 'Sales Revenue',               'revenue',   'credit', 42),
  ('4300', 'Other Income',                'revenue',   'credit', 43),
  -- Expenses
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

-- Set parent_code hierarchy (idempotent UPDATEs — safe to re-run)
UPDATE chart_of_accounts SET parent_code = '1000' WHERE code IN ('1100', '1200', '1300', '1400', '1500') AND parent_code IS DISTINCT FROM '1000';
UPDATE chart_of_accounts SET parent_code = '1100' WHERE code IN ('1110', '1120')                         AND parent_code IS DISTINCT FROM '1100';
UPDATE chart_of_accounts SET parent_code = '2000' WHERE code IN ('2100', '2200', '2300', '2400', '2500', '2600') AND parent_code IS DISTINCT FROM '2000';
UPDATE chart_of_accounts SET parent_code = '3000' WHERE code IN ('3100', '3200', '3300')                AND parent_code IS DISTINCT FROM '3000';
UPDATE chart_of_accounts SET parent_code = '4000' WHERE code IN ('4100', '4200', '4300')                AND parent_code IS DISTINCT FROM '4000';
UPDATE chart_of_accounts SET parent_code = '5000' WHERE code IN ('5100', '5200', '5300', '5400', '5500', '5600', '5700', '5800', '5900', '5950', '5990') AND parent_code IS DISTINCT FROM '5000';
