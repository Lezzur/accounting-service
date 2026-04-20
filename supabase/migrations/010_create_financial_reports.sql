-- 010_create_financial_reports.sql
-- Metadata for generated financial reports; content rendered on demand from transactions

CREATE TABLE IF NOT EXISTS financial_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  report_type text NOT NULL CHECK (report_type IN (
    'profit_and_loss',
    'balance_sheet',
    'cash_flow',
    'bank_reconciliation',
    'ar_ageing',
    'ap_ageing',
    'general_ledger',
    'trial_balance'
  )),
  period_start date NOT NULL,
  period_end date NOT NULL,
  ai_narrative text,
  ai_narrative_approved boolean NOT NULL DEFAULT false,
  ai_narrative_approved_by uuid REFERENCES users(id),
  ai_narrative_approved_at timestamptz,
  exported_pdf_path text,
  exported_sheets_url text,
  generated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_client_type ON financial_reports(client_id, report_type, period_start DESC);

ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_reports_all_authenticated" ON financial_reports;
CREATE POLICY "financial_reports_all_authenticated"
  ON financial_reports FOR ALL
  USING (auth.role() = 'authenticated');
