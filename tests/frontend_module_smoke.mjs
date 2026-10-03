import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const noop = () => {};
class DummyClassList { add(){} remove(){} toggle(){return false;} contains(){return false;} }
function dummyElement(){
  const target = {
    style:{setProperty:noop,removeProperty:noop}, classList:new DummyClassList(), dataset:{},
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
const sourceOrder=[
  'core/runtime.js','core/bootstrap.js','core/shared.js','integrations/index.js','core/config.js','core/performance.js',
  'weather/index.js','weather/alerts.js',
  'calendar/ics-parser.js','calendar/recurrence.js','calendar/index.js',
  'backgrounds/google-photos.js','backgrounds/index.js','blocks/index.js',
  'layout/index.js','layout/remote.js','layout/persistence.js',
  'appearance/index.js','appearance/presets.js','appearance/backup.js','remote/index.js',
  'system/index.js','system/profiles.js','onboarding/index.js',
  'settings/index.js','settings/navigation.js','settings/actions.js','settings/interactions.js','settings/accounts.js',
];
for(const relative of sourceOrder){
  try{ await import(pathToFileURL(path.join(jsRoot,relative)).href+'?module-smoke=1'); }
  catch(error){ console.error(`frontend module smoke failed while loading ${relative}`); throw error; }
}

const modules=LibreDisplayRuntime.finalizeModules();
const expected=['bootstrap','integrations','config','shared','performance','weather','calendar','backgrounds','blocks','layout','appearance','remote','system','onboarding','settings'];
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
if(typeof modules.calendar.parseICS!=='function'||typeof modules.calendar.expandCalendarFeed!=='function')throw new Error('calendar parser API did not load');
if(typeof globalThis.parseICS!=='undefined'||typeof globalThis.expandCalendarFeed!=='undefined')throw new Error('calendar parser helpers leaked compatibility globals');
if(typeof modules.backgrounds.extractAllGooglePhotoUrls!=='function'||modules.backgrounds.GOOGLE_PHOTOS_MAX_ITEMS!==1000)throw new Error('background parser API/state did not load');
if(typeof globalThis.extractAllGooglePhotoUrls!=='undefined'||typeof globalThis.GOOGLE_PHOTOS_MAX_ITEMS!=='undefined')throw new Error('background parser helpers leaked compatibility globals');
if(typeof modules.layout.saveLayoutEditor!=='function')throw new Error('split layout module lost saveLayoutEditor');
if(typeof modules.weather.fetchWeatherAlerts!=='function')throw new Error('split weather module lost fetchWeatherAlerts');
if(typeof modules.settings.loadLocalAccounts!=='function')throw new Error('split settings module lost loadLocalAccounts');
if(typeof modules.performance.startManagedInterval!=='function')throw new Error('performance module did not load');
if(typeof globalThis.frontendCapabilities!=='undefined')throw new Error('performance module leaked compatibility globals');
if(typeof globalThis.retryDisplayHydration!=='undefined')throw new Error('lifecycle module leaked compatibility globals');
const bridge=LibreDisplayRuntime.describeBridge();
if(bridge.length>270)throw new Error(`compatibility bridge regressed to ${bridge.length} globals`);
const bridgeStateCount=bridge.filter(row=>row.kind==='state').length;
if(bridgeStateCount>10)throw new Error(`compatibility state bridge regressed to ${bridgeStateCount} bindings`);
for(const handler of ['editLocalAccount','deleteLocalAccount','weatherDetailDragStart','weatherDetailDrop','addIntegrationFromSettings','removeSceneRule','startReleaseRollback','selectLayoutPreset','runWizardHealthChecks']){
  if(typeof globalThis[handler]!=='function')throw new Error(`required generated UI handler missing from compatibility bridge: ${handler}`);
}
const bridgeFunctions=bridge.filter(row=>row.kind==='function').length,bridgeStates=bridge.filter(row=>row.kind==='state').length;
if(bridgeFunctions>260)throw new Error(`compatibility function bridge regressed to ${bridgeFunctions} bindings`);
for(const stateName of ['ACTIVE_ENDPOINT','SESSION_ROLE','wxData','calStatuses','displayEndpoints','systemHealthState','settingsPreviewMode']){
  if(typeof globalThis[stateName]!=='undefined')throw new Error(`migrated state leaked back onto compatibility bridge: ${stateName}`);
}
process.stdout.write(`frontend module smoke: PASS (${sourceOrder.length} source files -> ${expected.length} logical modules; ${bridge.length} compatibility globals = ${bridgeFunctions} functions + ${bridgeStates} states)\n`);
