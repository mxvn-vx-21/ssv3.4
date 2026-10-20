import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import nodeCrypto from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {fakeR2} from './helpers/fakeR2.mjs';
crypto.subtle.timingSafeEqual??=(a,b)=>nodeCrypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('schema.sql','utf8'));db.exec(fs.readFileSync('migrations/0002_v2.sql','utf8'));db.exec(fs.readFileSync('migrations/0003_images.sql','utf8'));db.exec(fs.readFileSync('migrations/0004_links.sql','utf8'));db.exec(fs.readFileSync('migrations/0005_cloud.sql','utf8'));
const D1={prepare(sql){let a=[];const st={bind(...x){a=x;return st},async first(){return db.prepare(sql).get(...a)??null},async all(){return{results:db.prepare(sql).all(...a)}},async run(){const r=db.prepare(sql).run(...a);return{meta:{changes:Number(r.changes)}}}};return st}};
const ASSETS={fetch:async u=>{const p=new URL(typeof u==='string'?u:u.url).pathname.slice(1);return new Response(fs.readFileSync('public/'+p))}};
const env={DB:D1,ASSETS,ADMIN_PASSWORD:'correct horse battery staple',RESEND_API_KEY:'re_SECRETKEY_123',DISCORD_WEBHOOK_URL:'https://discord.test/hook/SECRETHOOK'};
const {default:W}=await import('../src/worker.js');
let fail=false;const calls=[];globalThis.fetch=async(u,o)=>{calls.push(String(u));return new Response('{}',{status:fail&&String(u).includes('resend')?500:200})};
const O='https://t.test',call=(p,o={},ip='1.1.1.1')=>W.fetch(new Request(O+p,{...o,headers:{'cf-connecting-ip':ip,...(o.headers||{})}}),env);
let cookie='',csrf='';const A=(p,m='GET',b,x={})=>call('/api/admin/'+p,{method:m,body:b?JSON.stringify(b):undefined,headers:{cookie,'x-csrf':csrf,'content-type':'application/json',...x}});
const jj=async r=>({s:r.status,...await r.json()});
test('admin API requires a session',async()=>{assert.equal((await A('stats')).status,401);assert.equal((await call('/preview/draft')).status,401)});
test('login: wrong password fails, rate limited after 5',async()=>{for(let i=0;i<5;i++)assert.equal((await call('/api/login',{method:'POST',body:JSON.stringify({password:'bad'+i})},'9.9.9.9')).status,401);assert.equal((await call('/api/login',{method:'POST',body:JSON.stringify({password:'x'})},'9.9.9.9')).status,429)});
test('login ok sets HttpOnly session; CSRF enforced on mutations',async()=>{const r=await call('/api/login',{method:'POST',body:JSON.stringify({password:env.ADMIN_PASSWORD})});assert.equal(r.status,200);const sc=r.headers.get('set-cookie');assert.match(sc,/HttpOnly/);cookie=sc.split(';')[0];csrf=(await jj(await A('me'))).csrf;
 assert.equal((await A('site','PUT',{config:{}},{'x-csrf':'wrong'})).status,403)});
let draft,rev;
test('draft save: validation, pricing limit, optimistic concurrency',async()=>{const g=await jj(await A('site'));draft=g.draft;rev=g.draftUpdated;
 const bad=structuredClone(draft);bad.pricing[0].price=1500;assert.equal((await A('site','PUT',{config:bad,baseUpdated:rev})).status,422);
 draft.site.tagline='Changed';const ok=await jj(await A('site','PUT',{config:draft,baseUpdated:rev}));assert.equal(ok.s,200);
 assert.equal((await A('site','PUT',{config:draft,baseUpdated:rev})).status,409,'stale revision must be rejected');rev=ok.updated});
test('public site unchanged until publish; publish snapshots; restore creates new version',async()=>{
 assert.ok(!(await (await call('/')).text()).includes('Changed'));
 assert.equal((await A('publish','POST',{})).status,400);assert.equal((await A('publish','POST',{confirm:true})).status,200);
 assert.ok((await (await call('/')).text()).includes('Changed'));
 const v=(await jj(await A('versions'))).items;assert.equal(v.length,1);
 draft.site.tagline='Second';const u=await jj(await A('site','PUT',{config:draft,baseUpdated:rev}));rev=u.updated;await A('publish','POST',{confirm:true});
 const vs=(await jj(await A('versions'))).items;assert.equal(vs.length,2);
 const old=vs[vs.length-1];const d=await jj(await A(`versions/diff?a=${old.id}&b=0`));assert.ok(d.changes.some(c=>c.path==='site.tagline'));
 assert.equal((await A(`versions/${old.id}/restore`,'POST',{})).status,400);assert.equal((await A(`versions/${old.id}/restore`,'POST',{confirm:true})).status,200);
 assert.equal((await jj(await A('versions'))).items.length,3,'restore adds a version, history not rewritten');assert.ok((await (await call('/')).text()).includes('Changed'))});
let cid;
test('client drafts are isolated; review links are hashed, read-only, revocable',async()=>{
 cid=(await jj(await A('clients','POST',{label:'Acme'}))).id;const c=await jj(await A('clients/'+cid));c.config.site.brand='ACME-ONLY';
 assert.equal((await A('clients/'+cid,'PUT',{config:c.config,baseUpdated:c.client.updated})).status,200);
 assert.ok(!(await (await call('/')).text()).includes('ACME-ONLY'));assert.ok(!JSON.stringify(await (await call('/api/public')).json()).includes('ACME-ONLY'));
 assert.equal((await call('/preview/client/'+cid)).status,401);
 const sh=await jj(await A(`clients/${cid}/share`,'POST',{hours:1}));const tok=sh.url.split('/p/')[1];assert.ok(tok.length>=60);
 const pv=await call('/p/'+tok);assert.equal(pv.status,200);assert.match(await pv.text(),/ACME-ONLY/);assert.equal(pv.headers.get('x-robots-tag'),'noindex');
 const stored=db.prepare('SELECT token_hash FROM shares').get().token_hash;assert.notEqual(stored,tok);
 assert.equal((await call('/p/'+tok,{method:'POST',headers:{'x-csrf':csrf}})).status,200);assert.equal((await call('/api/admin/stats',{headers:{}})).status,401,'review link grants no admin access');
 const sid=db.prepare('SELECT id FROM shares').get().id;await A(`clients/${cid}/revoke`,'POST',{shareId:sid});assert.equal((await call('/p/'+tok)).status,404);
 assert.equal((await call('/p/'+'0'.repeat(64))).status,404)});
const body=(o={})=>JSON.stringify({name:'Ada',email:'ada@example.com',type:'Landing page',budget:'₹250',desc:'A landing page for my shop.',features:['Animations'],...o});
test('inquiry: validation, success returns reference, duplicate blocked',async()=>{
 assert.equal((await call('/api/inquiry',{method:'POST',body:body({email:'bad'})},'2.2.2.2')).status,422);
 const r=await jj(await call('/api/inquiry',{method:'POST',body:body()},'2.2.2.2'));assert.equal(r.s,200);assert.match(r.ref,/^[0-9A-F]{8}$/);
 assert.equal((await call('/api/inquiry',{method:'POST',body:body()},'3.3.3.3')).status,409);
 const row=db.prepare('SELECT email_status e,discord_status d FROM inquiries').get();assert.deepEqual([row.e,row.d],['sent','sent'])});
test('failed email is tracked, retry sends only the failed channel, never duplicates the record',async()=>{
 fail=true;calls.length=0;const r=await jj(await call('/api/inquiry',{method:'POST',body:body({email:'b@example.com',desc:'Second project description'})},'4.4.4.4'));assert.equal(r.s,200,'discord still delivered');
 const row=db.prepare("SELECT id,email_status e,discord_status d FROM inquiries WHERE email_status='failed'").get();assert.equal(row.d,'sent');fail=false;calls.length=0;
 assert.equal((await jj(await A(`inquiries/${row.id}/retry`,'POST'))).s,200);assert.equal(calls.length,1);assert.match(calls[0],/resend/);assert.equal(db.prepare('SELECT COUNT(*) n FROM inquiries').get().n,2);
 assert.equal((await A(`inquiries/${row.id}/retry`,'POST')).status,409,'nothing left to retry')});
test('CRM: status/tags/notes, filters, CSV is injection-safe, internal notes excluded by default',async()=>{
 const id=db.prepare('SELECT id FROM inquiries LIMIT 1').get().id;assert.equal((await A('inquiries/'+id,'PATCH',{status:'Reviewing',tags:['hot'],notes:'private note',clientId:cid})).status,200);
 const l=await jj(await A('inquiries?status=Reviewing'));assert.equal(l.items.length,1);assert.equal(l.items[0].internalNotes,'private note');
 db.prepare("UPDATE inquiries SET json=json_set(json,'$.name','=cmd|calc')").run();
 const csv=await (await A(`inquiries/export?format=csv&ids=${id}`)).text();assert.ok(csv.includes(`"'=cmd|calc"`));assert.ok(!csv.includes('private note'));
 assert.ok((await (await A(`inquiries/export?format=csv&ids=${id}&notes=1`)).text()).includes('private note'));
 assert.equal((await A('inquiries/'+id,'DELETE')).status,400);assert.equal((await A('inquiries/'+id+'?confirm=yes','DELETE')).status,200)});
test('exports: valid JSON, versioned, no secrets, no inquiries (except explicit backup)',async()=>{
 const pub=await (await A('export/live')).text();const j=JSON.parse(pub);assert.equal(j.schemaVersion,1);for(const s of['re_SECRETKEY_123','SECRETHOOK','correct horse',csrf])assert.ok(!pub.includes(s));assert.equal(j.inquiries,undefined);
 const bk=JSON.parse(await (await A('export/backup')).text());assert.ok(Array.isArray(bk.inquiries))});
test('import: dry-run summary, confirmation required, invalid files change nothing',async()=>{
 const pub=JSON.parse(await (await A('export/live')).text());const before=db.prepare("SELECT json FROM site WHERE id='draft'").get().json;
 const bad=structuredClone(pub);bad.pricing[0].price=5000;assert.equal((await A('import','POST',{data:bad,target:'draft'})).status,422);
 const dry=await jj(await A('import','POST',{data:pub,target:'draft'}));assert.ok(dry.dryRun);assert.equal((await A('import','POST',{data:pub,target:'draft',dryRun:false})).status,400);
 assert.equal(db.prepare("SELECT json FROM site WHERE id='draft'").get().json,before);
 assert.equal((await A('import','POST',{data:{exportType:'backup',schemaVersion:1},target:'draft'})).status,422)});
test('analytics: privacy-safe counters, DNT respected, unknown events rejected',async()=>{
 const ev=(b,h={})=>call('/api/e',{method:'POST',body:JSON.stringify(b),headers:h});assert.equal((await ev({t:'view',r:'google.com'})).status,204);assert.equal((await ev({t:'evil'})).status,400);await ev({t:'view'},{dnt:'1'});
 const rows=db.prepare('SELECT * FROM events').all();assert.equal(rows.length,1);assert.equal(rows[0].ref,'search');assert.ok(!JSON.stringify(rows).includes('1.1.1.1'));
 const an=await jj(await A('analytics?days=7'));assert.ok(an.configured)});
test('public pages: 404, robots, sitemap, no private paths indexed',async()=>{assert.equal((await call('/nope')).status,404);const rb=await (await call('/robots.txt')).text();assert.match(rb,/Disallow: \/dashboard/);assert.match(await (await call('/sitemap.xml')).text(),/<loc>https:\/\/t\.test\/<\/loc>/);
 const h=await (await call('/')).text();assert.match(h,/rel="canonical"/);assert.match(h,/og:image/);assert.equal((await A('health')).status,200)});

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
const up=(name,buf,h={},e=env)=>W.fetch(new Request(O+'/api/admin/images',{method:'POST',body:buf,headers:{cookie,'x-csrf':csrf,'x-name':name,'content-type':'application/octet-stream',...h}}),e);
test('image host: auth + CSRF required for upload and listing',async()=>{assert.equal((await W.fetch(new Request(O+'/api/admin/images',{method:'POST',body:PNG,headers:{'x-name':'a1'}}),env)).status,401);
 assert.equal((await W.fetch(new Request(O+'/api/admin/images',{method:'POST',body:PNG,headers:{cookie,'x-name':'a1'}}),env)).status,403);assert.equal((await call('/api/admin/images')).status,401)});
test('image host: content sniffing, reserved names, SVG blocked, size cap',async()=>{
 assert.equal((await up('fake',Buffer.from('not an image at all'))).status,415,'text renamed as image');
 assert.equal((await up('vec',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).status,415,'SVG refused');
 for(const n of['dashboard','imghost','api','p','Bad Name','../x','x.png',''])assert.equal((await up(n,PNG)).status,422,n);
 assert.equal((await up('huge',Buffer.concat([PNG,Buffer.alloc(1400*1024)]))).status,413)});
test('image host: upload, public serving headers, extension alias, 404, conflict/overwrite',async()=>{
 const r=await jj(await up('my-thumb',PNG,{'x-label':encodeURIComponent('Test thumb')}));assert.equal(r.s,200);assert.equal(r.url,O+'/my-thumb');
 const g=await call('/my-thumb');assert.equal(g.status,200);assert.equal(g.headers.get('content-type'),'image/png');assert.equal(g.headers.get('x-content-type-options'),'nosniff');assert.match(g.headers.get('content-security-policy'),/sandbox/);assert.deepEqual(Buffer.from(await g.arrayBuffer()),PNG);
 assert.equal((await call('/my-thumb.png')).status,200);assert.equal((await call('/my-thumb',{headers:{'if-none-match':g.headers.get('etag')}})).status,304);assert.equal((await call('/nope-img')).status,404);
 assert.equal((await up('my-thumb',PNG)).status,409);assert.equal((await up('my-thumb',PNG,{'x-overwrite':'1'})).status,200);
 assert.equal((await jj(await A('images'))).items[0].name,'my-thumb')});
test('image host: deleting an image used by published content warns first',async()=>{
 const d=(await jj(await A('site'))).draft,u=(await jj(await A('site'))).draftUpdated;d.projects[0].thumb=O+'/my-thumb';const sv=await jj(await A('site','PUT',{config:d,baseUpdated:u}));assert.equal(sv.s,200);await A('publish','POST',{confirm:true});
 const del=await jj(await A('images/my-thumb','DELETE'));assert.equal(del.s,409);assert.ok(del.usedIn.includes('live'));assert.equal((await call('/my-thumb')).status,200);
 assert.equal((await A('images/my-thumb?force=1','DELETE')).status,200);assert.equal((await call('/my-thumb')).status,404)});
test('image host: R2 storage path works when IMAGES is bound',async()=>{const m=new Map(),R2={async put(k,b,o){m.set(k,{b,o:o||{}})},async get(k){const x=m.get(k);return x?{body:x.b,size:x.b.length,httpMetadata:x.o.httpMetadata,customMetadata:x.o.customMetadata}:null},async head(k){return m.get(k)?{}:null},async delete(k){m.delete(k)},async list(){return{objects:[...m].map(([k,x])=>({key:k,size:x.b.length,httpMetadata:x.o.httpMetadata,customMetadata:x.o.customMetadata,uploaded:new Date()}))}}};
 const e2={...env,IMAGES:R2};assert.equal((await up('r2-pic',PNG,{},e2)).status,200);const g=await W.fetch(new Request(O+'/r2-pic'),e2);assert.equal(g.status,200);assert.equal(g.headers.get('content-type'),'image/png');
 assert.equal((await up('big',Buffer.concat([PNG,Buffer.alloc(2*1024*1024)]),{},e2)).status,200,'R2 allows up to 5 MB');assert.equal(db.prepare("SELECT COUNT(*) n FROM images WHERE name='r2-pic'").get().n,0,'nothing written to D1')});

const LK=(m,p,b)=>A('links'+p,m,b);const WA='https://wa.me/message/M7Q7RN77CDEEK1';
test('short links: admin only (auth + CSRF)',async()=>{assert.equal((await call('/api/admin/links')).status,401);assert.equal((await W.fetch(new Request(O+'/api/admin/links',{method:'POST',body:JSON.stringify({name:'x1',url:WA}),headers:{cookie,'content-type':'application/json'}}),env)).status,403);assert.equal((await call('/link')).status,200,'page shell loads; data needs login')});
test('short links: create, redirect (302, case-insensitive, trailing slash), click counter',async()=>{
 const c=await jj(await LK('POST','',{name:'WA',url:WA}));assert.equal(c.s,200);assert.equal(c.short,O+'/wa');
 for(const path of['/wa','/WA','/wa/']){const r=await call(path,{redirect:'manual'});assert.equal(r.status,302,path);assert.equal(r.headers.get('location'),WA);assert.equal(r.headers.get('cache-control'),'no-store')}
 assert.equal(db.prepare("SELECT clicks FROM links WHERE name='wa'").get().clicks,3);
 assert.equal((await call('/wa',{method:'HEAD'})).status,302);assert.equal(db.prepare("SELECT clicks FROM links WHERE name='wa'").get().clicks,3,'HEAD does not count');
 assert.equal((await jj(await LK('GET',''))).items[0].clicks,3)});
test('short links: bad names, bad/unsafe URLs, self-loops, duplicates',async()=>{
 for(const n of['dashboard','link','imghost','api','p','bad name','../x','a.b',''])assert.equal((await LK('POST','',{name:n,url:WA})).status,422,'name '+n);
 for(const u of['javascript:alert(1)','data:text/html,x','ftp://x.com/a','/relative','wa.me/x','https://a b.com','',O+'/ok-self'])assert.equal((await LK('POST','',{name:u===O+'/ok-self'?'ok-self':'zz9',url:u})).status,422,'url '+u);
 assert.equal((await LK('POST','',{name:'wa',url:WA})).status,409)});
test('short links and images cannot share a name (either direction); images still served',async()=>{
 assert.equal((await up('wa',PNG)).status,409,'image blocked by link');await up('pic-one',PNG);assert.equal((await LK('POST','',{name:'pic-one',url:WA})).status,409,'link blocked by image');
 assert.equal((await call('/pic-one')).status,200,'image route unaffected');assert.equal((await call('/nothing-here')).status,404)});
test('short links: edit destination and delete',async()=>{
 assert.equal((await LK('PATCH','/wa',{url:'javascript:1'})).status,422);assert.equal((await LK('PATCH','/wa',{url:'https://example.com/new?x=1'})).status,200);
 assert.equal((await call('/wa',{redirect:'manual'})).headers.get('location'),'https://example.com/new?x=1');assert.equal((await LK('PATCH','/nope',{url:WA})).status,404);
 assert.equal((await LK('DELETE','/wa')).status,200);assert.equal((await call('/wa',{redirect:'manual'})).status,404);assert.equal((await LK('DELETE','/wa')).status,404)});

// ---------------- /cloud ----------------
const R2=fakeR2(),envC={...env,CLOUD:R2};
const CF=(path,o={},e=envC)=>W.fetch(new Request(O+path,{...o,headers:{cookie,'x-csrf':csrf,...(o.headers||{})}}),e);
const putFile=(name,buf,type='')=>CF('/api/admin/cloud/upload',{method:'PUT',body:buf,headers:{'x-filename':encodeURIComponent(name),'x-type':type,'content-length':String(buf.length)}});
test('cloud: requires login + CSRF; reports missing R2 honestly',async()=>{
 assert.equal((await W.fetch(new Request(O+'/api/admin/cloud'),envC)).status,401);
 assert.equal((await W.fetch(new Request(O+'/api/admin/cloud/upload',{method:'PUT',body:'x',headers:{cookie,'content-length':'1'}}),envC)).status,403);
 assert.deepEqual(await (await CF('/api/admin/cloud',{},env)).json(),{configured:false});assert.equal((await CF('/api/admin/cloud/upload',{method:'PUT',body:'x',headers:{'content-length':'1'}},env)).status,503);
 assert.equal((await call('/c/'+'a'.repeat(64))).status,404)});
let cid1;
test('cloud: any file type uploads, lists, downloads byte-for-byte as an attachment',async()=>{
 const cases=[['report.pdf',Buffer.from('%PDF-1.7 fake'),'application/pdf'],['setup.exe',Buffer.from([0x4d,0x5a,0,1,2,255]),'application/x-msdownload'],['noext',Buffer.from('abc'),''],['weird.xyz123',Buffer.from([0,1,2,3]),'x/y'],['empty.txt',Buffer.alloc(0),'text/plain'],['page.html',Buffer.from('<script>alert(1)</script>'),'text/html'],['vec.svg',Buffer.from('<svg onload=alert(1)/>'),'image/svg+xml'],['ünï cödé 日本語.zip',Buffer.from('PK'),'application/zip']];
 const ids={};for(const[n,b,t]of cases){const r=await jj(await putFile(n,b,t));assert.equal(r.s,200,n);ids[n]=r.id}
 const list=await jj(await CF('/api/admin/cloud'));assert.equal(list.items.length,cases.length);assert.equal(list.used,cases.reduce((x,c)=>x+c[1].length,0));cid1=ids['report.pdf'];
 for(const[n,b]of cases){const d=await CF('/api/admin/cloud/dl/'+ids[n]);assert.equal(d.status,200,n);assert.deepEqual(Buffer.from(await d.arrayBuffer()),b,n);assert.match(d.headers.get('content-disposition'),/^attachment;/);assert.equal(d.headers.get('x-content-type-options'),'nosniff');assert.match(d.headers.get('content-security-policy'),/sandbox/)}
 for(const n of['page.html','vec.svg'])assert.equal((await CF('/api/admin/cloud/dl/'+ids[n])).headers.get('content-type'),'application/octet-stream','active content never served with its own type');
 assert.match((await CF('/api/admin/cloud/dl/'+ids['ünï cödé 日本語.zip'])).headers.get('content-disposition'),/filename\*=UTF-8''%C3%BCn/)});
test('cloud: file names are sanitised, ids are random, bad ids rejected',async()=>{
 const r=await jj(await putFile('../../etc/passwd\u0000.txt',Buffer.from('x')));assert.match(r.id,/^[a-f0-9]{32}$/);
 const it=(await jj(await CF('/api/admin/cloud'))).items.find(i=>i.id===r.id);assert.ok(!/[\\/\u0000]/.test(it.name),it.name);assert.ok([...R2._m.keys()].every(k=>/^cloud\/[a-f0-9]{32}$/.test(k)),'keys never contain user input');
 assert.equal((await CF('/api/admin/cloud/dl/not-an-id')).status,400);assert.equal((await CF('/api/admin/cloud/dl/'+'0'.repeat(32))).status,404);
 assert.equal((await CF('/api/admin/cloud/upload',{method:'PUT',body:'x',headers:{'content-length':String(101*1024*1024)}})).status,413)});
test('cloud: range downloads (resume / media seeking)',async()=>{
 const big=Buffer.from('0123456789abcdefghij'),r=await jj(await putFile('r.bin',big));
 const a=await CF('/api/admin/cloud/dl/'+r.id,{headers:{range:'bytes=5-9'}});assert.equal(a.status,206);assert.equal(a.headers.get('content-range'),'bytes 5-9/20');assert.equal(await a.text(),'56789');
 const b=await CF('/api/admin/cloud/dl/'+r.id,{headers:{range:'bytes=-4'}});assert.equal(b.status,206);assert.equal(await b.text(),'ghij')});
test('cloud: chunked (multipart) upload assembles the exact bytes; abort cleans up',async()=>{
 const data=Buffer.from(Array.from({length:2500},(_,i)=>i%251)),st=await jj(await CF('/api/admin/cloud/mp/start',{method:'POST',body:JSON.stringify({name:'big.iso',type:'',size:data.length})}));assert.equal(st.s,200);
 const parts=[];for(let n=1,o=0;o<data.length;n++,o+=1000){const c=data.subarray(o,o+1000);const r=await jj(await CF(`/api/admin/cloud/mp/part?id=${st.id}&uploadId=${encodeURIComponent(st.uploadId)}&n=${n}`,{method:'PUT',body:c,headers:{'content-length':String(c.length)}}));assert.equal(r.s,200);parts.push({partNumber:r.partNumber,etag:r.etag})}
 assert.equal((await CF('/api/admin/cloud/mp/complete',{method:'POST',body:JSON.stringify({id:st.id,uploadId:st.uploadId,parts})})).status,200);
 assert.deepEqual(Buffer.from(await (await CF('/api/admin/cloud/dl/'+st.id)).arrayBuffer()),data);
 assert.equal((await CF('/api/admin/cloud/mp/start',{method:'POST',body:JSON.stringify({name:'x',size:6*1024**3})})).status,413);
 assert.equal((await CF('/api/admin/cloud/mp/complete',{method:'POST',body:JSON.stringify({id:st.id,uploadId:'bad id!',parts})})).status,400);
 const s2=await jj(await CF('/api/admin/cloud/mp/start',{method:'POST',body:JSON.stringify({name:'ab.bin',size:10})}));assert.equal((await CF('/api/admin/cloud/mp/abort',{method:'POST',body:JSON.stringify({id:s2.id,uploadId:s2.uploadId})})).status,200);assert.equal((await CF('/api/admin/cloud/dl/'+s2.id)).status,404)});
test('cloud: share links — public download without login, expiry, revoke, junk tokens',async()=>{
 const sh=await jj(await CF(`/api/admin/cloud/${cid1}/share`,{method:'POST',body:JSON.stringify({hours:1})}));assert.equal(sh.s,200);const tok=sh.url.split('/c/')[1];assert.equal(tok.length,64);
 assert.notEqual(db.prepare('SELECT token_hash h FROM cloud_shares').get().h,tok,'only a hash is stored');
 const pub=await W.fetch(new Request(O+'/c/'+tok),envC);assert.equal(pub.status,200);assert.match(pub.headers.get('content-disposition'),/attachment/);assert.equal(await pub.text(),'%PDF-1.7 fake');assert.equal(pub.headers.get('x-robots-tag'),'noindex');
 assert.equal((await W.fetch(new Request(O+'/api/admin/cloud'),envC)).status,401,'a share link grants no other access');
 assert.equal((await W.fetch(new Request(O+'/c/'+'f'.repeat(64)),envC)).status,404);assert.equal((await W.fetch(new Request(O+'/c/short'),envC)).status,404);
 db.prepare('UPDATE cloud_shares SET expires=?').run(Date.now()-1000);assert.equal((await W.fetch(new Request(O+'/c/'+tok),envC)).status,404,'expired');
 const s2=await jj(await CF(`/api/admin/cloud/${cid1}/share`,{method:'POST',body:JSON.stringify({hours:9999})}));assert.equal(s2.hours,168,'max 7 days');const t2=s2.url.split('/c/')[1];
 assert.equal((await W.fetch(new Request(O+'/c/'+t2),envC)).status,200);await CF(`/api/admin/cloud/${cid1}/revoke`,{method:'POST'});assert.equal((await W.fetch(new Request(O+'/c/'+t2),envC)).status,404,'revoked');
 assert.equal((await CF(`/api/admin/cloud/${'0'.repeat(32)}/share`,{method:'POST',body:'{}'})).status,404)});
test('cloud: delete removes the file and its share links; page route loads',async()=>{
 const sh=await jj(await CF(`/api/admin/cloud/${cid1}/share`,{method:'POST',body:'{}'}));const tok=sh.url.split('/c/')[1];
 assert.equal((await CF('/api/admin/cloud/'+cid1,{method:'DELETE'})).status,200);assert.equal((await CF('/api/admin/cloud/dl/'+cid1)).status,404);assert.equal((await W.fetch(new Request(O+'/c/'+tok),envC)).status,404);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM cloud_shares WHERE file_id=?').get(cid1).n,0);assert.equal((await call('/cloud')).status,200);
 assert.equal((await up('cloud',PNG)).status,422,'"cloud" is a reserved name for images/links')});
