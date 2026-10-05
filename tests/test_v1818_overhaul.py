from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'app/dashboard.html').read_text(encoding='utf-8')
CFG=(ROOT/'app/js/core/config.js').read_text(encoding='utf-8')
SETTINGS=(ROOT/'app/js/settings/index.js').read_text(encoding='utf-8')
BG=(ROOT/'app/js/backgrounds/index.js').read_text(encoding='utf-8')
FX=(ROOT/'app/js/weather/effects.js').read_text(encoding='utf-8')
CSS=(ROOT/'app/css/dashboard.css').read_text(encoding='utf-8')
PRESETS=(ROOT/'app/js/appearance/presets.js').read_text(encoding='utf-8')
README=(ROOT/'README.md').read_text(encoding='utf-8')

def test_v1818_version_and_readme_scope():
    assert (ROOT/'VERSION').read_text().strip()=='1.8.21'
    assert 'v1.8.21/scripts/install-one-line.sh' in README
    assert 'VERSION="1.8.21"' in (ROOT/'scripts/install-one-line.sh').read_text()

def test_offline_background_reserve_is_one_user_setting():
    assert 'id="s-bg-offline-reserve"' in HTML
    assert 's-bg-offline-cache-count' not in HTML
    assert 's-bg-offline-cache-max-mb' not in HTML
    assert 's-bg-offline-cache"' not in HTML
    assert 'backgroundReserveCandidateLimit' in BG
    assert "Math.ceil(cfg.backgroundOfflineCacheMaxMb/1.5)" in CFG
    assert 'normal 10-image recovery cache remains available' in SETTINGS

def test_dog_companion_is_optional_breed_aware_and_animated():
    assert 'id="settings-naturescape-dog"' in HTML
    assert 'id="s-weather-dog-companion"' in HTML
    for breed in ('labrador','golden','german-shepherd','border-collie','beagle','corgi','dachshund','french-bulldog','poodle','husky','shiba','great-dane'):
        assert f'value="{breed}"' in HTML
        assert f'.weather-fx-dog-{breed}' in CSS
    assert 'weatherDogCompanion:false' in CFG
    assert 'function appendDogCompanion' in FX
    assert 'dog-ball' in FX and 'dog-sleep' in FX and 'weather-fx-dog-bird-curious' in FX
    assert '@keyframes ldDogLife' in CSS and '@keyframes ldDogBall' in CSS and '@keyframes ldDogSleep' in CSS

def test_alert_scenes_have_visible_family_specific_renderers():
    for cls in ('hazard-tornado-vapor','hazard-hurricane-band','hazard-tropical-rain','hazard-storm-rain','hazard-storm-bolt','hazard-blizzard-gust','hazard-blizzard-ground','hazard-fire-ember','hazard-flood-depth'):
        assert cls in FX
        assert f'.{cls}' in CSS
    assert 'weather-fx-hazard-heat-fire-fire' in CSS
    assert "?'fire':'heat'" in FX
    assert 'vaporCount=constrained?11:19' in FX
    assert 'constrained?28:68' in FX

def test_signature_layouts_receive_balance_refinement_without_replacing_arrange():
    assert 'Signature preset balance pass' in CSS
    assert "calendar:{x:.425,y:.045,w:.535,h:.89}" in PRESETS
    assert "calendar:{x:.10,y:.43,w:.80,h:.32}" in PRESETS
    assert "calendar:{x:.025,y:.125,w:.95,h:.72}" in PRESETS
    assert 'layoutPresetStyle' in PRESETS
