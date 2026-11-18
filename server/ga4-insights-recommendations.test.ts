import { describe, expect, it } from 'vitest';
import { buildGA4InsightsCalendarRollup, buildGA4InsightsDeclineRecommendation, normalizeGA4InsightsDailyRows } from '../shared/ga4-insights';

const rows = Array.from({length:14},(_,i)=>({date:`2026-11-${String(i+5).padStart(2,'0')}`,sessions:0,pageviews:0,conversions:0,revenue:'0'}));
for (const [index,sessions,pageviews,conversions,revenue] of [[2,125,215,15,3541.100002],[3,123,212,14,3801.1499969999995],[4,104,179,15,3418.849999],[7,122,210,13,3949.7499989999997]]) Object.assign(rows[index],{sessions,pageviews,conversions,revenue:String(revenue)});
const run = (metric:'sessions'|'conversions'|'revenue', input:any[]=rows, windows:any[]=[], days=7) => {
  const normalized=normalizeGA4InsightsDailyRows(input);
  const current=buildGA4InsightsCalendarRollup(normalized,'2026-11-18',days);
  const previous=buildGA4InsightsCalendarRollup(normalized,days===7?'2026-11-11':'2026-11-15',days);
  return buildGA4InsightsDeclineRecommendation(metric,input,current,previous,windows);
};
const native=(current:number,previous:number)=>[
  {startDate:'2026-11-12',endDate:'2026-11-18',sessionKeyEventRate:current},
  {startDate:'2026-11-05',endDate:'2026-11-11',sessionKeyEventRate:previous},
];
describe('saved-data-driven decline recommendations',()=>{
  it('prioritizes the actual activity gap without asserting a cause',()=>{
    const text=run('sessions');
    expect(text).toContain('1 of 7 days versus 3 of 7');
    expect(text).toContain('2026-11-13 to 2026-11-18');
    expect(text).toContain('recorded zero sessions, pageviews, conversions and revenue');
    expect(text).toContain('whether this inactivity was expected');
    expect(text).toContain('if activity was expected');
    expect(text).not.toMatch(/SEO|budget|AOV|landing page/);
  });
  it('describes revenue concentration from raw saved amounts',()=>{
    expect(run('revenue')).toContain('All recorded revenue in this window is on 2026-11-12.');
    const multiple=structuredClone(rows); multiple[8].revenue='1';
    expect(run('revenue',multiple)).not.toContain('All recorded revenue');
    const refund=structuredClone(rows); refund[8].revenue='-1';
    expect(run('revenue',refund)).not.toContain('All recorded revenue');
    expect(run('revenue',rows.map(r=>({...r,revenue:'0'})))).not.toContain('All recorded revenue');
  });
  it('does not infer a session rate from events or overlapping windows',()=>{
    for(const windows of [[],native(.1,.2).slice(0,1),[{startDate:'2026-11-05',endDate:'2026-11-18',sessionKeyEventRate:.12}], [...native(.1,.2),native(.1,.2)[1]]]) {
      expect(run('conversions',rows,windows)).toContain('exact GA4 session conversion-rate comparison is unavailable');
      expect(run('conversions',rows,windows)).toContain('counts alone do not establish an efficiency decline');
    }
  });
  it('uses valid exact native rates, including zero, without changing calculations',()=>{
    expect(run('conversions',rows,native(.1,.2))).toContain('GA4 session conversion rate is 10.0% versus 20.0%');
    expect(run('conversions',rows,native(0,.2))).toContain('GA4 session conversion rate is 0.0% versus 20.0%');
    expect(run('conversions',rows,native(.2,.1))).toContain('does not support a conversion-efficiency decline');
    expect(run('conversions',rows,native(.2,.2))).toContain('does not support a conversion-efficiency decline');
  });
  it.each([null,undefined,'', ' ',false,NaN,Infinity,'invalid','0x0',-1,0.5])('does not turn absent or malformed activity into zeros: %s',value=>{
    const broken:any[]=structuredClone(rows);broken[9].pageviews=value;
    expect(run('sessions',broken)).not.toContain('recorded zero');
    expect(run('sessions',broken)).toContain('unavailable');
  });
  it('rejects missing dates, duplicates and incomplete windows',()=>{
    for(const broken of [rows.filter((_,i)=>i!==9),[...rows,rows[9]],rows.slice(7)]) {
      expect(run('sessions',broken)).not.toContain('recorded zero');
      expect(run('sessions',broken)).toContain('unavailable');
    }
  });
  it('requires explicit zeros in every activity metric',()=>{
    for(const key of ['sessions','pageviews','conversions','revenue']) {
      const active:any[]=structuredClone(rows);active[13][key]=1;
      expect(run('sessions',active)).not.toContain('recorded zero');
    }
  });
  it('does not call an all-zero window a conversion-efficiency decline',()=>{
    const zero=rows.map(r=>({...r,sessions:0,conversions:0,pageviews:0,revenue:'0'}));
    expect(run('conversions',zero,native(0,.2))).toContain('no sessions');
    expect(run('conversions',zero,native(0,.2))).not.toContain('rate is 0.0%');
  });
  it('works for unrelated dates, unsorted inputs and the three-day fallback',()=>{
    const shifted=rows.map(r=>({...r,date:r.date.replace('2026-11','2025-08')})).reverse();
    const normalized=normalizeGA4InsightsDailyRows(shifted);
    const text=buildGA4InsightsDeclineRecommendation('sessions',shifted,buildGA4InsightsCalendarRollup(normalized,'2025-08-18',7),buildGA4InsightsCalendarRollup(normalized,'2025-08-11',7),[]);
    expect(text).toContain('2025-08-13 to 2025-08-18');expect(text).not.toContain('2026');
    expect(run('sessions',rows,[],3)).toContain('2026-11-16 to 2026-11-18');
    expect(run('sessions',rows,[],3)).not.toContain('7 days');
  });
  it('is pure and ignores rows outside the exact windows',()=>{
    const original=structuredClone(rows);
    expect(run('revenue',[...rows,{...rows[7],date:'2026-12-01'}])).toBe(run('revenue'));
    run('sessions');expect(rows).toEqual(original);
  });
  it('withholds mismatched totals and nonadjacent periods',()=>{
    const normalized=normalizeGA4InsightsDailyRows(rows);
    const current=buildGA4InsightsCalendarRollup(normalized,'2026-11-18',7);
    const previous=buildGA4InsightsCalendarRollup(normalized,'2026-11-11',7);
    for(const changed of [{...current,sessions:999},{...current,revenue:0},{...current,complete:false},{...current,expectedDays:3},{...current,startDate:'2026-11-13'}]) {
      expect(buildGA4InsightsDeclineRecommendation('sessions',rows,changed,previous,[])).toContain('unavailable');
    }
  });
  it.each([-1,Infinity,'0.1',null])('withholds invalid native rates: %s',value=>{
    const windows:any[]=native(.1,.2);windows[1].sessionKeyEventRate=value;
    expect(run('conversions',rows,windows)).toContain('exact GA4 session conversion-rate comparison is unavailable');
  });
});
