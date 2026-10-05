from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCENERY=(ROOT/'app/js/weather/scenery.js').read_text(encoding='utf-8')
EFFECTS=(ROOT/'app/js/weather/effects.js').read_text(encoding='utf-8')
CSS=(ROOT/'app/css/dashboard.css').read_text(encoding='utf-8')
PERF=(ROOT/'app/js/core/performance.js').read_text(encoding='utf-8')
README=(ROOT/'README.md').read_text(encoding='utf-8')


def test_v1827_release_scope():
    assert (ROOT/'VERSION').read_text().strip()=='1.8.27'
    assert 'v1.8.27/scripts/install-one-line.sh' in README
    assert 'VERSION="1.8.27"' in (ROOT/'scripts/install-one-line.sh').read_text()
    assert "const DASHBOARD_BUILD = '1.8.27';" in (ROOT/'app/js/core/bootstrap.js').read_text()


def test_dog_front_legs_are_mapped_to_front_of_body_and_rooted():
    assert '[rearNear,rearFar,frontNear,frontFar,legH,legW]=p.legs' in SCENERY
    assert "dogLegSvg(p,pal,frontNear,'front-near')" in SCENERY
    assert "dogLegSvg(p,pal,rearNear,'rear-near')" in SCENERY
    assert 'dogv2-leg-root dogv2-leg-root-front' in SCENERY
    assert 'rootY=front?cy-ry*.12:cy-ry*.02' in SCENERY


def test_dog_resting_uses_dedicated_folded_limbs():
    assert 'function dogRestLegSvg(' in SCENERY
    assert 'dogv2-rest-limbs' in SCENERY
    assert '.dog-state-rest .dogv2-leg' in CSS
    assert '.dog-state-sleep .dogv2-leg' in CSS
    assert '.dog-state-rest .dogv2-rest-limbs' in CSS


def test_dog_is_more_engaged_and_avoids_perching_on_dashboard_elements():
    assert 'function dogElementInterestTarget(' in SCENERY
    assert 'function dogOpenGroundX(' in SCENERY
    assert "['watch',9]" in SCENERY
    assert "['inspect',interest?7+activeBias*4:0]" in SCENERY
    assert "rows.push(['perch'" not in SCENERY
    assert 'ld1827HeadTilt' in CSS and 'ld1827Inspect' in CSS


def test_dog_house_and_flood_float_are_real_hazard_modes():
    for token in ['dogv2-doghouse','dogv2-doghouse-back','dogv2-doghouse-front','dogv2-floaty']:
        assert token in SCENERY or token in CSS
    assert "node.classList.toggle('dog-shelter-flood',hazardMode==='flood')" in SCENERY
    assert "node.classList.toggle('dog-shelter-house',hazardMode==='shelter')" in SCENERY
    assert '.dog-shelter-house .dogv2-doghouse' in CSS
    assert '.dog-shelter-flood .dogv2-floaty' in CSS


def test_ball_bounce_has_ground_contacts_and_pi_safe_midpoint():
    assert '--dog-ball-mid-x' in SCENERY
    assert 'ld1827DogBall' in CSS
    assert 'translateY(-8px)' in CSS
    assert 'translateY(0) rotate(190deg)' in CSS
    assert 'calc(var(--dog-ball-x' not in CSS


def test_tropical_scene_is_surface_view_not_spinning_satellite_flower():
    for token in ['hazard-tropical-sky','hazard-tropical-shelf','hazard-tropical-scud','hazard-tropical-squall','hazard-tropical-rain','hazard-tropical-spray']:
        assert token in EFFECTS and token in CSS
    for retired in ['hazard-hurricane-core','hazard-hurricane-eyewall','hazard-hurricane-arm']:
        assert retired not in EFFECTS


def test_fire_flash_flood_and_heavy_snow_rework():
    for token in ['hazard-fire-distance-glow','hazard-fire-scrub','hazard-fire-smoke-plume','hazard-fire-ground-flame']:
        assert token in EFFECTS and token in CSS
    for token in ['hazard-flood-plank','hazard-flood-bottle','hazard-flood-can','hazard-flood-foam']:
        assert token in EFFECTS and token in CSS
    assert 'weather-fx-heavy-snow-cloud' in EFFECTS and 'weather-fx-heavy-snow-cloud' in CSS


def test_pi4_budget_keeps_suite_but_reduces_paint_load():
    assert "particleScale:.34" in PERF
    assert "wildlifeScale:.42" in PERF
    assert "holidayScale:.50" in PERF
    assert "hazardScale:.62" in PERF
    assert "cloudScale:.68" in PERF
    assert "targetFrameMs:40" in PERF
    assert "resolutionTier:'4k'" in PERF
    assert "particleScale:.28" in PERF
    assert 'function frontendPixelLoad(' in PERF
    budget=PERF[PERF.index('function visualPerformanceBudget'):PERF.index('function effectiveVisualConfig')]
    assert 'weatherAnimationsEnabled:false' not in budget
    assert 'html.ld-constrained-device #weather-effects-overlay.show::before{filter:none!important}' in CSS
