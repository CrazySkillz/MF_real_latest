import fs from 'node:fs';
import crypto from 'node:crypto';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import express from 'express';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../../shared/schema';

// Only identity verification is synthetic; actual routes, body/upload parsing,
// storage, SQL and rate-limit middleware execute. No production index/worker boot.
const holder = vi.hoisted(() => ({ db: null as any, pool: null as any }));
vi.mock('../../../server/db', () => ({ get db() { return holder.db; }, get pool() { return holder.pool; } }));
vi.mock('@clerk/express', () => ({ getAuth: (req: any) => ({ userId: req.headers['x-v1-fixture-owner'] || null }) }));

const dir = 'docs/audits/v1-2026-10-19/';
const testUrl = new URL(process.env.NOTIFICATION_TEST_DATABASE_URL || '');
if (testUrl.hostname !== '127.0.0.1' || testUrl.port !== '55443' || testUrl.pathname !== '/notifications_test' ||
  testUrl.username !== 'v1_audit' || process.env.DATABASE_URL) throw new Error('Unsafe HTTP pilot database');
const namespace = 'v1_http_' + crypto.randomUUID().replaceAll('-', '');
if (!/^v1_http_[a-f0-9]{32}$/.test(namespace)) throw new Error('Unsafe fixture schema');
const admin = new Pool({ connectionString: testUrl.href, max: 1, statement_timeout: 10000 });
let fixturePool: Pool | undefined, server: any, base = '', nativeFetch = globalThis.fetch, schemaCreated = false;
const forbiddenRequests: string[] = [], observations: any[] = [];
const owners = Array.from({length:5}, (_,i) => `v1-fixture-owner-${i}`);
const campaign = (i: number, j = 0) => `v1-fixture-campaign-${i}-${j}`;

beforeAll(async () => {
  await admin.query(`CREATE SCHEMA "${namespace}"`); schemaCreated = true;
  fixturePool = new Pool({ connectionString:testUrl.href, options:`-c search_path=${namespace}`, max:5,
    connectionTimeoutMillis:10000, statement_timeout:15000, query_timeout:16000 });
  const generated = JSON.parse(fs.readFileSync(dir+'schema-generation.json','utf8'));
  for (const statement of generated.statements) {
    if (/(?:"public"|\bpublic)\s*\./i.test(statement)) throw new Error('Unsafe schema statement');
    await fixturePool.query(statement);
  }
  holder.pool = fixturePool; holder.db = drizzle(fixturePool,{schema});
  process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  for (let i=0;i<5;i++) {
    await fixturePool.query('INSERT INTO clients(id,owner_id,name) VALUES($1,$2,$3)',[`v1-client-${i}`,owners[i],`Fixture client ${i}`]);
    for (let j=0;j<5;j++) {
      const id=campaign(i,j);
      await fixturePool.query('INSERT INTO campaigns(id,owner_id,client_id,name,type,status,platform,currency,reporting_time_zone,ga4_campaign_filter) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [id,owners[i],`v1-client-${i}`,`Fixture campaign ${i}-${j}`,'brand_awareness','active','GA4','EUR','Europe/Amsterdam','fixture']);
      await fixturePool.query('INSERT INTO ga4_connections(id,campaign_id,property_id,property_name,method,is_primary,lookback_days,import_start_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [`connection-${i}-${j}`,id,'123456','Fixture property','access_token',true,30,'2026-09-04']);
      await fixturePool.query('INSERT INTO revenue_sources(id,campaign_id,source_type,platform_context,display_name,currency,mapping_config) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [`revenue-${i}-${j}`,id,'csv','ga4','Synthetic revenue','EUR','{}']);
      await fixturePool.query('INSERT INTO spend_sources(id,campaign_id,source_type,platform_context,display_name,currency,mapping_config) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [`spend-${i}-${j}`,id,'csv','ga4','Synthetic spend','EUR','{}']);
      await fixturePool.query("INSERT INTO revenue_records(campaign_id,revenue_source_id,date,revenue,currency,source_type) SELECT $1,$2,to_char(d,'YYYY-MM-DD'),100,'EUR','csv' FROM generate_series('2026-09-04'::date,'2026-10-18'::date,'1 day') d",[id,`revenue-${i}-${j}`]);
      await fixturePool.query("INSERT INTO spend_records(campaign_id,spend_source_id,date,spend,currency,source_type) SELECT $1,$2,to_char(d,'YYYY-MM-DD'),50,'EUR','csv' FROM generate_series('2026-09-04'::date,'2026-10-18'::date,'1 day') d",[id,`spend-${i}-${j}`]);
    }
  }
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input?.url || input);
    if (!base || !url.startsWith(base+'/')) {
      forbiddenRequests.push(new URL(url).origin);
      throw new Error('External request forbidden in HTTP pilot');
    }
    return nativeFetch(input,init);
  }) as typeof fetch;
  const { registerRoutes } = await import('../../../server/routes-oauth');
  const app = express(); app.use(express.json()); app.use(express.urlencoded({extended:false}));
  server = await registerRoutes(app);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
},60000);

afterAll(async () => {
  if(server) { server.closeAllConnections?.(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
  globalThis.fetch=nativeFetch;
  await fixturePool?.end();
  if(schemaCreated) {
    if(!/^v1_http_[a-f0-9]{32}$/.test(namespace)) throw new Error('Unsafe cleanup');
    await admin.query(`DROP SCHEMA "${namespace}" CASCADE`);
  }
  await admin.end();
  fs.writeFileSync(dir+'http-database-pilot-observations.json',JSON.stringify({
    head:'777aae6f6353e998d60b635d3e66b413093117c2',at:new Date().toISOString(),
    boundary:'Actual registerRoutes, Express JSON/multipart handling, rate limit middleware and DatabaseStorage with real disposable PostgreSQL18. Five synthetic Clerk identities,25 campaigns,45 days each of two financial record families. No frontend, Clerk verification, index startup, background workers, provider or email. CSV preview is parsed, not saved. Local timings do not certify hosted capacity.',
    forbiddenRequests,observations,fixtureSchemaRemoved:true,
  },null,2)+'\n');
},30000);

async function get(path:string,owner?:string) {
  const start=performance.now();
  const response=await fetch(base+path,{headers:owner?{'x-v1-fixture-owner':owner}:{}});
  const body=await response.json();
  return {status:response.status,body,ms:performance.now()-start};
}

it('enforces anonymous and second-owner boundaries through HTTP and real DB',async()=>{
  const own=await get(`/api/campaigns/${campaign(0)}`,owners[0]);
  const foreign=await get(`/api/campaigns/${campaign(0)}`,owners[1]);
  const anonymous=await get(`/api/campaigns/${campaign(0)}`);
  expect(own.status).toBe(200); expect(foreign.status).toBe(404); expect(anonymous.status).toBe(401);
  const clients=await get('/api/clients',owners[1]);
  expect(clients.body.map((c:any)=>c.id)).toEqual(['v1-client-1']);
  const foreignClient=await get('/api/campaigns?clientId=v1-client-0',owners[1]);
  expect(foreignClient.status).toBe(404);
  observations.push({case:'Actual HTTP/DB owner/anonymous/foreign/client filters',statuses:[own.status,foreign.status,anonymous.status,clients.status,foreignClient.status]});
});

it('runs five-user API and5000-row multipart previews',async()=>{
  const timings:number[]=[], failures:any[]=[], started=performance.now(), delay=monitorEventLoopDelay({resolution:20});
  delay.enable();
  await Promise.all(owners.map(async(owner,i)=>{
    const id=campaign(i);
    const paths=['/api/clients',`/api/campaigns?clientId=v1-client-${i}`,`/api/campaigns/${id}`,
      `/api/campaigns/${id}/ga4-connections?readOnly=1`,`/api/campaigns/${id}/revenue-sources?platformContext=ga4`,
      `/api/campaigns/${id}/spend-sources?platformContext=ga4`,
      `/api/platforms/ga4/kpis?campaignId=${id}`,`/api/platforms/ga4/benchmarks?campaignId=${id}`];
    for(let repeat=0;repeat<5;repeat++) for(const path of paths) {
      const r=await get(path,owner);timings.push(r.ms);
      if(r.status!==200) failures.push({path,status:r.status,body:r.body});
      if(path.startsWith('/api/campaigns?')) {
        expect(r.body).toHaveLength(5);
        expect(r.body.every((c:any)=>c.ownerId===owner&&c.clientId===`v1-client-${i}`)).toBe(true);
      }
    }
    for (const rows of [5000]) {
      const csv='Date,Campaign,Revenue\n'+Array.from({length:rows},(_,n)=>`2026-10-18,fixture,${n%10+1}`).join('\n');
      const form=new FormData();form.set('platformContext','ga4');form.set('file',new Blob([csv],{type:'text/csv'}),'synthetic.csv');
      const start=performance.now();
      const response=await fetch(base+`/api/campaigns/${id}/revenue/csv/preview`,{method:'POST',headers:{'x-v1-fixture-owner':owner},body:form});
      const body=await response.json();
      timings.push(performance.now()-start);
      if(rows===5000 ? response.status!==200 || body.rowCount!==5000 : response.status!==413) failures.push({path:'csv-preview',requestedRows:rows,status:response.status,body});
      observations.push({case:`${rows}-row CSV preview actor${i}`,status:response.status,rows:body.rowCount,intentionalRowLimit:rows===10000});
    }
  }));
  delay.disable(); timings.sort((a,b)=>a-b);
  const result={case:'Five-user actual HTTP/DB workload',users:5,campaigns:25,requests:timings.length,readRequests:200,csvPreviewRequests:5,
    elapsedMs:performance.now()-started,p95Ms:timings[Math.ceil(timings.length*.95)-1],maxMs:timings.at(-1),eventLoopP95Ms:delay.percentile(95)/1e6,failures};
  observations.push(result);
  expect(forbiddenRequests).toEqual([]);expect(failures).toEqual([]);expect(timings).toHaveLength(205);
  expect(result.p95Ms).toBeLessThan(2000);expect(result.maxMs).toBeLessThan(10000);
},60000);

it('reproduces five users on one IP unable to proceed from preview to import within the limiter window',async()=>{
  const before=await fixturePool!.query('SELECT count(*)::int AS n FROM revenue_sources');
  const outcomes=await Promise.all(owners.map(async(owner,i)=>{
    const form=new FormData();
    form.set('platformContext','ga4');
    form.set('mapping',JSON.stringify({revenueColumn:'Revenue',campaignColumn:'Campaign',campaignValues:['fixture'],dateColumn:'Date',currency:'EUR'}));
    form.set('file',new Blob(['Date,Campaign,Revenue\n2026-10-18,fixture,100'],{type:'text/csv'}),'synthetic.csv');
    const response=await fetch(base+`/api/campaigns/${campaign(i)}/revenue/csv/process`,{method:'POST',headers:{'x-v1-fixture-owner':owner},body:form});
    const body=await response.json();return {status:response.status,retryAfter:body.retryAfter};
  }));
  expect(outcomes.every(r=>r.status===429&&r.retryAfter===300)).toBe(true);
  const after=await fixturePool!.query('SELECT count(*)::int AS n FROM revenue_sources');
  expect(after.rows[0].n).toBe(before.rows[0].n);
  observations.push({case:'V1-126 shared-IP five-user onboarding fails after five successful previews',outcomes,newSources:0,
    releaseDisposition:'FAIL for simultaneous five-user imports behind the same IP; passing test means defect reproduced, not release acceptance'});
});

it('rejects10000 rows after explicitly resetting only the isolated in-memory rate-limit bucket',async()=>{
  const { importRateLimiter }=await import('../../../server/middleware/rateLimiter');
  importRateLimiter.resetKey('127.0.0.1');
  const form=new FormData();form.set('platformContext','ga4');
  form.set('file',new Blob(['Date,Campaign,Revenue\n'+Array.from({length:10000},()=> '2026-10-18,fixture,1').join('\n')],{type:'text/csv'}),'synthetic.csv');
  const response=await fetch(base+`/api/campaigns/${campaign(0)}/revenue/csv/preview`,{method:'POST',headers:{'x-v1-fixture-owner':owners[0]},body:form});
  const body=await response.json();
  expect(response.status).toBe(413);expect(body.error).toContain('5,000');
  observations.push({case:'10000-row negative control with a fresh isolated limiter window',status:response.status,error:body.error});
});
