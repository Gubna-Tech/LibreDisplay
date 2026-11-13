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
let ownerDeviceInfo={};
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
    if(status)status.textContent=`Editing “${displayEndpoints.find(e=>e.id===bootstrapApi.ACTIVE_ENDPOINT)?.name||bootstrapApi.ACTIVE_ENDPOINT}”. ${displayDevices.filter(x=>x.online).length} viewer${displayDevices.filter(x=>x.online).length===1?'':'s'} online.`+(endpointsRemoteEnabled?'':' Enable Remote management before using Display Links on other devices.');LibreDisplayRuntime.getModule('qol')?.renderSectionCopyUi?.();
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
async function copyDisplayEndpointLink(id){const row=displayEndpoints.find(e=>e.id===id);if(!endpointsRemoteEnabled){alert('Enable Remote management first so other devices can use Display Links.');return false;}if(!row?.displayUrl){alert('Display Link is unavailable.');return false;}const ok=await copyTextValue(row.displayUrl);if(ok)alert('Read-only Display Link copied.');else prompt('Copy this Display Link:',row.displayUrl);return ok;}
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
const STALE_PROVIDER_NOTICE_DELAY_MS=20000;
const STALE_PROVIDER_DEFAULT_LEASE_MS=10*60*1000;
const STALE_PROVIDER_MIN_LEASE_MS=60*1000;
const STALE_PROVIDER_MAX_LEASE_MS=30*60*1000;
const SERVER_RECOVERY_DELAYS_MS=[1000,3000,8000,15000,30000,60000];
let staleProviderNoticeTimer=null;
function staleProviderLeaseMs(value=STALE_PROVIDER_DEFAULT_LEASE_MS){return Math.max(STALE_PROVIDER_MIN_LEASE_MS,Math.min(STALE_PROVIDER_MAX_LEASE_MS,Number(value)||STALE_PROVIDER_DEFAULT_LEASE_MS));}
function pruneStaleCacheSources(now=Date.now()){let removed=0;for(const [key,row] of [...configApi.staleCacheSources.entries()]){const expiresAt=Number(row?.expiresAt)||0;if(expiresAt&&expiresAt<=now){configApi.staleCacheSources.delete(key);removed++;}}return removed;}
function staleCacheSnapshot(){const now=Date.now();pruneStaleCacheSources(now);return [...configApi.staleCacheSources.values()].slice(0,12).map(row=>({name:String(row?.name||'remote data').slice(0,80),ageMs:Math.max(0,now-(Number(row?.at)||now)),lastStaleMs:Math.max(0,now-(Number(row?.lastStaleAt)||Number(row?.at)||now)),expiresInMs:Math.max(0,(Number(row?.expiresAt)||now)-now)}));}
function updateOfflinePill(){
  const pill=document.getElementById('offline-pill');if(!pill)return;
  const now=Date.now();pruneStaleCacheSources(now);const staleRows=[...configApi.staleCacheSources.values()],oldest=staleRows.length?Math.min(...staleRows.map(x=>Number(x?.at)||now)):now,exclusiveRuns=Number(LibreDisplayRuntime.getModule('performance').animationPerformanceSnapshot?.().activeExclusiveRuns)||0,staleReady=staleRows.length>0&&!exclusiveRuns&&(now-oldest)>=STALE_PROVIDER_NOTICE_DELAY_MS,serverDown=serverConnectionState!=='online';
  const active=staleReady||serverDown;let state='online',text='';
  if(serverDown){state='reconnecting';text=staleReady?'Connection interrupted · showing last known data':'Connection interrupted · retrying automatically';}
  else if(staleReady){state='cached';text='Provider delayed · showing last known data';}
  pill.dataset.state=state;pill.classList.toggle('show',active);if(pill.textContent!==text)pill.textContent=text;
  if(staleProviderNoticeTimer){clearTimeout(staleProviderNoticeTimer);staleProviderNoticeTimer=null;}
  const wakeAt=[];for(const row of staleRows){const first=Number(row?.at)||now,expires=Number(row?.expiresAt)||0;if(first+STALE_PROVIDER_NOTICE_DELAY_MS>now)wakeAt.push(first+STALE_PROVIDER_NOTICE_DELAY_MS);if(expires>now)wakeAt.push(expires);}
  if(wakeAt.length){const wait=Math.max(250,Math.min(...wakeAt)-now);staleProviderNoticeTimer=setTimeout(()=>{staleProviderNoticeTimer=null;updateOfflinePill();},wait);}
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
function noteCacheResponse(url,res,nameOverride='',options={}){
  const name=String(nameOverride||cacheSourceName(url)||'remote data');
  const key=String(url||name),state=String(res?.headers?.get('X-LibreDisplay-Cache')||'').toLowerCase(),now=Date.now();
  if(res?.ok&&state==='stale'){const previous=configApi.staleCacheSources.get(key),leaseMs=staleProviderLeaseMs(options?.leaseMs);configApi.staleCacheSources.set(key,{name,at:Number(previous?.at)||now,lastStaleAt:now,expiresAt:now+leaseMs});}
  else if(res?.ok)configApi.staleCacheSources.delete(key);
  updateOfflinePill();return state;
}
let ownerEnrollmentState=null;
let ownerEnrollmentTimer=0;
let ownerEnrollmentRevealTimer=0;
function remoteTimeAgo(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0));if(n<60)return n+' sec ago';if(n<3600)return Math.floor(n/60)+' min ago';if(n<86400)return Math.floor(n/3600)+' hr ago';return Math.floor(n/86400)+' day'+(Math.floor(n/86400)===1?'':'s')+' ago';}
function remoteTimeRemaining(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0));if(!n)return 'expired';if(n<3600)return Math.max(1,Math.ceil(n/60))+' min';if(n<86400)return Math.ceil(n/3600)+' hr';return Math.ceil(n/86400)+' day'+(Math.ceil(n/86400)===1?'':'s');}
function renderOwnerDevices(payload={}){
  const list=document.getElementById('owner-device-list');if(!list)return;
  const rows=Array.isArray(payload.devices)?payload.devices:[],serverNow=Number(payload.serverTime)||Date.now()/1000;
  const local=payload.localDisplay||{};
  const localRow=`<div class="owner-device-row ${local.current?'current':''}"><div class="owner-device-main"><b>Local LibreDisplay <span class="owner-device-badge">Always Owner</span></b><span>Physical/local server session</span><small>This access cannot be revoked remotely; it is the recovery path for Remote Access.</small></div></div>`;
  const devices=rows.map(row=>{const current=row.current?' <span class="owner-device-badge">This browser</span>':'';const seen=row.lastSeen?remoteTimeAgo(serverNow-row.lastSeen):'unknown',remaining=row.expiresAt?remoteTimeRemaining(row.expiresAt-serverNow):'unknown';const source=row.source==='enrollment'?'connection code':row.source==='account'?'account sign-in':row.source==='legacy-pair'?'legacy pairing':'authorized session';const ua=String(row.userAgent||'').replace(/\s+/g,' ').slice(0,110);return `<div class="owner-device-row ${row.current?'current':''}"><div class="owner-device-main"><b>${esc(row.name||'Owner device')}${current}</b><span>${esc(source)} · last seen ${esc(seen)} · expires in ${esc(remaining)}</span><small>${esc(ua||'Browser details unavailable')}</small></div><div class="owner-device-actions"><button class="btn-util" type="button" data-ld-action-click="remote.renameOwnerDevice" data-ld-action-args="${escHtml(JSON.stringify([row.id,row.name||'Owner device']))}">Rename</button><button class="btn-util" type="button" data-ld-action-click="remote.revokeOwnerDevice" data-ld-action-args="${escHtml(JSON.stringify([row.id,!!row.current,row.name||'Owner device']))}">Revoke</button></div></div>`;}).join('');
  list.innerHTML=localRow+(devices||'<div class="settings-note">No additional Owner devices are authorized yet.</div>');
}
async function loadOwnerDevices(){
  const res=await resilientFetch('/api/owner-devices',{cache:'no-store'}),data=await res.json().catch(()=>({}));
  if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
  renderOwnerDevices(data);return data;
}
function clearOwnerEnrollmentUi(message=''){
  ownerEnrollmentState=null;if(ownerEnrollmentTimer){clearInterval(ownerEnrollmentTimer);ownerEnrollmentTimer=0;}
  const panel=document.getElementById('owner-enrollment-panel');panel?.classList.add('hidden');panel?.classList.remove('owner-enrollment-reveal');if(ownerEnrollmentRevealTimer){clearTimeout(ownerEnrollmentRevealTimer);ownerEnrollmentRevealTimer=0;}
  const code=document.getElementById('owner-enrollment-code');if(code)code.textContent='----';
  const qr=document.getElementById('owner-enrollment-qr');if(qr)qr.innerHTML='';
  const select=document.getElementById('owner-connect-url-select');if(select)select.replaceChildren();
  const input=document.getElementById('owner-connect-url');if(input)input.value='';
  const countdown=document.getElementById('owner-enrollment-countdown');if(countdown)countdown.textContent='Expires soon';
  const status=document.getElementById('remote-settings-status');if(message&&status)status.textContent=message;
}
function updateOwnerEnrollmentCountdown(){
  if(!ownerEnrollmentState)return;const el=document.getElementById('owner-enrollment-countdown'),deadline=Number(ownerEnrollmentState._clientExpiresAt||ownerEnrollmentState.expiresAt||0);const left=Math.max(0,Math.ceil(deadline-Date.now()/1000));
  if(el)el.textContent=left?`Expires in ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')} · one use only`:'Code expired';
  if(left<=0)clearOwnerEnrollmentUi('The Owner connection code expired. Generate a new one when you are ready.');
}
function revealOwnerEnrollment(){
  const panel=document.getElementById('owner-enrollment-panel'),target=document.getElementById('owner-enrollment-qr-card')||document.getElementById('owner-enrollment-qr');if(!panel||!target)return;
  panel.classList.remove('owner-enrollment-reveal');void panel.offsetWidth;panel.classList.add('owner-enrollment-reveal');if(ownerEnrollmentRevealTimer)clearTimeout(ownerEnrollmentRevealTimer);ownerEnrollmentRevealTimer=setTimeout(()=>{panel.classList.remove('owner-enrollment-reveal');ownerEnrollmentRevealTimer=0;},1800);
  const reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;requestAnimationFrame(()=>requestAnimationFrame(()=>{try{target.scrollIntoView({behavior:reduced?'auto':'smooth',block:'center',inline:'nearest'});}catch(_e){try{target.scrollIntoView();}catch(_ignored){}}try{target.focus({preventScroll:true});}catch(_e){try{target.focus();}catch(_ignored){}}}));
}
function renderOwnerEnrollment(data){
  const ttl=Math.max(1,Number(data?.ttlSeconds)||0);ownerEnrollmentState={...data,_clientExpiresAt:ttl?Date.now()/1000+ttl:Number(data?.expiresAt||0)};const panel=document.getElementById('owner-enrollment-panel'),code=document.getElementById('owner-enrollment-code'),select=document.getElementById('owner-connect-url-select');
  if(code)code.textContent=String(data.code||'----');
  if(select){const options=Array.isArray(data.connectOptions)?data.connectOptions:[];select.innerHTML=options.map((row,i)=>`<option value="${i}">${esc(row.url||'')}</option>`).join('');select.value='0';}
  panel?.classList.remove('hidden');selectOwnerConnectOption();if(ownerEnrollmentTimer)clearInterval(ownerEnrollmentTimer);ownerEnrollmentTimer=setInterval(updateOwnerEnrollmentCountdown,1000);updateOwnerEnrollmentCountdown();revealOwnerEnrollment();
}
function selectOwnerConnectOption(){
  if(!ownerEnrollmentState)return;const options=Array.isArray(ownerEnrollmentState.connectOptions)?ownerEnrollmentState.connectOptions:[],select=document.getElementById('owner-connect-url-select'),index=Math.max(0,Number(select?.value)||0),row=options[index]||options[0]||{},input=document.getElementById('owner-connect-url'),qr=document.getElementById('owner-enrollment-qr');
  if(input)input.value=String(row.url||ownerEnrollmentState.primaryUrl||'');if(qr)qr.innerHTML=String(row.qrSvg||ownerEnrollmentState.qrSvg||'');
}
async function cancelOwnerEnrollment(options={}){
  const state=ownerEnrollmentState,status=document.getElementById('remote-settings-status'),silent=!!options?.silent;
  if(state?.enrollmentId){
    try{const res=await resilientFetch('/api/owner-enrollment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cancel',enrollmentId:state.enrollmentId}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));}
    catch(e){if(status&&!silent)status.textContent='Could not cancel the Owner connection code. It may remain valid until it expires: '+(e.message||e);return false;}
  }
  clearOwnerEnrollmentUi(silent?'':'Owner connection code cancelled.');return true;
}
async function beginOwnerEnrollment(){
  if(!configApi.remoteInfo?.remoteEnabled){alert('Enable Remote Access first, then add the Owner device.');return false;}
  const button=document.getElementById('add-owner-device'),status=document.getElementById('remote-settings-status');if(button)button.disabled=true;
  try{
    if(ownerEnrollmentState?.enrollmentId&&!await cancelOwnerEnrollment({silent:true}))throw new Error('The previous connection code could not be cancelled. Wait for it to expire or check the server connection before generating another.');
    const res=await resilientFetch('/api/owner-enrollment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create'}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));renderOwnerEnrollment(data);if(status)status.textContent='Connection code ready. It expires quickly and can be used only once.';return true;
  }catch(e){if(status)status.textContent='Could not create an Owner connection code: '+(e.message||e);return false;}finally{if(button)button.disabled=false;}
}
async function copyOwnerConnectUrl(){return copyRemoteInputValue(document.getElementById('owner-connect-url'),document.getElementById('remote-settings-status'),'Connection address copied. Enter the one-time code shown above on the new device.','Generate an Owner connection code first.');}
async function copyOwnerConnectCode(){const code=String(ownerEnrollmentState?.code||document.getElementById('owner-enrollment-code')?.textContent||'').trim();const status=document.getElementById('remote-settings-status');if(!code||code==='----'){if(status)status.textContent='Generate an Owner connection code first.';return false;}const ok=await copyTextValue(code);if(status)status.textContent=ok?'One-time Owner connection code copied.':'Copy was blocked by the browser. The code remains visible so you can type it manually.';return ok;}
async function renameOwnerDevice(id,currentName='Owner device'){
  const name=prompt('Name this Owner device:',currentName);if(name==null||!String(name).trim())return false;
  try{const res=await resilientFetch('/api/owner-devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'rename',id,name:String(name).trim()}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));ownerDeviceInfo={...ownerDeviceInfo,...data};renderOwnerDevices(ownerDeviceInfo);return true;}catch(e){alert('Could not rename Owner device: '+(e.message||e));return false;}
}
async function revokeOwnerDevice(id,current=false,name='Owner device'){
  const message=current?`Revoke “${name}”? This is the browser you are using now, so it will be signed out immediately.`:`Revoke “${name}”? That browser will lose Owner access immediately.`;if(!confirm(message))return false;
  try{const res=await resilientFetch('/api/owner-devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revoke',id}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));if(data.currentRevoked){location.href='/login';return true;}ownerDeviceInfo={...ownerDeviceInfo,devices:data.devices||[]};renderOwnerDevices(ownerDeviceInfo);return true;}catch(e){alert('Could not revoke Owner device: '+(e.message||e));return false;}
}
async function loadRemoteInfo(){
  const reconnectInput=document.getElementById('remote-reconnect-url'),status=document.getElementById('remote-settings-status'),displayInput=document.getElementById('remote-display-url'),toggle=document.getElementById('toggle-remote-access'),rotate=document.getElementById('rotate-remote-key'),addOwner=document.getElementById('add-owner-device'),deviceList=document.getElementById('owner-device-list');
  try{
    const sessionRes=await resilientFetch('/api/session-info',{cache:'no-store'}),session=await sessionRes.json().catch(()=>({}));if(!sessionRes.ok||!session.ok)throw new Error(session.error||('Session HTTP '+sessionRes.status));
    let ownerData={ok:false,devices:[],connectUrls:[]},ownerError='';try{ownerData=await loadOwnerDevices();}catch(e){ownerError=String(e.message||e);if(deviceList)deviceList.innerHTML='<div class="settings-note">Could not load Owner devices. Enrollment may still be available; refresh this section after checking the server connection.</div>';}
    let endpoints={endpoints:[]};try{const endpointsRes=await resilientFetch(serverPath('/api/endpoints'),{cache:'no-store'});if(endpointsRes.ok)endpoints=await endpointsRes.json().catch(()=>({endpoints:[]}));}catch(_e){}
    let localInfo=null;if(session.local){try{const r=await resilientFetch('/api/remote-info',{cache:'no-store'});if(r.ok)localInfo=await r.json();}catch(_e){}}
    const enabled=typeof localInfo?.remoteEnabled==='boolean'?localInfo.remoteEnabled:(typeof ownerData.remoteEnabled==='boolean'?ownerData.remoteEnabled:!!endpoints.remoteEnabled),row=(endpoints.endpoints||[]).find(x=>x.id===bootstrapApi.ACTIVE_ENDPOINT)||(endpoints.endpoints||[])[0],displayPath=String(row?.displayPath||''),reconnectUrl=(localInfo?.reconnectUrls?.[0]||location.origin+'/login');
    configApi.remoteInfo={...(localInfo||{}),remoteEnabled:enabled,connectUrls:ownerData.connectUrls||localInfo?.connectUrls||[],session};
    if(reconnectInput)reconnectInput.value=reconnectUrl;if(displayInput){let displayUrl=row?.displayUrl||'';if(displayPath){try{displayUrl=new URL(displayPath,(location.origin&&location.origin!=='null')?location.origin:location.href).href;}catch(_e){displayUrl=displayPath;}}displayInput.value=displayUrl;}
    if(toggle){toggle.style.display=session.local?'':'none';toggle.textContent=enabled?'Disable Remote Access':'Enable Remote Access';}
    if(rotate){rotate.style.display=session.local&&enabled?'':'none';}
    if(addOwner)addOwner.disabled=!enabled;
    if(status)status.textContent=!enabled?'Remote Access is disabled. Enable it from the local LibreDisplay before connecting another device.':(session.local?'Remote Access is enabled on this trusted network. Add Owner devices with a short-lived one-time code or QR.':'Owner session active. You can authorize another Owner device with a one-time code, or revoke devices below.')+(ownerError?' Owner-device list refresh failed; enrollment remains available.':'');
  }catch(e){if(addOwner)addOwner.disabled=true;if(toggle)toggle.style.display='none';if(rotate)rotate.style.display='none';if(status)status.textContent='Could not load Remote Access status: '+(e.message||e);}
}
async function toggleRemoteAccess(){
  if(bootstrapApi.REMOTE_SETTINGS_MODE&&!bootstrapApi.LOCAL_CLIENT_MODE){alert('Change Remote Access from the local LibreDisplay itself.');return;}
  const currentlyEnabled=!!configApi.remoteInfo?.remoteEnabled,message=currentlyEnabled?'Disable Remote Access? Authorized remote Owner sessions and read-only Display Links will be invalidated.':'Enable Remote Access for trusted devices on your private LAN/VPN? Do not port-forward LibreDisplay directly to the public internet.';if(!confirm(message))return;
  const status=document.getElementById('remote-settings-status');try{const res=await resilientFetch('/api/remote-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!currentlyEnabled}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));clearOwnerEnrollmentUi();await loadRemoteInfo();}catch(e){if(status)status.textContent='Could not change Remote Access: '+(e.message||e);}
}
async function copyTextValue(value,input=null){
  value=String(value||'').trim();if(!value)return false;let target=input,temporary=null,ok=false;if(!target){temporary=document.createElement('textarea');temporary.value=value;temporary.setAttribute('readonly','');temporary.setAttribute('aria-hidden','true');temporary.style.cssText='position:fixed;left:-10000px;top:-10000px;opacity:0';document.body.appendChild(temporary);target=temporary;}
  try{target.focus({preventScroll:true});target.select?.();target.setSelectionRange?.(0,value.length);ok=!!document.execCommand?.('copy');}catch(_e){}if(!ok&&navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);ok=true;}catch(_e){}}temporary?.remove();return ok;
}
async function copyRemoteInputValue(input,status,successText,emptyText){const value=String(input?.value||'').trim();if(!value){if(status)status.textContent=emptyText;return false;}const ok=await copyTextValue(value,input);if(status)status.textContent=ok?successText:'Copy was blocked by the browser. The full address remains visible so you can select and copy it manually.';return ok;}
async function copyRemoteReconnectUrl(){return copyRemoteInputValue(document.getElementById('remote-reconnect-url'),document.getElementById('remote-settings-status'),'Owner reconnect address copied.','Remote reconnect address is unavailable.');}
async function copyRemoteDisplayUrl(){return copyRemoteInputValue(document.getElementById('remote-display-url'),document.getElementById('remote-settings-status'),'Read-only Display Link copied.','Enable Remote Access first, then copy the read-only Display Link.');}
async function rotateRemoteAccessKey(){
  if(bootstrapApi.REMOTE_SETTINGS_MODE&&!bootstrapApi.LOCAL_CLIENT_MODE){alert('Reset remote credentials from the local LibreDisplay itself.');return;}if(!configApi.remoteInfo?.remoteEnabled){alert('Enable Remote Access first.');return;}if(!confirm('Reset all remote credentials? All authorized Owner sessions, legacy pairing links, one-time connection codes, and read-only Display Links will be invalidated immediately.'))return;
  const status=document.getElementById('remote-settings-status');try{const res=await resilientFetch('/api/access-rotate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));clearOwnerEnrollmentUi();await loadRemoteInfo();if(status)status.textContent='All remote credentials were reset. Reconnect Owner devices and redistribute any Display Links that should remain active.';}catch(e){if(status)status.textContent='Could not reset remote credentials: '+(e.message||e);}
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
async function pollServerConfig(options={}){
  const force=options?.force===true;
  if(!force&&document.hidden)return false;
  const configWasAvailable=configApi.serverConfigAvailable;
  const setup=document.getElementById('setup');
  const setupOpen=!!setup&&!setup.classList.contains('hidden');
  if(!force&&(layoutEditorActive||remoteLayoutProxyActive||document.getElementById('remote-layout-preview-shell')?.classList.contains('show')))return false;
  // Local Settings keeps its historic isolation. A remote editor, however, must
  // continue receiving server-side changes while its form is clean; otherwise
  // the wall display updates but the remote preview (including alert motion)
  // can remain stale until Settings is closed/reopened. Never overwrite unsaved
  // remote edits or the explicit full-screen preview state.
  if(!force&&setupOpen&&(!bootstrapApi.REMOTE_SETTINGS_MODE||LibreDisplayRuntime.getModule('system').settingsDirty||LibreDisplayRuntime.getModule('settings').settingsPreviewMode))return false;
  try{
    const res=await resilientFetch(serverPath('/api/config'),{cache:'no-store'});
    if(!res.ok)return false;
    const data=await res.json();configApi.serverConfigAvailable=true;configApi.serverConfigLastError='';
    const remote=data?.config;
    const remoteSaved=Number(remote?._savedAt||data?.savedAt||0);
    const localSaved=Number(cfg?._savedAt||0);
    const migratedRemote=(remote&&typeof remote==='object')?configApi.migrateConfigSnapshot(remote):null;
    const mergedRemote=migratedRemote?{...configApi.CFG_DEFAULTS,...migratedRemote,_savedAt:remoteSaved}:null;
    const remoteChanged=!!mergedRemote&&(remoteSaved!==localSaved||(remoteSaved===0&&localSaved===0&&JSON.stringify(mergedRemote)!==JSON.stringify({...cfg,_savedAt:0})));
    // Server snapshots are authoritative. Do not let a kiosk's browser clock or stale
    // localStorage timestamp suppress a remotely saved Arrange layout.
    const shouldApplyRemote=remoteChanged;
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
      return true;
    }else if(!configWasAvailable&&!configApi.wxData){
      setTimeout(()=>LibreDisplayRuntime.getModule('weather').fetchWeather(),0);
    }
    return false;
  }catch(e){return false;}
}
let liveEventSource=null,heartbeatTimer=null,heartbeatResizeTimer=null;
let physicalDisplayBenchmarkState=null;
let heartbeatMetricsCache=null,heartbeatMetricsDirty=true,heartbeatPerformanceCache=null,heartbeatPerformanceCacheAt=0,heartbeatPerformanceRefreshPending=false;
const HEARTBEAT_PERFORMANCE_CACHE_MS=60000;
// Read the Pi's existing automatic-fit result rather than recomputing it in
// Firefox. The physical kiosk is authoritative; this is read-only telemetry.
const PHYSICAL_FIT_BLOCKS={calendar:'#top-strip',current:'.wx-main',clock:'#clock-block',details:'.wx-details',daily:'#wx-forecast',hourly:'#wx-hourly-block'};
function capturePhysicalFitMetrics(){
  const values={};
  if(!document.body.classList.contains('custom-layout'))return {width:Math.round(document.documentElement.clientWidth),height:Math.round(document.documentElement.clientHeight),values,capturedAt:Date.now()};
  for(const [key,selector] of Object.entries(PHYSICAL_FIT_BLOCKS)){
    const el=document.querySelector(selector);if(!el)continue;
    const fit=Number.parseFloat(el.style.getPropertyValue('--ld-layout-fit-'+key)||'1');
    values[key]=Number.isFinite(fit)?Math.max(.15,Math.min(1,fit)):1;
  }
  const preview=physicalLayoutPreviewId?{
    previewId:physicalLayoutPreviewId,
    previewRevision:physicalLayoutPreviewRevision,
    previewSettled:physicalLayoutPreviewFitReadyRevision===physicalLayoutPreviewRevision
  }:{};
  return {width:Math.round(document.documentElement.clientWidth),height:Math.round(document.documentElement.clientHeight),values,capturedAt:Date.now(),...preview};
}
// Send a new kiosk fit report as soon as the six lightweight CSS fit metrics
// settle. The former 30-second heartbeat alone could keep the remote on an
// incorrect first frame for more than a minute (30s Pi + 10s Owner + hydration).
// This monitor makes *no layout edits*; it only schedules the existing heartbeat
// when measurements change and become stable. Nothing is sent on idle ticks.
let physicalFitHeartbeatTimer=null,physicalFitObservedSignature='',physicalFitObservedAt=0,physicalFitSentSignature='';
function pollPhysicalFitHeartbeat(){
  if(!bootstrapApi.LOCAL_CLIENT_MODE)return;
  const layout=LibreDisplayRuntime.getModule('layout'),state=layout?.builtInLayoutAutoFitSnapshot?.();
  if(state&&(state.suspended||state.processing||state.deferredPending||state.idlePending||state.pending?.length))return;
  const fit=capturePhysicalFitMetrics();
  const signature=JSON.stringify([fit.width,fit.height,fit.values,String(cfg?.fontFamily||''),Number(cfg?._savedAt)||0]);
  const now=Date.now();
  if(signature!==physicalFitObservedSignature){physicalFitObservedSignature=signature;physicalFitObservedAt=now;return;}
  if(signature!==physicalFitSentSignature&&now-physicalFitObservedAt>=650){
    physicalFitSentSignature=signature;
    scheduleDisplayHeartbeat(80);
  }
}
function startPhysicalFitHeartbeatMonitor(){
  if(!bootstrapApi.LOCAL_CLIENT_MODE||physicalFitHeartbeatTimer)return;
  physicalFitHeartbeatTimer=setInterval(pollPhysicalFitHeartbeat,800);
  setTimeout(pollPhysicalFitHeartbeat,100);
}
function displayDeviceId(){let id='';try{id=localStorage.getItem('libredisplay_device_id')||'';}catch(e){}if(!/^[A-Za-z0-9_-]{12,80}$/.test(id)){id='d'+Math.random().toString(36).slice(2)+Date.now().toString(36);try{localStorage.setItem('libredisplay_device_id',id);}catch(e){}}return id;}
function displayViewportMetrics(force=false){
  if(!force&&!heartbeatMetricsDirty&&heartbeatMetricsCache)return heartbeatMetricsCache;
  const root=document.documentElement,app=document.getElementById('app'),appRect=app?.getBoundingClientRect?.(),vv=window.visualViewport,fontProbe=measureDashboardFontProbe(cfg?.fontFamily||'Inter');
  const viewportWidth=Math.max(1,Math.round(root?.clientWidth||innerWidth||screen.width||1)),viewportHeight=Math.max(1,Math.round(root?.clientHeight||innerHeight||screen.height||1));
  const layoutWidth=Math.max(1,Math.round(appRect?.width||viewportWidth)),layoutHeight=Math.max(1,Math.round(appRect?.height||viewportHeight));
  heartbeatMetricsCache={width:layoutWidth,height:layoutHeight,layoutWidth,layoutHeight,viewportWidth,viewportHeight,visualViewportWidth:Math.max(1,Math.round(vv?.width||viewportWidth)),visualViewportHeight:Math.max(1,Math.round(vv?.height||viewportHeight)),visualViewportScale:Number(vv?.scale)||1,screenWidth:Math.round(screen.width||layoutWidth),screenHeight:Math.round(screen.height||layoutHeight),dpr:Number(devicePixelRatio)||1,fontProbeWidth:Number(fontProbe.width.toFixed(3))||0,fontProbeHeight:Number(fontProbe.height.toFixed(3))||0,fontName:String(cfg?.fontFamily||'Inter')};
  heartbeatMetricsDirty=false;return heartbeatMetricsCache;
}
const refreshHeartbeatPerformanceCache=()=>{heartbeatPerformanceCache=LibreDisplayRuntime.getModule('performance').frontendPerformanceSnapshot();heartbeatPerformanceCacheAt=Date.now();heartbeatPerformanceRefreshPending=false;return heartbeatPerformanceCache;};
const heartbeatPerformanceSnapshot=(force=false)=>{const performance=LibreDisplayRuntime.getModule('performance'),stale=!heartbeatPerformanceCache||Date.now()-heartbeatPerformanceCacheAt>=HEARTBEAT_PERFORMANCE_CACHE_MS;if(force||!heartbeatPerformanceCache)return refreshHeartbeatPerformanceCache();if(stale&&!heartbeatPerformanceRefreshPending){heartbeatPerformanceRefreshPending=true;performance.runWhenIdle(()=>{try{refreshHeartbeatPerformanceCache();}catch(_e){heartbeatPerformanceRefreshPending=false;}},1600);}return heartbeatPerformanceCache;};
let physicalLayoutPreviewId='',physicalLayoutPreviewRevision=0,physicalLayoutPreviewLeaseTimer=null;
let physicalLayoutPreviewFitReadyRevision=-1,physicalLayoutPreviewFitTimers=[];
function clearPhysicalLayoutPreviewFitTimers(){for(const timer of physicalLayoutPreviewFitTimers)clearTimeout(timer);physicalLayoutPreviewFitTimers=[];}
function schedulePhysicalLayoutPreviewFitTelemetry(previewId,revision){
  clearPhysicalLayoutPreviewFitTimers();
  const requestedAt=Date.now();
  let stableSignature='',stableSamples=0;
  const check=attempt=>{
    if(physicalLayoutPreviewId!==previewId||physicalLayoutPreviewRevision!==revision)return;
    const state=LibreDisplayRuntime.getModule('layout')?.builtInLayoutAutoFitSnapshot?.();
    const idle=state&&!state.suspended&&!state.processing&&!state.deferredPending&&!state.idlePending&&
      Array.isArray(state.pending)&&state.pending.length===0;
    // When every block has fitContent disabled, the original auto-fit worker
    // takes an early-return path without updating lastAt. It can be idle and
    // correctly rendered forever, yet the old gate never marked it ready.
    const signature=idle?JSON.stringify(capturePhysicalFitMetrics().values):'';
    if(idle&&signature===stableSignature)stableSamples++;else{stableSignature=signature;stableSamples=idle?1:0;}
    const settled=idle&&(Number(state.lastAt)>=requestedAt||
      (Date.now()-requestedAt>=800&&stableSamples>=3));
    if(settled){
      clearPhysicalLayoutPreviewFitTimers();
      physicalLayoutPreviewFitReadyRevision=revision;
      scheduleDisplayHeartbeat(0);
      return;
    }
    // Do not mark an unfinished Pi layout as authoritative. On a heavily
    // loaded kiosk the editor stays pending rather than accepting stale fit.
    if(attempt<74)physicalLayoutPreviewFitTimers.push(setTimeout(()=>check(attempt+1),attempt<5?160:300));
    else clearPhysicalLayoutPreviewFitTimers();
  };
  physicalLayoutPreviewFitTimers.push(setTimeout(()=>check(0),160));
}
const PHYSICAL_LAYOUT_PREVIEW_LEASE_MS=16000;
function roundedLayoutRenderRect(rect){return rect?{x:Number(rect.left.toFixed(2)),y:Number(rect.top.toFixed(2)),w:Number(rect.width.toFixed(2)),h:Number(rect.height.toFixed(2))}:null;}
function layoutRenderElementVisible(el){if(!el||!el.isConnected)return false;const st=getComputedStyle(el);if(st.display==='none'||st.visibility==='hidden'||Number(st.opacity)===0)return false;const r=el.getBoundingClientRect();return r.width>.5&&r.height>.5;}
function layoutRenderVisualRect(root){if(!layoutRenderElementVisible(root))return null;const rr=root.getBoundingClientRect();let left=rr.left,top=rr.top,right=rr.right,bottom=rr.bottom,count=0;for(const el of root.querySelectorAll('*')){if(++count>320)break;if(el.closest?.('#ld-physical-parity-overlay,#layout-editor-layer,#layout-toolbar,#layout-properties'))continue;if(!layoutRenderElementVisible(el))continue;const r=el.getBoundingClientRect();if(!Number.isFinite(r.left)||r.width<.5||r.height<.5)continue;left=Math.min(left,r.left);top=Math.min(top,r.top);right=Math.max(right,r.right);bottom=Math.max(bottom,r.bottom);}return roundedLayoutRenderRect({left,top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)});}
function captureLayoutRenderSnapshot(previewId=physicalLayoutPreviewId,revision=physicalLayoutPreviewRevision){const layout=LibreDisplayRuntime.getModule('layout'),defs=layout?.LAYOUT_BLOCK_DEFS||{},entities=[];for(const [key,def] of Object.entries(defs)){const el=document.querySelector(def.selector);if(!layoutRenderElementVisible(el))continue;entities.push({key,label:String(def.label||key).slice(0,80),footprint:roundedLayoutRenderRect(el.getBoundingClientRect()),visual:layoutRenderVisualRect(el)});}for(const el of document.querySelectorAll('.custom-block[data-block-id]')){if(!layoutRenderElementVisible(el))continue;const id=String(el.dataset.blockId||'').slice(0,120);if(!id)continue;const title=el.querySelector('.custom-block-title')?.textContent?.trim();entities.push({key:'custom:'+id,label:String(title||el.getAttribute('aria-label')||'Custom block').slice(0,80),footprint:roundedLayoutRenderRect(el.getBoundingClientRect()),visual:layoutRenderVisualRect(el)});}const overlaps=[];for(let i=0;i<entities.length;i++)for(let j=i+1;j<entities.length;j++){const a=entities[i].visual||entities[i].footprint,b=entities[j].visual||entities[j].footprint;if(!a||!b)continue;const w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(w>2&&h>2&&w*h>=16)overlaps.push({a:entities[i].key,b:entities[j].key,w:Number(w.toFixed(2)),h:Number(h.toFixed(2)),area:Number((w*h).toFixed(1))});}const vp=displayViewportMetrics(),offscreen=[];for(const row of entities){const x=row.visual||row.footprint;if(x&&(x.x<-2||x.y<-2||x.x+x.w>vp.layoutWidth+2||x.y+x.h>vp.layoutHeight+2))offscreen.push(row.key);}return {previewId:String(previewId||'').slice(0,96),revision:Math.max(0,Math.round(Number(revision)||0)),width:vp.layoutWidth,height:vp.layoutHeight,entities:entities.slice(0,160),overlaps:overlaps.slice(0,320),offscreen:offscreen.slice(0,160),capturedAt:Date.now()};}
function armPhysicalLayoutPreviewLease(){clearTimeout(physicalLayoutPreviewLeaseTimer);physicalLayoutPreviewLeaseTimer=setTimeout(()=>{physicalLayoutPreviewLeaseTimer=null;clearPhysicalLayoutPreviewCommand({previewId:physicalLayoutPreviewId,expired:true});},PHYSICAL_LAYOUT_PREVIEW_LEASE_MS);}
async function loadAuthoritativePhysicalConfig(){const res=await resilientFetch(serverPath('/api/config'),{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);const data=await res.json(),remote=data?.config;if(!remote||typeof remote!=='object')throw new Error('Saved display configuration unavailable');const savedAt=Number(remote._savedAt||data?.savedAt||0),migrated=configApi.migrateConfigSnapshot(remote);cfg={...configApi.CFG_DEFAULTS,...migrated,_savedAt:savedAt};ensureCfgDefaults();try{localStorage.setItem(bootstrapApi.CFG_KEY,JSON.stringify(cfg));}catch(e){}return savedAt;}
function applyPhysicalLayoutPreviewCommand(command={}){if(!bootstrapApi.LOCAL_CLIENT_MODE)return false;const previewId=String(command.previewId||'').replace(/[^A-Za-z0-9_-]+/g,'-').slice(0,96),revision=Math.max(0,Math.round(Number(command.previewRevision)||0)),preview=command.layoutPreview;if(!previewId||!preview||typeof preview!=='object')return false;if(physicalLayoutPreviewId===previewId&&physicalLayoutPreviewRevision===revision){armPhysicalLayoutPreviewLease();if(physicalLayoutPreviewFitReadyRevision!==revision&&!physicalLayoutPreviewFitTimers.length)schedulePhysicalLayoutPreviewFitTelemetry(previewId,revision);scheduleDisplayHeartbeat(40);return true;}clearPhysicalLayoutPreviewFitTimers();physicalLayoutPreviewFitReadyRevision=-1;const keys=['layoutMode','layoutBlocks','layoutContentScale','layoutElementStyle','layoutPartStyle','currentWeatherLayout','currentWeatherPartLayout','customBlocks','layoutGridPx','layoutSnap'];for(const key of keys)if(Object.prototype.hasOwnProperty.call(preview,key))cfg[key]=JSON.parse(JSON.stringify(preview[key]));ensureCfgDefaults();physicalLayoutPreviewId=previewId;physicalLayoutPreviewRevision=revision;armPhysicalLayoutPreviewLease();try{LibreDisplayRuntime.getModule('blocks').renderCustomBlocks(cfg.customBlocks||[]);}catch(e){}try{const effective=LibreDisplayRuntime.getModule('performance').effectiveVisualConfig(cfg);LibreDisplayRuntime.getModule('appearance').applyUiCustomization(effective);}catch(e){LibreDisplayRuntime.getModule('appearance').applyUiCustomization(cfg);}setTimeout(()=>{try{LibreDisplayRuntime.getModule('layout').applyBuiltInPartFlowOffsets?.(cfg);LibreDisplayRuntime.getModule('layout').scheduleBuiltInLayoutAutoFitDeferred?.();}catch(e){}scheduleDisplayHeartbeat(0);schedulePhysicalLayoutPreviewFitTelemetry(previewId,revision);},80);return true;}
async function clearPhysicalLayoutPreviewCommand(command={}){if(!bootstrapApi.LOCAL_CLIENT_MODE)return false;const requested=String(command.previewId||'');if(requested&&physicalLayoutPreviewId&&requested!==physicalLayoutPreviewId)return false;clearTimeout(physicalLayoutPreviewLeaseTimer);physicalLayoutPreviewLeaseTimer=null;clearPhysicalLayoutPreviewFitTimers();physicalLayoutPreviewFitReadyRevision=-1;physicalLayoutPreviewId='';physicalLayoutPreviewRevision=0;try{await loadAuthoritativePhysicalConfig();LibreDisplayRuntime.getModule('blocks').renderCustomBlocks(cfg.customBlocks||[]);LibreDisplayRuntime.getModule('settings').applySettings();setTimeout(()=>scheduleDisplayHeartbeat(0),80);return true;}catch(e){setTimeout(()=>location.reload(),0);return false;}}

let physicalConfigApplyPromise=null,physicalConfigApplyTarget=0;
const waitForPhysicalConfigApply=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function applyPhysicalDisplayConfigCommand(command={}){
  if(!bootstrapApi.LOCAL_CLIENT_MODE)return false;
  const targetSavedAt=Math.max(0,Number(command?.targetSavedAt)||0);
  if(physicalConfigApplyPromise&&targetSavedAt&&physicalConfigApplyTarget===targetSavedAt)return physicalConfigApplyPromise;
  physicalConfigApplyTarget=targetSavedAt;
  const task=(async()=>{
    clearTimeout(physicalLayoutPreviewLeaseTimer);physicalLayoutPreviewLeaseTimer=null;physicalLayoutPreviewId='';physicalLayoutPreviewRevision=0;
    for(let attempt=0;attempt<6;attempt++){
      try{await loadAuthoritativePhysicalConfig();}catch(e){await pollServerConfig({force:true});}
      const loadedSavedAt=Math.max(0,Number(cfg?._savedAt)||0);
      if(!targetSavedAt||loadedSavedAt>=targetSavedAt){
        // Re-apply even when the config version was already loaded. This closes the
        // remote-Arrange gap where dynamic DOM (notably Weather Alerts) could still
        // be rendering the previous geometry after a verified server save.
        LibreDisplayRuntime.getModule('settings').applySettings();
        setTimeout(()=>{try{LibreDisplayRuntime.getModule('layout').applyBuiltInPartFlowOffsets?.(cfg);}catch(_e){}scheduleDisplayHeartbeat(0);},40);
        return true;
      }
      await waitForPhysicalConfigApply(180+attempt*120);
    }
    // Fail closed to a full kiosk reload if the expected server version did not
    // arrive quickly. The durable heartbeat command remains queued until the new
    // configSavedAt is observed, so this cannot silently acknowledge stale state.
    setTimeout(()=>location.reload(),0);
    return false;
  })();
  physicalConfigApplyPromise=task.finally(()=>{physicalConfigApplyPromise=null;physicalConfigApplyTarget=0;});
  return physicalConfigApplyPromise;
}
function dispatchPendingPhysicalDisplayCommand(command){
  if(!bootstrapApi.LOCAL_CLIENT_MODE||!command)return false;
  const action=String(command.action||'');
  if(action==='apply-config'){setTimeout(()=>applyPhysicalDisplayConfigCommand(command),0);return true;}
  if(action==='reload'){setTimeout(()=>location.reload(),0);return true;}
  if(action==='refresh'){setTimeout(()=>{LibreDisplayRuntime.getModule('settings').refreshDataNow();scheduleDisplayHeartbeat(40);},0);return true;}
  if(action==='preview-layout'){setTimeout(()=>applyPhysicalLayoutPreviewCommand(command),0);return true;}
  if(action==='clear-layout-preview'){setTimeout(()=>clearPhysicalLayoutPreviewCommand(command),0);return true;}
  if(action!=='performance-benchmark')return false;
  const requestId=String(command.requestId||'').replace(/[^A-Za-z0-9_-]+/g,'-').slice(0,96);if(!requestId)return false;
  const currentId=String(physicalDisplayBenchmarkState?.requestId||''),currentState=String(physicalDisplayBenchmarkState?.state||'');
  if(currentId===requestId&&['running','complete','error'].includes(currentState))return false;
  const event={data:JSON.stringify(command)};setTimeout(()=>LibreDisplayRuntime.getModule('performance').runExclusiveTask('display-performance-benchmark',()=>runPhysicalDisplayBenchmarkRequest(event)),0);return true;
}
async function sendDisplayHeartbeat(connectivityRecovered=false,options={}){if(!bootstrapApi.READ_ONLY_DISPLAY_MODE&&!bootstrapApi.LOCAL_CLIENT_MODE)return;try{const force=options?.full===true,m=displayViewportMetrics(force),frontendPerformance={...heartbeatPerformanceSnapshot(force),connectivity:connectivitySnapshot()};const response=await resilientFetch(serverPath('/api/device-heartbeat'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:displayDeviceId(),...m,mode:bootstrapApi.READ_ONLY_DISPLAY_MODE?'viewer':(bootstrapApi.LOCAL_CLIENT_MODE?'local':'admin'),version:bootstrapApi.DASHBOARD_BUILD,userAgent:navigator.userAgent,configSavedAt:Number(cfg?._savedAt||0),frontendPerformance,providerCache:staleCacheSnapshot(),displayPerformanceBenchmark:bootstrapApi.LOCAL_CLIENT_MODE?physicalDisplayBenchmarkState:undefined,layoutPreviewId:bootstrapApi.LOCAL_CLIENT_MODE?physicalLayoutPreviewId:'',layoutRenderSnapshot:bootstrapApi.LOCAL_CLIENT_MODE&&physicalLayoutPreviewId?captureLayoutRenderSnapshot():undefined,layoutFitMetrics:bootstrapApi.LOCAL_CLIENT_MODE?capturePhysicalFitMetrics():undefined,connectivityRecovered:!!connectivityRecovered}),cache:'no-store'},{timeoutMs:5000,retry:false});if(response.ok&&bootstrapApi.LOCAL_CLIENT_MODE){const payload=await response.json().catch(()=>({}));dispatchPendingPhysicalDisplayCommand(payload?.pendingCommand);}}catch(e){}}
function parseDisplayBenchmarkEvent(event){try{return JSON.parse(String(event?.data||'{}'))||{};}catch{return {};}}
async function runPhysicalDisplayBenchmarkRequest(event){
  if(!bootstrapApi.LOCAL_CLIENT_MODE)return;
  const request=parseDisplayBenchmarkEvent(event),requestId=String(request.requestId||'').replace(/[^A-Za-z0-9_-]+/g,'-').slice(0,96)||('bench-'+Date.now().toString(36));
  const requestedAt=Number(request.requestedAt)||Math.floor(Date.now()/1000),startedAt=new Date().toISOString(),performance=LibreDisplayRuntime.getModule('performance'),stageTotal=Math.max(1,Number(performance.displayBenchmarkStageCount?.())||1);
  physicalDisplayBenchmarkState={requestId,state:'running',requestedAt:new Date(requestedAt*1000).toISOString(),startedAt,stageKey:'preparing',stageLabel:'Preparing physical display benchmark',stageIndex:0,stageTotal};
  await sendDisplayHeartbeat(false,{full:true});
  try{
    const result=await performance.runDisplayPerformanceBenchmark({onStage:stage=>{physicalDisplayBenchmarkState={...physicalDisplayBenchmarkState,state:'running',stageKey:stage.key||'',stageLabel:stage.label||'',stageIndex:Number(stage.index)||0,stageTotal:Number(stage.total)||stageTotal};}});
    physicalDisplayBenchmarkState={requestId,state:'complete',requestedAt:physicalDisplayBenchmarkState.requestedAt,startedAt,resultStartedAt:result.startedAt||startedAt,finishedAt:result.finishedAt||new Date().toISOString(),stageKey:'complete',stageLabel:'Completed',stageIndex:stageTotal,stageTotal,result};
  }catch(error){
    physicalDisplayBenchmarkState={requestId,state:'error',requestedAt:physicalDisplayBenchmarkState?.requestedAt||new Date(requestedAt*1000).toISOString(),startedAt,finishedAt:new Date().toISOString(),stageKey:'error',stageLabel:'Failed',stageIndex:0,stageTotal,error:String(error?.message||error||'Display benchmark failed').slice(0,400)};
  }
  await sendDisplayHeartbeat(false,{full:true});
}
function scheduleDisplayHeartbeat(delay=100){if(!bootstrapApi.READ_ONLY_DISPLAY_MODE&&!bootstrapApi.LOCAL_CLIENT_MODE)return;heartbeatMetricsDirty=true;if(heartbeatResizeTimer)clearTimeout(heartbeatResizeTimer);heartbeatResizeTimer=setTimeout(()=>{heartbeatResizeTimer=null;LibreDisplayRuntime.getModule('performance').runExclusiveTask('display-heartbeat',()=>sendDisplayHeartbeat(false,{full:true}));},Math.max(0,delay));}
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
    liveEventSource.addEventListener('config',()=>LibreDisplayRuntime.getModule('performance').runExclusiveTask('remote-config-poll',pollServerConfig));liveEventSource.addEventListener('household',async()=>{await loadHousehold(false);refreshFamilyBlocks();});liveEventSource.addEventListener('refresh',()=>{if(bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LOCAL_CLIENT_MODE){LibreDisplayRuntime.getModule('settings').refreshDataNow();scheduleDisplayHeartbeat(40);}});liveEventSource.addEventListener('heartbeat',()=>{if(bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LOCAL_CLIENT_MODE)scheduleDisplayHeartbeat(0);});liveEventSource.addEventListener('apply-config',event=>{if(bootstrapApi.LOCAL_CLIENT_MODE){const command=parseDisplayBenchmarkEvent(event);dispatchPendingPhysicalDisplayCommand({action:'apply-config',...command});}});liveEventSource.addEventListener('preview-layout',event=>{if(bootstrapApi.LOCAL_CLIENT_MODE){const command=parseDisplayBenchmarkEvent(event);dispatchPendingPhysicalDisplayCommand({action:'preview-layout',...command});}});liveEventSource.addEventListener('clear-layout-preview',event=>{if(bootstrapApi.LOCAL_CLIENT_MODE){const command=parseDisplayBenchmarkEvent(event);dispatchPendingPhysicalDisplayCommand({action:'clear-layout-preview',...command});}});liveEventSource.addEventListener('performance-benchmark',event=>{if(bootstrapApi.LOCAL_CLIENT_MODE){const command=parseDisplayBenchmarkEvent(event);dispatchPendingPhysicalDisplayCommand({action:'performance-benchmark',...command});}});liveEventSource.addEventListener('reload',()=>{if(bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LOCAL_CLIENT_MODE)location.reload();});liveEventSource.addEventListener('reauth',()=>location.reload());
  }catch(e){noteServerTransportError();}
  const performance=LibreDisplayRuntime.getModule('performance');
  bindDisplayViewportHeartbeat();startPhysicalFitHeartbeatMonitor();performance.runExclusiveTask('display-heartbeat',()=>sendDisplayHeartbeat(false,{full:true}));
  performance.stopManagedInterval('display-heartbeat');
  heartbeatTimer=performance.startManagedInterval('display-heartbeat',sendDisplayHeartbeat,30000,{skipWhenHidden:false,resumeOnVisible:false,initialDelayMs:30000,idle:true,idleTimeoutMs:bootstrapApi.LOCAL_CLIENT_MODE?6000:2200});
  updateOfflinePill();
}
function startRemoteConfigPolling(){const performance=LibreDisplayRuntime.getModule('performance'),editor=bootstrapApi.REMOTE_SETTINGS_MODE,physical=bootstrapApi.LOCAL_CLIENT_MODE,interval=editor?5000:(physical?120000:45000);performance.stopManagedInterval('remote-config-poll');configApi.remoteConfigPollTimer=performance.startManagedInterval('remote-config-poll',pollServerConfig,interval,{skipWhenHidden:true,resumeOnVisible:true,immediate:editor,initialDelayMs:editor?5000:(physical?45000:17000),idle:!editor,idleTimeoutMs:physical?4200:1800});}

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


// Remote Owner view: show compositor pixels at the kiosk's native CSS geometry.
// Do not render a scaled screenshot or a separate browser approximation as Pi.
let nativePiViewTimer=null,nativePiViewUrl='',nativePiViewBusy=false,nativePiViewActive=false,nativePiViewDevice='',nativePiViewGeometry='';
function nativePiArrangeIsActive(){
  return document.body.classList.contains('layout-editing')||document.body.classList.contains('remote-layout-proxy')||!!document.getElementById('remote-layout-preview-shell')?.classList.contains('show');
}
async function refreshNativeRemotePiView(){
  if(!nativePiViewActive||nativePiViewBusy)return;
  if(document.hidden||nativePiArrangeIsActive()){
    nativePiViewTimer=setTimeout(refreshNativeRemotePiView,2500);return;
  }
  nativePiViewBusy=true;let candidateUrl='';
  try{
    const layout=LibreDisplayRuntime.getModule('layout');
    const devices=await layout.readDisplayDevices();
    const row=layout.bestLayoutTargetDevice(devices);
    const target=layout.targetViewportFromDevice(row);
    if(!target?.physical||!target.online||!target.deviceId)throw new Error('Physical Pi heartbeat unavailable');
    const geometry=target.width+'x'+target.height+'@'+target.dpr;
    if(nativePiViewUrl&&(nativePiViewDevice!==target.deviceId||nativePiViewGeometry!==geometry)){
      URL.revokeObjectURL(nativePiViewUrl);nativePiViewUrl='';
      const oldImage=document.getElementById('ld-native-pi-image'),oldLayer=document.getElementById('ld-native-pi-view');
      if(oldImage)oldImage.removeAttribute('src');if(oldLayer)oldLayer.hidden=true;
      document.documentElement.classList.remove('ld-native-pi-view');
    }
    const response=await resilientFetch(serverPath('/api/physical-screen'),{cache:'no-store',headers:{'X-LibreDisplay-Capture-Device':target.deviceId}},{timeoutMs:15000,retry:false});
    if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||('HTTP '+response.status));}
    if(response.headers.get('X-LibreDisplay-Device-Id')!==target.deviceId||response.headers.get('X-LibreDisplay-Endpoint')!==bootstrapApi.ACTIVE_ENDPOINT)throw new Error('Wrong physical Pi capture identity');
    const blob=await response.blob();if(blob.type!=='image/png'||blob.size<64||blob.size>16000000)throw new Error('Invalid physical Pi PNG');
    candidateUrl=URL.createObjectURL(blob);
    const candidate=new Image();candidate.src=candidateUrl;await candidate.decode();
    if(Math.abs(candidate.naturalWidth-Math.round(target.width*target.dpr))>2||Math.abs(candidate.naturalHeight-Math.round(target.height*target.dpr))>2)
      throw new Error('Pi framebuffer size differs from kiosk viewport');
    if(!nativePiViewActive||nativePiArrangeIsActive())return;
    const layer=document.getElementById('ld-native-pi-view'),image=document.getElementById('ld-native-pi-image'),status=document.getElementById('ld-native-pi-status');
    if(!layer||!image||!status)return;
    layer.style.width=target.width+'px';layer.style.height=target.height+'px';
    image.style.width=target.width+'px';image.style.height=target.height+'px';
    if(nativePiViewUrl)URL.revokeObjectURL(nativePiViewUrl);
    nativePiViewUrl=candidateUrl;candidateUrl='';nativePiViewDevice=target.deviceId;nativePiViewGeometry=geometry;
    image.src=nativePiViewUrl;layer.hidden=false;status.hidden=true;status.textContent='';
    document.documentElement.style.setProperty('--ld-native-pi-width',target.width+'px');
    document.documentElement.style.setProperty('--ld-native-pi-height',target.height+'px');
    document.documentElement.classList.add('ld-native-pi-view');
  }catch(e){
    const status=document.getElementById('ld-native-pi-status');
    if(status){status.textContent=nativePiViewUrl?'Pi image is stale · capture unavailable':'Pi capture unavailable · local browser view is unverified';status.hidden=false;}
  }finally{
    if(candidateUrl)URL.revokeObjectURL(candidateUrl);
    nativePiViewBusy=false;
    clearTimeout(nativePiViewTimer);
    if(nativePiViewActive)nativePiViewTimer=setTimeout(refreshNativeRemotePiView,2500);
  }
}
function startNativeRemotePiView(){
  if(nativePiViewActive||bootstrapApi.LOCAL_CLIENT_MODE||bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LAYOUT_PREVIEW_MODE||bootstrapApi.SESSION_ROLE!=='owner')return;
  nativePiViewActive=true;
  const layer=document.createElement('div');layer.id='ld-native-pi-view';layer.hidden=true;layer.setAttribute('aria-label','Physical Raspberry Pi screen at native CSS size');
  const image=document.createElement('img');image.id='ld-native-pi-image';image.alt='Captured pixels from the physical Raspberry Pi display';image.draggable=false;
  const status=document.createElement('div');status.id='ld-native-pi-status';status.setAttribute('role','status');status.hidden=true;
  layer.appendChild(image);document.body.append(layer,status);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&nativePiViewActive){clearTimeout(nativePiViewTimer);nativePiViewTimer=setTimeout(refreshNativeRemotePiView,30);}});
  void refreshNativeRemotePiView();
}


// Native CSS-sized live Owner view. It is the *existing* continuously rendered
// dashboard in a fixed-size frame, not a screenshot or a Pi-video stream.
let ownerLiveViewportTimer=null,ownerLiveViewportBusy=false,ownerLiveViewportDevice='';
async function refreshNativeOwnerLiveViewport(){
  if(ownerLiveViewportBusy||bootstrapApi.LOCAL_CLIENT_MODE||bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LAYOUT_PREVIEW_MODE||bootstrapApi.PAGE_PARAMS.get('nativeLive')==='1'||bootstrapApi.SESSION_ROLE!=='owner')return;
  ownerLiveViewportBusy=true;
  try{
    const layout=LibreDisplayRuntime.getModule('layout');
    const row=layout.bestLayoutTargetDevice(await layout.readDisplayDevices());
    const target=layout.targetViewportFromDevice(row);
    if(!target?.physical||!target.online||!target.deviceId)return;
    const w=target.width,h=target.height;
    let frame=document.getElementById('ld-native-live-frame');
    if(!frame){
      frame=document.createElement('iframe');frame.id='ld-native-live-frame';frame.title='Live LibreDisplay dashboard at physical Pi viewport';
      frame.setAttribute('scrolling','no');frame.setAttribute('aria-label','Live LibreDisplay at native Pi display dimensions');
      frame.addEventListener('load',()=>{void refreshNativeOwnerLiveViewport();});
      document.body.appendChild(frame);
    }
    frame.width=String(w);frame.height=String(h);frame.style.width=w+'px';frame.style.height=h+'px';
    document.documentElement.style.setProperty('--ld-live-width',w+'px');
    document.documentElement.style.setProperty('--ld-live-height',h+'px');
    document.documentElement.classList.add('ld-native-live-parent');
    postPhysicalParityToFrame(frame,row);
    if(ownerLiveViewportDevice!==target.deviceId||!frame.getAttribute('src')){
      ownerLiveViewportDevice=target.deviceId;
      frame.src='/dashboard.html?'+new URLSearchParams({endpoint:bootstrapApi.ACTIVE_ENDPOINT,nativeLive:'1'}).toString();
    }
  }catch(_e){/* Leave the original live browser dashboard available without claiming native parity. */}
  finally{ownerLiveViewportBusy=false;}
}
function startNativeOwnerLiveViewport(){
  if(bootstrapApi.LOCAL_CLIENT_MODE||bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LAYOUT_PREVIEW_MODE||bootstrapApi.PAGE_PARAMS.get('nativeLive')==='1'||bootstrapApi.SESSION_ROLE!=='owner')return;
  void refreshNativeOwnerLiveViewport();
  // Receive the Pi's newly settled measurements within a few seconds, not the
  // old 10s Owner polling window on top of a 30s physical heartbeat.
  if(!ownerLiveViewportTimer)ownerLiveViewportTimer=setInterval(()=>{if(!document.hidden)void refreshNativeOwnerLiveViewport();},2500);
}

// The nested live dashboard and Arrange iframe run in another browser engine.
// Authoritative Pi fit factors belong to the DISPLAY CONTENT only: never scale
// its outer iframe or change the stored normalized Arrange rectangles.
const PHYSICAL_PARITY_MESSAGE='libredisplay-physical-fit-v1';
const physicalParityFrameState=new WeakMap();
function postPhysicalParityToFrame(frame,row,arrangeRevision=null){
  if(!frame||!row||!row.online||row.mode!=='local')return false;
  // Arrange only accepts the physical measurements of its own draft revision.
  if(frame.id==='remote-layout-preview-frame'&&!arrangeRevision?.previewId)return false;
  const metrics=row.layoutFitMetrics;
  const width=Math.round(Number(row.layoutWidth||row.width)||0),height=Math.round(Number(row.layoutHeight||row.height)||0);
  if(width<320||height<200||Number(row.ageSeconds)>45||!metrics||Math.abs(Number(metrics.width)-width)>2||Math.abs(Number(metrics.height)-height)>2)return false;
  const payload={type:PHYSICAL_PARITY_MESSAGE,endpoint:bootstrapApi.ACTIVE_ENDPOINT,width,height,deviceId:String(row.deviceId||''),sentAt:Date.now(),capturedAt:Number(metrics.capturedAt)||0,values:metrics.values||{},fontName:String(row.fontName||''),fontProbeWidth:Number(row.fontProbeWidth)||0,fontProbeHeight:Number(row.fontProbeHeight)||0,...(arrangeRevision||{})};
  physicalParityFrameState.set(frame,payload);
  if(!frame.__ldPhysicalParityLoadBound){
    frame.__ldPhysicalParityLoadBound=true;
    frame.addEventListener('load',()=>{const next=physicalParityFrameState.get(frame);if(next)frame.contentWindow?.postMessage(next,location.origin);});
  }
  if(frame.contentWindow&&frame.contentDocument?.readyState==='complete')frame.contentWindow.postMessage(payload,location.origin);
  return true;
}
// A saved-layout Arrange draft may borrow the *already applied* fit from the
// matching Owner live child while the Pi's draft-specific proof is pending.
// This is a visual seed only, never physical verification or a config write.
function seedArrangePhysicalFitFromLive(previewId,previewRevision,deviceId){
  const live=document.getElementById('ld-native-live-frame'),frame=document.getElementById('remote-layout-preview-frame');
  if(!live?.contentWindow||!frame?.contentWindow||!previewId||!deviceId)return false;
  const payload=physicalParityFrameState.get(live),applied=live.contentWindow.__ldPhysicalParityStatus;
  if(!payload||payload.deviceId!==deviceId||!applied||applied.capturedAt!==payload.capturedAt||
     Date.now()-Number(payload.capturedAt)>45000)return false;
  const width=Math.round(Number(frame.width)||0),height=Math.round(Number(frame.height)||0);
  if(payload.width!==width||payload.height!==height||
     Math.abs(frame.contentDocument?.documentElement?.clientWidth-width)>2||
     Math.abs(frame.contentDocument?.documentElement?.clientHeight-height)>2)return false;
  try{
    const liveCfg=live.contentWindow.LibreDisplayRuntime?.getModule('config')?.cfg;
    const innerCfg=frame.contentWindow.LibreDisplayRuntime?.getModule('config')?.cfg;
    const draft=frame.contentWindow.LibreDisplayRuntime?.getModule('layout')?.layoutEditorPreviewState?.();
    if(!liveCfg||!innerCfg||!draft||Number(liveCfg._savedAt)!==Number(innerCfg._savedAt))return false;
    // Never reuse saved-fit factors for a changed rectangle or style draft.
    // Normalize object key order; imported configs can have equivalent values
    // in a different property order from the editor's canonical block order.
    const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?
      Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
    for(const key of ['layoutMode','layoutBlocks','layoutContentScale','layoutElementStyle','layoutPartStyle','currentWeatherLayout','currentWeatherPartLayout','customBlocks']){
      if(JSON.stringify(canonical(draft[key]))!==JSON.stringify(canonical(liveCfg[key])))return false;
    }
  }catch(_e){return false;}
  const current=frame.contentWindow.__ldPhysicalParityStatus;
  if(current?.previewId===previewId&&Number(current.previewRevision)===previewRevision&&!current.previewSeed)return false;
  frame.contentWindow.postMessage({...payload,sentAt:Date.now(),previewId,previewRevision,previewSeed:true},location.origin);
  return true;
}
function postPhysicalParityToArrangeRevision(row,previewId,previewRevision){
  const frame=document.getElementById('remote-layout-preview-frame'),snapshot=row?.layoutRenderSnapshot,fit=row?.layoutFitMetrics;
  if(!frame||!frame.isConnected||!frame.contentWindow||String(row?.layoutPreviewId||'')!==previewId||String(snapshot?.previewId||'')!==previewId)return false;
  if(Number(snapshot?.revision)!==previewRevision||String(fit?.previewId||'')!==previewId||Number(fit?.previewRevision)!==previewRevision||fit?.previewSettled!==true)return false;
  if(!(Number(snapshot?.capturedAt)>0&&Number(fit?.capturedAt)>0)||Math.abs(Number(snapshot.capturedAt)-Number(fit.capturedAt))>2000)return false;
  return postPhysicalParityToFrame(frame,row,{previewId,previewRevision});
}
function clearPhysicalParityArrangeFrame(){
  const frame=document.getElementById('remote-layout-preview-frame');if(!frame?.contentWindow)return;
  physicalParityFrameState.delete(frame);
  frame.contentWindow.postMessage({type:'libredisplay-physical-fit-clear-v1',endpoint:bootstrapApi.ACTIVE_ENDPOINT,sentAt:Date.now()},location.origin);
}
let physicalParityLastAt=0,physicalParityPending=null,physicalParityReplayTimer=null,physicalParityReplayGeneration=0;
function applyPhysicalFontMatch(payload){
  const app=document.getElementById('app'),appearance=LibreDisplayRuntime.getModule('appearance');
  if(!app||!appearance?.measureDashboardFontProbe)return;
  const requested=String(payload.fontName||'Inter'),source=String(cfg?.fontFamily||'Inter');
  if(requested!==source){
    app.style.removeProperty('font-family');
    document.getElementById('alert-zone')?.style.removeProperty('font-family');
    window.__ldLastPhysicalParityFont='';
    return;
  }
  const pw=Number(payload.fontProbeWidth),ph=Number(payload.fontProbeHeight);
  if(!(pw>50&&ph>1))return;
  const families=source==='Inter'?['Inter','Noto Sans','DejaVu Sans','Liberation Sans','system']:
    source==='Noto Sans'?['Noto Sans','DejaVu Sans','Liberation Sans','system']:
    source==='DejaVu Sans'?['DejaVu Sans','Liberation Sans','system']:
    source==='system'?['system','Noto Sans','DejaVu Sans','Liberation Sans']:[source];
  const errors=[];
  for(const family of families){
    const m=appearance.measureDashboardFontProbe(family),w=Number(m.width),h=Number(m.height);
    if(!(w>0&&h>0))continue;
    const widthError=Math.abs(w/pw-1),heightError=Math.abs(h/ph-1);
    errors.push({family,widthError,heightError,score:widthError*.85+heightError*.15});
  }
  if(!errors.length)return;
  errors.sort((a,b)=>a.score-b.score);
  const original=errors.find(x=>x.family===source)||errors[0],best=errors[0];
  const accepted=best.score<.045&&best.score+0.008<original.score?best:original;
  const css=appearance.fontCssValue(accepted.family);
  app.style.fontFamily=css;
  const alerts=document.getElementById('alert-zone');if(alerts)alerts.style.fontFamily=css;
  window.__ldPhysicalParityFont={requested,chosen:accepted.family,piWidth:pw,piHeight:ph,remoteWidth:appearance.measureDashboardFontProbe(accepted.family).width,error:accepted.score,candidates:errors};
  if(accepted.family!==window.__ldLastPhysicalParityFont){
    window.__ldLastPhysicalParityFont=accepted.family;
    LibreDisplayRuntime.getModule('layout')?.scheduleBuiltInLayoutAutoFitDeferred?.(undefined,140);
  }
}
function applyPendingPhysicalParity(){
  const data=physicalParityPending;
  if(!data)return true;
  // Do not acknowledge while initial custom layout / element hydration is
  // incomplete. The old one-shot 1300ms retry often fired too early.
  if(String(cfg?.layoutMode||'')==='custom'&&!document.body.classList.contains('custom-layout'))return false;
  for(const [key,selector] of Object.entries(PHYSICAL_FIT_BLOCKS)){
    if(Object.prototype.hasOwnProperty.call(data.values||{},key)&&!document.querySelector(selector))return false;
  }
  for(const [key,selector] of Object.entries(PHYSICAL_FIT_BLOCKS)){
    const el=document.querySelector(selector);if(!el)continue;
    const fit=Number(data.values?.[key]);
    if(document.body.classList.contains('custom-layout')&&Number.isFinite(fit)&&fit>=.15&&fit<=1)el.style.setProperty('--ld-physical-fit-'+key,fit.toFixed(4));
    else el.style.removeProperty('--ld-physical-fit-'+key);
  }
  applyPhysicalFontMatch(data);
  physicalParityLastAt=Date.now();
  window.__ldPhysicalParityStatus={deviceId:data.deviceId,at:physicalParityLastAt,piSize:[data.width,data.height],piFit:{...data.values},capturedAt:data.capturedAt,previewId:data.previewId||'',previewRevision:Number(data.previewRevision)||0,previewSeed:data.previewSeed===true};
  physicalParityPending=null;
  return true;
}
function attemptPhysicalParityHydration(generation,attempt=0){
  if(generation!==physicalParityReplayGeneration||!physicalParityPending)return;
  if(applyPendingPhysicalParity())return;
  if(attempt>=49||Date.now()-Number(physicalParityPending.sentAt)>15000){physicalParityPending=null;return;}
  physicalParityReplayTimer=setTimeout(()=>attemptPhysicalParityHydration(generation,attempt+1),200);
}
function acceptPhysicalParityMessage(event){
  if(!(bootstrapApi.PAGE_PARAMS.get('nativeLive')==='1'||bootstrapApi.LAYOUT_PREVIEW_MODE))return;
  if(event.origin!==location.origin||event.source!==window.parent)return;
  const data=event.data;
  if(!data||data.type!==PHYSICAL_PARITY_MESSAGE||data.endpoint!==bootstrapApi.ACTIVE_ENDPOINT)return;
  if(bootstrapApi.LAYOUT_PREVIEW_MODE&&(!data.previewId||!Number.isInteger(Number(data.previewRevision))))return;
  if(!Number.isFinite(data.capturedAt)||data.capturedAt<=0||!Number.isFinite(data.sentAt)||Math.abs(Date.now()-data.sentAt)>15000)return;
  const w=document.documentElement.clientWidth,h=document.documentElement.clientHeight;
  if(Math.abs(Number(data.width)-w)>2||Math.abs(Number(data.height)-h)>2)return;
  clearTimeout(physicalParityReplayTimer);physicalParityPending=data;
  attemptPhysicalParityHydration(++physicalParityReplayGeneration);
}
window.addEventListener('message',acceptPhysicalParityMessage);
window.addEventListener('message',event=>{
  if(!bootstrapApi.LAYOUT_PREVIEW_MODE||event.origin!==location.origin||event.source!==window.parent)return;
  const data=event.data;if(!data||data.type!=='libredisplay-physical-fit-clear-v1'||data.endpoint!==bootstrapApi.ACTIVE_ENDPOINT)return;
  clearTimeout(physicalParityReplayTimer);physicalParityPending=null;physicalParityReplayGeneration++;
  physicalParityLastAt=0;window.__ldPhysicalParityStatus=null;
  for(const [key,selector] of Object.entries(PHYSICAL_FIT_BLOCKS))document.querySelector(selector)?.style.removeProperty('--ld-physical-fit-'+key);
  document.getElementById('app')?.style.removeProperty('font-family');
  document.getElementById('alert-zone')?.style.removeProperty('font-family');
  LibreDisplayRuntime.getModule('layout')?.scheduleBuiltInLayoutAutoFitDeferred?.();
});
// Stale Pi readings must not override future dashboard/Arrange edits.
if(bootstrapApi.PAGE_PARAMS.get('nativeLive')==='1'||bootstrapApi.LAYOUT_PREVIEW_MODE)setInterval(()=>{
  if(!physicalParityLastAt||Date.now()-physicalParityLastAt<46000)return;
  physicalParityLastAt=0;window.__ldPhysicalParityStatus=null;
  for(const [key,selector] of Object.entries(PHYSICAL_FIT_BLOCKS))document.querySelector(selector)?.style.removeProperty('--ld-physical-fit-'+key);
  document.getElementById('app')?.style.removeProperty('font-family');
  document.getElementById('alert-zone')?.style.removeProperty('font-family');
  LibreDisplayRuntime.getModule('layout')?.scheduleBuiltInLayoutAutoFitDeferred?.();
},10000);
// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("remote", {capturePhysicalFitMetrics,postPhysicalParityToArrangeRevision,clearPhysicalParityArrangeFrame,startNativeOwnerLiveViewport,seedArrangePhysicalFitFromLive,refreshNativeOwnerLiveViewport,startNativeRemotePiView,endpointDeviceSummary,currentDisplayReadinessDevice,displayReadinessAssessment,renderDisplayReadiness,refreshDisplayReadiness,loadDisplayEndpoints,endpointAction,sendDisplayCommand,createDisplayEndpoint,editDisplayEndpoint,copyDisplayEndpointLink,renameDisplayEndpoint,rotateDisplayEndpoint,deleteDisplayEndpoint,cacheSourceName,updateOfflinePill,setServerConnectionState,clearServerReconnectNotice,clearServerRecoveryTimer,markServerTransportOpen,scheduleServerRecovery,recoverServerConnection,noteServerTransportError,noteCacheResponse,loadRemoteInfo,loadOwnerDevices,renderOwnerDevices,beginOwnerEnrollment,cancelOwnerEnrollment,selectOwnerConnectOption,copyOwnerConnectUrl,copyOwnerConnectCode,renameOwnerDevice,revokeOwnerDevice,toggleRemoteAccess,copyTextValue,copyRemoteInputValue,copyRemoteReconnectUrl,copyRemoteDisplayUrl,rotateRemoteAccessKey,loadCacheStatus,clearOfflineCache,pollServerConfig,displayDeviceId,displayViewportMetrics,captureLayoutRenderSnapshot,applyPhysicalLayoutPreviewCommand,clearPhysicalLayoutPreviewCommand,loadAuthoritativePhysicalConfig,applyPhysicalDisplayConfigCommand,dispatchPendingPhysicalDisplayCommand,sendDisplayHeartbeat,parseDisplayBenchmarkEvent,runPhysicalDisplayBenchmarkRequest,scheduleDisplayHeartbeat,bindDisplayViewportHeartbeat,startLiveDisplayConnection,startRemoteConfigPolling,staleCacheSnapshot,pruneStaleCacheSources,settingsRecoveryMessage,showSettingsInitializationError,clearSettingsInitializationError}, {
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
}, {globalFunctions:['refreshDisplayReadiness','loadDisplayEndpoints','sendDisplayCommand','createDisplayEndpoint','editDisplayEndpoint','copyDisplayEndpointLink','renameDisplayEndpoint','rotateDisplayEndpoint','deleteDisplayEndpoint','toggleRemoteAccess','copyRemoteDisplayUrl','rotateRemoteAccessKey','clearOfflineCache'],globalStates:[]});
}
// End source section: /js/remote/index.js
