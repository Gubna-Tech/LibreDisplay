// Background sources, local folders, preload, transition, and rotation runtime.
const configApi=LibreDisplayRuntime.getModule('config');

const {serverPath}=LibreDisplayRuntime.getModule('bootstrap');
const {fetchRemoteText,escHtml,scaledClamp,resilientFetch}=LibreDisplayRuntime.getModule('shared');
const {extractAllGooglePhotoUrls,GOOGLE_PHOTOS_MAX_ITEMS}=LibreDisplayRuntime.getModule('backgrounds');

let bgTimer=null;

function localProxyUrl(remoteUrl){
  return serverPath('/proxy?url='+encodeURIComponent(remoteUrl));
}
function backgroundAssetUrl(value){
  const raw=String(value||'');
  return raw.startsWith('/media?')?serverPath(raw):localProxyUrl(raw);
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
async function loadFolderBackgrounds(paths=cfg.mediaFolders,recursive=cfg.mediaRecursive){
  paths=[...new Set((paths||[]).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,32);
  if(!paths.length){setBackgroundStatus('Add at least one local or mounted NAS picture folder.',true);return;}
  try{
    const sourceSerial=++configApi.bgSourceSerial;
    if(bgTimer){clearInterval(bgTimer);bgTimer=null;}
    clearBackgroundPrepared(true);
    configApi.bgImages=[];configApi.bgSourceImages=[];configApi.bgIdx=0;configApi.bgLastUrl='';
    setBackgroundStatus('Scanning local / NAS picture folders…');
    const res=await resilientFetch(serverPath('/api/media/scan'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths,recursive:recursive!==false}),cache:'no-store'},{timeoutMs:60000,retry:false});
    const data=await res.json().catch(()=>({}));
    if(sourceSerial!==configApi.bgSourceSerial)return;
    if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
    configApi.bgSourceImages=(data.images||[]).map(x=>x.url).filter(Boolean);
    if(!configApi.bgSourceImages.length){
      const problems=(data.sources||[]).filter(x=>x.error).map(x=>x.path+': '+x.error);
      throw new Error(problems[0]||'No supported image files were found in the selected folders');
    }
    prepareBackgroundOrder(configApi.bgSourceImages,false);
    const sourceCount=(data.sources||[]).filter(x=>Number(x.count)>0).length;
    const limit=data.limitReached?' · scan limit reached':'';
    setBackgroundStatus(`${configApi.bgSourceImages.length} local/network photos · ${sourceCount} source${sourceCount===1?'':'s'}${limit} · ${cfg.photoIntervalSec?formatBackgroundInterval(cfg.photoIntervalSec):'rotation off'}`);
    await showBg(configApi.bgIdx,0,sourceSerial);
    if(sourceSerial===configApi.bgSourceSerial)scheduleBackgroundRotation();
  }catch(e){
    console.warn('folder background error',e);
    setBackgroundStatus('Folder background error: '+(e?.message||String(e)),true);
  }
}
function scanFolderBackgroundsFromForm(){
  loadFolderBackgrounds(mediaFoldersFromForm(),document.getElementById('s-media-recursive')?.checked!==false);
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
  if(clearLayer){
    const layer=inactiveBackgroundLayer(),img=backgroundLayerImage(layer);
    if(layer&&!layer.classList.contains('show')){
      layer.dataset.remoteUrl='';
      if(img)img.removeAttribute('src');
    }
  }
}
function clearBackgroundLayers(){
  clearBackgroundPrepared(false);
  for(const id of ['bg','bg-next']){
    const layer=backgroundLayerById(id),img=backgroundLayerImage(layer);
    if(!layer)continue;
    layer.classList.remove('show');layer.style.zIndex='0';layer.dataset.remoteUrl='';
    if(img)img.removeAttribute('src');
  }
  configApi.bgActiveLayerId='bg';
}
function loadBackgroundIntoLayer(layer,remoteUrl,priority='low'){
  if(!layer||!remoteUrl)return Promise.resolve(false);
  const img=backgroundLayerImage(layer);if(!img)return Promise.resolve(false);
  const assetUrl=backgroundAssetUrl(remoteUrl);
  if(layer.dataset.remoteUrl===remoteUrl&&img.getAttribute('src')===assetUrl&&img.complete&&img.naturalWidth>0){
    return typeof img.decode==='function'?img.decode().then(()=>true).catch(()=>true):Promise.resolve(true);
  }
  return new Promise(resolve=>{
    let settled=false;
    const finish=async ok=>{
      if(settled)return;settled=true;img.onload=null;img.onerror=null;
      if(ok&&typeof img.decode==='function'){try{await img.decode();}catch(_e){}}
      resolve(!!ok&&img.naturalWidth>0);
    };
    img.onload=()=>finish(true);
    img.onerror=()=>finish(false);
    try{img.fetchPriority=priority;}catch(_e){}
    layer.dataset.remoteUrl=remoteUrl;
    img.src=assetUrl;
    if(img.complete)setTimeout(()=>finish(img.naturalWidth>0),0);
  });
}
function preloadBackgroundIndex(idx){
  if(!cfg.photoPreload||!configApi.bgImages.length)return Promise.resolve(false);
  const i=((idx%configApi.bgImages.length)+configApi.bgImages.length)%configApi.bgImages.length;
  const remoteUrl=configApi.bgImages[i];if(!remoteUrl)return Promise.resolve(false);
  const layer=inactiveBackgroundLayer();
  return loadBackgroundIntoLayer(layer,remoteUrl,'low');
}
function prepareUpcomingBackground(){
  if(!cfg.photoPreload||configApi.bgImages.length<=1){clearBackgroundPrepared(false);return;}
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
  const hasCurrent=!!(active&&active.classList.contains('show')&&backgroundLayerImage(active)?.naturalWidth);
  layer.style.zIndex='1';
  if(active&&active!==layer)active.style.zIndex='0';
  layer.classList.remove('show');
  await nextAnimationFrame();
  layer.classList.add('show');
  await waitForBackgroundLayerVisible(layer);
  if(active&&active!==layer){
    active.style.transition='none';
    active.classList.remove('show');
    void active.offsetWidth;
    active.style.transition='';
    const oldImage=backgroundLayerImage(active);
    active.dataset.remoteUrl='';
    if(oldImage)oldImage.removeAttribute('src');
  }
  layer.style.zIndex='0';
  configApi.bgActiveLayerId=layer.id;
  configApi.bgLastUrl=remoteUrl;
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
    if(sourceSerial===configApi.bgSourceSerial)scheduleBackgroundRotation();
  }catch(e){
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
      console.warn('Could not load a configured background image');
      if(configApi.bgPreparedUrl===remoteUrl)clearBackgroundPrepared(true);
      cursor=(cursor+1)%configApi.bgImages.length;
      tries++;
    }
    console.warn('Background: none of the candidate images could be loaded');
    setBackgroundStatus(cfg.backgroundSource==='stock'?'Stock image was returned but could not be displayed.':cfg.backgroundSource==='folders'?'Folder scan succeeded, but none of the images could be displayed.':'Album loaded, but none of its extracted images could be displayed.',true);
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
    configApi.bgImages=[];configApi.bgSourceImages=[];configApi.stockRecentUrls=[];configApi.bgLastUrl='';
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
LibreDisplayRuntime.exposeModule("backgrounds", {localProxyUrl,backgroundAssetUrl,mediaFoldersFromText,mediaFoldersFromForm,loadMediaFolderBrowser,openMediaFolderBrowser,browseMediaParent,addCurrentMediaFolder,loadFolderBackgrounds,scanFolderBackgroundsFromForm,setBackgroundStatus,shuffledCopy,prepareBackgroundOrder,chooseNextBackgroundIndex,nextBackgroundIndex,backgroundLayerById,backgroundLayerImage,activeBackgroundLayer,inactiveBackgroundLayer,backgroundTransitionDurationMs,nextAnimationFrame,waitForBackgroundLayerVisible,clearBackgroundPrepared,clearBackgroundLayers,loadBackgroundIntoLayer,preloadBackgroundIndex,prepareUpcomingBackground,revealBackgroundLayer,scheduleBackgroundRotation,stockSearchTerm,loadStockBackground,loadPhotos,formatBackgroundInterval,showBg,nextBackgroundNow,reshuffleBackgroundNow,reloadBackgroundNow,disableBackgroundSource,updateBackgroundSourceUI}, {
  "bgTimer": {configurable:true,get:()=>bgTimer,set:(value)=>{bgTimer=value;}},
  "mediaBrowsePath": {configurable:true,get:()=>mediaBrowsePath,set:(value)=>{mediaBrowsePath=value;}}
}, {globalFunctions:['openMediaFolderBrowser','browseMediaParent','addCurrentMediaFolder','scanFolderBackgroundsFromForm','nextBackgroundNow','reshuffleBackgroundNow','reloadBackgroundNow','updateBackgroundSourceUI'],globalStates:[]});
