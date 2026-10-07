(function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeUrl=value=>/^https?:\/\//i.test(String(value||''))?String(value):'';
  const stableHash=value=>{let h=2166136261;for(const ch of String(value||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  const states=new WeakMap();
  const allowedSections=['browser','navigation','show','weather','setlist','quote','footer'];
  const num=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
  const enabled=(d,key,fallback=true)=>d?.[key]===undefined?fallback:d[key]!==false;
  const rgba=(hex,alpha)=>{const m=/^#([0-9a-f]{6})$/i.exec(String(hex||''));if(!m)return `rgba(255,255,255,${alpha})`;const n=parseInt(m[1],16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;};
  const sectionOrder=value=>{const requested=String(value||'').toLowerCase().split(/[,\n]+/).map(x=>x.trim()).filter(x=>allowedSections.includes(x)),seen=new Set(),order=[];for(const key of [...requested,...allowedSections])if(!seen.has(key)){seen.add(key);order.push(key);}return order;};
  const modeRank={off:0,subtle:1,psychedelic:2};
  const syncGlobalMode=()=>{let selected='off',strength=0;for(const panel of document.querySelectorAll('.deadhead-panel')){const mode=panel.dataset.visualMode||'off',value=num(panel.dataset.backgroundStrength,0,100,100);if(modeRank[mode]>modeRank[selected]||(mode===selected&&value>strength)){selected=mode;strength=value;}}document.body.classList.toggle('ld-deadhead-subtle',selected==='subtle');document.body.classList.toggle('ld-deadhead-psychedelic',selected==='psychedelic');document.body.style.setProperty('--ld-deadhead-bg-strength',String(strength/100));};
  new MutationObserver(()=>queueMicrotask(syncGlobalMode)).observe(document.body,{childList:true,subtree:true});

  const defaultWeatherSongs={clear:'Here Comes Sunshine',rain:'Looks Like Rain',snow:'Cold Rain and Snow',storm:'The Wheel',fog:'Box of Rain',fallback:'Eyes of the World'};
  const weatherSong=d=>{const fallback=d.weatherFallbackSong||defaultWeatherSongs.fallback;try{const code=Number(LibreDisplayRuntime.getModule('config')?.wxData?.current?.weather_code);if([51,53,55,61,63,65,80,81,82].includes(code))return d.weatherRainSong||defaultWeatherSongs.rain;if([71,73,75,77,85,86].includes(code))return d.weatherSnowSong||defaultWeatherSongs.snow;if([95,96,99].includes(code))return d.weatherStormSong||defaultWeatherSongs.storm;if(code===0)return d.weatherClearSong||defaultWeatherSongs.clear;if([45,48].includes(code))return d.weatherFogSong||defaultWeatherSongs.fog;return fallback;}catch{return fallback;}};
  const showWhere=(show,d)=>[enabled(d,'showVenue')?show?.venue:'',enabled(d,'showLocation')?show?.location:''].filter(Boolean).join(' · ');
  const sourceLink=(url,label)=>safeUrl(url)?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`:'';
  const formatShowDate=(value,style)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));if(!m)return String(value||'');if(style==='year')return m[1];if(style==='long'){const date=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));return date.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});}return value;};
  const sourceLinks=(show,d)=>{if(!enabled(d,'showSourceLinks'))return '';const factories={archive:()=>enabled(d,'showArchiveLink')?sourceLink(show?.archiveUrl,d.archiveLabel||'Internet Archive'):'',relisten:()=>enabled(d,'showRelistenLink')?sourceLink(show?.relistenUrl,d.relistenLabel||'Listen on Relisten'):'',jerrybase:()=>enabled(d,'showJerryBaseLink')?sourceLink(show?.jerrybaseUrl,d.jerrybaseLabel||'JerryBase'):''},allowed=['archive','relisten','jerrybase'],requested=String(d.sourceLinkOrder||'archive,relisten,jerrybase').toLowerCase().split(',').map(x=>x.trim()).filter(x=>allowed.includes(x)),order=[],seen=new Set();for(const key of [...requested,...allowed])if(!seen.has(key)){seen.add(key);order.push(key);}return order.map(key=>factories[key]()).filter(Boolean).join('');};
  const renderShow=(show,index,total,d)=>{if(!enabled(d,'showShowDetails'))return '';if(!show)return '<div class="deadhead-section deadhead-empty">No historical show was found for this date and era.</div>';const where=showWhere(show,d),links=sourceLinks(show,d),top=[];if(enabled(d,'showShowCounter'))top.push(`<span class="deadhead-show-kicker">Show ${index+1} of ${total}</span>`);if(enabled(d,'showRecordingCount'))top.push(`<span class="deadhead-recordings">${Number(show.recordings)||0} recording${Number(show.recordings)===1?'':'s'}</span>`);return `<section class="deadhead-section deadhead-show" data-show-index="${index}">${top.length?`<div class="deadhead-show-topline">${top.join('')}</div>`:''}${enabled(d,'showDate')?`<div class="deadhead-show-date">${esc(formatShowDate(show.date,d.dateStyle||'iso'))}</div>`:''}${where?`<div class="deadhead-show-venue">${esc(where)}</div>`:''}${links?`<div class="deadhead-show-actions">${links}</div>`:''}</section>`;};
  const renderSetlist=(data,show,d,state)=>{if(!enabled(d,'setlistsEnabled'))return '';const date=String(show?.date||''),row=data?.setlists?.[date]||null,heading=esc(d.setlistHeading||'Setlist'),showSource=enabled(d,'setlistShowSource'),maxHeight=num(d.setlistMaxHeight,0,600,100);if(!row?.sets?.length){if(!enabled(d,'setlistShowMissing'))return '';const pending=state?.setlistPending?.has(date),retrying=state?.setlistRetrying?.has(date),unavailable=state?.setlistUnavailable?.has(date),smart=enabled(d,'setlistSmartLoad',true),url=showSource?safeUrl(show?.jerrybaseUrl):'',message=pending?'Finding setlist · JerryBase → Relisten → Internet Archive…':(retrying?'Setlist lookup was delayed · retrying automatically…':(unavailable?'No setlist was found in JerryBase, Relisten, or Internet Archive.':(smart?'Setlist lookup queued…':'Setlist was not preloaded for this show.')));return `<section class="deadhead-section deadhead-setlist deadhead-setlist-missing"><div class="deadhead-mini-title deadhead-setlist-heading">${heading}</div><div class="deadhead-setlist-note">${esc(message)}${unavailable&&url?` · <a href="${esc(url)}" target="_blank" rel="noopener">Check JerryBase</a>`:''}</div></section>`;}const maxSets=Math.round(num(d.setlistMaxSets,1,8,5)),songLimit=Math.round(num(d.setlistSongsPerSet,3,35,35)),hits=new Set((row.favoriteSongHits||[]).map(x=>String(x).toLowerCase())),sets=row.sets.slice(0,maxSets).map(group=>`<div class="deadhead-set"><b>${esc(group.name||'Set')}</b><span>${(group.songs||[]).slice(0,songLimit).map(song=>`<span class="${enabled(d,'setlistHighlightFavorites')&&hits.has(String(song).toLowerCase())?'deadhead-favorite-song-inline':''}">${esc(song)}</span>`).join('<span class="deadhead-song-sep"> · </span>')}</span></div>`).join(''),favorites=enabled(d,'setlistShowFavoriteHits')?(row.favoriteSongHits||[]).map(x=>`<span class="deadhead-favorite-song">${esc(x)}</span>`).join(''):'',url=showSource?safeUrl(row.url):'',source=showSource?` · ${esc(row.attribution||'source')}${url?` · <a href="${esc(url)}" target="_blank" rel="noopener">open source</a>`:''}`:'';return `<section class="deadhead-section deadhead-setlist${maxHeight===0?' deadhead-setlist-unlimited':''}" style="--dead-setlist-max:${Math.round(maxHeight)}px"><div class="deadhead-mini-title deadhead-setlist-heading">${heading}${source}</div><div class="deadhead-setlist-scroll"><div class="deadhead-reel-track deadhead-setlist-track"><div class="deadhead-setlist-body">${sets}</div>${favorites?`<div class="deadhead-favorites">Favorites in this show: ${favorites}</div>`:''}</div></div></section>`;};
  const renderQuote=(quote,d)=>{if(!enabled(d,'quotesEnabled')||!quote)return '';const spotlight=quote.kind==='spotlight',member=enabled(d,'quoteShowMember')?esc(quote.member):'',url=enabled(d,'quoteShowSource')?safeUrl(quote.url):'',source=url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(quote.source||'Source')}</a>`:(enabled(d,'quoteShowSource')?esc(quote.source||''):'');const attribution=[member,source].filter(Boolean).join(' · '),marks=!spotlight&&enabled(d,'quoteShowMarks'),text=`${spotlight?'♫ ':''}${marks?'“':''}${esc(quote.quote)}${marks?'”':''}`;return `<figure class="deadhead-section deadhead-quote deadhead-quote-${esc(d.quoteStyle||'card')} ${spotlight?'deadhead-song-spotlight':''}"><blockquote>${text}</blockquote>${attribution?`<figcaption>${spotlight?'':'— '}${attribution}</figcaption>`:''}</figure>`;};
  const yearStrip=(shows,current,d)=>`<div class="deadhead-section deadhead-year-strip" role="list" aria-label="Shows played on this date"><div class="deadhead-reel-track deadhead-browser-track">${shows.map((show,i)=>`<button type="button" class="deadhead-year${i===current?' active':''}" data-dead-show="${i}" title="${esc([show?.venue,show?.location].filter(Boolean).join(' · '))}">${esc(show.year||show.date?.slice(0,4)||'?')}</button>`).join('')}</div></div>`;
  const compactList=(shows,current,d)=>`<div class="deadhead-section deadhead-show-list" role="list"><div class="deadhead-reel-track deadhead-browser-track">${shows.map((show,i)=>{const venue=enabled(d,'browserShowVenue')?show.venue||'Unknown venue':'',location=enabled(d,'browserShowLocation')?show.location||'':'';return `<button type="button" class="deadhead-show-row${i===current?' active':''}" data-dead-show="${i}"><b>${esc(show.year||'')}</b>${venue?`<span>${esc(venue)}</span>`:''}${location?`<small>${esc(location)}</small>`:''}</button>`;}).join('')}</div></div>`;
  const renderBrowser=(d,shows,current)=>!enabled(d,'showBrowserEnabled')||d.showBrowser==='minimal'?'':d.showBrowser==='list'?compactList(shows,current,d):yearStrip(shows,current,d);
  const renderNavigation=(d,current,total)=>enabled(d,'showNavigation')?`<div class="deadhead-section deadhead-nav deadhead-nav-${esc(d.navigationStyle||'pills')}"><button type="button" class="deadhead-prev" ${total<2?'disabled':''} aria-label="Previous historical show">‹</button>${enabled(d,'showPosition')?`<span class="deadhead-nav-position">${total?`${current+1} / ${total}`:'0 / 0'}</span>`:''}<button type="button" class="deadhead-next" ${total<2?'disabled':''} aria-label="Next historical show">›</button></div>`:'';
  const renderWeather=d=>enabled(d,'showWeatherPick')?`<div class="deadhead-section deadhead-listen-prompt">${esc(d.weatherLabel||'Weather pick')} · <b>${esc(weatherSong(d))}</b></div>`:'';
  const renderFooter=(data,d,total)=>{if(!enabled(d,'showFooter'))return '';const meta=[];if(enabled(d,'showRotationStatus'))meta.push(`<span>${data?.autoRotate!==false?'Auto-rotating':'Manual browsing'}</span>`);if(enabled(d,'showSetlistStatus')){const count=Object.keys(data?.setlists||{}).length;meta.push(`<span>${count} setlist${count===1?'':'s'} loaded</span>`);}const button=enabled(d,'showListenButton')?`<button class="deadhead-another" type="button" ${total<2?'disabled':''}>${esc(d.listenButtonLabel||'What should I listen to?')}</button>`:'';if(!button&&!meta.length)return '';return `<footer class="deadhead-section deadhead-footer">${button}<div class="deadhead-footer-meta">${meta.join('')}</div></footer>`;};
  const nextIndex=(current,total,delta=1)=>total?((current+delta+total)%total):0;
  const jumpIndex=(current,shows,behavior)=>{if(!shows.length)return 0;if(behavior==='next')return nextIndex(current,shows.length,1);if(behavior==='oldest'){let best=0;for(let i=1;i<shows.length;i++)if(Number(shows[i]?.year)<Number(shows[best]?.year))best=i;return best;}if(behavior==='newest'){let best=0;for(let i=1;i<shows.length;i++)if(Number(shows[i]?.year)>Number(shows[best]?.year))best=i;return best;}if(shows.length<2)return current;let value=(Date.now()+(current+1)*2654435761)>>>0;const step=1+(value%(shows.length-1));return (current+step)%shows.length;};
  const headerHtml=(data,d,shows)=>{if(!enabled(d,'showHeader'))return '';const custom=String(d.headerSubtitle||'').trim(),parts=[];if(custom)parts.push(custom);else{if(enabled(d,'showHeaderDate'))parts.push(data?.monthDay||data?.date||'');if(enabled(d,'showHeaderShowCount'))parts.push(`${shows.length} show${shows.length===1?'':'s'} in rotation`);}if(enabled(d,'showUnofficialLabel'))parts.push('unofficial fan integration');return `<header class="deadhead-header">${enabled(d,'showHeaderIcon')?`<span class="deadhead-mark">${esc(d.headerIcon||'✺')}</span>`:''}<div class="deadhead-header-copy"><b>${esc(d.headerTitle||'Today in Dead History')}</b>${enabled(d,'showHeaderSubtitle')&&parts.filter(Boolean).length?`<small>${parts.filter(Boolean).map(esc).join(' · ')}</small>`:''}</div></header>`;};
  const applyPanelStyle=(panel,d)=>{const accent=d.accentColor||'#e5c782',accent2=d.accentColor2||'#8ed9ca',strength=num(d.accentStrength,0,100,100)/100;panel.style.setProperty('--dead-accent',accent);panel.style.setProperty('--dead-accent2',accent2);panel.style.setProperty('--dead-accent-soft',rgba(accent,.10*strength));panel.style.setProperty('--dead-accent-mid',rgba(accent,.25*strength));panel.style.setProperty('--dead-accent-strong',rgba(accent,.62*strength));panel.style.setProperty('--dead-accent2-soft',rgba(accent2,.12*strength));panel.style.setProperty('--dead-panel',d.panelColor||'#171526');panel.style.setProperty('--dead-text',d.textColor||'#f8f2e7');panel.style.setProperty('--dead-muted',d.mutedColor||'#bdb7c5');panel.style.setProperty('--dead-radius',`${Math.round(num(d.panelRadius,0,48,18))}px`);panel.style.setProperty('--dead-pad',`${Math.round(num(d.panelPadding,6,48,16))}px`);panel.style.setProperty('--dead-gap',`${Math.round(num(d.sectionGap,0,32,9))}px`);panel.style.setProperty('--dead-title-scale',String(num(d.titleScale,70,180,100)/100));panel.style.setProperty('--dead-body-scale',String(num(d.bodyScale,70,160,100)/100));const browserMax=Math.round(num(d.browserMaxHeight,0,400,118));panel.style.setProperty('--dead-browser-max',browserMax===0?'none':`${browserMax}px`);};

  const scrollPosition=(el,axis)=>axis==='x'?el.scrollLeft:el.scrollTop;
  const setScrollPosition=(el,axis,value)=>{if(axis==='x')el.scrollLeft=value;else el.scrollTop=value;};
  const scrollMax=(el,axis)=>axis==='x'?Math.max(0,el.scrollWidth-el.clientWidth):Math.max(0,el.scrollHeight-el.clientHeight);
  const clearAutoScrollers=state=>{if(state?.autoScrollRaf){cancelAnimationFrame(state.autoScrollRaf);state.autoScrollRaf=0;}for(const stop of state.autoScrollers||[])try{stop();}catch{}state.autoScrollers=[];};
  const snapshotScroll=(target,state)=>{const browser=target.querySelector('.deadhead-show-list,.deadhead-year-strip'),setlist=target.querySelector('.deadhead-setlist-scroll');if(browser)state.browserScroll={top:browser.scrollTop,left:browser.scrollLeft};if(setlist)state.setlistScroll={top:setlist.scrollTop,left:setlist.scrollLeft,showKey:state.lastShowKey||''};};
  const restoreScroll=(target,state,showKey)=>{const browser=target.querySelector('.deadhead-show-list,.deadhead-year-strip'),setlist=target.querySelector('.deadhead-setlist-scroll');if(browser&&state.browserScroll){browser.scrollTop=state.browserScroll.top||0;browser.scrollLeft=state.browserScroll.left||0;}if(setlist&&state.setlistScroll?.showKey===showKey){setlist.scrollTop=state.setlistScroll.top||0;setlist.scrollLeft=state.setlistScroll.left||0;}};
  const autoScrollOptions=(d,prefix,defaults)=>({
    active:enabled(d,`${prefix}AutoScroll`,true),
    speed:num(d[`${prefix}ScrollSpeed`],0.5,240,defaults.speed),
    startDelay:num(d[`${prefix}ScrollStartDelay`],0,120,defaults.startDelay)*1000,
    loopPause:num(d[`${prefix}ScrollLoopPause`],0,180,defaults.loopPause)*1000,
    loopMode:['continuous','restart','bounce','once'].includes(d[`${prefix}ScrollLoopMode`])?d[`${prefix}ScrollLoopMode`]:defaults.loopMode,
    pauseOnHover:enabled(d,`${prefix}ScrollPauseOnHover`,true),
    showScrollbar:enabled(d,`${prefix}ShowScrollbar`,false)
  });
  const reelPaused=(el,options,state)=>document.hidden||(options.pauseOnHover&&(typeof el.matches==='function'?el.matches(':hover'):state.hovered));
  const reelTrack=el=>el?.querySelector?.(':scope > .deadhead-reel-track')||el;
  const reelContentExtent=(el,axis)=>{const track=reelTrack(el);return axis==='x'?Math.max(track?.scrollWidth||0,track?.offsetWidth||0):Math.max(track?.scrollHeight||0,track?.offsetHeight||0);};
  const reelOverflows=(el,axis)=>reelContentExtent(el,axis)>(axis==='x'?el.clientWidth:el.clientHeight)+2;
  const startContinuousScroller=(el,axis,options,state,key)=>{
    const track=reelTrack(el),originals=[...(track?.children||[])].filter(node=>!node.classList?.contains('deadhead-reel-clone'));
    if(!track||!originals.length||!reelOverflows(el,axis))return ()=>{};
    const clones=[];
    for(const node of originals){const clone=node.cloneNode(true);clone.classList?.add('deadhead-reel-clone');clone.setAttribute?.('aria-hidden','true');clone.setAttribute?.('data-ld-layout-clone','1');clone.querySelectorAll?.('[data-dead-show]').forEach(x=>x.removeAttribute('data-dead-show'));clone.removeAttribute?.('data-dead-show');clone.querySelectorAll?.('a,button,input,select,textarea,[tabindex]').forEach(x=>x.setAttribute('tabindex','-1'));clones.push(clone);track.appendChild(clone);}
    const firstOriginal=originals[0],firstClone=clones[0],offset=node=>axis==='x'?node.offsetLeft:node.offsetTop;
    const loopExtent=Math.max(0,(firstClone&&firstOriginal)?offset(firstClone)-offset(firstOriginal):0);
    if(loopExtent<=2){for(const clone of clones)clone.remove();return ()=>{};}
    state.reelPositions=state.reelPositions||{};state.reelStarted=state.reelStarted||{};
    let frame=0,stopped=false,last=0,position=Number(state.reelPositions[key])||0,phaseUntil=performance.now()+(state.reelStarted[key]?0:options.startDelay);
    position=((position%loopExtent)+loopExtent)%loopExtent;state.reelStarted[key]=true;
    el.scrollTop=0;el.scrollLeft=0;const trackStyle=track.style||{};trackStyle.willChange='transform';trackStyle.transform=axis==='x'?`translate3d(${-position}px,0,0)`:`translate3d(0,${-position}px,0)`;el.classList.add('deadhead-autoscroll-active');
    const tick=now=>{
      if(stopped||!el.isConnected)return;
      if(!reelOverflows(el,axis)){last=now;frame=requestAnimationFrame(tick);return;}
      if(reelPaused(el,options,state)){last=now;frame=requestAnimationFrame(tick);return;}
      if(now<phaseUntil){last=now;frame=requestAnimationFrame(tick);return;}
      const dt=last?Math.min(80,now-last):0;last=now;position+=options.speed*dt/1000;
      while(position>=loopExtent)position-=loopExtent;
      state.reelPositions[key]=position;trackStyle.transform=axis==='x'?`translate3d(${-position}px,0,0)`:`translate3d(0,${-position}px,0)`;frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>{stopped=true;if(frame)cancelAnimationFrame(frame);state.reelPositions[key]=position;trackStyle.transform='';trackStyle.willChange='';for(const clone of clones)clone.remove();el.classList.remove('deadhead-autoscroll-active');};
  };
  const startAutoScroller=(el,axis,options,state,key='reel')=>{
    if(!el)return ()=>{};
    el.classList.toggle('deadhead-hide-scrollbar',!options.showScrollbar);
    if(!options.active)return ()=>{};
    if(options.loopMode==='continuous')return startContinuousScroller(el,axis,options,state,key);
    // Keep a floating-point accumulator independent of scrollTop/scrollLeft. Chromium can
    // quantize very small per-frame writes on low-power displays; re-reading that rounded
    // value each frame made slow speed settings appear identical or completely stalled.
    let frame=0,stopped=false,last=0,phase='start',phaseUntil=performance.now()+options.startDelay,direction=1,position=scrollPosition(el,axis);
    const write=value=>{position=Math.max(0,Math.min(scrollMax(el,axis),value));setScrollPosition(el,axis,position);};
    const tick=now=>{
      if(stopped||!el.isConnected)return;
      const max=scrollMax(el,axis);
      el.classList.toggle('deadhead-autoscroll-active',max>2);
      if(max<=2){position=0;last=now;frame=requestAnimationFrame(tick);return;}
      if(reelPaused(el,options,state)){position=Math.max(0,Math.min(max,scrollPosition(el,axis)));last=now;frame=requestAnimationFrame(tick);return;}
      if(now<phaseUntil){position=Math.max(0,Math.min(max,scrollPosition(el,axis)));last=now;frame=requestAnimationFrame(tick);return;}
      if(phase==='end'){
        if(options.loopMode==='once'){write(max);return;}
        if(options.loopMode==='bounce'){direction*=-1;phase='move';last=now;position=scrollPosition(el,axis);}
        else{write(0);direction=1;phase='start';phaseUntil=now+options.startDelay;last=now;}
        frame=requestAnimationFrame(tick);return;
      }
      phase='move';
      const dt=last?Math.min(64,now-last):0;last=now;
      const next=position+(options.speed*dt/1000*direction);
      if(direction>0&&next>=max-0.001){write(max);phase='end';phaseUntil=now+options.loopPause;}
      else if(direction<0&&next<=0.001){write(0);phase='end';phaseUntil=now+options.loopPause;}
      else write(next);
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>{stopped=true;if(frame)cancelAnimationFrame(frame);};
  };
  const setupAutoScrollers=(target,d,state)=>{
    clearAutoScrollers(state);
    const browser=target.querySelector('.deadhead-show-list,.deadhead-year-strip');
    if(browser){const axis=browser.classList.contains('deadhead-year-strip')?'x':'y';state.autoScrollers.push(startAutoScroller(browser,axis,autoScrollOptions(d,'browser',{speed:18,startDelay:3,loopPause:4,loopMode:'continuous'}),state,'browser'));}
    const setlist=target.querySelector('.deadhead-setlist:not(.deadhead-setlist-missing):not(.deadhead-setlist-unlimited) .deadhead-setlist-scroll');
    if(setlist)state.autoScrollers.push(startAutoScroller(setlist,'y',autoScrollOptions(d,'setlist',{speed:14,startDelay:4,loopPause:5,loopMode:'continuous'}),state,'setlist:'+String(state.lastShowKey||'')));
  };
  const scheduleAutoScrollers=(target,d,state)=>{if(state.autoScrollRaf)cancelAnimationFrame(state.autoScrollRaf);state.autoScrollRaf=requestAnimationFrame(()=>{state.autoScrollRaf=requestAnimationFrame(()=>{state.autoScrollRaf=0;if(target.isConnected)setupAutoScrollers(target,d,state);});});};

  window.LibreDisplayIntegrationRenderers=window.LibreDisplayIntegrationRenderers||{};
  window.LibreDisplayIntegrationRenderers['grateful-dead']=(target,data,block)=>{
    if(!target)return;
    const previous=states.get(target);if(previous?.showTimer)clearInterval(previous.showTimer);if(previous?.quoteTimer)clearInterval(previous.quoteTimer);if(previous?.resizeObserver)previous.resizeObserver.disconnect();for(const timer of previous?.setlistRetryTimers||[])clearTimeout(timer);if(previous)clearAutoScrollers(previous);
    data=data&&typeof data==='object'?data:{};const d=data?.display||data||{},shows=Array.isArray(data?.shows)?data.shows:[],quotes=Array.isArray(data?.quotes)&&data.quotes.length?data.quotes:(data?.quote?[data.quote]:[]),initial=Math.max(0,Math.min(Math.max(0,shows.length-1),Number(data?.featuredIndex)||0));
    data.setlists=data?.setlists&&typeof data.setlists==='object'?data.setlists:{};
    const quoteSeconds=Math.max(30,Number(data?.quoteSeconds)||60),quoteSlot=Math.floor(Date.now()/(quoteSeconds*1000)),quoteSeed=stableHash(`${block?.id||'deadhead'}|${data?.date||''}|${data?.quoteOrder||d.quoteOrder||'daily-shuffle'}`),initialQuote=quotes.length?(quoteSeed+quoteSlot)%quotes.length:0;
    const state={current:initial,quoteIndex:initialQuote,showTimer:0,quoteTimer:0,hovered:false,autoScrollers:[],autoScrollRaf:0,browserScroll:null,setlistScroll:null,lastShowKey:'',reelPositions:{},reelStarted:{},setlistPending:new Set(),setlistRetrying:new Set(),setlistUnavailable:new Set(),setlistQueue:[],setlistWorker:false,setlistRetryTimers:[],resizeObserver:null};states.set(target,state);
    let draw=()=>{};
    const queueSetlist=(index,priority=false)=>{if(!enabled(d,'setlistSmartLoad',true)||!enabled(d,'setlistsEnabled')||!block?.id||!shows.length)return;index=(index+shows.length)%shows.length;const show=shows[index],date=String(show?.date||'');if(!date||data.setlists[date]?.sets?.length||state.setlistPending.has(date)||state.setlistRetrying.has(date)||state.setlistUnavailable.has(date)||state.setlistQueue.some(x=>x.date===date))return;const item={index,date,identifier:String(show?.identifier||'')};if(priority)state.setlistQueue.unshift(item);else state.setlistQueue.push(item);runSetlistQueue();};
    const scheduleSetlistRetry=item=>{if(state.setlistRetrying.has(item.date))return;state.setlistRetrying.add(item.date);const timer=setTimeout(()=>{state.setlistRetrying.delete(item.date);if(target.isConnected)queueSetlist(item.index,true);},60000);state.setlistRetryTimers.push(timer);};
    const runSetlistQueue=async()=>{if(state.setlistWorker||!state.setlistQueue.length||!target.isConnected)return;state.setlistWorker=true;const item=state.setlistQueue.shift();state.setlistPending.add(item.date);if(shows[state.current]?.date===item.date)draw();try{const bootstrap=LibreDisplayRuntime.getModule('bootstrap'),shared=LibreDisplayRuntime.getModule('shared'),url=bootstrap?.serverPath?bootstrap.serverPath('/api/integration-action'):'/api/integration-action',request=shared?.resilientFetch||fetch,res=await request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({block:block.id,action:'load-setlist',payload:{date:item.date,identifier:item.identifier}}),cache:'no-store'},{timeoutMs:24000,retry:false}),body=await res.json().catch(()=>({})),result=body?.result||{};if(!res.ok||!body?.ok)throw new Error(body?.error||('HTTP '+res.status));if(result?.available&&result?.setlist?.sets?.length){data.setlists[item.date]=result.setlist;state.setlistUnavailable.delete(item.date);state.setlistRetrying.delete(item.date);}else if(Array.isArray(result?.errors)&&result.errors.length)scheduleSetlistRetry(item);else state.setlistUnavailable.add(item.date);}catch(_e){scheduleSetlistRetry(item);}finally{state.setlistPending.delete(item.date);state.setlistWorker=false;if(shows[state.current]?.date===item.date)draw();if(state.setlistQueue.length)runSetlistQueue();}};
    const queueSetlistCoverage=()=>{if(!enabled(d,'setlistSmartLoad',true)||!shows.length)return;queueSetlist(state.current,true);const ahead=Math.round(num(d.setlistPreloadAhead,0,6,2));for(let step=1;step<=ahead;step++)queueSetlist(state.current+step,false);};
    if(typeof ResizeObserver==='function')state.resizeObserver=new ResizeObserver(()=>scheduleAutoScrollers(target,d,state));
    const observeScrollTargets=()=>{if(!state.resizeObserver)return;state.resizeObserver.disconnect();state.resizeObserver.observe(target);for(const el of target.querySelectorAll('.deadhead-show-list,.deadhead-year-strip,.deadhead-setlist-scroll'))state.resizeObserver.observe(el);};
    draw=()=>{
      snapshotScroll(target,state);clearAutoScrollers(state);
      const show=shows[state.current],showKey=String(show?.date||state.current),quote=quotes[state.quoteIndex%Math.max(1,quotes.length)],sections={browser:renderBrowser(d,shows,state.current),navigation:renderNavigation(d,state.current,shows.length),show:renderShow(show,state.current,shows.length,d),weather:renderWeather(d),setlist:renderSetlist(data,show,d,state),quote:renderQuote(quote,d),footer:renderFooter(data,d,shows.length)},orderedSections=sectionOrder(d.sectionOrder).map(key=>sections[key]||'').filter(Boolean),header=headerHtml(data,d,shows),body=orderedSections.join(''),visibleSectionCount=orderedSections.length+(header?1:0),classes=['deadhead-panel',`deadhead-density-${d.density||'cozy'}`,`deadhead-align-${d.textAlign||'left'}`,`deadhead-surface-${d.panelSurface||'gradient'}`,`deadhead-links-${d.linkStyle||'pills'}`];
      if(visibleSectionCount===1)classes.push('deadhead-single-section');
      target.innerHTML=`<div class="${classes.map(esc).join(' ')}" data-visual-mode="${esc(d.visualMode||'subtle')}" data-background-strength="${Math.round(num(d.backgroundStrength,0,100,100))}">${enabled(d,'showDecorations')?'<div class="deadhead-orbit deadhead-orbit-a"></div><div class="deadhead-orbit deadhead-orbit-b"></div>':''}${header}${body}</div>`;
      const panel=target.querySelector('.deadhead-panel');if(panel)applyPanelStyle(panel,d);restoreScroll(target,state,showKey);state.lastShowKey=showKey;observeScrollTargets();scheduleAutoScrollers(target,d,state);syncGlobalMode();
      target.querySelectorAll('[data-dead-show]').forEach(btn=>btn.addEventListener('click',()=>{state.current=Math.max(0,Math.min(shows.length-1,Number(btn.dataset.deadShow)||0));draw();queueSetlistCoverage();}));
      target.querySelector('.deadhead-prev')?.addEventListener('click',()=>{state.current=nextIndex(state.current,shows.length,-1);draw();queueSetlistCoverage();});
      target.querySelector('.deadhead-next')?.addEventListener('click',()=>{state.current=nextIndex(state.current,shows.length,1);draw();queueSetlistCoverage();});
      target.querySelector('.deadhead-another')?.addEventListener('click',()=>{state.current=jumpIndex(state.current,shows,d.listenButtonBehavior||'surprise');draw();queueSetlistCoverage();});
    };
    draw();queueSetlistCoverage();
    target.onmouseenter=()=>{state.hovered=true;};target.onmouseleave=()=>{state.hovered=false;};
    if(data?.autoRotate!==false&&shows.length>1){const ms=Math.max(15,Number(data?.rotationSeconds)||30)*1000;state.showTimer=setInterval(()=>{if((state.hovered&&enabled(d,'pauseOnHover'))||!target.isConnected)return;state.current=nextIndex(state.current,shows.length,1);draw();queueSetlistCoverage();},ms);}
    if(enabled(d,'quotesEnabled')&&data?.quoteRotate!==false&&quotes.length>1){const ms=quoteSeconds*1000;state.quoteTimer=setInterval(()=>{if((state.hovered&&enabled(d,'pauseOnHover'))||!target.isConnected)return;state.quoteIndex=(state.quoteIndex+1)%quotes.length;draw();},ms);}
  };
})();
