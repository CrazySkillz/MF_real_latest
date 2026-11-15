import { afterEach, expect, it, vi } from "vitest";
import evidence from "./fixtures/ga4-period-sessions-real-2026-11-15.json";
import { checkStoredNumbers, monitoredPeriodTraffic, resolveMonitorScope } from "./live-number-checks";
import { expectedOutputNumbers } from "./live-number-output-checks";
const setup=()=>{vi.stubEnv("GA4_INCLUDE_CURRENT_DAY","true");const {scope,breakdown}=structuredClone(evidence);return {
 campaign:{id:"recorded",ownerId:"owner",clientId:"client",currency:"EUR",reportingTimeZone:"Europe/Amsterdam",ga4CampaignFilter:JSON.stringify(scope.campaigns)},
 rows:{ga4Connections:[{id:"connection",campaignId:"recorded",propertyId:scope.propertyId,isActive:true,isPrimary:true,importStartDate:scope.startDate}],
 ga4OverviewSnapshots:[{campaignId:"recorded",propertyId:scope.propertyId,windowStart:scope.startDate,windowEnd:scope.endDate,campaignBreakdown:breakdown}],
 ga4DailyMetrics:breakdown.meta.distinctUsers.daily.map(d=>({campaignId:"recorded",propertyId:scope.propertyId,date:d.date,sessions:0,engagedSessions:0,conversions:0,revenue:0,pageviews:0,...evidence.daily.find(r=>r.date===d.date),users:d.users,isSimulated:false}))}};};
const now=new Date("2026-11-15T12:00:00Z");afterEach(()=>vi.unstubAllEnvs());
it("compares the real GA4 period total separately from daily reconciliation",()=>{const s=setup(),scope=resolveMonitorScope(s,now),e=expectedOutputNumbers(s,now);
 expect(e.totals.sessions).toBe(4472);expect(e.daily.reduce((n,r)=>n+r.sessions,0)).toBe(4497);
 expect(e.cvr).toBe(440/4472*100);expect(e.engagementRate).toBe(evidence.breakdown.totals.engagementRate);
 expect(monitoredPeriodTraffic(s,scope,"yesop_brand_search")?.sessions).toBe(3159);
 expect(checkStoredNumbers(s,now).filter(c=>["sessions","PERIOD_ENGAGED_SESSIONS","PERIOD_ENGAGEMENT_RATE","DAILY_SESSIONS_RECONCILIATION"].includes(c.code)).map(c=>c.status)).toEqual(["passed","passed","passed","passed"]);
});
it("rejects damaged period metadata instead of accepting daily sums",()=>{const s=setup();s.rows.ga4OverviewSnapshots[0].campaignBreakdown.meta.distinctUsers.sessions=-1;
 expect(expectedOutputNumbers(s,now).totals.sessions).toBeNull();expect(checkStoredNumbers(s,now)).toContainEqual(expect.objectContaining({code:"sessions",status:"unverified"}));});
it("detects a saved total that still contains the daily sum",()=>{const s=setup();s.rows.ga4OverviewSnapshots[0].campaignBreakdown.totals.sessions=4497;
 expect(checkStoredNumbers(s,now)).toContainEqual(expect.objectContaining({code:"sessions",status:"difference"}));});
