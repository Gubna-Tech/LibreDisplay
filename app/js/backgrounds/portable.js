// Portable still-background migration for cross-device settings/backup restore.
const portableConfigApi=LibreDisplayRuntime.getModule('config');
const portableBackgroundsApi=LibreDisplayRuntime.getModule('backgrounds');
const {resilientFetch:portableResilientFetch}=LibreDisplayRuntime.getModule('shared');
const PORTABLE_BACKGROUND_MAX_BYTES=12*1024*1024;
const PORTABLE_LAST_BACKGROUND_KEY='libredisplay_last_background_v2';
const PORTABLE_LAST_BACKGROUND_CACHE='libredisplay-last-background-v1';
function backgroundBytesToBase64(bytes){let binary='',chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+chunk)));return btoa(binary);}
function backgroundBase64ToBytes(value){const raw=atob(String(value||'')),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
async function createPortableBackgroundSnapshot(sourceCfg=portableConfigApi.cfg){
  if(sourceCfg?.backgroundSource==='none')return null;
  let remoteUrl=String(portableBackgroundsApi.activeBackgroundLayer()?.dataset?.remoteUrl||portableConfigApi.bgLastUrl||'');
  if(!remoteUrl){try{remoteUrl=String(JSON.parse(localStorage.getItem(PORTABLE_LAST_BACKGROUND_KEY)||'null')?.url||'');}catch(_e){}}
  if(!remoteUrl||!portableBackgroundsApi.cacheableStillBackground(remoteUrl))return null;
  try{
    const assetUrl=portableBackgroundsApi.backgroundAssetUrl(remoteUrl),res=await portableResilientFetch(assetUrl,{cache:'force-cache'},{timeoutMs:15000,attempts:1,retry:false});
    if(!res.ok)return null;
    const mime=String(res.headers.get('content-type')||'image/jpeg').toLowerCase();if(!mime.startsWith('image/'))return null;
    const buffer=await res.arrayBuffer();if(!buffer.byteLength||buffer.byteLength>PORTABLE_BACKGROUND_MAX_BYTES)return null;
    return {version:1,remoteUrl,source:String(sourceCfg?.backgroundSource||'none'),sourceKey:portableBackgroundsApi.backgroundSourceFingerprint(sourceCfg),mime,size:buffer.byteLength,dataBase64:backgroundBytesToBase64(new Uint8Array(buffer))};
  }catch(_e){return null;}
}
async function restorePortableBackgroundSnapshot(snapshot,sourceCfg=portableConfigApi.cfg){
  if(!snapshot||Number(snapshot.version)!==1||!snapshot.remoteUrl||!snapshot.dataBase64||!('caches' in globalThis))return false;
  try{
    const mime=String(snapshot.mime||'image/jpeg').toLowerCase();if(!mime.startsWith('image/'))return false;
    const bytes=backgroundBase64ToBytes(snapshot.dataBase64);if(!bytes.length||bytes.length>PORTABLE_BACKGROUND_MAX_BYTES)return false;
    const remoteUrl=String(snapshot.remoteUrl),assetUrl=portableBackgroundsApi.backgroundAssetUrl(remoteUrl),cache=await caches.open(PORTABLE_LAST_BACKGROUND_CACHE);
    for(const req of await cache.keys())await cache.delete(req);
    await cache.put(assetUrl,new Response(bytes,{status:200,headers:{'Content-Type':mime,'Content-Length':String(bytes.length)}}));
    const source=String(sourceCfg?.backgroundSource||snapshot.source||'none'),sourceKey=portableBackgroundsApi.backgroundSourceFingerprint(sourceCfg);
    localStorage.setItem(PORTABLE_LAST_BACKGROUND_KEY,JSON.stringify({url:remoteUrl,source,sourceKey,at:Date.now(),portable:true}));
    return true;
  }catch(_e){return false;}
}
LibreDisplayRuntime.exposeModule('backgrounds',{PORTABLE_BACKGROUND_MAX_BYTES,createPortableBackgroundSnapshot,restorePortableBackgroundSnapshot},{},{globalFunctions:[],globalStates:[]});
