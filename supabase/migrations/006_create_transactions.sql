-- 006_create_transactions.sql
-- Core financial transactions and AI correction audit trail

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  date date NOT NULL,
  description text NOT NULL CHECK (length(description) <= 255),
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'PHP',
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  category_code text REFERENCES chart_of_accounts(code),
  category_confidence numeric(3,2) CHECK (category_confidence BETWEEN 0 AND 1),
  source_email_notification_id uuid REFERENCES email_notifications(id) ON DELETE SET NULL,
  source_document_attachment_id uuid REFERENCES document_attachments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'manual_entry_required')),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  rejection_reason text,
  extraction_batch_id uuid,
  extraction_page_number smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_txn_client_date ON transactions(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_txn_client_status ON transactions(client_id, status);
CREATE INDEX IF NOT EXISTS idx_txn_status ON transactions(status) WHERE status IN ('pending', 'in_review', 'manual_entry_required');
CREATE INDEX IF NOT EXISTS idx_txn_category_code ON transactions(category_code);
CREATE INDEX IF NOT EXISTS idx_txn_source_email ON transactions(source_email_notification_id);
CREATE INDEX IF NOT EXISTS idx_txn_client_date_range ON transactions(client_id, date, status);
CREATE INDEX IF NOT EXISTS idx_txn_extraction_batch ON transactions(extraction_batch_id) WHERE extraction_batch_id IS NOT NULL;

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "txn_select_authenticated" ON transactions;
CREATE POLICY "txn_select_authenticated"
  ON transactions FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "txn_insert_authenticated" ON transactions;
CREATE POLICY "txn_insert_authenticated"
  ON transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "txn_update_authenticated" ON transactions;
CREATE POLICY "txn_update_authenticated"
  ON transactions FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "txn_delete_admin" ON transactions;
CREATE POLICY "txn_delete_admin"
  ON transactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- AI correction audit trail
CREATE TABLE IF NOT EXISTS ai_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  original_value text NOT NULL,
  corrected_value text NOT NULL,
  corrected_by uuid NOT NULL REFERENCES users(id),
  correction_source text NOT NULL DEFAULT 'manual' CHECK (correction_source IN ('manual', 'bulk_edit')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_corrections_txn ON ai_corrections(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ai_corrections_field ON ai_corrections(field_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_corrections_created ON ai_corrections(created_at DESC);

ALTER TABLE ai_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_corrections_select_authenticated" ON ai_corrections;
CREATE POLICY "ai_corrections_select_authenticated"
  ON ai_corrections FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ai_corrections_insert_authenticated" ON ai_corrections;
CREATE POLICY "ai_corrections_insert_authenticated"
  ON ai_corrections FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ai_corrections_delete_admin" ON ai_corrections;
CREATE POLICY "ai_corrections_delete_admin"
  ON ai_corrections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );
