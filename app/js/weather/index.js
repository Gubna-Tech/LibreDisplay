// Weather clock, forecast, and detail rendering.
const configApi=LibreDisplayRuntime.getModule('config');
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');

const {uiCfg,fetchRemoteText,escHtml}=LibreDisplayRuntime.getModule('shared');

const DN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MNS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DNS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function activeLocale(){return uiCfg().locale&&uiCfg().locale!=='auto'?uiCfg().locale:(navigator.language||'en-US');}
function formatClockDate(n){
  const f=uiCfg().dateFormat||'long',locale=activeLocale();
  const opts=f==='short'?{weekday:'short',month:'short',day:'numeric'}:f==='dayFirst'?{weekday:'long',day:'numeric',month:'long'}:f==='numeric'?{year:'numeric',month:'2-digit',day:'2-digit'}:{weekday:'long',month:'long',day:'numeric'};
  try{return new Intl.DateTimeFormat(locale,opts).format(n);}catch(e){return new Intl.DateTimeFormat('en-US',opts).format(n);}
}

let clockTimer=null,clockLastHm='',clockLastExtras='',clockLastDateKey='',clockLastWide=null;
function tick(){
  const ui=uiCfg();
  const n=new Date();
  const h24=n.getHours();
  const h=ui.timeFormat==='24'?String(h24).padStart(2,'0'):String(h24%12||12);
  const m=String(n.getMinutes()).padStart(2,'0');
  const sec=String(n.getSeconds()).padStart(2,'0');
  const ap=h24>=12?'PM':'AM';
  const hm=h+':'+m;
  const hmEl=document.getElementById('clock-hm');
  if(hm!==clockLastHm){hmEl.textContent=hm;clockLastHm=hm;}
  const extras=[];
  if(ui.showSeconds)extras.push(sec);
  if(ui.timeFormat!=='24'&&ui.showAmPm)extras.push(ap);
  const extraText=extras.join(' '),secEl=document.getElementById('clock-sec');
  if(extraText!==clockLastExtras){secEl.textContent=extraText;secEl.style.display=extras.length?'':'none';clockLastExtras=extraText;}
  const wide=h.length===2;
  if(wide!==clockLastWide){document.querySelector('.clock-time')?.classList.toggle('wide-time',wide);clockLastWide=wide;}
  const dateKey=[n.getFullYear(),n.getMonth(),n.getDate(),ui.dateFormat||'long',activeLocale(),ui.showDate!==false].join('|');
  if(dateKey!==clockLastDateKey){const dateEl=document.getElementById('clock-date');dateEl.textContent=formatClockDate(n);dateEl.style.display=ui.showDate?'':'none';clockLastDateKey=dateKey;}
}
function clockTickDelay(){
  const now=Date.now(),showSeconds=uiCfg().showSeconds!==false,period=showSeconds?1000:60000;
  return Math.max(50,period-(now%period)+15);
}
function startClock(){
  if(clockTimer)clearTimeout(clockTimer);
  tick();
  clockTimer=setTimeout(startClock,clockTickDelay());
  return clockTimer;
}
startClock();

const WI={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',
  71:'🌨️',73:'❄️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌧️',82:'🌧️',
  85:'🌨️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️'};
const WD={0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Cloudy',
  45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',
  75:'Heavy snow',77:'Snow grains',80:'Showers',81:'Rain showers',82:'Violent showers',
  85:'Snow showers',86:'Heavy snow',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
const WIN={0:'🌙',1:'🌙☁️',2:'🌙☁️',51:'🌧️',53:'🌧️',80:'🌧️'};
function wi(c,isDay=true){return isDay===false?(WIN[c]||WI[c]||'🌡️'):(WI[c]||'🌡️');}
function wd(c){return WD[c]||'';}
function weatherTimeIsDay(time,daily){
  const raw=String(time||''),dayKey=raw.slice(0,10),idx=(daily?.time||[]).indexOf(dayKey),hour=Number(raw.slice(11,13));
  if(idx<0)return Number.isFinite(hour)?hour>=7&&hour<19:true;
  const rise=String(daily.sunrise?.[idx]||''),set=String(daily.sunset?.[idx]||'');if(!rise||!set)return Number.isFinite(hour)?hour>=7&&hour<19:true;
  return raw>=rise&&raw<set;
}
function C(v){return cfg.useFahrenheit?Math.round(v*9/5+32):Math.round(v);}
function u(){return cfg.useFahrenheit?'°F':'°C';}

let weatherLastError='';
let weatherLastSource='';
let weatherLastGridPoint=null;
let weatherLastAttemptAt=0;
let weatherLastSuccessAt=0;
let weatherDataLocationKey='';
let weatherFetchSerial=0;

function weatherLocationKey(source=cfg){
  const lat=Number(source?.lat),lon=Number(source?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return '';
  return `${lat.toFixed(5)}|${lon.toFixed(5)}|${String(source?.locationGeocodeId??'')}|${String(source?.locationTimezone||'')}`;
}
function weatherPayloadMatchesRequest(data,source){
  const lat=Number(source?.lat),lon=Number(source?.lon),actualLat=Number(data?.latitude),actualLon=Number(data?.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&Number.isFinite(actualLat)&&Number.isFinite(actualLon)&&Math.abs(lat-actualLat)<=1&&Math.abs(lon-actualLon)<=1;
}
function showWeatherWaitingState(message='Waiting for fresh weather…'){
  const ui=uiCfg(),locationEl=document.getElementById('wx-location'),label=String(ui.locName??cfg.locName??'').trim();
  if(locationEl){locationEl.textContent=label;locationEl.classList.toggle('show',!!label);}const set=(id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text;};
  set('wx-icon','🌡️');set('wx-temp','--°');set('wx-feels',message);set('wx-cond','Updating conditions…');
  for(const id of ['wx-details','wx-forecast','wx-hourly'])document.getElementById(id)?.replaceChildren();
  try{LibreDisplayRuntime.getModule('weatherEffects').applyWeatherEffects(null,ui);}catch(_e){}
  try{refreshCustomDataBlocks(['weatherview','suntimes']);}catch(_e){}
}
function invalidateWeatherIfLocationChanged(force=false){
  const current=weatherLocationKey(cfg);if(!force&&(!configApi.wxData||!weatherDataLocationKey||weatherDataLocationKey===current))return false;
  weatherFetchSerial++;weatherDataLocationKey='';configApi.wxData=null;weatherLastSource='';weatherLastGridPoint=null;weatherLastSuccessAt=0;showWeatherWaitingState();return true;
}
function weatherWindUnitParam(source=cfg){return source?.useFahrenheit===false?'kmh':'mph';}
function weatherWindUnitLabel(source=cfg){return source?.useFahrenheit===false?'km/h':'mph';}
function weatherWindUnitMatches(raw,source=cfg){
  const u=String(raw||'').toLowerCase().replace(/\s+/g,'');
  if(!u)return true;
  return source?.useFahrenheit===false?['km/h','kmh'].includes(u):['mph','mp/h','mi/h'].includes(u);
}
function validateWeatherPayload(d,source=cfg){
  if(!d||typeof d!=='object')throw new Error('Weather service returned an invalid response');
  if(!d.current||!d.daily||!d.hourly)throw new Error('Weather response is missing current/daily/hourly data');
  if(!Array.isArray(d.daily.time)||!Array.isArray(d.hourly.time))throw new Error('Weather response is missing forecast timelines');
  const cu=d.current_units||{};
  if(cu.temperature_2m&&String(cu.temperature_2m)!=='°C')throw new Error('Weather service returned an unexpected temperature unit');
  if(cu.precipitation&&String(cu.precipitation).toLowerCase()!=='mm')throw new Error('Weather service returned an unexpected precipitation unit');
  if(!weatherWindUnitMatches(cu.wind_speed_10m,source))throw new Error('Weather service returned an unexpected wind-speed unit');
  return d;
}

async function fetchWeather(){
  weatherLastAttemptAt=Date.now();
  if(!cfg.lat||!cfg.lon){
    weatherLastError='Location is not configured';
    invalidateWeatherIfLocationChanged(true);
    setTimeout(updateSettingsOverview,0);
    return;
  }
  if((bootstrapApi.LOCAL_CLIENT_MODE||bootstrapApi.READ_ONLY_DISPLAY_MODE)&&!configApi.serverConfigAvailable){
    weatherLastError='Waiting for saved location verification';
    invalidateWeatherIfLocationChanged(true);
    setTimeout(updateSettingsOverview,0);
    return;
  }
  invalidateWeatherIfLocationChanged();
  const source={...cfg},requestKey=weatherLocationKey(source),requestSerial=++weatherFetchSerial;
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${source.lat}&longitude=${source.lon}`
    +`&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,cloud_cover,pressure_msl,weather_code,wind_speed_10m,wind_direction_10m,is_day`
    +`&hourly=temperature_2m,weather_code,precipitation_probability`
    +`&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max`
    +`&temperature_unit=celsius&precipitation_unit=mm&wind_speed_unit=${weatherWindUnitParam(source)}`
    +`&timezone=auto&forecast_days=14`;

  try{
    const d=validateWeatherPayload(JSON.parse(await fetchRemoteText(url,(source.weatherRefreshMin||10)*60)),source);
    if(requestSerial!==weatherFetchSerial||requestKey!==weatherLocationKey(cfg))return;
    if(!weatherPayloadMatchesRequest(d,source))throw new Error('Weather response does not match the saved location');
    weatherLastError='';
    weatherLastSource='Open-Meteo · '+weatherWindUnitLabel(source);
    weatherLastGridPoint={latitude:Number(d.latitude),longitude:Number(d.longitude),elevation:Number(d.elevation),timezone:String(d.timezone||'')};
    weatherLastSuccessAt=Date.now();weatherDataLocationKey=requestKey;
    if(!document.getElementById('setup')?.classList.contains('hidden'))LibreDisplayRuntime.getModule('onboarding').renderWeatherLocationSelected();
    configApi.wxData=d;
    renderWeather(d);
  }catch(e){
    if(requestSerial!==weatherFetchSerial)return;
    weatherLastError=String(e?.message||e);
    weatherLastSource='';
    console.warn('wx error',weatherLastError);
    setTimeout(updateSettingsOverview,0);
  }
}

function renderWeather(d){
  setTimeout(updateSettingsOverview,0);
  const ui=uiCfg();
  const c=d.current, dl=d.daily, hr=d.hourly;
  const locationEl=document.getElementById('wx-location'),locationLabel=String(ui.locName??cfg.locName??'').trim();
  if(locationEl){locationEl.textContent=locationLabel;locationEl.classList.toggle('show',!!locationLabel);}
  document.getElementById('wx-temp').textContent=C(c.temperature_2m)+'°';
  const effects=LibreDisplayRuntime.getModule('weatherEffects'),currentIcon=document.getElementById('wx-icon');
  const currentIsDay=Number(c.is_day)!==0;
  effects.decorateWeatherIcon(currentIcon,c.weather_code,wi(c.weather_code,currentIsDay),ui,currentIsDay);
  currentIcon.style.display=ui.showCurrentIcon?'':'none';
  document.getElementById('wx-feels').textContent='Feels like '+C(c.apparent_temperature)+'°';
  document.getElementById('wx-cond').textContent=wd(c.weather_code);
  renderBuiltInWeatherDetails(d,ui);

  const fc=document.getElementById('wx-forecast');
  fc.innerHTML='';
  const fcDays=Math.min(Math.max(3,Number(ui.dailyForecastDays)||12),14,dl.time.length);
  for(let i=0;i<fcDays;i++){
    const dt=new Date(dl.time[i]+'T12:00:00');
    const pp=dl.precipitation_probability_max[i]||0;
    const el=document.createElement('div');
    el.className='fc-col';
    el.innerHTML=`<div class="fc-day-name">${i===0?'Today':DNS[dt.getDay()]}</div>
      <div class="fc-icon" data-weather-code="${dl.weather_code[i]}">${effects.weatherIconMarkup(dl.weather_code[i],wi(dl.weather_code[i]),ui)}</div>
      ${ui.showPrecip?`<div class="fc-rain">💧${pp}%</div>`:''}
      <div class="fc-temps"><span class="fc-hi">${C(dl.temperature_2m_max[i])}°</span> <span class="fc-lo">${C(dl.temperature_2m_min[i])}°</span></div>`;
    fc.appendChild(el);
  }

  const hrDiv=document.getElementById('wx-hourly');
  hrDiv.innerHTML='';
  const nowH=new Date();
  nowH.setMinutes(0,0,0);
  let count=0;
  for(let i=0;i<hr.time.length&&count<Math.min(24,Math.max(3,Number(ui.hourlyForecastHours)||12));i++){
    const t=new Date(hr.time[i]);
    if(t<nowH) continue;
    count++;
    const h12=t.getHours()%12||12;
    const ampm=t.getHours()<12?'am':'pm';
    const pp=hr.precipitation_probability[i]||0;
    const el=document.createElement('div');
    el.className='hr-col';
    el.innerHTML=`<div class="hr-time">${h12}${ampm}</div>
      <div class="hr-icon" data-weather-code="${hr.weather_code[i]}">${effects.weatherIconMarkup(hr.weather_code[i],wi(hr.weather_code[i],weatherTimeIsDay(hr.time[i],dl)),ui,weatherTimeIsDay(hr.time[i],dl))}</div>
      ${ui.showPrecip?`<div class="hr-rain">💧${pp}%</div>`:''}
      <div class="hr-temp">${C(hr.temperature_2m[i])}°</div>`;
    hrDiv.appendChild(el);
  }
  refreshCustomDataBlocks(['weatherview','suntimes']);
  try{effects.applyWeatherEffects(d,ui);requestAnimationFrame(()=>effects.ensureWeatherOverlayLive(d,ui));}catch(_e){}
}


const WEATHER_DETAIL_META={
  sunrise:{label:'Sunrise',icon:'🌄'},sunset:{label:'Sunset',icon:'🌅'},airquality:{label:'Air Quality',icon:'🌿'},uvindex:{label:'UV Index',icon:'☀️'},
  feelslike:{label:'Feels Like',icon:'🌡️'},humidity:{label:'Humidity',icon:'💧'},wind:{label:'Wind',icon:'💨'},pressure:{label:'Pressure',icon:'🧭'},
  cloudcover:{label:'Cloud Cover',icon:'☁️'},dewpoint:{label:'Dew Point',icon:'🌫️'},precipitation:{label:'Precipitation',icon:'🌧️'}
};
function weatherDetailsConfig(source=cfg){
  const keys=Object.keys(WEATHER_DETAIL_META),rawOrder=source.weatherDetailsOrder||source.order||[],rawEnabled=source.weatherDetailsEnabled||source.enabled||null,order=[...new Set(rawOrder.filter(k=>keys.includes(k)).concat(keys))],enabled={};
  for(const k of keys)enabled[k]=rawEnabled?.[k]===true;
  if(!rawEnabled){enabled.sunset=source.showSunset!==false;enabled.wind=source.showWind!==false;enabled.humidity=source.showHumidity!==false;}
  return {order,enabled};
}
function weatherDetailColumnCount(n){n=Math.max(0,Number(n)||0);return n<=5?Math.max(1,n):Math.min(5,Math.ceil(n/2));}
function weatherDetailValue(key,d,aqData=null){
  const c=d?.current||{},dl=d?.daily||{};
  if(key==='sunrise')return LibreDisplayRuntime.getModule('calendar').fmtTime(dl.sunrise?.[0]);
  if(key==='sunset')return LibreDisplayRuntime.getModule('calendar').fmtTime(dl.sunset?.[0]);
  if(key==='feelslike')return Number.isFinite(Number(c.apparent_temperature))?C(c.apparent_temperature)+'°':'--';
  if(key==='humidity')return Number.isFinite(Number(c.relative_humidity_2m))?Math.round(c.relative_humidity_2m)+'%':'--';
  if(key==='wind'){const dirs=['N','NE','E','SE','S','SW','W','NW'],dir=dirs[Math.round((c.wind_direction_10m||0)/45)%8];return Number.isFinite(Number(c.wind_speed_10m))?Math.round(c.wind_speed_10m)+' '+weatherWindUnitLabel(cfg)+' '+dir:'--';}
  if(key==='pressure')return Number.isFinite(Number(c.pressure_msl))?Math.round(c.pressure_msl)+' hPa':'--';
  if(key==='cloudcover')return Number.isFinite(Number(c.cloud_cover))?Math.round(c.cloud_cover)+'%':'--';
  if(key==='dewpoint')return Number.isFinite(Number(c.dew_point_2m))?C(c.dew_point_2m)+'°':'--';
  if(key==='precipitation'){const mm=Number(c.precipitation);if(!Number.isFinite(mm))return '--';return cfg.useFahrenheit?(mm/25.4).toFixed(mm/25.4<.1?2:1)+' in':mm.toFixed(mm<1?1:0)+' mm';}
  if(key==='airquality'){const aq=Number(aqData?.current?.us_aqi);if(!Number.isFinite(aq))return 'Loading…';const [label]=aqiCategory(aq);return Math.round(aq)+' · '+label;}
  if(key==='uvindex'){const uv=Number(aqData?.current?.uv_index);return Number.isFinite(uv)?uv.toFixed(1):'Loading…';}
  return '--';
}
function renderBuiltInWeatherDetails(d,source=cfg){
  const host=document.getElementById('wx-details');if(!host)return;const wc=weatherDetailsConfig(source),active=wc.order.filter(k=>wc.enabled[k]);
  host.innerHTML='';host.style.display=active.length?'grid':'none';const cols=weatherDetailColumnCount(active.length);host.style.gridTemplateColumns=`repeat(${cols},minmax(0,1fr))`;
  active.forEach((key,i)=>{const m=WEATHER_DETAIL_META[key],row=document.createElement('div');row.className='wx-detail';row.dataset.detailKey=key;const align=active.length<=3?(i===0?'flex-start':i===active.length-1?'flex-end':'center'):'center';row.style.alignItems=align;row.style.textAlign=align==='flex-start'?'left':align==='flex-end'?'right':'center';row.innerHTML=`<div class="wd-icon">${m.icon}</div><div class="wd-label">${escHtml(m.label)}</div><div class="wd-val">${escHtml(weatherDetailValue(key,d))}</div>`;host.appendChild(row);});
  if(active.some(k=>k==='airquality'||k==='uvindex'))getAirQualityData().then(aq=>{for(const key of ['airquality','uvindex']){const el=host.querySelector(`[data-detail-key="${key}"] .wd-val`);if(el)el.textContent=weatherDetailValue(key,d,aq);}}).catch(()=>{for(const key of ['airquality','uvindex']){const el=host.querySelector(`[data-detail-key="${key}"] .wd-val`);if(el)el.textContent='Unavailable';}});
}
function weatherDetailsFromForm(){
  try{const raw=JSON.parse(document.getElementById('s-weather-details-state')?.value||'{}'),base=weatherDetailsConfig(raw);return {weatherDetailsOrder:base.order,weatherDetailsEnabled:base.enabled,showSunset:base.enabled.sunset,showWind:base.enabled.wind,showHumidity:base.enabled.humidity};}catch{return {weatherDetailsOrder:[...cfg.weatherDetailsOrder],weatherDetailsEnabled:{...cfg.weatherDetailsEnabled},showSunset:cfg.showSunset,showWind:cfg.showWind,showHumidity:cfg.showHumidity};}
}
function setWeatherDetailsForm(source=cfg){const state=weatherDetailsConfig(source),hidden=document.getElementById('s-weather-details-state');if(hidden)hidden.value=JSON.stringify(state);renderWeatherDetailsSettings();}
function renderWeatherDetailsSettings(){
  const host=document.getElementById('weather-detail-settings-list'),hidden=document.getElementById('s-weather-details-state');if(!host||!hidden)return;let state;try{state=JSON.parse(hidden.value||'{}');}catch{state=weatherDetailsConfig(cfg);}state=weatherDetailsConfig(state);hidden.value=JSON.stringify(state);
  host.innerHTML=state.order.map((key,i)=>{const m=WEATHER_DETAIL_META[key];return `<div class="weather-detail-row" draggable="true" data-weather-detail="${key}" ondragstart="weatherDetailDragStart(event,'${key}')" ondragend="this.classList.remove('dragging')" ondragover="event.preventDefault()" ondrop="weatherDetailDrop(event,'${key}')"><span class="weather-detail-handle">⋮⋮</span><label><input type="checkbox" ${state.enabled[key]?'checked':''} onchange="toggleWeatherDetailSetting('${key}',this.checked)"> <span class="weather-detail-name">${m.icon} ${escHtml(m.label)}</span></label><div class="weather-detail-actions"><button type="button" title="Move up" onclick="moveWeatherDetailSetting('${key}',-1)">↑</button><button type="button" title="Move down" onclick="moveWeatherDetailSetting('${key}',1)">↓</button></div><span class="weather-detail-preview">${i+1}</span></div>`;}).join('');
}
function mutateWeatherDetails(fn){const el=document.getElementById('s-weather-details-state');if(!el)return;let state;try{state=JSON.parse(el.value||'{}');}catch{state=weatherDetailsConfig(cfg);}state=weatherDetailsConfig(state);fn(state);el.value=JSON.stringify(state);renderWeatherDetailsSettings();markSettingsDirty();previewAppearance();}
function toggleWeatherDetailSetting(key,on){mutateWeatherDetails(s=>{s.enabled[key]=!!on;});}
function moveWeatherDetailSetting(key,delta){mutateWeatherDetails(s=>{const i=s.order.indexOf(key),j=Math.max(0,Math.min(s.order.length-1,i+delta));if(i<0||i===j)return;[s.order[i],s.order[j]]=[s.order[j],s.order[i]];});}
let weatherDetailDragKey='';
function weatherDetailDragStart(e,key){weatherDetailDragKey=key;e.currentTarget?.classList.add('dragging');try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',key);}catch{}}
function weatherDetailDrop(e,target){e.preventDefault();const source=weatherDetailDragKey||e.dataTransfer?.getData('text/plain');weatherDetailDragKey='';if(!source||source===target)return;mutateWeatherDetails(s=>{const from=s.order.indexOf(source),to=s.order.indexOf(target);if(from<0||to<0)return;s.order.splice(from,1);s.order.splice(to,0,source);});}
function enableRecommendedWeatherDetails(){mutateWeatherDetails(s=>{for(const k of s.order)s.enabled[k]=['sunrise','sunset','airquality','feelslike','humidity','wind'].includes(k);});}
function enableAllWeatherDetails(){mutateWeatherDetails(s=>{for(const k of s.order)s.enabled[k]=true;});}
function resetWeatherDetails(){mutateWeatherDetails(s=>{s.order=['sunset','wind','humidity',...Object.keys(WEATHER_DETAIL_META).filter(k=>!['sunset','wind','humidity'].includes(k))];for(const k of s.order)s.enabled[k]=['sunset','wind','humidity'].includes(k);});}


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("weather", {activeLocale,formatClockDate,tick,clockTickDelay,startClock,wi,wd,C,u,weatherLocationKey,weatherPayloadMatchesRequest,showWeatherWaitingState,invalidateWeatherIfLocationChanged,weatherWindUnitParam,weatherWindUnitLabel,weatherWindUnitMatches,validateWeatherPayload,fetchWeather,renderWeather,weatherDetailsConfig,weatherDetailColumnCount,weatherDetailValue,renderBuiltInWeatherDetails,weatherDetailsFromForm,setWeatherDetailsForm,renderWeatherDetailsSettings,mutateWeatherDetails,toggleWeatherDetailSetting,moveWeatherDetailSetting,weatherDetailDragStart,weatherDetailDrop,enableRecommendedWeatherDetails,enableAllWeatherDetails,resetWeatherDetails}, {
  "DN": {configurable:true,get:()=>DN},
  "MN": {configurable:true,get:()=>MN},
  "MNS": {configurable:true,get:()=>MNS},
  "DNS": {configurable:true,get:()=>DNS},
  "WI": {configurable:true,get:()=>WI},
  "WD": {configurable:true,get:()=>WD},
  "weatherLastError": {configurable:true,get:()=>weatherLastError,set:(value)=>{weatherLastError=value;}},
  "weatherLastSource": {configurable:true,get:()=>weatherLastSource,set:(value)=>{weatherLastSource=value;}},
  "weatherLastGridPoint": {configurable:true,get:()=>weatherLastGridPoint,set:(value)=>{weatherLastGridPoint=value;}},
  "weatherLastAttemptAt": {configurable:true,get:()=>weatherLastAttemptAt,set:(value)=>{weatherLastAttemptAt=value;}},
  "weatherLastSuccessAt": {configurable:true,get:()=>weatherLastSuccessAt,set:(value)=>{weatherLastSuccessAt=value;}},
  "weatherDataLocationKey": {configurable:true,get:()=>weatherDataLocationKey,set:(value)=>{weatherDataLocationKey=String(value||'');}},
  "weatherFetchSerial": {configurable:true,get:()=>weatherFetchSerial,set:(value)=>{weatherFetchSerial=Number(value)||0;}},
  "WEATHER_DETAIL_META": {configurable:true,get:()=>WEATHER_DETAIL_META},
  "weatherDetailDragKey": {configurable:true,get:()=>weatherDetailDragKey,set:(value)=>{weatherDetailDragKey=value;}}
}, {globalFunctions:['toggleWeatherDetailSetting','moveWeatherDetailSetting','weatherDetailDragStart','weatherDetailDrop','enableRecommendedWeatherDetails','enableAllWeatherDetails','resetWeatherDetails'],globalStates:[]});
