import importlib.machinery
import importlib.util
import json
import os
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
CLI_PATH = ROOT / "scripts" / "libredisplay"
loader = importlib.machinery.SourceFileLoader("libredisplay_cli_test", str(CLI_PATH))
spec = importlib.util.spec_from_loader(loader.name, loader)
cli = importlib.util.module_from_spec(spec)
loader.exec_module(cli)


class CliTests(unittest.TestCase):
    def test_version_tuple(self):
        self.assertEqual(cli.version_tuple("v2.3.4"), (2, 3, 4))
        with self.assertRaises(ValueError):
            cli.version_tuple("latest")

    def test_latest_release_uses_github_tag_archive(self):
        payload = {"tag_name": "v1.0.1", "assets": []}
        with mock.patch.object(cli, "github_request", return_value=json.dumps(payload).encode("utf-8")):
            release = cli.latest_release()
        self.assertEqual(release["version"], "1.0.1")
        self.assertEqual(
            release["url"],
            "https://github.com/Gubna-Tech/LibreDisplay/archive/refs/tags/v1.0.1.zip",
        )
        self.assertEqual(release["alternate_url"], "https://github.com/Gubna-Tech/LibreDisplay/archive/refs/tags/1.0.1.zip")
        self.assertEqual(release["size"], 0)
        self.assertEqual(release["digest"], "")

    def test_latest_release_accepts_tag_without_v_prefix(self):
        payload = {"tag_name": "1.8.12", "assets": []}
        with mock.patch.object(cli, "github_request", return_value=json.dumps(payload).encode("utf-8")):
            release = cli.latest_release()
        self.assertEqual(release["version"], "1.8.12")
        self.assertEqual(release["tag"], "1.8.12")
        self.assertEqual(
            release["url"],
            "https://github.com/Gubna-Tech/LibreDisplay/archive/refs/tags/1.8.12.zip",
        )
        self.assertEqual(release["alternate_url"], "https://github.com/Gubna-Tech/LibreDisplay/archive/refs/tags/v1.8.12.zip")

    def test_latest_release_always_uses_historical_github_tag_archive_scheme(self):
        payload = {"tag_name": "v1.0.1", "assets": [{
            "name": "LibreDisplay-v1.0.1.zip",
            "browser_download_url": "https://github.com/Gubna-Tech/LibreDisplay/releases/download/v1.0.1/LibreDisplay-v1.0.1.zip",
            "digest": "sha256:" + "a" * 64,
            "size": 123456,
        }]}
        with mock.patch.object(cli, "github_request", return_value=json.dumps(payload).encode("utf-8")):
            release = cli.latest_release()
        self.assertEqual(
            release["url"],
            "https://github.com/Gubna-Tech/LibreDisplay/archive/refs/tags/v1.0.1.zip",
        )
        self.assertEqual(release["digest"], "")
        self.assertEqual(release["size"], 0)

    def test_latest_release_rejects_invalid_tag(self):
        payload = {"tag_name": "latest", "assets": []}
        with mock.patch.object(cli, "github_request", return_value=json.dumps(payload).encode("utf-8")):
            with self.assertRaises(SystemExit):
                cli.latest_release()


    def test_update_hands_verified_release_to_existing_updater(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            home = td / "home"
            installed = home / "libredisplay"
            installed.mkdir(parents=True)
            (installed / "VERSION").write_text("1.0.0\n", encoding="utf-8")

            def fake_download(release, destination):
                with zipfile.ZipFile(destination, "w") as zf:
                    zf.writestr("LibreDisplay-1.0.1/VERSION", "1.0.1\n")
                    zf.writestr("LibreDisplay-1.0.1/update.sh", "#!/bin/sh\nexit 0\n")
                    zf.writestr("LibreDisplay-1.0.1/app/dashboard.html", "<!doctype html>\n")
                    zf.writestr("LibreDisplay-1.0.1/app/dashboard_server.py", "# server\n")
                    zf.writestr("LibreDisplay-1.0.1/app/js/app.js", "// app\n")
                    zf.writestr("LibreDisplay-1.0.1/app/css/dashboard.css", "/* css */\n")
                return "0" * 64

            release = {
                "version": "1.0.1",
                "url": "https://github.com/Gubna-Tech/LibreDisplay/archive/refs/tags/v1.0.1.zip",
                "digest": "",
                "size": 1,
            }
            with mock.patch.dict("os.environ", {"HOME": str(home)}), \
                 mock.patch.object(cli, "latest_release", return_value=release), \
                 mock.patch.object(cli, "download_release", side_effect=fake_download), \
                 mock.patch.object(cli.subprocess, "run") as run:
                run.return_value.returncode = 0
                rc = cli.update(no_reboot=True)
            self.assertEqual(rc, 0)
            command = run.call_args.args[0]
            self.assertEqual(command[0], "/bin/sh")
            self.assertTrue(str(command[1]).endswith("/release/LibreDisplay-1.0.1/update.sh"))
            self.assertIn("--no-reboot", command)

    def test_safe_extract_rejects_traversal(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            archive = td / "bad.zip"
            with zipfile.ZipFile(archive, "w") as zf:
                zf.writestr("../escape.txt", "nope")
            with self.assertRaises(SystemExit):
                cli.safe_extract(archive, td / "out")

    def test_safe_extract_accepts_flat_release(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            archive = td / "ok.zip"
            with zipfile.ZipFile(archive, "w") as zf:
                zf.writestr("VERSION", "1.0.1\n")
                zf.writestr("update.sh", "#!/bin/sh\n")
            out = td / "out"
            out.mkdir()
            cli.safe_extract(archive, out)
            self.assertEqual((out / "VERSION").read_text().strip(), "1.0.1")

    def test_safe_extract_restores_release_executable_bits(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            archive = td / "mode.zip"
            with zipfile.ZipFile(archive, "w") as zf:
                info = zipfile.ZipInfo("scripts/tool")
                info.external_attr = (stat.S_IFREG | 0o755) << 16
                zf.writestr(info, "#!/bin/sh\nexit 0\n")
            out = td / "out"
            out.mkdir()
            cli.safe_extract(archive, out)
            self.assertTrue((out / "scripts" / "tool").stat().st_mode & stat.S_IXUSR)

    def test_field_check_runs_installed_soak_tool(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            home = td / "home"
            installed = home / "libredisplay"
            script = installed / "scripts" / "field-readiness.py"
            script.parent.mkdir(parents=True)
            script.write_text("#!/usr/bin/env python3\n", encoding="utf-8")
            with mock.patch.dict("os.environ", {"HOME": str(home)}), mock.patch.object(cli.subprocess, "run") as run:
                run.return_value.returncode = 0
                rc = cli.run_field_check(duration_minutes=60, interval_seconds=30, label="pi3-test", output="/tmp/report.json")
            self.assertEqual(rc, 0)
            command = run.call_args.args[0]
            self.assertEqual(command[0], cli.sys.executable)
            self.assertEqual(Path(command[1]), script)
            self.assertIn("--duration-minutes", command)
            self.assertIn("60", command)
            self.assertIn("--label", command)
            self.assertIn("pi3-test", command)


    def test_field_check_forwards_release_gate_resume_flags(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            home = td / "home"
            installed = home / "libredisplay"
            script = installed / "scripts" / "field-readiness.py"
            script.parent.mkdir(parents=True)
            script.write_text("#!/usr/bin/env python3\n", encoding="utf-8")
            with mock.patch.dict("os.environ", {"HOME": str(home)}), mock.patch.object(cli.subprocess, "run") as run:
                run.return_value.returncode = 2
                rc = cli.run_field_check(release_gate=True, resume=True, interval_seconds=20, label="final-gate")
            self.assertEqual(rc, 2)
            command = run.call_args.args[0]
            self.assertIn("--release-gate", command)
            self.assertIn("--resume", command)
            self.assertNotIn("--duration-minutes", command)
            self.assertIn("final-gate", command)

    def test_field_check_resume_does_not_override_original_interval_by_default(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            home = td / "home"
            installed = home / "libredisplay"
            script = installed / "scripts" / "field-readiness.py"
            script.parent.mkdir(parents=True)
            script.write_text("#!/usr/bin/env python3\n", encoding="utf-8")
            with mock.patch.dict("os.environ", {"HOME": str(home)}), mock.patch.object(cli.subprocess, "run") as run:
                run.return_value.returncode = 2
                rc = cli.run_field_check(release_gate=True, resume=True)
            self.assertEqual(rc, 2)
            command = run.call_args.args[0]
            self.assertIn("--resume", command)
            self.assertNotIn("--interval-seconds", command)


if __name__ == "__main__":
    unittest.main()
