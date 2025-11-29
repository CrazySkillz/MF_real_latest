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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 50000,
      poor: 10000,
      fair: 30000,
      good: 50000,
      excellent: 100000,
      unit: ''
    },
    clicks: {
      target: 1000,
      poor: 200,
      fair: 600,
      good: 1000,
      excellent: 2000,
      unit: ''
    },
    spend: {
      target: 5000,
      poor: 1000,
      fair: 3000,
      good: 5000,
      excellent: 10000,
      unit: '$'
    },
    conversions: {
      target: 30,
      poor: 5,
      fair: 15,
      good: 30,
      excellent: 60,
      unit: ''
    },
    leads: {
      target: 50,
      poor: 10,
      fair: 25,
      good: 50,
      excellent: 100,
      unit: ''
    },
    engagements: {
      target: 1500,
      poor: 300,
      fair: 900,
      good: 1500,
      excellent: 3000,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 75000,
      poor: 15000,
      fair: 45000,
      good: 75000,
      excellent: 150000,
      unit: ''
    },
    clicks: {
      target: 1350,
      poor: 270,
      fair: 810,
      good: 1350,
      excellent: 2700,
      unit: ''
    },
    spend: {
      target: 4000,
      poor: 800,
      fair: 2400,
      good: 4000,
      excellent: 8000,
      unit: '$'
    },
    conversions: {
      target: 35,
      poor: 7,
      fair: 21,
      good: 35,
      excellent: 70,
      unit: ''
    },
    leads: {
      target: 60,
      poor: 12,
      fair: 36,
      good: 60,
      excellent: 120,
      unit: ''
    },
    engagements: {
      target: 2250,
      poor: 450,
      fair: 1350,
      good: 2250,
      excellent: 4500,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 40000,
      poor: 8000,
      fair: 24000,
      good: 40000,
      excellent: 80000,
      unit: ''
    },
    clicks: {
      target: 600,
      poor: 120,
      fair: 360,
      good: 600,
      excellent: 1200,
      unit: ''
    },
    spend: {
      target: 6000,
      poor: 1200,
      fair: 3600,
      good: 6000,
      excellent: 12000,
      unit: '$'
    },
    conversions: {
      target: 12,
      poor: 2,
      fair: 7,
      good: 12,
      excellent: 24,
      unit: ''
    },
    leads: {
      target: 20,
      poor: 4,
      fair: 12,
      good: 20,
      excellent: 40,
      unit: ''
    },
    engagements: {
      target: 800,
      poor: 160,
      fair: 480,
      good: 800,
      excellent: 1600,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 35000,
      poor: 7000,
      fair: 21000,
      good: 35000,
      excellent: 70000,
      unit: ''
    },
    clicks: {
      target: 420,
      poor: 84,
      fair: 252,
      good: 420,
      excellent: 840,
      unit: ''
    },
    spend: {
      target: 7500,
      poor: 1500,
      fair: 4500,
      good: 7500,
      excellent: 15000,
      unit: '$'
    },
    conversions: {
      target: 8,
      poor: 2,
      fair: 5,
      good: 8,
      excellent: 16,
      unit: ''
    },
    leads: {
      target: 15,
      poor: 3,
      fair: 9,
      good: 15,
      excellent: 30,
      unit: ''
    },
    engagements: {
      target: 525,
      poor: 105,
      fair: 315,
      good: 525,
      excellent: 1050,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 60000,
      poor: 12000,
      fair: 36000,
      good: 60000,
      excellent: 120000,
      unit: ''
    },
    clicks: {
      target: 1320,
      poor: 264,
      fair: 792,
      good: 1320,
      excellent: 2640,
      unit: ''
    },
    spend: {
      target: 4500,
      poor: 900,
      fair: 2700,
      good: 4500,
      excellent: 9000,
      unit: '$'
    },
    conversions: {
      target: 45,
      poor: 9,
      fair: 27,
      good: 45,
      excellent: 90,
      unit: ''
    },
    leads: {
      target: 70,
      poor: 14,
      fair: 42,
      good: 70,
      excellent: 140,
      unit: ''
    },
    engagements: {
      target: 2100,
      poor: 420,
      fair: 1260,
      good: 2100,
      excellent: 4200,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 45000,
      poor: 9000,
      fair: 27000,
      good: 45000,
      excellent: 90000,
      unit: ''
    },
    clicks: {
      target: 720,
      poor: 144,
      fair: 432,
      good: 720,
      excellent: 1440,
      unit: ''
    },
    spend: {
      target: 5500,
      poor: 1100,
      fair: 3300,
      good: 5500,
      excellent: 11000,
      unit: '$'
    },
    conversions: {
      target: 16,
      poor: 3,
      fair: 10,
      good: 16,
      excellent: 32,
      unit: ''
    },
    leads: {
      target: 25,
      poor: 5,
      fair: 15,
      good: 25,
      excellent: 50,
      unit: ''
    },
    engagements: {
      target: 990,
      poor: 198,
      fair: 594,
      good: 990,
      excellent: 1980,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 42000,
      poor: 8400,
      fair: 25200,
      good: 42000,
      excellent: 84000,
      unit: ''
    },
    clicks: {
      target: 800,
      poor: 160,
      fair: 480,
      good: 800,
      excellent: 1600,
      unit: ''
    },
    spend: {
      target: 4800,
      poor: 960,
      fair: 2880,
      good: 4800,
      excellent: 9600,
      unit: '$'
    },
    conversions: {
      target: 22,
      poor: 4,
      fair: 13,
      good: 22,
      excellent: 44,
      unit: ''
    },
    leads: {
      target: 35,
      poor: 7,
      fair: 21,
      good: 35,
      excellent: 70,
      unit: ''
    },
    engagements: {
      target: 1176,
      poor: 235,
      fair: 706,
      good: 1176,
      excellent: 2352,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 70000,
      poor: 14000,
      fair: 42000,
      good: 70000,
      excellent: 140000,
      unit: ''
    },
    clicks: {
      target: 1470,
      poor: 294,
      fair: 882,
      good: 1470,
      excellent: 2940,
      unit: ''
    },
    spend: {
      target: 4200,
      poor: 840,
      fair: 2520,
      good: 4200,
      excellent: 8400,
      unit: '$'
    },
    conversions: {
      target: 47,
      poor: 9,
      fair: 28,
      good: 47,
      excellent: 94,
      unit: ''
    },
    leads: {
      target: 75,
      poor: 15,
      fair: 45,
      good: 75,
      excellent: 150,
      unit: ''
    },
    engagements: {
      target: 2240,
      poor: 448,
      fair: 1344,
      good: 2240,
      excellent: 4480,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 55000,
      poor: 11000,
      fair: 33000,
      good: 55000,
      excellent: 110000,
      unit: ''
    },
    clicks: {
      target: 1265,
      poor: 253,
      fair: 759,
      good: 1265,
      excellent: 2530,
      unit: ''
    },
    spend: {
      target: 5200,
      poor: 1040,
      fair: 3120,
      good: 5200,
      excellent: 10400,
      unit: '$'
    },
    conversions: {
      target: 44,
      poor: 9,
      fair: 26,
      good: 44,
      excellent: 88,
      unit: ''
    },
    leads: {
      target: 65,
      poor: 13,
      fair: 39,
      good: 65,
      excellent: 130,
      unit: ''
    },
    engagements: {
      target: 1540,
      poor: 308,
      fair: 924,
      good: 1540,
      excellent: 3080,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 48000,
      poor: 9600,
      fair: 28800,
      good: 48000,
      excellent: 96000,
      unit: ''
    },
    clicks: {
      target: 816,
      poor: 163,
      fair: 490,
      good: 816,
      excellent: 1632,
      unit: ''
    },
    spend: {
      target: 4400,
      poor: 880,
      fair: 2640,
      good: 4400,
      excellent: 8800,
      unit: '$'
    },
    conversions: {
      target: 19,
      poor: 4,
      fair: 11,
      good: 19,
      excellent: 38,
      unit: ''
    },
    leads: {
      target: 30,
      poor: 6,
      fair: 18,
      good: 30,
      excellent: 60,
      unit: ''
    },
    engagements: {
      target: 1248,
      poor: 250,
      fair: 749,
      good: 1248,
      excellent: 2496,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 38000,
      poor: 7600,
      fair: 22800,
      good: 38000,
      excellent: 76000,
      unit: ''
    },
    clicks: {
      target: 532,
      poor: 106,
      fair: 319,
      good: 532,
      excellent: 1064,
      unit: ''
    },
    spend: {
      target: 6200,
      poor: 1240,
      fair: 3720,
      good: 6200,
      excellent: 12400,
      unit: '$'
    },
    conversions: {
      target: 10,
      poor: 2,
      fair: 6,
      good: 10,
      excellent: 20,
      unit: ''
    },
    leads: {
      target: 18,
      poor: 4,
      fair: 11,
      good: 18,
      excellent: 36,
      unit: ''
    },
    engagements: {
      target: 684,
      poor: 137,
      fair: 411,
      good: 684,
      excellent: 1368,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 32000,
      poor: 6400,
      fair: 19200,
      good: 32000,
      excellent: 64000,
      unit: ''
    },
    clicks: {
      target: 416,
      poor: 83,
      fair: 250,
      good: 416,
      excellent: 832,
      unit: ''
    },
    spend: {
      target: 6800,
      poor: 1360,
      fair: 4080,
      good: 6800,
      excellent: 13600,
      unit: '$'
    },
    conversions: {
      target: 7,
      poor: 1,
      fair: 4,
      good: 7,
      excellent: 14,
      unit: ''
    },
    leads: {
      target: 12,
      poor: 2,
      fair: 7,
      good: 12,
      excellent: 24,
      unit: ''
    },
    engagements: {
      target: 512,
      poor: 102,
      fair: 307,
      good: 512,
      excellent: 1024,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 65000,
      poor: 13000,
      fair: 39000,
      good: 65000,
      excellent: 130000,
      unit: ''
    },
    clicks: {
      target: 1625,
      poor: 325,
      fair: 975,
      good: 1625,
      excellent: 3250,
      unit: ''
    },
    spend: {
      target: 3500,
      poor: 700,
      fair: 2100,
      good: 3500,
      excellent: 7000,
      unit: '$'
    },
    conversions: {
      target: 65,
      poor: 13,
      fair: 39,
      good: 65,
      excellent: 130,
      unit: ''
    },
    leads: {
      target: 100,
      poor: 20,
      fair: 60,
      good: 100,
      excellent: 200,
      unit: ''
    },
    engagements: {
      target: 2730,
      poor: 546,
      fair: 1638,
      good: 2730,
      excellent: 5460,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 30000,
      poor: 6000,
      fair: 18000,
      good: 30000,
      excellent: 60000,
      unit: ''
    },
    clicks: {
      target: 330,
      poor: 66,
      fair: 198,
      good: 330,
      excellent: 660,
      unit: ''
    },
    spend: {
      target: 8500,
      poor: 1700,
      fair: 5100,
      good: 8500,
      excellent: 17000,
      unit: '$'
    },
    conversions: {
      target: 5,
      poor: 1,
      fair: 3,
      good: 5,
      excellent: 10,
      unit: ''
    },
    leads: {
      target: 10,
      poor: 2,
      fair: 6,
      good: 10,
      excellent: 20,
      unit: ''
    },
    engagements: {
      target: 390,
      poor: 78,
      fair: 234,
      good: 390,
      excellent: 780,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 36000,
      poor: 7200,
      fair: 21600,
      good: 36000,
      excellent: 72000,
      unit: ''
    },
    clicks: {
      target: 468,
      poor: 94,
      fair: 281,
      good: 468,
      excellent: 936,
      unit: ''
    },
    spend: {
      target: 7200,
      poor: 1440,
      fair: 4320,
      good: 7200,
      excellent: 14400,
      unit: '$'
    },
    conversions: {
      target: 7,
      poor: 1,
      fair: 4,
      good: 7,
      excellent: 14,
      unit: ''
    },
    leads: {
      target: 13,
      poor: 3,
      fair: 8,
      good: 13,
      excellent: 26,
      unit: ''
    },
    engagements: {
      target: 504,
      poor: 101,
      fair: 302,
      good: 504,
      excellent: 1008,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 52000,
      poor: 10400,
      fair: 31200,
      good: 52000,
      excellent: 104000,
      unit: ''
    },
    clicks: {
      target: 832,
      poor: 166,
      fair: 499,
      good: 832,
      excellent: 1664,
      unit: ''
    },
    spend: {
      target: 5400,
      poor: 1080,
      fair: 3240,
      good: 5400,
      excellent: 10800,
      unit: '$'
    },
    conversions: {
      target: 17,
      poor: 3,
      fair: 10,
      good: 17,
      excellent: 34,
      unit: ''
    },
    leads: {
      target: 28,
      poor: 6,
      fair: 17,
      good: 28,
      excellent: 56,
      unit: ''
    },
    engagements: {
      target: 1040,
      poor: 208,
      fair: 624,
      good: 1040,
      excellent: 2080,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 80000,
      poor: 16000,
      fair: 48000,
      good: 80000,
      excellent: 160000,
      unit: ''
    },
    clicks: {
      target: 1920,
      poor: 384,
      fair: 1152,
      good: 1920,
      excellent: 3840,
      unit: ''
    },
    spend: {
      target: 3800,
      poor: 760,
      fair: 2280,
      good: 3800,
      excellent: 7600,
      unit: '$'
    },
    conversions: {
      target: 73,
      poor: 15,
      fair: 44,
      good: 73,
      excellent: 146,
      unit: ''
    },
    leads: {
      target: 110,
      poor: 22,
      fair: 66,
      good: 110,
      excellent: 220,
      unit: ''
    },
    engagements: {
      target: 3600,
      poor: 720,
      fair: 2160,
      good: 3600,
      excellent: 7200,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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
    // Raw Metrics (Volume-based)
    impressions: {
      target: 68000,
      poor: 13600,
      fair: 40800,
      good: 68000,
      excellent: 136000,
      unit: ''
    },
    clicks: {
      target: 1360,
      poor: 272,
      fair: 816,
      good: 1360,
      excellent: 2720,
      unit: ''
    },
    spend: {
      target: 4100,
      poor: 820,
      fair: 2460,
      good: 4100,
      excellent: 8200,
      unit: '$'
    },
    conversions: {
      target: 45,
      poor: 9,
      fair: 27,
      good: 45,
      excellent: 90,
      unit: ''
    },
    leads: {
      target: 70,
      poor: 14,
      fair: 42,
      good: 70,
      excellent: 140,
      unit: ''
    },
    engagements: {
      target: 2448,
      poor: 490,
      fair: 1469,
      good: 2448,
      excellent: 4896,
      unit: ''
    },
    
    // Derived Metrics (Performance-based)
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

