from _shared import request_json, clamp_int, qs
MANIFEST={"apiVersion":1,"id":"flickr-photos","name":"Flickr Photos","description":"Rotate photos from a Flickr album/photoset using Flickr's public photo API.","version":"1.0","icon":"▣","refreshMin":30,"kind":"photos","settings":[{"key":"apiKey","label":"Flickr API key","type":"password","required":True},{"key":"userId","label":"Flickr user ID","type":"text","required":True},{"key":"photosetId","label":"Album / photoset ID","type":"text","required":True},{"key":"maxPhotos","label":"Maximum photos","type":"number","default":100},{"key":"intervalSec","label":"Rotation seconds","type":"number","default":30}]}
def fetch(s,c):
 limit=clamp_int(s.get('maxPhotos'),1,500,100); url=qs('https://www.flickr.com/services/rest/',{'method':'flickr.photosets.getPhotos','api_key':s.get('apiKey'),'user_id':s.get('userId'),'photoset_id':s.get('photosetId'),'extras':'url_o,url_l,url_c,url_m','per_page':limit,'page':1,'format':'json','nojsoncallback':1}); data,_,_=request_json(c,url); rows=[]
 if data.get('stat')!='ok': raise RuntimeError(str(data.get('message') or 'Flickr API error'))
 for x in ((data.get('photoset') or {}).get('photo') or []):
  image=x.get('url_o') or x.get('url_l') or x.get('url_c') or x.get('url_m')
  if image: rows.append({'id':str(x.get('id')),'name':str(x.get('title') or 'Photo'),'url':str(image)})
 return {'kind':'photos','provider':'Flickr','photos':rows,'intervalSec':clamp_int(s.get('intervalSec'),5,3600,30),'protected':False}
