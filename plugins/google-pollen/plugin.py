from _shared import request_json, qs, clamp_int
MANIFEST={"apiVersion":1,"id":"google-pollen","name":"Pollen · Google","description":"Show Google's daily pollen forecast for grass, tree, and weed pollen.","version":"1.0","icon":"✿","refreshMin":60,"kind":"status","settings":[{"key":"apiKey","label":"Google Pollen API key","type":"password","required":True},{"key":"latitude","label":"Latitude","type":"number","required":True},{"key":"longitude","label":"Longitude","type":"number","required":True},{"key":"days","label":"Forecast days","type":"number","default":3}]}
def fetch(s,c):
 days=clamp_int(s.get('days'),1,5,3); url=qs('https://pollen.googleapis.com/v1/forecast:lookup',{'key':s.get('apiKey'),'location.latitude':float(s.get('latitude')),'location.longitude':float(s.get('longitude')),'days':days,'plantsDescription':'false'}); data,_,_=request_json(c,url); rows=[]
 for day in data.get('dailyInfo') or []:
  d=day.get('date') or {}; date=f"{int(d.get('year') or 0):04d}-{int(d.get('month') or 0):02d}-{int(d.get('day') or 0):02d}"; vals=[]
  for p in day.get('pollenTypeInfo') or []:
   idx=p.get('indexInfo') or {}; vals.append({'type':p.get('code'),'value':idx.get('value'),'category':idx.get('category')})
  rows.append({'date':date,'pollen':vals})
 first=(rows[0].get('pollen') if rows else []) or []; top=max(first,key=lambda x:int(x.get('value') or 0),default={})
 return {'kind':'status','provider':'Google Pollen','title':'Pollen','value':top.get('category') or 'No data','details':[{'label':str(x.get('type') or '').title(),'value':f"{x.get('value','—')} · {x.get('category','')}"} for x in first],'forecast':rows}
