import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export interface ParsedMetrics {
  // Legacy social media metrics
  impressions?: number;
  reach?: number;
  clicks?: number;
  engagements?: number;
  spend?: number;
  conversions?: number;
  leads?: number;
  videoViews?: number;
  viralImpressions?: number;
  
  // Audience & Traffic metrics
  users?: number;
  sessions?: number;
  pageviews?: number;
  avgSessionDuration?: string;
  pagesPerSession?: number;
  bounceRate?: number;
  
  // Traffic sources (percentages)
  organicSearchShare?: number;
  directBrandedShare?: number;
  emailShare?: number;
  referralShare?: number;
  paidShare?: number;
  socialShare?: number;
  
  // Email performance metrics
  emailsDelivered?: number;
  openRate?: number;
  clickThroughRate?: number;
  clickToOpenRate?: number;
  hardBounces?: number;
  spamComplaints?: number;
  listGrowth?: number;
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
 * Supports multiple formats:
 * - Table format (GA4 style): "Users (unique) | 1,275,432"
 * - Simple format: "Impressions: 12,450"
 * - Inline format: "Impressions 12450"
 */
export async function parsePDFMetrics(buffer: Buffer): Promise<ParsedMetrics> {
  try {
    // Convert Buffer to Uint8Array as required by PDFParse
    const uint8Array = new Uint8Array(buffer);
    const parser = new PDFParse(uint8Array);
    const textResult = await parser.getText();
    const text = textResult?.text || '';
    
    console.log('[PDF Parser] Extracted text length:', text.length);
    console.log('[PDF Parser] First 200 chars:', text.substring(0, 200));
    
    // Debug: Find all mentions of "rate" in the text
    const rateMatches = text.match(/.*rate.*/gi);
    if (rateMatches) {
      console.log('[PDF Parser] Found rate-related lines:', rateMatches.slice(0, 10));
    }
    
    // Debug: Find all mentions of "click" in the text
    const clickMatches = text.match(/.*click.*/gi);
    if (clickMatches) {
      console.log('[PDF Parser] Found click-related lines:', clickMatches.slice(0, 10));
    }
    
    // Debug: Find all mentions of "growth" in the text
    const growthMatches = text.match(/.*growth.*/gi);
    if (growthMatches) {
      console.log('[PDF Parser] Found growth-related lines:', growthMatches);
    }
    
    const metrics: ParsedMetrics = {};
    
    // Define patterns for all metrics
    const patterns = {
      // Legacy social media metrics
      impressions: /impressions?[:\s|]+([0-9,.KM]+)/i,
      reach: /reach[:\s|]+([0-9,.KM]+)/i,
      clicks: /clicks?[:\s|]+([0-9,.KM]+)/i,
      engagements: /engagements?[:\s|]+([0-9,.KM]+)/i,
      spend: /(?:spend|cost|amount)[:\s|]+\$?([0-9,.KM]+)/i,
      conversions: /conversions?[:\s|]+([0-9,.KM]+)/i,
      leads: /leads?[:\s|]+([0-9,.KM]+)/i,
      videoViews: /(?:video\s*views?|views?)[:\s|]+([0-9,.KM]+)/i,
      viralImpressions: /(?:viral\s*impressions?|organic\s*impressions?)[:\s|]+([0-9,.KM]+)/i,
      
      // Audience & Traffic metrics (GA4 style)
      users: /(?:users?\s*\(unique\)|unique\s*users?)[:\s|]+([0-9,.KM]+)/i,
      sessions: /sessions?[:\s|]+([0-9,.KM]+)/i,
      pageviews: /pageviews?[:\s|]+([0-9,.KM]+)/i,
      avgSessionDuration: /(?:avg\.?\s*session\s*duration|average\s*session\s*duration)[:\s|]+([0-9:]+)/i,
      pagesPerSession: /(?:pages?\s*\/\s*session|pages?\s*per\s*session)[:\s|]+([0-9,.]+)/i,
      bounceRate: /bounce\s*rate[:\s|]+([0-9,.]+)%?/i,
      
      // Traffic sources (percentages)
      organicSearchShare: /organic\s*search[:\s|]+([0-9,.]+)%?/i,
      directBrandedShare: /(?:direct\s*\/?\s*branded|direct)[:\s|]+([0-9,.]+)%?/i,
      emailShare: /(?:email\s*\(newsletters?\)|email)[:\s|]+([0-9,.]+)%?/i,
      referralShare: /(?:referral\s*\/?\s*partners?|referral)[:\s|]+([0-9,.]+)%?/i,
      paidShare: /(?:paid\s*\(display\/search\)|paid)[:\s|]+([0-9,.]+)%?/i,
      socialShare: /social[:\s|]+([0-9,.]+)%?/i,
      
      // Email performance metrics
      emailsDelivered: /(?:emails?\s*delivered|delivered)[:\s|]+([0-9,.KM]+)/i,
      openRate: /open\s*rate\s*(?:\(unique\))?[:\s|]+([0-9,.]+)%?/i,
      clickThroughRate: /(?:click-through\s*rate|click\s*-\s*through\s*rate|ctr)\s*(?:\(ctr\))?[:\s|]+([0-9,.]+)%?/i,
      clickToOpenRate: /(?:click-to-open|click\s*-\s*to\s*-\s*open|ctor)\s*(?:\(ctor\))?[:\s|]+([0-9,.]+)%?/i,
      hardBounces: /hard\s*bounces?[:\s|]+([0-9,.]+)%?/i,
      spamComplaints: /spam\s*complaints?[:\s|]+([0-9,.]+)%?/i,
      listGrowth: /(?:list\s*growth\s*(?:\(net\))?|net\s*subscribers?)[:\s|]+\+?([0-9,.KM]+)/i,
    };
    
    // Extract each metric
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        // Special handling for time duration
        if (key === 'avgSessionDuration') {
          metrics[key as keyof ParsedMetrics] = match[1]; // Keep as string "00:02:38"
        } else {
          metrics[key as keyof ParsedMetrics] = extractNumber(match[1]);
        }
      }
    }
    
    // Set defaults for backward compatibility if no metrics found
    if (Object.keys(metrics).length === 0) {
      metrics.impressions = 0;
      metrics.reach = 0;
      metrics.clicks = 0;
      metrics.engagements = 0;
      metrics.spend = 0;
      metrics.conversions = 0;
      metrics.leads = 0;
      metrics.videoViews = 0;
      metrics.viralImpressions = 0;
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
