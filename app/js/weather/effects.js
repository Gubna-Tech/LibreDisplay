// Optional vector weather motion and full-screen atmosphere effects.
const configApi=LibreDisplayRuntime.getModule('config');
const performanceApi=LibreDisplayRuntime.getModule('performance');
const {uiCfg}=LibreDisplayRuntime.getModule('shared');

let lastSignature='';

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

function particleCount(condition,intensity,constrained,source){
  if((condition==='rain'||condition==='snow'||condition==='storm')&&source.weatherEffectPrecipitation===false)return 0;
  if(condition==='cloud'&&source.weatherEffectClouds===false)return 0;
  if(condition==='partly')return 0;
  if(condition==='fog'&&source.weatherEffectFog===false)return 0;
  if(condition==='clear'&&source.weatherEffectSun===false)return 0;
  const base={rain:82,snow:54,storm:96,cloud:8,fog:7,clear:6}[condition]||0;
  const factor=Math.max(.1,Math.min(1,Number(intensity||50)/100));
  return Math.max(0,Math.round(base*factor*(constrained?.62:1)));
}
function effectPaused(source){
  if(!source?.weatherAnimationsEnabled)return true;
  if(source.weatherEffectRespectReducedMotion!==false&&document.documentElement.classList.contains('ld-reduce-motion'))return true;
  if(source.weatherEffectPauseWhenDimmed!==false&&document.body.classList.contains('ld-burnin-dim'))return true;
  if(document.body.classList.contains('layout-editing')||document.body.classList.contains('remote-layout-proxy')||globalThis.LAYOUT_PREVIEW_MODE)return true;
  return false;
}
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
function buildParticles(host,condition,count,source){
  const speed=Math.max(40,Math.min(180,Number(source.weatherEffectSpeed)||100))/100;
  const frag=document.createDocumentFragment();
  for(let i=0;i<count;i++){
    const p=document.createElement('span');p.className='weather-fx-particle';
    p.style.setProperty('--fx-x',`${(seededUnit(i,1)*106-3).toFixed(2)}vw`);
    p.style.setProperty('--fx-y',`${(seededUnit(i,6)*18-12).toFixed(2)}vh`);
    p.style.setProperty('--fx-delay',`${(-seededUnit(i,2)*16/speed).toFixed(2)}s`);
    const drift=source.weatherEffectWind===false?0:((seededUnit(i,3)-.5)*22);p.style.setProperty('--fx-drift',`${drift.toFixed(1)}vw`);
    if(condition==='rain'||condition==='storm')p.style.setProperty('--fx-duration',`${(.72+seededUnit(i,4)*.9)/speed}s`);
    else if(condition==='snow')p.style.setProperty('--fx-duration',`${(5+seededUnit(i,4)*7)/speed}s`);
    else p.style.setProperty('--fx-duration',`${(12+seededUnit(i,4)*18)/speed}s`);
    p.style.setProperty('--fx-scale',(0.55+seededUnit(i,5)*1.1).toFixed(2));
    frag.appendChild(p);
  }
  host.replaceChildren(frag);
}
function weatherEffectRuntimeState(data=configApi.wxData,source=null){
  source=weatherEffectSource(source);
  const condition=weatherEffectCondition(data?.current?.weather_code);
  const paused=effectPaused(source);
  return {
    source,condition,paused,
    widgetOn:!!source.weatherAnimationsEnabled&&!!source.weatherWidgetAnimations&&!paused,
    fullOn:!!source.weatherAnimationsEnabled&&!!source.weatherFullscreenEffects&&!paused&&effectAllowed(condition,source)
  };
}
function applyWeatherEffects(data=configApi.wxData,source=null){
  const host=document.getElementById('weather-effects-overlay');if(!host)return;
  const state=weatherEffectRuntimeState(data,source);source=state.source;
  const condition=state.condition;
  const constrained=performanceApi.frontendCapabilities().constrained;
  const paused=state.paused;
  const widgetOn=state.widgetOn;
  const fullOn=state.fullOn;
  document.body.classList.toggle('ld-weather-widget-motion',widgetOn);
  document.body.classList.toggle('ld-weather-fullscreen-motion',fullOn);
  document.body.classList.toggle('ld-weather-no-precip',source.weatherEffectPrecipitation===false);
  document.body.classList.toggle('ld-weather-no-clouds',source.weatherEffectClouds===false);
  document.body.classList.toggle('ld-weather-no-fog',source.weatherEffectFog===false);
  document.body.classList.toggle('ld-weather-no-sun',source.weatherEffectSun===false);
  document.body.classList.toggle('ld-weather-no-wind',source.weatherEffectWind===false);
  document.body.classList.toggle('ld-weather-no-lightning',source.weatherEffectLightning===false);
  syncWeatherGlyphVisibility(source,widgetOn);
  document.body.dataset.weatherCondition=condition;
  host.className='';
  host.classList.toggle('weather-fx-no-precip',source.weatherEffectPrecipitation===false);
  host.classList.toggle('weather-fx-no-clouds',source.weatherEffectClouds===false);
  host.classList.toggle('weather-fx-no-fog',source.weatherEffectFog===false);
  host.classList.toggle('weather-fx-no-sun',source.weatherEffectSun===false);
  host.classList.toggle('weather-fx-no-wind',source.weatherEffectWind===false);
  host.classList.toggle('weather-fx-no-lightning',source.weatherEffectLightning===false);
  host.style.setProperty('--weather-fx-opacity',String(Math.max(.05,Math.min(.8,Number(source.weatherEffectOpacity||34)/100))));
  host.style.setProperty('--weather-fx-speed',String(Math.max(.4,Math.min(1.8,Number(source.weatherEffectSpeed||100)/100))));
  if(!fullOn){lastSignature='';host.replaceChildren();return;}
  host.classList.add('show','weather-fx-'+condition);
  const count=particleCount(condition,source.weatherEffectIntensity,constrained,source);
  const signature=[condition,count,source.weatherEffectSpeed,source.weatherEffectOpacity,source.weatherEffectPrecipitation,source.weatherEffectClouds,source.weatherEffectFog,source.weatherEffectSun,source.weatherEffectWind,source.weatherEffectLightning,constrained].join('|');
  if(signature!==lastSignature){buildParticles(host,condition,count,source);lastSignature=signature;}
  host.classList.toggle('weather-fx-lightning',condition==='storm'&&source.weatherEffectLightning!==false);
  host.classList.toggle('weather-fx-no-wind',source.weatherEffectWind===false);
}
function refreshWeatherEffects(){applyWeatherEffects(configApi.wxData);}

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
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshWeatherEffects();});

LibreDisplayRuntime.exposeModule('weatherEffects',{weatherVisualCondition,weatherEffectCondition,weatherEffectSource,effectAllowed,weatherGlyphEnabled,syncWeatherGlyphVisibility,weatherIconMarkup,decorateWeatherIcon,weatherEffectRuntimeState,applyWeatherEffects,refreshWeatherEffects,weatherPauseClassSignature},{},{globals:false});
