import { describe, expect, it, vi } from "vitest";
import { PassThrough } from "node:stream";
vi.mock("./db", () => ({ db: null, pool: null }));
import { browserReadPath, writeOutputChecks } from "../scripts/check-live-number-outputs";
import { browserSafeValue } from "../scripts/live-number-browser-process";
import { checkDisplayedNumber, checkBrowserReportText, expectedBrowserCampaignRows, checkNarrativeWindows } from "../scripts/live-number-browser-checks";
import { checkNotificationCoverage, checkNotificationEmailContent } from "./live-number-notification-checks";
import type { LiveNumberSnapshot } from "./live-number-checks";

const now = new Date("2026-11-05T13:00:00Z");
const fixture = (): LiveNumberSnapshot => ({
  campaign: { id:"a",ownerId:"owner",clientId:"client",currency:"EUR",ga4CampaignFilter:'["search"]',reportingTimeZone:"Europe/Amsterdam",createdAt:"2026-11-04" },
  rows: {
    ga4Connections:[{id:"connection",campaignId:"a",isActive:true,isPrimary:true,propertyId:"123",importStartDate:"2026-11-04"}],
    ga4OverviewSnapshots:[{campaignId:"a",propertyId:"123",windowStart:"2026-11-04",windowEnd:"2026-11-04",campaignBreakdown:{meta:{propertyId:"123",currencyCode:"EUR"},totals:{sessions:20,users:10,conversions:1.5,revenue:100},rows:[{campaign:"search",sessions:20,users:10,conversions:1.5,revenue:100,sessionKeyEventRate:0.05}]}}],
    ga4DailyMetrics:[{campaignId:"a",propertyId:"123",date:"2026-11-04",sessions:20,users:10,conversions:1.5,revenue:100,engagedSessions:10,pageviews:30,engagementRate:0.5}],
    spendSources:[],spendRecords:[],revenueSources:[],revenueRecords:[],benchmarks:[],kpis:[{id:"target",campaignId:"a",platformType:"google_analytics",applyTo:"all",metric:"sessions",name:"Sessions target",unit:"count",targetValue:30,alertsEnabled:true,alertThreshold:25,alertCondition:"below",createdAt:"2026-11-04"}],
    notifications:[],emailAlertEvents:[],metricSnapshots:[],linkedinReports:[],
  },
});
const alert = () => ({id:"alert",campaignId:"a",metadata:JSON.stringify({kpiId:"target"})});

describe("isolated browser monitoring boundaries", () => {
  it("verifies actual Insights/custom financial cards without a Trends heading for a new campaign", () => {
    const snapshot = fixture(); snapshot.campaign.createdAt = "2026-11-05T12:00:00Z";
    const text = "Executive Financials\nREVENUE\nEUR 100.00\nSPEND\nUnavailable\nPROFIT\nUnavailable\nROAS\n—\nROI\n—\nData Summary\nSESSIONS\n20\nCONVERSIONS\n1.5\nREVENUE\n€100.00";
    expect(checkBrowserReportText(snapshot, text, "insights", now).every(c => c.status === "passed")).toBe(true);
    expect(checkBrowserReportText(snapshot, text.replace("EUR 100.00", "EUR 99.00"), "insights", now)).toContainEqual(expect.objectContaining({ code: "REVENUE", status: "difference" }));
    expect(checkBrowserReportText(snapshot, text.replace("REVENUE\nEUR 100.00", ""), "insights", now)).toContainEqual(expect.objectContaining({ code: "REVENUE", status: "unverified" }));
    expect(checkBrowserReportText(snapshot, text + "\n2026-11-04 20 +0%", "insights", now)).toContainEqual(expect.objectContaining({ code: "TREND_TABLE_OR_EXPLICIT_HISTORY_STATE", status: "difference" }));
    snapshot.campaign.createdAt = "2026-11-04";
    expect(checkBrowserReportText(snapshot, text + "\nNo daily history", "insights", now)).toContainEqual(expect.objectContaining({ code: "TREND_TABLE_OR_EXPLICIT_HISTORY_STATE", status: "unverified" }));
    snapshot.campaign.createdAt = "invalid";
    expect(checkBrowserReportText(snapshot, text, "insights", now)).toContainEqual(expect.objectContaining({ code: "TREND_TABLE_OR_EXPLICIT_HISTORY_STATE", status: "unverified" }));
  });
  it("transfers every result through a backpressured pipe before completing", async () => {
    const checks = Array.from({ length: 4000 }, (_, index) => ({ section: "Screen GA4 Overview", code: "VALUE", status: "passed" as const, subject: index.toString(16).padStart(12, "0") }));
    const pipe = new PassThrough({ highWaterMark: 1024 });
    let finished = false;
    const writing = writeOutputChecks(checks, pipe).then(() => { finished = true; });
    await new Promise(resolve => setImmediate(resolve));
    expect(finished).toBe(false);
    const chunks: Buffer[] = []; pipe.on("data", chunk => chunks.push(chunk));
    await writing; pipe.end();
    expect(JSON.parse(Buffer.concat(chunks).toString("utf8"))).toEqual(checks);
  });
  it("allows only scoped GET replay and adds read-only/persisted-only flags", () => {
    expect(browserReadPath('/api/campaigns/a/ga4-daily?propertyId=123&days=60','a','123',[])).toBe('/api/campaigns/a/ga4-daily?days=60&propertyId=123&readOnly=1');
    expect(browserReadPath('/api/campaigns/a/outcome-totals?dateRange=90days','a','123',[])).toContain('persistedOnly=1');
    expect(browserReadPath('/api/campaigns/a/outcome-totals?dateRange=90days&persistedOnly=1','a','123',[])).toBe('/api/campaigns/a/outcome-totals?dateRange=90days&persistedOnly=1');
    expect(browserReadPath('/api/campaigns/a/outcome-totals?dateRange=90days&captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date','a','123',[])).toBe('/api/campaigns/a/outcome-totals?captureExecutiveSnapshot=1&dateRange=90days&executiveFinancialScope=campaign_to_date&persistedOnly=1');
    expect(browserReadPath('/api/campaigns/a/ga4-daily?captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date','a','123',[])).toBeNull();
    expect(browserReadPath('/api/campaigns/a/outcome-totals?captureExecutiveSnapshot=1&executiveFinancialScope=foreign','a','123',[])).toBeNull();
    expect(browserReadPath('/api/kpis/target/analytics?ga4Scope=1','a','123',['target'])).toContain('/target/analytics');
    for(const path of ['https://external.invalid/api/campaigns/a','/api/campaigns/b/ga4-daily','/api/campaigns/a/ga4-daily?propertyId=456','/api/campaigns/a/ga4-daily?mock=1','/api/campaigns/a/ga4-daily?days=10000','/api/campaigns/a/ga4-refresh','/api/kpis/foreign/analytics','/api/campaigns/a/ga4-metrics']) expect(browserReadPath(path,'a','123',[])).toBeNull();
  });
  it("strips nested credentials while preserving the non-secret publication receipt", () => {
    expect(browserSafeValue({publicationToken:'receipt',nested:{accessToken:'secret',clientSecret:'secret',encryptedTokens:{a:1},sessions:4}})).toEqual({publicationToken:'receipt',nested:{sessions:4}});
  });
  it("detects missing numbers, wrong currency, availability and rounding regressions", () => {
    expect(checkDisplayedNumber('screen','REVENUE',100,'€100.00',2,'EUR').status).toBe('passed');
    expect(checkDisplayedNumber('screen','REVENUE',100,'$100.00',2,'EUR').status).toBe('difference');
    expect(checkDisplayedNumber('screen','ROAS',258.825,'258.82x').status).toBe('difference');
    expect(checkDisplayedNumber('screen','SPEND',null,'€0.00').status).toBe('difference');
    expect(checkDisplayedNumber('screen','SPEND',null,'Unavailable').status).toBe('passed');
    expect(checkDisplayedNumber('screen','SESSIONS',100,null).status).toBe('unverified');
    expect(checkDisplayedNumber('screen','CONVERSIONS',0.000000001,'0').status).toBe('difference');
  });
  it("checks the browser KPI PDF layout, including mutation of a displayed value", () => {
    const text='Sessions target\nSESSIONS\nCURRENT (count)\n20\nTARGET (count)\n30';
    const wanted=()=>checkBrowserReportText(fixture(),text,'kpis',now).filter(c=>c.code.startsWith('CURRENT_')||c.code.startsWith('TARGET_'));
    expect(wanted().map(c=>c.status)).toEqual(['passed','passed']);
    expect(checkBrowserReportText(fixture(),text.replace('\n20\n','\n19\n'),'kpis',now)).toContainEqual(expect.objectContaining({code:'CURRENT_SESSIONS',status:'difference'}));
  });
  it("uses session key-event rate rather than conversions divided by sessions", () => {
    expect(expectedBrowserCampaignRows(fixture(),now)[0].conversionRate).toBe(5);
  });
  it("preserves empty browser campaign lists without inventing activity or missing Users evidence", () => {
    const snapshot = fixture(); snapshot.usersDefinition = "ga4_totalUsers_distinct_v1";
    const publication = snapshot.rows.ga4OverviewSnapshots[0];
    publication.campaignBreakdown.rows = [];
    publication.campaignBreakdown.meta.distinctUsers = { version: 1, metric: "totalUsers", propertyId: "123", startDate: "2026-11-04", endDate: "2026-11-04", total: 0,
      campaigns: [{ name: "search", users: 0 }], daily: [], windows: [] };
    const before = JSON.stringify(snapshot);
    expect(expectedBrowserCampaignRows(snapshot, now)).toEqual([]);
    expect(JSON.stringify(snapshot)).toBe(before);
    for (const row of snapshot.rows.ga4DailyMetrics) Object.assign(row, { sessions: 0, users: 0, conversions: 0, revenue: 0 });
    Object.assign(publication.campaignBreakdown.totals, { sessions: 0, users: 0, conversions: 0, revenue: 0 });
    expect(checkBrowserReportText(snapshot, "No campaign breakdown data available.", "ads", now)).toContainEqual(expect.objectContaining({ code: "VERIFIED_EMPTY_CAMPAIGN_STATE", status: "passed" }));
    expect(checkBrowserReportText(snapshot, "", "ads", now)).toContainEqual(expect.objectContaining({ code: "VERIFIED_EMPTY_CAMPAIGN_STATE", status: "difference" }));
    snapshot.campaign.createdAt = "2026-11-05T12:00:00Z";
    const text = "Executive Financials\nREVENUE\nEUR 0.00\nSPEND\nUnavailable\nPROFIT\nUnavailable\nROAS\n—\nROI\n—\nSOURCES USED\nSpend: Not connected\nRevenue: Native GA4";
    expect(checkBrowserReportText(snapshot, text, "insights", now).every(c => c.status === "passed")).toBe(true);
    expect(checkBrowserReportText(snapshot, text.replace("EUR 0.00", "EUR 1.00"), "insights", now)).toContainEqual(expect.objectContaining({ code: "REVENUE", status: "difference" }));
    publication.campaignBreakdown.rows = [{ campaign: "search", sessions: 0, users: 0, conversions: 0, revenue: 0, sessionKeyEventRate: 0 }];
    expect(expectedBrowserCampaignRows(snapshot, now)).toEqual([expect.objectContaining({ name: "search", users: 0, sessions: 0 })]);
    publication.campaignBreakdown.meta.distinctUsers.campaigns = [];
    expect(expectedBrowserCampaignRows(snapshot, now)[0].users).toBeNaN();
  });
  it.each([0, 1.5, 25])("uses the pinned new definition for %s conversions without changing legacy checks", conversions => {
    const snapshot = fixture(); snapshot.comparisonRateDefinition = "conversions_per_session";
    snapshot.rows.ga4OverviewSnapshots[0].campaignBreakdown.rows[0].conversions = conversions;
    const before = JSON.stringify(snapshot);
    expect(expectedBrowserCampaignRows(snapshot,now)[0].conversionRate).toBe(conversions / 20 * 100);
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(expectedBrowserCampaignRows(fixture(),now)[0].conversionRate).toBe(5);
  });
  it("checks shortened source labels without inventing a join for ambiguous sources", () => {
    const snapshot=fixture();
    snapshot.rows.revenueSources=[{id:'shop',campaignId:'a',sourceType:'shopify',displayName:'Shopify (fixture.invalid)',currency:'EUR',isActive:true}];
    snapshot.rows.revenueRecords=[{revenueSourceId:'shop',campaignId:'a',currency:'EUR',date:'2026-11-04',revenue:30}];
    const text='Revenue Sources\nShopify EUR 30.00';
    expect(checkBrowserReportText(snapshot,text,'overview',now)).toContainEqual(expect.objectContaining({code:'REVENUE_SOURCE_AMOUNT',status:'passed'}));
    expect(checkBrowserReportText(snapshot,text.replace('30.00','29.00'),'overview',now)).toContainEqual(expect.objectContaining({code:'REVENUE_SOURCE_AMOUNT',status:'difference'}));
    expect(snapshot.rows.revenueSources[0].displayName).toBe('Shopify (fixture.invalid)');
    snapshot.rows.revenueSources.push({...snapshot.rows.revenueSources[0],id:'other',displayName:'Shopify (other.invalid)'});
    expect(checkBrowserReportText(snapshot,text,'overview',now)).toContainEqual(expect.objectContaining({code:'REVENUE_SOURCE_AMOUNT',status:'unverified'}));
  });
  it("accepts intentional missing-spend summary omissions but rejects fabricated zero cards", () => {
    const text='Executive Financials\nTrends\nNo daily history\nData Summary\nSESSIONS\n20\nCONVERSIONS\n1.5\nREVENUE\n€100.00';
    const checks=checkBrowserReportText(fixture(),text,'insights',now).filter(c=>c.code.startsWith('SUMMARY_'));
    expect(checks).toHaveLength(7);expect(checks.every(c=>c.status==='passed')).toBe(true);
    expect(checkBrowserReportText(fixture(),text+'\nTOTAL SPEND\n€0.00','insights',now)).toContainEqual(expect.objectContaining({code:'SUMMARY_TOTAL_SPEND_CONDITIONAL_ABSENCE',status:'difference'}));
  });
  it("checks narrative calendar denominators and actual recorded-day counts", () => {
    const text='Current 3-day window 2026-11-02 to 2026-11-04: 1/3 completed days';
    expect(checkNarrativeWindows(fixture(),text,now).every(c=>c.status==='passed')).toBe(true);
    expect(checkNarrativeWindows(fixture(),text.replace('1/3','3/3'),now)[0].status).toBe('difference');
    const later = fixture(); later.campaign.createdAt = '2026-11-04T23:44:00Z';
    expect(checkNarrativeWindows(later,text.replace('1/3','0/3'),now).every(c=>c.status==='passed')).toBe(true);
  });
});

describe("missing and duplicate notification monitoring", () => {
  it("detects a missing breached alert instead of passing an empty list", () => {
    expect(checkNotificationCoverage(fixture(),[],now)).toContainEqual(expect.objectContaining({code:'REQUIRED_ALERT_PRESENT',status:'difference'}));
  });
  it("requires exactly one visible and persisted active alert", () => {
    const snapshot=fixture();snapshot.rows.notifications=[alert()];
    expect(checkNotificationCoverage(snapshot,[alert()],now).every(c=>c.status==='passed')).toBe(true);
    snapshot.rows.notifications.push({...alert(),id:'duplicate'});
    expect(checkNotificationCoverage(snapshot,[alert()],now)).toContainEqual(expect.objectContaining({code:'NO_DUPLICATE_ACTIVE_ALERT',status:'difference'}));
  });
  it("respects explicit dismissal and detects disabled or cleared rules still shown", () => {
    const snapshot=fixture();snapshot.rows.notifications=[{...alert(),metadata:JSON.stringify({kpiId:'target',dismissedAt:now.toISOString()})}];
    expect(checkNotificationCoverage(snapshot,[],now).every(c=>c.status==='passed')).toBe(true);
    snapshot.rows.kpis[0].alertsEnabled=false;
    expect(checkNotificationCoverage(snapshot,[alert()],now)).toContainEqual(expect.objectContaining({code:'DISABLED_RULE_HAS_NO_ALERT',status:'difference'}));
  });
  it("cannot equate provider acceptance with delivered email", () => {
    const snapshot=fixture();snapshot.rows.kpis=[];snapshot.rows.emailAlertEvents=[{id:'email',campaignId:'a',deliveryStatus:'accepted',createdAt:now.toISOString()}];
    expect(checkNotificationCoverage(snapshot,[],now)).toContainEqual(expect.objectContaining({code:'PROVIDER_ACCEPTED_DELIVERY_UNCONFIRMED',status:'unverified'}));
    snapshot.rows.emailAlertEvents[0].deliveryStatus='delivered';
    expect(checkNotificationCoverage(snapshot,[],now)).toContainEqual(expect.objectContaining({code:'DELIVERY_STATE_EVIDENCE',status:'difference'}));
  });
  it("detects failed/stuck sends and recognizes a later successful delivery separately", () => {
    const snapshot=fixture();snapshot.rows.kpis=[];snapshot.rows.emailAlertEvents=[{id:'old',kind:'report',entityType:'report',entityId:'r',to:'a@example.invalid',campaignId:'a',deliveryStatus:'failed',createdAt:'2026-11-04T08:00:00Z'}];
    expect(checkNotificationCoverage(snapshot,[],now)).toContainEqual(expect.objectContaining({code:'NO_FAILED_OR_STUCK_DELIVERY',status:'difference'}));
    snapshot.rows.emailAlertEvents.push({...snapshot.rows.emailAlertEvents[0],id:'new',deliveryStatus:'delivered',createdAt:now.toISOString(),deliveredAt:now.toISOString(),providerResponseId:'receipt'});
    expect(checkNotificationCoverage(snapshot,[],now).every(c=>c.status==='passed')).toBe(true);
  });
  it("does not treat absent capture evidence as an empty successful check", () => {
    const snapshot=fixture();delete snapshot.rows.notifications;
    expect(checkNotificationCoverage(snapshot,[],now)[0].status).toBe('unverified');
  });
  it("renders the real alert email with live values while blocking the transport", async () => {
    const snapshot=fixture(); snapshot.rows.kpis[0].emailNotifications=true;
    const {emailService}=await import('./services/email-service');
    const transport=vi.spyOn(emailService,'sendEmail').mockRejectedValue(new Error('No sends permitted'));
    try {
      const checks=await checkNotificationEmailContent(snapshot,now);
      expect(checks).toHaveLength(2);expect(checks.every(c=>c.status==='passed')).toBe(true);
      expect(transport).not.toHaveBeenCalled();
    } finally {transport.mockRestore();}
  });
});
