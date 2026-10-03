// Weather-alert runtime, rendering, and motion controls.
const configApi=LibreDisplayRuntime.getModule('config');

const {fetchRemoteText,esc}=LibreDisplayRuntime.getModule('shared');

const TEST_ALERT_TEMPLATES=[
  ['Tornado Warning','Extreme','A tornado warning is in effect for the test area. Take shelter in a sturdy interior room away from windows.'],
  ['Severe Thunderstorm Warning','Severe','Severe thunderstorms capable of damaging winds and large hail are moving through the test area.'],
  ['Flash Flood Warning','Severe','Flash flooding is possible in low-lying and poor-drainage areas. Avoid flooded roads.'],
  ['Winter Storm Warning','Severe','Heavy snow and hazardous travel conditions are expected in the test area.'],
  ['Heat Advisory','Moderate','Hot temperatures and high humidity may increase the risk of heat-related illness.'],
  ['Wind Advisory','Moderate','Strong gusty winds may blow around unsecured objects and make travel difficult.'],
  ['Dense Fog Advisory','Moderate','Visibility may fall below one quarter mile in dense fog. Use low-beam headlights.'],
  ['Flood Advisory','Moderate','Minor flooding of streets, creeks, and low-lying areas is possible.'],
  ['Air Quality Alert','Minor','Air quality may reach unhealthy levels for sensitive groups during the test period.'],
  ['Special Weather Statement','Minor','Brief hazardous weather is possible. Monitor conditions and be prepared to act if needed.'],
  ['Freeze Warning','Severe','Sub-freezing temperatures may damage sensitive vegetation and outdoor plumbing.'],
  ['Red Flag Warning','Severe','Critical fire-weather conditions are possible due to dry air and strong winds.']
];

function previewAlertSize(value){
  const pct=Math.min(33,Math.max(25,Number(value)||29));
  document.documentElement.style.setProperty('--alert-card-height',pct+'%');
  const out=document.getElementById('s-alert-size-value');
  if(out)out.textContent=pct+'%';
  requestAnimationFrame(()=>restartAlertScroller());
}

function savedAlertRuntimeState(){
  return {
    enabled:!!cfg.alertsEnabled,
    testMode:!!cfg.alertTestMode,
    mode:cfg.alertMotionMode||'continuous',
    speed:Math.min(120,Math.max(4,Number(cfg.alertMotionPx)||36)),
    delay:Math.min(60,Math.max(3,Number(cfg.alertScrollSec)||8))
  };
}

function settingsOverlayOpen(){
  const setup=document.getElementById('setup');
  return !!setup&&!setup.classList.contains('hidden');
}

function effectiveAlertRuntimeState(){
  // Form-preview state is valid only while Settings is visible or the explicit
  // full-screen preview is active. The normal dashboard always follows saved cfg.
  if(settingsOverlayOpen()||LibreDisplayRuntime.getModule('settings').settingsPreviewMode)return configApi.alertRuntimeState||savedAlertRuntimeState();
  return savedAlertRuntimeState();
}

function syncAlertRuntimeStateFromForm(){
  const enabledEl=document.getElementById('s-alerts-enabled');
  const testEl=document.getElementById('s-alert-test');
  const modeEl=document.getElementById('s-alert-motion');
  const speedEl=document.getElementById('s-alert-motion-speed');
  const delayEl=document.getElementById('s-alert-scroll');
  configApi.alertRuntimeState={
    enabled:enabledEl?!!enabledEl.checked:!!cfg.alertsEnabled,
    testMode:testEl?!!testEl.checked:!!cfg.alertTestMode,
    mode:modeEl?.value||cfg.alertMotionMode||'continuous',
    speed:Math.min(120,Math.max(4,Number(speedEl?.value??cfg.alertMotionPx)||36)),
    delay:Math.min(60,Math.max(3,Number(delayEl?.value??cfg.alertScrollSec)||8))
  };
  return configApi.alertRuntimeState;
}

function currentAlertMotionSpeed(){
  return effectiveAlertRuntimeState().speed;
}

function previewAlertMotionSpeed(value){
  const speed=Math.min(120,Math.max(4,Number(value)||36));
  const out=document.getElementById('s-alert-motion-speed-value');
  if(out)out.textContent=speed+' px/s';
  if(configApi.alertRuntimeState)configApi.alertRuntimeState.speed=speed;
}

function handleAlertMotionChange(){
  syncAlertRuntimeStateFromForm();
  restartAlertScroller();
}

function previewAlertTestFullScreen(){
  const test=document.getElementById('s-alert-test');
  if(test&&!test.checked)test.checked=true;
  previewDashboardFromSettings();
}

function ensureAlertMotionRunning(){
  if(!configApi.activeWeatherAlerts.length)return;
  const state=effectiveAlertRuntimeState();
  if(state.mode==='static'){stopAlertScroller();return;}
  if(state.mode==='continuous'){if(!configApi.alertScrollRaf)restartAlertScroller();return;}
  if(!configApi.alertScrollTimer)restartAlertScroller();
}

function setAlertStatus(text,error=false){
  configApi.lastAlertStatus={text:String(text||''),error:!!error,updatedAt:Date.now()};
  const el=document.getElementById('alert-status');
  if(!el)return;
  if(!configApi.lastAlertStatus.text){el.style.display='none';el.textContent='';return;}
  el.style.display='block';
  el.style.color=error?'#fca5a5':'rgba(255,255,255,0.42)';
  el.textContent=configApi.lastAlertStatus.text;
}

function formatAlertTime(iso){
  if(!iso)return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return '';
  let h=d.getHours(),m=String(d.getMinutes()).padStart(2,'0');
  const ap=h>=12?'PM':'AM';h=h%12||12;
  return `${h}:${m} ${ap}`;
}

function randomTestAlerts(count=10){
  const pool=[...TEST_ALERT_TEMPLATES];
  for(let i=pool.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  const now=Date.now();
  return pool.slice(0,Math.min(10,count)).map((x,i)=>({
    id:'test-'+now+'-'+i,
    event:'TEST — '+x[0],
    severity:x[1],
    headline:`Simulated ${x[0]} for ${cfg.locName||cfg.city||'the configured location'}`,
    description:x[2],
    areaDesc:cfg.locName||cfg.city||'Test area',
    senderName:'Dashboard Weather Alert Test Mode',
    expires:new Date(now+(45+i*23)*60000).toISOString(),
    test:true
  }));
}

function normalizeNwsAlerts(data){
  const rank={Extreme:0,Severe:1,Moderate:2,Minor:3,Unknown:4};
  return (Array.isArray(data?.features)?data.features:[]).map((feature,i)=>{
    const p=feature?.properties||{};
    return {
      id:feature?.id||p.id||'nws-'+i,
      event:p.event||'Weather Alert',
      severity:p.severity||'Unknown',
      headline:p.headline||'',
      description:p.description||'',
      areaDesc:p.areaDesc||'',
      senderName:p.senderName||'National Weather Service',
      expires:p.ends||p.expires||'',
      test:false
    };
  }).filter(a=>{
    if(cfg.alertMinSeverity==='all')return true;
    const maxRank={minor:3,moderate:2,severe:1,extreme:0}[cfg.alertMinSeverity];
    return (rank[a.severity]??4)<=maxRank;
  }).sort((a,b)=>(rank[a.severity]??4)-(rank[b.severity]??4)).slice(0,10);
}

function alertCardHtml(a){
  const sev=String(a.severity||'Unknown').toLowerCase();
  const safeSev=['extreme','severe','moderate','minor'].includes(sev)?sev:'severe';
  const main=a.headline&&a.headline!==a.event?a.headline:(a.description||a.event||'Weather alert');
  const meta=[a.areaDesc,a.senderName].filter(Boolean).join(' · ');
  const expires=formatAlertTime(a.expires);
  return `<section class="alert-card severity-${safeSev}" data-alert-id="${esc(a.id||'')}">
    <div class="alert-icon">!</div>
    <div class="alert-content">
      <div class="alert-head"><div class="alert-title">${esc(a.event||'Weather Alert')}</div><div class="alert-expiry">${expires?'Until '+esc(expires):''}</div></div>
      <div class="alert-text">${esc(main)}</div>
      <div class="alert-meta">${esc(meta)}</div>
    </div>
  </section>`;
}

function stopAlertScroller(){
  if(configApi.alertScrollTimer){clearInterval(configApi.alertScrollTimer);configApi.alertScrollTimer=null;}
  if(configApi.alertScrollRaf){cancelAnimationFrame(configApi.alertScrollRaf);configApi.alertScrollRaf=null;}
  configApi.alertScrollIndex=0; configApi.alertLoopHeight=0; configApi.alertLastFrame=0;
  const track=document.getElementById('alert-track');
  if(track){
    track.querySelectorAll('.alert-clone').forEach(el=>el.remove());
    track.style.transform='';
    track.style.willChange='';
  }
  const viewport=document.getElementById('alert-viewport');
  if(viewport){viewport.style.scrollBehavior='auto';viewport.scrollTop=0;}
}

function getAlertScrollPositions(){
  const viewport=document.getElementById('alert-viewport');
  const cards=[...document.querySelectorAll('#alert-track .alert-card:not(.alert-clone)')];
  if(!viewport||cards.length<2)return [0];
  const maxScroll=Math.max(0,viewport.scrollHeight-viewport.clientHeight);
  const positions=[];
  for(const card of cards){
    const pos=Math.min(maxScroll,card.offsetTop);
    if(!positions.length||Math.abs(pos-positions[positions.length-1])>2)positions.push(pos);
    if(pos>=maxScroll-2)break;
  }
  return positions.length?positions:[0];
}

function startContinuousAlertScroll(){
  const viewport=document.getElementById('alert-viewport');
  const track=document.getElementById('alert-track');
  if(!viewport||!track)return;
  const originals=[...track.querySelectorAll('.alert-card:not(.alert-clone)')];
  if(!originals.length||track.scrollHeight<=viewport.clientHeight+2)return;
  let firstClone=null;
  for(const card of originals){
    const clone=card.cloneNode(true);
    clone.classList.add('alert-clone');
    clone.setAttribute('aria-hidden','true');
    track.appendChild(clone);
    if(!firstClone)firstClone=clone;
  }
  configApi.alertLoopHeight=firstClone?firstClone.offsetTop-originals[0].offsetTop:0;
  if(configApi.alertLoopHeight<=0){
    track.querySelectorAll('.alert-clone').forEach(el=>el.remove());
    return;
  }
  viewport.style.scrollBehavior='auto';
  viewport.scrollTop=0;
  track.style.willChange='transform';
  track.style.transform='translate3d(0,0,0)';
  let scrollPos=0;
  const frame=ts=>{
    if(!configApi.alertScrollRaf)return;
    if(!configApi.alertLastFrame)configApi.alertLastFrame=ts;
    const dt=Math.min(80,ts-configApi.alertLastFrame);
    configApi.alertLastFrame=ts;
    scrollPos+=currentAlertMotionSpeed()*dt/1000;
    while(scrollPos>=configApi.alertLoopHeight)scrollPos-=configApi.alertLoopHeight;
    track.style.transform=`translate3d(0,${-scrollPos}px,0)`;
    configApi.alertScrollRaf=requestAnimationFrame(frame);
  };
  configApi.alertScrollRaf=requestAnimationFrame(frame);
}

function restartAlertScroller(){
  stopAlertScroller();
  const viewport=document.getElementById('alert-viewport');
  const track=document.getElementById('alert-track');
  if(!viewport||!track)return;
  requestAnimationFrame(()=>{
    const state=effectiveAlertRuntimeState();
    if(track.scrollHeight<=viewport.clientHeight+2||state.mode==='static'||document.documentElement.classList.contains('ld-reduce-motion'))return;
    if(state.mode==='continuous'){
      startContinuousAlertScroll();
      return;
    }
    viewport.style.scrollBehavior='smooth';
    const positions=getAlertScrollPositions();
    if(positions.length<=1)return;
    configApi.alertScrollTimer=setInterval(()=>{
      configApi.alertScrollIndex=(configApi.alertScrollIndex+1)%positions.length;
      viewport.scrollTo({top:positions[configApi.alertScrollIndex],behavior:'smooth'});
    },Math.max(3,state.delay||8)*1000);
  });
}

function renderWeatherAlerts(alerts){
  configApi.activeWeatherAlerts=(Array.isArray(alerts)?alerts:[]).slice(0,10);
  setTimeout(updateSettingsOverview,0);
  const zone=document.getElementById('alert-zone');
  const track=document.getElementById('alert-track');
  if(!zone||!track)return;
  stopAlertScroller();
  if(!configApi.activeWeatherAlerts.length){
    track.innerHTML='';
    zone.classList.remove('show');
    return;
  }
  track.innerHTML=configApi.activeWeatherAlerts.map(alertCardHtml).join('');
  zone.classList.add('show');
  restartAlertScroller();
}

function currentAlertFormState(){
  const state=effectiveAlertRuntimeState();
  return {enabled:state.enabled,testMode:state.testMode};
}

function handleAlertTestModeChange(){
  syncAlertRuntimeStateFromForm();
  configApi.alertFetchSerial++;
  const state=currentAlertFormState();
  if(!state.testMode&&configApi.activeWeatherAlerts.some(a=>a?.test))renderWeatherAlerts([]);
  fetchWeatherAlerts();
}

function handleAlertsEnabledChange(){
  syncAlertRuntimeStateFromForm();
  configApi.alertFetchSerial++;
  const state=currentAlertFormState();
  if(!state.enabled){
    renderWeatherAlerts([]);
    setAlertStatus('Weather alerts are disabled.');
    return;
  }
  fetchWeatherAlerts();
}

async function fetchWeatherAlerts(forceTest=false){
  const requestId=++configApi.alertFetchSerial;
  const state=currentAlertFormState();
  if(!state.enabled&&!forceTest){
    renderWeatherAlerts([]);
    setAlertStatus('Weather alerts are disabled.');
    return;
  }
  if(forceTest||state.testMode){
    const alerts=randomTestAlerts(10);
    if(requestId!==configApi.alertFetchSerial)return;
    renderWeatherAlerts(alerts);
    setAlertStatus('Test mode: showing 10 simulated weather alerts.');
    return;
  }
  if(configApi.activeWeatherAlerts.some(a=>a?.test))renderWeatherAlerts([]);
  if(!cfg.lat||!cfg.lon){
    renderWeatherAlerts([]);
    setAlertStatus('Weather alerts need a saved location.',true);
    return;
  }
  setAlertStatus('Loading real weather alerts…');
  try{
    const url=`https://api.weather.gov/alerts/active?point=${encodeURIComponent(cfg.lat+','+cfg.lon)}`;
    const text=await fetchRemoteText(url,(cfg.alertRefreshMin||5)*60);
    if(requestId!==configApi.alertFetchSerial)return;
    const data=JSON.parse(text);
    const alerts=normalizeNwsAlerts(data);
    if(requestId!==configApi.alertFetchSerial)return;
    renderWeatherAlerts(alerts);
    setAlertStatus(alerts.length?`${alerts.length} active weather alert${alerts.length===1?'':'s'} loaded.`:'No active weather alerts for this location.');
  }catch(e){
    if(requestId!==configApi.alertFetchSerial)return;
    renderWeatherAlerts([]);
    setAlertStatus('Weather alert fetch failed: '+String(e?.message||e),true);
    console.warn('weather alert error',e);
  }
}


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("weather", {previewAlertSize,savedAlertRuntimeState,settingsOverlayOpen,effectiveAlertRuntimeState,syncAlertRuntimeStateFromForm,currentAlertMotionSpeed,previewAlertMotionSpeed,handleAlertMotionChange,previewAlertTestFullScreen,ensureAlertMotionRunning,setAlertStatus,formatAlertTime,randomTestAlerts,normalizeNwsAlerts,alertCardHtml,stopAlertScroller,getAlertScrollPositions,startContinuousAlertScroll,restartAlertScroller,renderWeatherAlerts,currentAlertFormState,handleAlertTestModeChange,handleAlertsEnabledChange,fetchWeatherAlerts}, {
  "TEST_ALERT_TEMPLATES": {configurable:true,get:()=>TEST_ALERT_TEMPLATES}
}, {globalFunctions:['previewAlertSize','previewAlertMotionSpeed','handleAlertMotionChange','previewAlertTestFullScreen','handleAlertTestModeChange','handleAlertsEnabledChange'],globalStates:[]});
