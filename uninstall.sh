#!/bin/sh
set -eu
umask 077

ASSUME_YES=0
PURGE=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=1 ;;
    --purge) PURGE=1 ;;
    -h|--help)
      printf 'Usage: %s [--yes] [--purge]\n' "$0"
      printf 'Removes LibreDisplay and restores the desktop state saved at install time.\n'
      printf 'Without --purge, dashboard data is copied to a timestamped folder first.\n'
      printf '%s\n' '--purge removes LibreDisplay data and LibreDisplay backup archives for a complete removal.'
      exit 0
      ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

INSTALL_DIR="$HOME/libredisplay"
DATA_DIR="$INSTALL_DIR/data"
BACKUP_DIR="$HOME/libredisplay-backups"
LABWC_DIR="$HOME/.config/labwc"
AUTOSTART_FILE="$LABWC_DIR/autostart"
RC_FILE="$LABWC_DIR/rc.xml"

if [ "$ASSUME_YES" -ne 1 ]; then
  printf '\nLibreDisplay Uninstaller\n'
  printf '========================\n'
  if [ "$PURGE" -eq 1 ]; then
    printf 'PURGE MODE: LibreDisplay settings, profiles, pairing keys, cache, local project media,\n'
    printf 'LibreDisplay backups, Docker state, NAS credentials, and managed mounts will be removed.\n'
  else
    printf 'LibreDisplay will be removed. Dashboard data and project-local media will first be saved\n'
    printf 'to a timestamped folder in your home directory.\n'
  fi
  printf 'Photos stored elsewhere on the Pi or on a NAS are never intentionally deleted.\n'
  printf '\nContinue? [y/N] '
  read answer || answer=n
  case "$answer" in y|Y|yes|YES|Yes) ;; *) printf 'Uninstall cancelled.\n'; exit 0 ;; esac
fi

if [ "$PURGE" -ne 1 ]; then
  stamp=$(date +%Y%m%d-%H%M%S)
  save="$HOME/LibreDisplay-data-$stamp"
  mkdir -p "$save"
  if [ -d "$DATA_DIR" ]; then cp -a "$DATA_DIR" "$save/data"; fi
  if [ -d "$INSTALL_DIR/media" ]; then cp -a "$INSTALL_DIR/media" "$save/media"; fi
  chmod -R go-rwx "$save" 2>/dev/null || true
  printf 'Saved dashboard data to: %s\n' "$save"
fi

pkill -f "$INSTALL_DIR/app/dashboard_server.py" 2>/dev/null || true
pkill -f "$INSTALL_DIR/dashboard_server.py" 2>/dev/null || true
pkill -f '127.0.0.1:8787' 2>/dev/null || true

if command -v docker >/dev/null 2>&1; then
  if [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    (cd "$INSTALL_DIR" && docker compose down --remove-orphans --rmi local >/dev/null 2>&1) || true
  fi
  docker rm -f libredisplay >/dev/null 2>&1 || true
  docker image rm libredisplay-libredisplay >/dev/null 2>&1 || true
fi

if [ -f "$DATA_DIR/labwc-rc.before" ]; then
  mkdir -p "$LABWC_DIR"
  cp -p "$DATA_DIR/labwc-rc.before" "$RC_FILE"
elif [ -f "$DATA_DIR/labwc-rc.missing" ]; then
  rm -f "$RC_FILE"
elif [ -f "$RC_FILE" ]; then
  python3 - "$RC_FILE" <<'PY' || true
import sys, xml.etree.ElementTree as ET
from pathlib import Path
rc=Path(sys.argv[1])
parser=ET.XMLParser(target=ET.TreeBuilder(insert_comments=True)); tree=ET.parse(rc,parser=parser); root=tree.getroot()
def local(tag): return tag.rsplit('}',1)[-1]
changed=False
for keyboard in [x for x in root.iter() if isinstance(x.tag,str) and local(x.tag)=='keyboard']:
    for child in list(keyboard):
        if not isinstance(child.tag,str) or local(child.tag)!='keybind': continue
        key=child.attrib.get('key')
        actions=[a.attrib.get('name') for a in child if isinstance(a.tag,str) and local(a.tag)=='action']
        if key in {'F24','A-W-C-S-F12'} and 'HideCursor' in actions:
            keyboard.remove(child); changed=True
if changed:
    try: ET.indent(tree,space='  ')
    except AttributeError: pass
    tree.write(rc,encoding='utf-8',xml_declaration=True)
PY
fi
rm -f "$LABWC_DIR/rc.xml.libredisplay-backup" "$LABWC_DIR"/rc.xml.before-libredisplay-* 2>/dev/null || true

if [ -f "$DATA_DIR/labwc-autostart.before" ]; then
  mkdir -p "$LABWC_DIR"
  cp -p "$DATA_DIR/labwc-autostart.before" "$AUTOSTART_FILE"
elif [ -f "$DATA_DIR/labwc-autostart.missing" ]; then
  rm -f "$AUTOSTART_FILE"
elif [ -f "$AUTOSTART_FILE" ]; then
  tmp=$(mktemp)
  grep -Fv '# LibreDisplay' "$AUTOSTART_FILE" \
    | grep -Fv "$INSTALL_DIR/scripts/start.sh" \
    | grep -Fv "$INSTALL_DIR/start_dashboard.sh" \
    | grep -Fv 'wtype -k F24' \
    | grep -Fv "swayidle -w timeout 2 'wtype -k F24'" > "$tmp" || true
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

if [ -r /etc/fstab ]; then
  sudo python3 - <<'PY'
from pathlib import Path
p=Path('/etc/fstab')
lines=p.read_text(encoding='utf-8',errors='replace').splitlines()
out=[]; i=0
while i < len(lines):
    line=lines[i]
    if line.startswith('# LibreDisplay NAS:'):
        i += 1
        if i < len(lines) and ' /mnt/libredisplay/' in lines[i]:
            i += 1
        continue
    out.append(line); i += 1
p.write_text('\n'.join(out).rstrip()+'\n',encoding='utf-8')
PY
fi

for base in /mnt/libredisplay; do
  if [ -d "$base" ]; then
    for mountpoint in "$base"/*; do
      [ -e "$mountpoint" ] || continue
      sudo umount "$mountpoint" 2>/dev/null || true
    done
    sudo find "$base" -depth -type d -empty -delete 2>/dev/null || true
  fi
done
sudo rm -rf /etc/libredisplay 2>/dev/null || true
if [ -f /usr/local/bin/libredisplay ] && grep -q 'REPOSITORY = "Gubna-Tech/LibreDisplay"' /usr/local/bin/libredisplay 2>/dev/null; then
  sudo rm -f /usr/local/bin/libredisplay
fi
sudo systemctl daemon-reload 2>/dev/null || true

rm -rf "$INSTALL_DIR"

if [ "$PURGE" -eq 1 ]; then
  rm -rf "$BACKUP_DIR"
fi

printf '\nLibreDisplay has been removed.\n'
if [ "$PURGE" -eq 1 ]; then
  printf 'LibreDisplay application data and LibreDisplay backup archives were purged.\n'
fi
printf 'Shared Debian packages were left installed so unrelated applications are not damaged.\n'
printf 'If a non-empty /mnt/libredisplay directory remains, it contains data not removed by LibreDisplay.\n'
printf 'Reboot before reinstalling LibreDisplay: sudo reboot\n'
