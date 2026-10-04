// Cross-cutting frontend helpers used by multiple feature modules.

const {serverPath}=LibreDisplayRuntime.getModule('bootstrap');

const CONNECTIVITY_DEFAULT_TIMEOUT_MS=8000;
const CONNECTIVITY_TRANSIENT_STATUS=new Set([408,425,429,500,502,503,504]);
const connectivityStats={requests:0,successes:0,failures:0,timeouts:0,retries:0,inFlight:0,lastLatencyMs:0,totalLatencyMs:0,lastSuccessAt:0,lastFailureAt:0};

function uiCfg(){return window.__uiPreviewCfg||LibreDisplayRuntime.getModule('config').cfg;}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeHttpUrl(v){try{const u=new URL(String(v||''),location.href);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
function normalizeHexColor(value,fallback='#ffffff'){let s=String(value||'').trim();if(s&&!s.startsWith('#'))s='#'+s;if(/^#[0-9a-f]{3}$/i.test(s))s='#'+s.slice(1).split('').map(x=>x+x).join('');return /^#[0-9a-f]{6}$/i.test(s)?s.toLowerCase():String(fallback||'#ffffff').toLowerCase();}
function scaledClamp(minPx,vw,maxPx,pct){
  const s=((Number(pct)||100)/100);
  return `clamp(${(minPx*s).toFixed(2)}px,${(vw*s).toFixed(3)}vw,${(maxPx*s).toFixed(2)}px)`;
}
function connectivityRetryAfterMs(res){
  const raw=String(res?.headers?.get?.('Retry-After')||'').trim();
  const seconds=Number(raw);
  return Number.isFinite(seconds)&&seconds>=0?Math.min(5000,seconds*1000):0;
}
function connectivityDelayMs(attempt,res){
  const hinted=connectivityRetryAfterMs(res);if(hinted)return hinted;
  const base=Math.min(2000,300*Math.pow(2,Math.max(0,attempt-1)));
  return base+Math.floor(Math.random()*Math.max(1,Math.round(base*.25)));
}
function connectivitySleep(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));}
function connectivitySnapshot(){
  const finished=connectivityStats.successes+connectivityStats.failures;
  const localServerOnline=!connectivityStats.lastFailureAt||connectivityStats.lastSuccessAt>=connectivityStats.lastFailureAt;
  return {
    requests:connectivityStats.requests,successes:connectivityStats.successes,failures:connectivityStats.failures,
    timeouts:connectivityStats.timeouts,retries:connectivityStats.retries,inFlight:connectivityStats.inFlight,
    lastLatencyMs:connectivityStats.lastLatencyMs,averageLatencyMs:finished?Math.round(connectivityStats.totalLatencyMs/finished):0,
    lastSuccessAt:connectivityStats.lastSuccessAt,lastFailureAt:connectivityStats.lastFailureAt,online:localServerOnline,
    browserOnlineHint:navigator.onLine!==false
  };
}
async function resilientFetch(input,init={},policy={}){
  const method=String(init?.method||'GET').toUpperCase(),retryable=['GET','HEAD'].includes(method)&&policy.retry!==false;
  const attempts=retryable?Math.max(1,Math.min(4,Number(policy.attempts)||2)):1;
  const timeoutMs=Math.max(1000,Math.min(60000,Number(policy.timeoutMs)||CONNECTIVITY_DEFAULT_TIMEOUT_MS));
  const started=Date.now(),deadline=started+timeoutMs;connectivityStats.requests++;connectivityStats.inFlight++;
  let lastError=null;
  try{
    for(let attempt=1;attempt<=attempts;attempt++){
      const remainingMs=Math.max(0,deadline-Date.now());
      if(remainingMs<=0)throw new DOMException('LibreDisplay request timed out','TimeoutError');
      const controller=new AbortController(),external=init?.signal;
      let externalAbort=null,timedOut=false;
      if(external){externalAbort=()=>controller.abort(external.reason);if(external.aborted)externalAbort();else external.addEventListener?.('abort',externalAbort,{once:true});}
      const timer=setTimeout(()=>{timedOut=true;controller.abort(new DOMException('LibreDisplay request timed out','TimeoutError'));},remainingMs);
      try{
        const res=await fetch(input,{...init,signal:controller.signal});
        if(retryable&&policy.retryStatuses===true&&CONNECTIVITY_TRANSIENT_STATUS.has(Number(res.status))&&attempt<attempts){
          connectivityStats.retries++;try{await res.body?.cancel?.();}catch(e){}
          const delay=Math.min(connectivityDelayMs(attempt,res),Math.max(0,deadline-Date.now()));if(delay<=0)throw new DOMException('LibreDisplay request timed out','TimeoutError');
          await connectivitySleep(delay);continue;
        }
        const latency=Math.max(0,Date.now()-started);connectivityStats.successes++;connectivityStats.lastLatencyMs=latency;connectivityStats.totalLatencyMs+=latency;connectivityStats.lastSuccessAt=Date.now();
        return res;
      }catch(error){
        lastError=error;
        if(timedOut)connectivityStats.timeouts++;
        if(attempt>=attempts||external?.aborted||Date.now()>=deadline)throw error;
        connectivityStats.retries++;
        const delay=Math.min(connectivityDelayMs(attempt),Math.max(0,deadline-Date.now()));if(delay<=0)throw new DOMException('LibreDisplay request timed out','TimeoutError');
        await connectivitySleep(delay);
      }finally{
        clearTimeout(timer);if(externalAbort)external.removeEventListener?.('abort',externalAbort);
      }
    }
    throw lastError||new Error('Request failed');
  }catch(error){
    const latency=Math.max(0,Date.now()-started);connectivityStats.failures++;connectivityStats.lastLatencyMs=latency;connectivityStats.totalLatencyMs+=latency;connectivityStats.lastFailureAt=Date.now();
    if(error?.name==='AbortError'||error?.name==='TimeoutError'||Date.now()>=deadline)throw new Error(`Request timed out after ${Math.round(timeoutMs/1000)}s`);
    throw error;
  }finally{connectivityStats.inFlight=Math.max(0,connectivityStats.inFlight-1);}
}

async function fetchRemoteText(url,ttlSec=300){
  if(location.protocol==='file:')throw new Error('Open LibreDisplay through its local server, not as a file:// URL.');
  const direct=String(url||'').startsWith('/calendar-files/');
  const target=direct?serverPath(url):serverPath('/api/broker?ttl='+encodeURIComponent(Math.max(5,Number(ttlSec)||300))+'&url='+encodeURIComponent(url));
  const res=await resilientFetch(target,{cache:'no-store'},{timeoutMs:18000,attempts:2});
  LibreDisplayRuntime.getModule('remote').noteCacheResponse(url,res);
  if(!res.ok){const msg=await res.text().catch(()=>res.statusText);throw new Error('Data broker HTTP '+res.status+(msg?' — '+msg:''));}
  return await res.text();
}

LibreDisplayRuntime.exposeModule("shared", {uiCfg,escHtml,esc,safeHttpUrl,normalizeHexColor,scaledClamp,connectivitySnapshot,resilientFetch,fetchRemoteText}, {}, {globals:false});
