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
  },
  
  'saas': {
    ctr: {
      target: 2.3,
      poor: 1.1,
      fair: 1.7,
      good: 2.3,
      excellent: 2.9,
      unit: '%'
    },
    cpc: {
      target: 3.2,
      poor: 5.2,
      fair: 4.2,
      good: 3.2,
      excellent: 2.2,
      unit: '$'
    },
    cpm: {
      target: 28.0,
      poor: 46.0,
      fair: 37.0,
      good: 28.0,
      excellent: 19.0,
      unit: '$'
    },
    cvr: {
      target: 3.5,
      poor: 1.6,
      fair: 2.5,
      good: 3.5,
      excellent: 4.5,
      unit: '%'
    },
    cpa: {
      target: 90.0,
      poor: 140.0,
      fair: 115.0,
      good: 90.0,
      excellent: 65.0,
      unit: '$'
    },
    cpl: {
      target: 72.0,
      poor: 110.0,
      fair: 91.0,
      good: 72.0,
      excellent: 53.0,
      unit: '$'
    },
    er: {
      target: 2.8,
      poor: 1.3,
      fair: 2.0,
      good: 2.8,
      excellent: 3.6,
      unit: '%'
    },
    roi: {
      target: 330.0,
      poor: 130.0,
      fair: 230.0,
      good: 330.0,
      excellent: 430.0,
      unit: '%'
    },
    roas: {
      target: 4.3,
      poor: 2.3,
      fair: 3.3,
      good: 4.3,
      excellent: 5.3,
      unit: 'x'
    }
  },
  
  'hospitality': {
    ctr: {
      target: 1.7,
      poor: 0.8,
      fair: 1.2,
      good: 1.7,
      excellent: 2.3,
      unit: '%'
    },
    cpc: {
      target: 3.3,
      poor: 5.5,
      fair: 4.4,
      good: 3.3,
      excellent: 2.2,
      unit: '$'
    },
    cpm: {
      target: 29.0,
      poor: 48.0,
      fair: 38.0,
      good: 29.0,
      excellent: 20.0,
      unit: '$'
    },
    cvr: {
      target: 2.3,
      poor: 1.0,
      fair: 1.6,
      good: 2.3,
      excellent: 3.1,
      unit: '%'
    },
    cpa: {
      target: 88.0,
      poor: 135.0,
      fair: 111.0,
      good: 88.0,
      excellent: 65.0,
      unit: '$'
    },
    cpl: {
      target: 70.0,
      poor: 108.0,
      fair: 89.0,
      good: 70.0,
      excellent: 51.0,
      unit: '$'
    },
    er: {
      target: 2.6,
      poor: 1.2,
      fair: 1.9,
      good: 2.6,
      excellent: 3.4,
      unit: '%'
    },
    roi: {
      target: 290.0,
      poor: 115.0,
      fair: 202.0,
      good: 290.0,
      excellent: 390.0,
      unit: '%'
    },
    roas: {
      target: 3.9,
      poor: 2.2,
      fair: 3.0,
      good: 3.9,
      excellent: 4.9,
      unit: 'x'
    }
  },
  
  'automotive': {
    ctr: {
      target: 1.4,
      poor: 0.6,
      fair: 1.0,
      good: 1.4,
      excellent: 1.9,
      unit: '%'
    },
    cpc: {
      target: 4.2,
      poor: 6.8,
      fair: 5.5,
      good: 4.2,
      excellent: 2.9,
      unit: '$'
    },
    cpm: {
      target: 36.0,
      poor: 58.0,
      fair: 47.0,
      good: 36.0,
      excellent: 25.0,
      unit: '$'
    },
    cvr: {
      target: 1.9,
      poor: 0.8,
      fair: 1.3,
      good: 1.9,
      excellent: 2.6,
      unit: '%'
    },
    cpa: {
      target: 125.0,
      poor: 192.0,
      fair: 158.0,
      good: 125.0,
      excellent: 92.0,
      unit: '$'
    },
    cpl: {
      target: 105.0,
      poor: 162.0,
      fair: 133.0,
      good: 105.0,
      excellent: 77.0,
      unit: '$'
    },
    er: {
      target: 1.8,
      poor: 0.8,
      fair: 1.3,
      good: 1.8,
      excellent: 2.5,
      unit: '%'
    },
    roi: {
      target: 240.0,
      poor: 95.0,
      fair: 167.0,
      good: 240.0,
      excellent: 340.0,
      unit: '%'
    },
    roas: {
      target: 3.4,
      poor: 2.0,
      fair: 2.7,
      good: 3.4,
      excellent: 4.4,
      unit: 'x'
    }
  },
  
  'manufacturing': {
    ctr: {
      target: 1.3,
      poor: 0.6,
      fair: 0.9,
      good: 1.3,
      excellent: 1.8,
      unit: '%'
    },
    cpc: {
      target: 4.8,
      poor: 7.5,
      fair: 6.1,
      good: 4.8,
      excellent: 3.4,
      unit: '$'
    },
    cpm: {
      target: 40.0,
      poor: 65.0,
      fair: 52.0,
      good: 40.0,
      excellent: 28.0,
      unit: '$'
    },
    cvr: {
      target: 1.7,
      poor: 0.7,
      fair: 1.2,
      good: 1.7,
      excellent: 2.4,
      unit: '%'
    },
    cpa: {
      target: 140.0,
      poor: 215.0,
      fair: 177.0,
      good: 140.0,
      excellent: 103.0,
      unit: '$'
    },
    cpl: {
      target: 118.0,
      poor: 182.0,
      fair: 150.0,
      good: 118.0,
      excellent: 86.0,
      unit: '$'
    },
    er: {
      target: 1.6,
      poor: 0.7,
      fair: 1.1,
      good: 1.6,
      excellent: 2.3,
      unit: '%'
    },
    roi: {
      target: 220.0,
      poor: 85.0,
      fair: 152.0,
      good: 220.0,
      excellent: 320.0,
      unit: '%'
    },
    roas: {
      target: 3.2,
      poor: 1.9,
      fair: 2.5,
      good: 3.2,
      excellent: 4.2,
      unit: 'x'
    }
  },
  
  'nonprofit': {
    ctr: {
      target: 2.5,
      poor: 1.2,
      fair: 1.8,
      good: 2.5,
      excellent: 3.2,
      unit: '%'
    },
    cpc: {
      target: 2.2,
      poor: 3.8,
      fair: 3.0,
      good: 2.2,
      excellent: 1.4,
      unit: '$'
    },
    cpm: {
      target: 22.0,
      poor: 38.0,
      fair: 30.0,
      good: 22.0,
      excellent: 14.0,
      unit: '$'
    },
    cvr: {
      target: 4.0,
      poor: 1.8,
      fair: 2.9,
      good: 4.0,
      excellent: 5.1,
      unit: '%'
    },
    cpa: {
      target: 55.0,
      poor: 85.0,
      fair: 70.0,
      good: 55.0,
      excellent: 40.0,
      unit: '$'
    },
    cpl: {
      target: 45.0,
      poor: 70.0,
      fair: 57.0,
      good: 45.0,
      excellent: 33.0,
      unit: '$'
    },
    er: {
      target: 4.2,
      poor: 1.9,
      fair: 3.0,
      good: 4.2,
      excellent: 5.4,
      unit: '%'
    },
    roi: {
      target: 380.0,
      poor: 160.0,
      fair: 270.0,
      good: 380.0,
      excellent: 490.0,
      unit: '%'
    },
    roas: {
      target: 4.8,
      poor: 2.6,
      fair: 3.7,
      good: 4.8,
      excellent: 5.9,
      unit: 'x'
    }
  },
  
  'legal': {
    ctr: {
      target: 1.1,
      poor: 0.5,
      fair: 0.8,
      good: 1.1,
      excellent: 1.5,
      unit: '%'
    },
    cpc: {
      target: 6.5,
      poor: 10.0,
      fair: 8.2,
      good: 6.5,
      excellent: 4.8,
      unit: '$'
    },
    cpm: {
      target: 52.0,
      poor: 82.0,
      fair: 67.0,
      good: 52.0,
      excellent: 37.0,
      unit: '$'
    },
    cvr: {
      target: 1.5,
      poor: 0.6,
      fair: 1.0,
      good: 1.5,
      excellent: 2.1,
      unit: '%'
    },
    cpa: {
      target: 180.0,
      poor: 275.0,
      fair: 227.0,
      good: 180.0,
      excellent: 133.0,
      unit: '$'
    },
    cpl: {
      target: 155.0,
      poor: 238.0,
      fair: 196.0,
      good: 155.0,
      excellent: 114.0,
      unit: '$'
    },
    er: {
      target: 1.3,
      poor: 0.6,
      fair: 0.9,
      good: 1.3,
      excellent: 1.8,
      unit: '%'
    },
    roi: {
      target: 180.0,
      poor: 70.0,
      fair: 125.0,
      good: 180.0,
      excellent: 280.0,
      unit: '%'
    },
    roas: {
      target: 2.8,
      poor: 1.7,
      fair: 2.2,
      good: 2.8,
      excellent: 3.8,
      unit: 'x'
    }
  },
  
  'insurance': {
    ctr: {
      target: 1.3,
      poor: 0.6,
      fair: 0.9,
      good: 1.3,
      excellent: 1.8,
      unit: '%'
    },
    cpc: {
      target: 5.5,
      poor: 8.8,
      fair: 7.1,
      good: 5.5,
      excellent: 3.9,
      unit: '$'
    },
    cpm: {
      target: 48.0,
      poor: 76.0,
      fair: 62.0,
      good: 48.0,
      excellent: 34.0,
      unit: '$'
    },
    cvr: {
      target: 1.6,
      poor: 0.7,
      fair: 1.1,
      good: 1.6,
      excellent: 2.2,
      unit: '%'
    },
    cpa: {
      target: 165.0,
      poor: 255.0,
      fair: 210.0,
      good: 165.0,
      excellent: 120.0,
      unit: '$'
    },
    cpl: {
      target: 142.0,
      poor: 220.0,
      fair: 181.0,
      good: 142.0,
      excellent: 103.0,
      unit: '$'
    },
    er: {
      target: 1.4,
      poor: 0.6,
      fair: 1.0,
      good: 1.4,
      excellent: 2.0,
      unit: '%'
    },
    roi: {
      target: 190.0,
      poor: 75.0,
      fair: 132.0,
      good: 190.0,
      excellent: 290.0,
      unit: '%'
    },
    roas: {
      target: 2.9,
      poor: 1.8,
      fair: 2.3,
      good: 2.9,
      excellent: 3.9,
      unit: 'x'
    }
  },
  
  'telecommunications': {
    ctr: {
      target: 1.6,
      poor: 0.7,
      fair: 1.1,
      good: 1.6,
      excellent: 2.2,
      unit: '%'
    },
    cpc: {
      target: 4.0,
      poor: 6.5,
      fair: 5.2,
      good: 4.0,
      excellent: 2.8,
      unit: '$'
    },
    cpm: {
      target: 34.0,
      poor: 55.0,
      fair: 44.0,
      good: 34.0,
      excellent: 24.0,
      unit: '$'
    },
    cvr: {
      target: 2.1,
      poor: 0.9,
      fair: 1.5,
      good: 2.1,
      excellent: 2.9,
      unit: '%'
    },
    cpa: {
      target: 105.0,
      poor: 162.0,
      fair: 133.0,
      good: 105.0,
      excellent: 77.0,
      unit: '$'
    },
    cpl: {
      target: 88.0,
      poor: 136.0,
      fair: 112.0,
      good: 88.0,
      excellent: 64.0,
      unit: '$'
    },
    er: {
      target: 2.0,
      poor: 0.9,
      fair: 1.4,
      good: 2.0,
      excellent: 2.8,
      unit: '%'
    },
    roi: {
      target: 260.0,
      poor: 105.0,
      fair: 182.0,
      good: 260.0,
      excellent: 360.0,
      unit: '%'
    },
    roas: {
      target: 3.6,
      poor: 2.1,
      fair: 2.8,
      good: 3.6,
      excellent: 4.6,
      unit: 'x'
    }
  },
  
  'entertainment': {
    ctr: {
      target: 2.4,
      poor: 1.1,
      fair: 1.7,
      good: 2.4,
      excellent: 3.1,
      unit: '%'
    },
    cpc: {
      target: 2.6,
      poor: 4.3,
      fair: 3.4,
      good: 2.6,
      excellent: 1.8,
      unit: '$'
    },
    cpm: {
      target: 24.0,
      poor: 40.0,
      fair: 32.0,
      good: 24.0,
      excellent: 16.0,
      unit: '$'
    },
    cvr: {
      target: 3.8,
      poor: 1.7,
      fair: 2.7,
      good: 3.8,
      excellent: 4.9,
      unit: '%'
    },
    cpa: {
      target: 68.0,
      poor: 105.0,
      fair: 86.0,
      good: 68.0,
      excellent: 50.0,
      unit: '$'
    },
    cpl: {
      target: 55.0,
      poor: 85.0,
      fair: 70.0,
      good: 55.0,
      excellent: 40.0,
      unit: '$'
    },
    er: {
      target: 4.5,
      poor: 2.0,
      fair: 3.2,
      good: 4.5,
      excellent: 5.8,
      unit: '%'
    },
    roi: {
      target: 360.0,
      poor: 150.0,
      fair: 255.0,
      good: 360.0,
      excellent: 465.0,
      unit: '%'
    },
    roas: {
      target: 4.6,
      poor: 2.5,
      fair: 3.5,
      good: 4.6,
      excellent: 5.7,
      unit: 'x'
    }
  },
  
  'food-beverage': {
    ctr: {
      target: 2.0,
      poor: 0.9,
      fair: 1.4,
      good: 2.0,
      excellent: 2.6,
      unit: '%'
    },
    cpc: {
      target: 2.9,
      poor: 4.7,
      fair: 3.8,
      good: 2.9,
      excellent: 2.0,
      unit: '$'
    },
    cpm: {
      target: 27.0,
      poor: 44.0,
      fair: 35.0,
      good: 27.0,
      excellent: 19.0,
      unit: '$'
    },
    cvr: {
      target: 3.3,
      poor: 1.5,
      fair: 2.4,
      good: 3.3,
      excellent: 4.2,
      unit: '%'
    },
    cpa: {
      target: 78.0,
      poor: 120.0,
      fair: 99.0,
      good: 78.0,
      excellent: 57.0,
      unit: '$'
    },
    cpl: {
      target: 62.0,
      poor: 96.0,
      fair: 79.0,
      good: 62.0,
      excellent: 45.0,
      unit: '$'
    },
    er: {
      target: 3.6,
      poor: 1.6,
      fair: 2.6,
      good: 3.6,
      excellent: 4.6,
      unit: '%'
    },
    roi: {
      target: 350.0,
      poor: 145.0,
      fair: 247.0,
      good: 350.0,
      excellent: 453.0,
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

// Helper function to get benchmark value for a specific metric and industry
export function getBenchmarkValue(industry: string, metric: string): { value: number; unit: string } | null {
  const industryBenchmarks = INDUSTRY_BENCHMARKS[industry];
  if (!industryBenchmarks) return null;
  
  const metricBenchmark = industryBenchmarks[metric];
  if (!metricBenchmark) return null;
  
  return {
    value: metricBenchmark.target,
    unit: metricBenchmark.unit
  };
}

// Helper function to get industry display names
export function getIndustryDisplayName(industryKey: string): string {
  const displayNames: Record<string, string> = {
    'technology': 'Technology',
    'saas': 'SaaS',
    'ecommerce': 'E-commerce',
    'healthcare': 'Healthcare',
    'finance': 'Finance & Banking',
    'education': 'Education',
    'real-estate': 'Real Estate',
    'professional-services': 'Professional Services',
    'retail': 'Retail',
    'hospitality': 'Hospitality & Travel',
    'automotive': 'Automotive',
    'manufacturing': 'Manufacturing',
    'nonprofit': 'Non-profit',
    'legal': 'Legal Services',
    'insurance': 'Insurance',
    'telecommunications': 'Telecommunications',
    'entertainment': 'Entertainment & Media',
    'food-beverage': 'Food & Beverage'
  };
  
  return displayNames[industryKey] || industryKey;
}

