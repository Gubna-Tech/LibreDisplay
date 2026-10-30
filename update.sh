#!/bin/sh
set -eu
umask 077

NO_REBOOT=0
for arg in "$@"; do
  case "$arg" in
    --no-reboot) NO_REBOOT=1 ;;
    -h|--help)
      printf 'Usage: %s [--no-reboot]\n' "$0"
      printf 'Updates an existing native LibreDisplay installation while keeping its data and media.\n'
      exit 0
      ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

if [ "$(id -u)" -eq 0 ]; then
  printf 'Run the LibreDisplay updater as your normal Raspberry Pi user, not root or through sudo.\n' >&2
  exit 1
fi

SRC_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INSTALL_DIR="$HOME/libredisplay"
DATA_DIR="$INSTALL_DIR/data"

server_only_requested() {
  if [ -f "$DATA_DIR/server-mode.json" ] && grep -Eq '"serverOnly"[[:space:]]*:[[:space:]]*true' "$DATA_DIR/server-mode.json" 2>/dev/null; then
    return 0
  fi
  if [ -f "$DATA_DIR/libredisplay.env" ] && grep -Eiq "^[[:space:]]*(export[[:space:]]+)?DASHBOARD_NO_BROWSER[[:space:]]*=[[:space:]]*['\"]?(1|true|yes|on)['\"]?[[:space:]]*$" "$DATA_DIR/libredisplay.env" 2>/dev/null; then
    return 0
  fi
  return 1
}

WAS_RUNTIME_RUNNING=0
start_installed_server_headlessly() {
  START_LOG="$DATA_DIR/start.log"
  nohup /bin/sh -c 'set -a; [ ! -f "$1/data/libredisplay.env" ] || . "$1/data/libredisplay.env"; set +a; exec python3 -I -B "$1/app/dashboard_server.py"' sh "$INSTALL_DIR" >>"$START_LOG" 2>&1 </dev/null &
}

restart_installed_runtime_after_failure() {
  [ "$WAS_RUNTIME_RUNNING" -eq 1 ] || return 0
  START_LOG="$DATA_DIR/start.log"
  if [ -n "${WAYLAND_DISPLAY:-}${DISPLAY:-}" ] || server_only_requested; then
    nohup /bin/sh "$INSTALL_DIR/scripts/start.sh" >>"$START_LOG" 2>&1 </dev/null &
    printf 'The previous LibreDisplay runtime was restarted after the failed update.\n' >&2
  else
    # An SSH update can lack the compositor environment even when the wall display
    # normally uses Chromium. Restore server availability without starting a
    # browser in a broken graphics context; the normal kiosk returns on reboot.
    start_installed_server_headlessly
    printf 'The previous LibreDisplay server was restarted headlessly after the failed update; reboot when convenient to restore the local kiosk.\n' >&2
  fi
}

[ -f "$SRC_DIR/VERSION" ] || { printf 'This does not look like a LibreDisplay release folder.\n' >&2; exit 1; }
for required in README.md HELP.md LICENSE install.sh update.sh uninstall.sh app/dashboard.html app/dashboard_server.py app/qrcode_vendor.zip app/js/app.js app/css/dashboard.css scripts/release-rollback.py scripts/update-health.py scripts/verify-frontend.py; do
  [ -f "$SRC_DIR/$required" ] || { printf 'LibreDisplay release is incomplete: missing %s\n' "$required" >&2; exit 1; }
done
[ -f "$SRC_DIR/scripts/verify-frontend.py" ] || { printf 'LibreDisplay release is incomplete: missing frontend verifier.\n' >&2; exit 1; }
printf 'Verifying modular frontend assets...\n'
python3 "$SRC_DIR/scripts/verify-frontend.py" "$SRC_DIR"
[ -d "$INSTALL_DIR" ] && [ -f "$DATA_DIR/.installed" ] || {
  printf 'No existing native LibreDisplay installation was found at %s.\n' "$INSTALL_DIR" >&2
  printf 'Use ./install.sh for a first installation.\n' >&2
  exit 1
}
[ "$SRC_DIR" != "$INSTALL_DIR" ] || {
  printf 'Run update.sh from a newly extracted LibreDisplay release, not from the installed copy.\n' >&2
  exit 1
}

NEW_VERSION=$(cat "$SRC_DIR/VERSION")
OLD_VERSION=$(cat "$DATA_DIR/.installed" 2>/dev/null || printf 'unknown')
# Keep a verified recovery implementation outside the application tree.
# It survives replacement of scripts/ during an interrupted installation.
RECOVERY_DIR="$HOME/libredisplay-recovery"
RECOVERY_GUARD="$RECOVERY_DIR/release-rollback.py"
mkdir -p "$RECOVERY_DIR"
chmod 700 "$RECOVERY_DIR"
if [ ! -f "$RECOVERY_GUARD" ]; then
  [ -f "$INSTALL_DIR/scripts/release-rollback.py" ] || {
    printf 'Existing recovery tooling is missing; refusing update.\n' >&2
    exit 1
  }
  recovery_temp=$(mktemp "$RECOVERY_DIR/.guard.XXXXXX")
  cp "$INSTALL_DIR/scripts/release-rollback.py" "$recovery_temp"
  chmod 600 "$recovery_temp"
  python3 - "$recovery_temp" <<'PYCOMPILE' || { rm -f "$recovery_temp"; exit 1; }
import sys
from pathlib import Path
path=Path(sys.argv[1])
compile(path.read_text(encoding="utf-8"),str(path),"exec")
PYCOMPILE
  mv "$recovery_temp" "$RECOVERY_GUARD"
fi
# An unknown or damaged rescue helper is an update blocker, not a reason to
# proceed without an independent recovery path.
python3 - "$RECOVERY_GUARD" <<'PYGUARD'
import ast, sys
from pathlib import Path
source=Path(sys.argv[1]).read_text(encoding='utf-8')
tree=ast.parse(source)
required={'recover_pending_update','verify_snapshot','apply_snapshot_payload'}
found={node.name for node in tree.body if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef))}
if required-found:raise SystemExit('The external recovery helper is incomplete')
PYGUARD

printf 'Validating the new release before stopping LibreDisplay...\n'
python3 "$SRC_DIR/scripts/release-rollback.py" --install-dir "$SRC_DIR" verify-install --expected-version "$NEW_VERSION" >/dev/null

# Critical power-loss boundary: the boot recovery launcher must be installed
# BEFORE we stop the working runtime or move even the first application path.
# Otherwise a power cut during scripts/ replacement leaves labwc pointing to
# a missing start.sh and there is no path to the off-tree verified snapshot.
printf 'Protecting next boot before starting the code transaction...\n'
python3 "$SRC_DIR/scripts/boot-provision.py" --release "$SRC_DIR" --home "$HOME" --require-autostart

printf '\nLibreDisplay Update\n'
printf '===================\n'
printf 'Current version: %s\n' "$OLD_VERSION"
printf 'New version:     %s\n' "$NEW_VERSION"

if command -v pgrep >/dev/null 2>&1; then
  if pgrep -f "$INSTALL_DIR/scripts/start.sh" >/dev/null 2>&1 || pgrep -f "$INSTALL_DIR/app/dashboard_server.py" >/dev/null 2>&1; then
    WAS_RUNTIME_RUNNING=1
  fi
fi

printf 'Stopping LibreDisplay and Chromium...\n'
pkill -f "$INSTALL_DIR/scripts/start.sh" 2>/dev/null || true
pkill -f "$INSTALL_DIR/app/dashboard_server.py" 2>/dev/null || true
pkill -f -- "--user-data-dir=$DATA_DIR/chromium" 2>/dev/null || true
sleep 1

recover_early_update_failure() {
  code=${1:-$?}
  trap - EXIT HUP INT TERM
  if [ "$code" -ne 0 ]; then
    printf 'Update preparation failed; the installed release was not replaced.\n' >&2
    restart_installed_runtime_after_failure
  fi
  exit "$code"
}
trap recover_early_update_failure EXIT
trap 'recover_early_update_failure 129' HUP
trap 'recover_early_update_failure 130' INT
trap 'recover_early_update_failure 143' TERM

# Chromium creates transient Singleton* symlinks while its profile is active.
# Older LibreDisplay backup code rejected those links, so remove only those
# known runtime links before invoking the installed backup during an upgrade.
for name in SingletonCookie SingletonLock SingletonSocket; do
  path="$DATA_DIR/chromium/$name"
  [ -L "$path" ] && rm -f -- "$path"
done

persistent_state_manifest() {
  python3 - "$DATA_DIR" <<'PYSTATE'
import hashlib, json, sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
files=[]
for name in ('dashboard_config.json','dashboard_config.previous.json','dashboard_profiles.json','dashboard_scenes.json','dashboard_endpoints.json','dashboard_household.json','dashboard_users.json','dashboard_access.json','remote_access.json'):
    p=root/name
    if p.is_file(): files.append(p)
for dirname in ('endpoints','calendar_files'):
    base=root/dirname
    if base.is_dir(): files.extend(p for p in sorted(base.rglob('*')) if p.is_file() and not p.is_symlink())
out={}
for p in sorted(set(files)):
    rel=p.relative_to(root).as_posix(); h=hashlib.sha256()
    with p.open('rb') as fh:
        for chunk in iter(lambda:fh.read(1024*1024),b''): h.update(chunk)
    out[rel]={'sha256':h.hexdigest(),'bytes':p.stat().st_size}
print(json.dumps(out,sort_keys=True,separators=(',',':')))
PYSTATE
}

printf 'Creating a safety backup and rollback snapshot...\n'
PERSISTENT_STATE_BEFORE=$(persistent_state_manifest)
SNAPSHOT_ID=$(python3 "$SRC_DIR/scripts/release-rollback.py" --install-dir "$INSTALL_DIR" snapshot --to-version "$NEW_VERSION" --quiet)
printf 'Rollback snapshot: %s\n' "$SNAPSHOT_ID"
python3 "$SRC_DIR/scripts/release-rollback.py" --install-dir "$INSTALL_DIR" transaction --snapshot-id "$SNAPSHOT_ID" --state prepared

printf 'Staging application files before replacing the live release...\n'
STAGE_DIR=$(mktemp -d "$INSTALL_DIR/.libredisplay-update-stage.XXXXXX")
OLD_DIR=$(mktemp -d "$INSTALL_DIR/.libredisplay-update-old.XXXXXX")
UPDATE_COMMITTED=0

restore_previous_release() {
  set +e
  for old in "$OLD_DIR/app" "$OLD_DIR/scripts" "$OLD_DIR/assets"; do
    [ -e "$old" ] || continue
    name=$(basename "$old")
    rm -rf "$INSTALL_DIR/$name"
    mv "$old" "$INSTALL_DIR/$name"
  done
  for marker in "$OLD_DIR/new-code-dirs"/*; do
    [ -e "$marker" ] || continue
    name=$(basename "$marker")
    rm -rf "$INSTALL_DIR/$name"
  done
  mkdir -p "$INSTALL_DIR/plugins"
  for old in "$OLD_DIR/plugins"/*; do
    [ -e "$old" ] || continue
    name=$(basename "$old")
    rm -rf "$INSTALL_DIR/plugins/$name"
    mv "$old" "$INSTALL_DIR/plugins/$name"
  done
  for marker in "$OLD_DIR/new-plugins"/*; do
    [ -e "$marker" ] || continue
    name=$(basename "$marker")
    rm -rf "$INSTALL_DIR/plugins/$name"
  done
  for old in "$OLD_DIR/files"/*; do
    [ -f "$old" ] || continue
    file=$(basename "$old")
    rm -f "$INSTALL_DIR/$file"
    mv "$old" "$INSTALL_DIR/$file"
  done
  for marker in "$OLD_DIR/new-files"/*; do
    [ -e "$marker" ] || continue
    file=$(basename "$marker")
    rm -f "$INSTALL_DIR/$file"
  done
  if [ -f "$OLD_DIR/installed-version" ]; then
    cp "$OLD_DIR/installed-version" "$DATA_DIR/.installed"
    chmod 600 "$DATA_DIR/.installed" 2>/dev/null || true
  fi
}

cleanup_update_swap() {
  code=${1:-$?}
  trap - EXIT HUP INT TERM
  if [ "$UPDATE_COMMITTED" -ne 1 ]; then
    printf 'Update did not complete; restoring the previous application files...\n' >&2
    restore_previous_release
    if python3 "$SRC_DIR/scripts/release-rollback.py" --install-dir "$INSTALL_DIR" verify-snapshot-install --snapshot-id "$SNAPSHOT_ID" >/dev/null 2>&1; then
      python3 "$SRC_DIR/scripts/release-rollback.py" --install-dir "$INSTALL_DIR" complete-update --snapshot-id "$SNAPSHOT_ID" >/dev/null 2>&1 || true
    else
      printf 'Previous files could not be fully verified against the rollback snapshot; the startup recovery marker was preserved.\n' >&2
    fi
  fi
  rm -rf "$STAGE_DIR" "$OLD_DIR"
  if [ "$code" -ne 0 ]; then
    restart_installed_runtime_after_failure
  fi
  exit "$code"
}
trap - EXIT HUP INT TERM
trap cleanup_update_swap EXIT
trap 'cleanup_update_swap 129' HUP
trap 'cleanup_update_swap 130' INT
trap 'cleanup_update_swap 143' TERM

mkdir -p "$STAGE_DIR/plugins" "$OLD_DIR/plugins" "$OLD_DIR/new-plugins" "$OLD_DIR/new-code-dirs" "$OLD_DIR/new-files" "$OLD_DIR/files"
cp -a "$SRC_DIR/app" "$SRC_DIR/scripts" "$SRC_DIR/assets" "$STAGE_DIR/"
for src in "$SRC_DIR/plugins"/*; do
  [ -e "$src" ] || continue
  cp -a "$src" "$STAGE_DIR/plugins/"
done
for file in LICENSE README.md HELP.md VERSION install.sh update.sh uninstall.sh; do
  cp "$SRC_DIR/$file" "$STAGE_DIR/$file"
done
# Docker/source-distribution metadata is useful when present but is not required
# to update a native Pi/Linux installation. Hidden files such as .dockerignore
# may be absent from a GitHub-generated tag archive, and must never abort a
# verified native update after LibreDisplay has already been stopped.
for file in .dockerignore Dockerfile docker-compose.deploy.yml docker-compose.yml; do
  [ -f "$SRC_DIR/$file" ] || continue
  cp "$SRC_DIR/$file" "$STAGE_DIR/$file"
done
printf '%s\n' "$OLD_VERSION" > "$OLD_DIR/installed-version"

# Verify the staged tree itself before the first live path is replaced.
python3 "$STAGE_DIR/scripts/release-rollback.py" --install-dir "$STAGE_DIR" verify-install --expected-version "$NEW_VERSION"
python3 "$SRC_DIR/scripts/release-rollback.py" --install-dir "$INSTALL_DIR" transaction --snapshot-id "$SNAPSHOT_ID" --state replacing

printf 'Replacing application files...\n'
for name in app scripts assets; do
  if [ -e "$INSTALL_DIR/$name" ]; then
    mv "$INSTALL_DIR/$name" "$OLD_DIR/$name"
  else
    : > "$OLD_DIR/new-code-dirs/$name"
  fi
  mv "$STAGE_DIR/$name" "$INSTALL_DIR/$name"
done

mkdir -p "$INSTALL_DIR/plugins"
for src in "$STAGE_DIR/plugins"/*; do
  [ -e "$src" ] || continue
  name=$(basename "$src")
  if [ -e "$INSTALL_DIR/plugins/$name" ]; then
    mv "$INSTALL_DIR/plugins/$name" "$OLD_DIR/plugins/$name"
  else
    : > "$OLD_DIR/new-plugins/$name"
  fi
  mv "$src" "$INSTALL_DIR/plugins/$name"
done

for file in LICENSE README.md HELP.md VERSION install.sh update.sh uninstall.sh .dockerignore Dockerfile docker-compose.deploy.yml docker-compose.yml; do
  [ -f "$STAGE_DIR/$file" ] || continue
  if [ -f "$INSTALL_DIR/$file" ]; then
    mv "$INSTALL_DIR/$file" "$OLD_DIR/files/$file"
  else
    : > "$OLD_DIR/new-files/$file"
  fi
  mv "$STAGE_DIR/$file" "$INSTALL_DIR/$file"
done

PERSISTENT_STATE_AFTER=$(persistent_state_manifest)
if [ "$PERSISTENT_STATE_BEFORE" != "$PERSISTENT_STATE_AFTER" ]; then
  printf 'Persistent display settings changed during the application-file swap; aborting the update before commit.\n' >&2
  exit 1
fi

printf '%s\n' "$NEW_VERSION" > "$DATA_DIR/.installed"
chmod 600 "$DATA_DIR/.installed"
chmod 755 "$INSTALL_DIR/install.sh" "$INSTALL_DIR/update.sh" "$INSTALL_DIR/uninstall.sh" "$INSTALL_DIR/scripts/"*.sh "$INSTALL_DIR/scripts/libredisplay" "$INSTALL_DIR/scripts/libredisplay-privileged" "$INSTALL_DIR/scripts/release-rollback.py" "$INSTALL_DIR/scripts/field-readiness.py" "$INSTALL_DIR/app/dashboard_server.py"
find "$INSTALL_DIR/app/js" "$INSTALL_DIR/app/css" -type f -exec chmod 644 {} +

printf 'Validating the installed release before committing the update...\n'
python3 "$INSTALL_DIR/scripts/release-rollback.py" --install-dir "$INSTALL_DIR" verify-install --expected-version "$NEW_VERSION"
printf 'Checking the new dashboard in an isolated local server before commit...\n'
python3 "$INSTALL_DIR/scripts/update-health.py" --release "$INSTALL_DIR" --timeout 30
printf 'Installing the independent boot recovery bridge...\n'
python3 "$INSTALL_DIR/scripts/boot-provision.py" --release "$INSTALL_DIR" --home "$HOME" --require-autostart

PRIV_HELPER=/usr/local/libexec/libredisplay-privileged
helper_ready=0
if [ -x "$PRIV_HELPER" ] && command -v sudo >/dev/null 2>&1 && sudo -n "$PRIV_HELPER" probe >/dev/null 2>&1; then
  helper_ready=1
else
  # First upgrade to a release that supports browser updates. This one-time setup
  # may ask for sudo in Terminal; later Settings-driven updates are non-interactive.
  SUDOERS_NAME=$(id -un | tr -cd 'A-Za-z0-9_.-')
  sudo install -d -m 755 /usr/local/libexec
  sudo install -o root -g root -m 755 "$INSTALL_DIR/scripts/libredisplay-privileged" "$PRIV_HELPER"
  sudoers_tmp=$(mktemp)
  printf '%s ALL=(root) NOPASSWD: %s probe, %s install-cli, %s reboot\n' "$(id -un)" "$PRIV_HELPER" "$PRIV_HELPER" "$PRIV_HELPER" > "$sudoers_tmp"
  chmod 600 "$sudoers_tmp"
  if command -v visudo >/dev/null 2>&1; then sudo visudo -cf "$sudoers_tmp" >/dev/null; fi
  sudo install -o root -g root -m 440 "$sudoers_tmp" "/etc/sudoers.d/libredisplay-$SUDOERS_NAME"
  rm -f "$sudoers_tmp"
  sudo -n "$PRIV_HELPER" probe >/dev/null
  helper_ready=1
fi

if [ "$helper_ready" -eq 1 ]; then
  sudo -n "$PRIV_HELPER" install-cli
else
  sudo install -m 755 "$INSTALL_DIR/scripts/libredisplay" /usr/local/bin/libredisplay
fi
chmod 644 "$INSTALL_DIR/README.md" "$INSTALL_DIR/HELP.md" "$INSTALL_DIR/LICENSE" "$INSTALL_DIR/VERSION"
for file in Dockerfile docker-compose.deploy.yml docker-compose.yml .dockerignore; do
  [ -f "$INSTALL_DIR/$file" ] || continue
  chmod 644 "$INSTALL_DIR/$file"
done

python3 "$INSTALL_DIR/scripts/release-rollback.py" --install-dir "$INSTALL_DIR" transaction --snapshot-id "$SNAPSHOT_ID" --state validated
python3 "$INSTALL_DIR/scripts/release-rollback.py" --install-dir "$INSTALL_DIR" record-update --from-version "$OLD_VERSION" --to-version "$NEW_VERSION" --snapshot-id "$SNAPSHOT_ID" || true
# Keep the validated transaction until the restarted dashboard passes real
# localhost health probes from the off-tree boot bridge.
printf 'Update staged and validated; boot health acceptance remains pending.\n'

UPDATE_COMMITTED=1
rm -rf "$STAGE_DIR" "$OLD_DIR"
trap - EXIT HUP INT TERM

printf '\nLibreDisplay has been updated to %s.\n' "$NEW_VERSION"
printf 'Your existing settings, display endpoints, media, and custom plugin folders were kept.\n'
printf 'A safety backup and version rollback snapshot were created before application files were replaced.\n'


if [ "$NO_REBOOT" -eq 1 ]; then
  printf 'Restarting LibreDisplay without rebooting the Pi...\n'
  START_LOG="$DATA_DIR/start.log"
  if [ -n "${WAYLAND_DISPLAY:-}${DISPLAY:-}" ] || server_only_requested; then
    nohup /bin/sh "$HOME/libredisplay-recovery/launch.sh" >>"$START_LOG" 2>&1 </dev/null &
    if server_only_requested; then
      printf 'LibreDisplay server restart requested in Server-only mode. A host reboot is not required for this update.\n'
    else
      printf 'LibreDisplay restart requested. A host reboot is not required for this update.\n'
    fi
  else
    DASHBOARD_NO_BROWSER=1 nohup /bin/sh "$HOME/libredisplay-recovery/launch.sh" >>"$DATA_DIR/start.log" 2>&1 </dev/null &
    printf 'LibreDisplay server restart requested headlessly. No graphical session was available to restart kiosk mode; reboot when convenient to restore the local display: sudo reboot\n'
  fi
else
  printf 'Rebooting to start the updated release...\n'
  if [ "${helper_ready:-0}" -eq 1 ] && sudo -n "$PRIV_HELPER" reboot; then
    : # Reboot initiated; the off-tree bridge completes or reverts the update.
  elif [ "${helper_ready:-0}" -ne 1 ] && sudo reboot; then
    : # Legacy privileged helper path.
  else
    # A denied reboot must not leave remotely managed displays offline.
    # The bridge checks real server health before committing this transaction.
    printf 'Automatic reboot unavailable; restarting the server through protected recovery. Reboot the kiosk when practical.\n' >&2
    DASHBOARD_NO_BROWSER=1 nohup /bin/sh "$HOME/libredisplay-recovery/launch.sh" >>"$DATA_DIR/start.log" 2>&1 </dev/null &
  fi
fi
