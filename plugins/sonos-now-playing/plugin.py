import html
import re
import urllib.parse
import xml.etree.ElementTree as ET

MANIFEST = {
    "apiVersion": 1,
    "id": "sonos-now-playing",
    "name": "Sonos Now Playing",
    "description": "Show the current track from a Sonos speaker on the local network.",
    "version": "1.0",
    "icon": "♪",
    "kind": "now-playing",
    "refreshMin": 1,
    "settings": [
        {"key": "speaker", "label": "Sonos speaker IP / hostname", "type": "text", "required": True, "help": "Example: 192.168.1.42. LibreDisplay reads local Sonos UPnP metadata on port 1400."},
        {"key": "port", "label": "Sonos port", "type": "number", "default": 1400},
    ],
}

AV_CONTROL = "/MediaRenderer/AVTransport/Control"


def _base(settings):
    host = str(settings.get("speaker") or "").strip()
    if not host:
        raise ValueError("Sonos speaker IP / hostname is required")
    if "://" in host:
        parsed = urllib.parse.urlsplit(host)
        if parsed.scheme != "http" or not parsed.hostname or parsed.username or parsed.password or parsed.path not in {"", "/"}:
            raise ValueError("Use a Sonos host/IP without credentials or a plain http://host URL")
        hostname = parsed.hostname
    else:
        if any(ch in host for ch in "/?#@"):
            raise ValueError("Invalid Sonos speaker host")
        hostname = host.strip("[]")
    try:
        port = int(float(settings.get("port") or 1400))
    except Exception:
        port = 1400
    if not 1 <= port <= 65535:
        raise ValueError("Invalid Sonos port")
    display_host = f"[{hostname}]" if ":" in hostname and not hostname.startswith("[") else hostname
    return f"http://{display_host}:{port}"


def _soap(context, settings, action):
    base = _base(settings)
    body = (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
        f'<s:Body><u:{action} xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:{action}></s:Body>'
        '</s:Envelope>'
    ).encode("utf-8")
    status, headers, data, _ = context.request_private(
        base + AV_CONTROL,
        method="POST",
        headers={
            "Content-Type": 'text/xml; charset="utf-8"',
            "SOAPACTION": f'"urn:schemas-upnp-org:service:AVTransport:1#{action}"',
            "User-Agent": "LibreDisplay Sonos integration",
        },
        body=body,
        timeout=8,
        max_bytes=2 * 1024 * 1024,
        verify_tls=True,
    )
    if status >= 400:
        raise RuntimeError(f"Sonos returned HTTP {status}")
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise ValueError("Sonos returned invalid XML") from exc
    return root, base


def _find_text(root, local_name):
    for el in root.iter():
        if el.tag.rsplit("}", 1)[-1] == local_name:
            return el.text or ""
    return ""


def _duration_ms(value):
    m = re.fullmatch(r"(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d+))?", str(value or "").strip())
    if not m:
        return 0
    hours = int(m.group(1) or 0)
    minutes = int(m.group(2) or 0)
    seconds = int(m.group(3) or 0)
    fraction = (m.group(4) or "")[:3].ljust(3, "0")
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + int(fraction or 0)


def _metadata(raw):
    text = html.unescape(str(raw or "").strip())
    if not text or text == "NOT_IMPLEMENTED":
        return {}
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return {}
    def first(local):
        for el in root.iter():
            if el.tag.rsplit("}", 1)[-1] == local:
                return (el.text or "").strip()
        return ""
    return {
        "title": first("title"),
        "artist": first("creator") or first("artist"),
        "album": first("album"),
        "albumArt": first("albumArtURI"),
    }


def fetch(settings, context):
    position, base = _soap(context, settings, "GetPositionInfo")
    transport, _ = _soap(context, settings, "GetTransportInfo")
    meta = _metadata(_find_text(position, "TrackMetaData"))
    art = meta.get("albumArt") or ""
    image = urllib.parse.urljoin(base + "/", art) if art else ""
    state = _find_text(transport, "CurrentTransportState").strip().upper()
    title = meta.get("title") or _find_text(position, "TrackURI") or "Nothing playing"
    return {
        "kind": "now-playing",
        "provider": "Sonos",
        "title": title[:500],
        "artist": (meta.get("artist") or "")[:300],
        "album": (meta.get("album") or "")[:300],
        "image": image[:2000],
        "isPlaying": state == "PLAYING",
        "state": state or "UNKNOWN",
        "progressMs": _duration_ms(_find_text(position, "RelTime")),
        "durationMs": _duration_ms(_find_text(position, "TrackDuration")),
    }
