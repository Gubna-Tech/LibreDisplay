#!/bin/sh
set -eu
umask 077

NO_REBOOT=0
for arg in "$@"; do
  case "$arg" in
    --no-reboot) NO_REBOOT=1 ;;
    -h|--help)
      printf 'Usage: %s [--no-reboot]\n' "$0"
      printf 'Installs LibreDisplay on Raspberry Pi OS with Desktop.\n'
      exit 0
      ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

if [ "$(id -u)" -eq 0 ]; then
  printf 'Run the LibreDisplay installer as your normal Raspberry Pi user, not root or through sudo.\n' >&2
  exit 1
fi

SRC_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

for required in VERSION README.md HELP.md LICENSE docker/Dockerfile docker/docker-compose.deploy.yml docker/docker-compose.yml docker/truenas-compose.yml install.sh update.sh uninstall.sh app/dashboard.html app/dashboard_server.py app/qrcode_vendor.zip app/js/app.js app/css/dashboard.css scripts/release-rollback.py scripts/verify-frontend.py; do
  [ -f "$SRC_DIR/$required" ] || { printf 'LibreDisplay release is incomplete: missing %s\n' "$required" >&2; exit 1; }
done

command -v sudo >/dev/null 2>&1 || { printf 'sudo is required.\n' >&2; exit 1; }
command -v apt >/dev/null 2>&1 || { printf 'This installer requires Raspberry Pi OS/Debian with apt.\n' >&2; exit 1; }
command -v raspi-config >/dev/null 2>&1 || { printf 'This native installer requires Raspberry Pi OS.\n' >&2; exit 1; }
if [ ! -e /etc/init.d/lightdm ] && ! systemctl list-unit-files --no-legend lightdm.service 2>/dev/null | grep -q '^lightdm.service'; then
  printf 'LibreDisplay native kiosk mode requires Raspberry Pi OS with Desktop (labwc/Wayland).\n' >&2
  printf 'Raspberry Pi OS Lite is not supported by the native installer; use Desktop or Docker instead.\n' >&2
  exit 1
fi

INSTALL_DIR="$HOME/libredisplay"
DATA_DIR="$INSTALL_DIR/data"
VERSION=$(cat "$SRC_DIR/VERSION" 2>/dev/null || printf 'unknown')
LABWC_DIR="$HOME/.config/labwc"
AUTOSTART_FILE="$LABWC_DIR/autostart"
RC_FILE="$LABWC_DIR/rc.xml"

# .installed existed before the final desktop/autostart steps in older releases;
# its presence alone does not prove the first installation finished.
is_installed_dir() {
  dir=$1
  [ -d "$dir" ] || return 1
  if [ -f "$dir/data/.install-complete" ] && [ -f "$dir/data/.installed" ]; then
    return 0
  fi
  # Recognize successful older installs without requiring a new marker.
  [ -f "$dir/data/.installed" ] &&
    [ -f "$dir/data/libredisplay.env" ] &&
    [ -f "$HOME/libredisplay-recovery/launch.sh" ] &&
    [ -f "$HOME/.config/labwc/autostart" ] &&
    grep -Fq "$HOME/libredisplay-recovery/launch.sh" "$HOME/.config/labwc/autostart"
}

is_incomplete_first_install() {
  dir=$1
  [ -d "$dir" ] || return 1
  is_installed_dir "$dir" && return 1
  # Only recover a directory identifiable as a LibreDisplay install; never
  # overwrite an arbitrary user's directory.
  [ -f "$dir/app/dashboard.html" ] || [ -f "$dir/scripts/start.sh" ] ||
    [ -f "$dir/install.sh" ] || [ -f "$dir/data/.installed" ]
}

if [ -L "$INSTALL_DIR" ]; then
  printf 'Refusing to install through a symbolic link: %s\n' "$INSTALL_DIR" >&2
  exit 1
fi
if [ -e "$INSTALL_DIR" ] && [ ! -d "$INSTALL_DIR" ]; then
  printf '%s exists and is not a directory.\n' "$INSTALL_DIR" >&2
  exit 1
fi
if [ -d "$INSTALL_DIR" ] && is_installed_dir "$INSTALL_DIR"; then
  printf '\nLibreDisplay is already installed at %s.\n' "$INSTALL_DIR" >&2
  printf 'Use `libredisplay update` for a completed installation; the installer will not overwrite it.\n' >&2
  exit 1
fi
if [ -d "$INSTALL_DIR" ] && [ -n "$(find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
  if ! is_incomplete_first_install "$INSTALL_DIR"; then
    printf 'Installation directory %s is not an identifiable interrupted LibreDisplay installation.\n' "$INSTALL_DIR" >&2
    printf 'Inspect or back up its contents before trying again. No files have been removed.\n' >&2
    exit 1
  fi
  for name in app scripts plugins assets docker data media; do
    if [ -L "$INSTALL_DIR/$name" ]; then
      printf 'Refusing to repair a symbolic-link path: %s\n' "$INSTALL_DIR/$name" >&2
      exit 1
    fi
  done
  printf 'Resuming an incomplete previous LibreDisplay installation.\n'
  printf 'Existing data, settings, media and previous configuration backups will be preserved.\n'
fi

printf '\nLibreDisplay %s\n' "$VERSION"
printf '====================\n'
printf 'Installing to: %s\n' "$INSTALL_DIR"

printf 'Validating release before making package or system changes...\n'
command -v python3 >/dev/null 2>&1 || {
  printf 'Python 3 is required to validate this LibreDisplay release safely before installation.\n' >&2
  exit 1
}
printf 'Verifying modular frontend assets...\n'
python3 "$SRC_DIR/scripts/verify-frontend.py" "$SRC_DIR"
printf 'Validating release runtime files...\n'
python3 "$SRC_DIR/scripts/release-rollback.py" --install-dir "$SRC_DIR" verify-install --expected-version "$VERSION" >/dev/null

printf 'Checking required packages...\n'
sudo -v
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt install -y \
  python3 chromium curl ca-certificates unzip labwc raspi-config \
  swayidle wtype qrencode cifs-utils nfs-common \
  fonts-liberation2 fonts-noto-core fonts-noto-color-emoji fonts-dejavu-core

if [ "$SRC_DIR" != "$INSTALL_DIR" ]; then
  mkdir -p "$INSTALL_DIR"
  # Copy application code from the fully verified release. Do not delete or
  # overwrite data/, media/, backups/ or user-provided plugin state.
  for name in app scripts plugins assets docker; do
    if [ -L "$INSTALL_DIR/$name" ]; then
      printf 'Refusing to copy through a symbolic link: %s\n' "$INSTALL_DIR/$name" >&2
      exit 1
    fi
  done
  cp -a "$SRC_DIR/app" "$SRC_DIR/scripts" "$SRC_DIR/plugins" "$SRC_DIR/assets" "$SRC_DIR/docker" "$INSTALL_DIR/"
  for file in .dockerignore LICENSE README.md HELP.md VERSION install.sh update.sh uninstall.sh; do
    cp "$SRC_DIR/$file" "$INSTALL_DIR/$file"
  done
fi

# Keep a recovery implementation outside the application directory on new
# installations as well as upgrades, so a later interrupted swap can recover.
RECOVERY_DIR="$HOME/libredisplay-recovery"
mkdir -p "$RECOVERY_DIR"
chmod 700 "$RECOVERY_DIR"
if [ ! -f "$RECOVERY_DIR/release-rollback.py" ]; then
  install -m 600 "$INSTALL_DIR/scripts/release-rollback.py" "$RECOVERY_DIR/release-rollback.py"
fi
python3 "$INSTALL_DIR/scripts/boot-provision.py" --release "$INSTALL_DIR" --home "$HOME"

mkdir -p "$DATA_DIR" "$INSTALL_DIR/media" "$INSTALL_DIR/plugins" "$HOME/Pictures" "$LABWC_DIR"
chmod 700 "$DATA_DIR"
chmod 755 "$INSTALL_DIR/media"

python3 - "$DATA_DIR/install_state.json" <<'PY'
import json, subprocess, sys
from pathlib import Path

def query(name):
    try:
        p=subprocess.run(["sudo","raspi-config","nonint",name],capture_output=True,text=True,timeout=10,check=False)
        value=p.stdout.strip()
        return value if p.returncode == 0 and value else None
    except Exception:
        return None

state={
    "boot_cli": query("get_boot_cli"),
    "autologin": query("get_autologin"),
    "blanking": query("get_blanking"),
}
state_path=Path(sys.argv[1])
if not state_path.exists():
    state_path.write_text(json.dumps(state,indent=2)+"\n",encoding="utf-8")
PY
chmod 600 "$DATA_DIR/install_state.json"

if [ ! -e "$DATA_DIR/labwc-rc.before" ] && [ ! -e "$DATA_DIR/labwc-rc.missing" ]; then
  if [ -f "$RC_FILE" ]; then cp -p "$RC_FILE" "$DATA_DIR/labwc-rc.before"; else : > "$DATA_DIR/labwc-rc.missing"; fi
fi
if [ ! -e "$DATA_DIR/labwc-autostart.before" ] && [ ! -e "$DATA_DIR/labwc-autostart.missing" ]; then
  if [ -f "$AUTOSTART_FILE" ]; then cp -p "$AUTOSTART_FILE" "$DATA_DIR/labwc-autostart.before"; else : > "$DATA_DIR/labwc-autostart.missing"; fi
fi

if [ ! -f "$DATA_DIR/libredisplay.env" ]; then
cat > "$DATA_DIR/libredisplay.env" <<EOF_ENV
DASHBOARD_HOST=0.0.0.0
DASHBOARD_PORT=8787
DASHBOARD_REMOTE_ENABLED=0
DASHBOARD_REMOTE_NETWORKS=private
DASHBOARD_REMOTE_SESSION_SECONDS=28800
DASHBOARD_MEDIA_ROOTS="$HOME/Pictures:/mnt/libredisplay:/media/$(id -un):$INSTALL_DIR/media"
EOF_ENV
fi
chmod 600 "$DATA_DIR/libredisplay.env"

chmod 755 "$INSTALL_DIR/install.sh" "$INSTALL_DIR/update.sh" "$INSTALL_DIR/uninstall.sh" "$INSTALL_DIR/scripts/"*.sh "$INSTALL_DIR/scripts/libredisplay" "$INSTALL_DIR/scripts/libredisplay-privileged" "$INSTALL_DIR/scripts/release-rollback.py" "$INSTALL_DIR/scripts/field-readiness.py" "$INSTALL_DIR/app/dashboard_server.py"

sudo install -m 755 "$INSTALL_DIR/scripts/libredisplay" /usr/local/bin/libredisplay

# Install the narrowly scoped privileged helper used by the Settings update button.
PRIV_HELPER=/usr/local/libexec/libredisplay-privileged
SUDOERS_NAME=$(id -un | tr -cd 'A-Za-z0-9_.-')
sudo install -d -m 755 /usr/local/libexec
sudo install -o root -g root -m 755 "$INSTALL_DIR/scripts/libredisplay-privileged" "$PRIV_HELPER"
sudoers_tmp=$(mktemp)
printf '%s ALL=(root) NOPASSWD: %s probe, %s install-cli, %s reboot\n' "$(id -un)" "$PRIV_HELPER" "$PRIV_HELPER" "$PRIV_HELPER" > "$sudoers_tmp"
chmod 600 "$sudoers_tmp"
if command -v visudo >/dev/null 2>&1; then sudo visudo -cf "$sudoers_tmp" >/dev/null; fi
sudo install -o root -g root -m 440 "$sudoers_tmp" "/etc/sudoers.d/libredisplay-$SUDOERS_NAME"
rm -f "$sudoers_tmp"
find "$INSTALL_DIR" -type f -name '*.md' -exec chmod 644 {} \;
chmod 644 "$INSTALL_DIR/app/dashboard.html" "$INSTALL_DIR/docker/Dockerfile" "$INSTALL_DIR/docker/docker-compose.deploy.yml" "$INSTALL_DIR/docker/docker-compose.yml" "$INSTALL_DIR/docker/truenas-compose.yml" "$INSTALL_DIR/VERSION" "$INSTALL_DIR/LICENSE" "$INSTALL_DIR/README.md" "$INSTALL_DIR/HELP.md"
find "$INSTALL_DIR/app/js" "$INSTALL_DIR/app/css" -type f -exec chmod 644 {} +

sudo raspi-config nonint do_boot_behaviour B4
sudo raspi-config nonint do_blanking 1

python3 - "$RC_FILE" <<'PY'
import shutil, sys, xml.etree.ElementTree as ET
from pathlib import Path
rc=Path(sys.argv[1]); rc.parent.mkdir(parents=True,exist_ok=True)
if not rc.exists():
    system=Path('/etc/xdg/labwc/rc.xml')
    if system.exists(): shutil.copy2(system,rc)
    else: rc.write_text('<?xml version="1.0"?>\n<labwc_config>\n</labwc_config>\n',encoding='utf-8')
parser=ET.XMLParser(target=ET.TreeBuilder(insert_comments=True)); tree=ET.parse(rc,parser=parser); root=tree.getroot()
def local(tag): return tag.rsplit('}',1)[-1]
def ns(tag): return tag[1:].split('}',1)[0] if tag.startswith('{') and '}' in tag else ''
uri=ns(root.tag)
if uri: ET.register_namespace('',uri)
def q(name): return f'{{{uri}}}{name}' if uri else name
keyboard=next((c for c in root if isinstance(c.tag,str) and local(c.tag)=='keyboard'),None)
if keyboard is None: keyboard=ET.SubElement(root,q('keyboard')); ET.SubElement(keyboard,q('default'))
for child in list(keyboard):
    if not isinstance(child.tag,str) or local(child.tag)!='keybind': continue
    if child.attrib.get('key') in {'F24','A-W-C-S-F12'}:
        acts=[a.attrib.get('name') for a in child if isinstance(a.tag,str) and local(a.tag)=='action']
        if 'HideCursor' in acts or child.attrib.get('key')=='A-W-C-S-F12': keyboard.remove(child)
keybind=ET.SubElement(keyboard,q('keybind'),{'key':'F24','overrideInhibition':'yes'})
ET.SubElement(keybind,q('action'),{'name':'WarpCursor','x':'-1','y':'-1'})
ET.SubElement(keybind,q('action'),{'name':'HideCursor'})
try: ET.indent(tree,space='  ')
except AttributeError: pass
tree.write(rc,encoding='utf-8',xml_declaration=True)
PY

touch "$AUTOSTART_FILE"
tmp=$(mktemp)
grep -Fv '# LibreDisplay' "$AUTOSTART_FILE" \
  | grep -Fv "$INSTALL_DIR/scripts/start.sh" \
  | grep -Fv 'wtype -k F24' \
  | grep -Fv "swayidle -w timeout 2 'wtype -k F24'" > "$tmp" || true
cat "$tmp" > "$AUTOSTART_FILE"
rm -f "$tmp"
printf '%s\n%s\n%s\n%s\n' \
  '# LibreDisplay' \
  'wtype -k F24 &' \
  "swayidle -w timeout 2 'wtype -k F24' &" \
  "sleep 5 && sh \"$HOME/libredisplay-recovery/launch.sh\" &" >> "$AUTOSTART_FILE"

# Mark readiness last, after the native autostart and privileged helpers are
# configured; interrupted installs before this point remain safely repairable.
printf '%s\n' "$VERSION" > "$DATA_DIR/.installed"
printf '%s\n' "$VERSION" > "$DATA_DIR/.install-complete"
chmod 600 "$DATA_DIR/.installed" "$DATA_DIR/.install-complete"

SETUP_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
if [ -n "$SETUP_IP" ]; then SETUP_URL="http://$SETUP_IP:8787/"; else SETUP_URL="http://127.0.0.1:8787/"; fi
printf '\nLibreDisplay %s is ready.\n' "$VERSION"
printf '==============================\n'
printf 'After reboot, finish setup in a browser:\n  %s\n' "$SETUP_URL"
printf 'The first-run screen can create a one-time Owner QR/code if you want to continue setup from a phone or computer on the same trusted private network.\n'
printf 'Remote editing remains OFF unless you explicitly enable that option.\n'
if command -v qrencode >/dev/null 2>&1; then
  printf '\nScan to open LibreDisplay on this network:\n'
  qrencode -t ANSIUTF8 "$SETUP_URL" 2>/dev/null || true
fi
printf '\nUseful commands:\n  libredisplay addresses    Show connection addresses\n  libredisplay connect      Create a one-time Owner connection code\n'
printf 'To remove LibreDisplay completely later: %s/uninstall.sh --purge\n' "$INSTALL_DIR"

if [ "$NO_REBOOT" -eq 1 ]; then
  printf 'Reboot recommended: sudo reboot\n'
  exit 0
fi
printf 'Reboot now? [Y/n] '
read answer || answer=y
case "$answer" in n|N|no|NO|No) printf 'Reboot later with: sudo reboot\n' ;; *) sudo reboot ;; esac
