// LibreDisplay source section: /js/onboarding/index.js
{
const remoteApi=LibreDisplayRuntime.getModule('remote');
const {endpointAction,loadRemoteInfo}=remoteApi;
const configApi=LibreDisplayRuntime.getModule('config');
const {saveCfg}=configApi;
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;
const {mediaFoldersFromForm}=LibreDisplayRuntime.getModule('backgrounds');
const {uiCfg,fetchRemoteText,escHtml,esc,normalizeHexColor,resilientFetch}=LibreDisplayRuntime.getModule('shared');
const calendarApi=LibreDisplayRuntime.getModule('calendar');
const {normalizeCalendarUrl}=calendarApi;
const integrationsApi=LibreDisplayRuntime.getModule('integrations');
const appearanceApi=LibreDisplayRuntime.getModule('appearance');
const systemApi=LibreDisplayRuntime.getModule('system');
const performanceApi=LibreDisplayRuntime.getModule('performance');
const weatherApi=LibreDisplayRuntime.getModule('weather');

const STARTER_TEMPLATES={
 family:{uiTheme:'libre-night',fontFamily:'Inter',calendarDays:14,calendarColumns:7,calendarMaxEvents:5,leftPanelWidth:520,bottomPanelHeight:320,showDailyForecast:true,showHourlyForecast:true,bgShadeTop:58,bgShadeBottom:60},
 photo:{uiTheme:'libre-night',fontFamily:'Inter',calendarMaxEvents:3,leftPanelWidth:430,bottomPanelHeight:280,bgShadeTop:30,bgShadeBottom:38,textShadowPct:115,showDailyForecast:true,showHourlyForecast:false},
 minimal:{uiTheme:'libre-night',fontFamily:'Inter',calendarDays:7,calendarColumns:7,calendarMaxEvents:3,showSeconds:false,calendarLegend:false,showDailyForecast:false,showHourlyForecast:false,bgShadeTop:48,bgShadeBottom:50},
 weather:{uiTheme:'deep-ocean',fontFamily:'Noto Sans',dailyForecastDays:10,hourlyForecastHours:24,showDailyForecast:true,showHourlyForecast:true,bottomPanelHeight:390,forecastColumns:10,bgShadeTop:62,bgShadeBottom:65},
 portrait:{uiTheme:'libre-night',fontFamily:'Noto Sans',sidePaddingPx:18,leftPanelWidth:370,bottomPanelHeight:430,calendarDays:5,calendarColumns:1,calendarCellHeight:116,forecastColumns:4,dailyForecastDays:5,hourlyForecastHours:6},
 smarthome:{uiTheme:'graphite',fontFamily:'Inter',calendarDays:7,calendarColumns:7,calendarMaxEvents:3,leftPanelWidth:440,bottomPanelHeight:300,showDailyForecast:true,showHourlyForecast:false,bgShadeTop:70,bgShadeBottom:72},
  morning:{uiTheme:'libre-night',uiClockPct:125,uiCalendarPct:108,uiCurrentPct:108,uiForecastPct:102,calendarBandHeight:164,bottomPanelHeight:340,leftPanelWidth:500,sidePaddingPx:30,forecastRowGapPx:18,calendarDays:7,calendarColumns:7,showDailyForecast:true,showHourlyForecast:true,secondaryOpacity:92},
  metrics:{uiTheme:'graphite',uiClockPct:90,uiCalendarPct:90,uiCurrentPct:92,uiForecastPct:90,calendarBandHeight:132,bottomPanelHeight:300,leftPanelWidth:430,sidePaddingPx:20,forecastRowGapPx:12,calendarCellHeight:125,secondaryOpacity:90}
};
const STARTER_TEMPLATE_LAYOUTS={family:'family',photo:'gallery',minimal:'minimal',weather:'weather',portrait:'portrait',smarthome:'smarthub',morning:'morning',metrics:'insights'};
function applyStarterTemplate(key){
  const patch=STARTER_TEMPLATES[key];if(!patch)return;
  const current=appearanceFromForm(),preview=preservePresetState({...current,...JSON.parse(JSON.stringify(patch))},current);
  appearanceApi.settingsLayoutPresetKey=STARTER_TEMPLATE_LAYOUTS[key]||'default';
  setAppearanceForm(preview);previewAppearance();renderLayoutPresetGallery();markSettingsDirty();
  const el=document.getElementById('template-status');if(el)el.textContent=`Template preview active — ${appearanceApi.LAYOUT_PRESETS[appearanceApi.settingsLayoutPresetKey]?.name||'Balanced'} layout staged. Use Layout → Preview selected layout for a full-screen preview; Cancel/Esc restores your saved dashboard.`;
}

function currentWizardDisplayName(){
  return String(remoteApi.displayEndpoints.find(e=>e.id===bootstrapApi.ACTIVE_ENDPOINT)?.name||(bootstrapApi.ACTIVE_ENDPOINT==='main'?'Main display':bootstrapApi.ACTIVE_ENDPOINT));
}
function beginWizardSession(){
  configApi.wizardStepIndex=0;
  configApi.wizardDisplayNameDraft=currentWizardDisplayName();
  configApi.wizardDisplayNameTouched=false;
  configApi.wizardCreateBaseline=true;
  configApi.wizardBaselineCreated=false;
  configApi.wizardHealthRunning=false;
  configApi.wizardHealthRows=[];
  configApi.wizardHealthNotices=[];
  configApi.wizardRestorePointCount=null;
  configApi.wizardLastSaveResult=null;
}
function syncWizardDisplayNameFromEndpoints(){
  if(!configApi.isWizardMode||configApi.wizardDisplayNameTouched)return;
  configApi.wizardDisplayNameDraft=currentWizardDisplayName();
  if(configApi.WIZARD_STEPS[configApi.wizardStepIndex]?.key==='display')renderWizardStep();
}
function wizardPhysicalViewport(){
  const dpr=Math.max(1,Number(window.devicePixelRatio)||1),cssW=Math.max(Number(window.innerWidth)||0,Number(globalThis.screen?.width)||0),cssH=Math.max(Number(window.innerHeight)||0,Number(globalThis.screen?.height)||0);
  return {cssW,cssH,dpr,physicalW:Math.round(cssW*dpr),physicalH:Math.round(cssH*dpr)};
}
function wizardDisplayScale(){
  const v=wizardPhysicalViewport(),long=Math.max(v.physicalW,v.physicalH),short=Math.min(v.physicalW,v.physicalH);
  if(long>=3200&&short>=1700)return '4k';
  if(long>=2300&&short>=1250)return 'highres';
  return '1080';
}
function applyWizardDisplayScale(){
  const setup=document.getElementById('setup');if(!setup)return '1080';
  const scale=configApi.isWizardMode&&cfg.onboardingComplete!==true?wizardDisplayScale():'saved';
  setup.dataset.wizardDisplayScale=scale;
  if(configApi.isWizardMode&&cfg.onboardingComplete!==true){setup.dataset.firstRunResolution=scale;setup.setAttribute('data-first-run-auto-scale','true');}
  else{delete setup.dataset.firstRunResolution;setup.removeAttribute('data-first-run-auto-scale');}
  return scale;
}
function setWizardMode(on){
  const was=configApi.isWizardMode;
  configApi.isWizardMode=!!on;
  if(configApi.isWizardMode&&!was)beginWizardSession();
  const setup=document.getElementById('setup');setup?.classList.toggle('wizard-mode',configApi.isWizardMode);applyWizardDisplayScale();
  if(configApi.isWizardMode){configApi.wizardStepIndex=Math.max(0,Math.min(configApi.wizardStepIndex,configApi.WIZARD_STEPS.length-1));renderWizardStep();}
}
const WIZARD_PERFORMANCE_PRESETS={
  lightweight:{widget:false,overlay:false,seasonal:false,motionBg:false,preload:false},
  balanced:{widget:true,overlay:false,seasonal:false,motionBg:false,preload:true},
  immersive:{widget:true,overlay:true,seasonal:true,motionBg:true,preload:true}
};
function wizardPerformanceState(){return {widget:!!document.getElementById('s-weather-widget-animations')?.checked,overlay:!!document.getElementById('s-weather-fullscreen-effects')?.checked,seasonal:!!document.getElementById('s-weather-seasonal-effects')?.checked,motionBg:!!document.getElementById('s-background-motion')?.checked,preload:!!document.getElementById('s-photo-preload')?.checked};}
function wizardPerformanceProfile(){const state=wizardPerformanceState();for(const [name,preset] of Object.entries(WIZARD_PERFORMANCE_PRESETS))if(Object.keys(preset).every(k=>state[k]===preset[k]))return name;return 'custom';}
function syncWizardPerformanceMaster(){const widget=document.getElementById('s-weather-widget-animations')?.checked===true,overlay=document.getElementById('s-weather-fullscreen-effects')?.checked===true,master=document.getElementById('s-weather-animations');if(master)master.checked=widget||overlay;}
function applyWizardPerformancePreset(name){const preset=WIZARD_PERFORMANCE_PRESETS[name];if(!preset)return;const map={widget:'s-weather-widget-animations',overlay:'s-weather-fullscreen-effects',seasonal:'s-weather-seasonal-effects',motionBg:'s-background-motion',preload:'s-photo-preload'};for(const [key,id] of Object.entries(map)){const el=document.getElementById(id);if(el)el.checked=!!preset[key];}syncWizardPerformanceMaster();previewAppearance();markSettingsDirty();renderWizardExtra({key:'performance'});}
function wizardPerformanceFeatureChanged(){syncWizardPerformanceMaster();previewAppearance();markSettingsDirty();const badge=document.getElementById('wizard-performance-current');if(badge){const profile=wizardPerformanceProfile();badge.textContent=profile==='custom'?'Custom mix':profile[0].toUpperCase()+profile.slice(1);}}
function renderWizardSummary(){
  const el=document.getElementById('wizard-summary');if(!el)return;
  const city=pendingWeatherLocation?weatherLocationTitle(pendingWeatherLocation):((document.getElementById('s-city')?.value||'').trim()||'Not set');
  const calendars=readCalendarInputs().length;
  const bg=document.getElementById('s-bg-source')?.value||'google';
  const bgLabel=bg==='google'?'Google Photos':bg==='stock'?'Stock photos':bg==='folders'?'Local / NAS folders':'No photo background';
  const alerts=document.getElementById('s-alerts-enabled')?.checked?'Enabled':'Disabled';
  const unit=document.getElementById('s-unit')?.value==='C'?'Celsius':'Fahrenheit';
  const themeKey=document.querySelector('.theme-choice-card.selected')?.dataset.theme||cfg.uiTheme||'libre-night';
  const theme=appearanceApi.LIBREDISPLAY_THEMES[themeKey]?.name||'Libre Night';
  const remote=configApi.remoteInfo?.remoteEnabled?'Enabled for trusted private-network clients':'Disabled';
  const recovery=configApi.wizardCreateBaseline?'Create an Initial setup baseline':'Skip initial restore point';
  const performanceProfile=wizardPerformanceProfile(),performanceLabel=performanceProfile==='custom'?'Custom visual mix':performanceProfile[0].toUpperCase()+performanceProfile.slice(1);
  const display=(configApi.wizardDisplayNameDraft||currentWizardDisplayName()).trim()||currentWizardDisplayName();
  el.innerHTML=[['Display',display],['Location',city],['Calendars',calendars?`${calendars} connected`:'None yet'],['Background',bgLabel],['Visual performance',performanceLabel],['Weather',unit],['Alerts',alerts],['Theme',theme],['Remote editing',remote],['Recovery',recovery]]
    .map(([a,b])=>`<div class="wizard-summary-card"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('');
}
function wizardHealthCard(name,detail,state='warn'){
  return `<div class="wizard-health-card"><b>${escHtml(name)}<i class="wizard-health-dot ${escHtml(state)}" aria-hidden="true"></i></b><span>${escHtml(detail)}</span></div>`;
}
function buildWizardHealthRows(){
  const rows=[];
  rows.push({name:'Saved configuration',detail:configApi.serverConfigAvailable?'Saved to the LibreDisplay server':'Browser fallback is active; server persistence could not be confirmed',state:configApi.serverConfigAvailable?'good':'warn'});
  rows.push({name:'Weather',detail:weatherApi.weatherLastError?(configApi.wxData?'Live refresh failed; last good forecast retained':weatherApi.weatherLastError):(configApi.wxData?'Forecast loaded for the verified location':(cfg.lat&&cfg.lon?'Verified location saved; waiting for forecast data':'Location is not configured')),state:weatherApi.weatherLastError?(configApi.wxData?'warn':'bad'):(configApi.wxData?'good':(cfg.lat&&cfg.lon?'warn':'bad'))});
  const enabledCalendars=(cfg.calendars||[]).filter(c=>c.enabled!==false&&(c.url||c.configured));
  const calendarFailures=(calendarApi.calStatuses||[]).filter(x=>x&&!x.pending&&!x.disabled&&x.ok===false).length;
  rows.push({name:'Calendars',detail:enabledCalendars.length?(calendarFailures?`${calendarFailures} calendar source${calendarFailures===1?'':'s'} need attention`:`${enabledCalendars.length} enabled calendar${enabledCalendars.length===1?'':'s'} configured`):'No calendars configured — this is optional',state:calendarFailures?'bad':'good'});
  const bgReady=cfg.backgroundSource==='none'||cfg.backgroundSource==='stock'||(cfg.backgroundSource==='folders'&&!!cfg.mediaFolders?.length)||(cfg.backgroundSource==='google'&&!!cfg.photosUrl);
  rows.push({name:'Background',detail:bgReady?(cfg.backgroundSource==='none'?'Photo background disabled by choice':'Background source configured'):'Background source still needs setup',state:bgReady?'good':'warn'});
  rows.push({name:'Remote management',detail:configApi.remoteInfo?.remoteEnabled?'Enabled on the trusted private network':'Disabled — local-only management is valid',state:'good'});
  const recoveryReady=configApi.wizardBaselineCreated||(Number(configApi.wizardRestorePointCount)||0)>0;
  rows.push({name:'Recovery',detail:recoveryReady?`${configApi.wizardBaselineCreated?'Initial setup baseline created':configApi.wizardRestorePointCount+' local restore point'+(configApi.wizardRestorePointCount===1?'':'s')+' available'}`:(bootstrapApi.SESSION_ROLE==='owner'?'No local restore point yet':'Restore-point status requires Owner access'),state:recoveryReady?'good':'warn'});
  if(systemApi.systemHealthState?.ok){const freePct=Number(systemApi.systemHealthState.disk?.freePercent)||0;rows.push({name:'Host health',detail:`Data directory ${systemApi.systemHealthState.dataWritable?'writable':'not writable'}${freePct?` · ${freePct.toFixed(0)}% storage free`:''}`,state:systemApi.systemHealthState.dataWritable&&(freePct===0||freePct>=10)?'good':systemApi.systemHealthState.dataWritable?'warn':'bad'});}
  else rows.push({name:'Host health',detail:'System health is not available yet',state:'warn'});
  if(systemApi.softwareUpdateState?.ok)rows.push({name:'Software',detail:systemApi.softwareUpdateState.updateAvailable?`v${systemApi.softwareUpdateState.latestVersion} is available`:`Up to date · v${systemApi.softwareUpdateState.currentVersion||bootstrapApi.DASHBOARD_BUILD}`,state:systemApi.softwareUpdateState.updateAvailable?'warn':'good'});
  else rows.push({name:'Software',detail:'GitHub release check unavailable or still pending',state:'warn'});
  return rows;
}
function renderWizardHealth(){
  const extra=document.getElementById('wizard-extra');if(!extra)return;
  const rows=configApi.wizardHealthRows.length?configApi.wizardHealthRows:buildWizardHealthRows();
  extra.innerHTML=`<div class="wizard-health-grid">${rows.map(r=>wizardHealthCard(r.name,r.detail,r.state)).join('')}</div><div class="wizard-health-actions"><button class="btn-util" type="button" data-ld-action-click="onboarding.runWizardHealthChecks" ${configApi.wizardHealthRunning?'disabled':''}>${configApi.wizardHealthRunning?'Checking…':'Run checks again'}</button><span class="wizard-health-status">${configApi.wizardHealthRunning?'Testing live data sources and local health. This can take a few seconds.':'Warnings are informational; optional features can stay disabled.'}</span></div>`;
}
function renderWizardExtra(step){
  const extra=document.getElementById('wizard-extra');if(!extra)return;
  extra.className='wizard-extra'+(step.key==='welcome'?' welcome':'');
  if(step.key==='welcome'){
    extra.innerHTML='<div class="wizard-feature-grid"><div><b>Guided, not separate</b><span>The wizard uses LibreDisplay’s real Settings controls, so there is no hidden second configuration path.</span></div><div><b>Exact location</b><span>Weather setup requires choosing the exact region, country, coordinates, and timezone before saving.</span></div><div><b>Recoverable</b><span>Optionally create a local baseline restore point immediately after first setup.</span></div></div>';
  }else if(step.key==='display'){
    if(bootstrapApi.SESSION_ROLE!=='owner')extra.innerHTML='<div class="wizard-inline-note">Display naming requires Owner access. You can continue with the existing name.</div>';
    else{
      extra.innerHTML=`<div class="wizard-form-card"><div class="s-row"><label for="wizard-display-name">Display name</label><input id="wizard-display-name" type="text" maxlength="80" value="${escHtml(configApi.wizardDisplayNameDraft||currentWizardDisplayName())}" placeholder="Living Room, Kitchen, Office…"></div><div class="wizard-inline-note">This is the friendly name shown in multi-display management. The internal endpoint ID remains unchanged.</div></div>`;
      const input=document.getElementById('wizard-display-name');input?.addEventListener('input',()=>{configApi.wizardDisplayNameDraft=input.value;configApi.wizardDisplayNameTouched=true;});
    }
  }else if(step.key==='performance'){
    const caps=performanceApi.frontendCapabilities(),profile=wizardPerformanceProfile(),hardware=caps.cores||caps.memoryGB?`${caps.cores?caps.cores+' CPU threads':'CPU unknown'}${caps.memoryGB?` · about ${caps.memoryGB} GB browser memory hint`:''}`:'Browser hardware details unavailable',recommendation=caps.constrained?'Lightweight is strongly recommended on this device.':'Lightweight is the safest default; Balanced is a reasonable next step if the dashboard stays responsive.';
    const state=wizardPerformanceState();
    extra.innerHTML=`<div class="wizard-performance-intro"><b>Safe by default</b><span>${escHtml(hardware)} · ${escHtml(recommendation)}</span><span>Fullscreen weather, seasonal wildlife and continuously decoded moving backgrounds can be demanding on Pi 3-class and other lower-powered devices. You can change these later at any time.</span></div><div class="wizard-performance-presets"><button type="button" class="wizard-performance-card ${profile==='lightweight'?'selected':''}" data-wizard-profile="lightweight"><b>Lightweight</b><span>Static weather icons, no fullscreen atmosphere, no seasonal particles, still backgrounds only, no preload.</span><em>Recommended for Pi 3 / low-end devices</em></button><button type="button" class="wizard-performance-card ${profile==='balanced'?'selected':''}" data-wizard-profile="balanced"><b>Balanced</b><span>Animated weather icons and smoother photo transitions without the fullscreen overlay or moving backgrounds.</span><em>Moderate load</em></button><button type="button" class="wizard-performance-card ${profile==='immersive'?'selected':''}" data-wizard-profile="immersive"><b>Immersive</b><span>Fullscreen weather, seasonal atmosphere, moving/video backgrounds and preload enabled.</span><em>High load · faster hardware recommended</em></button></div><div class="wizard-performance-current">Current selection: <b id="wizard-performance-current">${profile==='custom'?'Custom mix':profile[0].toUpperCase()+profile.slice(1)}</b></div><div class="wizard-feature-options"><label class="wizard-feature-option"><input id="wizard-perf-widget" type="checkbox" ${state.widget?'checked':''}><span><b>Animated weather icons</b><small>Low–moderate load. Adds motion to current and forecast weather glyphs.</small></span><em>LOW</em></label><label class="wizard-feature-option"><input id="wizard-perf-overlay" type="checkbox" ${state.overlay?'checked':''}><span><b>Fullscreen weather atmosphere</b><small>Rain, snow, fog, storms and particles cover the display. This is one of the heaviest visual features, especially during dense precipitation.</small></span><em>HIGH</em></label><label class="wizard-feature-option"><input id="wizard-perf-seasonal" type="checkbox" ${state.seasonal?'checked':''}><span><b>Seasonal wildlife &amp; atmosphere</b><small>Adds leaves, grass, petals, insects, fireflies, birds, crystals and frost when appropriate. Most noticeable with fullscreen effects enabled.</small></span><em>HIGH</em></label><label class="wizard-feature-option"><input id="wizard-perf-motion-bg" type="checkbox" ${state.motionBg?'checked':''}><span><b>Animated / video backgrounds</b><small>Allows animated GIF, video and Motion JPEG media from local/NAS folders. Continuous decoding can be expensive on older Raspberry Pi hardware.</small></span><em>HIGH</em></label><label class="wizard-feature-option"><input id="wizard-perf-preload" type="checkbox" ${state.preload?'checked':''}><span><b>Preload next background</b><small>Smoother transitions, but uses extra memory and network bandwidth to prepare the next item ahead of time.</small></span><em>MED</em></label></div>`;
    extra.querySelectorAll('[data-wizard-profile]').forEach(btn=>btn.addEventListener('click',()=>applyWizardPerformancePreset(btn.dataset.wizardProfile)));
    const featureMap={'wizard-perf-widget':'s-weather-widget-animations','wizard-perf-overlay':'s-weather-fullscreen-effects','wizard-perf-seasonal':'s-weather-seasonal-effects','wizard-perf-motion-bg':'s-background-motion','wizard-perf-preload':'s-photo-preload'};
    for(const [from,to] of Object.entries(featureMap)){document.getElementById(from)?.addEventListener('change',e=>{const target=document.getElementById(to);if(target)target.checked=!!e.currentTarget.checked;wizardPerformanceFeatureChanged();});}
  }else if(step.key==='remote'){
    extra.innerHTML='<div class="wizard-inline-note">Remote editing is optional. Keep it disabled for a local-only installation, or enable it only on a trusted LAN/private VPN. Never port-forward LibreDisplay directly to the public internet.</div>';
  }else if(step.key==='backup'){
    extra.innerHTML=`<div class="wizard-form-card"><label class="checkline"><input id="wizard-create-baseline" type="checkbox" ${configApi.wizardCreateBaseline?'checked':''}> Create a private “Initial setup baseline” restore point after saving</label><div class="wizard-inline-note">Recommended. This captures the saved display configuration plus Profiles and Scenes after setup. Full .ldbackup files remain the option for media, plugins, environment secrets, and host/NAS state.</div></div>`;
    const input=document.getElementById('wizard-create-baseline');input?.addEventListener('change',()=>{configApi.wizardCreateBaseline=!!input.checked;});
  }else if(step.key==='health')renderWizardHealth();
  else extra.innerHTML='';
}
function renderWizardStep(){
  if(!configApi.isWizardMode)return;
  const step=configApi.WIZARD_STEPS[configApi.wizardStepIndex];
  document.querySelectorAll('.s-section[data-settings-tab]').forEach(el=>el.classList.remove('tab-active'));
  for(const id of step.sections){const section=document.getElementById(id);section?.classList.add('tab-active');section?.classList.remove('section-collapsed');section?.querySelector(':scope > h3')?.setAttribute('aria-expanded','true');}
  const summary=document.getElementById('wizard-summary');summary?.classList.toggle('visible',step.key==='review');
  if(step.key==='review')renderWizardSummary();
  renderWizardExtra(step);
  const label=document.getElementById('wizard-step-label'),modeLabel=document.getElementById('wizard-mode-label'),bar=document.getElementById('wizard-progress-bar'),title=document.getElementById('wizard-title'),desc=document.getElementById('wizard-desc');
  if(label)label.textContent=`Step ${configApi.wizardStepIndex+1} of ${configApi.WIZARD_STEPS.length}`;
  if(modeLabel)modeLabel.textContent=cfg.onboardingComplete?'Guided setup':'First-run setup';
  if(bar)bar.style.width=`${((configApi.wizardStepIndex+1)/configApi.WIZARD_STEPS.length)*100}%`;
  if(title)title.textContent=step.title;if(desc)desc.textContent=step.desc;
  const back=document.getElementById('wizard-back'),skip=document.getElementById('wizard-skip'),next=document.getElementById('wizard-next');
  if(back)back.disabled=configApi.wizardStepIndex===0||step.key==='health';
  if(skip)skip.style.display=step.skippable?'':'none';
  if(next){next.disabled=configApi.wizardHealthRunning;next.textContent=step.key==='review'?'Save & run checks':step.key==='health'?'Open dashboard':step.key==='welcome'?'Start setup':'Next';}
  updateBackgroundSourceUI();
  const box=document.querySelector('.setup-box');if(box)box.scrollTop=0;
}
async function wizardCommitDisplayName(){
  if(bootstrapApi.SESSION_ROLE!=='owner')return {ok:true,skipped:true};
  const name=String(configApi.wizardDisplayNameDraft||'').trim().slice(0,80);
  if(!name)return {ok:true,skipped:true};
  const current=currentWizardDisplayName();if(name===current)return {ok:true,skipped:true};
  try{await endpointAction({action:'rename',id:bootstrapApi.ACTIVE_ENDPOINT,name});const row=remoteApi.displayEndpoints.find(e=>e.id===bootstrapApi.ACTIVE_ENDPOINT);if(row)row.name=name;configApi.wizardDisplayNameDraft=name;return {ok:true};}catch(e){return {ok:false,error:String(e?.message||e)};}
}
async function wizardCreateSetupBaseline(){
  if(!configApi.wizardCreateBaseline||bootstrapApi.SESSION_ROLE!=='owner')return {ok:true,skipped:true};
  try{const res=await resilientFetch('/api/restore-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',endpoint:bootstrapApi.ACTIVE_ENDPOINT,label:'Initial setup baseline'}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);configApi.wizardBaselineCreated=true;configApi.wizardRestorePointCount=Array.isArray(data.points)?data.points.length:configApi.wizardRestorePointCount;return {ok:true};}catch(e){return {ok:false,error:String(e?.message||e)};}
}
async function wizardLoadRestorePointCount(){
  if(bootstrapApi.SESSION_ROLE!=='owner'){configApi.wizardRestorePointCount=null;return;}
  try{const res=await resilientFetch('/api/restore-points',{cache:'no-store'}),data=await res.json().catch(()=>({}));if(res.ok&&data.ok)configApi.wizardRestorePointCount=Array.isArray(data.points)?data.points.length:0;}catch(e){}
}
async function runWizardHealthChecks(){
  if(configApi.wizardHealthRunning)return;configApi.wizardHealthRunning=true;configApi.wizardHealthRows=[...configApi.wizardHealthNotices];renderWizardHealth();
  const jobs=[loadRemoteInfo(),loadSystemHealth(),checkSoftwareUpdate(false),refreshProviderHealth(true),wizardLoadRestorePointCount()];
  await Promise.allSettled(jobs);
  configApi.wizardHealthRows=[...configApi.wizardHealthNotices,...buildWizardHealthRows()];configApi.wizardHealthRunning=false;renderWizardStep();
}
async function wizardSaveAndRunChecks(){
  const next=document.getElementById('wizard-next');if(next)next.disabled=true;
  const saveResult=await saveSetup({closeAfter:false});
  if(!saveResult?.ok){if(next)next.disabled=false;return;}
  configApi.wizardLastSaveResult=saveResult;
  const rename=await wizardCommitDisplayName();
  const baseline=await wizardCreateSetupBaseline();
  configApi.wizardStepIndex=configApi.WIZARD_STEPS.findIndex(x=>x.key==='health');
  configApi.wizardHealthRows=[];configApi.wizardHealthNotices=[];
  if(!rename.ok)configApi.wizardHealthNotices.push({name:'Display name',detail:`Saved dashboard, but the display name could not be updated: ${rename.error}`,state:'warn'});
  if(!baseline.ok)configApi.wizardHealthNotices.push({name:'Recovery',detail:`Saved dashboard, but the initial restore point could not be created: ${baseline.error}`,state:'warn'});
  renderWizardStep();
  await runWizardHealthChecks();
}
function wizardBack(){if(configApi.wizardStepIndex>0&&configApi.WIZARD_STEPS[configApi.wizardStepIndex]?.key!=='health'){configApi.wizardStepIndex--;renderWizardStep();}}
function wizardSkip(){if(configApi.wizardStepIndex<configApi.WIZARD_STEPS.length-1){configApi.wizardStepIndex++;renderWizardStep();}}
async function wizardNext(){
  const step=configApi.WIZARD_STEPS[configApi.wizardStepIndex];
  if(step.key==='location'){
    const q=String(document.getElementById('s-city')?.value||'').trim();
    if(!q){alert('Enter a city or place before continuing.');document.getElementById('s-city')?.focus();return;}
    if(!pendingWeatherLocation){alert('Use Find places and choose the exact city/region/country match before continuing.');document.getElementById('s-city')?.focus();return;}
  }
  if(step.key==='review'){await wizardSaveAndRunChecks();return;}
  if(step.key==='health'){closeSetup(false);applySettings();return;}
  configApi.wizardStepIndex++;renderWizardStep();
}
function openFullSettingsFromWizard(){setWizardMode(false);switchSettingsTab('overview',false);}
function startWizardFromSettings(){setWizardMode(true);}

function newCalendarId(){return 'cal-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);}
function calendarRowsFromDom(){
  const rows=[];
  document.querySelectorAll('#calendar-source-list .cal-entry[data-calendar-id]').forEach((entry,i)=>{
    const id=entry.dataset.calendarId||newCalendarId();
    const picker=entry.querySelector('[data-field="color"]');
    const hex=entry.querySelector('[data-field="hex"]');
    const color=normalizeHexColor(hex?.value,picker?.value||integrationsApi.DEFAULT_CAL_COLORS[i%integrationsApi.DEFAULT_CAL_COLORS.length]);
    rows.push({id,url:normalizeCalendarUrl(entry.querySelector('[data-field="url"]')?.value||''),label:(entry.querySelector('[data-field="name"]')?.value||'').trim()||`Calendar ${i+1}`,enabled:entry.querySelector('[data-field="enabled"]')?.checked!==false,opacity:Math.min(100,Math.max(40,Number(entry.querySelector('[data-field="opacity"]')?.value)||100)),color});
  });
  return rows;
}
function readCalendarInputs(){return calendarRowsFromDom().filter(c=>c.url||c.configured);}
function syncCalendarEditorRows(){
  const list=document.getElementById('calendar-source-list');
  if(list&&list.children.length)configApi.calendarEditorRows=calendarRowsFromDom();
  return configApi.calendarEditorRows;
}
function calendarCardHtml(c,i){
  const color=normalizeHexColor(c.color,integrationsApi.DEFAULT_CAL_COLORS[i%integrationsApi.DEFAULT_CAL_COLORS.length]);
  const name=escHtml(c.label||`Calendar ${i+1}`),url=escHtml(c.url||''),id=escHtml(c.id||newCalendarId());
  return `<div class="cal-entry calendar-source-card" data-calendar-id="${id}"><div class="calendar-source-head"><div class="calendar-source-title">${name}</div><div class="calendar-source-actions"><button class="cal-mini-btn" type="button" data-ld-action-click="settings.testSingleCalendarSource" data-ld-action-args="${escHtml(JSON.stringify([id]))}">Check</button><button class="cal-mini-btn" type="button" data-ld-action-click="onboarding.duplicateCalendarSource" data-ld-action-args="${escHtml(JSON.stringify([id]))}">Duplicate</button><button class="cal-mini-btn" type="button" data-ld-action-click="onboarding.removeCalendarSource" data-ld-action-args="${escHtml(JSON.stringify([id]))}">Remove</button></div></div><div class="cal-meta-row"><input data-field="enabled" class="cal-enabled" type="checkbox" ${c.enabled!==false?'checked':''} title="Enable this calendar"><input data-field="name" class="cal-name" type="text" placeholder="Name (e.g. Family)" value="${name}"><input data-field="color" type="color" value="${color}" title="Calendar color"><input data-field="hex" class="color-hex" type="text" maxlength="7" value="${color.toUpperCase()}" spellcheck="false" aria-label="Calendar hex color"><select data-field="opacity" class="cal-opacity" title="Calendar opacity"><option value="100">100%</option><option value="85">85%</option><option value="70">70%</option><option value="55">55%</option><option value="40">40%</option></select></div><div class="cal-input-row"><input data-field="url" type="text" placeholder="https://…/calendar.ics or imported file" value="${url}"></div></div>`;
}
function bindCalendarCard(entry,row){
  const picker=entry.querySelector('[data-field="color"]'),hex=entry.querySelector('[data-field="hex"]'),opacity=entry.querySelector('[data-field="opacity"]');
  if(opacity)opacity.value=String(row.opacity??100);
  picker?.addEventListener('input',()=>{if(hex)hex.value=picker.value.toUpperCase();renderCalendarOrderList();markSettingsDirty();});
  hex?.addEventListener('input',()=>{let v=String(hex.value||'').trim();if(v&&!v.startsWith('#'))v='#'+v;if(/^#[0-9a-f]{6}$/i.test(v)&&picker)picker.value=v.toLowerCase();});
  hex?.addEventListener('blur',()=>{const c=normalizeHexColor(hex.value,picker?.value);if(picker)picker.value=c;hex.value=c.toUpperCase();renderCalendarOrderList();markSettingsDirty();});
  entry.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',()=>{syncCalendarEditorRows();renderCalendarOrderList();markSettingsDirty();}));
}
function renderCalendarSourceList(rows=configApi.calendarEditorRows){
  const list=document.getElementById('calendar-source-list');if(!list)return;
  configApi.calendarEditorRows=(rows||[]).map((c,i)=>({...c,id:c.id||newCalendarId(),color:normalizeHexColor(c.color,integrationsApi.DEFAULT_CAL_COLORS[i%integrationsApi.DEFAULT_CAL_COLORS.length])}));
  list.innerHTML=configApi.calendarEditorRows.length?configApi.calendarEditorRows.map(calendarCardHtml).join(''):'<div class="settings-note" style="padding:10px 2px;">No calendars added yet. Choose “Add calendar” or import an .ics file.</div>';
  [...list.querySelectorAll('.cal-entry')].forEach((entry,i)=>bindCalendarCard(entry,configApi.calendarEditorRows[i]));
  renderCalendarOrderList();
}
function addCalendarSource(seed={}){
  syncCalendarEditorRows();
  const i=configApi.calendarEditorRows.length;
  configApi.calendarEditorRows.push({id:newCalendarId(),url:'',label:seed.label||`Calendar ${i+1}`,enabled:true,opacity:100,color:seed.color||integrationsApi.DEFAULT_CAL_COLORS[i%integrationsApi.DEFAULT_CAL_COLORS.length],...seed});
  renderCalendarSourceList(configApi.calendarEditorRows);markSettingsDirty();
  document.querySelector('#calendar-source-list .cal-entry:last-child [data-field="url"]')?.focus();
}
function removeCalendarSource(id){
  syncCalendarEditorRows();
  const row=configApi.calendarEditorRows.find(c=>c.id===id);if(!row)return;
  if((row.url||'').trim()&&!confirm(`Remove “${row.label||'Calendar'}” from this display?`))return;
  configApi.calendarEditorRows=configApi.calendarEditorRows.filter(c=>c.id!==id);renderCalendarSourceList(configApi.calendarEditorRows);markSettingsDirty();
}
function duplicateCalendarSource(id){
  syncCalendarEditorRows();const row=configApi.calendarEditorRows.find(c=>c.id===id);if(!row)return;
  const copy={...row,id:newCalendarId(),label:(row.label||'Calendar')+' Copy'};configApi.calendarEditorRows.push(copy);renderCalendarSourceList(configApi.calendarEditorRows);markSettingsDirty();
}
async function importCalendarFile(input){
  const files=[...(input?.files||[])];if(!files.length)return;
  const status=document.getElementById('cal-status');let imported=0,failed=[];
  for(const file of files){
    try{
      const content=await file.text();
      const res=await resilientFetch(serverPath('/api/calendar-file'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,content}),cache:'no-store'});
      const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
      addCalendarSource({label:file.name.replace(/\.ics$/i,'')||'Imported calendar',url:data.url});imported++;
    }catch(e){failed.push(`${file.name}: ${e.message||e}`);}
  }
  if(status){status.style.display='block';status.innerHTML=failed.length?`${imported} imported. <span style="color:#fca5a5">${failed.map(esc).join('<br>')}</span>`:`Imported ${imported} calendar file${imported===1?'':'s'}. Save & Apply to keep them on this display.`;}
  input.value='';
}
function calendarOrderIds(){
  const rows=(document.getElementById('calendar-source-list')?.children.length?calendarRowsFromDom():cfg.calendars||[]);
  const ids=rows.map(c=>c.id).filter(Boolean);
  const existing=(cfg.calendarOrder||[]).filter(id=>ids.includes(id));
  for(const id of ids)if(!existing.includes(id))existing.push(id);
  return existing;
}
function calendarPriority(calIdx){const id=cfg.calendars?.[calIdx]?.id;const n=calendarOrderIds().indexOf(id);return n<0?99:n;}
function readCalendarOrder(){const list=document.getElementById('calendar-order-list');if(!list)return calendarOrderIds();return [...list.querySelectorAll('[data-calendar-id]')].map(x=>x.dataset.calendarId);}
function renderCalendarOrderList(){
  const list=document.getElementById('calendar-order-list');if(!list)return;
  const rows=(document.getElementById('calendar-source-list')?.querySelector('.cal-entry')?calendarRowsFromDom():cfg.calendars||[]).filter(c=>c.url||c.configured);
  const byId=new Map(rows.map(c=>[c.id,c])),order=calendarOrderIds();
  list.innerHTML=order.map(id=>{const c=byId.get(id);if(!c)return '';return `<div class="calendar-order-item" data-calendar-id="${escHtml(id)}"><span class="calendar-order-dot" style="background:${normalizeHexColor(c.color,'#4ade80')}"></span><span>${esc(c.label||'Calendar')}</span><span class="calendar-order-actions"><button type="button" data-ld-action-click="onboarding.moveCalendarOrder" data-ld-action-args="${escHtml(JSON.stringify([id,-1]))}">↑</button><button type="button" data-ld-action-click="onboarding.moveCalendarOrder" data-ld-action-args="${escHtml(JSON.stringify([id,1]))}">↓</button></span></div>`;}).join('')||'<div class="settings-note">Add a calendar to manage display priority.</div>';
}
function moveCalendarOrder(id,delta){const list=document.getElementById('calendar-order-list');if(!list)return;const items=[...list.querySelectorAll('[data-calendar-id]')];const i=items.findIndex(x=>x.dataset.calendarId===id),j=i+delta;if(i<0||j<0||j>=items.length)return;if(delta<0)list.insertBefore(items[i],items[j]);else list.insertBefore(items[j],items[i]);markSettingsDirty();}
function renderCalendarLegend(){
  const el=document.getElementById('calendar-legend');if(!el)return;const ui=uiCfg();if(!ui.calendarLegend){el.classList.remove('show');el.innerHTML='';return;}
  const order=calendarOrderIds();const rows=(cfg.calendars||[]).filter(c=>(c.url||c.configured)&&c.enabled!==false).sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
  el.innerHTML=rows.map((c,i)=>`<span class="calendar-legend-item" style="opacity:${(Math.min(100,Math.max(40,Number(c.opacity)||100))/100).toFixed(2)}"><span class="calendar-legend-dot" style="background:${c.color||integrationsApi.DEFAULT_CAL_COLORS[i%integrationsApi.DEFAULT_CAL_COLORS.length]}"></span>${esc(c.label||'Calendar')}</span>`).join('');el.classList.toggle('show',rows.length>0);
}
function bindCalendarColorControls(){renderCalendarSourceList(configApi.calendarEditorRows.length?configApi.calendarEditorRows:cfg.calendars||[]);}
function bindCalendarUxInputs(){}
function updateCalendarEntryVisibility(){}
function toggleEmptyCalendarSlots(){}

let pendingWeatherLocation=null;
let weatherLocationSearchResults=[];
function normalizeWeatherLocationResult(raw){
  if(!raw||typeof raw!=='object')return null;
  const latitude=Number(raw.latitude),longitude=Number(raw.longitude);if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)return null;
  return {id:Number.isFinite(Number(raw.id))?Number(raw.id):null,name:String(raw.name||'').trim(),admin1:String(raw.admin1||'').trim(),admin2:String(raw.admin2||'').trim(),country:String(raw.country||'').trim(),countryCode:String(raw.country_code||raw.countryCode||'').trim().toUpperCase(),timezone:String(raw.timezone||'').trim(),latitude,longitude};
}
function savedWeatherLocation(){
  if(!Number.isFinite(Number(cfg.lat))||!Number.isFinite(Number(cfg.lon)))return null;
  return normalizeWeatherLocationResult({id:cfg.locationGeocodeId,name:cfg.city||'Saved location',admin1:cfg.locationAdmin1,country:cfg.locationCountry,country_code:cfg.locationCountryCode,timezone:cfg.locationTimezone,latitude:cfg.lat,longitude:cfg.lon});
}
function weatherLocationTitle(loc){return [loc?.name,loc?.admin1,loc?.country].map(x=>String(x||'').trim()).filter((x,i,a)=>x&&a.indexOf(x)===i).join(', ');}
function weatherLocationSearchText(loc){return weatherLocationTitle(loc)||String(loc?.name||'').trim();}
function renderWeatherLocationSelected(loc=pendingWeatherLocation){
  const host=document.getElementById('weather-location-selected');if(!host)return;
  if(!loc){host.classList.remove('verified');host.innerHTML='<b>No exact location selected</b><span>Search above and choose the matching city/region before saving a changed location.</span>';return;}
  host.classList.add('verified');const title=weatherLocationTitle(loc)||'Saved coordinates';
  const meta=[loc.timezone?`Timezone ${loc.timezone}`:'',`Selected ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`].filter(Boolean);
  if(weatherApi.weatherLastGridPoint&&Number.isFinite(weatherApi.weatherLastGridPoint.latitude)&&Number.isFinite(weatherApi.weatherLastGridPoint.longitude))meta.push(`Forecast grid ${weatherApi.weatherLastGridPoint.latitude.toFixed(4)}, ${weatherApi.weatherLastGridPoint.longitude.toFixed(4)}`);
  host.innerHTML=`<b>✓ ${escHtml(title)}</b><span>${escHtml(meta.join(' · '))}</span>`;
}
function weatherLocationQueryChanged(){
  const q=String(document.getElementById('s-city')?.value||'').trim(),saved=savedWeatherLocation();
  if(saved&&[weatherLocationSearchText(saved),saved.name,String(cfg.city||'')].some(x=>x&&x.toLowerCase()===q.toLowerCase()))pendingWeatherLocation=saved;else pendingWeatherLocation=null;
  document.getElementById('weather-location-results')?.replaceChildren();
  const status=document.getElementById('weather-location-search-status');if(status)status.textContent=pendingWeatherLocation?'Using the currently saved coordinates.':'Search and choose an exact match before saving this location.';
  renderWeatherLocationSelected();
}
function selectWeatherLocationResult(index){
  const loc=weatherLocationSearchResults[Number(index)];if(!loc)return;
  pendingWeatherLocation={...loc};const input=document.getElementById('s-city');if(input)input.value=weatherLocationSearchText(loc);
  document.getElementById('weather-location-results')?.replaceChildren();const status=document.getElementById('weather-location-search-status');if(status)status.textContent='Exact location selected. Save & Apply to use these coordinates.';
  renderWeatherLocationSelected(loc);markSettingsDirty();
}
async function searchWeatherLocations(){
  const q=String(document.getElementById('s-city')?.value||'').trim(),status=document.getElementById('weather-location-search-status'),host=document.getElementById('weather-location-results');
  if(q.length<2){if(status)status.textContent='Enter at least 2 characters.';return;}
  if(status)status.textContent='Searching places…';if(host)host.innerHTML='';weatherLocationSearchResults=[];
  try{
    const geo=JSON.parse(await fetchRemoteText(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en`,3600));
    weatherLocationSearchResults=(geo.results||[]).map(normalizeWeatherLocationResult).filter(Boolean);
    if(!weatherLocationSearchResults.length){if(status)status.textContent='No matching places found. Try adding a state/region or country.';return;}
    if(status)status.textContent=`${weatherLocationSearchResults.length} match${weatherLocationSearchResults.length===1?'':'es'} found — choose the exact place.`;
    if(host)host.innerHTML=weatherLocationSearchResults.map((loc,i)=>{const title=weatherLocationTitle(loc),sub=[loc.admin2&&!title.includes(loc.admin2)?loc.admin2:'',loc.timezone].filter(Boolean).join(' · ');return `<button class="weather-location-result" type="button" data-ld-action-click="onboarding.selectWeatherLocationResult" data-ld-action-args="${escHtml(JSON.stringify([i]))}"><span><b>${escHtml(title||loc.name||'Location')}</b><span>${escHtml(sub||'Choose this location')}</span></span><code>${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}</code></button>`;}).join('');
  }catch(e){if(status)status.textContent='Location search failed. Check the network connection and try again.';}
}
function previewWeatherLocationLabel(){
  const el=document.getElementById('wx-location');if(!el)return;const value=String(document.getElementById('s-locname')?.value||'').trim();el.textContent=value;el.classList.toggle('show',!!value);scheduleBuiltInLayoutAutoFit?.();
}

async function saveSetup(options={}){
  const city=document.getElementById('s-city').value.trim();
  if(!city){alert('Enter a city name');return;}
  const requestedLabel=document.getElementById('s-locname').value.trim();
  let selected=pendingWeatherLocation;
  if(!selected){
    const saved=savedWeatherLocation();
    if(saved&&[weatherLocationSearchText(saved),saved.name,String(cfg.city||'')].some(x=>x&&x.toLowerCase()===city.toLowerCase()))selected=saved;
  }
  if(!selected){alert('Search for the location and choose the exact city/region/country match before saving.');document.getElementById('s-city')?.focus();return;}
  cfg.lat=selected.latitude;cfg.lon=selected.longitude;cfg.city=selected.name||city;cfg.locName=requestedLabel;
  cfg.locationAdmin1=selected.admin1||'';cfg.locationCountry=selected.country||'';cfg.locationCountryCode=selected.countryCode||'';cfg.locationTimezone=selected.timezone||'';cfg.locationGeocodeId=selected.id;

  cfg.calendars=readCalendarInputs();
  cfg.backgroundSource=document.getElementById('s-bg-source')?.value||'google';
  cfg.stockCategory=document.getElementById('s-stock-category')?.value||'nature';
  cfg.stockQuery=(document.getElementById('s-stock-query')?.value||'').trim().slice(0,80);
  cfg.stockResolution=document.getElementById('s-stock-resolution')?.value||'3840x2160';
  cfg.photosUrl=document.getElementById('s-photos').value.trim();
  cfg.mediaFolders=mediaFoldersFromForm();
  cfg.mediaRecursive=document.getElementById('s-media-recursive')?.checked!==false;
  cfg.backgroundMotionEnabled=!!document.getElementById('s-background-motion')?.checked;
  cfg.useFahrenheit=document.getElementById('s-unit').value==='F';
  cfg.photoIntervalSec=Math.max(0,Number(document.getElementById('s-photo-interval').value)||0);
  cfg.photoOrder=document.getElementById('s-photo-order').value;
  cfg.photoRandomStart=!!document.getElementById('s-photo-random-start').checked;
  cfg.photoPreload=!!document.getElementById('s-photo-preload').checked;
  cfg.backgroundOfflineCacheMaxMb=Math.max(0,Math.min(384,Number(document.getElementById('s-bg-offline-reserve')?.value)||0));
  cfg.backgroundOfflineCacheEnabled=cfg.backgroundOfflineCacheMaxMb>0;
  cfg.backgroundOfflineCacheCount=cfg.backgroundOfflineCacheEnabled?Math.min(256,Math.ceil(cfg.backgroundOfflineCacheMaxMb/1.5)):0;
  cfg.backgroundStartupPriority=document.getElementById('s-bg-startup-priority')?.checked!==false;
  cfg.backgroundStartupDelayMs=Math.max(0,Math.min(3000,Number(document.getElementById('s-bg-startup-delay')?.value)||0));
  cfg.weatherRefreshMin=Math.max(1,Number(document.getElementById('s-weather-refresh').value)||10);
  cfg.calendarRefreshMin=Math.max(1,Number(document.getElementById('s-calendar-refresh').value)||15);
  cfg.calendarTimeStyle=document.getElementById('s-calendar-time-style')?.value||'start';
  cfg.calendarLegend=!!document.getElementById('s-calendar-legend')?.checked;
  cfg.calendarShowContinuation=!!document.getElementById('s-calendar-show-continuation')?.checked;
  cfg.calendarOrder=readCalendarOrder();
  cfg.alertsEnabled=!!document.getElementById('s-alerts-enabled').checked;
  cfg.alertTestMode=!!document.getElementById('s-alert-test').checked;
  cfg.alertCardPct=Math.min(33,Math.max(25,Number(document.getElementById('s-alert-size').value)||29));
  cfg.alertMotionMode=document.getElementById('s-alert-motion').value;
  cfg.alertMotionPx=Math.min(120,Math.max(4,Number(document.getElementById('s-alert-motion-speed').value)||36));
  cfg.alertScrollSec=Math.min(60,Math.max(3,Number(document.getElementById('s-alert-scroll').value)||8));
  cfg.alertRefreshMin=Math.min(30,Math.max(3,Number(document.getElementById('s-alert-refresh').value)||5));
  configApi.alertRuntimeState=null;
  Object.assign(cfg,appearanceFromForm());
  if(appearanceApi.settingsLayoutPresetKey!=='current'){
    applyLayoutPresetToSource(cfg,appearanceApi.settingsLayoutPresetKey,{commit:true});
    appearanceApi.settingsLayoutPresetKey='current';
  }
  cfg.onboardingComplete=true;
  const persistence=await saveCfg();
  markSettingsClean();
  if(options?.closeAfter!==false)closeSetup(false);
  applySettings();
  return {ok:true,persistence};
}


// Preserve the compatibility bridge for legacy bare-identifier callers.
window.addEventListener('resize',()=>{if(configApi.isWizardMode)applyWizardDisplayScale();});
LibreDisplayRuntime.exposeModule("onboarding", {applyStarterTemplate,wizardPerformanceState,wizardPerformanceProfile,applyWizardPerformancePreset,wizardPerformanceFeatureChanged,currentWizardDisplayName,beginWizardSession,syncWizardDisplayNameFromEndpoints,wizardPhysicalViewport,wizardDisplayScale,applyWizardDisplayScale,setWizardMode,renderWizardSummary,wizardHealthCard,buildWizardHealthRows,renderWizardHealth,renderWizardExtra,renderWizardStep,wizardCommitDisplayName,wizardCreateSetupBaseline,wizardLoadRestorePointCount,runWizardHealthChecks,wizardSaveAndRunChecks,wizardBack,wizardSkip,wizardNext,openFullSettingsFromWizard,startWizardFromSettings,newCalendarId,calendarRowsFromDom,readCalendarInputs,syncCalendarEditorRows,calendarCardHtml,bindCalendarCard,renderCalendarSourceList,addCalendarSource,removeCalendarSource,duplicateCalendarSource,importCalendarFile,calendarOrderIds,calendarPriority,readCalendarOrder,renderCalendarOrderList,moveCalendarOrder,renderCalendarLegend,bindCalendarColorControls,bindCalendarUxInputs,updateCalendarEntryVisibility,toggleEmptyCalendarSlots,normalizeWeatherLocationResult,savedWeatherLocation,weatherLocationTitle,weatherLocationSearchText,renderWeatherLocationSelected,weatherLocationQueryChanged,selectWeatherLocationResult,searchWeatherLocations,previewWeatherLocationLabel,saveSetup}, {
  "STARTER_TEMPLATES": {configurable:true,get:()=>STARTER_TEMPLATES},
  "STARTER_TEMPLATE_LAYOUTS": {configurable:true,get:()=>STARTER_TEMPLATE_LAYOUTS},
  "pendingWeatherLocation": {configurable:true,get:()=>pendingWeatherLocation,set:(value)=>{pendingWeatherLocation=value;}},
  "weatherLocationSearchResults": {configurable:true,get:()=>weatherLocationSearchResults,set:(value)=>{weatherLocationSearchResults=value;}},
}, {globalFunctions:['applyStarterTemplate','runWizardHealthChecks','wizardBack','wizardSkip','wizardNext','openFullSettingsFromWizard','startWizardFromSettings','addCalendarSource','removeCalendarSource','duplicateCalendarSource','importCalendarFile','moveCalendarOrder','weatherLocationQueryChanged','selectWeatherLocationResult','searchWeatherLocations','previewWeatherLocationLabel','saveSetup'],globalStates:[]});
}
// End source section: /js/onboarding/index.js
