// Cross-cutting frontend helpers used by multiple feature modules.

const {serverPath}=LibreDisplayRuntime.getModule('bootstrap');

function uiCfg(){return window.__uiPreviewCfg||LibreDisplayRuntime.getModule('config').cfg;}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeHttpUrl(v){try{const u=new URL(String(v||''),location.href);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
function normalizeHexColor(value,fallback='#ffffff'){let s=String(value||'').trim();if(s&&!s.startsWith('#'))s='#'+s;if(/^#[0-9a-f]{3}$/i.test(s))s='#'+s.slice(1).split('').map(x=>x+x).join('');return /^#[0-9a-f]{6}$/i.test(s)?s.toLowerCase():String(fallback||'#ffffff').toLowerCase();}
function scaledClamp(minPx,vw,maxPx,pct){
  const s=((Number(pct)||100)/100);
  return `clamp(${(minPx*s).toFixed(2)}px,${(vw*s).toFixed(3)}vw,${(maxPx*s).toFixed(2)}px)`;
}

async function fetchRemoteText(url,ttlSec=300){
  if(location.protocol==='file:')throw new Error('Open LibreDisplay through its local server, not as a file:// URL.');
  const direct=String(url||'').startsWith('/calendar-files/');
  const target=direct?serverPath(url):serverPath('/api/broker?ttl='+encodeURIComponent(Math.max(5,Number(ttlSec)||300))+'&url='+encodeURIComponent(url));
  const res=await fetch(target,{cache:'no-store'});
  LibreDisplayRuntime.getModule('remote').noteCacheResponse(url,res);
  if(!res.ok){const msg=await res.text().catch(()=>res.statusText);throw new Error('Data broker HTTP '+res.status+(msg?' — '+msg:''));}
  return await res.text();
}

LibreDisplayRuntime.exposeModule("shared", {uiCfg,escHtml,esc,safeHttpUrl,normalizeHexColor,scaledClamp,fetchRemoteText}, {}, {globals:false});
