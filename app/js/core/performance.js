// Lightweight frontend scheduling and capability hints for lower-powered displays.
// Pi 4 remains the standard baseline. Automatic low-power behavior only activates
// when the browser reports both a small memory budget and a four-core-or-smaller CPU.

const managedIntervals=new Map();
const managedRuns=new Map();
let longTaskCount=0,longTaskTotalMs=0,longTaskMaxMs=0,longTaskObserverActive=false;

function frontendCapabilities(){
  const cores=Math.max(0,Number(navigator.hardwareConcurrency)||0);
  const memoryGB=Math.max(0,Number(navigator.deviceMemory)||0);
  const platform=String(navigator.userAgentData?.platform||navigator.platform||'');
  const ua=String(navigator.userAgent||'');
  const armLinux=/linux/i.test(`${platform} ${ua}`)&&/(arm|aarch64|armv7|armv8)/i.test(`${platform} ${ua}`);
  const lowMemoryFourCore=!!(cores&&cores<=4&&memoryGB&&memoryGB<=4);
  const piClass=!!(cores&&cores<=4&&armLinux);
  const constrained=piClass||lowMemoryFourCore;
  return {
    cores,
    memoryGB,
    platform,
    armLinux,
    piClass,
    constrained,
    tier:piClass?'pi4':constrained?'constrained':'standard',
    reason:piClass?'Four-core ARM/Linux display detected; Pi-class visual budgeting is active.':constrained?'Browser reports a four-core low-memory device.':'Standard frontend behavior.'
  };
}

function frontendPixelLoad(){
  const dpr=Math.max(.5,Number(globalThis.devicePixelRatio)||1),screenW=Math.max(Number(globalThis.innerWidth)||0,Number(globalThis.screen?.width)||0),screenH=Math.max(Number(globalThis.innerHeight)||0,Number(globalThis.screen?.height)||0),physicalWidth=Math.round(screenW*dpr),physicalHeight=Math.round(screenH*dpr),megapixels=physicalWidth*physicalHeight/1e6;
  return {physicalWidth,physicalHeight,megapixels,tier:megapixels>=7?'4k':megapixels>=3.2?'highres':'standard'};
}

function visualPerformanceBudget(){
  const caps=frontendCapabilities(),pixels=frontendPixelLoad();
  if(caps.piClass&&pixels.tier==='4k')return {tier:'pi4',resolutionTier:'4k',particleScale:.28,wildlifeScale:.36,holidayScale:.44,hazardScale:.55,cloudScale:.58,targetFrameMs:45,blurScale:.12};
  if(caps.piClass&&pixels.tier==='highres')return {tier:'pi4',resolutionTier:'highres',particleScale:.31,wildlifeScale:.39,holidayScale:.47,hazardScale:.58,cloudScale:.63,targetFrameMs:42,blurScale:.15};
  if(caps.piClass)return {tier:'pi4',resolutionTier:'standard',particleScale:.34,wildlifeScale:.42,holidayScale:.50,hazardScale:.62,cloudScale:.68,targetFrameMs:40,blurScale:.18};
  if(caps.constrained)return {tier:'constrained',resolutionTier:pixels.tier,particleScale:.50,wildlifeScale:.58,holidayScale:.66,hazardScale:.78,cloudScale:.82,targetFrameMs:30,blurScale:.42};
  return {tier:'standard',resolutionTier:pixels.tier,particleScale:1,wildlifeScale:1,holidayScale:1,hazardScale:1,cloudScale:1,targetFrameMs:16,blurScale:1};
}

function effectiveVisualConfig(source){
  if(!source||source.lightweightModeEnabled!==true)return source;
  return {...source,weatherAnimationsEnabled:false,weatherWidgetAnimations:false,weatherFullscreenEffects:false,weatherSeasonalEffects:false,weatherHazardEffects:false,backgroundMotionEnabled:false,photoPreload:false,bgBlurPx:0,bgTransitionSec:Math.min(.35,Math.max(0,Number(source.bgTransitionSec)||0))};
}

function lightweightModeSummary(source){
  return source?.lightweightModeEnabled===true?'Lightweight mode is ON — expensive visuals are paused without changing your saved visual settings.':'Lightweight mode is OFF — your saved visual settings run normally.';
}

function applyFrontendPerformanceClass(){
  const caps=frontendCapabilities();
  document.documentElement.dataset.performanceTier=caps.tier;
  document.documentElement.classList.toggle('ld-constrained-device',caps.constrained);
  return caps;
}

function runExclusiveTask(key,task){
  const name=String(key||'task');
  if(managedRuns.has(name))return managedRuns.get(name);
  const run=Promise.resolve().then(task);
  managedRuns.set(name,run);
  run.finally(()=>{if(managedRuns.get(name)===run)managedRuns.delete(name);}).catch(()=>{});
  return run;
}

function stopManagedInterval(key){
  const name=String(key||'');
  const entry=managedIntervals.get(name);
  if(entry?.timer)clearInterval(entry.timer);
  if(entry?.visibilityHandler)document.removeEventListener('visibilitychange',entry.visibilityHandler);
  managedIntervals.delete(name);
}

function startManagedInterval(key,task,intervalMs,options={}){
  const name=String(key||'task');
  stopManagedInterval(name);
  const ms=Math.max(1000,Number(intervalMs)||1000);
  const skipWhenHidden=options.skipWhenHidden!==false;
  const run=()=>{
    if(skipWhenHidden&&document.hidden)return Promise.resolve(undefined);
    return runExclusiveTask(name,task);
  };
  const entry={timer:setInterval(run,ms),visibilityHandler:null,intervalMs:ms};
  if(skipWhenHidden&&options.resumeOnVisible!==false){
    entry.visibilityHandler=()=>{if(!document.hidden)run();};
    document.addEventListener('visibilitychange',entry.visibilityHandler);
  }
  managedIntervals.set(name,entry);
  if(options.immediate)run();
  return entry.timer;
}

function runWhenIdle(task,timeout=1200){
  if(typeof requestIdleCallback==='function')return requestIdleCallback(()=>task(),{timeout:Math.max(100,Number(timeout)||1200)});
  return setTimeout(task,16);
}

function frontendPerformanceSnapshot(){
  const heap=performance?.memory?{
    usedBytes:Math.max(0,Number(performance.memory.usedJSHeapSize)||0),
    totalBytes:Math.max(0,Number(performance.memory.totalJSHeapSize)||0),
    limitBytes:Math.max(0,Number(performance.memory.jsHeapSizeLimit)||0)
  }:undefined;
  return {
    ...frontendCapabilities(),
    pixelLoad:frontendPixelLoad(),
    visualBudget:visualPerformanceBudget(),
    pageUptimeMs:Math.max(0,Math.round(Number(performance?.now?.())||0)),
    hidden:!!document.hidden,
    reducedMotion:document.documentElement.classList.contains('ld-reduce-motion'),
    activeIntervals:managedIntervals.size,
    activeExclusiveRuns:managedRuns.size,
    longTaskObserverActive,
    longTasks:{count:longTaskCount,totalMs:Math.round(longTaskTotalMs),maxMs:Math.round(longTaskMaxMs)},
    ...(heap?{heap}: {})
  };
}

function observeFrontendLongTasks(){
  if(typeof PerformanceObserver!=='function')return false;
  try{
    const observer=new PerformanceObserver(list=>{
      for(const entry of list.getEntries()){
        const duration=Math.max(0,Number(entry.duration)||0);
        longTaskCount++;longTaskTotalMs+=duration;longTaskMaxMs=Math.max(longTaskMaxMs,duration);
      }
    });
    observer.observe({type:'longtask',buffered:true});
    longTaskObserverActive=true;
    return true;
  }catch{return false;}
}

applyFrontendPerformanceClass();
observeFrontendLongTasks();

LibreDisplayRuntime.exposeModule('performance',{frontendCapabilities,frontendPixelLoad,visualPerformanceBudget,effectiveVisualConfig,lightweightModeSummary,applyFrontendPerformanceClass,runExclusiveTask,startManagedInterval,stopManagedInterval,runWhenIdle,frontendPerformanceSnapshot,observeFrontendLongTasks},{},{globals:false});
