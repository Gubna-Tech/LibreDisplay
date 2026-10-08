// LibreDisplay source section: /js/settings/index.js
{
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
let settingsPreviewMode=false,settingsMounted=false;
function settingsDomMounted(){return settingsMounted;}
function applySettingsSessionRoleVisibility(){for(const el of document.querySelectorAll('[data-owner-only="1"]'))el.style.display=(bootstrapApi.SESSION_ROLE==='owner'?'':'none');}
function bindMountedSettingsControls(){
  const lightweight=document.getElementById('s-lightweight-mode'),performanceMode=document.getElementById('s-animation-performance-mode');
  lightweight?.addEventListener('change',event=>toggleLightweightMode(event.currentTarget.checked));
  performanceMode?.addEventListener('change',event=>setAnimationPerformanceMode(event.currentTarget.value));
  LibreDisplayRuntime.getModule('weatherScenery').initHolidayControls?.();
  applySettingsSessionRoleVisibility();
}
function mountSettings(){
  if(settingsMounted)return true;
  const mount=document.getElementById('settings-mount'),template=document.getElementById('settings-template');
  if(!mount||!template)throw new Error('Settings lazy-mount shell is unavailable.');
  const fragment=(template.content&&typeof template.content.cloneNode==='function')?template.content.cloneNode(true):template.cloneNode?.(true);
  if(!fragment)throw new Error('Settings lazy-mount template could not be cloned.');
  mount.replaceChildren(fragment);settingsMounted=true;bindMountedSettingsControls();return true;
}
function unmountSettings(){
  if(!settingsMounted)return;
  document.getElementById('settings-mount')?.replaceChildren();settingsMounted=false;LibreDisplayRuntime.getModule('settings').settingsSectionsEnhanced=false;
}
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
  hideContextHelp(true);unmountSettings();
  setTimeout(()=>restartAlertScroller(),80);
}
function skipSetup(){closeSetup();}

document.addEventListener('visibilitychange',()=>{if(!document.hidden){setTimeout(ensureAlertMotionRunning,120);if(settingsPanelOpen()){setTimeout(()=>autoDetectSoftwareUpdate('visible'),400);if(bootstrapApi.SESSION_ROLE==='owner')setTimeout(()=>loadSystemHealth(),250);}}});
window.addEventListener('resize',()=>setTimeout(ensureAlertMotionRunning,120));

function openSetup(startWizard=false){
  closeQuickAccessMenu();
  if(settingsPreviewMode){returnToSettingsPreview();return;}
  appearanceApi.settingsLayoutPresetKey='current';
  mountSettings();
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
    const offlineReserve=document.getElementById('s-bg-offline-reserve');if(offlineReserve)offlineReserve.value=String(cfg.backgroundOfflineCacheEnabled===false?0:(cfg.backgroundOfflineCacheMaxMb??192));updateBackgroundReserveEstimate();
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
    updateSettingsOverview();try{LibreDisplayRuntime.getModule('settings').updateLightweightModeUi?.();LibreDisplayRuntime.getModule('settings').updateAnimationPerformanceUi?.();}catch(_e){}
  }catch(error){
    setWizardMode(false);
    showSettingsInitializationError(error);
  }finally{
    systemApi.settingsInitializing=false;
  }
}

function updateBackgroundReserveEstimate(){
  const select=document.getElementById('s-bg-offline-reserve'),cap=Math.max(0,Number(select?.value)||0),out=document.getElementById('s-bg-offline-cache-estimate');
  if(!out)return;if(cap<=0){out.textContent='Offline reserve is off. The normal 10-image recovery cache remains available.';return;}
  const typical=Math.max(1,Math.floor(cap/4)),small=Math.max(1,Math.floor(cap/1.5)),large=Math.max(1,Math.floor(cap/8));
  out.textContent=`${cap} MB is roughly ${typical} typical 4 MB photos (${small} optimized 1.5 MB photos or ${large} high-resolution 8 MB photos). LibreDisplay keeps storage headroom and may stop early if the browser quota is tight.`;
}

function applySettings(){
  ensureCfgDefaults();
  configApi.staleCacheSources.clear();LibreDisplayRuntime.getModule('remote').updateOfflinePill();
  const performance=LibreDisplayRuntime.getModule('performance');
  const weather=LibreDisplayRuntime.getModule('weather');
  const calendar=LibreDisplayRuntime.getModule('calendar');
  const backgrounds=LibreDisplayRuntime.getModule('backgrounds');
  const appearance=LibreDisplayRuntime.getModule('appearance');
  const runtimeCfg=performance.effectiveVisualConfig(cfg);
  try{LibreDisplayRuntime.getModule('weatherEffects').setWeatherHazardTestProfile('live');}catch(_e){}
  performance.stopManagedInterval('weather-refresh');
  performance.stopManagedInterval('calendar-refresh');
  performance.stopManagedInterval('alert-refresh');
  configApi.weatherTimer=null;configApi.calendarTimer=null;configApi.alertTimer=null;
  weather.stopAlertScroller();
  weather.previewAlertSize(cfg.alertCardPct);
  weather.previewAlertMotionSpeed(cfg.alertMotionPx);
  appearance.applyUiCustomization(runtimeCfg);
  weather.startClock();
  weather.invalidateWeatherIfLocationChanged();
  performance.runExclusiveTask('weather-refresh',weather.fetchWeather);
  performance.runExclusiveTask('alert-refresh',weather.fetchWeatherAlerts);
  performance.runExclusiveTask('calendar-refresh',calendar.loadCalendars);
  const loadBackgroundSource=()=>{
    if(cfg.backgroundSource==='stock')backgrounds.loadStockBackground();
    else if(cfg.backgroundSource==='folders'&&cfg.mediaFolders?.length)backgrounds.loadFolderBackgrounds(cfg.mediaFolders,cfg.mediaRecursive,runtimeCfg.backgroundMotionEnabled);
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
  try{LibreDisplayRuntime.getModule('settings').updateLightweightModeUi?.();LibreDisplayRuntime.getModule('settings').updateAnimationPerformanceUi?.();}catch(_e){}
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
    applySettingsSessionRoleVisibility();
    LibreDisplayRuntime.getModule('settings').buildSettingsMobileCategory?.();
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


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("settings", {settingsDomMounted,mountSettings,unmountSettings,applySettingsSessionRoleVisibility,setSettingsPreviewReturnVisible,previewDashboardFromSettings,returnToSettingsPreview,requestCloseSetup,restoreSavedSettingsPreview,closeSetup,skipSetup,openSetup,applySettings,loadSessionInfo,revealSettingsCog,updateBackgroundReserveEstimate}, {
  "settingsPreviewMode": {configurable:true,get:()=>settingsPreviewMode,set:(value)=>{settingsPreviewMode=value;}}
}, {globalFunctions:['previewDashboardFromSettings','returnToSettingsPreview','requestCloseSetup','closeSetup','openSetup','applySettings','loadSessionInfo','revealSettingsCog','updateBackgroundReserveEstimate'],globalStates:[]});
}
// End source section: /js/settings/index.js

// LibreDisplay source section: /js/settings/navigation.js
{
// Settings tabs, section metadata, help registry, search, and navigation.
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');

const SETTINGS_TABS=['overview','calendars','backgrounds','weather','weatherfx','weatheralerts','nature','wildlife','companions','look','displaycare','layout','family','integrations','displays','system'];
const SETTINGS_TAB_TITLES={
  overview:'Home',
  calendars:'Calendars',
  backgrounds:'Backgrounds',
  weather:'Weather',
  weatherfx:'Weather Effects',
  weatheralerts:'Weather Alerts',
  nature:'Nature & Seasons',
  wildlife:'Wildlife',
  companions:'Companion & Holidays',
  look:'Personalization',
  displaycare:'Display Care',
  layout:'Layout',
  family:'Family',
  integrations:'Integrations',
  displays:'Displays & Access',
  system:'System & Maintenance'
};
const SETTINGS_TAB_GROUPS={
  overview:'Start',
  calendars:'Content',backgrounds:'Content',
  weather:'Weather',weatherfx:'Weather',weatheralerts:'Weather',
  nature:'Living scenery',wildlife:'Living scenery',companions:'Living scenery',
  look:'Appearance',displaycare:'Appearance',layout:'Appearance',
  family:'Household & services',integrations:'Household & services',
  displays:'System',system:'System'
};
const SETTINGS_TAB_HINTS={
  overview:'Shortcuts, current status, performance mode, and project information.',
  calendars:'Calendar feeds, imported files, event presentation, refresh timing, and display rules.',
  backgrounds:'Photo sources, local or NAS folders, slideshow rotation, and background presentation.',
  weather:'Weather location, units, refresh behavior, and the optional Weather Details element.',
  weatherfx:'Normal-weather atmosphere: rain, snow, fog, clouds, sun, wind, and lightning.',
  weatheralerts:'Severe-weather cards, filtering, alert motion, and hazard-driven full-screen scenery.',
  nature:'Season behavior, leaves, grass, petals, winter crystals, and cold-weather atmosphere.',
  wildlife:'Bees, butterflies, fireflies, other insects, birds, owls, and regional wildlife behavior.',
  companions:'Dog companion behavior and special-day holiday overlays, previews, and customization.',
  look:'Themes, typography, language, accessibility, and the Settings-button experience.',
  displaycare:'OLED and always-on display protection: pixel shift, dimming, quiet hours, and deep protection.',
  layout:'Starter templates, dashboard arrangement, content sizing, spacing, ranges, and geometry.',
  family:'Household members, chores, rewards, and touch-mode behavior.',
  integrations:'Browse installed providers, add integration blocks, and review connection health.',
  displays:'Display endpoints, remote access, local accounts, saved profiles, and scheduled scenes.',
  system:'Provider health, display readiness, host health, updates, backup, diagnostics, and recovery.'
};
function updateSettingsPageHeader(searchQuery=''){
  const title=document.getElementById('settings-page-title');
  const hint=document.getElementById('settings-tab-hint');
  const kicker=document.getElementById('settings-page-kicker');
  const meta=document.getElementById('settings-page-meta');
  const q=String(searchQuery||'').trim();
  if(q){
    if(kicker)kicker.textContent='Search';
    if(title)title.textContent='Search results';
    if(hint)hint.textContent=`Matches for “${q}” across LibreDisplay settings.`;
    if(meta)meta.textContent='Search spans every category, including advanced settings.';
    return;
  }
  if(kicker)kicker.textContent=SETTINGS_TAB_GROUPS[activeSettingsTab]||'Settings';
  if(title)title.textContent=SETTINGS_TAB_TITLES[activeSettingsTab]||'Settings';
  if(hint)hint.textContent=SETTINGS_TAB_HINTS[activeSettingsTab]||'';
  if(meta){
    const sections=visibleSettingsSectionsForTab(activeSettingsTab);
    const controls=sections.reduce((total,section)=>total+section.querySelectorAll('input:not([type="hidden"]),select,textarea').length,0);
    meta.textContent=`${sections.length} focused section${sections.length===1?'':'s'} · ${controls} control${controls===1?'':'s'} shown`;
  }
}
const SETTINGS_SECTION_SUMMARIES={
  'settings-overview':'Health checks and the most common dashboard actions.',
  'settings-lightweight':'Temporarily pause expensive visual effects without changing the settings you chose for them.',
  'settings-about':'Version, project identity and local-first behavior.',
  'settings-endpoints':'Create and manage independent screen endpoints from one server.',
  'settings-remote':'Manage LibreDisplay from another device on your trusted network.',
  'settings-users':'Create local accounts and control which displays each role can manage.',
  'settings-profiles':'Save, duplicate, capture, and apply complete dashboard configurations across named displays.',
  'settings-scenes':'Schedule saved Profiles by display, day and time.',
  'settings-family':'Household members, chores, rewards and touch-mode protection.',
  'settings-location':'Weather location and the label shown on the dashboard.',
  'settings-calendars':'Calendar feeds, imported files, refresh behavior and display priority.',
  'settings-alerts':'Enable severe-weather alerts and control their motion.',
  'settings-alert-appearance':'Power-user filtering and alert-card presentation.',
  'settings-backgrounds':'Picture sources, Google Photos, local/NAS folders, rotation and order.',
  'settings-weather-options':'Temperature units and weather refresh timing.',
  'settings-weather-motion':'Enable and preview the full-screen atmosphere, choose presets, and tune global weather behavior.',
  'settings-weather-rain':'Tune rainfall density, drop geometry, speed, angle, depth, splashes, visibility, and glow.',
  'settings-weather-snow':'Tune snowfall density, flake size, drift, speed, visibility, spin, and depth.',
  'settings-weather-fog':'Tune fog and mist density, movement, visibility, blur, and vertical coverage.',
  'settings-naturescape-overview':'Choose automatic or manual season behavior and the overall Naturescape intensity.',
  'settings-naturescape-flora':'Tune leaves, grass, petals, their movement, size, amount, and visibility.',
  'settings-naturescape-insects':'Tune daytime bees and butterflies, including activity, size, speed, visibility, and butterfly species diversity.',
  'settings-naturescape-birds':'Tune regional birds, flocking, size, flight, visibility, height, species diversity, and rare/large species.',
  'settings-naturescape-dog':'Choose an optional state-driven dog companion, breed, coat, collar, activity, size, and visibility.',
  'settings-naturescape-holidays':'Enable special-day scenery, choose which holidays may appear, tune intensity, and preview every holiday overlay.',
  'settings-naturescape-owls':'Optional owl naturescape with region-aware species, ground, glide and swoop behavior, size, visibility and diversity controls.',
  'settings-naturescape-winter':'Tune winter crystals and extreme-cold edge frost independently from snowfall.',
  'settings-weather-hazards':'Choose overall hazard behavior, severity threshold, intensity, opacity, speed, and a full-screen preview scenario.',
  'settings-weather-sky':'Tune ambient clouds, sunlight, and directional wind movement separately from precipitation and lightning.',
  'settings-weather-details':'Choose, enable and reorder Weather Details metrics.',
  'settings-background-style':'Power-user controls for how backgrounds are rendered.',
  'settings-templates':'Apply safe layout and presentation starting points without replacing data sources.',
  'settings-theme':'Choose a LibreDisplay color theme and dashboard font.',
  'settings-accessibility':'Language, Settings interface size, motion preference, contrast, and keyboard focus.',
  'settings-settings-button':'Move and soften the Settings cog so it stays available without distracting from the dashboard.',
  'settings-integrations':'Browse installed providers, test live connections, and review refresh health without exposing credentials.',
  'settings-provider-health':'Review weather, calendars, backgrounds, alerts, and integrations in one privacy-safe troubleshooting view.',
  'settings-layout-presentation':'Text treatment and default content sizing for built-in dashboard elements.',
  'settings-layout':'Preview and apply dashboard layouts, arrange elements, and choose clock/content visibility.',
  'settings-layout-geometry':'Power-user geometry, forecast density, calendar range, spacing and scrolling controls.',
  'settings-display-readiness':'Checks target-screen viewport, orientation, browser scale, and local kiosk heartbeat so display problems are visible without changing the layout.',
  'settings-system-health':'Host uptime, deployment mode, storage headroom, and local runtime health.',
  'settings-software-update':'Check GitHub releases and install supported native updates directly from Settings.',
  'settings-update-history':'Review private pre-update snapshots and safely return a native installation to a previous release.',
  'settings-backup-recovery':'Portable configuration backups and local restore points for safe migration and recovery.',
  'settings-display-care':'Independent OLED and always-on protections including pixel shift, idle dimming, quiet hours, temporary wake, and deep-black protection.',
  'settings-naturescape-fireflies':'Tune warm-season evening fireflies independently from daytime pollinators.',
  'settings-naturescape-other-insects':'Tune dragonflies, ladybugs, and moths with separate activity, size, speed, and visibility controls.',
  'settings-weather-hazards-flood-wind':'Tune flood water, floating debris, current speed, high-wind gusts, and gust travel speed.',
  'settings-weather-hazards-storms':'Tune tornado, tropical-storm, severe-thunderstorm, and blizzard scene strength independently.',
  'settings-weather-hazards-visibility':'Tune dense visibility haze and heat or red-flag fire-weather scenery.',
  'settings-weather-lightning':'Tune thunderstorm lightning, visible bolts, storm-cloud detail, rain sheets, motion preferences, and OLED dimming behavior.',
  'settings-utilities':'Backup, restore, cache, diagnostics and recovery tools.'
};
const SETTINGS_CONTROL_HELP={
  'settings-section-select':'Jump directly to a section in the current Settings category without changing any values.',
  'account-username':'The local sign-in name for this account. Usernames are stored on your LibreDisplay server, not in a cloud account.',
  'account-role':'Owner can manage the server and all displays. Viewer access is intended for limited display management and can be restricted to endpoint IDs.',
  'account-password':'Sets or replaces this local account password. Leaving it blank while editing an existing user keeps the current password.',
  'account-endpoints':'Comma-separated display endpoint IDs this non-owner account may manage. Owners automatically have access to every display.',
  's-profile-select':'Choose a saved dashboard profile to load, duplicate, update, apply to another display, or use as the base for a scheduled scene.',
  's-profile-name':'The friendly name stored with this dashboard profile. Profiles capture presentation and content configuration for later reuse.',
  'scene-automatic':'When enabled, LibreDisplay evaluates scene schedules and switches profiles automatically for the selected display and time.',
  'scene-base-profile':'The profile used whenever no scheduled scene currently matches. This prevents the dashboard from being left in an old scene.',
  'family-members-editor':'One household member per line using Name|emoji. The emoji is optional and is shown in Family blocks and touch views.',
  'family-chores-editor':'One chore per line. Use Chore|member|points|recurrence|days so LibreDisplay can assign points and decide when the chore appears.',
  'family-rewards-editor':'One reward per line using Reward|cost|member. Omit member when a reward should be available to everyone.',
  'family-pin':'Protects owner-only Family actions on touch displays. Use 4–12 digits and keep it separate from account passwords.',
  's-city':'Search for a city or place, then choose the exact region/country match. The selected coordinates — not just the typed name — determine weather and alerts.',
  's-locname':'Optional friendly name shown above Current Weather on the dashboard. It changes only the visible label; the verified coordinates remain unchanged.',
  's-calendar-refresh':'How often LibreDisplay checks enabled calendar feeds for changes. Shorter intervals update sooner but make more network requests.',
  's-calendar-time-style':'Controls whether calendar items show only their start time or a start–end range when an end time is available.',
  's-calendar-legend':'Shows a color legend below the calendar band so multiple calendar sources are easier to identify at a glance.',
  's-calendar-show-continuation':'Adds a Continues marker to multi-day events carried over from an earlier day, making long events easier to distinguish.',
  's-alerts-enabled':'Turns live severe-weather alerts on or off. Disabling this does not disable the normal weather forecast.',
  's-alert-show-expiry':'Shows when a live alert is expected to expire when the provider supplies an expiry time.',
  's-alert-show-meta':'Shows secondary alert information such as affected area and source. Hide it when you want a simpler alert card.',
  's-bg-source':'Selects where dashboard background images come from: stock imagery, Google Photos, local/NAS folders, or another supported source.',
  's-stock-category':'Chooses the built-in stock-photo theme used when the background source is set to stock images.',
  's-stock-query':'Overrides the stock category with your own search phrase. Keep the phrase broad for a healthier photo rotation.',
  's-stock-resolution':'Requests a preferred stock-image resolution. Choose a size close to the wall display resolution to balance sharpness and bandwidth.',
  's-media-folders':'One local or mounted NAS directory per line. LibreDisplay scans these paths for supported image files when folder backgrounds are enabled.',
  's-media-recursive':'Also scans folders below each configured picture directory. Enable this when your photo library is organized into subfolders.',
  's-photo-interval':'How long each background remains visible before LibreDisplay advances to the next picture.',
  's-photo-random-start':'Starts each browser session at a different position in the photo list instead of always beginning with the first image.',
  's-unit':'Selects a consistent weather unit system: Imperial uses °F, mph and inches; Metric uses °C, km/h and millimeters.',
  's-weather-refresh':'How often LibreDisplay requests fresh weather data. A shorter interval updates sooner but uses more network/API traffic.',
  's-bg-top':'Darkens or lightens the upper portion of the background overlay so calendar text remains readable over bright photos.',
  's-bg-bottom':'Darkens or lightens the lower portion of the background overlay behind weather, clock and forecast content.',
  's-bg-transition':'Controls the cross-fade duration when the background image changes. Set lower for faster transitions or higher for a softer slideshow.',
  's-bg-position':'Chooses which part of a photo is favored when Cover cropping is used. Useful when important subjects are near an edge.',
  's-font-family':'Sets the default dashboard typeface. Per-element typography overrides made in Arrange can still replace it.',
  's-locale':'Controls language-sensitive date and time formatting. It does not change weather source data or your configured time zone.',
  's-cog-position':'Moves the Settings button to a different screen corner without changing the dashboard layout itself.',
  's-cog-size':'Changes the clickable Settings button size. Larger values are easier to use on touch displays.',
  's-cog-opacity':'Controls how visible the Settings button is while idle. It becomes more visible when the pointer is active.',
  's-cog-label':'Shows a small Settings hint during hover or first discovery so new users can find the configuration menu more easily.',
  's-secondary-opacity':'Changes the strength of secondary labels and supporting text without changing the primary dashboard values.',
  's-text-shadow':'Adjusts the shadow behind dashboard text. More shadow can improve readability over busy or bright backgrounds.',
  's-text-color':'Sets the dashboard primary text color. Theme colors and per-element Arrange overrides can still affect individual content.',
  's-text-hex':'Enter the same primary text color as a hexadecimal value when you need an exact color.',
  's-ui-calendar':'Scales calendar text globally. Arrange can override the Calendar element or individual calendar text sections afterward.',
  's-ui-current':'Scales the Current Weather element content globally without changing its Arrange rectangle.',
  's-ui-clock':'Scales Clock & Date content globally without changing the outer Arrange rectangle.',
  's-ui-forecast':'Scales both Daily and Hourly forecast typography globally. Each forecast can still be edited separately in Arrange.',
  's-ui-details':'Scales Weather Details labels, icons and values globally. Arrange can override the Weather Details element afterward.',
  's-ui-alert':'Scales text and icons inside Weather Alert cards. Alert-card height is controlled separately under Content.',
  's-calendar-height':'Changes the default height reserved for the calendar band. Saved custom Arrange rectangles take priority once a custom layout is active.',
  's-bottom-height':'Changes the default vertical space reserved for weather, clock and forecasts before a custom Arrange layout is used.',
  's-left-width':'Changes the default width of the weather/clock information area. Custom Arrange positions take priority when saved.',
  's-side-padding':'Adds or removes breathing room along the left and right edges of the default dashboard layout.',
  's-forecast-gap':'Changes horizontal space between forecast columns. Reduce it when many forecast periods must fit on a smaller display.',
  's-forecast-row-gap':'Changes vertical space between the Daily and Hourly forecast rows in the default layout.',
  's-hourly-hours':'Sets how many upcoming hourly forecast periods are rendered. More hours require more horizontal space.',
  's-daily-days':'Sets how many daily forecast columns are rendered. Choose fewer days for larger, less crowded forecast content.',
  's-calendar-days':'Sets how many calendar days are loaded into the dashboard calendar band.',
  's-calendar-columns':'Sets how many calendar day columns are visible per row before additional days continue vertically.',
  's-calendar-cell-height':'Sets the vertical space available to each calendar row. Increase it when showing more events per day.',
  's-layout-snap':'When enabled, dragging and resizing in Arrange lands on the selected grid spacing. Turn it off for pixel-level placement.',
  's-time-format':'Chooses 12-hour or 24-hour clock formatting for the dashboard clock.',
  's-date-format':'Chooses how the date under the clock is written. This changes presentation only.',
  's-show-no-events':'Shows No events inside empty calendar days. Disable it for a quieter calendar when many days are empty.',
  's-show-event-times':'Shows calendar event start times. Disable it when event titles are more important than exact times.',
  's-show-daily':'Shows or hides the Daily Forecast block. Hiding it does not delete its saved Arrange geometry.',
  's-show-hourly':'Shows or hides the Hourly Forecast block. Hiding it does not delete its saved Arrange geometry.',
  's-show-precip':'Shows precipitation probability in Daily and Hourly forecast columns when weather data provides it.',
  's-show-seconds':'Adds seconds to the dashboard clock. Disable it for a calmer display and fewer visible clock changes.',
  's-show-ampm':'Shows AM/PM when the clock uses 12-hour time. This setting has no effect in 24-hour mode.',
  's-show-date':'Shows the formatted date beneath the clock. The date format is controlled separately.',
  's-show-current-icon':'Shows the large current-condition weather icon beside the Current Weather values.',
  'integration-directory-category':'Filters the integration directory by provider category without changing any configured integrations.',
  'integration-directory-state':'Filters the integration directory to all, configured, or not-yet-configured providers.',
  'integration-directory-search':'Searches installed integration providers by name and description. It does not contact external services.',
  's-alert-test':'Creates simulated weather alerts locally so you can preview alert layout and motion without waiting for a real warning.',
  's-alert-size':'Changes the vertical space used by each alert card. Text size is controlled separately in Arrange.',
  's-alert-motion':'Choose stepped rotation, continuous scrolling when needed, or a static alert list.',
  's-alert-motion-speed':'Sets the continuous-scroll speed in pixels per second. It is used only when Alert motion is Continuous.',
  's-alert-scroll':'Sets how long each stepped alert position remains visible before advancing.',
  's-alert-refresh':'Sets how often LibreDisplay checks for new live weather alerts.',
  's-alert-opacity':'Changes the alert-card surface opacity without changing text size.',
  's-alert-min-severity':'Filters live alerts below the selected severity. Simulated test alerts remain mixed so every style can be previewed.',
  's-photos':'The Google Photos shared-album URL used when Google Photos is selected as the background source.',
  's-photo-order':'Controls whether background photos advance in their listed order or shuffle.',
  's-photo-preload':'Loads and decodes the exact upcoming image before the transition while keeping the current photo visible until it is ready.',
  's-bg-offline-cache':'Keeps a second, disk-backed reserve of still backgrounds after the small startup cache is ready, so rotation can continue through temporary network or NAS outages.',
  's-bg-offline-cache-count':'Sets the maximum number of extra still backgrounds kept in the offline reserve after the 10-image hot cache. The reserve fills lazily after startup.',
  's-bg-offline-cache-max-mb':'Caps the secondary background reserve. LibreDisplay also respects browser storage quota and free-space headroom even when this limit is set higher.',
  's-background-motion':'Allows animated GIF, video and Motion JPEG backgrounds from local/NAS folders. Continuous decoding can be demanding on lower-powered devices.',
  's-bg-startup-priority':'Starts weather, air quality, calendars, and the dashboard shell before refreshing the background source. The last displayed background can be reused immediately while source discovery runs.',
  's-bg-startup-delay':'Sets the short delay before background-source discovery begins when startup prioritization is enabled.',
  's-weather-animations':'Master switch for optional decorative motion based on the current weather.',
  's-weather-widget-animations':'Adds gentle motion to weather icons without changing weather data. On Raspberry Pi 4 in Auto, Smooth, or Balanced performance modes, the compact Daily/Hourly strips use lightweight static weather symbols to protect frame rate while Current Weather keeps its richer icon treatment; Fidelity mode restores the full animated forecast glyphs.',
  's-weather-fullscreen-effects':'Adds lightweight weather atmosphere over the background while keeping dashboard content above it.',
  's-weather-bird-habitat':'Guides regional bird selection toward the habitat around the display. Auto is deliberately inland-safe so wetland and coastal specialists are not shown unless a matching habitat is selected.',
  's-weather-effect-mode':'Choose automatic atmosphere, precipitation-only effects, or all ambient weather effects.',
  's-weather-effect-intensity':'Controls how many rain drops, snowflakes, cloud fields, or other weather particles are shown.',
  's-weather-effect-opacity':'Controls how visible the full-screen atmosphere is over the background.',
  's-weather-effect-speed':'Controls decorative weather animation speed only; provider refresh timing is unchanged.',
  's-weather-effect-lightning':'Allows brief full-screen lightning flashes when current conditions report thunderstorms.',
  's-weather-effect-reduced-motion':'Disables decorative weather motion when LibreDisplay or the device is using reduced motion.',
  's-weather-effect-pause-dimmed':'Pauses full-screen weather atmosphere while OLED/display protection is dimming the display.',
  's-bg-blur':'Blurs the background image only. A small blur can make foreground text easier to read over detailed photos.',
  's-bg-fit':'Cover fills the screen and may crop edges. Contain keeps the whole image visible and may leave unused space.',
  's-settings-ui-size':'Changes only the Settings interface size. Dashboard element sizes remain controlled separately.',
  's-burnin-care-enabled':'Master switch for display care. Turning it off pauses pixel shifting, dimming, quiet hours, and deep protection without erasing their settings.',
  's-burnin-idle-dimming':'Dims the display after a configurable period without local mouse, keyboard, touch, or wheel input. It is independent of Quiet hours.',
  's-burnin-quiet-hours':'Enables scheduled dimming between the configured local start and end times. Pixel shifting does not require this option.',
  's-burnin-quiet-start':'The local display time when scheduled quiet-hours dimming begins.',
  's-burnin-quiet-end':'The local display time when scheduled quiet-hours dimming ends and full brightness returns automatically.',
  's-burnin-quiet-wake-enabled':'Allows local input to temporarily wake the display during Quiet hours.',
  's-burnin-quiet-wake':'When temporary wake is enabled, controls how long the display stays awake during Quiet hours after local input.',
  's-burnin-pixel-shift':'Moves the rendered dashboard and background on a slow cycle to distribute static OLED wear without changing saved Arrange coordinates. It can run by itself.',
  's-burnin-idle':'Sets how long the display stays untouched before Idle dimming begins.',
  's-burnin-brightness':'Sets the brightness used by Idle dimming and Quiet hours.',
  's-burnin-deep-protection':'Adds a stronger protection stage. A Deep brightness of 0% produces a black screen until local interaction or the configured Quiet Hours wake behavior.',
  's-burnin-deep-trigger':'Choose whether Deep protection counts extended inactivity or elapsed time inside Quiet Hours. Existing scheduled OLED setups keep their previous quiet-hours behavior after upgrade.',
  's-burnin-deep-idle':'Sets the time without local input before Deep protection begins.',
  's-burnin-deep-brightness':'Sets the brightness during deep protection. 0% is fully black and provides the strongest idle protection.',
  's-burnin-shift-mode':'Controls whether pixel shifting runs continuously or only after the display has entered an idle-dim stage.',
  's-burnin-shift-interval':'Sets how often the OLED pixel-shift position changes. Shorter intervals distribute wear more aggressively.',
  's-burnin-shift-distance':'Sets how far the rendered dashboard can shift from its saved position. Larger distances spread wear further but can be easier to notice.',
  's-burnin-shift-transition':'Controls how quickly each pixel-shift movement occurs. Use 0 seconds for an instant move or a longer value for a gentler transition.',
  's-burnin-pause-animations':'Pauses decorative weather motion and other nonessential animation while display protection has the screen dimmed.',
  's-motion-preference':'Automatic follows the device preference. Reduced motion minimizes decorative animation while keeping data updates working.',
  's-high-contrast':'Strengthens borders and secondary text contrast throughout Settings for easier visual separation.',
  's-focus-outline':'Keeps a strong keyboard-focus ring visible when navigating Settings with Tab, Shift+Tab, Enter or Space.',
  's-calendar-scroll-mode':'Manual keeps the calendar stationary. Slow auto-scroll moves it only when calendar content is taller than the available area.',
  's-calendar-scroll-speed':'Sets the calendar auto-scroll speed and is used only when Calendar overflow is set to Slow auto-scroll.',
  's-calendar-max-events':'Limits the number of calendar entries shown in each day cell before the remaining events are omitted from that cell.',
  's-layout-grid':'Sets the movement/resizing grid used by Arrange when Snap is enabled. Smaller values allow finer placement.',
  's-settings-search':'Searches setting names, section summaries, aliases and context-help text across every Settings category.'
};

function settingsControlLabel(control){
  if(!(control instanceof Element))return null;
  const escaped=window.CSS?.escape?CSS.escape(control.id||''):String(control.id||'').replace(/[^a-zA-Z0-9_-]/g,'');
  return control.closest('label')||(escaped?document.querySelector(`label[for="${escaped}"]`):null)||control.closest('.s-row')?.querySelector(':scope > label')||null;
}
function cleanSettingsLabelText(label){
  if(!label)return 'Setting';
  const clone=label.cloneNode(true);
  clone.querySelectorAll('.help-tip,.range-value').forEach(el=>el.remove());
  return String(clone.textContent||'Setting').replace(/\s+/g,' ').trim().replace(/[—:-]+$/,'')||'Setting';
}
function makeSettingsHelpButton(title,help,auto=true){
  const btn=document.createElement('button');
  btn.type='button';btn.className='help-tip'+(auto?' settings-auto-help':'');btn.textContent='?';
  btn.dataset.help=String(help||'').trim();btn.dataset.helpTitle=String(title||'Setting').trim();
  btn.setAttribute('aria-label',`${btn.dataset.helpTitle} help`);btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','context-help-popover');
  return btn;
}
function settingsControlTitle(control,label=settingsControlLabel(control)){
  if(label)return cleanSettingsLabelText(label);
  const explicit=String(control?.dataset?.helpTitle||control?.getAttribute?.('aria-label')||'').trim();if(explicit)return explicit;
  const id=String(control?.id||control?.name||'setting').replace(/^s-/,'').replace(/[-_]+/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase()).trim();
  return id||String(control?.placeholder||'Setting').replace(/[.…]+$/,'').trim()||'Setting';
}
function settingsControlContext(control){
  const section=control?.closest?.('.s-section[data-settings-tab]'),row=control?.closest?.('.s-row,.checkline,.settings-search,.settings-mobile-category,.settings-section-jump');
  const sectionTitle=cleanSettingsLabelText(section?.querySelector(':scope > h3'));
  const rowNotes=row?[...row.querySelectorAll('.settings-inline-help,.settings-note,.range-ends,.howto')].map(el=>String(el.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean):[];
  return {section,row,sectionTitle,rowNote:rowNotes.join(' ').slice(0,360)};
}
function settingsFallbackHelp(control,label){
  const title=settingsControlTitle(control,label),type=String(control?.type||control?.tagName||'setting').toLowerCase(),ctx=settingsControlContext(control),parts=[];
  if(type==='checkbox')parts.push(`Turns “${title}” on or off.`);
  else if(type==='radio')parts.push(`Selects the “${title}” option in this group.`);
  else if(control instanceof HTMLSelectElement){const choices=[...control.options].map(o=>String(o.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean);parts.push(`Choose how “${title}” behaves.`);if(choices.length)parts.push(`Choices include ${choices.slice(0,6).join(', ')}${choices.length>6?', and more':''}.`);}
  else if(type==='range'){const lo=control.min!==''?control.min:'the minimum',hi=control.max!==''?control.max:'the maximum',step=control.step&&control.step!=='any'?` in ${control.step} increments`:'';parts.push(`Adjusts “${title}” from ${lo} to ${hi}${step}. Lower values reduce the setting; higher values increase it.`);}
  else if(type==='color')parts.push(`Chooses the color used by “${title}”. The adjacent hex field, when present, accepts the same color as a six-digit value.`);
  else if(type==='time')parts.push(`Sets the local display time for “${title}”. This follows the host display's local clock.`);
  else if(type==='number'){const lo=control.min!==''?` Minimum ${control.min}.`:'' ,hi=control.max!==''?` Maximum ${control.max}.`:'';parts.push(`Sets the numeric value for “${title}”.${lo}${hi}`);}
  else if(type==='url')parts.push(`Enter the URL used for “${title}”. LibreDisplay keeps saved configuration local to your server unless the selected integration must contact that provider.`);
  else if(type==='file')parts.push(`Choose the local file used by “${title}”. Selecting a file does not change other settings until the related import or apply action runs.`);
  else if(type==='search')parts.push(`Searches or filters “${title}” as you type. Search text is temporary and is not saved as dashboard configuration.`);
  else if(type==='password')parts.push(`Enter the private value for “${title}”. It is treated as sensitive configuration and is not shown back in plain text.`);
  else parts.push(`Sets “${title}”.`);
  if(ctx.rowNote)parts.push(ctx.rowNote);
  else if(ctx.section){const summary=SETTINGS_SECTION_SUMMARIES[ctx.section.id];if(summary)parts.push(`In ${ctx.sectionTitle}: ${summary}`);}
  if(!['search','file'].includes(type))parts.push('Changes can be previewed in Settings and are kept after Save & Apply.');
  return parts.join(' ').replace(/\s+/g,' ').trim();
}
let settingsHelpObserver=null;
function enhanceSettingsControlHelp(){
  const root=arguments[0]||document;
  const scope=root instanceof Element||root instanceof Document?root:document;
  scope.querySelectorAll?.('.s-section[data-settings-tab] input:not([type="hidden"]),.s-section[data-settings-tab] select,.s-section[data-settings-tab] textarea,.settings-search input,.settings-mobile-category select,.settings-section-jump select').forEach(control=>{
    if(control.hidden||String(control.style?.display||'').toLowerCase()==='none'||control.closest('[hidden]'))return;
    const label=settingsControlLabel(control),title=settingsControlTitle(control,label),help=String(control.dataset?.help||SETTINGS_CONTROL_HELP[control.id]||settingsFallbackHelp(control,label)||'').trim();if(!help)return;
    if(label){if(!label.querySelector('.help-tip'))label.appendChild(makeSettingsHelpButton(title,help,true));}
    else if(!control.nextElementSibling?.classList?.contains('settings-control-inline-help')){const tip=makeSettingsHelpButton(title,help,true);tip.classList.add('settings-control-inline-help');control.insertAdjacentElement('afterend',tip);if(!control.getAttribute('aria-label'))control.setAttribute('aria-label',title);}
    control.dataset.contextHelpReady='1';
  });
  scope.querySelectorAll?.('.s-section[data-settings-tab] .s-row > label').forEach(label=>{
    if(label.querySelector('.help-tip'))return;
    const row=label.closest('.s-row'),control=row?.querySelector('input:not([type="hidden"]),select,textarea'),title=cleanSettingsLabelText(label),section=label.closest('.s-section[data-settings-tab]');
    if(control){const help=String(control.dataset?.help||SETTINGS_CONTROL_HELP[control.id]||settingsFallbackHelp(control,label)||'').trim();if(help)label.appendChild(makeSettingsHelpButton(title,help,true));return;}
    const note=[...row?.querySelectorAll?.('.settings-note,.settings-inline-help,.howto')||[]].map(el=>String(el.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean).join(' ').slice(0,420),summary=SETTINGS_SECTION_SUMMARIES[section?.id]||'';
    const help=String(label.dataset?.help||`What it is: ${title} shows information or actions for this part of Settings.${note?` ${note}`:summary?` In this section: ${summary}`:''} This row is informational unless it contains an action button.`).trim();
    if(help)label.appendChild(makeSettingsHelpButton(title,help,true));
  });
  scope.querySelectorAll?.('.s-section[data-settings-tab]').forEach(section=>{
    const h=section.querySelector(':scope > h3');if(!h||h.querySelector('.help-tip'))return;
    const title=cleanSettingsLabelText(h),help=SETTINGS_SECTION_SUMMARIES[section.id]||'';if(!help)return;
    h.appendChild(makeSettingsHelpButton(title,help,true));
  });
  const mount=document.getElementById('settings-mount');
  if(mount&&!settingsHelpObserver){settingsHelpObserver=new MutationObserver(records=>{if(records.some(r=>r.addedNodes?.length))queueMicrotask(()=>enhanceSettingsControlHelp(mount));});settingsHelpObserver.observe(mount,{childList:true,subtree:true});}
}

let activeSettingsTab='overview';
let settingsViewMode='essential';
let settingsSectionsEnhanced=false;

function loadSettingsViewMode(){
  try{settingsViewMode=localStorage.getItem('libredisplay_settings_view')||'essential';}catch(e){settingsViewMode='essential';}
  if(!['essential','all'].includes(settingsViewMode))settingsViewMode='essential';
}
function setSettingsViewMode(mode){
  settingsViewMode=mode==='all'?'all':'essential';
  try{localStorage.setItem('libredisplay_settings_view',settingsViewMode);}catch(e){}
  const search=document.getElementById('s-settings-search');
  if(search&&search.value.trim()){filterSettings(search.value);return;}
  applySettingsSectionVisibility();
}
function enhanceSettingsSections(){
  if(settingsSectionsEnhanced)return;
  settingsSectionsEnhanced=true;
  let collapsed=[],hasSavedCollapseState=false;
  try{const raw=sessionStorage.getItem('libredisplay_settings_collapsed');hasSavedCollapseState=raw!==null;collapsed=JSON.parse(raw||'[]');if(!Array.isArray(collapsed))collapsed=[];}catch(e){collapsed=[];}
  const firstSectionByTab=new Set();
  document.querySelectorAll('.s-section[data-settings-tab]').forEach(section=>{
    const h=section.querySelector(':scope > h3');
    if(!h)return;
    h.removeAttribute('title');
    h.setAttribute('role','button');
    h.setAttribute('tabindex','0');
    h.addEventListener('keydown',e=>{if(e.target?.closest?.('.help-tip'))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleSettingsSection(section.id);}});
    if(!section.querySelector(':scope > .section-summary')){
      const summary=document.createElement('div');summary.className='section-summary';
      summary.textContent=SETTINGS_SECTION_SUMMARIES[section.id]||'';
      h.insertAdjacentElement('afterend',summary);
    }
    section.addEventListener('click',e=>{const target=e.target;if(!(target instanceof Element)||target.closest('button,input,select,textarea,a,label,[contenteditable="true"],.utility-actions,.settings-section-reset'))return;const summary=section.querySelector(':scope > .section-summary');if(section.classList.contains('section-collapsed')||h.contains(target)||summary?.contains(target))toggleSettingsSection(section.id);});
    const tab=section.dataset.settingsTab||'';
    const defaultCollapsed=!hasSavedCollapseState&&firstSectionByTab.has(tab);
    if(!firstSectionByTab.has(tab))firstSectionByTab.add(tab);
    if(collapsed.includes(section.id)||defaultCollapsed)section.classList.add('section-collapsed');
    h.setAttribute('aria-expanded',section.classList.contains('section-collapsed')?'false':'true');
  });
  LibreDisplayRuntime.getModule('settings').enhanceSettingsSectionPolish?.();
}
function saveCollapsedSettingsSections(){
  const ids=[...document.querySelectorAll('.s-section.section-collapsed')].map(s=>s.id).filter(Boolean);
  try{sessionStorage.setItem('libredisplay_settings_collapsed',JSON.stringify(ids));}catch(e){}
}
function toggleSettingsSection(id,force){
  const section=document.getElementById(id);if(!section)return;
  const collapsed=force===undefined?!section.classList.contains('section-collapsed'):!!force;
  section.classList.toggle('section-collapsed',collapsed);
  section.querySelector(':scope > h3')?.setAttribute('aria-expanded',collapsed?'false':'true');
  saveCollapsedSettingsSections();
}
function setAllSettingsSectionsCollapsed(collapsed){
  document.querySelectorAll('.s-section[data-settings-tab].tab-active:not(.settings-advanced-hidden)').forEach(s=>{s.classList.toggle('section-collapsed',!!collapsed);s.querySelector(':scope > h3')?.setAttribute('aria-expanded',collapsed?'false':'true');});
  saveCollapsedSettingsSections();
}
function settingsSectionRoleAllowed(section){return !(section?.dataset?.ownerOnly==='1'&&bootstrapApi.SESSION_ROLE!=='owner');}
function visibleSettingsSectionsForTab(tab){
  return [...document.querySelectorAll(`.s-section[data-settings-tab="${tab}"]`)].filter(s=>settingsSectionRoleAllowed(s)&&(settingsViewMode==='all'||s.dataset.settingsLevel!=='advanced'));
}
function buildSettingsMobileCategory(){
  const sel=document.getElementById('settings-mobile-category-select');if(!sel)return;
  const groups=new Map();
  for(const btn of document.querySelectorAll('.settings-tab-btn[data-tab]')){
    if(btn.dataset.ownerOnly==='1'&&bootstrapApi.SESSION_ROLE!=='owner')continue;
    const tab=btn.dataset.tab;if(!SETTINGS_TABS.includes(tab))continue;
    const group=SETTINGS_TAB_GROUPS[tab]||'Settings';
    if(!groups.has(group)){const optgroup=document.createElement('optgroup');optgroup.label=group;groups.set(group,optgroup);sel.appendChild(optgroup);}
    const opt=document.createElement('option');opt.value=tab;opt.textContent=SETTINGS_TAB_TITLES[tab]||tab;groups.get(group).appendChild(opt);
  }
  sel.value=activeSettingsTab;
}
function buildSettingsSectionDirectory(){
  const box=document.getElementById('settings-section-directory');if(!box)return;
  box.replaceChildren();
  const sections=visibleSettingsSectionsForTab(activeSettingsTab);
  for(const section of sections){
    const button=document.createElement('button');button.type='button';button.className='settings-section-card';button.dataset.section=section.id;
    const title=document.createElement('b');title.textContent=section.querySelector(':scope > h3')?.childNodes[0]?.textContent?.trim()||section.id;
    const copy=document.createElement('span');copy.textContent=SETTINGS_SECTION_SUMMARIES[section.id]||'';
    const count=section.querySelectorAll('input:not([type="hidden"]),select,textarea').length;
    const meta=document.createElement('small');meta.textContent=`${count} control${count===1?'':'s'}${section.dataset.settingsLevel==='advanced'?' · Advanced':''}`;
    button.append(title,copy,meta);button.addEventListener('click',()=>jumpToSettingsSection(section.id));box.appendChild(button);
  }
  box.hidden=sections.length<=1;
}
function buildSettingsSectionJump(){
  const sel=document.getElementById('settings-section-select');if(!sel)return;
  const sections=visibleSettingsSectionsForTab(activeSettingsTab);
  sel.innerHTML='';
  for(const section of sections){
    const opt=document.createElement('option');opt.value=section.id;
    opt.textContent=section.querySelector(':scope > h3')?.childNodes[0]?.textContent?.trim()||section.querySelector(':scope > h3')?.textContent?.trim()||section.id;
    sel.appendChild(opt);
  }
  sel.disabled=!sections.length;
  buildSettingsSectionDirectory();
  buildSettingsMobileCategory();
}
function jumpToSettingsSection(id){
  const section=document.getElementById(id);if(!section)return;
  section.classList.remove('section-collapsed');section.querySelector(':scope > h3')?.setAttribute('aria-expanded','true');saveCollapsedSettingsSections();
  section.scrollIntoView({behavior:'smooth',block:'start'});
}
function applySettingsSectionVisibility(){
  document.getElementById('settings-mode-essential')?.classList.toggle('active',settingsViewMode==='essential');
  document.getElementById('settings-mode-all')?.classList.toggle('active',settingsViewMode==='all');
  const note=document.getElementById('settings-view-note');
  if(note)note.textContent=settingsViewMode==='essential'?'Essentials keeps the everyday controls visible. Search still finds everything.':'All shows every available control, including advanced and troubleshooting options.';
  let visible=0;
  document.querySelectorAll('.s-section[data-settings-tab]').forEach(section=>{
    const roleHidden=!settingsSectionRoleAllowed(section);
    const advancedHidden=settingsViewMode!=='all'&&section.dataset.settingsLevel==='advanced';
    section.classList.toggle('settings-advanced-hidden',advancedHidden||roleHidden);
    const on=section.dataset.settingsTab===activeSettingsTab&&!advancedHidden&&!roleHidden;
    section.classList.toggle('tab-active',on);if(on)visible++;
  });
  const empty=document.getElementById('settings-empty-state');if(empty)empty.classList.toggle('show',visible===0);
  buildSettingsSectionJump();
  updateSettingsPageHeader();
}

function switchSettingsTab(tab,scrollTop=true){
  const legacyTabs={content:'weather',naturescape:'nature'};tab=legacyTabs[tab]||tab;
  tab=SETTINGS_TABS.includes(tab)?tab:'overview';
  if(tab!=='overview'&&![...document.querySelectorAll(`.s-section[data-settings-tab="${tab}"]`)].some(settingsSectionRoleAllowed))tab='overview';
  activeSettingsTab=tab;
  try{sessionStorage.setItem('libredisplay_settings_tab',tab);}catch(e){}
  if(scrollTop){
    const search=document.getElementById('s-settings-search');
    if(search)search.value='';
    const status=document.getElementById('settings-search-status');
    if(status){status.style.display='none';status.textContent='';}
  }
  document.querySelectorAll('.settings-tab-btn').forEach(btn=>{
    const on=btn.dataset.tab===tab;
    btn.classList.toggle('active',on);
    btn.setAttribute('aria-selected',on?'true':'false');
  });
  applySettingsSectionVisibility();
  const mobileCategory=document.getElementById('settings-mobile-category-select');if(mobileCategory)mobileCategory.value=tab;
  if(tab==='system'&&settingsSectionRoleAllowed(document.getElementById('settings-backup-recovery'))){loadRestorePoints();loadReleaseRollbacks();}
  if(scrollTop){
    const box=document.querySelector('.setup-box');
    if(box)box.scrollTo({top:0,behavior:'smooth'});
  }
}

const SETTINGS_SEARCH_ALIASES={
  'settings-lightweight':'lightweight low power performance slow lag animations overlays video backgrounds resource cpu memory restore visuals',
  'settings-calendars':'calendar calendars calander agenda events ics google proton outlook icloud',
  'settings-alerts':'alerts warning warnings severe weather test preview rotate rotation scroll scrolling motion',
  'settings-weather-motion':'weather animation animations preview test lab immersive fullscreen overlay motion effects',
  'settings-weather-rain':'weather rain drizzle precipitation drops splash splashes density wet streaks',
  'settings-weather-snow':'weather snow flakes snowfall drift spin density winter',
  'settings-weather-fog':'weather fog mist haze density opacity blur layer visibility',
  'settings-naturescape-overview':'naturescape nature season seasonal spring summer fall autumn winter region hemisphere climate living scenery',
  'settings-naturescape-flora':'naturescape nature leaves leaf grass petals plants flora autumn spring summer opacity visibility sway wind',
  'settings-naturescape-insects':'nature naturescape wildlife insects bees butterflies butterfly pollinators species day opacity visibility',
  'settings-naturescape-birds':'naturescape wildlife birds bird species sparrow cardinal blue jay finch owl hawk eagle crane egret flock flight opacity visibility rare large',
  'settings-naturescape-dog':'naturescape dog companion pet labrador shepherd pyrenees toller collar coat sleep sit sniff dig ball breed',
  'settings-naturescape-holidays':'naturescape holiday holidays overlay christmas hanukkah thanksgiving fourth july independence halloween day dead new year easter memorial juneteenth veterans test',
  'settings-naturescape-winter':'naturescape winter crystal crystals frost cold ice edge opacity visibility',
  'settings-weather-hazards':'weather alert alerts severe hazard hazards preview test severity intensity opacity speed emergency warning advisory watch disaster',
  'settings-weather-sky':'weather sky clouds sun wind storm thunder lightning bolt flash reduced motion oled dimming',
  'settings-backgrounds':'background backgrounds picture pictures photo photos images slideshow google album nas media folder startup loading performance',
  'settings-accessibility':'accessibility readable readability larger large text contrast focus keyboard motion language settings size eyesight vision',
  'settings-layout-presentation':'appearance typography sizing font text color colour content scale',
  'settings-layout':'appearance arrange layout editor inspector resize visibility clock forecast show hide snap grid',
  'settings-layout-geometry':'layout geometry spacing ranges columns calendar forecast sizing scroll alignment',
  'settings-settings-button':'settings cog gear button corner opacity',
  'settings-system-health':'health system host uptime disk storage deployment diagnostics troubleshooting',
  'settings-software-update':'update upgrade release version github install restart reboot',
  'settings-update-history':'update history rollback previous version recovery release downgrade restore safety snapshot',
  'settings-backup-recovery':'backup restore recovery migrate migration portable export import restore point rollback profiles scenes',
  'settings-display-care':'display care oled burn in burnin burn-in pixel shift dim dimming quiet hours black screen deep protection wake always on screen care',
  'settings-naturescape-fireflies':'nature naturescape wildlife fireflies firefly night evening glow insects warm season',
  'settings-naturescape-other-insects':'nature naturescape wildlife dragonflies dragonfly ladybugs ladybug moths moth insects',
  'settings-weather-hazards-flood-wind':'weather alerts hazards flood flash flood water debris current high wind gust gusts',
  'settings-weather-hazards-storms':'weather alerts hazards tornado waterspout hurricane tropical storm thunderstorm blizzard winter storm',
  'settings-weather-hazards-visibility':'weather alerts hazards fog smoke dust air quality heat fire red flag haze shimmer',
  'settings-weather-lightning':'weather effects thunderstorm lightning bolt bolts flash storm cloud rain sheets reduced motion oled dimming',
  'settings-utilities':'backup restore diagnostics recovery cache export import'
};
function settingsSectionSearchText(section){
  const attrs=[...section.querySelectorAll('[data-help],[aria-label],[placeholder],[title]')].flatMap(el=>[el.dataset?.help,el.getAttribute('aria-label'),el.getAttribute('placeholder'),el.getAttribute('title')]).filter(Boolean).join(' ');
  return `${section.textContent} ${section.id} ${section.dataset.settingsTab||''} ${SETTINGS_SECTION_SUMMARIES[section.id]||''} ${SETTINGS_SEARCH_ALIASES[section.id]||''} ${attrs}`.toLowerCase();
}

function settingsSearchControlText(el){
  const label=settingsControlLabel(el)||'';
  const attrs=[el.id,el.name,el.dataset?.help,el.getAttribute?.('aria-label'),el.getAttribute?.('placeholder'),el.getAttribute?.('title')].filter(Boolean).join(' ');
  const options=el.tagName==='SELECT'?[...el.options].map(o=>o.textContent).join(' '):'';
  return `${label} ${attrs} ${options}`.replace(/\s+/g,' ').trim().toLowerCase();
}
function openSettingsSearchResult(sectionId,controlId=''){
  const section=document.getElementById(sectionId);if(!section)return;
  const search=document.getElementById('s-settings-search');if(search)search.value='';
  document.getElementById('settings-search-results')?.replaceChildren();
  const status=document.getElementById('settings-search-status');if(status){status.style.display='none';status.textContent='';}
  if(section.dataset.settingsLevel==='advanced'){settingsViewMode='all';try{localStorage.setItem('libredisplay_settings_view','all');}catch(e){}}
  switchSettingsTab(section.dataset.settingsTab||'overview',false);toggleSettingsSection(section.id,false);applySettingsSectionVisibility();
  const target=controlId?document.getElementById(controlId):section;
  requestAnimationFrame(()=>{target?.scrollIntoView({behavior:'smooth',block:'center'});if(target&&target!==section){target.focus?.({preventScroll:true});const hit=target.closest('.s-row,.checkline,.utility-actions')||target;hit.classList.add('settings-search-hit');setTimeout(()=>hit.classList.remove('settings-search-hit'),1800);}});
}
function filterSettings(value){
  const raw=String(value||'').trim(),tokens=raw.toLowerCase().split(/\s+/).filter(Boolean);
  const status=document.getElementById('settings-search-status'),results=document.getElementById('settings-search-results');
  const sections=[...document.querySelectorAll('.s-section[data-settings-tab]')];
  if(!tokens.length){results?.replaceChildren();applySettingsSectionVisibility();if(status){status.style.display='none';status.textContent='';}return;}
  updateSettingsPageHeader(raw);if(results)results.replaceChildren();let matches=0,advancedMatches=0,controlMatches=0;
  sections.forEach(section=>{
    section.classList.remove('settings-advanced-hidden');const hay=settingsSectionSearchText(section),on=tokens.every(t=>hay.includes(t));section.classList.toggle('tab-active',on);
    if(!on)return;section.classList.remove('section-collapsed');section.querySelector(':scope > h3')?.setAttribute('aria-expanded','true');matches++;if(section.dataset.settingsLevel==='advanced')advancedMatches++;
    if(!results)return;const controls=[...section.querySelectorAll('input:not([type="hidden"]),select,textarea,button:not(.help-tip)')];let sectionHits=0;
    controls.forEach(el=>{if(controlMatches>=30||!el.id)return;const text=settingsSearchControlText(el);if(!tokens.every(t=>text.includes(t)))return;sectionHits++;controlMatches++;const b=document.createElement('button');b.type='button';b.className='settings-search-result';const title=document.createElement('b');title.textContent=settingsControlLabel(el)||el.getAttribute('aria-label')||el.id;const meta=document.createElement('small');meta.textContent=`${SETTINGS_TAB_TITLES[section.dataset.settingsTab]||section.dataset.settingsTab} · ${section.querySelector(':scope > h3')?.childNodes[0]?.textContent?.trim()||section.id}`;b.append(title,meta);b.addEventListener('click',()=>openSettingsSearchResult(section.id,el.id));results.appendChild(b);});
    if(!sectionHits&&controlMatches<30){const b=document.createElement('button');b.type='button';b.className='settings-search-result section-result';const title=document.createElement('b');title.textContent=section.querySelector(':scope > h3')?.childNodes[0]?.textContent?.trim()||section.id;const meta=document.createElement('small');meta.textContent=`Open ${SETTINGS_TAB_TITLES[section.dataset.settingsTab]||section.dataset.settingsTab}`;b.append(title,meta);b.addEventListener('click',()=>openSettingsSearchResult(section.id));results.appendChild(b);}
  });
  document.getElementById('settings-empty-state')?.classList.remove('show');
  if(status){status.style.display='block';status.textContent=matches?`${controlMatches?`${controlMatches} direct match${controlMatches===1?'':'es'} · `:''}${matches} matching section${matches===1?'':'s'}${advancedMatches?` · ${advancedMatches} advanced`:''}.`:'No settings matched that search.';}
}

function clearSettingsSearch(){
  const search=document.getElementById('s-settings-search');
  if(search)search.value='';
  filterSettings('');
  if(search)search.focus();
}


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("settings", {updateSettingsPageHeader,settingsControlLabel,cleanSettingsLabelText,makeSettingsHelpButton,settingsControlTitle,settingsControlContext,settingsFallbackHelp,enhanceSettingsControlHelp,loadSettingsViewMode,setSettingsViewMode,enhanceSettingsSections,saveCollapsedSettingsSections,toggleSettingsSection,setAllSettingsSectionsCollapsed,settingsSectionRoleAllowed,visibleSettingsSectionsForTab,buildSettingsMobileCategory,buildSettingsSectionDirectory,buildSettingsSectionJump,jumpToSettingsSection,applySettingsSectionVisibility,switchSettingsTab,settingsSectionSearchText,settingsSearchControlText,openSettingsSearchResult,filterSettings,clearSettingsSearch}, {
  "SETTINGS_TABS": {configurable:true,get:()=>SETTINGS_TABS},
  "SETTINGS_TAB_TITLES": {configurable:true,get:()=>SETTINGS_TAB_TITLES},
  "SETTINGS_TAB_GROUPS": {configurable:true,get:()=>SETTINGS_TAB_GROUPS},
  "SETTINGS_TAB_HINTS": {configurable:true,get:()=>SETTINGS_TAB_HINTS},
  "SETTINGS_SECTION_SUMMARIES": {configurable:true,get:()=>SETTINGS_SECTION_SUMMARIES},
  "SETTINGS_CONTROL_HELP": {configurable:true,get:()=>SETTINGS_CONTROL_HELP},
  "activeSettingsTab": {configurable:true,get:()=>activeSettingsTab,set:(value)=>{activeSettingsTab=value;}},
  "settingsViewMode": {configurable:true,get:()=>settingsViewMode,set:(value)=>{settingsViewMode=value;}},
  "settingsSectionsEnhanced": {configurable:true,get:()=>settingsSectionsEnhanced,set:(value)=>{settingsSectionsEnhanced=value;}},
  "SETTINGS_SEARCH_ALIASES": {configurable:true,get:()=>SETTINGS_SEARCH_ALIASES}
}, {globalFunctions:['enhanceSettingsControlHelp','loadSettingsViewMode','setSettingsViewMode','enhanceSettingsSections','setAllSettingsSectionsCollapsed','jumpToSettingsSection','switchSettingsTab','openSettingsSearchResult','filterSettings','clearSettingsSearch'],globalStates:[]});
}
// End source section: /js/settings/navigation.js

// LibreDisplay source section: /js/settings/actions.js
{
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
  const performanceApi=LibreDisplayRuntime.getModule('performance'),select=document.getElementById('s-animation-performance-mode'),status=document.getElementById('animation-performance-status'),snapshot=performanceApi.animationPerformanceSnapshot?.()||{},caps=performanceApi.frontendCapabilities?.()||{};if(select&&document.activeElement!==select)select.value=cfg.animationPerformanceMode||'auto';if(status){const fps=snapshot.fps>0?`${snapshot.fps.toFixed(1)} FPS`:'measuring FPS',drop=Number.isFinite(snapshot.droppedPct)?`${snapshot.droppedPct.toFixed(1)}% delayed frames`:'measuring drops',device=caps.piClass?'Pi-class display':'standard display',blocker=cfg.lightweightModeEnabled===true?'motion paused by Lightweight mode':document.documentElement.classList.contains('ld-reduce-motion')?'motion reduced by Accessibility preference':cfg.weatherAnimationsEnabled!==true?'weather animations OFF — enable Weather → NatureScape → Enable weather animations':caps.pi3Class?'Pi 3 animation enabled · low-load budget':'motion enabled';status.textContent=`${fps} · target ${snapshot.targetFps||60} · ${drop} · ${snapshot.renderer||'browser compositor'} · ${device} · ${blocker}`;}
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


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("settings", {testCalendarInputs,testSingleCalendarSource,positionQuickAccessMenu,closeQuickAccessMenu,toggleQuickAccessMenu,quickAccessArrange,quickAccessAddBlock,quickAccessSettings,quickAccessIntegrations,updateLightweightModeUi,updateAnimationPerformanceUi,setAnimationPerformanceMode,setLightweightMode,toggleLightweightMode,quickAccessToggleLightweight,quickAccessRefresh,quickAccessUseDevice,quickAccessFullscreen,toggleLayoutShortcuts,refreshDataNow,requestDeviceDisplayMode,enterFullscreen}, {
  "quickAccessMenuOpen": {configurable:true,get:()=>quickAccessMenuOpen,set:(value)=>{quickAccessMenuOpen=value;}}
}, {globalFunctions:['testCalendarInputs','testSingleCalendarSource','closeQuickAccessMenu','toggleQuickAccessMenu','quickAccessArrange','quickAccessAddBlock','quickAccessSettings','quickAccessIntegrations','quickAccessRefresh','quickAccessUseDevice','quickAccessFullscreen','toggleLayoutShortcuts','refreshDataNow','requestDeviceDisplayMode','enterFullscreen'],globalStates:[]});
}
// End source section: /js/settings/actions.js

// LibreDisplay source section: /js/settings/interactions.js
{
const settingsStateApi=()=>LibreDisplayRuntime.getModule('settings');
const systemApi=LibreDisplayRuntime.getModule('system');
// Cursor, wheel, unsaved-change, and contextual-help interactions.

const CURSOR_HIDE_DELAY_MS=2000;
let cursorHideTimer=null;
function hideDashboardCursor(){
  document.documentElement.classList.remove('cursor-active');
}
function showDashboardCursorTemporarily(){
  document.documentElement.classList.add('cursor-active');
  if(cursorHideTimer)clearTimeout(cursorHideTimer);
  cursorHideTimer=setTimeout(hideDashboardCursor,CURSOR_HIDE_DELAY_MS);
}
function initCursorAutoHide(){
  hideDashboardCursor();
  ['mousemove','mousedown','wheel'].forEach(type=>{
    window.addEventListener(type,showDashboardCursorTemporarily,{passive:true});
  });
  window.addEventListener('blur',hideDashboardCursor);
}
initCursorAutoHide();

// Keep modified wheel input inside Settings instead of changing page zoom.
function settingsWheelScrollerFrom(target,deltaY){
  const setup=document.getElementById('setup');
  const box=setup?.querySelector('.setup-box');
  let node=target instanceof Element?target:null;
  while(node&&box){
    const style=getComputedStyle(node);
    const canScroll=/(auto|scroll)/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+1;
    if(canScroll){
      const canUp=deltaY<0&&node.scrollTop>0;
      const canDown=deltaY>0&&node.scrollTop+node.clientHeight<node.scrollHeight-1;
      if(canUp||canDown)return node;
    }
    if(node===box)break;
    node=node.parentElement;
  }
  return box;
}
function initSettingsWheelGuard(){
  const setup=document.getElementById('setup');
  if(!setup)return;
  setup.addEventListener('wheel',e=>{
    if(setup.classList.contains('hidden')||(!e.ctrlKey&&!e.metaKey))return;
    const scroller=settingsWheelScrollerFrom(e.target,e.deltaY);
    if(!scroller)return;
    e.preventDefault();
    scroller.scrollTop+=e.deltaY;
  },{passive:false});
}
initSettingsWheelGuard();

let activeContextHelpTip=null;
let contextHelpPinned=false;
let contextHelpHideTimer=null;
function positionContextHelp(tip=activeContextHelpTip){
  const pop=document.getElementById('context-help-popover');
  if(!tip||!pop||pop.hidden)return;
  const r=tip.getBoundingClientRect(),gap=8,pad=10;
  const w=pop.offsetWidth||300,h=pop.offsetHeight||60;
  let left=r.left+r.width/2-w/2;
  left=Math.max(pad,Math.min(innerWidth-w-pad,left));
  let top=r.bottom+gap;
  if(top+h>innerHeight-pad&&r.top-h-gap>=pad)top=r.top-h-gap;
  top=Math.max(pad,Math.min(innerHeight-h-pad,top));
  pop.style.left=Math.round(left)+'px';
  pop.style.top=Math.round(top)+'px';
}
function showContextHelp(tip,pinned=false){
  if(!(tip instanceof Element))return;
  const text=String(tip.dataset.help||'').trim();
  const pop=document.getElementById('context-help-popover');
  if(!text||!pop)return;
  if(contextHelpHideTimer){clearTimeout(contextHelpHideTimer);contextHelpHideTimer=null;}
  if(activeContextHelpTip&&activeContextHelpTip!==tip)activeContextHelpTip.classList.remove('help-active');
  activeContextHelpTip=tip;contextHelpPinned=!!pinned;
  tip.classList.add('help-active');tip.setAttribute('aria-expanded','true');tip.setAttribute('aria-controls','context-help-popover');
  const rawTitle=String(tip.dataset.helpTitle||tip.getAttribute('aria-label')||'Setting help').trim();
  const title=rawTitle.replace(/\s+help$/i,'')||'Setting help';
  pop.replaceChildren();
  const head=document.createElement('div');head.className='context-help-title';head.textContent=title;
  const copy=document.createElement('div');copy.className='context-help-copy';copy.textContent=text;
  const pin=document.createElement('div');pin.className='context-help-pin';pin.textContent=pinned?'Pinned · click the ? again or press Esc to close':'Click the ? to keep this explanation open';
  pop.append(head,copy,pin);pop.hidden=false;
  requestAnimationFrame(()=>positionContextHelp(tip));
}
function hideContextHelp(force=false){
  if(contextHelpPinned&&!force)return;
  if(contextHelpHideTimer){clearTimeout(contextHelpHideTimer);contextHelpHideTimer=null;}
  activeContextHelpTip?.classList.remove('help-active');
  activeContextHelpTip?.setAttribute('aria-expanded','false');
  activeContextHelpTip=null;contextHelpPinned=false;
  const pop=document.getElementById('context-help-popover');if(pop)pop.hidden=true;
}
function scheduleHideContextHelp(){
  if(contextHelpPinned)return;
  if(contextHelpHideTimer)clearTimeout(contextHelpHideTimer);
  contextHelpHideTimer=setTimeout(()=>hideContextHelp(false),100);
}
function initContextHelp(){
  document.addEventListener('pointerover',e=>{const tip=e.target?.closest?.('.help-tip');if(tip&&!contextHelpPinned)showContextHelp(tip,false);});
  document.addEventListener('pointerout',e=>{const tip=e.target?.closest?.('.help-tip');if(tip&&!tip.contains(e.relatedTarget))scheduleHideContextHelp();});
  document.addEventListener('focusin',e=>{const tip=e.target?.closest?.('.help-tip');if(tip&&!contextHelpPinned)showContextHelp(tip,false);});
  document.addEventListener('focusout',e=>{const tip=e.target?.closest?.('.help-tip');if(tip)scheduleHideContextHelp();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeContextHelpTip)hideContextHelp(true);});
  document.addEventListener('click',e=>{
    const tip=e.target?.closest?.('.help-tip');
    if(tip){
      e.preventDefault();e.stopPropagation();
      if(activeContextHelpTip===tip&&contextHelpPinned)hideContextHelp(true);
      else showContextHelp(tip,true);
      return;
    }
    if(activeContextHelpTip)hideContextHelp(true);
  },true);
  document.addEventListener('scroll',()=>{if(activeContextHelpTip)positionContextHelp();},true);
  window.addEventListener('resize',()=>{if(activeContextHelpTip)positionContextHelp();});
}
initContextHelp();
const SETTINGS_SECTION_RESET_EXCLUDED=new Set(['settings-overview','settings-about','settings-endpoints','settings-remote','settings-users','settings-profiles','settings-scenes','settings-family','settings-location','settings-integrations','settings-provider-health','settings-display-readiness','settings-system-health','settings-software-update','settings-update-history','settings-backup-recovery','settings-utilities']);
const SETTINGS_HEALTH_HELP={
  'health-server':'What it is: whether this browser can reach LibreDisplay’s local server/API. Healthy: Connected. If it is unavailable, live data, Settings saves, and remote controls can stop working; check the LibreDisplay service and local network first.',
  'health-weather':'What it is: the freshness and success state of the current weather feed. Healthy: recent data with no fetch error. If stale or failed, check Internet access, the saved location, and the weather provider before changing visual settings.',
  'health-calendars':'What it is: a summary of enabled ICS calendar feeds. Healthy: enabled feeds refresh without errors. A warning usually means one feed is unreachable, private, malformed, or returning an unexpected response; test the individual feed in Calendar Settings.',
  'health-background':'What it is: whether the selected background source can provide media. Healthy: the active source resolves to a usable image/video. If it fails, check the album/folder path, NAS mount, file permissions, or external provider.',
  'health-alerts':'What it is: the live weather-alert feed state. Healthy: enabled alert checks refresh normally, even when there are zero active alerts. A failure means LibreDisplay could not refresh the alert source; it does not mean severe weather is present.',
  'health-display':'What it is: whether the browser/display session has the information LibreDisplay needs for kiosk sizing and presentation. Healthy: a current local heartbeat and expected viewport. Problems here can explain wrong scaling, fullscreen state, or stale display behavior.',
  'health-cache':'What it is: locally cached provider data LibreDisplay can reuse during a short outage. Healthy: cache state is available without excessive age. Cache is a resilience layer, not proof that a provider is currently online.',
  'health-integrations':'What it is: a combined health summary for configured integrations. Healthy: configured providers are reachable and returning expected data. Use the integration-specific status to identify which service needs attention.',
  'health-software':'What it is: the installed LibreDisplay version and update-check state. Healthy: the installed version is known and the updater can check releases. A check failure does not stop the dashboard; it only prevents automatic update-status information.',
  'display-readiness-viewport':'What it is: the CSS-pixel area Chromium is actually giving LibreDisplay. Compare it with the display resolution you expect. A much smaller or oddly shaped viewport can cause clipping, scaling, or unexpected Arrange geometry.',
  'display-readiness-orientation':'What it is: landscape or portrait based on the live browser viewport. It should match the physical screen orientation. If it does not, check OS display rotation and Chromium/kiosk launch settings.',
  'display-readiness-scale':'What it is: device-pixel ratio — how many physical pixels Chromium uses for one CSS pixel. Higher values increase rendering work. Unexpected browser zoom or scaling can make the dashboard look too large and can substantially increase GPU load.',
  'display-readiness-heartbeat':'What it is: the heartbeat from LibreDisplay’s local kiosk/browser process. Healthy: a recent heartbeat. If missing, the server may still be running while Chromium is stopped, frozen, or disconnected from the dashboard.',
  'system-health-deployment':'What it is: how LibreDisplay is running on this machine and which release is active. Use it to confirm you are troubleshooting the expected installation/runtime rather than an older copy or different deployment mode.',
  'system-health-uptime':'What it is: time since the host last booted. A short uptime can explain recently cleared caches or restarted services; an unexpectedly short uptime can point to power, crash, or watchdog restarts.',
  'system-health-storage':'What it is: free disk space on the storage holding LibreDisplay data. Healthy: comfortably above 20% free. Below about 20% deserves attention; below 10% can interfere with updates, backups, caches, logs, and media handling.',
  'system-health-data':'What it is: whether LibreDisplay’s persistent data directory is writable. Healthy: Writable. If not writable, settings, backups, cache state, accounts, and other persistent changes may fail; check filesystem permissions and mount state.',
  'system-health-host':'What it is: operating-system, CPU architecture, and Python runtime identity for the host. It is mainly diagnostic information used to confirm that LibreDisplay is running on the machine/runtime you expect.',
  'system-health-hardware':'What it is: detected hardware model and CPU-core count. LibreDisplay uses Raspberry Pi model information to choose safer animation budgets. If the model is missing, performance tuning falls back to conservative browser/CPU hints.',
  'system-health-memory':'What it is: currently available RAM versus total RAM, plus CPU temperature when exposed by the OS. LibreDisplay normally does not need most free RAM; animation smoothness is more often limited by GPU/compositor/frame time. Temperatures around 70°C merit watching; around 80°C or above can cause throttling.',
  'system-health-load':'What it is: the average number of tasks running or waiting for CPU/I/O over the last 1, 5, and 15 minutes. Compare each number with the CPU-core count: on a 4-core Pi, about 4.0 means all cores are continuously busy; well below 4 leaves CPU headroom, while sustained values above 4 mean work is queueing. Load is not a percentage and can rise from disk/network waits too.',
  'system-health-browser':'What it is: health/performance reported by the kiosk Chromium process. FPS is actual measured animation pacing; target FPS is LibreDisplay’s current goal; dropped frames and long tasks indicate visible hitching. On a Pi 4, a stable 30 FPS is usually smoother than an unstable 45–60 FPS.',
  'system-health-pi-runtime':'What it is: Raspberry Pi display-session, graphics-driver, clock, governor, and throttling evidence from the host. Healthy on a Pi 4 normally means Wayland/X11 is known, vc4/v3d are loaded, clocks are not capped, and current throttle bits are clear. Historical throttle bits mean the Pi has previously hit undervoltage, frequency capping, or thermal limits even if it is healthy now.',
  'system-health-chromium':'What it is: Chromium process count, GPU/renderer process presence, memory use, and the launch flags that determine the rendering path. For Pi 4 performance, look for a GPU process plus GPU raster, zero-copy, EGL, Canvas OOP rasterization, and the hardware-acceleration profile. GPU DISABLED or a missing GPU process is a strong performance warning.',
  'system-health-connectivity':'What it is: recent browser and server network-request success, failures, retries, timeouts, and latency. Healthy: online with few/no failures. Repeated timeouts or failures can make integrations look stale even when CPU/GPU performance is fine.',
  'system-health-integrity':'What it is: startup verification that required LibreDisplay runtime/frontend pieces are present. Healthy: Verified. A warning suggests missing, mismatched, or unverified application files and should be investigated before blaming a provider or display setting.',
  'system-health-recovery':'What it is: actions taken by LibreDisplay’s watchdog/recovery safeguards, such as browser/server restarts or configuration recovery. Healthy: no repeated recovery actions. Recurring restarts are evidence of an underlying stability problem worth investigating.'
};
function settingsSectionResetControls(section){return [...section.querySelectorAll('input,select,textarea')].filter(el=>{if(el.readOnly||el.type==='file'||el.type==='hidden'||['password','url','search'].includes(el.type))return false;if(el.matches('textarea'))return false;if(el.type==='text'&&!/-hex$/.test(el.id||''))return false;return true;});}
function restoreSettingsControlDefault(el){if(el instanceof HTMLSelectElement){const option=[...el.options].find(o=>o.defaultSelected)||el.options[0];if(option)el.value=option.value;}else if(el.type==='checkbox'||el.type==='radio')el.checked=el.defaultChecked;else el.value=el.defaultValue;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
function resetSettingsSection(sectionId){const section=document.getElementById(sectionId);if(!section||SETTINGS_SECTION_RESET_EXCLUDED.has(sectionId))return false;const controls=settingsSectionResetControls(section);for(const control of controls)restoreSettingsControlDefault(control);const appearance=LibreDisplayRuntime.getModule('appearance'),weather=LibreDisplayRuntime.getModule('weather'),config=LibreDisplayRuntime.getModule('config');if(sectionId==='settings-theme'){appearance.renderThemeChoices?.('libre-night');appearance.selectThemeChoice?.('libre-night');}if(sectionId==='settings-weather-details')weather.setWeatherDetailsForm?.(config.CFG_DEFAULTS);if(sectionId==='settings-layout'){appearance.settingsLayoutPresetKey='default';appearance.renderLayoutPresetGallery?.();}appearance.updateAppearanceLabels?.(appearance.appearanceFromForm?.()||config.cfg);appearance.previewAppearance?.();systemApi.markSettingsDirty?.();const btn=section.querySelector(':scope > .settings-section-reset');if(btn){const original=btn.textContent;btn.textContent='Reset ✓';btn.classList.add('reset-done');setTimeout(()=>{if(btn.isConnected){btn.textContent=original;btn.classList.remove('reset-done');}},1200);}return true;}
function enhanceSettingsSectionResets(){document.querySelectorAll('.s-section[data-settings-tab]').forEach(section=>{if(SETTINGS_SECTION_RESET_EXCLUDED.has(section.id)||section.querySelector(':scope > .settings-section-reset'))return;const controls=settingsSectionResetControls(section),special=section.id==='settings-weather-details';if(!controls.length&&!special)return;const btn=document.createElement('button');btn.type='button';btn.className='settings-section-reset';btn.textContent='Reset';btn.setAttribute('aria-label',`Reset ${section.querySelector(':scope > h3')?.childNodes[0]?.textContent?.trim()||'section'} to LibreDisplay defaults`);btn.title='Reset only this section to LibreDisplay defaults';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();resetSettingsSection(section.id);});section.appendChild(btn);});}
function enhanceSettingsHealthHelp(){for(const [valueId,help] of Object.entries(SETTINGS_HEALTH_HELP)){const value=document.getElementById(valueId),card=value?.closest('.health-card'),label=card?.querySelector('.health-label');if(!label||label.querySelector('.help-tip'))continue;const title=String(label.textContent||'Health status').trim();const make=settingsStateApi().makeSettingsHelpButton;label.appendChild(make?make(title,help,true):Object.assign(document.createElement('button'),{type:'button',className:'help-tip settings-auto-help',textContent:'?'}));const tip=label.querySelector('.help-tip:last-child');if(tip&&!tip.dataset.help){tip.dataset.help=help;tip.dataset.helpTitle=title;tip.setAttribute('aria-label',`${title} help`);tip.setAttribute('aria-expanded','false');tip.setAttribute('aria-controls','context-help-popover');}}}
function enhanceSettingsSectionPolish(){enhanceSettingsSectionResets();enhanceSettingsHealthHelp();}

window.addEventListener('beforeunload',e=>{const setup=document.getElementById('setup');if(systemApi.settingsDirty&&(settingsStateApi().settingsPreviewMode||(setup&&!setup.classList.contains('hidden')))){e.preventDefault();e.returnValue='';}});


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("settings", {hideDashboardCursor,showDashboardCursorTemporarily,initCursorAutoHide,settingsWheelScrollerFrom,initSettingsWheelGuard,positionContextHelp,showContextHelp,hideContextHelp,scheduleHideContextHelp,initContextHelp,settingsSectionResetControls,restoreSettingsControlDefault,resetSettingsSection,enhanceSettingsSectionResets,enhanceSettingsHealthHelp,enhanceSettingsSectionPolish}, {
  "CURSOR_HIDE_DELAY_MS": {configurable:true,get:()=>CURSOR_HIDE_DELAY_MS},
  "cursorHideTimer": {configurable:true,get:()=>cursorHideTimer,set:(value)=>{cursorHideTimer=value;}},
  "activeContextHelpTip": {configurable:true,get:()=>activeContextHelpTip,set:(value)=>{activeContextHelpTip=value;}},
  "contextHelpPinned": {configurable:true,get:()=>contextHelpPinned,set:(value)=>{contextHelpPinned=value;}},
  "contextHelpHideTimer": {configurable:true,get:()=>contextHelpHideTimer,set:(value)=>{contextHelpHideTimer=value;}}
}, {globalFunctions:['hideContextHelp'],globalStates:[]});
}
// End source section: /js/settings/interactions.js

// LibreDisplay source section: /js/settings/accounts.js
{
// Owner-managed local account administration.
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;
const {escHtml,resilientFetch}=LibreDisplayRuntime.getModule('shared');


async function loadLocalAccounts(){const host=document.getElementById('account-list'),status=document.getElementById('account-status');if(!host||bootstrapApi.SESSION_ROLE!=='owner')return;try{const r=await resilientFetch(serverPath('/api/users'),{cache:'no-store'}),d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||('HTTP '+r.status));const rows=Array.isArray(d.users)?d.users:[];host.innerHTML=rows.length?rows.map(u=>`<div class="account-row"><b>${escHtml(u.username)}</b><span>${escHtml(u.role)}</span><span class="account-endpoints">${escHtml(u.role==='owner'?'All displays':(u.endpoints||[]).join(', ')||'No displays')}</span><span><button class="btn-util" type="button" data-ld-action-click="settings.editLocalAccount" data-ld-action-args="${escHtml(JSON.stringify([u.username,u.role,(u.endpoints||[]).join(',')]))}">Edit</button> <button class="btn-util" type="button" data-ld-action-click="settings.deleteLocalAccount" data-ld-action-args="${escHtml(JSON.stringify([u.username]))}">Delete</button></span></div>`).join(''):'<div class="settings-note">No local accounts yet. The local display and pairing link remain Owner access.</div>';if(status)status.textContent='';}catch(e){if(status)status.textContent='Could not load accounts: '+(e.message||e);}}
function editLocalAccount(username,role,endpoints){const u=document.getElementById('account-username'),r=document.getElementById('account-role'),e=document.getElementById('account-endpoints'),p=document.getElementById('account-password');if(u)u.value=username;if(r)r.value=role;if(e)e.value=endpoints;if(p)p.value='';}
async function saveLocalAccount(action){const status=document.getElementById('account-status');try{const username=(document.getElementById('account-username')?.value||'').trim(),role=document.getElementById('account-role')?.value||'viewer',password=document.getElementById('account-password')?.value||'',endpoints=(document.getElementById('account-endpoints')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);const body={action,username,role,endpoints};if(password)body.password=password;const r=await resilientFetch(serverPath('/api/users'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||('HTTP '+r.status));if(status)status.textContent=action==='create'?'Account created.':'Account updated. Existing sessions for that user are invalidated when the password changes.';document.getElementById('account-password').value='';await loadLocalAccounts();}catch(e){if(status)status.textContent='Could not save account: '+(e.message||e);}}
async function deleteLocalAccount(username){if(!confirm(`Delete local account “${username}”?`))return;const status=document.getElementById('account-status');try{const r=await resilientFetch(serverPath('/api/users'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',username}),cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||('HTTP '+r.status));if(status)status.textContent='Account deleted and its active sessions invalidated.';await loadLocalAccounts();}catch(e){if(status)status.textContent='Could not delete account: '+(e.message||e);}}


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("settings", {loadLocalAccounts,editLocalAccount,saveLocalAccount,deleteLocalAccount}, {}, {globalFunctions:['loadLocalAccounts','editLocalAccount','saveLocalAccount','deleteLocalAccount']});
}
// End source section: /js/settings/accounts.js

// LibreDisplay source section: /js/settings/delegated-events.js
{
// CSP-safe replacement for the legacy dashboard event attributes. The HTML carries inert IDs; executable code lives only in this external script.
const DASHBOARD_EVENT_HANDLERS=Object.freeze({
  h001:function(event){requestCloseSetup()},
  h002:function(event){filterSettings(this.value)},
  h003:function(event){clearSettingsSearch()},
  h004:function(event){switchSettingsTab(this.value)},
  h005:function(event){switchSettingsTab('overview')},
  h006:function(event){switchSettingsTab('calendars')},
  h007:function(event){switchSettingsTab('backgrounds')},
  h008:function(event){switchSettingsTab('weather')},
  h009:function(event){switchSettingsTab('weatherfx')},
  h010:function(event){switchSettingsTab('weatheralerts')},
  h011:function(event){switchSettingsTab('nature')},
  h012:function(event){switchSettingsTab('wildlife')},
  h013:function(event){switchSettingsTab('companions')},
  h014:function(event){switchSettingsTab('look')},
  h015:function(event){switchSettingsTab('displaycare')},
  h016:function(event){switchSettingsTab('layout')},
  h017:function(event){switchSettingsTab('family')},
  h018:function(event){switchSettingsTab('integrations')},
  h019:function(event){switchSettingsTab('displays')},
  h020:function(event){switchSettingsTab('system')},
  h021:function(event){setSettingsViewMode('essential')},
  h022:function(event){setSettingsViewMode('all')},
  h023:function(event){jumpToSettingsSection(this.value)},
  h024:function(event){setAllSettingsSectionsCollapsed(false)},
  h025:function(event){setAllSettingsSectionsCollapsed(true)},
  h026:function(event){location.reload()},
  h027:function(event){launchLayoutEditorFromSettings()},
  h028:function(event){refreshDataNow();setTimeout(updateSettingsOverview,500)},
  h029:function(event){testCalendarInputs();setTimeout(updateSettingsOverview,800)},
  h030:function(event){reloadBackgroundNow();setTimeout(updateSettingsOverview,800)},
  h031:function(event){requestDeviceDisplayMode('windowed')},
  h032:function(event){requestDeviceDisplayMode('kiosk')},
  h033:function(event){startWizardFromSettings()},
  h034:function(event){createDisplayEndpoint()},
  h035:function(event){loadDisplayEndpoints()},
  h036:function(event){copyRemoteSettingsUrl()},
  h037:function(event){copyRemoteDisplayUrl()},
  h038:function(event){toggleRemoteAccess()},
  h039:function(event){rotateRemoteAccessKey()},
  h040:function(event){saveLocalAccount('create')},
  h041:function(event){saveLocalAccount('update')},
  h042:function(event){loadLocalAccounts()},
  h043:function(event){updateProfileControls()},
  h044:function(event){createProfile()},
  h045:function(event){updateSelectedProfile()},
  h046:function(event){duplicateSelectedProfile()},
  h047:function(event){loadSelectedProfile()},
  h048:function(event){applySelectedProfileToDisplay()},
  h049:function(event){captureTargetDisplayAsProfile()},
  h050:function(event){renameSelectedProfile()},
  h051:function(event){deleteSelectedProfile()},
  h052:function(event){LibreDisplayRuntime.getModule('config').sceneStore.automatic=this.checked},
  h053:function(event){addSceneRule()},
  h054:function(event){saveScenes()},
  h055:function(event){loadScenes()},
  h056:function(event){saveHouseholdSettings()},
  h057:function(event){loadHouseholdSettings()},
  h058:function(event){setHouseholdPin()},
  h059:function(event){clearHouseholdPin()},
  h060:function(event){weatherLocationQueryChanged()},
  h061:function(event){if(event.key==='Enter'){event.preventDefault();searchWeatherLocations();}},
  h062:function(event){searchWeatherLocations()},
  h063:function(event){previewWeatherLocationLabel()},
  h064:function(event){addCalendarSource()},
  h065:function(event){document.getElementById('calendar-file-input').click()},
  h066:function(event){testCalendarInputs()},
  h067:function(event){importCalendarFile(this)},
  h068:function(event){previewAppearance()},
  h069:function(event){handleAlertsEnabledChange()},
  h070:function(event){handleAlertTestModeChange()},
  h071:function(event){previewAlertSize(this.value)},
  h072:function(event){handleAlertMotionChange()},
  h073:function(event){previewAlertMotionSpeed(this.value)},
  h074:function(event){previewAlertTestFullScreen()},
  h075:function(event){previewAppearance()},
  h076:function(event){updateBackgroundSourceUI()},
  h077:function(event){reloadBackgroundNow()},
  h078:function(event){nextBackgroundNow()},
  h079:function(event){reshuffleBackgroundNow()},
  h080:function(event){openMediaFolderBrowser()},
  h081:function(event){scanFolderBackgroundsFromForm()},
  h082:function(event){browseMediaParent()},
  h083:function(event){addCurrentMediaFolder()},
  h084:function(event){updateBackgroundReserveEstimate()},
  h085:function(event){document.getElementById('s-bg-startup-delay-value').textContent=(Number(this.value)/1000).toFixed(1)+'s'},
  h086:function(event){weatherAnimationControlChanged(this)},
  h087:function(event){applyWeatherEffectPreset('subtle')},
  h088:function(event){applyWeatherEffectPreset('balanced')},
  h089:function(event){applyWeatherEffectPreset('immersive')},
  h090:function(event){previewCurrentWeatherOverlay()},
  h091:function(event){handleWeatherEffectTestModeChange(this)},
  h092:function(event){weatherEffectTestProfileChanged(this)},
  h093:function(event){previewWeatherTestFullScreen()},
  h094:function(event){stopWeatherEffectTest()},
  h095:function(event){weatherHazardTestProfileChanged(this)},
  h096:function(event){previewWeatherHazardTestFullScreen()},
  h097:function(event){stopWeatherHazardTest()},
  h098:function(event){enableRecommendedWeatherDetails()},
  h099:function(event){enableAllWeatherDetails()},
  h100:function(event){applyStarterTemplate('family')},
  h101:function(event){applyStarterTemplate('photo')},
  h102:function(event){applyStarterTemplate('minimal')},
  h103:function(event){applyStarterTemplate('weather')},
  h104:function(event){applyStarterTemplate('portrait')},
  h105:function(event){applyStarterTemplate('smarthome')},
  h106:function(event){applyStarterTemplate('morning')},
  h107:function(event){applyStarterTemplate('metrics')},
  h108:function(event){selectFontChoice(this.value,true)},
  h109:function(event){previewSelectedLayoutFromSettings()},
  h110:function(event){resetSavedBlockLayout()},
  h111:function(event){renderIntegrationDirectory()},
  h112:function(event){renderIntegrationDirectory()},
  h113:function(event){checkAllIntegrationsNow()},
  h114:function(event){loadIntegrationHealth()},
  h115:function(event){refreshProviderHealth(true)},
  h116:function(event){refreshDisplayReadiness()},
  h117:function(event){loadSystemHealth()},
  h118:function(event){downloadDiagnostics()},
  h119:function(event){checkSoftwareUpdate(true)},
  h120:function(event){startSoftwareUpdate()},
  h121:function(event){exportPortableBackup()},
  h122:function(event){document.getElementById('portable-import-file').click()},
  h123:function(event){importPortableBackupFile(this)},
  h124:function(event){createRestorePoint()},
  h125:function(event){loadRestorePoints()},
  h126:function(event){refreshDataNow()},
  h127:function(event){enterFullscreen()},
  h128:function(event){resetAppearanceForm()},
  h129:function(event){exportSettings()},
  h130:function(event){document.getElementById('s-import-file').click()},
  h131:function(event){restorePreviousSettings()},
  h132:function(event){copyDiagnostics()},
  h133:function(event){clearOfflineCache()},
  h134:function(event){importSettingsFile(this)},
  h135:function(event){wizardBack()},
  h136:function(event){wizardSkip()},
  h137:function(event){openFullSettingsFromWizard()},
  h138:function(event){wizardNext()},
  h139:function(event){previewDashboardFromSettings()},
  h140:function(event){saveSetup()},
  h141:function(event){toggleQuickAccessMenu(event)},
  h142:function(event){quickAccessArrange()},
  h143:function(event){quickAccessAddBlock()},
  h144:function(event){quickAccessIntegrations()},
  h145:function(event){quickAccessSettings()},
  h146:function(event){quickAccessRefresh()},
  h147:function(event){quickAccessUseDevice()},
  h148:function(event){quickAccessFullscreen()},
  h149:function(event){returnToSettingsPreview()},
  h150:function(event){selectRemoteLayoutElement(this.value)},
  h151:function(event){reloadRemoteLayoutPreview()},
  h152:function(event){closeRemoteLayoutPreview()},
  h153:function(event){saveLayoutEditor()},
  h154:function(event){cancelLayoutEditor()},
  h155:function(event){undoLayoutEditor()},
  h156:function(event){redoLayoutEditor()},
  h157:function(event){resetLayoutEditorDraft()},
  h158:function(event){resetSelectedLayoutBlock()},
  h159:function(event){openBlockCatalog()},
  h160:function(event){toggleLayoutShortcuts()},
  h161:function(event){configureSelectedCustomBlock()},
  h162:function(event){duplicateSelectedCustomBlock()},
  h163:function(event){changeSelectedBlockLayer(-1)},
  h164:function(event){changeSelectedBlockLayer(1)},
  h165:function(event){deleteSelectedCustomBlock()},
  h166:function(event){selectLayoutBlock(this.value)},
  h167:function(event){setLayoutEditorGrid(this.value)},
  h168:function(event){setLayoutEditorSnap(this.checked)},
  h169:function(event){LibreDisplayRuntime.getModule('layout').setLayoutSmartGuides(this.checked)},
  h170:function(event){toggleLayoutShortcuts(false)},
  h171:function(event){toggleLayoutInspectorCollapse()},
  h172:function(event){resetLayoutInspectorPosition()},
  h173:function(event){selectLayoutPart(this.value)},
  h174:function(event){resetSelectedStyleScope()},
  h175:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalScope('major')},
  h176:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalScope('details')},
  h177:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationMajorLayout(this.value)},
  h178:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalPart(this.value)},
  h179:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalHidden(!this.checked)},
  h180:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalMode(this.value)},
  h181:function(event){LibreDisplayRuntime.getModule('layout').moveIntegrationInternalOrder(-1)},
  h182:function(event){LibreDisplayRuntime.getModule('layout').moveIntegrationInternalOrder(1)},
  h183:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalContainerLayout(this.value)},
  h184:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalGap(this.value)},
  h185:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalAlign(this.value)},
  h186:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalJustify(this.value)},
  h187:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalGeometry('x',this.value)},
  h188:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalGeometry('y',this.value)},
  h189:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalGeometry('w',this.value)},
  h190:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalGeometry('h',this.value)},
  h191:function(event){LibreDisplayRuntime.getModule('layout').setIntegrationInternalGeometry('z',this.value)},
  h192:function(event){LibreDisplayRuntime.getModule('layout').placeIntegrationInternalPart('top-left')},
  h193:function(event){LibreDisplayRuntime.getModule('layout').placeIntegrationInternalPart('top-center')},
  h194:function(event){LibreDisplayRuntime.getModule('layout').placeIntegrationInternalPart('top-right')},
  h195:function(event){LibreDisplayRuntime.getModule('layout').placeIntegrationInternalPart('middle-left')},
  h196:function(event){LibreDisplayRuntime.getModule('layout').placeIntegrationInternalPart('middle-center')},
  h197:function(event){LibreDisplayRuntime.getModule('layout').placeIntegrationInternalPart('middle-right')},
  h198:function(event){LibreDisplayRuntime.getModule('layout').placeIntegrationInternalPart('bottom-left')},
  h199:function(event){LibreDisplayRuntime.getModule('layout').placeIntegrationInternalPart('bottom-center')},
  h200:function(event){LibreDisplayRuntime.getModule('layout').placeIntegrationInternalPart('bottom-right')},
  h201:function(event){LibreDisplayRuntime.getModule('layout').resetIntegrationInternalPart()},
  h202:function(event){LibreDisplayRuntime.getModule('layout').resetIntegrationInternalLayout()},
  h203:function(event){setSelectedContentScale(this.value)},
  h204:function(event){finishSelectedContentScaleEdit()},
  h205:function(event){setSelectedContentScale(this.value);finishSelectedContentScaleEdit()},
  h206:function(event){resetSelectedContentScale()},
  h207:function(event){setSelectedLayoutStyle('fontFamily',this.value)},
  h208:function(event){setSelectedLayoutStyle('textColor',this.value,true)},
  h209:function(event){finishSelectedLayoutStyleEdit()},
  h210:function(event){setSelectedLayoutColorHex(this.value)},
  h211:function(event){setSelectedLayoutStyle('textColor','')},
  h212:function(event){setSelectedPartFineStyle('fontWeight',this.value)},
  h213:function(event){setSelectedPartFineStyle('lineHeight',this.value,true)},
  h214:function(event){finishSelectedPartFineStyleEdit()},
  h215:function(event){setSelectedPartFineStyle('lineHeight',100)},
  h216:function(event){setSelectedPartFineStyle('letterSpacing',this.value,true)},
  h217:function(event){setSelectedPartFineStyle('letterSpacing',0)},
  h218:function(event){setSelectedPartFineStyle('visible',this.checked)},
  h219:function(event){setSelectedLayoutStyle('hAlign','left')},
  h220:function(event){setSelectedLayoutStyle('hAlign','center')},
  h221:function(event){setSelectedLayoutStyle('hAlign','right')},
  h222:function(event){setSelectedLayoutStyle('hAlign','auto')},
  h223:function(event){setSelectedLayoutStyle('vAlign','top')},
  h224:function(event){setSelectedLayoutStyle('vAlign','middle')},
  h225:function(event){setSelectedLayoutStyle('vAlign','bottom')},
  h226:function(event){setSelectedLayoutStyle('vAlign','auto')},
  h227:function(event){setSelectedLayoutStyle('opacity',this.value,true)},
  h228:function(event){setSelectedLayoutStyle('opacity',100)},
  h229:function(event){LibreDisplayRuntime.getModule('layout').applyLayoutSelectionRelationship('match-width')},
  h230:function(event){LibreDisplayRuntime.getModule('layout').applyLayoutSelectionRelationship('match-height')},
  h231:function(event){LibreDisplayRuntime.getModule('layout').applyLayoutSelectionRelationship('align-left')},
  h232:function(event){LibreDisplayRuntime.getModule('layout').applyLayoutSelectionRelationship('align-center-x')},
  h233:function(event){LibreDisplayRuntime.getModule('layout').applyLayoutSelectionRelationship('align-right')},
  h234:function(event){LibreDisplayRuntime.getModule('layout').applyLayoutSelectionRelationship('align-top')},
  h235:function(event){LibreDisplayRuntime.getModule('layout').applyLayoutSelectionRelationship('align-middle-y')},
  h236:function(event){LibreDisplayRuntime.getModule('layout').applyLayoutSelectionRelationship('align-bottom')},
  h237:function(event){LibreDisplayRuntime.getModule('layout').applyLayoutSelectionRelationship('space-h')},
  h238:function(event){LibreDisplayRuntime.getModule('layout').applyLayoutSelectionRelationship('space-v')},
  h239:function(event){placeSelectedLayoutBlock('top-left')},
  h240:function(event){placeSelectedLayoutBlock('top-center')},
  h241:function(event){placeSelectedLayoutBlock('top-right')},
  h242:function(event){placeSelectedLayoutBlock('middle-left')},
  h243:function(event){placeSelectedLayoutBlock('center')},
  h244:function(event){placeSelectedLayoutBlock('middle-right')},
  h245:function(event){placeSelectedLayoutBlock('bottom-left')},
  h246:function(event){placeSelectedLayoutBlock('bottom-center')},
  h247:function(event){placeSelectedLayoutBlock('bottom-right')},
  h248:function(event){LibreDisplayRuntime.getModule('layout').alignSelectedLayoutBlockAxis('center-x')},
  h249:function(event){LibreDisplayRuntime.getModule('layout').alignSelectedLayoutBlockAxis('center-y')},
  h250:function(event){LibreDisplayRuntime.getModule('layout').alignSelectedLayoutBlockAxis('mirror-x')},
  h251:function(event){LibreDisplayRuntime.getModule('layout').alignSelectedLayoutBlockAxis('mirror-y')},
  h252:function(event){closeBlockCatalog()},
  h253:function(event){filterBlockCatalog(this.value)},
  h254:function(event){closeBlockConfig()},
  h255:function(event){saveBlockConfig()},
});
const DASHBOARD_DELEGATED_EVENTS=Object.freeze(['click','input','change','keydown','dragstart','dragend','dragover','drop']);
function delegatedEventElement(event,attr){const target=event?.target;return target&&typeof target.closest==='function'?target.closest('['+attr+']'):null;}
function delegatedActionArgs(element){const raw=element?.getAttribute?.('data-ld-action-args')||'';if(!raw)return [];try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:[parsed];}catch(_e){return [];}}
function resolveDelegatedAction(name){const parts=String(name||'').split('.');if(parts.length===2){const api=LibreDisplayRuntime.getModule(parts[0]);const fn=api?.[parts[1]];return typeof fn==='function'?fn.bind(api):null;}const fn=globalThis[String(name||'')];return typeof fn==='function'?fn:null;}
function runDeclarativeAction(eventName,event,element){if(!element)return;const prevent=element.getAttribute('data-ld-prevent-'+eventName);if(prevent==='1')event.preventDefault();const removeClass=element.getAttribute('data-ld-remove-class-'+eventName);if(removeClass)element.classList?.remove(removeClass);const name=element.getAttribute('data-ld-action-'+eventName);if(!name)return;const fn=resolveDelegatedAction(name);if(!fn)return;const args=delegatedActionArgs(element),pass=element.getAttribute('data-ld-action-pass')||'';if(pass==='checked')args.push(!!element.checked);else if(pass==='value')args.push(element.value);if(element.getAttribute('data-ld-action-event-first')==='1')args.unshift(event);else if(element.getAttribute('data-ld-action-event-last')==='1')args.push(event);return fn.apply(element,args);}
function handleDelegatedDashboardEvent(eventName,event){const staticAttr='data-ld-on'+eventName;const staticElement=delegatedEventElement(event,staticAttr);if(staticElement){const fn=DASHBOARD_EVENT_HANDLERS[staticElement.getAttribute(staticAttr)];if(typeof fn==='function')return fn.call(staticElement,event);}const actionAttr='data-ld-action-'+eventName;const actionElement=delegatedEventElement(event,actionAttr)||delegatedEventElement(event,'data-ld-prevent-'+eventName)||delegatedEventElement(event,'data-ld-remove-class-'+eventName);return runDeclarativeAction(eventName,event,actionElement);}
function bindDelegatedDashboardEvents(){for(const eventName of DASHBOARD_DELEGATED_EVENTS)document.addEventListener(eventName,event=>handleDelegatedDashboardEvent(eventName,event));}
function handleExpandableSummaryClick(event){const summary=event?.target?.closest?.('summary');if(!summary||event.target?.closest?.('button,input,select,textarea,a,label,[contenteditable="true"]'))return;const details=summary.parentElement;if(!details||details.tagName!=='DETAILS')return;if(!details.matches('#layout-properties details,#block-config-modal details'))return;event.preventDefault();details.open=!details.open;}
bindDelegatedDashboardEvents();
document.addEventListener('click',handleExpandableSummaryClick);
LibreDisplayRuntime.exposeModule('settings',{handleDelegatedDashboardEvent,bindDelegatedDashboardEvents,resolveDelegatedAction,handleExpandableSummaryClick}, {}, {globals:false});
}
// End source section: /js/settings/delegated-events.js
