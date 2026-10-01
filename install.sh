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

SRC_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

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

is_installed_dir() {
  dir=$1
  [ -L "$dir" ] && return 0
  [ -d "$dir" ] || return 1
  [ -f "$dir/data/.installed" ] || [ -f "$dir/data/dashboard_config.json" ] || [ -f "$dir/dashboard_config.json" ] || [ -f "$dir/dashboard.html" ] || [ -f "$dir/app/dashboard.html" ]
}

is_incomplete_first_install() {
  dir=$1
  [ -d "$dir" ] || return 1
  [ ! -e "$dir/data" ] || return 1
  [ -f "$dir/app/dashboard.html" ] || return 1
  [ -d "$dir/scripts" ] || return 1
  [ -d "$dir/plugins" ] || return 1
}

if [ "$SRC_DIR" != "$INSTALL_DIR" ] && is_incomplete_first_install "$INSTALL_DIR"; then
  printf 'Removing an incomplete previous LibreDisplay installation...\n'
  rm -rf "$INSTALL_DIR"
fi

if [ "$SRC_DIR" != "$INSTALL_DIR" ] && is_installed_dir "$INSTALL_DIR"; then
  printf '\nLibreDisplay is already installed at %s.\n' "$INSTALL_DIR" >&2
  printf 'Use `libredisplay update` to install the newest release, or uninstall LibreDisplay first for a fresh installation.\n' >&2
  exit 1
fi

if [ "$SRC_DIR" = "$INSTALL_DIR" ] && [ -f "$DATA_DIR/.installed" ]; then
  printf '\nLibreDisplay is already installed in this directory.\n' >&2
  printf 'Use `libredisplay update` for normal updates, or run: %s/uninstall.sh --purge\n' "$INSTALL_DIR" >&2
  exit 1
fi

printf '\nLibreDisplay %s\n' "$VERSION"
printf '====================\n'
printf 'Installing to: %s\n' "$INSTALL_DIR"

printf 'Checking required packages...\n'
sudo -v
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt install -y \
  python3 chromium curl ca-certificates unzip labwc raspi-config \
  swayidle wtype qrencode cifs-utils nfs-common \
  fonts-liberation2 fonts-noto-core fonts-noto-color-emoji fonts-dejavu-core

if [ "$SRC_DIR" != "$INSTALL_DIR" ]; then
  if [ -e "$INSTALL_DIR" ]; then
    if [ -d "$INSTALL_DIR" ] && [ -z "$(find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
      rmdir "$INSTALL_DIR"
    else
      printf '%s already exists and is not an empty directory.\n' "$INSTALL_DIR" >&2
      exit 1
    fi
  fi
  mkdir -p "$INSTALL_DIR"
  cp -a "$SRC_DIR/app" "$SRC_DIR/scripts" "$SRC_DIR/plugins" "$SRC_DIR/assets" "$INSTALL_DIR/"
  for file in Dockerfile LICENSE README.md VERSION docker-compose.yml install.sh update.sh uninstall.sh; do
    cp "$SRC_DIR/$file" "$INSTALL_DIR/$file"
  done
  for file in .env.example .gitignore; do
    [ -f "$SRC_DIR/$file" ] && cp "$SRC_DIR/$file" "$INSTALL_DIR/$file"
  done
fi

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
Path(sys.argv[1]).write_text(json.dumps(state,indent=2)+"\n",encoding="utf-8")
PY
chmod 600 "$DATA_DIR/install_state.json"

if [ -f "$RC_FILE" ]; then cp -p "$RC_FILE" "$DATA_DIR/labwc-rc.before"; else : > "$DATA_DIR/labwc-rc.missing"; fi
if [ -f "$AUTOSTART_FILE" ]; then cp -p "$AUTOSTART_FILE" "$DATA_DIR/labwc-autostart.before"; else : > "$DATA_DIR/labwc-autostart.missing"; fi

cat > "$DATA_DIR/libredisplay.env" <<EOF_ENV
DASHBOARD_HOST=0.0.0.0
DASHBOARD_PORT=8787
DASHBOARD_REMOTE_ENABLED=0
DASHBOARD_REMOTE_NETWORKS=private
DASHBOARD_REMOTE_SESSION_SECONDS=28800
DASHBOARD_MEDIA_ROOTS="$HOME/Pictures:/mnt/libredisplay:/media/$(id -un):$INSTALL_DIR/media"
EOF_ENV
chmod 600 "$DATA_DIR/libredisplay.env"
printf '%s\n' "$VERSION" > "$DATA_DIR/.installed"
chmod 600 "$DATA_DIR/.installed"

chmod 755 "$INSTALL_DIR/install.sh" "$INSTALL_DIR/update.sh" "$INSTALL_DIR/uninstall.sh" "$INSTALL_DIR/scripts/"*.sh "$INSTALL_DIR/scripts/libredisplay" "$INSTALL_DIR/app/dashboard_server.py"

sudo install -m 755 "$INSTALL_DIR/scripts/libredisplay" /usr/local/bin/libredisplay
find "$INSTALL_DIR" -type f -name '*.md' -exec chmod 644 {} \;
chmod 644 "$INSTALL_DIR/app/dashboard.html" "$INSTALL_DIR/Dockerfile" "$INSTALL_DIR/docker-compose.yml" "$INSTALL_DIR/VERSION" "$INSTALL_DIR/LICENSE"
for file in .env.example .gitignore; do
  [ -f "$INSTALL_DIR/$file" ] && chmod 644 "$INSTALL_DIR/$file"
done

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
  "sleep 5 && sh \"$INSTALL_DIR/scripts/start.sh\" &" >> "$AUTOSTART_FILE"

printf '\nLibreDisplay %s is installed.\n' "$VERSION"
printf 'Remote editing is OFF by default. Enable it from the local display only if you need it.\n'
printf 'To remove LibreDisplay completely later: %s/uninstall.sh --purge\n' "$INSTALL_DIR"

if [ "$NO_REBOOT" -eq 1 ]; then
  printf 'Reboot recommended: sudo reboot\n'
  exit 0
fi
printf 'Reboot now? [Y/n] '
read answer || answer=y
case "$answer" in n|N|no|NO|No) printf 'Reboot later with: sudo reboot\n' ;; *) sudo reboot ;; esac
