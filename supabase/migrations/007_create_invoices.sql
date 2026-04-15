-- 007_create_invoices.sql
-- Client billing invoices and line items

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  subtotal numeric(15,2) NOT NULL,
  vat_amount numeric(15,2),
  total_amount numeric(15,2) NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  sent_at timestamptz,
  paid_at timestamptz,
  gmail_message_id text,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_client ON invoices(client_id, issue_date DESC);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status = 'sent';
CREATE INDEX idx_invoices_number ON invoices(invoice_number);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_all_authenticated"
  ON invoices FOR ALL
  USING (auth.role() = 'authenticated');

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Invoice line items — relational, not JSONB
CREATE TABLE invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL CHECK (quantity > 0),
  unit_price numeric(15,2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(15,2) NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED,
  display_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id, display_order);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "line_items_all_authenticated"
  ON invoice_line_items FOR ALL
  USING (auth.role() = 'authenticated');
