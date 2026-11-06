import { describe, expect, it, vi } from "vitest";
vi.mock("./db", () => ({ db: null, pool: null }));
import { browserReadPath } from "../scripts/check-live-number-outputs";
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
  it("allows only scoped GET replay and adds read-only/persisted-only flags", () => {
    expect(browserReadPath('/api/campaigns/a/ga4-daily?propertyId=123&days=60','a','123',[])).toBe('/api/campaigns/a/ga4-daily?days=60&propertyId=123&readOnly=1');
    expect(browserReadPath('/api/campaigns/a/outcome-totals?dateRange=90days','a','123',[])).toContain('persistedOnly=1');
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
  it("checks narrative calendar denominators and actual recorded-day counts", () => {
    const text='Current 3-day window 2026-11-02 to 2026-11-04: 1/3 completed days';
    expect(checkNarrativeWindows(fixture(),text,now).every(c=>c.status==='passed')).toBe(true);
    expect(checkNarrativeWindows(fixture(),text.replace('1/3','3/3'),now)[0].status).toBe('difference');
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
