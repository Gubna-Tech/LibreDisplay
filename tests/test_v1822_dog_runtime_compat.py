from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SCENERY=(ROOT/'app/js/weather/scenery.js').read_text()
CSS=(ROOT/'app/css/dashboard.css').read_text()

def test_dog_translation_avoids_new_css_calc_multiplication():
    assert "--dog-y-shift" in SCENERY
    assert "var(--dog-y-shift,-28px)" in CSS
    assert "calc(-1 * var(--dog-y" not in CSS
    assert "--dog-step-delay" in SCENERY
    assert "var(--dog-step-delay,-.24s)" in CSS
    assert "calc(var(--dog-step-duration" not in CSS
    assert "--dog-ball-x" in SCENERY
    assert "var(--dog-ball-x,24px)" in CSS
    assert "calc(var(--dog-ball-dir" not in CSS

def test_dog_has_canine_head_and_muzzle_paths_not_duck_bill_rectangle():
    assert "function dogHeadSvg" in SCENERY
    assert "function dogMuzzleSvg" in SCENERY
    assert "dogv2-muzzle-group" in SCENERY
    assert '<rect class="dogv2-muzzle"' not in SCENERY
    assert "function dogBodySvg" in SCENERY and "function dogNeckSvg" in SCENERY
    assert "effW=mw*scale" in SCENERY
    assert "short=['bulldog','boxer']" in SCENERY
    assert "long=['shepherd','hound','dachshund','giant','collie','aussie']" in SCENERY
    assert "f==='poodle'?.76" in SCENERY

def test_runtime_forces_visible_motion_and_has_stall_watchdog():
    assert "function dogForceVisibleWalk" in SCENERY
    assert "function dogStartWatchdog" in SCENERY
    assert "Date.now()-(dogRuntime.lastMotionAt||0)>15000" in SCENERY
    assert "rand(700,1300)" in SCENERY
    assert "dogRuntime.idleStreak>=2" in SCENERY
    assert "function dogRuntimeSnapshot" in SCENERY


def test_dog_legs_are_jointed_paths_not_vertical_rectangles():
    assert "const leg=(x,name,far=false)=>{const front=name.startsWith('front')" in SCENERY
    assert '<rect x=\"${x-legW/2}' not in SCENERY
    assert "mid=top+legH*.52" in SCENERY
    assert "<circle cx=\"${x+w*.44}\" cy=\"${mid+3}\"" in SCENERY
