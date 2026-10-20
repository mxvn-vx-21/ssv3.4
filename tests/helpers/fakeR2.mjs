// Minimal in-memory stand-in for an R2 bucket (put/get+range/head/delete/list/multipart). For tests only.
export function fakeR2(){const m=new Map(),mp=new Map();
 const buf=async b=>b==null?new Uint8Array(0):b instanceof Uint8Array?b:typeof b==='string'?new TextEncoder().encode(b):new Uint8Array(await new Response(b).arrayBuffer());
 const meta=(k,v)=>({key:k,size:v.b.length,httpMetadata:v.o.httpMetadata,customMetadata:v.o.customMetadata,uploaded:new Date(v.t)});
 return{_m:m,
  async put(k,b,o={}){m.set(k,{b:await buf(b),o,t:Date.now()})},
  async head(k){const v=m.get(k);return v?meta(k,v):null},
  async get(k,opt){const v=m.get(k);if(!v)return null;const r=meta(k,v);let body=v.b;const h=opt&&opt.range;
   if(h&&h.get&&h.get('range')){const x=/bytes=(\d*)-(\d*)/.exec(h.get('range'));const L=v.b.length,s=x[1]===''?Math.max(0,L-+x[2]):+x[1],e=x[1]===''?L-1:Math.min(x[2]===''?L-1:+x[2],L-1);body=v.b.slice(s,e+1);r.range={offset:s,length:e-s+1}}
   r.body=new Response(body).body;return r},
  async delete(k){m.delete(k)},
  async list({prefix=''}={}){return{objects:[...m].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>meta(k,v)),truncated:false}},
  async createMultipartUpload(k,o){const id='mp'+Math.random().toString(36).slice(2);mp.set(id,{k,o,parts:new Map()});return{uploadId:id,key:k}},
  resumeMultipartUpload(k,id){const u=mp.get(id);if(!u||u.k!==k)throw new Error('no such upload');
   return{async uploadPart(n,body){const b=await buf(body);u.parts.set(n,b);return{partNumber:n,etag:'e'+n+'-'+b.length}},
    async complete(parts){const all=parts.sort((a,b)=>a.partNumber-b.partNumber).map(p=>u.parts.get(p.partNumber));const b=new Uint8Array(all.reduce((s,x)=>s+x.length,0));let o=0;for(const x of all){b.set(x,o);o+=x.length}m.set(k,{b,o:u.o,t:Date.now()});mp.delete(id)},
    async abort(){mp.delete(id)}}}}}
