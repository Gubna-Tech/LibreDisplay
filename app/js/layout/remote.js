const layoutApi=()=>LibreDisplayRuntime.getModule("layout");
// Remote-display Arrange proxy and preview workspace.
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;
const {escHtml}=LibreDisplayRuntime.getModule('shared');


let remoteLayoutProxyActive=false;
let remoteLayoutProxySyncTimer=null;
function remoteLayoutFrame(){return document.getElementById('remote-layout-preview-frame');}
function remoteLayoutInnerDocument(){try{return remoteLayoutFrame()?.contentDocument||null;}catch(e){return null;}}
function remoteLayoutProxyRoot(el){return el?.closest?.('#layout-toolbar,#layout-properties,#block-catalog,#block-config-modal')||null;}
function remoteLayoutProxyCounterpart(el){
  const doc=remoteLayoutInnerDocument(),root=remoteLayoutProxyRoot(el);if(!doc||!root)return null;
  if(el.id){const byId=doc.getElementById(el.id);if(byId)return byId;}
  const innerRoot=doc.getElementById(root.id);if(!innerRoot)return null;
  const selector='button,input,select,textarea',outerList=Array.from(root.querySelectorAll(selector)),innerList=Array.from(innerRoot.querySelectorAll(selector)),idx=outerList.indexOf(el);
  return idx>=0?innerList[idx]||null:null;
}
function remoteLayoutProxyMirrorElement(dst,src){
  if(!dst||!src)return;
  dst.toggleAttribute('hidden',src.hasAttribute('hidden'));
  if(src.getAttribute('aria-hidden')!==null)dst.setAttribute('aria-hidden',src.getAttribute('aria-hidden'));else dst.removeAttribute('aria-hidden');
  if(src.tagName==='SELECT'){if(dst.innerHTML!==src.innerHTML)dst.innerHTML=src.innerHTML;dst.value=src.value;dst.disabled=src.disabled;return;}
  if(src.tagName==='INPUT'||src.tagName==='TEXTAREA'){if(src.type==='checkbox'||src.type==='radio')dst.checked=src.checked;else dst.value=src.value;dst.disabled=src.disabled;return;}
  if(src.tagName==='BUTTON'){dst.disabled=src.disabled;const keepHelp=dst.classList.contains('help-tip');if(!keepHelp)dst.className=src.className;if(!src.querySelector('*'))dst.textContent=src.textContent;return;}
  dst.className=src.className;
  if(!src.querySelector('button,input,select,textarea'))dst.textContent=src.textContent;
}
function syncRemoteLayoutProxyUi(){
  if(!remoteLayoutProxyActive)return;
  const doc=remoteLayoutInnerDocument();if(!doc)return;
  const toolbar=document.getElementById('layout-toolbar'),props=document.getElementById('layout-properties');
  toolbar?.classList.add('show');props?.classList.add('show');toolbar?.setAttribute('aria-hidden','false');props?.setAttribute('aria-hidden','false');
  for(const rootId of ['layout-toolbar','layout-properties']){
    const outer=document.getElementById(rootId),inner=doc.getElementById(rootId);if(!outer||!inner)continue;
    for(const dst of outer.querySelectorAll('[id]')){const src=doc.getElementById(dst.id);if(src)remoteLayoutProxyMirrorElement(dst,src);}
  }
  const outerPicker=document.getElementById('remote-layout-element-picker'),innerPicker=doc.getElementById('layout-toolbar-block');
  if(outerPicker&&innerPicker){const current=innerPicker.value||'';if(outerPicker.innerHTML!==innerPicker.innerHTML)outerPicker.innerHTML=innerPicker.innerHTML;if(Array.from(outerPicker.options).some(o=>o.value===current))outerPicker.value=current;}
  const innerCatalog=doc.getElementById('block-catalog'),outerCatalog=document.getElementById('block-catalog');
  if(innerCatalog&&outerCatalog){const show=innerCatalog.classList.contains('show');outerCatalog.classList.toggle('show',show);outerCatalog.setAttribute('aria-hidden',show?'false':'true');if(show){const ig=doc.getElementById('block-catalog-grid'),og=document.getElementById('block-catalog-grid');if(ig&&og&&og.innerHTML!==ig.innerHTML)og.innerHTML=ig.innerHTML;const is=doc.getElementById('block-catalog-search'),os=document.getElementById('block-catalog-search');if(is&&os&&os.value!==is.value)os.value=is.value;}}
  const innerConfig=doc.getElementById('block-config-modal'),outerConfig=document.getElementById('block-config-modal');
  if(innerConfig&&outerConfig){const show=innerConfig.classList.contains('show');outerConfig.classList.toggle('show',show);outerConfig.setAttribute('aria-hidden',show?'false':'true');if(show){for(const id of ['block-config-title','block-config-sub']){const a=doc.getElementById(id),b=document.getElementById(id);if(a&&b)b.textContent=a.textContent;}const inf=doc.getElementById('block-config-fields'),outf=document.getElementById('block-config-fields');if(inf&&outf&&outf.innerHTML!==inf.innerHTML)outf.innerHTML=inf.innerHTML;for(const dst of outf?.querySelectorAll?.('[id]')||[]){const src=doc.getElementById(dst.id);if(src)remoteLayoutProxyMirrorElement(dst,src);}}}
}
function scheduleRemoteLayoutProxySync(delay=0){if(!remoteLayoutProxyActive)return;if(delay){setTimeout(()=>remoteLayoutProxyActive&&syncRemoteLayoutProxyUi(),delay);return;}requestAnimationFrame(()=>remoteLayoutProxyActive&&syncRemoteLayoutProxyUi());}
function activateRemoteLayoutProxy(){
  if(remoteLayoutProxyActive)return;remoteLayoutProxyActive=true;document.body.classList.add('remote-layout-proxy');
  const toolbar=document.getElementById('layout-toolbar'),props=document.getElementById('layout-properties');toolbar?.classList.add('show');props?.classList.add('show');toolbar?.setAttribute('aria-hidden','false');props?.setAttribute('aria-hidden','false');
  initLayoutInspectorDrag();restoreLayoutInspectorPosition();syncRemoteLayoutProxyUi();
  clearInterval(remoteLayoutProxySyncTimer);remoteLayoutProxySyncTimer=setInterval(syncRemoteLayoutProxyUi,140);
}
function deactivateRemoteLayoutProxy(){
  remoteLayoutProxyActive=false;clearInterval(remoteLayoutProxySyncTimer);remoteLayoutProxySyncTimer=null;document.body.classList.remove('remote-layout-proxy');
  const toolbar=document.getElementById('layout-toolbar'),props=document.getElementById('layout-properties');toolbar?.classList.remove('show');props?.classList.remove('show');toolbar?.setAttribute('aria-hidden','true');props?.setAttribute('aria-hidden','true');
  document.getElementById('block-catalog')?.classList.remove('show');document.getElementById('block-config-modal')?.classList.remove('show');layoutApi().layoutInspectorDragState=null;
}
function handleRemoteLayoutProxyEvent(e){
  if(!remoteLayoutProxyActive)return;const t=e.target?.closest?.('button,input,select,textarea');if(!t)return;const root=remoteLayoutProxyRoot(t);if(!root)return;
  if(t.classList.contains('help-tip'))return;
  if(t.id==='layout-properties-collapse'||t.id==='layout-properties-reset-position')return;
  const src=remoteLayoutProxyCounterpart(t);if(!src)return;
  if(e.type==='click'){
    if(t.tagName!=='BUTTON')return;e.preventDefault();e.stopImmediatePropagation();src.click();scheduleRemoteLayoutProxySync();scheduleRemoteLayoutProxySync(40);return;
  }
  if(!['INPUT','SELECT','TEXTAREA'].includes(t.tagName))return;e.stopImmediatePropagation();
  if(t.type==='checkbox'||t.type==='radio')src.checked=t.checked;else src.value=t.value;
  src.dispatchEvent(new Event(e.type,{bubbles:true}));scheduleRemoteLayoutProxySync();scheduleRemoteLayoutProxySync(35);
}
document.addEventListener('click',handleRemoteLayoutProxyEvent,true);
document.addEventListener('input',handleRemoteLayoutProxyEvent,true);
document.addEventListener('change',handleRemoteLayoutProxyEvent,true);
let remoteLayoutPreviewTarget=null;
let remoteLayoutPreviewSession=0;
function targetViewportFromDevice(row){
  if(!row||!['local','viewer'].includes(String(row.mode||'')))return null;
  const pairs=[
    ['layoutWidth','layoutHeight','layout viewport'],
    ['viewportWidth','viewportHeight','browser viewport'],
    ['visualViewportWidth','visualViewportHeight','visual viewport'],
    ['width','height','reported viewport'],
    ['screenWidth','screenHeight','screen viewport']
  ];
  let rawW=0,rawH=0,metric='';
  for(const [wk,hk,label] of pairs){
    const w=Number(row?.[wk]),h=Number(row?.[hk]);
    if(Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0){rawW=w;rawH=h;metric=label;break;}
  }
  if(rawW<480||rawH<270||rawW>7680||rawH>4320)return null;
  const aspect=rawW/rawH;if(!Number.isFinite(aspect)||aspect<.4||aspect>4)return null;
  const width=Math.round(rawW),height=Math.round(rawH);
  return {width,height,metric,deviceId:String(row?.deviceId||''),mode:String(row?.mode||''),online:!!row?.online,ageSeconds:Number(row?.ageSeconds)||0,lastSeen:Number(row?.lastSeen)||0,dpr:Number(row?.dpr)||1,visualWidth:Number(row?.visualViewportWidth)||0,visualHeight:Number(row?.visualViewportHeight)||0,fontProbeWidth:Number(row?.fontProbeWidth)||0,fontProbeHeight:Number(row?.fontProbeHeight)||0,fontName:String(row?.fontName||'')};
}
function bestLayoutTargetDevice(rows,{freshSince=0}={}){
  const candidates=(rows||[]).filter(row=>{
    if(!row||row.endpoint!==bootstrapApi.ACTIVE_ENDPOINT)return false;
    if(freshSince&&Number(row.lastSeen||0)<freshSince)return false;
    return !!targetViewportFromDevice(row);
  }).sort((a,b)=>{
    const ao=a.online?1:0,bo=b.online?1:0;if(ao!==bo)return bo-ao;
    const am=a.mode==='viewer'?2:a.mode==='local'?1:0,bm=b.mode==='viewer'?2:b.mode==='local'?1:0;if(am!==bm)return bm-am;
    return Number(b.lastSeen||0)-Number(a.lastSeen||0);
  });
  return candidates[0]||null;
}
async function readDisplayDevices(){
  const res=await fetch(serverPath('/api/devices'),{cache:'no-store'}),data=await res.json().catch(()=>({}));
  if(!res.ok||!Array.isArray(data.devices))throw new Error(data.error||('HTTP '+res.status));
  return data.devices;
}
async function requestFreshDisplayMetrics(){
  const requestedAt=Date.now()/1000;
  try{await fetch(serverPath('/api/devices'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'heartbeat',endpoint:bootstrapApi.ACTIVE_ENDPOINT}),cache:'no-store'});}catch(e){}
  let latestValid=null;
  for(let attempt=0;attempt<18;attempt++){
    await new Promise(resolve=>setTimeout(resolve,attempt?140:90));
    try{
      const rows=await readDisplayDevices(),valid=bestLayoutTargetDevice(rows),fresh=bestLayoutTargetDevice(rows,{freshSince:requestedAt-.15});
      if(valid)latestValid=valid;
      if(fresh)return fresh;
    }catch(e){}
  }
  return latestValid;
}
async function fetchRemoteLayoutTarget(){
  try{
    const row=await requestFreshDisplayMetrics();
    return targetViewportFromDevice(row);
  }catch(e){console.warn('Could not read target display viewport',e);}
  return null;
}
function syncRemoteLayoutEditorAffordances(attempt=0){
  const frame=document.getElementById('remote-layout-preview-frame'),picker=document.getElementById('remote-layout-element-picker');if(!frame||!picker)return;
  try{
    const doc=frame.contentDocument,innerPicker=doc?.getElementById('layout-toolbar-block');
    if(!doc||!innerPicker||innerPicker.options.length<2){if(attempt<14)setTimeout(()=>syncRemoteLayoutEditorAffordances(attempt+1),100);return;}
    const current=picker.value;
    picker.innerHTML=Array.from(innerPicker.options).map(o=>`<option value="${escHtml(o.value)}"${o.disabled?' disabled':''}>${escHtml(o.textContent||o.label||'')}</option>`).join('');
    if(Array.from(picker.options).some(o=>o.value===current))picker.value=current;
  }catch(e){if(attempt<14)setTimeout(()=>syncRemoteLayoutEditorAffordances(attempt+1),100);}
}
function selectRemoteLayoutElement(key){
  if(!key)return;const frame=document.getElementById('remote-layout-preview-frame');
  try{frame?.contentWindow?.selectLayoutBlock?.(key);const inner=frame?.contentDocument?.getElementById('layout-toolbar-block');if(inner)inner.value=key;scheduleRemoteLayoutProxySync();}catch(e){}
}
function syncRemoteEditorHitTargets(scale){
  const frame=remoteLayoutFrame();
  try{
    const root=frame?.contentDocument?.documentElement;if(!root)return;
    const inv=Math.max(.25,Math.min(4,1/Math.max(.1,Number(scale)||1)));
    root.style.setProperty('--ld-editor-label-size',(11*inv).toFixed(2)+'px');
    root.style.setProperty('--ld-editor-label-pad-y',(4*inv).toFixed(2)+'px');
    root.style.setProperty('--ld-editor-label-pad-x',(7*inv).toFixed(2)+'px');
    root.style.setProperty('--ld-editor-label-radius',(5*inv).toFixed(2)+'px');
    root.style.setProperty('--ld-editor-handle-size',(18*inv).toFixed(2)+'px');
    root.style.setProperty('--ld-editor-handle-border',(2*inv).toFixed(2)+'px');
    root.style.setProperty('--ld-editor-border-size',(2*inv).toFixed(2)+'px');
    root.style.setProperty('--ld-editor-box-radius',(9*inv).toFixed(2)+'px');
  }catch(e){}
}
function fitRemoteLayoutPreview(){
  const shell=document.getElementById('remote-layout-preview-shell'),stage=document.getElementById('remote-layout-preview-stage'),frame=document.getElementById('remote-layout-preview-frame');
  if(!shell?.classList.contains('show')||!stage||!frame||!remoteLayoutPreviewTarget)return;
  const gutter=14,sw=Math.max(1,stage.clientWidth-gutter*2),sh=Math.max(1,stage.clientHeight-gutter*2),tw=remoteLayoutPreviewTarget.width,th=remoteLayoutPreviewTarget.height;
  const scale=Math.max(.1,Math.min(1,sw/tw,sh/th)),left=gutter+Math.max(0,(sw-tw*scale)/2),top=gutter+Math.max(0,(sh-th*scale)/2);
  frame.style.width=tw+'px';frame.style.height=th+'px';frame.style.left=left.toFixed(1)+'px';frame.style.top=top.toFixed(1)+'px';frame.style.transform=`scale(${scale})`;syncRemoteEditorHitTargets(scale);
  const meta=document.getElementById('remote-layout-preview-meta');if(meta){const state=remoteLayoutPreviewTarget.fallback?'fallback canvas':(remoteLayoutPreviewTarget.online?'live display':'last reported display'),dpr=remoteLayoutPreviewTarget.dpr&&Math.abs(remoteLayoutPreviewTarget.dpr-1)>.01?` · DPR ${remoteLayoutPreviewTarget.dpr.toFixed(2)}`:'';meta.textContent=`${tw}×${th} target viewport${dpr} · ${state} · fit ${Math.round(scale*100)}%`;}
}
async function openRemoteLayoutPreview(){
  const shell=document.getElementById('remote-layout-preview-shell'),frame=document.getElementById('remote-layout-preview-frame'),meta=document.getElementById('remote-layout-preview-meta');if(!shell||!frame)return;
  const session=++remoteLayoutPreviewSession;
  if(meta)meta.textContent='Reading the wall display viewport…';shell.classList.add('show');shell.setAttribute('aria-hidden','false');
  const target=await fetchRemoteLayoutTarget();
  if(session!==remoteLayoutPreviewSession||!shell.classList.contains('show'))return;
  remoteLayoutPreviewTarget=target;
  if(!remoteLayoutPreviewTarget){
    deactivateRemoteLayoutProxy();
    frame.onload=null;frame.removeAttribute('src');frame.src='about:blank';
    frame.style.removeProperty('transform');frame.style.removeProperty('width');frame.style.removeProperty('height');frame.style.removeProperty('left');frame.style.removeProperty('top');
    if(meta)meta.textContent='Arrange unavailable · the wall display has not reported a valid viewport yet. Reload the wall display, then choose Reload preview.';
    return;
  }
  frame.onload=()=>{if(session!==remoteLayoutPreviewSession||!shell.classList.contains('show'))return;activateRemoteLayoutProxy();fitRemoteLayoutPreview();syncRemoteLayoutEditorAffordances();scheduleRemoteLayoutProxySync(60);};
  frame.src=`/layout-preview?endpoint=${encodeURIComponent(bootstrapApi.ACTIVE_ENDPOINT)}&layoutPreview=1&_=${Date.now()}`;
  fitRemoteLayoutPreview();requestAnimationFrame(fitRemoteLayoutPreview);
}
function closeRemoteLayoutPreview(){
  remoteLayoutPreviewSession++;deactivateRemoteLayoutProxy();
  const shell=document.getElementById('remote-layout-preview-shell'),frame=document.getElementById('remote-layout-preview-frame');
  if(shell){shell.classList.remove('show');shell.setAttribute('aria-hidden','true');}
  if(frame){frame.onload=null;frame.removeAttribute('src');frame.src='about:blank';frame.style.removeProperty('transform');frame.style.removeProperty('width');frame.style.removeProperty('height');frame.style.removeProperty('left');frame.style.removeProperty('top');}
  remoteLayoutPreviewTarget=null;
  document.body.classList.remove('remote-layout-proxy');
  document.getElementById('layout-toolbar')?.classList.remove('show');document.getElementById('layout-properties')?.classList.remove('show');document.getElementById('block-catalog')?.classList.remove('show');document.getElementById('block-config-modal')?.classList.remove('show');
}
function reloadRemoteLayoutPreview(){
  const shell=document.getElementById('remote-layout-preview-shell'),frame=document.getElementById('remote-layout-preview-frame');if(!frame||!shell?.classList.contains('show'))return;
  if(!remoteLayoutPreviewTarget){openRemoteLayoutPreview();return;}
  const session=++remoteLayoutPreviewSession;deactivateRemoteLayoutProxy();
  frame.onload=()=>{if(session!==remoteLayoutPreviewSession||!shell.classList.contains('show'))return;activateRemoteLayoutProxy();fitRemoteLayoutPreview();syncRemoteLayoutEditorAffordances();scheduleRemoteLayoutProxySync(60);};
  frame.src=`/layout-preview?endpoint=${encodeURIComponent(bootstrapApi.ACTIVE_ENDPOINT)}&layoutPreview=1&_=${Date.now()}`;
}
async function handleEmbeddedLayoutEditorAction(action){
  if(action==='saved'){
    closeRemoteLayoutPreview();
    await LibreDisplayRuntime.getModule('remote').pollServerConfig();
    openSetup(false);
    return;
  }
  if(action==='cancelled'){closeRemoteLayoutPreview();openSetup(false);}
}
function notifyLayoutPreviewParent(action){
  if(!LAYOUT_PREVIEW_MODE||window.parent===window)return;
  try{if(window.parent.location.origin===location.origin&&typeof window.parent.handleEmbeddedLayoutEditorAction==='function'){window.parent.handleEmbeddedLayoutEditorAction(action);return;}}catch(e){}
  window.parent.postMessage({type:'libredisplay-layout-editor',action},location.origin);
}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==document.getElementById('remote-layout-preview-frame')?.contentWindow)return;const msg=e.data||{};if(msg.type!=='libredisplay-layout-editor')return;handleEmbeddedLayoutEditorAction(msg.action);});
function launchLayoutEditorFromSettings(){
  if(LibreDisplayRuntime.getModule('system').settingsDirty&&!confirm('You have unsaved Settings changes. The layout editor uses the currently saved dashboard settings. Continue without saving those other changes?'))return;
  closeSetup(true);if(bootstrapApi.REMOTE_SETTINGS_MODE){setTimeout(openRemoteLayoutPreview,80);return;}setTimeout(startLayoutEditor,80);
}
function stopLayoutEditorUi(){
  toggleLayoutShortcuts(false);
  layoutEditorActive=false;layoutApi().layoutPointerState=null;layoutSelectedKey='';layoutApi().layoutUndoStack=[];layoutApi().layoutRedoStack=[];updateLayoutHistoryButtons();
  document.body.classList.remove('layout-editing');
  const layer=document.getElementById('layout-editor-layer'),toolbar=document.getElementById('layout-toolbar'),props=document.getElementById('layout-properties');
  layer?.classList.remove('show','grid-on');toolbar?.classList.remove('show');props?.classList.remove('show');layer?.setAttribute('aria-hidden','true');toolbar?.setAttribute('aria-hidden','true');props?.setAttribute('aria-hidden','true');
  if(layer)layer.innerHTML='';closeBlockCatalog();document.getElementById('block-config-modal')?.classList.remove('show');layoutCustomBlocksDraft=[];layoutApi().layoutContentScaleDraft={};layoutApi().layoutElementStyleDraft={};layoutApi().layoutPartStyleDraft={};layoutApi().layoutSelectedPart='whole';layoutApi().layoutScaleEditActive=false;layoutApi().layoutStyleEditField='';layoutApi().layoutPartFineEditField='';layoutApi().layoutInspectorDragState=null;layoutApi().layoutSessionViewport=null;
  document.removeEventListener('pointermove',moveLayoutPointer);document.removeEventListener('pointerup',endLayoutPointer);
}


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("layout", {remoteLayoutFrame,remoteLayoutInnerDocument,remoteLayoutProxyRoot,remoteLayoutProxyCounterpart,remoteLayoutProxyMirrorElement,syncRemoteLayoutProxyUi,scheduleRemoteLayoutProxySync,activateRemoteLayoutProxy,deactivateRemoteLayoutProxy,handleRemoteLayoutProxyEvent,targetViewportFromDevice,bestLayoutTargetDevice,readDisplayDevices,requestFreshDisplayMetrics,fetchRemoteLayoutTarget,syncRemoteLayoutEditorAffordances,selectRemoteLayoutElement,syncRemoteEditorHitTargets,fitRemoteLayoutPreview,openRemoteLayoutPreview,closeRemoteLayoutPreview,reloadRemoteLayoutPreview,handleEmbeddedLayoutEditorAction,notifyLayoutPreviewParent,launchLayoutEditorFromSettings,stopLayoutEditorUi}, {
  "remoteLayoutProxyActive": {configurable:true,get:()=>remoteLayoutProxyActive,set:(value)=>{remoteLayoutProxyActive=value;}},
  "remoteLayoutProxySyncTimer": {configurable:true,get:()=>remoteLayoutProxySyncTimer,set:(value)=>{remoteLayoutProxySyncTimer=value;}},
  "remoteLayoutPreviewTarget": {configurable:true,get:()=>remoteLayoutPreviewTarget,set:(value)=>{remoteLayoutPreviewTarget=value;}},
  "remoteLayoutPreviewSession": {configurable:true,get:()=>remoteLayoutPreviewSession,set:(value)=>{remoteLayoutPreviewSession=value;}}
}, {globalFunctions:['remoteLayoutFrame','remoteLayoutInnerDocument','scheduleRemoteLayoutProxySync','selectRemoteLayoutElement','fitRemoteLayoutPreview','closeRemoteLayoutPreview','reloadRemoteLayoutPreview','notifyLayoutPreviewParent','launchLayoutEditorFromSettings','stopLayoutEditorUi'],globalStates:['remoteLayoutProxyActive']});
