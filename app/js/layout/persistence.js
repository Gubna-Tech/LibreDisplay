const layoutApi=()=>LibreDisplayRuntime.getModule("layout");
// Arrange save/cancel/reset commands, keyboard nudging, and resize reconciliation.
const {saveCfg}=LibreDisplayRuntime.getModule('config');
const {normalizeHexColor}=LibreDisplayRuntime.getModule('shared');


function cancelLayoutEditor(){
  const hadSession=layoutEditorActive||!!layoutApi().layoutEditorOriginal;
  if(hadSession){
    const o=layoutApi().layoutEditorOriginal||{layoutMode:'default',layoutBlocks:{},layoutContentScale:{},layoutElementStyle:{},layoutPartStyle:{},layoutGridPx:20,layoutSnap:true};
    cfg.layoutMode=o.layoutMode;cfg.layoutBlocks=JSON.parse(JSON.stringify(o.layoutBlocks||{}));cfg.layoutContentScale=JSON.parse(JSON.stringify(o.layoutContentScale||{}));cfg.layoutElementStyle=JSON.parse(JSON.stringify(o.layoutElementStyle||{}));cfg.layoutPartStyle=JSON.parse(JSON.stringify(o.layoutPartStyle||{}));cfg.layoutGridPx=o.layoutGridPx||20;cfg.layoutSnap=o.layoutSnap!==false;cfg.customBlocks=JSON.parse(JSON.stringify(layoutCustomBlocksOriginal||[]));customBlockRenderSignature='';
  }
  stopLayoutEditorUi();
  if(hadSession){renderCustomBlocks(cfg.customBlocks);applyUiCustomization(cfg);}else document.body.classList.remove('layout-editing');
  layoutApi().layoutEditorOriginal=null;layoutCustomBlocksOriginal=[];
  if(LAYOUT_PREVIEW_MODE&&window.parent!==window)setTimeout(()=>notifyLayoutPreviewParent('cancelled'),0);
}
function resetLayoutEditorDraft(){
  if(!layoutEditorActive)return;pushLayoutHistory();
  layoutApi().layoutEditorDraft=measureDefaultLayoutRects();layoutSelectedKey='';
  cfg.layoutMode='custom';cfg.layoutBlocks=JSON.parse(JSON.stringify(layoutApi().layoutEditorDraft));
  document.body.classList.add('custom-layout','layout-editing');
  for(const [key,r] of Object.entries(layoutApi().layoutEditorDraft))applyOneLayoutRect(key,r);
  renderLayoutEditorBoxes();
}
function resetSelectedLayoutBlock(){
  if(!layoutEditorActive||!layoutSelectedKey)return;pushLayoutHistory();
  const customId=customKeyId(layoutSelectedKey);if(customId){const b=customBlockById(customId,layoutCustomBlocksDraft);if(!b)return;b.rect=defaultBlockRect(b.type);b.config=b.config||{};Object.assign(b.config,{_contentScale:100,_hAlign:'auto',_vAlign:'auto',_fontFamily:'',_textColor:'',_opacity:100});renderCustomBlocks(layoutCustomBlocksDraft);renderLayoutEditorBoxes();selectLayoutBlock(layoutSelectedKey);return;}
  if(!layoutApi().LAYOUT_BLOCK_DEFS[layoutSelectedKey])return;
  cfg.layoutMode='custom';cfg.layoutBlocks=JSON.parse(JSON.stringify(layoutApi().layoutEditorDraft));
  const defaults=measureDefaultLayoutRects(),r=defaults[layoutSelectedKey];if(!r)return;
  layoutApi().layoutEditorDraft[layoutSelectedKey]=r;layoutApi().layoutContentScaleDraft[layoutSelectedKey]=100;layoutApi().layoutElementStyleDraft[layoutSelectedKey]={hAlign:'auto',vAlign:'auto',fontFamily:'',textColor:'',opacity:100};layoutApi().layoutPartStyleDraft[layoutSelectedKey]={};cfg.layoutBlocks=JSON.parse(JSON.stringify(layoutApi().layoutEditorDraft));
  document.body.classList.add('custom-layout','layout-editing');
  for(const [key,rect] of Object.entries(layoutApi().layoutEditorDraft))applyOneLayoutRect(key,rect);
  renderLayoutEditorBoxes();selectLayoutBlock(layoutSelectedKey);
}
function resetSavedBlockLayout(){
  if(!confirm('Reset the saved drag/resize block arrangement and return to the default dashboard geometry?'))return;
  cfg.layoutMode='default';cfg.layoutBlocks={};saveCfg();applyUiCustomization(cfg);updateLayoutModeStatus(cfg);setAppearanceForm(cfg);
}
function nudgeSelectedLayoutBlock(key,resize=false){
  const selectedRect=layoutEditorRectForKey(layoutSelectedKey),def=layoutEditorDefForKey(layoutSelectedKey);
  if(!layoutEditorActive||!layoutSelectedKey||!selectedRect||!def||def.locked)return false;
  pushLayoutHistory();const vp=layoutViewportSize(),grid=Math.max(4,Number(document.getElementById('layout-toolbar-grid')?.value)||20),r=pxRectFromNormalized(selectedRect);
  if(resize){if(key==='ArrowRight')r.width+=grid;if(key==='ArrowLeft')r.width-=grid;if(key==='ArrowDown')r.height+=grid;if(key==='ArrowUp')r.height-=grid;r.width=Math.max(def.minW,Math.min(vp.width-r.left,r.width));r.height=Math.max(def.minH,Math.min(vp.height-r.top,r.height));}
  else {if(key==='ArrowRight')r.left+=grid;if(key==='ArrowLeft')r.left-=grid;if(key==='ArrowDown')r.top+=grid;if(key==='ArrowUp')r.top-=grid;r.left=Math.max(0,Math.min(vp.width-r.width,r.left));r.top=Math.max(0,Math.min(vp.height-r.height,r.top));}
  setLayoutEditorRectForKey(layoutSelectedKey,normalizedRectFromPx(r));renderLayoutEditorBoxes();return true;
}
window.addEventListener('resize',()=>{
  fitRemoteLayoutPreview();
  if(layoutEditorActive){refreshLayoutSessionViewport();for(const [key,r] of Object.entries(layoutApi().layoutEditorDraft))applyOneLayoutRect(key,r);for(const b of layoutCustomBlocksDraft)applyCustomBlockRect(document.querySelector(`.custom-block[data-block-id="${CSS.escape(b.id)}"]`),b);renderLayoutEditorBoxes();requestAnimationFrame(keepLayoutInspectorOnScreen);}
  else {if(cfg.layoutMode==='custom')applyCustomLayout(cfg);for(const b of cfg.customBlocks||[])applyCustomBlockRect(document.querySelector(`.custom-block[data-block-id="${CSS.escape(b.id)}"]`),b);}
});

function hexRgb(hex){
  const s=normalizeHexColor(hex,'#ffffff').slice(1);
  return {r:parseInt(s.slice(0,2),16),g:parseInt(s.slice(2,4),16),b:parseInt(s.slice(4,6),16)};
}


// Preserve compatibility with existing inline event wiring while callers migrate to module APIs.
LibreDisplayRuntime.exposeModule("layout", {cancelLayoutEditor,resetLayoutEditorDraft,resetSelectedLayoutBlock,resetSavedBlockLayout,nudgeSelectedLayoutBlock,hexRgb}, {}, {globalFunctions:['cancelLayoutEditor','resetLayoutEditorDraft','resetSelectedLayoutBlock','resetSavedBlockLayout','nudgeSelectedLayoutBlock','hexRgb']});
