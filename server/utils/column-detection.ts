/**
 * Column Detection and Type Inference
 * Analyzes uploaded data to detect column types and structure
 */

export interface DetectedColumn {
  index: number;
  name: string;
  originalName: string;
  detectedType: 'number' | 'text' | 'date' | 'currency' | 'percentage' | 'boolean' | 'unknown';
  confidence: number; // 0-1, how confident we are in the type
  sampleValues: any[];
  uniqueValues?: number;
  nullCount: number;
  suggestedFieldId?: string;
  matchScore?: number;
}

/**
 * Normalize column name for comparison
 */
function normalizeColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Infer data type from sample values
 */
function inferType(values: any[]): 'number' | 'text' | 'date' | 'currency' | 'percentage' | 'boolean' | 'unknown' {
  if (values.length === 0) return 'unknown';
  
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmptyValues.length === 0) return 'unknown';
  
  const valueStrings = nonEmptyValues.map(v => String(v).trim());
  
  // Check for currency (has $, €, £, ¥, etc.)
  const currencyPattern = /^[\$€£¥]\s*\d+[.,]?\d*$/;
  const currencyCount = valueStrings.filter(v => currencyPattern.test(v)).length;
  if (currencyCount / nonEmptyValues.length > 0.5) {
    return 'currency';
  }
  
  // Check for percentage
  const percentagePattern = /^\d+[.,]?\d*\s*%$/;
  const percentageCount = valueStrings.filter(v => percentagePattern.test(v)).length;
  if (percentageCount / nonEmptyValues.length > 0.5) {
    return 'percentage';
  }
  
  // Check for dates (various formats)
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
    /^\d{1,2}\/\d{1,2}\/\d{4}$/ // M/D/YYYY
  ];
  const dateCount = valueStrings.filter(v => 
    datePatterns.some(pattern => pattern.test(v))
  ).length;
  if (dateCount / nonEmptyValues.length > 0.5) {
    return 'date';
  }
  
  // Check for numbers (including decimals and with commas)
  const numericValues = nonEmptyValues.filter(v => {
    const str = String(v).replace(/[,\s]/g, '');
    return !isNaN(parseFloat(str)) && isFinite(parseFloat(str));
  });
  if (numericValues.length / nonEmptyValues.length > 0.7) {
    return 'number';
  }
  
  // Check for boolean
  const booleanValues = valueStrings.filter(v => 
    ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(v.toLowerCase())
  );
  if (booleanValues.length / nonEmptyValues.length > 0.7) {
    return 'boolean';
  }
  
  return 'text';
}

/**
 * Calculate type confidence based on consistency
 */
function calculateTypeConfidence(
  values: any[],
  detectedType: string
): number {
  if (values.length === 0) return 0;
  
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmptyValues.length === 0) return 0;
  
  let matchingCount = 0;
  
  switch (detectedType) {
    case 'currency':
      const currencyPattern = /^[\$€£¥]\s*\d+[.,]?\d*$/;
      matchingCount = nonEmptyValues.filter(v => currencyPattern.test(String(v))).length;
      break;
    
    case 'percentage':
      const percentagePattern = /^\d+[.,]?\d*\s*%$/;
      matchingCount = nonEmptyValues.filter(v => percentagePattern.test(String(v))).length;
      break;
    
    case 'date':
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/,
        /^\d{2}\/\d{2}\/\d{4}$/,
        /^\d{2}-\d{2}-\d{4}$/,
        /^\d{1,2}\/\d{1,2}\/\d{4}$/
      ];
      matchingCount = nonEmptyValues.filter(v => 
        datePatterns.some(pattern => pattern.test(String(v)))
      ).length;
      break;
    
    case 'number':
      matchingCount = nonEmptyValues.filter(v => {
        const str = String(v).replace(/[,\s]/g, '');
        return !isNaN(parseFloat(str)) && isFinite(parseFloat(str));
      }).length;
      break;
    
    case 'boolean':
      matchingCount = nonEmptyValues.filter(v => 
        ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(String(v).toLowerCase())
      ).length;
      break;
    
    default:
      return 0.5; // Default confidence for text
  }
  
  return matchingCount / nonEmptyValues.length;
}

/**
 * Detect column types from raw data rows
 */
export function detectColumnTypes(rows: any[][]): DetectedColumn[] {
  if (!rows || rows.length === 0) {
    return [];
  }
  
  const headerRow = rows[0];
  if (!headerRow || headerRow.length === 0) {
    return [];
  }
  
  const columns: DetectedColumn[] = [];
  
  // Analyze each column
  for (let i = 0; i < headerRow.length; i++) {
    const originalName = headerRow[i]?.toString().trim() || `Column ${i + 1}`;
    const normalizedName = normalizeColumnName(originalName);
    
    // Get all values for this column (skip header)
    const columnValues = rows
      .slice(1)
      .map(row => row[i])
      .filter(val => val !== null && val !== undefined && val !== '');
    
    // Infer type
    const detectedType = inferType(columnValues);
    const confidence = calculateTypeConfidence(columnValues, detectedType);
    
    // Get sample values (first 5 non-empty)
    const sampleValues = columnValues.slice(0, 5);
    
    // Count unique values
    const uniqueValues = new Set(columnValues.map(v => String(v))).size;
    
    // Count null/empty values
    const nullCount = rows.length - 1 - columnValues.length;
    
    columns.push({
      index: i,
      name: normalizedName,
      originalName,
      detectedType,
      confidence,
      sampleValues,
      uniqueValues,
      nullCount
    });
  }
  
  return columns;
}

/**
 * Parse CSV content into rows
 */
export function parseCSV(content: string): any[][] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const rows: any[][] = [];
  
  for (const line of lines) {
    // Simple CSV parsing (handles quoted values)
    const row: any[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    row.push(current.trim());
    rows.push(row);
  }
  
  return rows;
}

