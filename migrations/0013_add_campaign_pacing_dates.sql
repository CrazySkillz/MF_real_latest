ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS pacing_start_date TEXT,
ADD COLUMN IF NOT EXISTS pacing_end_date TEXT;
