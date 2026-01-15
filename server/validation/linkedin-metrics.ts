import { z } from 'zod';

/**
 * LinkedIn Metrics Validation Schema
 * Ensures all imported metrics meet data quality standards
 */
export const LinkedInMetricSchema = z.object({
  campaignUrn: z.string().min(1, "Campaign URN is required"),
  campaignName: z.string().min(1, "Campaign name is required"),
  campaignStatus: z.enum(['active', 'paused', 'archived', 'draft']).optional(),
  metricKey: z.enum([
    'impressions',
    'reach',
    'clicks',
    'engagements',
    'spend',
    'conversions',
    'leads',
    'videoViews',
    'viralImpressions'
  ]),
  metricValue: z.union([
    z.string().regex(/^\d+(\.\d+)?$/, "Must be a valid number string"),
    z.number()
  ]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num) || !isFinite(num)) {
      throw new Error(`Invalid numeric value: ${val}`);
    }
    return num;
  }),
});

/**
 * Acceptable value ranges for core metrics
 * Based on LinkedIn platform limits and real-world maximums
 */
export const LinkedInMetricConstraints: Record<string, { min: number; max: number; description: string }> = {
  impressions: { 
    min: 0, 
    max: 1000000000, // 1 billion
    description: "Total impressions cannot exceed 1 billion per campaign"
  },
  reach: { 
    min: 0, 
    max: 1000000000,
    description: "Reach cannot exceed 1 billion"
  },
  clicks: { 
    min: 0, 
    max: 100000000, // 100 million
    description: "Clicks cannot exceed 100 million"
  },
  engagements: { 
    min: 0, 
    max: 100000000,
    description: "Engagements cannot exceed 100 million"
  },
  spend: { 
    min: 0, 
    max: 10000000, // $10 million
    description: "Spend cannot exceed $10 million per campaign"
  },
  conversions: { 
    min: 0, 
    max: 1000000, // 1 million
    description: "Conversions cannot exceed 1 million"
  },
  leads: { 
    min: 0, 
    max: 1000000,
    description: "Leads cannot exceed 1 million"
  },
  videoViews: { 
    min: 0, 
    max: 100000000,
    description: "Video views cannot exceed 100 million"
  },
  viralImpressions: { 
    min: 0, 
    max: 1000000000,
    description: "Viral impressions cannot exceed 1 billion"
  },
};

/**
 * Acceptable ranges for derived metrics
 */
export const DerivedMetricConstraints: Record<string, { min: number; max: number; description: string }> = {
  ctr: { 
    min: 0, 
    max: 100, 
    description: "CTR cannot exceed 100%" 
  },
  cvr: { 
    min: 0, 
    max: 100, 
    description: "Conversion rate cannot exceed 100%" 
  },
  er: { 
    min: 0, 
    max: 100, 
    description: "Engagement rate cannot exceed 100%" 
  },
  cpc: { 
    min: 0, 
    max: 1000, 
    description: "CPC cannot exceed $1,000 (extremely high but possible for premium B2B)" 
  },
  cpm: { 
    min: 0, 
    max: 10000, 
    description: "CPM cannot exceed $10,000" 
  },
  cpa: { 
    min: 0, 
    max: 100000, 
    description: "CPA cannot exceed $100,000 (high-value B2B)" 
  },
  cpl: { 
    min: 0, 
    max: 100000, 
    description: "CPL cannot exceed $100,000" 
  },
  roi: { 
    min: -100, 
    max: 100000, 
    description: "ROI can be negative (loss) but capped at 100,000%" 
  },
  roas: { 
    min: 0, 
    max: 1000, 
    description: "ROAS cannot exceed 1000x (extremely high but theoretically possible)" 
  },
  profitMargin: {
    // Profit margin can be less than -100% when spend/costs exceed revenue.
    // We cap at a very low floor to avoid infinite blow-ups when revenue is tiny, but keep values mathematically correct for executives.
    min: -100000,
    max: 100,
    description: "Profit margin can be negative (including below -100% when costs exceed revenue) and is capped at 100% on the upside"
  },
};

/**
 * Validate a core metric value against constraints
 */
export function validateMetricValue(metricKey: string, value: number): {
  isValid: boolean;
  error?: string;
} {
  const constraints = LinkedInMetricConstraints[metricKey as keyof typeof LinkedInMetricConstraints];
  
  if (!constraints) {
    return { isValid: true }; // Unknown metric, allow it
  }
  
  if (value < constraints.min) {
    return {
      isValid: false,
      error: `${metricKey} value ${value} is below minimum (${constraints.min}). ${constraints.description}`
    };
  }
  
  if (value > constraints.max) {
    return {
      isValid: false,
      error: `${metricKey} value ${value} exceeds maximum (${constraints.max}). ${constraints.description}`
    };
  }
  
  return { isValid: true };
}

/**
 * Validate a derived metric value against constraints
 */
export function validateDerivedMetric(metricKey: string, value: number): {
  isValid: boolean;
  error?: string;
  cappedValue?: number;
} {
  const constraints = DerivedMetricConstraints[metricKey];
  
  if (!constraints) {
    return { isValid: true }; // Unknown metric, allow it
  }
  
  if (value < constraints.min) {
    return {
      isValid: false,
      error: `${metricKey} value ${value} is below minimum (${constraints.min}). ${constraints.description}`,
      cappedValue: constraints.min
    };
  }
  
  if (value > constraints.max) {
    return {
      isValid: false,
      error: `${metricKey} value ${value} exceeds maximum (${constraints.max}). ${constraints.description}`,
      cappedValue: constraints.max
    };
  }
  
  return { isValid: true };
}

/**
 * Sanitize a calculated metric by capping it to acceptable ranges
 */
export function sanitizeCalculatedMetric(metricKey: string, value: number): number {
  // Check for NaN or Infinity
  if (isNaN(value) || !isFinite(value)) {
    console.warn(`[Sanity Check] ${metricKey} is NaN or Infinite, defaulting to 0`);
    return 0;
  }
  
  // Validate and cap if needed
  const validation = validateDerivedMetric(metricKey, value);
  
  if (!validation.isValid && validation.cappedValue !== undefined) {
    console.warn(`[Sanity Check] ${metricKey} value ${value} capped to ${validation.cappedValue}`);
    return validation.cappedValue;
  }
  
  return value;
}

/**
 * Validate logical relationships between metrics
 * (e.g., clicks cannot exceed impressions)
 */
export function validateMetricRelationships(metrics: Record<string, number>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Clicks cannot exceed impressions
  if (metrics.clicks > 0 && metrics.impressions > 0) {
    if (metrics.clicks > metrics.impressions) {
      errors.push(`Clicks (${metrics.clicks}) cannot exceed impressions (${metrics.impressions})`);
    }
  }
  
  // Reach cannot exceed impressions (reach is unique users, impressions include repeats)
  if (metrics.reach > 0 && metrics.impressions > 0) {
    if (metrics.reach > metrics.impressions) {
      errors.push(`Reach (${metrics.reach}) cannot exceed impressions (${metrics.impressions})`);
    }
  }
  
  // Conversions cannot exceed clicks
  if (metrics.conversions > 0 && metrics.clicks > 0) {
    if (metrics.conversions > metrics.clicks) {
      errors.push(`Conversions (${metrics.conversions}) cannot exceed clicks (${metrics.clicks})`);
    }
  }
  
  // Leads cannot exceed clicks
  if (metrics.leads > 0 && metrics.clicks > 0) {
    if (metrics.leads > metrics.clicks) {
      errors.push(`Leads (${metrics.leads}) cannot exceed clicks (${metrics.clicks})`);
    }
  }
  
  // Engagements should be reasonable relative to impressions
  if (metrics.engagements > 0 && metrics.impressions > 0) {
    const engagementRate = (metrics.engagements / metrics.impressions) * 100;
    if (engagementRate > 50) {
      errors.push(`Engagement rate (${engagementRate.toFixed(1)}%) is unusually high. Engagements: ${metrics.engagements}, Impressions: ${metrics.impressions}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Data quality scoring
 */
export function calculateDataQualityScore(
  totalMetrics: number,
  validMetrics: number,
  relationshipErrors: number
): {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  message: string;
} {
  const validityScore = (validMetrics / totalMetrics) * 100;
  const relationshipPenalty = relationshipErrors * 5; // Each error reduces score by 5%
  const finalScore = Math.max(0, validityScore - relationshipPenalty);
  
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  let message: string;
  
  if (finalScore >= 95) {
    grade = 'A';
    message = 'Excellent data quality';
  } else if (finalScore >= 85) {
    grade = 'B';
    message = 'Good data quality';
  } else if (finalScore >= 75) {
    grade = 'C';
    message = 'Acceptable data quality with minor issues';
  } else if (finalScore >= 60) {
    grade = 'D';
    message = 'Poor data quality - review data source';
  } else {
    grade = 'F';
    message = 'Critical data quality issues - data may be unreliable';
  }
  
  return { score: finalScore, grade, message };
}

/**
 * Validation error interface
 */
export interface ValidationError {
  metric: string;
  value: any;
  campaign: string;
  error: string;
  timestamp: Date;
}

/**
 * Validation summary interface
 */
export interface ValidationSummary {
  totalMetrics: number;
  validMetrics: number;
  invalidMetrics: number;
  relationshipErrors: string[];
  dataQuality: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    message: string;
  };
  errors: ValidationError[];
}

