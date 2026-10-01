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
        self.assertIn(f"/archive/refs/tags/v{version}.zip", readme)
        self.assertIn("Gubna-Tech/LibreDisplay", readme)
        self.assertIn('REPOSITORY = "Gubna-Tech/LibreDisplay"', cli)
        self.assertIn("repos/Gubna-Tech/LibreDisplay/releases/latest", server)

    def test_public_quickstart_matches_github_tag_zip_layout(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("unzip -q /tmp/LibreDisplay.zip -d ~/LibreDisplay-Setup", readme)
        self.assertIn(f"cd ~/LibreDisplay-Setup/LibreDisplay-{(ROOT / 'VERSION').read_text(encoding='utf-8').strip()}", readme)
        self.assertFalse((ROOT / "SECURITY.md").exists())
        self.assertIn("Remote access, accounts, and privacy", readme)

    def test_readme_commands_are_copy_friendly_and_license_is_linked(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        bash_blocks = re.findall(r"```bash\n(.*?)\n```", readme, re.S)
        self.assertTrue(bash_blocks)
        for block in bash_blocks:
            commands = [line for line in block.splitlines() if line.strip()]
            self.assertEqual(len(commands), 1)
        self.assertIn("[MIT License](LICENSE)", readme)
        self.assertTrue((ROOT / "LICENSE").is_file())

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
        self.assertIn('archive/refs/tags/v{latest}.zip', cli)
        self.assertIn('release_root = release_dir', cli)
        self.assertIn('safe_extract', cli)

    def test_v111_update_handles_chromium_runtime_links_before_legacy_backup(self):
        update = (ROOT / "update.sh").read_text(encoding="utf-8")
        backup = (ROOT / "scripts" / "server-backup.py").read_text(encoding="utf-8")
        self.assertIn('pkill -f -- "--user-data-dir=$DATA_DIR/chromium"', update)
        self.assertIn('for name in SingletonCookie SingletonLock SingletonSocket', update)
        self.assertLess(update.index("Stopping LibreDisplay and Chromium"), update.index("Creating a safety backup"))
        self.assertIn('CHROMIUM_RUNTIME_LINKS = {"SingletonCookie", "SingletonLock", "SingletonSocket"}', backup)
        self.assertIn('skip_symlink_rel=chromium_runtime_links', backup)

    def test_native_install_does_not_require_optional_dotfiles(self):
        install = (ROOT / "install.sh").read_text(encoding="utf-8")
        update = (ROOT / "update.sh").read_text(encoding="utf-8")
        for source in (install, update):
            self.assertIn('[ -f "$SRC_DIR/$file" ] && cp "$SRC_DIR/$file" "$INSTALL_DIR/$file"', source)
            self.assertNotIn('for file in .env.example .gitignore Dockerfile', source)
        self.assertNotIn('"$INSTALL_DIR/.env.example" "$INSTALL_DIR/.gitignore"', install)
        self.assertNotIn('"$INSTALL_DIR/.env.example" "$INSTALL_DIR/.gitignore"', update)
        self.assertIn('is_incomplete_first_install', install)
        self.assertIn("Removing an incomplete previous LibreDisplay installation", install)

    def test_docker_image_carries_release_version(self):
        dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn("COPY --chown=libredisplay:libredisplay VERSION /VERSION", dockerfile)


    def test_v120_docker_update_path_preserves_state_and_health_checks(self):
        docker_setup = (ROOT / "scripts" / "docker-setup.sh").read_text(encoding="utf-8")
        docker_release = (ROOT / "scripts" / "docker-release.py").read_text(encoding="utf-8")
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        env_example = (ROOT / ".env.example").read_text(encoding="utf-8")
        self.assertIn("./scripts/docker-setup.sh update", docker_setup)
        self.assertIn("Stopping LibreDisplay before the safety backup", docker_setup)
        self.assertLess(docker_setup.index("Stopping LibreDisplay before the safety backup"), docker_setup.index("Creating a safety backup before Docker source files change"))
        self.assertIn("wait_for_healthy", docker_setup)
        self.assertIn("rollback --workspace /workspace", docker_setup)
        for key in ("DASHBOARD_UID", "DASHBOARD_GID", "DASHBOARD_REMOTE_ENABLED", "DASHBOARD_REMOTE_NETWORKS", "DASHBOARD_ALLOWED_HOSTS", "DASHBOARD_CACHE_MAX_BYTES"):
            self.assertIn(f': "${{{key}:=', docker_setup)
        self.assertIn("DASHBOARD_CACHE_MAX_BYTES=536870912", env_example)
        self.assertIn('MANAGED_DIRS = ("app", "scripts", "tests", ".github")', docker_release)
        self.assertIn('Docker state in data/, media/, .env, backups/, and custom plugin', docker_release)
        self.assertIn("./scripts/docker-setup.sh update", html)

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

    def test_v110_calendar_background_and_element_size_fixes(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn("fetchCal(c,i,{preferFormUrl:true})", html)
        self.assertIn("function testSingleCalendarSource", html)
        self.assertIn("const GOOGLE_PHOTOS_MAX_ITEMS=1000", html)
        self.assertNotIn("pages<20", html)
        self.assertIn('id="settings-backgrounds"', html)
        self.assertNotIn('id="settings-calendar-options"', html)
        self.assertNotIn('id="settings-background-options"', html)
        self.assertIn('id="layout-toolbar-scale"', html)
        self.assertIn("layoutContentScale", html)
        self.assertIn("_contentScale", html)

    def test_v122_google_photos_pagination_is_csp_safe(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn("function extractGoogleInitialPageToken", html)
        self.assertIn("let token=extractGoogleInitialPageToken(html)", html)
        self.assertIn("Google Photos provided another page", html)
        self.assertNotIn("Function('\"use strict\";return (", html)
        self.assertEqual(html.count("</script>"), 1)
        self.assertIn("text.indexOf(');</scr'+'ipt>'", html)

    def test_v125_restores_v121_known_good_dashboard_hydration_path(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn('<div id="setup">', html)
        self.assertNotIn('function fetchWithTimeout', html)
        self.assertNotIn('fetchWithTimeout(', html)
        self.assertIn('id="settings-init-error"', html)
        self.assertIn('function showSettingsInitializationError', html)
        self.assertIn('switchSettingsTab(rememberedTab,false);', html)
        self.assertLess(html.index('switchSettingsTab(rememberedTab,false);'), html.index("document.getElementById('s-city').value=cfg.city||'';"))

        start = html.index('async function init(){')
        end = html.index('\n}\ninit();', start)
        init = html[start:end]
        expected_order = [
            "await loadSessionInfo();",
            "if(SESSION_ROLE==='owner')await loadLocalAccounts();",
            "await loadIntegrations();",
            "await loadHousehold(false);",
            "await loadCfg();",
            "await loadProfiles();",
            "if(!READ_ONLY_DISPLAY_MODE)await loadScenes();",
            "applyUiCustomization(cfg);",
            "renderCalendar([]);",
            "applySettings();",
            "startLiveDisplayConnection();",
            "startRemoteConfigPolling();",
        ]
        positions = [init.index(marker) for marker in expected_order]
        self.assertEqual(positions, sorted(positions))
        self.assertNotIn('Promise.allSettled', init)
        self.assertIn('\ninit();', html)
        self.assertNotIn('init().catch(', html)

        apply_start = html.index('function applySettings(){')
        apply_end = html.index('\n}\n\n\n// Browser cursor fallback.', apply_start)
        apply_body = html[apply_start:apply_end]
        for marker in ('fetchWeather();', 'fetchWeatherAlerts();', 'loadCalendars();'):
            self.assertIn(marker, apply_body)
        self.assertIn("loadPhotos(cfg.photosUrl);", apply_body)

    def test_v121_layout_editor_customization_controls(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn('id="settings-settings-button"', html)
        for marker in ('s-cog-position', 's-cog-opacity', 's-cog-size', 's-cog-label'):
            self.assertIn(marker, html)
        self.assertIn('id="layout-properties"', html)
        self.assertIn('layoutElementStyle', html)
        self.assertIn('function setSelectedLayoutStyle', html)
        self.assertIn('function placeSelectedLayoutBlock', html)
        self.assertIn('function applyBuiltInElementStyles', html)
        self.assertIn('existing._hAlign', html)
        for direction in ('nw', 'ne', 'sw', 'se'):
            self.assertIn(f'data-resize="{direction}"', html)


    def test_v126_layout_inspector_subsections_and_mobility(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for marker in (
            'id="layout-properties-drag-handle"',
            'id="layout-part-picker"',
            'id="layout-toolbar-scale-number"',
            'All event text',
            'layoutPartStyle',
            'const LAYOUT_PART_DEFS=',
            'const CUSTOM_LAYOUT_PART_DEFS=',
            'function setSelectedPartFineStyle',
            'function resetSelectedStyleScope',
            'function initLayoutInspectorDrag',
            'function buildCustomLayoutPartCss',
            'LAYOUT_INSPECTOR_POS_KEY',
            '_partStyles',
        ):
            self.assertIn(marker, html)
        self.assertIn("cal*ps('calendar','eventText')*ps('calendar','eventTitle')", html)
        self.assertIn("cal*ps('calendar','eventText')*ps('calendar','eventTime')", html)
        self.assertIn("cal*ps('calendar','dayNumber')", html)
        self.assertNotIn("cal*ps('calendar','eventText')*ps('calendar','dayNumber')", html)
        self.assertIn("document.addEventListener('pointermove'", html)
        self.assertIn("document.addEventListener('pointerup'", html)
        self.assertIn("max-height:calc(100vh - 88px)", html)
        self.assertEqual(html.count("</script>"), 1)

    def test_v127_alert_runtime_state_and_context_help(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        start = html.index("function previewAlertMotionSpeed(value){")
        end = html.index("\n}\n\nfunction handleAlertMotionChange", start)
        preview = html[start:end]
        self.assertNotIn("syncAlertRuntimeStateFromForm", preview)
        self.assertIn("if(alertRuntimeState)alertRuntimeState.speed=speed;", preview)
        self.assertIn('id="context-help-popover"', html)
        self.assertIn('class="help-tip"', html)
        self.assertIn("function initContextHelp", html)
        self.assertIn("contextHelpPinned", html)
        self.assertIn("alertRuntimeState=null;\n      window.__uiPreviewCfg=null;\n      applySettings();", html)
        self.assertIn("saveCfg();setAppearanceForm(cfg);applySettings();", html)
        self.assertIn("saveCfg();alertRuntimeState=null;window.__uiPreviewCfg=null;applySettings();openSetup(false)", html)
        self.assertIn("ensureCfgDefaults();cfg._savedAt=Date.now();", html)
        self.assertIn("persistCfgToServer(JSON.parse(JSON.stringify(cfg)));", html)
        self.assertIn("if(e.key==='Escape'&&activeContextHelpTip)", html)

    def test_v128_settings_preview_and_navigation_cleanup(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for marker in (
            'id="s-preview-button"',
            'id="settings-preview-return"',
            'function previewDashboardFromSettings',
            'function returnToSettingsPreview',
            'function requestCloseSetup',
            "settingsPreviewMode=true;",
            "syncAlertRuntimeStateFromForm();",
            "setTimeout(()=>restartAlertScroller(),100);",
            "SETTINGS_SEARCH_ALIASES",
            "settingsSectionSearchText",
            "calander",
            "Unsaved changes · preview only",
            "aria-expanded",
        ):
            self.assertIn(marker, html)
        self.assertNotIn("Click to collapse or expand this section", html)
        self.assertIn('onclick="requestCloseSetup()"', html)
        self.assertIn("if(e.key==='Escape'&&settingsPreviewMode)", html)
        self.assertIn("if(settingsDirty&&!confirm('Discard unsaved changes?", html)
        self.assertIn("Preview test alerts full screen", html)

    def test_v129_alert_lifecycle_and_settings_readability(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for marker in (
            "function settingsOverlayOpen()",
            "if(settingsOverlayOpen()||settingsPreviewMode)",
            "return savedAlertRuntimeState();",
            "function ensureAlertMotionRunning()",
            "function previewAlertTestFullScreen()",
            "Preview test alerts full screen",
            'id="s-settings-ui-size"',
            "settingsUiSize:'standard'",
            "setup.dataset.uiSize",
            "accessibility readable readability larger large text",
        ):
            self.assertIn(marker, html)
        self.assertIn('role="status" aria-live="polite"', html)
        self.assertIn("document.addEventListener('visibilitychange'", html)
        self.assertIn("window.addEventListener('resize',()=>setTimeout(ensureAlertMotionRunning,120));", html)

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
