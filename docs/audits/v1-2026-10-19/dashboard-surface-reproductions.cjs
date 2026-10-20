const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const dir = 'docs/audits/v1-2026-10-19/';
const compile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function render(file, query) {
  const queries = [], charts = [], controls = [];
  const wrapper = props => React.createElement('div', {}, props.children);
  const ui = new Proxy({}, { get: (_, name) => props => { if(name === 'Button' || name === 'Select') controls.push({ type: name, hasClick: typeof props.onClick === 'function', hasChange: typeof props.onValueChange === 'function' }); return wrapper(props); } });
  const modules = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    '@tanstack/react-query': { useQuery: options => { queries.push(options.queryKey); return query; } },
    '@/lib/clientContext': { useClient: () => ({ selectedClientId: 'client-a' }) },
    'lucide-react': ui,
    recharts: new Proxy({}, { get: (_, name) => props => { if(name === 'Pie') charts.push(props.data); return wrapper(props); } }),
  };
  const exports = {};
  function requireFixture(name) {
    if (Object.hasOwn(modules,name)) return modules[name];
    if (name.startsWith('@/components/ui/')) return ui;
    if (file.endsWith('/dashboard.tsx') && name.startsWith('@/components/')) return { default: wrapper, __esModule: true };
    throw new Error(`Unexpected fixture module ${name}`);
  }
  new Function('require','exports',compile(fs.readFileSync(file,'utf8')))(requireFixture,exports);
  const html = renderToStaticMarkup(React.createElement(exports.default));
  return { html, queries, charts, controls };
}
async function integrationRoundTrip() {
  const source = ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),99,true);
  const methods = new Map();
  function visit(n) { if(ts.isMethodDeclaration(n) && ['getIntegrations','createIntegration'].includes(n.name.getText(source))) methods.set(n.name.getText(source),n.getText(source)); ts.forEachChild(n,visit); }
  visit(source);
  const rows = [], db = {
    insert: () => ({ values: row => ({ returning: async () => { rows.push({...row,id:'fixture-integration'});return [rows.at(-1)]; } }) }),
    select: () => ({ from: () => ({ orderBy: async () => rows.map(row=>({...row})) }) }),
  };
  const storage = new Function('db','integrations',compile(`const storage = { ${[...methods.values()].join(',\n')} };`) + '\nreturn storage;')(db,{createdAt:'fixture-created'});
  const sf = ts.createSourceFile('r.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),99,true), registrations = [];
  function routes(n) { if(ts.isCallExpression(n) && /^app\.(get|post)$/.test(n.expression.getText(sf)) && n.arguments[0]?.text === '/api/integrations') registrations.push(n.getText(sf)); ts.forEachChild(n,routes); }
  routes(sf);
  const handlers={}, app = { get: (_,h)=>handlers.get=h, post: (_,h)=>handlers.post=h };
  new Function('app','storage',compile(registrations.join(';\n')))(app,storage);
  const sentinel='SYNTHETIC_PROVIDER_TOKEN_ONLY';
  const credentials=JSON.stringify({email:'fixture@example.invalid',accessToken:sentinel});
  const response=()=>({ statusCode:200, json(v){this.payload=v;return this;},status(v){this.statusCode=v;return this;} });
  const posted=response(); await handlers.post({body:{name:'Fixture',platform:'google-analytics',connected:true,credentials},headers:{}},posted);
  assert.equal(rows[0].credentials,credentials); assert.equal(posted.payload.connected,true);
  const read=response(); await handlers.get({headers:{}},read);
  assert.ok(JSON.stringify(read.payload).includes(sentinel));
  return [
    {case:'Anonymous exact POST and storage persist plaintext credential JSON with connected=true without provider validation',status:posted.statusCode,plaintextCredentialPreserved:true,providerCalls:0},
    {case:'Anonymous exact GET and storage return synthetic provider token field',status:read.statusCode,syntheticCredentialReturned:true},
  ];
}
async function main() {
  const results=[];
  const failed=render('client/src/components/dashboard/metrics-cards.tsx',{data:undefined,isLoading:false,error:new Error('Fixture read failure'),isError:true});
  assert.ok(failed.html.includes('$0')); assert.ok(failed.html.includes('Total Impressions')); assert.ok(!failed.html.includes('Unavailable'));
  results.push({case:'Failed Metrics query renders zero cards including USD Spend and 0% change',queries:failed.queries});
  const loading=render('client/src/components/dashboard/metrics-cards.tsx',{data:undefined,isLoading:true});
  assert.ok(!loading.html.includes('$0'));
  results.push({case:'Loading Metrics control retains skeleton rather than zero value'});
  const metric=render('client/src/components/dashboard/metrics-cards.tsx',{data:[{name:'Fixture metric',value:'42',change:'+3%',icon:'eye'}],isLoading:false});
  assert.ok(metric.html.includes('42'));assert.ok(metric.html.includes('+3%'));
  results.push({case:'Configured global metric value and change are rendered verbatim',queries:metric.queries});
  const campaigns=[
    {id:'a',clientId:'client-a',currency:'EUR',name:'Fixture A',platform:'GA4',spend:'100',revenue:'120',impressions:0,clicks:0,status:'paused'},
    {id:'b',clientId:'client-b',currency:'USD',name:'Fixture B',platform:'GA4',spend:'100',revenue:'150',impressions:100,clicks:3,status:'active'},
  ];
  const table=render('client/src/components/dashboard/campaign-table.tsx',{data:[campaigns[0]],isLoading:false});
  assert.ok(table.html.includes('$100.00'));assert.ok(table.html.includes('$120.00'));assert.ok(table.html.includes('0.00%'));assert.ok(table.html.includes('Paused'));
  results.push({case:'Selected-client table relabels EUR values USD; displays zero-denominator CTR and paused row under Active Campaigns',queries:table.queries,unboundButtons:table.controls.filter(c=>c.type==='Button'&&!c.hasClick).length});
  const chart=render('client/src/components/dashboard/campaign-chart.tsx',{data:campaigns,isLoading:false});
  assert.deepEqual(chart.queries,[['/api/campaigns']]);assert.deepEqual(chart.charts,[[{name:'GA4',value:200}]]);
  results.push({case:'Chart combines different-client EUR/USD Spend into one platform amount without selected-client query',queries:chart.queries,chartRows:chart.charts[0]});
  const performance=render('client/src/components/dashboard/performance-chart.tsx',{data:undefined,isLoading:false,error:new Error('Fixture failure')});
  assert.ok(performance.html.includes('No performance data available'));
  results.push({case:'Failed performance query instructs user to connect platforms, indistinguishable from empty data',queries:performance.queries});
  const dashboard=render('client/src/pages/dashboard.tsx',{});
  assert.equal(dashboard.controls.filter(c=>c.type==='Button'&&!c.hasClick).length,1);
  results.push({case:'Dashboard Export button has no click handler; date selector state is not passed to any data component',unboundExportButtons:1});
  results.push(...await integrationRoundTrip());
  fs.writeFileSync(dir+'dashboard-surface-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',at:new Date().toISOString(),boundary:'Current component SSR with fixture query/UI primitives and selected client; exact integration handlers/storage with synthetic DB builder. No browser authentication, real database, network, token or provider. Date-selector propagation separately confirmed in current JSX; no full browser gesture certificate.',results},null,2)+'\n');
  console.log(JSON.stringify({cases:results.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
