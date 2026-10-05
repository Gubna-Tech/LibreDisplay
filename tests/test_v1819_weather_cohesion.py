from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'app/dashboard.html').read_text(encoding='utf-8')
FX=(ROOT/'app/js/weather/effects.js').read_text(encoding='utf-8')
CSS=(ROOT/'app/css/dashboard.css').read_text(encoding='utf-8')
CFG=(ROOT/'app/js/core/config.js').read_text(encoding='utf-8')
README=(ROOT/'README.md').read_text(encoding='utf-8')

def test_v1819_release_and_readme_scope():
    assert (ROOT/'VERSION').read_text().strip()=='1.8.20'
    assert 'v1.8.20/scripts/install-one-line.sh' in README
    assert 'VERSION="1.8.20"' in (ROOT/'scripts/install-one-line.sh').read_text()

def test_weather_and_severe_preview_have_different_semantics():
    assert 'Normal weather preview' in HTML
    assert 'Preview behind Settings' in HTML
    assert 'Severe weather preview' in HTML
    assert 'Launch full-screen severe preview' in HTML
    ordinary=FX[FX.index('function previewWeatherTestFullScreen'):FX.index('function weatherEffectRuntimeState')]
    assert 'previewDashboardFromSettings' not in ordinary
    severe_start=FX.index('function previewWeatherHazardTestFullScreen')
    severe=FX[severe_start:severe_start+1800]
    assert 'previewDashboardFromSettings' in severe

def test_severe_weather_uses_realistic_family_specific_structures():
    for cls in ('hazard-tornado-core','hazard-tornado-vapor','hazard-hurricane-eye','hazard-hurricane-band','hazard-storm-shelf','hazard-storm-downburst','hazard-blizzard-veil','hazard-fire-flame','hazard-fire-smoke','hazard-heat-sun'):
        assert cls in FX
        assert f'.{cls}' in CSS
    assert '--blizzard-x' in FX and 'left:var(--blizzard-x)' in CSS
    assert "heat:{event:'Excessive Heat Warning'" in FX
    assert "fire:{event:'Red Flag Warning'" in FX

def test_winter_snowmen_are_season_and_climate_aware():
    assert 's-weather-season-snowmen' in HTML
    assert 'weatherSeasonSnowmen:true' in CFG
    assert 'snowCapable' in FX and "condition==='snow'" in FX
    assert 'function appendWinterSnowmen' in FX
    assert '.weather-fx-snowman' in CSS
