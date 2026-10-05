#!/usr/bin/env python3
"""Validate LibreDisplay's no-build frontend module contract."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path, PurePosixPath


def fail(message: str) -> None:
    raise SystemExit(f"Frontend verification failed: {message}")


def main() -> None:
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
    app = root / "app"
    js_root = app / "js"
    manifest_path = js_root / "module-manifest.json"
    app_js_path = js_root / "app.js"
    dashboard_path = app / "dashboard.html"
    for path in (manifest_path, app_js_path, dashboard_path, js_root / "core" / "runtime.js"):
        if not path.is_file():
            fail(f"missing {path.relative_to(root)}")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"invalid app/js/module-manifest.json: {exc}")
    if not isinstance(manifest, list) or not manifest:
        fail("module manifest is empty")
    if [row.get("order") for row in manifest] != list(range(1, len(manifest) + 1)):
        fail("module manifest order must be contiguous starting at 1")

    paths: list[str] = []
    for row in manifest:
        raw = str(row.get("path") or "")
        if not raw.startswith("/js/") or not raw.endswith(".js"):
            fail(f"unsafe module path {raw!r}")
        rel = PurePosixPath(raw.removeprefix("/js/"))
        if not rel.parts or any(part in {"", ".", ".."} for part in rel.parts):
            fail(f"unsafe module path {raw!r}")
        path = js_root.joinpath(*rel.parts)
        if not path.is_file():
            fail(f"manifest module is missing: {raw}")
        lines = len(path.read_text(encoding="utf-8").splitlines())
        if lines != int(row.get("lines") or -1):
            fail(f"manifest line count is stale for {raw}: {row.get('lines')} != {lines}")
        if lines > 550:
            fail(f"frontend module exceeds 550-line architecture limit: {raw} ({lines})")
        paths.append(raw)
    if len(paths) != len(set(paths)):
        fail("module manifest contains duplicate paths")

    app_js = app_js_path.read_text(encoding="utf-8")
    match = re.search(r"const modulePaths\s*=\s*\[(.*?)\];", app_js, re.S)
    if not match:
        fail("app/js/app.js does not declare modulePaths")
    loader_paths = re.findall(r'["\']([^"\']+\.js)["\']', match.group(1))
    expected = ["/js/core/runtime.js", *paths]
    if loader_paths != expected:
        fail("app.js modulePaths does not exactly match runtime + module manifest order")

    dashboard = dashboard_path.read_text(encoding="utf-8")
    preload_paths = re.findall(r'<link\s+rel="modulepreload"\s+href="([^"]+)">', dashboard)
    if preload_paths != expected:
        fail("dashboard modulepreload list does not exactly match runtime + module manifest order")

    print(f"frontend verification: PASS ({len(paths)} manifest sources, {len(dict.fromkeys(row['module'] for row in manifest))} logical modules)")


if __name__ == "__main__":
    main()
