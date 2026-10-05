from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
EFFECTS=(ROOT/'app/js/weather/effects.js').read_text(encoding='utf-8')
SCENERY=(ROOT/'app/js/weather/scenery.js').read_text(encoding='utf-8')
CSS=(ROOT/'app/css/dashboard.css').read_text(encoding='utf-8')


def test_v1823_release_and_readme_scope():
    assert (ROOT/'VERSION').read_text().strip()=='1.8.27'
    readme=(ROOT/'README.md').read_text(encoding='utf-8')
    assert 'v1.8.27/scripts/install-one-line.sh' in readme
    assert 'pinned **v1.8.27** release' in readme


def test_world_state_is_single_coordination_contract():
    for token in ['function weatherWorldState(', 'function weatherWorldAdjustedCounts(', 'function weatherWorldClassList(']:
        assert token in EFFECTS
    assert 'world=weatherWorldState(data,source,hazards)' in EFFECTS
    assert 'seasonalParticleCount(season,source,performanceApi.frontendCapabilities().constrained,data,world)' in EFFECTS
    assert 'buildParticles(host,condition,count,source,data,season,seasonalCounts,state.world)' in EFFECTS
    assert 'state.world?.signature' in EFFECTS


def test_ecosystem_coordinates_animals_weather_hazards_and_holidays():
    assert "if(condition==='storm')addDogKey('storm')" in EFFECTS
    assert "addDogKey('rain')" in EFFECTS and "addDogKey('snow')" in EFFECTS and "addDogKey('fog')" in EFFECTS
    assert "addDogKey('fireworks')" in EFFECTS
    assert "if(world.mode==='shelter')zeroWild()" in EFFECTS
    assert "if(keys.has('flood'))" in EFFECTS
    assert "if(keys.has('fire'))" in EFFECTS
    assert "if(keys.has('winter'))" in EFFECTS
    assert "if((world.holidayKeys||[]).some(k=>k==='new-year'||k==='independence'))" in EFFECTS
    assert "sceneryApi.appendDogCompanion(frag,source,safeCounts,weatherReducedMotionActive(source),ecosystem.dogKeys)" in EFFECTS
    assert "sceneryApi.appendHolidayOverlays(frag,source,data,constrained,ecosystem)" in EFFECTS


def test_dog_world_behavior_treats_weather_as_context_not_only_alerts():
    assert "keys.has('storm')||keys.has('winter')" in SCENERY
    for token in ["keys.has('rain')","keys.has('snow')","keys.has('fog')","keys.has('heat')","keys.has('cold')","keys.has('fireworks')"]:
        assert token in SCENERY
    assert "['wander','ball','dig','roll','bird','inspect']" in SCENERY
    assert "['rest','sit','sleep','watch']" in SCENERY
    assert "row[1]*=2.05" in SCENERY


def test_holiday_and_hazard_visual_priority_is_explicit():
    assert 'holiday-overlay-world-${world?.holidayMode||\'normal\'}' in SCENERY
    assert '--holiday-world-opacity' in SCENERY
    assert '#weather-effects-overlay.weather-world-shelter .weather-fx-hazard{z-index:16}' in CSS
    assert '#weather-effects-overlay.weather-world-shelter .holiday-overlay{opacity:.28' in CSS
    assert '#weather-effects-overlay.weather-world-cautious .holiday-overlay{opacity:.62' in CSS
    assert 'weather-world-surface-flooded' in CSS
    assert 'weather-world-surface-fire-risk' in CSS


def test_runtime_exposes_world_for_smoke_and_future_ecosystem_extensions():
    expose=EFFECTS.split("LibreDisplayRuntime.exposeModule('weatherEffects'",1)[1]
    for name in ['weatherWorldState','weatherWorldAdjustedCounts','weatherWorldClassList']:
        assert name in expose
