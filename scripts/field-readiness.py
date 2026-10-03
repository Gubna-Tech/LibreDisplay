#!/usr/bin/env python3
"""Collect a privacy-safe LibreDisplay hardware/browser soak report.

Run this on the LibreDisplay host while the kiosk is open. It samples the same
local system-health payload used by Settings, so no owner token, private feed
URL, coordinates, credentials, or browser history are written to the report.
"""

import argparse
import importlib.util
import json
import math
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SERVER_PATH = PROJECT_ROOT / "app" / "dashboard_server.py"
VERSION_PATH = PROJECT_ROOT / "VERSION"


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_server_module():
    spec = importlib.util.spec_from_file_location("libredisplay_field_server", SERVER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load LibreDisplay dashboard_server.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def expected_version():
    try:
        return VERSION_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def probe_live_server(server):
    port = int(getattr(server, "PORT", 8787) or 8787)
    started = time.monotonic()
    try:
        request = urllib.request.Request(f"http://127.0.0.1:{port}/healthz", headers={"User-Agent": "LibreDisplay field-readiness"})
        with urllib.request.urlopen(request, timeout=3) as response:
            ok = response.status == 200
    except (OSError, urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
        ok = False
    return {"reachable": ok, "latencyMs": round((time.monotonic() - started) * 1000, 1)}


def collect_sample(server):
    payload = server.system_health_payload()
    if not isinstance(payload, dict) or not payload.get("ok"):
        raise RuntimeError("LibreDisplay system health is unavailable")
    return {"sampledAt": utc_now(), "liveServer": probe_live_server(server), **payload}


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


def summarize_samples(samples, expected=""):
    if not samples:
        return {"sampleCount": 0, "observations": ["No system-health samples were collected."]}

    temps = [row.get("hardware", {}).get("temperatureC") for row in samples]
    mem_avail = [row.get("hardware", {}).get("memoryAvailableBytes") for row in samples]
    disk_free_pct = [row.get("disk", {}).get("freePercent") for row in samples]
    load1 = [(row.get("loadAverage") or [None])[0] for row in samples]
    data_writable = [bool(row.get("dataWritable")) for row in samples]
    versions = sorted({str(row.get("version") or "") for row in samples if row.get("version")})
    live_server = [row.get("liveServer") or {} for row in samples]
    live_server_ok = [bool(row.get("reachable")) for row in live_server]
    live_server_latency = [row.get("latencyMs") for row in live_server if row.get("reachable")]

    kiosk_rows = [row.get("kioskHeartbeat") or {} for row in samples]
    kiosk_present = [row for row in kiosk_rows if row.get("present")]
    heartbeat_ages = [row.get("ageSeconds") for row in kiosk_present]
    perf_rows = [row.get("frontendPerformance") for row in kiosk_present if isinstance(row.get("frontendPerformance"), dict) and row.get("frontendPerformance")]

    long_counts = [row.get("longTasks", {}).get("count") for row in perf_rows]
    long_totals = [row.get("longTasks", {}).get("totalMs") for row in perf_rows]
    long_max = [row.get("longTasks", {}).get("maxMs") for row in perf_rows]
    page_uptime = finite_numbers([row.get("pageUptimeMs") for row in perf_rows])
    heap_used = [row.get("heap", {}).get("usedBytes") for row in perf_rows if isinstance(row.get("heap"), dict)]
    tiers = sorted({str(row.get("tier") or "") for row in perf_rows if row.get("tier")})

    reloads = 0
    previous = None
    for current in page_uptime:
        if previous is not None and current + 5000 < previous:
            reloads += 1
        previous = current

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

    observations = []
    if expected and versions and versions != [expected]:
        observations.append(f"Observed LibreDisplay versions {', '.join(versions)}; expected {expected}.")
    if not all(live_server_ok):
        observations.append("The running LibreDisplay /healthz endpoint was unreachable for at least one sample.")
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
    if reloads:
        observations.append(f"Browser page uptime reset {reloads} time(s), indicating a reload or kiosk restart during the sampled window.")
    if not observations:
        observations.append("No built-in storage, temperature, writability, heartbeat, version, or browser-reload warning condition was observed.")

    first = samples[0]
    last = samples[-1]
    first_kiosk = kiosk_present[0] if kiosk_present else {}
    return {
        "sampleCount": len(samples),
        "firstSampleAt": first.get("sampledAt"),
        "lastSampleAt": last.get("sampledAt"),
        "versions": versions,
        "deployment": last.get("deployment"),
        "host": {
            "platform": last.get("platform"),
            "machine": last.get("machine"),
            "hardware": last.get("hardware") or {},
            "load1": stats(load1),
            "temperatureC": stats(temps, 1),
            "memoryAvailableBytes": stats(mem_avail, 0),
            "diskFreePercent": stats(disk_free_pct, 1),
            "dataWritableEverySample": all(data_writable),
            "liveServerReachableEverySample": all(live_server_ok),
            "liveServerLatencyMs": stats(live_server_latency, 1),
        },
        "kiosk": {
            "samplesPresent": len(kiosk_present),
            "endpoint": first_kiosk.get("endpoint"),
            "viewport": first_kiosk.get("viewport"),
            "heartbeatAgeSeconds": stats(heartbeat_ages, 1),
            "browserMetricSamples": len(perf_rows),
            "tiers": tiers,
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
        "observations": observations,
    }


def render_markdown(report):
    summary = report["summary"]
    host = summary.get("host") or {}
    kiosk = summary.get("kiosk") or {}
    hardware = host.get("hardware") or {}
    load = host.get("load1") or {}
    temp = host.get("temperatureC") or {}
    mem = host.get("memoryAvailableBytes") or {}
    disk = host.get("diskFreePercent") or {}
    long_tasks = kiosk.get("longTasks") or {}

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

    lines = [
        f"# LibreDisplay v{report.get('libreDisplayVersion') or 'unknown'} field-readiness soak",
        "",
        f"- Label: {report.get('label') or 'unlabeled'}",
        f"- Started: {report.get('startedAt')}",
        f"- Finished: {report.get('finishedAt')}",
        f"- Samples: {summary.get('sampleCount', 0)}",
        f"- Deployment: {summary.get('deployment') or 'unknown'}",
        f"- Host: {hardware.get('model') or host.get('machine') or 'unknown'}",
        f"- CPU cores: {hardware.get('cpuCount') or 'unknown'}",
        f"- Memory total: {fmt_bytes(hardware.get('memoryTotalBytes'))}",
        "",
        "## Host measurements",
        "",
        f"- Load (1-minute): avg {load.get('avg', 'n/a')}, max {load.get('max', 'n/a')}",
        f"- Temperature: avg {temp.get('avg', 'n/a')}°C, max {temp.get('max', 'n/a')}°C",
        f"- Minimum available memory: {fmt_bytes(mem.get('min'))}",
        f"- Minimum free storage: {disk.get('min', 'n/a')}%",
        f"- Data writable for every sample: {'yes' if host.get('dataWritableEverySample') else 'no'}",
        f"- Live server reachable for every sample: {'yes' if host.get('liveServerReachableEverySample') else 'no'}",
        f"- Live server latency: avg {(host.get('liveServerLatencyMs') or {}).get('avg', 'n/a')} ms, max {(host.get('liveServerLatencyMs') or {}).get('max', 'n/a')} ms",
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
        "## Observations",
        "",
    ]
    lines.extend(f"- {item}" for item in summary.get("observations") or ["None recorded."])
    lines.extend([
        "",
        "This report is intentionally privacy-safe: it does not include calendar/background URLs, weather coordinates, integration credentials, account secrets, or browsing history.",
        "",
    ])
    return "\n".join(lines)


def default_output_path():
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return PROJECT_ROOT / "data" / f"field-readiness-{stamp}.json"


def run_soak(server, duration_seconds, interval_seconds):
    samples = []
    started = time.monotonic()
    deadline = started + max(0.0, duration_seconds)
    interrupted = False
    try:
        while True:
            samples.append(collect_sample(server))
            if duration_seconds <= 0:
                break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            time.sleep(min(interval_seconds, remaining))
    except KeyboardInterrupt:
        interrupted = True
    return samples, interrupted


def main(argv=None):
    parser = argparse.ArgumentParser(description="Collect a privacy-safe LibreDisplay Pi/browser field-readiness soak report.")
    parser.add_argument("--duration-minutes", type=float, default=30.0, help="How long to sample. Default: 30 minutes.")
    parser.add_argument("--interval-seconds", type=float, default=15.0, help="Seconds between samples. Default: 15.")
    parser.add_argument("--once", action="store_true", help="Collect one sample immediately instead of a timed soak.")
    parser.add_argument("--label", default="", help="Optional label such as pi3-living-room or pi4-regression.")
    parser.add_argument("--output", type=Path, default=None, help="JSON report path. A Markdown summary is written beside it.")
    args = parser.parse_args(argv)

    if args.duration_minutes < 0:
        parser.error("--duration-minutes must be zero or greater")
    if args.interval_seconds < 1:
        parser.error("--interval-seconds must be at least 1")

    output = (args.output or default_output_path()).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    markdown = output.with_suffix(".md")
    server = load_server_module()
    started_at = utc_now()
    duration = 0.0 if args.once else args.duration_minutes * 60.0

    samples, interrupted = run_soak(server, duration, args.interval_seconds)
    if not samples:
        print("Field-readiness collection ended before a sample was saved.", file=sys.stderr)
        return 130 if interrupted else 1
    finished_at = utc_now()
    report = {
        "schema": 1,
        "libreDisplayVersion": expected_version(),
        "label": str(args.label or "")[:120],
        "startedAt": started_at,
        "finishedAt": finished_at,
        "requestedDurationMinutes": 0 if args.once else args.duration_minutes,
        "intervalSeconds": args.interval_seconds,
        "interrupted": interrupted,
        "summary": summarize_samples(samples, expected_version()),
        "samples": samples,
    }
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    markdown.write_text(render_markdown(report), encoding="utf-8")

    summary = report["summary"]
    kiosk = summary.get("kiosk") or {}
    host = summary.get("host") or {}
    print(f"LibreDisplay v{report['libreDisplayVersion'] or 'unknown'} field-readiness report")
    print(f"Samples: {summary.get('sampleCount', 0)}")
    print(f"Host: {(host.get('hardware') or {}).get('model') or host.get('machine') or 'unknown'}")
    print(f"Kiosk/browser metric samples: {kiosk.get('browserMetricSamples', 0)}")
    print(f"Browser reload/restart indications: {kiosk.get('pageReloadsObserved', 0)}")
    if interrupted:
        print("Collection ended early after an interrupt; partial samples were saved.")
    print("Observations:")
    for item in summary.get("observations") or []:
        print(f"- {item}")
    print(f"JSON: {output}")
    print(f"Markdown: {markdown}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
