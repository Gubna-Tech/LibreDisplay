// Optional weather motion and full-screen atmosphere effects.
const configApi=LibreDisplayRuntime.getModule('config');
const performanceApi=LibreDisplayRuntime.getModule('performance');

let lastSignature='';

function weatherEffectCondition(code){
  const c=Number(code);
  if([95,96,99].includes(c))return 'storm';
  if([71,73,75,77,85,86].includes(c))return 'snow';
  if([51,53,55,61,63,65,80,81,82].includes(c))return 'rain';
  if([45,48].includes(c))return 'fog';
  if([2,3].includes(c))return 'cloud';
  if([0,1].includes(c))return 'clear';
  return 'none';
}
function effectAllowed(condition,source){
  const mode=source.weatherEffectMode||'auto';
  if(mode==='precipitation')return ['rain','snow','storm'].includes(condition);
  if(mode==='ambient')return ['clear','cloud','fog'].includes(condition);
  return condition!=='none';
}
function particleCount(condition,intensity,constrained){
  const base={rain:64,snow:42,storm:72,cloud:7,fog:6,clear:5}[condition]||0;
  const factor=Math.max(.1,Math.min(1,Number(intensity||50)/100));
  return Math.max(0,Math.round(base*factor*(constrained?.6:1)));
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
function buildParticles(host,condition,count,source){
  const speed=Math.max(40,Math.min(180,Number(source.weatherEffectSpeed)||100))/100;
  const frag=document.createDocumentFragment();
  for(let i=0;i<count;i++){
    const p=document.createElement('span');p.className='weather-fx-particle';
    p.style.setProperty('--fx-x',`${(seededUnit(i,1)*100).toFixed(2)}vw`);
    p.style.setProperty('--fx-delay',`${(-seededUnit(i,2)*12/speed).toFixed(2)}s`);
    p.style.setProperty('--fx-drift',`${((seededUnit(i,3)-.5)*18).toFixed(1)}vw`);
    if(condition==='rain'||condition==='storm')p.style.setProperty('--fx-duration',`${(.7+seededUnit(i,4)*.9)/speed}s`);
    else if(condition==='snow')p.style.setProperty('--fx-duration',`${(5+seededUnit(i,4)*7)/speed}s`);
    else p.style.setProperty('--fx-duration',`${(12+seededUnit(i,4)*15)/speed}s`);
    p.style.setProperty('--fx-scale',(0.55+seededUnit(i,5)*1.05).toFixed(2));
    frag.appendChild(p);
  }
  host.replaceChildren(frag);
}
function applyWeatherEffects(data=configApi.wxData,source=cfg){
  const host=document.getElementById('weather-effects-overlay');if(!host)return;
  const condition=weatherEffectCondition(data?.current?.weather_code);
  const constrained=performanceApi.frontendCapabilities().constrained;
  const paused=effectPaused(source);
  const widgetOn=!!source.weatherAnimationsEnabled&&!!source.weatherWidgetAnimations&&!paused;
  const fullOn=!!source.weatherAnimationsEnabled&&!!source.weatherFullscreenEffects&&!paused&&effectAllowed(condition,source);
  document.body.classList.toggle('ld-weather-widget-motion',widgetOn);
  document.body.dataset.weatherCondition=condition;
  host.className='';host.style.setProperty('--weather-fx-opacity',String(Math.max(.05,Math.min(.8,Number(source.weatherEffectOpacity||34)/100))));
  host.style.setProperty('--weather-fx-speed',String(Math.max(.4,Math.min(1.8,Number(source.weatherEffectSpeed||100)/100))));
  if(!fullOn){lastSignature='';host.replaceChildren();return;}
  host.classList.add('show','weather-fx-'+condition);
  const count=particleCount(condition,source.weatherEffectIntensity,constrained);
  const signature=[condition,count,source.weatherEffectSpeed,source.weatherEffectOpacity,source.weatherEffectLightning,constrained].join('|');
  if(signature!==lastSignature){buildParticles(host,condition,count,source);lastSignature=signature;}
  host.classList.toggle('weather-fx-lightning',condition==='storm'&&source.weatherEffectLightning!==false);
}
function refreshWeatherEffects(){applyWeatherEffects(configApi.wxData,cfg);}

const observer=new MutationObserver(()=>{if(configApi.wxData)refreshWeatherEffects();});
observer.observe(document.body,{attributes:true,attributeFilter:['class']});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshWeatherEffects();});

LibreDisplayRuntime.exposeModule('weatherEffects',{weatherEffectCondition,effectAllowed,applyWeatherEffects,refreshWeatherEffects},{},{globals:false});
