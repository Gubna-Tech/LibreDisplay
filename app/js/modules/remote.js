// LibreDisplay source section: /js/remote/index.js
{
const configApi=LibreDisplayRuntime.getModule('config');
const {ensureCfgDefaults}=configApi;
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;
const {healthAgeText}=LibreDisplayRuntime.getModule('integrations');
const {ensureAlertMotionRunning}=LibreDisplayRuntime.getModule('weather');
const {escHtml,esc,resilientFetch,connectivitySnapshot}=LibreDisplayRuntime.getModule('shared');

let displayEndpoints=[];
let displayDevices=[];
let endpointsRemoteEnabled=false;
function endpointDeviceSummary(endpointId){const rows=displayDevices.filter(x=>x.endpoint===endpointId).sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0)),online=rows.filter(x=>x.online),best=online[0]||rows[0];if(!best)return {online:false,text:'No viewer heartbeat yet'};const res=best.width&&best.height?`${best.width}×${best.height} ${best.width>=best.height?'landscape':'portrait'}`:'resolution unknown',mode=best.mode||'browser',version=best.version?` · v${best.version}`:'',age=Number(best.ageSeconds)||0,last=best.online?'':` · last seen ${age<120?Math.max(1,Math.round(age))+'s':age<7200?Math.round(age/60)+'m':Math.round(age/3600)+'h'} ago`;return {online:!!best.online,text:`${best.online?'Online':'Offline'} · ${res} · ${mode}${version}${last}`};}
function currentDisplayReadinessDevice(){
  const rows=(displayDevices||[]).filter(x=>x?.endpoint===bootstrapApi.ACTIVE_ENDPOINT&&['local','viewer'].includes(String(x.mode||''))).sort((a,b)=>{const ao=a.online?1:0,bo=b.online?1:0;if(ao!==bo)return bo-ao;return Number(b.lastSeen||0)-Number(a.lastSeen||0);});
  return rows[0]||null;
}
function displayReadinessAssessment(row){
  const localFallback=(bootstrapApi.LOCAL_CLIENT_MODE||bootstrapApi.READ_ONLY_DISPLAY_MODE)?{width:Math.round(innerWidth),height:Math.round(innerHeight),viewportWidth:Math.round(innerWidth),viewportHeight:Math.round(innerHeight),visualViewportWidth:Math.round(window.visualViewport?.width||innerWidth),visualViewportHeight:Math.round(window.visualViewport?.height||innerHeight),visualViewportScale:Number(window.visualViewport?.scale)||1,dpr:Number(devicePixelRatio)||1,mode:bootstrapApi.LOCAL_CLIENT_MODE?'local':'viewer',online:true,lastSeen:Date.now()/1000}:null;
  const d=row||localFallback;if(!d)return {device:null,notes:[{state:'warn',text:'No current local/viewer heartbeat is available yet. Open the target display and recheck.'}]};
  const width=Math.round(Number(d.layoutWidth||d.viewportWidth||d.width)||0),height=Math.round(Number(d.layoutHeight||d.viewportHeight||d.height)||0),scale=Number(d.visualViewportScale)||1,dpr=Number(d.dpr)||1;
  const notes=[];
  if(width<480||height<270)notes.push({state:'warn',text:'The reported viewport is too small to be treated as a normal wall display. Check browser zoom, OS display scaling, or kiosk launch settings.'});
  else if(width<960||height<540)notes.push({state:'warn',text:`${width}×${height} is a compact viewport. Use fewer forecast columns or a compact/portrait presentation if text feels crowded.`});
  else notes.push({state:'good',text:`${width}×${height} provides a normal dashboard viewport.`});
  if(Math.abs(scale-1)>.03)notes.push({state:'warn',text:`Browser visual scale is ${Math.round(scale*100)}%. Return browser/page zoom to 100% before judging layout or text size.`});
  else notes.push({state:'good',text:'Browser visual scale is 100%.'});
  if(width&&height&&height>width)notes.push({state:'good',text:'Portrait orientation detected. The Portrait starter presentation can be useful, but your saved custom layout is never changed automatically.'});
  else if(width&&height)notes.push({state:'good',text:'Landscape orientation detected.'});
  if(dpr>2.5)notes.push({state:'good',text:`High-density display detected (device pixel ratio ${dpr.toFixed(2)}). LibreDisplay uses CSS pixels, so Arrange coordinates remain resolution-independent.`});
  return {device:d,width,height,scale,dpr,notes};
}
function renderDisplayReadiness(){
  const result=displayReadinessAssessment(currentDisplayReadinessDevice()),d=result.device;
  const set=(id,text,state='')=>setHealth(id,text,state);
  if(!d){for(const id of ['display-readiness-viewport','display-readiness-orientation','display-readiness-scale','display-readiness-heartbeat'])set(id,'Waiting…','warn');}
  else{
    set('display-readiness-viewport',result.width&&result.height?`${result.width}×${result.height}`:'Unknown',result.width>=960&&result.height>=540?'good':'warn');
    set('display-readiness-orientation',result.width&&result.height?(result.width>=result.height?'Landscape':'Portrait'):'Unknown',result.width&&result.height?'good':'warn');
    set('display-readiness-scale',`${Math.round(result.scale*100)}% · DPR ${result.dpr.toFixed(2)}`,Math.abs(result.scale-1)>.03?'warn':'good');
    const kiosk=LibreDisplayRuntime.getModule('system').systemHealthState?.kioskHeartbeat,age=Number(kiosk?.ageSeconds);
    set('display-readiness-heartbeat',kiosk?.present?(Number.isFinite(age)?`${healthAgeText(age)} · ${kiosk.viewport||'local display'}`:'Reported'):(d.mode==='viewer'?'Remote viewer heartbeat':'Waiting for local kiosk heartbeat'),kiosk?.present&&age<90?'good':d.mode==='viewer'?'good':'warn');
  }
  const host=document.getElementById('display-readiness-notes');if(host)host.innerHTML=result.notes.map(n=>`<div class="display-readiness-item ${n.state}">${escHtml(n.text)}</div>`).join('');
}
async function refreshDisplayReadiness(){
  try{await resilientFetch(serverPath('/api/devices'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'heartbeat',endpoint:bootstrapApi.ACTIVE_ENDPOINT}),cache:'no-store'});}catch(e){}
  await Promise.allSettled([loadDisplayEndpoints(),loadSystemHealth()]);renderDisplayReadiness();
}

async function loadDisplayEndpoints(){
  const list=document.getElementById('endpoint-list'),status=document.getElementById('endpoint-status');if(!list)return;
  try{
    const [endpointRes,deviceRes]=await Promise.all([resilientFetch(serverPath('/api/endpoints'),{cache:'no-store'}),resilientFetch(serverPath('/api/devices'),{cache:'no-store'})]);
    const data=await endpointRes.json().catch(()=>({})),devices=await deviceRes.json().catch(()=>({}));if(!endpointRes.ok||!data.ok)throw new Error(data.error||('HTTP '+endpointRes.status));
    displayEndpoints=Array.isArray(data.endpoints)?data.endpoints:[];displayDevices=deviceRes.ok&&Array.isArray(devices.devices)?devices.devices:[];endpointsRemoteEnabled=!!data.remoteEnabled;
    LibreDisplayRuntime.getModule('system').renderProfileEndpointSelect?.();
    list.innerHTML=displayEndpoints.map(e=>{const live=endpointDeviceSummary(e.id);return `<div class="endpoint-row ${e.id===bootstrapApi.ACTIVE_ENDPOINT?'endpoint-current':''}"><div><div class="endpoint-name">${esc(e.name||e.id)}${e.id===bootstrapApi.ACTIVE_ENDPOINT?' · current':''}</div><div class="endpoint-meta">/${esc(e.id)} · ${e.configured?'configured':'new display'}</div><div class="endpoint-live ${live.online?'online':''}"><span class="endpoint-live-dot"></span>${esc(live.text)}</div></div><div class="endpoint-actions"><button class="btn-util" type="button" data-ld-action-click="remote.editDisplayEndpoint" data-ld-action-args="${escHtml(JSON.stringify([e.id]))}">Edit</button><button class="btn-util" type="button" data-ld-action-click="remote.sendDisplayCommand" data-ld-action-args="${escHtml(JSON.stringify([e.id,'refresh']))}">Refresh data</button><button class="btn-util" type="button" data-ld-action-click="remote.sendDisplayCommand" data-ld-action-args="${escHtml(JSON.stringify([e.id,'reload']))}">Reload screen</button><button class="btn-util" type="button" data-ld-action-click="remote.copyDisplayEndpointLink" data-ld-action-args="${escHtml(JSON.stringify([e.id]))}">Copy link</button><button class="btn-util" type="button" data-ld-action-click="remote.renameDisplayEndpoint" data-ld-action-args="${escHtml(JSON.stringify([e.id]))}">Rename</button><button class="btn-util" type="button" data-ld-action-click="remote.rotateDisplayEndpoint" data-ld-action-args="${escHtml(JSON.stringify([e.id]))}">Rotate link</button>${e.id!=='main'?`<button class="btn-util" type="button" data-ld-action-click="remote.deleteDisplayEndpoint" data-ld-action-args="${escHtml(JSON.stringify([e.id]))}">Delete</button>`:''}</div></div>`}).join('')||'<div class="settings-note">No displays found.</div>';
    if(status)status.textContent=`Editing “${displayEndpoints.find(e=>e.id===bootstrapApi.ACTIVE_ENDPOINT)?.name||bootstrapApi.ACTIVE_ENDPOINT}”. ${displayDevices.filter(x=>x.online).length} viewer${displayDevices.filter(x=>x.online).length===1?'':'s'} online.`+(endpointsRemoteEnabled?'':' Enable Remote management before using Display Links on other devices.');
    LibreDisplayRuntime.getModule('onboarding').syncWizardDisplayNameFromEndpoints?.();renderDisplayReadiness();
  }catch(e){if(status)status.textContent='Display manager unavailable: '+(e.message||e);list.innerHTML='';renderDisplayReadiness();}
}
async function endpointAction(body){const res=await resilientFetch(serverPath('/api/endpoints'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));return data;}
async function sendDisplayCommand(endpoint,action){try{const res=await resilientFetch(serverPath('/api/devices'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint,action}),cache:'no-store'});const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));if(action==='reload')setTimeout(loadDisplayEndpoints,1200);}catch(e){alert('Could not send display command: '+(e.message||e));}}
async function createDisplayEndpoint(){
  const name=prompt('Name this display (for example: Kitchen, Office, Bedroom):','');if(!name?.trim())return;
  const copy=confirm('Copy the current display configuration into the new display?');
  try{const data=await endpointAction({action:'create',name:name.trim(),copyFrom:copy?bootstrapApi.ACTIVE_ENDPOINT:''});const mode=bootstrapApi.LOCAL_CLIENT_MODE?'openSettings=1':'settings=1';location.href='/dashboard.html?'+mode+'&endpoint='+encodeURIComponent(data.endpoint);}catch(e){alert('Could not add display: '+(e.message||e));}
}
function editDisplayEndpoint(id){const mode=bootstrapApi.LOCAL_CLIENT_MODE?'openSettings=1':'settings=1';location.href='/dashboard.html?'+mode+'&endpoint='+encodeURIComponent(id);}
async function copyDisplayEndpointLink(id){const row=displayEndpoints.find(e=>e.id===id);if(!endpointsRemoteEnabled){alert('Enable Remote management first so other devices can use Display Links.');return;}if(!row?.displayUrl){alert('Display Link is unavailable.');return;}try{await navigator.clipboard.writeText(row.displayUrl);alert('Read-only Display Link copied.');}catch(e){prompt('Copy this Display Link:',row.displayUrl);}}
async function renameDisplayEndpoint(id){const row=displayEndpoints.find(e=>e.id===id);const name=prompt('Display name:',row?.name||id);if(!name?.trim())return;try{await endpointAction({action:'rename',id,name:name.trim()});await loadDisplayEndpoints();}catch(e){alert('Could not rename display: '+(e.message||e));}}
async function rotateDisplayEndpoint(id){const row=displayEndpoints.find(e=>e.id===id);if(!confirm(`Rotate the read-only link for “${row?.name||id}”? Any screen using the old link will need to be paired again.`))return;try{await endpointAction({action:'rotate',id});await loadDisplayEndpoints();alert('Display Link rotated. Copy the new link to that screen.');}catch(e){alert('Could not rotate display link: '+(e.message||e));}}
async function deleteDisplayEndpoint(id){const row=displayEndpoints.find(e=>e.id===id);if(!confirm(`Delete “${row?.name||id}” and its saved display configuration?`))return;try{await endpointAction({action:'delete',id});await loadDisplayEndpoints();}catch(e){alert('Could not delete display: '+(e.message||e));}}

function cacheSourceName(url){
  const raw=String(url||'');
  if(raw.startsWith('calendar:'))return 'calendar';
  if(raw.startsWith('block:'))return 'data block';
  if(raw.startsWith('integration:'))return 'integration';
  try{return new URL(raw).hostname.replace(/^www\./,'')||'remote data';}catch(e){return 'remote data';}
}
let serverConnectionState='online',serverReconnectRefreshPending=false,serverReconnectNoticeTimer=null;
let serverRecoveryTimer=null,serverRecoveryRunning=false,serverRecoveryAttempt=0;
const SERVER_RECONNECT_NOTICE_DELAY_MS=8000;
const SERVER_RECOVERY_DELAYS_MS=[1000,3000,8000,15000,30000,60000];
function updateOfflinePill(){
  const pill=document.getElementById('offline-pill');if(!pill)return;
  const stale=configApi.staleCacheSources.size>0,serverDown=serverConnectionState!=='online';
  const active=stale||serverDown;let state='online',text='';
  if(serverDown){state='reconnecting';text=stale?'Connection interrupted · showing last known data':'Connection interrupted · retrying automatically';}
  else if(stale){state='cached';text='Provider delayed · showing last known data';}
  pill.dataset.state=state;pill.classList.toggle('show',active);if(pill.textContent!==text)pill.textContent=text;
  updateSettingsOverview?.();
}
function clearServerRecoveryTimer(){if(serverRecoveryTimer){clearTimeout(serverRecoveryTimer);serverRecoveryTimer=null;}}
function setServerConnectionState(state){
  const previous=serverConnectionState;serverConnectionState=state==='online'?'online':state==='offline'?'offline':'reconnecting';updateOfflinePill();
  if(serverConnectionState==='online'&&previous!=='online'&&!serverReconnectRefreshPending&&(bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LOCAL_CLIENT_MODE)){
    serverReconnectRefreshPending=true;setTimeout(async()=>{try{await sendDisplayHeartbeat(true);await pollServerConfig();await Promise.allSettled([LibreDisplayRuntime.getModule('settings').refreshDataNow(),LibreDisplayRuntime.getModule('lifecycle').retryDisplayHydration('server-reconnected')]);scheduleDisplayHeartbeat(0);}finally{serverReconnectRefreshPending=false;}},250);
  }
}
function clearServerReconnectNotice(){if(serverReconnectNoticeTimer){clearTimeout(serverReconnectNoticeTimer);serverReconnectNoticeTimer=null;}}
function markServerTransportOpen(){clearServerReconnectNotice();clearServerRecoveryTimer();serverRecoveryAttempt=0;setServerConnectionState('online');}
function scheduleServerRecovery(reason='transport',delayMs=null){
  if(serverRecoveryTimer)return;
  setServerConnectionState('reconnecting');
  const wait=delayMs==null?SERVER_RECOVERY_DELAYS_MS[Math.min(serverRecoveryAttempt,SERVER_RECOVERY_DELAYS_MS.length-1)]:Math.max(0,Number(delayMs)||0);
  serverRecoveryTimer=setTimeout(()=>{serverRecoveryTimer=null;recoverServerConnection(reason);},wait);
}
async function recoverServerConnection(reason='scheduled'){
  if(serverRecoveryRunning)return false;
  serverRecoveryRunning=true;clearServerReconnectNotice();setServerConnectionState('reconnecting');
  try{
    const res=await resilientFetch(serverPath('/api/session-info'),{cache:'no-store'},{timeoutMs:3500,attempts:1,retry:false});
    if(!res.ok)throw new Error('LibreDisplay server HTTP '+res.status);
    markServerTransportOpen();
    return true;
  }catch(e){
    serverRecoveryAttempt=Math.min(serverRecoveryAttempt+1,SERVER_RECOVERY_DELAYS_MS.length-1);
    scheduleServerRecovery(reason);
    return false;
  }finally{serverRecoveryRunning=false;}
}
function noteServerTransportError(){
  if(serverConnectionState==='reconnecting'||serverReconnectNoticeTimer)return;
  serverReconnectNoticeTimer=setTimeout(()=>{serverReconnectNoticeTimer=null;if(liveEventSource?.readyState!==EventSource.OPEN){setServerConnectionState('reconnecting');scheduleServerRecovery('event-stream',0);}},SERVER_RECONNECT_NOTICE_DELAY_MS);
}
function noteCacheResponse(url,res,nameOverride=''){
  const name=String(nameOverride||cacheSourceName(url)||'remote data');
  const key=String(url||name);
  const state=String(res?.headers?.get('X-LibreDisplay-Cache')||'').toLowerCase();
  if(res?.ok&&state==='stale')configApi.staleCacheSources.set(key,{name,at:Date.now()});
  else if(res?.ok)configApi.staleCacheSources.delete(key);
  updateOfflinePill();
}
async function loadRemoteInfo(){
  const input=document.getElementById('remote-settings-url');
  const status=document.getElementById('remote-settings-status');
  const displayInput=document.getElementById('remote-display-url');
  const toggle=document.getElementById('toggle-remote-access');
  const rotate=document.getElementById('rotate-remote-key');
  if(bootstrapApi.REMOTE_SETTINGS_MODE){
    if(input)input.value=location.origin+'/settings';
    if(displayInput)displayInput.value='';
    if(status)status.textContent='Remote admin session active. Pairing secrets are not exposed to this browser.';
    if(toggle)toggle.style.display='none';
    if(rotate)rotate.style.display='none';
    return;
  }
  try{
    const res=await resilientFetch('/api/remote-info',{cache:'no-store'});
    if(!res.ok)throw new Error('HTTP '+res.status);
    configApi.remoteInfo=await res.json();
    const enabled=!!configApi.remoteInfo?.remoteEnabled;
    const url=enabled?(configApi.remoteInfo?.settingsUrls?.[0]||''):'';
    const displayRows=Array.isArray(configApi.remoteInfo?.displayUrls)?configApi.remoteInfo.displayUrls:[];
    const displayUrl=enabled?(displayRows.find(x=>x&&x.id===bootstrapApi.ACTIVE_ENDPOINT)?.url||displayRows.find(x=>typeof x==='string')||''):'';
    if(input)input.value=url;
    if(displayInput)displayInput.value=displayUrl;
    if(toggle){toggle.style.display='';toggle.textContent=enabled?'Disable remote editing':'Enable remote editing';}
    if(rotate)rotate.style.display=enabled?'':'none';
    if(status){
      if(!enabled)status.textContent='Remote editing is disabled. The dashboard will reject pairing attempts until you enable it from this local display.';
      else status.textContent=url?'Remote editing is enabled for trusted private-network clients. Treat the pairing link like a password.':'Remote editing is enabled, but no LAN address is currently available.';
    }
  }catch(e){
    if(input)input.value='';
    if(displayInput)displayInput.value='';
    if(toggle)toggle.style.display='none';
    if(rotate)rotate.style.display='none';
    if(status)status.textContent='Remote management controls are available from the wall/local display only.';
  }
}
async function toggleRemoteAccess(){
  if(bootstrapApi.REMOTE_SETTINGS_MODE){alert('Change remote access from the wall display itself.');return;}
  const currentlyEnabled=!!configApi.remoteInfo?.remoteEnabled;
  const message=currentlyEnabled
    ?'Disable remote access? Existing admin sessions and read-only display links will stop working until new links are issued.'
    :'Enable remote editing for trusted devices on your private LAN/VPN? Do not port-forward LibreDisplay directly to the public internet.';
  if(!confirm(message))return;
  const status=document.getElementById('remote-settings-status');
  try{
    const res=await resilientFetch('/api/remote-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!currentlyEnabled}),cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
    await loadRemoteInfo();
  }catch(e){if(status)status.textContent='Could not change remote access: '+(e.message||e);}
}
async function copyRemoteSettingsUrl(){
  const input=document.getElementById('remote-settings-url');
  const status=document.getElementById('remote-settings-status');
  const value=String(input?.value||'').trim();
  if(!value){if(status)status.textContent='Enable remote editing first, then copy the pairing link.';return;}
  let ok=false;try{await navigator.clipboard.writeText(value);ok=true;}catch(e){}
  if(!ok&&input){input.select();try{ok=document.execCommand('copy');}catch(e){}}
  if(status)status.textContent=ok?'Pairing link copied. Treat it like a password.':'Copy was blocked by the browser; select the URL and copy it manually.';
}
async function copyRemoteDisplayUrl(){
  const input=document.getElementById('remote-display-url');
  const status=document.getElementById('remote-settings-status');
  const value=String(input?.value||'').trim();
  if(!value){if(status)status.textContent='Enable remote access first, then copy the read-only display link.';return;}
  let ok=false;try{await navigator.clipboard.writeText(value);ok=true;}catch(e){}
  if(!ok&&input){input.select();try{ok=document.execCommand('copy');}catch(e){}}
  if(status)status.textContent=ok?'Read-only display link copied. Open it once on the screen you want to use.':'Copy was blocked by the browser; select the URL and copy it manually.';
}
async function rotateRemoteAccessKey(){
  if(bootstrapApi.REMOTE_SETTINGS_MODE){alert('Rotate the access key from the wall display itself.');return;}
  if(!configApi.remoteInfo?.remoteEnabled){alert('Enable remote editing first.');return;}
  if(!confirm('Rotate remote access keys? Existing admin sessions and read-only display links will stop working immediately.'))return;
  const status=document.getElementById('remote-settings-status');
  try{
    const res=await resilientFetch('/api/access-rotate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
    await loadRemoteInfo();
    if(status)status.textContent='Remote access keys rotated. Existing admin sessions and display links were invalidated.';
  }catch(e){if(status)status.textContent='Could not rotate remote access key: '+(e.message||e);}
}

async function loadCacheStatus(){
  const el=document.getElementById('cache-status');
  try{
    const res=await resilientFetch(serverPath('/api/cache-status'),{cache:'no-store'});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const d=await res.json();
    const mb=(Number(d.bytes||0)/1048576).toFixed(1);
    const maxMb=d.maxBytes?Math.round(Number(d.maxBytes)/1048576):512;
    if(el){el.style.display='block';el.textContent=`Offline cache: ${d.items||0} last-good responses · ${mb} MB / ${maxMb} MB.`;}
  }catch(e){if(el){el.style.display='block';el.textContent='Offline cache status unavailable.';}}
}
async function clearOfflineCache(){
  if(!confirm('Clear the saved offline cache? Live services will be fetched again as needed.'))return;
  const el=document.getElementById('cache-status');
  try{
    const res=await resilientFetch(serverPath('/api/cache-clear'),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
    if(!res.ok)throw new Error('HTTP '+res.status);
    configApi.staleCacheSources.clear();updateOfflinePill();
    if(el){el.style.display='block';el.textContent='Offline cache cleared.';}
    setTimeout(loadCacheStatus,500);
  }catch(e){if(el){el.style.display='block';el.textContent='Could not clear the offline cache: '+e.message;}}
}
async function pollServerConfig(){
  if(document.hidden)return;
  const configWasAvailable=configApi.serverConfigAvailable;
  const setup=document.getElementById('setup');
  const setupOpen=!!setup&&!setup.classList.contains('hidden');
  if(layoutEditorActive||remoteLayoutProxyActive||document.getElementById('remote-layout-preview-shell')?.classList.contains('show'))return;
  // Local Settings keeps its historic isolation. A remote editor, however, must
  // continue receiving server-side changes while its form is clean; otherwise
  // the wall display updates but the remote preview (including alert motion)
  // can remain stale until Settings is closed/reopened. Never overwrite unsaved
  // remote edits or the explicit full-screen preview state.
  if(setupOpen&&(!bootstrapApi.REMOTE_SETTINGS_MODE||LibreDisplayRuntime.getModule('system').settingsDirty||LibreDisplayRuntime.getModule('settings').settingsPreviewMode))return;
  try{
    const res=await resilientFetch(serverPath('/api/config'),{cache:'no-store'});
    if(!res.ok)return;
    const data=await res.json();configApi.serverConfigAvailable=true;configApi.serverConfigLastError='';
    const remote=data?.config;
    const remoteSaved=Number(remote?._savedAt||data?.savedAt||0);
    const localSaved=Number(cfg?._savedAt||0);
    const migratedRemote=(remote&&typeof remote==='object')?configApi.migrateConfigSnapshot(remote):null;
    const mergedRemote=migratedRemote?{...configApi.CFG_DEFAULTS,...migratedRemote,_savedAt:remoteSaved}:null;
    const remoteChanged=!!mergedRemote&&(remoteSaved!==localSaved||(remoteSaved===0&&localSaved===0&&JSON.stringify(mergedRemote)!==JSON.stringify({...cfg,_savedAt:0})));
    const shouldApplyRemote=remoteChanged&&(!bootstrapApi.LOCAL_CLIENT_MODE||remoteSaved>localSaved||(remoteSaved===0&&localSaved===0));
    if(shouldApplyRemote){
      cfg=mergedRemote;ensureCfgDefaults();
      if(bootstrapApi.LOCAL_CLIENT_MODE){try{localStorage.setItem(bootstrapApi.CFG_KEY,JSON.stringify(cfg));}catch(e){}}
      configApi.alertRuntimeState=null;
      window.__uiPreviewCfg=null;
      applySettings();
      // If this is the clean remote editor, immediately rehydrate the visible
      // form from the server snapshot. openSetup() also rebuilds the alert form
      // runtime state and restarts its preview motion from the newly synced cfg.
      if(setupOpen&&bootstrapApi.REMOTE_SETTINGS_MODE&&!LibreDisplayRuntime.getModule('system').settingsDirty){
        setTimeout(()=>{openSetup(false);setTimeout(ensureAlertMotionRunning,120);},0);
      }else{
        setTimeout(ensureAlertMotionRunning,120);
      }
    }else if(!configWasAvailable&&!configApi.wxData){
      setTimeout(()=>LibreDisplayRuntime.getModule('weather').fetchWeather(),0);
    }
  }catch(e){}
}
let liveEventSource=null,heartbeatTimer=null,heartbeatResizeTimer=null;
let physicalDisplayBenchmarkState=null;
const PHYSICAL_DISPLAY_BENCHMARK_STAGE_TOTAL=17;
function displayDeviceId(){let id='';try{id=localStorage.getItem('libredisplay_device_id')||'';}catch(e){}if(!/^[A-Za-z0-9_-]{12,80}$/.test(id)){id='d'+Math.random().toString(36).slice(2)+Date.now().toString(36);try{localStorage.setItem('libredisplay_device_id',id);}catch(e){}}return id;}
function displayViewportMetrics(){
  const root=document.documentElement,app=document.getElementById('app'),appRect=app?.getBoundingClientRect?.(),vv=window.visualViewport,fontProbe=measureDashboardFontProbe(cfg?.fontFamily||'Inter');
  const viewportWidth=Math.max(1,Math.round(root?.clientWidth||innerWidth||screen.width||1)),viewportHeight=Math.max(1,Math.round(root?.clientHeight||innerHeight||screen.height||1));
  const layoutWidth=Math.max(1,Math.round(appRect?.width||viewportWidth)),layoutHeight=Math.max(1,Math.round(appRect?.height||viewportHeight));
  return {width:layoutWidth,height:layoutHeight,layoutWidth,layoutHeight,viewportWidth,viewportHeight,visualViewportWidth:Math.max(1,Math.round(vv?.width||viewportWidth)),visualViewportHeight:Math.max(1,Math.round(vv?.height||viewportHeight)),visualViewportScale:Number(vv?.scale)||1,screenWidth:Math.round(screen.width||layoutWidth),screenHeight:Math.round(screen.height||layoutHeight),dpr:Number(devicePixelRatio)||1,fontProbeWidth:Number(fontProbe.width.toFixed(3))||0,fontProbeHeight:Number(fontProbe.height.toFixed(3))||0,fontName:String(cfg?.fontFamily||'Inter')};
}
function dispatchPendingPhysicalDisplayCommand(command){
  if(!bootstrapApi.LOCAL_CLIENT_MODE||!command||command.action!=='performance-benchmark')return false;
  const requestId=String(command.requestId||'').replace(/[^A-Za-z0-9_-]+/g,'-').slice(0,96);if(!requestId)return false;
  const currentId=String(physicalDisplayBenchmarkState?.requestId||''),currentState=String(physicalDisplayBenchmarkState?.state||'');
  if(currentId===requestId&&['running','complete','error'].includes(currentState))return false;
  const event={data:JSON.stringify(command)};setTimeout(()=>LibreDisplayRuntime.getModule('performance').runExclusiveTask('display-performance-benchmark',()=>runPhysicalDisplayBenchmarkRequest(event)),0);return true;
}
async function sendDisplayHeartbeat(connectivityRecovered=false){if(!bootstrapApi.READ_ONLY_DISPLAY_MODE&&!bootstrapApi.LOCAL_CLIENT_MODE)return;try{const m=displayViewportMetrics(),frontendPerformance={...LibreDisplayRuntime.getModule('performance').frontendPerformanceSnapshot(),connectivity:connectivitySnapshot()};const response=await resilientFetch(serverPath('/api/device-heartbeat'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:displayDeviceId(),...m,mode:bootstrapApi.READ_ONLY_DISPLAY_MODE?'viewer':(bootstrapApi.LOCAL_CLIENT_MODE?'local':'admin'),version:bootstrapApi.DASHBOARD_BUILD,userAgent:navigator.userAgent,frontendPerformance,displayPerformanceBenchmark:bootstrapApi.LOCAL_CLIENT_MODE?physicalDisplayBenchmarkState:undefined,connectivityRecovered:!!connectivityRecovered}),cache:'no-store'},{timeoutMs:5000,retry:false});if(response.ok&&bootstrapApi.LOCAL_CLIENT_MODE){const payload=await response.json().catch(()=>({}));dispatchPendingPhysicalDisplayCommand(payload?.pendingCommand);}}catch(e){}}
function parseDisplayBenchmarkEvent(event){try{return JSON.parse(String(event?.data||'{}'))||{};}catch{return {};}}
async function runPhysicalDisplayBenchmarkRequest(event){
  if(!bootstrapApi.LOCAL_CLIENT_MODE)return;
  const request=parseDisplayBenchmarkEvent(event),requestId=String(request.requestId||'').replace(/[^A-Za-z0-9_-]+/g,'-').slice(0,96)||('bench-'+Date.now().toString(36));
  const requestedAt=Number(request.requestedAt)||Math.floor(Date.now()/1000),startedAt=new Date().toISOString(),performance=LibreDisplayRuntime.getModule('performance');
  physicalDisplayBenchmarkState={requestId,state:'running',requestedAt:new Date(requestedAt*1000).toISOString(),startedAt,stageKey:'preparing',stageLabel:'Preparing physical display benchmark',stageIndex:0,stageTotal:PHYSICAL_DISPLAY_BENCHMARK_STAGE_TOTAL};
  await sendDisplayHeartbeat(false);
  try{
    const result=await performance.runDisplayPerformanceBenchmark({onStage:stage=>{physicalDisplayBenchmarkState={...physicalDisplayBenchmarkState,state:'running',stageKey:stage.key||'',stageLabel:stage.label||'',stageIndex:Number(stage.index)||0,stageTotal:Number(stage.total)||PHYSICAL_DISPLAY_BENCHMARK_STAGE_TOTAL};}});
    physicalDisplayBenchmarkState={requestId,state:'complete',requestedAt:physicalDisplayBenchmarkState.requestedAt,startedAt,resultStartedAt:result.startedAt||startedAt,finishedAt:result.finishedAt||new Date().toISOString(),stageKey:'complete',stageLabel:'Completed',stageIndex:PHYSICAL_DISPLAY_BENCHMARK_STAGE_TOTAL,stageTotal:PHYSICAL_DISPLAY_BENCHMARK_STAGE_TOTAL,result};
  }catch(error){
    physicalDisplayBenchmarkState={requestId,state:'error',requestedAt:physicalDisplayBenchmarkState?.requestedAt||new Date(requestedAt*1000).toISOString(),startedAt,finishedAt:new Date().toISOString(),stageKey:'error',stageLabel:'Failed',stageIndex:0,stageTotal:PHYSICAL_DISPLAY_BENCHMARK_STAGE_TOTAL,error:String(error?.message||error||'Display benchmark failed').slice(0,400)};
  }
  await sendDisplayHeartbeat(false);
}
function scheduleDisplayHeartbeat(delay=100){if(!bootstrapApi.READ_ONLY_DISPLAY_MODE&&!bootstrapApi.LOCAL_CLIENT_MODE)return;if(heartbeatResizeTimer)clearTimeout(heartbeatResizeTimer);heartbeatResizeTimer=setTimeout(()=>{heartbeatResizeTimer=null;LibreDisplayRuntime.getModule('performance').runExclusiveTask('display-heartbeat',sendDisplayHeartbeat);},Math.max(0,delay));}
function bindDisplayViewportHeartbeat(){
  if(window.__ldViewportHeartbeatBound)return;window.__ldViewportHeartbeatBound=true;
  window.addEventListener('resize',()=>scheduleDisplayHeartbeat(80),{passive:true});
  window.addEventListener('orientationchange',()=>scheduleDisplayHeartbeat(180),{passive:true});
  window.addEventListener('pageshow',()=>scheduleDisplayHeartbeat(60),{passive:true});
  document.addEventListener('fullscreenchange',()=>scheduleDisplayHeartbeat(120));
  window.visualViewport?.addEventListener('resize',()=>scheduleDisplayHeartbeat(80),{passive:true});
}
function startLiveDisplayConnection(){
  clearServerReconnectNotice();clearServerRecoveryTimer();serverRecoveryAttempt=0;
  try{liveEventSource?.close();}catch(e){}liveEventSource=null;
  try{
    liveEventSource=new EventSource(serverPath('/api/events'));
    liveEventSource.onopen=markServerTransportOpen;liveEventSource.onerror=noteServerTransportError;
    liveEventSource.addEventListener('config',()=>LibreDisplayRuntime.getModule('performance').runExclusiveTask('remote-config-poll',pollServerConfig));liveEventSource.addEventListener('household',async()=>{await loadHousehold(false);refreshFamilyBlocks();});liveEventSource.addEventListener('refresh',()=>{if(bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LOCAL_CLIENT_MODE){LibreDisplayRuntime.getModule('settings').refreshDataNow();scheduleDisplayHeartbeat(40);}});liveEventSource.addEventListener('heartbeat',()=>{if(bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LOCAL_CLIENT_MODE)scheduleDisplayHeartbeat(0);});liveEventSource.addEventListener('performance-benchmark',event=>{if(bootstrapApi.LOCAL_CLIENT_MODE){const command=parseDisplayBenchmarkEvent(event);dispatchPendingPhysicalDisplayCommand({action:'performance-benchmark',...command});}});liveEventSource.addEventListener('reload',()=>{if(bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LOCAL_CLIENT_MODE)location.reload();});liveEventSource.addEventListener('reauth',()=>location.reload());
  }catch(e){noteServerTransportError();}
  const performance=LibreDisplayRuntime.getModule('performance');
  bindDisplayViewportHeartbeat();performance.runExclusiveTask('display-heartbeat',sendDisplayHeartbeat);
  performance.stopManagedInterval('display-heartbeat');
  heartbeatTimer=performance.startManagedInterval('display-heartbeat',sendDisplayHeartbeat,bootstrapApi.LOCAL_CLIENT_MODE?5000:30000,{skipWhenHidden:false,resumeOnVisible:false});
  updateOfflinePill();
}
function startRemoteConfigPolling(){const performance=LibreDisplayRuntime.getModule('performance');performance.stopManagedInterval('remote-config-poll');configApi.remoteConfigPollTimer=performance.startManagedInterval('remote-config-poll',pollServerConfig,bootstrapApi.REMOTE_SETTINGS_MODE?5000:30000,{skipWhenHidden:true,resumeOnVisible:true,immediate:true});}

function settingsRecoveryMessage(error){
  const raw=String(error?.message||error||'Settings initialization did not finish.').replace(/\s+/g,' ').trim();
  return raw.length>260?raw.slice(0,257)+'…':raw;
}
function showSettingsInitializationError(error){
  console.error('LibreDisplay settings initialization recovered',error);
  const panel=document.getElementById('settings-init-error');
  const text=document.getElementById('settings-init-error-text');
  if(text)text.textContent=settingsRecoveryMessage(error);
  if(panel)panel.classList.add('show');
  document.getElementById('setup')?.classList.remove('hidden');document.getElementById('setup')?.setAttribute('aria-hidden','false');
  document.querySelectorAll('.s-section[data-settings-tab="overview"]').forEach(section=>{
    section.classList.remove('settings-advanced-hidden');section.classList.add('tab-active');
  });
  const overview=document.querySelector('.settings-tab-btn[data-tab="overview"]');
  if(overview){overview.classList.add('active');overview.setAttribute('aria-selected','true');}
}
function clearSettingsInitializationError(){
  document.getElementById('settings-init-error')?.classList.remove('show');
}


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("remote", {endpointDeviceSummary,currentDisplayReadinessDevice,displayReadinessAssessment,renderDisplayReadiness,refreshDisplayReadiness,loadDisplayEndpoints,endpointAction,sendDisplayCommand,createDisplayEndpoint,editDisplayEndpoint,copyDisplayEndpointLink,renameDisplayEndpoint,rotateDisplayEndpoint,deleteDisplayEndpoint,cacheSourceName,updateOfflinePill,setServerConnectionState,clearServerReconnectNotice,clearServerRecoveryTimer,markServerTransportOpen,scheduleServerRecovery,recoverServerConnection,noteServerTransportError,noteCacheResponse,loadRemoteInfo,toggleRemoteAccess,copyRemoteSettingsUrl,copyRemoteDisplayUrl,rotateRemoteAccessKey,loadCacheStatus,clearOfflineCache,pollServerConfig,displayDeviceId,displayViewportMetrics,dispatchPendingPhysicalDisplayCommand,sendDisplayHeartbeat,parseDisplayBenchmarkEvent,runPhysicalDisplayBenchmarkRequest,scheduleDisplayHeartbeat,bindDisplayViewportHeartbeat,startLiveDisplayConnection,startRemoteConfigPolling,settingsRecoveryMessage,showSettingsInitializationError,clearSettingsInitializationError}, {
  "displayEndpoints": {configurable:true,get:()=>displayEndpoints,set:(value)=>{displayEndpoints=value;}},
  "displayDevices": {configurable:true,get:()=>displayDevices,set:(value)=>{displayDevices=value;}},
  "endpointsRemoteEnabled": {configurable:true,get:()=>endpointsRemoteEnabled,set:(value)=>{endpointsRemoteEnabled=value;}},
  "serverConnectionState": {configurable:true,get:()=>serverConnectionState,set:(value)=>{serverConnectionState=value;}},
  "serverReconnectRefreshPending": {configurable:true,get:()=>serverReconnectRefreshPending,set:(value)=>{serverReconnectRefreshPending=value;}},
  "serverReconnectNoticeTimer": {configurable:true,get:()=>serverReconnectNoticeTimer,set:(value)=>{serverReconnectNoticeTimer=value;}},
  "SERVER_RECONNECT_NOTICE_DELAY_MS": {configurable:true,get:()=>SERVER_RECONNECT_NOTICE_DELAY_MS},
  "liveEventSource": {configurable:true,get:()=>liveEventSource,set:(value)=>{liveEventSource=value;}},
  "heartbeatTimer": {configurable:true,get:()=>heartbeatTimer,set:(value)=>{heartbeatTimer=value;}},
  "heartbeatResizeTimer": {configurable:true,get:()=>heartbeatResizeTimer,set:(value)=>{heartbeatResizeTimer=value;}},
  "physicalDisplayBenchmarkState": {configurable:true,get:()=>physicalDisplayBenchmarkState,set:(value)=>{physicalDisplayBenchmarkState=value;}},
}, {globalFunctions:['refreshDisplayReadiness','loadDisplayEndpoints','sendDisplayCommand','createDisplayEndpoint','editDisplayEndpoint','copyDisplayEndpointLink','renameDisplayEndpoint','rotateDisplayEndpoint','deleteDisplayEndpoint','toggleRemoteAccess','copyRemoteSettingsUrl','copyRemoteDisplayUrl','rotateRemoteAccessKey','clearOfflineCache'],globalStates:[]});
}
// End source section: /js/remote/index.js
