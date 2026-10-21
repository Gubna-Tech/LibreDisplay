import time, datetime
from _shared import clamp_int
MANIFEST={"apiVersion":1,"id":"gtfs-realtime","name":"Transit · GTFS-Realtime","description":"Show upcoming arrivals from a public GTFS-Realtime Trip Updates feed.","version":"1.0","icon":"▤","refreshMin":1,"kind":"status","access":"no-key","freedomNote":"Designed for public GTFS-Realtime feeds; the authorization header is optional for agencies that require one.","settings":[{"key":"feedUrl","label":"GTFS-Realtime Trip Updates URL","type":"url","required":True},{"key":"stopId","label":"Stop ID","type":"text","required":True},{"key":"routeId","label":"Route ID filter","type":"text"},{"key":"authHeader","label":"Authorization header (optional)","type":"password"},{"key":"maxArrivals","label":"Maximum arrivals","type":"number","default":6},{"key":"label","label":"Display label","type":"text","default":"Transit"}]}
MANIFEST.update({'access': 'no-key', 'dataFlow': 'configured-endpoint', 'dataLeavesDevice': True, 'privacyNote': 'LibreDisplay requests the GTFS-Realtime feed URL you configure; public feeds need no key, while some agencies may require an optional auth header.', 'freedomAlternative': 'Already freedom-first when using a public feed; a self-hosted feed/proxy can keep control local.'})

_PRESENTATION_CACHE_FIELDS = {'label': {'responsePaths': ['title'], 'presentationOmitEmpty': False}}
for _field in MANIFEST.get("settings") or []:
    _meta = _PRESENTATION_CACHE_FIELDS.get(_field.get("key"))
    if _meta:
        _field.update({"cacheKey": False, **_meta})
def _varint(b,i):
 v=0; shift=0
 while i<len(b):
  x=b[i]; i+=1; v|=(x&127)<<shift
  if not x&128:return v,i
  shift+=7
  if shift>70: raise ValueError('Invalid protobuf varint')
 raise ValueError('Truncated protobuf')
def _fields(b):
 i=0
 while i<len(b):
  tag,i=_varint(b,i); n=tag>>3; wire=tag&7
  if wire==0: v,i=_varint(b,i); yield n,wire,v
  elif wire==1:
   if i+8>len(b): raise ValueError('Truncated protobuf fixed64 field')
   v=b[i:i+8]; i+=8; yield n,wire,v
  elif wire==2:
   ln,i=_varint(b,i)
   if ln<0 or i+ln>len(b): raise ValueError('Truncated protobuf length-delimited field')
   v=b[i:i+ln]; i+=ln; yield n,wire,v
  elif wire==5:
   if i+4>len(b): raise ValueError('Truncated protobuf fixed32 field')
   v=b[i:i+4]; i+=4; yield n,wire,v
  else: raise ValueError('Unsupported protobuf wire type')
def _text(v):
 try:return v.decode('utf-8')
 except UnicodeDecodeError:return ''
def _trip(desc):
 out={}
 for n,w,v in _fields(desc):
  if w==2 and n==1: out['tripId']=_text(v)
  elif w==2 and n==5: out['routeId']=_text(v)
 return out
def _event(msg):
 out={}
 for n,w,v in _fields(msg):
  if w==0 and n==1: out['delay']=v if v < (1<<63) else v-(1<<64)
  elif w==0 and n==2: out['time']=v
 return out
def _stu(msg):
 out={}
 for n,w,v in _fields(msg):
  if w==2 and n==2: out['arrival']=_event(v)
  elif w==2 and n==3: out['departure']=_event(v)
  elif w==2 and n==4: out['stopId']=_text(v)
 return out
def _update(msg):
 out={'stops':[]}
 for n,w,v in _fields(msg):
  if w==2 and n==1: out.update(_trip(v))
  elif w==2 and n==2: out['stops'].append(_stu(v))
 return out
def fetch(s,c):
 headers={'User-Agent':'LibreDisplay integration'}; auth=str(s.get('authHeader') or '').strip()
 if auth: headers['Authorization']=auth
 raw,_=c.fetch_bytes(s.get('feedUrl'),headers=headers,max_bytes=8*1024*1024); updates=[]
 for n,w,v in _fields(raw):
  if n!=2 or w!=2: continue
  for en,ew,ev in _fields(v):
   if en==3 and ew==2: updates.append(_update(ev))
 stop=str(s.get('stopId') or ''); route=str(s.get('routeId') or ''); now=int(time.time()); rows=[]
 for u in updates:
  if route and u.get('routeId')!=route: continue
  for st in u.get('stops') or []:
   if st.get('stopId')!=stop: continue
   ev=st.get('arrival') or st.get('departure') or {}; ts=int(ev.get('time') or 0)
   if not ts or ts<now-120: continue
   rows.append({'routeId':u.get('routeId') or '', 'tripId':u.get('tripId') or '', 'time':ts, 'minutes':max(0,round((ts-now)/60)), 'at':datetime.datetime.fromtimestamp(ts).strftime('%H:%M')})
 rows.sort(key=lambda x:x['time']); rows=rows[:clamp_int(s.get('maxArrivals'),1,20,6)]; first=rows[0] if rows else {}
 return {'kind':'status','provider':'GTFS-Realtime','title':str(s.get('label') or 'Transit'),'value':(str(first.get('minutes'))+' min') if first else 'No arrivals','details':[{'label':x.get('routeId') or 'Trip','value':f"{x.get('minutes')} min · {x.get('at')}"} for x in rows], 'arrivals':rows}
