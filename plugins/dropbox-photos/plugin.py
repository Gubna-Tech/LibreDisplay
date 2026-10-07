import json
from _shared import bearer, request_json, clamp_int
MANIFEST={"apiVersion":1,"id":"dropbox-photos","name":"Dropbox Photos","description":"Rotate image files from a Dropbox folder through LibreDisplay's credential-safe media proxy.","version":"1.0","icon":"▣","refreshMin":15,"kind":"photos","settings":[{"key":"path","label":"Dropbox folder path","type":"text","default":""},{"key":"accessToken","label":"Access token","type":"password"},{"key":"refreshToken","label":"Refresh token","type":"password"},{"key":"clientId","label":"Dropbox app key","type":"text"},{"key":"clientSecret","label":"Dropbox app secret","type":"password"},{"key":"recursive","label":"Include subfolders","type":"checkbox","default":True},{"key":"maxPhotos","label":"Maximum photos","type":"number","default":100},{"key":"intervalSec","label":"Rotation seconds","type":"number","default":30}]}
MANIFEST.update({'access': 'account', 'dataFlow': 'provider-cloud', 'dataLeavesDevice': True, 'privacyNote': 'LibreDisplay connects to the configured Dropbox account and downloads selected folder metadata/photos over HTTPS.', 'freedomAlternative': 'Use Local / NAS media folders to keep photo storage under your own control.'})

_PRESENTATION_CACHE_FIELDS = {'intervalSec': {'responsePaths': ['intervalSec'], 'presentationOmitEmpty': False}}
for _field in MANIFEST.get("settings") or []:
    _meta = _PRESENTATION_CACHE_FIELDS.get(_field.get("key"))
    if _meta:
        _field.update({"cacheKey": False, **_meta})
def _token(s,c): return bearer(s,c,token_url='https://api.dropboxapi.com/oauth2/token',form={'client_id':s.get('clientId'),'client_secret':s.get('clientSecret')},cache_prefix='dropbox')
def fetch(s,c):
 token=_token(s,c); limit=clamp_int(s.get('maxPhotos'),1,500,100); headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'LibreDisplay integration'}; payload={'path':str(s.get('path') or ''),'recursive':bool(s.get('recursive')),'include_deleted':False,'include_non_downloadable_files':False,'limit':min(2000,max(100,limit))}; data,_,_=request_json(c,'https://api.dropboxapi.com/2/files/list_folder',method='POST',headers=headers,body=json.dumps(payload).encode()); rows=[]
 while True:
  for x in data.get('entries') or []:
   if x.get('.tag')=='file' and str(x.get('name') or '').lower().endswith(('.jpg','.jpeg','.png','.webp','.gif','.avif','.bmp')): rows.append({'id':str(x.get('id') or x.get('path_lower')),'name':str(x.get('name') or 'Photo')})
   if len(rows)>=limit: break
  if len(rows)>=limit or not data.get('has_more'): break
  data,_,_=request_json(c,'https://api.dropboxapi.com/2/files/list_folder/continue',method='POST',headers=headers,body=json.dumps({'cursor':data.get('cursor')}).encode())
 return {'kind':'photos','provider':'Dropbox','photos':rows[:limit],'intervalSec':clamp_int(s.get('intervalSec'),5,3600,30),'protected':True}
def media(s,c,item_id):
 token=_token(s,c); status,h,b,final=c.request('https://content.dropboxapi.com/2/files/download',method='POST',headers={'Authorization':'Bearer '+token,'Dropbox-API-Arg':json.dumps({'path':str(item_id)}),'User-Agent':'LibreDisplay integration'},max_bytes=25*1024*1024)
 if status!=200: raise RuntimeError(f'HTTP {status}')
 return b,h.get('Content-Type','image/jpeg')
