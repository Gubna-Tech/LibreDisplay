// Lightweight frontend scheduling and capability hints for lower-powered displays.
// Pi 4 remains the standard baseline. Automatic low-power behavior only activates
// when the browser reports both a small memory budget and a four-core-or-smaller CPU.

const managedIntervals=new Map();
const managedRuns=new Map();
let longTaskCount=0,longTaskTotalMs=0,longTaskMaxMs=0,longTaskObserverActive=false;

function frontendCapabilities(){
  const cores=Math.max(0,Number(navigator.hardwareConcurrency)||0);
  const memoryGB=Math.max(0,Number(navigator.deviceMemory)||0);
  const constrained=!!(cores&&cores<=4&&memoryGB&&memoryGB<=2);
  return {
    cores,
    memoryGB,
    constrained,
    tier:constrained?'constrained':'standard',
    reason:constrained?'Browser reports a low-memory four-core-or-smaller device.':'Standard frontend behavior.'
  };
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

LibreDisplayRuntime.exposeModule('performance',{frontendCapabilities,applyFrontendPerformanceClass,runExclusiveTask,startManagedInterval,stopManagedInterval,runWhenIdle,frontendPerformanceSnapshot,observeFrontendLongTasks},{},{globals:false});
