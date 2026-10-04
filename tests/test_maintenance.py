import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "release-rollback.py"


def load_module():
    spec = importlib.util.spec_from_file_location("libredisplay_release_rollback", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReleaseRollbackTests(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()
        self.tmp = tempfile.TemporaryDirectory(prefix="libredisplay-maintenance-test-")
        self.base = Path(self.tmp.name)
        self.install = self.base / "libredisplay"
        self.rollbacks = self.base / "rollbacks"
        for name in self.mod.CODE_DIRS:
            (self.install / name).mkdir(parents=True, exist_ok=True)
            (self.install / name / "sample.txt").write_text(f"{name}-v1\n", encoding="utf-8")
        for name in self.mod.TOP_FILES:
            if name.startswith("."):
                continue
            (self.install / name).write_text("1.5.0\n" if name == "VERSION" else f"{name}\n", encoding="utf-8")
        backup = self.install / "scripts" / "backup.sh"
        backup.write_text("#!/bin/sh\nset -eu\nprintf 'fake-backup' > \"$1\"\nchmod 600 \"$1\"\n", encoding="utf-8")
        backup.chmod(0o755)
        restore = self.install / "scripts" / "restore.sh"
        restore.write_text("#!/bin/sh\nset -eu\n[ -f \"$1\" ]\nexit 0\n", encoding="utf-8")
        restore.chmod(0o755)

    def tearDown(self):
        self.tmp.cleanup()

    def test_snapshot_is_private_verifiable_and_records_versions(self):
        snap_id = self.mod.create_snapshot(self.install, self.rollbacks, "1.5.1", quiet=True)
        snap = self.rollbacks / snap_id
        self.assertTrue((snap / "pre-update.ldbackup").is_file())
        raw = self.mod.verify_snapshot(snap)
        self.assertEqual(raw["fromVersion"], "1.5.0")
        self.assertEqual(raw["toVersion"], "1.5.1")
        self.assertEqual(oct((snap / "pre-update.ldbackup").stat().st_mode & 0o777), "0o600")
        rows = self.mod.list_snapshots(self.rollbacks)
        self.assertEqual(rows[0]["id"], snap_id)
        self.assertEqual(rows[0]["fromVersion"], "1.5.0")

    def test_snapshot_verification_detects_application_tampering(self):
        snap_id = self.mod.create_snapshot(self.install, self.rollbacks, "1.5.1", quiet=True)
        snap = self.rollbacks / snap_id
        (snap / "release" / "app" / "sample.txt").write_text("tampered\n", encoding="utf-8")
        with self.assertRaises(ValueError):
            self.mod.verify_snapshot(snap)

    def test_restore_returns_application_to_snapshot_and_keeps_recovery_point(self):
        snap_id = self.mod.create_snapshot(self.install, self.rollbacks, "1.5.1", quiet=True)
        (self.install / "VERSION").write_text("1.5.1\n", encoding="utf-8")
        (self.install / "app" / "sample.txt").write_text("app-v2\n", encoding="utf-8")
        code = self.mod.restore_snapshot(snap_id, self.install, self.rollbacks, no_reboot=True)
        self.assertEqual(code, 0)
        self.assertEqual((self.install / "VERSION").read_text(encoding="utf-8").strip(), "1.5.0")
        self.assertEqual((self.install / "app" / "sample.txt").read_text(encoding="utf-8"), "app-v1\n")
        rows = self.mod.list_snapshots(self.rollbacks)
        self.assertGreaterEqual(len(rows), 2)
        history = json.loads((self.install / "data" / "maintenance_history.json").read_text(encoding="utf-8"))
        self.assertEqual(history["items"][0]["event"], "rollback")
        self.assertEqual(history["items"][0]["toVersion"], "1.5.0")

    def test_update_history_is_bounded_and_private(self):
        data = self.install / "data"
        data.mkdir(parents=True, exist_ok=True)
        for i in range(60):
            self.mod.append_history(self.install, "update", fromVersion=f"1.4.{i}", toVersion="1.5.0", snapshotId=f"s{i}")
        path = data / "maintenance_history.json"
        raw = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(len(raw["items"]), 50)
        self.assertEqual(oct(path.stat().st_mode & 0o777), "0o600")
        self.assertEqual(raw["items"][0]["event"], "update")

    def test_prepared_update_transaction_clears_when_live_tree_never_changed(self):
        snap_id = self.mod.create_snapshot(self.install, self.rollbacks, "1.5.1", quiet=True)
        tx = self.mod.record_update_transaction(self.install, self.rollbacks, snap_id, "prepared")
        self.assertEqual(tx["fromVersion"], "1.5.0")
        self.assertEqual(tx["toVersion"], "1.5.1")
        result = self.mod.recover_pending_update(self.install, self.rollbacks)
        self.assertEqual(result["state"], "unchanged")
        self.assertFalse(self.mod.update_transaction_path(self.install).exists())
        history = json.loads((self.install / "data" / "maintenance_history.json").read_text(encoding="utf-8"))
        self.assertEqual(history["items"][0]["event"], "update-interrupted-no-change")

    def test_interrupted_replacement_restores_verified_pre_update_snapshot(self):
        snap_id = self.mod.create_snapshot(self.install, self.rollbacks, "1.5.1", quiet=True)
        self.mod.record_update_transaction(self.install, self.rollbacks, snap_id, "replacing")
        (self.install / "app" / "sample.txt").write_text("partial-new-release\n", encoding="utf-8")
        with mock.patch.object(self.mod, "verify_installed_release", return_value={"ok": True, "version": "1.5.0"}):
            result = self.mod.recover_pending_update(self.install, self.rollbacks)
        self.assertEqual(result["state"], "restored")
        self.assertEqual((self.install / "app" / "sample.txt").read_text(encoding="utf-8"), "app-v1\n")
        self.assertFalse(self.mod.update_transaction_path(self.install).exists())
        history = json.loads((self.install / "data" / "maintenance_history.json").read_text(encoding="utf-8"))
        self.assertEqual(history["items"][0]["event"], "update-auto-recovered")

    def test_validated_interrupted_update_is_kept_when_new_release_verifies(self):
        snap_id = self.mod.create_snapshot(self.install, self.rollbacks, "1.5.1", quiet=True)
        self.mod.record_update_transaction(self.install, self.rollbacks, snap_id, "validated")
        (self.install / "VERSION").write_text("1.5.1\n", encoding="utf-8")
        with mock.patch.object(self.mod, "verify_installed_release", return_value={"ok": True, "version": "1.5.1"}) as verify:
            result = self.mod.recover_pending_update(self.install, self.rollbacks)
        verify.assert_called_once_with(self.install.resolve(), "1.5.1")
        self.assertEqual(result["state"], "completed")
        self.assertEqual((self.install / "VERSION").read_text(encoding="utf-8"), "1.5.1\n")
        self.assertFalse(self.mod.update_transaction_path(self.install).exists())

    def test_current_release_passes_runtime_install_verification(self):
        root = Path(__file__).resolve().parents[1]
        result = self.mod.verify_installed_release(root, "1.8.0")
        self.assertTrue(result["ok"])
        self.assertTrue(result["frontendVerified"])
        self.assertEqual(result["version"], "1.8.0")
        self.assertEqual(result["coreFiles"], 12)
        self.assertEqual(result["pythonFiles"], 5)
        self.assertEqual(result["shellFiles"], 11)


if __name__ == "__main__":
    unittest.main()
