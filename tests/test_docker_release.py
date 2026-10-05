import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("libredisplay_docker_release", ROOT / "scripts" / "docker-release.py")
docker_release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(docker_release)


class DockerReleaseTests(unittest.TestCase):
    def test_release_download_uses_historical_github_tag_archive_scheme(self):
        payload = {"tag_name": "v1.2.0", "assets": [{
            "name": "LibreDisplay-v1.2.0.zip",
            "browser_download_url": "https://github.com/Gubna-Tech/LibreDisplay/releases/download/v1.2.0/LibreDisplay-v1.2.0.zip",
            "digest": "sha256:" + "b" * 64,
            "size": 123,
        }]}
        url, found_digest, size = docker_release.release_download(payload, "1.2.0")
        self.assertEqual(url, "https://github.com/Gubna-Tech/LibreDisplay/archive/refs/tags/v1.2.0.zip")
        self.assertEqual(found_digest, "")
        self.assertEqual(size, 0)

    def test_release_download_accepts_tag_without_v_prefix(self):
        payload = {"tag_name": "1.8.12", "assets": []}
        url, found_digest, size = docker_release.release_download(payload, "1.8.12")
        self.assertEqual(url, "https://github.com/Gubna-Tech/LibreDisplay/archive/refs/tags/1.8.12.zip")
        self.assertEqual(found_digest, "")
        self.assertEqual(size, 0)

    def make_release(self, root: Path, version: str, marker: str):
        (root / "app" / "js").mkdir(parents=True)
        (root / "app" / "css").mkdir(parents=True)
        (root / "scripts").mkdir(parents=True)
        (root / "plugins" / "todoist").mkdir(parents=True)
        (root / "tests").mkdir(parents=True)
        (root / "VERSION").write_text(version + "\n", encoding="utf-8")
        (root / "docker-compose.yml").write_text("name: libredisplay\nservices: {}\n", encoding="utf-8")
        (root / "Dockerfile").write_text("FROM scratch\n", encoding="utf-8")
        (root / "README.md").write_text(f"readme-{marker}\n", encoding="utf-8")
        (root / "LICENSE").write_text("MIT\n", encoding="utf-8")
        (root / "install.sh").write_text("#!/bin/sh\n", encoding="utf-8")
        (root / "update.sh").write_text("#!/bin/sh\n", encoding="utf-8")
        (root / "uninstall.sh").write_text("#!/bin/sh\n", encoding="utf-8")
        (root / "app" / "dashboard.html").write_text(f"<!doctype html><!-- {marker} -->\n", encoding="utf-8")
        (root / "app" / "dashboard_server.py").write_text(f"# {marker}\n", encoding="utf-8")
        (root / "app" / "js" / "app.js").write_text(f"// {marker}\n", encoding="utf-8")
        (root / "app" / "css" / "dashboard.css").write_text(f"/* {marker} */\n", encoding="utf-8")
        (root / "scripts" / "docker-setup.sh").write_text(f"#!/bin/sh\n# {marker}\n", encoding="utf-8")
        (root / "scripts" / "docker-release.py").write_text(f"#!/usr/bin/env python3\n# {marker}\n", encoding="utf-8")
        (root / "plugins" / "todoist" / "plugin.py").write_text(f"# {marker}\n", encoding="utf-8")
        (root / "tests" / "marker.txt").write_text(marker, encoding="utf-8")

    def test_apply_and_rollback_preserve_docker_state_and_custom_plugins(self):
        with tempfile.TemporaryDirectory(prefix="libredisplay-docker-release-") as td:
            workspace = Path(td) / "LibreDisplay"
            workspace.mkdir()
            self.make_release(workspace, "1.1.1", "old")
            (workspace / "data").mkdir()
            (workspace / "data" / "dashboard_config.json").write_text('{"keep":true}\n', encoding="utf-8")
            (workspace / "media").mkdir()
            (workspace / "media" / "photo.jpg").write_bytes(b"photo")
            (workspace / ".env").write_text("DASHBOARD_PORT=9999\n", encoding="utf-8")
            (workspace / "plugins" / "custom-local").mkdir()
            (workspace / "plugins" / "custom-local" / "plugin.py").write_text("# custom\n", encoding="utf-8")

            stage = workspace / ".libredisplay-update"
            release = stage / "release"
            release.mkdir(parents=True)
            self.make_release(release, "1.2.0", "new")
            (stage / "target-version").write_text("1.2.0\n", encoding="utf-8")
            (stage / "current-version").write_text("1.1.1\n", encoding="utf-8")

            args = SimpleNamespace(workspace=str(workspace), stage=str(stage))
            self.assertEqual(docker_release.apply_release(args), 0)
            self.assertEqual((workspace / "VERSION").read_text().strip(), "1.2.0")
            self.assertEqual((workspace / "plugins" / "todoist" / "plugin.py").read_text().strip(), "# new")
            self.assertEqual((workspace / "plugins" / "custom-local" / "plugin.py").read_text().strip(), "# custom")
            self.assertEqual((workspace / "data" / "dashboard_config.json").read_text().strip(), '{"keep":true}')
            self.assertEqual((workspace / "media" / "photo.jpg").read_bytes(), b"photo")
            self.assertEqual((workspace / ".env").read_text().strip(), "DASHBOARD_PORT=9999")

            self.assertEqual(docker_release.rollback(args), 0)
            self.assertEqual((workspace / "VERSION").read_text().strip(), "1.1.1")
            self.assertEqual((workspace / "plugins" / "todoist" / "plugin.py").read_text().strip(), "# old")
            self.assertEqual((workspace / "plugins" / "custom-local" / "plugin.py").read_text().strip(), "# custom")
            self.assertEqual((workspace / "data" / "dashboard_config.json").read_text().strip(), '{"keep":true}')
            self.assertEqual((workspace / "media" / "photo.jpg").read_bytes(), b"photo")
            self.assertEqual((workspace / ".env").read_text().strip(), "DASHBOARD_PORT=9999")

    def test_stage_must_stay_inside_workspace(self):
        with tempfile.TemporaryDirectory(prefix="libredisplay-docker-stage-") as td:
            workspace = Path(td) / "LibreDisplay"
            workspace.mkdir()
            (workspace / "VERSION").write_text("1.2.0\n")
            (workspace / "docker-compose.yml").write_text("services: {}\n")
            real = docker_release.ensure_real_workspace(str(workspace))
            with self.assertRaises(ValueError):
                docker_release.stage_path(real, str(Path(td).parent / "outside"))


class DockerSetupTests(unittest.TestCase):
    def test_start_preserves_existing_env_values(self):
        with tempfile.TemporaryDirectory(prefix="libredisplay-docker-setup-") as td:
            root = Path(td) / "LibreDisplay"
            (root / "scripts").mkdir(parents=True)
            (root / "scripts" / "docker-setup.sh").write_bytes((ROOT / "scripts" / "docker-setup.sh").read_bytes())
            os.chmod(root / "scripts" / "docker-setup.sh", 0o755)
            (root / "docker-compose.yml").write_text("name: libredisplay\nservices: {}\n", encoding="utf-8")
            (root / ".env").write_text(
                "\n".join([
                    "DASHBOARD_UID=1234",
                    "DASHBOARD_GID=1235",
                    "DASHBOARD_PORT=8787",
                    "DASHBOARD_BIND=127.0.0.1",
                    "DASHBOARD_REMOTE_ENABLED=0",
                    "DASHBOARD_REMOTE_NETWORKS=10.0.0.0/8",
                    "DASHBOARD_REMOTE_SESSION_SECONDS=999",
                    "DASHBOARD_DISPLAY_SESSION_SECONDS=888",
                    "DASHBOARD_ALLOWED_HOSTS=display.local",
                    "DASHBOARD_CACHE_MAX_BYTES=123456",
                ]) + "\n",
                encoding="utf-8",
            )
            fakebin = Path(td) / "bin"
            fakebin.mkdir()
            docker = fakebin / "docker"
            docker.write_text(
                """#!/bin/sh
set -eu
if [ "$1" = "compose" ] && [ "$2" = "version" ]; then exit 0; fi
if [ "$1" = "compose" ] && [ "$2" = "config" ]; then exit 0; fi
if [ "$1" = "compose" ] && [ "$2" = "up" ]; then mkdir -p data; printf '{\"token\":\"t\"}\n' > data/dashboard_access.json; exit 0; fi
if [ "$1" = "compose" ] && [ "$2" = "ps" ] && [ "${3:-}" = "-q" ]; then printf 'fake-container\n'; exit 0; fi
if [ "$1" = "compose" ] && [ "$2" = "ps" ]; then printf 'libredisplay\n'; exit 0; fi
if [ "$1" = "inspect" ]; then printf 'healthy\n'; exit 0; fi
exit 0
""",
                encoding="utf-8",
            )
            os.chmod(docker, 0o755)
            env = os.environ.copy()
            env["PATH"] = str(fakebin) + os.pathsep + env.get("PATH", "")
            result = subprocess.run(
                ["sh", "scripts/docker-setup.sh", "start", "--port", "9999"],
                cwd=root,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=10,
                check=False,
            )
            self.assertEqual(result.returncode, 0, msg=result.stdout + result.stderr)
            values = {}
            for line in (root / ".env").read_text(encoding="utf-8").splitlines():
                if "=" in line:
                    key, value = line.split("=", 1)
                    values[key] = value
            self.assertEqual(values["DASHBOARD_UID"], "1234")
            self.assertEqual(values["DASHBOARD_GID"], "1235")
            self.assertEqual(values["DASHBOARD_PORT"], "9999")
            self.assertEqual(values["DASHBOARD_REMOTE_ENABLED"], "0")
            self.assertEqual(values["DASHBOARD_REMOTE_NETWORKS"], "10.0.0.0/8")
            self.assertEqual(values["DASHBOARD_REMOTE_SESSION_SECONDS"], "999")
            self.assertEqual(values["DASHBOARD_DISPLAY_SESSION_SECONDS"], "888")
            self.assertEqual(values["DASHBOARD_ALLOWED_HOSTS"], "display.local")
            self.assertEqual(values["DASHBOARD_CACHE_MAX_BYTES"], "123456")


if __name__ == "__main__":
    unittest.main()
