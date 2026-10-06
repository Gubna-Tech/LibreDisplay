from _shared import request_json, qs
MANIFEST={"apiVersion":1,"id":"coingecko","name":"Crypto · CoinGecko","description":"Show cryptocurrency price and 24-hour change using CoinGecko's Simple Price API.","version":"1.0","icon":"₿","refreshMin":5,"kind":"status","access":"no-key","freedomNote":"The public CoinGecko endpoint can be used without a key; a key remains optional for users who already have one.","settings":[{"key":"coinId","label":"CoinGecko coin ID","type":"text","default":"bitcoin","required":True},{"key":"currency","label":"Quote currency","type":"text","default":"usd","required":True},{"key":"apiKey","label":"CoinGecko API key (optional)","type":"password"}]}
def fetch(s,c):
 coin=str(s.get('coinId') or 'bitcoin').lower(); cur=str(s.get('currency') or 'usd').lower(); headers={'User-Agent':'LibreDisplay integration'}; key=str(s.get('apiKey') or '').strip(); base='https://api.coingecko.com/api/v3/simple/price'
 if key: headers['x-cg-demo-api-key']=key
 data,_,_=request_json(c,qs(base,{'ids':coin,'vs_currencies':cur,'include_24hr_change':'true','include_last_updated_at':'true'}),headers=headers); row=data.get(coin) or {}
 if cur not in row: raise RuntimeError('CoinGecko did not return the requested coin/currency')
 return {'kind':'status','provider':'CoinGecko','title':coin.replace('-',' ').title(),'value':row.get(cur),'suffix':' '+cur.upper(),'details':[{'label':'24h','value':f"{float(row.get(cur+'_24h_change') or 0):+.2f}%"}]}
