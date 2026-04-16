-- 019_add_client_contact_fields.sql
-- Add contact person and phone fields to clients

ALTER TABLE clients ADD COLUMN contact_name text;
ALTER TABLE clients ADD COLUMN contact_phone text;
ALTER TABLE clients ADD COLUMN business_phone text;
