from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SCENERY=(ROOT/'app/js/weather/scenery.js').read_text(encoding='utf-8')
EFFECTS=(ROOT/'app/js/weather/effects.js').read_text(encoding='utf-8')
CSS=(ROOT/'app/css/dashboard.css').read_text(encoding='utf-8')
README=(ROOT/'README.md').read_text(encoding='utf-8')


def test_release_version_and_bootstrap_are_1824():
    assert (ROOT/'VERSION').read_text().strip()=='1.8.24'
    assert 'v1.8.24/scripts/install-one-line.sh' in README
    assert 'VERSION="1.8.24"' in (ROOT/'scripts/install-one-line.sh').read_text()


def test_dog_anatomy_is_articulated_and_collar_is_neck_anchored():
    for token in ['function dogLegSvg(','dogv2-upper-limb','dogv2-lower-limb','function dogCollarSvg(','dogv2-collar-band','dogv2-shoulder']:
        assert token in SCENERY
    assert 'topX=hx-hrx*.73' in SCENERY
    for token in ['ld1824UpperForward','ld1824LowerForward','ld1824WalkBody']:
        assert token in CSS


def test_dog_world_interruption_recovery_is_persistent():
    for token in ['const dogContinuity=','function dogShelterTarget(','function dogRecoverFromHazard(','interruptedState','shelterTarget','resumeFromHazard']:
        assert token in SCENERY
    assert "['flood','shelter'].includes(previousHazard)" in SCENERY


def test_hurricane_and_fire_renderers_use_new_visual_language():
    for token in ['hazard-hurricane-core','hazard-hurricane-eyewall','hazard-hurricane-arm','hazard-hurricane-cloud-bank','hazard-hurricane-rainband']:
        assert token in EFFECTS and token in CSS
    assert "className='hazard-hurricane-band'" not in EFFECTS
    for token in ['hazard-fire-shrub','hazard-fire-low-flare','hazard-fire-brushline','hazard-fire-ground']:
        assert token in EFFECTS and token in CSS
    assert "className='hazard-fire-flame'" not in EFFECTS


def test_holiday_overlays_coordinate_with_naturescape_and_have_richer_scenes():
    for token in ['HOLIDAY_NATURE_POLICIES','function holidayNaturePolicy(','holiday-easter-rabbit','holiday-web','holiday-spider','holiday-ghost']:
        assert token in SCENERY
    assert 'holidayNature=sceneryApi.holidayNaturePolicy' in EFFECTS
    assert "const hp=world.holidayNature" in EFFECTS
    for token in ['ld1824RabbitHop','ld1824Spider','ld1824Ghost']:
        assert token in CSS
