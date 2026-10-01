#!/bin/sh
set -eu
umask 077

VIEWER_DIR="$HOME/.local/share/libredisplay-viewer"
DATA_DIR="$VIEWER_DIR/data"
LINK_FILE="$VIEWER_DIR/display-link.txt"
START_FILE="$VIEWER_DIR/start.sh"
LABWC_DIR="$HOME/.config/labwc"
AUTOSTART_FILE="$LABWC_DIR/autostart"
RC_FILE="$LABWC_DIR/rc.xml"

usage() {
  cat <<'HELP'
LibreDisplay Viewer

Use a Raspberry Pi with Desktop as a screen for a LibreDisplay Docker server.

Usage:
  ./scripts/viewer-setup.sh install 'READ_ONLY_DISPLAY_LINK'
  ./scripts/viewer-setup.sh status
  ./scripts/viewer-setup.sh remove

The read-only Display Link is printed by:
  ./scripts/docker-setup.sh links
HELP
}

command=${1:-}
case "$command" in
  install|status|remove) shift ;;
  -h|--help|'') usage; exit 0 ;;
  *) printf 'Unknown command: %s\n\n' "$command" >&2; usage >&2; exit 2 ;;
esac

if [ "$command" = status ]; then
  if [ -f "$LINK_FILE" ]; then
    printf 'LibreDisplay Viewer is configured.\n'
    printf 'Viewer data: %s\n' "$VIEWER_DIR"
    printf 'Display host: %s\n' "$(sed -E 's#^(https?://[^/]+).*#\1#' "$LINK_FILE")"
  else
    printf 'LibreDisplay Viewer is not configured.\n'
  fi
  exit 0
fi

restore_host_state() {
  if [ -f "$DATA_DIR/labwc-rc.before" ]; then
    mkdir -p "$LABWC_DIR"
    cp -p "$DATA_DIR/labwc-rc.before" "$RC_FILE"
  elif [ -f "$DATA_DIR/labwc-rc.missing" ]; then
    rm -f "$RC_FILE"
  fi

  if [ -f "$DATA_DIR/labwc-autostart.before" ]; then
    mkdir -p "$LABWC_DIR"
    cp -p "$DATA_DIR/labwc-autostart.before" "$AUTOSTART_FILE"
  elif [ -f "$DATA_DIR/labwc-autostart.missing" ]; then
    rm -f "$AUTOSTART_FILE"
  elif [ -f "$AUTOSTART_FILE" ]; then
    tmp=$(mktemp)
    grep -Fv '# LibreDisplay Viewer' "$AUTOSTART_FILE" \
      | grep -Fv "$START_FILE" \
      | grep -Fv "swayidle -w timeout 2 'wtype -k F24'" \
      | grep -Fv 'wtype -k F24' > "$tmp" || true
    cat "$tmp" > "$AUTOSTART_FILE"
    rm -f "$tmp"
  fi

  if [ -f "$DATA_DIR/install_state.json" ] && command -v raspi-config >/dev/null 2>&1; then
    state=$(python3 - "$DATA_DIR/install_state.json" <<'PY'
import json,sys
try: d=json.load(open(sys.argv[1],encoding='utf-8'))
except Exception: d={}
print(d.get('boot_cli') or '')
print(d.get('autologin') or '')
print(d.get('blanking') or '')
PY
)
    boot_cli=$(printf '%s\n' "$state" | sed -n '1p')
    autologin=$(printf '%s\n' "$state" | sed -n '2p')
    blanking=$(printf '%s\n' "$state" | sed -n '3p')
    if [ "$boot_cli" = 0 ] || [ "$boot_cli" = 1 ]; then
      if [ "$autologin" = 0 ]; then
        [ "$boot_cli" = 0 ] && behaviour=B2 || behaviour=B4
      else
        [ "$boot_cli" = 0 ] && behaviour=B1 || behaviour=B3
      fi
      sudo raspi-config nonint do_boot_behaviour "$behaviour" 2>/dev/null || true
    fi
    case "$blanking" in 0|1) sudo raspi-config nonint do_blanking "$blanking" 2>/dev/null || true ;; esac
  fi
}

if [ "$command" = remove ]; then
  if [ ! -d "$VIEWER_DIR" ]; then
    printf 'LibreDisplay Viewer is not installed.\n'
    exit 0
  fi
  pkill -f "$VIEWER_DIR/start.sh" 2>/dev/null || true
  pkill -f -- "--user-data-dir=$VIEWER_DIR/chromium" 2>/dev/null || true
  restore_host_state
  rm -rf "$VIEWER_DIR"
  printf 'LibreDisplay Viewer removed. Reboot recommended: sudo reboot\n'
  exit 0
fi

DISPLAY_LINK=${1:-}
[ -n "$DISPLAY_LINK" ] || { printf 'A read-only Display Link is required.\n' >&2; usage >&2; exit 2; }
case "$DISPLAY_LINK" in
  http://*/display/*\?access=*|https://*/display/*\?access=*|http://*/display\?access=*|https://*/display\?access=*) ;;
  *) printf 'That does not look like a LibreDisplay read-only Display Link.\n' >&2; exit 2 ;;
esac
case "$DISPLAY_LINK" in *[[:space:]]*) printf 'Display Link must not contain spaces.\n' >&2; exit 2 ;; esac

if [ -f "$HOME/libredisplay/data/.installed" ]; then
  printf 'This Pi already has the full native LibreDisplay server installed.\n' >&2
  printf 'Viewer mode is intended for a separate screen-only Pi.\n' >&2
  exit 1
fi

command -v sudo >/dev/null 2>&1 || { printf 'sudo is required.\n' >&2; exit 1; }
command -v apt >/dev/null 2>&1 || { printf 'This helper requires Raspberry Pi OS/Debian with apt.\n' >&2; exit 1; }
command -v raspi-config >/dev/null 2>&1 || { printf 'LibreDisplay Viewer is intended for Raspberry Pi OS.\n' >&2; exit 1; }
if [ ! -e /etc/init.d/lightdm ] && ! systemctl list-unit-files --no-legend lightdm.service 2>/dev/null | grep -q '^lightdm.service'; then
  printf 'LibreDisplay Viewer requires Raspberry Pi OS with Desktop (labwc/Wayland).\n' >&2
  exit 1
fi

printf 'Checking the Display Link...\n'
status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "$DISPLAY_LINK" 2>/dev/null || true)
case "$status" in
  302|303|307|308) ;;
  *)
    printf 'The Display Link could not be validated (HTTP %s).\n' "${status:-error}" >&2
    printf 'Confirm the Docker server is running with --lan and this Pi is on the same private network.\n' >&2
    exit 1
    ;;
esac

sudo -v
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt install -y chromium curl labwc raspi-config swayidle wtype fonts-liberation2 fonts-noto-core fonts-dejavu-core

mkdir -p "$DATA_DIR" "$LABWC_DIR"
chmod 700 "$VIEWER_DIR" "$DATA_DIR"

if [ ! -f "$DATA_DIR/install_state.json" ]; then
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
Path(sys.argv[1]).write_text(json.dumps({
    "boot_cli":query("get_boot_cli"),
    "autologin":query("get_autologin"),
    "blanking":query("get_blanking"),
},indent=2)+"\n",encoding="utf-8")
PY
  chmod 600 "$DATA_DIR/install_state.json"
fi

if [ ! -f "$DATA_DIR/labwc-rc.before" ] && [ ! -f "$DATA_DIR/labwc-rc.missing" ]; then
  if [ -f "$RC_FILE" ]; then cp -p "$RC_FILE" "$DATA_DIR/labwc-rc.before"; else : > "$DATA_DIR/labwc-rc.missing"; fi
fi
if [ ! -f "$DATA_DIR/labwc-autostart.before" ] && [ ! -f "$DATA_DIR/labwc-autostart.missing" ]; then
  if [ -f "$AUTOSTART_FILE" ]; then cp -p "$AUTOSTART_FILE" "$DATA_DIR/labwc-autostart.before"; else : > "$DATA_DIR/labwc-autostart.missing"; fi
fi

printf '%s\n' "$DISPLAY_LINK" > "$LINK_FILE"
chmod 600 "$LINK_FILE"
cp "$0" "$VIEWER_DIR/viewer-setup.sh"
chmod 700 "$VIEWER_DIR/viewer-setup.sh"

cat > "$START_FILE" <<'START'
#!/bin/sh
set -eu
VIEWER_DIR="$HOME/.local/share/libredisplay-viewer"
LINK_FILE="$VIEWER_DIR/display-link.txt"
PROFILE_DIR="$VIEWER_DIR/chromium"
[ -s "$LINK_FILE" ] || { printf 'LibreDisplay Viewer link is missing.\n' >&2; exit 1; }
URL=$(cat "$LINK_FILE")
mkdir -p "$PROFILE_DIR"
BROWSER=""
for candidate in chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then BROWSER=$(command -v "$candidate"); break; fi
done
[ -n "$BROWSER" ] || { printf 'Chromium was not found.\n' >&2; exit 1; }
while :; do
  "$BROWSER" \
    --kiosk \
    --start-maximized \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --no-first-run \
    --password-store=basic \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --user-data-dir="$PROFILE_DIR" \
    "$URL" || true
  sleep 2
done
START
chmod 700 "$START_FILE"

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
    if child.attrib.get('key')=='F24':
        actions=[a.attrib.get('name') for a in child if isinstance(a.tag,str) and local(a.tag)=='action']
        if 'HideCursor' in actions: keyboard.remove(child)
keybind=ET.SubElement(keyboard,q('keybind'),{'key':'F24','overrideInhibition':'yes'})
ET.SubElement(keybind,q('action'),{'name':'WarpCursor','x':'-1','y':'-1'})
ET.SubElement(keybind,q('action'),{'name':'HideCursor'})
try: ET.indent(tree,space='  ')
except AttributeError: pass
tree.write(rc,encoding='utf-8',xml_declaration=True)
PY

touch "$AUTOSTART_FILE"
tmp=$(mktemp)
grep -Fv '# LibreDisplay Viewer' "$AUTOSTART_FILE" \
  | grep -Fv "$START_FILE" \
  | grep -Fv "swayidle -w timeout 2 'wtype -k F24'" \
  | grep -Fv 'wtype -k F24' > "$tmp" || true
cat "$tmp" > "$AUTOSTART_FILE"
rm -f "$tmp"
printf '%s\n%s\n%s\n%s\n' \
  '# LibreDisplay Viewer' \
  'wtype -k F24 &' \
  "swayidle -w timeout 2 'wtype -k F24' &" \
  "sleep 5 && sh \"$START_FILE\" &" >> "$AUTOSTART_FILE"

sudo raspi-config nonint do_boot_behaviour B4
sudo raspi-config nonint do_blanking 1

printf '\nLibreDisplay Viewer is configured.\n'
printf 'This Pi will boot directly into the read-only Docker display.\n'
printf 'To change the link later, rerun the install command with a new Display Link.\n'
printf 'To remove Viewer mode: %s/viewer-setup.sh remove\n' "$VIEWER_DIR"
printf 'Reboot now? [Y/n] '
read answer || answer=y
case "$answer" in n|N|no|NO|No) printf 'Reboot later with: sudo reboot\n' ;; *) sudo reboot ;; esac
