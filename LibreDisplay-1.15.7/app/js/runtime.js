// LibreDisplay frontend module runtime.
// A logical module can be assembled from several native ES-module source files.
// The compatibility bridge supports legacy bare-identifier call sites while feature modules
// expose explicit APIs; dashboard events are delegated from external module code.
const registry = new Map();
const exportOwners = new Map();
const exportKinds = new Map();
const contributionCounts = new Map();
function claimGlobal(moduleName, exportName, exportKind) {
  const previous = exportOwners.get(exportName);
  if (previous && previous !== moduleName) {
    throw new Error(`LibreDisplay global export collision: ${exportName} is owned by ${previous}, not ${moduleName}`);
  }
  exportOwners.set(exportName, moduleName);
  exportKinds.set(exportName, exportKind);
}
function exposeModule(name, functions = {}, stateDescriptors = {}, options = {}) {
  const globalSelection=Array.isArray(options.globals)?new Set(options.globals):null;
  const functionSelection=Array.isArray(options.globalFunctions)?new Set(options.globalFunctions):globalSelection;
  const stateSelection=Array.isArray(options.globalStates)?new Set(options.globalStates):globalSelection;
  const publishGlobals=options.globals!==false;
  const shouldPublishFunction=(exportName)=>publishGlobals&&(!functionSelection||functionSelection.has(exportName));
  const shouldPublishState=(exportName)=>publishGlobals&&(!stateSelection||stateSelection.has(exportName));
  if(publishGlobals){
    const globalFunctions={};
    const globalStates={};
    for (const [exportName, value] of Object.entries(functions)) {
      if(!shouldPublishFunction(exportName))continue;
      claimGlobal(name, exportName, 'function');
      globalFunctions[exportName]=value;
    }
    for (const [exportName, descriptor] of Object.entries(stateDescriptors)) {
      if(!shouldPublishState(exportName))continue;
      claimGlobal(name, exportName, 'state');
      globalStates[exportName]=descriptor;
    }
    Object.assign(globalThis, globalFunctions);
    Object.defineProperties(globalThis, globalStates);
  }
  const previous = registry.get(name);
  const api = {};
  if(previous)Object.defineProperties(api,Object.getOwnPropertyDescriptors(previous));
  Object.assign(api,functions);
  Object.defineProperties(api,stateDescriptors);
  Object.freeze(api);
  registry.set(name, api);
  contributionCounts.set(name, (contributionCounts.get(name) || 0) + 1);
  return api;
}
function getModule(name) {
  const api = registry.get(name);
  if (!api) throw new Error(`LibreDisplay module not loaded: ${name}`);
  return api;
}
function describeModules() {
  return [...registry.entries()].map(([name, api]) => Object.freeze({
    name,
    contributions: contributionCounts.get(name) || 0,
    exports: Object.freeze(Object.keys(api).sort()),
  }));
}
function describeBridge() {
  return [...exportOwners.entries()]
    .map(([name,owner])=>Object.freeze({name,owner,kind:exportKinds.get(name)||'unknown'}))
    .sort((a,b)=>a.name.localeCompare(b.name));
}
function finalizeModules() {
  const modules = {};
  for (const [name, api] of registry) modules[name] = api;
  return Object.freeze(modules);
}
globalThis.LibreDisplayRuntime = Object.freeze({exposeModule, getModule, describeModules, describeBridge, finalizeModules});
