#!/usr/bin/env python3
"""Build a deterministic LibreDisplay release archive."""
from __future__ import annotations

import argparse
from pathlib import Path, PurePosixPath
import stat
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EPOCH = (1980, 1, 1, 0, 0, 0)
TOP_FILES = (
    "Dockerfile",
    "LICENSE",
    "README.md",
    "VERSION",
    "docker-compose.yml",
    "install.sh",
    "uninstall.sh",
    "update.sh",
)
TOP_DIRS = ("app", "assets", "plugins", "scripts", "tests")
EXCLUDED_DIRS = {
    ".git", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    ".venv", "venv", "node_modules", ".tox", ".nox", ".idea", ".vscode",
    "media", "backups", ".libredisplay-update",
}
EXCLUDED_NAMES = {".coverage", ".DS_Store", ".env", ".gitkeep"}
EXCLUDED_SUFFIXES = {
    ".pyc", ".pyo", ".bak", ".orig", ".tmp", ".swp", ".swo", ".log",
    ".ldbackup", ".zip", ".tar", ".gz", ".tgz", ".7z",
}
EXCLUDED_NAME_FRAGMENTS = ("release-readiness-audit", "checkpoint", "scratch", "field-readiness-")


def include_path(path: Path, output: Path) -> bool:
    if path.resolve() == output.resolve():
        return False
    rel = path.relative_to(ROOT)
    if not rel.parts:
        return False
    if rel.parts[0] not in TOP_DIRS:
        return False
    if any(part in EXCLUDED_DIRS for part in rel.parts):
        return False
    if path.name in EXCLUDED_NAMES or path.suffix.lower() in EXCLUDED_SUFFIXES:
        return False
    if path.name.startswith(".env"):
        return False
    if any(fragment in path.name.lower() for fragment in EXCLUDED_NAME_FRAGMENTS):
        return False
    return True


def release_paths(output: Path) -> list[Path]:
    paths: list[Path] = []
    for name in TOP_FILES:
        path = ROOT / name
        if not path.is_file() or path.is_symlink():
            raise SystemExit(f"Release is missing required file: {name}")
        paths.append(path)
    for name in TOP_DIRS:
        base = ROOT / name
        if not base.is_dir() or base.is_symlink():
            raise SystemExit(f"Release is missing required directory: {name}/")
        paths.append(base)
        for path in base.rglob("*"):
            if include_path(path, output):
                paths.append(path)
    return sorted(paths, key=lambda p: (p.relative_to(ROOT).as_posix().casefold(), p.is_file()))


def zip_info(rel: PurePosixPath, mode: int, is_dir: bool) -> zipfile.ZipInfo:
    name = rel.as_posix() + ("/" if is_dir else "")
    info = zipfile.ZipInfo(name, EPOCH)
    info.create_system = 3
    kind = stat.S_IFDIR if is_dir else stat.S_IFREG
    info.external_attr = (kind | mode) << 16
    if is_dir:
        info.external_attr |= 0x10
    info.compress_type = zipfile.ZIP_DEFLATED
    return info


def build(output: Path) -> None:
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    prefix = PurePosixPath(f"LibreDisplay-{version}")
    output.parent.mkdir(parents=True, exist_ok=True)
    paths = release_paths(output)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        zf.writestr(zip_info(prefix, 0o755, True), b"")
        for path in paths:
            if path.is_symlink():
                raise SystemExit(f"Refusing to package symlink: {path.relative_to(ROOT)}")
            rel = prefix / PurePosixPath(path.relative_to(ROOT).as_posix())
            if path.is_dir():
                zf.writestr(zip_info(rel, 0o755, True), b"")
                continue
            mode = stat.S_IMODE(path.stat().st_mode)
            if mode & 0o002:
                raise SystemExit(f"Refusing to package world-writable file: {path.relative_to(ROOT)}")
            normalized_mode = 0o755 if mode & 0o111 else 0o644
            zf.writestr(zip_info(rel, normalized_mode, False), path.read_bytes())


def main() -> int:
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / f"LibreDisplay-v{version}.zip")
    args = parser.parse_args()
    build(args.output.resolve())
    print(args.output.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
