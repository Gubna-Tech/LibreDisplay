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
