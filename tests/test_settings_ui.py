import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'app' / 'dashboard.html').read_text(encoding='utf-8')


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
            'overview', 'weather', 'calendars', 'backgrounds', 'look',
            'layout', 'family', 'integrations', 'system'
        ])
        self.assertNotIn('data-settings-tab="content"', HTML)
        expected = {
            'settings-location': 'weather',
            'settings-alerts': 'weather',
            'settings-weather-options': 'weather',
            'settings-weather-details': 'weather',
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
        self.assertIn('&temperature_unit=celsius&precipitation_unit=mm&wind_speed_unit=${weatherWindUnitParam(cfg)}', HTML)
        self.assertIn('function weatherWindUnitLabel(source=cfg)', HTML)
        self.assertIn('function weatherWindUnitMatches(raw,source=cfg)', HTML)
        self.assertIn('id="wx-location"', HTML)
        self.assertIn("locationEl.textContent=locationLabel", HTML)
        self.assertIn("weatherWindUnitLabel(cfg)+' '+dir", HTML)

    def test_layout_preset_gallery_stages_without_mutating_saved_config(self):
        self.assertIn('id="layout-preset-gallery"', HTML)
        self.assertIn('id="layout-preset-preview-button"', HTML)
        self.assertIn("const LAYOUT_PRESET_ORDER=['current','default','compact','large','photo','calendar','portrait'];", HTML)
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
        self.assertIn("compact:{name:'Compact'", HTML)
        self.assertIn("large:{name:'Large & readable'", HTML)
        self.assertIn("photo:{name:'Photo first'", HTML)
        self.assertIn("calendar:{name:'Calendar focus'", HTML)
        self.assertIn("portrait:{name:'Stacked / portrait'", HTML)
        self.assertIn("mode:'custom'", HTML)
        apply_source = re.search(r"function applyLayoutPresetToSource\(source,key=settingsLayoutPresetKey\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(apply_source)
        body = apply_source.group(1)
        self.assertIn("source.layoutMode=preset.mode==='custom'?'custom':'default';", body)
        self.assertIn('source.layoutBlocks=', body)
        self.assertIn('source.layoutContentScale=', body)
        self.assertIn('source.layoutElementStyle={};', body)
        self.assertIn('source.layoutPartStyle={};', body)
        preview = re.search(r"function previewAppearance\(\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(preview)
        self.assertIn('applyLayoutPresetToSource(appearanceFromForm(),settingsLayoutPresetKey)', preview.group(1))
        full = re.search(r"function previewDashboardFromSettings\(\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(full)
        self.assertIn('previewAppearance();', full.group(1))

    def test_layout_preset_save_commits_only_when_save_and_apply_runs(self):
        save = re.search(r"async function saveSetup\(options=\{\}\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(save)
        body = save.group(1)
        self.assertIn("if(settingsLayoutPresetKey!=='current')", body)
        self.assertIn('applyLayoutPresetToSource(cfg,settingsLayoutPresetKey);', body)
        self.assertIn("settingsLayoutPresetKey='current';", body)
        restore = re.search(r"function restoreSavedSettingsPreview\(\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(restore)
        restore_body = restore.group(1)
        self.assertIn("settingsLayoutPresetKey='current';", restore_body)
        self.assertIn('setAppearanceForm(cfg);', restore_body)
        self.assertIn('applySettings();', restore_body)

    def test_starter_templates_use_the_same_layout_preview_pipeline(self):
        self.assertIn("const STARTER_TEMPLATE_LAYOUTS={family:'calendar',photo:'photo',minimal:'compact'", HTML)
        starter = re.search(r"function applyStarterTemplate\(key\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(starter)
        body = starter.group(1)
        self.assertIn('preservePresetState(', body)
        self.assertIn("settingsLayoutPresetKey=STARTER_TEMPLATE_LAYOUTS[key]||'default';", body)
        self.assertIn('previewAppearance();', body)
        self.assertIn('renderLayoutPresetGallery();', body)
        self.assertNotIn('saveCfg(', body)

    def test_preset_previews_preserve_weather_details_and_restore_form(self):
        self.assertIn("const PRESET_CONTENT_PRESERVE_KEYS=['weatherDetailsOrder','weatherDetailsEnabled','showSunset','showWind','showHumidity'", HTML)
        self.assertIn('function preservePresetState(target,current)', HTML)
        restore = re.search(r"function restoreSavedSettingsPreview\(\)\{(.*?)\n\}", HTML, re.S)
        self.assertIsNotNone(restore)
        body = restore.group(1)
        self.assertIn('setAppearanceForm(cfg);', body)
        self.assertIn('if(wxData)renderWeather(wxData);', body)
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
        self.assertIn('Refresh now', HTML)
        self.assertIn('function downloadDiagnostics()', HTML)
        self.assertIn('function startSoftwareUpdate()', HTML)
        self.assertIn('Update Now creates a safety backup', HTML)


if __name__ == '__main__':
    unittest.main()
