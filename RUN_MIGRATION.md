# Run Database Migration for sheet_name Column

## The Problem
The `sheet_name` column doesn't exist in your database, which is preventing multi-tab selection from working.

## The Solution
Run this SQL migration on your Render PostgreSQL database:

### Option 1: Via Render Dashboard
1. Go to your Render Dashboard
2. Click on your PostgreSQL database
3. Click "Connect" → "External Connection"
4. Copy the connection string
5. Use a PostgreSQL client (like pgAdmin, DBeaver, or psql) to connect
6. Run this SQL:

```sql
ALTER TABLE google_sheets_connections 
ADD COLUMN IF NOT EXISTS sheet_name TEXT;

COMMENT ON COLUMN google_sheets_connections.sheet_name IS 'Name of the specific tab/sheet within the spreadsheet to use for data fetching';
```

### Option 2: Via Render Shell
1. Go to your Render Dashboard
2. Click on your Web Service
3. Click "Shell" tab
4. Run:
```bash
psql $DATABASE_URL -c "ALTER TABLE google_sheets_connections ADD COLUMN IF NOT EXISTS sheet_name TEXT;"
```

### Verify the Migration
After running, verify with:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'google_sheets_connections';
```

You should see `sheet_name` with type `text` in the results.

## After Migration
1. Refresh your app
2. Try selecting multiple sheets again
3. All columns from all selected sheets will now appear!


