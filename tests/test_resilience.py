import importlib.util
import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from frontend_source import frontend_source
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
HTML = frontend_source(ROOT)
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
            "SERVER_RECONNECT_NOTICE_DELAY_MS=8000",
            "Connection interrupted · showing last known data",
            "Provider delayed · showing last known data",
            "liveEventSource.onopen=markServerTransportOpen",
            "liveEventSource.onerror=noteServerTransportError",
            "retryDisplayHydration('server-reconnected')",
            "window.addEventListener('offline'",
        ):
            self.assertIn(marker, HTML)

    def test_transient_live_stream_reconnects_are_quiet_and_fast(self):
        server_source = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        self.assertIn("function clearServerReconnectNotice()", HTML)
        self.assertIn("function markServerTransportOpen()", HTML)
        self.assertIn("function noteServerTransportError()", HTML)
        self.assertIn("liveEventSource?.readyState!==EventSource.OPEN", HTML)
        self.assertIn('retry: 1000\\n: LibreDisplay live connection', server_source)


    def test_remote_clients_use_server_config_as_authoritative_state(self):
        self.assertIn("const serverWins=!!serverObj&&(!localObj||!bootstrapApi.LOCAL_CLIENT_MODE||ss>=ls);", HTML)
        self.assertIn("const chosen=serverWins?serverObj:localObj;", HTML)
        self.assertIn("const CFG_DEFAULTS=JSON.parse(JSON.stringify(cfg));", HTML)
        self.assertIn("if(chosen){cfg={...CFG_DEFAULTS,...chosen};if(serverWins)cfg._savedAt=ss;}", HTML)
        self.assertIn("if(serverConfigAvailable&&bootstrapApi.LOCAL_CLIENT_MODE&&localObj&&(!serverObj||ls>ss))void persistCfgToServer(JSON.parse(JSON.stringify(cfg)));", HTML)
        self.assertIn("const mergedRemote=(remote&&typeof remote==='object')?{...CFG_DEFAULTS,...remote,_savedAt:remoteSaved}:null;", HTML)
        self.assertIn("const remoteChanged=!!mergedRemote&&(remoteSaved!==localSaved", HTML)
        self.assertIn("const shouldApplyRemote=remoteChanged&&(!bootstrapApi.LOCAL_CLIENT_MODE||remoteSaved>localSaved||(remoteSaved===0&&localSaved===0));", HTML)
        self.assertIn("if(bootstrapApi.LOCAL_CLIENT_MODE){try{localStorage.setItem(bootstrapApi.CFG_KEY,JSON.stringify(cfg));}catch(e){}}", HTML)

    def test_server_path_does_not_duplicate_endpoint_parameter(self):
        self.assertIn("if(/(?:^|[?&])endpoint=/.test(path))return path;", HTML)

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


    def test_remote_display_media_is_limited_to_configured_background_roots(self):
        with tempfile.TemporaryDirectory(prefix="libredisplay-remote-media-") as tmp:
            root = Path(tmp).resolve()
            image = root / "photo.jpg"
            image.write_bytes(b"jpeg-test")
            outside_dir = root.parent / (root.name + "-outside")
            outside_dir.mkdir(exist_ok=True)
            outside = outside_dir / "outside.jpg"
            outside.write_bytes(b"jpeg-test")

            class FakeHandler:
                def authorized(self, parsed=None):
                    return False
                def endpoint_config(self, parsed):
                    return ({"mediaFolders": [str(root)]}, "main")

            fake = FakeHandler()
            with mock.patch.object(server, "MEDIA_ROOTS", [root, outside_dir.resolve()]):
                allowed = server.DashboardHandler.display_media_path(fake, str(image), None, require_file=True)
                blocked = server.DashboardHandler.display_media_path(fake, str(outside), None, require_file=True)
            self.assertEqual(allowed, image.resolve())
            self.assertIsNone(blocked)
            try:
                outside.unlink(missing_ok=True)
                outside_dir.rmdir()
            except OSError:
                pass

    def test_system_health_exposes_privacy_safe_kiosk_heartbeat(self):
        with tempfile.TemporaryDirectory(prefix="libredisplay-kiosk-heartbeat-") as tmp:
            heartbeat = Path(tmp) / "kiosk-heartbeat.json"
            heartbeat.write_text(json.dumps({
                "lastSeen": time.time() - 5,
                "endpoint": "main",
                "viewportWidth": 1920,
                "viewportHeight": 1080,
                "version": "1.5.0",
                "frontendPerformance": {
                    "cores": 4,
                    "memoryGB": 1,
                    "constrained": True,
                    "tier": "constrained",
                    "pageUptimeMs": 60000,
                    "longTaskObserverActive": True,
                    "longTasks": {"count": 3, "totalMs": 250, "maxMs": 120},
                    "heap": {"usedBytes": 1000, "totalBytes": 2000, "limitBytes": 3000},
                    "token": "not-allowed",
                },
            }), encoding="utf-8")
            with mock.patch.object(server, "KIOSK_HEARTBEAT_PATH", heartbeat):
                payload = server.system_health_payload()
        kiosk = payload["kioskHeartbeat"]
        self.assertTrue(kiosk["present"])
        self.assertEqual(kiosk["viewport"], "1920×1080")
        self.assertEqual(kiosk["endpoint"], "main")
        self.assertEqual(kiosk["frontendPerformance"]["tier"], "constrained")
        self.assertEqual(kiosk["frontendPerformance"]["longTasks"]["count"], 3)
        self.assertNotIn("userAgent", kiosk)
        self.assertNotIn("token", json.dumps(kiosk).lower())


if __name__ == "__main__":
    unittest.main()
