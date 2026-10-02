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
        self.assertIn('release-rollback.py', source)
        self.assertIn('snapshot --to-version "$NEW_VERSION"', source)
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
        self.assertIn('MANAGED_DIRS = ("app", "scripts", "tests", ".github", "assets")', docker_release)
        self.assertIn('Docker state in data/, media/, .env, backups/, and custom plugin', docker_release)
        self.assertIn("./scripts/docker-setup.sh update", html)

    def test_settings_exposes_calm_update_status(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        server = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        self.assertIn('id="health-software"', html)
        self.assertIn('id="settings-software-update"', html)
        self.assertIn('id="settings-update-badge"', html)
        self.assertIn('id="software-update-now"', html)
        self.assertIn('function checkSoftwareUpdate', html)
        self.assertIn('function startSoftwareUpdate', html)
        self.assertIn('/api/update-status', html)
        self.assertIn('/api/update-now', html)
        self.assertIn('/api/update-now', server)
        self.assertIn('/api/restore-points', html)
        self.assertIn('/api/restore-points', server)
        self.assertIn('create_restore_point', server)
        self.assertIn('portable-backup', html)
        self.assertIn('start_in_app_update', server)

    def test_native_installer_sets_up_narrow_update_helper(self):
        install = (ROOT / 'install.sh').read_text(encoding='utf-8')
        update = (ROOT / 'update.sh').read_text(encoding='utf-8')
        uninstall = (ROOT / 'uninstall.sh').read_text(encoding='utf-8')
        helper = (ROOT / 'scripts' / 'libredisplay-privileged').read_text(encoding='utf-8')
        self.assertIn('/usr/local/libexec/libredisplay-privileged', install)
        self.assertIn('NOPASSWD:', install)
        self.assertIn('probe, %s install-cli, %s reboot', install)
        self.assertIn('sudo -n "$PRIV_HELPER" probe', update)
        self.assertIn('sudo -n "$PRIV_HELPER" reboot', update)
        self.assertIn('/etc/sudoers.d/libredisplay-', uninstall)
        self.assertIn('case "${1:-}" in', helper)
        self.assertIn('install-cli)', helper)
        self.assertIn('reboot)', helper)

    def test_native_update_keeps_private_version_rollback_snapshots(self):
        update = (ROOT / "update.sh").read_text(encoding="utf-8")
        rollback = (ROOT / "scripts" / "release-rollback.py").read_text(encoding="utf-8")
        server = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn('Creating a safety backup and rollback snapshot', update)
        self.assertIn('record-update', update)
        self.assertIn('pre-update.ldbackup', rollback)
        self.assertIn('verify_snapshot', rollback)
        self.assertIn('/api/release-rollbacks', server)
        self.assertIn('/api/release-rollback', server)
        self.assertIn('id="settings-update-history"', html)
        self.assertIn('function startReleaseRollback', html)

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
        self.assertIn("const SETTINGS_TABS=['overview','weather','calendars','backgrounds','look','layout','family','integrations','system']", html)
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
        self.assertIn('<div id="setup" class="hidden" aria-hidden="true">', html)
        self.assertNotIn('function fetchWithTimeout', html)
        self.assertNotIn('fetchWithTimeout(', html)
        self.assertIn('id="settings-init-error"', html)
        self.assertIn('function showSettingsInitializationError', html)
        self.assertIn('switchSettingsTab(rememberedTab,false);', html)
        self.assertLess(html.index('switchSettingsTab(rememberedTab,false);'), html.index("document.getElementById('s-city').value=cfg.city||'';"))

        start = html.index('async function init(){')
        end = html.index('\n}\nconst dashboardInitPromise=init();', start)
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
        self.assertIn('\nconst dashboardInitPromise=init();', html)
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

    def test_remote_alert_sync_and_public_readme_hygiene(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        assets = ROOT / "assets"
        self.assertTrue((assets / ".gitkeep").is_file())
        self.assertEqual(sorted(p.name for p in assets.iterdir()), ['.gitkeep', 'libredisplay-promo.png'])
        self.assertIn('<img src="assets/libredisplay-promo.png"', readme)
        self.assertTrue((assets / 'libredisplay-promo.png').is_file())
        self.assertIn("if(setupOpen&&(!REMOTE_SETTINGS_MODE||settingsDirty||settingsPreviewMode))return;", html)
        self.assertIn("setTimeout(()=>{openSetup(false);setTimeout(ensureAlertMotionRunning,120);},0);", html)
        self.assertIn("remoteConfigPollTimer=setInterval(pollServerConfig,REMOTE_SETTINGS_MODE?5000:30000)", html)
        self.assertIn("liveEventSource.addEventListener('config',()=>pollServerConfig())", html)
        self.assertIn('\"$SRC_DIR/assets\"', (ROOT / 'install.sh').read_text(encoding='utf-8'))
        self.assertIn('\"$SRC_DIR/assets\"', (ROOT / 'update.sh').read_text(encoding='utf-8'))

    def test_v130_control_panel_settings_shell(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for marker in (
            'class="settings-workspace"',
            'class="settings-sidebar"',
            'class="settings-content"',
            'id="settings-page-title"',
            '<b>Home</b><small>Status, displays &amp; shortcuts</small>',
            '<b>Personalization</b><small>Themes, text &amp; accessibility</small>',
            "const SETTINGS_TAB_TITLES=",
            "function updateSettingsPageHeader(searchQuery='')",
            "title.textContent='Search results'",
            "grid-template-columns:252px minmax(0,1fr)",
        ):
            self.assertIn(marker, html)
        self.assertIn('@media(max-width:900px)', html)
        self.assertIn('aria-label="Settings navigation"', html)

    def test_v130_remote_arrange_uses_target_display_viewport(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        server = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        for marker in (
            'id="remote-layout-preview-shell"',
            'id="remote-layout-preview-frame"',
            "const LAYOUT_PREVIEW_MODE=PAGE_PARAMS.get('layoutPreview')==='1'",
            'function fetchRemoteLayoutTarget()',
            'function fitRemoteLayoutPreview()',
            'function displayViewportMetrics()',
            'layoutWidth,layoutHeight,viewportWidth,viewportHeight',
            "closeSetup(true);if(REMOTE_SETTINGS_MODE){setTimeout(openRemoteLayoutPreview,80);return;}",
            "notifyLayoutPreviewParent('saved')",
        ):
            self.assertIn(marker, html)
        self.assertIn('"viewportWidth": viewport_width', server)
        self.assertIn('"viewportHeight": viewport_height', server)
        self.assertIn('"screenWidth": screen_width', server)
        self.assertIn('"screenHeight": screen_height', server)

    def test_v131_display_fidelity_and_kiosk_hydration_recovery(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        server = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        start = (ROOT / "scripts" / "start.sh").read_text(encoding="utf-8")
        for marker in (
            "function displayViewportMetrics()",
            "layoutWidth,layoutHeight,viewportWidth,viewportHeight",
            "visualViewportWidth",
            "function requestFreshDisplayMetrics()",
            "action:'heartbeat'",
            "liveEventSource.addEventListener('heartbeat'",
            "function displayHydrationRecoveryNeeds()",
            "async function retryDisplayHydration(reason='scheduled')",
            "[5000,15000,35000,75000,150000]",
            "window.addEventListener('online'",
            "document.addEventListener('visibilitychange'",
        ):
            self.assertIn(marker, html)
        for marker in (
            '"layoutWidth": layout_width',
            '"layoutHeight": layout_height',
            '"visualViewportWidth": visual_viewport_width',
            '"visualViewportHeight": visual_viewport_height',
            'if action not in {"refresh", "reload", "heartbeat"}',
        ):
            self.assertIn(marker, server)
        self.assertIn('--disable-background-timer-throttling', start)
        self.assertIn('--disable-backgrounding-occluded-windows', start)
        self.assertIn('--disable-renderer-backgrounding', start)

    def test_v132_remote_layout_fresh_handshake_and_boot_polish(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        server = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        viewer = (ROOT / "scripts" / "viewer-setup.sh").read_text(encoding="utf-8")
        self.assertIn('<div id="setup" class="hidden" aria-hidden="true">', html)
        self.assertIn("function measureDashboardFontProbe(fontName)", html)
        self.assertIn("fontProbeWidth", html)
        self.assertIn("fontProbeHeight", html)
        self.assertIn("for(let attempt=0;attempt<18;attempt++)", html)
        self.assertIn("bestLayoutTargetDevice(rows,{freshSince:requestedAt-.15})", html)
        self.assertIn("Math.max(.1,Math.min(1,sw/tw,sh/th))", html)
        self.assertIn('"fontProbeWidth": font_probe_width', server)
        self.assertIn('"fontProbeHeight": font_probe_height', server)
        self.assertIn('fonts-liberation2 fonts-noto-core fonts-dejavu-core', viewer)

    def test_v133_remote_layout_preview_uses_same_origin_frame_route(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        server_source = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        self.assertIn("frame.src=`/layout-preview?endpoint=${encodeURIComponent(ACTIVE_ENDPOINT)}&layoutPreview=1", html)
        self.assertIn('if parsed.path == "/layout-preview":', server_source)
        self.assertIn('return urlparse(self.path).path == "/layout-preview"', server_source)
        self.assertIn('"SAMEORIGIN" if layout_preview else "DENY"', server_source)
        self.assertIn('frame_ancestors = "\'self\'" if layout_preview else "\'none\'"', server_source)
        self.assertNotIn("frame.src=`/dashboard.html?endpoint=${encodeURIComponent(ACTIVE_ENDPOINT)}&layoutPreview=1", html)

    def test_v134_remote_arrange_keeps_content_and_boxes_on_same_scale(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertNotIn("LAYOUT_PREVIEW_TARGET_FONT_WIDTH", html)
        self.assertNotIn("LAYOUT_PREVIEW_FONT_METRIC_SCALE", html)
        self.assertNotIn("refreshLayoutPreviewFontCalibration", html)
        self.assertIn("const s=((Number(pct)||100)/100);", html)
        self.assertIn('id="remote-layout-element-picker"', html)
        self.assertIn("function selectRemoteLayoutElement(key)", html)
        self.assertIn("function syncRemoteEditorHitTargets(scale)", html)
        self.assertNotIn("wall font calibrated", html)
        self.assertNotIn("targetFontProbeWidth=", html)


    def test_v135_remote_arrange_separates_target_canvas_from_laptop_editor_chrome(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for marker in (
            "body.layout-preview-embedded #layout-toolbar",
            "body.layout-preview-embedded #layout-properties",
            "body.remote-layout-proxy #layout-toolbar",
            "body.remote-layout-proxy #layout-properties",
            "function activateRemoteLayoutProxy()",
            "function deactivateRemoteLayoutProxy()",
            "function handleRemoteLayoutProxyEvent(e)",
            "function syncRemoteLayoutProxyUi()",
            "remoteLayoutProxySyncTimer=setInterval(syncRemoteLayoutProxyUi,140)",
            "--ld-editor-handle-size",
        ):
            self.assertIn(marker, html)
        self.assertNotIn("--ld-editor-ui-inv-scale", html)
        self.assertNotIn("body.layout-preview-embedded #layout-properties{top:var(", html)
        self.assertNotIn("body.custom-layout .wx-details {\n  width:auto !important;", html)
        self.assertIn("body.custom-layout .wx-details {\n  width:auto;", html)

    def test_v140_arrange_workspace_uses_explicit_target_canvas_and_safe_close(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for marker in (
            "let layoutSessionViewport=null;",
            "function layoutViewportSize()",
            "function refreshLayoutSessionViewport()",
            "['layoutWidth','layoutHeight','layout viewport']",
            "if(!row||!['local','viewer'].includes(String(row.mode||'')))return null;",
            "if(rawW<480||rawH<270||rawW>7680||rawH>4320)return null;",
            "Math.max(.1,Math.min(1,sw/tw,sh/th))",
            "body.remote-layout-proxy #remote-layout-preview-stage{top:112px;right:350px}",
            "frame.onload=null;frame.removeAttribute('src');frame.src='about:blank';",
            "layoutInspectorDragState=null;layoutSessionViewport=null;",
            "const hadSession=layoutEditorActive||!!layoutEditorOriginal;",
        ):
            self.assertIn(marker, html)
        self.assertIn("session!==remoteLayoutPreviewSession||!shell.classList.contains('show')", html)
        self.assertNotIn("severeOverflow=visual", html)
        self.assertNotIn("Math.max(.1,Math.min(4,sw/tw,sh/th))", html)
        self.assertNotIn("using 1920×1080 fallback", html)
        self.assertIn("Arrange unavailable · the wall display has not reported a valid viewport yet", html)
        self.assertNotIn("legacyBuiltInCollisionCount", html)
        self.assertIn("--ld-layout-fit-current", html)
        clock_custom = html.split("body.custom-layout #clock-block {", 1)[1].split("}", 1)[0]
        self.assertNotIn("padding:0 !important", clock_custom)

    def test_v143_arrange_round_trip_and_editability_contract(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for marker in (
            "function validStoredLayoutRect(r)",
            "function cloneLayoutRect(r)",
            "function layoutRectForDisplay(key,r)",
            "function customBlockRectForDisplay(block,r=block?.rect)",
            "function normalizeCustomBlockDraftRects(blocks)",
            "layoutCustomBlocksDraft=normalizeCustomBlockDraftRects",
            "entries.sort((a,b)=>(Number(b.r.w)*Number(b.r.h))-(Number(a.r.w)*Number(a.r.h)))",
            "daily:{selector:'#wx-forecast',label:'Daily Forecast'",
            "hourly:{selector:'#wx-hourly-block',label:'Hourly Forecast'",
        ):
            self.assertIn(marker, html)
        self.assertNotIn("layoutEditorRecoveredLegacy", html)
        self.assertNotIn("legacyBuiltInCollisionCount", html)

    def test_v143_remote_arrange_reopen_waits_for_hydration_and_persistence(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for marker in (
            "const dashboardInitPromise=init();",
            "if(LAYOUT_PREVIEW_MODE)dashboardInitPromise.then(()=>autoStartLayoutPreviewWhenReady())",
            "return persistCfgToServer(JSON.parse(JSON.stringify(cfg)))",
            "async function saveLayoutEditor()",
            "const persisted=await saveCfg();",
            "if(LAYOUT_PREVIEW_MODE&&!persisted?.ok)",
            "async function handleEmbeddedLayoutEditorAction(action)",
            "await pollServerConfig();",
        ):
            self.assertIn(marker, html)
        self.assertNotIn("setTimeout(()=>notifyLayoutPreviewParent('saved'),160)", html)
        self.assertNotIn("if(LAYOUT_PREVIEW_MODE)autoStartLayoutPreviewWhenReady();", html)

    def test_v143_weather_details_arrange_grid_tracks_rendered_cells(self):
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        for marker in (
            "function syncWeatherDetailsArrangeGrid(el)",
            "const count=el.querySelectorAll(':scope > .wx-detail').length",
            "const cols=weatherDetailColumnCount(count)",
            "if(details)syncWeatherDetailsArrangeGrid(details);",
        ):
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
