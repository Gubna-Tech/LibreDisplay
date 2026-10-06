from urllib.parse import quote
from _shared import request_json

MANIFEST={
    "apiVersion":1,
    "id":"osrm-travel",
    "name":"Travel Time · OSRM",
    "description":"Keyless route time and distance using the open-source Open Source Routing Machine (OSRM).",
    "version":"1.0",
    "icon":"↗",
    "refreshMin":10,
    "kind":"status",
    "access":"no-key",
    "freedomNote":"No account or API key. OSRM is open source and self-hostable. The default project demo endpoint is best-effort; point LibreDisplay at your own OSRM server for full control.",
    "settings":[
        {"key":"serviceUrl","label":"OSRM server URL","type":"url","default":"https://router.project-osrm.org","help":"Use the public OSRM demo or your own self-hosted OSRM server."},
        {"key":"profile","label":"Routing profile","type":"text","default":"driving","help":"Usually driving. Self-hosted OSRM deployments can expose a different profile name."},
        {"key":"originLon","label":"Origin longitude","type":"number","required":True,"min":-180,"max":180,"step":0.000001},
        {"key":"originLat","label":"Origin latitude","type":"number","required":True,"min":-90,"max":90,"step":0.000001},
        {"key":"destinationLon","label":"Destination longitude","type":"number","required":True,"min":-180,"max":180,"step":0.000001},
        {"key":"destinationLat","label":"Destination latitude","type":"number","required":True,"min":-90,"max":90,"step":0.000001},
        {"key":"units","label":"Distance units","type":"select","default":"auto","options":[{"value":"auto","label":"Automatic"},{"value":"mi","label":"Miles"},{"value":"km","label":"Kilometers"}]},
        {"key":"label","label":"Route label","type":"text","default":"Travel time"}
    ]
}

def _coord(value, lo, hi, name):
    try:
        n=float(value)
    except Exception as exc:
        raise ValueError(f'{name} is required') from exc
    if n < lo or n > hi:
        raise ValueError(f'{name} is out of range')
    return n

def fetch(s,c):
    base=str(s.get('serviceUrl') or 'https://router.project-osrm.org').strip().rstrip('/')
    if not base.startswith(('http://','https://')):
        raise ValueError('OSRM server URL must start with http:// or https://')
    profile=''.join(ch for ch in str(s.get('profile') or 'driving').strip() if ch.isalnum() or ch in ('-','_'))[:40] or 'driving'
    olon=_coord(s.get('originLon'),-180,180,'Origin longitude'); olat=_coord(s.get('originLat'),-90,90,'Origin latitude')
    dlon=_coord(s.get('destinationLon'),-180,180,'Destination longitude'); dlat=_coord(s.get('destinationLat'),-90,90,'Destination latitude')
    coords=f'{olon:.6f},{olat:.6f};{dlon:.6f},{dlat:.6f}'
    url=f'{base}/route/v1/{quote(profile,safe="")}/{coords}?overview=false&steps=false'
    data,_,_=request_json(c,url)
    if str(data.get('code') or '')!='Ok' or not data.get('routes'):
        raise RuntimeError('OSRM did not return a route')
    route=data['routes'][0]; seconds=max(0,float(route.get('duration') or 0)); meters=max(0,float(route.get('distance') or 0)); mins=max(1,round(seconds/60)) if seconds else 0
    units=str(s.get('units') or 'auto').lower(); units='mi' if units=='auto' else units
    if units=='km': distance=f'{meters/1000:.1f} km'
    else: distance=f'{meters/1609.344:.1f} mi'
    return {'kind':'status','provider':'OSRM','title':str(s.get('label') or 'Travel time'),'value':mins,'suffix':' min','details':[{'label':'Distance','value':distance},{'label':'Routing','value':profile}]}
