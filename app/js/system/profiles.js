// Display Profiles and scheduled Scenes management.
const configApi=LibreDisplayRuntime.getModule('config');
const {ensureCfgDefaults,saveCfg,activeProfileIdForEndpoint,setActiveProfileForEndpoint,persistProfiles}=configApi;
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;
const remoteApi=LibreDisplayRuntime.getModule('remote');
const systemApi=LibreDisplayRuntime.getModule('system');
const {escHtml}=LibreDisplayRuntime.getModule('shared');


function setProfileStatus(text,error=false){
  const el=document.getElementById('profile-status');if(!el)return;
  el.textContent=text||'';el.style.display=text?'block':'none';el.style.color=error?'#fca5a5':'';
}
function profileDisplayName(endpoint){return remoteApi.displayEndpoints.find(e=>e.id===endpoint)?.name||endpoint||'Unknown display';}
function renderProfileEndpointSelect(){
  const sel=document.getElementById('s-profile-endpoint');if(!sel)return;
  const current=sel.value||bootstrapApi.ACTIVE_ENDPOINT,rows=remoteApi.displayEndpoints.length?remoteApi.displayEndpoints:[{id:bootstrapApi.ACTIVE_ENDPOINT,name:bootstrapApi.ACTIVE_ENDPOINT}];
  sel.innerHTML='';for(const e of rows)sel.append(new Option(`${e.name||e.id}${e.id===bootstrapApi.ACTIVE_ENDPOINT?' · current':''}`,e.id));
  sel.value=rows.some(e=>e.id===current)?current:bootstrapApi.ACTIVE_ENDPOINT;
}
function renderProfileSelect(){
  const sel=document.getElementById('s-profile-select');if(!sel)return;
  const active=activeProfileIdForEndpoint(),current=sel.value||active||'';
  sel.innerHTML='';
  if(!configApi.profileStore.items.length){sel.append(new Option('No saved profiles yet',''));}
  else{
    sel.append(new Option('Choose a profile…',''));
    configApi.profileStore.items.forEach(p=>{const origin=p.sourceEndpoint?` · from ${p.sourceDisplayName||profileDisplayName(p.sourceEndpoint)}`:'';sel.append(new Option((p.id===active?'★ ':'')+p.name+origin,p.id));});
  }
  sel.value=configApi.profileStore.items.some(p=>p.id===current)?current:(active||'');
  renderProfileEndpointSelect();updateProfileControls();
}
function updateProfileControls(){
  const sel=document.getElementById('s-profile-select'),name=document.getElementById('s-profile-name'),target=document.getElementById('s-profile-endpoint');
  const p=configApi.profileStore.items.find(x=>x.id===sel?.value);
  if(name&&p)name.value=p.name;
  if(target&&!target.value)target.value=bootstrapApi.ACTIVE_ENDPOINT;
}
function uniqueProfileId(){return 'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);}
function profileSnapshot(){const snap=JSON.parse(JSON.stringify(cfg));delete snap._savedAt;return snap;}
function currentDisplayProfileMeta(){return {sourceEndpoint:bootstrapApi.ACTIVE_ENDPOINT,sourceDisplayName:profileDisplayName(bootstrapApi.ACTIVE_ENDPOINT)};}
function createProfile(){
  if(systemApi.settingsDirty){setProfileStatus('Save & Apply your current changes before creating a profile.',true);return;}
  const name=(document.getElementById('s-profile-name')?.value||'').trim();
  if(!name){setProfileStatus('Enter a profile name first.',true);return;}
  const id=uniqueProfileId();
  configApi.profileStore.items.push({id,name:name.slice(0,48),config:profileSnapshot(),updatedAt:Date.now(),...currentDisplayProfileMeta()});
  setActiveProfileForEndpoint(bootstrapApi.ACTIVE_ENDPOINT,id);persistProfiles();renderProfileSelect();
  document.getElementById('s-profile-select').value=id;setProfileStatus(`Saved profile “${name}” from ${profileDisplayName(bootstrapApi.ACTIVE_ENDPOINT)}.`);
}
function updateSelectedProfile(){
  if(systemApi.settingsDirty){setProfileStatus('Save & Apply your current changes before updating a profile.',true);return;}
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id);
  if(!p){setProfileStatus('Choose a saved profile first.',true);return;}
  p.config=profileSnapshot();p.updatedAt=Date.now();Object.assign(p,currentDisplayProfileMeta());setActiveProfileForEndpoint(bootstrapApi.ACTIVE_ENDPOINT,id);persistProfiles();renderProfileSelect();
  document.getElementById('s-profile-select').value=id;setProfileStatus(`Updated “${p.name}” from the currently saved ${profileDisplayName(bootstrapApi.ACTIVE_ENDPOINT)} dashboard.`);
}
function duplicateSelectedProfile(){
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id);if(!p){setProfileStatus('Choose a profile to duplicate first.',true);return;}
  const copyId=uniqueProfileId(),copyName=(p.name+' copy').slice(0,48);configApi.profileStore.items.push({...JSON.parse(JSON.stringify(p)),id:copyId,name:copyName,updatedAt:Date.now()});persistProfiles();renderProfileSelect();document.getElementById('s-profile-select').value=copyId;document.getElementById('s-profile-name').value=copyName;setProfileStatus(`Duplicated “${p.name}”.`);
}
function renameSelectedProfile(){
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id);
  const name=(document.getElementById('s-profile-name')?.value||'').trim();
  if(!p||!name){setProfileStatus('Choose a profile and enter its new name.',true);return;}
  p.name=name.slice(0,48);p.updatedAt=Date.now();persistProfiles();renderProfileSelect();document.getElementById('s-profile-select').value=id;setProfileStatus('Profile renamed.');
}
function deleteSelectedProfile(){
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id);
  if(!p){setProfileStatus('Choose a saved profile first.',true);return;}
  if(!confirm(`Delete profile “${p.name}”? This does not delete any display's current saved settings.`))return;
  configApi.profileStore.items=configApi.profileStore.items.filter(x=>x.id!==id);for(const [endpoint,active] of Object.entries(configApi.profileStore.activeByEndpoint||{}))if(active===id)delete configApi.profileStore.activeByEndpoint[endpoint];if(configApi.profileStore.activeId===id)configApi.profileStore.activeId='';persistProfiles();renderProfileSelect();setProfileStatus('Profile deleted.');
}
async function loadSelectedProfile(){
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id);
  if(!p){setProfileStatus('Choose a saved profile first.',true);return;}
  if(systemApi.settingsDirty&&!confirm('Discard unsaved changes and load this profile?'))return;
  cfg={...cfg,...JSON.parse(JSON.stringify(p.config))};ensureCfgDefaults();cfg.onboardingComplete=true;
  setActiveProfileForEndpoint(bootstrapApi.ACTIVE_ENDPOINT,id);persistProfiles();await saveCfg();configApi.alertRuntimeState=null;window.__uiPreviewCfg=null;applySettings();openSetup(false);setProfileStatus(`Loaded “${p.name}” on ${profileDisplayName(bootstrapApi.ACTIVE_ENDPOINT)}.`);
}
function endpointConfigPath(endpoint){return '/api/config?endpoint='+encodeURIComponent(endpoint||bootstrapApi.ACTIVE_ENDPOINT);}
async function applySelectedProfileToDisplay(){
  const id=document.getElementById('s-profile-select')?.value,p=configApi.profileStore.items.find(x=>x.id===id),endpoint=document.getElementById('s-profile-endpoint')?.value||bootstrapApi.ACTIVE_ENDPOINT;
  if(!p){setProfileStatus('Choose a saved profile first.',true);return;}
  const label=profileDisplayName(endpoint);if(!confirm(`Apply profile “${p.name}” to “${label}”?

This replaces that display's saved dashboard configuration. The profile itself is not changed.`))return;
  try{const next=JSON.parse(JSON.stringify(p.config));next.onboardingComplete=true;next._savedAt=Date.now();const res=await fetch(endpointConfigPath(endpoint),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:next}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));setActiveProfileForEndpoint(endpoint,id);persistProfiles();if(endpoint===bootstrapApi.ACTIVE_ENDPOINT){cfg={...cfg,...next};ensureCfgDefaults();try{localStorage.setItem(bootstrapApi.CFG_KEY,JSON.stringify(cfg));}catch{}configApi.alertRuntimeState=null;window.__uiPreviewCfg=null;applySettings();setAppearanceForm(cfg);}setProfileStatus(`Applied “${p.name}” to ${label}.`);renderProfileSelect();}catch(e){setProfileStatus('Could not apply profile: '+(e.message||e),true);}
}
async function captureTargetDisplayAsProfile(){
  const endpoint=document.getElementById('s-profile-endpoint')?.value||bootstrapApi.ACTIVE_ENDPOINT,label=profileDisplayName(endpoint);let name=(document.getElementById('s-profile-name')?.value||'').trim();if(!name)name=label;
  try{const res=await fetch(endpointConfigPath(endpoint),{cache:'no-store'}),data=await res.json();if(!res.ok||!data.ok||!data.config)throw new Error(data.error||'That display does not have a saved configuration yet.');const id=uniqueProfileId();const snap=JSON.parse(JSON.stringify(data.config));delete snap._savedAt;configApi.profileStore.items.push({id,name:name.slice(0,48),config:snap,updatedAt:Date.now(),sourceEndpoint:endpoint,sourceDisplayName:label});persistProfiles();renderProfileSelect();document.getElementById('s-profile-select').value=id;document.getElementById('s-profile-name').value=name.slice(0,48);setProfileStatus(`Captured ${label} as profile “${name.slice(0,48)}”.`);}catch(e){setProfileStatus('Could not capture display: '+(e.message||e),true);}
}

function sceneProfileOptions(selected='',allowEmpty=true){
  let html=allowEmpty?'<option value="">No base profile</option>':'';
  for(const p of configApi.profileStore.items)html+=`<option value="${escHtml(p.id)}"${p.id===selected?' selected':''}>${escHtml(p.name)}</option>`;
  return html;
}
function sceneRuleId(){return 's_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);}
function normalizeClientSceneStore(raw){
  const src=raw&&typeof raw==='object'?raw:{};return {version:1,automatic:src.automatic!==false,baseProfiles:src.baseProfiles&&typeof src.baseProfiles==='object'?src.baseProfiles:{},items:Array.isArray(src.items)?src.items:[]};
}
async function loadScenes(){
  const status=document.getElementById('scene-status');
  try{const res=await fetch(serverPath('/api/scenes'),{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);const data=await res.json();configApi.sceneStore=normalizeClientSceneStore(data.scenes);configApi.sceneActive=data.active||{};renderScenes();if(status)status.textContent=configApi.sceneActive[bootstrapApi.ACTIVE_ENDPOINT]?`Active scheduled profile: ${configApi.profileStore.items.find(p=>p.id===configApi.sceneActive[bootstrapApi.ACTIVE_ENDPOINT])?.name||configApi.sceneActive[bootstrapApi.ACTIVE_ENDPOINT]}`:'No scheduled scene is active right now.';}catch(e){if(status)status.textContent='Could not load schedules: '+(e.message||e);}
}
function renderScenes(){
  const auto=document.getElementById('scene-automatic');if(auto)auto.checked=configApi.sceneStore.automatic!==false;
  const base=document.getElementById('scene-base-profile');if(base)base.innerHTML=sceneProfileOptions(configApi.sceneStore.baseProfiles?.[bootstrapApi.ACTIVE_ENDPOINT]||'',true);
  const host=document.getElementById('scene-list');if(!host)return;const rows=(configApi.sceneStore.items||[]).filter(x=>(x.endpoint||'main')===bootstrapApi.ACTIVE_ENDPOINT);host.innerHTML='';
  if(!rows.length){host.innerHTML='<div class="settings-note">No scheduled scenes for this display yet.</div>';return;}
  const dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  for(const row of rows){const wrap=document.createElement('div');wrap.className='scene-row';wrap.dataset.sceneId=row.id;wrap.innerHTML=`<div class="scene-row-head"><label class="checkline"><input class="scene-enabled" type="checkbox" ${row.enabled!==false?'checked':''}> <input class="scene-name" value="${escHtml(row.name||'Scene')}" maxlength="80" style="width:min(260px,60vw)"></label><button class="btn-util" type="button" onclick="removeSceneRule('${escHtml(row.id)}')">Remove</button></div><div class="scene-fields"><div class="s-row"><label>Profile</label><select class="scene-profile">${sceneProfileOptions(row.profileId||'',false)}</select></div><div class="s-row"><label>Start</label><input class="scene-start" type="time" value="${escHtml(row.start||'00:00')}"></div><div class="s-row"><label>End</label><input class="scene-end" type="time" value="${escHtml(row.end||'23:59')}"></div></div><div class="scene-days">${dn.map((d,i)=>`<label><input type="checkbox" class="scene-day" data-day="${i}" ${(row.days||[0,1,2,3,4,5,6]).includes(i)?'checked':''}> ${d}</label>`).join('')}</div>`;host.appendChild(wrap);}
}
function collectScenesFromUi(){
  configApi.sceneStore.automatic=document.getElementById('scene-automatic')?.checked!==false;configApi.sceneStore.baseProfiles=configApi.sceneStore.baseProfiles||{};const base=document.getElementById('scene-base-profile')?.value||'';if(base)configApi.sceneStore.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT]=base;else delete configApi.sceneStore.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT];
  const keep=(configApi.sceneStore.items||[]).filter(x=>(x.endpoint||'main')!==bootstrapApi.ACTIVE_ENDPOINT);for(const el of document.querySelectorAll('#scene-list .scene-row')){const days=[...el.querySelectorAll('.scene-day:checked')].map(x=>Number(x.dataset.day));const profileId=el.querySelector('.scene-profile')?.value||'';if(!profileId)continue;keep.push({id:el.dataset.sceneId||sceneRuleId(),name:(el.querySelector('.scene-name')?.value||'Scene').trim().slice(0,80)||'Scene',endpoint:bootstrapApi.ACTIVE_ENDPOINT,profileId,days:days.length?days:[0,1,2,3,4,5,6],start:el.querySelector('.scene-start')?.value||'00:00',end:el.querySelector('.scene-end')?.value||'23:59',enabled:el.querySelector('.scene-enabled')?.checked!==false});}configApi.sceneStore.items=keep;
}
function addSceneRule(){if(!configApi.profileStore.items.length){document.getElementById('scene-status').textContent='Create at least one Profile before adding a scene.';return;}collectScenesFromUi();configApi.sceneStore.items.push({id:sceneRuleId(),name:'New scene',endpoint:bootstrapApi.ACTIVE_ENDPOINT,profileId:configApi.profileStore.items[0].id,days:[0,1,2,3,4,5,6],start:'07:00',end:'22:00',enabled:true});renderScenes();}
function removeSceneRule(id){collectScenesFromUi();configApi.sceneStore.items=configApi.sceneStore.items.filter(x=>x.id!==id);renderScenes();}
async function saveScenes(){collectScenesFromUi();const status=document.getElementById('scene-status');try{const res=await fetch(serverPath('/api/scenes'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenes:configApi.sceneStore}),cache:'no-store'});if(!res.ok)throw new Error(await res.text());if(status)status.textContent='Schedules saved. The server will apply matching scenes automatically.';setTimeout(loadScenes,400);}catch(e){if(status)status.textContent='Could not save schedules: '+(e.message||e);}}


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("system", {setProfileStatus,profileDisplayName,renderProfileEndpointSelect,renderProfileSelect,updateProfileControls,uniqueProfileId,profileSnapshot,currentDisplayProfileMeta,createProfile,updateSelectedProfile,duplicateSelectedProfile,renameSelectedProfile,deleteSelectedProfile,loadSelectedProfile,endpointConfigPath,applySelectedProfileToDisplay,captureTargetDisplayAsProfile,sceneProfileOptions,sceneRuleId,normalizeClientSceneStore,loadScenes,renderScenes,collectScenesFromUi,addSceneRule,removeSceneRule,saveScenes}, {}, {globalFunctions:['updateProfileControls','createProfile','updateSelectedProfile','duplicateSelectedProfile','renameSelectedProfile','deleteSelectedProfile','loadSelectedProfile','applySelectedProfileToDisplay','captureTargetDisplayAsProfile','loadScenes','addSceneRule','removeSceneRule','saveScenes']});
