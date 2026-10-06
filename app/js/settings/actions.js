const configApi=LibreDisplayRuntime.getModule('config');
const settingsApi=()=>LibreDisplayRuntime.getModule("settings");
const {resilientFetch}=LibreDisplayRuntime.getModule('shared');
// Settings test actions, quick access, refresh, and fullscreen controls.

const {readCalendarInputs,syncCalendarEditorRows}=LibreDisplayRuntime.getModule('onboarding');
const {loadFolderBackgrounds,loadStockBackground,loadPhotos}=LibreDisplayRuntime.getModule('backgrounds');
const calendarApi=LibreDisplayRuntime.getModule('calendar');
const {updateCalStatusUI,fetchCal,loadCalendars}=calendarApi;
const {fetchWeather,fetchWeatherAlerts}=LibreDisplayRuntime.getModule('weather');
async function testCalendarInputs(){
  const calendars=readCalendarInputs().filter(c=>c.enabled!==false);
  if(!calendars.length){
    calendarApi.calStatuses=[{label:'Calendars',ok:false,error:'No calendar URLs entered'}];
    updateCalStatusUI();
    return;
  }
  calendarApi.calStatuses=calendars.map(c=>({label:c.label,pending:true}));
  updateCalStatusUI();
  await Promise.all(calendars.map((c,i)=>fetchCal(c,i,{preferFormUrl:true})));
}

async function testSingleCalendarSource(id){
  syncCalendarEditorRows();
  const row=configApi.calendarEditorRows.find(c=>c.id===id);
  if(!row)return;
  if(!row.url){calendarApi.calStatuses=[{label:row.label||'Calendar',ok:false,error:'Enter a calendar URL first'}];updateCalStatusUI();return;}
  calendarApi.calStatuses=[{label:row.label||'Calendar',pending:true}];
  updateCalStatusUI();
  await fetchCal(row,0,{preferFormUrl:true});
}

let quickAccessMenuOpen=false;
function positionQuickAccessMenu(){const cog=document.getElementById('cog'),menu=document.getElementById('quick-access-menu');if(!cog||!menu)return;const r=cog.getBoundingClientRect(),gap=9;menu.style.left=menu.style.right=menu.style.top=menu.style.bottom='auto';if(r.left>window.innerWidth/2)menu.style.right=Math.max(10,window.innerWidth-r.right)+'px';else menu.style.left=Math.max(10,r.left)+'px';if(r.top>window.innerHeight/2)menu.style.bottom=Math.max(10,window.innerHeight-r.top+gap)+'px';else menu.style.top=Math.max(10,r.bottom+gap)+'px';}
function closeQuickAccessMenu(){quickAccessMenuOpen=false;const menu=document.getElementById('quick-access-menu'),cog=document.getElementById('cog');menu?.classList.remove('show');menu?.setAttribute('aria-hidden','true');cog?.setAttribute('aria-expanded','false');}
function toggleQuickAccessMenu(e){e?.stopPropagation?.();const menu=document.getElementById('quick-access-menu'),cog=document.getElementById('cog');if(!menu||!cog)return;if(quickAccessMenuOpen){closeQuickAccessMenu();return;}quickAccessMenuOpen=true;positionQuickAccessMenu();menu.classList.add('show');menu.setAttribute('aria-hidden','false');cog.setAttribute('aria-expanded','true');setTimeout(()=>menu.querySelector('button')?.focus({preventScroll:true}),0);}
function quickAccessArrange(){closeQuickAccessMenu();startLayoutEditor();}
function quickAccessAddBlock(){closeQuickAccessMenu();startLayoutEditor();setTimeout(()=>openBlockCatalog(),60);}
function quickAccessSettings(tab='overview'){closeQuickAccessMenu();openSetup();setTimeout(()=>switchSettingsTab(tab),20);}
function quickAccessIntegrations(){quickAccessSettings('integrations');}
function updateAnimationPerformanceUi(){
  const performanceApi=LibreDisplayRuntime.getModule('performance'),select=document.getElementById('s-animation-performance-mode'),status=document.getElementById('animation-performance-status'),snapshot=performanceApi.animationPerformanceSnapshot?.()||{},caps=performanceApi.frontendCapabilities?.()||{};if(select&&document.activeElement!==select)select.value=cfg.animationPerformanceMode||'auto';if(status){const fps=snapshot.fps>0?`${snapshot.fps.toFixed(1)} FPS`:'measuring FPS',drop=Number.isFinite(snapshot.droppedPct)?`${snapshot.droppedPct.toFixed(1)}% delayed frames`:'measuring drops',device=caps.piClass?'Pi-class display':'standard display';status.textContent=`${fps} · target ${snapshot.targetFps||60} · ${drop} · ${snapshot.renderer||'browser compositor'} · ${device}`;}
}
async function setAnimationPerformanceMode(mode){const allowed=new Set(['auto','smooth','balanced','fidelity']);cfg.animationPerformanceMode=allowed.has(String(mode))?String(mode):'auto';LibreDisplayRuntime.getModule('performance').refreshAnimationPerformanceMode?.();updateAnimationPerformanceUi();const result=await configApi.saveCfg();settingsApi().applySettings();LibreDisplayRuntime.getModule('weatherEffects')?.refreshWeatherEffects?.();updateAnimationPerformanceUi();return result;}
function updateLightweightModeUi(){
  const enabled=cfg.lightweightModeEnabled===true,status=document.getElementById('lightweight-mode-status'),toggle=document.getElementById('s-lightweight-mode'),quick=document.getElementById('quick-lightweight-toggle');
  if(toggle)toggle.checked=enabled;if(status)status.textContent=LibreDisplayRuntime.getModule('performance').lightweightModeSummary(cfg);
  if(quick){quick.classList.toggle('active',enabled);const strong=quick.querySelector('strong'),copy=quick.querySelector('span');if(strong)strong.textContent=`Lightweight mode: ${enabled?'On':'Off'}`;if(copy)copy.textContent=enabled?'Heavy visuals are paused. Tap to restore your saved settings.':'Pause heavy visuals temporarily without changing saved settings.';}
}
async function setLightweightMode(enabled){
  cfg.lightweightModeEnabled=!!enabled;if(cfg.lightweightModeEnabled)for(const video of document.querySelectorAll('.bg-layer video')){try{video.pause();}catch(_e){}}updateLightweightModeUi();const result=await configApi.saveCfg();settingsApi().applySettings();updateLightweightModeUi();return result;
}
function toggleLightweightMode(force){return setLightweightMode(typeof force==='boolean'?force:cfg.lightweightModeEnabled!==true);}
function quickAccessToggleLightweight(){closeQuickAccessMenu();return toggleLightweightMode();}
document.getElementById('s-lightweight-mode')?.addEventListener('change',event=>toggleLightweightMode(event.currentTarget.checked));
document.getElementById('s-animation-performance-mode')?.addEventListener('change',event=>setAnimationPerformanceMode(event.currentTarget.value));
LibreDisplayRuntime.getModule('performance').startManagedInterval?.('settings-animation-diagnostics',()=>{if(!document.getElementById('setup')?.classList.contains('hidden'))updateAnimationPerformanceUi();},2500,{skipWhenHidden:true});
document.getElementById('quick-lightweight-toggle')?.addEventListener('click',quickAccessToggleLightweight);
function quickAccessRefresh(){closeQuickAccessMenu();refreshDataNow();}
function quickAccessUseDevice(){closeQuickAccessMenu();requestDeviceDisplayMode('windowed');}
function quickAccessFullscreen(){closeQuickAccessMenu();requestDeviceDisplayMode('kiosk');}
function toggleLayoutShortcuts(force){const panel=document.getElementById('layout-shortcuts-panel');if(!panel)return;const show=typeof force==='boolean'?force:!panel.classList.contains('show');panel.classList.toggle('show',show);panel.setAttribute('aria-hidden',show?'false':'true');}
document.addEventListener('pointerdown',e=>{const menu=document.getElementById('quick-access-menu');if(quickAccessMenuOpen&&!menu?.contains(e.target)&&e.target!==document.getElementById('cog'))closeQuickAccessMenu();});
window.addEventListener('resize',()=>{if(quickAccessMenuOpen)positionQuickAccessMenu();});

function refreshDataNow(){
  fetchWeather();
  fetchWeatherAlerts();
  loadCalendars();
  if(cfg.backgroundSource==='stock')loadStockBackground();
  else if(cfg.backgroundSource==='folders'&&cfg.mediaFolders?.length)loadFolderBackgrounds(cfg.mediaFolders,cfg.mediaRecursive);
  else if(cfg.backgroundSource==='google'&&cfg.photosUrl)loadPhotos(cfg.photosUrl);
}

async function requestDeviceDisplayMode(mode){
  const target=mode==='windowed'?'windowed':'kiosk';
  try{
    const response=await resilientFetch('/api/display-mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:target})},{retry:false,timeoutMs:5000});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`HTTP ${response.status}`);
    return true;
  }catch(error){
    console.warn('device display mode request failed',error);
    if(target==='kiosk'){await enterFullscreen();return false;}
    if(document.fullscreenElement&&document.exitFullscreen){try{await document.exitFullscreen();return false;}catch(_e){}}
    alert('Windowed device mode can only be requested from the local LibreDisplay screen.');
    return false;
  }
}
async function enterFullscreen(){
  try{
    if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
  }catch(e){console.warn('fullscreen request failed',e);}
}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&settingsApi().activeContextHelpTip){e.preventDefault();hideContextHelp(true);return;}
  if(e.key==='Escape'&&quickAccessMenuOpen){e.preventDefault();closeQuickAccessMenu();document.getElementById('cog')?.focus({preventScroll:true});return;}
  if(e.key==='Escape'&&settingsApi().settingsPreviewMode){e.preventDefault();returnToSettingsPreview();return;}
  if(remoteLayoutProxyActive){
    const win=remoteLayoutFrame()?.contentWindow,doc=remoteLayoutInnerDocument(),editingText=!!e.target?.closest?.('input,textarea,select,button,[contenteditable="true"]');
    if(e.key==='Escape'){e.preventDefault();if(doc?.getElementById('block-config-modal')?.classList.contains('show'))win?.closeBlockConfig?.();else if(doc?.getElementById('block-catalog')?.classList.contains('show'))win?.closeBlockCatalog?.();else if(doc?.getElementById('layout-shortcuts-panel')?.classList.contains('show'))win?.toggleLayoutShortcuts?.(false);else win?.cancelLayoutEditor?.();scheduleRemoteLayoutProxySync();return;}
    if(!editingText&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();win?.saveLayoutEditor?.();return;}
    if(!editingText&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)win?.redoLayoutEditor?.();else win?.undoLayoutEditor?.();scheduleRemoteLayoutProxySync();return;}
    if(!editingText&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();win?.redoLayoutEditor?.();scheduleRemoteLayoutProxySync();return;}
    if(!editingText&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();win?.duplicateSelectedCustomBlock?.();scheduleRemoteLayoutProxySync();return;}
    if(!editingText&&(e.key==='Delete'||e.key==='Backspace')){if(win?.deleteSelectedCustomBlock?.(false)){e.preventDefault();scheduleRemoteLayoutProxySync();}return;}
    if(!editingText&&e.key==='Enter'){if(doc?.querySelector('.layout-edit-box.selected[data-layout-key^="custom:"]')){e.preventDefault();win?.configureSelectedCustomBlock?.();scheduleRemoteLayoutProxySync();}return;}
    if(!editingText&&e.key.toLowerCase()==='a'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();win?.openBlockCatalog?.();scheduleRemoteLayoutProxySync();return;}
    if(!editingText&&e.key==='?'){e.preventDefault();win?.toggleLayoutShortcuts?.();scheduleRemoteLayoutProxySync();return;}
    if(!editingText&&(e.key==='['||e.key===']')){e.preventDefault();win?.changeSelectedBlockLayer?.(e.key==='['?-1:1);scheduleRemoteLayoutProxySync();return;}
    if(!editingText&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&win?.nudgeSelectedLayoutBlock?.(e.key,e.shiftKey)){e.preventDefault();scheduleRemoteLayoutProxySync();return;}
  }
  if(layoutEditorActive){
    const interactive=!!e.target?.closest?.('input,textarea,select,button,[contenteditable="true"]'),configOpen=document.getElementById('block-config-modal')?.classList.contains('show'),catalogOpen=document.getElementById('block-catalog')?.classList.contains('show'),shortcutsOpen=document.getElementById('layout-shortcuts-panel')?.classList.contains('show');
    if(e.key==='Escape'){e.preventDefault();if(configOpen)closeBlockConfig();else if(catalogOpen)closeBlockCatalog();else if(shortcutsOpen)toggleLayoutShortcuts(false);else cancelLayoutEditor();return;}
    if(interactive)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveLayoutEditor();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redoLayoutEditor();else undoLayoutEditor();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redoLayoutEditor();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelectedCustomBlock();return;}
    if(e.key==='Delete'||e.key==='Backspace'){if(deleteSelectedCustomBlock(false))e.preventDefault();return;}
    if(e.key==='Enter'&&customKeyId(layoutSelectedKey)){e.preventDefault();configureSelectedCustomBlock();return;}
    if(e.key.toLowerCase()==='a'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();openBlockCatalog();return;}
    if(e.key==='?'){e.preventDefault();toggleLayoutShortcuts();return;}
    if(e.key==='['||e.key===']'){if(customKeyId(layoutSelectedKey)){e.preventDefault();changeSelectedBlockLayer(e.key==='['?-1:1);}return;}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&nudgeSelectedLayoutBlock(e.key,e.shiftKey)){e.preventDefault();return;}
    return;
  }
  const open=!document.getElementById('setup').classList.contains('hidden');
  if(!open)return;
  if(e.key==='Escape'){
    e.preventDefault();requestCloseSetup();return;
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){
    e.preventDefault();saveSetup();return;
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
    e.preventDefault();document.getElementById('s-settings-search')?.focus();return;
  }
});


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("settings", {testCalendarInputs,testSingleCalendarSource,positionQuickAccessMenu,closeQuickAccessMenu,toggleQuickAccessMenu,quickAccessArrange,quickAccessAddBlock,quickAccessSettings,quickAccessIntegrations,updateLightweightModeUi,updateAnimationPerformanceUi,setAnimationPerformanceMode,setLightweightMode,toggleLightweightMode,quickAccessToggleLightweight,quickAccessRefresh,quickAccessUseDevice,quickAccessFullscreen,toggleLayoutShortcuts,refreshDataNow,requestDeviceDisplayMode,enterFullscreen}, {
  "quickAccessMenuOpen": {configurable:true,get:()=>quickAccessMenuOpen,set:(value)=>{quickAccessMenuOpen=value;}}
}, {globalFunctions:['testCalendarInputs','testSingleCalendarSource','closeQuickAccessMenu','toggleQuickAccessMenu','quickAccessArrange','quickAccessAddBlock','quickAccessSettings','quickAccessIntegrations','quickAccessRefresh','quickAccessUseDevice','quickAccessFullscreen','toggleLayoutShortcuts','refreshDataNow','requestDeviceDisplayMode','enterFullscreen'],globalStates:[]});
