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


if __name__ == '__main__':
    unittest.main()
