import datetime
import hashlib
import re
from urllib.parse import quote, urlencode
from _shared import request_json, plain_text

MANIFEST={
    "apiVersion":1,
    "id":"grateful-dead",
    "name":"Deadhead · Grateful Dead",
    "description":"Unofficial fan integration for Today in Dead History, listening suggestions, sourced member quotes, and optional setlist.fm enrichment.",
    "version":"1.0",
    "icon":"✺",
    "refreshMin":30,
    "kind":"data",
    "category":"Media",
    "settings":[
        {"key":"era","label":"Favorite era","type":"select","default":"all","options":[{"value":"all","label":"All years"},{"value":"60s","label":"1960s"},{"value":"70s","label":"1970s"},{"value":"80s","label":"1980s"},{"value":"90s","label":"1990s"}]},
        {"key":"showMode","label":"Show of the day","type":"select","default":"today","options":[{"value":"today","label":"Today in Dead history"},{"value":"favorites","label":"Prefer favorite venues"},{"value":"surprise","label":"Surprise me"}]},
        {"key":"favoriteVenues","label":"Favorite venues","type":"textarea","default":"","help":"Optional comma-separated venue or city names. Favorite mode promotes matching shows."},
        {"key":"favoriteSongs","label":"Favorite songs","type":"textarea","default":"","help":"Optional comma-separated titles. When setlist.fm enrichment is enabled, matching songs are highlighted."},
        {"key":"quoteMember","label":"Quote member","type":"select","default":"all","options":[{"value":"all","label":"Rotate all members"},{"value":"jerry","label":"Jerry Garcia"},{"value":"bob","label":"Bob Weir"},{"value":"phil","label":"Phil Lesh"},{"value":"mickey","label":"Mickey Hart"},{"value":"bill","label":"Bill Kreutzmann"}]},
        {"key":"customQuotes","label":"Personal quote pack","type":"textarea","default":"","help":"Optional lines: Member | Quote | Source URL. Keep quotes short and provide a source."},
        {"key":"visualMode","label":"Deadhead visual treatment","type":"select","default":"subtle","options":[{"value":"off","label":"Block only"},{"value":"subtle","label":"Subtle psychedelic accents"},{"value":"psychedelic","label":"Full Deadhead color wash"}]},
        {"key":"setlistApiKey","label":"setlist.fm API key","type":"password","required":False,"help":"Optional. Enriches the featured historical show with set names and song titles. Data is attributed to setlist.fm."}
    ]
}

QUOTES=[
    {"key":"jerry","member":"Jerry Garcia","quote":"All it takes to create another reality is for people to live in it.","source":"Grateful Dead Deadcast · Europe '72: Denmark","url":"https://www.dead.net/deadcast/europe-72-denmark"},
    {"key":"bob","member":"Bob Weir","quote":"We've always been pretty free to do the things we want.","source":"November 1972 interview","url":"https://deadsources.blogspot.com/2022/09/november-1972-bob-weir-interview.html"},
    {"key":"phil","member":"Phil Lesh","quote":"Somehow the music would make us act in unison.","source":"Spring 1971 interview","url":"https://deadsources.blogspot.com/2013/12/spring-1971-phil-lesh-interview.html"},
    {"key":"mickey","member":"Mickey Hart","quote":"I like to create things from nothing, to make things happen.","source":"PBS NewsHour · CANVAS","url":"https://www.pbs.org/newshour/show/grateful-dead-drummer-mickey-hart-combines-music-and-art-at-the-las-vegas-sphere"},
    {"key":"bill","member":"Bill Kreutzmann","quote":"Even with the older material, you're always creating new music in the moment.","source":"Grateful Dead interview","url":"https://www.dead.net/features/dead-world-roundup/talkin-about-music-laughter-and-life-bill-kreutzmann"}
]

def _tokens(value):
    return [x.strip().lower() for x in re.split(r'[,;\n]+',str(value or '')) if x.strip()][:40]

def _era_ok(year, era):
    if era=='all': return True
    try: decade=int(str(era)[:2])*10+1900
    except Exception: return True
    return decade<=int(year)<decade+10

def _show_date(value):
    text=str(value or '')[:32]
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
    params=[('q',query),('fl[]','identifier'),('fl[]','title'),('fl[]','date'),('fl[]','venue'),('fl[]','coverage'),('rows','160'),('page','1'),('output','json')]
    url='https://archive.org/advancedsearch.php?'+urlencode(params)
    data,_,_=request_json(ctx,url,max_bytes=2*1024*1024)
    docs=(data.get('response') or {}).get('docs') or []
    shows={}
    for doc in docs:
        date=_show_date(doc.get('date') or doc.get('title') or doc.get('identifier'))
        if not date or date[5:]!=today.strftime('%m-%d'): continue
        year=int(date[:4]); identifier=plain_text(doc.get('identifier') or '',180)
        if not identifier: continue
        venue,coverage,title=_venue_from_doc(doc)
        row=shows.setdefault(date,{"date":date,"year":year,"venue":venue or 'Venue unavailable',"location":coverage,"title":title,"archiveUrl":f'https://archive.org/details/{quote(identifier)}',"relistenUrl":f'https://relisten.net/grateful-dead/{date[:4]}/{date[5:7]}/{date[8:10]}',"recordings":0})
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
    for date,venue,location in known.get(today.strftime('%m-%d'),[]): rows.append({"date":date,"year":int(date[:4]),"venue":venue,"location":location,"title":"","archiveUrl":"https://archive.org/details/GratefulDead","relistenUrl":f'https://relisten.net/grateful-dead/{date[:4]}/{date[5:7]}/{date[8:10]}',"recordings":0,"fallback":True})
    return rows

def _custom_quotes(value):
    out=[]
    for line in str(value or '').splitlines()[:30]:
        parts=[x.strip() for x in line.split('|',2)]
        if len(parts)<2 or not parts[0] or not parts[1]: continue
        url=parts[2] if len(parts)>2 and re.match(r'^https?://',parts[2],re.I) else ''
        out.append({"key":"custom","member":plain_text(parts[0],60),"quote":plain_text(parts[1],220),"source":"Personal quote pack","url":url})
    return out

def _pick_quote(settings,today):
    rows=QUOTES+_custom_quotes(settings.get('customQuotes'))
    member=str(settings.get('quoteMember') or 'all').lower()
    if member!='all': rows=[x for x in rows if x.get('key')==member] or rows
    digest=int(hashlib.sha256((today.isoformat()+member).encode()).hexdigest()[:10],16)
    return rows[digest%len(rows)] if rows else None

def _featured_index(shows,settings,today):
    if not shows:return -1
    mode=str(settings.get('showMode') or 'today')
    favorites=_tokens(settings.get('favoriteVenues'))
    if mode=='favorites' and favorites:
        ranked=sorted(enumerate(shows),key=lambda pair:(-sum(1 for t in favorites if t in f"{pair[1].get('venue','')} {pair[1].get('location','')}".lower()),pair[1]['year']))
        if ranked and any(t in f"{ranked[0][1].get('venue','')} {ranked[0][1].get('location','')}".lower() for t in favorites):return ranked[0][0]
    seed=today.isoformat()+mode+str(settings.get('era') or 'all')
    return int(hashlib.sha256(seed.encode()).hexdigest()[:10],16)%len(shows)

def _setlist_enrichment(ctx,key,show,favorites):
    if not key or not show:return None
    date=datetime.date.fromisoformat(show['date']).strftime('%d-%m-%Y')
    url='https://api.setlist.fm/rest/1.0/search/setlists?'+urlencode({'artistName':'Grateful Dead','date':date,'p':1})
    data,_,_=request_json(ctx,url,headers={'Accept':'application/json','x-api-key':str(key).strip(),'User-Agent':'LibreDisplay integration'})
    rows=data.get('setlist') or []
    if not rows:return None
    row=rows[0]; sets=[]; flat=[]
    for group in (row.get('sets') or {}).get('set') or []:
        songs=[plain_text(x.get('name'),100) for x in group.get('song') or [] if plain_text(x.get('name'),100)]
        if songs: sets.append({'name':plain_text(group.get('name') or ('Encore' if group.get('encore') else 'Set'),40),'songs':songs[:30]});flat.extend(songs)
    favorite_hits=[song for song in flat if any(t in song.lower() for t in favorites)][:8]
    return {'sets':sets[:5],'favoriteSongHits':favorite_hits,'url':plain_text(row.get('url'),300),'attribution':'setlist.fm'}

def fetch(settings,context):
    today=datetime.datetime.now().astimezone().date();era=str(settings.get('era') or 'all').lower()
    provider_error=''
    try: shows=_archive_today(context,today)
    except Exception as exc: shows=[];provider_error=str(exc)[:80]
    if not shows: shows=_fallback_today(today)
    shows=[x for x in shows if _era_ok(x['year'],era)] or shows
    featured_index=_featured_index(shows,settings,today);featured=shows[featured_index] if featured_index>=0 else None
    setlist=None;setlist_error='';api_key=str(settings.get('setlistApiKey') or '').strip()
    if api_key and featured:
        try:setlist=_setlist_enrichment(context,api_key,featured,_tokens(settings.get('favoriteSongs')))
        except Exception as exc:setlist_error=str(exc)[:80]
    return {
        'kind':'deadhead','provider':'Internet Archive · Relisten','title':'Today in Dead History','date':today.isoformat(),'monthDay':today.strftime('%B %-d') if hasattr(today,'strftime') else today.isoformat(),
        'shows':shows[:40],'featuredIndex':featured_index,'quote':_pick_quote(settings,today),'setlist':setlist,'setlistError':setlist_error,'providerError':provider_error,
        'era':era,'showMode':str(settings.get('showMode') or 'today'),'visualMode':str(settings.get('visualMode') or 'subtle'),'favoriteSongs':_tokens(settings.get('favoriteSongs')),
        'unofficial':True,'sources':[{'label':'Live recordings','url':'https://archive.org/details/GratefulDead'},{'label':'Relisten','url':'https://relisten.net/grateful-dead'}]
    }
