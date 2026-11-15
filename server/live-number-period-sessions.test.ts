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
it.each([
 ["period",4472,"passed"], ["period",4497,"difference"], ["legacy",4497,"passed"], ["invalid",4472,"unverified"],
])("checks saved Performance Summary inputs using %s metadata",(mode,value,status)=>{
 const s:any=setup(),{scope,breakdown}=evidence,packet:any=structuredClone(breakdown.meta.distinctUsers);
 if(mode==="legacy")delete packet.sessionTotalsVersion;
 if(mode==="invalid")packet.propertyId="wrong-property";
 s.rows.metricSnapshots=[{snapshotType:"platform_sync",recordedAt:now.toISOString(),metrics:{
  performanceSummary:{totals:{sessions:{available:true,value}}},
  performanceSummaryVerification:{version:1,campaignId:s.campaign.id,propertyId:scope.propertyId,currency:"EUR",campaignFilter:s.campaign.ga4CampaignFilter,
   usersDefinition:"ga4_totalUsers_distinct_v1",distinctUsers:packet,trafficWindow:{startDate:scope.startDate,endDate:scope.endDate},
   nativeFinancialWindow:{startDate:scope.startDate,endDate:scope.endDate,reportingTimeZone:"Europe/Amsterdam"},
   importedFinancialWindow:{startDate:"1900-01-01",endDate:scope.endDate},trafficRows:s.rows.ga4DailyMetrics}}}];
 expect(checkStoredNumbers(s,now)).toContainEqual(expect.objectContaining({code:"SAVED_INPUT_SCOPE",status:"passed"}));
 expect(checkStoredNumbers(s,now)).toContainEqual(expect.objectContaining({code:"SAVED_INPUT_sessions",status}));
});
