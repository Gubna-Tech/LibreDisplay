#!/bin/sh
set -eu
umask 077

VERSION="1.15.6"
REPOSITORY="Gubna-Tech/LibreDisplay"
INSTALL_DIR="$HOME/libredisplay"
TMP_ROOT=""

cleanup() {
  [ -n "${TMP_ROOT:-}" ] && [ -d "$TMP_ROOT" ] && rm -rf "$TMP_ROOT"
}
trap cleanup EXIT HUP INT TERM

if [ "$(id -u)" -eq 0 ]; then
  printf 'Run the LibreDisplay installer as your normal Raspberry Pi user, not root.\n' >&2
  exit 1
fi

if [ -d "$INSTALL_DIR" ] || [ -e "$INSTALL_DIR" ]; then
  printf 'LibreDisplay already appears to be installed at %s.\n' "$INSTALL_DIR" >&2
  if command -v libredisplay >/dev/null 2>&1; then
    printf 'Use: libredisplay update\n' >&2
  elif [ -x "$INSTALL_DIR/update.sh" ]; then
    printf 'Use: %s/update.sh\n' "$INSTALL_DIR" >&2
  else
    printf 'Use the update instructions for your installed release; this fresh-install bootstrap will not overwrite it.\n' >&2
  fi
  exit 1
fi

command -v curl >/dev/null 2>&1 || { printf 'curl is required for the one-command installer. Install it with: sudo apt install -y curl\n' >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { printf 'python3 is required for the one-command installer.\n' >&2; exit 1; }

TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/libredisplay-install.XXXXXX")
ARCHIVE="$TMP_ROOT/LibreDisplay.zip"
EXTRACT="$TMP_ROOT/extracted"
ASSET_URL="https://github.com/$REPOSITORY/releases/download/v$VERSION/LibreDisplay-v$VERSION.zip"
TAG_URL="https://github.com/$REPOSITORY/archive/refs/tags/v$VERSION.zip"
SOURCE_KIND="asset"

printf '\nLibreDisplay %s one-command installer\n' "$VERSION"
printf '========================================\n'
printf 'Downloading the pinned v%s release from GitHub...\n' "$VERSION"
if ! curl --fail --location --silent --show-error --retry 3 --retry-delay 2 --proto '=https' --tlsv1.2 "$ASSET_URL" -o "$ARCHIVE"; then
  printf 'Versioned release asset was unavailable; falling back to the GitHub tag archive...\n'
  SOURCE_KIND="tag"
  curl --fail --location --silent --show-error --retry 3 --retry-delay 2 --proto '=https' --tlsv1.2 "$TAG_URL" -o "$ARCHIVE"
fi

if [ "$SOURCE_KIND" = "asset" ]; then
  python3 - "$ARCHIVE" "$REPOSITORY" "$VERSION" <<'PY'
from pathlib import Path
import hashlib, hmac, json, re, sys, urllib.error, urllib.request

archive=Path(sys.argv[1]); repository=sys.argv[2]; version=sys.argv[3]
api=f"https://api.github.com/repos/{repository}/releases/tags/v{version}"
request=urllib.request.Request(api, headers={
    "User-Agent": f"LibreDisplay/{version} installer",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
})
try:
    with urllib.request.urlopen(request, timeout=15) as response:
        release=json.loads(response.read().decode("utf-8"))
except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
    print(f"Release metadata was unavailable ({exc}); continuing with archive structure/version verification.", file=sys.stderr)
else:
    expected_name=f"LibreDisplay-v{version}.zip"
    asset=next((row for row in (release.get("assets") or []) if str(row.get("name") or "") == expected_name), None)
    if not asset:
        raise SystemExit(f"GitHub release metadata does not contain the expected asset: {expected_name}")
    try:
        expected_size=int(asset.get("size") or 0)
    except (TypeError, ValueError, OverflowError):
        expected_size=0
    if expected_size and archive.stat().st_size != expected_size:
        raise SystemExit("Downloaded release size does not match GitHub release metadata.")
    digest=str(asset.get("digest") or "").strip().lower()
    if digest:
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
            raise SystemExit("GitHub release metadata contains an invalid asset digest.")
        hasher=hashlib.sha256()
        with archive.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1024*1024), b""):
                hasher.update(chunk)
        actual="sha256:"+hasher.hexdigest()
        if not hmac.compare_digest(actual, digest):
            raise SystemExit("Downloaded release failed GitHub SHA-256 verification.")
        print("GitHub release asset SHA-256 verified.")
    else:
        print("GitHub did not provide an asset digest; continuing with archive structure/version verification.", file=sys.stderr)
PY
fi
mkdir -p "$EXTRACT"

python3 - "$ARCHIVE" "$EXTRACT" "$VERSION" <<'PY'
from pathlib import Path, PurePosixPath
import stat, sys, zipfile
archive=Path(sys.argv[1]); target=Path(sys.argv[2]).resolve(); version=sys.argv[3]
MAX_ARCHIVE_BYTES=300*1024*1024
MAX_MEMBER_BYTES=150*1024*1024
MAX_TOTAL_UNPACKED_BYTES=700*1024*1024
MAX_MEMBERS=20000
if archive.stat().st_size > MAX_ARCHIVE_BYTES:
    raise SystemExit('Downloaded release archive is unexpectedly large.')
with zipfile.ZipFile(archive) as zf:
    members=zf.infolist()
    if not members:
        raise SystemExit('Downloaded archive is empty.')
    if len(members) > MAX_MEMBERS:
        raise SystemExit('Downloaded release contains too many files.')
    seen=set(); total=0
    for item in members:
        name=item.filename.replace('\\','/')
        path=PurePosixPath(name)
        if not name or path.is_absolute() or '..' in path.parts:
            raise SystemExit(f'Unsafe archive path: {name}')
        normalized=path.as_posix()
        if normalized in seen:
            raise SystemExit(f'Duplicate archive entry: {normalized}')
        seen.add(normalized)
        mode=(item.external_attr >> 16) & 0xFFFF
        if stat.S_ISLNK(mode):
            raise SystemExit(f'Refusing symbolic link in release archive: {normalized}')
        if item.file_size > MAX_MEMBER_BYTES:
            raise SystemExit(f'Release archive member is unexpectedly large: {normalized}')
        total += item.file_size
        if total > MAX_TOTAL_UNPACKED_BYTES:
            raise SystemExit('Downloaded release expands beyond the safety limit.')
        resolved=(target/Path(*path.parts)).resolve()
        if target != resolved and target not in resolved.parents:
            raise SystemExit(f'Archive entry escapes extraction directory: {name}')
    zf.extractall(target)
root=target/f'LibreDisplay-{version}'
required=['VERSION','README.md','HELP.md','install.sh','app/dashboard.html','app/dashboard_server.py','app/qrcode_vendor.zip','scripts/verify-frontend.py']
for rel in required:
    if not (root/rel).is_file():
        raise SystemExit(f'Downloaded release is missing {rel}.')
if (root/'VERSION').read_text(encoding='utf-8').strip()!=version:
    raise SystemExit('Downloaded release version does not match the pinned installer version.')
print(root)
PY

RELEASE_DIR="$EXTRACT/LibreDisplay-$VERSION"
printf 'Release verified. Starting LibreDisplay installer...\n\n'
cd "$RELEASE_DIR"
sh ./install.sh "$@"
