// LibreDisplay source section: /js/core/performance.js
{
// Lightweight frontend scheduling and capability hints for lower-powered displays.
// Pi-class budgeting is keyed to four-core ARM/Linux displays. The separate low-memory
// fallback covers other four-core-or-smaller devices without assuming Raspberry Pi hardware.

const managedIntervals=new Map();
const managedRuns=new Map();
let longTaskCount=0,longTaskTotalMs=0,longTaskMaxMs=0,longTaskObserverActive=false;
const ANIMATION_MODES=new Set(['auto','smooth','balanced','fidelity']);
let animationGovernor={running:false,raf:0,lastSample:0,samples:[],fps:0,targetFps:45,droppedPct:0,quality:.74,lastAdjust:0,frames:0,dropped:0};

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

function baseVisualPerformanceBudget(){
  const caps=frontendCapabilities(),pixels=frontendPixelLoad();
  if(caps.piClass&&pixels.tier==='4k')return {tier:'pi4',resolutionTier:'4k',particleScale:.14,wildlifeScale:.22,holidayScale:.27,hazardScale:.33,cloudScale:.34,targetFrameMs:24,blurScale:0,maxParticles:18,maxFogBanks:2,maxClouds:4,secondaryScale:.36};
  if(caps.piClass&&pixels.tier==='highres')return {tier:'pi4',resolutionTier:'highres',particleScale:.18,wildlifeScale:.26,holidayScale:.31,hazardScale:.39,cloudScale:.40,targetFrameMs:16,blurScale:0,maxParticles:24,maxFogBanks:2,maxClouds:5,secondaryScale:.44};
  if(caps.piClass)return {tier:'pi4',resolutionTier:'standard',particleScale:.22,wildlifeScale:.30,holidayScale:.36,hazardScale:.45,cloudScale:.46,targetFrameMs:16,blurScale:0,maxParticles:30,maxFogBanks:2,maxClouds:6,secondaryScale:.52};
  if(caps.constrained)return {tier:'constrained',resolutionTier:pixels.tier,particleScale:.46,wildlifeScale:.54,holidayScale:.62,hazardScale:.72,cloudScale:.76,targetFrameMs:24,blurScale:.30,maxParticles:56,maxFogBanks:3,maxClouds:9,secondaryScale:.72};
  return {tier:'standard',resolutionTier:pixels.tier,particleScale:1,wildlifeScale:1,holidayScale:1,hazardScale:1,cloudScale:1,targetFrameMs:16,blurScale:1,maxParticles:240,maxFogBanks:8,maxClouds:20,secondaryScale:1};
}
function currentAnimationPerformanceMode(){try{const value=String(LibreDisplayRuntime.getModule('config')?.cfg?.animationPerformanceMode||'auto').toLowerCase();return ANIMATION_MODES.has(value)?value:'auto';}catch{return 'auto';}}
function animationModeProfile(){const caps=frontendCapabilities(),pixels=frontendPixelLoad(),mode=currentAnimationPerformanceMode();if(!caps.piClass)return {mode,targetFps:60,quality:1};if(mode==='smooth')return {mode,targetFps:30,quality:.58};if(mode==='balanced')return {mode,targetFps:45,quality:.76};if(mode==='fidelity')return {mode,targetFps:60,quality:1};const initial=pixels.tier==='4k'?30:animationGovernor.targetFps||45;return {mode,targetFps:initial,quality:animationGovernor.quality||.74};}
function visualPerformanceBudget(){const base=baseVisualPerformanceBudget(),caps=frontendCapabilities();if(!caps.piClass)return base;const profile=animationModeProfile(),factor=Math.max(.42,Math.min(1,profile.quality)),frameMs=Math.round(1000/Math.max(20,profile.targetFps));return {...base,particleScale:base.particleScale*factor,wildlifeScale:base.wildlifeScale*Math.max(.62,factor),holidayScale:base.holidayScale*Math.max(.58,factor),hazardScale:base.hazardScale*Math.max(.62,factor),cloudScale:base.cloudScale*Math.max(.60,factor),secondaryScale:base.secondaryScale*Math.max(.55,factor),targetFrameMs:frameMs,maxParticles:Math.max(10,Math.round(base.maxParticles*factor)),maxClouds:Math.max(3,Math.round(base.maxClouds*Math.max(.65,factor))),animationMode:profile.mode,targetFps:profile.targetFps,adaptiveQuality:factor};}
function animationPerformanceFrameMs(){return Math.max(16,Math.round(1000/Math.max(20,animationModeProfile().targetFps)));}
function animationPerformanceSnapshot(){const profile=animationModeProfile(),caps=frontendCapabilities();return {mode:profile.mode,fps:Number(animationGovernor.fps.toFixed(1)),targetFps:profile.targetFps,droppedPct:Number(animationGovernor.droppedPct.toFixed(1)),quality:Number(profile.quality.toFixed(2)),renderer:caps.piClass?'Canvas + compositor':'Browser compositor',piClass:caps.piClass,running:animationGovernor.running};}
function resetAnimationGovernor(){const profile=animationModeProfile(),pixels=frontendPixelLoad();animationGovernor.samples=[];animationGovernor.frames=0;animationGovernor.dropped=0;animationGovernor.fps=0;animationGovernor.droppedPct=0;animationGovernor.lastSample=0;animationGovernor.lastAdjust=performance.now?.()||Date.now();animationGovernor.targetFps=profile.mode==='auto'?(pixels.tier==='4k'?30:45):profile.targetFps;animationGovernor.quality=profile.mode==='auto'?(pixels.tier==='4k'?.58:pixels.tier==='highres'?.68:.74):profile.quality;}
function animationGovernorTick(now){if(!animationGovernor.running)return;const stamp=Number(now)||Date.now();if(animationGovernor.lastSample){const dt=stamp-animationGovernor.lastSample;if(dt>2&&dt<250){animationGovernor.samples.push(dt);if(animationGovernor.samples.length>180)animationGovernor.samples.shift();animationGovernor.frames++;const desired=1000/Math.max(20,animationGovernor.targetFps);if(dt>desired*1.50)animationGovernor.dropped++;if(animationGovernor.samples.length>=30){const avg=animationGovernor.samples.reduce((a,b)=>a+b,0)/animationGovernor.samples.length;animationGovernor.fps=1000/avg;animationGovernor.droppedPct=animationGovernor.frames?animationGovernor.dropped/animationGovernor.frames*100:0;}}}animationGovernor.lastSample=stamp;const mode=currentAnimationPerformanceMode(),caps=frontendCapabilities(),pixels=frontendPixelLoad();if(caps.piClass&&mode==='auto'&&stamp-animationGovernor.lastAdjust>5000&&animationGovernor.samples.length>=120){const sorted=[...animationGovernor.samples].sort((a,b)=>a-b),p90=sorted[Math.floor(sorted.length*.90)]||16.7,fps=animationGovernor.fps,target=animationGovernor.targetFps;if((target>=45&&(p90>31||fps<36||animationGovernor.droppedPct>7))||(target===30&&(p90>43||fps<25))){animationGovernor.targetFps=30;animationGovernor.quality=Math.max(.46,animationGovernor.quality-.10);animationGovernor.samples=[];animationGovernor.frames=animationGovernor.dropped=0;animationGovernor.lastAdjust=stamp;applyFrontendPerformanceClass();}else if(target===30&&pixels.tier!=='4k'&&p90<20&&fps>50&&animationGovernor.droppedPct<1&&stamp-animationGovernor.lastAdjust>30000){animationGovernor.targetFps=45;animationGovernor.quality=Math.min(.78,animationGovernor.quality+.06);animationGovernor.samples=[];animationGovernor.frames=animationGovernor.dropped=0;animationGovernor.lastAdjust=stamp;applyFrontendPerformanceClass();}else if(target===45&&pixels.tier==='standard'&&p90<17.8&&fps>56&&animationGovernor.droppedPct<1&&stamp-animationGovernor.lastAdjust>45000){animationGovernor.targetFps=60;animationGovernor.quality=Math.min(.86,animationGovernor.quality+.05);animationGovernor.samples=[];animationGovernor.frames=animationGovernor.dropped=0;animationGovernor.lastAdjust=stamp;applyFrontendPerformanceClass();}}animationGovernor.raf=requestAnimationFrame(animationGovernorTick);}
function startAnimationGovernor(){if(animationGovernor.running)return;animationGovernor.running=true;resetAnimationGovernor();animationGovernor.raf=requestAnimationFrame(animationGovernorTick);}
function refreshAnimationPerformanceMode(){resetAnimationGovernor();applyFrontendPerformanceClass();return animationPerformanceSnapshot();}

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
  root.dataset.animationTargetFps=String(budget.targetFps||60);
  root.classList.toggle('ld-pi-smooth',caps.piClass&&(budget.targetFps||60)<=30);
  root.classList.toggle('ld-pi-steady',caps.piClass&&(budget.targetFps||60)<=45);
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
    animation:animationPerformanceSnapshot(),
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
startAnimationGovernor();

LibreDisplayRuntime.exposeModule('performance',{frontendCapabilities,frontendPixelLoad,baseVisualPerformanceBudget,visualPerformanceBudget,animationPerformanceMode:currentAnimationPerformanceMode,animationModeProfile,animationPerformanceFrameMs,animationPerformanceSnapshot,startAnimationGovernor,refreshAnimationPerformanceMode,effectiveVisualConfig,lightweightModeSummary,applyFrontendPerformanceClass,runExclusiveTask,startManagedInterval,stopManagedInterval,runWhenIdle,frontendPerformanceSnapshot,observeFrontendLongTasks},{},{globals:false});
}
// End source section: /js/core/performance.js
