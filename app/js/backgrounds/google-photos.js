// Google Photos shared-album parsing and pagination.

const {serverPath}=LibreDisplayRuntime.getModule('bootstrap');

function decodeGoogleMarkup(text){
  let out=String(text||'');
  for(let i=0;i<3;i++){
    const before=out;
    out=out
      .replace(/\\u003a/gi,':')
      .replace(/\\u003d/gi,'=')
      .replace(/\\u0026/gi,'&')
      .replace(/\\u002f/gi,'/')
      .replace(/\\x3a/gi,':')
      .replace(/\\x3d/gi,'=')
      .replace(/\\x26/gi,'&')
      .replace(/\\x2f/gi,'/')
      .replace(/\\\//g,'/')
      .replace(/&amp;/gi,'&');
    if(out===before)break;
  }
  return out;
}

function googlePhotoSizedUrl(raw){
  let u=decodeGoogleMarkup(raw).trim();
  if(!u)return '';
  u=u.replace(/[\\"'`,;]+$/,'');

  const cut=u.search(/[?#]/);
  let base=cut>=0?u.slice(0,cut):u;
  const tail=cut>=0?u.slice(cut):'';
  base=base
    .replace(/=(?:w\d+(?:-h\d+)?|s\d+)(?:-[a-z0-9-]+)?$/i,'')
    .replace(/=d$/i,'');
  return base+'=w1920-h1080-no'+tail;
}

const GOOGLE_PHOTOS_MAX_ITEMS=1000;

function extractGooglePhotoUrls(html){
  const decoded=decodeGoogleMarkup(html);
  const candidates=[];

  const detailRx=/(https:\/\/(?:lh[3-6]\.googleusercontent\.com|lh3\.ggpht\.com)\/[^\s"'<>\)\]\[,]+)["']?\s*,\s*(\d{2,5})\s*,\s*(\d{2,5})/gi;
  for(const m of decoded.matchAll(detailRx)){
    const w=Number(m[2]), h=Number(m[3]);
    if(w>=500&&h>=300)candidates.push(m[1]);
  }

  if(!candidates.length){
    const broadRx=/https:\/\/(?:lh[3-6]\.googleusercontent\.com|lh3\.ggpht\.com)\/[^\s"'<>\)\]]+/gi;
    for(const m of decoded.matchAll(broadRx))candidates.push(m[0]);
  }

  const seen=new Set();
  const out=[];
  for(const raw of candidates){
    const u=googlePhotoSizedUrl(raw);
    if(!u||seen.has(u))continue;
    seen.add(u);
    out.push(u);
    if(out.length>=GOOGLE_PHOTOS_MAX_ITEMS)break;
  }
  return out;
}

function googleBalancedArrayAt(text,start){
  text=String(text||'');
  if(text[start]!=='[')return '';
  let depth=0,quote='',escaped=false;
  for(let i=start;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='[')depth++;
    else if(ch===']'){
      depth--;
      if(depth===0)return text.slice(start,i+1);
    }
  }
  return '';
}

function googleTopLevelArrayItems(raw){
  raw=String(raw||'').trim();
  if(raw[0]!=='['||raw[raw.length-1]!==']')return [];
  const out=[];
  let start=1,square=0,curly=0,paren=0,quote='',escaped=false;
  for(let i=1;i<raw.length-1;i++){
    const ch=raw[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='[')square++;
    else if(ch===']')square=Math.max(0,square-1);
    else if(ch==='{')curly++;
    else if(ch==='}')curly=Math.max(0,curly-1);
    else if(ch==='(')paren++;
    else if(ch===')')paren=Math.max(0,paren-1);
    else if(ch===','&&!square&&!curly&&!paren){out.push(raw.slice(start,i).trim());start=i+1;}
  }
  out.push(raw.slice(start,-1).trim());
  return out;
}

function googleTokenFromDataArray(raw){
  const parts=googleTopLevelArrayItems(raw);
  if(parts.length<3)return null;
  const m=/^["']([A-Za-z0-9_-]{1,4096})["']$/.exec(parts[2]||'');
  return m?m[1]:null;
}

function extractGoogleInitialPageToken(html){
  const text=String(html||'');
  const callbackRx=/AF_initDataCallback\(/g;
  for(const callback of text.matchAll(callbackRx)){
    const callbackStart=(callback.index||0)+callback[0].length;
    const callbackEnd=text.indexOf(');</scr'+'ipt>',callbackStart);
    const end=callbackEnd>=0?callbackEnd:Math.min(text.length,callbackStart+8*1024*1024);
    const chunk=text.slice(callbackStart,end);
    const dataMatch=/\bdata\s*:\s*/.exec(chunk);
    if(!dataMatch)continue;
    let pos=dataMatch.index+dataMatch[0].length;
    const tail=chunk.slice(pos);
    if(/^function\s*\(/.test(tail)){
      const returnMatch=/\breturn\s*/.exec(tail.slice(0,512));
      if(!returnMatch)continue;
      pos+=returnMatch.index+returnMatch[0].length;
    }
    while(/\s/.test(chunk[pos]||''))pos++;
    if(chunk[pos]!=='['){
      const nextArray=chunk.indexOf('[',pos);
      if(nextArray<0||nextArray-pos>256)continue;
      pos=nextArray;
    }
    const dataArray=googleBalancedArrayAt(chunk,pos);
    if(!dataArray||!dataArray.includes('googleusercontent.com'))continue;
    const token=googleTokenFromDataArray(dataArray);
    if(token)return token;
  }
  return null;
}

function extractGooglePageRequest(html){
  const m=/snAcKc[^}]*?request:\s*\[\s*"([A-Za-z0-9_-]+)"\s*,\s*null\s*,\s*null\s*,\s*"([A-Za-z0-9_-]+)"/s.exec(String(html||''));
  return m?{albumKey:m[1],authKey:m[2]}:null;
}

function extractGooglePhotoUrlsFromData(dataObj){
  const root=dataObj&&Array.isArray(dataObj.data)?dataObj.data:dataObj;
  const out=[],seen=new Set();
  const add=(raw,w=0,h=0)=>{
    if(typeof raw!=='string'||!/^https:\/\/(?:lh[3-6]\.googleusercontent\.com|lh3\.ggpht\.com)\//i.test(raw))return;
    if(w&&h&&(w<300||h<200))return;
    const u=googlePhotoSizedUrl(raw);
    if(u&&!seen.has(u)){seen.add(u);out.push(u);}
  };
  const walk=(node,depth=0)=>{
    if(depth>18||out.length>=GOOGLE_PHOTOS_MAX_ITEMS)return;
    if(Array.isArray(node)){
      if(typeof node[0]==='string'&&Number.isFinite(Number(node[1]))&&Number.isFinite(Number(node[2])))add(node[0],Number(node[1]),Number(node[2]));
      for(const child of node)walk(child,depth+1);
    }else if(node&&typeof node==='object'){for(const child of Object.values(node))walk(child,depth+1);}
  };
  walk(root);
  if(!out.length){
    const broad=JSON.stringify(root||'').match(/https:\/\/(?:lh[3-6]\.googleusercontent\.com|lh3\.ggpht\.com)\/[^\\"'<>\s,\]]+/gi)||[];
    for(const raw of broad){add(raw);if(out.length>=GOOGLE_PHOTOS_MAX_ITEMS)break;}
  }
  return out;
}

function parseGoogleBatchPage(body){
  let text=String(body||'').trimStart();
  if(text.startsWith(")]}'"))text=text.slice(4).trimStart();
  const line=text.split(/\r?\n/).find(x=>x.trimStart().startsWith('[['));
  if(!line)return null;
  try{
    const outer=JSON.parse(line);
    if(!Array.isArray(outer))return null;
    const entry=outer.find(x=>Array.isArray(x)&&x[0]==='wrb.fr'&&x[1]==='snAcKc'&&typeof x[2]==='string');
    if(!entry)return null;
    const data=JSON.parse(entry[2]);
    if(!Array.isArray(data))return null;
    return {data,nextPageToken:typeof data[2]==='string'&&data[2]?data[2]:null};
  }catch(e){
    console.warn('Google Photos pagination response parse failed',e);
    return null;
  }
}

async function fetchGoogleAlbumPage(request,pageToken){
  const q=new URLSearchParams({albumKey:request.albumKey,authKey:request.authKey,pageToken});
  const res=await fetch(serverPath('/gphotos-page?'+q.toString()),{cache:'no-store'});
  LibreDisplayRuntime.getModule('remote').noteCacheResponse('https://photos.google.com/',res);
  if(!res.ok){
    const msg=await res.text().catch(()=>res.statusText);
    throw new Error('Google Photos pagination HTTP '+res.status+(msg?' — '+msg:''));
  }
  const page=parseGoogleBatchPage(await res.text());
  if(!page)throw new Error('Could not parse a Google Photos continuation page');
  return page;
}

async function extractAllGooglePhotoUrls(html){
  const merged=[];
  const seen=new Set();
  const add=(items)=>{
    for(const u of items||[]){
      if(!u||seen.has(u))continue;
      seen.add(u);merged.push(u);
      if(merged.length>=GOOGLE_PHOTOS_MAX_ITEMS)return false;
    }
    return true;
  };
  add(extractGooglePhotoUrls(html));
  if(merged.length>=GOOGLE_PHOTOS_MAX_ITEMS)return {urls:merged,paginated:false,limitReached:true,pages:1};

  let token=extractGoogleInitialPageToken(html);
  if(!token)return {urls:merged,paginated:false,limitReached:false,pages:1};
  const request=extractGooglePageRequest(html);
  if(!request)throw new Error('Google Photos provided another page, but LibreDisplay could not read the pagination request. Reload the album or update LibreDisplay.');

  let pages=1;
  const seenTokens=new Set();
  while(token&&merged.length<GOOGLE_PHOTOS_MAX_ITEMS){
    if(seenTokens.has(token))throw new Error('Google Photos returned a repeated continuation token');
    seenTokens.add(token);
    const page=await fetchGoogleAlbumPage(request,token);
    pages++;
    add(extractGooglePhotoUrlsFromData(page.data));
    token=page.nextPageToken;
  }
  return {urls:merged,paginated:pages>1,limitReached:merged.length>=GOOGLE_PHOTOS_MAX_ITEMS,pages};
}


LibreDisplayRuntime.exposeModule("backgrounds", {decodeGoogleMarkup,googlePhotoSizedUrl,extractGooglePhotoUrls,googleBalancedArrayAt,googleTopLevelArrayItems,googleTokenFromDataArray,extractGoogleInitialPageToken,extractGooglePageRequest,extractGooglePhotoUrlsFromData,parseGoogleBatchPage,fetchGoogleAlbumPage,extractAllGooglePhotoUrls}, {
  "GOOGLE_PHOTOS_MAX_ITEMS": {configurable:true,get:()=>GOOGLE_PHOTOS_MAX_ITEMS}
}, {globals:false});
