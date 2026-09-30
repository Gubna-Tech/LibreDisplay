#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, urlencode, quote, urljoin
from pathlib import Path
import hashlib
import hmac
import http.client
import ipaddress
import mimetypes
import json
import os
import re
import secrets
import ssl
import shutil
import socket
import subprocess
import sys
import time
import threading
import datetime
import importlib.util
import queue

HOST = os.environ.get("DASHBOARD_HOST", "127.0.0.1")
PORT = int(os.environ.get("DASHBOARD_PORT", "8787"))
ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent if ROOT.name == "app" else ROOT
try:
    APP_VERSION = (PROJECT_ROOT / "VERSION").read_text(encoding="utf-8").strip() or "dev"
except OSError:
    APP_VERSION = "dev"
DATA_ROOT = Path(os.environ.get("DASHBOARD_DATA_DIR", str(PROJECT_ROOT / "data"))).expanduser().resolve()
MAX_BYTES = 25 * 1024 * 1024
MAX_STATE_BYTES = 2 * 1024 * 1024
MAX_MEDIA_FILE_BYTES = int(os.environ.get("DASHBOARD_MAX_MEDIA_FILE_BYTES", str(100 * 1024 * 1024)))
MAX_MEDIA_ITEMS = int(os.environ.get("DASHBOARD_MAX_MEDIA_ITEMS", "20000"))
CACHE_MAX_BYTES = int(os.environ.get("DASHBOARD_CACHE_MAX_BYTES", str(512 * 1024 * 1024)))
CONFIG_PATH = DATA_ROOT / "dashboard_config.json"
CONFIG_BACKUP_PATH = DATA_ROOT / "dashboard_config.previous.json"
PROFILES_PATH = DATA_ROOT / "dashboard_profiles.json"
SCENES_PATH = DATA_ROOT / "dashboard_scenes.json"
ACCESS_PATH = DATA_ROOT / "dashboard_access.json"
CACHE_DIR = DATA_ROOT / "dashboard_cache"
ENDPOINTS_PATH = DATA_ROOT / "dashboard_endpoints.json"
ENDPOINT_CONFIG_DIR = DATA_ROOT / "endpoints"
CALENDAR_FILES_DIR = DATA_ROOT / "calendar_files"
BROKER_DIR = DATA_ROOT / "broker"
SCENE_BASE_DIR = DATA_ROOT / "scene_base"
HOUSEHOLD_PATH = DATA_ROOT / "dashboard_household.json"
PLUGINS_ROOT = PROJECT_ROOT / "plugins"
if str(PLUGINS_ROOT) not in sys.path:
    sys.path.insert(0, str(PLUGINS_ROOT))
REMOTE_COOKIE_NAME = "libredisplay_session"
REMOTE_COOKIE_MAX_AGE = int(os.environ.get("DASHBOARD_REMOTE_SESSION_SECONDS", str(8 * 60 * 60)))
DISPLAY_COOKIE_NAME = "libredisplay_display"
DISPLAY_COOKIE_MAX_AGE = int(os.environ.get("DASHBOARD_DISPLAY_SESSION_SECONDS", str(365 * 24 * 60 * 60)))
REMOTE_NETWORKS_RAW = str(os.environ.get("DASHBOARD_REMOTE_NETWORKS", "private")).strip()
REMOTE_DEFAULT_ENABLED = str(os.environ.get("DASHBOARD_REMOTE_ENABLED", "0")).strip().lower() in {"1", "true", "yes", "on"}
ALLOWED_HOSTS_RAW = str(os.environ.get("DASHBOARD_ALLOWED_HOSTS", "")).strip()
REMOTE_ACCESS_PATH = DATA_ROOT / "remote_access.json"
USERS_PATH = DATA_ROOT / "dashboard_users.json"
REMOTE_SESSION_LOCK = threading.Lock()
REMOTE_SESSIONS = {}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp"}

os.umask(0o077)
DATA_ROOT.mkdir(parents=True, exist_ok=True)
ENDPOINT_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
CALENDAR_FILES_DIR.mkdir(parents=True, exist_ok=True)
BROKER_DIR.mkdir(parents=True, exist_ok=True)
SCENE_BASE_DIR.mkdir(parents=True, exist_ok=True)

GOOGLE_BATCH_URL = "https://photos.google.com/u/0/_/PhotosUi/data/batchexecute"
GOOGLE_RPC_ID = "snAcKc"


BROKER_LOCK = threading.Lock()
BROKER_KEY_LOCKS = {}
BROKER_STATUS = {}
DEVICE_LOCK = threading.Lock()
DEVICE_STATE = {}
EVENT_LOCK = threading.Lock()
EVENT_SUBSCRIBERS = {}
PLUGIN_LOCK = threading.Lock()
PLUGIN_API_VERSION = 1
TRUSTED_PRIVATE_PLUGINS = {"home-assistant", "caldav-tasks", "sonos-now-playing"}
PLUGINS = {}
SCENE_LOCK = threading.Lock()
SCENE_ACTIVE = {}
UPDATE_CHECK_LOCK = threading.Lock()
UPDATE_CHECK_CACHE = {}
UPDATE_CHECK_TTL_SECONDS = 6 * 60 * 60
GITHUB_RELEASE_API = "https://api.github.com/repos/Gubna-Tech/LibreDisplay/releases/latest"




def atomic_write_json_file(path, payload, backup_path=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    if backup_path and path.exists():
        try:
            shutil.copy2(path, backup_path)
        except Exception:
            pass
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, path)
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass


def load_json_path(path, fallback=None):
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return fallback



def household_slug(value, prefix="item"):
    value = re.sub(r"[^A-Za-z0-9_-]+", "-", str(value or "").strip()).strip("-")[:64]
    return value or f"{prefix}-{secrets.token_hex(4)}"




def account_password_hash(password, salt=None):
    value = str(password or "")
    if len(value) < 8 or len(value) > 256:
        raise ValueError("Password must contain 8 to 256 characters")
    salt_bytes = secrets.token_bytes(16) if salt is None else bytes.fromhex(salt)
    digest = hashlib.pbkdf2_hmac("sha256", value.encode("utf-8"), salt_bytes, 240000)
    return f"pbkdf2-sha256$240000${salt_bytes.hex()}${digest.hex()}"


def account_password_valid(password, encoded):
    try:
        algo, rounds, salt, expected = str(encoded or "").split("$", 3)
        if algo != "pbkdf2-sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", str(password or "").encode("utf-8"), bytes.fromhex(salt), int(rounds)).hex()
        return hmac.compare_digest(digest, expected)
    except Exception:
        return False


def normalize_user_store(raw):
    src = raw if isinstance(raw, dict) else {}
    out = {"version": 1, "users": []}
    seen = set()
    for row in (src.get("users") if isinstance(src.get("users"), list) else [])[:64]:
        if not isinstance(row, dict):
            continue
        username = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(row.get("username") or "").strip()).strip("-")[:64]
        if not username or username.lower() in seen:
            continue
        role = str(row.get("role") or "viewer").lower()
        if role not in {"owner", "editor", "viewer"}:
            role = "viewer"
        endpoints = []
        for value in row.get("endpoints") or []:
            eid = endpoint_slug(value)
            if eid and eid not in endpoints:
                endpoints.append(eid)
        out["users"].append({"username": username, "passwordHash": str(row.get("passwordHash") or "")[:512], "role": role, "endpoints": endpoints[:100], "enabled": row.get("enabled") is not False})
        seen.add(username.lower())
    return out


def load_user_store():
    return normalize_user_store(load_json_path(USERS_PATH, {}))


def save_user_store(store):
    cleaned = normalize_user_store(store)
    atomic_write_json_file(USERS_PATH, cleaned)
    return cleaned


def public_users(store=None):
    store = normalize_user_store(store if store is not None else load_json_path(USERS_PATH, {}))
    return [{"username": x["username"], "role": x["role"], "endpoints": x.get("endpoints") or [], "enabled": x.get("enabled", True)} for x in store.get("users") or []]


def account_lookup(username):
    key = str(username or "").strip().lower()
    return next((x for x in load_user_store().get("users") or [] if x.get("enabled") and str(x.get("username") or "").lower() == key), None)


def principal_allows_endpoint(principal, endpoint_id, write=False):
    if not principal:
        return False
    role = str(principal.get("role") or "").lower()
    if role == "owner":
        return True
    if write and role != "editor":
        return False
    if not write and role not in {"editor", "viewer"}:
        return False
    allowed = {endpoint_slug(x) for x in principal.get("endpoints") or []}
    return endpoint_slug(endpoint_id or "main") in allowed

def pin_hash(pin, salt=None):
    value = str(pin or "")
    if not re.fullmatch(r"\d{4,12}", value):
        raise ValueError("PIN must contain 4 to 12 digits")
    salt_bytes = secrets.token_bytes(16) if salt is None else bytes.fromhex(salt)
    digest = hashlib.pbkdf2_hmac("sha256", value.encode("utf-8"), salt_bytes, 200000)
    return f"pbkdf2-sha256$200000${salt_bytes.hex()}${digest.hex()}"


def pin_valid(pin, encoded):
    try:
        algo, rounds, salt, expected = str(encoded or "").split("$", 3)
        if algo != "pbkdf2-sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", str(pin or "").encode("utf-8"), bytes.fromhex(salt), int(rounds)).hex()
        return hmac.compare_digest(digest, expected)
    except Exception:
        return False


def normalize_household_store(raw, preserve_secret=True):
    src = raw if isinstance(raw, dict) else {}
    out = {"version": 1, "members": [], "chores": [], "rewards": [], "completions": {}, "history": []}
    seen = set()
    for row in (src.get("members") if isinstance(src.get("members"), list) else [])[:32]:
        if not isinstance(row, dict):
            continue
        mid = household_slug(row.get("id") or row.get("name"), "member")
        if mid in seen:
            mid = household_slug(mid + "-" + secrets.token_hex(2), "member")
        seen.add(mid)
        name = str(row.get("name") or "Member").strip()[:60] or "Member"
        emoji = str(row.get("emoji") or "").strip()[:8]
        try: points = int(row.get("points") or 0)
        except Exception: points = 0
        out["members"].append({"id": mid, "name": name, "emoji": emoji, "points": max(0, min(1000000, points))})
    member_ids = {x["id"] for x in out["members"]}
    seen = set()
    for row in (src.get("chores") if isinstance(src.get("chores"), list) else [])[:200]:
        if not isinstance(row, dict):
            continue
        cid = household_slug(row.get("id") or row.get("title"), "chore")
        if cid in seen:
            cid = household_slug(cid + "-" + secrets.token_hex(2), "chore")
        seen.add(cid)
        recurrence = str(row.get("recurrence") or "daily").lower()
        if recurrence not in {"once", "daily", "weekdays", "weekly", "custom"}:
            recurrence = "daily"
        days = []
        for d in row.get("days") or []:
            try: n = int(d)
            except Exception: continue
            if 0 <= n <= 6 and n not in days:
                days.append(n)
        try: points = int(row.get("points") or 1)
        except Exception: points = 1
        member_id = str(row.get("memberId") or "")
        if member_id not in member_ids:
            member_id = ""
        out["chores"].append({
            "id": cid,
            "title": str(row.get("title") or "Chore").strip()[:120] or "Chore",
            "memberId": member_id,
            "points": max(0, min(10000, points)),
            "recurrence": recurrence,
            "days": days,
            "active": row.get("active") is not False,
        })
    seen = set()
    for row in (src.get("rewards") if isinstance(src.get("rewards"), list) else [])[:100]:
        if not isinstance(row, dict):
            continue
        rid = household_slug(row.get("id") or row.get("title"), "reward")
        if rid in seen:
            rid = household_slug(rid + "-" + secrets.token_hex(2), "reward")
        seen.add(rid)
        member_id = str(row.get("memberId") or "")
        if member_id not in member_ids:
            member_id = ""
        try: cost = int(row.get("cost") or 0)
        except Exception: cost = 0
        out["rewards"].append({"id": rid, "title": str(row.get("title") or "Reward").strip()[:120] or "Reward", "cost": max(0, min(1000000, cost)), "memberId": member_id})
    raw_completions = src.get("completions") if isinstance(src.get("completions"), dict) else {}
    chore_ids = {x["id"] for x in out["chores"]}
    for cid, periods in raw_completions.items():
        if cid not in chore_ids or not isinstance(periods, dict):
            continue
        cleaned = {}
        for key, stamp in list(periods.items())[-120:]:
            skey = str(key)[:40]
            try: cleaned[skey] = int(stamp)
            except Exception: continue
        if cleaned:
            out["completions"][cid] = cleaned
    history = src.get("history") if isinstance(src.get("history"), list) else []
    for row in history[-500:]:
        if isinstance(row, dict):
            out["history"].append({k: row.get(k) for k in ("at", "kind", "choreId", "rewardId", "memberId", "points", "period") if k in row})
    lock = src.get("childLock") if isinstance(src.get("childLock"), dict) else {}
    out["childLock"] = {"enabled": bool(lock.get("enabled", False))}
    if preserve_secret and str(lock.get("pinHash") or ""):
        out["childLock"]["pinHash"] = str(lock.get("pinHash"))[:512]
    return out


def household_period(chore, now=None):
    now = now or datetime.datetime.now()
    recurrence = chore.get("recurrence") or "daily"
    if recurrence == "once":
        return "once"
    if recurrence == "weekly":
        year, week, _ = now.isocalendar()
        return f"{year}-W{week:02d}"
    return now.date().isoformat()


def household_chore_due(chore, now=None):
    now = now or datetime.datetime.now()
    if chore.get("active") is False:
        return False
    recurrence = chore.get("recurrence") or "daily"
    if recurrence == "weekdays" and now.weekday() >= 5:
        return False
    if recurrence == "custom":
        js_day = (now.weekday() + 1) % 7
        return js_day in (chore.get("days") or [])
    return True


def household_public_payload(store=None, include_admin=False):
    store = normalize_household_store(store if store is not None else load_json_path(HOUSEHOLD_PATH, {}), preserve_secret=True)
    now = datetime.datetime.now()
    completions = store.get("completions") or {}
    chores = []
    for chore in store.get("chores") or []:
        period = household_period(chore, now)
        chores.append(dict(chore, due=household_chore_due(chore, now), completed=period in (completions.get(chore["id"]) or {}), period=period))
    payload = {
        "version": 1,
        "members": store.get("members") or [],
        "chores": chores,
        "rewards": store.get("rewards") or [],
        "childLock": {"enabled": bool((store.get("childLock") or {}).get("enabled")), "pinSet": bool((store.get("childLock") or {}).get("pinHash"))},
    }
    if include_admin:
        admin = json.loads(json.dumps(store))
        admin["childLock"] = {"enabled": bool((store.get("childLock") or {}).get("enabled")), "pinSet": bool((store.get("childLock") or {}).get("pinHash"))}
        payload["adminStore"] = admin
    return payload


def save_household(store):
    cleaned = normalize_household_store(store, preserve_secret=True)
    atomic_write_json_file(HOUSEHOLD_PATH, cleaned)
    for endpoint in endpoint_items():
        publish_event(endpoint.get("id") or "main", "household", {"updatedAt": int(time.time() * 1000)})
    return cleaned


def household_require_pin(store, pin):
    lock = store.get("childLock") if isinstance(store.get("childLock"), dict) else {}
    if not lock.get("enabled"):
        return True
    return pin_valid(pin, lock.get("pinHash"))


def household_complete(chore_id, completed, pin=""):
    with HOUSEHOLD_LOCK:
        store = normalize_household_store(load_json_path(HOUSEHOLD_PATH, {}), preserve_secret=True)
        if not household_require_pin(store, pin):
            raise PermissionError("PIN required or incorrect")
        chore = next((x for x in store.get("chores") or [] if x.get("id") == chore_id), None)
        if not chore:
            raise ValueError("Unknown chore")
        if not household_chore_due(chore):
            raise ValueError("That chore is not due today")
        period = household_period(chore)
        periods = store.setdefault("completions", {}).setdefault(chore_id, {})
        was = period in periods
        target = bool(completed)
        if was == target:
            return store
        member = next((x for x in store.get("members") or [] if x.get("id") == chore.get("memberId")), None)
        points = int(chore.get("points") or 0)
        if target:
            periods[period] = int(time.time())
            if member:
                member["points"] = min(1000000, int(member.get("points") or 0) + points)
        else:
            periods.pop(period, None)
            if member:
                member["points"] = max(0, int(member.get("points") or 0) - points)
        store.setdefault("history", []).append({"at": int(time.time()), "kind": "complete" if target else "uncomplete", "choreId": chore_id, "memberId": chore.get("memberId") or "", "points": points if target else -points, "period": period})
        return save_household(store)


def household_redeem(reward_id, member_id, pin=""):
    with HOUSEHOLD_LOCK:
        store = normalize_household_store(load_json_path(HOUSEHOLD_PATH, {}), preserve_secret=True)
        if not household_require_pin(store, pin):
            raise PermissionError("PIN required or incorrect")
        reward = next((x for x in store.get("rewards") or [] if x.get("id") == reward_id), None)
        member = next((x for x in store.get("members") or [] if x.get("id") == member_id), None)
        if not reward or not member:
            raise ValueError("Unknown reward or household member")
        if reward.get("memberId") and reward.get("memberId") != member_id:
            raise ValueError("That reward is assigned to another household member")
        cost = int(reward.get("cost") or 0)
        if int(member.get("points") or 0) < cost:
            raise ValueError("Not enough points for that reward")
        member["points"] = int(member.get("points") or 0) - cost
        store.setdefault("history", []).append({"at": int(time.time()), "kind": "reward", "rewardId": reward_id, "memberId": member_id, "points": -cost})
        return save_household(store)


def normalize_scene_store(raw):
    src = raw if isinstance(raw, dict) else {}
    out = {"version": 1, "automatic": bool(src.get("automatic", True)), "baseProfiles": {}, "items": []}
    base = src.get("baseProfiles") if isinstance(src.get("baseProfiles"), dict) else {}
    for endpoint_id, profile_id in base.items():
        eid = endpoint_slug(endpoint_id)
        pid = str(profile_id or "").strip()[:100]
        if eid and pid:
            out["baseProfiles"][eid] = pid
    rows = src.get("items") if isinstance(src.get("items"), list) else []
    for raw_row in rows[:100]:
        if not isinstance(raw_row, dict):
            continue
        rid = re.sub(r"[^A-Za-z0-9_-]+", "-", str(raw_row.get("id") or "").strip())[:80] or secrets.token_hex(6)
        eid = endpoint_slug(raw_row.get("endpoint") or "main")
        pid = str(raw_row.get("profileId") or "").strip()[:100]
        if not pid:
            continue
        days = []
        for day in raw_row.get("days") or []:
            try:
                n = int(day)
            except Exception:
                continue
            if 0 <= n <= 6 and n not in days:
                days.append(n)
        if not days:
            days = list(range(7))
        start = str(raw_row.get("start") or "00:00")[:5]
        end = str(raw_row.get("end") or "23:59")[:5]
        if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", start):
            start = "00:00"
        if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", end):
            end = "23:59"
        out["items"].append({
            "id": rid,
            "name": str(raw_row.get("name") or "Scene").strip()[:80] or "Scene",
            "endpoint": eid,
            "profileId": pid,
            "days": days,
            "start": start,
            "end": end,
            "enabled": raw_row.get("enabled") is not False,
        })
    return out


def scene_profile_lookup():
    raw = load_json_path(PROFILES_PATH, {})
    rows = raw.get("items") if isinstance(raw, dict) and isinstance(raw.get("items"), list) else []
    return {str(x.get("id")): x for x in rows if isinstance(x, dict) and x.get("id") and isinstance(x.get("config"), dict)}


def scene_rule_matches(rule, now):
    js_day = (now.weekday() + 1) % 7
    if js_day not in (rule.get("days") or []):
        return False
    def minute(value):
        h, m = str(value).split(":", 1)
        return int(h) * 60 + int(m)
    cur = now.hour * 60 + now.minute
    start = minute(rule.get("start", "00:00"))
    end = minute(rule.get("end", "23:59"))
    if start == end:
        return True
    if start < end:
        return start <= cur < end
    return cur >= start or cur < end


def choose_scene_profiles(now=None):
    now = now or datetime.datetime.now()
    store = normalize_scene_store(load_json_path(SCENES_PATH, {}))
    if not store.get("automatic", True):
        return {}, store
    chosen = dict(store.get("baseProfiles") or {})
    for rule in store.get("items") or []:
        if rule.get("enabled") and scene_rule_matches(rule, now):
            chosen[rule["endpoint"]] = rule["profileId"]
    return chosen, store


def apply_scene_schedules(force=False):
    chosen, _ = choose_scene_profiles()
    profiles = scene_profile_lookup()
    endpoints = {x.get("id") for x in endpoint_items()}
    with SCENE_LOCK:
        known = set(SCENE_ACTIVE) | set(chosen) | {p.stem for p in SCENE_BASE_DIR.glob("*.json")}
        for endpoint_id in known:
            desired = chosen.get(endpoint_id, "")
            if endpoint_id not in endpoints:
                SCENE_ACTIVE.pop(endpoint_id, None)
                continue
            previous = SCENE_ACTIVE.get(endpoint_id, "")
            if not force and previous == desired:
                continue
            base_path = SCENE_BASE_DIR / f"{endpoint_id}.json"
            if desired and not previous and not base_path.exists():
                current = load_json_path(endpoint_config_path(endpoint_id), None)
                if isinstance(current, dict):
                    atomic_write_json_file(base_path, current)
            SCENE_ACTIVE[endpoint_id] = desired
            profile = profiles.get(desired) if desired else None
            if desired and profile:
                config = json.loads(json.dumps(profile["config"]))
                config["_savedAt"] = int(time.time() * 1000)
                config["_sceneProfileId"] = desired
                atomic_write_json_file(endpoint_config_path(endpoint_id), config, endpoint_backup_path(endpoint_id))
                publish_event(endpoint_id, "config", {"savedAt": config["_savedAt"], "sceneProfileId": desired})
            elif not desired and base_path.exists():
                baseline = load_json_path(base_path, None)
                if isinstance(baseline, dict):
                    baseline["_savedAt"] = int(time.time() * 1000)
                    baseline.pop("_sceneProfileId", None)
                    atomic_write_json_file(endpoint_config_path(endpoint_id), baseline, endpoint_backup_path(endpoint_id))
                    publish_event(endpoint_id, "config", {"savedAt": baseline["_savedAt"], "sceneProfileId": ""})
                try:
                    base_path.unlink()
                except Exception:
                    pass


def scene_scheduler_loop():
    while True:
        try:
            apply_scene_schedules()
        except Exception as exc:
            print(f"LibreDisplay scene scheduler: {exc}", file=sys.stderr)
        time.sleep(15)

def broker_lock_for(key):
    with BROKER_LOCK:
        lock = BROKER_KEY_LOCKS.get(key)
        if lock is None:
            lock = threading.Lock()
            BROKER_KEY_LOCKS[key] = lock
        return lock


def broker_paths(key):
    return BROKER_DIR / f"{key}.bin", BROKER_DIR / f"{key}.json"


def broker_load(key):
    body_path, meta_path = broker_paths(key)
    try:
        if not body_path.exists() or not meta_path.exists():
            return None
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        data = body_path.read_bytes()
        if len(data) > MAX_BYTES:
            return None
        return data, str(meta.get("contentType") or "application/octet-stream"), int(meta.get("savedAt") or 0), str(meta.get("source") or "")
    except Exception:
        return None


def broker_save(key, data, content_type, source=""):
    body_path, meta_path = broker_paths(key)
    tmp_body = body_path.with_suffix('.bin.tmp')
    tmp_meta = meta_path.with_suffix('.json.tmp')
    tmp_body.write_bytes(data)
    tmp_meta.write_text(json.dumps({
        "contentType": content_type or "application/octet-stream",
        "savedAt": int(time.time()),
        "size": len(data),
        "source": str(source or "")[:300],
    }, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp_body, body_path)
    os.replace(tmp_meta, meta_path)
    try:
        bodies = [x for x in BROKER_DIR.glob("*.bin") if x.is_file()]
        total = sum(x.stat().st_size for x in bodies)
        if total > CACHE_MAX_BYTES:
            bodies.sort(key=lambda x: x.stat().st_mtime)
            for body in bodies:
                if total <= CACHE_MAX_BYTES:
                    break
                size = body.stat().st_size
                body.unlink(missing_ok=True)
                body.with_suffix(".json").unlink(missing_ok=True)
                total -= size
    except Exception:
        pass


def broker_record(key, **values):
    with BROKER_LOCK:
        row = dict(BROKER_STATUS.get(key) or {})
        row.update(values)
        BROKER_STATUS[key] = row


def broker_fetch(key, ttl_seconds, fetcher, source=""):
    ttl = max(5, min(86400, int(ttl_seconds or 300)))
    cached = broker_load(key)
    now = int(time.time())
    if cached and now - cached[2] < ttl:
        broker_record(key, source=source, status="fresh", savedAt=cached[2], age=now-cached[2], error="")
        return cached[0], cached[1], "fresh", now-cached[2]
    lock = broker_lock_for(key)
    with lock:
        cached = broker_load(key)
        now = int(time.time())
        if cached and now - cached[2] < ttl:
            broker_record(key, source=source, status="fresh", savedAt=cached[2], age=now-cached[2], error="")
            return cached[0], cached[1], "fresh", now-cached[2]
        try:
            data, content_type = fetcher()
            broker_save(key, data, content_type, source)
            broker_record(key, source=source, status="fresh", savedAt=now, age=0, error="")
            return data, content_type, "fresh", 0
        except Exception as exc:
            if cached:
                age = max(0, now-cached[2])
                broker_record(key, source=source, status="stale", savedAt=cached[2], age=age, error=str(exc)[:240])
                return cached[0], cached[1], "stale", age
            broker_record(key, source=source, status="error", savedAt=0, age=0, error=str(exc)[:240])
            raise


def publish_event(endpoint_id, event, payload=None):
    endpoint_id = endpoint_slug(endpoint_id or "main")
    message = {"event": str(event or "message")[:40], "data": payload if isinstance(payload, dict) else {}, "at": int(time.time())}
    with EVENT_LOCK:
        subscribers = list(EVENT_SUBSCRIBERS.get(endpoint_id, set()))
    for q in subscribers:
        try:
            q.put_nowait(message)
        except queue.Full:
            try:
                q.get_nowait()
            except Exception:
                pass
            try:
                q.put_nowait(message)
            except Exception:
                pass


def subscribe_events(endpoint_id):
    q = queue.Queue(maxsize=32)
    with EVENT_LOCK:
        EVENT_SUBSCRIBERS.setdefault(endpoint_id, set()).add(q)
    return q


def unsubscribe_events(endpoint_id, q):
    with EVENT_LOCK:
        rows = EVENT_SUBSCRIBERS.get(endpoint_id)
        if rows:
            rows.discard(q)
            if not rows:
                EVENT_SUBSCRIBERS.pop(endpoint_id, None)


def plugin_slug(value):
    value = re.sub(r"[^a-z0-9_-]+", "-", str(value or "").strip().lower()).strip("-")
    return value[:48]


def plugin_setting_key(value):
    # Setting keys are an API contract between a plugin manifest, saved config,
    # and plugin code. Keep their case instead of applying the plugin-id slugger.
    value = re.sub(r"[^A-Za-z0-9_-]+", "-", str(value or "").strip()).strip("-")
    return value[:64]


def clean_plugin_field(field):
    if not isinstance(field, dict):
        return None
    key = plugin_setting_key(field.get("key"))
    if not key:
        return None
    ftype = str(field.get("type") or "text").lower()
    if ftype not in {"text", "password", "url", "number", "checkbox", "select", "textarea"}:
        ftype = "text"
    row = {
        "key": key,
        "label": str(field.get("label") or key).strip()[:80],
        "type": ftype,
        "default": field.get("default"),
        "required": bool(field.get("required", False)),
        "help": str(field.get("help") or "").strip()[:240],
    }
    if ftype == "select":
        options = []
        for option in field.get("options") or []:
            if isinstance(option, dict):
                value, label = option.get("value"), option.get("label")
            elif isinstance(option, (list, tuple)) and len(option) >= 2:
                value, label = option[0], option[1]
            else:
                value = label = option
            if value is not None:
                options.append({"value": str(value)[:120], "label": str(label if label is not None else value)[:120]})
        row["options"] = options[:60]
    return row


def load_plugins():
    found = {}
    if not PLUGINS_ROOT.exists():
        return found
    for folder in sorted(PLUGINS_ROOT.iterdir()):
        if not folder.is_dir() or folder.name.startswith('.'):
            continue
        source = folder / "plugin.py"
        if not source.is_file():
            continue
        try:
            module_name = "libredisplay_plugin_" + hashlib.sha256(str(source).encode()).hexdigest()[:16]
            spec = importlib.util.spec_from_file_location(module_name, source)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            raw = getattr(module, "MANIFEST", None)
            fetcher = getattr(module, "fetch", None)
            if not isinstance(raw, dict) or not callable(fetcher):
                continue
            pid = plugin_slug(raw.get("id") or folder.name)
            if not pid or pid in found:
                continue
            api_version = int(raw.get("apiVersion") or 1)
            if api_version != PLUGIN_API_VERSION:
                raise ValueError(f"unsupported plugin API version {api_version}")
            fields = [x for x in (clean_plugin_field(v) for v in (raw.get("settings") or [])) if x]
            kind = str(raw.get("kind") or "data").strip().lower()[:32]
            category_map = {
                "tasks": "Planning", "photos": "Photos", "status": "Information",
                "messages": "Messages", "map": "Maps", "now-playing": "Media",
                "data": "Data",
            }
            field_keys = {str(x.get("key") or "") for x in fields}
            has_oauth = bool({"refreshToken", "clientId", "accessToken"} & field_keys)
            has_secret = any(x.get("type") == "password" for x in fields)
            auth = "oauth" if has_oauth else ("credential" if has_secret else "none")
            manifest = {
                "apiVersion": PLUGIN_API_VERSION,
                "id": pid,
                "name": str(raw.get("name") or pid).strip()[:80],
                "description": str(raw.get("description") or "").strip()[:240],
                "version": str(raw.get("version") or "1.0").strip()[:40],
                "icon": str(raw.get("icon") or "◇")[:8],
                "refreshMin": max(1, min(1440, int(raw.get("refreshMin") or 5))),
                "settings": fields,
                "clientScript": (folder / "client.js").is_file(),
                "kind": kind,
                "category": str(raw.get("category") or category_map.get(kind, "Other"))[:48],
                "auth": str(raw.get("auth") or auth)[:24],
                "actions": [plugin_slug(x) for x in (raw.get("actions") or []) if plugin_slug(x)][:20],
            }
            found[pid] = {"manifest": manifest, "module": module, "folder": folder}
        except Exception as exc:
            print(f"LibreDisplay plugin skipped ({folder.name}): {exc}", file=sys.stderr)
    return found


def plugin_manifests():
    with PLUGIN_LOCK:
        return [dict(row["manifest"]) for row in PLUGINS.values()]


class IntegrationContext:
    def __init__(self, endpoint_id, plugin_id):
        self.endpoint_id = endpoint_id
        self.plugin_id = plugin_id

    def fetch_bytes(self, url, *, headers=None, timeout=25, max_bytes=MAX_BYTES):
        target = str(url or "").strip()
        validate_outbound_url(target)
        status, response_headers, data, _ = safe_fetch(target, headers=headers or {"User-Agent": "LibreDisplay integration"}, timeout=timeout, max_bytes=max_bytes)
        if status >= 400:
            raise RuntimeError(f"HTTP {status}")
        return data, response_headers.get("Content-Type", "application/octet-stream")

    def fetch_text(self, url, **kwargs):
        data, _ = self.fetch_bytes(url, **kwargs)
        return data.decode("utf-8", "replace")

    def fetch_json(self, url, **kwargs):
        return json.loads(self.fetch_text(url, **kwargs))

    def request(self, url, *, method="GET", headers=None, body=None, timeout=25, max_bytes=MAX_BYTES):
        target = str(url or "").strip()
        validate_outbound_url(target)
        status, response_headers, data, final_url = safe_fetch(target, method=method, headers=headers or {"User-Agent": "LibreDisplay integration"}, body=body, timeout=timeout, max_bytes=max_bytes, redirects=0)
        if status in {301, 302, 303, 307, 308}:
            raise ValueError("Integration endpoint redirected; configure the canonical API URL")
        return status, response_headers, data, final_url

    def request_private(self, url, *, method="GET", headers=None, body=None, timeout=25, max_bytes=MAX_BYTES, verify_tls=True):
        if self.plugin_id not in TRUSTED_PRIVATE_PLUGINS:
            raise PermissionError("This integration is not allowed to access private/LAN addresses")
        target = str(url or "").strip()
        validate_trusted_outbound_url(target)
        status, response_headers, data, final_url = safe_fetch(target, method=method, headers=headers or {"User-Agent": "LibreDisplay trusted integration"}, body=body, timeout=timeout, max_bytes=max_bytes, redirects=0, allow_private=True, verify_tls=verify_tls)
        if status in {301, 302, 303, 307, 308}:
            raise ValueError("Integration endpoint redirected; configure the canonical collection URL")
        return status, response_headers, data, final_url


def load_or_create_access_tokens():
    data = {}
    try:
        if ACCESS_PATH.exists():
            loaded = json.loads(ACCESS_PATH.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                data = loaded
    except Exception:
        data = {}
    token = str(data.get("token", "")).strip()
    display_token = str(data.get("displayToken", "")).strip()
    changed = False
    if not re.fullmatch(r"[A-Za-z0-9_-]{24,128}", token):
        token = secrets.token_urlsafe(32)
        changed = True
    if not re.fullmatch(r"[A-Za-z0-9_-]{24,128}", display_token):
        display_token = secrets.token_urlsafe(32)
        changed = True
    if changed or data.get("token") != token or data.get("displayToken") != display_token:
        ACCESS_PATH.write_text(json.dumps({"token": token, "displayToken": display_token}, indent=2) + "\n", encoding="utf-8")
    try:
        os.chmod(ACCESS_PATH, 0o600)
    except Exception:
        pass
    return token, display_token


def _path_within(path, root):
    try:
        return path == root or root in path.parents
    except Exception:
        return False


def configured_media_roots():
    custom = str(os.environ.get("DASHBOARD_MEDIA_ROOTS", "")).strip()
    user = os.environ.get("USER") or Path.home().name
    raw = [x for x in custom.split(os.pathsep) if x.strip()] if custom else [
        str(Path.home() / "Pictures"),
        "/mnt/libredisplay",
        f"/media/{user}",
        str(PROJECT_ROOT / "media"),
    ]
    roots = []
    for value in raw:
        try:
            path = Path(value).expanduser().resolve()
            if path not in roots:
                roots.append(path)
        except Exception:
            pass
    return roots


MEDIA_ROOTS = configured_media_roots()
AUTH_FAILURES = {}
AUTH_FAILURE_LOCK = threading.Lock()
HOUSEHOLD_LOCK = threading.RLock()


def media_path_allowed(value, require_dir=False, require_file=False):
    try:
        path = Path(str(value or "")).expanduser().resolve(strict=True)
    except Exception:
        return None
    if not any(_path_within(path, root) for root in MEDIA_ROOTS):
        return None
    if require_dir and not path.is_dir():
        return None
    if require_file and not path.is_file():
        return None
    return path


def cookie_value(cookie_header, name):
    for part in str(cookie_header or "").split(";"):
        if "=" not in part:
            continue
        key, value = part.strip().split("=", 1)
        if key == name:
            return value.strip()
    return ""


PRIVATE_V4_NETWORKS = tuple(ipaddress.ip_network(x) for x in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
    "169.254.0.0/16", "100.64.0.0/10",
))
PRIVATE_V6_NETWORKS = tuple(ipaddress.ip_network(x) for x in ("fc00::/7", "fe80::/10"))


def private_lan_address(ip):
    if ip.is_loopback:
        return True
    networks = PRIVATE_V4_NETWORKS if ip.version == 4 else PRIVATE_V6_NETWORKS
    return any(ip in network for network in networks)


def client_network_allowed(value):
    try:
        raw = str(value or "").split("%", 1)[0]
        ip = ipaddress.ip_address(raw)
    except ValueError:
        return False
    if ip.is_loopback:
        return True
    if not remote_access_enabled():
        return False
    mode = REMOTE_NETWORKS_RAW.lower()
    if mode in {"private", "lan", "local"}:
        return private_lan_address(ip)
    for value in [x.strip() for x in REMOTE_NETWORKS_RAW.split(",") if x.strip()]:
        try:
            if ip in ipaddress.ip_network(value, strict=False):
                return True
        except ValueError:
            continue
    return False


def create_remote_session(principal=None):
    token = secrets.token_urlsafe(32)
    expires = time.time() + max(300, REMOTE_COOKIE_MAX_AGE)
    principal = dict(principal or {"username": "paired-owner", "role": "owner", "endpoints": []})
    now = time.time()
    with REMOTE_SESSION_LOCK:
        for old, row in list(REMOTE_SESSIONS.items()):
            expiry = row.get("expires", 0) if isinstance(row, dict) else row
            if expiry <= now:
                REMOTE_SESSIONS.pop(old, None)
        REMOTE_SESSIONS[token] = {"expires": expires, "principal": principal}
    return token


def endpoint_slug(value):
    value = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
    return value[:48] or "display"


ENDPOINT_LOCK = threading.Lock()


def load_endpoint_registry():
    data = {}
    try:
        if ENDPOINTS_PATH.exists():
            loaded = json.loads(ENDPOINTS_PATH.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                data = loaded
    except Exception:
        data = {}
    items = data.get("items") if isinstance(data.get("items"), list) else []
    clean = []
    seen = set()
    for raw in items:
        if not isinstance(raw, dict):
            continue
        eid = endpoint_slug(raw.get("id"))
        if eid in seen:
            continue
        token = str(raw.get("displayToken", "")).strip()
        if not re.fullmatch(r"[A-Za-z0-9_-]{24,128}", token):
            token = secrets.token_urlsafe(32)
        clean.append({"id": eid, "name": str(raw.get("name") or eid).strip()[:80] or eid, "displayToken": token})
        seen.add(eid)
    if "main" not in seen:
        clean.insert(0, {"id": "main", "name": "Main display", "displayToken": DISPLAY_TOKEN})
    save_endpoint_registry(clean)
    return clean


def save_endpoint_registry(items):
    payload = {"version": 1, "items": items}
    tmp = ENDPOINTS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    os.chmod(tmp, 0o600)
    os.replace(tmp, ENDPOINTS_PATH)


def endpoint_items():
    with ENDPOINT_LOCK:
        return [dict(x) for x in ENDPOINTS]


def endpoint_by_id(endpoint_id):
    endpoint_id = endpoint_slug(endpoint_id or "main")
    with ENDPOINT_LOCK:
        for item in ENDPOINTS:
            if item["id"] == endpoint_id:
                return dict(item)
    return None


def endpoint_config_path(endpoint_id):
    endpoint_id = endpoint_slug(endpoint_id or "main")
    if endpoint_id == "main":
        return CONFIG_PATH
    return ENDPOINT_CONFIG_DIR / f"{endpoint_id}.json"


def endpoint_backup_path(endpoint_id):
    endpoint_id = endpoint_slug(endpoint_id or "main")
    if endpoint_id == "main":
        return CONFIG_BACKUP_PATH
    return ENDPOINT_CONFIG_DIR / f"{endpoint_id}.previous.json"


def requested_endpoint(parsed):
    values = parse_qs(parsed.query).get("endpoint", []) if parsed else []
    endpoint_id = endpoint_slug(values[0] if values else "main")
    return endpoint_id if endpoint_by_id(endpoint_id) else ""


def create_display_session(endpoint_id):
    endpoint = endpoint_by_id(endpoint_id)
    if not endpoint:
        raise ValueError("Unknown display endpoint")
    expires = int(time.time()) + max(3600, DISPLAY_COOKIE_MAX_AGE)
    nonce = secrets.token_urlsafe(18)
    body = f"{endpoint['id']}.{expires}.{nonce}"
    signature = hmac.new(endpoint["displayToken"].encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def display_session_endpoint(token):
    try:
        endpoint_id, expires_raw, nonce, signature = str(token or "").split(".", 3)
        endpoint = endpoint_by_id(endpoint_id)
        expires = int(expires_raw)
        if not endpoint or expires < int(time.time()) or not nonce or len(signature) != 64:
            return ""
        body = f"{endpoint_id}.{expires}.{nonce}"
        expected = hmac.new(endpoint["displayToken"].encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()
        return endpoint_id if hmac.compare_digest(signature, expected) else ""
    except (TypeError, ValueError):
        return ""


def display_session_valid(token, endpoint_id):
    return bool(endpoint_id) and display_session_endpoint(token) == endpoint_id


def remote_session_principal(token):
    if not token:
        return None
    now = time.time()
    with REMOTE_SESSION_LOCK:
        row = REMOTE_SESSIONS.get(str(token))
        if isinstance(row, dict):
            expiry = float(row.get("expires") or 0)
            principal = row.get("principal") if isinstance(row.get("principal"), dict) else None
        else:
            expiry = float(row or 0)
            principal = {"username": "paired-owner", "role": "owner", "endpoints": []} if expiry else None
        if not expiry or expiry <= now:
            REMOTE_SESSIONS.pop(str(token), None)
            return None
        return dict(principal or {"username": "paired-owner", "role": "owner", "endpoints": []})


def remote_session_valid(token):
    return remote_session_principal(token) is not None


def clear_remote_sessions():
    with REMOTE_SESSION_LOCK:
        REMOTE_SESSIONS.clear()


def clear_remote_sessions_for_user(username):
    key = str(username or "").strip().lower()
    with REMOTE_SESSION_LOCK:
        for token, row in list(REMOTE_SESSIONS.items()):
            principal = row.get("principal") if isinstance(row, dict) and isinstance(row.get("principal"), dict) else {}
            if str(principal.get("username") or "").strip().lower() == key:
                REMOTE_SESSIONS.pop(token, None)


def remote_access_enabled():
    try:
        if REMOTE_ACCESS_PATH.exists():
            data = json.loads(REMOTE_ACCESS_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("enabled"), bool):
                return data["enabled"]
    except Exception:
        pass
    return REMOTE_DEFAULT_ENABLED


def set_remote_access_enabled(enabled):
    enabled = bool(enabled)
    REMOTE_ACCESS_PATH.write_text(json.dumps({"enabled": enabled}, indent=2) + "\n", encoding="utf-8")
    os.chmod(REMOTE_ACCESS_PATH, 0o600)
    if not enabled:
        rotate_access_tokens()
    return enabled


def resolve_public_addresses(host, port):
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    if not infos:
        raise ValueError("Remote host could not be resolved")
    found = []
    for info in infos:
        raw = info[4][0].split("%", 1)[0]
        ip = ipaddress.ip_address(raw)
        if not ip.is_global:
            raise ValueError("Remote URL resolves to a local/private address")
        value = str(ip)
        if value not in found:
            found.append(value)
    return found


def validate_outbound_url(target):
    u = urlparse(str(target or ""))
    if u.scheme not in ("http", "https") or not u.hostname:
        raise ValueError("Only http/https URLs are allowed")
    if u.username is not None or u.password is not None:
        raise ValueError("Credentials in remote URLs are not allowed")
    try:
        port = u.port or (443 if u.scheme == "https" else 80)
    except ValueError as exc:
        raise ValueError("Invalid remote port") from exc
    if not 1 <= port <= 65535:
        raise ValueError("Invalid remote port")
    addresses = resolve_public_addresses(u.hostname, port)
    return u, port, addresses


def resolve_trusted_addresses(host, port):
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    if not infos:
        raise ValueError("Remote host could not be resolved")
    found = []
    for info in infos:
        raw = info[4][0].split("%", 1)[0]
        ip = ipaddress.ip_address(raw)
        if ip.is_unspecified or ip.is_multicast or ip.is_link_local or ip.is_reserved:
            raise ValueError("Remote URL resolves to an unsafe address")
        value = str(ip)
        if value not in found:
            found.append(value)
    return found


def validate_trusted_outbound_url(target):
    u = urlparse(str(target or ""))
    if u.scheme not in ("http", "https") or not u.hostname:
        raise ValueError("Only http/https URLs are allowed")
    if u.username is not None or u.password is not None:
        raise ValueError("Credentials in remote URLs are not allowed")
    try:
        port = u.port or (443 if u.scheme == "https" else 80)
    except ValueError as exc:
        raise ValueError("Invalid remote port") from exc
    if not 1 <= port <= 65535:
        raise ValueError("Invalid remote port")
    return u, port, resolve_trusted_addresses(u.hostname, port)


class PinnedHTTPConnection(http.client.HTTPConnection):
    def __init__(self, host, port, pinned_ip, timeout=25):
        self._pinned_ip = pinned_ip
        super().__init__(host, port=port, timeout=timeout)

    def connect(self):
        self.sock = socket.create_connection((self._pinned_ip, self.port), self.timeout, self.source_address)


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, port, pinned_ip, timeout=25, verify_tls=True):
        self._pinned_ip = pinned_ip
        context = ssl.create_default_context() if verify_tls else ssl._create_unverified_context()
        super().__init__(host, port=port, timeout=timeout, context=context)

    def connect(self):
        sock = socket.create_connection((self._pinned_ip, self.port), self.timeout, self.source_address)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def safe_fetch(target, method="GET", headers=None, body=None, timeout=25, max_bytes=MAX_BYTES, redirects=5, allow_private=False, verify_tls=True):
    current = str(target or "").strip()
    current_method = str(method or "GET").upper()
    current_body = body
    for _ in range(redirects + 1):
        u, port, addresses = validate_trusted_outbound_url(current) if allow_private else validate_outbound_url(current)
        path = u.path or "/"
        if u.query:
            path += "?" + u.query
        last_error = None
        response = None
        conn = None
        for ip in addresses:
            try:
                cls = PinnedHTTPSConnection if u.scheme == "https" else PinnedHTTPConnection
                if cls is PinnedHTTPSConnection:
                    conn = cls(u.hostname, port, ip, timeout=timeout, verify_tls=verify_tls)
                else:
                    conn = cls(u.hostname, port, ip, timeout=timeout)
                req_headers = dict(headers or {})
                host_for_header = u.hostname
                if ":" in host_for_header and not host_for_header.startswith("["):
                    host_for_header = f"[{host_for_header}]"
                is_default_port = (u.scheme == "http" and port == 80) or (u.scheme == "https" and port == 443)
                req_headers.setdefault("Host", host_for_header if is_default_port else f"{host_for_header}:{port}")
                conn.request(current_method, path, body=current_body, headers=req_headers)
                response = conn.getresponse()
                break
            except (OSError, ssl.SSLError, http.client.HTTPException) as exc:
                last_error = exc
                try:
                    if conn:
                        conn.close()
                except Exception:
                    pass
                conn = None
        if response is None:
            raise OSError(f"Could not connect to validated remote address: {last_error}")
        status = int(response.status)
        response_headers = {k: v for k, v in response.getheaders()}
        if status in {301, 302, 303, 307, 308}:
            location = response.getheader("Location")
            if redirects <= 0:
                response.read(min(4096, max_bytes))
                conn.close()
                return status, response_headers, b"", current
            response.read(4096)
            conn.close()
            if not location:
                return status, response_headers, b"", current
            next_url = urljoin(current, location)
            if urlparse(current).scheme == "https" and urlparse(next_url).scheme == "http":
                raise ValueError("HTTPS redirects to HTTP are not allowed")
            current = next_url
            if status in {301, 302, 303} and current_method != "HEAD":
                current_method = "GET"
                current_body = None
            continue
        raw_length = response.getheader("Content-Length")
        if raw_length:
            try:
                if int(raw_length) > max_bytes:
                    conn.close()
                    raise OverflowError("Remote response is too large")
            except ValueError:
                pass
        data = response.read(max_bytes + 1)
        conn.close()
        if len(data) > max_bytes:
            raise OverflowError("Remote response is too large")
        return status, response_headers, data, current
    raise ValueError("Too many remote redirects")


def semantic_version_tuple(value):
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", str(value or "").strip())
    if not match:
        return None
    return tuple(int(part) for part in match.groups())


def update_deployment_mode():
    if Path("/.dockerenv").exists():
        return "docker"
    command = Path("/usr/local/bin/libredisplay")
    if (DATA_ROOT / ".installed").exists() and command.is_file():
        return "native"
    return "source"


def update_status_deployment_fields():
    mode = update_deployment_mode()
    return {
        "deployment": mode,
        "updateCommand": "libredisplay update" if mode == "native" else "",
    }


def github_update_status(force=False):
    now = int(time.time())
    with UPDATE_CHECK_LOCK:
        cached = dict(UPDATE_CHECK_CACHE) if UPDATE_CHECK_CACHE else None
        cache_age = now - int((cached or {}).get("checkedAt") or 0)
        if cached and ((not force and cache_age < UPDATE_CHECK_TTL_SECONDS) or (force and cache_age < 60)):
            return cached
    try:
        status, _, data, _ = safe_fetch(
            GITHUB_RELEASE_API,
            headers={
                "User-Agent": f"LibreDisplay/{APP_VERSION} update-check",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=10,
            max_bytes=256 * 1024,
        )
        if status != 200:
            raise RuntimeError(f"GitHub returned HTTP {status}")
        payload = json.loads(data.decode("utf-8"))
        latest = str(payload.get("tag_name") or "").strip().lstrip("v")
        current_tuple = semantic_version_tuple(APP_VERSION)
        latest_tuple = semantic_version_tuple(latest)
        if current_tuple is None or latest_tuple is None:
            raise ValueError("Invalid release version returned by GitHub")
        result = {
            "ok": True,
            "currentVersion": APP_VERSION,
            "latestVersion": latest,
            "updateAvailable": latest_tuple > current_tuple,
            "checkedAt": now,
            "source": "github",
            "stale": False,
            **update_status_deployment_fields(),
        }
        with UPDATE_CHECK_LOCK:
            UPDATE_CHECK_CACHE.clear()
            UPDATE_CHECK_CACHE.update(result)
        return result
    except Exception:
        if cached and cached.get("ok"):
            cached["stale"] = True
            cached["error"] = "GitHub update check is temporarily unavailable."
            return cached
        return {
            "ok": False,
            "currentVersion": APP_VERSION,
            "latestVersion": "",
            "updateAvailable": False,
            "checkedAt": now,
            "source": "github",
            "stale": False,
            "error": "GitHub update check is temporarily unavailable.",
            **update_status_deployment_fields(),
        }


ALLOWED_BROKER_TYPES = {
    "application/json", "application/geo+json", "application/xml",
    "application/rss+xml", "application/atom+xml", "application/octet-stream",
    "text/plain", "text/calendar", "text/xml",
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/bmp",
}


def broker_request_headers(target):
    u = urlparse(target)
    host = (u.hostname or "").lower()
    if host == "api.weather.gov":
        return {"User-Agent": f"LibreDisplay/{APP_VERSION} (local personal weather display)", "Accept": "application/geo+json, application/json;q=0.9, */*;q=0.8", "Accept-Language": "en-US,en;q=0.9"}
    if host == "sourcesplash.com" or host.endswith(".sourcesplash.com"):
        return {"User-Agent": f"LibreDisplay/{APP_VERSION} (self-hosted background display)", "Accept": "application/json, image/*;q=0.9, */*;q=0.8", "Accept-Language": "en-US,en;q=0.9"}
    if host == "open-meteo.com" or host.endswith(".open-meteo.com"):
        return {"User-Agent": f"LibreDisplay/{APP_VERSION} (self-hosted weather display)", "Accept": "application/json, */*;q=0.8", "Accept-Language": "en-US,en;q=0.9"}
    return {"User-Agent": f"LibreDisplay/{APP_VERSION}", "Accept": "text/calendar, text/plain;q=0.9, image/*;q=0.8, application/json;q=0.8, application/xml;q=0.7, */*;q=0.5", "Accept-Language": "en-US,en;q=0.9"}


def broker_remote_url(target, ttl_seconds=300):
    target = str(target or "").replace("\\&", "&").replace("&amp;", "&").replace("&#38;", "&").replace("&#x26;", "&")
    target = re.sub(r"[\u200B-\u200D\uFEFF]", "", target).strip()
    validate_outbound_url(target)
    key = hashlib.sha256(("remote\n" + target).encode("utf-8", "replace")).hexdigest()
    def fetcher():
        status, response_headers, data, _ = safe_fetch(target, headers=broker_request_headers(target), timeout=25, max_bytes=MAX_BYTES)
        if status >= 400:
            raise RuntimeError(f"Remote server returned HTTP {status}")
        content_type = response_headers.get("Content-Type", "application/octet-stream")
        base_type = content_type.split(";", 1)[0].strip().lower()
        if base_type not in ALLOWED_BROKER_TYPES:
            raise ValueError("Remote content type is not allowed by the LibreDisplay data broker")
        return data, content_type
    return broker_fetch(key, ttl_seconds, fetcher, target)


def integration_block_for(endpoint_id, block_id):
    try:
        path = endpoint_config_path(endpoint_id)
        data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    except Exception:
        data = {}
    for block in data.get("customBlocks") or []:
        if isinstance(block, dict) and str(block.get("id")) == str(block_id) and block.get("type") == "integration":
            return block
    return None


def integration_payload(endpoint_id, block_id):
    block = integration_block_for(endpoint_id, block_id)
    if not block:
        raise ValueError("Integration block is not configured for this display")
    config = block.get("config") if isinstance(block.get("config"), dict) else {}
    plugin_id = plugin_slug(config.get("plugin"))
    with PLUGIN_LOCK:
        plugin = PLUGINS.get(plugin_id)
    if not plugin:
        raise ValueError("Integration plugin is not installed")
    manifest = plugin["manifest"]
    clean_settings = integration_clean_settings(block, plugin)
    refresh = max(1, min(1440, int(config.get("refreshMin") or manifest.get("refreshMin") or 5)))
    cache_key = integration_cache_key(plugin_id, clean_settings)
    def fetcher():
        result = plugin["module"].fetch(clean_settings, IntegrationContext(endpoint_id, plugin_id))
        body = json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(body) > MAX_STATE_BYTES:
            raise OverflowError("Integration result is too large")
        return body, "application/json; charset=utf-8"
    data, content_type, state, age = broker_fetch(cache_key, refresh * 60, fetcher, f"plugin:{plugin_id}")
    return data, content_type, state, age, manifest


def integration_clean_settings(block, plugin):
    config = block.get("config") if isinstance(block.get("config"), dict) else {}
    manifest = plugin["manifest"]
    settings = config.get("settings") if isinstance(config.get("settings"), dict) else {}
    clean_settings = {}
    for field in manifest.get("settings") or []:
        key = field["key"]
        # Accept normalized setting keys while returning the canonical manifest key.
        if key in settings:
            value = settings[key]
        else:
            normalized_key = key.lower()
            value = settings.get(normalized_key, field.get("default"))
        if field.get("type") == "checkbox":
            value = bool(value)
        elif field.get("type") == "number":
            try: value = float(value)
            except Exception: value = field.get("default")
        else:
            value = str(value or "")[:4096]
        if field.get("required") and (value is None or value == ""):
            raise ValueError(f"Missing required setting: {field.get('label') or key}")
        clean_settings[key] = value
    return clean_settings


def integration_cache_key(plugin_id, settings):
    cache_material = json.dumps({"plugin": plugin_id, "settings": settings}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(("integration\n" + cache_material).encode("utf-8", "replace")).hexdigest()


def invalidate_broker_key(key):
    data_path, meta_path = broker_paths(key)
    data_path.unlink(missing_ok=True)
    meta_path.unlink(missing_ok=True)
    with BROKER_LOCK:
        BROKER_STATUS.pop(key, None)


def integration_status_rows(endpoint_id):
    """Return display-safe integration health without exposing saved credentials."""
    try:
        data = json.loads(endpoint_config_path(endpoint_id).read_text(encoding="utf-8"))
    except Exception:
        data = {}
    rows = []
    for block in data.get("customBlocks") or []:
        if not isinstance(block, dict) or block.get("type") != "integration":
            continue
        config = block.get("config") if isinstance(block.get("config"), dict) else {}
        plugin_id = plugin_slug(config.get("plugin"))
        with PLUGIN_LOCK:
            plugin = PLUGINS.get(plugin_id)
        manifest = plugin.get("manifest") if plugin else None
        row = {
            "blockId": str(block.get("id") or "")[:100],
            "name": str(block.get("name") or (manifest or {}).get("name") or plugin_id or "Integration")[:100],
            "pluginId": plugin_id,
            "pluginName": str((manifest or {}).get("name") or plugin_id)[:100],
            "category": str((manifest or {}).get("category") or "Other")[:48],
            "configured": False,
            "status": "unconfigured",
            "age": 0,
            "savedAt": 0,
            "error": "",
        }
        if not plugin:
            row.update(status="missing", error="Integration plugin is not installed")
            rows.append(row)
            continue
        try:
            clean = integration_clean_settings(block, plugin)
            key = integration_cache_key(plugin_id, clean)
            row["configured"] = True
            with BROKER_LOCK:
                state = dict(BROKER_STATUS.get(key) or {})
            if state:
                row.update(
                    status=str(state.get("status") or "ready")[:24],
                    age=max(0, int(state.get("age") or 0)),
                    savedAt=max(0, int(state.get("savedAt") or 0)),
                    error=str(state.get("error") or "")[:240],
                )
            else:
                cached = broker_load(key)
                if cached:
                    saved_at = max(0, int(cached[2] or 0))
                    row.update(status="cached", savedAt=saved_at, age=max(0, int(time.time()) - saved_at))
                else:
                    row["status"] = "ready"
        except Exception as exc:
            row.update(status="unconfigured", error=str(exc)[:240])
        rows.append(row)
    return rows[:200]


def integration_action(endpoint_id, block_id, action_name, payload):
    block = integration_block_for(endpoint_id, block_id)
    if not block:
        raise ValueError("Integration block is not configured for this display")
    config = block.get("config") if isinstance(block.get("config"), dict) else {}
    plugin_id = plugin_slug(config.get("plugin"))
    with PLUGIN_LOCK:
        plugin = PLUGINS.get(plugin_id)
    if not plugin:
        raise ValueError("Integration plugin is not installed")
    action_name = plugin_slug(action_name)
    if action_name not in (plugin["manifest"].get("actions") or []):
        raise ValueError("That integration action is not supported")
    handler = getattr(plugin["module"], "action", None)
    if not callable(handler):
        raise ValueError("Integration action handler is unavailable")
    clean_settings = integration_clean_settings(block, plugin)
    result = handler(clean_settings, IntegrationContext(endpoint_id, plugin_id), action_name, payload if isinstance(payload, dict) else {})
    invalidate_broker_key(integration_cache_key(plugin_id, clean_settings))
    return result if isinstance(result, dict) else {"result": result}



PLUGINS = load_plugins()


def rotate_access_tokens():
    global ACCESS_TOKEN, DISPLAY_TOKEN, ENDPOINTS
    token = secrets.token_urlsafe(32)
    display_token = secrets.token_urlsafe(32)
    ACCESS_PATH.write_text(json.dumps({"token": token, "displayToken": display_token}, indent=2) + "\n", encoding="utf-8")
    os.chmod(ACCESS_PATH, 0o600)
    with ENDPOINT_LOCK:
        updated = []
        for item in ENDPOINTS:
            row = dict(item)
            row["displayToken"] = display_token if row["id"] == "main" else secrets.token_urlsafe(32)
            updated.append(row)
        ENDPOINTS = updated
        save_endpoint_registry(ENDPOINTS)
    clear_remote_sessions()
    for row in endpoint_items():
        publish_event(row["id"], "reauth", {"reason": "credentials-rotated"})
    ACCESS_TOKEN = token
    DISPLAY_TOKEN = display_token
    return token, display_token


def normalized_host_header(value):
    raw = str(value or "").strip()
    if not raw:
        return ""
    try:
        host = urlparse("//" + raw).hostname or ""
    except Exception:
        return ""
    return host.rstrip(".").lower()


def allowed_request_hosts():
    allowed = {"localhost"}
    for name in (socket.gethostname(), socket.getfqdn()):
        name = str(name or "").strip().rstrip(".").lower()
        if name:
            allowed.add(name)
    for value in [x.strip() for x in ALLOWED_HOSTS_RAW.split(",") if x.strip()]:
        host = normalized_host_header(value) if ":" in value else value.rstrip(".").lower()
        if host:
            allowed.add(host)
    return allowed


def local_ipv4_addresses():
    found = []

    def add(value, first=False):
        try:
            addr = ipaddress.ip_address(str(value or "").strip())
        except ValueError:
            return
        if addr.version != 4 or addr.is_loopback or addr.is_unspecified or addr.is_multicast:
            return
        if not private_lan_address(addr):
            return
        text = str(addr)
        if text in found:
            return
        if first:
            found.insert(0, text)
        else:
            found.append(text)

    # Enumerate configured interfaces when the host provides the `ip` utility.
    # This also picks up private VPN addresses such as WireGuard/Tailscale.
    try:
        result = subprocess.run(
            ["ip", "-o", "-4", "addr", "show"],
            capture_output=True, text=True, timeout=3, check=False,
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                parts = line.split()
                if "inet" in parts:
                    idx = parts.index("inet")
                    if idx + 1 < len(parts):
                        add(parts[idx + 1].split("/", 1)[0])
    except Exception:
        pass

    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            add(info[4][0])
    except Exception:
        pass

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        add(s.getsockname()[0], first=True)
        s.close()
    except Exception:
        pass
    return found


ACCESS_TOKEN, DISPLAY_TOKEN = load_or_create_access_tokens()
ENDPOINTS = load_endpoint_registry()
_main_endpoint = next((x for x in ENDPOINTS if x.get("id") == "main"), None)
if _main_endpoint and _main_endpoint.get("displayToken") != DISPLAY_TOKEN:
    DISPLAY_TOKEN = _main_endpoint["displayToken"]
    ACCESS_PATH.write_text(json.dumps({"token": ACCESS_TOKEN, "displayToken": DISPLAY_TOKEN}, indent=2) + "\n", encoding="utf-8")
    os.chmod(ACCESS_PATH, 0o600)
CACHE_DIR.mkdir(parents=True, exist_ok=True)
try:
    os.chmod(CACHE_DIR, 0o700)
except Exception:
    pass


class DashboardHandler(BaseHTTPRequestHandler):
    server_version = "LibreDisplay"
    sys_version = ""

    def setup(self):
        super().setup()
        try:
            self.request.settimeout(30)
        except Exception:
            pass

    def log_message(self, fmt, *args):
        try:
            message = fmt % args
        except Exception:
            message = str(fmt)
        message = re.sub(r'(\"(?:GET|POST|HEAD|OPTIONS|PUT|DELETE|PATCH) [^ ?\"]+)\?[^ ]+ ', r'\1?[REDACTED] ', message)
        message = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]", "?", message)
        sys.stderr.write(f"{self.address_string()} - - [{self.log_date_time_string()}] {message}\n")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http: https:; connect-src 'self' https:; font-src 'self' data:; frame-src http: https:; media-src 'self' data: blob: http: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("X-DNS-Prefetch-Control", "off")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("X-Permitted-Cross-Domain-Policies", "none")
        super().end_headers()

    def json_response(self, status, payload, extra_headers=None):
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        for k, v in (extra_headers or {}).items():
            self.send_header(k, str(v))
        self.end_headers()
        self.wfile.write(data)

    def text_response(self, status, message, extra_headers=None):
        data = str(message).encode("utf-8", "replace")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        for k, v in (extra_headers or {}).items():
            self.send_header(k, str(v))
        self.end_headers()
        self.wfile.write(data)

    def bytes_response(self, status, data, content_type, extra_headers=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        for k, v in (extra_headers or {}).items():
            self.send_header(k, str(v))
        self.end_headers()
        self.wfile.write(data)

    def request_host_allowed(self):
        host = normalized_host_header(self.headers.get("Host", ""))
        if not host:
            return False
        try:
            ip = ipaddress.ip_address(host.split("%", 1)[0])
            return private_lan_address(ip)
        except ValueError:
            return host in allowed_request_hosts()

    def proxy_headers_present(self):
        return any(self.headers.get(name) for name in ("Forwarded", "X-Forwarded-For", "X-Real-IP"))

    def client_is_loopback(self):
        if self.proxy_headers_present():
            return False
        ip = str(self.client_address[0] or "")
        socket_loopback = ip in ("127.0.0.1", "::1") or ip.startswith("127.")
        if not socket_loopback:
            return False
        host = normalized_host_header(self.headers.get("Host", ""))
        if host == "localhost":
            return True
        try:
            return ipaddress.ip_address(host.split("%", 1)[0]).is_loopback
        except ValueError:
            return False

    def client_network_allowed(self):
        if self.proxy_headers_present():
            return False
        ip = str(self.client_address[0] or "")
        socket_loopback = ip in ("127.0.0.1", "::1") or ip.startswith("127.")
        if socket_loopback and not self.client_is_loopback():
            return remote_access_enabled()
        return client_network_allowed(ip)

    def pairing_token(self, parsed):
        return str(parse_qs(parsed.query).get("access", [""])[0] or "")

    def session_principal(self):
        if self.client_is_loopback():
            return {"username": "local-display", "role": "owner", "endpoints": []}
        if not self.client_network_allowed():
            return None
        token = cookie_value(self.headers.get("Cookie", ""), REMOTE_COOKIE_NAME)
        return remote_session_principal(token)

    def authorized(self, parsed=None):
        endpoint_id = requested_endpoint(parsed or urlparse(self.path)) or "main"
        return principal_allows_endpoint(self.session_principal(), endpoint_id, write=True)

    def owner_authorized(self):
        principal = self.session_principal()
        return bool(principal and str(principal.get("role") or "").lower() == "owner")

    def display_authorized(self, parsed=None):
        endpoint_id = requested_endpoint(parsed or urlparse(self.path))
        principal = self.session_principal()
        if endpoint_id and principal_allows_endpoint(principal, endpoint_id, write=False):
            return True
        if not self.client_network_allowed() or not endpoint_id:
            return False
        token = cookie_value(self.headers.get("Cookie", ""), DISPLAY_COOKIE_NAME)
        return display_session_valid(token, endpoint_id)

    def require_display_authorized(self, parsed):
        if not self.client_network_allowed():
            self.json_response(403, {"ok": False, "error": "Display access is limited to private/LAN/VPN clients by default."})
            return False
        if self.display_authorized(parsed):
            return True
        self.json_response(403, {"ok": False, "error": "A paired admin session or read-only display link is required."})
        return False

    def auth_rate_limited(self):
        if self.client_is_loopback():
            return False
        ip = str(self.client_address[0] or "")
        now = time.time()
        with AUTH_FAILURE_LOCK:
            recent = [t for t in AUTH_FAILURES.get(ip, []) if now - t < 60]
            AUTH_FAILURES[ip] = recent
            return len(recent) >= 12

    def note_auth_failure(self):
        if self.client_is_loopback():
            return
        ip = str(self.client_address[0] or "")
        now = time.time()
        with AUTH_FAILURE_LOCK:
            recent = [t for t in AUTH_FAILURES.get(ip, []) if now - t < 60]
            recent.append(now)
            AUTH_FAILURES[ip] = recent[-20:]

    def require_owner(self):
        if not self.client_network_allowed():
            self.json_response(403, {"ok": False, "error": "Remote management is limited to private/LAN/VPN clients by default."})
            return False
        if self.owner_authorized():
            return True
        self.json_response(403, {"ok": False, "error": "Owner access is required."})
        return False

    def require_authorized(self, parsed):
        if not self.client_network_allowed():
            self.json_response(403, {"ok": False, "error": "Remote management is limited to private/LAN/VPN clients by default."})
            return False
        if self.auth_rate_limited():
            self.json_response(429, {"ok": False, "error": "Too many failed remote access attempts. Try again shortly."})
            return False
        if self.authorized(parsed):
            return True
        self.note_auth_failure()
        self.json_response(403, {"ok": False, "error": "A paired remote session is required. Open a fresh pairing link from the local dashboard."})
        return False

    def post_origin_ok(self):
        origin = str(self.headers.get("Origin", "")).strip()
        if not origin:
            return self.client_is_loopback()
        try:
            return urlparse(origin).netloc.lower() == str(self.headers.get("Host", "")).lower()
        except Exception:
            return False

    def read_json_body(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Invalid Content-Length")
        if length <= 0 or length > MAX_STATE_BYTES:
            raise ValueError("Request body is missing or too large")
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception as exc:
            raise ValueError(f"Invalid JSON: {exc}") from exc

    @staticmethod
    def load_json_file(path, fallback=None):
        if not path.exists():
            return fallback
        try:
            with path.open("r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:
            return fallback

    @staticmethod
    def atomic_write_json(path, payload, backup_path=None):
        atomic_write_json_file(path, payload, backup_path)

    @staticmethod
    def cache_key(namespace, value):
        return hashlib.sha256((namespace + "\n" + value).encode("utf-8", "replace")).hexdigest()

    @staticmethod
    def cache_paths(key):
        return CACHE_DIR / f"{key}.bin", CACHE_DIR / f"{key}.json"

    def save_cache(self, key, data, content_type, source=""):
        try:
            body_path, meta_path = self.cache_paths(key)
            tmp_body = body_path.with_suffix(".bin.tmp")
            tmp_meta = meta_path.with_suffix(".json.tmp")
            tmp_body.write_bytes(data)
            tmp_meta.write_text(json.dumps({
                "contentType": content_type or "application/octet-stream",
                "savedAt": int(time.time()),
                "size": len(data),
            }, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp_body, body_path)
            os.replace(tmp_meta, meta_path)
            self.prune_cache()
        except Exception:
            pass

    def prune_cache(self):
        try:
            bodies = [p for p in CACHE_DIR.glob("*.bin") if p.is_file()]
            total = sum(p.stat().st_size for p in bodies)
            if total <= CACHE_MAX_BYTES:
                return
            bodies.sort(key=lambda p: p.stat().st_mtime)
            for body in bodies:
                if total <= CACHE_MAX_BYTES:
                    break
                size = body.stat().st_size
                meta = body.with_suffix(".json")
                body.unlink(missing_ok=True)
                meta.unlink(missing_ok=True)
                total -= size
        except Exception:
            pass

    def load_cache(self, key):
        try:
            body_path, meta_path = self.cache_paths(key)
            if not body_path.exists() or not meta_path.exists():
                return None
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            data = body_path.read_bytes()
            if len(data) > MAX_BYTES:
                return None
            return data, str(meta.get("contentType") or "application/octet-stream"), int(meta.get("savedAt") or 0)
        except Exception:
            return None

    def serve_cached(self, key, reason="upstream unavailable"):
        cached = self.load_cache(key)
        if not cached:
            return False
        data, content_type, saved_at = cached
        age = max(0, int(time.time()) - saved_at)
        self.bytes_response(200, data, content_type, {
            "X-LibreDisplay-Cache": "stale",
            "X-LibreDisplay-Cache-Age": str(age),
            "X-LibreDisplay-Cache-Reason": reason[:160],
        })
        return True

    def media_roots_payload(self):
        out = []
        for root in MEDIA_ROOTS:
            try:
                if root.exists() and root.is_dir():
                    out.append(str(root))
            except Exception:
                pass
        return out

    def handle_media_browse(self, parsed):
        requested = parse_qs(parsed.query).get("path", [""])[0].strip()
        roots = self.media_roots_payload()
        if not requested:
            requested = roots[0] if roots else ""
        path = media_path_allowed(requested, require_dir=True) if requested else None
        if not path:
            return self.json_response(400, {"ok": False, "error": "Folder is outside the allowed media roots or is not available.", "roots": roots})
        dirs = []
        try:
            for child in path.iterdir():
                try:
                    if child.name.startswith(".") or not child.is_dir():
                        continue
                    resolved = child.resolve()
                    if any(_path_within(resolved, root) for root in MEDIA_ROOTS):
                        dirs.append({"name": child.name, "path": str(resolved)})
                except Exception:
                    continue
        except PermissionError:
            return self.json_response(403, {"ok": False, "error": "This folder is not readable by the dashboard service."})
        dirs.sort(key=lambda x: x["name"].lower())
        parent = path.parent.resolve()
        parent_value = str(parent) if parent != path and any(_path_within(parent, root) for root in MEDIA_ROOTS) else ""
        return self.json_response(200, {"ok": True, "path": str(path), "parent": parent_value, "directories": dirs[:500], "roots": roots})

    def endpoint_config(self, parsed):
        endpoint_id = requested_endpoint(parsed)
        if not endpoint_id:
            return {}, ""
        config = self.load_json_file(endpoint_config_path(endpoint_id))
        return (config if isinstance(config, dict) else {}), endpoint_id

    def display_media_path(self, value, parsed, require_dir=False, require_file=False):
        path = media_path_allowed(value, require_dir=require_dir, require_file=require_file)
        if not path:
            return None
        if self.authorized(parsed):
            return path
        config, endpoint_id = self.endpoint_config(parsed)
        if not endpoint_id:
            return None
        allowed = []
        for raw in config.get("mediaFolders", []) if isinstance(config.get("mediaFolders"), list) else []:
            root = media_path_allowed(raw, require_dir=True)
            if root:
                allowed.append(root)
        return path if any(_path_within(path, root) for root in allowed) else None

    def calendar_file_allowed_for_display(self, filename, parsed):
        if self.authorized(parsed):
            return True
        config, endpoint_id = self.endpoint_config(parsed)
        if not endpoint_id:
            return False
        target = f"/calendar-files/{filename}"
        for item in config.get("calendars", []) if isinstance(config.get("calendars"), list) else []:
            if isinstance(item, dict) and str(item.get("url") or "") == target:
                return True
        return False

    def handle_media_scan(self, parsed):
        try:
            body = self.read_json_body()
            paths = body.get("paths", []) if isinstance(body, dict) else []
            recursive = bool(body.get("recursive", True)) if isinstance(body, dict) else True
            if not isinstance(paths, list) or not paths:
                raise ValueError("Add at least one local or mounted network folder")
            paths = [str(x).strip() for x in paths if str(x).strip()][:32]
            if not paths:
                raise ValueError("Add at least one local or mounted network folder")
            images = []
            counts = []
            seen = set()
            for value in paths:
                folder = self.display_media_path(value, parsed, require_dir=True)
                if not folder:
                    counts.append({"path": value, "count": 0, "error": "Folder unavailable or outside allowed media roots"})
                    continue
                count = 0
                try:
                    iterator = folder.rglob("*") if recursive else folder.iterdir()
                    for item in iterator:
                        if len(images) >= MAX_MEDIA_ITEMS:
                            break
                        try:
                            if not item.is_file() or item.suffix.lower() not in IMAGE_EXTENSIONS:
                                continue
                            resolved = item.resolve()
                            if not _path_within(resolved, folder) or resolved in seen:
                                continue
                            seen.add(resolved)
                            images.append({
                                "path": str(resolved),
                                "name": item.name,
                                "source": str(folder),
                                "url": "/media?path=" + quote(str(resolved), safe="") + "&endpoint=" + quote(requested_endpoint(parsed) or "main"),
                            })
                            count += 1
                        except Exception:
                            continue
                except Exception as exc:
                    counts.append({"path": str(folder), "count": count, "error": str(exc)[:160]})
                    continue
                counts.append({"path": str(folder), "count": count})
                if len(images) >= MAX_MEDIA_ITEMS:
                    break
            return self.json_response(200, {
                "ok": True,
                "images": images,
                "sources": counts,
                "total": len(images),
                "limitReached": len(images) >= MAX_MEDIA_ITEMS,
                "recursive": recursive,
            })
        except ValueError as exc:
            return self.json_response(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            return self.json_response(500, {"ok": False, "error": f"Could not scan media folders: {exc}"})

    def handle_media_file(self, parsed):
        value = parse_qs(parsed.query).get("path", [""])[0]
        path = self.display_media_path(value, parsed, require_file=True)
        if not path or path.suffix.lower() not in IMAGE_EXTENSIONS:
            return self.text_response(404, "Image not found or not allowed")
        try:
            size = path.stat().st_size
            if size < 0 or size > MAX_MEDIA_FILE_BYTES:
                return self.text_response(413, "Image file is too large")
            content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(size))
            self.send_header("Content-Disposition", "inline")
            self.end_headers()
            with path.open("rb") as fh:
                shutil.copyfileobj(fh, self.wfile, length=256 * 1024)
        except BrokenPipeError:
            pass
        except Exception as exc:
            self.text_response(500, f"Could not read image: {exc}")

    def serve_dashboard(self):
        try:
            data = (ROOT / "dashboard.html").read_bytes()
        except Exception:
            return self.text_response(500, "Dashboard UI is unavailable")
        return self.bytes_response(200, data, "text/html; charset=utf-8")

    def handle_qr(self, parsed):
        value = parse_qs(parsed.query).get("text", [""])[0]
        value = str(value or "")
        if not value or len(value) > 2048:
            return self.text_response(400, "QR text must be between 1 and 2048 characters")
        binary = shutil.which("qrencode")
        if not binary:
            return self.text_response(503, "Local QR support is not installed")
        try:
            proc = subprocess.run(
                [binary, "-o", "-", "-t", "PNG", "-s", "6", "-m", "2"],
                input=value.encode("utf-8"),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5,
                check=False,
            )
            if proc.returncode != 0 or not proc.stdout:
                return self.text_response(400, "Could not generate QR code")
            return self.bytes_response(200, proc.stdout, "image/png")
        except subprocess.TimeoutExpired:
            return self.text_response(504, "QR generation timed out")
        except Exception:
            return self.text_response(500, "Could not generate QR code")


    def handle_events(self, parsed):
        if not self.require_display_authorized(parsed):
            return
        endpoint_id = requested_endpoint(parsed)
        if not endpoint_id:
            return self.json_response(404, {"ok": False, "error": "Unknown display endpoint"})
        q = subscribe_events(endpoint_id)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()
            self.wfile.write(b": LibreDisplay live connection\n\n")
            self.wfile.flush()
            started = time.time()
            while time.time() - started < 55:
                try:
                    message = q.get(timeout=12)
                    payload = json.dumps(message.get("data") or {}, ensure_ascii=False, separators=(",", ":"))
                    chunk = f"event: {message.get('event') or 'message'}\ndata: {payload}\n\n".encode("utf-8")
                except queue.Empty:
                    chunk = b": keepalive\n\n"
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, TimeoutError, OSError):
            pass
        finally:
            unsubscribe_events(endpoint_id, q)

    def handle_broker(self, parsed):
        if not self.require_display_authorized(parsed):
            return
        qs = parse_qs(parsed.query)
        target = str(qs.get("url", [""])[0] or "").strip()
        if not target:
            return self.text_response(400, "Missing url")
        try:
            ttl = max(5, min(86400, int(qs.get("ttl", ["300"])[0] or 300)))
            data, content_type, state, age = broker_remote_url(target, ttl)
            return self.bytes_response(200, data, content_type, {
                "X-LibreDisplay-Broker": state,
                "X-LibreDisplay-Broker-Age": str(age),
                "X-LibreDisplay-Cache": "stale" if state == "stale" else "fresh",
            })
        except OverflowError:
            return self.text_response(413, "Remote response is too large")
        except ValueError as exc:
            return self.text_response(403, str(exc))
        except Exception as exc:
            return self.text_response(502, f"Data broker could not fetch the source: {exc}")

    def handle_calendar_source(self, parsed):
        if not self.require_display_authorized(parsed):
            return
        endpoint_id = requested_endpoint(parsed)
        calendar_id = str(parse_qs(parsed.query).get("id", [""])[0] or "")[:100]
        try:
            config = self.load_json_file(endpoint_config_path(endpoint_id)) or {}
            calendar = next((x for x in config.get("calendars") or [] if isinstance(x, dict) and str(x.get("id")) == calendar_id), None)
            if not calendar:
                raise ValueError("Calendar is not configured for this display")
            target = str(calendar.get("url") or "").strip()
            if target.lower().startswith("webcal://"):
                target = "https://" + target.split("://", 1)[1]
            if target.startswith("/calendar-files/"):
                filename = Path(target.split("/calendar-files/", 1)[1]).name
                path = (CALENDAR_FILES_DIR / filename).resolve()
                if path.parent != CALENDAR_FILES_DIR.resolve() or not path.is_file():
                    raise ValueError("Imported calendar file is unavailable")
                data = path.read_bytes()
                if len(data) > 1500000:
                    raise OverflowError("Calendar file is too large")
                return self.bytes_response(200, data, "text/calendar; charset=utf-8", {"X-LibreDisplay-Broker": "local"})
            ttl = max(60, min(86400, int(config.get("calendarRefreshMin") or 15) * 60))
            data, content_type, state, age = broker_remote_url(target, ttl)
            return self.bytes_response(200, data, content_type, {"X-LibreDisplay-Broker": state, "X-LibreDisplay-Broker-Age": str(age), "X-LibreDisplay-Cache": "stale" if state == "stale" else "fresh"})
        except OverflowError:
            return self.text_response(413, "Calendar source is too large")
        except ValueError as exc:
            return self.text_response(404, str(exc))
        except Exception as exc:
            return self.text_response(502, f"Calendar source failed: {exc}")

    def handle_block_source(self, parsed):
        if not self.require_display_authorized(parsed):
            return
        endpoint_id = requested_endpoint(parsed)
        block_id = str(parse_qs(parsed.query).get("block", [""])[0] or "")[:120]
        try:
            config = self.load_json_file(endpoint_config_path(endpoint_id)) or {}
            block = next((x for x in config.get("customBlocks") or [] if isinstance(x, dict) and str(x.get("id")) == block_id), None)
            if not block or block.get("type") not in {"rss", "json"}:
                raise ValueError("Data block is not configured for this display")
            bc = block.get("config") if isinstance(block.get("config"), dict) else {}
            target = str(bc.get("url") or "").strip()
            if not target:
                raise ValueError("Data block URL is not configured")
            ttl = max(60, min(86400, int(bc.get("refreshMin") or (15 if block.get("type") == "rss" else 5)) * 60))
            data, content_type, state, age = broker_remote_url(target, ttl)
            return self.bytes_response(200, data, content_type, {"X-LibreDisplay-Broker": state, "X-LibreDisplay-Broker-Age": str(age), "X-LibreDisplay-Cache": "stale" if state == "stale" else "fresh"})
        except ValueError as exc:
            return self.text_response(404, str(exc))
        except Exception as exc:
            return self.text_response(502, f"Data block source failed: {exc}")

    def handle_integration_data(self, parsed):
        if not self.require_display_authorized(parsed):
            return
        endpoint_id = requested_endpoint(parsed)
        block_id = str(parse_qs(parsed.query).get("block", [""])[0] or "")[:120]
        if not endpoint_id or not block_id:
            return self.json_response(400, {"ok": False, "error": "endpoint and block are required"})
        try:
            params = parse_qs(parsed.query)
            if str(params.get("check", [""])[0]).lower() in {"1", "true", "yes"}:
                if not self.authorized(parsed):
                    return self.json_response(403, {"ok": False, "error": "Editor or Owner access is required to force an integration check."})
                block = integration_block_for(endpoint_id, block_id)
                config = block.get("config") if isinstance(block, dict) and isinstance(block.get("config"), dict) else {}
                plugin_id = plugin_slug(config.get("plugin"))
                with PLUGIN_LOCK:
                    plugin = PLUGINS.get(plugin_id)
                if block and plugin:
                    invalidate_broker_key(integration_cache_key(plugin_id, integration_clean_settings(block, plugin)))
            data, content_type, state, age, manifest = integration_payload(endpoint_id, block_id)
            return self.bytes_response(200, data, content_type, {
                "X-LibreDisplay-Broker": state,
                "X-LibreDisplay-Broker-Age": str(age),
                "X-LibreDisplay-Integration": manifest["id"],
            })
        except ValueError as exc:
            return self.json_response(404, {"ok": False, "error": str(exc)})
        except Exception as exc:
            return self.json_response(502, {"ok": False, "error": f"Integration failed: {exc}"})

    def handle_integration_media(self, parsed):
        if not self.require_display_authorized(parsed):
            return
        endpoint_id = requested_endpoint(parsed)
        params = parse_qs(parsed.query)
        block_id = str(params.get("block", [""])[0] or "")[:120]
        item_id = str(params.get("item", [""])[0] or "")[:512]
        if not endpoint_id or not block_id or not item_id:
            return self.text_response(400, "endpoint, block and item are required")
        try:
            block = integration_block_for(endpoint_id, block_id)
            if not block:
                raise ValueError("Integration block is not configured for this display")
            config = block.get("config") if isinstance(block.get("config"), dict) else {}
            plugin_id = plugin_slug(config.get("plugin"))
            with PLUGIN_LOCK:
                plugin = PLUGINS.get(plugin_id)
            if not plugin or plugin["manifest"].get("kind") != "photos":
                raise ValueError("Photo integration is unavailable")
            handler = getattr(plugin["module"], "media", None)
            if not callable(handler):
                raise ValueError("This photo source does not use the protected-media proxy")
            settings = integration_clean_settings(block, plugin)
            key_material = json.dumps({"plugin": plugin_id, "settings": settings, "item": item_id}, sort_keys=True, ensure_ascii=False)
            cache_key = hashlib.sha256(("integration-media\n" + key_material).encode("utf-8", "replace")).hexdigest()
            def fetcher():
                payload, content_type = handler(settings, IntegrationContext(endpoint_id, plugin_id), item_id)
                if not isinstance(payload, (bytes, bytearray)):
                    raise ValueError("Photo provider returned invalid media")
                base = str(content_type or "").split(";", 1)[0].lower()
                if not base.startswith("image/"):
                    raise ValueError("Photo provider did not return an image")
                if len(payload) > MAX_MEDIA_FILE_BYTES:
                    raise OverflowError("Photo is too large")
                return bytes(payload), content_type
            data, content_type, state, age = broker_fetch(cache_key, 3600, fetcher, f"plugin-media:{plugin_id}")
            return self.bytes_response(200, data, content_type, {"Cache-Control":"private, max-age=300", "X-LibreDisplay-Broker":state, "X-LibreDisplay-Broker-Age":str(age)})
        except ValueError as exc:
            return self.text_response(404, str(exc))
        except OverflowError as exc:
            return self.text_response(413, str(exc))
        except Exception as exc:
            return self.text_response(502, f"Photo integration failed: {exc}")

    def handle_plugin_asset(self, parsed):
        parts = [x for x in parsed.path.split("/") if x]
        if len(parts) != 3 or parts[0] != "plugins" or parts[2] != "client.js":
            return self.text_response(404, "Not found")
        pid = plugin_slug(parts[1])
        with PLUGIN_LOCK:
            plugin = PLUGINS.get(pid)
        if not plugin or not plugin["manifest"].get("clientScript"):
            return self.text_response(404, "Plugin asset not found")
        path = (plugin["folder"] / "client.js").resolve()
        if not path.is_file() or path.parent != plugin["folder"].resolve():
            return self.text_response(404, "Plugin asset not found")
        try:
            data = path.read_bytes()
            if len(data) > 512 * 1024:
                return self.text_response(413, "Plugin client script is too large")
            return self.bytes_response(200, data, "application/javascript; charset=utf-8")
        except Exception:
            return self.text_response(500, "Could not read plugin client script")

    def device_payload(self):
        now = time.time()
        with DEVICE_LOCK:
            rows = []
            for key, row in list(DEVICE_STATE.items()):
                age = max(0, now - float(row.get("lastSeen") or 0))
                if age > 7 * 86400:
                    DEVICE_STATE.pop(key, None)
                    continue
                item = dict(row)
                item["online"] = age < 75
                item["ageSeconds"] = int(age)
                rows.append(item)
        rows.sort(key=lambda r: (str(r.get("endpoint")), str(r.get("name") or r.get("deviceId"))))
        return rows

    def do_OPTIONS(self):
        self.send_response(405)
        self.send_header("Allow", "GET, POST")
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not self.request_host_allowed():
            return self.json_response(421, {"ok": False, "error": "Unrecognized Host header"})
        if self.proxy_headers_present():
            return self.json_response(403, {"ok": False, "error": "Proxy-forwarded requests are not enabled by the built-in server"})
        if not self.post_origin_ok():
            return self.json_response(403, {"ok": False, "error": "Cross-site write blocked"})
        if parsed.path == "/api/login":
            if not self.client_network_allowed():
                return self.json_response(403, {"ok": False, "error": "Login is limited to trusted LAN/private VPN clients."})
            if self.auth_rate_limited():
                return self.json_response(429, {"ok": False, "error": "Too many failed sign-in attempts. Try again shortly."})
            try:
                body = self.read_json_body() or {}
                username = str(body.get("username") or "").strip()[:64]
                account = account_lookup(username)
                if not account or not account_password_valid(body.get("password"), account.get("passwordHash")):
                    self.note_auth_failure()
                    return self.json_response(403, {"ok": False, "error": "Invalid username or password."})
                principal = {"username": account["username"], "role": account["role"], "endpoints": account.get("endpoints") or []}
                token = create_remote_session(principal)
                allowed = endpoint_items() if principal["role"] == "owner" else [e for e in endpoint_items() if principal_allows_endpoint(principal, e["id"], write=False)]
                first = (allowed[0]["id"] if allowed else "main")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Set-Cookie", f"{REMOTE_COOKIE_NAME}={token}; Path=/; Max-Age={REMOTE_COOKIE_MAX_AGE}; HttpOnly; SameSite=Strict")
                payload = json.dumps({"ok": True, "username": principal["username"], "role": principal["role"], "endpoint": first}).encode("utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers(); self.wfile.write(payload); return
            except ValueError as exc:
                return self.json_response(400, {"ok": False, "error": str(exc)})
        if parsed.path == "/api/logout":
            token = cookie_value(self.headers.get("Cookie", ""), REMOTE_COOKIE_NAME)
            with REMOTE_SESSION_LOCK:
                REMOTE_SESSIONS.pop(str(token), None)
            self.send_response(200); self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Set-Cookie", f"{REMOTE_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"); payload=b'{"ok":true}'; self.send_header("Content-Length",str(len(payload))); self.end_headers(); self.wfile.write(payload); return
        if parsed.path == "/api/users":
            if not self.require_owner():
                return
            try:
                body = self.read_json_body() or {}; action = str(body.get("action") or "").lower(); store = load_user_store(); users = store.get("users") or []
                username = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(body.get("username") or "").strip()).strip("-")[:64]
                if not username:
                    raise ValueError("username is required")
                existing = next((x for x in users if str(x.get("username") or "").lower() == username.lower()), None)
                if action in {"create", "update"}:
                    role = str(body.get("role") or (existing or {}).get("role") or "viewer").lower()
                    if role not in {"owner", "editor", "viewer"}: raise ValueError("role must be owner, editor, or viewer")
                    endpoints = [endpoint_slug(x) for x in (body.get("endpoints") or []) if endpoint_by_id(endpoint_slug(x))]
                    if existing is None:
                        if action == "update": raise ValueError("Unknown user")
                        existing = {"username": username, "passwordHash": account_password_hash(body.get("password")), "role": role, "endpoints": endpoints, "enabled": True}; users.append(existing)
                    else:
                        existing["role"] = role; existing["endpoints"] = endpoints; existing["enabled"] = body.get("enabled") is not False
                        if str(body.get("password") or ""):
                            existing["passwordHash"] = account_password_hash(body.get("password")); clear_remote_sessions_for_user(existing["username"])
                    save_user_store({"version":1,"users":users}); return self.json_response(200,{"ok":True,"users":public_users()})
                if action == "delete":
                    if not existing: raise ValueError("Unknown user")
                    users = [x for x in users if x is not existing]; save_user_store({"version":1,"users":users}); clear_remote_sessions_for_user(username); return self.json_response(200,{"ok":True,"users":public_users()})
                raise ValueError("Unknown user action")
            except ValueError as exc:
                return self.json_response(400,{"ok":False,"error":str(exc)})
        if parsed.path == "/api/remote-access":
            if not self.client_is_loopback():
                return self.json_response(403, {"ok": False, "error": "Remote access can only be enabled or disabled from the local display."})
            try:
                body = self.read_json_body()
                enabled = body.get("enabled") if isinstance(body, dict) else None
                if not isinstance(enabled, bool):
                    raise ValueError("enabled must be true or false")
                set_remote_access_enabled(enabled)
                ips = local_ipv4_addresses() if enabled else []
                urls = [f"http://{ip}:{PORT}/pair?access={ACCESS_TOKEN}" for ip in ips]
                display_urls = [{"id": e["id"], "name": e["name"], "url": f"http://{ip}:{PORT}/display/{e['id']}?access={e['displayToken']}"} for ip in ips for e in endpoint_items()]
                return self.json_response(200, {"ok": True, "enabled": enabled, "settingsUrls": urls, "displayUrls": display_urls})
            except ValueError as exc:
                return self.json_response(400, {"ok": False, "error": str(exc)})
            except Exception as exc:
                return self.json_response(500, {"ok": False, "error": f"Could not change remote access: {exc}"})
        if parsed.path == "/api/media/scan":
            if not self.require_display_authorized(parsed):
                return
            return self.handle_media_scan(parsed)
        if parsed.path == "/api/household":
            if not self.require_display_authorized(parsed):
                return
            try:
                body = self.read_json_body() or {}
                action = str(body.get("action") or "").strip().lower()
                if action in {"replace", "set-pin", "clear-pin"}:
                    if not self.owner_authorized():
                        return self.json_response(403, {"ok": False, "error": "Owner access is required for household setup."})
                    with HOUSEHOLD_LOCK:
                        current = normalize_household_store(load_json_path(HOUSEHOLD_PATH, {}), preserve_secret=True)
                        if action == "replace":
                            incoming = body.get("household") if isinstance(body.get("household"), dict) else {}
                            replacement = normalize_household_store(incoming, preserve_secret=False)
                            replacement["childLock"] = dict(current.get("childLock") or {"enabled": False})
                            saved = save_household(replacement)
                        elif action == "set-pin":
                            current.setdefault("childLock", {})["enabled"] = bool(body.get("enabled", True))
                            current["childLock"]["pinHash"] = pin_hash(body.get("pin"))
                            saved = save_household(current)
                        else:
                            current["childLock"] = {"enabled": False}
                            saved = save_household(current)
                    return self.json_response(200, {"ok": True, "household": household_public_payload(saved, include_admin=True)})
                if action in {"complete", "redeem"} and self.auth_rate_limited():
                    return self.json_response(429, {"ok": False, "error": "Too many failed PIN attempts. Try again shortly."})
                if action == "complete":
                    saved = household_complete(str(body.get("choreId") or ""), body.get("completed") is not False, str(body.get("pin") or ""))
                    return self.json_response(200, {"ok": True, "household": household_public_payload(saved)})
                if action == "redeem":
                    saved = household_redeem(str(body.get("rewardId") or ""), str(body.get("memberId") or ""), str(body.get("pin") or ""))
                    return self.json_response(200, {"ok": True, "household": household_public_payload(saved)})
                raise ValueError("Unknown household action")
            except PermissionError as exc:
                self.note_auth_failure()
                return self.json_response(403, {"ok": False, "error": str(exc), "pinRequired": True})
            except ValueError as exc:
                return self.json_response(400, {"ok": False, "error": str(exc)})
            except Exception as exc:
                return self.json_response(500, {"ok": False, "error": f"Could not update household: {exc}"})
        if parsed.path == "/api/integration-action":
            if not self.require_display_authorized(parsed):
                return
            try:
                body = self.read_json_body() or {}
                endpoint_id = requested_endpoint(parsed)
                block_id = str(body.get("block") or "")[:120]
                result = integration_action(endpoint_id, block_id, str(body.get("action") or ""), body.get("payload") or {})
                return self.json_response(200, {"ok": True, "result": result})
            except ValueError as exc:
                return self.json_response(400, {"ok": False, "error": str(exc)})
            except Exception as exc:
                return self.json_response(502, {"ok": False, "error": f"Integration action failed: {exc}"})
        if parsed.path == "/api/device-heartbeat":
            if not self.require_display_authorized(parsed):
                return
            endpoint_id = requested_endpoint(parsed)
            try:
                body = self.read_json_body()
                device_id = re.sub(r"[^A-Za-z0-9_-]+", "-", str((body or {}).get("deviceId") or "").strip())[:80]
                if not device_id:
                    raise ValueError("deviceId is required")
                width = max(0, min(20000, int((body or {}).get("width") or 0)))
                height = max(0, min(20000, int((body or {}).get("height") or 0)))
                row = {
                    "endpoint": endpoint_id,
                    "deviceId": device_id,
                    "name": str((body or {}).get("name") or "").strip()[:80],
                    "width": width,
                    "height": height,
                    "dpr": max(0.25, min(8.0, float((body or {}).get("dpr") or 1))),
                    "mode": str((body or {}).get("mode") or "browser").strip()[:40],
                    "version": str((body or {}).get("version") or "").strip()[:40],
                    "userAgent": str((body or {}).get("userAgent") or "").strip()[:220],
                    "lastSeen": time.time(),
                }
                with DEVICE_LOCK:
                    DEVICE_STATE[endpoint_id + ":" + device_id] = row
                return self.json_response(200, {"ok": True})
            except ValueError as exc:
                return self.json_response(400, {"ok": False, "error": str(exc)})
            except Exception as exc:
                return self.json_response(500, {"ok": False, "error": f"Could not record display heartbeat: {exc}"})
        if parsed.path == "/api/devices":
            if not self.require_authorized(parsed):
                return
            try:
                body = self.read_json_body()
                action = str((body or {}).get("action") or "").strip().lower()
                endpoint_id = endpoint_slug((body or {}).get("endpoint") or "")
                if not endpoint_by_id(endpoint_id):
                    raise ValueError("Unknown display endpoint")
                if not principal_allows_endpoint(self.session_principal(), endpoint_id, write=True):
                    return self.json_response(403, {"ok": False, "error": "Editor access to this endpoint is required."})
                if action not in {"refresh", "reload"}:
                    raise ValueError("Unknown device action")
                publish_event(endpoint_id, action, {"requestedAt": int(time.time())})
                return self.json_response(200, {"ok": True, "endpoint": endpoint_id, "action": action})
            except ValueError as exc:
                return self.json_response(400, {"ok": False, "error": str(exc)})
        if parsed.path == "/api/scenes":
            if not self.require_owner():
                return
            try:
                body = self.read_json_body()
                scenes = normalize_scene_store(body.get("scenes") if isinstance(body, dict) and "scenes" in body else body)
                atomic_write_json_file(SCENES_PATH, scenes)
                apply_scene_schedules(force=True)
                return self.json_response(200, {"ok": True, "saved": True, "scenes": scenes})
            except Exception as exc:
                return self.json_response(500, {"ok": False, "error": f"Could not save scenes: {exc}"})
        if parsed.path == "/api/config" and not self.require_authorized(parsed):
            return
        if parsed.path in ("/api/profiles", "/api/cache-clear", "/api/access-rotate") and not self.require_owner():
            return
        if parsed.path == "/api/access-rotate":
            if not self.client_is_loopback():
                return self.json_response(403, {"ok": False, "error": "The remote access key can only be rotated from the local dashboard display."})
            token, display_token = rotate_access_tokens()
            ips = local_ipv4_addresses()
            urls = [f"http://{ip}:{PORT}/pair?access={token}" for ip in ips]
            display_urls = [{"id": e["id"], "name": e["name"], "url": f"http://{ip}:{PORT}/display/{e['id']}?access={e['displayToken']}"} for ip in ips for e in endpoint_items()]
            return self.json_response(200, {"ok": True, "settingsUrls": urls, "displayUrls": display_urls})
        if parsed.path == "/api/config":
            try:
                body = self.read_json_body()
                config = body.get("config") if isinstance(body, dict) and "config" in body else body
                if not isinstance(config, dict):
                    raise ValueError("Config must be a JSON object")
                endpoint_id = requested_endpoint(parsed)
                if not endpoint_id:
                    raise ValueError("Unknown display endpoint")
                self.atomic_write_json(endpoint_config_path(endpoint_id), config, endpoint_backup_path(endpoint_id))
                publish_event(endpoint_id, "config", {"savedAt": config.get("_savedAt", 0)})
                return self.json_response(200, {"ok": True, "saved": True, "endpoint": endpoint_id, "savedAt": config.get("_savedAt", 0)})
            except ValueError as exc:
                return self.json_response(400, {"ok": False, "error": str(exc)})
            except Exception as exc:
                return self.json_response(500, {"ok": False, "error": f"Could not save config: {exc}"})
        if parsed.path == "/api/profiles":
            try:
                body = self.read_json_body()
                profiles = body.get("profiles") if isinstance(body, dict) and "profiles" in body else body
                if not isinstance(profiles, dict):
                    raise ValueError("Profiles must be a JSON object")
                self.atomic_write_json(PROFILES_PATH, profiles)
                return self.json_response(200, {"ok": True, "saved": True})
            except ValueError as exc:
                return self.json_response(400, {"ok": False, "error": str(exc)})
            except Exception as exc:
                return self.json_response(500, {"ok": False, "error": f"Could not save profiles: {exc}"})
        if parsed.path == "/api/endpoints":
            if not self.require_owner():
                return
            try:
                body = self.read_json_body()
                action = str((body or {}).get("action") or "").strip().lower()
                endpoint_id = endpoint_slug((body or {}).get("id") or "")
                global ENDPOINTS, DISPLAY_TOKEN
                with ENDPOINT_LOCK:
                    items = [dict(x) for x in ENDPOINTS]
                    if action == "create":
                        name = str((body or {}).get("name") or "New display").strip()[:80] or "New display"
                        base = endpoint_slug((body or {}).get("id") or name)
                        candidate = base
                        n = 2
                        used = {x["id"] for x in items}
                        while candidate in used:
                            candidate = f"{base}-{n}"[:48]
                            n += 1
                        source_id = endpoint_slug((body or {}).get("copyFrom") or "")
                        source_exists = any(x["id"] == source_id for x in items)
                        items.append({"id": candidate, "name": name, "displayToken": secrets.token_urlsafe(32)})
                        ENDPOINTS = items
                        save_endpoint_registry(items)
                        if source_id and source_exists:
                            source_path = endpoint_config_path(source_id)
                            if source_path.exists():
                                shutil.copy2(source_path, endpoint_config_path(candidate))
                        return self.json_response(200, {"ok": True, "endpoint": candidate})
                    if action == "rename":
                        name = str((body or {}).get("name") or "").strip()[:80]
                        if not endpoint_id or not name:
                            raise ValueError("Display id and name are required")
                        found = False
                        for row in items:
                            if row["id"] == endpoint_id:
                                row["name"] = name
                                found = True
                        if not found:
                            raise ValueError("Unknown display endpoint")
                        ENDPOINTS = items
                        save_endpoint_registry(items)
                        return self.json_response(200, {"ok": True})
                    if action == "rotate":
                        found = False
                        new_token = secrets.token_urlsafe(32)
                        for row in items:
                            if row["id"] == endpoint_id:
                                row["displayToken"] = new_token
                                found = True
                        if not found:
                            raise ValueError("Unknown display endpoint")
                        ENDPOINTS = items
                        save_endpoint_registry(items)
                        if endpoint_id == "main":
                            DISPLAY_TOKEN = new_token
                            ACCESS_PATH.write_text(json.dumps({"token": ACCESS_TOKEN, "displayToken": DISPLAY_TOKEN}, indent=2) + "\n", encoding="utf-8")
                            os.chmod(ACCESS_PATH, 0o600)
                        publish_event(endpoint_id, "reauth", {"reason": "display-link-rotated"})
                        return self.json_response(200, {"ok": True})
                    if action == "delete":
                        if endpoint_id == "main":
                            raise ValueError("The main display cannot be deleted")
                        if not any(x["id"] == endpoint_id for x in items):
                            raise ValueError("Unknown display endpoint")
                        items = [x for x in items if x["id"] != endpoint_id]
                        ENDPOINTS = items
                        save_endpoint_registry(items)
                        endpoint_config_path(endpoint_id).unlink(missing_ok=True)
                        endpoint_backup_path(endpoint_id).unlink(missing_ok=True)
                        return self.json_response(200, {"ok": True})
                raise ValueError("Unknown endpoint action")
            except ValueError as exc:
                return self.json_response(400, {"ok": False, "error": str(exc)})
            except Exception as exc:
                return self.json_response(500, {"ok": False, "error": f"Could not update displays: {exc}"})
        if parsed.path == "/api/calendar-file":
            if not self.require_authorized(parsed):
                return
            try:
                body = self.read_json_body()
                name = str((body or {}).get("name") or "calendar.ics").strip()[:120]
                content = str((body or {}).get("content") or "")
                if len(content.encode("utf-8")) > 1500000:
                    raise ValueError("Calendar file is too large (1.5 MB maximum)")
                if "BEGIN:VCALENDAR" not in content[:4096].upper():
                    raise ValueError("That file does not look like an iCalendar (.ics) file")
                stem = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(name).stem).strip(".-")[:60] or "calendar"
                filename = f"{stem}-{secrets.token_hex(5)}.ics"
                target = CALENDAR_FILES_DIR / filename
                target.write_text(content, encoding="utf-8")
                os.chmod(target, 0o600)
                return self.json_response(200, {"ok": True, "url": f"/calendar-files/{filename}", "name": name})
            except ValueError as exc:
                return self.json_response(400, {"ok": False, "error": str(exc)})
            except Exception as exc:
                return self.json_response(500, {"ok": False, "error": f"Could not import calendar file: {exc}"})
        if parsed.path == "/api/cache-clear":
            removed = 0
            try:
                for root in (CACHE_DIR, BROKER_DIR):
                    for p in root.glob("*"):
                        if p.is_file():
                            p.unlink(missing_ok=True)
                            removed += 1
                with BROKER_LOCK:
                    BROKER_STATUS.clear()
            except Exception:
                pass
            return self.json_response(200, {"ok": True, "removed": removed})
        self.json_response(404, {"ok": False, "error": "Not found"})

    def do_GET(self):
        parsed = urlparse(self.path)
        if not self.request_host_allowed():
            return self.json_response(421, {"ok": False, "error": "Unrecognized Host header"})
        if self.proxy_headers_present():
            return self.json_response(403, {"ok": False, "error": "Proxy-forwarded requests are not enabled by the built-in server"})
        if parsed.path in ("/login", "/login/"):
            if not self.client_network_allowed():
                return self.text_response(403, "Login is limited to trusted LAN/private VPN clients.")
            page = b"""<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>LibreDisplay Sign In</title><style>body{margin:0;background:#0c0f0d;color:#eef2ef;font:16px system-ui;display:grid;place-items:center;min-height:100vh}.card{width:min(420px,calc(100vw - 40px));background:#161a17;border:1px solid #303832;border-radius:18px;padding:28px;box-shadow:0 20px 70px #0008}h1{margin:0 0 4px}p{color:#aab5ad}label{display:block;margin:16px 0 6px}input{box-sizing:border-box;width:100%;padding:12px 14px;border-radius:10px;border:1px solid #3a443d;background:#0f1310;color:#fff}button{margin-top:18px;width:100%;padding:12px;border:0;border-radius:10px;background:#3fb950;color:#061006;font-weight:800;cursor:pointer}.err{min-height:22px;color:#ff8b8b;margin-top:12px}</style></head><body><form class='card' id='f'><h1>LibreDisplay</h1><p>Sign in to a local Owner, Editor, or Viewer account.</p><label>Username</label><input id='u' autocomplete='username' required><label>Password</label><input id='p' type='password' autocomplete='current-password' required><button>Sign in</button><div class='err' id='e'></div></form><script>f.onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u.value,password:p.value})});const d=await r.json().catch(()=>({}));if(r.ok&&d.ok)location.href=d.role==='viewer'?'/dashboard.html?display=1&endpoint='+(d.endpoint||'main'):'/settings?endpoint='+(d.endpoint||'main');else document.getElementById('e').textContent=d.error||'Sign-in failed';}</script></body></html>"""
            return self.bytes_response(200, page, "text/html; charset=utf-8", {"Cache-Control": "no-store"})
        if parsed.path == "/healthz":
            if not self.client_is_loopback():
                return self.json_response(403, {"ok": False})
            return self.json_response(200, {"ok": True})
        if parsed.path == "/pair":
            if not self.client_network_allowed():
                return self.text_response(403, "Remote management is limited to private/LAN/VPN clients by default.")
            token = self.pairing_token(parsed)
            if self.auth_rate_limited():
                return self.text_response(429, "Too many failed remote access attempts. Try again shortly.")
            if not token or not secrets.compare_digest(str(token), ACCESS_TOKEN):
                self.note_auth_failure()
                return self.text_response(403, "Invalid or expired dashboard pairing link")
            session_token = create_remote_session()
            self.send_response(302)
            secure = "; Secure" if str(self.headers.get("X-Forwarded-Proto", "")).lower() == "https" else ""
            self.send_header("Set-Cookie", f"{REMOTE_COOKIE_NAME}={session_token}; Path=/; Max-Age={REMOTE_COOKIE_MAX_AGE}; HttpOnly; SameSite=Strict{secure}")
            self.send_header("Location", "/settings")
            self.end_headers()
            return
        if parsed.path == "/display" or parsed.path.startswith("/display/"):
            if not self.client_network_allowed():
                return self.text_response(403, "Display access is limited to private/LAN/VPN clients by default.")
            endpoint_id = "main" if parsed.path == "/display" else endpoint_slug(parsed.path.split("/", 2)[2])
            endpoint = endpoint_by_id(endpoint_id)
            if not endpoint:
                return self.text_response(404, "Unknown display endpoint")
            token = self.pairing_token(parsed)
            if self.auth_rate_limited():
                return self.text_response(429, "Too many failed access attempts. Try again shortly.")
            if not token or not secrets.compare_digest(str(token), endpoint["displayToken"]):
                self.note_auth_failure()
                return self.text_response(403, "Invalid or expired display link")
            display_session = create_display_session(endpoint_id)
            self.send_response(302)
            self.send_header("Set-Cookie", f"{DISPLAY_COOKIE_NAME}={display_session}; Path=/; Max-Age={max(3600, DISPLAY_COOKIE_MAX_AGE)}; HttpOnly; SameSite=Strict")
            self.send_header("Location", f"/dashboard.html?display=1&endpoint={quote(endpoint_id)}")
            self.end_headers()
            return
        if parsed.path in ("/", "/dashboard.html") and not self.display_authorized(parsed):
            return self.json_response(403, {"ok": False, "error": "A paired admin session or read-only display link is required."})
        if parsed.path == "/":
            self.send_response(302)
            self.send_header("Location", "/dashboard.html?endpoint=main")
            self.end_headers()
            return
        if parsed.path in ("/settings", "/settings/"):
            if not self.require_authorized(parsed):
                return
            self.send_response(302)
            self.send_header("Location", f"/dashboard.html?settings=1&endpoint={quote(requested_endpoint(parsed) or 'main')}")
            self.end_headers()
            return
        if parsed.path == "/api/remote-info":
            if not self.client_is_loopback():
                return self.json_response(403, {"ok": False, "error": "Remote-info is available only from the local display."})
            enabled = remote_access_enabled()
            ips = local_ipv4_addresses() if enabled else []
            urls = [f"http://{ip}:{PORT}/pair?access={ACCESS_TOKEN}" for ip in ips]
            display_urls = [{"id": e["id"], "name": e["name"], "url": f"http://{ip}:{PORT}/display/{e['id']}?access={e['displayToken']}"} for ip in ips for e in endpoint_items()]
            return self.json_response(200, {
                "ok": True,
                "hostname": socket.gethostname(),
                "port": PORT,
                "addresses": ips,
                "settingsUrls": urls,
                "displayUrls": display_urls,
                "accessConfigured": True,
                "remoteEnabled": enabled,
            })
        if parsed.path == "/api/session-info":
            if not self.require_display_authorized(parsed):
                return
            principal = self.session_principal()
            return self.json_response(200, {
                "ok": True,
                "local": self.client_is_loopback(),
                "admin": self.authorized(parsed),
                "display": self.display_authorized(parsed) and not self.authorized(parsed),
                "endpoint": requested_endpoint(parsed) or "main",
                "username": (principal or {}).get("username", ""),
                "role": (principal or {}).get("role", "display" if self.display_authorized(parsed) else ""),
                "endpoints": (principal or {}).get("endpoints", []),
            })
        if parsed.path == "/api/events":
            return self.handle_events(parsed)
        if parsed.path == "/api/integrations":
            if not self.require_display_authorized(parsed):
                return
            return self.json_response(200, {"ok": True, "integrations": plugin_manifests()})
        if parsed.path == "/api/update-status":
            if not self.require_authorized(parsed):
                return
            query = parse_qs(parsed.query)
            force = str((query.get("force") or [""])[0]).lower() in {"1", "true", "yes"}
            if force and not self.owner_authorized():
                force = False
            return self.json_response(200, github_update_status(force=force))
        if parsed.path == "/api/integration-status":
            if not self.require_display_authorized(parsed):
                return
            endpoint_id = requested_endpoint(parsed) or "main"
            return self.json_response(200, {"ok": True, "integrations": integration_status_rows(endpoint_id)})
        if parsed.path == "/api/household":
            if not self.require_display_authorized(parsed):
                return
            return self.json_response(200, {"ok": True, "household": household_public_payload(include_admin=self.owner_authorized())})
        if parsed.path == "/api/calendar-source":
            return self.handle_calendar_source(parsed)
        if parsed.path == "/api/block-source":
            return self.handle_block_source(parsed)
        if parsed.path == "/api/integration-data":
            return self.handle_integration_data(parsed)
        if parsed.path == "/api/integration-media":
            return self.handle_integration_media(parsed)
        if parsed.path.startswith("/plugins/"):
            if not self.require_display_authorized(parsed):
                return
            return self.handle_plugin_asset(parsed)
        if parsed.path == "/api/users":
            if not self.require_owner():
                return
            return self.json_response(200, {"ok": True, "users": public_users()})
        if parsed.path == "/api/devices":
            if not self.require_authorized(parsed):
                return
            principal = self.session_principal()
            rows = [x for x in self.device_payload() if principal_allows_endpoint(principal, x.get("endpoint") or "main", write=False)]
            return self.json_response(200, {"ok": True, "devices": rows})
        if parsed.path == "/api/broker/status":
            if not self.require_owner():
                return
            with BROKER_LOCK:
                rows = [dict({"key": key}, **value) for key, value in BROKER_STATUS.items()]
            return self.json_response(200, {"ok": True, "sources": rows[-200:]})
        if parsed.path == "/api/broker":
            return self.handle_broker(parsed)
        if parsed.path == "/api/scenes":
            if not self.require_owner():
                return
            scenes = normalize_scene_store(load_json_path(SCENES_PATH, {}))
            chosen, _ = choose_scene_profiles()
            return self.json_response(200, {"ok": True, "scenes": scenes, "active": chosen})
        if parsed.path in ("/api/profiles", "/api/storage-status", "/api/cache-status", "/api/media/roots", "/api/media/browse") and not self.require_owner():
            return
        if parsed.path in ("/api/config", "/api/qr", "/media", "/proxy", "/gphotos-page") and not self.require_display_authorized(parsed):
            return
        if parsed.path == "/api/endpoints":
            if not self.require_authorized(parsed):
                return
            principal = self.session_principal()
            owner = bool(principal and principal.get("role") == "owner")
            host = self.headers.get("Host", f"127.0.0.1:{PORT}")
            if self.client_is_loopback() and remote_access_enabled():
                addresses = local_ipv4_addresses()
                if addresses:
                    host = f"{addresses[0]}:{PORT}"
            rows = []
            for e in endpoint_items():
                if not principal_allows_endpoint(principal, e["id"], write=False):
                    continue
                rows.append({"id": e["id"], "name": e["name"], "displayUrl": (f"http://{host}/display/{e['id']}?access={e['displayToken']}" if owner else ""), "configured": endpoint_config_path(e["id"]).exists()})
            return self.json_response(200, {"ok": True, "endpoints": rows, "current": requested_endpoint(parsed) or (rows[0]["id"] if rows else "main"), "remoteEnabled": remote_access_enabled(), "role": (principal or {}).get("role", "")})
        if parsed.path.startswith("/calendar-files/"):
            if not self.require_display_authorized(parsed):
                return
            filename = Path(parsed.path.split("/calendar-files/", 1)[1]).name
            target = (CALENDAR_FILES_DIR / filename).resolve()
            if not filename.lower().endswith(".ics") or target.parent != CALENDAR_FILES_DIR.resolve() or not target.is_file():
                return self.text_response(404, "Calendar file not found")
            if not self.calendar_file_allowed_for_display(filename, parsed):
                return self.text_response(403, "Calendar file is not assigned to this display")
            data = target.read_bytes()
            if len(data) > 1500000:
                return self.text_response(413, "Calendar file is too large")
            return self.bytes_response(200, data, "text/calendar; charset=utf-8", {"Cache-Control": "no-store"})
        if parsed.path == "/api/media/roots":
            return self.json_response(200, {"ok": True, "roots": self.media_roots_payload()})
        if parsed.path == "/api/media/browse":
            return self.handle_media_browse(parsed)
        if parsed.path == "/api/qr":
            return self.handle_qr(parsed)
        if parsed.path == "/media":
            return self.handle_media_file(parsed)
        if parsed.path == "/api/config":
            endpoint_id = requested_endpoint(parsed)
            if not endpoint_id:
                return self.json_response(404, {"ok": False, "error": "Unknown display endpoint"})
            config = self.load_json_file(endpoint_config_path(endpoint_id))
            outgoing = config if isinstance(config, dict) else None
            if outgoing is not None and not self.authorized(parsed):
                outgoing = json.loads(json.dumps(outgoing))
                for calendar in outgoing.get("calendars") or []:
                    if isinstance(calendar, dict):
                        calendar["configured"] = bool(calendar.get("url"))
                        calendar["url"] = ""
                for block in outgoing.get("customBlocks") or []:
                    if not isinstance(block, dict) or not isinstance(block.get("config"), dict):
                        continue
                    if block.get("type") == "integration":
                        block["config"]["settings"] = {}
                    if block.get("type") in {"rss", "json"}:
                        block["config"]["url"] = ""
            return self.json_response(200, {"ok": True, "endpoint": endpoint_id, "exists": isinstance(config, dict), "config": outgoing, "savedAt": (config or {}).get("_savedAt", 0) if isinstance(config, dict) else 0})
        if parsed.path == "/api/profiles":
            profiles = self.load_json_file(PROFILES_PATH)
            return self.json_response(200, {"ok": True, "exists": isinstance(profiles, dict), "profiles": profiles if isinstance(profiles, dict) else None})
        if parsed.path == "/api/storage-status":
            return self.json_response(200, {
                "ok": True,
                "configExists": endpoint_config_path(requested_endpoint(parsed) or "main").exists(),
                "profilesExists": PROFILES_PATH.exists(),
                "configFile": endpoint_config_path(requested_endpoint(parsed) or "main").name,
                "profilesFile": PROFILES_PATH.name,
                "cacheDir": CACHE_DIR.name,
                "dataDir": str(DATA_ROOT),
                "mediaRoots": self.media_roots_payload(),
            })
        if parsed.path == "/api/cache-status":
            files = list(CACHE_DIR.glob("*.bin"))
            broker_files = list(BROKER_DIR.glob("*.bin"))
            return self.json_response(200, {
                "ok": True,
                "items": len(files) + len(broker_files),
                "bytes": sum(p.stat().st_size for p in files + broker_files if p.exists()),
                "maxBytes": CACHE_MAX_BYTES,
                "brokerSources": len(broker_files),
            })
        if parsed.path == "/proxy":
            return self.handle_broker(parsed)
        if parsed.path == "/gphotos-page":
            self.handle_gphotos_page(parsed)
            return
        if parsed.path == "/dashboard.html":
            return self.serve_dashboard()
        if parsed.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        self.text_response(404, "Not found")

    def handle_gphotos_page(self, parsed):
        qs = parse_qs(parsed.query)
        album_key = qs.get("albumKey", [""])[0].strip()
        auth_key = qs.get("authKey", [""])[0].strip()
        page_token = qs.get("pageToken", [""])[0].strip()
        token_re = re.compile(r"^[A-Za-z0-9_-]{1,4096}$")
        if not (token_re.fullmatch(album_key) and token_re.fullmatch(auth_key) and token_re.fullmatch(page_token)):
            return self.text_response(400, "Invalid Google Photos pagination parameters")

        cache_key = self.cache_key("gphotos", album_key + "\n" + auth_key + "\n" + page_token)
        inner = json.dumps([album_key, page_token, None, auth_key], separators=(",", ":"))
        envelope = json.dumps([[[GOOGLE_RPC_ID, inner, None, "generic"]]], separators=(",", ":"))
        body = urlencode({"f.req": envelope}).encode("utf-8")
        endpoint = GOOGLE_BATCH_URL + "?" + urlencode({"rpcids": GOOGLE_RPC_ID, "source-path": f"/share/{album_key}"})
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 Chrome/126 Safari/537.36",
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "Origin": "https://photos.google.com",
            "Referer": f"https://photos.google.com/share/{album_key}?key={auth_key}",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        }
        try:
            status, response_headers, data, _ = safe_fetch(
                endpoint, method="POST", headers=headers, body=body, timeout=30, max_bytes=MAX_BYTES
            )
            if status >= 400:
                if status >= 500 or status == 429:
                    if self.serve_cached(cache_key, f"Google Photos HTTP {status}"):
                        return
                return self.text_response(status, f"Google Photos pagination returned HTTP {status}")
            content_type = response_headers.get("Content-Type", "text/plain; charset=utf-8")
            self.save_cache(cache_key, data, content_type)
            self.bytes_response(200, data, content_type, {"X-LibreDisplay-Cache": "fresh"})
        except OverflowError:
            self.text_response(413, "Google Photos pagination response is too large")
        except (OSError, TimeoutError, ssl.SSLError, http.client.HTTPException) as exc:
            if self.serve_cached(cache_key, "Google Photos unavailable"):
                return
            self.text_response(502, f"Could not reach Google Photos: {exc}")
        except ValueError as exc:
            self.text_response(403, f"Google Photos request blocked: {exc}")
        except Exception:
            if self.serve_cached(cache_key, "Google Photos error"):
                return
            self.text_response(502, "Google Photos pagination failed")



if __name__ == "__main__":
    print(f"LibreDisplay (local display): http://127.0.0.1:{PORT}/")
    print(f"Remote management: {'enabled' if remote_access_enabled() else 'disabled'} (change from the local LibreDisplay Settings page).")
    print(f"Remote network policy: {REMOTE_NETWORKS_RAW or 'private'}")
    print("Press Ctrl+C to stop.")
    threading.Thread(target=scene_scheduler_loop, name="libredisplay-scenes", daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), DashboardHandler)
    server.daemon_threads = True
    server.serve_forever()
