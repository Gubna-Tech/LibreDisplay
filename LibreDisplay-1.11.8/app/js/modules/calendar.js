// LibreDisplay source section: /js/calendar/ics-parser.js
{
// ICS lexical parsing, date normalization, and timezone helpers.

function fmtTime(iso){
  if(!iso) return '--';
  const d=new Date(iso);
  let h=d.getHours(), m=String(d.getMinutes()).padStart(2,'0');
  const ap=h>=12?'pm':'am'; h=h%12||12;
  return h+':'+m+ap;
}

function unescapeICSValue(v){
  return String(v||'')
    .replace(/\\n/gi,'\n')
    .replace(/\\,/g,',')
    .replace(/\\;/g,';')
    .replace(/\\\\/g,'\\');
}

function splitICSHead(head){
  const out=[];
  let cur='',quoted=false;
  for(const ch of String(head||'')){
    if(ch==='"')quoted=!quoted;
    if(ch===';'&&!quoted){out.push(cur);cur='';}
    else cur+=ch;
  }
  out.push(cur);
  return out;
}

function parseICSPropertyLine(line){
  const l=String(line||'');
  const ci=l.indexOf(':');
  if(ci<0)return null;
  const parts=splitICSHead(l.slice(0,ci));
  const name=String(parts.shift()||'').toUpperCase();
  if(!name)return null;
  const params={};
  for(const bit of parts){
    const eq=bit.indexOf('=');
    if(eq<=0)continue;
    const key=bit.slice(0,eq).toUpperCase();
    params[key]=bit.slice(eq+1).replace(/^"|"$/g,'');
  }
  return {name,value:unescapeICSValue(l.slice(ci+1)),params};
}

function parseICS(text){
  const events=[];
  const meta={defaultTz:'',method:'',productId:'',warnings:[]};
  const lines=String(text||'').replace(/\r?\n[ \t]/g,'').split(/\r\n|\n|\r/);
  let event=null;
  for(const raw of lines){
    const line=raw.trim();
    const upper=line.toUpperCase();
    if(upper==='BEGIN:VEVENT'){event={_props:{}};continue;}
    if(upper==='END:VEVENT'){
      if(event)events.push(event);
      event=null;
      continue;
    }
    const prop=parseICSPropertyLine(line);
    if(!prop)continue;
    if(!event){
      if(prop.name==='X-WR-TIMEZONE')meta.defaultTz=prop.value;
      else if(prop.name==='METHOD')meta.method=prop.value;
      else if(prop.name==='PRODID')meta.productId=prop.value;
      continue;
    }
    (event._props[prop.name]||(event._props[prop.name]=[])).push({value:prop.value,params:prop.params});
    if(event[prop.name]===undefined)event[prop.name]=prop.value;
    else if(prop.name==='EXDATE'||prop.name==='RDATE')event[prop.name]+=','+prop.value;
  }
  return {events,meta};
}

function propsOf(ev,name){return ev?._props?.[String(name).toUpperCase()]||[];}
function firstProp(ev,name){return propsOf(ev,name)[0]||null;}
function propValue(ev,name,fallback=''){const p=firstProp(ev,name);return p?p.value:fallback;}

const WINDOWS_TZ_TO_IANA={
  'UTC':'UTC','GMT Standard Time':'Europe/London','W. Europe Standard Time':'Europe/Berlin',
  'Central Europe Standard Time':'Europe/Budapest','Romance Standard Time':'Europe/Paris',
  'Eastern Standard Time':'America/New_York','Central Standard Time':'America/Chicago',
  'Mountain Standard Time':'America/Denver','Pacific Standard Time':'America/Los_Angeles',
  'Alaskan Standard Time':'America/Anchorage','Hawaiian Standard Time':'Pacific/Honolulu',
  'US Eastern Standard Time':'America/Indianapolis','Arizona Standard Time':'America/Phoenix',
  'Atlantic Standard Time':'America/Halifax','Newfoundland Standard Time':'America/St_Johns'
};

function normalizeTZID(tzid){
  let z=String(tzid||'').trim().replace(/^"|"$/g,'');
  if(!z)return '';
  if(WINDOWS_TZ_TO_IANA[z])return WINDOWS_TZ_TO_IANA[z];
  const iana=z.match(/(?:^|\/)((?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Za-z0-9_+\-\/]+)$/);
  if(iana)z=iana[1];
  try{new Intl.DateTimeFormat('en-US',{timeZone:z}).format(new Date());return z;}catch(_){return '';}
}

function rawDateParts(input){
  const s=String(input||'').trim();
  let m=s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(m)return {y:+m[1],mo:+m[2]-1,d:+m[3],h:0,mi:0,sc:0,isDate:true,isUTC:false};
  m=s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(?:\.\d+)?(Z)?$/i);
  if(!m)return null;
  return {y:+m[1],mo:+m[2]-1,d:+m[3],h:+m[4],mi:+m[5],sc:+(m[6]||0),isDate:false,isUTC:!!m[7]};
}

function dateFromZoneParts(y,mo,d,h,mi,sc,tzid){
  try{
    const zone=normalizeTZID(tzid)||tzid;
    let guess=Date.UTC(y,mo,d,h,mi,sc);
    const fmt=new Intl.DateTimeFormat('en-CA',{
      timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    });
    const target=Date.UTC(y,mo,d,h,mi,sc);
    for(let n=0;n<4;n++){
      const p={};
      for(const x of fmt.formatToParts(new Date(guess)))if(x.type!=='literal')p[x.type]=x.value;
      const shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
      const delta=target-shown;
      guess+=delta;
      if(Math.abs(delta)<1000)break;
    }
    return new Date(guess);
  }catch(_){return new Date(y,mo,d,h,mi,sc);}
}

function dateSpecFromProp(prop,defaultTz=''){
  if(!prop)return null;
  const raw=rawDateParts(prop.value);
  if(!raw)return null;
  const valueType=String(prop.params?.VALUE||'').toUpperCase();
  const isDate=valueType==='DATE'||raw.isDate;
  const tzid=raw.isUTC?'UTC':normalizeTZID(prop.params?.TZID||defaultTz);
  return {...raw,isDate,tzid};
}

function makeDateFromSpec(spec,y=spec?.y,mo=spec?.mo,d=spec?.d){
  if(!spec)return null;
  if(spec.isDate)return new Date(y,mo,d);
  if(spec.isUTC)return new Date(Date.UTC(y,mo,d,spec.h,spec.mi,spec.sc));
  if(spec.tzid)return dateFromZoneParts(y,mo,d,spec.h,spec.mi,spec.sc,spec.tzid);
  return new Date(y,mo,d,spec.h,spec.mi,spec.sc);
}

function parseICSDate(input,params={},defaultTz=''){
  if(!input)return null;
  const spec=dateSpecFromProp({value:String(input).trim(),params},defaultTz);
  if(spec)return makeDateFromSpec(spec);
  const fallback=new Date(String(input));
  return Number.isNaN(fallback.getTime())?null:fallback;
}

function parseICSDuration(value){
  const m=String(value||'').trim().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if(!m)return null;
  const sign=m[1]==='-'?-1:1;
  const weeks=+(m[2]||0),days=+(m[3]||0),hours=+(m[4]||0),minutes=+(m[5]||0),seconds=+(m[6]||0);
  const wholeDays=weeks*7+days;
  const ms=sign*((wholeDays*86400+hours*3600+minutes*60+seconds)*1000);
  return {ms,days:sign*wholeDays,hasTime:!!(hours||minutes||seconds)};
}

function normalizeCalendarUrl(url){
  let s=String(url||'').trim();
  s=s.replace(/\\&/g,'&').replace(/&amp;|&#38;|&#x26;/gi,'&').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/^<|>$/g,'').trim();
  return /^webcal:\/\//i.test(s)?'https://'+s.slice(s.indexOf('://')+3):s;
}


LibreDisplayRuntime.exposeModule("calendar", {fmtTime,unescapeICSValue,splitICSHead,parseICSPropertyLine,parseICS,propsOf,firstProp,propValue,normalizeTZID,rawDateParts,dateFromZoneParts,dateSpecFromProp,makeDateFromSpec,parseICSDate,parseICSDuration,normalizeCalendarUrl}, {
  "WINDOWS_TZ_TO_IANA": {configurable:true,get:()=>WINDOWS_TZ_TO_IANA}
}, {globals:false});
}
// End source section: /js/calendar/ics-parser.js

// LibreDisplay source section: /js/calendar/recurrence.js
{
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
}
// End source section: /js/calendar/recurrence.js

// LibreDisplay source section: /js/calendar/index.js
{
// Calendar fetching, status, rendering, and auto-scroll runtime.
const configApi=LibreDisplayRuntime.getModule('config');

const {serverPath}=LibreDisplayRuntime.getModule('bootstrap');
const {uiCfg,fetchRemoteText,resilientFetch,esc}=LibreDisplayRuntime.getModule('shared');
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
      const res=await resilientFetch(target,{cache:'no-store'},{timeoutMs:18000,attempts:2});
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



// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("calendar", {updateCalStatusUI,fetchCal,loadCalendars,eventOverlapsDay,eventTimeForDay,renderCalendar,stopCalendarAutoScroll,startCalendarAutoScroll}, {
  "calStatuses": {configurable:true,get:()=>calStatuses,set:(value)=>{calStatuses=value;}}
}, {globalFunctions:[],globalStates:[]});
}
// End source section: /js/calendar/index.js
