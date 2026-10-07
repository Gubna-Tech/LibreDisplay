// LibreDisplay source section: /js/layout/index.js
{
// Layout model, sizing, inspector, and protected Arrange editor core.

const {saveCfg}=LibreDisplayRuntime.getModule('config');
const {weatherDetailColumnCount}=LibreDisplayRuntime.getModule('weather');
const {uiCfg,escHtml,normalizeHexColor}=LibreDisplayRuntime.getModule('shared');

const LAYOUT_BLOCK_DEFS={
  calendar:{selector:'#top-strip',label:'Calendar',minW:320,minH:90},
  current:{selector:'.wx-main',label:'Current Weather',minW:140,minH:120},
  clock:{selector:'#clock-block',label:'Clock & Date',minW:190,minH:105},
  details:{selector:'.wx-details',label:'Weather Details',minW:250,minH:65},
  daily:{selector:'#wx-forecast',label:'Daily Forecast',minW:280,minH:80},
  hourly:{selector:'#wx-hourly-block',label:'Hourly Forecast',minW:280,minH:80},
  alerts:{selector:'#alert-zone',label:'Weather Alerts',minW:360,minH:110}
};

const LAYOUT_PART_DEFS={
  calendar:[{key:'dayNumber',label:'Day number'},{key:'dayLabel',label:'Day / date label'},{key:'eventText',label:'All event text'},{key:'eventTitle',label:'Event titles'},{key:'eventTime',label:'Event times'},{key:'emptyText',label:'No events text'}],
  current:[{key:'locationLabel',label:'Location / display label'},{key:'temperature',label:'Temperature'},{key:'icon',label:'Weather icon'},{key:'condition',label:'Condition'},{key:'feelsLike',label:'Feels like'}],
  clock:[{key:'time',label:'Main time'},{key:'seconds',label:'Seconds / AM-PM'},{key:'date',label:'Date'}],
  details:[{key:'icon',label:'Detail icons'},{key:'label',label:'Detail labels'},{key:'value',label:'Detail values'}],
  daily:[{key:'day',label:'Day names'},{key:'icon',label:'Forecast icons'},{key:'precip',label:'Rain chance'},{key:'temperature',label:'Temperatures'}],
  hourly:[{key:'time',label:'Hour labels'},{key:'icon',label:'Forecast icons'},{key:'precip',label:'Rain chance'},{key:'temperature',label:'Temperatures'}],
  alerts:[{key:'icon',label:'Alert icon'},{key:'title',label:'Alert title'},{key:'expiry',label:'Expiry'},{key:'body',label:'Alert body'},{key:'meta',label:'Alert details'}]
};
const CUSTOM_LAYOUT_PART_DEFS={
  calendarview:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'eventTitle',label:'Event titles',selectors:'.custom-cal-event-title,.custom-cal-next-title,.custom-cal-month-event,.custom-cal-week-event',size:{clamp:[12,1,17]}},{key:'eventTime',label:'Event times / dates',selectors:'.custom-cal-when,.custom-cal-next-time',size:{px:11}},{key:'meta',label:'Calendar labels',selectors:'.custom-cal-event-meta,.custom-cal-month-dow,.custom-cal-month-num,.custom-cal-week-head>div',size:{px:10}}],
  weatherview:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'temperature',label:'Temperature / values',selectors:'.custom-weather-temp',size:{clamp:[34,5.2,94]}},{key:'icon',label:'Weather icon',selectors:'.custom-weather-icon',size:{clamp:[42,5,88]}},{key:'condition',label:'Condition',selectors:'.custom-weather-cond',size:{clamp:[12,1.1,18]}},{key:'meta',label:'Secondary details',selectors:'.custom-weather-muted',size:{px:11}}],
  text:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'content',label:'Text content',selectors:'.custom-text-content',size:{clamp:[16,1.6,30]}}],
  countdown:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'value',label:'Countdown value',selectors:'.custom-countdown-value',size:{clamp:[28,4,70]}},{key:'subtitle',label:'Countdown subtitle',selectors:'.custom-countdown-sub',size:{clamp:[11,1,16]}}],
  rss:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'headline',label:'Headlines',selectors:'.custom-rss-item a',size:{clamp:[12,1,17]}},{key:'meta',label:'Dates / metadata',selectors:'.custom-rss-meta',size:{px:10}}],
  json:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'value',label:'Primary value',selectors:'.custom-data-value,.custom-data-gauge-value',size:{clamp:[22,3,56]}},{key:'table',label:'Table text',selectors:'.custom-data-table',size:{clamp:[10,.9,14]}}],
  todo:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'item',label:'Checklist items',selectors:'.custom-todo-item',size:{clamp:[12,1,17]}},{key:'empty',label:'Empty message',selectors:'.custom-todo-empty',size:{px:12}}],
  scheduled:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'message',label:'Scheduled message',selectors:'.custom-scheduled-message',size:{clamp:[18,2.2,42]}},{key:'inactive',label:'Inactive message',selectors:'.custom-scheduled-inactive',size:{px:12}}],
  daily:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'kicker',label:'Kicker / subtitle',selectors:'.custom-daily-kicker',size:{px:10}},{key:'text',label:'Daily text',selectors:'.custom-daily-text',size:{clamp:[17,2,36]}}],
  airquality:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'value',label:'AQI value',selectors:'.custom-aq-value',size:{clamp:[40,5,88]}},{key:'label',label:'AQI label',selectors:'.custom-aq-label',size:{clamp:[14,1.3,22]}},{key:'meta',label:'AQI details',selectors:'.custom-aq-meta',size:{px:11}}],
  suntimes:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'icon',label:'Sun icons',selectors:'.custom-sun-icon',size:{px:24}},{key:'label',label:'Sun labels',selectors:'.custom-sun-k',size:{px:9}},{key:'value',label:'Sun times',selectors:'.custom-sun-v',size:{clamp:[16,1.7,27]}},{key:'meta',label:'Daylight detail',selectors:'.custom-sun-daylight',size:{px:11}}],
  icon:[{key:'glyph',label:'Icon / glyph',selectors:'.custom-icon-glyph',size:{clamp:[38,8,150]}}],
  button:[{key:'label',label:'Button label',selectors:'.custom-link-button',size:null}],
  family:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'item',label:'Chore titles',selectors:'.custom-family-chore',size:{clamp:[12,1,16]}},{key:'meta',label:'Member / points text',selectors:'.custom-family-member,.custom-family-points,.custom-family-reward,.integration-task-meta',size:{px:10}}],
  integration:[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}},{key:'primary',label:'Primary text',selectors:'.integration-task-title,.integration-now-title,.integration-status-value,.integration-message-text',size:{clamp:[12,1,16]}},{key:'meta',label:'Secondary text',selectors:'.integration-task-meta,.integration-now-artist,.integration-now-album,.integration-now-state,.integration-status-provider,.integration-message-meta,.integration-photo-caption',size:{px:10}}]
};
const GENERIC_CUSTOM_PART_DEFS=[{key:'title',label:'Block title',selectors:'.custom-block-title',size:{px:11}}];
const LAYOUT_PART_FONT_FAMILIES=['','Inter','system','Noto Sans','DejaVu Sans','Liberation Sans','Trebuchet MS','DejaVu Serif','Georgia','monospace'];
function customLayoutPartDefs(type){return CUSTOM_LAYOUT_PART_DEFS[type]||GENERIC_CUSTOM_PART_DEFS;}
function normalizePartStyleValue(raw={}){const weight=String(raw.fontWeight||'');return {scale:Math.min(200,Math.max(50,Number(raw.scale)||100)),fontFamily:LAYOUT_PART_FONT_FAMILIES.includes(raw.fontFamily)?raw.fontFamily:'',textColor:/^#[0-9a-f]{6}$/i.test(raw.textColor||'')?String(raw.textColor).toLowerCase():'',opacity:Math.min(100,Math.max(20,Number(raw.opacity)||100)),fontWeight:['','200','300','400','500','600','700','800','900'].includes(weight)?weight:'',lineHeight:Math.min(180,Math.max(80,Number(raw.lineHeight)||100)),letterSpacing:Math.min(6,Math.max(-2,Number(raw.letterSpacing)||0)),textAlign:['auto','left','center','right'].includes(raw.textAlign)?raw.textAlign:'auto',visible:raw.visible!==false};}
function normalizePartStyleMap(raw,defs=[]){const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},out={};for(const def of defs||[]){if(src[def.key]&&typeof src[def.key]==='object'&&!Array.isArray(src[def.key]))out[def.key]=normalizePartStyleValue(src[def.key]);}return out;}
function normalizeBuiltInPartStyleTree(raw){const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},out={};for(const [key,defs] of Object.entries(LAYOUT_PART_DEFS)){const map=normalizePartStyleMap(src[key],defs);if(Object.keys(map).length)out[key]=map;}return out;}
function partStyleHasOverride(st){const s=normalizePartStyleValue(st);return s.scale!==100||!!s.fontFamily||!!s.textColor||s.opacity!==100||!!s.fontWeight||s.lineHeight!==100||Math.abs(s.letterSpacing)>.001||s.textAlign!=='auto'||s.visible===false;}
function partStyleExtras(st){const s=normalizePartStyleValue(st);let css='';if(s.fontFamily)css+=`font-family:${fontCssValue(s.fontFamily)}!important;`;if(s.textColor)css+=`color:${s.textColor}!important;`;if(s.opacity!==100)css+=`opacity:${(s.opacity/100).toFixed(3)}!important;`;if(s.fontWeight)css+=`font-weight:${s.fontWeight}!important;`;if(s.lineHeight!==100)css+=`line-height:${(s.lineHeight/100).toFixed(3)}!important;`;if(Math.abs(s.letterSpacing)>.001)css+=`letter-spacing:${s.letterSpacing.toFixed(2)}px!important;`;if(s.textAlign!=='auto')css+=`text-align:${s.textAlign}!important;justify-content:${s.textAlign==='left'?'flex-start':s.textAlign==='right'?'flex-end':'center'}!important;`;if(s.visible===false)css+='display:none!important;';return css;}
function customPartFontSize(size,scale){const f=Math.min(2,Math.max(.5,Number(scale)||1));if(!size)return '';if(Number.isFinite(Number(size.px)))return `${(Number(size.px)*f).toFixed(2)}px`;if(Array.isArray(size.clamp)&&size.clamp.length===3)return `clamp(${(Number(size.clamp[0])*f).toFixed(2)}px,${(Number(size.clamp[1])*f).toFixed(3)}vw,${(Number(size.clamp[2])*f).toFixed(2)}px)`;return '';}
function buildCustomLayoutPartCss(source=cfg){let css='';for(const block of source.customBlocks||[]){const defs=customLayoutPartDefs(block.type),styles=normalizePartStyleMap(block.config?._partStyles,defs),scope=`.custom-block[data-block-id="${String(block.id||'').replace(/[^a-zA-Z0-9_-]/g,'')}"]`;for(const def of defs){const st=styles[def.key];if(!st||!partStyleHasOverride(st))continue;const selectors=String(def.selectors||'').split(',').map(x=>x.trim()).filter(Boolean).map(x=>`${scope} ${x}`).join(',');if(!selectors)continue;const size=st.scale!==100?customPartFontSize(def.size,st.scale/100):'';css+=`${selectors}{${size?`font-size:${size}!important;`:''}${partStyleExtras(st)}}
`;}}return css;}

const LAYOUT_INSPECTOR_POS_KEY='libredisplay-layout-inspector-pos-v1';
const REMOTE_LAYOUT_INSPECTOR_POS_KEY='libredisplay-remote-layout-inspector-pos-v1';
function layoutInspectorPositionKey(){return remoteLayoutProxyActive?REMOTE_LAYOUT_INSPECTOR_POS_KEY:LAYOUT_INSPECTOR_POS_KEY;}
let layoutInspectorDragState=null;
function layoutInspectorClamp(left,top){const el=document.getElementById('layout-properties');if(!el)return {left:14,top:72};const rect=el.getBoundingClientRect(),pad=8;return {left:Math.max(pad,Math.min(innerWidth-rect.width-pad,Number(left)||pad)),top:Math.max(pad,Math.min(innerHeight-rect.height-pad,Number(top)||pad))};}
function setLayoutInspectorPosition(left,top,persist=false){const el=document.getElementById('layout-properties');if(!el)return;const p=layoutInspectorClamp(left,top);el.style.left=p.left+'px';el.style.top=p.top+'px';el.style.right='auto';el.style.bottom='auto';if(persist){const rect=el.getBoundingClientRect(),availX=Math.max(1,innerWidth-rect.width-16),availY=Math.max(1,innerHeight-rect.height-16);try{localStorage.setItem(layoutInspectorPositionKey(),JSON.stringify({x:Math.max(0,Math.min(1,(p.left-8)/availX)),y:Math.max(0,Math.min(1,(p.top-8)/availY))}));}catch{}}}
function restoreLayoutInspectorPosition(){const el=document.getElementById('layout-properties');if(!el)return;let saved=null;try{saved=JSON.parse(localStorage.getItem(layoutInspectorPositionKey())||'null');}catch{}if(saved&&Number.isFinite(Number(saved.x))&&Number.isFinite(Number(saved.y))){requestAnimationFrame(()=>{const rect=el.getBoundingClientRect(),availX=Math.max(1,innerWidth-rect.width-16),availY=Math.max(1,innerHeight-rect.height-16);setLayoutInspectorPosition(8+availX*Math.max(0,Math.min(1,Number(saved.x))),8+availY*Math.max(0,Math.min(1,Number(saved.y))),false);});}else{el.style.removeProperty('left');el.style.removeProperty('bottom');el.style.top=remoteLayoutProxyActive?'118px':'72px';el.style.right='14px';requestAnimationFrame(keepLayoutInspectorOnScreen);}}
function resetLayoutInspectorPosition(){try{localStorage.removeItem(layoutInspectorPositionKey());}catch{}restoreLayoutInspectorPosition();}
function keepLayoutInspectorOnScreen(){const el=document.getElementById('layout-properties');if(!(layoutEditorActive||remoteLayoutProxyActive)||!el?.classList.contains('show'))return;const r=el.getBoundingClientRect();setLayoutInspectorPosition(r.left,r.top,false);}
function toggleLayoutInspectorCollapse(){const el=document.getElementById('layout-properties'),btn=document.getElementById('layout-properties-collapse');if(!el)return;el.classList.toggle('collapsed');if(btn)btn.textContent=el.classList.contains('collapsed')?'+':'−';requestAnimationFrame(keepLayoutInspectorOnScreen);}
function initLayoutInspectorDrag(){const handle=document.getElementById('layout-properties-drag-handle');if(!handle||handle.dataset.dragBound==='1')return;handle.dataset.dragBound='1';handle.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button,input,select,label'))return;const el=document.getElementById('layout-properties');if(!el)return;const r=el.getBoundingClientRect();layoutInspectorDragState={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,left:r.left,top:r.top};el.classList.add('dragging');try{handle.setPointerCapture?.(e.pointerId);}catch{}e.preventDefault();});document.addEventListener('pointermove',e=>{const st=layoutInspectorDragState;if(!st||st.pointerId!==e.pointerId)return;setLayoutInspectorPosition(st.left+(e.clientX-st.startX),st.top+(e.clientY-st.startY),false);e.preventDefault();},{passive:false});const done=e=>{const st=layoutInspectorDragState;if(!st||st.pointerId!==e.pointerId)return;layoutInspectorDragState=null;document.getElementById('layout-properties')?.classList.remove('dragging');const r=document.getElementById('layout-properties')?.getBoundingClientRect();if(r)setLayoutInspectorPosition(r.left,r.top,true);};document.addEventListener('pointerup',done);document.addEventListener('pointercancel',done);}
let layoutEditorActive=false;
let layoutSessionViewport=null;
let layoutEditorDraft={};
let layoutEditorOriginal=null;
let layoutSelectedKey='';
let layoutSelectedKeys=[];
let layoutPointerState=null;
let layoutContentScaleDraft={};
let layoutElementStyleDraft={};
let layoutPartStyleDraft={};
let layoutSelectedPart='whole';
let layoutScaleEditActive=false;
let layoutStyleEditField='';
let layoutPartFineEditField='';
let layoutUndoStack=[],layoutRedoStack=[];
function layoutHistorySnapshot(){return {layout:JSON.parse(JSON.stringify(layoutEditorDraft||{})),custom:JSON.parse(JSON.stringify(layoutCustomBlocksDraft||[])),contentScale:JSON.parse(JSON.stringify(layoutContentScaleDraft||{})),elementStyle:JSON.parse(JSON.stringify(layoutElementStyleDraft||{})),partStyle:JSON.parse(JSON.stringify(layoutPartStyleDraft||{})),selected:layoutSelectedKey,selectedKeys:[...layoutSelectedKeys],selectedPart:layoutSelectedPart};}
function updateLayoutHistoryButtons(){const u=document.getElementById('layout-undo'),r=document.getElementById('layout-redo');if(u)u.disabled=!layoutUndoStack.length;if(r)r.disabled=!layoutRedoStack.length;}
function pushLayoutHistory(){if(!layoutEditorActive)return;layoutUndoStack.push(layoutHistorySnapshot());if(layoutUndoStack.length>60)layoutUndoStack.shift();layoutRedoStack=[];updateLayoutHistoryButtons();}
function restoreLayoutHistorySnapshot(snap){if(!snap)return;layoutEditorDraft=JSON.parse(JSON.stringify(snap.layout||{}));layoutCustomBlocksDraft=JSON.parse(JSON.stringify(snap.custom||[]));layoutContentScaleDraft=JSON.parse(JSON.stringify(snap.contentScale||{}));layoutElementStyleDraft=JSON.parse(JSON.stringify(snap.elementStyle||{}));layoutPartStyleDraft=JSON.parse(JSON.stringify(snap.partStyle||{}));layoutSelectedKey=snap.selected||'';layoutSelectedKeys=Array.isArray(snap.selectedKeys)?snap.selectedKeys.filter(layoutSelectionKeyIsValid):(layoutSelectedKey?[layoutSelectedKey]:[]);if(layoutSelectedKey&&!layoutSelectedKeys.includes(layoutSelectedKey))layoutSelectedKeys.push(layoutSelectedKey);layoutSelectedPart=snap.selectedPart||'whole';cfg.layoutMode='custom';cfg.layoutBlocks=JSON.parse(JSON.stringify(layoutEditorDraft));renderCustomBlocks(layoutCustomBlocksDraft);for(const [key,r] of Object.entries(layoutEditorDraft))applyOneLayoutRect(key,r);applyLayoutEditorContentScalePreview();renderLayoutEditorBoxes();refreshToolbarCustomActions();refreshLayoutPartPicker();updateLayoutHistoryButtons();}
function undoLayoutEditor(){if(!layoutEditorActive||!layoutUndoStack.length)return;layoutRedoStack.push(layoutHistorySnapshot());restoreLayoutHistorySnapshot(layoutUndoStack.pop());}
function redoLayoutEditor(){if(!layoutEditorActive||!layoutRedoStack.length)return;layoutUndoStack.push(layoutHistorySnapshot());restoreLayoutHistorySnapshot(layoutRedoStack.pop());}

function clamp01(v){return Math.max(0,Math.min(1,Number(v)||0));}

function readLayoutViewport(){
  const root=document.documentElement;
  return {width:Math.max(1,Math.round(root?.clientWidth||window.innerWidth||1)),height:Math.max(1,Math.round(root?.clientHeight||window.innerHeight||1))};
}
function layoutViewportSize(){
  if(layoutSessionViewport&&Number(layoutSessionViewport.width)>0&&Number(layoutSessionViewport.height)>0)return layoutSessionViewport;
  return readLayoutViewport();
}
function refreshLayoutSessionViewport(){layoutSessionViewport=readLayoutViewport();return layoutSessionViewport;}
function normalizedRectFromPx(r){
  const vp=layoutViewportSize();
  return {x:Number(r?.left||0)/vp.width,y:Number(r?.top||0)/vp.height,w:Number(r?.width||0)/vp.width,h:Number(r?.height||0)/vp.height};
}
function pxRectFromNormalized(r){
  const vp=layoutViewportSize();
  return {left:(Number(r?.x)||0)*vp.width,top:(Number(r?.y)||0)*vp.height,width:(Number(r?.w)||.25)*vp.width,height:(Number(r?.h)||.15)*vp.height};
}
function validLayoutRect(r){return r&&[r.x,r.y,r.w,r.h].every(v=>Number.isFinite(Number(v)))&&Number(r.w)>0&&Number(r.h)>0;}
function validStoredLayoutRect(r){
  if(!validLayoutRect(r))return false;
  const x=Number(r.x),y=Number(r.y),w=Number(r.w),h=Number(r.h),eps=.000001;
  return x>=-eps&&y>=-eps&&w<=1+eps&&h<=1+eps&&x+w<=1+eps&&y+h<=1+eps;
}
function cloneLayoutRect(r){return {x:Number(r.x),y:Number(r.y),w:Number(r.w),h:Number(r.h)};}
function sanitizeLayoutRect(key,r){
  const def=LAYOUT_BLOCK_DEFS[key],vp=layoutViewportSize();
  if(!def)return r;
  let px=pxRectFromNormalized(r||{});
  px.width=Math.max(def.minW,Math.min(vp.width,px.width));
  px.height=Math.max(def.minH,Math.min(vp.height,px.height));
  px.left=Math.max(0,Math.min(vp.width-px.width,px.left));
  px.top=Math.max(0,Math.min(vp.height-px.height,px.top));
  return normalizedRectFromPx(px);
}
function layoutRectForDisplay(key,r){
  if(validStoredLayoutRect(r))return cloneLayoutRect(r);
  if(validLayoutRect(r))return sanitizeLayoutRect(key,r);
  return null;
}
function clearCustomLayoutStyles(){
  document.body.classList.remove('custom-layout');
  for(const def of Object.values(LAYOUT_BLOCK_DEFS)){
    const el=document.querySelector(def.selector);if(!el)continue;
    for(const prop of ['position','left','top','width','height','right','bottom'])el.style.removeProperty(prop);
  }
  for(const sel of ['#wx-left','#wx-right']){
    const el=document.querySelector(sel);if(!el)continue;
    for(const prop of ['position','left','top','width','height','right','bottom'])el.style.removeProperty(prop);
  }
  const legend=document.getElementById('calendar-legend');
  if(legend){for(const p of ['left','top','right','width'])legend.style.removeProperty(p);}
}
function applyOneLayoutRect(key,r){
  const def=LAYOUT_BLOCK_DEFS[key],el=def?document.querySelector(def.selector):null,clean=def?layoutRectForDisplay(key,r):null;if(!def||!el||!clean)return;
  const px=pxRectFromNormalized(clean);
  el.style.position='fixed';
  el.style.left=px.left.toFixed(1)+'px';
  el.style.top=px.top.toFixed(1)+'px';
  el.style.width=px.width.toFixed(1)+'px';
  el.style.height=px.height.toFixed(1)+'px';
  el.style.right='auto';el.style.bottom='auto';
  if(key==='calendar'){
    const legend=document.getElementById('calendar-legend');
    if(legend){legend.style.left=px.left.toFixed(1)+'px';legend.style.top=(px.top+px.height+3).toFixed(1)+'px';legend.style.right='auto';legend.style.width=px.width.toFixed(1)+'px';}
  }
}
function applyCustomLayout(source=cfg){
  const custom=source?.layoutMode==='custom'&&source.layoutBlocks&&Object.keys(source.layoutBlocks).length;
  if(!custom){clearCustomLayoutStyles();clearBuiltInLayoutAutoFit();return;}
  document.body.classList.add('custom-layout');
  for(const key of Object.keys(LAYOUT_BLOCK_DEFS)){
    const r=source.layoutBlocks[key];if(validLayoutRect(r))applyOneLayoutRect(key,r);
  }
  bindBuiltInLayoutAutoFitObserver();scheduleBuiltInLayoutAutoFit();
}
function applyBuiltInElementStyles(source=cfg){const styles=source?.layoutElementStyle&&typeof source.layoutElementStyle==='object'?source.layoutElementStyle:{};for(const [key,def] of Object.entries(LAYOUT_BLOCK_DEFS)){const el=document.querySelector(def.selector);if(!el)continue;const st=styles[key]||{};applyElementInspectorStyle(el,st);el.style.opacity=String(Math.min(1,Math.max(.2,(Number(st.opacity)||100)/100)));}}

let builtInLayoutAutoFitRaf=0;
let builtInLayoutAutoFitObserver=null;
let builtInLayoutAutoFitResizeObserver=null;
function clearBuiltInLayoutAutoFit(){
  const calendar=document.getElementById('top-strip'),current=document.querySelector('.wx-main'),clock=document.getElementById('clock-block'),details=document.querySelector('.wx-details'),daily=document.getElementById('wx-forecast'),hourly=document.getElementById('wx-hourly-block');
  calendar?.style.removeProperty('--ld-layout-calendar-row');calendar?.style.removeProperty('--ld-layout-fit-calendar');
  current?.style.removeProperty('--ld-layout-fit-current');clock?.style.removeProperty('--ld-layout-fit-clock');details?.style.removeProperty('--ld-layout-fit-details');
  daily?.style.removeProperty('--ld-layout-fit-daily');hourly?.style.removeProperty('--ld-layout-fit-hourly');
}
function clampLayoutFit(v){return Math.max(.46,Math.min(1,Number.isFinite(v)?v:1));}
function calendarFitScale(el){
  if(!el||el.clientWidth<2||el.clientHeight<2)return 1;
  const items=[...el.querySelectorAll(':scope > .day-col')];if(!items.length)return 1;
  const css=getComputedStyle(el),cols=Math.max(1,String(css.gridTemplateColumns||'').split(/\s+/).filter(Boolean).length),rows=Math.max(1,Math.ceil(items.length/cols)),rowGap=Math.max(0,parseFloat(css.rowGap)||0),padTop=Math.max(0,parseFloat(css.paddingTop)||0),padBottom=Math.max(0,parseFloat(css.paddingBottom)||0);
  const base=Math.max(1,parseFloat(css.getPropertyValue('--ld-layout-calendar-row-base'))||parseFloat(css.gridAutoRows)||150),usableH=Math.max(1,el.clientHeight-padTop-padBottom-rowGap*(rows-1)),rowHeight=Math.max(22,Math.min(base,usableH/rows));
  el.style.setProperty('--ld-layout-calendar-row',rowHeight.toFixed(2)+'px');
  let ratio=1;
  for(const item of items){const iw=Math.max(1,item.clientWidth-2),sw=Math.max(1,item.scrollWidth),sh=Math.max(1,item.scrollHeight);ratio=Math.min(ratio,iw/sw,Math.max(1,rowHeight-2)/sh);}
  return clampLayoutFit(ratio);
}
function forecastFitScale(block,gridSelector,itemSelector){
  if(!block||block.clientWidth<2||block.clientHeight<2)return 1;
  const grid=gridSelector?block.querySelector(gridSelector):block;if(!grid)return 1;
  const items=[...grid.querySelectorAll(itemSelector)];if(!items.length)return 1;
  let ratio=Math.min(1,(block.clientHeight-2)/Math.max(1,grid.scrollHeight));
  for(const item of items){ratio=Math.min(ratio,(item.clientWidth-2)/Math.max(1,item.scrollWidth),(block.clientHeight-2)/Math.max(1,item.scrollHeight));}
  return clampLayoutFit(ratio);
}
function currentWeatherFitScale(el){
  if(!el||el.clientWidth<2||el.clientHeight<2)return 1;
  const kids=[...el.children].filter(x=>x instanceof HTMLElement&&getComputedStyle(x).display!=='none');if(!kids.length)return 1;
  const needW=Math.max(1,...kids.map(x=>Math.max(x.scrollWidth,x.getBoundingClientRect().width)));
  const needH=Math.max(1,el.scrollHeight);
  return clampLayoutFit(Math.min((el.clientWidth-2)/needW,(el.clientHeight-2)/needH));
}
function clockFitScale(el){
  if(!el||el.clientWidth<2||el.clientHeight<2)return 1;
  const kids=[...el.children].filter(x=>x instanceof HTMLElement);if(!kids.length)return 1;
  const needW=Math.max(1,...kids.map(x=>Math.max(x.scrollWidth,x.getBoundingClientRect().width)));
  const needH=Math.max(1,el.scrollHeight);
  return clampLayoutFit(Math.min((el.clientWidth-2)/needW,(el.clientHeight-2)/needH));
}
function syncWeatherDetailsArrangeGrid(el){
  if(!el)return 0;
  const count=el.querySelectorAll(':scope > .wx-detail').length;if(!count)return 0;
  const cols=weatherDetailColumnCount(count),value=`repeat(${cols},minmax(0,1fr))`;
  if(el.style.gridTemplateColumns!==value)el.style.gridTemplateColumns=value;
  return cols;
}
function weatherDetailsFitScale(el){
  if(!el||el.clientWidth<2||el.clientHeight<2)return 1;
  const cells=[...el.querySelectorAll(':scope > .wx-detail')];if(!cells.length)return 1;
  let ratio=1;
  for(const cell of cells){
    const cw=Math.max(1,cell.clientWidth-2),ch=Math.max(1,cell.clientHeight-1),sw=Math.max(1,cell.scrollWidth),sh=Math.max(1,cell.scrollHeight);
    ratio=Math.min(ratio,cw/sw,ch/sh);
  }
  ratio=Math.min(ratio,(el.clientHeight-2)/Math.max(1,el.scrollHeight));
  return clampLayoutFit(ratio);
}
function updateBuiltInLayoutAutoFit(){
  builtInLayoutAutoFitRaf=0;
  if(!document.body.classList.contains('custom-layout')){clearBuiltInLayoutAutoFit();return;}
  const calendar=document.getElementById('top-strip'),current=document.querySelector('.wx-main'),clock=document.getElementById('clock-block'),details=document.querySelector('.wx-details'),daily=document.getElementById('wx-forecast'),hourly=document.getElementById('wx-hourly-block');
  if(details)syncWeatherDetailsArrangeGrid(details);
  if(calendar){calendar.style.setProperty('--ld-layout-fit-calendar','1');calendar.style.removeProperty('--ld-layout-calendar-row');}
  if(current)current.style.setProperty('--ld-layout-fit-current','1');if(clock)clock.style.setProperty('--ld-layout-fit-clock','1');if(details)details.style.setProperty('--ld-layout-fit-details','1');
  if(daily)daily.style.setProperty('--ld-layout-fit-daily','1');if(hourly)hourly.style.setProperty('--ld-layout-fit-hourly','1');
  void document.documentElement.offsetHeight;
  if(calendar)calendar.style.setProperty('--ld-layout-fit-calendar',calendarFitScale(calendar).toFixed(4));
  if(current)current.style.setProperty('--ld-layout-fit-current',currentWeatherFitScale(current).toFixed(4));
  if(clock)clock.style.setProperty('--ld-layout-fit-clock',clockFitScale(clock).toFixed(4));
  if(details)details.style.setProperty('--ld-layout-fit-details',weatherDetailsFitScale(details).toFixed(4));
  if(daily)daily.style.setProperty('--ld-layout-fit-daily',forecastFitScale(daily,null,':scope > .fc-col').toFixed(4));
  if(hourly)hourly.style.setProperty('--ld-layout-fit-hourly',forecastFitScale(hourly,'.wx-hourly',':scope > .hr-col').toFixed(4));
}
function scheduleBuiltInLayoutAutoFit(){if(builtInLayoutAutoFitRaf)return;builtInLayoutAutoFitRaf=requestAnimationFrame(updateBuiltInLayoutAutoFit);}
function bindBuiltInLayoutAutoFitObserver(){
  const targets=[document.getElementById('top-strip'),document.querySelector('.wx-main'),document.getElementById('clock-block'),document.querySelector('.wx-details'),document.getElementById('wx-forecast'),document.getElementById('wx-hourly-block')].filter(Boolean);
  if(!builtInLayoutAutoFitObserver){builtInLayoutAutoFitObserver=new MutationObserver(()=>scheduleBuiltInLayoutAutoFit());for(const el of targets)builtInLayoutAutoFitObserver.observe(el,{subtree:true,childList:true,characterData:true});}
  if(!builtInLayoutAutoFitResizeObserver&&typeof ResizeObserver==='function'){builtInLayoutAutoFitResizeObserver=new ResizeObserver(()=>scheduleBuiltInLayoutAutoFit());for(const el of targets)builtInLayoutAutoFitResizeObserver.observe(el);}
}

function updateLayoutModeStatus(source=cfg){
  const el=document.getElementById('layout-mode-status');if(!el)return;
  const custom=source?.layoutMode==='custom'&&source.layoutBlocks&&Object.keys(source.layoutBlocks).length;
  const added=(source?.customBlocks||cfg.customBlocks||[]).length;el.textContent=(custom?'Layout: custom arrangement saved · 7 built-in blocks':'Layout: default locked arrangement · 7 built-in blocks')+(added?` · ${added} added block${added===1?'':'s'}`:'');
}
function layoutVisualRect(key,el){
  const r=el?.getBoundingClientRect?.();
  if(r&&r.width>=2&&r.height>=2)return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,x:r.left,y:r.top,width:r.width,height:r.height};
  if(!el)return null;
  const cs=getComputedStyle(el),vp=layoutViewportSize();
  const left=Number.parseFloat(cs.left),right=Number.parseFloat(cs.right),top=Number.parseFloat(cs.top),bottom=Number.parseFloat(cs.bottom);
  if(cs.position==='fixed'&&[left,right,top,bottom].every(Number.isFinite)){
    const width=Math.max(0,vp.width-left-right),height=Math.max(0,vp.height-top-bottom);
    if(width>=2&&height>=2)return {left,top,right:left+width,bottom:top+height,x:left,y:top,width,height};
  }
  return null;
}
function gridTrackPixels(el){
  const raw=getComputedStyle(el||document.documentElement).gridTemplateColumns||'';
  return raw.split(/\s+/).map(v=>Number.parseFloat(v)).filter(Number.isFinite);
}
function defaultFineBlockFallback(key){
  const vp=layoutViewportSize(),leftEl=document.getElementById('wx-left'),rightEl=document.getElementById('wx-right');
  const left=leftEl?.getBoundingClientRect(),right=rightEl?.getBoundingClientRect(),ui=uiCfg();
  const side=Number(ui.sidePaddingPx)||28,calH=Number(ui.calendarBandHeight)||150,bottomH=Number(ui.bottomPanelHeight)||330,leftW=Math.min(vp.width-side*2,Number(ui.leftPanelWidth)||470),gap=22;
  const bottomTop=Math.max(calH+20,vp.height-bottomH),rightLeft=Math.min(vp.width-side,side+leftW+gap),rightWidth=Math.max(280,vp.width-rightLeft-side),rowGap=Math.max(4,Number(ui.forecastRowGapPx)||18),rightRowH=Math.max(80,(bottomH-24-rowGap)/2);
  if(key==='calendar')return {left:0,top:0,width:vp.width,height:calH};
  if(left&&left.width>10){
    if(key==='current'){
      const r=document.querySelector('.wx-main')?.getBoundingClientRect();
      return r&&r.width>10&&r.height>10?{left:r.left,top:r.top,width:r.width,height:r.height}:{left:left.left,top:left.top,width:Math.min(180,left.width),height:Math.max(120,left.height-96)};
    }
    if(key==='clock'){
      const r=document.getElementById('clock-block')?.getBoundingClientRect();
      return r&&r.width>10&&r.height>10?{left:r.left,top:r.top,width:r.width,height:r.height}:{left:left.left+200,top:left.top,width:Math.max(190,left.width-200),height:Math.max(105,left.height-96)};
    }
    if(key==='details'){
      const r=document.querySelector('.wx-details')?.getBoundingClientRect();
      return r&&r.width>10&&r.height>10?{left:r.left,top:r.top,width:r.width,height:r.height}:{left:left.left,top:Math.max(left.top,left.bottom-76),width:left.width,height:76};
    }
  }
  if(key==='current')return {left:side,top:bottomTop,width:Math.min(180,leftW*.40),height:Math.max(120,bottomH-104)};
  if(key==='clock')return {left:side+Math.min(200,leftW*.43),top:bottomTop,width:Math.max(190,leftW-Math.min(200,leftW*.43)),height:Math.max(105,bottomH-104)};
  if(key==='details')return {left:side,top:Math.max(bottomTop,vp.height-92),width:leftW,height:68};
  if(right&&right.width>10){
    const d=document.getElementById('wx-forecast')?.getBoundingClientRect(),h=document.getElementById('wx-hourly-block')?.getBoundingClientRect();
    if(key==='daily'&&d&&d.width>10&&d.height>10)return {left:d.left,top:d.top,width:d.width,height:d.height};
    if(key==='hourly'&&h&&h.width>10&&h.height>10)return {left:h.left,top:h.top,width:h.width,height:h.height};
  }
  if(key==='daily')return {left:rightLeft,top:bottomTop,width:Math.min(rightWidth,vp.width-rightLeft),height:rightRowH};
  if(key==='hourly')return {left:rightLeft,top:Math.min(vp.height-rightRowH,bottomTop+rightRowH+rowGap),width:Math.min(rightWidth,vp.width-rightLeft),height:rightRowH};
  if(key==='alerts'){
    const top=calH+(ui.calendarLegend?36:14),bottom=bottomH+30;
    return {left:side,top,width:Math.max(360,vp.width-side*2),height:Math.max(110,vp.height-top-bottom)};
  }
  return null;
}
function measureDefaultLayoutRects(){
  const wasCustom=document.body.classList.contains('custom-layout'),saved={},hostSaved={};
  for(const [key,def] of Object.entries(LAYOUT_BLOCK_DEFS)){const el=document.querySelector(def.selector);if(el)saved[key]=el.getAttribute('style');}
  for(const sel of ['#wx-left','#wx-right','#bottom']){const el=document.querySelector(sel);if(el)hostSaved[sel]=el.getAttribute('style');}
  const legend=document.getElementById('calendar-legend'),legendStyle=legend?.getAttribute('style');
  document.body.classList.remove('custom-layout');
  for(const def of Object.values(LAYOUT_BLOCK_DEFS)){
    const el=document.querySelector(def.selector);if(!el)continue;
    for(const prop of ['position','left','top','width','height','right','bottom'])el.style.removeProperty(prop);
  }
  for(const sel of ['#wx-left','#wx-right','#bottom']){
    const el=document.querySelector(sel);if(!el)continue;
    for(const prop of ['position','left','top','width','height','right','bottom'])el.style.removeProperty(prop);
  }
  void document.documentElement.offsetHeight;
  const out={};
  for(const [key,def] of Object.entries(LAYOUT_BLOCK_DEFS)){
    const el=document.querySelector(def.selector);if(!el)continue;
    const rect=layoutVisualRect(key,el)||defaultFineBlockFallback(key);
    if(rect&&rect.width>1&&rect.height>1)out[key]=sanitizeLayoutRect(key,normalizedRectFromPx(rect));
  }
  for(const [key,style] of Object.entries(saved)){const el=document.querySelector(LAYOUT_BLOCK_DEFS[key].selector);if(!el)continue;if(style==null)el.removeAttribute('style');else el.setAttribute('style',style);}
  for(const [sel,style] of Object.entries(hostSaved)){const el=document.querySelector(sel);if(!el)continue;if(style==null)el.removeAttribute('style');else el.setAttribute('style',style);}
  if(legend){if(legendStyle==null)legend.removeAttribute('style');else legend.setAttribute('style',legendStyle);}
  if(wasCustom)document.body.classList.add('custom-layout');
  if(cfg.layoutMode==='custom')applyCustomLayout(cfg);
  for(const key of Object.keys(LAYOUT_BLOCK_DEFS)){
    if(validStoredLayoutRect(out[key]))continue;
    const fallback=defaultFineBlockFallback(key);
    if(fallback)out[key]=sanitizeLayoutRect(key,normalizedRectFromPx(fallback));
  }
  return out;
}
function ensureLayoutDraft(){
  const defaults=measureDefaultLayoutRects();
  if(!(cfg.layoutMode==='custom'&&cfg.layoutBlocks&&Object.keys(cfg.layoutBlocks).length))return defaults;
  const out={};
  for(const key of Object.keys(LAYOUT_BLOCK_DEFS)){
    const saved=cfg.layoutBlocks[key];
    if(validStoredLayoutRect(saved)){out[key]=cloneLayoutRect(saved);continue;}
    if(validStoredLayoutRect(defaults[key])){out[key]=cloneLayoutRect(defaults[key]);continue;}
    const fallback=defaultFineBlockFallback(key);
    if(fallback)out[key]=sanitizeLayoutRect(key,normalizedRectFromPx(fallback));
  }
  return out;
}
function layoutSnapPx(v){
  const grid=Math.max(4,Number(cfg.layoutGridPx)||20);
  return cfg.layoutSnap===false?v:Math.round(v/grid)*grid;
}
function editorSnapPx(v){
  const snap=document.getElementById('layout-toolbar-snap')?.checked!==false;
  const grid=Math.max(4,Number(document.getElementById('layout-toolbar-grid')?.value)||20);
  return snap?Math.round(v/grid)*grid:v;
}
function layoutSelectionKeyIsValid(key){return !!(key&&(LAYOUT_BLOCK_DEFS[key]||customBlockById(customKeyId(key),layoutCustomBlocksDraft)));}
function layoutSelectionKeys(){const out=[];for(const key of layoutSelectedKeys){if(layoutSelectionKeyIsValid(key)&&!out.includes(key))out.push(key);}if(layoutSelectionKeyIsValid(layoutSelectedKey)&&!out.includes(layoutSelectedKey))out.push(layoutSelectedKey);return out;}
function layoutSelectionMovableKeys(){return layoutSelectionKeys().filter(key=>layoutEditorDefForKey(key)?.locked!==true);}
function layoutSelectionBounds(keys=layoutSelectionKeys()){const rects=keys.map(key=>layoutEditorRectForKey(key)).filter(Boolean).map(pxRectFromNormalized);if(!rects.length)return null;const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top)),right=Math.max(...rects.map(r=>r.left+r.width)),bottom=Math.max(...rects.map(r=>r.top+r.height));return {left,top,width:right-left,height:bottom-top,right,bottom};}
function clearLayoutSmartGuides(){document.querySelectorAll('#layout-editor-layer .layout-smart-guide').forEach(el=>el.remove());}
function renderLayoutSmartGuides(guides=[]){clearLayoutSmartGuides();const layer=document.getElementById('layout-editor-layer');if(!layer)return;for(const guide of guides){const el=document.createElement('div');el.className='layout-smart-guide '+(guide.axis==='x'?'vertical':'horizontal');if(guide.axis==='x')el.style.left=guide.value.toFixed(1)+'px';else el.style.top=guide.value.toFixed(1)+'px';layer.appendChild(el);}}
function layoutSmartGuidesOn(){return document.getElementById('layout-toolbar-smart-guides')?.checked!==false;}
function setLayoutSmartGuides(on){const input=document.getElementById('layout-toolbar-smart-guides');if(input)input.checked=!!on;if(!on)clearLayoutSmartGuides();}
function bestMagneticAxisSnap(movingStart,movingSize,otherStarts,threshold){const moving=[{value:movingStart,role:'start'},{value:movingStart+movingSize/2,role:'center'},{value:movingStart+movingSize,role:'end'}];let best=null;for(const other of otherStarts){const targets=[{value:other.start,role:'start'},{value:(other.start+other.end)/2,role:'center'},{value:other.end,role:'end'}];for(const a of moving){for(const b of targets){const compatible=(a.role===b.role)||(a.role==='start'&&b.role==='end')||(a.role==='end'&&b.role==='start');if(!compatible)continue;const delta=b.value-a.value,dist=Math.abs(delta);if(dist<=threshold&&(!best||dist<best.dist))best={delta,value:b.value,dist};}}}return best;}
function magneticSnapForBounds(bounds,excludedKeys=[]){if(!layoutSmartGuidesOn()||!bounds)return {dx:0,dy:0,guides:[]};const excluded=new Set(excludedKeys),others=[];for(const key of [...Object.keys(LAYOUT_BLOCK_DEFS),...layoutCustomBlocksDraft.map(b=>customBlockKey(b.id))]){if(excluded.has(key))continue;const r=layoutEditorRectForKey(key);if(!r)continue;const px=pxRectFromNormalized(r);others.push({startX:px.left,endX:px.left+px.width,startY:px.top,endY:px.top+px.height});}const threshold=Math.max(6,Math.min(12,(Number(document.getElementById('layout-toolbar-grid')?.value)||20)*.5));const x=bestMagneticAxisSnap(bounds.left,bounds.width,others.map(r=>({start:r.startX,end:r.endX})),threshold),y=bestMagneticAxisSnap(bounds.top,bounds.height,others.map(r=>({start:r.startY,end:r.endY})),threshold);return {dx:x?.delta||0,dy:y?.delta||0,guides:[...(x?[{axis:'x',value:x.value}]:[]),...(y?[{axis:'y',value:y.value}]:[])]};}
function renderLayoutEditorBoxes(){
  const layer=document.getElementById('layout-editor-layer');if(!layer)return;
  layer.innerHTML='';
  const entries=[];
  for(const [key,def] of Object.entries(LAYOUT_BLOCK_DEFS)){
    let r=layoutEditorDraft[key];
    if(!validStoredLayoutRect(r)){
      const fallback=defaultFineBlockFallback(key);if(!fallback)continue;
      r=sanitizeLayoutRect(key,normalizedRectFromPx(fallback));layoutEditorDraft[key]=r;
    }
    entries.push({key,label:def.label,r});
  }
  for(const b of layoutCustomBlocksDraft){
    b.rect=customBlockRectForDisplay(b,b.rect);
    entries.push({key:customBlockKey(b.id),label:b.name||BLOCK_TYPE_INFO[b.type]?.name||'Block',r:b.rect});
  }
  entries.sort((a,b)=>(Number(b.r.w)*Number(b.r.h))-(Number(a.r.w)*Number(a.r.h)));
  for(const item of entries)appendLayoutEditBox(layer,item.key,item.label,item.r);
  refreshLayoutToolbarBlockOptions();
  updateLayoutSelectedInfo();
}
function appendLayoutEditBox(layer,key,label,r){const px=pxRectFromNormalized(r),def=layoutEditorDefForKey(key),locked=def?.locked===true,selected=layoutSelectionKeys().includes(key),box=document.createElement('div');box.className='layout-edit-box'+(selected?' selected':'')+(layoutSelectedKey===key?' primary-selected':'')+(locked?' locked':'');box.dataset.layoutKey=key;box.style.left=px.left+'px';box.style.top=px.top+'px';box.style.width=px.width+'px';box.style.height=px.height+'px';box.innerHTML=`<div class="layout-edit-label">${escHtml(label)}${locked?' · 🔒':''}</div><div class="layout-resize-handle nw" data-resize="nw" title="Resize from top left"></div><div class="layout-resize-handle ne" data-resize="ne" title="Resize from top right"></div><div class="layout-resize-handle sw" data-resize="sw" title="Resize from bottom left"></div><div class="layout-resize-handle se" data-resize="se" title="Resize from bottom right"></div>`;box.addEventListener('pointerdown',beginLayoutPointer);if(customKeyId(key)){box.title='Double-click to configure this added block · Shift/Ctrl/Cmd-click to multi-select';box.addEventListener('dblclick',e=>{e.preventDefault();selectLayoutBlock(key);configureSelectedCustomBlock();});}else box.title='Shift/Ctrl/Cmd-click to multi-select';layer.appendChild(box);}
function refreshLayoutToolbarBlockOptions(){const picker=document.getElementById('layout-toolbar-block');if(!picker)return;const current=layoutSelectedKey;picker.innerHTML='<option value="">Choose…</option>'+Object.entries(LAYOUT_BLOCK_DEFS).map(([k,d])=>`<option value="${k}">${escHtml(d.label)}</option>`).join('')+(layoutCustomBlocksDraft.length?'<optgroup label="Added blocks">'+layoutCustomBlocksDraft.map(b=>`<option value="${customBlockKey(b.id)}">${escHtml(b.name||BLOCK_TYPE_INFO[b.type]?.name||'Block')}</option>`).join('')+'</optgroup>':'');picker.value=current||'';}
function layoutEditorRectForKey(key){const id=customKeyId(key);if(id)return customBlockById(id,layoutCustomBlocksDraft)?.rect||null;return layoutEditorDraft[key]||null;}
function layoutEditorDefForKey(key){const id=customKeyId(key);if(id){const b=customBlockById(id,layoutCustomBlocksDraft);if(!b)return null;const [minW,minH]=customBlockMin(b.type,b);return {label:b.name||BLOCK_TYPE_INFO[b.type]?.name||'Block',minW,minH,custom:true,block:b,locked:b.config?._locked===true};}return LAYOUT_BLOCK_DEFS[key]||null;}
function setLayoutEditorRectForKey(key,r){const id=customKeyId(key);if(id){const b=customBlockById(id,layoutCustomBlocksDraft);if(b){b.rect=validStoredLayoutRect(r)?cloneLayoutRect(r):customBlockRectSanitize(b,r);const el=document.querySelector(`.custom-block[data-block-id="${CSS.escape(id)}"]`);applyCustomBlockRect(el,b);}return;}layoutEditorDraft[key]=validStoredLayoutRect(r)?cloneLayoutRect(r):sanitizeLayoutRect(key,r);applyOneLayoutRect(key,layoutEditorDraft[key]);}
function selectedPartDefs(){const id=customKeyId(layoutSelectedKey);if(id){const b=customBlockById(id,layoutCustomBlocksDraft);return b?customLayoutPartDefs(b.type):[];}return LAYOUT_PART_DEFS[layoutSelectedKey]||[];}
function selectedPartDefinition(){return selectedPartDefs().find(x=>x.key===layoutSelectedPart)||null;}
function selectedPartStyle(){if(layoutSelectedPart==='whole')return normalizePartStyleValue({});const id=customKeyId(layoutSelectedKey);if(id){const b=customBlockById(id,layoutCustomBlocksDraft);return normalizePartStyleValue(b?.config?._partStyles?.[layoutSelectedPart]||{});}return normalizePartStyleValue(layoutPartStyleDraft?.[layoutSelectedKey]?.[layoutSelectedPart]||{});}
function setSelectedPartStyleValue(field,value,continuous=false){if(!layoutEditorActive||!layoutSelectedKey||layoutSelectedPart==='whole'||!selectedPartDefinition())return;if(continuous){if(layoutPartFineEditField!==field){pushLayoutHistory();layoutPartFineEditField=field;}}else{pushLayoutHistory();layoutPartFineEditField='';}const current=selectedPartStyle(),next=normalizePartStyleValue({...current,[field]:value});const id=customKeyId(layoutSelectedKey);if(id){const b=customBlockById(id,layoutCustomBlocksDraft);if(!b)return;b.config=b.config||{};b.config._partStyles=b.config._partStyles&&typeof b.config._partStyles==='object'?b.config._partStyles:{};b.config._partStyles[layoutSelectedPart]=next;}else{layoutPartStyleDraft[layoutSelectedKey]=layoutPartStyleDraft[layoutSelectedKey]&&typeof layoutPartStyleDraft[layoutSelectedKey]==='object'?layoutPartStyleDraft[layoutSelectedKey]:{};layoutPartStyleDraft[layoutSelectedKey][layoutSelectedPart]=next;}applyLayoutInspectorPreview();updateLayoutSelectedInfo();}
function setSelectedPartFineStyle(field,value,continuous=false){setSelectedPartStyleValue(field,value,continuous);}
function finishSelectedPartFineStyleEdit(){layoutPartFineEditField='';}
function selectedContentScale(){if(layoutSelectedPart!=='whole')return selectedPartStyle().scale;const id=customKeyId(layoutSelectedKey);if(id)return Math.min(200,Math.max(50,Number(customBlockById(id,layoutCustomBlocksDraft)?.config?._contentScale)||100));return Math.min(200,Math.max(50,Number(layoutContentScaleDraft?.[layoutSelectedKey])||100));}
function applyLayoutEditorContentScalePreview(){if(!layoutEditorActive)return;applyUiCustomization({...cfg,layoutMode:'custom',layoutBlocks:layoutEditorDraft,layoutContentScale:layoutContentScaleDraft,layoutElementStyle:layoutElementStyleDraft,layoutPartStyle:layoutPartStyleDraft,customBlocks:layoutCustomBlocksDraft});}
function setSelectedContentScale(value){if(!layoutEditorActive||!layoutSelectedKey)return;if(layoutSelectedPart!=='whole'){setSelectedPartStyleValue('scale',value,true);return;}if(!layoutScaleEditActive){pushLayoutHistory();layoutScaleEditActive=true;}const n=Math.min(200,Math.max(50,Number(value)||100)),id=customKeyId(layoutSelectedKey);if(id){const b=customBlockById(id,layoutCustomBlocksDraft);if(!b)return;b.config=b.config||{};b.config._contentScale=n;applyCustomBlockUniversalState(document.querySelector(`.custom-block[data-block-id="${CSS.escape(id)}"]`),b);}else {layoutContentScaleDraft[layoutSelectedKey]=n;applyLayoutEditorContentScalePreview();}updateLayoutSelectedInfo();}
function finishSelectedContentScaleEdit(){layoutScaleEditActive=false;layoutPartFineEditField='';}
function resetSelectedContentScale(){if(!layoutEditorActive||!layoutSelectedKey)return;if(layoutSelectedPart!=='whole'){setSelectedPartStyleValue('scale',100,false);return;}pushLayoutHistory();layoutScaleEditActive=false;const id=customKeyId(layoutSelectedKey);if(id){const b=customBlockById(id,layoutCustomBlocksDraft);if(!b)return;b.config=b.config||{};b.config._contentScale=100;applyCustomBlockUniversalState(document.querySelector(`.custom-block[data-block-id="${CSS.escape(id)}"]`),b);}else {layoutContentScaleDraft[layoutSelectedKey]=100;applyLayoutEditorContentScalePreview();}updateLayoutSelectedInfo();}
function selectedLayoutStyle(){if(layoutSelectedPart!=='whole'){const p=selectedPartStyle();return {hAlign:p.textAlign,vAlign:'auto',fontFamily:p.fontFamily,textColor:p.textColor,opacity:p.opacity};}const id=customKeyId(layoutSelectedKey);if(id){const c=customBlockById(id,layoutCustomBlocksDraft)?.config||{};return {hAlign:c._hAlign||'auto',vAlign:c._vAlign||'auto',fontFamily:c._fontFamily||'',textColor:c._textColor||'',opacity:Math.min(100,Math.max(20,Number(c._opacity)||100))};}const s=layoutElementStyleDraft?.[layoutSelectedKey]||{};return {hAlign:s.hAlign||'auto',vAlign:s.vAlign||'auto',fontFamily:s.fontFamily||'',textColor:s.textColor||'',opacity:Math.min(100,Math.max(20,Number(s.opacity)||100))};}
function applyLayoutInspectorPreview(){if(!layoutEditorActive)return;applyUiCustomization({...cfg,layoutMode:'custom',layoutBlocks:layoutEditorDraft,layoutContentScale:layoutContentScaleDraft,layoutElementStyle:layoutElementStyleDraft,layoutPartStyle:layoutPartStyleDraft,customBlocks:layoutCustomBlocksDraft});}
function setSelectedLayoutStyle(field,value,continuous=false){if(!layoutEditorActive||!layoutSelectedKey)return;if(layoutSelectedPart!=='whole'){const map={hAlign:'textAlign',fontFamily:'fontFamily',textColor:'textColor',opacity:'opacity'};const target=map[field];if(!target)return;setSelectedPartStyleValue(target,value,continuous);return;}if(continuous){if(layoutStyleEditField!==field){pushLayoutHistory();layoutStyleEditField=field;}}else{pushLayoutHistory();layoutStyleEditField='';}const id=customKeyId(layoutSelectedKey);const h=['auto','left','center','right'],v=['auto','top','middle','bottom'],fonts=LAYOUT_PART_FONT_FAMILIES;let val=value;if(field==='hAlign')val=h.includes(value)?value:'auto';if(field==='vAlign')val=v.includes(value)?value:'auto';if(field==='fontFamily')val=fonts.includes(value)?value:'';if(field==='textColor')val=/^#[0-9a-f]{6}$/i.test(value||'')?String(value).toLowerCase():'';if(field==='opacity')val=Math.min(100,Math.max(20,Number(value)||100));if(id){const b=customBlockById(id,layoutCustomBlocksDraft);if(!b)return;b.config=b.config||{};const map={hAlign:'_hAlign',vAlign:'_vAlign',fontFamily:'_fontFamily',textColor:'_textColor',opacity:'_opacity'};b.config[map[field]]=val;applyCustomBlockUniversalState(document.querySelector(`.custom-block[data-block-id="${CSS.escape(id)}"]`),b);}else{layoutElementStyleDraft[layoutSelectedKey]={...(layoutElementStyleDraft[layoutSelectedKey]||{}),[field]:val};applyLayoutInspectorPreview();}updateLayoutSelectedInfo();}
function finishSelectedLayoutStyleEdit(){layoutStyleEditField='';layoutPartFineEditField='';}
function setSelectedLayoutColorHex(value){let c=String(value||'').trim();if(c&&!c.startsWith('#'))c='#'+c;if(/^#[0-9a-f]{3}$/i.test(c))c='#'+c.slice(1).split('').map(x=>x+x).join('');setSelectedLayoutStyle('textColor',/^#[0-9a-f]{6}$/i.test(c)?c:'');}
function resetSelectedStyleScope(){if(!layoutEditorActive||!layoutSelectedKey)return;pushLayoutHistory();layoutScaleEditActive=false;layoutStyleEditField='';layoutPartFineEditField='';const id=customKeyId(layoutSelectedKey);if(layoutSelectedPart!=='whole'){if(id){const b=customBlockById(id,layoutCustomBlocksDraft);if(b?.config?._partStyles)delete b.config._partStyles[layoutSelectedPart];}else if(layoutPartStyleDraft?.[layoutSelectedKey])delete layoutPartStyleDraft[layoutSelectedKey][layoutSelectedPart];applyLayoutInspectorPreview();updateLayoutSelectedInfo();return;}if(id){const b=customBlockById(id,layoutCustomBlocksDraft);if(!b)return;b.config=b.config||{};Object.assign(b.config,{_contentScale:100,_hAlign:'auto',_vAlign:'auto',_fontFamily:'',_textColor:'',_opacity:100,_partStyles:{}});applyCustomBlockUniversalState(document.querySelector(`.custom-block[data-block-id="${CSS.escape(id)}"]`),b);}else{layoutContentScaleDraft[layoutSelectedKey]=100;layoutElementStyleDraft[layoutSelectedKey]={hAlign:'auto',vAlign:'auto',fontFamily:'',textColor:'',opacity:100};}applyLayoutInspectorPreview();updateLayoutSelectedInfo();}
function selectLayoutPart(part){const valid=new Set(['whole',...selectedPartDefs().map(x=>x.key)]);layoutSelectedPart=valid.has(part)?part:'whole';layoutScaleEditActive=false;layoutStyleEditField='';layoutPartFineEditField='';updateLayoutSelectedInfo();}
function refreshLayoutPartPicker(){const picker=document.getElementById('layout-part-picker');if(!picker)return;const defs=selectedPartDefs(),valid=new Set(['whole',...defs.map(x=>x.key)]);if(!valid.has(layoutSelectedPart))layoutSelectedPart='whole';picker.innerHTML='<option value="whole">Whole element</option>'+defs.map(x=>`<option value="${escHtml(x.key)}">${escHtml(x.label)}</option>`).join('');picker.value=layoutSelectedPart;}

function placeSelectedLayoutBlock(anchor){
  const r=layoutEditorRectForKey(layoutSelectedKey),def=layoutEditorDefForKey(layoutSelectedKey);if(!layoutEditorActive||!r||!def||def.locked)return;
  pushLayoutHistory();const vp=layoutViewportSize(),px=pxRectFromNormalized(r),pad=Math.max(8,Number(document.getElementById('layout-toolbar-grid')?.value)||20);let left=px.left,top=px.top;
  if(anchor.includes('left'))left=pad;else if(anchor.includes('right'))left=vp.width-px.width-pad;else left=(vp.width-px.width)/2;
  if(anchor.startsWith('top'))top=pad;else if(anchor.startsWith('bottom'))top=vp.height-px.height-pad;else top=(vp.height-px.height)/2;
  left=Math.max(0,Math.min(vp.width-px.width,left));top=Math.max(0,Math.min(vp.height-px.height,top));
  setLayoutEditorRectForKey(layoutSelectedKey,normalizedRectFromPx({left,top,width:px.width,height:px.height}));renderLayoutEditorBoxes();selectLayoutBlock(layoutSelectedKey);
}

function alignSelectedLayoutBlockAxis(action){
  const r=layoutEditorRectForKey(layoutSelectedKey),def=layoutEditorDefForKey(layoutSelectedKey);if(!layoutEditorActive||!layoutSelectedKey||!r||!def||def.locked)return;
  pushLayoutHistory();const vp=layoutViewportSize(),px=pxRectFromNormalized(r);let left=px.left,top=px.top;
  if(action==='center-x')left=(vp.width-px.width)/2;
  else if(action==='center-y')top=(vp.height-px.height)/2;
  else if(action==='mirror-x')left=vp.width-(px.left+px.width);
  else if(action==='mirror-y')top=vp.height-(px.top+px.height);
  else return;
  left=Math.max(0,Math.min(vp.width-px.width,left));top=Math.max(0,Math.min(vp.height-px.height,top));
  setLayoutEditorRectForKey(layoutSelectedKey,normalizedRectFromPx({left,top,width:px.width,height:px.height}));renderLayoutEditorBoxes();selectLayoutBlock(layoutSelectedKey);
}

function selectLayoutBlock(key,preservePart=false,multi=false){
  if(key&&!layoutSelectionKeyIsValid(key))return;
  const next=key||'',previous=layoutSelectedKey;
  if(multi&&next){const selected=layoutSelectionKeys();if(selected.includes(next)){layoutSelectedKeys=selected.filter(k=>k!==next);layoutSelectedKey=layoutSelectedKeys.at(-1)||'';}else{layoutSelectedKeys=[...selected,next];layoutSelectedKey=next;}}else{layoutSelectedKey=next;layoutSelectedKeys=next?[next]:[];}
  if(layoutSelectedKey!==previous&&!preservePart)layoutSelectedPart='whole';
  const selectedNow=new Set(layoutSelectionKeys());document.querySelectorAll('.layout-edit-box').forEach(el=>{el.classList.toggle('selected',selectedNow.has(el.dataset.layoutKey));el.classList.toggle('primary-selected',el.dataset.layoutKey===layoutSelectedKey);});
  const picker=document.getElementById('layout-toolbar-block');if(picker&&picker.value!==layoutSelectedKey)picker.value=layoutSelectedKey;
  refreshToolbarCustomActions();refreshLayoutPartPicker();updateLayoutSelectedInfo();
}
function applyLayoutSelectionRelationship(action){
  if(!layoutEditorActive)return;const keys=layoutSelectionKeys(),primary=layoutSelectedKey;if(keys.length<2||!primary)return;const anchorRect=layoutEditorRectForKey(primary);if(!anchorRect)return;const anchor=pxRectFromNormalized(anchorRect),vp=layoutViewportSize();if((action==='space-h'||action==='space-v')&&keys.length<3)return;pushLayoutHistory();
  if(action==='space-h'||action==='space-v'){const axis=action==='space-h'?'x':'y',items=keys.map(key=>({key,def:layoutEditorDefForKey(key),rect:pxRectFromNormalized(layoutEditorRectForKey(key))})).filter(x=>x.rect).sort((a,b)=>axis==='x'?a.rect.left-b.rect.left:a.rect.top-b.rect.top);const first=items[0],last=items.at(-1),totalSize=items.reduce((sum,x)=>sum+(axis==='x'?x.rect.width:x.rect.height),0),span=axis==='x'?(last.rect.left+last.rect.width-first.rect.left):(last.rect.top+last.rect.height-first.rect.top),gap=(span-totalSize)/Math.max(1,items.length-1);let cursor=axis==='x'?first.rect.left:first.rect.top;for(const item of items){const r={...item.rect};if(item!==first&&item!==last&&item.def?.locked!==true){if(axis==='x')r.left=cursor;else r.top=cursor;setLayoutEditorRectForKey(item.key,normalizedRectFromPx(r));}cursor+=(axis==='x'?item.rect.width:item.rect.height)+gap;}renderLayoutEditorBoxes();refreshToolbarCustomActions();refreshLayoutPartPicker();updateLayoutSelectedInfo();return;}
  for(const key of keys){if(key===primary)continue;const def=layoutEditorDefForKey(key),raw=layoutEditorRectForKey(key);if(!def||!raw||def.locked)continue;const r=pxRectFromNormalized(raw);if(action==='align-left')r.left=anchor.left;else if(action==='align-center-x')r.left=anchor.left+(anchor.width-r.width)/2;else if(action==='align-right')r.left=anchor.left+anchor.width-r.width;else if(action==='align-top')r.top=anchor.top;else if(action==='align-middle-y')r.top=anchor.top+(anchor.height-r.height)/2;else if(action==='align-bottom')r.top=anchor.top+anchor.height-r.height;else if(action==='match-width')r.width=Math.max(def.minW,Math.min(vp.width-r.left,anchor.width));else if(action==='match-height')r.height=Math.max(def.minH,Math.min(vp.height-r.top,anchor.height));else continue;r.left=Math.max(0,Math.min(vp.width-r.width,r.left));r.top=Math.max(0,Math.min(vp.height-r.height,r.top));setLayoutEditorRectForKey(key,normalizedRectFromPx(r));}
  renderLayoutEditorBoxes();refreshToolbarCustomActions();refreshLayoutPartPicker();updateLayoutSelectedInfo();
}
function updateLayoutSelectedInfo(){
  const el=document.getElementById('layout-selected-info'),range=document.getElementById('layout-toolbar-scale'),scaleNumber=document.getElementById('layout-toolbar-scale-number'),value=document.getElementById('layout-toolbar-scale-value'),control=document.getElementById('layout-properties-controls'),title=document.getElementById('layout-properties-title'),subtitle=document.getElementById('layout-properties-subtitle');if(!el)return;
  const selectedRect=layoutEditorRectForKey(layoutSelectedKey),def=layoutEditorDefForKey(layoutSelectedKey),has=!!(layoutSelectedKey&&selectedRect&&def),selection=layoutSelectionKeys(),selectionCount=selection.length;control?.classList.toggle('layout-prop-disabled',!has);if(range)range.disabled=!has;if(scaleNumber)scaleNumber.disabled=!has;refreshLayoutPartPicker();
  const partDef=selectedPartDefinition(),partMode=has&&layoutSelectedPart!=='whole'&&!!partDef;document.getElementById('layout-part-advanced')?.toggleAttribute('hidden',!partMode);document.getElementById('layout-v-section')?.toggleAttribute('hidden',partMode);document.getElementById('layout-place-section')?.toggleAttribute('hidden',partMode);document.getElementById('layout-group-section')?.toggleAttribute('hidden',partMode||selectionCount<2);const countEl=document.getElementById('layout-selection-count');if(countEl)countEl.textContent=selectionCount>1?`${selectionCount} selected`:'Select 2+';document.querySelectorAll('[data-layout-relation]').forEach(btn=>{const need=Number(btn.dataset.minSelection||2);btn.disabled=selectionCount<need;});
  const scopeLabel=document.getElementById('layout-part-scope-label'),sizeLabel=document.getElementById('layout-size-label'),typoScope=document.getElementById('layout-typography-scope'),hLabel=document.getElementById('layout-h-label'),hScope=document.getElementById('layout-h-scope'),opacityLabel=document.getElementById('layout-opacity-label');if(scopeLabel)scopeLabel.textContent=partMode?partDef.label:'Whole element';if(sizeLabel)sizeLabel.textContent=partMode?'Section text size':'Content size';if(typoScope)typoScope.textContent=partMode?'Selected section':'Per element';if(hLabel)hLabel.textContent=partMode?'Text alignment':'Horizontal content';if(hScope)hScope.textContent=partMode?'Selected section':'Inside block';if(opacityLabel)opacityLabel.textContent=partMode?'Section opacity':'Element opacity';
  if(!has){if(range)range.value='100';if(scaleNumber)scaleNumber.value='100';if(value)value.textContent='100%';el.textContent='Select an element · drag to move · corner to resize';if(title)title.textContent='Element inspector';if(subtitle)subtitle.textContent='Select an element to customize its contents.';return;}
  const px=pxRectFromNormalized(selectedRect),scale=selectedContentScale(),st=selectedLayoutStyle();if(range)range.value=String(scale);if(scaleNumber)scaleNumber.value=String(scale);if(value)value.textContent=scale+'%';if(title)title.textContent=selectionCount>1?`${selectionCount} elements · ${def.label} primary`:def.label;if(subtitle)subtitle.textContent=partMode?`${partDef.label} · ${Math.round(px.width)} × ${Math.round(px.height)} px element`:(selectionCount>1?`Primary element · ${Math.round(px.width)} × ${Math.round(px.height)} px · style controls affect ${def.label}`:`${Math.round(px.width)} × ${Math.round(px.height)} px · content ${scale}%`);
  const font=document.getElementById('layout-style-font');if(font)font.value=st.fontFamily||'';const color=document.getElementById('layout-style-color'),hex=document.getElementById('layout-style-color-hex');if(color)color.value=st.textColor||normalizeHexColor(cfg.primaryTextColor,'#ffffff');if(hex)hex.value=st.textColor?st.textColor.toUpperCase():'Theme';const opacity=document.getElementById('layout-style-opacity'),ov=document.getElementById('layout-style-opacity-value');if(opacity)opacity.value=String(st.opacity);if(ov)ov.textContent=st.opacity+'%';
  for(const h of ['auto','left','center','right'])document.getElementById('layout-h-'+h)?.classList.toggle('active',st.hAlign===h);for(const v of ['auto','top','middle','bottom'])document.getElementById('layout-v-'+v)?.classList.toggle('active',st.vAlign===v);
  if(partMode){const ps=selectedPartStyle(),weight=document.getElementById('layout-part-weight'),line=document.getElementById('layout-part-line-height'),lineVal=document.getElementById('layout-part-line-height-value'),letter=document.getElementById('layout-part-letter-spacing'),letterVal=document.getElementById('layout-part-letter-spacing-value'),visible=document.getElementById('layout-part-visible');if(weight)weight.value=ps.fontWeight||'';if(line)line.value=String(ps.lineHeight);if(lineVal)lineVal.textContent=ps.lineHeight+'%';if(letter)letter.value=String(ps.letterSpacing);if(letterVal)letterVal.textContent=(Math.round(ps.letterSpacing*100)/100)+'px';if(visible)visible.checked=ps.visible!==false;}
  el.textContent=partMode?`${def.label} · ${partDef.label} · ${scale}%`:(selectionCount>1?`${selectionCount} selected · primary ${def.label}`:`${def.label} · ${Math.round(px.width)}×${Math.round(px.height)} · ${scale}%`);
}
function beginLayoutPointer(e){
  if(!layoutEditorActive)return;
  const box=e.currentTarget,key=box.dataset.layoutKey,r=layoutEditorRectForKey(key);if(!r)return;const additive=!!(e.shiftKey||e.ctrlKey||e.metaKey),before=layoutSelectionKeys();
  if(additive)selectLayoutBlock(key,false,true);else if(before.includes(key)&&before.length>1){layoutSelectedKey=key;layoutSelectedKeys=before;layoutSelectedPart='whole';const chosen=new Set(before);document.querySelectorAll('.layout-edit-box').forEach(el=>{el.classList.toggle('selected',chosen.has(el.dataset.layoutKey));el.classList.toggle('primary-selected',el.dataset.layoutKey===key);});const picker=document.getElementById('layout-toolbar-block');if(picker)picker.value=key;refreshToolbarCustomActions();refreshLayoutPartPicker();updateLayoutSelectedInfo();}else selectLayoutBlock(key);
  if(additive&&!layoutSelectionKeys().includes(key)){e.preventDefault();return;}const def=layoutEditorDefForKey(key);if(def?.locked){e.preventDefault();return;}pushLayoutHistory();box.setPointerCapture?.(e.pointerId);
  const px=pxRectFromNormalized(r),mode=e.target?.dataset?.resize?('resize-'+e.target.dataset.resize):'move',groupKeys=mode==='move'&&layoutSelectionKeys().includes(key)?layoutSelectionMovableKeys():[key],startRects={};for(const k of groupKeys){const rr=layoutEditorRectForKey(k);if(rr)startRects[k]=pxRectFromNormalized(rr);}const groupBounds=layoutSelectionBounds(groupKeys);
  layoutPointerState={key,mode,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,start:px,groupKeys,startRects,groupBounds};
  e.preventDefault();
}
function moveLayoutPointer(e){
  const st=layoutPointerState;if(!st||!layoutEditorActive)return;
  const def=layoutEditorDefForKey(st.key),dx=e.clientX-st.startX,dy=e.clientY-st.startY,vp=layoutViewportSize();if(!def)return;
  let left=st.start.left,top=st.start.top,width=st.start.width,height=st.start.height,guides=[];
  if(st.mode==='move'){
    const groupKeys=st.groupKeys?.length?st.groupKeys:[st.key],bounds=st.groupBounds||{left:st.start.left,top:st.start.top,width:st.start.width,height:st.start.height,right:st.start.left+st.start.width,bottom:st.start.top+st.start.height};let moveX=editorSnapPx(st.start.left+dx)-st.start.left,moveY=editorSnapPx(st.start.top+dy)-st.start.top;
    moveX=Math.max(-bounds.left,Math.min(vp.width-bounds.right,moveX));moveY=Math.max(-bounds.top,Math.min(vp.height-bounds.bottom,moveY));let moved={left:bounds.left+moveX,top:bounds.top+moveY,width:bounds.width,height:bounds.height};if(!e.altKey){const magnetic=magneticSnapForBounds(moved,layoutSelectionKeys());moveX+=magnetic.dx;moveY+=magnetic.dy;moveX=Math.max(-bounds.left,Math.min(vp.width-bounds.right,moveX));moveY=Math.max(-bounds.top,Math.min(vp.height-bounds.bottom,moveY));guides=magnetic.guides;}
    for(const key of groupKeys){const r=st.startRects?.[key];if(!r)continue;setLayoutEditorRectForKey(key,normalizedRectFromPx({left:r.left+moveX,top:r.top+moveY,width:r.width,height:r.height}));}
  }else{
    const dir=String(st.mode||'').slice(7),right=st.start.left+st.start.width,bottom=st.start.top+st.start.height;
    if(dir.includes('w')){left=editorSnapPx(st.start.left+dx);left=Math.max(0,Math.min(right-def.minW,left));width=right-left;}
    if(dir.includes('e')){width=editorSnapPx(st.start.width+dx);width=Math.max(def.minW,Math.min(vp.width-st.start.left,width));left=st.start.left;}
    if(dir.includes('n')){top=editorSnapPx(st.start.top+dy);top=Math.max(0,Math.min(bottom-def.minH,top));height=bottom-top;}
    if(dir.includes('s')){height=editorSnapPx(st.start.height+dy);height=Math.max(def.minH,Math.min(vp.height-st.start.top,height));top=st.start.top;}
    setLayoutEditorRectForKey(st.key,normalizedRectFromPx({left,top,width,height}));
  }
  renderLayoutEditorBoxes();if(guides.length)renderLayoutSmartGuides(guides);e.preventDefault();
}
function endLayoutPointer(e){if(layoutPointerState&&(!e||e.pointerId===layoutPointerState.pointerId)){layoutPointerState=null;clearLayoutSmartGuides();renderLayoutEditorBoxes();}}
function setLayoutEditorGrid(v){
  const n=[8,12,16,20,24,32].includes(Number(v))?Number(v):20;
  document.getElementById('layout-editor-layer')?.style.setProperty('--layout-grid-size',n+'px');
  const settings=document.getElementById('s-layout-grid');if(settings)settings.value=String(n);
}
function setLayoutEditorSnap(on){
  const layer=document.getElementById('layout-editor-layer');layer?.classList.toggle('grid-on',!!on);
  const settings=document.getElementById('s-layout-snap');if(settings)settings.checked=!!on;
}
function startLayoutEditor(){
  if(layoutEditorActive)return;
  refreshLayoutSessionViewport();
  layoutEditorOriginal={layoutMode:cfg.layoutMode,layoutBlocks:JSON.parse(JSON.stringify(cfg.layoutBlocks||{})),layoutContentScale:JSON.parse(JSON.stringify(cfg.layoutContentScale||{})),layoutElementStyle:JSON.parse(JSON.stringify(cfg.layoutElementStyle||{})),layoutPartStyle:JSON.parse(JSON.stringify(cfg.layoutPartStyle||{})),layoutGridPx:cfg.layoutGridPx,layoutSnap:cfg.layoutSnap};
  layoutCustomBlocksOriginal=JSON.parse(JSON.stringify(cfg.customBlocks||[]));layoutCustomBlocksDraft=normalizeCustomBlockDraftRects(JSON.parse(JSON.stringify(cfg.customBlocks||[])));
  layoutEditorDraft=ensureLayoutDraft();layoutContentScaleDraft=JSON.parse(JSON.stringify(cfg.layoutContentScale||{}));layoutElementStyleDraft=JSON.parse(JSON.stringify(cfg.layoutElementStyle||{}));layoutPartStyleDraft=JSON.parse(JSON.stringify(cfg.layoutPartStyle||{}));layoutSelectedKey='';layoutSelectedKeys=[];layoutSelectedPart='whole';layoutEditorActive=true;layoutScaleEditActive=false;layoutStyleEditField='';layoutPartFineEditField='';layoutUndoStack=[];layoutRedoStack=[];updateLayoutHistoryButtons();
  cfg.layoutMode='custom';cfg.layoutBlocks=JSON.parse(JSON.stringify(layoutEditorDraft));
  document.body.classList.add('custom-layout','layout-editing');
  for(const [key,r] of Object.entries(layoutEditorDraft))applyOneLayoutRect(key,r);
  renderCustomBlocks(layoutCustomBlocksDraft);
  const layer=document.getElementById('layout-editor-layer'),toolbar=document.getElementById('layout-toolbar'),props=document.getElementById('layout-properties');
  layer?.classList.add('show');toolbar?.classList.add('show');props?.classList.add('show');
  layer?.setAttribute('aria-hidden','false');toolbar?.setAttribute('aria-hidden','false');props?.setAttribute('aria-hidden','false');initLayoutInspectorDrag();restoreLayoutInspectorPosition();
  const grid=Number(document.getElementById('s-layout-grid')?.value)||cfg.layoutGridPx||20,snap=document.getElementById('s-layout-snap')?.checked!==false;
  const gridSel=document.getElementById('layout-toolbar-grid');if(gridSel)gridSel.value=String(grid);
  const blockSel=document.getElementById('layout-toolbar-block');if(blockSel)blockSel.value='';
  const snapEl=document.getElementById('layout-toolbar-snap');if(snapEl)snapEl.checked=snap;const smart=document.getElementById('layout-toolbar-smart-guides');if(smart)smart.checked=true;
  setLayoutEditorGrid(grid);setLayoutEditorSnap(snap);setLayoutSmartGuides(true);applyLayoutEditorContentScalePreview();renderLayoutEditorBoxes();
  document.addEventListener('pointermove',moveLayoutPointer,{passive:false});document.addEventListener('pointerup',endLayoutPointer);
}
let layoutSaveInFlight=false;
async function saveLayoutEditor(){
  if(!layoutEditorActive||layoutSaveInFlight)return;
  layoutSaveInFlight=true;
  const saveButton=document.getElementById('layout-save');
  if(saveButton){saveButton.disabled=true;saveButton.textContent='Saving…';}
  try{
    cfg.layoutMode='custom';cfg.layoutBlocks=JSON.parse(JSON.stringify(layoutEditorDraft));cfg.layoutContentScale=JSON.parse(JSON.stringify(layoutContentScaleDraft));cfg.layoutElementStyle=JSON.parse(JSON.stringify(layoutElementStyleDraft));cfg.layoutPartStyle=JSON.parse(JSON.stringify(layoutPartStyleDraft));cfg.customBlocks=JSON.parse(JSON.stringify(layoutCustomBlocksDraft));customBlockRenderSignature='';
    cfg.layoutGridPx=Number(document.getElementById('layout-toolbar-grid')?.value)||20;
    cfg.layoutSnap=document.getElementById('layout-toolbar-snap')?.checked!==false;
    const persisted=await saveCfg();
    if(LAYOUT_PREVIEW_MODE&&!persisted?.ok){
      alert('Could not save the Arrange layout to this display. The editor will stay open so you can retry. '+(persisted?.error||'Server save failed.'));
      return;
    }
    stopLayoutEditorUi();layoutEditorOriginal=null;layoutCustomBlocksOriginal=[];applyUiCustomization(cfg);updateLayoutModeStatus(cfg);
    if(LAYOUT_PREVIEW_MODE&&window.parent!==window)notifyLayoutPreviewParent('saved');
  }finally{
    layoutSaveInFlight=false;
    if(saveButton){saveButton.disabled=false;saveButton.textContent='Save & Lock';}
  }
}


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("layout", {customLayoutPartDefs,normalizePartStyleValue,normalizePartStyleMap,normalizeBuiltInPartStyleTree,partStyleHasOverride,partStyleExtras,customPartFontSize,buildCustomLayoutPartCss,layoutInspectorPositionKey,layoutInspectorClamp,setLayoutInspectorPosition,restoreLayoutInspectorPosition,resetLayoutInspectorPosition,keepLayoutInspectorOnScreen,toggleLayoutInspectorCollapse,initLayoutInspectorDrag,layoutHistorySnapshot,updateLayoutHistoryButtons,pushLayoutHistory,restoreLayoutHistorySnapshot,undoLayoutEditor,redoLayoutEditor,clamp01,readLayoutViewport,layoutViewportSize,refreshLayoutSessionViewport,normalizedRectFromPx,pxRectFromNormalized,validLayoutRect,validStoredLayoutRect,cloneLayoutRect,sanitizeLayoutRect,layoutRectForDisplay,clearCustomLayoutStyles,applyOneLayoutRect,applyCustomLayout,applyBuiltInElementStyles,clearBuiltInLayoutAutoFit,clampLayoutFit,calendarFitScale,forecastFitScale,currentWeatherFitScale,clockFitScale,syncWeatherDetailsArrangeGrid,weatherDetailsFitScale,updateBuiltInLayoutAutoFit,scheduleBuiltInLayoutAutoFit,bindBuiltInLayoutAutoFitObserver,updateLayoutModeStatus,layoutVisualRect,gridTrackPixels,defaultFineBlockFallback,measureDefaultLayoutRects,ensureLayoutDraft,layoutSnapPx,editorSnapPx,renderLayoutEditorBoxes,appendLayoutEditBox,refreshLayoutToolbarBlockOptions,layoutEditorRectForKey,layoutEditorDefForKey,setLayoutEditorRectForKey,selectedPartDefs,selectedPartDefinition,selectedPartStyle,setSelectedPartStyleValue,setSelectedPartFineStyle,finishSelectedPartFineStyleEdit,selectedContentScale,applyLayoutEditorContentScalePreview,setSelectedContentScale,finishSelectedContentScaleEdit,resetSelectedContentScale,selectedLayoutStyle,applyLayoutInspectorPreview,setSelectedLayoutStyle,finishSelectedLayoutStyleEdit,setSelectedLayoutColorHex,resetSelectedStyleScope,selectLayoutPart,refreshLayoutPartPicker,placeSelectedLayoutBlock,alignSelectedLayoutBlockAxis,layoutSelectionKeyIsValid,layoutSelectionKeys,layoutSelectionMovableKeys,layoutSelectionBounds,clearLayoutSmartGuides,renderLayoutSmartGuides,layoutSmartGuidesOn,setLayoutSmartGuides,bestMagneticAxisSnap,magneticSnapForBounds,applyLayoutSelectionRelationship,selectLayoutBlock,updateLayoutSelectedInfo,beginLayoutPointer,moveLayoutPointer,endLayoutPointer,setLayoutEditorGrid,setLayoutEditorSnap,startLayoutEditor,saveLayoutEditor}, {
  "LAYOUT_BLOCK_DEFS": {configurable:true,get:()=>LAYOUT_BLOCK_DEFS},
  "LAYOUT_PART_DEFS": {configurable:true,get:()=>LAYOUT_PART_DEFS},
  "CUSTOM_LAYOUT_PART_DEFS": {configurable:true,get:()=>CUSTOM_LAYOUT_PART_DEFS},
  "GENERIC_CUSTOM_PART_DEFS": {configurable:true,get:()=>GENERIC_CUSTOM_PART_DEFS},
  "LAYOUT_PART_FONT_FAMILIES": {configurable:true,get:()=>LAYOUT_PART_FONT_FAMILIES},
  "LAYOUT_INSPECTOR_POS_KEY": {configurable:true,get:()=>LAYOUT_INSPECTOR_POS_KEY},
  "REMOTE_LAYOUT_INSPECTOR_POS_KEY": {configurable:true,get:()=>REMOTE_LAYOUT_INSPECTOR_POS_KEY},
  "layoutInspectorDragState": {configurable:true,get:()=>layoutInspectorDragState,set:(value)=>{layoutInspectorDragState=value;}},
  "layoutEditorActive": {configurable:true,get:()=>layoutEditorActive,set:(value)=>{layoutEditorActive=value;}},
  "layoutSessionViewport": {configurable:true,get:()=>layoutSessionViewport,set:(value)=>{layoutSessionViewport=value;}},
  "layoutEditorDraft": {configurable:true,get:()=>layoutEditorDraft,set:(value)=>{layoutEditorDraft=value;}},
  "layoutEditorOriginal": {configurable:true,get:()=>layoutEditorOriginal,set:(value)=>{layoutEditorOriginal=value;}},
  "layoutSelectedKey": {configurable:true,get:()=>layoutSelectedKey,set:(value)=>{layoutSelectedKey=value;}},
  "layoutSelectedKeys": {configurable:true,get:()=>layoutSelectedKeys,set:(value)=>{layoutSelectedKeys=Array.isArray(value)?value:[];}},
  "layoutPointerState": {configurable:true,get:()=>layoutPointerState,set:(value)=>{layoutPointerState=value;}},
  "layoutContentScaleDraft": {configurable:true,get:()=>layoutContentScaleDraft,set:(value)=>{layoutContentScaleDraft=value;}},
  "layoutElementStyleDraft": {configurable:true,get:()=>layoutElementStyleDraft,set:(value)=>{layoutElementStyleDraft=value;}},
  "layoutPartStyleDraft": {configurable:true,get:()=>layoutPartStyleDraft,set:(value)=>{layoutPartStyleDraft=value;}},
  "layoutSelectedPart": {configurable:true,get:()=>layoutSelectedPart,set:(value)=>{layoutSelectedPart=value;}},
  "layoutScaleEditActive": {configurable:true,get:()=>layoutScaleEditActive,set:(value)=>{layoutScaleEditActive=value;}},
  "layoutStyleEditField": {configurable:true,get:()=>layoutStyleEditField,set:(value)=>{layoutStyleEditField=value;}},
  "layoutPartFineEditField": {configurable:true,get:()=>layoutPartFineEditField,set:(value)=>{layoutPartFineEditField=value;}},
  "layoutUndoStack": {configurable:true,get:()=>layoutUndoStack,set:(value)=>{layoutUndoStack=value;}},
  "layoutRedoStack": {configurable:true,get:()=>layoutRedoStack,set:(value)=>{layoutRedoStack=value;}},
  "builtInLayoutAutoFitRaf": {configurable:true,get:()=>builtInLayoutAutoFitRaf,set:(value)=>{builtInLayoutAutoFitRaf=value;}},
  "builtInLayoutAutoFitObserver": {configurable:true,get:()=>builtInLayoutAutoFitObserver,set:(value)=>{builtInLayoutAutoFitObserver=value;}},
  "builtInLayoutAutoFitResizeObserver": {configurable:true,get:()=>builtInLayoutAutoFitResizeObserver,set:(value)=>{builtInLayoutAutoFitResizeObserver=value;}},
  "layoutSaveInFlight": {configurable:true,get:()=>layoutSaveInFlight,set:(value)=>{layoutSaveInFlight=value;}}
}, {globalFunctions:['customLayoutPartDefs','normalizePartStyleValue','normalizePartStyleMap','normalizeBuiltInPartStyleTree','partStyleExtras','buildCustomLayoutPartCss','restoreLayoutInspectorPosition','resetLayoutInspectorPosition','keepLayoutInspectorOnScreen','toggleLayoutInspectorCollapse','initLayoutInspectorDrag','updateLayoutHistoryButtons','pushLayoutHistory','undoLayoutEditor','redoLayoutEditor','layoutViewportSize','refreshLayoutSessionViewport','normalizedRectFromPx','pxRectFromNormalized','validLayoutRect','validStoredLayoutRect','cloneLayoutRect','applyOneLayoutRect','applyCustomLayout','applyBuiltInElementStyles','scheduleBuiltInLayoutAutoFit','updateLayoutModeStatus','measureDefaultLayoutRects','renderLayoutEditorBoxes','layoutEditorRectForKey','layoutEditorDefForKey','setLayoutEditorRectForKey','setSelectedPartFineStyle','finishSelectedPartFineStyleEdit','setSelectedContentScale','finishSelectedContentScaleEdit','resetSelectedContentScale','setSelectedLayoutStyle','finishSelectedLayoutStyleEdit','setSelectedLayoutColorHex','resetSelectedStyleScope','selectLayoutPart','placeSelectedLayoutBlock','selectLayoutBlock','moveLayoutPointer','endLayoutPointer','setLayoutEditorGrid','setLayoutEditorSnap','startLayoutEditor','saveLayoutEditor'],globalStates:['layoutEditorActive','layoutSelectedKey']});
}
// End source section: /js/layout/index.js

// LibreDisplay source section: /js/layout/integration-layout.js
{
// Internal Arrange support for integration blocks.
// Plugins can expose stable section/subsection selectors through manifest.layoutParts.

const integrationsApi=LibreDisplayRuntime.getModule('integrations');
const blocksApi=LibreDisplayRuntime.getModule('blocks');
const layoutApi=LibreDisplayRuntime.getModule('layout');
const {escHtml}=LibreDisplayRuntime.getModule('shared');

const APPLIED_ATTR='data-ld-internal-layout-applied';
const TRACKED_STYLE_PROPS=['position','left','right','top','bottom','width','height','zIndex','order','display','flex','flexDirection','flexWrap','gridTemplateColumns','gap','alignItems','justifyContent','minWidth','minHeight','maxWidth','maxHeight'];
const originalAppliedState=new WeakMap();
const watchedBlocks=new WeakMap();
let selectedBlockId='';
let selectedPartKey='';
let internalPartScope='major';
let pointerState=null;
let refreshRaf=0;

function internalClamp(value,min,max,fallback=min){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function cleanKey(value){return String(value||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,64);}
function selectedIntegrationBlock(){const id=blocksApi.customKeyId(layoutApi.layoutSelectedKey);if(!id)return null;const block=blocksApi.customBlockById(id,blocksApi.layoutCustomBlocksDraft);return blocksApi.blockSupportsInternalLayout?.(block)?block:null;}
function blockElement(block){return block?document.querySelector(`.custom-block[data-block-id="${CSS.escape(block.id)}"]`):null;}
function manifestForBlock(block){return integrationsApi.integrationManifest(block?.config?.plugin)||null;}
function normalizePartDef(raw,index=0){if(!raw||typeof raw!=='object')return null;const key=cleanKey(raw.key);const selector=String(raw.selector||raw.selectors||'').trim();if(!key||!selector)return null;return {key,label:String(raw.label||key).slice(0,80),selector,parent:cleanKey(raw.parent),order:internalClamp(raw.order,-200,200,index*10),container:raw.container===true,movable:raw.movable!==false,root:raw.root===true,visibilitySetting:cleanKey(raw.visibilitySetting)};}
function integrationPartDefs(block,manifest=manifestForBlock(block)){
  const ordinary=block?.type!=='integration';
  const outer={key:'outer',label:ordinary?'Element canvas':'Integration canvas',selector:'.custom-block-card',parent:'',order:-100,container:true,movable:false,root:true};
  const title={key:'blockTitle',label:'Element title / header',selector:'.custom-block-title',parent:'outer',order:0,container:false,movable:true,root:false};
  const raw=ordinary?(blocksApi.blockLayoutParts?.(block)||[]):(integrationsApi.integrationLayoutParts?.(manifest)||[]);
  const defs=[outer,title];let index=0;
  for(const item of raw){const def=normalizePartDef(item,index++);if(!def||defs.some(x=>x.key===def.key))continue;if(!def.parent)def.parent='outer';defs.push(def);}
  return defs;
}
function integrationRootKey(defs){const root=defs.find(x=>x.root&&x.key!=='outer');return root?.key||'outer';}
function majorIntegrationParts(defs){const root=integrationRootKey(defs);return defs.filter(x=>x.movable!==false&&x.parent===root);}
function pickerIntegrationParts(defs){if(internalPartScope==='details')return defs.filter(x=>x.key!=='outer'&&x.movable!==false);const major=majorIntegrationParts(defs);return major.length?major:defs.filter(x=>x.key!=='outer'&&x.movable!==false);}
function topMajorAncestor(def,defs){const major=new Set(majorIntegrationParts(defs).map(x=>x.key));let current=def,guard=0;while(current&&guard++<12){if(major.has(current.key))return current;current=defs.find(x=>x.key===current.parent);}return majorIntegrationParts(defs)[0]||def;}
function pickerLabel(def,defs){if(internalPartScope!=='details')return def.label;const chain=[];let current=def,guard=0;while(current&&current.key!=='outer'&&guard++<8){if(current.movable!==false)chain.unshift(current.label);current=defs.find(x=>x.key===current.parent);}return chain.join(' › ')||def.label;}
function outlinedIntegrationParts(defs){if(internalPartScope!=='details'){const major=majorIntegrationParts(defs);return major.length?major:pickerIntegrationParts(defs);}const selected=defs.find(x=>x.key===selectedPartKey);if(!selected)return pickerIntegrationParts(defs).slice(0,12);const keys=new Set([selected.key]);for(const def of defs)if(def.movable!==false&&(def.parent===selected.parent||def.parent===selected.key))keys.add(def.key);const parent=defs.find(x=>x.key===selected.parent);if(parent?.movable!==false&&parent?.key!=='outer')keys.add(parent.key);return defs.filter(x=>keys.has(x.key));}
function setIntegrationInternalScope(value){internalPartScope=value==='details'?'details':'major';const block=selectedIntegrationBlock();if(block){const defs=integrationPartDefs(block),allowed=pickerIntegrationParts(defs);if(!allowed.some(x=>x.key===selectedPartKey)){const current=defs.find(x=>x.key===selectedPartKey),next=internalPartScope==='major'&&current?topMajorAncestor(current,defs):allowed[0];selectedPartKey=next?.key||'';}}refreshIntegrationInternalLayoutInspector();}

function layoutStore(block,create=false){if(!block)return {};block.config=block.config||{};let store=block.config._internalLayout;if(!store||typeof store!=='object'||Array.isArray(store)){if(!create)return {};store={};block.config._internalLayout=store;}return store;}
function rowFor(block,key,create=false){const store=layoutStore(block,create);let row=store[key];if(!row||typeof row!=='object'||Array.isArray(row)){if(!create)return {};row={};store[key]=row;}return row;}
function normalizedRow(raw,def){const row=raw&&typeof raw==='object'?raw:{};return {mode:row.mode==='free'&&def?.movable!==false?'free':'flow',order:internalClamp(row.order,-200,200,def?.order||0),x:internalClamp(row.x,0,100,0),y:internalClamp(row.y,0,100,0),w:internalClamp(row.w,5,100,100),h:internalClamp(row.h,0,100,0),z:Math.round(internalClamp(row.z,0,99,0)),hidden:row.hidden===true,direction:['row','column'].includes(row.direction)?row.direction:'auto',columns:Math.round(internalClamp(row.columns,0,3,0)),gap:internalClamp(row.gap,0,60,8),align:['start','center','end','stretch'].includes(row.align)?row.align:'auto',justify:['start','center','end','space-between','space-around'].includes(row.justify)?row.justify:'auto'};}
function rowHasOverride(raw,def){if(!raw||typeof raw!=='object'||!Object.keys(raw).length)return false;const r=normalizedRow(raw,def);return r.mode==='free'||r.hidden||r.order!==(def?.order||0)||r.direction!=='auto'||r.columns!==0||r.gap!==8||r.align!=='auto'||r.justify!=='auto'||r.z!==0;}
function firstMatch(blockEl,def){return allMatches(blockEl,def)[0]||null;}
function allMatches(blockEl,def){if(!blockEl||!def)return [];try{return [...blockEl.querySelectorAll(def.selector)].filter(el=>!el.closest?.('[data-ld-layout-clone="1"]'));}catch{return [];}}
const markApplied=(el)=>{if(!el)return;if(!originalAppliedState.has(el))originalAppliedState.set(el,{styles:Object.fromEntries(TRACKED_STYLE_PROPS.map(prop=>[prop,el.style[prop]])),attr:el.getAttribute(APPLIED_ATTR),free:el.classList.contains('ld-internal-free-part'),flex:el.classList.contains('ld-internal-flex-container')});el.setAttribute(APPLIED_ATTR,'1');};
function clearAppliedStyles(blockEl){if(!blockEl)return;for(const el of blockEl.querySelectorAll(`[${APPLIED_ATTR}]`)){const state=originalAppliedState.get(el);if(state){for(const prop of TRACKED_STYLE_PROPS)el.style[prop]=state.styles[prop]||'';if(state.attr===null)el.removeAttribute(APPLIED_ATTR);else el.setAttribute(APPLIED_ATTR,state.attr);el.classList.toggle('ld-internal-free-part',state.free);el.classList.toggle('ld-internal-flex-container',state.flex);originalAppliedState.delete(el);}else{for(const prop of TRACKED_STYLE_PROPS)el.style[prop]='';el.removeAttribute(APPLIED_ATTR);el.classList.remove('ld-internal-free-part','ld-internal-flex-container');}}}
function cssAlign(value){return value==='start'?'flex-start':value==='end'?'flex-end':value;}
function applyContainerStyle(el,row,directionFallback='column'){if(!el)return;markApplied(el);const r=row||{},columns=Math.round(internalClamp(r.columns,0,3,0));if(columns>0){el.style.display='grid';el.style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;el.style.flexDirection='';el.style.flexWrap='';}else{el.style.display='flex';el.style.gridTemplateColumns='';el.style.flexDirection=r.direction==='row'?'row':r.direction==='column'?'column':directionFallback;el.style.flexWrap=el.style.flexDirection==='row'?'wrap':'nowrap';}el.style.gap=`${internalClamp(r.gap,0,60,8)}px`;if(r.align!=='auto')el.style.alignItems=cssAlign(r.align);if(r.justify!=='auto')el.style.justifyContent=cssAlign(r.justify);el.classList.add('ld-internal-flex-container');}
function applyIntegrationInternalLayout(blockEl,block,manifest=manifestForBlock(block)){
  if(!blockEl||!block||!blocksApi.blockSupportsInternalLayout?.(block))return;
  clearAppliedStyles(blockEl);
  const defs=integrationPartDefs(block,manifest),defMap=new Map(defs.map(d=>[d.key,d])),store=layoutStore(block,false);
  if(!Object.keys(store).length)return;
  const parentNeedsFlex=new Set(),parentNeedsPosition=new Set();
  for(const def of defs){const raw=store[def.key];if(!raw)continue;const row=normalizedRow(raw,def);if(def.container&&(row.direction!=='auto'||row.columns!==0||row.gap!==8||row.align!=='auto'||row.justify!=='auto'))parentNeedsFlex.add(def.key);if(def.parent&&(row.order!==def.order||row.hidden))parentNeedsFlex.add(def.parent);if(def.parent&&row.mode==='free')parentNeedsPosition.add(def.parent);}
  for(const key of new Set([...parentNeedsFlex,...parentNeedsPosition])){const def=defMap.get(key);if(!def)continue;const el=firstMatch(blockEl,def);if(!el)continue;markApplied(el);el.style.position=el.style.position||'relative';if(parentNeedsFlex.has(key)){const row=normalizedRow(store[key],def);applyContainerStyle(el,row,'column');for(const childDef of defs.filter(x=>x.parent===key)){const childRow=normalizedRow(store[childDef.key],childDef);if(childRow.mode==='free')continue;for(const child of allMatches(blockEl,childDef)){markApplied(child);child.style.position='relative';child.style.left='auto';child.style.right='auto';child.style.top='auto';child.style.bottom='auto';child.style.order=String(childRow.order);child.style.minWidth='0';}}}}
  for(const def of defs){const raw=store[def.key];if(!raw)continue;const row=normalizedRow(raw,def);for(const el of allMatches(blockEl,def)){if(row.hidden){markApplied(el);el.style.display='none';continue;}if(def.container&&(row.direction!=='auto'||row.columns!==0||row.gap!==8||row.align!=='auto'||row.justify!=='auto'))applyContainerStyle(el,row,'column');if(row.mode==='free'&&def.movable!==false){markApplied(el);el.style.position='absolute';el.style.left=`${row.x}%`;el.style.top=`${row.y}%`;el.style.width=`${row.w}%`;el.style.height=row.h>0?`${row.h}%`:'auto';el.style.zIndex=String(row.z||3);el.style.order='';el.classList.add('ld-internal-free-part');}else if(def.parent&&parentNeedsFlex.has(def.parent)){markApplied(el);el.style.order=String(row.order);}}}
}
function scheduleInspectorRefresh(){if(refreshRaf)return;refreshRaf=requestAnimationFrame(()=>{refreshRaf=0;refreshIntegrationInternalLayoutInspector();});}
function attachIntegrationLayout(blockEl,block,manifest=manifestForBlock(block)){if(!blockEl||!block)return;let record=watchedBlocks.get(blockEl);if(!record){record={block,manifest,scheduled:false};record.observer=new MutationObserver(()=>{if(record.scheduled)return;record.scheduled=true;queueMicrotask(()=>{record.scheduled=false;applyIntegrationInternalLayout(blockEl,record.block,record.manifest);if(layoutApi.layoutEditorActive&&blocksApi.customKeyId(layoutApi.layoutSelectedKey)===record.block.id)scheduleInspectorRefresh();});});record.observer.observe(blockEl,{childList:true,subtree:true});watchedBlocks.set(blockEl,record);}record.block=block;record.manifest=manifest;applyIntegrationInternalLayout(blockEl,block,manifest);if(layoutApi.layoutEditorActive&&blocksApi.customKeyId(layoutApi.layoutSelectedKey)===block.id)scheduleInspectorRefresh();}
function effectivePart(block,def){return normalizedRow(rowFor(block,def.key,false),def);}
function parentForDef(def,defs){return defs.find(x=>x.key===def.parent)||defs.find(x=>x.key==='outer')||null;}
function visiblePartElement(blockEl,def){for(const el of allMatches(blockEl,def)){const r=el.getBoundingClientRect();if(r.width>2&&r.height>2)return el;}return firstMatch(blockEl,def);}
function initialFreeGeometry(block,def,defs){const blockEl=blockElement(block),el=visiblePartElement(blockEl,def),parentDef=parentForDef(def,defs),parent=visiblePartElement(blockEl,parentDef);if(!el||!parent)return {x:0,y:0,w:100,h:0};const r=el.getBoundingClientRect(),p=parent.getBoundingClientRect();if(p.width<2||p.height<2)return {x:0,y:0,w:100,h:0};return {x:internalClamp((r.left-p.left)/p.width*100,0,100,0),y:internalClamp((r.top-p.top)/p.height*100,0,100,0),w:internalClamp(r.width/p.width*100,5,100,100),h:internalClamp(r.height/p.height*100,5,100,20)};}
function writeRow(block,key,patch){const defs=integrationPartDefs(block),def=defs.find(x=>x.key===key);if(!def)return null;const current=normalizedRow(rowFor(block,key,false),def),row=rowFor(block,key,true);Object.assign(row,current,patch);return normalizedRow(row,def);}
function commitAndRefresh(block){const el=blockElement(block);if(el)applyIntegrationInternalLayout(el,block,manifestForBlock(block));refreshIntegrationInternalLayoutInspector();}
function beginInternalChange(){if(layoutApi.layoutEditorActive)layoutApi.pushLayoutHistory();}
function setIntegrationInternalPart(key){const block=selectedIntegrationBlock(),defs=block?integrationPartDefs(block):[];selectedPartKey=defs.some(x=>x.key===key)?key:(pickerIntegrationParts(defs)[0]?.key||'outer');refreshIntegrationInternalLayoutInspector();}
function setIntegrationInternalMode(value){const block=selectedIntegrationBlock();if(!block)return;const defs=integrationPartDefs(block),def=defs.find(x=>x.key===selectedPartKey);if(!def||def.movable===false)return;beginInternalChange();if(value==='free'){const g=initialFreeGeometry(block,def,defs);writeRow(block,def.key,{mode:'free',...g});}else writeRow(block,def.key,{mode:'flow'});commitAndRefresh(block);}
function setIntegrationInternalGeometry(field,value){const block=selectedIntegrationBlock();if(!block||!['x','y','w','h','z'].includes(field))return;const def=integrationPartDefs(block).find(x=>x.key===selectedPartKey);if(!def||def.movable===false)return;beginInternalChange();let n=Number(value);if(field==='w')n=internalClamp(n,5,100,100);else if(field==='h')n=internalClamp(n,0,100,0);else if(field==='z')n=Math.round(internalClamp(n,0,99,0));else n=internalClamp(n,0,100,0);writeRow(block,def.key,{mode:'free',[field]:n});commitAndRefresh(block);}
function setIntegrationInternalDirection(value){const block=selectedIntegrationBlock();if(!block)return;const def=integrationPartDefs(block).find(x=>x.key===selectedPartKey);if(!def||!def.container)return;beginInternalChange();writeRow(block,def.key,{direction:['row','column'].includes(value)?value:'auto',columns:0});commitAndRefresh(block);}
function setIntegrationInternalContainerLayout(value){const block=selectedIntegrationBlock();if(!block)return;const def=integrationPartDefs(block).find(x=>x.key===selectedPartKey);if(!def||!def.container)return;beginInternalChange();const patch=value==='vertical'?{direction:'column',columns:0}:value==='horizontal'?{direction:'row',columns:0}:value==='two'?{direction:'auto',columns:2}:value==='three'?{direction:'auto',columns:3}:{direction:'auto',columns:0};writeRow(block,def.key,patch);commitAndRefresh(block);}
function setIntegrationMajorLayout(value){const block=selectedIntegrationBlock();if(!block)return;const defs=integrationPartDefs(block),key=integrationRootKey(defs),def=defs.find(x=>x.key===key);if(!def?.container)return;beginInternalChange();const patch=value==='vertical'?{direction:'column',columns:0}:value==='horizontal'?{direction:'row',columns:0}:value==='two'?{direction:'auto',columns:2}:value==='three'?{direction:'auto',columns:3}:{direction:'auto',columns:0};writeRow(block,key,patch);commitAndRefresh(block);}
function setIntegrationInternalHidden(hidden){const block=selectedIntegrationBlock();if(!block)return;const def=integrationPartDefs(block).find(x=>x.key===selectedPartKey);if(!def||def.key==='outer'||def.movable===false)return;beginInternalChange();writeRow(block,def.key,{hidden:!!hidden});commitAndRefresh(block);}
function setIntegrationInternalGap(value){const block=selectedIntegrationBlock();if(!block)return;const def=integrationPartDefs(block).find(x=>x.key===selectedPartKey);if(!def||!def.container)return;beginInternalChange();writeRow(block,def.key,{gap:internalClamp(value,0,60,8)});commitAndRefresh(block);}
function setIntegrationInternalAlign(value){const block=selectedIntegrationBlock();if(!block)return;const def=integrationPartDefs(block).find(x=>x.key===selectedPartKey);if(!def||!def.container)return;beginInternalChange();writeRow(block,def.key,{align:['start','center','end','stretch'].includes(value)?value:'auto'});commitAndRefresh(block);}
function setIntegrationInternalJustify(value){const block=selectedIntegrationBlock();if(!block)return;const def=integrationPartDefs(block).find(x=>x.key===selectedPartKey);if(!def||!def.container)return;beginInternalChange();writeRow(block,def.key,{justify:['start','center','end','space-between','space-around'].includes(value)?value:'auto'});commitAndRefresh(block);}
function moveIntegrationInternalOrder(delta){const block=selectedIntegrationBlock();if(!block)return;const defs=integrationPartDefs(block),def=defs.find(x=>x.key===selectedPartKey);if(!def?.parent)return;const siblings=defs.filter(x=>x.parent===def.parent&&x.movable!==false).sort((a,b)=>effectivePart(block,a).order-effectivePart(block,b).order||a.order-b.order),index=siblings.findIndex(x=>x.key===def.key),target=siblings[index+(delta<0?-1:1)];if(index<0||!target)return;beginInternalChange();const a=effectivePart(block,def).order,b=effectivePart(block,target).order;writeRow(block,def.key,{order:b});writeRow(block,target.key,{order:a});commitAndRefresh(block);}
function placeIntegrationInternalPart(anchor){const block=selectedIntegrationBlock();if(!block)return;const defs=integrationPartDefs(block),def=defs.find(x=>x.key===selectedPartKey);if(!def||def.movable===false)return;beginInternalChange();let row=effectivePart(block,def);if(row.mode!=='free'){const g=initialFreeGeometry(block,def,defs);row=writeRow(block,def.key,{mode:'free',...g});}const xMap={left:0,center:(100-row.w)/2,right:100-row.w},yMap={top:0,middle:(100-(row.h||20))/2,bottom:100-(row.h||20)},[v,h]=String(anchor||'top-left').split('-');writeRow(block,def.key,{mode:'free',x:internalClamp(xMap[h]??xMap.center,0,100-row.w,0),y:internalClamp(yMap[v]??yMap.middle,0,100-(row.h||20),0)});commitAndRefresh(block);}
function resetIntegrationInternalPart(){const block=selectedIntegrationBlock();if(!block)return;beginInternalChange();const store=layoutStore(block,false);delete store[selectedPartKey];if(!Object.keys(store).length)delete block.config._internalLayout;commitAndRefresh(block);}
function resetIntegrationInternalLayout(){const block=selectedIntegrationBlock();if(!block||!block.config?._internalLayout)return;beginInternalChange();delete block.config._internalLayout;commitAndRefresh(block);}
function currentInternalSelection(){const block=selectedIntegrationBlock();if(!block)return null;const defs=integrationPartDefs(block),def=defs.find(x=>x.key===selectedPartKey)||defs.find(x=>x.key!=='outer'&&x.movable!==false)||defs[0];if(!def)return null;selectedPartKey=def.key;return {block,defs,def,row:effectivePart(block,def)};}
function internalContainerLayoutValue(row){if((row?.columns||0)===2)return 'two';if((row?.columns||0)===3)return 'three';if(row?.direction==='column')return 'vertical';if(row?.direction==='row')return 'horizontal';return 'provider';}
function refreshIntegrationInternalLayoutInspector(){
  const section=document.getElementById('layout-integration-internal-section'),selection=selectedIntegrationBlock();
  const ordinary=selection&&selection.type!=='integration';const heading=document.getElementById('layout-internal-heading');if(heading)heading.firstChild.textContent=ordinary?'Arrange inside element ':'Arrange inside integration ';const parentRoot=document.getElementById('layout-integration-parent-label');if(parentRoot&&!selection)parentRoot.textContent='Element root';
  if(!section)return;
  if(!layoutApi.layoutEditorActive||!selection){section.hidden=true;selectedBlockId='';selectedPartKey='';renderIntegrationInternalPartBoxes();return;}
  section.hidden=false;
  const defs=integrationPartDefs(selection),blockChanged=selectedBlockId!==selection.id;selectedBlockId=selection.id;
  const allowed=pickerIntegrationParts(defs);
  if(blockChanged||!allowed.some(x=>x.key===selectedPartKey)){const current=defs.find(x=>x.key===selectedPartKey),fallback=internalPartScope==='major'&&current?topMajorAncestor(current,defs):allowed[0];selectedPartKey=fallback?.key||allowed[0]?.key||'outer';}
  const info=currentInternalSelection();if(!info)return;const {def,row}=info;
  const picker=document.getElementById('layout-integration-part-picker');if(picker){picker.innerHTML=allowed.map(x=>`<option value="${escHtml(x.key)}">${escHtml(pickerLabel(x,defs))}</option>`).join('');picker.value=def.key;}
  document.getElementById('layout-integration-scope-major')?.classList.toggle('active',internalPartScope==='major');
  document.getElementById('layout-integration-scope-details')?.classList.toggle('active',internalPartScope==='details');
  const hint=document.getElementById('layout-integration-focus-hint');if(hint)hint.textContent=internalPartScope==='major'?'Pick the overall layout first. Selecting a section does not make it float; drag only when you intentionally want free placement.':'Detail mode shows only the selected subsection, nearby siblings, and immediate children so the display stays readable.';
  const parent=defs.find(x=>x.key===def.parent),parentLabel=document.getElementById('layout-integration-parent-label');if(parentLabel)parentLabel.textContent=parent?`Inside ${parent.label}`:(ordinary?'Element root':'Integration root');
  const rootDef=defs.find(x=>x.key===integrationRootKey(defs)),rootRow=rootDef?effectivePart(selection,rootDef):null,majorLayout=document.getElementById('layout-integration-major-layout');if(majorLayout)majorLayout.value=internalContainerLayoutValue(rootRow);
  const shown=document.getElementById('layout-integration-shown');if(shown){shown.checked=!row.hidden;shown.disabled=def.movable===false;}
  const mode=document.getElementById('layout-integration-mode');if(mode){mode.value=row.mode;mode.disabled=def.movable===false||row.hidden;}
  for(const field of ['x','y','w','h','z']){const input=document.getElementById('layout-integration-'+field);if(input){input.value=String(Math.round(row[field]*10)/10);input.disabled=def.movable===false||row.mode!=='free'||row.hidden;}}
  const containerLayout=document.getElementById('layout-integration-container-layout');if(containerLayout){containerLayout.value=internalContainerLayoutValue(row);containerLayout.disabled=!def.container||row.hidden;}
  const gap=document.getElementById('layout-integration-gap');if(gap){gap.value=String(row.gap);gap.disabled=!def.container||row.hidden;}
  const align=document.getElementById('layout-integration-align');if(align){align.value=row.align;align.disabled=!def.container||row.hidden;}
  const justify=document.getElementById('layout-integration-justify');if(justify){justify.value=row.justify;justify.disabled=!def.container||row.hidden;}
  const freeDetails=document.getElementById('layout-integration-free-details');if(freeDetails)freeDetails.hidden=row.mode!=='free'||def.movable===false||row.hidden;
  const containerDetails=document.getElementById('layout-integration-container-details');if(containerDetails)containerDetails.hidden=!def.container||row.hidden;
  const containerQuick=document.getElementById('layout-integration-container-quick');if(containerQuick)containerQuick.hidden=!def.container||row.hidden;
  document.getElementById('layout-integration-free-controls')?.toggleAttribute('hidden',row.mode!=='free'||def.movable===false||row.hidden);
  document.getElementById('layout-integration-container-controls')?.toggleAttribute('hidden',!def.container||row.hidden);
  renderIntegrationInternalPartBoxes();
}
function renderIntegrationInternalPartBoxes(){const layer=document.getElementById('layout-editor-layer');if(!layer)return;for(const el of layer.querySelectorAll('.layout-internal-edit-box'))el.remove();if(!layoutApi.layoutEditorActive)return;const block=selectedIntegrationBlock();if(!block)return;const blockEl=blockElement(block);if(!blockEl)return;const defs=integrationPartDefs(block),visibleDefs=outlinedIntegrationParts(defs);for(const def of visibleDefs){if(def.key==='outer'||def.movable===false)continue;const part=visiblePartElement(blockEl,def);if(!part)continue;const rect=part.getBoundingClientRect();if(rect.width<4||rect.height<4)continue;const box=document.createElement('div');box.className='layout-internal-edit-box'+(def.key===selectedPartKey?' selected':'');box.dataset.integrationPart=def.key;Object.assign(box.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});box.innerHTML=`<div class="layout-internal-edit-label">${escHtml(def.label)}</div><div class="layout-internal-resize-handle" data-internal-resize="1" title="Resize this integration section"></div>`;box.addEventListener('pointerdown',beginIntegrationPartPointer);box.addEventListener('click',event=>{event.stopPropagation();setIntegrationInternalPart(def.key);});layer.appendChild(box);}}
function beginIntegrationPartPointer(event){const block=selectedIntegrationBlock();if(!block)return;const defs=integrationPartDefs(block),key=event.currentTarget.dataset.integrationPart,def=defs.find(x=>x.key===key);if(!def||def.movable===false)return;selectedPartKey=key;const row=effectivePart(block,def),parentDef=parentForDef(def,defs),parent=visiblePartElement(blockElement(block),parentDef),parentRect=parent?.getBoundingClientRect();if(!parentRect||parentRect.width<2||parentRect.height<2)return;pointerState={block,key,def,defs,mode:event.target?.dataset?.internalResize?'resize':'move',pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,parentRect,start:{...row},activated:false};event.currentTarget.setPointerCapture?.(event.pointerId);event.stopPropagation();}
function moveIntegrationPartPointer(event){const st=pointerState;if(!st||event.pointerId!==st.pointerId)return;const pixelDx=event.clientX-st.startX,pixelDy=event.clientY-st.startY;if(!st.activated&&st.mode!=='resize'&&Math.hypot(pixelDx,pixelDy)<5)return;if(!st.activated){st.activated=true;beginInternalChange();if(st.start.mode!=='free'){const g=initialFreeGeometry(st.block,st.def,st.defs);st.start={...writeRow(st.block,st.key,{mode:'free',...g})};}}const dx=pixelDx/st.parentRect.width*100,dy=pixelDy/st.parentRect.height*100;let patch;if(st.mode==='resize'){const w=internalClamp(st.start.w+dx,5,100-st.start.x,st.start.w),h=internalClamp((st.start.h||5)+dy,5,100-st.start.y,st.start.h||5);patch={mode:'free',w,h};}else{patch={mode:'free',x:internalClamp(st.start.x+dx,0,100-st.start.w,st.start.x),y:internalClamp(st.start.y+dy,0,100-(st.start.h||5),st.start.y)};}writeRow(st.block,st.key,patch);const el=blockElement(st.block);if(el)applyIntegrationInternalLayout(el,st.block,manifestForBlock(st.block));renderIntegrationInternalPartBoxes();refreshIntegrationInternalLayoutInspectorValuesOnly();event.preventDefault();}
function endIntegrationPartPointer(event){if(pointerState&&(!event||event.pointerId===pointerState.pointerId)){pointerState=null;scheduleInspectorRefresh();}}
function refreshIntegrationInternalLayoutInspectorValuesOnly(){const info=currentInternalSelection();if(!info)return;const {def,row}=info;for(const field of ['x','y','w','h','z']){const input=document.getElementById('layout-integration-'+field);if(input&&!input.matches(':focus'))input.value=String(Math.round(row[field]*10)/10);}const mode=document.getElementById('layout-integration-mode');if(mode)mode.value=row.mode;const shown=document.getElementById('layout-integration-shown');if(shown)shown.checked=!row.hidden;const containerLayout=document.getElementById('layout-integration-container-layout');if(containerLayout)containerLayout.value=internalContainerLayoutValue(row);document.getElementById('layout-integration-free-controls')?.toggleAttribute('hidden',row.mode!=='free'||def.movable===false||row.hidden);const freeDetails=document.getElementById('layout-integration-free-details');if(freeDetails)freeDetails.hidden=row.mode!=='free'||def.movable===false||row.hidden;}


function scheduleSelectionAwareRefresh(){if(layoutApi.layoutEditorActive)scheduleInspectorRefresh();}
document.addEventListener('click',event=>{if(event.target?.closest?.('.layout-edit-box,#layout-toolbar,#layout-properties'))scheduleSelectionAwareRefresh();});
document.addEventListener('change',event=>{if(event.target?.closest?.('#layout-toolbar,#layout-properties'))scheduleSelectionAwareRefresh();});
document.addEventListener('keyup',scheduleSelectionAwareRefresh);
window.addEventListener('resize',scheduleSelectionAwareRefresh);
new MutationObserver(scheduleSelectionAwareRefresh).observe(document.body,{attributes:true,attributeFilter:['class']});
document.addEventListener('pointermove',moveIntegrationPartPointer,{passive:false});
document.addEventListener('pointerup',event=>{endIntegrationPartPointer(event);scheduleSelectionAwareRefresh();});

LibreDisplayRuntime.exposeModule('layout',{integrationPartDefs,applyIntegrationInternalLayout,attachIntegrationLayout,setIntegrationInternalScope,setIntegrationInternalPart,setIntegrationInternalMode,setIntegrationInternalGeometry,setIntegrationInternalDirection,setIntegrationInternalContainerLayout,setIntegrationMajorLayout,setIntegrationInternalHidden,setIntegrationInternalGap,setIntegrationInternalAlign,setIntegrationInternalJustify,moveIntegrationInternalOrder,placeIntegrationInternalPart,resetIntegrationInternalPart,resetIntegrationInternalLayout,refreshIntegrationInternalLayoutInspector,renderIntegrationInternalPartBoxes}, {}, {globals:false});
}
// End source section: /js/layout/integration-layout.js

// LibreDisplay source section: /js/layout/remote.js
{
const layoutApi=()=>LibreDisplayRuntime.getModule("layout");
// Remote-display Arrange proxy and preview workspace.
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;
const {escHtml,resilientFetch}=LibreDisplayRuntime.getModule('shared');


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
  const res=await resilientFetch(serverPath('/api/devices'),{cache:'no-store'}),data=await res.json().catch(()=>({}));
  if(!res.ok||!Array.isArray(data.devices))throw new Error(data.error||('HTTP '+res.status));
  return data.devices;
}
async function requestFreshDisplayMetrics(){
  const requestedAt=Date.now()/1000;
  try{await resilientFetch(serverPath('/api/devices'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'heartbeat',endpoint:bootstrapApi.ACTIVE_ENDPOINT}),cache:'no-store'});}catch(e){}
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
  layoutEditorActive=false;layoutApi().layoutPointerState=null;layoutSelectedKey='';layoutApi().layoutSelectedKeys=[];layoutApi().layoutUndoStack=[];layoutApi().layoutRedoStack=[];updateLayoutHistoryButtons();
  document.body.classList.remove('layout-editing');
  const layer=document.getElementById('layout-editor-layer'),toolbar=document.getElementById('layout-toolbar'),props=document.getElementById('layout-properties');
  layer?.classList.remove('show','grid-on');toolbar?.classList.remove('show');props?.classList.remove('show');layer?.setAttribute('aria-hidden','true');toolbar?.setAttribute('aria-hidden','true');props?.setAttribute('aria-hidden','true');
  if(layer)layer.innerHTML='';closeBlockCatalog();document.getElementById('block-config-modal')?.classList.remove('show');layoutCustomBlocksDraft=[];layoutApi().layoutContentScaleDraft={};layoutApi().layoutElementStyleDraft={};layoutApi().layoutPartStyleDraft={};layoutApi().layoutSelectedPart='whole';layoutApi().layoutScaleEditActive=false;layoutApi().layoutStyleEditField='';layoutApi().layoutPartFineEditField='';layoutApi().layoutInspectorDragState=null;layoutApi().layoutSessionViewport=null;
  document.removeEventListener('pointermove',moveLayoutPointer);document.removeEventListener('pointerup',endLayoutPointer);
}


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("layout", {remoteLayoutFrame,remoteLayoutInnerDocument,remoteLayoutProxyRoot,remoteLayoutProxyCounterpart,remoteLayoutProxyMirrorElement,syncRemoteLayoutProxyUi,scheduleRemoteLayoutProxySync,activateRemoteLayoutProxy,deactivateRemoteLayoutProxy,handleRemoteLayoutProxyEvent,targetViewportFromDevice,bestLayoutTargetDevice,readDisplayDevices,requestFreshDisplayMetrics,fetchRemoteLayoutTarget,syncRemoteLayoutEditorAffordances,selectRemoteLayoutElement,syncRemoteEditorHitTargets,fitRemoteLayoutPreview,openRemoteLayoutPreview,closeRemoteLayoutPreview,reloadRemoteLayoutPreview,handleEmbeddedLayoutEditorAction,notifyLayoutPreviewParent,launchLayoutEditorFromSettings,stopLayoutEditorUi}, {
  "remoteLayoutProxyActive": {configurable:true,get:()=>remoteLayoutProxyActive,set:(value)=>{remoteLayoutProxyActive=value;}},
  "remoteLayoutProxySyncTimer": {configurable:true,get:()=>remoteLayoutProxySyncTimer,set:(value)=>{remoteLayoutProxySyncTimer=value;}},
  "remoteLayoutPreviewTarget": {configurable:true,get:()=>remoteLayoutPreviewTarget,set:(value)=>{remoteLayoutPreviewTarget=value;}},
  "remoteLayoutPreviewSession": {configurable:true,get:()=>remoteLayoutPreviewSession,set:(value)=>{remoteLayoutPreviewSession=value;}}
}, {globalFunctions:['remoteLayoutFrame','remoteLayoutInnerDocument','scheduleRemoteLayoutProxySync','selectRemoteLayoutElement','fitRemoteLayoutPreview','closeRemoteLayoutPreview','reloadRemoteLayoutPreview','notifyLayoutPreviewParent','launchLayoutEditorFromSettings','stopLayoutEditorUi'],globalStates:['remoteLayoutProxyActive']});
}
// End source section: /js/layout/remote.js

// LibreDisplay source section: /js/layout/persistence.js
{
const layoutApi=()=>LibreDisplayRuntime.getModule("layout");
// Arrange save/cancel/reset commands, keyboard nudging, and resize reconciliation.
const {saveCfg}=LibreDisplayRuntime.getModule('config');
const {normalizeHexColor}=LibreDisplayRuntime.getModule('shared');


function cancelLayoutEditor(){
  const hadSession=layoutEditorActive||!!layoutApi().layoutEditorOriginal;
  if(hadSession){
    const o=layoutApi().layoutEditorOriginal||{layoutMode:'default',layoutBlocks:{},layoutContentScale:{},layoutElementStyle:{},layoutPartStyle:{},layoutGridPx:20,layoutSnap:true};
    cfg.layoutMode=o.layoutMode;cfg.layoutBlocks=JSON.parse(JSON.stringify(o.layoutBlocks||{}));cfg.layoutContentScale=JSON.parse(JSON.stringify(o.layoutContentScale||{}));cfg.layoutElementStyle=JSON.parse(JSON.stringify(o.layoutElementStyle||{}));cfg.layoutPartStyle=JSON.parse(JSON.stringify(o.layoutPartStyle||{}));cfg.layoutGridPx=o.layoutGridPx||20;cfg.layoutSnap=o.layoutSnap!==false;cfg.customBlocks=JSON.parse(JSON.stringify(layoutCustomBlocksOriginal||[]));customBlockRenderSignature='';
  }
  stopLayoutEditorUi();
  if(hadSession){renderCustomBlocks(cfg.customBlocks);applyUiCustomization(cfg);}else document.body.classList.remove('layout-editing');
  layoutApi().layoutEditorOriginal=null;layoutCustomBlocksOriginal=[];
  if(LAYOUT_PREVIEW_MODE&&window.parent!==window)setTimeout(()=>notifyLayoutPreviewParent('cancelled'),0);
}
function resetLayoutEditorDraft(){
  if(!layoutEditorActive)return;pushLayoutHistory();
  layoutApi().layoutEditorDraft=measureDefaultLayoutRects();layoutSelectedKey='';layoutApi().layoutSelectedKeys=[];
  cfg.layoutMode='custom';cfg.layoutBlocks=JSON.parse(JSON.stringify(layoutApi().layoutEditorDraft));
  document.body.classList.add('custom-layout','layout-editing');
  for(const [key,r] of Object.entries(layoutApi().layoutEditorDraft))applyOneLayoutRect(key,r);
  renderLayoutEditorBoxes();
}
function resetSelectedLayoutBlock(){
  if(!layoutEditorActive||!layoutSelectedKey)return;pushLayoutHistory();
  const customId=customKeyId(layoutSelectedKey);if(customId){const b=customBlockById(customId,layoutCustomBlocksDraft);if(!b)return;b.rect=defaultBlockRect(b.type);b.config=b.config||{};Object.assign(b.config,{_contentScale:100,_hAlign:'auto',_vAlign:'auto',_fontFamily:'',_textColor:'',_opacity:100,_internalLayout:{}});renderCustomBlocks(layoutCustomBlocksDraft);renderLayoutEditorBoxes();selectLayoutBlock(layoutSelectedKey);return;}
  if(!layoutApi().LAYOUT_BLOCK_DEFS[layoutSelectedKey])return;
  cfg.layoutMode='custom';cfg.layoutBlocks=JSON.parse(JSON.stringify(layoutApi().layoutEditorDraft));
  const defaults=measureDefaultLayoutRects(),r=defaults[layoutSelectedKey];if(!r)return;
  layoutApi().layoutEditorDraft[layoutSelectedKey]=r;layoutApi().layoutContentScaleDraft[layoutSelectedKey]=100;layoutApi().layoutElementStyleDraft[layoutSelectedKey]={hAlign:'auto',vAlign:'auto',fontFamily:'',textColor:'',opacity:100};layoutApi().layoutPartStyleDraft[layoutSelectedKey]={};cfg.layoutBlocks=JSON.parse(JSON.stringify(layoutApi().layoutEditorDraft));
  document.body.classList.add('custom-layout','layout-editing');
  for(const [key,rect] of Object.entries(layoutApi().layoutEditorDraft))applyOneLayoutRect(key,rect);
  renderLayoutEditorBoxes();selectLayoutBlock(layoutSelectedKey);
}
function resetSavedBlockLayout(){
  if(!confirm('Reset the saved drag/resize block arrangement and return to the default dashboard geometry?'))return;
  cfg.layoutMode='default';cfg.layoutBlocks={};saveCfg();applyUiCustomization(cfg);updateLayoutModeStatus(cfg);setAppearanceForm(cfg);
}
function nudgeSelectedLayoutBlock(key,resize=false){
  const selectedRect=layoutEditorRectForKey(layoutSelectedKey),def=layoutEditorDefForKey(layoutSelectedKey);
  if(!layoutEditorActive||!layoutSelectedKey||!selectedRect||!def||def.locked)return false;
  pushLayoutHistory();const vp=layoutViewportSize(),grid=Math.max(4,Number(document.getElementById('layout-toolbar-grid')?.value)||20),r=pxRectFromNormalized(selectedRect),selected=layoutApi().layoutSelectionMovableKeys?.()||[layoutSelectedKey];
  if(!resize&&selected.length>1){const bounds=layoutApi().layoutSelectionBounds?.(selected);if(!bounds)return false;let dx=key==='ArrowRight'?grid:key==='ArrowLeft'?-grid:0,dy=key==='ArrowDown'?grid:key==='ArrowUp'?-grid:0;dx=Math.max(-bounds.left,Math.min(vp.width-bounds.right,dx));dy=Math.max(-bounds.top,Math.min(vp.height-bounds.bottom,dy));for(const item of selected){const raw=layoutEditorRectForKey(item);if(!raw)continue;const px=pxRectFromNormalized(raw);setLayoutEditorRectForKey(item,normalizedRectFromPx({left:px.left+dx,top:px.top+dy,width:px.width,height:px.height}));}renderLayoutEditorBoxes();return true;}
  if(resize){if(key==='ArrowRight')r.width+=grid;if(key==='ArrowLeft')r.width-=grid;if(key==='ArrowDown')r.height+=grid;if(key==='ArrowUp')r.height-=grid;r.width=Math.max(def.minW,Math.min(vp.width-r.left,r.width));r.height=Math.max(def.minH,Math.min(vp.height-r.top,r.height));}
  else {if(key==='ArrowRight')r.left+=grid;if(key==='ArrowLeft')r.left-=grid;if(key==='ArrowDown')r.top+=grid;if(key==='ArrowUp')r.top-=grid;r.left=Math.max(0,Math.min(vp.width-r.width,r.left));r.top=Math.max(0,Math.min(vp.height-r.height,r.top));}
  setLayoutEditorRectForKey(layoutSelectedKey,normalizedRectFromPx(r));renderLayoutEditorBoxes();return true;
}
window.addEventListener('resize',()=>{
  fitRemoteLayoutPreview();
  if(layoutEditorActive){refreshLayoutSessionViewport();for(const [key,r] of Object.entries(layoutApi().layoutEditorDraft))applyOneLayoutRect(key,r);for(const b of layoutCustomBlocksDraft)applyCustomBlockRect(document.querySelector(`.custom-block[data-block-id="${CSS.escape(b.id)}"]`),b);renderLayoutEditorBoxes();requestAnimationFrame(keepLayoutInspectorOnScreen);}
  else {if(cfg.layoutMode==='custom')applyCustomLayout(cfg);for(const b of cfg.customBlocks||[])applyCustomBlockRect(document.querySelector(`.custom-block[data-block-id="${CSS.escape(b.id)}"]`),b);}
});

function hexRgb(hex){
  const s=normalizeHexColor(hex,'#ffffff').slice(1);
  return {r:parseInt(s.slice(0,2),16),g:parseInt(s.slice(2,4),16),b:parseInt(s.slice(4,6),16)};
}


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("layout", {cancelLayoutEditor,resetLayoutEditorDraft,resetSelectedLayoutBlock,resetSavedBlockLayout,nudgeSelectedLayoutBlock,hexRgb}, {}, {globalFunctions:['cancelLayoutEditor','resetLayoutEditorDraft','resetSelectedLayoutBlock','resetSavedBlockLayout','nudgeSelectedLayoutBlock','hexRgb']});
}
// End source section: /js/layout/persistence.js
