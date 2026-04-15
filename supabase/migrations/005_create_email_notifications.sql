-- 005_create_email_notifications.sql
-- Email notification pipeline and document attachments

CREATE TABLE email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id text NOT NULL UNIQUE,
  gmail_thread_id text,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  sender_email text NOT NULL,
  sender_name text,
  subject text NOT NULL,
  snippet text,
  received_at timestamptz NOT NULL,
  document_type_guess text CHECK (document_type_guess IN ('receipt', 'bank_statement', 'invoice', 'credit_card_statement', 'expense_report', 'payroll_data', 'other')),
  classification_confidence numeric(3,2) CHECK (classification_confidence BETWEEN 0 AND 1),
  is_document boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'unprocessed' CHECK (status IN ('unprocessed', 'processing', 'processed', 'failed', 'dismissed')),
  auto_dismissed boolean NOT NULL DEFAULT false,
  processing_error text,
  processing_started_at timestamptz,
  processed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_notif_gmail_msg_id ON email_notifications(gmail_message_id);
CREATE INDEX idx_email_notif_status ON email_notifications(status) WHERE status = 'unprocessed';
CREATE INDEX idx_email_notif_client_id ON email_notifications(client_id, received_at DESC);
CREATE INDEX idx_email_notif_received_at ON email_notifications(received_at DESC);

ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_notif_select_authenticated"
  ON email_notifications FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE TRIGGER trg_email_notif_updated_at
  BEFORE UPDATE ON email_notifications
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Document attachments stored in Supabase Storage
CREATE TABLE document_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_notification_id uuid NOT NULL REFERENCES email_notifications(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes integer NOT NULL,
  page_count smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_attach_email_notif ON document_attachments(email_notification_id);

ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_attach_select_authenticated"
  ON document_attachments FOR SELECT
  USING (auth.role() = 'authenticated');
