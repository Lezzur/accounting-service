-- 009_create_deadlines.sql
-- Auto-generated BIR and deliverable deadlines per client

CREATE TABLE deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  deadline_type text NOT NULL CHECK (deadline_type IN (
    'monthly_bookkeeping',
    'monthly_vat',
    'quarterly_bir',
    'quarterly_financials',
    'annual_itr',
    'annual_financials'
  )),
  due_date date NOT NULL,
  period_label text NOT NULL,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed')),
  completed_at timestamptz,
  completed_by uuid REFERENCES users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deadlines_client_due ON deadlines(client_id, due_date);
CREATE INDEX idx_deadlines_due_status ON deadlines(due_date, status) WHERE status != 'completed';
CREATE UNIQUE INDEX idx_deadlines_unique ON deadlines(client_id, deadline_type, period_label);

ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deadlines_all_authenticated"
  ON deadlines FOR ALL
  USING (auth.role() = 'authenticated');

CREATE TRIGGER trg_deadlines_updated_at
  BEFORE UPDATE ON deadlines
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
