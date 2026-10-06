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

write_watchdog_state() {
  reason=${1:-}
  now=$(date +%s)
  tmp="$WATCHDOG_STATE_FILE.tmp.$$"
  printf '{"serverRestarts":%s,"browserRestarts":%s,"lastReason":"%s","lastRecoveryAt":%s}\n' \
    "$SERVER_RECOVERY_COUNT" "$BROWSER_RECOVERY_COUNT" "$reason" "$now" >"$tmp"
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
  python3 -I "$SERVER" &
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

launch_browser() {
  rm -f "$KIOSK_HEARTBEAT_FILE" 2>/dev/null || true
  BROWSER_STARTED_AT=$(date +%s)
  CURRENT_BROWSER_MODE=$(read_display_mode)
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
      --noerrdialogs \
      --disable-session-crashed-bubble \
      --disable-background-timer-throttling \
      --disable-backgrounding-occluded-windows \
      --disable-renderer-backgrounding \
      --no-first-run \
      --password-store=basic \
      --disable-pinch \
      --overscroll-history-navigation=0 \
      --enable-features=OverlayScrollbar \
      --user-data-dir="$DATA_DIR/chromium" \
      "$URL" &
  else
    "$BROWSER" \
      --kiosk \
      --start-maximized \
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
      --enable-features=OverlayScrollbar \
      --user-data-dir="$DATA_DIR/chromium" \
      "$URL" &
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
