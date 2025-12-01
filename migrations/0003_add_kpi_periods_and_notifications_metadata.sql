-- KPI Period Tracking and Notifications Enhancement
-- This migration adds period tracking for KPIs and metadata support for notifications

-- 1. Create KPI Periods table for historical tracking
CREATE TABLE IF NOT EXISTS kpi_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id TEXT NOT NULL,
  
  -- Period information
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  period_label TEXT NOT NULL, -- 'March 2024', 'Q1 2024', 'Week 12 2024'
  
  -- Snapshot values at end of period
  final_value DECIMAL(10, 2) NOT NULL,
  target_value DECIMAL(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  
  -- Performance metrics
  target_achieved BOOLEAN NOT NULL,
  performance_percentage DECIMAL(5, 2), -- e.g., 104% = exceeded by 4%
  performance_level TEXT, -- 'excellent', 'good', 'fair', 'poor'
  
  -- Comparison with previous period
  previous_period_value DECIMAL(10, 2),
  change_amount DECIMAL(10, 2),
  change_percentage DECIMAL(5, 2),
  trend_direction TEXT, -- 'up', 'down', 'stable'
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_kpi_periods_kpi_id ON kpi_periods(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_periods_dates ON kpi_periods(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_kpi_periods_type ON kpi_periods(period_type);

-- 3. Add metadata column to notifications for KPI action URLs
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 4. Add index for metadata queries
CREATE INDEX IF NOT EXISTS idx_notifications_metadata ON notifications USING GIN (metadata);

-- 5. Add comments for documentation
COMMENT ON TABLE kpi_periods IS 'Historical snapshots of KPI performance by period';
COMMENT ON COLUMN kpi_periods.period_label IS 'Human-readable period label (e.g., March 2024)';
COMMENT ON COLUMN kpi_periods.performance_percentage IS 'Percentage of target achieved (e.g., 104 = 4% over target)';
COMMENT ON COLUMN kpi_periods.change_percentage IS 'Percentage change from previous period';
COMMENT ON COLUMN notifications.metadata IS 'JSON metadata for action URLs and additional context';

