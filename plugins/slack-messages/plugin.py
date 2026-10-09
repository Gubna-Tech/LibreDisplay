from _shared import request_json, qs, clamp_int, plain_text
MANIFEST={"apiVersion":1,"id":"slack-messages","name":"Slack Messages","description":"Show recent messages from a Slack conversation using a Slack access token with the appropriate history scope.","version":"1.0","icon":"#","refreshMin":2,"kind":"messages","settings":[{"key":"token","label":"Slack token","type":"password","required":True},{"key":"channelId","label":"Channel / conversation ID","type":"text","required":True},{"key":"limit","label":"Messages","type":"number","default":10},{"key":"label","label":"Display label","type":"text","default":"Slack"}]}
MANIFEST.update({'access': 'account', 'dataFlow': 'provider-cloud', 'dataLeavesDevice': True, 'privacyNote': 'LibreDisplay sends the configured Slack token/channel request to Slack cloud and receives recent conversation messages.', 'freedomAlternative': 'No equivalent bundled self-hosted chat provider yet; Web API can target a compatible JSON endpoint you control.'})

_PRESENTATION_CACHE_FIELDS = {'label': {'responsePaths': ['title'], 'presentationOmitEmpty': False}}
for _field in MANIFEST.get("settings") or []:
    _meta = _PRESENTATION_CACHE_FIELDS.get(_field.get("key"))
    if _meta:
        _field.update({"cacheKey": False, **_meta})
def fetch(s,c):
 limit=clamp_int(s.get('limit'),1,15,10); data,_,_=request_json(c,qs('https://slack.com/api/conversations.history',{'channel':s.get('channelId'),'limit':limit}),headers={'Authorization':'Bearer '+str(s.get('token')),'User-Agent':'LibreDisplay integration'});
 if not data.get('ok'): raise RuntimeError(str(data.get('error') or 'Slack API error'))
 rows=[]
 for m in data.get('messages') or []: rows.append({'text':plain_text(m.get('text'),1000),'user':str(m.get('user') or m.get('username') or ''),'ts':str(m.get('ts') or '')})
 return {'kind':'messages','provider':'Slack','title':str(s.get('label') or 'Slack'),'messages':rows}
