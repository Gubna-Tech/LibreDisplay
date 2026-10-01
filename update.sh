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

printf 'Creating a safety backup...\n'
"$INSTALL_DIR/scripts/backup.sh"

printf 'Updating application files...\n'
rm -rf "$INSTALL_DIR/app" "$INSTALL_DIR/scripts" "$INSTALL_DIR/assets"
cp -a "$SRC_DIR/app" "$SRC_DIR/scripts" "$SRC_DIR/assets" "$INSTALL_DIR/"

mkdir -p "$INSTALL_DIR/plugins"
for src in "$SRC_DIR/plugins"/*; do
  [ -e "$src" ] || continue
  name=$(basename "$src")
  rm -rf "$INSTALL_DIR/plugins/$name"
  cp -a "$src" "$INSTALL_DIR/plugins/$name"
done

for file in Dockerfile LICENSE README.md VERSION docker-compose.yml install.sh update.sh uninstall.sh; do
  cp "$SRC_DIR/$file" "$INSTALL_DIR/$file"
done
for file in .env.example .gitignore; do
  [ -f "$SRC_DIR/$file" ] && cp "$SRC_DIR/$file" "$INSTALL_DIR/$file"
done

printf '%s\n' "$NEW_VERSION" > "$DATA_DIR/.installed"
chmod 600 "$DATA_DIR/.installed"
chmod 755 "$INSTALL_DIR/install.sh" "$INSTALL_DIR/update.sh" "$INSTALL_DIR/uninstall.sh" "$INSTALL_DIR/scripts/"*.sh "$INSTALL_DIR/scripts/libredisplay" "$INSTALL_DIR/app/dashboard_server.py"
sudo install -m 755 "$INSTALL_DIR/scripts/libredisplay" /usr/local/bin/libredisplay
chmod 644 "$INSTALL_DIR/README.md" "$INSTALL_DIR/LICENSE" "$INSTALL_DIR/VERSION" "$INSTALL_DIR/Dockerfile" "$INSTALL_DIR/docker-compose.yml"
for file in .env.example .gitignore; do
  [ -f "$INSTALL_DIR/$file" ] && chmod 644 "$INSTALL_DIR/$file"
done

printf '\nLibreDisplay has been updated to %s.\n' "$NEW_VERSION"
printf 'Your existing settings, display endpoints, media, and custom plugin folders were kept.\n'
printf 'A safety backup was created before any application files were replaced.\n'

if [ "$NO_REBOOT" -eq 1 ]; then
  printf 'Reboot when convenient: sudo reboot\n'
else
  printf 'Rebooting to start the updated release...\n'
  sudo reboot
fi
