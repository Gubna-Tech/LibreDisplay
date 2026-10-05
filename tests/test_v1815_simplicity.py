from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'app/dashboard.html').read_text()
CSS=(ROOT/'app/css/dashboard.css').read_text()
CONFIG=(ROOT/'app/js/core/config.js').read_text()
PERF=(ROOT/'app/js/core/performance.js').read_text()
SHARED=(ROOT/'app/js/core/shared.js').read_text()
SETTINGS=(ROOT/'app/js/settings/index.js').read_text()
ACTIONS=(ROOT/'app/js/settings/actions.js').read_text()
APPEARANCE=(ROOT/'app/js/appearance/index.js').read_text()
PRESETS=(ROOT/'app/js/appearance/presets.js').read_text()
BACKGROUNDS=(ROOT/'app/js/backgrounds/index.js').read_text()
BOOTSTRAP=(ROOT/'scripts/install-one-line.sh').read_text()
README=(ROOT/'README.md').read_text()


def test_v1815_version_and_pinned_one_command_quick_start():
    assert (ROOT/'VERSION').read_text().strip()=='1.8.26'
    command='bash -c "$(curl -fsSL https://raw.githubusercontent.com/Gubna-Tech/LibreDisplay/v1.8.26/scripts/install-one-line.sh)"'
    assert command in README
    assert 'v1.8.14/scripts/install-one-line.sh' not in README
    assert 'VERSION="1.8.26"' in BOOTSTRAP
    assert 'archive/refs/tags/v$VERSION.zip' in BOOTSTRAP


def test_one_command_installer_is_fresh_install_only_and_archive_safe():
    assert 'INSTALL_DIR="$HOME/libredisplay"' in BOOTSTRAP
    assert '[ -d "$INSTALL_DIR" ] || [ -e "$INSTALL_DIR" ]' in BOOTSTRAP
    assert 'libredisplay update' in BOOTSTRAP
    assert "if path.is_absolute() or '..' in path.parts:" in BOOTSTRAP
    assert "(root/'VERSION').read_text" in BOOTSTRAP
    assert 'sh ./install.sh "$@"' in BOOTSTRAP
    assert 'exec sh ./install.sh' not in BOOTSTRAP


def test_lightweight_mode_is_non_destructive_runtime_override():
    assert 'lightweightModeEnabled:false' in CONFIG
    assert 'function effectiveVisualConfig(source)' in PERF
    assert 'source.lightweightModeEnabled!==true)return source' in PERF
    for setting in ['weatherAnimationsEnabled:false','weatherWidgetAnimations:false','weatherFullscreenEffects:false','weatherSeasonalEffects:false','weatherHazardEffects:false','backgroundMotionEnabled:false','photoPreload:false','bgBlurPx:0']:
        assert setting in PERF
    assert "getModule('performance').effectiveVisualConfig(source)" in SHARED
    assert 'const runtimeCfg=performance.effectiveVisualConfig(cfg)' in SETTINGS
    assert 'cfg.weatherFullscreenEffects=false' not in ACTIONS
    assert 'cfg.backgroundMotionEnabled=false' not in ACTIONS


def test_lightweight_mode_has_settings_and_quick_toggle_and_restores_by_flag():
    assert 'id="settings-lightweight"' in HTML
    assert 'id="s-lightweight-mode"' in HTML
    assert 'id="quick-lightweight-toggle"' in HTML
    assert 'function setLightweightMode(enabled)' in ACTIONS
    assert 'cfg.lightweightModeEnabled=!!enabled' in ACTIONS
    assert 'configApi.saveCfg()' in ACTIONS
    assert 'settingsApi().applySettings()' in ACTIONS
    assert 'quickAccessToggleLightweight' in ACTIONS
    assert '.quick-access-action.active' in CSS
    assert 'body.ld-lightweight-mode' in CSS


def test_moving_background_and_preload_paths_use_effective_visual_config():
    assert "fetchRemoteText,escHtml,scaledClamp,resilientFetch,uiCfg" in BACKGROUNDS
    assert 'uiCfg().photoPreload' in BACKGROUNDS
    assert 'uiCfg().backgroundMotionEnabled===false' in BACKGROUNDS
    assert 'runtimeCfg.backgroundMotionEnabled' in SETTINGS


def test_new_wallboard_presets_cover_photo_glass_portrait_agenda_and_minimal_styles():
    for key,name in [
        ('photocalendar','Photo Calendar Split'),
        ('glassboard','Glass Home Board'),
        ('portraitwall','Portrait Calendar Canvas'),
        ('weekcolumns','Week Columns'),
        ('photostory','Photo Story Board'),
        ('mirrorminimal','Minimal Mirror'),
    ]:
        assert f"{key}:{{name:'{name}'" in PRESETS
    assert "surface:'glass'" in PRESETS
    assert "surface:'minimal'" in PRESETS
    assert "surface:'photo'" in PRESETS
    assert 'source.layoutSurfaceStyle=preset.surface' in PRESETS


def test_layout_finish_selector_and_original_surface_styles_are_wired():
    assert 'id="s-layout-surface"' in HTML
    for value in ['clean','glass','minimal','photo']:
        assert f'value="{value}"' in HTML
    assert "['clean','glass','minimal','photo']" in APPEARANCE
    assert "classList.toggle('layout-surface-'+name" in APPEARANCE
    assert 'body.custom-layout.layout-surface-glass' in CSS
    assert 'body.custom-layout.layout-surface-minimal' in CSS
    assert 'body.custom-layout.layout-surface-photo' in CSS
    assert 'layoutSurfaceStyle' in CONFIG


def test_v1815_app_does_not_depend_on_magicmirror_or_dakboard_code():
    app_text='\n'.join(p.read_text(errors='ignore') for p in (ROOT/'app').rglob('*') if p.is_file() and p.suffix in {'.js','.py','.html','.css'})
    lower=app_text.lower()
    assert 'magicmirror' not in lower
    assert 'dakboard' not in lower
