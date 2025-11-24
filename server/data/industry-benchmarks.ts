// Industry benchmark presets for LinkedIn Ads
// Based on industry standards and public reports

export interface BenchmarkThresholds {
  target: number;
  poor: number;
  fair: number;
  good: number;
  excellent: number;
  unit: string;
}

export interface IndustryBenchmarks {
  [metric: string]: BenchmarkThresholds;
}

export const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmarks> = {
  technology: {
    ctr: {
      target: 2.0,
      poor: 1.0,
      fair: 1.5,
      good: 2.0,
      excellent: 2.5,
      unit: '%'
    },
    cpc: {
      target: 3.5,
      poor: 5.0,
      fair: 4.0,
      good: 3.5,
      excellent: 3.0,
      unit: '$'
    },
    cpm: {
      target: 30.0,
      poor: 50.0,
      fair: 40.0,
      good: 30.0,
      excellent: 20.0,
      unit: '$'
    },
    cvr: {
      target: 3.0,
      poor: 1.5,
      fair: 2.5,
      good: 3.0,
      excellent: 4.0,
      unit: '%'
    },
    cpa: {
      target: 100.0,
      poor: 150.0,
      fair: 125.0,
      good: 100.0,
      excellent: 75.0,
      unit: '$'
    },
    cpl: {
      target: 80.0,
      poor: 120.0,
      fair: 100.0,
      good: 80.0,
      excellent: 60.0,
      unit: '$'
    },
    er: {
      target: 2.5,
      poor: 1.0,
      fair: 1.5,
      good: 2.5,
      excellent: 3.5,
      unit: '%'
    },
    roi: {
      target: 300.0,
      poor: 100.0,
      fair: 200.0,
      good: 300.0,
      excellent: 400.0,
      unit: '%'
    },
    roas: {
      target: 4.0,
      poor: 2.0,
      fair: 3.0,
      good: 4.0,
      excellent: 5.0,
      unit: 'x'
    }
  },
  
  ecommerce: {
    ctr: {
      target: 1.8,
      poor: 0.8,
      fair: 1.3,
      good: 1.8,
      excellent: 2.3,
      unit: '%'
    },
    cpc: {
      target: 2.5,
      poor: 4.0,
      fair: 3.0,
      good: 2.5,
      excellent: 2.0,
      unit: '$'
    },
    cpm: {
      target: 25.0,
      poor: 40.0,
      fair: 32.0,
      good: 25.0,
      excellent: 18.0,
      unit: '$'
    },
    cvr: {
      target: 2.5,
      poor: 1.0,
      fair: 1.8,
      good: 2.5,
      excellent: 3.5,
      unit: '%'
    },
    cpa: {
      target: 80.0,
      poor: 120.0,
      fair: 100.0,
      good: 80.0,
      excellent: 60.0,
      unit: '$'
    },
    cpl: {
      target: 65.0,
      poor: 100.0,
      fair: 80.0,
      good: 65.0,
      excellent: 50.0,
      unit: '$'
    },
    er: {
      target: 3.0,
      poor: 1.5,
      fair: 2.2,
      good: 3.0,
      excellent: 4.0,
      unit: '%'
    },
    roi: {
      target: 350.0,
      poor: 150.0,
      fair: 250.0,
      good: 350.0,
      excellent: 450.0,
      unit: '%'
    },
    roas: {
      target: 4.5,
      poor: 2.5,
      fair: 3.5,
      good: 4.5,
      excellent: 5.5,
      unit: 'x'
    }
  },
  
  healthcare: {
    ctr: {
      target: 1.5,
      poor: 0.7,
      fair: 1.1,
      good: 1.5,
      excellent: 2.0,
      unit: '%'
    },
    cpc: {
      target: 4.0,
      poor: 6.0,
      fair: 5.0,
      good: 4.0,
      excellent: 3.0,
      unit: '$'
    },
    cpm: {
      target: 35.0,
      poor: 55.0,
      fair: 45.0,
      good: 35.0,
      excellent: 25.0,
      unit: '$'
    },
    cvr: {
      target: 2.0,
      poor: 0.8,
      fair: 1.4,
      good: 2.0,
      excellent: 2.8,
      unit: '%'
    },
    cpa: {
      target: 120.0,
      poor: 180.0,
      fair: 150.0,
      good: 120.0,
      excellent: 90.0,
      unit: '$'
    },
    cpl: {
      target: 100.0,
      poor: 150.0,
      fair: 125.0,
      good: 100.0,
      excellent: 75.0,
      unit: '$'
    },
    er: {
      target: 2.0,
      poor: 0.8,
      fair: 1.4,
      good: 2.0,
      excellent: 2.8,
      unit: '%'
    },
    roi: {
      target: 250.0,
      poor: 100.0,
      fair: 175.0,
      good: 250.0,
      excellent: 350.0,
      unit: '%'
    },
    roas: {
      target: 3.5,
      poor: 2.0,
      fair: 2.8,
      good: 3.5,
      excellent: 4.5,
      unit: 'x'
    }
  },
  
  finance: {
    ctr: {
      target: 1.2,
      poor: 0.5,
      fair: 0.9,
      good: 1.2,
      excellent: 1.6,
      unit: '%'
    },
    cpc: {
      target: 5.0,
      poor: 8.0,
      fair: 6.5,
      good: 5.0,
      excellent: 3.5,
      unit: '$'
    },
    cpm: {
      target: 45.0,
      poor: 70.0,
      fair: 57.0,
      good: 45.0,
      excellent: 33.0,
      unit: '$'
    },
    cvr: {
      target: 1.8,
      poor: 0.7,
      fair: 1.2,
      good: 1.8,
      excellent: 2.5,
      unit: '%'
    },
    cpa: {
      target: 150.0,
      poor: 225.0,
      fair: 187.0,
      good: 150.0,
      excellent: 112.0,
      unit: '$'
    },
    cpl: {
      target: 130.0,
      poor: 195.0,
      fair: 162.0,
      good: 130.0,
      excellent: 97.0,
      unit: '$'
    },
    er: {
      target: 1.5,
      poor: 0.6,
      fair: 1.0,
      good: 1.5,
      excellent: 2.2,
      unit: '%'
    },
    roi: {
      target: 200.0,
      poor: 75.0,
      fair: 137.0,
      good: 200.0,
      excellent: 300.0,
      unit: '%'
    },
    roas: {
      target: 3.0,
      poor: 1.8,
      fair: 2.4,
      good: 3.0,
      excellent: 4.0,
      unit: 'x'
    }
  },
  
  education: {
    ctr: {
      target: 2.2,
      poor: 1.0,
      fair: 1.6,
      good: 2.2,
      excellent: 2.8,
      unit: '%'
    },
    cpc: {
      target: 3.0,
      poor: 5.0,
      fair: 4.0,
      good: 3.0,
      excellent: 2.0,
      unit: '$'
    },
    cpm: {
      target: 28.0,
      poor: 45.0,
      fair: 36.0,
      good: 28.0,
      excellent: 20.0,
      unit: '$'
    },
    cvr: {
      target: 3.5,
      poor: 1.5,
      fair: 2.5,
      good: 3.5,
      excellent: 4.5,
      unit: '%'
    },
    cpa: {
      target: 85.0,
      poor: 130.0,
      fair: 107.0,
      good: 85.0,
      excellent: 63.0,
      unit: '$'
    },
    cpl: {
      target: 70.0,
      poor: 105.0,
      fair: 87.0,
      good: 70.0,
      excellent: 52.0,
      unit: '$'
    },
    er: {
      target: 3.5,
      poor: 1.5,
      fair: 2.5,
      good: 3.5,
      excellent: 4.5,
      unit: '%'
    },
    roi: {
      target: 320.0,
      poor: 120.0,
      fair: 220.0,
      good: 320.0,
      excellent: 420.0,
      unit: '%'
    },
    roas: {
      target: 4.2,
      poor: 2.2,
      fair: 3.2,
      good: 4.2,
      excellent: 5.2,
      unit: 'x'
    }
  },
  
  'real-estate': {
    ctr: {
      target: 1.6,
      poor: 0.7,
      fair: 1.1,
      good: 1.6,
      excellent: 2.2,
      unit: '%'
    },
    cpc: {
      target: 4.5,
      poor: 7.0,
      fair: 5.7,
      good: 4.5,
      excellent: 3.2,
      unit: '$'
    },
    cpm: {
      target: 38.0,
      poor: 60.0,
      fair: 49.0,
      good: 38.0,
      excellent: 27.0,
      unit: '$'
    },
    cvr: {
      target: 2.2,
      poor: 0.9,
      fair: 1.5,
      good: 2.2,
      excellent: 3.0,
      unit: '%'
    },
    cpa: {
      target: 110.0,
      poor: 165.0,
      fair: 137.0,
      good: 110.0,
      excellent: 82.0,
      unit: '$'
    },
    cpl: {
      target: 95.0,
      poor: 142.0,
      fair: 118.0,
      good: 95.0,
      excellent: 71.0,
      unit: '$'
    },
    er: {
      target: 2.2,
      poor: 0.9,
      fair: 1.5,
      good: 2.2,
      excellent: 3.0,
      unit: '%'
    },
    roi: {
      target: 280.0,
      poor: 110.0,
      fair: 195.0,
      good: 280.0,
      excellent: 380.0,
      unit: '%'
    },
    roas: {
      target: 3.8,
      poor: 2.1,
      fair: 2.9,
      good: 3.8,
      excellent: 4.8,
      unit: 'x'
    }
  },
  
  'professional-services': {
    ctr: {
      target: 1.9,
      poor: 0.9,
      fair: 1.4,
      good: 1.9,
      excellent: 2.5,
      unit: '%'
    },
    cpc: {
      target: 3.8,
      poor: 6.0,
      fair: 4.9,
      good: 3.8,
      excellent: 2.7,
      unit: '$'
    },
    cpm: {
      target: 32.0,
      poor: 50.0,
      fair: 41.0,
      good: 32.0,
      excellent: 23.0,
      unit: '$'
    },
    cvr: {
      target: 2.8,
      poor: 1.2,
      fair: 2.0,
      good: 2.8,
      excellent: 3.6,
      unit: '%'
    },
    cpa: {
      target: 95.0,
      poor: 142.0,
      fair: 118.0,
      good: 95.0,
      excellent: 71.0,
      unit: '$'
    },
    cpl: {
      target: 75.0,
      poor: 112.0,
      fair: 93.0,
      good: 75.0,
      excellent: 56.0,
      unit: '$'
    },
    er: {
      target: 2.8,
      poor: 1.2,
      fair: 2.0,
      good: 2.8,
      excellent: 3.6,
      unit: '%'
    },
    roi: {
      target: 310.0,
      poor: 130.0,
      fair: 220.0,
      good: 310.0,
      excellent: 410.0,
      unit: '%'
    },
    roas: {
      target: 4.1,
      poor: 2.3,
      fair: 3.2,
      good: 4.1,
      excellent: 5.1,
      unit: 'x'
    }
  },
  
  retail: {
    ctr: {
      target: 2.1,
      poor: 1.0,
      fair: 1.5,
      good: 2.1,
      excellent: 2.7,
      unit: '%'
    },
    cpc: {
      target: 2.8,
      poor: 4.5,
      fair: 3.6,
      good: 2.8,
      excellent: 2.0,
      unit: '$'
    },
    cpm: {
      target: 26.0,
      poor: 42.0,
      fair: 34.0,
      good: 26.0,
      excellent: 18.0,
      unit: '$'
    },
    cvr: {
      target: 3.2,
      poor: 1.4,
      fair: 2.3,
      good: 3.2,
      excellent: 4.1,
      unit: '%'
    },
    cpa: {
      target: 75.0,
      poor: 112.0,
      fair: 93.0,
      good: 75.0,
      excellent: 56.0,
      unit: '$'
    },
    cpl: {
      target: 60.0,
      poor: 90.0,
      fair: 75.0,
      good: 60.0,
      excellent: 45.0,
      unit: '$'
    },
    er: {
      target: 3.2,
      poor: 1.4,
      fair: 2.3,
      good: 3.2,
      excellent: 4.1,
      unit: '%'
    },
    roi: {
      target: 340.0,
      poor: 140.0,
      fair: 240.0,
      good: 340.0,
      excellent: 440.0,
      unit: '%'
    },
    roas: {
      target: 4.4,
      poor: 2.4,
      fair: 3.4,
      good: 4.4,
      excellent: 5.4,
      unit: 'x'
    }
  }
};

// Helper function to get list of industries
export function getIndustries(): string[] {
  return Object.keys(INDUSTRY_BENCHMARKS);
}

// Helper function to get benchmarks for a specific industry
export function getIndustryBenchmarks(industry: string): IndustryBenchmarks | null {
  return INDUSTRY_BENCHMARKS[industry] || null;
}

