import pdf from 'pdf-parse';

export interface ParsedMetrics {
  impressions: number;
  reach: number;
  clicks: number;
  engagements: number;
  spend: number;
  conversions: number;
  leads: number;
  videoViews: number;
  viralImpressions: number;
}

/**
 * Extract numeric value from text, handling various formats like:
 * - "1,234,567"
 * - "$12,345.67"
 * - "12.5K" (thousands)
 * - "1.2M" (millions)
 */
function extractNumber(text: string): number {
  // Remove currency symbols and commas
  let cleaned = text.replace(/[$,]/g, '').trim();
  
  // Handle K (thousands) and M (millions) suffixes
  if (cleaned.endsWith('K') || cleaned.endsWith('k')) {
    const value = parseFloat(cleaned.slice(0, -1));
    return Math.round(value * 1000);
  }
  if (cleaned.endsWith('M') || cleaned.endsWith('m')) {
    const value = parseFloat(cleaned.slice(0, -1));
    return Math.round(value * 1000000);
  }
  
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

/**
 * Parse PDF content to extract marketing metrics
 * Looks for common patterns like:
 * - "Impressions: 12,450"
 * - "Total Impressions 12450"
 * - "Impressions|12,450"
 */
export async function parsePDFMetrics(buffer: Buffer): Promise<ParsedMetrics> {
  try {
    const data = await pdf(buffer);
    const text = data.text;
    
    // Patterns to search for each metric
    const metrics: ParsedMetrics = {
      impressions: 0,
      reach: 0,
      clicks: 0,
      engagements: 0,
      spend: 0,
      conversions: 0,
      leads: 0,
      videoViews: 0,
      viralImpressions: 0,
    };
    
    // Define patterns for each metric
    const patterns = {
      impressions: /impressions?[:\s|]+([0-9,.KM]+)/i,
      reach: /reach[:\s|]+([0-9,.KM]+)/i,
      clicks: /clicks?[:\s|]+([0-9,.KM]+)/i,
      engagements: /engagements?[:\s|]+([0-9,.KM]+)/i,
      spend: /(?:spend|cost|amount)[:\s|]+\$?([0-9,.KM]+)/i,
      conversions: /conversions?[:\s|]+([0-9,.KM]+)/i,
      leads: /leads?[:\s|]+([0-9,.KM]+)/i,
      videoViews: /(?:video\s*views?|views?)[:\s|]+([0-9,.KM]+)/i,
      viralImpressions: /(?:viral\s*impressions?|organic\s*impressions?)[:\s|]+([0-9,.KM]+)/i,
    };
    
    // Extract each metric
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        metrics[key as keyof ParsedMetrics] = extractNumber(match[1]);
      }
    }
    
    return metrics;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF document');
  }
}

/**
 * Get a summary of the parsed metrics for debugging
 */
export function getMetricsSummary(metrics: ParsedMetrics): string {
  return Object.entries(metrics)
    .map(([key, value]) => `${key}: ${value.toLocaleString()}`)
    .join(', ');
}
