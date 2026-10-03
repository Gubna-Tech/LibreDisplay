// ICS recurrence expansion and exception handling.

const {propsOf,firstProp,propValue,normalizeTZID,dateSpecFromProp,makeDateFromSpec,parseICSDate,parseICSDuration}=LibreDisplayRuntime.getModule('calendar');

function parseRRule(s){
  const out={};
  String(s||'').split(';').forEach(part=>{
    const i=part.indexOf('=');
    if(i>0)out[part.slice(0,i).toUpperCase()]=part.slice(i+1);
  });
  return out;
}

function localDayKey(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function occurrenceKey(d,allDay=false){
  if(!d)return '';
  return allDay?'D:'+localDayKey(d):'T:'+String(d.getTime());
}

function eventRevisionStamp(ev){
  const seq=parseInt(propValue(ev,'SEQUENCE','0'),10)||0;
  const stampProp=firstProp(ev,'LAST-MODIFIED')||firstProp(ev,'DTSTAMP');
  const stamp=stampProp?parseICSDate(stampProp.value,stampProp.params)?.getTime()||0:0;
  return {seq,stamp};
}

function dedupeEventRevisions(events){
  const map=new Map();
  const anonymous=[];
  events.forEach((ev,index)=>{
    const uid=propValue(ev,'UID','').trim();
    if(!uid){anonymous.push(ev);return;}
    const rid=firstProp(ev,'RECURRENCE-ID');
    const key=uid+'|'+(rid?rid.value+'|'+JSON.stringify(rid.params||{}):'MASTER');
    const old=map.get(key);
    if(!old){map.set(key,ev);return;}
    const a=eventRevisionStamp(old),b=eventRevisionStamp(ev);
    if(b.seq>a.seq||(b.seq===a.seq&&b.stamp>=a.stamp))map.set(key,ev);
  });
  return [...map.values(),...anonymous];
}

function monthDayMatches(day,daysInMonth,list){
  if(!list||!list.length)return true;
  return list.some(n=>n>0?day===n:day===daysInMonth+n+1);
}

function parseByDayList(value){
  const codes=['SU','MO','TU','WE','TH','FR','SA'];
  return String(value||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean).map(raw=>{
    const m=raw.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
    if(!m)return null;
    return {ordinal:m[1]?parseInt(m[1],10):null,dow:codes.indexOf(m[2]),code:m[2]};
  }).filter(Boolean);
}

function nthWeekdayOfMonth(year,month,dow,ordinal){
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  if(ordinal>0){
    const firstDow=new Date(Date.UTC(year,month,1)).getUTCDay();
    const day=1+((dow-firstDow+7)%7)+(ordinal-1)*7;
    return day<=daysInMonth?day:null;
  }
  const lastDow=new Date(Date.UTC(year,month,daysInMonth)).getUTCDay();
  const day=daysInMonth-((lastDow-dow+7)%7)+(ordinal+1)*7;
  return day>=1?day:null;
}

function applyBySetPos(candidates,value){
  const pos=String(value||'').split(',').map(Number).filter(Number.isFinite);
  if(!pos.length)return candidates;
  const sorted=[...candidates].sort((a,b)=>a-b),picked=[];
  for(const p of pos){
    const idx=p>0?p-1:sorted.length+p;
    if(sorted[idx]!==undefined)picked.push(sorted[idx]);
  }
  return [...new Set(picked)].sort((a,b)=>a-b);
}

function monthCandidateDays(year,month,rule,startDay){
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const byMonthDay=rule.BYMONTHDAY?rule.BYMONTHDAY.split(',').map(Number).filter(Number.isFinite):[];
  const byDay=parseByDayList(rule.BYDAY);
  let days=[];
  for(let d=1;d<=daysInMonth;d++){
    if(byMonthDay.length&&!monthDayMatches(d,daysInMonth,byMonthDay))continue;
    if(byDay.length){
      const dow=new Date(Date.UTC(year,month,d)).getUTCDay();
      const matches=byDay.some(spec=>{
        if(spec.dow!==dow)return false;
        if(spec.ordinal===null)return true;
        return nthWeekdayOfMonth(year,month,spec.dow,spec.ordinal)===d;
      });
      if(!matches)continue;
    }
    days.push(d);
  }
  if(!byMonthDay.length&&!byDay.length&&startDay<=daysInMonth)days=[startDay];
  if(rule.BYSETPOS)days=applyBySetPos(days,rule.BYSETPOS);
  return days;
}

function rruleWarnings(rule){
  const supported=new Set(['FREQ','INTERVAL','COUNT','UNTIL','BYDAY','BYMONTHDAY','BYMONTH','BYSETPOS','WKST']);
  return Object.keys(rule).filter(k=>!supported.has(k)).map(k=>'RRULE '+k+' is not fully supported');
}

function generateRuleStarts(ev,rangeEnd,defaultTz=''){
  const startProp=firstProp(ev,'DTSTART');
  if(!startProp)return {dates:[],warnings:[]};
  const spec=dateSpecFromProp(startProp,defaultTz);
  const start=spec?makeDateFromSpec(spec):parseICSDate(startProp.value,startProp.params,defaultTz);
  if(!start||!spec)return {dates:[],warnings:[]};
  const rule=parseRRule(propValue(ev,'RRULE',''));
  if(!rule.FREQ)return {dates:[start],warnings:[]};

  const warnings=rruleWarnings(rule);
  const freq=String(rule.FREQ||'').toUpperCase();
  const interval=Math.max(1,parseInt(rule.INTERVAL||'1',10)||1);
  const countLimit=rule.COUNT?Math.max(1,parseInt(rule.COUNT,10)||1):Infinity;
  const until=rule.UNTIL?parseICSDate(rule.UNTIL,startProp.params,defaultTz):null;
  const byMonths=rule.BYMONTH?new Set(rule.BYMONTH.split(',').map(Number).filter(n=>n>=1&&n<=12)):null;
  const byMonthDays=rule.BYMONTHDAY?rule.BYMONTHDAY.split(',').map(Number).filter(Number.isFinite):[];
  const byDays=parseByDayList(rule.BYDAY);
  const dates=[];
  let generated=0,guard=0;
  const accept=(year,month,day)=>{
    if(generated>=countLimit)return false;
    if(byMonths&&!byMonths.has(month+1))return true;
    const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
    if(byMonthDays.length&&!monthDayMatches(day,daysInMonth,byMonthDays))return true;
    const d=makeDateFromSpec(spec,year,month,day);
    if(!d||d<start)return true;
    if(until&&d>until)return false;
    if(d>=rangeEnd)return false;
    dates.push(d);generated++;
    return generated<countLimit;
  };

  if(freq==='DAILY'){
    const cursor=new Date(Date.UTC(spec.y,spec.mo,spec.d));
    while(guard++<200000){
      const y=cursor.getUTCFullYear(),m=cursor.getUTCMonth(),d=cursor.getUTCDate();
      const actual=makeDateFromSpec(spec,y,m,d);
      if((until&&actual>until)||actual>=rangeEnd||generated>=countLimit)break;
      const dow=cursor.getUTCDay();
      const byDayOk=!byDays.length||byDays.some(x=>x.ordinal===null&&x.dow===dow);
      if(byDayOk&&!accept(y,m,d))break;
      cursor.setUTCDate(cursor.getUTCDate()+interval);
    }
  }else if(freq==='WEEKLY'){
    const codes=['SU','MO','TU','WE','TH','FR','SA'];
    const wkstCode=String(rule.WKST||'MO').toUpperCase();
    const wkst=Math.max(0,codes.indexOf(wkstCode));
    const targetDays=(byDays.length?byDays.map(x=>x.dow):[new Date(Date.UTC(spec.y,spec.mo,spec.d)).getUTCDay()]);
    const startDay=new Date(Date.UTC(spec.y,spec.mo,spec.d));
    const startDow=startDay.getUTCDay();
    const week0=new Date(startDay);week0.setUTCDate(week0.getUTCDate()-((startDow-wkst+7)%7));
    for(let w=0;guard++<50000;w+=interval){
      const base=new Date(week0);base.setUTCDate(base.getUTCDate()+w*7);
      const weekCandidates=[];
      for(const dow of targetDays){
        const c=new Date(base);c.setUTCDate(c.getUTCDate()+((dow-wkst+7)%7));
        if(c<startDay)continue;
        weekCandidates.push(c);
      }
      weekCandidates.sort((a,b)=>a-b);
      let chosen=weekCandidates;
      if(rule.BYSETPOS){
        const indices=applyBySetPos(weekCandidates.map((_,i)=>i+1),rule.BYSETPOS).map(n=>n-1);
        chosen=indices.map(i=>weekCandidates[i]).filter(Boolean);
      }
      let stop=false;
      for(const c of chosen){
        const y=c.getUTCFullYear(),m=c.getUTCMonth(),d=c.getUTCDate();
        const actual=makeDateFromSpec(spec,y,m,d);
        if((until&&actual>until)||actual>=rangeEnd||generated>=countLimit){stop=true;break;}
        if(!accept(y,m,d)){stop=true;break;}
      }
      if(stop)break;
    }
  }else if(freq==='MONTHLY'){
    for(let monthIndex=0;guard++<10000;monthIndex+=interval){
      const absolute=spec.mo+monthIndex;
      const y=spec.y+Math.floor(absolute/12),m=((absolute%12)+12)%12;
      const firstActual=makeDateFromSpec(spec,y,m,1);
      if((until&&firstActual>until)||firstActual>=rangeEnd||generated>=countLimit)break;
      if(byMonths&&!byMonths.has(m+1))continue;
      const candidates=monthCandidateDays(y,m,rule,spec.d);
      let stop=false;
      for(const d of candidates){if(!accept(y,m,d)){stop=true;break;}}
      if(stop)break;
    }
  }else if(freq==='YEARLY'){
    for(let yearIndex=0;guard++<1000;yearIndex+=interval){
      const y=spec.y+yearIndex;
      const jan=makeDateFromSpec(spec,y,0,1);
      if((until&&jan>until)||jan>=rangeEnd||generated>=countLimit)break;
      const months=byMonths?[...byMonths].map(n=>n-1).sort((a,b)=>a-b):[spec.mo];
      let yearly=[];
      for(const m of months){
        const days=monthCandidateDays(y,m,rule,spec.d);
        for(const d of days)yearly.push({m,d});
      }
      yearly.sort((a,b)=>a.m-b.m||a.d-b.d);
      if(rule.BYSETPOS){
        const pos=String(rule.BYSETPOS).split(',').map(Number).filter(Number.isFinite),picked=[];
        for(const p of pos){const idx=p>0?p-1:yearly.length+p;if(yearly[idx])picked.push(yearly[idx]);}
        yearly=picked;
      }
      let stop=false;
      for(const c of yearly){if(!accept(y,c.m,c.d)){stop=true;break;}}
      if(stop)break;
    }
  }else{
    warnings.push('Unsupported recurrence frequency '+freq);
    dates.push(start);
  }
  if(guard>=200000)warnings.push('Recurrence expansion safety limit reached');
  return {dates,warnings};
}

function eventSpan(ev,defaultTz='',fallbackSpan=null){
  const startProp=firstProp(ev,'DTSTART');
  const startSpec=dateSpecFromProp(startProp,defaultTz);
  const start=startSpec?makeDateFromSpec(startSpec):null;
  if(!start)return fallbackSpan||{allDay:false,ms:0,days:0};
  const allDay=startSpec.isDate;
  const endProp=firstProp(ev,'DTEND');
  if(endProp){
    const end=parseICSDate(endProp.value,endProp.params,defaultTz);
    if(end){
      if(allDay){
        const a=Date.UTC(start.getFullYear(),start.getMonth(),start.getDate());
        const b=Date.UTC(end.getFullYear(),end.getMonth(),end.getDate());
        return {allDay:true,days:Math.max(1,Math.round((b-a)/864e5)),ms:0};
      }
      return {allDay:false,days:0,ms:Math.max(0,end-start)};
    }
  }
  const duration=parseICSDuration(propValue(ev,'DURATION',''));
  if(duration){
    if(allDay&&!duration.hasTime)return {allDay:true,days:Math.max(1,duration.days),ms:0};
    return {allDay,days:allDay?Math.max(1,Math.ceil(duration.ms/864e5)):0,ms:Math.max(0,duration.ms)};
  }
  if(fallbackSpan)return {...fallbackSpan};
  return allDay?{allDay:true,days:1,ms:0}:{allDay:false,days:0,ms:0};
}

function addEventSpan(start,span){
  if(!start)return null;
  if(span?.allDay){const end=new Date(start);end.setDate(end.getDate()+Math.max(1,span.days||1));return end;}
  return new Date(start.getTime()+Math.max(0,span?.ms||0));
}

function overlapsRange(start,end,rangeStart,rangeEnd){
  if(!start)return false;
  const effectiveEnd=end&&end>start?end:new Date(start.getTime()+1);
  return start<rangeEnd&&effectiveEnd>rangeStart;
}

function instanceFromEvent(ev,master,occurrenceStart,calIdx,defaultTz='',masterSpan=null){
  const status=String(propValue(ev,'STATUS',propValue(master,'STATUS',''))||'').toUpperCase();
  if(status==='CANCELLED')return null;
  const ownStart=ev!==master?firstProp(ev,'DTSTART'):null;
  const ownSpec=dateSpecFromProp(ownStart,defaultTz);
  const start=ownSpec?makeDateFromSpec(ownSpec):new Date(occurrenceStart);
  if(!start||Number.isNaN(start.getTime()))return null;
  const inheritedStartSpec=dateSpecFromProp(firstProp(master,'DTSTART'),defaultTz);
  const allDay=ownSpec?ownSpec.isDate:!!inheritedStartSpec?.isDate;
  const span=eventSpan(ev,defaultTz,masterSpan||eventSpan(master,defaultTz));
  span.allDay=allDay;
  const end=addEventSpan(start,span);
  const title=propValue(ev,'SUMMARY',propValue(master,'SUMMARY','(No title)'))||'(No title)';
  return {
    title,allDay,calIdx,start,end,
    uid:propValue(ev,'UID',propValue(master,'UID','')),
    location:propValue(ev,'LOCATION',propValue(master,'LOCATION','')),
    description:propValue(ev,'DESCRIPTION',propValue(master,'DESCRIPTION','')),
    isOverride:!!firstProp(ev,'RECURRENCE-ID'),
    recurring:!!propValue(master,'RRULE',''),
    recurrenceOriginal:new Date(occurrenceStart)
  };
}

function collectExceptionDates(ev,name,defaultTz='',allDay=false){
  const out=[];
  for(const p of propsOf(ev,name)){
    for(const raw of String(p.value||'').split(',')){
      const value=raw.trim();if(!value)continue;
      const first=value.split('/')[0];
      const d=parseICSDate(first,p.params,defaultTz);
      if(d)out.push({date:d,key:occurrenceKey(d,allDay),period:value.includes('/')});
    }
  }
  return out;
}

function recurrenceIdDate(ev,master,defaultTz=''){
  const p=firstProp(ev,'RECURRENCE-ID');
  if(!p)return null;
  const mp=firstProp(master,'DTSTART');
  const params={...(mp?.params||{}),...(p.params||{})};
  return parseICSDate(p.value,params,defaultTz);
}

function expandCalendarFeed(parsed,rangeStart,rangeEnd,calIdx){
  const defaultTz=normalizeTZID(parsed?.meta?.defaultTz||'');
  const events=dedupeEventRevisions(parsed?.events||[]);
  const groups=new Map();
  events.forEach((ev,index)=>{
    const uid=propValue(ev,'UID','').trim()||'__anonymous_'+index;
    if(!groups.has(uid))groups.set(uid,[]);
    groups.get(uid).push(ev);
  });
  const result=[];
  const stats={raw:(parsed?.events||[]).length,recurring:0,overrides:0,cancelled:0,multiDay:0,timezones:new Set(),warnings:[]};
  if(defaultTz)stats.timezones.add(defaultTz);

  for(const group of groups.values()){
    const master=group.find(ev=>!firstProp(ev,'RECURRENCE-ID'))||null;
    const overrides=group.filter(ev=>firstProp(ev,'RECURRENCE-ID'));
    stats.overrides+=overrides.length;
    stats.cancelled+=group.filter(ev=>String(propValue(ev,'STATUS','')).toUpperCase()==='CANCELLED').length;
    if(overrides.some(ev=>String(firstProp(ev,'RECURRENCE-ID')?.params?.RANGE||'').toUpperCase()==='THISANDFUTURE')){
      stats.warnings.push('RECURRENCE-ID RANGE=THISANDFUTURE is treated as a single-instance exception');
    }
    for(const ev of group){
      const tz=normalizeTZID(firstProp(ev,'DTSTART')?.params?.TZID||'');if(tz)stats.timezones.add(tz);
    }

    if(!master){
      for(const ev of overrides){
        if(String(propValue(ev,'STATUS','')).toUpperCase()==='CANCELLED')continue;
        const rid=recurrenceIdDate(ev,ev,defaultTz);
        const startProp=firstProp(ev,'DTSTART');
        const start=startProp?parseICSDate(startProp.value,startProp.params,defaultTz):rid;
        if(!start)continue;
        const inst=instanceFromEvent(ev,ev,start,calIdx,defaultTz,eventSpan(ev,defaultTz));
        if(inst&&overlapsRange(inst.start,inst.end,rangeStart,rangeEnd))result.push(inst);
      }
      continue;
    }

    const masterStartProp=firstProp(master,'DTSTART');
    const masterSpec=dateSpecFromProp(masterStartProp,defaultTz);
    const masterStart=masterSpec?makeDateFromSpec(masterSpec):null;
    if(!masterStart)continue;
    const masterAllDay=!!masterSpec.isDate;
    const masterSpan=eventSpan(master,defaultTz);
    if(propValue(master,'RRULE',''))stats.recurring++;
    if(String(propValue(master,'STATUS','')).toUpperCase()==='CANCELLED')continue;

    const generation=generateRuleStarts(master,rangeEnd,defaultTz);
    stats.warnings.push(...generation.warnings);
    const starts=[...generation.dates];
    const rdates=collectExceptionDates(master,'RDATE',defaultTz,masterAllDay);
    if(rdates.some(r=>r.period))stats.warnings.push('RDATE PERIOD end-times use the event duration');
    for(const r of rdates)starts.push(r.date);
    const exdates=new Set(collectExceptionDates(master,'EXDATE',defaultTz,masterAllDay).map(x=>x.key));
    const uniqueStarts=[...new Map(starts.map(d=>[occurrenceKey(d,masterAllDay),d])).values()].sort((a,b)=>a-b);

    const overrideMap=new Map();
    for(const ov of overrides){
      const rid=recurrenceIdDate(ov,master,defaultTz);
      if(rid)overrideMap.set(occurrenceKey(rid,masterAllDay),ov);
    }
    const consumed=new Set();

    for(const occurrence of uniqueStarts){
      const key=occurrenceKey(occurrence,masterAllDay);
      const ov=overrideMap.get(key);
      if(ov){
        consumed.add(key);
        if(String(propValue(ov,'STATUS','')).toUpperCase()==='CANCELLED')continue;
        const inst=instanceFromEvent(ov,master,occurrence,calIdx,defaultTz,masterSpan);
        if(inst&&overlapsRange(inst.start,inst.end,rangeStart,rangeEnd))result.push(inst);
        continue;
      }
      if(exdates.has(key))continue;
      const inst=instanceFromEvent(master,master,occurrence,calIdx,defaultTz,masterSpan);
      if(inst&&overlapsRange(inst.start,inst.end,rangeStart,rangeEnd))result.push(inst);
    }

    for(const ov of overrides){
      const rid=recurrenceIdDate(ov,master,defaultTz);
      const key=rid?occurrenceKey(rid,masterAllDay):'';
      if(key&&consumed.has(key))continue;
      if(String(propValue(ov,'STATUS','')).toUpperCase()==='CANCELLED')continue;
      const actualStartProp=firstProp(ov,'DTSTART');
      const actualStart=actualStartProp?parseICSDate(actualStartProp.value,actualStartProp.params,defaultTz):rid;
      if(!actualStart)continue;
      const inst=instanceFromEvent(ov,master,rid||actualStart,calIdx,defaultTz,masterSpan);
      if(inst&&overlapsRange(inst.start,inst.end,rangeStart,rangeEnd))result.push(inst);
    }
  }

  const seen=new Set();
  const deduped=result.filter(ev=>{
    const key=(ev.uid||ev.title)+'|'+ev.start.getTime()+'|'+(ev.end?.getTime()||0);
    if(seen.has(key))return false;seen.add(key);return true;
  }).sort((a,b)=>a.start-b.start||a.title.localeCompare(b.title));

  for(const ev of deduped){
    if(!ev.end)continue;
    if(ev.allDay){
      const a=Date.UTC(ev.start.getFullYear(),ev.start.getMonth(),ev.start.getDate());
      const b=Date.UTC(ev.end.getFullYear(),ev.end.getMonth(),ev.end.getDate());
      if(Math.round((b-a)/864e5)>1)stats.multiDay++;
    }else if(ev.end>ev.start&&localDayKey(ev.end)!==localDayKey(ev.start)){
      stats.multiDay++;
    }
  }
  stats.warnings=[...new Set(stats.warnings)].slice(0,6);
  return {events:deduped,stats};
}


LibreDisplayRuntime.exposeModule("calendar", {parseRRule,localDayKey,occurrenceKey,eventRevisionStamp,dedupeEventRevisions,monthDayMatches,parseByDayList,nthWeekdayOfMonth,applyBySetPos,monthCandidateDays,rruleWarnings,generateRuleStarts,eventSpan,addEventSpan,overlapsRange,instanceFromEvent,collectExceptionDates,recurrenceIdDate,expandCalendarFeed}, {}, {globals:false});
