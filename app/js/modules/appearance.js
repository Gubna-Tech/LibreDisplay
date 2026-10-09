// LibreDisplay source section: /js/appearance/weather.js
{
// Granular weather-effect tuning form helpers.
const dogSceneryApi=LibreDisplayRuntime.getModule('weatherScenery');
const WEATHER_TUNING_DEFAULTS={
  weatherRainWidth:100,weatherRainSpeed:100,weatherRainOpacity:100,weatherRainAngle:100,weatherRainDepth:100,weatherRainSplashSize:100,weatherRainGlow:100,
  weatherSnowSpeed:100,weatherSnowOpacity:100,weatherSnowSpin:100,weatherSnowDepth:100,
  weatherFogOpacity:100,weatherFogBlur:100,weatherFogLayerHeight:100,weatherFogRollingBanks:true,weatherStormCloudDeck:true,weatherStormRainSheets:true,weatherLightningStreaks:true,weatherSnowBlowing:true,
  weatherCloudDensity:100,weatherCloudOpacity:100,weatherCloudSpeed:100,weatherCloudScale:100,weatherSunGlow:100,weatherSunRaySpeed:100,weatherLightningSize:100,weatherLightningFlash:100,weatherLightningBolts:100,
  weatherSeasonLeavesSize:100,weatherSeasonLeavesSpeed:100,weatherSeasonLeavesWind:100,weatherSeasonLeavesOpacity:100,
  weatherSeasonGrassHeight:100,weatherSeasonGrassSway:100,weatherSeasonGrassOpacity:100,
  weatherSeasonPetalSize:100,weatherSeasonPetalSpeed:100,weatherSeasonPetalOpacity:100,
  weatherSeasonBees:true,weatherSeasonBeeIntensity:55,weatherSeasonBeeSize:100,weatherSeasonBeeSpeed:100,weatherSeasonBeeOpacity:100,weatherSeasonButterflies:true,weatherSeasonButterflyIntensity:50,weatherSeasonButterflySize:100,weatherSeasonButterflySpeed:100,weatherSeasonButterflyOpacity:100,weatherSeasonButterflyDiversity:75,weatherSeasonFireflies:true,weatherSeasonFireflyIntensity:70,weatherSeasonFireflySize:100,weatherSeasonFireflySpeed:100,weatherSeasonFireflyGlow:100,weatherSeasonFireflyOpacity:100,
  weatherSeasonBirds:true,weatherSeasonBirdIntensity:55,weatherSeasonBirdSize:100,weatherSeasonBirdSpeed:100,weatherSeasonBirdFlock:60,weatherSeasonBirdOpacity:100,weatherSeasonBirdHeight:100,weatherSeasonBirdDiversity:72,weatherSeasonBirdRare:30,weatherDogCompanion:false,weatherDogActivity:100,weatherDogSize:100,weatherDogOpacity:100,holidayOverlaysEnabled:false,holidayOverlayIntensity:100,holidayOverlayNewYear:true,holidayOverlayValentines:true,holidayOverlayStPatrick:true,holidayOverlayEaster:true,holidayOverlayMemorial:true,holidayOverlayJuneteenth:true,holidayOverlayIndependence:true,holidayOverlayLabor:true,holidayOverlayHalloween:true,holidayOverlayDayOfDead:true,holidayOverlayVeterans:true,holidayOverlayThanksgiving:true,holidayOverlayHanukkah:true,holidayOverlayChristmas:true,weatherSeasonOwls:false,weatherSeasonOwlIntensity:45,weatherSeasonOwlSize:110,weatherSeasonOwlSpeed:85,weatherSeasonOwlOpacity:100,weatherSeasonOwlDiversity:75,weatherSeasonDragonflies:true,weatherSeasonDragonflyIntensity:35,weatherSeasonDragonflySize:100,weatherSeasonDragonflySpeed:110,weatherSeasonDragonflyOpacity:100,weatherSeasonLadybugs:true,weatherSeasonLadybugIntensity:25,weatherSeasonLadybugSize:100,weatherSeasonLadybugSpeed:80,weatherSeasonLadybugOpacity:100,weatherSeasonMoths:true,weatherSeasonMothIntensity:40,weatherSeasonMothSize:100,weatherSeasonMothSpeed:90,weatherSeasonMothOpacity:100,weatherSeasonCrystals:true,weatherSeasonCrystalIntensity:70,weatherSeasonCrystalSize:100,weatherSeasonCrystalSpeed:100,weatherSeasonCrystalOpacity:100,weatherSeasonSnowmen:true,weatherSeasonSnowmanIntensity:60,weatherSeasonSnowmanSize:100,weatherSeasonSnowmanOpacity:100,weatherColdFrostWidth:100,weatherColdFrostOpacity:100
};
const WEATHER_TUNING_FIELDS=[
  ['s-weather-rain-width','weatherRainWidth'],['s-weather-rain-speed','weatherRainSpeed'],['s-weather-rain-opacity','weatherRainOpacity'],['s-weather-rain-angle','weatherRainAngle'],['s-weather-rain-depth','weatherRainDepth'],['s-weather-rain-splash-size','weatherRainSplashSize'],['s-weather-rain-glow','weatherRainGlow'],
  ['s-weather-snow-speed','weatherSnowSpeed'],['s-weather-snow-opacity','weatherSnowOpacity'],['s-weather-snow-spin','weatherSnowSpin'],['s-weather-snow-depth','weatherSnowDepth'],
  ['s-weather-fog-opacity','weatherFogOpacity'],['s-weather-fog-blur','weatherFogBlur'],['s-weather-fog-layer-height','weatherFogLayerHeight'],
  ['s-weather-cloud-density','weatherCloudDensity'],['s-weather-cloud-opacity','weatherCloudOpacity'],['s-weather-cloud-speed','weatherCloudSpeed'],['s-weather-cloud-scale','weatherCloudScale'],['s-weather-sun-glow','weatherSunGlow'],['s-weather-sun-ray-speed','weatherSunRaySpeed'],['s-weather-lightning-size','weatherLightningSize'],['s-weather-lightning-flash','weatherLightningFlash'],['s-weather-lightning-bolts','weatherLightningBolts'],
  ['s-weather-leaves-size','weatherSeasonLeavesSize'],['s-weather-leaves-speed','weatherSeasonLeavesSpeed'],['s-weather-leaves-wind','weatherSeasonLeavesWind'],['s-weather-leaves-opacity','weatherSeasonLeavesOpacity'],
  ['s-weather-grass-height','weatherSeasonGrassHeight'],['s-weather-grass-sway','weatherSeasonGrassSway'],['s-weather-grass-opacity','weatherSeasonGrassOpacity'],
  ['s-weather-petal-size','weatherSeasonPetalSize'],['s-weather-petal-speed','weatherSeasonPetalSpeed'],['s-weather-petal-opacity','weatherSeasonPetalOpacity'],
  ['s-weather-bee-intensity','weatherSeasonBeeIntensity'],['s-weather-bee-size','weatherSeasonBeeSize'],['s-weather-bee-speed','weatherSeasonBeeSpeed'],['s-weather-bee-opacity','weatherSeasonBeeOpacity'],['s-weather-butterfly-intensity','weatherSeasonButterflyIntensity'],['s-weather-butterfly-size','weatherSeasonButterflySize'],['s-weather-butterfly-speed','weatherSeasonButterflySpeed'],['s-weather-butterfly-opacity','weatherSeasonButterflyOpacity'],['s-weather-butterfly-diversity','weatherSeasonButterflyDiversity'],['s-weather-firefly-intensity','weatherSeasonFireflyIntensity'],['s-weather-firefly-size','weatherSeasonFireflySize'],['s-weather-firefly-speed','weatherSeasonFireflySpeed'],['s-weather-firefly-glow','weatherSeasonFireflyGlow'],['s-weather-firefly-opacity','weatherSeasonFireflyOpacity'],['s-weather-bird-intensity','weatherSeasonBirdIntensity'],['s-weather-bird-size','weatherSeasonBirdSize'],['s-weather-bird-speed','weatherSeasonBirdSpeed'],['s-weather-bird-flock','weatherSeasonBirdFlock'],['s-weather-bird-opacity','weatherSeasonBirdOpacity'],['s-weather-bird-height','weatherSeasonBirdHeight'],['s-weather-bird-diversity','weatherSeasonBirdDiversity'],['s-weather-bird-rare','weatherSeasonBirdRare'],['s-weather-dog-activity','weatherDogActivity'],['s-weather-dog-size','weatherDogSize'],['s-weather-dog-opacity','weatherDogOpacity'],['s-holiday-overlay-intensity','holidayOverlayIntensity'],['s-weather-owl-intensity','weatherSeasonOwlIntensity'],['s-weather-owl-size','weatherSeasonOwlSize'],['s-weather-owl-speed','weatherSeasonOwlSpeed'],['s-weather-owl-opacity','weatherSeasonOwlOpacity'],['s-weather-owl-diversity','weatherSeasonOwlDiversity'],['s-weather-dragonfly-intensity','weatherSeasonDragonflyIntensity'],['s-weather-dragonfly-size','weatherSeasonDragonflySize'],['s-weather-dragonfly-speed','weatherSeasonDragonflySpeed'],['s-weather-dragonfly-opacity','weatherSeasonDragonflyOpacity'],['s-weather-ladybug-intensity','weatherSeasonLadybugIntensity'],['s-weather-ladybug-size','weatherSeasonLadybugSize'],['s-weather-ladybug-speed','weatherSeasonLadybugSpeed'],['s-weather-ladybug-opacity','weatherSeasonLadybugOpacity'],['s-weather-moth-intensity','weatherSeasonMothIntensity'],['s-weather-moth-size','weatherSeasonMothSize'],['s-weather-moth-speed','weatherSeasonMothSpeed'],['s-weather-moth-opacity','weatherSeasonMothOpacity'],['s-weather-crystal-intensity','weatherSeasonCrystalIntensity'],['s-weather-crystal-size','weatherSeasonCrystalSize'],['s-weather-crystal-speed','weatherSeasonCrystalSpeed'],['s-weather-crystal-opacity','weatherSeasonCrystalOpacity'],['s-weather-snowman-intensity','weatherSeasonSnowmanIntensity'],['s-weather-snowman-size','weatherSeasonSnowmanSize'],['s-weather-snowman-opacity','weatherSeasonSnowmanOpacity'],['s-weather-cold-frost-width','weatherColdFrostWidth'],['s-weather-cold-frost-opacity','weatherColdFrostOpacity']
];
const WEATHER_TUNING_CHECKS=[['s-weather-fog-rolling-banks','weatherFogRollingBanks'],['s-weather-storm-cloud-deck','weatherStormCloudDeck'],['s-weather-storm-rain-sheets','weatherStormRainSheets'],['s-weather-lightning-streaks','weatherLightningStreaks'],['s-weather-snow-blowing','weatherSnowBlowing'],['s-weather-season-bees','weatherSeasonBees'],['s-weather-season-butterflies','weatherSeasonButterflies'],['s-weather-season-fireflies','weatherSeasonFireflies'],['s-weather-season-dragonflies','weatherSeasonDragonflies'],['s-weather-season-ladybugs','weatherSeasonLadybugs'],['s-weather-season-moths','weatherSeasonMoths'],['s-weather-season-birds','weatherSeasonBirds'],['s-weather-dog-companion','weatherDogCompanion'],['s-holiday-overlays-enabled','holidayOverlaysEnabled'],['s-holiday-new-year','holidayOverlayNewYear'],['s-holiday-valentines','holidayOverlayValentines'],['s-holiday-st-patrick','holidayOverlayStPatrick'],['s-holiday-easter','holidayOverlayEaster'],['s-holiday-memorial','holidayOverlayMemorial'],['s-holiday-juneteenth','holidayOverlayJuneteenth'],['s-holiday-independence','holidayOverlayIndependence'],['s-holiday-labor','holidayOverlayLabor'],['s-holiday-halloween','holidayOverlayHalloween'],['s-holiday-day-of-dead','holidayOverlayDayOfDead'],['s-holiday-veterans','holidayOverlayVeterans'],['s-holiday-thanksgiving','holidayOverlayThanksgiving'],['s-holiday-hanukkah','holidayOverlayHanukkah'],['s-holiday-christmas','holidayOverlayChristmas'],['s-weather-season-owls','weatherSeasonOwls'],['s-weather-season-crystals','weatherSeasonCrystals'],['s-weather-season-snowmen','weatherSeasonSnowmen']];
const WEATHER_TUNING_KEYS=[...Object.keys(WEATHER_TUNING_DEFAULTS)];

const WEATHER_DEPENDENT_CONTROLS={
  's-weather-rain-enabled':['s-weather-rain-density','s-weather-rain-size','s-weather-rain-width','s-weather-rain-speed','s-weather-rain-opacity','s-weather-rain-angle','s-weather-rain-depth','s-weather-rain-splash','s-weather-rain-splash-size','s-weather-rain-glow'],
  's-weather-snow-enabled':['s-weather-snow-blowing','s-weather-snow-density','s-weather-snow-size','s-weather-snow-drift','s-weather-snow-speed','s-weather-snow-opacity','s-weather-snow-spin','s-weather-snow-depth'],
  's-weather-effect-fog':['s-weather-fog-rolling-banks','s-weather-fog-density','s-weather-fog-speed','s-weather-fog-opacity','s-weather-fog-blur','s-weather-fog-layer-height'],
  's-weather-effect-clouds':['s-weather-cloud-density','s-weather-cloud-opacity','s-weather-cloud-speed','s-weather-cloud-scale'],
  's-weather-effect-sun':['s-weather-sun-glow','s-weather-sun-ray-speed'],
  's-weather-effect-lightning':['s-weather-lightning-streaks','s-weather-effect-lightning-frequency','s-weather-effect-lightning-brightness','s-weather-lightning-size','s-weather-lightning-flash','s-weather-lightning-bolts'],
  's-weather-season-leaves':['s-weather-leaves-intensity','s-weather-leaves-size','s-weather-leaves-speed','s-weather-leaves-wind','s-weather-leaves-opacity'],
  's-weather-season-grass':['s-weather-grass-intensity','s-weather-grass-height','s-weather-grass-sway','s-weather-grass-opacity'],
  's-weather-season-petals':['s-weather-petal-intensity','s-weather-petal-size','s-weather-petal-speed','s-weather-petal-opacity'],
  's-weather-season-bees':['s-weather-bee-intensity','s-weather-bee-size','s-weather-bee-speed','s-weather-bee-opacity'],
  's-weather-season-butterflies':['s-weather-butterfly-intensity','s-weather-butterfly-size','s-weather-butterfly-speed','s-weather-butterfly-opacity','s-weather-butterfly-diversity'],
  's-weather-season-fireflies':['s-weather-firefly-intensity','s-weather-firefly-size','s-weather-firefly-speed','s-weather-firefly-glow','s-weather-firefly-opacity'],
  's-weather-season-dragonflies':['s-weather-dragonfly-intensity','s-weather-dragonfly-size','s-weather-dragonfly-speed','s-weather-dragonfly-opacity'],
  's-weather-season-ladybugs':['s-weather-ladybug-intensity','s-weather-ladybug-size','s-weather-ladybug-speed','s-weather-ladybug-opacity'],
  's-weather-season-moths':['s-weather-moth-intensity','s-weather-moth-size','s-weather-moth-speed','s-weather-moth-opacity'],
  's-weather-season-birds':['s-weather-bird-habitat','s-weather-bird-intensity','s-weather-bird-size','s-weather-bird-speed','s-weather-bird-flock','s-weather-bird-opacity','s-weather-bird-height','s-weather-bird-diversity','s-weather-bird-rare'],
  's-weather-dog-companion':['s-weather-dog-breed','s-weather-dog-labrador-coat','s-weather-dog-accessory','s-weather-dog-accessory-color','s-weather-dog-accessory-color-hex','s-weather-dog-activity','s-weather-dog-size','s-weather-dog-opacity'],
  's-holiday-overlays-enabled':['s-holiday-overlay-intensity'],
  's-weather-season-owls':['s-weather-owl-intensity','s-weather-owl-size','s-weather-owl-speed','s-weather-owl-opacity','s-weather-owl-diversity'],
  's-weather-season-crystals':['s-weather-crystal-intensity','s-weather-crystal-size','s-weather-crystal-speed','s-weather-crystal-opacity'],
  's-weather-season-snowmen':['s-weather-snowman-intensity','s-weather-snowman-size','s-weather-snowman-opacity'],
  's-weather-cold-frost':['s-weather-cold-frost-intensity','s-weather-cold-frost-width','s-weather-cold-frost-opacity'],
  's-weather-hazard-flood':['s-weather-hazard-flood-level','s-weather-hazard-flood-debris','s-weather-hazard-flood-speed'],
  's-weather-hazard-wind':['s-weather-hazard-wind-gusts','s-weather-hazard-wind-speed'],
  's-weather-hazard-tornado':['s-weather-hazard-tornado-size','s-weather-hazard-tornado-opacity'],
  's-weather-hazard-tropical':['s-weather-hazard-tropical-bands','s-weather-hazard-tropical-surge'],
  's-weather-hazard-storm':['s-weather-hazard-storm-cloud','s-weather-hazard-storm-gust'],
  's-weather-hazard-winter':['s-weather-hazard-winter-whiteout','s-weather-hazard-winter-drift'],
  's-weather-hazard-visibility':['s-weather-hazard-visibility-opacity'],
  's-weather-hazard-heat-fire':['s-weather-hazard-heat-shimmer']
};
function syncWeatherControlVisibility(){
  for(const [toggleId,ids] of Object.entries(WEATHER_DEPENDENT_CONTROLS)){const toggle=document.getElementById(toggleId),show=toggle?.checked!==false;for(const id of ids){const control=document.getElementById(id),row=control?.closest('.s-row');if(row){row.hidden=!show;row.setAttribute('aria-hidden',show?'false':'true');}}}
  const dogOn=document.getElementById('s-weather-dog-companion')?.checked!==false,dogBreed=document.getElementById('s-weather-dog-breed')?.value||'labrador',dogAccessory=document.getElementById('s-weather-dog-accessory')?.value||'collar',variantRow=document.getElementById('s-weather-dog-labrador-coat')?.closest('.s-row'),accessoryColorRow=document.getElementById('s-weather-dog-accessory-color')?.closest('.s-row');syncDogVariantOptions();if(variantRow){variantRow.hidden=!dogOn;variantRow.setAttribute('aria-hidden',dogOn?'false':'true');}if(accessoryColorRow){const show=dogOn&&dogAccessory!=='none';accessoryColorRow.hidden=!show;accessoryColorRow.setAttribute('aria-hidden',show?'false':'true');}
  const master=document.getElementById('s-weather-seasonal-effects'),enabled=master?.checked!==false;for(const section of document.querySelectorAll('.s-section[id^="settings-naturescape-"]')){if(section.id==='settings-naturescape-overview'||section.id==='settings-naturescape-dog'||section.id==='settings-naturescape-holidays')continue;section.classList.toggle('settings-effect-disabled',!enabled);const grid=section.querySelector('.settings-grid');if(grid)grid.hidden=!enabled;}
}



function syncDogVariantOptions(preferred){const breed=document.getElementById('s-weather-dog-breed')?.value||'labrador',select=document.getElementById('s-weather-dog-labrador-coat');if(!select)return '';const current=preferred||select.value||'';const options=dogSceneryApi.dogVariantOptions?.(breed)||[{value:'yellow',label:'Yellow / cream'}],resolved=dogSceneryApi.dogVariantKey?.(breed,current)||options[0]?.value||'yellow',defaultVariant=dogSceneryApi.dogVariantKey?.(breed,'')||options[0]?.value||'yellow';if(select.dataset.dogVariantBreed!==breed||![...select.options].some(o=>o.value===resolved)){select.replaceChildren(...options.map(row=>{const opt=document.createElement('option');opt.value=row.value;opt.textContent=row.label;opt.defaultSelected=row.value===defaultVariant;return opt;}));select.dataset.dogVariantBreed=breed;}select.value=resolved;return resolved;}

function normalizeDogAccessoryHex(value,fallback='#3478D4'){let raw=String(value||'').trim().toUpperCase();if(/^[0-9A-F]{6}$/.test(raw))raw='#'+raw;if(/^#[0-9A-F]{3}$/.test(raw))raw='#'+raw.slice(1).split('').map(ch=>ch+ch).join('');if(/^#[0-9A-F]{6}$/.test(raw))return raw;const safe=String(fallback||'#3478D4').trim().toUpperCase();return /^#[0-9A-F]{6}$/.test(safe)?safe:'#3478D4';}
function syncDogAccessoryHex(preview=false,commit=false){const picker=document.getElementById('s-weather-dog-accessory-color'),hex=document.getElementById('s-weather-dog-accessory-color-hex');if(!hex)return picker?.value||'#3478d4';const fallback=picker?.value?.toUpperCase()||'#3478D4',normalized=normalizeDogAccessoryHex(hex.value,fallback),valid=normalized!==fallback||normalizeDogAccessoryHex(hex.value,'')!=='#3478D4'||String(hex.value||'').trim().toUpperCase()===fallback;if(commit||valid){hex.value=normalized;if(picker)picker.value=normalized.toLowerCase();if(preview&&typeof globalThis.previewAppearance==='function')globalThis.previewAppearance();}return normalized.toLowerCase();}
function initDogAccessoryColorControls(){const picker=document.getElementById('s-weather-dog-accessory-color'),hex=document.getElementById('s-weather-dog-accessory-color-hex'),accessory=document.getElementById('s-weather-dog-accessory'),breed=document.getElementById('s-weather-dog-breed');if(picker&&!picker.dataset.boundDogColor){picker.dataset.boundDogColor='1';picker.addEventListener('input',()=>{if(hex)hex.value=picker.value.toUpperCase();if(typeof globalThis.previewAppearance==='function')globalThis.previewAppearance();});}if(hex&&!hex.dataset.boundDogColor){hex.dataset.boundDogColor='1';hex.addEventListener('input',()=>{const raw=String(hex.value||'').trim();if(/^(#?[0-9a-f]{6}|#[0-9a-f]{3})$/i.test(raw))syncDogAccessoryHex(true,true);});hex.addEventListener('change',()=>syncDogAccessoryHex(true,true));hex.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();syncDogAccessoryHex(true,true);hex.blur();}});}if(accessory&&!accessory.dataset.boundDogAccessory){accessory.dataset.boundDogAccessory='1';accessory.addEventListener('change',syncWeatherControlVisibility);}if(breed&&!breed.dataset.boundDogVariants){breed.dataset.boundDogVariants='1';breed.addEventListener('change',()=>{syncDogVariantOptions();syncWeatherControlVisibility();if(typeof globalThis.previewAppearance==='function')globalThis.previewAppearance();});}syncDogVariantOptions();}
queueMicrotask(initDogAccessoryColorControls);

function weatherTuningFromForm(){const out={};for(const [id,key] of WEATHER_TUNING_FIELDS){const el=document.getElementById(id);out[key]=Number(el?.value??WEATHER_TUNING_DEFAULTS[key]);}for(const [id,key] of WEATHER_TUNING_CHECKS){const el=document.getElementById(id);out[key]=el?el.checked:WEATHER_TUNING_DEFAULTS[key];}return out;}
function setWeatherTuningForm(source={}){for(const [id,key] of WEATHER_TUNING_FIELDS){const el=document.getElementById(id);if(el)el.value=String(source[key]??WEATHER_TUNING_DEFAULTS[key]);}for(const [id,key] of WEATHER_TUNING_CHECKS){const el=document.getElementById(id);if(el)el.checked=source[key]!==false;}}
function updateWeatherTuningLabels(source={}){for(const [id,key] of WEATHER_TUNING_FIELDS){const el=document.getElementById(id+'-value');if(el)el.textContent=`${source[key]??WEATHER_TUNING_DEFAULTS[key]}%`;}syncWeatherControlVisibility();}
function resetWeatherTuningForm(source=WEATHER_TUNING_DEFAULTS){setWeatherTuningForm(source);updateWeatherTuningLabels(source);syncWeatherControlVisibility();}
LibreDisplayRuntime.exposeModule('appearance',{WEATHER_TUNING_DEFAULTS,WEATHER_TUNING_FIELDS,WEATHER_TUNING_CHECKS,WEATHER_TUNING_KEYS,WEATHER_DEPENDENT_CONTROLS,weatherTuningFromForm,setWeatherTuningForm,updateWeatherTuningLabels,resetWeatherTuningForm,syncWeatherControlVisibility,syncDogVariantOptions,normalizeDogAccessoryHex,syncDogAccessoryHex,initDogAccessoryColorControls},{},{globalFunctions:[],globalStates:[]});
}
// End source section: /js/appearance/weather.js

// LibreDisplay source section: /js/appearance/index.js
{
// Product theme, typography, accessibility, and appearance form runtime.
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const weatherAppearanceApi=LibreDisplayRuntime.getModule('appearance');
const {tick,weatherDetailsConfig,weatherDetailColumnCount,weatherDetailsFromForm,setWeatherDetailsForm}=LibreDisplayRuntime.getModule('weather');
const {uiCfg,escHtml,esc,normalizeHexColor,scaledClamp}=LibreDisplayRuntime.getModule('shared');
const LIBREDISPLAY_THEMES={
  'libre-night':{name:'Libre Night',desc:'Black + green',canvas:'#070907',overlay:'rgba(4,6,5,.95)',surface:'#0d100e',surface2:'#141915',surface3:'#1c231e',border:'rgba(166,179,171,.15)',borderStrong:'rgba(74,222,128,.38)',text:'#f5f7f6',muted:'#a0aaa4',subtle:'#68736c',accent:'#4ade80',accentStrong:'#22c55e',accentContrast:'#041109',success:'#22c55e',warning:'#fbbf24',danger:'#fb7185',focus:'#86efac'},
  'midnight-violet':{name:'Midnight Violet',desc:'Deep indigo + violet',canvas:'#080914',overlay:'rgba(5,5,16,.95)',surface:'#101225',surface2:'#171a33',surface3:'#202542',border:'rgba(167,139,250,.16)',borderStrong:'rgba(196,181,253,.4)',text:'#fafaff',muted:'#b4b7d6',subtle:'#777b9e',accent:'#a78bfa',accentStrong:'#8b5cf6',accentContrast:'#0f0822',success:'#34d399',warning:'#fbbf24',danger:'#fb7185',focus:'#c4b5fd'},
  graphite:{name:'Graphite',desc:'Neutral charcoal',canvas:'#090a0a',overlay:'rgba(5,6,6,.95)',surface:'#121414',surface2:'#191c1c',surface3:'#232727',border:'rgba(203,213,225,.13)',borderStrong:'rgba(203,213,225,.30)',text:'#f4f5f5',muted:'#a8afaf',subtle:'#6c7474',accent:'#cbd5e1',accentStrong:'#94a3b8',accentContrast:'#0b0d0e',success:'#4ade80',warning:'#facc15',danger:'#fb7185',focus:'#e2e8f0'},
  ember:{name:'Ember',desc:'Warm charcoal + amber',canvas:'#100b09',overlay:'rgba(12,7,5,.95)',surface:'#1a1210',surface2:'#241815',surface3:'#30201b',border:'rgba(251,146,60,.15)',borderStrong:'rgba(253,186,116,.38)',text:'#fffaf5',muted:'#c9afa2',subtle:'#876f65',accent:'#fb923c',accentStrong:'#f97316',accentContrast:'#1c0902',success:'#4ade80',warning:'#fbbf24',danger:'#fb7185',focus:'#fdba74'},
  'deep-ocean':{name:'Deep Ocean',desc:'Dark marine blue + aqua',canvas:'#061015',overlay:'rgba(3,10,14,.95)',surface:'#0a1820',surface2:'#0f222c',surface3:'#15303c',border:'rgba(103,232,249,.14)',borderStrong:'rgba(94,234,212,.38)',text:'#f2fcff',muted:'#9ac2ca',subtle:'#5e8790',accent:'#2dd4bf',accentStrong:'#14b8a6',accentContrast:'#021714',success:'#4ade80',warning:'#fbbf24',danger:'#fb7185',focus:'#5eead4'}
};
function applyProductTheme(key){
  const theme=LIBREDISPLAY_THEMES[key]||LIBREDISPLAY_THEMES['libre-night'];
  const root=document.documentElement;
  root.dataset.theme=key in LIBREDISPLAY_THEMES?key:'libre-night';
  const vars={canvas:'--ld-canvas',overlay:'--ld-overlay',surface:'--ld-surface',surface2:'--ld-surface-2',surface3:'--ld-surface-3',border:'--ld-border',borderStrong:'--ld-border-strong',text:'--ld-text',muted:'--ld-muted',subtle:'--ld-subtle',accent:'--ld-accent',accentStrong:'--ld-accent-strong',accentContrast:'--ld-accent-contrast',success:'--ld-success',warning:'--ld-warning',danger:'--ld-danger',focus:'--ld-focus'};
  for(const [k,v] of Object.entries(vars))root.style.setProperty(v,theme[k]);
}
function renderThemeChoices(selected){
  const grid=document.getElementById('theme-choice-grid');if(!grid)return;
  const current=LIBREDISPLAY_THEMES[selected]?selected:'libre-night';
  grid.innerHTML=Object.entries(LIBREDISPLAY_THEMES).map(([key,t])=>`<button class="theme-choice-card ${key===current?'selected':''}" type="button" role="radio" aria-checked="${key===current?'true':'false'}" data-theme="${key}" data-ld-action-click="appearance.selectThemeChoice" data-ld-action-args="${escHtml(JSON.stringify([key]))}"><span class="theme-swatches"><i style="background:${t.canvas}"></i><i style="background:${t.surface2}"></i><i style="background:${t.accent}"></i></span><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join('');
}
function selectThemeChoice(key){
  if(!LIBREDISPLAY_THEMES[key])return;
  renderThemeChoices(key);
  previewAppearance();
  markSettingsDirty();
}
const LIBREDISPLAY_FONTS=[
  {value:'Inter',label:'Inter',desc:'Modern & clean',sample:'Home · 12:45'},
  {value:'system',label:'System UI',desc:'Native & familiar',sample:'Weather · Today'},
  {value:'Noto Sans',label:'Noto Sans',desc:'Neutral & readable',sample:'Calendar · 68°'},
  {value:'DejaVu Sans',label:'DejaVu Sans',desc:'Open & practical',sample:'Family · Friday'},
  {value:'Liberation Sans',label:'Liberation Sans',desc:'Classic sans',sample:'Tasks · 7:30'},
  {value:'Trebuchet MS',label:'Trebuchet MS',desc:'Friendly humanist',sample:'Photos · Home'},
  {value:'DejaVu Serif',label:'DejaVu Serif',desc:'Traditional serif',sample:'October · Sunday'},
  {value:'Georgia',label:'Georgia',desc:'Warm editorial serif',sample:'Morning · 8:15'},
  {value:'monospace',label:'Monospace',desc:'Technical & precise',sample:'STATUS 21:08'}
];
function renderFontChoices(selected){const grid=document.getElementById('font-choice-grid');if(!grid)return;const current=LIBREDISPLAY_FONTS.some(f=>f.value===selected)?selected:'Inter';grid.innerHTML=LIBREDISPLAY_FONTS.map(f=>`<button class="font-choice-card ${f.value===current?'selected':''}" type="button" role="radio" aria-checked="${f.value===current?'true':'false'}" data-ld-action-click="appearance.selectFontChoice" data-ld-action-args="${escHtml(JSON.stringify([f.value]))}" style="font-family:${fontCssValue(f.value)}"><strong>${escHtml(f.label)}</strong><small>${escHtml(f.sample)}</small><span>${escHtml(f.desc)}</span></button>`).join('');}
function selectFontChoice(name,fromSelect=false){if(!LIBREDISPLAY_FONTS.some(f=>f.value===name))name='Inter';const select=document.getElementById('s-font-family');if(select&&select.value!==name)select.value=name;renderFontChoices(name);styleFontSelectOptions();previewAppearance();if(!LibreDisplayRuntime.getModule('system').settingsInitializing)markSettingsDirty();}
function styleFontSelectOptions(){for(const id of ['s-font-family','layout-style-font']){const select=document.getElementById(id);if(!select)continue;for(const option of select.options){const value=option.value||'Inter';option.style.fontFamily=fontCssValue(value);}}}
function updateFontPreview(){
  const name=document.getElementById('s-font-family')?.value||'Inter';
  const preview=document.getElementById('theme-font-preview');
  if(preview)preview.style.fontFamily=fontCssValue(name);
  renderFontChoices(name);styleFontSelectOptions();
}

function fontCssValue(name){
  const map={
    Inter:"'Inter','Noto Sans','DejaVu Sans',system-ui,sans-serif",
    system:"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',sans-serif",
    'Noto Sans':"'Noto Sans','DejaVu Sans',sans-serif",
    'DejaVu Sans':"'DejaVu Sans','Liberation Sans',sans-serif",
    'Liberation Sans':"'Liberation Sans','Arial',sans-serif",
    'Trebuchet MS':"'Trebuchet MS','Noto Sans',sans-serif",
    'DejaVu Serif':"'DejaVu Serif','Liberation Serif',serif",
    Georgia:"Georgia,'DejaVu Serif','Liberation Serif',serif",
    monospace:"ui-monospace,'DejaVu Sans Mono','Liberation Mono',Consolas,monospace"
  };
  return map[name]||map.Inter;
}

function measureDashboardFontProbe(fontName){
  try{
    const canvas=measureDashboardFontProbe._canvas||(measureDashboardFontProbe._canvas=document.createElement('canvas'));
    const ctx=canvas.getContext('2d');if(!ctx)return {width:0,height:0};
    ctx.font=`100px ${fontCssValue(fontName||'Inter')}`;
    const m=ctx.measureText('LibreDisplay 0123456789 Weather Calendar Dashboard ABC xyz');
    const height=Math.max(1,Number(m.actualBoundingBoxAscent||0)+Number(m.actualBoundingBoxDescent||0));
    return {width:Number(m.width)||0,height};
  }catch(e){return {width:0,height:0};}
}

const SCREEN_CARE_SHIFT_STEPS=[[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]];
let screenCareTimer=null,screenCareLastActivity=Date.now(),screenCareDimmed=false,screenCareShiftIndex=0,screenCareScheduleWakeUntil=0;
function screenCareClockMinutes(value,fallback='00:00'){const match=String(value||fallback).match(/^([01]\d|2[0-3]):([0-5]\d)$/);const safe=match?match:String(fallback).match(/^([01]\d|2[0-3]):([0-5]\d)$/);return Number(safe?.[1]||0)*60+Number(safe?.[2]||0);}
function screenCareQuietScheduleState(source=uiCfg(),now=new Date()){
  const start=screenCareClockMinutes(source?.burnInQuietStart,'22:00'),end=screenCareClockMinutes(source?.burnInQuietEnd,'07:00'),current=now.getHours()*60+now.getMinutes();
  if(start===end)return {active:false,elapsedMs:0};
  const active=start<end?(current>=start&&current<end):(current>=start||current<end);
  if(!active)return {active:false,elapsedMs:0};
  const elapsedMin=current>=start?current-start:current+1440-start;
  return {active:true,elapsedMs:elapsedMin*60000};
}
function noteScreenCareActivity(){
  const source=uiCfg();screenCareLastActivity=Date.now();
  if(source?.burnInQuietHoursEnabled&&source?.burnInQuietWakeEnabled!==false&&screenCareQuietScheduleState(source).active){const wakeMin=Math.min(30,Math.max(1,Number(source?.burnInQuietWakeMin)||5));screenCareScheduleWakeUntil=Date.now()+wakeMin*60000;}else screenCareScheduleWakeUntil=0;
  if(screenCareDimmed){screenCareDimmed=false;document.body.classList.remove('ld-burnin-dim');document.documentElement.style.setProperty('--ld-burnin-overlay','0');}
  if(source?.burnInShiftMode==='idle')resetScreenCareShift();
  try{LibreDisplayRuntime.getModule('weatherEffects').refreshWeatherEffects();}catch(_e){}
}
function screenCareAvailable(){
  if(layoutEditorActive||remoteLayoutProxyActive||LAYOUT_PREVIEW_MODE)return false;
  const setup=document.getElementById('setup');if(setup&&!setup.classList.contains('hidden'))return false;
  return bootstrapApi.READ_ONLY_DISPLAY_MODE||bootstrapApi.LOCAL_CLIENT_MODE;
}
function screenCareCanDim(source=uiCfg()){return !!source?.burnInCareEnabled&&!!(source?.burnInIdleDimmingEnabled||source?.burnInQuietHoursEnabled||source?.burnInDeepProtection)&&screenCareAvailable();}
function screenCareCanShift(source=uiCfg()){return !!source?.burnInCareEnabled&&!!source?.burnInPixelShift&&screenCareAvailable()&&(source?.burnInShiftMode!=='idle'||screenCareDimmed);}
function setScreenCareShift(x=0,y=0){
  const root=document.documentElement,source=uiCfg();
  const distance=Math.min(8,Math.max(1,Number(source?.burnInShiftPx)||2));
  const transitionRaw=Number(source?.burnInShiftTransitionSec),transition=Math.min(3,Math.max(0,Number.isFinite(transitionRaw)?transitionRaw:1.2));
  root.style.setProperty('--ld-screen-shift-transition',`${transition}s`);
  root.style.setProperty('--ld-screen-shift-x',`${Number(x)||0}px`);
  root.style.setProperty('--ld-screen-shift-y',`${Number(y)||0}px`);
  root.style.setProperty('--ld-screen-shift-bleed',`${distance*2+4}px`);
  root.style.setProperty('--ld-screen-shift-inset',`${-(distance+2)}px`);
  document.body.classList.toggle('ld-burnin-shift',!!(x||y));
}
function resetScreenCareShift(){screenCareShiftIndex=0;setScreenCareShift(0,0);}
function advanceScreenCareShift(source=uiCfg()){
  if(!screenCareCanShift(source)){resetScreenCareShift();return;}
  screenCareShiftIndex=(screenCareShiftIndex+1)%SCREEN_CARE_SHIFT_STEPS.length;
  const amount=Math.min(8,Math.max(1,Number(source?.burnInShiftPx)||2));
  const [x,y]=SCREEN_CARE_SHIFT_STEPS[screenCareShiftIndex];setScreenCareShift(x*amount,y*amount);
}
function updateScreenCareState(source=uiCfg()){
  if(!screenCareCanDim(source)){
    screenCareDimmed=false;document.body.classList.remove('ld-burnin-dim');document.body.classList.toggle('ld-pause-decorative-motion',!!source?.burnInPauseAnimationsDimmed);document.documentElement.style.setProperty('--ld-burnin-overlay','0');if(source?.burnInShiftMode==='idle')resetScreenCareShift();
    try{LibreDisplayRuntime.getModule('weatherEffects').refreshWeatherEffects();}catch(_e){}return;
  }
  const idleFor=Date.now()-screenCareLastActivity;
  const idleMin=Math.min(240,Math.max(1,Number(source?.burnInIdleMin)||30));
  const deepFloor=source?.burnInIdleDimmingEnabled?idleMin:15;
  const deepIdleMin=Math.min(720,Math.max(deepFloor,Number(source?.burnInDeepIdleMin)||180));
  const quiet=source?.burnInQuietHoursEnabled?screenCareQuietScheduleState(source):{active:false,elapsedMs:0};
  if(!quiet.active)screenCareScheduleWakeUntil=0;
  const temporarilyAwake=quiet.active&&source?.burnInQuietWakeEnabled!==false&&Date.now()<screenCareScheduleWakeUntil;
  const idleActive=!!source?.burnInIdleDimmingEnabled&&idleFor>=idleMin*60000;
  const quietActive=quiet.active&&!temporarilyAwake;
  const normalActive=idleActive||quietActive;
  const deepActive=!!source?.burnInDeepProtection&&(source?.burnInDeepTrigger==='quiet'?(quiet.active&&!temporarilyAwake&&quiet.elapsedMs>=deepIdleMin*60000):(idleFor>=deepIdleMin*60000));
  const normalBrightness=Math.min(90,Math.max(5,Number(source?.burnInBrightnessPct)||40));
  const deepBrightnessRaw=Number(source?.burnInDeepBrightnessPct),deepBrightness=Math.min(normalBrightness,Math.max(0,Number.isFinite(deepBrightnessRaw)?deepBrightnessRaw:5));
  const brightness=deepActive?deepBrightness:(normalActive?normalBrightness:100);
  document.documentElement.style.setProperty('--ld-burnin-overlay',String((100-brightness)/100));
  const wasDimmed=screenCareDimmed;screenCareDimmed=normalActive||deepActive;document.body.classList.toggle('ld-burnin-dim',screenCareDimmed);document.body.classList.toggle('ld-pause-decorative-motion',!!source?.burnInPauseAnimationsDimmed);
  if(!screenCareDimmed&&source?.burnInShiftMode==='idle')resetScreenCareShift();
  if(wasDimmed!==screenCareDimmed){try{LibreDisplayRuntime.getModule('weatherEffects').refreshWeatherEffects();}catch(_e){}}
}
function applyScreenCarePreferences(source=cfg){
  updateScreenCareState(source);
  if(screenCareTimer)clearInterval(screenCareTimer);
  if(source?.burnInCareEnabled&&(source?.burnInIdleDimmingEnabled||source?.burnInQuietHoursEnabled||source?.burnInDeepProtection))screenCareTimer=setInterval(()=>updateScreenCareState(uiCfg()),5000);
  const performance=LibreDisplayRuntime.getModule('performance');
  performance.stopManagedInterval('screen-care-pixel-shift');
  if(source?.burnInCareEnabled&&source?.burnInPixelShift){
    if(!screenCareCanShift(source))resetScreenCareShift();
    const shiftMs=Math.min(30,Math.max(.5,Number(source?.burnInShiftMin)||5))*60*1000;
    performance.startManagedInterval('screen-care-pixel-shift',()=>advanceScreenCareShift(uiCfg()),shiftMs,{skipWhenHidden:true,resumeOnVisible:true});
  }else resetScreenCareShift();
}
['pointerdown','keydown','touchstart','wheel'].forEach(type=>window.addEventListener(type,noteScreenCareActivity,{passive:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateScreenCareState(uiCfg());try{LibreDisplayRuntime.getModule('weatherEffects').refreshWeatherEffects();}catch(_e){}}});

function applyAccessibilityPreferences(source=cfg){
  const locale=source.locale&&source.locale!=='auto'?source.locale:(navigator.language||'en-US');
  document.documentElement.lang=String(locale).split('-')[0]||'en';
  const systemReduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const constrained=LibreDisplayRuntime.getModule('performance').frontendCapabilities().constrained;
  const reduced=source.motionPreference==='reduced'||(source.motionPreference==='auto'&&systemReduced);
  document.documentElement.classList.toggle('ld-reduce-motion',reduced);
  document.documentElement.classList.toggle('ld-performance-constrained',constrained);
  document.documentElement.classList.toggle('ld-high-contrast',!!source.highContrast);
  document.documentElement.classList.toggle('ld-focus-outline',!!source.focusOutline);
  const setup=document.getElementById('setup');
  if(setup)setup.dataset.uiSize=['large','xlarge'].includes(source.settingsUiSize)?source.settingsUiSize:'standard';
  applyScreenCarePreferences(source);
}

function applyUiCustomization(source=cfg){
  applyAccessibilityPreferences(source);const surface=['clean','glass','minimal','photo'].includes(source?.layoutSurfaceStyle)?source.layoutSurfaceStyle:'clean';for(const name of ['clean','glass','minimal','photo'])document.body.classList.toggle('layout-surface-'+name,name===surface);const presetStyle=/^[a-z0-9-]{1,40}$/.test(String(source?.layoutPresetStyle||''))?String(source.layoutPresetStyle):'';for(const name of ['photocalendar','glassboard','portraitwall','weekcolumns','photostory','mirrorminimal','family','split','gallery','calendar','agenda','weather','morning','smarthub','familyops','office','insights','travel','large','compact','minimal','portrait','portraitphoto','default'])document.body.classList.toggle('layout-preset-'+name,name===presetStyle);document.body.classList.toggle('ld-lightweight-mode',source?.lightweightModeEnabled===true);
  try{LibreDisplayRuntime.getModule('weatherEffects').applyWeatherEffects(LibreDisplayRuntime.getModule('config').wxData,source);}catch(_e){}
  applyProductTheme(source.uiTheme||'libre-night');
  const q=(v,lo,hi,def)=>{const n=Number(v);return Math.min(hi,Math.max(lo,Number.isFinite(n)?n:def));};
  const per=source.layoutContentScale&&typeof source.layoutContentScale==='object'?source.layoutContentScale:{};
  const es=k=>q(per[k],50,200,100)/100;
  const cal=q(source.uiCalendarPct,75,140,100)*es('calendar'), cur=q(source.uiCurrentPct,75,140,100)*es('current'), clk=q(source.uiClockPct,75,140,100)*es('clock');
  const dailyFc=q(source.uiForecastPct,75,150,100)*es('daily'), hourlyFc=q(source.uiForecastPct,75,150,100)*es('hourly'), det=q(source.uiDetailsPct,75,140,100)*es('details'), al=q(source.uiAlertPct,75,150,100)*es('alerts');
  const gap=q(source.forecastGapPx,0,16,5), rowGap=q(source.forecastRowGapPx,4,36,18);
  const calH=q(source.calendarBandHeight,120,210,150), bottomH=q(source.bottomPanelHeight,270,410,330);
  const leftW=q(source.leftPanelWidth,410,560,470), sidePad=q(source.sidePaddingPx,10,48,28);
  const dailyCols=Math.min(14,Math.max(3,Number(source.dailyForecastDays)||Number(source.forecastColumns)||12));
  const hourlyCols=Math.min(24,Math.max(3,Number(source.hourlyForecastHours)||Number(source.forecastColumns)||12));
  const calCols=Math.min(10,Math.max(2,Number(source.calendarColumns)||7));
  const calCellH=Math.min(240,Math.max(90,Number(source.calendarCellHeight)||150));
  const textColor=normalizeHexColor(source.primaryTextColor,'#ffffff');
  const rgb=hexRgb(textColor);
  const secondary=q(source.secondaryOpacity,45,100,88)/100;
  const tertiary=Math.max(.3,secondary*.68);
  const shadowAlpha=Math.min(.95,.80*q(source.textShadowPct,0,140,100)/100);
  const detailCfg=weatherDetailsConfig(source);
  const detailEnabledCount=detailCfg.order.filter(k=>detailCfg.enabled[k]).length;
  const detailCount=Math.max(1,detailEnabledCount);
  const detailW=Math.max(380,leftW-18);
  const blur=q(source.bgBlurPx,0,12,0);
  const transition=q(source.bgTransitionSec,0,4,1.5);
  const alertOpacity=q(source.alertOpacityPct,55,100,100)/100;
  const part=(key,name)=>normalizePartStyleValue(source.layoutPartStyle?.[key]?.[name]||{}),ps=(key,name)=>part(key,name).scale/100,pe=(key,name)=>partStyleExtras(part(key,name));
  let style=document.getElementById('user-ui-overrides');
  if(!style){style=document.createElement('style');style.id='user-ui-overrides';document.head.appendChild(style);}
  style.textContent=`
    #app,#alert-zone,#cog{font-family:${fontCssValue(source.fontFamily)};color:${textColor}}
    #cog{width:${q(source.settingsCogSize,36,58,46)}px;height:${q(source.settingsCogSize,36,58,46)}px;opacity:${(q(source.settingsCogOpacity,10,90,42)/100).toFixed(2)};top:${String(source.settingsCogPosition||'').startsWith('top')?'22px':'auto'};bottom:${String(source.settingsCogPosition||'').startsWith('bottom')?'22px':'auto'};left:${String(source.settingsCogPosition||'').endsWith('left')?'22px':'auto'};right:${String(source.settingsCogPosition||'').endsWith('right')?'22px':'auto'}}
    html.cursor-active #cog{opacity:${Math.min(.95,q(source.settingsCogOpacity,10,90,42)/100+.18).toFixed(2)}}
    #cog::before{display:${source.settingsCogLabel===false?'none':'block'};right:${String(source.settingsCogPosition||'').endsWith('left')?'auto':'54px'};left:${String(source.settingsCogPosition||'').endsWith('left')?'54px':'auto'};transform:${String(source.settingsCogPosition||'').endsWith('left')?'translate(-7px,-50%)':'translate(7px,-50%)'}}
    #cog:hover::before,#cog:focus-visible::before,#cog.cog-discover::before{transform:translate(0,-50%)}
    #top-strip{height:${calH}px;padding-left:${sidePad}px;padding-right:${sidePad}px;grid-template-columns:repeat(${calCols},minmax(0,1fr));--ld-layout-calendar-row-base:${calCellH}px;grid-auto-rows:var(--ld-layout-calendar-row,var(--ld-layout-calendar-row-base));overflow-y:auto;overflow-x:hidden}
    #bottom{grid-template-columns:${leftW}px minmax(0,1fr);min-height:${bottomH}px;padding-left:${sidePad}px;padding-right:${sidePad}px}
    #wx-left{width:${leftW}px}
    .wx-details{width:${detailW}px;grid-template-columns:repeat(${weatherDetailColumnCount(detailCount)},minmax(0,1fr));display:${detailEnabledCount>0?'grid':'none'}}
    #wx-right{gap:${rowGap}px;display:${source.showDailyForecast===false&&source.showHourlyForecast===false?'none':'grid'}}
    .wx-forecast{display:${source.showDailyForecast===false?'none':'grid'}}
    #wx-hourly-block{display:${source.showHourlyForecast===false?'none':'block'}}
    .wx-forecast{grid-template-columns:repeat(${dailyCols},minmax(0,1fr));gap:${gap}px}
    .wx-hourly{grid-template-columns:repeat(${hourlyCols},minmax(0,1fr));gap:${gap}px}
    #calendar-legend{top:${calH+3}px;left:${sidePad}px;right:${sidePad}px}
    #alert-zone{top:${calH+(source.calendarLegend?36:14)}px;bottom:${bottomH+30}px;left:${sidePad}px;right:${sidePad}px}
    #bg,#bg-next{filter:blur(${blur}px);transform:${blur?`scale(${(1+blur/300).toFixed(3)})`:'none'};transition:opacity ${transition}s ease}
    .day-num{font-size:${scaledClamp(30,2.55,42,cal*ps('calendar','dayNumber'))};color:${textColor};${pe('calendar','dayNumber')}}
    .day-label{font-size:${scaledClamp(14,1.18,20,cal*ps('calendar','dayLabel'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('calendar','dayLabel')}}
    .no-events{font-size:${scaledClamp(12,1,17,cal*ps('calendar','emptyText'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${tertiary.toFixed(3)});${pe('calendar','emptyText')}}
    .event-time{font-size:${scaledClamp(11,.92,15,cal*ps('calendar','eventText')*ps('calendar','eventTime'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(1,secondary*.86).toFixed(3)});${pe('calendar','eventText')}${pe('calendar','eventTime')}}
    .event-title{font-size:${scaledClamp(12,1.02,17,cal*ps('calendar','eventText')*ps('calendar','eventTitle'))};color:${textColor};padding-left:${source.showEventTimes===false?'0':'9px'};${pe('calendar','eventText')}${pe('calendar','eventTitle')}}
    .event-title-no-time{display:flex;align-items:center;gap:6px;padding-left:0}
    .wx-location{font-size:${scaledClamp(11,.82,15,cur*ps('current','locationLabel'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(1,secondary*.9).toFixed(3)});${pe('current','locationLabel')}}
    .wx-temp{font-size:${scaledClamp(66,5.9,96,cur*ps('current','temperature'))};color:${textColor};${pe('current','temperature')}}
    .wx-icon-big{font-size:${scaledClamp(36,3.4,54,cur*ps('current','icon'))};${pe('current','icon')}}
    .wx-feels{font-size:${scaledClamp(17,1.25,23,cur*ps('current','feelsLike'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('current','feelsLike')}}
    .wx-cond{font-size:${scaledClamp(17,1.25,23,cur*ps('current','condition'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('current','condition')}}
    .clock-time{font-size:${scaledClamp(66,6,102,clk*ps('clock','time'))};color:${textColor};${pe('clock','time')}}
    .clock-time.wide-time{font-size:${scaledClamp(62,5.55,94,clk*ps('clock','time'))}}
    .clock-sec{font-size:${scaledClamp(20,1.8,30,clk*ps('clock','seconds'))};color:${textColor};${pe('clock','seconds')}}
    .clock-date{font-size:${scaledClamp(16,1.35,24,clk*ps('clock','date'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('clock','date')}}
    .fc-col .fc-day-name{font-size:${scaledClamp(13,.95,18,dailyFc*ps('daily','day'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('daily','day')}}
    .fc-col .fc-icon{font-size:${scaledClamp(23,1.7,32,dailyFc*ps('daily','icon'))};${pe('daily','icon')}}
    .fc-col .fc-rain{font-size:${scaledClamp(11,.8,15,dailyFc*ps('daily','precip'))};${pe('daily','precip')}}
    .fc-col .fc-temps{font-size:${scaledClamp(13,.95,18,dailyFc*ps('daily','temperature'))};color:${textColor};${pe('daily','temperature')}}
    .hr-col .hr-time{font-size:${scaledClamp(14,1,19,hourlyFc*ps('hourly','time'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${secondary.toFixed(3)});${pe('hourly','time')}}
    .hr-col .hr-icon{font-size:${scaledClamp(24,1.85,34,hourlyFc*ps('hourly','icon'))};${pe('hourly','icon')}}
    .hr-col .hr-rain{font-size:${scaledClamp(12,.86,16,hourlyFc*ps('hourly','precip'))};${pe('hourly','precip')}}
    .hr-col .hr-temp{font-size:${scaledClamp(15,1.05,20,hourlyFc*ps('hourly','temperature'))};color:${textColor};${pe('hourly','temperature')}}
    .wx-detail .wd-icon{font-size:${(21*det/100*ps('details','icon')).toFixed(2)}px;${pe('details','icon')}}
    .wx-detail .wd-label{font-size:${scaledClamp(13,.92,17,det*ps('details','label'))};color:rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(1,secondary*.82).toFixed(3)});${pe('details','label')}}
    .wx-detail .wd-val{font-size:${scaledClamp(15,1,19,det*ps('details','value'))};color:${textColor};${pe('details','value')}}
    .alert-card{opacity:${alertOpacity.toFixed(2)}}
    .alert-icon{font-size:${scaledClamp(42,3.4,60,al*ps('alerts','icon'))};${pe('alerts','icon')}}
    .alert-title{font-size:${scaledClamp(18,1.45,28,al*ps('alerts','title'))};${pe('alerts','title')}}
    .alert-expiry{font-size:${scaledClamp(11,.88,15,al*ps('alerts','expiry'))};display:${source.alertShowExpiry===false?'none':'block'};${pe('alerts','expiry')}}
    .alert-text{font-size:${scaledClamp(14,1.14,21,al*ps('alerts','body'))};${pe('alerts','body')}}
    .alert-meta{font-size:${scaledClamp(10,.74,13,al*ps('alerts','meta'))};display:${source.alertShowMeta===false?'none':'block'};${pe('alerts','meta')}}
    #top-strip,#wx-left,#wx-right,#clock-block{ text-shadow:0 2px 8px rgba(0,0,0,${shadowAlpha.toFixed(3)}) }
  `+buildCustomLayoutPartCss(source);
  const root=document.documentElement;
  root.style.setProperty('--bg-shade-top',(q(source.bgShadeTop,0,85,52)/100).toFixed(2));
  root.style.setProperty('--bg-shade-bottom',(q(source.bgShadeBottom,0,85,55)/100).toFixed(2));
  root.style.setProperty('--bg-size',['cover','contain'].includes(source.bgFit)?source.bgFit:'cover');
  root.style.setProperty('--bg-position',['center','center top','center bottom','left center','right center'].includes(source.bgPosition)?source.bgPosition:'center');
  const icon=document.getElementById('wx-icon'); if(icon)icon.style.display=source.showCurrentIcon===false?'none':'';
  LibreDisplayRuntime.getModule('onboarding').renderCalendarLegend();
  ensureCustomBlocksRendered(source.customBlocks||cfg.customBlocks||[]);
  renderLayoutShowcase(source);
  applyCustomLayout(source);
  applyBuiltInElementStyles(source);
  updateCustomBlockUniversalStates(source.customBlocks||cfg.customBlocks||[]);
  updateLayoutModeStatus(source);
  tick();
}

function formatScreenCareMinutes(value){
  const n=Number(value)||0;if(n<1)return `${Math.round(n*60)} sec`;if(n<60)return `${Number.isInteger(n)?n:n.toFixed(1)} min`;const h=n/60;return `${Number.isInteger(h)?h:h.toFixed(1)} hr`;
}
function updateScreenCareControlState(source=null){
  const getBool=id=>!!document.getElementById(id)?.checked;
  const master=source?!!source.burnInCareEnabled:getBool('s-burnin-care-enabled');
  const idle=source?!!source.burnInIdleDimmingEnabled:getBool('s-burnin-idle-dimming');
  const quiet=source?!!source.burnInQuietHoursEnabled:getBool('s-burnin-quiet-hours');
  const deep=source?!!source.burnInDeepProtection:getBool('s-burnin-deep-protection');
  const shift=source?!!source.burnInPixelShift:getBool('s-burnin-pixel-shift');
  for(const id of ['s-burnin-idle','s-burnin-brightness']){const el=document.getElementById(id);if(el)el.disabled=!master||!idle;}
  for(const id of ['s-burnin-quiet-start','s-burnin-quiet-end','s-burnin-quiet-wake-enabled']){const el=document.getElementById(id);if(el)el.disabled=!master||!quiet;}
  const wakeEnabled=source?source.burnInQuietWakeEnabled!==false:getBool('s-burnin-quiet-wake-enabled');const wake=document.getElementById('s-burnin-quiet-wake');if(wake)wake.disabled=!master||!quiet||!wakeEnabled;
  for(const id of ['s-burnin-deep-idle','s-burnin-deep-brightness']){const el=document.getElementById(id);if(el)el.disabled=!master||!deep;}
  for(const id of ['s-burnin-shift-mode','s-burnin-shift-interval','s-burnin-shift-distance','s-burnin-shift-transition']){const el=document.getElementById(id);if(el)el.disabled=!master||!shift;}
  const idleMinutes=Number(document.getElementById('s-burnin-idle')?.value)||30,deepIdle=document.getElementById('s-burnin-deep-idle');if(deepIdle){const min=idle?Math.max(15,idleMinutes):15;deepIdle.min=String(min);if(Number(deepIdle.value)<min)deepIdle.value=String(Math.ceil(min/5)*5);}
}

function appearanceFromForm(){
  const result={...cfg,
    uiTheme:document.querySelector('.theme-choice-card.selected')?.dataset.theme||cfg.uiTheme||'libre-night',
    fontFamily:document.getElementById('s-font-family')?.value||'Inter',
    primaryTextColor:normalizeHexColor(document.getElementById('s-text-hex')?.value,document.getElementById('s-text-color')?.value||'#ffffff'),
    secondaryOpacity:Number(document.getElementById('s-secondary-opacity')?.value)||88,
    textShadowPct:Number(document.getElementById('s-text-shadow')?.value)??100,
    uiCalendarPct:Number(document.getElementById('s-ui-calendar')?.value)||100,
    uiCurrentPct:Number(document.getElementById('s-ui-current')?.value)||100,
    uiClockPct:Number(document.getElementById('s-ui-clock')?.value)||100,
    uiForecastPct:Number(document.getElementById('s-ui-forecast')?.value)||100,
    uiDetailsPct:Number(document.getElementById('s-ui-details')?.value)||100,
    uiAlertPct:Number(document.getElementById('s-ui-alert')?.value)||100,
    calendarBandHeight:Number(document.getElementById('s-calendar-height')?.value)||150,
    bottomPanelHeight:Number(document.getElementById('s-bottom-height')?.value)||330,
    leftPanelWidth:Number(document.getElementById('s-left-width')?.value)||470,
    sidePaddingPx:Number(document.getElementById('s-side-padding')?.value)||28,
    forecastGapPx:Number(document.getElementById('s-forecast-gap')?.value)??5,
    forecastRowGapPx:Number(document.getElementById('s-forecast-row-gap')?.value)||18,
    forecastColumns:Number(document.getElementById('s-daily-days')?.value)||12,
    hourlyForecastHours:Number(document.getElementById('s-hourly-hours')?.value)||12,
    dailyForecastDays:Number(document.getElementById('s-daily-days')?.value)||12,
    calendarDays:Number(document.getElementById('s-calendar-days')?.value)||7,
    calendarColumns:Number(document.getElementById('s-calendar-columns')?.value)||7,
    calendarCellHeight:Number(document.getElementById('s-calendar-cell-height')?.value)||150,
    calendarScrollMode:document.getElementById('s-calendar-scroll-mode')?.value||'off',
    calendarScrollSpeed:Number(document.getElementById('s-calendar-scroll-speed')?.value)||12,
    layoutGridPx:Number(document.getElementById('s-layout-grid')?.value)||cfg.layoutGridPx||20,layoutSurfaceStyle:document.getElementById('s-layout-surface')?.value||cfg.layoutSurfaceStyle||'clean',
    layoutSnap:document.getElementById('s-layout-snap')?.checked!==false,
    calendarMaxEvents:Number(document.getElementById('s-calendar-max-events')?.value)||4,
    showNoEvents:!!document.getElementById('s-show-no-events')?.checked,
    showEventTimes:!!document.getElementById('s-show-event-times')?.checked,
    calendarTimeStyle:document.getElementById('s-calendar-time-style')?.value||cfg.calendarTimeStyle||'start',
    calendarLegend:!!document.getElementById('s-calendar-legend')?.checked,
    calendarShowContinuation:!!document.getElementById('s-calendar-show-continuation')?.checked,
    showDailyForecast:!!document.getElementById('s-show-daily')?.checked,
    showHourlyForecast:!!document.getElementById('s-show-hourly')?.checked,
    showPrecip:!!document.getElementById('s-show-precip')?.checked,
    timeFormat:document.getElementById('s-time-format')?.value||'12',
    dateFormat:document.getElementById('s-date-format')?.value||'long',
    showSeconds:!!document.getElementById('s-show-seconds')?.checked,
    showAmPm:!!document.getElementById('s-show-ampm')?.checked,
    showDate:!!document.getElementById('s-show-date')?.checked,
    showCurrentIcon:!!document.getElementById('s-show-current-icon')?.checked,
    ...weatherDetailsFromForm(),
    bgShadeTop:Number(document.getElementById('s-bg-top')?.value)??52,
    bgShadeBottom:Number(document.getElementById('s-bg-bottom')?.value)??55,
    bgBlurPx:Number(document.getElementById('s-bg-blur')?.value)||0,
    bgTransitionSec:Number(document.getElementById('s-bg-transition')?.value)??1.5,
    bgFit:document.getElementById('s-bg-fit')?.value||'cover',
    bgPosition:document.getElementById('s-bg-position')?.value||'center',
    alertOpacityPct:Number(document.getElementById('s-alert-opacity')?.value)||100,
    alertMinSeverity:document.getElementById('s-alert-min-severity')?.value||'all',
    alertShowExpiry:!!document.getElementById('s-alert-show-expiry')?.checked,
    alertShowMeta:!!document.getElementById('s-alert-show-meta')?.checked,
    locale:document.getElementById('s-locale')?.value||'auto',
    motionPreference:document.getElementById('s-motion-preference')?.value||'auto',
    highContrast:!!document.getElementById('s-high-contrast')?.checked,
    focusOutline:!!document.getElementById('s-focus-outline')?.checked,
    settingsUiSize:document.getElementById('s-settings-ui-size')?.value||'standard',
    burnInCareEnabled:!!document.getElementById('s-burnin-care-enabled')?.checked,
    burnInIdleDimmingEnabled:!!document.getElementById('s-burnin-idle-dimming')?.checked,
    burnInQuietHoursEnabled:!!document.getElementById('s-burnin-quiet-hours')?.checked,
    burnInQuietWakeEnabled:document.getElementById('s-burnin-quiet-wake-enabled')?.checked!==false,
    burnInPauseAnimationsDimmed:document.getElementById('s-burnin-pause-animations')?.checked!==false,
    burnInDimMode:document.getElementById('s-burnin-quiet-hours')?.checked?'schedule':'activity',
    burnInQuietStart:document.getElementById('s-burnin-quiet-start')?.value||'22:00',
    burnInQuietEnd:document.getElementById('s-burnin-quiet-end')?.value||'07:00',
    burnInQuietWakeMin:Number(document.getElementById('s-burnin-quiet-wake')?.value)||5,
    burnInProtection:!!document.getElementById('s-burnin-idle-dimming')?.checked||!!document.getElementById('s-burnin-quiet-hours')?.checked,
    burnInPixelShift:!!document.getElementById('s-burnin-pixel-shift')?.checked,
    burnInIdleMin:Number(document.getElementById('s-burnin-idle')?.value)||30,
    burnInBrightnessPct:Number(document.getElementById('s-burnin-brightness')?.value)||40,
    burnInDeepProtection:!!document.getElementById('s-burnin-deep-protection')?.checked,
    burnInDeepTrigger:document.getElementById('s-burnin-deep-trigger')?.value||'idle',
    burnInDeepIdleMin:Number(document.getElementById('s-burnin-deep-idle')?.value)||180,
    burnInDeepBrightnessPct:Number(document.getElementById('s-burnin-deep-brightness')?.value??5),
    burnInShiftMode:document.getElementById('s-burnin-shift-mode')?.value||'always',
    burnInShiftMin:Number(document.getElementById('s-burnin-shift-interval')?.value)||5,
    burnInShiftPx:Number(document.getElementById('s-burnin-shift-distance')?.value)||2,
    burnInShiftTransitionSec:Number(document.getElementById('s-burnin-shift-transition')?.value??1.2),
    weatherAnimationsEnabled:!!document.getElementById('s-weather-animations')?.checked,
    weatherWidgetAnimations:document.getElementById('s-weather-widget-animations')?.checked!==false,
    weatherFullscreenEffects:!!document.getElementById('s-weather-fullscreen-effects')?.checked,
    weatherEffectMode:document.getElementById('s-weather-effect-mode')?.value||'auto',
    weatherEffectIntensity:Number(document.getElementById('s-weather-effect-intensity')?.value)||50,
    weatherEffectOpacity:Number(document.getElementById('s-weather-effect-opacity')?.value)||34,
    weatherEffectSpeed:Number(document.getElementById('s-weather-effect-speed')?.value)||100,
    weatherEffectAutoIntensity:document.getElementById('s-weather-effect-auto-intensity')?.checked!==false,weatherEffectAtmosphere:Number(document.getElementById('s-weather-effect-atmosphere')?.value)??55,weatherEffectParticleScale:Number(document.getElementById('s-weather-effect-particle-scale')?.value)||100,
    weatherEffectWindStrength:Number(document.getElementById('s-weather-effect-wind-strength')?.value)??100,weatherEffectLightningFrequency:document.getElementById('s-weather-effect-lightning-frequency')?.value||'normal',weatherEffectLightningBrightness:Number(document.getElementById('s-weather-effect-lightning-brightness')?.value)||65,
    weatherEffectPrecipitation:document.getElementById('s-weather-effect-precipitation')?.checked!==false,weatherRainEnabled:document.getElementById('s-weather-rain-enabled')?.checked!==false,weatherSnowEnabled:document.getElementById('s-weather-snow-enabled')?.checked!==false,
    weatherEffectClouds:document.getElementById('s-weather-effect-clouds')?.checked!==false,
    weatherEffectFog:document.getElementById('s-weather-effect-fog')?.checked!==false,
    weatherEffectSun:document.getElementById('s-weather-effect-sun')?.checked!==false,
    weatherEffectWind:document.getElementById('s-weather-effect-wind')?.checked!==false,
    weatherEffectLightning:document.getElementById('s-weather-effect-lightning')?.checked!==false,weatherRainDensity:Number(document.getElementById('s-weather-rain-density')?.value??100),weatherRainSize:Number(document.getElementById('s-weather-rain-size')?.value??100),weatherRainSplash:Number(document.getElementById('s-weather-rain-splash')?.value??70),weatherSnowDensity:Number(document.getElementById('s-weather-snow-density')?.value??100),weatherSnowSize:Number(document.getElementById('s-weather-snow-size')?.value??100),weatherSnowDrift:Number(document.getElementById('s-weather-snow-drift')?.value??100),weatherFogDensity:Number(document.getElementById('s-weather-fog-density')?.value??115),weatherFogSpeed:Number(document.getElementById('s-weather-fog-speed')?.value??80),weatherSeasonLeaves:document.getElementById('s-weather-season-leaves')?.checked!==false,weatherSeasonLeavesIntensity:Number(document.getElementById('s-weather-leaves-intensity')?.value??100),weatherSeasonGrass:document.getElementById('s-weather-season-grass')?.checked!==false,weatherSeasonGrassIntensity:Number(document.getElementById('s-weather-grass-intensity')?.value??100),weatherSeasonPetals:document.getElementById('s-weather-season-petals')?.checked!==false,weatherSeasonPetalIntensity:Number(document.getElementById('s-weather-petal-intensity')?.value??80),weatherSeasonCrystals:document.getElementById('s-weather-season-crystals')?.checked!==false,weatherColdFrost:document.getElementById('s-weather-cold-frost')?.checked!==false,weatherColdFrostIntensity:Number(document.getElementById('s-weather-cold-frost-intensity')?.value??55),
    weatherEffectRespectReducedMotion:document.getElementById('s-weather-effect-reduced-motion')?.checked!==false,
    weatherEffectPauseWhenDimmed:document.getElementById('s-weather-effect-pause-dimmed')?.checked!==false,
    weatherSeasonalEffects:document.getElementById('s-weather-seasonal-effects')?.checked!==false,weatherSeasonMode:document.getElementById('s-weather-season-mode')?.value||'auto',weatherSeasonalIntensity:Number(document.getElementById('s-weather-seasonal-intensity')?.value)??45,weatherBirdHabitat:document.getElementById('s-weather-bird-habitat')?.value||'auto',weatherDogBreed:document.getElementById('s-weather-dog-breed')?.value||'labrador',weatherDogVariant:document.getElementById('s-weather-dog-labrador-coat')?.value||'yellow',weatherDogLabradorCoat:document.getElementById('s-weather-dog-labrador-coat')?.value||'yellow',weatherDogAccessory:document.getElementById('s-weather-dog-accessory')?.value||'collar',weatherDogAccessoryColor:weatherAppearanceApi.normalizeDogAccessoryHex?.(document.getElementById('s-weather-dog-accessory-color-hex')?.value,document.getElementById('s-weather-dog-accessory-color')?.value||'#3478d4')?.toLowerCase()||'#3478d4',weatherDogCollar:document.getElementById('s-weather-dog-accessory')?.value==='none'?'none':(cfg.weatherDogCollar||'blue'),weatherHazardEffects:document.getElementById('s-weather-hazard-effects')?.checked!==false,weatherHazardIntensity:Number(document.getElementById('s-weather-hazard-intensity')?.value??70),weatherHazardOpacity:Number(document.getElementById('s-weather-hazard-opacity')?.value??100),weatherHazardSpeed:Number(document.getElementById('s-weather-hazard-speed')?.value??100),weatherHazardMinSeverity:document.getElementById('s-weather-hazard-min-severity')?.value||'moderate',weatherHazardFlood:document.getElementById('s-weather-hazard-flood')?.checked!==false,weatherHazardFloodLevel:Number(document.getElementById('s-weather-hazard-flood-level')?.value??100),weatherHazardFloodDebris:Number(document.getElementById('s-weather-hazard-flood-debris')?.value??100),weatherHazardFloodSpeed:Number(document.getElementById('s-weather-hazard-flood-speed')?.value??100),weatherHazardWind:document.getElementById('s-weather-hazard-wind')?.checked!==false,weatherHazardWindGusts:Number(document.getElementById('s-weather-hazard-wind-gusts')?.value??100),weatherHazardWindSpeed:Number(document.getElementById('s-weather-hazard-wind-speed')?.value??100),weatherHazardTornado:document.getElementById('s-weather-hazard-tornado')?.checked!==false,weatherHazardTornadoSize:Number(document.getElementById('s-weather-hazard-tornado-size')?.value??100),weatherHazardTornadoOpacity:Number(document.getElementById('s-weather-hazard-tornado-opacity')?.value??100),weatherHazardTropical:document.getElementById('s-weather-hazard-tropical')?.checked!==false,weatherHazardTropicalBands:Number(document.getElementById('s-weather-hazard-tropical-bands')?.value??100),weatherHazardTropicalSurge:Number(document.getElementById('s-weather-hazard-tropical-surge')?.value??100),weatherHazardStorm:document.getElementById('s-weather-hazard-storm')?.checked!==false,weatherHazardStormCloud:Number(document.getElementById('s-weather-hazard-storm-cloud')?.value??100),weatherHazardStormGust:Number(document.getElementById('s-weather-hazard-storm-gust')?.value??100),weatherHazardWinter:document.getElementById('s-weather-hazard-winter')?.checked!==false,weatherHazardWinterWhiteout:Number(document.getElementById('s-weather-hazard-winter-whiteout')?.value??100),weatherHazardWinterDrift:Number(document.getElementById('s-weather-hazard-winter-drift')?.value??100),weatherHazardVisibility:document.getElementById('s-weather-hazard-visibility')?.checked!==false,weatherHazardVisibilityOpacity:Number(document.getElementById('s-weather-hazard-visibility-opacity')?.value??100),weatherHazardHeatFire:document.getElementById('s-weather-hazard-heat-fire')?.checked!==false,weatherHazardHeatShimmer:Number(document.getElementById('s-weather-hazard-heat-shimmer')?.value??100),...weatherAppearanceApi.weatherTuningFromForm(),
    settingsCogPosition:document.getElementById('s-cog-position')?.value||'bottom-right',
    settingsCogOpacity:Number(document.getElementById('s-cog-opacity')?.value)||42,
    settingsCogSize:Number(document.getElementById('s-cog-size')?.value)||46,
    settingsCogLabel:document.getElementById('s-cog-label')?.checked!==false
  };
  updateScreenCareControlState(result);
  return result;
}

function updateAppearanceLabels(v){
  const map=[
    ['s-secondary-opacity-value',v.secondaryOpacity,'%'],['s-text-shadow-value',v.textShadowPct,'%'],
    ['s-ui-calendar-value',v.uiCalendarPct,'%'],['s-ui-current-value',v.uiCurrentPct,'%'],['s-ui-clock-value',v.uiClockPct,'%'],['s-ui-forecast-value',v.uiForecastPct,'%'],['s-ui-details-value',v.uiDetailsPct,'%'],['s-ui-alert-value',v.uiAlertPct,'%'],
    ['s-calendar-height-value',v.calendarBandHeight,'px'],['s-bottom-height-value',v.bottomPanelHeight,'px'],['s-left-width-value',v.leftPanelWidth,'px'],['s-side-padding-value',v.sidePaddingPx,'px'],
    ['s-forecast-gap-value',v.forecastGapPx,'px'],['s-forecast-row-gap-value',v.forecastRowGapPx,'px'],['s-calendar-cell-height-value',v.calendarCellHeight||150,'px'],['s-calendar-scroll-speed-value',v.calendarScrollSpeed||12,' px/s'],
    ['s-bg-top-value',v.bgShadeTop,'%'],['s-bg-bottom-value',v.bgShadeBottom,'%'],['s-bg-blur-value',v.bgBlurPx,'px'],['s-bg-transition-value',v.bgTransitionSec,'s'],['s-alert-opacity-value',v.alertOpacityPct,'%'],['s-cog-opacity-value',v.settingsCogOpacity??42,'%']
  ];
  for(const [id,val,suffix] of map){const el=document.getElementById(id);if(el)el.textContent=String(val)+suffix;}
  const labels={
    's-burnin-quiet-wake-value':formatScreenCareMinutes(v.burnInQuietWakeMin||5),
    's-burnin-idle-value':formatScreenCareMinutes(v.burnInIdleMin||30),
    's-burnin-brightness-value':`${v.burnInBrightnessPct??40}%`,
    's-burnin-deep-idle-value':formatScreenCareMinutes(v.burnInDeepIdleMin||180),
    's-burnin-deep-brightness-value':`${v.burnInDeepBrightnessPct??5}%`,
    's-burnin-shift-interval-value':formatScreenCareMinutes(v.burnInShiftMin||5),
    's-burnin-shift-distance-value':`${v.burnInShiftPx||2} px`,
    's-burnin-shift-transition-value':`${Number(v.burnInShiftTransitionSec??1.2).toFixed(1)}s`,
    's-weather-effect-intensity-value':`${v.weatherEffectIntensity??50}%`,
    's-weather-effect-opacity-value':`${v.weatherEffectOpacity??34}%`,
    's-weather-effect-speed-value':`${v.weatherEffectSpeed??100}%`,
    's-weather-effect-atmosphere-value':`${v.weatherEffectAtmosphere??55}%`,'s-weather-effect-particle-scale-value':`${v.weatherEffectParticleScale??100}%`,'s-weather-effect-wind-strength-value':`${v.weatherEffectWindStrength??100}%`,'s-weather-effect-lightning-brightness-value':`${v.weatherEffectLightningBrightness??65}%`,'s-weather-seasonal-intensity-value':`${v.weatherSeasonalIntensity??45}%`,'s-weather-hazard-intensity-value':`${v.weatherHazardIntensity??70}%`,'s-weather-hazard-opacity-value':`${v.weatherHazardOpacity??100}%`,'s-weather-hazard-speed-value':`${v.weatherHazardSpeed??100}%`,'s-weather-hazard-flood-level-value':`${v.weatherHazardFloodLevel??100}%`,'s-weather-hazard-flood-debris-value':`${v.weatherHazardFloodDebris??100}%`,'s-weather-hazard-flood-speed-value':`${v.weatherHazardFloodSpeed??100}%`,'s-weather-hazard-wind-gusts-value':`${v.weatherHazardWindGusts??100}%`,'s-weather-hazard-wind-speed-value':`${v.weatherHazardWindSpeed??100}%`,'s-weather-hazard-tornado-size-value':`${v.weatherHazardTornadoSize??100}%`,'s-weather-hazard-tornado-opacity-value':`${v.weatherHazardTornadoOpacity??100}%`,'s-weather-hazard-tropical-bands-value':`${v.weatherHazardTropicalBands??100}%`,'s-weather-hazard-tropical-surge-value':`${v.weatherHazardTropicalSurge??100}%`,'s-weather-hazard-storm-cloud-value':`${v.weatherHazardStormCloud??100}%`,'s-weather-hazard-storm-gust-value':`${v.weatherHazardStormGust??100}%`,'s-weather-hazard-winter-whiteout-value':`${v.weatherHazardWinterWhiteout??100}%`,'s-weather-hazard-winter-drift-value':`${v.weatherHazardWinterDrift??100}%`,'s-weather-hazard-visibility-opacity-value':`${v.weatherHazardVisibilityOpacity??100}%`,'s-weather-hazard-heat-shimmer-value':`${v.weatherHazardHeatShimmer??100}%`,'s-weather-rain-density-value':`${v.weatherRainDensity??100}%`,'s-weather-rain-size-value':`${v.weatherRainSize??100}%`,'s-weather-rain-splash-value':`${v.weatherRainSplash??70}%`,'s-weather-snow-density-value':`${v.weatherSnowDensity??100}%`,'s-weather-snow-size-value':`${v.weatherSnowSize??100}%`,'s-weather-snow-drift-value':`${v.weatherSnowDrift??100}%`,'s-weather-fog-density-value':`${v.weatherFogDensity??115}%`,'s-weather-fog-speed-value':`${v.weatherFogSpeed??80}%`,'s-weather-leaves-intensity-value':`${v.weatherSeasonLeavesIntensity??100}%`,'s-weather-grass-intensity-value':`${v.weatherSeasonGrassIntensity??100}%`,'s-weather-petal-intensity-value':`${v.weatherSeasonPetalIntensity??80}%`,'s-weather-bug-intensity-value':`${v.weatherSeasonBugIntensity??70}%`,'s-weather-cold-frost-intensity-value':`${v.weatherColdFrostIntensity??55}%`
  };
  for(const [id,text] of Object.entries(labels)){const el=document.getElementById(id);if(el)el.textContent=text;}
  weatherAppearanceApi.updateWeatherTuningLabels(v);updateScreenCareControlState(v);
}

const APPEARANCE_DEFAULTS={
  uiTheme:'libre-night',fontFamily:'Inter',primaryTextColor:'#ffffff',secondaryOpacity:88,textShadowPct:100,
  uiCalendarPct:100,uiCurrentPct:100,uiClockPct:100,uiForecastPct:100,uiDetailsPct:100,uiAlertPct:100,
  calendarBandHeight:150,bottomPanelHeight:330,leftPanelWidth:470,sidePaddingPx:28,forecastGapPx:5,forecastRowGapPx:18,forecastColumns:12,hourlyForecastHours:12,dailyForecastDays:12,calendarDays:7,calendarColumns:7,calendarCellHeight:150,calendarScrollMode:'off',calendarScrollSpeed:12,layoutGridPx:20,layoutSurfaceStyle:'clean',layoutSnap:true,calendarMaxEvents:4,
  showNoEvents:true,showEventTimes:true,showDailyForecast:true,showHourlyForecast:true,showPrecip:true,timeFormat:'12',dateFormat:'long',showSeconds:true,showAmPm:true,showDate:true,showCurrentIcon:true,showSunset:true,showWind:true,showHumidity:true,weatherDetailsOrder:['sunset','wind','humidity','sunrise','airquality','uvindex','feelslike','pressure','cloudcover','dewpoint','precipitation'],weatherDetailsEnabled:{sunset:true,wind:true,humidity:true,sunrise:false,airquality:false,uvindex:false,feelslike:false,pressure:false,cloudcover:false,dewpoint:false,precipitation:false},
  bgShadeTop:52,bgShadeBottom:55,bgBlurPx:0,bgTransitionSec:1.5,bgFit:'cover',bgPosition:'center',alertOpacityPct:100,alertMinSeverity:'all',alertShowExpiry:true,alertShowMeta:true,locale:'auto',motionPreference:'auto',highContrast:false,focusOutline:false,settingsUiSize:'standard',burnInCareEnabled:false,burnInIdleDimmingEnabled:false,burnInQuietHoursEnabled:false,burnInQuietWakeEnabled:true,burnInPauseAnimationsDimmed:true,burnInDimMode:'activity',burnInQuietStart:'22:00',burnInQuietEnd:'07:00',burnInQuietWakeMin:5,burnInProtection:false,burnInPixelShift:false,burnInIdleMin:30,burnInBrightnessPct:40,burnInDeepProtection:false,burnInDeepTrigger:'idle',burnInDeepIdleMin:180,burnInDeepBrightnessPct:5,burnInShiftMode:'always',burnInShiftMin:5,burnInShiftPx:2,burnInShiftTransitionSec:1.2,weatherAnimationsEnabled:false,weatherWidgetAnimations:false,weatherFullscreenEffects:false,weatherEffectMode:'auto',weatherEffectIntensity:50,weatherEffectOpacity:34,weatherEffectSpeed:100,weatherEffectAutoIntensity:true,weatherEffectAtmosphere:55,weatherEffectParticleScale:100,weatherEffectWindStrength:100,weatherEffectLightningFrequency:'normal',weatherEffectLightningBrightness:65,weatherEffectPrecipitation:true,weatherRainEnabled:true,weatherSnowEnabled:true,weatherEffectClouds:true,weatherEffectFog:true,weatherEffectSun:true,weatherEffectWind:true,weatherEffectLightning:true,weatherRainDensity:100,weatherRainSize:100,weatherRainSplash:70,weatherSnowDensity:100,weatherSnowSize:100,weatherSnowDrift:100,weatherFogDensity:115,weatherFogSpeed:80,weatherSeasonLeaves:true,weatherSeasonLeavesIntensity:100,weatherSeasonGrass:true,weatherSeasonGrassIntensity:100,weatherSeasonPetals:true,weatherSeasonPetalIntensity:80,weatherSeasonBugs:true,weatherSeasonBugIntensity:70,weatherSeasonCrystals:true,weatherColdFrost:true,weatherColdFrostIntensity:55,weatherEffectRespectReducedMotion:true,weatherEffectPauseWhenDimmed:true,weatherSeasonalEffects:false,weatherSeasonMode:'auto',weatherSeasonalIntensity:45,weatherBirdHabitat:'auto',weatherDogCompanion:false,weatherDogBreed:'labrador',weatherDogVariant:'yellow',weatherDogLabradorCoat:'yellow',weatherDogAccessory:'collar',weatherDogAccessoryColor:'#3478d4',weatherDogCollar:'blue',weatherDogActivity:100,weatherDogSize:100,weatherDogOpacity:100,weatherHazardEffects:true,weatherHazardIntensity:70,weatherHazardOpacity:100,weatherHazardSpeed:100,weatherHazardMinSeverity:'moderate',weatherHazardFlood:true,weatherHazardFloodLevel:100,weatherHazardFloodDebris:100,weatherHazardFloodSpeed:100,weatherHazardWind:true,weatherHazardWindGusts:100,weatherHazardWindSpeed:100,weatherHazardTornado:true,weatherHazardTornadoSize:100,weatherHazardTornadoOpacity:100,weatherHazardTropical:true,weatherHazardTropicalBands:100,weatherHazardTropicalSurge:100,weatherHazardStorm:true,weatherHazardStormCloud:100,weatherHazardStormGust:100,weatherHazardWinter:true,weatherHazardWinterWhiteout:100,weatherHazardWinterDrift:100,weatherHazardVisibility:true,weatherHazardVisibilityOpacity:100,weatherHazardHeatFire:true,weatherHazardHeatShimmer:100,...weatherAppearanceApi.WEATHER_TUNING_DEFAULTS,settingsCogPosition:'bottom-right',settingsCogOpacity:42,settingsCogSize:46,settingsCogLabel:true
};
function setAppearanceForm(v){
  const locale=document.getElementById('s-locale');if(locale)locale.value=v.locale||'auto';
  const motion=document.getElementById('s-motion-preference');if(motion)motion.value=v.motionPreference||'auto';
  const contrast=document.getElementById('s-high-contrast');if(contrast)contrast.checked=!!v.highContrast;
  const focus=document.getElementById('s-focus-outline');if(focus)focus.checked=!!v.focusOutline;
  const settingsUiSize=document.getElementById('s-settings-ui-size');if(settingsUiSize)settingsUiSize.value=v.settingsUiSize||'standard';
  const burnCare=document.getElementById('s-burnin-care-enabled');if(burnCare)burnCare.checked=!!v.burnInCareEnabled;
  const burnIdleToggle=document.getElementById('s-burnin-idle-dimming');if(burnIdleToggle)burnIdleToggle.checked=!!v.burnInIdleDimmingEnabled;
  const burnQuietToggle=document.getElementById('s-burnin-quiet-hours');if(burnQuietToggle)burnQuietToggle.checked=!!v.burnInQuietHoursEnabled;
  const burnQuietWakeToggle=document.getElementById('s-burnin-quiet-wake-enabled');if(burnQuietWakeToggle)burnQuietWakeToggle.checked=v.burnInQuietWakeEnabled!==false;
  const burnPauseAnimations=document.getElementById('s-burnin-pause-animations');if(burnPauseAnimations)burnPauseAnimations.checked=v.burnInPauseAnimationsDimmed!==false;
  const burnQuietStart=document.getElementById('s-burnin-quiet-start');if(burnQuietStart)burnQuietStart.value=v.burnInQuietStart||'22:00';
  const burnQuietEnd=document.getElementById('s-burnin-quiet-end');if(burnQuietEnd)burnQuietEnd.value=v.burnInQuietEnd||'07:00';
  const burnQuietWake=document.getElementById('s-burnin-quiet-wake');if(burnQuietWake)burnQuietWake.value=String(v.burnInQuietWakeMin||5);
  const burnDeep=document.getElementById('s-burnin-deep-protection');if(burnDeep)burnDeep.checked=!!v.burnInDeepProtection;
  const burnDeepTrigger=document.getElementById('s-burnin-deep-trigger');if(burnDeepTrigger)burnDeepTrigger.value=v.burnInDeepTrigger||'idle';
  const burnShift=document.getElementById('s-burnin-pixel-shift');if(burnShift)burnShift.checked=!!v.burnInPixelShift;
  const burnIdle=document.getElementById('s-burnin-idle');if(burnIdle)burnIdle.value=String(v.burnInIdleMin||30);
  const burnBrightness=document.getElementById('s-burnin-brightness');if(burnBrightness)burnBrightness.value=String(v.burnInBrightnessPct||40);
  const burnDeepIdle=document.getElementById('s-burnin-deep-idle');if(burnDeepIdle)burnDeepIdle.value=String(v.burnInDeepIdleMin||180);
  const burnDeepBrightness=document.getElementById('s-burnin-deep-brightness');if(burnDeepBrightness)burnDeepBrightness.value=String(v.burnInDeepBrightnessPct??5);
  const burnShiftMode=document.getElementById('s-burnin-shift-mode');if(burnShiftMode)burnShiftMode.value=v.burnInShiftMode||'always';
  const burnShiftMin=document.getElementById('s-burnin-shift-interval');if(burnShiftMin)burnShiftMin.value=String(v.burnInShiftMin||5);
  const burnShiftPx=document.getElementById('s-burnin-shift-distance');if(burnShiftPx)burnShiftPx.value=String(v.burnInShiftPx||2);
  const burnShiftTransition=document.getElementById('s-burnin-shift-transition');if(burnShiftTransition)burnShiftTransition.value=String(v.burnInShiftTransitionSec??1.2);
  const weatherAnimations=document.getElementById('s-weather-animations');if(weatherAnimations)weatherAnimations.checked=!!v.weatherAnimationsEnabled;
  const weatherWidgetAnimations=document.getElementById('s-weather-widget-animations');if(weatherWidgetAnimations)weatherWidgetAnimations.checked=v.weatherWidgetAnimations!==false;
  const weatherFullscreenEffects=document.getElementById('s-weather-fullscreen-effects');if(weatherFullscreenEffects)weatherFullscreenEffects.checked=!!v.weatherFullscreenEffects;
  const weatherEffectMode=document.getElementById('s-weather-effect-mode');if(weatherEffectMode)weatherEffectMode.value=v.weatherEffectMode||'auto';
  for(const [id,val] of [['s-weather-effect-intensity',v.weatherEffectIntensity??50],['s-weather-effect-opacity',v.weatherEffectOpacity??34],['s-weather-effect-speed',v.weatherEffectSpeed??100],['s-weather-effect-atmosphere',v.weatherEffectAtmosphere??55],['s-weather-effect-particle-scale',v.weatherEffectParticleScale??100],['s-weather-effect-wind-strength',v.weatherEffectWindStrength??100],['s-weather-effect-lightning-brightness',v.weatherEffectLightningBrightness??65]]){const el=document.getElementById(id);if(el)el.value=String(val);}
  const weatherAutoIntensity=document.getElementById('s-weather-effect-auto-intensity'),weatherLightningFrequency=document.getElementById('s-weather-effect-lightning-frequency');if(weatherAutoIntensity)weatherAutoIntensity.checked=v.weatherEffectAutoIntensity!==false;if(weatherLightningFrequency)weatherLightningFrequency.value=v.weatherEffectLightningFrequency||'normal';
  for(const [id,key] of [['s-weather-effect-precipitation','weatherEffectPrecipitation'],['s-weather-rain-enabled','weatherRainEnabled'],['s-weather-snow-enabled','weatherSnowEnabled'],['s-weather-effect-clouds','weatherEffectClouds'],['s-weather-effect-fog','weatherEffectFog'],['s-weather-effect-sun','weatherEffectSun'],['s-weather-effect-wind','weatherEffectWind']]){const el=document.getElementById(id);if(el)el.checked=v[key]!==false;}
  const weatherLightning=document.getElementById('s-weather-effect-lightning');if(weatherLightning)weatherLightning.checked=v.weatherEffectLightning!==false;for(const [id,val] of [['s-weather-rain-density',v.weatherRainDensity??100],['s-weather-rain-size',v.weatherRainSize??100],['s-weather-rain-splash',v.weatherRainSplash??70],['s-weather-snow-density',v.weatherSnowDensity??100],['s-weather-snow-size',v.weatherSnowSize??100],['s-weather-snow-drift',v.weatherSnowDrift??100],['s-weather-fog-density',v.weatherFogDensity??115],['s-weather-fog-speed',v.weatherFogSpeed??80],['s-weather-leaves-intensity',v.weatherSeasonLeavesIntensity??100],['s-weather-grass-intensity',v.weatherSeasonGrassIntensity??100],['s-weather-petal-intensity',v.weatherSeasonPetalIntensity??80],['s-weather-cold-frost-intensity',v.weatherColdFrostIntensity??55]]){const el=document.getElementById(id);if(el)el.value=String(val);}for(const [id,val] of [['s-weather-season-leaves',v.weatherSeasonLeaves!==false],['s-weather-season-grass',v.weatherSeasonGrass!==false],['s-weather-season-petals',v.weatherSeasonPetals!==false],['s-weather-season-crystals',v.weatherSeasonCrystals!==false],['s-weather-cold-frost',v.weatherColdFrost!==false]]){const el=document.getElementById(id);if(el)el.checked=val;}
  weatherAppearanceApi.setWeatherTuningForm(v);
  const weatherReduced=document.getElementById('s-weather-effect-reduced-motion');if(weatherReduced)weatherReduced.checked=v.weatherEffectRespectReducedMotion!==false;
  const weatherPauseDimmed=document.getElementById('s-weather-effect-pause-dimmed');if(weatherPauseDimmed)weatherPauseDimmed.checked=v.weatherEffectPauseWhenDimmed!==false;
  const weatherSeasonal=document.getElementById('s-weather-seasonal-effects'),weatherSeasonMode=document.getElementById('s-weather-season-mode'),weatherSeasonalIntensity=document.getElementById('s-weather-seasonal-intensity'),weatherBirdHabitat=document.getElementById('s-weather-bird-habitat');if(weatherSeasonal)weatherSeasonal.checked=v.weatherSeasonalEffects!==false;if(weatherSeasonMode)weatherSeasonMode.value=v.weatherSeasonMode||'auto';if(weatherSeasonalIntensity)weatherSeasonalIntensity.value=String(v.weatherSeasonalIntensity??45);if(weatherBirdHabitat)weatherBirdHabitat.value=v.weatherBirdHabitat||'auto';const dogBreed=document.getElementById('s-weather-dog-breed'),dogCoat=document.getElementById('s-weather-dog-labrador-coat'),dogAccessory=document.getElementById('s-weather-dog-accessory'),dogAccessoryColorInput=document.getElementById('s-weather-dog-accessory-color'),dogAccessoryHex=document.getElementById('s-weather-dog-accessory-color-hex');if(dogBreed)dogBreed.value=v.weatherDogBreed||'labrador';if(dogCoat)weatherAppearanceApi.syncDogVariantOptions?.(v.weatherDogVariant||v.weatherDogLabradorCoat||'');if(dogAccessory)dogAccessory.value=v.weatherDogAccessory||(v.weatherDogCollar==='none'?'none':'collar');const resolvedDogAccessoryColor=/^#[0-9a-f]{6}$/i.test(String(v.weatherDogAccessoryColor||''))?String(v.weatherDogAccessoryColor):'#3478d4';if(dogAccessoryColorInput)dogAccessoryColorInput.value=resolvedDogAccessoryColor;if(dogAccessoryHex)dogAccessoryHex.value=resolvedDogAccessoryColor.toUpperCase();weatherAppearanceApi.initDogAccessoryColorControls?.();const hazardEffects=document.getElementById('s-weather-hazard-effects'),hazardMin=document.getElementById('s-weather-hazard-min-severity');if(hazardEffects)hazardEffects.checked=v.weatherHazardEffects!==false;if(hazardMin)hazardMin.value=v.weatherHazardMinSeverity||'moderate';for(const [id,key] of [['s-weather-hazard-flood','weatherHazardFlood'],['s-weather-hazard-wind','weatherHazardWind'],['s-weather-hazard-tornado','weatherHazardTornado'],['s-weather-hazard-tropical','weatherHazardTropical'],['s-weather-hazard-storm','weatherHazardStorm'],['s-weather-hazard-winter','weatherHazardWinter'],['s-weather-hazard-visibility','weatherHazardVisibility'],['s-weather-hazard-heat-fire','weatherHazardHeatFire']]){const el=document.getElementById(id);if(el)el.checked=v[key]!==false;}for(const [id,key,fallback] of [['s-weather-hazard-intensity','weatherHazardIntensity',70],['s-weather-hazard-opacity','weatherHazardOpacity',100],['s-weather-hazard-speed','weatherHazardSpeed',100],['s-weather-hazard-flood-level','weatherHazardFloodLevel',100],['s-weather-hazard-flood-debris','weatherHazardFloodDebris',100],['s-weather-hazard-flood-speed','weatherHazardFloodSpeed',100],['s-weather-hazard-wind-gusts','weatherHazardWindGusts',100],['s-weather-hazard-wind-speed','weatherHazardWindSpeed',100],['s-weather-hazard-tornado-size','weatherHazardTornadoSize',100],['s-weather-hazard-tornado-opacity','weatherHazardTornadoOpacity',100],['s-weather-hazard-tropical-bands','weatherHazardTropicalBands',100],['s-weather-hazard-tropical-surge','weatherHazardTropicalSurge',100],['s-weather-hazard-storm-cloud','weatherHazardStormCloud',100],['s-weather-hazard-storm-gust','weatherHazardStormGust',100],['s-weather-hazard-winter-whiteout','weatherHazardWinterWhiteout',100],['s-weather-hazard-winter-drift','weatherHazardWinterDrift',100],['s-weather-hazard-visibility-opacity','weatherHazardVisibilityOpacity',100],['s-weather-hazard-heat-shimmer','weatherHazardHeatShimmer',100]]){const el=document.getElementById(id);if(el)el.value=String(v[key]??fallback);}
  updateScreenCareControlState(v);
  renderThemeChoices(v.uiTheme||'libre-night');
  const values={
    's-font-family':v.fontFamily,'s-secondary-opacity':v.secondaryOpacity,'s-text-shadow':v.textShadowPct,
    's-ui-calendar':v.uiCalendarPct,'s-ui-current':v.uiCurrentPct,'s-ui-clock':v.uiClockPct,'s-ui-forecast':v.uiForecastPct,'s-ui-details':v.uiDetailsPct,'s-ui-alert':v.uiAlertPct,
    's-calendar-height':v.calendarBandHeight,'s-bottom-height':v.bottomPanelHeight,'s-left-width':v.leftPanelWidth,'s-side-padding':v.sidePaddingPx,'s-forecast-gap':v.forecastGapPx,'s-forecast-row-gap':v.forecastRowGapPx,
    's-hourly-hours':v.hourlyForecastHours||v.forecastColumns||12,'s-daily-days':v.dailyForecastDays||v.forecastColumns||12,'s-calendar-days':v.calendarDays,'s-calendar-columns':v.calendarColumns||7,'s-calendar-cell-height':v.calendarCellHeight||150,'s-calendar-scroll-mode':v.calendarScrollMode||'off','s-calendar-scroll-speed':v.calendarScrollSpeed||12,'s-layout-grid':v.layoutGridPx||20,'s-layout-surface':v.layoutSurfaceStyle||'clean','s-calendar-max-events':v.calendarMaxEvents,'s-time-format':v.timeFormat,'s-date-format':v.dateFormat,
    's-bg-top':v.bgShadeTop,'s-bg-bottom':v.bgShadeBottom,'s-bg-blur':v.bgBlurPx,'s-bg-transition':v.bgTransitionSec,'s-bg-fit':v.bgFit,'s-bg-position':v.bgPosition,
    's-alert-opacity':v.alertOpacityPct,'s-alert-min-severity':v.alertMinSeverity,'s-cog-position':v.settingsCogPosition||'bottom-right','s-cog-opacity':v.settingsCogOpacity??42,'s-cog-size':v.settingsCogSize||46
  };
  for(const [id,val] of Object.entries(values)){const el=document.getElementById(id);if(el)el.value=String(val);}
  const checks={
    's-layout-snap':v.layoutSnap!==false,
    's-show-no-events':v.showNoEvents,'s-show-event-times':v.showEventTimes,'s-show-daily':v.showDailyForecast,'s-show-hourly':v.showHourlyForecast,'s-show-precip':v.showPrecip,
    's-show-seconds':v.showSeconds,'s-show-ampm':v.showAmPm,'s-show-date':v.showDate,'s-show-current-icon':v.showCurrentIcon,
    's-alert-show-expiry':v.alertShowExpiry,'s-alert-show-meta':v.alertShowMeta,'s-cog-label':v.settingsCogLabel!==false
  };
  for(const [id,val] of Object.entries(checks)){const el=document.getElementById(id);if(el)el.checked=val!==false;}
  const color=normalizeHexColor(v.primaryTextColor,'#ffffff');
  const picker=document.getElementById('s-text-color'),hex=document.getElementById('s-text-hex');
  if(picker)picker.value=color;if(hex)hex.value=color.toUpperCase();
  setWeatherDetailsForm(v);
  updateAppearanceLabels(v);
  updateFontPreview();
}

const PRESET_CONTENT_PRESERVE_KEYS=['weatherDetailsOrder','weatherDetailsEnabled','showSunset','showWind','showHumidity','calendarTimeStyle','calendarLegend','calendarShowContinuation','weatherAnimationsEnabled','weatherWidgetAnimations','weatherFullscreenEffects','weatherEffectMode','weatherEffectIntensity','weatherEffectOpacity','weatherEffectSpeed','weatherEffectAutoIntensity','weatherEffectAtmosphere','weatherEffectParticleScale','weatherEffectWindStrength','weatherEffectLightningFrequency','weatherEffectLightningBrightness','weatherEffectPrecipitation','weatherEffectClouds','weatherEffectFog','weatherEffectSun','weatherEffectWind','weatherEffectLightning','weatherRainDensity','weatherRainSize','weatherRainSplash','weatherSnowDensity','weatherSnowSize','weatherSnowDrift','weatherFogDensity','weatherFogSpeed','weatherSeasonLeavesIntensity','weatherSeasonGrassIntensity','weatherSeasonPetals','weatherSeasonPetalIntensity','weatherSeasonBugs','weatherSeasonBugIntensity','weatherColdFrost','weatherColdFrostIntensity','weatherEffectRespectReducedMotion','weatherEffectPauseWhenDimmed','weatherSeasonalEffects','weatherSeasonMode','weatherSeasonalIntensity','weatherBirdHabitat',...weatherAppearanceApi.WEATHER_TUNING_KEYS,'burnInCareEnabled','burnInIdleDimmingEnabled','burnInQuietHoursEnabled','burnInQuietWakeEnabled','burnInPauseAnimationsDimmed','burnInDimMode','burnInQuietStart','burnInQuietEnd','burnInQuietWakeMin','burnInProtection','burnInPixelShift','burnInIdleMin','burnInBrightnessPct','burnInDeepProtection','burnInDeepTrigger','burnInDeepIdleMin','burnInDeepBrightnessPct','burnInShiftMode','burnInShiftMin','burnInShiftPx','burnInShiftTransitionSec'];
function preservePresetState(target,current){for(const prop of PRESET_CONTENT_PRESERVE_KEYS)target[prop]=JSON.parse(JSON.stringify(current[prop]));return target;}

function resetAppearanceForm(){
  LibreDisplayRuntime.getModule('appearance').settingsLayoutPresetKey='default';
  setAppearanceForm(APPEARANCE_DEFAULTS);
  previewAppearance();renderLayoutPresetGallery();markSettingsDirty();
}


function ensureWeatherAnimationMaster(control){const master=document.getElementById('s-weather-animations');if(control?.checked&&['s-weather-widget-animations','s-weather-fullscreen-effects'].includes(control.id)&&master&&!master.checked){master.checked=true;return true;}return false;}
function weatherAnimationControlChanged(control){ensureWeatherAnimationMaster(control);previewAppearance();}
function applyWeatherEffectPreset(name){
  const presets={subtle:{intensity:34,opacity:23,speed:88,atmosphere:32,particleScale:82,windStrength:72,lightningBrightness:48},balanced:{intensity:50,opacity:34,speed:100,atmosphere:55,particleScale:100,windStrength:100,lightningBrightness:65},immersive:{intensity:78,opacity:50,speed:112,atmosphere:78,particleScale:124,windStrength:135,lightningBrightness:82}},preset=presets[name]||presets.balanced,master=document.getElementById('s-weather-animations'),full=document.getElementById('s-weather-fullscreen-effects'),auto=document.getElementById('s-weather-effect-auto-intensity');if(master)master.checked=true;if(full)full.checked=true;if(auto)auto.checked=true;
  for(const [id,value] of Object.entries({'s-weather-effect-intensity':preset.intensity,'s-weather-effect-opacity':preset.opacity,'s-weather-effect-speed':preset.speed,'s-weather-effect-atmosphere':preset.atmosphere,'s-weather-effect-particle-scale':preset.particleScale,'s-weather-effect-wind-strength':preset.windStrength,'s-weather-effect-lightning-brightness':preset.lightningBrightness})){const el=document.getElementById(id);if(el)el.value=String(value);}const current=appearanceFromForm();updateAppearanceLabels(current);previewAppearance();markSettingsDirty();
}
function previewCurrentWeatherOverlay(){const master=document.getElementById('s-weather-animations'),full=document.getElementById('s-weather-fullscreen-effects');if(master)master.checked=true;if(full)full.checked=true;previewAppearance();markSettingsDirty();}

function resetWeatherAnimationSettings(){
  const d=APPEARANCE_DEFAULTS,checks={'s-weather-animations':d.weatherAnimationsEnabled,'s-weather-widget-animations':d.weatherWidgetAnimations,'s-weather-fullscreen-effects':d.weatherFullscreenEffects,'s-weather-effect-auto-intensity':d.weatherEffectAutoIntensity,'s-weather-effect-precipitation':d.weatherEffectPrecipitation,'s-weather-rain-enabled':d.weatherRainEnabled,'s-weather-snow-enabled':d.weatherSnowEnabled,'s-weather-effect-clouds':d.weatherEffectClouds,'s-weather-effect-fog':d.weatherEffectFog,'s-weather-effect-sun':d.weatherEffectSun,'s-weather-effect-wind':d.weatherEffectWind,'s-weather-effect-lightning':d.weatherEffectLightning,'s-weather-effect-reduced-motion':d.weatherEffectRespectReducedMotion,'s-weather-effect-pause-dimmed':d.weatherEffectPauseWhenDimmed,'s-weather-seasonal-effects':d.weatherSeasonalEffects,'s-weather-hazard-effects':d.weatherHazardEffects,'s-weather-hazard-flood':d.weatherHazardFlood,'s-weather-hazard-wind':d.weatherHazardWind,'s-weather-hazard-tornado':d.weatherHazardTornado,'s-weather-hazard-tropical':d.weatherHazardTropical,'s-weather-hazard-storm':d.weatherHazardStorm,'s-weather-hazard-winter':d.weatherHazardWinter,'s-weather-hazard-visibility':d.weatherHazardVisibility,'s-weather-hazard-heat-fire':d.weatherHazardHeatFire,'s-weather-season-leaves':d.weatherSeasonLeaves,'s-weather-season-grass':d.weatherSeasonGrass,'s-weather-season-petals':d.weatherSeasonPetals,'s-weather-season-crystals':d.weatherSeasonCrystals,'s-weather-cold-frost':d.weatherColdFrost};
  for(const [id,value] of Object.entries(checks)){const el=document.getElementById(id);if(el)el.checked=!!value;}
  const values={'s-weather-effect-mode':d.weatherEffectMode,'s-weather-effect-intensity':d.weatherEffectIntensity,'s-weather-effect-opacity':d.weatherEffectOpacity,'s-weather-effect-speed':d.weatherEffectSpeed,'s-weather-effect-atmosphere':d.weatherEffectAtmosphere,'s-weather-effect-particle-scale':d.weatherEffectParticleScale,'s-weather-effect-wind-strength':d.weatherEffectWindStrength,'s-weather-effect-lightning-frequency':d.weatherEffectLightningFrequency,'s-weather-effect-lightning-brightness':d.weatherEffectLightningBrightness,'s-weather-season-mode':d.weatherSeasonMode,'s-weather-seasonal-intensity':d.weatherSeasonalIntensity,'s-weather-hazard-intensity':d.weatherHazardIntensity,'s-weather-hazard-opacity':d.weatherHazardOpacity,'s-weather-hazard-speed':d.weatherHazardSpeed,'s-weather-hazard-min-severity':d.weatherHazardMinSeverity,'s-weather-hazard-flood-level':d.weatherHazardFloodLevel,'s-weather-hazard-flood-debris':d.weatherHazardFloodDebris,'s-weather-hazard-flood-speed':d.weatherHazardFloodSpeed,'s-weather-hazard-wind-gusts':d.weatherHazardWindGusts,'s-weather-hazard-wind-speed':d.weatherHazardWindSpeed,'s-weather-hazard-tornado-size':d.weatherHazardTornadoSize,'s-weather-hazard-tornado-opacity':d.weatherHazardTornadoOpacity,'s-weather-hazard-tropical-bands':d.weatherHazardTropicalBands,'s-weather-hazard-tropical-surge':d.weatherHazardTropicalSurge,'s-weather-hazard-storm-cloud':d.weatherHazardStormCloud,'s-weather-hazard-storm-gust':d.weatherHazardStormGust,'s-weather-hazard-winter-whiteout':d.weatherHazardWinterWhiteout,'s-weather-hazard-winter-drift':d.weatherHazardWinterDrift,'s-weather-hazard-visibility-opacity':d.weatherHazardVisibilityOpacity,'s-weather-hazard-heat-shimmer':d.weatherHazardHeatShimmer,'s-weather-rain-density':d.weatherRainDensity,'s-weather-rain-size':d.weatherRainSize,'s-weather-rain-splash':d.weatherRainSplash,'s-weather-snow-density':d.weatherSnowDensity,'s-weather-snow-size':d.weatherSnowSize,'s-weather-snow-drift':d.weatherSnowDrift,'s-weather-fog-density':d.weatherFogDensity,'s-weather-fog-speed':d.weatherFogSpeed,'s-weather-leaves-intensity':d.weatherSeasonLeavesIntensity,'s-weather-grass-intensity':d.weatherSeasonGrassIntensity,'s-weather-petal-intensity':d.weatherSeasonPetalIntensity,'s-weather-cold-frost-intensity':d.weatherColdFrostIntensity};
  for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);if(el)el.value=String(value);}weatherAppearanceApi.resetWeatherTuningForm(d);const current=appearanceFromForm();updateAppearanceLabels(current);previewAppearance();markSettingsDirty();
}
function resetDisplayCareSettings(){
  const d=APPEARANCE_DEFAULTS,checks={'s-burnin-care-enabled':d.burnInCareEnabled,'s-burnin-idle-dimming':d.burnInIdleDimmingEnabled,'s-burnin-quiet-hours':d.burnInQuietHoursEnabled,'s-burnin-quiet-wake-enabled':d.burnInQuietWakeEnabled,'s-burnin-pause-animations':d.burnInPauseAnimationsDimmed,'s-burnin-pixel-shift':d.burnInPixelShift,'s-burnin-deep-protection':d.burnInDeepProtection};
  for(const [id,value] of Object.entries(checks)){const el=document.getElementById(id);if(el)el.checked=!!value;}
  const values={'s-burnin-quiet-start':d.burnInQuietStart,'s-burnin-quiet-end':d.burnInQuietEnd,'s-burnin-quiet-wake':d.burnInQuietWakeMin,'s-burnin-idle':d.burnInIdleMin,'s-burnin-brightness':d.burnInBrightnessPct,'s-burnin-deep-trigger':d.burnInDeepTrigger,'s-burnin-deep-idle':d.burnInDeepIdleMin,'s-burnin-deep-brightness':d.burnInDeepBrightnessPct,'s-burnin-shift-mode':d.burnInShiftMode,'s-burnin-shift-interval':d.burnInShiftMin,'s-burnin-shift-distance':d.burnInShiftPx,'s-burnin-shift-transition':d.burnInShiftTransitionSec};
  for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);if(el)el.value=String(value);}const current=appearanceFromForm();updateAppearanceLabels(current);previewAppearance();markSettingsDirty();
}

function bindTextColorControls(){
  const picker=document.getElementById('s-text-color'),hex=document.getElementById('s-text-hex');
  if(!picker||!hex||picker.dataset.bound==='1')return;
  picker.dataset.bound='1';
  picker.addEventListener('input',()=>{hex.value=picker.value.toUpperCase();previewAppearance();});
  hex.addEventListener('input',()=>{
    let c=String(hex.value||'').trim();if(c&&!c.startsWith('#'))c='#'+c;
    if(/^#[0-9a-f]{3}$/i.test(c))c='#'+c.slice(1).split('').map(x=>x+x).join('');
    if(/^#[0-9a-f]{6}$/i.test(c)){picker.value=c.toLowerCase();previewAppearance();}
  });
  hex.addEventListener('blur',()=>{const c=normalizeHexColor(hex.value,picker.value);picker.value=c;hex.value=c.toUpperCase();previewAppearance();});
}

// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("appearance", {applyProductTheme,renderThemeChoices,selectThemeChoice,renderFontChoices,selectFontChoice,styleFontSelectOptions,updateFontPreview,fontCssValue,measureDashboardFontProbe,formatScreenCareMinutes,updateScreenCareControlState,screenCareClockMinutes,screenCareQuietScheduleState,noteScreenCareActivity,screenCareAvailable,screenCareCanDim,screenCareCanShift,setScreenCareShift,resetScreenCareShift,advanceScreenCareShift,updateScreenCareState,applyScreenCarePreferences,applyAccessibilityPreferences,applyUiCustomization,appearanceFromForm,updateAppearanceLabels,setAppearanceForm,preservePresetState,resetAppearanceForm,ensureWeatherAnimationMaster,weatherAnimationControlChanged,applyWeatherEffectPreset,previewCurrentWeatherOverlay,resetWeatherAnimationSettings,resetDisplayCareSettings,bindTextColorControls}, {
  "LIBREDISPLAY_THEMES": {configurable:true,get:()=>LIBREDISPLAY_THEMES},
  "LIBREDISPLAY_FONTS": {configurable:true,get:()=>LIBREDISPLAY_FONTS},
  "screenCareTimer": {configurable:true,get:()=>screenCareTimer,set:(value)=>{screenCareTimer=value;}},
  "screenCareLastActivity": {configurable:true,get:()=>screenCareLastActivity,set:(value)=>{screenCareLastActivity=value;}},
  "screenCareDimmed": {configurable:true,get:()=>screenCareDimmed,set:(value)=>{screenCareDimmed=value;}},
  "APPEARANCE_DEFAULTS": {configurable:true,get:()=>APPEARANCE_DEFAULTS},
  "PRESET_CONTENT_PRESERVE_KEYS": {configurable:true,get:()=>PRESET_CONTENT_PRESERVE_KEYS}
}, {globalFunctions:['applyProductTheme','selectThemeChoice','selectFontChoice','updateFontPreview','fontCssValue','measureDashboardFontProbe','applyUiCustomization','appearanceFromForm','updateAppearanceLabels','setAppearanceForm','preservePresetState','resetAppearanceForm','ensureWeatherAnimationMaster','weatherAnimationControlChanged','applyWeatherEffectPreset','previewCurrentWeatherOverlay','resetWeatherAnimationSettings','resetDisplayCareSettings','bindTextColorControls'],globalStates:[]});
}
// End source section: /js/appearance/index.js

// LibreDisplay source section: /js/appearance/presets.js
{
// Layout preset gallery and live preset preview pipeline.
const configApi=LibreDisplayRuntime.getModule('config');
const {integrationManifest}=LibreDisplayRuntime.getModule('integrations');
const {renderCalendar}=LibreDisplayRuntime.getModule('calendar');
const {renderWeather}=LibreDisplayRuntime.getModule('weather');
const {escHtml}=LibreDisplayRuntime.getModule('shared');


const LAYOUT_PRESET_ORDER=['current','photocalendar','glassboard','portraitwall','weekcolumns','photostory','mirrorminimal','family','split','gallery','calendar','agenda','weather','morning','smarthub','familyops','office','insights','travel','large','compact','minimal','portrait','portraitphoto','default'];
const LAYOUT_PRESET_LABELS={calendar:'CAL',current:'WX',clock:'TIME',details:'INFO',daily:'DAYS',hourly:'HOURS',alerts:'ALERT'};
const BALANCED_LAYOUT_THUMBNAIL={
  calendar:{x:.02,y:.03,w:.96,h:.18},alerts:{x:.22,y:.28,w:.56,h:.22},current:{x:.03,y:.68,w:.15,h:.22},clock:{x:.20,y:.67,w:.23,h:.20},details:{x:.03,y:.91,w:.40,h:.07},daily:{x:.47,y:.68,w:.50,h:.12},hourly:{x:.47,y:.83,w:.50,h:.12}
};
const LAYOUT_PRESETS={
  photocalendar:{name:'Photo Calendar Split',category:'Signature',bestFor:'Landscape · month + photography',featured:true,
    description:'A true split-screen wall calendar: photography owns the left side while a high-contrast month grid fills the right, with time and weather treated as quiet overlays instead of competing cards.',
    mode:'custom',surface:'photo',photoZone:{x:.012,y:.012,w:.382,h:.976},
    presentation:{bgShadeTop:18,bgShadeBottom:34,showDailyForecast:false,showHourlyForecast:false},
    view:{calendarDays:30,calendarColumns:7,calendarMaxEvents:2,calendarCellHeight:132,dailyForecastDays:5,hourlyForecastHours:6},
    contentScale:{calendar:102,current:118,clock:142,details:90,daily:86,hourly:86,alerts:82},
    partStyle:{calendar:{dayLabel:{scale:94,fontWeight:400},eventTime:{scale:82}},clock:{seconds:{scale:70}},current:{condition:{scale:88}}},
    elementStyle:{clock:{hAlign:'right',vAlign:'top'},current:{hAlign:'right',vAlign:'bottom'},details:{hAlign:'right',vAlign:'bottom'},calendar:{hAlign:'left',vAlign:'top'},alerts:{hAlign:'center',vAlign:'middle'}},
    blocks:{clock:{x:.045,y:.050,w:.30,h:.14},current:{x:.205,y:.700,w:.14,h:.15},details:{x:.045,y:.855,w:.30,h:.065},calendar:{x:.425,y:.045,w:.535,h:.89},alerts:{x:.545,y:.945,w:.295,h:.035}}
  },
  glassboard:{name:'Glass Home Board',category:'Signature',bestFor:'Landscape · home overview',featured:true,
    description:'A composed home dashboard with an airy clock hero, distinct information zones, and soft glass surfaces over photography. It feels intentional even before optional integrations are added.',
    mode:'custom',surface:'glass',
    presentation:{bgShadeTop:24,bgShadeBottom:42,showDailyForecast:true,showHourlyForecast:false},
    view:{calendarDays:3,calendarColumns:1,calendarMaxEvents:4,calendarCellHeight:112,dailyForecastDays:5,hourlyForecastHours:6},
    contentScale:{calendar:96,current:116,clock:146,details:88,daily:96,hourly:86,alerts:82},
    partStyle:{clock:{seconds:{scale:68}},calendar:{dayLabel:{scale:90},eventTime:{scale:84}},current:{condition:{scale:90}}},
    elementStyle:{clock:{hAlign:'center',vAlign:'middle'},current:{hAlign:'left',vAlign:'middle'},details:{hAlign:'left',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'}},
    blocks:{clock:{x:.33,y:.045,w:.34,h:.14},current:{x:.045,y:.245,w:.265,h:.16},details:{x:.045,y:.425,w:.265,h:.075},calendar:{x:.69,y:.245,w:.265,h:.30},daily:{x:.69,y:.835,w:.265,h:.085},alerts:{x:.38,y:.905,w:.24,h:.035}},
    showcaseSlots:[
      {id:'home',label:'Home',icon:'⌂',value:'Living room · 72°',sub:'Comfortable · lights on',hint:'Connected home',plugins:['home-assistant'],variant:'home',rect:{x:.045,y:.55,w:.27,h:.23}},
      {id:'today',label:'Today',icon:'✓',value:'3 priorities',sub:'Groceries · pickup · call Mom',hint:'Tasks',kinds:['tasks'],types:['todo'],variant:'tasks',rect:{x:.345,y:.245,w:.31,h:.27}},
      {id:'news',label:'Briefing',icon:'≋',value:'Your morning brief',sub:'Three stories worth knowing today',hint:'News / feeds',types:['rss'],variant:'news',rect:{x:.345,y:.55,w:.31,h:.23}},
      {id:'traffic',label:'Commute',icon:'↗',value:'20 min',sub:'Normal traffic · 10.7 mi',hint:'Travel',plugins:['mapbox-travel','gtfs-realtime'],variant:'traffic',rect:{x:.685,y:.59,w:.27,h:.17}}
    ]
  },
  portraitwall:{name:'Portrait Calendar Canvas',category:'Signature',bestFor:'Portrait · daily life',featured:true,
    description:'A photo-led portrait board with a confident clock, a readable agenda card, compact current weather, and a forecast footer that feels designed for a vertical display.',
    mode:'custom',surface:'photo',photoZone:{x:.018,y:.012,w:.964,h:.976},
    presentation:{bgShadeTop:30,bgShadeBottom:68,showDailyForecast:true,showHourlyForecast:false},
    view:{calendarDays:5,calendarColumns:1,calendarMaxEvents:5,calendarCellHeight:118,dailyForecastDays:5,hourlyForecastHours:6},
    contentScale:{calendar:104,current:114,clock:148,details:88,daily:92,hourly:86,alerts:82},
    partStyle:{calendar:{dayLabel:{scale:90},eventTime:{scale:84}},clock:{seconds:{scale:68}},current:{condition:{scale:88}}},
    elementStyle:{clock:{hAlign:'center',vAlign:'top'},calendar:{hAlign:'left',vAlign:'top'},current:{hAlign:'left',vAlign:'middle'},details:{hAlign:'right',vAlign:'middle'},daily:{hAlign:'center',vAlign:'middle'}},
    blocks:{clock:{x:.16,y:.055,w:.68,h:.12},current:{x:.10,y:.255,w:.30,h:.12},details:{x:.60,y:.255,w:.30,h:.12},calendar:{x:.10,y:.43,w:.80,h:.32},daily:{x:.10,y:.82,w:.80,h:.09},alerts:{x:.28,y:.775,w:.44,h:.035}}
  },
  weekcolumns:{name:'Week Columns',category:'Signature',bestFor:'Landscape · weekly planner',featured:true,
    description:'A disciplined five-day planner with oversized dates, thin event rails, restrained chrome, and just enough time/weather context to keep the schedule dominant.',
    mode:'custom',surface:'minimal',
    presentation:{bgShadeTop:92,bgShadeBottom:92,showDailyForecast:false,showHourlyForecast:false},
    view:{calendarDays:5,calendarColumns:5,calendarMaxEvents:8,calendarCellHeight:420,dailyForecastDays:5,hourlyForecastHours:6},
    contentScale:{calendar:118,current:94,clock:100,details:82,daily:84,hourly:84,alerts:80},
    partStyle:{calendar:{dayLabel:{scale:104,fontWeight:400},eventTime:{scale:90}},clock:{seconds:{scale:65}}},
    elementStyle:{calendar:{hAlign:'left',vAlign:'top'},clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'right',vAlign:'middle'},details:{hAlign:'left',vAlign:'middle'}},
    blocks:{clock:{x:.025,y:.025,w:.22,h:.055},current:{x:.755,y:.025,w:.22,h:.055},calendar:{x:.025,y:.125,w:.95,h:.72},details:{x:.025,y:.89,w:.25,h:.045},alerts:{x:.385,y:.89,w:.23,h:.04}}
  },
  photostory:{name:'Photo Story Board',category:'Signature',bestFor:'Landscape · photo + editorial',featured:true,
    description:'A cinematic photo canvas with the center left intentionally open. Time, a short agenda, one editorial story, weather, and forecast sit around the edges like a finished information poster.',
    mode:'custom',surface:'photo',photoZone:{x:.01,y:.01,w:.98,h:.98},
    presentation:{bgShadeTop:30,bgShadeBottom:64,showDailyForecast:true,showHourlyForecast:false},
    view:{calendarDays:3,calendarColumns:3,calendarMaxEvents:2,calendarCellHeight:118,dailyForecastDays:5,hourlyForecastHours:6},
    contentScale:{calendar:92,current:116,clock:142,details:88,daily:96,hourly:86,alerts:82},
    partStyle:{calendar:{dayLabel:{scale:88},eventTime:{scale:82}},clock:{seconds:{scale:68}},current:{condition:{scale:88}}},
    elementStyle:{clock:{hAlign:'left',vAlign:'top'},calendar:{hAlign:'right',vAlign:'top'},current:{hAlign:'left',vAlign:'bottom'},details:{hAlign:'left',vAlign:'bottom'},daily:{hAlign:'right',vAlign:'bottom'}},
    blocks:{clock:{x:.045,y:.045,w:.28,h:.125},calendar:{x:.635,y:.055,w:.32,h:.19},current:{x:.045,y:.775,w:.18,h:.13},details:{x:.245,y:.825,w:.17,h:.065},daily:{x:.615,y:.815,w:.34,h:.095},alerts:{x:.39,y:.715,w:.22,h:.04}},
    showcaseSlots:[{id:'story',label:'Featured',icon:'“',value:'Olympics add five new sports for 2028',sub:'A single story, quote, photo caption, or daily message can become the visual anchor.',hint:'Your content',types:['rss','text','json'],plugins:['web-api'],variant:'story',rect:{x:.20,y:.47,w:.60,h:.16}}]
  },
  mirrorminimal:{name:'Minimal Mirror',category:'Signature',bestFor:'Dark canvas · essentials',featured:true,
    description:'Typography-first and deliberately quiet: large time and date, a simple agenda, current conditions, and a subtle forecast rail with the center left almost completely untouched.',
    mode:'custom',surface:'minimal',
    presentation:{bgShadeTop:94,bgShadeBottom:94,showDailyForecast:true,showHourlyForecast:false},
    view:{calendarDays:4,calendarColumns:1,calendarMaxEvents:4,calendarCellHeight:120,dailyForecastDays:5,hourlyForecastHours:6},
    contentScale:{calendar:98,current:108,clock:150,details:86,daily:88,hourly:84,alerts:78},
    partStyle:{calendar:{dayLabel:{scale:88},eventTime:{scale:84}},clock:{seconds:{scale:62}},current:{condition:{scale:86}}},
    elementStyle:{clock:{hAlign:'left',vAlign:'top'},calendar:{hAlign:'left',vAlign:'top'},current:{hAlign:'right',vAlign:'top'},details:{hAlign:'right',vAlign:'top'},daily:{hAlign:'right',vAlign:'bottom'}},
    blocks:{clock:{x:.055,y:.055,w:.31,h:.135},calendar:{x:.055,y:.255,w:.285,h:.27},current:{x:.735,y:.06,w:.21,h:.125},details:{x:.755,y:.205,w:.19,h:.065},daily:{x:.655,y:.835,w:.29,h:.08},alerts:{x:.39,y:.91,w:.22,h:.03}},
    showcaseSlots:[{id:'bottom',label:'Daily note',icon:'—',value:'Make today count.',sub:'One calm message or reminder',hint:'Text / feed',types:['rss','text'],variant:'note',rect:{x:.34,y:.86,w:.28,h:.055}}]
  },
  family:{name:'Family Command Center',category:'Family',bestFor:'Landscape · busy households',featured:true,description:'A structured family dashboard with a generous week planner, a calm time/weather rail, and balanced forecasts along the footer.',mode:'custom',view:{calendarDays:7,calendarColumns:4,calendarMaxEvents:3,calendarCellHeight:160,dailyForecastDays:7,hourlyForecastHours:9},contentScale:{calendar:112,current:110,clock:112,details:100,daily:104,hourly:104,alerts:96},partStyle:{calendar:{dayLabel:{scale:94},eventTime:{scale:94}},current:{condition:{scale:96}},clock:{seconds:{scale:90}}},elementStyle:{calendar:{hAlign:'left',vAlign:'top'},clock:{hAlign:'right',vAlign:'middle'},current:{hAlign:'right',vAlign:'middle'},details:{hAlign:'right',vAlign:'middle'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{calendar:{x:.035,y:.055,w:.615,h:.39},clock:{x:.69,y:.055,w:.275,h:.19},current:{x:.69,y:.265,w:.275,h:.27},details:{x:.69,y:.565,w:.275,h:.12},alerts:{x:.12,y:.50,w:.50,h:.10},daily:{x:.035,y:.735,w:.445,h:.16},hourly:{x:.52,y:.735,w:.445,h:.16}}},
  split:{name:'Photo + Planner',category:'Photo',bestFor:'Landscape · photo + calendar',featured:true,description:'A refined split screen with a quiet photo field on the left, a strong planner column on the right, and matching forecast rows below.',mode:'custom',photoZone:{x:.035,y:.235,w:.305,h:.35},view:{calendarDays:7,calendarColumns:4,calendarMaxEvents:3,calendarCellHeight:180,dailyForecastDays:7,hourlyForecastHours:9},contentScale:{calendar:100,current:112,clock:116,details:100,daily:100,hourly:100,alerts:94},partStyle:{calendar:{dayLabel:{scale:92},eventTime:{scale:92}},clock:{seconds:{scale:90}},current:{condition:{scale:96}}},elementStyle:{clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'left',vAlign:'middle'},details:{hAlign:'left',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{clock:{x:.035,y:.05,w:.305,h:.18},current:{x:.035,y:.60,w:.305,h:.25},details:{x:.035,y:.87,w:.305,h:.095},calendar:{x:.395,y:.05,w:.57,h:.46},alerts:{x:.45,y:.525,w:.46,h:.09},daily:{x:.395,y:.64,w:.57,h:.13},hourly:{x:.395,y:.81,w:.57,h:.13}}},
  gallery:{name:'Gallery Week',category:'Photo',bestFor:'Widescreen · photo first',featured:true,description:'A photo-first composition with balanced corner anchors, a clean week band, and evenly weighted forecast rows.',mode:'custom',photoZone:{x:.305,y:.09,w:.39,h:.37},view:{calendarDays:7,calendarColumns:7,calendarMaxEvents:3,calendarCellHeight:170,dailyForecastDays:7,hourlyForecastHours:9},contentScale:{calendar:100,current:110,clock:118,details:96,daily:102,hourly:102,alerts:92},partStyle:{calendar:{dayLabel:{scale:94},eventTime:{scale:92}},clock:{seconds:{scale:88}},current:{condition:{scale:94}}},elementStyle:{clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'right',vAlign:'middle'},details:{hAlign:'right',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{clock:{x:.035,y:.05,w:.265,h:.18},current:{x:.73,y:.05,w:.235,h:.245},details:{x:.70,y:.315,w:.265,h:.105},alerts:{x:.31,y:.47,w:.38,h:.09},calendar:{x:.035,y:.565,w:.93,h:.22},daily:{x:.035,y:.815,w:.445,h:.13},hourly:{x:.52,y:.815,w:.445,h:.13}}},
  calendar:{name:'Calendar Wall',category:'Calendar',bestFor:'Wall display · week at a glance',featured:true,description:'A true calendar-first wall view with a larger week canvas and a disciplined lower information shelf instead of scattered blocks.',mode:'custom',view:{calendarDays:7,calendarColumns:7,calendarMaxEvents:4,calendarCellHeight:240,dailyForecastDays:7,hourlyForecastHours:9},contentScale:{calendar:120,current:112,clock:118,details:100,daily:104,hourly:104,alerts:98},partStyle:{calendar:{dayLabel:{scale:94},eventTime:{scale:96}},clock:{seconds:{scale:90}},current:{condition:{scale:96}}},elementStyle:{calendar:{hAlign:'left',vAlign:'top'},clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'left',vAlign:'middle'},details:{hAlign:'left',vAlign:'middle'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{calendar:{x:.035,y:.045,w:.93,h:.44},alerts:{x:.25,y:.505,w:.50,h:.09},clock:{x:.035,y:.635,w:.215,h:.185},current:{x:.275,y:.625,w:.215,h:.225},details:{x:.035,y:.855,w:.455,h:.105},daily:{x:.525,y:.625,w:.44,h:.14},hourly:{x:.525,y:.805,w:.44,h:.14}}},
  agenda:{name:'Planner + Weather Rail',category:'Planner',bestFor:'Landscape · event-heavy homes',description:'A planner-led composition with a broad readable schedule, a deliberately spaced weather rail, and forecasts spanning the footer.',mode:'custom',view:{calendarDays:6,calendarColumns:3,calendarMaxEvents:4,calendarCellHeight:200,dailyForecastDays:7,hourlyForecastHours:9},contentScale:{calendar:110,current:108,clock:112,details:98,daily:102,hourly:102,alerts:94},partStyle:{calendar:{dayLabel:{scale:94},eventTime:{scale:96}},clock:{seconds:{scale:90}},current:{condition:{scale:96}}},elementStyle:{calendar:{hAlign:'left',vAlign:'top'},clock:{hAlign:'right',vAlign:'middle'},current:{hAlign:'right',vAlign:'middle'},details:{hAlign:'right',vAlign:'middle'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{calendar:{x:.035,y:.05,w:.625,h:.51},clock:{x:.70,y:.05,w:.265,h:.18},current:{x:.70,y:.255,w:.265,h:.27},details:{x:.70,y:.555,w:.265,h:.125},alerts:{x:.12,y:.59,w:.49,h:.09},daily:{x:.035,y:.755,w:.445,h:.15},hourly:{x:.52,y:.755,w:.445,h:.15}}},
  weather:{name:'Weather Center',category:'Weather',bestFor:'Forecast-heavy displays',description:'A weather-led dashboard with a larger current-conditions column, paired forecast bands, and a secondary planner that still reads cleanly.',mode:'custom',view:{calendarDays:5,calendarColumns:5,calendarMaxEvents:2,calendarCellHeight:180,dailyForecastDays:7,hourlyForecastHours:9},contentScale:{calendar:98,current:126,clock:116,details:108,daily:110,hourly:110,alerts:96},partStyle:{calendar:{dayLabel:{scale:94},eventTime:{scale:92}},clock:{seconds:{scale:88}},current:{condition:{scale:100}}},elementStyle:{current:{hAlign:'left',vAlign:'middle'},clock:{hAlign:'left',vAlign:'middle'},details:{hAlign:'left',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{current:{x:.035,y:.07,w:.285,h:.32},clock:{x:.035,y:.425,w:.285,h:.18},details:{x:.035,y:.635,w:.285,h:.14},daily:{x:.365,y:.065,w:.60,h:.18},hourly:{x:.365,y:.285,w:.60,h:.18},calendar:{x:.365,y:.525,w:.60,h:.27},alerts:{x:.25,y:.835,w:.50,h:.09}}},
  morning:{name:'Morning Briefing',category:'Showcase',bestFor:'Kitchen · before-work glance',featured:true,description:'A crisp morning command center that pairs the day’s schedule and weather with dedicated commute and task slots.',mode:'custom',view:{calendarDays:5,calendarColumns:5,calendarMaxEvents:2,calendarCellHeight:130,dailyForecastDays:5,hourlyForecastHours:6},contentScale:{calendar:104,current:112,clock:118,details:96,daily:98,hourly:98,alerts:92},partStyle:{calendar:{dayLabel:{scale:94},eventTime:{scale:94}},clock:{seconds:{scale:88}},current:{condition:{scale:96}}},elementStyle:{clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'left',vAlign:'middle'},details:{hAlign:'left',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{clock:{x:.035,y:.05,w:.24,h:.17},current:{x:.035,y:.25,w:.24,h:.25},details:{x:.035,y:.53,w:.24,h:.12},daily:{x:.035,y:.69,w:.24,h:.20},calendar:{x:.31,y:.05,w:.655,h:.31},alerts:{x:.39,y:.39,w:.49,h:.07},hourly:{x:.31,y:.49,w:.655,h:.13}},showcaseSlots:[{id:'commute',label:'Commute',icon:'↗',value:'23 min',sub:'Traffic-aware route or next transit arrivals',hint:'Mapbox Travel · GTFS-Realtime',plugins:['mapbox-travel','gtfs-realtime'],rect:{x:.31,y:.66,w:.31,h:.28}},{id:'tasks',label:'Today',icon:'✓',value:'3 things left',sub:'Tasks, errands, or morning routines',hint:'Todoist · Google Tasks · Microsoft To Do',kinds:['tasks'],types:['todo'],rect:{x:.655,y:.66,w:.31,h:.28}}]},
  smarthub:{name:'Smart Home Hub',category:'Showcase',bestFor:'Living room · connected home',featured:true,description:'A connected-home canvas with weather and schedule anchors plus generous slots for smart-home state, music, tasks, messages, and a map.',mode:'custom',view:{calendarDays:2,calendarColumns:1,calendarMaxEvents:2,calendarCellHeight:92,dailyForecastDays:3,hourlyForecastHours:4,showHourlyForecast:false},contentScale:{calendar:94,current:108,clock:116,details:92,daily:90,hourly:90,alerts:90},partStyle:{calendar:{dayLabel:{scale:90},eventTime:{scale:90}},clock:{seconds:{scale:88}},current:{condition:{scale:94}}},elementStyle:{clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'left',vAlign:'middle'},details:{hAlign:'left',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{clock:{x:.035,y:.05,w:.25,h:.15},current:{x:.035,y:.22,w:.25,h:.21},details:{x:.035,y:.45,w:.25,h:.10},daily:{x:.035,y:.58,w:.25,h:.13},calendar:{x:.035,y:.74,w:.25,h:.19},hourly:{x:.035,y:.95,w:.25,h:.025},alerts:{x:.33,y:.90,w:.635,h:.075}},showcaseSlots:[{id:'home',label:'Home',icon:'⌂',value:'Living room · 72°',sub:'Surface a favorite Home Assistant entity at a glance',hint:'Home Assistant',plugins:['home-assistant'],rect:{x:.33,y:.05,w:.30,h:.25}},{id:'media',label:'Now Playing',icon:'♪',value:'Kitchen speaker',sub:'Album art and current track from your music system',hint:'Spotify · Sonos',kinds:['now-playing'],rect:{x:.665,y:.05,w:.30,h:.25}},{id:'tasks',label:'Household',icon:'✓',value:'4 open items',sub:'Shared tasks or a local family checklist',hint:'Tasks · Family Chores',kinds:['tasks'],types:['todo','family'],rect:{x:.33,y:.34,w:.30,h:.26}},{id:'messages',label:'Updates',icon:'#',value:'3 new messages',sub:'Recent household or team messages',hint:'Slack · RSS',kinds:['messages'],types:['rss'],rect:{x:.665,y:.34,w:.30,h:.26}},{id:'map',label:'Around Home',icon:'⌖',value:'Neighborhood',sub:'Map, school route, or a frequently checked location',hint:'OpenStreetMap',kinds:['map'],rect:{x:.33,y:.64,w:.635,h:.22}}]},
  familyops:{name:'Family Operations',category:'Showcase',bestFor:'Busy family · shared routines',featured:true,description:'A family-focused board with a strong shared calendar plus chore, task, delivery, and commute slots for the information that drives the day.',mode:'custom',view:{calendarDays:7,calendarColumns:4,calendarMaxEvents:3,calendarCellHeight:150,dailyForecastDays:5,hourlyForecastHours:6,showDailyForecast:false,showHourlyForecast:false},contentScale:{calendar:108,current:108,clock:114,details:94,daily:92,hourly:92,alerts:92},partStyle:{calendar:{dayLabel:{scale:94},eventTime:{scale:94}},clock:{seconds:{scale:88}},current:{condition:{scale:94}}},elementStyle:{calendar:{hAlign:'left',vAlign:'top'},clock:{hAlign:'right',vAlign:'middle'},current:{hAlign:'right',vAlign:'middle'},details:{hAlign:'right',vAlign:'middle'}},blocks:{calendar:{x:.035,y:.05,w:.60,h:.40},clock:{x:.675,y:.05,w:.29,h:.17},current:{x:.675,y:.25,w:.29,h:.23},details:{x:.675,y:.50,w:.29,h:.09},alerts:{x:.675,y:.60,w:.29,h:.08},daily:{x:.675,y:.70,w:.29,h:.08},hourly:{x:.675,y:.80,w:.29,h:.08}},showcaseSlots:[{id:'chores',label:'Chores',icon:'★',value:'12 points today',sub:'Household chores, rewards, and touch completion',hint:'LibreDisplay Family Chores',types:['family'],rect:{x:.035,y:.50,w:.285,h:.43}},{id:'tasks',label:'Shared Tasks',icon:'✓',value:'5 left this week',sub:'A family task list from the service you already use',hint:'Todoist · Google Tasks · Microsoft To Do',kinds:['tasks'],types:['todo'],rect:{x:.35,y:.50,w:.285,h:.43}},{id:'delivery',label:'Deliveries',icon:'▰',value:'2 arriving today',sub:'Package status without opening another app',hint:'AfterShip',plugins:['aftership'],rect:{x:.675,y:.70,w:.29,h:.10}},{id:'commute',label:'Next Trip',icon:'↗',value:'18 min',sub:'Traffic-aware travel time or transit arrivals',hint:'Mapbox · GTFS-Realtime',plugins:['mapbox-travel','gtfs-realtime'],rect:{x:.675,y:.83,w:.29,h:.10}}]},
  office:{name:'Team Board',category:'Showcase',bestFor:'Office · studio · team space',description:'An office-ready information board that combines the shared schedule with messages, work queues, news, and a metric card.',mode:'custom',view:{calendarDays:5,calendarColumns:2,calendarMaxEvents:4,calendarCellHeight:150,dailyForecastDays:3,hourlyForecastHours:3},contentScale:{calendar:102,current:102,clock:110,details:90,daily:88,hourly:88,alerts:88},partStyle:{calendar:{dayLabel:{scale:94},eventTime:{scale:94}},clock:{seconds:{scale:86}},current:{condition:{scale:92}}},elementStyle:{clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'left',vAlign:'middle'},details:{hAlign:'left',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{clock:{x:.035,y:.05,w:.22,h:.15},current:{x:.035,y:.22,w:.22,h:.20},details:{x:.035,y:.44,w:.22,h:.11},daily:{x:.275,y:.05,w:.18,h:.15},hourly:{x:.275,y:.22,w:.18,h:.15},alerts:{x:.275,y:.44,w:.18,h:.11},calendar:{x:.035,y:.60,w:.42,h:.33}},showcaseSlots:[{id:'messages',label:'Team Updates',icon:'#',value:'3 recent messages',sub:'A compact communication stream for the room',hint:'Slack Messages',kinds:['messages'],rect:{x:.49,y:.05,w:.475,h:.35}},{id:'work',label:'Work Queue',icon:'✓',value:'7 active items',sub:'Project tasks and cards that need attention',hint:'Asana · Trello · Todoist',kinds:['tasks'],rect:{x:.49,y:.44,w:.23,h:.49}},{id:'news',label:'News',icon:'≋',value:'Latest headlines',sub:'Company news, industry updates, or an internal feed',hint:'RSS / Atom',types:['rss'],rect:{x:.735,y:.44,w:.23,h:.23}},{id:'metric',label:'Metric',icon:'↗',value:'98.4%',sub:'A KPI, API value, chart, or system status',hint:'Web API · JSON / Data',plugins:['web-api'],types:['json'],rect:{x:.735,y:.70,w:.23,h:.23}}]},
  insights:{name:'Markets & Conditions',category:'Showcase',bestFor:'Data wall · personal dashboard',description:'A compact data wall for market snapshots, environmental conditions, a chart, and headlines without losing time, weather, or schedule context.',mode:'custom',view:{calendarDays:4,calendarColumns:1,calendarMaxEvents:2,calendarCellHeight:105,dailyForecastDays:4,hourlyForecastHours:4},contentScale:{calendar:94,current:104,clock:110,details:90,daily:92,hourly:92,alerts:88},partStyle:{calendar:{dayLabel:{scale:92},eventTime:{scale:90}},clock:{seconds:{scale:86}},current:{condition:{scale:92}}},elementStyle:{clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'left',vAlign:'middle'},details:{hAlign:'left',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{clock:{x:.035,y:.05,w:.22,h:.15},current:{x:.035,y:.22,w:.22,h:.22},details:{x:.035,y:.46,w:.22,h:.10},calendar:{x:.035,y:.60,w:.22,h:.33},daily:{x:.30,y:.66,w:.315,h:.13},hourly:{x:.65,y:.66,w:.315,h:.13},alerts:{x:.30,y:.83,w:.665,h:.09}},showcaseSlots:[{id:'stock',label:'Market',icon:'$',value:'+0.6% today',sub:'A favorite stock quote and daily change',hint:'Alpha Vantage',plugins:['alpha-vantage'],rect:{x:.30,y:.05,w:.20,h:.19}},{id:'crypto',label:'Crypto',icon:'₿',value:'24h +1.8%',sub:'A crypto price snapshot in your preferred currency',hint:'CoinGecko',plugins:['coingecko'],rect:{x:.52,y:.05,w:.20,h:.19}},{id:'conditions',label:'Conditions',icon:'☀',value:'UV 4 · Moderate',sub:'UV, pollen, air quality, tides, or a personal weather station',hint:'Open-Meteo · Google Pollen · NOAA',plugins:['open-meteo-uv','google-pollen','noaa-tides','weather-company-pws','fitbit'],types:['airquality'],rect:{x:.74,y:.05,w:.225,h:.19}},{id:'chart',label:'Trend',icon:'⌁',value:'Live data',sub:'Turn an API response into a chart, gauge, progress bar, or table',hint:'JSON / Data · Web API',plugins:['web-api'],types:['json'],rect:{x:.30,y:.29,w:.435,h:.32}},{id:'news',label:'Headlines',icon:'≋',value:'What’s happening',sub:'A narrow news rail for the latest items',hint:'RSS / Atom',types:['rss'],rect:{x:.76,y:.29,w:.205,h:.32}}]},
  travel:{name:'Travel Day',category:'Showcase',bestFor:'Trips · pickups · commute',description:'A travel-focused screen with flight, route, and map slots surrounded by compact weather and schedule context for the day ahead.',mode:'custom',view:{calendarDays:4,calendarColumns:1,calendarMaxEvents:3,calendarCellHeight:110,dailyForecastDays:5,hourlyForecastHours:6},contentScale:{calendar:96,current:106,clock:112,details:92,daily:94,hourly:94,alerts:90},partStyle:{calendar:{dayLabel:{scale:92},eventTime:{scale:92}},clock:{seconds:{scale:88}},current:{condition:{scale:94}}},elementStyle:{clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'left',vAlign:'middle'},details:{hAlign:'left',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{clock:{x:.035,y:.05,w:.23,h:.15},current:{x:.035,y:.23,w:.23,h:.21},details:{x:.035,y:.46,w:.23,h:.10},calendar:{x:.035,y:.60,w:.23,h:.33},daily:{x:.30,y:.05,w:.315,h:.13},hourly:{x:.65,y:.05,w:.315,h:.13},alerts:{x:.35,y:.205,w:.565,h:.08}},showcaseSlots:[{id:'flight',label:'Flight',icon:'✈',value:'On time',sub:'Status, schedule, and reported delay for a flight',hint:'aviationstack',plugins:['aviationstack'],rect:{x:.30,y:.32,w:.315,h:.17}},{id:'commute',label:'Travel Time',icon:'↗',value:'26 min',sub:'Traffic-aware drive time or next transit arrivals',hint:'Mapbox · GTFS-Realtime',plugins:['mapbox-travel','gtfs-realtime'],rect:{x:.65,y:.32,w:.315,h:.17}},{id:'map',label:'Route Area',icon:'⌖',value:'Destination',sub:'Keep a frequently checked destination visible on the wall',hint:'OpenStreetMap',kinds:['map'],rect:{x:.30,y:.53,w:.665,h:.40}}]},
  large:{name:'Across the Room',category:'Readable',bestFor:'TV · longer viewing distance',description:'A distance-readable layout with fewer, larger calendar and forecast columns so the screen stays legible instead of merely scaled up.',mode:'custom',view:{calendarDays:5,calendarColumns:5,calendarMaxEvents:2,calendarCellHeight:190,dailyForecastDays:5,hourlyForecastHours:6},contentScale:{calendar:132,current:136,clock:138,details:116,daily:114,hourly:114,alerts:106},partStyle:{calendar:{dayLabel:{scale:96},eventTime:{scale:100}},clock:{seconds:{scale:88}},current:{condition:{scale:102}}},elementStyle:{clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'right',vAlign:'middle'},details:{hAlign:'left',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{calendar:{x:.035,y:.045,w:.93,h:.27},alerts:{x:.25,y:.335,w:.50,h:.06},clock:{x:.035,y:.41,w:.36,h:.22},current:{x:.605,y:.405,w:.36,h:.245},details:{x:.035,y:.68,w:.36,h:.11},daily:{x:.44,y:.68,w:.525,h:.115},hourly:{x:.44,y:.825,w:.525,h:.115}}},
  compact:{name:'Countertop Grid',category:'Compact',bestFor:'Tablet · 16:10 · small monitor',description:'A compact two-column grid with tuned content density, stronger alignment, and useful breathing room for custom blocks below.',mode:'custom',view:{calendarDays:5,calendarColumns:5,calendarMaxEvents:2,calendarCellHeight:165,dailyForecastDays:5,hourlyForecastHours:6},contentScale:{calendar:96,current:102,clock:104,details:92,daily:94,hourly:94,alerts:90},partStyle:{calendar:{dayLabel:{scale:92},eventTime:{scale:92}},clock:{seconds:{scale:88}},current:{condition:{scale:94}}},elementStyle:{calendar:{hAlign:'left',vAlign:'top'},clock:{hAlign:'right',vAlign:'middle'},current:{hAlign:'right',vAlign:'middle'},details:{hAlign:'right',vAlign:'middle'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{calendar:{x:.035,y:.045,w:.585,h:.30},clock:{x:.67,y:.045,w:.295,h:.16},current:{x:.67,y:.235,w:.295,h:.245},details:{x:.67,y:.505,w:.295,h:.12},daily:{x:.035,y:.405,w:.585,h:.13},hourly:{x:.035,y:.565,w:.585,h:.13},alerts:{x:.13,y:.73,w:.49,h:.085}}},
  minimal:{name:'Minimal Photo',category:'Minimal',bestFor:'Photo frame · calm spaces',featured:true,description:'A calmer photo-frame layout with stronger corner anchors and a restrained five-day footer that leaves the center truly open.',mode:'custom',photoZone:{x:.245,y:.20,w:.51,h:.44},view:{calendarDays:5,calendarColumns:5,calendarMaxEvents:1,calendarCellHeight:115,dailyForecastDays:5,hourlyForecastHours:6},contentScale:{calendar:92,current:112,clock:126,details:92,daily:92,hourly:92,alerts:88},partStyle:{calendar:{dayLabel:{scale:90},eventTime:{scale:90}},clock:{seconds:{scale:86}},current:{condition:{scale:94}}},elementStyle:{clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'right',vAlign:'middle'},details:{hAlign:'right',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{clock:{x:.035,y:.05,w:.30,h:.18},current:{x:.735,y:.05,w:.23,h:.245},details:{x:.70,y:.315,w:.265,h:.105},alerts:{x:.35,y:.655,w:.30,h:.075},calendar:{x:.035,y:.745,w:.565,h:.18},daily:{x:.645,y:.74,w:.32,h:.095},hourly:{x:.645,y:.85,w:.32,h:.105}}},
  portrait:{name:'Portrait Planner',category:'Portrait',bestFor:'Vertical wall display · tablet',description:'A genuinely vertical planner: time and weather form a compact header, the schedule wraps into readable rows, and forecasts anchor the lower screen.',mode:'custom',view:{calendarDays:6,calendarColumns:2,calendarMaxEvents:3,calendarCellHeight:180,dailyForecastDays:5,hourlyForecastHours:6},contentScale:{calendar:102,current:110,clock:114,details:96,daily:100,hourly:100,alerts:90},partStyle:{calendar:{dayLabel:{scale:96},eventTime:{scale:96}},clock:{seconds:{scale:88}},current:{condition:{scale:96}}},elementStyle:{clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'right',vAlign:'middle'},details:{hAlign:'center',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{clock:{x:.06,y:.04,w:.40,h:.11},current:{x:.54,y:.04,w:.40,h:.145},details:{x:.06,y:.19,w:.88,h:.075},calendar:{x:.06,y:.285,w:.88,h:.32},alerts:{x:.15,y:.62,w:.70,h:.04},daily:{x:.06,y:.67,w:.88,h:.09},hourly:{x:.06,y:.79,w:.88,h:.09}}},
  portraitphoto:{name:'Portrait Gallery',category:'Portrait',bestFor:'Vertical display · photo first',description:'A portrait photo composition with a balanced information header, a two-row planner, and compact forecast cards that no longer feel detached.',mode:'custom',photoZone:{x:.06,y:.17,w:.42,h:.29},view:{calendarDays:5,calendarColumns:3,calendarMaxEvents:2,calendarCellHeight:180,dailyForecastDays:5,hourlyForecastHours:6},contentScale:{calendar:96,current:106,clock:112,details:92,daily:96,hourly:96,alerts:88},partStyle:{calendar:{dayLabel:{scale:94},eventTime:{scale:94}},clock:{seconds:{scale:88}},current:{condition:{scale:94}}},elementStyle:{clock:{hAlign:'left',vAlign:'middle'},current:{hAlign:'right',vAlign:'middle'},details:{hAlign:'right',vAlign:'middle'},calendar:{hAlign:'left',vAlign:'top'},daily:{hAlign:'center',vAlign:'middle'},hourly:{hAlign:'center',vAlign:'middle'}},blocks:{clock:{x:.06,y:.04,w:.40,h:.105},current:{x:.54,y:.04,w:.40,h:.145},details:{x:.54,y:.20,w:.40,h:.075},calendar:{x:.06,y:.50,w:.88,h:.255},alerts:{x:.18,y:.775,w:.64,h:.055},daily:{x:.06,y:.85,w:.42,h:.08},hourly:{x:.52,y:.85,w:.42,h:.08}}},
  default:{name:'Libre Balanced',category:'Classic',bestFor:'General landscape use',description:'The original LibreDisplay composition with a wide calendar band and familiar weather/forecast regions.',mode:'default',blocks:{},contentScale:{},elementStyle:{},thumbnail:BALANCED_LAYOUT_THUMBNAIL}
};
let settingsLayoutPresetKey='current';
function cloneLayoutPresetValue(v){return JSON.parse(JSON.stringify(v));}
function currentLayoutPresetThumbnail(){
  if(cfg.layoutMode==='custom'&&cfg.layoutBlocks&&Object.keys(cfg.layoutBlocks).length)return cfg.layoutBlocks;
  return BALANCED_LAYOUT_THUMBNAIL;
}
function layoutPresetThumbnailBlocks(key){
  if(key==='current')return currentLayoutPresetThumbnail();
  const preset=LAYOUT_PRESETS[key];return preset?.thumbnail||preset?.blocks||BALANCED_LAYOUT_THUMBNAIL;
}
function layoutPresetDemoContent(key){
  if(key==='clock')return '<span class="layout-mini-clock"><b>10:21</b><small>Wednesday · October 7</small></span>';
  if(key==='current')return '<span class="layout-mini-weather"><b>72°</b><i>☀</i><small>Partly cloudy</small></span>';
  if(key==='details')return '<span class="layout-mini-details"><b>Feels 72°</b><small>Wind 8 mph · 48%</small></span>';
  if(key==='daily'||key==='hourly')return '<span class="layout-mini-forecast"><i>MON<br>☀<b>74°</b></i><i>TUE<br>☁<b>70°</b></i><i>WED<br>🌦<b>68°</b></i><i>THU<br>☀<b>73°</b></i><i>FRI<br>☀<b>76°</b></i></span>';
  if(key==='calendar')return '<span class="layout-mini-calendar"><span><b>MON</b><i>7</i><em></em><em></em></span><span><b>TUE</b><i>8</i><em></em></span><span><b>WED</b><i>9</i><em></em><em></em></span><span><b>THU</b><i>10</i><em></em></span><span><b>FRI</b><i>11</i><em></em><em></em></span></span>';
  if(key==='alerts')return '<span class="layout-mini-alert">WEATHER · CLEAR</span>';
  return `<span class="layout-mini-label">${escHtml(LAYOUT_PRESET_LABELS[key]||key)}</span>`;
}
const layoutPresetHeroHtml=(key)=>{
  const common={
    photocalendar:`<span class="preset-hero preset-hero-photo-calendar"><span class="hero-photo"><span class="hero-time">4:35<small>Wednesday · October 11</small></span><span class="hero-weather">60° <i>☁</i></span></span><span class="hero-month"><b>OCTOBER</b><span class="hero-weekdays">S M T W T F S</span><span class="hero-month-grid">${Array.from({length:35},(_,i)=>`<i${i===10?' class="today"':''}>${i<2?'':i-1}</i>`).join('')}</span></span></span>`,
    glassboard:`<span class="preset-hero preset-hero-glass"><span class="hero-glass-time">10:21<small>Wednesday · August 7</small></span><span class="hero-glass-card hero-glass-weather"><small>WEATHER</small><b>77° ☁</b><span>Rain later this morning</span></span><span class="hero-glass-card hero-glass-agenda"><small>TOMORROW</small><b>10:00 AM · Sprint Review</b><span>1:00 PM · Developer Training</span><span>4:00 PM · Customer BBQ</span></span><span class="hero-glass-card hero-glass-home"><small>HOME</small><b>79° · closed · off</b></span><span class="hero-glass-card hero-glass-news"><small>BRIEFING</small><b>Three stories worth knowing today</b></span></span>`,
    portraitwall:`<span class="preset-hero preset-hero-portrait"><span class="hero-portrait-time">10:21<small>Wednesday · August 7</small></span><span class="hero-portrait-agenda"><b>TODAY</b><span>9:00 · Foundations & Principles</span><span>1:00 · Developer Training</span><span>4:00 · Customer BBQ</span></span><span class="hero-portrait-weather"><b>72° ☀</b><small>Feels 72° · Wind 8</small></span><span class="hero-portrait-days">SUN&nbsp;&nbsp; MON&nbsp;&nbsp; TUE&nbsp;&nbsp; WED&nbsp;&nbsp; THU</span></span>`,
    weekcolumns:`<span class="preset-hero preset-hero-week"><span class="hero-week-top"><b>11 <small>Today</small></b><b>12 <small>Tomorrow</small></b><b>13 <small>Wednesday</small></b><b>14 <small>Thursday</small></b><b>15 <small>Friday</small></b></span><span class="hero-week-cols">${['Meet w/ John|Dinner at Moms|Basketball','Developer Training|Customer BBQ','Foundations & Principles|Dentist Appt|Movie','John C.|Sprint Review|Book Club','Amy Visits|Soccer practice'].map((c,idx)=>`<i>${c.split('|').map((e,j)=>`<em class="c${(idx+j)%4}">${e}</em>`).join('')}</i>`).join('')}</span></span>`,
    photostory:`<span class="preset-hero preset-hero-story"><span class="hero-story-time">7:12<small>Thursday · August 13</small></span><span class="hero-story-agenda">TODAY&nbsp;&nbsp; 11 AM Meet John · 5 PM Dinner · 9 PM Basketball</span><span class="hero-story-copy"><b>A quiet moment worth seeing</b><span>Your photo, story, quote, or daily message becomes the visual center.</span></span><span class="hero-story-weather">79° <i>☀</i><small>Today 79 / 62 · Fri 85 / 66 · Sat 86 / 64</small></span></span>`,
    mirrorminimal:`<span class="preset-hero preset-hero-mirror"><span class="hero-mirror-time">08:42<small>Monday · October 5</small></span><span class="hero-mirror-weather">68° <i>☾</i><small>Clear · feels 67°</small></span><span class="hero-mirror-agenda"><b>Today</b><span>09:30 Design review</span><span>13:00 Lunch with Alex</span><span>18:30 Dinner</span></span><span class="hero-mirror-forecast">TUE 70°&nbsp;&nbsp;&nbsp; WED 67°&nbsp;&nbsp;&nbsp; THU 72°</span></span>`
  };
  return common[key]||'';
}
function layoutPresetBlockHtml(key,r){
  if(!r||![r.x,r.y,r.w,r.h].every(v=>Number.isFinite(Number(v))))return '';
  const left=Math.max(0,Math.min(100,Number(r.x)*100)),top=Math.max(0,Math.min(100,Number(r.y)*100)),width=Math.max(2,Math.min(100-left,Number(r.w)*100)),height=Math.max(2,Math.min(100-top,Number(r.h)*100));
  return `<span class="layout-preset-block" data-layout-block="${escHtml(key)}" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;width:${width.toFixed(2)}%;height:${height.toFixed(2)}%">${layoutPresetDemoContent(key)}</span>`;
}
function layoutPresetPhotoZoneHtml(zone){
  if(!zone||![zone.x,zone.y,zone.w,zone.h].every(v=>Number.isFinite(Number(v))))return '';
  const left=Math.max(0,Math.min(100,Number(zone.x)*100)),top=Math.max(0,Math.min(100,Number(zone.y)*100)),width=Math.max(2,Math.min(100-left,Number(zone.w)*100)),height=Math.max(2,Math.min(100-top,Number(zone.h)*100));
  return `<span class="layout-preset-photo-zone" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;width:${width.toFixed(2)}%;height:${height.toFixed(2)}%"><i></i><b></b></span>`;
}
function layoutPresetShowcaseSlotHtml(slot){
  const r=slot?.rect;if(!r||![r.x,r.y,r.w,r.h].every(v=>Number.isFinite(Number(v))))return '';
  const left=Math.max(0,Math.min(100,Number(r.x)*100)),top=Math.max(0,Math.min(100,Number(r.y)*100)),width=Math.max(2,Math.min(100-left,Number(r.w)*100)),height=Math.max(2,Math.min(100-top,Number(r.h)*100));
  return `<span class="layout-preset-block layout-preset-showcase layout-showcase-${escHtml(slot.variant||'default')}" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;width:${width.toFixed(2)}%;height:${height.toFixed(2)}%"><i>${escHtml(slot.icon||'◇')}</i><span><b>${escHtml(slot.value||slot.label||'Live data')}</b><small>${escHtml(slot.label||'Module')}</small></span></span>`;
}
function layoutPresetCardHtml(key){
  const current=key==='current',preset=current?null:LAYOUT_PRESETS[key],name=current?'Current saved layout':preset.name,description=current?(cfg.layoutMode==='custom'?'Your saved custom Arrange layout.':'Your saved Libre Balanced layout.'):preset.description;
  const blocks=layoutPresetThumbnailBlocks(key),hero=current?'':layoutPresetHeroHtml(key),photo=current||hero?'':layoutPresetPhotoZoneHtml(preset?.photoZone),showcase=current||hero?'':(preset?.showcaseSlots||[]).map(layoutPresetShowcaseSlotHtml).join(''),thumb=hero||photo+Object.entries(blocks).map(([block,r])=>layoutPresetBlockHtml(block,r)).join('')+showcase;
  const selected=settingsLayoutPresetKey===key,showcaseLayout=!!preset?.showcaseSlots?.length;
  const meta=current?'<span class="layout-preset-badge">Saved</span>':`<span class="layout-preset-badge${preset.featured?' featured':''}">${escHtml(showcaseLayout?'Integration showcase':preset.featured?'Featured':preset.category||'Layout')}</span><span class="layout-preset-badge">${escHtml(preset.bestFor||'Flexible')}</span>`;
  const tip=current?'Choose another card to stage a new arrangement. Nothing changes until you save.':showcaseLayout?'Compatible configured blocks snap into the labeled slots during preview; empty slots demonstrate integrations you can add.':'Select to stage it, then use Preview selected layout for a full-screen live preview.';
  return `<button class="layout-preset-card${selected?' selected':''}" data-layout-preset="${escHtml(key)}" type="button" role="radio" aria-checked="${selected?'true':'false'}" data-ld-action-click="appearance.selectLayoutPreset" data-ld-action-args="${escHtml(JSON.stringify([key]))}"><span class="layout-preset-stage" data-layout-preset-style="${escHtml(key)}" data-layout-surface="${escHtml(preset?.surface||'clean')}" aria-hidden="true">${thumb}</span><span class="layout-preset-copy"><b>${escHtml(name)}</b><span>${escHtml(description)}</span><span class="layout-preset-meta">${meta}</span><small>${escHtml(tip)}</small></span></button>`;
}
function layoutShowcaseSlotMatches(block,slot){
  if(!block||!slot)return false;
  if((slot.types||[]).includes(block.type))return true;
  if(block.type!=='integration')return false;
  const plugin=String(block.config?.plugin||'');if((slot.plugins||[]).includes(plugin))return true;
  const kind=integrationManifest(plugin)?.kind||'';return !!kind&&(slot.kinds||[]).includes(kind);
}
function stageLayoutShowcaseBlocks(blocks,slots){
  const staged=cloneLayoutPresetValue(Array.isArray(blocks)?blocks:[]),filled=[],used=new Set();
  for(const slot of slots||[]){
    const index=staged.findIndex((block,i)=>!used.has(i)&&layoutShowcaseSlotMatches(block,slot));if(index<0)continue;
    const block=staged[index];block.rect=cloneLayoutPresetValue(slot.rect);block.config=block.config&&typeof block.config==='object'?{...block.config}:{};
    if(Number.isFinite(Number(slot.scale)))block.config._contentScale=Math.max(50,Math.min(160,Number(slot.scale)));
    used.add(index);filled.push(slot.id);
  }
  return {blocks:staged,filled};
}
function renderLayoutShowcase(source=cfg){
  const layer=document.getElementById('layout-showcase-layer');if(!layer)return;layer.innerHTML='';
  const slots=Array.isArray(source?._layoutShowcaseSlots)?source._layoutShowcaseSlots:[];if(!slots.length)return;
  const filled=new Set(Array.isArray(source?._layoutShowcaseFilledSlots)?source._layoutShowcaseFilledSlots:[]);
  for(const slot of slots){
    if(filled.has(slot.id)||!validStoredLayoutRect(slot.rect))continue;
    const r=slot.rect,el=document.createElement('div'),pixelH=window.innerHeight*Number(r.h),pixelW=window.innerWidth*Number(r.w),compact=Number(r.h)<.14||pixelH<118||pixelW<230;el.className='layout-showcase-placeholder layout-showcase-'+String(slot.variant||'default').replace(/[^a-z0-9-]/gi,'')+(compact?' compact':'');
    el.style.left=(Number(r.x)*100).toFixed(3)+'%';el.style.top=(Number(r.y)*100).toFixed(3)+'%';el.style.width=(Number(r.w)*100).toFixed(3)+'%';el.style.height=(Number(r.h)*100).toFixed(3)+'%';
    el.innerHTML=`<div class="layout-showcase-head"><span class="layout-showcase-icon">${escHtml(slot.icon||'◇')}</span><span class="layout-showcase-title">${escHtml(slot.label||'Integration')}</span><span class="layout-showcase-chip">demo</span></div><div><div class="layout-showcase-value">${escHtml(slot.value||'Live data')}</div><div class="layout-showcase-sub">${escHtml(slot.sub||'Add a compatible block to fill this slot.')}</div></div><div class="layout-showcase-hint">${escHtml(slot.hint||'Add from Arrange → Add Block')}</div>`;
    layer.appendChild(el);
  }
}
function renderLayoutPresetGallery(){
  const host=document.getElementById('layout-preset-gallery');if(!host)return;
  host.innerHTML=LAYOUT_PRESET_ORDER.map(layoutPresetCardHtml).join('');
  const status=document.getElementById('layout-preset-status');if(status){const preset=LAYOUT_PRESETS[settingsLayoutPresetKey];status.textContent=settingsLayoutPresetKey==='current'?'Current saved layout selected. Choose a preset to stage a different arrangement.':`Previewing ${preset?.name||'layout'} — not saved yet.`;}
}
function applyLayoutPresetToSource(source,key=settingsLayoutPresetKey,options={}){
  if(!source||key==='current')return source;
  const preset=LAYOUT_PRESETS[key];if(!preset)return source;
  source.layoutMode=preset.mode==='custom'?'custom':'default';
  source.layoutSurfaceStyle=preset.surface||'clean';
  source.layoutPresetStyle=key;
  source.layoutBlocks=preset.mode==='custom'?cloneLayoutPresetValue(preset.blocks||{}):{};
  source.layoutContentScale=cloneLayoutPresetValue(preset.contentScale||{});
  source.layoutElementStyle=cloneLayoutPresetValue(preset.elementStyle||{});
  source.layoutPartStyle=cloneLayoutPresetValue(preset.partStyle||{});
  if(preset.view&&typeof preset.view==='object')Object.assign(source,cloneLayoutPresetValue(preset.view));
  if(preset.presentation&&typeof preset.presentation==='object')Object.assign(source,cloneLayoutPresetValue(preset.presentation));
  if(Array.isArray(preset.showcaseSlots)&&preset.showcaseSlots.length){
    const staged=stageLayoutShowcaseBlocks(source.customBlocks||[],preset.showcaseSlots);source.customBlocks=staged.blocks;
    if(options.preview){source._layoutShowcaseSlots=cloneLayoutPresetValue(preset.showcaseSlots);source._layoutShowcaseFilledSlots=staged.filled;}
  }
  return source;
}
function selectLayoutPreset(key){
  if(key!=='current'&&!LAYOUT_PRESETS[key])return;
  settingsLayoutPresetKey=key;
  previewAppearance();
  renderLayoutPresetGallery();
  markSettingsDirty();
}
function previewSelectedLayoutFromSettings(){
  previewAppearance();
  previewDashboardFromSettings();
}
function previewAppearance(){
  const temp=applyLayoutPresetToSource(appearanceFromForm(),settingsLayoutPresetKey,{preview:true});
  updateFontPreview();
  window.__uiPreviewCfg=temp;
  updateAppearanceLabels(temp);
  applyUiCustomization(temp);
  if(configApi.wxData)renderWeather(configApi.wxData);
  renderCalendar(window.__lastCalendarEvents||[]);
}


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("appearance", {cloneLayoutPresetValue,currentLayoutPresetThumbnail,layoutPresetThumbnailBlocks,layoutPresetHeroHtml,layoutPresetBlockHtml,layoutPresetPhotoZoneHtml,layoutPresetShowcaseSlotHtml,layoutPresetCardHtml,layoutShowcaseSlotMatches,stageLayoutShowcaseBlocks,renderLayoutShowcase,renderLayoutPresetGallery,applyLayoutPresetToSource,selectLayoutPreset,previewSelectedLayoutFromSettings,previewAppearance}, {
  "LAYOUT_PRESET_ORDER": {configurable:true,get:()=>LAYOUT_PRESET_ORDER},
  "LAYOUT_PRESET_LABELS": {configurable:true,get:()=>LAYOUT_PRESET_LABELS},
  "BALANCED_LAYOUT_THUMBNAIL": {configurable:true,get:()=>BALANCED_LAYOUT_THUMBNAIL},
  "LAYOUT_PRESETS": {configurable:true,get:()=>LAYOUT_PRESETS},
  "settingsLayoutPresetKey": {configurable:true,get:()=>settingsLayoutPresetKey,set:(value)=>{settingsLayoutPresetKey=value;}}
}, {globalFunctions:['renderLayoutShowcase','renderLayoutPresetGallery','applyLayoutPresetToSource','selectLayoutPreset','previewSelectedLayoutFromSettings','previewAppearance'],globalStates:[]});
}
// End source section: /js/appearance/presets.js

// LibreDisplay source section: /js/appearance/backup.js
{
// Settings import/export, portable backups, and local restore points.
const configApi=LibreDisplayRuntime.getModule('config');
const {ensureCfgDefaults,saveCfg}=configApi;
const bootstrapApi=LibreDisplayRuntime.getModule('bootstrap');
const {serverPath}=bootstrapApi;
const {escHtml,esc,resilientFetch}=LibreDisplayRuntime.getModule('shared');
const integrationsApi=LibreDisplayRuntime.getModule('integrations');
const backgroundsApi=LibreDisplayRuntime.getModule('backgrounds');


async function exportSettings(){
  if(!confirm('Export settings for this display? The file may include private calendar URLs and integration credentials. Store it securely.'))return;
  const backgroundSnapshot=await backgroundsApi.createPortableBackgroundSnapshot(cfg).catch(()=>null);
  const payload={product:'LibreDisplay',format:3,build:bootstrapApi.DASHBOARD_BUILD,exportedAt:new Date().toISOString(),endpoint:bootstrapApi.ACTIVE_ENDPOINT,config:{...cfg,_schemaVersion:configApi.CONFIG_SCHEMA_VERSION},backgroundSnapshot};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`libredisplay-${bootstrapApi.ACTIVE_ENDPOINT}-settings-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function analyzeImportedSettings(raw){const envelope=raw&&raw.product==='LibreDisplay'&&raw.config&&typeof raw.config==='object';const candidate=envelope?raw.config:raw;if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))throw new Error('That file does not contain a LibreDisplay settings object.');const migration=configApi.configMigrationInfo(candidate),plugins=new Set(integrationsApi.integrationManifests.map(x=>x.id)),blocks=Array.isArray(candidate.customBlocks)?candidate.customBlocks:[],missing=[...new Set(blocks.filter(b=>b?.type==='integration'&&b.config?.plugin&&!plugins.has(b.config.plugin)).map(b=>b.config.plugin))];return {candidate,backgroundSnapshot:envelope?raw.backgroundSnapshot||null:null,sourceBuild:envelope?String(raw.build||'unknown'):'unversioned settings file',schema:migration.from,targetSchema:migration.to,migrationSteps:migration.steps,futureSchema:migration.future,calendars:Array.isArray(candidate.calendars)?candidate.calendars.length:0,blocks:blocks.length,missing};}
async function importSettingsFile(input){
  const file=input?.files?.[0];if(!file)return;
  try{
    const raw=JSON.parse(await file.text()),info=analyzeImportedSettings(raw);
    if(info.futureSchema)throw new Error(`This backup uses configuration schema ${info.schema}, but this LibreDisplay build supports schema ${info.targetSchema}. Upgrade LibreDisplay before importing it.`);
    const notes=[`Source: ${info.sourceBuild}`,`Schema: ${info.schema}${info.migrationSteps.length?` → ${info.targetSchema} (${info.migrationSteps.join(', ')})`:''}`,`${info.calendars} calendar source${info.calendars===1?'':'s'}`,`${info.blocks} custom block${info.blocks===1?'':'s'}`];
    if(info.missing.length)notes.push(`Missing plugins: ${info.missing.join(', ')}`);
    if(!confirm(`Import this LibreDisplay configuration?\n\n${notes.join('\n')}\n\nCurrent settings will be kept as the automatic previous-save backup.`))return;
    const migrated=configApi.migrateConfigSnapshot(info.candidate,{rejectFuture:true});cfg={...cfg,...migrated};ensureCfgDefaults();configApi.alertRuntimeState=null;window.__uiPreviewCfg=null;const saved=await saveCfg();if(!saved?.ok)throw new Error(saved?.error||'The imported settings could not be saved to the server.');const restoredBackground=info.backgroundSnapshot?await backgroundsApi.restorePortableBackgroundSnapshot(info.backgroundSnapshot,cfg):false;setAppearanceForm(cfg);applySettings();markSettingsClean();alert('Settings imported and migrated successfully.'+(restoredBackground?' The exported background snapshot was restored while the configured source reconnects.':''));openSetup(false);
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
      resilientFetch(serverPath('/api/config'),{cache:'no-store'}),resilientFetch(serverPath('/api/profiles'),{cache:'no-store'}),resilientFetch(serverPath('/api/scenes'),{cache:'no-store'})
    ]);
    const configData=await configRes.json().catch(()=>({})),profilesData=await profilesRes.json().catch(()=>({})),scenesData=await scenesRes.json().catch(()=>({}));
    if(!configRes.ok||!configData.ok)throw new Error(configData.error||'Could not read the saved display configuration.');
    if(!profilesRes.ok||!profilesData.ok)throw new Error(profilesData.error||'Could not read Profiles.');
    if(!scenesRes.ok||!scenesData.ok)throw new Error(scenesData.error||'Could not read Scenes.');
    const allScenes=scenesData.scenes||{version:1,automatic:true,baseProfiles:{},items:[]};
    const portableScenes={version:1,automatic:allScenes.automatic!==false,baseProfiles:{},items:(allScenes.items||[]).filter(x=>(x?.endpoint||'main')===bootstrapApi.ACTIVE_ENDPOINT)};
    if(allScenes.baseProfiles?.[bootstrapApi.ACTIVE_ENDPOINT])portableScenes.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT]=allScenes.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT];
    const exportConfig=configApi.migrateConfigSnapshot(configData.config||{}, {rejectFuture:true}),exportProfiles=configApi.normalizeProfileStore(profilesData.profiles||{version:1,updatedAt:0,activeId:'',items:[]});const backgroundSnapshot=await backgroundsApi.createPortableBackgroundSnapshot(exportConfig).catch(()=>null);const payload={product:'LibreDisplay',kind:'portable-backup',format:2,build:bootstrapApi.DASHBOARD_BUILD,exportedAt:new Date().toISOString(),sourceEndpoint:bootstrapApi.ACTIVE_ENDPOINT,config:exportConfig,profiles:exportProfiles,scenes:portableScenes,backgroundSnapshot};
    const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    downloadJsonFile(payload,`LibreDisplay-${bootstrapApi.ACTIVE_ENDPOINT}-portable-${stamp}.json`);
    setBackupRecoveryStatus('Portable backup downloaded. It may contain private calendar URLs or integration credentials, so keep it private.');
  }catch(e){setBackupRecoveryStatus('Could not create portable backup: '+(e?.message||e),true);}
}
function analyzePortableBackup(raw){
  if(!raw||raw.product!=='LibreDisplay'||raw.kind!=='portable-backup'||![1,2].includes(Number(raw.format)))throw new Error('That file is not a supported LibreDisplay portable backup.');
  if(!raw.config||typeof raw.config!=='object'||Array.isArray(raw.config))throw new Error('Portable backup is missing its display configuration.');
  const profiles=raw.profiles&&typeof raw.profiles==='object'&&!Array.isArray(raw.profiles)?raw.profiles:{version:1,updatedAt:0,activeId:'',items:[]};
  const scenes=raw.scenes&&typeof raw.scenes==='object'&&!Array.isArray(raw.scenes)?raw.scenes:{version:1,automatic:true,baseProfiles:{},items:[]};
  const blocks=Array.isArray(raw.config.customBlocks)?raw.config.customBlocks:[],plugins=new Set(integrationsApi.integrationManifests.map(x=>x.id));
  const missing=[...new Set(blocks.filter(b=>b?.type==='integration'&&b.config?.plugin&&!plugins.has(b.config.plugin)).map(b=>b.config.plugin))];
  const migration=configApi.configMigrationInfo(raw.config);return {config:raw.config,profiles,scenes,backgroundSnapshot:raw.backgroundSnapshot||null,build:String(raw.build||'unknown'),sourceEndpoint:String(raw.sourceEndpoint||'main'),exportedAt:String(raw.exportedAt||''),schema:migration.from,targetSchema:migration.to,migrationSteps:migration.steps,futureSchema:migration.future,profileCount:Array.isArray(profiles.items)?profiles.items.length:0,sceneCount:Array.isArray(scenes.items)?scenes.items.length:0,missing};
}
async function importPortableBackupFile(input){
  const file=input?.files?.[0];if(!file)return;
  let safetyPointId='';
  try{
    if(file.size>28*1024*1024)throw new Error('Portable backup is larger than the 28 MB safety limit.');
    const raw=JSON.parse(await file.text()),info=analyzePortableBackup(raw);
    if(info.futureSchema)throw new Error(`This portable backup uses configuration schema ${info.schema}, but this LibreDisplay build supports schema ${info.targetSchema}. Upgrade LibreDisplay before importing it.`);
    const migratedConfig=configApi.migrateConfigSnapshot(info.config,{rejectFuture:true});
    const notes=[`Source build: ${info.build}`,`Source display: ${info.sourceEndpoint}`,`${info.profileCount} Profile${info.profileCount===1?'':'s'}`,`${info.sceneCount} Scene rule${info.sceneCount===1?'':'s'}`,info.backgroundSnapshot?'Includes a portable last-known still background':'No portable background snapshot included'];
    if(info.missing.length)notes.push(`Missing integrations on this server: ${info.missing.join(', ')}`);
    if(!confirm(`Import this portable LibreDisplay backup into “${bootstrapApi.ACTIVE_ENDPOINT}”?\n\n${notes.join('\n')}\n\nLibreDisplay will create a local restore point first, then replace this display's saved configuration plus Profiles and Scenes.`))return;
    setBackupRecoveryStatus('Creating a safety restore point…');
    const safe=await resilientFetch('/api/restore-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',endpoint:bootstrapApi.ACTIVE_ENDPOINT,label:'Before portable import'}),cache:'no-store'});const safeData=await safe.json().catch(()=>({}));if(!safe.ok||!safeData.ok)throw new Error(safeData.error||'Could not create the safety restore point.');
    safetyPointId=String(safeData.point?.id||'');if(!safetyPointId)throw new Error('The safety restore point did not return an id.');
    setBackupRecoveryStatus('Importing configuration, Profiles and Scenes…');
    const [currentProfilesRes,currentScenesRes]=await Promise.all([resilientFetch('/api/profiles',{cache:'no-store'}),resilientFetch('/api/scenes',{cache:'no-store'})]);
    const currentProfilesData=await currentProfilesRes.json().catch(()=>({})),currentScenesData=await currentScenesRes.json().catch(()=>({}));
    if(!currentProfilesRes.ok||!currentProfilesData.ok)throw new Error(currentProfilesData.error||'Could not read existing Profiles before import.');
    if(!currentScenesRes.ok||!currentScenesData.ok)throw new Error(currentScenesData.error||'Could not read existing Scenes before import.');
    const existingProfiles=currentProfilesData.profiles&&typeof currentProfilesData.profiles==='object'?currentProfilesData.profiles:{version:1,updatedAt:0,activeId:'',items:[]};
    const profileMap=new Map((existingProfiles.items||[]).filter(x=>x?.id).map(x=>[x.id,{...x,config:configApi.migrateConfigSnapshot(x.config||{},{rejectFuture:true})}]));for(const row of info.profiles.items||[]){if(row?.id)profileMap.set(row.id,{...row,config:configApi.migrateConfigSnapshot(row.config||{},{rejectFuture:true})});}
    const mergedProfiles={...existingProfiles,...info.profiles,items:[...profileMap.values()],updatedAt:Date.now()};
    const existingScenes=currentScenesData.scenes&&typeof currentScenesData.scenes==='object'?currentScenesData.scenes:{version:1,automatic:true,baseProfiles:{},items:[]};
    const importedItems=(info.scenes.items||[]).map(x=>({...x,endpoint:bootstrapApi.ACTIVE_ENDPOINT}));
    const mergedScenes={...existingScenes,items:[...(existingScenes.items||[]).filter(x=>(x?.endpoint||'main')!==bootstrapApi.ACTIVE_ENDPOINT),...importedItems],baseProfiles:{...(existingScenes.baseProfiles||{})}};
    const importedBase=info.scenes.baseProfiles?.[info.sourceEndpoint]||info.scenes.baseProfiles?.[bootstrapApi.ACTIVE_ENDPOINT]||'';if(importedBase)mergedScenes.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT]=importedBase;else delete mergedScenes.baseProfiles[bootstrapApi.ACTIVE_ENDPOINT];
    if(!(existingScenes.items||[]).some(x=>(x?.endpoint||'main')!==bootstrapApi.ACTIVE_ENDPOINT))mergedScenes.automatic=info.scenes.automatic!==false;
    const writes=[
      ['/api/profiles',{profiles:mergedProfiles},'Profiles'],
      [serverPath('/api/config'),{config:{...migratedConfig,_savedAt:Date.now()}},'display configuration'],
      ['/api/scenes',{scenes:mergedScenes},'Scenes']
    ];
    for(const [url,payload,label] of writes){const res=await resilientFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`Could not import ${label} (HTTP ${res.status}).`);}
    const restoredBackground=info.backgroundSnapshot?await backgroundsApi.restorePortableBackgroundSnapshot(info.backgroundSnapshot,migratedConfig):false;
    setBackupRecoveryStatus(`Portable backup imported${restoredBackground?' with its last-known background snapshot':''}. Reloading the saved state…`);
    setTimeout(()=>location.reload(),300);
  }catch(e){
    let recovery='';
    if(safetyPointId){
      try{const res=await resilientFetch('/api/restore-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'apply',endpoint:bootstrapApi.ACTIVE_ENDPOINT,id:safetyPointId}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);recovery=' Previous state was restored automatically.';}catch(restoreError){recovery=' Automatic recovery also failed; use the local restore point before making more changes.';}
    }
    setBackupRecoveryStatus('Could not import portable backup: '+(e?.message||e)+recovery,true);
  }
  finally{if(input)input.value='';}
}

function formatBackupBytes(value){const n=Math.max(0,Number(value)||0);if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024/1024).toFixed(1)} MB`;}
function renderRestorePoints(rows){
  const host=document.getElementById('restore-point-list');if(!host)return;const points=Array.isArray(rows)?rows:[];
  if(!points.length){host.innerHTML='<div class="settings-note">No local restore points yet.</div>';return;}
  host.innerHTML=points.map(row=>{const current=row.endpoint===bootstrapApi.ACTIVE_ENDPOINT,date=row.createdUtc?new Date(row.createdUtc).toLocaleString():'Unknown date',label=row.label||'Restore point';return `<div class="restore-point-row"><div><div class="restore-point-title">${esc(label)}</div><div class="restore-point-meta">${esc(date)} · v${esc(row.version||'unknown')} · display ${esc(row.endpoint||'main')} · ${esc(formatBackupBytes(row.sizeBytes))}</div></div><div class="restore-point-actions"><button class="btn-util" type="button" ${current?'':'disabled title="This restore point belongs to another display"'} data-ld-action-click="appearance.applyRestorePoint" data-ld-action-args="${escHtml(JSON.stringify([row.id]))}">Restore</button><button class="btn-util" type="button" data-ld-action-click="appearance.deleteRestorePoint" data-ld-action-args="${escHtml(JSON.stringify([row.id]))}">Delete</button></div></div>`}).join('');
}
async function loadRestorePoints(){
  const host=document.getElementById('restore-point-list');if(!host)return;host.innerHTML='<div class="settings-note">Loading restore points…</div>';
  try{const res=await resilientFetch('/api/restore-points',{cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);renderRestorePoints(data.points);setBackupRecoveryStatus(data.points?.length?`${data.points.length} restore point${data.points.length===1?'':'s'} stored locally.`:'No local restore points yet.');}catch(e){host.innerHTML='';setBackupRecoveryStatus('Could not load restore points: '+(e?.message||e),true);}
}
async function createRestorePoint(){
  const label=prompt('Restore point name:','Before changes');if(label===null)return;
  setBackupRecoveryStatus('Creating restore point…');
  try{const res=await resilientFetch('/api/restore-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',endpoint:bootstrapApi.ACTIVE_ENDPOINT,label:label.trim()||'Manual restore point'}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);renderRestorePoints(data.points);setBackupRecoveryStatus('Restore point created.');}catch(e){setBackupRecoveryStatus('Could not create restore point: '+(e?.message||e),true);}
}
async function applyRestorePoint(id){
  if(!confirm('Restore this point now?\n\nLibreDisplay will automatically create a new “Before restore” point first. The page will reload after the saved configuration, Profiles, and Scenes are restored.'))return;
  setBackupRecoveryStatus('Restoring saved state…');
  try{const res=await resilientFetch('/api/restore-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'apply',endpoint:bootstrapApi.ACTIVE_ENDPOINT,id}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);setBackupRecoveryStatus('Restore complete. Reloading…');setTimeout(()=>location.reload(),300);}catch(e){setBackupRecoveryStatus('Could not restore that point: '+(e?.message||e),true);}
}
async function deleteRestorePoint(id){
  if(!confirm('Delete this local restore point? This cannot be undone.'))return;
  try{const res=await resilientFetch('/api/restore-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',endpoint:bootstrapApi.ACTIVE_ENDPOINT,id}),cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);renderRestorePoints(data.points);setBackupRecoveryStatus('Restore point deleted.');}catch(e){setBackupRecoveryStatus('Could not delete restore point: '+(e?.message||e),true);}
}


// Preserve the compatibility bridge for legacy bare-identifier callers.
LibreDisplayRuntime.exposeModule("appearance", {exportSettings,analyzeImportedSettings,importSettingsFile,setBackupRecoveryStatus,downloadJsonFile,exportPortableBackup,analyzePortableBackup,importPortableBackupFile,formatBackupBytes,renderRestorePoints,loadRestorePoints,createRestorePoint,applyRestorePoint,deleteRestorePoint}, {}, {globalFunctions:['exportSettings','importSettingsFile','exportPortableBackup','importPortableBackupFile','loadRestorePoints','createRestorePoint','applyRestorePoint','deleteRestorePoint']});
}
// End source section: /js/appearance/backup.js
