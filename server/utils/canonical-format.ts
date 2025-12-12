/**
 * Canonical Format
 * Phase 6: Standardized output schema for all platforms
 */

export interface CanonicalRow {
  // Core identifiers
  campaign_name: string;
  platform: string;
  date: Date | string;
  
  // Performance metrics
  impressions?: number | null;
  clicks?: number | null;
  spend?: number | null;
  conversions?: number | null;
  leads?: number | null;
  engagements?: number | null;
  
  // Revenue metrics
  revenue?: number | null;
  conversion_value?: number | null;
  
  // Calculated metrics (optional, can be computed)
  ctr?: number | null; // Click-through rate
  cpc?: number | null; // Cost per click
  cpm?: number | null; // Cost per mille (1000 impressions)
  cpa?: number | null; // Cost per acquisition
  roas?: number | null; // Return on ad spend
  roi?: number | null; // Return on investment
  
  // Metadata
  _source?: string; // 'google_sheets', 'linkedin_api', etc.
  _enriched?: boolean;
  _confidence?: number; // 0-1, data quality confidence
}

/**
 * Convert a transformed row to canonical format
 */
export function toCanonicalFormat(
  row: any,
  source: string = 'google_sheets',
  confidence: number = 1.0
): CanonicalRow {
  const canonical: CanonicalRow = {
    campaign_name: String(row.campaign_name || ''),
    platform: String(row.platform || ''),
    date: row.date || new Date(),
    _source: source,
    _confidence: confidence
  };

  // Performance metrics
  if (row.impressions !== undefined) {
    canonical.impressions = parseFloat(row.impressions) || null;
  }
  if (row.clicks !== undefined) {
    canonical.clicks = parseFloat(row.clicks) || null;
  }
  if (row.spend !== undefined) {
    canonical.spend = parseFloat(row.spend) || null;
  }
  if (row.conversions !== undefined) {
    canonical.conversions = parseFloat(row.conversions) || null;
  }
  if (row.leads !== undefined) {
    canonical.leads = parseFloat(row.leads) || null;
  }
  if (row.engagements !== undefined) {
    canonical.engagements = parseFloat(row.engagements) || null;
  }

  // Revenue metrics
  if (row.revenue !== undefined) {
    canonical.revenue = parseFloat(row.revenue) || null;
  }
  if (row.conversion_value !== undefined) {
    canonical.conversion_value = parseFloat(row.conversion_value) || null;
  }

  // Calculate derived metrics if base metrics are available
  if (canonical.impressions && canonical.impressions > 0 && canonical.clicks) {
    canonical.ctr = (canonical.clicks / canonical.impressions) * 100;
  }

  if (canonical.clicks && canonical.clicks > 0 && canonical.spend) {
    canonical.cpc = canonical.spend / canonical.clicks;
  }

  if (canonical.impressions && canonical.impressions > 0 && canonical.spend) {
    canonical.cpm = (canonical.spend / canonical.impressions) * 1000;
  }

  if (canonical.conversions && canonical.conversions > 0 && canonical.spend) {
    canonical.cpa = canonical.spend / canonical.conversions;
  }

  if (canonical.spend && canonical.spend > 0 && canonical.revenue) {
    canonical.roas = canonical.revenue / canonical.spend;
  }

  if (canonical.spend && canonical.spend > 0 && canonical.revenue) {
    canonical.roi = ((canonical.revenue - canonical.spend) / canonical.spend) * 100;
  }

  // Mark if enriched
  if (row._enriched) {
    canonical._enriched = true;
  }

  return canonical;
}

/**
 * Convert multiple rows to canonical format
 */
export function toCanonicalFormatBatch(
  rows: any[],
  source: string = 'google_sheets',
  confidence: number = 1.0
): CanonicalRow[] {
  return rows.map(row => toCanonicalFormat(row, source, confidence));
}

/**
 * Validate canonical row
 */
export function validateCanonicalRow(row: CanonicalRow): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!row.campaign_name || row.campaign_name.trim() === '') {
    errors.push('campaign_name is required');
  }
  if (!row.platform || row.platform.trim() === '') {
    errors.push('platform is required');
  }
  if (!row.date) {
    errors.push('date is required');
  }

  // Validate numeric fields
  const numericFields: (keyof CanonicalRow)[] = [
    'impressions', 'clicks', 'spend', 'conversions', 'leads', 'engagements',
    'revenue', 'conversion_value', 'ctr', 'cpc', 'cpm', 'cpa', 'roas', 'roi'
  ];

  for (const field of numericFields) {
    const value = row[field];
    if (value !== null && value !== undefined && (isNaN(Number(value)) || !isFinite(Number(value)))) {
      errors.push(`${field} must be a valid number`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Merge canonical rows (aggregate by campaign/platform/date)
 */
export function mergeCanonicalRows(rows: CanonicalRow[]): CanonicalRow[] {
  const merged = new Map<string, CanonicalRow>();

  for (const row of rows) {
    const key = `${row.campaign_name}|${row.platform}|${row.date}`;
    
    if (merged.has(key)) {
      const existing = merged.get(key)!;
      
      // Sum numeric fields
      if (row.impressions) existing.impressions = (existing.impressions || 0) + row.impressions;
      if (row.clicks) existing.clicks = (existing.clicks || 0) + row.clicks;
      if (row.spend) existing.spend = (existing.spend || 0) + row.spend;
      if (row.conversions) existing.conversions = (existing.conversions || 0) + row.conversions;
      if (row.leads) existing.leads = (existing.leads || 0) + row.leads;
      if (row.engagements) existing.engagements = (existing.engagements || 0) + row.engagements;
      if (row.revenue) existing.revenue = (existing.revenue || 0) + row.revenue;
      
      // Recalculate derived metrics
      if (existing.impressions && existing.impressions > 0 && existing.clicks) {
        existing.ctr = (existing.clicks / existing.impressions) * 100;
      }
      if (existing.clicks && existing.clicks > 0 && existing.spend) {
        existing.cpc = existing.spend / existing.clicks;
      }
      if (existing.impressions && existing.impressions > 0 && existing.spend) {
        existing.cpm = (existing.spend / existing.impressions) * 1000;
      }
      if (existing.conversions && existing.conversions > 0 && existing.spend) {
        existing.cpa = existing.spend / existing.conversions;
      }
      if (existing.spend && existing.spend > 0 && existing.revenue) {
        existing.roas = existing.revenue / existing.spend;
      }
      if (existing.spend && existing.spend > 0 && existing.revenue) {
        existing.roi = ((existing.revenue - existing.spend) / existing.spend) * 100;
      }
    } else {
      merged.set(key, { ...row });
    }
  }

  return Array.from(merged.values());
}

