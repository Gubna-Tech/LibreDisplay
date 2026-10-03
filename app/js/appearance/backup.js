// Settings import/export, portable backups, and local restore points.
const configApi=LibreDisplayRuntime.getModule('config');
const {ensureCfgDefaults,saveCfg}=configApi;
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;
const {escHtml,esc}=LibreDisplayRuntime.getModule('shared');
const integrationsApi=LibreDisplayRuntime.getModule('integrations');


function exportSettings(){
  if(!confirm('Export settings for this display? The file may include private calendar URLs and integration credentials. Store it securely.'))return;
  const payload={product:'LibreDisplay',format:2,build:bootstrapApi.DASHBOARD_BUILD,exportedAt:new Date().toISOString(),endpoint:bootstrapApi.ACTIVE_ENDPOINT,config:{...cfg,_schemaVersion:2}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`libredisplay-${bootstrapApi.ACTIVE_ENDPOINT}-settings-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function analyzeImportedSettings(raw){const envelope=raw&&raw.product==='LibreDisplay'&&raw.config&&typeof raw.config==='object';const candidate=envelope?raw.config:raw;if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))throw new Error('That file does not contain a LibreDisplay settings object.');const plugins=new Set(integrationsApi.integrationManifests.map(x=>x.id)),blocks=Array.isArray(candidate.customBlocks)?candidate.customBlocks:[],missing=[...new Set(blocks.filter(b=>b?.type==='integration'&&b.config?.plugin&&!plugins.has(b.config.plugin)).map(b=>b.config.plugin))];return {candidate,sourceBuild:envelope?String(raw.build||'unknown'):'unversioned settings file',schema:Number(candidate._schemaVersion)||1,calendars:Array.isArray(candidate.calendars)?candidate.calendars.length:0,blocks:blocks.length,missing};}
async function importSettingsFile(input){
  const file=input?.files?.[0];if(!file)return;
  try{
    const raw=JSON.parse(await file.text()),info=analyzeImportedSettings(raw);
    const notes=[`Source: ${info.sourceBuild}`,`Schema: ${info.schema}${info.schema<2?' → will migrate to schema 2':''}`,`${info.calendars} calendar source${info.calendars===1?'':'s'}`,`${info.blocks} custom block${info.blocks===1?'':'s'}`];
    if(info.missing.length)notes.push(`Missing plugins: ${info.missing.join(', ')}`);
    if(!confirm(`Import this LibreDisplay configuration?\n\n${notes.join('\n')}\n\nCurrent settings will be kept as the automatic previous-save backup.`))return;
    cfg={...cfg,...info.candidate};ensureCfgDefaults();configApi.alertRuntimeState=null;window.__uiPreviewCfg=null;const saved=await saveCfg();if(!saved?.ok)throw new Error(saved?.error||'The imported settings could not be saved to the server.');setAppearanceForm(cfg);applySettings();markSettingsClean();alert('Settings imported and migrated successfully.');openSetup(false);
  }catch(e){alert('Could not import settings: '+(e?.message||e));}
  finally{if(input)input.value='';}
}

function setBackupRecoveryStatus(text,error=false){
  const el=document.getElementById('restore-point-status');if(!el)return;
  el.textContent=text||'';el.style.color=error?'#fca5a5':'';
}
function downloadJsonFile(payload,filename){
  const blob=new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);
}
async function exportPortableBackup(){
  setBackupRecoveryStatus('Preparing portable backup…');
  try{
    const [configRes,profilesRes,scenesRes]=await Promise.all([
      fetch(serverPath('/api/config'),{cache:'no-store'}),fetch(serverPath('/api/profiles'),{cache:'no-store'}),fetch(serverPath('/api/scenes'),{cache:'no-store'})
    ]);
    const configData=await configRes.json().catch(()=>({})),profilesData=await profilesRes.json().catch(()=>({})),scenesData=await scenesRes.json().catch(()=>({}));
    if(!configRes.ok||!configData.ok)throw new Error(configData.error||'Could not read the saved display configuration.');
    if(!profilesRes.ok||!profilesData.ok)throw new Error(profilesData.error||'Could not read Profiles.');
    if(!scenesRes.ok||!scenesData.ok)throw new Error(scenesData.error||'Could not read Scenes.');
    const allScenes=scenesData.scenes||{version:1,automatic:true,baseProfiles:{},items:[]};
    const portableScenes={version:1,automatic:allScenes.automatic!==false,baseProfiles:{},items:(allScenes.items||[]).filter(x=>(x?.endpoint||'main')===bootstrapApi.ACTIVE_ENDPOINT)};
    if(allScenes.baseProfiles?.[bootstrapApi.ACTIVE_ENDPOINT])portableScenes.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT]=allScenes.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT];
    const payload={product:'LibreDisplay',kind:'portable-backup',format:1,build:bootstrapApi.DASHBOARD_BUILD,exportedAt:new Date().toISOString(),sourceEndpoint:bootstrapApi.ACTIVE_ENDPOINT,config:configData.config||{},profiles:profilesData.profiles||{version:1,updatedAt:0,activeId:'',items:[]},scenes:portableScenes};
    const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    downloadJsonFile(payload,`LibreDisplay-${bootstrapApi.ACTIVE_ENDPOINT}-portable-${stamp}.json`);
    setBackupRecoveryStatus('Portable backup downloaded. It may contain private calendar URLs or integration credentials, so keep it private.');
  }catch(e){setBackupRecoveryStatus('Could not create portable backup: '+(e?.message||e),true);}
}
function analyzePortableBackup(raw){
  if(!raw||raw.product!=='LibreDisplay'||raw.kind!=='portable-backup'||Number(raw.format)!==1)throw new Error('That file is not a supported LibreDisplay portable backup.');
  if(!raw.config||typeof raw.config!=='object'||Array.isArray(raw.config))throw new Error('Portable backup is missing its display configuration.');
  const profiles=raw.profiles&&typeof raw.profiles==='object'&&!Array.isArray(raw.profiles)?raw.profiles:{version:1,updatedAt:0,activeId:'',items:[]};
  const scenes=raw.scenes&&typeof raw.scenes==='object'&&!Array.isArray(raw.scenes)?raw.scenes:{version:1,automatic:true,baseProfiles:{},items:[]};
  const blocks=Array.isArray(raw.config.customBlocks)?raw.config.customBlocks:[],plugins=new Set(integrationsApi.integrationManifests.map(x=>x.id));
  const missing=[...new Set(blocks.filter(b=>b?.type==='integration'&&b.config?.plugin&&!plugins.has(b.config.plugin)).map(b=>b.config.plugin))];
  return {config:raw.config,profiles,scenes,build:String(raw.build||'unknown'),sourceEndpoint:String(raw.sourceEndpoint||'main'),exportedAt:String(raw.exportedAt||''),profileCount:Array.isArray(profiles.items)?profiles.items.length:0,sceneCount:Array.isArray(scenes.items)?scenes.items.length:0,missing};
}
async function importPortableBackupFile(input){
  const file=input?.files?.[0];if(!file)return;
  let safetyPointId='';
  try{
    if(file.size>10*1024*1024)throw new Error('Portable backup is larger than the 10 MB safety limit.');
    const raw=JSON.parse(await file.text()),info=analyzePortableBackup(raw);
    const notes=[`Source build: ${info.build}`,`Source display: ${info.sourceEndpoint}`,`${info.profileCount} Profile${info.profileCount===1?'':'s'}`,`${info.sceneCount} Scene rule${info.sceneCount===1?'':'s'}`];
    if(info.missing.length)notes.push(`Missing integrations on this server: ${info.missing.join(', ')}`);
    if(!confirm(`Import this portable LibreDisplay backup into “${bootstrapApi.ACTIVE_ENDPOINT}”?\n\n${notes.join('\n')}\n\nLibreDisplay will create a local restore point first, then replace this display's saved configuration plus Profiles and Scenes.`))return;
    setBackupRecoveryStatus('Creating a safety restore point…');
    const safe=await fetch('/api/restore-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',endpoint:bootstrapApi.ACTIVE_ENDPOINT,label:'Before portable import'}),cache:'no-store'});const safeData=await safe.json().catch(()=>({}));if(!safe.ok||!safeData.ok)throw new Error(safeData.error||'Could not create the safety restore point.');
    safetyPointId=String(safeData.point?.id||'');if(!safetyPointId)throw new Error('The safety restore point did not return an id.');
    setBackupRecoveryStatus('Importing configuration, Profiles and Scenes…');
    const [currentProfilesRes,currentScenesRes]=await Promise.all([fetch('/api/profiles',{cache:'no-store'}),fetch('/api/scenes',{cache:'no-store'})]);
    const currentProfilesData=await currentProfilesRes.json().catch(()=>({})),currentScenesData=await currentScenesRes.json().catch(()=>({}));
    if(!currentProfilesRes.ok||!currentProfilesData.ok)throw new Error(currentProfilesData.error||'Could not read existing Profiles before import.');
    if(!currentScenesRes.ok||!currentScenesData.ok)throw new Error(currentScenesData.error||'Could not read existing Scenes before import.');
    const existingProfiles=currentProfilesData.profiles&&typeof currentProfilesData.profiles==='object'?currentProfilesData.profiles:{version:1,updatedAt:0,activeId:'',items:[]};
    const profileMap=new Map((existingProfiles.items||[]).filter(x=>x?.id).map(x=>[x.id,x]));for(const row of info.profiles.items||[]){if(row?.id)profileMap.set(row.id,row);}
    const mergedProfiles={...existingProfiles,...info.profiles,items:[...profileMap.values()],updatedAt:Date.now()};
    const existingScenes=currentScenesData.scenes&&typeof currentScenesData.scenes==='object'?currentScenesData.scenes:{version:1,automatic:true,baseProfiles:{},items:[]};
    const importedItems=(info.scenes.items||[]).map(x=>({...x,endpoint:bootstrapApi.ACTIVE_ENDPOINT}));
    const mergedScenes={...existingScenes,items:[...(existingScenes.items||[]).filter(x=>(x?.endpoint||'main')!==bootstrapApi.ACTIVE_ENDPOINT),...importedItems],baseProfiles:{...(existingScenes.baseProfiles||{})}};
    const importedBase=info.scenes.baseProfiles?.[info.sourceEndpoint]||info.scenes.baseProfiles?.[bootstrapApi.ACTIVE_ENDPOINT]||'';if(importedBase)mergedScenes.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT]=importedBase;else delete mergedScenes.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT];
    if(!(existingScenes.items||[]).some(x=>(x?.endpoint||'main')!==bootstrapApi.ACTIVE_ENDPOINT))mergedScenes.automatic=info.scenes.automatic!==false;
    const writes=[
      ['/api/profiles',{profiles:mergedProfiles},'Profiles'],
      [serverPath('/api/config'),{config:{...info.config,_savedAt:Date.now()}},'display configuration'],
      ['/api/scenes',{scenes:mergedScenes},'Scenes']
    ];
    for(const [url,payload,label] of writes){const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`Could not import ${label} (HTTP ${res.status}).`);}
    setBackupRecoveryStatus('Portable backup imported. Reloading the saved state…');
    setTimeout(()=>location.reload(),300);
  }catch(e){
    let recovery='';
    if(safetyPointId){
      try{const res=await fetch('/api/restore-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'apply',endpoint:bootstrapApi.ACTIVE_ENDPOINT,id:safetyPointId}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);recovery=' Previous state was restored automatically.';}catch(restoreError){recovery=' Automatic recovery also failed; use the local restore point before making more changes.';}
    }
    setBackupRecoveryStatus('Could not import portable backup: '+(e?.message||e)+recovery,true);
  }
  finally{if(input)input.value='';}
}

function formatBackupBytes(value){const n=Math.max(0,Number(value)||0);if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024/1024).toFixed(1)} MB`;}
function renderRestorePoints(rows){
  const host=document.getElementById('restore-point-list');if(!host)return;const points=Array.isArray(rows)?rows:[];
  if(!points.length){host.innerHTML='<div class="settings-note">No local restore points yet.</div>';return;}
  host.innerHTML=points.map(row=>{const current=row.endpoint===bootstrapApi.ACTIVE_ENDPOINT,date=row.createdUtc?new Date(row.createdUtc).toLocaleString():'Unknown date',label=row.label||'Restore point';return `<div class="restore-point-row"><div><div class="restore-point-title">${esc(label)}</div><div class="restore-point-meta">${esc(date)} · v${esc(row.version||'unknown')} · display ${esc(row.endpoint||'main')} · ${esc(formatBackupBytes(row.sizeBytes))}</div></div><div class="restore-point-actions"><button class="btn-util" type="button" ${current?'':'disabled title="This restore point belongs to another display"'} onclick="applyRestorePoint('${escHtml(row.id)}')">Restore</button><button class="btn-util" type="button" onclick="deleteRestorePoint('${escHtml(row.id)}')">Delete</button></div></div>`}).join('');
}
async function loadRestorePoints(){
  const host=document.getElementById('restore-point-list');if(!host)return;host.innerHTML='<div class="settings-note">Loading restore points…</div>';
  try{const res=await fetch('/api/restore-points',{cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);renderRestorePoints(data.points);setBackupRecoveryStatus(data.points?.length?`${data.points.length} restore point${data.points.length===1?'':'s'} stored locally.`:'No local restore points yet.');}catch(e){host.innerHTML='';setBackupRecoveryStatus('Could not load restore points: '+(e?.message||e),true);}
}
async function createRestorePoint(){
  const label=prompt('Restore point name:','Before changes');if(label===null)return;
  setBackupRecoveryStatus('Creating restore point…');
  try{const res=await fetch('/api/restore-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',endpoint:bootstrapApi.ACTIVE_ENDPOINT,label:label.trim()||'Manual restore point'}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);renderRestorePoints(data.points);setBackupRecoveryStatus('Restore point created.');}catch(e){setBackupRecoveryStatus('Could not create restore point: '+(e?.message||e),true);}
}
async function applyRestorePoint(id){
  if(!confirm('Restore this point now?\n\nLibreDisplay will automatically create a new “Before restore” point first. The page will reload after the saved configuration, Profiles, and Scenes are restored.'))return;
  setBackupRecoveryStatus('Restoring saved state…');
  try{const res=await fetch('/api/restore-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'apply',endpoint:bootstrapApi.ACTIVE_ENDPOINT,id}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);setBackupRecoveryStatus('Restore complete. Reloading…');setTimeout(()=>location.reload(),300);}catch(e){setBackupRecoveryStatus('Could not restore that point: '+(e?.message||e),true);}
}
async function deleteRestorePoint(id){
  if(!confirm('Delete this local restore point? This cannot be undone.'))return;
  try{const res=await fetch('/api/restore-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',endpoint:bootstrapApi.ACTIVE_ENDPOINT,id}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);renderRestorePoints(data.points);setBackupRecoveryStatus('Restore point deleted.');}catch(e){setBackupRecoveryStatus('Could not delete restore point: '+(e?.message||e),true);}
}


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("appearance", {exportSettings,analyzeImportedSettings,importSettingsFile,setBackupRecoveryStatus,downloadJsonFile,exportPortableBackup,analyzePortableBackup,importPortableBackupFile,formatBackupBytes,renderRestorePoints,loadRestorePoints,createRestorePoint,applyRestorePoint,deleteRestorePoint}, {}, {globalFunctions:['exportSettings','importSettingsFile','exportPortableBackup','importPortableBackupFile','loadRestorePoints','createRestorePoint','applyRestorePoint','deleteRestorePoint']});
