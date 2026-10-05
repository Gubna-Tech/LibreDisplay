from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FX = (ROOT / 'app/js/weather/effects.js').read_text(encoding='utf-8')
CSS = (ROOT / 'app/css/dashboard.css').read_text(encoding='utf-8')
README = (ROOT / 'README.md').read_text(encoding='utf-8')


def test_v1817_version_and_pinned_fresh_install_reference():
    assert (ROOT / 'VERSION').read_text(encoding='utf-8').strip() == '1.8.22'
    assert 'v1.8.22/scripts/install-one-line.sh' in README
    assert 'VERSION="1.8.22"' in (ROOT / 'scripts/install-one-line.sh').read_text(encoding='utf-8')


def test_cloudy_weather_uses_defined_clouds_instead_of_fog_blur():
    assert "condition==='cloud'?30:32" in FX
    block = CSS[CSS.rfind('/* v1.8.17 stabilization:'):]
    assert '#weather-effects-overlay.weather-fx-cloud.show::before' in block
    assert 'filter:none!important' in block
    assert '.weather-fx-cloud .weather-fx-cloud-mass{' in block
    assert '.weather-fx-cloud .weather-fx-overcast-deck{' in block
    overcast = block[block.find('.weather-fx-cloud .weather-fx-overcast-deck{'):]
    assert 'filter:none' in overcast.split('}', 1)[0]
    assert 'radial-gradient' in overcast.split('}', 1)[0]


def test_naturescape_can_render_even_if_base_weather_layer_is_disabled():
    assert 'const seasonalOn=' in FX
    assert '(allowed||hazardOn||seasonalOn)' in FX
    assert '!state.allowed&&!state.seasonalOn' in FX
    assert '#weather-effects-overlay .weather-fx-seasonal{z-index:2}' in CSS


def test_signature_preset_tints_do_not_cover_weather_or_wildlife_overlay():
    keys = ('photocalendar','glassboard','portraitwall','weekcolumns','photostory','mirrorminimal')
    for key in keys:
        assert f'body.layout-preset-{key}::before' in CSS
        assert f'body.layout-preset-{key} #app::before' not in CSS


def test_clouds_and_wildlife_keep_distinct_layer_order():
    assert '.weather-fx-cloud-mass{' in CSS
    assert '#weather-effects-overlay .weather-fx-seasonal{z-index:2}' in CSS
    assert "p.className=`weather-fx-cloud-mass" in FX
    assert "child.classList.contains('weather-fx-bird')" not in FX  # renderer must not depend on DOM re-detection
