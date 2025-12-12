/**
 * Data Transformation Pipeline
 * Transforms raw data using field mappings
 * Phase 3: Enhanced Normalization
 */

import { FieldMapping } from './auto-mapping';
import { PlatformField, getPlatformFields } from './field-definitions';

export interface TransformationResult {
  success: boolean;
  transformedRows: any[];
  errors: Array<{ row: number; field: string; error: string }>;
  warnings: Array<{ row: number; field: string; warning: string }>;
}

/**
 * Normalize campaign name (remove extra spaces, standardize case)
 */
export function normalizeCampaignName(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '');
}

/**
 * Normalize platform name (standardize variations)
 */
export function normalizePlatform(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const normalized = String(value).trim().toLowerCase();
  
  // Map common variations to standard names
  const platformMap: Record<string, string> = {
    'linkedin': 'linkedin',
    'linked in': 'linkedin',
    'linked-in': 'linkedin',
    'li': 'linkedin',
    'facebook': 'facebook',
    'meta': 'facebook',
    'meta ads': 'facebook',
    'facebook ads': 'facebook',
    'fb': 'facebook',
    'google': 'google',
    'google ads': 'google',
    'google adwords': 'google',
    'adwords': 'google',
    'gads': 'google'
  };
  
  // Check for exact match
  if (platformMap[normalized]) {
    return platformMap[normalized];
  }
  
  // Check for partial match
  for (const [key, standard] of Object.entries(platformMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return standard;
    }
  }
  
  return normalized; // Return as-is if no match
}

/**
 * Normalize currency value (handle various formats)
 */
export function normalizeCurrency(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const valueStr = String(value).trim();
  
  // Remove currency symbols and spaces
  const cleaned = valueStr
    .replace(/[\$€£¥₹]/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .replace(/[^\d.-]/g, '');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Normalize date value (handle various formats)
 */
export function normalizeDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const valueStr = String(value).trim();
  
  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(valueStr)) {
    const date = new Date(valueStr);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try US format (MM/DD/YYYY or MM-DD-YYYY)
  const usFormat = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
  const usMatch = valueStr.match(usFormat);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try European format (DD/MM/YYYY or DD-MM-YYYY)
  const euFormat = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
  const euMatch = valueStr.match(euFormat);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try native Date parsing
  const date = new Date(valueStr);
  if (!isNaN(date.getTime())) return date;
  
  return null;
}

/**
 * Normalize number value (handle various formats)
 */
export function normalizeNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const valueStr = String(value).trim();
  
  // Remove thousand separators and spaces
  const cleaned = valueStr.replace(/,/g, '').replace(/\s+/g, '');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Normalize percentage value
 */
export function normalizePercentage(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const valueStr = String(value).trim();
  
  // Remove % symbol and spaces
  const cleaned = valueStr.replace(/%/g, '').replace(/\s+/g, '');
  
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  
  // If value is > 1, assume it's already a percentage (e.g., 50 means 50%)
  // If value is <= 1, assume it's a decimal (e.g., 0.5 means 50%)
  return num > 1 ? num / 100 : num;
}

/**
 * Convert value to target type (enhanced with normalization)
 */
function convertToType(value: any, targetType: string): any {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const valueStr = String(value).trim();
  
  switch (targetType) {
    case 'number':
      return normalizeNumber(value);
    
    case 'currency':
      return normalizeCurrency(value);
    
    case 'date':
      return normalizeDate(value);
    
    case 'percentage':
      return normalizePercentage(value);
    
    case 'boolean':
      const str = valueStr.toLowerCase();
      return ['true', 'yes', '1', 'y'].includes(str);
    
    default:
      return valueStr;
  }
}

/**
 * Transform data using mappings
 */
export function transformData(
  rawRows: any[][],
  mappings: FieldMapping[],
  platform: string
): TransformationResult {
  const transformedRows: any[] = [];
  const errors: Array<{ row: number; field: string; error: string }> = [];
  const warnings: Array<{ row: number; field: string; warning: string }> = [];
  
  const platformFields = getPlatformFields(platform);
  const fieldMap = new Map(platformFields.map(f => [f.id, f]));
  
  // Skip header row
  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex++) {
    const rawRow = rawRows[rowIndex];
    const transformedRow: any = {};
    
    // Apply each mapping
    for (const mapping of mappings) {
      const field = fieldMap.get(mapping.targetFieldId);
      if (!field) {
        warnings.push({
          row: rowIndex + 1,
          field: mapping.targetFieldName,
          warning: `Field "${mapping.targetFieldName}" not found in platform definition`
        });
        continue;
      }
      
      const rawValue = rawRow[mapping.sourceColumnIndex];
      
      try {
        // Apply transformation if defined
        let transformedValue = rawValue;
        
        // First apply custom transform from mapping
        if (mapping.transform) {
          transformedValue = mapping.transform(transformedValue);
        } else if (field.transform) {
          // Then apply field-level transform
          transformedValue = field.transform(transformedValue);
        }
        
        // Validate required fields
        if (field.required && (transformedValue === null || transformedValue === undefined || transformedValue === '')) {
          errors.push({
            row: rowIndex + 1,
            field: field.name,
            error: `Required field "${field.name}" is missing or empty`
          });
          continue;
        }
        
        // Skip if value is null/empty and field is optional
        if ((transformedValue === null || transformedValue === undefined || transformedValue === '') && !field.required) {
          transformedRow[field.id] = null;
          continue;
        }
        
        // Validate value
        if (field.validation && !field.validation(transformedValue)) {
          errors.push({
            row: rowIndex + 1,
            field: field.name,
            error: `Invalid value for "${field.name}": ${transformedValue}`
          });
          continue;
        }
        
        // Type conversion
        transformedValue = convertToType(transformedValue, field.type);
        
        transformedRow[field.id] = transformedValue;
        
      } catch (error: any) {
        errors.push({
          row: rowIndex + 1,
          field: field.name,
          error: `Transformation error: ${error.message}`
        });
      }
    }
    
    // Check if all required fields are present
    const missingRequired = platformFields
      .filter(f => f.required && !transformedRow[f.id])
      .map(f => f.name);
    
    if (missingRequired.length > 0) {
      errors.push({
        row: rowIndex + 1,
        field: 'multiple',
        error: `Missing required fields: ${missingRequired.join(', ')}`
      });
    } else {
      transformedRows.push(transformedRow);
    }
  }
  
  return {
    success: errors.length === 0,
    transformedRows,
    errors,
    warnings
  };
}

/**
 * Calculate Levenshtein distance for fuzzy matching (Phase 5)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate fuzzy similarity (0-1) (Phase 5)
 */
function fuzzySimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - distance) / longer.length;
}

/**
 * Normalize string for comparison (Phase 5)
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ');   // Normalize whitespace
}

/**
 * Filter transformed rows by campaign name and platform (Phase 5: Enhanced with fuzzy matching)
 */
export function filterRowsByCampaignAndPlatform(
  transformedRows: any[],
  campaignName: string,
  platform: string,
  options?: {
    fuzzyMatch?: boolean;
    minSimilarity?: number;
    contextAware?: boolean;
  }
): any[] {
  const {
    fuzzyMatch = true,
    minSimilarity = 0.8,
    contextAware = true
  } = options || {};
  
  const platformLower = platform?.toLowerCase() || '';
  const platformKeywords = getPlatformKeywords(platformLower);
  const normalizedCampaignName = normalizeForComparison(campaignName);
  
  return transformedRows.filter(row => {
    // Check platform match (enhanced)
    const rowPlatform = String(row.platform || '').toLowerCase();
    let platformMatch = matchesPlatform(rowPlatform, platformKeywords);
    
    // If no platform column, use context-aware inference (Phase 5)
    if (contextAware && !rowPlatform && platformKeywords.length > 0) {
      // Check if dataset is single-platform (all rows have same platform or no platform column)
      // In this case, if campaign matches, assume platform matches
      platformMatch = true; // Will be validated by campaign match
    }
    
    // Check campaign name match (enhanced with fuzzy matching)
    const rowCampaignName = String(row.campaign_name || '').trim();
    const normalizedRowCampaign = normalizeForComparison(rowCampaignName);
    
    let campaignMatch = false;
    
    if (fuzzyMatch) {
      // Use fuzzy matching
      const similarity = fuzzySimilarity(normalizedCampaignName, normalizedRowCampaign);
      campaignMatch = similarity >= minSimilarity;
      
      // Also check exact match (after normalization)
      if (!campaignMatch) {
        campaignMatch = normalizedCampaignName === normalizedRowCampaign;
      }
      
      // Check if one contains the other (partial match)
      if (!campaignMatch) {
        campaignMatch = normalizedCampaignName.includes(normalizedRowCampaign) ||
                        normalizedRowCampaign.includes(normalizedCampaignName);
      }
    } else {
      // Exact match only
      campaignMatch = normalizedCampaignName === normalizedRowCampaign;
    }
    
    return platformMatch && campaignMatch;
  });
}

/**
 * Get platform keywords for matching
 */
function getPlatformKeywords(platform: string): string[] {
  const platformLower = platform.toLowerCase();
  
  if (platformLower.includes('linkedin')) {
    return ['linkedin', 'linked in'];
  }
  if (platformLower.includes('facebook') || platformLower.includes('meta')) {
    return ['facebook', 'meta', 'facebook ads', 'meta ads'];
  }
  if (platformLower.includes('google')) {
    return ['google', 'google ads', 'googleadwords'];
  }
  
  return [platformLower];
}

/**
 * Check if platform value matches keywords
 */
function matchesPlatform(platformValue: string, keywords: string[]): boolean {
  const normalized = platformValue.toLowerCase().trim();
  return keywords.some(keyword => normalized.includes(keyword) || keyword.includes(normalized));
}

/**
 * Calculate conversion value from transformed rows
 * @param transformedRows - Transformed rows from Google Sheets
 * @param linkedInConversions - Optional LinkedIn API conversions to use instead of Google Sheets conversions
 * @returns Conversion value (Revenue / Conversions) or null if cannot calculate
 */
export function calculateConversionValue(
  transformedRows: any[],
  linkedInConversions?: number | null
): number | null {
  const totalRevenue = transformedRows.reduce((sum, row) => {
    return sum + (parseFloat(row.revenue) || 0);
  }, 0);
  
  // Use LinkedIn API conversions if provided, otherwise use Google Sheets conversions
  let totalConversions: number;
  if (linkedInConversions !== null && linkedInConversions !== undefined && linkedInConversions > 0) {
    // Use LinkedIn API conversions (more accurate for LinkedIn campaigns)
    totalConversions = linkedInConversions;
  } else {
    // Fallback to Google Sheets conversions
    totalConversions = transformedRows.reduce((sum, row) => {
      return sum + (parseInt(row.conversions) || 0);
    }, 0);
  }
  
  if (totalConversions > 0) {
    return totalRevenue / totalConversions;
  }
  
  return null;
}

