FROM python:3.12-slim

LABEL org.opencontainers.image.title="LibreDisplay" \
      org.opencontainers.image.authors="Gubna" \
      org.opencontainers.image.description="Free and open-source self-hosted home dashboard" \
      org.opencontainers.image.source="https://github.com/Gubna-Tech/LibreDisplay"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DASHBOARD_HOST=0.0.0.0 \
    DASHBOARD_PORT=8787 \
    DASHBOARD_DATA_DIR=/data \
    DASHBOARD_MEDIA_ROOTS=/media \
    DASHBOARD_REMOTE_ENABLED=1 \
    DASHBOARD_REMOTE_NETWORKS=private \
    DASHBOARD_REMOTE_SESSION_SECONDS=28800

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends qrencode ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 libredisplay \
    && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin libredisplay \
    && mkdir -p /app /data /media /plugins \
    && chown -R libredisplay:libredisplay /data /media /plugins

WORKDIR /app
COPY --chown=libredisplay:libredisplay app /app/
COPY --chown=libredisplay:libredisplay VERSION /VERSION
COPY --chown=libredisplay:libredisplay plugins /plugins

USER libredisplay:libredisplay
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8787/healthz', timeout=3).read()"]

CMD ["python3", "-I", "/app/dashboard_server.py"]
