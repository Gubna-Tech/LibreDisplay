import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path


class RecoveryPointTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="libredisplay-recovery-test-")
        self.old_data = os.environ.get("DASHBOARD_DATA_DIR")
        os.environ["DASHBOARD_DATA_DIR"] = self.tmp.name
        server_path = Path(__file__).resolve().parents[1] / "app" / "dashboard_server.py"
        spec = importlib.util.spec_from_file_location("libredisplay_recovery_server", server_path)
        self.server = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.server)

    def tearDown(self):
        if self.old_data is None:
            os.environ.pop("DASHBOARD_DATA_DIR", None)
        else:
            os.environ["DASHBOARD_DATA_DIR"] = self.old_data
        self.tmp.cleanup()

    def write_json(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value) + "\n", encoding="utf-8")

    def test_restore_point_round_trip_keeps_config_profiles_and_scenes(self):
        original_config = {"locationName": "Kitchen", "layoutMode": "custom", "marker": "original"}
        original_profiles = {"version": 1, "activeId": "p1", "items": [{"id": "p1", "name": "Morning", "config": {"marker": "profile"}}]}
        original_scenes = {"version": 1, "automatic": True, "baseProfiles": {"main": "p1"}, "items": []}
        self.write_json(self.server.CONFIG_PATH, original_config)
        self.write_json(self.server.PROFILES_PATH, original_profiles)
        self.write_json(self.server.SCENES_PATH, original_scenes)

        created = self.server.create_restore_point("main", "Known good")
        self.assertTrue(self.server.restore_point_path(created["id"]).is_file())
        points = self.server.list_restore_points()
        self.assertEqual(points[0]["label"], "Known good")
        self.assertEqual(points[0]["endpoint"], "main")

        self.write_json(self.server.CONFIG_PATH, {"marker": "changed"})
        self.write_json(self.server.PROFILES_PATH, {"version": 1, "items": []})
        self.write_json(self.server.SCENES_PATH, {"version": 1, "automatic": False, "items": []})

        result = self.server.apply_restore_point(created["id"], "main")
        self.assertEqual(result["endpoint"], "main")
        self.assertEqual(self.server.load_json_path(self.server.CONFIG_PATH, {}).get("marker"), "original")
        self.assertEqual(self.server.load_json_path(self.server.PROFILES_PATH, {}).get("activeId"), "p1")
        self.assertTrue(self.server.load_json_path(self.server.SCENES_PATH, {}).get("automatic"))
        self.assertTrue(any(row["label"] == "Before restore" for row in self.server.list_restore_points()))

    def test_restore_point_rejects_wrong_endpoint_and_prunes(self):
        self.write_json(self.server.CONFIG_PATH, {"marker": "main"})
        created = self.server.create_restore_point("main", "Main")
        with self.assertRaises(ValueError):
            self.server.apply_restore_point(created["id"], "other-display")
        for i in range(24):
            self.server.create_restore_point("main", f"Point {i}")
        self.server.prune_restore_points(20)
        self.assertLessEqual(len(self.server.list_restore_points(limit=100)), 20)


if __name__ == "__main__":
    unittest.main()
