const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const configApi=LibreDisplayRuntime.getModule('config');
const calendarApi=LibreDisplayRuntime.getModule('calendar');
let displayHydrationRecoveryStarted=false,displayHydrationRecoveryRunning=false;
function displayHydrationRecoveryNeeds(){
  if(!cfg?.onboardingComplete)return {any:false};
  const weather=!!(cfg.lat&&cfg.lon&&!configApi.wxData);
  const enabledCalendars=(cfg.calendars||[]).filter(c=>(c.url||c.configured)&&c.enabled!==false);
  const calendars=enabledCalendars.length>0&&(calendarApi.calStatuses.length===0||calendarApi.calStatuses.some(s=>s?.pending||s?.ok===false));
  let background=false;
  if(cfg.backgroundSource==='stock')background=!configApi.bgLastUrl;
  else if(cfg.backgroundSource==='google')background=!!cfg.photosUrl&&!configApi.bgSourceImages.length;
  else if(cfg.backgroundSource==='folders')background=!!cfg.mediaFolders?.length&&!configApi.bgSourceImages.length;
  return {weather,calendars,background,any:weather||calendars||background};
}
async function retryDisplayHydration(reason='scheduled'){
  if(displayHydrationRecoveryRunning||!(bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LOCAL_CLIENT_MODE)||LAYOUT_PREVIEW_MODE)return;
  const need=displayHydrationRecoveryNeeds();if(!need.any)return;
  const weather=LibreDisplayRuntime.getModule('weather');
  const calendar=LibreDisplayRuntime.getModule('calendar');
  const backgrounds=LibreDisplayRuntime.getModule('backgrounds');
  const jobs=[];
  if(need.weather)jobs.push(Promise.resolve(weather.fetchWeather()));
  if(need.calendars)jobs.push(Promise.resolve(calendar.loadCalendars()));
  if(need.background){if(cfg.backgroundSource==='stock')jobs.push(Promise.resolve(backgrounds.loadStockBackground()));else if(cfg.backgroundSource==='google'&&cfg.photosUrl)jobs.push(Promise.resolve(backgrounds.loadPhotos(cfg.photosUrl)));else if(cfg.backgroundSource==='folders'&&cfg.mediaFolders?.length)jobs.push(Promise.resolve(backgrounds.loadFolderBackgrounds(cfg.mediaFolders,cfg.mediaRecursive)));}
  if(cfg.alertsEnabled)jobs.push(Promise.resolve(weather.fetchWeatherAlerts()));
  if(!jobs.length)return;
  displayHydrationRecoveryRunning=true;
  try{await Promise.allSettled(jobs);}finally{displayHydrationRecoveryRunning=false;}
}
function startDisplayHydrationRecovery(attempt=0){
  if(displayHydrationRecoveryStarted)return;
  if(!(bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LOCAL_CLIENT_MODE)){
    if(attempt<30)setTimeout(()=>startDisplayHydrationRecovery(attempt+1),500);
    return;
  }
  displayHydrationRecoveryStarted=true;
  [5000,15000,35000,75000,150000].forEach(ms=>setTimeout(()=>retryDisplayHydration('startup+'+Math.round(ms/1000)+'s'),ms));
  const remote=LibreDisplayRuntime.getModule('remote');
  window.addEventListener('online',()=>{remote.noteServerTransportError();setTimeout(()=>retryDisplayHydration('online'),350);});
  window.addEventListener('offline',()=>{remote.clearServerReconnectNotice();remote.setServerConnectionState('offline');});
  window.addEventListener('pageshow',()=>setTimeout(()=>retryDisplayHydration('pageshow'),500));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>retryDisplayHydration('visible'),500);});
}

async function init(){
  const aboutRelease=document.getElementById('about-release');if(aboutRelease)aboutRelease.textContent=bootstrapApi.DASHBOARD_BUILD;
  const appearance=LibreDisplayRuntime.getModule('appearance');
  const settings=LibreDisplayRuntime.getModule('settings');
  const integrations=LibreDisplayRuntime.getModule('integrations');
  const blocks=LibreDisplayRuntime.getModule('blocks');
  const config=LibreDisplayRuntime.getModule('config');
  const system=LibreDisplayRuntime.getModule('system');
  const onboarding=LibreDisplayRuntime.getModule('onboarding');
  const weather=LibreDisplayRuntime.getModule('weather');
  const calendar=LibreDisplayRuntime.getModule('calendar');
  const remote=LibreDisplayRuntime.getModule('remote');

  appearance.applyProductTheme('libre-night');
  await settings.loadSessionInfo();
  if(bootstrapApi.SESSION_ROLE==='owner')await settings.loadLocalAccounts();
  await integrations.loadIntegrations();
  await blocks.loadHousehold(false);
  await config.loadCfg();
  await config.loadProfiles();
  if(!bootstrapApi.READ_ONLY_DISPLAY_MODE)await system.loadScenes();
  onboarding.bindCalendarColorControls();
  appearance.bindTextColorControls();
  weather.previewAlertSize(cfg.alertCardPct);
  weather.previewAlertMotionSpeed(cfg.alertMotionPx);
  appearance.applyUiCustomization(cfg);
  calendar.renderCalendar([]);
  if(cfg.onboardingComplete&&cfg.lat&&cfg.lon){
    document.getElementById('setup').classList.add('hidden');
    settings.applySettings();
    if((bootstrapApi.REMOTE_SETTINGS_MODE||bootstrapApi.OPEN_SETTINGS_MODE)&&!bootstrapApi.READ_ONLY_DISPLAY_MODE)settings.openSetup(false);
    else setTimeout(settings.revealSettingsCog,800);
  }else if(bootstrapApi.READ_ONLY_DISPLAY_MODE){
    document.getElementById('setup').classList.add('hidden');
    settings.applySettings();
  }else{
    configApi.wizardStepIndex=0;
    settings.openSetup(true);
  }
  remote.startLiveDisplayConnection();
  remote.startRemoteConfigPolling();
  if(!bootstrapApi.READ_ONLY_DISPLAY_MODE)setTimeout(()=>{remote.loadRemoteInfo();remote.loadCacheStatus();remote.loadDisplayEndpoints();},300);
}
function autoStartLayoutPreviewWhenReady(attempt=0){
  if(!LAYOUT_PREVIEW_MODE||bootstrapApi.READ_ONLY_DISPLAY_MODE)return;
  if(document.getElementById('setup')?.classList.contains('hidden')&&cfg&&typeof cfg==='object'){document.body.classList.add('layout-preview-embedded');setTimeout(()=>LibreDisplayRuntime.getModule('layout').startLayoutEditor(),100);return;}
  if(attempt<120)setTimeout(()=>autoStartLayoutPreviewWhenReady(attempt+1),50);
}
const dashboardInitPromise=init();
setTimeout(()=>startDisplayHydrationRecovery(),1200);
if(LAYOUT_PREVIEW_MODE)dashboardInitPromise.then(()=>autoStartLayoutPreviewWhenReady()).catch(()=>autoStartLayoutPreviewWhenReady());

// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("lifecycle", {displayHydrationRecoveryNeeds,retryDisplayHydration,startDisplayHydrationRecovery,init,autoStartLayoutPreviewWhenReady}, {
  "displayHydrationRecoveryStarted": {configurable:true,get:()=>displayHydrationRecoveryStarted,set:(value)=>{displayHydrationRecoveryStarted=value;}},
  "displayHydrationRecoveryRunning": {configurable:true,get:()=>displayHydrationRecoveryRunning,set:(value)=>{displayHydrationRecoveryRunning=value;}},
  "dashboardInitPromise": {configurable:true,get:()=>dashboardInitPromise},
},{globals:false});
