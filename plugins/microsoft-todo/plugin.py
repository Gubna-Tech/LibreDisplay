import hashlib
import html
import json
import re
import time
import urllib.parse

MANIFEST = {
    "apiVersion": 1,
    "id": "microsoft-todo",
    "name": "Microsoft To Do",
    "description": "Synchronize Microsoft To Do through Microsoft Graph and complete or reopen tasks from LibreDisplay.",
    "version": "1.0",
    "icon": "M",
    "kind": "tasks",
    "actions": ["complete", "reopen"],
    "refreshMin": 2,
    "settings": [
        {"key": "taskListId", "label": "Task list ID (optional)", "type": "text", "default": "", "help": "Leave blank to combine tasks from all To Do lists, or paste one Microsoft To Do list ID."},
        {"key": "accessToken", "label": "Access token (optional)", "type": "password", "default": "", "help": "For short-lived access. For long-running sync, configure a refresh token below."},
        {"key": "refreshToken", "label": "Refresh token (recommended)", "type": "password", "default": "", "help": "OAuth refresh token with Microsoft Graph Tasks.ReadWrite and offline_access."},
        {"key": "clientId", "label": "Microsoft app client ID", "type": "text", "default": "", "help": "Required when using a refresh token."},
        {"key": "clientSecret", "label": "Client secret (optional)", "type": "password", "default": "", "help": "Usually blank for a public/native app. Include it for confidential clients."},
        {"key": "tenant", "label": "Tenant", "type": "text", "default": "common", "help": "common, consumers, organizations, or your Microsoft Entra tenant ID/domain."},
        {"key": "showCompleted", "label": "Show completed tasks", "type": "checkbox", "default": False},
        {"key": "showDescriptions", "label": "Show task notes", "type": "checkbox", "default": False},
        {"key": "maxTasks", "label": "Maximum tasks", "type": "number", "default": 30},
    ],
}

GRAPH = "https://graph.microsoft.com/v1.0"
_TOKEN_CACHE = {}


def _tenant(settings):
    value = str(settings.get("tenant") or "common").strip() or "common"
    if not re.fullmatch(r"[A-Za-z0-9.-]{1,160}", value):
        raise ValueError("Invalid Microsoft tenant value")
    return value


def _credential_key(settings):
    raw = "\0".join(str(settings.get(k) or "") for k in ("tenant", "clientId", "clientSecret", "refreshToken"))
    return hashlib.sha256(raw.encode("utf-8", "replace")).hexdigest()


def _access_token(settings, context):
    refresh = str(settings.get("refreshToken") or "").strip()
    client_id = str(settings.get("clientId") or "").strip()
    if refresh:
        if not client_id:
            raise ValueError("Microsoft app client ID is required when using a refresh token")
        key = _credential_key(settings)
        cached = _TOKEN_CACHE.get(key) or {}
        if cached.get("token") and float(cached.get("expires", 0)) > time.time() + 60:
            return cached["token"]
        token_url = "https://login.microsoftonline.com/" + urllib.parse.quote(_tenant(settings), safe=".-") + "/oauth2/v2.0/token"
        form = {
            "grant_type": "refresh_token",
            "client_id": client_id,
            "refresh_token": refresh,
            "scope": "offline_access https://graph.microsoft.com/Tasks.ReadWrite",
        }
        secret = str(settings.get("clientSecret") or "").strip()
        if secret:
            form["client_secret"] = secret
        status, _, raw, _ = context.request(
            token_url,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json", "User-Agent": "LibreDisplay Microsoft To Do integration"},
            body=urllib.parse.urlencode(form).encode("utf-8"),
            timeout=20,
            max_bytes=1024 * 1024,
        )
        try:
            payload = json.loads(raw.decode("utf-8", "replace"))
        except Exception:
            payload = {}
        if status >= 400 or not payload.get("access_token"):
            detail = str(payload.get("error_description") or payload.get("error") or f"HTTP {status}")[:300]
            raise RuntimeError("Microsoft OAuth refresh failed: " + detail)
        token = str(payload["access_token"])
        _TOKEN_CACHE[key] = {"token": token, "expires": time.time() + max(60, int(payload.get("expires_in") or 3600))}
        return token
    token = str(settings.get("accessToken") or "").strip()
    if not token:
        raise ValueError("Configure a Microsoft To Do access token or refresh token")
    return token


def _headers(token, content=False):
    out = {"Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "LibreDisplay Microsoft To Do integration"}
    if content:
        out["Content-Type"] = "application/json"
    return out


def _get_json(context, url, token):
    status, _, raw, _ = context.request(url, headers=_headers(token), timeout=20, max_bytes=5 * 1024 * 1024)
    if status >= 400:
        raise RuntimeError(f"Microsoft Graph returned HTTP {status}")
    return json.loads(raw.decode("utf-8", "replace"))


def _plain_body(value):
    if not isinstance(value, dict):
        return ""
    text = str(value.get("content") or "")
    if str(value.get("contentType") or "").lower() == "html":
        text = re.sub(r"<[^>]+>", " ", text)
        text = html.unescape(text)
        text = re.sub(r"\s+", " ", text).strip()
    return text[:2000]


def _task_lists(settings, context, token):
    selected = str(settings.get("taskListId") or "").strip()
    if selected:
        return [{"id": selected, "displayName": "Microsoft To Do"}]
    data = _get_json(context, GRAPH + "/me/todo/lists?$top=100", token)
    rows = data.get("value") if isinstance(data, dict) else []
    if not isinstance(rows, list):
        rows = []
    return [{"id": str(x.get("id") or ""), "displayName": str(x.get("displayName") or "To Do")} for x in rows if isinstance(x, dict) and x.get("id")]


def fetch(settings, context):
    limit = max(1, min(100, int(float(settings.get("maxTasks") or 30))))
    show_completed = settings.get("showCompleted") is True
    token = _access_token(settings, context)
    tasks = []
    for task_list in _task_lists(settings, context, token):
        list_id = task_list["id"]
        url = GRAPH + "/me/todo/lists/" + urllib.parse.quote(list_id, safe="") + "/tasks?$top=100"
        pages = 0
        while url and pages < 4 and len(tasks) < limit * 3:
            data = _get_json(context, url, token)
            rows = data.get("value") if isinstance(data, dict) else []
            if not isinstance(rows, list):
                rows = []
            for row in rows:
                if not isinstance(row, dict):
                    continue
                completed = str(row.get("status") or "") == "completed"
                if completed and not show_completed:
                    continue
                due_obj = row.get("dueDateTime") if isinstance(row.get("dueDateTime"), dict) else {}
                due = str(due_obj.get("dateTime") or "")
                tasks.append({
                    "id": str(row.get("id") or ""),
                    "title": str(row.get("title") or "Untitled task")[:500],
                    "description": _plain_body(row.get("body")) if settings.get("showDescriptions") else "",
                    "due": due,
                    "dueText": due[:10] if due else "",
                    "completed": completed,
                    "listId": list_id,
                    "listName": task_list.get("displayName") or "To Do",
                    "priority": str(row.get("importance") or "normal"),
                })
            next_url = str(data.get("@odata.nextLink") or "") if isinstance(data, dict) else ""
            url = next_url if next_url.startswith("https://graph.microsoft.com/") else ""
            pages += 1
    tasks.sort(key=lambda x: (x.get("completed", False), x.get("due") or "9999", x.get("title") or ""))
    tasks = tasks[:limit]
    return {"kind": "tasks", "provider": "Microsoft To Do", "tasks": tasks, "count": len(tasks), "showCompleted": show_completed}


def action(settings, context, action_name, payload):
    if action_name not in {"complete", "reopen"}:
        raise ValueError("Unsupported Microsoft To Do action")
    task_id = str((payload or {}).get("id") or "").strip()
    list_id = str((payload or {}).get("listId") or settings.get("taskListId") or "").strip()
    if not task_id or not list_id:
        raise ValueError("Microsoft To Do task and list ids are required")
    completed = action_name == "complete"
    url = GRAPH + "/me/todo/lists/" + urllib.parse.quote(list_id, safe="") + "/tasks/" + urllib.parse.quote(task_id, safe="")
    token = _access_token(settings, context)
    status, _, raw, _ = context.request(
        url,
        method="PATCH",
        headers=_headers(token, content=True),
        body=json.dumps({"status": "completed" if completed else "notStarted"}, separators=(",", ":")).encode("utf-8"),
        timeout=20,
        max_bytes=1024 * 1024,
    )
    if status >= 400:
        detail = raw.decode("utf-8", "replace")[:200]
        raise RuntimeError(f"Microsoft Graph returned HTTP {status}: {detail}")
    return {"id": task_id, "listId": list_id, "completed": completed}
