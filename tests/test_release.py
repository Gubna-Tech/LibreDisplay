import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ReleaseContractTests(unittest.TestCase):
    def test_public_release_identity_is_consistent(self):
        version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        cli = (ROOT / "scripts" / "libredisplay").read_text(encoding="utf-8")
        server = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        self.assertRegex(version, r"^\d+\.\d+\.\d+$")
        self.assertIn(f"LibreDisplay-v{version}.zip", readme)
        self.assertIn("Gubna-Tech/LibreDisplay", readme)
        self.assertIn('REPOSITORY = "Gubna-Tech/LibreDisplay"', cli)
        self.assertIn("repos/Gubna-Tech/LibreDisplay/releases/latest", server)

    def test_public_quickstart_matches_flat_release_zip_layout(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("unzip -q /tmp/LibreDisplay.zip -d ~/LibreDisplay-Setup", readme)
        self.assertIn("cd ~/LibreDisplay-Setup", readme)
        self.assertFalse((ROOT / "SECURITY.md").exists())
        self.assertIn("Remote access, accounts, and privacy", readme)

    def test_version_matches_dashboard_build(self):
        version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        match = re.search(r"const DASHBOARD_BUILD = '([^']+)'", html)
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1), version)

    def test_simple_public_documentation_and_native_update_helper(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertFalse((ROOT / "SECURITY.md").exists())
        self.assertIn("## Quick start — Raspberry Pi", readme)
        self.assertIn("libredisplay update", readme)
        update = ROOT / "update.sh"
        self.assertTrue(update.is_file())
        source = update.read_text(encoding="utf-8")
        self.assertIn('"$INSTALL_DIR/scripts/backup.sh"', source)
        self.assertIn('Your existing settings, display endpoints, media, and custom plugin folders were kept.', source)


    def test_single_command_native_update_is_installed(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        install = (ROOT / "install.sh").read_text(encoding="utf-8")
        update = (ROOT / "update.sh").read_text(encoding="utf-8")
        uninstall = (ROOT / "uninstall.sh").read_text(encoding="utf-8")
        cli = (ROOT / "scripts" / "libredisplay").read_text(encoding="utf-8")
        self.assertIn("libredisplay update", readme)
        self.assertIn('/usr/local/bin/libredisplay', install)
        self.assertIn('/usr/local/bin/libredisplay', update)
        self.assertIn('/usr/local/bin/libredisplay', uninstall)
        self.assertIn('API_URL = f"https://api.github.com/repos/{REPOSITORY}/releases/latest"', cli)
        self.assertIn('safe_extract', cli)

    def test_docker_image_carries_release_version(self):
        dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn("COPY --chown=libredisplay:libredisplay VERSION /VERSION", dockerfile)

    def test_settings_exposes_calm_update_status(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn('id="health-software"', html)
        self.assertIn('id="settings-software-update"', html)
        self.assertIn('libredisplay update', html)
        self.assertIn('function checkSoftwareUpdate', html)
        self.assertIn('/api/update-status', html)

    def test_server_user_agent_uses_release_version_dynamically(self):
        source = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        self.assertIn('APP_VERSION = (PROJECT_ROOT / "VERSION").read_text', source)
        self.assertIn('f"LibreDisplay/{APP_VERSION}', source)
        self.assertNotRegex(source, r"LibreDisplay/\d+\.\d+\.\d+")

    def test_unversioned_json_raw_flag_is_supported(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn("config.visualization=config.raw===true?'raw':'value'", html)

    def test_previous_layout_shape_is_supported(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn("previousWeatherBlock", html)
        self.assertIn("previousForecastBlock", html)

    def test_task_renderer_forwards_provider_context(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn("listId:task.listId||''", html)
        self.assertIn("t.listName||t.projectName", html)

    def test_block_editor_helpers_are_present(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for function_name in (
            "openBlockCatalog", "openBlockConfigEditor", "closeBlockConfig",
            "bf", "bsel", "bcheck", "integrationSettingsFieldsHtml",
        ):
            self.assertIn(f"function {function_name}", html)

    def test_integration_editor_accepts_normalized_setting_keys(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn("function integrationSettingValue", html)
        self.assertIn("String(key||'').toLowerCase()", html)


    def test_calm_settings_information_architecture(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn("const SETTINGS_TABS=['overview','content','family','look','integrations','system']", html)
        for section in ('settings-integrations', 'settings-accessibility'):
            self.assertIn(f'id="{section}"', html)
        self.assertIn('data-tab="family"', html)
        self.assertIn("integration-directory-search", html)
        self.assertIn("settings-mode-essential", html)

    def test_accessibility_and_layout_history_controls(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for marker in ("cfg._schemaVersion=2", "function applyAccessibilityPreferences", "Intl.DateTimeFormat", "function undoLayoutEditor", "function redoLayoutEditor"):
            self.assertIn(marker, html)

    def test_chart_controls_and_versioned_import(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for marker in ("bc-chart-area", "bc-chart-points", "bc-chart-grid", "function analyzeImportedSettings", "product:'LibreDisplay',format:2"):
            self.assertIn(marker, html)

    def test_native_renderers_and_accounts_ui_are_present(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for function_name in ("renderIntegrationPhotos", "renderIntegrationStatus", "renderIntegrationMap", "renderIntegrationMessages", "loadLocalAccounts"):
            self.assertIn(f"function {function_name}", html)
        self.assertIn('id="settings-users"', html)


if __name__ == "__main__":
    unittest.main()
