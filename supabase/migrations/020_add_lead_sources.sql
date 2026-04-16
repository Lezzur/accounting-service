-- 020_add_lead_sources.sql
-- Add google and facebook as lead sources

ALTER TABLE leads DROP CONSTRAINT leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN ('website_form', 'cal_booking', 'referral', 'manual', 'google', 'facebook'));
