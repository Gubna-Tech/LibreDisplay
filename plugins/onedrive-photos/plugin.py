from urllib.parse import quote
from _shared import bearer, request_json, clamp_int
MANIFEST={"apiVersion":1,"id":"onedrive-photos","name":"OneDrive Photos","description":"Rotate photos from a OneDrive folder without exposing Microsoft credentials to the display browser.","version":"1.0","icon":"▣","refreshMin":15,"kind":"photos","settings":[{"key":"folderId","label":"Folder item ID","type":"text","default":"root","required":True},{"key":"accessToken","label":"Access token","type":"password"},{"key":"refreshToken","label":"Refresh token","type":"password"},{"key":"clientId","label":"Microsoft app client ID","type":"text"},{"key":"clientSecret","label":"Microsoft app client secret","type":"password"},{"key":"tenant","label":"Tenant","type":"text","default":"common"},{"key":"maxPhotos","label":"Maximum photos","type":"number","default":100},{"key":"intervalSec","label":"Rotation seconds","type":"number","default":30}]}
def _token(s,c):
 t=str(s.get('tenant') or 'common').strip(); u=f'https://login.microsoftonline.com/{quote(t,safe="")}/oauth2/v2.0/token'; return bearer(s,c,token_url=u,form={'client_id':s.get('clientId'),'client_secret':s.get('clientSecret'),'scope':'offline_access Files.Read'},cache_prefix='onedrive')
def fetch(s,c):
 token=_token(s,c); folder=str(s.get('folderId') or 'root').strip(); base='https://graph.microsoft.com/v1.0/me/drive/root/children' if folder=='root' else f'https://graph.microsoft.com/v1.0/me/drive/items/{quote(folder,safe="")}/children'; url=base+'?$select=id,name,file,image,photo,thumbnails&$top=200'; items=[]
 while url and len(items)<clamp_int(s.get('maxPhotos'),1,500,100):
  data,_,_=request_json(c,url,headers={'Authorization':'Bearer '+token,'User-Agent':'LibreDisplay integration'}); 
  for x in data.get('value') or []:
   mime=str((x.get('file') or {}).get('mimeType') or '')
   if mime.startswith('image/'): items.append({'id':str(x.get('id')),'name':str(x.get('name') or 'Photo')})
  url=str(data.get('@odata.nextLink') or '')
 return {'kind':'photos','provider':'OneDrive','photos':items[:clamp_int(s.get('maxPhotos'),1,500,100)],'intervalSec':clamp_int(s.get('intervalSec'),5,3600,30),'protected':True}
def media(s,c,item_id):
 token=_token(s,c); url=f'https://graph.microsoft.com/v1.0/me/drive/items/{quote(str(item_id),safe="")}/content'; status,h,b,final=c.request(url,headers={'Authorization':'Bearer '+token,'User-Agent':'LibreDisplay integration'},max_bytes=25*1024*1024)
 if status in (301,302,303,307,308):
  location=h.get('Location') or h.get('location')
  if not location: raise RuntimeError('Download redirect did not include a Location header')
  return c.fetch_bytes(location,max_bytes=25*1024*1024)
 if status!=200: raise RuntimeError(f'HTTP {status}')
 return b,h.get('Content-Type','image/jpeg')
