// Settings tabs, section metadata, help registry, search, and navigation.
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');

const SETTINGS_TABS=['overview','weather','naturescape','calendars','backgrounds','look','layout','family','integrations','system'];
const SETTINGS_TAB_TITLES={
  overview:'Home',
  weather:'Weather',
  naturescape:'Naturescape',
  calendars:'Calendars',
  backgrounds:'Backgrounds',
  look:'Personalization',
  layout:'Layout',
  family:'Family',
  integrations:'Integrations',
  system:'System'
};
const SETTINGS_TAB_HINTS={
  overview:'Dashboard status, displays, common actions, and a quick path to the settings you use most.',
  weather:'Weather location, forecast behavior, precipitation, atmosphere, storms, Weather Details, and severe-weather alerts.',
  naturescape:'Season-aware living scenery, regional wildlife, birds, butterflies, insects, leaves, grass, petals, crystals, and frost.',
  calendars:'Calendar feeds, imported files, event presentation, refresh timing, and display rules.',
  backgrounds:'Photo sources, local or NAS folders, slideshow rotation, and background presentation.',
  look:'Themes, typography, accessibility, templates, and the Settings-button experience.',
  layout:'Arrange the dashboard, choose what is visible, and tune sizing, spacing, ranges, and default geometry.',
  family:'Household members, chores, rewards, and touch-mode behavior.',
  integrations:'Browse installed providers, add integration blocks, and review connection health.',
  system:'Accounts, remote access, profiles, scenes, updates, backup, diagnostics, and recovery.'
};
function updateSettingsPageHeader(searchQuery=''){
  const title=document.getElementById('settings-page-title');
  const hint=document.getElementById('settings-tab-hint');
  const q=String(searchQuery||'').trim();
  if(q){
    if(title)title.textContent='Search results';
    if(hint)hint.textContent=`Matches for “${q}” across LibreDisplay settings.`;
    return;
  }
  if(title)title.textContent=SETTINGS_TAB_TITLES[activeSettingsTab]||'Settings';
  if(hint)hint.textContent=SETTINGS_TAB_HINTS[activeSettingsTab]||'';
}
const SETTINGS_SECTION_SUMMARIES={
  'settings-overview':'Health checks and the most common dashboard actions.',
  'settings-about':'Version, project identity and local-first behavior.',
  'settings-endpoints':'Create and manage independent screen endpoints from one server.',
  'settings-remote':'Manage LibreDisplay from another device on your trusted network.',
  'settings-users':'Create local accounts and control which displays each role can manage.',
  'settings-profiles':'Save, duplicate, capture, and apply complete dashboard configurations across named displays.',
  'settings-scenes':'Schedule saved Profiles by display, day and time.',
  'settings-family':'Household members, chores, rewards and touch-mode protection.',
  'settings-location':'Weather location and the label shown on the dashboard.',
  'settings-calendars':'Calendar feeds, imported files, refresh behavior and display priority.',
  'settings-alerts':'Enable severe-weather alerts and control their motion.',
  'settings-alert-appearance':'Power-user filtering and alert-card presentation.',
  'settings-backgrounds':'Picture sources, Google Photos, local/NAS folders, rotation and order.',
  'settings-weather-options':'Temperature units and weather refresh timing.',
  'settings-weather-motion':'Enable and preview the full-screen atmosphere, choose presets, and tune global weather behavior.',
  'settings-weather-rain':'Tune rainfall density, drop geometry, speed, angle, depth, splashes, visibility, and glow.',
  'settings-weather-snow':'Tune snowfall density, flake size, drift, speed, visibility, spin, and depth.',
  'settings-weather-fog':'Tune fog and mist density, movement, visibility, blur, and vertical coverage.',
  'settings-naturescape-overview':'Choose automatic or manual season behavior and the overall Naturescape intensity.',
  'settings-naturescape-flora':'Tune leaves, grass, petals, their movement, size, amount, and visibility.',
  'settings-naturescape-insects':'Tune bees, butterflies, fireflies, daylight behavior, glow, diversity, movement, and visibility.',
  'settings-naturescape-birds':'Tune regional birds, flocking, size, flight, visibility, height, species diversity, and rare/large species.',
  'settings-naturescape-owls':'Optional owl naturescape with region-aware species, ground, glide and swoop behavior, size, visibility and diversity controls.',
  'settings-naturescape-winter':'Tune winter crystals and extreme-cold edge frost independently from snowfall.',
  'settings-weather-sky':'Tune clouds, sun, wind, lightning realism, reduced motion, and OLED dimming behavior.',
  'settings-weather-details':'Choose, enable and reorder Weather Details metrics.',
  'settings-background-style':'Power-user controls for how backgrounds are rendered.',
  'settings-templates':'Apply safe layout and presentation starting points without replacing data sources.',
  'settings-theme':'Choose a LibreDisplay color theme and dashboard font.',
  'settings-accessibility':'Language, reduced motion, contrast and keyboard focus.',
  'settings-settings-button':'Move and soften the Settings cog so it stays available without distracting from the dashboard.',
  'settings-integrations':'Browse installed providers, test live connections, and review refresh health without exposing credentials.',
  'settings-provider-health':'Review weather, calendars, backgrounds, alerts, and integrations in one privacy-safe troubleshooting view.',
  'settings-layout-presentation':'Text treatment and default content sizing for built-in dashboard elements.',
  'settings-layout':'Preview and apply dashboard layouts, arrange elements, and choose clock/content visibility.',
  'settings-layout-geometry':'Power-user geometry, forecast density, calendar range, spacing and scrolling controls.',
  'settings-display-readiness':'Checks target-screen viewport, orientation, browser scale, and local kiosk heartbeat so display problems are visible without changing the layout.',
  'settings-system-health':'Host uptime, deployment mode, storage headroom, and local runtime health.',
  'settings-software-update':'Check GitHub releases and install supported native updates directly from Settings.',
  'settings-update-history':'Review private pre-update snapshots and safely return a native installation to a previous release.',
  'settings-backup-recovery':'Portable configuration backups and local restore points for safe migration and recovery.',
  'settings-utilities':'Backup, restore, cache, diagnostics and recovery tools.'
};
const SETTINGS_CONTROL_HELP={
  'settings-section-select':'Jump directly to a section in the current Settings category without changing any values.',
  'account-username':'The local sign-in name for this account. Usernames are stored on your LibreDisplay server, not in a cloud account.',
  'account-role':'Owner can manage the server and all displays. Viewer access is intended for limited display management and can be restricted to endpoint IDs.',
  'account-password':'Sets or replaces this local account password. Leaving it blank while editing an existing user keeps the current password.',
  'account-endpoints':'Comma-separated display endpoint IDs this non-owner account may manage. Owners automatically have access to every display.',
  's-profile-select':'Choose a saved dashboard profile to load, duplicate, update, apply to another display, or use as the base for a scheduled scene.',
  's-profile-name':'The friendly name stored with this dashboard profile. Profiles capture presentation and content configuration for later reuse.',
  'scene-automatic':'When enabled, LibreDisplay evaluates scene schedules and switches profiles automatically for the selected display and time.',
  'scene-base-profile':'The profile used whenever no scheduled scene currently matches. This prevents the dashboard from being left in an old scene.',
  'family-members-editor':'One household member per line using Name|emoji. The emoji is optional and is shown in Family blocks and touch views.',
  'family-chores-editor':'One chore per line. Use Chore|member|points|recurrence|days so LibreDisplay can assign points and decide when the chore appears.',
  'family-rewards-editor':'One reward per line using Reward|cost|member. Omit member when a reward should be available to everyone.',
  'family-pin':'Protects owner-only Family actions on touch displays. Use 4–12 digits and keep it separate from account passwords.',
  's-city':'Search for a city or place, then choose the exact region/country match. The selected coordinates — not just the typed name — determine weather and alerts.',
  's-locname':'Optional friendly name shown above Current Weather on the dashboard. It changes only the visible label; the verified coordinates remain unchanged.',
  's-calendar-refresh':'How often LibreDisplay checks enabled calendar feeds for changes. Shorter intervals update sooner but make more network requests.',
  's-calendar-time-style':'Controls whether calendar items show only their start time or a start–end range when an end time is available.',
  's-calendar-legend':'Shows a color legend below the calendar band so multiple calendar sources are easier to identify at a glance.',
  's-calendar-show-continuation':'Adds a Continues marker to multi-day events carried over from an earlier day, making long events easier to distinguish.',
  's-alerts-enabled':'Turns live severe-weather alerts on or off. Disabling this does not disable the normal weather forecast.',
  's-alert-show-expiry':'Shows when a live alert is expected to expire when the provider supplies an expiry time.',
  's-alert-show-meta':'Shows secondary alert information such as affected area and source. Hide it when you want a simpler alert card.',
  's-bg-source':'Selects where dashboard background images come from: stock imagery, Google Photos, local/NAS folders, or another supported source.',
  's-stock-category':'Chooses the built-in stock-photo theme used when the background source is set to stock images.',
  's-stock-query':'Overrides the stock category with your own search phrase. Keep the phrase broad for a healthier photo rotation.',
  's-stock-resolution':'Requests a preferred stock-image resolution. Choose a size close to the wall display resolution to balance sharpness and bandwidth.',
  's-media-folders':'One local or mounted NAS directory per line. LibreDisplay scans these paths for supported image files when folder backgrounds are enabled.',
  's-media-recursive':'Also scans folders below each configured picture directory. Enable this when your photo library is organized into subfolders.',
  's-photo-interval':'How long each background remains visible before LibreDisplay advances to the next picture.',
  's-photo-random-start':'Starts each browser session at a different position in the photo list instead of always beginning with the first image.',
  's-unit':'Selects a consistent weather unit system: Imperial uses °F, mph and inches; Metric uses °C, km/h and millimeters.',
  's-weather-refresh':'How often LibreDisplay requests fresh weather data. A shorter interval updates sooner but uses more network/API traffic.',
  's-bg-top':'Darkens or lightens the upper portion of the background overlay so calendar text remains readable over bright photos.',
  's-bg-bottom':'Darkens or lightens the lower portion of the background overlay behind weather, clock and forecast content.',
  's-bg-transition':'Controls the cross-fade duration when the background image changes. Set lower for faster transitions or higher for a softer slideshow.',
  's-bg-position':'Chooses which part of a photo is favored when Cover cropping is used. Useful when important subjects are near an edge.',
  's-font-family':'Sets the default dashboard typeface. Per-element typography overrides made in Arrange can still replace it.',
  's-locale':'Controls language-sensitive date and time formatting. It does not change weather source data or your configured time zone.',
  's-cog-position':'Moves the Settings button to a different screen corner without changing the dashboard layout itself.',
  's-cog-size':'Changes the clickable Settings button size. Larger values are easier to use on touch displays.',
  's-cog-opacity':'Controls how visible the Settings button is while idle. It becomes more visible when the pointer is active.',
  's-cog-label':'Shows a small Settings hint during hover or first discovery so new users can find the configuration menu more easily.',
  's-secondary-opacity':'Changes the strength of secondary labels and supporting text without changing the primary dashboard values.',
  's-text-shadow':'Adjusts the shadow behind dashboard text. More shadow can improve readability over busy or bright backgrounds.',
  's-text-color':'Sets the dashboard primary text color. Theme colors and per-element Arrange overrides can still affect individual content.',
  's-text-hex':'Enter the same primary text color as a hexadecimal value when you need an exact color.',
  's-ui-calendar':'Scales calendar text globally. Arrange can override the Calendar element or individual calendar text sections afterward.',
  's-ui-current':'Scales the Current Weather element content globally without changing its Arrange rectangle.',
  's-ui-clock':'Scales Clock & Date content globally without changing the outer Arrange rectangle.',
  's-ui-forecast':'Scales both Daily and Hourly forecast typography globally. Each forecast can still be edited separately in Arrange.',
  's-ui-details':'Scales Weather Details labels, icons and values globally. Arrange can override the Weather Details element afterward.',
  's-ui-alert':'Scales text and icons inside Weather Alert cards. Alert-card height is controlled separately under Content.',
  's-calendar-height':'Changes the default height reserved for the calendar band. Saved custom Arrange rectangles take priority once a custom layout is active.',
  's-bottom-height':'Changes the default vertical space reserved for weather, clock and forecasts before a custom Arrange layout is used.',
  's-left-width':'Changes the default width of the weather/clock information area. Custom Arrange positions take priority when saved.',
  's-side-padding':'Adds or removes breathing room along the left and right edges of the default dashboard layout.',
  's-forecast-gap':'Changes horizontal space between forecast columns. Reduce it when many forecast periods must fit on a smaller display.',
  's-forecast-row-gap':'Changes vertical space between the Daily and Hourly forecast rows in the default layout.',
  's-hourly-hours':'Sets how many upcoming hourly forecast periods are rendered. More hours require more horizontal space.',
  's-daily-days':'Sets how many daily forecast columns are rendered. Choose fewer days for larger, less crowded forecast content.',
  's-calendar-days':'Sets how many calendar days are loaded into the dashboard calendar band.',
  's-calendar-columns':'Sets how many calendar day columns are visible per row before additional days continue vertically.',
  's-calendar-cell-height':'Sets the vertical space available to each calendar row. Increase it when showing more events per day.',
  's-layout-snap':'When enabled, dragging and resizing in Arrange lands on the selected grid spacing. Turn it off for pixel-level placement.',
  's-time-format':'Chooses 12-hour or 24-hour clock formatting for the dashboard clock.',
  's-date-format':'Chooses how the date under the clock is written. This changes presentation only.',
  's-show-no-events':'Shows No events inside empty calendar days. Disable it for a quieter calendar when many days are empty.',
  's-show-event-times':'Shows calendar event start times. Disable it when event titles are more important than exact times.',
  's-show-daily':'Shows or hides the Daily Forecast block. Hiding it does not delete its saved Arrange geometry.',
  's-show-hourly':'Shows or hides the Hourly Forecast block. Hiding it does not delete its saved Arrange geometry.',
  's-show-precip':'Shows precipitation probability in Daily and Hourly forecast columns when weather data provides it.',
  's-show-seconds':'Adds seconds to the dashboard clock. Disable it for a calmer display and fewer visible clock changes.',
  's-show-ampm':'Shows AM/PM when the clock uses 12-hour time. This setting has no effect in 24-hour mode.',
  's-show-date':'Shows the formatted date beneath the clock. The date format is controlled separately.',
  's-show-current-icon':'Shows the large current-condition weather icon beside the Current Weather values.',
  'integration-directory-category':'Filters the integration directory by provider category without changing any configured integrations.',
  'integration-directory-state':'Filters the integration directory to all, configured, or not-yet-configured providers.',
  'integration-directory-search':'Searches installed integration providers by name and description. It does not contact external services.',
  's-alert-test':'Creates simulated weather alerts locally so you can preview alert layout and motion without waiting for a real warning.',
  's-alert-size':'Changes the vertical space used by each alert card. Text size is controlled separately in Arrange.',
  's-alert-motion':'Choose stepped rotation, continuous scrolling when needed, or a static alert list.',
  's-alert-motion-speed':'Sets the continuous-scroll speed in pixels per second. It is used only when Alert motion is Continuous.',
  's-alert-scroll':'Sets how long each stepped alert position remains visible before advancing.',
  's-alert-refresh':'Sets how often LibreDisplay checks for new live weather alerts.',
  's-alert-opacity':'Changes the alert-card surface opacity without changing text size.',
  's-alert-min-severity':'Filters live alerts below the selected severity. Simulated test alerts remain mixed so every style can be previewed.',
  's-photos':'The Google Photos shared-album URL used when Google Photos is selected as the background source.',
  's-photo-order':'Controls whether background photos advance in their listed order or shuffle.',
  's-photo-preload':'Loads and decodes the exact upcoming image before the transition while keeping the current photo visible until it is ready.',
  's-background-motion':'Allows animated GIF, video and Motion JPEG backgrounds from local/NAS folders. Continuous decoding can be demanding on lower-powered devices.',
  's-bg-startup-priority':'Starts weather, air quality, calendars, and the dashboard shell before refreshing the background source. The last displayed background can be reused immediately while source discovery runs.',
  's-bg-startup-delay':'Sets the short delay before background-source discovery begins when startup prioritization is enabled.',
  's-weather-animations':'Master switch for optional decorative motion based on the current weather.',
  's-weather-widget-animations':'Adds gentle motion to current and forecast weather icons without changing weather data.',
  's-weather-fullscreen-effects':'Adds lightweight weather atmosphere over the background while keeping dashboard content above it.',
  's-weather-effect-mode':'Choose automatic atmosphere, precipitation-only effects, or all ambient weather effects.',
  's-weather-effect-intensity':'Controls how many rain drops, snowflakes, cloud fields, or other weather particles are shown.',
  's-weather-effect-opacity':'Controls how visible the full-screen atmosphere is over the background.',
  's-weather-effect-speed':'Controls decorative weather animation speed only; provider refresh timing is unchanged.',
  's-weather-effect-lightning':'Allows brief full-screen lightning flashes when current conditions report thunderstorms.',
  's-weather-effect-reduced-motion':'Disables decorative weather motion when LibreDisplay or the device is using reduced motion.',
  's-weather-effect-pause-dimmed':'Pauses full-screen weather atmosphere while OLED/display protection is dimming the display.',
  's-bg-blur':'Blurs the background image only. A small blur can make foreground text easier to read over detailed photos.',
  's-bg-fit':'Cover fills the screen and may crop edges. Contain keeps the whole image visible and may leave unused space.',
  's-settings-ui-size':'Changes only the Settings interface size. Dashboard element sizes remain controlled separately.',
  's-burnin-care-enabled':'Master switch for display care. Turning it off pauses pixel shifting, dimming, quiet hours, and deep protection without erasing their settings.',
  's-burnin-idle-dimming':'Dims the display after a configurable period without local mouse, keyboard, touch, or wheel input. It is independent of Quiet hours.',
  's-burnin-quiet-hours':'Enables scheduled dimming between the configured local start and end times. Pixel shifting does not require this option.',
  's-burnin-quiet-start':'The local display time when scheduled quiet-hours dimming begins.',
  's-burnin-quiet-end':'The local display time when scheduled quiet-hours dimming ends and full brightness returns automatically.',
  's-burnin-quiet-wake-enabled':'Allows local input to temporarily wake the display during Quiet hours.',
  's-burnin-quiet-wake':'When temporary wake is enabled, controls how long the display stays awake during Quiet hours after local input.',
  's-burnin-pixel-shift':'Moves the rendered dashboard and background on a slow cycle to distribute static OLED wear without changing saved Arrange coordinates. It can run by itself.',
  's-burnin-idle':'Sets how long the display stays untouched before Idle dimming begins.',
  's-burnin-brightness':'Sets the brightness used by Idle dimming and Quiet hours.',
  's-burnin-deep-protection':'Adds a stronger protection stage. A Deep brightness of 0% produces a black screen until local interaction or the configured Quiet Hours wake behavior.',
  's-burnin-deep-trigger':'Choose whether Deep protection counts extended inactivity or elapsed time inside Quiet Hours. Existing scheduled OLED setups keep their previous quiet-hours behavior after upgrade.',
  's-burnin-deep-idle':'Sets the time without local input before Deep protection begins.',
  's-burnin-deep-brightness':'Sets the brightness during deep protection. 0% is fully black and provides the strongest idle protection.',
  's-burnin-shift-mode':'Controls whether pixel shifting runs continuously or only after the display has entered an idle-dim stage.',
  's-burnin-shift-interval':'Sets how often the OLED pixel-shift position changes. Shorter intervals distribute wear more aggressively.',
  's-burnin-shift-distance':'Sets how far the rendered dashboard can shift from its saved position. Larger distances spread wear further but can be easier to notice.',
  's-burnin-shift-transition':'Controls how quickly each pixel-shift movement occurs. Use 0 seconds for an instant move or a longer value for a gentler transition.',
  's-burnin-pause-animations':'Pauses decorative weather motion and other nonessential animation while display protection has the screen dimmed.',
  's-motion-preference':'Automatic follows the device preference. Reduced motion minimizes decorative animation while keeping data updates working.',
  's-high-contrast':'Strengthens borders and secondary text contrast throughout Settings for easier visual separation.',
  's-focus-outline':'Keeps a strong keyboard-focus ring visible when navigating Settings with Tab, Shift+Tab, Enter or Space.',
  's-calendar-scroll-mode':'Manual keeps the calendar stationary. Slow auto-scroll moves it only when calendar content is taller than the available area.',
  's-calendar-scroll-speed':'Sets the calendar auto-scroll speed and is used only when Calendar overflow is set to Slow auto-scroll.',
  's-calendar-max-events':'Limits the number of calendar entries shown in each day cell before the remaining events are omitted from that cell.',
  's-layout-grid':'Sets the movement/resizing grid used by Arrange when Snap is enabled. Smaller values allow finer placement.',
  's-settings-search':'Searches setting names, section summaries, aliases and context-help text across every Settings category.'
};

function settingsControlLabel(control){
  if(!(control instanceof Element))return null;
  const escaped=window.CSS?.escape?CSS.escape(control.id||''):String(control.id||'').replace(/[^a-zA-Z0-9_-]/g,'');
  return control.closest('label')||(escaped?document.querySelector(`label[for="${escaped}"]`):null)||control.closest('.s-row')?.querySelector(':scope > label')||null;
}
function cleanSettingsLabelText(label){
  if(!label)return 'Setting';
  const clone=label.cloneNode(true);
  clone.querySelectorAll('.help-tip,.range-value').forEach(el=>el.remove());
  return String(clone.textContent||'Setting').replace(/\s+/g,' ').trim().replace(/[—:-]+$/,'')||'Setting';
}
function makeSettingsHelpButton(title,help,auto=true){
  const btn=document.createElement('button');
  btn.type='button';btn.className='help-tip'+(auto?' settings-auto-help':'');btn.textContent='?';
  btn.dataset.help=String(help||'').trim();btn.dataset.helpTitle=String(title||'Setting').trim();
  btn.setAttribute('aria-label',`${btn.dataset.helpTitle} help`);btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','context-help-popover');
  return btn;
}
function enhanceSettingsControlHelp(){
  for(const [id,help] of Object.entries(SETTINGS_CONTROL_HELP)){
    const control=document.getElementById(id);if(!control)continue;
    const label=settingsControlLabel(control);if(!label||label.querySelector('.help-tip'))continue;
    label.appendChild(makeSettingsHelpButton(cleanSettingsLabelText(label),help,true));
  }
  document.querySelectorAll('.s-section[data-settings-tab]').forEach(section=>{
    const h=section.querySelector(':scope > h3');if(!h||h.querySelector('.help-tip'))return;
    const title=cleanSettingsLabelText(h),help=SETTINGS_SECTION_SUMMARIES[section.id]||'';if(!help)return;
    h.appendChild(makeSettingsHelpButton(title,help,true));
  });
}

let activeSettingsTab='overview';
let settingsViewMode='essential';
let settingsSectionsEnhanced=false;

function loadSettingsViewMode(){
  try{settingsViewMode=localStorage.getItem('libredisplay_settings_view')||'essential';}catch(e){settingsViewMode='essential';}
  if(!['essential','all'].includes(settingsViewMode))settingsViewMode='essential';
}
function setSettingsViewMode(mode){
  settingsViewMode=mode==='all'?'all':'essential';
  try{localStorage.setItem('libredisplay_settings_view',settingsViewMode);}catch(e){}
  const search=document.getElementById('s-settings-search');
  if(search&&search.value.trim()){filterSettings(search.value);return;}
  applySettingsSectionVisibility();
}
function enhanceSettingsSections(){
  if(settingsSectionsEnhanced)return;
  settingsSectionsEnhanced=true;
  let collapsed=[];
  try{collapsed=JSON.parse(sessionStorage.getItem('libredisplay_settings_collapsed')||'[]');if(!Array.isArray(collapsed))collapsed=[];}catch(e){collapsed=[];}
  document.querySelectorAll('.s-section[data-settings-tab]').forEach(section=>{
    const h=section.querySelector(':scope > h3');
    if(!h)return;
    h.removeAttribute('title');
    h.setAttribute('role','button');
    h.setAttribute('tabindex','0');
    h.addEventListener('click',e=>{if(e.target?.closest?.('.help-tip'))return;toggleSettingsSection(section.id);});
    h.addEventListener('keydown',e=>{if(e.target?.closest?.('.help-tip'))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleSettingsSection(section.id);}});
    if(!section.querySelector(':scope > .section-summary')){
      const summary=document.createElement('div');summary.className='section-summary';
      summary.textContent=SETTINGS_SECTION_SUMMARIES[section.id]||'';
      h.insertAdjacentElement('afterend',summary);
    }
    if(collapsed.includes(section.id))section.classList.add('section-collapsed');
    h.setAttribute('aria-expanded',section.classList.contains('section-collapsed')?'false':'true');
  });
}
function saveCollapsedSettingsSections(){
  const ids=[...document.querySelectorAll('.s-section.section-collapsed')].map(s=>s.id).filter(Boolean);
  try{sessionStorage.setItem('libredisplay_settings_collapsed',JSON.stringify(ids));}catch(e){}
}
function toggleSettingsSection(id,force){
  const section=document.getElementById(id);if(!section)return;
  const collapsed=force===undefined?!section.classList.contains('section-collapsed'):!!force;
  section.classList.toggle('section-collapsed',collapsed);
  section.querySelector(':scope > h3')?.setAttribute('aria-expanded',collapsed?'false':'true');
  saveCollapsedSettingsSections();
}
function setAllSettingsSectionsCollapsed(collapsed){
  document.querySelectorAll('.s-section[data-settings-tab].tab-active:not(.settings-advanced-hidden)').forEach(s=>{s.classList.toggle('section-collapsed',!!collapsed);s.querySelector(':scope > h3')?.setAttribute('aria-expanded',collapsed?'false':'true');});
  saveCollapsedSettingsSections();
}
function settingsSectionRoleAllowed(section){return !(section?.dataset?.ownerOnly==='1'&&bootstrapApi.SESSION_ROLE!=='owner');}
function visibleSettingsSectionsForTab(tab){
  return [...document.querySelectorAll(`.s-section[data-settings-tab="${tab}"]`)].filter(s=>settingsSectionRoleAllowed(s)&&(settingsViewMode==='all'||s.dataset.settingsLevel!=='advanced'));
}
function buildSettingsSectionJump(){
  const sel=document.getElementById('settings-section-select');if(!sel)return;
  const sections=visibleSettingsSectionsForTab(activeSettingsTab);
  sel.innerHTML='';
  for(const section of sections){
    const opt=document.createElement('option');opt.value=section.id;
    opt.textContent=section.querySelector(':scope > h3')?.childNodes[0]?.textContent?.trim()||section.querySelector(':scope > h3')?.textContent?.trim()||section.id;
    sel.appendChild(opt);
  }
  sel.disabled=!sections.length;
}
function jumpToSettingsSection(id){
  const section=document.getElementById(id);if(!section)return;
  section.classList.remove('section-collapsed');section.querySelector(':scope > h3')?.setAttribute('aria-expanded','true');saveCollapsedSettingsSections();
  section.scrollIntoView({behavior:'smooth',block:'start'});
}
function applySettingsSectionVisibility(){
  document.getElementById('settings-mode-essential')?.classList.toggle('active',settingsViewMode==='essential');
  document.getElementById('settings-mode-all')?.classList.toggle('active',settingsViewMode==='all');
  const note=document.getElementById('settings-view-note');
  if(note)note.textContent=settingsViewMode==='essential'?'Essentials keeps the everyday controls visible. Search still finds everything.':'All shows every available control, including advanced and troubleshooting options.';
  let visible=0;
  document.querySelectorAll('.s-section[data-settings-tab]').forEach(section=>{
    const roleHidden=!settingsSectionRoleAllowed(section);
    const advancedHidden=settingsViewMode!=='all'&&section.dataset.settingsLevel==='advanced';
    section.classList.toggle('settings-advanced-hidden',advancedHidden||roleHidden);
    const on=section.dataset.settingsTab===activeSettingsTab&&!advancedHidden&&!roleHidden;
    section.classList.toggle('tab-active',on);if(on)visible++;
  });
  const empty=document.getElementById('settings-empty-state');if(empty)empty.classList.toggle('show',visible===0);
  buildSettingsSectionJump();
  updateSettingsPageHeader();
}

function switchSettingsTab(tab,scrollTop=true){
  if(tab==='content')tab='weather';
  tab=SETTINGS_TABS.includes(tab)?tab:'overview';
  if(tab!=='overview'&&![...document.querySelectorAll(`.s-section[data-settings-tab="${tab}"]`)].some(settingsSectionRoleAllowed))tab='overview';
  activeSettingsTab=tab;
  try{sessionStorage.setItem('libredisplay_settings_tab',tab);}catch(e){}
  if(scrollTop){
    const search=document.getElementById('s-settings-search');
    if(search)search.value='';
    const status=document.getElementById('settings-search-status');
    if(status){status.style.display='none';status.textContent='';}
  }
  document.querySelectorAll('.settings-tab-btn').forEach(btn=>{
    const on=btn.dataset.tab===tab;
    btn.classList.toggle('active',on);
    btn.setAttribute('aria-selected',on?'true':'false');
  });
  applySettingsSectionVisibility();
  if(tab==='system'&&settingsSectionRoleAllowed(document.getElementById('settings-backup-recovery'))){loadRestorePoints();loadReleaseRollbacks();}
  if(scrollTop){
    const box=document.querySelector('.setup-box');
    if(box)box.scrollTo({top:0,behavior:'smooth'});
  }
}

const SETTINGS_SEARCH_ALIASES={
  'settings-calendars':'calendar calendars calander agenda events ics google proton outlook icloud',
  'settings-alerts':'alerts warning warnings severe weather test preview rotate rotation scroll scrolling motion',
  'settings-weather-motion':'weather animation animations preview test lab immersive fullscreen overlay motion effects',
  'settings-weather-rain':'weather rain drizzle precipitation drops splash splashes density wet streaks',
  'settings-weather-snow':'weather snow flakes snowfall drift spin density winter',
  'settings-weather-fog':'weather fog mist haze density opacity blur layer visibility',
  'settings-naturescape-overview':'naturescape nature season seasonal spring summer fall autumn winter region hemisphere climate living scenery',
  'settings-naturescape-flora':'naturescape nature leaves leaf grass petals plants flora autumn spring summer opacity visibility sway wind',
  'settings-naturescape-insects':'naturescape wildlife bugs insects bees butterflies butterfly fireflies firefly species glow day night opacity visibility',
  'settings-naturescape-birds':'naturescape wildlife birds bird species sparrow cardinal blue jay finch owl hawk eagle crane egret flock flight opacity visibility rare large',
  'settings-naturescape-winter':'naturescape winter crystal crystals frost cold ice edge opacity visibility',
  'settings-weather-sky':'weather sky clouds sun wind storm thunder lightning bolt flash reduced motion oled dimming',
  'settings-backgrounds':'background backgrounds picture pictures photo photos images slideshow google album nas media folder startup loading performance',
  'settings-accessibility':'accessibility readable readability larger large text contrast focus keyboard motion language settings size eyesight vision',
  'settings-layout-presentation':'appearance typography sizing font text color colour content scale',
  'settings-layout':'appearance arrange layout editor inspector resize visibility clock forecast show hide snap grid',
  'settings-layout-geometry':'layout geometry spacing ranges columns calendar forecast sizing scroll alignment',
  'settings-settings-button':'settings cog gear button corner opacity',
  'settings-system-health':'health system host uptime disk storage deployment diagnostics troubleshooting',
  'settings-software-update':'update upgrade release version github install restart reboot',
  'settings-update-history':'update history rollback previous version recovery release downgrade restore safety snapshot',
  'settings-backup-recovery':'backup restore recovery migrate migration portable export import restore point rollback profiles scenes',
  'settings-utilities':'backup restore diagnostics recovery cache export import'
};
function settingsSectionSearchText(section){
  const attrs=[...section.querySelectorAll('[data-help],[aria-label],[placeholder],[title]')].flatMap(el=>[el.dataset?.help,el.getAttribute('aria-label'),el.getAttribute('placeholder'),el.getAttribute('title')]).filter(Boolean).join(' ');
  return `${section.textContent} ${section.id} ${section.dataset.settingsTab||''} ${SETTINGS_SECTION_SUMMARIES[section.id]||''} ${SETTINGS_SEARCH_ALIASES[section.id]||''} ${attrs}`.toLowerCase();
}

function settingsSearchControlText(el){
  const label=settingsControlLabel(el)||'';
  const attrs=[el.id,el.name,el.dataset?.help,el.getAttribute?.('aria-label'),el.getAttribute?.('placeholder'),el.getAttribute?.('title')].filter(Boolean).join(' ');
  const options=el.tagName==='SELECT'?[...el.options].map(o=>o.textContent).join(' '):'';
  return `${label} ${attrs} ${options}`.replace(/\s+/g,' ').trim().toLowerCase();
}
function openSettingsSearchResult(sectionId,controlId=''){
  const section=document.getElementById(sectionId);if(!section)return;
  const search=document.getElementById('s-settings-search');if(search)search.value='';
  document.getElementById('settings-search-results')?.replaceChildren();
  const status=document.getElementById('settings-search-status');if(status){status.style.display='none';status.textContent='';}
  if(section.dataset.settingsLevel==='advanced'){settingsViewMode='all';try{localStorage.setItem('libredisplay_settings_view','all');}catch(e){}}
  switchSettingsTab(section.dataset.settingsTab||'overview',false);toggleSettingsSection(section.id,false);applySettingsSectionVisibility();
  const target=controlId?document.getElementById(controlId):section;
  requestAnimationFrame(()=>{target?.scrollIntoView({behavior:'smooth',block:'center'});if(target&&target!==section){target.focus?.({preventScroll:true});const hit=target.closest('.s-row,.checkline,.utility-actions')||target;hit.classList.add('settings-search-hit');setTimeout(()=>hit.classList.remove('settings-search-hit'),1800);}});
}
function filterSettings(value){
  const raw=String(value||'').trim(),tokens=raw.toLowerCase().split(/\s+/).filter(Boolean);
  const status=document.getElementById('settings-search-status'),results=document.getElementById('settings-search-results');
  const sections=[...document.querySelectorAll('.s-section[data-settings-tab]')];
  if(!tokens.length){results?.replaceChildren();applySettingsSectionVisibility();if(status){status.style.display='none';status.textContent='';}return;}
  updateSettingsPageHeader(raw);if(results)results.replaceChildren();let matches=0,advancedMatches=0,controlMatches=0;
  sections.forEach(section=>{
    section.classList.remove('settings-advanced-hidden');const hay=settingsSectionSearchText(section),on=tokens.every(t=>hay.includes(t));section.classList.toggle('tab-active',on);
    if(!on)return;section.classList.remove('section-collapsed');section.querySelector(':scope > h3')?.setAttribute('aria-expanded','true');matches++;if(section.dataset.settingsLevel==='advanced')advancedMatches++;
    if(!results)return;const controls=[...section.querySelectorAll('input:not([type="hidden"]),select,textarea,button:not(.help-tip)')];let sectionHits=0;
    controls.forEach(el=>{if(controlMatches>=30||!el.id)return;const text=settingsSearchControlText(el);if(!tokens.every(t=>text.includes(t)))return;sectionHits++;controlMatches++;const b=document.createElement('button');b.type='button';b.className='settings-search-result';const title=document.createElement('b');title.textContent=settingsControlLabel(el)||el.getAttribute('aria-label')||el.id;const meta=document.createElement('small');meta.textContent=`${SETTINGS_TAB_TITLES[section.dataset.settingsTab]||section.dataset.settingsTab} · ${section.querySelector(':scope > h3')?.childNodes[0]?.textContent?.trim()||section.id}`;b.append(title,meta);b.addEventListener('click',()=>openSettingsSearchResult(section.id,el.id));results.appendChild(b);});
    if(!sectionHits&&controlMatches<30){const b=document.createElement('button');b.type='button';b.className='settings-search-result section-result';const title=document.createElement('b');title.textContent=section.querySelector(':scope > h3')?.childNodes[0]?.textContent?.trim()||section.id;const meta=document.createElement('small');meta.textContent=`Open ${SETTINGS_TAB_TITLES[section.dataset.settingsTab]||section.dataset.settingsTab}`;b.append(title,meta);b.addEventListener('click',()=>openSettingsSearchResult(section.id));results.appendChild(b);}
  });
  document.getElementById('settings-empty-state')?.classList.remove('show');
  if(status){status.style.display='block';status.textContent=matches?`${controlMatches?`${controlMatches} direct match${controlMatches===1?'':'es'} · `:''}${matches} matching section${matches===1?'':'s'}${advancedMatches?` · ${advancedMatches} advanced`:''}.`:'No settings matched that search.';}
}

function clearSettingsSearch(){
  const search=document.getElementById('s-settings-search');
  if(search)search.value='';
  filterSettings('');
  if(search)search.focus();
}


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("settings", {updateSettingsPageHeader,settingsControlLabel,cleanSettingsLabelText,makeSettingsHelpButton,enhanceSettingsControlHelp,loadSettingsViewMode,setSettingsViewMode,enhanceSettingsSections,saveCollapsedSettingsSections,toggleSettingsSection,setAllSettingsSectionsCollapsed,settingsSectionRoleAllowed,visibleSettingsSectionsForTab,buildSettingsSectionJump,jumpToSettingsSection,applySettingsSectionVisibility,switchSettingsTab,settingsSectionSearchText,settingsSearchControlText,openSettingsSearchResult,filterSettings,clearSettingsSearch}, {
  "SETTINGS_TABS": {configurable:true,get:()=>SETTINGS_TABS},
  "SETTINGS_TAB_TITLES": {configurable:true,get:()=>SETTINGS_TAB_TITLES},
  "SETTINGS_TAB_HINTS": {configurable:true,get:()=>SETTINGS_TAB_HINTS},
  "SETTINGS_SECTION_SUMMARIES": {configurable:true,get:()=>SETTINGS_SECTION_SUMMARIES},
  "SETTINGS_CONTROL_HELP": {configurable:true,get:()=>SETTINGS_CONTROL_HELP},
  "activeSettingsTab": {configurable:true,get:()=>activeSettingsTab,set:(value)=>{activeSettingsTab=value;}},
  "settingsViewMode": {configurable:true,get:()=>settingsViewMode,set:(value)=>{settingsViewMode=value;}},
  "settingsSectionsEnhanced": {configurable:true,get:()=>settingsSectionsEnhanced,set:(value)=>{settingsSectionsEnhanced=value;}},
  "SETTINGS_SEARCH_ALIASES": {configurable:true,get:()=>SETTINGS_SEARCH_ALIASES}
}, {globalFunctions:['enhanceSettingsControlHelp','loadSettingsViewMode','setSettingsViewMode','enhanceSettingsSections','setAllSettingsSectionsCollapsed','jumpToSettingsSection','switchSettingsTab','openSettingsSearchResult','filterSettings','clearSettingsSearch'],globalStates:[]});
