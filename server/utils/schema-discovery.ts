/**
 * Schema Discovery
 * Automatically detects dataset structure, patterns, and data quality
 */

import { DetectedColumn } from './column-detection';

export interface DatasetSchema {
  structure: {
    totalRows: number;
    totalColumns: number;
    hasHeader: boolean;
    columnNames: string[];
    detectedTypes: Record<string, string>;
  };
  patterns: {
    isTimeSeries: boolean;
    isMultiPlatform: boolean;
    aggregationLevel: 'campaign' | 'ad_set' | 'ad' | 'unknown';
    hasMissingValues: boolean;
    dateColumnIndex?: number;
    platformColumnIndex?: number;
  };
  quality: {
    duplicateRows: number;
    inconsistentFormats: string[];
    outliers: Array<{ column: string; row: number; value: any }>;
    dataCompleteness: number; // 0-1, percentage of non-null values
  };
}

/**
 * Detect if dataset is time-series (has sequential dates)
 */
function detectTimeSeries(
  rows: any[][],
  dateColumnIndex: number | undefined
): boolean {
  if (dateColumnIndex === undefined || rows.length < 3) {
    return false;
  }

  try {
    const dates: Date[] = [];
    for (let i = 1; i < Math.min(rows.length, 100); i++) { // Check first 100 rows
      const dateValue = rows[i]?.[dateColumnIndex];
      if (dateValue) {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          dates.push(date);
        }
      }
    }

    if (dates.length < 3) return false;

    // Check if dates are sequential (within reasonable range)
    let sequentialCount = 0;
    for (let i = 1; i < dates.length; i++) {
      const diff = dates[i].getTime() - dates[i - 1].getTime();
      const daysDiff = diff / (1000 * 60 * 60 * 24);
      // Dates should be within 0-7 days of each other for time-series
      if (daysDiff >= 0 && daysDiff <= 7) {
        sequentialCount++;
      }
    }

    return sequentialCount / (dates.length - 1) > 0.7; // 70% should be sequential
  } catch {
    return false;
  }
}

/**
 * Detect if dataset is multi-platform (Platform column has multiple values)
 */
function detectMultiPlatform(
  rows: any[][],
  platformColumnIndex: number | undefined
): boolean {
  if (platformColumnIndex === undefined || rows.length < 2) {
    return false;
  }

  try {
    const platformValues = new Set<string>();
    for (let i = 1; i < rows.length; i++) {
      const platformValue = String(rows[i]?.[platformColumnIndex] || '').trim().toLowerCase();
      if (platformValue) {
        platformValues.add(platformValue);
      }
    }

    // If more than 1 unique platform value, it's multi-platform
    return platformValues.size > 1;
  } catch {
    return false;
  }
}

/**
 * Detect aggregation level based on data patterns
 */
function detectAggregationLevel(
  rows: any[][],
  columns: DetectedColumn[]
): 'campaign' | 'ad_set' | 'ad' | 'unknown' {
  // Look for indicators of aggregation level
  const hasCampaignName = columns.some(c => 
    /campaign/i.test(c.originalName) && !/id/i.test(c.originalName)
  );
  const hasCampaignId = columns.some(c => 
    /campaign.*id/i.test(c.originalName)
  );
  const hasAdSet = columns.some(c => 
    /ad.*set|adset|ad_group/i.test(c.originalName)
  );
  const hasAdId = columns.some(c => 
    /ad.*id|ad_id/i.test(c.originalName)
  );

  if (hasAdId) return 'ad';
  if (hasAdSet) return 'ad_set';
  if (hasCampaignName || hasCampaignId) return 'campaign';
  return 'unknown';
}

/**
 * Analyze data quality
 */
function analyzeDataQuality(
  rows: any[][],
  columns: DetectedColumn[]
): {
  duplicateRows: number;
  inconsistentFormats: string[];
  outliers: Array<{ column: string; row: number; value: any }>;
  dataCompleteness: number;
} {
  const duplicateRows = findDuplicateRows(rows);
  const inconsistentFormats = findInconsistentFormats(rows, columns);
  const outliers = findOutliers(rows, columns);
  const dataCompleteness = calculateDataCompleteness(rows, columns);

  return {
    duplicateRows,
    inconsistentFormats,
    outliers,
    dataCompleteness
  };
}

/**
 * Find duplicate rows
 */
function findDuplicateRows(rows: any[][]): number {
  if (rows.length < 2) return 0;

  const rowHashes = new Map<string, number>();
  let duplicates = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const hash = JSON.stringify(row);
    if (rowHashes.has(hash)) {
      duplicates++;
    } else {
      rowHashes.set(hash, 1);
    }
  }

  return duplicates;
}

/**
 * Find columns with inconsistent formats
 */
function findInconsistentFormats(
  rows: any[][],
  columns: DetectedColumn[]
): string[] {
  const inconsistent: string[] = [];

  for (const column of columns) {
    if (column.detectedType === 'currency' || column.detectedType === 'date') {
      const formats = new Set<string>();
      for (let i = 1; i < Math.min(rows.length, 50); i++) {
        const value = rows[i]?.[column.index];
        if (value) {
          const format = detectValueFormat(String(value), column.detectedType);
          if (format) {
            formats.add(format);
          }
        }
      }
      // If more than 2 different formats, it's inconsistent
      if (formats.size > 2) {
        inconsistent.push(column.originalName);
      }
    }
  }

  return inconsistent;
}

/**
 * Detect format of a value
 */
function detectValueFormat(value: string, type: string): string | null {
  if (type === 'currency') {
    if (/^\$/.test(value)) return 'usd_prefix';
    if (/€/.test(value)) return 'euro';
    if (/£/.test(value)) return 'pound';
    if (/,/.test(value)) return 'comma_separated';
    return 'plain_number';
  }
  if (type === 'date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'iso';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return 'us';
    if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return 'us_dash';
    if (/Jan|Feb|Mar/.test(value)) return 'text_month';
    return 'unknown';
  }
  return null;
}

/**
 * Find outlier values (statistical outliers)
 */
function findOutliers(
  rows: any[][],
  columns: DetectedColumn[]
): Array<{ column: string; row: number; value: any }> {
  const outliers: Array<{ column: string; row: number; value: any }> = [];

  for (const column of columns) {
    if (column.detectedType === 'number' || column.detectedType === 'currency') {
      const values: number[] = [];
      for (let i = 1; i < rows.length; i++) {
        const value = rows[i]?.[column.index];
        if (value !== null && value !== undefined && value !== '') {
          const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
          if (!isNaN(num) && isFinite(num)) {
            values.push(num);
          }
        }
      }

      if (values.length > 10) {
        // Calculate Q1, Q3, IQR
        const sorted = [...values].sort((a, b) => a - b);
        const q1Index = Math.floor(sorted.length * 0.25);
        const q3Index = Math.floor(sorted.length * 0.75);
        const q1 = sorted[q1Index];
        const q3 = sorted[q3Index];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        // Find outliers
        for (let i = 1; i < rows.length; i++) {
          const value = rows[i]?.[column.index];
          if (value !== null && value !== undefined && value !== '') {
            const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
            if (!isNaN(num) && (num < lowerBound || num > upperBound)) {
              outliers.push({
                column: column.originalName,
                row: i + 1,
                value: value
              });
            }
          }
        }
      }
    }
  }

  return outliers;
}

/**
 * Calculate data completeness (percentage of non-null values)
 */
function calculateDataCompleteness(
  rows: any[][],
  columns: DetectedColumn[]
): number {
  if (rows.length < 2 || columns.length === 0) return 0;

  let totalCells = 0;
  let nonNullCells = 0;

  for (const column of columns) {
    for (let i = 1; i < rows.length; i++) {
      totalCells++;
      const value = rows[i]?.[column.index];
      if (value !== null && value !== undefined && value !== '') {
        nonNullCells++;
      }
    }
  }

  return totalCells > 0 ? nonNullCells / totalCells : 0;
}

/**
 * Discover dataset schema
 */
export function discoverSchema(
  rawRows: any[][],
  detectedColumns: DetectedColumn[]
): DatasetSchema {
  const totalRows = rawRows.length;
  const totalColumns = detectedColumns.length;
  const hasHeader = totalRows > 0;

  // Find date and platform column indices
  const dateColumnIndex = detectedColumns.findIndex(c => 
    c.detectedType === 'date' || /date|time|timestamp/i.test(c.originalName)
  );
  const platformColumnIndex = detectedColumns.findIndex(c => 
    /platform|channel|network|source/i.test(c.originalName)
  );

  // Detect patterns
  const isTimeSeries = detectTimeSeries(rawRows, dateColumnIndex >= 0 ? dateColumnIndex : undefined);
  const isMultiPlatform = detectMultiPlatform(rawRows, platformColumnIndex >= 0 ? platformColumnIndex : undefined);
  const aggregationLevel = detectAggregationLevel(rawRows, detectedColumns);
  const hasMissingValues = detectedColumns.some(c => c.nullCount > 0);

  // Analyze quality
  const quality = analyzeDataQuality(rawRows, detectedColumns);

  return {
    structure: {
      totalRows,
      totalColumns,
      hasHeader,
      columnNames: detectedColumns.map(c => c.originalName),
      detectedTypes: detectedColumns.reduce((acc, c) => {
        acc[c.originalName] = c.detectedType;
        return acc;
      }, {} as Record<string, string>)
    },
    patterns: {
      isTimeSeries,
      isMultiPlatform,
      aggregationLevel,
      hasMissingValues,
      dateColumnIndex: dateColumnIndex >= 0 ? dateColumnIndex : undefined,
      platformColumnIndex: platformColumnIndex >= 0 ? platformColumnIndex : undefined
    },
    quality
  };
}

