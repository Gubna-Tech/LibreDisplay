import json
import re
from _shared import clamp_int

MANIFEST={
    "apiVersion":1,"id":"icloud-shared-photos","name":"iCloud Shared Album",
    "description":"Rotate images from a public iCloud Shared Album. No Apple ID credentials are stored.",
    "version":"1.0","icon":"▣","refreshMin":30,"kind":"photos",
    "settings":[
        {"key":"sharedUrl","label":"Public iCloud Shared Album URL","type":"url","required":True},
        {"key":"maxPhotos","label":"Maximum photos","type":"number","default":100},
        {"key":"intervalSec","label":"Rotation seconds","type":"number","default":30},
    ],
}
MANIFEST.update({'access': 'no-key', 'dataFlow': 'provider-cloud', 'dataLeavesDevice': True, 'privacyNote': 'LibreDisplay fetches a public iCloud Shared Album link from Apple; no Apple account or API key is required by LibreDisplay.', 'freedomAlternative': 'Use Local / NAS media folders to keep photo storage and retrieval entirely under your control.'})

_PRESENTATION_CACHE_FIELDS = {'intervalSec': {'responsePaths': ['intervalSec'], 'presentationOmitEmpty': False}}
for _field in MANIFEST.get("settings") or []:
    _meta = _PRESENTATION_CACHE_FIELDS.get(_field.get("key"))
    if _meta:
        _field.update({"cacheKey": False, **_meta})

_BASE62='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

def _token(value):
    s=str(value or '').strip()
    m=re.search(r'/sharedalbum/(?:#)?([A-Za-z0-9_-]+)',s,re.I)
    if m: return m.group(1)
    if '#' in s: return s.split('#',1)[1].split(';',1)[0]
    return s.rsplit('/',1)[-1].lstrip('#').split(';',1)[0]

def _base62(value):
    n=0
    for ch in value:
        i=_BASE62.find(ch)
        if i < 0: raise ValueError('Invalid iCloud shared-album token')
        n=n*62+i
    return n

def _partition(token):
    if len(token)<3: raise ValueError('Invalid iCloud shared-album token')
    n=_base62(token[1] if token[0]=='A' else token[1:3])
    return f'{n:02d}' if n < 10 else str(n)

def _post_json(ctx,url,payload):
    status,headers,raw,final=ctx.request(url,method='POST',headers={'Content-Type':'text/plain','Cache-Control':'no-cache','Pragma':'no-cache','User-Agent':'Mozilla/5.0 LibreDisplay'},body=json.dumps(payload).encode(),max_bytes=8*1024*1024)
    data=json.loads(raw.decode('utf-8','replace')) if raw else {}
    return status,headers,data

def fetch(settings,context):
    token=_token(settings.get('sharedUrl'))
    if not re.fullmatch(r'[A-Za-z0-9_-]{8,200}',token):
        raise ValueError('Invalid public iCloud shared-album URL')
    partition=_partition(token)
    base=f'https://p{partition}-sharedstreams.icloud.com/{token}/sharedstreams'
    status,headers,stream=_post_json(context,base+'/webstream',{'streamCtag':None})
    if status==330 or stream.get('X-Apple-MMe-Host'):
        host=str(stream.get('X-Apple-MMe-Host') or headers.get('X-Apple-MMe-Host') or '').strip()
        if not host: raise RuntimeError('iCloud requested a partition redirect without a host')
        base=f'https://{host}/{token}/sharedstreams'
        status,headers,stream=_post_json(context,base+'/webstream',{'streamCtag':None})
    if status!=200: raise RuntimeError(f'iCloud returned HTTP {status}')
    limit=clamp_int(settings.get('maxPhotos'),1,500,100)
    selected=[]; guids=[]
    for photo in stream.get('photos') or []:
        if photo.get('mediaAssetType')=='video': continue
        derivs=photo.get('derivatives') or {}
        choices=[]
        for d in derivs.values() if isinstance(derivs,dict) else []:
            if not isinstance(d,dict) or not d.get('checksum'): continue
            try: score=int(d.get('fileSize') or 0)
            except Exception: score=0
            if not score:
                try: score=int(d.get('width') or 0)*int(d.get('height') or 0)
                except Exception: score=0
            choices.append((score,str(d.get('checksum'))))
        if not choices: continue
        guid=str(photo.get('photoGuid') or '')
        if not guid: continue
        checksum=max(choices,key=lambda x:x[0])[1]
        selected.append((guid,checksum,str(photo.get('caption') or photo.get('filename') or 'Photo')))
        guids.append(guid)
        if len(selected)>=limit: break
    if not guids:
        return {'kind':'photos','provider':'iCloud Shared Album','photos':[],'intervalSec':clamp_int(settings.get('intervalSec'),5,3600,30),'protected':False}
    status,_,assets=_post_json(context,base+'/webasseturls',{'photoGuids':guids})
    if status!=200: raise RuntimeError(f'iCloud asset lookup returned HTTP {status}')
    items=assets.get('items') or {}; rows=[]
    for guid,checksum,name in selected:
        item=items.get(checksum) if isinstance(items,dict) else None
        if not isinstance(item,dict): continue
        host=str(item.get('url_location') or '').strip(); path=str(item.get('url_path') or '').strip()
        if host and path:
            rows.append({'id':guid,'name':name,'url':'https://'+host+path})
    return {'kind':'photos','provider':'iCloud Shared Album','photos':rows,'intervalSec':clamp_int(settings.get('intervalSec'),5,3600,30),'protected':False}
