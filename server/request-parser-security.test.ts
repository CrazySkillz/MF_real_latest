import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

// Each fixture runs the real startup parsing fragment in a disposable process.
// A late decoder error must not crash either that process or its next request.
// All HTTP traffic stays on loopback; no app startup, database or provider calls.
const fixture = String.raw`
const fs=require('node:fs'),http=require('node:http'),zlib=require('node:zlib');
const express=require('express');
const spec=JSON.parse(fs.readFileSync(0,'utf8'));
const source=fs.readFileSync('server/index.ts','utf8');
const start=source.indexOf('// Conditionally apply body parsing');
const end=source.indexOf('// API routes middleware',start);
if(start<0||end<start)throw Error('Startup parser fragment missing');
const app=express();
new Function('app','express',source.slice(start,end))(app,express);
if(spec.upload){
 const routes=fs.readFileSync('server/routes-oauth.ts','utf8');
 const custom=spec.upload==='custom';
 const from=routes.indexOf(custom?'const upload = multer({':'  const uploadCsv = multer({');
 const to=routes.indexOf(custom?'// Hash the exact wire bytes':'  const uploadRevenueCsv =',from);
 if(from<0||to<from)throw Error('CSV upload configuration missing');
 // Custom fixtures contain text fields only, so the file filter is not invoked.
 const upload=new Function('multer',routes.slice(from,to)+(custom?'; return upload;':'; return uploadCsv;'))(require('multer'));
 app.use(upload.single('file'));
}
app.get('/health-fixture',(_q,s)=>s.json({alive:true}));
app.use((q,s)=>s.status(spec.auth?200:401).json({body:q.body,query:q.query,
 ...(spec.upload?{file:q.file?{name:q.file.originalname,text:q.file.buffer.toString()}:null}:{})}));
app.use((e,_q,s,_n)=>s.status(e.status||500).json({type:e.type,code:e.code}));
const listener=app.listen(0,'127.0.0.1',()=>{
 const payload=Buffer.from(spec.payload);
 const compressed=spec.gzip?zlib.gzipSync(payload):payload;
 const bytes=spec.trailing?Buffer.concat([compressed,Buffer.from([0]),Buffer.alloc(128*1024,88)]):compressed;
 const req=http.request({hostname:'127.0.0.1',port:listener.address().port,
  path:spec.path||'/fixture',method:'POST',agent:false,
  headers:{'Content-Type':spec.type,'Content-Length':bytes.length,...(spec.gzip?{'Content-Encoding':'gzip'}:{})}},res=>{
  let body='';res.setEncoding('utf8');res.on('data',x=>body+=x);
  res.on('end',()=>setTimeout(()=>{
   http.get({hostname:'127.0.0.1',port:listener.address().port,path:'/health-fixture',agent:false},health=>{
    health.resume();health.on('end',()=>listener.close(()=>console.log(JSON.stringify({status:res.statusCode,
      result:JSON.parse(body),health:health.statusCode}))));
   }).on('error',e=>{throw e});
  },200));
 });
 req.on('error',e=>{throw e});req.end(bytes);
});
`;
function run(spec: Record<string, unknown>) {
  const child = spawnSync(process.execPath, ['-e', fixture], {
    cwd: process.cwd(), timeout: 4000, encoding: 'utf8', windowsHide: true,
    input: JSON.stringify(spec),
    env: { ...process.env, DATABASE_URL: '', NODE_ENV: 'test' },
  });
  expect(child.error, String(child.error)).toBeUndefined();
  expect(child.status, child.stderr).toBe(0);
  const result = JSON.parse(child.stdout.trim());
  expect(result.health).toBe(200);
  return result;
}
describe('request parsing process safety and existing contracts', () => {
  const multipart = (parts: Array<{ name: string; value: string; filename?: string }>) => ({
    type: 'multipart/form-data; boundary=parser-fixture-boundary', upload: true, auth: true,
    payload: parts.map(p => '--parser-fixture-boundary\r\nContent-Disposition: form-data; name="' + p.name + '"'
      + (p.filename ? '; filename="' + p.filename + '"\r\nContent-Type: text/csv' : '')
      + '\r\n\r\n' + p.value + '\r\n').join('') + '--parser-fixture-boundary--\r\n',
  });
  it.each(['csv', 'custom'])('bounds hostile multipart array indexes using the actual %s upload configuration', upload => {
    const result = run({ ...multipart([{ name: 'items[4294967294]', value: 'a' }, { name: 'items[bad]', value: 'b' }]), upload });
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.result.code).toBe('LIMIT_FIELD_ARRAY_INDEX');
  });
  it.each(['csv', 'custom'])('rejects excessive field nesting using the actual %s upload configuration', upload => {
    expect(run({ ...multipart([{ name: 'field' + '[a]'.repeat(11), value: 'value' }]), upload }).result.code)
      .toBe('LIMIT_FIELD_NESTING');
  });
  it.each(['csv', 'custom'])('preserves bounded structured fields using the actual %s upload configuration', upload => {
    expect(run({ ...multipart([{ name: 'fields[0][name]', value: 'value' }]), upload }).result.body)
      .toEqual({ fields: [{ name: 'value' }] });
  });
  it('preserves uploaded CSV bytes and source mapping fields', () => {
    const csv = 'Date,Revenue\n2026-01-03,1000.00\n';
    const mapping = JSON.stringify({ revenueColumn: 'Revenue', dateColumn: 'Date', currency: 'EUR' });
    const result = run(multipart([{ name: 'platformContext', value: 'ga4' }, { name: 'mapping', value: mapping },
      { name: 'file', value: csv, filename: 'fixture.csv' }]));
    expect(result).toEqual({ status: 200, health: 200, result: {
      body: { platformContext: 'ga4', mapping }, query: {}, file: { name: 'fixture.csv', text: csv } } });
  });
  it('retains the uploaded file-size limit', () => {
    expect(run(multipart([{ name: 'file', value: 'x'.repeat(10 * 1024 * 1024 + 1), filename: 'fixture.csv' }])).result.code)
      .toBe('LIMIT_FILE_SIZE');
  });
  for (const [type, payload] of [['application/json', '{"amount":12.34}'],
    ['application/x-www-form-urlencoded', 'amount=12.34']]) {
    it(`survives unauthenticated trailing gzip bytes for ${type}`, () => {
      expect(run({ type, payload, gzip: true, trailing: true }).status).toBe(401);
    });
  }
  for (const gzip of [false, true]) {
    it(`preserves JSON values with compression=${gzip}`, () => {
      expect(run({ type: 'application/json', payload: '{"amount":12.34,"campaignId":"fixture"}', auth: true, gzip }))
        .toEqual({ status: 200, result: { body: { amount: 12.34, campaignId: 'fixture' }, query: {} }, health: 200 });
    });
  }
  it('preserves form strings, repeated values and query parameters', () => {
    const r = run({ type: 'application/x-www-form-urlencoded', payload: 'amount=12.34&tag=a&tag=b',
      path: '/fixture?campaignId=fixture', auth: true });
    expect(r.result).toEqual({ body: { amount: '12.34', tag: ['a', 'b'] }, query: { campaignId: 'fixture' } });
  });
  it('retains malformed JSON rejection', () => {
    expect(run({ type: 'application/json', payload: '{bad', auth: true }))
      .toMatchObject({ status: 400, result: { type: 'entity.parse.failed' } });
  });
  for (const gzip of [false, true]) {
    it(`retains the decoded body size limit with compression=${gzip}`, () => {
      expect(run({ type: 'application/json', payload: JSON.stringify({ text: 'x'.repeat(110000) }), auth: true, gzip }))
        .toMatchObject({ status: 413, result: { type: 'entity.too.large' } });
    });
  }
  it('keeps normal unsigned requests behind the downstream authorization gate', () => {
    expect(run({ type: 'application/json', payload: '{"amount":12.34}' }).status).toBe(401);
  });
  for (const path of ['/api/mailgun/inbound', '/api/sendgrid/inbound']) {
    it(`preserves the existing parser exclusion for ${path}`, () => {
      expect(run({ type: 'application/json', payload: '{bad', auth: true, path }).status).toBe(200);
    });
  }
});
