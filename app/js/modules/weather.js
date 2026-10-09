// LibreDisplay source section: /js/weather/index.js
{
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
const MOON_PHASE_NORTH=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
const MOON_PHASE_SOUTH=['🌑','🌘','🌗','🌖','🌕','🌔','🌓','🌒'];
function weatherLocalDateParts(time){const m=String(time||'').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);return m?{year:Number(m[1]),month:Number(m[2]),day:Number(m[3]),hour:Number(m[4]||12),minute:Number(m[5]||0)}:null;}
function lunarPhaseIndex(time,utcOffsetSeconds=0){const p=weatherLocalDateParts(time),offset=Number(utcOffsetSeconds)||0,date=p?new Date(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)-offset*1000):new Date(),synodic=29.530588853,knownNewMoon=Date.UTC(2000,0,6,18,14),age=((date.getTime()-knownNewMoon)/86400000%synodic+synodic)%synodic;return Math.floor((age/synodic*8)+.5)%8;}
function moonPhaseEmoji(time,latitude=cfg.lat,utcOffsetSeconds=0){const lat=Number(latitude),south=Number.isFinite(lat)&&lat<0;return (south?MOON_PHASE_SOUTH:MOON_PHASE_NORTH)[lunarPhaseIndex(time,utcOffsetSeconds)]||'🌙';}

function wi(c,isDay=true,time='',latitude=cfg.lat,utcOffsetSeconds=0){if(isDay!==false)return WI[c]||'🌡️';const moon=moonPhaseEmoji(time,latitude,utcOffsetSeconds);if(Number(c)===0)return moon;if([1,2].includes(Number(c)))return moon+'☁️';return WIN[c]||WI[c]||'🌡️';}
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

const forecastRenderState={daily:{signature:'',calls:0,renders:0,skips:0,totalMs:0,maxMs:0,lastMs:0,lastAt:0,cells:0},hourly:{signature:'',calls:0,renders:0,skips:0,totalMs:0,maxMs:0,lastMs:0,lastAt:0,cells:0}};
function forecastRenderSnapshot(){return Object.fromEntries(Object.entries(forecastRenderState).map(([key,row])=>[key,{calls:row.calls,renders:row.renders,skips:row.skips,totalMs:Number(row.totalMs.toFixed(1)),maxMs:Number(row.maxMs.toFixed(1)),lastMs:Number(row.lastMs.toFixed(1)),lastAt:row.lastAt,cells:row.cells}]));}
function updateForecastRegion(key,host,signature,build){
  const state=forecastRenderState[key];state.calls++;
  if(!host)return false;
  if(state.signature===signature&&host.childElementCount){state.skips++;return false;}
  const started=performance.now(),frag=document.createDocumentFragment(),cells=build(frag)||0;host.replaceChildren(frag);
  const elapsed=performance.now()-started;state.signature=signature;state.renders++;state.totalMs+=elapsed;state.maxMs=Math.max(state.maxMs,elapsed);state.lastMs=elapsed;state.lastAt=Date.now();state.cells=cells;return true;
}
function dailyForecastSignature(dl,ui,count){return JSON.stringify([count,!!ui.showPrecip,!!ui.weatherAnimationsEnabled,!!ui.weatherWidgetAnimations,...dl.time.slice(0,count),...dl.weather_code.slice(0,count),...dl.temperature_2m_max.slice(0,count),...dl.temperature_2m_min.slice(0,count),...(dl.precipitation_probability_max||[]).slice(0,count)]);}
function hourlyForecastRows(d,dl,hr,ui){
  const rows=[],nowH=new Date();nowH.setMinutes(0,0,0);const limit=Math.min(24,Math.max(3,Number(ui.hourlyForecastHours)||12));
  for(let i=0;i<hr.time.length&&rows.length<limit;i++){const t=new Date(hr.time[i]);if(t<nowH)continue;rows.push({i,t,isDay:weatherTimeIsDay(hr.time[i],dl)});}return rows;
}
function hourlyForecastSignature(d,dl,hr,ui,rows){return JSON.stringify([rows.map(row=>row.i),!!ui.showPrecip,!!ui.weatherAnimationsEnabled,!!ui.weatherWidgetAnimations,Number(d.latitude)||0,Number(d.utc_offset_seconds)||0,...(dl.sunrise||[]),...(dl.sunset||[]),...rows.flatMap(row=>[hr.time[row.i],hr.weather_code[row.i],hr.temperature_2m[row.i],(hr.precipitation_probability||[])[row.i]])]);}

function renderWeather(d){
  setTimeout(updateSettingsOverview,0);
  const ui=uiCfg();
  const c=d.current, dl=d.daily, hr=d.hourly;
  const locationEl=document.getElementById('wx-location'),locationLabel=String(ui.locName??cfg.locName??'').trim();
  if(locationEl){locationEl.textContent=locationLabel;locationEl.classList.toggle('show',!!locationLabel);}
  document.getElementById('wx-temp').textContent=C(c.temperature_2m)+'°';
  const effects=LibreDisplayRuntime.getModule('weatherEffects'),currentIcon=document.getElementById('wx-icon');
  const currentIsDay=Number(c.is_day)!==0;
  effects.decorateWeatherIcon(currentIcon,c.weather_code,wi(c.weather_code,currentIsDay,c.time,d.latitude??ui.lat,d.utc_offset_seconds??0),ui,currentIsDay);
  currentIcon.style.display=ui.showCurrentIcon?'':'none';
  document.getElementById('wx-feels').textContent='Feels like '+C(c.apparent_temperature)+'°';
  document.getElementById('wx-cond').textContent=wd(c.weather_code);
  renderBuiltInWeatherDetails(d,ui);

  const fc=document.getElementById('wx-forecast'),fcDays=Math.min(Math.max(3,Number(ui.dailyForecastDays)||12),14,dl.time.length);
  updateForecastRegion('daily',fc,dailyForecastSignature(dl,ui,fcDays),frag=>{
    for(let i=0;i<fcDays;i++){
      const dt=new Date(dl.time[i]+'T12:00:00'),pp=dl.precipitation_probability_max[i]||0,el=document.createElement('div');el.className='fc-col';
      el.innerHTML=`<div class="fc-day-name">${i===0?'Today':DNS[dt.getDay()]}</div><div class="fc-icon" data-weather-code="${dl.weather_code[i]}">${effects.weatherIconMarkup(dl.weather_code[i],wi(dl.weather_code[i]),ui)}</div>${ui.showPrecip?`<div class="fc-rain">💧${pp}%</div>`:''}<div class="fc-temps"><span class="fc-hi">${C(dl.temperature_2m_max[i])}°</span> <span class="fc-lo">${C(dl.temperature_2m_min[i])}°</span></div>`;frag.appendChild(el);
    }return fcDays;
  });

  const hrDiv=document.getElementById('wx-hourly'),hourlyRows=hourlyForecastRows(d,dl,hr,ui);
  updateForecastRegion('hourly',hrDiv,hourlyForecastSignature(d,dl,hr,ui,hourlyRows),frag=>{
    for(const row of hourlyRows){const i=row.i,t=row.t,h12=t.getHours()%12||12,ampm=t.getHours()<12?'am':'pm',pp=hr.precipitation_probability[i]||0,el=document.createElement('div');el.className='hr-col';
      el.innerHTML=`<div class="hr-time">${h12}${ampm}</div><div class="hr-icon" data-weather-code="${hr.weather_code[i]}">${effects.weatherIconMarkup(hr.weather_code[i],wi(hr.weather_code[i],row.isDay,hr.time[i],d.latitude??ui.lat,d.utc_offset_seconds??0),ui,row.isDay)}</div>${ui.showPrecip?`<div class="hr-rain">💧${pp}%</div>`:''}<div class="hr-temp">${C(hr.temperature_2m[i])}°</div>`;frag.appendChild(el);
    }return hourlyRows.length;
  });
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
  host.innerHTML=state.order.map((key,i)=>{const m=WEATHER_DETAIL_META[key];return `<div class="weather-detail-row" draggable="true" data-weather-detail="${key}" data-ld-action-dragstart="weather.weatherDetailDragStart" data-ld-action-drop="weather.weatherDetailDrop" data-ld-action-args="${escHtml(JSON.stringify([key]))}" data-ld-action-event-first="1" data-ld-remove-class-dragend="dragging" data-ld-prevent-dragover="1"><span class="weather-detail-handle">⋮⋮</span><label><input type="checkbox" ${state.enabled[key]?'checked':''} data-ld-action-change="weather.toggleWeatherDetailSetting" data-ld-action-args="${escHtml(JSON.stringify([key]))}" data-ld-action-pass="checked"> <span class="weather-detail-name">${m.icon} ${escHtml(m.label)}</span></label><div class="weather-detail-actions"><button type="button" title="Move up" data-ld-action-click="weather.moveWeatherDetailSetting" data-ld-action-args="${escHtml(JSON.stringify([key,-1]))}">↑</button><button type="button" title="Move down" data-ld-action-click="weather.moveWeatherDetailSetting" data-ld-action-args="${escHtml(JSON.stringify([key,1]))}">↓</button></div><span class="weather-detail-preview">${i+1}</span></div>`;}).join('');
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


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("weather", {activeLocale,formatClockDate,tick,clockTickDelay,startClock,wi,wd,C,u,weatherLocationKey,weatherPayloadMatchesRequest,showWeatherWaitingState,invalidateWeatherIfLocationChanged,weatherWindUnitParam,weatherWindUnitLabel,weatherWindUnitMatches,validateWeatherPayload,fetchWeather,renderWeather,forecastRenderSnapshot,weatherDetailsConfig,weatherDetailColumnCount,weatherDetailValue,renderBuiltInWeatherDetails,weatherDetailsFromForm,setWeatherDetailsForm,renderWeatherDetailsSettings,mutateWeatherDetails,toggleWeatherDetailSetting,moveWeatherDetailSetting,weatherDetailDragStart,weatherDetailDrop,enableRecommendedWeatherDetails,enableAllWeatherDetails,resetWeatherDetails}, {
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
}
// End source section: /js/weather/index.js

// LibreDisplay source section: /js/weather/scenery.js
{
// NatureScape companion character and holiday-overlay runtime.
const performanceApi=LibreDisplayRuntime.getModule('performance');
const DOG_BREEDS=new Set(['labrador','golden','german-shepherd','white-swiss-shepherd','great-pyrenees','nova-scotia-duck-tolling-retriever','border-collie','australian-shepherd','beagle','corgi','dachshund','french-bulldog','poodle','husky','shiba','boxer','great-dane','chihuahua']);
const LABRADOR_COATS=new Set(['black','yellow','fox-red','chocolate']);
const DOG_COLLARS=new Set(['none','red','blue','teal','green','purple','pink','orange','black','brown']);
const DOG_ACCESSORIES=new Set(['none','collar','bandana']);
const DOG_ACCESSORY_DEFAULT_COLOR='#3478d4';
const DOG_VARIANTS={
  labrador:{default:'yellow',options:{black:{label:'Black',coat:'#292c2d',dark:'#111314',light:'#505455'},yellow:{label:'Yellow / cream',coat:'#d3ad67',dark:'#9f783f',light:'#efd8aa'},'fox-red':{label:'Fox red',coat:'#a7562f',dark:'#75361f',light:'#d7834e'},chocolate:{label:'Chocolate',coat:'#704330',dark:'#40271f',light:'#996950'}}},
  golden:{default:'golden',options:{golden:{label:'Golden',coat:'#c99043',dark:'#91622c',light:'#efca7c'},light:{label:'Light cream',coat:'#dec79d',dark:'#aa8c63',light:'#f6ead0'},dark:{label:'Dark golden',coat:'#a9672f',dark:'#74421f',light:'#d99a55'}}},
  'german-shepherd':{default:'black-tan',options:{'black-tan':{label:'Black & tan',coat:'#a87640',dark:'#292929',light:'#c79a60',mark:'saddle'},sable:{label:'Sable',coat:'#927354',dark:'#332d28',light:'#c1a17d',mark:'sable'},black:{label:'Solid black',coat:'#303234',dark:'#17191a',light:'#575a5c',mark:'none'}}},
  'white-swiss-shepherd':{default:'white',options:{white:{label:'White',coat:'#e7e9e6',dark:'#b9bfbd',light:'#fafaf7'},cream:{label:'Cream white',coat:'#e7dfcf',dark:'#bbb09d',light:'#fff8e9'}}},
  'great-pyrenees':{default:'white',options:{white:{label:'White',coat:'#eeeeE9',dark:'#c5c4bc',light:'#ffffff'},badger:{label:'White with badger markings',coat:'#efeee8',dark:'#91897d',light:'#ffffff',mark:'pyrenees'}}},
  'nova-scotia-duck-tolling-retriever':{default:'red',options:{red:{label:'Red',coat:'#ab512d',dark:'#7d351f',light:'#f4e8d0'},'deep-red':{label:'Deep red',coat:'#8f3e25',dark:'#652619',light:'#f0dfc9'}}},
  'border-collie':{default:'black-white',options:{'black-white':{label:'Black & white',coat:'#25282a',dark:'#111416',light:'#f1f2ed',mark:'collie'},'red-white':{label:'Red & white',coat:'#7e4738',dark:'#4a2b25',light:'#f3eee6',mark:'collie'},'blue-merle':{label:'Blue merle',coat:'#77848d',dark:'#303d46',light:'#f1f1ec',mark:'merle'}}},
  'australian-shepherd':{default:'blue-merle',options:{'blue-merle':{label:'Blue merle',coat:'#71808b',dark:'#35434c',light:'#f0ede4',mark:'merle'},'red-merle':{label:'Red merle',coat:'#9d7063',dark:'#613d36',light:'#f0e7dc',mark:'red-merle'},'black-tri':{label:'Black tri',coat:'#2d3133',dark:'#111416',light:'#f1eee7',mark:'tri'},'red-tri':{label:'Red tri',coat:'#754335',dark:'#432722',light:'#f1e7db',mark:'tri'}}},
  beagle:{default:'tricolor',options:{tricolor:{label:'Tricolor',coat:'#a96d39',dark:'#292724',light:'#f4eee1',mark:'beagle'},lemon:{label:'Lemon & white',coat:'#c69a55',dark:'#9a713b',light:'#f7f1e4',mark:'beagle'},'red-white':{label:'Red & white',coat:'#9f5737',dark:'#72402d',light:'#f5eee5',mark:'beagle'}}},
  corgi:{default:'red-white',options:{'red-white':{label:'Red & white',coat:'#b96b34',dark:'#8d4824',light:'#f4eee1',mark:'corgi'},sable:{label:'Sable & white',coat:'#9c724e',dark:'#4c3b31',light:'#f5eee2',mark:'sable'},tricolor:{label:'Tricolor',coat:'#3d3833',dark:'#201e1b',light:'#f3ece2',mark:'tri'}}},
  dachshund:{default:'red',options:{red:{label:'Red',coat:'#8b482d',dark:'#5a2a20',light:'#b87854'},'black-tan':{label:'Black & tan',coat:'#292724',dark:'#151414',light:'#aa6f3d',mark:'black-tan'},chocolate:{label:'Chocolate & tan',coat:'#684135',dark:'#38251f',light:'#b77d55',mark:'black-tan'},dapple:{label:'Silver dapple',coat:'#77736f',dark:'#373431',light:'#b8aaa0',mark:'dapple'}}},
  'french-bulldog':{default:'fawn',options:{fawn:{label:'Fawn',coat:'#b89d82',dark:'#685a4f',light:'#e6d7c5',mark:'mask'},brindle:{label:'Brindle',coat:'#66584d',dark:'#292622',light:'#b7977a',mark:'brindle'},cream:{label:'Cream',coat:'#e2d4bb',dark:'#a49580',light:'#f7eddc',mark:'none'},pied:{label:'Pied',coat:'#e6dfd3',dark:'#4d4843',light:'#faf7f1',mark:'pied'}}},
  poodle:{default:'white',options:{white:{label:'White / cream',coat:'#e2d9c8',dark:'#b9ae99',light:'#f7f2e8'},black:{label:'Black',coat:'#303234',dark:'#151718',light:'#575a5b'},apricot:{label:'Apricot',coat:'#c88d62',dark:'#936247',light:'#e8b88f'},chocolate:{label:'Chocolate',coat:'#67483b',dark:'#392922',light:'#9c7560'}}},
  husky:{default:'gray-white',options:{'gray-white':{label:'Gray & white',coat:'#8e9aa3',dark:'#3d4851',light:'#f5f6f2',mark:'husky'},'black-white':{label:'Black & white',coat:'#3d4145',dark:'#17191b',light:'#f5f6f2',mark:'husky'},'red-white':{label:'Red & white',coat:'#9b644e',dark:'#623d31',light:'#f4f1e9',mark:'husky'},agouti:{label:'Agouti',coat:'#69645b',dark:'#2e2c29',light:'#d6d0c2',mark:'agouti'}}},
  shiba:{default:'red',options:{red:{label:'Red',coat:'#c57a3b',dark:'#8e4f27',light:'#f5e6cf',mark:'shiba'},'black-tan':{label:'Black & tan',coat:'#33302e',dark:'#181716',light:'#d9af75',mark:'black-tan'},cream:{label:'Cream',coat:'#e5d7ba',dark:'#aa9878',light:'#f8f0df',mark:'shiba'},sesame:{label:'Sesame',coat:'#967056',dark:'#3f3832',light:'#e9d5bb',mark:'sable'}}},
  boxer:{default:'fawn',options:{fawn:{label:'Fawn',coat:'#a76a3e',dark:'#342d29',light:'#e7c9ad',mark:'boxer'},brindle:{label:'Brindle',coat:'#765443',dark:'#2f2926',light:'#d5b297',mark:'brindle'},white:{label:'White',coat:'#e8e3da',dark:'#8a817a',light:'#faf8f2',mark:'boxer'}}},
  'great-dane':{default:'fawn',options:{fawn:{label:'Fawn',coat:'#b28a5e',dark:'#594638',light:'#d8b991',mark:'mask'},black:{label:'Black',coat:'#353638',dark:'#171819',light:'#606265'},blue:{label:'Blue',coat:'#65717d',dark:'#363f47',light:'#939da6'},harlequin:{label:'Harlequin',coat:'#e8e7e2',dark:'#2f3031',light:'#faf9f4',mark:'harlequin'}}},
  chihuahua:{default:'fawn',options:{fawn:{label:'Fawn',coat:'#b98b5a',dark:'#7d5938',light:'#e4c69f'},'black-tan':{label:'Black & tan',coat:'#34302d',dark:'#171514',light:'#c28a52',mark:'black-tan'},cream:{label:'Cream',coat:'#dfc89e',dark:'#a98d64',light:'#f4e4c3'},chocolate:{label:'Chocolate',coat:'#69483b',dark:'#3a2922',light:'#a6785c'}}}
};
const DOG_PROFILES={
  labrador:{family:'retriever',headShape:'retriever-broad',muzzleShape:'retriever',coat:'#d3ad67',dark:'#9f783f',light:'#efd8aa',body:[111,82,54,24],head:[181,66,26,22],muzzle:[198,72,24,13],muzzleScale:.60,legs:[0,0,0,0,37,11],ear:'drop',earSize:19,tail:'otter',tailLen:49,tailY:81,mark:'none',ruff:0},
  golden:{family:'retriever-longcoat',headShape:'retriever-soft',muzzleShape:'retriever',coat:'#c99043',dark:'#91622c',light:'#efca7c',body:[109,81,59,27],head:[181,64,27,23],muzzle:[198,70,23,13],muzzleScale:.59,legs:[0,0,0,0,38,11],ear:'drop',earSize:21,tail:'plume',tailLen:61,tailY:82,mark:'none',ruff:1.25},
  'german-shepherd':{family:'shepherd',headShape:'shepherd',muzzleShape:'shepherd',coat:'#a87640',dark:'#292929',light:'#c79a60',body:[109,75,57,25],head:[181,55,25,22],muzzle:[198,61,25,13],muzzleScale:.50,muzzleTone:'dark',legs:[0,0,0,0,47,10],ear:'erect',earSize:26,tail:'low-bushy',tailLen:60,tailY:79,mark:'saddle',ruff:.38},
  'white-swiss-shepherd':{family:'shepherd',headShape:'shepherd',muzzleShape:'shepherd',coat:'#e7e9e6',dark:'#b9bfbd',light:'#fafaf7',body:[109,76,58,26],head:[181,56,26,23],muzzle:[198,62,24,13],muzzleScale:.50,legs:[0,0,0,0,46,10],ear:'erect',earSize:26,tail:'low-bushy',tailLen:61,tailY:80,mark:'none',ruff:.58},
  'great-pyrenees':{family:'mountain',headShape:'mountain',muzzleShape:'mountain',coat:'#eeeeE9',dark:'#c5c4bc',light:'#ffffff',body:[106,82,67,32],head:[180,66,31,26],muzzle:[201,73,24,15],muzzleScale:.62,legs:[0,0,0,0,34,13],ear:'small-drop',earSize:18,tail:'low-bushy',tailLen:60,tailY:86,mark:'pyrenees',ruff:1.55},
  'nova-scotia-duck-tolling-retriever':{family:'toller',headShape:'retriever-narrow',muzzleShape:'retriever',coat:'#ab512d',dark:'#7d351f',light:'#f4e8d0',body:[111,83,51,24],head:[180,66,24,21],muzzle:[197,72,23,12],muzzleScale:.58,legs:[0,0,0,0,35,10],ear:'drop',earSize:19,tail:'plume-low',tailLen:55,tailY:83,mark:'toller',ruff:.62},
  'border-collie':{family:'collie',headShape:'collie',muzzleShape:'collie',coat:'#25282a',dark:'#111416',light:'#f1f2ed',body:[111,80,52,24],head:[180,62,24,21],muzzle:[197,68,22,12],muzzleScale:.48,muzzleTone:'light',legs:[0,0,0,0,39,9],ear:'semi',earSize:22,tail:'feather-low',tailLen:59,tailY:82,mark:'collie',ruff:.82},
  'australian-shepherd':{family:'aussie',headShape:'aussie',muzzleShape:'collie',coat:'#71808b',dark:'#35434c',light:'#f0ede4',body:[111,81,53,25],head:[179,63,25,22],muzzle:[197,69,21,12],muzzleScale:.47,muzzleTone:'light',legs:[0,0,0,0,37,10],ear:'semi-drop',earSize:21,tail:'bob',tailLen:12,tailY:84,mark:'merle',ruff:.90},
  beagle:{family:'hound',headShape:'hound',muzzleShape:'beagle',coat:'#a96d39',dark:'#292724',light:'#f4eee1',body:[111,88,47,22],head:[179,71,26,22],muzzle:[197,78,24,13],muzzleScale:.58,muzzleTone:'light',legs:[0,0,0,0,28,10],ear:'hound',earSize:30,tail:'upright-tip',tailLen:44,tailY:87,mark:'beagle',ruff:0},
  corgi:{family:'corgi',headShape:'corgi',muzzleShape:'corgi',coat:'#b96b34',dark:'#8d4824',light:'#f4eee1',body:[107,96,59,20],head:[180,72,30,25],muzzle:[199,80,18,12],muzzleScale:.48,muzzleTone:'light',legs:[0,0,0,0,20,11],ear:'large-erect',earSize:27,tail:'bob',tailLen:10,tailY:97,mark:'corgi',ruff:.44},
  dachshund:{family:'dachshund',headShape:'dachshund',muzzleShape:'dachshund',coat:'#8b482d',dark:'#5a2a20',light:'#b87854',body:[105,98,73,16],head:[191,80,22,19],muzzle:[207,86,23,11],muzzleScale:.60,legs:[0,0,0,0,17,8],ear:'hound',earSize:27,tail:'thin-low',tailLen:57,tailY:97,mark:'none',ruff:0},
  'french-bulldog':{family:'bulldog',headShape:'brachy',muzzleShape:'brachy',coat:'#b89d82',dark:'#685a4f',light:'#e6d7c5',body:[118,91,42,28],head:[181,66,34,31],muzzle:[198,78,10,14],muzzleScale:.34,legs:[0,0,0,0,26,12],ear:'bat',earSize:31,tail:'stub',tailLen:7,tailY:93,mark:'mask',ruff:0},
  poodle:{family:'poodle',headShape:'poodle',muzzleShape:'poodle',coat:'#e2d9c8',dark:'#b9ae99',light:'#f7f2e8',body:[112,78,39,23],head:[180,56,22,21],muzzle:[196,64,24,10],muzzleScale:.67,legs:[0,0,0,0,47,8],ear:'poodle',earSize:24,tail:'pom',tailLen:36,tailY:77,mark:'none',ruff:.90},
  husky:{family:'spitz',headShape:'husky',muzzleShape:'husky',coat:'#8e9aa3',dark:'#3d4851',light:'#f5f6f2',body:[111,80,52,25],head:[180,59,27,23],muzzle:[197,66,21,12],muzzleScale:.46,muzzleTone:'light',legs:[0,0,0,0,40,10],ear:'erect',earSize:22,tail:'curl',tailLen:45,tailY:81,mark:'husky',ruff:.70},
  shiba:{family:'spitz-small',headShape:'shiba',muzzleShape:'shiba',coat:'#c57a3b',dark:'#8e4f27',light:'#f5e6cf',body:[114,87,42,22],head:[179,66,26,23],muzzle:[196,73,19,11],muzzleScale:.44,muzzleTone:'light',legs:[0,0,0,0,30,9],ear:'erect',earSize:20,tail:'curl-high',tailLen:40,tailY:86,mark:'shiba',ruff:.34},
  boxer:{family:'boxer',headShape:'boxer',muzzleShape:'brachy',coat:'#a76a3e',dark:'#342d29',light:'#e7c9ad',body:[111,83,52,29],head:[180,62,30,27],muzzle:[197,73,13,15],muzzleScale:.38,legs:[0,0,0,0,39,12],ear:'fold',earSize:21,tail:'short',tailLen:18,tailY:84,mark:'boxer',ruff:0},
  'great-dane':{family:'giant',headShape:'great-dane',muzzleShape:'great-dane',coat:'#71757a',dark:'#41454a',light:'#aeb2b6',body:[107,56,46,18],head:[184,31,24,23],muzzle:[202,39,28,14],muzzleScale:.70,legs:[0,0,0,0,73,8],ear:'fold',earSize:20,tail:'long-thin',tailLen:70,tailY:60,mark:'none',ruff:0},
  chihuahua:{family:'toy',headShape:'toy',muzzleShape:'toy',coat:'#b98b5a',dark:'#7d5938',light:'#e4c69f',body:[121,97,29,16],head:[176,72,30,27],muzzle:[195,81,13,9],muzzleScale:.34,legs:[0,0,0,0,27,7],ear:'huge-erect',earSize:32,tail:'curl-high',tailLen:34,tailY:93,mark:'none',ruff:0}
};
const HOLIDAY_KEYS=['new-year','valentines','st-patrick','easter','memorial','juneteenth','independence','labor','halloween','day-of-dead','veterans','thanksgiving','hanukkah','christmas'];
const HOLIDAY_CONFIG={
  'new-year':'holidayOverlayNewYear','valentines':'holidayOverlayValentines','st-patrick':'holidayOverlayStPatrick','easter':'holidayOverlayEaster','memorial':'holidayOverlayMemorial','juneteenth':'holidayOverlayJuneteenth','independence':'holidayOverlayIndependence','labor':'holidayOverlayLabor','halloween':'holidayOverlayHalloween','day-of-dead':'holidayOverlayDayOfDead','veterans':'holidayOverlayVeterans','thanksgiving':'holidayOverlayThanksgiving','hanukkah':'holidayOverlayHanukkah','christmas':'holidayOverlayChristmas'
};
const HOLIDAY_LABELS={'new-year':"New Year's Day",valentines:"Valentine's Day",'st-patrick':"St. Patrick's Day",easter:'Easter',memorial:'Memorial Day',juneteenth:'Juneteenth',independence:'Independence Day',labor:'Labor Day',halloween:'Halloween','day-of-dead':'Day of the Dead',veterans:'Veterans Day',thanksgiving:'Thanksgiving',hanukkah:'Hanukkah',christmas:'Christmas'};
const HOLIDAY_NATURE_POLICIES={
  'new-year':{leaves:0,grass:0,petals:0,insects:0,birds:0,owls:0,snowmen:.55},
  valentines:{leaves:.2,grass:.25,petals:.2,insects:.35,birds:.55,owls:.55,snowmen:.45},
  'st-patrick':{leaves:.2,grass:.35,petals:.15,insects:.35,birds:.55,owls:.55,snowmen:.2},
  easter:{leaves:0,grass:.18,petals:.12,insects:.18,birds:.45,owls:.2,snowmen:0},
  memorial:{leaves:.05,grass:.05,petals:0,insects:.12,birds:.38,owls:.4,snowmen:.2},
  juneteenth:{leaves:.05,grass:.1,petals:0,insects:.18,birds:.45,owls:.4,snowmen:.2},
  independence:{leaves:0,grass:0,petals:0,insects:0,birds:0,owls:0,snowmen:0},
  labor:{leaves:.22,grass:.12,petals:0,insects:.22,birds:.55,owls:.5,snowmen:.25},
  halloween:{leaves:.12,grass:0,petals:0,insects:.08,birds:.18,owls:.6,snowmen:0},
  'day-of-dead':{leaves:.08,grass:0,petals:0,insects:.12,birds:.3,owls:.55,snowmen:0},
  veterans:{leaves:0,grass:0,petals:0,insects:.1,birds:.35,owls:.38,snowmen:.2},
  thanksgiving:{leaves:.04,grass:0,petals:0,insects:.1,birds:.22,owls:.4,snowmen:0},
  hanukkah:{leaves:0,grass:0,petals:0,insects:.05,birds:.28,owls:.4,snowmen:.6},
  christmas:{leaves:0,grass:0,petals:0,insects:0,birds:.1,owls:.2,snowmen:.8}
};
function holidayNaturePolicy(keys=[]){const out={leaves:1,grass:1,petals:1,crystals:1,snowmen:1,insects:1,birds:1,owls:1};for(const key of keys||[]){const p=HOLIDAY_NATURE_POLICIES[key];if(!p)continue;for(const k of Object.keys(out))if(p[k]!=null)out[k]=Math.min(out[k],p[k]);}return out;}

let dogRuntime={timer:0,frame:0,watchdog:0,node:null,serial:0,lastState:'rest',x:0,bottom:0,moving:false,lastMotionAt:0,idleStreak:0,reducedMotion:false,source:null,birdsPresent:false,hazardKeys:[],hazardMode:'normal',shelterTarget:null,recovering:false};
const dogContinuity={x:null,bottom:null,lastState:'rest',interruptedState:null,lastHazardMode:'normal',shelterTarget:null,lastWorldChange:0};
let holidayTestProfile='live';
let holidayRefresh=null;
function sceneryClamp(n,lo,hi,fallback=lo){n=Number(n);return Math.min(hi,Math.max(lo,Number.isFinite(n)?n:fallback));}
function rand(lo=0,hi=1){return lo+Math.random()*(hi-lo);}
function choice(rows){const total=rows.reduce((n,r)=>n+r[1],0);let x=Math.random()*total;for(const row of rows){x-=row[1];if(x<=0)return row[0];}return rows.at(-1)?.[0]||'rest';}
function dogBreedProfile(breed){return DOG_PROFILES[breed]||DOG_PROFILES.labrador;}
function dogVariantCatalog(breed){return DOG_VARIANTS[breed]||DOG_VARIANTS.labrador;}
function dogVariantKey(breed,value){const catalog=dogVariantCatalog(breed),raw=String(value||'');return Object.prototype.hasOwnProperty.call(catalog.options,raw)?raw:catalog.default;}
function dogVariantOptions(breed){const catalog=dogVariantCatalog(breed);return Object.entries(catalog.options).map(([value,spec])=>({value,label:spec.label}));}
function dogResolvedProfile(breed,variant){const base=dogBreedProfile(breed),spec=dogVariantCatalog(breed).options[dogVariantKey(breed,variant)]||{};return spec.mark?{...base,mark:spec.mark}:base;}
function dogBreedSignature(breed,variant=''){const p=dogResolvedProfile(breed,variant);return [p.family,...p.body,...p.head,...p.muzzle,...p.legs,p.ear,p.earSize,p.tail,p.tailLen,p.tailY,p.mark,p.ruff,dogVariantKey(breed,variant)].join('|');}
function dogPalette(breed,variant=''){const p=dogBreedProfile(breed),catalog=dogVariantCatalog(breed),spec=catalog.options[dogVariantKey(breed,variant)]||{};return {coat:spec.coat||p.coat,dark:spec.dark||p.dark,light:spec.light||p.light};}
function svgEsc(v){return String(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
function dogLegacyAccessoryColor(value){return ({red:'#c94045',blue:'#3478d4',teal:'#168f91',green:'#4d9b4d',purple:'#8057b2',pink:'#d65b8b',orange:'#df7d2c',black:'#22262c',brown:'#70492f'}[value]||DOG_ACCESSORY_DEFAULT_COLOR);}
function dogAccessoryColor(value,fallback=DOG_ACCESSORY_DEFAULT_COLOR){const raw=String(value||'').trim();if(/^#[0-9a-f]{6}$/i.test(raw))return raw.toLowerCase();return dogLegacyAccessoryColor(raw)||fallback;}
function dogAccessorySettings(source={}){const legacy=DOG_COLLARS.has(source.weatherDogCollar)?source.weatherDogCollar:'blue',type=DOG_ACCESSORIES.has(source.weatherDogAccessory)?source.weatherDogAccessory:(legacy==='none'?'none':'collar'),color=dogAccessoryColor(source.weatherDogAccessoryColor,dogLegacyAccessoryColor(legacy));return {type,color,legacy};}
function dogEarSvg(type,cx,cy,size,dark,side=0){const x=cx+(side?8:-8),flip=side?1:-1,s=size,cls=`dogv2-ear dogv2-ear-${side?'far':'near'}`;
 if(type==='huge-erect')return `<path class="${cls}" d="M ${x-7*flip} ${cy+5} Q ${x-13*flip} ${cy-s*.42} ${x-2*flip} ${cy-s} Q ${x+11*flip} ${cy-s*.54} ${x+12*flip} ${cy+8} Z" fill="${dark}"/>`;
 if(type==='large-erect')return `<path class="${cls}" d="M ${x-6*flip} ${cy+4} Q ${x-9*flip} ${cy-s*.35} ${x} ${cy-s} Q ${x+10*flip} ${cy-s*.43} ${x+11*flip} ${cy+7} Z" fill="${dark}"/>`;
 if(type==='erect')return `<path class="${cls}" d="M ${x-5*flip} ${cy+3} Q ${x-6*flip} ${cy-s*.38} ${x+1*flip} ${cy-s} Q ${x+9*flip} ${cy-s*.35} ${x+10*flip} ${cy+6} Z" fill="${dark}"/>`;
 if(type==='bat')return `<path class="${cls}" d="M ${x-8*flip} ${cy+6} Q ${x-13*flip} ${cy-s*.38} ${x-1*flip} ${cy-s} Q ${x+14*flip} ${cy-s*.45} ${x+12*flip} ${cy+9} Z" fill="${dark}"/>`;
 if(type==='hound'||type==='poodle')return `<path class="${cls}" d="M ${x-5*flip} ${cy+1} C ${x-8*flip} ${cy+12} ${x-5*flip} ${cy+s*.75} ${x+2*flip} ${cy+s*.90} C ${x+9*flip} ${cy+s*.72} ${x+10*flip} ${cy+17} ${x+7*flip} ${cy+5} Z" fill="${dark}"/>`;
 if(type==='semi'||type==='semi-drop')return `<path class="${cls}" d="M ${x-6*flip} ${cy+4} L ${x} ${cy-s} Q ${x+8*flip} ${cy-s*.62} ${x+12*flip} ${cy+4} Q ${x+8*flip} ${cy+13} ${x+1*flip} ${cy+9} Z" fill="${dark}"/>`;
 if(type==='fold')return `<path class="${cls}" d="M ${x-6*flip} ${cy+1} Q ${x+2*flip} ${cy-s*.50} ${x+10*flip} ${cy+1} Q ${x+9*flip} ${cy+10} ${x+3*flip} ${cy+14} Z" fill="${dark}"/>`;
 const drop=type==='small-drop'?s*.68:s;return `<path class="${cls}" d="M ${x-7*flip} ${cy+1} Q ${x+1*flip} ${cy+2} ${x+8*flip} ${cy+7} Q ${x+6*flip} ${cy+drop} ${x-2*flip} ${cy+drop*.84} Q ${x-9*flip} ${cy+14} ${x-7*flip} ${cy+1} Z" fill="${dark}"/>`;}
function dogBodyPathData(p){const [cx,cy,rx,ry]=p.body,f=p.family;
 if(f==='dachshund')return `M ${cx-rx*.99} ${cy-ry*.30} C ${cx-rx*.66} ${cy-ry*.83} ${cx+rx*.45} ${cy-ry*.78} ${cx+rx*.94} ${cy-ry*.27} L ${cx+rx*.89} ${cy+ry*.48} C ${cx+rx*.43} ${cy+ry*.72} ${cx-rx*.58} ${cy+ry*.69} ${cx-rx*.97} ${cy+ry*.34} Z`;
 if(f==='corgi')return `M ${cx-rx*.98} ${cy-ry*.24} C ${cx-rx*.68} ${cy-ry*.92} ${cx+rx*.38} ${cy-ry*.88} ${cx+rx*.92} ${cy-ry*.20} L ${cx+rx*.82} ${cy+ry*.58} C ${cx+rx*.32} ${cy+ry*.82} ${cx-rx*.52} ${cy+ry*.78} ${cx-rx*.94} ${cy+ry*.39} Z`;
 if(f==='bulldog')return `M ${cx-rx*.92} ${cy-ry*.35} Q ${cx-rx*.70} ${cy-ry*.98} ${cx-rx*.10} ${cy-ry*1.00} Q ${cx+rx*.62} ${cy-ry*.96} ${cx+rx*.92} ${cy-ry*.30} L ${cx+rx*.80} ${cy+ry*.68} Q ${cx+rx*.18} ${cy+ry*.88} ${cx-rx*.60} ${cy+ry*.76} Q ${cx-rx*.99} ${cy+ry*.38} ${cx-rx*.92} ${cy-ry*.35} Z`;
 if(f==='boxer')return `M ${cx-rx*.92} ${cy-ry*.28} Q ${cx-rx*.58} ${cy-ry*.88} ${cx+rx*.10} ${cy-ry*.98} Q ${cx+rx*.68} ${cy-ry*.90} ${cx+rx*.91} ${cy-ry*.24} Q ${cx+rx*.96} ${cy+ry*.34} ${cx+rx*.64} ${cy+ry*.76} Q ${cx+rx*.12} ${cy+ry*.88} ${cx-rx*.32} ${cy+ry*.56} Q ${cx-rx*.70} ${cy+ry*.76} ${cx-rx*.94} ${cy+ry*.36} Z`;
 if(f==='giant')return `M ${cx-rx*.93} ${cy-ry*.18} Q ${cx-rx*.60} ${cy-ry*.82} ${cx+rx*.24} ${cy-ry*.91} Q ${cx+rx*.70} ${cy-ry*.80} ${cx+rx*.89} ${cy-ry*.26} Q ${cx+rx*.98} ${cy+ry*.30} ${cx+rx*.64} ${cy+ry*.76} Q ${cx+rx*.20} ${cy+ry*.90} ${cx-rx*.17} ${cy+ry*.54} Q ${cx-rx*.57} ${cy+ry*.68} ${cx-rx*.93} ${cy+ry*.34} Z`;
 if(f==='mountain')return `M ${cx-rx*.98} ${cy-ry*.18} Q ${cx-rx*.69} ${cy-ry*.88} ${cx-rx*.05} ${cy-ry*1.00} Q ${cx+rx*.60} ${cy-ry*.96} ${cx+rx*.91} ${cy-ry*.34} Q ${cx+rx*1.00} ${cy+ry*.18} ${cx+rx*.78} ${cy+ry*.70} Q ${cx+rx*.28} ${cy+ry*.94} ${cx-rx*.20} ${cy+ry*.70} Q ${cx-rx*.66} ${cy+ry*.84} ${cx-rx*.98} ${cy+ry*.35} Z`;
 if(['retriever','retriever-longcoat','toller'].includes(f))return `M ${cx-rx*.96} ${cy-ry*.18} Q ${cx-rx*.68} ${cy-ry*.87} ${cx-rx*.04} ${cy-ry*.96} Q ${cx+rx*.57} ${cy-ry*.91} ${cx+rx*.90} ${cy-ry*.34} Q ${cx+rx*.98} ${cy+ry*.18} ${cx+rx*.73} ${cy+ry*.67} Q ${cx+rx*.25} ${cy+ry*.82} ${cx-rx*.12} ${cy+ry*.59} Q ${cx-rx*.58} ${cy+ry*.76} ${cx-rx*.96} ${cy+ry*.34} Z`;
 if(f==='shepherd')return `M ${cx-rx*.96} ${cy-ry*.08} Q ${cx-rx*.62} ${cy-ry*.62} ${cx-rx*.05} ${cy-ry*.78} Q ${cx+rx*.55} ${cy-ry*1.02} ${cx+rx*.91} ${cy-ry*.42} Q ${cx+rx*.98} ${cy+ry*.20} ${cx+rx*.71} ${cy+ry*.74} Q ${cx+rx*.20} ${cy+ry*.80} ${cx-rx*.12} ${cy+ry*.49} Q ${cx-rx*.60} ${cy+ry*.64} ${cx-rx*.96} ${cy+ry*.34} Z`;
 if(['collie','aussie'].includes(f))return `M ${cx-rx*.96} ${cy-ry*.15} Q ${cx-rx*.64} ${cy-ry*.80} ${cx-rx*.06} ${cy-ry*.91} Q ${cx+rx*.56} ${cy-ry*.96} ${cx+rx*.91} ${cy-ry*.38} Q ${cx+rx*.97} ${cy+ry*.17} ${cx+rx*.70} ${cy+ry*.68} Q ${cx+rx*.18} ${cy+ry*.76} ${cx-rx*.12} ${cy+ry*.46} Q ${cx-rx*.55} ${cy+ry*.64} ${cx-rx*.96} ${cy+ry*.34} Z`;
 if(f==='hound')return `M ${cx-rx*.96} ${cy-ry*.25} Q ${cx-rx*.66} ${cy-ry*.82} ${cx-rx*.02} ${cy-ry*.88} Q ${cx+rx*.58} ${cy-ry*.88} ${cx+rx*.91} ${cy-ry*.31} Q ${cx+rx*.98} ${cy+ry*.28} ${cx+rx*.72} ${cy+ry*.72} Q ${cx+rx*.24} ${cy+ry*.82} ${cx-rx*.12} ${cy+ry*.60} Q ${cx-rx*.58} ${cy+ry*.74} ${cx-rx*.96} ${cy+ry*.34} Z`;
 if(f==='poodle')return `M ${cx-rx*.91} ${cy-ry*.16} Q ${cx-rx*.55} ${cy-ry*.85} ${cx+rx*.08} ${cy-ry*.91} Q ${cx+rx*.63} ${cy-ry*.88} ${cx+rx*.88} ${cy-ry*.28} Q ${cx+rx*.90} ${cy+ry*.24} ${cx+rx*.58} ${cy+ry*.58} Q ${cx+rx*.06} ${cy+ry*.46} ${cx-rx*.18} ${cy+ry*.31} Q ${cx-rx*.55} ${cy+ry*.64} ${cx-rx*.91} ${cy+ry*.30} Z`;
 if(['spitz','spitz-small'].includes(f))return `M ${cx-rx*.94} ${cy-ry*.17} Q ${cx-rx*.62} ${cy-ry*.82} ${cx-rx*.04} ${cy-ry*.94} Q ${cx+rx*.57} ${cy-ry*.92} ${cx+rx*.91} ${cy-ry*.35} Q ${cx+rx*.97} ${cy+ry*.20} ${cx+rx*.70} ${cy+ry*.68} Q ${cx+rx*.20} ${cy+ry*.79} ${cx-rx*.12} ${cy+ry*.52} Q ${cx-rx*.58} ${cy+ry*.70} ${cx-rx*.94} ${cy+ry*.35} Z`;
 if(f==='toy')return `M ${cx-rx*.92} ${cy-ry*.20} Q ${cx-rx*.58} ${cy-ry*.82} ${cx+.02*rx} ${cy-ry*.92} Q ${cx+rx*.58} ${cy-ry*.88} ${cx+rx*.88} ${cy-ry*.31} Q ${cx+rx*.94} ${cy+ry*.26} ${cx+rx*.65} ${cy+ry*.66} Q ${cx+rx*.13} ${cy+ry*.77} ${cx-rx*.18} ${cy+ry*.52} Q ${cx-rx*.57} ${cy+ry*.67} ${cx-rx*.92} ${cy+ry*.31} Z`;
 return `M ${cx-rx*.94} ${cy-ry*.18} Q ${cx-rx*.67} ${cy-ry*.86} ${cx-rx*.05} ${cy-ry*.94} Q ${cx+rx*.55} ${cy-ry*.90} ${cx+rx*.88} ${cy-ry*.35} Q ${cx+rx*.98} ${cy+ry*.16} ${cx+rx*.72} ${cy+ry*.58} Q ${cx+rx*.25} ${cy+ry*.68} ${cx-rx*.06} ${cy+ry*.48} Q ${cx-rx*.42} ${cy+ry*.58} ${cx-rx*.75} ${cy+ry*.52} Q ${cx-rx*1.00} ${cy+ry*.30} ${cx-rx*.94} ${cy-ry*.18} Z`;}
function dogBodySvg(p,palette){return `<path class="dogv2-body" d="${dogBodyPathData(p)}" fill="${palette.coat}"/>`;}
function dogNeckSvg(p,palette){const [cx,cy,rx,ry]=p.body,[hx,hy,hrx,hry]=p.head,c=palette.coat,f=p.family,low=['corgi','dachshund','bulldog','toy','spitz-small'].includes(f),heavy=['mountain','retriever-longcoat','boxer'].includes(f),withersX=cx+rx*.48,withersY=cy-ry*.68,napeX=hx-hrx*.76,napeY=hy-hry*.08,throatX=hx-hrx*.70,throatY=hy+hry*.58,brisketX=cx+rx*(low?.72:.66),brisketY=cy+ry*(low?.40:.46);return `<path class="dogv2-neck" d="M ${withersX} ${withersY} C ${cx+rx*(heavy?.70:.62)} ${cy-ry*(heavy?1.00:.88)} ${napeX-3} ${napeY-4} ${napeX} ${napeY} C ${hx-hrx*.88} ${hy+hry*.12} ${throatX-2} ${throatY-1} ${throatX} ${throatY} C ${cx+rx*.78} ${cy+.02*ry} ${brisketX+4} ${brisketY} ${brisketX} ${brisketY} Q ${cx+rx*.52} ${cy-ry*.12} ${withersX} ${withersY} Z" fill="${c}"/>`;}
function dogHeadPathData(p){const [hx,hy,hrx,hry]=p.head,h=p.headShape||p.family;
 if(h==='toy')return `M ${hx-hrx*.99} ${hy+hry*.32} Q ${hx-hrx*1.02} ${hy-hry*.58} ${hx-hrx*.34} ${hy-hry*1.08} Q ${hx+hrx*.50} ${hy-hry*1.12} ${hx+hrx*.91} ${hy-hry*.30} Q ${hx+hrx*.98} ${hy+hry*.37} ${hx+hrx*.31} ${hy+hry*.99} Q ${hx-hrx*.57} ${hy+hry*.99} ${hx-hrx*.99} ${hy+hry*.32} Z`;
 if(h==='brachy')return `M ${hx-hrx*.98} ${hy-hry*.50} Q ${hx-hrx*.60} ${hy-hry*1.00} ${hx+hrx*.24} ${hy-hry*.96} Q ${hx+hrx*.92} ${hy-hry*.74} ${hx+hrx*.98} ${hy-hry*.08} L ${hx+hrx*.83} ${hy+hry*.72} Q ${hx+hrx*.18} ${hy+hry*1.02} ${hx-hrx*.62} ${hy+hry*.82} Q ${hx-hrx*1.01} ${hy+hry*.31} ${hx-hrx*.98} ${hy-hry*.50} Z`;
 if(h==='boxer')return `M ${hx-hrx*.98} ${hy-hry*.44} Q ${hx-hrx*.58} ${hy-hry*.99} ${hx+hrx*.25} ${hy-hry*.94} Q ${hx+hrx*.91} ${hy-hry*.70} ${hx+hrx*.97} ${hy-hry*.06} L ${hx+hrx*.81} ${hy+hry*.69} Q ${hx+hrx*.18} ${hy+hry*.99} ${hx-hrx*.62} ${hy+hry*.79} Q ${hx-hrx*1.01} ${hy+hry*.31} ${hx-hrx*.98} ${hy-hry*.44} Z`;
 if(h==='great-dane')return `M ${hx-hrx*.91} ${hy+hry*.37} L ${hx-hrx*.90} ${hy-hry*.50} Q ${hx-hrx*.72} ${hy-hry*.91} ${hx-hrx*.14} ${hy-hry*.96} L ${hx+hrx*.48} ${hy-hry*.84} Q ${hx+hrx*.90} ${hy-hry*.48} ${hx+hrx*.91} ${hy+hry*.31} Q ${hx+hrx*.55} ${hy+hry*.80} ${hx-hrx*.40} ${hy+hry*.85} Q ${hx-hrx*.80} ${hy+hry*.72} ${hx-hrx*.91} ${hy+hry*.37} Z`;
 if(h==='mountain')return `M ${hx-hrx*.99} ${hy+hry*.30} Q ${hx-hrx*.94} ${hy-hry*.62} ${hx-hrx*.20} ${hy-hry*1.00} Q ${hx+hrx*.60} ${hy-hry*.98} ${hx+hrx*.96} ${hy-hry*.27} Q ${hx+hrx*.98} ${hy+hry*.46} ${hx+hrx*.28} ${hy+hry*.96} Q ${hx-hrx*.62} ${hy+hry*.94} ${hx-hrx*.99} ${hy+hry*.30} Z`;
 if(h==='retriever-broad')return `M ${hx-hrx*.98} ${hy+hry*.29} Q ${hx-hrx*.92} ${hy-hry*.64} ${hx-hrx*.18} ${hy-hry*.98} Q ${hx+hrx*.59} ${hy-hry*.94} ${hx+hrx*.95} ${hy-hry*.26} Q ${hx+hrx*.96} ${hy+hry*.44} ${hx+hrx*.30} ${hy+hry*.94} Q ${hx-hrx*.58} ${hy+hry*.91} ${hx-hrx*.98} ${hy+hry*.29} Z`;
 if(h==='retriever-soft')return `M ${hx-hrx*.98} ${hy+hry*.30} Q ${hx-hrx*.91} ${hy-hry*.65} ${hx-hrx*.18} ${hy-hry*.99} Q ${hx+hrx*.59} ${hy-hry*.96} ${hx+hrx*.95} ${hy-hry*.25} Q ${hx+hrx*.95} ${hy+hry*.45} ${hx+hrx*.29} ${hy+hry*.96} Q ${hx-hrx*.59} ${hy+hry*.94} ${hx-hrx*.98} ${hy+hry*.30} Z`;
 if(h==='retriever-narrow')return `M ${hx-hrx*.95} ${hy+hry*.30} Q ${hx-hrx*.88} ${hy-hry*.62} ${hx-hrx*.15} ${hy-hry*.96} Q ${hx+hrx*.55} ${hy-hry*.92} ${hx+hrx*.92} ${hy-hry*.25} Q ${hx+hrx*.94} ${hy+hry*.43} ${hx+hrx*.27} ${hy+hry*.91} Q ${hx-hrx*.56} ${hy+hry*.88} ${hx-hrx*.95} ${hy+hry*.30} Z`;
 if(h==='shepherd')return `M ${hx-hrx*.97} ${hy+hry*.35} Q ${hx-hrx*.89} ${hy-hry*.38} ${hx-hrx*.34} ${hy-hry*.92} Q ${hx+hrx*.25} ${hy-hry*1.00} ${hx+hrx*.78} ${hy-hry*.38} Q ${hx+hrx*.92} ${hy+hry*.06} ${hx+hrx*.53} ${hy+hry*.68} Q ${hx-hrx*.04} ${hy+hry*.99} ${hx-hrx*.71} ${hy+hry*.77} Z`;
 if(h==='collie')return `M ${hx-hrx*.94} ${hy+hry*.34} Q ${hx-hrx*.86} ${hy-hry*.43} ${hx-hrx*.29} ${hy-hry*.95} Q ${hx+hrx*.30} ${hy-hry*1.00} ${hx+hrx*.79} ${hy-hry*.39} Q ${hx+hrx*.92} ${hy+hry*.08} ${hx+hrx*.52} ${hy+hry*.67} Q ${hx-hrx*.04} ${hy+hry*.97} ${hx-hrx*.69} ${hy+hry*.75} Z`;
 if(h==='aussie')return `M ${hx-hrx*.97} ${hy+hry*.34} Q ${hx-hrx*.89} ${hy-hry*.48} ${hx-hrx*.26} ${hy-hry*.98} Q ${hx+hrx*.37} ${hy-hry*1.00} ${hx+hrx*.83} ${hy-hry*.37} Q ${hx+hrx*.94} ${hy+hry*.09} ${hx+hrx*.54} ${hy+hry*.70} Q ${hx-hrx*.04} ${hy+hry*.99} ${hx-hrx*.71} ${hy+hry*.76} Z`;
 if(h==='husky')return `M ${hx-hrx*.98} ${hy+hry*.34} Q ${hx-hrx*.90} ${hy-hry*.49} ${hx-hrx*.25} ${hy-hry*1.00} Q ${hx+hrx*.37} ${hy-hry*1.01} ${hx+hrx*.84} ${hy-hry*.39} Q ${hx+hrx*.95} ${hy+hry*.09} ${hx+hrx*.54} ${hy+hry*.70} Q ${hx-hrx*.04} ${hy+hry*.99} ${hx-hrx*.72} ${hy+hry*.76} Z`;
 if(h==='shiba')return `M ${hx-hrx*.98} ${hy+hry*.34} Q ${hx-hrx*.91} ${hy-hry*.49} ${hx-hrx*.25} ${hy-hry*1.00} Q ${hx+hrx*.38} ${hy-hry*1.00} ${hx+hrx*.83} ${hy-hry*.39} Q ${hx+hrx*.94} ${hy+hry*.10} ${hx+hrx*.52} ${hy+hry*.72} Q ${hx-hrx*.06} ${hy+hry*.98} ${hx-hrx*.72} ${hy+hry*.76} Z`;
 if(h==='corgi')return `M ${hx-hrx*.99} ${hy+hry*.36} Q ${hx-hrx*.91} ${hy-hry*.47} ${hx-hrx*.26} ${hy-hry*1.00} Q ${hx+hrx*.38} ${hy-hry*1.02} ${hx+hrx*.84} ${hy-hry*.38} Q ${hx+hrx*.96} ${hy+hry*.08} ${hx+hrx*.55} ${hy+hry*.73} Q ${hx-hrx*.04} ${hy+hry*1.00} ${hx-hrx*.72} ${hy+hry*.78} Z`;
 if(h==='hound')return `M ${hx-hrx*.98} ${hy+hry*.29} Q ${hx-hrx*.91} ${hy-hry*.62} ${hx-hrx*.20} ${hy-hry*.98} Q ${hx+hrx*.56} ${hy-hry*.95} ${hx+hrx*.94} ${hy-hry*.27} L ${hx+hrx*.85} ${hy+hry*.51} Q ${hx+hrx*.17} ${hy+hry*.95} ${hx-hrx*.68} ${hy+hry*.73} Z`;
 if(h==='dachshund')return `M ${hx-hrx*.95} ${hy+hry*.28} Q ${hx-hrx*.86} ${hy-hry*.57} ${hx-hrx*.18} ${hy-hry*.94} Q ${hx+hrx*.53} ${hy-hry*.91} ${hx+hrx*.91} ${hy-hry*.28} L ${hx+hrx*.84} ${hy+hry*.48} Q ${hx+hrx*.17} ${hy+hry*.90} ${hx-hrx*.65} ${hy+hry*.72} Z`;
 if(h==='poodle')return `M ${hx-hrx*.92} ${hy+hry*.27} Q ${hx-hrx*.82} ${hy-hry*.65} ${hx-hrx*.12} ${hy-hry*.95} Q ${hx+hrx*.54} ${hy-hry*.91} ${hx+hrx*.90} ${hy-hry*.30} L ${hx+hrx*.82} ${hy+hry*.44} Q ${hx+hrx*.15} ${hy+hry*.86} ${hx-hrx*.62} ${hy+hry*.69} Z`;
 return `M ${hx-hrx*.95} ${hy+hry*.28} Q ${hx-hrx*.87} ${hy-hry*.62} ${hx-hrx*.16} ${hy-hry*.96} Q ${hx+hrx*.59} ${hy-hry*.92} ${hx+hrx*.95} ${hy-hry*.24} Q ${hx+hrx*.94} ${hy+hry*.46} ${hx+hrx*.28} ${hy+hry*.92} Q ${hx-hrx*.56} ${hy+hry*.88} ${hx-hrx*.95} ${hy+hry*.28} Z`;}
function dogHeadSvg(p,palette){return `<path class="dogv2-head" d="${dogHeadPathData(p)}" fill="${palette.coat}"/>`;}
function dogMuzzleContract(p){const shape=p.muzzleShape||p.family,contracts={retriever:{scale:.61,height:1.10,base:.25,bridge:.15,tipInset:3,nose:[4.9,4.0],kind:'broad'},shepherd:{scale:.52,height:1.15,base:.16,bridge:.16,tipInset:4,nose:[5.0,4.0],kind:'wedge'},collie:{scale:.54,height:1.06,base:.17,bridge:.15,tipInset:4,nose:[4.7,3.8],kind:'taper'},husky:{scale:.47,height:1.16,base:.14,bridge:.16,tipInset:4,nose:[4.9,3.9],kind:'wedge'},shiba:{scale:.43,height:1.14,base:.14,bridge:.16,tipInset:4,nose:[4.5,3.7],kind:'wedge'},corgi:{scale:.47,height:1.14,base:.14,bridge:.16,tipInset:4,nose:[4.6,3.7],kind:'wedge'},beagle:{scale:.61,height:1.16,base:.22,bridge:.14,tipInset:3,nose:[5.0,4.1],kind:'broad'},dachshund:{scale:.67,height:1.00,base:.25,bridge:.13,tipInset:3,nose:[4.5,3.6],kind:'long'},brachy:{scale:.34,height:1.22,base:.03,bridge:.04,tipInset:2,nose:[5.4,4.5],kind:'brachy'},poodle:{scale:.69,height:.94,base:.27,bridge:.13,tipInset:3,nose:[4.2,3.4],kind:'long'},'great-dane':{scale:.72,height:1.22,base:.20,bridge:.14,tipInset:2,nose:[5.4,4.3],kind:'square'},toy:{scale:.34,height:1.12,base:.12,bridge:.11,tipInset:3,nose:[3.8,3.2],kind:'toy'},mountain:{scale:.62,height:1.13,base:.24,bridge:.14,tipInset:3,nose:[5.1,4.2],kind:'broad'}};return contracts[shape]||{scale:.57,height:1.10,base:.24,bridge:.13,tipInset:3,nose:[4.5,3.7],kind:'broad'};}
function dogMuzzleSvg(p,palette){const [hx,hy,hrx,hry]=p.head,[mx,my,mw,mh]=p.muzzle,c=dogMuzzleContract(p),scale=Number.isFinite(p.muzzleScale)?p.muzzleScale:c.scale,effW=mw*scale,effH=mh*c.height,baseX=Math.min(mx-2,hx+hrx*c.base),tipX=mx+effW,topY=my-effH*.07,midY=my+effH*.47,bottomY=my+effH*.88,bridgeY=hy+hry*c.bridge,coat=palette.coat,dark=palette.dark,muzzleFill=p.muzzleTone==='dark'?dark:(p.muzzleTone==='light'||p.mark==='black-tan'?palette.light:((p.mark==='mask'||p.mark==='boxer')?dark:coat)),k=c.kind;let upper;if(k==='brachy')upper=`M ${baseX} ${bridgeY} Q ${baseX+effW*.16} ${topY} ${tipX-2} ${topY+2} Q ${tipX+1} ${midY} ${tipX-2} ${bottomY} Q ${baseX+effW*.45} ${bottomY+3} ${baseX+1} ${bottomY+1} Q ${baseX-3} ${hy+hry*.51} ${baseX} ${bridgeY} Z`;else if(k==='square')upper=`M ${baseX} ${bridgeY} L ${tipX-c.tipInset} ${topY} Q ${tipX+1} ${topY+2} ${tipX-1} ${midY} L ${tipX-2} ${bottomY} Q ${baseX+effW*.52} ${bottomY+2} ${baseX+2} ${bottomY} Q ${baseX-2} ${hy+hry*.48} ${baseX} ${bridgeY} Z`;else if(k==='long')upper=`M ${baseX} ${bridgeY} C ${baseX+effW*.13} ${topY-1} ${baseX+effW*.63} ${topY} ${tipX-3} ${topY+1} Q ${tipX+1} ${midY} ${tipX-2} ${bottomY-1} C ${baseX+effW*.66} ${bottomY+1.4} ${baseX+effW*.20} ${bottomY+2} ${baseX+2} ${bottomY-1} Q ${baseX-3} ${hy+hry*.44} ${baseX} ${bridgeY} Z`;else if(k==='taper')upper=`M ${baseX} ${bridgeY} C ${baseX+effW*.20} ${topY-1} ${baseX+effW*.57} ${topY} ${tipX-4} ${topY+2} Q ${tipX} ${midY} ${tipX-3} ${bottomY-1} C ${baseX+effW*.58} ${bottomY+2} ${baseX+effW*.21} ${bottomY+2} ${baseX+2} ${bottomY} Q ${baseX-3} ${hy+hry*.47} ${baseX} ${bridgeY} Z`;else if(k==='wedge')upper=`M ${baseX} ${bridgeY} C ${baseX+effW*.17} ${topY-1} ${baseX+effW*.58} ${topY-1} ${tipX-4} ${topY+1} Q ${tipX+1} ${midY} ${tipX-3} ${bottomY-1} C ${baseX+effW*.63} ${bottomY+2.4} ${baseX+effW*.24} ${bottomY+2.6} ${baseX+2} ${bottomY} Q ${baseX-3} ${hy+hry*.50} ${baseX} ${bridgeY} Z`;else upper=`M ${baseX} ${bridgeY} C ${baseX+effW*.12} ${topY-2} ${baseX+effW*.56} ${topY-1} ${tipX-3} ${topY+1} Q ${tipX+1} ${midY} ${tipX-2} ${bottomY-1} C ${baseX+effW*.61} ${bottomY+2.7} ${baseX+effW*.18} ${bottomY+2.8} ${baseX+2} ${bottomY} Q ${baseX-4} ${hy+hry*.48} ${baseX} ${bridgeY} Z`;const [noseRx,noseRy]=c.nose,noseX=tipX-1.5,noseY=midY,mouthStart=baseX+Math.max(5,effW*.18);return `<g class="dogv2-muzzle-group dogv2-muzzle-${k}"><path class="dogv2-muzzle" d="${upper}" fill="${muzzleFill}"/><ellipse class="dogv2-nose" cx="${noseX}" cy="${noseY}" rx="${noseRx}" ry="${noseRy}" fill="#171615"/><ellipse class="dogv2-nose-highlight" cx="${noseX+noseRx*.28}" cy="${noseY-noseRy*.25}" rx="${Math.max(.7,noseRx*.18)}" ry="${Math.max(.5,noseRy*.15)}" fill="rgba(255,255,255,.24)"/><path class="dogv2-mouth" d="M ${mouthStart} ${bottomY-2} Q ${baseX+effW*.61} ${bottomY+1} ${tipX-6} ${bottomY-2}" fill="none" stroke="${dark}" stroke-width="1.25" stroke-linecap="round" opacity=".78"/></g>`;}
function dogTailRoot(p){const [cx,cy,rx,ry]=p.body,t=p.tail;let x=cx-rx*.78,y=cy-ry*.12;if(['curl','curl-high','upright-tip'].includes(t))y=cy-ry*.34;else if(['low-bushy','thin-low','long-thin','plume-low','feather-low'].includes(t))y=cy+ry*.02;else if(['bob','stub','short'].includes(t))y=cy-ry*.08;else if(t==='pom')y=cy-ry*.22;return {x,y,rx:Math.max(5,rx*.12),ry:Math.max(4,ry*.18)};}
function dogTailSvg(p,palette){const root=dogTailRoot(p),x=root.x,y=root.y,len=p.tailLen,c=palette.coat,l=palette.light;let tail;switch(p.tail){case 'curl':case 'curl-high':tail=`<path class="dogv2-tail" d="M ${x} ${y} C ${x-len*.18} ${y-20}, ${x-len*.72} ${y-30}, ${x-len*.70} ${y-5} C ${x-len*.68} ${y+12}, ${x-len*.31} ${y+8}, ${x-len*.37} ${y-8}" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/>`;break;case 'upright-tip':tail=`<path class="dogv2-tail" d="M ${x} ${y} Q ${x-len*.38} ${y-15} ${x-len*.30} ${y-len*.78}" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/><path d="M ${x-len*.30} ${y-len*.78} l -4 -11" stroke="${l}" stroke-width="8" stroke-linecap="round"/>`;break;case 'bob':case 'stub':tail=`<path class="dogv2-tail" d="M ${x} ${y} q -${len} -3 -${len+2} 3" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/>`;break;case 'pom':tail=`<path class="dogv2-tail" d="M ${x} ${y} q -17 -15 -26 -25" fill="none" stroke="${c}" stroke-width="6"/><circle cx="${x-30}" cy="${y-30}" r="10" fill="${c}"/>`;break;case 'plume':case 'plume-low':case 'feather-low':tail=`<path class="dogv2-tail" d="M ${x} ${y} Q ${x-len*.40} ${y+7} ${x-len} ${y+(p.tail==='plume'?3:18)}" fill="none" stroke="${c}" stroke-width="13" stroke-linecap="round"/><path d="M ${x-4} ${y+3} Q ${x-len*.47} ${y+12} ${x-len*.94} ${y+(p.tail==='plume'?9:23)}" fill="none" stroke="${l}" stroke-width="4.5" stroke-linecap="round" opacity=".68"/>`;break;case 'low-bushy':tail=`<path class="dogv2-tail" d="M ${x} ${y} Q ${x-len*.34} ${y+4} ${x-len*.61} ${y+22} Q ${x-len*.78} ${y+33} ${x-len} ${y+26}" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round"/>`;break;case 'thin-low':case 'long-thin':tail=`<path class="dogv2-tail" d="M ${x} ${y} Q ${x-len*.42} ${y+8} ${x-len} ${y+17}" fill="none" stroke="${c}" stroke-width="${p.tail==='long-thin'?5.5:6.5}" stroke-linecap="round"/>`;break;case 'short':tail=`<path class="dogv2-tail" d="M ${x} ${y} q -${len*.6} 3 -${len} -5" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`;break;default:tail=`<path class="dogv2-tail" d="M ${x} ${y} Q ${x-len*.48} ${y-4} ${x-len} ${y+2}" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round"/>`;}return `<g class="dogv2-tail-assembly"><ellipse class="dogv2-tail-root" cx="${x+root.rx*.35}" cy="${y}" rx="${root.rx}" ry="${root.ry}" fill="${c}"/>${tail}</g>`;}
function dogMarkingSvg(p,palette){const [cx,cy,rx,ry]=p.body,l=palette.light,d=palette.dark;if(p.mark==='brindle')return `<g class="dogv2-pattern dogv2-pattern-brindle" fill="none" stroke="${d}" stroke-width="3.2" stroke-linecap="round" opacity=".58"><path d="M ${cx-rx*.72} ${cy-ry*.58} q 18 12 4 28"/><path d="M ${cx-rx*.35} ${cy-ry*.78} q 18 15 5 35"/><path d="M ${cx+rx*.05} ${cy-ry*.82} q 17 17 3 38"/><path d="M ${cx+rx*.42} ${cy-ry*.64} q 14 15 2 32"/></g>`;if(p.mark==='dapple'||p.mark==='harlequin')return `<g class="dogv2-pattern dogv2-pattern-${p.mark}" fill="${d}" opacity="${p.mark==='harlequin'?.86:.52}"><ellipse cx="${cx-rx*.54}" cy="${cy-ry*.38}" rx="${rx*.23}" ry="${ry*.30}" transform="rotate(-18 ${cx-rx*.54} ${cy-ry*.38})"/><ellipse cx="${cx-rx*.05}" cy="${cy+ry*.10}" rx="${rx*.17}" ry="${ry*.24}" transform="rotate(21 ${cx-rx*.05} ${cy+ry*.10})"/><ellipse cx="${cx+rx*.43}" cy="${cy-ry*.30}" rx="${rx*.21}" ry="${ry*.28}" transform="rotate(-12 ${cx+rx*.43} ${cy-ry*.30})"/></g>`;if(p.mark==='tri')return `<path d="M ${cx-rx*.70} ${cy-ry*.70} Q ${cx-rx*.10} ${cy-ry*1.02} ${cx+rx*.48} ${cy-ry*.50} L ${cx+rx*.31} ${cy+ry*.18} Q ${cx-rx*.10} ${cy+ry*.02} ${cx-rx*.70} ${cy+ry*.22} Z" fill="${d}" opacity=".92"/><path d="M ${cx+rx*.38} ${cy-ry*.72} Q ${cx+rx*.68} ${cy} ${cx+rx*.40} ${cy+ry*.80} L ${cx+rx*.10} ${cy+ry*.66} Z" fill="${l}"/>`;if(p.mark==='sable'||p.mark==='agouti')return `<path d="M ${cx-rx*.78} ${cy-ry*.64} Q ${cx-rx*.02} ${cy-ry*1.02} ${cx+rx*.72} ${cy-ry*.48} Q ${cx+rx*.50} ${cy-ry*.08} ${cx+rx*.14} ${cy+ry*.14} Q ${cx-rx*.28} ${cy-ry*.06} ${cx-rx*.78} ${cy+ry*.20} Z" fill="${d}" opacity="${p.mark==='agouti'?.48:.38}"/>`;if(p.mark==='black-tan')return `<path d="M ${cx+rx*.35} ${cy-ry*.52} Q ${cx+rx*.63} ${cy} ${cx+rx*.42} ${cy+ry*.74} L ${cx+rx*.18} ${cy+ry*.65} Z" fill="${l}" opacity=".94"/>`;if(p.mark==='pied')return `<path d="M ${cx-rx*.70} ${cy-ry*.54} q 22 -16 39 3 q -7 17 -28 20 q -15 -4 -11 -23 Z" fill="${d}" opacity=".90"/><path d="M ${cx+rx*.18} ${cy-ry*.68} q 20 -7 31 9 q -10 19 -30 13 q -8 -11 -1 -22 Z" fill="${d}" opacity=".82"/>`;if(p.mark==='red-merle')return `<path d="M ${cx-rx*.62} ${cy-ry*.64} q 20 -15 33 3 q 14 14 29 -1 q 18 -11 30 5 q -10 17 -31 10 q -22 -8 -43 6 q -12 -3 -18 -19 Z" fill="${d}" opacity=".52"/><path d="M ${cx+rx*.39} ${cy-ry*.68} Q ${cx+rx*.66} ${cy} ${cx+rx*.37} ${cy+ry*.80} L ${cx+rx*.08} ${cy+ry*.66} Z" fill="${l}"/>`;if(p.mark==='saddle')return `<path d="M ${cx-rx*.68} ${cy-ry*.72} Q ${cx-rx*.05} ${cy-ry*1.13} ${cx+rx*.58} ${cy-ry*.50} L ${cx+rx*.36} ${cy+ry*.18} Q ${cx-rx*.08} ${cy-ry*.10} ${cx-rx*.68} ${cy+ry*.16} Z" fill="${d}" opacity=".96"/>`;if(p.mark==='collie')return `<path d="M ${cx+rx*.40} ${cy-ry*.82} Q ${cx+rx*.72} ${cy} ${cx+rx*.40} ${cy+ry*.78} L ${cx+rx*.08} ${cy+ry*.68} Q ${cx+rx*.24} ${cy} ${cx+rx*.08} ${cy-ry*.72} Z" fill="${l}"/><path d="M ${cx-rx*.95} ${cy+ry*.04} Q ${cx-rx*.42} ${cy+ry*.48} ${cx+rx*.08} ${cy+ry*.56} Q ${cx-rx*.45} ${cy+ry*.76} ${cx-rx*.92} ${cy+ry*.36} Z" fill="${l}" opacity=".72"/>`;if(p.mark==='toller')return `<path d="M ${cx+rx*.38} ${cy-ry*.80} Q ${cx+rx*.68} ${cy} ${cx+rx*.40} ${cy+ry*.82} L ${cx+rx*.12} ${cy+ry*.70} Q ${cx+rx*.24} ${cy} ${cx+rx*.10} ${cy-ry*.68} Z" fill="${l}"/>`;if(p.mark==='beagle')return `<path d="M ${cx-rx*.72} ${cy-ry*.76} Q ${cx-rx*.08} ${cy-ry*1.12} ${cx+rx*.54} ${cy-ry*.54} L ${cx+rx*.28} ${cy+ry*.18} Q ${cx-rx*.15} ${cy+.08*ry} ${cx-rx*.72} ${cy+ry*.16} Z" fill="${d}"/><path d="M ${cx+rx*.42} ${cy-ry*.32} Q ${cx+rx*.75} ${cy+.14*ry} ${cx+rx*.43} ${cy+ry*.78} L ${cx+rx*.14} ${cy+ry*.70} Z" fill="${l}"/>`;if(p.mark==='corgi'||p.mark==='shiba')return `<path d="M ${cx+rx*.38} ${cy-ry*.68} Q ${cx+rx*.66} ${cy} ${cx+rx*.40} ${cy+ry*.82} L ${cx+rx*.12} ${cy+ry*.68} Q ${cx+rx*.24} ${cy} ${cx+rx*.10} ${cy-ry*.60} Z" fill="${l}"/>`;if(p.mark==='husky')return `<path d="M ${cx+rx*.34} ${cy-ry*.60} Q ${cx+rx*.67} ${cy} ${cx+rx*.42} ${cy+ry*.78} L ${cx+rx*.08} ${cy+ry*.70} Z" fill="${l}"/>`;if(p.mark==='merle')return `<path d="M ${cx-rx*.62} ${cy-ry*.64} q 20 -15 33 3 q 14 14 29 -1 q 18 -11 30 5 q -10 17 -31 10 q -22 -8 -43 6 q -12 -3 -18 -19 Z" fill="${d}" opacity=".68"/><path d="M ${cx+rx*.39} ${cy-ry*.68} Q ${cx+rx*.66} ${cy} ${cx+rx*.37} ${cy+ry*.80} L ${cx+rx*.08} ${cy+ry*.66} Z" fill="${l}"/>`;if(p.mark==='mask'||p.mark==='boxer')return `<path d="M ${cx+rx*.38} ${cy-ry*.74} Q ${cx+rx*.64} ${cy} ${cx+rx*.37} ${cy+ry*.80} L ${cx+rx*.06} ${cy+ry*.70} Z" fill="${l}" opacity=".86"/>`;return '';}
function dogHeadMarkingSvg(p,palette){const [hx,hy,hrx,hry]=p.head,l=palette.light,d=palette.dark;if(p.mark==='brindle')return `<path d="M ${hx-hrx*.58} ${hy-hry*.52} q 9 8 3 20 M ${hx-hrx*.20} ${hy-hry*.70} q 10 9 3 22 M ${hx+hrx*.18} ${hy-hry*.60} q 9 9 2 20" fill="none" stroke="${d}" stroke-width="2.6" opacity=".55" stroke-linecap="round"/>`;if(p.mark==='dapple'||p.mark==='harlequin'||p.mark==='pied')return `<g fill="${d}" opacity="${p.mark==='harlequin'?.86:.62}"><ellipse cx="${hx-hrx*.38}" cy="${hy-hry*.26}" rx="${hrx*.28}" ry="${hry*.32}" transform="rotate(-20 ${hx-hrx*.38} ${hy-hry*.26})"/><ellipse cx="${hx+hrx*.28}" cy="${hy+hry*.24}" rx="${hrx*.20}" ry="${hry*.24}"/></g>`;if(p.mark==='tri'||p.mark==='black-tan')return `<path d="M ${hx+hrx*.08} ${hy+hry*.18} q 8 12 17 2 q -4 16 -16 14" fill="${l}" opacity=".90"/><ellipse cx="${hx+hrx*.34}" cy="${hy-hry*.34}" rx="${hrx*.14}" ry="${hry*.09}" fill="${l}" opacity=".76"/>`;if(p.mark==='sable'||p.mark==='agouti')return `<path d="M ${hx-hrx*.72} ${hy-hry*.56} Q ${hx} ${hy-hry*.95} ${hx+hrx*.62} ${hy-hry*.42} Q ${hx+hrx*.36} ${hy-hry*.05} ${hx-hrx*.60} ${hy-hry*.08} Z" fill="${d}" opacity="${p.mark==='agouti'?.46:.34}"/>`;if(p.mark==='red-merle')return `<path d="M ${hx-hrx*.75} ${hy-hry*.55} q 11 -8 18 3 q 9 11 18 -1 q 8 -6 15 4 q -7 12 -20 8 q -13 -5 -31 3 Z" fill="${d}" opacity=".48"/><path d="M ${hx+1} ${hy-hry*.90} l 6 ${hry*1.48} l 7 -${hry*1.38} Z" fill="${l}" opacity=".90"/>`;if(p.mark==='collie'||p.mark==='toller')return `<path d="M ${hx-4} ${hy-hry*.92} L ${hx+3} ${hy+hry*.72} L ${hx+10} ${hy-hry*.84} Q ${hx+3} ${hy-hry*.44} ${hx-4} ${hy-hry*.92} Z" fill="${l}"/><path d="M ${hx+hrx*.22} ${hy+hry*.24} q 8 9 16 1 q -3 11 -14 11" fill="${l}" opacity=".84"/>`;if(p.mark==='beagle')return `<path d="M ${hx-3} ${hy-hry*.86} L ${hx+2} ${hy+hry*.54} L ${hx+8} ${hy-hry*.78} Z" fill="${l}" opacity=".90"/><path d="M ${hx+hrx*.20} ${hy+hry*.28} q 9 8 16 0 q -3 10 -14 10" fill="${l}" opacity=".82"/>`;if(p.mark==='corgi'||p.mark==='shiba')return `<path d="M ${hx+hrx*.10} ${hy+hry*.20} q 8 12 17 2 q -4 16 -16 14" fill="${l}" opacity=".88"/>`;if(p.mark==='husky')return `<path d="M ${hx-hrx*.76} ${hy-hry*.45} Q ${hx} ${hy+hry*.04} ${hx+hrx*.70} ${hy-hry*.45} L ${hx+hrx*.48} ${hy+hry*.55} Q ${hx} ${hy+hry*.88} ${hx-hrx*.55} ${hy+hry*.50} Z" fill="${l}"/>`;if(p.mark==='mask'||p.mark==='boxer')return `<path d="M ${hx+hrx*.03} ${hy-hry*.48} Q ${hx+hrx*.70} ${hy-hry*.34} ${hx+hrx*.78} ${hy+hry*.42} Q ${hx+hrx*.58} ${hy+hry*.82} ${hx+hrx*.05} ${hy+hry*.58} Z" fill="${d}" opacity=".90"/>`;if(p.mark==='merle')return `<path d="M ${hx-hrx*.75} ${hy-hry*.55} q 11 -8 18 3 q 9 11 18 -1 q 8 -6 15 4 q -7 12 -20 8 q -13 -5 -31 3 Z" fill="${d}" opacity=".58"/><path d="M ${hx+1} ${hy-hry*.90} l 6 ${hry*1.48} l 7 -${hry*1.38} Z" fill="${l}" opacity=".90"/>`;if(p.mark==='pyrenees')return `<path d="M ${hx-hrx*.78} ${hy-hry*.48} q 10 -7 18 2 q -4 12 -17 13 Z" fill="${d}" opacity=".26"/>`;return '';}
function dogLegSvg(p,palette,x,name,far=false){const front=name.startsWith('front'),[cx,cy,rx,ry]=p.body,[,,,,legH,legW]=p.legs,f=p.family,fill=far?palette.dark:palette.coat,dark=palette.dark,ground=126,rootY=front?cy-ry*.08:cy+ry*.03,span=Math.max(17,ground-rootY),w=Math.max(4.8,legW*.70),lower=Math.max(3.8,w*.68),paw=Math.max(4.8,legW*.72),rootR=Math.max(3.8,w*.60),tall=['giant','shepherd','poodle','collie','aussie','spitz'].includes(f);if(front){const elbowY=rootY+span*(tall?.42:.45),wristY=ground-8;return `<g class="dogv2-leg dogv2-leg-${name}${far?' dogv2-leg-far':''}" data-limb="front"><ellipse class="dogv2-leg-root dogv2-leg-root-front" cx="${x}" cy="${rootY}" rx="${rootR*1.05}" ry="${rootR*1.40}" fill="${fill}"/><g class="dogv2-upper-limb"><path d="M ${x} ${rootY+2} C ${x-1} ${rootY+span*.15} ${x+1} ${elbowY-5} ${x} ${elbowY}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/></g><g class="dogv2-lower-limb"><path d="M ${x} ${elbowY} C ${x+1} ${elbowY+span*.16} ${x+1} ${wristY-5} ${x+2} ${wristY}" fill="none" stroke="${fill}" stroke-width="${lower}" stroke-linecap="round"/><path d="M ${x+2} ${wristY} L ${x+8} ${ground-4}" fill="none" stroke="${fill}" stroke-width="${Math.max(3.4,lower*.84)}" stroke-linecap="round"/><ellipse cx="${x+9}" cy="${ground}" rx="${paw}" ry="3" fill="${dark}"/></g></g>`;}const kneeX=x+w*(tall?1.00:.85),kneeY=rootY+span*.34,hockX=x-w*.25,hockY=rootY+span*.70;return `<g class="dogv2-leg dogv2-leg-${name}${far?' dogv2-leg-far':''}" data-limb="rear"><ellipse class="dogv2-leg-root dogv2-leg-root-rear" cx="${x}" cy="${rootY}" rx="${rootR*1.18}" ry="${rootR*1.36}" fill="${fill}"/><g class="dogv2-upper-limb"><path d="M ${x} ${rootY+2} C ${x+w*.55} ${rootY+span*.12} ${kneeX} ${kneeY-4} ${kneeX} ${kneeY}" fill="none" stroke="${fill}" stroke-width="${w*1.02}" stroke-linecap="round"/></g><g class="dogv2-lower-limb"><path d="M ${kneeX} ${kneeY} C ${x+w*.35} ${kneeY+span*.12} ${hockX} ${hockY-4} ${hockX} ${hockY}" fill="none" stroke="${fill}" stroke-width="${lower}" stroke-linecap="round"/><path d="M ${hockX} ${hockY} L ${x+2} ${ground-7} L ${x+8} ${ground-4}" fill="none" stroke="${fill}" stroke-width="${Math.max(3.4,lower*.84)}" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="${x+9}" cy="${ground}" rx="${paw}" ry="3" fill="${dark}"/></g></g>`;}
function dogRestLegSvg(p,palette,rearX,frontX,far=false){const [cx,cy,rx,ry]=p.body,fill=far?palette.dark:palette.coat,dark=palette.dark,y=cy+ry*.48,ground=125,w=Math.max(4.2,p.legs[5]*.65),alpha=far?.72:1;return `<g class="dogv2-rest-limbs${far?' dogv2-rest-limbs-far':''}" opacity="${alpha}"><path class="dogv2-rest-rear" d="M ${rearX} ${y-3} C ${rearX-8} ${y+5} ${rearX-10} ${ground-10} ${rearX+2} ${ground-7} Q ${rearX+12} ${ground-3} ${rearX+20} ${ground-5}" fill="none" stroke="${fill}" stroke-width="${w*1.06}" stroke-linecap="round"/><ellipse cx="${rearX+21}" cy="${ground-3}" rx="${w*.76}" ry="3" fill="${dark}"/><path class="dogv2-rest-front" d="M ${frontX} ${y-6} C ${frontX+3} ${y+5} ${frontX+5} ${ground-11} ${frontX+15} ${ground-8} Q ${frontX+26} ${ground-4} ${frontX+34} ${ground-6}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/><ellipse cx="${frontX+35}" cy="${ground-4}" rx="${w*.74}" ry="3" fill="${dark}"/></g>`;}
function dogEyeSvg(p,palette){const [hx,hy,hrx,hry]=p.head,x=hx+hrx*.48,y=hy-hry*.17;return `<g class="dogv2-eye-group"><circle class="dogv2-eye-rim" cx="${x}" cy="${y}" r="2.7" fill="rgba(15,12,10,.78)"/><circle class="dogv2-eye" cx="${x}" cy="${y}" r="1.75" fill="#5b3b20"/><circle class="dogv2-eye-pupil" cx="${x+.18}" cy="${y+.08}" r="1.05" fill="#151312"/><circle class="dogv2-eye-shine" cx="${x+.72}" cy="${y-.68}" r=".55" fill="#fff" opacity=".88"/></g>`;}
function dogCollarSvg(p,color){const [hx,hy,hrx,hry]=p.head,topX=hx-hrx*.74,topY=hy+hry*.08,bottomX=hx-hrx*.62,bottomY=hy+hry*.64,tagX=bottomX+1,tagY=bottomY+5;return `<g class="dogv2-collar"><path class="dogv2-collar-band" d="M ${topX} ${topY} Q ${topX-4} ${(topY+bottomY)/2} ${bottomX} ${bottomY}" fill="none" stroke="${color}" stroke-width="5.1" stroke-linecap="round"/><path d="M ${bottomX-1} ${bottomY-1} L ${tagX} ${tagY-2}" stroke="#b9923e" stroke-width="1.6"/><circle class="dogv2-collar-tag" cx="${tagX}" cy="${tagY}" r="3.4" fill="#d7b55b"/></g>`;}
function dogBandanaSvg(p,color,layer='all'){const [hx,hy,hrx,hry]=p.head,compact=['bulldog','boxer','corgi','toy','spitz-small','dachshund'].includes(p.family),longNeck=['giant','shepherd','poodle','collie','aussie'].includes(p.family),rearX=hx-hrx*(compact?.84:.90),rearY=hy+hry*(compact?.12:longNeck?.08:.15),frontX=hx-hrx*(compact?.48:.52),frontY=hy+hry*(compact?.52:longNeck?.54:.56),midX=(rearX+frontX)/2-.4,midY=(rearY+frontY)/2,knotX=rearX-1.2,knotY=rearY+2.0,pointX=rearX-hrx*(compact?.20:.28),pointY=frontY+hry*(compact?.58:longNeck?.72:.65),wrapW=compact?5.2:5.8;const back=`<circle class="dogv2-bandana-knot" cx="${knotX}" cy="${knotY}" r="2.25" fill="${color}"/><path class="dogv2-bandana-tie dogv2-bandana-tie-a" d="M ${knotX-.4} ${knotY+1} Q ${knotX-5.4} ${knotY+3.0} ${knotX-6.5} ${knotY+7.2} Q ${knotX-2.7} ${knotY+6.0} ${knotX+.8} ${knotY+3.4} Z" fill="${color}" opacity=".90"/><path class="dogv2-bandana-tie dogv2-bandana-tie-b" d="M ${knotX+1.0} ${knotY+.8} Q ${knotX+3.4} ${knotY+4.2} ${knotX+1.7} ${knotY+7.3} Q ${knotX+5.1} ${knotY+5.9} ${knotX+4.0} ${knotY+2.5} Z" fill="${color}" opacity=".80"/>`;const front=`<path class="dogv2-bandana-neck" d="M ${rearX} ${rearY} Q ${midX-1} ${midY-1.0} ${frontX} ${frontY-wrapW*.45} L ${frontX-1} ${frontY+wrapW*.52} Q ${midX-1.5} ${midY+wrapW*.62} ${rearX-1.4} ${rearY+wrapW*.70} Z" fill="${color}" opacity=".96"/><path class="dogv2-bandana-cloth" d="M ${rearX+.8} ${rearY+wrapW*.50} Q ${midX} ${midY+wrapW*.88} ${frontX-1.0} ${frontY+wrapW*.34} L ${pointX} ${pointY} Q ${rearX-hrx*.08} ${pointY+1.2} ${rearX+.8} ${rearY+wrapW*.50} Z" fill="${color}"/><path class="dogv2-bandana-fold" d="M ${rearX+3.0} ${rearY+wrapW*.64} Q ${midX-.5} ${midY+wrapW*.86} ${frontX-2.0} ${frontY+wrapW*.42}" fill="none" stroke="rgba(255,255,255,.34)" stroke-width="1.05" stroke-linecap="round"/>`;const body=layer==='back'?back:layer==='front'?front:back+front;return `<g class="dogv2-bandana dogv2-bandana-${layer}">${body}</g>`;}
function dogAccessorySvg(p,type,color){if(type==='bandana')return dogBandanaSvg(p,color);if(type==='collar')return dogCollarSvg(p,color);return '';}
function dogAccessoryBackSvg(p,type,color){return type==='bandana'?dogBandanaSvg(p,color,'back'):'';}
function dogAccessoryFrontSvg(p,type,color){if(type==='bandana')return dogBandanaSvg(p,color,'front');if(type==='collar')return dogCollarSvg(p,color);return '';}
function dogSvgMarkup(breed,coat,accessory='collar',accessoryColor=DOG_ACCESSORY_DEFAULT_COLOR){const variant=dogVariantKey(breed,coat),p=dogResolvedProfile(breed,variant),pal=dogPalette(breed,variant),[cx,cy,rx,ry]=p.body,[hx,hy,hrx,hry]=p.head,legacy=DOG_COLLARS.has(accessory)&&!DOG_ACCESSORIES.has(accessory),type=legacy?(accessory==='none'?'none':'collar'):(DOG_ACCESSORIES.has(accessory)?accessory:'collar'),color=dogAccessoryColor(accessoryColor,legacy?dogLegacyAccessoryColor(accessory):DOG_ACCESSORY_DEFAULT_COLOR),legDepth=Math.max(4,rx*.075),rearAnchor=cx-rx*.53,frontAnchor=cx+rx*.54,rearNear=rearAnchor+legDepth*.52,rearFar=rearAnchor-legDepth*.52,frontNear=frontAnchor+legDepth*.52,frontFar=frontAnchor-legDepth*.52,earY=hy-hry*.70,bodyPath=dogBodyPathData(p),headPath=dogHeadPathData(p);const ruff=p.ruff>.2?`<path class="dogv2-ruff" d="M ${cx+rx*.43} ${cy-ry*.72} Q ${cx+rx*.71} ${cy-ry*.46} ${cx+rx*.67} ${cy+ry*.30} Q ${cx+rx*.50} ${cy+ry*.58} ${cx+rx*.31} ${cy+ry*.26} Q ${cx+rx*.48} ${cy-ry*.08} ${cx+rx*.43} ${cy-ry*.72} Z" fill="${pal.light}" opacity="${Math.min(.58,.12+p.ruff*.30)}"/>`:'';const poodle=p.family==='poodle'?`<g class="dogv2-poodle-puffs" fill="${pal.coat}"><circle cx="${hx-5}" cy="${hy-18}" r="12.5"/><circle cx="${hx-14}" cy="${hy+4}" r="9" opacity=".96"/><ellipse cx="${cx-rx*.58}" cy="${cy-1}" rx="13" ry="17"/><ellipse cx="${cx+rx*.54}" cy="${cy-2}" rx="12" ry="16"/><circle cx="${rearNear+3}" cy="120" r="7.5"/><circle cx="${rearFar+3}" cy="120" r="7.5"/><circle cx="${frontNear+5}" cy="120" r="7.5"/><circle cx="${frontFar+5}" cy="120" r="7.5"/></g>`:'';return `<svg class="dogv2-svg" viewBox="0 0 240 140" role="presentation" aria-hidden="true"><defs><clipPath id="dogv2-body-clip"><path d="${bodyPath}"/></clipPath><clipPath id="dogv2-head-clip"><path d="${headPath}"/></clipPath></defs><g class="dogv2-facing-stage"><g class="dogv2-pose-stage">${dogTailSvg(p,pal)}<ellipse class="dogv2-shadow" cx="117" cy="130" rx="${Math.max(36,rx*.88)}" ry="4.5"/>${dogLegSvg(p,pal,frontFar,'front-far',true)}${dogLegSvg(p,pal,rearFar,'rear-far',true)}<g class="dogv2-body-group">${dogBodySvg(p,pal)}<g class="dogv2-body-markings" clip-path="url(#dogv2-body-clip)">${dogMarkingSvg(p,pal)}</g>${dogNeckSvg(p,pal)}<ellipse class="dogv2-shoulder" cx="${frontAnchor}" cy="${cy-ry*.02}" rx="${Math.max(8,rx*.18)}" ry="${Math.max(12,ry*.52)}" fill="${pal.coat}" opacity=".82"/>${ruff}</g>${dogLegSvg(p,pal,frontNear,'front-near')}${dogLegSvg(p,pal,rearNear,'rear-near')}${dogRestLegSvg(p,pal,rearFar,frontFar,true)}${dogRestLegSvg(p,pal,rearNear,frontNear,false)}${dogAccessoryBackSvg(p,type,color)}<g class="dogv2-head-group">${dogEarSvg(p.ear,hx,earY,p.earSize,pal.dark,1)}${dogEarSvg(p.ear,hx,earY,p.earSize,pal.dark,0)}${dogHeadSvg(p,pal)}<g class="dogv2-head-markings" clip-path="url(#dogv2-head-clip)">${dogHeadMarkingSvg(p,pal)}</g>${dogMuzzleSvg(p,pal)}${dogEyeSvg(p,pal)}</g>${dogAccessoryFrontSvg(p,type,color)}${poodle}</g></g></svg>`;}
function dogShelterHeadSvg(breed,coat,accessory='none',accessoryColor=DOG_ACCESSORY_DEFAULT_COLOR){const variant=dogVariantKey(breed,coat),p=dogResolvedProfile(breed,variant),pal=dogPalette(breed,variant),[cx,cy,rx,ry]=p.body,[hx,hy,hrx,hry]=p.head,earY=hy-hry*.70,legacy=DOG_COLLARS.has(accessory)&&!DOG_ACCESSORIES.has(accessory),type=legacy?(accessory==='none'?'none':'collar'):(DOG_ACCESSORIES.has(accessory)?accessory:'none'),color=dogAccessoryColor(accessoryColor,legacy?dogLegacyAccessoryColor(accessory):DOG_ACCESSORY_DEFAULT_COLOR),chestX=hx-12,chestTop=hy+hry*.54,backX=Math.max(151,hx-hrx*1.62),backY=Math.min(103,hy+hry*1.62),backRx=Math.max(24,Math.min(38,rx*.54)),backRy=Math.max(15,Math.min(23,ry*.86)),headPath=dogHeadPathData(p);return `<svg class="dogv2-shelter-head-svg" viewBox="142 30 100 98" role="presentation" aria-hidden="true"><defs><clipPath id="dogv2-shelter-head-clip"><path d="${headPath}"/></clipPath></defs><g class="dogv2-shelter-bust"><ellipse class="dogv2-shelter-curled-body" cx="${backX}" cy="${backY}" rx="${backRx}" ry="${backRy}" fill="${pal.coat}"/><path class="dogv2-shelter-body-shade" d="M ${backX-backRx*.72} ${backY+2} Q ${backX-2} ${backY-backRy*.92} ${backX+backRx*.76} ${backY+3} Q ${backX+backRx*.35} ${backY+backRy*.75} ${backX-backRx*.58} ${backY+backRy*.62} Z" fill="${pal.dark}" opacity=".10"/><path class="dogv2-shelter-chest" d="M ${chestX-23} ${chestTop+4} Q ${chestX-29} ${chestTop+31} ${chestX-21} 121 L ${chestX+26} 121 Q ${chestX+33} ${chestTop+31} ${chestX+18} ${chestTop+3} Q ${chestX} ${chestTop-6} ${chestX-23} ${chestTop+4} Z" fill="${pal.coat}"/><path class="dogv2-shelter-bib" d="M ${chestX+3} ${chestTop+2} Q ${chestX+18} ${chestTop+26} ${chestX+13} 115 Q ${chestX+1} 121 ${chestX-9} 113 Q ${chestX-13} ${chestTop+26} ${chestX+3} ${chestTop+2} Z" fill="${pal.light}" opacity="${p.ruff>.2?.44:.16}"/><path class="dogv2-shelter-foreleg dogv2-shelter-foreleg-a" d="M ${chestX-8} ${chestTop+24} Q ${chestX-9} 107 ${chestX-15} 117" fill="none" stroke="${pal.coat}" stroke-width="7" stroke-linecap="round"/><path class="dogv2-shelter-foreleg dogv2-shelter-foreleg-b" d="M ${chestX+9} ${chestTop+23} Q ${chestX+10} 107 ${chestX+15} 117" fill="none" stroke="${pal.coat}" stroke-width="7" stroke-linecap="round"/><ellipse class="dogv2-shelter-paw dogv2-shelter-paw-a" cx="${chestX-16}" cy="119" rx="10" ry="4" fill="${pal.coat}" stroke="${pal.dark}" stroke-width="1"/><ellipse class="dogv2-shelter-paw dogv2-shelter-paw-b" cx="${chestX+16}" cy="119" rx="10" ry="4" fill="${pal.coat}" stroke="${pal.dark}" stroke-width="1"/>${dogAccessoryBackSvg(p,type,color)}<g class="dogv2-shelter-head-group">${dogEarSvg(p.ear,hx,earY,p.earSize,pal.dark,1)}${dogEarSvg(p.ear,hx,earY,p.earSize,pal.dark,0)}${dogHeadSvg(p,pal)}<g class="dogv2-shelter-head-markings" clip-path="url(#dogv2-shelter-head-clip)">${dogHeadMarkingSvg(p,pal)}</g>${dogMuzzleSvg(p,pal)}${dogEyeSvg(p,pal)}</g>${dogAccessoryFrontSvg(p,type,color)}</g></svg>`;}
function stopDogRuntime(){if(dogRuntime.timer)clearTimeout(dogRuntime.timer);if(dogRuntime.frame)cancelAnimationFrame(dogRuntime.frame);if(dogRuntime.watchdog)clearInterval(dogRuntime.watchdog);if(Number.isFinite(dogRuntime.x)&&dogRuntime.x>0){dogContinuity.x=dogRuntime.x;dogContinuity.bottom=dogRuntime.bottom;}if(dogRuntime.lastState&&!['shelter','recover'].includes(dogRuntime.lastState))dogContinuity.lastState=dogRuntime.lastState;dogContinuity.lastHazardMode=dogRuntime.hazardMode||dogContinuity.lastHazardMode;dogContinuity.shelterTarget=dogRuntime.shelterTarget||dogContinuity.shelterTarget;dogRuntime={timer:0,frame:0,watchdog:0,node:null,serial:dogRuntime.serial+1,lastState:'rest',x:0,bottom:0,moving:false,lastMotionAt:0,idleStreak:0,reducedMotion:false,source:null,birdsPresent:false,hazardKeys:[],hazardMode:'normal',shelterTarget:null,recovering:false};}
function dogReducedMotion(source){if(source?.weatherEffectRespectReducedMotion===false)return false;if(source?.motionPreference==='reduced')return true;return source?.motionPreference!=='full'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;}
function lowBirdTarget(){const vh=window.innerHeight||720,vw=window.innerWidth||1280,ground=sceneryClamp(vh*.035,18,54,28),dogCenter=(dogRuntime.x||0)+120,birds=[...document.querySelectorAll('.weather-fx-bird')].map(el=>({el,r:el.getBoundingClientRect()})).filter(row=>row.r.width>0&&row.r.top>vh*.16&&row.r.top<vh*.82);if(!birds.length)return null;birds.sort((a,b)=>Math.abs((a.r.left+a.r.width*.5)-dogCenter)-Math.abs((b.r.left+b.r.width*.5)-dogCenter));const row=birds[0],r=row.r,screenX=r.left+r.width*.5,chaseable=r.bottom>vh*.53;return {element:row.el,x:sceneryClamp(screenX-120,8,vw-190,30),bottom:ground+rand(-1,7),screenX,screenY:r.top+r.height*.5,chaseable};}
function dogElementInterestTarget(node){const vw=window.innerWidth||1280,vh=window.innerHeight||720,ground=sceneryClamp(vh*.035,18,54,28),els=[...document.querySelectorAll('#clock-block,#wx-left,#wx-right,.custom-block,#calendar-legend,#alert-zone')].filter(el=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>85&&r.height>28&&r.bottom>vh*.35&&r.top<vh*.90;});if(!els.length)return null;const r=els[Math.floor(Math.random()*els.length)].getBoundingClientRect(),leftX=sceneryClamp(r.left-172,8,vw-190,24),rightX=sceneryClamp(r.right+10,8,vw-190,24),x=Math.abs((dogRuntime.x||0)-leftX)<Math.abs((dogRuntime.x||0)-rightX)?leftX:rightX;return {x,bottom:ground+rand(-1,7),element:true};}
function dogOpenGroundX(preferred){const vw=window.innerWidth||1280,vh=window.innerHeight||720,maxX=Math.max(24,vw-190),blocks=[...document.querySelectorAll('#clock-block,#wx-left,#wx-right,.custom-block,#calendar-legend,#alert-zone')].map(el=>el.getBoundingClientRect()).filter(r=>r.width>80&&r.height>28&&r.bottom>vh*.64);const ok=x=>!blocks.some(r=>x+155>r.left&&x<r.right);let x=sceneryClamp(preferred,8,maxX,24);if(ok(x))return x;for(let i=0;i<10;i++){const c=rand(10,maxX);if(ok(c))return c;}return x;}
function dogApplyPosition(node,x,bottom){dogRuntime.x=x;dogRuntime.bottom=bottom;dogContinuity.x=x;dogContinuity.bottom=bottom;const ix=Math.round(x),iy=Math.round(bottom);if(node.dataset.dogX!==String(ix))node.dataset.dogX=String(ix);if(node.dataset.dogBottom!==String(iy))node.dataset.dogBottom=String(iy);node.style.transform=`translate3d(${x.toFixed(1)}px,${(-bottom).toFixed(1)}px,0)`;}
function dogFace(node,dx){if(Math.abs(dx)<1)return;const right=dx>0;node.dataset.direction=right?'right':'left';node.classList.toggle('dog-facing-right',right);node.classList.toggle('dog-facing-left',!right);}
function dogMoveTo(node,target,speed=78,serial=dogRuntime.serial){if(!node?.isConnected)return 0;if(dogRuntime.timer){clearTimeout(dogRuntime.timer);dogRuntime.timer=0;}if(dogRuntime.frame)cancelAnimationFrame(dogRuntime.frame);const x0=dogRuntime.x||Number(node.dataset.dogX)||0,y0=dogRuntime.bottom||Number(node.dataset.dogBottom)||0,x1=Number(target.x),y1=Number(target.bottom),dx=x1-x0,dy=y1-y0,distance=Math.max(1,Math.hypot(dx,dy)),duration=sceneryClamp(distance/Math.max(28,speed),1.15,10,4),bend=Math.abs(dy)>22?sceneryClamp(distance*.07,8,32,16)*(Math.random()<.5?-1:1):rand(-5,5),cx=(x0+x1)/2+rand(-Math.min(26,distance*.08),Math.min(26,distance*.08)),cy=(y0+y1)/2+bend,budget=performanceApi.visualPerformanceBudget(),caps=performanceApi.frontendCapabilities(),frameInterval=caps.pi3Class?Math.max(28,Number(budget.targetFrameMs)||33):14;dogFace(node,dx);node.classList.add('dog-moving');const step=sceneryClamp(34/speed,.30,.78,.48);node.style.setProperty('--dog-step-duration',`${step.toFixed(2)}s`);node.style.setProperty('--dog-step-delay',`${(-step*.5).toFixed(2)}s`);node.style.setProperty('--dog-stride',sceneryClamp(distance/(duration*85),.72,1.22,.92).toFixed(2));dogRuntime.moving=true;dogRuntime.lastMotionAt=Date.now();dogRuntime.idleStreak=0;const start=performance.now?performance.now():Date.now();let lastPaint=-Infinity;const tick=(now)=>{if(serial!==dogRuntime.serial||!node?.isConnected)return;const stamp=Number(now)||Date.now(),t=sceneryClamp((stamp-start)/(duration*1000),0,1,0);if(t<1&&stamp-lastPaint<frameInterval){dogRuntime.frame=requestAnimationFrame(tick);return;}lastPaint=stamp;const e=t*t*(3-2*t),omt=1-e,x=omt*omt*x0+2*omt*e*cx+e*e*x1,y=omt*omt*y0+2*omt*e*cy+e*e*y1;dogApplyPosition(node,x,y);dogRuntime.lastMotionAt=Date.now();if(t<1){dogRuntime.frame=requestAnimationFrame(tick);}else{dogRuntime.frame=0;dogRuntime.moving=false;node.classList.remove('dog-moving');dogApplyPosition(node,x1,y1);}};dogRuntime.frame=requestAnimationFrame(tick);return duration;}
function dogSetState(node,state){for(const cls of [...node.classList])if(cls.startsWith('dog-state-'))node.classList.remove(cls);node.classList.add(`dog-state-${state}`);node.dataset.dogState=state;dogRuntime.lastState=state;if(!['shelter','recover'].includes(state))dogContinuity.lastState=state;}
function dogHazardMode(hazardKeys=[]){const keys=new Set(hazardKeys||[]);if(keys.has('flood'))return 'flood';if(keys.has('tornado')||keys.has('tropical')||keys.has('fire')||keys.has('storm')||keys.has('winter'))return 'shelter';if(keys.has('wind')||keys.has('rain')||keys.has('snow')||keys.has('fog')||keys.has('heat')||keys.has('cold')||keys.has('fireworks'))return 'cautious';return 'normal';}
function dogShelterTarget(node,mode){const vw=window.innerWidth||1280,vh=window.innerHeight||720;if(dogRuntime.shelterTarget&&dogContinuity.lastHazardMode===mode)return dogRuntime.shelterTarget;const ground=sceneryClamp(vh*.035,18,54,28),safe=mode==='flood'?{x:dogOpenGroundX(sceneryClamp(vw*.12,18,vw-190,24)),bottom:Math.max(54,vh*.105),float:true}:{x:dogOpenGroundX(sceneryClamp(dogRuntime.x<vw*.5?vw*.07:vw*.72,18,vw-190,24)),bottom:ground,house:true};dogRuntime.shelterTarget=safe;dogContinuity.shelterTarget=safe;return safe;}
function dogRecoverFromHazard(node,source,birdsPresent,serial,hazardKeys=[]){const vw=window.innerWidth||1280,vh=window.innerHeight||720,ground=sceneryClamp(vh*.035,18,54,28),resume=dogContinuity.interruptedState||dogContinuity.lastState||'sniff',targetX=sceneryClamp((dogRuntime.x||vw*.15)+rand(-vw*.08,vw*.08),10,vw-190,28);dogRuntime.recovering=true;dogSetState(node,'recover');const duration=dogMoveTo(node,{x:targetX,bottom:ground+rand(-1,10)},58+sceneryClamp(source.weatherDogActivity,40,160,100)/100*18,serial);dogRuntime.timer=setTimeout(()=>{if(serial!==dogRuntime.serial||!node?.isConnected)return;dogRuntime.recovering=false;dogContinuity.lastHazardMode='normal';dogContinuity.shelterTarget=null;dogRuntime.shelterTarget=null;dogSetState(node,['rest','sit','sleep','sniff','wander'].includes(resume)?resume:'sniff');dogRuntime.timer=setTimeout(()=>dogNextState(node,source,birdsPresent,serial,hazardKeys),Math.round(rand(1800,4200)));},Math.round((duration+.8)*1000));return duration;}
function dogNextState(node,source,birdsPresent,serial,hazardKeys=[]){if(serial!==dogRuntime.serial||!node?.isConnected)return;const hazardMode=dogHazardMode(hazardKeys),activity=sceneryClamp(source.weatherDogActivity,40,160,100)/100,activeBias=sceneryClamp(.30+(activity-.4)*.29,.28,.67,.45),birdTarget=birdsPresent?lowBirdTarget():null,interest=dogElementInterestTarget(node);dogRuntime.hazardMode=hazardMode;node.classList.toggle('dog-shelter-flood',hazardMode==='flood');if((hazardMode==='normal'||hazardMode==='cautious')&&['flood','shelter'].includes(dogContinuity.lastHazardMode)&&!dogRuntime.recovering){node.classList.remove('dog-shelter-flood','dog-shelter-house');return dogRecoverFromHazard(node,source,birdsPresent,serial,hazardKeys);}if(hazardMode==='flood'||hazardMode==='shelter'){if(!['shelter','recover'].includes(dogRuntime.lastState))dogContinuity.interruptedState=dogRuntime.lastState||dogContinuity.lastState;if(dogContinuity.lastHazardMode!==hazardMode){dogContinuity.lastWorldChange=Date.now();dogRuntime.shelterTarget=null;}dogContinuity.lastHazardMode=hazardMode;dogSetState(node,'shelter');const safe=dogShelterTarget(node,hazardMode),distance=Math.hypot((dogRuntime.x||0)-safe.x,(dogRuntime.bottom||0)-safe.bottom),settled=distance<=18&&!dogRuntime.moving;node.classList.toggle('dog-shelter-house',hazardMode==='shelter'&&settled);if(distance>18&&!dogRuntime.moving){const duration=dogMoveTo(node,safe,hazardMode==='flood'?68:82,serial);dogRuntime.timer=setTimeout(()=>dogNextState(node,source,false,serial,hazardKeys),Math.round((duration+.6)*1000));}else dogRuntime.timer=setTimeout(()=>dogNextState(node,source,false,serial,hazardKeys),9000);return;}node.classList.remove('dog-shelter-flood','dog-shelter-house');if(dogContinuity.lastHazardMode!=='normal'&&dogContinuity.lastHazardMode!=='cautious')dogContinuity.lastHazardMode=hazardMode;
 const rows=[['rest',16],['sit',14],['sleep',Math.max(7,16-activeBias*6)],['sniff',15],['watch',9],['wander',13+activeBias*13],['inspect',interest?7+activeBias*4:0],['dig',4+activeBias*4],['roll',2+activeBias*2],['ball',4+activeBias*5]];if(hazardMode==='normal'&&birdTarget)rows.push(['bird',10+activeBias*8]);if(hazardMode==='cautious')for(const row of rows){if(['wander','ball','dig','roll','bird','inspect'].includes(row[0]))row[1]*=.12;if(['rest','sit','sleep','watch'].includes(row[0]))row[1]*=2.05;if(row[0]==='sniff')row[1]*=.72;}let state=choice(rows);if(state===dogRuntime.lastState&&Math.random()<.62)state=choice(rows.filter(r=>r[0]!==state));const locomotionStates=new Set(['wander','sniff','ball','bird','inspect','chase-bird']);if(locomotionStates.has(state))dogRuntime.idleStreak=0;else dogRuntime.idleStreak=(dogRuntime.idleStreak||0)+1;if(dogRuntime.idleStreak>=2&&hazardMode==='normal'){state=Math.random()<.58?'wander':Math.random()<.5?'sniff':'watch';dogRuntime.idleStreak=0;}dogSetState(node,state);const vw=window.innerWidth||1280,vh=window.innerHeight||720,ground=sceneryClamp(vh*.035,18,54,28);let delay=rand(7,17)/Math.max(.65,Math.sqrt(activity));
 if(state==='wander'){const targetX=dogOpenGroundX(rand(vw*.04,vw*.86)),targetY=ground+rand(-2,18),duration=dogMoveTo(node,{x:targetX,bottom:targetY},56+activity*27,serial);delay=duration+rand(2.5,6);}
 else if(state==='sniff'){const targetX=dogOpenGroundX(sceneryClamp(dogRuntime.x+rand(-vw*.07,vw*.07),8,vw-190,30)),duration=dogMoveTo(node,{x:targetX,bottom:ground+rand(-2,8)},42+activity*16,serial);delay=duration+rand(5,10);}
 else if(state==='inspect'&&interest){const duration=dogMoveTo(node,interest,44+activity*13,serial);delay=duration+rand(5,9);}
 else if(state==='ball'){const dir=dogRuntime.x>vw*.58?-1:1,targetX=dogOpenGroundX(sceneryClamp(dogRuntime.x+dir*rand(vw*.13,vw*.22),8,vw-190,30)),ballTravel=44;node.style.setProperty('--dog-ball-dir',String(dir));node.style.setProperty('--dog-ball-x',`${dir*ballTravel}px`);node.style.setProperty('--dog-ball-quarter-x',`${dir*Math.round(ballTravel*.24)}px`);node.style.setProperty('--dog-ball-mid-x',`${dir*Math.round(ballTravel*.52)}px`);node.style.setProperty('--dog-ball-three-quarter-x',`${dir*Math.round(ballTravel*.80)}px`);node.style.setProperty('--dog-ball-duration',`${sceneryClamp(1.02-(activity-1)*.15,.78,1.12,.96).toFixed(2)}s`);const duration=dogMoveTo(node,{x:targetX,bottom:ground+rand(-1,6)},70+activity*24,serial);delay=duration+rand(4,8);}
 else if(state==='bird'&&birdTarget){const live=birdTarget.element?.isConnected?birdTarget.element.getBoundingClientRect():null,screenX=live?.width?live.left+live.width*.5:birdTarget.screenX,dogCenter=(dogRuntime.x||0)+120;dogFace(node,screenX-dogCenter);if(birdTarget.chaseable&&Math.abs(screenX-dogCenter)>78){dogSetState(node,'chase-bird');const duration=dogMoveTo(node,{x:dogOpenGroundX(sceneryClamp(screenX-120,8,vw-190,30)),bottom:ground+rand(-1,6)},76+activity*24,serial);delay=duration+rand(1.3,3.0);}else{dogSetState(node,'watch-bird');delay=rand(3.5,7.5);}}
 else if(state==='sleep')delay=rand(20,40)/Math.max(.8,activity*.72);else if(state==='sit'||state==='rest'||state==='watch')delay=rand(9,21)/Math.max(.8,activity*.78);else if(state==='dig'||state==='roll')delay=rand(6,11)/Math.max(.8,activity);dogRuntime.timer=setTimeout(()=>dogNextState(node,source,birdsPresent,serial,hazardKeys),Math.round(delay*1000));}
function dogForceVisibleWalk(node,source,birdsPresent,serial,hazardKeys=[]){if(serial!==dogRuntime.serial||!node?.isConnected||dogRuntime.reducedMotion)return;const mode=dogHazardMode(hazardKeys);if(mode==='flood'||mode==='shelter')return dogNextState(node,source,false,serial,hazardKeys);const vw=window.innerWidth||1280,vh=window.innerHeight||720,ground=sceneryClamp(vh*.035,18,54,28),edge=Math.max(190,240*sceneryClamp(source.weatherDogSize,60,160,100)/100),span=Math.max(120,vw-edge-28),minTravel=Math.min(220,Math.max(90,vw*.12));let targetX=dogOpenGroundX(rand(18,span));if(Math.abs(targetX-dogRuntime.x)<minTravel)targetX=dogOpenGroundX(dogRuntime.x<span*.52?Math.min(span,dogRuntime.x+minTravel):Math.max(18,dogRuntime.x-minTravel));dogSetState(node,'wander');const duration=dogMoveTo(node,{x:targetX,bottom:ground+rand(-1,12)},62+sceneryClamp(source.weatherDogActivity,40,160,100)/100*22,serial);dogRuntime.timer=setTimeout(()=>dogNextState(node,source,birdsPresent,serial,hazardKeys),Math.round((duration+rand(2.2,4.8))*1000));}
function dogStartWatchdog(node,source,birdsPresent,serial,hazardKeys=[]){if(dogRuntime.watchdog)clearInterval(dogRuntime.watchdog);dogRuntime.watchdog=setInterval(()=>{if(serial!==dogRuntime.serial||!node?.isConnected||dogRuntime.reducedMotion)return;const state=dogRuntime.lastState,stale=Date.now()-(dogRuntime.lastMotionAt||0)>15000;if(stale&&!dogRuntime.moving&&!['sleep','shelter'].includes(state)){if(dogRuntime.timer)clearTimeout(dogRuntime.timer);dogForceVisibleWalk(node,source,birdsPresent,serial,hazardKeys);}},3000);}
function dogRuntimeSnapshot(){return {x:dogRuntime.x,bottom:dogRuntime.bottom,moving:dogRuntime.moving,lastState:dogRuntime.lastState,lastMotionAt:dogRuntime.lastMotionAt,serial:dogRuntime.serial};}
function startDogRuntime(node,source,birdsPresent=false,reducedMotion=false,hazardKeys=[]){const previousHazard=dogContinuity.lastHazardMode,previousX=dogContinuity.x,previousBottom=dogContinuity.bottom,previousInterrupted=dogContinuity.interruptedState;stopDogRuntime();dogContinuity.lastHazardMode=previousHazard;dogContinuity.x=previousX;dogContinuity.bottom=previousBottom;dogContinuity.interruptedState=previousInterrupted;dogRuntime.node=node;dogRuntime.reducedMotion=!!reducedMotion;dogRuntime.source=source;dogRuntime.birdsPresent=birdsPresent;dogRuntime.hazardKeys=[...(hazardKeys||[])];dogRuntime.hazardMode=dogHazardMode(hazardKeys);const serial=dogRuntime.serial,vw=window.innerWidth||1280,vh=window.innerHeight||720,ground=sceneryClamp(vh*.035,18,54,28),resumeFromHazard=['flood','shelter'].includes(previousHazard)&&['normal','cautious'].includes(dogRuntime.hazardMode),startX=Number.isFinite(previousX)?sceneryClamp(previousX,8,vw-190,vw*.12):rand(vw*.05,vw*.22),startBottom=Number.isFinite(previousBottom)?sceneryClamp(previousBottom,ground,vh-120,ground):ground;dogApplyPosition(node,startX,startBottom);dogRuntime.lastMotionAt=Date.now();node.dataset.direction='right';node.classList.add('dog-facing-right');if(reducedMotion){if(dogRuntime.hazardMode==='shelter'||dogRuntime.hazardMode==='flood'){const safe=dogShelterTarget(node,dogRuntime.hazardMode);dogApplyPosition(node,safe.x,safe.bottom);node.classList.toggle('dog-shelter-flood',dogRuntime.hazardMode==='flood');node.classList.toggle('dog-shelter-house',dogRuntime.hazardMode==='shelter');dogContinuity.lastHazardMode=dogRuntime.hazardMode;dogSetState(node,'shelter');}else{node.classList.remove('dog-shelter-flood','dog-shelter-house');dogSetState(node,'sit');}return;}dogStartWatchdog(node,source,birdsPresent,serial,hazardKeys);if(dogRuntime.hazardMode==='shelter'||dogRuntime.hazardMode==='flood'){dogNextState(node,source,birdsPresent,serial,hazardKeys);return;}if(resumeFromHazard){dogRecoverFromHazard(node,source,birdsPresent,serial,hazardKeys);return;}dogContinuity.lastHazardMode=dogRuntime.hazardMode;dogSetState(node,'sniff');dogRuntime.timer=setTimeout(()=>dogForceVisibleWalk(node,source,birdsPresent,serial,hazardKeys),Math.round(rand(700,1300)));}
function appendDogCompanion(frag,source,counts=null,reducedMotion=false,hazardKeys=[]){if(source.weatherDogCompanion!==true){stopDogRuntime();return false;}const breed=DOG_BREEDS.has(source.weatherDogBreed)?source.weatherDogBreed:'labrador',coat=dogVariantKey(breed,source.weatherDogVariant||source.weatherDogLabradorCoat),accessory=dogAccessorySettings(source),size=sceneryClamp(source.weatherDogSize,60,160,100)/100,opacity=sceneryClamp(source.weatherDogOpacity,20,100,100)/100,birds=Number(counts?.birds||0)+Number(counts?.owls||0),dog=document.createElement('span');dog.className=`weather-fx-dog weather-fx-dog-v2 weather-fx-dog-${breed}${breed==='labrador'?` weather-fx-dog-lab-${coat}`:''} dog-accessory-${accessory.type}`;dog.dataset.breed=breed;dog.dataset.family=dogBreedProfile(breed).family;dog.dataset.breedSignature=dogBreedSignature(breed,coat);dog.dataset.coat=coat;dog.dataset.variant=coat;dog.dataset.accessory=accessory.type;dog.dataset.accessoryColor=accessory.color;dog.dataset.collar=accessory.type==='none'?'none':(accessory.type==='bandana'?'bandana':'custom');dog.style.setProperty('--dog-size',size.toFixed(2));dog.style.setProperty('--dog-opacity',opacity.toFixed(2));dog.innerHTML=dogSvgMarkup(breed,coat,accessory.type,accessory.color);const hazardMode=dogHazardMode(hazardKeys);if(hazardMode==='shelter'){const house=document.createElement('span');house.className='dogv2-doghouse';house.innerHTML=`<i class="dogv2-doghouse-back"></i><span class="dogv2-house-head">${dogShelterHeadSvg(breed,coat,accessory.type,accessory.color)}</span><i class="dogv2-doghouse-front"></i>`;dog.appendChild(house);}if(hazardMode==='flood'){const floaty=document.createElement('span');floaty.className='dogv2-floaty';dog.appendChild(floaty);}const ball=document.createElement('b');ball.className='dogv2-ball';dog.appendChild(ball);const sleep=document.createElement('em');sleep.className='dogv2-sleep';sleep.textContent='z';dog.appendChild(sleep);const dirt=document.createElement('span');dirt.className='dogv2-dirt';dog.appendChild(dirt);frag.appendChild(dog);requestAnimationFrame(()=>startDogRuntime(dog,source,birds>0,reducedMotion||dogReducedMotion(source),hazardKeys));return true;}
function dateFromWeather(data){const raw=String(data?.current?.time||'');const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],12));const offset=Number(data?.utc_offset_seconds)||0;return new Date(Date.now()+offset*1000);}
function nthWeekday(year,month,weekday,n){const d=new Date(Date.UTC(year,month-1,1,12)),delta=(weekday-d.getUTCDay()+7)%7;return 1+delta+(n-1)*7;}
function lastWeekday(year,month,weekday){const d=new Date(Date.UTC(year,month,0,12));return d.getUTCDate()-((d.getUTCDay()-weekday+7)%7);}
function easterDate(year){let a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return {month,day};}
function isHanukkah(date){try{const fmt=new Intl.DateTimeFormat('en-u-ca-hebrew',{month:'long',day:'numeric'});for(let ago=0;ago<8;ago++){const d=new Date(date.getTime()-ago*86400000),parts=fmt.formatToParts(d),month=parts.find(p=>p.type==='month')?.value?.toLowerCase()||'',day=Number(parts.find(p=>p.type==='day')?.value);if(month.includes('kislev')&&day===25)return true;}}catch{}const starts={2025:[12,14],2026:[12,4],2027:[12,24],2028:[12,12],2029:[12,1],2030:[12,20],2031:[12,9],2032:[11,27],2033:[12,16],2034:[12,6],2035:[12,25]};const s=starts[date.getUTCFullYear()];if(!s)return false;const start=Date.UTC(date.getUTCFullYear(),s[0]-1,s[1],12),delta=Math.floor((date.getTime()-start)/86400000);return delta>=0&&delta<8;}
function activeHolidayKeys(data,source){if(holidayTestProfile!=='live')return HOLIDAY_KEYS.includes(holidayTestProfile)?[holidayTestProfile]:[];if(source.holidayOverlaysEnabled!==true)return [];const date=dateFromWeather(data),y=date.getUTCFullYear(),m=date.getUTCMonth()+1,d=date.getUTCDate(),wd=date.getUTCDay(),enabled=k=>source[HOLIDAY_CONFIG[k]]!==false,out=[];const add=(k,yes)=>{if(yes&&enabled(k))out.push(k);};add('new-year',(m===1&&d===1)||(m===12&&d===31));add('valentines',m===2&&d===14);add('st-patrick',m===3&&d===17);const easter=easterDate(y);add('easter',m===easter.month&&d===easter.day);add('memorial',m===5&&d===lastWeekday(y,5,1));add('juneteenth',m===6&&d===19);add('independence',m===7&&d===4);add('labor',m===9&&d===nthWeekday(y,9,1,1));add('halloween',m===10&&d===31);add('day-of-dead',m===11&&(d===1||d===2));add('veterans',m===11&&d===11);add('thanksgiving',m===11&&d===nthWeekday(y,11,4,4));add('hanukkah',isHanukkah(date));add('christmas',m===12&&d===25);return out.slice(0,2);}
function holidayOverlayActive(source,data){return holidayTestProfile!=='live'||(source.holidayOverlaysEnabled===true&&activeHolidayKeys(data,source).length>0);}
function holidayNode(tag,cls){const el=document.createElement(tag);el.className=cls;return el;}
function holidaySceneFoundation(key){return holidayNode('span',`holiday-foundation holiday-foundation-${key}`);}
function holidayMarkupNode(tag,cls,html){const el=holidayNode(tag,cls);el.innerHTML=html;return el;}
function holidayWebGeometry(variant=0){const hub=[12+variant*1.3,12+variant*.8],angles=[4,16,29,42,55,68,80,90],radii=[20,33,47,62,78,95,113,132],paths=[];for(const deg of angles){const a=deg*Math.PI/180,end=136-(variant%2)*4;paths.push(`M ${hub[0].toFixed(1)} ${hub[1].toFixed(1)} L ${(hub[0]+Math.cos(a)*end).toFixed(1)} ${(hub[1]+Math.sin(a)*end).toFixed(1)}`);}for(let ring=0;ring<radii.length;ring++){const r=radii[ring],pts=angles.map((deg,k)=>{const a=deg*Math.PI/180,jitter=((k+ring+variant)%3-1)*.8;return [hub[0]+Math.cos(a)*(r+jitter),hub[1]+Math.sin(a)*(r-jitter*.4)];});let d=`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;for(let k=1;k<pts.length;k++){const a=pts[k-1],b=pts[k],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2+Math.min(3.8,ring*.38+1.0);d+=` Q ${mx.toFixed(1)} ${my.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;}paths.push(d);}return paths;}
function holidayEdgeWeb(side=null,variant=null){const chosen=side||choice([['top-left',4],['top-right',4],['left',2],['right',2]]),v=variant==null?Math.floor(rand(0,3)):variant%3,web=holidayNode('span','holiday-web holiday-web-v4');web.dataset.webSide=chosen;web.dataset.webVariant=String(v);web.style.setProperty('--web-size',`${rand(17,25)}vw`);web.style.setProperty('--web-rotate',`${rand(-3.5,3.5)}deg`);if(chosen==='top-left'){web.style.setProperty('--web-left',`${rand(-1,3)}vw`);web.style.setProperty('--web-top',`${rand(-1,2)}vh`);}else if(chosen==='top-right'){web.style.setProperty('--web-left',`${rand(76,84)}vw`);web.style.setProperty('--web-top',`${rand(-1,2)}vh`);}else if(chosen==='left'){web.style.setProperty('--web-left',`${rand(-4,0)}vw`);web.style.setProperty('--web-top',`${rand(16,39)}vh`);}else{web.style.setProperty('--web-left',`${rand(83,89)}vw`);web.style.setProperty('--web-top',`${rand(16,39)}vh`);}web.innerHTML=`<svg viewBox="0 0 140 140" aria-hidden="true"><g class="web-lines">${holidayWebGeometry(v).map((d,n)=>`<path class="web-thread web-thread-${n<8?'spoke':'spiral'}" d="${d}"/>`).join('')}</g><circle class="web-hub" cx="${(12+v*1.3).toFixed(1)}" cy="${(12+v*.8).toFixed(1)}" r="1.5"/></svg>`;return web;}
function holidaySpiderNode(x,y,delay=0,scale=1){const spider=holidayNode('em','holiday-spider-v2');spider.style.setProperty('--holiday-x',`${x}vw`);spider.style.setProperty('--holiday-y',`${y}vh`);spider.style.setProperty('--holiday-delay',`${delay}s`);spider.style.setProperty('--spider-scale',scale.toFixed(2));spider.innerHTML='<i class="spider-thread"></i><svg viewBox="0 0 46 40" aria-hidden="true"><g class="spider-legs"><path d="M19 17 Q8 9 3 3 M18 20 Q7 17 1 15 M18 23 Q7 26 2 33 M20 25 Q12 34 10 39 M27 17 Q38 9 43 3 M28 20 Q39 17 45 15 M28 23 Q39 26 44 33 M26 25 Q34 34 36 39"/></g><ellipse class="spider-abdomen" cx="23" cy="22" rx="9" ry="11"/><circle class="spider-head" cx="23" cy="13" r="6"/><circle class="spider-eye" cx="20.5" cy="11.5" r="1"/><circle class="spider-eye" cx="25.5" cy="11.5" r="1"/></svg>';return spider;}
function holidayRabbitNode(scale=1,tone='gray'){
 const rabbit=holidayNode('b',`holiday-easter-rabbit holiday-easter-rabbit-${tone}${scale<1?' holiday-easter-rabbit-small':''}`);rabbit.style.setProperty('--rabbit-scale',String(scale.toFixed(2)));rabbit.style.setProperty('--holiday-delay',`${-rand(0,12)}s`);
 rabbit.innerHTML='<svg viewBox="0 0 120 72" role="presentation" aria-hidden="true"><ellipse class="rabbit-haunch" cx="38" cy="43" rx="26" ry="18"/><ellipse class="rabbit-body" cx="62" cy="42" rx="29" ry="17"/><ellipse class="rabbit-chest" cx="80" cy="39" rx="13" ry="15"/><ellipse class="rabbit-head" cx="92" cy="27" rx="15" ry="14"/><path class="rabbit-ear rabbit-ear-a" d="M84 16 C78 4 82 -7 88 -7 C94 -4 94 8 92 17 Z"/><path class="rabbit-ear rabbit-ear-b" d="M94 15 C92 2 98 -8 104 -5 C109 0 104 12 101 19 Z"/><circle class="rabbit-ear-inner" cx="87" cy="4" r="2.8"/><circle class="rabbit-ear-inner rabbit-ear-inner-b" cx="101" cy="3" r="2.6"/><circle class="rabbit-tail" cx="14" cy="39" r="10"/><path class="rabbit-hind-leg" d="M35 50 C25 54 23 63 35 64 L56 64 C59 60 55 55 48 52 Z"/><path class="rabbit-front-leg" d="M77 50 C75 57 78 63 90 63 L101 63 C101 59 96 56 90 54 L88 47 Z"/><circle class="rabbit-eye" cx="98" cy="25" r="2.1"/><ellipse class="rabbit-nose" cx="107" cy="31" rx="2.2" ry="1.6"/><path class="rabbit-mouth" d="M106 33 q-3 3 -6 1 M106 33 q3 3 5 1"/><path class="rabbit-whisker" d="M106 31 L118 28 M106 33 L119 34 M105 35 L116 40"/></svg>';return rabbit;
}
function holidayTurkeyNode(){
 const turkey=holidayNode('b','holiday-thanksgiving-turkey');turkey.innerHTML='<svg viewBox="0 0 132 104" role="presentation" aria-hidden="true"><g class="turkey-tail"><path d="M53 58 C7 42 5 8 27 10 C34 -1 49 2 53 16 C58 1 75 1 81 13 C99 5 113 19 102 36 C118 42 110 64 90 68 Z"/><path class="turkey-tail-mark" d="M25 20 L52 58 M51 11 L57 59 M76 17 L64 61 M99 31 L72 65"/></g><ellipse class="turkey-body" cx="65" cy="67" rx="31" ry="23"/><path class="turkey-wing" d="M47 59 q18 -9 30 7 q-10 14 -30 9 Z"/><g class="turkey-head-group"><path class="turkey-neck" d="M82 62 C85 49 83 39 89 33 C95 27 103 31 102 39 C100 48 94 56 93 65 Z"/><circle class="turkey-head" cx="97" cy="31" r="9"/><circle class="turkey-eye" cx="101" cy="29" r="1.5"/><path class="turkey-beak" d="M105 30 l13 4 -13 4 Z"/><path class="turkey-wattle" d="M100 38 q8 8 1 15 q-7 -6 -4 -15 Z"/></g><path class="turkey-leg" d="M55 84 L53 98 M75 85 L77 98 M49 98 l8 0 m14 0 h10"/></svg>';return turkey;
}
function holidayBannerNode(label,cls=''){const banner=holidayNode('i',`holiday-banner ${cls}`.trim());banner.textContent=label;return banner;}
function holidayFireworkNode(x,y,delay,hue,scale=1){
 const firework=holidayNode('span','holiday-firework-real');firework.style.setProperty('--firework-x',`${x}vw`);firework.style.setProperty('--firework-y',`${y}vh`);firework.style.setProperty('--firework-delay',`${delay}s`);firework.style.setProperty('--firework-hue',String(hue));firework.style.setProperty('--firework-scale',scale.toFixed(2));
 const rays=[];for(let i=0;i<16;i++){const a=(Math.PI*2*i/16)+(i%2?.035:-.025),r1=13+(i%3)*2,r2=47+(i%4)*4,x1=60+Math.cos(a)*r1,y1=60+Math.sin(a)*r1,x2=60+Math.cos(a)*r2,y2=60+Math.sin(a)*r2;rays.push(`<path class="firework-ray ray-${i%4}" d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${(60+Math.cos(a)*34+Math.sin(a)*2).toFixed(1)} ${(60+Math.sin(a)*34-Math.cos(a)*2).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`);}firework.innerHTML=`<svg viewBox="0 0 120 120" aria-hidden="true"><g class="firework-burst">${rays.join('')}<circle class="firework-core" cx="60" cy="60" r="3"/></g></svg>`;return firework;
}
function holidayCupidNode(){const cupid=holidayNode('b','holiday-cupid holiday-cupid-v3');cupid.innerHTML='<svg viewBox="0 0 138 92" role="presentation" aria-hidden="true"><g class="cupid-wing-group cupid-wing-back"><path class="cupid-wing" d="M50 45 C25 42 16 27 27 20 C17 7 35 1 47 13 C55 22 56 34 54 43 Z"/><path class="cupid-wing-line" d="M29 23 Q43 29 52 42"/></g><g class="cupid-wing-group cupid-wing-front"><path class="cupid-wing" d="M48 49 C27 57 27 76 42 72 C39 87 58 84 64 66 C66 57 58 51 53 47 Z"/><path class="cupid-wing-line" d="M38 63 Q51 59 59 49"/></g><g class="cupid-body-group"><circle class="cupid-head" cx="70" cy="29" r="12"/><path class="cupid-hair" d="M58 30 q0 -14 11 -14 q15 -2 17 13 q-6 -6 -11 -3 q-5 -6 -10 0 q-4 -4 -7 4 Z"/><circle class="cupid-eye" cx="74" cy="27" r="1.2"/><path class="cupid-smile" d="M74 33 q4 3 7 0"/><ellipse class="cupid-body" cx="70" cy="54" rx="12" ry="16"/><path class="cupid-sash" d="M59 52 Q70 60 82 51 L81 60 Q70 68 60 60 Z"/><path class="cupid-arm cupid-arm-back" d="M63 48 Q54 53 50 62"/><path class="cupid-arm cupid-arm-bow" d="M78 47 Q90 48 97 42"/><path class="cupid-arm cupid-arm-string" d="M80 53 Q92 58 98 55"/><path class="cupid-leg cupid-leg-a" d="M66 68 Q64 79 58 84"/><path class="cupid-leg cupid-leg-b" d="M74 69 Q79 78 86 81"/></g><g class="cupid-weapon"><path class="cupid-bow" d="M99 28 Q118 43 99 61"/><path class="cupid-string" d="M99 28 L91 45 L99 61"/><path class="cupid-arrow cupid-arrow-held" d="M88 45 L128 42"/><path class="cupid-arrowhead" d="M128 42 l-8 -5 l2 10 Z"/></g><g class="cupid-shot-group"><path class="cupid-shot-arrow" d="M93 45 L127 42"/><path class="cupid-shot-head" d="M127 42 l-7 -4 l2 9 Z"/></g></svg>';return cupid;}
function holidayPotGoldNode(){const pot=holidayNode('b','holiday-pot-gold holiday-pot-gold-v2');pot.innerHTML='<svg viewBox="0 0 120 88" aria-hidden="true"><ellipse class="gold-pile" cx="59" cy="30" rx="38" ry="17"/><g class="gold-coins"><circle cx="30" cy="29" r="7"/><circle cx="44" cy="20" r="8"/><circle cx="59" cy="24" r="8"/><circle cx="74" cy="18" r="7"/><circle cx="86" cy="29" r="8"/><circle cx="54" cy="12" r="6"/><circle cx="68" cy="11" r="6"/></g><path class="gold-pot" d="M20 33 Q59 44 99 33 L90 72 Q59 88 29 72 Z"/><ellipse class="gold-rim" cx="59" cy="35" rx="42" ry="10"/><path class="gold-shine" d="M39 49 Q42 65 52 70"/></svg>';return pot;}
function holidayLeprechaunNode(){const lep=holidayNode('b','holiday-leprechaun holiday-leprechaun-v2');lep.innerHTML='<svg viewBox="0 0 126 126" aria-hidden="true"><g class="lep-body-group"><path class="lep-hat" d="M38 24 L45 6 L86 6 L92 24 Z"/><rect class="lep-hat-band" x="39" y="19" width="54" height="9" rx="3"/><rect class="lep-hat-buckle" x="61" y="18" width="14" height="11" rx="1"/><rect class="lep-hat-brim" x="31" y="25" width="69" height="8" rx="4"/><circle class="lep-ear" cx="48" cy="43" r="4"/><circle class="lep-ear" cx="86" cy="43" r="4"/><circle class="lep-head" cx="67" cy="42" r="18"/><path class="lep-hair" d="M49 39 Q48 25 63 24 Q82 23 85 40 Q76 33 67 36 Q58 31 49 39 Z"/><path class="lep-brow" d="M56 36 q5 -3 9 0 M71 36 q5 -3 9 0"/><path class="lep-beard" d="M49 47 Q53 69 67 72 Q83 68 86 47 Q78 57 69 54 Q59 58 49 47 Z"/><circle class="lep-eye" cx="60" cy="40" r="1.6"/><circle class="lep-eye" cx="75" cy="40" r="1.6"/><path class="lep-smile" d="M61 48 Q68 53 75 48"/><path class="lep-torso" d="M47 68 Q66 60 87 69 L92 100 L42 100 Z"/><path class="lep-lapel lep-lapel-a" d="M51 69 L63 79 L57 86"/><path class="lep-lapel lep-lapel-b" d="M83 69 L71 79 L77 86"/><circle class="lep-button" cx="67" cy="76" r="2"/><circle class="lep-button" cx="67" cy="82" r="2"/><rect class="lep-belt" x="43" y="84" width="48" height="8" rx="2"/><rect class="lep-buckle" x="63" y="83" width="12" height="10" rx="1"/><path class="lep-arm lep-arm-pot" d="M48 72 Q31 80 25 95"/><circle class="lep-hand lep-hand-pot" cx="24" cy="97" r="5"/><path class="lep-arm lep-arm-coin" d="M86 72 Q104 77 107 61"/><circle class="lep-hand lep-hand-coin" cx="108" cy="59" r="5"/><path class="lep-leg lep-leg-a" d="M55 99 L50 120"/><path class="lep-leg lep-leg-b" d="M79 99 L86 120"/><path class="lep-shoe lep-shoe-a" d="M48 119 q-9 1 -12 6 h19 Z"/><path class="lep-shoe lep-shoe-b" d="M84 119 q11 0 15 6 H80 Z"/></g><circle class="lep-coin" cx="108" cy="50" r="6"/></svg>';return lep;}
function holidayChristmasTreeNode(){const tree=holidayNode('b','holiday-christmas-tree-v3');tree.innerHTML='<svg viewBox="0 0 220 290" aria-hidden="true"><ellipse class="xmas-tree-shadow" cx="110" cy="270" rx="78" ry="13"/><rect class="xmas-trunk" x="98" y="226" width="24" height="37" rx="4"/><ellipse class="xmas-skirt" cx="110" cy="259" rx="67" ry="16"/><g class="xmas-foliage"><path class="xmas-branch xmas-branch-top" d="M110 30 C96 47 84 54 90 66 C72 72 69 86 85 91 C96 95 104 87 110 80 C118 91 134 96 146 88 C158 80 150 69 135 64 C140 51 124 40 110 30 Z"/><path class="xmas-branch xmas-branch-mid" d="M110 62 C92 84 72 93 78 110 C55 119 46 136 64 147 C81 157 96 143 108 133 C120 149 145 158 163 145 C181 132 169 116 150 108 C155 91 130 75 110 62 Z"/><path class="xmas-branch xmas-branch-low" d="M110 106 C85 132 57 145 64 164 C35 175 24 196 48 210 C69 222 94 204 108 191 C124 210 160 220 183 203 C204 187 189 168 163 158 C168 138 138 119 110 106 Z"/><path class="xmas-branch xmas-branch-base" d="M110 149 C80 178 48 190 55 214 C26 224 20 245 46 254 C69 264 92 247 110 232 C131 251 168 265 194 247 C214 233 196 216 170 205 C171 184 142 162 110 149 Z"/></g><path class="xmas-garland" d="M83 94 Q111 107 142 92 M65 143 Q111 164 160 140 M49 199 Q110 225 176 194"/><g class="xmas-ornaments"><circle cx="98" cy="79" r="4.5"/><circle cx="125" cy="101" r="4.5"/><circle cx="83" cy="126" r="4.5"/><circle cx="139" cy="144" r="4.5"/><circle cx="101" cy="163" r="4.5"/><circle cx="155" cy="182" r="4.5"/><circle cx="70" cy="188" r="4.5"/><circle cx="117" cy="211" r="4.5"/><circle cx="150" cy="224" r="4.5"/><circle cx="87" cy="226" r="4.5"/></g><g class="xmas-lights"><circle cx="91" cy="105" r="3"/><circle cx="112" cy="114" r="3"/><circle cx="140" cy="109" r="3"/><circle cx="74" cy="154" r="3"/><circle cx="113" cy="168" r="3"/><circle cx="154" cy="156" r="3"/><circle cx="60" cy="210" r="3"/><circle cx="96" cy="223" r="3"/><circle cx="137" cy="218" r="3"/><circle cx="173" cy="211" r="3"/></g><path class="xmas-star" d="M110 3 l7 15 l17 2 l-13 11 l5 17 l-16 -9 l-16 9 l5 -17 l-13 -11 l17 -2 Z"/></svg>';return tree;}
function holidayChristmasFireplaceNode(){const fire=holidayNode('span','holiday-christmas-fireplace');fire.innerHTML='<i class="xmas-mantel-garland"></i><i class="xmas-mantel"></i><i class="xmas-fireplace-body"></i><i class="xmas-firebox"><b class="xmas-log log-a"></b><b class="xmas-log log-b"></b><b class="xmas-flame flame-a"></b><b class="xmas-flame flame-b"></b><b class="xmas-flame flame-c"></b></i><i class="xmas-stocking stocking-a"></i><i class="xmas-stocking stocking-b"></i><i class="xmas-stocking stocking-c"></i>';return fire;}
function holidayChristmasLightsNode(){const lights=holidayNode('span','holiday-christmas-lights');lights.innerHTML='<i class="xmas-light-wire"></i>'+Array.from({length:15},(_,i)=>`<b class="xmas-light-bulb bulb-${i%5}" style="--xmas-bulb-x:${4+i*6.6}% ;--xmas-bulb-delay:${(-i*.19).toFixed(2)}s"></b>`).join('');return lights;}
function holidayCornstalkNode(x,scale=1){const corn=holidayNode('span','holiday-thanks-cornstalk');corn.style.setProperty('--corn-x',`${x}vw`);corn.style.setProperty('--corn-scale',scale.toFixed(2));corn.innerHTML='<i class="corn-stem"></i><i class="corn-leaf corn-leaf-a"></i><i class="corn-leaf corn-leaf-b"></i><i class="corn-ear"></i>';return corn;}
function holidayHarvestBasketNode(){const basket=holidayNode('span','holiday-thanks-basket');basket.innerHTML='<i class="basket-body"></i><i class="basket-handle"></i><i class="basket-apple apple-a"></i><i class="basket-apple apple-b"></i><i class="basket-gourd"></i>';return basket;}
function holidayFlagNode(cls){return holidayMarkupNode('span',`holiday-flag ${cls}`,'<i class="holiday-flag-field"></i><i class="holiday-flag-pole"></i>');}
function holidayPoppyNode(x,delay){const p=holidayNode('i','holiday-poppy');p.style.setProperty('--holiday-x',`${x}vw`);p.style.setProperty('--holiday-delay',`${delay}s`);return p;}
function holidayDreidelNode(x,delay){const d=holidayNode('i','holiday-dreidel');d.style.setProperty('--holiday-x',`${x}vw`);d.style.setProperty('--holiday-delay',`${delay}s`);return d;}
function holidaySceneTitle(scene,label,cls){scene.appendChild(holidayBannerNode(label,cls));}
function addHolidayParticles(scene,kind,total,count){for(let i=0;i<count(total);i++){const n=holidayNode('i',kind);n.style.setProperty('--holiday-x',`${rand(2,98)}vw`);n.style.setProperty('--holiday-y',`${rand(4,82)}vh`);n.style.setProperty('--holiday-delay',`${-rand(0,10)}s`);n.style.setProperty('--holiday-hue',String(Math.round(rand(0,360))));scene.appendChild(n);}}
function appendHolidayOverlays(frag,source,data,constrained=false,world=null){
 const keys=activeHolidayKeys(data,source);if(!keys.length)return keys;
 const worldFactor=sceneryClamp(world?.holidayFactor,0.2,1,1),intensity=sceneryClamp(source.holidayOverlayIntensity,20,150,100)/100*worldFactor;
 for(const key of keys){
  const scene=holidayNode('span',`holiday-overlay holiday-overlay-${key} holiday-overlay-world-${world?.holidayMode||'normal'}`);scene.dataset.holiday=key;scene.dataset.worldMode=world?.mode||'normal';scene.style.setProperty('--holiday-intensity',intensity.toFixed(2));scene.style.setProperty('--holiday-world-opacity',worldFactor.toFixed(2));scene.appendChild(holidaySceneFoundation(key));
  const budget=performanceApi.visualPerformanceBudget(),count=(n)=>Math.max(1,Math.round(n*(constrained?budget.holidayScale:1)*intensity));
  if(key==='new-year'){
   holidaySceneTitle(scene,'HAPPY NEW YEAR','holiday-banner-new-year');scene.appendChild(holidayNode('em','holiday-newyear-clock'));scene.appendChild(holidayNode('em','holiday-newyear-skyline'));for(let i=0;i<count(5);i++)scene.appendChild(holidayFireworkNode(16+i*17+rand(-4,4),12+rand(0,24),-rand(0,8),Math.round(rand(0,360)),.78+rand(0,.38)));addHolidayParticles(scene,'holiday-confetti',16,count);
  }else if(key==='valentines'){
   scene.appendChild(holidayCupidNode());scene.appendChild(holidayNode('em','holiday-valentine-rose rose-a'));scene.appendChild(holidayNode('em','holiday-valentine-rose rose-b'));scene.appendChild(holidayNode('em','holiday-valentine-ground-glow'));addHolidayParticles(scene,'holiday-heart',10,count);
  }else if(key==='st-patrick'){
   scene.appendChild(holidayPotGoldNode());scene.appendChild(holidayLeprechaunNode());scene.appendChild(holidayNode('em','holiday-rainbow'));addHolidayParticles(scene,'holiday-clover',10,count);
  }else if(key==='easter'){
   for(let i=0;i<count(5);i++){const egg=holidayNode('i','holiday-egg');egg.style.setProperty('--holiday-x',`${12+i*16+rand(-2,2)}vw`);egg.style.setProperty('--holiday-hue',String(Math.round(rand(0,360))));scene.appendChild(egg);}scene.appendChild(holidayRabbitNode(1,'brown'));scene.appendChild(holidayRabbitNode(.82,'gray'));
  }else if(key==='memorial'){
   holidaySceneTitle(scene,'MEMORIAL DAY · REMEMBER & HONOR','holiday-banner-memorial');scene.appendChild(holidayFlagNode('holiday-flag-halfstaff'));scene.appendChild(holidayNode('em','holiday-memorial-wreath'));for(let i=0;i<count(7);i++)scene.appendChild(holidayPoppyNode(18+i*10+rand(-2,2),-rand(0,6)));
  }else if(key==='juneteenth'){
   holidaySceneTitle(scene,'JUNETEENTH · FREEDOM DAY','holiday-banner-juneteenth');scene.appendChild(holidayNode('em','holiday-juneteenth-flag'));scene.appendChild(holidayNode('em','holiday-juneteenth-starburst'));addHolidayParticles(scene,'holiday-juneteenth-spark',8,count);
  }else if(key==='independence'){
   scene.appendChild(holidayFlagNode('holiday-flag-independence'));scene.appendChild(holidayNode('em','holiday-patriotic-bunting'));for(let i=0;i<count(4);i++)scene.appendChild(holidayFireworkNode(28+i*18+rand(-4,4),14+rand(0,22),-rand(0,7),i%3===0?0:i%3===1?220:45,.8+rand(0,.25)));addHolidayParticles(scene,'holiday-patriotic-star',10,count);
  }else if(key==='labor'){
   holidaySceneTitle(scene,'LABOR DAY · HONORING WORKERS','holiday-banner-labor');scene.appendChild(holidayNode('em','holiday-labor-skyline'));scene.appendChild(holidayNode('em','holiday-labor-gear gear-a'));scene.appendChild(holidayNode('em','holiday-labor-gear gear-b'));scene.appendChild(holidayNode('em','holiday-labor-stripe'));
  }else if(key==='halloween'){
   scene.appendChild(holidayEdgeWeb('top-left',0));scene.appendChild(holidayEdgeWeb('top-right',1));scene.appendChild(holidayNode('em','holiday-halloween-moon'));scene.appendChild(holidayNode('em','holiday-halloween-ground-mist'));scene.appendChild(holidaySpiderNode(13,26,-2.4,.86));scene.appendChild(holidaySpiderNode(84,31,-5.1,.68));for(let i=0;i<count(3);i++){const pumpkin=holidayNode('i','holiday-pumpkin');pumpkin.style.setProperty('--holiday-x',`${12+i*34+rand(-2,2)}vw`);scene.appendChild(pumpkin);}for(let i=0;i<count(5);i++){const bat=holidayNode('b','holiday-bat');bat.style.setProperty('--holiday-y',`${rand(12,40)}vh`);bat.style.setProperty('--holiday-delay',`${-rand(0,9)}s`);scene.appendChild(bat);}for(let i=0;i<count(2);i++){const ghost=holidayNode('b','holiday-ghost');ghost.style.setProperty('--holiday-x',`${rand(20,78)}vw`);ghost.style.setProperty('--holiday-y',`${rand(22,48)}vh`);ghost.style.setProperty('--holiday-delay',`${-rand(0,8)}s`);scene.appendChild(ghost);}
  }else if(key==='day-of-dead'){
   scene.appendChild(holidayNode('i','holiday-papel'));scene.appendChild(holidayNode('em','holiday-dayofdead-altar'));for(let i=0;i<count(16);i++){const petal=holidayNode('b','holiday-marigold');petal.style.setProperty('--holiday-x',`${rand(0,100)}vw`);petal.style.setProperty('--holiday-delay',`${-rand(0,10)}s`);scene.appendChild(petal);}scene.appendChild(holidayNode('em','holiday-calavera'));
  }else if(key==='veterans'){
   holidaySceneTitle(scene,'VETERANS DAY · HONORING ALL WHO SERVED','holiday-banner-veterans');scene.appendChild(holidayFlagNode('holiday-flag-veterans'));scene.appendChild(holidayNode('em','holiday-veterans-stars'));scene.appendChild(holidayNode('em','holiday-veterans-horizon'));
  }else if(key==='thanksgiving'){
   scene.appendChild(holidayNode('em','holiday-thanks-horizon'));scene.appendChild(holidayCornstalkNode(5,.9));scene.appendChild(holidayCornstalkNode(84,1.05));scene.appendChild(holidayTurkeyNode());scene.appendChild(holidayHarvestBasketNode());scene.appendChild(holidayNode('em','holiday-thanks-harvest'));scene.appendChild(holidayNode('em','holiday-thanks-pumpkin pumpkin-a'));scene.appendChild(holidayNode('em','holiday-thanks-pumpkin pumpkin-b'));for(let i=0;i<count(6);i++){const leaf=holidayNode('i','holiday-thanks-leaf');leaf.style.setProperty('--holiday-x',`${rand(0,100)}vw`);leaf.style.setProperty('--holiday-delay',`${-rand(0,10)}s`);scene.appendChild(leaf);}
  }else if(key==='hanukkah'){
   holidaySceneTitle(scene,'HAPPY HANUKKAH','holiday-banner-hanukkah');scene.appendChild(holidayNode('em','holiday-hanukkah-glow'));const menorah=holidayNode('i','holiday-menorah');for(let i=0;i<9;i++){const candle=holidayNode('b','holiday-candle');candle.style.setProperty('--candle-i',String(i));candle.style.setProperty('--candle-x',`${12+i*19}px`);candle.style.setProperty('--candle-h',`${i===4?58:42}px`);menorah.appendChild(candle);}scene.appendChild(menorah);scene.appendChild(holidayDreidelNode(72,-1));scene.appendChild(holidayDreidelNode(82,-3.2));addHolidayParticles(scene,'holiday-sparkle',10,count);
  }else if(key==='christmas'){
   scene.appendChild(holidayNode('em','holiday-christmas-room-glow'));scene.appendChild(holidayChristmasLightsNode());scene.appendChild(holidayChristmasFireplaceNode());scene.appendChild(holidayChristmasTreeNode());scene.appendChild(holidayNode('em','holiday-christmas-gift gift-a'));scene.appendChild(holidayNode('em','holiday-christmas-gift gift-b'));scene.appendChild(holidayNode('em','holiday-christmas-gift gift-c'));scene.appendChild(holidayNode('em','holiday-christmas-gift gift-d'));scene.appendChild(holidayNode('em','holiday-christmas-floor-glow'));
  }
  frag.appendChild(scene);
 }
 return keys;
}
function holidayOverlayTestState(){return {active:holidayTestProfile!=='live',profile:holidayTestProfile,label:HOLIDAY_LABELS[holidayTestProfile]||'Calendar date'};}
function setHolidayOverlayTestProfile(value='live'){holidayTestProfile=HOLIDAY_KEYS.includes(value)?value:'live';const select=document.getElementById('s-holiday-overlay-test');if(select)select.value=holidayTestProfile;if(typeof holidayRefresh==='function')holidayRefresh();return holidayOverlayTestState();}
function registerHolidayRefresh(fn){holidayRefresh=typeof fn==='function'?fn:null;}
function initHolidayControls(){const select=document.getElementById('s-holiday-overlay-test'),preview=document.getElementById('s-holiday-overlay-preview'),stop=document.getElementById('s-holiday-overlay-stop');select?.addEventListener('change',()=>setHolidayOverlayTestProfile(select.value));preview?.addEventListener('click',()=>{if((select?.value||'live')==='live'){if(select)select.value='christmas';}setHolidayOverlayTestProfile(select?.value||'christmas');if(typeof globalThis.previewDashboardFromSettings==='function')globalThis.previewDashboardFromSettings();});stop?.addEventListener('click',()=>setHolidayOverlayTestProfile('live'));}
queueMicrotask(initHolidayControls);
LibreDisplayRuntime.exposeModule('weatherScenery',{DOG_BREEDS,DOG_PROFILES,DOG_VARIANTS,LABRADOR_COATS,DOG_COLLARS,DOG_ACCESSORIES,DOG_ACCESSORY_DEFAULT_COLOR,dogBreedProfile,dogVariantCatalog,dogVariantKey,dogVariantOptions,dogResolvedProfile,dogBreedSignature,dogAccessoryColor,dogAccessorySettings,dogBodySvg,dogNeckSvg,dogHeadSvg,dogMuzzleSvg,dogLegSvg,dogRestLegSvg,dogCollarSvg,dogBandanaSvg,dogAccessorySvg,dogSvgMarkup,dogShelterHeadSvg,dogMoveTo,dogRuntimeSnapshot,HOLIDAY_KEYS,HOLIDAY_NATURE_POLICIES,holidayNaturePolicy,HOLIDAY_CONFIG,HOLIDAY_LABELS,holidayWebGeometry,appendDogCompanion,stopDogRuntime,activeHolidayKeys,holidayOverlayActive,appendHolidayOverlays,holidayOverlayTestState,setHolidayOverlayTestProfile,registerHolidayRefresh,initHolidayControls},{},{globalFunctions:[],globalStates:[]});
}
// End source section: /js/weather/scenery.js

// LibreDisplay source section: /js/weather/canvas.js
{
const performanceApi=LibreDisplayRuntime.getModule('performance');
let canvasState={canvas:null,ctx:null,host:null,raf:0,lastFrame:0,lastPaint:0,width:0,height:0,pixelWidth:0,pixelHeight:0,renderScale:1,sceneKey:'',particles:[],running:false,frames:0,resizeObserver:null,visible:true};

function canvasClamp(value,lo,hi,fallback=lo){value=Number(value);return Math.min(hi,Math.max(lo,Number.isFinite(value)?value:fallback));}
function canvasSeed(index,salt=0){const x=Math.sin((index+1)*12.9898+(salt+1)*78.233)*43758.5453;return x-Math.floor(x);}
function piCanvasSupported(source={}){const caps=performanceApi.frontendCapabilities(),budget=performanceApi.visualPerformanceBudget();return !!(caps.piClass&&budget.motionAllowed!==false&&source.lightweightModeEnabled!==true&&!document.documentElement.classList.contains('ld-reduce-motion'));}
function piCanvasHostVisible(){const host=canvasState.host,root=document.documentElement;if(!host?.isConnected||document.hidden)return false;if(root.classList.contains('ld-bench-no-canvas')||root.classList.contains('ld-bench-no-overlay')||root.classList.contains('ld-bench-minimal'))return false;return canvasState.visible!==false&&host.classList.contains('show');}
function ensurePiCanvas(host){if(canvasState.canvas?.isConnected&&canvasState.host===host)return canvasState.canvas;stopPiCanvasScene();const canvas=document.createElement('canvas');canvas.className='weather-fx-pi-canvas';canvas.setAttribute('aria-hidden','true');host.appendChild(canvas);canvasState={...canvasState,canvas,ctx:canvas.getContext('2d',{alpha:true,desynchronized:true}),host,running:true,lastFrame:0,lastPaint:0,frames:0,particles:[],visible:host.classList.contains('show')};resizePiCanvas();if(typeof ResizeObserver==='function'){canvasState.resizeObserver=new ResizeObserver(()=>resizePiCanvas());canvasState.resizeObserver.observe(host);}return canvas;}
function piCanvasRenderScale(){const budget=performanceApi.visualPerformanceBudget(),caps=performanceApi.frontendCapabilities(),tier=budget.resolutionTier||'standard',quality=Math.max(.20,Math.min(1,Number(budget.adaptiveQuality)||1));if(caps.pi4Class&&budget.rescueMode)return tier==='4k'?.18:tier==='highres'?.22:.30;const base=caps.pi3Class?(tier==='4k'?.22:tier==='highres'?.30:.42):(tier==='4k'?.20:tier==='highres'?.38:.50),floor=caps.pi3Class?.20:(tier==='4k'?.18:tier==='highres'?.24:.30);return Math.max(floor,Math.min(.72,base*(.84+quality*.16)));}
function resizePiCanvas(){const canvas=canvasState.canvas,host=canvasState.host;if(!canvas||!host)return;const rect=host.getBoundingClientRect(),width=Math.max(1,Math.round(rect.width||innerWidth||1280)),height=Math.max(1,Math.round(rect.height||innerHeight||720)),scale=piCanvasRenderScale(),pixelWidth=Math.max(1,Math.round(width*scale)),pixelHeight=Math.max(1,Math.round(height*scale));if(width===canvasState.width&&height===canvasState.height&&pixelWidth===canvasState.pixelWidth&&pixelHeight===canvasState.pixelHeight)return;canvasState.width=width;canvasState.height=height;canvasState.pixelWidth=pixelWidth;canvasState.pixelHeight=pixelHeight;canvasState.renderScale=scale;canvas.width=pixelWidth;canvas.height=pixelHeight;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;canvasState.ctx?.setTransform(scale,0,0,scale,0,0);}
function particle(kind,index,total,wind,source){const w=canvasState.width||innerWidth||1280,h=canvasState.height||innerHeight||720,x=canvasSeed(index,1)*w,y=canvasSeed(index,2)*h,depth=.45+canvasSeed(index,3)*.55,windPx=(Number(wind?.direction)||0)*(Number(wind?.strength)||0)*28;let vx=windPx*(.22+depth*.34),vy=50,size=2,alpha=.7,spin=(canvasSeed(index,5)-.5)*1.8;if(kind==='rain'){vy=520+depth*380;vx+=windPx*1.6;size=8+depth*13;alpha=.35+depth*.48;}else if(kind==='snow'){vy=32+depth*54;vx+=windPx*.75;size=1.4+depth*2.4;alpha=.48+depth*.42;}else if(kind==='leaves'){const leafScale=canvasClamp(source?.weatherSeasonLeavesSize,30,200,100)/100,leafOpacity=canvasClamp(source?.weatherSeasonLeavesOpacity,0,100,100)/100;vy=28+depth*40;vx+=windPx*.65;size=(7+depth*5)*leafScale;alpha=(.60+depth*.34)*leafOpacity;}else if(kind==='grass'){vy=0;vx=0;size=Math.max(16,h*(.026+canvasSeed(index,10)*.055));alpha=.34+depth*.42;}else if(kind==='birds'||kind==='owls'){vy=(canvasSeed(index,11)-.5)*4;vx=(kind==='owls'?18:28)+depth*(kind==='owls'?20:34)+Math.abs(windPx)*.18;size=(kind==='owls'?8:6)+depth*(kind==='owls'?8:7);alpha=.48+depth*.38;}else if(kind==='petals'){vy=22+depth*30;vx+=windPx*.42;size=2+depth*2.8;alpha=.50+depth*.38;}else if(kind==='crystals'){vy=24+depth*32;vx+=windPx*.28;size=1.8+depth*2.6;alpha=.38+depth*.42;}else if(kind==='fireflies'){vy=(canvasSeed(index,6)-.5)*8;vx=(canvasSeed(index,7)-.5)*13;size=1.2+depth*1.8;alpha=.42+depth*.44;}const groundY=kind==='grass'?h*(.90+canvasSeed(index,12)*.095):y,birdY=(kind==='birds'||kind==='owls')?h*(.10+canvasSeed(index,13)*.48):groundY;return {kind,x,y:birdY,vx,vy,size,alpha,spin,angle:canvasSeed(index,8)*Math.PI*2,phase:canvasSeed(index,9)*Math.PI*2,total,source,depth};}
function distributeCanvasParticles(scene){const budget=performanceApi.visualPerformanceBudget(),caps=performanceApi.frontendCapabilities(),max=Math.max(24,Number(budget.maxParticles)||48),primaryKind=scene.condition==='snow'?'snow':(['rain','storm'].includes(scene.condition)?'rain':''),primaryRequested=primaryKind?Math.max(0,Number(scene.count)||0):0,season=scene.seasonalCounts||{},detailedCap=Math.max(0,Number(budget.maxDetailedFlyingWildlife)||1),secondaryKinds=caps.pi4Class?['leaves','grass','petals','crystals','fireflies']:['leaves','grass','petals','crystals','fireflies','birds','owls'];let detailedLeft=detailedCap;const requested=secondaryKinds.map(kind=>{let n=Math.max(0,Number(season[kind])||0);if(kind==='birds'||kind==='owls'){const detailed=Math.min(n,detailedLeft);n-=detailed;detailedLeft-=detailed;}return [kind,n];}),primaryCap=primaryRequested?Math.max(10,Math.round(max*.62)):0,rows=[];if(primaryRequested)rows.push([primaryKind,Math.min(primaryRequested,primaryCap)]);let left=max-rows.reduce((n,r)=>n+r[1],0),secondaryTotal=requested.reduce((n,r)=>n+r[1],0);for(const [kind,n] of requested){if(!n||left<=0)continue;const minimum=(kind==='grass'&&n>0)?Math.min(n,6):(kind==='birds'||kind==='owls')?Math.min(n,1):1,share=secondaryTotal?Math.max(minimum,Math.round(left*n/secondaryTotal)):0,amount=Math.min(n,share,left);rows.push([kind,amount]);left-=amount;}return rows;}
function buildCanvasParticles(scene){const rows=distributeCanvasParticles(scene),out=[];let offset=0;for(const [kind,count] of rows){for(let i=0;i<count;i++)out.push(particle(kind,offset+i,count,scene.wind,scene.source));offset+=count+37;}return out;}
function drawRain(ctx,p){ctx.globalAlpha=p.alpha;ctx.strokeStyle='rgba(205,229,245,.92)';ctx.lineWidth=Math.max(.6,p.size*.075);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.012,p.y-p.size);ctx.stroke();}
function drawSnow(ctx,p){ctx.globalAlpha=p.alpha;ctx.fillStyle='#f5fbff';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}
const leafSpriteCache=new Map();
function leafSprite(bucket){const key=Math.max(0,Math.min(7,Math.round(bucket)||0));if(leafSpriteCache.has(key))return leafSpriteCache.get(key);const sprite=typeof OffscreenCanvas==='function'?new OffscreenCanvas(72,52):document.createElement('canvas');sprite.width=72;sprite.height=52;const c=sprite.getContext?.('2d',{alpha:true});if(!c){leafSpriteCache.set(key,null);return null;}const s=24,hue=18+key*5,ox=36,oy=26;c.translate(ox,oy);c.fillStyle=`hsl(${hue} 72% 46%)`;c.beginPath();c.moveTo(-s*1.12,0);c.bezierCurveTo(-s*.72,-s*.18,-s*.78,-s*.68,-s*.28,-s*.52);c.bezierCurveTo(-s*.05,-s*.82,s*.18,-s*.60,s*.30,-s*.46);c.bezierCurveTo(s*.72,-s*.58,s*.86,-s*.18,s*1.14,0);c.bezierCurveTo(s*.78,s*.15,s*.72,s*.58,s*.30,s*.48);c.bezierCurveTo(s*.10,s*.72,-s*.12,s*.60,-s*.28,s*.48);c.bezierCurveTo(-s*.72,s*.62,-s*.78,s*.18,-s*1.12,0);c.closePath();c.fill();c.strokeStyle='rgba(92,50,22,.72)';c.lineWidth=2;c.beginPath();c.moveTo(-s*1.28,0);c.lineTo(s*.78,0);c.stroke();c.strokeStyle='rgba(101,58,28,.75)';c.lineWidth=1.7;c.beginPath();c.moveTo(-s*1.08,0);c.lineTo(-s*1.34,s*.10);c.stroke();leafSpriteCache.set(key,sprite);return sprite;}
function drawLeaf(ctx,p){const s=p.size,bucket=Math.round(((p.phase%(Math.PI*2))/(Math.PI*2))*7),sprite=leafSprite(bucket);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.globalAlpha=p.alpha;if(sprite)ctx.drawImage(sprite,-s*1.5,-s*1.08,s*3,s*2.16);else{const hue=18+bucket*5;ctx.fillStyle=`hsl(${hue} 72% 46%)`;ctx.beginPath();ctx.ellipse(0,0,s*1.15,s*.68,0,0,Math.PI*2);ctx.fill();}ctx.restore();}
function drawPetal(ctx,p){ctx.globalAlpha=p.alpha;ctx.fillStyle='rgba(248,178,213,.95)';ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*.56,.45,0,Math.PI*2);ctx.fill();ctx.restore();}
function drawCrystal(ctx,p){ctx.globalAlpha=p.alpha;ctx.strokeStyle='rgba(220,244,255,.88)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x-p.size,p.y);ctx.lineTo(p.x+p.size,p.y);ctx.moveTo(p.x,p.y-p.size);ctx.lineTo(p.x,p.y+p.size);ctx.stroke();}
function drawFirefly(ctx,p,now){const pulse=.45+.55*Math.sin(now*.003+p.phase)**2;ctx.globalAlpha=p.alpha*pulse;ctx.fillStyle='rgba(255,235,111,.95)';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}
function drawGrass(ctx,p,now){const sway=Math.sin(now*.0016+p.phase)*(2.5+p.depth*4.5),h=p.size,w=Math.max(1.1,h*.032);ctx.globalAlpha=p.alpha;ctx.strokeStyle=p.depth>.72?'rgba(74,132,62,.80)':'rgba(57,111,54,.70)';ctx.lineWidth=w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+sway*.35,p.y-h*.55,p.x+sway,p.y-h);ctx.moveTo(p.x+3,p.y);ctx.quadraticCurveTo(p.x+2-sway*.22,p.y-h*.36,p.x-sway*.55,p.y-h*.72);ctx.moveTo(p.x-3,p.y);ctx.quadraticCurveTo(p.x-2+sway*.18,p.y-h*.30,p.x+sway*.38,p.y-h*.60);ctx.stroke();}
function drawBird(ctx,p,now){const flap=Math.sin(now*(p.kind==='owls'?.006:.011)+p.phase),wing=p.size*(.85+Math.abs(flap)*.62),body=p.size*.75;ctx.globalAlpha=p.alpha;ctx.strokeStyle=p.kind==='owls'?'rgba(183,174,157,.88)':'rgba(55,66,76,.86)';ctx.fillStyle=p.kind==='owls'?'rgba(117,106,91,.88)':'rgba(64,76,86,.88)';ctx.lineWidth=Math.max(1,p.size*.12);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x-wing,p.y+flap*p.size*.20);ctx.quadraticCurveTo(p.x-wing*.42,p.y-p.size*(.42+.18*flap),p.x,p.y);ctx.quadraticCurveTo(p.x+wing*.42,p.y-p.size*(.42+.18*flap),p.x+wing,p.y+flap*p.size*.20);ctx.stroke();ctx.beginPath();ctx.ellipse(p.x,p.y+1,body,Math.max(1.3,p.size*.22),0,0,Math.PI*2);ctx.fill();}
function resetParticle(p,w,h){if(p.y>h+30){p.y=-20;p.x=(p.x+canvasSeed(Math.round(p.x+p.size),11)*w*.35)%w;}if(p.x>w+40)p.x=-30;if(p.x<-40)p.x=w+30;}
function paintPiCanvas(now,dt){const ctx=canvasState.ctx,w=canvasState.width,h=canvasState.height;if(!ctx||!w||!h)return;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvasState.pixelWidth,canvasState.pixelHeight);ctx.restore();ctx.setTransform(canvasState.renderScale,0,0,canvasState.renderScale,0,0);for(const p of canvasState.particles){const staticGround=p.kind==='grass',flying=p.kind==='birds'||p.kind==='owls',wave=Math.sin(now*.0016+p.phase);if(!staticGround){p.x+=(p.vx+wave*(p.kind==='snow'||p.kind==='petals'?7:flying?1.2:2))*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;}if(p.kind==='fireflies'){p.x+=Math.cos(now*.001+p.phase)*6*dt;p.y+=Math.sin(now*.0014+p.phase)*5*dt;}if(flying&&p.x>w+55){p.x=-45;p.y=h*(.10+canvasSeed(Math.round(now+p.phase*100),17)*.48);}if(!staticGround&&!flying)resetParticle(p,w,h);if(p.kind==='rain')drawRain(ctx,p);else if(p.kind==='snow')drawSnow(ctx,p);else if(p.kind==='leaves')drawLeaf(ctx,p);else if(p.kind==='grass')drawGrass(ctx,p,now);else if(flying)drawBird(ctx,p,now);else if(p.kind==='petals')drawPetal(ctx,p);else if(p.kind==='crystals')drawCrystal(ctx,p);else if(p.kind==='fireflies')drawFirefly(ctx,p,now);}ctx.globalAlpha=1;canvasState.lastPaint=Date.now();canvasState.frames++;}
function piCanvasLoop(now){if(!canvasState.running)return;canvasState.raf=requestAnimationFrame(piCanvasLoop);if(!piCanvasHostVisible())return;const interval=performanceApi.animationPerformanceFrameMs?.()||16,elapsed=canvasState.lastFrame?now-canvasState.lastFrame:interval,caps=performanceApi.frontendCapabilities();if(caps.pi3Class){if(canvasState.lastFrame&&elapsed<interval*.86)return;const steps=Math.max(1,Math.min(3,Math.round(elapsed/interval))),dt=Math.min(.05,Math.max(.008,(steps*interval)/1000));canvasState.lastFrame=canvasState.lastFrame?now-(elapsed%interval):now;paintPiCanvas(now,dt);return;}const tolerance=interval*.10;if(canvasState.lastFrame&&elapsed+tolerance<interval)return;const steps=Math.max(1,Math.min(3,Math.floor((elapsed+tolerance)/interval))),dt=Math.min(.05,Math.max(.008,(steps*interval)/1000));if(canvasState.lastFrame){canvasState.lastFrame+=steps*interval;if(now-canvasState.lastFrame>interval*2)canvasState.lastFrame=now;}else canvasState.lastFrame=now;paintPiCanvas(now,dt);}
function updatePiCanvasScene(host,scene){if(!piCanvasSupported(scene?.source||{})){stopPiCanvasScene();return false;}ensurePiCanvas(host);canvasState.visible=host.classList.contains('show');const key=JSON.stringify([scene.condition,scene.count,scene.season,scene.seasonalCounts,Math.round(Number(scene.wind?.strength||0)*10),Math.round(Number(scene.wind?.direction||0)*10),performanceApi.visualPerformanceBudget().maxParticles,Number(piCanvasRenderScale().toFixed(2))]);if(key!==canvasState.sceneKey){canvasState.sceneKey=key;resizePiCanvas();canvasState.particles=buildCanvasParticles(scene);canvasState.lastFrame=0;}if(!canvasState.particles.length){if(canvasState.raf)cancelAnimationFrame(canvasState.raf);canvasState.raf=0;canvasState.running=false;canvasState.lastPaint=0;canvasState.ctx?.clearRect(0,0,canvasState.pixelWidth,canvasState.pixelHeight);return true;}if(!canvasState.raf){canvasState.running=true;canvasState.raf=requestAnimationFrame(piCanvasLoop);}return true;}
function stopPiCanvasScene(){if(canvasState.raf)cancelAnimationFrame(canvasState.raf);canvasState.resizeObserver?.disconnect?.();canvasState.canvas?.remove();canvasState={canvas:null,ctx:null,host:null,raf:0,lastFrame:0,lastPaint:0,width:0,height:0,pixelWidth:0,pixelHeight:0,renderScale:1,sceneKey:'',particles:[],running:false,frames:0,resizeObserver:null,visible:true};}
function piCanvasHealth(){const kinds={},sizes={};for(const p of canvasState.particles){kinds[p.kind]=(kinds[p.kind]||0)+1;const row=sizes[p.kind]||(sizes[p.kind]={min:Infinity,max:0});row.min=Math.min(row.min,p.size||0);row.max=Math.max(row.max,p.size||0);}for(const row of Object.values(sizes)){row.min=Number((Number.isFinite(row.min)?row.min:0).toFixed(1));row.max=Number(row.max.toFixed(1));}return {running:canvasState.running&&!!canvasState.canvas?.isConnected,lastPaint:canvasState.lastPaint,frames:canvasState.frames,particles:canvasState.particles.length,kinds,sizes,renderScale:Number(canvasState.renderScale.toFixed(2)),pixelWidth:canvasState.pixelWidth,pixelHeight:canvasState.pixelHeight,healthy:canvasState.running&&Date.now()-canvasState.lastPaint<6000};}
function piCanvasDomSelectors(){return ['.weather-fx-primary','.weather-fx-splash','.weather-fx-leaf','.weather-fx-grass','.weather-fx-petal','.weather-fx-crystal','.weather-fx-firefly'];}

globalThis.addEventListener?.('resize',()=>{if(canvasState.running)resizePiCanvas();},{passive:true});
globalThis.addEventListener?.('beforeunload',stopPiCanvasScene);
LibreDisplayRuntime.exposeModule('weatherCanvas',{piCanvasSupported,piCanvasRenderScale,updatePiCanvasScene,stopPiCanvasScene,piCanvasHealth,piCanvasDomSelectors},{},{globals:false});
}
// End source section: /js/weather/canvas.js

// LibreDisplay source section: /js/weather/effects.js
{
// Vector weather motion, full-screen atmosphere, seasonal accents, and preview lab.
const configApi=LibreDisplayRuntime.getModule('config');
const performanceApi=LibreDisplayRuntime.getModule('performance');
const sceneryApi=LibreDisplayRuntime.getModule('weatherScenery');
const canvasApi=LibreDisplayRuntime.getModule('weatherCanvas');
const {DOG_BREEDS,appendDogCompanion}=sceneryApi;
const {uiCfg}=LibreDisplayRuntime.getModule('shared');
const WEATHER_MOON_PHASES=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];

let lastSignature='';
let weatherTestProfile='live';
let precipitationHealth={signature:'',sample:-1,progressAt:0,builtAt:0};
let wildlifeSceneSerial=0;
let currentBirdSceneSpecies=[];
let currentOwlSceneSpecies=[];
const EFFECT_TUNING_KEYS=['weatherRainDensity','weatherRainSize','weatherRainWidth','weatherRainSpeed','weatherRainOpacity','weatherRainAngle','weatherRainDepth','weatherRainSplash','weatherRainSplashSize','weatherRainGlow','weatherSnowDensity','weatherSnowSize','weatherSnowSpeed','weatherSnowDrift','weatherSnowOpacity','weatherSnowSpin','weatherSnowDepth','weatherFogDensity','weatherFogSpeed','weatherFogOpacity','weatherFogBlur','weatherFogLayerHeight','weatherCloudDensity','weatherCloudOpacity','weatherCloudSpeed','weatherCloudScale','weatherSunGlow','weatherSunRaySpeed','weatherLightningSize','weatherLightningFlash','weatherLightningBolts','weatherSeasonLeavesIntensity','weatherSeasonLeavesSize','weatherSeasonLeavesSpeed','weatherSeasonLeavesWind','weatherSeasonLeavesOpacity','weatherSeasonGrassIntensity','weatherSeasonGrassHeight','weatherSeasonGrassSway','weatherSeasonGrassOpacity','weatherSeasonPetalIntensity','weatherSeasonPetalSize','weatherSeasonPetalSpeed','weatherSeasonPetalOpacity','weatherSeasonBeeIntensity','weatherSeasonBeeSize','weatherSeasonBeeSpeed','weatherSeasonBeeOpacity','weatherSeasonButterflyIntensity','weatherSeasonButterflySize','weatherSeasonButterflySpeed','weatherSeasonButterflyOpacity','weatherSeasonButterflyDiversity','weatherSeasonFireflyIntensity','weatherSeasonFireflySize','weatherSeasonFireflySpeed','weatherSeasonFireflyGlow','weatherSeasonFireflyOpacity','weatherSeasonBirdIntensity','weatherSeasonBirdSize','weatherSeasonBirdSpeed','weatherSeasonBirdFlock','weatherSeasonBirdOpacity','weatherSeasonBirdHeight','weatherSeasonBirdDiversity','weatherSeasonBirdRare','weatherDogActivity','weatherDogSize','weatherDogOpacity','weatherDogCompanion','weatherSeasonOwlIntensity','weatherSeasonOwlSize','weatherSeasonOwlSpeed','weatherSeasonOwlOpacity','weatherSeasonOwlDiversity','weatherSeasonDragonflyIntensity','weatherSeasonDragonflySize','weatherSeasonDragonflySpeed','weatherSeasonDragonflyOpacity','weatherSeasonLadybugIntensity','weatherSeasonLadybugSize','weatherSeasonLadybugSpeed','weatherSeasonLadybugOpacity','weatherSeasonMothIntensity','weatherSeasonMothSize','weatherSeasonMothSpeed','weatherSeasonMothOpacity','weatherSeasonCrystalIntensity','weatherSeasonCrystalSize','weatherSeasonCrystalSpeed','weatherSeasonCrystalOpacity','weatherSeasonSnowmen','weatherSeasonSnowmanIntensity','weatherSeasonSnowmanSize','weatherSeasonSnowmanOpacity','weatherColdFrostWidth','weatherColdFrostOpacity'];
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
    const active=weatherGlyphEnabled(String(glyph.dataset.weatherVisual||'none'),source);
    glyph.classList.toggle('ld-weather-glyph-active',active);
    glyph.classList.toggle('ld-weather-glyph-static',!widgetOn);
    const fallback=glyph.previousElementSibling;
    if(fallback?.classList?.contains('ld-weather-emoji-fallback'))fallback.classList.toggle('ld-weather-emoji-hidden',active);
  }
}

function liveIntensityMultiplier(condition,data){
  const current=data?.current||{},code=Number(current.weather_code),precip=Number(current.precipitation),cloud=Number(current.cloud_cover),wind=Number(current.wind_speed_10m);
  const severity={51:.62,53:.76,55:.92,61:.76,63:1,65:1.15,80:.82,81:1.04,82:1.20,71:.72,73:1,75:1.18,77:.8,85:.88,86:1.16,95:1.08,96:1.18,99:1.28}[code]||1;
  if(condition==='rain'||condition==='snow'||condition==='storm'){
    const precipBoost=Number.isFinite(precip)?wxClamp(.68+Math.sqrt(Math.max(0,precip))*.23,.68,1.45,1):1;
    const windBoost=Number.isFinite(wind)?wxClamp(.86+wind/120,.86,1.22,1):1;
    return wxClamp(severity*precipBoost*windBoost,.55,1.7,1);
  }
  if(condition==='cloud'||condition==='partly')return Number.isFinite(cloud)?wxClamp(.62+cloud/170,.62,1.18,1):1;
  if(condition==='fog')return Number.isFinite(cloud)?wxClamp(.78+cloud/240,.78,1.16,1):1;
  return 1;
}
function weatherPhenomenonProfile(condition,data){
  const current=data?.current||{},code=Number(current.weather_code),precip=Number(current.precipitation);
  if(condition==='rain'){if([51,53].includes(code))return {key:'drizzle',speed:.62,size:.58,width:.62,alpha:.68,splash:.08,angle:.66,density:1};if([55,61,80].includes(code)||(Number.isFinite(precip)&&precip<2))return {key:'light-rain',speed:.78,size:.76,width:.78,alpha:.80,splash:.35,angle:.82,density:1};if([65,82].includes(code)||(Number.isFinite(precip)&&precip>=8))return {key:'heavy-rain',speed:1.08,size:.82,width:.90,alpha:.88,splash:1.05,angle:.96,density:1.18};return {key:'rain',speed:1,size:1,width:1,alpha:.94,splash:1,angle:1,density:1};}
  if(condition==='storm'){const severe=[96,99].includes(code)||(Number.isFinite(precip)&&precip>=12);return {key:severe?'severe-storm':'storm',speed:severe?1.22:1.12,size:severe?.90:.82,width:severe?.98:.92,alpha:severe?.94:.90,splash:severe?1.22:1.08,angle:severe?1.16:1.06,density:severe?1.28:1.18};}
  if(condition==='snow'){if([71,85].includes(code)||(Number.isFinite(precip)&&precip<2))return {key:'flurries',speed:.68,size:1.2,drift:.72,alpha:.78,density:1};if([75,86].includes(code)||(Number.isFinite(precip)&&precip>=7))return {key:'heavy-snow',speed:.92,size:1.02,drift:1.18,alpha:.95,density:1.30};if(code===77)return {key:'snow-grains',speed:1.3,size:.52,drift:.78,alpha:.82,density:1};return {key:'snow',speed:.9,size:1,drift:1,alpha:.94,density:1};}
  if(condition==='fog'){const humidity=Number(current.relative_humidity_2m);return {key:code===48?'freezing-fog':'fog',density:Number.isFinite(humidity)?wxClamp(.8+humidity/250,.9,1.22,1):1};}
  return {key:condition||'none',speed:1,size:1,width:1,alpha:1,splash:1,angle:1,drift:1};
}
function weatherEffectIntensityForData(condition,data,source){
  const selected=wxClamp(source.weatherEffectIntensity,10,100,50);
  return wxClamp(selected*(source.weatherEffectAutoIntensity===false?1:liveIntensityMultiplier(condition,data)),8,150,selected);
}
function particleCount(condition,intensity,constrained,source){
  if((condition==='rain'||condition==='snow'||condition==='storm')&&source.weatherEffectPrecipitation===false)return 0;if((condition==='rain'||condition==='storm')&&source.weatherRainEnabled===false)return 0;if(condition==='snow'&&source.weatherSnowEnabled===false)return 0;if(condition==='cloud'&&source.weatherEffectClouds===false)return 0;if(condition==='partly')return 0;if(condition==='fog'&&source.weatherEffectFog===false)return 0;if(condition==='clear'&&source.weatherEffectSun===false)return 0;
  const budget=performanceApi.visualPerformanceBudget(),base={rain:94,snow:64,storm:104,cloud:0,fog:10,clear:5}[condition]||0,tune=(condition==='rain'||condition==='storm')?wxClamp(source.weatherRainDensity,0,180,100)/100:condition==='snow'?wxClamp(source.weatherSnowDensity,0,180,100)/100:condition==='fog'?wxClamp(source.weatherFogDensity,0,180,115)/100:condition==='cloud'?wxClamp(source.weatherCloudDensity,0,180,100)/100:1,factor=wxClamp(Number(intensity)/100,.08,1.5,.5),limit=constrained?budget.maxParticles:240;return Math.max(0,Math.min(limit,Math.round(base*factor*tune*(constrained?budget.particleScale:1))));
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
function weatherIconMarkup(code,fallback='',source=null,isDay=true){
  source=weatherEffectSource(source);
  const condition=weatherVisualCondition(code),safeFallback=String(fallback||''),widgetOn=!!source?.weatherAnimationsEnabled&&!!source?.weatherWidgetAnimations&&!effectPaused(source),glyphActive=weatherGlyphEnabled(condition,source||{}),daylight=isDay!==false;
  const fallbackClass='ld-weather-emoji-fallback'+(glyphActive?' ld-weather-emoji-hidden':''),glyphClass='ld-weather-glyph ld-weather-'+condition+(daylight?' ld-weather-day':' ld-weather-night')+(glyphActive?' ld-weather-glyph-active':'')+(widgetOn?'':' ld-weather-glyph-static');
  const phaseEmoji=String(safeFallback).match(/[🌑🌒🌓🌔🌕🌖🌗🌘]/u)?.[0]||'🌕',phaseIndex=Math.max(0,WEATHER_MOON_PHASES.indexOf(phaseEmoji));
  const sun=daylight&&['clear','partly'].includes(condition)?'<span class="ld-wx-sun"><i></i></span>':'',moon=!daylight&&['clear','partly'].includes(condition)?`<span class="ld-wx-moon-phase ld-wx-moon-phase-${phaseIndex}" aria-hidden="true"><i></i></span>`:'',cloud=['partly','cloud','rain','snow','storm'].includes(condition)?'<span class="ld-wx-cloud"><i></i><b></b></span>':'',rain=['rain','storm'].includes(condition)?`<span class="ld-wx-precip ld-wx-rain">${precipitationMarkup('rain',6)}</span>`:'',snow=condition==='snow'?`<span class="ld-wx-precip ld-wx-snow">${precipitationMarkup('snow',6)}</span>`:'',bolt=condition==='storm'?'<span class="ld-wx-bolt"></span>':'',fog=condition==='fog'?'<span class="ld-wx-fog"><i></i><i></i><i></i></span>':'',unknown=condition==='none'?'<span class="ld-wx-unknown">•</span>':'';
  return `<span class="${fallbackClass}">${safeFallback}</span><span class="${glyphClass}" data-weather-visual="${condition}" aria-hidden="true">${sun}${moon}${cloud}${rain}${snow}${bolt}${fog}${unknown}</span>`;
}
function decorateWeatherIcon(el,code,fallback='',source=null,isDay=true){if(!el)return;const signature=`${Number(code)}|${String(fallback||'')}|${isDay===false?'night':'day'}`;if(el.dataset.weatherGlyphSignature===signature)return;el.dataset.weatherCode=String(Number(code));el.dataset.weatherGlyphSignature=signature;el.innerHTML=weatherIconMarkup(code,fallback,source,isDay);}
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
  'north-america':[
    ['northern-cardinal',12],['blue-jay',11],['american-robin',10],['american-goldfinch',9],['black-capped-chickadee',8],['tufted-titmouse',7],['song-sparrow',8],['house-finch',7],['eastern-bluebird',7],['baltimore-oriole',6],['cedar-waxwing',5],['red-winged-blackbird',5],['northern-flicker',5],['downy-woodpecker',5],['white-breasted-nuthatch',5],['mourning-dove',6],['american-crow',5],['common-raven',3],['tree-swallow',4],['purple-martin',3],['ruby-throated-hummingbird',5],['belted-kingfisher',4],['red-tailed-hawk',4],['bald-eagle',2.4],['peregrine-falcon',2.2],['osprey',2.4],['turkey-vulture',2.2],['mountain-bluebird',3],['stellers-jay',3],['clarks-nutcracker',2.5],['american-dipper',2.5],['snow-bunting',2],['willow-ptarmigan',1.8],['mallard',2.5],['canada-goose',2.2],['wood-duck',2],['common-loon',1.7],['great-blue-heron',1.8]
  ],
  'south-america':[
    ['scarlet-macaw',9],['blue-and-yellow-macaw',7],['toco-toucan',8],['blue-gray-tanager',9],['rufous-bellied-thrush',7],['rufous-hornero',7],['sparkling-violetear',6],['fork-tailed-flycatcher',5],['southern-lapwing',5],['crested-caracara',4],['harpy-eagle',2],['andean-condor',2],['andean-goose',3],['torrent-duck',3],['roseate-spoonbill',3],['jabiru',2.2],['southern-flamingo',2.2],['wattled-jacana',3.5],['green-kingfisher',4],['hoatzin',2.4]
  ],
  europe:[
    ['european-robin',11],['blue-tit',9],['great-tit',8],['common-blackbird',9],['eurasian-magpie',7],['european-goldfinch',7],['common-starling',6],['chaffinch',7],['eurasian-wren',5],['bullfinch',5],['barn-swallow',5],['common-swift',4],['great-spotted-woodpecker',4],['common-kingfisher',4],['grey-heron',3],['northern-lapwing',3],['mute-swan',2],['greylag-goose',2],['mallard',3],['atlantic-puffin',2],['northern-gannet',2],['golden-eagle',2],['peregrine-falcon',2],['alpine-chough',2.5],['white-throated-dipper',2.5],['rock-ptarmigan',1.8]
  ],
  africa:[
    ['lilac-breasted-roller',9],['african-sunbird',8],['little-bee-eater',7],['red-billed-hornbill',6],['african-grey-parrot',5],['lovebird',5],['superb-starling',6],['village-weaver',7],['purple-crested-turaco',4],['african-fish-eagle',3],['secretary-bird',2.6],['grey-crowned-crane',3],['saddle-billed-stork',2.5],['hamerkop',3],['african-sacred-ibis',3],['greater-flamingo',2.3],['malachite-kingfisher',4],['southern-yellow-billed-hornbill',4]
  ],
  asia:[
    ['eurasian-tree-sparrow',9],['red-whiskered-bulbul',8],['common-myna',8],['oriental-magpie-robin',7],['white-eye',6],['black-drongo',5],['white-throated-kingfisher',5],['indian-roller',5],['eurasian-hoopoe',4],['rose-ringed-parakeet',5],['peafowl',3],['mandarin-duck',3],['bar-headed-goose',2.5],['red-crowned-crane',2],['himalayan-monal',2.4],['bearded-vulture',2],['golden-eagle',2],['black-kite',3],['sarus-crane',2],['great-hornbill',3]
  ],
  australasia:[
    ['rainbow-lorikeet',9],['crimson-rosella',8],['australian-magpie',8],['laughing-kookaburra',6],['sulphur-crested-cockatoo',6],['galah',5],['superb-fairy-wren',6],['new-holland-honeyeater',5],['willie-wagtail',5],['silvereye',4],['welcome-swallow',4],['wedge-tailed-eagle',2.5],['black-swan',2.5],['australian-pelican',2.5],['white-faced-heron',3],['royal-spoonbill',2.5],['tawny-frogmouth',2.5],['kea',2.6],['kakapo',1.2]
  ],
  global:[
    ['sparrow',10],['finch',8],['robin',7],['dove',6],['crow',5],['starling',4],['swallow',4],['kingfisher',3],['hawk',3],['eagle',2],['heron',2],['gull',2],['duck',2]
  ]
};
const BIRD_WATER_SPECIES=new Set([
  'mallard','wood-duck','mandarin-duck','torrent-duck','duck','canada-goose','greylag-goose','bar-headed-goose','andean-goose','goose','mute-swan','black-swan','swan','common-loon','loon','grebe','great-blue-heron','grey-heron','white-faced-heron','heron','egret','grey-crowned-crane','red-crowned-crane','sarus-crane','crane','saddle-billed-stork','jabiru','stork','african-sacred-ibis','ibis','roseate-spoonbill','royal-spoonbill','spoonbill','southern-flamingo','greater-flamingo','flamingo','wattled-jacana','jacana','belted-kingfisher','green-kingfisher','malachite-kingfisher','common-kingfisher','white-throated-kingfisher','kingfisher','australian-pelican','pelican','gull','tern','cormorant','atlantic-puffin','northern-gannet','albatross','frigatebird','osprey'
]);
const BIRD_RAPTOR_SPECIES=new Set([
  'red-tailed-hawk','hawk','bald-eagle','golden-eagle','wedge-tailed-eagle','harpy-eagle','african-fish-eagle','eagle','peregrine-falcon','falcon','osprey','turkey-vulture','bearded-vulture','andean-condor','vulture','crested-caracara','caracara','black-kite'
]);
const BIRD_MOUNTAIN_SPECIES=new Set(['mountain-bluebird','stellers-jay','clarks-nutcracker','american-dipper','white-throated-dipper','snow-bunting','willow-ptarmigan','rock-ptarmigan','alpine-chough','himalayan-monal','bearded-vulture','golden-eagle','andean-condor','kea']);
const BIRD_PARROT_SPECIES=new Set(['scarlet-macaw','blue-and-yellow-macaw','african-grey-parrot','lovebird','rose-ringed-parakeet','rainbow-lorikeet','crimson-rosella','sulphur-crested-cockatoo','galah','kea','kakapo','parakeet','lorikeet','rosella','cockatoo']);
const BIRD_SEABIRD_SPECIES=new Set(['atlantic-puffin','northern-gannet','albatross','frigatebird','gull','tern','cormorant','australian-pelican','pelican']);
const BIRD_HABITAT_EXTRAS={
  wetland:[['great-blue-heron',9],['grey-heron',8],['egret',8],['grey-crowned-crane',5],['red-crowned-crane',5],['sarus-crane',5],['belted-kingfisher',6],['common-kingfisher',6],['malachite-kingfisher',6],['mallard',8],['wood-duck',5],['mandarin-duck',5],['black-swan',4],['mute-swan',4],['roseate-spoonbill',4],['royal-spoonbill',4],['wattled-jacana',4]],
  coastal:[['gull',10],['tern',8],['cormorant',6],['northern-gannet',5],['atlantic-puffin',5],['albatross',4],['frigatebird',4],['australian-pelican',5],['pelican',5],['osprey',4],['egret',4],['heron',4]],
  mountain:[['golden-eagle',7],['bearded-vulture',5],['andean-condor',5],['wedge-tailed-eagle',5],['himalayan-monal',7],['alpine-chough',7],['clarks-nutcracker',7],['mountain-bluebird',6],['american-dipper',5],['white-throated-dipper',5],['snow-bunting',5],['willow-ptarmigan',5],['rock-ptarmigan',5],['kea',5]],
  tropical:[['scarlet-macaw',8],['blue-and-yellow-macaw',7],['toco-toucan',7],['great-hornbill',6],['red-billed-hornbill',6],['purple-crested-turaco',5],['lilac-breasted-roller',5],['little-bee-eater',5],['rainbow-lorikeet',5],['african-sunbird',5],['sparkling-violetear',5],['kingfisher',4]],
  desert:[['peregrine-falcon',5],['black-kite',4],['crested-caracara',4],['eurasian-hoopoe',6],['sandgrouse',7],['horned-lark',6],['burrowing-owl',0]],
  grassland:[['meadowlark',8],['red-tailed-hawk',5],['hawk',4],['turkey-vulture',3],['southern-lapwing',4],['secretary-bird',3],['grey-crowned-crane',3]],
  woodland:[['downy-woodpecker',8],['great-spotted-woodpecker',8],['northern-flicker',7],['white-breasted-nuthatch',7],['black-capped-chickadee',7],['blue-tit',7],['great-tit',6],['toco-toucan',3],['hornbill',3],['superb-fairy-wren',5]],
  urban:[['sparrow',10],['eurasian-tree-sparrow',8],['starling',8],['common-starling',8],['rock-pigeon',8],['mourning-dove',7],['american-crow',6],['eurasian-magpie',5],['common-myna',5]]
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
const OWL_SPECIES_POOLS={
  'north-america':[['great-horned-owl',14],['barred-owl',12],['barn-owl',10],['eastern-screech-owl',9],['western-screech-owl',7],['burrowing-owl',6],['short-eared-owl',5],['long-eared-owl',4],['snowy-owl',3]],
  'south-america':[['burrowing-owl',12],['barn-owl',10],['spectacled-owl',8],['tropical-screech-owl',7]],europe:[['tawny-owl',14],['barn-owl',11],['little-owl',9],['long-eared-owl',7],['eagle-owl',4]],
  africa:[['spotted-eagle-owl',11],['barn-owl',10],['pearl-spotted-owlet',8],['verreaux-eagle-owl',4]],asia:[['brown-fish-owl',10],['collared-scops-owl',9],['barn-owl',8],['eagle-owl',5]],
  australasia:[['boobook-owl',13],['barn-owl',10],['powerful-owl',5],['barking-owl',6]],global:[['barn-owl',12],['great-horned-owl',8],['tawny-owl',8],['burrowing-owl',5]]
};
const OWL_ALL_SPECIES_POOL=(()=>{const merged=new Map();for(const pool of Object.values(OWL_SPECIES_POOLS))for(const [id,weight] of pool)merged.set(id,Math.max(Number(weight)||0,merged.get(id)||0));return [...merged.entries()];})();
function diverseSpeciesChoice(pool,i,diversity,seed){
  if(!pool.length)return '';const d=wxClamp(diversity,0,100,72)/100,ranked=[...pool].sort((a,b)=>b[1]-a[1]),allowed=Math.max(1,Math.min(ranked.length,1+Math.round(d*(ranked.length-1)))),eligible=ranked.slice(0,allowed);
  if(allowed===1)return eligible[0][0];if(d>=.45){const offset=Math.floor(seededUnit(Math.round(seed*1000)+41,97)*allowed);return eligible[(offset+i)%allowed][0];}
  return weightedWildlifeChoice(eligible,seed+i*.173);
}
function weatherBirdHabitatForData(data,source,context=null){
  const explicit=String(source.weatherBirdHabitat||'auto');if(['urban','woodland','grassland','wetland','coastal','mountain','tropical','desert'].includes(explicit))return explicit;
  context=context||weatherSeasonContextForData(data,source);const elevation=Number(data?.elevation),lat=Math.abs(Number(data?.latitude??context?.latitude??source?.lat??configApi.cfg?.lat)),temp=Number(data?.current?.temperature_2m),humidity=Number(data?.current?.relative_humidity_2m);
  if(Number.isFinite(elevation)&&elevation>=1200)return 'mountain';
  if(Number.isFinite(lat)&&lat<25&&Number.isFinite(temp)&&temp>=18)return 'tropical';
  if(Number.isFinite(humidity)&&humidity<=24&&Number.isFinite(temp)&&temp>=25)return 'desert';
  return 'auto';
}
function birdSpeciesPool(data,source,context=null,isDay=null){
  context=context||weatherSeasonContextForData(data,source);const region=weatherEcologyRegion(data,source,context),day=isDay===null?weatherIsDay(data):!!isDay,season=context.season,habitat=weatherBirdHabitatForData(data,source,context),pool=(BIRD_SPECIES_POOLS[region]||BIRD_SPECIES_POOLS.global).map(v=>[...v]),diversity=wxClamp(source.weatherSeasonBirdDiversity,0,100,72)/100,rare=wxClamp(source.weatherSeasonBirdRare,0,100,30)/100;
  if(!day)return region==='north-america'?[['common-nighthawk',8],['american-robin',1.5]]:region==='australasia'?[['tawny-frogmouth',7],['boobook-owl',0]]:[['nighthawk',5]];
  for(const item of pool){if(BIRD_RAPTOR_SPECIES.has(item[0])||BIRD_PARROT_SPECIES.has(item[0])||BIRD_MOUNTAIN_SPECIES.has(item[0])||BIRD_SEABIRD_SPECIES.has(item[0]))item[1]*=.16+rare*.95;else item[1]*=.48+diversity*.74;}
  if(habitat==='auto'){for(let i=pool.length-1;i>=0;i--)if(BIRD_WATER_SPECIES.has(pool[i][0])||BIRD_MOUNTAIN_SPECIES.has(pool[i][0]))pool[i][1]*=.28;}
  else for(const extra of BIRD_HABITAT_EXTRAS[habitat]||[])pool.push([...extra]);
  if(season==='fall')pool.push(['sparrow',3],['finch',3],['cedar-waxwing',3],['barn-swallow',2.5]);return pool;
}
function stableWildlifeSeed(data,context,scaleA,scaleB){const seasonIndex=Math.max(0,['spring','summer','fall','winter'].indexOf(context?.season)),day=weatherIsDay(data)?1:0;return Number(data?.latitude||0)*scaleA+Number(data?.longitude||0)*scaleB+seasonIndex*.193+day*.431;}
function birdSpeciesForIndex(i,data,source,context=null){
  context=context||weatherSeasonContextForData(data,source);let pool=birdSpeciesPool(data,source,context);const seed=stableWildlifeSeed(data,context,.01,.001),diversity=wxClamp(source.weatherSeasonBirdDiversity,0,100,72);
  if(diversity>=35&&pool.length>2){const current=new Set(currentBirdSceneSpecies),fresh=pool.filter(([id])=>!current.has(id));if(fresh.length)pool=fresh;}
  const species=diverseSpeciesChoice(pool,i,diversity,seed);if(species)currentBirdSceneSpecies.push(species);return species;
}
function owlSpeciesPool(data,source,context=null,isDay=null){
  context=context||weatherSeasonContextForData(data,source);const region=weatherEcologyRegion(data,source,context),day=isDay===null?weatherIsDay(data):!!isDay,regional=(OWL_SPECIES_POOLS[region]||OWL_SPECIES_POOLS.global).map(v=>[...v]);
  if(source.weatherSeasonOwls===true){const local=new Map(regional),pool=OWL_ALL_SPECIES_POOL.map(([id,weight])=>[id,local.has(id)?Math.max(weight,local.get(id))*1.45:Math.max(2.5,weight*.58)]);return pool;}
  if(day)return regional.filter(([id])=>['burrowing-owl','snowy-owl','short-eared-owl','little-owl'].includes(id));return regional;
}
function owlSpeciesForIndex(i,data,source,context=null){context=context||weatherSeasonContextForData(data,source);let pool=owlSpeciesPool(data,source,context),seed=stableWildlifeSeed(data,context,.013,.0017),diversity=wxClamp(source.weatherSeasonOwlDiversity,0,100,75);
  if(diversity>=35&&pool.length>2){const current=new Set(currentOwlSceneSpecies),fresh=pool.filter(([id])=>!current.has(id));if(fresh.length)pool=fresh;}
  const species=diverseSpeciesChoice(pool,i,diversity,seed);if(species)currentOwlSceneSpecies.push(species);return species;
}
function owlBehavior(species){if(species==='burrowing-owl'||species==='little-owl')return 'ground';if(['barn-owl','short-eared-owl','snowy-owl'].includes(species))return 'swoop';return 'glide';}
function butterflySpeciesPool(data,source,context=null){context=context||weatherSeasonContextForData(data,source);const region=weatherEcologyRegion(data,source,context),pool=(BUTTERFLY_SPECIES_POOLS[region]||BUTTERFLY_SPECIES_POOLS.global).map(v=>[...v]),diversity=wxClamp(source.weatherSeasonButterflyDiversity,0,100,75)/100;for(const item of pool)item[1]*=.48+diversity*.72;if(region==='north-america'&&context.season==='fall')pool.push(['monarch',10*diversity]);if(['spring','fall'].includes(context.season))pool.push(['painted-lady',4*diversity]);return pool;}
function butterflySpeciesForIndex(i,data,source,context=null){context=context||weatherSeasonContextForData(data,source);const seed=Number(data?.latitude||0)*.009+Number(data?.longitude||0)*.002+wildlifeSceneSerial*.487;return diverseSpeciesChoice(butterflySpeciesPool(data,source,context),i,source.weatherSeasonButterflyDiversity,seed);}
function birdMorphology(species){
  if(BIRD_RAPTOR_SPECIES.has(species))return 'raptor';
  if(['great-blue-heron','grey-heron','white-faced-heron','heron','egret','grey-crowned-crane','red-crowned-crane','sarus-crane','crane','saddle-billed-stork','jabiru','stork','african-sacred-ibis','ibis','roseate-spoonbill','royal-spoonbill','spoonbill','southern-flamingo','greater-flamingo','flamingo','wattled-jacana','jacana'].includes(species))return 'wader';
  if(['mallard','wood-duck','mandarin-duck','torrent-duck','duck','canada-goose','greylag-goose','bar-headed-goose','andean-goose','goose','mute-swan','black-swan','swan','common-loon','loon','grebe'].includes(species))return 'waterfowl';
  if(BIRD_SEABIRD_SPECIES.has(species))return 'seabird';
  if(BIRD_PARROT_SPECIES.has(species))return 'parrot';
  if(BIRD_MOUNTAIN_SPECIES.has(species))return 'mountain';
  if(['common-nighthawk','nighthawk','tawny-frogmouth'].includes(species))return 'nocturnal';
  if(['ruby-throated-hummingbird','sparkling-violetear','hummingbird','african-sunbird','sunbird'].includes(species))return 'hover';
  if(['toco-toucan','great-hornbill','red-billed-hornbill','southern-yellow-billed-hornbill','hornbill','laughing-kookaburra','kookaburra','common-raven','american-crow','crow'].includes(species))return 'large';
  return 'songbird';
}
const WILDLIFE_RENDERER='v1100-css-flight';
function weatherWildlifeWeatherFactors(data,condition){
  const code=Number(data?.current?.weather_code),precip=Number(data?.current?.precipitation),wind=Number(data?.current?.wind_speed_10m);let insects=1,birds=1,reason='';
  if(condition==='storm'){insects=0;birds=0;reason='thunderstorm';}
  else if(condition==='snow'){insects=0;birds=([71,85].includes(code)||(Number.isFinite(precip)&&precip<=1))?.18:0;reason='snow';}
  else if(condition==='rain'){const light=[51,53,61,80].includes(code)||(Number.isFinite(precip)&&precip<=1.5),moderate=[55,63,81].includes(code)||(Number.isFinite(precip)&&precip<=4);insects=light?.05:0;birds=light?.42:moderate?.14:0;reason=light?'light precipitation':'rain';}
  else if(condition==='fog'){insects=0;birds=.08;reason='fog';}
  if(Number.isFinite(wind)){insects*=wxClamp(1-Math.max(0,wind-14)/28,0,1,1);birds*=wxClamp(1-Math.max(0,wind-26)/42,0,1,1);if(wind>=58){insects=0;birds=0;reason='strong wind';}}
  return {insects,birds,reason};
}
function visibleWildlifeCount(raw,constrained,kind){const budget=performanceApi.visualPerformanceBudget(),scaled=Math.max(0,Number(raw)||0)*(constrained?budget.wildlifeScale:1);if(scaled<=.18)return 0;if(kind==='birds'){const pairThreshold=constrained?.34:.62,trioThreshold=constrained?.72:1.65;return Math.max(scaled>=trioThreshold?3:scaled>=pairThreshold?2:1,Math.round(scaled));}return Math.max(1,Math.round(scaled));}
function weatherWildlifeProfile(data,source,context,condition){
  const isDay=weatherIsDay(data),temp=Number(data?.current?.temperature_2m),humidity=Number(data?.current?.relative_humidity_2m),warm=Number.isFinite(temp)?wxClamp((temp-7)/18,0,1.15,.5):.7,humid=Number.isFinite(humidity)?wxClamp(.65+humidity/180,.65,1.2,1):1,season=context.season,band=context.climateBand,tropical=['equatorial','tropical'].includes(band),subtropical=band==='subtropical',seasonWarm=['spring','summer'].includes(season),fallMild=season==='fall'&&subtropical,weather=weatherWildlifeWeatherFactors(data,condition);
  if(source.weatherSeasonalEffects===false)return {isDay,bees:0,butterflies:0,fireflies:0,dragonflies:0,ladybugs:0,moths:0,birds:0,owls:0,weatherReason:'seasonal effects off'};const overall=wxClamp(source.weatherSeasonalIntensity,0,100,45)/100;
  const bees=isDay&&source.weatherSeasonBees!==false&&(tropical||seasonWarm||fallMild)&&warm>.12?6*overall*warm*wxClamp(source.weatherSeasonBeeIntensity,0,180,55)/100*weather.insects:0;
  const butterflies=isDay&&source.weatherSeasonButterflies!==false&&(tropical||seasonWarm||fallMild)&&warm>.22?5*overall*warm*wxClamp(source.weatherSeasonButterflyIntensity,0,180,50)/100*weather.insects:0;
  const fireflies=!isDay&&source.weatherSeasonFireflies!==false&&(tropical||season==='summer'||(subtropical&&['spring','fall'].includes(season)))&&warm>.18?10*overall*warm*humid*wxClamp(source.weatherSeasonFireflyIntensity,0,180,70)/100*weather.insects:0;
  const dragonflies=isDay&&source.weatherSeasonDragonflies!==false&&(tropical||seasonWarm)&&warm>.3?3.8*overall*warm*wxClamp(source.weatherSeasonDragonflyIntensity,0,180,35)/100*weather.insects:0;
  const ladybugs=isDay&&source.weatherSeasonLadybugs!==false&&(tropical||seasonWarm)&&warm>.2?3*overall*warm*wxClamp(source.weatherSeasonLadybugIntensity,0,180,25)/100*weather.insects:0;
  const moths=!isDay&&source.weatherSeasonMoths!==false&&(tropical||seasonWarm||fallMild)&&warm>.15?4.5*overall*warm*humid*wxClamp(source.weatherSeasonMothIntensity,0,180,40)/100*weather.insects:0;
  const birdSeason=tropical||season!=='winter'||subtropical||(Number.isFinite(temp)&&temp>3),birdSeasonFactor=tropical?1.08:season==='spring'?1.12:season==='summer'?.88:season==='fall'?1.34:band==='high-latitude'?.22:.48,birdTune=wxClamp(source.weatherSeasonBirdIntensity,0,180,55)/100*wxClamp(source.weatherSeasonBirdFlock,0,180,60)/60,owlMode=source.weatherSeasonOwls===true,dayBirds=isDay&&source.weatherSeasonBirds!==false&&birdSeason?4*overall*birdSeasonFactor*birdTune*weather.birds:0,nightBirds=!isDay&&source.weatherSeasonBirds!==false&&birdSeason?1.1*overall*Math.max(.45,birdSeasonFactor)*birdTune*weather.birds:0,birds=isDay?dayBirds:nightBirds;
  const owlTune=wxClamp(source.weatherSeasonOwlIntensity,0,180,45)/100,owlIntent=owlMode&&overall>0&&owlTune>0&&weather.birds>0,owlActivity=isDay?1:1.12,owls=owlIntent?Math.max(.70,4*overall*Math.max(.75,birdSeasonFactor)*owlTune*weather.birds*owlActivity):0;
  return {isDay,bees,butterflies,fireflies,dragonflies,ladybugs,moths,birds,owls,weatherReason:weather.reason};
}
function seasonalEffectCounts(season,source,constrained,data=null,world=null){
  const d=data||configApi.wxData,context=weatherSeasonContextForData(d,source),budget=performanceApi.visualPerformanceBudget(),factor=wxClamp(source.weatherSeasonalIntensity,0,100,45)/100*(constrained?budget.particleScale:1),ground=factor*(context.automatic?context.scale:1),condition=weatherVisualCondition(d?.current?.weather_code),wild=weatherWildlifeProfile(d,source,context,condition);
  const temp=Number(d?.current?.temperature_2m),snowCapable=season==='winter'&&!['equatorial','tropical'].includes(context.climateBand)&&(!Number.isFinite(temp)||temp<=6||condition==='snow'),snowmanTune=wxClamp(source.weatherSeasonSnowmanIntensity,0,100,60)/100,snowmen=snowCapable&&source.weatherSeasonSnowmen!==false&&snowmanTune>.05?Math.max(1,Math.min(constrained?1:3,Math.round(1+snowmanTune*1.6))):0,base={leaves:season==='fall'&&source.weatherSeasonLeaves!==false?Math.round(34*ground*wxClamp(source.weatherSeasonLeavesIntensity,0,180,100)/100):0,grass:['spring','summer'].includes(season)&&source.weatherSeasonGrass!==false?Math.round(22*ground*wxClamp(source.weatherSeasonGrassIntensity,0,180,100)/100):0,petals:season==='spring'&&source.weatherSeasonPetals!==false?Math.round(24*ground*wxClamp(source.weatherSeasonPetalIntensity,0,180,80)/100):0,crystals:season==='winter'&&source.weatherSeasonCrystals!==false?Math.round(18*ground*wxClamp(source.weatherSeasonCrystalIntensity,0,180,70)/100):0,snowmen,bees:visibleWildlifeCount(wild.bees,constrained,'bees'),butterflies:visibleWildlifeCount(wild.butterflies,constrained,'butterflies'),fireflies:visibleWildlifeCount(wild.fireflies,constrained,'fireflies'),dragonflies:visibleWildlifeCount(wild.dragonflies,constrained,'dragonflies'),ladybugs:visibleWildlifeCount(wild.ladybugs,constrained,'ladybugs'),moths:visibleWildlifeCount(wild.moths,constrained,'moths'),birds:visibleWildlifeCount(wild.birds,constrained,'birds'),owls:visibleWildlifeCount(wild.owls,constrained,'birds')};
  const adjusted=weatherWorldAdjustedCounts(base,world||weatherWorldState(d,source)),flyingCap=Math.max(1,Number(budget.maxFlyingWildlife)||99);if(source.weatherSeasonOwls===true){const mixedCap=performanceApi.frontendCapabilities().pi4Class?Math.min(5,flyingCap+1):flyingCap,birdsWanted=Math.max(0,adjusted.birds||0),owlsWanted=Math.max(0,adjusted.owls||0),owlReserve=owlsWanted>0?1:0,birdReserve=birdsWanted>0?1:0;adjusted.birds=Math.min(birdsWanted,Math.max(birdReserve,mixedCap-owlReserve>0?Math.min(2,mixedCap-owlReserve):0));adjusted.owls=Math.min(owlsWanted,Math.max(owlReserve,mixedCap-adjusted.birds));if(adjusted.birds+adjusted.owls<mixedCap&&birdsWanted>adjusted.birds)adjusted.birds=Math.min(birdsWanted,mixedCap-adjusted.owls);}else{const totalFlying=(adjusted.birds||0)+(adjusted.owls||0);if(totalFlying>flyingCap){adjusted.birds=Math.min(adjusted.birds||0,flyingCap);adjusted.owls=Math.max(0,Math.min(adjusted.owls||0,flyingCap-adjusted.birds));}}return adjusted;
}
function seasonalParticleCount(season,source,constrained,data=null,world=null){if(source.weatherSeasonalEffects===false)return 0;return Object.values(seasonalEffectCounts(season,source,constrained,data,world)).reduce((a,b)=>a+b,0);}
function seasonalParticleBase(i,source,wind){const p=document.createElement('span'),speed=wxClamp(source.weatherEffectSpeed,40,180,100)/100,scale=.55+seededUnit(i,34)*1.15,drift=wind.direction*(8+seededUnit(i,35)*28)*Math.max(.28,wind.strength);p.className='weather-fx-seasonal';p._ldSeasonScale=scale;p._ldSeasonDrift=drift;p.style.setProperty('--season-x',`${(seededUnit(i,31)*108-4).toFixed(2)}vw`);p.style.setProperty('--season-y',`${(seededUnit(i,32)*92+2).toFixed(2)}vh`);p.style.setProperty('--season-delay',`${(-seededUnit(i,33)*18/speed).toFixed(2)}s`);p.style.setProperty('--season-scale',scale.toFixed(2));p.style.setProperty('--season-drift',`${drift.toFixed(1)}vw`);return p;}
function appendSeasonType(frag,type,count,source,data,wind){
  const baseSpeed=wxClamp(source.weatherEffectSpeed,40,180,100)/100,pi4BirdClass=performanceApi.frontendCapabilities().pi4Class,pi4BirdScale=pi4BirdClass?1.22:1;for(let i=0;i<count;i++){const p=seasonalParticleBase(i+({leaves:0,grass:100,petals:200,crystals:300,bees:400,butterflies:500,fireflies:600,birds:700,owls:800,dragonflies:900,ladybugs:1000,moths:1100}[type]||0),source,wind),baseScale=p._ldSeasonScale||1;
    if(type==='leaves'){p.classList.add('weather-fx-leaf');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonLeavesSize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((5.5+seededUnit(i,40)*8)/(baseSpeed*wxClamp(source.weatherSeasonLeavesSpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-drift',`${(p._ldSeasonDrift*wxClamp(source.weatherSeasonLeavesWind,0,200,100)/100).toFixed(1)}vw`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonLeavesOpacity,0,100,100)/100));p.style.setProperty('--leaf-hue',String(Math.round(18+seededUnit(i,41)*38)));}
    else if(type==='grass'){p.classList.add('weather-fx-grass');if(weatherSeasonContextForData(data,source).season==='summer')p.classList.add('weather-fx-summer-grass');p.style.setProperty('--grass-h',`${((3+seededUnit(i,36)*7)*wxClamp(source.weatherSeasonGrassHeight,30,200,100)/100).toFixed(1)}vh`);p.style.setProperty('--grass-sway',String(wxClamp(source.weatherSeasonGrassSway,0,200,100)/100));p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonGrassOpacity,0,100,100)/100));}
    else if(type==='petals'){p.classList.add('weather-fx-petal');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonPetalSize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((8+seededUnit(i,37)*10)/(baseSpeed*wxClamp(source.weatherSeasonPetalSpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonPetalOpacity,0,100,100)/100));p.style.setProperty('--petal-hue',String(Math.round(320+seededUnit(i,38)*40)));}
    else if(type==='crystals'){p.classList.add('weather-fx-crystal');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonCrystalSize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((7+seededUnit(i,42)*10)/(baseSpeed*wxClamp(source.weatherSeasonCrystalSpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonCrystalOpacity,0,100,100)/100));}
    else if(type==='bees'){p.classList.add('weather-fx-bee');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonBeeSize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((7+seededUnit(i,61)*7)/(baseSpeed*wxClamp(source.weatherSeasonBeeSpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonBeeOpacity,0,100,100)/100));}
    else if(type==='butterflies'){const context=weatherSeasonContextForData(data,source),species=butterflySpeciesForIndex(i,data,source,context);p.classList.add('weather-fx-butterfly','weather-fx-butterfly-'+species);p.dataset.species=species;p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonButterflySize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((9+seededUnit(i,62)*9)/(baseSpeed*wxClamp(source.weatherSeasonButterflySpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonButterflyOpacity,0,100,100)/100));}
    else if(type==='fireflies'){p.classList.add('weather-fx-firefly');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonFireflySize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((5+seededUnit(i,39)*8)/(baseSpeed*wxClamp(source.weatherSeasonFireflySpeed,30,200,100)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonFireflyOpacity,0,100,100)/100));p.style.setProperty('--firefly-glow',String(wxClamp(source.weatherSeasonFireflyGlow,0,200,100)/100));}
    else if(type==='dragonflies'){p.classList.add('weather-fx-dragonfly');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonDragonflySize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((6+seededUnit(i,71)*6)/(baseSpeed*wxClamp(source.weatherSeasonDragonflySpeed,30,200,110)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonDragonflyOpacity,0,100,100)/100));}
    else if(type==='ladybugs'){p.classList.add('weather-fx-ladybug');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonLadybugSize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((8+seededUnit(i,72)*8)/(baseSpeed*wxClamp(source.weatherSeasonLadybugSpeed,30,200,80)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonLadybugOpacity,0,100,100)/100));}
    else if(type==='moths'){p.classList.add('weather-fx-moth');p.style.setProperty('--season-scale',(baseScale*wxClamp(source.weatherSeasonMothSize,30,200,100)/100).toFixed(2));p.style.setProperty('--season-duration',`${((9+seededUnit(i,73)*10)/(baseSpeed*wxClamp(source.weatherSeasonMothSpeed,30,200,90)/100)).toFixed(2)}s`);p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonMothOpacity,0,100,100)/100));}
    else if(type==='birds'){const context=weatherSeasonContextForData(data,source),band=context.climateBand||'unknown',region=weatherEcologyRegion(data,source,context),species=birdSpeciesForIndex(i,data,source,context),morph=birdMorphology(species),morphScale={raptor:1.32,wader:1.34,nocturnal:1.12,hover:.72,large:1.18,songbird:1}[morph]||1,morphSpeed={raptor:.78,wader:.72,nocturnal:.82,hover:1.28,large:.8,songbird:1}[morph]||1;p.classList.add('weather-fx-bird','weather-fx-bird-'+band,'weather-fx-bird-region-'+region,'weather-fx-bird-species-'+species,'weather-fx-bird-'+morph);p.dataset.species=species;if(context.season==='fall')p.classList.add('weather-fx-bird-migrating');p.style.setProperty('--season-duration',`${((14+seededUnit(i,64)*14)/(baseSpeed*wxClamp(source.weatherSeasonBirdSpeed,30,200,100)/100*morphSpeed)).toFixed(2)}s`);p.style.setProperty('--bird-y',`${((8+seededUnit(i,65)*45)*wxClamp(source.weatherSeasonBirdHeight,35,180,100)/100).toFixed(1)}vh`);const rawBirdScale=(.55+seededUnit(i,66)*.9)*wxClamp(source.weatherSeasonBirdSize,30,200,100)/100*morphScale,displayBirdScale=pi4BirdClass?wxClamp(rawBirdScale*pi4BirdScale,1.05,1.85,1.2):rawBirdScale;p.style.setProperty('--bird-scale',displayBirdScale.toFixed(2));p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonBirdOpacity,0,100,100)/100));for(const part of (performanceApi.visualPerformanceBudget().wildlifeDetail!=='lite'?['wing-far','wing-near','head','tail','beak','neck','legs','mark']:['wing-near','head','tail','beak'])){const detail=document.createElement('i');detail.className='weather-fx-bird-'+part;p.appendChild(detail);}p.dataset.wildlifeRenderer=WILDLIFE_RENDERER;}
    else if(type==='owls'){const context=weatherSeasonContextForData(data,source),region=weatherEcologyRegion(data,source,context),species=owlSpeciesForIndex(i,data,source,context),behavior=owlBehavior(species);p.classList.add('weather-fx-bird','weather-fx-owl','weather-fx-bird-nocturnal','weather-fx-owl-'+behavior,'weather-fx-bird-region-'+region,'weather-fx-bird-species-'+species);p.dataset.species=species;p.style.setProperty('--season-duration',`${((13+seededUnit(i,74)*14)/(baseSpeed*wxClamp(source.weatherSeasonOwlSpeed,30,200,85)/100)).toFixed(2)}s`);p.style.setProperty('--bird-y',`${(behavior==='ground'?72+seededUnit(i,75)*16:10+seededUnit(i,75)*42).toFixed(1)}vh`);const rawOwlScale=(.8+seededUnit(i,76)*.7)*wxClamp(source.weatherSeasonOwlSize,30,200,110)/100,displayOwlScale=pi4BirdClass?wxClamp(rawOwlScale*pi4BirdScale,1.05,1.85,1.25):rawOwlScale;p.style.setProperty('--bird-scale',displayOwlScale.toFixed(2));p.style.setProperty('--season-opacity',String(wxClamp(source.weatherSeasonOwlOpacity,0,100,100)/100));for(const part of (performanceApi.visualPerformanceBudget().wildlifeDetail!=='lite'?['wing-far','wing-near','head','tail','beak','neck','legs','mark']:['wing-near','head','tail','beak'])){const detail=document.createElement('i');detail.className='weather-fx-bird-'+part;p.appendChild(detail);}p.dataset.wildlifeRenderer=WILDLIFE_RENDERER;}
    if(type==='birds'||type==='owls')p.dataset.wildlifeActor=`${type}-${i}-${p.dataset.species||'unknown'}`;frag.appendChild(p);
  }
}
function appendWinterSnowmen(frag,source,data,counts){const count=Math.max(0,Number(counts?.snowmen)||0);if(!count)return;const size=wxClamp(source.weatherSeasonSnowmanSize,60,160,100)/100,opacity=wxClamp(source.weatherSeasonSnowmanOpacity,20,100,100)/100;for(let i=0;i<count;i++){const snowman=document.createElement('span');snowman.className='weather-fx-snowman';snowman.style.setProperty('--snowman-x',`${(9+seededUnit(i,231)*80).toFixed(1)}vw`);snowman.style.setProperty('--snowman-scale',(size*(.78+seededUnit(i,232)*.34)).toFixed(2));snowman.style.setProperty('--snowman-opacity',opacity.toFixed(2));snowman.style.setProperty('--snowman-delay',`${(-seededUnit(i,233)*8).toFixed(1)}s`);for(const part of ['shadow','body','head','eye-a','eye-b','nose','button-a','button-b','arm-a','arm-b','scarf','hat']){const el=document.createElement('i');el.className=`snowman-${part}`;snowman.appendChild(el);}frag.appendChild(snowman);}}
function appendSeasonalParticles(frag,season,source,data,wind,counts=null){counts=counts||seasonalEffectCounts(season,source,performanceApi.frontendCapabilities().constrained,data);for(const type of ['leaves','grass','petals','crystals','bees','butterflies','fireflies','dragonflies','ladybugs','moths','birds','owls'])if(counts[type]>0)appendSeasonType(frag,type,counts[type],source,data,wind);appendWinterSnowmen(frag,source,data,counts);}
const WEATHER_HAZARD_SEVERITY_RANK={Extreme:0,Severe:1,Moderate:2,Minor:3,Unknown:4};
const WEATHER_HAZARD_TEST_PROFILES={
  flood:{event:'Flash Flood Warning',severity:'Severe',headline:'Flash flooding expected',description:'Rapid flooding of roads and low areas is possible.'},
  wind:{event:'High Wind Warning',severity:'Severe',headline:'Damaging winds expected',description:'Strong damaging wind gusts are expected.'},
  tornado:{event:'Tornado Warning',severity:'Extreme',headline:'Tornado warning in effect',description:'A tornado is possible in the warning area.'},
  tropical:{event:'Hurricane Warning',severity:'Extreme',headline:'Hurricane conditions expected',description:'Hurricane-force winds, heavy rain and storm surge are possible.'},
  storm:{event:'Severe Thunderstorm Warning',severity:'Severe',headline:'Severe thunderstorm warning',description:'Damaging winds and dangerous lightning are possible.'},
  winter:{event:'Blizzard Warning',severity:'Severe',headline:'Blizzard conditions expected',description:'Heavy blowing snow and whiteout conditions are possible.'},
  visibility:{event:'Dense Fog Advisory',severity:'Moderate',headline:'Very low visibility',description:'Dense fog may reduce visibility substantially.'},
  heat:{event:'Excessive Heat Warning',severity:'Severe',headline:'Dangerous heat expected',description:'Dangerously hot conditions are expected.'},
  fire:{event:'Red Flag Warning',severity:'Severe',headline:'Critical fire weather',description:'Hot, dry and windy conditions may support rapid fire spread.'}
};
let weatherHazardTestProfile='live';
function weatherHazardAlertFeed(){return weatherHazardTestProfile!=='live'&&WEATHER_HAZARD_TEST_PROFILES[weatherHazardTestProfile]?[{...WEATHER_HAZARD_TEST_PROFILES[weatherHazardTestProfile],test:true}]:configApi.activeWeatherAlerts||[];}
function weatherHazardAlerts(source){
  if(source.weatherHazardEffects===false)return [];
  const threshold=weatherHazardTestProfile!=='live'?4:({all:4,minor:3,moderate:2,severe:1,extreme:0}[source.weatherHazardMinSeverity||'moderate']??2),out=new Map();
  for(const alert of weatherHazardAlertFeed()){
    const rank=WEATHER_HAZARD_SEVERITY_RANK[alert?.severity]??4;if(rank>threshold)continue;
    const text=`${alert?.event||''} ${alert?.headline||''} ${alert?.description||''}`.toLowerCase();
    const add=(key,enabled,subtype='')=>{if(!enabled)return;const prev=out.get(key);if(!prev||rank<prev.rank)out.set(key,{key,rank,event:alert?.event||'Weather alert',subtype});};
    add('tornado',source.weatherHazardTornado!==false&&/tornado|waterspout|funnel cloud/.test(text));
    add('tropical',source.weatherHazardTropical!==false&&/hurricane|tropical storm|typhoon|cyclone|storm surge|tropical depression/.test(text));
    add('flood',source.weatherHazardFlood!==false&&/flash flood|flood warning|flood advisory|coastal flood|river flood|areal flood|lakeshore flood|storm surge|hydrologic|dam break|levee/.test(text));
    add('winter',source.weatherHazardWinter!==false&&/blizzard|winter storm|snow squall|ice storm|winter weather|lake effect snow|freezing rain|freezing fog|extreme cold|wind chill|freeze warning|frost advisory/.test(text));
    add('storm',source.weatherHazardStorm!==false&&/severe thunderstorm|thunderstorm warning|special marine warning|squall warning|damaging thunderstorm/.test(text));
    add('wind',source.weatherHazardWind!==false&&/high wind|wind advisory|wind warning|damaging wind|extreme wind|gale warning|storm warning|hurricane force wind/.test(text));
    add('visibility',source.weatherHazardVisibility!==false&&/dense fog|freezing fog|dense smoke|smoke|air quality|dust storm|dust advisory|blowing dust|ashfall/.test(text));
    add('heat-fire',source.weatherHazardHeatFire!==false&&/excessive heat|heat advisory|extreme heat|red flag|fire weather|extreme fire danger/.test(text),/red flag|fire weather|fire danger/.test(text)?'fire':'heat');
  }
  const priority={tornado:0,tropical:1,flood:2,winter:3,storm:4,wind:5,visibility:6,'heat-fire':7};
  let hazards=[...out.values()];if(hazards.some(h=>h.key==='tornado'||h.key==='tropical'))hazards=hazards.filter(h=>!['storm','wind'].includes(h.key));
  return hazards.sort((a,b)=>a.rank-b.rank||(priority[a.key]??9)-(priority[b.key]??9)).slice(0,3);
}
function weatherWorldState(data,source,hazards=null){
  const condition=weatherVisualCondition(data?.current?.weather_code),context=weatherSeasonContextForData(data,source),isDay=weatherIsDay(data),temp=Number(data?.current?.temperature_2m),humidity=Number(data?.current?.relative_humidity_2m),wind=Number(data?.current?.wind_speed_10m),precip=Number(data?.current?.precipitation),holidayKeys=sceneryApi.activeHolidayKeys(data,source),activeHazards=hazards||weatherHazardAlerts(source),hazardKeys=activeHazards.map(h=>h.subtype==='fire'?'fire':h.key),keys=new Set(hazardKeys),dogKeys=[...hazardKeys];
  const addDogKey=k=>{if(k&&!dogKeys.includes(k))dogKeys.push(k);};if(condition==='storm')addDogKey('storm');else if(condition==='rain')addDogKey('rain');else if(condition==='snow')addDogKey('snow');else if(condition==='fog')addDogKey('fog');if(Number.isFinite(wind)&&wind>=34)addDogKey('wind');if(Number.isFinite(temp)&&temp>=34)addDogKey('heat');if(Number.isFinite(temp)&&temp<=-8)addDogKey('cold');if(holidayKeys.some(k=>k==='new-year'||k==='independence'))addDogKey('fireworks');
  const shelter=condition==='storm'||keys.has('flood')||keys.has('tornado')||keys.has('tropical')||keys.has('storm')||keys.has('winter')||keys.has('fire'),cautious=!shelter&&(keys.has('wind')||keys.has('visibility')||keys.has('heat-fire')||['rain','snow','fog'].includes(condition)||(Number.isFinite(wind)&&wind>=26)||(Number.isFinite(temp)&&(temp>=32||temp<=0))||dogKeys.includes('fireworks')),mode=shelter?'shelter':cautious?'cautious':'normal';
  const surface=keys.has('flood')?'flooded':keys.has('fire')?'fire-risk':condition==='snow'||keys.has('winter')?'snowy':condition==='rain'||condition==='storm'?'wet':Number.isFinite(temp)&&temp>=33?'hot':'normal',holidayMode=mode==='shelter'?'subdued':mode==='cautious'?'weather-aware':'normal',holidayFactor=mode==='shelter'?.28:mode==='cautious'?.62:1,holidayNature=sceneryApi.holidayNaturePolicy?sceneryApi.holidayNaturePolicy(holidayKeys):null;
  return {condition,season:context.season,context,isDay,temp,humidity,wind,precip,hazards:activeHazards,hazardKeys,dogKeys,holidayKeys,holidayNature,mode,surface,holidayMode,holidayFactor,signature:[mode,surface,isDay?'day':'night',hazardKeys.join(','),dogKeys.join(','),holidayKeys.join(','),holidayNature?Object.values(holidayNature).join(','):'',Number.isFinite(temp)?Math.round(temp):'',Number.isFinite(wind)?Math.round(wind):'',Number.isFinite(precip)?Math.round(precip*10):''].join(':')};
}
function weatherWorldAdjustedCounts(counts,world){
  const out={...(counts||{})},zeroWild=()=>{for(const k of ['bees','butterflies','fireflies','dragonflies','ladybugs','moths','birds','owls'])out[k]=0;},zeroInsects=()=>{for(const k of ['bees','butterflies','fireflies','dragonflies','ladybugs','moths'])out[k]=0;},keys=new Set(world?.hazardKeys||[]);
  if(!world)return out;if(world.mode==='shelter')zeroWild();if(keys.has('flood')){for(const k of ['leaves','grass','petals','crystals','snowmen'])out[k]=0;}if(keys.has('fire')){for(const k of ['leaves','grass','petals','crystals','snowmen'])out[k]=0;}if(keys.has('winter')){zeroInsects();out.birds=Math.min(1,out.birds||0);out.owls=0;out.snowmen=0;}if(world.condition==='snow'){for(const k of ['leaves','grass','petals'])out[k]=0;}if(world.condition==='rain'){out.petals=Math.round((out.petals||0)*.25);out.butterflies=Math.round((out.butterflies||0)*.2);out.bees=Math.round((out.bees||0)*.15);}if(world.condition==='fog'){out.birds=Math.min(1,out.birds||0);out.owls=Math.min(1,out.owls||0);}if(Number.isFinite(world.wind)&&world.wind>=40){zeroInsects();out.birds=Math.min(1,out.birds||0);out.owls=Math.min(1,out.owls||0);if(world.season==='fall'&&!keys.size)out.leaves=Math.round((out.leaves||0)*1.18);}if(Number.isFinite(world.temp)&&world.temp<=2)zeroInsects();if(Number.isFinite(world.temp)&&world.temp>=35){for(const k of ['bees','butterflies','dragonflies','ladybugs'])out[k]=Math.round((out[k]||0)*.35);}if((world.holidayKeys||[]).some(k=>k==='new-year'||k==='independence')){out.birds=0;out.owls=0;}const hp=world.holidayNature;if(hp){for(const key of ['leaves','grass','petals','crystals','snowmen'])if(hp[key]!=null)out[key]=Math.round((out[key]||0)*hp[key]);const insectFactor=hp.insects??1;for(const key of ['bees','butterflies','fireflies','dragonflies','ladybugs','moths'])out[key]=Math.round((out[key]||0)*insectFactor);if(hp.birds!=null)out.birds=Math.round((out.birds||0)*hp.birds);if(hp.owls!=null)out.owls=Math.round((out.owls||0)*hp.owls);}return out;
}
function weatherWorldClassList(world){if(!world)return [];const classes=[`weather-world-${world.mode}`,`weather-world-surface-${world.surface}`,world.isDay?'weather-world-day':'weather-world-night'];for(const key of world.hazardKeys||[])classes.push(`weather-world-hazard-${key}`);if(world.holidayKeys?.length)classes.push('weather-world-holiday');return classes;}
function appendCloudAtmosphere(frag,condition,source,data,wind){
  if(source.weatherEffectClouds===false||!['partly','cloud','rain','snow','storm'].includes(condition))return;
  const cover=wxClamp(data?.current?.cloud_cover,0,100,condition==='partly'?48:condition==='cloud'?92:100),density=wxClamp(source.weatherCloudDensity,0,180,100)/100,opacity=wxClamp(source.weatherCloudOpacity,0,100,100)/100,speed=wxClamp(source.weatherCloudSpeed,20,200,100)/100,scaleTune=wxClamp(source.weatherCloudScale,40,180,100)/100;
  const base=condition==='partly'?5:condition==='cloud'?12:condition==='storm'?9:7,cloudBudget=performanceApi.visualPerformanceBudget(),cloudScale=performanceApi.frontendCapabilities().constrained?cloudBudget.cloudScale:1,count=Math.max(2,Math.min(cloudBudget.maxClouds||20,Math.round(base*density*(.66+cover/135)*cloudScale)));
  for(let i=0;i<count;i++){
    const p=document.createElement('span'),depth=.35+seededUnit(i,151)*.65,stormy=condition==='storm';p.className=`weather-fx-cloud-mass weather-fx-cloud-mass-${stormy?'storm':condition==='cloud'?'overcast':'soft'}`;
    p.style.setProperty('--cloud-y',`${(-8+seededUnit(i,152)*(condition==='cloud'?30:32)).toFixed(1)}vh`);p.style.setProperty('--cloud-w',`${((21+seededUnit(i,153)*27)*scaleTune*(.82+depth*.32)).toFixed(1)}vw`);p.style.setProperty('--cloud-h',`${((8.5+seededUnit(i,154)*11.5)*scaleTune).toFixed(1)}vh`);p.style.setProperty('--cloud-alpha',String(wxClamp((.39+depth*.40)*(stormy?.88:1)*opacity,.14,.94,.52)));p.style.setProperty('--cloud-shade',(.18+depth*.22).toFixed(2));p.style.setProperty('--cloud-delay',`${(-seededUnit(i,155)*52).toFixed(1)}s`);p.style.setProperty('--cloud-duration',`${((38+seededUnit(i,156)*54)/Math.max(.35,speed*(.78+wind.strength*.14))).toFixed(1)}s`);p.style.setProperty('--cloud-drift',`${(wind.direction*(118+seededUnit(i,157)*42)).toFixed(1)}vw`);p.style.setProperty('--cloud-depth',depth.toFixed(2));frag.appendChild(p);
  }
  if(condition==='cloud'&&cover>=80){const deck=document.createElement('span');deck.className='weather-fx-overcast-deck';deck.style.setProperty('--overcast-alpha',String(wxClamp((cover-58)/110*opacity,.16,.42,.28)));frag.appendChild(deck);}
}
function appendHazardScenery(frag,source,wind,constrained=false){
  const hazards=weatherHazardAlerts(source);if(!hazards.length)return hazards;
  const caps=performanceApi.frontendCapabilities(),budget=performanceApi.visualPerformanceBudget(),pi=caps.piClass,hazardCount=(low,high,piLow=Math.max(1,Math.round(low*budget.secondaryScale)))=>pi?piLow:(constrained?low:high);
  const intensity=wxClamp(source.weatherHazardIntensity,20,100,70)/100,opacity=wxClamp(source.weatherHazardOpacity,0,100,100)/100,speed=wxClamp(source.weatherHazardSpeed,30,180,100)/100;
  const base=(key)=>{const el=document.createElement('span'),direction=wind.direction||1;el.className=`weather-fx-hazard weather-fx-hazard-${key}`;el.style.setProperty('--hazard-strength',intensity.toFixed(2));el.style.setProperty('--hazard-opacity',opacity.toFixed(2));el.style.setProperty('--hazard-alpha',(intensity*opacity*.96).toFixed(3));el.style.setProperty('--hazard-speed',speed.toFixed(2));el.style.setProperty('--hazard-direction',String(direction));return el;};
  for(const hazard of hazards){
    if(hazard.key==='flood'){
      const water=base('flood'),level=wxClamp(source.weatherHazardFloodLevel,20,180,100)/100,debrisTune=wxClamp(source.weatherHazardFloodDebris,0,180,100)/100,current=wxClamp(source.weatherHazardFloodSpeed,30,180,100)/100;water.style.setProperty('--hazard-flood-height',`${(22*level).toFixed(1)}vh`);water.style.setProperty('--hazard-duration',`${(7.4/Math.max(.2,speed*current)).toFixed(2)}s`);
      for(let i=0;i<hazardCount(3,6,2);i++){const wave=document.createElement('b');wave.className='hazard-flood-wave';wave.style.setProperty('--wave-y',`${(1.4+i*3.5).toFixed(1)}vh`);wave.style.setProperty('--wave-delay',`${(-i*1.35).toFixed(1)}s`);wave.style.setProperty('--wave-duration',`${((4.8+i*.55)/Math.max(.25,speed*current)).toFixed(1)}s`);wave.style.setProperty('--wave-alpha',String((.22+i*.035).toFixed(2)));water.appendChild(wave);}for(let i=0;i<3;i++){const depth=document.createElement('span');depth.className='hazard-flood-depth';depth.style.setProperty('--flood-depth-y',`${(8+i*5).toFixed(1)}vh`);depth.style.setProperty('--flood-depth-delay',`${(-i*1.8).toFixed(1)}s`);water.appendChild(depth);}
      const debrisClasses=['hazard-flood-branch','hazard-flood-plank','hazard-flood-bottle','hazard-flood-can','hazard-flood-leaf','hazard-flood-debris'],debrisCount=Math.min(constrained?6:15,Math.max(0,Math.round(hazardCount(6,11,4)*debrisTune)));for(let i=0;i<debrisCount;i++){const d=document.createElement('i');d.className=debrisClasses[i%debrisClasses.length];d.style.setProperty('--debris-delay',`${(-seededUnit(i,181)*16).toFixed(1)}s`);d.style.setProperty('--debris-y',`${(3+seededUnit(i,182)*14).toFixed(1)}vh`);d.style.setProperty('--debris-duration',`${((8+seededUnit(i,183)*8)/(speed*current)).toFixed(1)}s`);d.style.setProperty('--debris-scale',(.7+seededUnit(i,188)*.8).toFixed(2));water.appendChild(d);}for(let i=0;i<hazardCount(3,6,2);i++){const foam=document.createElement('em');foam.className='hazard-flood-foam';foam.style.setProperty('--foam-y',`${(2+i*3.7).toFixed(1)}vh`);foam.style.setProperty('--foam-delay',`${(-i*1.15).toFixed(1)}s`);water.appendChild(foam);}for(let i=0;i<hazardCount(1,3,1);i++){const fish=document.createElement('em');fish.className='hazard-flood-fish';fish.style.setProperty('--fish-y',`${(5+seededUnit(i,184)*9).toFixed(1)}vh`);fish.style.setProperty('--fish-delay',`${(-seededUnit(i,185)*9).toFixed(1)}s`);fish.style.setProperty('--fish-duration',`${((7+seededUnit(i,186)*5)/(speed*current)).toFixed(1)}s`);fish.style.setProperty('--fish-scale',`${(.82+seededUnit(i,187)*.58).toFixed(2)}`);water.appendChild(fish);}frag.appendChild(water);
    }else if(hazard.key==='wind'){
      const gust=base('wind'),gustTune=wxClamp(source.weatherHazardWindGusts,0,180,100)/100,gustSpeed=wxClamp(source.weatherHazardWindSpeed,30,180,100)/100;gust.style.setProperty('--hazard-duration',`${(3.4/Math.max(.2,speed*gustSpeed)).toFixed(2)}s`);const gustCount=Math.min(constrained?5:12,Math.max(0,Math.round(hazardCount(5,9,3)*gustTune)));for(let i=0;i<gustCount;i++){const d=document.createElement('i');d.style.setProperty('--gust-y',`${(10+seededUnit(i,184)*76).toFixed(1)}vh`);d.style.setProperty('--gust-delay',`${(-seededUnit(i,185)*9).toFixed(1)}s`);d.style.setProperty('--gust-width',`${(22+seededUnit(i,186)*28).toFixed(1)}vw`);gust.appendChild(d);}for(let i=0;i<hazardCount(3,8,2);i++){const leaf=document.createElement('b');leaf.style.setProperty('--wind-debris-y',`${(18+seededUnit(i,189)*66).toFixed(1)}vh`);leaf.style.setProperty('--wind-debris-delay',`${(-seededUnit(i,190)*8).toFixed(1)}s`);gust.appendChild(leaf);}frag.appendChild(gust);
    }else if(hazard.key==='tornado'){
      const funnel=base('tornado'),size=wxClamp(source.weatherHazardTornadoSize,40,180,100)/100,tornadoOpacity=wxClamp(source.weatherHazardTornadoOpacity,10,100,100)/100;funnel.style.setProperty('--hazard-alpha',(intensity*opacity*tornadoOpacity).toFixed(3));funnel.style.setProperty('--hazard-tornado-width',`${(31*size).toFixed(1)}vw`);funnel.style.setProperty('--hazard-tornado-height',`${(76*size).toFixed(1)}vh`);funnel.style.setProperty('--hazard-duration',`${(8.5/Math.max(.2,speed)).toFixed(2)}s`);
      for(const cls of ['hazard-tornado-wallcloud','hazard-tornado-inflow','hazard-tornado-condensation','hazard-tornado-core','hazard-tornado-ground']){const el=document.createElement('strong');el.className=cls;funnel.appendChild(el);}const vaporCount=constrained?11:19;for(let i=0;i<vaporCount;i++){const vapor=document.createElement('i'),t=i/(vaporCount-1),spread=(1-t)*14+2;vapor.className='hazard-tornado-vapor';vapor.style.setProperty('--vapor-y',`${(7+t*82).toFixed(1)}%`);vapor.style.setProperty('--vapor-x',`${(50+(seededUnit(i,221)-.5)*spread).toFixed(1)}%`);vapor.style.setProperty('--vapor-w',`${(82-(t*60)+seededUnit(i,222)*12).toFixed(1)}%`);vapor.style.setProperty('--vapor-h',`${(11-t*4+seededUnit(i,223)*4).toFixed(1)}%`);vapor.style.setProperty('--vapor-alpha',`${(.18+(1-t)*.28).toFixed(2)}`);vapor.style.setProperty('--vapor-delay',`${(-seededUnit(i,224)*3.2).toFixed(2)}s`);vapor.style.setProperty('--vapor-duration',`${((1.3+t*1.2)/Math.max(.3,speed)).toFixed(2)}s`);funnel.appendChild(vapor);}for(let i=0;i<hazardCount(3,6,2);i++){const suction=document.createElement('em');suction.className='hazard-tornado-suction';suction.style.setProperty('--suction-x',`${(33+seededUnit(i,225)*34).toFixed(1)}%`);suction.style.setProperty('--suction-delay',`${(-seededUnit(i,226)*2.8).toFixed(1)}s`);funnel.appendChild(suction);}for(let i=0;i<hazardCount(7,16,4);i++){const debris=document.createElement('b');debris.className='hazard-tornado-debris';debris.style.setProperty('--t-debris-x',`${(12+seededUnit(i,192)*76).toFixed(1)}%`);debris.style.setProperty('--t-debris-delay',`${(-seededUnit(i,193)*4).toFixed(1)}s`);debris.style.setProperty('--t-debris-size',`${(2+seededUnit(i,194)*5).toFixed(1)}px`);funnel.appendChild(debris);}frag.appendChild(funnel);
    }else if(hazard.key==='tropical'){
      const tropical=base('tropical'),bands=wxClamp(source.weatherHazardTropicalBands,0,180,100)/100,surge=wxClamp(source.weatherHazardTropicalSurge,0,180,100)/100;tropical.style.setProperty('--hazard-band-alpha',(0.42*bands).toFixed(3));tropical.style.setProperty('--hazard-surge-height',`${(7+surge*14).toFixed(1)}vh`);tropical.style.setProperty('--hazard-duration',`${(9.5/Math.max(.2,speed)).toFixed(2)}s`);const sky=document.createElement('strong');sky.className='hazard-tropical-sky';tropical.appendChild(sky);const shelf=document.createElement('strong');shelf.className='hazard-tropical-shelf';tropical.appendChild(shelf);for(let i=0;i<hazardCount(2,4,1);i++){const palm=document.createElement('strong');palm.className='hazard-tropical-palm';palm.style.setProperty('--palm-x',`${(i===0?8:74)+seededUnit(i,230)*6}vw`);palm.style.setProperty('--palm-scale',`${(.86+seededUnit(i,231)*.42).toFixed(2)}`);palm.style.setProperty('--palm-delay',`${(-seededUnit(i,232)*2.6).toFixed(1)}s`);tropical.appendChild(palm);}for(let i=0;i<hazardCount(3,7,2);i++){const scud=document.createElement('i');scud.className='hazard-tropical-scud';scud.style.setProperty('--tropical-scud-x',`${(-12+i*20+seededUnit(i,201)*8).toFixed(1)}vw`);scud.style.setProperty('--tropical-scud-y',`${(4+seededUnit(i,202)*25).toFixed(1)}vh`);scud.style.setProperty('--tropical-scud-w',`${(24+seededUnit(i,203)*24).toFixed(1)}vw`);scud.style.setProperty('--tropical-scud-alpha',`${(.28+seededUnit(i,204)*.27).toFixed(2)}`);scud.style.setProperty('--tropical-scud-delay',`${(-seededUnit(i,205)*7).toFixed(1)}s`);tropical.appendChild(scud);}for(let i=0;i<hazardCount(2,5,1);i++){const squall=document.createElement('em');squall.className='hazard-tropical-squall';squall.style.setProperty('--tropical-squall-y',`${(18+i*15+seededUnit(i,206)*5).toFixed(1)}vh`);squall.style.setProperty('--tropical-squall-alpha',`${(.12+.10*bands+seededUnit(i,207)*.08).toFixed(2)}`);squall.style.setProperty('--tropical-squall-delay',`${(-i*1.7).toFixed(1)}s`);tropical.appendChild(squall);}for(let i=0;i<hazardCount(12,34,7);i++){const rain=document.createElement('b');rain.className='hazard-tropical-rain';rain.style.setProperty('--tropical-rain-x',`${(seededUnit(i,208)*112-6).toFixed(1)}vw`);rain.style.setProperty('--tropical-rain-y',`${(seededUnit(i,209)*90-8).toFixed(1)}vh`);rain.style.setProperty('--tropical-rain-delay',`${(-seededUnit(i,210)*2.2).toFixed(1)}s`);rain.style.setProperty('--tropical-rain-length',`${(18+seededUnit(i,211)*24).toFixed(1)}vh`);tropical.appendChild(rain);}const spray=document.createElement('strong');spray.className='hazard-tropical-spray';tropical.appendChild(spray);frag.appendChild(tropical);
    }else if(hazard.key==='storm'){
      const storm=base('storm'),cloud=wxClamp(source.weatherHazardStormCloud,0,180,100)/100,gust=wxClamp(source.weatherHazardStormGust,0,180,100)/100;storm.style.setProperty('--hazard-storm-alpha',(0.64*cloud).toFixed(3));storm.style.setProperty('--hazard-duration',`${(6.4/Math.max(.2,speed*Math.max(.3,gust))).toFixed(2)}s`);const shelf=document.createElement('strong');shelf.className='hazard-storm-shelf';storm.appendChild(shelf);for(let i=0;i<hazardCount(5,9,3);i++){const cell=document.createElement('i');cell.className='hazard-storm-cell';cell.style.setProperty('--storm-cell-x',`${(-8+i*13+seededUnit(i,208)*8).toFixed(1)}vw`);cell.style.setProperty('--storm-cell-scale',(.8+seededUnit(i,218)*.75).toFixed(2));storm.appendChild(cell);}for(let i=0;i<hazardCount(16,36,9);i++){const rain=document.createElement('i');rain.className='hazard-storm-rain';rain.style.setProperty('--storm-rain-x',`${(seededUnit(i,209)*112).toFixed(1)}vw`);rain.style.setProperty('--storm-rain-delay',`${(-seededUnit(i,210)*2.8).toFixed(1)}s`);storm.appendChild(rain);}const front=document.createElement('b');front.className='hazard-storm-gust-front';storm.appendChild(front);for(let i=0;i<hazardCount(2,4,1);i++){const bolt=document.createElement('em');bolt.className='hazard-storm-bolt';bolt.style.setProperty('--storm-bolt-x',`${(14+seededUnit(i,211)*72).toFixed(1)}vw`);bolt.style.setProperty('--storm-bolt-delay',`${(-seededUnit(i,212)*5.8).toFixed(1)}s`);storm.appendChild(bolt);}frag.appendChild(storm);
    }else if(hazard.key==='winter'){
      const winter=base('winter'),whiteout=wxClamp(source.weatherHazardWinterWhiteout,0,180,100)/100,drift=wxClamp(source.weatherHazardWinterDrift,0,180,100)/100;winter.style.setProperty('--hazard-whiteout-alpha',(0.36*whiteout).toFixed(3));winter.style.setProperty('--hazard-drift-alpha',(0.30*drift).toFixed(3));winter.style.setProperty('--hazard-duration',`${(4.9/Math.max(.2,speed)).toFixed(2)}s`);const veil=document.createElement('strong');veil.className='hazard-blizzard-veil';winter.appendChild(veil);for(let i=0;i<hazardCount(22,68,12);i++){const flake=document.createElement('i');flake.className='hazard-blizzard-flake';flake.style.setProperty('--blizzard-x',`${(seededUnit(i,194)*112-6).toFixed(1)}vw`);flake.style.setProperty('--blizzard-y',`${(seededUnit(i,195)*108-4).toFixed(1)}vh`);flake.style.setProperty('--blizzard-delay',`${(-seededUnit(i,196)*8).toFixed(1)}s`);flake.style.setProperty('--blizzard-size',`${(1.5+seededUnit(i,197)*5.5).toFixed(1)}px`);flake.style.setProperty('--blizzard-depth',`${(.45+seededUnit(i,198)*.85).toFixed(2)}`);winter.appendChild(flake);}for(let i=0;i<hazardCount(3,6,2);i++){const gust=document.createElement('b');gust.className='hazard-blizzard-gust';gust.style.setProperty('--blizzard-gust-y',`${(8+i*16).toFixed(1)}vh`);gust.style.setProperty('--blizzard-gust-delay',`${(-i*1.15).toFixed(1)}s`);winter.appendChild(gust);}const ground=document.createElement('em');ground.className='hazard-blizzard-ground';winter.appendChild(ground);frag.appendChild(winter);
    }else if(hazard.key==='visibility'){
      const haze=base('visibility'),hazeOpacity=wxClamp(source.weatherHazardVisibilityOpacity,0,180,100)/100;haze.style.setProperty('--hazard-alpha',(intensity*opacity*hazeOpacity*.85).toFixed(3));haze.style.setProperty('--hazard-duration',`${(11/Math.max(.2,speed)).toFixed(2)}s`);for(let i=0;i<hazardCount(2,4,1);i++){const bank=document.createElement('i');bank.style.setProperty('--visibility-y',`${(28+i*16).toFixed(1)}vh`);bank.style.setProperty('--visibility-delay',`${(-i*3.2).toFixed(1)}s`);haze.appendChild(bank);}frag.appendChild(haze);
    }else if(hazard.key==='heat-fire'){
      const heat=base('heat-fire'),shimmer=wxClamp(source.weatherHazardHeatShimmer,0,180,100)/100,fire=hazard.subtype==='fire';heat.classList.add(`weather-fx-hazard-heat-fire-${fire?'fire':'heat'}`);heat.style.setProperty('--hazard-alpha',(intensity*opacity*shimmer*.92).toFixed(3));heat.style.setProperty('--hazard-duration',`${(4.4/Math.max(.2,speed)).toFixed(2)}s`);if(!fire){const sun=document.createElement('strong');sun.className='hazard-heat-sun';heat.appendChild(sun);for(let i=0;i<hazardCount(3,6,2);i++){const column=document.createElement('i');column.className='hazard-heat-column';column.style.setProperty('--heat-x',`${(5+i*17+seededUnit(i,199)*4).toFixed(1)}vw`);column.style.setProperty('--heat-delay',`${(-seededUnit(i,200)*3).toFixed(1)}s`);heat.appendChild(column);}}else{const ground=document.createElement('strong');ground.className='hazard-fire-ground';heat.appendChild(ground);const glow=document.createElement('strong');glow.className='hazard-fire-distance-glow';heat.appendChild(glow);for(let i=0;i<hazardCount(3,8,2);i++){const scrub=document.createElement('i');scrub.className='hazard-fire-scrub';scrub.style.setProperty('--fire-scrub-x',`${(seededUnit(i,221)*103-2).toFixed(1)}vw`);scrub.style.setProperty('--fire-scrub-w',`${(4+seededUnit(i,222)*8).toFixed(1)}vw`);scrub.style.setProperty('--fire-scrub-h',`${(2.8+seededUnit(i,223)*4.4).toFixed(1)}vh`);heat.appendChild(scrub);}for(let i=0;i<hazardCount(3,6,2);i++){const smoke=document.createElement('i');smoke.className='hazard-fire-smoke-plume';smoke.style.setProperty('--fire-smoke-x',`${(8+i*17+seededUnit(i,224)*7).toFixed(1)}vw`);smoke.style.setProperty('--fire-smoke-delay',`${(-seededUnit(i,225)*5).toFixed(1)}s`);smoke.style.setProperty('--fire-smoke-scale',`${(.75+seededUnit(i,226)*.55).toFixed(2)}`);heat.appendChild(smoke);}for(let i=0;i<hazardCount(3,8,2);i++){const brush=document.createElement('strong');brush.className='hazard-fire-brush';brush.style.setProperty('--brush-x',`${(seededUnit(i,240)*102-1).toFixed(1)}vw`);brush.style.setProperty('--brush-w',`${(6+seededUnit(i,241)*10).toFixed(1)}vw`);brush.style.setProperty('--brush-h',`${(4+seededUnit(i,242)*6).toFixed(1)}vh`);heat.appendChild(brush);}const fireline=document.createElement('strong');fireline.className='hazard-fire-smolder-line';heat.appendChild(fireline);for(let i=0;i<hazardCount(5,12,3);i++){const ember=document.createElement('b');ember.className='hazard-fire-ember';ember.style.setProperty('--ember-x',`${(seededUnit(i,213)*100).toFixed(1)}vw`);ember.style.setProperty('--ember-delay',`${(-seededUnit(i,214)*6).toFixed(1)}s`);heat.appendChild(ember);}}frag.appendChild(heat);
    }
  }
  return hazards;
}
function appendFogBanks(frag,source,data,wind){
  if(source.weatherFogRollingBanks===false)return;const budget=performanceApi.visualPerformanceBudget(),constrained=performanceApi.frontendCapabilities().constrained,strength=wxClamp(source.weatherFogDensity,0,180,115)/100,opacity=wxClamp(source.weatherFogOpacity,0,100,100)/100,blur=wxClamp(source.weatherFogBlur,20,200,100)/100,speed=wxClamp(source.weatherFogSpeed,20,150,80)/100,count=constrained?Math.max(1,Math.min(budget.maxFogBanks||3,Math.round(1+strength))):Math.max(4,Math.min(8,Math.round(4+strength*2)));const horizon=document.createElement('span');horizon.className='weather-fx-fog-horizon';horizon.style.setProperty('--fog-horizon-alpha',String(wxClamp(.16*strength*opacity,.06,.32,.16)));frag.appendChild(horizon);
  for(let i=0;i<count;i++){const p=document.createElement('span');p.className='weather-fx-fog-bank';p.style.setProperty('--fog-bank-y',`${(-8+i*(108/Math.max(1,count-1))+seededUnit(i,121)*8).toFixed(1)}vh`);p.style.setProperty('--fog-bank-h',`${(22+seededUnit(i,122)*22).toFixed(1)}vh`);p.style.setProperty('--fog-bank-alpha',String(wxClamp((.24+seededUnit(i,123)*.28)*strength*opacity,.05,.82,.3)));p.style.setProperty('--fog-bank-blur',`${(constrained?Math.max(0,2*budget.blurScale):(18+seededUnit(i,124)*20)*blur).toFixed(1)}px`);p.style.setProperty('--fog-bank-delay',`${(-seededUnit(i,125)*50).toFixed(1)}s`);p.style.setProperty('--fog-bank-duration',`${((42+seededUnit(i,126)*48)/Math.max(.35,speed*(.75+wind.strength*.12))).toFixed(1)}s`);p.style.setProperty('--fog-bank-drift',`${(wind.direction*(22+seededUnit(i,127)*32)*Math.max(.25,wind.strength)).toFixed(1)}vw`);frag.appendChild(p);}
}
function appendStormAtmosphere(frag,condition,source,data,wind,profile){
  if(condition!=='storm')return;const caps=performanceApi.frontendCapabilities();if(source.weatherStormCloudDeck!==false&&source.weatherEffectClouds!==false){for(let i=0;i<(caps.piClass?2:caps.constrained?3:4);i++){const p=document.createElement('span');p.className='weather-fx-storm-cloud';p.style.setProperty('--storm-cloud-y',`${(-7+i*8+seededUnit(i,131)*5).toFixed(1)}vh`);p.style.setProperty('--storm-cloud-delay',`${(-seededUnit(i,132)*35).toFixed(1)}s`);p.style.setProperty('--storm-cloud-duration',`${(30+seededUnit(i,133)*35).toFixed(1)}s`);p.style.setProperty('--storm-cloud-alpha',String(profile.key==='severe-storm'?.54:.40));p.style.setProperty('--storm-cloud-drift',`${(wind.direction*(18+seededUnit(i,134)*22)).toFixed(1)}vw`);frag.appendChild(p);}}
  if(source.weatherStormRainSheets!==false&&source.weatherRainEnabled!==false&&source.weatherEffectPrecipitation!==false){const sheets=caps.piClass?1:(profile.key==='severe-storm'?3:2);for(let i=0;i<sheets;i++){const p=document.createElement('span');p.className='weather-fx-rain-sheet';p.style.setProperty('--sheet-delay',`${(-seededUnit(i,136)*13).toFixed(1)}s`);p.style.setProperty('--sheet-duration',`${(4.5+seededUnit(i,137)*4).toFixed(1)}s`);p.style.setProperty('--sheet-angle',`${(wind.direction*(12+wind.strength*5)).toFixed(1)}deg`);p.style.setProperty('--sheet-alpha',String(profile.key==='severe-storm'?.22:.14));frag.appendChild(p);}}
}
function appendHeavySnowAtmosphere(frag,condition,source,data,wind,profile){if(condition!=='snow'||profile.key!=='heavy-snow'||source.weatherSnowBlowing===false)return;const caps=performanceApi.frontendCapabilities(),constrained=caps.constrained,clouds=caps.piClass?2:constrained?3:6;for(let i=0;i<clouds;i++){const c=document.createElement('span');c.className='weather-fx-heavy-snow-cloud';c.style.setProperty('--heavy-snow-cloud-x',`${(-12+i*(constrained?38:22)+seededUnit(i,160)*10).toFixed(1)}vw`);c.style.setProperty('--heavy-snow-cloud-y',`${(-5+seededUnit(i,161)*17).toFixed(1)}vh`);c.style.setProperty('--heavy-snow-cloud-w',`${(31+seededUnit(i,162)*25).toFixed(1)}vw`);c.style.setProperty('--heavy-snow-cloud-alpha',`${(.42+seededUnit(i,163)*.26).toFixed(2)}`);c.style.setProperty('--heavy-snow-cloud-delay',`${(-seededUnit(i,164)*22).toFixed(1)}s`);frag.appendChild(c);}const groups=caps.piClass?1:constrained?2:3,flakes=caps.piClass?5:constrained?6:11;for(let i=0;i<groups;i++){const p=document.createElement('span');p.className='weather-fx-blowing-snow';p.style.setProperty('--snow-veil-y',`${(12+i*(constrained?36:27)+seededUnit(i,140)*8).toFixed(1)}vh`);p.style.setProperty('--snow-veil-delay',`${(-seededUnit(i,141)*14).toFixed(1)}s`);p.style.setProperty('--snow-veil-duration',`${(10+seededUnit(i,142)*8).toFixed(1)}s`);p.style.setProperty('--snow-veil-drift',`${(wind.direction*(28+wind.strength*13)).toFixed(1)}vw`);p.style.setProperty('--snow-veil-alpha',String((.12+seededUnit(i,143)*.11).toFixed(2)));for(let j=0;j<flakes;j++){const f=document.createElement('i'),n=i*17+j;f.style.setProperty('--snow-gust-x',`${(seededUnit(n,144)*100).toFixed(1)}%`);f.style.setProperty('--snow-gust-y',`${(seededUnit(n,145)*100).toFixed(1)}%`);f.style.setProperty('--snow-gust-size',`${(.18+seededUnit(n,146)*.42).toFixed(2)}rem`);f.style.setProperty('--snow-gust-delay',`${(-seededUnit(n,147)*5).toFixed(1)}s`);f.style.setProperty('--snow-gust-bob',`${(-1.4+seededUnit(n,148)*2.8).toFixed(1)}vh`);p.appendChild(f);}frag.appendChild(p);}}
function appendWeatherParticles(frag,condition,count,source,data,wind){
  const baseSpeed=wxClamp(source.weatherEffectSpeed,40,180,100)/100,particleScale=wxClamp(source.weatherEffectParticleScale,60,160,100)/100,rain=condition==='rain'||condition==='storm',snow=condition==='snow',fog=condition==='fog',cloud=condition==='cloud',profile=weatherPhenomenonProfile(condition,data);
  const familySpeed=(rain?wxClamp(source.weatherRainSpeed,35,200,100)/100:snow?wxClamp(source.weatherSnowSpeed,30,180,100)/100:fog?wxClamp(source.weatherFogSpeed,20,150,80)/100:cloud?wxClamp(source.weatherCloudSpeed,20,200,100)/100:wxClamp(source.weatherSunRaySpeed,20,200,100)/100)*(profile.speed||1);
  for(let i=0;i<count;i++){const p=document.createElement('span'),rawDepth=seededUnit(i,7),depthTune=(rain?wxClamp(source.weatherRainDepth,0,180,100):snow?wxClamp(source.weatherSnowDepth,0,180,100):100)/100,depth=wxClamp(.68+(rawDepth-.5)*.92*depthTune,.18,1,.68),conditionScale=(rain?wxClamp(source.weatherRainSize,30,180,100):snow?wxClamp(source.weatherSnowSize,40,180,100):cloud?wxClamp(source.weatherCloudScale,40,180,100):100)/100*(profile.size||1);p.className='weather-fx-particle weather-fx-primary';p.style.setProperty('--fx-x',`${(seededUnit(i,1)*106-3).toFixed(2)}vw`);p.style.setProperty('--fx-y',`${(seededUnit(i,6)*20-14).toFixed(2)}vh`);p.style.setProperty('--fx-static-y',`${(seededUnit(i,8)*108-4).toFixed(2)}vh`);p.style.setProperty('--fx-delay',`${(-seededUnit(i,2)*16/(baseSpeed*familySpeed)).toFixed(2)}s`);const drift=wind.strength?(wind.direction*(.5+seededUnit(i,3))*(6+18*depth)*wind.strength):0;p.style.setProperty('--fx-drift',`${drift.toFixed(1)}vw`);p.style.setProperty('--fx-depth',depth.toFixed(2));p.style.setProperty('--fx-scale',((.52+seededUnit(i,5)*1.08)*particleScale*conditionScale*(.80+depth*.36)).toFixed(2));
    if(rain){const opacity=wxClamp(source.weatherRainOpacity,0,100,100)/100*(profile.alpha||1);p.style.setProperty('--fx-alpha',wxClamp((.42+depth*.54)*opacity,.04,1,.8).toFixed(2));p.style.setProperty('--fx-duration',`${((.58+seededUnit(i,4)*.82)/(baseSpeed*familySpeed*(.8+depth*.4))).toFixed(2)}s`);p.style.setProperty('--fx-width',`${((.7+depth*1.6)*wxClamp(source.weatherRainWidth,30,200,100)/100*(profile.width||1)).toFixed(2)}px`);p.style.setProperty('--fx-length',`${((4.8+depth*6.8)*wxClamp(source.weatherRainSize,30,180,100)/100*(profile.size||1)).toFixed(2)}vh`);p.style.setProperty('--fx-angle',`${(wind.direction*(6+wind.strength*7)*wxClamp(source.weatherRainAngle,0,200,100)/100*(profile.angle||1)).toFixed(1)}deg`);p.style.setProperty('--rain-glow-alpha',String(wxClamp(source.weatherRainGlow,0,180,100)/100));}
    else if(snow){const opacity=wxClamp(source.weatherSnowOpacity,0,100,100)/100*(profile.alpha||1),snowDrift=wxClamp(source.weatherSnowDrift,0,180,100)/100*(profile.drift||1);p.style.setProperty('--fx-alpha',wxClamp((.42+depth*.54)*opacity,.04,1,.85).toFixed(2));p.style.setProperty('--fx-drift',`${(drift*snowDrift).toFixed(1)}vw`);p.style.setProperty('--fx-duration',`${((4.8+seededUnit(i,4)*7.4)/(baseSpeed*familySpeed*(.78+depth*.34))).toFixed(2)}s`);p.style.setProperty('--fx-blur',`${((1-depth)*1.2).toFixed(2)}px`);p.style.setProperty('--snow-spin',`${Math.round(300*wxClamp(source.weatherSnowSpin,0,200,100)/100)}deg`);}
    else{const opacity=fog?wxClamp(source.weatherFogOpacity,0,100,100)/100:cloud?wxClamp(source.weatherCloudOpacity,0,100,100)/100:wxClamp(source.weatherSunGlow,0,180,100)/100;p.style.setProperty('--fx-alpha',wxClamp((.32+depth*.42)*opacity,.04,1,.5).toFixed(2));p.style.setProperty('--fx-duration',`${((12+seededUnit(i,4)*18)/(baseSpeed*familySpeed*Math.max(.45,.78+wind.strength*.18))).toFixed(2)}s`);if(fog){p.style.setProperty('--fx-blur',`${(5*wxClamp(source.weatherFogBlur,20,200,100)/100).toFixed(1)}px`);p.style.setProperty('--fog-layer-height',`${(7*wxClamp(source.weatherFogLayerHeight,40,200,100)/100).toFixed(1)}vh`);}}
    frag.appendChild(p);
  }
  if(rain&&count>8&&source.weatherEffectPrecipitation!==false){const splashBudget=performanceApi.visualPerformanceBudget(),splashCount=Math.min(46,Math.max(0,Math.round(count*.16*wxClamp(source.weatherRainSplash,0,180,70)/100*(profile.splash||1)*(performanceApi.frontendCapabilities().constrained?splashBudget.secondaryScale:1))));for(let i=0;i<splashCount;i++){const p=document.createElement('span');p.className='weather-fx-splash';p.style.setProperty('--fx-x',`${(seededUnit(i,51)*100).toFixed(2)}vw`);p.style.setProperty('--fx-delay',`${(-seededUnit(i,52)*4/baseSpeed).toFixed(2)}s`);p.style.setProperty('--fx-duration',`${(.65+seededUnit(i,53)*.8).toFixed(2)}s`);p.style.setProperty('--fx-scale',((.6+seededUnit(i,54)*1.2)*wxClamp(source.weatherRainSplashSize,30,200,100)/100).toFixed(2));frag.appendChild(p);}}
  appendCloudAtmosphere(frag,condition,source,data,wind);if(fog)appendFogBanks(frag,source,data,wind);appendStormAtmosphere(frag,condition,source,data,wind,profile);appendHeavySnowAtmosphere(frag,condition,source,data,wind,profile);
}
function buildParticles(host,condition,count,source,data,season,seasonalCounts=null,world=null){
  currentBirdSceneSpecies=[];currentOwlSceneSpecies=[];wildlifeSceneSerial=(wildlifeSceneSerial+1)%100000;
  const wind=weatherWindProfile(data,source),frag=document.createDocumentFragment(),caps=performanceApi.frontendCapabilities(),budget=performanceApi.visualPerformanceBudget(),constrained=caps.constrained,ecosystem=world||weatherWorldState(data,source),safeCounts=weatherWorldAdjustedCounts(seasonalCounts||{},ecosystem),canvasMode=canvasApi.piCanvasSupported(source),domCounts={...safeCounts};if(canvasMode){let detailed=Math.max(0,Number(budget.maxDetailedFlyingWildlife)||1),owlReserve=source.weatherSeasonOwls===true&&Number(safeCounts.owls)>0?1:0,birdReserve=Number(safeCounts.birds)>0?1:0;domCounts.birds=Math.min(Number(safeCounts.birds)||0,Math.max(birdReserve,detailed-owlReserve));detailed=Math.max(0,detailed-domCounts.birds);domCounts.owls=Math.min(Number(safeCounts.owls)||0,Math.max(owlReserve,detailed));}appendWeatherParticles(frag,condition,count,source,data,wind);appendSeasonalParticles(frag,season,source,data,wind,domCounts);sceneryApi.appendDogCompanion(frag,source,safeCounts,weatherReducedMotionActive(source),ecosystem.dogKeys);sceneryApi.appendHolidayOverlays(frag,source,data,constrained,ecosystem);appendHazardScenery(frag,source,wind,constrained);
  if(condition==='storm'&&source.weatherEffectLightning!==false&&source.weatherLightningStreaks!==false){const boltBudget=performanceApi.visualPerformanceBudget(),boltCap=performanceApi.frontendCapabilities().piClass?2:5,bolts=Math.max(0,Math.min(boltCap,Math.round(2*wxClamp(source.weatherLightningBolts,0,180,100)/100*(performanceApi.frontendCapabilities().constrained?Math.max(.55,boltBudget.secondaryScale):1))));for(let i=0;i<bolts;i++){const bolt=document.createElement('span');bolt.className='weather-fx-lightning-bolt';bolt.style.setProperty('--bolt-x',`${12+seededUnit(i,71)*76}vw`);bolt.style.setProperty('--bolt-delay',`${(-seededUnit(i,72)*18).toFixed(2)}s`);bolt.style.setProperty('--bolt-scale',((.7+seededUnit(i,73)*.75)*wxClamp(source.weatherLightningSize,30,200,100)/100).toFixed(2));frag.appendChild(bolt);}}
  const temp=Number(data?.current?.temperature_2m),frost=source.weatherColdFrost!==false&&Number.isFinite(temp)&&temp<=-8&&season==='winter';if(frost){const edge=document.createElement('span');edge.className='weather-fx-edge-frost';const fw=wxClamp(source.weatherColdFrostWidth,30,200,100)/100;edge.style.setProperty('--frost-alpha',String(wxClamp(source.weatherColdFrostIntensity,0,180,55)/100*wxClamp(source.weatherColdFrostOpacity,0,100,100)/100*wxClamp((-temp-5)/20,.15,1,1)));edge.style.setProperty('--frost-inner',`${(58-13*fw).toFixed(1)}%`);edge.style.setProperty('--frost-outer',`${(84-10*fw).toFixed(1)}%`);edge.style.setProperty('--frost-shadow-a',`${(38*fw).toFixed(1)}px`);edge.style.setProperty('--frost-shadow-b',`${(90*fw).toFixed(1)}px`);frag.appendChild(edge);}if(canvasMode)for(const selector of canvasApi.piCanvasDomSelectors())for(const node of frag.querySelectorAll(selector))node.remove();host.replaceChildren(frag);if(canvasMode)canvasApi.updatePiCanvasScene(host,{condition,count,source,data,season,seasonalCounts:safeCounts,wind});else canvasApi.stopPiCanvasScene();const precip=['rain','snow','storm'].includes(condition)&&count>0;precipitationHealth={signature:precip?`${condition}|${count}`:'',sample:-1,progressAt:Date.now(),builtAt:Date.now()};
}
function weatherTestData(data=configApi.wxData){
  const profile=WEATHER_TEST_PROFILES[weatherTestProfile];if(!profile)return data;
  const base=data&&typeof data==='object'?data:{};return {...base,latitude:Number(base.latitude??configApi.cfg?.lat),longitude:Number(base.longitude??configApi.cfg?.lon),current:{...(base.current||{}),...profile,time:new Date().toISOString().slice(0,19)}};
}
function weatherEffectTestState(){return {active:weatherTestProfile!=='live',profile:weatherTestProfile,label:WEATHER_TEST_PROFILES[weatherTestProfile]?.label||'Live weather'};}
function weatherHazardTestState(){return {active:weatherHazardTestProfile!=='live',profile:weatherHazardTestProfile,label:WEATHER_HAZARD_TEST_PROFILES[weatherHazardTestProfile]?.event||'Live alerts'};}
function setWeatherHazardTestProfile(name='live'){weatherHazardTestProfile=WEATHER_HAZARD_TEST_PROFILES[name]?name:'live';lastSignature='';const select=document.getElementById('s-weather-hazard-test');if(select)select.value=weatherHazardTestProfile;applyWeatherEffects(configApi.wxData);return weatherHazardTestState();}
function weatherHazardTestProfileChanged(control){setWeatherHazardTestProfile(control?.value||'live');}
function stopWeatherHazardTest(){setWeatherHazardTestProfile('live');}
function previewWeatherHazardTestFullScreen(){const select=document.getElementById('s-weather-hazard-test');if((select?.value||'live')==='live'){if(select)select.value='storm';}const master=document.getElementById('s-weather-animations'),full=document.getElementById('s-weather-fullscreen-effects'),hazards=document.getElementById('s-weather-hazard-effects');if(master)master.checked=true;if(full)full.checked=true;if(hazards)hazards.checked=true;setWeatherHazardTestProfile(select?.value||'storm');if(typeof globalThis.previewAppearance==='function')globalThis.previewAppearance();applyWeatherEffects(configApi.wxData,window.__uiPreviewCfg||null);if(typeof globalThis.previewDashboardFromSettings==='function')globalThis.previewDashboardFromSettings();}
function setWeatherEffectTestProfile(name='live'){
  weatherTestProfile=WEATHER_TEST_PROFILES[name]?name:'live';lastSignature='';
  const enabled=document.getElementById('s-weather-effect-test-mode'),select=document.getElementById('s-weather-effect-test-condition');if(enabled)enabled.checked=weatherTestProfile!=='live';if(select&&weatherTestProfile!=='live')select.value=weatherTestProfile;
  applyWeatherEffects(configApi.wxData);return weatherEffectTestState();
}
function handleWeatherEffectTestModeChange(control){const select=document.getElementById('s-weather-effect-test-condition');setWeatherEffectTestProfile(control?.checked?(select?.value||'rain'):'live');}
function weatherEffectTestProfileChanged(control){const enabled=document.getElementById('s-weather-effect-test-mode');if(enabled?.checked)setWeatherEffectTestProfile(control?.value||'rain');}
function stopWeatherEffectTest(){setWeatherEffectTestProfile('live');}
function previewWeatherTestFullScreen(){const enabled=document.getElementById('s-weather-effect-test-mode'),select=document.getElementById('s-weather-effect-test-condition');if(enabled)enabled.checked=true;setWeatherEffectTestProfile(select?.value||'rain');if(typeof globalThis.previewAppearance==='function')globalThis.previewAppearance();applyWeatherEffects(configApi.wxData,window.__uiPreviewCfg||null);}

function weatherEffectRuntimeState(data=configApi.wxData,source=null){
  source=weatherEffectSource(source);data=weatherTestData(data);const hazards=source.weatherHazardEffects===false?[]:weatherHazardAlerts(source),hazardOn=hazards.length>0;if(hazardOn&&!data?.current)data={...(data||{}),latitude:Number(source.lat),longitude:Number(source.lon),current:{weather_code:3,precipitation:0,cloud_cover:92,wind_speed_10m:24,wind_direction_10m:240,is_day:1,time:new Date().toISOString().slice(0,19)}};
  const condition=weatherEffectCondition(data?.current?.weather_code),widgetPauseReason=effectPauseReason(source),pauseReason=fullscreenPauseReason(source),allowed=effectAllowed(condition,source),effectiveIntensity=weatherEffectIntensityForData(condition,data,source),reducedMotion=weatherReducedMotionActive(source),seasonContext=weatherSeasonContextForData(data,source),season=seasonContext.season,world=weatherWorldState(data,source,hazards);
  const dogOn=source.weatherDogCompanion===true,seasonalOn=(source.weatherSeasonalEffects!==false&&seasonalParticleCount(season,source,performanceApi.frontendCapabilities().constrained,data,world)>0)||dogOn,holidayOn=sceneryApi.holidayOverlayActive(source,data);
  return {source,data,condition,season,seasonContext,world,pauseReason,widgetPauseReason,paused:!!pauseReason,allowed,seasonalOn,holidayOn,effectiveIntensity,reducedMotion,testProfile:weatherTestProfile,widgetOn:!!source.weatherAnimationsEnabled&&!!source.weatherWidgetAnimations&&!widgetPauseReason,fullOn:!!source.weatherAnimationsEnabled&&!pauseReason&&((!!source.weatherFullscreenEffects&&(allowed||hazardOn||seasonalOn))||holidayOn)};
}
function weatherWildlifeStatusText(data,source,context,condition){
  if(source.weatherSeasonalEffects===false)return '';const counts=seasonalEffectCounts(context.season,source,performanceApi.frontendCapabilities().constrained,data),parts=[['bees','bee'],['butterflies','butterfly'],['fireflies','firefly'],['dragonflies','dragonfly'],['ladybugs','ladybug'],['moths','moth'],['birds','bird'],['owls','owl']].filter(([k])=>counts[k]>0).map(([k,label])=>`${counts[k]} ${label}${counts[k]===1?'':'s'}`);if(parts.length)return ` · wildlife: ${parts.join(', ')}`;
  const profile=weatherWildlifeProfile(data,source,context,condition);if(profile.weatherReason)return ` · wildlife sheltered (${profile.weatherReason})`;return profile.isDay?' · wildlife quiet for current season / temperature':' · wildlife in nighttime cycle';
}
function weatherEffectStatusText(state,data=configApi.wxData){
  data=state.data||weatherTestData(data);const label={storm:'Thunderstorm',snow:'Snow',rain:'Rain',fog:'Fog',partly:'Partly cloudy',cloud:'Clouds',clear:'Clear sky',none:'Unknown weather'}[state.condition]||'Weather',seasonLabel={spring:'Spring',summer:'Summer',fall:'Autumn / Fall',winter:'Winter',none:'No temperate seasonal accent'}[state.season],test=state.testProfile!=='live'?`TEST: ${WEATHER_TEST_PROFILES[state.testProfile]?.label||label} · `:'',ctx=state.seasonContext||weatherSeasonContextForData(data,state.source),region=ctx.hemisphere==='south'?'Southern Hemisphere':ctx.hemisphere==='north'?'Northern Hemisphere':'location unavailable',band=String(ctx.climateBand||'').replace('-', ' ');
  if(!data?.current)return 'Waiting for current weather data.';
  if(!state.source.weatherAnimationsEnabled)return `${test}${label} detected · weather animations are off.`;
  const ecology=weatherEcologyRegion(data,state.source,ctx).replace('-', ' '),ecologySuffix=state.source.weatherSeasonalEffects===false?'':` · wildlife region: ${ecology}`;
  if(!state.source.weatherFullscreenEffects&&!state.holidayOn)return `${test}${label} detected · full-screen overlay is off.`;
  if(state.pauseReason==='display-dimmed')return `${test}${label} detected · overlay paused while display protection is dimmed.`;
  if(state.pauseReason==='layout-preview')return `${test}${label} detected · overlay paused during layout editing.`;
  if(!state.allowed&&!state.seasonalOn&&weatherHazardAlerts(state.source).length===0)return `${test}${label} detected · current overlay mode/effect switches exclude this condition.`;
  const hazardText=weatherHazardAlerts(state.source).map(h=>h.key.replace('heat-fire','heat/fire')).join(', '),hazardSuffix=hazardText?` · alert scenery: ${hazardText}`:'',worldSuffix=state.world?` · ecosystem: ${state.world.mode}${state.world.surface!=='normal'?` / ${state.world.surface}`:''}`:'';
  const seasonalSuffix=(state.source.weatherSeasonalEffects===false?'':ctx.automatic&&['equatorial','tropical'].includes(ctx.climateBand)?` · ${region} · ${band} latitude — temperate seasonal accents suppressed`:state.season!=='none'?` · ${seasonLabel} accents · ${region}${band?` · ${band}`:''}`:'')+ecologySuffix,suffix=seasonalSuffix+weatherWildlifeStatusText(data,state.source,ctx,state.condition)+hazardSuffix+worldSuffix;
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
  host.className='';host.classList.toggle('weather-fx-no-precip',source.weatherEffectPrecipitation===false);host.classList.toggle('weather-fx-no-clouds',source.weatherEffectClouds===false);host.classList.toggle('weather-fx-no-fog',source.weatherEffectFog===false);host.classList.toggle('weather-fx-no-sun',source.weatherEffectSun===false);host.classList.toggle('weather-fx-no-wind',source.weatherEffectWind===false);host.classList.toggle('weather-fx-no-lightning',source.weatherEffectLightning===false);for(const cls of weatherWorldClassList(state.world))host.classList.add(cls);host.dataset.worldMode=state.world?.mode||'normal';host.dataset.worldSurface=state.world?.surface||'normal';
  const wind=weatherWindProfile(data,source),phenomenon=weatherPhenomenonProfile(condition,data),lightningSeconds={rare:16,normal:10,frequent:6}[source.weatherEffectLightningFrequency]||10;host.classList.toggle('weather-fx-wind-reverse',wind.direction<0);host.classList.toggle('weather-fx-static',state.reducedMotion);host.classList.toggle('weather-fx-pi-static',performanceApi.frontendCapabilities().pi3Class&&performanceApi.visualPerformanceBudget().motionAllowed===false);host.classList.add('weather-severity-'+phenomenon.key);if(season!=='none')host.classList.add('weather-season-'+season);if(state.seasonContext?.climateBand)host.classList.add('weather-region-'+state.seasonContext.climateBand);
  host.style.setProperty('--weather-fx-opacity',String(wxClamp(source.weatherEffectOpacity,5,80,34)/100));host.style.setProperty('--weather-fx-speed',String(wxClamp(source.weatherEffectSpeed,40,180,100)/100));host.style.setProperty('--weather-fx-atmosphere',String(wxClamp(source.weatherEffectAtmosphere,0,100,55)/100));host.style.setProperty('--weather-fx-lightning-alpha',String(wxClamp(source.weatherEffectLightningBrightness,20,100,65)/100));host.style.setProperty('--weather-fx-lightning-flash',String(wxClamp(source.weatherLightningFlash,0,180,100)/100));host.style.setProperty('--weather-fx-lightning-duration',`${lightningSeconds}s`);host.style.setProperty('--weather-fog-opacity',String(wxClamp(source.weatherFogOpacity,0,100,100)/100));host.style.setProperty('--weather-cloud-opacity',String(wxClamp(source.weatherCloudOpacity,0,100,100)/100));host.style.setProperty('--weather-sun-glow',String(wxClamp(source.weatherSunGlow,0,180,100)/100));host.style.setProperty('--weather-season-intensity',String(wxClamp(source.weatherSeasonalIntensity,0,100,45)/100));host.style.setProperty('--weather-fog-strength',String(wxClamp(source.weatherFogDensity,0,180,115)/100));
  updateWeatherEffectStatus(state,data);if(!fullOn){lastSignature='';sceneryApi.stopDogRuntime();canvasApi.stopPiCanvasScene();host.replaceChildren();return;}
  host.classList.add('show','weather-fx-'+condition);const count=Math.max(0,Math.round(particleCount(condition,state.effectiveIntensity,constrained,source)*(phenomenon.density||1))),seasonalCounts=seasonalEffectCounts(season,source,constrained,data,state.world),seasonCount=Object.values(seasonalCounts).reduce((a,b)=>a+b,0),wildlifeSignature=['bees','butterflies','fireflies','dragonflies','ladybugs','moths','birds','owls'].map(k=>seasonalCounts[k]||0).join(',');
  const hazardSignature=weatherHazardAlerts(source).map(h=>`${h.key}:${h.rank}`).join(','),holidayKeys=sceneryApi.activeHolidayKeys(data,source),holidaySignature=holidayKeys.join(',')+'|'+sceneryApi.holidayOverlayTestState().profile;for(const h of weatherHazardAlerts(source))host.classList.add('weather-hazard-'+h.key);for(const h of holidayKeys)host.classList.add('holiday-active-'+h);host.style.setProperty('--weather-hazard-strength',String(wxClamp(source.weatherHazardIntensity,20,100,70)/100));
  const signature=[condition,season,state.world?.signature,state.seasonContext?.hemisphere,state.seasonContext?.climateBand,Math.round((state.seasonContext?.scale||0)*100),weatherIsDay(data)?'day':'night',count,seasonCount,wildlifeSignature,source.weatherEffectSpeed,source.weatherEffectOpacity,source.weatherEffectAtmosphere,source.weatherEffectParticleScale,source.weatherEffectWindStrength,source.weatherEffectAutoIntensity,source.weatherEffectPrecipitation,source.weatherEffectClouds,source.weatherEffectFog,source.weatherEffectSun,source.weatherEffectWind,source.weatherEffectLightning,source.weatherEffectLightningFrequency,source.weatherEffectLightningBrightness,source.weatherFogRollingBanks,source.weatherStormCloudDeck,source.weatherStormRainSheets,source.weatherLightningStreaks,source.weatherSnowBlowing,phenomenon.key,source.weatherSeasonLeaves,source.weatherSeasonGrass,source.weatherSeasonPetals,source.weatherSeasonCrystals,source.weatherSeasonBees,source.weatherSeasonButterflies,source.weatherSeasonFireflies,source.weatherSeasonDragonflies,source.weatherSeasonLadybugs,source.weatherSeasonMoths,source.weatherSeasonBirds,source.weatherBirdHabitat,source.weatherDogCompanion,source.weatherDogBreed,source.weatherDogVariant,source.weatherDogLabradorCoat,source.weatherDogAccessory,source.weatherDogAccessoryColor,source.weatherDogCollar,source.holidayOverlaysEnabled,source.holidayOverlayIntensity,source.holidayOverlayNewYear,source.holidayOverlayValentines,source.holidayOverlayStPatrick,source.holidayOverlayEaster,source.holidayOverlayMemorial,source.holidayOverlayJuneteenth,source.holidayOverlayIndependence,source.holidayOverlayLabor,source.holidayOverlayHalloween,source.holidayOverlayDayOfDead,source.holidayOverlayVeterans,source.holidayOverlayThanksgiving,source.holidayOverlayHanukkah,source.holidayOverlayChristmas,holidaySignature,source.weatherSeasonOwls,source.weatherColdFrost,source.weatherColdFrostIntensity,source.weatherSeasonalEffects,source.weatherSeasonMode,source.weatherSeasonalIntensity,source.weatherHazardEffects,source.weatherHazardIntensity,source.weatherHazardOpacity,source.weatherHazardSpeed,source.weatherHazardMinSeverity,source.weatherHazardFlood,source.weatherHazardFloodLevel,source.weatherHazardFloodDebris,source.weatherHazardFloodSpeed,source.weatherHazardWind,source.weatherHazardWindGusts,source.weatherHazardWindSpeed,source.weatherHazardTornado,source.weatherHazardTornadoSize,source.weatherHazardTornadoOpacity,source.weatherHazardTropical,source.weatherHazardTropicalBands,source.weatherHazardTropicalSurge,source.weatherHazardStorm,source.weatherHazardStormCloud,source.weatherHazardStormGust,source.weatherHazardWinter,source.weatherHazardWinterWhiteout,source.weatherHazardWinterDrift,source.weatherHazardVisibility,source.weatherHazardVisibilityOpacity,source.weatherHazardHeatFire,source.weatherHazardHeatShimmer,weatherHazardTestProfile,hazardSignature,...EFFECT_TUNING_KEYS.map(k=>source[k]),wind.direction,Math.round(wind.strength*100),state.testProfile,constrained].join('|');
  if(signature!==lastSignature){buildParticles(host,condition,count,source,data,season,seasonalCounts,state.world);lastSignature=signature;}host.classList.toggle('weather-fx-lightning',condition==='storm'&&source.weatherEffectLightning!==false);
}
function refreshWeatherEffects(){applyWeatherEffects(configApi.wxData);}
function precipitationAnimationHealthy(host,state){if(!['rain','snow','storm'].includes(state.condition)||state.reducedMotion||document.hidden)return true;if(canvasApi.piCanvasSupported(state.source))return canvasApi.piCanvasHealth().healthy;const particle=host.querySelector('.weather-fx-primary');if(!particle)return false;const now=Date.now(),animation=typeof particle.getAnimations==='function'?particle.getAnimations()[0]:null;if(animation){const sample=Number(animation.currentTime);if(Number.isFinite(sample)&&(precipitationHealth.sample<0||Math.abs(sample-precipitationHealth.sample)>2)){precipitationHealth.sample=sample;precipitationHealth.progressAt=now;}}return now-precipitationHealth.progressAt<12000&&now-precipitationHealth.builtAt<360000;}
function weatherOverlayNeedsRepair(data=configApi.wxData,source=null){const host=document.getElementById('weather-effects-overlay');if(!host)return false;const state=weatherEffectRuntimeState(data,source);if(!state.fullOn)return false;const expectedClass='weather-fx-'+state.condition,constrained=performanceApi.frontendCapabilities().constrained,seasonal=seasonalEffectCounts(state.season,state.source,constrained,state.data,state.world),seasonalCount=Object.values(seasonal).reduce((a,b)=>a+b,0),count=particleCount(state.condition,state.effectiveIntensity,constrained,state.source)+seasonalCount;return !host.classList.contains('show')||!host.classList.contains(expectedClass)||(count>0&&host.children.length===0)||!precipitationAnimationHealthy(host,state);}
function ensureWeatherOverlayLive(data=configApi.wxData,source=null){if(!weatherOverlayNeedsRepair(data,source))return false;lastSignature='';applyWeatherEffects(data,source);return true;}
function weatherPauseClassSignature(value=document.body.className){const names=new Set(String(value||'').split(/\s+/).filter(Boolean));return ['ld-burnin-dim','layout-editing','remote-layout-proxy'].map(name=>names.has(name)?'1':'0').join('');}
document.getElementById('weather-effects-overlay')?.addEventListener('animationiteration',event=>{if(event.target?.classList?.contains('weather-fx-primary'))precipitationHealth.progressAt=Date.now();});
const observer=new MutationObserver(records=>{if(!configApi.wxData&&weatherTestProfile==='live')return;const current=weatherPauseClassSignature();if(records.some(record=>weatherPauseClassSignature(record.oldValue)!==current))refreshWeatherEffects();});
observer.observe(document.body,{attributes:true,attributeFilter:['class'],attributeOldValue:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshWeatherEffects();ensureWeatherOverlayLive();}});setInterval(()=>ensureWeatherOverlayLive(),performanceApi.frontendCapabilities().piClass?5000:2500);

sceneryApi.registerHolidayRefresh(()=>{lastSignature='';applyWeatherEffects(configApi.wxData,window.__uiPreviewCfg||null);});
window.addEventListener('libredisplay:performancechange',()=>{lastSignature='';applyWeatherEffects(configApi.wxData);});
LibreDisplayRuntime.exposeModule('weatherEffects',{WEATHER_TEST_PROFILES,weatherVisualCondition,weatherEffectCondition,weatherEffectSource,effectAllowed,weatherGlyphEnabled,syncWeatherGlyphVisibility,liveIntensityMultiplier,weatherEffectIntensityForData,weatherPhenomenonProfile,particleCount,DOG_BREEDS,appendDogCompanion,weatherHazardAlerts,weatherReducedMotionActive,fullscreenPauseReason,effectPauseReason,weatherIconMarkup,decorateWeatherIcon,weatherWindProfile,weatherSeasonContextForData,weatherSeasonForData,weatherIsDay,weatherEcologyRegion,birdSpeciesPool,birdSpeciesForIndex,owlSpeciesPool,owlSpeciesForIndex,owlBehavior,butterflySpeciesPool,butterflySpeciesForIndex,birdMorphology,weatherWildlifeWeatherFactors,visibleWildlifeCount,weatherWildlifeProfile,weatherWorldState,weatherWorldAdjustedCounts,weatherWorldClassList,seasonalEffectCounts,seasonalParticleCount,weatherTestData,weatherEffectTestState,weatherHazardTestState,setWeatherHazardTestProfile,weatherHazardTestProfileChanged,stopWeatherHazardTest,previewWeatherHazardTestFullScreen,setWeatherEffectTestProfile,handleWeatherEffectTestModeChange,weatherEffectTestProfileChanged,stopWeatherEffectTest,previewWeatherTestFullScreen,weatherEffectRuntimeState,weatherWildlifeStatusText,weatherEffectStatusText,applyWeatherEffects,refreshWeatherEffects,precipitationAnimationHealthy,weatherOverlayNeedsRepair,ensureWeatherOverlayLive,weatherPauseClassSignature},{},{globalFunctions:['handleWeatherEffectTestModeChange','weatherEffectTestProfileChanged','stopWeatherEffectTest','previewWeatherTestFullScreen','weatherHazardTestProfileChanged','stopWeatherHazardTest','previewWeatherHazardTestFullScreen'],globalStates:[]});
}
// End source section: /js/weather/effects.js

// LibreDisplay source section: /js/weather/alerts.js
{
// Weather-alert runtime, rendering, and motion controls.
const configApi=LibreDisplayRuntime.getModule('config');

const {fetchRemoteText,esc}=LibreDisplayRuntime.getModule('shared');

const TEST_ALERT_TEMPLATES=[
  ['Tornado Warning','Extreme','A tornado warning is in effect for the test area. Take shelter in a sturdy interior room away from windows.'],
  ['Severe Thunderstorm Warning','Severe','Severe thunderstorms capable of damaging winds and large hail are moving through the test area.'],
  ['Flash Flood Warning','Severe','Flash flooding is possible in low-lying and poor-drainage areas. Avoid flooded roads.'],
  ['Winter Storm Warning','Severe','Heavy snow and hazardous travel conditions are expected in the test area.'],
  ['Heat Advisory','Moderate','Hot temperatures and high humidity may increase the risk of heat-related illness.'],
  ['Wind Advisory','Moderate','Strong gusty winds may blow around unsecured objects and make travel difficult.'],
  ['Dense Fog Advisory','Moderate','Visibility may fall below one quarter mile in dense fog. Use low-beam headlights.'],
  ['Flood Advisory','Moderate','Minor flooding of streets, creeks, and low-lying areas is possible.'],
  ['Air Quality Alert','Minor','Air quality may reach unhealthy levels for sensitive groups during the test period.'],
  ['Special Weather Statement','Minor','Brief hazardous weather is possible. Monitor conditions and be prepared to act if needed.'],
  ['Freeze Warning','Severe','Sub-freezing temperatures may damage sensitive vegetation and outdoor plumbing.'],
  ['Red Flag Warning','Severe','Critical fire-weather conditions are possible due to dry air and strong winds.']
];

function previewAlertSize(value){
  const pct=Math.min(33,Math.max(25,Number(value)||29));
  document.documentElement.style.setProperty('--alert-card-height',pct+'%');
  const out=document.getElementById('s-alert-size-value');
  if(out)out.textContent=pct+'%';
  requestAnimationFrame(()=>restartAlertScroller());
}

function savedAlertRuntimeState(){
  return {
    enabled:!!cfg.alertsEnabled,
    testMode:!!cfg.alertTestMode,
    mode:cfg.alertMotionMode||'continuous',
    speed:Math.min(120,Math.max(4,Number(cfg.alertMotionPx)||36)),
    delay:Math.min(60,Math.max(3,Number(cfg.alertScrollSec)||8))
  };
}

function settingsOverlayOpen(){
  const setup=document.getElementById('setup');
  return !!setup&&!setup.classList.contains('hidden');
}

function effectiveAlertRuntimeState(){
  // Form-preview state is valid only while Settings is visible or the explicit
  // full-screen preview is active. The normal dashboard always follows saved cfg.
  if(settingsOverlayOpen()||LibreDisplayRuntime.getModule('settings').settingsPreviewMode)return configApi.alertRuntimeState||savedAlertRuntimeState();
  return savedAlertRuntimeState();
}

function syncAlertRuntimeStateFromForm(){
  const enabledEl=document.getElementById('s-alerts-enabled');
  const testEl=document.getElementById('s-alert-test');
  const modeEl=document.getElementById('s-alert-motion');
  const speedEl=document.getElementById('s-alert-motion-speed');
  const delayEl=document.getElementById('s-alert-scroll');
  configApi.alertRuntimeState={
    enabled:enabledEl?!!enabledEl.checked:!!cfg.alertsEnabled,
    testMode:testEl?!!testEl.checked:!!cfg.alertTestMode,
    mode:modeEl?.value||cfg.alertMotionMode||'continuous',
    speed:Math.min(120,Math.max(4,Number(speedEl?.value??cfg.alertMotionPx)||36)),
    delay:Math.min(60,Math.max(3,Number(delayEl?.value??cfg.alertScrollSec)||8))
  };
  return configApi.alertRuntimeState;
}

function currentAlertMotionSpeed(){
  return effectiveAlertRuntimeState().speed;
}

function previewAlertMotionSpeed(value){
  const speed=Math.min(120,Math.max(4,Number(value)||36));
  const out=document.getElementById('s-alert-motion-speed-value');
  if(out)out.textContent=speed+' px/s';
  if(configApi.alertRuntimeState)configApi.alertRuntimeState.speed=speed;
}

function handleAlertMotionChange(){
  syncAlertRuntimeStateFromForm();
  restartAlertScroller();
}

function previewAlertTestFullScreen(){
  const test=document.getElementById('s-alert-test');
  if(test&&!test.checked)test.checked=true;
  previewDashboardFromSettings();
}

function ensureAlertMotionRunning(){
  if(!configApi.activeWeatherAlerts.length)return;
  const state=effectiveAlertRuntimeState();
  if(state.mode==='static'){stopAlertScroller();return;}
  if(state.mode==='continuous'){if(!configApi.alertScrollRaf)restartAlertScroller();return;}
  if(!configApi.alertScrollTimer)restartAlertScroller();
}

function setAlertStatus(text,error=false){
  configApi.lastAlertStatus={text:String(text||''),error:!!error,updatedAt:Date.now()};
  const el=document.getElementById('alert-status');
  if(!el)return;
  if(!configApi.lastAlertStatus.text){el.style.display='none';el.textContent='';return;}
  el.style.display='block';
  el.style.color=error?'#fca5a5':'rgba(255,255,255,0.42)';
  el.textContent=configApi.lastAlertStatus.text;
}

function formatAlertTime(iso){
  if(!iso)return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return '';
  let h=d.getHours(),m=String(d.getMinutes()).padStart(2,'0');
  const ap=h>=12?'PM':'AM';h=h%12||12;
  return `${h}:${m} ${ap}`;
}

function randomTestAlerts(count=10){
  const pool=[...TEST_ALERT_TEMPLATES];
  for(let i=pool.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  const now=Date.now();
  return pool.slice(0,Math.min(10,count)).map((x,i)=>({
    id:'test-'+now+'-'+i,
    event:'TEST — '+x[0],
    severity:x[1],
    headline:`Simulated ${x[0]} for ${cfg.locName||cfg.city||'the configured location'}`,
    description:x[2],
    areaDesc:cfg.locName||cfg.city||'Test area',
    senderName:'Dashboard Weather Alert Test Mode',
    expires:new Date(now+(45+i*23)*60000).toISOString(),
    test:true
  }));
}

function normalizeNwsAlerts(data){
  const rank={Extreme:0,Severe:1,Moderate:2,Minor:3,Unknown:4};
  return (Array.isArray(data?.features)?data.features:[]).map((feature,i)=>{
    const p=feature?.properties||{};
    return {
      id:feature?.id||p.id||'nws-'+i,
      event:p.event||'Weather Alert',
      severity:p.severity||'Unknown',
      headline:p.headline||'',
      description:p.description||'',
      areaDesc:p.areaDesc||'',
      senderName:p.senderName||'National Weather Service',
      expires:p.ends||p.expires||'',
      test:false
    };
  }).filter(a=>{
    if(cfg.alertMinSeverity==='all')return true;
    const maxRank={minor:3,moderate:2,severe:1,extreme:0}[cfg.alertMinSeverity];
    return (rank[a.severity]??4)<=maxRank;
  }).sort((a,b)=>(rank[a.severity]??4)-(rank[b.severity]??4)).slice(0,10);
}

function alertCardHtml(a){
  const sev=String(a.severity||'Unknown').toLowerCase();
  const safeSev=['extreme','severe','moderate','minor'].includes(sev)?sev:'severe';
  const main=a.headline&&a.headline!==a.event?a.headline:(a.description||a.event||'Weather alert');
  const meta=[a.areaDesc,a.senderName].filter(Boolean).join(' · ');
  const expires=formatAlertTime(a.expires);
  return `<section class="alert-card severity-${safeSev}" data-alert-id="${esc(a.id||'')}">
    <div class="alert-icon">!</div>
    <div class="alert-content">
      <div class="alert-head"><div class="alert-title">${esc(a.event||'Weather Alert')}</div><div class="alert-expiry">${expires?'Until '+esc(expires):''}</div></div>
      <div class="alert-text">${esc(main)}</div>
      <div class="alert-meta">${esc(meta)}</div>
    </div>
  </section>`;
}

function stopAlertScroller(){
  if(configApi.alertScrollTimer){clearInterval(configApi.alertScrollTimer);configApi.alertScrollTimer=null;}
  if(configApi.alertScrollRaf){cancelAnimationFrame(configApi.alertScrollRaf);configApi.alertScrollRaf=null;}
  configApi.alertScrollIndex=0; configApi.alertLoopHeight=0; configApi.alertLastFrame=0;
  const track=document.getElementById('alert-track');
  if(track){
    track.querySelectorAll('.alert-clone').forEach(el=>el.remove());
    track.style.transform='';
    track.style.willChange='';
  }
  const viewport=document.getElementById('alert-viewport');
  if(viewport){viewport.style.scrollBehavior='auto';viewport.scrollTop=0;}
}

function getAlertScrollPositions(){
  const viewport=document.getElementById('alert-viewport');
  const cards=[...document.querySelectorAll('#alert-track .alert-card:not(.alert-clone)')];
  if(!viewport||cards.length<2)return [0];
  const maxScroll=Math.max(0,viewport.scrollHeight-viewport.clientHeight);
  const positions=[];
  for(const card of cards){
    const pos=Math.min(maxScroll,card.offsetTop);
    if(!positions.length||Math.abs(pos-positions[positions.length-1])>2)positions.push(pos);
    if(pos>=maxScroll-2)break;
  }
  return positions.length?positions:[0];
}

function startContinuousAlertScroll(){
  const viewport=document.getElementById('alert-viewport');
  const track=document.getElementById('alert-track');
  if(!viewport||!track)return;
  const originals=[...track.querySelectorAll('.alert-card:not(.alert-clone)')];
  if(!originals.length||track.scrollHeight<=viewport.clientHeight+2)return;
  let firstClone=null;
  for(const card of originals){
    const clone=card.cloneNode(true);
    clone.classList.add('alert-clone');
    clone.setAttribute('aria-hidden','true');
    track.appendChild(clone);
    if(!firstClone)firstClone=clone;
  }
  configApi.alertLoopHeight=firstClone?firstClone.offsetTop-originals[0].offsetTop:0;
  if(configApi.alertLoopHeight<=0){
    track.querySelectorAll('.alert-clone').forEach(el=>el.remove());
    return;
  }
  viewport.style.scrollBehavior='auto';
  viewport.scrollTop=0;
  track.style.willChange='transform';
  track.style.transform='translate3d(0,0,0)';
  let scrollPos=0,lastPaint=-Infinity;
  const frameInterval=Math.max(28,Number(performanceApi.visualPerformanceBudget()?.targetFrameMs)||33);
  const frame=ts=>{
    if(!configApi.alertScrollRaf)return;
    if(!configApi.alertLastFrame)configApi.alertLastFrame=ts;
    const dt=Math.min(80,ts-configApi.alertLastFrame);
    configApi.alertLastFrame=ts;
    scrollPos+=currentAlertMotionSpeed()*dt/1000;
    while(scrollPos>=configApi.alertLoopHeight)scrollPos-=configApi.alertLoopHeight;
    if(ts-lastPaint>=frameInterval){lastPaint=ts;track.style.transform=`translate3d(0,${-scrollPos}px,0)`;}
    configApi.alertScrollRaf=requestAnimationFrame(frame);
  };
  configApi.alertScrollRaf=requestAnimationFrame(frame);
}

function restartAlertScroller(){
  stopAlertScroller();
  const viewport=document.getElementById('alert-viewport');
  const track=document.getElementById('alert-track');
  if(!viewport||!track)return;
  requestAnimationFrame(()=>{
    const state=effectiveAlertRuntimeState();
    if(track.scrollHeight<=viewport.clientHeight+2||state.mode==='static'||document.documentElement.classList.contains('ld-reduce-motion'))return;
    if(state.mode==='continuous'){
      startContinuousAlertScroll();
      return;
    }
    viewport.style.scrollBehavior='smooth';
    const positions=getAlertScrollPositions();
    if(positions.length<=1)return;
    configApi.alertScrollTimer=setInterval(()=>{
      configApi.alertScrollIndex=(configApi.alertScrollIndex+1)%positions.length;
      viewport.scrollTo({top:positions[configApi.alertScrollIndex],behavior:'smooth'});
    },Math.max(3,state.delay||8)*1000);
  });
}

function renderWeatherAlerts(alerts){
  configApi.activeWeatherAlerts=(Array.isArray(alerts)?alerts:[]).slice(0,10);
  try{LibreDisplayRuntime.getModule('weatherEffects').refreshWeatherEffects();}catch(_e){}
  setTimeout(updateSettingsOverview,0);
  const zone=document.getElementById('alert-zone');
  const track=document.getElementById('alert-track');
  if(!zone||!track)return;
  stopAlertScroller();
  if(!configApi.activeWeatherAlerts.length){
    track.innerHTML='';
    zone.classList.remove('show');
    return;
  }
  track.innerHTML=configApi.activeWeatherAlerts.map(alertCardHtml).join('');
  zone.classList.add('show');
  restartAlertScroller();
}

function currentAlertFormState(){
  const state=effectiveAlertRuntimeState();
  return {enabled:state.enabled,testMode:state.testMode};
}

function handleAlertTestModeChange(){
  syncAlertRuntimeStateFromForm();
  configApi.alertFetchSerial++;
  const state=currentAlertFormState();
  if(!state.testMode&&configApi.activeWeatherAlerts.some(a=>a?.test))renderWeatherAlerts([]);
  fetchWeatherAlerts();
}

function handleAlertsEnabledChange(){
  syncAlertRuntimeStateFromForm();
  configApi.alertFetchSerial++;
  const state=currentAlertFormState();
  if(!state.enabled){
    renderWeatherAlerts([]);
    setAlertStatus('Weather alerts are disabled.');
    return;
  }
  fetchWeatherAlerts();
}

async function fetchWeatherAlerts(forceTest=false){
  const requestId=++configApi.alertFetchSerial;
  const state=currentAlertFormState();
  if(!state.enabled&&!forceTest){
    renderWeatherAlerts([]);
    setAlertStatus('Weather alerts are disabled.');
    return;
  }
  if(forceTest||state.testMode){
    const alerts=randomTestAlerts(10);
    if(requestId!==configApi.alertFetchSerial)return;
    renderWeatherAlerts(alerts);
    setAlertStatus('Test mode: showing 10 simulated weather alerts.');
    return;
  }
  if(configApi.activeWeatherAlerts.some(a=>a?.test))renderWeatherAlerts([]);
  if(!cfg.lat||!cfg.lon){
    renderWeatherAlerts([]);
    setAlertStatus('Weather alerts need a saved location.',true);
    return;
  }
  setAlertStatus('Loading real weather alerts…');
  try{
    const url=`https://api.weather.gov/alerts/active?point=${encodeURIComponent(cfg.lat+','+cfg.lon)}`;
    const text=await fetchRemoteText(url,(cfg.alertRefreshMin||5)*60);
    if(requestId!==configApi.alertFetchSerial)return;
    const data=JSON.parse(text);
    const alerts=normalizeNwsAlerts(data);
    if(requestId!==configApi.alertFetchSerial)return;
    renderWeatherAlerts(alerts);
    setAlertStatus(alerts.length?`${alerts.length} active weather alert${alerts.length===1?'':'s'} loaded.`:'No active weather alerts for this location.');
  }catch(e){
    if(requestId!==configApi.alertFetchSerial)return;
    renderWeatherAlerts([]);
    setAlertStatus('Weather alert fetch failed: '+String(e?.message||e),true);
    console.warn('weather alert error',e);
  }
}


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("weather", {previewAlertSize,savedAlertRuntimeState,settingsOverlayOpen,effectiveAlertRuntimeState,syncAlertRuntimeStateFromForm,currentAlertMotionSpeed,previewAlertMotionSpeed,handleAlertMotionChange,previewAlertTestFullScreen,ensureAlertMotionRunning,setAlertStatus,formatAlertTime,randomTestAlerts,normalizeNwsAlerts,alertCardHtml,stopAlertScroller,getAlertScrollPositions,startContinuousAlertScroll,restartAlertScroller,renderWeatherAlerts,currentAlertFormState,handleAlertTestModeChange,handleAlertsEnabledChange,fetchWeatherAlerts}, {
  "TEST_ALERT_TEMPLATES": {configurable:true,get:()=>TEST_ALERT_TEMPLATES}
}, {globalFunctions:['previewAlertSize','previewAlertMotionSpeed','handleAlertMotionChange','previewAlertTestFullScreen','handleAlertTestModeChange','handleAlertsEnabledChange'],globalStates:[]});
}
// End source section: /js/weather/alerts.js
