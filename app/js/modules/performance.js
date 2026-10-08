// LibreDisplay source section: /js/core/performance.js
{
// Lightweight frontend scheduling and capability hints for lower-powered displays.
// Pi-class budgeting is keyed to four-core ARM/Linux displays. The separate low-memory
// fallback covers other four-core-or-smaller devices without assuming Raspberry Pi hardware.

const {resilientFetch}=LibreDisplayRuntime.getModule('shared');
const managedIntervals=new Map();
const managedRuns=new Map();
let longTaskCount=0,longTaskTotalMs=0,longTaskMaxMs=0,longTaskObserverActive=false;
const ANIMATION_MODES=new Set(['auto','smooth','balanced','fidelity']);
let animationGovernor={running:false,raf:0,lastSample:0,samples:[],fps:0,targetFps:30,droppedPct:0,quality:.72,lastAdjust:0,frames:0,dropped:0};
let runtimeHardware={loaded:false,tier:'',model:'',cpuCount:0,memoryTotalBytes:0,memoryAvailableBytes:0};

function hardwareTierFromModel(model=''){const value=String(model||'').toLowerCase();if(value.includes('raspberry pi 3')||value.includes('raspberry pi zero'))return 'pi3';if(value.includes('raspberry pi 4'))return 'pi4';if(value.includes('raspberry pi 5'))return 'pi5';if(value.includes('raspberry pi'))return 'pi-constrained';return '';}
async function hydrateRuntimeHardware(){try{const bootstrap=LibreDisplayRuntime.getModule('bootstrap'),path=bootstrap?.serverPath?.('/api/runtime-capabilities')||'/api/runtime-capabilities',response=await resilientFetch(path,{cache:'no-store'});if(!response.ok)return runtimeHardware;const payload=await response.json(),hardware=payload?.hardware||{},tier=String(payload?.hardwareTier||hardwareTierFromModel(hardware.model)||'');runtimeHardware={loaded:true,tier,model:String(hardware.model||''),cpuCount:Math.max(0,Number(hardware.cpuCount)||0),memoryTotalBytes:Math.max(0,Number(hardware.memoryTotalBytes)||0),memoryAvailableBytes:Math.max(0,Number(hardware.memoryAvailableBytes)||0)};resetAnimationGovernor();applyFrontendPerformanceClass();return runtimeHardware;}catch{return runtimeHardware;}}
function frontendCapabilities(){
  const browserCores=Math.max(0,Number(navigator.hardwareConcurrency)||0),cores=runtimeHardware.cpuCount||browserCores;
  const memoryGB=Math.max(0,Number(navigator.deviceMemory)||0);
  const platform=String(navigator.userAgentData?.platform||navigator.platform||'');
  const ua=String(navigator.userAgent||'');
  const armLinux=/linux/i.test(`${platform} ${ua}`)&&/(arm|aarch64|armv7|armv8)/i.test(`${platform} ${ua}`);
  const detectedTier=runtimeHardware.tier||hardwareTierFromModel(runtimeHardware.model);
  const exactPi=/^pi(?:3|4|5)$/.test(detectedTier)||detectedTier==='pi-constrained';
  const fallbackPi=!detectedTier&&!!(cores&&cores<=4&&armLinux);
  const piClass=exactPi||fallbackPi;
  const pi3Class=detectedTier==='pi3'||detectedTier==='pi-constrained';
  const pi4Class=detectedTier==='pi4'||(fallbackPi&&!runtimeHardware.loaded);
  const pi5Class=detectedTier==='pi5';
  const lowMemoryFourCore=!!(cores&&cores<=4&&memoryGB&&memoryGB<=4);
  const constrained=pi3Class||pi4Class||(!pi5Class&&(fallbackPi||lowMemoryFourCore));
  const tier=pi3Class?'pi3':pi4Class?'pi4':pi5Class?'pi5':constrained?'constrained':'standard';
  return {cores,memoryGB,platform,armLinux,piClass,pi3Class,pi4Class,pi5Class,constrained,tier,hostModel:runtimeHardware.model,hostHardwareLoaded:runtimeHardware.loaded,hostMemoryAvailableBytes:runtimeHardware.memoryAvailableBytes,reason:pi3Class?'Raspberry Pi 3-class hardware detected; low-load visual budgeting is active, but enabled animations are honored.':pi4Class?'Raspberry Pi 4-class hardware detected; stable 30 FPS is preferred before adaptive promotion.':pi5Class?'Raspberry Pi 5-class hardware detected; higher animation headroom is available.':fallbackPi?'Four-core ARM/Linux display detected; conservative Pi-class budgeting is active.':constrained?'Browser reports a four-core low-memory device.':'Standard frontend behavior.'};
}

function frontendPixelLoad(){
  const dpr=Math.max(.5,Number(globalThis.devicePixelRatio)||1),screenW=Math.max(Number(globalThis.innerWidth)||0,Number(globalThis.screen?.width)||0),screenH=Math.max(Number(globalThis.innerHeight)||0,Number(globalThis.screen?.height)||0),physicalWidth=Math.round(screenW*dpr),physicalHeight=Math.round(screenH*dpr),megapixels=physicalWidth*physicalHeight/1e6;
  return {physicalWidth,physicalHeight,megapixels,tier:megapixels>=7?'4k':megapixels>=3.2?'highres':'standard'};
}

function baseVisualPerformanceBudget(){
  const caps=frontendCapabilities(),pixels=frontendPixelLoad();
  if(caps.pi3Class)return {tier:'pi3',resolutionTier:pixels.tier,particleScale:.95,wildlifeScale:.78,holidayScale:.20,hazardScale:.24,cloudScale:.24,targetFrameMs:33,blurScale:0,maxParticles:96,maxFogBanks:1,maxClouds:3,secondaryScale:.34,motionAllowed:true};
  if(caps.pi4Class&&pixels.tier==='4k')return {tier:'pi4',resolutionTier:'4k',particleScale:.46,wildlifeScale:.58,holidayScale:.30,hazardScale:.34,cloudScale:.34,targetFrameMs:33,blurScale:0,maxParticles:72,maxFogBanks:2,maxClouds:4,secondaryScale:.44,motionAllowed:true};
  if(caps.pi4Class&&pixels.tier==='highres')return {tier:'pi4',resolutionTier:'highres',particleScale:.68,wildlifeScale:.70,holidayScale:.36,hazardScale:.42,cloudScale:.42,targetFrameMs:33,blurScale:0,maxParticles:96,maxFogBanks:2,maxClouds:5,secondaryScale:.56,motionAllowed:true};
  if(caps.pi4Class)return {tier:'pi4',resolutionTier:'standard',particleScale:.88,wildlifeScale:.82,holidayScale:.44,hazardScale:.50,cloudScale:.50,targetFrameMs:33,blurScale:0,maxParticles:128,maxFogBanks:2,maxClouds:6,secondaryScale:.68,motionAllowed:true};
  if(caps.pi5Class)return {tier:'pi5',resolutionTier:pixels.tier,particleScale:pixels.tier==='4k'?.45:.72,wildlifeScale:.72,holidayScale:.76,hazardScale:.82,cloudScale:.82,targetFrameMs:pixels.tier==='4k'?24:16,blurScale:.35,maxParticles:pixels.tier==='4k'?72:110,maxFogBanks:4,maxClouds:10,secondaryScale:.78,motionAllowed:true};
  if(caps.constrained)return {tier:'constrained',resolutionTier:pixels.tier,particleScale:.40,wildlifeScale:.48,holidayScale:.56,hazardScale:.66,cloudScale:.70,targetFrameMs:33,blurScale:.20,maxParticles:46,maxFogBanks:2,maxClouds:8,secondaryScale:.64,motionAllowed:true};
  return {tier:'standard',resolutionTier:pixels.tier,particleScale:1,wildlifeScale:1,holidayScale:1,hazardScale:1,cloudScale:1,targetFrameMs:16,blurScale:1,maxParticles:240,maxFogBanks:8,maxClouds:20,secondaryScale:1,motionAllowed:true};
}

function currentAnimationPerformanceMode(){try{const value=String(LibreDisplayRuntime.getModule('config')?.cfg?.animationPerformanceMode||'auto').toLowerCase();return ANIMATION_MODES.has(value)?value:'auto';}catch{return 'auto';}}
function animationModeProfile(){const caps=frontendCapabilities(),pixels=frontendPixelLoad(),mode=currentAnimationPerformanceMode();if(caps.pi3Class){if(mode==='fidelity')return {mode,targetFps:30,quality:.78};if(mode==='balanced')return {mode,targetFps:30,quality:.68};if(mode==='smooth')return {mode,targetFps:30,quality:.58};return {mode,targetFps:30,quality:animationGovernor.quality||.62};}if(caps.pi4Class){if(mode==='smooth')return {mode,targetFps:30,quality:.56};if(mode==='balanced')return {mode,targetFps:45,quality:.74};if(mode==='fidelity')return {mode,targetFps:45,quality:.94};return {mode,targetFps:animationGovernor.targetFps||30,quality:animationGovernor.quality||.72};}if(caps.pi5Class){if(mode==='smooth')return {mode,targetFps:30,quality:.72};if(mode==='balanced')return {mode,targetFps:45,quality:.88};if(mode==='fidelity')return {mode,targetFps:60,quality:1};return {mode,targetFps:animationGovernor.targetFps||45,quality:animationGovernor.quality||.90};}if(!caps.piClass)return {mode,targetFps:60,quality:1};if(mode==='smooth')return {mode,targetFps:30,quality:.58};if(mode==='balanced')return {mode,targetFps:45,quality:.76};if(mode==='fidelity')return {mode,targetFps:60,quality:1};return {mode,targetFps:pixels.tier==='4k'?30:animationGovernor.targetFps||30,quality:animationGovernor.quality||.68};}
function visualPerformanceBudget(){const base=baseVisualPerformanceBudget(),caps=frontendCapabilities();if(!caps.piClass)return {...base,wildlifeDetail:'full',maxFlyingWildlife:99,maxDetailedFlyingWildlife:99};const profile=animationModeProfile(),factor=Math.max(caps.pi3Class?.52:.38,Math.min(1,profile.quality)),densityFactor=caps.pi3Class?Math.max(.72,factor):factor,frameMs=Math.round(1000/Math.max(30,profile.targetFps)),pi3Detail=caps.pi3Class?(profile.mode==='fidelity'?'full':'lite'):'',wildlifeDetail=caps.pi3Class?pi3Detail:caps.pi4Class&&profile.mode!=='fidelity'?(factor<=.50?'rescue':'lite'):'full',maxFlyingWildlife=caps.pi3Class?(profile.mode==='fidelity'?6:profile.mode==='balanced'?5:4):caps.pi4Class?(profile.mode==='fidelity'?12:profile.mode==='balanced'?10:8):99,maxDetailedFlyingWildlife=caps.pi3Class?(profile.mode==='fidelity'?2:1):caps.pi4Class?(profile.mode==='fidelity'?2:profile.mode==='balanced'?2:1):maxFlyingWildlife;return {...base,particleScale:base.particleScale*densityFactor,wildlifeScale:base.wildlifeScale*Math.max(caps.pi3Class?.78:.58,densityFactor),holidayScale:base.holidayScale*Math.max(caps.pi3Class?.50:.54,factor),hazardScale:base.hazardScale*Math.max(caps.pi3Class?.52:.58,factor),cloudScale:base.cloudScale*Math.max(caps.pi3Class?.58:.56,factor),secondaryScale:base.secondaryScale*Math.max(caps.pi3Class?.58:.50,factor),targetFrameMs:frameMs,maxParticles:Math.max(caps.pi3Class?48:8,Math.round(base.maxParticles*densityFactor)),maxClouds:Math.max(caps.pi3Class?2:3,Math.round(base.maxClouds*Math.max(.66,densityFactor))),animationMode:profile.mode,targetFps:Math.max(caps.pi3Class?30:20,profile.targetFps),adaptiveQuality:factor,wildlifeDetail,maxFlyingWildlife,maxDetailedFlyingWildlife,motionAllowed:true};}
function animationPerformanceFrameMs(){return Math.max(16,Math.round(1000/Math.max(30,animationModeProfile().targetFps)));}
function animationPerformanceSnapshot(){const profile=animationModeProfile(),caps=frontendCapabilities();return {mode:profile.mode,fps:Number(animationGovernor.fps.toFixed(1)),targetFps:profile.targetFps,droppedPct:Number(animationGovernor.droppedPct.toFixed(1)),quality:Number(profile.quality.toFixed(2)),renderer:caps.pi3Class?'Pi 3 low-load motion':caps.piClass?'Canvas + compositor':'Browser compositor',piClass:caps.piClass,running:animationGovernor.running};}
function resetAnimationGovernor(){const caps=frontendCapabilities(),profile=animationModeProfile(),pixels=frontendPixelLoad();animationGovernor.samples=[];animationGovernor.frames=0;animationGovernor.dropped=0;animationGovernor.fps=0;animationGovernor.droppedPct=0;animationGovernor.lastSample=0;animationGovernor.lastAdjust=performance.now?.()||Date.now();animationGovernor.targetFps=profile.mode==='auto'?(caps.pi3Class?30:caps.pi5Class?(pixels.tier==='4k'?30:45):30):profile.targetFps;animationGovernor.quality=profile.mode==='auto'?(caps.pi3Class?.62:caps.pi5Class?.90:(pixels.tier==='4k'?.54:pixels.tier==='highres'?.64:.72)):profile.quality;}
function animationGovernorTick(now){if(!animationGovernor.running)return;const stamp=Number(now)||Date.now();if(animationGovernor.lastSample){const dt=stamp-animationGovernor.lastSample;if(dt>2&&dt<250){animationGovernor.samples.push(dt);if(animationGovernor.samples.length>180)animationGovernor.samples.shift();animationGovernor.frames++;const desired=1000/Math.max(20,animationGovernor.targetFps);if(dt>desired*1.50)animationGovernor.dropped++;if(animationGovernor.samples.length>=30){const avg=animationGovernor.samples.reduce((a,b)=>a+b,0)/animationGovernor.samples.length;animationGovernor.fps=1000/avg;animationGovernor.droppedPct=animationGovernor.frames?animationGovernor.dropped/animationGovernor.frames*100:0;}}}animationGovernor.lastSample=stamp;const mode=currentAnimationPerformanceMode(),caps=frontendCapabilities(),pixels=frontendPixelLoad();if((caps.pi4Class||caps.pi5Class)&&mode==='auto'&&stamp-animationGovernor.lastAdjust>5000&&animationGovernor.samples.length>=120){const sorted=[...animationGovernor.samples].sort((a,b)=>a-b),p90=sorted[Math.floor(sorted.length*.90)]||16.7,fps=animationGovernor.fps,target=animationGovernor.targetFps;if((target>=45&&(p90>31||fps<36||animationGovernor.droppedPct>7))||(target===30&&(p90>38||fps<28||animationGovernor.droppedPct>8))){const nextTarget=30,nextQuality=Math.max(.42,animationGovernor.quality-.12),changed=nextTarget!==animationGovernor.targetFps||Math.abs(nextQuality-animationGovernor.quality)>.001;animationGovernor.targetFps=nextTarget;animationGovernor.quality=nextQuality;animationGovernor.samples=[];animationGovernor.frames=animationGovernor.dropped=0;animationGovernor.lastAdjust=stamp;if(changed){applyFrontendPerformanceClass();window.dispatchEvent(new CustomEvent('libredisplay:performancechange',{detail:animationPerformanceSnapshot()}));}}else if(target===30&&pixels.tier!=='4k'&&p90<25&&fps>37&&animationGovernor.droppedPct<1&&stamp-animationGovernor.lastAdjust>30000){animationGovernor.targetFps=45;animationGovernor.quality=Math.min(.78,animationGovernor.quality+.06);animationGovernor.samples=[];animationGovernor.frames=animationGovernor.dropped=0;animationGovernor.lastAdjust=stamp;applyFrontendPerformanceClass();window.dispatchEvent(new CustomEvent('libredisplay:performancechange',{detail:animationPerformanceSnapshot()}));}else if(target===45&&pixels.tier==='standard'&&p90<19&&fps>50&&animationGovernor.droppedPct<1&&stamp-animationGovernor.lastAdjust>45000){animationGovernor.targetFps=60;animationGovernor.quality=Math.min(.86,animationGovernor.quality+.05);animationGovernor.samples=[];animationGovernor.frames=animationGovernor.dropped=0;animationGovernor.lastAdjust=stamp;applyFrontendPerformanceClass();window.dispatchEvent(new CustomEvent('libredisplay:performancechange',{detail:animationPerformanceSnapshot()}));}}animationGovernor.raf=requestAnimationFrame(animationGovernorTick);}
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
  root.classList.toggle('ld-pi3-device',caps.pi3Class);
  root.classList.toggle('ld-pi3-static',caps.pi3Class&&budget.motionAllowed===false);
  root.classList.toggle('ld-pi4-device',caps.pi4Class);
  root.classList.toggle('ld-pi5-device',caps.pi5Class);
  root.classList.toggle('ld-wildlife-lite',budget.wildlifeDetail==='lite');
  root.classList.toggle('ld-wildlife-rescue',budget.wildlifeDetail==='rescue');
  root.classList.toggle('ld-pi4-highres',caps.pi4Class&&budget.resolutionTier==='highres');
  root.classList.toggle('ld-pi4-4k',caps.pi4Class&&budget.resolutionTier==='4k');
  root.dataset.animationTargetFps=String(budget.targetFps||60);
  root.classList.toggle('ld-pi-smooth',caps.piClass&&budget.animationMode!=='fidelity'&&(budget.targetFps||60)<=30);
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
queueMicrotask(hydrateRuntimeHardware);
observeFrontendLongTasks();
startAnimationGovernor();

LibreDisplayRuntime.exposeModule('performance',{hardwareTierFromModel,hydrateRuntimeHardware,frontendCapabilities,frontendPixelLoad,baseVisualPerformanceBudget,visualPerformanceBudget,animationPerformanceMode:currentAnimationPerformanceMode,animationModeProfile,animationPerformanceFrameMs,animationPerformanceSnapshot,startAnimationGovernor,refreshAnimationPerformanceMode,effectiveVisualConfig,lightweightModeSummary,applyFrontendPerformanceClass,runExclusiveTask,startManagedInterval,stopManagedInterval,runWhenIdle,frontendPerformanceSnapshot,observeFrontendLongTasks},{},{globals:false});
}
// End source section: /js/core/performance.js
