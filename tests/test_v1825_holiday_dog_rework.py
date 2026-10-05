from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def test_version_bumped_to_1825():
    assert (ROOT / "VERSION").read_text(encoding="utf-8").strip() == "1.8.27"
    assert "1.8.27" in _read("app/js/core/bootstrap.js")


def test_holiday_overlays_gained_new_scene_helpers():
    text = _read("app/js/weather/scenery.js")
    for token in [
        "holidayRabbitNode",
        "holidayTurkeyNode",
        "holidayHonorScene",
        "holiday-christmas-tree",
        "holiday-thanksgiving-turkey",
        "holiday-honor-scene",
    ]:
        assert token in text


def test_dog_anatomy_refinement_present():
    text = _read("app/js/weather/scenery.js")
    for token in [
        "withersX=cx+rx*.37",
        "brisketX=cx+rx*.70",
        "rootY=front?cy-ry*.12:cy-ry*.02",
        "carpusY=rootY+span*(front?.71:.66)",
        "hockY=rootY+span*.73",
    ]:
        assert token in text


def test_css_has_new_rabbit_and_honor_scene_rules():
    text = _read("app/css/dashboard.css")
    for token in [
        "holiday-honor-scene",
        "holiday-thanksgiving-turkey",
        "ld1825RabbitHop",
        "dog-state-rest .dogv2-leg-front-near",
        "dog-state-sleep .dogv2-leg-front-near",
    ]:
        assert token in text
