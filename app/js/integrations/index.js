const {serverPath}=LibreDisplayRuntime.getModule('bootstrap');
const {escHtml,resilientFetch}=LibreDisplayRuntime.getModule('shared');

const DEFAULT_CAL_COLORS=['#4ade80','#38bdf8','#f472b6','#a78bfa','#fb923c','#22d3ee','#facc15','#fb7185','#c084fc','#86efac','#60a5fa','#f97316'];
let integrationManifests=[];
let integrationManifestMap=new Map();
window.LibreDisplayIntegrationRenderers=window.LibreDisplayIntegrationRenderers||{};
async function loadIntegrations(){
  try{
    const res=await resilientFetch(serverPath('/api/integrations'),{cache:'no-store'});
    if(!res.ok)return;
    const data=await res.json();
    integrationManifests=Array.isArray(data?.integrations)?data.integrations:[];
    integrationManifestMap=new Map(integrationManifests.map(x=>[x.id,x]));
    renderIntegrationDirectory();
    for(const manifest of integrationManifests){
      if(!manifest.clientScript||document.querySelector(`script[data-integration="${CSS.escape(manifest.id)}"]`))continue;
      const script=document.createElement('script');script.src=serverPath(`/plugins/${encodeURIComponent(manifest.id)}/client.js`);script.dataset.integration=manifest.id;script.async=true;document.head.appendChild(script);
    }
  }catch(e){console.warn('integration discovery failed',e);}
}
function integrationManifest(id){return integrationManifestMap.get(String(id||''))||null;}
let integrationHealthRows=[];
let integrationHealthLoadedAt=0;
function configuredIntegrationBlocks(){return (cfg.customBlocks||[]).filter(b=>b?.type==='integration'&&b.config?.plugin);}
function integrationDirectoryCategories(){return [...new Set(integrationManifests.map(x=>x.category||'Other'))].sort((a,b)=>a.localeCompare(b));}
function healthAgeText(seconds){const n=Math.max(0,Number(seconds)||0);if(n<10)return 'just now';if(n<60)return `${Math.floor(n)}s ago`;if(n<3600)return `${Math.floor(n/60)}m ago`;if(n<86400)return `${Math.floor(n/3600)}h ago`;return `${Math.floor(n/86400)}d ago`;}
function healthTimeText(epoch){const n=Number(epoch)||0;if(!n)return 'Never';try{return new Date(n*1000).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}catch{return 'Unknown';}}
function integrationStateLabel(row){if(!row)return 'Not checked';if(row.status==='fresh')return 'Healthy';if(row.status==='stale')return row.refreshing?'Refreshing · cached':row.error?'Delayed · cached':'Stale';if(row.status==='ready')return 'Ready to test';if(row.status==='cached')return 'Cached';if(row.status==='missing')return 'Plugin missing';if(row.status==='unconfigured')return 'Setup needed';if(row.status==='error')return 'Offline / error';return row.status||'Unknown';}
function integrationErrorKindLabel(kind){return ({configuration:'Configuration',authentication:'Authentication',dns:'DNS resolution',network:'Network',timeout:'Timeout',refused:'Connection refused',unreachable:'Network unreachable',tls:'TLS / certificate','rate-limit':'Rate limit',provider:'Provider service',request:'Request'})[kind]||'';}
function integrationStatusRank(status){return ({missing:90,error:80,unconfigured:70,stale:60,cached:40,ready:30,fresh:10})[status]??50;}
function integrationRowsForPlugin(pluginId){return integrationHealthRows.filter(x=>x.pluginId===pluginId);}
function integrationAggregateForPlugin(pluginId){const rows=integrationRowsForPlugin(pluginId);if(!rows.length)return null;return [...rows].sort((a,b)=>integrationStatusRank(b.status)-integrationStatusRank(a.status))[0];}
async function loadIntegrationHealth(){
  try{const r=await resilientFetch(serverPath('/api/integration-status'),{cache:'no-store'});const d=await r.json();integrationHealthRows=r.ok&&Array.isArray(d.integrations)?d.integrations:[];integrationHealthLoadedAt=Date.now();}
  catch(e){integrationHealthRows=[];integrationHealthLoadedAt=Date.now();}
  renderIntegrationDirectory();renderIntegrationHealth();renderProviderHealth();
  const h=document.getElementById('health-integrations');if(h){const bad=integrationHealthRows.filter(x=>['error','missing','unconfigured'].includes(x.status)).length,stale=integrationHealthRows.filter(x=>['stale','cached'].includes(x.status)).length,configured=configuredIntegrationBlocks().length;h.textContent=configured?`${configured} configured${bad?' · '+bad+' need attention':stale?' · '+stale+' delayed/cached':''}`:'None configured';h.className='health-value '+(bad?'bad':stale?'warn':'good');}
}
function renderConfiguredIntegrationBlocks(){
  const host=document.getElementById('integration-configured-blocks');if(!host)return;
  const blocks=configuredIntegrationBlocks();
  if(!blocks.length){host.innerHTML='<div class="settings-note">No integration blocks are configured yet. Choose a provider below to add one.</div>';return;}
  host.innerHTML=blocks.map(b=>{const manifest=integrationManifest(b.config?.plugin),health=integrationHealthRows.find(x=>x.blockId===b.id),provider=manifest?.name||b.config?.plugin||'Integration',state=health?integrationStateLabel(health):'Ready to edit';return `<div class="integration-configured-row" data-block-id="${escHtml(b.id)}"><div class="integration-configured-copy"><b>${escHtml(b.name||provider)}</b><span>${escHtml(provider)} · ${escHtml(state)}</span></div><div class="integration-configured-actions"><button class="btn-util" type="button" onclick="editCustomBlockFromSettings('${escHtml(b.id)}')">Edit configuration</button><button class="btn-util" type="button" onclick="arrangeCustomBlockFromSettings('${escHtml(b.id)}')">Arrange</button><button class="btn-util" type="button" onclick="checkIntegrationNow('${escHtml(b.id)}')">Test</button></div></div>`;}).join('');
}
function renderIntegrationDirectory(){
  renderConfiguredIntegrationBlocks();
  const host=document.getElementById('integration-directory');if(!host)return;
  const q=String(document.getElementById('integration-directory-search')?.value||'').trim().toLowerCase(),cat=document.getElementById('integration-directory-category'),state=document.getElementById('integration-directory-state')?.value||'all';
  if(cat&&cat.options.length<=1){for(const name of integrationDirectoryCategories()){const o=document.createElement('option');o.value=name;o.textContent=name;cat.appendChild(o);}}
  const selected=cat?.value||'all',blocks=configuredIntegrationBlocks(),configured=new Set(blocks.map(b=>b.config.plugin));
  const rows=integrationManifests.filter(m=>(selected==='all'||m.category===selected)&&(state==='all'||(state==='configured')===configured.has(m.id))&&(!q||`${m.name} ${m.description} ${m.category}`.toLowerCase().includes(q)));
  host.innerHTML=rows.map(m=>{const providerBlocks=blocks.filter(b=>b.config.plugin===m.id),count=providerBlocks.length,health=integrationAggregateForPlugin(m.id),pill=health?`<span class="integration-health-state state-${escHtml(health.status||'ready')}">${escHtml(integrationStateLabel(health))}</span>`:'',edit=count===1?`<button class="btn-util" type="button" onclick="editCustomBlockFromSettings('${escHtml(providerBlocks[0].id)}')">Edit block</button>`:'';return `<div class="integration-directory-card"><div class="integration-directory-icon">${escHtml(m.icon||'◇')}</div><div class="integration-directory-copy"><b>${escHtml(m.name)}</b><span>${escHtml(m.description||'')}</span><small>${escHtml(m.category||'Other')} · ${m.auth==='oauth'?'OAuth-capable':m.auth==='credential'?'Account/API key':'No account required'}</small></div><div class="integration-directory-actions">${configured.has(m.id)?`<span class="integration-configured-badge">${count} configured</span>${pill}${edit}`:''}<button class="btn-util" type="button" onclick="addIntegrationFromSettings('${escHtml(m.id)}')">Add block</button></div></div>`;}).join('')||'<div class="settings-note">No providers match this filter.</div>';
  const sum=document.getElementById('integration-directory-summary');if(sum)sum.textContent=`${rows.length} shown · ${integrationManifests.length} installed · ${blocks.length} configured on this display`;
}
function renderIntegrationHealth(){
  const host=document.getElementById('integration-health-list'),summary=document.getElementById('integration-health-summary');if(!host)return;
  const configured=configuredIntegrationBlocks().length,healthy=integrationHealthRows.filter(x=>x.status==='fresh').length,delayed=integrationHealthRows.filter(x=>['stale','cached'].includes(x.status)).length,issues=integrationHealthRows.filter(x=>['error','missing','unconfigured'].includes(x.status)).length;
  if(summary)summary.innerHTML=`<div class="integration-health-summary-card"><b>${configured}</b><span>Configured blocks</span></div><div class="integration-health-summary-card"><b>${healthy}</b><span>Healthy</span></div><div class="integration-health-summary-card"><b>${delayed}</b><span>Delayed / cached</span></div><div class="integration-health-summary-card"><b>${issues}</b><span>Need attention</span></div>`;
  if(!integrationHealthRows.length){host.innerHTML=configured?'<div class="settings-note">No health status is available yet. Use Test all configured to make a live request to each provider.</div>':'<div class="settings-note">No integration blocks are configured on this display.</div>';return;}
  host.innerHTML=integrationHealthRows.map(r=>{const meta=[];meta.push(`Refresh ${Number(r.refreshMin)||5}m`);if(r.lastSuccessAt)meta.push(`Last success ${healthAgeText(Date.now()/1000-r.lastSuccessAt)}`);else meta.push('No successful refresh yet');if(r.lastAttemptAt)meta.push(`Last check ${healthAgeText(Date.now()/1000-r.lastAttemptAt)}`);if(r.status==='stale'&&r.age)meta.push(`Cached data ${healthAgeText(r.age)}`);if(r.refreshing)meta.push('Refreshing in background');if(r.retryAt&&r.retryAt>Date.now()/1000)meta.push(`Automatic retry ${healthAgeText(r.retryAt-Date.now()/1000).replace(' ago','')}`);if(r.nextRefreshAt&&r.status==='fresh')meta.push(`Next due ${healthTimeText(r.nextRefreshAt)}`);const kind=r.errorKind?integrationErrorKindLabel(r.errorKind):'';return `<div class="integration-health-row"><div><b>${escHtml(r.name||r.pluginName)}</b><span>${escHtml(r.pluginName||r.pluginId)} · ${escHtml(r.category||'Other')}</span><div class="integration-health-meta">${meta.map(x=>`<span>${escHtml(x)}</span>`).join('')}</div>${r.error?`<small class="integration-health-error">${kind?escHtml(kind)+': ':''}${escHtml(r.error)}</small>`:''}</div><div class="integration-health-actions"><span class="integration-health-state state-${escHtml(r.status||'ready')}">${escHtml(integrationStateLabel(r))}</span>${r.configured?`<button class="btn-util" type="button" onclick="editCustomBlockFromSettings('${escHtml(r.blockId)}')">Edit block</button><button class="btn-util" type="button" onclick="checkIntegrationNow('${escHtml(r.blockId)}')">Test connection</button>`:''}</div></div>`;}).join('');
}
async function forceIntegrationCheck(blockId){
  const r=await resilientFetch(serverPath('/api/integration-data?block='+encodeURIComponent(blockId)+'&check=1&nonce='+Date.now()),{cache:'no-store'},{timeoutMs:24000,retry:false});
  if(!r.ok){let message=await r.text();try{const d=JSON.parse(message);message=d.error||message;}catch{}throw new Error(String(message||`HTTP ${r.status}`).slice(0,240));}
  const brokerState=String(r.headers.get('X-LibreDisplay-Broker')||'').toLowerCase();
  if(brokerState==='stale')throw new Error('Live provider request failed; LibreDisplay kept the last known good cached data.');
  return true;
}
async function checkIntegrationNow(blockId){
  const status=document.getElementById('integration-health-run-status');if(status){status.style.display='block';status.textContent='Testing provider connection…';}
  try{await forceIntegrationCheck(blockId);if(status)status.textContent='Connection test succeeded.';}catch(e){if(status)status.textContent='Connection test failed: '+String(e?.message||e).slice(0,240);}
  await loadIntegrationHealth();
}
async function checkAllIntegrationsNow(){
  if(!integrationHealthRows.length&&configuredIntegrationBlocks().length)await loadIntegrationHealth();
  const rows=integrationHealthRows.filter(x=>x.configured&&x.blockId);const status=document.getElementById('integration-health-run-status');if(status){status.style.display='block';status.textContent=rows.length?`Testing 0 of ${rows.length} configured integrations…`:'No configured integrations to test.';}if(!rows.length)return;
  let completed=0,failed=0;const queue=[...rows];
  async function worker(){while(queue.length){const row=queue.shift();try{await forceIntegrationCheck(row.blockId);}catch{failed++;}completed++;if(status)status.textContent=`Testing ${completed} of ${rows.length} configured integrations…${failed?` · ${failed} failed`:''}`;}}
  await Promise.all(Array.from({length:Math.min(3,rows.length)},()=>worker()));
  await loadIntegrationHealth();if(status)status.textContent=failed?`Provider checks complete · ${rows.length-failed} healthy · ${failed} need attention`:`All ${rows.length} configured integration${rows.length===1?'':'s'} responded successfully.`;
}
function launchCustomBlockFromSettings(blockId,configure=false){const block=(cfg.customBlocks||[]).find(b=>b?.id===blockId);if(!block)return;if(LibreDisplayRuntime.getModule('system').settingsDirty&&!confirm('You have unsaved Settings changes. Opening Arrange will discard those unsaved Settings edits. Continue?'))return;closeSetup(true);setTimeout(()=>{startLayoutEditor();selectLayoutBlock(customBlockKey(blockId));if(configure)setTimeout(()=>configureSelectedCustomBlock(),40);},80);}
function editCustomBlockFromSettings(blockId){launchCustomBlockFromSettings(blockId,true);}
function arrangeCustomBlockFromSettings(blockId){launchCustomBlockFromSettings(blockId,false);}
function addIntegrationFromSettings(pluginId){if(LibreDisplayRuntime.getModule('system').settingsDirty&&!confirm('You have unsaved Settings changes. The layout editor uses the currently saved dashboard settings. Continue without saving those other changes?'))return;closeSetup(true);setTimeout(()=>{startLayoutEditor();beginAddIntegration(pluginId);},80);}

// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("integrations", {loadIntegrations,integrationManifest,configuredIntegrationBlocks,integrationDirectoryCategories,healthAgeText,healthTimeText,integrationStateLabel,integrationErrorKindLabel,integrationStatusRank,integrationRowsForPlugin,integrationAggregateForPlugin,loadIntegrationHealth,renderConfiguredIntegrationBlocks,renderIntegrationDirectory,renderIntegrationHealth,forceIntegrationCheck,checkIntegrationNow,checkAllIntegrationsNow,launchCustomBlockFromSettings,editCustomBlockFromSettings,arrangeCustomBlockFromSettings,addIntegrationFromSettings}, {
  "DEFAULT_CAL_COLORS": {configurable:true,get:()=>DEFAULT_CAL_COLORS},
  "integrationManifests": {configurable:true,get:()=>integrationManifests,set:(value)=>{integrationManifests=value;}},
  "integrationManifestMap": {configurable:true,get:()=>integrationManifestMap,set:(value)=>{integrationManifestMap=value;}},
  "integrationHealthRows": {configurable:true,get:()=>integrationHealthRows,set:(value)=>{integrationHealthRows=value;}},
  "integrationHealthLoadedAt": {configurable:true,get:()=>integrationHealthLoadedAt,set:(value)=>{integrationHealthLoadedAt=value;}},
}, {globalFunctions:['loadIntegrationHealth','renderIntegrationDirectory','checkIntegrationNow','checkAllIntegrationsNow','editCustomBlockFromSettings','arrangeCustomBlockFromSettings','addIntegrationFromSettings'],globalStates:[]});
