-- 019_add_client_contact_fields.sql
-- Add contact person and phone fields to clients

ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_phone text;
