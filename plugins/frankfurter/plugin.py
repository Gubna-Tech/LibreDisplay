from _shared import request_json, qs
MANIFEST={"apiVersion":1,"id":"frankfurter","name":"Currency · Frankfurter","description":"Convert between currencies using Frankfurter's reference exchange-rate API.","version":"1.0","icon":"¤","refreshMin":60,"kind":"status","access":"no-key","freedomNote":"No account or API key is required for the reference exchange-rate feed.","settings":[{"key":"base","label":"Base currency","type":"text","default":"USD","required":True},{"key":"quote","label":"Quote currency","type":"text","default":"EUR","required":True},{"key":"amount","label":"Amount","type":"number","default":1}]}
def fetch(s,c):
 base=str(s.get('base') or 'USD').upper(); quote=str(s.get('quote') or 'EUR').upper(); amount=float(s.get('amount') or 1); data,_,_=request_json(c,qs('https://api.frankfurter.dev/v2/rates',{'base':base,'quotes':quote})); rate=None
 if isinstance(data,list) and data: rate=data[0].get('rate')
 elif isinstance(data,dict): rate=(data.get('rates') or {}).get(quote) or data.get('rate')
 if rate is None: raise RuntimeError('Exchange rate unavailable')
 return {'kind':'status','provider':'Frankfurter','title':f'{base} → {quote}','value':round(amount*float(rate),6),'suffix':' '+quote,'details':[{'label':'Amount','value':f'{amount:g} {base}'},{'label':'Rate','value':f'{float(rate):.6g}'},{'label':'Date','value':(data[0].get('date') if isinstance(data,list) and data else data.get('date'))}]}
