import base64
import datetime
import re
import urllib.parse
import xml.etree.ElementTree as ET

MANIFEST = {
    "apiVersion": 1,
    "id": "caldav-tasks",
    "name": "CalDAV / Nextcloud Tasks",
    "description": "Synchronize VTODO tasks from a CalDAV collection, including Nextcloud Tasks, and complete them from LibreDisplay.",
    "version": "1.0",
    "icon": "☑",
    "kind": "tasks",
    "actions": ["complete", "reopen"],
    "refreshMin": 2,
    "access": "self-hosted",
    "freedomNote": "Works with open CalDAV servers such as self-hosted Nextcloud. Your server may still require its own local username/app password.",
    "settings": [
        {"key": "collectionUrl", "label": "Task collection URL", "type": "url", "required": True, "help": "Use the full CalDAV calendar/task collection URL that contains VTODO items."},
        {"key": "username", "label": "Username", "type": "text", "required": True},
        {"key": "password", "label": "Password / app password", "type": "password", "required": True, "help": "For Nextcloud, an app password is recommended."},
        {"key": "verifyTls", "label": "Verify HTTPS certificate", "type": "checkbox", "default": True},
        {"key": "allowHttp", "label": "Allow unencrypted HTTP on a trusted LAN", "type": "checkbox", "default": False},
        {"key": "showCompleted", "label": "Show completed tasks", "type": "checkbox", "default": False},
        {"key": "maxTasks", "label": "Maximum tasks", "type": "number", "default": 30},
    ],
}

REPORT_BODY = b'''<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:getetag/><c:calendar-data/></d:prop>
  <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VTODO"/></c:comp-filter></c:filter>
</c:calendar-query>'''


def _base_url(settings):
    value = str(settings.get("collectionUrl") or "").strip().rstrip("/") + "/"
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("CalDAV collection URL must use http or https")
    if parsed.username or parsed.password:
        raise ValueError("Do not embed credentials in the CalDAV URL")
    if parsed.scheme == "http" and settings.get("allowHttp") is not True:
        raise ValueError("HTTP is disabled for CalDAV. Use HTTPS or explicitly allow trusted-LAN HTTP.")
    return value


def _headers(settings, extra=None):
    raw = (str(settings.get("username") or "") + ":" + str(settings.get("password") or "")).encode("utf-8")
    out = {
        "Authorization": "Basic " + base64.b64encode(raw).decode("ascii"),
        "User-Agent": "LibreDisplay CalDAV Tasks integration",
        "Accept": "application/xml, text/calendar;q=0.9, */*;q=0.5",
    }
    if extra:
        out.update(extra)
    return out


def _request(context, settings, url, method="GET", body=None, extra_headers=None, max_bytes=6 * 1024 * 1024):
    status, headers, data, final_url = context.request_private(
        url,
        method=method,
        headers=_headers(settings, extra_headers),
        body=body,
        timeout=25,
        max_bytes=max_bytes,
        verify_tls=settings.get("verifyTls") is not False,
    )
    return status, headers, data, final_url


def _unfold(text):
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out = []
    for line in lines:
        if line.startswith((" ", "\t")) and out:
            out[-1] += line[1:]
        else:
            out.append(line)
    return out


def _ics_value(value):
    return str(value or "").replace("\\n", "\n").replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\")


def _todo_from_ics(text, href, etag):
    lines = _unfold(text)
    inside = False
    values = {}
    for line in lines:
        upper = line.upper()
        if upper == "BEGIN:VTODO":
            inside = True
            continue
        if upper == "END:VTODO":
            break
        if not inside or ":" not in line:
            continue
        key_part, value = line.split(":", 1)
        key = key_part.split(";", 1)[0].upper()
        if key not in values:
            values[key] = value
    if not values:
        return None
    status = str(values.get("STATUS") or "NEEDS-ACTION").upper()
    return {
        "id": str(values.get("UID") or href),
        "href": href,
        "etag": etag,
        "title": _ics_value(values.get("SUMMARY") or "Untitled task")[:500],
        "description": _ics_value(values.get("DESCRIPTION") or "")[:2000],
        "due": str(values.get("DUE") or ""),
        "priority": int(values.get("PRIORITY") or 0) if str(values.get("PRIORITY") or "").isdigit() else 0,
        "completed": status == "COMPLETED" or str(values.get("PERCENT-COMPLETE") or "") == "100",
        "status": status,
    }


def _origin(parts):
    port = parts.port
    if port is None:
        port = 443 if parts.scheme == "https" else 80
    return parts.scheme.lower(), (parts.hostname or "").lower(), port


def _task_url(collection_url, href):
    target = urllib.parse.urljoin(collection_url, href)
    if _origin(urllib.parse.urlsplit(target)) != _origin(urllib.parse.urlsplit(collection_url)):
        raise ValueError("Task URL escaped the configured CalDAV origin")
    return target


def fetch(settings, context):
    collection = _base_url(settings)
    status, _, body, _ = _request(
        context,
        settings,
        collection,
        method="REPORT",
        body=REPORT_BODY,
        extra_headers={"Depth": "1", "Content-Type": "application/xml; charset=utf-8"},
    )
    if status not in {200, 207}:
        raise RuntimeError(f"CalDAV server returned HTTP {status}")
    try:
        root = ET.fromstring(body)
    except ET.ParseError as exc:
        raise ValueError("CalDAV server returned invalid XML") from exc
    ns = {"d": "DAV:", "c": "urn:ietf:params:xml:ns:caldav"}
    rows = []
    show_completed = settings.get("showCompleted") is True
    limit = max(1, min(200, int(float(settings.get("maxTasks") or 30))))
    for response in root.findall(".//d:response", ns):
        href = response.findtext("d:href", default="", namespaces=ns)
        etag = response.findtext(".//d:getetag", default="", namespaces=ns)
        calendar_data = response.findtext(".//c:calendar-data", default="", namespaces=ns)
        if not calendar_data:
            continue
        task = _todo_from_ics(calendar_data, href, etag)
        if task and (show_completed or not task["completed"]):
            rows.append(task)
    rows.sort(key=lambda x: (x.get("completed", False), x.get("due") or "99999999", -int(x.get("priority") or 0), x.get("title") or ""))
    rows = rows[:limit]
    return {"kind": "tasks", "provider": "CalDAV", "tasks": rows, "count": len(rows), "showCompleted": show_completed}


def _replace_property(lines, key, value=None):
    key_upper = key.upper()
    output = []
    inserted = False
    in_todo = False
    for line in lines:
        upper = line.upper()
        if upper == "BEGIN:VTODO":
            in_todo = True
            output.append(line)
            continue
        if upper == "END:VTODO":
            if value is not None and not inserted:
                output.append(f"{key}:{value}")
                inserted = True
            in_todo = False
            output.append(line)
            continue
        if in_todo and line.split(":", 1)[0].split(";", 1)[0].upper() == key_upper:
            if value is not None and not inserted:
                output.append(f"{key}:{value}")
                inserted = True
            continue
        output.append(line)
    return output


def action(settings, context, action_name, payload):
    if action_name not in {"complete", "reopen"}:
        raise ValueError("Unsupported CalDAV task action")
    collection = _base_url(settings)
    href = str((payload or {}).get("href") or "").strip()
    if not href:
        raise ValueError("Task href is required")
    target = _task_url(collection, href)
    status, headers, raw, _ = _request(context, settings, target, method="GET", max_bytes=2 * 1024 * 1024)
    if status >= 400:
        raise RuntimeError(f"CalDAV task read returned HTTP {status}")
    text = raw.decode("utf-8", "replace")
    newline = "\r\n" if "\r\n" in text else "\n"
    lines = _unfold(text)
    if action_name == "complete":
        now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        for key, value in (("STATUS", "COMPLETED"), ("PERCENT-COMPLETE", "100"), ("COMPLETED", now)):
            lines = _replace_property(lines, key, value)
    else:
        for key, value in (("STATUS", "NEEDS-ACTION"), ("PERCENT-COMPLETE", "0"), ("COMPLETED", None)):
            lines = _replace_property(lines, key, value)
    updated = (newline.join(lines).rstrip("\r\n") + newline).encode("utf-8")
    extra = {"Content-Type": headers.get("Content-Type", "text/calendar; charset=utf-8")}
    etag = str((payload or {}).get("etag") or headers.get("ETag") or "").strip()
    if etag:
        extra["If-Match"] = etag
    status, _, _, _ = _request(context, settings, target, method="PUT", body=updated, extra_headers=extra, max_bytes=1024 * 1024)
    if status not in {200, 201, 204}:
        raise RuntimeError(f"CalDAV task update returned HTTP {status}")
    return {"id": str((payload or {}).get("id") or ""), "completed": action_name == "complete"}
