import base64
import hashlib
import json
import threading
import time
import urllib.parse

MANIFEST = {
    "apiVersion": 1,
    "id": "spotify-now-playing",
    "name": "Spotify Now Playing",
    "description": "Show the current Spotify track or episode using Spotify Web API metadata.",
    "version": "1.0",
    "icon": "♫",
    "kind": "now-playing",
    "refreshMin": 1,
    "settings": [
        {"key": "clientId", "label": "Spotify client ID", "type": "text", "default": "", "help": "Needed when using a refresh token."},
        {"key": "clientSecret", "label": "Spotify client secret", "type": "password", "default": "", "help": "Stored only in LibreDisplay's server configuration."},
        {"key": "refreshToken", "label": "Spotify refresh token", "type": "password", "default": "", "help": "Authorize with the user-read-currently-playing scope. Spotify refresh tokens for developer apps currently expire after a limited lifetime and may require reauthorization."},
        {"key": "accessToken", "label": "Access token (optional / temporary)", "type": "password", "default": "", "help": "For short-lived access. Spotify access tokens normally expire after about one hour."},
    ],
}

TOKEN_URL = "https://accounts.spotify.com/api/token"
NOW_URL = "https://api.spotify.com/v1/me/player/currently-playing?additional_types=track%2Cepisode"
_TOKEN_LOCK = threading.Lock()
_TOKEN_CACHE = {}


def _cache_key(settings):
    material = "\n".join(str(settings.get(k) or "") for k in ("clientId", "clientSecret", "refreshToken"))
    return hashlib.sha256(material.encode("utf-8", "replace")).hexdigest()


def _refresh_access_token(settings, context, force=False):
    direct = str(settings.get("accessToken") or "").strip()
    if direct:
        return direct
    client_id = str(settings.get("clientId") or "").strip()
    client_secret = str(settings.get("clientSecret") or "").strip()
    configured_refresh = str(settings.get("refreshToken") or "").strip()
    if not (client_id and client_secret and configured_refresh):
        raise ValueError("Configure either a temporary Spotify access token or client ID, client secret, and refresh token")
    key = _cache_key(settings)
    with _TOKEN_LOCK:
        cached = dict(_TOKEN_CACHE.get(key) or {})
    if cached and not force and float(cached.get("expiresAt") or 0) > time.time() + 60:
        return str(cached.get("accessToken") or "")
    refresh = str(cached.get("refreshToken") or configured_refresh)
    body = urllib.parse.urlencode({"grant_type": "refresh_token", "refresh_token": refresh}).encode("utf-8")
    auth = base64.b64encode((client_id + ":" + client_secret).encode("utf-8")).decode("ascii")
    status, _, raw, _ = context.request(
        TOKEN_URL,
        method="POST",
        headers={
            "Authorization": "Basic " + auth,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "LibreDisplay Spotify integration",
        },
        body=body,
        timeout=20,
        max_bytes=1024 * 1024,
    )
    if status >= 400:
        raise RuntimeError(f"Spotify token refresh returned HTTP {status}")
    try:
        data = json.loads(raw.decode("utf-8", "replace"))
    except Exception as exc:
        raise ValueError("Spotify token endpoint returned invalid JSON") from exc
    token = str(data.get("access_token") or "").strip()
    if not token:
        raise ValueError("Spotify token response did not include an access token")
    try:
        expires = max(60, int(data.get("expires_in") or 3600))
    except Exception:
        expires = 3600
    with _TOKEN_LOCK:
        _TOKEN_CACHE[key] = {
            "accessToken": token,
            "refreshToken": str(data.get("refresh_token") or refresh),
            "expiresAt": time.time() + expires,
        }
    return token


def _read_now_playing(settings, context, token):
    return context.request(
        NOW_URL,
        headers={"Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "LibreDisplay Spotify integration"},
        timeout=20,
        max_bytes=4 * 1024 * 1024,
    )


def fetch(settings, context):
    direct = bool(str(settings.get("accessToken") or "").strip())
    token = _refresh_access_token(settings, context)
    status, _, raw, _ = _read_now_playing(settings, context, token)
    if status == 401 and not direct:
        token = _refresh_access_token(settings, context, force=True)
        status, _, raw, _ = _read_now_playing(settings, context, token)
    if status == 204 or not raw:
        return {"kind": "now-playing", "provider": "Spotify", "title": "Nothing playing", "artist": "", "album": "", "image": "", "isPlaying": False, "state": "IDLE", "progressMs": 0, "durationMs": 0}
    if status >= 400:
        raise RuntimeError(f"Spotify currently-playing returned HTTP {status}")
    try:
        data = json.loads(raw.decode("utf-8", "replace"))
    except Exception as exc:
        raise ValueError("Spotify returned invalid JSON") from exc
    item = data.get("item") if isinstance(data.get("item"), dict) else {}
    item_type = str(item.get("type") or data.get("currently_playing_type") or "")
    title = str(item.get("name") or "Nothing playing")
    image = ""
    artist = ""
    album = ""
    link = ""
    if item_type == "track":
        artists = item.get("artists") if isinstance(item.get("artists"), list) else []
        artist = ", ".join(str(x.get("name") or "") for x in artists if isinstance(x, dict) and x.get("name"))
        album_obj = item.get("album") if isinstance(item.get("album"), dict) else {}
        album = str(album_obj.get("name") or "")
        images = album_obj.get("images") if isinstance(album_obj.get("images"), list) else []
        image = str((images[0] if images and isinstance(images[0], dict) else {}).get("url") or "")
    elif item_type == "episode":
        show = item.get("show") if isinstance(item.get("show"), dict) else {}
        artist = str(show.get("name") or item.get("publisher") or "")
        album = "Podcast"
        images = item.get("images") if isinstance(item.get("images"), list) else []
        if not images:
            images = show.get("images") if isinstance(show.get("images"), list) else []
        image = str((images[0] if images and isinstance(images[0], dict) else {}).get("url") or "")
    external = item.get("external_urls") if isinstance(item.get("external_urls"), dict) else {}
    link = str(external.get("spotify") or "")
    return {
        "kind": "now-playing",
        "provider": "Spotify",
        "title": title[:500],
        "artist": artist[:300],
        "album": album[:300],
        "image": image[:2000],
        "link": link[:2000],
        "isPlaying": bool(data.get("is_playing")),
        "state": "PLAYING" if data.get("is_playing") else "PAUSED",
        "progressMs": max(0, int(data.get("progress_ms") or 0)),
        "durationMs": max(0, int(item.get("duration_ms") or 0)),
    }
