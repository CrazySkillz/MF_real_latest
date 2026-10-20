// Read-only source inventory. Run from the repository root with Node.
const fs = require('node:fs');
const ts = require('typescript');
const out = 'docs/audits/v1-2026-10-19';
const files = fs.readFileSync(out+'/tracked-files.txt','utf16le').replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
const head = fs.readFileSync(out+'/head.txt','utf16le').replace(/^\uFEFF/,'').trim();
const routes = [], pages = [], calls = [], tables = [], jobs = [], tests = [], values = [], actions = [], configuration = [];
const unique = a => [...new Set(a)];
for (const file of files.filter(f => /^(server|client\/src|shared)\/.+\.(ts|tsx)$/.test(f))) {
  const source = fs.readFileSync(file,'utf8');
  if (/\.test\.ts$/.test(file)) { tests.push({file,kind:/readFileSync/.test(source)?'contains source-text assertions':'behavior/other',postgres:/TEST_DATABASE_URL/.test(source),browser:/chromium|playwright/.test(source)}); continue; }
  const sf = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const line = n => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
  function walk(n) {
    if (ts.isCallExpression(n)) {
      const expr = n.expression.getText(sf), body = n.getText(sf);
      if (/^(app|router)\.(get|post|put|patch|delete|options|head|use)$/.test(expr)) {
        const path = n.arguments[0]?.getText(sf) || '';
        const storage = unique([...body.matchAll(/storage\.(\w+)\s*\(/g)].map(m=>m[1]));
        if(expr.endsWith('.get') && path === '"env"') return;
        const hints = unique([...body.matchAll(/\b(require\w*Access\w*|requireAuth\w*|requireAuthenticated\w*|ensure\w*Access\w*|getUserId\w*|getActorId|getAuth|verify\w*|isInternal\w*|isScheduler\w*)\b/g)].map(m=>m[1]));
        routes.push({file,line:line(n),endLine:sf.getLineAndCharacterOfPosition(n.end).line+1,method:expr.split('.')[1].toUpperCase(),path,guardHints:hints,storage,review:'UNREVIEWED endpoint; guard tokens are not proof'});
      }
      if(file.startsWith('client/') && /(?:fetch|apiRequest|useQuery|useMutation)$/.test(expr)) {
        calls.push({file,line:line(n),kind:expr,args:n.arguments.slice(0,2).map(a=>a.getText(sf).slice(0,1600))});
      }
      if(file==='shared/schema.ts' && /pgTable$/.test(expr)) tables.push({line:line(n),name:n.arguments[0]?.getText(sf),fields:n.arguments[1]&&ts.isObjectLiteralExpression(n.arguments[1])?n.arguments[1].properties.map(p=>p.name?.getText(sf)).filter(Boolean):[]});
      if(file.startsWith('server/') && /(?:cron\.schedule|setInterval|setTimeout|start\w*Scheduler|\.start)$/.test(expr)) jobs.push({file,line:line(n),call:expr,arguments:n.arguments.map(a=>a.getText(sf).slice(0,180))});
    }
    if ((ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n)) && n.tagName.getText(sf)==='Route') pages.push({file,line:line(n),declaration:n.getText(sf)});
    if ((ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n)) && file.startsWith('client/')) {
      const tag = n.tagName.getText(sf);
      const attrs = n.attributes.properties.map(p=>p.getText(sf));
      if (/Button|MenuItem|DialogAction|DialogCancel|DialogClose|Link|^button$|^form$|^a$/.test(tag) || attrs.some(a=>/^on(Click|Submit|Select)=/.test(a))) {
        const parent=ts.isJsxOpeningElement(n)?n.parent:n;
        actions.push({file,line:line(n),tag,attributes:attrs,content:parent.getText(sf).slice(0,1600),review:'Declared control; visibility and runtime branch require trace'});
      }
    }
    if(ts.isPropertyAccessExpression(n) && n.expression.getText(sf)==='process.env') configuration.push({file,line:line(n),name:n.name.getText(sf)});
    // These production scheduler functions take env = process.env for testability.
    if(ts.isPropertyAccessExpression(n) && n.expression.getText(sf)==='env' && ['server/alert-email-scheduler.ts','server/auto-refresh-scheduler.ts','server/ga4-daily-scheduler.ts'].includes(file) && /^[A-Z][A-Z_0-9]+$/.test(n.name.getText(sf))) configuration.push({file,line:line(n),name:n.name.getText(sf),via:'env parameter defaults to process.env'});
    if(ts.isPropertyAccessExpression(n) && n.expression.getText(sf)==='import.meta.env') configuration.push({file,line:line(n),name:n.name.getText(sf)});
    // Candidate visible labels/fields, deliberately not a semantic certification.
    if(file.startsWith('client/') && /(?:pages|components)\//.test(file) && (ts.isJsxText(n)||ts.isStringLiteral(n))) {
      const s=(ts.isJsxText(n)?n.getText(sf):n.text).trim().replace(/\s+/g,' ');
      if(s.length>1 && s.length<200 && /revenue|spend|conversion|session|user|ROAS|ROI|CPA|profit|benchmark|KPI|engagement|impression|click|pipeline|budget|unavailable|no data|loading|stale|source|fresh|report|schedule|alert/i.test(s)) values.push({file,line:line(n),text:s});
    }
    ts.forEachChild(n,walk);
  }
  walk(sf);
}
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(out+'/inventory.json',JSON.stringify({head,method:'TypeScript AST over tracked source; declarations and candidate labels only; runtime conditions, dynamic routes, semantic values and guards require manual trace',routes,pages,calls,tables,jobs,tests,values,actions,configuration},null,2)+'\n');
const cell=s=>String(s).replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const link=(f,l)=>`[${f}:${l}](../../../${f}#L${l})`;
let md=`# Current source inventory\n\nRevision: \`${head}\`. Generated from tracked files by [inventory.cjs](inventory.cjs).\n\nThis is a declaration inventory, not a completeness or safety claim for semantic value paths. Every entry remains unverified unless the audit's trace record supplies evidence. Guard hints merely locate text. Conditional registrations and dynamic values need manual review.\n\nCounts: ${routes.length} server route/middleware declarations; ${pages.length} React route declarations (including duplicates/public/fallback); ${tables.length} schema tables; ${calls.length} client fetch/query/mutation call sites; ${jobs.length} scheduling/start/timer call sites; ${tests.length} test files; ${values.length} candidate value/label occurrences. Full call sites, tables, timer arguments and value candidates are in [inventory.json](inventory.json).\n\n## Server declarations\n\n| Method | Path | Location | Guard hints | Storage calls |\n|---|---|---|---|---|\n`;
for(const r of routes) md+=`| ${r.method} | ${cell(r.path)} | ${link(r.file,r.line)} | ${r.guardHints.join(', ')||'NONE in declaration'} | ${r.storage.join(', ')} |\n`;
md+='\n## React route declarations\n\n| Declaration | Location |\n|---|---|\n';
for(const p of pages) md+=`| ${cell(p.declaration)} | ${link(p.file,p.line)} |\n`;
md+='\n## Persistence inventory\n\n| Table | Fields |\n|---|---|\n';
for(const t of tables) md+=`| ${t.name} | ${t.fields.join(', ')} |\n`;
md+='\n## Job/start/timer declarations\n\n| Call | Location | Arguments (abbreviated) |\n|---|---|---|\n';
for(const j of jobs) md+=`| ${cell(j.call)} | ${link(j.file,j.line)} | ${cell(j.arguments.join(' / '))} |\n`;
md+='\n## Configuration names\n\nNames only; no environment values collected. Indirect/config-file settings require the operations record.\n\n| Name | Code references |\n|---|---|\n';
for(const name of unique(configuration.map(c=>c.name)).sort()) md+=`| ${name} | ${configuration.filter(c=>c.name===name).map(c=>link(c.file,c.line)).join(', ')} |\n`;
md+=`\n## Declared user controls\n\n${actions.length} button/menu/link/form/event controls are retained with file, line, attributes and markup in inventory.json. This includes hidden and conditional controls. Dynamic child labels and reachability are not inferred from an AST node.\n\n`;
fs.writeFileSync(out+'/INVENTORY.md',md);
console.log(JSON.stringify({head,routes:routes.length,endpoints:routes.filter(r=>r.method!=='USE').length,pages:pages.length,tables:tables.length,calls:calls.length,jobs:jobs.length,tests:tests.length,valueCandidates:values.length,actions:actions.length,configuration:unique(configuration.map(c=>c.name)).length}));
