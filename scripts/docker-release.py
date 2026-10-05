#!/usr/bin/env python3
"""Prepare and apply safe LibreDisplay Docker source updates.

This helper is designed to run inside an existing LibreDisplay Docker image with
its project directory mounted at /workspace. It only replaces release-managed
source files; Docker state in data/, media/, .env, backups/, and custom plugin
folders is preserved.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import shutil
import stat
import sys
import urllib.error
import urllib.request
import urllib.parse
import zipfile
from pathlib import Path, PurePosixPath

REPOSITORY = "Gubna-Tech/LibreDisplay"
API_URL = f"https://api.github.com/repos/{REPOSITORY}/releases/latest"
MAX_ARCHIVE_BYTES = 300 * 1024 * 1024
MAX_MEMBER_BYTES = 150 * 1024 * 1024
MAX_TOTAL_UNPACKED_BYTES = 700 * 1024 * 1024
MANAGED_DIRS = ("app", "scripts", "tests", "assets")
MANAGED_FILES = (
    "Dockerfile",
    "docker-compose.yml",
    "README.md",
    "LICENSE",
    "VERSION",
    "install.sh",
    "update.sh",
    "uninstall.sh",
)
REQUIRED_RELEASE_FILES = (
    "VERSION",
    "README.md",
    "LICENSE",
    "Dockerfile",
    "docker-compose.yml",
    "app/dashboard.html",
    "app/dashboard_server.py",
    "app/js/app.js",
    "app/css/dashboard.css",
    "scripts/docker-setup.sh",
    "scripts/docker-release.py",
)



def version_tuple(value: str):
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", str(value or "").strip())
    if not match:
        raise ValueError("Invalid release version")
    return tuple(int(part) for part in match.groups())


def ensure_real_workspace(value: str) -> Path:
    raw = Path(value).absolute()
    if raw.is_symlink():
        raise ValueError("Docker workspace must not be a symbolic link")
    workspace = raw.resolve()
    if not workspace.is_dir():
        raise ValueError("Docker workspace must be a real directory")
    if not (workspace / "VERSION").is_file() or not (workspace / "docker-compose.yml").is_file():
        raise ValueError("Docker workspace does not look like a LibreDisplay release")
    return workspace


def stage_path(workspace: Path, value: str) -> Path:
    stage = Path(value)
    if not stage.is_absolute():
        stage = workspace / stage
    stage = stage.resolve(strict=False)
    try:
        stage.relative_to(workspace)
    except ValueError as exc:
        raise ValueError("Update staging directory must stay inside the LibreDisplay workspace") from exc
    if stage == workspace:
        raise ValueError("Update staging directory cannot be the workspace itself")
    return stage


def safe_remove_tree(path: Path, workspace: Path):
    if not path.exists() and not path.is_symlink():
        return
    if path.is_symlink():
        raise ValueError(f"Refusing to remove symlinked update path: {path}")
    try:
        path.resolve(strict=False).relative_to(workspace.resolve())
    except ValueError as exc:
        raise ValueError("Refusing to remove an update path outside the workspace") from exc
    shutil.rmtree(path)


def github_json(url: str, user_agent: str):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def release_download(payload: dict, latest: str):
    release_tag = str(payload.get("tag_name") or "").strip()
    version_tuple(release_tag)
    return f"https://github.com/{REPOSITORY}/archive/refs/tags/{urllib.parse.quote(release_tag, safe='')}.zip", "", 0


def download(url: str, destination: Path, user_agent: str, expected_digest="", expected_size=0):
    request = urllib.request.Request(url, headers={"User-Agent": user_agent})
    total = 0
    hasher = hashlib.sha256()
    with urllib.request.urlopen(request, timeout=45) as response, destination.open("wb") as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_ARCHIVE_BYTES:
                raise ValueError("Downloaded release archive exceeded the safety size limit")
            hasher.update(chunk)
            output.write(chunk)
    if expected_size and total != expected_size:
        raise ValueError("Downloaded release size does not match GitHub asset metadata")
    if expected_digest:
        actual = "sha256:" + hasher.hexdigest()
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", expected_digest) or not hmac.compare_digest(actual, expected_digest):
            raise ValueError("Downloaded release failed its SHA-256 verification")


def safe_extract(archive: Path, destination: Path):
    seen = set()
    total = 0
    with zipfile.ZipFile(archive) as bundle:
        for info in bundle.infolist():
            raw = info.filename.replace("\\", "/")
            path = PurePosixPath(raw)
            if not raw or raw.startswith("/") or ".." in path.parts:
                raise ValueError("Release archive contains an unsafe path")
            if raw in seen:
                raise ValueError("Release archive contains duplicate entries")
            seen.add(raw)
            mode = (info.external_attr >> 16) & 0xFFFF
            if stat.S_ISLNK(mode):
                raise ValueError("Release archive contains a symbolic link")
            if info.file_size > MAX_MEMBER_BYTES:
                raise ValueError("Release archive contains an unexpectedly large file")
            total += info.file_size
            if total > MAX_TOTAL_UNPACKED_BYTES:
                raise ValueError("Release archive exceeds the unpacked-size safety limit")
        bundle.extractall(destination)


def locate_release_root(extracted: Path) -> Path:
    if (extracted / "VERSION").is_file():
        return extracted
    children = [item for item in extracted.iterdir() if item.is_dir() and not item.is_symlink()]
    if len(children) == 1 and (children[0] / "VERSION").is_file():
        return children[0]
    raise ValueError("Downloaded release has an unexpected directory layout")


def verify_release(release: Path, expected_version: str):
    actual = (release / "VERSION").read_text(encoding="utf-8").strip()
    if actual != expected_version:
        raise ValueError("Downloaded release VERSION does not match the GitHub release tag")
    for rel in REQUIRED_RELEASE_FILES:
        path = release / rel
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"Downloaded release is missing required file: {rel}")


def prepare(args) -> int:
    workspace = ensure_real_workspace(args.workspace)
    stage = stage_path(workspace, args.stage)
    current = (workspace / "VERSION").read_text(encoding="utf-8").strip()
    version_tuple(current)
    try:
        payload = github_json(API_URL, f"LibreDisplay-Docker/{current} updater")
        latest = str(payload.get("tag_name") or "").strip().lstrip("v")
        version_tuple(latest)
    except (OSError, urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(f"Could not check GitHub for LibreDisplay updates: {exc}") from exc

    if version_tuple(latest) <= version_tuple(current):
        if latest == current:
            print(f"LibreDisplay Docker v{current} is already up to date.")
        else:
            print(f"Installed LibreDisplay Docker v{current} is newer than latest release v{latest}; nothing was changed.")
        return 10

    safe_remove_tree(stage, workspace)
    stage.mkdir(mode=0o700)
    archive = stage / "release.zip"
    extracted = stage / "extracted"
    extracted.mkdir()
    url, digest, expected_size = release_download(payload, latest)
    release_tag = str(payload.get("tag_name") or "").strip()
    alternate_tag = release_tag[1:] if release_tag.lower().startswith("v") else "v" + release_tag
    alternate_url = f"https://github.com/{REPOSITORY}/archive/refs/tags/{urllib.parse.quote(alternate_tag, safe='')}.zip"
    print(f"Downloading LibreDisplay Docker v{latest}...")
    try:
        try:
            download(url, archive, f"LibreDisplay-Docker/{current} updater", digest, expected_size)
        except (OSError, urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
            archive.unlink(missing_ok=True)
            download(alternate_url, archive, f"LibreDisplay-Docker/{current} updater", digest, expected_size)
        safe_extract(archive, extracted)
        release_root = locate_release_root(extracted)
        verify_release(release_root, latest)
        release = stage / "release"
        shutil.copytree(release_root, release, symlinks=False)
        (stage / "target-version").write_text(latest + "\n", encoding="utf-8")
        (stage / "current-version").write_text(current + "\n", encoding="utf-8")
        archive.unlink(missing_ok=True)
        safe_remove_tree(extracted, workspace)
    except Exception:
        safe_remove_tree(stage, workspace)
        raise
    print(f"Prepared LibreDisplay Docker v{latest} for installation.")
    return 0


def copy_path(src: Path, dst: Path):
    if src.is_symlink():
        raise ValueError(f"Refusing to copy symbolic link: {src}")
    if src.is_dir():
        shutil.copytree(src, dst, symlinks=False)
    elif src.is_file():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    else:
        raise ValueError(f"Release path is not a regular file or directory: {src}")


def remove_path(path: Path):
    if path.is_symlink():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()


def build_apply_plan(workspace: Path, release: Path):
    plan = []
    for name in MANAGED_DIRS:
        src = release / name
        if src.exists():
            plan.append((name, src, workspace / name))
    for name in MANAGED_FILES:
        src = release / name
        if src.exists():
            plan.append((name, src, workspace / name))
    plugins = release / "plugins"
    if plugins.is_dir() and not plugins.is_symlink():
        for src in sorted(plugins.iterdir(), key=lambda p: p.name):
            if src.name in {"__pycache__", ".pytest_cache"} or src.name.endswith((".pyc", ".pyo")):
                continue
            plan.append((f"plugins/{src.name}", src, workspace / "plugins" / src.name))
    return plan


def apply_release(args) -> int:
    workspace = ensure_real_workspace(args.workspace)
    stage = stage_path(workspace, args.stage)
    release = stage / "release"
    if not release.is_dir() or release.is_symlink():
        raise ValueError("Prepared Docker release is missing")
    target_version = (stage / "target-version").read_text(encoding="utf-8").strip()
    current_version = (stage / "current-version").read_text(encoding="utf-8").strip()
    verify_release(release, target_version)
    rollback = stage / "rollback"
    if rollback.exists() or rollback.is_symlink():
        safe_remove_tree(rollback, workspace)
    rollback.mkdir(mode=0o700)

    plan = build_apply_plan(workspace, release)
    manifest = {"from": current_version, "to": target_version, "items": []}
    manifest_path = rollback / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    try:
        for rel, src, dst in plan:
            if dst.is_symlink():
                raise ValueError(f"Refusing to replace symlinked managed path: {rel}")
            existed = dst.exists()
            old = rollback / rel
            if existed:
                old.parent.mkdir(parents=True, exist_ok=True)
                copy_path(dst, old)
            manifest["items"].append({"path": rel, "existed": existed})
            manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
            remove_path(dst)
            dst.parent.mkdir(parents=True, exist_ok=True)
            copy_path(src, dst)
        for name in ("install.sh", "update.sh", "uninstall.sh"):
            path = workspace / name
            if path.is_file():
                os.chmod(path, 0o755)
        scripts = workspace / "scripts"
        if scripts.is_dir():
            for path in scripts.iterdir():
                if path.is_file() and (path.suffix in {".sh", ".py"} or path.name == "libredisplay"):
                    os.chmod(path, 0o755)
    except Exception:
        rollback_from_stage(workspace, stage, quiet=True)
        raise
    print(f"Applied LibreDisplay Docker source v{current_version} -> v{target_version}.")
    return 0


def rollback_from_stage(workspace: Path, stage: Path, *, quiet=False) -> int:
    rollback = stage / "rollback"
    manifest_path = rollback / "manifest.json"
    if not manifest_path.is_file():
        raise ValueError("Docker update rollback data is missing")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = manifest.get("items")
    if not isinstance(rows, list):
        raise ValueError("Docker update rollback manifest is invalid")
    for row in reversed(rows):
        rel = str(row.get("path") or "")
        pure = PurePosixPath(rel)
        if not rel or pure.is_absolute() or ".." in pure.parts:
            raise ValueError("Docker update rollback manifest contains an unsafe path")
        dst = workspace.joinpath(*pure.parts)
        old = rollback.joinpath(*pure.parts)
        remove_path(dst)
        if bool(row.get("existed")):
            if not old.exists() or old.is_symlink():
                raise ValueError(f"Rollback copy is missing for {rel}")
            dst.parent.mkdir(parents=True, exist_ok=True)
            os.replace(old, dst)
    if not quiet:
        print(f"Restored LibreDisplay Docker source v{manifest.get('from', 'previous')} after a failed update.")
    return 0


def rollback(args) -> int:
    workspace = ensure_real_workspace(args.workspace)
    stage = stage_path(workspace, args.stage)
    return rollback_from_stage(workspace, stage)


def cleanup(args) -> int:
    workspace = ensure_real_workspace(args.workspace)
    stage = stage_path(workspace, args.stage)
    safe_remove_tree(stage, workspace)
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Prepare/apply safe LibreDisplay Docker releases.")
    parser.add_argument("command", choices=("prepare", "apply", "rollback", "cleanup"))
    parser.add_argument("--workspace", default="/workspace")
    parser.add_argument("--stage", default="/workspace/.libredisplay-update")
    args = parser.parse_args(argv)
    try:
        if args.command == "prepare":
            return prepare(args)
        if args.command == "apply":
            return apply_release(args)
        if args.command == "rollback":
            return rollback(args)
        return cleanup(args)
    except (OSError, ValueError, RuntimeError, urllib.error.URLError, urllib.error.HTTPError, zipfile.BadZipFile) as exc:
        print(f"LibreDisplay Docker update error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
