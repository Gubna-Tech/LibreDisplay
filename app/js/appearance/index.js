// Product theme, typography, accessibility, and appearance form runtime.
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');

const {tick,weatherDetailsConfig,weatherDetailColumnCount,weatherDetailsFromForm,setWeatherDetailsForm}=LibreDisplayRuntime.getModule('weather');
const {uiCfg,escHtml,esc,normalizeHexColor,scaledClamp}=LibreDisplayRuntime.getModule('shared');

const LIBREDISPLAY_THEMES={
  'libre-night':{name:'Libre Night',desc:'Black + green',canvas:'#070907',overlay:'rgba(4,6,5,.95)',surface:'#0d100e',surface2:'#141915',surface3:'#1c231e',border:'rgba(166,179,171,.15)',borderStrong:'rgba(74,222,128,.38)',text:'#f5f7f6',muted:'#a0aaa4',subtle:'#68736c',accent:'#4ade80',accentStrong:'#22c55e',accentContrast:'#041109',success:'#22c55e',warning:'#fbbf24',danger:'#fb7185',focus:'#86efac'},
  'midnight-violet':{name:'Midnight Violet',desc:'Deep indigo + violet',canvas:'#080914',overlay:'rgba(5,5,16,.95)',surface:'#101225',surface2:'#171a33',surface3:'#202542',border:'rgba(167,139,250,.16)',borderStrong:'rgba(196,181,253,.4)',text:'#fafaff',muted:'#b4b7d6',subtle:'#777b9e',accent:'#a78bfa',accentStrong:'#8b5cf6',accentContrast:'#0f0822',success:'#34d399',warning:'#fbbf24',danger:'#fb7185',focus:'#c4b5fd'},
  graphite:{name:'Graphite',desc:'Neutral charcoal',canvas:'#090a0a',overlay:'rgba(5,6,6,.95)',surface:'#121414',surface2:'#191c1c',surface3:'#232727',border:'rgba(203,213,225,.13)',borderStrong:'rgba(203,213,225,.30)',text:'#f4f5f5',muted:'#a8afaf',subtle:'#6c7474',accent:'#cbd5e1',accentStrong:'#94a3b8',accentContrast:'#0b0d0e',success:'#4ade80',warning:'#facc15',danger:'#fb7185',focus:'#e2e8f0'},
  ember:{name:'Ember',desc:'Warm charcoal + amber',canvas:'#100b09',overlay:'rgba(12,7,5,.95)',surface:'#1a1210',surface2:'#241815',surface3:'#30201b',border:'rgba(251,146,60,.15)',borderStrong:'rgba(253,186,116,.38)',text:'#fffaf5',muted:'#c9afa2',subtle:'#876f65',accent:'#fb923c',accentStrong:'#f97316',accentContrast:'#1c0902',success:'#4ade80',warning:'#fbbf24',danger:'#fb7185',focus:'#fdba74'},
  'deep-ocean':{name:'Deep Ocean',desc:'Dark marine blue + aqua',canvas:'#061015',overlay:'rgba(3,10,14,.95)',surface:'#0a1820',surface2:'#0f222c',surface3:'#15303c',border:'rgba(103,232,249,.14)',borderStrong:'rgba(94,234,212,.38)',text:'#f2fcff',muted:'#9ac2ca',subtle:'#5e8790',accent:'#2dd4bf',accentStrong:'#14b8a6',accentContrast:'#021714',success:'#4ade80',warning:'#fbbf24',danger:'#fb7185',focus:'#5eead4'}
};
function applyProductTheme(key){
  const theme=LIBREDISPLAY_THEMES[key]||LIBREDISPLAY_THEMES['libre-night'];
  const root=document.documentElement;
  root.dataset.theme=key in LIBREDISPLAY_THEMES?key:'libre-night';
  const vars={canvas:'--ld-canvas',overlay:'--ld-overlay',surface:'--ld-surface',surface2:'--ld-surface-2',surface3:'--ld-surface-3',border:'--ld-border',borderStrong:'--ld-border-strong',text:'--ld-text',muted:'--ld-muted',subtle:'--ld-subtle',accent:'--ld-accent',accentStrong:'--ld-accent-strong',accentContrast:'--ld-accent-contrast',success:'--ld-success',warning:'--ld-warning',danger:'--ld-danger',focus:'--ld-focus'};
  for(const [k,v] of Object.entries(vars))root.style.setProperty(v,theme[k]);
}
function renderThemeChoices(selected){
  const grid=document.getElementById('theme-choice-grid');if(!grid)return;
  const current=LIBREDISPLAY_THEMES[selected]?selected:'libre-night';
  grid.innerHTML=Object.entries(LIBREDISPLAY_THEMES).map(([key,t])=>`<button class="theme-choice-card ${key===current?'selected':''}" type="button" role="radio" aria-checked="${key===current?'true':'false'}" data-theme="${key}" onclick="selectThemeChoice('${key}')"><span class="theme-swatches"><i style="background:${t.canvas}"></i><i style="background:${t.surface2}"></i><i style="background:${t.accent}"></i></span><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join('');
}
function selectThemeChoice(key){
  if(!LIBREDISPLAY_THEMES[key])return;
  renderThemeChoices(key);
  previewAppearance();
  markSettingsDirty();
}
const LIBREDISPLAY_FONTS=[
  {value:'Inter',label:'Inter',desc:'Modern & clean',sample:'Home · 12:45'},
  {value:'system',label:'System UI',desc:'Native & familiar',sample:'Weather · Today'},
  {value:'Noto Sans',label:'Noto Sans',desc:'Neutral & readable',sample:'Calendar · 68°'},
  {value:'DejaVu Sans',label:'DejaVu Sans',desc:'Open & practical',sample:'Family · Friday'},
  {value:'Liberation Sans',label:'Liberation Sans',desc:'Classic sans',sample:'Tasks · 7:30'},
  {value:'Trebuchet MS',label:'Trebuchet MS',desc:'Friendly humanist',sample:'Photos · Home'},
  {value:'DejaVu Serif',label:'DejaVu Serif',desc:'Traditional serif',sample:'October · Sunday'},
  {value:'Georgia',label:'Georgia',desc:'Warm editorial serif',sample:'Morning · 8:15'},
  {value:'monospace',label:'Monospace',desc:'Technical & precise',sample:'STATUS 21:08'}
];
function renderFontChoices(selected){const grid=document.getElementById('font-choice-grid');if(!grid)return;const current=LIBREDISPLAY_FONTS.some(f=>f.value===selected)?selected:'Inter';grid.innerHTML=LIBREDISPLAY_FONTS.map(f=>`<button class="font-choice-card ${f.value===current?'selected':''}" type="button" role="radio" aria-checked="${f.value===current?'true':'false'}" onclick="selectFontChoice('${escHtml(f.value)}')" style="font-family:${fontCssValue(f.value)}"><strong>${escHtml(f.label)}</strong><small>${escHtml(f.sample)}</small><span>${escHtml(f.desc)}</span></button>`).join('');}
function selectFontChoice(name,fromSelect=false){if(!LIBREDISPLAY_FONTS.some(f=>f.value===name))name='Inter';const select=document.getElementById('s-font-family');if(select&&select.value!==name)select.value=name;renderFontChoices(name);styleFontSelectOptions();previewAppearance();if(!LibreDisplayRuntime.getModule('system').settingsInitializing)markSettingsDirty();}
function styleFontSelectOptions(){for(const id of ['s-font-family','layout-style-font']){const select=document.getElementById(id);if(!select)continue;for(const option of select.options){const value=option.value||'Inter';option.style.fontFamily=fontCssValue(value);}}}
function updateFontPreview(){
  const name=document.getElementById('s-font-family')?.value||'Inter';
  const preview=document.getElementById('theme-font-preview');
  if(preview)preview.style.fontFamily=fontCssValue(name);
  renderFontChoices(name);styleFontSelectOptions();
}

function fontCssValue(name){
  const map={
    Inter:"'Inter','Noto Sans','DejaVu Sans',system-ui,sans-serif",
    system:"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',sans-serif",
    'Noto Sans':"'Noto Sans','DejaVu Sans',sans-serif",
    'DejaVu Sans':"'DejaVu Sans','Liberation Sans',sans-serif",
    'Liberation Sans':"'Liberation Sans','Arial',sans-serif",
    'Trebuchet MS':"'Trebuchet MS','Noto Sans',sans-serif",
    'DejaVu Serif':"'DejaVu Serif','Liberation Serif',serif",
    Georgia:"Georgia,'DejaVu Serif','Liberation Serif',serif",
    monospace:"ui-monospace,'DejaVu Sans Mono','Liberation Mono',Consolas,monospace"
  };
  return map[name]||map.Inter;
}

function measureDashboardFontProbe(fontName){
  try{
    const canvas=measureDashboardFontProbe._canvas||(measureDashboardFontProbe._canvas=document.createElement('canvas'));
    const ctx=canvas.getContext('2d');if(!ctx)return {width:0,height:0};
    ctx.font=`100px ${fontCssValue(fontName||'Inter')}`;
    const m=ctx.measureText('LibreDisplay 0123456789 Weather Calendar Dashboard ABC xyz');
    const height=Math.max(1,Number(m.actualBoundingBoxAscent||0)+Number(m.actualBoundingBoxDescent||0));
    return {width:Number(m.width)||0,height};
  }catch(e){return {width:0,height:0};}
}

let screenCareTimer=null,screenCareLastActivity=Date.now(),screenCareDimmed=false;
function noteScreenCareActivity(){screenCareLastActivity=Date.now();if(screenCareDimmed){screenCareDimmed=false;document.body.classList.remove('ld-burnin-dim');}}
function screenCareCanDim(source=uiCfg()){
  if(!source?.burnInProtection||layoutEditorActive||remoteLayoutProxyActive||LAYOUT_PREVIEW_MODE)return false;
  const setup=document.getElementById('setup');if(setup&&!setup.classList.contains('hidden'))return false;
  return bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LOCAL_CLIENT_MODE;
}
function updateScreenCareState(source=uiCfg()){
  const brightness=Math.min(70,Math.max(25,Number(source?.burnInBrightnessPct)||40));
  document.documentElement.style.setProperty('--ld-burnin-overlay',String((100-brightness)/100));
  if(!screenCareCanDim(source)){screenCareDimmed=false;document.body.classList.remove('ld-burnin-dim');return;}
  const idleMs=Math.max(15,Number(source?.burnInIdleMin)||30)*60000;
  const shouldDim=Date.now()-screenCareLastActivity>=idleMs;
  screenCareDimmed=shouldDim;document.body.classList.toggle('ld-burnin-dim',shouldDim);
}
function applyScreenCarePreferences(source=cfg){
  updateScreenCareState(source);
  if(screenCareTimer)clearInterval(screenCareTimer);
  if(source?.burnInProtection)screenCareTimer=setInterval(()=>updateScreenCareState(uiCfg()),15000);
}
['pointerdown','keydown','touchstart','wheel'].forEach(type=>window.addEventListener(type,noteScreenCareActivity,{passive:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)noteScreenCareActivity();});

function applyAccessibilityPreferences(source=cfg){
  const locale=source.locale&&source.locale!=='auto'?source.locale:(navigator.language||'en-US');
  document.documentElement.lang=String(locale).split('-')[0]||'en';
  const systemReduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const constrained=LibreDisplayRuntime.getModule('performance').frontendCapabilities().constrained;
  const reduced=source.motionPreference==='reduced'||(source.motionPreference==='auto'&&(systemReduced||constrained));
  document.documentElement.classList.toggle('ld-reduce-motion',reduced);
  document.documentElement.classList.toggle('ld-high-contrast',!!source.highContrast);
  document.documentElement.classList.toggle('ld-focus-outline',!!source.focusOutline);
  const setup=document.getElementById('setup');
  if(setup)setup.dataset.uiSize=['large','xlarge'].includes(source.settingsUiSize)?source.settingsUiSize:'standard';
  applyScreenCarePreferences(source);
}

function applyUiCustomization(source=cfg){
  applyAccessibilityPreferences(source);
  applyProductTheme(source.uiTheme||'libre-night');
  const q=(v,lo,hi,def)=>{const n=Number(v);return Math.min(hi,Math.max(lo,Number.isFinite(n)?n:def));};
  const per=source.layoutContentScale&&typeof source.layoutContentScale==='object'?source.layoutContentScale:{};
  const es=k=>q(per[k],50,200,100)/100;
  const cal=q(source.uiCalendarPct,75,140,100)*es('calendar'), cur=q(source.uiCurrentPct,75,140,100)*es('current'), clk=q(source.uiClockPct,75,140,100)*es('clock');
  const dailyFc=q(source.uiForecastPct,75,150,100)*es('daily'), hourlyFc=q(source.uiForecastPct,75,150,100)*es('hourly'), det=q(source.uiDetailsPct,75,140,100)*es('details'), al=q(source.uiAlertPct,75,150,100)*es('alerts');
  const gap=q(source.forecastGapPx,0,16,5), rowGap=q(source.forecastRowGapPx,4,36,18);
  const calH=q(source.calendarBandHeight,120,210,150), bottomH=q(source.bottomPanelHeight,270,410,330);
  const leftW=q(source.leftPanelWidth,410,560,470), sidePad=q(source.sidePaddingPx,10,48,28);
  const dailyCols=Math.min(14,Math.max(3,Number(source.dailyForecastDays)||Number(source.forecastColumns)||12));
  const hourlyCols=Math.min(24,Math.max(3,Number(source.hourlyForecastHours)||Number(source.forecastColumns)||12));
  const calCols=Math.min(10,Math.max(2,Number(source.calendarColumns)||7));
  const calCellH=Math.min(240,Math.max(90,Number(source.calendarCellHeight)||150));
  const textColor=normalizeHexColor(source.primaryTextColor,'#ffffff');
  const rgb=hexRgb(textColor);
  const secondary=q(source.secondaryOpacity,45,100,88)/100;
  const tertiary=Math.max(.3,secondary*.68);
  const shadowAlpha=Math.min(.95,.80*q(source.textShadowPct,0,140,100)/100);
  const detailCfg=weatherDetailsConfig(source);
  const detailEnabledCount=detailCfg.order.filter(k=>detailCfg.enabled[k]).length;
  const detailCount=Math.max(1,detailEnabledCount);
  const detailW=Math.max(380,leftW-18);
  const blur=q(source.bgBlurPx,0,12,0);
  const transition=q(source.bgTransitionSec,0,4,1.5);
  const alertOpacity=q(source.alertOpacityPct,55,100,100)/100;
  const part=(key,name)=>normalizePartStyleValue(source.layoutPartStyle?.[key]?.[name]||{}),ps=(key,name)=>part(key,name).scale/100,pe=(key,name)=>partStyleExtras(part(key,name));
  let style=document.getElementById('user-ui-overrides');
  if(!style){style=document.createElement('style');style.id='user-ui-overrides';document.head.appendChild(style);}
  style.textContent=`
    #app,#alert-zone,#cog{font-family:${fontCssValue(source.fontFamily)};color:${textColor}}
    #cog{width:${q(source.settingsCogSize,36,58,46)}px;height:${q(source.settingsCogSize,36,58,46)}px;opacity:${(q(source.settingsCogOpacity,10,90,42)/100).toFixed(2)};top:${String(source.settingsCogPosition||'').startsWith('top')?'22px':'auto'};bottom:${String(source.settingsCogPosition||'').startsWith('bottom')?'22px':'auto'};left:${String(source.settingsCogPosition||'').endsWith('left')?'22px':'auto'};right:${String(source.settingsCogPosition||'').endsWith('right')?'22px':'auto'}}
    html.cursor-active #cog{opacity:${Math.min(.95,q(source.settingsCogOpacity,10,90,42)/100+.18).toFixed(2)}}
    #cog::before{display:${source.settingsCogLabel===false?'none':'block'};right:${String(source.settingsCogPosition||'').endsWith('left')?'auto':'54px'};left:${String(source.settingsCogPosition||'').endsWith('left')?'54px':'auto'};transform:${String(source.settingsCogPosition||'').endsWith('left')?'translate(-7px,-50%)':'translate(7px,-50%)'}}
    #cog:hover::before,#cog:focus-visible::before,#cog.cog-discover::before{transform:translate(0,-50%)}
    #top-strip{height:${calH}px;padding-left:${sidePad}px;padding-right:${sidePad}px;grid-template-columns:repeat(${calCols},minmax(0,1fr));--ld-layout-calendar-row-base:${calCellH}px;grid-auto-rows:var(--ld-layout-calendar-row,var(--ld-layout-calendar-row-base));overflow-y:auto;overflow-x:hidden}
    #bottom{grid-template-columns:${leftW}px minmax(0,1fr);min-height:${bottomH}px;padding-left:${sidePad}px;padding-right:${sidePad}px}
    #wx-left{width:${leftW}px}
    .wx-details{width:${detailW}px;grid-template-columns:repeat(${weatherDetailColumnCount(detailCount)},minmax(0,1fr));display:${detailEnabledCount>0?'grid':'none'}}
    #wx-right{gap:${rowGap}px;display:${source.showDailyForecast===false&&source.showHourlyForecast===false?'none':'grid'}}
    .wx-forecast{display:${source.showDailyForecast===false?'none':'grid'}}
    #wx-hourly-block{display:${source.showHourlyForecast===false?'none':'block'}}
    .wx-forecast{grid-template-columns:repeat(${dailyCols},minmax(0,1fr));gap:${gap}px}
    .wx-hourly{grid-template-columns:repeat(${hourlyCols},minmax(0,1fr));gap:${gap}px}
    #calendar-legend{top:${calH+3}px;left:${sidePad}px;right:${sidePad}px}
    #alert-zone{top:${calH+(source.calendarLegend?36:14)}px;bottom:${bottomH+30}px;left:${sidePad}px;right:${sidePad}px}
    #bg,#bg-next{filter:blur(${blur}px);transform:${blur?`scale(${(1+blur/300).toFixed(3)})`:'none'};transition:opacity ${transition}s ease}
    .day-num{font-size:${scaledClamp(30,2.55,42,cal*ps('calendar','dayNumber'))};color:${textColor};${pe('calendar','dayNumber')}}
    .day-label{font-size:${scaledClamp(14,1.18,20,cal*ps('calendar','dayLabel'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('calendar','dayLabel')}}
    .no-events{font-size:${scaledClamp(12,1,17,cal*ps('calendar','emptyText'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${tertiary.toFixed(3)});${pe('calendar','emptyText')}}
    .event-time{font-size:${scaledClamp(11,.92,15,cal*ps('calendar','eventText')*ps('calendar','eventTime'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(1,secondary*.86).toFixed(3)});${pe('calendar','eventText')}${pe('calendar','eventTime')}}
    .event-title{font-size:${scaledClamp(12,1.02,17,cal*ps('calendar','eventText')*ps('calendar','eventTitle'))};color:${textColor};padding-left:${source.showEventTimes===false?'0':'9px'};${pe('calendar','eventText')}${pe('calendar','eventTitle')}}
    .event-title-no-time{display:flex;align-items:center;gap:6px;padding-left:0}
    .wx-location{font-size:${scaledClamp(11,.82,15,cur)};color:rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(1,secondary*.9).toFixed(3)})}
    .wx-temp{font-size:${scaledClamp(66,5.9,96,cur*ps('current','temperature'))};color:${textColor};${pe('current','temperature')}}
    .wx-icon-big{font-size:${scaledClamp(36,3.4,54,cur*ps('current','icon'))};${pe('current','icon')}}
    .wx-feels{font-size:${scaledClamp(17,1.25,23,cur*ps('current','feelsLike'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('current','feelsLike')}}
    .wx-cond{font-size:${scaledClamp(17,1.25,23,cur*ps('current','condition'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('current','condition')}}
    .clock-time{font-size:${scaledClamp(66,6,102,clk*ps('clock','time'))};color:${textColor};${pe('clock','time')}}
    .clock-time.wide-time{font-size:${scaledClamp(62,5.55,94,clk*ps('clock','time'))}}
    .clock-sec{font-size:${scaledClamp(20,1.8,30,clk*ps('clock','seconds'))};color:${textColor};${pe('clock','seconds')}}
    .clock-date{font-size:${scaledClamp(16,1.35,24,clk*ps('clock','date'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('clock','date')}}
    .fc-col .fc-day-name{font-size:${scaledClamp(13,.95,18,dailyFc*ps('daily','day'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('daily','day')}}
    .fc-col .fc-icon{font-size:${scaledClamp(23,1.7,32,dailyFc*ps('daily','icon'))};${pe('daily','icon')}}
    .fc-col .fc-rain{font-size:${scaledClamp(11,.8,15,dailyFc*ps('daily','precip'))};${pe('daily','precip')}}
    .fc-col .fc-temps{font-size:${scaledClamp(13,.95,18,dailyFc*ps('daily','temperature'))};color:${textColor};${pe('daily','temperature')}}
    .hr-col .hr-time{font-size:${scaledClamp(14,1,19,hourlyFc*ps('hourly','time'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('hourly','time')}}
    .hr-col .hr-icon{font-size:${scaledClamp(24,1.85,34,hourlyFc*ps('hourly','icon'))};${pe('hourly','icon')}}
    .hr-col .hr-rain{font-size:${scaledClamp(12,.86,16,hourlyFc*ps('hourly','precip'))};${pe('hourly','precip')}}
    .hr-col .hr-temp{font-size:${scaledClamp(15,1.05,20,hourlyFc*ps('hourly','temperature'))};color:${textColor};${pe('hourly','temperature')}}
    .wx-detail .wd-icon{font-size:${(21*det/100*ps('details','icon')).toFixed(2)}px;${pe('details','icon')}}
    .wx-detail .wd-label{font-size:${scaledClamp(13,.92,17,det*ps('details','label'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(1,secondary*.82).toFixed(3)});${pe('details','label')}}
    .wx-detail .wd-val{font-size:${scaledClamp(15,1,19,det*ps('details','value'))};color:${textColor};${pe('details','value')}}
    .alert-card{opacity:${alertOpacity.toFixed(2)}}
    .alert-icon{font-size:${scaledClamp(42,3.4,60,al*ps('alerts','icon'))};${pe('alerts','icon')}}
    .alert-title{font-size:${scaledClamp(18,1.45,28,al*ps('alerts','title'))};${pe('alerts','title')}}
    .alert-expiry{font-size:${scaledClamp(11,.88,15,al*ps('alerts','expiry'))};display:${source.alertShowExpiry===false?'none':'block'};${pe('alerts','expiry')}}
    .alert-text{font-size:${scaledClamp(14,1.14,21,al*ps('alerts','body'))};${pe('alerts','body')}}
    .alert-meta{font-size:${scaledClamp(10,.74,13,al*ps('alerts','meta'))};display:${source.alertShowMeta===false?'none':'block'};${pe('alerts','meta')}}
    #top-strip,#wx-left,#wx-right,#clock-block{ text-shadow:0 2px 8px rgba(0,0,0,${shadowAlpha.toFixed(3)}) }
  `+buildCustomLayoutPartCss(source);
  const root=document.documentElement;
  root.style.setProperty('--bg-shade-top',(q(source.bgShadeTop,0,85,52)/100).toFixed(2));
  root.style.setProperty('--bg-shade-bottom',(q(source.bgShadeBottom,0,85,55)/100).toFixed(2));
  root.style.setProperty('--bg-size',['cover','contain'].includes(source.bgFit)?source.bgFit:'cover');
  root.style.setProperty('--bg-position',['center','center top','center bottom','left center','right center'].includes(source.bgPosition)?source.bgPosition:'center');
  const icon=document.getElementById('wx-icon'); if(icon)icon.style.display=source.showCurrentIcon===false?'none':'';
  LibreDisplayRuntime.getModule('onboarding').renderCalendarLegend();
  ensureCustomBlocksRendered(source.customBlocks||cfg.customBlocks||[]);
  renderLayoutShowcase(source);
  applyCustomLayout(source);
  applyBuiltInElementStyles(source);
  updateCustomBlockUniversalStates(source.customBlocks||cfg.customBlocks||[]);
  updateLayoutModeStatus(source);
  tick();
}

function appearanceFromForm(){
  return {...cfg,
    uiTheme:document.querySelector('.theme-choice-card.selected')?.dataset.theme||cfg.uiTheme||'libre-night',
    fontFamily:document.getElementById('s-font-family')?.value||'Inter',
    primaryTextColor:normalizeHexColor(document.getElementById('s-text-hex')?.value,document.getElementById('s-text-color')?.value||'#ffffff'),
    secondaryOpacity:Number(document.getElementById('s-secondary-opacity')?.value)||88,
    textShadowPct:Number(document.getElementById('s-text-shadow')?.value)??100,
    uiCalendarPct:Number(document.getElementById('s-ui-calendar')?.value)||100,
    uiCurrentPct:Number(document.getElementById('s-ui-current')?.value)||100,
    uiClockPct:Number(document.getElementById('s-ui-clock')?.value)||100,
    uiForecastPct:Number(document.getElementById('s-ui-forecast')?.value)||100,
    uiDetailsPct:Number(document.getElementById('s-ui-details')?.value)||100,
    uiAlertPct:Number(document.getElementById('s-ui-alert')?.value)||100,
    calendarBandHeight:Number(document.getElementById('s-calendar-height')?.value)||150,
    bottomPanelHeight:Number(document.getElementById('s-bottom-height')?.value)||330,
    leftPanelWidth:Number(document.getElementById('s-left-width')?.value)||470,
    sidePaddingPx:Number(document.getElementById('s-side-padding')?.value)||28,
    forecastGapPx:Number(document.getElementById('s-forecast-gap')?.value)??5,
    forecastRowGapPx:Number(document.getElementById('s-forecast-row-gap')?.value)||18,
    forecastColumns:Number(document.getElementById('s-daily-days')?.value)||12,
    hourlyForecastHours:Number(document.getElementById('s-hourly-hours')?.value)||12,
    dailyForecastDays:Number(document.getElementById('s-daily-days')?.value)||12,
    calendarDays:Number(document.getElementById('s-calendar-days')?.value)||7,
    calendarColumns:Number(document.getElementById('s-calendar-columns')?.value)||7,
    calendarCellHeight:Number(document.getElementById('s-calendar-cell-height')?.value)||150,
    calendarScrollMode:document.getElementById('s-calendar-scroll-mode')?.value||'off',
    calendarScrollSpeed:Number(document.getElementById('s-calendar-scroll-speed')?.value)||12,
    layoutGridPx:Number(document.getElementById('s-layout-grid')?.value)||cfg.layoutGridPx||20,
    layoutSnap:document.getElementById('s-layout-snap')?.checked!==false,
    calendarMaxEvents:Number(document.getElementById('s-calendar-max-events')?.value)||4,
    showNoEvents:!!document.getElementById('s-show-no-events')?.checked,
    showEventTimes:!!document.getElementById('s-show-event-times')?.checked,
    calendarTimeStyle:document.getElementById('s-calendar-time-style')?.value||cfg.calendarTimeStyle||'start',
    calendarLegend:!!document.getElementById('s-calendar-legend')?.checked,
    calendarShowContinuation:!!document.getElementById('s-calendar-show-continuation')?.checked,
    showDailyForecast:!!document.getElementById('s-show-daily')?.checked,
    showHourlyForecast:!!document.getElementById('s-show-hourly')?.checked,
    showPrecip:!!document.getElementById('s-show-precip')?.checked,
    timeFormat:document.getElementById('s-time-format')?.value||'12',
    dateFormat:document.getElementById('s-date-format')?.value||'long',
    showSeconds:!!document.getElementById('s-show-seconds')?.checked,
    showAmPm:!!document.getElementById('s-show-ampm')?.checked,
    showDate:!!document.getElementById('s-show-date')?.checked,
    showCurrentIcon:!!document.getElementById('s-show-current-icon')?.checked,
    ...weatherDetailsFromForm(),
    bgShadeTop:Number(document.getElementById('s-bg-top')?.value)??52,
    bgShadeBottom:Number(document.getElementById('s-bg-bottom')?.value)??55,
    bgBlurPx:Number(document.getElementById('s-bg-blur')?.value)||0,
    bgTransitionSec:Number(document.getElementById('s-bg-transition')?.value)??1.5,
    bgFit:document.getElementById('s-bg-fit')?.value||'cover',
    bgPosition:document.getElementById('s-bg-position')?.value||'center',
    alertOpacityPct:Number(document.getElementById('s-alert-opacity')?.value)||100,
    alertMinSeverity:document.getElementById('s-alert-min-severity')?.value||'all',
    alertShowExpiry:!!document.getElementById('s-alert-show-expiry')?.checked,
    alertShowMeta:!!document.getElementById('s-alert-show-meta')?.checked,
    locale:document.getElementById('s-locale')?.value||'auto',
    motionPreference:document.getElementById('s-motion-preference')?.value||'auto',
    highContrast:!!document.getElementById('s-high-contrast')?.checked,
    focusOutline:!!document.getElementById('s-focus-outline')?.checked,
    settingsUiSize:document.getElementById('s-settings-ui-size')?.value||'standard',
    burnInProtection:!!document.getElementById('s-burnin-protection')?.checked,
    burnInIdleMin:Number(document.getElementById('s-burnin-idle')?.value)||30,
    burnInBrightnessPct:Number(document.getElementById('s-burnin-brightness')?.value)||40,
    settingsCogPosition:document.getElementById('s-cog-position')?.value||'bottom-right',
    settingsCogOpacity:Number(document.getElementById('s-cog-opacity')?.value)||42,
    settingsCogSize:Number(document.getElementById('s-cog-size')?.value)||46,
    settingsCogLabel:document.getElementById('s-cog-label')?.checked!==false
  };
}

function updateAppearanceLabels(v){
  const map=[
    ['s-secondary-opacity-value',v.secondaryOpacity,'%'],['s-text-shadow-value',v.textShadowPct,'%'],
    ['s-ui-calendar-value',v.uiCalendarPct,'%'],['s-ui-current-value',v.uiCurrentPct,'%'],['s-ui-clock-value',v.uiClockPct,'%'],['s-ui-forecast-value',v.uiForecastPct,'%'],['s-ui-details-value',v.uiDetailsPct,'%'],['s-ui-alert-value',v.uiAlertPct,'%'],
    ['s-calendar-height-value',v.calendarBandHeight,'px'],['s-bottom-height-value',v.bottomPanelHeight,'px'],['s-left-width-value',v.leftPanelWidth,'px'],['s-side-padding-value',v.sidePaddingPx,'px'],
    ['s-forecast-gap-value',v.forecastGapPx,'px'],['s-forecast-row-gap-value',v.forecastRowGapPx,'px'],['s-calendar-cell-height-value',v.calendarCellHeight||150,'px'],['s-calendar-scroll-speed-value',v.calendarScrollSpeed||12,' px/s'],
    ['s-bg-top-value',v.bgShadeTop,'%'],['s-bg-bottom-value',v.bgShadeBottom,'%'],['s-bg-blur-value',v.bgBlurPx,'px'],['s-bg-transition-value',v.bgTransitionSec,'s'],['s-alert-opacity-value',v.alertOpacityPct,'%'],['s-cog-opacity-value',v.settingsCogOpacity??42,'%']
  ];
  for(const [id,val,suffix] of map){const el=document.getElementById(id);if(el)el.textContent=String(val)+suffix;}
}

const APPEARANCE_DEFAULTS={
  uiTheme:'libre-night',fontFamily:'Inter',primaryTextColor:'#ffffff',secondaryOpacity:88,textShadowPct:100,
  uiCalendarPct:100,uiCurrentPct:100,uiClockPct:100,uiForecastPct:100,uiDetailsPct:100,uiAlertPct:100,
  calendarBandHeight:150,bottomPanelHeight:330,leftPanelWidth:470,sidePaddingPx:28,forecastGapPx:5,forecastRowGapPx:18,forecastColumns:12,hourlyForecastHours:12,dailyForecastDays:12,calendarDays:7,calendarColumns:7,calendarCellHeight:150,calendarScrollMode:'off',calendarScrollSpeed:12,layoutGridPx:20,layoutSnap:true,calendarMaxEvents:4,
  showNoEvents:true,showEventTimes:true,showDailyForecast:true,showHourlyForecast:true,showPrecip:true,timeFormat:'12',dateFormat:'long',showSeconds:true,showAmPm:true,showDate:true,showCurrentIcon:true,showSunset:true,showWind:true,showHumidity:true,weatherDetailsOrder:['sunset','wind','humidity','sunrise','airquality','uvindex','feelslike','pressure','cloudcover','dewpoint','precipitation'],weatherDetailsEnabled:{sunset:true,wind:true,humidity:true,sunrise:false,airquality:false,uvindex:false,feelslike:false,pressure:false,cloudcover:false,dewpoint:false,precipitation:false},
  bgShadeTop:52,bgShadeBottom:55,bgBlurPx:0,bgTransitionSec:1.5,bgFit:'cover',bgPosition:'center',alertOpacityPct:100,alertMinSeverity:'all',alertShowExpiry:true,alertShowMeta:true,locale:'auto',motionPreference:'auto',highContrast:false,focusOutline:false,settingsUiSize:'standard',burnInProtection:false,burnInIdleMin:30,burnInBrightnessPct:40,settingsCogPosition:'bottom-right',settingsCogOpacity:42,settingsCogSize:46,settingsCogLabel:true
};


function setAppearanceForm(v){
  const locale=document.getElementById('s-locale');if(locale)locale.value=v.locale||'auto';
  const motion=document.getElementById('s-motion-preference');if(motion)motion.value=v.motionPreference||'auto';
  const contrast=document.getElementById('s-high-contrast');if(contrast)contrast.checked=!!v.highContrast;
  const focus=document.getElementById('s-focus-outline');if(focus)focus.checked=!!v.focusOutline;
  const settingsUiSize=document.getElementById('s-settings-ui-size');if(settingsUiSize)settingsUiSize.value=v.settingsUiSize||'standard';
  const burnIn=document.getElementById('s-burnin-protection');if(burnIn)burnIn.checked=!!v.burnInProtection;
  const burnIdle=document.getElementById('s-burnin-idle');if(burnIdle)burnIdle.value=String(v.burnInIdleMin||30);
  const burnBrightness=document.getElementById('s-burnin-brightness');if(burnBrightness)burnBrightness.value=String(v.burnInBrightnessPct||40);
  renderThemeChoices(v.uiTheme||'libre-night');
  const values={
    's-font-family':v.fontFamily,'s-secondary-opacity':v.secondaryOpacity,'s-text-shadow':v.textShadowPct,
    's-ui-calendar':v.uiCalendarPct,'s-ui-current':v.uiCurrentPct,'s-ui-clock':v.uiClockPct,'s-ui-forecast':v.uiForecastPct,'s-ui-details':v.uiDetailsPct,'s-ui-alert':v.uiAlertPct,
    's-calendar-height':v.calendarBandHeight,'s-bottom-height':v.bottomPanelHeight,'s-left-width':v.leftPanelWidth,'s-side-padding':v.sidePaddingPx,'s-forecast-gap':v.forecastGapPx,'s-forecast-row-gap':v.forecastRowGapPx,
    's-hourly-hours':v.hourlyForecastHours||v.forecastColumns||12,'s-daily-days':v.dailyForecastDays||v.forecastColumns||12,'s-calendar-days':v.calendarDays,'s-calendar-columns':v.calendarColumns||7,'s-calendar-cell-height':v.calendarCellHeight||150,'s-calendar-scroll-mode':v.calendarScrollMode||'off','s-calendar-scroll-speed':v.calendarScrollSpeed||12,'s-layout-grid':v.layoutGridPx||20,'s-calendar-max-events':v.calendarMaxEvents,'s-time-format':v.timeFormat,'s-date-format':v.dateFormat,
    's-bg-top':v.bgShadeTop,'s-bg-bottom':v.bgShadeBottom,'s-bg-blur':v.bgBlurPx,'s-bg-transition':v.bgTransitionSec,'s-bg-fit':v.bgFit,'s-bg-position':v.bgPosition,
    's-alert-opacity':v.alertOpacityPct,'s-alert-min-severity':v.alertMinSeverity,'s-cog-position':v.settingsCogPosition||'bottom-right','s-cog-opacity':v.settingsCogOpacity??42,'s-cog-size':v.settingsCogSize||46
  };
  for(const [id,val] of Object.entries(values)){const el=document.getElementById(id);if(el)el.value=String(val);}
  const checks={
    's-layout-snap':v.layoutSnap!==false,
    's-show-no-events':v.showNoEvents,'s-show-event-times':v.showEventTimes,'s-show-daily':v.showDailyForecast,'s-show-hourly':v.showHourlyForecast,'s-show-precip':v.showPrecip,
    's-show-seconds':v.showSeconds,'s-show-ampm':v.showAmPm,'s-show-date':v.showDate,'s-show-current-icon':v.showCurrentIcon,
    's-alert-show-expiry':v.alertShowExpiry,'s-alert-show-meta':v.alertShowMeta,'s-cog-label':v.settingsCogLabel!==false
  };
  for(const [id,val] of Object.entries(checks)){const el=document.getElementById(id);if(el)el.checked=val!==false;}
  const color=normalizeHexColor(v.primaryTextColor,'#ffffff');
  const picker=document.getElementById('s-text-color'),hex=document.getElementById('s-text-hex');
  if(picker)picker.value=color;if(hex)hex.value=color.toUpperCase();
  setWeatherDetailsForm(v);
  updateAppearanceLabels(v);
  updateFontPreview();
}

const PRESET_CONTENT_PRESERVE_KEYS=['weatherDetailsOrder','weatherDetailsEnabled','showSunset','showWind','showHumidity','calendarTimeStyle','calendarLegend','calendarShowContinuation','burnInProtection','burnInIdleMin','burnInBrightnessPct'];
function preservePresetState(target,current){for(const prop of PRESET_CONTENT_PRESERVE_KEYS)target[prop]=JSON.parse(JSON.stringify(current[prop]));return target;}

function resetAppearanceForm(){
  LibreDisplayRuntime.getModule('appearance').settingsLayoutPresetKey='default';
  setAppearanceForm(APPEARANCE_DEFAULTS);
  previewAppearance();renderLayoutPresetGallery();markSettingsDirty();
}

function bindTextColorControls(){
  const picker=document.getElementById('s-text-color'),hex=document.getElementById('s-text-hex');
  if(!picker||!hex||picker.dataset.bound==='1')return;
  picker.dataset.bound='1';
  picker.addEventListener('input',()=>{hex.value=picker.value.toUpperCase();previewAppearance();});
  hex.addEventListener('input',()=>{
    let c=String(hex.value||'').trim();if(c&&!c.startsWith('#'))c='#'+c;
    if(/^#[0-9a-f]{3}$/i.test(c))c='#'+c.slice(1).split('').map(x=>x+x).join('');
    if(/^#[0-9a-f]{6}$/i.test(c)){picker.value=c.toLowerCase();previewAppearance();}
  });
  hex.addEventListener('blur',()=>{const c=normalizeHexColor(hex.value,picker.value);picker.value=c;hex.value=c.toUpperCase();previewAppearance();});
}


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("appearance", {applyProductTheme,renderThemeChoices,selectThemeChoice,renderFontChoices,selectFontChoice,styleFontSelectOptions,updateFontPreview,fontCssValue,measureDashboardFontProbe,noteScreenCareActivity,screenCareCanDim,updateScreenCareState,applyScreenCarePreferences,applyAccessibilityPreferences,applyUiCustomization,appearanceFromForm,updateAppearanceLabels,setAppearanceForm,preservePresetState,resetAppearanceForm,bindTextColorControls}, {
  "LIBREDISPLAY_THEMES": {configurable:true,get:()=>LIBREDISPLAY_THEMES},
  "LIBREDISPLAY_FONTS": {configurable:true,get:()=>LIBREDISPLAY_FONTS},
  "screenCareTimer": {configurable:true,get:()=>screenCareTimer,set:(value)=>{screenCareTimer=value;}},
  "screenCareLastActivity": {configurable:true,get:()=>screenCareLastActivity,set:(value)=>{screenCareLastActivity=value;}},
  "screenCareDimmed": {configurable:true,get:()=>screenCareDimmed,set:(value)=>{screenCareDimmed=value;}},
  "APPEARANCE_DEFAULTS": {configurable:true,get:()=>APPEARANCE_DEFAULTS},
  "PRESET_CONTENT_PRESERVE_KEYS": {configurable:true,get:()=>PRESET_CONTENT_PRESERVE_KEYS}
}, {globalFunctions:['applyProductTheme','selectThemeChoice','selectFontChoice','updateFontPreview','fontCssValue','measureDashboardFontProbe','applyUiCustomization','appearanceFromForm','updateAppearanceLabels','setAppearanceForm','preservePresetState','resetAppearanceForm','bindTextColorControls'],globalStates:[]});
