from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PRESETS=(ROOT/'app/js/appearance/presets.js').read_text(encoding='utf-8')
CSS=(ROOT/'app/css/dashboard.css').read_text(encoding='utf-8')
APPEARANCE=(ROOT/'app/js/appearance/index.js').read_text(encoding='utf-8')
CONFIG=(ROOT/'app/js/core/config.js').read_text(encoding='utf-8')


def test_layout_overhaul_stays_on_v1816_and_does_not_touch_readme_contract():
    assert (ROOT/'VERSION').read_text().strip()=='1.8.17'
    assert 'v1.8.17/scripts/install-one-line.sh' in (ROOT/'README.md').read_text()


def test_signature_presets_have_distinct_finished_dashboard_compositions():
    for key in ('photocalendar','glassboard','portraitwall','weekcolumns','photostory','mirrorminimal'):
        assert f"{key}:{{" in PRESETS
        assert f"preset-hero-{key.replace('photocalendar','photo-calendar').replace('glassboard','glass').replace('portraitwall','portrait').replace('weekcolumns','week').replace('photostory','story').replace('mirrorminimal','mirror')}" in CSS
    assert 'const layoutPresetHeroHtml=(key)=>' in PRESETS
    assert 'Photo Calendar Split' in PRESETS and 'Week Columns' in PRESETS
    assert 'Your morning brief' in PRESETS and 'Make today count.' in PRESETS


def test_preset_identity_is_saved_and_applied_to_fullscreen_preview():
    assert "layoutMode:'default',layoutSurfaceStyle:'clean',layoutPresetStyle:''" in CONFIG
    assert "cfg.layoutPresetStyle=/^[a-z0-9-]{1,40}$/" in CONFIG
    assert 'source.layoutPresetStyle=key;' in PRESETS
    assert "classList.toggle('layout-preset-'+name,name===presetStyle)" in APPEARANCE
    assert "'photocalendar','glassboard','portraitwall','weekcolumns','photostory','mirrorminimal'" in APPEARANCE


def test_each_signature_preset_has_fullscreen_visual_treatment():
    for key in ('photocalendar','glassboard','portraitwall','weekcolumns','photostory','mirrorminimal'):
        assert f'body.layout-preset-{key}' in CSS
    assert 'body.layout-preset-photocalendar::before' in CSS
    assert 'body.layout-preset-photocalendar #app::before' not in CSS
    assert 'body.layout-preset-weekcolumns #top-strip .event' in CSS
    assert 'body.layout-preset-photostory .layout-showcase-story' in CSS
    assert 'body.layout-preset-mirrorminimal #bg-a' in CSS


def test_gallery_uses_large_visual_previews_instead_of_tiny_wireframe_cards():
    assert '.layout-preset-card{grid-template-columns:1fr' in CSS
    assert '.layout-preset-stage{width:100%;aspect-ratio:16/9' in CSS
    assert 'thumb=hero||photo+' in PRESETS
    assert 'hero-month-grid' in PRESETS
    assert 'hero-week-cols' in PRESETS
