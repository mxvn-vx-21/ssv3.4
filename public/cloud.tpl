<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Cloud — $TENCYL</title><link rel="icon" href="/favicon.png">
<style>
*{box-sizing:border-box;margin:0}body{background:#080808;color:#fff;font:14px/1.5 system-ui,sans-serif;padding:20px;max-width:1000px;margin:0 auto}[hidden]{display:none!important}
h1{font-size:22px;margin-bottom:2px}.mono,button,label{font-family:ui-monospace,Menlo,monospace}.mut{color:#8d8d8d;font-size:13px}a{color:#9bb8ff}
.card{border:1px solid #222;background:#0c0c0c;padding:16px;margin:14px 0}
input[type=text],input[type=password],select{width:100%;background:#0e0e0e;border:1px solid #2a2a2a;color:#fff;padding:10px;font:inherit}
.b{background:#151515;color:#fff;border:1px solid #333;padding:8px 12px;cursor:pointer;font-size:12px}.b:hover{border-color:#777}.b.p{background:#fff;color:#080808}.b.d{color:#ff8a8a}
#drop{border:1px dashed #444;padding:26px 14px;text-align:center;color:#999;cursor:pointer}#drop.on{border-color:#fff;color:#fff}
.up{display:grid;gap:4px;padding:8px 0;border-bottom:1px solid #1c1c1c;font-size:13px}.bar{height:4px;background:#1c1c1c}.bar i{display:block;height:100%;width:0;background:#fff;transition:width .15s}.up.err .st{color:#ff8a8a}.up.ok .st{color:#7fe0a6}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.tools{display:grid;grid-template-columns:1fr 160px;gap:10px;margin-bottom:6px}
.f{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid #1c1c1c}.f .ic{font-size:22px;text-align:center}.f .nm{word-break:break-word;font-weight:600}.f .acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
@media(max-width:620px){.f{grid-template-columns:30px 1fr}.f .acts{grid-column:1/-1;justify-content:flex-start}.tools{grid-template-columns:1fr}}
#setup{white-space:pre-wrap;background:#050505;border:1px solid #222;padding:12px;font-size:12px}
</style></head><body>
<form id="login" class="card" hidden style="max-width:340px;margin:16vh auto;display:grid;gap:10px"><h1>Cloud</h1><p class="mut">Sign in with your dashboard password.</p><input id="pw" type="password" placeholder="Admin password" autocomplete="current-password" required><button class="b p">Sign in</button><div id="le" style="color:#ff8a8a"></div></form>
<main id="app" hidden>
<div class="row" style="justify-content:space-between"><div><h1>Cloud</h1><p class="mut" id="usage">Private file storage</p></div><div class="row"><a class="b" href="/dashboard" style="text-decoration:none;color:#fff">Dashboard</a><button class="b" id="out">Sign out</button></div></div>
<div class="card" id="setupBox" hidden><b>Cloud storage isn’t set up yet.</b><p class="mut" style="margin:6px 0 10px">Create an R2 bucket and bind it, then redeploy:</p><div id="setup">wrangler r2 bucket create stencyl-cloud

# add to wrangler.toml
[[r2_buckets]]
binding = "CLOUD"
bucket_name = "stencyl-cloud"

wrangler deploy</div></div>
<div id="main" hidden>
<div class="card"><div id="drop" tabindex="0" role="button">Tap or drop files here to upload<br><span class="mut">Any file type · up to 5 GB each · big files upload in chunks</span></div><input id="f" type="file" multiple hidden><div id="ups"></div></div>
<div class="card"><div class="tools"><input id="q" type="text" placeholder="Search files"><select id="so" aria-label="Sort"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="name">Name A–Z</option><option value="big">Largest first</option></select></div>
<div id="list"></div><p class="mut" id="empty" hidden style="padding:10px 0"></p></div>
</div></main>
<script>
const $=s=>document.querySelector(s);let csrf='',ITEMS=[],MAX=0;const T=window.__cloudTest||{};const PART=T.chunk||8*1048576;
const mk=(t,a={},k=[])=>{const e=document.createElement(t);for(const x in a){x==='text'?e.textContent=a[x]:e.setAttribute(x,a[x])}k.forEach(c=>e.append(c));return e};
const fmt=n=>n>=1073741824?(n/1073741824).toFixed(2)+' GB':n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?Math.round(n/1024)+' KB':n+' B';
const ICON={pdf:'📕',zip:'🗜️',rar:'🗜️','7z':'🗜️',gz:'🗜️',tar:'🗜️',mp3:'🎵',wav:'🎵',flac:'🎵',m4a:'🎵',mp4:'🎬',mov:'🎬',mkv:'🎬',avi:'🎬',webm:'🎬',png:'🖼️',jpg:'🖼️',jpeg:'🖼️',gif:'🖼️',webp:'🖼️',svg:'🖼️',heic:'🖼️',doc:'📝',docx:'📝',txt:'📝',md:'📝',xls:'📊',xlsx:'📊',csv:'📊',ppt:'📽️',pptx:'📽️',apk:'📱',exe:'⚙️',js:'📜',json:'📜',html:'📜',css:'📜'};
const icon=n=>ICON[(n.split('.').pop()||'').toLowerCase()]||'📄';
const hdr=(x={})=>({'x-csrf':csrf,...x});
async function api(p,m='GET',b){const r=await fetch('/api/admin/cloud'+p,{method:m,headers:hdr(b?{'content-type':'application/json'}:{}),body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(r.status===401){showLogin();throw new Error('Signed out')}if(!r.ok)throw new Error(j.error||'Request failed');return j}
const showLogin=()=>{$('#app').hidden=true;$('#login').hidden=false};
$('#login').onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:$('#pw').value})});const j=await r.json().catch(()=>({}));if(!r.ok){$('#le').textContent=j.error||'Sign-in failed';return}init()};
$('#out').onclick=async()=>{await fetch('/api/logout',{method:'POST',headers:hdr()});location.reload()};
async function init(){const r=await fetch('/api/admin/me');if(!r.ok){showLogin();return}csrf=(await r.json()).csrf;$('#login').hidden=true;$('#app').hidden=false;await load()}
async function load(){try{const j=await api('');if(!j.configured){$('#setupBox').hidden=false;$('#main').hidden=true;return}$('#setupBox').hidden=true;$('#main').hidden=false;ITEMS=j.items;MAX=j.max;$('#usage').textContent=`${j.items.length} file${j.items.length===1?'':'s'} · ${fmt(j.used)} used`;draw()}catch(e){$('#usage').textContent=e.message}}
function draw(){const q=$('#q').value.toLowerCase(),s=$('#so').value;let L=ITEMS.filter(i=>i.name.toLowerCase().includes(q));L.sort((a,b)=>s==='old'?a.created-b.created:s==='name'?a.name.localeCompare(b.name):s==='big'?b.size-a.size:b.created-a.created);
 $('#empty').hidden=!!L.length;$('#empty').textContent=ITEMS.length?'No files match.':'No files yet — upload your first one above.';
 $('#list').replaceChildren(...L.map(i=>{const dl=mk('a',{class:'b p',href:'/api/admin/cloud/dl/'+i.id,download:i.name,text:'Download',style:'text-decoration:none'}),sh=mk('button',{class:'b',type:'button',text:'Share link'}),rv=mk('button',{class:'b',type:'button',text:'Revoke links'}),del=mk('button',{class:'b d',type:'button',text:'Delete'});
  sh.onclick=async()=>{const h=prompt('Share link valid for how many hours? (1–168)','24');if(!h)return;try{const j=await api('/'+i.id+'/share','POST',{hours:+h});try{await navigator.clipboard.writeText(j.url)}catch{}prompt(`Link (valid ${j.hours} h, copied if allowed). Anyone with it can download this file:`,j.url)}catch(e){alert(e.message)}};
  rv.onclick=async()=>{if(!confirm('Disable all share links for this file?'))return;try{await api('/'+i.id+'/revoke','POST');alert('Share links revoked.')}catch(e){alert(e.message)}};
  del.onclick=async()=>{if(!confirm(`Permanently delete “${i.name}”? This can’t be undone.`))return;try{await api('/'+i.id,'DELETE');await load()}catch(e){alert(e.message)}};
  return mk('div',{class:'f'},[mk('div',{class:'ic',text:icon(i.name)}),mk('div',{},[mk('div',{class:'nm',text:i.name}),mk('div',{class:'mut',text:fmt(i.size)+' · '+new Date(i.created).toLocaleString()})]),mk('div',{class:'acts'},[dl,sh,rv,del])])}))}
$('#q').oninput=draw;$('#so').onchange=draw;
// ---- uploads: ≤1 chunk in a single request, larger files in 8 MB parts with retries
const xhr=(method,url,headers,body,onp)=>new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open(method,url);for(const k in headers)x.setRequestHeader(k,headers[k]);x.upload.onprogress=e=>e.lengthComputable&&onp&&onp(e.loaded);x.onload=()=>{let j={};try{j=JSON.parse(x.responseText)}catch{}x.status>=200&&x.status<300?res(j):rej(new Error(j.error||'Upload failed ('+x.status+')'))};x.onerror=()=>rej(new Error('Network error'));x.onabort=()=>rej(new Error('Cancelled'));x.send(body);cur=x});
let cur=null,queue=[],busy=false;
function addFiles(fs){for(const f of fs){const bar=mk('i'),st=mk('span',{class:'st',text:'Waiting…'}),cx=mk('button',{class:'b',type:'button',text:'Cancel'}),row=mk('div',{class:'up'},[mk('div',{class:'row',style:'justify-content:space-between'},[mk('span',{text:f.name+' · '+fmt(f.size)}),cx]),mk('div',{class:'bar'},[bar]),st]);const job={f,bar,st,row,cancelled:false,mp:null};cx.onclick=()=>{job.cancelled=true;if(cur)try{cur.abort()}catch{}row.remove()};$('#ups').prepend(row);
  if(f.size>MAX&&MAX){st.textContent='Too large (max '+fmt(MAX)+')';row.classList.add('err');continue}queue.push(job)}run()}
async function run(){if(busy)return;busy=true;while(queue.length){const j=queue.shift();if(j.cancelled)continue;try{await send(j);j.st.textContent='Uploaded ✓';j.row.classList.add('ok');j.bar.style.width='100%'}catch(e){j.row.classList.add('err');j.st.textContent=j.cancelled?'Cancelled':e.message;if(j.mp)api('/mp/abort','POST',j.mp).catch(()=>{})}}busy=false;await load()}
async function send(j){const f=j.f,set=p=>{j.bar.style.width=p+'%';j.st.textContent=p+'%'};
 if(f.size<=PART){j.st.textContent='Uploading…';await xhr('PUT','/api/admin/cloud/upload',hdr({'x-filename':encodeURIComponent(f.name),'x-type':f.type||'application/octet-stream'}),f,l=>set(Math.round(l/Math.max(1,f.size)*100)));return}
 const s=await api('/mp/start','POST',{name:f.name,type:f.type||'application/octet-stream',size:f.size});j.mp={id:s.id,uploadId:s.uploadId};const parts=[];let done=0;
 for(let n=1,o=0;o<f.size;n++,o+=PART){const blob=f.slice(o,o+PART);let ok=false,err;for(let a=0;a<4&&!ok;a++){if(j.cancelled)throw new Error('Cancelled');try{const p=await xhr('PUT',`/api/admin/cloud/mp/part?id=${s.id}&uploadId=${encodeURIComponent(s.uploadId)}&n=${n}`,hdr(),blob,l=>set(Math.min(99,Math.round((done+l)/f.size*100))));parts.push(p);ok=true}catch(e){err=e;if(e.message==='Cancelled')throw e;j.st.textContent='Retrying part '+n+'…';await new Promise(r=>setTimeout(r,1000*(a+1)))}}if(!ok)throw err;done+=blob.size}
 await api('/mp/complete','POST',{id:s.id,uploadId:s.uploadId,parts});j.mp=null}
$('#drop').onclick=()=>$('#f').click();$('#drop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#f').click()}};$('#f').onchange=e=>{addFiles([...e.target.files]);e.target.value=''};
['dragenter','dragover'].forEach(t=>$('#drop').addEventListener(t,e=>{e.preventDefault();$('#drop').classList.add('on')}));['dragleave','drop'].forEach(t=>$('#drop').addEventListener(t,e=>{e.preventDefault();$('#drop').classList.remove('on')}));$('#drop').addEventListener('drop',e=>addFiles([...e.dataTransfer.files]));
addEventListener('beforeunload',e=>{if(busy||queue.length){e.preventDefault();e.returnValue=''}});init();
</script></body></html>
