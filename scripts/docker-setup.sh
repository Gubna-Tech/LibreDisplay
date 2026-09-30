#!/bin/sh
set -eu
umask 077

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

usage() {
  cat <<'HELP'
Usage:
  ./scripts/docker-setup.sh [start] [--lan | --bind ADDRESS] [--port PORT]
  ./scripts/docker-setup.sh status
  ./scripts/docker-setup.sh links
  ./scripts/docker-setup.sh logs
  ./scripts/docker-setup.sh stop
  ./scripts/docker-setup.sh reset

Commands:
  start   Build/start LibreDisplay. This is the default command.
  status  Show container status and the current LibreDisplay URLs.
  links   Reprint the dashboard, display, and admin links.
  logs    Follow LibreDisplay container logs.
  stop    Stop the container without deleting settings or media.
  reset   Remove Docker settings/state for a fresh setup; keeps ./media.

Start options:
  no option        Host-only access on 127.0.0.1 (safest first-run default)
  --lan            Allow trusted devices on the private LAN
  --bind ADDRESS   Bind Docker to a specific host address
  --port PORT      Host port to use (default 8787)
HELP
}

require_docker() {
  command -v docker >/dev/null 2>&1 || { printf 'Docker is not installed. Install Docker Engine or Docker Desktop first.\n' >&2; exit 1; }
  docker compose version >/dev/null 2>&1 || { printf 'Docker Compose v2 is required.\n' >&2; exit 1; }
}

load_env() {
  if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
  fi
  : "${DASHBOARD_BIND:=127.0.0.1}"
  : "${DASHBOARD_PORT:=8787}"
}

host_ip() {
  ip_value=""
  if command -v ip >/dev/null 2>&1; then
    ip_value=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)
  fi
  [ -n "$ip_value" ] || ip_value=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
  printf '%s' "$ip_value"
}

access_value() {
  field=$1
  [ -s data/dashboard_access.json ] || return 0
  sed -n "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" data/dashboard_access.json | head -n 1
}

show_links() {
  load_env
  token=$(access_value token)
  ip_value=$(host_ip)

  printf '\nLibreDisplay URLs\n'
  printf '%s\n' '-----------------'
  printf 'Local dashboard: http://127.0.0.1:%s/\n' "$DASHBOARD_PORT"

  if [ "$DASHBOARD_BIND" != "127.0.0.1" ] && [ "$DASHBOARD_BIND" != "::1" ]; then
    if [ -z "$ip_value" ]; then
      printf 'LAN address:      could not determine automatically\n'
      printf 'Run "ip addr" and substitute this host\047s private IP in the links below.\n'
      return 0
    fi
    printf 'LAN dashboard:   http://%s:%s/\n' "$ip_value" "$DASHBOARD_PORT"
    printf '\nREAD-ONLY DISPLAY LINKS\n'
    printf 'Open the matching link once on each TV/Pi/tablet screen:\n'
    if docker compose ps --status running --services 2>/dev/null | grep -qx 'libredisplay'; then
      docker compose exec -T libredisplay python3 - "$ip_value" "$DASHBOARD_PORT" <<'PY_ENDPOINTS' 2>/dev/null || true
import json,sys
from pathlib import Path
host,port=sys.argv[1:3]
path=Path('/data/dashboard_endpoints.json')
try: data=json.loads(path.read_text(encoding='utf-8'))
except Exception: data={}
for item in data.get('items',[]):
    if not isinstance(item,dict): continue
    eid=str(item.get('id') or '').strip(); name=str(item.get('name') or eid).strip(); token=str(item.get('displayToken') or '').strip()
    if eid and token: print(f"  {name}: http://{host}:{port}/display/{eid}?access={token}")
PY_ENDPOINTS
    else
      display_token=$(access_value displayToken)
      [ -z "$display_token" ] || printf '  Main display: http://%s:%s/display/main?access=%s\n' "$ip_value" "$DASHBOARD_PORT" "$display_token"
    fi
    if [ -n "$token" ]; then
      printf '\nADMIN PAIRING LINK\n'
      printf 'Open on the phone/computer you use to configure LibreDisplay:\n'
      printf 'http://%s:%s/pair?access=%s\n' "$ip_value" "$DASHBOARD_PORT" "$token"
    fi
  else
    if [ -n "$token" ]; then
      printf '\nLocal admin pairing link (normally unnecessary on the Docker host):\n'
      printf 'http://localhost:%s/pair?access=%s\n' "$DASHBOARD_PORT" "$token"
    fi
  fi
  printf '\nKeep pairing/display links private. Do not port-forward LibreDisplay to the public Internet.\n'
}

COMMAND=start
case "${1:-}" in
  start|status|links|logs|stop|reset)
    COMMAND=$1
    shift
    ;;
  -h|--help)
    usage
    exit 0
    ;;
esac

require_docker

case "$COMMAND" in
  status)
    docker compose ps
    show_links
    exit 0
    ;;
  links)
    show_links
    exit 0
    ;;
  logs)
    exec docker compose logs -f --tail=100 libredisplay
    ;;
  stop)
    docker compose down --remove-orphans
    printf 'LibreDisplay stopped. Settings and media were kept.\n'
    exit 0
    ;;
  reset)
    printf 'This removes Docker settings, pairing keys, cache, and .env. ./media is kept.\n'
    printf 'Continue? [y/N] '
    read answer || answer=n
    case "$answer" in y|Y|yes|YES|Yes) ;; *) printf 'Reset cancelled.\n'; exit 0 ;; esac
    docker compose down --remove-orphans --rmi local >/dev/null 2>&1 || true
    rm -rf data .env
    printf 'Docker state removed. The ./media folder was left untouched.\n'
    exit 0
    ;;
esac

if [ -f .env ]; then
  load_env
else
  DASHBOARD_BIND=127.0.0.1
  DASHBOARD_PORT=8787
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --lan)
      DASHBOARD_BIND=0.0.0.0
      ;;
    --bind)
      shift
      [ "$#" -gt 0 ] || { printf '%s\n' '--bind requires an address.' >&2; exit 2; }
      DASHBOARD_BIND=$1
      ;;
    --port)
      shift
      [ "$#" -gt 0 ] || { printf '%s\n' '--port requires a port number.' >&2; exit 2; }
      DASHBOARD_PORT=$1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

case "$DASHBOARD_PORT" in
  ''|*[!0-9]*) printf 'Invalid port: %s\n' "$DASHBOARD_PORT" >&2; exit 2 ;;
esac
if [ "$DASHBOARD_PORT" -lt 1 ] || [ "$DASHBOARD_PORT" -gt 65535 ]; then
  printf 'Invalid port: %s\n' "$DASHBOARD_PORT" >&2
  exit 2
fi

mkdir -p data media
chmod 700 data
chmod 755 media
cat > .env <<EOF_ENV
DASHBOARD_UID=$(id -u)
DASHBOARD_GID=$(id -g)
DASHBOARD_PORT=$DASHBOARD_PORT
DASHBOARD_BIND=$DASHBOARD_BIND
DASHBOARD_REMOTE_ENABLED=1
DASHBOARD_REMOTE_NETWORKS=private
DASHBOARD_REMOTE_SESSION_SECONDS=28800
DASHBOARD_DISPLAY_SESSION_SECONDS=31536000
EOF_ENV
chmod 600 .env

docker compose config >/dev/null
docker compose up -d --build --remove-orphans

count=0
while [ "$count" -lt 45 ]; do
  if [ -s data/dashboard_access.json ]; then
    if docker compose ps --status running --services 2>/dev/null | grep -qx 'libredisplay'; then
      break
    fi
  fi
  count=$((count + 1))
  sleep 1
done

if ! docker compose ps --status running --services 2>/dev/null | grep -qx 'libredisplay'; then
  printf '\nLibreDisplay did not remain running. Recent logs:\n' >&2
  docker compose logs --tail=80 libredisplay >&2 || true
  exit 1
fi

printf '\nLibreDisplay is running.\n'
printf 'Data:  %s/data\n' "$ROOT_DIR"
printf 'Media: %s/media (read-only inside LibreDisplay)\n' "$ROOT_DIR"
printf 'Bind:  %s:%s\n' "$DASHBOARD_BIND" "$DASHBOARD_PORT"
show_links
printf '\nUseful commands:\n'
printf '  ./scripts/docker-setup.sh status   # container status + links\n'
printf '  ./scripts/docker-setup.sh links    # reprint display/admin links\n'
printf '  ./scripts/docker-setup.sh logs     # follow logs\n'
printf '  ./scripts/docker-setup.sh stop     # stop, keep settings\n'
printf '  ./scripts/docker-setup.sh reset    # fresh Docker setup, keep ./media\n'
