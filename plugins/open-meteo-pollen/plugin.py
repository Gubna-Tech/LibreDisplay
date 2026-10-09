from _shared import request_json, qs, clamp_int

POLLEN_FIELDS = [
    ("alder_pollen", "Alder"),
    ("birch_pollen", "Birch"),
    ("grass_pollen", "Grass"),
    ("mugwort_pollen", "Mugwort"),
    ("olive_pollen", "Olive"),
    ("ragweed_pollen", "Ragweed"),
]

MANIFEST = {
    "apiVersion": 1,
    "id": "open-meteo-pollen",
    "name": "Pollen · Open-Meteo",
    "description": "Show pollen concentrations from Open-Meteo without an API key or signup. Coverage follows the underlying CAMS pollen model and is currently strongest in Europe.",
    "version": "1.0",
    "icon": "✿",
    "refreshMin": 60,
    "kind": "status",
    "access": "no-key",
    "freedomNote": "No account or API key. Open-Meteo is open source and can also be self-hosted; pollen coverage depends on the CAMS model region.",
    "settings": [
        {"key": "latitude", "label": "Latitude", "type": "number", "required": True},
        {"key": "longitude", "label": "Longitude", "type": "number", "required": True},
        {"key": "days", "label": "Forecast days", "type": "number", "default": 3, "min": 1, "max": 7, "step": 1},
    ],
}
MANIFEST.update({'access': 'no-key', 'dataFlow': 'public-internet', 'dataLeavesDevice': True, 'privacyNote': 'LibreDisplay sends configured coordinates to Open-Meteo over HTTPS; no account or API key is required.', 'freedomAlternative': 'Already freedom-first: Open-Meteo is open source and can be self-hosted.'})


def _number(value):
    try:
        return float(value)
    except Exception:
        return None


def fetch(settings, context):
    days = clamp_int(settings.get("days"), 1, 7, 3)
    variables = ",".join(key for key, _ in POLLEN_FIELDS)
    url = qs(
        "https://air-quality-api.open-meteo.com/v1/air-quality",
        {
            "latitude": float(settings.get("latitude")),
            "longitude": float(settings.get("longitude")),
            "current": variables,
            "hourly": variables,
            "forecast_days": days,
            "timezone": "auto",
        },
    )
    data, _, _ = request_json(context, url)
    current = data.get("current") or {}
    current_values = []
    for key, label in POLLEN_FIELDS:
        value = _number(current.get(key))
        if value is not None:
            current_values.append((value, label, key))
    top = max(current_values, default=None, key=lambda row: row[0])
    details = [
        {"label": label, "value": round(value, 1)}
        for value, label, _ in sorted(current_values, reverse=True)
    ]
    if current.get("time"):
        details.append({"label": "Updated", "value": current.get("time")})

    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    daily = {}
    for idx, stamp in enumerate(times):
        date = str(stamp or "")[:10]
        if not date:
            continue
        bucket = daily.setdefault(date, {"date": date, "pollen": []})
        for key, label in POLLEN_FIELDS:
            values = hourly.get(key) or []
            value = _number(values[idx]) if idx < len(values) else None
            if value is None:
                continue
            match = next((row for row in bucket["pollen"] if row["type"] == label), None)
            if match is None:
                bucket["pollen"].append({"type": label, "max": value})
            else:
                match["max"] = max(match["max"], value)

    return {
        "kind": "status",
        "provider": "Open-Meteo · CAMS",
        "title": "Pollen",
        "value": round(top[0], 1) if top else "No data",
        "suffix": " grains/m³" if top else "",
        "detail": (top[1] + " highest now") if top else "Pollen data is unavailable for this location/model region.",
        "details": details,
        "forecast": list(daily.values())[:days],
    }
