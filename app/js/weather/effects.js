// Vector weather motion, full-screen atmosphere, seasonal accents, and preview lab.
const configApi=LibreDisplayRuntime.getModule('config');
const performanceApi=LibreDisplayRuntime.getModule('performance');
const {uiCfg}=LibreDisplayRuntime.getModule('shared');

let lastSignature='';
let weatherTestProfile='live';
const WEATHER_TEST_PROFILES={
  drizzle:{label:'Light drizzle',weather_code:53,precipitation:1.2,cloud_cover:92,wind_speed_10m:8,wind_direction_10m:210,is_day:1},
  rain:{label:'Rain',weather_code:63,precipitation:4,cloud_cover:100,wind_speed_10m:14,wind_direction_10m:220,is_day:1},
  'heavy-rain':{label:'Heavy rain',weather_code:65,precipitation:12,cloud_cover:100,wind_speed_10m:25,wind_direction_10m:235,is_day:1},
  storm:{label:'Thunderstorm',weather_code:95,precipitation:9,cloud_cover:100,wind_speed_10m:31,wind_direction_10m:245,is_day:1},
  snow:{label:'Snow',weather_code:73,precipitation:4,cloud_cover:98,wind_speed_10m:10,wind_direction_10m:160,is_day:1},
  'heavy-snow':{label:'Heavy snow',weather_code:75,precipitation:9,cloud_cover:100,wind_speed_10m:18,wind_direction_10m:185,is_day:1},
  fog:{label:'Fog',weather_code:45,precipitation:0,cloud_cover:100,wind_speed_10m:4,wind_direction_10m:80,is_day:1},
  cloud:{label:'Cloudy',weather_code:3,precipitation:0,cloud_cover:96,wind_speed_10m:13,wind_direction_10m:265,is_day:1},
  windy:{label:'Windy clouds',weather_code:3,precipitation:0,cloud_cover:78,wind_speed_10m:38,wind_direction_10m:270,is_day:1},
  partly:{label:'Partly cloudy',weather_code:2,precipitation:0,cloud_cover:48,wind_speed_10m:9,wind_direction_10m:250,is_day:1},
  clear:{label:'Clear day',weather_code:0,precipitation:0,cloud_cover:8,wind_speed_10m:5,wind_direction_10m:180,is_day:1},
  night:{label:'Clear night',weather_code:0,precipitation:0,cloud_cover:8,wind_speed_10m:4,wind_direction_10m:180,is_day:0}
};

function wxClamp(n,lo,hi,fallback=lo){n=Number(n);return Math.min(hi,Math.max(lo,Number.isFinite(n)?n:fallback));}
function weatherVisualCondition(code){
  const c=Number(code);
  if([95,96,99].includes(c))return 'storm';
  if([71,73,75,77,85,86].includes(c))return 'snow';
  if([51,53,55,61,63,65,80,81,82].includes(c))return 'rain';
  if([45,48].includes(c))return 'fog';
  if([1,2].includes(c))return 'partly';
  if(c===3)return 'cloud';
  if(c===0)return 'clear';
  return 'none';
}
function weatherEffectCondition(code){return weatherVisualCondition(code);}
function weatherEffectSource(source){return source&&typeof source==='object'?source:uiCfg();}
function effectAllowed(condition,source){
  const mode=source.weatherEffectMode||'auto';
  const precipitation=source.weatherEffectPrecipitation!==false,clouds=source.weatherEffectClouds!==false,fog=source.weatherEffectFog!==false,sun=source.weatherEffectSun!==false,lightning=source.weatherEffectLightning!==false;
  let enabled=false;
  if(condition==='rain'||condition==='snow')enabled=precipitation||clouds;
  else if(condition==='storm')enabled=precipitation||clouds||lightning;
  else if(condition==='partly')enabled=clouds||sun;
  else if(condition==='cloud')enabled=clouds;
  else if(condition==='fog')enabled=fog;
  else if(condition==='clear')enabled=sun;
  if(mode==='precipitation')return enabled&&['rain','snow','storm'].includes(condition);
  if(mode==='ambient')return enabled&&['clear','partly','cloud','fog'].includes(condition);
  return enabled;
}
function weatherGlyphEnabled(condition,source){
  const precipitation=source.weatherEffectPrecipitation!==false,clouds=source.weatherEffectClouds!==false,fog=source.weatherEffectFog!==false,sun=source.weatherEffectSun!==false,lightning=source.weatherEffectLightning!==false;
  if(condition==='clear')return sun;
  if(condition==='partly')return sun||clouds;
  if(condition==='cloud')return clouds;
  if(condition==='rain'||condition==='snow')return precipitation||clouds;
  if(condition==='storm')return precipitation||clouds||lightning;
  if(condition==='fog')return fog;
  return false;
}
function syncWeatherGlyphVisibility(source,widgetOn){
  for(const glyph of document.querySelectorAll('.ld-weather-glyph')){
    const active=!!widgetOn&&weatherGlyphEnabled(String(glyph.dataset.weatherVisual||'none'),source);
    glyph.classList.toggle('ld-weather-glyph-active',active);
    const fallback=glyph.previousElementSibling;
    if(fallback?.classList?.contains('ld-weather-emoji-fallback'))fallback.classList.toggle('ld-weather-emoji-hidden',active);
  }
}

function liveIntensityMultiplier(condition,data){
  const current=data?.current||{},code=Number(current.weather_code),precip=Number(current.precipitation),cloud=Number(current.cloud_cover),wind=Number(current.wind_speed_10m);
  const severity={51:.62,53:.76,55:.92,61:.76,63:1,65:1.32,80:.82,81:1.08,82:1.42,71:.72,73:1,75:1.3,77:.8,85:.88,86:1.26,95:1.18,96:1.38,99:1.55}[code]||1;
  if(condition==='rain'||condition==='snow'||condition==='storm'){
    const precipBoost=Number.isFinite(precip)?wxClamp(.68+Math.sqrt(Math.max(0,precip))*.23,.68,1.45,1):1;
    const windBoost=Number.isFinite(wind)?wxClamp(.86+wind/120,.86,1.22,1):1;
    return wxClamp(severity*precipBoost*windBoost,.55,1.7,1);
  }
  if(condition==='cloud'||condition==='partly')return Number.isFinite(cloud)?wxClamp(.62+cloud/170,.62,1.18,1):1;
  if(condition==='fog')return Number.isFinite(cloud)?wxClamp(.78+cloud/240,.78,1.16,1):1;
  return 1;
}
function weatherEffectIntensityForData(condition,data,source){
  const selected=wxClamp(source.weatherEffectIntensity,10,100,50);
  return wxClamp(selected*(source.weatherEffectAutoIntensity===false?1:liveIntensityMultiplier(condition,data)),8,150,selected);
}
function particleCount(condition,intensity,constrained,source){
  if((condition==='rain'||condition==='snow'||condition==='storm')&&source.weatherEffectPrecipitation===false)return 0;
  if(condition==='cloud'&&source.weatherEffectClouds===false)return 0;
  if(condition==='partly')return 0;
  if(condition==='fog'&&source.weatherEffectFog===false)return 0;
  if(condition==='clear'&&source.weatherEffectSun===false)return 0;
  const base={rain:94,snow:64,storm:116,cloud:10,fog:10,clear:5}[condition]||0;
  const factor=wxClamp(Number(intensity)/100,.08,1.5,.5),limit=constrained?98:190;
  return Math.max(0,Math.min(limit,Math.round(base*factor*(constrained?.62:1))));
}
function weatherReducedMotionActive(source){return source.weatherEffectRespectReducedMotion!==false&&document.documentElement.classList.contains('ld-reduce-motion');}
function fullscreenPauseReason(source){
  if(source.weatherEffectPauseWhenDimmed!==false&&document.body.classList.contains('ld-burnin-dim'))return 'display-dimmed';
  if(document.body.classList.contains('layout-editing')||document.body.classList.contains('remote-layout-proxy')||globalThis.LAYOUT_PREVIEW_MODE)return 'layout-preview';
  return '';
}
function effectPauseReason(source){
  if(!source?.weatherAnimationsEnabled)return 'animations-off';
  if(weatherReducedMotionActive(source))return 'reduced-motion';
  return fullscreenPauseReason(source);
}
function effectPaused(source){return !!effectPauseReason(source);}
function seededUnit(i,salt){const x=Math.sin((i+1)*12.9898+salt*78.233)*43758.5453;return x-Math.floor(x);}
function precipitationMarkup(kind,count){const cls=kind==='snow'?'ld-wx-flake':'ld-wx-drop';return Array.from({length:count},(_,i)=>`<i class="${cls}" style="--i:${i}"></i>`).join('');}
function weatherIconMarkup(code,fallback='',source=null){
  source=weatherEffectSource(source);
  const condition=weatherVisualCondition(code),safeFallback=String(fallback||''),widgetOn=!!source?.weatherAnimationsEnabled&&!!source?.weatherWidgetAnimations&&!effectPaused(source),glyphActive=widgetOn&&weatherGlyphEnabled(condition,source||{});
  const fallbackClass='ld-weather-emoji-fallback'+(glyphActive?' ld-weather-emoji-hidden':''),glyphClass='ld-weather-glyph ld-weather-'+condition+(glyphActive?' ld-weather-glyph-active':'');
  const sun=['clear','partly'].includes(condition)?'<span class="ld-wx-sun"><i></i></span>':'',cloud=['partly','cloud','rain','snow','storm'].includes(condition)?'<span class="ld-wx-cloud"><i></i><b></b></span>':'',rain=['rain','storm'].includes(condition)?`<span class="ld-wx-precip ld-wx-rain">${precipitationMarkup('rain',5)}</span>`:'',snow=condition==='snow'?`<span class="ld-wx-precip ld-wx-snow">${precipitationMarkup('snow',6)}</span>`:'',bolt=condition==='storm'?'<span class="ld-wx-bolt"></span>':'',fog=condition==='fog'?'<span class="ld-wx-fog"><i></i><i></i><i></i></span>':'',unknown=condition==='none'?'<span class="ld-wx-unknown">•</span>':'';
  return `<span class="${fallbackClass}">${safeFallback}</span><span class="${glyphClass}" data-weather-visual="${condition}" aria-hidden="true">${sun}${cloud}${rain}${snow}${bolt}${fog}${unknown}</span>`;
}
function decorateWeatherIcon(el,code,fallback='',source=null){if(!el)return;const signature=`${Number(code)}|${String(fallback||'')}`;if(el.dataset.weatherGlyphSignature===signature)return;el.dataset.weatherCode=String(Number(code));el.dataset.weatherGlyphSignature=signature;el.innerHTML=weatherIconMarkup(code,fallback,source);}
function weatherWindProfile(data,source){
  if(source.weatherEffectWind===false)return {strength:0,direction:1};
  const current=data?.current||{},configured=wxClamp(source.weatherEffectWindStrength,0,180,100)/100,live=Number(current.wind_speed_10m),degrees=Number(current.wind_direction_10m),liveBoost=source.weatherEffectAutoIntensity===false||!Number.isFinite(live)?1:wxClamp(.65+live/38,.65,1.7,1),direction=Number.isFinite(degrees)&&Math.sin(degrees*Math.PI/180)<-.05?-1:1;
  return {strength:wxClamp(configured*liveBoost,0,2.4,configured),direction};
}

function weatherSeasonContextForData(data,source,date=null){
  const mode=source.weatherSeasonMode||'auto',forced=['spring','summer','fall','winter'].includes(mode)?mode:'',lat=Number(data?.latitude??source.lat??configApi.cfg?.lat);
  if(source.weatherSeasonalEffects===false||mode==='off')return {season:'none',hemisphere:'none',climateBand:'off',latitude:Number.isFinite(lat)?lat:null,automatic:false,scale:0};
  if(!Number.isFinite(lat))return {season:forced||'none',hemisphere:'unknown',climateBand:'unknown',latitude:null,automatic:!forced,scale:forced?1:0};
  const absLat=Math.abs(lat),hemisphere=lat<0?'south':'north',climateBand=absLat<8?'equatorial':absLat<23.5?'tropical':absLat<35?'subtropical':absLat<60?'temperate':'high-latitude';
  if(forced)return {season:forced,hemisphere,climateBand,latitude:lat,automatic:false,scale:1};
  if(climateBand==='equatorial'||climateBand==='tropical')return {season:'none',hemisphere,climateBand,latitude:lat,automatic:true,scale:0};
  let month=null;if(date instanceof Date&&Number.isFinite(date.getTime()))month=date.getMonth();
  if(month===null&&typeof data?.current?.time==='string'){const match=data.current.time.match(/^\d{4}-(\d{2})-/);if(match)month=Number(match[1])-1;}
  if(month===null)month=new Date().getMonth();if(hemisphere==='south')month=(month+6)%12;
  const season=[2,3,4].includes(month)?'spring':[5,6,7].includes(month)?'summer':[8,9,10].includes(month)?'fall':'winter',temp=Number(data?.current?.temperature_2m);let scale=climateBand==='subtropical'?({spring:.82,summer:.92,fall:.62,winter:.52}[season]||1):climateBand==='high-latitude'?.92:1;
  if(season==='winter'&&climateBand==='subtropical'&&Number.isFinite(temp)){if(temp>12)scale*=.36;else if(temp>7)scale*=.62;}if(season==='fall'&&Number.isFinite(temp)&&temp>27)scale*=.58;
  return {season,hemisphere,climateBand,latitude:lat,automatic:true,scale:wxClamp(scale,.12,1,1)};
}
function weatherSeasonForData(data,source,date=null){return weatherSeasonContextForData(data,source,date).season;}
function seasonalParticleCount(season,source,constrained,data=null){
  if(season==='none'||source.weatherSeasonalEffects===false)return 0;
  const context=weatherSeasonContextForData(data||configApi.wxData,source),base={spring:42,summer:40,fall:34,winter:24}[season]||0,factor=wxClamp(source.weatherSeasonalIntensity,0,100,45)/100;
  return Math.round(base*factor*(context.automatic?context.scale:1)*(constrained?.62:1));
}
function appendSeasonalParticles(frag,season,count,source,data,wind){
  const speed=wxClamp(source.weatherEffectSpeed,40,180,100)/100,isNight=Number(data?.current?.is_day)===0,context=weatherSeasonContextForData(data,source),temp=Number(data?.current?.temperature_2m),mildWinter=context.automatic&&season==='winter'&&context.climateBand==='subtropical'&&(!Number.isFinite(temp)||temp>6);
  for(let i=0;i<count;i++){
    const p=document.createElement('span');p.className='weather-fx-seasonal';
    p.style.setProperty('--season-x',`${(seededUnit(i,31)*108-4).toFixed(2)}vw`);p.style.setProperty('--season-y',`${(seededUnit(i,32)*98).toFixed(2)}vh`);p.style.setProperty('--season-delay',`${(-seededUnit(i,33)*18/speed).toFixed(2)}s`);p.style.setProperty('--season-scale',(0.55+seededUnit(i,34)*1.15).toFixed(2));
    const drift=wind.direction*(8+seededUnit(i,35)*28)*Math.max(.28,wind.strength);p.style.setProperty('--season-drift',`${drift.toFixed(1)}vw`);
    if(season==='spring'){
      if(i%3===0){p.classList.add('weather-fx-grass');p.style.setProperty('--grass-h',`${(2.5+seededUnit(i,36)*6).toFixed(1)}vh`);}
      else{p.classList.add('weather-fx-petal');p.style.setProperty('--season-duration',`${(8+seededUnit(i,37)*10)/speed}s`);p.style.setProperty('--petal-hue',String(Math.round(320+seededUnit(i,38)*40)));}
    }else if(season==='summer'){
      if(i%4===0){p.classList.add('weather-fx-grass','weather-fx-summer-grass');p.style.setProperty('--grass-h',`${(3+seededUnit(i,36)*7).toFixed(1)}vh`);}else{p.classList.add(isNight?'weather-fx-firefly':'weather-fx-summer-mote');p.style.setProperty('--season-duration',`${(5+seededUnit(i,39)*8)/speed}s`);}
    }else if(season==='fall'){
      p.classList.add('weather-fx-leaf');p.style.setProperty('--season-duration',`${(5.5+seededUnit(i,40)*8)/speed}s`);p.style.setProperty('--leaf-hue',String(Math.round(18+seededUnit(i,41)*38)));
    }else if(season==='winter'){
      p.classList.add(mildWinter?'weather-fx-winter-mote':'weather-fx-crystal');p.style.setProperty('--season-duration',`${(7+seededUnit(i,42)*10)/speed}s`);
    }
    frag.appendChild(p);
  }
}
function appendWeatherParticles(frag,condition,count,source,data,wind){
  const speed=wxClamp(source.weatherEffectSpeed,40,180,100)/100,particleScale=wxClamp(source.weatherEffectParticleScale,60,160,100)/100;
  for(let i=0;i<count;i++){
    const p=document.createElement('span'),depth=.24+seededUnit(i,7)*.76;p.className='weather-fx-particle weather-fx-primary';
    p.style.setProperty('--fx-x',`${(seededUnit(i,1)*106-3).toFixed(2)}vw`);p.style.setProperty('--fx-y',`${(seededUnit(i,6)*20-14).toFixed(2)}vh`);p.style.setProperty('--fx-static-y',`${(seededUnit(i,8)*108-4).toFixed(2)}vh`);p.style.setProperty('--fx-delay',`${(-seededUnit(i,2)*16/speed).toFixed(2)}s`);
    const drift=wind.strength?(wind.direction*(.5+seededUnit(i,3))*(6+18*depth)*wind.strength):0;p.style.setProperty('--fx-drift',`${drift.toFixed(1)}vw`);p.style.setProperty('--fx-depth',depth.toFixed(2));p.style.setProperty('--fx-scale',((.52+seededUnit(i,5)*1.08)*particleScale*(.80+depth*.36)).toFixed(2));p.style.setProperty('--fx-alpha',(.42+depth*.54).toFixed(2));
    if(condition==='rain'||condition==='storm'){
      p.style.setProperty('--fx-duration',`${((.58+seededUnit(i,4)*.82)/(speed*(.8+depth*.4))).toFixed(2)}s`);p.style.setProperty('--fx-width',`${(.7+depth*1.6).toFixed(2)}px`);p.style.setProperty('--fx-length',`${(4.8+depth*6.8).toFixed(2)}vh`);p.style.setProperty('--fx-angle',`${(wind.direction*(6+wind.strength*7)).toFixed(1)}deg`);
    }else if(condition==='snow'){
      p.style.setProperty('--fx-duration',`${((4.8+seededUnit(i,4)*7.4)/(speed*(.78+depth*.34))).toFixed(2)}s`);p.style.setProperty('--fx-blur',`${((1-depth)*1.2).toFixed(2)}px`);
    }else p.style.setProperty('--fx-duration',`${((12+seededUnit(i,4)*18)/(speed*Math.max(.45,.78+wind.strength*.18))).toFixed(2)}s`);
    frag.appendChild(p);
  }
  if((condition==='rain'||condition==='storm')&&count>8&&source.weatherEffectPrecipitation!==false){
    const splashCount=Math.min(20,Math.max(4,Math.round(count*.14)));
    for(let i=0;i<splashCount;i++){const p=document.createElement('span');p.className='weather-fx-splash';p.style.setProperty('--fx-x',`${(seededUnit(i,51)*100).toFixed(2)}vw`);p.style.setProperty('--fx-delay',`${(-seededUnit(i,52)*4/speed).toFixed(2)}s`);p.style.setProperty('--fx-duration',`${(.65+seededUnit(i,53)*.8).toFixed(2)}s`);p.style.setProperty('--fx-scale',(.6+seededUnit(i,54)*1.2).toFixed(2));frag.appendChild(p);}
  }
}
function buildParticles(host,condition,count,source,data,season){
  const wind=weatherWindProfile(data,source),frag=document.createDocumentFragment(),constrained=performanceApi.frontendCapabilities().constrained;
  appendWeatherParticles(frag,condition,count,source,data,wind);appendSeasonalParticles(frag,season,seasonalParticleCount(season,source,constrained,data),source,data,wind);host.replaceChildren(frag);
}

function weatherTestData(data=configApi.wxData){
  const profile=WEATHER_TEST_PROFILES[weatherTestProfile];if(!profile)return data;
  const base=data&&typeof data==='object'?data:{};return {...base,latitude:Number(base.latitude??configApi.cfg?.lat),longitude:Number(base.longitude??configApi.cfg?.lon),current:{...(base.current||{}),...profile,time:new Date().toISOString().slice(0,19)}};
}
function weatherEffectTestState(){return {active:weatherTestProfile!=='live',profile:weatherTestProfile,label:WEATHER_TEST_PROFILES[weatherTestProfile]?.label||'Live weather'};}
function setWeatherEffectTestProfile(name='live'){
  weatherTestProfile=WEATHER_TEST_PROFILES[name]?name:'live';lastSignature='';
  const enabled=document.getElementById('s-weather-effect-test-mode'),select=document.getElementById('s-weather-effect-test-condition');if(enabled)enabled.checked=weatherTestProfile!=='live';if(select&&weatherTestProfile!=='live')select.value=weatherTestProfile;
  applyWeatherEffects(configApi.wxData);return weatherEffectTestState();
}
function handleWeatherEffectTestModeChange(control){const select=document.getElementById('s-weather-effect-test-condition');setWeatherEffectTestProfile(control?.checked?(select?.value||'rain'):'live');}
function weatherEffectTestProfileChanged(control){const enabled=document.getElementById('s-weather-effect-test-mode');if(enabled?.checked)setWeatherEffectTestProfile(control?.value||'rain');}
function stopWeatherEffectTest(){setWeatherEffectTestProfile('live');}
function previewWeatherTestFullScreen(){const enabled=document.getElementById('s-weather-effect-test-mode'),select=document.getElementById('s-weather-effect-test-condition');if(enabled)enabled.checked=true;setWeatherEffectTestProfile(select?.value||'rain');if(typeof globalThis.previewAppearance==='function')globalThis.previewAppearance();if(typeof globalThis.previewDashboardFromSettings==='function')globalThis.previewDashboardFromSettings();}

function weatherEffectRuntimeState(data=configApi.wxData,source=null){
  source=weatherEffectSource(source);data=weatherTestData(data);
  const condition=weatherEffectCondition(data?.current?.weather_code),widgetPauseReason=effectPauseReason(source),pauseReason=fullscreenPauseReason(source),allowed=effectAllowed(condition,source),effectiveIntensity=weatherEffectIntensityForData(condition,data,source),reducedMotion=weatherReducedMotionActive(source),seasonContext=weatherSeasonContextForData(data,source),season=seasonContext.season;
  return {source,data,condition,season,seasonContext,pauseReason,widgetPauseReason,paused:!!pauseReason,allowed,effectiveIntensity,reducedMotion,testProfile:weatherTestProfile,widgetOn:!!source.weatherAnimationsEnabled&&!!source.weatherWidgetAnimations&&!widgetPauseReason,fullOn:!!source.weatherFullscreenEffects&&!pauseReason&&allowed};
}
function weatherEffectStatusText(state,data=configApi.wxData){
  data=state.data||weatherTestData(data);const label={storm:'Thunderstorm',snow:'Snow',rain:'Rain',fog:'Fog',partly:'Partly cloudy',cloud:'Clouds',clear:'Clear sky',none:'Unknown weather'}[state.condition]||'Weather',seasonLabel={spring:'Spring',summer:'Summer',fall:'Autumn / Fall',winter:'Winter',none:'No temperate seasonal accent'}[state.season],test=state.testProfile!=='live'?`TEST: ${WEATHER_TEST_PROFILES[state.testProfile]?.label||label} · `:'',ctx=state.seasonContext||weatherSeasonContextForData(data,state.source),region=ctx.hemisphere==='south'?'Southern Hemisphere':ctx.hemisphere==='north'?'Northern Hemisphere':'location unavailable',band=String(ctx.climateBand||'').replace('-', ' ');
  if(!data?.current)return 'Waiting for current weather data.';
  if(!state.source.weatherFullscreenEffects)return `${test}${label} detected · full-screen overlay is off.`;
  if(state.pauseReason==='display-dimmed')return `${test}${label} detected · overlay paused while display protection is dimmed.`;
  if(state.pauseReason==='layout-preview')return `${test}${label} detected · overlay paused during layout editing.`;
  if(!state.allowed)return `${test}${label} detected · current overlay mode/effect switches exclude this condition.`;
  const suffix=state.source.weatherSeasonalEffects===false?'':ctx.automatic&&['equatorial','tropical'].includes(ctx.climateBand)?` · ${region} · ${band} latitude — temperate seasonal accents suppressed`:state.season!=='none'?` · ${seasonLabel} accents · ${region}${band?` · ${band}`:''}`:'';
  if(state.reducedMotion)return `${test}${label} overlay active · reduced-motion static mode · ${Math.round(state.effectiveIntensity)}% effective intensity${suffix}.`;
  return `${test}${label} overlay active · ${Math.round(state.effectiveIntensity)}% effective intensity${suffix}.`;
}
function updateWeatherEffectStatus(state,data=configApi.wxData){const el=document.getElementById('weather-effect-live-status');if(el)el.textContent=weatherEffectStatusText(state,data);}
function applyWeatherEffects(data=configApi.wxData,source=null){
  const host=document.getElementById('weather-effects-overlay');if(!host)return;
  const state=weatherEffectRuntimeState(data,source);source=state.source;data=state.data;
  const condition=state.condition,season=state.season,constrained=performanceApi.frontendCapabilities().constrained,widgetOn=state.widgetOn,fullOn=state.fullOn;
  document.body.classList.toggle('ld-weather-widget-motion',widgetOn);document.body.classList.toggle('ld-weather-fullscreen-motion',fullOn);document.body.classList.toggle('ld-weather-no-precip',source.weatherEffectPrecipitation===false);document.body.classList.toggle('ld-weather-no-clouds',source.weatherEffectClouds===false);document.body.classList.toggle('ld-weather-no-fog',source.weatherEffectFog===false);document.body.classList.toggle('ld-weather-no-sun',source.weatherEffectSun===false);document.body.classList.toggle('ld-weather-no-wind',source.weatherEffectWind===false);document.body.classList.toggle('ld-weather-no-lightning',source.weatherEffectLightning===false);document.body.classList.toggle('ld-weather-respect-reduced-motion',source.weatherEffectRespectReducedMotion!==false);document.body.classList.toggle('ld-weather-pause-dimmed',source.weatherEffectPauseWhenDimmed!==false);document.body.classList.toggle('ld-weather-test-mode',state.testProfile!=='live');
  syncWeatherGlyphVisibility(source,widgetOn);document.body.dataset.weatherCondition=condition;document.body.dataset.weatherSeason=season;document.body.dataset.weatherSeasonRegion=state.seasonContext?.climateBand||'unknown';
  host.className='';host.classList.toggle('weather-fx-no-precip',source.weatherEffectPrecipitation===false);host.classList.toggle('weather-fx-no-clouds',source.weatherEffectClouds===false);host.classList.toggle('weather-fx-no-fog',source.weatherEffectFog===false);host.classList.toggle('weather-fx-no-sun',source.weatherEffectSun===false);host.classList.toggle('weather-fx-no-wind',source.weatherEffectWind===false);host.classList.toggle('weather-fx-no-lightning',source.weatherEffectLightning===false);
  const wind=weatherWindProfile(data,source),lightningSeconds={rare:16,normal:10,frequent:6}[source.weatherEffectLightningFrequency]||10;host.classList.toggle('weather-fx-wind-reverse',wind.direction<0);host.classList.toggle('weather-fx-static',state.reducedMotion);if(season!=='none')host.classList.add('weather-season-'+season);if(state.seasonContext?.climateBand)host.classList.add('weather-region-'+state.seasonContext.climateBand);
  host.style.setProperty('--weather-fx-opacity',String(wxClamp(source.weatherEffectOpacity,5,80,34)/100));host.style.setProperty('--weather-fx-speed',String(wxClamp(source.weatherEffectSpeed,40,180,100)/100));host.style.setProperty('--weather-fx-atmosphere',String(wxClamp(source.weatherEffectAtmosphere,0,100,55)/100));host.style.setProperty('--weather-fx-lightning-alpha',String(wxClamp(source.weatherEffectLightningBrightness,20,100,65)/100));host.style.setProperty('--weather-fx-lightning-duration',`${lightningSeconds}s`);host.style.setProperty('--weather-season-intensity',String(wxClamp(source.weatherSeasonalIntensity,0,100,45)/100));
  updateWeatherEffectStatus(state,data);if(!fullOn){lastSignature='';host.replaceChildren();return;}
  host.classList.add('show','weather-fx-'+condition);const count=particleCount(condition,state.effectiveIntensity,constrained,source),seasonCount=seasonalParticleCount(season,source,constrained,data);
  const signature=[condition,season,state.seasonContext?.hemisphere,state.seasonContext?.climateBand,Math.round((state.seasonContext?.scale||0)*100),count,seasonCount,source.weatherEffectSpeed,source.weatherEffectOpacity,source.weatherEffectAtmosphere,source.weatherEffectParticleScale,source.weatherEffectWindStrength,source.weatherEffectAutoIntensity,source.weatherEffectPrecipitation,source.weatherEffectClouds,source.weatherEffectFog,source.weatherEffectSun,source.weatherEffectWind,source.weatherEffectLightning,source.weatherEffectLightningFrequency,source.weatherEffectLightningBrightness,source.weatherSeasonalEffects,source.weatherSeasonMode,source.weatherSeasonalIntensity,wind.direction,Math.round(wind.strength*100),state.testProfile,constrained].join('|');
  if(signature!==lastSignature){buildParticles(host,condition,count,source,data,season);lastSignature=signature;}host.classList.toggle('weather-fx-lightning',condition==='storm'&&source.weatherEffectLightning!==false);
}
function refreshWeatherEffects(){applyWeatherEffects(configApi.wxData);}
function weatherOverlayNeedsRepair(data=configApi.wxData,source=null){
  const host=document.getElementById('weather-effects-overlay');if(!host)return false;const state=weatherEffectRuntimeState(data,source);if(!state.fullOn)return false;const expectedClass='weather-fx-'+state.condition,constrained=performanceApi.frontendCapabilities().constrained,count=particleCount(state.condition,state.effectiveIntensity,constrained,state.source)+seasonalParticleCount(state.season,state.source,constrained,state.data);return !host.classList.contains('show')||!host.classList.contains(expectedClass)||(count>0&&host.children.length===0);
}
function ensureWeatherOverlayLive(data=configApi.wxData,source=null){if(!weatherOverlayNeedsRepair(data,source))return false;lastSignature='';applyWeatherEffects(data,source);return true;}
function weatherPauseClassSignature(value=document.body.className){const names=new Set(String(value||'').split(/\s+/).filter(Boolean));return ['ld-burnin-dim','layout-editing','remote-layout-proxy'].map(name=>names.has(name)?'1':'0').join('');}
const observer=new MutationObserver(records=>{if(!configApi.wxData&&weatherTestProfile==='live')return;const current=weatherPauseClassSignature();if(records.some(record=>weatherPauseClassSignature(record.oldValue)!==current))refreshWeatherEffects();});
observer.observe(document.body,{attributes:true,attributeFilter:['class'],attributeOldValue:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshWeatherEffects();ensureWeatherOverlayLive();}});setInterval(()=>ensureWeatherOverlayLive(),2500);

LibreDisplayRuntime.exposeModule('weatherEffects',{WEATHER_TEST_PROFILES,weatherVisualCondition,weatherEffectCondition,weatherEffectSource,effectAllowed,weatherGlyphEnabled,syncWeatherGlyphVisibility,liveIntensityMultiplier,weatherEffectIntensityForData,particleCount,weatherReducedMotionActive,fullscreenPauseReason,effectPauseReason,weatherIconMarkup,decorateWeatherIcon,weatherWindProfile,weatherSeasonContextForData,weatherSeasonForData,seasonalParticleCount,weatherTestData,weatherEffectTestState,setWeatherEffectTestProfile,handleWeatherEffectTestModeChange,weatherEffectTestProfileChanged,stopWeatherEffectTest,previewWeatherTestFullScreen,weatherEffectRuntimeState,weatherEffectStatusText,applyWeatherEffects,refreshWeatherEffects,weatherOverlayNeedsRepair,ensureWeatherOverlayLive,weatherPauseClassSignature},{},{globalFunctions:['handleWeatherEffectTestModeChange','weatherEffectTestProfileChanged','stopWeatherEffectTest','previewWeatherTestFullScreen'],globalStates:[]});
