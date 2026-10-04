// Vector weather motion, full-screen atmosphere, seasonal accents, and preview lab.
const configApi=LibreDisplayRuntime.getModule('config');
const performanceApi=LibreDisplayRuntime.getModule('performance');
const {uiCfg}=LibreDisplayRuntime.getModule('shared');

let lastSignature='';
let weatherTestProfile='live';
let precipitationHealth={signature:'',sample:-1,progressAt:0,builtAt:0};
const EFFECT_TUNING_KEYS=['weatherRainDensity','weatherRainSize','weatherRainWidth','weatherRainSpeed','weatherRainOpacity','weatherRainAngle','weatherRainDepth','weatherRainSplash','weatherRainSplashSize','weatherRainGlow','weatherSnowDensity','weatherSnowSize','weatherSnowSpeed','weatherSnowDrift','weatherSnowOpacity','weatherSnowSpin','weatherSnowDepth','weatherFogDensity','weatherFogSpeed','weatherFogOpacity','weatherFogBlur','weatherFogLayerHeight','weatherCloudDensity','weatherCloudOpacity','weatherCloudSpeed','weatherCloudScale','weatherSunGlow','weatherSunRaySpeed','weatherLightningSize','weatherLightningFlash','weatherLightningBolts','weatherSeasonLeavesIntensity','weatherSeasonLeavesSize','weatherSeasonLeavesSpeed','weatherSeasonLeavesWind','weatherSeasonLeavesOpacity','weatherSeasonGrassIntensity','weatherSeasonGrassHeight','weatherSeasonGrassSway','weatherSeasonGrassOpacity','weatherSeasonPetalIntensity','weatherSeasonPetalSize','weatherSeasonPetalSpeed','weatherSeasonPetalOpacity','weatherSeasonBeeIntensity','weatherSeasonBeeSize','weatherSeasonBeeSpeed','weatherSeasonBeeOpacity','weatherSeasonButterflyIntensity','weatherSeasonButterflySize','weatherSeasonButterflySpeed','weatherSeasonButterflyOpacity','weatherSeasonButterflyDiversity','weatherSeasonFireflyIntensity','weatherSeasonFireflySize','weatherSeasonFireflySpeed','weatherSeasonFireflyGlow','weatherSeasonFireflyOpacity','weatherSeasonBirdIntensity','weatherSeasonBirdSize','weatherSeasonBirdSpeed','weatherSeasonBirdFlock','weatherSeasonBirdOpacity','weatherSeasonBirdHeight','weatherSeasonBirdDiversity','weatherSeasonBirdRare','weatherSeasonCrystalIntensity','weatherSeasonCrystalSize','weatherSeasonCrystalSpeed','weatherSeasonCrystalOpacity','weatherColdFrostWidth','weatherColdFrostOpacity'];
const WEATHER_TEST_PROFILES={
  drizzle:{label:'Light drizzle',weather_code:53,precipitation:1.2,cloud_cover:92,wind_speed_10m:8,wind_direction_10m:210,is_day:1},
  rain:{label:'Rain',weather_code:63,precipitation:4,cloud_cover:100,wind_speed_10m:14,wind_direction_10m:220,is_day:1},
  'heavy-rain':{label:'Heavy rain',weather_code:65,precipitation:12,cloud_cover:100,wind_speed_10m:25,wind_direction_10m:235,is_day:1},
  storm:{label:'Thunderstorm',weather_code:95,precipitation:9,cloud_cover:100,wind_speed_10m:31,wind_direction_10m:245,is_day:1},
  snow:{label:'Snow',weather_code:73,precipitation:4,cloud_cover:98,wind_speed_10m:10,wind_direction_10m:160,is_day:1},
  'heavy-snow':{label:'Heavy snow',weather_code:75,precipitation:9,cloud_cover:100,wind_speed_10m:18,wind_direction_10m:185,is_day:1},
  fog:{label:'Fog',weather_code:45,precipitation:0,cloud_cover:100,wind_speed_10m:4,wind_direction_10m:80,is_day:1},
  cloud:{label:'Cloudy',weather_code:3,precipitation:0,cloud_cover:96,wind_speed_10m:13,wind_direction_10m:265,is_day:1},
  windy:{label:'Windy clouds',weather_code:3,precipitation:0,cloud_cover:78,wind_speed_10m:38,wind_direction_10m:270,is_day:1},
  partly:{label:'Partly cloudy',weather_code:2,precipitation:0,cloud_cover:48,wind_speed_10m:9,wind_direction_10m:250,is_day:1},
  clear:{label:'Clear day',weather_code:0,precipitation:0,cloud_cover:8,wind_speed_10m:5,wind_direction_10m:180,is_day:1},
  night:{label:'Clear night',weather_code:0,precipitation:0,cloud_cover:8,wind_speed_10m:4,wind_direction_10m:180,is_day:0}
};

function wxClamp(n,lo,hi,fallback=lo){n=Number(n);return Math.min(hi,Math.max(lo,Number.isFinite(n)?n:fallback));}
function weatherVisualCondition(code){
  const c=Number(code);
  if([95,96,99].includes(c))return 'storm';
  if([71,73,75,77,85,86].includes(c))return 'snow';
  if([51,53,55,61,63,65,80,81,82].includes(c))return 'rain';
  if([45,48].includes(c))return 'fog';
  if([1,2].includes(c))return 'partly';
  if(c===3)return 'cloud';
  if(c===0)return 'clear';
  return 'none';
}
function weatherEffectCondition(code){return weatherVisualCondition(code);}
function weatherEffectSource(source){return source&&typeof source==='object'?source:uiCfg();}
function effectAllowed(condition,source){
  const mode=source.weatherEffectMode||'auto';
  const precipitation=source.weatherEffectPrecipitation!==false,clouds=source.weatherEffectClouds!==false,fog=source.weatherEffectFog!==false,sun=source.weatherEffectSun!==false,lightning=source.weatherEffectLightning!==false;
  let enabled=false;
  if(condition==='rain'||condition==='snow')enabled=precipitation||clouds;
  else if(condition==='storm')enabled=precipitation||clouds||lightning;
  else if(condition==='partly')enabled=clouds||sun;
  else if(condition==='cloud')enabled=clouds;
  else if(condition==='fog')enabled=fog;
  else if(condition==='clear')enabled=sun;
  if(mode==='precipitation')return enabled&&['rain','snow','storm'].includes(condition);
  if(mode==='ambient')return enabled&&['clear','partly','cloud','fog'].includes(condition);
  return enabled;
}
function weatherGlyphEnabled(condition,source){
  const precipitation=source.weatherEffectPrecipitation!==false,clouds=source.weatherEffectClouds!==false,fog=source.weatherEffectFog!==false,sun=source.weatherEffectSun!==false,lightning=source.weatherEffectLightning!==false;
  if(condition==='clear')return sun;
  if(condition==='partly')return sun||clouds;
  if(condition==='cloud')return clouds;
  if(condition==='rain'||condition==='snow')return precipitation||clouds;
  if(condition==='storm')return precipitation||clouds||lightning;
  if(condition==='fog')return fog;
  return false;
}
function syncWeatherGlyphVisibility(source,widgetOn){
  for(const glyph of document.querySelectorAll('.ld-weather-glyph')){
    const active=!!widgetOn&&weatherGlyphEnabled(String(glyph.dataset.weatherVisual||'none'),source);
    glyph.classList.toggle('ld-weather-glyph-active',active);
    const fallback=glyph.previousElementSibling;
    if(fallback?.classList?.contains('ld-weather-emoji-fallback'))fallback.classList.toggle('ld-weather-emoji-hidden',active);
  }
}

function liveIntensityMultiplier(condition,data){
  const current=data?.current||{},code=Number(current.weather_code),precip=Number(current.precipitation),cloud=Number(current.cloud_cover),wind=Number(current.wind_speed_10m);
  const severity={51:.62,53:.76,55:.92,61:.76,63:1,65:1.32,80:.82,81:1.08,82:1.42,71:.72,73:1,75:1.3,77:.8,85:.88,86:1.26,95:1.18,96:1.38,99:1.55}[code]||1;
  if(condition==='rain'||condition==='snow'||condition==='storm'){
    const precipBoost=Number.isFinite(precip)?wxClamp(.68+Math.sqrt(Math.max(0,precip))*.23,.68,1.45,1):1;
    const windBoost=Number.isFinite(wind)?wxClamp(.86+wind/120,.86,1.22,1):1;
    return wxClamp(severity*precipBoost*windBoost,.55,1.7,1);
  }
  if(condition==='cloud'||condition==='partly')return Number.isFinite(cloud)?wxClamp(.62+cloud/170,.62,1.18,1):1;
  if(condition==='fog')return Number.isFinite(cloud)?wxClamp(.78+cloud/240,.78,1.16,1):1;
  return 1;
}
function weatherEffectIntensityForData(condition,data,source){
  const selected=wxClamp(source.weatherEffectIntensity,10,100,50);
  return wxClamp(selected*(source.weatherEffectAutoIntensity===false?1:liveIntensityMultiplier(condition,data)),8,150,selected);
}
function particleCount(condition,intensity,constrained,source){
  if((condition==='rain'||condition==='snow'||condition==='storm')&&source.weatherEffectPrecipitation===false)return 0;if(condition==='cloud'&&source.weatherEffectClouds===false)return 0;if(condition==='partly')return 0;if(condition==='fog'&&source.weatherEffectFog===false)return 0;if(condition==='clear'&&source.weatherEffectSun===false)return 0;
  const base={rain:94,snow:64,storm:116,cloud:10,fog:18,clear:5}[condition]||0,tune=(condition==='rain'||condition==='storm')?wxClamp(source.weatherRainDensity,0,180,100)/100:condition==='snow'?wxClamp(source.weatherSnowDensity,0,180,100)/100:condition==='fog'?wxClamp(source.weatherFogDensity,0,180,115)/100:condition==='cloud'?wxClamp(source.weatherCloudDensity,0,180,100)/100:1,factor=wxClamp(Number(intensity)/100,.08,1.5,.5),limit=constrained?110:240;return Math.max(0,Math.min(limit,Math.round(base*factor*tune*(constrained?.62:1))));
}
function weatherReducedMotionActive(source){return source.weatherEffectRespectReducedMotion!==false&&document.documentElement.classList.contains('ld-reduce-motion');}
function fullscreenPauseReason(source){
  if(source.weatherEffectPauseWhenDimmed!==false&&document.body.classList.contains('ld-burnin-dim'))return 'display-dimmed';
  if(document.body.classList.contains('layout-editing')||document.body.classList.contains('remote-layout-proxy')||globalThis.LAYOUT_PREVIEW_MODE)return 'layout-preview';
  return '';
}
function effectPauseReason(source){
  if(!source?.weatherAnimationsEnabled)return 'animations-off';
  if(weatherReducedMotionActive(source))return 'reduced-motion';
  return fullscreenPauseReason(source);
}
function effectPaused(source){return !!effectPauseReason(source);}
function seededUnit(i,salt){const x=Math.sin((i+1)*12.9898+salt*78.233)*43758.5453;return x-Math.floor(x);}
function precipitationMarkup(kind,count){const cls=kind==='snow'?'ld-wx-flake':'ld-wx-drop';return Array.from({length:count},(_,i)=>`<i class="${cls}" style="--i:${i}"></i>`).join('');}
function weatherIconMarkup(code,fallback='',source=null){
  source=weatherEffectSource(source);
  const condition=weatherVisualCondition(code),safeFallback=String(fallback||''),widgetOn=!!source?.weatherAnimationsEnabled&&!!source?.weatherWidgetAnimations&&!effectPaused(source),glyphActive=widgetOn&&weatherGlyphEnabled(condition,source||{});
  const fallbackClass='ld-weather-emoji-fallback'+(glyphActive?' ld-weather-emoji-hidden':''),glyphClass='ld-weather-glyph ld-weather-'+condition+(glyphActive?' ld-weather-glyph-active':'');
  const sun=['clear','partly'].includes(condition)?'<span class="ld-wx-sun"><i></i></span>':'',cloud=['partly','cloud','rain','snow','storm'].includes(condition)?'<span class="ld-wx-cloud"><i></i><b></b></span>':'',rain=['rain','storm'].includes(condition)?`<span class="ld-wx-precip ld-wx-rain">${precipitationMarkup('rain',5)}</span>`:'',snow=condition==='snow'?`<span class="ld-wx-precip ld-wx-snow">${precipitationMarkup('snow',6)}</span>`:'',bolt=condition==='storm'?'<span class="ld-wx-bolt"></span>':'',fog=condition==='fog'?'<span class="ld-wx-fog"><i></i><i></i><i></i></span>':'',unknown=condition==='none'?'<span class="ld-wx-unknown">•</span>':'';
  return `<span class="${fallbackClass}">${safeFallback}</span><span class="${glyphClass}" data-weather-visual="${condition}" aria-hidden="true">${sun}${cloud}${rain}${snow}${bolt}${fog}${unknown}</span>`;
}
function decorateWeatherIcon(el,code,fallback='',source=null){if(!el)return;const signature=`${Number(code)}|${String(fallback||'')}`;if(el.dataset.weatherGlyphSignature===signature)return;el.dataset.weatherCode=String(Number(code));el.dataset.weatherGlyphSignature=signature;el.innerHTML=weatherIconMarkup(code,fallback,source);}
function weatherWindProfile(data,source){
  if(source.weatherEffectWind===false)return {strength:0,direction:1};
  const current=data?.current||{},configured=wxClamp(source.weatherEffectWindStrength,0,180,100)/100,live=Number(current.wind_speed_10m),degrees=Number(current.wind_direction_10m),liveBoost=source.weatherEffectAutoIntensity===false||!Number.isFinite(live)?1:wxClamp(.65+live/38,.65,1.7,1),direction=Number.isFinite(degrees)&&Math.sin(degrees*Math.PI/180)<-.05?-1:1;
  return {strength:wxClamp(configured*liveBoost,0,2.4,configured),direction};
}

function weatherSeasonContextForData(data,source,date=null){
  const mode=source.weatherSeasonMode||'auto',forced=['spring','summer','fall','winter'].includes(mode)?mode:'',lat=Number(data?.latitude??source.lat??configApi.cfg?.lat);
  if(source.weatherSeasonalEffects===false||mode==='off')return {season:'none',hemisphere:'none',climateBand:'off',latitude:Number.isFinite(lat)?lat:null,automatic:false,scale:0};
  if(!Number.isFinite(lat))return {season:forced||'none',hemisphere:'unknown',climateBand:'unknown',latitude:null,automatic:!forced,scale:forced?1:0};
  const absLat=Math.abs(lat),hemisphere=lat<0?'south':'north',climateBand=absLat<8?'equatorial':absLat<23.5?'tropical':absLat<35?'subtropical':absLat<60?'temperate':'high-latitude';
  if(forced)return {season:forced,hemisphere,climateBand,latitude:lat,automatic:false,scale:1};
  if(climateBand==='equatorial'||climateBand==='tropical')return {season:'none',hemisphere,climateBand,latitude:lat,automatic:true,scale:0};
  let month=null;if(date instanceof Date&&Number.isFinite(date.getTime()))month=date.getMonth();
  if(month===null&&typeof data?.current?.time==='string'){const match=data.current.time.match(/^\d{4}-(\d{2})-/);if(match)month=Number(match[1])-1;}
  if(month===null)month=new Date().getMonth();if(hemisphere==='south')month=(month+6)%12;
  const season=[2,3,4].includes(month)?'spring':[5,6,7].includes(month)?'summer':[8,9,10].includes(month)?'fall':'winter',temp=Number(data?.current?.temperature_2m);let scale=climateBand==='subtropical'?({spring:.82,summer:.92,fall:.62,winter:.52}[season]||1):climateBand==='high-latitude'?.92:1;
  if(season==='winter'&&climateBand==='subtropical'&&Number.isFinite(temp)){if(temp>12)scale*=.36;else if(temp>7)scale*=.62;}if(season==='fall'&&Number.isFinite(temp)&&temp>27)scale*=.58;
  return {season,hemisphere,climateBand,latitude:lat,automatic:true,scale:wxClamp(scale,.12,1,1)};
}
function weatherSeasonForData(data,source,date=null){return weatherSeasonContextForData(data,source,date).season;}
function weatherIsDay(data){const raw=Number(data?.current?.is_day);if(raw===0||raw===1)return raw===1;const m=String(data?.current?.time||'').match(/T(\d{2})/),h=m?Number(m[1]):new Date().getHours();return h>=6&&h<20;}
const WILDLIFE_COUNTRY_REGIONS={
  'north-america':new Set('US CA MX GL BM'.split(' ')),'south-america':new Set('AR BO BR CL CO EC GF GY PE PY SR UY VE'.split(' ')),
  europe:new Set('AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA'.split(' ')),
  africa:new Set('DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW'.split(' ')),
  asia:new Set('AF AM AZ BH BD BT BN KH CN GE IN ID IR IQ IL JP JO KZ KP KR KW KG LA LB MY MV MN MM NP OM PK PS PH QA SA SG LK SY TW TJ TH TL TR TM AE UZ VN YE'.split(' ')),
  australasia:new Set('AU NZ PG FJ NC SB VU WS TO'.split(' '))
};
const BIRD_SPECIES_POOLS={
  'north-america':[['sparrow',20],['cardinal',13],['blue-jay',11],['goldfinch',10],['robin',9],['chickadee',8],['hawk',4],['eagle',1.4]],
  'south-america':[['tanager',15],['hummingbird',13],['finch',12],['parakeet',10],['hornero',8],['hawk',3],['egret',2]],
  europe:[['sparrow',18],['european-robin',13],['blue-tit',11],['blackbird',10],['magpie',8],['goldfinch',8],['hawk',3],['heron',2]],
  africa:[['weaver',15],['sunbird',12],['roller',10],['hornbill',6],['finch',9],['eagle',3],['egret',3],['crane',2]],
  asia:[['tree-sparrow',15],['bulbul',12],['myna',11],['magpie',8],['kingfisher',6],['hawk',3],['egret',3],['crane',2]],
  australasia:[['lorikeet',13],['rosella',12],['australian-magpie',11],['kookaburra',8],['cockatoo',7],['finch',8],['hawk',3],['egret',2]],
  global:[['sparrow',18],['finch',14],['robin',10],['hawk',3],['egret',2]]
};
const BUTTERFLY_SPECIES_POOLS={
  'north-america':[['monarch',16],['swallowtail',13],['red-admiral',11],['painted-lady',11],['cabbage-white',8],['azure',7]],
  'south-america':[['blue-morpho',15],['heliconius',13],['swallowtail',11],['painted-lady',8],['sulphur',7]],
  europe:[['peacock',13],['red-admiral',12],['painted-lady',11],['swallowtail',9],['cabbage-white',9],['common-blue',8]],
  africa:[['swallowtail',13],['painted-lady',11],['monarch',8],['sulphur',8],['common-blue',7]],
  asia:[['swallowtail',14],['common-blue',10],['painted-lady',9],['monarch',8],['jezebel',8]],
  australasia:[['monarch',12],['swallowtail',11],['common-blue',9],['jezebel',8],['painted-lady',7]],
  global:[['painted-lady',12],['swallowtail',11],['red-admiral',9],['cabbage-white',7],['common-blue',7]]
};
function weatherEcologyRegion(data,source,context=null){
  const cc=String(source?.locationCountryCode||configApi.cfg?.locationCountryCode||'').trim().toUpperCase();for(const [region,codes] of Object.entries(WILDLIFE_COUNTRY_REGIONS))if(cc&&codes.has(cc))return region;
  context=context||weatherSeasonContextForData(data,source);const lat=Number(data?.latitude??context?.latitude??source?.lat??configApi.cfg?.lat),lon=Number(data?.longitude??source?.lon??configApi.cfg?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return 'global';
  if(lat<-10&&lon>=110&&lon<=180)return 'australasia';if(lat>5&&lon>=-170&&lon<=-50)return 'north-america';if(lat<=15&&lon>=-90&&lon<=-30)return 'south-america';if(lat>=35&&lat<=72&&lon>=-15&&lon<=45)return 'europe';if(lat>=-40&&lat<=38&&lon>=-20&&lon<=60)return 'africa';if(lat>=5&&lon>=40&&lon<=180)return 'asia';return 'global';
}
function weightedWildlifeChoice(pool,seed){const total=pool.reduce((n,item)=>n+Math.max(0,Number(item[1])||0),0);if(!total)return pool[0]?.[0]||'';let pick=seededUnit(Math.round(seed*997)+17,91)*total;for(const [id,weight] of pool){pick-=Math.max(0,Number(weight)||0);if(pick<=0)return id;}return pool[pool.length-1][0];}
function birdSpeciesPool(data,source,context=null,isDay=null){
  context=context||weatherSeasonContextForData(data,source);const region=weatherEcologyRegion(data,source,context),day=isDay===null?weatherIsDay(data):!!isDay,season=context.season,pool=(BIRD_SPECIES_POOLS[region]||BIRD_SPECIES_POOLS.global).map(v=>[...v]),diversity=wxClamp(source.weatherSeasonBirdDiversity,0,100,72)/100,rare=wxClamp(source.weatherSeasonBirdRare,0,100,30)/100;
  if(!day)return [['owl',12+10*diversity],...(region==='australasia'?[['tawny-frogmouth',5*diversity]]:region==='north-america'?[['owl',5],['nighthawk',3*diversity]]:[])];
  for(const item of pool){if(['hawk','eagle','egret','heron','crane','hornbill','cockatoo'].includes(item[0]))item[1]*=.2+rare*.9;else item[1]*=.55+diversity*.65;}
  if(['spring','fall'].includes(season))pool.push(['crane',1.2+4*rare]);if(['spring','summer'].includes(season)||['tropical','equatorial'].includes(context.climateBand))pool.push(['egret',1.2+3*rare]);if(season==='fall')pool.push(['sparrow',4],['finch',3]);return pool;
}
function birdSpeciesForIndex(i,data,source,context=null){context=context||weatherSeasonContextForData(data,source);return weightedWildlifeChoice(birdSpeciesPool(data,source,context),i+Number(data?.latitude||0)*.01+Number(data?.longitude||0)*.001);}
function butterflySpeciesPool(data,source,context=null){context=context||weatherSeasonContextForData(data,source);const region=weatherEcologyRegion(data,source,context),pool=(BUTTERFLY_SPECIES_POOLS[region]||BUTTERFLY_SPECIES_POOLS.global).map(v=>[...v]),diversity=wxClamp(source.weatherSeasonButterflyDiversity,0,100,75)/100;for(const item of pool)item[1]*=.48+diversity*.72;if(region==='north-america'&&context.season==='fall')pool.push(['monarch',10*diversity]);if(['spring','fall'].includes(context.season))pool.push(['painted-lady',4*diversity]);return pool;}
function butterflySpeciesForIndex(i,data,source,context=null){context=context||weatherSeasonContextForData(data,source);return weightedWildlifeChoice(butterflySpeciesPool(data,source,context),i+Number(data?.longitude||0)*.002);}
function birdMorphology(species){if(['hawk','eagle'].includes(species))return 'raptor';if(['crane','egret','heron'].includes(species))return 'wader';if(['owl','tawny-frogmouth','nighthawk'].includes(species))return 'nocturnal';if(['hummingbird','sunbird'].includes(species))return 'hover';if(['hornbill','cockatoo','kookaburra'].includes(species))return 'large';return 'songbird';}
function weatherWildlifeWeatherFactors(data,condition){
  const code=Number(data?.current?.weather_code),precip=Number(data?.current?.precipitation),wind=Number(data?.current?.wind_speed_10m);let insects=1,birds=1,reason='';
  if(condition==='storm'){insects=0;birds=0;reason='thunderstorm';}
  else if(condition==='snow'){insects=0;birds=([71,85].includes(code)||(Number.isFinite(precip)&&precip<=1))?.18:0;reason='snow';}
  else if(condition==='rain'){const light=[51,53,61,80].includes(code)||(Number.isFinite(precip)&&precip<=1.5),moderate=[55,63,81].includes(code)||(Number.isFinite(precip)&&precip<=4);insects=light?.05:0;birds=light?.42:moderate?.14:0;reason=light?'light precipitation':'rain';}
  else if(condition==='fog'){insects=0;birds=.08;reason='fog';}
  if(Number.isFinite(wind)){insects*=wxClamp(1-Math.max(0,wind-14)/28,0,1,1);birds*=wxClamp(1-Math.max(0,wind-26)/42,0,1,1);if(wind>=58){insects=0;birds=0;reason='strong wind';}}
  return {insects,birds,reason};
}
function visibleWildlifeCount(raw,constrained,kind){const scaled=Math.max(0,Number(raw)||0)*(constrained?(kind==='birds'?.75:.7):1);if(scaled<=.18)return 0;if(kind==='birds')return Math.max(scaled>=.62?2:1,Math.round(scaled));return Math.max(1,Math.round(scaled));}
function weatherWildlifeProfile(data,source,context,condition){
  const isDay=weatherIsDay(data),temp=Number(data?.current?.temperature_2m),humidity=Number(data?.current?.relative_humidity_2m),warm=Number.isFinite(temp)?wxClamp((temp-7)/18,0,1.15,.5):.7,humid=Number.isFinite(humidity)?wxClamp(.65+humidity/180,.65,1.2,1):1,season=context.season,band=context.climateBand,tropical=['equatorial','tropical'].includes(band),subtropical=band==='subtropical',seasonWarm=['spring','summer'].includes(season),fallMild=season==='fall'&&subtropical,weather=weatherWildlifeWeatherFactors(data,condition);
  if(source.weatherSeasonalEffects===false)return {isDay,bees:0,butterflies:0,fireflies:0,birds:0,weatherReason:'seasonal effects off'};const overall=wxClamp(source.weatherSeasonalIntensity,0,100,45)/100;
  const bees=isDay&&source.weatherSeasonBees!==false&&(tropical||seasonWarm||fallMild)&&warm>.12?6*overall*warm*wxClamp(source.weatherSeasonBeeIntensity,0,180,55)/100*weather.insects:0;
  const butterflies=isDay&&source.weatherSeasonButterflies!==false&&(tropical||seasonWarm||fallMild)&&warm>.22?5*overall*warm*wxClamp(source.weatherSeasonButterflyIntensity,0,180,50)/100*weather.insects:0;
  const fireflies=!isDay&&source.weatherSeasonFireflies!==false&&(tropical||season==='summer'||(subtropical&&['spring','fall'].includes(season)))&&warm>.18?10*overall*warm*humid*wxClamp(source.weatherSeasonFireflyIntensity,0,180,70)/100*weather.insects:0;
  const birdSeason=tropical||season!=='winter'||subtropical||(Number.isFinite(temp)&&temp>3),birdSeasonFactor=tropical?1.08:season==='spring'?1.12:season==='summer'?.88:season==='fall'?1.34:band==='high-latitude'?.22:.48,birdTune=wxClamp(source.weatherSeasonBirdIntensity,0,180,55)/100*wxClamp(source.weatherSeasonBirdFlock,0,180,60)/60,dayBirds=isDay&&source.weatherSeasonBirds!==false&&birdSeason?4*overall*birdSeasonFactor*birdTune*weather.birds:0,nightBirds=!isDay&&source.weatherSeasonBirds!==false&&birdSeason?1.35*overall*Math.max(.45,birdSeasonFactor)*birdTune*weather.birds:0,birds=isDay?dayBirds:nightBirds;
  return {isDay,bees,butterflies,fireflies,birds,weatherReason:weather.reason};
}
function seasonalEffectCounts(season,source,constrained,data=null){
  const d=data||configApi.wxData,context=weatherSeasonContextForData(d,source),factor=wxClamp(source.weatherSeasonalIntensity,0,100,45)/100*(constrained?.62:1),ground=factor*(context.automatic?context.scale:1),condition=weatherVisualCondition(d?.current?.weather_code),wild=weatherWildlifeProfile(d,source,context,condition);
  return {leaves:season==='fall'?Math.round(34*ground*wxClamp(source.weatherSeasonLeavesIntensity,0,180,100)/100):0,grass:['spring','summer'].includes(season)?Math.round(22*ground*wxClamp(source.weatherSeasonGrassIntensity,0,180,100)/100):0,petals:season==='spring'&&source.weatherSeasonPetals!==false?Math.round(24*ground*wxClamp(source.weatherSeasonPetalIntensity,0,180,80)/100):0,crystals:season==='winter'?Math.round(18*ground*wxClamp(source.weatherSeasonCrystalIntensity,0,180,70)/100):0,bees:visibleWildlifeCount(wild.bees,constrained,'bees'),butterflies:visibleWildlifeCount(wild.butterflies,constrained,'butterflies'),fireflies:visibleWildlifeCount(wild.fireflies,constrained,'fireflies'),birds:visibleWildlifeCount(wild.birds,constrained,'birds')};
}
function seasonalParticleCount(season,source,constrained,data=null){if(source.weatherSeasonalEffects===false)return 0;return Object.values(seasonalEffectCounts(season,source,constrained,data)).reduce((a,b)=>a+b,0);}
function seasonalParticleBase(i,source,wind){const p=document.createElement('span'),speed=wxClamp(source.weatherEffectSpeed,40,180,100)/100,scale=.55+seededUnit(i,34)*1.15,drift=wind.direction*(8+seededUnit(i,35)*28)*Math.max(.28,wind.strength);p.className='weather-fx-seasonal';p._ldSeasonScale=scale;p._ldSeasonDrift=drift;p.style.setProperty('--season-x',`${(seededUnit(i,31)*108-4).toFixed(2)}vw`);p.style.setProperty('--season-y',`${(seededUnit(i,32)*92+2).toFixed(2)}vh`);p.style.setProperty('--season-delay',`${(-seededUnit(i,33)*18/speed).toFixed(2)}s`);p.style.setProperty('--season-scale',scale.toFixed(2));p.style.setProperty('--season-drift',`${drift.toFixed(1)}vw`);return p;}
function appendSeasonType(frag,type,count,source,data,wind){
  const baseSpeed=wxClamp(source.weatherEffectSpeed,40,180,100)/100;for(let i=0;i<count;i++){const p=seasonalParticleBase(i+({leaves:0,grass:100,petals:200,crystals:300,bees:400,butterflies:500,fireflies:600,birds:700}[type]||0),source,wind),baseScale=p._ldSeasonScale||1;
    if(type==='leaves'){p.classList.add('weather-fx-leaf');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonLeavesSize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((5.5+seededUnit(i,40)*8)/(baseSpeed*wxClamp(source.weatherSeasonLeavesSpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-drift',`${(p._ldSeasonDrift*wxClamp(source.weatherSeasonLeavesWind,0,200,100)/100).toFixed(1)}vw`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonLeavesOpacity,0,100,100)/100));p.style.setProperty('--leaf-hue',String(Math.round(18+seededUnit(i,41)*38)));}
    else if(type==='grass'){p.classList.add('weather-fx-grass');if(weatherSeasonContextForData(data,source).season==='summer')p.classList.add('weather-fx-summer-grass');p.style.setProperty('--grass-h',`${((3+seededUnit(i,36)*7)*wxClamp(source.weatherSeasonGrassHeight,30,200,100)/100).toFixed(1)}vh`);p.style.setProperty('--grass-sway',String(wxClamp(source.weatherSeasonGrassSway,0,200,100)/100));p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonGrassOpacity,0,100,100)/100));}
    else if(type==='petals'){p.classList.add('weather-fx-petal');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonPetalSize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((8+seededUnit(i,37)*10)/(baseSpeed*wxClamp(source.weatherSeasonPetalSpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonPetalOpacity,0,100,100)/100));p.style.setProperty('--petal-hue',String(Math.round(320+seededUnit(i,38)*40)));}
    else if(type==='crystals'){p.classList.add('weather-fx-crystal');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonCrystalSize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((7+seededUnit(i,42)*10)/(baseSpeed*wxClamp(source.weatherSeasonCrystalSpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonCrystalOpacity,0,100,100)/100));}
    else if(type==='bees'){p.classList.add('weather-fx-bee');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonBeeSize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((7+seededUnit(i,61)*7)/(baseSpeed*wxClamp(source.weatherSeasonBeeSpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonBeeOpacity,0,100,100)/100));}
    else if(type==='butterflies'){const context=weatherSeasonContextForData(data,source),species=butterflySpeciesForIndex(i,data,source,context);p.classList.add('weather-fx-butterfly','weather-fx-butterfly-'+species);p.dataset.species=species;p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonButterflySize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((9+seededUnit(i,62)*9)/(baseSpeed*wxClamp(source.weatherSeasonButterflySpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonButterflyOpacity,0,100,100)/100));}
    else if(type==='fireflies'){p.classList.add('weather-fx-firefly');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonFireflySize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((5+seededUnit(i,39)*8)/(baseSpeed*wxClamp(source.weatherSeasonFireflySpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonFireflyOpacity,0,100,100)/100));p.style.setProperty('--firefly-glow',String(wxClamp(source.weatherSeasonFireflyGlow,0,200,100)/100));}
    else if(type==='birds'){const context=weatherSeasonContextForData(data,source),band=context.climateBand||'unknown',region=weatherEcologyRegion(data,source,context),species=birdSpeciesForIndex(i,data,source,context),morph=birdMorphology(species),morphScale={raptor:1.32,wader:1.34,nocturnal:1.12,hover:.72,large:1.18,songbird:1}[morph]||1,morphSpeed={raptor:.78,wader:.72,nocturnal:.82,hover:1.28,large:.8,songbird:1}[morph]||1;p.classList.add('weather-fx-bird','weather-fx-bird-'+band,'weather-fx-bird-region-'+region,'weather-fx-bird-species-'+species,'weather-fx-bird-'+morph);p.dataset.species=species;if(context.season==='fall')p.classList.add('weather-fx-bird-migrating');p.style.setProperty('--season-duration',`${((14+seededUnit(i,64)*14)/(baseSpeed*wxClamp(source.weatherSeasonBirdSpeed,30,200,100)/100*morphSpeed)).toFixed(2)}s`);p.style.setProperty('--bird-y',`${((8+seededUnit(i,65)*45)*wxClamp(source.weatherSeasonBirdHeight,35,180,100)/100).toFixed(1)}vh`);p.style.setProperty('--bird-scale',((.55+seededUnit(i,66)*.9)*wxClamp(source.weatherSeasonBirdSize,30,200,100)/100*morphScale).toFixed(2));p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonBirdOpacity,0,100,100)/100));for(const part of ['head','tail','beak','neck','legs','mark']){const detail=document.createElement('i');detail.className='weather-fx-bird-'+part;p.appendChild(detail);}}
    frag.appendChild(p);
  }
}
function appendSeasonalParticles(frag,season,source,data,wind,counts=null){counts=counts||seasonalEffectCounts(season,source,performanceApi.frontendCapabilities().constrained,data);for(const type of ['leaves','grass','petals','crystals','bees','butterflies','fireflies','birds'])if(counts[type]>0)appendSeasonType(frag,type,counts[type],source,data,wind);}
function appendWeatherParticles(frag,condition,count,source,data,wind){
  const baseSpeed=wxClamp(source.weatherEffectSpeed,40,180,100)/100,particleScale=wxClamp(source.weatherEffectParticleScale,60,160,100)/100,rain=condition==='rain'||condition==='storm',snow=condition==='snow',fog=condition==='fog',cloud=condition==='cloud';
  const familySpeed=rain?wxClamp(source.weatherRainSpeed,35,200,100)/100:snow?wxClamp(source.weatherSnowSpeed,30,180,100)/100:fog?wxClamp(source.weatherFogSpeed,20,150,80)/100:cloud?wxClamp(source.weatherCloudSpeed,20,200,100)/100:wxClamp(source.weatherSunRaySpeed,20,200,100)/100;
  for(let i=0;i<count;i++){const p=document.createElement('span'),rawDepth=seededUnit(i,7),depthTune=(rain?wxClamp(source.weatherRainDepth,0,180,100):snow?wxClamp(source.weatherSnowDepth,0,180,100):100)/100,depth=wxClamp(.68+(rawDepth-.5)*.92*depthTune,.18,1,.68),conditionScale=(rain?wxClamp(source.weatherRainSize,30,180,100):snow?wxClamp(source.weatherSnowSize,40,180,100):cloud?wxClamp(source.weatherCloudScale,40,180,100):100)/100;p.className='weather-fx-particle weather-fx-primary';p.style.setProperty('--fx-x',`${(seededUnit(i,1)*106-3).toFixed(2)}vw`);p.style.setProperty('--fx-y',`${(seededUnit(i,6)*20-14).toFixed(2)}vh`);p.style.setProperty('--fx-static-y',`${(seededUnit(i,8)*108-4).toFixed(2)}vh`);p.style.setProperty('--fx-delay',`${(-seededUnit(i,2)*16/(baseSpeed*familySpeed)).toFixed(2)}s`);const drift=wind.strength?(wind.direction*(.5+seededUnit(i,3))*(6+18*depth)*wind.strength):0;p.style.setProperty('--fx-drift',`${drift.toFixed(1)}vw`);p.style.setProperty('--fx-depth',depth.toFixed(2));p.style.setProperty('--fx-scale',((.52+seededUnit(i,5)*1.08)*particleScale*conditionScale*(.80+depth*.36)).toFixed(2));
    if(rain){const opacity=wxClamp(source.weatherRainOpacity,0,100,100)/100;p.style.setProperty('--fx-alpha',wxClamp((.42+depth*.54)*opacity,.08,1,.8).toFixed(2));p.style.setProperty('--fx-duration',`${((.58+seededUnit(i,4)*.82)/(baseSpeed*familySpeed*(.8+depth*.4))).toFixed(2)}s`);p.style.setProperty('--fx-width',`${((.7+depth*1.6)*wxClamp(source.weatherRainWidth,30,200,100)/100).toFixed(2)}px`);p.style.setProperty('--fx-length',`${((4.8+depth*6.8)*wxClamp(source.weatherRainSize,30,180,100)/100).toFixed(2)}vh`);p.style.setProperty('--fx-angle',`${(wind.direction*(6+wind.strength*7)*wxClamp(source.weatherRainAngle,0,200,100)/100).toFixed(1)}deg`);p.style.setProperty('--rain-glow-alpha',String(wxClamp(source.weatherRainGlow,0,180,100)/100));}
    else if(snow){const opacity=wxClamp(source.weatherSnowOpacity,0,100,100)/100,snowDrift=wxClamp(source.weatherSnowDrift,0,180,100)/100;p.style.setProperty('--fx-alpha',wxClamp((.42+depth*.54)*opacity,.08,1,.85).toFixed(2));p.style.setProperty('--fx-drift',`${(drift*snowDrift).toFixed(1)}vw`);p.style.setProperty('--fx-duration',`${((4.8+seededUnit(i,4)*7.4)/(baseSpeed*familySpeed*(.78+depth*.34))).toFixed(2)}s`);p.style.setProperty('--fx-blur',`${((1-depth)*1.2).toFixed(2)}px`);p.style.setProperty('--snow-spin',`${Math.round(300*wxClamp(source.weatherSnowSpin,0,200,100)/100)}deg`);}
    else{const opacity=fog?wxClamp(source.weatherFogOpacity,0,100,100)/100:cloud?wxClamp(source.weatherCloudOpacity,0,100,100)/100:wxClamp(source.weatherSunGlow,0,180,100)/100;p.style.setProperty('--fx-alpha',wxClamp((.32+depth*.42)*opacity,.04,1,.5).toFixed(2));p.style.setProperty('--fx-duration',`${((12+seededUnit(i,4)*18)/(baseSpeed*familySpeed*Math.max(.45,.78+wind.strength*.18))).toFixed(2)}s`);if(fog){p.style.setProperty('--fx-blur',`${(5*wxClamp(source.weatherFogBlur,20,200,100)/100).toFixed(1)}px`);p.style.setProperty('--fog-layer-height',`${(7*wxClamp(source.weatherFogLayerHeight,40,200,100)/100).toFixed(1)}vh`);}}
    frag.appendChild(p);
  }
  if(rain&&count>8&&source.weatherEffectPrecipitation!==false){const splashCount=Math.min(34,Math.max(0,Math.round(count*.16*wxClamp(source.weatherRainSplash,0,180,70)/100)));for(let i=0;i<splashCount;i++){const p=document.createElement('span');p.className='weather-fx-splash';p.style.setProperty('--fx-x',`${(seededUnit(i,51)*100).toFixed(2)}vw`);p.style.setProperty('--fx-delay',`${(-seededUnit(i,52)*4/baseSpeed).toFixed(2)}s`);p.style.setProperty('--fx-duration',`${(.65+seededUnit(i,53)*.8).toFixed(2)}s`);p.style.setProperty('--fx-scale',((.6+seededUnit(i,54)*1.2)*wxClamp(source.weatherRainSplashSize,30,200,100)/100).toFixed(2));frag.appendChild(p);}}
}
function buildParticles(host,condition,count,source,data,season,seasonalCounts=null){
  const wind=weatherWindProfile(data,source),frag=document.createDocumentFragment();appendWeatherParticles(frag,condition,count,source,data,wind);appendSeasonalParticles(frag,season,source,data,wind,seasonalCounts);
  if(condition==='storm'&&source.weatherEffectLightning!==false){const bolts=Math.max(0,Math.min(5,Math.round(2*wxClamp(source.weatherLightningBolts,0,180,100)/100)));for(let i=0;i<bolts;i++){const bolt=document.createElement('span');bolt.className='weather-fx-lightning-bolt';bolt.style.setProperty('--bolt-x',`${12+seededUnit(i,71)*76}vw`);bolt.style.setProperty('--bolt-delay',`${(-seededUnit(i,72)*18).toFixed(2)}s`);bolt.style.setProperty('--bolt-scale',((.7+seededUnit(i,73)*.75)*wxClamp(source.weatherLightningSize,30,200,100)/100).toFixed(2));frag.appendChild(bolt);}}
  const temp=Number(data?.current?.temperature_2m),frost=source.weatherColdFrost!==false&&Number.isFinite(temp)&&temp<=-8&&season==='winter';if(frost){const edge=document.createElement('span');edge.className='weather-fx-edge-frost';const fw=wxClamp(source.weatherColdFrostWidth,30,200,100)/100;edge.style.setProperty('--frost-alpha',String(wxClamp(source.weatherColdFrostIntensity,0,180,55)/100*wxClamp(source.weatherColdFrostOpacity,0,100,100)/100*wxClamp((-temp-5)/20,.15,1,1)));edge.style.setProperty('--frost-inner',`${(58-13*fw).toFixed(1)}%`);edge.style.setProperty('--frost-outer',`${(84-10*fw).toFixed(1)}%`);edge.style.setProperty('--frost-shadow-a',`${(38*fw).toFixed(1)}px`);edge.style.setProperty('--frost-shadow-b',`${(90*fw).toFixed(1)}px`);frag.appendChild(edge);}host.replaceChildren(frag);const precip=['rain','snow','storm'].includes(condition)&&count>0;precipitationHealth={signature:precip?`${condition}|${count}`:'',sample:-1,progressAt:Date.now(),builtAt:Date.now()};
}
function weatherTestData(data=configApi.wxData){
  const profile=WEATHER_TEST_PROFILES[weatherTestProfile];if(!profile)return data;
  const base=data&&typeof data==='object'?data:{};return {...base,latitude:Number(base.latitude??configApi.cfg?.lat),longitude:Number(base.longitude??configApi.cfg?.lon),current:{...(base.current||{}),...profile,time:new Date().toISOString().slice(0,19)}};
}
function weatherEffectTestState(){return {active:weatherTestProfile!=='live',profile:weatherTestProfile,label:WEATHER_TEST_PROFILES[weatherTestProfile]?.label||'Live weather'};}
function setWeatherEffectTestProfile(name='live'){
  weatherTestProfile=WEATHER_TEST_PROFILES[name]?name:'live';lastSignature='';
  const enabled=document.getElementById('s-weather-effect-test-mode'),select=document.getElementById('s-weather-effect-test-condition');if(enabled)enabled.checked=weatherTestProfile!=='live';if(select&&weatherTestProfile!=='live')select.value=weatherTestProfile;
  applyWeatherEffects(configApi.wxData);return weatherEffectTestState();
}
function handleWeatherEffectTestModeChange(control){const select=document.getElementById('s-weather-effect-test-condition');setWeatherEffectTestProfile(control?.checked?(select?.value||'rain'):'live');}
function weatherEffectTestProfileChanged(control){const enabled=document.getElementById('s-weather-effect-test-mode');if(enabled?.checked)setWeatherEffectTestProfile(control?.value||'rain');}
function stopWeatherEffectTest(){setWeatherEffectTestProfile('live');}
function previewWeatherTestFullScreen(){const enabled=document.getElementById('s-weather-effect-test-mode'),select=document.getElementById('s-weather-effect-test-condition');if(enabled)enabled.checked=true;setWeatherEffectTestProfile(select?.value||'rain');if(typeof globalThis.previewAppearance==='function')globalThis.previewAppearance();if(typeof globalThis.previewDashboardFromSettings==='function')globalThis.previewDashboardFromSettings();}

function weatherEffectRuntimeState(data=configApi.wxData,source=null){
  source=weatherEffectSource(source);data=weatherTestData(data);
  const condition=weatherEffectCondition(data?.current?.weather_code),widgetPauseReason=effectPauseReason(source),pauseReason=fullscreenPauseReason(source),allowed=effectAllowed(condition,source),effectiveIntensity=weatherEffectIntensityForData(condition,data,source),reducedMotion=weatherReducedMotionActive(source),seasonContext=weatherSeasonContextForData(data,source),season=seasonContext.season;
  return {source,data,condition,season,seasonContext,pauseReason,widgetPauseReason,paused:!!pauseReason,allowed,effectiveIntensity,reducedMotion,testProfile:weatherTestProfile,widgetOn:!!source.weatherAnimationsEnabled&&!!source.weatherWidgetAnimations&&!widgetPauseReason,fullOn:!!source.weatherFullscreenEffects&&!pauseReason&&allowed};
}
function weatherWildlifeStatusText(data,source,context,condition){
  if(source.weatherSeasonalEffects===false)return '';const counts=seasonalEffectCounts(context.season,source,performanceApi.frontendCapabilities().constrained,data),parts=[['bees','bee'],['butterflies','butterfly'],['fireflies','firefly'],['birds','bird']].filter(([k])=>counts[k]>0).map(([k,label])=>`${counts[k]} ${label}${counts[k]===1?'':'s'}`);if(parts.length)return ` · wildlife: ${parts.join(', ')}`;
  const profile=weatherWildlifeProfile(data,source,context,condition);if(profile.weatherReason)return ` · wildlife sheltered (${profile.weatherReason})`;return profile.isDay?' · wildlife quiet for current season / temperature':' · wildlife in nighttime cycle';
}
function weatherEffectStatusText(state,data=configApi.wxData){
  data=state.data||weatherTestData(data);const label={storm:'Thunderstorm',snow:'Snow',rain:'Rain',fog:'Fog',partly:'Partly cloudy',cloud:'Clouds',clear:'Clear sky',none:'Unknown weather'}[state.condition]||'Weather',seasonLabel={spring:'Spring',summer:'Summer',fall:'Autumn / Fall',winter:'Winter',none:'No temperate seasonal accent'}[state.season],test=state.testProfile!=='live'?`TEST: ${WEATHER_TEST_PROFILES[state.testProfile]?.label||label} · `:'',ctx=state.seasonContext||weatherSeasonContextForData(data,state.source),region=ctx.hemisphere==='south'?'Southern Hemisphere':ctx.hemisphere==='north'?'Northern Hemisphere':'location unavailable',band=String(ctx.climateBand||'').replace('-', ' ');
  if(!data?.current)return 'Waiting for current weather data.';
  const ecology=weatherEcologyRegion(data,state.source,ctx).replace('-', ' '),ecologySuffix=state.source.weatherSeasonalEffects===false?'':` · wildlife region: ${ecology}`;
  if(!state.source.weatherFullscreenEffects)return `${test}${label} detected · full-screen overlay is off.`;
  if(state.pauseReason==='display-dimmed')return `${test}${label} detected · overlay paused while display protection is dimmed.`;
  if(state.pauseReason==='layout-preview')return `${test}${label} detected · overlay paused during layout editing.`;
  if(!state.allowed)return `${test}${label} detected · current overlay mode/effect switches exclude this condition.`;
  const seasonalSuffix=(state.source.weatherSeasonalEffects===false?'':ctx.automatic&&['equatorial','tropical'].includes(ctx.climateBand)?` · ${region} · ${band} latitude — temperate seasonal accents suppressed`:state.season!=='none'?` · ${seasonLabel} accents · ${region}${band?` · ${band}`:''}`:'')+ecologySuffix,suffix=seasonalSuffix+weatherWildlifeStatusText(data,state.source,ctx,state.condition);
  if(state.reducedMotion)return `${test}${label} overlay active · reduced-motion static mode · ${Math.round(state.effectiveIntensity)}% effective intensity${suffix}.`;
  return `${test}${label} overlay active · ${Math.round(state.effectiveIntensity)}% effective intensity${suffix}.`;
}
function updateWeatherEffectStatus(state,data=configApi.wxData){const el=document.getElementById('weather-effect-live-status');if(el)el.textContent=weatherEffectStatusText(state,data);}
function applyWeatherEffects(data=configApi.wxData,source=null){
  const host=document.getElementById('weather-effects-overlay');if(!host)return;
  const state=weatherEffectRuntimeState(data,source);source=state.source;data=state.data;
  const condition=state.condition,season=state.season,constrained=performanceApi.frontendCapabilities().constrained,widgetOn=state.widgetOn,fullOn=state.fullOn;
  document.body.classList.toggle('ld-weather-widget-motion',widgetOn);document.body.classList.toggle('ld-weather-fullscreen-motion',fullOn);document.body.classList.toggle('ld-weather-no-precip',source.weatherEffectPrecipitation===false);document.body.classList.toggle('ld-weather-no-clouds',source.weatherEffectClouds===false);document.body.classList.toggle('ld-weather-no-fog',source.weatherEffectFog===false);document.body.classList.toggle('ld-weather-no-sun',source.weatherEffectSun===false);document.body.classList.toggle('ld-weather-no-wind',source.weatherEffectWind===false);document.body.classList.toggle('ld-weather-no-lightning',source.weatherEffectLightning===false);document.body.classList.toggle('ld-weather-respect-reduced-motion',source.weatherEffectRespectReducedMotion!==false);document.body.classList.toggle('ld-weather-pause-dimmed',source.weatherEffectPauseWhenDimmed!==false);document.body.classList.toggle('ld-weather-test-mode',state.testProfile!=='live');
  syncWeatherGlyphVisibility(source,widgetOn);document.body.dataset.weatherCondition=condition;document.body.dataset.weatherSeason=season;document.body.dataset.weatherSeasonRegion=state.seasonContext?.climateBand||'unknown';
  host.className='';host.classList.toggle('weather-fx-no-precip',source.weatherEffectPrecipitation===false);host.classList.toggle('weather-fx-no-clouds',source.weatherEffectClouds===false);host.classList.toggle('weather-fx-no-fog',source.weatherEffectFog===false);host.classList.toggle('weather-fx-no-sun',source.weatherEffectSun===false);host.classList.toggle('weather-fx-no-wind',source.weatherEffectWind===false);host.classList.toggle('weather-fx-no-lightning',source.weatherEffectLightning===false);
  const wind=weatherWindProfile(data,source),lightningSeconds={rare:16,normal:10,frequent:6}[source.weatherEffectLightningFrequency]||10;host.classList.toggle('weather-fx-wind-reverse',wind.direction<0);host.classList.toggle('weather-fx-static',state.reducedMotion);if(season!=='none')host.classList.add('weather-season-'+season);if(state.seasonContext?.climateBand)host.classList.add('weather-region-'+state.seasonContext.climateBand);
  host.style.setProperty('--weather-fx-opacity',String(wxClamp(source.weatherEffectOpacity,5,80,34)/100));host.style.setProperty('--weather-fx-speed',String(wxClamp(source.weatherEffectSpeed,40,180,100)/100));host.style.setProperty('--weather-fx-atmosphere',String(wxClamp(source.weatherEffectAtmosphere,0,100,55)/100));host.style.setProperty('--weather-fx-lightning-alpha',String(wxClamp(source.weatherEffectLightningBrightness,20,100,65)/100));host.style.setProperty('--weather-fx-lightning-flash',String(wxClamp(source.weatherLightningFlash,0,180,100)/100));host.style.setProperty('--weather-fx-lightning-duration',`${lightningSeconds}s`);host.style.setProperty('--weather-fog-opacity',String(wxClamp(source.weatherFogOpacity,0,100,100)/100));host.style.setProperty('--weather-cloud-opacity',String(wxClamp(source.weatherCloudOpacity,0,100,100)/100));host.style.setProperty('--weather-sun-glow',String(wxClamp(source.weatherSunGlow,0,180,100)/100));host.style.setProperty('--weather-season-intensity',String(wxClamp(source.weatherSeasonalIntensity,0,100,45)/100));host.style.setProperty('--weather-fog-strength',String(wxClamp(source.weatherFogDensity,0,180,115)/100));
  updateWeatherEffectStatus(state,data);if(!fullOn){lastSignature='';host.replaceChildren();return;}
  host.classList.add('show','weather-fx-'+condition);const count=particleCount(condition,state.effectiveIntensity,constrained,source),seasonalCounts=seasonalEffectCounts(season,source,constrained,data),seasonCount=Object.values(seasonalCounts).reduce((a,b)=>a+b,0),wildlifeSignature=['bees','butterflies','fireflies','birds'].map(k=>seasonalCounts[k]||0).join(',');
  const signature=[condition,season,state.seasonContext?.hemisphere,state.seasonContext?.climateBand,Math.round((state.seasonContext?.scale||0)*100),weatherIsDay(data)?'day':'night',count,seasonCount,wildlifeSignature,source.weatherEffectSpeed,source.weatherEffectOpacity,source.weatherEffectAtmosphere,source.weatherEffectParticleScale,source.weatherEffectWindStrength,source.weatherEffectAutoIntensity,source.weatherEffectPrecipitation,source.weatherEffectClouds,source.weatherEffectFog,source.weatherEffectSun,source.weatherEffectWind,source.weatherEffectLightning,source.weatherEffectLightningFrequency,source.weatherEffectLightningBrightness,source.weatherSeasonPetals,source.weatherSeasonBees,source.weatherSeasonButterflies,source.weatherSeasonFireflies,source.weatherSeasonBirds,source.weatherColdFrost,source.weatherColdFrostIntensity,source.weatherSeasonalEffects,source.weatherSeasonMode,source.weatherSeasonalIntensity,...EFFECT_TUNING_KEYS.map(k=>source[k]),wind.direction,Math.round(wind.strength*100),state.testProfile,constrained].join('|');
  if(signature!==lastSignature){buildParticles(host,condition,count,source,data,season,seasonalCounts);lastSignature=signature;}host.classList.toggle('weather-fx-lightning',condition==='storm'&&source.weatherEffectLightning!==false);
}
function refreshWeatherEffects(){applyWeatherEffects(configApi.wxData);}
function precipitationAnimationHealthy(host,state){if(!['rain','snow','storm'].includes(state.condition)||state.reducedMotion||document.hidden)return true;const particle=host.querySelector('.weather-fx-primary');if(!particle)return false;const now=Date.now(),animation=typeof particle.getAnimations==='function'?particle.getAnimations()[0]:null;if(animation){const sample=Number(animation.currentTime);if(Number.isFinite(sample)&&(precipitationHealth.sample<0||Math.abs(sample-precipitationHealth.sample)>2)){precipitationHealth.sample=sample;precipitationHealth.progressAt=now;}}return now-precipitationHealth.progressAt<12000&&now-precipitationHealth.builtAt<360000;}
function weatherOverlayNeedsRepair(data=configApi.wxData,source=null){const host=document.getElementById('weather-effects-overlay');if(!host)return false;const state=weatherEffectRuntimeState(data,source);if(!state.fullOn)return false;const expectedClass='weather-fx-'+state.condition,constrained=performanceApi.frontendCapabilities().constrained,count=particleCount(state.condition,state.effectiveIntensity,constrained,state.source)+seasonalParticleCount(state.season,state.source,constrained,state.data);return !host.classList.contains('show')||!host.classList.contains(expectedClass)||(count>0&&host.children.length===0)||!precipitationAnimationHealthy(host,state);}
function ensureWeatherOverlayLive(data=configApi.wxData,source=null){if(!weatherOverlayNeedsRepair(data,source))return false;lastSignature='';applyWeatherEffects(data,source);return true;}
function weatherPauseClassSignature(value=document.body.className){const names=new Set(String(value||'').split(/\s+/).filter(Boolean));return ['ld-burnin-dim','layout-editing','remote-layout-proxy'].map(name=>names.has(name)?'1':'0').join('');}
document.getElementById('weather-effects-overlay')?.addEventListener('animationiteration',event=>{if(event.target?.classList?.contains('weather-fx-primary'))precipitationHealth.progressAt=Date.now();});
const observer=new MutationObserver(records=>{if(!configApi.wxData&&weatherTestProfile==='live')return;const current=weatherPauseClassSignature();if(records.some(record=>weatherPauseClassSignature(record.oldValue)!==current))refreshWeatherEffects();});
observer.observe(document.body,{attributes:true,attributeFilter:['class'],attributeOldValue:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshWeatherEffects();ensureWeatherOverlayLive();}});setInterval(()=>ensureWeatherOverlayLive(),2500);

LibreDisplayRuntime.exposeModule('weatherEffects',{WEATHER_TEST_PROFILES,weatherVisualCondition,weatherEffectCondition,weatherEffectSource,effectAllowed,weatherGlyphEnabled,syncWeatherGlyphVisibility,liveIntensityMultiplier,weatherEffectIntensityForData,particleCount,weatherReducedMotionActive,fullscreenPauseReason,effectPauseReason,weatherIconMarkup,decorateWeatherIcon,weatherWindProfile,weatherSeasonContextForData,weatherSeasonForData,weatherIsDay,weatherEcologyRegion,birdSpeciesPool,birdSpeciesForIndex,butterflySpeciesPool,butterflySpeciesForIndex,birdMorphology,weatherWildlifeWeatherFactors,visibleWildlifeCount,weatherWildlifeProfile,seasonalEffectCounts,seasonalParticleCount,weatherTestData,weatherEffectTestState,setWeatherEffectTestProfile,handleWeatherEffectTestModeChange,weatherEffectTestProfileChanged,stopWeatherEffectTest,previewWeatherTestFullScreen,weatherEffectRuntimeState,weatherWildlifeStatusText,weatherEffectStatusText,applyWeatherEffects,refreshWeatherEffects,precipitationAnimationHealthy,weatherOverlayNeedsRepair,ensureWeatherOverlayLive,weatherPauseClassSignature},{},{globalFunctions:['handleWeatherEffectTestModeChange','weatherEffectTestProfileChanged','stopWeatherEffectTest','previewWeatherTestFullScreen'],globalStates:[]});
