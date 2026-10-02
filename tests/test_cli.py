import importlib.machinery
import importlib.util
import json
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
        self.assertEqual(release["size"], 0)
        self.assertEqual(release["digest"], "")

    def test_latest_release_prefers_exact_release_asset_with_github_sha256(self):
        digest = "sha256:" + "a" * 64
        payload = {"tag_name": "v1.0.1", "assets": [{
            "name": "LibreDisplay-v1.0.1.zip",
            "browser_download_url": "https://github.com/Gubna-Tech/LibreDisplay/releases/download/v1.0.1/LibreDisplay-v1.0.1.zip",
            "digest": digest,
            "size": 123456,
        }]}
        with mock.patch.object(cli, "github_request", return_value=json.dumps(payload).encode("utf-8")):
            release = cli.latest_release()
        self.assertEqual(release["digest"], digest)
        self.assertEqual(release["size"], 123456)
        self.assertTrue(release["url"].endswith("LibreDisplay-v1.0.1.zip"))

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


if __name__ == "__main__":
    unittest.main()
