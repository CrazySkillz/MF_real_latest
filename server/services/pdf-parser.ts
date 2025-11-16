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
  
  // Enterprise validation metadata
  _confidence?: number; // 0-100 confidence score
  _warnings?: string[]; // Validation warnings
  _extractedFields?: number; // Number of fields successfully extracted
  _requiresReview?: boolean; // True if confidence < 95%
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
 * - William Reed format: Industry-specific metrics from william-reed.com reports
 */
export async function parsePDFMetrics(buffer: Buffer): Promise<ParsedMetrics> {
  try {
    // Convert Buffer to Uint8Array as required by PDFParse
    const uint8Array = new Uint8Array(buffer);
    const parser = new PDFParse(uint8Array);
    const textResult = await parser.getText();
    const text = textResult?.text || '';
    
    console.log('[PDF Parser] Extracted text length:', text.length);
    console.log('[PDF Parser] First 500 chars:', text.substring(0, 500));
    
    // Detect if this is a William Reed report
    const isWilliamReed = /william[\s-]?reed/i.test(text) || 
                          /food[\s&]+drink/i.test(text) ||
                          /convenience\s+store/i.test(text);
    
    if (isWilliamReed) {
      console.log('[PDF Parser] ✅ Detected William Reed report format');
    }
    
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
      
      // Audience & Traffic metrics (GA4 style + William Reed formats)
      users: /(?:users?\s*\(unique\)|unique\s*users?|unique\s*visitors?|visitors?)[:\s|]+([0-9,.KM]+)/i,
      sessions: /(?:sessions?|visits?)[:\s|]+([0-9,.KM]+)/i,
      pageviews: /(?:pageviews?|page\s*views?|pages?\s*viewed)[:\s|]+([0-9,.KM]+)/i,
      avgSessionDuration: /(?:avg\.?\s*session\s*duration|average\s*session\s*duration|avg\.?\s*time\s*on\s*site|average\s*time)[:\s|]+([0-9:]+)/i,
      pagesPerSession: /(?:pages?\s*\/\s*session|pages?\s*per\s*session|pages?\s*per\s*visit)[:\s|]+([0-9,.]+)/i,
      bounceRate: /(?:bounce\s*rate|exit\s*rate)[:\s|]+([0-9,.]+)%?/i,
      
      // Traffic sources (percentages) - Enhanced for William Reed
      organicSearchShare: /(?:organic\s*search|organic\s*traffic|search\s*engines?)[:\s|]+([0-9,.]+)%?/i,
      directBrandedShare: /(?:direct\s*\/?\s*branded|direct\s*traffic|direct)[:\s|]+([0-9,.]+)%?/i,
      emailShare: /(?:email\s*\(newsletters?\)|email\s*campaigns?|email\s*traffic|email)[:\s|]+([0-9,.]+)%?/i,
      referralShare: /(?:referral\s*\/?\s*partners?|referral\s*traffic|referrals?)[:\s|]+([0-9,.]+)%?/i,
      paidShare: /(?:paid\s*\(display\/search\)|paid\s*advertising|paid\s*traffic|paid)[:\s|]+([0-9,.]+)%?/i,
      socialShare: /(?:social\s*media|social\s*traffic|social)[:\s|]+([0-9,.]+)%?/i,
      
      // Email performance metrics (William Reed newsletter formats)
      emailsDelivered: /(?:emails?\s*delivered|emails?\s*sent|delivered)[:\s|]+([0-9,.KM]+)/i,
      openRate: /(?:open\s*rate|opens?)\s*(?:\(unique\))?[:\s|]+([0-9,.]+)%?/i,
      clickThroughRate: /(?:click-through\s*rate|click\s*-\s*through\s*rate|click\s*rate|ctr)\s*(?:\(ctr\))?[:\s|]+([0-9,.]+)%?/i,
      clickToOpenRate: /(?:click-to-open|click\s*-\s*to\s*-\s*open|ctor)\s*(?:\(ctor\))?[:\s|]+([0-9,.]+)%?/i,
      hardBounces: /(?:hard\s*bounces?|bounces?)[:\s|]+([0-9,.]+)%?/i,
      spamComplaints: /(?:spam\s*complaints?|complaints?)[:\s|]+([0-9,.]+)%?/i,
      listGrowth: /(?:list\s*growth\s*(?:\(net\))?|net\s*subscribers?|subscriber\s*growth|new\s*subscribers?)[:\s|]+\+?([0-9,.KM]+)/i,
    };
    
    // Extract each metric
    let extractedCount = 0;
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        // Special handling for time duration
        if (key === 'avgSessionDuration') {
          metrics[key as keyof ParsedMetrics] = match[1]; // Keep as string "00:02:38"
        } else {
          metrics[key as keyof ParsedMetrics] = extractNumber(match[1]);
        }
        extractedCount++;
      }
    }
    
    // Enterprise validation
    const validation = validateExtractedMetrics(metrics, extractedCount, Object.keys(patterns).length);
    metrics._confidence = validation.confidence;
    metrics._warnings = validation.warnings;
    metrics._extractedFields = extractedCount;
    metrics._requiresReview = validation.confidence < 95; // Enterprise threshold
    
    console.log('[PDF Parser] ✅ Validation complete');
    console.log('[PDF Parser] Confidence:', validation.confidence + '%');
    console.log('[PDF Parser] Extracted:', extractedCount, '/', Object.keys(patterns).length, 'fields');
    
    if (validation.warnings.length > 0) {
      console.warn('[PDF Parser] ⚠️  Warnings:', validation.warnings);
    }
    
    if (metrics._requiresReview) {
      console.warn('[PDF Parser] ⚠️  MANUAL REVIEW REQUIRED - Confidence below 95%');
    }
    
    // Set defaults for backward compatibility if no metrics found
    if (extractedCount === 0) {
      metrics.impressions = 0;
      metrics.reach = 0;
      metrics.clicks = 0;
      metrics.engagements = 0;
      metrics.spend = 0;
      metrics.conversions = 0;
      metrics.leads = 0;
      metrics.videoViews = 0;
      metrics.viralImpressions = 0;
      metrics._confidence = 0;
      metrics._warnings = ['No metrics extracted from PDF'];
      metrics._requiresReview = true;
    }
    
    return metrics;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF document');
  }
}

/**
 * Enterprise-grade validation of extracted metrics
 * Returns confidence score (0-100) and list of warnings
 */
function validateExtractedMetrics(
  metrics: ParsedMetrics, 
  extractedCount: number, 
  totalPatterns: number
): { confidence: number; warnings: string[] } {
  const warnings: string[] = [];
  let confidence = 100;
  
  // Check extraction completeness
  const extractionRate = (extractedCount / totalPatterns) * 100;
  if (extractionRate < 30) {
    warnings.push(`❌ CRITICAL: Very low extraction rate (${extractionRate.toFixed(0)}%)`);
    confidence -= 40;
  } else if (extractionRate < 50) {
    warnings.push(`⚠️  WARNING: Low extraction rate (${extractionRate.toFixed(0)}%)`);
    confidence -= 20;
  }
  
  // Validate required metrics for website analytics
  const requiredMetrics: (keyof ParsedMetrics)[] = ['users', 'sessions', 'pageviews'];
  const missingRequired = requiredMetrics.filter(m => metrics[m] === undefined || metrics[m] === 0);
  
  if (missingRequired.length > 0) {
    warnings.push(`❌ CRITICAL: Missing required metrics: ${missingRequired.join(', ')}`);
    confidence -= missingRequired.length * 25; // -25% per missing required metric
  }
  
  // Validate data ranges
  if (metrics.users !== undefined) {
    if (metrics.users < 0) {
      warnings.push(`❌ CRITICAL: Users cannot be negative (${metrics.users})`);
      confidence -= 30;
    } else if (metrics.users > 100000000) {
      warnings.push(`⚠️  WARNING: Users value unusually high (${metrics.users})`);
      confidence -= 5;
    }
  }
  
  if (metrics.sessions !== undefined && metrics.sessions < 0) {
    warnings.push(`❌ CRITICAL: Sessions cannot be negative (${metrics.sessions})`);
    confidence -= 30;
  }
  
  if (metrics.pageviews !== undefined && metrics.pageviews < 0) {
    warnings.push(`❌ CRITICAL: Pageviews cannot be negative (${metrics.pageviews})`);
    confidence -= 30;
  }
  
  // Validate percentage ranges
  const percentageMetrics: (keyof ParsedMetrics)[] = [
    'bounceRate', 'openRate', 'clickThroughRate', 'clickToOpenRate',
    'hardBounces', 'spamComplaints', 'organicSearchShare', 'directBrandedShare',
    'emailShare', 'referralShare', 'paidShare', 'socialShare'
  ];
  
  for (const metric of percentageMetrics) {
    const value = metrics[metric];
    if (value !== undefined && (value < 0 || value > 100)) {
      warnings.push(`❌ CRITICAL: ${metric} out of range (0-100): ${value}%`);
      confidence -= 15;
    }
  }
  
  // Validate logical relationships
  if (metrics.users !== undefined && metrics.sessions !== undefined) {
    if (metrics.sessions < metrics.users) {
      warnings.push(`⚠️  WARNING: Sessions (${metrics.sessions}) < Users (${metrics.users}) - unusual but possible`);
      confidence -= 5;
    }
  }
  
  if (metrics.sessions !== undefined && metrics.pageviews !== undefined) {
    if (metrics.pageviews < metrics.sessions) {
      warnings.push(`❌ CRITICAL: Pageviews (${metrics.pageviews}) < Sessions (${metrics.sessions}) - this is invalid`);
      confidence -= 20;
    }
  }
  
  if (metrics.pagesPerSession !== undefined) {
    if (metrics.pagesPerSession < 1) {
      warnings.push(`❌ CRITICAL: Pages per session cannot be < 1 (${metrics.pagesPerSession})`);
      confidence -= 20;
    } else if (metrics.pagesPerSession > 100) {
      warnings.push(`⚠️  WARNING: Pages per session unusually high (${metrics.pagesPerSession})`);
      confidence -= 5;
    }
  }
  
  // Validate email metrics relationships
  if (metrics.clickThroughRate !== undefined && metrics.openRate !== undefined) {
    if (metrics.clickThroughRate > metrics.openRate) {
      warnings.push(`❌ CRITICAL: Click rate (${metrics.clickThroughRate}%) > Open rate (${metrics.openRate}%) - impossible`);
      confidence -= 20;
    }
  }
  
  // Ensure confidence is within 0-100
  confidence = Math.max(0, Math.min(100, confidence));
  
  return { confidence, warnings };
}

/**
 * Get a summary of the parsed metrics for debugging
 */
export function getMetricsSummary(metrics: ParsedMetrics): string {
  const metricEntries = Object.entries(metrics)
    .filter(([key]) => !key.startsWith('_')) // Exclude metadata fields
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`);
  
  const summary = metricEntries.join(', ');
  const confidence = metrics._confidence !== undefined ? ` [Confidence: ${metrics._confidence}%]` : '';
  const review = metrics._requiresReview ? ' [REQUIRES REVIEW]' : '';
  
  return summary + confidence + review;
}
