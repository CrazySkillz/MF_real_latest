-- Make email column nullable in custom_integrations table
-- This allows manual PDF uploads without requiring an email address

ALTER TABLE custom_integrations ALTER COLUMN email DROP NOT NULL;

