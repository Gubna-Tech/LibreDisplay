import json
import urllib.parse

MANIFEST = {
    "apiVersion": 1,
    "id": "todoist",
    "name": "Todoist Tasks",
    "description": "Show active Todoist tasks and complete them from a touch display.",
    "version": "1.0",
    "icon": "✓",
    "kind": "tasks",
    "actions": ["complete"],
    "refreshMin": 2,
    "settings": [
        {"key": "token", "label": "Todoist API token", "type": "password", "required": True, "help": "Create a personal API token in Todoist Settings → Integrations → Developer. It stays on the LibreDisplay server."},
        {"key": "filter", "label": "Todoist filter (optional)", "type": "text", "default": "", "help": "Examples: today, overdue, #Home. Leave blank to show active tasks."},
        {"key": "maxTasks", "label": "Maximum tasks", "type": "number", "default": 20},
        {"key": "showDescriptions", "label": "Show descriptions", "type": "checkbox", "default": False},
    ],
}

API = "https://api.todoist.com/api/v1"


def _headers(token):
    value = str(token or "").strip()
    if not value:
        raise ValueError("Todoist API token is required")
    return {
        "Authorization": "Bearer " + value,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "LibreDisplay Todoist integration",
    }


def _request_json(context, url, token):
    status, _, body, _ = context.request(url, headers=_headers(token), timeout=20, max_bytes=4 * 1024 * 1024)
    if status >= 400:
        raise RuntimeError(f"Todoist returned HTTP {status}")
    return json.loads(body.decode("utf-8", "replace"))


def fetch(settings, context):
    limit = max(1, min(100, int(float(settings.get("maxTasks") or 20))))
    filter_text = str(settings.get("filter") or "").strip()
    if filter_text:
        url = API + "/tasks/filter?" + urllib.parse.urlencode({"query": filter_text, "limit": limit})
    else:
        url = API + "/tasks?" + urllib.parse.urlencode({"limit": limit})
    data = _request_json(context, url, settings.get("token"))
    rows = data.get("results") if isinstance(data, dict) else data
    if not isinstance(rows, list):
        rows = []
    tasks = []
    for row in rows[:limit]:
        if not isinstance(row, dict):
            continue
        due = row.get("due") if isinstance(row.get("due"), dict) else {}
        tasks.append({
            "id": str(row.get("id") or ""),
            "title": str(row.get("content") or "Untitled task")[:500],
            "description": str(row.get("description") or "")[:2000] if settings.get("showDescriptions") else "",
            "due": str(due.get("datetime") or due.get("date") or ""),
            "dueText": str(due.get("string") or ""),
            "priority": int(row.get("priority") or 1),
            "projectId": str(row.get("project_id") or ""),
            "completed": False,
        })
    return {"kind": "tasks", "provider": "Todoist", "tasks": tasks, "filter": filter_text, "count": len(tasks)}


def action(settings, context, action_name, payload):
    if action_name != "complete":
        raise ValueError("Unsupported Todoist action")
    task_id = str((payload or {}).get("id") or "").strip()
    if not task_id or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-" for ch in task_id):
        raise ValueError("A valid Todoist task id is required")
    status, _, _, _ = context.request(
        API + "/tasks/" + urllib.parse.quote(task_id, safe="") + "/close",
        method="POST",
        headers=_headers(settings.get("token")),
        body=b"",
        timeout=20,
        max_bytes=1024 * 1024,
    )
    if status >= 400:
        raise RuntimeError(f"Todoist returned HTTP {status}")
    return {"completed": True, "id": task_id}
