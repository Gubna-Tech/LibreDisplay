// LibreDisplay source section: /js/system/index.js
{
// Settings dirty-state, updates, health, provider status, and diagnostics.
const {renderDisplayReadiness}=LibreDisplayRuntime.getModule('remote');
const configApi=LibreDisplayRuntime.getModule('config');
const {ensureCfgDefaults,persistCfgToServer}=configApi;
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;
const integrationsApi=LibreDisplayRuntime.getModule('integrations');
const {configuredIntegrationBlocks,healthAgeText}=integrationsApi;
const {loadFolderBackgrounds,stockSearchTerm,loadStockBackground,loadPhotos}=LibreDisplayRuntime.getModule('backgrounds');
const calendarApi=LibreDisplayRuntime.getModule('calendar');
const {loadCalendars}=calendarApi;
const weatherApi=LibreDisplayRuntime.getModule('weather');
const {weatherWindUnitLabel,fetchWeather,fetchWeatherAlerts}=weatherApi;
const {escHtml,safeHttpUrl,resilientFetch,connectivitySnapshot}=LibreDisplayRuntime.getModule('shared');
const performanceApi=LibreDisplayRuntime.getModule('performance');


let settingsInitializing=false;
let settingsDirty=false;
let calendarHideEmpty=false;

function markSettingsDirty(){
  if(settingsInitializing)return;
  settingsDirty=true;
  const badge=document.getElementById('settings-dirty');
  const state=document.getElementById('settings-save-state');
  if(badge){badge.textContent='Unsaved changes · preview only';badge.classList.add('dirty');}
  if(state){state.textContent='Unsaved changes — Save & Apply to keep them';state.style.color='#fde68a';}
}
function markSettingsClean(){
  settingsDirty=false;
  const badge=document.getElementById('settings-dirty');
  const state=document.getElementById('settings-save-state');
  if(badge){badge.textContent='No unsaved changes';badge.classList.remove('dirty');}
  if(state){state.textContent='All changes saved';state.style.color='';}
}
function setHealth(id,text,state=''){
  const el=document.getElementById(id);if(!el)return;
  el.textContent=text;el.className='health-value'+(state?' '+state:'');
}
let softwareUpdateState=null;
let softwareUpdateCheckPromise=null;
let softwareUpdateMonitorActive=false;
let softwareUpdateAutoTimer=null;
let softwareUpdateAutoLastStarted=0;
const SOFTWARE_UPDATE_AUTO_CHECK_MS=15*60*1000;
let systemHealthState=null;
let systemHealthRefreshTimer=null;
let systemHealthRefreshPromise=null;
let systemHealthUpdatedAt=0;
const SYSTEM_HEALTH_REFRESH_MS=15000;
let lastDisplayPerformanceBenchmark=null;
let displayPerformanceBenchmarkPromise=null;
function renderSoftwareUpdateStatus(){
  const current=document.getElementById('software-update-current');
  const status=document.getElementById('software-update-status');
  const instructions=document.getElementById('software-update-instructions');
  const updateBtn=document.getElementById('software-update-now');
  const releaseLink=document.getElementById('software-update-release-link');
  const badge=document.getElementById('settings-update-badge');
  const systemTab=document.querySelector('.settings-tab-btn[data-tab="system"]');
  if(current)current.textContent='v'+bootstrapApi.DASHBOARD_BUILD;
  const d=softwareUpdateState;
  const autoStatus=document.getElementById('software-update-auto-status');
  if(autoStatus){
    const checked=Number(d?.checkedAt)||0,when=checked?new Date(checked*1000).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'';
    autoStatus.textContent=checked?`Automatic update detection is on · last checked ${when}${d?.stale?' · showing last successful result':''}.`:'Automatic update detection is on · checking when Settings opens and every 15 minutes while open.';
  }
  const updateAvailable=bootstrapApi.SESSION_ROLE==='owner'&&!!d?.ok&&!!d.updateAvailable,updateSection=document.getElementById('settings-software-update');
  if(badge){badge.classList.toggle('show',updateAvailable);badge.setAttribute('aria-hidden',updateAvailable?'false':'true');}
  if(systemTab)systemTab.classList.toggle('update-available',updateAvailable);if(updateSection){updateSection.classList.toggle('update-attention',updateAvailable);if(updateAvailable){updateSection.classList.remove('section-collapsed');updateSection.querySelector(':scope > h3')?.setAttribute('aria-expanded','true');try{LibreDisplayRuntime.getModule('settings').saveCollapsedSettingsSections?.();}catch(_e){}}}
  if(releaseLink){
    const href=d?.releaseUrl&&safeHttpUrl(d.releaseUrl)?safeHttpUrl(d.releaseUrl):'';
    releaseLink.href=href||'#';
    releaseLink.classList.toggle('show',!!href&&!!d?.updateAvailable);
    if(d?.latestVersion)releaseLink.textContent=`View v${d.latestVersion} release notes ↗`;
  }
  if(updateBtn){updateBtn.style.display='none';updateBtn.disabled=false;updateBtn.textContent='Update now';updateBtn.classList.toggle('update-emphasis',updateAvailable&&!!d?.canUpdateInApp);}
  if(!d){if(status)status.textContent='Checking GitHub…';if(instructions)instructions.style.display='none';return;}
  if(!d.ok){if(status)status.textContent='Could not check right now';if(instructions){instructions.style.display='block';instructions.textContent='LibreDisplay will try again later. You can also run “libredisplay check” in Terminal.';}return;}
  if(d.updateAvailable){
    if(status)status.textContent=`Update available · v${d.latestVersion}`;
    if(updateBtn&&d.canUpdateInApp){updateBtn.style.display='inline-flex';updateBtn.textContent=`Update to v${d.latestVersion}`;}
    if(instructions){
      instructions.style.display='block';
      if(d.canUpdateInApp)instructions.innerHTML=`<b>v${escHtml(d.latestVersion)} is ready.</b><br>Update Now creates a safety backup, installs the official GitHub release, and restarts the native LibreDisplay device. Expect the dashboard to be unavailable briefly.`;
      else if(d.deployment==='docker')instructions.innerHTML=`<b>Update available: v${escHtml(d.latestVersion)}</b><br>Docker updates must run on the host: <code>./scripts/docker-setup.sh update</code>. ${escHtml(d.inAppUpdateReason||'')}`;
      else if(d.updateCommand)instructions.innerHTML=`<b>Update available: v${escHtml(d.latestVersion)}</b><br>${escHtml(d.inAppUpdateReason||'Browser updating is not enabled yet.')} You can still run <code>${escHtml(d.updateCommand)}</code> in Terminal.`;
      else instructions.innerHTML=`<b>Update available: v${escHtml(d.latestVersion)}</b><br>${escHtml(d.inAppUpdateReason||'Use the deployment update procedure for this installation.')}`;
    }
  }else{
    if(status)status.textContent=`Up to date · v${d.currentVersion||bootstrapApi.DASHBOARD_BUILD}`;
    if(instructions){instructions.style.display='none';instructions.textContent='';}
  }
}
async function checkSoftwareUpdate(force=false){
  if(softwareUpdateCheckPromise)return softwareUpdateCheckPromise;
  const run=(async()=>{
    try{
      const suffix=force?'?force=1':'';
      const r=await resilientFetch(serverPath('/api/update-status'+suffix),{cache:'no-store'},{timeoutMs:18000,attempts:2});
      const d=await r.json().catch(()=>({ok:false}));
      softwareUpdateState=r.ok?d:{ok:false};
    }catch(e){softwareUpdateState={ok:false};}
    renderSoftwareUpdateStatus();
    updateSettingsOverview();
    return softwareUpdateState;
  })();
  softwareUpdateCheckPromise=run;
  try{return await run;}finally{softwareUpdateCheckPromise=null;}
}
function settingsPanelOpen(){return !document.getElementById('setup')?.classList.contains('hidden');}
async function autoDetectSoftwareUpdate(reason='heartbeat'){
  if(document.hidden||!settingsPanelOpen()||bootstrapApi.SESSION_ROLE!=='owner')return softwareUpdateState;
  const now=Date.now();
  if(reason!=='manual'&&now-softwareUpdateAutoLastStarted<60000)return softwareUpdateState;
  softwareUpdateAutoLastStarted=now;
  return checkSoftwareUpdate(true);
}
function startSoftwareUpdateAutoDetection(){
  stopSoftwareUpdateAutoDetection();
  if(bootstrapApi.SESSION_ROLE!=='owner')return;
  setTimeout(()=>autoDetectSoftwareUpdate('open'),250);
  softwareUpdateAutoTimer=setInterval(()=>autoDetectSoftwareUpdate('heartbeat'),SOFTWARE_UPDATE_AUTO_CHECK_MS);
}
function stopSoftwareUpdateAutoDetection(){
  if(softwareUpdateAutoTimer){clearInterval(softwareUpdateAutoTimer);softwareUpdateAutoTimer=null;}
}
function setSoftwareUpdateActionStatus(text,state=''){
  const el=document.getElementById('software-update-action-status');if(!el)return;
  el.style.display=text?'block':'none';el.textContent=text||'';
  el.style.color=state==='bad'?'var(--ld-danger)':state==='good'?'var(--ld-success)':state==='warn'?'var(--ld-warning)':'';
}
function sleepMs(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function monitorSoftwareUpdate(targetVersion){
  if(softwareUpdateMonitorActive)return;
  softwareUpdateMonitorActive=true;
  let sawOffline=false;
  try{
    for(let attempt=0;attempt<120;attempt++){
      await sleepMs(attempt<4?2000:4000);
      try{
        const statusResponse=await resilientFetch(serverPath('/api/update-run-status'),{cache:'no-store'});
        if(statusResponse.status===403&&sawOffline){setSoftwareUpdateActionStatus('LibreDisplay restarted successfully enough to answer requests, but this remote Owner session expired during the reboot. Reopen Settings with a fresh pairing link to verify the new version.','warn');return;}
        if(statusResponse.ok){
          const run=await statusResponse.json().catch(()=>({}));
          if(run.state==='failed'){
            setSoftwareUpdateActionStatus(run.error||'The update did not complete. Review the update log or run the terminal updater.','bad');
            const btn=document.getElementById('software-update-now');if(btn)btn.disabled=false;
            return;
          }
          if(run.state==='running'||run.state==='starting')setSoftwareUpdateActionStatus(`Installing v${targetVersion}… The display will restart when installation is complete.`,'warn');
        }
        const versionResponse=await resilientFetch(serverPath('/api/update-status'),{cache:'no-store'});
        if(versionResponse.ok){
          const info=await versionResponse.json().catch(()=>({}));
          if(info.currentVersion===targetVersion&&!info.updateAvailable){
            setSoftwareUpdateActionStatus(`Updated to v${targetVersion}. Reloading Settings…`,'good');
            await sleepMs(1200);location.reload();return;
          }
          if(sawOffline)setSoftwareUpdateActionStatus('LibreDisplay is back online. Verifying the installed version…','warn');
        }
      }catch(e){
        sawOffline=true;
        setSoftwareUpdateActionStatus('LibreDisplay is restarting. This page will reconnect automatically…','warn');
      }
    }
    setSoftwareUpdateActionStatus('The update is taking longer than expected. The device may still be restarting; reload this page in a moment.','warn');
  }finally{softwareUpdateMonitorActive=false;}
}
async function startSoftwareUpdate(){
  const d=softwareUpdateState;
  if(!d?.ok||!d.updateAvailable||!d.canUpdateInApp)return;
  const target=d.latestVersion;
  if(!confirm(`Update LibreDisplay from v${d.currentVersion||bootstrapApi.DASHBOARD_BUILD} to v${target} now?\n\nA safety backup will be created automatically. The native display will restart and may be unavailable for a few minutes.${bootstrapApi.REMOTE_SETTINGS_MODE?'\n\nBecause this is a remote Settings session, you may need a fresh pairing link after the reboot.':''}`))return;
  const btn=document.getElementById('software-update-now');if(btn){btn.disabled=true;btn.textContent='Starting update…';}
  setSoftwareUpdateActionStatus(`Starting the v${target} update…`,'warn');
  try{
    const r=await resilientFetch(serverPath('/api/update-now'),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
    const result=await r.json().catch(()=>({}));
    if(!r.ok||!result.ok)throw new Error(result.error||`HTTP ${r.status}`);
    if(result.state==='current'){
      setSoftwareUpdateActionStatus('LibreDisplay is already up to date.','good');
      await checkSoftwareUpdate(true);return;
    }
    setSoftwareUpdateActionStatus(`Installing v${target}… A safety backup is being created before files are replaced.`,'warn');
    monitorSoftwareUpdate(target);
  }catch(e){
    setSoftwareUpdateActionStatus(`Could not start the update: ${e.message||e}`,'bad');
    if(btn)btn.disabled=false;
  }
}
let releaseRollbackState=null;
let releaseRollbackMonitorActive=false;
function setReleaseRollbackStatus(text,state=''){
  const el=document.getElementById('release-rollback-status');if(!el)return;
  el.textContent=text||'';el.style.color=state==='bad'?'var(--ld-danger)':state==='good'?'var(--ld-success)':state==='warn'?'var(--ld-warning)':'';
}
function renderReleaseRollbacks(){
  const host=document.getElementById('release-rollback-list');if(!host)return;
  const d=releaseRollbackState;
  if(!d){host.innerHTML='<div class="settings-note">Loading rollback snapshots…</div>';return;}
  const rows=Array.isArray(d.snapshots)?d.snapshots:[];
  if(!rows.length){host.innerHTML='<div class="settings-note">No version rollback snapshots yet. LibreDisplay creates one automatically before supported native updates.</div>';setReleaseRollbackStatus(d.reason||'Rollback history will appear after the next native update.');return;}
  host.innerHTML=rows.map(row=>{const when=row.createdUtc?new Date(row.createdUtc).toLocaleString():'Unknown date',target=row.fromVersion||'unknown',forward=row.toVersion?` before updating to v${escHtml(row.toVersion)}`:'',size=formatHealthBytes(row.sizeBytes||0),can=!!d.canRollback;return `<div class="restore-point-row"><div><div class="restore-point-title">LibreDisplay v${escHtml(target)}</div><div class="restore-point-meta">${escHtml(when)}${forward} · ${escHtml(size)} · verified before restore</div></div><div class="restore-point-actions"><button class="btn-util" type="button" ${can?'':'disabled'} data-ld-action-click="system.startReleaseRollback" data-ld-action-args="${escHtml(JSON.stringify([row.id,target]))}">Restore v${escHtml(target)}</button></div></div>`}).join('');
  if(d.canRollback)setReleaseRollbackStatus(`${rows.length} private rollback snapshot${rows.length===1?'':'s'} available. Only the newest five are retained automatically.`);
  else setReleaseRollbackStatus(d.reason||'Version rollback is not available on this deployment.','warn');
  const history=document.getElementById('maintenance-history-list');if(history){const events=Array.isArray(d.history)?d.history.slice(0,6):[];history.innerHTML=events.length?events.map(row=>{const when=row.createdUtc?new Date(row.createdUtc).toLocaleString():'Unknown date';if(row.event==='rollback')return `<div><b>Rollback</b> · v${escHtml(row.fromVersion||'?')} → v${escHtml(row.toVersion||'?')} · ${escHtml(when)}</div>`;if(row.event==='update')return `<div><b>Update</b> · v${escHtml(row.fromVersion||'?')} → v${escHtml(row.toVersion||'?')} · ${escHtml(when)}</div>`;return `<div><b>${escHtml(row.event||'Maintenance')}</b> · ${escHtml(when)}</div>`}).join(''):'No update or rollback history recorded yet.';}
}
async function loadReleaseRollbacks(){
  const host=document.getElementById('release-rollback-list');if(host&&!releaseRollbackState)host.innerHTML='<div class="settings-note">Loading rollback snapshots…</div>';
  try{const r=await resilientFetch(serverPath('/api/release-rollbacks'),{cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);releaseRollbackState=d;renderReleaseRollbacks();}catch(e){releaseRollbackState={ok:false,snapshots:[]};if(host)host.innerHTML='';setReleaseRollbackStatus('Could not load update history: '+(e?.message||e),'bad');}
}
async function monitorReleaseRollback(targetVersion){
  if(releaseRollbackMonitorActive)return;releaseRollbackMonitorActive=true;let sawOffline=false;
  try{
    for(let attempt=0;attempt<120;attempt++){
      await sleepMs(attempt<4?2000:4000);
      try{
        const versionResponse=await resilientFetch(serverPath('/api/update-status'),{cache:'no-store'});
        if(versionResponse.status===403&&sawOffline){setReleaseRollbackStatus(`LibreDisplay restarted during rollback to v${targetVersion}, but this remote Owner session expired. Reopen Settings with a fresh pairing link to verify the restored version.`,'warn');return;}
        if(versionResponse.ok){const info=await versionResponse.json().catch(()=>({}));if(info.currentVersion===targetVersion){setReleaseRollbackStatus(`Rollback to v${targetVersion} completed. Reloading Settings…`,'good');await sleepMs(1200);location.reload();return;}if(sawOffline)setReleaseRollbackStatus('LibreDisplay is back online. Verifying the restored version…','warn');}
        const runResponse=await resilientFetch(serverPath('/api/release-rollback-run-status'),{cache:'no-store'});
        if(runResponse.ok){const run=await runResponse.json().catch(()=>({}));if(run.state==='verifying'){setReleaseRollbackStatus(`Verifying the rollback snapshot for v${targetVersion}…`,'warn');}else if(run.state==='failed'){setReleaseRollbackStatus(run.error||'Rollback did not complete. Review data/rollback.log.','bad');return;}}
      }catch(e){sawOffline=true;setReleaseRollbackStatus(`LibreDisplay is restoring v${targetVersion} and restarting. This page will reconnect automatically…`,'warn');}
    }
    setReleaseRollbackStatus('Rollback is taking longer than expected. The device may still be restarting; reload this page in a moment.','warn');
  }finally{releaseRollbackMonitorActive=false;}
}
async function startReleaseRollback(snapshotId,targetVersion){
  if(!releaseRollbackState?.canRollback)return;
  const warning=`Restore LibreDisplay v${targetVersion}?\n\nThis is a full pre-update rollback: application files, settings, media, plugins, and project .env return to the state captured before that update. LibreDisplay first creates a new private safety snapshot of the current state so it remains recoverable. The device will restart.${bootstrapApi.REMOTE_SETTINGS_MODE?'\n\nYour remote Owner session may expire during the restart.':''}`;
  if(!confirm(warning))return;
  setReleaseRollbackStatus(`Preparing rollback to v${targetVersion}…`,'warn');
  try{const r=await resilientFetch(serverPath('/api/release-rollback'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:snapshotId}),cache:'no-store'},{timeoutMs:15000,retry:false}),d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);setReleaseRollbackStatus(`Restoring v${targetVersion}… A recovery snapshot of the current installation is being created first.`,'warn');monitorReleaseRollback(targetVersion);}catch(e){setReleaseRollbackStatus('Could not start rollback: '+(e?.message||e),'bad');}
}

function formatHealthBytes(bytes){
  let n=Number(bytes)||0;const units=['B','KB','MB','GB','TB'];let i=0;
  while(n>=1024&&i<units.length-1){n/=1024;i++;}
  return `${n>=10||i===0?n.toFixed(0):n.toFixed(1)} ${units[i]}`;
}
function formatHealthUptime(seconds){
  let n=Math.max(0,Number(seconds)||0);const days=Math.floor(n/86400);n%=86400;const hours=Math.floor(n/3600);n%=3600;const mins=Math.floor(n/60);
  if(days)return `${days}d ${hours}h`;
  if(hours)return `${hours}h ${mins}m`;
  return `${mins}m`;
}
function renderSystemHealth(){
  const d=systemHealthState;
  const set=(id,text,state='')=>setHealth(id,text,state);
  if(!d?.ok){for(const id of ['system-health-deployment','system-health-uptime','system-health-storage','system-health-data','system-health-host','system-health-hardware','system-health-memory','system-health-load','system-health-browser','system-health-pi-runtime','system-health-chromium','system-health-connectivity','system-health-integrity','system-health-recovery'])set(id,'Unavailable','warn');return;}
  set('system-health-deployment',`${d.deployment||'unknown'} · v${d.version||bootstrapApi.DASHBOARD_BUILD}`,'good');
  set('system-health-uptime',d.uptimeSeconds==null?'Unavailable':formatHealthUptime(d.uptimeSeconds),d.uptimeSeconds==null?'warn':'good');
  const free=Number(d.disk?.freeBytes)||0,freePct=Number(d.disk?.freePercent)||0;
  set('system-health-storage',free?`${formatHealthBytes(free)} free · ${freePct.toFixed(1)}%`: 'Unavailable',freePct&&freePct<10?'bad':freePct&&freePct<20?'warn':'good');
  set('system-health-data',d.dataWritable?'Writable':'Not writable',d.dataWritable?'good':'bad');
  set('system-health-host',[d.platform,d.machine,`Python ${d.python}`].filter(Boolean).join(' · ')||'Unknown','good');
  const hw=d.hardware||{},model=String(hw.model||'').trim(),cores=Number(hw.cpuCount)||0;
  set('system-health-hardware',[model,cores?`${cores} CPU cores`:'' ].filter(Boolean).join(' · ')||'Generic host',model.includes('Raspberry Pi')?'good':'');
  const memTotal=Number(hw.memoryTotalBytes)||0,memAvail=Number(hw.memoryAvailableBytes)||0,temp=Number(hw.temperatureC);
  const memText=memTotal?`${formatHealthBytes(memAvail)} available / ${formatHealthBytes(memTotal)}`:'Memory unavailable';
  const tempText=Number.isFinite(temp)?` · ${temp.toFixed(1)}°C`:'';
  set('system-health-memory',memText+tempText,Number.isFinite(temp)&&temp>=80?'bad':Number.isFinite(temp)&&temp>=70?'warn':'good');
  const loads=Array.isArray(d.loadAverage)?d.loadAverage.map(Number).filter(Number.isFinite):[],load1=loads[0]||0,loadPerCore=cores?load1/cores:0;
  set('system-health-load',loads.length?`${loads.map(v=>v.toFixed(2)).join(' · ')} (1m · 5m · 15m)${cores?` · ${cores} cores`:''}`:'Unavailable',loadPerCore>=1.15?'bad':loadPerCore>=.80?'warn':loads.length?'good':'');
  const kiosk=d.kioskHeartbeat||{},perf=kiosk.frontendPerformance||{},longTasks=perf.longTasks||{},layoutAutoFit=perf.layoutAutoFit||{},forecastRendering=perf.forecastRendering||{};
  const anim=perf.animation||{},workload=perf.animationWorkload||{},graphics=perf.graphics||{},fps=Number(anim.fps)||0,dashboardFps=Number(anim.dashboardFps)||0,settingsFps=Number(anim.settingsFps)||0,targetFps=Number(anim.targetFps)||0,dropped=Number(anim.droppedPct)||0,gpuRenderer=String(graphics.renderer||'').trim(),gpuText=graphics.software?'SOFTWARE graphics path':gpuRenderer?(graphics.webgl2?'GPU/WebGL2':'GPU/WebGL'):(graphics.webgl===false&&graphics.webgl2===false?'WebGL unavailable':'');
  const workloadText=Number(workload.totalAnimations)?`${Number(workload.totalAnimations)} animation tracks · birds ${Number(workload.birds)||0} · dog ${Number(workload.dog)||0} · weather ${Number(workload.weather)||0} · ${Number(workload.weatherNodes)||0} overlay nodes${Number(workload.playingVideos)?` · ${Number(workload.playingVideos)} video`:''}`:'';
  const displayText=kiosk.viewport?`${kiosk.viewport}${Number(kiosk.dpr)&&Number(kiosk.dpr)!==1?` · DPR ${Number(kiosk.dpr).toFixed(2)}`:''}${kiosk.screen&&kiosk.screen!==kiosk.viewport?` · screen ${kiosk.screen}`:''}`:'';
  const fpsText=anim.settingsOpen&&dashboardFps?`dashboard ${dashboardFps.toFixed(1)} FPS · settings ${settingsFps||fps?Number(settingsFps||fps).toFixed(1):'—'} FPS${targetFps?` / ${targetFps} target`:''}`:fps?`${fps.toFixed(1)} FPS${targetFps?` / ${targetFps} target`:''}`:'';
  const forecastText=(forecastRendering.daily||forecastRendering.hourly)?`forecast renders D ${Number(forecastRendering.daily?.renders)||0}/${Number(forecastRendering.daily?.skips)||0} skip · H ${Number(forecastRendering.hourly?.renders)||0}/${Number(forecastRendering.hourly?.skips)||0} skip · ${Math.max(Number(forecastRendering.daily?.maxMs)||0,Number(forecastRendering.hourly?.maxMs)||0).toFixed(1)} ms max`:'';
  const perfText=kiosk.present&&Object.keys(perf).length?[`${perf.tier||'browser'} tier`,perf.hostModel||'',displayText,fpsText,dropped?`${dropped.toFixed(1)}% dropped`:'',gpuText,gpuRenderer&&!graphics.software?gpuRenderer:'',graphics.probeError?`graphics probe: ${graphics.probeError}`:'',workloadText,forecastText,Number(layoutAutoFit.runs)?`layout auto-fit ${Number(layoutAutoFit.runs)} runs · ${Number(layoutAutoFit.maxMs||0).toFixed(0)} ms max`:'',`${Number(longTasks.count)||0} long tasks`,`${Number(longTasks.maxMs)||0} ms max`,perf.heap?.usedBytes?`${formatHealthBytes(perf.heap.usedBytes)} JS heap`:'' ].filter(Boolean).join(' · '):(kiosk.present?'Waiting for browser metrics':'No local kiosk heartbeat');
  const healthFps=dashboardFps||fps;
  set('system-health-browser',perfText,!kiosk.present?'warn':graphics.software||healthFps&&healthFps<15?'bad':healthFps&&healthFps<26?'warn':'good');
  const pi=d.piRuntime||{},thermal=pi.thermal||{},session=pi.displaySession||{},chrome=pi.chromium||{},kernel=pi.kernelGraphics||{};
  const throttledNow=!!(thermal.throttledNow||thermal.frequencyCappedNow||thermal.underVoltageNow||thermal.softTempLimitNow),throttledEver=!!(thermal.throttledOccurred||thermal.frequencyCappedOccurred||thermal.underVoltageOccurred||thermal.softTempLimitOccurred);
  const runtimeParts=[session.xdgSessionType?`session ${session.xdgSessionType}`:'',session.waylandDisplay?`Wayland ${session.waylandDisplay}`:session.display?`DISPLAY ${session.display}`:'',kernel.vc4Loaded?'vc4 loaded':'vc4 missing',kernel.v3dLoaded?'v3d loaded':'v3d missing',Number(thermal.cpuFreqMHz)?`CPU ${Number(thermal.cpuFreqMHz).toFixed(0)} MHz`:'' ,Number(thermal.cpuMaxMHz)?`max ${Number(thermal.cpuMaxMHz).toFixed(0)} MHz`:'',thermal.governor?`governor ${thermal.governor}`:'',Number(thermal.coreFreqMHz)?`core ${Number(thermal.coreFreqMHz).toFixed(0)} MHz`:'',Number(thermal.v3dFreqMHz)?`V3D ${Number(thermal.v3dFreqMHz).toFixed(0)} MHz`:'',thermal.throttledRaw?`throttle ${thermal.throttledRaw}`:''].filter(Boolean);
  const isPiHost=/raspberry pi/i.test(model);set('system-health-pi-runtime',runtimeParts.join(' · ')||'Runtime diagnostics unavailable',throttledNow||(isPiHost&&(kernel.vc4Loaded===false||kernel.v3dLoaded===false))?'bad':throttledEver?'warn':isPiHost?'good':'');
  const flags=Array.isArray(chrome.flags)?chrome.flags:[],requestedFlags=Array.isArray(chrome.requestedFlags)?chrome.requestedFlags:[],missingFlags=Array.isArray(chrome.missingExpectedFlags)?chrome.missingExpectedFlags:[],featureFlag=flags.find(v=>String(v).startsWith('--enable-features='))||'',useAngle=flags.find(v=>String(v).startsWith('--use-angle='))||'',webglVerified=graphics.webgl===true||graphics.webgl2===true,chromeParts=[`${Number(chrome.processCount)||0} processes`,`${Number(chrome.gpuProcesses)||0} GPU`,`${Number(chrome.rendererProcesses)||0} renderer`,Number(chrome.totalRssBytes)?`${formatHealthBytes(chrome.totalRssBytes)} RSS`:'',chrome.launchProfile?`launch ${chrome.launchProfile}${Number(chrome.launchAttempt)?` attempt ${Number(chrome.launchAttempt)+1}`:''}`:'',chrome.persistedProfile?`persisted ${chrome.persistedProfile}`:'',flags.find(v=>String(v).startsWith('--ozone-platform='))||'',flags.find(v=>String(v).startsWith('--use-gl='))||'',useAngle,flags.includes('--enable-gpu-rasterization')?'GPU raster on':'',flags.includes('--enable-zero-copy')?'zero-copy on':'',featureFlag.includes('CanvasOopRasterization')?'Canvas OOP raster on':'',flags.includes('--ignore-gpu-blocklist')?'GPU blocklist override':'',flags.includes('--disable-gpu')?'GPU DISABLED':'',webglVerified?'hardware WebGL verified':'',requestedFlags.length&&!flags.length&&!webglVerified?'expected acceleration flags not visible in Chromium command line':'',missingFlags.length&&!webglVerified?`missing ${missingFlags.join(', ')}`:'',Array.isArray(chrome.recentGpuErrors)&&chrome.recentGpuErrors.length?`GPU log: ${chrome.recentGpuErrors.slice(-2).join(' | ')}`:''].filter(Boolean);
  set('system-health-chromium',chromeParts.join(' · ')||'No Chromium process data',!Number(chrome.processCount)?'warn':flags.includes('--disable-gpu')||!Number(chrome.gpuProcesses)||!webglVerified?'bad':'good');
  const conn=perf.connectivity||{},requests=Number(conn.requests)||0,failures=Number(conn.failures)||0,timeouts=Number(conn.timeouts)||0,retries=Number(conn.retries)||0,avg=Number(conn.averageLatencyMs)||0;
  const outbound=d.outboundConnectivity||{},serverRequests=Number(outbound.requests)||0,serverFailures=Number(outbound.failures)||0,serverRetries=Number(outbound.retries)||0,serverAvg=Number(outbound.averageLatencyMs)||0,lastKind=String(outbound.lastFailureKind||'');
  const browserText=kiosk.present&&requests?`${conn.online===false?'Offline':'Online'} · browser ${failures}/${requests} failed · ${timeouts} timed out · ${retries} retries${avg?' · '+avg+' ms avg':''}`:(kiosk.present?'Browser metrics pending':'No local kiosk heartbeat');
  const serverText=serverRequests?`server ${serverFailures}/${serverRequests} failed · ${serverRetries} retries${serverAvg?' · '+serverAvg+' ms avg':''}${lastKind?' · last '+lastKind:''}`:'server provider metrics pending';
  const connText=`${browserText} · ${serverText}`;
  set('system-health-connectivity',connText,!kiosk.present?'warn':conn.online===false?'bad':(failures||timeouts||serverFailures)?'warn':'good');
  const integrity=d.startupIntegrity||{},integrityChecked=Number(integrity.checkedAt)||0,integrityAge=integrityChecked?healthAgeText(Math.max(0,Date.now()/1000-integrityChecked)):'';
  const integrityText=integrity.ok?`Verified${integrity.version?' · v'+integrity.version:''}${integrityAge?' · '+integrityAge:''}`:'Not verified at startup';
  set('system-health-integrity',integrityText,integrity.ok&&integrity.frontendVerified?'good':'warn');
  const recovery=d.recovery||{},watchdog=recovery.watchdog||{},configRecovery=recovery.config||{},serverRestarts=Number(watchdog.serverRestarts)||0,browserRestarts=Number(watchdog.browserRestarts)||0,configRecoveredAt=Number(configRecovery.recoveredAt)||0;
  const recoveryParts=[];if(serverRestarts)recoveryParts.push(`${serverRestarts} server restart${serverRestarts===1?'':'s'}`);if(browserRestarts)recoveryParts.push(`${browserRestarts} browser restart${browserRestarts===1?'':'s'}`);if((serverRestarts||browserRestarts)&&watchdog.browserAccelProfile)recoveryParts.push(`graphics profile ${watchdog.browserAccelProfile}`);if(watchdog.lastReason&&watchdog.lastReason!=='browser-hardware-graphics')recoveryParts.push(`last ${watchdog.lastReason}`);if(configRecoveredAt)recoveryParts.push(`config recovered ${healthAgeText(Math.max(0,Date.now()/1000-configRecoveredAt))}`);
  const recoveryReady=watchdog.lastReason==='browser-hardware-graphics'&&watchdog.browserAccelProfile?`Ready · hardware graphics verified · ${watchdog.browserAccelProfile}`:'Ready · no recovery actions recorded';
  set('system-health-recovery',recoveryParts.length?recoveryParts.join(' · '):recoveryReady,recoveryParts.length?'warn':'good');
}
function physicalDisplayBenchmarkState(){return systemHealthState?.kioskHeartbeat?.displayPerformanceBenchmark||null;}
function renderDisplayPerformanceBenchmark(value){
  const box=document.getElementById('system-performance-benchmark-status');if(!box)return;
  if(!value){box.style.display='none';box.textContent='';return;}
  const state=value?.state?value:null,result=state?.result||value;
  if(state&&state.state==='running'){
    const progress=Number(state.stageIndex)&&Number(state.stageTotal)?` (${Number(state.stageIndex)}/${Number(state.stageTotal)})`:'';
    box.textContent=`Running on the physical display${progress}: ${state.stageLabel||'measuring frame pacing'}…\n\nSettings can stay open on this remote computer. The benchmark is executing in the kiosk browser attached to the target display.`;box.style.display='block';return;
  }
  if(state&&state.state==='error'){box.textContent=`Physical display performance test failed: ${state.error||'unknown error'}`;box.style.display='block';return;}
  const stages=Array.isArray(result?.stages)?result.stages:[];
  if(!stages.length){box.textContent=state?.state==='requested'?'Waiting for the physical display to start the benchmark…':'No completed physical-display benchmark is available yet.';box.style.display='block';return;}
  const lines=[`Diagnosis: ${result.diagnosis?.summary||'Test completed.'}`,''];
  for(const row of stages){const delta=Number(row.deltaFps)||0,long=row.longTasks||{},fit=row.layoutAutoFit||{},extras=[];if(Number(long.count))extras.push(`${Number(long.count)} long task${Number(long.count)===1?'':'s'} / ${Number(long.maxMs||0)} ms max`);if(Number(fit.runs))extras.push(`auto-fit ${Number(fit.runs)} / ${Number(fit.totalMs||0).toFixed(1)} ms`);lines.push(`${row.label}: ${Number(row.fps||0).toFixed(1)} FPS${row.key==='baseline'?'':` (${delta>=0?'+':''}${delta.toFixed(1)})`} · p90 ${Number(row.p90Ms||0).toFixed(1)} ms · ${Number(row.droppedPct||0).toFixed(1)}% slow frames${extras.length?' · '+extras.join(' · '):''}`);}
  lines.push('','Measured on the physical kiosk display. This result is also included in Download diagnostics.');box.textContent=lines.join('\n');box.style.display='block';
}
async function runSystemDisplayPerformanceBenchmark(){
  if(displayPerformanceBenchmarkPromise)return displayPerformanceBenchmarkPromise;
  const button=document.getElementById('system-performance-benchmark-button'),box=document.getElementById('system-performance-benchmark-status');
  if(button){button.disabled=true;button.textContent='Testing display…';}
  const run=(async()=>{
    const requestId=`bench-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
    try{
      await loadSystemHealth();
      if(!systemHealthState?.kioskHeartbeat?.present)throw new Error('The physical kiosk heartbeat is offline. The test cannot run until the target display reconnects.');
      if(box){box.style.display='block';box.textContent='Queueing the benchmark on the physical kiosk display… The request remains available across Chromium graphics-recovery restarts until the kiosk completes it.';}
      const response=await resilientFetch(serverPath('/api/devices'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'performance-benchmark',endpoint:bootstrapApi.ACTIVE_ENDPOINT,requestId}),cache:'no-store'},{timeoutMs:6000,attempts:2});
      const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.ok)throw new Error(payload.error||`HTTP ${response.status}`);
      const deadline=Date.now()+180000;let seen=false;
      while(Date.now()<deadline){
        await sleepMs(seen?850:500);await loadSystemHealth();
        const state=physicalDisplayBenchmarkState();
        if(!state||state.requestId!==requestId)continue;
        seen=true;renderDisplayPerformanceBenchmark(state);
        if(state.state==='complete'&&state.result){lastDisplayPerformanceBenchmark=state.result;return state.result;}
        if(state.state==='error')throw new Error(state.error||'The physical kiosk benchmark failed.');
      }
      throw new Error(seen?'The physical display did not finish the benchmark within 180 seconds. It may still be cycling Chromium graphics profiles; check System Health and retry once recovery settles.':'The physical kiosk did not acknowledge the durable benchmark request within 180 seconds. Check the live kiosk heartbeat and browser recovery state.');
    }catch(error){if(box){box.style.display='block';box.textContent=`Performance test could not complete: ${error?.message||error}`;}throw error;
    }finally{if(button){button.disabled=false;button.textContent='Run on physical display';}}
  })();
  displayPerformanceBenchmarkPromise=run;
  try{return await run;}finally{displayPerformanceBenchmarkPromise=null;}
}

function renderSystemHealthRefreshStatus(refreshing=false){
  const el=document.getElementById('system-health-refresh-status');if(!el)return;
  if(refreshing){el.textContent='Refreshing system health…';return;}
  if(systemHealthUpdatedAt){const age=healthAgeText((Date.now()-systemHealthUpdatedAt)/1000);el.textContent=systemHealthState?.ok?`Auto-refresh every 15 seconds · Updated ${age}`:`Auto-refresh every 15 seconds · Last refresh failed ${age} · retrying automatically`;return;}
  el.textContent='Auto-refresh every 15 seconds while Settings is open.';
}
async function loadSystemHealth(){
  if(systemHealthRefreshPromise)return systemHealthRefreshPromise;
  renderSystemHealthRefreshStatus(true);
  systemHealthRefreshPromise=(async()=>{
    try{
      const r=await resilientFetch(serverPath('/api/system-health'),{cache:'no-store'},{timeoutMs:6000,attempts:2});
      systemHealthState=r.ok?await r.json():{ok:false};
    }catch(e){systemHealthState={ok:false};}
    systemHealthUpdatedAt=Date.now();
    renderSystemHealth();renderDisplayReadiness();renderSystemHealthRefreshStatus(false);
    const physicalBenchmark=physicalDisplayBenchmarkState();if(!displayPerformanceBenchmarkPromise&&physicalBenchmark?.state){if(physicalBenchmark.state==='complete'&&physicalBenchmark.result)lastDisplayPerformanceBenchmark=physicalBenchmark.result;renderDisplayPerformanceBenchmark(physicalBenchmark);}
    return systemHealthState;
  })();
  try{return await systemHealthRefreshPromise;}finally{systemHealthRefreshPromise=null;}
}
function stopSystemHealthAutoRefresh(){
  if(systemHealthRefreshTimer){clearInterval(systemHealthRefreshTimer);systemHealthRefreshTimer=null;}
}
function startSystemHealthAutoRefresh(){
  stopSystemHealthAutoRefresh();
  if(bootstrapApi.SESSION_ROLE!=='owner')return;
  loadSystemHealth();
  systemHealthRefreshTimer=setInterval(()=>{
    const setup=document.getElementById('setup');
    if(document.hidden||!setup||setup.classList.contains('hidden'))return;
    loadSystemHealth();
  },SYSTEM_HEALTH_REFRESH_MS);
}
function providerHealthPill(status,label){return `<span class="integration-health-state state-${escHtml(status)}">${escHtml(label)}</span>`;}
function renderProviderHealth(){
  const host=document.getElementById('provider-health-list');if(!host)return;
  const now=Date.now(),rows=[];
  const weatherConfigured=Number.isFinite(Number(cfg.lat))&&Number.isFinite(Number(cfg.lon));
  const weatherAge=weatherApi.weatherLastSuccessAt?Math.max(0,(now-weatherApi.weatherLastSuccessAt)/1000):0,weatherStale=weatherApi.weatherLastSuccessAt&&weatherAge>Math.max(900,(Number(cfg.weatherRefreshMin)||10)*120);
  rows.push({name:'Weather forecast',detail:!weatherConfigured?'No verified location configured':weatherApi.weatherLastError?(configApi.wxData?`Latest refresh failed · ${weatherApi.weatherLastError}`:weatherApi.weatherLastError):`${weatherApi.weatherLastSource||'Open-Meteo'}${weatherApi.weatherLastSuccessAt?' · last success '+healthAgeText(weatherAge):''}`,meta:weatherApi.weatherLastGridPoint?.timezone?`Forecast timezone ${weatherApi.weatherLastGridPoint.timezone}`:'',status:!weatherConfigured?'unconfigured':weatherApi.weatherLastError?(configApi.wxData?'stale':'error'):weatherStale?'stale':configApi.wxData?'fresh':'ready',label:!weatherConfigured?'Setup needed':weatherApi.weatherLastError?(configApi.wxData?'Delayed · last good data':'Offline / error'):weatherStale?'Delayed':configApi.wxData?'Healthy':'Waiting'});
  const enabledCalendars=(cfg.calendars||[]).map((c,i)=>({c,s:calendarApi.calStatuses[i]})).filter(x=>x.c.enabled!==false&&(x.c.url||x.c.configured)),calendarErrors=enabledCalendars.filter(x=>x.s?.ok===false).length,calendarPending=enabledCalendars.filter(x=>x.s?.pending).length,calendarOk=enabledCalendars.filter(x=>x.s?.ok===true).length,calendarChecked=Math.max(0,...enabledCalendars.map(x=>Number(x.s?.checkedAt)||0));
  rows.push({name:'Calendars',detail:enabledCalendars.length?`${calendarOk}/${enabledCalendars.length} healthy${calendarErrors?' · '+calendarErrors+' failed':''}${calendarPending?' · '+calendarPending+' checking':''}`:'No enabled calendars configured',meta:calendarChecked?`Last checked ${healthAgeText((now-calendarChecked)/1000)}`:'',status:!enabledCalendars.length?'unconfigured':calendarErrors?'error':calendarPending?'ready':calendarOk===enabledCalendars.length?'fresh':'ready',label:!enabledCalendars.length?'Not configured':calendarErrors?'Needs attention':calendarPending?'Checking':calendarOk===enabledCalendars.length?'Healthy':'Not checked'});
  const bgConfigured=cfg.backgroundSource==='none'||cfg.backgroundSource==='stock'||(cfg.backgroundSource==='folders'&&!!cfg.mediaFolders?.length)||(cfg.backgroundSource==='google'&&!!cfg.photosUrl),bgSource=cfg.backgroundSource==='stock'?'Stock images':cfg.backgroundSource==='folders'?'Folders / NAS':cfg.backgroundSource==='google'?'Google Photos':'Disabled',bgLoaded=cfg.backgroundSource==='stock'?!!configApi.bgLastUrl:['folders','google'].includes(cfg.backgroundSource)?!!configApi.bgSourceImages?.length:cfg.backgroundSource==='none';
  rows.push({name:'Background source',detail:configApi.lastBackgroundStatus.text||`${bgSource}${bgConfigured?'':' · not configured'}`,meta:configApi.lastBackgroundStatus.updatedAt?`Last activity ${healthAgeText((now-configApi.lastBackgroundStatus.updatedAt)/1000)}`:'',status:configApi.lastBackgroundStatus.error?'error':!bgConfigured?'unconfigured':cfg.backgroundSource==='none'?'ready':bgLoaded?'fresh':'ready',label:configApi.lastBackgroundStatus.error?'Needs attention':!bgConfigured?'Setup needed':cfg.backgroundSource==='none'?'Disabled':bgLoaded?'Healthy':'Waiting'});
  if(cfg.alertsEnabled){rows.push({name:'Weather alerts',detail:configApi.lastAlertStatus.text||'Waiting for alert provider status',meta:configApi.lastAlertStatus.updatedAt?`Last activity ${healthAgeText((now-configApi.lastAlertStatus.updatedAt)/1000)}`:'',status:configApi.lastAlertStatus.error?'error':'fresh',label:configApi.lastAlertStatus.error?'Needs attention':'Healthy'});}
  else rows.push({name:'Weather alerts',detail:'Disabled in Weather settings',meta:'',status:'ready',label:'Disabled'});
  const intConfigured=configuredIntegrationBlocks().length,intIssues=integrationsApi.integrationHealthRows.filter(x=>['error','missing','unconfigured'].includes(x.status)).length,intDelayed=integrationsApi.integrationHealthRows.filter(x=>['stale','cached'].includes(x.status)).length,intHealthy=integrationsApi.integrationHealthRows.filter(x=>x.status==='fresh').length;
  rows.push({name:'Integrations',detail:intConfigured?`${intHealthy}/${intConfigured} healthy${intIssues?' · '+intIssues+' need attention':intDelayed?' · '+intDelayed+' delayed/cached':''}`:'No integration blocks configured',meta:integrationsApi.integrationHealthLoadedAt?`Status refreshed ${healthAgeText((now-integrationsApi.integrationHealthLoadedAt)/1000)}`:'',status:!intConfigured?'ready':intIssues?'error':intDelayed?'stale':intHealthy===intConfigured?'fresh':'ready',label:!intConfigured?'None configured':intIssues?'Needs attention':intDelayed?'Delayed':intHealthy===intConfigured?'Healthy':'Not checked'});
  const staleSources=[...new Set([...configApi.staleCacheSources.values()].map(v=>v?.name||'remote data'))];
  rows.push({name:'Remote data cache',detail:staleSources.length?`Serving last known good data for ${staleSources.slice(0,3).join(', ')}${staleSources.length>3?' +'+(staleSources.length-3):''}`:'No stale remote sources are currently being served from cache.',meta:'Live data is always preferred when providers recover.',status:staleSources.length?'stale':'fresh',label:staleSources.length?'Fallback active':'Live preferred'});
  host.innerHTML=rows.map(r=>`<div class="provider-health-row"><div class="provider-health-copy"><b>${escHtml(r.name)}</b><span>${escHtml(r.detail)}</span>${r.meta?`<small>${escHtml(r.meta)}</small>`:''}</div><div class="provider-health-actions">${providerHealthPill(r.status,r.label)}</div></div>`).join('');
}
async function refreshProviderHealth(runData=false){
  if(runData){
    const jobs=[fetchWeather(),fetchWeatherAlerts(),loadCalendars()];
    if(cfg.backgroundSource==='stock')jobs.push(loadStockBackground());
    else if(cfg.backgroundSource==='folders'&&cfg.mediaFolders?.length)jobs.push(loadFolderBackgrounds(cfg.mediaFolders,cfg.mediaRecursive));
    else if(cfg.backgroundSource==='google'&&cfg.photosUrl)jobs.push(loadPhotos(cfg.photosUrl));
    await Promise.allSettled(jobs);
  }
  await loadIntegrationHealth();renderProviderHealth();updateSettingsOverview();
}

function updateSettingsOverview(){
  const localServer=location.protocol==='http:'||location.protocol==='https:';
  setHealth('health-server',localServer?(configApi.serverConfigAvailable?'Connected · config synced':'Connected · browser fallback'):'Open through local server',localServer?(configApi.serverConfigAvailable?'good':'warn'):'bad');
  const verifiedPlace=LibreDisplayRuntime.getModule('onboarding').weatherLocationTitle(LibreDisplayRuntime.getModule('onboarding').savedWeatherLocation());
  setHealth('health-weather',weatherApi.weatherLastError?(configApi.wxData?`Using last forecast · refresh error`:`Weather error · ${weatherApi.weatherLastError}`):(configApi.wxData?`Forecast loaded${verifiedPlace?' · '+verifiedPlace:''}${weatherApi.weatherLastSource?' · '+weatherApi.weatherLastSource:''}`:(cfg.lat&&cfg.lon?`Waiting for data${verifiedPlace?' · '+verifiedPlace:''}`:'Location not configured')),weatherApi.weatherLastError?(configApi.wxData?'warn':'bad'):(configApi.wxData?'good':(cfg.lat&&cfg.lon?'warn':'bad')));
  const configured=(cfg.calendars||[]).filter(c=>c.url||c.configured).length;
  const enabled=(cfg.calendars||[]).filter(c=>(c.url||c.configured)&&c.enabled!==false).length;
  const failures=(calendarApi.calStatuses||[]).filter(s=>s&&!s.pending&&!s.disabled&&s.ok===false).length;
  const successes=(calendarApi.calStatuses||[]).filter(s=>s?.ok).length;
  let calText=configured?`${enabled}/${configured} enabled`: 'No calendars configured';
  let calState=configured?'warn':'warn';
  if(enabled&&successes===enabled&&!failures){calText=`${successes} calendar${successes===1?'':'s'} healthy`;calState='good';}
  else if(failures){calText=`${failures} calendar error${failures===1?'':'s'}`;calState='bad';}
  setHealth('health-calendars',calText,calState);
  const bgCount=configApi.bgSourceImages?.length||0;
  if(cfg.backgroundSource==='stock'){
    setHealth('health-background',`Stock · ${stockSearchTerm()}${configApi.bgLastUrl?' loaded':''}`,configApi.bgLastUrl?'good':'warn');
  }else if(cfg.backgroundSource==='folders'){
    const sources=(cfg.mediaFolders||[]).length;
    setHealth('health-background',bgCount?`${bgCount} photos · ${sources} folder${sources===1?'':'s'}`:(sources?`${sources} folder${sources===1?'':'s'} configured`:'No folders configured'),bgCount?'good':(sources?'warn':'warn'));
  }else if(cfg.backgroundSource==='none'){
    setHealth('health-background','Disabled','warn');
  }else{
    setHealth('health-background',bgCount?`${bgCount} photos loaded`:(cfg.photosUrl?'Album configured':'No album configured'),bgCount?'good':(cfg.photosUrl?'warn':'warn'));
  }
  setHealth('health-alerts',cfg.alertsEnabled?(cfg.alertTestMode?`${configApi.activeWeatherAlerts.length||10} test alerts`:`${configApi.activeWeatherAlerts.length} active alert${configApi.activeWeatherAlerts.length===1?'':'s'}`):'Disabled',cfg.alertsEnabled?'good':'warn');
  setHealth('health-display',(document.fullscreenElement?'Fullscreen':'Windowed')+' · '+(cfg.layoutMode==='custom'?'Custom layout':'Default layout'),document.fullscreenElement?'good':'warn');
  const stale=[...new Set([...configApi.staleCacheSources.values()].map(v=>v?.name||'remote data'))];
  setHealth('health-cache',stale.length?`Using cached data · ${stale.slice(0,2).join(', ')}${stale.length>2?' +'+(stale.length-2):''}`:'Ready · live data preferred',stale.length?'warn':'good');
  const update=softwareUpdateState;
  setHealth('health-software',!update?'Checking GitHub…':(!update.ok?'Check unavailable':(update.updateAvailable?`Update available · v${update.latestVersion}`:`Up to date · v${update.currentVersion||bootstrapApi.DASHBOARD_BUILD}`)),!update||!update.ok?'warn':(update.updateAvailable?'warn':'good'));
  renderProviderHealth();
}
function buildDiagnosticsPayload(){
  const host=systemHealthState?.ok?{
    deployment:systemHealthState.deployment,
    platform:systemHealthState.platform,
    machine:systemHealthState.machine,
    python:systemHealthState.python,
    uptimeSeconds:systemHealthState.uptimeSeconds,
    disk:systemHealthState.disk,
    dataWritable:systemHealthState.dataWritable,
    loadAverage:systemHealthState.loadAverage,
    hardware:systemHealthState.hardware,
    piRuntime:systemHealthState.piRuntime,
    kioskHeartbeat:systemHealthState.kioskHeartbeat,
    recovery:systemHealthState.recovery,
    outboundConnectivity:systemHealthState.outboundConnectivity
  }:undefined;
  return {
    build:bootstrapApi.DASHBOARD_BUILD,
    generatedAt:new Date().toISOString(),
    protocol:location.protocol,
    storage:{serverConfig:configApi.serverConfigAvailable?'synced':'browser-fallback',serverError:configApi.serverConfigLastError||undefined,profiles:configApi.profileStore.items.length,activeProfile:configApi.profileStore.items.find(p=>p.id===configApi.profileStore.activeId)?.name||undefined},
    host,
    software:softwareUpdateState?.ok?{currentVersion:softwareUpdateState.currentVersion,latestVersion:softwareUpdateState.latestVersion,updateAvailable:softwareUpdateState.updateAvailable,deployment:softwareUpdateState.deployment,canUpdateInApp:softwareUpdateState.canUpdateInApp}:undefined,
    viewport:{width:innerWidth,height:innerHeight,devicePixelRatio:devicePixelRatio||1},
    frontendPerformance:LibreDisplayRuntime.getModule('performance').frontendPerformanceSnapshot(),
    administrationBrowserPerformance:LibreDisplayRuntime.getModule('performance').frontendPerformanceSnapshot(),
    physicalDisplayPerformance:systemHealthState?.kioskHeartbeat?.frontendPerformance||undefined,
    displayPerformanceBenchmark:physicalDisplayBenchmarkState()?.result||lastDisplayPerformanceBenchmark||undefined,
    displayPerformanceBenchmarkState:physicalDisplayBenchmarkState()||undefined,
    frontendConnectivity:connectivitySnapshot(),
    fullscreen:!!document.fullscreenElement,
    appearance:{theme:cfg.uiTheme||'libre-night',font:cfg.fontFamily||'Inter'},
    weather:{configured:!!(cfg.lat&&cfg.lon),loaded:!!configApi.wxData,unit:cfg.useFahrenheit?'imperial':'metric',windUnit:weatherWindUnitLabel(cfg),place:LibreDisplayRuntime.getModule('onboarding').weatherLocationTitle(LibreDisplayRuntime.getModule('onboarding').savedWeatherLocation())||undefined,timezone:cfg.locationTimezone||weatherApi.weatherLastGridPoint?.timezone||undefined,source:weatherApi.weatherLastSource||undefined,error:weatherApi.weatherLastError||undefined},
    calendars:(cfg.calendars||[]).map((c,i)=>({name:c.label||`Calendar ${i+1}`,type:(String(c.url||'').startsWith('/calendar-files/')?'file':'ics'),enabled:c.enabled!==false,status:calendarApi.calStatuses[i]?.ok===true?'ok':calendarApi.calStatuses[i]?.disabled?'disabled':calendarApi.calStatuses[i]?.pending?'checking':calendarApi.calStatuses[i]?.error?'error':'unknown',checkedAt:calendarApi.calStatuses[i]?.checkedAt||undefined})),
    integrations:integrationsApi.integrationHealthRows.map(r=>({name:r.name,plugin:r.pluginId,status:r.status,errorKind:r.errorKind||undefined,lastSuccessAt:r.lastSuccessAt||undefined,lastAttemptAt:r.lastAttemptAt||undefined,refreshMin:r.refreshMin||undefined,refreshing:!!r.refreshing,consecutiveFailures:r.consecutiveFailures||0,retryAt:r.retryAt||undefined,lastDurationMs:r.lastDurationMs||undefined})),
    background:{source:cfg.backgroundSource,configured:cfg.backgroundSource==='stock'||(cfg.backgroundSource==='folders'&&!!cfg.mediaFolders?.length)||!!cfg.photosUrl,photosLoaded:(cfg.backgroundSource==='google'||cfg.backgroundSource==='folders')?(configApi.bgSourceImages?.length||0):undefined,stockCategory:cfg.backgroundSource==='stock'?cfg.stockCategory:undefined,stockResolution:cfg.backgroundSource==='stock'?cfg.stockResolution:undefined,mediaFolders:cfg.backgroundSource==='folders'?(cfg.mediaFolders||[]).length:undefined,order:cfg.photoOrder,intervalSec:cfg.photoIntervalSec,status:configApi.lastBackgroundStatus?.error?'error':'ok',updatedAt:configApi.lastBackgroundStatus?.updatedAt||undefined},
    alerts:{enabled:cfg.alertsEnabled,testMode:cfg.alertTestMode,active:configApi.activeWeatherAlerts.length,motion:cfg.alertMotionMode},
    refreshMinutes:{weather:cfg.weatherRefreshMin,calendar:cfg.calendarRefreshMin,alerts:cfg.alertRefreshMin},
    remoteSettings:{mode:bootstrapApi.REMOTE_SETTINGS_MODE?'remote':'local',serverSync:configApi.serverConfigAvailable},
    layout:{mode:cfg.layoutMode||'default',gridPx:cfg.layoutGridPx||20,snap:cfg.layoutSnap!==false,blocks:Object.keys(cfg.layoutBlocks||{})},
    offlineCache:{staleSources:[...new Set([...configApi.staleCacheSources.values()].map(v=>v?.name||'remote data'))]}
  };
}
function diagnosticsJson(){return JSON.stringify(buildDiagnosticsPayload(),null,2);}
async function copyDiagnostics(){
  if(!systemHealthState)await loadSystemHealth();
  const output=diagnosticsJson();
  let copied=false;
  try{await navigator.clipboard.writeText(output);copied=true;}catch(e){}
  if(!copied){
    const ta=document.createElement('textarea');ta.value=output;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{copied=document.execCommand('copy');}catch(e){}ta.remove();
  }
  const el=document.getElementById('diagnostics-status');
  if(el){el.style.display='block';el.textContent=copied?'Diagnostics copied. Private calendar/background URLs and coordinates were omitted.':'Could not copy automatically. Browser clipboard access was blocked.';}
}
async function downloadDiagnostics(){
  if(!systemHealthState)await loadSystemHealth();
  const blob=new Blob([diagnosticsJson()+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  a.href=url;a.download=`LibreDisplay-diagnostics-${stamp}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  const el=document.getElementById('diagnostics-status');if(el){el.style.display='block';el.textContent='Diagnostics downloaded. Private calendar/background URLs and coordinates were omitted.';}
}
function restorePreviousSettings(){
  let prev=null,current=null;
  try{prev=localStorage.getItem(bootstrapApi.CFG_BACKUP_KEY);current=localStorage.getItem(bootstrapApi.CFG_KEY);}catch(e){}
  if(!prev){alert('No previous saved configuration is available yet.');return;}
  if(!confirm('Restore the previous saved dashboard configuration? The current configuration will be kept as the next restore point.'))return;
  try{
    const parsed=JSON.parse(prev);
    if(!parsed||typeof parsed!=='object')throw new Error('Invalid backup');
    if(current)localStorage.setItem(bootstrapApi.CFG_BACKUP_KEY,current);
    const migrated=configApi.migrateConfigSnapshot(parsed,{rejectFuture:true});cfg={...cfg,...migrated};ensureCfgDefaults();cfg._savedAt=Date.now();
    localStorage.setItem(bootstrapApi.CFG_KEY,JSON.stringify(cfg));
    persistCfgToServer(JSON.parse(JSON.stringify(cfg)));
    configApi.alertRuntimeState=null;window.__uiPreviewCfg=null;applySettings();openSetup();
  }catch(e){alert('Could not restore the previous settings.');}
}

if(!window.__ldSystemPerformanceBenchmarkDelegated){window.__ldSystemPerformanceBenchmarkDelegated=true;document.addEventListener('click',event=>{const button=event.target?.closest?.('#system-performance-benchmark-button');if(!button)return;event.preventDefault();runSystemDisplayPerformanceBenchmark().catch(()=>{});});}

document.getElementById('setup')?.addEventListener('input',e=>{
  if(e.target?.id==='s-settings-search'||e.target?.id==='s-import-file')return;
  markSettingsDirty();
  if(e.target?.classList?.contains('cal-enabled')||e.target?.closest?.('.cal-entry'))LibreDisplayRuntime.getModule('onboarding').updateCalendarEntryVisibility();
});
document.getElementById('setup')?.addEventListener('change',e=>{
  if(e.target?.id==='s-settings-search'||e.target?.id==='s-import-file')return;
  markSettingsDirty();
  if(e.target?.classList?.contains('cal-enabled')||e.target?.closest?.('.cal-entry'))LibreDisplayRuntime.getModule('onboarding').updateCalendarEntryVisibility();
});


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("system", {markSettingsDirty,markSettingsClean,setHealth,renderSoftwareUpdateStatus,checkSoftwareUpdate,settingsPanelOpen,autoDetectSoftwareUpdate,startSoftwareUpdateAutoDetection,stopSoftwareUpdateAutoDetection,setSoftwareUpdateActionStatus,sleepMs,monitorSoftwareUpdate,startSoftwareUpdate,setReleaseRollbackStatus,renderReleaseRollbacks,loadReleaseRollbacks,monitorReleaseRollback,startReleaseRollback,formatHealthBytes,formatHealthUptime,renderSystemHealth,renderSystemHealthRefreshStatus,loadSystemHealth,stopSystemHealthAutoRefresh,startSystemHealthAutoRefresh,providerHealthPill,renderProviderHealth,refreshProviderHealth,updateSettingsOverview,physicalDisplayBenchmarkState,renderDisplayPerformanceBenchmark,runSystemDisplayPerformanceBenchmark,buildDiagnosticsPayload,diagnosticsJson,copyDiagnostics,downloadDiagnostics,restorePreviousSettings}, {
  "settingsInitializing": {configurable:true,get:()=>settingsInitializing,set:(value)=>{settingsInitializing=value;}},
  "settingsDirty": {configurable:true,get:()=>settingsDirty,set:(value)=>{settingsDirty=value;}},
  "calendarHideEmpty": {configurable:true,get:()=>calendarHideEmpty,set:(value)=>{calendarHideEmpty=value;}},
  "softwareUpdateState": {configurable:true,get:()=>softwareUpdateState,set:(value)=>{softwareUpdateState=value;}},
  "softwareUpdateCheckPromise": {configurable:true,get:()=>softwareUpdateCheckPromise,set:(value)=>{softwareUpdateCheckPromise=value;}},
  "softwareUpdateMonitorActive": {configurable:true,get:()=>softwareUpdateMonitorActive,set:(value)=>{softwareUpdateMonitorActive=value;}},
  "softwareUpdateAutoTimer": {configurable:true,get:()=>softwareUpdateAutoTimer,set:(value)=>{softwareUpdateAutoTimer=value;}},
  "softwareUpdateAutoLastStarted": {configurable:true,get:()=>softwareUpdateAutoLastStarted,set:(value)=>{softwareUpdateAutoLastStarted=value;}},
  "SOFTWARE_UPDATE_AUTO_CHECK_MS": {configurable:true,get:()=>SOFTWARE_UPDATE_AUTO_CHECK_MS},
  "systemHealthState": {configurable:true,get:()=>systemHealthState,set:(value)=>{systemHealthState=value;}},
  "systemHealthRefreshTimer": {configurable:true,get:()=>systemHealthRefreshTimer,set:(value)=>{systemHealthRefreshTimer=value;}},
  "systemHealthRefreshPromise": {configurable:true,get:()=>systemHealthRefreshPromise,set:(value)=>{systemHealthRefreshPromise=value;}},
  "systemHealthUpdatedAt": {configurable:true,get:()=>systemHealthUpdatedAt,set:(value)=>{systemHealthUpdatedAt=value;}},
  "SYSTEM_HEALTH_REFRESH_MS": {configurable:true,get:()=>SYSTEM_HEALTH_REFRESH_MS},
  "lastDisplayPerformanceBenchmark": {configurable:true,get:()=>lastDisplayPerformanceBenchmark,set:(value)=>{lastDisplayPerformanceBenchmark=value;}},
  "displayPerformanceBenchmarkPromise": {configurable:true,get:()=>displayPerformanceBenchmarkPromise,set:(value)=>{displayPerformanceBenchmarkPromise=value;}},
  "releaseRollbackState": {configurable:true,get:()=>releaseRollbackState,set:(value)=>{releaseRollbackState=value;}},
  "releaseRollbackMonitorActive": {configurable:true,get:()=>releaseRollbackMonitorActive,set:(value)=>{releaseRollbackMonitorActive=value;}}
}, {globalFunctions:['markSettingsDirty','markSettingsClean','setHealth','checkSoftwareUpdate','settingsPanelOpen','autoDetectSoftwareUpdate','startSoftwareUpdateAutoDetection','stopSoftwareUpdateAutoDetection','startSoftwareUpdate','loadReleaseRollbacks','startReleaseRollback','loadSystemHealth','stopSystemHealthAutoRefresh','startSystemHealthAutoRefresh','renderProviderHealth','refreshProviderHealth','updateSettingsOverview','copyDiagnostics','downloadDiagnostics','restorePreviousSettings'],globalStates:[]});
}
// End source section: /js/system/index.js

// LibreDisplay source section: /js/system/profiles.js
{
// Display Profiles and scheduled Scenes management.
const configApi=LibreDisplayRuntime.getModule('config');
const {ensureCfgDefaults,saveCfg,activeProfileIdForEndpoint,setActiveProfileForEndpoint,persistProfiles}=configApi;
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;
const remoteApi=LibreDisplayRuntime.getModule('remote');
const systemApi=LibreDisplayRuntime.getModule('system');
const {escHtml,resilientFetch}=LibreDisplayRuntime.getModule('shared');


function setProfileStatus(text,error=false){
  const el=document.getElementById('profile-status');if(!el)return;
  el.textContent=text||'';el.style.display=text?'block':'none';el.style.color=error?'#fca5a5':'';
}
function profileDisplayName(endpoint){return remoteApi.displayEndpoints.find(e=>e.id===endpoint)?.name||endpoint||'Unknown display';}
function renderProfileEndpointSelect(){
  const sel=document.getElementById('s-profile-endpoint');if(!sel)return;
  const current=sel.value||bootstrapApi.ACTIVE_ENDPOINT,rows=remoteApi.displayEndpoints.length?remoteApi.displayEndpoints:[{id:bootstrapApi.ACTIVE_ENDPOINT,name:bootstrapApi.ACTIVE_ENDPOINT}];
  sel.innerHTML='';for(const e of rows)sel.append(new Option(`${e.name||e.id}${e.id===bootstrapApi.ACTIVE_ENDPOINT?' · current':''}`,e.id));
  sel.value=rows.some(e=>e.id===current)?current:bootstrapApi.ACTIVE_ENDPOINT;
}
function renderProfileSelect(){
  const sel=document.getElementById('s-profile-select');if(!sel)return;
  const active=activeProfileIdForEndpoint(),current=sel.value||active||'';
  sel.innerHTML='';
  if(!configApi.profileStore.items.length){sel.append(new Option('No saved profiles yet',''));}
  else{
    sel.append(new Option('Choose a profile…',''));
    configApi.profileStore.items.forEach(p=>{const origin=p.sourceEndpoint?` · from ${p.sourceDisplayName||profileDisplayName(p.sourceEndpoint)}`:'';sel.append(new Option((p.id===active?'★ ':'')+p.name+origin,p.id));});
  }
  sel.value=configApi.profileStore.items.some(p=>p.id===current)?current:(active||'');
  renderProfileEndpointSelect();updateProfileControls();
}
function updateProfileControls(){
  const sel=document.getElementById('s-profile-select'),name=document.getElementById('s-profile-name'),target=document.getElementById('s-profile-endpoint');
  const p=configApi.profileStore.items.find(x=>x.id===sel?.value);
  if(name&&p)name.value=p.name;
  if(target&&!target.value)target.value=bootstrapApi.ACTIVE_ENDPOINT;
}
function uniqueProfileId(){return 'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);}
function profileSnapshot(){const snap=JSON.parse(JSON.stringify(cfg));delete snap._savedAt;return snap;}
function currentDisplayProfileMeta(){return {sourceEndpoint:bootstrapApi.ACTIVE_ENDPOINT,sourceDisplayName:profileDisplayName(bootstrapApi.ACTIVE_ENDPOINT)};}
function createProfile(){
  if(systemApi.settingsDirty){setProfileStatus('Save & Apply your current changes before creating a profile.',true);return;}
  const name=(document.getElementById('s-profile-name')?.value||'').trim();
  if(!name){setProfileStatus('Enter a profile name first.',true);return;}
  const id=uniqueProfileId();
  configApi.profileStore.items.push({id,name:name.slice(0,48),config:profileSnapshot(),updatedAt:Date.now(),...currentDisplayProfileMeta()});
  setActiveProfileForEndpoint(bootstrapApi.ACTIVE_ENDPOINT,id);persistProfiles();renderProfileSelect();
  document.getElementById('s-profile-select').value=id;setProfileStatus(`Saved profile “${name}” from ${profileDisplayName(bootstrapApi.ACTIVE_ENDPOINT)}.`);
}
function updateSelectedProfile(){
  if(systemApi.settingsDirty){setProfileStatus('Save & Apply your current changes before updating a profile.',true);return;}
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id);
  if(!p){setProfileStatus('Choose a saved profile first.',true);return;}
  p.config=profileSnapshot();p.updatedAt=Date.now();Object.assign(p,currentDisplayProfileMeta());setActiveProfileForEndpoint(bootstrapApi.ACTIVE_ENDPOINT,id);persistProfiles();renderProfileSelect();
  document.getElementById('s-profile-select').value=id;setProfileStatus(`Updated “${p.name}” from the currently saved ${profileDisplayName(bootstrapApi.ACTIVE_ENDPOINT)} dashboard.`);
}
function duplicateSelectedProfile(){
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id);if(!p){setProfileStatus('Choose a profile to duplicate first.',true);return;}
  const copyId=uniqueProfileId(),copyName=(p.name+' copy').slice(0,48);configApi.profileStore.items.push({...JSON.parse(JSON.stringify(p)),id:copyId,name:copyName,updatedAt:Date.now()});persistProfiles();renderProfileSelect();document.getElementById('s-profile-select').value=copyId;document.getElementById('s-profile-name').value=copyName;setProfileStatus(`Duplicated “${p.name}”.`);
}
function renameSelectedProfile(){
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id);
  const name=(document.getElementById('s-profile-name')?.value||'').trim();
  if(!p||!name){setProfileStatus('Choose a profile and enter its new name.',true);return;}
  p.name=name.slice(0,48);p.updatedAt=Date.now();persistProfiles();renderProfileSelect();document.getElementById('s-profile-select').value=id;setProfileStatus('Profile renamed.');
}
function deleteSelectedProfile(){
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id);
  if(!p){setProfileStatus('Choose a saved profile first.',true);return;}
  if(!confirm(`Delete profile “${p.name}”? This does not delete any display's current saved settings.`))return;
  configApi.profileStore.items=configApi.profileStore.items.filter(x=>x.id!==id);for(const [endpoint,active] of Object.entries(configApi.profileStore.activeByEndpoint||{}))if(active===id)delete configApi.profileStore.activeByEndpoint[endpoint];if(configApi.profileStore.activeId===id)configApi.profileStore.activeId='';persistProfiles();renderProfileSelect();setProfileStatus('Profile deleted.');
}
async function loadSelectedProfile(){
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id);
  if(!p){setProfileStatus('Choose a saved profile first.',true);return;}
  if(systemApi.settingsDirty&&!confirm('Discard unsaved changes and load this profile?'))return;
  const migrated=configApi.migrateConfigSnapshot(p.config,{rejectFuture:true});cfg={...cfg,...migrated};ensureCfgDefaults();cfg.onboardingComplete=true;
  setActiveProfileForEndpoint(bootstrapApi.ACTIVE_ENDPOINT,id);persistProfiles();await saveCfg();configApi.alertRuntimeState=null;window.__uiPreviewCfg=null;applySettings();openSetup(false);setProfileStatus(`Loaded “${p.name}” on ${profileDisplayName(bootstrapApi.ACTIVE_ENDPOINT)}.`);
}
function endpointConfigPath(endpoint){return '/api/config?endpoint='+encodeURIComponent(endpoint||bootstrapApi.ACTIVE_ENDPOINT);}
async function applySelectedProfileToDisplay(){
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id),endpoint=document.getElementById('s-profile-endpoint')?.value||bootstrapApi.ACTIVE_ENDPOINT;
  if(!p){setProfileStatus('Choose a saved profile first.',true);return;}
  const label=profileDisplayName(endpoint);if(!confirm(`Apply profile “${p.name}” to “${label}”?

This replaces that display's saved dashboard configuration. The profile itself is not changed.`))return;
  try{const next=configApi.migrateConfigSnapshot(p.config,{rejectFuture:true});next.onboardingComplete=true;next._savedAt=Date.now();const res=await resilientFetch(endpointConfigPath(endpoint),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:next}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));setActiveProfileForEndpoint(endpoint,id);persistProfiles();if(endpoint===bootstrapApi.ACTIVE_ENDPOINT){cfg={...cfg,...next};ensureCfgDefaults();try{localStorage.setItem(bootstrapApi.CFG_KEY,JSON.stringify(cfg));}catch{}configApi.alertRuntimeState=null;window.__uiPreviewCfg=null;applySettings();setAppearanceForm(cfg);}setProfileStatus(`Applied “${p.name}” to ${label}.`);renderProfileSelect();}catch(e){setProfileStatus('Could not apply profile: '+(e.message||e),true);}
}
async function captureTargetDisplayAsProfile(){
  const endpoint=document.getElementById('s-profile-endpoint')?.value||bootstrapApi.ACTIVE_ENDPOINT,label=profileDisplayName(endpoint);let name=(document.getElementById('s-profile-name')?.value||'').trim();if(!name)name=label;
  try{const res=await resilientFetch(endpointConfigPath(endpoint),{cache:'no-store'}),data=await res.json();if(!res.ok||!data.ok||!data.config)throw new Error(data.error||'That display does not have a saved configuration yet.');const id=uniqueProfileId();const snap=configApi.migrateConfigSnapshot(data.config,{rejectFuture:true});delete snap._savedAt;configApi.profileStore.items.push({id,name:name.slice(0,48),config:snap,updatedAt:Date.now(),sourceEndpoint:endpoint,sourceDisplayName:label});persistProfiles();renderProfileSelect();document.getElementById('s-profile-select').value=id;document.getElementById('s-profile-name').value=name.slice(0,48);setProfileStatus(`Captured ${label} as profile “${name.slice(0,48)}”.`);}catch(e){setProfileStatus('Could not capture display: '+(e.message||e),true);}
}

function sceneProfileOptions(selected='',allowEmpty=true){
  let html=allowEmpty?'<option value="">No base profile</option>':'';
  for(const p of configApi.profileStore.items)html+=`<option value="${escHtml(p.id)}"${p.id===selected?' selected':''}>${escHtml(p.name)}</option>`;
  return html;
}
function sceneRuleId(){return 's_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);}
function normalizeClientSceneStore(raw){
  const src=raw&&typeof raw==='object'?raw:{};return {version:1,automatic:src.automatic!==false,baseProfiles:src.baseProfiles&&typeof src.baseProfiles==='object'?src.baseProfiles:{},items:Array.isArray(src.items)?src.items:[]};
}
async function loadScenes(){
  const status=document.getElementById('scene-status');
  try{const res=await resilientFetch(serverPath('/api/scenes'),{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);const data=await res.json();configApi.sceneStore=normalizeClientSceneStore(data.scenes);configApi.sceneActive=data.active||{};renderScenes();if(status)status.textContent=configApi.sceneActive[bootstrapApi.ACTIVE_ENDPOINT]?`Active scheduled profile: ${configApi.profileStore.items.find(p=>p.id===configApi.sceneActive[bootstrapApi.ACTIVE_ENDPOINT])?.name||configApi.sceneActive[bootstrapApi.ACTIVE_ENDPOINT]}`:'No scheduled scene is active right now.';}catch(e){if(status)status.textContent='Could not load schedules: '+(e.message||e);}
}
function renderScenes(){
  const auto=document.getElementById('scene-automatic');if(auto)auto.checked=configApi.sceneStore.automatic!==false;
  const base=document.getElementById('scene-base-profile');if(base)base.innerHTML=sceneProfileOptions(configApi.sceneStore.baseProfiles?.[bootstrapApi.ACTIVE_ENDPOINT]||'',true);
  const host=document.getElementById('scene-list');if(!host)return;const rows=(configApi.sceneStore.items||[]).filter(x=>(x.endpoint||'main')===bootstrapApi.ACTIVE_ENDPOINT);host.innerHTML='';
  if(!rows.length){host.innerHTML='<div class="settings-note">No scheduled scenes for this display yet.</div>';return;}
  const dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  for(const row of rows){const wrap=document.createElement('div');wrap.className='scene-row';wrap.dataset.sceneId=row.id;wrap.innerHTML=`<div class="scene-row-head"><label class="checkline"><input class="scene-enabled" type="checkbox" ${row.enabled!==false?'checked':''}> <input class="scene-name" value="${escHtml(row.name||'Scene')}" maxlength="80" style="width:min(260px,60vw)"></label><button class="btn-util" type="button" data-ld-action-click="system.removeSceneRule" data-ld-action-args="${escHtml(JSON.stringify([row.id]))}">Remove</button></div><div class="scene-fields"><div class="s-row"><label>Profile</label><select class="scene-profile">${sceneProfileOptions(row.profileId||'',false)}</select></div><div class="s-row"><label>Start</label><input class="scene-start" type="time" value="${escHtml(row.start||'00:00')}"></div><div class="s-row"><label>End</label><input class="scene-end" type="time" value="${escHtml(row.end||'23:59')}"></div></div><div class="scene-days">${dn.map((d,i)=>`<label><input type="checkbox" class="scene-day" data-day="${i}" ${(row.days||[0,1,2,3,4,5,6]).includes(i)?'checked':''}> ${d}</label>`).join('')}</div>`;host.appendChild(wrap);}
}
function collectScenesFromUi(){
  configApi.sceneStore.automatic=document.getElementById('scene-automatic')?.checked!==false;configApi.sceneStore.baseProfiles=configApi.sceneStore.baseProfiles||{};const base=document.getElementById('scene-base-profile')?.value||'';if(base)configApi.sceneStore.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT]=base;else delete configApi.sceneStore.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT];
  const keep=(configApi.sceneStore.items||[]).filter(x=>(x.endpoint||'main')!==bootstrapApi.ACTIVE_ENDPOINT);for(const el of document.querySelectorAll('#scene-list .scene-row')){const days=[...el.querySelectorAll('.scene-day:checked')].map(x=>Number(x.dataset.day));const profileId=el.querySelector('.scene-profile')?.value||'';if(!profileId)continue;keep.push({id:el.dataset.sceneId||sceneRuleId(),name:(el.querySelector('.scene-name')?.value||'Scene').trim().slice(0,80)||'Scene',endpoint:bootstrapApi.ACTIVE_ENDPOINT,profileId,days:days.length?days:[0,1,2,3,4,5,6],start:el.querySelector('.scene-start')?.value||'00:00',end:el.querySelector('.scene-end')?.value||'23:59',enabled:el.querySelector('.scene-enabled')?.checked!==false});}configApi.sceneStore.items=keep;
}
function addSceneRule(){if(!configApi.profileStore.items.length){document.getElementById('scene-status').textContent='Create at least one Profile before adding a scene.';return;}collectScenesFromUi();configApi.sceneStore.items.push({id:sceneRuleId(),name:'New scene',endpoint:bootstrapApi.ACTIVE_ENDPOINT,profileId:configApi.profileStore.items[0].id,days:[0,1,2,3,4,5,6],start:'07:00',end:'22:00',enabled:true});renderScenes();}
function removeSceneRule(id){collectScenesFromUi();configApi.sceneStore.items=configApi.sceneStore.items.filter(x=>x.id!==id);renderScenes();}
async function saveScenes(){collectScenesFromUi();const status=document.getElementById('scene-status');try{const res=await resilientFetch(serverPath('/api/scenes'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenes:configApi.sceneStore}),cache:'no-store'});if(!res.ok)throw new Error(await res.text());if(status)status.textContent='Schedules saved. The server will apply matching scenes automatically.';setTimeout(loadScenes,400);}catch(e){if(status)status.textContent='Could not save schedules: '+(e.message||e);}}


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("system", {setProfileStatus,profileDisplayName,renderProfileEndpointSelect,renderProfileSelect,updateProfileControls,uniqueProfileId,profileSnapshot,currentDisplayProfileMeta,createProfile,updateSelectedProfile,duplicateSelectedProfile,renameSelectedProfile,deleteSelectedProfile,loadSelectedProfile,endpointConfigPath,applySelectedProfileToDisplay,captureTargetDisplayAsProfile,sceneProfileOptions,sceneRuleId,normalizeClientSceneStore,loadScenes,renderScenes,collectScenesFromUi,addSceneRule,removeSceneRule,saveScenes}, {}, {globalFunctions:['updateProfileControls','createProfile','updateSelectedProfile','duplicateSelectedProfile','renameSelectedProfile','deleteSelectedProfile','loadSelectedProfile','applySelectedProfileToDisplay','captureTargetDisplayAsProfile','loadScenes','addSceneRule','removeSceneRule','saveScenes']});
}
// End source section: /js/system/profiles.js
