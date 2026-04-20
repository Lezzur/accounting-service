-- Migration 015: Draft emails table for deadline reminder and client communication drafts

CREATE TABLE IF NOT EXISTS draft_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  deadline_id uuid REFERENCES deadlines(id) ON DELETE SET NULL,
  template_type text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'sent', 'discarded')),
  reviewed_by uuid REFERENCES users(id),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_draft_emails_client_deadline
  ON draft_emails(client_id, deadline_id);

CREATE INDEX IF NOT EXISTS idx_draft_emails_status
  ON draft_emails(status)
  WHERE status IN ('pending_review', 'approved');

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_draft_emails_updated_at ON draft_emails;
CREATE TRIGGER trg_draft_emails_updated_at
  BEFORE UPDATE ON draft_emails
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE draft_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS draft_emails_select ON draft_emails;
CREATE POLICY draft_emails_select ON draft_emails
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS draft_emails_insert ON draft_emails;
CREATE POLICY draft_emails_insert ON draft_emails
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS draft_emails_update ON draft_emails;
CREATE POLICY draft_emails_update ON draft_emails
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS draft_emails_delete ON draft_emails;
CREATE POLICY draft_emails_delete ON draft_emails
  FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS draft_emails_service_insert ON draft_emails;
CREATE POLICY draft_emails_service_insert ON draft_emails
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
