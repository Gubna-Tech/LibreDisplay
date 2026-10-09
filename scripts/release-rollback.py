#!/usr/bin/env python3
"""Create and restore private LibreDisplay pre-update rollback snapshots."""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
from pathlib import Path

FORMAT_VERSION = 1
ROLLBACK_KEEP = 5
REQUIRED_CODE_DIRS = ("app", "scripts")
OPTIONAL_CODE_DIRS = ("assets",)
CODE_DIRS = REQUIRED_CODE_DIRS + OPTIONAL_CODE_DIRS
REQUIRED_TOP_FILES = ("VERSION", "install.sh", "update.sh", "uninstall.sh")
OPTIONAL_TOP_FILES = ("Dockerfile", "LICENSE", "README.md", "docker-compose.yml")
TOP_FILES = OPTIONAL_TOP_FILES + REQUIRED_TOP_FILES
CHUNK = 1024 * 1024
PRIVILEGED_HELPER = Path("/usr/local/libexec/libredisplay-privileged")
UPDATE_TRANSACTION_NAME = "update-transaction.json"
UPDATE_TRANSACTION_STATES = {"prepared", "replacing", "validated"}
CORE_RUNTIME_FILES = (
    "VERSION", "app/dashboard.html", "app/dashboard_server.py", "app/js/app.js",
    "app/js/module-manifest.json", "scripts/start.sh", "scripts/verify-frontend.py",
    "scripts/release-rollback.py", "scripts/server-backup.py", "install.sh", "update.sh", "uninstall.sh",
)
CORE_PYTHON_FILES = (
    "app/dashboard_server.py", "scripts/release-rollback.py", "scripts/server-backup.py",
    "scripts/libredisplay", "scripts/field-readiness.py",
)
CORE_SHELL_FILES = (
    "install.sh", "update.sh", "uninstall.sh",
    "scripts/backup.sh", "scripts/docker-setup.sh", "scripts/restore.sh",
    "scripts/setup-media.sh", "scripts/setup-nas.sh", "scripts/start.sh",
    "scripts/viewer-setup.sh", "scripts/libredisplay-privileged",
)


def user_home() -> Path:
    sudo_user = os.environ.get("SUDO_USER", "").strip()
    if sudo_user:
        try:
            import pwd
            return Path(pwd.getpwnam(sudo_user).pw_dir)
        except Exception:
            pass
    return Path.home()


def default_install_dir() -> Path:
    return user_home() / "libredisplay"


def default_rollback_root() -> Path:
    return user_home() / "libredisplay-rollbacks"


def safe_id(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(value or "").strip()).strip(".-")[:120]
    if not value or value in {".", ".."}:
        raise ValueError("Invalid rollback snapshot id")
    return value


def unique_snapshot_id(base: str, rollback_root: Path) -> str:
    base = safe_id(base)
    candidate = base
    n = 2
    while (rollback_root / candidate).exists() or (rollback_root / f".{candidate}.tmp-{os.getpid()}").exists():
        suffix = f"-{os.getpid()}-{n}"
        candidate = safe_id(base[:max(1, 120 - len(suffix))] + suffix)
        n += 1
    return candidate


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(CHUNK), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_regular_tree(root: Path):
    if root.is_symlink() or not root.is_dir():
        raise RuntimeError(f"Unsafe release directory: {root}")
    for current, dirs, files in os.walk(root, followlinks=False):
        base = Path(current)
        for name in dirs:
            if (base / name).is_symlink():
                raise RuntimeError(f"Refusing to snapshot symbolic link: {base / name}")
        for name in files:
            path = base / name
            if path.is_symlink() or not stat.S_ISREG(path.stat().st_mode):
                raise RuntimeError(f"Refusing to snapshot non-regular file: {path}")


def copy_release_code(install_dir: Path, destination: Path):
    release = destination / "release"
    release.mkdir(parents=True, mode=0o700, exist_ok=False)
    for name in CODE_DIRS:
        src = install_dir / name
        if not src.is_dir():
            if name in OPTIONAL_CODE_DIRS:
                continue
            raise RuntimeError(f"Installed LibreDisplay is missing {name}/")
        ensure_regular_tree(src)
        shutil.copytree(src, release / name, symlinks=False)
    for name in TOP_FILES:
        src = install_dir / name
        if not src.exists():
            if name in OPTIONAL_TOP_FILES:
                continue
            raise RuntimeError(f"Installed LibreDisplay is missing {name}")
        if src.is_symlink() or not src.is_file():
            raise RuntimeError(f"Unsafe installed release file: {src}")
        shutil.copy2(src, release / name)
    return release


def release_manifest(release: Path):
    rows = []
    total = 0
    for path in sorted(p for p in release.rglob("*") if p.is_file()):
        if path.is_symlink():
            raise RuntimeError(f"Rollback snapshot contains a symbolic link: {path}")
        rel = path.relative_to(release).as_posix()
        size = path.stat().st_size
        total += size
        rows.append({
            "path": rel,
            "size": size,
            "sha256": sha256_file(path),
            "mode": oct(path.stat().st_mode & 0o777),
        })
    return rows, total


def metadata_path(snapshot_dir: Path) -> Path:
    return snapshot_dir / "snapshot.json"


def load_metadata(snapshot_dir: Path):
    try:
        raw = json.loads(metadata_path(snapshot_dir).read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError("Rollback snapshot metadata is invalid") from exc
    if raw.get("product") != "LibreDisplay" or raw.get("kind") != "release-rollback" or int(raw.get("format") or 0) != FORMAT_VERSION:
        raise ValueError("Unsupported rollback snapshot")
    return raw


def verify_snapshot(snapshot_dir: Path):
    raw = load_metadata(snapshot_dir)
    release = snapshot_dir / "release"
    backup = snapshot_dir / "pre-update.ldbackup"
    if not release.is_dir() or not backup.is_file() or backup.is_symlink():
        raise ValueError("Rollback snapshot is incomplete")
    expected = raw.get("files")
    if not isinstance(expected, list):
        raise ValueError("Rollback snapshot file manifest is invalid")
    actual, _ = release_manifest(release)
    if actual != expected:
        raise ValueError("Rollback snapshot application files failed verification")
    if backup.stat().st_size != int(raw.get("backupBytes") or -1) or sha256_file(backup) != str(raw.get("backupSha256") or ""):
        raise ValueError("Rollback snapshot data backup failed verification")
    return raw


def snapshot_summary(snapshot_dir: Path):
    try:
        raw = load_metadata(snapshot_dir)
    except Exception:
        return None
    return {
        "id": safe_id(raw.get("id") or snapshot_dir.name),
        "fromVersion": str(raw.get("fromVersion") or "unknown")[:40],
        "toVersion": str(raw.get("toVersion") or "")[:40],
        "createdUtc": str(raw.get("createdUtc") or "")[:64],
        "backupBytes": int(raw.get("backupBytes") or 0),
        "codeBytes": int(raw.get("codeBytes") or 0),
    }


def list_snapshots(rollback_root: Path | None = None):
    root = (rollback_root or default_rollback_root()).expanduser().resolve()
    if not root.is_dir():
        return []
    rows = []
    for child in root.iterdir():
        if child.is_dir() and not child.name.startswith("."):
            row = snapshot_summary(child)
            if row:
                rows.append(row)
    rows.sort(key=lambda row: row.get("createdUtc") or "", reverse=True)
    return rows


def prune_snapshots(rollback_root: Path, keep: int = ROLLBACK_KEEP, protect_ids=()):
    protected = {safe_id(x) for x in protect_ids if x}
    rows = list_snapshots(rollback_root)
    kept = 0
    for row in rows:
        if row["id"] in protected:
            continue
        kept += 1
        if kept <= max(1, int(keep or ROLLBACK_KEEP)):
            continue
        shutil.rmtree(rollback_root / row["id"], ignore_errors=True)


def create_snapshot(install_dir: Path, rollback_root: Path, to_version: str = "", quiet: bool = False, protect_ids=()):
    install_dir = install_dir.expanduser().resolve()
    rollback_root = rollback_root.expanduser().resolve()
    version_path = install_dir / "VERSION"
    backup_script = install_dir / "scripts" / "backup.sh"
    if not version_path.is_file() or not backup_script.is_file():
        raise RuntimeError(f"LibreDisplay installation was not found at {install_dir}")
    from_version = version_path.read_text(encoding="utf-8").strip() or "unknown"
    stamp = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    target_label = re.sub(r"[^0-9A-Za-z_.-]+", "-", str(to_version or "next"))[:40]
    base_id = safe_id(f"update-{stamp.strftime('%Y%m%d-%H%M%S')}-v{from_version}-to-v{target_label}")
    rollback_root.mkdir(parents=True, exist_ok=True)
    os.chmod(rollback_root, 0o700)
    snap_id = unique_snapshot_id(base_id, rollback_root)
    final = rollback_root / snap_id
    tmp = rollback_root / f".{snap_id}.tmp-{os.getpid()}"
    tmp.mkdir(mode=0o700)
    try:
        release = copy_release_code(install_dir, tmp)
        backup = tmp / "pre-update.ldbackup"
        if not quiet:
            print("Creating the pre-update data/media backup…", file=sys.stderr)
        result = subprocess.run([str(backup_script), str(backup)], cwd=str(install_dir), check=False, stdout=(subprocess.DEVNULL if quiet else None), stderr=(subprocess.DEVNULL if quiet else None))
        if result.returncode != 0 or not backup.is_file():
            raise RuntimeError("Could not create the pre-update LibreDisplay backup")
        os.chmod(backup, 0o600)
        files, code_bytes = release_manifest(release)
        payload = {
            "product": "LibreDisplay",
            "kind": "release-rollback",
            "format": FORMAT_VERSION,
            "id": snap_id,
            "createdUtc": stamp.isoformat(),
            "fromVersion": from_version,
            "toVersion": str(to_version or "")[:40],
            "codeBytes": code_bytes,
            "backupBytes": backup.stat().st_size,
            "backupSha256": sha256_file(backup),
            "files": files,
        }
        metadata_path(tmp).write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        os.chmod(metadata_path(tmp), 0o600)
        os.replace(tmp, final)
        os.chmod(final, 0o700)
        prune_snapshots(rollback_root, ROLLBACK_KEEP, protect_ids=(snap_id, *tuple(protect_ids)))
    except Exception:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    if not quiet:
        print(f"Rollback snapshot ready: {final}", file=sys.stderr)
    return snap_id


def atomic_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)
    os.chmod(path, 0o600)


def append_history(install_dir: Path, event: str, **fields):
    path = install_dir / "data" / "maintenance_history.json"
    try:
        raw = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    except Exception:
        raw = {}
    items = raw.get("items") if isinstance(raw, dict) else []
    if not isinstance(items, list):
        items = []
    row = {"event": str(event)[:40], "createdUtc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()}
    for key, value in fields.items():
        row[str(key)[:40]] = str(value)[:240]
    items.insert(0, row)
    atomic_json(path, {"version": 1, "items": items[:50]})


def update_transaction_path(install_dir: Path) -> Path:
    return install_dir / "data" / UPDATE_TRANSACTION_NAME


def load_update_transaction(install_dir: Path):
    path = update_transaction_path(install_dir)
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError("Pending update transaction metadata is invalid") from exc
    if not isinstance(raw, dict) or raw.get("product") != "LibreDisplay" or raw.get("kind") != "update-transaction" or int(raw.get("format") or 0) != FORMAT_VERSION:
        raise ValueError("Pending update transaction metadata is unsupported")
    raw["snapshotId"] = safe_id(raw.get("snapshotId") or "")
    state = str(raw.get("state") or "")
    if state not in UPDATE_TRANSACTION_STATES:
        raise ValueError("Pending update transaction state is invalid")
    raw["state"] = state
    return raw


def record_update_transaction(install_dir: Path, rollback_root: Path, snapshot_id: str, state: str):
    state = str(state or "").strip().lower()
    if state not in UPDATE_TRANSACTION_STATES:
        raise ValueError("Invalid update transaction state")
    snapshot_id = safe_id(snapshot_id)
    snapshot_dir = rollback_root.expanduser().resolve() / snapshot_id
    meta = verify_snapshot(snapshot_dir)
    path = update_transaction_path(install_dir)
    existing = None
    if path.is_file():
        existing = load_update_transaction(install_dir)
        if existing.get("snapshotId") != snapshot_id:
            raise RuntimeError("Another LibreDisplay update transaction is already pending")
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    payload = {
        "product": "LibreDisplay",
        "kind": "update-transaction",
        "format": FORMAT_VERSION,
        "snapshotId": snapshot_id,
        "fromVersion": str(meta.get("fromVersion") or "unknown")[:40],
        "toVersion": str(meta.get("toVersion") or "")[:40],
        "state": state,
        "createdUtc": str((existing or {}).get("createdUtc") or now)[:64],
        "updatedUtc": now,
    }
    atomic_json(path, payload)
    return payload


def clear_update_transaction(install_dir: Path, snapshot_id: str = ""):
    path = update_transaction_path(install_dir)
    if not path.exists():
        return
    if snapshot_id:
        raw = load_update_transaction(install_dir)
        if raw.get("snapshotId") != safe_id(snapshot_id):
            raise RuntimeError("Pending update transaction does not match the requested snapshot")
    path.unlink(missing_ok=True)


def verify_installed_release(install_dir: Path, expected_version: str = ""):
    install_dir = install_dir.expanduser().resolve()
    missing = []
    for rel in CORE_RUNTIME_FILES:
        path = install_dir / rel
        if not path.is_file() or path.is_symlink():
            missing.append(rel)
    if missing:
        raise RuntimeError("Installed LibreDisplay is incomplete: " + ", ".join(missing[:6]))
    version = (install_dir / "VERSION").read_text(encoding="utf-8").strip()
    if expected_version and version != str(expected_version).strip():
        raise RuntimeError(f"Installed LibreDisplay version mismatch: expected {expected_version}, found {version or 'unknown'}")
    for rel in CORE_PYTHON_FILES:
        path = install_dir / rel
        try:
            compile(path.read_text(encoding="utf-8"), str(path), "exec")
        except Exception as exc:
            raise RuntimeError(f"Installed LibreDisplay Python validation failed for {rel}: {exc}") from exc
    for rel in CORE_SHELL_FILES:
        path = install_dir / rel
        result = subprocess.run(
            ["/bin/sh", "-n", str(path)], cwd=str(install_dir), stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10, check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Installed LibreDisplay shell validation failed for {rel}")
    verifier = install_dir / "scripts" / "verify-frontend.py"
    result = subprocess.run(
        [sys.executable, str(verifier), str(install_dir)],
        cwd=str(install_dir), stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=45, check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("Installed LibreDisplay frontend validation failed")
    return {
        "ok": True,
        "version": version,
        "checkedAt": int(dt.datetime.now(dt.timezone.utc).timestamp()),
        "coreFiles": len(CORE_RUNTIME_FILES),
        "pythonFiles": len(CORE_PYTHON_FILES),
        "shellFiles": len(CORE_SHELL_FILES),
        "frontendVerified": True,
    }


def installed_matches_snapshot(snapshot_dir: Path, install_dir: Path):
    raw = verify_snapshot(snapshot_dir)
    expected = raw.get("files") or []
    expected_map = {str(row.get("path") or ""): row for row in expected if isinstance(row, dict)}
    for rel, row in expected_map.items():
        path = install_dir / rel
        if not path.is_file() or path.is_symlink():
            return False
        if path.stat().st_size != int(row.get("size") or -1):
            return False
        if sha256_file(path) != str(row.get("sha256") or ""):
            return False
    for name in OPTIONAL_CODE_DIRS:
        if not any(rel == name or rel.startswith(name + "/") for rel in expected_map) and (install_dir / name).exists():
            return False
    for name in OPTIONAL_TOP_FILES:
        if name not in expected_map and (install_dir / name).exists():
            return False
    return True


def recover_pending_update(install_dir: Path, rollback_root: Path):
    install_dir = install_dir.expanduser().resolve()
    rollback_root = rollback_root.expanduser().resolve()
    transaction = load_update_transaction(install_dir)
    if not transaction:
        return {"ok": True, "state": "none"}
    snapshot_id = transaction["snapshotId"]
    snapshot_dir = rollback_root / snapshot_id
    meta = verify_snapshot(snapshot_dir)
    from_version = str(meta.get("fromVersion") or "unknown")
    to_version = str(meta.get("toVersion") or "")
    state = transaction["state"]

    # If the updater validated the new release before power was lost, keep it only
    # when the installed tree still passes the same runtime checks.
    if state == "validated":
        try:
            verify_installed_release(install_dir, to_version)
        except Exception:
            pass
        else:
            clear_update_transaction(install_dir, snapshot_id)
            append_history(install_dir, "update-recovered-complete", fromVersion=from_version, toVersion=to_version, snapshotId=snapshot_id)
            return {"ok": True, "state": "completed", "snapshotId": snapshot_id, "version": to_version}

    # If replacement never began and the old application exactly matches the
    # snapshot, no restore is needed; just clear the abandoned transaction.
    if state == "prepared" and installed_matches_snapshot(snapshot_dir, install_dir):
        clear_update_transaction(install_dir, snapshot_id)
        append_history(install_dir, "update-interrupted-no-change", fromVersion=from_version, toVersion=to_version, snapshotId=snapshot_id)
        return {"ok": True, "state": "unchanged", "snapshotId": snapshot_id, "version": from_version}

    # A power loss during replacement leaves an uncertain application tree. The
    # pre-update snapshot was captured while LibreDisplay was stopped, so restoring
    # it is safer than trying to continue an incomplete swap.
    apply_snapshot_payload(snapshot_dir, install_dir)
    if not installed_matches_snapshot(snapshot_dir, install_dir):
        raise RuntimeError("Restored pre-update application files failed snapshot verification")
    clear_update_transaction(install_dir)
    append_history(install_dir, "update-auto-recovered", fromVersion=to_version or "interrupted", toVersion=from_version, snapshotId=snapshot_id)
    if PRIVILEGED_HELPER.is_file() and shutil.which("sudo"):
        subprocess.run(["sudo", "-n", str(PRIVILEGED_HELPER), "install-cli"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    return {"ok": True, "state": "restored", "snapshotId": snapshot_id, "version": from_version}


def stop_runtime(install_dir: Path):
    subprocess.run(["pkill", "-f", str(install_dir / "scripts" / "start.sh")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    subprocess.run(["pkill", "-f", str(install_dir / "app" / "dashboard_server.py")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    subprocess.run(["pkill", "-f", f"--user-data-dir={install_dir / 'data' / 'chromium'}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    for name in ("SingletonCookie", "SingletonLock", "SingletonSocket"):
        path = install_dir / "data" / "chromium" / name
        if path.is_symlink():
            path.unlink(missing_ok=True)


def replace_release_code(snapshot_dir: Path, install_dir: Path):
    release = snapshot_dir / "release"
    for name in CODE_DIRS:
        src = release / name
        dst = install_dir / name
        if dst.exists():
            shutil.rmtree(dst)
        if src.is_dir():
            shutil.copytree(src, dst, symlinks=False)
        elif name not in OPTIONAL_CODE_DIRS:
            raise RuntimeError(f"Rollback snapshot is missing required {name}/")
    for name in TOP_FILES:
        src = release / name
        dst = install_dir / name
        if src.is_file():
            shutil.copy2(src, dst)
        elif name in OPTIONAL_TOP_FILES:
            dst.unlink(missing_ok=True)
        else:
            raise RuntimeError(f"Rollback snapshot is missing required {name}")


def apply_snapshot_payload(snapshot_dir: Path, install_dir: Path):
    raw = verify_snapshot(snapshot_dir)
    replace_release_code(snapshot_dir, install_dir)
    restore_script = install_dir / "scripts" / "restore.sh"
    backup = snapshot_dir / "pre-update.ldbackup"
    if not restore_script.is_file():
        raise RuntimeError("The rollback release is missing scripts/restore.sh")
    # Run through /bin/sh so rollback does not depend on historical executable-bit state.
    result = subprocess.run(["/bin/sh", str(restore_script), str(backup), "--yes"], cwd=str(install_dir), check=False, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if result.returncode != 0:
        detail = " ".join((result.stdout or "").splitlines()[-4:])[:700]
        raise RuntimeError("The snapshot data backup could not be restored" + (f": {detail}" if detail else ""))
    if not installed_matches_snapshot(snapshot_dir, install_dir):
        raise RuntimeError(f"Rollback restored data but application files do not match v{raw.get('fromVersion','unknown')}")


def restore_snapshot(snapshot_id: str, install_dir: Path, rollback_root: Path, no_reboot: bool = False):
    snapshot_id = safe_id(snapshot_id)
    install_dir = install_dir.expanduser().resolve()
    rollback_root = rollback_root.expanduser().resolve()
    snapshot_dir = rollback_root / snapshot_id
    raw = verify_snapshot(snapshot_dir)
    current = (install_dir / "VERSION").read_text(encoding="utf-8").strip() if (install_dir / "VERSION").is_file() else "unknown"
    target = str(raw.get("fromVersion") or "unknown")
    history_path = install_dir / "data" / "maintenance_history.json"
    try:
        current_history = json.loads(history_path.read_text(encoding="utf-8")).get("items", []) if history_path.is_file() else []
    except Exception:
        current_history = []
    if not isinstance(current_history, list):
        current_history = []
    stop_runtime(install_dir)
    # Keep the current state recoverable before replacing anything.
    forward_id = create_snapshot(install_dir, rollback_root, to_version=target, quiet=True, protect_ids=(snapshot_id,))
    try:
        apply_snapshot_payload(snapshot_dir, install_dir)
    except Exception as rollback_error:
        recovery_dir = rollback_root / forward_id
        try:
            verify_snapshot(recovery_dir)
            apply_snapshot_payload(recovery_dir, install_dir)
            append_history(install_dir, "rollback-failed-recovered", fromVersion=current, toVersion=target, snapshotId=snapshot_id, recoverySnapshotId=forward_id)
        except Exception as recovery_error:
            raise RuntimeError(
                f"Rollback failed and automatic recovery also failed. Recovery snapshot {forward_id} was preserved: {recovery_error}"
            ) from rollback_error
        raise RuntimeError(
            f"Rollback failed, but the prior LibreDisplay state was restored from recovery snapshot {forward_id}"
        ) from rollback_error
    # Preserve maintenance history recorded after the target snapshot was created.
    try:
        restored_history = json.loads(history_path.read_text(encoding="utf-8")).get("items", []) if history_path.is_file() else []
    except Exception:
        restored_history = []
    if not isinstance(restored_history, list):
        restored_history = []
    combined = []
    seen = set()
    for row in list(current_history) + list(restored_history):
        if not isinstance(row, dict):
            continue
        key = json.dumps(row, sort_keys=True, ensure_ascii=False)
        if key in seen:
            continue
        seen.add(key); combined.append(row)
    atomic_json(history_path, {"version": 1, "items": combined[:49]})
    append_history(install_dir, "rollback", fromVersion=current, toVersion=target, snapshotId=snapshot_id, recoverySnapshotId=forward_id)
    if PRIVILEGED_HELPER.is_file() and shutil.which("sudo"):
        subprocess.run(["sudo", "-n", str(PRIVILEGED_HELPER), "install-cli"], check=False)
    if no_reboot:
        print(f"LibreDisplay rollback complete: v{current} -> v{target}. Reboot when convenient.")
        return 0
    if PRIVILEGED_HELPER.is_file() and shutil.which("sudo"):
        result = subprocess.run(["sudo", "-n", str(PRIVILEGED_HELPER), "reboot"], check=False)
        if result.returncode == 0:
            return 0
    print("Rollback completed, but LibreDisplay could not reboot automatically. Run: sudo reboot", file=sys.stderr)
    return 1


def delete_snapshot(snapshot_id: str, rollback_root: Path):
    snapshot_id = safe_id(snapshot_id)
    path = rollback_root.expanduser().resolve() / snapshot_id
    if path.is_dir():
        shutil.rmtree(path)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Manage private LibreDisplay pre-update rollback snapshots.")
    parser.add_argument("--install-dir", default=str(default_install_dir()), help=argparse.SUPPRESS)
    parser.add_argument("--rollback-root", default=str(default_rollback_root()), help=argparse.SUPPRESS)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("snapshot", help="create a rollback snapshot before an update")
    p.add_argument("--to-version", default="")
    p.add_argument("--quiet", action="store_true")
    p = sub.add_parser("list", help="list rollback snapshots")
    p.add_argument("--json", action="store_true")
    p = sub.add_parser("verify", help="verify a rollback snapshot")
    p.add_argument("id")
    p = sub.add_parser("restore", help="restore a rollback snapshot")
    p.add_argument("id")
    p.add_argument("--no-reboot", action="store_true")
    p.add_argument("--start-delay", type=float, default=0.0, help=argparse.SUPPRESS)
    p = sub.add_parser("delete", help="delete a rollback snapshot")
    p.add_argument("id")
    p = sub.add_parser("record-update", help=argparse.SUPPRESS)
    p.add_argument("--from-version", required=True)
    p.add_argument("--to-version", required=True)
    p.add_argument("--snapshot-id", required=True)
    p = sub.add_parser("transaction", help=argparse.SUPPRESS)
    p.add_argument("--snapshot-id", required=True)
    p.add_argument("--state", required=True, choices=sorted(UPDATE_TRANSACTION_STATES))
    p = sub.add_parser("complete-update", help=argparse.SUPPRESS)
    p.add_argument("--snapshot-id", required=True)
    p = sub.add_parser("recover-pending", help=argparse.SUPPRESS)
    p = sub.add_parser("verify-install", help=argparse.SUPPRESS)
    p.add_argument("--expected-version", default="")
    p.add_argument("--json", action="store_true")
    p = sub.add_parser("verify-snapshot-install", help=argparse.SUPPRESS)
    p.add_argument("--snapshot-id", required=True)
    args = parser.parse_args(argv)
    install_dir = Path(args.install_dir)
    rollback_root = Path(args.rollback_root)
    try:
        if args.command == "snapshot":
            print(create_snapshot(install_dir, rollback_root, args.to_version, quiet=args.quiet))
        elif args.command == "list":
            rows = list_snapshots(rollback_root)
            print(json.dumps(rows, indent=2) if args.json else "\n".join(f"{r['id']}  v{r['fromVersion']}  {r['createdUtc']}" for r in rows))
        elif args.command == "verify":
            raw = verify_snapshot(rollback_root / safe_id(args.id)); print(f"Rollback snapshot verified: v{raw.get('fromVersion','unknown')}")
        elif args.command == "restore":
            delay = max(0.0, min(5.0, float(args.start_delay or 0.0)))
            if delay:
                time.sleep(delay)
            return restore_snapshot(args.id, install_dir, rollback_root, no_reboot=args.no_reboot)
        elif args.command == "delete":
            delete_snapshot(args.id, rollback_root)
        elif args.command == "record-update":
            append_history(install_dir, "update", fromVersion=args.from_version, toVersion=args.to_version, snapshotId=safe_id(args.snapshot_id))
        elif args.command == "transaction":
            record_update_transaction(install_dir, rollback_root, args.snapshot_id, args.state)
        elif args.command == "complete-update":
            clear_update_transaction(install_dir, args.snapshot_id)
        elif args.command == "recover-pending":
            result = recover_pending_update(install_dir, rollback_root)
            if result.get("state") != "none":
                print(f"LibreDisplay interrupted update recovery: {result.get('state')} · v{result.get('version','unknown')}")
        elif args.command == "verify-install":
            result = verify_installed_release(install_dir, args.expected_version)
            print(json.dumps(result, sort_keys=True) if args.json else f"LibreDisplay installation verified: v{result['version']}")
        elif args.command == "verify-snapshot-install":
            snapshot_id = safe_id(args.snapshot_id)
            if not installed_matches_snapshot(rollback_root / snapshot_id, install_dir):
                raise RuntimeError("Installed LibreDisplay does not match the rollback snapshot")
            print(f"LibreDisplay rollback snapshot matches installed files: {snapshot_id}")
        return 0
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"LibreDisplay rollback error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
