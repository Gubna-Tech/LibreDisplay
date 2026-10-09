from urllib.parse import quote
from _shared import bearer, request_json, clamp_int
MANIFEST={"apiVersion":1,"id":"box-photos","name":"Box Photos","description":"Rotate photos from a Box folder while keeping Box credentials on the LibreDisplay server.","version":"1.0","icon":"▣","refreshMin":15,"kind":"photos","settings":[{"key":"folderId","label":"Box folder ID","type":"text","default":"0","required":True},{"key":"accessToken","label":"Access token","type":"password"},{"key":"refreshToken","label":"Refresh token","type":"password"},{"key":"clientId","label":"Box client ID","type":"text"},{"key":"clientSecret","label":"Box client secret","type":"password"},{"key":"maxPhotos","label":"Maximum photos","type":"number","default":100},{"key":"intervalSec","label":"Rotation seconds","type":"number","default":30}]}
MANIFEST.update({'access': 'account', 'dataFlow': 'provider-cloud', 'dataLeavesDevice': True, 'privacyNote': 'LibreDisplay connects to the configured Box account and downloads selected folder metadata/photos over HTTPS.', 'freedomAlternative': 'Use Local / NAS media folders to keep photo storage under your own control.'})

_PRESENTATION_CACHE_FIELDS = {'intervalSec': {'responsePaths': ['intervalSec'], 'presentationOmitEmpty': False}}
for _field in MANIFEST.get("settings") or []:
    _meta = _PRESENTATION_CACHE_FIELDS.get(_field.get("key"))
    if _meta:
        _field.update({"cacheKey": False, **_meta})
def _token(s,c): return bearer(s,c,token_url='https://api.box.com/oauth2/token',form={'client_id':s.get('clientId'),'client_secret':s.get('clientSecret')},cache_prefix='box')
def fetch(s,c):
 token=_token(s,c); folder=quote(str(s.get('folderId') or '0'),safe=''); limit=clamp_int(s.get('maxPhotos'),1,500,100); rows=[]; offset=0
 while len(rows)<limit:
  url=f'https://api.box.com/2.0/folders/{folder}/items?limit=1000&offset={offset}&fields=id,name,type,extension,size'; data,_,_=request_json(c,url,headers={'Authorization':'Bearer '+token,'User-Agent':'LibreDisplay integration'}); entries=data.get('entries') or []
  for x in entries:
   if x.get('type')=='file' and str(x.get('name') or '').lower().endswith(('.jpg','.jpeg','.png','.webp','.gif','.avif','.bmp')): rows.append({'id':str(x.get('id')),'name':str(x.get('name') or 'Photo')})
   if len(rows)>=limit: break
  offset += len(entries)
  if not entries or offset>=int(data.get('total_count') or 0): break
 return {'kind':'photos','provider':'Box','photos':rows[:limit],'intervalSec':clamp_int(s.get('intervalSec'),5,3600,30),'protected':True}
def media(s,c,item_id):
 token=_token(s,c); status,h,b,final=c.request(f'https://api.box.com/2.0/files/{quote(str(item_id),safe="")}/content',headers={'Authorization':'Bearer '+token,'User-Agent':'LibreDisplay integration'},max_bytes=25*1024*1024)
 if status in (301,302,303,307,308):
  location=h.get('Location') or h.get('location')
  if not location: raise RuntimeError('Download redirect did not include a Location header')
  return c.fetch_bytes(location,max_bytes=25*1024*1024)
 if status!=200: raise RuntimeError(f'HTTP {status}')
 return b,h.get('Content-Type','image/jpeg')
