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
  current:[{key:'temperature',label:'Temperature'},{key:'icon',label:'Weather icon'},{key:'condition',label:'Condition'},{key:'feelsLike',label:'Feels like'}],
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
let layoutPointerState=null;
let layoutContentScaleDraft={};
let layoutElementStyleDraft={};
let layoutPartStyleDraft={};
let layoutSelectedPart='whole';
let layoutScaleEditActive=false;
let layoutStyleEditField='';
let layoutPartFineEditField='';
let layoutUndoStack=[],layoutRedoStack=[];
function layoutHistorySnapshot(){return {layout:JSON.parse(JSON.stringify(layoutEditorDraft||{})),custom:JSON.parse(JSON.stringify(layoutCustomBlocksDraft||[])),contentScale:JSON.parse(JSON.stringify(layoutContentScaleDraft||{})),elementStyle:JSON.parse(JSON.stringify(layoutElementStyleDraft||{})),partStyle:JSON.parse(JSON.stringify(layoutPartStyleDraft||{})),selected:layoutSelectedKey,selectedPart:layoutSelectedPart};}
function updateLayoutHistoryButtons(){const u=document.getElementById('layout-undo'),r=document.getElementById('layout-redo');if(u)u.disabled=!layoutUndoStack.length;if(r)r.disabled=!layoutRedoStack.length;}
function pushLayoutHistory(){if(!layoutEditorActive)return;layoutUndoStack.push(layoutHistorySnapshot());if(layoutUndoStack.length>60)layoutUndoStack.shift();layoutRedoStack=[];updateLayoutHistoryButtons();}
function restoreLayoutHistorySnapshot(snap){if(!snap)return;layoutEditorDraft=JSON.parse(JSON.stringify(snap.layout||{}));layoutCustomBlocksDraft=JSON.parse(JSON.stringify(snap.custom||[]));layoutContentScaleDraft=JSON.parse(JSON.stringify(snap.contentScale||{}));layoutElementStyleDraft=JSON.parse(JSON.stringify(snap.elementStyle||{}));layoutPartStyleDraft=JSON.parse(JSON.stringify(snap.partStyle||{}));layoutSelectedKey=snap.selected||'';layoutSelectedPart=snap.selectedPart||'whole';cfg.layoutMode='custom';cfg.layoutBlocks=JSON.parse(JSON.stringify(layoutEditorDraft));renderCustomBlocks(layoutCustomBlocksDraft);for(const [key,r] of Object.entries(layoutEditorDraft))applyOneLayoutRect(key,r);applyLayoutEditorContentScalePreview();renderLayoutEditorBoxes();selectLayoutBlock(layoutSelectedKey,true);updateLayoutHistoryButtons();}
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
function appendLayoutEditBox(layer,key,label,r){const px=pxRectFromNormalized(r),def=layoutEditorDefForKey(key),locked=def?.locked===true,box=document.createElement('div');box.className='layout-edit-box'+(layoutSelectedKey===key?' selected':'')+(locked?' locked':'');box.dataset.layoutKey=key;box.style.left=px.left+'px';box.style.top=px.top+'px';box.style.width=px.width+'px';box.style.height=px.height+'px';box.innerHTML=`<div class="layout-edit-label">${escHtml(label)}${locked?' · 🔒':''}</div><div class="layout-resize-handle nw" data-resize="nw" title="Resize from top left"></div><div class="layout-resize-handle ne" data-resize="ne" title="Resize from top right"></div><div class="layout-resize-handle sw" data-resize="sw" title="Resize from bottom left"></div><div class="layout-resize-handle se" data-resize="se" title="Resize from bottom right"></div>`;box.addEventListener('pointerdown',beginLayoutPointer);box.addEventListener('click',()=>selectLayoutBlock(key));if(customKeyId(key)){box.title='Double-click to configure this added block';box.addEventListener('dblclick',e=>{e.preventDefault();selectLayoutBlock(key);configureSelectedCustomBlock();});}layer.appendChild(box);}
function refreshLayoutToolbarBlockOptions(){const picker=document.getElementById('layout-toolbar-block');if(!picker)return;const current=layoutSelectedKey;picker.innerHTML='<option value="">Choose…</option>'+Object.entries(LAYOUT_BLOCK_DEFS).map(([k,d])=>`<option value="${k}">${escHtml(d.label)}</option>`).join('')+(layoutCustomBlocksDraft.length?'<optgroup label="Added blocks">'+layoutCustomBlocksDraft.map(b=>`<option value="${customBlockKey(b.id)}">${escHtml(b.name||BLOCK_TYPE_INFO[b.type]?.name||'Block')}</option>`).join('')+'</optgroup>':'');picker.value=current||'';}
function layoutEditorRectForKey(key){const id=customKeyId(key);if(id)return customBlockById(id,layoutCustomBlocksDraft)?.rect||null;return layoutEditorDraft[key]||null;}
function layoutEditorDefForKey(key){const id=customKeyId(key);if(id){const b=customBlockById(id,layoutCustomBlocksDraft);if(!b)return null;const [minW,minH]=customBlockMin(b.type);return {label:b.name||BLOCK_TYPE_INFO[b.type]?.name||'Block',minW,minH,custom:true,block:b,locked:b.config?._locked===true};}return LAYOUT_BLOCK_DEFS[key]||null;}
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

function selectLayoutBlock(key,preservePart=false){
  if(key&&!LAYOUT_BLOCK_DEFS[key]&&!customBlockById(customKeyId(key),layoutCustomBlocksDraft))return;
  const next=key||'';if(next!==layoutSelectedKey&&!preservePart)layoutSelectedPart='whole';layoutSelectedKey=next;
  document.querySelectorAll('.layout-edit-box').forEach(el=>el.classList.toggle('selected',el.dataset.layoutKey===layoutSelectedKey));
  const picker=document.getElementById('layout-toolbar-block');if(picker&&picker.value!==layoutSelectedKey)picker.value=layoutSelectedKey;
  refreshToolbarCustomActions();refreshLayoutPartPicker();
  updateLayoutSelectedInfo();
}
function updateLayoutSelectedInfo(){
  const el=document.getElementById('layout-selected-info'),range=document.getElementById('layout-toolbar-scale'),scaleNumber=document.getElementById('layout-toolbar-scale-number'),value=document.getElementById('layout-toolbar-scale-value'),control=document.getElementById('layout-properties-controls'),title=document.getElementById('layout-properties-title'),subtitle=document.getElementById('layout-properties-subtitle');if(!el)return;
  const selectedRect=layoutEditorRectForKey(layoutSelectedKey),def=layoutEditorDefForKey(layoutSelectedKey),has=!!(layoutSelectedKey&&selectedRect&&def);control?.classList.toggle('layout-prop-disabled',!has);if(range)range.disabled=!has;if(scaleNumber)scaleNumber.disabled=!has;refreshLayoutPartPicker();
  const partDef=selectedPartDefinition(),partMode=has&&layoutSelectedPart!=='whole'&&!!partDef;document.getElementById('layout-part-advanced')?.toggleAttribute('hidden',!partMode);document.getElementById('layout-v-section')?.toggleAttribute('hidden',partMode);document.getElementById('layout-place-section')?.toggleAttribute('hidden',partMode);
  const scopeLabel=document.getElementById('layout-part-scope-label'),sizeLabel=document.getElementById('layout-size-label'),typoScope=document.getElementById('layout-typography-scope'),hLabel=document.getElementById('layout-h-label'),hScope=document.getElementById('layout-h-scope'),opacityLabel=document.getElementById('layout-opacity-label');if(scopeLabel)scopeLabel.textContent=partMode?partDef.label:'Whole element';if(sizeLabel)sizeLabel.textContent=partMode?'Section text size':'Content size';if(typoScope)typoScope.textContent=partMode?'Selected section':'Per element';if(hLabel)hLabel.textContent=partMode?'Text alignment':'Horizontal content';if(hScope)hScope.textContent=partMode?'Selected section':'Inside block';if(opacityLabel)opacityLabel.textContent=partMode?'Section opacity':'Element opacity';
  if(!has){if(range)range.value='100';if(scaleNumber)scaleNumber.value='100';if(value)value.textContent='100%';el.textContent='Select an element · drag to move · corner to resize';if(title)title.textContent='Element inspector';if(subtitle)subtitle.textContent='Select an element to customize its contents.';return;}
  const px=pxRectFromNormalized(selectedRect),scale=selectedContentScale(),st=selectedLayoutStyle();if(range)range.value=String(scale);if(scaleNumber)scaleNumber.value=String(scale);if(value)value.textContent=scale+'%';if(title)title.textContent=def.label;if(subtitle)subtitle.textContent=partMode?`${partDef.label} · ${Math.round(px.width)} × ${Math.round(px.height)} px element`:`${Math.round(px.width)} × ${Math.round(px.height)} px · content ${scale}%`;
  const font=document.getElementById('layout-style-font');if(font)font.value=st.fontFamily||'';const color=document.getElementById('layout-style-color'),hex=document.getElementById('layout-style-color-hex');if(color)color.value=st.textColor||normalizeHexColor(cfg.primaryTextColor,'#ffffff');if(hex)hex.value=st.textColor?st.textColor.toUpperCase():'Theme';const opacity=document.getElementById('layout-style-opacity'),ov=document.getElementById('layout-style-opacity-value');if(opacity)opacity.value=String(st.opacity);if(ov)ov.textContent=st.opacity+'%';
  for(const h of ['auto','left','center','right'])document.getElementById('layout-h-'+h)?.classList.toggle('active',st.hAlign===h);for(const v of ['auto','top','middle','bottom'])document.getElementById('layout-v-'+v)?.classList.toggle('active',st.vAlign===v);
  if(partMode){const ps=selectedPartStyle(),weight=document.getElementById('layout-part-weight'),line=document.getElementById('layout-part-line-height'),lineVal=document.getElementById('layout-part-line-height-value'),letter=document.getElementById('layout-part-letter-spacing'),letterVal=document.getElementById('layout-part-letter-spacing-value'),visible=document.getElementById('layout-part-visible');if(weight)weight.value=ps.fontWeight||'';if(line)line.value=String(ps.lineHeight);if(lineVal)lineVal.textContent=ps.lineHeight+'%';if(letter)letter.value=String(ps.letterSpacing);if(letterVal)letterVal.textContent=(Math.round(ps.letterSpacing*100)/100)+'px';if(visible)visible.checked=ps.visible!==false;}
  el.textContent=partMode?`${def.label} · ${partDef.label} · ${scale}%`:`${def.label} · ${Math.round(px.width)}×${Math.round(px.height)} · ${scale}%`;
}
function beginLayoutPointer(e){
  if(!layoutEditorActive)return;
  const box=e.currentTarget,key=box.dataset.layoutKey,r=layoutEditorRectForKey(key);if(!r)return;
  selectLayoutBlock(key);const def=layoutEditorDefForKey(key);if(def?.locked){e.preventDefault();return;}pushLayoutHistory();box.setPointerCapture?.(e.pointerId);
  const px=pxRectFromNormalized(r);
  layoutPointerState={key,mode:e.target?.dataset?.resize?('resize-'+e.target.dataset.resize):'move',pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,start:px};
  e.preventDefault();
}
function moveLayoutPointer(e){
  const st=layoutPointerState;if(!st||!layoutEditorActive)return;
  const def=layoutEditorDefForKey(st.key),dx=e.clientX-st.startX,dy=e.clientY-st.startY,vp=layoutViewportSize();if(!def)return;
  let left=st.start.left,top=st.start.top,width=st.start.width,height=st.start.height;
  if(st.mode==='move'){
    left=editorSnapPx(st.start.left+dx);top=editorSnapPx(st.start.top+dy);
    left=Math.max(0,Math.min(vp.width-width,left));top=Math.max(0,Math.min(vp.height-height,top));
  }else{
    const dir=String(st.mode||'').slice(7),right=st.start.left+st.start.width,bottom=st.start.top+st.start.height;
    if(dir.includes('w')){left=editorSnapPx(st.start.left+dx);left=Math.max(0,Math.min(right-def.minW,left));width=right-left;}
    if(dir.includes('e')){width=editorSnapPx(st.start.width+dx);width=Math.max(def.minW,Math.min(vp.width-st.start.left,width));left=st.start.left;}
    if(dir.includes('n')){top=editorSnapPx(st.start.top+dy);top=Math.max(0,Math.min(bottom-def.minH,top));height=bottom-top;}
    if(dir.includes('s')){height=editorSnapPx(st.start.height+dy);height=Math.max(def.minH,Math.min(vp.height-st.start.top,height));top=st.start.top;}
  }
  setLayoutEditorRectForKey(st.key,normalizedRectFromPx({left,top,width,height}));renderLayoutEditorBoxes();e.preventDefault();
}
function endLayoutPointer(e){if(layoutPointerState&&(!e||e.pointerId===layoutPointerState.pointerId))layoutPointerState=null;}
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
  layoutEditorDraft=ensureLayoutDraft();layoutContentScaleDraft=JSON.parse(JSON.stringify(cfg.layoutContentScale||{}));layoutElementStyleDraft=JSON.parse(JSON.stringify(cfg.layoutElementStyle||{}));layoutPartStyleDraft=JSON.parse(JSON.stringify(cfg.layoutPartStyle||{}));layoutSelectedKey='';layoutSelectedPart='whole';layoutEditorActive=true;layoutScaleEditActive=false;layoutStyleEditField='';layoutPartFineEditField='';layoutUndoStack=[];layoutRedoStack=[];updateLayoutHistoryButtons();
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
  const snapEl=document.getElementById('layout-toolbar-snap');if(snapEl)snapEl.checked=snap;
  setLayoutEditorGrid(grid);setLayoutEditorSnap(snap);applyLayoutEditorContentScalePreview();renderLayoutEditorBoxes();
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


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("layout", {customLayoutPartDefs,normalizePartStyleValue,normalizePartStyleMap,normalizeBuiltInPartStyleTree,partStyleHasOverride,partStyleExtras,customPartFontSize,buildCustomLayoutPartCss,layoutInspectorPositionKey,layoutInspectorClamp,setLayoutInspectorPosition,restoreLayoutInspectorPosition,resetLayoutInspectorPosition,keepLayoutInspectorOnScreen,toggleLayoutInspectorCollapse,initLayoutInspectorDrag,layoutHistorySnapshot,updateLayoutHistoryButtons,pushLayoutHistory,restoreLayoutHistorySnapshot,undoLayoutEditor,redoLayoutEditor,clamp01,readLayoutViewport,layoutViewportSize,refreshLayoutSessionViewport,normalizedRectFromPx,pxRectFromNormalized,validLayoutRect,validStoredLayoutRect,cloneLayoutRect,sanitizeLayoutRect,layoutRectForDisplay,clearCustomLayoutStyles,applyOneLayoutRect,applyCustomLayout,applyBuiltInElementStyles,clearBuiltInLayoutAutoFit,clampLayoutFit,calendarFitScale,forecastFitScale,currentWeatherFitScale,clockFitScale,syncWeatherDetailsArrangeGrid,weatherDetailsFitScale,updateBuiltInLayoutAutoFit,scheduleBuiltInLayoutAutoFit,bindBuiltInLayoutAutoFitObserver,updateLayoutModeStatus,layoutVisualRect,gridTrackPixels,defaultFineBlockFallback,measureDefaultLayoutRects,ensureLayoutDraft,layoutSnapPx,editorSnapPx,renderLayoutEditorBoxes,appendLayoutEditBox,refreshLayoutToolbarBlockOptions,layoutEditorRectForKey,layoutEditorDefForKey,setLayoutEditorRectForKey,selectedPartDefs,selectedPartDefinition,selectedPartStyle,setSelectedPartStyleValue,setSelectedPartFineStyle,finishSelectedPartFineStyleEdit,selectedContentScale,applyLayoutEditorContentScalePreview,setSelectedContentScale,finishSelectedContentScaleEdit,resetSelectedContentScale,selectedLayoutStyle,applyLayoutInspectorPreview,setSelectedLayoutStyle,finishSelectedLayoutStyleEdit,setSelectedLayoutColorHex,resetSelectedStyleScope,selectLayoutPart,refreshLayoutPartPicker,placeSelectedLayoutBlock,selectLayoutBlock,updateLayoutSelectedInfo,beginLayoutPointer,moveLayoutPointer,endLayoutPointer,setLayoutEditorGrid,setLayoutEditorSnap,startLayoutEditor,saveLayoutEditor}, {
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
