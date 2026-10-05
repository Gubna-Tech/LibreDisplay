import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const noop = () => {};
class DummyClassList { add(){} remove(){} toggle(){return false;} contains(){return false;} }
function dummyElement(){
  const target = {
    style:{setProperty(key,value){this[key]=String(value);},removeProperty(key){delete this[key];}}, classList:new DummyClassList(), dataset:{},
    children:[], childNodes:[], options:[], value:'', checked:false, textContent:'', innerHTML:'',
    hidden:false, disabled:false, files:[], offsetWidth:100, offsetHeight:100, clientWidth:100,
    clientHeight:100, scrollWidth:100, scrollHeight:100, offsetTop:0, offsetLeft:0,
    addEventListener:noop, removeEventListener:noop, setAttribute:noop, removeAttribute:noop,
    appendChild(value){return value;}, append:noop, prepend:noop, remove:noop, replaceChildren:noop,
    querySelector(){return dummyElement();}, querySelectorAll(){return [];}, closest(){return null;},
    getBoundingClientRect(){return {left:0,top:0,right:100,bottom:100,width:100,height:100,x:0,y:0};},
    scrollTo:noop, scrollIntoView:noop, focus:noop, blur:noop, click:noop,
    cloneNode(){return dummyElement();}, matches(){return false;}, contains(){return false;},
  };
  return new Proxy(target, {
    get(obj, key){ if(key in obj)return obj[key]; if(key===Symbol.iterator)return function*(){}; return noop; },
    set(obj, key, value){ obj[key]=value; return true; },
  });
}

const documentElement=dummyElement(), body=dummyElement();
globalThis.window=globalThis;
globalThis.Element=Object;
globalThis.Option=function(text,value){const el=dummyElement();el.text=String(text??'');el.value=String(value??'');return el;};
globalThis.addEventListener=noop;
globalThis.removeEventListener=noop;
globalThis.document={
  documentElement, body, readyState:'complete',
  getElementById(){return dummyElement();}, querySelector(){return dummyElement();}, querySelectorAll(){return [];},
  createElement(){return dummyElement();}, createTextNode(){return dummyElement();},
  addEventListener:noop, removeEventListener:noop,
};
Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'',href:'http://localhost/',origin:'http://localhost',reload:noop}});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{language:'en-US',userAgent:'node-smoke',hardwareConcurrency:8,deviceMemory:8,clipboard:{writeText:async()=>{}}}});
globalThis.localStorage={getItem(){return null;},setItem:noop,removeItem:noop,clear:noop};
globalThis.sessionStorage={getItem(){return null;},setItem:noop,removeItem:noop,clear:noop};
globalThis.CSS={escape:value=>String(value)};
globalThis.getComputedStyle=()=>new Proxy({fontSize:'16px',lineHeight:'20px',display:'block',visibility:'visible',opacity:'1',gridTemplateColumns:'100px',gridTemplateRows:'100px'}, {get:(obj,key)=>key in obj?obj[key]:''});
globalThis.ResizeObserver=class{observe(){} unobserve(){} disconnect(){}};
globalThis.MutationObserver=class{observe(){} disconnect(){}};
globalThis.IntersectionObserver=class{observe(){} disconnect(){}};
globalThis.requestAnimationFrame=()=>1;
globalThis.cancelAnimationFrame=noop;
globalThis.setInterval=()=>1;
globalThis.clearInterval=noop;
globalThis.setTimeout=()=>1;
globalThis.clearTimeout=noop;
globalThis.confirm=()=>false;
globalThis.prompt=()=>null;
globalThis.alert=noop;
globalThis.URL.createObjectURL=()=> 'blob:smoke';
globalThis.URL.revokeObjectURL=noop;
globalThis.fetch=async()=>({ok:false,status:503,text:async()=>'',json:async()=>({ok:false}),blob:async()=>new Blob(),headers:new Headers()});
globalThis.EventSource=class{addEventListener(){} close(){}};
globalThis.WebSocket=class{};
globalThis.screen={width:1920,height:1080};
globalThis.innerWidth=1920;
globalThis.innerHeight=1080;
globalThis.devicePixelRatio=1;

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const jsRoot=path.join(repoRoot,'app','js');
const dashboardCss=readFileSync(path.join(repoRoot,'app','css','dashboard.css'),'utf8');
const sourceOrder=[
  'core/runtime.js','core/bootstrap.js','core/shared.js','integrations/index.js','core/config.js','core/performance.js',
  'weather/effects.js','weather/index.js','weather/alerts.js',
  'calendar/ics-parser.js','calendar/recurrence.js','calendar/index.js',
  'backgrounds/google-photos.js','backgrounds/media.js','backgrounds/index.js','blocks/index.js',
  'layout/index.js','layout/remote.js','layout/persistence.js',
  'appearance/weather.js','appearance/index.js','appearance/presets.js','appearance/backup.js','remote/index.js',
  'system/index.js','system/profiles.js','onboarding/index.js',
  'settings/index.js','settings/navigation.js','settings/actions.js','settings/interactions.js','settings/accounts.js','lifecycle/index.js',
];
for(const relative of sourceOrder){
  try{ await import(pathToFileURL(path.join(jsRoot,relative)).href+'?module-smoke=1'); }
  catch(error){ console.error(`frontend module smoke failed while loading ${relative}`); throw error; }
}

const modules=LibreDisplayRuntime.finalizeModules();
const expected=['bootstrap','integrations','config','shared','performance','weather','calendar','backgrounds','blocks','layout','appearance','remote','system','onboarding','settings','lifecycle'];
for(const name of expected){
  if(!modules[name])throw new Error(`missing logical frontend module: ${name}`);
}
if(typeof modules.shared.uiCfg!=='function'||typeof modules.shared.fetchRemoteText!=='function')throw new Error('shared core module API did not load');
if(typeof modules.shared.escHtml!=='function'||typeof modules.shared.safeHttpUrl!=='function'||typeof modules.shared.normalizeHexColor!=='function')throw new Error('shared utility API did not load');
if(typeof modules.bootstrap.serverPath!=='function'||typeof modules.config.saveCfg!=='function')throw new Error('core module API did not retain bootstrap/config functions');
if(typeof globalThis.serverPath!=='undefined'||typeof globalThis.saveCfg!=='undefined'||typeof globalThis.ensureCfgDefaults!=='undefined')throw new Error('core functions leaked compatibility globals');
if(typeof globalThis.escHtml!=='undefined'||typeof globalThis.normalizeHexColor!=='undefined')throw new Error('shared utilities leaked compatibility globals');
if(!modules.config.cfg||typeof modules.config.cfg!=='object')throw new Error('module API did not expose config state descriptors');
if(typeof globalThis.uiCfg!=='undefined'||typeof globalThis.fetchRemoteText!=='undefined')throw new Error('shared core helpers leaked compatibility globals');
const savedConfigState=modules.config.cfg;
modules.config.cfg={...modules.config.CFG_DEFAULTS,onboardingComplete:false,backgroundMotionEnabled:null,photoPreload:false,weatherWidgetAnimations:false,weatherSeasonalEffects:false};modules.config.ensureCfgDefaults();
if(modules.config.cfg.backgroundMotionEnabled!==false||modules.config.cfg.photoPreload!==false||modules.config.cfg.weatherWidgetAnimations!==false||modules.config.cfg.weatherSeasonalEffects!==false)throw new Error('fresh-install lightweight defaults were not preserved');
modules.config.cfg={...modules.config.CFG_DEFAULTS,onboardingComplete:true,backgroundMotionEnabled:null,photoPreload:true,weatherWidgetAnimations:true,weatherSeasonalEffects:true};modules.config.ensureCfgDefaults();
if(modules.config.cfg.backgroundMotionEnabled!==true||modules.config.cfg.photoPreload!==true||modules.config.cfg.weatherWidgetAnimations!==true||modules.config.cfg.weatherSeasonalEffects!==true)throw new Error('existing-install visual choices were downgraded during migration');
modules.config.cfg=savedConfigState;
if(typeof modules.calendar.parseICS!=='function'||typeof modules.calendar.expandCalendarFeed!=='function')throw new Error('calendar parser API did not load');
if(typeof globalThis.parseICS!=='undefined'||typeof globalThis.expandCalendarFeed!=='undefined')throw new Error('calendar parser helpers leaked compatibility globals');
if(typeof modules.backgrounds.extractAllGooglePhotoUrls!=='function'||modules.backgrounds.GOOGLE_PHOTOS_MAX_ITEMS!==1000)throw new Error('background parser API/state did not load');
if(typeof modules.backgrounds.backgroundSourceFingerprint!=='function')throw new Error('background source fingerprint helper did not load');
if(typeof modules.backgrounds.backgroundMediaKind!=='function'||modules.backgrounds.backgroundMediaKind('/media?path=%2Fwallpapers%2Floop.mp4')!=='video'||modules.backgrounds.backgroundMediaKind('/media-mjpeg?path=%2Fwallpapers%2Fweather.mjpg')!=='mjpeg'||modules.backgrounds.backgroundMediaKind('/media?path=%2Fwallpapers%2Fstill.webp')!=='image')throw new Error('moving background media type detection failed');
if(typeof modules.backgrounds.backgroundMediaIsMotion!=='function'||!modules.backgrounds.backgroundMediaIsMotion('/media?path=%2Fwallpapers%2Floop.mp4')||!modules.backgrounds.backgroundMediaIsMotion('/media?path=%2Fwallpapers%2Floop.gif')||!modules.backgrounds.backgroundMediaIsMotion('/media-mjpeg?path=%2Fwallpapers%2Fweather.mjpg')||modules.backgrounds.backgroundMediaIsMotion('/media?path=%2Fwallpapers%2Fstill.webp'))throw new Error('background motion opt-in classification failed');
if(typeof modules.backgrounds.cacheableStillBackground!=='function'||!modules.backgrounds.cacheableStillBackground('/media?path=%2Fwallpapers%2Fstill.webp')||modules.backgrounds.cacheableStillBackground('/media?path=%2Fwallpapers%2Floop.gif')||modules.backgrounds.cacheableStillBackground('/media?path=%2Fwallpapers%2Floop.mp4')||modules.backgrounds.cacheableStillBackground('/media-mjpeg?path=%2Fwallpapers%2Fweather.mjpg'))throw new Error('offline background reserve did not stay still-image-only');
if(typeof modules.backgrounds.enforceBackgroundCacheBudget!=='function')throw new Error('secondary background cache budget enforcement did not load');
const bgKey=modules.backgrounds.backgroundSourceFingerprint;
if(bgKey({backgroundSource:'google',photosUrl:'album-a'})===bgKey({backgroundSource:'google',photosUrl:'album-b'}))throw new Error('Google background fingerprint did not distinguish source changes');
if(bgKey({backgroundSource:'folders',mediaRecursive:true,mediaFolders:['/b','/a']})!==bgKey({backgroundSource:'folders',mediaRecursive:true,mediaFolders:['/a','/b']}))throw new Error('folder background fingerprint should be order-insensitive');
if(bgKey({backgroundSource:'stock',stockCategory:'nature',stockQuery:'sunset',stockResolution:'1080p'})===bgKey({backgroundSource:'stock',stockCategory:'nature',stockQuery:'forest',stockResolution:'1080p'}))throw new Error('stock background fingerprint did not distinguish query changes');
if(typeof globalThis.extractAllGooglePhotoUrls!=='undefined'||typeof globalThis.GOOGLE_PHOTOS_MAX_ITEMS!=='undefined')throw new Error('background parser helpers leaked compatibility globals');
if(typeof modules.layout.saveLayoutEditor!=='function')throw new Error('split layout module lost saveLayoutEditor');
if(typeof modules.weather.fetchWeatherAlerts!=='function')throw new Error('split weather module lost fetchWeatherAlerts');
if(typeof modules.weather.weatherLocationKey!=='function'||typeof modules.weather.invalidateWeatherIfLocationChanged!=='function')throw new Error('weather location freshness API did not load');
const weatherKeyA=modules.weather.weatherLocationKey({lat:41.881832,lon:-87.623177,locationGeocodeId:1,locationTimezone:'America/Chicago'});
const weatherKeyB=modules.weather.weatherLocationKey({lat:39.739236,lon:-104.990251,locationGeocodeId:2,locationTimezone:'America/Denver'});
if(!weatherKeyA||weatherKeyA===weatherKeyB)throw new Error('weather location fingerprint did not distinguish saved locations');
if(!modules.weather.weatherPayloadMatchesRequest({latitude:41.9,longitude:-87.65},{lat:41.881832,lon:-87.623177})||modules.weather.weatherPayloadMatchesRequest({latitude:39.74,longitude:-104.99},{lat:41.881832,lon:-87.623177}))throw new Error('weather response location guard failed');
if(typeof modules.weatherEffects?.weatherGlyphEnabled!=='function')throw new Error('weather effects module did not load');
const northFall=modules.weatherEffects.weatherSeasonForData({latitude:41.88,current:{time:'2026-10-04T12:00:00'}},{weatherSeasonalEffects:true,weatherSeasonMode:'auto'});
const southSpring=modules.weatherEffects.weatherSeasonForData({latitude:-33.86,current:{time:'2026-10-04T12:00:00'}},{weatherSeasonalEffects:true,weatherSeasonMode:'auto'});
const usSummer=modules.weatherEffects.weatherSeasonForData({latitude:41.88,current:{time:'2026-07-04T12:00:00'}},{weatherSeasonalEffects:true,weatherSeasonMode:'auto'});
const ausWinter=modules.weatherEffects.weatherSeasonForData({latitude:-33.86,current:{time:'2026-07-04T12:00:00'}},{weatherSeasonalEffects:true,weatherSeasonMode:'auto'});
if(northFall!=='fall'||southSpring!=='spring'||usSummer!=='summer'||ausWinter!=='winter')throw new Error('automatic hemisphere-aware weather season detection failed');
const tropicalSeason=modules.weatherEffects.weatherSeasonContextForData({latitude:-12.46,current:{time:'2026-07-04T12:00:00',temperature_2m:27}},{weatherSeasonalEffects:true,weatherSeasonMode:'auto'});
const mildAusWinter=modules.weatherEffects.weatherSeasonContextForData({latitude:-27.47,current:{time:'2026-07-04T12:00:00',temperature_2m:18}},{weatherSeasonalEffects:true,weatherSeasonMode:'auto'});
if(tropicalSeason.season!=='none'||tropicalSeason.climateBand!=='tropical'||mildAusWinter.season!=='winter'||mildAusWinter.climateBand!=='subtropical'||!(mildAusWinter.scale<.4))throw new Error('regional seasonal adaptation failed');
const wildlifeSource={...modules.config.cfg,locationCountryCode:'US',lat:41.88,lon:-87.63,weatherSeasonalEffects:true,weatherSeasonMode:'summer',weatherSeasonalIntensity:100,weatherSeasonBees:true,weatherSeasonButterflies:true,weatherSeasonFireflies:true,weatherSeasonBirds:true,weatherSeasonBeeIntensity:100,weatherSeasonButterflyIntensity:100,weatherSeasonButterflyDiversity:100,weatherSeasonFireflyIntensity:100,weatherSeasonBirdIntensity:100,weatherSeasonBirdFlock:100,weatherSeasonBirdDiversity:100,weatherSeasonBirdRare:45};
const dayWildlife=modules.weatherEffects.weatherWildlifeProfile({latitude:41.88,current:{weather_code:0,temperature_2m:26,relative_humidity_2m:65,is_day:1,time:'2026-07-04T14:00:00'}},wildlifeSource,modules.weatherEffects.weatherSeasonContextForData({latitude:41.88,current:{time:'2026-07-04T14:00:00'}},wildlifeSource),'clear');
const nightWildlife=modules.weatherEffects.weatherWildlifeProfile({latitude:41.88,current:{weather_code:0,temperature_2m:24,relative_humidity_2m:72,is_day:0,time:'2026-07-04T22:00:00'}},wildlifeSource,modules.weatherEffects.weatherSeasonContextForData({latitude:41.88,current:{time:'2026-07-04T22:00:00'}},wildlifeSource),'clear');
if(!(dayWildlife.bees>0&&dayWildlife.butterflies>0&&dayWildlife.birds>0)||dayWildlife.fireflies!==0||!(nightWildlife.fireflies>0&&nightWildlife.birds>0)||nightWildlife.bees!==0||nightWildlife.butterflies!==0)throw new Error('season/region/daylight wildlife scheduling failed');
const defaultBirdCounts=modules.weatherEffects.seasonalEffectCounts('summer',{...wildlifeSource,weatherSeasonalIntensity:45,weatherSeasonBirdIntensity:55,weatherSeasonBirdFlock:60},true,{latitude:41.88,current:{weather_code:0,temperature_2m:26,relative_humidity_2m:65,is_day:1,time:'2026-07-04T14:00:00',wind_speed_10m:6}});
if(defaultBirdCounts.birds<2)throw new Error('eligible default daytime birds could scale down to an effectively invisible population');
const lightRainWildlife=modules.weatherEffects.weatherWildlifeWeatherFactors({current:{weather_code:53,precipitation:.6,wind_speed_10m:8}},'rain'),stormWildlife=modules.weatherEffects.weatherWildlifeWeatherFactors({current:{weather_code:95,precipitation:8,wind_speed_10m:25}},'storm');
if(!(lightRainWildlife.birds>0)||stormWildlife.birds!==0||stormWildlife.insects!==0)throw new Error('wildlife weather suppression was not severity aware');
if(!modules.weatherEffects.weatherIsDay({current:{is_day:1}})||modules.weatherEffects.weatherIsDay({current:{is_day:0}}))throw new Error('live is_day weather signal was not authoritative');
if(modules.weatherEffects.weatherEcologyRegion({latitude:41.88,longitude:-87.63},wildlifeSource)!=='north-america'||modules.weatherEffects.weatherEcologyRegion({latitude:-33.86,longitude:151.21},{...wildlifeSource,locationCountryCode:'AU'})!=='australasia')throw new Error('wildlife ecology region mapping failed');
const usBirdPool=modules.weatherEffects.birdSpeciesPool({latitude:41.88,longitude:-87.63,current:{is_day:1}},wildlifeSource,modules.weatherEffects.weatherSeasonContextForData({latitude:41.88,current:{time:'2026-07-04T14:00:00'}},wildlifeSource),true).map(v=>v[0]);
const inlandBirdPool=modules.weatherEffects.birdSpeciesPool({latitude:41.88,longitude:-87.63,current:{is_day:1}},{...wildlifeSource,weatherBirdHabitat:'auto'},modules.weatherEffects.weatherSeasonContextForData({latitude:41.88,current:{time:'2026-07-04T14:00:00'}},wildlifeSource),true).map(v=>v[0]);
const wetlandBirdPool=modules.weatherEffects.birdSpeciesPool({latitude:41.88,longitude:-87.63,current:{is_day:1}},{...wildlifeSource,weatherBirdHabitat:'wetland'},modules.weatherEffects.weatherSeasonContextForData({latitude:41.88,current:{time:'2026-07-04T14:00:00'}},wildlifeSource),true).map(v=>v[0]);
if(['egret','heron','crane','kingfisher','gull','pelican'].some(species=>inlandBirdPool.includes(species)))throw new Error('inland-safe automatic bird habitat leaked water specialists');
if(!['egret','heron','crane','kingfisher'].some(species=>wetlandBirdPool.includes(species)))throw new Error('wetland bird habitat did not add water-associated species');
if(new Set(inlandBirdPool).size<30)throw new Error('north-american inland bird pool is not diverse enough');
const usNightPool=modules.weatherEffects.birdSpeciesPool({latitude:41.88,longitude:-87.63,current:{is_day:0}},wildlifeSource,modules.weatherEffects.weatherSeasonContextForData({latitude:41.88,current:{time:'2026-07-04T22:00:00'}},wildlifeSource),false).map(v=>v[0]);
const usButterflyPool=modules.weatherEffects.butterflySpeciesPool({latitude:41.88,longitude:-87.63},wildlifeSource,modules.weatherEffects.weatherSeasonContextForData({latitude:41.88,current:{time:'2026-07-04T14:00:00'}},wildlifeSource)).map(v=>v[0]);
for(const species of ['sparrow','cardinal','blue-jay','goldfinch','hawk','eagle'])if(!usBirdPool.includes(species))throw new Error(`north-american bird pool missing ${species}`);if(usNightPool.includes('owl'))throw new Error('normal night bird pool leaked owl species');const usOwlPool=modules.weatherEffects.owlSpeciesPool({latitude:41.88,longitude:-87.63,current:{is_day:0}},wildlifeSource,modules.weatherEffects.weatherSeasonContextForData({latitude:41.88,current:{time:'2026-07-04T22:00:00'}},wildlifeSource),false).map(v=>v[0]);for(const species of ['great-horned-owl','barred-owl','barn-owl','burrowing-owl'])if(!usOwlPool.includes(species))throw new Error(`north-american owl pool missing ${species}`);for(const species of ['monarch','swallowtail','red-admiral','painted-lady'])if(!usButterflyPool.includes(species))throw new Error(`north-american butterfly pool missing ${species}`);

modules.weatherEffects.setWeatherEffectTestProfile('heavy-rain');
const forcedWeather=modules.weatherEffects.weatherTestData({latitude:41.88,current:{weather_code:0,temperature_2m:20}});
if(!modules.weatherEffects.weatherEffectTestState().active||forcedWeather.current.weather_code!==65)throw new Error('transient weather effect lab did not force the selected profile');
modules.weatherEffects.setWeatherEffectTestProfile('live');
if(modules.weatherEffects.weatherEffectTestState().active)throw new Error('weather effect lab did not return to live weather');
const liveHeavy=modules.weatherEffects.weatherEffectIntensityForData('rain',{current:{weather_code:65,precipitation:9,wind_speed_10m:35}},{weatherEffectIntensity:50,weatherEffectAutoIntensity:true});
const fixedHeavy=modules.weatherEffects.weatherEffectIntensityForData('rain',{current:{weather_code:65,precipitation:9,wind_speed_10m:35}},{weatherEffectIntensity:50,weatherEffectAutoIntensity:false});
if(!(liveHeavy>fixedHeavy)||fixedHeavy!==50)throw new Error('live weather auto-intensity contract failed');
const drizzleProfile=modules.weatherEffects.weatherPhenomenonProfile('rain',{current:{weather_code:53,precipitation:.5}}),heavyRainProfile=modules.weatherEffects.weatherPhenomenonProfile('rain',{current:{weather_code:65,precipitation:10}}),lightSnowProfile=modules.weatherEffects.weatherPhenomenonProfile('snow',{current:{weather_code:71,precipitation:.8}}),heavySnowProfile=modules.weatherEffects.weatherPhenomenonProfile('snow',{current:{weather_code:75,precipitation:9}});if(drizzleProfile.key!=='drizzle'||heavyRainProfile.key!=='heavy-rain'||!(heavyRainProfile.speed>drizzleProfile.speed)||lightSnowProfile.key!=='flurries'||heavySnowProfile.key!=='heavy-snow'||!(heavySnowProfile.drift>lightSnowProfile.drift))throw new Error('weather severity profiles did not distinguish rain/snow intensity');
const glyph=modules.weatherEffects.weatherGlyphEnabled;
if(!glyph('clear',{weatherEffectSun:true})||glyph('clear',{weatherEffectSun:false}))throw new Error('clear-weather glyph fallback contract failed');
if(!glyph('partly',{weatherEffectSun:false,weatherEffectClouds:true})||glyph('partly',{weatherEffectSun:false,weatherEffectClouds:false}))throw new Error('partly-cloudy glyph fallback contract failed');
if(!glyph('rain',{weatherEffectPrecipitation:true,weatherEffectClouds:false})||!glyph('rain',{weatherEffectPrecipitation:false,weatherEffectClouds:true})||glyph('rain',{weatherEffectPrecipitation:false,weatherEffectClouds:false}))throw new Error('rain glyph fallback contract failed');
if(!glyph('storm',{weatherEffectPrecipitation:false,weatherEffectClouds:false,weatherEffectLightning:true})||glyph('storm',{weatherEffectPrecipitation:false,weatherEffectClouds:false,weatherEffectLightning:false}))throw new Error('storm glyph fallback contract failed');
const allowed=modules.weatherEffects.effectAllowed;
if(!allowed('partly',{weatherEffectMode:'auto',weatherEffectSun:true,weatherEffectClouds:false})||!allowed('partly',{weatherEffectMode:'ambient',weatherEffectSun:false,weatherEffectClouds:true})||allowed('partly',{weatherEffectMode:'auto',weatherEffectSun:false,weatherEffectClouds:false}))throw new Error('partly-cloudy full-screen effect contract failed');
const animatedClear=modules.weatherEffects.weatherIconMarkup(0,'☀️',{weatherAnimationsEnabled:true,weatherWidgetAnimations:true,weatherEffectSun:true,weatherEffectRespectReducedMotion:false,weatherEffectPauseWhenDimmed:false});
const fallbackClear=modules.weatherEffects.weatherIconMarkup(0,'☀️',{weatherAnimationsEnabled:true,weatherWidgetAnimations:true,weatherEffectSun:false,weatherEffectRespectReducedMotion:false,weatherEffectPauseWhenDimmed:false});
if(!animatedClear.includes('ld-weather-glyph-active')||!animatedClear.includes('ld-weather-emoji-hidden')||fallbackClear.includes('ld-weather-glyph-active')||fallbackClear.includes('ld-weather-emoji-hidden'))throw new Error('new weather icon immediate fallback/animation state failed');
const savedWeatherPreview=window.__uiPreviewCfg;
window.__uiPreviewCfg={...modules.config.cfg,weatherAnimationsEnabled:true,weatherWidgetAnimations:true,weatherFullscreenEffects:true,weatherEffectMode:'auto',weatherEffectPrecipitation:true,weatherEffectClouds:true,weatherEffectRespectReducedMotion:false,weatherEffectPauseWhenDimmed:false};
try{
  const previewRainState=modules.weatherEffects.weatherEffectRuntimeState({current:{weather_code:61}});
  if(previewRainState.condition!=='rain'||!previewRainState.widgetOn||!previewRainState.fullOn)throw new Error('weather full-screen preview did not use the active preview configuration');
  const legacyRestartRainState=modules.weatherEffects.weatherEffectRuntimeState({current:{weather_code:63}},{...window.__uiPreviewCfg,weatherAnimationsEnabled:false,weatherFullscreenEffects:true});
  if(!legacyRestartRainState.fullOn||legacyRestartRainState.widgetOn)throw new Error('full-screen weather still depended on the legacy animation master after restart');
  const previewRainMarkup=modules.weatherEffects.weatherIconMarkup(61,'🌧️');
  if(!previewRainMarkup.includes('ld-weather-glyph-active'))throw new Error('weather icon preview did not use the active preview configuration');
}finally{window.__uiPreviewCfg=savedWeatherPreview;}
// Exercise the actual full-screen renderer against the exact legacy restart state that regressed on Pi.
const savedBirdMigration={...modules.config.cfg};modules.config.cfg={...modules.config.cfg,weatherSeasonBugs:false};delete modules.config.cfg.weatherSeasonBirds;modules.config.ensureCfgDefaults();if(modules.config.cfg.weatherSeasonBirds!==true)throw new Error('bird defaults incorrectly inherited the legacy summer-bugs toggle');modules.config.cfg=savedBirdMigration;
const savedCfgForOverlay={...modules.config.cfg};
modules.config.cfg={...modules.config.cfg,weatherAnimationsEnabled:false,weatherFullscreenEffects:true};
modules.config.ensureCfgDefaults();
if(!modules.config.cfg.weatherAnimationsEnabled)throw new Error('legacy full-screen overlay config was not normalized during startup');
modules.config.cfg=savedCfgForOverlay;
class StatefulClassList{
  constructor(){this.values=new Set();}
  add(...names){for(const name of names)this.values.add(name);}
  remove(...names){for(const name of names)this.values.delete(name);}
  toggle(name,force){const next=force===undefined?!this.values.has(name):!!force;if(next)this.values.add(name);else this.values.delete(name);return next;}
  contains(name){return this.values.has(name);}
}
const overlayHost=dummyElement();overlayHost.classList=new StatefulClassList();overlayHost.children=[];
overlayHost.replaceChildren=function(value){this.children=value?.children?[...value.children]:[];};
const originalCreateElement=document.createElement,originalCreateDocumentFragment=document.createDocumentFragment,originalOverlayGet=document.getElementById;
document.createElement=()=>{const el=dummyElement();el.classList=new StatefulClassList();return el;};
document.createDocumentFragment=()=>({children:[],appendChild(value){this.children.push(value);return value;}});
document.getElementById=id=>id==='weather-effects-overlay'?overlayHost:originalOverlayGet.call(document,id);
try{
  const restartSource={...modules.config.cfg,weatherAnimationsEnabled:false,weatherFullscreenEffects:true,weatherEffectMode:'auto',weatherEffectIntensity:60,weatherEffectOpacity:45,weatherEffectSpeed:100,weatherEffectAutoIntensity:false,weatherEffectAtmosphere:55,weatherEffectParticleScale:100,weatherEffectWindStrength:100,weatherEffectLightningFrequency:'normal',weatherEffectLightningBrightness:65,weatherEffectPrecipitation:true,weatherEffectClouds:true,weatherEffectFog:true,weatherEffectSun:true,weatherEffectWind:true,weatherEffectLightning:true,weatherEffectRespectReducedMotion:false,weatherEffectPauseWhenDimmed:false};
  const restartRain={current:{weather_code:63,precipitation:4,cloud_cover:100,wind_speed_10m:12,wind_direction_10m:220}};
  modules.weatherEffects.applyWeatherEffects(restartRain,restartSource);
  if(!overlayHost.classList.contains('show')||!overlayHost.classList.contains('weather-fx-rain')||overlayHost.children.length===0)throw new Error('full-screen rain overlay did not render from enabled legacy restart state');
  overlayHost.classList.remove('show');overlayHost.replaceChildren();
  if(!modules.weatherEffects.weatherOverlayNeedsRepair(restartRain,restartSource))throw new Error('weather overlay watchdog did not detect an enabled empty overlay');
  if(!modules.weatherEffects.ensureWeatherOverlayLive(restartRain,restartSource)||!overlayHost.classList.contains('show')||overlayHost.children.length===0)throw new Error('weather overlay watchdog did not rebuild rain particles');
  const fallSource={...restartSource,weatherSeasonalEffects:true,weatherSeasonMode:'fall',weatherSeasonalIntensity:80};
  modules.weatherEffects.applyWeatherEffects(restartRain,fallSource);
  if(!overlayHost.classList.contains('weather-season-fall')||!overlayHost.children.some(child=>child.classList.contains('weather-fx-leaf')))throw new Error('fall seasonal overlay did not render leaf particles');
  const fogSource={...restartSource,weatherEffectFog:true,weatherFogDensity:140,weatherFogSpeed:70,weatherSeasonalEffects:false};
  modules.weatherEffects.applyWeatherEffects({current:{weather_code:45,cloud_cover:100,wind_speed_10m:3,wind_direction_10m:90}},fogSource);
  if(!overlayHost.classList.contains('weather-fx-fog')||!overlayHost.children.some(child=>String(child.className||'').includes('weather-fx-primary'))||!overlayHost.children.some(child=>String(child.className||'').includes('weather-fx-fog-bank')))throw new Error('fog overlay did not render visible rolling full-screen mist banks');
  const stormSource={...restartSource,weatherEffectLightning:true,weatherSeasonalEffects:false};
  modules.weatherEffects.applyWeatherEffects({current:{weather_code:95,precipitation:8,cloud_cover:100,wind_speed_10m:25,wind_direction_10m:240}},stormSource);
  if(!overlayHost.classList.contains('weather-fx-lightning')||!overlayHost.children.some(child=>String(child.className||'').includes('weather-fx-lightning-bolt'))||!overlayHost.children.some(child=>String(child.className||'').includes('weather-fx-storm-cloud'))||!overlayHost.children.some(child=>String(child.className||'').includes('weather-fx-rain-sheet')))throw new Error('storm overlay did not render lightning plus storm cloud/rain-sheet atmosphere');
  const heavySnowSource={...restartSource,weatherSnowBlowing:true,weatherSeasonalEffects:false};modules.weatherEffects.applyWeatherEffects({current:{weather_code:75,precipitation:9,cloud_cover:100,wind_speed_10m:24,wind_direction_10m:260}},heavySnowSource);if(!overlayHost.classList.contains('weather-severity-heavy-snow')||!overlayHost.children.some(child=>String(child.className||'').includes('weather-fx-blowing-snow')))throw new Error('heavy snow did not render its distinct blowing-snow veil');
  const cloudSource={...restartSource,weatherSeasonalEffects:false,weatherCloudDensity:120,weatherCloudOpacity:100,weatherCloudSpeed:100,weatherCloudScale:100};modules.weatherEffects.applyWeatherEffects({current:{weather_code:3,cloud_cover:96,wind_speed_10m:13,wind_direction_10m:265}},cloudSource);if(!overlayHost.children.some(child=>String(child.className||'').includes('weather-fx-cloud-mass'))||!overlayHost.children.some(child=>String(child.className||'').includes('weather-fx-overcast-deck')))throw new Error('cloudy weather did not render defined cloud masses and overcast deck');
  const savedAlertsForHazards=modules.config.activeWeatherAlerts;modules.config.activeWeatherAlerts=[{event:'Tornado Warning',severity:'Extreme',headline:'Tornado warning in effect',description:'Take shelter now.'},{event:'Flash Flood Warning',severity:'Severe',headline:'Flash flooding expected',description:'Flooding of roads and low areas.'}];const hazardSource={...restartSource,weatherSeasonalEffects:false,weatherHazardEffects:true,weatherHazardIntensity:70,weatherHazardMinSeverity:'moderate',weatherHazardFlood:true,weatherHazardWind:true,weatherHazardTornado:true,weatherHazardTropical:true,weatherHazardStorm:true,weatherHazardWinter:true,weatherHazardVisibility:true,weatherHazardHeatFire:true};const hazards=modules.weatherEffects.weatherHazardAlerts(hazardSource);if(!hazards.some(h=>h.key==='tornado')||!hazards.some(h=>h.key==='flood'))throw new Error('active alerts were not classified into tornado/flood hazard scenery');modules.weatherEffects.applyWeatherEffects({current:{weather_code:63,precipitation:4,cloud_cover:100,wind_speed_10m:18,wind_direction_10m:220}},hazardSource);if(!overlayHost.children.some(child=>String(child.className||'').includes('weather-fx-hazard-tornado'))||!overlayHost.children.some(child=>String(child.className||'').includes('weather-fx-hazard-flood')))throw new Error('alert-driven tornado/flood scenery did not render');modules.config.activeWeatherAlerts=savedAlertsForHazards;
  const summerSource={...restartSource,...wildlifeSource,weatherFullscreenEffects:true,weatherEffectMode:'auto',weatherEffectSun:true,weatherEffectClouds:true,weatherEffectRespectReducedMotion:false};
  modules.weatherEffects.applyWeatherEffects({latitude:41.88,current:{weather_code:0,temperature_2m:27,relative_humidity_2m:60,is_day:1,time:'2026-07-04T14:00:00',cloud_cover:5,wind_speed_10m:5,wind_direction_10m:180}},summerSource);
  if(!overlayHost.children.some(child=>child.classList.contains('weather-fx-bee'))||!overlayHost.children.some(child=>child.classList.contains('weather-fx-butterfly'))||overlayHost.children.filter(child=>child.classList.contains('weather-fx-bird-temperate')).length<2||!overlayHost.children.some(child=>String(child.dataset?.species||'').length>0&&child.classList.contains('weather-fx-bird')))throw new Error('daytime regional summer wildlife did not render species-aware birds and butterflies');const visibleBirdSpecies=new Set(overlayHost.children.filter(child=>child.classList.contains('weather-fx-bird')&&!child.classList.contains('weather-fx-owl')).map(child=>child.dataset?.species).filter(Boolean));if(visibleBirdSpecies.size<2)throw new Error('high bird diversity still rendered only one visible species');
  const opacitySource={...summerSource,weatherSeasonBeeOpacity:25,weatherSeasonButterflyOpacity:35,weatherSeasonBirdOpacity:40};modules.weatherEffects.applyWeatherEffects({latitude:41.88,current:{weather_code:0,temperature_2m:27,relative_humidity_2m:60,is_day:1,time:'2026-07-04T14:00:00',cloud_cover:5,wind_speed_10m:5,wind_direction_10m:180}},opacitySource);const bee=overlayHost.children.find(child=>child.classList.contains('weather-fx-bee')),butterfly=overlayHost.children.find(child=>child.classList.contains('weather-fx-butterfly')),bird=overlayHost.children.find(child=>child.classList.contains('weather-fx-bird'));if(bee?.style?.['--season-opacity']!=='0.25'||butterfly?.style?.['--season-opacity']!=='0.35'||bird?.style?.['--season-opacity']!=='0.4')throw new Error('naturescape opacity controls did not reach rendered wildlife');
if(!dashboardCss.includes('#weather-effects-overlay.show{opacity:1}')||!dashboardCss.includes('.weather-fx-seasonal{opacity:var(--season-opacity,1)!important}')||dashboardCss.includes('filter:opacity(var(--season-opacity,1))')||dashboardCss.includes('#weather-effects-overlay .weather-fx-seasonal{animation:none!important;opacity:1!important}'))throw new Error('naturescape opacity is not authoritative across animation/static modes');
if(!dashboardCss.includes('.weather-fx-bird{')||!dashboardCss.includes('filter:drop-shadow(0 1px 1px rgba(255,255,255,.12))')||dashboardCss.includes('filter:opacity(var(--season-opacity,1)) drop-shadow'))throw new Error('bird opacity still competes with a filter-opacity multiplier');
  modules.weatherEffects.applyWeatherEffects({latitude:41.88,current:{weather_code:0,temperature_2m:24,relative_humidity_2m:72,is_day:0,time:'2026-07-04T22:00:00',cloud_cover:5,wind_speed_10m:4,wind_direction_10m:180}},summerSource);
  if(!overlayHost.children.some(child=>child.classList.contains('weather-fx-firefly'))||overlayHost.children.some(child=>child.classList.contains('weather-fx-bee'))||overlayHost.children.some(child=>child.classList.contains('weather-fx-owl')))throw new Error('owl mode leaked into the default-off nighttime scene');const owlSource={...summerSource,weatherSeasonOwls:true,weatherSeasonOwlIntensity:100,weatherSeasonOwlDiversity:100};modules.weatherEffects.applyWeatherEffects({latitude:41.88,current:{weather_code:0,temperature_2m:24,relative_humidity_2m:72,is_day:0,time:'2026-07-04T22:00:00',cloud_cover:5,wind_speed_10m:4,wind_direction_10m:180}},owlSource);if(!overlayHost.children.some(child=>child.classList.contains('weather-fx-owl')))throw new Error('enabled owl mode did not render owls');
  const realDateNow=Date.now,healthParticle={getAnimations(){return [{currentTime:100}]}};let fakeNow=100000;Date.now=()=>fakeNow;
  try{const healthSource={...restartSource,weatherRainDensity:101};modules.weatherEffects.applyWeatherEffects(restartRain,healthSource);overlayHost.querySelector=()=>healthParticle;fakeNow+=1000;if(!modules.weatherEffects.precipitationAnimationHealthy(overlayHost,modules.weatherEffects.weatherEffectRuntimeState(restartRain,healthSource)))throw new Error('healthy precipitation animation was rejected');fakeNow+=13000;if(modules.weatherEffects.precipitationAnimationHealthy(overlayHost,modules.weatherEffects.weatherEffectRuntimeState(restartRain,healthSource)))throw new Error('stalled precipitation animation was not detected');healthParticle.getAnimations=()=>[{currentTime:240}];fakeNow+=1000;if(!modules.weatherEffects.precipitationAnimationHealthy(overlayHost,modules.weatherEffects.weatherEffectRuntimeState(restartRain,healthSource)))throw new Error('precipitation heartbeat did not recover after animation progress');}finally{Date.now=realDateNow;overlayHost.querySelector=dummyElement().querySelector;}
  const coldSource={...restartSource,weatherSeasonalEffects:true,weatherSeasonMode:'winter',weatherColdFrost:true,weatherColdFrostIntensity:70};
  modules.weatherEffects.applyWeatherEffects({current:{weather_code:3,temperature_2m:-18,cloud_cover:90,wind_speed_10m:6}},coldSource);
  if(!overlayHost.children.some(child=>String(child.className||'').includes('weather-fx-edge-frost')))throw new Error('extreme-cold winter overlay did not render edge frost');
}finally{document.createElement=originalCreateElement;document.createDocumentFragment=originalCreateDocumentFragment;document.getElementById=originalOverlayGet;}
if(modules.weatherEffects.weatherPauseClassSignature('ld-weather-widget-motion ld-weather-fullscreen-motion')!=='000')throw new Error('weather effect self classes incorrectly trigger pause-state refreshes');
if(modules.weatherEffects.weatherPauseClassSignature('ld-burnin-dim')!=='100'||modules.weatherEffects.weatherPauseClassSignature('layout-editing')!=='010'||modules.weatherEffects.weatherPauseClassSignature('remote-layout-proxy')!=='001')throw new Error('weather pause-state class signature failed');
if(typeof modules.settings.loadLocalAccounts!=='function')throw new Error('split settings module lost loadLocalAccounts');
if(typeof modules.performance.startManagedInterval!=='function')throw new Error('performance module did not load');
if(typeof globalThis.frontendCapabilities!=='undefined')throw new Error('performance module leaked compatibility globals');
if(typeof globalThis.retryDisplayHydration!=='undefined')throw new Error('lifecycle module leaked compatibility globals');
if(typeof modules.appearance.screenCareQuietScheduleState!=='function')throw new Error('OLED quiet-hours schedule helper did not load');
const originalGetElementById=document.getElementById;
const resetElements=new Map();
for(const id of ['s-weather-animations','s-weather-widget-animations','s-weather-fullscreen-effects','s-weather-effect-auto-intensity','s-weather-effect-atmosphere','s-weather-effect-particle-scale','s-weather-effect-wind-strength','s-weather-effect-lightning-frequency','s-weather-effect-lightning-brightness','s-weather-effect-precipitation','s-weather-effect-clouds','s-weather-effect-fog','s-weather-effect-sun','s-weather-effect-wind','s-weather-effect-lightning','s-weather-effect-reduced-motion','s-weather-effect-pause-dimmed','s-weather-effect-mode','s-weather-effect-intensity','s-weather-effect-opacity','s-weather-effect-speed','s-weather-seasonal-effects','s-weather-season-mode','s-weather-seasonal-intensity','s-burnin-care-enabled','s-burnin-idle-dimming','s-burnin-quiet-hours','s-burnin-quiet-wake-enabled','s-burnin-pause-animations','s-burnin-pixel-shift','s-burnin-deep-protection','s-burnin-quiet-start','s-burnin-quiet-end','s-burnin-quiet-wake','s-burnin-idle','s-burnin-brightness','s-burnin-deep-trigger','s-burnin-deep-idle','s-burnin-deep-brightness','s-burnin-shift-mode','s-burnin-shift-interval','s-burnin-shift-distance','s-burnin-shift-transition','s-bg-opacity']){const el=dummyElement();el.id=id;resetElements.set(id,el);}
resetElements.get('s-bg-opacity').value='73';
document.getElementById=id=>resetElements.get(id)||originalGetElementById.call(document,id);
try{
  resetElements.get('s-weather-animations').checked=false;resetElements.get('s-weather-fullscreen-effects').checked=true;
  if(!modules.appearance.ensureWeatherAnimationMaster(resetElements.get('s-weather-fullscreen-effects'))||!resetElements.get('s-weather-animations').checked)throw new Error('full-screen weather enable did not activate weather animation master');
  modules.appearance.resetWeatherAnimationSettings();
  if(resetElements.get('s-bg-opacity').value!=='73')throw new Error('weather animation section reset changed an unrelated background setting');
  const d=modules.appearance.APPEARANCE_DEFAULTS;
  if(resetElements.get('s-weather-animations').checked!==!!d.weatherAnimationsEnabled||String(resetElements.get('s-weather-effect-mode').value)!==String(d.weatherEffectMode))throw new Error('weather animation section reset did not restore defaults');
  resetElements.get('s-bg-opacity').value='61';
  modules.appearance.resetDisplayCareSettings();
  if(resetElements.get('s-bg-opacity').value!=='61')throw new Error('display-care section reset changed an unrelated background setting');
  if(resetElements.get('s-burnin-pixel-shift').checked!==!!d.burnInPixelShift||String(resetElements.get('s-burnin-shift-mode').value)!==String(d.burnInShiftMode))throw new Error('display-care section reset did not restore defaults');
}finally{document.getElementById=originalGetElementById;}
const quietLate=modules.appearance.screenCareQuietScheduleState({burnInQuietStart:'22:00',burnInQuietEnd:'07:00'},new Date(2026,0,1,23,0));
const quietEarly=modules.appearance.screenCareQuietScheduleState({burnInQuietStart:'22:00',burnInQuietEnd:'07:00'},new Date(2026,0,2,6,0));
const quietDay=modules.appearance.screenCareQuietScheduleState({burnInQuietStart:'22:00',burnInQuietEnd:'07:00'},new Date(2026,0,2,12,0));
const quietDisabled=modules.appearance.screenCareQuietScheduleState({burnInQuietStart:'07:00',burnInQuietEnd:'07:00'},new Date(2026,0,2,7,0));
if(!quietLate.active||quietLate.elapsedMs!==60*60*1000)throw new Error('OLED quiet-hours schedule failed late-evening boundary');
if(!quietEarly.active||quietEarly.elapsedMs!==8*60*60*1000)throw new Error('OLED quiet-hours schedule failed overnight boundary');
if(quietDay.active||quietDisabled.active)throw new Error('OLED quiet-hours schedule failed daytime/equal-time boundary');
const bridge=LibreDisplayRuntime.describeBridge();
if(bridge.length>280)throw new Error(`compatibility bridge regressed to ${bridge.length} globals`);
const bridgeStateCount=bridge.filter(row=>row.kind==='state').length;
if(bridgeStateCount>10)throw new Error(`compatibility state bridge regressed to ${bridgeStateCount} bindings`);
for(const handler of ['editLocalAccount','deleteLocalAccount','weatherDetailDragStart','weatherDetailDrop','addIntegrationFromSettings','removeSceneRule','startReleaseRollback','selectLayoutPreset','runWizardHealthChecks']){
  if(typeof globalThis[handler]!=='function')throw new Error(`required generated UI handler missing from compatibility bridge: ${handler}`);
}
const bridgeFunctions=bridge.filter(row=>row.kind==='function').length,bridgeStates=bridge.filter(row=>row.kind==='state').length;
if(bridgeFunctions>271)throw new Error(`compatibility function bridge regressed to ${bridgeFunctions} bindings`);
for(const stateName of ['ACTIVE_ENDPOINT','SESSION_ROLE','wxData','calStatuses','displayEndpoints','systemHealthState','settingsPreviewMode']){
  if(typeof globalThis[stateName]!=='undefined')throw new Error(`migrated state leaked back onto compatibility bridge: ${stateName}`);
}
const recoveredErrors=[];
const originalConsoleError=console.error;
console.error=(...args)=>{recoveredErrors.push(args.map(String).join(' '));};
try{modules.settings.openSetup(false);}finally{console.error=originalConsoleError;}
if(recoveredErrors.some(line=>line.includes('settings initialization recovered')))throw new Error('Settings initialization entered recovery path: '+recoveredErrors.join(' | '));
modules.appearance.resetAppearanceForm();
const baseFetch=globalThis.fetch;
globalThis.fetch=async input=>{
  const url=String(input||'');
  const response=data=>({ok:true,status:200,text:async()=>JSON.stringify(data),json:async()=>data,blob:async()=>new Blob(),headers:new Headers()});
  if(url.includes('/api/endpoints'))return response({ok:true,endpoints:[{id:'main',name:'Main',configured:true,displayUrl:'http://localhost/display'}],remoteEnabled:true});
  if(url.includes('/api/devices'))return response({ok:true,devices:[]});
  if(url.includes('/api/config'))return response({ok:true,config:{...modules.config.cfg},savedAt:Number(modules.config.cfg?._savedAt||0)});
  return baseFetch(input);
};
try{
  await modules.remote.loadDisplayEndpoints();
  await modules.remote.pollServerConfig();
}finally{globalThis.fetch=baseFetch;}
await LibreDisplayRuntime.getModule('lifecycle').dashboardInitPromise;
process.stdout.write(`frontend module smoke: PASS (${sourceOrder.length} source files -> ${expected.length} logical modules; ${bridge.length} compatibility globals = ${bridgeFunctions} functions + ${bridgeStates} states)\n`);
