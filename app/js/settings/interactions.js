const settingsStateApi=()=>LibreDisplayRuntime.getModule('settings');
const systemApi=LibreDisplayRuntime.getModule('system');
// Cursor, wheel, unsaved-change, and contextual-help interactions.

const CURSOR_HIDE_DELAY_MS=2000;
let cursorHideTimer=null;
function hideDashboardCursor(){
  document.documentElement.classList.remove('cursor-active');
}
function showDashboardCursorTemporarily(){
  document.documentElement.classList.add('cursor-active');
  if(cursorHideTimer)clearTimeout(cursorHideTimer);
  cursorHideTimer=setTimeout(hideDashboardCursor,CURSOR_HIDE_DELAY_MS);
}
function initCursorAutoHide(){
  hideDashboardCursor();
  ['mousemove','mousedown','wheel'].forEach(type=>{
    window.addEventListener(type,showDashboardCursorTemporarily,{passive:true});
  });
  window.addEventListener('blur',hideDashboardCursor);
}
initCursorAutoHide();

// Keep modified wheel input inside Settings instead of changing page zoom.
function settingsWheelScrollerFrom(target,deltaY){
  const setup=document.getElementById('setup');
  const box=setup?.querySelector('.setup-box');
  let node=target instanceof Element?target:null;
  while(node&&box){
    const style=getComputedStyle(node);
    const canScroll=/(auto|scroll)/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+1;
    if(canScroll){
      const canUp=deltaY<0&&node.scrollTop>0;
      const canDown=deltaY>0&&node.scrollTop+node.clientHeight<node.scrollHeight-1;
      if(canUp||canDown)return node;
    }
    if(node===box)break;
    node=node.parentElement;
  }
  return box;
}
function initSettingsWheelGuard(){
  const setup=document.getElementById('setup');
  if(!setup)return;
  setup.addEventListener('wheel',e=>{
    if(setup.classList.contains('hidden')||(!e.ctrlKey&&!e.metaKey))return;
    const scroller=settingsWheelScrollerFrom(e.target,e.deltaY);
    if(!scroller)return;
    e.preventDefault();
    scroller.scrollTop+=e.deltaY;
  },{passive:false});
}
initSettingsWheelGuard();

let activeContextHelpTip=null;
let contextHelpPinned=false;
let contextHelpHideTimer=null;
function positionContextHelp(tip=activeContextHelpTip){
  const pop=document.getElementById('context-help-popover');
  if(!tip||!pop||pop.hidden)return;
  const r=tip.getBoundingClientRect(),gap=8,pad=10;
  const w=pop.offsetWidth||300,h=pop.offsetHeight||60;
  let left=r.left+r.width/2-w/2;
  left=Math.max(pad,Math.min(innerWidth-w-pad,left));
  let top=r.bottom+gap;
  if(top+h>innerHeight-pad&&r.top-h-gap>=pad)top=r.top-h-gap;
  top=Math.max(pad,Math.min(innerHeight-h-pad,top));
  pop.style.left=Math.round(left)+'px';
  pop.style.top=Math.round(top)+'px';
}
function showContextHelp(tip,pinned=false){
  if(!(tip instanceof Element))return;
  const text=String(tip.dataset.help||'').trim();
  const pop=document.getElementById('context-help-popover');
  if(!text||!pop)return;
  if(contextHelpHideTimer){clearTimeout(contextHelpHideTimer);contextHelpHideTimer=null;}
  if(activeContextHelpTip&&activeContextHelpTip!==tip)activeContextHelpTip.classList.remove('help-active');
  activeContextHelpTip=tip;contextHelpPinned=!!pinned;
  tip.classList.add('help-active');tip.setAttribute('aria-expanded','true');tip.setAttribute('aria-controls','context-help-popover');
  const rawTitle=String(tip.dataset.helpTitle||tip.getAttribute('aria-label')||'Setting help').trim();
  const title=rawTitle.replace(/\s+help$/i,'')||'Setting help';
  pop.replaceChildren();
  const head=document.createElement('div');head.className='context-help-title';head.textContent=title;
  const copy=document.createElement('div');copy.className='context-help-copy';copy.textContent=text;
  const pin=document.createElement('div');pin.className='context-help-pin';pin.textContent=pinned?'Pinned · click the ? again or press Esc to close':'Click the ? to keep this explanation open';
  pop.append(head,copy,pin);pop.hidden=false;
  requestAnimationFrame(()=>positionContextHelp(tip));
}
function hideContextHelp(force=false){
  if(contextHelpPinned&&!force)return;
  if(contextHelpHideTimer){clearTimeout(contextHelpHideTimer);contextHelpHideTimer=null;}
  activeContextHelpTip?.classList.remove('help-active');
  activeContextHelpTip?.setAttribute('aria-expanded','false');
  activeContextHelpTip=null;contextHelpPinned=false;
  const pop=document.getElementById('context-help-popover');if(pop)pop.hidden=true;
}
function scheduleHideContextHelp(){
  if(contextHelpPinned)return;
  if(contextHelpHideTimer)clearTimeout(contextHelpHideTimer);
  contextHelpHideTimer=setTimeout(()=>hideContextHelp(false),100);
}
function initContextHelp(){
  document.addEventListener('pointerover',e=>{const tip=e.target?.closest?.('.help-tip');if(tip&&!contextHelpPinned)showContextHelp(tip,false);});
  document.addEventListener('pointerout',e=>{const tip=e.target?.closest?.('.help-tip');if(tip&&!tip.contains(e.relatedTarget))scheduleHideContextHelp();});
  document.addEventListener('focusin',e=>{const tip=e.target?.closest?.('.help-tip');if(tip&&!contextHelpPinned)showContextHelp(tip,false);});
  document.addEventListener('focusout',e=>{const tip=e.target?.closest?.('.help-tip');if(tip)scheduleHideContextHelp();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeContextHelpTip)hideContextHelp(true);});
  document.addEventListener('click',e=>{
    const tip=e.target?.closest?.('.help-tip');
    if(tip){
      e.preventDefault();e.stopPropagation();
      if(activeContextHelpTip===tip&&contextHelpPinned)hideContextHelp(true);
      else showContextHelp(tip,true);
      return;
    }
    if(activeContextHelpTip)hideContextHelp(true);
  },true);
  document.addEventListener('scroll',()=>{if(activeContextHelpTip)positionContextHelp();},true);
  window.addEventListener('resize',()=>{if(activeContextHelpTip)positionContextHelp();});
}
initContextHelp();
window.addEventListener('beforeunload',e=>{const setup=document.getElementById('setup');if(systemApi.settingsDirty&&(settingsStateApi().settingsPreviewMode||(setup&&!setup.classList.contains('hidden')))){e.preventDefault();e.returnValue='';}});


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("settings", {hideDashboardCursor,showDashboardCursorTemporarily,initCursorAutoHide,settingsWheelScrollerFrom,initSettingsWheelGuard,positionContextHelp,showContextHelp,hideContextHelp,scheduleHideContextHelp,initContextHelp}, {
  "CURSOR_HIDE_DELAY_MS": {configurable:true,get:()=>CURSOR_HIDE_DELAY_MS},
  "cursorHideTimer": {configurable:true,get:()=>cursorHideTimer,set:(value)=>{cursorHideTimer=value;}},
  "activeContextHelpTip": {configurable:true,get:()=>activeContextHelpTip,set:(value)=>{activeContextHelpTip=value;}},
  "contextHelpPinned": {configurable:true,get:()=>contextHelpPinned,set:(value)=>{contextHelpPinned=value;}},
  "contextHelpHideTimer": {configurable:true,get:()=>contextHelpHideTimer,set:(value)=>{contextHelpHideTimer=value;}}
}, {globalFunctions:['hideContextHelp'],globalStates:[]});
