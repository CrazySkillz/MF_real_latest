/**
 * Data Enrichment
 * Phase 4: Contextual Enrichment - Infers missing data from context
 */

import { normalizePlatform, normalizeCampaignName } from './data-transformation';

export interface EnrichmentContext {
  campaignName: string;
  platform: string;
  hasLinkedInApi?: boolean;
  existingData?: {
    totalImpressions?: number;
    totalClicks?: number;
    totalSpend?: number;
    totalConversions?: number;
  };
}

export interface EnrichedRow {
  [key: string]: any;
  _enriched?: {
    platform?: boolean;
    campaign_name?: boolean;
    date?: boolean;
  };
}

/**
 * Enrich a single row with contextual data
 */
export function enrichRow(
  row: any,
  context: EnrichmentContext
): EnrichedRow {
  const enriched: EnrichedRow = { ...row };
  enriched._enriched = {};

  // Enrich platform if missing
  if (!row.platform && context.platform) {
    enriched.platform = normalizePlatform(context.platform);
    enriched._enriched.platform = true;
  } else if (row.platform) {
    // Normalize existing platform value
    enriched.platform = normalizePlatform(row.platform);
  }

  // Enrich campaign name if missing
  if (!row.campaign_name && context.campaignName) {
    enriched.campaign_name = normalizeCampaignName(context.campaignName);
    enriched._enriched.campaign_name = true;
  } else if (row.campaign_name) {
    // Normalize existing campaign name
    enriched.campaign_name = normalizeCampaignName(row.campaign_name);
  }

  // Enrich date if missing (use current date as fallback)
  if (!row.date) {
    enriched.date = new Date();
    enriched._enriched.date = true;
  }

  // If LinkedIn API is connected, we can infer that conversions come from API
  // but we still need revenue from the sheet
  if (context.hasLinkedInApi && context.platform?.toLowerCase().includes('linkedin')) {
    // Mark that conversions should come from API, not from sheet
    enriched._conversionsFromApi = true;
  }

  return enriched;
}

/**
 * Enrich multiple rows with contextual data
 */
export function enrichRows(
  rows: any[],
  context: EnrichmentContext
): EnrichedRow[] {
  return rows.map(row => enrichRow(row, context));
}

/**
 * Infer missing required fields from context
 */
export function inferMissingFields(
  row: any,
  context: EnrichmentContext,
  requiredFields: string[]
): Partial<Record<string, any>> {
  const inferred: Partial<Record<string, any>> = {};

  for (const field of requiredFields) {
    if (row[field] === null || row[field] === undefined || row[field] === '') {
      switch (field) {
        case 'platform':
          if (context.platform) {
            inferred.platform = normalizePlatform(context.platform);
          }
          break;
        
        case 'campaign_name':
          if (context.campaignName) {
            inferred.campaign_name = normalizeCampaignName(context.campaignName);
          }
          break;
        
        case 'date':
          inferred.date = new Date();
          break;
        
        case 'impressions':
        case 'clicks':
        case 'spend':
        case 'conversions':
          // If LinkedIn API is connected, these can be optional
          if (context.hasLinkedInApi && context.platform?.toLowerCase().includes('linkedin')) {
            // Don't infer, let API provide these
            break;
          }
          // Otherwise, set to 0 as default
          inferred[field] = 0;
          break;
      }
    }
  }

  return inferred;
}

/**
 * Validate enrichment results
 */
export function validateEnrichment(
  enrichedRows: EnrichedRow[],
  requiredFields: string[]
): {
  valid: boolean;
  errors: Array<{ row: number; field: string; error: string }>;
} {
  const errors: Array<{ row: number; field: string; error: string }> = [];

  for (let i = 0; i < enrichedRows.length; i++) {
    const row = enrichedRows[i];
    
    for (const field of requiredFields) {
      if (row[field] === null || row[field] === undefined || row[field] === '') {
        errors.push({
          row: i + 1,
          field,
          error: `Required field "${field}" is missing and could not be inferred`
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

