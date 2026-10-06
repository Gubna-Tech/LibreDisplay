import datetime
import hashlib
import html
import json
import re
from urllib.parse import quote, urlencode
from _shared import request_json, plain_text

MANIFEST={
    "apiVersion":1,
    "id":"grateful-dead",
    "name":"Deadhead · Grateful Dead",
    "description":"Unofficial fan integration for Today in Dead History, rotating historical shows, no-key setlists, sourced member quotes, and listening suggestions.",
    "version":"1.1",
    "icon":"✺",
    "refreshMin":30,
    "kind":"data",
    "category":"Media",
    "settings":[
        {"key":"era","label":"Favorite era","type":"select","default":"all","options":[{"value":"all","label":"All years"},{"value":"60s","label":"1960s"},{"value":"70s","label":"1970s"},{"value":"80s","label":"1980s"},{"value":"90s","label":"1990s"}]},
        {"key":"showMode","label":"Featured show priority","type":"select","default":"today","options":[{"value":"today","label":"Rotate today's history"},{"value":"favorites","label":"Prefer favorite venues"},{"value":"surprise","label":"Daily surprise order"}]},
        {"key":"showLimit","label":"Shows to keep in rotation","type":"select","default":"12","options":[{"value":"5","label":"5 shows"},{"value":"8","label":"8 shows"},{"value":"12","label":"12 shows"},{"value":"20","label":"20 shows"},{"value":"40","label":"All available (up to 40)"}]},
        {"key":"showOrder","label":"Show order","type":"select","default":"oldest","options":[{"value":"oldest","label":"Oldest first"},{"value":"newest","label":"Newest first"},{"value":"shuffle","label":"Daily shuffle"},{"value":"favorites","label":"Favorite venues first"}]},
        {"key":"autoRotate","label":"Automatically rotate shows","type":"checkbox","default":True},
        {"key":"rotationSeconds","label":"Show rotation interval","type":"select","default":"30","options":[{"value":"15","label":"15 seconds"},{"value":"30","label":"30 seconds"},{"value":"60","label":"1 minute"},{"value":"120","label":"2 minutes"}]},
        {"key":"showBrowser","label":"Show browser style","type":"select","default":"year-strip","options":[{"value":"year-strip","label":"Year strip"},{"value":"list","label":"Compact show list"},{"value":"minimal","label":"Featured show only"}]},
        {"key":"favoriteVenues","label":"Favorite venues","type":"textarea","default":"","help":"Optional comma-separated venue or city names. Favorite ordering promotes matching shows."},
        {"key":"favoriteSongs","label":"Favorite songs","type":"textarea","default":"","help":"Optional comma-separated titles. Matching songs are highlighted when a setlist is available."},
        {"key":"setlistsEnabled","label":"Show setlists","type":"checkbox","default":True},
        {"key":"setlistSource","label":"Setlist source","type":"select","default":"auto","options":[{"value":"auto","label":"Automatic · no key required"},{"value":"jerrybase","label":"JerryBase · no key"},{"value":"archive","label":"Internet Archive recording metadata · no key"},{"value":"setlistfm","label":"setlist.fm · API key"}]},
        {"key":"setlistPreload","label":"Preload setlists for","type":"select","default":"3","options":[{"value":"1","label":"Featured show only"},{"value":"3","label":"3 shows"},{"value":"5","label":"5 shows"},{"value":"8","label":"8 shows"}]},
        {"key":"quoteMember","label":"Quote member","type":"select","default":"all","options":[
            {"value":"all","label":"Rotate all members"},{"value":"jerry","label":"Jerry Garcia"},{"value":"bob","label":"Bob Weir"},{"value":"phil","label":"Phil Lesh"},{"value":"mickey","label":"Mickey Hart"},{"value":"bill","label":"Bill Kreutzmann"},{"value":"pigpen","label":"Ron “Pigpen” McKernan"},{"value":"tom","label":"Tom Constanten"},{"value":"keith","label":"Keith Godchaux"},{"value":"donna","label":"Donna Jean Godchaux"},{"value":"brent","label":"Brent Mydland"},{"value":"vince","label":"Vince Welnick"}
        ]},
        {"key":"quoteRotate","label":"Rotate member quotes","type":"checkbox","default":True},
        {"key":"quoteSeconds","label":"Quote rotation interval","type":"select","default":"60","options":[{"value":"30","label":"30 seconds"},{"value":"60","label":"1 minute"},{"value":"120","label":"2 minutes"},{"value":"300","label":"5 minutes"}]},
        {"key":"customQuotes","label":"Personal quote pack","type":"textarea","default":"","help":"Optional lines: Member | Quote | Source URL. Keep quotes short and provide a source."},
        {"key":"visualMode","label":"Deadhead visual treatment","type":"select","default":"subtle","options":[{"value":"off","label":"Block only"},{"value":"subtle","label":"Subtle psychedelic accents"},{"value":"psychedelic","label":"Full Deadhead color wash"}]},
        {"key":"setlistApiKey","label":"setlist.fm API key","type":"password","required":False,"help":"Optional. Only needed if setlist.fm is selected or used as a fallback. JerryBase and Internet Archive enrichment need no API key."}
    ]
}

# Quotes are intentionally short sourced excerpts from interviews and member archives.
QUOTES=[
    {"key":"jerry","member":"Jerry Garcia","quote":"All it takes to create another reality is for people to live in it.","source":"Grateful Dead Deadcast · Europe '72: Denmark","url":"https://www.dead.net/deadcast/europe-72-denmark"},
    {"key":"bob","member":"Bob Weir","quote":"We've always been pretty free to do the things we want.","source":"November 1972 interview","url":"https://deadsources.blogspot.com/2022/09/november-1972-bob-weir-interview.html"},
    {"key":"phil","member":"Phil Lesh","quote":"Somehow the music would make us act in unison.","source":"Spring 1971 interview","url":"https://deadsources.blogspot.com/2013/12/spring-1971-phil-lesh-interview.html"},
    {"key":"mickey","member":"Mickey Hart","quote":"I like to create things from nothing, to make things happen.","source":"PBS NewsHour · CANVAS","url":"https://www.pbs.org/newshour/show/grateful-dead-drummer-mickey-hart-combines-music-and-art-at-the-las-vegas-sphere"},
    {"key":"bill","member":"Bill Kreutzmann","quote":"Even with the older material, you're always creating new music in the moment.","source":"Grateful Dead interview","url":"https://www.dead.net/features/dead-world-roundup/talkin-about-music-laughter-and-life-bill-kreutzmann"},
    {"key":"pigpen","member":"Ron “Pigpen” McKernan","quote":"And then I’d sing and play harmonica. Way before the Warlocks.","source":"Deadcast archival interview · 10/6/70","url":"https://www.dead.net/adventures-pigpen-part-1"},
    {"key":"keith","member":"Keith Godchaux","quote":"I don’t want to listen to it. I want to play it.","source":"Donna Jean recounting Keith · Grateful Dead Deadcast","url":"https://www.dead.net/enter-keith-godchaux"},
    {"key":"donna","member":"Donna Jean Godchaux","quote":"When I sing again, it's going to be with that band.","source":"Grateful Dead Deadcast · Donna Jean","url":"https://www.dead.net/donna-jean"},
    {"key":"brent","member":"Brent Mydland","quote":"There are people who like me and people who don’t like the fact that I’m in the band.","source":"The Golden Road interview, quoted by Phoenix New Times","url":"https://www.phoenixnewtimes.com/music/better-off-deadphoenix-native-vince-welnick-makes-good-on-grateful-expectations-6426051/"},
    {"key":"tom","member":"Tom Constanten","quote":"We sort of threw the spaghetti at the wall to see what would happen.","source":"Grateful Web interview · 2026","url":"https://www.gratefulweb.com/articles/we-sort-of-threw-spaghetti-at-the-wall-an-interview-with-tom-constanten-of-the-grateful-dead/"},
    {"key":"vince","member":"Vince Welnick","quote":"They’re very much a family, and that’s something you don’t find much in rock ’n’ roll anymore.","source":"Phoenix New Times interview · 1995","url":"https://www.phoenixnewtimes.com/music/better-off-deadphoenix-native-vince-welnick-makes-good-on-grateful-expectations-6426051/"}
]

MEMBER_ORDER=['jerry','bob','phil','mickey','bill','pigpen','tom','keith','donna','brent','vince']

def _tokens(value):
    return [x.strip().lower() for x in re.split(r'[,;\n]+',str(value or '')) if x.strip()][:40]

def _bool(value, default=False):
    if isinstance(value,bool): return value
    if value is None: return default
    return str(value).strip().lower() not in ('0','false','no','off','')

def _int(value, lo, hi, default):
    try: value=int(float(value))
    except Exception: value=default
    return max(lo,min(hi,value))

def _era_ok(year, era):
    if era=='all': return True
    try: decade=int(str(era)[:2])*10+1900
    except Exception: return True
    return decade<=int(year)<decade+10

def _show_date(value):
    text=str(value or '')[:64]
    match=re.search(r'(19\d{2})-(\d{2})-(\d{2})',text)
    return match.group(0) if match else ''

def _venue_from_doc(doc):
    venue=plain_text(doc.get('venue') or '',160)
    coverage=plain_text(doc.get('coverage') or '',120)
    title=plain_text(doc.get('title') or '',220)
    if not venue:
        match=re.search(r'Live at (.+?) on \d{4}-\d{2}-\d{2}',title,re.I)
        if match: venue=match.group(1).strip()
    return venue,coverage,title

def _archive_today(ctx, today):
    mmdd=today.strftime('%m-%d')
    query=f'collection:GratefulDead AND identifier:gd*-{mmdd}*'
    params=[('q',query),('fl[]','identifier'),('fl[]','title'),('fl[]','date'),('fl[]','venue'),('fl[]','coverage'),('rows','220'),('page','1'),('output','json')]
    url='https://archive.org/advancedsearch.php?'+urlencode(params)
    data,_,_=request_json(ctx,url,max_bytes=3*1024*1024)
    docs=(data.get('response') or {}).get('docs') or []
    shows={}
    for doc in docs:
        date=_show_date(doc.get('date') or doc.get('title') or doc.get('identifier'))
        if not date or date[5:]!=today.strftime('%m-%d'): continue
        year=int(date[:4]); identifier=plain_text(doc.get('identifier') or '',180)
        if not identifier: continue
        venue,coverage,title=_venue_from_doc(doc)
        row=shows.setdefault(date,{"date":date,"year":year,"venue":venue or 'Venue unavailable',"location":coverage,"title":title,"identifier":identifier,"archiveUrl":f'https://archive.org/details/{quote(identifier)}',"relistenUrl":f'https://relisten.net/grateful-dead/{date[:4]}/{date[5:7]}/{date[8:10]}',"jerrybaseUrl":f'https://jerrybase.com/events/{date.replace("-","")}-01',"recordings":0})
        row['recordings']+=1
        if row['venue']=='Venue unavailable' and venue: row['venue']=venue
        if not row['location'] and coverage: row['location']=coverage
    return sorted(shows.values(),key=lambda x:x['date'])

def _fallback_today(today):
    known={
        '05-08':[('1977-05-08','Barton Hall, Cornell University','Ithaca, NY')],
        '06-12':[('1980-06-12','Portland Memorial Coliseum','Portland, OR')],
        '09-30':[('1976-09-30','Auditorium, Ohio State University','Columbus, OH'),('1993-09-30','Boston Garden','Boston, MA')],
        '10-06':[('1970-10-06','Grateful Dead live performance','Today in Dead history')]
    }
    rows=[]
    for date,venue,location in known.get(today.strftime('%m-%d'),[]):
        rows.append({"date":date,"year":int(date[:4]),"venue":venue,"location":location,"title":"","identifier":"","archiveUrl":"https://archive.org/details/GratefulDead","relistenUrl":f'https://relisten.net/grateful-dead/{date[:4]}/{date[5:7]}/{date[8:10]}',"jerrybaseUrl":f'https://jerrybase.com/events/{date.replace("-","")}-01',"recordings":0,"fallback":True})
    return rows

def _custom_quotes(value):
    out=[]
    for line in str(value or '').splitlines()[:30]:
        parts=[x.strip() for x in line.split('|',2)]
        if len(parts)<2 or not parts[0] or not parts[1]: continue
        url=parts[2] if len(parts)>2 and re.match(r'^https?://',parts[2],re.I) else ''
        out.append({"key":"custom","member":plain_text(parts[0],60),"quote":plain_text(parts[1],220),"source":"Personal quote pack","url":url})
    return out

def _quote_rows(settings,today):
    rows=QUOTES+_custom_quotes(settings.get('customQuotes'))
    member=str(settings.get('quoteMember') or 'all').lower()
    if member!='all': rows=[x for x in rows if x.get('key')==member] or rows
    seed=int(hashlib.sha256((today.isoformat()+member).encode()).hexdigest()[:10],16)
    if rows:
        offset=seed%len(rows);rows=rows[offset:]+rows[:offset]
    return rows

def _favorite_score(show, favorites):
    hay=f"{show.get('venue','')} {show.get('location','')}".lower()
    return sum(1 for token in favorites if token in hay)

def _order_shows(shows,settings,today):
    rows=list(shows);order=str(settings.get('showOrder') or 'oldest').lower();favorites=_tokens(settings.get('favoriteVenues'))
    if order=='newest': rows.sort(key=lambda x:x.get('year',0),reverse=True)
    elif order=='favorites' and favorites: rows.sort(key=lambda x:(-_favorite_score(x,favorites),x.get('year',0)))
    elif order=='shuffle':
        seed=today.isoformat()+str(settings.get('era') or 'all')
        rows.sort(key=lambda x:hashlib.sha256((seed+x.get('date','')).encode()).hexdigest())
    else: rows.sort(key=lambda x:x.get('year',0))
    return rows

def _featured_index(shows,settings,today):
    if not shows:return -1
    mode=str(settings.get('showMode') or 'today');favorites=_tokens(settings.get('favoriteVenues'))
    if mode=='favorites' and favorites:
        scores=[_favorite_score(show,favorites) for show in shows]
        if max(scores)>0:return scores.index(max(scores))
    if mode=='surprise':
        seed=today.isoformat()+str(settings.get('era') or 'all')+'surprise'
        return int(hashlib.sha256(seed.encode()).hexdigest()[:10],16)%len(shows)
    return 0

def _request_text(ctx,url,max_bytes=900*1024):
    status,_,raw,final=ctx.request(url,headers={'User-Agent':'LibreDisplay integration'},max_bytes=max_bytes)
    if status!=200: raise RuntimeError(f'HTTP {status}')
    return raw.decode('utf-8','replace'),final

def _clean_html_text(value):
    text=re.sub(r'<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>',' ',str(value or ''),flags=re.I|re.S)
    text=re.sub(r'<br\s*/?>|</(?:p|div|li|tr|h[1-6])>','\n',text,flags=re.I)
    text=re.sub(r'<[^>]+>',' ',text)
    text=html.unescape(text)
    return re.sub(r'[ \t]+',' ',text).replace('\r','')

def _jerrybase_setlist(ctx,show,favorites):
    date=str(show.get('date') or '')
    if not re.match(r'^19\d{2}-\d{2}-\d{2}$',date): return None
    url=f'https://jerrybase.com/events/{date.replace("-","")}-01'
    raw,final=_request_text(ctx,url,max_bytes=1200*1024)
    title_match=re.search(r'<h4[^>]*>\s*Grateful Dead.*?</h4>',raw,re.I|re.S)
    if not title_match and 'Grateful Dead' not in raw: return None
    venue='';vm=re.search(r'<h4[^>]*>\s*<a[^>]*>(.*?)</a>\s*,\s*<a[^>]*>(.*?)</a>\s*</h4>',raw,re.I|re.S)
    if vm: venue=' · '.join(plain_text(x,120) for x in vm.groups() if plain_text(x,120))
    start=re.search(r'<h2[^>]*>\s*Setlist\s*</h2>',raw,re.I|re.S)
    if not start:
        start=re.search(r'>\s*Setlist\s*<',raw,re.I|re.S)
    if not start:return None
    tail=raw[start.end():]
    end=re.search(r'Average\s+Song\s+Gap|Songs\s+By\s+Album|<h2[^>]*>\s*Recordings',tail,re.I|re.S)
    block=tail[:end.start()] if end else tail[:90000]
    block=re.sub(r'<h[1-6][^>]*>\s*(Set\s*\d+|Encore)\s*</h[1-6]>',lambda m:f'\n@@{plain_text(m.group(1),30)}@@\n',block,flags=re.I|re.S)
    block=re.sub(r'<(?:strong|b)[^>]*>\s*(Set\s*\d+|Encore)\s*</(?:strong|b)>',lambda m:f'\n@@{plain_text(m.group(1),30)}@@\n',block,flags=re.I|re.S)
    parts=re.split(r'@@(Set\s*\d+|Encore)@@',block,flags=re.I)
    sets=[]
    for i in range(1,len(parts),2):
        name=plain_text(parts[i],30);seg=parts[i+1] if i+1<len(parts) else ''
        anchors=[plain_text(x,120) for x in re.findall(r'<a\b[^>]*>(.*?)</a>',seg,re.I|re.S)]
        songs=[]
        for song in anchors:
            song=re.sub(r'\s*\[\d+\]\s*','',song).strip()
            if not song or song.lower() in {'archive.org','reviews','show in calendar'}: continue
            if song not in songs:songs.append(song)
        if not songs:
            text=_clean_html_text(seg)
            songs=[plain_text(x,100) for x in re.split(r'\s*,\s*|\s+>\s+',text) if plain_text(x,100)][:35]
        if songs:sets.append({'name':name.title() if name.lower()!='encore' else 'Encore','songs':songs[:35]})
    if not sets:return None
    flat=[song for group in sets for song in group['songs']]
    hits=[song for song in flat if any(token in song.lower() for token in favorites)][:10]
    return {'sets':sets[:5],'favoriteSongHits':hits,'url':final or url,'attribution':'JerryBase','sourceKind':'no-key','venue':venue}

def _archive_track_setlist(ctx,show,favorites):
    identifier=str(show.get('identifier') or '').strip()
    if not identifier:return None
    data,_,_=request_json(ctx,f'https://archive.org/metadata/{quote(identifier)}',max_bytes=2*1024*1024)
    files=data.get('files') or [];rows=[]
    for f in files:
        title=plain_text(f.get('title') or '',120)
        track=plain_text(f.get('track') or '',20)
        if not title or title.lower() in {'tuning','crowd','intro'}: continue
        if not track and str(f.get('name') or '').lower().endswith(('.txt','.jpg','.png','.xml')): continue
        try: order=float(re.sub(r'[^0-9.]','',track) or 9999)
        except Exception: order=9999
        if title not in [x[1] for x in rows]:rows.append((order,title))
    rows.sort(key=lambda x:x[0]);songs=[x[1] for x in rows[:45]]
    if not songs:return None
    hits=[song for song in songs if any(token in song.lower() for token in favorites)][:10]
    return {'sets':[{'name':'Recording','songs':songs}],'favoriteSongHits':hits,'url':show.get('archiveUrl'),'attribution':'Internet Archive metadata','sourceKind':'no-key'}

def _setlistfm_enrichment(ctx,key,show,favorites):
    if not key or not show:return None
    date=datetime.date.fromisoformat(show['date']).strftime('%d-%m-%Y')
    url='https://api.setlist.fm/rest/1.0/search/setlists?'+urlencode({'artistName':'Grateful Dead','date':date,'p':1})
    data,_,_=request_json(ctx,url,headers={'Accept':'application/json','x-api-key':str(key).strip(),'User-Agent':'LibreDisplay integration'})
    rows=data.get('setlist') or []
    if not rows:return None
    row=rows[0];sets=[];flat=[]
    for group in (row.get('sets') or {}).get('set') or []:
        songs=[plain_text(x.get('name'),100) for x in group.get('song') or [] if plain_text(x.get('name'),100)]
        if songs: sets.append({'name':plain_text(group.get('name') or ('Encore' if group.get('encore') else 'Set'),40),'songs':songs[:35]});flat.extend(songs)
    hits=[song for song in flat if any(t in song.lower() for t in favorites)][:10]
    return {'sets':sets[:5],'favoriteSongHits':hits,'url':plain_text(row.get('url'),300),'attribution':'setlist.fm','sourceKind':'api-key'}

# Backwards-compatible helper name retained for companion/runtime contracts.
def _setlist_enrichment(ctx,key,show,favorites):
    return _setlistfm_enrichment(ctx,key,show,favorites)

def _setlist_for_show(ctx,settings,show,favorites):
    source=str(settings.get('setlistSource') or 'auto').lower();key=str(settings.get('setlistApiKey') or '').strip();errors=[]
    providers=[]
    if source in ('auto','jerrybase'): providers.append(('JerryBase',lambda:_jerrybase_setlist(ctx,show,favorites)))
    if source in ('auto','archive'): providers.append(('Internet Archive',lambda:_archive_track_setlist(ctx,show,favorites)))
    if source=='setlistfm' or (source=='auto' and key): providers.append(('setlist.fm',lambda:_setlistfm_enrichment(ctx,key,show,favorites)))
    for name,fn in providers:
        try:
            row=fn()
            if row and row.get('sets'): return row,errors
        except Exception as exc: errors.append(f'{name}: {str(exc)[:60]}')
    return None,errors

def fetch(settings,context):
    today=datetime.datetime.now().astimezone().date();era=str(settings.get('era') or 'all').lower();provider_error=''
    try: shows=_archive_today(context,today)
    except Exception as exc: shows=[];provider_error=str(exc)[:80]
    if not shows: shows=_fallback_today(today)
    filtered=[x for x in shows if _era_ok(x['year'],era)]
    if filtered:shows=filtered
    shows=_order_shows(shows,settings,today)
    limit=_int(settings.get('showLimit'),1,40,12);shows=shows[:limit]
    featured_index=_featured_index(shows,settings,today);favorites=_tokens(settings.get('favoriteSongs'))
    setlists={};setlist_errors=[]
    if _bool(settings.get('setlistsEnabled'),True) and shows:
        preload=min(len(shows),_int(settings.get('setlistPreload'),1,8,3))
        indices=list(range(len(shows)))
        if featured_index>=0: indices=[featured_index]+[i for i in indices if i!=featured_index]
        for idx in indices[:preload]:
            row,errors=_setlist_for_show(context,settings,shows[idx],favorites)
            if row:setlists[shows[idx]['date']]=row
            setlist_errors.extend(errors)
    quotes=_quote_rows(settings,today)
    return {
        'kind':'deadhead','provider':'Internet Archive · Relisten · JerryBase','title':'Today in Dead History','date':today.isoformat(),'monthDay':today.strftime('%B %-d') if hasattr(today,'strftime') else today.isoformat(),
        'shows':shows,'featuredIndex':featured_index,'quotes':quotes,'quote':quotes[0] if quotes else None,'setlists':setlists,'setlist':setlists.get(shows[featured_index]['date']) if shows and featured_index>=0 else None,'setlistErrors':setlist_errors[:6],'providerError':provider_error,
        'era':era,'showMode':str(settings.get('showMode') or 'today'),'showOrder':str(settings.get('showOrder') or 'oldest'),'showBrowser':str(settings.get('showBrowser') or 'year-strip'),'autoRotate':_bool(settings.get('autoRotate'),True),'rotationSeconds':_int(settings.get('rotationSeconds'),15,120,30),
        'quoteRotate':_bool(settings.get('quoteRotate'),True),'quoteSeconds':_int(settings.get('quoteSeconds'),30,300,60),'visualMode':str(settings.get('visualMode') or 'subtle'),'favoriteSongs':favorites,'setlistsEnabled':_bool(settings.get('setlistsEnabled'),True),'setlistSource':str(settings.get('setlistSource') or 'auto'),
        'unofficial':True,'sources':[{'label':'Live recordings','url':'https://archive.org/details/GratefulDead'},{'label':'Relisten','url':'https://relisten.net/grateful-dead'},{'label':'JerryBase setlists','url':'https://jerrybase.com/'},{'label':'The SetList Program','url':'https://www.setlists.net/'}]
    }
