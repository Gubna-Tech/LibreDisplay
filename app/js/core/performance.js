// Lightweight frontend scheduling and capability hints for lower-powered displays.
// Pi-class budgeting is keyed to four-core ARM/Linux displays. The separate low-memory
// fallback covers other four-core-or-smaller devices without assuming Raspberry Pi hardware.

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
  if(caps.piClass&&pixels.tier==='4k')return {tier:'pi4',resolutionTier:'4k',particleScale:.14,wildlifeScale:.22,holidayScale:.27,hazardScale:.33,cloudScale:.34,targetFrameMs:24,blurScale:0,maxParticles:18,maxFogBanks:2,maxClouds:4,secondaryScale:.36};
  if(caps.piClass&&pixels.tier==='highres')return {tier:'pi4',resolutionTier:'highres',particleScale:.18,wildlifeScale:.26,holidayScale:.31,hazardScale:.39,cloudScale:.40,targetFrameMs:16,blurScale:0,maxParticles:24,maxFogBanks:2,maxClouds:5,secondaryScale:.44};
  if(caps.piClass)return {tier:'pi4',resolutionTier:'standard',particleScale:.22,wildlifeScale:.30,holidayScale:.36,hazardScale:.45,cloudScale:.46,targetFrameMs:16,blurScale:0,maxParticles:30,maxFogBanks:2,maxClouds:6,secondaryScale:.52};
  if(caps.constrained)return {tier:'constrained',resolutionTier:pixels.tier,particleScale:.46,wildlifeScale:.54,holidayScale:.62,hazardScale:.72,cloudScale:.76,targetFrameMs:24,blurScale:.30,maxParticles:56,maxFogBanks:3,maxClouds:9,secondaryScale:.72};
  return {tier:'standard',resolutionTier:pixels.tier,particleScale:1,wildlifeScale:1,holidayScale:1,hazardScale:1,cloudScale:1,targetFrameMs:16,blurScale:1,maxParticles:240,maxFogBanks:8,maxClouds:20,secondaryScale:1};
}

function effectiveVisualConfig(source){
  if(!source||source.lightweightModeEnabled!==true)return source;
  return {...source,weatherAnimationsEnabled:false,weatherWidgetAnimations:false,weatherFullscreenEffects:false,weatherSeasonalEffects:false,weatherHazardEffects:false,backgroundMotionEnabled:false,photoPreload:false,bgBlurPx:0,bgTransitionSec:Math.min(.35,Math.max(0,Number(source.bgTransitionSec)||0))};
}

function lightweightModeSummary(source){
  return source?.lightweightModeEnabled===true?'Lightweight mode is ON — expensive visuals are paused without changing your saved visual settings.':'Lightweight mode is OFF — your saved visual settings run normally.';
}

function applyFrontendPerformanceClass(){
  const caps=frontendCapabilities(),budget=visualPerformanceBudget(),root=document.documentElement;
  root.dataset.performanceTier=caps.tier;
  root.dataset.performanceResolution=budget.resolutionTier;
  root.classList.toggle('ld-constrained-device',caps.constrained);
  root.classList.toggle('ld-pi4-device',caps.piClass);
  root.classList.toggle('ld-pi4-highres',caps.piClass&&budget.resolutionTier==='highres');
  root.classList.toggle('ld-pi4-4k',caps.piClass&&budget.resolutionTier==='4k');
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
