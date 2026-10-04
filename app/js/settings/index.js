// Settings shell, save/apply flow, session mode, and discovery.

const systemApi=LibreDisplayRuntime.getModule('system');
const {setProfileStatus,renderProfileSelect}=systemApi;
const {loadDisplayEndpoints,loadRemoteInfo,loadCacheStatus,showSettingsInitializationError,clearSettingsInitializationError}=LibreDisplayRuntime.getModule('remote');
const onboardingApi=LibreDisplayRuntime.getModule('onboarding');
const {setWizardMode,renderCalendarSourceList,renderCalendarOrderList,bindCalendarColorControls,bindCalendarUxInputs,updateCalendarEntryVisibility,savedWeatherLocation,weatherLocationSearchText,renderWeatherLocationSelected}=onboardingApi;
const configApi=LibreDisplayRuntime.getModule('config');
const {ensureCfgDefaults}=configApi;
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;const {resilientFetch}=LibreDisplayRuntime.getModule('shared');
const {setBackgroundStatus}=LibreDisplayRuntime.getModule('backgrounds');
const {updateCalStatusUI,renderCalendar}=LibreDisplayRuntime.getModule('calendar');
const {tick,renderWeather,renderWeatherDetailsSettings,previewAlertSize,syncAlertRuntimeStateFromForm,previewAlertMotionSpeed,setAlertStatus,restartAlertScroller,fetchWeatherAlerts,ensureAlertMotionRunning}=LibreDisplayRuntime.getModule('weather');
const appearanceApi=LibreDisplayRuntime.getModule('appearance');
let settingsPreviewMode=false;
function setSettingsPreviewReturnVisible(on){
  const btn=document.getElementById('settings-preview-return');if(!btn)return;
  btn.classList.toggle('show',!!on);btn.setAttribute('aria-hidden',on?'false':'true');
}
function previewDashboardFromSettings(){
  const setup=document.getElementById('setup');if(!setup||setup.classList.contains('hidden'))return;
  previewAppearance();
  hideContextHelp(true);
  syncAlertRuntimeStateFromForm();
  settingsPreviewMode=true;
  setup.classList.add('hidden');setup.setAttribute('aria-hidden','true');
  setSettingsPreviewReturnVisible(true);
  fetchWeatherAlerts();
  setTimeout(()=>restartAlertScroller(),100);
}
function returnToSettingsPreview(){
  if(!settingsPreviewMode)return;
  const setup=document.getElementById('setup');
  settingsPreviewMode=false;
  setSettingsPreviewReturnVisible(false);
  setup?.classList.remove('hidden');setup?.setAttribute('aria-hidden','false');
  if(bootstrapApi.SESSION_ROLE==='owner')loadSystemHealth();
  setTimeout(()=>restartAlertScroller(),80);
}
function requestCloseSetup(){
  if(settingsPreviewMode){returnToSettingsPreview();return;}
  if(systemApi.settingsDirty&&!confirm('Discard unsaved changes? Your dashboard will return to the last saved settings.'))return;
  closeSetup(true);
}

function restoreSavedSettingsPreview(){
  appearanceApi.settingsLayoutPresetKey='current';
  window.__uiPreviewCfg=null;configApi.alertRuntimeState=null;
  // Always restore the Settings form itself, even when the modal is being closed.
  // This prevents a discarded preset/template from becoming the starting point
  // the next time Settings opens.
  setAppearanceForm(cfg);
  // Restore the saved presentation immediately from in-memory data; do not wait
  // for a provider/network refresh before rebuilding generated weather/calendar DOM.
  applyUiCustomization(cfg);
  if(configApi.wxData)renderWeather(configApi.wxData);
  renderCalendar(window.__lastCalendarEvents||[]);
  renderWeatherDetailsSettings();
  tick();
  // Restart normal refresh timers after the synchronous rollback is visible.
  applySettings();
}
function closeSetup(revertPreview=true){
  stopSystemHealthAutoRefresh();
  stopSoftwareUpdateAutoDetection();
  settingsPreviewMode=false;
  setSettingsPreviewReturnVisible(false);
  systemApi.settingsInitializing=false;
  setWizardMode(false);
  document.getElementById('setup').classList.add('hidden');document.getElementById('setup').setAttribute('aria-hidden','true');
  window.__uiPreviewCfg=null;
  if(revertPreview)restoreSavedSettingsPreview();
  setTimeout(()=>restartAlertScroller(),80);
}
function skipSetup(){closeSetup();}

document.addEventListener('visibilitychange',()=>{if(!document.hidden){setTimeout(ensureAlertMotionRunning,120);if(settingsPanelOpen()){setTimeout(()=>autoDetectSoftwareUpdate('visible'),400);if(bootstrapApi.SESSION_ROLE==='owner')setTimeout(()=>loadSystemHealth(),250);}}});
window.addEventListener('resize',()=>setTimeout(ensureAlertMotionRunning,120));

function openSetup(startWizard=false){
  closeQuickAccessMenu();
  if(settingsPreviewMode){returnToSettingsPreview();return;}
  appearanceApi.settingsLayoutPresetKey='current';
  setTimeout(()=>{loadRemoteInfo();loadCacheStatus();loadDisplayEndpoints();loadHouseholdSettings();loadIntegrationHealth();loadReleaseRollbacks();},0);
  systemApi.settingsInitializing=true;
  clearSettingsInitializationError();
  ensureCfgDefaults();
  const settingsSearch=document.getElementById('s-settings-search');if(settingsSearch)settingsSearch.value='';
  const searchStatus=document.getElementById('settings-search-status');if(searchStatus){searchStatus.style.display='none';searchStatus.textContent='';}
  loadSettingsViewMode();
  enhanceSettingsSections();
  enhanceSettingsControlHelp();
  let rememberedTab='overview';
  try{rememberedTab=sessionStorage.getItem('libredisplay_settings_tab')||'overview';}catch(e){}
  switchSettingsTab(rememberedTab,false);
  document.getElementById('setup').classList.remove('hidden');document.getElementById('setup').setAttribute('aria-hidden','false');
  startSystemHealthAutoRefresh();
  startSoftwareUpdateAutoDetection();
  try{
    bindCalendarColorControls();
    bindCalendarUxInputs();
    renderProfileSelect();
    setProfileStatus('');
    loadScenes();
    document.getElementById('s-city').value=cfg.city||'';
    onboardingApi.pendingWeatherLocation=savedWeatherLocation();onboardingApi.weatherLocationSearchResults=[];
    if(onboardingApi.pendingWeatherLocation)document.getElementById('s-city').value=weatherLocationSearchText(onboardingApi.pendingWeatherLocation);
    document.getElementById('s-locname').value=cfg.locName||'';
    document.getElementById('weather-location-results')?.replaceChildren();const locationStatus=document.getElementById('weather-location-search-status');if(locationStatus)locationStatus.textContent=onboardingApi.pendingWeatherLocation?'Saved coordinates verified below.':'No saved coordinates yet — search and choose a place.';renderWeatherLocationSelected();
    configApi.calendarEditorRows=(cfg.calendars||[]).map(c=>({...c}));
    renderCalendarSourceList(configApi.calendarEditorRows);
    updateCalStatusUI();
    document.getElementById('s-bg-source').value=cfg.backgroundSource||'google';
    document.getElementById('s-stock-category').value=cfg.stockCategory||'nature';
    document.getElementById('s-stock-query').value=cfg.stockQuery||'';
    document.getElementById('s-stock-resolution').value=cfg.stockResolution||'3840x2160';
    document.getElementById('s-photos').value=cfg.photosUrl||'';
    document.getElementById('s-media-folders').value=(cfg.mediaFolders||[]).join('\n');
    document.getElementById('s-media-recursive').checked=cfg.mediaRecursive!==false;
    document.getElementById('s-background-motion').checked=cfg.backgroundMotionEnabled===true;
    updateBackgroundSourceUI();
    document.getElementById('s-unit').value=cfg.useFahrenheit?'F':'C';
    document.getElementById('s-photo-interval').value=String(cfg.photoIntervalSec);
    document.getElementById('s-photo-order').value=cfg.photoOrder;
    document.getElementById('s-photo-random-start').checked=cfg.photoRandomStart;
    document.getElementById('s-photo-preload').checked=cfg.photoPreload;
    document.getElementById('s-bg-startup-priority').checked=cfg.backgroundStartupPriority!==false;
    document.getElementById('s-bg-startup-delay').value=String(cfg.backgroundStartupDelayMs??700);const startupDelayLabel=document.getElementById('s-bg-startup-delay-value');if(startupDelayLabel)startupDelayLabel.textContent=(Number(cfg.backgroundStartupDelayMs??700)/1000).toFixed(1)+'s';
    setBackgroundStatus(configApi.lastBackgroundStatus.text,configApi.lastBackgroundStatus.error);
    document.getElementById('s-weather-refresh').value=String(cfg.weatherRefreshMin);
    document.getElementById('s-calendar-refresh').value=String(cfg.calendarRefreshMin);
    document.getElementById('s-calendar-time-style').value=cfg.calendarTimeStyle||'start';
    document.getElementById('s-calendar-legend').checked=!!cfg.calendarLegend;
    document.getElementById('s-calendar-show-continuation').checked=cfg.calendarShowContinuation!==false;
    renderCalendarOrderList();
    document.getElementById('s-alerts-enabled').checked=cfg.alertsEnabled;
    document.getElementById('s-alert-test').checked=cfg.alertTestMode;
    document.getElementById('s-alert-size').value=String(cfg.alertCardPct);
    document.getElementById('s-alert-motion').value=cfg.alertMotionMode;
    document.getElementById('s-alert-motion-speed').value=String(cfg.alertMotionPx);
    document.getElementById('s-alert-scroll').value=String(cfg.alertScrollSec);
    document.getElementById('s-alert-refresh').value=String(cfg.alertRefreshMin);
    syncAlertRuntimeStateFromForm();
    previewAlertSize(cfg.alertCardPct);
    previewAlertMotionSpeed(cfg.alertMotionPx);
    bindTextColorControls();
    setAppearanceForm(cfg);
    appearanceApi.settingsLayoutPresetKey='current';
    renderLayoutPresetGallery();
    updateAppearanceLabels(cfg);
    applyUiCustomization(cfg);
    setAlertStatus(configApi.lastAlertStatus.text,configApi.lastAlertStatus.error);
    systemApi.calendarHideEmpty=false;
    updateCalendarEntryVisibility();
    setWizardMode(!!startWizard);
    markSettingsClean();
    updateSettingsOverview();
  }catch(error){
    setWizardMode(false);
    showSettingsInitializationError(error);
  }finally{
    systemApi.settingsInitializing=false;
  }
}

function applySettings(){
  ensureCfgDefaults();
  configApi.staleCacheSources.clear();LibreDisplayRuntime.getModule('remote').updateOfflinePill();
  const performance=LibreDisplayRuntime.getModule('performance');
  const weather=LibreDisplayRuntime.getModule('weather');
  const calendar=LibreDisplayRuntime.getModule('calendar');
  const backgrounds=LibreDisplayRuntime.getModule('backgrounds');
  const appearance=LibreDisplayRuntime.getModule('appearance');
  performance.stopManagedInterval('weather-refresh');
  performance.stopManagedInterval('calendar-refresh');
  performance.stopManagedInterval('alert-refresh');
  configApi.weatherTimer=null;configApi.calendarTimer=null;configApi.alertTimer=null;
  weather.stopAlertScroller();
  weather.previewAlertSize(cfg.alertCardPct);
  weather.previewAlertMotionSpeed(cfg.alertMotionPx);
  appearance.applyUiCustomization(cfg);
  weather.startClock();
  weather.invalidateWeatherIfLocationChanged();
  performance.runExclusiveTask('weather-refresh',weather.fetchWeather);
  performance.runExclusiveTask('alert-refresh',weather.fetchWeatherAlerts);
  performance.runExclusiveTask('calendar-refresh',calendar.loadCalendars);
  const loadBackgroundSource=()=>{
    if(cfg.backgroundSource==='stock')backgrounds.loadStockBackground();
    else if(cfg.backgroundSource==='folders'&&cfg.mediaFolders?.length)backgrounds.loadFolderBackgrounds(cfg.mediaFolders,cfg.mediaRecursive);
    else if(cfg.backgroundSource==='google'&&cfg.photosUrl)backgrounds.loadPhotos(cfg.photosUrl);
    else backgrounds.disableBackgroundSource();
  };
  if(cfg.backgroundSource!=='none'&&cfg.backgroundStartupPriority!==false){
    const backgroundStartAt=Date.now()+Math.max(0,Number(cfg.backgroundStartupDelayMs)||0);
    void (async()=>{try{await backgrounds.restoreLastBackground(true);}catch(_e){}setTimeout(loadBackgroundSource,Math.max(0,backgroundStartAt-Date.now()));})();
  }else{
    if(cfg.backgroundSource!=='none')void backgrounds.restoreLastBackground(true);
    loadBackgroundSource();
  }
  const details=cfg.weatherDetailsEnabled||{},hasAirBlock=(cfg.customBlocks||[]).some(b=>b?.type==='airquality');
  if(hasAirBlock||details.airquality||details.uvindex)setTimeout(()=>LibreDisplayRuntime.getModule('blocks').getAirQualityData().catch(()=>{}),0);
  configApi.weatherTimer=performance.startManagedInterval('weather-refresh',weather.fetchWeather,cfg.weatherRefreshMin*60*1000,{skipWhenHidden:true,resumeOnVisible:true});
  configApi.calendarTimer=performance.startManagedInterval('calendar-refresh',calendar.loadCalendars,cfg.calendarRefreshMin*60*1000,{skipWhenHidden:true,resumeOnVisible:true});
  configApi.alertTimer=performance.startManagedInterval('alert-refresh',weather.fetchWeatherAlerts,cfg.alertRefreshMin*60*1000,{skipWhenHidden:true,resumeOnVisible:true});
}


// Browser cursor fallback.
async function loadSessionInfo(){
  try{
    const res=await resilientFetch(serverPath('/api/session-info'),{cache:'no-store'});
    if(!res.ok)return;
    const data=await res.json();
    bootstrapApi.READ_ONLY_DISPLAY_MODE=!!data?.display;
    bootstrapApi.LOCAL_CLIENT_MODE=!!data?.local;
    bootstrapApi.SESSION_ROLE=String(data?.role||'');bootstrapApi.SESSION_USERNAME=String(data?.username||'');
    document.documentElement.classList.toggle('read-only-display',bootstrapApi.READ_ONLY_DISPLAY_MODE);
    document.documentElement.classList.toggle('role-owner',bootstrapApi.SESSION_ROLE==='owner');
    document.documentElement.classList.toggle('role-editor',bootstrapApi.SESSION_ROLE==='editor');
    document.documentElement.classList.toggle('role-viewer',bootstrapApi.SESSION_ROLE==='viewer');
    for(const el of document.querySelectorAll('[data-owner-only="1"]'))el.style.display=(bootstrapApi.SESSION_ROLE==='owner'?'':'none');
    const addDisplay=document.querySelector('#settings-endpoints .utility-actions button');if(addDisplay&&bootstrapApi.SESSION_ROLE!=='owner')addDisplay.style.display='none';
  }catch(e){}
}
function revealSettingsCog(){
  if(bootstrapApi.READ_ONLY_DISPLAY_MODE)return;
  const cog=document.getElementById('cog');
  if(!cog)return;
  let seen=0;
  try{seen=Number(localStorage.getItem('libredisplay_settings_hint_seen')||0)||0;}catch(e){}
  if(seen>=3||cfg.settingsCogLabel===false)return;
  cog.classList.add('cog-discover');
  setTimeout(()=>cog.classList.remove('cog-discover'),6500);
  try{localStorage.setItem('libredisplay_settings_hint_seen',String(seen+1));}catch(e){}
}


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("settings", {setSettingsPreviewReturnVisible,previewDashboardFromSettings,returnToSettingsPreview,requestCloseSetup,restoreSavedSettingsPreview,closeSetup,skipSetup,openSetup,applySettings,loadSessionInfo,revealSettingsCog}, {
  "settingsPreviewMode": {configurable:true,get:()=>settingsPreviewMode,set:(value)=>{settingsPreviewMode=value;}}
}, {globalFunctions:['previewDashboardFromSettings','returnToSettingsPreview','requestCloseSetup','closeSetup','openSetup','applySettings','loadSessionInfo','revealSettingsCog'],globalStates:[]});
