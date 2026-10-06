// LibreDisplay source section: /js/backgrounds/google-photos.js
{
// Google Photos shared-album parsing and pagination.

const {serverPath}=LibreDisplayRuntime.getModule('bootstrap');const {resilientFetch}=LibreDisplayRuntime.getModule('shared');

function decodeGoogleMarkup(text){
  let out=String(text||'');
  for(let i=0;i<3;i++){
    const before=out;
    out=out
      .replace(/\\u003a/gi,':')
      .replace(/\\u003d/gi,'=')
      .replace(/\\u0026/gi,'&')
      .replace(/\\u002f/gi,'/')
      .replace(/\\x3a/gi,':')
      .replace(/\\x3d/gi,'=')
      .replace(/\\x26/gi,'&')
      .replace(/\\x2f/gi,'/')
      .replace(/\\\//g,'/')
      .replace(/&amp;/gi,'&');
    if(out===before)break;
  }
  return out;
}

function googlePhotoSizedUrl(raw){
  let u=decodeGoogleMarkup(raw).trim();
  if(!u)return '';
  u=u.replace(/[\\"'`,;]+$/,'');

  const cut=u.search(/[?#]/);
  let base=cut>=0?u.slice(0,cut):u;
  const tail=cut>=0?u.slice(cut):'';
  base=base
    .replace(/=(?:w\d+(?:-h\d+)?|s\d+)(?:-[a-z0-9-]+)?$/i,'')
    .replace(/=d$/i,'');
  return base+'=w1920-h1080-no'+tail;
}

const GOOGLE_PHOTOS_MAX_ITEMS=1000;

function extractGooglePhotoUrls(html){
  const decoded=decodeGoogleMarkup(html);
  const candidates=[];

  const detailRx=/(https:\/\/(?:lh[3-6]\.googleusercontent\.com|lh3\.ggpht\.com)\/[^\s"'<>\)\]\[,]+)["']?\s*,\s*(\d{2,5})\s*,\s*(\d{2,5})/gi;
  for(const m of decoded.matchAll(detailRx)){
    const w=Number(m[2]), h=Number(m[3]);
    if(w>=500&&h>=300)candidates.push(m[1]);
  }

  if(!candidates.length){
    const broadRx=/https:\/\/(?:lh[3-6]\.googleusercontent\.com|lh3\.ggpht\.com)\/[^\s"'<>\)\]]+/gi;
    for(const m of decoded.matchAll(broadRx))candidates.push(m[0]);
  }

  const seen=new Set();
  const out=[];
  for(const raw of candidates){
    const u=googlePhotoSizedUrl(raw);
    if(!u||seen.has(u))continue;
    seen.add(u);
    out.push(u);
    if(out.length>=GOOGLE_PHOTOS_MAX_ITEMS)break;
  }
  return out;
}

function googleBalancedArrayAt(text,start){
  text=String(text||'');
  if(text[start]!=='[')return '';
  let depth=0,quote='',escaped=false;
  for(let i=start;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='[')depth++;
    else if(ch===']'){
      depth--;
      if(depth===0)return text.slice(start,i+1);
    }
  }
  return '';
}

function googleTopLevelArrayItems(raw){
  raw=String(raw||'').trim();
  if(raw[0]!=='['||raw[raw.length-1]!==']')return [];
  const out=[];
  let start=1,square=0,curly=0,paren=0,quote='',escaped=false;
  for(let i=1;i<raw.length-1;i++){
    const ch=raw[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='[')square++;
    else if(ch===']')square=Math.max(0,square-1);
    else if(ch==='{')curly++;
    else if(ch==='}')curly=Math.max(0,curly-1);
    else if(ch==='(')paren++;
    else if(ch===')')paren=Math.max(0,paren-1);
    else if(ch===','&&!square&&!curly&&!paren){out.push(raw.slice(start,i).trim());start=i+1;}
  }
  out.push(raw.slice(start,-1).trim());
  return out;
}

function googleTokenFromDataArray(raw){
  const parts=googleTopLevelArrayItems(raw);
  if(parts.length<3)return null;
  const m=/^["']([A-Za-z0-9_-]{1,4096})["']$/.exec(parts[2]||'');
  return m?m[1]:null;
}

function extractGoogleInitialPageToken(html){
  const text=String(html||'');
  const callbackRx=/AF_initDataCallback\(/g;
  for(const callback of text.matchAll(callbackRx)){
    const callbackStart=(callback.index||0)+callback[0].length;
    const callbackEnd=text.indexOf(');</scr'+'ipt>',callbackStart);
    const end=callbackEnd>=0?callbackEnd:Math.min(text.length,callbackStart+8*1024*1024);
    const chunk=text.slice(callbackStart,end);
    const dataMatch=/\bdata\s*:\s*/.exec(chunk);
    if(!dataMatch)continue;
    let pos=dataMatch.index+dataMatch[0].length;
    const tail=chunk.slice(pos);
    if(/^function\s*\(/.test(tail)){
      const returnMatch=/\breturn\s*/.exec(tail.slice(0,512));
      if(!returnMatch)continue;
      pos+=returnMatch.index+returnMatch[0].length;
    }
    while(/\s/.test(chunk[pos]||''))pos++;
    if(chunk[pos]!=='['){
      const nextArray=chunk.indexOf('[',pos);
      if(nextArray<0||nextArray-pos>256)continue;
      pos=nextArray;
    }
    const dataArray=googleBalancedArrayAt(chunk,pos);
    if(!dataArray||!dataArray.includes('googleusercontent.com'))continue;
    const token=googleTokenFromDataArray(dataArray);
    if(token)return token;
  }
  return null;
}

function extractGooglePageRequest(html){
  const m=/snAcKc[^}]*?request:\s*\[\s*"([A-Za-z0-9_-]+)"\s*,\s*null\s*,\s*null\s*,\s*"([A-Za-z0-9_-]+)"/s.exec(String(html||''));
  return m?{albumKey:m[1],authKey:m[2]}:null;
}

function extractGooglePhotoUrlsFromData(dataObj){
  const root=dataObj&&Array.isArray(dataObj.data)?dataObj.data:dataObj;
  const out=[],seen=new Set();
  const add=(raw,w=0,h=0)=>{
    if(typeof raw!=='string'||!/^https:\/\/(?:lh[3-6]\.googleusercontent\.com|lh3\.ggpht\.com)\//i.test(raw))return;
    if(w&&h&&(w<300||h<200))return;
    const u=googlePhotoSizedUrl(raw);
    if(u&&!seen.has(u)){seen.add(u);out.push(u);}
  };
  const walk=(node,depth=0)=>{
    if(depth>18||out.length>=GOOGLE_PHOTOS_MAX_ITEMS)return;
    if(Array.isArray(node)){
      if(typeof node[0]==='string'&&Number.isFinite(Number(node[1]))&&Number.isFinite(Number(node[2])))add(node[0],Number(node[1]),Number(node[2]));
      for(const child of node)walk(child,depth+1);
    }else if(node&&typeof node==='object'){for(const child of Object.values(node))walk(child,depth+1);}
  };
  walk(root);
  if(!out.length){
    const broad=JSON.stringify(root||'').match(/https:\/\/(?:lh[3-6]\.googleusercontent\.com|lh3\.ggpht\.com)\/[^\\"'<>\s,\]]+/gi)||[];
    for(const raw of broad){add(raw);if(out.length>=GOOGLE_PHOTOS_MAX_ITEMS)break;}
  }
  return out;
}

function parseGoogleBatchPage(body){
  let text=String(body||'').trimStart();
  if(text.startsWith(")]}'"))text=text.slice(4).trimStart();
  const line=text.split(/\r?\n/).find(x=>x.trimStart().startsWith('[['));
  if(!line)return null;
  try{
    const outer=JSON.parse(line);
    if(!Array.isArray(outer))return null;
    const entry=outer.find(x=>Array.isArray(x)&&x[0]==='wrb.fr'&&x[1]==='snAcKc'&&typeof x[2]==='string');
    if(!entry)return null;
    const data=JSON.parse(entry[2]);
    if(!Array.isArray(data))return null;
    return {data,nextPageToken:typeof data[2]==='string'&&data[2]?data[2]:null};
  }catch(e){
    console.warn('Google Photos pagination response parse failed',e);
    return null;
  }
}

async function fetchGoogleAlbumPage(request,pageToken){
  const q=new URLSearchParams({albumKey:request.albumKey,authKey:request.authKey,pageToken});
  const res=await resilientFetch(serverPath('/gphotos-page?'+q.toString()),{cache:'no-store'},{timeoutMs:35000,retry:false});
  LibreDisplayRuntime.getModule('remote').noteCacheResponse('https://photos.google.com/',res);
  if(!res.ok){
    const msg=await res.text().catch(()=>res.statusText);
    throw new Error('Google Photos pagination HTTP '+res.status+(msg?' — '+msg:''));
  }
  const page=parseGoogleBatchPage(await res.text());
  if(!page)throw new Error('Could not parse a Google Photos continuation page');
  return page;
}

async function extractAllGooglePhotoUrls(html){
  const merged=[];
  const seen=new Set();
  const add=(items)=>{
    for(const u of items||[]){
      if(!u||seen.has(u))continue;
      seen.add(u);merged.push(u);
      if(merged.length>=GOOGLE_PHOTOS_MAX_ITEMS)return false;
    }
    return true;
  };
  add(extractGooglePhotoUrls(html));
  if(merged.length>=GOOGLE_PHOTOS_MAX_ITEMS)return {urls:merged,paginated:false,limitReached:true,pages:1};

  let token=extractGoogleInitialPageToken(html);
  if(!token)return {urls:merged,paginated:false,limitReached:false,pages:1};
  const request=extractGooglePageRequest(html);
  if(!request)throw new Error('Google Photos provided another page, but LibreDisplay could not read the pagination request. Reload the album or update LibreDisplay.');

  let pages=1;
  const seenTokens=new Set();
  while(token&&merged.length<GOOGLE_PHOTOS_MAX_ITEMS){
    if(seenTokens.has(token))throw new Error('Google Photos returned a repeated continuation token');
    seenTokens.add(token);
    const page=await fetchGoogleAlbumPage(request,token);
    pages++;
    add(extractGooglePhotoUrlsFromData(page.data));
    token=page.nextPageToken;
  }
  return {urls:merged,paginated:pages>1,limitReached:merged.length>=GOOGLE_PHOTOS_MAX_ITEMS,pages};
}


LibreDisplayRuntime.exposeModule("backgrounds", {decodeGoogleMarkup,googlePhotoSizedUrl,extractGooglePhotoUrls,googleBalancedArrayAt,googleTopLevelArrayItems,googleTokenFromDataArray,extractGoogleInitialPageToken,extractGooglePageRequest,extractGooglePhotoUrlsFromData,parseGoogleBatchPage,fetchGoogleAlbumPage,extractAllGooglePhotoUrls}, {
  "GOOGLE_PHOTOS_MAX_ITEMS": {configurable:true,get:()=>GOOGLE_PHOTOS_MAX_ITEMS}
}, {globals:false});
}
// End source section: /js/backgrounds/google-photos.js

// LibreDisplay source section: /js/backgrounds/media.js
{
// Background media helpers for still images, HTML5 video, and raw Motion JPEG streams.
const {serverPath}=LibreDisplayRuntime.getModule('bootstrap');
const VIDEO_EXTENSIONS=new Set(['.mp4','.webm','.ogv','.m4v','.mov']);
const MJPEG_EXTENSIONS=new Set(['.mjpg','.mjpeg','.mpjpg']);
const MOTION_IMAGE_EXTENSIONS=new Set(['.gif']);
function backgroundMediaPath(value){const raw=String(value||'');try{const u=new URL(raw,location.href),p=u.searchParams.get('path');return decodeURIComponent(p||u.pathname||raw).toLowerCase();}catch(_e){return raw.toLowerCase();}}
function backgroundMediaKind(value){const raw=String(value||'');if(raw.startsWith('/media-mjpeg?'))return 'mjpeg';const path=backgroundMediaPath(raw),dot=path.lastIndexOf('.'),ext=dot>=0?path.slice(dot):'';if(MJPEG_EXTENSIONS.has(ext))return 'mjpeg';if(VIDEO_EXTENSIONS.has(ext))return 'video';return 'image';}
function backgroundMediaIsMotion(value){const path=backgroundMediaPath(value),dot=path.lastIndexOf('.'),ext=dot>=0?path.slice(dot):'';return backgroundMediaKind(value)!=='image'||MOTION_IMAGE_EXTENSIONS.has(ext);}
function backgroundMediaAssetUrl(value){const raw=String(value||'');return raw.startsWith('/media?')||raw.startsWith('/media-mjpeg?')?serverPath(raw):serverPath('/proxy?url='+encodeURIComponent(raw));}
function backgroundLayerMedia(layer,kind=null){if(!layer)return null;const resolved=kind||layer.dataset.mediaKind||'image';return resolved==='video'?layer.querySelector('video'):layer.querySelector('img');}
function backgroundMediaHasVisual(layer){if(!layer)return false;const kind=layer.dataset.mediaKind||'image',el=backgroundLayerMedia(layer,kind);return kind==='video'?!!(el&&el.readyState>=2&&el.videoWidth>0):!!(el&&el.complete&&el.naturalWidth>0);}
function resetBackgroundLayerMedia(layer){if(!layer)return;const img=layer.querySelector('img'),video=layer.querySelector('video');if(video){try{video.pause();}catch(_e){}video.removeAttribute('src');video.load?.();video.style.display='none';}if(img){img.removeAttribute('src');img.style.display='none';}layer.dataset.mediaKind='';layer.dataset.remoteUrl='';}
async function activateBackgroundLayerMedia(layer){if(!layer)return;const kind=layer.dataset.mediaKind||'image',img=layer.querySelector('img'),video=layer.querySelector('video');if(img)img.style.display=kind==='video'?'none':'block';if(video){video.style.display=kind==='video'?'block':'none';if(kind==='video'&&!document.documentElement.classList.contains('ld-reduce-motion')){try{await video.play();}catch(_e){}}}}
function deactivateBackgroundLayerMedia(layer,clear=false){if(!layer)return;const video=layer.querySelector('video');if(video)try{video.pause();}catch(_e){}if(clear)resetBackgroundLayerMedia(layer);}
function loadBackgroundMedia(layer,remoteUrl,priority='low'){
  if(!layer||!remoteUrl)return Promise.resolve(false);const kind=backgroundMediaKind(remoteUrl),assetUrl=backgroundMediaAssetUrl(remoteUrl),img=layer.querySelector('img'),video=layer.querySelector('video');if(!img||!video)return Promise.resolve(false);
  if(layer.dataset.remoteUrl===remoteUrl&&layer.dataset.mediaKind===kind&&backgroundMediaHasVisual(layer))return Promise.resolve(true);
  deactivateBackgroundLayerMedia(layer,false);if(kind==='video')img.removeAttribute('src');else{video.removeAttribute('src');video.load?.();}
  layer.dataset.remoteUrl=remoteUrl;layer.dataset.mediaKind=kind;
  if(kind==='video')return new Promise(resolve=>{let settled=false;const done=ok=>{if(settled)return;settled=true;video.onloadeddata=video.onerror=null;resolve(!!ok&&video.readyState>=2&&video.videoWidth>0);};video.style.display='block';img.style.display='none';video.muted=true;video.loop=true;video.playsInline=true;video.autoplay=false;video.preload='auto';video.onloadeddata=()=>done(true);video.onerror=()=>done(false);video.src=assetUrl;video.load();if(video.readyState>=2)setTimeout(()=>done(true),0);});
  return new Promise(resolve=>{let settled=false;const done=async ok=>{if(settled)return;settled=true;img.onload=img.onerror=null;if(ok&&kind==='image'&&typeof img.decode==='function'){try{await img.decode();}catch(_e){}}resolve(!!ok&&img.naturalWidth>0);};video.style.display='none';img.style.display='block';try{img.fetchPriority=priority;}catch(_e){}img.onload=()=>done(true);img.onerror=()=>done(false);img.src=assetUrl;if(img.complete)setTimeout(()=>done(img.naturalWidth>0),0);});
}
LibreDisplayRuntime.exposeModule('backgrounds',{VIDEO_EXTENSIONS,MJPEG_EXTENSIONS,MOTION_IMAGE_EXTENSIONS,backgroundMediaPath,backgroundMediaKind,backgroundMediaIsMotion,backgroundMediaAssetUrl,backgroundLayerMedia,backgroundMediaHasVisual,resetBackgroundLayerMedia,activateBackgroundLayerMedia,deactivateBackgroundLayerMedia,loadBackgroundMedia},{},{globalFunctions:[],globalStates:[]});
}
// End source section: /js/backgrounds/media.js

// LibreDisplay source section: /js/backgrounds/index.js
{
// Background sources, local folders, preload, transition, and rotation runtime.
const configApi=LibreDisplayRuntime.getModule('config');

const {serverPath}=LibreDisplayRuntime.getModule('bootstrap');
const {fetchRemoteText,escHtml,scaledClamp,resilientFetch,uiCfg}=LibreDisplayRuntime.getModule('shared');
const {extractAllGooglePhotoUrls,GOOGLE_PHOTOS_MAX_ITEMS,backgroundMediaKind,backgroundMediaIsMotion,backgroundMediaHasVisual,resetBackgroundLayerMedia,activateBackgroundLayerMedia,deactivateBackgroundLayerMedia,loadBackgroundMedia}=LibreDisplayRuntime.getModule('backgrounds');

let bgTimer=null;
const LAST_BACKGROUND_KEY='libredisplay_last_background_v2';
const LAST_BACKGROUND_CACHE='libredisplay-last-background-v1';
const HOT_BACKGROUND_CACHE='libredisplay-background-hot-v1';
const RESERVE_BACKGROUND_CACHE='libredisplay-background-reserve-v1';
const BACKGROUND_CACHE_INDEX_KEY='libredisplay_background_cache_index_v1';
const HOT_BACKGROUND_LIMIT=10;
let lastBackgroundObjectUrl='';
let backgroundCacheFillTimer=null;
function backgroundSourceFingerprint(source=cfg){
  const kind=String(source?.backgroundSource||'none');
  if(kind==='stock')return ['stock',String(source?.stockCategory||''),String(source?.stockQuery||''),String(source?.stockResolution||'')].join('|');
  if(kind==='google')return ['google',String(source?.photosUrl||'').trim()].join('|');
  if(kind==='folders'){const folders=[...(source?.mediaFolders||[])].map(x=>String(x||'').trim()).filter(Boolean).sort();return ['folders',source?.mediaRecursive===false?'0':'1',...folders].join('|');}
  return kind;
}
function rememberLastBackground(remoteUrl,persistAsset=true){
  try{if(remoteUrl)localStorage.setItem(LAST_BACKGROUND_KEY,JSON.stringify({url:remoteUrl,source:cfg.backgroundSource,sourceKey:backgroundSourceFingerprint(cfg),at:Date.now()}));}catch(_e){}
  if(remoteUrl&&persistAsset)void persistLastBackgroundAsset(remoteUrl);
}
async function persistLastBackgroundAsset(remoteUrl){
  if(!remoteUrl||!('caches' in globalThis))return false;
  try{
    if(backgroundMediaKind(remoteUrl)!=='image')return false;const assetUrl=backgroundAssetUrl(remoteUrl),res=await resilientFetch(assetUrl,{cache:'force-cache'},{timeoutMs:12000,attempts:1,retry:false});
    if(!res.ok)return false;
    const type=String(res.headers.get('Content-Type')||'').toLowerCase();if(type&&!type.startsWith('image/'))return false;
    const cache=await caches.open(LAST_BACKGROUND_CACHE);
    const old=await cache.keys();await Promise.all(old.filter(req=>req.url!==new URL(assetUrl,location.href).href).map(req=>cache.delete(req)));
    await cache.put(assetUrl,res.clone());return true;
  }catch(_e){return false;}
}
async function clearLastBackgroundAsset(){
  if(!('caches' in globalThis))return false;
  try{return await caches.delete(LAST_BACKGROUND_CACHE);}catch(_e){return false;}
}
async function loadCachedLastBackground(layer,remoteUrl){
  if(!layer||!remoteUrl||!('caches' in globalThis))return false;
  try{
    if(backgroundMediaKind(remoteUrl)!=='image')return false;const assetUrl=backgroundAssetUrl(remoteUrl),cache=await caches.open(LAST_BACKGROUND_CACHE),res=await cache.match(assetUrl);
    if(!res||!res.ok)return false;
    const blob=await res.blob();if(!blob.size||!String(blob.type||'image/').startsWith('image/'))return false;
    const img=backgroundLayerImage(layer);if(!img)return false;
    if(lastBackgroundObjectUrl){try{URL.revokeObjectURL(lastBackgroundObjectUrl);}catch(_e){}}
    lastBackgroundObjectUrl=URL.createObjectURL(blob);
    const ok=await new Promise(resolve=>{let settled=false;const finish=async good=>{if(settled)return;settled=true;img.onload=null;img.onerror=null;if(good&&typeof img.decode==='function'){try{await img.decode();}catch(_e){}}resolve(!!good&&img.naturalWidth>0);};img.onload=()=>finish(true);img.onerror=()=>finish(false);layer.dataset.remoteUrl=remoteUrl;img.src=lastBackgroundObjectUrl;if(img.complete)setTimeout(()=>finish(img.naturalWidth>0),0);});
    return ok;
  }catch(_e){return false;}
}
async function restoreLastBackground(cacheOnly=false){
  if(cfg.backgroundSource==='none'||configApi.bgLastUrl)return false;
  let saved=null;try{saved=JSON.parse(localStorage.getItem(LAST_BACKGROUND_KEY)||'null');}catch(_e){}
  if(!saved?.url||saved.source!==cfg.backgroundSource||Date.now()-Number(saved.at||0)>30*24*60*60*1000)return false;
  if(saved.sourceKey&&saved.sourceKey!==backgroundSourceFingerprint(cfg))return false;
  const layer=activeBackgroundLayer();if(!layer)return false;
  let ok=await loadCachedLastBackground(layer,saved.url);
  if(!ok&&!cacheOnly)ok=await loadBackgroundIntoLayer(layer,saved.url,'high');
  if(ok){layer.style.zIndex='0';await activateBackgroundLayerMedia(layer);layer.classList.add('show');configApi.bgActiveLayerId=layer.id;configApi.bgLastUrl=saved.url;rememberLastBackground(saved.url,false);return true;}
  return false;
}

function localProxyUrl(remoteUrl){
  return serverPath('/proxy?url='+encodeURIComponent(remoteUrl));
}
function backgroundAssetUrl(value){
  const raw=String(value||'');
  return raw.startsWith('/media?')?serverPath(raw):localProxyUrl(raw);
}
function backgroundCacheIndex(){try{const row=JSON.parse(localStorage.getItem(BACKGROUND_CACHE_INDEX_KEY)||'null');return row&&row.sourceKey===backgroundSourceFingerprint(cfg)?row:null;}catch(_e){return null;}}
function saveBackgroundCacheIndex(hot,reserve){try{localStorage.setItem(BACKGROUND_CACHE_INDEX_KEY,JSON.stringify({sourceKey:backgroundSourceFingerprint(cfg),hot:[...hot],reserve:[...reserve],at:Date.now()}));}catch(_e){}}
function cacheableStillBackground(url){return !!url&&backgroundMediaKind(url)==='image'&&!backgroundMediaIsMotion(url);}
function backgroundReserveCandidateLimit(){const mb=Math.max(0,Math.min(384,Number(cfg.backgroundOfflineCacheMaxMb)||0));return mb>0?Math.min(256,Math.ceil(mb/1.5)):0;}
async function backgroundCacheBudgetBytes(){const selectedMb=Math.max(0,Math.min(384,Number(cfg.backgroundOfflineCacheMaxMb)||0));if(cfg.backgroundOfflineCacheEnabled===false||selectedMb<=0)return 0;const selected=selectedMb*1024*1024;try{const estimate=await navigator.storage?.estimate?.(),quota=Number(estimate?.quota),usage=Math.max(0,Number(estimate?.usage)||0);if(Number.isFinite(quota)&&quota>0){const free=Math.max(0,quota-usage),quotaShare=quota*.18,freeShare=free*.55;return Math.max(0,Math.min(selected,quotaShare,freeShare));}}catch(_e){}return Math.min(selected,192*1024*1024);}
async function cachedResponseBytes(cache){let total=0;try{for(const req of await cache.keys()){const res=await cache.match(req),size=Number(res?.headers?.get('content-length'))||0;if(size>0)total+=size;}}catch(_e){}return total;}
async function enforceBackgroundCacheBudget(hotUrls,reserveUrls,budget){const hot=[...hotUrls],reserve=[...reserveUrls];if(!('caches' in globalThis))return {hot,reserve,used:0};try{const hotCache=await caches.open(HOT_BACKGROUND_CACHE),reserveCache=await caches.open(RESERVE_BACKGROUND_CACHE);let used=(await cachedResponseBytes(hotCache))+(await cachedResponseBytes(reserveCache));for(const [cache,list] of [[reserveCache,reserve],[hotCache,hot]])while(used>budget&&list.length){const url=list.pop(),asset=backgroundAssetUrl(url),res=await cache.match(asset),size=Number(res?.headers?.get('content-length'))||0;await cache.delete(asset);used=Math.max(0,used-size);}return {hot,reserve,used};}catch(_e){return {hot,reserve,used:0};}}
async function trimBackgroundCache(cacheName,keepUrls){if(!('caches' in globalThis))return;try{const cache=await caches.open(cacheName),keep=new Set(keepUrls.map(backgroundAssetUrl).map(url=>new URL(url,location.href).href));for(const req of await cache.keys())if(!keep.has(req.url))await cache.delete(req);}catch(_e){}}
function backgroundCacheYield(){return new Promise(resolve=>{const slow=!!navigator.connection?.saveData;if(typeof requestIdleCallback==='function')requestIdleCallback(()=>resolve(),{timeout:slow?650:300});else setTimeout(resolve,slow?220:90);});}
async function cacheBackgroundAsset(cacheName,remoteUrl,remainingBytes){if(!cacheableStillBackground(remoteUrl)||!('caches' in globalThis)||remainingBytes<=0)return {ok:false,size:0};const assetUrl=backgroundAssetUrl(remoteUrl);try{const cache=await caches.open(cacheName),existing=await cache.match(assetUrl);if(existing)return {ok:true,size:Number(existing.headers.get('content-length'))||0,added:false};const res=await resilientFetch(assetUrl,{cache:'force-cache'},{timeoutMs:15000,attempts:1,retry:false});if(!res.ok)return {ok:false,size:0};const type=String(res.headers.get('content-type')||'').toLowerCase(),size=Number(res.headers.get('content-length'))||0;if(type&&!type.startsWith('image/'))return {ok:false,size:0};if(!size||size>32*1024*1024||size>remainingBytes)return {ok:false,size:0};await cache.put(assetUrl,res.clone());return {ok:true,size,added:true};}catch(_e){return {ok:false,size:0};}}
async function fillBackgroundCaches(urls){
  if(!('caches' in globalThis))return false;const still=[...new Set((urls||[]).filter(cacheableStillBackground))],hot=still.slice(0,HOT_BACKGROUND_LIMIT),reserve=cfg.backgroundOfflineCacheEnabled===false?[]:still.slice(HOT_BACKGROUND_LIMIT,HOT_BACKGROUND_LIMIT+backgroundReserveCandidateLimit());
  await trimBackgroundCache(HOT_BACKGROUND_CACHE,hot);await trimBackgroundCache(RESERVE_BACKGROUND_CACHE,reserve);let budget=await backgroundCacheBudgetBytes(),hotCache=await caches.open(HOT_BACKGROUND_CACHE),reserveCache=await caches.open(RESERVE_BACKGROUND_CACHE),used=(await cachedResponseBytes(hotCache))+(await cachedResponseBytes(reserveCache));
  for(const [name,list] of [[HOT_BACKGROUND_CACHE,hot],[RESERVE_BACKGROUND_CACHE,reserve]])for(const url of list){if(used>=budget)break;const row=await cacheBackgroundAsset(name,url,budget-used);if(row.ok&&row.added)used+=row.size;await backgroundCacheYield();}
  const actualHot=[],actualReserve=[];for(const [name,list,out] of [[HOT_BACKGROUND_CACHE,hot,actualHot],[RESERVE_BACKGROUND_CACHE,reserve,actualReserve]]){const cache=await caches.open(name);for(const url of list)if(await cache.match(backgroundAssetUrl(url)))out.push(url);}
  const bounded=await enforceBackgroundCacheBudget(actualHot,actualReserve,budget);saveBackgroundCacheIndex(bounded.hot,bounded.reserve);return true;
}
function scheduleBackgroundCacheFill(urls=configApi.bgImages){if(backgroundCacheFillTimer)clearTimeout(backgroundCacheFillTimer);const list=[...(urls||[])];backgroundCacheFillTimer=setTimeout(()=>{backgroundCacheFillTimer=null;void fillBackgroundCaches(list);},4500);}
async function loadBackgroundFromCache(layer,remoteUrl){
  if(!layer||!cacheableStillBackground(remoteUrl)||!('caches' in globalThis))return false;try{const assetUrl=backgroundAssetUrl(remoteUrl);let res=null;for(const name of [HOT_BACKGROUND_CACHE,RESERVE_BACKGROUND_CACHE]){const cache=await caches.open(name);res=await cache.match(assetUrl);if(res?.ok)break;}if(!res?.ok)return false;const blob=await res.blob();if(!blob.size||!String(blob.type||'image/').startsWith('image/'))return false;const img=backgroundLayerImage(layer),video=layer.querySelector('video');if(!img)return false;if(layer._ldCacheObjectUrl){try{URL.revokeObjectURL(layer._ldCacheObjectUrl);}catch(_e){}}layer._ldCacheObjectUrl=URL.createObjectURL(blob);if(video){try{video.pause();}catch(_e){}video.removeAttribute('src');video.style.display='none';}layer.dataset.remoteUrl=remoteUrl;layer.dataset.mediaKind='image';img.style.display='block';const ok=await new Promise(resolve=>{let settled=false;const done=async good=>{if(settled)return;settled=true;img.onload=img.onerror=null;if(good&&typeof img.decode==='function'){try{await img.decode();}catch(_e){}}resolve(!!good&&img.naturalWidth>0);};img.onload=()=>done(true);img.onerror=()=>done(false);img.src=layer._ldCacheObjectUrl;if(img.complete)setTimeout(()=>done(img.naturalWidth>0),0);});return ok;}catch(_e){return false;}
}
async function restoreBackgroundsFromOfflineCache(){
  const row=backgroundCacheIndex(),candidates=[...(row?.hot||[]),...(row?.reserve||[])].filter(cacheableStillBackground);if(!candidates.length)return false;configApi.bgSourceImages=[...new Set(candidates)];prepareBackgroundOrder(configApi.bgSourceImages,false);setBackgroundStatus(`${configApi.bgSourceImages.length} cached still backgrounds available · offline reserve mode`);const ok=await showBg(configApi.bgIdx,0,configApi.bgSourceSerial);if(ok)scheduleBackgroundRotation();return ok;
}
function mediaFoldersFromText(value){
  return [...new Set(String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))].slice(0,32);
}
function mediaFoldersFromForm(){
  return mediaFoldersFromText(document.getElementById('s-media-folders')?.value||'');
}
let mediaBrowsePath='';
async function loadMediaFolderBrowser(path=''){
  const list=document.getElementById('media-browser-list'),where=document.getElementById('media-browser-path');
  if(list)list.innerHTML='<div class="settings-note" style="padding:10px;">Loading folders…</div>';
  try{
    const url=serverPath('/api/media/browse'+(path?'?path='+encodeURIComponent(path):''));
    const res=await resilientFetch(url,{cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
    mediaBrowsePath=data.path||'';
    if(where)where.textContent=mediaBrowsePath||'Folder browser';
    const panel=document.getElementById('media-folder-browser');if(panel)panel.dataset.parent=data.parent||'';
    if(list){
      list.innerHTML='';
      for(const d of data.directories||[]){
        const b=document.createElement('button');b.type='button';b.className='media-dir';
        b.innerHTML='<span>📁</span><span class="media-dir-name"></span>';b.querySelector('.media-dir-name').textContent=d.name||d.path;
        b.onclick=()=>loadMediaFolderBrowser(d.path);list.appendChild(b);
      }
      if(!(data.directories||[]).length)list.innerHTML='<div class="settings-note" style="padding:10px;">No subfolders here.</div>';
    }
  }catch(e){
    if(where)where.textContent='Folder browser unavailable';
    if(list)list.innerHTML='<div class="settings-note" style="padding:10px;color:#fecaca;">'+escHtml(e.message||String(e))+'</div>';
  }
}
function openMediaFolderBrowser(){
  const panel=document.getElementById('media-folder-browser');if(!panel)return;
  panel.classList.toggle('show');
  if(panel.classList.contains('show'))loadMediaFolderBrowser(mediaBrowsePath||mediaFoldersFromForm()[0]||'');
}
function browseMediaParent(){
  const parent=document.getElementById('media-folder-browser')?.dataset.parent||'';
  if(parent)loadMediaFolderBrowser(parent);
}
function addCurrentMediaFolder(){
  if(!mediaBrowsePath)return;
  const input=document.getElementById('s-media-folders');if(!input)return;
  const values=mediaFoldersFromText(input.value);if(!values.includes(mediaBrowsePath))values.push(mediaBrowsePath);
  input.value=values.join('\n');markSettingsDirty();scanFolderBackgroundsFromForm();
}
async function loadFolderBackgrounds(paths=cfg.mediaFolders,recursive=cfg.mediaRecursive,motionEnabled=cfg.backgroundMotionEnabled){
  paths=[...new Set((paths||[]).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,32);
  if(!paths.length){setBackgroundStatus('Add at least one local or mounted NAS picture folder.',true);return;}
  try{
    const sourceSerial=++configApi.bgSourceSerial;
    if(bgTimer){clearInterval(bgTimer);bgTimer=null;}
    clearBackgroundPrepared(true);
    configApi.bgImages=[];configApi.bgSourceImages=[];configApi.bgIdx=0;configApi.bgLastUrl='';
    setBackgroundStatus('Scanning local / NAS media folders…');
    const res=await resilientFetch(serverPath('/api/media/scan'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths,recursive:recursive!==false}),cache:'no-store'},{timeoutMs:60000,retry:false});
    const data=await res.json().catch(()=>({}));
    if(sourceSerial!==configApi.bgSourceSerial)return;
    if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
    const allMedia=(data.images||[]).map(x=>x.url).filter(Boolean);configApi.bgSourceImages=motionEnabled===false?allMedia.filter(url=>!backgroundMediaIsMotion(url)):allMedia;
    if(!configApi.bgSourceImages.length){
      const problems=(data.sources||[]).filter(x=>x.error).map(x=>x.path+': '+x.error);
      throw new Error(problems[0]||(motionEnabled===false?'No still-image backgrounds were found. Enable animated / video backgrounds to include moving media.':'No supported image, video, or Motion JPEG files were found in the selected folders'));
    }
    prepareBackgroundOrder(configApi.bgSourceImages,false);
    const sourceCount=(data.sources||[]).filter(x=>Number(x.count)>0).length;
    const limit=data.limitReached?' · scan limit reached':'';
    const motionSkipped=allMedia.length-configApi.bgSourceImages.length,motionNote=motionSkipped>0?` · ${motionSkipped} moving item${motionSkipped===1?'':'s'} skipped`:'';setBackgroundStatus(`${configApi.bgSourceImages.length} local/network media items · ${sourceCount} source${sourceCount===1?'':'s'}${motionNote}${limit} · ${cfg.photoIntervalSec?formatBackgroundInterval(cfg.photoIntervalSec):'rotation off'}`);
    await showBg(configApi.bgIdx,0,sourceSerial);
    if(sourceSerial===configApi.bgSourceSerial){scheduleBackgroundRotation();scheduleBackgroundCacheFill(configApi.bgImages);}
  }catch(e){
    if(await restoreBackgroundsFromOfflineCache())return;
    console.warn('folder background error',e);
    setBackgroundStatus('Folder background error: '+(e?.message||String(e)),true);
  }
}
function scanFolderBackgroundsFromForm(){
  loadFolderBackgrounds(mediaFoldersFromForm(),document.getElementById('s-media-recursive')?.checked!==false,document.getElementById('s-background-motion')?.checked===true);
}

function setBackgroundStatus(text,error=false){
  configApi.lastBackgroundStatus={text:String(text||''),error:!!error,updatedAt:Date.now()};
  setTimeout(updateSettingsOverview,0);
  const el=document.getElementById('background-status');
  if(!el)return;
  el.style.display=text?'block':'none';
  el.style.color=error?'#fecaca':'rgba(255,255,255,.58)';
  el.textContent=text||'';
}

function shuffledCopy(items){
  const out=[...items];
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}

function prepareBackgroundOrder(images,keepCurrent=false){
  const source=[...images];
  if(!source.length){configApi.bgImages=[];configApi.bgIdx=0;return;}
  const current=keepCurrent?configApi.bgImages[configApi.bgIdx]:null;
  if(cfg.photoOrder==='shuffle'){
    configApi.bgImages=shuffledCopy(source);
    if(current&&configApi.bgImages.length>1&&configApi.bgImages[0]===current){
      [configApi.bgImages[0],configApi.bgImages[1]]=[configApi.bgImages[1],configApi.bgImages[0]];
    }
    configApi.bgIdx=0;
    return;
  }
  configApi.bgImages=source;
  if(current&&keepCurrent){
    const at=configApi.bgImages.indexOf(current);
    configApi.bgIdx=at>=0?at:0;
  }else{
    configApi.bgIdx=cfg.photoRandomStart&&configApi.bgImages.length>1?Math.floor(Math.random()*configApi.bgImages.length):0;
  }
}

function chooseNextBackgroundIndex(){
  if(configApi.bgImages.length<=1)return 0;
  if(cfg.photoOrder==='random'){
    let next=configApi.bgIdx;
    while(next===configApi.bgIdx)next=Math.floor(Math.random()*configApi.bgImages.length);
    return next;
  }
  if(cfg.photoOrder==='shuffle'&&configApi.bgIdx>=configApi.bgImages.length-1){
    const previous=configApi.bgLastUrl||configApi.bgImages[configApi.bgIdx];
    configApi.bgImages=shuffledCopy(configApi.bgSourceImages);
    if(configApi.bgImages.length>1&&configApi.bgImages[0]===previous){
      [configApi.bgImages[0],configApi.bgImages[1]]=[configApi.bgImages[1],configApi.bgImages[0]];
    }
    return 0;
  }
  return (configApi.bgIdx+1)%configApi.bgImages.length;
}

function nextBackgroundIndex(){
  if(configApi.bgPreparedIndex!==null&&configApi.bgPreparedUrl&&configApi.bgImages[configApi.bgPreparedIndex]===configApi.bgPreparedUrl)return configApi.bgPreparedIndex;
  return chooseNextBackgroundIndex();
}

function backgroundLayerById(id){return document.getElementById(id);}
function backgroundLayerImage(layer){return layer?.querySelector('img')||null;}
function activeBackgroundLayer(){return backgroundLayerById(configApi.bgActiveLayerId)||backgroundLayerById('bg');}
function inactiveBackgroundLayer(){return backgroundLayerById(configApi.bgActiveLayerId==='bg'?'bg-next':'bg');}
function backgroundTransitionDurationMs(layer=null){
  if(document.documentElement.classList.contains('ld-reduce-motion'))return 0;
  const el=layer||inactiveBackgroundLayer();
  if(el){
    const css=getComputedStyle(el),durations=String(css.transitionDuration||'').split(','),delays=String(css.transitionDelay||'').split(',');
    const toMs=value=>{const v=String(value||'').trim();return v.endsWith('ms')?(parseFloat(v)||0):v.endsWith('s')?(parseFloat(v)||0)*1000:0;};
    let maxMs=0;
    for(let i=0;i<durations.length;i++)maxMs=Math.max(maxMs,toMs(durations[i])+toMs(delays[Math.min(i,delays.length-1)]));
    if(maxMs>0)return maxMs;
  }
  return Math.max(0,Number(cfg.bgTransitionSec)||0)*1000;
}
function nextAnimationFrame(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
function waitForBackgroundLayerVisible(layer){
  const ms=backgroundTransitionDurationMs(layer);
  if(ms<=5)return Promise.resolve();
  return new Promise(resolve=>{
    let settled=false;
    const done=()=>{if(settled)return;settled=true;layer.removeEventListener('transitionend',onEnd);clearTimeout(timer);resolve();};
    const onEnd=e=>{if(e.target===layer&&e.propertyName==='opacity')done();};
    const timer=setTimeout(done,ms+120);
    layer.addEventListener('transitionend',onEnd);
  });
}
function clearBackgroundPrepared(clearLayer=false){
  configApi.bgPreparedIndex=null;configApi.bgPreparedUrl='';configApi.bgPreparePromise=null;
  if(clearLayer){const layer=inactiveBackgroundLayer();if(layer&&!layer.classList.contains('show'))resetBackgroundLayerMedia(layer);}
}
function clearBackgroundLayers(){
  clearBackgroundPrepared(false);
  for(const id of ['bg','bg-next']){
    const layer=backgroundLayerById(id);if(!layer)continue;layer.classList.remove('show');layer.style.zIndex='0';resetBackgroundLayerMedia(layer);
  }
  configApi.bgActiveLayerId='bg';
}
async function loadBackgroundIntoLayer(layer,remoteUrl,priority='low'){if(cacheableStillBackground(remoteUrl)&&navigator.onLine===false&&await loadBackgroundFromCache(layer,remoteUrl))return true;const ok=await loadBackgroundMedia(layer,remoteUrl,priority);if(ok)return true;return cacheableStillBackground(remoteUrl)?loadBackgroundFromCache(layer,remoteUrl):false;}
function preloadBackgroundIndex(idx){
  if(!uiCfg().photoPreload||!configApi.bgImages.length)return Promise.resolve(false);
  const i=((idx%configApi.bgImages.length)+configApi.bgImages.length)%configApi.bgImages.length;
  const remoteUrl=configApi.bgImages[i];if(!remoteUrl)return Promise.resolve(false);
  const layer=inactiveBackgroundLayer();
  return loadBackgroundIntoLayer(layer,remoteUrl,'low');
}
function prepareUpcomingBackground(){
  if(!uiCfg().photoPreload||configApi.bgImages.length<=1){clearBackgroundPrepared(false);return;}
  let idx=null;
  if(cfg.photoOrder==='random'){
    idx=configApi.bgIdx;
    while(idx===configApi.bgIdx)idx=Math.floor(Math.random()*configApi.bgImages.length);
  }else if(cfg.photoOrder==='shuffle'&&configApi.bgIdx>=configApi.bgImages.length-1){
    // The next shuffle order is intentionally chosen only when rotation occurs.
    // The current image remains visible while that boundary image loads.
    clearBackgroundPrepared(false);return;
  }else{
    idx=(configApi.bgIdx+1)%configApi.bgImages.length;
  }
  const remoteUrl=configApi.bgImages[idx];
  if(configApi.bgPreparedIndex===idx&&configApi.bgPreparedUrl===remoteUrl&&configApi.bgPreparePromise)return;
  configApi.bgPreparedIndex=idx;configApi.bgPreparedUrl=remoteUrl;
  configApi.bgPreparePromise=preloadBackgroundIndex(idx).then(ok=>{
    if(!ok&&configApi.bgPreparedUrl===remoteUrl){configApi.bgPreparedIndex=null;configApi.bgPreparedUrl='';configApi.bgPreparePromise=null;}
    return ok;
  });
}

async function revealBackgroundLayer(layer,remoteUrl){
  const active=activeBackgroundLayer();
  const hasCurrent=!!(active&&active.classList.contains('show')&&backgroundMediaHasVisual(active));
  layer.style.zIndex='1';
  if(active&&active!==layer)active.style.zIndex='0';
  layer.classList.remove('show');
  await nextAnimationFrame();
  await activateBackgroundLayerMedia(layer);layer.classList.add('show');
  await waitForBackgroundLayerVisible(layer);
  if(active&&active!==layer){
    active.style.transition='none';
    active.classList.remove('show');
    void active.offsetWidth;
    active.style.transition='';
    deactivateBackgroundLayerMedia(active,true);
  }
  layer.style.zIndex='0';
  configApi.bgActiveLayerId=layer.id;
  configApi.bgLastUrl=remoteUrl;
  rememberLastBackground(remoteUrl);
}

function scheduleBackgroundRotation(){
  if(bgTimer){clearInterval(bgTimer);bgTimer=null;}
  const sec=Math.max(0,Number(cfg.photoIntervalSec)||0);
  if(sec<=0)return;
  if(cfg.backgroundSource==='stock'){
    bgTimer=setInterval(()=>loadStockBackground(),sec*1000);
    return;
  }
  if((cfg.backgroundSource==='google'||cfg.backgroundSource==='folders')&&configApi.bgImages.length>1){
    bgTimer=setInterval(()=>showBg(nextBackgroundIndex()),sec*1000);
  }
}

function stockSearchTerm(category=cfg.stockCategory,custom=cfg.stockQuery){
  const c=String(category||'nature');
  const q=String(custom||'').trim();
  return c==='custom'?(q||'nature'):c;
}

async function loadStockBackground(category=cfg.stockCategory,custom=cfg.stockQuery,resolution=cfg.stockResolution){
  if(configApi.stockFetchInFlight)return;
  configApi.stockFetchInFlight=true;
  const sourceSerial=++configApi.bgSourceSerial;
  try{
    if(bgTimer){clearInterval(bgTimer);bgTimer=null;}
    clearBackgroundPrepared(true);
    const query=stockSearchTerm(category,custom);
    const dims=/^(\d{3,4})x(\d{3,4})$/.exec(String(resolution||'3840x2160'))||['',3840,2160];
    const w=Number(dims[1]),h=Number(dims[2]);
    setBackgroundStatus(`Loading stock background · ${query}…`);
    let chosen='';
    for(let attempt=0;attempt<3&&!chosen;attempt++){
      const endpoint='https://www.sourcesplash.com/api/random?'+new URLSearchParams({q:query,w:String(w),h:String(h),_t:String(Date.now()+attempt)}).toString();
      const text=await fetchRemoteText(endpoint);
      if(sourceSerial!==configApi.bgSourceSerial)return;
      let data=null;
      try{data=JSON.parse(text);}catch(e){throw new Error('Stock image service returned an unexpected response');}
      const candidate=typeof data?.url==='string'?data.url:'';
      if(candidate&&(!configApi.stockRecentUrls.includes(candidate)||attempt===2))chosen=candidate;
    }
    if(!chosen)throw new Error('Stock image service did not return an image URL');
    configApi.stockRecentUrls.push(chosen);
    if(configApi.stockRecentUrls.length>40)configApi.stockRecentUrls.splice(0,configApi.stockRecentUrls.length-40);
    configApi.bgSourceImages=[...configApi.stockRecentUrls];
    configApi.bgImages=[chosen];
    configApi.bgIdx=0;
    await showBg(0,0,sourceSerial);
    if(sourceSerial!==configApi.bgSourceSerial)return;
    setBackgroundStatus(`Stock background · ${query} · ${w}×${h} requested · ${cfg.photoIntervalSec?formatBackgroundInterval(cfg.photoIntervalSec):'rotation off'}`);
  }catch(e){
    console.warn('stock background error',e);
    setBackgroundStatus('Stock background error: '+(e?.message||String(e)),true);
  }finally{
    configApi.stockFetchInFlight=false;
    if(sourceSerial===configApi.bgSourceSerial)scheduleBackgroundRotation();
  }
}

async function loadPhotos(albumUrl){
  if(!albumUrl){setBackgroundStatus('No Google Photos album configured.');return;}
  try{
    const sourceSerial=++configApi.bgSourceSerial;
    if(bgTimer){clearInterval(bgTimer);bgTimer=null;}
    clearBackgroundPrepared(true);
    configApi.bgImages=[];configApi.bgSourceImages=[];configApi.bgIdx=0;configApi.bgLastUrl='';
    setBackgroundStatus('Loading shared album…');

    const html=await fetchRemoteText(albumUrl);
    if(sourceSerial!==configApi.bgSourceSerial)return;
    const album=await extractAllGooglePhotoUrls(html);
    if(sourceSerial!==configApi.bgSourceSerial)return;
    configApi.bgSourceImages=album.urls;

    if(!configApi.bgSourceImages.length){
      throw new Error('No photo records were found in the shared album page. Make sure Link sharing is enabled.');
    }

    prepareBackgroundOrder(configApi.bgSourceImages,false);
    console.info('Google Photos background: '+configApi.bgSourceImages.length+' candidate images found'+(album.paginated?' across '+album.pages+' pages':''));
    const albumNote=album.limitReached?` · ${GOOGLE_PHOTOS_MAX_ITEMS}-photo limit reached`:(album.paginated?` · ${album.pages} Google pages loaded`:'');
    setBackgroundStatus(`${configApi.bgSourceImages.length} photos found${albumNote} · ${cfg.photoOrder==='shuffle'?'shuffle cycle':cfg.photoOrder==='random'?'random no-repeat':'album order'} · ${cfg.photoIntervalSec?formatBackgroundInterval(cfg.photoIntervalSec):'rotation off'}`);
    await showBg(configApi.bgIdx,0,sourceSerial);
    if(sourceSerial===configApi.bgSourceSerial){scheduleBackgroundRotation();scheduleBackgroundCacheFill(configApi.bgImages);}
  }catch(e){
    if(await restoreBackgroundsFromOfflineCache())return;
    console.warn('photos err',e);
    setBackgroundStatus('Background error: '+(e?.message||String(e)),true);
  }
}

function formatBackgroundInterval(sec){
  sec=Number(sec)||0;
  if(sec<=0)return 'off';
  if(sec<60)return sec+'s';
  if(sec%60===0)return (sec/60)+'m';
  return sec+'s';
}

async function showBg(idx,attempt=0,sourceSerial=configApi.bgSourceSerial){
  if(!configApi.bgImages.length||configApi.bgTransitionBusy||sourceSerial!==configApi.bgSourceSerial)return false;
  configApi.bgTransitionBusy=true;
  try{
    let cursor=((idx%configApi.bgImages.length)+configApi.bgImages.length)%configApi.bgImages.length;
    let tries=Math.max(0,Number(attempt)||0);
    while(tries<configApi.bgImages.length){
      const remoteUrl=configApi.bgImages[cursor];
      if(uiCfg().backgroundMotionEnabled===false&&backgroundMediaIsMotion(remoteUrl)){cursor=(cursor+1)%configApi.bgImages.length;tries++;continue;}
      const layer=inactiveBackgroundLayer();
      let ready=false;
      if(configApi.bgPreparedUrl===remoteUrl&&configApi.bgPreparePromise){
        ready=await configApi.bgPreparePromise;
      }else{
        ready=await loadBackgroundIntoLayer(layer,remoteUrl,'high');
      }
      if(sourceSerial!==configApi.bgSourceSerial)return false;
      if(ready){
        await revealBackgroundLayer(layer,remoteUrl);
        configApi.bgIdx=cursor;
        if(configApi.bgPreparedUrl===remoteUrl)clearBackgroundPrepared(false);
        prepareUpcomingBackground();
        return true;
      }
      console.warn('Could not load a configured background media item');
      if(configApi.bgPreparedUrl===remoteUrl)clearBackgroundPrepared(true);
      cursor=(cursor+1)%configApi.bgImages.length;
      tries++;
    }
    console.warn('Background: none of the candidate media items could be loaded');
    setBackgroundStatus(cfg.backgroundSource==='stock'?'Stock image was returned but could not be displayed.':cfg.backgroundSource==='folders'?'Folder scan succeeded, but none of the media files could be displayed.':'Album loaded, but none of its extracted images could be displayed.',true);
    return false;
  }finally{
    configApi.bgTransitionBusy=false;
  }
}

function nextBackgroundNow(){
  const source=document.getElementById('s-bg-source')?.value||cfg.backgroundSource;
  if(source==='stock'){
    const category=document.getElementById('s-stock-category')?.value||cfg.stockCategory;
    const custom=document.getElementById('s-stock-query')?.value||cfg.stockQuery;
    const resolution=document.getElementById('s-stock-resolution')?.value||cfg.stockResolution;
    loadStockBackground(category,custom,resolution);
    return;
  }
  if(!configApi.bgImages.length){reloadBackgroundNow();return;}
  showBg(nextBackgroundIndex());
}

function reshuffleBackgroundNow(){
  if(configApi.bgSourceImages.length<2){
    setBackgroundStatus(configApi.bgSourceImages.length?'Only one photo is available to shuffle.':'Load an album before reshuffling.',!configApi.bgSourceImages.length);
    return;
  }
  const current=configApi.bgLastUrl||configApi.bgImages[configApi.bgIdx];
  clearBackgroundPrepared(true);
  configApi.bgImages=shuffledCopy(configApi.bgSourceImages);
  if(configApi.bgImages[0]===current)[configApi.bgImages[0],configApi.bgImages[1]]=[configApi.bgImages[1],configApi.bgImages[0]];
  configApi.bgIdx=0;
  showBg(0);
  setBackgroundStatus(`${configApi.bgSourceImages.length} photos reshuffled · current session order randomized`);
}

function reloadBackgroundNow(){
  const source=document.getElementById('s-bg-source')?.value||cfg.backgroundSource;
  if(source==='none'){
    ++configApi.bgSourceSerial;
    if(bgTimer){clearInterval(bgTimer);bgTimer=null;}
    configApi.bgImages=[];configApi.bgSourceImages=[];configApi.stockRecentUrls=[];configApi.bgLastUrl='';try{localStorage.removeItem(LAST_BACKGROUND_KEY);}catch(_e){}void clearLastBackgroundAsset();
    clearBackgroundLayers();
    setBackgroundStatus('Photo background disabled.');
    return;
  }
  if(source==='stock'){
    const category=document.getElementById('s-stock-category')?.value||cfg.stockCategory;
    const custom=document.getElementById('s-stock-query')?.value||cfg.stockQuery;
    const resolution=document.getElementById('s-stock-resolution')?.value||cfg.stockResolution;
    loadStockBackground(category,custom,resolution);
    return;
  }
  if(source==='folders'){
    scanFolderBackgroundsFromForm();
    return;
  }
  const input=document.getElementById('s-photos');
  const url=(input?.value||cfg.photosUrl||'').trim();
  if(!url){setBackgroundStatus('Enter a Google Photos shared album URL first.',true);return;}
  setBackgroundStatus('Reloading album… Save & Apply to commit any changed rotation/order settings.');
  loadPhotos(url);
}

function disableBackgroundSource(){
  ++configApi.bgSourceSerial;
  if(bgTimer){clearInterval(bgTimer);bgTimer=null;}
  configApi.bgImages=[];configApi.bgSourceImages=[];configApi.stockRecentUrls=[];configApi.bgLastUrl='';
  clearBackgroundLayers();
  if(cfg.backgroundSource==='none')setBackgroundStatus('Photo background disabled.');
}

function updateBackgroundSourceUI(){
  const source=document.getElementById('s-bg-source')?.value||cfg.backgroundSource||'google';
  document.querySelectorAll('.google-bg-only').forEach(el=>el.style.display=source==='google'?'':'none');
  document.querySelectorAll('.folders-bg-only').forEach(el=>el.style.display=source==='folders'?'':'none');
  document.querySelectorAll('.stock-bg-only').forEach(el=>el.style.display=source==='stock'?'':'none');
  document.querySelectorAll('.rotating-bg-only').forEach(el=>el.style.display=(source==='google'||source==='folders')?'':'none');
  const custom=document.getElementById('stock-custom-row');
  if(custom)custom.style.display=source==='stock'&&document.getElementById('s-stock-category')?.value==='custom'?'':'none';
}



// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("backgrounds", {backgroundSourceFingerprint,rememberLastBackground,persistLastBackgroundAsset,clearLastBackgroundAsset,loadCachedLastBackground,restoreLastBackground,localProxyUrl,backgroundAssetUrl,backgroundCacheIndex,saveBackgroundCacheIndex,cacheableStillBackground,backgroundReserveCandidateLimit,backgroundCacheBudgetBytes,cachedResponseBytes,enforceBackgroundCacheBudget,trimBackgroundCache,cacheBackgroundAsset,fillBackgroundCaches,scheduleBackgroundCacheFill,loadBackgroundFromCache,restoreBackgroundsFromOfflineCache,mediaFoldersFromText,mediaFoldersFromForm,loadMediaFolderBrowser,openMediaFolderBrowser,browseMediaParent,addCurrentMediaFolder,loadFolderBackgrounds,scanFolderBackgroundsFromForm,setBackgroundStatus,shuffledCopy,prepareBackgroundOrder,chooseNextBackgroundIndex,nextBackgroundIndex,backgroundLayerById,backgroundLayerImage,activeBackgroundLayer,inactiveBackgroundLayer,backgroundTransitionDurationMs,nextAnimationFrame,waitForBackgroundLayerVisible,clearBackgroundPrepared,clearBackgroundLayers,loadBackgroundIntoLayer,preloadBackgroundIndex,prepareUpcomingBackground,revealBackgroundLayer,scheduleBackgroundRotation,stockSearchTerm,loadStockBackground,loadPhotos,formatBackgroundInterval,showBg,nextBackgroundNow,reshuffleBackgroundNow,reloadBackgroundNow,disableBackgroundSource,updateBackgroundSourceUI}, {
  "bgTimer": {configurable:true,get:()=>bgTimer,set:(value)=>{bgTimer=value;}},
  "mediaBrowsePath": {configurable:true,get:()=>mediaBrowsePath,set:(value)=>{mediaBrowsePath=value;}}
}, {globalFunctions:['openMediaFolderBrowser','browseMediaParent','addCurrentMediaFolder','scanFolderBackgroundsFromForm','nextBackgroundNow','reshuffleBackgroundNow','reloadBackgroundNow','updateBackgroundSourceUI'],globalStates:[]});
}
// End source section: /js/backgrounds/index.js

// LibreDisplay source section: /js/backgrounds/portable.js
{
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
}
// End source section: /js/backgrounds/portable.js
