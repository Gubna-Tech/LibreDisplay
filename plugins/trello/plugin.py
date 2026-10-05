import json
import urllib.parse

MANIFEST = {
    "apiVersion": 1,
    "id": "trello",
    "name": "Trello Cards",
    "description": "Show Trello cards as tasks and toggle each card's due-complete state from LibreDisplay.",
    "version": "1.0",
    "icon": "T",
    "kind": "tasks",
    "actions": ["complete", "reopen"],
    "refreshMin": 3,
    "settings": [
        {"key": "accessToken", "label": "OAuth access token (optional)", "type": "password", "default": "", "help": "Use a Trello OAuth bearer token, or configure a legacy API key + token below."},
        {"key": "apiKey", "label": "API key (optional)", "type": "password", "default": ""},
        {"key": "apiToken", "label": "API token (optional)", "type": "password", "default": ""},
        {"key": "boardId", "label": "Board ID filter (optional)", "type": "text", "default": ""},
        {"key": "listId", "label": "List ID filter (optional)", "type": "text", "default": ""},
        {"key": "showCompleted", "label": "Show due-complete cards", "type": "checkbox", "default": False},
        {"key": "showDescriptions", "label": "Show card descriptions", "type": "checkbox", "default": False},
        {"key": "maxTasks", "label": "Maximum cards", "type": "number", "default": 30},
    ],
}

API = "https://api.trello.com/1"


def _auth(settings, url):
    bearer = str(settings.get("accessToken") or "").strip()
    if bearer:
        return url, {"Authorization": "Bearer " + bearer, "Accept": "application/json", "User-Agent": "LibreDisplay Trello integration"}
    key = str(settings.get("apiKey") or "").strip()
    token = str(settings.get("apiToken") or "").strip()
    if not key or not token:
        raise ValueError("Configure a Trello OAuth access token or both API key and API token")
    sep = "&" if "?" in url else "?"
    url += sep + urllib.parse.urlencode({"key": key, "token": token})
    return url, {"Accept": "application/json", "User-Agent": "LibreDisplay Trello integration"}


def fetch(settings, context):
    limit = max(1, min(100, int(float(settings.get("maxTasks") or 30))))
    query = urllib.parse.urlencode({"filter": "visible", "fields": "id,name,desc,due,dueComplete,idBoard,idList,url,closed"})
    url, headers = _auth(settings, API + "/members/me/cards?" + query)
    status, _, raw, _ = context.request(url, headers=headers, timeout=20, max_bytes=5 * 1024 * 1024)
    if status >= 400:
        raise RuntimeError(f"Trello returned HTTP {status}")
    rows = json.loads(raw.decode("utf-8", "replace"))
    if not isinstance(rows, list):
        rows = []
    board_filter = str(settings.get("boardId") or "").strip()
    list_filter = str(settings.get("listId") or "").strip()
    show_completed = settings.get("showCompleted") is True
    tasks = []
    for row in rows:
        if not isinstance(row, dict) or row.get("closed") is True:
            continue
        if board_filter and str(row.get("idBoard") or "") != board_filter:
            continue
        if list_filter and str(row.get("idList") or "") != list_filter:
            continue
        completed = row.get("dueComplete") is True
        if completed and not show_completed:
            continue
        due = str(row.get("due") or "")
        tasks.append({
            "id": str(row.get("id") or ""),
            "title": str(row.get("name") or "Untitled card")[:500],
            "description": str(row.get("desc") or "")[:2000] if settings.get("showDescriptions") else "",
            "due": due,
            "dueText": due[:10] if due else "",
            "completed": completed,
            "boardId": str(row.get("idBoard") or ""),
            "listId": str(row.get("idList") or ""),
            "webUrl": str(row.get("url") or ""),
        })
    tasks.sort(key=lambda x: (x.get("completed", False), x.get("due") or "9999", x.get("title") or ""))
    tasks = tasks[:limit]
    return {"kind": "tasks", "provider": "Trello", "tasks": tasks, "count": len(tasks), "showCompleted": show_completed}


def action(settings, context, action_name, payload):
    if action_name not in {"complete", "reopen"}:
        raise ValueError("Unsupported Trello action")
    card_id = str((payload or {}).get("id") or "").strip()
    if not card_id:
        raise ValueError("Trello card id is required")
    completed = action_name == "complete"
    url, headers = _auth(settings, API + "/cards/" + urllib.parse.quote(card_id, safe=""))
    headers = dict(headers)
    headers["Content-Type"] = "application/json"
    status, _, raw, _ = context.request(
        url,
        method="PUT",
        headers=headers,
        body=json.dumps({"dueComplete": completed}, separators=(",", ":")).encode("utf-8"),
        timeout=20,
        max_bytes=1024 * 1024,
    )
    if status >= 400:
        detail = raw.decode("utf-8", "replace")[:200]
        raise RuntimeError(f"Trello returned HTTP {status}: {detail}")
    return {"id": card_id, "completed": completed}
