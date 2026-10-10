// LibreDisplay source section: /js/core/bootstrap.js
{

const DASHBOARD_BUILD = '1.10.54';
const PAGE_PARAMS=new URLSearchParams(location.search);
const ACTIVE_ENDPOINT=(String(PAGE_PARAMS.get('endpoint')||'main').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'')||'main').slice(0,48);
const CFG_KEY = 'libredisplay_cfg_'+ACTIVE_ENDPOINT;
const CFG_BACKUP_KEY = 'libredisplay_cfg_previous_'+ACTIVE_ENDPOINT;
const PROFILES_KEY = 'libredisplay_profiles';
const REMOTE_SETTINGS_MODE=PAGE_PARAMS.get('settings')==='1';
const OPEN_SETTINGS_MODE=PAGE_PARAMS.get('openSettings')==='1';
const LAYOUT_PREVIEW_MODE=PAGE_PARAMS.get('layoutPreview')==='1';
let READ_ONLY_DISPLAY_MODE=PAGE_PARAMS.get('display')==='1';
let LOCAL_CLIENT_MODE=false;
let SESSION_ROLE='';
let SESSION_USERNAME='';
function serverPath(path){
  if(!path.startsWith('/'))return path;
  if(path.startsWith('/api/')||path.startsWith('/calendar-files/')||path.startsWith('/media')||path.startsWith('/proxy')||path.startsWith('/gphotos-page')||path.startsWith('/plugins/')){
    if(/(?:^|[?&])endpoint=/.test(path))return path;
    const sep=path.includes('?')?'&':'?';
    return path+sep+'endpoint='+encodeURIComponent(ACTIVE_ENDPOINT);
  }
  return path;
}

// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("bootstrap", {serverPath}, {
  "DASHBOARD_BUILD": {configurable:true,get:()=>DASHBOARD_BUILD},
  "PAGE_PARAMS": {configurable:true,get:()=>PAGE_PARAMS},
  "ACTIVE_ENDPOINT": {configurable:true,get:()=>ACTIVE_ENDPOINT},
  "CFG_KEY": {configurable:true,get:()=>CFG_KEY},
  "CFG_BACKUP_KEY": {configurable:true,get:()=>CFG_BACKUP_KEY},
  "PROFILES_KEY": {configurable:true,get:()=>PROFILES_KEY},
  "REMOTE_SETTINGS_MODE": {configurable:true,get:()=>REMOTE_SETTINGS_MODE},
  "OPEN_SETTINGS_MODE": {configurable:true,get:()=>OPEN_SETTINGS_MODE},
  "LAYOUT_PREVIEW_MODE": {configurable:true,get:()=>LAYOUT_PREVIEW_MODE},
  "READ_ONLY_DISPLAY_MODE": {configurable:true,get:()=>READ_ONLY_DISPLAY_MODE,set:(value)=>{READ_ONLY_DISPLAY_MODE=value;}},
  "LOCAL_CLIENT_MODE": {configurable:true,get:()=>LOCAL_CLIENT_MODE,set:(value)=>{LOCAL_CLIENT_MODE=value;}},
  "SESSION_ROLE": {configurable:true,get:()=>SESSION_ROLE,set:(value)=>{SESSION_ROLE=value;}},
  "SESSION_USERNAME": {configurable:true,get:()=>SESSION_USERNAME,set:(value)=>{SESSION_USERNAME=value;}},
}, {globalFunctions:[],globalStates:['LAYOUT_PREVIEW_MODE']});
}
// End source section: /js/core/bootstrap.js
