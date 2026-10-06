import json
import urllib.parse

MANIFEST = {
    "apiVersion": 1,
    "id": "home-assistant",
    "name": "Home Assistant",
    "description": "Show a Home Assistant entity state or attribute using a long-lived access token.",
    "version": "1.1",
    "icon": "⌂",
    "refreshMin": 1,
    "access": "local",
    "freedomNote": "Local-first and self-hostable. LibreDisplay talks directly to your Home Assistant server; no third-party cloud account is required by this integration. Local Home Assistant authentication is still required.",
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


def _validated_url(base_url, entity_id):
    base = str(base_url or "").strip().rstrip("/")
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Home Assistant URL must use http or https")
    if parsed.username or parsed.password:
        raise ValueError("Credentials must not be embedded in the Home Assistant URL")
    entity = str(entity_id or "").strip()
    if not entity or "/" in entity or ".." in entity:
        raise ValueError("A valid Home Assistant entity ID is required")
    return base + "/api/states/" + urllib.parse.quote(entity, safe="._-")


def fetch(settings, context):
    url = _validated_url(settings.get("baseUrl"), settings.get("entityId"))
    token = str(settings.get("token") or "").strip()
    if not token:
        raise ValueError("Home Assistant access token is required")
    verify = settings.get("verifyTls") is not False
    status, _, raw, _ = context.request_private(
        url,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/json",
            "User-Agent": "LibreDisplay Home Assistant integration",
        },
        timeout=12,
        max_bytes=1024 * 1024,
        verify_tls=verify,
        require_private=True,
    )
    if status >= 400:
        raise RuntimeError(f"HTTP {status}")
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
