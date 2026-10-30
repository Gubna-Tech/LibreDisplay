#!/usr/bin/env python3
"""Exercise the installed dashboard in an isolated local process before committing an update."""
from __future__ import annotations
import argparse
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path


def probe(release: Path, timeout: float = 30.0) -> dict:
    release = release.expanduser().resolve()
    dashboard = release / "app/dashboard_server.py"
    if not dashboard.is_file() or not (release / "VERSION").is_file():
        raise RuntimeError("New release is missing dashboard or VERSION")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="libredisplay-update-health-") as scratch:
        env = dict(os.environ)
        env.update(DASHBOARD_HOST="127.0.0.1", DASHBOARD_PORT=str(port),
                   DASHBOARD_DATA_DIR=scratch, DASHBOARD_NO_BROWSER="1",
                   DASHBOARD_NATIVE_KIOSK="0", PYTHONDONTWRITEBYTECODE="1")
        # Disable proxy interception for the loopback-only health probes.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        proc = subprocess.Popen([sys.executable, "-I", "-B", str(dashboard)],
                                cwd=str(release), env=env, stdin=subprocess.DEVNULL,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                close_fds=True)
        deadline = time.monotonic() + max(1.0, min(float(timeout), 60.0))
        urls = ("/healthz", "/dashboard.html", "/js/app.js", "/css/dashboard.css")
        try:
            while time.monotonic() < deadline:
                if proc.poll() is not None:
                    raise RuntimeError("New dashboard exited before it became healthy")
                try:
                    for path in urls:
                        request = urllib.request.Request(f"http://127.0.0.1:{port}{path}")
                        with opener.open(request, timeout=1.0) as resp:
                            if resp.status != 200:
                                raise RuntimeError(f"Local {path} failed HTTP {resp.status}")
                            body = resp.read(1024 * 1024)
                            if not body:
                                raise RuntimeError(f"Local {path} returned an empty response")
                            if path == "/healthz":
                                health = json.loads(body)
                                expected = (release / "VERSION").read_text(encoding="utf-8").strip()
                                if health.get("ok") is not True or health.get("version") != expected:
                                    raise RuntimeError("New dashboard healthz did not confirm the expected running version")
                    return {"ok": True, "version": (release / "VERSION").read_text().strip(), "checked": list(urls)}
                except (OSError, ValueError, TimeoutError, RuntimeError):
                    time.sleep(0.25)
            raise RuntimeError("New dashboard did not pass the isolated HTTP health check")
        finally:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=3)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", required=True, type=Path)
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()
    try:
        result = probe(args.release, args.timeout)
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"LibreDisplay pre-commit health check failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
