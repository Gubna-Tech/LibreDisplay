const settingsStateApi=()=>LibreDisplayRuntime.getModule('settings');
const systemApi=LibreDisplayRuntime.getModule('system');
// Cursor, wheel, unsaved-change, and contextual-help interactions.

const CURSOR_HIDE_DELAY_MS=2000;
let cursorHideTimer=null;
function hideDashboardCursor(){
  document.documentElement.classList.remove('cursor-active');
}
function showDashboardCursorTemporarily(){
  document.documentElement.classList.add('cursor-active');
  if(cursorHideTimer)clearTimeout(cursorHideTimer);
  cursorHideTimer=setTimeout(hideDashboardCursor,CURSOR_HIDE_DELAY_MS);
}
function initCursorAutoHide(){
  hideDashboardCursor();
  ['mousemove','mousedown','wheel'].forEach(type=>{
    window.addEventListener(type,showDashboardCursorTemporarily,{passive:true});
  });
  window.addEventListener('blur',hideDashboardCursor);
}
initCursorAutoHide();

// Keep modified wheel input inside Settings instead of changing page zoom.
function settingsWheelScrollerFrom(target,deltaY){
  const setup=document.getElementById('setup');
  const box=setup?.querySelector('.setup-box');
  let node=target instanceof Element?target:null;
  while(node&&box){
    const style=getComputedStyle(node);
    const canScroll=/(auto|scroll)/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+1;
    if(canScroll){
      const canUp=deltaY<0&&node.scrollTop>0;
      const canDown=deltaY>0&&node.scrollTop+node.clientHeight<node.scrollHeight-1;
      if(canUp||canDown)return node;
    }
    if(node===box)break;
    node=node.parentElement;
  }
  return box;
}
function initSettingsWheelGuard(){
  const setup=document.getElementById('setup');
  if(!setup)return;
  setup.addEventListener('wheel',e=>{
    if(setup.classList.contains('hidden')||(!e.ctrlKey&&!e.metaKey))return;
    const scroller=settingsWheelScrollerFrom(e.target,e.deltaY);
    if(!scroller)return;
    e.preventDefault();
    scroller.scrollTop+=e.deltaY;
  },{passive:false});
}
initSettingsWheelGuard();

let activeContextHelpTip=null;
let contextHelpPinned=false;
let contextHelpHideTimer=null;
function positionContextHelp(tip=activeContextHelpTip){
  const pop=document.getElementById('context-help-popover');
  if(!tip||!pop||pop.hidden)return;
  const r=tip.getBoundingClientRect(),gap=8,pad=10;
  const w=pop.offsetWidth||300,h=pop.offsetHeight||60;
  let left=r.left+r.width/2-w/2;
  left=Math.max(pad,Math.min(innerWidth-w-pad,left));
  let top=r.bottom+gap;
  if(top+h>innerHeight-pad&&r.top-h-gap>=pad)top=r.top-h-gap;
  top=Math.max(pad,Math.min(innerHeight-h-pad,top));
  pop.style.left=Math.round(left)+'px';
  pop.style.top=Math.round(top)+'px';
}
function showContextHelp(tip,pinned=false){
  if(!(tip instanceof Element))return;
  const text=String(tip.dataset.help||'').trim();
  const pop=document.getElementById('context-help-popover');
  if(!text||!pop)return;
  if(contextHelpHideTimer){clearTimeout(contextHelpHideTimer);contextHelpHideTimer=null;}
  if(activeContextHelpTip&&activeContextHelpTip!==tip)activeContextHelpTip.classList.remove('help-active');
  activeContextHelpTip=tip;contextHelpPinned=!!pinned;
  tip.classList.add('help-active');tip.setAttribute('aria-expanded','true');tip.setAttribute('aria-controls','context-help-popover');
  const rawTitle=String(tip.dataset.helpTitle||tip.getAttribute('aria-label')||'Setting help').trim();
  const title=rawTitle.replace(/\s+help$/i,'')||'Setting help';
  pop.replaceChildren();
  const head=document.createElement('div');head.className='context-help-title';head.textContent=title;
  const copy=document.createElement('div');copy.className='context-help-copy';copy.textContent=text;
  const pin=document.createElement('div');pin.className='context-help-pin';pin.textContent=pinned?'Pinned · click the ? again or press Esc to close':'Click the ? to keep this explanation open';
  pop.append(head,copy,pin);pop.hidden=false;
  requestAnimationFrame(()=>positionContextHelp(tip));
}
function hideContextHelp(force=false){
  if(contextHelpPinned&&!force)return;
  if(contextHelpHideTimer){clearTimeout(contextHelpHideTimer);contextHelpHideTimer=null;}
  activeContextHelpTip?.classList.remove('help-active');
  activeContextHelpTip?.setAttribute('aria-expanded','false');
  activeContextHelpTip=null;contextHelpPinned=false;
  const pop=document.getElementById('context-help-popover');if(pop)pop.hidden=true;
}
function scheduleHideContextHelp(){
  if(contextHelpPinned)return;
  if(contextHelpHideTimer)clearTimeout(contextHelpHideTimer);
  contextHelpHideTimer=setTimeout(()=>hideContextHelp(false),100);
}
function initContextHelp(){
  document.addEventListener('pointerover',e=>{const tip=e.target?.closest?.('.help-tip');if(tip&&!contextHelpPinned)showContextHelp(tip,false);});
  document.addEventListener('pointerout',e=>{const tip=e.target?.closest?.('.help-tip');if(tip&&!tip.contains(e.relatedTarget))scheduleHideContextHelp();});
  document.addEventListener('focusin',e=>{const tip=e.target?.closest?.('.help-tip');if(tip&&!contextHelpPinned)showContextHelp(tip,false);});
  document.addEventListener('focusout',e=>{const tip=e.target?.closest?.('.help-tip');if(tip)scheduleHideContextHelp();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeContextHelpTip)hideContextHelp(true);});
  document.addEventListener('click',e=>{
    const tip=e.target?.closest?.('.help-tip');
    if(tip){
      e.preventDefault();e.stopPropagation();
      if(activeContextHelpTip===tip&&contextHelpPinned)hideContextHelp(true);
      else showContextHelp(tip,true);
      return;
    }
    if(activeContextHelpTip)hideContextHelp(true);
  },true);
  document.addEventListener('scroll',()=>{if(activeContextHelpTip)positionContextHelp();},true);
  window.addEventListener('resize',()=>{if(activeContextHelpTip)positionContextHelp();});
}
initContextHelp();
const SETTINGS_SECTION_RESET_EXCLUDED=new Set(['settings-overview','settings-about','settings-endpoints','settings-remote','settings-users','settings-profiles','settings-scenes','settings-family','settings-location','settings-integrations','settings-provider-health','settings-display-readiness','settings-system-health','settings-software-update','settings-update-history','settings-backup-recovery','settings-utilities']);
const SETTINGS_HEALTH_HELP={
  'health-server':'Shows whether this browser can reach LibreDisplay’s local server and API. If this fails, live data and Settings saves may stop working.',
  'health-weather':'Shows whether weather data has loaded successfully and is fresh enough for the dashboard.',
  'health-calendars':'Summarizes whether enabled calendar feeds loaded successfully and are updating normally.',
  'health-background':'Shows whether the selected background source is available and can supply the current display background.',
  'health-alerts':'Shows the weather-alert feed state, including whether alerts are enabled and whether the latest alert refresh succeeded.',
  'health-display':'Summarizes the current display/browser readiness used for fullscreen, kiosk, sizing, and presentation behavior.',
  'health-cache':'Shows whether LibreDisplay has cached local data it can use temporarily when a source or network connection is unavailable.',
  'health-integrations':'Summarizes configured integration/provider health so disconnected services are easier to identify.',
  'health-software':'Shows the installed LibreDisplay release and whether the update checker can determine if a newer release is available.',
  'display-readiness-viewport':'The browser viewport LibreDisplay is actually rendering into. Unexpected dimensions can explain clipping or layout scale problems.',
  'display-readiness-orientation':'Whether the current display is landscape or portrait, based on the live browser viewport.',
  'display-readiness-scale':'The browser/device pixel ratio used when drawing the dashboard. Unexpected zoom can make elements appear too large or too small.',
  'display-readiness-kiosk':'Shows whether the local display heartbeat is being received, which helps confirm the kiosk/display session is alive.',
  'system-health-deployment':'Shows how LibreDisplay is running on this host, including the detected deployment/runtime mode.',
  'system-health-uptime':'How long the LibreDisplay host has been running since its most recent restart.',
  'system-health-storage':'Free disk space available to LibreDisplay. Very low space can interfere with caches, backups, logs, and updates.',
  'system-health-data':'The local directory where LibreDisplay keeps its persistent application data.',
  'system-health-host':'Basic identity for the computer currently hosting LibreDisplay.',
  'system-health-hardware':'Detected host hardware summary used for support and performance troubleshooting.',
  'system-health-memory':'Current memory use and available temperature reading when the host exposes one.',
  'system-health-load':'Recent host load averages. Sustained high values can point to a device that is overloaded.',
  'system-health-browser':'Status of the local kiosk/browser process used to keep the dashboard visible on the display.',
  'system-health-connectivity':'Whether the host currently has the network connectivity LibreDisplay expects for configured online sources.',
  'system-health-integrity':'Checks whether important startup/runtime pieces are present and appear ready to launch normally.',
  'system-health-recovery':'Shows the state of LibreDisplay’s automatic recovery safeguards for the local runtime.'
};
function settingsSectionResetControls(section){return [...section.querySelectorAll('input,select,textarea')].filter(el=>{if(el.readOnly||el.type==='file'||el.type==='hidden'||['password','url','search'].includes(el.type))return false;if(el.matches('textarea'))return false;if(el.type==='text'&&!/-hex$/.test(el.id||''))return false;return true;});}
function restoreSettingsControlDefault(el){if(el instanceof HTMLSelectElement){const option=[...el.options].find(o=>o.defaultSelected)||el.options[0];if(option)el.value=option.value;}else if(el.type==='checkbox'||el.type==='radio')el.checked=el.defaultChecked;else el.value=el.defaultValue;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
function resetSettingsSection(sectionId){const section=document.getElementById(sectionId);if(!section||SETTINGS_SECTION_RESET_EXCLUDED.has(sectionId))return false;const controls=settingsSectionResetControls(section);for(const control of controls)restoreSettingsControlDefault(control);const appearance=LibreDisplayRuntime.getModule('appearance'),weather=LibreDisplayRuntime.getModule('weather'),config=LibreDisplayRuntime.getModule('config');if(sectionId==='settings-theme'){appearance.renderThemeChoices?.('libre-night');appearance.selectThemeChoice?.('libre-night');}if(sectionId==='settings-weather-details')weather.setWeatherDetailsForm?.(config.CFG_DEFAULTS);if(sectionId==='settings-layout'){appearance.settingsLayoutPresetKey='default';appearance.renderLayoutPresetGallery?.();}appearance.updateAppearanceLabels?.(appearance.appearanceFromForm?.()||config.cfg);appearance.previewAppearance?.();systemApi.markSettingsDirty?.();const btn=section.querySelector(':scope > .settings-section-reset');if(btn){const original=btn.textContent;btn.textContent='Reset ✓';btn.classList.add('reset-done');setTimeout(()=>{if(btn.isConnected){btn.textContent=original;btn.classList.remove('reset-done');}},1200);}return true;}
function enhanceSettingsSectionResets(){document.querySelectorAll('.s-section[data-settings-tab]').forEach(section=>{if(SETTINGS_SECTION_RESET_EXCLUDED.has(section.id)||section.querySelector(':scope > .settings-section-reset'))return;const controls=settingsSectionResetControls(section),special=section.id==='settings-weather-details';if(!controls.length&&!special)return;const btn=document.createElement('button');btn.type='button';btn.className='settings-section-reset';btn.textContent='Reset';btn.setAttribute('aria-label',`Reset ${section.querySelector(':scope > h3')?.childNodes[0]?.textContent?.trim()||'section'} to LibreDisplay defaults`);btn.title='Reset only this section to LibreDisplay defaults';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();resetSettingsSection(section.id);});section.appendChild(btn);});}
function enhanceSettingsHealthHelp(){for(const [valueId,help] of Object.entries(SETTINGS_HEALTH_HELP)){const value=document.getElementById(valueId),card=value?.closest('.health-card'),label=card?.querySelector('.health-label');if(!label||label.querySelector('.help-tip'))continue;const title=String(label.textContent||'Health status').trim();const make=settingsStateApi().makeSettingsHelpButton;label.appendChild(make?make(title,help,true):Object.assign(document.createElement('button'),{type:'button',className:'help-tip settings-auto-help',textContent:'?'}));const tip=label.querySelector('.help-tip:last-child');if(tip&&!tip.dataset.help){tip.dataset.help=help;tip.dataset.helpTitle=title;tip.setAttribute('aria-label',`${title} help`);tip.setAttribute('aria-expanded','false');tip.setAttribute('aria-controls','context-help-popover');}}}
function enhanceSettingsSectionPolish(){enhanceSettingsSectionResets();enhanceSettingsHealthHelp();}

window.addEventListener('beforeunload',e=>{const setup=document.getElementById('setup');if(systemApi.settingsDirty&&(settingsStateApi().settingsPreviewMode||(setup&&!setup.classList.contains('hidden')))){e.preventDefault();e.returnValue='';}});


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("settings", {hideDashboardCursor,showDashboardCursorTemporarily,initCursorAutoHide,settingsWheelScrollerFrom,initSettingsWheelGuard,positionContextHelp,showContextHelp,hideContextHelp,scheduleHideContextHelp,initContextHelp,settingsSectionResetControls,restoreSettingsControlDefault,resetSettingsSection,enhanceSettingsSectionResets,enhanceSettingsHealthHelp,enhanceSettingsSectionPolish}, {
  "CURSOR_HIDE_DELAY_MS": {configurable:true,get:()=>CURSOR_HIDE_DELAY_MS},
  "cursorHideTimer": {configurable:true,get:()=>cursorHideTimer,set:(value)=>{cursorHideTimer=value;}},
  "activeContextHelpTip": {configurable:true,get:()=>activeContextHelpTip,set:(value)=>{activeContextHelpTip=value;}},
  "contextHelpPinned": {configurable:true,get:()=>contextHelpPinned,set:(value)=>{contextHelpPinned=value;}},
  "contextHelpHideTimer": {configurable:true,get:()=>contextHelpHideTimer,set:(value)=>{contextHelpHideTimer=value;}}
}, {globalFunctions:['hideContextHelp'],globalStates:[]});
