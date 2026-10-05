from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'app/dashboard.html').read_text()
CSS=(ROOT/'app/css/dashboard.css').read_text()
WEATHER=(ROOT/'app/js/weather/index.js').read_text()
FX=(ROOT/'app/js/weather/effects.js').read_text()
BG=(ROOT/'app/js/backgrounds/index.js').read_text()
SYSTEM=(ROOT/'app/js/system/index.js').read_text()
CONFIG=(ROOT/'app/js/core/config.js').read_text()


def test_current_release_version_is_v1816_and_readme_uses_pinned_bootstrap():
    assert (ROOT/'VERSION').read_text().strip()=='1.8.16'
    readme=(ROOT/'README.md').read_text()
    assert 'Gubna-Tech/LibreDisplay/v1.8.16/scripts/install-one-line.sh' in readme
    assert 'pinned **v1.8.16** release' in readme


def test_offline_reserve_explains_photo_count_perspective_and_yields_when_caching():
    assert 's-bg-offline-cache-estimate' in HTML
    assert '192 MB — ~48 typical photos' in HTML
    assert 'optimized 1.5 MB' in HTML or '1.5 MB each' in HTML
    assert 'function backgroundCacheYield()' in BG
    assert 'requestIdleCallback' in BG


def test_update_available_uses_static_exclamation_badge_without_tab_pulse():
    assert 'id="settings-update-badge"' in HTML
    assert '.settings-update-badge::before{content:"!"}' in CSS
    assert '.settings-update-badge.show{display:grid}' in CSS
    assert "badge.classList.toggle('show',updateAvailable)" in SYSTEM
    assert "systemTab.classList.toggle('update-available',updateAvailable)" in SYSTEM
    system_css=CSS[CSS.find('#setup .settings-update-badge'):CSS.find('.software-update-actions')]
    assert 'ldUpdateTabAttention' not in system_css
    assert 'animation:' not in system_css


def test_current_and_hourly_weather_are_phase_and_day_night_aware_but_daily_stays_default():
    assert 'MOON_PHASE_NORTH' in WEATHER and 'MOON_PHASE_SOUTH' in WEATHER
    assert 'function lunarPhaseIndex(' in WEATHER
    assert 'function moonPhaseEmoji(' in WEATHER
    assert 'function weatherTimeIsDay(' in WEATHER
    assert 'wi(c.weather_code,currentIsDay,c.time,d.latitude??ui.lat,d.utc_offset_seconds??0)' in WEATHER
    assert 'weatherTimeIsDay(hr.time[i],dl)' in WEATHER
    assert 'hr.time[i],d.latitude??ui.lat,d.utc_offset_seconds??0' in WEATHER
    assert "weatherIconMarkup(dl.weather_code[i],wi(dl.weather_code[i]),ui)" in WEATHER
    assert 'ld-wx-moon-phase' in CSS and 'phaseMoon' in FX


def test_heavy_snow_uses_discrete_gust_flakes_not_repeating_dot_array():
    assert "p.className='weather-fx-blowing-snow'" in FX
    assert "p.appendChild(f)" in FX
    snow_css=CSS[CSS.find('.weather-fx-blowing-snow'):CSS.find('.weather-severity-drizzle')]
    assert '.weather-fx-blowing-snow i' in snow_css
    assert 'background-size:27px 21px' not in snow_css
    assert 'repeating' not in snow_css


def test_alert_animation_is_weather_scoped_testable_and_granular():
    assert 'id="settings-weather-hazards" data-settings-tab="weather"' in HTML
    assert 'id="s-weather-hazard-test"' in HTML
    for control in ['s-weather-hazard-opacity','s-weather-hazard-speed','s-weather-hazard-flood-level','s-weather-hazard-flood-debris','s-weather-hazard-wind-gusts','s-weather-hazard-tornado-size','s-weather-hazard-tropical-surge','s-weather-hazard-storm-cloud','s-weather-hazard-winter-whiteout','s-weather-hazard-visibility-opacity','s-weather-hazard-heat-shimmer']:
        assert f'id="{control}"' in HTML
    assert 'WEATHER_HAZARD_TEST_PROFILES' in FX
    assert 'weatherHazardTestProfileChanged' in FX
    assert 'weatherHazardOpacity:100' in CONFIG
    assert 'weatherHazardFloodLevel:100' in CONFIG


def test_hazard_rendering_limits_dom_on_constrained_devices():
    assert 'appendHazardScenery(frag,source,wind,constrained)' in FX
    assert 'constrained?5:10' in FX
    assert 'constrained?3:5' in FX
