#!/bin/sh
# LibreDisplay independent boot bridge. Installed outside the application tree.
# Never run an unverified update on startup and never require GitHub connectivity.
set -eu
umask 077
INSTALL_DIR="$HOME/libredisplay"
DATA_DIR="$INSTALL_DIR/data"
RECOVERY="$HOME/libredisplay-recovery/release-rollback.py"
TRANSACTION="$DATA_DIR/update-transaction.json"
MIRROR_TRANSACTION="$HOME/libredisplay-recovery/update-transaction.json"
START="$INSTALL_DIR/scripts/start.sh"
if [ ! -f "$RECOVERY" ]; then
  printf 'LibreDisplay recovery guard missing; refusing unprotected boot.\n' >&2
  exit 1
fi
# Restores an interrupted replacement before loading runtime files. Validated
# replacements remain pending until their real dashboard HTTP endpoint responds.
python3 "$RECOVERY" --install-dir "$INSTALL_DIR" recover-pending --defer-validated || exit 1
if [ ! -f "$TRANSACTION" ] && [ ! -f "$MIRROR_TRANSACTION" ]; then
  exec /bin/sh "$START"
fi
# Only a validated transaction should survive the recovery call.
[ -f "$MIRROR_TRANSACTION" ] && TRANSACTION="$MIRROR_TRANSACTION"
read_result=$(python3 - "$TRANSACTION" <<'PYREAD'
import json,sys,re
try:
    obj=json.load(open(sys.argv[1],encoding='utf-8'))
    state=obj.get('state'); snapshot=obj.get('snapshotId'); version=obj.get('toVersion')
    if state!='validated' or not isinstance(snapshot,str) or not re.fullmatch(r'[A-Za-z0-9_.-]{1,120}',snapshot) or not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+',str(version)):
        raise ValueError('Unexpected transaction')
    print(snapshot,version)
except Exception as exc:
    print('Boot transaction invalid: '+str(exc),file=sys.stderr)
    raise SystemExit(1)
PYREAD
) || exit 1
set -- $read_result
SNAPSHOT_ID=$1
NEW_VERSION=$2
# The native kiosk launcher remains responsible for its own server/browser.
LIBREDISPLAY_BOOT_GUARD=1 /bin/sh "$START" &
START_PID=$!
# Honor saved port without evaluating environment-file code in a privileged shell.
PORT=$(python3 - "$DATA_DIR/libredisplay.env" <<'PYPORT'
import re,sys
port='8787'
try:
 for line in open(sys.argv[1],encoding='utf-8'):
  m=re.match(r'^\s*(?:export\s+)?DASHBOARD_PORT\s*=\s*[\x27\"]?(\d+)[\x27\"]?\s*$',line)
  if m and 1<=int(m.group(1))<=65535: port=m.group(1)
except OSError: pass
print(port)
PYPORT
)
# A slow Pi can legitimately need time to start Chromium and the HTTP server.
# Do not depend on any internet connection; check the actual local dashboard.
healthy=0
tries=0
while [ "$tries" -lt 120 ]; do
  if ! kill -0 "$START_PID" 2>/dev/null; then break; fi
  if python3 - "$PORT" "$NEW_VERSION" "$INSTALL_DIR" <<'PYHEALTH'
import sys,json,urllib.request
port,version,root=sys.argv[1:]
try:
    if open(root+'/VERSION',encoding='utf-8').read().strip()!=version: raise ValueError('wrong version')
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for suffix in ('/healthz','/dashboard.html'):
        with opener.open('http://127.0.0.1:'+port+suffix,timeout=2) as response:
            if response.status!=200: raise ValueError('unhealthy HTTP response')
            content=response.read(4096)
            if not content: raise ValueError('empty response')
            if suffix=='/healthz':
                health=json.loads(content)
                if health.get('ok') is not True or health.get('version') != version: raise ValueError('wrong running dashboard version')
except Exception: raise SystemExit(1)
PYHEALTH
  then
    # Three consecutive good probes avoid committing a transient start.
    if [ "${streak:-0}" -ge 2 ]; then healthy=1; break; fi
    streak=$(( ${streak:-0} + 1 ))
  else
    streak=0
  fi
  tries=$((tries+1))
  sleep 1
done
if [ "$healthy" -eq 1 ]; then
  if python3 "$RECOVERY" --install-dir "$INSTALL_DIR" complete-update --snapshot-id "$SNAPSHOT_ID"; then
    printf 'LibreDisplay boot health accepted for v%s.\n' "$NEW_VERSION"
    wait "$START_PID" || true
    exit 0
  fi
  printf 'LibreDisplay transaction commit failed for v%s; attempting verified rollback.\n' "$NEW_VERSION" >&2
fi
printf 'LibreDisplay post-boot health failed for v%s; restoring verified snapshot.\n' "$NEW_VERSION" >&2
kill "$START_PID" 2>/dev/null || true
wait "$START_PID" 2>/dev/null || true
python3 "$RECOVERY" --install-dir "$INSTALL_DIR" recover-pending --force-rollback || exit 1
exec /bin/sh "$INSTALL_DIR/scripts/start.sh"
