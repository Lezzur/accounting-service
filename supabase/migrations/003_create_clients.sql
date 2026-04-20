-- 003_create_clients.sql
-- Clients, Gmail connections, and client activity log

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  business_type text NOT NULL CHECK (business_type IN ('sole_prop', 'opc', 'corporation')),
  tin text NOT NULL CHECK (tin ~ '^\d{3}-\d{3}-\d{3}(-\d{3})?$'),
  registered_address text NOT NULL,
  industry text NOT NULL,
  bir_registration_type text NOT NULL CHECK (bir_registration_type IN ('vat', 'non_vat')),
  fiscal_year_start_month smallint NOT NULL CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  gmail_address text NOT NULL UNIQUE,
  monthly_revenue_bracket text NOT NULL CHECK (monthly_revenue_bracket IN ('below_250k', '250k_500k', '500k_1m', '1m_3m', 'above_3m')),
  google_sheet_folder_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  converted_from_lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_gmail ON clients(gmail_address);
CREATE INDEX IF NOT EXISTS idx_clients_business_name ON clients(business_name);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_all_authenticated" ON clients;
CREATE POLICY "clients_all_authenticated"
  ON clients FOR ALL
  USING (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Gmail OAuth token storage
CREATE TABLE IF NOT EXISTS gmail_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  gmail_email text NOT NULL UNIQUE,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  watch_expiration timestamptz,
  watch_history_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'token_expired', 'revoked', 'error')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gmail_connections_status ON gmail_connections(status);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_watch_exp ON gmail_connections(watch_expiration);

ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gmail_connections_admin_select" ON gmail_connections;
CREATE POLICY "gmail_connections_admin_select"
  ON gmail_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "gmail_connections_admin_update" ON gmail_connections;
CREATE POLICY "gmail_connections_admin_update"
  ON gmail_connections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS trg_gmail_connections_updated_at ON gmail_connections;
CREATE TRIGGER trg_gmail_connections_updated_at
  BEFORE UPDATE ON gmail_connections
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Client activity log: immutable audit trail
CREATE TABLE IF NOT EXISTS client_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  performed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_activity_client_id ON client_activity_log(client_id, created_at DESC);

ALTER TABLE client_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_activity_select_authenticated" ON client_activity_log;
CREATE POLICY "client_activity_select_authenticated"
  ON client_activity_log FOR SELECT
  USING (auth.role() = 'authenticated');
