import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import evidence from './fixtures/ga4-native-values-real-2026-11-15.json';
const db = vi.hoisted(() => Object.fromEntries(['getCampaign','getGA4Connections','getGA4DailyMetrics','getGA4OverviewSnapshot','getLatestFinancialDailySnapshot',
  'getRevenueSources','getSpendSources','getRevenueBreakdownBySource','getSpendBreakdownBySource','getPlatformKPIs','getPlatformBenchmarks'].map(name => [name,vi.fn()])));
vi.mock('./storage', () => ({storage:db}));
import { buildGA4ScheduledPdfAttachment } from './ga4-scheduled-report-pdf';
import { createReportPdfArtifact } from './utils/report-pdf-artifact';
const {scope, breakdown}=evidence, campaignId='real-response-replay';
const dates=breakdown.meta.distinctUsers.daily;
const days=dates.map(day=>({campaignId,propertyId:scope.propertyId,date:day.date,sessions:0,conversions:0,revenue:0,pageviews:0,engagedSessions:0,isSimulated:false,
  ...evidence.daily.find(row=>row.date===day.date),users:day.users}));
describe('actual PDFs using real GA4 period totals',()=>{
 beforeEach(()=>{
  vi.stubEnv('GA4_INCLUDE_CURRENT_DAY','true');vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Reports must use saved real responses without new provider calls');}));
  db.getCampaign.mockResolvedValue({id:campaignId,currency:'EUR',ga4CampaignFilter:JSON.stringify(scope.campaigns),reportingTimeZone:'Europe/Amsterdam'});
  db.getGA4Connections.mockResolvedValue([{id:'replay-connection',campaignId,propertyId:scope.propertyId,isPrimary:true,isActive:true,method:'access_token',accessToken:'never-used',importStartDate:scope.startDate,lookbackDays:30}]);
  db.getGA4DailyMetrics.mockImplementation(async (_id,_property,start,end)=>days.filter(row=>row.date>=start&&row.date<=end));
  db.getGA4OverviewSnapshot.mockResolvedValue({campaignId,propertyId:scope.propertyId,windowStart:scope.startDate,windowEnd:scope.endDate,updatedAt:'2026-11-15T11:00:00Z',campaignBreakdown:breakdown,landingPages:evidence.landing,conversionEvents:{rows:[],totals:{conversions:440}}});
  db.getLatestFinancialDailySnapshot.mockResolvedValue({campaignId,reportingDate:scope.endDate,metrics:{financialDaily:{version:'financial_daily_snapshot_v1',currency:'EUR',
   currentValueWindow:{mode:'initial_import_to_latest_available_day',startDate:scope.startDate,endDate:scope.endDate,dataThroughDate:scope.endDate,reportingTimeZone:'Europe/Amsterdam'},
   inputs:{revenue:{value:String(breakdown.totals.revenue),available:true,sources:['ga4']},spend:{value:null,available:false,sources:[]},conversions:{value:440,available:true,sources:['ga4']}}}}});
  for(const name of ['getRevenueSources','getSpendSources','getRevenueBreakdownBySource','getSpendBreakdownBySource','getPlatformKPIs','getPlatformBenchmarks'])db[name].mockResolvedValue([]);
 });
 afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
 it.each(['overview','custom','ads'])('%s PDF retains the provider total, campaign totals and correct rates',async reportType=>{
  const pdf=await buildGA4ScheduledPdfAttachment({report:{id:'report-period',campaignId,platformType:'google_analytics',reportType,
   configuration:reportType==='custom'?{sections:{overview:true,ads:true},subsections:{overview:{summary:true,campaignBreakdown:true},ads:{campaignBreakdown:true}}}:undefined},
   campaignName:'Recorded Mock GA4',windowStart:scope.startDate,windowEnd:scope.endDate});
  expect(pdf?.subarray(0,5).toString()).toBe('%PDF-');
  const inputs=createReportPdfArtifact(pdf!)?.verification?.inputs;
  expect(inputs.summary.sessions).toBe(4472);
  expect(inputs.summary.conversions).toBe(440);
  expect(inputs.summary.engagementRate).toBe(breakdown.totals.engagementRate);
  expect(inputs.campaignRows.map((row:any)=>row.sessions)).toEqual([3159,1358]);
  expect(inputs.summary.conversionRate).toBe(breakdown.meta.distinctUsers.sessionKeyEventRate * 100);
  expect(inputs.summary.revenue).toBe(114314.62); // The exact saved period total preserves GA4 precision.
  expect(inputs.financial.revenue).toBe(114314.62);
  expect(inputs.campaignRows[0].conversionRate).toBe(breakdown.meta.distinctUsers.campaigns[0].sessionKeyEventRate * 100);
  expect(pdf!.toString('latin1')).toContain('4,472');
  expect(pdf!.toString('latin1')).not.toContain('(4,497)');
  expect(globalThis.fetch).not.toHaveBeenCalled();
 });
});
