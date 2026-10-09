MANIFEST = {
    "apiVersion": 1,
    "id": "web-api",
    "name": "Web API",
    "description": "Fetch a public JSON API on the LibreDisplay server and show a selected value.",
    "version": "1.0",
    "icon": "{}",
    "refreshMin": 5,
    "settings": [
        {"key": "url", "label": "JSON API URL", "type": "url", "required": True},
        {"key": "path", "label": "JSON path", "type": "text", "help": "Optional, for example weather.temperature or items.0.name"},
        {"key": "prefix", "label": "Prefix", "type": "text", "default": ""},
        {"key": "suffix", "label": "Suffix", "type": "text", "default": ""},
    ],
}
MANIFEST.update({'access': 'no-key', 'dataFlow': 'configured-endpoint', 'dataLeavesDevice': True, 'privacyNote': 'LibreDisplay requests the JSON URL you configure. Privacy depends on that endpoint; point it at a local/self-hosted API to keep traffic on your network.', 'freedomAlternative': 'Already freedom-first when pointed at a public no-key or local/self-hosted JSON endpoint.'})

_PRESENTATION_CACHE_FIELDS = {'prefix': {'responsePaths': ['prefix'], 'presentationOmitEmpty': False}, 'suffix': {'responsePaths': ['suffix'], 'presentationOmitEmpty': False}}
for _field in MANIFEST.get("settings") or []:
    _meta = _PRESENTATION_CACHE_FIELDS.get(_field.get("key"))
    if _meta:
        _field.update({"cacheKey": False, **_meta})


def _path_get(value, path):
    if not str(path or "").strip():
        return value
    current = value
    for key in str(path).replace("[", ".").replace("]", "").split("."):
        if not key:
            continue
        if isinstance(current, list):
            current = current[int(key)]
        elif isinstance(current, dict):
            current = current[key]
        else:
            raise KeyError(key)
    return current


def fetch(settings, context):
    data = context.fetch_json(settings.get("url"))
    value = _path_get(data, settings.get("path"))
    if isinstance(value, (dict, list)):
        return {"value": value}
    return {
        "value": value,
        "prefix": settings.get("prefix", ""),
        "suffix": settings.get("suffix", ""),
    }
