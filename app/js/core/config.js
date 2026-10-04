const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;
const integrationsApi=LibreDisplayRuntime.getModule('integrations');
const {resilientFetch}=LibreDisplayRuntime.getModule('shared');
let calendarEditorRows=[];
let cfg = {
  city:'', locName:'', lat:null, lon:null,
  useFahrenheit:true,
  calendars:[],
  photosUrl:'',
  mediaFolders:[],
  mediaRecursive:true,
  backgroundSource:'google',
  stockCategory:'nature',
  stockQuery:'',
  stockResolution:'3840x2160',
  photoIntervalSec:300,
  photoOrder:'sequential',
  photoRandomStart:false,
  photoPreload:true,
  backgroundStartupPriority:true,
  backgroundStartupDelayMs:700,
  weatherRefreshMin:10,
  weatherAnimationsEnabled:false,
  weatherWidgetAnimations:true,
  weatherFullscreenEffects:false,
  weatherEffectIntensity:50,weatherEffectOpacity:34,weatherEffectSpeed:100,weatherEffectAutoIntensity:true,
  weatherEffectAtmosphere:55,weatherEffectParticleScale:100,weatherEffectWindStrength:100,weatherEffectLightningFrequency:'normal',weatherEffectLightningBrightness:65,weatherEffectMode:'auto',
  weatherEffectPrecipitation:true,weatherEffectClouds:true,weatherEffectFog:true,weatherEffectSun:true,weatherEffectWind:true,weatherEffectLightning:true,
  weatherRainDensity:100,weatherRainSize:100,weatherRainSplash:70,weatherRainWidth:100,weatherRainSpeed:100,weatherRainOpacity:100,weatherRainAngle:100,weatherRainDepth:100,weatherRainSplashSize:100,weatherRainGlow:100,weatherSnowDensity:100,weatherSnowSize:100,weatherSnowDrift:100,weatherSnowSpeed:100,weatherSnowOpacity:100,weatherSnowSpin:100,weatherSnowDepth:100,weatherFogDensity:115,weatherFogSpeed:80,weatherFogOpacity:100,weatherFogBlur:100,weatherFogLayerHeight:100,weatherCloudDensity:100,weatherCloudOpacity:100,weatherCloudSpeed:100,weatherCloudScale:100,weatherSunGlow:100,weatherSunRaySpeed:100,weatherLightningSize:100,weatherLightningFlash:100,weatherLightningBolts:100,
  weatherSeasonLeavesIntensity:100,weatherSeasonLeavesSize:100,weatherSeasonLeavesSpeed:100,weatherSeasonLeavesWind:100,weatherSeasonLeavesOpacity:100,weatherSeasonGrassIntensity:100,weatherSeasonGrassHeight:100,weatherSeasonGrassSway:100,weatherSeasonGrassOpacity:100,weatherSeasonPetals:true,weatherSeasonPetalIntensity:80,weatherSeasonPetalSize:100,weatherSeasonPetalSpeed:100,weatherSeasonPetalOpacity:100,weatherSeasonBugs:true,weatherSeasonBugIntensity:70,weatherSeasonBees:true,weatherSeasonBeeIntensity:55,weatherSeasonBeeSize:100,weatherSeasonBeeSpeed:100,weatherSeasonBeeOpacity:100,weatherSeasonButterflies:true,weatherSeasonButterflyIntensity:50,weatherSeasonButterflySize:100,weatherSeasonButterflySpeed:100,weatherSeasonButterflyOpacity:100,weatherSeasonFireflies:true,weatherSeasonFireflyIntensity:70,weatherSeasonFireflySize:100,weatherSeasonFireflySpeed:100,weatherSeasonFireflyGlow:100,weatherSeasonFireflyOpacity:100,weatherSeasonBirds:true,weatherSeasonBirdIntensity:55,weatherSeasonBirdSize:100,weatherSeasonBirdSpeed:100,weatherSeasonBirdFlock:60,weatherSeasonBirdOpacity:100,weatherSeasonBirdHeight:100,weatherSeasonCrystalIntensity:70,weatherSeasonCrystalSize:100,weatherSeasonCrystalSpeed:100,weatherSeasonCrystalOpacity:100,weatherColdFrost:true,weatherColdFrostIntensity:55,weatherColdFrostWidth:100,weatherColdFrostOpacity:100,weatherEffectRespectReducedMotion:true,weatherEffectPauseWhenDimmed:true,
  weatherSeasonalEffects:true,weatherSeasonMode:'auto',weatherSeasonalIntensity:45,
  calendarRefreshMin:15,
  calendarTimeStyle:'start',
  calendarLegend:false,
  calendarShowContinuation:true,
  calendarOrder:[],
  alertsEnabled:true,
  alertTestMode:false,
  alertCardPct:29,
  alertScrollSec:8,
  alertMotionMode:'step',
  alertMotionPx:36,
  alertRefreshMin:5,
  uiCalendarPct:100,
  uiCurrentPct:100,
  uiClockPct:100,
  uiForecastPct:100,
  uiDetailsPct:100,
  uiAlertPct:100,
  forecastGapPx:5,
  calendarMaxEvents:4,
  showNoEvents:true,
  showPrecip:true,
  timeFormat:'12',
  showSeconds:true,
  showAmPm:true,
  showDate:true,
  showCurrentIcon:true,
  bgShadeTop:52,
  bgShadeBottom:55,
  bgFit:'cover',
  bgPosition:'center',
  uiTheme:'libre-night',
  fontFamily:'Inter',
  primaryTextColor:'#ffffff',
  secondaryOpacity:88,
  textShadowPct:100,
  calendarBandHeight:150,
  bottomPanelHeight:330,
  leftPanelWidth:470,
  sidePaddingPx:28,
  forecastRowGapPx:18,
  forecastColumns:12,
  hourlyForecastHours:12,
  dailyForecastDays:12,
  calendarDays:7,
  calendarColumns:7,
  calendarCellHeight:150,
  calendarScrollMode:'off',
  calendarScrollSpeed:12,
  layoutMode:'default',
  layoutGridPx:20,
  layoutSnap:true,
  layoutBlocks:{},
  layoutContentScale:{},
  layoutElementStyle:{},
  layoutPartStyle:{},
  settingsCogPosition:'bottom-right',
  settingsCogOpacity:42,
  settingsCogSize:46,
  settingsCogLabel:true,
  customBlocks:[],
  showEventTimes:true,
  showDailyForecast:true,
  showHourlyForecast:true,
  showSunset:true,
  showWind:true,
  showHumidity:true,
  weatherDetailsOrder:['sunset','wind','humidity','sunrise','airquality','uvindex','feelslike','pressure','cloudcover','dewpoint','precipitation'],
  weatherDetailsEnabled:{sunset:true,wind:true,humidity:true,sunrise:false,airquality:false,uvindex:false,feelslike:false,pressure:false,cloudcover:false,dewpoint:false,precipitation:false},
  dateFormat:'long',
  bgBlurPx:0,
  bgTransitionSec:1.5,
  alertOpacityPct:100,
  alertMinSeverity:'all',
  alertShowExpiry:true,
  alertShowMeta:true,
  locale:'auto',
  motionPreference:'auto',
  highContrast:false,
  focusOutline:false,
  settingsUiSize:'standard',
  burnInCareEnabled:null,
  burnInIdleDimmingEnabled:null,
  burnInQuietHoursEnabled:null,
  burnInQuietWakeEnabled:true,
  burnInPauseAnimationsDimmed:true,
  burnInDimMode:'activity',
  burnInQuietStart:'22:00',
  burnInQuietEnd:'07:00',
  burnInQuietWakeMin:5,
  burnInProtection:false,
  burnInPixelShift:false,
  burnInIdleMin:30,
  burnInBrightnessPct:40,
  burnInDeepProtection:false,
  burnInDeepTrigger:null,
  burnInDeepIdleMin:180,
  burnInDeepBrightnessPct:5,
  burnInShiftMode:'always',
  burnInShiftMin:5,
  burnInShiftPx:2,
  burnInShiftTransitionSec:1.2,
  onboardingComplete:false,
  _schemaVersion:2,
  _savedAt:0
};
const CFG_DEFAULTS=JSON.parse(JSON.stringify(cfg));
let bgImages=[], bgSourceImages=[], bgIdx=0, bgLastUrl='';
let bgActiveLayerId='bg', bgPreparedIndex=null, bgPreparedUrl='', bgPreparePromise=null, bgTransitionBusy=false, bgSourceSerial=0;
let stockRecentUrls=[], stockFetchInFlight=false;
let lastBackgroundStatus={text:'',error:false,updatedAt:0};
let wxData=null;
let weatherTimer=null, calendarTimer=null, alertTimer=null, alertScrollTimer=null, alertScrollRaf=null, calendarAutoScrollTimer=null;
let alertRuntimeState=null;
let activeWeatherAlerts=[];
let alertScrollIndex=0, alertLoopHeight=0, alertLastFrame=0, alertFetchSerial=0;
let lastAlertStatus={text:'',error:false,updatedAt:0};
let serverConfigAvailable=false, serverConfigLastError='';
let remoteInfo=null, remoteConfigPollTimer=null;
const staleCacheSources=new Map();
let profileStore={version:1,updatedAt:0,activeId:'',items:[]};
let householdCache=null,householdAdminStore=null;
let sceneStore={version:1,automatic:true,baseProfiles:{},items:[]};
let sceneActive={};
let isWizardMode=false, wizardStepIndex=0;
let wizardDisplayNameDraft='',wizardDisplayNameTouched=false,wizardCreateBaseline=true,wizardBaselineCreated=false,wizardHealthRunning=false,wizardHealthRows=[],wizardHealthNotices=[],wizardRestorePointCount=null,wizardLastSaveResult=null;
const WIZARD_STEPS=[
  {key:'welcome',title:'Make LibreDisplay yours',desc:'A guided setup gets the essentials working without hiding the real controls. You can open full Settings at any time.',sections:[],skippable:false},
  {key:'display',title:'Name this display',desc:'Give this screen a clear room or purpose name so multi-display management stays understandable later.',sections:[],skippable:true},
  {key:'location',title:'Verify the weather location',desc:'Search and choose the exact city, region, and country used for forecasts, severe alerts, sunrise/sunset, and local weather data.',sections:['settings-location','settings-weather-options'],skippable:false},
  {key:'calendar',title:'Connect your calendars',desc:'Add compatible ICS calendar feeds or import local .ics files. You can skip this and add feeds later.',sections:['settings-calendars'],skippable:true},
  {key:'background',title:'Choose your photo source',desc:'Use stock images, Google Photos, local folders, mounted NAS folders, or a clean no-photo background.',sections:['settings-backgrounds'],skippable:true},
  {key:'alerts',title:'Weather alerts',desc:'Choose whether severe-weather alerts should take over the center of the display when they matter.',sections:['settings-alerts'],skippable:true},
  {key:'appearance',title:'Pick a look',desc:'Choose a LibreDisplay theme and font. Every choice remains editable later.',sections:['settings-theme'],skippable:true},
  {key:'remote',title:'Edit from another device',desc:'Optionally enable private-network remote management and pair a trusted phone or computer.',sections:['settings-remote'],skippable:true},
  {key:'backup',title:'Prepare recovery',desc:'LibreDisplay can create a private baseline restore point after setup so experimentation has an easy way back.',sections:[],skippable:true},
  {key:'review',title:'Review & save',desc:'Check the essentials before LibreDisplay saves this display and runs a real health check.',sections:[],skippable:false},
  {key:'health',title:'Final health check',desc:'LibreDisplay is checking the saved configuration, providers, recovery readiness, and local server health.',sections:[],skippable:false}
];

const BLOCK_TYPE_INFO={
  calendarview:{name:'Calendar View',icon:'▣',desc:'Add another Month, Agenda, Up Next, or Week calendar.'},
  weatherview:{name:'Weather View',icon:'☀',desc:'Add another Current, Hourly, Daily, or Details weather block.'},
  text:{name:'Text / Markdown',icon:'T',desc:'Notes, headings, instructions, and simple Markdown.'},
  countdown:{name:'Countdown / Count-up',icon:'⏱',desc:'Count down to a date or count up from one.'},
  image:{name:'Image / URL',icon:'▧',desc:'Display a logo, webcam snapshot, or image URL.'},
  qr:{name:'QR Code',icon:'▦',desc:'Turn text or a URL into a scannable QR code.'},
  shape:{name:'Shape / Divider',icon:'□',desc:'Rectangle, oval, line, or translucent panel.'},
  button:{name:'Button / Link',icon:'↗',desc:'A touch-friendly button that opens a URL.'},
  rss:{name:'RSS / News',icon:'≋',desc:'Show headlines from a public RSS or Atom feed.'},
  iframe:{name:'Web Page',icon:'⌘',desc:'Embed a web page that permits iframe display.'},
  video:{name:'YouTube / Vimeo',icon:'▶',desc:'Embed a native video block from YouTube or Vimeo.'},
  json:{name:'JSON / Data',icon:'{}',desc:'Fetch JSON or text as a value, gauge, chart, progress bar, or table.'},
  todo:{name:'Todo / Checklist',icon:'✓',desc:'A local checklist stored with this display configuration.'},
  family:{name:'Family Chores',icon:'★',desc:'Local household chores, points, rewards, and PIN-protected touch completion.'},
  scheduled:{name:'Scheduled Text',icon:'◷',desc:'Show a message only on selected days and times.'},
  daily:{name:'Daily Message / Facts',icon:'✦',desc:'Rotate a daily fact, prompt, or your own messages.'},
  airquality:{name:'Air Quality',icon:'AQ',desc:'Show current US AQI and particulate readings for your saved location.'},
  suntimes:{name:'Sunrise / Sunset',icon:'☼',desc:'Show sunrise, sunset, and daylight length.'},
  icon:{name:'Icon',icon:'★',desc:'Add a simple emoji or symbol as a movable visual element.'},
  integration:{name:'Integration',icon:'◇',desc:'Add a server-side integration plugin.'}
};
function ensureCfgDefaults(){
  if(!cfg||typeof cfg!=='object')cfg={};
  if(!Array.isArray(cfg.calendars))cfg.calendars=[];
  if(typeof cfg.useFahrenheit!=='boolean')cfg.useFahrenheit=true;
  const lat=Number(cfg.lat),lon=Number(cfg.lon);
  if(!Number.isFinite(lat)||lat<-90||lat>90)delete cfg.lat;else cfg.lat=lat;
  if(!Number.isFinite(lon)||lon<-180||lon>180)delete cfg.lon;else cfg.lon=lon;
  cfg.city=String(cfg.city||'').trim().slice(0,160);
  cfg.locName=String(cfg.locName||'').trim().slice(0,120);
  cfg.locationAdmin1=String(cfg.locationAdmin1||'').trim().slice(0,120);
  cfg.locationCountry=String(cfg.locationCountry||'').trim().slice(0,120);
  cfg.locationCountryCode=String(cfg.locationCountryCode||'').trim().toUpperCase().slice(0,2);
  cfg.locationTimezone=String(cfg.locationTimezone||'').trim().slice(0,120);
  cfg.locationGeocodeId=Number.isFinite(Number(cfg.locationGeocodeId))?Number(cfg.locationGeocodeId):null;
  if(!Number.isFinite(Number(cfg.photoIntervalSec))){
    cfg.photoIntervalSec=Number.isFinite(Number(cfg.photoIntervalMin))?Math.max(0,Number(cfg.photoIntervalMin)*60):300;
  }
  cfg.photoIntervalSec=Math.min(3600,Math.max(0,Number(cfg.photoIntervalSec)||0));
  if(typeof cfg.backgroundStartupPriority!=='boolean')cfg.backgroundStartupPriority=true;const startupDelay=Number.isFinite(Number(cfg.backgroundStartupDelayMs))?Number(cfg.backgroundStartupDelayMs):700;cfg.backgroundStartupDelayMs=Math.round(Math.min(3000,Math.max(0,startupDelay))/100)*100;
  cfg.backgroundSource=['google','folders','stock','none'].includes(cfg.backgroundSource)?cfg.backgroundSource:'google';
  if(!Array.isArray(cfg.mediaFolders))cfg.mediaFolders=[];
  cfg.mediaFolders=[...new Set(cfg.mediaFolders.map(x=>String(x||'').trim()).filter(Boolean))].slice(0,32);
  if(typeof cfg.mediaRecursive!=='boolean')cfg.mediaRecursive=true;
  cfg.stockCategory=['nature','space','animals','architecture','abstract','ocean','mountains','forest','city','beach','minimal','technology','wallpaper','custom'].includes(cfg.stockCategory)?cfg.stockCategory:'nature';
  cfg.stockQuery=String(cfg.stockQuery||'').slice(0,80);
  cfg.stockResolution=['1920x1080','2560x1440','3840x2160'].includes(cfg.stockResolution)?cfg.stockResolution:'3840x2160';
  cfg.photoOrder=['sequential','shuffle','random'].includes(cfg.photoOrder)?cfg.photoOrder:'sequential';
  if(typeof cfg.photoRandomStart!=='boolean')cfg.photoRandomStart=false;
  if(typeof cfg.photoPreload!=='boolean')cfg.photoPreload=true;
  if(!Number.isFinite(Number(cfg.weatherRefreshMin)))cfg.weatherRefreshMin=10;
  if(!Number.isFinite(Number(cfg.calendarRefreshMin)))cfg.calendarRefreshMin=15;
  cfg.calendarTimeStyle=['start','range','none'].includes(cfg.calendarTimeStyle)?cfg.calendarTimeStyle:(cfg.showEventTimes===false?'none':'start');
  if(typeof cfg.calendarLegend!=='boolean')cfg.calendarLegend=false;
  if(typeof cfg.calendarShowContinuation!=='boolean')cfg.calendarShowContinuation=true;
  if(!Array.isArray(cfg.calendarOrder))cfg.calendarOrder=[];
  if(typeof cfg.alertsEnabled!=='boolean')cfg.alertsEnabled=true;
  if(typeof cfg.alertTestMode!=='boolean')cfg.alertTestMode=false;
  cfg.alertCardPct=Math.min(33,Math.max(25,Number(cfg.alertCardPct)||29));
  cfg.alertScrollSec=Math.min(60,Math.max(3,Number(cfg.alertScrollSec)||8));
  cfg.alertMotionMode=['step','continuous','static'].includes(cfg.alertMotionMode)?cfg.alertMotionMode:'step';
  if(!cfg.alertMotionSpeedV2&&Number(cfg.alertMotionPx)===12)cfg.alertMotionPx=36;
  cfg.alertMotionSpeedV2=true;
  cfg.alertMotionPx=Math.min(120,Math.max(4,Number(cfg.alertMotionPx)||36));
  cfg.alertRefreshMin=Math.min(30,Math.max(3,Number(cfg.alertRefreshMin)||5));
  const num=(v,def)=>Number.isFinite(Number(v))?Number(v):def;
  const clampPct=(v,lo,hi,def)=>Math.min(hi,Math.max(lo,num(v,def)));
  cfg.uiCalendarPct=clampPct(cfg.uiCalendarPct,75,140,100);
  cfg.uiCurrentPct=clampPct(cfg.uiCurrentPct,75,140,100);
  cfg.uiClockPct=clampPct(cfg.uiClockPct,75,140,100);
  cfg.uiForecastPct=clampPct(cfg.uiForecastPct,75,150,100);
  cfg.uiDetailsPct=clampPct(cfg.uiDetailsPct,75,140,100);
  cfg.uiAlertPct=clampPct(cfg.uiAlertPct,75,150,100);
  cfg.forecastGapPx=Math.min(16,Math.max(0,num(cfg.forecastGapPx,5)));
  cfg.calendarMaxEvents=Math.min(6,Math.max(1,Number(cfg.calendarMaxEvents)||4));
  if(typeof cfg.showNoEvents!=='boolean')cfg.showNoEvents=true;
  if(typeof cfg.showPrecip!=='boolean')cfg.showPrecip=true;
  cfg.timeFormat=String(cfg.timeFormat)==='24'?'24':'12';
  if(typeof cfg.showSeconds!=='boolean')cfg.showSeconds=true;
  if(typeof cfg.showAmPm!=='boolean')cfg.showAmPm=true;
  if(typeof cfg.showDate!=='boolean')cfg.showDate=true;
  if(typeof cfg.showCurrentIcon!=='boolean')cfg.showCurrentIcon=true;
  cfg.bgShadeTop=Math.min(85,Math.max(0,num(cfg.bgShadeTop,52)));
  cfg.bgShadeBottom=Math.min(85,Math.max(0,num(cfg.bgShadeBottom,55)));
  cfg.bgFit=['cover','contain'].includes(cfg.bgFit)?cfg.bgFit:'cover';
  cfg.bgPosition=['center','center top','center bottom','left center','right center'].includes(cfg.bgPosition)?cfg.bgPosition:'center';
  cfg.uiTheme=['libre-night','midnight-violet','graphite','ember','deep-ocean'].includes(cfg.uiTheme)?cfg.uiTheme:'libre-night';
  cfg.fontFamily=['Inter','system','Noto Sans','DejaVu Sans','Liberation Sans','Trebuchet MS','DejaVu Serif','Georgia','monospace'].includes(cfg.fontFamily)?cfg.fontFamily:'Inter';
  cfg.primaryTextColor=/^#[0-9a-f]{6}$/i.test(cfg.primaryTextColor||'')?cfg.primaryTextColor.toLowerCase():'#ffffff';
  cfg.secondaryOpacity=Math.min(100,Math.max(45,num(cfg.secondaryOpacity,88)));
  cfg.textShadowPct=Math.min(140,Math.max(0,num(cfg.textShadowPct,100)));
  cfg.calendarBandHeight=Math.min(210,Math.max(120,num(cfg.calendarBandHeight,150)));
  cfg.bottomPanelHeight=Math.min(410,Math.max(270,num(cfg.bottomPanelHeight,330)));
  cfg.leftPanelWidth=Math.min(560,Math.max(410,num(cfg.leftPanelWidth,470)));
  cfg.sidePaddingPx=Math.min(48,Math.max(10,num(cfg.sidePaddingPx,28)));
  cfg.forecastRowGapPx=Math.min(36,Math.max(4,num(cfg.forecastRowGapPx,18)));
  cfg.forecastColumns=[6,8,10,12].includes(Number(cfg.forecastColumns))?Number(cfg.forecastColumns):12;
  cfg.hourlyForecastHours=[3,6,9,12,18,24].includes(Number(cfg.hourlyForecastHours))?Number(cfg.hourlyForecastHours):cfg.forecastColumns;
  cfg.dailyForecastDays=[3,5,7,10,12,14].includes(Number(cfg.dailyForecastDays))?Number(cfg.dailyForecastDays):Math.min(14,cfg.forecastColumns);
  cfg.calendarDays=[3,5,6,7,14,21,30,45,60].includes(Number(cfg.calendarDays))?Number(cfg.calendarDays):7;
  cfg.calendarColumns=Math.min(10,Math.max(2,Number(cfg.calendarColumns)||7));
  cfg.calendarCellHeight=Math.min(240,Math.max(90,num(cfg.calendarCellHeight,150)));
  cfg.calendarScrollMode=['off','auto'].includes(cfg.calendarScrollMode)?cfg.calendarScrollMode:'off';
  cfg.calendarScrollSpeed=Math.min(60,Math.max(2,num(cfg.calendarScrollSpeed,12)));
  cfg.layoutMode=cfg.layoutMode==='custom'?'custom':'default';
  cfg.layoutGridPx=[8,12,16,20,24,32].includes(Number(cfg.layoutGridPx))?Number(cfg.layoutGridPx):20;
  if(typeof cfg.layoutSnap!=='boolean')cfg.layoutSnap=true;
  if(!cfg.layoutBlocks||typeof cfg.layoutBlocks!=='object'||Array.isArray(cfg.layoutBlocks))cfg.layoutBlocks={};
  if(!cfg.layoutContentScale||typeof cfg.layoutContentScale!=='object'||Array.isArray(cfg.layoutContentScale))cfg.layoutContentScale={};
  for(const key of ['calendar','current','clock','details','daily','hourly','alerts'])cfg.layoutContentScale[key]=Math.min(200,Math.max(50,Number(cfg.layoutContentScale[key])||100));
  if(!cfg.layoutElementStyle||typeof cfg.layoutElementStyle!=='object'||Array.isArray(cfg.layoutElementStyle))cfg.layoutElementStyle={};
  const layoutStyleKeys=['calendar','current','clock','details','daily','hourly','alerts'];
  for(const key of layoutStyleKeys){
    const raw=(cfg.layoutElementStyle[key]&&typeof cfg.layoutElementStyle[key]==='object'&&!Array.isArray(cfg.layoutElementStyle[key]))?cfg.layoutElementStyle[key]:{};
    cfg.layoutElementStyle[key]={hAlign:['auto','left','center','right'].includes(raw.hAlign)?raw.hAlign:'auto',vAlign:['auto','top','middle','bottom'].includes(raw.vAlign)?raw.vAlign:'auto',fontFamily:['','Inter','system','Noto Sans','DejaVu Sans','Liberation Sans','Trebuchet MS','DejaVu Serif','Georgia','monospace'].includes(raw.fontFamily)?raw.fontFamily:'',textColor:/^#[0-9a-f]{6}$/i.test(raw.textColor||'')?raw.textColor.toLowerCase():'',opacity:Math.min(100,Math.max(20,Number(raw.opacity)||100))};
  }
  cfg.layoutPartStyle=normalizeBuiltInPartStyleTree(cfg.layoutPartStyle);
  cfg.settingsCogPosition=['bottom-right','bottom-left','top-right','top-left'].includes(cfg.settingsCogPosition)?cfg.settingsCogPosition:'bottom-right';
  cfg.settingsCogOpacity=Math.min(90,Math.max(10,num(cfg.settingsCogOpacity,42)));
  cfg.settingsCogSize=[36,42,46,52,58].includes(Number(cfg.settingsCogSize))?Number(cfg.settingsCogSize):46;
  if(typeof cfg.settingsCogLabel!=='boolean')cfg.settingsCogLabel=true;
  const previousWeatherBlock=cfg.layoutBlocks.weather, previousForecastBlock=cfg.layoutBlocks.forecast;
  const rectPart=(r,x,y,w,h)=>({x:Number(r.x||0)+Number(r.w||0)*x,y:Number(r.y||0)+Number(r.h||0)*y,w:Number(r.w||0)*w,h:Number(r.h||0)*h});
  if(previousWeatherBlock&&typeof previousWeatherBlock==='object'){
    if(!cfg.layoutBlocks.current)cfg.layoutBlocks.current=rectPart(previousWeatherBlock,0,0,.38,.68);
    if(!cfg.layoutBlocks.clock)cfg.layoutBlocks.clock=rectPart(previousWeatherBlock,.42,0,.58,.68);
    if(!cfg.layoutBlocks.details)cfg.layoutBlocks.details=rectPart(previousWeatherBlock,0,.72,1,.28);
  }
  if(previousForecastBlock&&typeof previousForecastBlock==='object'){
    if(!cfg.layoutBlocks.daily)cfg.layoutBlocks.daily=rectPart(previousForecastBlock,0,0,1,.46);
    if(!cfg.layoutBlocks.hourly)cfg.layoutBlocks.hourly=rectPart(previousForecastBlock,0,.56,1,.44);
  }
  delete cfg.layoutBlocks.weather;delete cfg.layoutBlocks.forecast;
  for(const key of ['calendar','current','clock','details','daily','hourly','alerts']){
    const r=cfg.layoutBlocks[key];
    if(!r||typeof r!=='object'){delete cfg.layoutBlocks[key];continue;}
    const x=Math.max(0,Math.min(1,Number(r.x)||0)), y=Math.max(0,Math.min(1,Number(r.y)||0));
    const w=Math.max(.04,Math.min(1-x,Number(r.w)||.20)), h=Math.max(.04,Math.min(1-y,Number(r.h)||.12));
    cfg.layoutBlocks[key]={x,y,w,h};
  }
  if(!Array.isArray(cfg.customBlocks))cfg.customBlocks=[];
  const allowedBlockTypes=new Set(['calendarview','weatherview','text','countdown','image','qr','shape','button','rss','iframe','video','json','todo','family','scheduled','daily','airquality','suntimes','icon','integration']);
  const seenBlockIds=new Set();
  cfg.customBlocks=cfg.customBlocks.slice(0,60).map((b,i)=>{
    if(!b||typeof b!=='object')return null;
    const type=allowedBlockTypes.has(b.type)?b.type:'text';
    let id=String(b.id||('block-'+(i+1))).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48)||('block-'+(i+1));
    while(seenBlockIds.has(id))id=id+'x';seenBlockIds.add(id);
    const r=b.rect&&typeof b.rect==='object'?b.rect:{};
    const x=Math.max(0,Math.min(.96,Number(r.x)||.30)),y=Math.max(0,Math.min(.96,Number(r.y)||.26));
    const w=Math.max(.04,Math.min(1-x,Number(r.w)||.28)),h=Math.max(.04,Math.min(1-y,Number(r.h)||.20));
    const config=(b.config&&typeof b.config==='object'&&!Array.isArray(b.config))?b.config:{};
    config._contentScale=Math.min(200,Math.max(50,Number(config._contentScale)||100));
    config._hAlign=['auto','left','center','right'].includes(config._hAlign)?config._hAlign:'auto';
    config._vAlign=['auto','top','middle','bottom'].includes(config._vAlign)?config._vAlign:'auto';
    config._fontFamily=['','Inter','system','Noto Sans','DejaVu Sans','Liberation Sans','Trebuchet MS','DejaVu Serif','Georgia','monospace'].includes(config._fontFamily)?config._fontFamily:'';
    config._textColor=/^#[0-9a-f]{6}$/i.test(config._textColor||'')?config._textColor.toLowerCase():'';
    config._opacity=Math.min(100,Math.max(20,Number(config._opacity)||100));
    config._partStyles=normalizePartStyleMap(config._partStyles,customLayoutPartDefs(type));
    if(type==='json'){
      if(!['value','gauge','progress','sparkline','line','bar','table','raw'].includes(config.visualization))config.visualization=config.raw===true?'raw':'value';
      config.raw=config.visualization==='raw';
      if(!Number.isFinite(Number(config.min)))config.min=0;if(!Number.isFinite(Number(config.max)))config.max=100;if(!Number.isFinite(Number(config.maxPoints)))config.maxPoints=30;
      if(typeof config.chartArea!=='boolean')config.chartArea=config.visualization==='sparkline';if(typeof config.chartPoints!=='boolean')config.chartPoints=config.visualization==='line';if(typeof config.chartGrid!=='boolean')config.chartGrid=config.visualization==='line'||config.visualization==='bar';
    }
    return {id,type,name:String(b.name||BLOCK_TYPE_INFO?.[type]?.name||'Block').slice(0,80),rect:{x,y,w,h},config};
  }).filter(Boolean);
  if(typeof cfg.showEventTimes!=='boolean')cfg.showEventTimes=true;
  if(typeof cfg.showDailyForecast!=='boolean')cfg.showDailyForecast=true;
  if(typeof cfg.showHourlyForecast!=='boolean')cfg.showHourlyForecast=true;
  if(typeof cfg.showSunset!=='boolean')cfg.showSunset=true;
  if(typeof cfg.showWind!=='boolean')cfg.showWind=true;
  if(typeof cfg.showHumidity!=='boolean')cfg.showHumidity=true;
  const detailKeys=['sunrise','sunset','airquality','uvindex','feelslike','humidity','wind','pressure','cloudcover','dewpoint','precipitation'];
  if(!Array.isArray(cfg.weatherDetailsOrder)){cfg.weatherDetailsOrder=['sunset','wind','humidity',...detailKeys.filter(k=>!['sunset','wind','humidity'].includes(k))];}
  cfg.weatherDetailsOrder=[...new Set(cfg.weatherDetailsOrder.filter(k=>detailKeys.includes(k)).concat(detailKeys))];
  if(!cfg.weatherDetailsEnabled||typeof cfg.weatherDetailsEnabled!=='object'||Array.isArray(cfg.weatherDetailsEnabled)){cfg.weatherDetailsEnabled={sunset:cfg.showSunset!==false,wind:cfg.showWind!==false,humidity:cfg.showHumidity!==false};}
  for(const k of detailKeys)if(typeof cfg.weatherDetailsEnabled[k]!=='boolean')cfg.weatherDetailsEnabled[k]=['sunset','wind','humidity'].includes(k)?({sunset:cfg.showSunset!==false,wind:cfg.showWind!==false,humidity:cfg.showHumidity!==false}[k]):false;
  cfg.showSunset=cfg.weatherDetailsEnabled.sunset!==false;cfg.showWind=cfg.weatherDetailsEnabled.wind!==false;cfg.showHumidity=cfg.weatherDetailsEnabled.humidity!==false;
  cfg.dateFormat=['long','short','dayFirst','numeric'].includes(cfg.dateFormat)?cfg.dateFormat:'long';
  cfg.bgBlurPx=Math.min(12,Math.max(0,num(cfg.bgBlurPx,0)));
  cfg.bgTransitionSec=Math.min(4,Math.max(0,num(cfg.bgTransitionSec,1.5)));
  cfg.alertOpacityPct=Math.min(100,Math.max(55,num(cfg.alertOpacityPct,100)));
  cfg.alertMinSeverity=['all','minor','moderate','severe','extreme'].includes(cfg.alertMinSeverity)?cfg.alertMinSeverity:'all';
  if(typeof cfg.alertShowExpiry!=='boolean')cfg.alertShowExpiry=true;
  if(typeof cfg.alertShowMeta!=='boolean')cfg.alertShowMeta=true;
  cfg.locale=['auto','en-US','en-GB','es-ES','fr-FR','de-DE'].includes(cfg.locale)?cfg.locale:'auto';
  cfg.motionPreference=['auto','full','reduced'].includes(cfg.motionPreference)?cfg.motionPreference:'auto';
  if(typeof cfg.highContrast!=='boolean')cfg.highContrast=false;
  if(typeof cfg.focusOutline!=='boolean')cfg.focusOutline=false;
  cfg.settingsUiSize=['standard','large','xlarge'].includes(cfg.settingsUiSize)?cfg.settingsUiSize:'standard';
  if(typeof cfg.weatherAnimationsEnabled!=='boolean')cfg.weatherAnimationsEnabled=false;if(typeof cfg.weatherWidgetAnimations!=='boolean')cfg.weatherWidgetAnimations=true;if(typeof cfg.weatherFullscreenEffects!=='boolean')cfg.weatherFullscreenEffects=false;if(cfg.weatherFullscreenEffects)cfg.weatherAnimationsEnabled=true;
  cfg.weatherEffectIntensity=Math.round(Math.min(100,Math.max(10,num(cfg.weatherEffectIntensity,50))));cfg.weatherEffectOpacity=Math.round(Math.min(80,Math.max(5,num(cfg.weatherEffectOpacity,34))));cfg.weatherEffectSpeed=Math.round(Math.min(180,Math.max(40,num(cfg.weatherEffectSpeed,100))));
  if(typeof cfg.weatherEffectAutoIntensity!=='boolean')cfg.weatherEffectAutoIntensity=true;cfg.weatherEffectAtmosphere=Math.round(Math.min(100,Math.max(0,num(cfg.weatherEffectAtmosphere,55))));cfg.weatherEffectParticleScale=Math.round(Math.min(160,Math.max(60,num(cfg.weatherEffectParticleScale,100))));cfg.weatherEffectWindStrength=Math.round(Math.min(180,Math.max(0,num(cfg.weatherEffectWindStrength,100))));cfg.weatherEffectLightningFrequency=['rare','normal','frequent'].includes(cfg.weatherEffectLightningFrequency)?cfg.weatherEffectLightningFrequency:'normal';cfg.weatherEffectLightningBrightness=Math.round(Math.min(100,Math.max(20,num(cfg.weatherEffectLightningBrightness,65))));cfg.weatherEffectMode=['auto','precipitation','ambient'].includes(cfg.weatherEffectMode)?cfg.weatherEffectMode:'auto';
  if(typeof cfg.weatherEffectPrecipitation!=='boolean')cfg.weatherEffectPrecipitation=true;if(typeof cfg.weatherEffectClouds!=='boolean')cfg.weatherEffectClouds=true;if(typeof cfg.weatherEffectFog!=='boolean')cfg.weatherEffectFog=true;if(typeof cfg.weatherEffectSun!=='boolean')cfg.weatherEffectSun=true;if(typeof cfg.weatherEffectWind!=='boolean')cfg.weatherEffectWind=true;if(typeof cfg.weatherEffectLightning!=='boolean')cfg.weatherEffectLightning=true;if(typeof cfg.weatherEffectRespectReducedMotion!=='boolean')cfg.weatherEffectRespectReducedMotion=true;if(typeof cfg.weatherEffectPauseWhenDimmed!=='boolean')cfg.weatherEffectPauseWhenDimmed=true;
  for(const [k,f] of [['weatherRainDensity',100],['weatherRainSize',100],['weatherRainSplash',70],['weatherRainWidth',100],['weatherRainSpeed',100],['weatherRainOpacity',100],['weatherRainAngle',100],['weatherRainDepth',100],['weatherRainSplashSize',100],['weatherRainGlow',100],['weatherSnowDensity',100],['weatherSnowSize',100],['weatherSnowDrift',100],['weatherSnowSpeed',100],['weatherSnowOpacity',100],['weatherSnowSpin',100],['weatherSnowDepth',100],['weatherFogDensity',115],['weatherFogSpeed',80],['weatherFogOpacity',100],['weatherFogBlur',100],['weatherFogLayerHeight',100],['weatherCloudDensity',100],['weatherCloudOpacity',100],['weatherCloudSpeed',100],['weatherCloudScale',100],['weatherSunGlow',100],['weatherSunRaySpeed',100],['weatherLightningSize',100],['weatherLightningFlash',100],['weatherLightningBolts',100],['weatherSeasonLeavesIntensity',100],['weatherSeasonLeavesSize',100],['weatherSeasonLeavesSpeed',100],['weatherSeasonLeavesWind',100],['weatherSeasonLeavesOpacity',100],['weatherSeasonGrassIntensity',100],['weatherSeasonGrassHeight',100],['weatherSeasonGrassSway',100],['weatherSeasonGrassOpacity',100],['weatherSeasonPetalIntensity',80],['weatherSeasonPetalSize',100],['weatherSeasonPetalSpeed',100],['weatherSeasonPetalOpacity',100],['weatherSeasonBugIntensity',70],['weatherSeasonBeeIntensity',55],['weatherSeasonBeeSize',100],['weatherSeasonBeeSpeed',100],['weatherSeasonBeeOpacity',100],['weatherSeasonButterflyIntensity',50],['weatherSeasonButterflySize',100],['weatherSeasonButterflySpeed',100],['weatherSeasonButterflyOpacity',100],['weatherSeasonFireflyIntensity',70],['weatherSeasonFireflySize',100],['weatherSeasonFireflySpeed',100],['weatherSeasonFireflyGlow',100],['weatherSeasonFireflyOpacity',100],['weatherSeasonBirdIntensity',55],['weatherSeasonBirdSize',100],['weatherSeasonBirdSpeed',100],['weatherSeasonBirdFlock',60],['weatherSeasonBirdOpacity',100],['weatherSeasonBirdHeight',100],['weatherSeasonCrystalIntensity',70],['weatherSeasonCrystalSize',100],['weatherSeasonCrystalSpeed',100],['weatherSeasonCrystalOpacity',100],['weatherColdFrostIntensity',55],['weatherColdFrostWidth',100],['weatherColdFrostOpacity',100]])cfg[k]=Math.round(Math.min(k==='weatherFogDensity'?180:200,Math.max(0,num(cfg[k],f))));if(typeof cfg.weatherSeasonPetals!=='boolean')cfg.weatherSeasonPetals=true;if(typeof cfg.weatherSeasonBugs!=='boolean')cfg.weatherSeasonBugs=true;for(const k of ['weatherSeasonBees','weatherSeasonButterflies','weatherSeasonFireflies','weatherSeasonBirds'])if(typeof cfg[k]!=='boolean')cfg[k]=cfg.weatherSeasonBugs!==false;if(typeof cfg.weatherColdFrost!=='boolean')cfg.weatherColdFrost=true;
  if(typeof cfg.weatherSeasonalEffects!=='boolean')cfg.weatherSeasonalEffects=true;cfg.weatherSeasonMode=['auto','off','spring','summer','fall','winter'].includes(cfg.weatherSeasonMode)?cfg.weatherSeasonMode:'auto';cfg.weatherSeasonalIntensity=Math.round(Math.min(100,Math.max(0,num(cfg.weatherSeasonalIntensity,45))));
  cfg.burnInDimMode=['activity','schedule'].includes(cfg.burnInDimMode)?cfg.burnInDimMode:'activity';
  if(typeof cfg.burnInIdleDimmingEnabled!=='boolean')cfg.burnInIdleDimmingEnabled=cfg.burnInDimMode!=='schedule'&&!!cfg.burnInProtection;if(typeof cfg.burnInQuietHoursEnabled!=='boolean')cfg.burnInQuietHoursEnabled=cfg.burnInDimMode==='schedule'&&!!cfg.burnInProtection;
  if(typeof cfg.burnInQuietWakeEnabled!=='boolean')cfg.burnInQuietWakeEnabled=true;if(typeof cfg.burnInPauseAnimationsDimmed!=='boolean')cfg.burnInPauseAnimationsDimmed=true;
  const normalizeClock=(value,fallback)=>{const match=String(value||'').match(/^([01]\d|2[0-3]):([0-5]\d)$/);return match?`${match[1]}:${match[2]}`:fallback;};
  cfg.burnInQuietStart=normalizeClock(cfg.burnInQuietStart,'22:00');
  cfg.burnInQuietEnd=normalizeClock(cfg.burnInQuietEnd,'07:00');
  cfg.burnInQuietWakeMin=Math.round(Math.min(30,Math.max(1,num(cfg.burnInQuietWakeMin,5))));
  if(typeof cfg.burnInProtection!=='boolean')cfg.burnInProtection=false;
  if(typeof cfg.burnInPixelShift!=='boolean')cfg.burnInPixelShift=false;
  if(typeof cfg.burnInCareEnabled!=='boolean')cfg.burnInCareEnabled=!!(cfg.burnInIdleDimmingEnabled||cfg.burnInQuietHoursEnabled||cfg.burnInDeepProtection||cfg.burnInPixelShift);
  cfg.burnInProtection=!!(cfg.burnInIdleDimmingEnabled||cfg.burnInQuietHoursEnabled); // legacy compatibility
  cfg.burnInIdleMin=Math.round(Math.min(240,Math.max(1,num(cfg.burnInIdleMin,30))));
  cfg.burnInBrightnessPct=Math.round(Math.min(90,Math.max(5,num(cfg.burnInBrightnessPct,40))));
  if(typeof cfg.burnInDeepProtection!=='boolean')cfg.burnInDeepProtection=false;
  cfg.burnInDeepTrigger=['idle','quiet'].includes(cfg.burnInDeepTrigger)?cfg.burnInDeepTrigger:(cfg.burnInDimMode==='schedule'?'quiet':'idle');
  const burnInDeepFloor=cfg.burnInIdleDimmingEnabled?cfg.burnInIdleMin:15;
  cfg.burnInDeepIdleMin=Math.round(Math.min(720,Math.max(burnInDeepFloor,Math.max(15,num(cfg.burnInDeepIdleMin,180))))/5)*5;
  cfg.burnInDeepBrightnessPct=Math.round(Math.min(cfg.burnInProtection?cfg.burnInBrightnessPct:25,Math.max(0,num(cfg.burnInDeepBrightnessPct,5))));
  cfg.burnInShiftMode=['always','idle'].includes(cfg.burnInShiftMode)?cfg.burnInShiftMode:'always';
  cfg.burnInShiftMin=Math.round(Math.min(30,Math.max(.5,num(cfg.burnInShiftMin,5)))*2)/2;
  cfg.burnInShiftPx=Math.round(Math.min(8,Math.max(1,num(cfg.burnInShiftPx,2))));
  cfg.burnInShiftTransitionSec=Math.round(Math.min(3,Math.max(0,num(cfg.burnInShiftTransitionSec,1.2)))*10)/10;
  cfg._schemaVersion=2;
  if(typeof cfg.onboardingComplete!=='boolean')cfg.onboardingComplete=!!(cfg.city&&cfg.lat&&cfg.lon);
  cfg._savedAt=Number.isFinite(Number(cfg._savedAt))?Number(cfg._savedAt):0;
  const usedCalendarIds=new Set();
  cfg.calendars=cfg.calendars.map((c,i)=>{
    let id=String(c.id||c.slotId||'').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
    if(!id)id='cal-'+(i+1);
    const baseId=id;let suffix=2;while(usedCalendarIds.has(id)){id=baseId+'-'+suffix;suffix++;}
    usedCalendarIds.add(id);
    return {...c,id,slotId:undefined,tag:undefined,enabled:c.enabled!==false,opacity:Math.min(100,Math.max(40,Number(c.opacity)||100)),color:/^#[0-9a-f]{6}$/i.test(c.color||'')?c.color:integrationsApi.DEFAULT_CAL_COLORS[i%integrationsApi.DEFAULT_CAL_COLORS.length]};
  });
  cfg.calendarOrder=(Array.isArray(cfg.calendarOrder)?cfg.calendarOrder:[]).map(id=>String(id||'')).filter(id=>usedCalendarIds.has(id));
}
async function loadCfg(){
  let localObj=null, serverObj=null;
  try{const s=localStorage.getItem(bootstrapApi.CFG_KEY);if(s)localObj=JSON.parse(s);}catch(e){}
  try{
    const res=await resilientFetch(serverPath('/api/config'),{cache:'no-store'});
    if(res.ok){
      const data=await res.json();
      serverConfigAvailable=true;serverConfigLastError='';
      if(data?.exists&&data.config&&typeof data.config==='object')serverObj=data.config;
    }
  }catch(e){serverConfigAvailable=false;serverConfigLastError=String(e?.message||e);}
  const ls=Number(localObj?._savedAt)||0, ss=Number(serverObj?._savedAt)||0;
  // The Pi/server is authoritative for every remote browser. Browser-local config is
  // only a recovery fallback when the server cannot provide a saved configuration.
  // This keeps remote displays/settings visually identical to the wall display even
  // when that browser has an older or newer localStorage snapshot.
  const serverWins=!!serverObj&&(!localObj||!bootstrapApi.LOCAL_CLIENT_MODE||ss>=ls);
  const chosen=serverWins?serverObj:localObj;
  if(chosen){cfg={...CFG_DEFAULTS,...chosen};if(serverWins)cfg._savedAt=ss;}
  ensureCfgDefaults();
  if(serverConfigAvailable&&bootstrapApi.LOCAL_CLIENT_MODE&&localObj&&(!serverObj||ls>ss))void persistCfgToServer(JSON.parse(JSON.stringify(cfg)));
}

async function persistCfgToServer(snapshot){
  try{
    const res=await resilientFetch(serverPath('/api/config'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:snapshot}),cache:'no-store'});
    if(!res.ok)throw new Error(await res.text());
    const data=await res.json().catch(()=>({}));
    serverConfigAvailable=true;serverConfigLastError='';
    updateSettingsOverview?.();
    return {ok:true,savedAt:Number(data?.savedAt||snapshot?._savedAt||0),endpoint:String(data?.endpoint||bootstrapApi.ACTIVE_ENDPOINT)};
  }catch(e){
    serverConfigLastError=String(e?.message||e);
    updateSettingsOverview?.();
    return {ok:false,error:serverConfigLastError};
  }
}

function saveCfg(){
  ensureCfgDefaults();
  cfg._savedAt=Date.now();
  try{
    const next=JSON.stringify(cfg);
    const prev=localStorage.getItem(bootstrapApi.CFG_KEY);
    if(prev&&prev!==next)localStorage.setItem(bootstrapApi.CFG_BACKUP_KEY,prev);
    localStorage.setItem(bootstrapApi.CFG_KEY,next);
  }catch(e){}
  return persistCfgToServer(JSON.parse(JSON.stringify(cfg)));
}

function normalizeProfileStore(raw){
  const out=(raw&&typeof raw==='object'&&!Array.isArray(raw))?raw:{};
  out.version=2;
  out.updatedAt=Number(out.updatedAt)||0;
  out.activeId=String(out.activeId||'');
  out.activeByEndpoint=(out.activeByEndpoint&&typeof out.activeByEndpoint==='object'&&!Array.isArray(out.activeByEndpoint))?out.activeByEndpoint:{};
  if(out.activeId&&!out.activeByEndpoint[bootstrapApi.ACTIVE_ENDPOINT])out.activeByEndpoint[bootstrapApi.ACTIVE_ENDPOINT]=out.activeId;
  out.items=Array.isArray(out.items)?out.items.filter(x=>x&&typeof x==='object'&&x.id&&x.name&&x.config).slice(0,40).map(x=>({...x,sourceEndpoint:String(x.sourceEndpoint||''),sourceDisplayName:String(x.sourceDisplayName||'')})):[];
  return out;
}
function activeProfileIdForEndpoint(endpoint=bootstrapApi.ACTIVE_ENDPOINT){return String(profileStore.activeByEndpoint?.[endpoint]||((endpoint===bootstrapApi.ACTIVE_ENDPOINT)?profileStore.activeId:'')||'');}
function setActiveProfileForEndpoint(endpoint,id){profileStore.activeByEndpoint=profileStore.activeByEndpoint||{};if(id)profileStore.activeByEndpoint[endpoint]=id;else delete profileStore.activeByEndpoint[endpoint];if(endpoint===bootstrapApi.ACTIVE_ENDPOINT)profileStore.activeId=id||'';}

async function loadProfiles(){
  let localObj=null, serverObj=null;
  try{const s=localStorage.getItem(bootstrapApi.PROFILES_KEY);if(s)localObj=normalizeProfileStore(JSON.parse(s));}catch(e){}
  try{
    const res=await resilientFetch(serverPath('/api/profiles'),{cache:'no-store'});
    if(res.ok){const data=await res.json();if(data?.exists&&data.profiles)serverObj=normalizeProfileStore(data.profiles);}
  }catch(e){}
  const ls=Number(localObj?.updatedAt)||0, ss=Number(serverObj?.updatedAt)||0;
  profileStore=normalizeProfileStore(serverObj&&(!localObj||ss>=ls)?serverObj:(localObj||{}));
  if(serverConfigAvailable&&bootstrapApi.LOCAL_CLIENT_MODE&&localObj&&(!serverObj||ls>ss))void persistProfiles();
}

async function persistProfiles(){
  profileStore.updatedAt=Date.now();
  try{localStorage.setItem(bootstrapApi.PROFILES_KEY,JSON.stringify(profileStore));}catch(e){}
  try{
    const res=await resilientFetch(serverPath('/api/profiles'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profiles:profileStore}),cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);
    return {ok:true};
  }catch(e){
    return {ok:false,error:String(e?.message||e)};
  }
}


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("config", {ensureCfgDefaults,loadCfg,persistCfgToServer,saveCfg,normalizeProfileStore,activeProfileIdForEndpoint,setActiveProfileForEndpoint,loadProfiles,persistProfiles}, {
  "calendarEditorRows": {configurable:true,get:()=>calendarEditorRows,set:(value)=>{calendarEditorRows=value;}},
  "cfg": {configurable:true,get:()=>cfg,set:(value)=>{cfg=value;}},
  "CFG_DEFAULTS": {configurable:true,get:()=>CFG_DEFAULTS},
  "bgImages": {configurable:true,get:()=>bgImages,set:(value)=>{bgImages=value;}},
  "bgSourceImages": {configurable:true,get:()=>bgSourceImages,set:(value)=>{bgSourceImages=value;}},
  "bgIdx": {configurable:true,get:()=>bgIdx,set:(value)=>{bgIdx=value;}},
  "bgLastUrl": {configurable:true,get:()=>bgLastUrl,set:(value)=>{bgLastUrl=value;}},
  "bgActiveLayerId": {configurable:true,get:()=>bgActiveLayerId,set:(value)=>{bgActiveLayerId=value;}},
  "bgPreparedIndex": {configurable:true,get:()=>bgPreparedIndex,set:(value)=>{bgPreparedIndex=value;}},
  "bgPreparedUrl": {configurable:true,get:()=>bgPreparedUrl,set:(value)=>{bgPreparedUrl=value;}},
  "bgPreparePromise": {configurable:true,get:()=>bgPreparePromise,set:(value)=>{bgPreparePromise=value;}},
  "bgTransitionBusy": {configurable:true,get:()=>bgTransitionBusy,set:(value)=>{bgTransitionBusy=value;}},
  "bgSourceSerial": {configurable:true,get:()=>bgSourceSerial,set:(value)=>{bgSourceSerial=value;}},
  "stockRecentUrls": {configurable:true,get:()=>stockRecentUrls,set:(value)=>{stockRecentUrls=value;}},
  "stockFetchInFlight": {configurable:true,get:()=>stockFetchInFlight,set:(value)=>{stockFetchInFlight=value;}},
  "lastBackgroundStatus": {configurable:true,get:()=>lastBackgroundStatus,set:(value)=>{lastBackgroundStatus=value;}},
  "wxData": {configurable:true,get:()=>wxData,set:(value)=>{wxData=value;}},
  "weatherTimer": {configurable:true,get:()=>weatherTimer,set:(value)=>{weatherTimer=value;}},
  "calendarTimer": {configurable:true,get:()=>calendarTimer,set:(value)=>{calendarTimer=value;}},
  "alertTimer": {configurable:true,get:()=>alertTimer,set:(value)=>{alertTimer=value;}},
  "alertScrollTimer": {configurable:true,get:()=>alertScrollTimer,set:(value)=>{alertScrollTimer=value;}},
  "alertScrollRaf": {configurable:true,get:()=>alertScrollRaf,set:(value)=>{alertScrollRaf=value;}},
  "calendarAutoScrollTimer": {configurable:true,get:()=>calendarAutoScrollTimer,set:(value)=>{calendarAutoScrollTimer=value;}},
  "alertRuntimeState": {configurable:true,get:()=>alertRuntimeState,set:(value)=>{alertRuntimeState=value;}},
  "activeWeatherAlerts": {configurable:true,get:()=>activeWeatherAlerts,set:(value)=>{activeWeatherAlerts=value;}},
  "alertScrollIndex": {configurable:true,get:()=>alertScrollIndex,set:(value)=>{alertScrollIndex=value;}},
  "alertLoopHeight": {configurable:true,get:()=>alertLoopHeight,set:(value)=>{alertLoopHeight=value;}},
  "alertLastFrame": {configurable:true,get:()=>alertLastFrame,set:(value)=>{alertLastFrame=value;}},
  "alertFetchSerial": {configurable:true,get:()=>alertFetchSerial,set:(value)=>{alertFetchSerial=value;}},
  "lastAlertStatus": {configurable:true,get:()=>lastAlertStatus,set:(value)=>{lastAlertStatus=value;}},
  "serverConfigAvailable": {configurable:true,get:()=>serverConfigAvailable,set:(value)=>{serverConfigAvailable=value;}},
  "serverConfigLastError": {configurable:true,get:()=>serverConfigLastError,set:(value)=>{serverConfigLastError=value;}},
  "remoteInfo": {configurable:true,get:()=>remoteInfo,set:(value)=>{remoteInfo=value;}},
  "remoteConfigPollTimer": {configurable:true,get:()=>remoteConfigPollTimer,set:(value)=>{remoteConfigPollTimer=value;}},
  "staleCacheSources": {configurable:true,get:()=>staleCacheSources},
  "profileStore": {configurable:true,get:()=>profileStore,set:(value)=>{profileStore=value;}},
  "householdCache": {configurable:true,get:()=>householdCache,set:(value)=>{householdCache=value;}},
  "householdAdminStore": {configurable:true,get:()=>householdAdminStore,set:(value)=>{householdAdminStore=value;}},
  "sceneStore": {configurable:true,get:()=>sceneStore,set:(value)=>{sceneStore=value;}},
  "sceneActive": {configurable:true,get:()=>sceneActive,set:(value)=>{sceneActive=value;}},
  "isWizardMode": {configurable:true,get:()=>isWizardMode,set:(value)=>{isWizardMode=value;}},
  "wizardStepIndex": {configurable:true,get:()=>wizardStepIndex,set:(value)=>{wizardStepIndex=value;}},
  "wizardDisplayNameDraft": {configurable:true,get:()=>wizardDisplayNameDraft,set:(value)=>{wizardDisplayNameDraft=value;}},
  "wizardDisplayNameTouched": {configurable:true,get:()=>wizardDisplayNameTouched,set:(value)=>{wizardDisplayNameTouched=value;}},
  "wizardCreateBaseline": {configurable:true,get:()=>wizardCreateBaseline,set:(value)=>{wizardCreateBaseline=value;}},
  "wizardBaselineCreated": {configurable:true,get:()=>wizardBaselineCreated,set:(value)=>{wizardBaselineCreated=value;}},
  "wizardHealthRunning": {configurable:true,get:()=>wizardHealthRunning,set:(value)=>{wizardHealthRunning=value;}},
  "wizardHealthRows": {configurable:true,get:()=>wizardHealthRows,set:(value)=>{wizardHealthRows=value;}},
  "wizardHealthNotices": {configurable:true,get:()=>wizardHealthNotices,set:(value)=>{wizardHealthNotices=value;}},
  "wizardRestorePointCount": {configurable:true,get:()=>wizardRestorePointCount,set:(value)=>{wizardRestorePointCount=value;}},
  "wizardLastSaveResult": {configurable:true,get:()=>wizardLastSaveResult,set:(value)=>{wizardLastSaveResult=value;}},
  "WIZARD_STEPS": {configurable:true,get:()=>WIZARD_STEPS},
  "BLOCK_TYPE_INFO": {configurable:true,get:()=>BLOCK_TYPE_INFO},
}, {globalFunctions:[],globalStates:['cfg','BLOCK_TYPE_INFO']});
