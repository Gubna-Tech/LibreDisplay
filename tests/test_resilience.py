import importlib.util
import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
START = (ROOT / "scripts" / "start.sh").read_text(encoding="utf-8")
VIEWER = (ROOT / "scripts" / "viewer-setup.sh").read_text(encoding="utf-8")

_TEMP = tempfile.TemporaryDirectory(prefix="libredisplay-resilience-")
os.environ["DASHBOARD_DATA_DIR"] = _TEMP.name
os.environ["DASHBOARD_REMOTE_ENABLED"] = "0"
spec = importlib.util.spec_from_file_location("libredisplay_resilience_server", ROOT / "app" / "dashboard_server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class ResilienceContractTests(unittest.TestCase):
    def test_screen_care_is_layout_safe_and_configurable(self):
        for marker in (
            "burnInProtection:false",
            "burnInIdleMin:30",
            "burnInBrightnessPct:40",
            "function applyScreenCarePreferences",
            "function updateScreenCareState",
            "body.ld-burnin-dim #screen-care-overlay",
            "layoutEditorActive||remoteLayoutProxyActive||LAYOUT_PREVIEW_MODE",
        ):
            self.assertIn(marker, HTML)
        self.assertIn('id="s-burnin-protection"', HTML)
        self.assertIn('id="s-burnin-idle"', HTML)
        self.assertIn('id="s-burnin-brightness"', HTML)

    def test_display_readiness_reports_without_mutating_layout(self):
        for marker in (
            'id="settings-display-readiness"',
            "function displayReadinessAssessment",
            "function renderDisplayReadiness",
            "function refreshDisplayReadiness",
            "Browser visual scale is 100%.",
            "saved custom layout is never changed automatically",
        ):
            self.assertIn(marker, HTML)

    def test_offline_reconnect_path_preserves_last_good_data(self):
        for marker in (
            "serverConnectionState",
            "Reconnecting · showing last known data",
            "Provider delayed · showing last known data",
            "liveEventSource.onopen=()=>setServerConnectionState('online')",
            "retryDisplayHydration('server-reconnected')",
            "window.addEventListener('offline'",
        ):
            self.assertIn(marker, HTML)

    def test_native_kiosk_watchdog_checks_server_and_browser_heartbeat(self):
        self.assertIn('DASHBOARD_KIOSK_WATCHDOG', START)
        self.assertIn('/healthz', START)
        self.assertIn('kiosk-heartbeat.json', START)
        self.assertIn('server health check failed repeatedly', START)
        self.assertIn('kiosk heartbeat became stale', START)
        self.assertIn('stat -c %Y', START)

    def test_viewer_keeps_display_timers_active(self):
        self.assertIn('--disable-background-timer-throttling', VIEWER)
        self.assertIn('--disable-backgrounding-occluded-windows', VIEWER)
        self.assertIn('--disable-renderer-backgrounding', VIEWER)

    def test_system_health_exposes_privacy_safe_kiosk_heartbeat(self):
        with tempfile.TemporaryDirectory(prefix="libredisplay-kiosk-heartbeat-") as tmp:
            heartbeat = Path(tmp) / "kiosk-heartbeat.json"
            heartbeat.write_text(json.dumps({
                "lastSeen": time.time() - 5,
                "endpoint": "main",
                "viewportWidth": 1920,
                "viewportHeight": 1080,
                "version": "1.5.0",
            }), encoding="utf-8")
            with mock.patch.object(server, "KIOSK_HEARTBEAT_PATH", heartbeat):
                payload = server.system_health_payload()
        kiosk = payload["kioskHeartbeat"]
        self.assertTrue(kiosk["present"])
        self.assertEqual(kiosk["viewport"], "1920×1080")
        self.assertEqual(kiosk["endpoint"], "main")
        self.assertNotIn("userAgent", kiosk)
        self.assertNotIn("token", json.dumps(kiosk).lower())


if __name__ == "__main__":
    unittest.main()
