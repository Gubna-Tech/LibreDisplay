#!/bin/sh
set -eu
umask 077

VERSION="1.15.30"
REPO="Gubna-Tech/LibreDisplay"
DEFAULT_IMAGE="ghcr.io/gubna-tech/libredisplay:v${VERSION}"
DEFAULT_HOME="${HOME:-/tmp}/libredisplay-docker"
INSTALL_DIR="${LIBREDISPLAY_DOCKER_HOME:-$DEFAULT_HOME}"
COMPOSE_URL="https://raw.githubusercontent.com/${REPO}/v${VERSION}/docker-compose.deploy.yml"

fail() {
  printf 'LibreDisplay Docker install: %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v docker >/dev/null 2>&1 || fail "Docker Engine or Docker Desktop is required."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required."

if [ "$(id -u)" -eq 0 ]; then
  DASH_UID="${DASHBOARD_UID:-10001}"
  DASH_GID="${DASHBOARD_GID:-10001}"
else
  DASH_UID="${DASHBOARD_UID:-$(id -u)}"
  DASH_GID="${DASHBOARD_GID:-$(id -g)}"
fi

DASH_BIND="${DASHBOARD_BIND:-0.0.0.0}"
DASH_PORT="${DASHBOARD_PORT:-8787}"
IMAGE="${LIBREDISPLAY_IMAGE:-$DEFAULT_IMAGE}"

mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/data" "$INSTALL_DIR/media"
chmod 700 "$INSTALL_DIR" "$INSTALL_DIR/data" "$INSTALL_DIR/media" 2>/dev/null || true

if [ "$(id -u)" -eq 0 ]; then
  chown "$DASH_UID:$DASH_GID" "$INSTALL_DIR/data" "$INSTALL_DIR/media" 2>/dev/null || true
fi

TMP_COMPOSE="$INSTALL_DIR/.compose.yaml.tmp.$$"
trap 'rm -f "$TMP_COMPOSE"' EXIT INT TERM HUP
curl -fL --retry 3 --connect-timeout 10 --max-time 60 "$COMPOSE_URL" -o "$TMP_COMPOSE" \
  || fail "could not download the v${VERSION} Docker Compose YAML from GitHub."
mv "$TMP_COMPOSE" "$INSTALL_DIR/compose.yaml"
trap - EXIT INT TERM HUP

ENV_FILE="$INSTALL_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF_ENV
LIBREDISPLAY_IMAGE=$IMAGE
LIBREDISPLAY_DATA_SOURCE=./data
LIBREDISPLAY_MEDIA_SOURCE=./media
DASHBOARD_UID=$DASH_UID
DASHBOARD_GID=$DASH_GID
DASHBOARD_BIND=$DASH_BIND
DASHBOARD_PORT=$DASH_PORT
DASHBOARD_REMOTE_ENABLED=1
DASHBOARD_REMOTE_NETWORKS=private
DASHBOARD_REMOTE_SESSION_SECONDS=28800
DASHBOARD_DISPLAY_SESSION_SECONDS=31536000
DASHBOARD_ALLOWED_HOSTS=
DASHBOARD_CACHE_MAX_BYTES=536870912
EOF_ENV
else
  # Preserve user settings while advancing the image for this pinned installer release.
  TMP_ENV="$INSTALL_DIR/.env.tmp.$$"
  awk -v image="$IMAGE" '
    BEGIN { seen=0 }
    /^LIBREDISPLAY_IMAGE=/ { print "LIBREDISPLAY_IMAGE=" image; seen=1; next }
    { print }
    END { if (!seen) print "LIBREDISPLAY_IMAGE=" image }
  ' "$ENV_FILE" > "$TMP_ENV"
  mv "$TMP_ENV" "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

cd "$INSTALL_DIR"
docker compose config -q || fail "Docker Compose rejected the generated LibreDisplay configuration."

printf 'Pulling LibreDisplay v%s...\n' "$VERSION"
if ! docker compose pull; then
  cat >&2 <<EOF_ERR
LibreDisplay could not pull $IMAGE.
If this release was just published, make sure the GitHub Container Registry package exists and is Public.
EOF_ERR
  exit 1
fi

docker compose up -d --remove-orphans

count=0
healthy=0
while [ "$count" -lt 90 ]; do
  cid=$(docker compose ps -q libredisplay 2>/dev/null | head -n 1 || true)
  if [ -n "$cid" ]; then
    state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || true)
    if [ "$state" = "healthy" ] || [ "$state" = "running" ]; then
      healthy=1
      break
    fi
  fi
  count=$((count + 1))
  sleep 1
done

[ "$healthy" -eq 1 ] || {
  docker compose ps >&2 || true
  docker compose logs --tail 80 libredisplay >&2 || true
  fail "container did not become healthy within 90 seconds."
}

HOST_IP=""
if command -v ip >/dev/null 2>&1; then
  HOST_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)
fi
[ -n "$HOST_IP" ] || HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)

printf '\nLibreDisplay Docker install is running.\n'
printf 'Install directory: %s\n' "$INSTALL_DIR"
printf 'Local URL: http://127.0.0.1:%s/\n' "$DASH_PORT"
if [ "$DASH_BIND" != "127.0.0.1" ] && [ "$DASH_BIND" != "::1" ] && [ -n "$HOST_IP" ]; then
  printf 'LAN URL:   http://%s:%s/\n' "$HOST_IP" "$DASH_PORT"
fi
printf '\nThis deployment is intended for a trusted LAN or private VPN; do not port-forward it to the public Internet.\n'
printf 'Re-run the v%s one-line installer to repair/redeploy this release.\n' "$VERSION"
