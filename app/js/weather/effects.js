// Optional vector weather motion and full-screen atmosphere effects.
const configApi=LibreDisplayRuntime.getModule('config');
const performanceApi=LibreDisplayRuntime.getModule('performance');
const {uiCfg}=LibreDisplayRuntime.getModule('shared');

let lastSignature='';

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
  const base={rain:86,snow:58,storm:104,cloud:9,fog:8,clear:5}[condition]||0;
  const factor=wxClamp(Number(intensity)/100,.08,1.5,.5);
  const limit=constrained?92:170;
  return Math.max(0,Math.min(limit,Math.round(base*factor*(constrained?.64:1))));
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
function seededUnit(i,salt){
  const x=Math.sin((i+1)*12.9898+salt*78.233)*43758.5453;
  return x-Math.floor(x);
}
function precipitationMarkup(kind,count){
  const cls=kind==='snow'?'ld-wx-flake':'ld-wx-drop';
  return Array.from({length:count},(_,i)=>`<i class="${cls}" style="--i:${i}"></i>`).join('');
}
function weatherIconMarkup(code,fallback='',source=null){
  source=weatherEffectSource(source);
  const condition=weatherVisualCondition(code),safeFallback=String(fallback||'');
  const widgetOn=!!source?.weatherAnimationsEnabled&&!!source?.weatherWidgetAnimations&&!effectPaused(source);
  const glyphActive=widgetOn&&weatherGlyphEnabled(condition,source||{});
  const fallbackClass='ld-weather-emoji-fallback'+(glyphActive?' ld-weather-emoji-hidden':'');
  const glyphClass='ld-weather-glyph ld-weather-'+condition+(glyphActive?' ld-weather-glyph-active':'');
  const sun=['clear','partly'].includes(condition)?'<span class="ld-wx-sun"><i></i></span>':'';
  const cloud=['partly','cloud','rain','snow','storm'].includes(condition)?'<span class="ld-wx-cloud"><i></i><b></b></span>':'';
  const rain=['rain','storm'].includes(condition)?`<span class="ld-wx-precip ld-wx-rain">${precipitationMarkup('rain',5)}</span>`:'';
  const snow=condition==='snow'?`<span class="ld-wx-precip ld-wx-snow">${precipitationMarkup('snow',6)}</span>`:'';
  const bolt=condition==='storm'?'<span class="ld-wx-bolt"></span>':'';
  const fog=condition==='fog'?'<span class="ld-wx-fog"><i></i><i></i><i></i></span>':'';
  const unknown=condition==='none'?'<span class="ld-wx-unknown">•</span>':'';
  return `<span class="${fallbackClass}">${safeFallback}</span><span class="${glyphClass}" data-weather-visual="${condition}" aria-hidden="true">${sun}${cloud}${rain}${snow}${bolt}${fog}${unknown}</span>`;
}
function decorateWeatherIcon(el,code,fallback='',source=null){
  if(!el)return;
  const signature=`${Number(code)}|${String(fallback||'')}`;
  if(el.dataset.weatherGlyphSignature===signature)return;
  el.dataset.weatherCode=String(Number(code));
  el.dataset.weatherGlyphSignature=signature;
  el.innerHTML=weatherIconMarkup(code,fallback,source);
}
function weatherWindProfile(data,source){
  if(source.weatherEffectWind===false)return {strength:0,direction:1};
  const current=data?.current||{},configured=wxClamp(source.weatherEffectWindStrength,0,180,100)/100,live=Number(current.wind_speed_10m),degrees=Number(current.wind_direction_10m);
  const liveBoost=source.weatherEffectAutoIntensity===false||!Number.isFinite(live)?1:wxClamp(.65+live/38,.65,1.7,1);
  const direction=Number.isFinite(degrees)&&Math.sin(degrees*Math.PI/180)<-.05?-1:1;
  return {strength:wxClamp(configured*liveBoost,0,2.4,configured),direction};
}
function buildParticles(host,condition,count,source,data){
  const speed=wxClamp(source.weatherEffectSpeed,40,180,100)/100,particleScale=wxClamp(source.weatherEffectParticleScale,60,160,100)/100,wind=weatherWindProfile(data,source),frag=document.createDocumentFragment();
  for(let i=0;i<count;i++){
    const p=document.createElement('span'),depth=.28+seededUnit(i,7)*.72;p.className='weather-fx-particle';
    p.style.setProperty('--fx-x',`${(seededUnit(i,1)*106-3).toFixed(2)}vw`);
    p.style.setProperty('--fx-y',`${(seededUnit(i,6)*18-12).toFixed(2)}vh`);
    p.style.setProperty('--fx-static-y',`${(seededUnit(i,8)*108-4).toFixed(2)}vh`);
    p.style.setProperty('--fx-delay',`${(-seededUnit(i,2)*16/speed).toFixed(2)}s`);
    const drift=wind.strength?(wind.direction*(.5+seededUnit(i,3))*(6+18*depth)*wind.strength):0;p.style.setProperty('--fx-drift',`${drift.toFixed(1)}vw`);
    if(condition==='rain'||condition==='storm')p.style.setProperty('--fx-duration',`${((.66+seededUnit(i,4)*.86)/(speed*(.82+depth*.35))).toFixed(2)}s`);
    else if(condition==='snow')p.style.setProperty('--fx-duration',`${((5+seededUnit(i,4)*7)/(speed*(.8+depth*.32))).toFixed(2)}s`);
    else p.style.setProperty('--fx-duration',`${((12+seededUnit(i,4)*18)/(speed*Math.max(.45,.78+wind.strength*.18))).toFixed(2)}s`);
    p.style.setProperty('--fx-depth',depth.toFixed(2));
    p.style.setProperty('--fx-scale',((.55+seededUnit(i,5)*1.05)*particleScale*(.82+depth*.32)).toFixed(2));
    frag.appendChild(p);
  }
  host.replaceChildren(frag);
}
function weatherEffectRuntimeState(data=configApi.wxData,source=null){
  source=weatherEffectSource(source);
  const condition=weatherEffectCondition(data?.current?.weather_code),widgetPauseReason=effectPauseReason(source),pauseReason=fullscreenPauseReason(source),allowed=effectAllowed(condition,source),effectiveIntensity=weatherEffectIntensityForData(condition,data,source),reducedMotion=weatherReducedMotionActive(source);
  return {
    source,condition,pauseReason,widgetPauseReason,paused:!!pauseReason,allowed,effectiveIntensity,reducedMotion,
    widgetOn:!!source.weatherAnimationsEnabled&&!!source.weatherWidgetAnimations&&!widgetPauseReason,
    fullOn:!!source.weatherFullscreenEffects&&!pauseReason&&allowed
  };
}
function weatherEffectStatusText(state,data=configApi.wxData){
  const label={storm:'Thunderstorm',snow:'Snow',rain:'Rain',fog:'Fog',partly:'Partly cloudy',cloud:'Clouds',clear:'Clear sky',none:'Unknown weather'}[state.condition]||'Weather';
  if(!data?.current)return 'Waiting for current weather data.';
  if(!state.source.weatherFullscreenEffects)return `${label} detected · full-screen overlay is off.`;
  if(state.pauseReason==='display-dimmed')return `${label} detected · overlay paused while display protection is dimmed.`;
  if(state.pauseReason==='layout-preview')return `${label} detected · overlay paused during layout editing.`;
  if(!state.allowed)return `${label} detected · current overlay mode/effect switches exclude this condition.`;
  if(state.reducedMotion)return `${label} overlay active · reduced-motion static mode · ${Math.round(state.effectiveIntensity)}% effective intensity.`;
  return `${label} overlay active · ${Math.round(state.effectiveIntensity)}% effective intensity.`;
}
function updateWeatherEffectStatus(state,data=configApi.wxData){const el=document.getElementById('weather-effect-live-status');if(el)el.textContent=weatherEffectStatusText(state,data);}
function applyWeatherEffects(data=configApi.wxData,source=null){
  const host=document.getElementById('weather-effects-overlay');if(!host)return;
  const state=weatherEffectRuntimeState(data,source);source=state.source;
  const condition=state.condition,constrained=performanceApi.frontendCapabilities().constrained,widgetOn=state.widgetOn,fullOn=state.fullOn;
  document.body.classList.toggle('ld-weather-widget-motion',widgetOn);
  document.body.classList.toggle('ld-weather-fullscreen-motion',fullOn);
  document.body.classList.toggle('ld-weather-no-precip',source.weatherEffectPrecipitation===false);
  document.body.classList.toggle('ld-weather-no-clouds',source.weatherEffectClouds===false);
  document.body.classList.toggle('ld-weather-no-fog',source.weatherEffectFog===false);
  document.body.classList.toggle('ld-weather-no-sun',source.weatherEffectSun===false);
  document.body.classList.toggle('ld-weather-no-wind',source.weatherEffectWind===false);
  document.body.classList.toggle('ld-weather-no-lightning',source.weatherEffectLightning===false);
  document.body.classList.toggle('ld-weather-respect-reduced-motion',source.weatherEffectRespectReducedMotion!==false);
  document.body.classList.toggle('ld-weather-pause-dimmed',source.weatherEffectPauseWhenDimmed!==false);
  syncWeatherGlyphVisibility(source,widgetOn);
  document.body.dataset.weatherCondition=condition;
  host.className='';
  host.classList.toggle('weather-fx-no-precip',source.weatherEffectPrecipitation===false);
  host.classList.toggle('weather-fx-no-clouds',source.weatherEffectClouds===false);
  host.classList.toggle('weather-fx-no-fog',source.weatherEffectFog===false);
  host.classList.toggle('weather-fx-no-sun',source.weatherEffectSun===false);
  host.classList.toggle('weather-fx-no-wind',source.weatherEffectWind===false);
  host.classList.toggle('weather-fx-no-lightning',source.weatherEffectLightning===false);
  const wind=weatherWindProfile(data,source),lightningSeconds={rare:16,normal:10,frequent:6}[source.weatherEffectLightningFrequency]||10;
  host.classList.toggle('weather-fx-wind-reverse',wind.direction<0);
  host.classList.toggle('weather-fx-static',state.reducedMotion);
  host.style.setProperty('--weather-fx-opacity',String(wxClamp(source.weatherEffectOpacity,5,80,34)/100));
  host.style.setProperty('--weather-fx-speed',String(wxClamp(source.weatherEffectSpeed,40,180,100)/100));
  host.style.setProperty('--weather-fx-atmosphere',String(wxClamp(source.weatherEffectAtmosphere,0,100,55)/100));
  host.style.setProperty('--weather-fx-lightning-alpha',String(wxClamp(source.weatherEffectLightningBrightness,20,100,65)/100));
  host.style.setProperty('--weather-fx-lightning-duration',`${lightningSeconds}s`);
  updateWeatherEffectStatus(state,data);
  if(!fullOn){lastSignature='';host.replaceChildren();return;}
  host.classList.add('show','weather-fx-'+condition);
  const count=particleCount(condition,state.effectiveIntensity,constrained,source);
  const signature=[condition,count,source.weatherEffectSpeed,source.weatherEffectOpacity,source.weatherEffectAtmosphere,source.weatherEffectParticleScale,source.weatherEffectWindStrength,source.weatherEffectAutoIntensity,source.weatherEffectPrecipitation,source.weatherEffectClouds,source.weatherEffectFog,source.weatherEffectSun,source.weatherEffectWind,source.weatherEffectLightning,source.weatherEffectLightningFrequency,source.weatherEffectLightningBrightness,wind.direction,Math.round(wind.strength*100),constrained].join('|');
  if(signature!==lastSignature){buildParticles(host,condition,count,source,data);lastSignature=signature;}
  host.classList.toggle('weather-fx-lightning',condition==='storm'&&source.weatherEffectLightning!==false);
}
function refreshWeatherEffects(){applyWeatherEffects(configApi.wxData);}
function weatherOverlayNeedsRepair(data=configApi.wxData,source=null){
  const host=document.getElementById('weather-effects-overlay');if(!host)return false;
  const state=weatherEffectRuntimeState(data,source);if(!state.fullOn)return false;
  const expectedClass='weather-fx-'+state.condition,count=particleCount(state.condition,state.effectiveIntensity,performanceApi.frontendCapabilities().constrained,state.source);
  return !host.classList.contains('show')||!host.classList.contains(expectedClass)||(count>0&&host.children.length===0);
}
function ensureWeatherOverlayLive(data=configApi.wxData,source=null){if(!weatherOverlayNeedsRepair(data,source))return false;lastSignature='';applyWeatherEffects(data,source);return true;}

function weatherPauseClassSignature(value=document.body.className){
  const names=new Set(String(value||'').split(/\s+/).filter(Boolean));
  return ['ld-burnin-dim','layout-editing','remote-layout-proxy'].map(name=>names.has(name)?'1':'0').join('');
}
const observer=new MutationObserver(records=>{
  if(!configApi.wxData)return;
  const current=weatherPauseClassSignature();
  if(records.some(record=>weatherPauseClassSignature(record.oldValue)!==current))refreshWeatherEffects();
});
observer.observe(document.body,{attributes:true,attributeFilter:['class'],attributeOldValue:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshWeatherEffects();ensureWeatherOverlayLive();}});
setInterval(()=>ensureWeatherOverlayLive(),2500);

LibreDisplayRuntime.exposeModule('weatherEffects',{weatherVisualCondition,weatherEffectCondition,weatherEffectSource,effectAllowed,weatherGlyphEnabled,syncWeatherGlyphVisibility,liveIntensityMultiplier,weatherEffectIntensityForData,particleCount,weatherReducedMotionActive,fullscreenPauseReason,effectPauseReason,weatherIconMarkup,decorateWeatherIcon,weatherWindProfile,weatherEffectRuntimeState,weatherEffectStatusText,applyWeatherEffects,refreshWeatherEffects,weatherOverlayNeedsRepair,ensureWeatherOverlayLive,weatherPauseClassSignature},{},{globals:false});
