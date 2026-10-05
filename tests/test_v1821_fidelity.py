from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CSS=(ROOT/'app/css/dashboard.css').read_text()
EFFECTS=(ROOT/'app/js/weather/effects.js').read_text()
SCENERY=(ROOT/'app/js/weather/scenery.js').read_text()
README=(ROOT/'README.md').read_text()

def test_v1821_release_contract():
    assert (ROOT/'VERSION').read_text().strip()=='1.8.22'
    assert 'v1.8.22/scripts/install-one-line.sh' in README
    assert 'VERSION="1.8.22"' in (ROOT/'scripts/install-one-line.sh').read_text()

def test_dog_direction_and_hazard_shelter_are_explicit():
    assert 'function dogFace(node,dx)' in SCENERY
    assert "node.dataset.direction=right?'right':'left'" in SCENERY
    assert '.weather-fx-dog-v2.dog-facing-left .dogv2-facing-stage{transform:scaleX(-1)}' in CSS
    assert "hazardMode==='flood'" in SCENERY
    assert "dog-state-shelter" in CSS
    assert ".weather-fx-dog-v2.dog-facing-left .dogv2-ball" in CSS
    assert "ld1822DogBall" in CSS

def test_naturescape_respects_dangerous_weather():
    assert "hazardKeys=hazards.map" in EFFECTS
    assert "if(hazardKeys.includes('flood'))" in EFFECTS
    assert "['tornado','tropical','storm','fire']" in EFFECTS
    assert "appendDogCompanion(frag,source,safeCounts" in EFFECTS

def test_cloudy_is_cloud_mass_not_fog_layer():
    assert "condition==='cloud'?12" in EFFECTS
    assert '.weather-fx-cloud .weather-fx-cloud-mass{' in CSS
    assert 'filter:opacity(var(--weather-cloud-opacity,1))!important' in CSS
    assert 'weather-fx-fog-bank' in CSS

def test_severe_visuals_have_recognizable_structures():
    for token in ['hazard-tornado-condensation','hazard-tornado-suction','hazard-hurricane-shield','hazard-fire-brushline','hazard-fire-ground']:
        assert token in EFFECTS or token in CSS
    assert '@keyframes ld1821HurricaneShield' in CSS
    assert '@keyframes ld1821BrushFire' in CSS

def test_fullscreen_hazards_overscan_edges():
    assert '#weather-effects-overlay .weather-fx-hazard{inset:-3vh -3vw!important' in CSS
    assert '.weather-fx-hazard-winter{inset:-7vh -8vw!important' in CSS
    assert '.hazard-blizzard-gust{left:-42vw;width:194vw' in CSS
