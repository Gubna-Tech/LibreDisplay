(function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeUrl=value=>/^https?:\/\//i.test(String(value||''))?String(value):'';
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
  const sourceLinks=(show,d)=>{if(!enabled(d,'showSourceLinks'))return '';const links=[];if(enabled(d,'showJerryBaseLink'))links.push(sourceLink(show?.jerrybaseUrl,d.jerrybaseLabel||'JerryBase'));if(enabled(d,'showArchiveLink'))links.push(sourceLink(show?.archiveUrl,d.archiveLabel||'Internet Archive'));if(enabled(d,'showRelistenLink'))links.push(sourceLink(show?.relistenUrl,d.relistenLabel||'Listen on Relisten'));return links.filter(Boolean).join('');};
  const renderShow=(show,index,total,d)=>{if(!show)return '<div class="deadhead-section deadhead-empty">No historical show was found for this date and era.</div>';const where=showWhere(show,d),links=sourceLinks(show,d),top=[];if(enabled(d,'showShowCounter'))top.push(`<span class="deadhead-show-kicker">Show ${index+1} of ${total}</span>`);if(enabled(d,'showRecordingCount'))top.push(`<span class="deadhead-recordings">${Number(show.recordings)||0} recording${Number(show.recordings)===1?'':'s'}</span>`);return `<section class="deadhead-section deadhead-show" data-show-index="${index}">${top.length?`<div class="deadhead-show-topline">${top.join('')}</div>`:''}${enabled(d,'showDate')?`<div class="deadhead-show-date">${esc(formatShowDate(show.date,d.dateStyle||'iso'))}</div>`:''}${where?`<div class="deadhead-show-venue">${esc(where)}</div>`:''}${links?`<div class="deadhead-show-actions">${links}</div>`:''}</section>`;};
  const renderSetlist=(data,show,d)=>{if(!enabled(d,'setlistsEnabled'))return '';const row=data?.setlists?.[show?.date]||null,heading=esc(d.setlistHeading||'Setlist'),showSource=enabled(d,'setlistShowSource'),maxHeight=num(d.setlistMaxHeight,0,600,100);if(!row?.sets?.length){if(!enabled(d,'setlistShowMissing'))return '';const url=showSource?safeUrl(show?.jerrybaseUrl):'';return `<section class="deadhead-section deadhead-setlist deadhead-setlist-missing"><div class="deadhead-mini-title">${heading}</div><div class="deadhead-setlist-note">Not preloaded for this show${url?` · <a href="${esc(url)}" target="_blank" rel="noopener">Open JerryBase</a>`:''}</div></section>`;}const maxSets=Math.round(num(d.setlistMaxSets,1,5,5)),songLimit=Math.round(num(d.setlistSongsPerSet,3,35,35)),hits=new Set((row.favoriteSongHits||[]).map(x=>String(x).toLowerCase())),sets=row.sets.slice(0,maxSets).map(group=>`<div class="deadhead-set"><b>${esc(group.name||'Set')}</b><span>${(group.songs||[]).slice(0,songLimit).map(song=>`<span class="${enabled(d,'setlistHighlightFavorites')&&hits.has(String(song).toLowerCase())?'deadhead-favorite-song-inline':''}">${esc(song)}</span>`).join('<span class="deadhead-song-sep"> · </span>')}</span></div>`).join(''),favorites=enabled(d,'setlistShowFavoriteHits')?(row.favoriteSongHits||[]).map(x=>`<span class="deadhead-favorite-song">${esc(x)}</span>`).join(''):'',url=showSource?safeUrl(row.url):'',source=showSource?` · ${esc(row.attribution||'source')}${url?` · <a href="${esc(url)}" target="_blank" rel="noopener">open source</a>`:''}`:'';return `<section class="deadhead-section deadhead-setlist${maxHeight===0?' deadhead-setlist-unlimited':''}" style="--dead-setlist-max:${Math.round(maxHeight)}px"><div class="deadhead-mini-title">${heading}${source}</div>${sets}${favorites?`<div class="deadhead-favorites">Favorites in this show: ${favorites}</div>`:''}</section>`;};
  const renderQuote=(quote,d)=>{if(!enabled(d,'quotesEnabled')||!quote)return '';const member=enabled(d,'quoteShowMember')?esc(quote.member):'',url=enabled(d,'quoteShowSource')?safeUrl(quote.url):'',source=url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(quote.source||'Source')}</a>`:(enabled(d,'quoteShowSource')?esc(quote.source||''):'');const attribution=[member,source].filter(Boolean).join(' · '),marks=enabled(d,'quoteShowMarks'),text=`${marks?'“':''}${esc(quote.quote)}${marks?'”':''}`;return `<figure class="deadhead-section deadhead-quote deadhead-quote-${esc(d.quoteStyle||'card')}"><blockquote>${text}</blockquote>${attribution?`<figcaption>— ${attribution}</figcaption>`:''}</figure>`;};
  const yearStrip=(shows,current,d)=>`<div class="deadhead-section deadhead-year-strip" role="list" aria-label="Shows played on this date">${shows.map((show,i)=>`<button type="button" class="deadhead-year${i===current?' active':''}" data-dead-show="${i}" title="${esc([show?.venue,show?.location].filter(Boolean).join(' · '))}">${esc(show.year||show.date?.slice(0,4)||'?')}</button>`).join('')}</div>`;
  const compactList=(shows,current,d)=>`<div class="deadhead-section deadhead-show-list" role="list">${shows.map((show,i)=>{const venue=enabled(d,'browserShowVenue')?show.venue||'Unknown venue':'',location=enabled(d,'browserShowLocation')?show.location||'':'';return `<button type="button" class="deadhead-show-row${i===current?' active':''}" data-dead-show="${i}"><b>${esc(show.year||'')}</b>${venue?`<span>${esc(venue)}</span>`:''}${location?`<small>${esc(location)}</small>`:''}</button>`;}).join('')}</div>`;
  const renderBrowser=(d,shows,current)=>!enabled(d,'showBrowserEnabled')||d.showBrowser==='minimal'?'':d.showBrowser==='list'?compactList(shows,current,d):yearStrip(shows,current,d);
  const renderNavigation=(d,current,total)=>enabled(d,'showNavigation')?`<div class="deadhead-section deadhead-nav deadhead-nav-${esc(d.navigationStyle||'pills')}"><button type="button" class="deadhead-prev" ${total<2?'disabled':''} aria-label="Previous historical show">‹</button>${enabled(d,'showPosition')?`<span>${total?`${current+1} / ${total}`:'0 / 0'}</span>`:''}<button type="button" class="deadhead-next" ${total<2?'disabled':''} aria-label="Next historical show">›</button></div>`:'';
  const renderWeather=d=>enabled(d,'showWeatherPick')?`<div class="deadhead-section deadhead-listen-prompt">${esc(d.weatherLabel||'Weather pick')} · <b>${esc(weatherSong(d))}</b></div>`:'';
  const renderFooter=(data,d,total)=>{if(!enabled(d,'showFooter'))return '';const meta=[];if(enabled(d,'showRotationStatus'))meta.push(`<span>${data?.autoRotate!==false?'Auto-rotating':'Manual browsing'}</span>`);if(enabled(d,'showSetlistStatus')){const count=Object.keys(data?.setlists||{}).length;meta.push(`<span>${count} setlist${count===1?'':'s'} loaded</span>`);}const button=enabled(d,'showListenButton')?`<button class="deadhead-another" type="button" ${total<2?'disabled':''}>${esc(d.listenButtonLabel||'What should I listen to?')}</button>`:'';if(!button&&!meta.length)return '';return `<footer class="deadhead-section">${button}<div class="deadhead-footer-meta">${meta.join('')}</div></footer>`;};
  const nextIndex=(current,total,delta=1)=>total?((current+delta+total)%total):0;
  const jumpIndex=(current,shows,behavior)=>{if(!shows.length)return 0;if(behavior==='next')return nextIndex(current,shows.length,1);if(behavior==='oldest'){let best=0;for(let i=1;i<shows.length;i++)if(Number(shows[i]?.year)<Number(shows[best]?.year))best=i;return best;}if(behavior==='newest'){let best=0;for(let i=1;i<shows.length;i++)if(Number(shows[i]?.year)>Number(shows[best]?.year))best=i;return best;}if(shows.length<2)return current;let value=(Date.now()+(current+1)*2654435761)>>>0;const step=1+(value%(shows.length-1));return (current+step)%shows.length;};
  const headerHtml=(data,d,shows)=>{if(!enabled(d,'showHeader'))return '';const custom=String(d.headerSubtitle||'').trim(),parts=[];if(custom)parts.push(custom);else{if(enabled(d,'showHeaderDate'))parts.push(data?.monthDay||data?.date||'');if(enabled(d,'showHeaderShowCount'))parts.push(`${shows.length} show${shows.length===1?'':'s'} in rotation`);}if(enabled(d,'showUnofficialLabel'))parts.push('unofficial fan integration');return `<header>${enabled(d,'showHeaderIcon')?`<span class="deadhead-mark">${esc(d.headerIcon||'✺')}</span>`:''}<div><b>${esc(d.headerTitle||'Today in Dead History')}</b>${enabled(d,'showHeaderSubtitle')&&parts.filter(Boolean).length?`<small>${parts.filter(Boolean).map(esc).join(' · ')}</small>`:''}</div></header>`;};
  const applyPanelStyle=(panel,d)=>{const accent=d.accentColor||'#e5c782',accent2=d.accentColor2||'#8ed9ca',strength=num(d.accentStrength,0,100,100)/100;panel.style.setProperty('--dead-accent',accent);panel.style.setProperty('--dead-accent2',accent2);panel.style.setProperty('--dead-accent-soft',rgba(accent,.10*strength));panel.style.setProperty('--dead-accent-mid',rgba(accent,.25*strength));panel.style.setProperty('--dead-accent-strong',rgba(accent,.62*strength));panel.style.setProperty('--dead-accent2-soft',rgba(accent2,.12*strength));panel.style.setProperty('--dead-panel',d.panelColor||'#171526');panel.style.setProperty('--dead-text',d.textColor||'#f8f2e7');panel.style.setProperty('--dead-muted',d.mutedColor||'#bdb7c5');panel.style.setProperty('--dead-radius',`${Math.round(num(d.panelRadius,0,48,18))}px`);panel.style.setProperty('--dead-pad',`${Math.round(num(d.panelPadding,6,48,16))}px`);panel.style.setProperty('--dead-gap',`${Math.round(num(d.sectionGap,0,32,9))}px`);panel.style.setProperty('--dead-title-scale',String(num(d.titleScale,70,180,100)/100));panel.style.setProperty('--dead-body-scale',String(num(d.bodyScale,70,160,100)/100));const browserMax=Math.round(num(d.browserMaxHeight,0,400,118));panel.style.setProperty('--dead-browser-max',browserMax===0?'none':`${browserMax}px`);};

  const scrollPosition=(el,axis)=>axis==='x'?el.scrollLeft:el.scrollTop;
  const setScrollPosition=(el,axis,value)=>{if(axis==='x')el.scrollLeft=value;else el.scrollTop=value;};
  const scrollMax=(el,axis)=>axis==='x'?Math.max(0,el.scrollWidth-el.clientWidth):Math.max(0,el.scrollHeight-el.clientHeight);
  const clearAutoScrollers=state=>{for(const stop of state.autoScrollers||[])try{stop();}catch{}state.autoScrollers=[];};
  const snapshotScroll=(target,state)=>{const browser=target.querySelector('.deadhead-show-list,.deadhead-year-strip'),setlist=target.querySelector('.deadhead-setlist:not(.deadhead-setlist-missing)');if(browser)state.browserScroll={top:browser.scrollTop,left:browser.scrollLeft};if(setlist)state.setlistScroll={top:setlist.scrollTop,left:setlist.scrollLeft,showKey:state.lastShowKey||''};};
  const restoreScroll=(target,state,showKey)=>{const browser=target.querySelector('.deadhead-show-list,.deadhead-year-strip'),setlist=target.querySelector('.deadhead-setlist:not(.deadhead-setlist-missing)');if(browser&&state.browserScroll){browser.scrollTop=state.browserScroll.top||0;browser.scrollLeft=state.browserScroll.left||0;}if(setlist&&state.setlistScroll?.showKey===showKey){setlist.scrollTop=state.setlistScroll.top||0;setlist.scrollLeft=state.setlistScroll.left||0;}};
  const autoScrollOptions=(d,prefix,defaults)=>({
    active:enabled(d,`${prefix}AutoScroll`,true),
    speed:num(d[`${prefix}ScrollSpeed`],4,80,defaults.speed),
    startDelay:num(d[`${prefix}ScrollStartDelay`],0,30,defaults.startDelay)*1000,
    loopPause:num(d[`${prefix}ScrollLoopPause`],0,60,defaults.loopPause)*1000,
    loopMode:['restart','bounce','once'].includes(d[`${prefix}ScrollLoopMode`])?d[`${prefix}ScrollLoopMode`]:defaults.loopMode,
    pauseOnHover:enabled(d,`${prefix}ScrollPauseOnHover`,true),
    showScrollbar:enabled(d,`${prefix}ShowScrollbar`,false)
  });
  const startAutoScroller=(el,axis,options,state)=>{
    if(!el)return ()=>{};
    el.classList.toggle('deadhead-hide-scrollbar',!options.showScrollbar);
    if(!options.active)return ()=>{};
    let frame=0,stopped=false,last=0,phase='start',phaseUntil=performance.now()+options.startDelay,direction=1;
    const tick=now=>{
      if(stopped||!el.isConnected)return;
      const max=scrollMax(el,axis);
      el.classList.toggle('deadhead-autoscroll-active',max>2);
      if(max<=2){last=now;frame=requestAnimationFrame(tick);return;}
      if(document.hidden||(state.hovered&&options.pauseOnHover)){last=now;frame=requestAnimationFrame(tick);return;}
      if(now<phaseUntil){last=now;frame=requestAnimationFrame(tick);return;}
      const current=scrollPosition(el,axis);
      if(phase==='end'){
        if(options.loopMode==='once'){setScrollPosition(el,axis,max);return;}
        if(options.loopMode==='bounce'){direction*=-1;phase='move';last=now;}
        else{setScrollPosition(el,axis,0);direction=1;phase='start';phaseUntil=now+options.startDelay;last=now;}
        frame=requestAnimationFrame(tick);return;
      }
      phase='move';
      const dt=last?Math.min(64,now-last):0;last=now;
      const next=current+(options.speed*dt/1000*direction);
      if(direction>0&&next>=max-0.5){setScrollPosition(el,axis,max);phase='end';phaseUntil=now+options.loopPause;}
      else if(direction<0&&next<=0.5){setScrollPosition(el,axis,0);phase='end';phaseUntil=now+options.loopPause;}
      else setScrollPosition(el,axis,Math.max(0,Math.min(max,next)));
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>{stopped=true;if(frame)cancelAnimationFrame(frame);};
  };
  const setupAutoScrollers=(target,d,state)=>{
    clearAutoScrollers(state);
    const browser=target.querySelector('.deadhead-show-list,.deadhead-year-strip');
    if(browser){const axis=browser.classList.contains('deadhead-year-strip')?'x':'y';state.autoScrollers.push(startAutoScroller(browser,axis,autoScrollOptions(d,'browser',{speed:18,startDelay:3,loopPause:4,loopMode:'bounce'}),state));}
    const setlist=target.querySelector('.deadhead-setlist:not(.deadhead-setlist-missing):not(.deadhead-setlist-unlimited)');
    if(setlist)state.autoScrollers.push(startAutoScroller(setlist,'y',autoScrollOptions(d,'setlist',{speed:14,startDelay:4,loopPause:5,loopMode:'restart'}),state));
  };

  window.LibreDisplayIntegrationRenderers=window.LibreDisplayIntegrationRenderers||{};
  window.LibreDisplayIntegrationRenderers['grateful-dead']=(target,data)=>{
    if(!target)return;
    const previous=states.get(target);if(previous?.showTimer)clearInterval(previous.showTimer);if(previous?.quoteTimer)clearInterval(previous.quoteTimer);if(previous)clearAutoScrollers(previous);
    const d=data?.display||data||{},shows=Array.isArray(data?.shows)?data.shows:[],quotes=Array.isArray(data?.quotes)&&data.quotes.length?data.quotes:(data?.quote?[data.quote]:[]),initial=Math.max(0,Math.min(Math.max(0,shows.length-1),Number(data?.featuredIndex)||0)),state={current:initial,quoteIndex:0,showTimer:0,quoteTimer:0,hovered:false,autoScrollers:[],browserScroll:null,setlistScroll:null,lastShowKey:''};states.set(target,state);
    const draw=()=>{
      snapshotScroll(target,state);clearAutoScrollers(state);
      const show=shows[state.current],showKey=String(show?.date||state.current),quote=quotes[state.quoteIndex%Math.max(1,quotes.length)],sections={browser:renderBrowser(d,shows,state.current),navigation:renderNavigation(d,state.current,shows.length),show:renderShow(show,state.current,shows.length,d),weather:renderWeather(d),setlist:renderSetlist(data,show,d),quote:renderQuote(quote,d),footer:renderFooter(data,d,shows.length)},body=sectionOrder(d.sectionOrder).map(key=>sections[key]||'').join(''),classes=['deadhead-panel',`deadhead-density-${d.density||'cozy'}`,`deadhead-align-${d.textAlign||'left'}`,`deadhead-surface-${d.panelSurface||'gradient'}`,`deadhead-links-${d.linkStyle||'pills'}`];
      target.innerHTML=`<div class="${classes.map(esc).join(' ')}" data-visual-mode="${esc(d.visualMode||'subtle')}" data-background-strength="${Math.round(num(d.backgroundStrength,0,100,100))}">${enabled(d,'showDecorations')?'<div class="deadhead-orbit deadhead-orbit-a"></div><div class="deadhead-orbit deadhead-orbit-b"></div>':''}${headerHtml(data,d,shows)}${body}</div>`;
      const panel=target.querySelector('.deadhead-panel');if(panel)applyPanelStyle(panel,d);restoreScroll(target,state,showKey);state.lastShowKey=showKey;setupAutoScrollers(target,d,state);syncGlobalMode();
      target.querySelectorAll('[data-dead-show]').forEach(btn=>btn.addEventListener('click',()=>{state.current=Math.max(0,Math.min(shows.length-1,Number(btn.dataset.deadShow)||0));draw();}));
      target.querySelector('.deadhead-prev')?.addEventListener('click',()=>{state.current=nextIndex(state.current,shows.length,-1);draw();});
      target.querySelector('.deadhead-next')?.addEventListener('click',()=>{state.current=nextIndex(state.current,shows.length,1);draw();});
      target.querySelector('.deadhead-another')?.addEventListener('click',()=>{state.current=jumpIndex(state.current,shows,d.listenButtonBehavior||'surprise');draw();});
    };
    draw();
    target.onmouseenter=()=>{state.hovered=true;};target.onmouseleave=()=>{state.hovered=false;};
    if(data?.autoRotate!==false&&shows.length>1){const ms=Math.max(15,Number(data?.rotationSeconds)||30)*1000;state.showTimer=setInterval(()=>{if((state.hovered&&enabled(d,'pauseOnHover'))||!target.isConnected)return;state.current=nextIndex(state.current,shows.length,1);draw();},ms);}
    if(enabled(d,'quotesEnabled')&&data?.quoteRotate!==false&&quotes.length>1){const ms=Math.max(30,Number(data?.quoteSeconds)||60)*1000;state.quoteTimer=setInterval(()=>{if((state.hovered&&enabled(d,'pauseOnHover'))||!target.isConnected)return;state.quoteIndex=(state.quoteIndex+1)%quotes.length;draw();},ms);}
  };
})();
