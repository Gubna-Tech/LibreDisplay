import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "field-readiness.py"
spec = importlib.util.spec_from_file_location("libredisplay_field_readiness_test", SCRIPT)
field = importlib.util.module_from_spec(spec)
spec.loader.exec_module(field)


class FieldReadinessTests(unittest.TestCase):
    def test_summary_tracks_pi_and_browser_soak_metrics_without_private_data(self):
        base = {
            "version": "1.6.2",
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
            row["hardware"] = dict(base["hardware"], memoryAvailableBytes=(512-index*16) * 1024 * 1024, temperatureC=55+index)
            row["kioskHeartbeat"] = {
                "present": True,
                "ageSeconds": 2 + index,
                "endpoint": "main",
                "viewport": "1920×1080",
                "version": "1.6.2",
                "frontendPerformance": {
                    "tier": "constrained",
                    "pageUptimeMs": uptime,
                    "activeIntervals": 5,
                    "activeExclusiveRuns": index % 2,
                    "longTaskObserverActive": True,
                    "longTasks": {"count": index + 1, "totalMs": (index + 1) * 100, "maxMs": 90 + index * 10},
                    "heap": {"usedBytes": (100 + index * 10) * 1024 * 1024},
                },
            }
            samples.append(row)
        summary = field.summarize_samples(samples, "1.6.2")
        self.assertEqual(summary["sampleCount"], 3)
        self.assertEqual(summary["kiosk"]["browserMetricSamples"], 3)
        self.assertEqual(summary["kiosk"]["pageReloadsObserved"], 0)
        self.assertEqual(summary["kiosk"]["longTasks"]["countDelta"], 2)
        self.assertEqual(summary["kiosk"]["longTasks"]["totalMsDelta"], 200)
        self.assertEqual(summary["host"]["temperatureC"]["max"], 57.0)
        self.assertIn("No built-in storage", summary["observations"][0])
        text = field.render_markdown({
            "label": "pi3",
            "startedAt": "start",
            "finishedAt": "finish",
            "summary": summary,
        })
        self.assertIn("Raspberry Pi 3", text)
        self.assertNotIn("token", text.lower())
        self.assertNotIn("must-not-survive", text.lower())

    def test_summary_flags_stale_heartbeat_and_browser_restart(self):
        samples = []
        for index, uptime in enumerate((60000, 1000)):
            samples.append({
                "sampledAt": f"t{index}",
                "version": "1.6.2",
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
        summary = field.summarize_samples(samples, "1.6.2")
        joined = " ".join(summary["observations"])
        self.assertIn("70°C", joined)
        self.assertIn("90 seconds", joined)
        self.assertIn("reload or kiosk restart", joined)


if __name__ == "__main__":
    unittest.main()
