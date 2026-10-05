from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def text(rel):
    return (ROOT/rel).read_text(encoding="utf-8")

def test_weather_realism_profiles_are_rebalanced():
    fx=text("app/js/weather/effects.js")
    assert "key:'drizzle',speed:.62,size:.58" in fx
    assert "key:'heavy-rain',speed:1.08,size:.82,width:.90" in fx
    assert "key:'heavy-snow',speed:.92,size:1.02,drift:1.18" in fx
    assert "weather-fx-blowing-snow" in fx

def test_clouds_are_structured_and_separate_from_fog():
    fx=text("app/js/weather/effects.js")
    css=text("app/css/dashboard.css")
    assert "function appendCloudAtmosphere" in fx
    assert "weather-fx-cloud-mass" in fx
    assert ".weather-fx-cloud-mass::before" in css
    assert ".weather-fx-fog-horizon" in css
    assert "repeating-linear-gradient(0deg" not in css

def test_alert_hazard_scenery_is_wired_to_active_alerts():
    fx=text("app/js/weather/effects.js")
    alerts=text("app/js/weather/alerts.js")
    cfg=text("app/js/core/config.js")
    html=text("app/dashboard.html")
    assert "function weatherHazardAlerts" in fx
    for hazard in ["tornado","tropical","flood","winter","storm","wind","visibility","heat-fire"]:
        assert f"'{hazard}'" in fx
    assert "configApi.activeWeatherAlerts" in fx
    assert "weatherEffects').refreshWeatherEffects" in alerts
    assert "weatherHazardEffects:true" in cfg
    assert 'id="settings-weather-hazards"' in html
    assert 'id="s-weather-hazard-intensity"' in html

def test_readme_version_content_remains_release_scoped():
    # v1.8.22 is the active release version.
    assert (ROOT/"VERSION").read_text().strip()=="1.8.22"
