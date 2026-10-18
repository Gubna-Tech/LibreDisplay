import json
import urllib.parse

MANIFEST = {
    "apiVersion": 1,
    "id": "asana",
    "name": "Asana Tasks",
    "description": "Show Asana tasks from a project or workspace and complete or reopen them from LibreDisplay.",
    "version": "1.0",
    "icon": "A",
    "kind": "tasks", "alternative": "caldav-tasks", "freedomNote": "For a standards-based self-hosted option, LibreDisplay also supports CalDAV / Nextcloud Tasks.",
    "actions": ["complete", "reopen"],
    "refreshMin": 3,
    "settings": [
        {"key": "token", "label": "Asana access token", "type": "password", "required": True, "help": "Personal access token or OAuth access token with task read/write access."},
        {"key": "projectGid", "label": "Project GID (optional)", "type": "text", "default": "", "help": "If set, show tasks from this project. Otherwise provide a workspace GID for My Tasks."},
        {"key": "workspaceGid", "label": "Workspace GID (optional)", "type": "text", "default": "", "help": "Used with assignee=me when no project GID is configured."},
        {"key": "showCompleted", "label": "Show completed tasks", "type": "checkbox", "default": False},
        {"key": "showDescriptions", "label": "Show notes", "type": "checkbox", "default": False},
        {"key": "maxTasks", "label": "Maximum tasks", "type": "number", "default": 30},
    ],
}
MANIFEST.update({'access': 'account', 'dataFlow': 'provider-cloud', 'dataLeavesDevice': True, 'privacyNote': 'LibreDisplay sends task queries and actions to the Asana account API over HTTPS.', 'freedomAlternative': 'Use CalDAV / Nextcloud Tasks for a standards-based self-hosted task source.'})

API = "https://app.asana.com/api/1.0"


def _headers(settings, content=False):
    token = str(settings.get("token") or "").strip()
    if not token:
        raise ValueError("Asana access token is required")
    out = {"Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "LibreDisplay Asana integration"}
    if content:
        out["Content-Type"] = "application/json"
    return out


def fetch(settings, context):
    limit = max(1, min(100, int(float(settings.get("maxTasks") or 30))))
    project = str(settings.get("projectGid") or "").strip()
    workspace = str(settings.get("workspaceGid") or "").strip()
    if not project and not workspace:
        raise ValueError("Configure an Asana project GID or workspace GID")
    params = {
        "limit": limit,
        "opt_fields": "name,notes,due_on,due_at,completed,memberships.project.name,permalink_url",
    }
    show_completed = settings.get("showCompleted") is True
    if not show_completed:
        params["completed_since"] = "now"
    if project:
        url = API + "/projects/" + urllib.parse.quote(project, safe="") + "/tasks?" + urllib.parse.urlencode(params)
    else:
        params.update({"assignee": "me", "workspace": workspace})
        url = API + "/tasks?" + urllib.parse.urlencode(params)
    status, _, raw, _ = context.request(url, headers=_headers(settings), timeout=20, max_bytes=5 * 1024 * 1024)
    if status >= 400:
        raise RuntimeError(f"Asana returned HTTP {status}")
    payload = json.loads(raw.decode("utf-8", "replace"))
    rows = payload.get("data") if isinstance(payload, dict) else []
    if not isinstance(rows, list):
        rows = []
    tasks = []
    for row in rows[:limit]:
        if not isinstance(row, dict):
            continue
        completed = row.get("completed") is True
        if completed and not show_completed:
            continue
        due = str(row.get("due_at") or row.get("due_on") or "")
        memberships = row.get("memberships") if isinstance(row.get("memberships"), list) else []
        project_name = ""
        for membership in memberships:
            if not isinstance(membership, dict):
                continue
            pobj = membership.get("project") if isinstance(membership.get("project"), dict) else {}
            if pobj.get("name"):
                project_name = str(pobj.get("name"))[:200]
                break
        tasks.append({
            "id": str(row.get("gid") or ""),
            "title": str(row.get("name") or "Untitled task")[:500],
            "description": str(row.get("notes") or "")[:2000] if settings.get("showDescriptions") else "",
            "due": due,
            "dueText": due[:10] if due else "",
            "completed": completed,
            "projectId": project,
            "projectName": project_name,
            "webUrl": str(row.get("permalink_url") or ""),
        })
    tasks.sort(key=lambda x: (x.get("completed", False), x.get("due") or "9999", x.get("title") or ""))
    return {"kind": "tasks", "provider": "Asana", "tasks": tasks, "count": len(tasks), "showCompleted": show_completed}


def action(settings, context, action_name, payload):
    if action_name not in {"complete", "reopen"}:
        raise ValueError("Unsupported Asana action")
    task_id = str((payload or {}).get("id") or "").strip()
    if not task_id:
        raise ValueError("Asana task GID is required")
    completed = action_name == "complete"
    url = API + "/tasks/" + urllib.parse.quote(task_id, safe="")
    status, _, raw, _ = context.request(
        url,
        method="PUT",
        headers=_headers(settings, content=True),
        body=json.dumps({"data": {"completed": completed}}, separators=(",", ":")).encode("utf-8"),
        timeout=20,
        max_bytes=1024 * 1024,
    )
    if status >= 400:
        detail = raw.decode("utf-8", "replace")[:200]
        raise RuntimeError(f"Asana returned HTTP {status}: {detail}")
    return {"id": task_id, "completed": completed}
