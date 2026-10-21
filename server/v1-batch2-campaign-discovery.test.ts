import { afterEach, describe, expect, it, vi } from 'vitest';
import { ga4Service } from './analytics';
import { getSelectableGA4CampaignFilter } from '../client/src/lib/ga4-campaign-selection';
const row = (name: string, users = 1) => ({ dimensionValues:[{value:name}],metricValues:[{value:String(users)}] });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body),{status,headers:{'retry-after':'60'}});
const storage = () => ({getGA4Connection:vi.fn(async()=>({id:'fixture',campaignId:'campaign',propertyId:'123',accessToken:'old',refreshToken:'refresh'})),updateGA4ConnectionTokens:vi.fn()});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('V1-076 complete campaign discovery',()=>{
  it('returns all 451 campaigns with stable offsets and paginated URL fallback',async()=>{
    const calls:any[]=[];
    vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
      const body=JSON.parse(init.body); calls.push(body);
      const all=body.dimensions[0].name==='pageLocation' ? Array.from({length:201},(_,i)=>row(`https://example.invalid/?utm_campaign=extra_${i}`,2)) : Array.from({length:250},(_,i)=>row(`campaign_${i}`,3));
      return response({rows:all.slice(body.offset,body.offset+body.limit),rowCount:all.length});
    }));
    const result=await ga4Service.getCampaignValues('campaign',storage(),'30daysAgo','123',200);
    expect(result.campaigns).toHaveLength(451);
    expect(calls.map(c=>c.offset)).toEqual([0,200,0,200]);
    expect(calls.every(c=>c.orderBys[0].dimension && c.dateRanges[0].endDate==='today')).toBe(true);
  });
  it.each([403,429,503])('propagates HTTP %s instead of empty campaigns',async status=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response({},status)));
    await expect(ga4Service.getCampaignValues('campaign',storage())).rejects.toThrow();
  });
  it('refreshes 401 once and propagates a subsequent quota error',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(_url,init)=>response({},init.headers.Authorization==='Bearer old'?401:429)));
    vi.spyOn(ga4Service,'refreshAccessToken').mockResolvedValue({access_token:'new',expires_in:3600});
    const store=storage(); await expect(ga4Service.getCampaignValues('campaign',store)).rejects.toThrow();
    expect(store.updateGA4ConnectionTokens).toHaveBeenCalledTimes(1);
  });
  it.each(['missing-page','duplicate-page','changed-count','missing-count','oversized'])('rejects incomplete %s responses',async scenario=>{
    vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
      const b=JSON.parse(init.body); const first=b.offset===0;
      return response({rows:scenario==='missing-page'&&!first?[]:[row(first?'a':scenario==='duplicate-page'?'a':'b')],
        ...(scenario==='missing-count'?{}:{rowCount:scenario==='oversized'?40001:scenario==='changed-count'&&!first?3:2})});
    }));
    await expect(ga4Service.getCampaignValues('campaign',storage(),'30daysAgo','123',1)).rejects.toThrow(/DISCOVERY/);
  });
  it('supports real empty results and explicit unsupported dimension fallback',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(_url,init)=>JSON.parse(init.body).dimensions[0].name==='sessionCampaignName'
      ?response({error:{message:'Unknown dimension sessionCampaignName'}},400):response({rowCount:0})));
    expect((await ga4Service.getCampaignValues('campaign',storage())).campaigns).toEqual([]);
  });
  it('does not call every unsupported dimension an empty campaign result',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response({error:{message:'Unknown dimension'}},400)));
    await expect(ga4Service.getCampaignValues('campaign',storage())).rejects.toThrow('DISCOVERY_UNAVAILABLE');
  });
  it('allows explicitly added manual names beside discovered values without reviving stale selections',()=>{
    expect(getSelectableGA4CampaignFilter(['visible','manual','stale'],[{name:'visible'}],['manual'])).toEqual(['visible','manual']);
  });
});
