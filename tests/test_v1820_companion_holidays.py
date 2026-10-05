from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'app/dashboard.html').read_text(encoding='utf-8')
CFG=(ROOT/'app/js/core/config.js').read_text(encoding='utf-8')
FX=(ROOT/'app/js/weather/effects.js').read_text(encoding='utf-8')
SCENERY=(ROOT/'app/js/weather/scenery.js').read_text(encoding='utf-8')
CSS=(ROOT/'app/css/dashboard.css').read_text(encoding='utf-8')
APP=(ROOT/'app/js/app.js').read_text(encoding='utf-8')
README=(ROOT/'README.md').read_text(encoding='utf-8')


def test_v1820_version_and_pinned_installer_are_synchronized():
    assert (ROOT/'VERSION').read_text().strip()=='1.8.23'
    assert 'v1.8.23/scripts/install-one-line.sh' in README
    assert 'VERSION="1.8.23"' in (ROOT/'scripts/install-one-line.sh').read_text()


def test_companion_is_a_state_driven_character_not_a_linear_sprite_loop():
    assert '/js/weather/scenery.js' in APP
    for state in ('rest','sit','sleep','sniff','wander','dig','roll','ball','bird','perch'):
        assert f"'{state}'" in SCENERY
        assert f"'{state}'" in SCENERY
    assert 'dogPerchTarget' in SCENERY
    assert '@keyframes ld1822PlayFlop' in CSS
    assert 'lowBirdTarget' in SCENERY
    assert 'function dogMoveTo' in SCENERY
    assert 'requestAnimationFrame(tick)' in SCENERY
    assert 'omt*omt*x0+2*omt*e*cx+e*e*x1' in SCENERY
    assert 'node.dataset.direction' in SCENERY
    assert 'animation:none!important' in CSS and '#weather-effects-overlay .weather-fx-dog' in CSS


def test_requested_breeds_lab_coats_and_collar_customization_are_present():
    breeds=(
        'white-swiss-shepherd','great-pyrenees','nova-scotia-duck-tolling-retriever',
        'labrador','golden','german-shepherd','border-collie','australian-shepherd',
        'beagle','corgi','dachshund','french-bulldog','poodle','husky','shiba','boxer','great-dane','chihuahua'
    )
    for breed in breeds:
        assert f'value="{breed}"' in HTML
        assert 'dogv2-svg' in SCENERY
        assert breed in SCENERY
        assert f"'{breed}'" in SCENERY
    for coat in ('black','yellow','fox-red','chocolate'):
        assert f'value="{coat}"' in HTML
        assert coat in SCENERY
    for collar in ('none','red','blue','teal','green','purple','pink','orange','black','brown'):
        assert f'value="{collar}"' in HTML
    assert "collar==='none'" in SCENERY
    assert 'weatherDogCompanion:false' in CFG


def test_holiday_overlays_are_opt_in_per_holiday_and_have_test_mode():
    assert 'id="settings-naturescape-holidays"' in HTML
    assert 'id="s-holiday-overlays-enabled"' in HTML
    assert 'holidayOverlaysEnabled:false' in CFG
    holidays={
        'new-year':'holidayOverlayNewYear','valentines':'holidayOverlayValentines','st-patrick':'holidayOverlayStPatrick',
        'easter':'holidayOverlayEaster','memorial':'holidayOverlayMemorial','juneteenth':'holidayOverlayJuneteenth',
        'independence':'holidayOverlayIndependence','labor':'holidayOverlayLabor','halloween':'holidayOverlayHalloween',
        'day-of-dead':'holidayOverlayDayOfDead','veterans':'holidayOverlayVeterans','thanksgiving':'holidayOverlayThanksgiving',
        'hanukkah':'holidayOverlayHanukkah','christmas':'holidayOverlayChristmas',
    }
    for key,setting in holidays.items():
        assert f'value="{key}"' in HTML
        assert setting in CFG
        assert setting in SCENERY
    assert 'setHolidayOverlayTestProfile' in SCENERY
    assert 's-holiday-overlay-preview' in SCENERY
    assert 's-holiday-overlay-stop' in SCENERY


def test_holiday_scenes_have_distinct_visual_families_and_calendar_logic():
    for cls in (
        'holiday-garland','holiday-menorah','holiday-firework','holiday-pumpkin','holiday-bat',
        'holiday-papel','holiday-marigold','holiday-thanks-cornucopia','holiday-heart',
        'holiday-clover','holiday-egg','holiday-ribbon'
    ):
        assert cls in SCENERY
        assert f'.{cls}' in CSS
    assert 'easterDate' in SCENERY
    assert 'isHanukkah' in SCENERY
    assert 'nthWeekday' in SCENERY
    assert 'lastWeekday' in SCENERY
    assert "m===11&&d===nthWeekday(y,11,4,4)" in SCENERY
    assert "m===7&&d===4" in SCENERY


def test_scenery_integrates_without_expanding_legacy_global_bridge():
    assert "getModule('weatherScenery')" in FX
    assert 'globalFunctions:[],globalStates:[]' in SCENERY
    assert 'sceneryApi.appendDogCompanion' in FX
    assert 'sceneryApi.appendHolidayOverlays' in FX
    assert 'sceneryApi.registerHolidayRefresh' in FX
