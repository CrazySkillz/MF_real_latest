import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GA4AdComparison from '../client/src/pages/ga4-ad-comparison';

const rows = ['brand', 'social'].map(name => ({ name, users: 2, sessions: 3, conversions: 1, revenue: 10, conversionRate: 100 / 3, revenuePerSession: 10 / 3 }));
const render = (metric: string, users: number | null, missingRows = false) => renderToStaticMarkup(createElement(GA4AdComparison, {
  campaignBreakdownAgg: rows, chartCampaignRows: missingRows ? rows.map(row => ({ ...row, users: Number.NaN })) : rows,
  chartUsers: users, chartRevenue: 20, breakdownLoading: false, chartBreakdownLoading: false,
  chartBreakdownUnavailable: false, chartBreakdownStale: false, selectedMetric: metric, onMetricChange() {},
  formatNumber: value => String(value), formatMoney: value => `EUR ${value}`, revenueDisplaySources: [],
})).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

describe('Campaign Comparison distinct Users rendering', () => {
  it('renders the combined native audience instead of adding campaign counts', () => {
    expect(render('users', 3)).toContain('Total Users 3 Across all campaigns');
  });
  it('keeps missing Users unavailable and does not affect other metrics', () => {
    expect(render('users', null)).toContain('Total Users Unavailable');
    expect(render('users', null, true)).not.toContain('NaN');
    expect(render('sessions', null, true)).toContain('Total Sessions 6');
    expect(render('conversions', null, true)).toContain('Total Conversions 2');
  });
});
