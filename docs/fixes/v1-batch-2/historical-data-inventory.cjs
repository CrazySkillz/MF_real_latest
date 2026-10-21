// Read-only aggregate inventory of the localhost production-backup clone. No cleanup.
const fs=require('node:fs'),{Client}=require('pg');
(async()=>{
 const c=new Client({host:'127.0.0.1',port:55443,user:'v1_audit',database:'v1_batch2_production_clone',statement_timeout:60000});
 await c.connect();
 try {
  await c.query('BEGIN READ ONLY');
  const result={at:new Date().toISOString(),boundary:'Restored local backup, aggregate reads only; exact historical write provenance remains unproven.'};
  result.ptomoCount=(await c.query("SELECT count(*)::int n FROM campaigns WHERE lower(name)='ptomo'")).rows[0].n;
  result.retiredSpend=(await c.query("SELECT count(*)::int total,count(*) FILTER(WHERE s.id IS NULL)::int without_source,count(*) FILTER(WHERE lower(c.name)='ptomo')::int ptomo_rows,count(*) FILTER(WHERE r.currency='USD')::int usd_rows FROM spend_records r LEFT JOIN spend_sources s ON s.id::text=r.spend_source_id LEFT JOIN campaigns c ON c.id=r.campaign_id WHERE r.spend_source_id='linkedin_daily_metrics'")).rows[0];
  result.legacyDemoMetrics=(await c.query("SELECT count(*)::int total,count(*) FILTER(WHERE owner_id IS NULL)::int unowned FROM metrics WHERE (name,value) IN (('Total Impressions','284,521'),('Total Clicks','12,847'),('Click-through Rate','4.51%'),('Ad Spend','$18,420'))")).rows[0];
  await c.query('ROLLBACK');fs.writeFileSync('docs/fixes/v1-batch-2/historical-data-inventory.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{await c.end();}
})().catch(e=>{console.error(e.code||e.name);process.exitCode=1;});
