// Calendar fetching, status, rendering, and auto-scroll runtime.
const configApi=LibreDisplayRuntime.getModule('config');

const {serverPath}=LibreDisplayRuntime.getModule('bootstrap');
const {uiCfg,fetchRemoteText,esc}=LibreDisplayRuntime.getModule('shared');
const integrationsApi=LibreDisplayRuntime.getModule('integrations');
const weatherApi=LibreDisplayRuntime.getModule('weather');
const {fmtTime,parseICS,normalizeCalendarUrl,expandCalendarFeed}=LibreDisplayRuntime.getModule('calendar');

let calStatuses=[];

function updateCalStatusUI(){
  const el=document.getElementById('cal-status');
  if(!el)return;
  if(!calStatuses.length){el.style.display='none';el.textContent='';return;}
  el.style.display='block';
  el.innerHTML=calStatuses.map(s=>{
    const name=esc(s.label||'Calendar');
    if(s.disabled)return `${name}: disabled`;
    if(s.pending)return `${name}: checking…`;
    if(s.ok){
      const extras=[];
      if(s.recurring)extras.push(`${s.recurring} recurring`);
      if(s.overrides)extras.push(`${s.overrides} exception${s.overrides===1?'':'s'}`);
      if(s.multiDay)extras.push(`${s.multiDay} multi-day`);
      if(s.timezones)extras.push(`${s.timezones} timezone${s.timezones===1?'':'s'}`);
      const detail=extras.length?' · '+extras.join(' · '):'';
      const warning=s.warning?` <span style="color:#fde68a">· ${esc(s.warning)}</span>`:'';
      return `${name}: loaded ${s.upcoming} upcoming event${s.upcoming===1?'':'s'} (${s.raw} VEVENT${s.raw===1?'':'s'}${detail})${warning}`;
    }
    return `${name}: <span style="color:#fca5a5">${esc(s.error||'could not load')}</span>`;
  }).join('<br>');
}

async function fetchCal(cal,calIdx,{preferFormUrl=false}={}){
  const label=cal?.label||`Calendar ${calIdx+1}`;
  const url=normalizeCalendarUrl(cal?.url||'');
  try{
    if(!cal?.id&&!url)throw new Error('No calendar source configured');
    let text;
    if(preferFormUrl&&url){
      text=await fetchRemoteText(url,(cfg.calendarRefreshMin||15)*60);
    }else if(cal?.id){
      const target=serverPath('/api/calendar-source?id='+encodeURIComponent(cal.id));
      const res=await fetch(target,{cache:'no-store'});
      LibreDisplayRuntime.getModule('remote').noteCacheResponse('calendar:'+cal.id,res);
      if(!res.ok){const msg=await res.text().catch(()=>res.statusText);throw new Error('Calendar source HTTP '+res.status+(msg?' — '+msg:''));}
      text=await res.text();
    }else{
      text=await fetchRemoteText(url,(cfg.calendarRefreshMin||15)*60);
    }
    if(!/BEGIN:VCALENDAR/i.test(text)){
      if(/<html|<!doctype/i.test(text))throw new Error('The link returned a web page instead of an ICS calendar');
      throw new Error('The link did not return ICS calendar data');
    }
    const parsed=parseICS(text);
    const now=new Date();now.setHours(0,0,0,0);
    const customCalendarBlocks=(cfg.customBlocks||[]).filter(b=>b.type==='calendarview');
    const customHorizon=customCalendarBlocks.reduce((m,b)=>Math.max(m,Number(b.config?.days)||0),0);
    const days=Math.max(62,Number(uiCfg().calendarDays)||7,customHorizon);
    const cut=new Date(now);cut.setDate(cut.getDate()+days+1);
    let rangeStart=new Date(now);
    if(customCalendarBlocks.some(b=>['month','week'].includes(b.config?.mode))){rangeStart=new Date(now.getFullYear(),now.getMonth(),1);rangeStart.setDate(rangeStart.getDate()-7);}
    const expanded=expandCalendarFeed(parsed,rangeStart,cut,calIdx);
    const st=expanded.stats;
    const upcomingCount=expanded.events.filter(e=>(e.end||e.start)>=now).length;
    calStatuses[calIdx]={
      label,ok:true,raw:st.raw,upcoming:upcomingCount,
      recurring:st.recurring,overrides:st.overrides,multiDay:st.multiDay,
      timezones:st.timezones.size,warning:st.warnings.join('; '),checkedAt:Date.now()
    };
    updateCalStatusUI();
    return expanded.events;
  }catch(ex){
    calStatuses[calIdx]={label,ok:false,error:String(ex?.message||ex),checkedAt:Date.now()};
    updateCalStatusUI();
    console.warn('calendar error',label,ex);
    return [];
  }
}

async function loadCalendars(){
  if(!cfg.calendars||!cfg.calendars.length){calStatuses=[];updateCalStatusUI();renderCalendar([]);updateSettingsOverview();return;}
  const active=cfg.calendars.map((c,i)=>({c,i})).filter(x=>x.c.enabled!==false);
  if(!active.length){calStatuses=cfg.calendars.map(c=>({label:c.label,disabled:true}));updateCalStatusUI();renderCalendar([]);updateSettingsOverview();return;}
  calStatuses=cfg.calendars.map(c=>c.enabled===false?{label:c.label,disabled:true}:{label:c.label,pending:true});
  updateCalStatusUI();
  const results=await Promise.all(active.map(({c,i})=>fetchCal(c,i)));
  const all=results.flat().sort((a,b)=>a.start-b.start||a.title.localeCompare(b.title));
  renderCalendar(all);
  updateSettingsOverview();
}

function eventOverlapsDay(ev,day,dayEnd){
  const end=ev.end&&ev.end>ev.start?ev.end:new Date(ev.start.getTime()+1);
  return ev.start<dayEnd&&end>day;
}

function eventTimeForDay(ev,day){
  const ui=uiCfg();
  if(ev.allDay)return 'All day';
  if(ev.start<day)return ui.calendarShowContinuation===false?'': 'Continues';
  const start=fmtTime(ev.start).replace(':00','');
  if(ui.calendarTimeStyle==='range'&&ev.end instanceof Date&&ev.end>ev.start){
    const dayEnd=new Date(day);dayEnd.setDate(day.getDate()+1);
    const end=ev.end>dayEnd?'Later':fmtTime(ev.end).replace(':00','');
    return `${start} – ${end}`;
  }
  return start;
}

function renderCalendar(events){
  const ui=uiCfg();
  window.__lastCalendarEvents=Array.isArray(events)?events:[];
  const strip=document.getElementById('top-strip');
  strip.innerHTML='';
  const today=new Date();today.setHours(0,0,0,0);

  const calendarDays=Number(ui.calendarDays)||7;
  for(let i=0;i<calendarDays;i++){
    const day=new Date(today);day.setDate(today.getDate()+i);
    const dayEnd=new Date(day);dayEnd.setDate(day.getDate()+1);
    const dayEvts=events.filter(e=>eventOverlapsDay(e,day,dayEnd)).sort((a,b)=>{
      if(a.allDay!==b.allDay)return a.allDay?-1:1;
      const at=Math.max(a.start.getTime(),day.getTime()),bt=Math.max(b.start.getTime(),day.getTime());
      const ao=LibreDisplayRuntime.getModule('onboarding').calendarPriority(a.calIdx),bo=LibreDisplayRuntime.getModule('onboarding').calendarPriority(b.calIdx);
      return at-bt||ao-bo||a.title.localeCompare(b.title);
    }).slice(0,Math.min(6,Math.max(1,Number(ui.calendarMaxEvents)||4)));

    const col=document.createElement('div');
    col.className='day-col';
    let headHTML;
    if(i===0){
      headHTML=`<div class="day-heading"><span class="day-num">${day.getDate()}</span>&nbsp;<span class="day-label">Today</span></div>`;
    }else{
      const showMonth=(day.getDate()===1||i===calendarDays-1);
      const extra=showMonth?weatherApi.MN[day.getMonth()]+', ':'';
      headHTML=`<div class="day-heading"><span class="day-num">${day.getDate()}</span>&nbsp;<span class="day-label">${extra}${weatherApi.DN[day.getDay()]}</span></div>`;
    }

    let evtHTML='';
    if(dayEvts.length===0){
      evtHTML=ui.showNoEvents?'<div class="no-events">No events</div>':'';
    }else{
      evtHTML=dayEvts.map(ev=>{
        const feed=cfg.calendars?.[ev.calIdx]||{};
        const color=feed.color||integrationsApi.DEFAULT_CAL_COLORS[ev.calIdx%integrationsApi.DEFAULT_CAL_COLORS.length];
        const opacity=Math.min(100,Math.max(40,Number(feed.opacity)||100))/100;
        const timeStr=eventTimeForDay(ev,day);
        const showTimes=ui.calendarTimeStyle!=='none'&&ui.showEventTimes!==false;
        return `<div class="event-item" style="opacity:${opacity.toFixed(2)}">
          ${showTimes?`<div class="event-time"><span class="event-bar" style="background:${color}"></span>${timeStr}</div>`:''}
          <div class="event-title${showTimes?'':' event-title-no-time'}">${showTimes?'':`<span class="event-bar" style="background:${color}"></span>`}${esc(ev.title)}</div>
        </div>`;
      }).join('');
    }

    col.innerHTML=headHTML+'<div class="day-events">'+evtHTML+'</div>';
    strip.appendChild(col);
  }
  LibreDisplayRuntime.getModule('onboarding').renderCalendarLegend();
  startCalendarAutoScroll();
  refreshCustomDataBlocks(['calendarview']);
}

function stopCalendarAutoScroll(){
  if(configApi.calendarAutoScrollTimer){clearInterval(configApi.calendarAutoScrollTimer);configApi.calendarAutoScrollTimer=null;}
}

function startCalendarAutoScroll(){
  stopCalendarAutoScroll();
  const strip=document.getElementById('top-strip');
  if(!strip)return;
  strip.scrollTop=0;
  const ui=uiCfg();
  if(ui.calendarScrollMode!=='auto'||document.documentElement.classList.contains('ld-reduce-motion'))return;
  requestAnimationFrame(()=>{
    if(strip.scrollHeight<=strip.clientHeight+2)return;
    let dir=1,pauseUntil=Date.now()+1200;
    let last=Date.now();
    configApi.calendarAutoScrollTimer=setInterval(()=>{
      if(!document.body.contains(strip)){stopCalendarAutoScroll();return;}
      const now=Date.now();
      const dt=Math.min(.12,(now-last)/1000);last=now;
      if(now<pauseUntil)return;
      const max=Math.max(0,strip.scrollHeight-strip.clientHeight);
      if(max<=1)return;
      const speed=Math.min(60,Math.max(2,Number(uiCfg().calendarScrollSpeed)||12));
      strip.scrollTop+=dir*speed*dt;
      if(strip.scrollTop>=max-1){strip.scrollTop=max;dir=-1;pauseUntil=now+1500;}
      else if(strip.scrollTop<=1){strip.scrollTop=0;dir=1;pauseUntil=now+1500;}
    },50);
  });
}



// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("calendar", {updateCalStatusUI,fetchCal,loadCalendars,eventOverlapsDay,eventTimeForDay,renderCalendar,stopCalendarAutoScroll,startCalendarAutoScroll}, {
  "calStatuses": {configurable:true,get:()=>calStatuses,set:(value)=>{calStatuses=value;}}
}, {globalFunctions:[],globalStates:[]});
