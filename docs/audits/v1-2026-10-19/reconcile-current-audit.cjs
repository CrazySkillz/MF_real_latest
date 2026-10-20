// Audit records only. No application import, database or network access.
const fs=require('node:fs'),assert=require('node:assert/strict'),{parseEnv}=require('node:util');
const dir='docs/audits/v1-2026-10-19/';
const config=parseEnv(fs.readFileSync('.env','utf8'));
const keys=['GA4_SERVICE_ACCOUNT_JSON','GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS'];
fs.writeFileSync(dir+'provider-access-boundary.json',JSON.stringify({
 at:new Date().toISOString(),settings:keys.map(name=>({name,inDotEnv:Boolean(config[name]?.trim()),inInheritedEnvironment:Boolean(process.env[name]?.trim())})),
 boundary:'Presence booleans only; no secret contents retained. Ptomo saved method service_account; current hydrator requires global service-account configuration. No provider request attempted or credential decrypted.',
 runtimePaths:['server/utils/ga4-service-account.ts:23','server/utils/ga4-service-account.ts:63','server/utils/ga4-service-account.ts:106','server/storage.ts:983'],
},null,2)+'\n');
function edit(file,changes){let value=fs.readFileSync(file,'utf8');for(const [pattern,replacement] of changes){assert.ok(pattern.test(value),file+': '+pattern);value=value.replace(pattern,replacement);}fs.writeFileSync(file,value);}
edit(dir+'OPERATIONS_AND_TEMPLATE.md',[
 [/The configuration-name inventory includes110 names found in direct process\.env\/import\.meta\.env access\. Indirect settings \(for example alert-email config's `env\.\*` reads\), external dashboard values and schema-backed per-campaign\/per-source\/report settings also belong to the release manifest\./,
  'The combined configuration inventory now includes119 observed names, including nine additional indirect builder settings. [Current defaults and recovery evidence](CONFIGURATION_AND_RECOVERY.md), [complete name catalog](CONFIGURATION_CATALOG.md). SDK settings, external dashboard values and schema-backed campaign/source/report settings also belong to the release manifest.'],
 [/^\| Backup restore \|.*$/m,
  '| Backup restore | [Synthetic restore](CONFIGURATION_AND_RECOVERY.md):62-table schema,12rows across6populated tables, exact row hashes, original-key decryption and PDF bytes preserved; wrong key fails. | Production backup/PITR/key restore and application recovery remain unverified. Repeat against isolated production backup with live jobs/email/providers disabled; prove agreed recovery point/time and owner/source/report integrity. |'],
 [/Investigate all five non-success provider jobs from the captured live cycle\./,
  'Investigate the captured failed cycles: Oct19 showed14attempted/9succeeded; the Oct20 recheck shows14attempted/8succeeded. Record causes and natural recovery without guessing that redundant campaigns caused the failures.'],
 [/The user delegated conservative realistic figures: the provisional pilot envelope is five simultaneous users,25 campaigns and10,000-row imports\./,
  'The user delegated conservative realistic figures: five simultaneous users and25campaigns. The later actual HTTP pilot established5,000rows as the Revenue UI limit, with10,000rows tested as oversize; the earlier10k computation is parser-only evidence.'],
]);
edit(dir+'SCOPE_AND_VALUES.md',[
 [/Current detailed trace records extend each family below:/,
  'Current detailed trace records extend each family below (later supplements supersede earlier broad rows only at their exact tested boundary):'],
 [/\| `\/clients`, `\/dashboard` \|[^\n]+/,
  '| `/clients`, `/dashboard` | Retained Clients routes selection to Dashboard; global metrics/performance/integrations, campaign chart/table and unbound actions | Current complete field/action trace and nine cases in [entry/Dashboard record](ENTRY_PAGES_AND_DASHBOARD_VALUES.md); V1-002P0 credential exposure and V1-125 scope/value defects. No effective exclusion accepted. |'],
 [/\| `\/campaigns\/:id\/platform-comparison`, `\/audiences`, `\/campaigns\/:id\/kpis`, `\/platforms\/:platformType\/kpis`, `\/linkedin-analytics` \|[^\n]+/,
  '| `/campaigns/:id/platform-comparison`, `/audiences`, `/campaigns/:id/kpis`, `/platforms/:platformType/kpis`, `/linkedin-analytics` | Retained comparison, fabricated audiences and manual/platform KPI pages; LinkedIn functionality deferred | [Current complete retained field/action/fallback inventory](RETAINED_COMPARISON_AUDIENCE_KPI_VALUES.md),11 exact cases; V1-061/062/064/129/130. Full live source/lifecycle acceptance remains unproven. LinkedIn access/job boundary remains required. |'],
 [/Failed current job\/deletion mocks prevent whole-path certificate\./,
  'All original fixture/binding failures now have bounded passing audit-copy diagnoses; original authoritative suite remains failing until agreed repairs/full rerun.'],
]);
console.log(JSON.stringify({reconciledDocuments:2,providerSettingsRecorded:'presence only'}));
