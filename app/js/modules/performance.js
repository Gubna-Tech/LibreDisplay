// LibreDisplay source section: /js/core/performance.js
{
// Lightweight frontend scheduling and capability hints for lower-powered displays.
// Pi-class budgeting is keyed to four-core ARM/Linux displays. The separate low-memory
// fallback covers other four-core-or-smaller devices without assuming Raspberry Pi hardware.

const {resilientFetch}=LibreDisplayRuntime.getModule('shared');
const managedIntervals=new Map();
const managedRuns=new Map();
let longTaskCount=0,longTaskTotalMs=0,longTaskMaxMs=0,longTaskObserverActive=false,longTaskEntries=[];
const ANIMATION_MODES=new Set(['auto','smooth','balanced','fidelity']);
let animationGovernor={running:false,raf:0,lastSample:0,samples:[],sampleTotal:0,fps:0,targetFps:30,droppedPct:0,quality:.72,lastAdjust:0,lastProbe:0,probes:0,frames:0,dropped:0,rescue:false,rescueSince:0,recoverySince:0,dashboardSamples:[],dashboardTotal:0,settingsSamples:[],settingsTotal:0,dashboardFps:0,settingsFps:0};
let runtimeHardware={loaded:false,tier:'',model:'',cpuCount:0,memoryTotalBytes:0,memoryAvailableBytes:0};
let graphicsProbeCache=null,frontendCapabilitiesCache=null,frontendPixelLoadCache=null;
let frontendCacheStats={capabilityHits:0,capabilityMisses:0,pixelHits:0,pixelMisses:0};

function browserGraphicsSnapshot(){
  if(graphicsProbeCache)return graphicsProbeCache;
  const result={webgl:false,webgl2:false,renderer:'',vendor:'',software:false,probeError:''};
  try{
    const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;
    canvas.addEventListener('webglcontextcreationerror',event=>{if(!result.probeError)result.probeError=String(event?.statusMessage||'WebGL context creation failed').slice(0,240);},{once:false});
    const opts={alpha:false,antialias:false,preserveDrawingBuffer:false,powerPreference:'high-performance'};
    const gl2=canvas.getContext('webgl2',opts),gl=gl2||canvas.getContext('webgl',opts)||canvas.getContext('experimental-webgl',opts);
    if(gl){const ext=gl.getExtension('WEBGL_debug_renderer_info'),renderer=String(ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)||''),vendor=String(ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)||'');result.webgl=true;result.webgl2=!!gl2;result.renderer=renderer.slice(0,180);result.vendor=vendor.slice(0,120);result.software=/(swiftshader|llvmpipe|softpipe|software rasterizer|software renderer)/i.test(`${renderer} ${vendor}`);result.probeError='';}
    else if(!result.probeError)result.probeError='WebGL and WebGL2 context creation returned null';
  }catch(error){result.probeError=String(error?.message||error||'WebGL probe failed').slice(0,240);}
  graphicsProbeCache=result;return graphicsProbeCache;
}

function hardwareTierFromModel(model=''){const value=String(model||'').toLowerCase();if(value.includes('raspberry pi 3')||value.includes('raspberry pi zero'))return 'pi3';if(value.includes('raspberry pi 4'))return 'pi4';if(value.includes('raspberry pi 5'))return 'pi5';if(value.includes('raspberry pi'))return 'pi-constrained';return '';}
async function hydrateRuntimeHardware(){try{const bootstrap=LibreDisplayRuntime.getModule('bootstrap'),path=bootstrap?.serverPath?.('/api/runtime-capabilities')||'/api/runtime-capabilities',response=await resilientFetch(path,{cache:'no-store'});if(!response.ok)return runtimeHardware;const payload=await response.json(),hardware=payload?.hardware||{},tier=String(payload?.hardwareTier||hardwareTierFromModel(hardware.model)||'');runtimeHardware={loaded:true,tier,model:String(hardware.model||''),cpuCount:Math.max(0,Number(hardware.cpuCount)||0),memoryTotalBytes:Math.max(0,Number(hardware.memoryTotalBytes)||0),memoryAvailableBytes:Math.max(0,Number(hardware.memoryAvailableBytes)||0)};frontendCapabilitiesCache=null;resetAnimationGovernor();applyFrontendPerformanceClass();return runtimeHardware;}catch{return runtimeHardware;}}
function frontendCapabilities(){
  if(frontendCapabilitiesCache){frontendCacheStats.capabilityHits++;return frontendCapabilitiesCache;}frontendCacheStats.capabilityMisses++;
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
  frontendCapabilitiesCache={cores,memoryGB,platform,armLinux,piClass,pi3Class,pi4Class,pi5Class,constrained,tier,hostModel:runtimeHardware.model,hostHardwareLoaded:runtimeHardware.loaded,hostMemoryAvailableBytes:runtimeHardware.memoryAvailableBytes,reason:pi3Class?'Raspberry Pi 3-class hardware detected; low-load visual budgeting is active, but enabled animations are honored.':pi4Class?'Raspberry Pi 4-class hardware detected; adaptive frame pacing prefers smooth motion without reducing visual detail.':pi5Class?'Raspberry Pi 5-class hardware detected; higher animation headroom is available.':fallbackPi?'Four-core ARM/Linux display detected; conservative Pi-class budgeting is active.':constrained?'Browser reports a four-core low-memory device.':'Standard frontend behavior.'};return frontendCapabilitiesCache;
}

function frontendPixelLoad(){
  const dpr=Math.max(.5,Number(globalThis.devicePixelRatio)||1),screenW=Math.max(Number(globalThis.innerWidth)||0,Number(globalThis.screen?.width)||0),screenH=Math.max(Number(globalThis.innerHeight)||0,Number(globalThis.screen?.height)||0),key=`${screenW}x${screenH}@${dpr}`;if(frontendPixelLoadCache?.key===key){frontendCacheStats.pixelHits++;return frontendPixelLoadCache.value;}frontendCacheStats.pixelMisses++;const physicalWidth=Math.round(screenW*dpr),physicalHeight=Math.round(screenH*dpr),megapixels=physicalWidth*physicalHeight/1e6,value={physicalWidth,physicalHeight,megapixels,tier:megapixels>=7?'4k':megapixels>=3.2?'highres':'standard'};frontendPixelLoadCache={key,value};return value;
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
function animationModeProfile(){const caps=frontendCapabilities(),pixels=frontendPixelLoad(),mode=currentAnimationPerformanceMode();if(caps.pi3Class){if(mode==='fidelity')return {mode,targetFps:30,quality:.78};if(mode==='balanced')return {mode,targetFps:30,quality:.68};if(mode==='smooth')return {mode,targetFps:30,quality:.58};return {mode,targetFps:30,quality:animationGovernor.quality||.62};}if(caps.pi4Class){if(mode==='smooth')return {mode,targetFps:30,quality:.78};if(mode==='balanced')return {mode,targetFps:30,quality:.90};if(mode==='fidelity')return {mode,targetFps:30,quality:1};return {mode,targetFps:animationGovernor.targetFps||30,quality:animationGovernor.quality||.88};}if(caps.pi5Class){if(mode==='smooth')return {mode,targetFps:30,quality:.72};if(mode==='balanced')return {mode,targetFps:45,quality:.88};if(mode==='fidelity')return {mode,targetFps:60,quality:1};return {mode,targetFps:animationGovernor.targetFps||45,quality:animationGovernor.quality||.90};}if(!caps.piClass)return {mode,targetFps:60,quality:1};if(mode==='smooth')return {mode,targetFps:30,quality:.58};if(mode==='balanced')return {mode,targetFps:45,quality:.76};if(mode==='fidelity')return {mode,targetFps:60,quality:1};return {mode,targetFps:pixels.tier==='4k'?30:animationGovernor.targetFps||30,quality:animationGovernor.quality||.68};}
function visualPerformanceBudget(){const base=baseVisualPerformanceBudget(),caps=frontendCapabilities();if(!caps.piClass)return {...base,wildlifeDetail:'full',maxFlyingWildlife:99,maxDetailedFlyingWildlife:99};const profile=animationModeProfile(),factor=Math.max(caps.pi3Class?.52:.38,Math.min(1,profile.quality)),densityFactor=caps.pi3Class?Math.max(.72,factor):factor,frameMs=Math.round(1000/Math.max(30,profile.targetFps)),pi3Detail=caps.pi3Class?(profile.mode==='fidelity'?'full':'lite'):'',pi4Rescue=caps.pi4Class&&animationGovernor.rescue,wildlifeDetail=caps.pi3Class?pi3Detail:pi4Rescue?'rescue':'full',maxFlyingWildlife=caps.pi3Class?(profile.mode==='fidelity'?6:profile.mode==='balanced'?5:4):caps.pi4Class?(profile.mode==='fidelity'?4:3):99,maxDetailedFlyingWildlife=caps.pi3Class?(profile.mode==='fidelity'?2:1):maxFlyingWildlife;return {...base,particleScale:base.particleScale*densityFactor,wildlifeScale:base.wildlifeScale*Math.max(caps.pi3Class?.78:.72,densityFactor),holidayScale:base.holidayScale*Math.max(caps.pi3Class?.50:.54,factor),hazardScale:base.hazardScale*Math.max(caps.pi3Class?.52:.58,factor),cloudScale:base.cloudScale*Math.max(caps.pi3Class?.58:.56,factor),secondaryScale:base.secondaryScale*Math.max(caps.pi3Class?.58:.50,factor),targetFrameMs:frameMs,maxParticles:Math.max(caps.pi3Class?48:8,Math.round(base.maxParticles*densityFactor)),maxClouds:Math.max(caps.pi3Class?2:3,Math.round(base.maxClouds*Math.max(.66,densityFactor))),animationMode:profile.mode,targetFps:Math.max(caps.pi3Class?30:20,profile.targetFps),adaptiveQuality:factor,wildlifeDetail,maxFlyingWildlife,maxDetailedFlyingWildlife,motionAllowed:true,rescueMode:pi4Rescue};}
function animationPerformanceFrameMs(){return Math.max(16,Math.round(1000/Math.max(30,animationModeProfile().targetFps)));}
function settingsPerformanceContextOpen(){const setup=document.getElementById('setup');return !!setup&&!setup.classList.contains('hidden');}
function contextFpsSample(kind,dt){const settings=kind==='settings',key=settings?'settingsSamples':'dashboardSamples',totalKey=settings?'settingsTotal':'dashboardTotal',fpsKey=settings?'settingsFps':'dashboardFps',samples=animationGovernor[key];samples.push(dt);animationGovernor[totalKey]+=dt;if(samples.length>90)animationGovernor[totalKey]-=samples.shift();if(samples.length>=12){const total=animationGovernor[totalKey];animationGovernor[fpsKey]=total>0?samples.length*1000/total:0;}}
function animationPerformanceSnapshot(){const profile=animationModeProfile(),caps=frontendCapabilities(),settingsOpen=settingsPerformanceContextOpen();return {mode:profile.mode,fps:Number(animationGovernor.fps.toFixed(1)),dashboardFps:Number(animationGovernor.dashboardFps.toFixed(1)),settingsFps:Number(animationGovernor.settingsFps.toFixed(1)),settingsOpen,targetFps:profile.targetFps,droppedPct:Number(animationGovernor.droppedPct.toFixed(1)),quality:Number(profile.quality.toFixed(2)),renderer:caps.pi3Class?'Pi 3 low-load motion':caps.piClass?'Canvas + compositor':'Browser compositor',piClass:caps.piClass,running:animationGovernor.running,rescue:!!animationGovernor.rescue,governorProbes:animationGovernor.probes,frontendCache:{...frontendCacheStats}};}
function resetAnimationGovernor(){const caps=frontendCapabilities(),profile=animationModeProfile(),pixels=frontendPixelLoad(),keepRescue=!!(caps.pi4Class&&animationGovernor.rescue),keepDashboardFps=animationGovernor.dashboardFps||0,stamp=performance.now?.()||Date.now();animationGovernor.samples=[];animationGovernor.sampleTotal=0;animationGovernor.frames=0;animationGovernor.dropped=0;animationGovernor.fps=0;animationGovernor.droppedPct=0;animationGovernor.lastSample=0;animationGovernor.lastAdjust=stamp;animationGovernor.lastProbe=stamp;animationGovernor.probes=0;animationGovernor.dashboardSamples=[];animationGovernor.dashboardTotal=0;animationGovernor.settingsSamples=[];animationGovernor.settingsTotal=0;animationGovernor.dashboardFps=keepDashboardFps;animationGovernor.settingsFps=0;animationGovernor.targetFps=profile.mode==='auto'?(caps.pi3Class||caps.pi4Class?30:caps.pi5Class?(pixels.tier==='4k'?30:45):30):profile.targetFps;animationGovernor.quality=profile.mode==='auto'?(caps.pi3Class?.62:caps.pi4Class?(pixels.tier==='4k'?.68:pixels.tier==='highres'?.80:.88):caps.pi5Class?.90:(pixels.tier==='4k'?.54:pixels.tier==='highres'?.64:.72)):profile.quality;animationGovernor.rescue=keepRescue;animationGovernor.rescueSince=0;animationGovernor.recoverySince=0;}
function animationGovernorTick(now){
  if(!animationGovernor.running)return;
  const stamp=Number(now)||Date.now(),settingsOpen=settingsPerformanceContextOpen();
  if(displayBenchmarkRunning){animationGovernor.lastSample=stamp;animationGovernor.raf=requestAnimationFrame(animationGovernorTick);return;}
  if(animationGovernor.lastSample){
    const dt=stamp-animationGovernor.lastSample;
    if(dt>2&&dt<250){
      animationGovernor.samples.push(dt);animationGovernor.sampleTotal+=dt;if(animationGovernor.samples.length>180)animationGovernor.sampleTotal-=animationGovernor.samples.shift();
      contextFpsSample(settingsOpen?'settings':'dashboard',dt);
      animationGovernor.frames++;
      const desired=1000/Math.max(20,animationGovernor.targetFps);if(dt>desired*1.50)animationGovernor.dropped++;
      if(animationGovernor.samples.length>=30){animationGovernor.fps=animationGovernor.sampleTotal>0?animationGovernor.samples.length*1000/animationGovernor.sampleTotal:0;animationGovernor.droppedPct=animationGovernor.frames?animationGovernor.dropped/animationGovernor.frames*100:0;}
    }
  }
  animationGovernor.lastSample=stamp;
  const mode=currentAnimationPerformanceMode(),caps=frontendCapabilities(),pixels=frontendPixelLoad(),governorFps=settingsOpen&&animationGovernor.dashboardFps>0?animationGovernor.dashboardFps:animationGovernor.fps;
  if(caps.pi4Class&&animationGovernor.samples.length>=24){
    const fps=governorFps;
    if(!animationGovernor.rescue&&fps>0&&fps<18){animationGovernor.rescueSince=animationGovernor.rescueSince||stamp;if(stamp-animationGovernor.rescueSince>=2500){animationGovernor.rescue=true;animationGovernor.recoverySince=0;applyFrontendPerformanceClass();window.dispatchEvent(new CustomEvent('libredisplay:performancechange',{detail:animationPerformanceSnapshot()}));}}
    else if(!animationGovernor.rescue){animationGovernor.rescueSince=0;}
    if(animationGovernor.rescue&&fps>=27){animationGovernor.recoverySince=animationGovernor.recoverySince||stamp;if(stamp-animationGovernor.recoverySince>=18000){animationGovernor.rescue=false;animationGovernor.rescueSince=0;animationGovernor.recoverySince=0;applyFrontendPerformanceClass();window.dispatchEvent(new CustomEvent('libredisplay:performancechange',{detail:animationPerformanceSnapshot()}));}}
    else if(animationGovernor.rescue){animationGovernor.recoverySince=0;}
  }
  if((caps.pi4Class||caps.pi5Class)&&mode==='auto'&&!settingsOpen&&stamp-animationGovernor.lastProbe>=5000&&animationGovernor.samples.length>=120){
    animationGovernor.lastProbe=stamp;animationGovernor.probes++;const sorted=[...animationGovernor.samples].sort((a,b)=>a-b),p90=sorted[Math.floor(sorted.length*.90)]||16.7,fps=governorFps,target=animationGovernor.targetFps,drop=animationGovernor.droppedPct;
    if((target>=45&&(p90>31||fps<36||drop>7))||(target===30&&(p90>38||fps<28||drop>8))){const nextTarget=30,nextQuality=target>=45?animationGovernor.quality:Math.max(.42,animationGovernor.quality-.12),changed=nextTarget!==animationGovernor.targetFps||Math.abs(nextQuality-animationGovernor.quality)>.001;animationGovernor.targetFps=nextTarget;animationGovernor.quality=nextQuality;animationGovernor.samples=[];animationGovernor.sampleTotal=0;animationGovernor.frames=animationGovernor.dropped=0;animationGovernor.lastAdjust=stamp;if(changed){applyFrontendPerformanceClass();window.dispatchEvent(new CustomEvent('libredisplay:performancechange',{detail:animationPerformanceSnapshot()}));}}
    else if(caps.pi4Class&&target===30&&pixels.tier!=='4k'&&p90<25&&fps>=42&&drop<4&&stamp-animationGovernor.lastAdjust>=15000){animationGovernor.targetFps=45;animationGovernor.samples=[];animationGovernor.sampleTotal=0;animationGovernor.frames=animationGovernor.dropped=0;animationGovernor.lastAdjust=stamp;applyFrontendPerformanceClass();window.dispatchEvent(new CustomEvent('libredisplay:performancechange',{detail:animationPerformanceSnapshot()}));}
    else if(caps.pi5Class&&target===30&&pixels.tier!=='4k'&&p90<25&&fps>37&&drop<1&&stamp-animationGovernor.lastAdjust>=30000){animationGovernor.targetFps=45;animationGovernor.quality=Math.min(.78,animationGovernor.quality+.06);animationGovernor.samples=[];animationGovernor.sampleTotal=0;animationGovernor.frames=animationGovernor.dropped=0;animationGovernor.lastAdjust=stamp;applyFrontendPerformanceClass();window.dispatchEvent(new CustomEvent('libredisplay:performancechange',{detail:animationPerformanceSnapshot()}));}
    else if(caps.pi5Class&&target===45&&pixels.tier==='standard'&&p90<19&&fps>50&&drop<1&&stamp-animationGovernor.lastAdjust>=45000){animationGovernor.targetFps=60;animationGovernor.quality=Math.min(.86,animationGovernor.quality+.05);animationGovernor.samples=[];animationGovernor.sampleTotal=0;animationGovernor.frames=animationGovernor.dropped=0;animationGovernor.lastAdjust=stamp;applyFrontendPerformanceClass();window.dispatchEvent(new CustomEvent('libredisplay:performancechange',{detail:animationPerformanceSnapshot()}));}
  }
  animationGovernor.raf=requestAnimationFrame(animationGovernorTick);
}
function startAnimationGovernor(){if(animationGovernor.running)return;animationGovernor.running=true;resetAnimationGovernor();animationGovernor.raf=requestAnimationFrame(animationGovernorTick);}
function refreshAnimationPerformanceMode(){frontendCapabilitiesCache=null;frontendPixelLoadCache=null;resetAnimationGovernor();applyFrontendPerformanceClass();return animationPerformanceSnapshot();}

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

let animationWorkloadCache={sampledAt:0,totalAnimations:0,birds:0,dog:0,weather:0,deadhead:0,other:0,weatherNodes:0,playingVideos:0};
function animationWorkloadSnapshot(force=false){
  const now=Number(performance?.now?.())||Date.now();
  if(!force&&now-Number(animationWorkloadCache.sampledAt||0)<3000)return animationWorkloadCache;
  const out={sampledAt:Math.round(now),totalAnimations:0,birds:0,dog:0,weather:0,deadhead:0,other:0,weatherNodes:0,playingVideos:0};
  try{
    const animations=typeof document.getAnimations==='function'?document.getAnimations():[];
    for(const animation of animations){
      if(animation?.playState!=='running')continue;
      out.totalAnimations++;
      const target=animation?.effect?.target;
      if(!(target instanceof Element)){out.other++;continue;}
      if(target.closest('.weather-fx-bird,.weather-fx-owl'))out.birds++;
      else if(target.closest('.weather-fx-dog-v2'))out.dog++;
      else if(target.closest('#weather-effects-overlay'))out.weather++;
      else if(target.closest('.deadhead-panel'))out.deadhead++;
      else out.other++;
    }
    out.weatherNodes=document.querySelectorAll('#weather-effects-overlay *').length;
    out.playingVideos=[...document.querySelectorAll('video')].filter(v=>!v.paused&&!v.ended&&v.readyState>=2).length;
  }catch{}
  animationWorkloadCache=out;return out;
}

let displayBenchmarkRunning=false;
const DISPLAY_BENCHMARK_CLASSES=['ld-bench-pause-css-motion','ld-bench-pause-forecast-motion','ld-bench-no-canvas','ld-bench-no-wildlife','ld-bench-no-dog','ld-bench-no-calendar','ld-bench-no-current','ld-bench-no-clock','ld-bench-no-details','ld-bench-no-daily','ld-bench-no-hourly','ld-bench-no-forecast','ld-bench-no-alerts-custom','ld-bench-no-overlay','ld-bench-no-background','ld-bench-no-dashboard-ui','ld-bench-minimal'];
function waitForBenchmarkFrameDelay(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));}
function sampleDisplayFrameRate(durationMs=1800){
  const duration=Math.max(800,Number(durationMs)||1800);
  return new Promise(resolve=>{
    const deltas=[];let started=0,last=0,frames=0;
    const tick=stamp=>{
      if(!started){started=stamp;last=stamp;requestAnimationFrame(tick);return;}
      const dt=Math.max(0,stamp-last);last=stamp;frames++;if(dt>0)deltas.push(dt);
      const elapsed=Math.max(1,stamp-started);
      if(elapsed<duration){requestAnimationFrame(tick);return;}
      const sorted=[...deltas].sort((a,b)=>a-b),pct=p=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))]:0,targetMs=1000/30,dropped=sorted.filter(v=>v>targetMs*1.5).length;
      resolve({fps:frames*1000/elapsed,frameCount:frames,elapsedMs:elapsed,p50Ms:pct(.50),p90Ms:pct(.90),p99Ms:pct(.99),droppedPct:sorted.length?dropped/sorted.length*100:0});
    };
    requestAnimationFrame(tick);
  });
}
function longTaskWindow(startMs,endMs){const rows=longTaskEntries.filter(row=>row.startTime<=endMs&&row.startTime+row.duration>=startMs),total=rows.reduce((sum,row)=>sum+row.duration,0),max=rows.reduce((value,row)=>Math.max(value,row.duration),0);return {count:rows.length,totalMs:Math.round(total),maxMs:Math.round(max)};}
function layoutAutoFitSnapshot(){try{return LibreDisplayRuntime.getModule('layout')?.builtInLayoutAutoFitSnapshot?.()||{};}catch{return {};}}
function layoutAutoFitDelta(before,after){return {runs:Math.max(0,(Number(after?.runs)||0)-(Number(before?.runs)||0)),totalMs:Number(Math.max(0,(Number(after?.totalMs)||0)-(Number(before?.totalMs)||0)).toFixed(1)),maxMs:Number(after?.maxMs)||0};}
function diagnoseDisplayBenchmark(stages){
  const byKey=Object.fromEntries(stages.map(row=>[row.key,row])),base=Number(byKey.baseline?.fps)||0,ceiling=Number(byKey.minimal?.fps)||0;
  const candidates=stages.filter(row=>!['baseline','minimal'].includes(row.key)).map(row=>({...row,gain:(Number(row.fps)||0)-base})).sort((a,b)=>b.gain-a.gain),best=candidates[0]||{gain:0,label:'No single layer'};
  const longTaskStage=[...stages].sort((a,b)=>(Number(b.longTasks?.totalMs)||0)-(Number(a.longTasks?.totalMs)||0))[0];
  if(base>=27)return {kind:'healthy',summary:`The full dashboard sustained ${base.toFixed(1)} FPS with a ${ceiling.toFixed(1)} FPS minimal compositor ceiling. This run does not reproduce the low-FPS condition.`,largestSingleGain:best.gain||0,largestSingleStage:best.key||'',longTaskStage:longTaskStage?.key||''};
  if(ceiling<18||ceiling-base<4)return {kind:'platform',summary:`The minimal compositor ceiling is only ${ceiling.toFixed(1)} FPS versus ${base.toFixed(1)} FPS with the dashboard visible. The bottleneck remains below individual LibreDisplay layers.`,largestSingleGain:best.gain||0,largestSingleStage:best.key||'',longTaskStage:longTaskStage?.key||''};
  if(best.gain>=3){
    const names={pauseCss:'CSS animation/transition motion',pauseForecastMotion:'forecast icon motion/effects',pauseAutoFit:'custom-layout auto-fit work',noCalendar:'calendar rendering',noCurrent:'current-weather rendering',noClock:'clock rendering',noDetails:'weather-details rendering',noDaily:'daily forecast rendering',noHourly:'hourly forecast rendering',noForecast:'combined daily/hourly forecast rendering',noAlertsCustom:'alerts and added/custom blocks',noCanvas:'the shared weather/flora canvas',noOverlay:'the Weather/NatureScape overlay',noBackground:'background image/video rendering',noDashboardUi:'dashboard widgets/layout'};
    const stall=Number(longTaskStage?.longTasks?.maxMs)||0,stallText=stall>=1000?` Long-task instrumentation also saw up to ${(stall/1000).toFixed(1)} s in ${longTaskStage.label}.`:'';
    return {kind:'layer',summary:`The strongest isolated gain came from ${names[best.key]||best.label}: +${best.gain.toFixed(1)} FPS (${base.toFixed(1)} → ${Number(best.fps).toFixed(1)}). The minimal ceiling reaches ${ceiling.toFixed(1)} FPS.${stallText}`,largestSingleGain:best.gain,largestSingleStage:best.key,longTaskStage:longTaskStage?.key||''};
  }
  return {kind:'combined',summary:`No single isolated layer recovered at least 3 FPS, but the minimal ceiling reaches ${ceiling.toFixed(1)} FPS from a ${base.toFixed(1)} FPS baseline. Compare the per-stage long-task and auto-fit timings for cumulative dashboard pressure.`,largestSingleGain:best.gain||0,largestSingleStage:best.key||'',longTaskStage:longTaskStage?.key||''};
}
async function runDisplayPerformanceBenchmark(options={}){
  if(displayBenchmarkRunning)throw new Error('Display performance test is already running.');
  displayBenchmarkRunning=true;
  const layout=(()=>{try{return LibreDisplayRuntime.getModule('layout');}catch{return null;}})(),root=document.documentElement,startedAt=new Date().toISOString(),initialClasses=DISPLAY_BENCHMARK_CLASSES.filter(name=>root.classList.contains(name)),wasActive=root.classList.contains('ld-performance-benchmark-active'),playingVideos=[...document.querySelectorAll('video')].filter(v=>!v.paused&&!v.ended),stageDuration=Math.max(800,Number(options.stageDurationMs)||1800),settleMs=Math.max(120,Number(options.settleMs)||280),warmupMs=Math.max(600,Number(options.warmupMs)||1200);
  const stages=[
    {key:'baseline',label:'Full dashboard'},
    {key:'pauseAutoFit',label:'Custom-layout auto-fit paused',pauseAutoFit:true},
    {key:'pauseCss',label:'CSS motion paused',className:'ld-bench-pause-css-motion'},
    {key:'pauseForecastMotion',label:'Forecast icon motion/effects paused',className:'ld-bench-pause-forecast-motion'},
    {key:'noCalendar',label:'Calendar hidden',className:'ld-bench-no-calendar'},
    {key:'noCurrent',label:'Current weather hidden',className:'ld-bench-no-current'},
    {key:'noClock',label:'Clock hidden',className:'ld-bench-no-clock'},
    {key:'noDetails',label:'Weather details hidden',className:'ld-bench-no-details'},
    {key:'noDaily',label:'Daily forecast hidden',className:'ld-bench-no-daily'},
    {key:'noHourly',label:'Hourly forecast hidden',className:'ld-bench-no-hourly'},
    {key:'noForecast',label:'Daily/hourly forecasts hidden',className:'ld-bench-no-forecast'},
    {key:'noAlertsCustom',label:'Alerts and added blocks hidden',className:'ld-bench-no-alerts-custom'},
    {key:'noCanvas',label:'Shared weather/flora canvas paused',className:'ld-bench-no-canvas'},
    {key:'noOverlay',label:'Weather/NatureScape overlay hidden',className:'ld-bench-no-overlay'},
    {key:'noBackground',label:'Background layers and video paused',className:'ld-bench-no-background',pauseVideo:true},
    {key:'noDashboardUi',label:'All dashboard widgets/layout hidden',className:'ld-bench-no-dashboard-ui'},
    {key:'minimal',label:'Minimal compositor ceiling',className:'ld-bench-minimal',pauseVideo:true}
  ];
  const results=[];
  const restoreVideos=()=>{for(const video of playingVideos){try{if(video.paused)video.play().catch(()=>{});}catch{}}};
  try{
    root.classList.add('ld-performance-benchmark-active');DISPLAY_BENCHMARK_CLASSES.forEach(name=>root.classList.remove(name));layout?.setBuiltInLayoutAutoFitSuspended?.(false,{reschedule:false});await waitForBenchmarkFrameDelay(settleMs);await sampleDisplayFrameRate(warmupMs);await waitForBenchmarkFrameDelay(0);
    for(let index=0;index<stages.length;index++){
      const stage=stages[index];DISPLAY_BENCHMARK_CLASSES.forEach(name=>root.classList.remove(name));restoreVideos();layout?.setBuiltInLayoutAutoFitSuspended?.(!!stage.pauseAutoFit,{reschedule:false});
      if(stage.className)root.classList.add(stage.className);if(stage.pauseVideo)for(const video of playingVideos){try{video.pause();}catch{}}
      options.onStage?.({index:index+1,total:stages.length,key:stage.key,label:stage.label});
      await waitForBenchmarkFrameDelay(settleMs);
      const sampleStart=performance.now(),fitBefore=layoutAutoFitSnapshot(),sample=await sampleDisplayFrameRate(stageDuration);await waitForBenchmarkFrameDelay(0);const sampleEnd=performance.now(),fitAfter=layoutAutoFitSnapshot(),row={key:stage.key,label:stage.label,...sample,longTasks:longTaskWindow(sampleStart,sampleEnd),layoutAutoFit:layoutAutoFitDelta(fitBefore,fitAfter)};results.push(row);
      options.onStage?.({index:index+1,total:stages.length,key:stage.key,label:stage.label,result:row});
    }
    const baseline=Number(results[0]?.fps)||0;for(const row of results)row.deltaFps=(Number(row.fps)||0)-baseline;
    return {startedAt,finishedAt:new Date().toISOString(),stageDurationMs:stageDuration,warmupMs,baselineFps:baseline,ceilingFps:Number(results.find(r=>r.key==='minimal')?.fps)||0,stages:results,diagnosis:diagnoseDisplayBenchmark(results),performance:animationPerformanceSnapshot(),workload:animationWorkloadSnapshot(true),graphics:browserGraphicsSnapshot(),layoutAutoFit:layoutAutoFitSnapshot(),forecastRendering:forecastRenderTelemetrySnapshot()};
  }finally{
    layout?.setBuiltInLayoutAutoFitSuspended?.(false,{reschedule:false});DISPLAY_BENCHMARK_CLASSES.forEach(name=>root.classList.remove(name));for(const name of initialClasses)root.classList.add(name);if(!wasActive)root.classList.remove('ld-performance-benchmark-active');restoreVideos();displayBenchmarkRunning=false;resetAnimationGovernor();
  }
}

function forecastRenderTelemetrySnapshot(){try{return LibreDisplayRuntime.getModule('weather')?.forecastRenderSnapshot?.()||{};}catch{return {};}}
function backgroundRuntimeTelemetrySnapshot(){try{return LibreDisplayRuntime.getModule('backgrounds')?.backgroundRuntimeSnapshot?.()||{};}catch{return {};}}
function recentLongTaskSnapshot(){const now=Math.max(0,Number(performance?.now?.())||0);return longTaskEntries.slice(-16).map(row=>({startTimeMs:Number(row.startTime.toFixed(1)),durationMs:Number(row.duration.toFixed(1)),ageMs:Math.max(0,Math.round(now-row.startTime-row.duration))}));}
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
    animationWorkload:animationWorkloadSnapshot(),
    graphics:browserGraphicsSnapshot(),
    pageUptimeMs:Math.max(0,Math.round(Number(performance?.now?.())||0)),
    hidden:!!document.hidden,
    reducedMotion:document.documentElement.classList.contains('ld-reduce-motion'),
    activeIntervals:managedIntervals.size,
    activeExclusiveRuns:managedRuns.size,
    longTaskObserverActive,
    layoutAutoFit:layoutAutoFitSnapshot(),
    forecastRendering:forecastRenderTelemetrySnapshot(),
    'backgroundRuntime':backgroundRuntimeTelemetrySnapshot(),
    longTasks:{count:longTaskCount,totalMs:Math.round(longTaskTotalMs),maxMs:Math.round(longTaskMaxMs),recent:recentLongTaskSnapshot()},
    ...(heap?{heap}: {})
  };
}

function observeFrontendLongTasks(){
  if(typeof PerformanceObserver!=='function')return false;
  try{
    const observer=new PerformanceObserver(list=>{
      for(const entry of list.getEntries()){
        const duration=Math.max(0,Number(entry.duration)||0);
        longTaskCount++;longTaskTotalMs+=duration;longTaskMaxMs=Math.max(longTaskMaxMs,duration);longTaskEntries.push({startTime:Math.max(0,Number(entry.startTime)||0),duration});if(longTaskEntries.length>512)longTaskEntries=longTaskEntries.slice(-384);
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

LibreDisplayRuntime.exposeModule('performance',{hardwareTierFromModel,hydrateRuntimeHardware,frontendCapabilities,frontendPixelLoad,baseVisualPerformanceBudget,visualPerformanceBudget,animationPerformanceMode:currentAnimationPerformanceMode,animationModeProfile,animationPerformanceFrameMs,animationPerformanceSnapshot,browserGraphicsSnapshot,startAnimationGovernor,refreshAnimationPerformanceMode,effectiveVisualConfig,lightweightModeSummary,applyFrontendPerformanceClass,runExclusiveTask,startManagedInterval,stopManagedInterval,runWhenIdle,sampleDisplayFrameRate,runDisplayPerformanceBenchmark,diagnoseDisplayBenchmark,frontendPerformanceSnapshot,animationWorkloadSnapshot,observeFrontendLongTasks,recentLongTaskSnapshot,backgroundRuntimeTelemetrySnapshot},{displayBenchmarkRunning:{configurable:true,get:()=>displayBenchmarkRunning}},{globals:false});
}
// End source section: /js/core/performance.js
