import { afterEach, expect, it, vi } from "vitest";
import evidence from "./fixtures/ga4-native-values-real-2026-11-15.json";
import { monitoredPeriodTraffic, resolveMonitorScope } from "./live-number-checks";
import { expectedOutputNumbers } from "./live-number-output-checks";
const setup=()=>{vi.stubEnv("GA4_INCLUDE_CURRENT_DAY","true");const {scope,breakdown}=structuredClone(evidence);return {
 comparisonRateDefinition:"ga4_session_key_event_rate" as const,
 campaign:{id:"recorded",ownerId:"owner",clientId:"client",currency:"EUR",reportingTimeZone:"Europe/Amsterdam",ga4CampaignFilter:JSON.stringify(scope.campaigns)},
 rows:{ga4Connections:[{id:"connection",campaignId:"recorded",propertyId:scope.propertyId,isActive:true,isPrimary:true,importStartDate:scope.startDate}],
 ga4OverviewSnapshots:[{campaignId:"recorded",propertyId:scope.propertyId,windowStart:scope.startDate,windowEnd:scope.endDate,campaignBreakdown:breakdown}],
 ga4DailyMetrics:breakdown.meta.distinctUsers.daily.map(d=>({campaignId:"recorded",propertyId:scope.propertyId,date:d.date,sessions:0,engagedSessions:0,conversions:0,revenue:0,pageviews:0,...evidence.daily.find(r=>r.date===d.date),users:d.users,isSimulated:false}))}};};
const now=new Date("2026-11-15T12:00:00Z");afterEach(()=>vi.unstubAllEnvs());
it("checks the real native GA4 rate and preserves the unchanged live definition",()=>{const s=setup(),e=expectedOutputNumbers(s,now);
 expect(e.cvr).toBe(Number(evidence.reference.rows[0].metricValues[3].value)*100);expect(e.cvr?.toFixed(1)).toBe("9.6");
 expect(e.revenue).toBe(114314.62);expect(monitoredPeriodTraffic(s,resolveMonitorScope(s,now),"yesop_brand_search")?.conversionRate?.toFixed(1)).toBe("10.0");
 expect(expectedOutputNumbers({...s,comparisonRateDefinition:"conversions_per_session"},now).cvr).toBe(440/4472*100);
});
it("does not fall back to event-count division when native rate is missing",()=>{const s=setup();delete (s.rows.ga4OverviewSnapshots[0].campaignBreakdown.meta.distinctUsers as any).sessionKeyEventRate;
 expect(expectedOutputNumbers(s,now).cvr).toBeNull();});
