from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def test_release_version_is_1826():
    assert (ROOT / "VERSION").read_text(encoding="utf-8").strip() == "1.8.27"
    assert 'v1.8.27/scripts/install-one-line.sh' in read("README.md")
    assert 'VERSION="1.8.27"' in read("scripts/install-one-line.sh")
    assert "const DASHBOARD_BUILD = '1.8.27';" in read("app/js/core/bootstrap.js")


def test_first_run_wizard_auto_scales_for_high_resolution_and_4k():
    js = read("app/js/onboarding/index.js")
    css = read("app/css/dashboard.css")
    for token in [
        "function wizardPhysicalViewport()",
        "function wizardDisplayScale()",
        "function applyWizardDisplayScale()",
        "long>=3200&&short>=1700",
        "long>=2300&&short>=1250",
        "cfg.onboardingComplete!==true",
        "data-first-run-auto-scale",
    ]:
        assert token in js or token in css
    assert 'data-wizard-display-scale="4k"' in css
    assert 'data-wizard-display-scale="highres"' in css
    assert 'font-size:30px' in css
    assert 'font-size:19px' in css


def test_cross_device_exports_include_portable_background_snapshot():
    backup = read("app/js/appearance/backup.js")
    portable = read("app/js/backgrounds/portable.js")
    app = read("app/js/app.js")
    html = read("app/dashboard.html")
    assert "format:3" in backup
    assert "kind:'portable-backup',format:2" in backup
    assert "backgroundSnapshot" in backup
    assert "createPortableBackgroundSnapshot" in backup
    assert "restorePortableBackgroundSnapshot" in backup
    assert "![1,2].includes(Number(raw.format))" in backup
    assert "28 MB safety limit" in backup
    for token in [
        "PORTABLE_BACKGROUND_MAX_BYTES=12*1024*1024",
        "libredisplay-last-background-v1",
        "libredisplay_last_background_v2",
        "cache.put(assetUrl,new Response",
        "sourceKey=portableBackgroundsApi.backgroundSourceFingerprint(sourceCfg)",
    ]:
        assert token in portable
    assert '"/js/backgrounds/portable.js"' in app
    assert '<link rel="modulepreload" href="/js/backgrounds/portable.js">' in html


def test_pi4_class_gets_real_visual_budget_instead_of_full_desktop_path():
    perf = read("app/js/core/performance.js")
    effects = read("app/js/weather/effects.js")
    scenery = read("app/js/weather/scenery.js")
    css = read("app/css/dashboard.css")
    for token in [
        "armLinux",
        "piClass",
        "cores&&cores<=4",
        "tier:piClass?'pi4'",
        "particleScale:.34",
        "wildlifeScale:.42",
        "targetFrameMs:40",
    ]:
        assert token in perf
    assert "performanceApi.visualPerformanceBudget()" in effects
    assert "budget.particleScale" in effects
    assert "budget.wildlifeScale" in effects
    assert "frameInterval=Math.max(14,Number(budget.targetFrameMs)||16)" in scenery
    assert "holidayBudget.holidayScale" in scenery
    assert "v1.8.27 — Pi 4 compositor/paint reductions without disabling the feature suite" in css
    assert "html.ld-constrained-device #weather-effects-overlay" in css


def test_portable_background_module_stays_split_below_architecture_limit():
    index_lines = len(read("app/js/backgrounds/index.js").splitlines())
    portable_lines = len(read("app/js/backgrounds/portable.js").splitlines())
    assert index_lines <= 550
    assert portable_lines < 100
