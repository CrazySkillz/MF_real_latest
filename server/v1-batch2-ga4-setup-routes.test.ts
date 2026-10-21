import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
const source=ts.createSourceFile('routes.ts',readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true);
const declarations=new Map<string,string>(), routes=new Map<string,string>();
function visit(n:ts.Node){
 if(ts.isVariableDeclaration(n))declarations.set(n.name.getText(source),`const ${n.getText(source)};`);
 if(ts.isCallExpression(n)&&/^app\.(get|post|delete)$/.test(n.expression.getText(source))&&ts.isStringLiteral(n.arguments[0]))routes.set(n.arguments[0].text,n.arguments[n.arguments.length-1].getText(source));
 ts.forEachChild(n,visit);
}visit(source);
const compile=(code:string)=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture(){
 const storage:any={getPendingGA4OAuthConnection:vi.fn(async()=>({id:'pending',campaignId:'campaign',isActive:false,accessToken:'fixture'})),getGA4Connections:vi.fn(async()=>[]),
  commitGA4OAuthConnection:vi.fn(),cancelGA4OAuthConnection:vi.fn(async()=>true),stageGA4OAuthConnection:vi.fn(),getGA4PublicationVersion:vi.fn(async()=>null),updateGA4ConnectionTokens:vi.fn()};
 const realGA4Client={fetchPropertiesFromGoogle:vi.fn(async()=>[{id:'123',name:'Fixture'}]),disconnect:vi.fn()};
 const env:any={storage,realGA4Client,console:{error(){}},global:{oauthConnections:new Map([['campaign',{propertyId:'fake'}]]),realGA4Connections:new Map([['campaign',{}]])},
  GA4_SERVICE_ACCOUNT_METHOD:'service_account',normalizeGA4ServiceAccountPropertyId:(x:string)=>x,
  getGA4HistoricalImportStartDate:()=> '2026-09-21',ga4Service:{refreshAccessToken:vi.fn()},
  ensureCampaignAccess:vi.fn(async(req:any,res:any,id:string)=>{if(req.actor!=='owner'||id!=='campaign'){res.status(404).json({});return null;}return{id,reportingTimeZone:'Europe/Amsterdam'};})};
 const bind=(code:string,name:string)=>new Function(...Object.keys(env),compile(code)+`;return ${name};`)(...Object.values(env));
 env.discoverStoredGA4Properties=bind(declarations.get('discoverStoredGA4Properties')!,'discoverStoredGA4Properties');
 const select=bind(declarations.get('selectGA4Property')!,'selectGA4Property');
 const status=bind(`const handler=${routes.get('/api/campaigns/:id/ga4-connection-status')};`,'handler');
 const cancel=bind(`const handler=${routes.get('/api/campaigns/:id/ga4-oauth-pending/:connectionId')};`,'handler');
 return {...env,select,status,cancel};
}
const req=(body:any={})=>({actor:'owner',params:{id:'campaign',connectionId:'pending'},body:{campaignId:'campaign',propertyId:'123',pendingConnectionId:'pending',lookbackDays:30,...body}});
const res=()=>({statusCode:200,body:null as any,status(n:number){this.statusCode=n;return this;},json(body:any){this.body=body;return this;}});
describe('V1-037/039 actual GA4 setup routes',()=>{
 it('checks ownership before discovery or mutation',async()=>{const f=fixture();for(const handler of [f.select,f.status,f.cancel]){const r=res();await handler({...req(),actor:'other'},r);expect(r.statusCode).toBe(404);}expect(f.storage.getPendingGA4OAuthConnection).not.toHaveBeenCalled();expect(f.realGA4Client.fetchPropertiesFromGoogle).not.toHaveBeenCalled();});
 it('validates lookback before any property discovery or write',async()=>{const f=fixture(),r=res();await f.select(req({lookbackDays:90}),r);expect(r.statusCode).toBe(400);expect(f.storage.getPendingGA4OAuthConnection).not.toHaveBeenCalled();});
 it('commits only a provider-verified pending property and clears caches',async()=>{const f=fixture(),r=res();await f.select(req(),r);expect(r.body.success).toBe(true);expect(f.storage.commitGA4OAuthConnection).toHaveBeenCalledWith('campaign','pending','123','Fixture','2026-09-21');expect(f.global.oauthConnections.size).toBe(0);});
 it.each([403,429,503])('provider HTTP %s cannot commit or masquerade as an empty list',async status=>{const f=fixture();f.realGA4Client.fetchPropertiesFromGoogle.mockRejectedValue(Object.assign(new Error('provider'),{status}));const a=res(),b=res();await f.select(req(),a);await f.status(req(),b);expect(a.statusCode).toBe(502);expect(b.statusCode).toBeGreaterThanOrEqual(400);expect(f.storage.commitGA4OAuthConnection).not.toHaveBeenCalled();});
 it('refuses an inaccessible property',async()=>{const f=fixture(),r=res();await f.select(req({propertyId:'456'}),r);expect(r.statusCode).toBe(403);expect(f.storage.commitGA4OAuthConnection).not.toHaveBeenCalled();});
 it('refuses expired or superseded pending authorizations',async()=>{const f=fixture(),r=res();f.storage.getPendingGA4OAuthConnection.mockResolvedValue(undefined);await f.select(req(),r);expect(r.statusCode).toBe(409);expect(f.storage.stageGA4OAuthConnection).not.toHaveBeenCalled();});
 it('database absence overrides stale process caches',async()=>{const f=fixture(),r=res();f.storage.getPendingGA4OAuthConnection.mockResolvedValue(undefined);await f.status(req(),r);expect(r.body).toEqual({connected:false});expect(f.global.oauthConnections.size).toBe(0);expect(f.realGA4Client.fetchPropertiesFromGoogle).not.toHaveBeenCalled();});
 it('pending discovery is explicit and never returns an active property ID',async()=>{const f=fixture(),r=res();await f.status(req(),r);expect(r.body).toMatchObject({pending:true,pendingConnectionId:'pending',propertyId:'',properties:[{id:'123',name:'Fixture'}]});});
 it('cancels only the scoped pending row and reports failure truthfully',async()=>{const f=fixture();let r=res();await f.cancel(req(),r);expect(f.storage.cancelGA4OAuthConnection).toHaveBeenCalledWith('campaign','pending');expect(r.body.success).toBe(true);f.storage.cancelGA4OAuthConnection.mockRejectedValue(new Error('fixture'));r=res();await f.cancel(req(),r);expect(r.statusCode).toBe(500);expect(r.body.success).toBe(false);});
 it('renews an expired active token using the existing publication guard',async()=>{const f=fixture(),r=res();const active={id:'active',campaignId:'campaign',propertyId:'123',method:'access_token',isActive:true,accessToken:'old',refreshToken:'refresh'};f.storage.getPendingGA4OAuthConnection.mockResolvedValue(undefined);f.storage.getGA4Connections.mockResolvedValue([active]);f.realGA4Client.fetchPropertiesFromGoogle.mockRejectedValueOnce(Object.assign(new Error('expired'),{status:401}));f.ga4Service.refreshAccessToken.mockResolvedValue({access_token:'new',expires_in:3600});f.storage.updateGA4ConnectionTokens.mockResolvedValue({...active,accessToken:'new'});await f.status(req(),r);expect(r.statusCode).toBe(200);expect(f.storage.updateGA4ConnectionTokens.mock.calls[0][2]).toMatchObject({publicationVersion:{campaignId:'campaign'},expectedConnection:active});});
});
