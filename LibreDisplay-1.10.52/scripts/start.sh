#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$ROOT_DIR/data/libredisplay.env"
SERVER="$ROOT_DIR/app/dashboard_server.py"
DATA_DIR="$ROOT_DIR/data"

umask 077
mkdir -p "$DATA_DIR"

# Native updates leave a private transaction marker before any live application
# path is replaced. If power was lost mid-update, recover the verified pre-update
# snapshot before loading configuration or starting the server.
if [ -f "$DATA_DIR/update-transaction.json" ]; then
  printf 'LibreDisplay found an interrupted update; checking recovery state...\n' >&2
  if ! python3 "$ROOT_DIR/scripts/release-rollback.py" --install-dir "$ROOT_DIR" recover-pending; then
    printf 'LibreDisplay could not safely recover the interrupted update. Startup stopped.\n' >&2
    exit 1
  fi
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

: "${DASHBOARD_HOST:=0.0.0.0}"
: "${DASHBOARD_PORT:=8787}"
: "${DASHBOARD_REMOTE_ENABLED:=0}"
: "${DASHBOARD_REMOTE_NETWORKS:=private}"
: "${DASHBOARD_DATA_DIR:=$DATA_DIR}"
: "${DASHBOARD_ENDPOINT:=main}"
: "${DASHBOARD_KIOSK_WATCHDOG:=1}"
: "${DASHBOARD_KIOSK_HEARTBEAT_TIMEOUT:=150}"
: "${PYTHONDONTWRITEBYTECODE:=1}"
export DASHBOARD_HOST DASHBOARD_PORT DASHBOARD_REMOTE_ENABLED DASHBOARD_REMOTE_NETWORKS DASHBOARD_DATA_DIR DASHBOARD_ENDPOINT PYTHONDONTWRITEBYTECODE
mkdir -p "$DASHBOARD_DATA_DIR"
KIOSK_HEARTBEAT_FILE="$DASHBOARD_DATA_DIR/kiosk-heartbeat.json"
DISPLAY_MODE_FILE="$DASHBOARD_DATA_DIR/display-mode.json"
WATCHDOG_STATE_FILE="$DASHBOARD_DATA_DIR/watchdog-state.json"
STARTUP_INTEGRITY_FILE="$DASHBOARD_DATA_DIR/startup-integrity.json"
BROWSER_LAUNCH_STATE_FILE="$DASHBOARD_DATA_DIR/browser-launch-state.json"
BROWSER_ACCEL_PROFILE_FILE="$DASHBOARD_DATA_DIR/browser-acceleration-profile.json"
BROWSER_LOG_FILE="$DASHBOARD_DATA_DIR/chromium-stderr.log"

reset_display_mode() {
  tmp="$DISPLAY_MODE_FILE.tmp.$$"
  printf '{"mode":"kiosk"}\n' >"$tmp"
  chmod 600 "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$DISPLAY_MODE_FILE"
}
read_display_mode() {
  mode=kiosk
  if [ -f "$DISPLAY_MODE_FILE" ]; then
    parsed=$(sed -n 's/.*"mode"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$DISPLAY_MODE_FILE" 2>/dev/null | head -n 1)
    [ "$parsed" = "windowed" ] && mode=windowed
  fi
  printf '%s' "$mode"
}
reset_display_mode

verify_startup_integrity() {
  version=$(cat "$ROOT_DIR/VERSION" 2>/dev/null || printf 'unknown')
  tmp="$STARTUP_INTEGRITY_FILE.tmp.$$"
  if ! python3 "$ROOT_DIR/scripts/release-rollback.py" --install-dir "$ROOT_DIR" verify-install --expected-version "$version" --json >"$tmp"; then
    rm -f "$tmp"
    printf 'LibreDisplay startup integrity verification failed. Startup stopped.\n' >&2
    exit 1
  fi
  chmod 600 "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$STARTUP_INTEGRITY_FILE"
}
verify_startup_integrity

SERVER_PID=""
BROWSER_PID=""
SERVER_RECOVERY_COUNT=0
BROWSER_RECOVERY_COUNT=0
SERVER_RESTART_DELAY=3
BROWSER_RESTART_DELAY=2
SERVER_STARTED_AT=0
BROWSER_ACCEL_PROFILE=normal
BROWSER_ACCEL_ATTEMPT=0
BROWSER_ACCEL_VERIFIED=0
BROWSER_ACCEL_FROM_PERSISTED=0
PI_MODEL=""
if [ -r /proc/device-tree/model ]; then
  PI_MODEL=$(tr -d '\000' </proc/device-tree/model 2>/dev/null || true)
fi
case "$PI_MODEL" in
  *"Raspberry Pi 4"*|*"Raspberry Pi 5"*) BROWSER_ACCEL_PROFILE=pi-angle-gles ;;
esac

is_pi_accel_profile() {
  case "${1:-}" in
    pi-angle-gles|pi-angle-gl|pi-angle-vulkan|pi-default) return 0 ;;
    *) return 1 ;;
  esac
}

read_persisted_accel_profile() {
  [ -f "$BROWSER_ACCEL_PROFILE_FILE" ] || return 1
  profile=$(python3 - "$BROWSER_ACCEL_PROFILE_FILE" <<'PYPROFILE' 2>/dev/null || true
import json, sys
try:
    with open(sys.argv[1], 'r', encoding='utf-8') as fh:
        row=json.load(fh)
    print(str(row.get('profile') or ''), end='')
except Exception:
    pass
PYPROFILE
)
  if is_pi_accel_profile "$profile"; then
    BROWSER_ACCEL_PROFILE=$profile
    BROWSER_ACCEL_FROM_PERSISTED=1
    return 0
  fi
  return 1
}

persist_accel_profile() {
  is_pi_accel_profile "$BROWSER_ACCEL_PROFILE" || return 0
  now=$(date +%s)
  python3 - "$BROWSER_ACCEL_PROFILE_FILE" "$BROWSER_ACCEL_PROFILE" "$now" <<'PYPROFILE' 2>/dev/null || true
import json, os, sys
path, profile, verified = sys.argv[1:]
payload={"profile":profile,"verifiedAt":int(verified)}
tmp=path+".tmp."+str(os.getpid())
with open(tmp,'w',encoding='utf-8') as fh:
    json.dump(payload,fh,separators=(',',':'))
    fh.write('\n')
os.chmod(tmp,0o600)
os.replace(tmp,path)
PYPROFILE
}

next_accel_profile() {
  case "$BROWSER_ACCEL_PROFILE" in
    pi-angle-gles) BROWSER_ACCEL_PROFILE=pi-angle-gl ;;
    pi-angle-gl) BROWSER_ACCEL_PROFILE=pi-angle-vulkan ;;
    pi-angle-vulkan) BROWSER_ACCEL_PROFILE=pi-default ;;
    *) return 1 ;;
  esac
  BROWSER_ACCEL_ATTEMPT=$((BROWSER_ACCEL_ATTEMPT + 1))
  BROWSER_ACCEL_VERIFIED=0
  return 0
}

advance_accel_profile_after_failure() {
  if [ "$BROWSER_ACCEL_FROM_PERSISTED" = "1" ]; then
    BROWSER_ACCEL_FROM_PERSISTED=0
    if [ "$BROWSER_ACCEL_PROFILE" != "pi-angle-gles" ]; then
      BROWSER_ACCEL_PROFILE=pi-angle-gles
      BROWSER_ACCEL_ATTEMPT=$((BROWSER_ACCEL_ATTEMPT + 1))
      BROWSER_ACCEL_VERIFIED=0
      return 0
    fi
  fi
  next_accel_profile
}

case "$PI_MODEL" in
  *"Raspberry Pi 4"*|*"Raspberry Pi 5"*) read_persisted_accel_profile || true ;;
esac

write_watchdog_state() {
  reason=${1:-}
  now=$(date +%s)
  tmp="$WATCHDOG_STATE_FILE.tmp.$$"
  printf '{"serverRestarts":%s,"browserRestarts":%s,"lastReason":"%s","lastRecoveryAt":%s,"browserAccelProfile":"%s"}\n' \
    "$SERVER_RECOVERY_COUNT" "$BROWSER_RECOVERY_COUNT" "$reason" "$now" "$BROWSER_ACCEL_PROFILE" >"$tmp"
  chmod 600 "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$WATCHDOG_STATE_FILE"
}
write_watchdog_state ""
cleanup() {
  [ -z "$BROWSER_PID" ] || kill "$BROWSER_PID" 2>/dev/null || true
  [ -z "$SERVER_PID" ] || kill "$SERVER_PID" 2>/dev/null || true
  [ -z "$BROWSER_PID" ] || wait "$BROWSER_PID" 2>/dev/null || true
  [ -z "$SERVER_PID" ] || wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' INT TERM HUP

URL="http://127.0.0.1:${DASHBOARD_PORT}/dashboard.html?endpoint=${DASHBOARD_ENDPOINT}"

wait_for_server() {
  count=0
  while [ "$count" -lt 60 ]; do
    if curl -fsS --max-time 1 "$URL" >/dev/null 2>&1; then return 0; fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then return 1; fi
    count=$((count + 1))
    sleep 1
  done
  return 1
}

start_server() {
  python3 -I -B "$SERVER" &
  SERVER_PID=$!
  if ! wait_for_server; then
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
    return 1
  fi
}

if [ "${DASHBOARD_NO_BROWSER:-0}" = "1" ]; then
  start_server || { printf 'LibreDisplay server did not start.\n' >&2; exit 1; }
  printf 'LibreDisplay server: %s\n' "$URL"
  wait "$SERVER_PID"
  exit $?
fi

BROWSER=""
for candidate in chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then BROWSER=$(command -v "$candidate"); break; fi
done
[ -n "$BROWSER" ] || { printf 'Chromium was not found.\n' >&2; exit 1; }

clear_chromium_gpu_caches() {
  for name in GPUCache GrShaderCache ShaderCache DawnCache; do
    rm -rf "$DATA_DIR/chromium/$name" 2>/dev/null || true
  done
}

write_browser_launch_state() {
  now=$(date +%s)
  python3 - "$BROWSER_LAUNCH_STATE_FILE" "$BROWSER_ACCEL_PROFILE" "$CURRENT_BROWSER_MODE" "$BROWSER" "$BROWSER_FEATURES" "$BROWSER_BASE_ACCEL_FLAGS" "$BROWSER_ACCEL_FLAGS" "$now" "$BROWSER_ACCEL_ATTEMPT" "$BROWSER_ACCEL_PROFILE_FILE" <<'PYLAUNCH' 2>/dev/null || true
import json, os, shlex, sys
path, profile, mode, browser, features, base_accel, accel, started, attempt, persisted_path = sys.argv[1:]
flags = ["--ozone-platform=wayland"]
flags.extend(shlex.split(base_accel or ""))
flags.extend(shlex.split(accel or ""))
flags.append("--enable-features=" + features)
persisted = ""
try:
    with open(persisted_path, 'r', encoding='utf-8') as fh:
        persisted = str((json.load(fh) or {}).get('profile') or '')
except Exception:
    pass
payload = {
    "profile": profile,
    "mode": mode,
    "browser": os.path.basename(browser),
    "startedAt": int(started),
    "attempt": int(attempt),
    "requestedFlags": flags,
    "profileCandidates": ["pi-angle-gles", "pi-angle-gl", "pi-angle-vulkan", "pi-default"],
    "persistedProfile": persisted,
}
tmp = path + ".tmp." + str(os.getpid())
with open(tmp, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, separators=(",", ":"))
    fh.write("\n")
os.chmod(tmp, 0o600)
os.replace(tmp, path)
PYLAUNCH
}

heartbeat_graphics_state() {
  [ -f "$KIOSK_HEARTBEAT_FILE" ] || { printf unknown; return; }
  python3 - "$KIOSK_HEARTBEAT_FILE" <<'PY' 2>/dev/null || printf unknown
import json, sys
try:
    with open(sys.argv[1], 'r', encoding='utf-8') as fh:
        row=json.load(fh)
    graphics=((row.get('frontendPerformance') or {}).get('graphics') or {})
    if graphics.get('software') is True:
        print('software', end='')
    elif graphics.get('webgl') is True or graphics.get('webgl2') is True:
        print('hardware', end='')
    elif graphics:
        print('software', end='')
    else:
        print('unknown', end='')
except Exception:
    print('unknown', end='')
PY
}

trim_browser_log() {
  [ -f "$BROWSER_LOG_FILE" ] || return 0
  size=$(wc -c <"$BROWSER_LOG_FILE" 2>/dev/null || printf '0')
  case "$size" in *[!0-9]*|'') size=0 ;; esac
  if [ "$size" -gt 524288 ]; then
    tail -n 500 "$BROWSER_LOG_FILE" >"$BROWSER_LOG_FILE.tmp.$$" 2>/dev/null || :
    mv -f "$BROWSER_LOG_FILE.tmp.$$" "$BROWSER_LOG_FILE" 2>/dev/null || true
  fi
}

launch_browser() {
  rm -f "$KIOSK_HEARTBEAT_FILE" 2>/dev/null || true
  if [ "$BROWSER_ACCEL_PROFILE" = "pi-angle-gles" ] && [ "$BROWSER_ACCEL_ATTEMPT" = "0" ] && [ ! -f "$BROWSER_ACCEL_PROFILE_FILE" ]; then
    clear_chromium_gpu_caches
  fi
  trim_browser_log
  BROWSER_ACCEL_VERIFIED=0
  BROWSER_STARTED_AT=$(date +%s)
  BROWSER_BASE_ACCEL_FLAGS="--enable-gpu-rasterization --enable-zero-copy"
  BROWSER_ACCEL_FLAGS=""
  BROWSER_FEATURES="OverlayScrollbar"
  case "$BROWSER_ACCEL_PROFILE" in
    pi-angle-gles)
      BROWSER_ACCEL_FLAGS="--ignore-gpu-blocklist --use-angle=gles"
      BROWSER_FEATURES="OverlayScrollbar,CanvasOopRasterization"
      ;;
    pi-angle-gl)
      BROWSER_ACCEL_FLAGS="--ignore-gpu-blocklist --use-angle=gl"
      BROWSER_FEATURES="OverlayScrollbar,CanvasOopRasterization"
      ;;
    pi-angle-vulkan)
      BROWSER_ACCEL_FLAGS="--ignore-gpu-blocklist --use-angle=vulkan"
      BROWSER_FEATURES="OverlayScrollbar,CanvasOopRasterization"
      ;;
    pi-default)
      BROWSER_BASE_ACCEL_FLAGS=""
      BROWSER_ACCEL_FLAGS="--ignore-gpu-blocklist"
      BROWSER_FEATURES="OverlayScrollbar"
      ;;
  esac
  CURRENT_BROWSER_MODE=$(read_display_mode)
  printf '\n=== LibreDisplay Chromium launch profile=%s attempt=%s started=%s ===\n' "$BROWSER_ACCEL_PROFILE" "$BROWSER_ACCEL_ATTEMPT" "$BROWSER_STARTED_AT" >>"$BROWSER_LOG_FILE" 2>/dev/null || true
  write_browser_launch_state
  if [ "$CURRENT_BROWSER_MODE" = "windowed" ]; then
    SCREEN_RES=$(xrandr --current 2>/dev/null | awk '/\*/{print $1; exit}' || true)
    case "$SCREEN_RES" in
      *x*) SCREEN_W=${SCREEN_RES%x*}; SCREEN_H=${SCREEN_RES#*x} ;;
      *) SCREEN_W=1280; SCREEN_H=800 ;;
    esac
    case "$SCREEN_W:$SCREEN_H" in *[!0-9:]*|:) SCREEN_W=1280; SCREEN_H=800 ;; esac
    WINDOW_W=$((SCREEN_W * 82 / 100)); WINDOW_H=$((SCREEN_H * 82 / 100))
    WINDOW_X=$(( (SCREEN_W - WINDOW_W) / 2 )); WINDOW_Y=$(( (SCREEN_H - WINDOW_H) / 2 ))
    "$BROWSER" \
      --new-window \
      --window-size="$WINDOW_W,$WINDOW_H" \
      --window-position="$WINDOW_X,$WINDOW_Y" \
      --ozone-platform=wayland \
      $BROWSER_BASE_ACCEL_FLAGS \
      $BROWSER_ACCEL_FLAGS \
      --noerrdialogs \
      --disable-session-crashed-bubble \
      --disable-background-timer-throttling \
      --disable-backgrounding-occluded-windows \
      --disable-renderer-backgrounding \
      --no-first-run \
      --password-store=basic \
      --disable-pinch \
      --overscroll-history-navigation=0 \
      --enable-features="$BROWSER_FEATURES" \
      --user-data-dir="$DATA_DIR/chromium" \
      "$URL" 2>>"$BROWSER_LOG_FILE" &
  else
    "$BROWSER" \
      --kiosk \
      --start-maximized \
      --ozone-platform=wayland \
      $BROWSER_BASE_ACCEL_FLAGS \
      $BROWSER_ACCEL_FLAGS \
      --noerrdialogs \
      --disable-infobars \
      --disable-session-crashed-bubble \
      --disable-background-timer-throttling \
      --disable-backgrounding-occluded-windows \
      --disable-renderer-backgrounding \
      --no-first-run \
      --password-store=basic \
      --disable-pinch \
      --overscroll-history-navigation=0 \
      --enable-features="$BROWSER_FEATURES" \
      --user-data-dir="$DATA_DIR/chromium" \
      "$URL" 2>>"$BROWSER_LOG_FILE" &
  fi
  BROWSER_PID=$!
}

while :; do
  if ! start_server; then
    SERVER_RECOVERY_COUNT=$((SERVER_RECOVERY_COUNT + 1))
    write_watchdog_state "server-start-failed"
    printf 'LibreDisplay server failed to start; retrying in %s seconds.\n' "$SERVER_RESTART_DELAY" >&2
    sleep "$SERVER_RESTART_DELAY"
    [ "$SERVER_RESTART_DELAY" -ge 30 ] || SERVER_RESTART_DELAY=$((SERVER_RESTART_DELAY * 2))
    [ "$SERVER_RESTART_DELAY" -le 30 ] || SERVER_RESTART_DELAY=30
    continue
  fi

  SERVER_STARTED_AT=$(date +%s)
  launch_browser
  SERVER_HEALTH_FAILURES=0
  while kill -0 "$SERVER_PID" 2>/dev/null; do
    if ! curl -fsS --max-time 2 "http://127.0.0.1:${DASHBOARD_PORT}/healthz" >/dev/null 2>&1; then
      SERVER_HEALTH_FAILURES=$((SERVER_HEALTH_FAILURES + 1))
      if [ "$SERVER_HEALTH_FAILURES" -ge 3 ]; then
        SERVER_RECOVERY_COUNT=$((SERVER_RECOVERY_COUNT + 1))
        write_watchdog_state "server-health-failed"
        printf 'LibreDisplay server health check failed repeatedly; restarting server and kiosk.\n' >&2
        kill "$SERVER_PID" 2>/dev/null || true
        break
      fi
    else
      SERVER_HEALTH_FAILURES=0
    fi

    DESIRED_BROWSER_MODE=$(read_display_mode)
    if [ "$DESIRED_BROWSER_MODE" != "$CURRENT_BROWSER_MODE" ]; then
      write_watchdog_state "display-mode-$DESIRED_BROWSER_MODE"
      kill "$BROWSER_PID" 2>/dev/null || true
      wait "$BROWSER_PID" 2>/dev/null || true
      BROWSER_PID=""
      launch_browser
      sleep 1
      continue
    fi

    if ! kill -0 "$BROWSER_PID" 2>/dev/null; then
      wait "$BROWSER_PID" 2>/dev/null || true
      BROWSER_PID=""
      BROWSER_RECOVERY_COUNT=$((BROWSER_RECOVERY_COUNT + 1))
      write_watchdog_state "browser-exited"
      sleep "$BROWSER_RESTART_DELAY"
      [ "$BROWSER_RESTART_DELAY" -ge 30 ] || BROWSER_RESTART_DELAY=$((BROWSER_RESTART_DELAY * 2))
      [ "$BROWSER_RESTART_DELAY" -le 30 ] || BROWSER_RESTART_DELAY=30
      launch_browser
    elif [ "$DASHBOARD_KIOSK_WATCHDOG" = "1" ]; then
      NOW=$(date +%s)
      if is_pi_accel_profile "$BROWSER_ACCEL_PROFILE" && [ $((NOW - BROWSER_STARTED_AT)) -ge 20 ]; then
        GRAPHICS_STATE=$(heartbeat_graphics_state)
        if [ "$GRAPHICS_STATE" = "hardware" ] && [ "$BROWSER_ACCEL_VERIFIED" = "0" ]; then
          BROWSER_ACCEL_VERIFIED=1
          persist_accel_profile
          write_watchdog_state "browser-hardware-graphics"
          printf 'LibreDisplay verified Chromium hardware graphics with profile %s; profile persisted.\n' "$BROWSER_ACCEL_PROFILE" >&2
        elif [ "$GRAPHICS_STATE" = "software" ] && [ "$BROWSER_ACCEL_VERIFIED" = "0" ]; then
          FAILED_PROFILE=$BROWSER_ACCEL_PROFILE
          rm -f "$BROWSER_ACCEL_PROFILE_FILE" 2>/dev/null || true
          if advance_accel_profile_after_failure; then
            BROWSER_RECOVERY_COUNT=$((BROWSER_RECOVERY_COUNT + 1))
            write_watchdog_state "browser-graphics-profile-$FAILED_PROFILE-failed"
            printf 'LibreDisplay could not create hardware WebGL with Chromium profile %s; retrying with %s.\n' "$FAILED_PROFILE" "$BROWSER_ACCEL_PROFILE" >&2
            kill "$BROWSER_PID" 2>/dev/null || true
            wait "$BROWSER_PID" 2>/dev/null || true
            BROWSER_PID=""
            clear_chromium_gpu_caches
            launch_browser
            sleep 2
            continue
          else
            BROWSER_ACCEL_VERIFIED=2
            BROWSER_RECOVERY_COUNT=$((BROWSER_RECOVERY_COUNT + 1))
            write_watchdog_state "browser-graphics-profiles-exhausted"
            printf 'LibreDisplay exhausted bounded Chromium hardware profiles; keeping the current kiosk available and reporting the failure remotely.\n' >&2
          fi
        fi
      fi
      NOW=$(date +%s)
      TIMEOUT=$DASHBOARD_KIOSK_HEARTBEAT_TIMEOUT
      case "$TIMEOUT" in *[!0-9]*|'') TIMEOUT=150 ;; esac
      [ "$TIMEOUT" -lt 90 ] && TIMEOUT=90
      STALE=0
      if [ -f "$KIOSK_HEARTBEAT_FILE" ]; then
        HEARTBEAT_MTIME=$(stat -c %Y "$KIOSK_HEARTBEAT_FILE" 2>/dev/null || printf '0')
        [ $((NOW - HEARTBEAT_MTIME)) -gt "$TIMEOUT" ] && STALE=1
      elif [ $((NOW - BROWSER_STARTED_AT)) -gt "$TIMEOUT" ]; then
        STALE=1
      fi
      if [ "$STALE" = "1" ]; then
        BROWSER_RECOVERY_COUNT=$((BROWSER_RECOVERY_COUNT + 1))
        write_watchdog_state "browser-heartbeat-stale"
        printf 'LibreDisplay kiosk heartbeat became stale; restarting Chromium.\n' >&2
        kill "$BROWSER_PID" 2>/dev/null || true
        wait "$BROWSER_PID" 2>/dev/null || true
        BROWSER_PID=""
        sleep "$BROWSER_RESTART_DELAY"
        [ "$BROWSER_RESTART_DELAY" -ge 30 ] || BROWSER_RESTART_DELAY=$((BROWSER_RESTART_DELAY * 2))
        [ "$BROWSER_RESTART_DELAY" -le 30 ] || BROWSER_RESTART_DELAY=30
        launch_browser
      else
        BROWSER_RESTART_DELAY=2
      fi
    fi
    sleep 5
  done

  if [ -n "$BROWSER_PID" ]; then
    kill "$BROWSER_PID" 2>/dev/null || true
    wait "$BROWSER_PID" 2>/dev/null || true
    BROWSER_PID=""
  fi
  wait "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
  NOW=$(date +%s)
  if [ "$SERVER_STARTED_AT" -gt 0 ] && [ $((NOW - SERVER_STARTED_AT)) -ge 300 ]; then
    SERVER_RESTART_DELAY=3
  else
    [ "$SERVER_RESTART_DELAY" -ge 30 ] || SERVER_RESTART_DELAY=$((SERVER_RESTART_DELAY * 2))
    [ "$SERVER_RESTART_DELAY" -le 30 ] || SERVER_RESTART_DELAY=30
  fi
  printf 'LibreDisplay server stopped; restarting in %s seconds.\n' "$SERVER_RESTART_DELAY" >&2
  sleep "$SERVER_RESTART_DELAY"
done
