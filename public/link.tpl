<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Short links — $TENCYL</title><link rel="icon" href="/favicon.png">
<style>
*{box-sizing:border-box;margin:0}body{background:#080808;color:#fff;font:14px/1.5 system-ui,sans-serif;padding:24px;max-width:1000px;margin:0 auto}[hidden]{display:none!important}
h1{font-size:22px;margin-bottom:4px}.mono,button,label{font-family:ui-monospace,Menlo,monospace}.mut{color:#8d8d8d;font-size:13px}
.card{border:1px solid #222;background:#0c0c0c;padding:16px;margin:16px 0}
input{width:100%;background:#0e0e0e;border:1px solid #2a2a2a;color:#fff;padding:9px;font:inherit}label{display:grid;gap:4px;font-size:11px;color:#999;text-transform:uppercase}
.b{background:#151515;color:#fff;border:1px solid #333;padding:7px 11px;cursor:pointer;font-size:12px}.b:hover{border-color:#777}.b.p{background:#fff;color:#080808}.b.d{color:#ff8a8a}.b:disabled{opacity:.4;cursor:not-allowed}
.g{display:grid;grid-template-columns:1fr 2fr;gap:12px}@media(max-width:700px){.g{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #222;padding:9px 8px;text-align:left;vertical-align:top;font-size:13px}th{color:#8d8d8d;font-weight:500;font-size:11px;text-transform:uppercase}
.dest{word-break:break-all;color:#9bb8ff;max-width:380px}.sh{color:#fff;font-weight:600;word-break:break-all}.acts{display:flex;gap:6px;flex-wrap:wrap}
#msg{margin-top:10px;font-size:13px;min-height:20px}#msg.bad{color:#ff8a8a}#msg.ok{color:#7fe0a6}
</style></head><body>
<form id="login" class="card" hidden style="max-width:340px;margin:18vh auto;display:grid;gap:10px"><h1>Short links</h1><p class="mut">Sign in with your dashboard password.</p><input id="pw" type="password" placeholder="Admin password" autocomplete="current-password" required><button class="b p">Sign in</button><div id="le" style="color:#ff8a8a"></div></form>
<main id="app" hidden>
<h1>Short links</h1><p class="mut">Create <span class="mono" id="ex"></span> that redirects to any web address.</p><p class="mut"><a href="/dashboard" style="color:#9bb8ff">← Dashboard</a> · <a href="/imghost" style="color:#9bb8ff">Image host</a></p>
<form id="nf" class="card"><div class="g"><label>Short name → <span id="pu" class="mono" style="text-transform:none"></span><input id="nm" placeholder="wa" maxlength="60" autocomplete="off" required></label><label>Destination URL<input id="ur" type="url" placeholder="https://wa.me/message/…" maxlength="2000" autocomplete="off" required></label></div>
<div style="margin-top:12px"><button class="b p" id="cr">Create short link</button></div><div id="msg" role="status"></div></form>
<div class="card"><label>Search<input id="q" placeholder="Filter by name or destination"></label>
<table style="margin-top:12px"><thead><tr><th>Short link</th><th>Destination</th><th>Clicks</th><th></th></tr></thead><tbody id="rows"></tbody></table><p class="mut" id="empty" hidden style="margin-top:10px"></p></div>
</main>
<script>
const $=s=>document.querySelector(s);let csrf='',ITEMS=[];
const mk=(t,a={},k=[])=>{const e=document.createElement(t);for(const x in a){x==='text'?e.textContent=a[x]:e.setAttribute(x,a[x])}k.forEach(c=>e.append(c));return e};
const msg=(t,c)=>{$('#msg').textContent=t;$('#msg').className=c||''};
async function api(p,m='GET',b){const r=await fetch('/api/admin/'+p,{method:m,headers:{'x-csrf':csrf,'content-type':'application/json'},body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(r.status===401){showLogin();throw new Error('Signed out')}if(!r.ok)throw new Error(j.error||'Request failed');return j}
const showLogin=()=>{$('#app').hidden=true;$('#login').hidden=false};
$('#login').onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:$('#pw').value})});const j=await r.json().catch(()=>({}));if(!r.ok){$('#le').textContent=j.error||'Sign-in failed';return}init()};
async function init(){const r=await fetch('/api/admin/me');if(!r.ok){showLogin();return}csrf=(await r.json()).csrf;$('#login').hidden=true;$('#app').hidden=false;$('#ex').textContent=location.origin+'/wa';upd();await load()}
async function load(){try{ITEMS=(await api('links')).items;draw()}catch(e){msg(e.message,'bad')}}
function draw(){const q=$('#q').value.toLowerCase(),L=ITEMS.filter(i=>(i.name+' '+i.url).toLowerCase().includes(q));$('#empty').hidden=!!L.length;$('#empty').textContent=ITEMS.length?'No links match.':'No short links yet — create your first one above.';
 $('#rows').replaceChildren(...L.map(i=>{const short=location.origin+'/'+i.name,cp=mk('button',{class:'b',type:'button',text:'Copy'}),ed=mk('button',{class:'b',type:'button',text:'Edit'}),dl=mk('button',{class:'b d',type:'button',text:'Delete'});
  cp.onclick=async()=>{await navigator.clipboard.writeText(short);cp.textContent='Copied ✓';setTimeout(()=>cp.textContent='Copy',1400)};
  ed.onclick=async()=>{const u=prompt('New destination for /'+i.name,i.url);if(!u||u===i.url)return;try{await api('links/'+i.name,'PATCH',{url:u});await load()}catch(e){alert(e.message)}};
  dl.onclick=async()=>{if(!confirm(`Delete /${i.name}? Anyone using this link will get a 404.`))return;try{await api('links/'+i.name,'DELETE');await load()}catch(e){alert(e.message)}};
  return mk('tr',{},[mk('td',{},[mk('a',{class:'sh',href:short,target:'_blank',rel:'noopener',text:short})]),mk('td',{class:'dest'},[document.createTextNode(i.url)]),mk('td',{text:String(i.clicks)}),mk('td',{},[mk('div',{class:'acts'},[cp,ed,dl])])])}))}
const upd=()=>{$('#pu').textContent=location.origin+'/'+($('#nm').value||'{name}')};
$('#nm').oninput=()=>{$('#nm').value=$('#nm').value.toLowerCase().replace(/[^a-z0-9_-]/g,'-');upd()};$('#q').oninput=draw;
$('#nf').onsubmit=async e=>{e.preventDefault();$('#cr').disabled=true;msg('Creating…');try{const j=await api('links','POST',{name:$('#nm').value,url:$('#ur').value});msg('Created: '+j.short,'ok');$('#nm').value='';$('#ur').value='';upd();await load()}catch(err){msg(err.message,'bad')}$('#cr').disabled=false};
init();
</script></body></html>
