import {readFileSync} from 'node:fs';import ts from 'typescript';import{describe,it,expect,vi}from'vitest';import{z}from'zod';
const source=ts.createSourceFile('routes.ts',readFileSync('server/routes-oauth.ts','utf8'),99,true);let handler='';
function visit(n:ts.Node){if(ts.isCallExpression(n)&&n.expression.getText(source)==='app.delete'&&ts.isStringLiteral(n.arguments[0])&&n.arguments[0].text==='/api/campaigns/:id')handler=n.arguments[n.arguments.length-1].getText(source);ts.forEachChild(n,visit);}visit(source);
const compile=(x:string)=>ts.transpileModule(x,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const id='00000000-0000-4000-8000-000000000001';
function fixture(){const storage={cancelCampaignCreation:vi.fn(async()=>true),deleteCampaignCascade:vi.fn(async()=>true)},ensureCampaignAccess=vi.fn(async()=>({ownerId:'owner',status:'draft'}));const env={storage,ensureCampaignAccess,getActorId:(r:any)=>r.actor,z};return{storage,ensureCampaignAccess,run:new Function(...Object.keys(env),compile(`return ${handler}`))(...Object.values(env))};}
const response=()=>({code:200,body:null as any,status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;}});
const request=(actor:string|null='owner')=>({actor,params:{id},query:{draftCleanup:'1',clientId:'client'}});
describe('V1-092/093 actual cancellation route',()=>{
 it('requires authentication before recording a cancellation',async()=>{const f=fixture(),r=response();await f.run(request(null),r);expect(r.code).toBe(401);expect(f.storage.cancelCampaignCreation).not.toHaveBeenCalled();});
 it('passes only the authenticated actor and exact client/request identity',async()=>{const f=fixture(),r=response();await f.run(request(),r);expect(r.code).toBe(200);expect(f.storage.cancelCampaignCreation).toHaveBeenCalledWith('owner','client',id);expect(f.storage.deleteCampaignCascade).not.toHaveBeenCalled();});
 it('reports foreign or missing client scope as not found',async()=>{const f=fixture(),r=response();f.storage.cancelCampaignCreation.mockResolvedValue(false);await f.run(request(),r);expect(r.code).toBe(404);expect(r.body.success).toBe(false);});
 it('preserves accepted imports and active campaigns',async()=>{const f=fixture(),r=response();f.storage.cancelCampaignCreation.mockRejectedValue(new Error('CAMPAIGN_NO_LONGER_DRAFT'));await f.run(request(),r);expect(r.code).toBe(409);});
 it('preserves the normal delete guard and existing endpoint behavior',async()=>{const f=fixture(),r=response();await f.run({...request(),query:{}},r);expect(f.ensureCampaignAccess).toHaveBeenCalled();expect(f.storage.deleteCampaignCascade).toHaveBeenCalledWith(id);expect(f.storage.cancelCampaignCreation).not.toHaveBeenCalled();});
});
