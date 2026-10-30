#!/bin/sh
set -eu
umask 077

VERSION="1.16.6"
REPO="Gubna-Tech/LibreDisplay"
DEFAULT_IMAGE="ghcr.io/gubna-tech/libredisplay:v${VERSION}"
DEFAULT_HOME="${HOME:-/tmp}/libredisplay-docker"
INSTALL_DIR="${LIBREDISPLAY_DOCKER_HOME:-$DEFAULT_HOME}"
COMPOSE_URL="https://raw.githubusercontent.com/${REPO}/v${VERSION}/docker/docker-compose.deploy.yml"

fail() {
  printf 'LibreDisplay Docker install: %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v docker >/dev/null 2>&1 || fail "Docker Engine or Docker Desktop is required."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required."
docker info >/dev/null 2>&1 || fail "Docker is installed but the daemon is not accessible. Start Docker Desktop/Engine and verify your user can run docker ps."

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
if docker compose pull; then
  printf 'The published LibreDisplay image is available.\n'
else
  if [ -n "${LIBREDISPLAY_IMAGE:-}" ]; then
    fail "The requested custom image $IMAGE could not be pulled; source-build fallback only applies to the default image."
  fi
  printf 'The prebuilt image is unavailable. Attempting a local build from the pinned v%s release...\n' "$VERSION" >&2
  command -v tar >/dev/null 2>&1 || fail "tar is required for source-build fallback."
  SOURCE_URL="https://github.com/${REPO}/archive/refs/tags/v${VERSION}.tar.gz"
  SOURCE_ARCHIVE="$INSTALL_DIR/.source.tar.gz.tmp.$$"
  SOURCE_STAGE="$INSTALL_DIR/.source.tmp.$$"
  trap 'rm -f "$SOURCE_ARCHIVE"; rm -rf "$SOURCE_STAGE"' EXIT INT TERM HUP
  mkdir -p "$SOURCE_STAGE"
  curl -fL --retry 3 --connect-timeout 10 --max-time 180 "$SOURCE_URL" -o "$SOURCE_ARCHIVE" \
    || fail "The v${VERSION} source release is not downloadable. Publish the matching GitHub tag before offering Docker installation."
  tar -tzf "$SOURCE_ARCHIVE" >/dev/null || fail "The downloaded source archive is invalid."
  tar -xzf "$SOURCE_ARCHIVE" -C "$SOURCE_STAGE" --strip-components=1 \
    || fail "The downloaded source release could not be extracted."
  [ -f "$SOURCE_STAGE/VERSION" ] && [ "$(tr -d '\r\n' < "$SOURCE_STAGE/VERSION")" = "$VERSION" ] \
    || fail "The source release version does not match v${VERSION}."
  for required in docker/Dockerfile docker/docker-compose.yml app/dashboard_server.py app/dashboard.html plugins/_shared.py; do
    [ -f "$SOURCE_STAGE/$required" ] || fail "The source release is missing $required."
  done
  rm -rf "$INSTALL_DIR/source"
  mv "$SOURCE_STAGE" "$INSTALL_DIR/source"
  rm -f "$SOURCE_ARCHIVE"
  trap - EXIT INT TERM HUP
  # Use the source's build contract without relocating persistent host data.
  sed -e 's|context: ..|context: ./source|' \
      -e 's|../data:/data|./data:/data|' \
      -e 's|../media:/media:ro|./media:/media:ro|' \
      -e 's|../plugins:/plugins:ro|./source/plugins:/plugins:ro|' \
      "$INSTALL_DIR/source/docker/docker-compose.yml" > "$INSTALL_DIR/.compose.source.tmp.$$"
  mv "$INSTALL_DIR/.compose.source.tmp.$$" "$INSTALL_DIR/compose.yaml"
  docker compose config -q || fail "The local-build Compose configuration is invalid."
  printf 'Building LibreDisplay locally from the published source release...\n'
  docker compose build || fail "Source-build fallback failed; check Docker build output above."
fi

if ! docker compose up -d --remove-orphans; then
  docker compose ps >&2 || true
  docker compose logs --tail 80 libredisplay >&2 || true
  fail "Docker could not start LibreDisplay."
fi

count=0
healthy=0
while [ "$count" -lt 90 ]; do
  cid=$(docker compose ps -q libredisplay 2>/dev/null | head -n 1 || true)
  if [ -n "$cid" ]; then
    state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || true)
    if [ "$state" = "healthy" ]; then
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

# Published Docker ports traverse a network bridge. Even a browser on this host
# isn't recognized as the server's local Owner. Create a short-lived, one-time
# enrollment code through loopback *inside* the container instead of weakening
# the server's authentication boundary.
OWNER_CODE=$(docker compose exec -T libredisplay python3 - <<'PY_OWNER_CODE' 2>/dev/null || true
import json
import urllib.request
try:
    request = urllib.request.Request(
        'http://127.0.0.1:8787/api/owner-enrollment',
        data=b'{"action":"create"}',
        headers={'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:8787'},
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        payload = json.load(response)
    code = str(payload.get('code') or '').strip()
    if code:
        print(code)
except Exception:
    pass
PY_OWNER_CODE
)

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
if [ -n "$OWNER_CODE" ]; then
  printf '\nCONNECT YOUR FIRST OWNER DEVICE (required for Docker browser access):\n'
  printf 'One-time code: %s\n' "$OWNER_CODE"
  if [ "$DASH_BIND" = "127.0.0.1" ] || [ "$DASH_BIND" = "::1" ]; then
    printf 'Open: http://127.0.0.1:%s/connect?code=%s\n' "$DASH_PORT" "$OWNER_CODE"
  elif [ -n "$HOST_IP" ]; then
    printf 'Open: http://%s:%s/connect?code=%s\n' "$HOST_IP" "$DASH_PORT" "$OWNER_CODE"
  else
    printf 'Open: http://YOUR-DOCKER-HOST-IP:%s/connect and enter the code.\n' "$DASH_PORT"
  fi
  printf 'This code expires in approximately 10 minutes, is single-use, and must be kept private.\n'
else
  printf '\nOwner enrollment code could not be generated. The container is healthy, but\n'
  printf 'Docker browsers require a paired Owner device before the dashboard opens.\n'
  printf 'Use the Owner enrollment command in README.md to obtain a fresh code.\n'
fi
printf '\nThis deployment is intended for a trusted LAN or private VPN; do not port-forward it to the public Internet.\n'
printf 'Re-run the v%s one-line installer to repair/redeploy this release.\n' "$VERSION"
