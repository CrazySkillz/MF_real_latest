-- Migration: Add sheet_name column to google_sheets_connections table
-- This migration adds support for selecting specific tabs/sheets from Google Spreadsheets

-- Add the sheet_name column (nullable, as existing records won't have this)
ALTER TABLE google_sheets_connections 
ADD COLUMN IF NOT EXISTS sheet_name TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN google_sheets_connections.sheet_name IS 'Name of the specific tab/sheet within the spreadsheet to use for data fetching';

