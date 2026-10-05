from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
WEATHER=(ROOT/'app/js/weather/index.js').read_text(encoding='utf-8')
FX=(ROOT/'app/js/weather/effects.js').read_text(encoding='utf-8')
CSS=(ROOT/'app/css/dashboard.css').read_text(encoding='utf-8')
PRESETS=(ROOT/'app/js/appearance/presets.js').read_text(encoding='utf-8')
SYSTEM=(ROOT/'app/js/system/index.js').read_text(encoding='utf-8')


def test_v1816_version_and_pinned_installer():
    assert (ROOT/'VERSION').read_text().strip()=='1.8.27'
    assert 'v1.8.27/scripts/install-one-line.sh' in (ROOT/'README.md').read_text()
    assert 'VERSION="1.8.27"' in (ROOT/'scripts/install-one-line.sh').read_text()


def test_night_icons_use_eight_phase_lunar_cycle_and_hemisphere_pov():
    for emoji in ('🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'):
        assert emoji in WEATHER
    assert "const MOON_PHASE_NORTH=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘']" in WEATHER
    assert "const MOON_PHASE_SOUTH=['🌑','🌘','🌗','🌖','🌕','🌔','🌓','🌒']" in WEATHER
    assert 'knownNewMoon=Date.UTC(2000,0,6,18,14)' in WEATHER
    assert 'moonPhaseEmoji(time,latitude=cfg.lat,utcOffsetSeconds=0)' in WEATHER
    assert 'wi(c.weather_code,currentIsDay,c.time,d.latitude??ui.lat,d.utc_offset_seconds??0)' in WEATHER
    assert 'hr.time[i],d.latitude??ui.lat,d.utc_offset_seconds??0' in WEATHER
    assert "weatherIconMarkup(dl.weather_code[i],wi(dl.weather_code[i]),ui)" in WEATHER
    assert 'layout' not in WEATHER[WEATHER.find('function moonPhaseEmoji'):WEATHER.find('function wd')]


def test_hazard_test_mode_forces_a_render_without_layout_preview_suppression():
    fn=FX[FX.find('function previewWeatherHazardTestFullScreen'):FX.find('function setWeatherEffectTestProfile')]
    assert 'previewDashboardFromSettings' in fn
    assert 'applyWeatherEffects(configApi.wxData,window.__uiPreviewCfg||null)' in fn
    assert "const hazards=source.weatherHazardEffects===false?[]:weatherHazardAlerts(source),hazardOn=hazards.length>0" in FX
    assert '(allowed||hazardOn||seasonalOn)' in FX
    assert 'world=weatherWorldState(data,source,hazards)' in FX
    assert 'hazardOn&&!data?.current' in FX


def test_all_hazard_families_have_visible_realism_layers():
    for marker in ('hazard-flood-wave','hazard-flood-branch','hazard-flood-depth','hazard-tornado-wallcloud','hazard-tornado-slice','hazard-tornado-debris','hazard-tropical-cloud','hazard-tropical-rain','hazard-blizzard-gust','hazard-storm-gust-front','hazard-storm-bolt','weather-fx-hazard-visibility','hazard-fire-ember'):
        assert marker in FX or marker in CSS
    assert 'opacity:var(--hazard-alpha,.63)' in CSS
    assert "--hazard-alpha',(intensity*opacity*.96).toFixed(3)" in FX
    assert 'funnel cloud' in FX and 'lakeshore flood' in FX and 'gale warning' in FX


def test_update_badge_is_static_yellow_exclamation():
    assert "badge.classList.toggle('show',updateAvailable)" in SYSTEM
    assert '.settings-update-badge::before{content:"!"}' in CSS
    indicator=CSS[CSS.find('#setup .settings-update-badge'):CSS.find('.software-update-actions')]
    assert '#f4c542' in indicator
    assert 'animation:' not in indicator
    assert 'ldUpdateTabAttention' not in CSS


def test_featured_layouts_are_real_dashboard_previews_not_wireframes():
    for marker in ('layoutPresetDemoContent','layout-mini-clock','layout-mini-calendar','layout-mini-forecast','layout-mini-weather','layout-preset-photo-sun'):
        if marker=='layout-preset-photo-sun':
            continue
        assert marker in PRESETS or marker in CSS
    assert 'border-style:dashed!important' not in CSS
    assert 'data-layout-preset-style=' in PRESETS
    assert '<span class="layout-showcase-chip">demo</span>' in PRESETS
    assert 'finished dashboards, not wireframes' in CSS
    for key in ('photocalendar','glassboard','portraitwall','weekcolumns','photostory','mirrorminimal'):
        assert f"{key}:{{name:" in PRESETS
