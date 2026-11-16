import {afterEach,describe,expect,it,vi} from 'vitest';
import {ga4Service} from './analytics';
import evidence from './fixtures/ga4-empty-tail-real-2026-11-16.json';
import {getGA4PeriodTraffic} from '../shared/ga4-traffic-window';

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const key=(body:any)=>JSON.stringify([body.dateRanges,body.dimensions||[],body.metrics,body.dimensionFilter,body.limit]);
const run=()=>ga4Service.getDistinctUsersWithToken(evidence.scope.propertyId,'recorded-only',evidence.scope.from,evidence.scope.through,evidence.scope.filter,undefined,true);
function replay(damage=''){
 const calls:any[]=[];vi.stubEnv('DATABASE_URL','');
 vi.stubGlobal('fetch',vi.fn(async(url:string,options:any)=>{
  expect(url).toBe(`https://analyticsdata.googleapis.com/v1beta/properties/${evidence.scope.propertyId}:runReport`);
  const body=JSON.parse(options.body);calls.push(body);
  const match=evidence.responses.find(r=>key(r.request)===key(body));
  if(!match)throw new Error('Unrecorded request: '+key(body));
  const data:any=structuredClone(match.data),proof=body.metrics[0].name==='eventCount';
  if(proof){
   if(damage==='positive')Object.assign(data,{metricHeaders:[{name:'eventCount'}],rows:[{metricValues:[{value:'1'}]}],rowCount:1});
   if(damage==='missing-proof')delete data.kind;
   if(damage==='incomplete-proof')data.rowCount=2;
   if(damage==='sampled-proof')data.metadata.samplingMetadatas=[{samplesReadCount:'1',samplingSpaceSize:'2'}];
   if(damage==='thresholded-proof')data.metadata.subjectToThresholding=true;
   if(damage==='wrong-metric')Object.assign(data,{metricHeaders:[{name:'sessions'}],rows:[{metricValues:[{value:'0'}]}],rowCount:1});
   if(damage==='negative-proof')Object.assign(data,{metricHeaders:[{name:'eventCount'}],rows:[{metricValues:[{value:'-1'}]}],rowCount:1});
   if(damage==='http-proof')return new Response('{}',{status:403});
  }
  if(damage==='mixed-restriction'&&data.metadata.samplingMetadatas)data.metadata.subjectToThresholding=true;
  const reduced=body.dateRanges[0].endDate==='2026-11-15'&&!body.dimensionFilter?.orGroup?.expressions?.[0]?.andGroup;
  if(reduced&&damage==='sampled-recovery')data.metadata.samplingMetadatas=[{samplesReadCount:'1',samplingSpaceSize:'2'}];
  if(reduced&&damage==='incomplete-recovery')data.rowCount=999;
  return new Response(JSON.stringify(data),{status:200});
 }));return calls;
}
describe('sampled mixed-date scope with a proven empty fallback tail',()=>{
 it('uses recorded unsampled native totals, never the rejected sample or daily sums',async()=>{
  const calls=replay(),result=await run();
  expect(result).toEqual(evidence.result);
  expect(result.sessions).toBe(26);expect(result.total).toBe(5);expect(result.engagementRate).toBe(18/26);
  expect(result.campaigns.map(r=>r.sessions)).toEqual([17,9]);
  expect(result.campaigns.reduce((n,r)=>n+r.users,0)).toBe(6);expect(result.total).not.toBe(6);
  expect(result.daily.at(-1)).toEqual({date:'2026-11-16',users:0});
  expect(calls.filter(r=>r.metrics[0].name==='eventCount')).toHaveLength(1);
  expect(calls.filter(r=>r.metrics[0].name==='eventCount')[0].dateRanges).toEqual([{startDate:'2026-11-16',endDate:'2026-11-16'}]);
 });
 it('retains the requested publication dates and exact native comparison windows for downstream consumers',async()=>{
  replay();const result=await run(),snapshot={windowStart:evidence.scope.from,windowEnd:evidence.scope.through,campaignBreakdown:{meta:{propertyId:evidence.scope.propertyId,distinctUsers:result}}};
  expect(getGA4PeriodTraffic(snapshot,evidence.scope.from,evidence.scope.through)?.sessions).toBe(26);
  expect(getGA4PeriodTraffic(snapshot,evidence.scope.from,evidence.scope.through,'coffee_bags')?.sessions).toBe(17);
  expect(getGA4PeriodTraffic(snapshot,evidence.scope.from,evidence.scope.through,'unselected')).toBeNull();
  expect(result.windows.find(w=>w.startDate==='2026-11-10'&&w.endDate==='2026-11-16')?.sessions).toBe(11);
 });
 it.each(['positive','missing-proof','incomplete-proof','sampled-proof','thresholded-proof','wrong-metric','negative-proof','http-proof','sampled-recovery','incomplete-recovery'])('fails closed for %s',async damage=>{
  replay(damage);await expect(run()).rejects.toThrow(/QUALITY_UNAVAILABLE|INCOMPLETE/);
 });
 it('does not attempt empty-tail recovery for a non-sampling restriction',async()=>{
  const calls=replay('mixed-restriction');await expect(run()).rejects.toThrow('sampling, thresholding');
  expect(calls.some(r=>r.metrics[0].name==='eventCount')).toBe(false);
 });
});
