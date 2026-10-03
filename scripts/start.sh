#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$ROOT_DIR/data/libredisplay.env"
SERVER="$ROOT_DIR/app/dashboard_server.py"
DATA_DIR="$ROOT_DIR/data"

mkdir -p "$DATA_DIR"
umask 077

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
export DASHBOARD_HOST DASHBOARD_PORT DASHBOARD_REMOTE_ENABLED DASHBOARD_REMOTE_NETWORKS DASHBOARD_DATA_DIR DASHBOARD_ENDPOINT
KIOSK_HEARTBEAT_FILE="$DASHBOARD_DATA_DIR/kiosk-heartbeat.json"

SERVER_PID=""
BROWSER_PID=""
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
  BROWSER_PID=$!
}

while :; do
  if ! start_server; then
    printf 'LibreDisplay server failed to start; retrying in 3 seconds.\n' >&2
    sleep 3
    continue
  fi

  launch_browser
  SERVER_HEALTH_FAILURES=0
  while kill -0 "$SERVER_PID" 2>/dev/null; do
    if ! curl -fsS --max-time 2 "http://127.0.0.1:${DASHBOARD_PORT}/healthz" >/dev/null 2>&1; then
      SERVER_HEALTH_FAILURES=$((SERVER_HEALTH_FAILURES + 1))
      if [ "$SERVER_HEALTH_FAILURES" -ge 3 ]; then
        printf 'LibreDisplay server health check failed repeatedly; restarting server and kiosk.\n' >&2
        kill "$SERVER_PID" 2>/dev/null || true
        break
      fi
    else
      SERVER_HEALTH_FAILURES=0
    fi

    if ! kill -0 "$BROWSER_PID" 2>/dev/null; then
      wait "$BROWSER_PID" 2>/dev/null || true
      BROWSER_PID=""
      sleep 2
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
        printf 'LibreDisplay kiosk heartbeat became stale; restarting Chromium.\n' >&2
        kill "$BROWSER_PID" 2>/dev/null || true
        wait "$BROWSER_PID" 2>/dev/null || true
        BROWSER_PID=""
        sleep 2
        launch_browser
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
  printf 'LibreDisplay server stopped; restarting in 3 seconds.\n' >&2
  sleep 3
done
