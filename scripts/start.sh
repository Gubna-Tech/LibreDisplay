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
export DASHBOARD_HOST DASHBOARD_PORT DASHBOARD_REMOTE_ENABLED DASHBOARD_REMOTE_NETWORKS DASHBOARD_DATA_DIR DASHBOARD_ENDPOINT

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
  while kill -0 "$SERVER_PID" 2>/dev/null; do
    if ! kill -0 "$BROWSER_PID" 2>/dev/null; then
      wait "$BROWSER_PID" 2>/dev/null || true
      BROWSER_PID=""
      sleep 2
      launch_browser
    fi
    sleep 2
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
