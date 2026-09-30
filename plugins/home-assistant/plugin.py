import ipaddress
import json
import socket
import ssl
import urllib.parse
import urllib.error
import urllib.request

MANIFEST = {
    "apiVersion": 1,
    "id": "home-assistant",
    "name": "Home Assistant",
    "description": "Show a Home Assistant entity state or attribute using a long-lived access token.",
    "version": "1.0",
    "icon": "⌂",
    "refreshMin": 1,
    "settings": [
        {"key": "baseUrl", "label": "Home Assistant URL", "type": "url", "required": True, "default": "http://homeassistant.local:8123", "help": "Use the local/private Home Assistant address, for example http://192.168.1.50:8123."},
        {"key": "token", "label": "Long-lived access token", "type": "password", "required": True, "help": "Create this in your Home Assistant user profile. It stays on the LibreDisplay server."},
        {"key": "entityId", "label": "Entity ID", "type": "text", "required": True, "help": "For example sensor.living_room_temperature or climate.downstairs."},
        {"key": "attribute", "label": "Attribute (optional)", "type": "text", "default": "", "help": "Leave blank for the entity state, or enter an attribute such as current_temperature."},
        {"key": "label", "label": "Display label", "type": "text", "default": ""},
        {"key": "suffix", "label": "Suffix override", "type": "text", "default": ""},
        {"key": "verifyTls", "label": "Verify HTTPS certificate", "type": "checkbox", "default": True},
    ],
}

_CGNAT = ipaddress.ip_network("100.64.0.0/10")


def _private_address(ip):
    obj = ipaddress.ip_address(ip)
    return obj.is_private or obj.is_loopback or obj.is_link_local or obj in _CGNAT


def _validated_url(base_url, entity_id):
    base = str(base_url or "").strip().rstrip("/")
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Home Assistant URL must use http or https")
    if parsed.username or parsed.password:
        raise ValueError("Credentials must not be embedded in the Home Assistant URL")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        addresses = {row[4][0] for row in socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM)}
    except OSError as exc:
        raise ValueError(f"Could not resolve Home Assistant host: {exc}") from exc
    if not addresses or not all(_private_address(ip) for ip in addresses):
        raise ValueError("Home Assistant must resolve only to a private LAN/VPN address")
    entity = str(entity_id or "").strip()
    if not entity or "/" in entity or ".." in entity:
        raise ValueError("A valid Home Assistant entity ID is required")
    return base + "/api/states/" + urllib.parse.quote(entity, safe="._-")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, "Redirects are not allowed", headers, fp)


def fetch(settings, context):
    url = _validated_url(settings.get("baseUrl"), settings.get("entityId"))
    token = str(settings.get("token") or "").strip()
    if not token:
        raise ValueError("Home Assistant access token is required")
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
        "User-Agent": "LibreDisplay Home Assistant integration",
    })
    verify = settings.get("verifyTls") is not False
    ssl_context = None if verify else ssl._create_unverified_context()
    opener = urllib.request.build_opener(_NoRedirect(), urllib.request.HTTPSHandler(context=ssl_context) if ssl_context else urllib.request.HTTPSHandler())
    with opener.open(req, timeout=12) as response:
        raw = response.read(1024 * 1024)
    data = json.loads(raw.decode("utf-8", "replace"))
    attribute = str(settings.get("attribute") or "").strip()
    attrs = data.get("attributes") if isinstance(data.get("attributes"), dict) else {}
    value = attrs.get(attribute) if attribute else data.get("state")
    if value is None:
        raise ValueError("Requested Home Assistant state/attribute was not found")
    suffix = str(settings.get("suffix") or "")
    if not suffix and not attribute:
        suffix = str(attrs.get("unit_of_measurement") or "")
    label = str(settings.get("label") or "").strip() or str(attrs.get("friendly_name") or settings.get("entityId") or "Home Assistant")
    detail = label
    if attribute:
        detail += " · " + attribute
    return {"value": value, "suffix": suffix, "detail": detail}
