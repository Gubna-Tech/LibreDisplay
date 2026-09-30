from urllib.parse import urlencode
MANIFEST={"apiVersion":1,"id":"openstreetmap","name":"Map · OpenStreetMap","description":"Show an OpenStreetMap view centered on a coordinate without an API key.","version":"1.0","icon":"⌖","refreshMin":1440,"kind":"map","settings":[{"key":"latitude","label":"Latitude","type":"number","required":True},{"key":"longitude","label":"Longitude","type":"number","required":True},{"key":"zoom","label":"Zoom","type":"number","default":13},{"key":"label","label":"Location label","type":"text"}]}
def fetch(s,c):
 lat=float(s.get('latitude')); lon=float(s.get('longitude')); z=max(1,min(19,int(float(s.get('zoom') or 13)))); d=0.08/(2**max(0,z-12)); bbox=f'{lon-d},{lat-d},{lon+d},{lat+d}'; src='https://www.openstreetmap.org/export/embed.html?'+urlencode({'bbox':bbox,'layer':'mapnik','marker':f'{lat},{lon}'})
 return {'kind':'map','provider':'OpenStreetMap','title':str(s.get('label') or 'Map'),'embedUrl':src,'latitude':lat,'longitude':lon,'zoom':z}
