/**
 * Auto-Mapping Algorithm
 * Intelligently maps detected columns to platform fields using fuzzy matching
 */

import { DetectedColumn } from './column-detection';
import { PlatformField } from './field-definitions';

export interface FieldMapping {
  sourceColumnIndex: number;
  sourceColumnName: string;
  targetFieldId: string;
  targetFieldName: string;
  matchType: 'auto' | 'manual' | 'template';
  confidence: number; // 0-1
  transform?: (value: any) => any;
}

/**
 * Calculate Levenshtein distance between two strings
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
 * Calculate string similarity (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - distance) / longer.length;
}

/**
 * Check if types are compatible
 */
function isTypeCompatible(
  detectedType: string,
  fieldType: string
): boolean {
  // Exact match
  if (detectedType === fieldType) return true;
  
  // Currency and number are compatible
  if ((detectedType === 'currency' && fieldType === 'number') ||
      (detectedType === 'number' && fieldType === 'currency')) {
    return true;
  }
  
  // Percentage and number are compatible
  if ((detectedType === 'percentage' && fieldType === 'number') ||
      (detectedType === 'number' && fieldType === 'percentage')) {
    return true;
  }
  
  // Text is compatible with most types (can be converted)
  if (detectedType === 'text') return true;
  
  return false;
}

/**
 * Calculate match score between a column and a platform field
 */
function calculateMatchScore(
  column: DetectedColumn,
  field: PlatformField
): number {
  let score = 0;
  const columnNameLower = column.originalName.toLowerCase().trim();
  const fieldNameLower = field.name.toLowerCase();
  
  // 1. Exact name match (highest priority) - 0.5 points
  if (columnNameLower === fieldNameLower) {
    score += 0.5;
  }
  
  // 2. Alias match - 0.4 points
  const aliasMatch = field.aliases.some(alias => {
    const aliasLower = alias.toLowerCase();
    return columnNameLower === aliasLower ||
           columnNameLower.includes(aliasLower) ||
           aliasLower.includes(columnNameLower);
  });
  if (aliasMatch) {
    score += 0.4;
  }
  
  // 3. Pattern match - 0.3 points
  const patternMatch = field.patterns.some(pattern => pattern.test(column.originalName));
  if (patternMatch) {
    score += 0.3;
  }
  
  // 4. Type compatibility - 0.2 points (or penalty)
  if (isTypeCompatible(column.detectedType, field.type)) {
    score += 0.2;
  } else {
    score -= 0.3; // Penalty for type mismatch
  }
  
  // 5. Fuzzy string similarity - 0.2 points
  const similarity = stringSimilarity(columnNameLower, fieldNameLower);
  score += similarity * 0.2;
  
  // Normalize to 0-1 range
  return Math.min(1, Math.max(0, score));
}

/**
 * Auto-map columns to platform fields
 */
export function autoMapColumns(
  detectedColumns: DetectedColumn[],
  platformFields: PlatformField[],
  minConfidence: number = 0.6
): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const usedFields = new Set<string>();
  const usedColumns = new Set<number>();
  
  // First pass: Find exact and high-confidence matches for required fields
  const requiredFields = platformFields.filter(f => f.required);
  
  for (const field of requiredFields) {
    if (usedFields.has(field.id)) continue;
    
    let bestMatch: { column: DetectedColumn; score: number } | null = null;
    
    for (const column of detectedColumns) {
      if (usedColumns.has(column.index)) continue;
      
      const score = calculateMatchScore(column, field);
      
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { column, score };
      }
    }
    
    // Only auto-map if confidence is high enough
    if (bestMatch && bestMatch.score >= minConfidence) {
      mappings.push({
        sourceColumnIndex: bestMatch.column.index,
        sourceColumnName: bestMatch.column.originalName,
        targetFieldId: field.id,
        targetFieldName: field.name,
        matchType: 'auto',
        confidence: bestMatch.score,
        transform: field.transform
      });
      
      usedFields.add(field.id);
      usedColumns.add(bestMatch.column.index);
    }
  }
  
  // Second pass: Map optional fields
  const optionalFields = platformFields.filter(f => !f.required);
  
  for (const field of optionalFields) {
    if (usedFields.has(field.id)) continue;
    
    let bestMatch: { column: DetectedColumn; score: number } | null = null;
    
    for (const column of detectedColumns) {
      if (usedColumns.has(column.index)) continue;
      
      const score = calculateMatchScore(column, field);
      
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { column, score };
      }
    }
    
    // Lower threshold for optional fields
    if (bestMatch && bestMatch.score >= minConfidence * 0.8) {
      mappings.push({
        sourceColumnIndex: bestMatch.column.index,
        sourceColumnName: bestMatch.column.originalName,
        targetFieldId: field.id,
        targetFieldName: field.name,
        matchType: 'auto',
        confidence: bestMatch.score,
        transform: field.transform
      });
      
      usedFields.add(field.id);
      usedColumns.add(bestMatch.column.index);
    }
  }
  
  return mappings;
}

/**
 * Validate mappings against platform fields
 */
export function validateMappings(
  mappings: FieldMapping[],
  platformFields: PlatformField[]
): Map<string, string> {
  const errors = new Map<string, string>();
  const requiredFields = platformFields.filter(f => f.required);
  
  // Check if all required fields are mapped
  for (const field of requiredFields) {
    const mapping = mappings.find(m => m.targetFieldId === field.id);
    if (!mapping) {
      errors.set(field.id, `Required field "${field.name}" is not mapped`);
    }
  }
  
  // Check for duplicate mappings
  const fieldIds = new Set<string>();
  for (const mapping of mappings) {
    if (fieldIds.has(mapping.targetFieldId)) {
      errors.set(mapping.targetFieldId, `Field "${mapping.targetFieldName}" is mapped multiple times`);
    }
    fieldIds.add(mapping.targetFieldId);
  }
  
  return errors;
}

/**
 * Check if mappings are valid
 */
export function isMappingValid(
  mappings: FieldMapping[],
  platformFields: PlatformField[]
): boolean {
  const errors = validateMappings(mappings, platformFields);
  return errors.size === 0;
}

