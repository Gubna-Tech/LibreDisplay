import datetime
from _shared import request_json, qs, clamp_int
MANIFEST={"apiVersion":1,"id":"noaa-tides","name":"Tides · NOAA CO-OPS","description":"Show upcoming NOAA CO-OPS high/low tide predictions for a U.S. station.","version":"1.0","icon":"≈","refreshMin":60,"kind":"status","settings":[{"key":"station","label":"NOAA station ID","type":"text","required":True},{"key":"units","label":"Units","type":"select","default":"english","options":[{"value":"english","label":"Feet"},{"value":"metric","label":"Meters"}]},{"key":"days","label":"Days ahead","type":"number","default":2}]}
def fetch(s,c):
 now=datetime.datetime.utcnow().date(); end=now+datetime.timedelta(days=clamp_int(s.get('days'),1,7,2)); url=qs('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',{'product':'predictions','application':'LibreDisplay','begin_date':now.strftime('%Y%m%d'),'end_date':end.strftime('%Y%m%d'),'datum':'MLLW','station':s.get('station'),'time_zone':'lst_ldt','units':s.get('units') or 'english','interval':'hilo','format':'json'}); data,_,_=request_json(c,url); rows=[]
 if data.get('error'): raise RuntimeError(str((data.get('error') or {}).get('message') or data.get('error')))
 for x in (data.get('predictions') or [])[:12]: rows.append({'time':x.get('t'),'height':x.get('v'),'type':'High' if x.get('type')=='H' else 'Low'})
 first=rows[0] if rows else {}
 return {'kind':'status','provider':'NOAA CO-OPS','title':'Next tide','value':first.get('type') or 'No prediction','details':[{'label':'Time','value':first.get('time')},{'label':'Height','value':((str(first.get('height'))+' '+('ft' if (s.get('units') or 'english')=='english' else 'm')) if first else '')}],'items':rows}
