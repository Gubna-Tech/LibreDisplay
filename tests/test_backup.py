import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("libredisplay_backup", ROOT / "scripts" / "server-backup.py")
backup_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup_mod)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="libredisplay-backup-test-")
        self.root = Path(self.tmp.name) / "LibreDisplay"
        (self.root / "scripts").mkdir(parents=True)
        (self.root / "data" / "calendar_files").mkdir(parents=True)
        (self.root / "media").mkdir()
        (self.root / "plugins" / "custom").mkdir(parents=True)
        (self.root / "VERSION").write_text("1.0.0\n", encoding="utf-8")
        (self.root / "data" / "dashboard_config.json").write_text('{"theme":"night"}\n', encoding="utf-8")
        (self.root / "data" / "dashboard_access.json").write_text('{"token":"secret"}\n', encoding="utf-8")
        (self.root / "data" / "calendar_files" / "family.ics").write_text("BEGIN:VCALENDAR\nEND:VCALENDAR\n", encoding="utf-8")
        (self.root / "media" / "photo.txt").write_text("media", encoding="utf-8")
        (self.root / "plugins" / "custom" / "plugin.py").write_text("MANIFEST={}\n", encoding="utf-8")
        (self.root / ".env").write_text("TOKEN=top-secret\n", encoding="utf-8")
        self.old_root = backup_mod.PROJECT_ROOT
        backup_mod.PROJECT_ROOT = self.root

    def tearDown(self):
        backup_mod.PROJECT_ROOT = self.old_root
        self.tmp.cleanup()

    def test_roundtrip_and_permissions(self):
        archive = Path(self.tmp.name) / "server.ldbackup"
        backup_mod.backup(SimpleNamespace(archive=str(archive), include_host=False, host_secrets_dir="/does-not-exist"))
        self.assertEqual(archive.stat().st_mode & 0o777, 0o600)
        (self.root / "data" / "dashboard_config.json").write_text('{"changed":true}\n', encoding="utf-8")
        backup_mod.restore(SimpleNamespace(archive=str(archive), verify_only=False, yes=True))
        self.assertIn('"theme":"night"', (self.root / "data" / "dashboard_config.json").read_text())
        self.assertEqual((self.root / "media" / "photo.txt").read_text(), "media")
        self.assertEqual((self.root / ".env").read_text(), "TOKEN=top-secret\n")

    def test_cache_is_not_backed_up(self):
        cache = self.root / "data" / "dashboard_cache"
        cache.mkdir()
        (cache / "large.bin").write_bytes(b"x" * 100)
        archive = Path(self.tmp.name) / "server.ldbackup"
        backup_mod.backup(SimpleNamespace(archive=str(archive), include_host=False, host_secrets_dir="/does-not-exist"))
        with zipfile.ZipFile(archive) as zf:
            self.assertFalse(any("dashboard_cache" in name for name in zf.namelist()))

    def test_runtime_update_logs_are_not_backed_up(self):
        data = self.root / "data"
        (data / "update.log").write_text("updating\n", encoding="utf-8")
        (data / "rollback.log").write_text("rolling back\n", encoding="utf-8")
        archive = Path(self.tmp.name) / "server.ldbackup"
        backup_mod.backup(SimpleNamespace(archive=str(archive), include_host=False, host_secrets_dir="/does-not-exist"))
        with zipfile.ZipFile(archive) as zf:
            names = set(zf.namelist())
            self.assertNotIn("payload/data/update.log", names)
            self.assertNotIn("payload/data/rollback.log", names)

    def test_chromium_runtime_symlinks_do_not_block_backup(self):
        chromium = self.root / "data" / "chromium"
        chromium.mkdir()
        (chromium / "Default").mkdir()
        (chromium / "Default" / "Preferences").write_text('{"ok":true}\n', encoding="utf-8")
        for name in ("SingletonCookie", "SingletonLock", "SingletonSocket"):
            (chromium / name).symlink_to(f"/tmp/libredisplay-{name}")
        archive = Path(self.tmp.name) / "server.ldbackup"
        backup_mod.backup(SimpleNamespace(archive=str(archive), include_host=False, host_secrets_dir="/does-not-exist"))
        with zipfile.ZipFile(archive) as zf:
            names = set(zf.namelist())
            self.assertIn("payload/data/chromium/Default/Preferences", names)
            for name in ("SingletonCookie", "SingletonLock", "SingletonSocket"):
                self.assertNotIn(f"payload/data/chromium/{name}", names)

    def test_unexpected_data_symlink_is_still_rejected(self):
        (self.root / "data" / "unexpected-link").symlink_to("/tmp/not-allowed")
        archive = Path(self.tmp.name) / "server.ldbackup"
        with self.assertRaisesRegex(RuntimeError, "Refusing to back up symlink"):
            backup_mod.backup(SimpleNamespace(archive=str(archive), include_host=False, host_secrets_dir="/does-not-exist"))

    def test_path_traversal_is_rejected(self):
        archive = Path(self.tmp.name) / "evil.ldbackup"
        payload = b"nope"
        manifest = {"format": 1, "product": "LibreDisplay", "sensitive": True, "files": [{"path": "payload/../escape", "size": len(payload), "sha256": __import__('hashlib').sha256(payload).hexdigest(), "mode": "0o600"}]}
        with zipfile.ZipFile(archive, "w") as zf:
            zf.writestr("payload/../escape", payload)
            zf.writestr("manifest.json", json.dumps(manifest))
        with self.assertRaises(ValueError):
            with zipfile.ZipFile(archive) as zf:
                backup_mod.read_manifest(zf)

    def test_custom_existing_parent_permissions_are_preserved(self):
        parent = Path(self.tmp.name) / "custom-output"
        parent.mkdir(mode=0o755)
        parent.chmod(0o755)
        archive = parent / "server.ldbackup"
        backup_mod.backup(SimpleNamespace(archive=str(archive), include_host=False, host_secrets_dir="/does-not-exist"))
        self.assertEqual(parent.stat().st_mode & 0o777, 0o755)

    def test_duplicate_zip_entries_are_rejected(self):
        archive = Path(self.tmp.name) / "duplicate.ldbackup"
        payload = b"same"
        digest = __import__('hashlib').sha256(payload).hexdigest()
        manifest = {"format": 1, "product": "LibreDisplay", "sensitive": True, "files": [{"path": "payload/data/a.txt", "size": len(payload), "sha256": digest, "mode": "0o600"}]}
        with zipfile.ZipFile(archive, "w") as zf:
            zf.writestr("payload/data/a.txt", payload)
            zf.writestr("payload/data/a.txt", payload)
            zf.writestr("manifest.json", json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, "duplicate archive entries"):
            with zipfile.ZipFile(archive) as zf:
                backup_mod.read_manifest(zf)

    def test_managed_fstab_validation_rejects_unmanaged_target(self):
        valid = "# LibreDisplay NAS: photos\n//nas/photos /mnt/libredisplay/photos cifs credentials=/etc/libredisplay/nas-photos.credentials,ro,nosuid,nodev,noexec,iocharset=utf8,vers=3.0,uid=1000,gid=1000,_netdev,nofail,x-systemd.automount,x-systemd.idle-timeout=60 0 0\n"
        self.assertEqual(backup_mod.validate_managed_fstab_payload(valid), valid)
        bad = "# LibreDisplay NAS: photos\n//nas/photos /etc cifs defaults 0 0\n"
        with self.assertRaises(ValueError):
            backup_mod.validate_managed_fstab_payload(bad)

    def test_managed_fstab_validation_rejects_exec_or_arbitrary_credentials(self):
        unsafe = "# LibreDisplay NAS: photos\n//nas/photos /mnt/libredisplay/photos cifs credentials=/tmp/evil,ro,nosuid,nodev,exec,iocharset=utf8,vers=3.0,uid=1000,gid=1000,_netdev,nofail,x-systemd.automount,x-systemd.idle-timeout=60 0 0\n"
        with self.assertRaises(ValueError):
            backup_mod.validate_managed_fstab_payload(unsafe)


if __name__ == "__main__":
    unittest.main()
