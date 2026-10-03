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

SRC_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INSTALL_DIR="$HOME/libredisplay"
DATA_DIR="$INSTALL_DIR/data"

[ -f "$SRC_DIR/VERSION" ] || { printf 'This does not look like a LibreDisplay release folder.\n' >&2; exit 1; }
for required in app/dashboard.html app/dashboard_server.py app/js/app.js app/css/dashboard.css; do
  [ -f "$SRC_DIR/$required" ] || { printf 'LibreDisplay release is incomplete: missing %s\n' "$required" >&2; exit 1; }
done
[ -x "$SRC_DIR/scripts/verify-frontend.py" ] || { printf 'LibreDisplay release is incomplete: missing frontend verifier.\n' >&2; exit 1; }
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

printf '\nLibreDisplay Update\n'
printf '===================\n'
printf 'Current version: %s\n' "$OLD_VERSION"
printf 'New version:     %s\n' "$NEW_VERSION"

printf 'Stopping LibreDisplay and Chromium...\n'
pkill -f "$INSTALL_DIR/scripts/start.sh" 2>/dev/null || true
pkill -f "$INSTALL_DIR/app/dashboard_server.py" 2>/dev/null || true
pkill -f -- "--user-data-dir=$DATA_DIR/chromium" 2>/dev/null || true
sleep 1

# Chromium creates transient Singleton* symlinks while its profile is active.
# Older LibreDisplay backup code rejected those links, so remove only those
# known runtime links before invoking the installed backup during an upgrade.
for name in SingletonCookie SingletonLock SingletonSocket; do
  path="$DATA_DIR/chromium/$name"
  [ -L "$path" ] && rm -f -- "$path"
done

printf 'Creating a safety backup and rollback snapshot...\n'
SNAPSHOT_ID=$(python3 "$SRC_DIR/scripts/release-rollback.py" --install-dir "$INSTALL_DIR" snapshot --to-version "$NEW_VERSION" --quiet)
printf 'Rollback snapshot: %s\n' "$SNAPSHOT_ID"

printf 'Staging application files before replacing the live release...\n'
STAGE_DIR=$(mktemp -d "$INSTALL_DIR/.libredisplay-update-stage.XXXXXX")
OLD_DIR=$(mktemp -d "$INSTALL_DIR/.libredisplay-update-old.XXXXXX")
UPDATE_COMMITTED=0

restore_previous_release() {
  set +e
  for name in app scripts assets; do
    rm -rf "$INSTALL_DIR/$name"
    [ -e "$OLD_DIR/$name" ] && mv "$OLD_DIR/$name" "$INSTALL_DIR/$name"
  done
  mkdir -p "$INSTALL_DIR/plugins"
  for src in "$STAGE_DIR/plugins"/*; do
    [ -e "$src" ] || continue
    name=$(basename "$src")
    rm -rf "$INSTALL_DIR/plugins/$name"
    [ -e "$OLD_DIR/plugins/$name" ] && mv "$OLD_DIR/plugins/$name" "$INSTALL_DIR/plugins/$name"
  done
  for file in Dockerfile LICENSE README.md VERSION docker-compose.yml install.sh update.sh uninstall.sh; do
    rm -f "$INSTALL_DIR/$file"
    [ -f "$OLD_DIR/files/$file" ] && mv "$OLD_DIR/files/$file" "$INSTALL_DIR/$file"
  done
  if [ -f "$OLD_DIR/installed-version" ]; then
    cp "$OLD_DIR/installed-version" "$DATA_DIR/.installed"
    chmod 600 "$DATA_DIR/.installed" 2>/dev/null || true
  fi
}

cleanup_update_swap() {
  code=$?
  trap - EXIT HUP INT TERM
  if [ "$UPDATE_COMMITTED" -ne 1 ]; then
    printf 'Update did not complete; restoring the previous application files...\n' >&2
    restore_previous_release
  fi
  rm -rf "$STAGE_DIR" "$OLD_DIR"
  exit "$code"
}
trap cleanup_update_swap EXIT HUP INT TERM

mkdir -p "$STAGE_DIR/plugins" "$OLD_DIR/plugins" "$OLD_DIR/files"
cp -a "$SRC_DIR/app" "$SRC_DIR/scripts" "$SRC_DIR/assets" "$STAGE_DIR/"
for src in "$SRC_DIR/plugins"/*; do
  [ -e "$src" ] || continue
  cp -a "$src" "$STAGE_DIR/plugins/"
done
for file in Dockerfile LICENSE README.md VERSION docker-compose.yml install.sh update.sh uninstall.sh; do
  cp "$SRC_DIR/$file" "$STAGE_DIR/$file"
done
printf '%s\n' "$OLD_VERSION" > "$OLD_DIR/installed-version"

# Verify the staged tree itself before the first live path is replaced.
python3 "$STAGE_DIR/scripts/verify-frontend.py" "$STAGE_DIR"

printf 'Replacing application files...\n'
for name in app scripts assets; do
  [ -e "$INSTALL_DIR/$name" ] && mv "$INSTALL_DIR/$name" "$OLD_DIR/$name"
  mv "$STAGE_DIR/$name" "$INSTALL_DIR/$name"
done

mkdir -p "$INSTALL_DIR/plugins"
for src in "$STAGE_DIR/plugins"/*; do
  [ -e "$src" ] || continue
  name=$(basename "$src")
  [ -e "$INSTALL_DIR/plugins/$name" ] && mv "$INSTALL_DIR/plugins/$name" "$OLD_DIR/plugins/$name"
  mv "$src" "$INSTALL_DIR/plugins/$name"
done

for file in Dockerfile LICENSE README.md VERSION docker-compose.yml install.sh update.sh uninstall.sh; do
  [ -f "$STAGE_DIR/$file" ] || continue
  [ -f "$INSTALL_DIR/$file" ] && mv "$INSTALL_DIR/$file" "$OLD_DIR/files/$file"
  mv "$STAGE_DIR/$file" "$INSTALL_DIR/$file"
done

printf '%s\n' "$NEW_VERSION" > "$DATA_DIR/.installed"
chmod 600 "$DATA_DIR/.installed"
chmod 755 "$INSTALL_DIR/install.sh" "$INSTALL_DIR/update.sh" "$INSTALL_DIR/uninstall.sh" "$INSTALL_DIR/scripts/"*.sh "$INSTALL_DIR/scripts/libredisplay" "$INSTALL_DIR/scripts/libredisplay-privileged" "$INSTALL_DIR/scripts/release-rollback.py" "$INSTALL_DIR/scripts/field-readiness.py" "$INSTALL_DIR/app/dashboard_server.py"
find "$INSTALL_DIR/app/js" "$INSTALL_DIR/app/css" -type f -exec chmod 644 {} +

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
chmod 644 "$INSTALL_DIR/README.md" "$INSTALL_DIR/LICENSE" "$INSTALL_DIR/VERSION" "$INSTALL_DIR/Dockerfile" "$INSTALL_DIR/docker-compose.yml"

python3 "$INSTALL_DIR/scripts/release-rollback.py" --install-dir "$INSTALL_DIR" record-update --from-version "$OLD_VERSION" --to-version "$NEW_VERSION" --snapshot-id "$SNAPSHOT_ID" || true

UPDATE_COMMITTED=1
rm -rf "$STAGE_DIR" "$OLD_DIR"
trap - EXIT HUP INT TERM

printf '\nLibreDisplay has been updated to %s.\n' "$NEW_VERSION"
printf 'Your existing settings, display endpoints, media, and custom plugin folders were kept.\n'
printf 'A safety backup and version rollback snapshot were created before application files were replaced.\n'

if [ "$NO_REBOOT" -eq 1 ]; then
  printf 'Reboot when convenient: sudo reboot\n'
else
  printf 'Rebooting to start the updated release...\n'
  if [ "${helper_ready:-0}" -eq 1 ]; then
    sudo -n "$PRIV_HELPER" reboot
  else
    sudo reboot
  fi
fi
