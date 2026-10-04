import importlib.util
import json
import unittest
from unittest import mock
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "field-readiness.py"
spec = importlib.util.spec_from_file_location("libredisplay_field_readiness_test", SCRIPT)
field = importlib.util.module_from_spec(spec)
spec.loader.exec_module(field)


class FieldReadinessTests(unittest.TestCase):
    def test_summary_tracks_pi_and_browser_soak_metrics_without_private_data(self):
        base = {
            "version": "1.8.6",
            "deployment": "native",
            "platform": "Linux",
            "machine": "armv7l",
            "hardware": {
                "model": "Raspberry Pi 3 Model B Plus Rev 1.3",
                "cpuCount": 4,
                "memoryTotalBytes": 1024 * 1024 * 1024,
                "memoryAvailableBytes": 512 * 1024 * 1024,
                "temperatureC": 55.0,
            },
            "loadAverage": [0.5, 0.4, 0.3],
            "disk": {"freePercent": 70.0},
            "dataWritable": True,
        }
        samples = []
        for index, uptime in enumerate((10000, 25000, 40000)):
            row = dict(base)
            row["sampledAt"] = f"2026-10-03T12:00:{index:02d}Z"
            row["liveServer"] = {"reachable": True, "latencyMs": 4 + index}
            row["outboundConnectivity"] = {"requests": 10 + index * 3, "failures": index, "retries": index * 2, "recoverySignals": index, "releasedBackoffs": index, "averageLatencyMs": 100 + index * 10, "lastFailureKind": "timeout" if index else "", "failureKinds": {"timeout": index}}
            row["hardware"] = dict(base["hardware"], memoryAvailableBytes=(512-index*16) * 1024 * 1024, temperatureC=55+index)
            row["kioskHeartbeat"] = {
                "present": True,
                "ageSeconds": 2 + index,
                "endpoint": "main",
                "viewport": "1920×1080",
                "version": "1.8.6",
                "frontendPerformance": {
                    "tier": "constrained",
                    "pageUptimeMs": uptime,
                    "activeIntervals": 5,
                    "activeExclusiveRuns": index % 2,
                    "longTaskObserverActive": True,
                    "longTasks": {"count": index + 1, "totalMs": (index + 1) * 100, "maxMs": 90 + index * 10},
                    "heap": {"usedBytes": (100 + index * 10) * 1024 * 1024},
                    "connectivity": {"requests": 20 + index * 5, "failures": index, "timeouts": index, "retries": index * 2, "online": True},
                },
            }
            samples.append(row)
        summary = field.summarize_samples(samples, "1.8.6")
        self.assertEqual(summary["sampleCount"], 3)
        self.assertEqual(summary["kiosk"]["browserMetricSamples"], 3)
        self.assertEqual(summary["kiosk"]["pageReloadsObserved"], 0)
        self.assertEqual(summary["kiosk"]["longTasks"]["countDelta"], 2)
        self.assertEqual(summary["kiosk"]["longTasks"]["totalMsDelta"], 200)
        self.assertEqual(summary["host"]["temperatureC"]["max"], 57.0)
        self.assertEqual(summary["connectivity"]["server"]["requestDelta"], 6)
        self.assertEqual(summary["connectivity"]["server"]["failureDelta"], 2)
        self.assertEqual(summary["connectivity"]["browser"]["timeoutDelta"], 2)
        self.assertTrue(any("provider" in item.lower() or "browser requests" in item.lower() for item in summary["observations"]))
        text = field.render_markdown({
            "label": "pi3",
            "startedAt": "start",
            "finishedAt": "finish",
            "summary": summary,
        })
        self.assertIn("Raspberry Pi 3", text)
        self.assertIn("Connectivity measurements", text)
        self.assertIn("Provider backoffs released after recovery", text)
        self.assertNotIn("token", text.lower())
        self.assertNotIn("must-not-survive", text.lower())

    def test_summary_flags_stale_heartbeat_and_browser_restart(self):
        samples = []
        for index, uptime in enumerate((60000, 1000)):
            samples.append({
                "sampledAt": f"t{index}",
                "version": "1.8.6",
                "deployment": "native",
                "platform": "Linux",
                "machine": "armv7l",
                "hardware": {"cpuCount": 4, "temperatureC": 72, "memoryAvailableBytes": 1000},
                "loadAverage": [1.0],
                "disk": {"freePercent": 50},
                "dataWritable": True,
                "liveServer": {"reachable": True, "latencyMs": 5},
                "kioskHeartbeat": {
                    "present": True,
                    "ageSeconds": 120 if index else 2,
                    "frontendPerformance": {"pageUptimeMs": uptime, "longTasks": {"count": index, "totalMs": index * 100, "maxMs": 100}},
                },
            })
        summary = field.summarize_samples(samples, "1.8.6")
        joined = " ".join(summary["observations"])
        self.assertIn("70°C", joined)
        self.assertIn("90 seconds", joined)
        self.assertIn("reload or kiosk restart", joined)

    def test_release_gate_passes_only_after_reboot_reconnect_and_kiosk_recovery(self):
        samples = []
        for index, values in enumerate((
            {"uptime": 10000, "page": 100000, "signals": 0, "server_restarts": 0, "browser_restarts": 0, "last_success": 100, "last_failure": 0},
            {"uptime": 11000, "page": 160000, "signals": 0, "server_restarts": 0, "browser_restarts": 0, "last_success": 100, "last_failure": 200},
            {"uptime": 120, "page": 1000, "signals": 1, "server_restarts": 1, "browser_restarts": 1, "last_success": 300, "last_failure": 200},
            {"uptime": 240, "page": 121000, "signals": 1, "server_restarts": 1, "browser_restarts": 1, "last_success": 400, "last_failure": 200},
        )):
            samples.append({
                "sampledAt": f"2026-10-03T{index:02d}:00:00Z",
                "version": "1.8.6",
                "deployment": "native",
                "platform": "Linux",
                "machine": "armv7l",
                "uptimeSeconds": values["uptime"],
                "hardware": {"model": "Raspberry Pi 4", "cpuCount": 4, "temperatureC": 58, "memoryAvailableBytes": 512 * 1024 * 1024},
                "loadAverage": [0.5],
                "disk": {"freePercent": 60},
                "dataWritable": True,
                "liveServer": {"reachable": True, "latencyMs": 5},
                "startupIntegrity": {"ok": True, "checkedAt": 100 + index, "version": "1.8.6", "coreFiles": 10, "pythonFiles": 20, "frontendVerified": True},
                "outboundConnectivity": {
                    "requests": 10 + index * 5, "successes": 9 + index * 4, "failures": index, "retries": index,
                    "recoverySignals": values["signals"], "releasedBackoffs": values["signals"],
                    "lastSuccessAt": values["last_success"], "lastFailureAt": values["last_failure"], "failureKinds": {"timeout": index},
                },
                "recovery": {"watchdog": {"serverRestarts": values["server_restarts"], "browserRestarts": values["browser_restarts"]}},
                "kioskHeartbeat": {
                    "present": True, "ageSeconds": 2, "endpoint": "main", "viewport": "1920×1080",
                    "frontendPerformance": {
                        "tier": "standard", "pageUptimeMs": values["page"], "activeIntervals": 5, "activeExclusiveRuns": 0,
                        "longTaskObserverActive": True, "longTasks": {"count": index, "totalMs": index * 50, "maxMs": 50},
                        "connectivity": {
                            "requests": 20 + index * 5, "successes": 19 + index * 4, "failures": index, "timeouts": index, "retries": index,
                            "lastSuccessAt": values["last_success"] * 1000, "lastFailureAt": values["last_failure"] * 1000, "online": True,
                        },
                    },
                },
            })
        summary = field.summarize_samples(samples, "1.8.6")
        self.assertEqual(summary["host"]["hostRebootsObserved"], 1)
        self.assertEqual(summary["kiosk"]["pageReloadsObserved"], 1)
        self.assertEqual(summary["connectivity"]["server"]["recoverySignalDelta"], 1)
        summary["sampleCount"] = 2881
        summary["sampleGapSeconds"] = {"min": 15.0, "avg": 15.0, "max": 180.0}
        assessment = field.assess_readiness(summary, "1.8.6", 720, 720.1, interrupted=False, release_gate=True, interval_seconds=15)
        self.assertEqual(assessment["status"], "pass")
        self.assertTrue(assessment["readyToPublish"])

        broken = dict(summary)
        broken["sampleCount"] = 20
        broken["sampleGapSeconds"] = {"max": 36000.0}
        failed = field.assess_readiness(broken, "1.8.6", 720, 720.1, interrupted=False, release_gate=True, interval_seconds=15)
        failed_ids = {row["id"] for row in failed["checks"] if row["required"] and not row["ok"]}
        self.assertEqual(failed["status"], "fail")
        self.assertIn("sampling-coverage", failed_ids)
        self.assertIn("sample-gap", failed_ids)

    def test_release_gate_is_incomplete_without_required_fault_recovery_exercises(self):
        sample = {
            "sampledAt": "2026-10-03T00:00:00Z", "version": "1.8.6", "deployment": "native", "platform": "Linux", "machine": "armv7l",
            "uptimeSeconds": 1000, "hardware": {"temperatureC": 55, "memoryAvailableBytes": 1000}, "loadAverage": [0.1],
            "disk": {"freePercent": 50}, "dataWritable": True, "liveServer": {"reachable": True, "latencyMs": 4},
            "startupIntegrity": {"ok": True, "checkedAt": 1, "version": "1.8.6"},
            "outboundConnectivity": {"requests": 1, "successes": 1, "failures": 0, "recoverySignals": 0, "releasedBackoffs": 0, "lastSuccessAt": 10, "lastFailureAt": 0},
            "recovery": {"watchdog": {"serverRestarts": 0, "browserRestarts": 0}},
            "kioskHeartbeat": {"present": True, "ageSeconds": 2, "frontendPerformance": {"pageUptimeMs": 1000, "longTasks": {}, "connectivity": {"requests": 1, "successes": 1, "failures": 0, "timeouts": 0, "retries": 0, "lastSuccessAt": 10000, "lastFailureAt": 0, "online": True}}},
        }
        summary = field.summarize_samples([sample, dict(sample, sampledAt="2026-10-03T12:00:00Z", uptimeSeconds=44000)], "1.8.6")
        summary["sampleCount"] = 2881
        summary["sampleGapSeconds"] = {"min": 15.0, "avg": 15.0, "max": 15.0}
        assessment = field.assess_readiness(summary, "1.8.6", 720, 720, interrupted=False, release_gate=True, interval_seconds=15)
        self.assertEqual(assessment["status"], "incomplete")
        failed = {row["id"] for row in assessment["checks"] if row["required"] and not row["ok"]}
        self.assertIn("network-recovery-exercised", failed)
        self.assertIn("host-reboot-exercised", failed)
        self.assertIn("kiosk-recovery-exercised", failed)

    def test_resumable_journal_ignores_only_a_truncated_final_line(self):
        import json
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "gate.json.journal.jsonl"
            header = {"schema": 2, "libreDisplayVersion": "1.8.6", "startedAt": "2026-10-03T00:00:00Z", "requestedDurationMinutes": 720, "intervalSeconds": 15, "releaseGate": True}
            field.write_journal_header(path, header)
            field.append_journal_sample(path, {"sampledAt": "2026-10-03T00:00:15Z", "version": "1.8.6"}, force_sync=True)
            with path.open("a", encoding="utf-8") as handle:
                handle.write('{"type":"sample","sample":')
            loaded_header, samples, discarded = field.load_journal(path)
            self.assertEqual(loaded_header["libreDisplayVersion"], "1.8.6")
            self.assertEqual(len(samples), 1)
            self.assertEqual(discarded, 1)

    def test_live_collection_uses_running_server_health_payload(self):
        payload = {
            "ok": True, "version": "1.8.6", "deployment": "native", "platform": "Linux", "machine": "armv7l",
            "hardware": {}, "loadAverage": [], "disk": {"freePercent": 50}, "dataWritable": True,
            "outboundConnectivity": {"requests": 77, "successes": 70, "failures": 7, "retries": 4, "lastSuccessAt": 20, "lastFailureAt": 10},
            "kioskHeartbeat": {"present": False}, "startupIntegrity": {}, "recovery": {},
            "update": {"error": "must-not-survive"}, "futurePrivateField": "must-not-survive",
        }

        class Response:
            status = 200
            def __enter__(self):
                return self
            def __exit__(self, *args):
                return False
            def read(self, _limit):
                return json.dumps(payload).encode("utf-8")

        with mock.patch.object(field.urllib.request, "urlopen", return_value=Response()):
            sample = field.collect_sample()
        self.assertTrue(sample["liveServer"]["reachable"])
        self.assertEqual(sample["outboundConnectivity"]["requests"], 77)
        self.assertNotIn("update", sample)
        self.assertNotIn("futurePrivateField", sample)
        self.assertNotIn("must-not-survive", json.dumps(sample))
        self.assertFalse(hasattr(field, "load_server_module"))

    def test_recovery_after_failure_survives_counter_reset(self):
        base = {
            "version": "1.8.6", "deployment": "native", "platform": "Linux", "machine": "armv7l",
            "hardware": {}, "loadAverage": [], "disk": {"freePercent": 50}, "dataWritable": True,
            "liveServer": {"reachable": True, "latencyMs": 4}, "kioskHeartbeat": {"present": False},
        }
        first = dict(base, sampledAt="2026-10-03T00:00:00Z", outboundConnectivity={"requests": 3, "successes": 1, "failures": 2, "lastSuccessAt": 400, "lastFailureAt": 500, "lastFailureKind": "timeout", "failureKinds": {"timeout": 2}})
        second = dict(base, sampledAt="2026-10-03T00:01:00Z", outboundConnectivity={"requests": 0, "successes": 0, "failures": 0, "lastSuccessAt": 0, "lastFailureAt": 0, "lastFailureKind": "", "failureKinds": {}})
        summary = field.summarize_samples([first, second], "1.8.6")
        self.assertFalse(summary["connectivity"]["server"]["recoveredAfterLastFailure"])
        self.assertEqual(summary["connectivity"]["server"]["lastFailureKind"], "timeout")


if __name__ == "__main__":
    unittest.main()
