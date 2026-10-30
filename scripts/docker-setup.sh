#!/bin/sh
set -eu
umask 077

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

# Source deployments keep Compose metadata in docker/ while persistent paths remain at the project root.
docker_compose() {
  docker compose -f "$ROOT_DIR/docker/docker-compose.yml" "$@"
}

usage() {
  cat <<'HELP'
Usage:
  ./scripts/docker-setup.sh [start] [--lan | --bind ADDRESS] [--port PORT]
  ./scripts/docker-setup.sh status
  ./scripts/docker-setup.sh links
  ./scripts/docker-setup.sh logs
  ./scripts/docker-setup.sh backup
  ./scripts/docker-setup.sh update
  ./scripts/docker-setup.sh stop
  ./scripts/docker-setup.sh reset

Commands:
  start   Build/start LibreDisplay. This is the default command.
  status  Show container status and the current LibreDisplay URLs.
  links   Reprint dashboard/display links and generate a one-time Owner code when LAN access is enabled.
  logs    Follow LibreDisplay container logs.
  backup  Create a full Docker-safe backup under ./backups.
  update  Back up, download, rebuild, and health-check the latest release.
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
  if [ "$(id -u)" -eq 0 ]; then
    : "${DASHBOARD_UID:=10001}"
    : "${DASHBOARD_GID:=10001}"
  else
    : "${DASHBOARD_UID:=$(id -u)}"
    : "${DASHBOARD_GID:=$(id -g)}"
  fi
  : "${DASHBOARD_BIND:=127.0.0.1}"
  : "${DASHBOARD_PORT:=8787}"
  : "${DASHBOARD_REMOTE_ENABLED:=1}"
  : "${DASHBOARD_REMOTE_NETWORKS:=private}"
  : "${DASHBOARD_REMOTE_SESSION_SECONDS:=28800}"
  : "${DASHBOARD_DISPLAY_SESSION_SECONDS:=31536000}"
  : "${DASHBOARD_ALLOWED_HOSTS:=}"
  : "${DASHBOARD_CACHE_MAX_BYTES:=536870912}"
}

write_env() {
  cat > .env <<EOF_ENV
DASHBOARD_UID=$DASHBOARD_UID
DASHBOARD_GID=$DASHBOARD_GID
DASHBOARD_PORT=$DASHBOARD_PORT
DASHBOARD_BIND=$DASHBOARD_BIND
DASHBOARD_REMOTE_ENABLED=$DASHBOARD_REMOTE_ENABLED
DASHBOARD_REMOTE_NETWORKS=$DASHBOARD_REMOTE_NETWORKS
DASHBOARD_REMOTE_SESSION_SECONDS=$DASHBOARD_REMOTE_SESSION_SECONDS
DASHBOARD_DISPLAY_SESSION_SECONDS=$DASHBOARD_DISPLAY_SESSION_SECONDS
DASHBOARD_ALLOWED_HOSTS=$DASHBOARD_ALLOWED_HOSTS
DASHBOARD_CACHE_MAX_BYTES=$DASHBOARD_CACHE_MAX_BYTES
EOF_ENV
  chmod 600 .env
}

compose_image_id() {
  container_id=$(docker_compose ps -a -q libredisplay 2>/dev/null | head -n 1 || true)
  if [ -n "$container_id" ]; then
    docker inspect --format '{{.Image}}' "$container_id" 2>/dev/null || true
    return 0
  fi
  docker_compose images -q libredisplay 2>/dev/null | head -n 1 || true
}

ensure_image() {
  IMAGE_ID=$(compose_image_id)
  if [ -z "$IMAGE_ID" ]; then
    printf 'Building the LibreDisplay Docker image for this command...\n' >&2
    docker_compose build libredisplay
    IMAGE_ID=$(compose_image_id)
  fi
  if [ -z "$IMAGE_ID" ]; then
    docker_compose create libredisplay >/dev/null
    IMAGE_ID=$(compose_image_id)
  fi
  [ -n "$IMAGE_ID" ] || { printf 'Could not determine the LibreDisplay Docker image.\n' >&2; exit 1; }
}

container_health() {
  container_id=$(docker_compose ps -q libredisplay 2>/dev/null | head -n 1)
  [ -n "$container_id" ] || return 1
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || return 1
}

wait_for_healthy() {
  count=0
  while [ "$count" -lt 90 ]; do
    if [ -s data/dashboard_access.json ]; then
      health=$(container_health || true)
      if [ "$health" = "healthy" ] || [ "$health" = "running" ]; then
        return 0
      fi
    fi
    count=$((count + 1))
    sleep 1
  done
  return 1
}

run_workspace_python() {
  helper=$1
  shift
  docker run --rm \
    --user "$DASHBOARD_UID:$DASHBOARD_GID" \
    -e HOME=/tmp \
    -v "$ROOT_DIR:/workspace" \
    -w /workspace \
    "$IMAGE_ID" \
    python3 "$helper" "$@"
}

create_docker_backup() {
  label=${1:-manual}
  mkdir -p backups
  chmod 700 backups
  stamp=$(date +%Y%m%d-%H%M%S)
  backup_name="LibreDisplay-Docker-${label}-${stamp}.ldbackup"
  LAST_BACKUP="$ROOT_DIR/backups/$backup_name"
  run_workspace_python /workspace/scripts/server-backup.py backup "/workspace/backups/$backup_name"
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

docker_owner_code() {
  docker_compose ps --status running --services 2>/dev/null | grep -qx 'libredisplay' || return 1
  docker_compose exec -T libredisplay python3 - <<'PY_OWNER_CODE' 2>/dev/null
import json, urllib.request
try:
    req=urllib.request.Request(
        'http://127.0.0.1:8787/api/owner-enrollment',
        data=json.dumps({'action':'create'}).encode('utf-8'),
        headers={'Content-Type':'application/json','Origin':'http://127.0.0.1:8787'},
        method='POST',
    )
    with urllib.request.urlopen(req,timeout=4) as response:
        data=json.load(response)
    code=str(data.get('code') or '').strip()
    if code:
        print(code)
except Exception:
    pass
PY_OWNER_CODE
}

show_links() {
  load_env
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
    if docker_compose ps --status running --services 2>/dev/null | grep -qx 'libredisplay'; then
      docker_compose exec -T libredisplay python3 - "$ip_value" "$DASHBOARD_PORT" <<'PY_ENDPOINTS' 2>/dev/null || true
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

    printf '\nADD AN OWNER DEVICE\n'
    owner_code=$(docker_owner_code || true)
    if [ -n "$owner_code" ]; then
      printf 'One-time code:   %s\n' "$owner_code"
      printf 'Open or scan:    http://%s:%s/connect?code=%s\n' "$ip_value" "$DASHBOARD_PORT" "$owner_code"
      printf 'The code expires quickly and can be used only once. Generate another from Settings > Remote Access when needed.\n'
    else
      printf 'Open http://%s:%s/ on the Docker host, then use Settings > Remote Access > Add Owner Device.\n' "$ip_value" "$DASHBOARD_PORT"
    fi
  else
    printf '\nOWNER DEVICE ACCESS\n'
    printf 'This Docker deployment is host-only. Open the local dashboard, then use Settings > Remote Access > Add Owner Device.\n'
    printf 'To connect another trusted LAN device, restart with ./scripts/docker-setup.sh --lan first.\n'
  fi
  printf '\nKeep Owner codes and read-only Display Links private. Do not port-forward LibreDisplay to the public Internet.\n'
}

COMMAND=start
case "${1:-}" in
  start|status|links|logs|backup|update|stop|reset)
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
    docker_compose ps
    show_links
    exit 0
    ;;
  links)
    show_links
    exit 0
    ;;
  logs)
    exec docker compose -f "$ROOT_DIR/docker/docker-compose.yml" logs -f --tail=100 libredisplay
    ;;
  backup)
    load_env
    docker_compose config >/dev/null
    ensure_image
    printf 'Creating a Docker-safe LibreDisplay backup...\n'
    create_docker_backup manual
    printf 'Backup saved: %s\n' "$LAST_BACKUP"
    exit 0
    ;;
  update)
    load_env
    docker_compose config >/dev/null
    ensure_image
    printf 'Checking GitHub for a newer LibreDisplay Docker release...\n'
    set +e
    run_workspace_python /workspace/scripts/docker-release.py prepare --workspace /workspace --stage /workspace/.libredisplay-update
    prepare_rc=$?
    set -e
    if [ "$prepare_rc" -eq 10 ]; then
      exit 0
    fi
    [ "$prepare_rc" -eq 0 ] || exit "$prepare_rc"
    target_version=$(cat .libredisplay-update/target-version)

    printf 'Stopping LibreDisplay before the safety backup...\n'
    docker_compose down --remove-orphans
    printf 'Creating a safety backup before Docker source files change...\n'
    if ! create_docker_backup "pre-v$target_version"; then
      printf 'The safety backup failed; no LibreDisplay source files were changed. Restarting the existing container...\n' >&2
      docker_compose up -d --remove-orphans >/dev/null 2>&1 || true
      exit 1
    fi

    staged_helper=/workspace/.libredisplay-update/release/scripts/docker-release.py
    if ! run_workspace_python "$staged_helper" apply --workspace /workspace --stage /workspace/.libredisplay-update; then
      printf 'The new Docker source could not be applied. The previous source was restored; restarting it now...\n' >&2
      docker_compose up -d --build --remove-orphans >/dev/null 2>&1 || true
      exit 1
    fi

    update_failed=0
    if ! docker_compose config >/dev/null; then
      update_failed=1
    elif ! docker_compose up -d --build --remove-orphans; then
      update_failed=1
    elif ! wait_for_healthy; then
      update_failed=1
    fi

    if [ "$update_failed" -ne 0 ]; then
      printf 'The updated Docker deployment did not become healthy. Restoring the previous source...\n' >&2
      docker_compose down --remove-orphans >/dev/null 2>&1 || true
      run_workspace_python "$staged_helper" rollback --workspace /workspace --stage /workspace/.libredisplay-update || true
      if docker_compose config >/dev/null 2>&1; then
        docker_compose up -d --build --remove-orphans >/dev/null 2>&1 || true
      fi
      printf 'Docker update rolled back. Safety backup: %s\n' "$LAST_BACKUP" >&2
      exit 1
    fi

    run_workspace_python "$staged_helper" cleanup --workspace /workspace --stage /workspace/.libredisplay-update
    printf '\nLibreDisplay Docker has been updated to v%s.\n' "$target_version"
    printf 'Settings, media, .env, and custom plugin folders were preserved.\n'
    printf 'Safety backup: %s\n' "$LAST_BACKUP"
    show_links
    exit 0
    ;;
  stop)
    docker_compose down --remove-orphans
    printf 'LibreDisplay stopped. Settings and media were kept.\n'
    exit 0
    ;;
  reset)
    printf 'This removes Docker settings, remote credentials, cache, and .env. ./media and ./backups are kept.\n'
    printf 'Continue? [y/N] '
    read answer || answer=n
    case "$answer" in y|Y|yes|YES|Yes) ;; *) printf 'Reset cancelled.\n'; exit 0 ;; esac
    docker_compose down --remove-orphans --rmi local >/dev/null 2>&1 || true
    rm -rf data .env
    printf 'Docker state removed. The ./media folder was left untouched.\n'
    exit 0
    ;;
esac

load_env

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
write_env

docker_compose config >/dev/null
docker_compose up -d --build --remove-orphans

if ! wait_for_healthy; then
  printf '\nLibreDisplay did not become healthy. Recent logs:\n' >&2
  docker_compose logs --tail=80 libredisplay >&2 || true
  exit 1
fi

printf '\nLibreDisplay is running.\n'
printf 'Data:  %s/data\n' "$ROOT_DIR"
printf 'Media: %s/media (read-only inside LibreDisplay)\n' "$ROOT_DIR"
printf 'Bind:  %s:%s\n' "$DASHBOARD_BIND" "$DASHBOARD_PORT"
show_links
printf '\nUseful commands:\n'
printf '  ./scripts/docker-setup.sh status   # container status + links\n'
printf '  ./scripts/docker-setup.sh links    # display links + one-time Owner code\n'
printf '  ./scripts/docker-setup.sh logs     # follow logs\n'
printf '  ./scripts/docker-setup.sh backup   # back up Docker settings/media/plugins\n'
printf '  ./scripts/docker-setup.sh update   # safely update Docker to the newest release\n'
printf '  ./scripts/docker-setup.sh stop     # stop, keep settings\n'
printf '  ./scripts/docker-setup.sh reset    # fresh Docker setup, keep ./media\n'
