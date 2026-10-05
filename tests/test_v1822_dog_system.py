from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SCENERY=(ROOT/'app/js/weather/scenery.js').read_text()
CSS=(ROOT/'app/css/dashboard.css').read_text()
HTML=(ROOT/'app/dashboard.html').read_text()
VERSION=(ROOT/'VERSION').read_text().strip()

def test_version_and_new_dog_renderer_are_present():
    assert VERSION=='1.8.26'
    assert 'weather-fx-dog-v2' in SCENERY
    assert 'dogv2-svg' in SCENERY
    assert 'dogSvgMarkup' in SCENERY
    assert 'DOG_PROFILES' in SCENERY
    assert 'new vector character system' in HTML

def test_all_breeds_have_material_geometry_profiles():
    breeds=['labrador','golden','german-shepherd','white-swiss-shepherd','great-pyrenees','nova-scotia-duck-tolling-retriever','border-collie','australian-shepherd','beagle','corgi','dachshund','french-bulldog','poodle','husky','shiba','boxer','great-dane','chihuahua']
    for breed in breeds:
        assert f"{breed}:" in SCENERY or f"'{breed}':" in SCENERY
    for token in ["family:'retriever'","family:'shepherd'","family:'mountain'","family:'corgi'","family:'dachshund'","family:'bulldog'","family:'poodle'","family:'giant'","family:'toy'"]:
        assert token in SCENERY
    assert 'dogBreedSignature' in SCENERY
    assert 'dogHeadSvg' in SCENERY and 'dogMuzzleSvg' in SCENERY
    assert '<rect class=\"dogv2-muzzle\"' not in SCENERY

def test_locomotion_is_raf_curved_and_facing_is_instant():
    assert 'function dogMoveTo' in SCENERY
    assert 'requestAnimationFrame(tick)' in SCENERY
    assert 'omt*omt*x0+2*omt*e*cx+e*e*x1' in SCENERY
    assert 'transition:none!important' in CSS
    assert '.dogv2-facing-stage{transform-box:view-box' in CSS
    assert 'transition:transform .2s ease' not in CSS
    v2=CSS.split('replacement Dog Companion renderer.')[1]
    assert 'transition:transform' not in v2
    assert '-310deg' not in v2

def test_ball_is_direction_aware_and_states_do_not_spin_whole_dog():
    v2=CSS.split('replacement Dog Companion renderer.')[1]
    assert '.dog-facing-left .dogv2-ball' in v2
    assert 'var(--dog-ball-x,24px)' in v2
    assert "--dog-ball-x',`${dir*24}px`" in SCENERY
    assert '@keyframes ld1822PlayFlop' in v2
    assert 'rotate(-310deg)' not in v2
    assert 'dog-state-sleep' in v2 and 'dog-state-sit' in v2 and 'dog-state-sniff' in v2 and 'dog-state-dig' in v2

def test_breed_specific_anatomy_types_are_rendered():
    for tail in ['curl','upright-tip','bob','pom','plume','low-bushy','thin-low','long-thin','short']:
        assert tail in SCENERY
    for ear in ['erect','large-erect','huge-erect','bat','hound','semi','semi-drop','fold','poodle','small-drop']:
        assert ear in SCENERY
    for mark in ['saddle','collie','toller','beagle','corgi','husky','merle','mask','boxer','pyrenees']:
        assert mark in SCENERY

def test_legacy_universal_dog_renderer_is_removed():
    effects=(ROOT/'app/js/weather/effects.js').read_text()
    assert 'function appendDogCompanion(frag,source,data,counts=null)' not in effects
    assert 'dog-figure' not in CSS
    assert 'ldDogRoll' not in CSS
