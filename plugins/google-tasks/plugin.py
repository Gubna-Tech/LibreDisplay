import datetime
import hashlib
import json
import time
import urllib.parse

MANIFEST = {
    "apiVersion": 1,
    "id": "google-tasks",
    "name": "Google Tasks",
    "description": "Synchronize a Google Tasks list and complete or reopen tasks from LibreDisplay.",
    "version": "1.0",
    "icon": "G",
    "kind": "tasks", "alternative": "caldav-tasks", "freedomNote": "For a standards-based self-hosted option, LibreDisplay also supports CalDAV / Nextcloud Tasks.",
    "actions": ["complete", "reopen"],
    "refreshMin": 2,
    "settings": [
        {"key": "taskListId", "label": "Task list ID", "type": "text", "default": "@default", "help": "Use @default for your primary list or paste another Google Tasks list ID."},
        {"key": "accessToken", "label": "Access token (optional)", "type": "password", "default": "", "help": "For short-lived access. For long-running sync, configure a refresh token below."},
        {"key": "refreshToken", "label": "Refresh token (recommended)", "type": "password", "default": "", "help": "OAuth refresh token with the Google Tasks read/write scope."},
        {"key": "clientId", "label": "OAuth client ID", "type": "text", "default": "", "help": "Required when using a refresh token."},
        {"key": "clientSecret", "label": "OAuth client secret", "type": "password", "default": "", "help": "Include this when your Google OAuth client requires one."},
        {"key": "showCompleted", "label": "Show completed tasks", "type": "checkbox", "default": False},
        {"key": "showDescriptions", "label": "Show notes", "type": "checkbox", "default": False},
        {"key": "maxTasks", "label": "Maximum tasks", "type": "number", "default": 30},
    ],
}

API = "https://tasks.googleapis.com/tasks/v1"
TOKEN_URL = "https://oauth2.googleapis.com/token"
_TOKEN_CACHE = {}


def _credential_key(settings):
    raw = "\0".join(str(settings.get(k) or "") for k in ("clientId", "clientSecret", "refreshToken"))
    return hashlib.sha256(raw.encode("utf-8", "replace")).hexdigest()


def _access_token(settings, context):
    refresh = str(settings.get("refreshToken") or "").strip()
    client_id = str(settings.get("clientId") or "").strip()
    if refresh:
        if not client_id:
            raise ValueError("Google OAuth client ID is required when using a refresh token")
        key = _credential_key(settings)
        cached = _TOKEN_CACHE.get(key) or {}
        if cached.get("token") and float(cached.get("expires", 0)) > time.time() + 60:
            return cached["token"]
        form = {"grant_type": "refresh_token", "client_id": client_id, "refresh_token": refresh}
        secret = str(settings.get("clientSecret") or "").strip()
        if secret:
            form["client_secret"] = secret
        body = urllib.parse.urlencode(form).encode("utf-8")
        status, _, raw, _ = context.request(
            TOKEN_URL,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json", "User-Agent": "LibreDisplay Google Tasks integration"},
            body=body,
            timeout=20,
            max_bytes=1024 * 1024,
        )
        try:
            payload = json.loads(raw.decode("utf-8", "replace"))
        except Exception:
            payload = {}
        if status >= 400 or not payload.get("access_token"):
            detail = str(payload.get("error_description") or payload.get("error") or f"HTTP {status}")[:300]
            raise RuntimeError("Google OAuth refresh failed: " + detail)
        token = str(payload["access_token"])
        _TOKEN_CACHE[key] = {"token": token, "expires": time.time() + max(60, int(payload.get("expires_in") or 3600))}
        return token
    token = str(settings.get("accessToken") or "").strip()
    if not token:
        raise ValueError("Configure a Google Tasks access token or refresh token")
    return token


def _headers(token, content=False):
    out = {"Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "LibreDisplay Google Tasks integration"}
    if content:
        out["Content-Type"] = "application/json"
    return out


def _list_id(settings):
    return str(settings.get("taskListId") or "@default").strip() or "@default"


def _task_url(settings, task_id=None):
    base = API + "/lists/" + urllib.parse.quote(_list_id(settings), safe="@") + "/tasks"
    if task_id is not None:
        base += "/" + urllib.parse.quote(str(task_id), safe="")
    return base


def fetch(settings, context):
    limit = max(1, min(100, int(float(settings.get("maxTasks") or 30))))
    show_completed = settings.get("showCompleted") is True
    query = urllib.parse.urlencode({
        "maxResults": limit,
        "showCompleted": "true" if show_completed else "false",
        "showDeleted": "false",
        "showHidden": "true" if show_completed else "false",
    })
    token = _access_token(settings, context)
    status, _, raw, _ = context.request(_task_url(settings) + "?" + query, headers=_headers(token), timeout=20, max_bytes=4 * 1024 * 1024)
    if status >= 400:
        raise RuntimeError(f"Google Tasks returned HTTP {status}")
    data = json.loads(raw.decode("utf-8", "replace"))
    rows = data.get("items") if isinstance(data, dict) else []
    if not isinstance(rows, list):
        rows = []
    tasks = []
    for row in rows[:limit]:
        if not isinstance(row, dict) or row.get("deleted") is True:
            continue
        completed = str(row.get("status") or "") == "completed"
        if completed and not show_completed:
            continue
        due = str(row.get("due") or "")
        tasks.append({
            "id": str(row.get("id") or ""),
            "title": str(row.get("title") or "Untitled task")[:500],
            "description": str(row.get("notes") or "")[:2000] if settings.get("showDescriptions") else "",
            "due": due,
            "dueText": due[:10] if due else "",
            "completed": completed,
            "taskListId": _list_id(settings),
            "webUrl": str(row.get("webViewLink") or ""),
        })
    tasks.sort(key=lambda x: (x.get("completed", False), x.get("due") or "9999", x.get("title") or ""))
    return {"kind": "tasks", "provider": "Google Tasks", "tasks": tasks, "count": len(tasks), "showCompleted": show_completed}


def action(settings, context, action_name, payload):
    if action_name not in {"complete", "reopen"}:
        raise ValueError("Unsupported Google Tasks action")
    task_id = str((payload or {}).get("id") or "").strip()
    if not task_id:
        raise ValueError("Google task id is required")
    completed = action_name == "complete"
    body = {"status": "completed" if completed else "needsAction"}
    if completed:
        body["completed"] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    else:
        body["completed"] = None
    token = _access_token(settings, context)
    status, _, raw, _ = context.request(
        _task_url(settings, task_id),
        method="PATCH",
        headers=_headers(token, content=True),
        body=json.dumps(body, separators=(",", ":")).encode("utf-8"),
        timeout=20,
        max_bytes=1024 * 1024,
    )
    if status >= 400:
        detail = raw.decode("utf-8", "replace")[:200]
        raise RuntimeError(f"Google Tasks returned HTTP {status}: {detail}")
    return {"id": task_id, "completed": completed}
