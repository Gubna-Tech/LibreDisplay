#!/bin/sh
set -eu
umask 077

VERSION="1.10.53"
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

printf '\nLibreDisplay %s one-command installer\n' "$VERSION"
printf '========================================\n'
printf 'Downloading the pinned v%s release from GitHub...\n' "$VERSION"
if ! curl --fail --location --silent --show-error --retry 3 --retry-delay 2 --proto '=https' --tlsv1.2 "$ASSET_URL" -o "$ARCHIVE"; then
  printf 'Versioned release asset was unavailable; falling back to the GitHub tag archive...\n'
  curl --fail --location --silent --show-error --retry 3 --retry-delay 2 --proto '=https' --tlsv1.2 "$TAG_URL" -o "$ARCHIVE"
fi
mkdir -p "$EXTRACT"

python3 - "$ARCHIVE" "$EXTRACT" "$VERSION" <<'PY'
from pathlib import Path
import sys, zipfile
archive=Path(sys.argv[1]); target=Path(sys.argv[2]).resolve(); version=sys.argv[3]
with zipfile.ZipFile(archive) as zf:
    members=zf.infolist()
    if not members:
        raise SystemExit('Downloaded archive is empty.')
    for item in members:
        name=item.filename.replace('\\','/')
        path=Path(name)
        if path.is_absolute() or '..' in path.parts:
            raise SystemExit(f'Unsafe archive path: {name}')
        resolved=(target/path).resolve()
        if target != resolved and target not in resolved.parents:
            raise SystemExit(f'Archive entry escapes extraction directory: {name}')
    zf.extractall(target)
root=target/f'LibreDisplay-{version}'
required=['VERSION','install.sh','app/dashboard.html','app/dashboard_server.py','scripts/verify-frontend.py']
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
