/**
 * Data Transformation Pipeline
 * Transforms raw data using field mappings
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
 * Convert value to target type
 */
function convertToType(value: any, targetType: string): any {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const valueStr = String(value).trim();
  
  switch (targetType) {
    case 'number':
      const num = parseFloat(valueStr.replace(/[^0-9.-]/g, ''));
      return isNaN(num) ? null : num;
    
    case 'currency':
      return parseFloat(valueStr.replace(/[^0-9.-]/g, ''));
    
    case 'date':
      // Try to parse various date formats
      const dateFormats = [
        /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
        /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
        /^\d{2}-\d{2}-\d{4}$/ // MM-DD-YYYY
      ];
      
      for (const format of dateFormats) {
        if (format.test(valueStr)) {
          return new Date(valueStr);
        }
      }
      return null;
    
    case 'percentage':
      return parseFloat(valueStr.replace(/[^0-9.-]/g, '')) / 100;
    
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
 * Filter transformed rows by campaign name and platform
 */
export function filterRowsByCampaignAndPlatform(
  transformedRows: any[],
  campaignName: string,
  platform: string
): any[] {
  const platformLower = platform?.toLowerCase() || '';
  const platformKeywords = getPlatformKeywords(platformLower);
  
  return transformedRows.filter(row => {
    // Check platform match
    const rowPlatform = String(row.platform || '').toLowerCase();
    const platformMatch = matchesPlatform(rowPlatform, platformKeywords);
    
    // Check campaign name match (case-insensitive)
    const rowCampaignName = String(row.campaign_name || '').trim();
    const campaignMatch = rowCampaignName.toLowerCase() === campaignName.toLowerCase();
    
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
 */
export function calculateConversionValue(transformedRows: any[]): number | null {
  const totalRevenue = transformedRows.reduce((sum, row) => {
    return sum + (parseFloat(row.revenue) || 0);
  }, 0);
  
  const totalConversions = transformedRows.reduce((sum, row) => {
    return sum + (parseInt(row.conversions) || 0);
  }, 0);
  
  if (totalConversions > 0) {
    return totalRevenue / totalConversions;
  }
  
  return null;
}

