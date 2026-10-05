import re
import unittest
from pathlib import Path
from frontend_source import frontend_source

ROOT = Path(__file__).resolve().parents[1]
HTML = frontend_source(ROOT)


class SettingsUiTests(unittest.TestCase):
    def test_context_help_registry_covers_core_controls(self):
        m = re.search(r"const SETTINGS_CONTROL_HELP=\{(.*?)\n\};", HTML, re.S)
        self.assertIsNotNone(m)
        keys = set(re.findall(r"'([^']+)'\s*:", m.group(1)))
        self.assertGreaterEqual(len(keys), 75)
        required = {
            's-city', 's-calendar-refresh', 's-alerts-enabled', 's-bg-source',
            's-photo-interval', 's-unit', 's-font-family', 's-settings-ui-size',
            's-ui-calendar', 's-ui-current', 's-ui-clock', 's-ui-forecast',
            's-ui-details', 's-ui-alert', 's-calendar-height', 's-bottom-height',
            's-layout-snap', 's-show-daily', 's-show-hourly',
            'integration-directory-search', 'account-role', 'scene-automatic'
        }
        self.assertTrue(required.issubset(keys), required - keys)

    def test_settings_help_enhancer_and_legend_are_present(self):
        self.assertIn('function enhanceSettingsControlHelp()', HTML)
        self.assertIn('enhanceSettingsControlHelp();', HTML)
        self.assertIn('Hover a ? for plain-language details.', HTML)
        self.assertIn('context-help-title', HTML)
        self.assertIn("e.key==='Escape'&&activeContextHelpTip", HTML)

    def test_all_settings_sections_have_summary_entries(self):
        section_ids = set(re.findall(r'<div class="s-section" id="([^"]+)"[^>]*data-settings-tab=', HTML))
        m = re.search(r"const SETTINGS_SECTION_SUMMARIES=\{(.*?)\n\};", HTML, re.S)
        self.assertIsNotNone(m)
        summary_ids = set(re.findall(r"'([^']+)'\s*:", m.group(1)))
        self.assertTrue(section_ids.issubset(summary_ids), section_ids - summary_ids)

    def test_settings_navigation_is_task_oriented(self):
        tabs = re.findall(r'<button class="settings-tab-btn[^>]*data-tab="([^"]+)"', HTML)
        self.assertEqual(tabs, [
            'overview', 'weather', 'naturescape', 'calendars', 'backgrounds', 'look',
            'layout', 'family', 'integrations', 'system'
        ])
        self.assertNotIn('data-settings-tab="content"', HTML)
        expected = {
            'settings-location': 'weather',
            'settings-alerts': 'weather',
            'settings-weather-options': 'weather',
            'settings-weather-details': 'weather',
            'settings-naturescape-overview': 'naturescape',
            'settings-naturescape-flora': 'naturescape',
            'settings-naturescape-insects': 'naturescape',
            'settings-naturescape-birds': 'naturescape',
            'settings-naturescape-winter': 'naturescape',
            'settings-calendars': 'calendars',
            'settings-backgrounds': 'backgrounds',
            'settings-background-style': 'backgrounds',
            'settings-layout-presentation': 'look',
            'settings-layout': 'layout',
            'settings-layout-geometry': 'layout',
        }
        for section_id, tab in expected.items():
            self.assertRegex(HTML, rf'id="{section_id}"[^>]*data-settings-tab="{tab}"')

    def test_layout_tuning_is_split_into_focused_cards(self):
        self.assertNotIn('id="settings-appearance"', HTML)
        self.assertIn('id="settings-layout-presentation"', HTML)
        self.assertIn('id="settings-layout"', HTML)
        self.assertIn('id="settings-layout-geometry"', HTML)
        self.assertIn("if(tab==='content')tab='weather';", HTML)

    def test_weather_location_requires_explicit_match_and_shows_verified_metadata(self):
        self.assertIn('function searchWeatherLocations()', HTML)
        self.assertIn('count=10&language=en', HTML)
        self.assertIn('function selectWeatherLocationResult(index)', HTML)
        self.assertIn('weather-location-selected', HTML)
        self.assertIn('Search for the location and choose the exact city/region/country match before saving.', HTML)
        self.assertIn('locationTimezone', HTML)
        self.assertIn('locationGeocodeId', HTML)

    def test_weather_units_are_explicit_and_location_label_is_rendered(self):
        self.assertIn('&temperature_unit=celsius&precipitation_unit=mm&wind_speed_unit=${weatherWindUnitParam(source)}', HTML)
        self.assertIn('function weatherWindUnitLabel(source=cfg)', HTML)
        self.assertIn('function weatherWindUnitMatches(raw,source=cfg)', HTML)
        self.assertIn('id="wx-location"', HTML)
        self.assertIn("locationEl.textContent=locationLabel", HTML)
        self.assertIn("weatherWindUnitLabel(cfg)+' '+dir", HTML)

    def test_layout_preset_gallery_stages_without_mutating_saved_config(self):
        self.assertIn('id="layout-preset-gallery"', HTML)
        self.assertIn('id="layout-preset-preview-button"', HTML)
        self.assertIn("const LAYOUT_PRESET_ORDER=['current','photocalendar','glassboard','portraitwall','weekcolumns','photostory','mirrorminimal','family','split','gallery','calendar','agenda','weather','morning','smarthub','familyops','office','insights','travel','large','compact','minimal','portrait','portraitphoto','default'];", HTML)
        self.assertIn('function renderLayoutPresetGallery()', HTML)
        self.assertIn('function selectLayoutPreset(key)', HTML)
        self.assertIn('function previewSelectedLayoutFromSettings()', HTML)
        select = re.search(r"function selectLayoutPreset\(key\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(select)
        self.assertNotIn('Object.assign(cfg', select.group(1))
        self.assertNotIn('saveCfg(', select.group(1))
        self.assertIn('previewAppearance();', select.group(1))
        self.assertIn('renderLayoutPresetGallery();', select.group(1))

    def test_layout_presets_have_real_distinct_geometry_and_live_preview(self):
        self.assertIn("family:{name:'Family Command Center'", HTML)
        self.assertIn("split:{name:'Photo + Planner'", HTML)
        self.assertIn("gallery:{name:'Gallery Week'", HTML)
        self.assertIn("calendar:{name:'Calendar Wall'", HTML)
        self.assertIn("agenda:{name:'Planner + Weather Rail'", HTML)
        self.assertIn("weather:{name:'Weather Center'", HTML)
        self.assertIn("large:{name:'Across the Room'", HTML)
        self.assertIn("compact:{name:'Countertop Grid'", HTML)
        self.assertIn("minimal:{name:'Minimal Photo'", HTML)
        self.assertIn("portrait:{name:'Portrait Planner'", HTML)
        self.assertIn("portraitphoto:{name:'Portrait Gallery'", HTML)
        self.assertIn("mode:'custom'", HTML)
        apply_source = re.search(r"function applyLayoutPresetToSource\(source,key=settingsLayoutPresetKey,options=\{\}\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(apply_source)
        body = apply_source.group(1)
        self.assertIn("source.layoutMode=preset.mode==='custom'?'custom':'default';", body)
        self.assertIn('source.layoutBlocks=', body)
        self.assertIn('source.layoutContentScale=', body)
        self.assertIn('source.layoutElementStyle=cloneLayoutPresetValue(preset.elementStyle||{});', body)
        self.assertIn('source.layoutPartStyle=cloneLayoutPresetValue(preset.partStyle||{});', body)
        self.assertIn("if(preset.view&&typeof preset.view==='object')Object.assign(source,cloneLayoutPresetValue(preset.view));", body)
        preview = re.search(r"function previewAppearance\(\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(preview)
        self.assertIn('applyLayoutPresetToSource(appearanceFromForm(),settingsLayoutPresetKey,{preview:true})', preview.group(1))
        full = re.search(r"function previewDashboardFromSettings\(\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(full)
        self.assertIn('previewAppearance();', full.group(1))

    def test_layout_preset_save_commits_only_when_save_and_apply_runs(self):
        save = re.search(r"async function saveSetup\(options=\{\}\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(save)
        body = save.group(1)
        self.assertIn("if(appearanceApi.settingsLayoutPresetKey!=='current')", body)
        self.assertIn('applyLayoutPresetToSource(cfg,appearanceApi.settingsLayoutPresetKey,{commit:true});', body)
        self.assertIn("appearanceApi.settingsLayoutPresetKey='current';", body)
        restore = re.search(r"function restoreSavedSettingsPreview\(\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(restore)
        restore_body = restore.group(1)
        self.assertIn("appearanceApi.settingsLayoutPresetKey='current';", restore_body)
        self.assertIn('setAppearanceForm(cfg);', restore_body)
        self.assertIn('applySettings();', restore_body)

    def test_starter_templates_use_the_same_layout_preview_pipeline(self):
        self.assertIn("const STARTER_TEMPLATE_LAYOUTS={family:'family',photo:'gallery',minimal:'minimal',weather:'weather'", HTML)
        starter = re.search(r"function applyStarterTemplate\(key\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(starter)
        body = starter.group(1)
        self.assertIn('preservePresetState(', body)
        self.assertIn("appearanceApi.settingsLayoutPresetKey=STARTER_TEMPLATE_LAYOUTS[key]||'default';", body)
        self.assertIn('previewAppearance();', body)
        self.assertIn('renderLayoutPresetGallery();', body)
        self.assertNotIn('saveCfg(', body)


    def test_showcase_layouts_surface_real_integrations_without_saving_placeholders(self):
        for marker in [
            "morning:{name:'Morning Briefing'",
            "smarthub:{name:'Smart Home Hub'",
            "familyops:{name:'Family Operations'",
            "office:{name:'Team Board'",
            "insights:{name:'Markets & Conditions'",
            "travel:{name:'Travel Day'",
        ]:
            self.assertIn(marker, HTML)
        self.assertIn('showcaseSlots:', HTML)
        self.assertIn('function stageLayoutShowcaseBlocks(blocks,slots)', HTML)
        self.assertIn('function renderLayoutShowcase(source=cfg)', HTML)
        self.assertIn("if(options.preview){source._layoutShowcaseSlots=", HTML)
        self.assertNotIn('source.customBlocks.push({type:', HTML)
        self.assertIn("smarthome:'smarthub'", HTML)
        self.assertIn("morning:'morning'", HTML)
        self.assertIn("metrics:'insights'", HTML)

    def test_premade_layout_autofit_covers_calendar_and_forecast_content(self):
        self.assertIn('function calendarFitScale(el)', HTML)
        self.assertIn("padTop=Math.max(0,parseFloat(css.paddingTop)||0)", HTML)
        self.assertIn("usableH=Math.max(1,el.clientHeight-padTop-padBottom-rowGap*(rows-1))", HTML)
        self.assertIn('function forecastFitScale(block,gridSelector,itemSelector)', HTML)
        self.assertIn("--ld-layout-fit-daily", HTML)
        self.assertIn("--ld-layout-fit-hourly", HTML)
        self.assertIn('builtInLayoutAutoFitResizeObserver=new ResizeObserver', HTML)

    def test_preset_previews_preserve_weather_details_and_restore_form(self):
        self.assertIn("const PRESET_CONTENT_PRESERVE_KEYS=['weatherDetailsOrder','weatherDetailsEnabled','showSunset','showWind','showHumidity'", HTML)
        self.assertIn('function preservePresetState(target,current)', HTML)
        restore = re.search(r"function restoreSavedSettingsPreview\(\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(restore)
        body = restore.group(1)
        self.assertIn('setAppearanceForm(cfg);', body)
        self.assertIn('if(configApi.wxData)renderWeather(configApi.wxData);', body)
        self.assertIn("renderCalendar(window.__lastCalendarEvents||[]);", body)

    def test_system_health_refreshes_automatically_while_settings_are_open(self):
        self.assertIn('const SYSTEM_HEALTH_REFRESH_MS=15000;', HTML)
        self.assertIn('function startSystemHealthAutoRefresh()', HTML)
        self.assertIn('function stopSystemHealthAutoRefresh()', HTML)
        self.assertIn('systemHealthRefreshTimer=setInterval', HTML)
        self.assertIn('startSystemHealthAutoRefresh();', HTML)
        self.assertIn('stopSystemHealthAutoRefresh();', HTML)
        self.assertIn('Auto-refresh every 15 seconds', HTML)
        self.assertIn('Refresh now', HTML)


    def test_layout_library_is_expanded_and_descriptive(self):
        for label in [
            'Family Command Center', 'Photo + Planner', 'Gallery Week', 'Calendar Wall',
            'Planner + Weather Rail', 'Weather Center', 'Across the Room', 'Countertop Grid',
            'Minimal Photo', 'Portrait Planner', 'Portrait Gallery'
        ]:
            self.assertIn(label, HTML)
        self.assertIn('layout-preset-photo-zone', HTML)
        self.assertIn("preset.bestFor", HTML)
        self.assertIn("preset.featured", HTML)
        self.assertIn('Preset layouts stage the built-in positions, alignment, and content density', HTML)

    def test_layout_presets_tune_density_and_portrait_calendar_columns(self):
        self.assertIn('<option value="2">2 columns</option>', HTML)
        self.assertIn('cfg.calendarColumns=Math.min(10,Math.max(2,Number(cfg.calendarColumns)||7));', HTML)
        self.assertIn('const calCols=Math.min(10,Math.max(2,Number(source.calendarColumns)||7));', HTML)
        self.assertIn("family:{name:'Family Command Center'", HTML)
        self.assertIn('view:{calendarDays:7,calendarColumns:4,calendarMaxEvents:3,calendarCellHeight:160,dailyForecastDays:7,hourlyForecastHours:9}', HTML)
        self.assertIn("portrait:{name:'Portrait Planner'", HTML)
        self.assertIn('view:{calendarDays:6,calendarColumns:2,calendarMaxEvents:3,calendarCellHeight:180,dailyForecastDays:5,hourlyForecastHours:6}', HTML)

    def test_custom_layout_weather_alignment_and_fit_cover_all_current_conditions(self):
        self.assertIn('.wx-main[data-ld-h-align="right"]{align-items:flex-end;text-align:right}', HTML)
        self.assertIn('body.custom-layout .wx-main > .wx-feels', HTML)
        self.assertIn('body.custom-layout .wx-main > .wx-cond', HTML)
        fit = re.search(r"function currentWeatherFitScale\(el\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(fit)
        self.assertIn('const kids=[...el.children]', fit.group(1))
        self.assertIn('const needH=Math.max(1,el.scrollHeight);', fit.group(1))

    def test_software_update_auto_detection_runs_on_settings_open_and_heartbeat(self):
        self.assertIn('const SOFTWARE_UPDATE_AUTO_CHECK_MS=15*60*1000;', HTML)
        self.assertIn('function startSoftwareUpdateAutoDetection()', HTML)
        self.assertIn("autoDetectSoftwareUpdate('open')", HTML)
        self.assertIn("autoDetectSoftwareUpdate('heartbeat')", HTML)
        self.assertIn('startSoftwareUpdateAutoDetection();', HTML)
        self.assertIn('stopSoftwareUpdateAutoDetection();', HTML)
        self.assertIn("autoDetectSoftwareUpdate('visible')", HTML)
        self.assertIn('Auto-checks when Settings opens and every 15 minutes', HTML)
        self.assertIn('onclick="checkSoftwareUpdate(true)"', HTML)

    def test_display_profiles_support_multi_display_management(self):
        self.assertIn('id="s-profile-endpoint"', HTML)
        self.assertIn('duplicateSelectedProfile()', HTML)
        self.assertIn('applySelectedProfileToDisplay()', HTML)
        self.assertIn('captureTargetDisplayAsProfile()', HTML)
        self.assertIn('activeByEndpoint', HTML)
        self.assertIn('function endpointConfigPath(endpoint)', HTML)
        self.assertIn('This replaces that display\'s saved dashboard configuration.', HTML)

    def test_location_display_name_is_optional_not_coordinate_source(self):
        self.assertIn("cfg.locName=requestedLabel;", HTML)
        self.assertIn('Shown above Current Weather on the dashboard.', HTML)
        self.assertNotIn("cfg.locName=requestedLabel||`${r.name}, ${r.country_code}`", HTML)

    def test_provider_health_and_live_integration_checks_are_discoverable(self):
        self.assertIn('id="settings-provider-health"', HTML)
        self.assertIn('id="integration-health-summary"', HTML)
        self.assertIn('function checkAllIntegrationsNow()', HTML)
        self.assertIn('function forceIntegrationCheck(blockId)', HTML)
        self.assertIn('&check=1&nonce=', HTML)
        self.assertIn('function renderProviderHealth()', HTML)
        self.assertIn('Remote data cache', HTML)

    def test_quick_access_menu_reaches_customization_without_opening_settings_first(self):
        self.assertIn('id="quick-access-menu"', HTML)
        self.assertIn('onclick="quickAccessArrange()"', HTML)
        self.assertIn('onclick="quickAccessAddBlock()"', HTML)
        self.assertIn('onclick="quickAccessIntegrations()"', HTML)
        self.assertIn('function toggleQuickAccessMenu(e)', HTML)
        self.assertIn("content:'Quick access'", HTML)

    def test_configured_integrations_are_directly_reconfigurable(self):
        self.assertIn('id="integration-configured-blocks"', HTML)
        self.assertIn('function renderConfiguredIntegrationBlocks()', HTML)
        self.assertIn('function editCustomBlockFromSettings(blockId)', HTML)
        self.assertIn('function arrangeCustomBlockFromSettings(blockId)', HTML)
        self.assertIn('Edit configuration', HTML)
        self.assertIn('Edit block', HTML)
        self.assertIn('Double-click to configure this added block', HTML)

    def test_arrange_keyboard_shortcuts_cover_basic_editing(self):
        self.assertIn('id="layout-shortcuts-panel"', HTML)
        self.assertIn("e.key==='Delete'||e.key==='Backspace'", HTML)
        self.assertIn("e.key.toLowerCase()==='d'", HTML)
        self.assertIn("e.key==='Enter'&&customKeyId(layoutSelectedKey)", HTML)
        self.assertIn("e.key.toLowerCase()==='a'", HTML)
        self.assertIn("e.key==='['||e.key===']'", HTML)
        self.assertIn('deleteSelectedCustomBlock(false)', HTML)
        self.assertIn('Delete the selected added block. Undo is available.', HTML)

    def test_visual_font_picker_renders_each_font_as_its_own_sample(self):
        self.assertIn('id="font-choice-grid"', HTML)
        self.assertIn('const LIBREDISPLAY_FONTS=[', HTML)
        self.assertIn('function renderFontChoices(selected)', HTML)
        self.assertIn('style="font-family:${fontCssValue(f.value)}"', HTML)
        self.assertIn('Each font name above is rendered in that font', HTML)
        self.assertIn('function styleFontSelectOptions()', HTML)

    def test_background_rotation_uses_double_buffered_preload_without_blank_frames(self):
        self.assertIn('id="bg-image-a"', HTML)
        self.assertIn('id="bg-image-b"', HTML)
        self.assertIn('function prepareUpcomingBackground()', HTML)
        self.assertIn('function loadBackgroundIntoLayer(layer,remoteUrl,priority=', HTML)
        self.assertIn('function revealBackgroundLayer(layer,remoteUrl)', HTML)
        self.assertIn("if(configApi.bgPreparedIndex!==null&&configApi.bgPreparedUrl&&configApi.bgImages[configApi.bgPreparedIndex]===configApi.bgPreparedUrl)return configApi.bgPreparedIndex;", HTML)
        reveal = re.search(r"async function revealBackgroundLayer\(layer,remoteUrl\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(reveal)
        body = reveal.group(1)
        self.assertIn("layer.classList.add('show');", body)
        self.assertIn("active.classList.remove('show');", body)
        self.assertLess(body.index("layer.classList.add('show');"), body.index("active.classList.remove('show');"))
        self.assertIn('await configApi.bgPreparePromise;', HTML)
        self.assertIn('prepareUpcomingBackground();', HTML)

    def test_system_health_and_update_actions_are_discoverable(self):
        self.assertIn('id="settings-system-health"', HTML)
        self.assertIn('id="settings-backup-recovery"', HTML)
        self.assertIn('id="restore-point-list"', HTML)
        self.assertIn('exportPortableBackup()', HTML)
        self.assertIn('id="software-update-now"', HTML)
        self.assertIn('id="settings-update-badge"', HTML)
        self.assertIn('function loadSystemHealth()', HTML)
        self.assertIn('function startSystemHealthAutoRefresh()', HTML)
        self.assertIn('function stopSystemHealthAutoRefresh()', HTML)
        self.assertIn('const SYSTEM_HEALTH_REFRESH_MS=15000;', HTML)
        self.assertIn('id="system-health-refresh-status"', HTML)
        self.assertIn('id="system-health-hardware"', HTML)
        self.assertIn('id="system-health-memory"', HTML)
        self.assertIn('id="system-health-browser"', HTML)
        self.assertIn('Kiosk browser', HTML)
        self.assertIn('Refresh now', HTML)
        self.assertIn('function downloadDiagnostics()', HTML)
        self.assertIn('function startSoftwareUpdate()', HTML)
        self.assertIn('Update Now creates a safety backup', HTML)


if __name__ == '__main__':
    unittest.main()


def test_naturescape_has_its_own_settings_bucket_and_focused_sections():
    dashboard = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
    navigation = (ROOT / "app" / "js" / "settings" / "navigation.js").read_text(encoding="utf-8")
    assert 'data-tab="naturescape"' in dashboard
    for section in (
        "settings-naturescape-overview",
        "settings-naturescape-flora",
        "settings-naturescape-insects",
        "settings-naturescape-birds",
        "settings-naturescape-owls",
        "settings-naturescape-winter",
    ):
        assert f'id="{section}" data-settings-tab="naturescape"' in dashboard
        assert section in navigation
    assert "naturescape:'Naturescape'" in navigation
    assert 'id="settings-weather-seasonal"' not in dashboard


def test_weather_and_naturescape_tuning_controls_are_uniquely_wired():
    import re
    dashboard = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
    appearance = (ROOT / "app" / "js" / "appearance" / "weather.js").read_text(encoding="utf-8")
    effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
    pairs = re.findall(r"\['([^']+)','([^']+)'\]", appearance.split('const WEATHER_TUNING_FIELDS=',1)[1].split('];',1)[0])
    assert len(pairs) >= 50
    for control_id, key in pairs:
        assert dashboard.count(f'id="{control_id}"') == 1, control_id
        assert key in effects, key
    checks = re.findall(r"\['([^']+)','([^']+)'\]", appearance.split('const WEATHER_TUNING_CHECKS=',1)[1].split('];',1)[0])
    for control_id, key in checks:
        assert dashboard.count(f'id="{control_id}"') == 1, control_id
        assert key in effects, key


def test_naturescape_opacity_controls_use_real_percentages_and_birds_apply_them():
    import re
    dashboard = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
    effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
    css = (ROOT / "app" / "css" / "dashboard.css").read_text(encoding="utf-8")
    opacity_ids = (
        "s-weather-leaves-opacity", "s-weather-grass-opacity", "s-weather-petal-opacity",
        "s-weather-bee-opacity", "s-weather-butterfly-opacity", "s-weather-firefly-opacity",
        "s-weather-dragonfly-opacity", "s-weather-ladybug-opacity", "s-weather-moth-opacity",
        "s-weather-bird-opacity", "s-weather-owl-opacity", "s-weather-crystal-opacity",
        "s-weather-cold-frost-opacity",
    )
    for control_id in opacity_ids:
        match = re.search(rf'id="{re.escape(control_id)}"[^>]*min="([^"]+)"[^>]*max="([^"]+)"', dashboard)
        assert match, control_id
        assert match.group(1) == "0", control_id
        assert match.group(2) == "100", control_id
    for key in (
        "weatherSeasonLeavesOpacity", "weatherSeasonGrassOpacity", "weatherSeasonPetalOpacity",
        "weatherSeasonBeeOpacity", "weatherSeasonButterflyOpacity", "weatherSeasonFireflyOpacity",
        "weatherSeasonDragonflyOpacity", "weatherSeasonLadybugOpacity", "weatherSeasonMothOpacity",
        "weatherSeasonBirdOpacity", "weatherSeasonOwlOpacity", "weatherSeasonCrystalOpacity",
    ):
        assert f"source.{key},0,100,100" in effects
    bird_rule = re.search(r"\.weather-fx-bird\{[^}]+\}", css)
    assert bird_rule
    assert "filter:drop-shadow" in bird_rule.group(0)
    assert "filter:opacity(var(--season-opacity,1))" not in bird_rule.group(0)

    # Naturescape opacity is a single authoritative percentage. Movement keyframes may
    # animate transforms, but they cannot override the user's requested visibility.
    assert ".weather-fx-seasonal{opacity:var(--season-opacity,1)!important}" in css
    assert ".weather-fx-seasonal{filter:opacity(var(--season-opacity,1))}" not in css
    assert "#weather-effects-overlay .weather-fx-seasonal{animation:none!important;opacity:1!important}" not in css
    assert "filter:opacity(var(--season-opacity,1))" not in css
    isolation = css.split("/* v1.8.12 opacity isolation:", 1)[1]
    assert "#weather-effects-overlay.show{opacity:1}" in isolation
    assert "#weather-effects-overlay.show::before{opacity:calc(var(--weather-fx-atmosphere,.55)*var(--weather-fx-opacity,.34))}" in isolation
    assert ".weather-fx-particle{filter:blur(var(--fx-blur,0px)) opacity(var(--weather-fx-opacity,.34))}" in isolation


def test_secondary_background_cache_is_bounded_lazy_and_exposed_in_settings():
    dashboard = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
    config = (ROOT / "app" / "js" / "core" / "config.js").read_text(encoding="utf-8")
    backgrounds = (ROOT / "app" / "js" / "backgrounds" / "index.js").read_text(encoding="utf-8")
    navigation = (ROOT / "app" / "js" / "settings" / "navigation.js").read_text(encoding="utf-8")
    for control_id in ("s-bg-offline-cache", "s-bg-offline-cache-count", "s-bg-offline-cache-max-mb"):
        assert f'id="{control_id}"' in dashboard
        assert f"'{control_id}'" in navigation
    assert "backgroundOfflineCacheEnabled:true" in config
    assert "backgroundOfflineCacheCount:30" in config
    assert "backgroundOfflineCacheMaxMb:192" in config
    assert "const HOT_BACKGROUND_LIMIT=10" in backgrounds
    assert "setTimeout(()=>{backgroundCacheFillTimer=null;void fillBackgroundCaches(list);},4500)" in backgrounds
    assert "navigator.storage?.estimate?.()" in backgrounds
    assert "enforceBackgroundCacheBudget" in backgrounds
    assert "backgroundMediaKind(url)==='image'&&!backgroundMediaIsMotion(url)" in backgrounds
    assert "Math.min(60" in backgrounds


def test_bird_habitat_setting_is_exposed_and_auto_is_inland_safe():
    dashboard = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
    effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
    navigation = (ROOT / "app" / "js" / "settings" / "navigation.js").read_text(encoding="utf-8")
    assert 'id="s-weather-bird-habitat"' in dashboard
    for value in ("auto", "urban", "woodland", "grassland", "wetland", "coastal"):
        assert f'value="{value}"' in dashboard
    assert "Auto — inland-safe mix" in dashboard
    assert "'s-weather-bird-habitat'" in navigation
    assert "BIRD_WATER_SPECIES" in effects
    assert "weatherBirdHabitat" in effects



def test_immersive_weather_severity_controls_and_renderers_are_exposed():
    dashboard = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
    effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
    css = (ROOT / "app" / "css" / "dashboard.css").read_text(encoding="utf-8")
    config = (ROOT / "app" / "js" / "core" / "config.js").read_text(encoding="utf-8")
    for control_id in ("s-weather-fog-rolling-banks", "s-weather-snow-blowing", "s-weather-lightning-streaks", "s-weather-storm-cloud-deck", "s-weather-storm-rain-sheets"):
        assert f'id="{control_id}"' in dashboard
    for key in ("weatherFogRollingBanks", "weatherSnowBlowing", "weatherLightningStreaks", "weatherStormCloudDeck", "weatherStormRainSheets"):
        assert key in config
        assert key in effects
    assert "function weatherPhenomenonProfile" in effects
    for marker in ("weather-fx-fog-bank", "weather-fx-storm-cloud", "weather-fx-rain-sheet", "weather-fx-blowing-snow"):
        assert marker in effects
        assert marker in css
    for severity in ("drizzle", "light-rain", "heavy-rain", "flurries", "heavy-snow", "severe-storm"):
        assert severity in effects


def test_bird_repeat_avoidance_uses_rolling_history_and_auto_habitat_is_strictly_inland_safe():
    effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
    css = (ROOT / "app" / "css" / "dashboard.css").read_text(encoding="utf-8")
    assert "recentBirdSpecies=[...recentBirdSpecies,...currentBirdSceneSpecies]" in effects
    assert ".slice(-24)" in effects
    assert "wildlifeSceneBuiltAt" in effects
    assert "Date.now()-wildlifeSceneBuiltAt>120000" in effects
    assert "if(habitat==='auto'||!['wetland','coastal'].includes(habitat))" in effects
    assert "weather-fx-bird-species-song-sparrow" in css
    assert "weather-fx-bird-species-baltimore-oriole" in css
    assert "weather-fx-bird-species-indigo-bunting" in css
    assert "@keyframes ldBirdTailFlex" in css
    assert "@keyframes ldBirdHeadBob" in css

def test_v1813_naturescape_creature_anatomy_preserves_bilateral_wings_and_true_form_profiles():
    effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
    css = (ROOT / "app" / "css" / "dashboard.css").read_text(encoding="utf-8")
    assert "['wing-far','wing-near','head','tail','beak','neck','legs','mark']" in effects
    assert effects.count("['wing-far','wing-near','head','tail','beak','neck','legs','mark']") == 2
    assert "/* v1.8.13 Naturescape creature anatomy and animation fidelity. */" in css
    for marker in (
        ".weather-fx-bird-wing-far", ".weather-fx-bird-wing-near",
        "@keyframes ldBirdWingNearV1813", "@keyframes ldBirdWingSoarV1813",
        "@keyframes ldBirdWingHoverV1813", "@keyframes ldBirdWingOwlV1813",
        "@keyframes ldButterflyWingLeftV1813", "@keyframes ldButterflyWingRightV1813",
        "@keyframes ldMothWingLeftV1813", "@keyframes ldMothWingRightV1813",
        "@keyframes ldDragonflyWingV1813",
    ):
        assert marker in css
    assert ".weather-fx-bird-species-crane .weather-fx-bird-neck{display:block" in css
    assert ".weather-fx-bird-species-egret .weather-fx-bird-neck,.weather-fx-bird-species-heron .weather-fx-bird-neck{display:block" in css
    assert ".weather-fx-bird-species-pelican .weather-fx-bird-beak::after" in css
    assert "html.ld-reduce-motion body.ld-weather-respect-reduced-motion #weather-effects-overlay .weather-fx-bird-wing-far" in css


def test_update_attention_cue_is_static_and_discoverable():
    css = (ROOT / "app" / "css" / "dashboard.css").read_text(encoding="utf-8")
    assert '.settings-update-badge::before{content:"!"}' in css
    assert '.settings-update-badge.show{display:grid}' in css
    rule=css[css.find('#setup .settings-update-badge'):css.find('.software-update-actions')]
    assert 'animation:' not in rule
    assert 'ldUpdateTabAttention' not in css
    assert "html.ld-reduce-motion #setup .update-now-btn{animation:none!important}" in css


def test_css_has_no_escaped_newline_patch_residue_or_duplicate_keyframes():
    import re
    css = (ROOT / "app" / "css" / "dashboard.css").read_text(encoding="utf-8")
    assert "\\n/*" not in css
    names = re.findall(r"@keyframes\s+([A-Za-z0-9_-]+)", css)
    duplicates = sorted({name for name in names if names.count(name) > 1})
    assert duplicates == []


def test_background_cache_budget_never_invents_free_space():
    backgrounds = (ROOT / "app" / "js" / "backgrounds" / "index.js").read_text(encoding="utf-8")
    assert "return Math.max(0,Math.min(selected,quotaShare,freeShare))" in backgrounds
    assert "Math.max(16*1024*1024,Math.min(selected,quotaShare,freeShare))" not in backgrounds


def test_all_configured_bird_and_owl_species_have_visual_styles():
    import re
    effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
    css = (ROOT / "app" / "css" / "dashboard.css").read_text(encoding="utf-8")

    bird_ids = set()
    for const_name in ("BIRD_SPECIES_POOLS", "BIRD_HABITAT_EXTRAS"):
        match = re.search(rf"const {const_name}=\{{(.*?)\n\}};", effects, re.S)
        assert match, const_name
        bird_ids.update(re.findall(r"\['([a-z0-9-]+)'\s*,\s*[0-9.]", match.group(1)))
    bird_ids.update(("nighthawk", "tawny-frogmouth"))

    owl_match = re.search(r"const OWL_SPECIES_POOLS=\{(.*?)\n\};", effects, re.S)
    assert owl_match
    owl_ids = set(re.findall(r"\['([a-z0-9-]+)'\s*,\s*[0-9.]", owl_match.group(1)))

    styled = set(re.findall(r"weather-fx-bird-species-([a-z0-9-]+)", css))
    assert sorted(bird_ids - styled) == []
    assert sorted(owl_ids - styled) == []


def test_periodic_wildlife_rebuild_changes_owl_and_butterfly_species_seed():
    effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
    owl_line = next(line for line in effects.splitlines() if line.startswith("function owlSpeciesForIndex"))
    butterfly_line = next(line for line in effects.splitlines() if line.startswith("function butterflySpeciesForIndex"))
    assert "wildlifeSceneSerial" in owl_line
    assert "wildlifeSceneSerial" in butterfly_line


def test_every_weather_and_naturescape_tuning_control_participates_in_overlay_signature():
    import re
    appearance = (ROOT / "app" / "js" / "appearance" / "weather.js").read_text(encoding="utf-8")
    effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
    fields_block = appearance.split("const WEATHER_TUNING_FIELDS=",1)[1].split("];",1)[0]
    checks_block = appearance.split("const WEATHER_TUNING_CHECKS=",1)[1].split("];",1)[0]
    field_keys = {key for _, key in re.findall(r"\['([^']+)','([^']+)'\]", fields_block)}
    check_keys = {key for _, key in re.findall(r"\['([^']+)','([^']+)'\]", checks_block)}
    effect_block = effects.split("const EFFECT_TUNING_KEYS=[",1)[1].split("];",1)[0]
    effect_keys = set(re.findall(r"'([^']+)'", effect_block))
    signature_line = next(line for line in effects.splitlines() if line.lstrip().startswith("const signature=["))
    explicit_keys = set(re.findall(r"source\.([A-Za-z0-9_]+)", signature_line))
    all_ui_keys = field_keys | check_keys
    covered = effect_keys | explicit_keys
    assert len(all_ui_keys) >= 90
    assert sorted(all_ui_keys - covered) == []
