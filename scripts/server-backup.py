#!/usr/bin/env python3
"""LibreDisplay sensitive server backup/restore.

The archive is deliberately unencrypted so it can be restored with Python's
standard library on a clean Pi. It is therefore marked sensitive, written with
0600 permissions, and contains checksums for every payload file.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import stat
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

FORMAT_VERSION = 1
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_HOST_SECRET_DIR = Path("/etc/libredisplay")
FSTAB_PATH = Path("/etc/fstab")
SKIP_DATA_DIRS = {"dashboard_cache", "broker"}
CHROMIUM_RUNTIME_LINKS = {"SingletonCookie", "SingletonLock", "SingletonSocket"}
MAX_FILES = 200_000
CHUNK = 1024 * 1024


def user_home() -> Path:
    sudo_user = os.environ.get("SUDO_USER", "").strip()
    if sudo_user:
        try:
            import pwd
            return Path(pwd.getpwnam(sudo_user).pw_dir)
        except Exception:
            pass
    return Path.home()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(CHUNK), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_rel(value: str) -> PurePosixPath:
    p = PurePosixPath(value)
    if p.is_absolute() or not p.parts or any(part in {"", ".", ".."} for part in p.parts):
        raise ValueError(f"Unsafe archive path: {value!r}")
    return p


def iter_regular_files(root: Path, prefix: str, *, skip_top=None, skip_symlink_rel=None):
    if not root.exists():
        return
    if root.is_symlink() or not root.is_dir():
        raise RuntimeError(f"Backup source must be a real directory: {root}")
    skip_symlink_rel = {str(value) for value in (skip_symlink_rel or ())}
    count = 0
    for current, dirs, files in os.walk(root, followlinks=False):
        cur = Path(current)
        rel_dir = cur.relative_to(root)
        if rel_dir == Path(".") and skip_top:
            dirs[:] = [d for d in dirs if d not in skip_top]
        dirs[:] = sorted(d for d in dirs if d not in {"__pycache__", ".git", ".pytest_cache"} and not (cur / d).is_symlink())
        for name in sorted(files):
            if name.endswith((".pyc", ".pyo")) or name in {".DS_Store"}:
                continue
            path = cur / name
            if path.is_symlink():
                rel_path = path.relative_to(root).as_posix()
                if rel_path in skip_symlink_rel:
                    continue
                raise RuntimeError(f"Refusing to back up symlink: {path}")
            mode = path.stat().st_mode
            if not stat.S_ISREG(mode):
                raise RuntimeError(f"Refusing to back up non-regular file: {path}")
            rel = PurePosixPath(prefix) / PurePosixPath(path.relative_to(root).as_posix())
            count += 1
            if count > MAX_FILES:
                raise RuntimeError("Backup contains too many files")
            yield path, rel


def managed_fstab_text() -> str:
    if not FSTAB_PATH.is_file() or not os.access(FSTAB_PATH, os.R_OK):
        return ""
    lines = FSTAB_PATH.read_text(encoding="utf-8", errors="replace").splitlines()
    out = []
    i = 0
    while i < len(lines):
        if lines[i].startswith("# LibreDisplay NAS:"):
            out.append(lines[i])
            if i + 1 < len(lines):
                out.append(lines[i + 1])
                i += 2
                continue
        i += 1
    return "\n".join(out).rstrip() + ("\n" if out else "")


def write_zip_entry(zf: zipfile.ZipFile, arcname: str, data: bytes, mode: int = 0o600):
    info = zipfile.ZipInfo(arcname, date_time=dt.datetime.now().timetuple()[:6])
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = (stat.S_IFREG | (mode & 0o777)) << 16
    zf.writestr(info, data)


def backup(args) -> int:
    version = (PROJECT_ROOT / "VERSION").read_text(encoding="utf-8").strip() if (PROJECT_ROOT / "VERSION").is_file() else "unknown"
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = Path(args.archive).expanduser() if args.archive else user_home() / "libredisplay-backups" / f"LibreDisplay-{stamp}.ldbackup"
    dest = dest.resolve()
    protected_roots = [(PROJECT_ROOT / name).resolve() for name in ("data", "media", "plugins")]
    if any(dest == root or root in dest.parents for root in protected_roots):
        raise ValueError("Write the backup outside LibreDisplay data/media/plugins so it cannot back up or overwrite itself")
    parent_was_missing = not dest.parent.exists()
    dest.parent.mkdir(parents=True, exist_ok=True)
    default_backup_dir = (user_home() / "libredisplay-backups").resolve()
    if parent_was_missing or (args.archive is None and dest.parent == default_backup_dir):
        os.chmod(dest.parent, 0o700)

    sources = []
    data_dir = PROJECT_ROOT / "data"
    media_dir = PROJECT_ROOT / "media"
    plugins_dir = PROJECT_ROOT / "plugins"
    if data_dir.exists():
        chromium_runtime_links = {f"chromium/{name}" for name in CHROMIUM_RUNTIME_LINKS}
        sources.extend(iter_regular_files(data_dir, "payload/data", skip_top=SKIP_DATA_DIRS, skip_symlink_rel=chromium_runtime_links))
    if media_dir.exists():
        sources.extend(iter_regular_files(media_dir, "payload/media"))
    if plugins_dir.exists():
        sources.extend(iter_regular_files(plugins_dir, "payload/plugins"))
    env_file = PROJECT_ROOT / ".env"
    if env_file.is_file() and not env_file.is_symlink():
        sources.append((env_file, PurePosixPath("payload/project/.env")))

    host_sources = []
    host_included = False
    host_skipped = False
    if args.include_host:
        host_dir = Path(args.host_secrets_dir).expanduser()
        if host_dir.exists():
            if not os.access(host_dir, os.R_OK | os.X_OK):
                raise PermissionError(f"Cannot read {host_dir}; rerun the backup with sufficient privileges")
            host_sources.extend(iter_regular_files(host_dir, "payload/host/etc-libredisplay"))
            host_included = True
        fstab = managed_fstab_text()
        if fstab:
            host_included = True
        elif FSTAB_PATH.exists() and not os.access(FSTAB_PATH, os.R_OK):
            host_skipped = True
    else:
        fstab = ""
        if DEFAULT_HOST_SECRET_DIR.exists():
            host_skipped = True

    all_sources = list(sources) + list(host_sources)
    if len(all_sources) > MAX_FILES:
        raise RuntimeError("Backup contains too many files")

    manifest = {
        "format": FORMAT_VERSION,
        "product": "LibreDisplay",
        "version": version,
        "createdUtc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "sensitive": True,
        "encrypted": False,
        "notes": "Contains credentials, display tokens, configuration, project-local media and plugins. Protect this file like a password.",
        "cacheExcluded": sorted(SKIP_DATA_DIRS),
        "hostStateIncluded": host_included,
        "hostStateSkipped": host_skipped,
        "files": [],
    }

    tmp = dest.with_name(dest.name + f".tmp-{os.getpid()}")
    try:
        with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as zf:
            for src, rel in all_sources:
                rel_str = rel.as_posix()
                st = src.stat()
                digest = sha256_file(src)
                info = zipfile.ZipInfo(rel_str, date_time=dt.datetime.fromtimestamp(st.st_mtime).timetuple()[:6])
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (stat.S_IFREG | (st.st_mode & 0o777)) << 16
                with src.open("rb") as fh, zf.open(info, "w", force_zip64=True) as out:
                    shutil.copyfileobj(fh, out, length=CHUNK)
                manifest["files"].append({"path": rel_str, "size": st.st_size, "sha256": digest, "mode": oct(st.st_mode & 0o777)})
            if fstab:
                data = fstab.encode("utf-8")
                rel_str = "payload/host/libredisplay-fstab.txt"
                write_zip_entry(zf, rel_str, data, 0o600)
                manifest["files"].append({"path": rel_str, "size": len(data), "sha256": hashlib.sha256(data).hexdigest(), "mode": "0o600"})
            manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")
            write_zip_entry(zf, "manifest.json", manifest_bytes, 0o600)
        os.chmod(tmp, 0o600)
        os.replace(tmp, dest)
        os.chmod(dest, 0o600)
    finally:
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass

    print(f"LibreDisplay sensitive backup created: {dest}")
    print("WARNING: this archive is NOT encrypted and may contain passwords, API tokens and display access tokens.")
    if host_skipped:
        print("NOTE: /etc/libredisplay or managed host mount state was not included. Use --include-host (often with sudo) for NAS host credentials/state.")
    print(f"Files: {len(manifest['files'])}; application version: {version}")
    return 0


def read_manifest(zf: zipfile.ZipFile):
    names = zf.namelist()
    if len(names) > MAX_FILES + 2:
        raise ValueError("Archive contains too many entries")
    if len(names) != len(set(names)):
        raise ValueError("Backup contains duplicate archive entries")
    if names.count("manifest.json") != 1:
        raise ValueError("Backup is missing a unique manifest.json")
    try:
        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
    except Exception as exc:
        raise ValueError("Backup manifest is invalid") from exc
    if manifest.get("product") != "LibreDisplay" or int(manifest.get("format") or 0) != FORMAT_VERSION:
        raise ValueError("Unsupported LibreDisplay backup format")
    rows = manifest.get("files")
    if not isinstance(rows, list) or len(rows) > MAX_FILES:
        raise ValueError("Backup file manifest is invalid")
    expected = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Backup file manifest is invalid")
        path = safe_rel(str(row.get("path") or "")).as_posix()
        if not path.startswith("payload/") or path in expected:
            raise ValueError("Backup contains an invalid or duplicate payload path")
        size = int(row.get("size"))
        if size < 0:
            raise ValueError("Backup contains an invalid file size")
        digest = str(row.get("sha256") or "").lower()
        if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            raise ValueError("Backup contains an invalid checksum")
        expected[path] = row
    actual = {n for n in names if n != "manifest.json"}
    if actual != set(expected):
        raise ValueError("Backup entries do not exactly match the signed manifest")
    for info in zf.infolist():
        safe_rel(info.filename)
        unix_mode = (info.external_attr >> 16) & 0o170000
        if unix_mode == stat.S_IFLNK:
            raise ValueError("Backup contains a symbolic link")
    return manifest, expected


def extract_verified(zf: zipfile.ZipFile, expected: dict, staging: Path):
    for rel, row in expected.items():
        info = zf.getinfo(rel)
        if info.file_size != int(row["size"]):
            raise ValueError(f"Size mismatch for {rel}")
        target = staging.joinpath(*safe_rel(rel).parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        h = hashlib.sha256()
        written = 0
        with zf.open(info, "r") as src, target.open("wb") as dst:
            while True:
                chunk = src.read(CHUNK)
                if not chunk:
                    break
                written += len(chunk)
                if written > info.file_size:
                    raise ValueError(f"Expanded size mismatch for {rel}")
                h.update(chunk)
                dst.write(chunk)
        if written != info.file_size or h.hexdigest() != row["sha256"]:
            raise ValueError(f"Checksum mismatch for {rel}")
        try:
            mode = int(str(row.get("mode") or "0o600"), 8)
        except ValueError:
            mode = 0o600
        os.chmod(target, mode & 0o777)


def strip_managed_fstab(lines):
    out = []
    i = 0
    while i < len(lines):
        if lines[i].startswith("# LibreDisplay NAS:"):
            i += 1
            if i < len(lines):
                i += 1
            continue
        out.append(lines[i])
        i += 1
    return out


def validate_managed_fstab_payload(text: str) -> str:
    lines = [line for line in str(text or "").splitlines() if line.strip()]
    if not lines:
        return ""
    if len(lines) % 2:
        raise ValueError("Backup contains malformed LibreDisplay fstab state")
    out = []
    for i in range(0, len(lines), 2):
        marker, entry = lines[i], lines[i + 1]
        if not marker.startswith("# LibreDisplay NAS: "):
            raise ValueError("Backup contains an unexpected fstab marker")
        name = marker.split(":", 1)[1].strip()
        if not name or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-" for ch in name):
            raise ValueError("Backup contains an invalid LibreDisplay NAS name")
        fields = entry.split()
        if len(fields) != 6 or fields[1] != f"/mnt/libredisplay/{name}" or fields[2] not in {"cifs", "nfs"} or fields[4:] != ["0", "0"]:
            raise ValueError("Backup contains an invalid LibreDisplay-managed fstab entry")
        if fields[2] == "cifs" and not fields[0].startswith("//"):
            raise ValueError("Backup contains an invalid CIFS source")
        if fields[2] == "nfs" and ":" not in fields[0]:
            raise ValueError("Backup contains an invalid NFS source")
        out.extend((marker, entry))
    return "\n".join(out).rstrip() + "\n"


def restore_host_state(payload: Path):
    secret_root = payload / "host" / "etc-libredisplay"
    fstab_file = payload / "host" / "libredisplay-fstab.txt"
    if not (secret_root.exists() or fstab_file.exists()):
        return
    if os.geteuid() != 0:
        raise PermissionError("This backup includes host/NAS state. Rerun restore with sudo so /etc/libredisplay and /etc/fstab can be restored.")

    host_backup = DEFAULT_HOST_SECRET_DIR.with_name(DEFAULT_HOST_SECRET_DIR.name + ".before-libredisplay-restore")
    fstab_before = FSTAB_PATH.read_bytes() if FSTAB_PATH.exists() else None
    changed_secret = False
    try:
        if secret_root.exists():
            if host_backup.exists():
                shutil.rmtree(host_backup)
            if DEFAULT_HOST_SECRET_DIR.exists():
                os.replace(DEFAULT_HOST_SECRET_DIR, host_backup)
            shutil.copytree(secret_root, DEFAULT_HOST_SECRET_DIR, symlinks=False)
            changed_secret = True
            for p in DEFAULT_HOST_SECRET_DIR.rglob("*"):
                if p.is_file():
                    os.chmod(p, 0o600)
            os.chmod(DEFAULT_HOST_SECRET_DIR, 0o700)
        if fstab_file.exists():
            current = FSTAB_PATH.read_text(encoding="utf-8", errors="replace").splitlines() if FSTAB_PATH.exists() else []
            clean = strip_managed_fstab(current)
            validated = validate_managed_fstab_payload(fstab_file.read_text(encoding="utf-8", errors="replace"))
            incoming = validated.strip().splitlines()
            text = "\n".join(clean).rstrip() + "\n"
            if incoming:
                text += "\n" + "\n".join(incoming).rstrip() + "\n"
            tmp = FSTAB_PATH.with_name("fstab.libredisplay-restore.tmp")
            tmp.write_text(text, encoding="utf-8")
            os.chmod(tmp, 0o644)
            os.replace(tmp, FSTAB_PATH)
    except Exception:
        try:
            if changed_secret and DEFAULT_HOST_SECRET_DIR.exists():
                shutil.rmtree(DEFAULT_HOST_SECRET_DIR)
            if host_backup.exists():
                os.replace(host_backup, DEFAULT_HOST_SECRET_DIR)
            if fstab_before is None:
                FSTAB_PATH.unlink(missing_ok=True)
            else:
                tmp = FSTAB_PATH.with_name("fstab.libredisplay-rollback.tmp")
                tmp.write_bytes(fstab_before)
                os.chmod(tmp, 0o644)
                os.replace(tmp, FSTAB_PATH)
        finally:
            raise
    else:
        if host_backup.exists():
            shutil.rmtree(host_backup, ignore_errors=True)


def replace_tree(src: Path, dst: Path, rollback_root: Path):
    backup = rollback_root / dst.name
    if dst.exists():
        os.replace(dst, backup)
    if src.exists():
        os.replace(src, dst)
    else:
        dst.mkdir(parents=True, exist_ok=True)


def restore(args) -> int:
    archive = Path(args.archive).expanduser().resolve()
    if not archive.is_file():
        raise FileNotFoundError(f"Backup not found: {archive}")
    staging_parent = PROJECT_ROOT.parent
    with zipfile.ZipFile(archive, "r") as zf:
        manifest, expected = read_manifest(zf)
        if not manifest.get("sensitive"):
            raise ValueError("Backup does not identify itself as a sensitive LibreDisplay server backup")
        with tempfile.TemporaryDirectory(prefix=".libredisplay-restore-", dir=staging_parent) as tmpdir:
            stage = Path(tmpdir)
            extract_verified(zf, expected, stage)
            payload = stage / "payload"
            if args.verify_only:
                print(f"Backup verified: {archive}")
                print(f"LibreDisplay version: {manifest.get('version', 'unknown')}; files: {len(expected)}")
                return 0

            if not args.yes:
                print("This will replace LibreDisplay data, project-local media, plugins and .env with the backup contents.")
                print("The archive may also replace /etc/libredisplay and LibreDisplay-managed /etc/fstab entries if host state is present.")
                answer = input("Continue restore? [y/N] ").strip().lower()
                if answer not in {"y", "yes"}:
                    print("Restore cancelled.")
                    return 0

            rollback = PROJECT_ROOT / f".restore-rollback-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}"
            rollback.mkdir(mode=0o700)
            try:
                replace_tree(payload / "data", PROJECT_ROOT / "data", rollback)
                replace_tree(payload / "media", PROJECT_ROOT / "media", rollback)
                replace_tree(payload / "plugins", PROJECT_ROOT / "plugins", rollback)
                env_src = payload / "project" / ".env"
                env_dst = PROJECT_ROOT / ".env"
                if env_dst.exists():
                    shutil.copy2(env_dst, rollback / ".env")
                if env_src.exists():
                    shutil.copy2(env_src, env_dst)
                    os.chmod(env_dst, 0o600)
                elif env_dst.exists():
                    env_dst.unlink()
                restore_host_state(payload)
            except Exception:
                # Roll back project-local trees. Host state is intentionally restored last,
                # so project failures happen before /etc is changed.
                for name in ("data", "media", "plugins"):
                    dst = PROJECT_ROOT / name
                    old = rollback / name
                    if dst.exists():
                        shutil.rmtree(dst)
                    if old.exists():
                        os.replace(old, dst)
                old_env = rollback / ".env"
                if old_env.exists():
                    shutil.copy2(old_env, PROJECT_ROOT / ".env")
                raise
            finally:
                if rollback.exists():
                    shutil.rmtree(rollback, ignore_errors=True)

    print(f"LibreDisplay backup restored: {archive}")
    print("Restart LibreDisplay (or reboot the Pi) so every restored setting is reloaded.")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Create or restore a sensitive LibreDisplay server backup.")
    sub = parser.add_subparsers(dest="command", required=True)
    p_backup = sub.add_parser("backup", help="create a sensitive .ldbackup archive")
    p_backup.add_argument("archive", nargs="?", help="destination archive; defaults to ~/libredisplay-backups/")
    p_backup.add_argument("--include-host", action="store_true", help="include /etc/libredisplay and LibreDisplay-managed fstab entries (use sudo if required)")
    p_backup.add_argument("--host-secrets-dir", default=str(DEFAULT_HOST_SECRET_DIR), help=argparse.SUPPRESS)
    p_backup.set_defaults(func=backup)

    p_restore = sub.add_parser("restore", help="restore a sensitive .ldbackup archive")
    p_restore.add_argument("archive", help="backup archive to restore")
    p_restore.add_argument("--yes", "-y", action="store_true", help="restore without an interactive confirmation")
    p_restore.add_argument("--verify-only", action="store_true", help="verify manifest, paths, sizes and SHA-256 checksums without changing files")
    p_restore.set_defaults(func=restore)

    args = parser.parse_args(argv)
    try:
        return int(args.func(args) or 0)
    except (OSError, ValueError, RuntimeError, PermissionError, zipfile.BadZipFile) as exc:
        print(f"LibreDisplay backup error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
