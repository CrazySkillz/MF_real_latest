// Audit-runner guard only. Live application code and dependencies are unchanged.
const assertLocal = value => {
  const host=String(value||'localhost').toLowerCase().replace(/^\[|\]$/g,'');
  if(!['localhost','127.0.0.1','::1'].includes(host))throw new Error('AUDIT_EXTERNAL_NETWORK_BLOCKED');
};
const originalFetch=globalThis.fetch;
globalThis.fetch=function(input,options){const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);assertLocal(u.hostname);return originalFetch.call(this,input,options);};
for(const name of ['node:http','node:https']){
 const module=require(name),request=module.request,get=module.get;
 function check(args){const a=args[0];if(typeof a==='string'||a instanceof URL)assertLocal(new URL(a).hostname);else assertLocal(a.hostname||a.host);}
 module.request=function(...args){check(args);return request.apply(this,args);};
 module.get=function(...args){check(args);return get.apply(this,args);};
}
