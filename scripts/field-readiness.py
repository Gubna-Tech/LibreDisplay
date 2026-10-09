#!/usr/bin/env python3
"""Collect a privacy-safe LibreDisplay hardware/browser soak report.

Run this on the LibreDisplay host while the kiosk is open. It samples the same
local system-health payload used by Settings, so no owner token, private feed
URL, coordinates, credentials, or browser history are written to the report.

Release-gate runs use an append-only journal so deliberate reboots or power
cycles do not discard the soak. Re-run the same command with --resume after the
host returns to continue the original wall-clock test window.
"""

import argparse
import json
import math
import os
import platform
import shutil
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
VERSION_PATH = PROJECT_ROOT / "VERSION"
ENV_PATH = PROJECT_ROOT / "data" / "libredisplay.env"
DEFAULT_DATA_ROOT = PROJECT_ROOT / "data"
DEFAULT_PORT = 8787
RELEASE_GATE_MINUTES = 12 * 60
JOURNAL_FSYNC_SECONDS = 60.0


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_utc(value):
    try:
        text = str(value or "").strip().replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def read_runtime_env():
    values = {}
    try:
        lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    except OSError:
        return values
    for line in lines:
        row = line.strip()
        if not row or row.startswith("#") or "=" not in row:
            continue
        key, value = row.split("=", 1)
        key = key.strip()
        if key not in {"DASHBOARD_PORT", "DASHBOARD_DATA_DIR"}:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key] = value
    return values


def configured_runtime():
    values = read_runtime_env()
    raw_port = os.environ.get("DASHBOARD_PORT") or values.get("DASHBOARD_PORT") or str(DEFAULT_PORT)
    try:
        port = int(raw_port)
    except (TypeError, ValueError):
        port = DEFAULT_PORT
    if not 1 <= port <= 65535:
        port = DEFAULT_PORT
    raw_data = os.environ.get("DASHBOARD_DATA_DIR") or values.get("DASHBOARD_DATA_DIR") or str(DEFAULT_DATA_ROOT)
    data_root = Path(os.path.expandvars(os.path.expanduser(str(raw_data)))).resolve()
    return port, data_root


def load_json(path, fallback=None):
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return fallback


def safe_nonnegative_int(value):
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def safe_float(value, low=0.0, high=10**9, digits=1):
    try:
        number = float(value or 0)
        if not math.isfinite(number):
            return low
        return round(max(low, min(high, number)), digits)
    except (TypeError, ValueError, OverflowError):
        return low


def sanitize_frontend_performance(value):
    src = value if isinstance(value, dict) else {}
    connectivity = src.get("connectivity") if isinstance(src.get("connectivity"), dict) else {}
    animation = src.get("animation") if isinstance(src.get("animation"), dict) else {}
    graphics = src.get("graphics") if isinstance(src.get("graphics"), dict) else {}
    long_tasks = src.get("longTasks") if isinstance(src.get("longTasks"), dict) else {}
    heap = src.get("heap") if isinstance(src.get("heap"), dict) else {}
    return {
        "tier": str(src.get("tier") or "")[:40],
        "pageUptimeMs": safe_nonnegative_int(src.get("pageUptimeMs")),
        "activeIntervals": safe_nonnegative_int(src.get("activeIntervals")),
        "activeExclusiveRuns": safe_nonnegative_int(src.get("activeExclusiveRuns")),
        "longTaskObserverActive": bool(src.get("longTaskObserverActive")),
        "animation": {
            "mode": str(animation.get("mode") or "")[:24],
            "fps": safe_float(animation.get("fps"), 0, 240, 1),
            "targetFps": safe_float(animation.get("targetFps"), 0, 240, 1),
            "droppedPct": safe_float(animation.get("droppedPct"), 0, 100, 1),
            "renderer": str(animation.get("renderer") or "")[:80],
            "running": bool(animation.get("running")),
        } if animation else {},
        "graphics": {
            "webgl": bool(graphics.get("webgl")),
            "webgl2": bool(graphics.get("webgl2")),
            "software": bool(graphics.get("software")),
            "renderer": str(graphics.get("renderer") or "")[:180],
            "vendor": str(graphics.get("vendor") or "")[:120],
        } if graphics else {},
        "longTasks": {
            "count": safe_nonnegative_int(long_tasks.get("count")),
            "totalMs": safe_nonnegative_int(long_tasks.get("totalMs")),
            "maxMs": safe_nonnegative_int(long_tasks.get("maxMs")),
        },
        "heap": {"usedBytes": safe_nonnegative_int(heap.get("usedBytes"))} if heap else {},
        "connectivity": {
            "requests": safe_nonnegative_int(connectivity.get("requests")),
            "successes": safe_nonnegative_int(connectivity.get("successes")),
            "failures": safe_nonnegative_int(connectivity.get("failures")),
            "timeouts": safe_nonnegative_int(connectivity.get("timeouts")),
            "retries": safe_nonnegative_int(connectivity.get("retries")),
            "inFlight": safe_nonnegative_int(connectivity.get("inFlight")),
            "lastLatencyMs": safe_nonnegative_int(connectivity.get("lastLatencyMs")),
            "averageLatencyMs": safe_nonnegative_int(connectivity.get("averageLatencyMs")),
            "lastSuccessAt": safe_nonnegative_int(connectivity.get("lastSuccessAt")),
            "lastFailureAt": safe_nonnegative_int(connectivity.get("lastFailureAt")),
            "online": bool(connectivity.get("online", True)),
        },
    } if src else {}


def local_fallback_health(data_root):
    try:
        disk = shutil.disk_usage(data_root)
        disk_payload = {
            "totalBytes": int(disk.total),
            "usedBytes": int(disk.used),
            "freeBytes": int(disk.free),
            "freePercent": round((disk.free / disk.total) * 100, 1) if disk.total else 0,
        }
    except OSError:
        disk_payload = {}
    uptime_seconds = None
    try:
        uptime_seconds = int(float(Path("/proc/uptime").read_text(encoding="utf-8").split()[0]))
    except (OSError, ValueError, IndexError):
        pass
    try:
        load_average = [round(float(value), 2) for value in os.getloadavg()]
    except OSError:
        load_average = []
    hardware = {"cpuCount": int(os.cpu_count() or 0)}
    try:
        model = Path("/proc/device-tree/model").read_bytes().replace(b"\x00", b"").decode("utf-8", "replace").strip()
        if model:
            hardware["model"] = model[:160]
    except OSError:
        pass
    try:
        meminfo = {}
        for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
            if ":" not in line:
                continue
            key, raw = line.split(":", 1)
            digits = "".join(ch for ch in raw if ch.isdigit())
            if digits:
                meminfo[key] = int(digits) * 1024
        if meminfo.get("MemTotal"):
            hardware["memoryTotalBytes"] = meminfo["MemTotal"]
        if meminfo.get("MemAvailable"):
            hardware["memoryAvailableBytes"] = meminfo["MemAvailable"]
    except (OSError, ValueError):
        pass
    try:
        raw_temp = float(Path("/sys/class/thermal/thermal_zone0/temp").read_text(encoding="utf-8").strip())
        hardware["temperatureC"] = round(raw_temp / 1000.0 if raw_temp > 1000 else raw_temp, 1)
    except (OSError, ValueError):
        pass

    kiosk = load_json(data_root / "kiosk-heartbeat.json", {})
    kiosk_payload = {"present": False}
    if isinstance(kiosk, dict) and kiosk.get("lastSeen"):
        try:
            last_seen = float(kiosk.get("lastSeen") or 0)
            width = max(0, int(kiosk.get("viewportWidth") or 0))
            height = max(0, int(kiosk.get("viewportHeight") or 0))
            kiosk_payload = {
                "present": True,
                "ageSeconds": max(0, round(time.time() - last_seen, 1)),
                "endpoint": str(kiosk.get("endpoint") or "main")[:48],
                "viewport": f"{width}×{height}" if width and height else "",
                "version": str(kiosk.get("version") or "")[:40],
                "frontendPerformance": sanitize_frontend_performance(kiosk.get("frontendPerformance")),
            }
        except (TypeError, ValueError):
            kiosk_payload = {"present": False}

    watchdog = load_json(data_root / "watchdog-state.json", {})
    if not isinstance(watchdog, dict):
        watchdog = {}
    startup = load_json(data_root / "startup-integrity.json", {})
    if not isinstance(startup, dict):
        startup = {}
    return {
        "ok": True,
        "version": expected_version(),
        "deployment": "native" if (PROJECT_ROOT / "data" / ".installed").is_file() else "source",
        "python": platform.python_version(),
        "platform": platform.system(),
        "machine": platform.machine(),
        "hardware": hardware,
        "uptimeSeconds": uptime_seconds,
        "loadAverage": load_average,
        "disk": disk_payload,
        "dataWritable": os.access(data_root, os.W_OK),
        "kioskHeartbeat": kiosk_payload,
        "startupIntegrity": {
            "ok": bool(startup.get("ok")),
            "checkedAt": safe_nonnegative_int(startup.get("checkedAt")),
            "version": str(startup.get("version") or "")[:40],
            "coreFiles": safe_nonnegative_int(startup.get("coreFiles")),
            "pythonFiles": safe_nonnegative_int(startup.get("pythonFiles")),
            "shellFiles": safe_nonnegative_int(startup.get("shellFiles")),
            "frontendVerified": bool(startup.get("frontendVerified")),
        },
        "recovery": {
            "watchdog": {
                "serverRestarts": safe_nonnegative_int(watchdog.get("serverRestarts")),
                "browserRestarts": safe_nonnegative_int(watchdog.get("browserRestarts")),
                "lastReason": str(watchdog.get("lastReason") or "")[:80],
                "lastRecoveryAt": safe_nonnegative_int(watchdog.get("lastRecoveryAt")),
            }
        },
    }


def expected_version():
    try:
        return VERSION_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def fetch_live_system_health(port):
    started = time.monotonic()
    try:
        request = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/system-health",
            headers={"User-Agent": "LibreDisplay field-readiness", "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=3) as response:
            if response.status != 200:
                raise RuntimeError(f"HTTP {response.status}")
            raw = response.read(1024 * 1024 + 1)
            if len(raw) > 1024 * 1024:
                raise RuntimeError("System-health response is too large")
        payload = json.loads(raw.decode("utf-8"))
        if not isinstance(payload, dict) or not payload.get("ok"):
            raise RuntimeError("System-health payload is unavailable")
        return payload, {"reachable": True, "latencyMs": round((time.monotonic() - started) * 1000, 1)}
    except (OSError, urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError, RuntimeError):
        return None, {"reachable": False, "latencyMs": round((time.monotonic() - started) * 1000, 1)}


def field_health_subset(payload):
    src = payload if isinstance(payload, dict) else {}
    return {
        key: src.get(key)
        for key in (
            "ok", "version", "deployment", "platform", "machine", "hardware", "uptimeSeconds",
            "loadAverage", "disk", "dataWritable", "kioskHeartbeat", "outboundConnectivity",
            "startupIntegrity", "recovery",
        )
        if key in src
    }


def collect_sample():
    port, data_root = configured_runtime()
    payload, live_server = fetch_live_system_health(port)
    if payload is None:
        payload = local_fallback_health(data_root)
    else:
        payload = field_health_subset(payload)
    return {"sampledAt": utc_now(), **payload, "liveServer": live_server}

def finite_numbers(values):
    out = []
    for value in values:
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(number):
            out.append(number)
    return out


def stats(values, digits=2):
    rows = finite_numbers(values)
    if not rows:
        return {}
    return {
        "min": round(min(rows), digits),
        "avg": round(statistics.fmean(rows), digits),
        "max": round(max(rows), digits),
    }


def counter_delta(values):
    rows = finite_numbers(values)
    if len(rows) < 2:
        return 0
    total = 0.0
    previous = rows[0]
    for current in rows[1:]:
        total += current - previous if current >= previous else current
        previous = current
    return max(0, round(total, 2))


def false_episode_count(values):
    episodes = 0
    active = False
    for value in values:
        failed = not bool(value)
        if failed and not active:
            episodes += 1
        active = failed
    return episodes


def decrease_event_count(values, tolerance=0.0):
    rows = finite_numbers(values)
    if len(rows) < 2:
        return 0
    count = 0
    previous = rows[0]
    for current in rows[1:]:
        if current + tolerance < previous:
            count += 1
        previous = current
    return count


def sample_gap_stats(samples):
    epochs = []
    for row in samples:
        parsed = parse_utc(row.get("sampledAt"))
        if parsed:
            epochs.append(parsed.timestamp())
    gaps = [max(0.0, current - previous) for previous, current in zip(epochs, epochs[1:])]
    return stats(gaps, 1)


def summarize_samples(samples, expected=""):
    if not samples:
        return {"sampleCount": 0, "observations": ["No system-health samples were collected."]}

    temps = [row.get("hardware", {}).get("temperatureC") for row in samples]
    mem_avail = [row.get("hardware", {}).get("memoryAvailableBytes") for row in samples]
    disk_free_pct = [row.get("disk", {}).get("freePercent") for row in samples]
    load1 = [(row.get("loadAverage") or [None])[0] for row in samples]
    uptimes = [row.get("uptimeSeconds") for row in samples]
    data_writable = [bool(row.get("dataWritable")) for row in samples]
    versions = sorted({str(row.get("version") or "") for row in samples if row.get("version")})
    live_server = [row.get("liveServer") or {} for row in samples]
    live_server_ok = [bool(row.get("reachable")) for row in live_server]
    live_server_latency = [row.get("latencyMs") for row in live_server if row.get("reachable")]

    outbound_rows = [row.get("outboundConnectivity") for row in samples if isinstance(row.get("outboundConnectivity"), dict)]
    outbound_requests = [row.get("requests") for row in outbound_rows]
    outbound_successes = [row.get("successes") for row in outbound_rows]
    outbound_failures = [row.get("failures") for row in outbound_rows]
    outbound_retries = [row.get("retries") for row in outbound_rows]
    outbound_recovery_signals = [row.get("recoverySignals") for row in outbound_rows]
    outbound_released_backoffs = [row.get("releasedBackoffs") for row in outbound_rows]
    outbound_latency = [row.get("averageLatencyMs") for row in outbound_rows if row.get("requests")]

    kiosk_rows = [row.get("kioskHeartbeat") or {} for row in samples]
    kiosk_present = [row for row in kiosk_rows if row.get("present")]
    heartbeat_ages = [row.get("ageSeconds") for row in kiosk_present]
    perf_rows = [row.get("frontendPerformance") for row in kiosk_present if isinstance(row.get("frontendPerformance"), dict) and row.get("frontendPerformance")]

    animation_rows = [row.get("animation") or {} for row in perf_rows if isinstance(row.get("animation"), dict)]
    animation_fps = [row.get("fps") for row in animation_rows]
    animation_dropped = [row.get("droppedPct") for row in animation_rows]
    graphics_rows = [row.get("graphics") or {} for row in perf_rows if isinstance(row.get("graphics"), dict)]
    software_graphics = [row for row in graphics_rows if row.get("software")]
    long_counts = [row.get("longTasks", {}).get("count") for row in perf_rows]
    long_totals = [row.get("longTasks", {}).get("totalMs") for row in perf_rows]
    long_max = [row.get("longTasks", {}).get("maxMs") for row in perf_rows]
    page_uptime = finite_numbers([row.get("pageUptimeMs") for row in perf_rows])
    heap_used = [row.get("heap", {}).get("usedBytes") for row in perf_rows if isinstance(row.get("heap"), dict)]
    tiers = sorted({str(row.get("tier") or "") for row in perf_rows if row.get("tier")})
    frontend_connectivity = [row.get("connectivity") or {} for row in perf_rows if isinstance(row.get("connectivity"), dict)]
    frontend_requests = [row.get("requests") for row in frontend_connectivity]
    frontend_successes = [row.get("successes") for row in frontend_connectivity]
    frontend_failures = [row.get("failures") for row in frontend_connectivity]
    frontend_timeouts = [row.get("timeouts") for row in frontend_connectivity]
    frontend_retries = [row.get("retries") for row in frontend_connectivity]
    frontend_online = [bool(row.get("online", True)) for row in frontend_connectivity]

    startup_rows = [row.get("startupIntegrity") or {} for row in samples]
    startup_checked = [row for row in startup_rows if int(row.get("checkedAt") or 0) > 0]
    startup_failed_checked = [row for row in startup_checked if not bool(row.get("ok"))]

    recovery_rows = [row.get("recovery") or {} for row in samples]
    watchdog_rows = [row.get("watchdog") or {} for row in recovery_rows]
    server_restarts = [row.get("serverRestarts") for row in watchdog_rows]
    browser_restarts = [row.get("browserRestarts") for row in watchdog_rows]

    reloads = decrease_event_count(page_uptime, tolerance=5000)
    host_reboots = decrease_event_count(uptimes, tolerance=5)
    outbound_failure_delta = int(counter_delta(outbound_failures))
    frontend_failure_delta = int(counter_delta(frontend_failures))
    frontend_timeout_delta = int(counter_delta(frontend_timeouts))
    recovery_signal_delta = int(counter_delta(outbound_recovery_signals))
    released_backoff_delta = int(counter_delta(outbound_released_backoffs))
    server_restart_delta = int(counter_delta(server_restarts))
    browser_restart_delta = int(counter_delta(browser_restarts))

    final = samples[-1]
    final_kiosk = final.get("kioskHeartbeat") or {}
    final_perf = final_kiosk.get("frontendPerformance") if isinstance(final_kiosk.get("frontendPerformance"), dict) else {}
    final_browser_conn = final_perf.get("connectivity") if isinstance(final_perf.get("connectivity"), dict) else {}
    final_startup = final.get("startupIntegrity") or {}

    def recovered_after_failure(rows):
        failures = finite_numbers([row.get("lastFailureAt") for row in rows])
        successes = finite_numbers([row.get("lastSuccessAt") for row in rows])
        last_failure = max(failures, default=0)
        return last_failure <= 0 or max(successes, default=0) >= last_failure

    def latest_failure_kind(rows):
        newest = None
        newest_at = -1.0
        for row in rows:
            try:
                failed_at = float(row.get("lastFailureAt") or 0)
            except (TypeError, ValueError):
                failed_at = 0
            if failed_at > newest_at:
                newest_at = failed_at
                newest = row
        return str((newest or {}).get("lastFailureKind") or "")

    failure_kind_keys = sorted({str(key) for row in outbound_rows for key in (row.get("failureKinds") or {}).keys()})
    outbound_failure_kinds = {
        key: int(counter_delta([(row.get("failureKinds") or {}).get(key, 0) for row in outbound_rows]))
        for key in failure_kind_keys
    }
    outbound_failure_kinds = {key: value for key, value in outbound_failure_kinds.items() if value}

    observations = []
    if expected and versions and versions != [expected]:
        observations.append(f"Observed LibreDisplay versions {', '.join(versions)}; expected {expected}.")
    if not all(live_server_ok):
        observations.append("The running LibreDisplay system-health endpoint was unreachable for at least one sample.")
    if not all(data_writable):
        observations.append("The LibreDisplay data directory was not writable for at least one sample.")
    if finite_numbers(disk_free_pct) and min(finite_numbers(disk_free_pct)) < 10:
        observations.append("Free storage dropped below 10% during the soak.")
    if finite_numbers(temps) and max(finite_numbers(temps)) >= 80:
        observations.append("Host temperature reached at least 80°C during the soak.")
    elif finite_numbers(temps) and max(finite_numbers(temps)) >= 70:
        observations.append("Host temperature reached at least 70°C during the soak; review cooling before a longer run.")
    if not kiosk_present:
        observations.append("No local kiosk heartbeat was observed. Keep the LibreDisplay kiosk open during the field run.")
    elif finite_numbers(heartbeat_ages) and max(finite_numbers(heartbeat_ages)) >= 90:
        observations.append("The local kiosk heartbeat was at least 90 seconds old during one or more samples.")
    if kiosk_present and not perf_rows:
        observations.append("Kiosk heartbeat data was present, but browser performance telemetry was not yet available.")
    if software_graphics:
        renderer = str(software_graphics[-1].get("renderer") or "software renderer")
        observations.append(f"The kiosk browser reported a software graphics path ({renderer}); fix Chromium/Wayland GPU acceleration before reducing visual quality.")
    if finite_numbers(animation_fps) and min(finite_numbers(animation_fps)) < 15:
        observations.append(f"Kiosk animation pacing fell below 15 FPS (minimum {min(finite_numbers(animation_fps)):.1f}); this is a physical-display/browser performance blocker.")
    elif finite_numbers(animation_fps) and min(finite_numbers(animation_fps)) < 27:
        observations.append(f"Kiosk animation pacing fell below the 30 FPS-class floor (minimum {min(finite_numbers(animation_fps)):.1f}).")
    if reloads:
        observations.append(f"Browser page uptime reset {reloads} time(s), indicating a reload or kiosk restart during the sampled window.")
    if host_reboots:
        observations.append(f"Host uptime reset {host_reboots} time(s), confirming a reboot/power-cycle occurred during the resumable soak.")
    if outbound_failure_delta:
        kind = latest_failure_kind(outbound_rows) or "request"
        observations.append(f"Server-side remote providers recorded {outbound_failure_delta} failed request(s) during the soak; latest category: {kind}.")
    if frontend_failure_delta or frontend_timeout_delta:
        observations.append(f"Browser requests recorded {frontend_failure_delta} failure(s) and {frontend_timeout_delta} timeout(s) during the soak.")
    if recovery_signal_delta:
        observations.append(f"The display reported {recovery_signal_delta} connectivity recovery event(s); {released_backoff_delta} transient provider backoff(s) were released.")
    if server_restart_delta or browser_restart_delta:
        observations.append(f"Watchdog counters recorded {server_restart_delta} server restart(s) and {browser_restart_delta} browser restart(s) during the soak.")
    if startup_failed_checked:
        observations.append("Startup integrity reported a failed checked state during at least one sample.")
    if not observations:
        observations.append("No built-in storage, temperature, writability, heartbeat, version, browser-reload, or connectivity warning condition was observed.")

    first = samples[0]
    first_kiosk = kiosk_present[0] if kiosk_present else {}
    final_heartbeat_age = final_kiosk.get("ageSeconds") if final_kiosk.get("present") else None
    final_disk_free = (final.get("disk") or {}).get("freePercent")
    final_temp = (final.get("hardware") or {}).get("temperatureC")
    return {
        "sampleCount": len(samples),
        "firstSampleAt": first.get("sampledAt"),
        "lastSampleAt": final.get("sampledAt"),
        "sampleGapSeconds": sample_gap_stats(samples),
        "versions": versions,
        "deployment": final.get("deployment"),
        "host": {
            "platform": final.get("platform"),
            "machine": final.get("machine"),
            "hardware": final.get("hardware") or {},
            "load1": stats(load1),
            "temperatureC": stats(temps, 1),
            "memoryAvailableBytes": stats(mem_avail, 0),
            "diskFreePercent": stats(disk_free_pct, 1),
            "dataWritableEverySample": all(data_writable),
            "liveServerReachableEverySample": all(live_server_ok),
            "liveServerOutageEpisodes": false_episode_count(live_server_ok),
            "hostRebootsObserved": host_reboots,
            "liveServerLatencyMs": stats(live_server_latency, 1),
        },
        "connectivity": {
            "server": {
                "requestDelta": int(counter_delta(outbound_requests)),
                "successDelta": int(counter_delta(outbound_successes)),
                "failureDelta": outbound_failure_delta,
                "retryDelta": int(counter_delta(outbound_retries)),
                "recoverySignalDelta": recovery_signal_delta,
                "releasedBackoffDelta": released_backoff_delta,
                "averageLatencyMs": stats(outbound_latency, 1),
                "lastFailureKind": latest_failure_kind(outbound_rows),
                "failureKinds": outbound_failure_kinds,
                "recoveredAfterLastFailure": recovered_after_failure(outbound_rows),
            },
            "browser": {
                "requestDelta": int(counter_delta(frontend_requests)),
                "successDelta": int(counter_delta(frontend_successes)),
                "failureDelta": frontend_failure_delta,
                "timeoutDelta": frontend_timeout_delta,
                "retryDelta": int(counter_delta(frontend_retries)),
                "offlineEpisodes": false_episode_count(frontend_online) if frontend_online else 0,
                "recoveredAfterLastFailure": recovered_after_failure(frontend_connectivity) if frontend_connectivity else False,
            },
        },
        "recovery": {
            "watchdogServerRestartDelta": server_restart_delta,
            "watchdogBrowserRestartDelta": browser_restart_delta,
            "startupIntegrityCheckedSamples": len(startup_checked),
            "startupIntegrityFailedCheckedSamples": len(startup_failed_checked),
            "finalStartupIntegrity": {
                "checked": int(final_startup.get("checkedAt") or 0) > 0,
                "ok": bool(final_startup.get("ok")),
                "version": str(final_startup.get("version") or ""),
            },
        },
        "kiosk": {
            "samplesPresent": len(kiosk_present),
            "endpoint": first_kiosk.get("endpoint"),
            "viewport": first_kiosk.get("viewport"),
            "heartbeatAgeSeconds": stats(heartbeat_ages, 1),
            "browserMetricSamples": len(perf_rows),
            "tiers": tiers,
            "animationFps": stats(animation_fps, 1),
            "animationDroppedPercent": stats(animation_dropped, 1),
            "graphics": graphics_rows[-1] if graphics_rows else {},
            "softwareGraphicsSamples": len(software_graphics),
            "pageReloadsObserved": reloads,
            "longTasks": {
                "latestCount": int(finite_numbers(long_counts)[-1]) if finite_numbers(long_counts) else 0,
                "latestTotalMs": int(finite_numbers(long_totals)[-1]) if finite_numbers(long_totals) else 0,
                "countDelta": int(counter_delta(long_counts)),
                "totalMsDelta": int(counter_delta(long_totals)),
                "maxMsObserved": int(max(finite_numbers(long_max), default=0)),
            },
            "jsHeapUsedBytes": stats(heap_used, 0),
            "maxManagedIntervals": int(max(finite_numbers([row.get("activeIntervals") for row in perf_rows]), default=0)),
            "maxExclusiveRuns": int(max(finite_numbers([row.get("activeExclusiveRuns") for row in perf_rows]), default=0)),
            "longTaskObserverActiveEverySample": bool(perf_rows) and all(bool(row.get("longTaskObserverActive")) for row in perf_rows),
        },
        "finalState": {
            "dataWritable": bool(final.get("dataWritable")),
            "liveServerReachable": bool((final.get("liveServer") or {}).get("reachable")),
            "kioskPresent": bool(final_kiosk.get("present")),
            "kioskHeartbeatAgeSeconds": final_heartbeat_age,
            "browserMetricsPresent": bool(final_perf),
            "browserOnline": bool(final_browser_conn.get("online", True)) if final_browser_conn else False,
            "diskFreePercent": final_disk_free,
            "temperatureC": final_temp,
        },
        "observations": observations,
    }


def assess_readiness(summary, expected, requested_minutes, actual_minutes, interrupted=False, release_gate=False, interval_seconds=15.0):
    checks = []

    def add(check_id, label, ok, detail, required=True):
        checks.append({"id": check_id, "label": label, "ok": bool(ok), "required": bool(required), "detail": str(detail or "")[:300]})

    versions = summary.get("versions") or []
    host = summary.get("host") or {}
    kiosk = summary.get("kiosk") or {}
    final = summary.get("finalState") or {}
    conn = summary.get("connectivity") or {}
    server_conn = conn.get("server") or {}
    browser_conn = conn.get("browser") or {}
    recovery = summary.get("recovery") or {}
    startup = recovery.get("finalStartupIntegrity") or {}
    temp_max = (host.get("temperatureC") or {}).get("max")
    disk_min = (host.get("diskFreePercent") or {}).get("min")
    final_heartbeat = final.get("kioskHeartbeatAgeSeconds")

    add("version", "LibreDisplay version is consistent", bool(expected) and versions == [expected], f"observed={versions or 'none'} expected={expected or 'unknown'}")
    add("data-writable", "Data directory remained writable", bool(host.get("dataWritableEverySample")), "all sampled writes remained available")
    add("server-final", "Local LibreDisplay server recovered", bool(final.get("liveServerReachable")), "final system-health probe is reachable")
    add("kiosk-final", "Kiosk heartbeat recovered", bool(final.get("kioskPresent")) and final_heartbeat is not None and float(final_heartbeat) < 90, f"final heartbeat age={final_heartbeat if final_heartbeat is not None else 'missing'}s")
    add("browser-final", "Browser connectivity recovered", bool(final.get("browserMetricsPresent")) and bool(final.get("browserOnline")), f"browser metrics present={bool(final.get('browserMetricsPresent'))}, online={bool(final.get('browserOnline'))}")
    add("server-request-recovery", "Server/provider requests recovered after the last observed failure", bool(server_conn.get("recoveredAfterLastFailure")), f"failures={server_conn.get('failureDelta', 0)}")
    add("browser-request-recovery", "Browser requests recovered after the last observed failure", bool(browser_conn.get("recoveredAfterLastFailure")), f"failures={browser_conn.get('failureDelta', 0)}, timeouts={browser_conn.get('timeoutDelta', 0)}")
    add("startup-integrity", "Startup integrity is checked and healthy", bool(startup.get("checked")) and bool(startup.get("ok")) and str(startup.get("version") or "") == expected, f"checked={bool(startup.get('checked'))}, ok={bool(startup.get('ok'))}, version={startup.get('version') or 'unknown'}", required=release_gate)
    add("startup-history", "No checked startup-integrity failure was sampled", int(recovery.get("startupIntegrityFailedCheckedSamples") or 0) == 0, f"failed checked samples={int(recovery.get('startupIntegrityFailedCheckedSamples') or 0)}", required=release_gate)
    add("disk", "Free storage stayed above the critical floor", disk_min is None or float(disk_min) >= 5, f"minimum free storage={disk_min if disk_min is not None else 'unknown'}%")
    add("temperature", "Host stayed below the critical thermal floor", temp_max is None or float(temp_max) < 85, f"maximum temperature={temp_max if temp_max is not None else 'unknown'}°C")

    if release_gate:
        required_duration = max(RELEASE_GATE_MINUTES, float(requested_minutes or 0))
        add("duration", "Release soak reached the required wall-clock duration", float(actual_minutes or 0) + (1 / 60) >= required_duration, f"actual={round(float(actual_minutes or 0), 2)}m required={round(required_duration, 2)}m")
        interval = max(1.0, float(interval_seconds or 15.0))
        expected_samples = max(1, int((float(actual_minutes or 0) * 60.0) / interval) + 1)
        sample_count = int(summary.get("sampleCount") or 0)
        sample_coverage = min(1.0, sample_count / expected_samples)
        maximum_gap = (summary.get("sampleGapSeconds") or {}).get("max")
        maximum_allowed_gap = max(600.0, interval * 3.0)
        add("sampling-coverage", "Release soak retained continuous sampling coverage", sample_coverage >= 0.90, f"samples={sample_count} expected≈{expected_samples} coverage={round(sample_coverage * 100, 1)}%")
        add("sample-gap", "Release soak did not disappear for an extended period", maximum_gap is not None and float(maximum_gap) <= maximum_allowed_gap, f"maximum gap={maximum_gap if maximum_gap is not None else 'unknown'}s allowed={round(maximum_allowed_gap, 1)}s")
        add("not-interrupted", "Release soak finished its current session cleanly", not interrupted, f"interrupted={bool(interrupted)}")
        add("network-recovery-exercised", "A real display/server connectivity recovery was exercised", int(server_conn.get("recoverySignalDelta") or 0) >= 1, f"recovery signals={int(server_conn.get('recoverySignalDelta') or 0)}")
        add("host-reboot-exercised", "A host reboot/power-cycle was exercised and the soak resumed", int(host.get("hostRebootsObserved") or 0) >= 1, f"host reboot events={int(host.get('hostRebootsObserved') or 0)}")
        kiosk_recovery_events = int(kiosk.get("pageReloadsObserved") or 0) + int(recovery.get("watchdogBrowserRestartDelta") or 0)
        add("kiosk-recovery-exercised", "A browser/kiosk recovery was exercised", kiosk_recovery_events >= 1, f"page reloads={int(kiosk.get('pageReloadsObserved') or 0)}, watchdog browser restarts={int(recovery.get('watchdogBrowserRestartDelta') or 0)}")

    required_failures = [row for row in checks if row["required"] and not row["ok"]]
    if required_failures:
        status = "incomplete" if release_gate and any(row["id"] in {"duration", "not-interrupted", "network-recovery-exercised", "host-reboot-exercised", "kiosk-recovery-exercised"} for row in required_failures) and not any(row["id"] not in {"duration", "not-interrupted", "network-recovery-exercised", "host-reboot-exercised", "kiosk-recovery-exercised"} for row in required_failures) else "fail"
    else:
        status = "pass"

    warnings = []
    if temp_max is not None and 70 <= float(temp_max) < 85:
        warnings.append(f"Peak host temperature was {temp_max}°C; review enclosure cooling if this is sustained.")
    if disk_min is not None and 5 <= float(disk_min) < 10:
        warnings.append(f"Free storage dropped to {disk_min}%; increase available storage before long-term unattended use.")
    if int(host.get("liveServerOutageEpisodes") or 0):
        warnings.append(f"The local server was unreachable during {int(host.get('liveServerOutageEpisodes') or 0)} sampled outage episode(s) and should be confirmed recovered in final state.")
    if int(browser_conn.get("offlineEpisodes") or 0):
        warnings.append(f"Browser connectivity was offline during {int(browser_conn.get('offlineEpisodes') or 0)} sampled episode(s); final state is used to confirm recovery.")
    if int(kiosk.get("pageReloadsObserved") or 0) > 5:
        warnings.append(f"The browser reloaded/restarted {int(kiosk.get('pageReloadsObserved') or 0)} times; investigate if more than the deliberate recovery test.")

    return {
        "status": status,
        "releaseGate": bool(release_gate),
        "readyToPublish": bool(release_gate and status == "pass"),
        "requiredChecks": sum(1 for row in checks if row["required"]),
        "passedRequiredChecks": sum(1 for row in checks if row["required"] and row["ok"]),
        "checks": checks,
        "warnings": warnings,
    }


def render_markdown(report):
    summary = report["summary"]
    assessment = report.get("assessment") or {}
    host = summary.get("host") or {}
    kiosk = summary.get("kiosk") or {}
    hardware = host.get("hardware") or {}
    load = host.get("load1") or {}
    temp = host.get("temperatureC") or {}
    mem = host.get("memoryAvailableBytes") or {}
    disk = host.get("diskFreePercent") or {}
    long_tasks = kiosk.get("longTasks") or {}
    connectivity = summary.get("connectivity") or {}
    server_conn = connectivity.get("server") or {}
    browser_conn = connectivity.get("browser") or {}
    recovery = summary.get("recovery") or {}
    final_state = summary.get("finalState") or {}

    def fmt_bytes(value):
        try:
            n = float(value)
        except (TypeError, ValueError):
            return "n/a"
        units = ["B", "KiB", "MiB", "GiB", "TiB"]
        idx = 0
        while n >= 1024 and idx < len(units) - 1:
            n /= 1024
            idx += 1
        return f"{n:.1f} {units[idx]}"

    status = str(assessment.get("status") or "unknown").upper()
    lines = [
        f"# LibreDisplay v{report.get('libreDisplayVersion') or 'unknown'} field-readiness soak",
        "",
        f"- Assessment: **{status}**",
        f"- Release gate: {'yes' if report.get('releaseGate') else 'no'}",
        f"- Ready to publish from this field gate: {'yes' if assessment.get('readyToPublish') else 'no'}",
        f"- Label: {report.get('label') or 'unlabeled'}",
        f"- Started: {report.get('startedAt')}",
        f"- Finished: {report.get('finishedAt')}",
        f"- Requested duration: {report.get('requestedDurationMinutes', 0)} minutes",
        f"- Actual wall-clock duration: {report.get('actualDurationMinutes', 0)} minutes",
        f"- Samples: {summary.get('sampleCount', 0)}",
        f"- Deployment: {summary.get('deployment') or 'unknown'}",
        f"- Host: {hardware.get('model') or host.get('machine') or 'unknown'}",
        f"- CPU cores: {hardware.get('cpuCount') or 'unknown'}",
        f"- Memory total: {fmt_bytes(hardware.get('memoryTotalBytes'))}",
        "",
        "## Release-readiness checks",
        "",
    ]
    for row in assessment.get("checks") or []:
        mark = "PASS" if row.get("ok") else ("FAIL" if row.get("required") else "WARN")
        requirement = "required" if row.get("required") else "informational"
        lines.append(f"- **{mark}** — {row.get('label')} ({requirement}) — {row.get('detail')}")
    if assessment.get("warnings"):
        lines.extend(["", "### Warnings", ""])
        lines.extend(f"- {item}" for item in assessment.get("warnings") or [])

    lines.extend([
        "",
        "## Host measurements",
        "",
        f"- Load (1-minute): avg {load.get('avg', 'n/a')}, max {load.get('max', 'n/a')}",
        f"- Temperature: avg {temp.get('avg', 'n/a')}°C, max {temp.get('max', 'n/a')}°C",
        f"- Minimum available memory: {fmt_bytes(mem.get('min'))}",
        f"- Minimum free storage: {disk.get('min', 'n/a')}%",
        f"- Data writable for every sample: {'yes' if host.get('dataWritableEverySample') else 'no'}",
        f"- Live server reachable for every sample: {'yes' if host.get('liveServerReachableEverySample') else 'no'}",
        f"- Sampled local-server outage episodes: {host.get('liveServerOutageEpisodes', 0)}",
        f"- Host reboot/power-cycle events observed: {host.get('hostRebootsObserved', 0)}",
        f"- Live server latency: avg {(host.get('liveServerLatencyMs') or {}).get('avg', 'n/a')} ms, max {(host.get('liveServerLatencyMs') or {}).get('max', 'n/a')} ms",
        f"- Maximum sample gap: {(summary.get('sampleGapSeconds') or {}).get('max', 'n/a')} seconds",
        "",
        "## Connectivity measurements",
        "",
        f"- Server/provider requests during sample window: {server_conn.get('requestDelta', 0)}",
        f"- Server/provider successes: {server_conn.get('successDelta', 0)}",
        f"- Server/provider failures: {server_conn.get('failureDelta', 0)}",
        f"- Server/provider retries: {server_conn.get('retryDelta', 0)}",
        f"- Connectivity recovery signals: {server_conn.get('recoverySignalDelta', 0)}",
        f"- Provider backoffs released after recovery: {server_conn.get('releasedBackoffDelta', 0)}",
        f"- Last server/provider failure category: {server_conn.get('lastFailureKind') or 'none'}",
        f"- Server/provider recovered after last failure: {'yes' if server_conn.get('recoveredAfterLastFailure') else 'no'}",
        f"- Browser requests during sample window: {browser_conn.get('requestDelta', 0)}",
        f"- Browser request successes: {browser_conn.get('successDelta', 0)}",
        f"- Browser request failures: {browser_conn.get('failureDelta', 0)}",
        f"- Browser request timeouts: {browser_conn.get('timeoutDelta', 0)}",
        f"- Browser retries: {browser_conn.get('retryDelta', 0)}",
        f"- Browser offline episodes: {browser_conn.get('offlineEpisodes', 0)}",
        f"- Browser recovered after last failure: {'yes' if browser_conn.get('recoveredAfterLastFailure') else 'no'}",
        "",
        "## Recovery measurements",
        "",
        f"- Watchdog server restart delta: {recovery.get('watchdogServerRestartDelta', 0)}",
        f"- Watchdog browser restart delta: {recovery.get('watchdogBrowserRestartDelta', 0)}",
        f"- Startup-integrity checked samples: {recovery.get('startupIntegrityCheckedSamples', 0)}",
        f"- Startup-integrity failed checked samples: {recovery.get('startupIntegrityFailedCheckedSamples', 0)}",
        f"- Final startup integrity: {'healthy' if (recovery.get('finalStartupIntegrity') or {}).get('ok') else 'not healthy/unchecked'}",
        "",
        "## Kiosk/browser measurements",
        "",
        f"- Kiosk heartbeat samples: {kiosk.get('samplesPresent', 0)}",
        f"- Browser metric samples: {kiosk.get('browserMetricSamples', 0)}",
        f"- Performance tiers observed: {', '.join(kiosk.get('tiers') or []) or 'none'}",
        f"- Browser reload/restart indications: {kiosk.get('pageReloadsObserved', 0)}",
        f"- Long tasks during sampled window: {long_tasks.get('countDelta', 0)} totaling {long_tasks.get('totalMsDelta', 0)} ms",
        f"- Current cumulative long-task counter: {long_tasks.get('latestCount', 0)} totaling {long_tasks.get('latestTotalMs', 0)} ms",
        f"- Longest observed long task: {long_tasks.get('maxMsObserved', 0)} ms",
        f"- Peak JS heap observed: {fmt_bytes((kiosk.get('jsHeapUsedBytes') or {}).get('max'))}",
        f"- Maximum managed intervals: {kiosk.get('maxManagedIntervals', 0)}",
        f"- Maximum concurrent exclusive jobs: {kiosk.get('maxExclusiveRuns', 0)}",
        "",
        "## Final recovery state",
        "",
        f"- Local server reachable: {'yes' if final_state.get('liveServerReachable') else 'no'}",
        f"- Data writable: {'yes' if final_state.get('dataWritable') else 'no'}",
        f"- Kiosk heartbeat present: {'yes' if final_state.get('kioskPresent') else 'no'}",
        f"- Kiosk heartbeat age: {final_state.get('kioskHeartbeatAgeSeconds') if final_state.get('kioskHeartbeatAgeSeconds') is not None else 'n/a'} seconds",
        f"- Browser online: {'yes' if final_state.get('browserOnline') else 'no'}",
        "",
        "## Observations",
        "",
    ])
    lines.extend(f"- {item}" for item in summary.get("observations") or ["None recorded."])
    lines.extend([
        "",
        "This report is intentionally privacy-safe: it does not include calendar/background URLs, weather coordinates, integration credentials, account secrets, or browsing history.",
        "",
    ])
    return "\n".join(lines)


def default_output_path(release_gate=False):
    _, data_root = configured_runtime()
    if release_gate:
        return data_root / "field-readiness-release-gate.json"
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return data_root / f"field-readiness-{stamp}.json"


def journal_path(output):
    return output.with_name(output.name + ".journal.jsonl")


def atomic_write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(tmp, path)
    try:
        directory_fd = os.open(str(path.parent), os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    except OSError:
        pass


def write_journal_header(path, header):
    atomic_write_text(path, json.dumps({"type": "header", **header}, sort_keys=True) + "\n")


def append_journal_sample(path, sample, force_sync=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"type": "sample", "sample": sample}, separators=(",", ":"), sort_keys=True) + "\n")
        handle.flush()
        if force_sync:
            os.fsync(handle.fileno())


def load_journal(path):
    header = None
    samples = []
    discarded = 0
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError as exc:
        raise RuntimeError(f"Could not read resumable field journal: {exc}") from exc
    for index, line in enumerate(lines):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            if index == len(lines) - 1:
                discarded += 1
                continue
            raise RuntimeError("Field-readiness journal is corrupt before its final line.")
        if row.get("type") == "header" and header is None:
            header = row
        elif row.get("type") == "sample" and isinstance(row.get("sample"), dict):
            samples.append(row["sample"])
    if not isinstance(header, dict):
        raise RuntimeError("Field-readiness journal is missing its header.")
    return header, samples, discarded


def elapsed_minutes(started_at, finished_at=None):
    started = parse_utc(started_at)
    finished = parse_utc(finished_at or utc_now())
    if not started or not finished:
        return 0.0
    return max(0.0, (finished - started).total_seconds() / 60.0)


def build_report(header, samples, finished_at, interrupted=False, complete=False, discarded_journal_lines=0):
    expected = str(header.get("libreDisplayVersion") or expected_version())
    requested = float(header.get("requestedDurationMinutes") or 0)
    actual = round(elapsed_minutes(header.get("startedAt"), finished_at), 3)
    summary = summarize_samples(samples, expected)
    assessment = assess_readiness(
        summary,
        expected,
        requested,
        actual,
        interrupted=interrupted,
        release_gate=bool(header.get("releaseGate")),
        interval_seconds=float(header.get("intervalSeconds") or 15),
    )
    if discarded_journal_lines:
        summary.setdefault("observations", []).append(f"Ignored {discarded_journal_lines} incomplete final journal line(s) left by an interrupted write.")
    return {
        "schema": 2,
        "libreDisplayVersion": expected,
        "label": str(header.get("label") or "")[:120],
        "startedAt": header.get("startedAt"),
        "finishedAt": finished_at,
        "requestedDurationMinutes": requested,
        "actualDurationMinutes": actual,
        "intervalSeconds": float(header.get("intervalSeconds") or 15),
        "releaseGate": bool(header.get("releaseGate")),
        "resumed": bool(header.get("resumed")),
        "interrupted": bool(interrupted),
        "complete": bool(complete),
        "summary": summary,
        "assessment": assessment,
        "samples": samples,
    }


def write_report(report, output):
    markdown = output.with_suffix(".md")
    atomic_write_text(output, json.dumps(report, indent=2, sort_keys=True) + "\n")
    atomic_write_text(markdown, render_markdown(report))
    return markdown


def run_soak(deadline_epoch, interval_seconds, journal, samples):
    interrupted = False
    last_sync = time.monotonic()
    try:
        while True:
            sample = collect_sample()
            samples.append(sample)
            now_mono = time.monotonic()
            force_sync = now_mono - last_sync >= JOURNAL_FSYNC_SECONDS
            append_journal_sample(journal, sample, force_sync=force_sync)
            if force_sync:
                last_sync = now_mono
            remaining = deadline_epoch - time.time()
            if remaining <= 0:
                break
            time.sleep(min(interval_seconds, remaining))
    except KeyboardInterrupt:
        interrupted = True
    return samples, interrupted


def main(argv=None):
    parser = argparse.ArgumentParser(description="Collect a privacy-safe LibreDisplay Pi/browser field-readiness soak report.")
    parser.add_argument("--duration-minutes", type=float, default=None, help="How long to sample. Default: 30 minutes, or 720 minutes with --release-gate.")
    parser.add_argument("--interval-seconds", type=float, default=None, help="Seconds between samples. Default: 15; --resume preserves the original interval.")
    parser.add_argument("--once", action="store_true", help="Collect one sample immediately instead of a timed soak.")
    parser.add_argument("--release-gate", action="store_true", help="Run the strict 12-hour release-readiness field gate with reboot/reconnect/kiosk-recovery evidence.")
    parser.add_argument("--resume", action="store_true", help="Resume a prior interrupted/power-cycled run from its append-only journal.")
    parser.add_argument("--label", default="", help="Optional label such as pi3-living-room or pi4-regression.")
    parser.add_argument("--output", type=Path, default=None, help="JSON report path. A Markdown summary is written beside it.")
    args = parser.parse_args(argv)

    duration_minutes = args.duration_minutes
    if duration_minutes is None:
        duration_minutes = RELEASE_GATE_MINUTES if args.release_gate else 30.0
    if duration_minutes < 0:
        parser.error("--duration-minutes must be zero or greater")
    if args.interval_seconds is not None and args.interval_seconds < 1:
        parser.error("--interval-seconds must be at least 1")
    if args.release_gate and args.once:
        parser.error("--once cannot be used with --release-gate")
    if args.release_gate and duration_minutes < RELEASE_GATE_MINUTES:
        parser.error(f"--release-gate requires at least {RELEASE_GATE_MINUTES} minutes")

    output = (args.output or default_output_path(args.release_gate)).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    journal = journal_path(output)
    current_version = expected_version()
    discarded = 0

    if args.resume:
        if not journal.is_file():
            parser.error(f"No resumable field journal exists at {journal}")
        try:
            header, samples, discarded = load_journal(journal)
        except RuntimeError as exc:
            parser.error(str(exc))
        if str(header.get("libreDisplayVersion") or "") != current_version:
            parser.error(f"The resumable soak was started on LibreDisplay v{header.get('libreDisplayVersion')}; installed version is v{current_version}.")
        if bool(header.get("releaseGate")) != bool(args.release_gate):
            parser.error("Resume with the same --release-gate mode used by the original soak.")
        original_interval = float(header.get("intervalSeconds") or 15.0)
        if args.interval_seconds is not None and abs(float(args.interval_seconds) - original_interval) > 1e-9:
            parser.error(f"Resume with the original --interval-seconds value ({original_interval:g}).")
        interval_seconds = original_interval
        if args.duration_minutes is not None:
            header["requestedDurationMinutes"] = float(duration_minutes)
        duration_minutes = float(header.get("requestedDurationMinutes") or duration_minutes)
        if args.label:
            header["label"] = str(args.label)[:120]
        header["resumed"] = True
    else:
        interval_seconds = float(args.interval_seconds if args.interval_seconds is not None else 15.0)
        samples = []
        if journal.exists():
            journal.unlink()
        started_at = utc_now()
        header = {
            "schema": 2,
            "libreDisplayVersion": current_version,
            "label": str(args.label or "")[:120],
            "startedAt": started_at,
            "requestedDurationMinutes": 0 if args.once else float(duration_minutes),
            "intervalSeconds": interval_seconds,
            "releaseGate": bool(args.release_gate),
            "resumed": False,
        }
        write_journal_header(journal, header)

    if args.release_gate:
        print(f"LibreDisplay v{current_version or 'unknown'} release field gate")
        print(f"Resume journal: {journal}")
        if args.resume:
            print(f"Resuming the original soak started at {header.get('startedAt')}.")
        else:
            print("Required real-device exercises during this 12-hour gate:")
            print("1. Disconnect and restore network connectivity long enough for the display to enter recovery.")
            print("2. Reload/restart the LibreDisplay kiosk/browser once and confirm it returns.")
            print("3. Reboot or power-cycle the host once. After it returns, run: libredisplay field-check --release-gate --resume")
        print("The gate only passes when those recovery events are recorded and the final state is healthy.\n")

    started = parse_utc(header.get("startedAt")) or datetime.now(timezone.utc)
    target_seconds = 0.0 if args.once else float(header.get("requestedDurationMinutes") or duration_minutes) * 60.0
    deadline_epoch = started.timestamp() + target_seconds
    if args.once:
        deadline_epoch = time.time()

    samples, interrupted = run_soak(deadline_epoch, interval_seconds, journal, samples)
    if not samples:
        print("Field-readiness collection ended before a sample was saved.", file=sys.stderr)
        return 130 if interrupted else 1

    finished_at = utc_now()
    complete = bool(args.once or (not interrupted and time.time() + 1 >= deadline_epoch))
    report = build_report(header, samples, finished_at, interrupted=interrupted, complete=complete, discarded_journal_lines=discarded)
    markdown = write_report(report, output)

    assessment = report["assessment"]
    summary = report["summary"]
    kiosk = summary.get("kiosk") or {}
    host = summary.get("host") or {}
    print(f"LibreDisplay v{report['libreDisplayVersion'] or 'unknown'} field-readiness report")
    print(f"Assessment: {str(assessment.get('status') or 'unknown').upper()}")
    print(f"Samples: {summary.get('sampleCount', 0)}")
    print(f"Host: {(host.get('hardware') or {}).get('model') or host.get('machine') or 'unknown'}")
    print(f"Host reboots observed: {host.get('hostRebootsObserved', 0)}")
    print(f"Kiosk/browser metric samples: {kiosk.get('browserMetricSamples', 0)}")
    print(f"Browser reload/restart indications: {kiosk.get('pageReloadsObserved', 0)}")
    if interrupted:
        print("Collection ended early after an interrupt; the resumable journal and partial reports were saved.")
    print("Observations:")
    for item in summary.get("observations") or []:
        print(f"- {item}")
    print(f"JSON: {output}")
    print(f"Markdown: {markdown}")
    if journal.exists() and (interrupted or (args.release_gate and assessment.get("status") == "incomplete")):
        print(f"Resume journal: {journal}")
        print("Resume with: libredisplay field-check --release-gate --resume" if args.release_gate else f"Resume with: libredisplay field-check --resume --output {output}")
    elif journal.exists() and args.release_gate and assessment.get("status") == "fail":
        print(f"Failed gate journal retained for inspection: {journal}")
        print("Correct the failed condition, then start a new release gate rather than resuming this invalid soak.")
    elif journal.exists():
        journal.unlink(missing_ok=True)

    if interrupted:
        return 130
    if args.release_gate:
        return 0 if assessment.get("status") == "pass" else 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
