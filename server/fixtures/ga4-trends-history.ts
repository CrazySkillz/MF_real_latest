// Synthetic repeat-user history for portable regression tests. Real provider
// responses are supplied locally through GA4_TRENDS_REAL_FIXTURE, never committed.
import { readFileSync } from 'node:fs';
const date = (offset: number) => new Date(Date.UTC(2026, 8, 4 + offset)).toISOString().slice(0, 10);
const daily = Array.from({length:75}, (_, i) => {
  const sessions = i % 4 === 0 ? 0 : 10 + i % 7;
  const engagedSessions = Math.floor(sessions * 0.6);
  return {date:date(i),sessions,users:Math.max(0,sessions-1),conversions:sessions?i%3:0,
    revenue:sessions?(i%3)*12.345678:0,pageviews:sessions*2,engagedSessions,engagementRate:sessions?engagedSessions/sessions:0};
});
const windows = Array.from({length:69},(_,i)=>({startDate:date(i),endDate:date(i+6),
  users:new Set(daily.slice(i,i+7).flatMap((row,offset)=>Array.from({length:row.users},(_,user)=>((i+offset)*3+user)%45))).size}));
for (const [from, to] of [...Array.from({length:46}, (_, i) => [i, i + 29]), [0,26], [27,57], [58,74]]) {
  windows.push({startDate:date(from),endDate:date(to),users:new Set(daily.slice(from,to+1).flatMap((row,offset)=>Array.from({length:row.users},(_,user)=>((from+offset)*3+user)%45))).size});
}
const synthetic = {propertyId:'542352127',startDate:date(0),endDate:date(74),daily,windows};
export default process.env.GA4_TRENDS_REAL_FIXTURE
  ? JSON.parse(readFileSync(process.env.GA4_TRENDS_REAL_FIXTURE,'utf8')) as typeof synthetic
  : synthetic;
