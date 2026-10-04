import importlib.util
import json
import os
import socket
import ssl
import tempfile
import time
import threading
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
            "burnInCareEnabled:false",
            "burnInDimMode:'activity'",
            "burnInQuietStart:'22:00'",
            "burnInQuietEnd:'07:00'",
            "burnInQuietWakeMin:5",
            "burnInProtection:false",
            "burnInPixelShift:false",
            "burnInIdleMin:30",
            "burnInBrightnessPct:40",
            "burnInDeepProtection:false",
            "burnInDeepIdleMin:180",
            "burnInDeepBrightnessPct:5",
            "burnInShiftMode:'always'",
            "burnInShiftMin:5",
            "burnInShiftPx:2",
            "burnInShiftTransitionSec:1.2",
            "function applyScreenCarePreferences",
            "function updateScreenCareState",
            "function screenCareQuietScheduleState",
            "function advanceScreenCareShift",
            "screen-care-pixel-shift",
            "SCREEN_CARE_SHIFT_STEPS",
            "#screen-care-overlay{position:fixed;inset:0;z-index:299",
            "body.ld-burnin-dim #screen-care-overlay",
            "body.ld-burnin-shift #app",
            "layoutEditorActive||remoteLayoutProxyActive||LAYOUT_PREVIEW_MODE",
            "if(!screenCareDimmed&&source?.burnInShiftMode==='idle')resetScreenCareShift();",
        ):
            self.assertIn(marker, HTML)
        self.assertIn('id="s-burnin-care-enabled"', HTML)
        self.assertIn('id="s-burnin-idle-dimming"', HTML)
        self.assertIn('id="s-burnin-quiet-hours"', HTML)
        self.assertIn('id="s-burnin-quiet-wake-enabled"', HTML)
        self.assertIn('id="s-burnin-pause-animations"', HTML)
        self.assertIn('id="s-burnin-quiet-start" type="time"', HTML)
        self.assertIn('id="s-burnin-quiet-end" type="time"', HTML)
        self.assertIn('id="s-burnin-quiet-wake" type="range" min="1" max="30" step="1"', HTML)
        self.assertIn('id="s-burnin-pixel-shift"', HTML)
        self.assertIn('id="s-burnin-deep-protection"', HTML)
        self.assertIn('id="s-burnin-deep-trigger"', HTML)
        self.assertIn('id="s-burnin-deep-idle"', HTML)
        self.assertIn('id="s-burnin-deep-brightness"', HTML)
        self.assertIn('id="s-burnin-shift-mode"', HTML)
        self.assertIn('id="s-burnin-shift-transition"', HTML)
        self.assertIn('id="s-burnin-idle" type="range" min="1" max="240" step="1"', HTML)
        self.assertIn('id="s-burnin-brightness"', HTML)
        self.assertIn('id="s-burnin-shift-interval"', HTML)
        self.assertIn('id="s-burnin-shift-distance" type="range" min="1" max="8" step="1"', HTML)
        self.assertIn('id="s-burnin-shift-interval" type="range" min="0.5" max="30" step="0.5"', HTML)
        self.assertIn("if(typeof cfg.burnInCareEnabled!=='boolean')cfg.burnInCareEnabled=!!(cfg.burnInIdleDimmingEnabled||cfg.burnInQuietHoursEnabled||cfg.burnInDeepProtection||cfg.burnInPixelShift);", HTML)

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


    def test_frontend_requests_are_bounded_and_report_connectivity(self):
        for marker in (
            "CONNECTIVITY_DEFAULT_TIMEOUT_MS=8000",
            "CONNECTIVITY_TRANSIENT_STATUS=new Set([408,425,429,500,502,503,504])",
            "async function resilientFetch",
            "new AbortController()",
            "const started=Date.now(),deadline=started+timeoutMs",
            "const remainingMs=Math.max(0,deadline-Date.now())",
            "function connectivitySnapshot",
            "connectivity:connectivitySnapshot()",
            "system-health-connectivity",
        ):
            self.assertIn(marker, HTML)

    def test_startup_integrity_and_interrupted_update_recovery_are_wired(self):
        rollback = (ROOT / "scripts" / "release-rollback.py").read_text(encoding="utf-8")
        update = (ROOT / "update.sh").read_text(encoding="utf-8")
        backup = (ROOT / "scripts" / "server-backup.py").read_text(encoding="utf-8")
        for marker in (
            "update-transaction.json",
            "recover-pending",
            "verify-install",
            "startup-integrity.json",
            "LibreDisplay startup integrity verification failed",
        ):
            self.assertIn(marker, START + rollback)
        self.assertIn('--state prepared', update)
        self.assertIn('--state replacing', update)
        self.assertIn('--state validated', update)
        self.assertIn('Validating the installed release before committing the update', update)
        self.assertIn('complete-update', update)
        self.assertIn('"update-transaction.json", "startup-integrity.json"', backup)
        self.assertIn('id="system-health-integrity"', HTML)
        self.assertIn('startupIntegrity', (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8"))


    def test_v171_local_server_recovery_does_not_trust_navigator_online(self):
        remote = (ROOT / "app" / "js" / "remote" / "index.js").read_text(encoding="utf-8")
        lifecycle = (ROOT / "app" / "js" / "lifecycle" / "index.js").read_text(encoding="utf-8")
        shared = (ROOT / "app" / "js" / "core" / "shared.js").read_text(encoding="utf-8")
        self.assertNotIn("Offline · waiting for network", remote)
        self.assertNotIn("serverConnectionState=navigator.onLine", remote)
        self.assertNotIn("if(navigator.onLine===false)", remote)
        self.assertIn("recoverServerConnection('browser-offline-hint')", lifecycle)
        self.assertNotIn("setServerConnectionState('offline')", lifecycle)
        self.assertIn("online:localServerOnline", shared)
        self.assertIn("browserOnlineHint:navigator.onLine!==false", shared)

    def test_v171_browser_update_restarts_without_forced_host_reboot(self):
        server_source = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        update = (ROOT / "update.sh").read_text(encoding="utf-8")
        self.assertIn('[str(updater), "update", "--no-reboot"]', server_source)
        self.assertIn('Restarting LibreDisplay without rebooting the Pi', update)
        self.assertIn('nohup /bin/sh "$INSTALL_DIR/scripts/start.sh"', update)
        self.assertIn('Your existing settings, display endpoints, media, and custom plugin folders were kept.', update)

    def test_system_health_reports_startup_integrity_state(self):
        server.atomic_write_json_file(server.STARTUP_INTEGRITY_PATH, {
            "ok": True, "checkedAt": 2_000_000_000, "version": "1.8.4",
            "coreFiles": 11, "pythonFiles": 3, "frontendVerified": True,
        })
        payload = server.system_health_payload()
        self.assertTrue(payload["startupIntegrity"]["ok"])
        self.assertTrue(payload["startupIntegrity"]["frontendVerified"])
        self.assertEqual(payload["startupIntegrity"]["version"], "1.8.4")

    def test_stale_broker_returns_cached_data_while_refresh_runs(self):
        key = "resilience-stale-while-revalidate"
        server.invalidate_broker_key(key)
        started = threading.Event()
        release = threading.Event()
        with mock.patch.object(server.time, "time", return_value=2_000_000_000):
            server.broker_save(key, b'{"old":true}', "application/json", "test")
        def fetcher():
            started.set()
            release.wait(2)
            return b'{"new":true}', "application/json"
        try:
            with mock.patch.object(server.time, "time", return_value=2_000_001_000):
                before = time.monotonic()
                data, content_type, state, age = server.broker_fetch(key, 60, fetcher, "test")
                elapsed = time.monotonic() - before
                self.assertTrue(started.wait(1))
                with server.BROKER_LOCK:
                    self.assertTrue((server.BROKER_STATUS.get(key) or {}).get("refreshing"))
            self.assertLess(elapsed, 0.5)
            self.assertEqual(data, b'{"old":true}')
            self.assertEqual(content_type, "application/json")
            self.assertEqual(state, "refreshing")
            self.assertGreaterEqual(age, 1000)
            with server.BROKER_LOCK:
                row = dict(server.BROKER_STATUS.get(key) or {})
            self.assertEqual(row.get("status"), "fresh")
            self.assertTrue(row.get("refreshing"))
            self.assertFalse(row.get("error"))
        finally:
            release.set()
            deadline = time.monotonic() + 2
            while time.monotonic() < deadline:
                with server.BROKER_LOCK:
                    if key not in server.BROKER_REFRESHING:
                        break
                time.sleep(0.01)
            server.invalidate_broker_key(key)


    def test_confirmed_provider_failure_remains_stale_during_recovery_refresh(self):
        key = "resilience-stale-recovery-refresh"
        server.invalidate_broker_key(key)
        release = threading.Event()
        started = threading.Event()
        with mock.patch.object(server.time, "time", return_value=2_200_000_000):
            server.broker_save(key, b'{"old":true}', "application/json", "test")
            with server.BROKER_LOCK:
                server.BROKER_STATUS[key] = {
                    "status": "stale", "savedAt": 2_200_000_000, "age": 600,
                    "lastSuccessAt": 2_200_000_000, "lastAttemptAt": 2_200_000_500,
                    "error": "Connection timed out", "errorKind": "timeout",
                    "consecutiveFailures": 1, "retryAt": 2_200_000_900, "refreshing": False,
                }
        def fetcher():
            started.set()
            release.wait(2)
            return b'{"new":true}', "application/json"
        try:
            with mock.patch.object(server.time, "time", return_value=2_200_001_000):
                data, content_type, state, age = server.broker_fetch(key, 60, fetcher, "test")
                self.assertTrue(started.wait(1))
            self.assertEqual(data, b'{"old":true}')
            self.assertEqual(content_type, "application/json")
            self.assertEqual(state, "stale")
            self.assertGreater(age, 0)
            with server.BROKER_LOCK:
                row = dict(server.BROKER_STATUS.get(key) or {})
            self.assertEqual(row.get("status"), "stale")
            self.assertTrue(row.get("refreshing"))
            self.assertEqual(row.get("errorKind"), "timeout")
        finally:
            release.set()
            deadline = time.monotonic() + 2
            while time.monotonic() < deadline:
                with server.BROKER_LOCK:
                    if key not in server.BROKER_REFRESHING:
                        break
                time.sleep(0.01)
            server.invalidate_broker_key(key)

    def test_v172_cache_banner_only_tracks_confirmed_stale_fallback(self):
        remote = (ROOT / "app" / "js" / "remote" / "index.js").read_text(encoding="utf-8")
        blocks = (ROOT / "app" / "js" / "blocks" / "index.js").read_text(encoding="utf-8")
        integrations = (ROOT / "app" / "js" / "integrations" / "index.js").read_text(encoding="utf-8")
        server_source = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        self.assertIn("if(res?.ok&&state==='stale')configApi.staleCacheSources.set", remote)
        self.assertIn("else if(res?.ok)configApi.staleCacheSources.delete(key)", remote)
        self.assertIn('response_state = "refreshing"', server_source)
        self.assertIn('"refreshing" if state == "refreshing" else "fresh"', server_source)
        self.assertIn("noteCacheResponse('integration:'+block.id,res,manifest.name||'integration')", blocks)
        self.assertIn("r.nextRefreshAt&&r.status==='fresh'&&!r.refreshing", integrations)

    def test_broker_backoff_prevents_repeated_provider_hammering(self):
        key = "resilience-backoff"
        server.invalidate_broker_key(key)
        calls = []
        def failing():
            calls.append(1)
            raise RuntimeError("Connection timed out")
        with mock.patch.object(server.time, "time", return_value=2_000_000_000):
            with self.assertRaises(RuntimeError):
                server.broker_fetch(key, 60, failing, "test", force=True)
            with self.assertRaisesRegex(RuntimeError, "automatic retry"):
                server.broker_fetch(key, 60, failing, "test")
        self.assertEqual(len(calls), 1)
        with server.BROKER_LOCK:
            row = dict(server.BROKER_STATUS.get(key) or {})
        self.assertEqual(row.get("consecutiveFailures"), 1)
        self.assertGreater(row.get("retryAt", 0), 2_000_000_000)
        self.assertEqual(server.broker_backoff_seconds(1), 5)
        self.assertEqual(server.broker_backoff_seconds(99), 600)
        server.invalidate_broker_key(key)

    def test_outbound_get_retries_transient_failures_but_post_does_not(self):
        ok = (200, {"Content-Type": "application/json"}, b"{}", "https://example.test/")
        transient = (503, {"Retry-After": "0"}, b"busy", "https://example.test/")
        with mock.patch.object(server, "safe_fetch", side_effect=[transient, ok]) as fetch, mock.patch.object(server.time, "sleep"):
            result = server.resilient_safe_fetch("https://example.test/", attempts=2)
        self.assertEqual(result[0], 200)
        self.assertEqual(fetch.call_count, 2)
        with mock.patch.object(server, "safe_fetch", return_value=transient) as fetch, mock.patch.object(server.time, "sleep"):
            result = server.resilient_safe_fetch("https://example.test/", method="POST", body=b"x", attempts=3)
        self.assertEqual(result[0], 503)
        self.assertEqual(fetch.call_count, 1)

    def test_outbound_timeout_is_one_total_budget_across_retries(self):
        clock = [100.0]
        seen_timeouts = []

        def monotonic():
            return clock[0]

        def fake_fetch(*args, **kwargs):
            remaining = float(kwargs.get("timeout") or 0)
            seen_timeouts.append(remaining)
            clock[0] += min(2.0, remaining)
            raise ConnectionRefusedError(111, "Connection refused")

        def fake_sleep(seconds):
            clock[0] += max(0.0, float(seconds or 0))

        with mock.patch.object(server.time, "monotonic", side_effect=monotonic), mock.patch.object(server.time, "sleep", side_effect=fake_sleep), mock.patch.object(server, "safe_fetch", side_effect=fake_fetch), mock.patch.object(server, "outbound_retry_delay", return_value=1.0):
            with self.assertRaises(OSError):
                server.resilient_safe_fetch("https://example.test/", timeout=5, attempts=4)

        self.assertGreaterEqual(len(seen_timeouts), 2)
        self.assertLessEqual(clock[0] - 100.0, 5.001)
        self.assertLess(seen_timeouts[-1], seen_timeouts[0])

    def test_safe_fetch_shares_timeout_across_resolved_addresses(self):
        clock = [200.0]
        attempted = []

        class FakeConnection:
            def __init__(self, host, port, pinned_ip, timeout=25, **kwargs):
                self.timeout = float(timeout)
                self.ip = pinned_ip
                self.sock = None
                attempted.append((pinned_ip, self.timeout))
            def request(self, *args, **kwargs):
                clock[0] += self.timeout
                raise TimeoutError("timed out")
            def close(self):
                return None

        parsed = server.urlparse("https://example.test/")
        with mock.patch.object(server.time, "monotonic", side_effect=lambda: clock[0]), mock.patch.object(server, "validate_outbound_url", return_value=(parsed, 443, ["203.0.113.10", "203.0.113.11", "203.0.113.12"])), mock.patch.object(server, "PinnedHTTPSConnection", FakeConnection):
            with self.assertRaises(server.OutboundRequestError) as raised:
                server.safe_fetch("https://example.test/", timeout=3)

        self.assertEqual(raised.exception.kind, "timeout")
        self.assertEqual(len(attempted), 1)
        self.assertLessEqual(clock[0] - 200.0, 3.001)

    def test_dns_resolution_respects_total_request_deadline(self):
        release = threading.Event()

        def blocked_getaddrinfo(*args, **kwargs):
            release.wait(1.0)
            return []

        started = time.monotonic()
        try:
            with mock.patch.object(server.socket, "getaddrinfo", side_effect=blocked_getaddrinfo):
                with self.assertRaises(server.OutboundRequestError) as raised:
                    server._bounded_getaddrinfo("example.test", 443, time.monotonic() + 0.05)
        finally:
            release.set()
        self.assertEqual(raised.exception.kind, "timeout")
        self.assertLess(time.monotonic() - started, 0.5)

    def test_login_request_has_a_bounded_single_attempt_timeout(self):
        source = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        login = source[source.index("fetch('/api/login'") - 300:source.index("fetch('/api/login'") + 700]
        self.assertIn("new AbortController()", login)
        self.assertIn("setTimeout(()=>c.abort(),8000)", login)
        self.assertIn("signal:c.signal", login)
        self.assertIn("Sign-in timed out", login)

    def test_extended_outage_does_not_hammer_provider_inside_backoff_window(self):
        key = "resilience-extended-outage"
        server.invalidate_broker_key(key)
        calls = []
        def failing():
            calls.append(1)
            raise TimeoutError("timed out")
        with mock.patch.object(server.time, "time", return_value=2_100_000_000):
            with self.assertRaises(TimeoutError):
                server.broker_fetch(key, 60, failing, "test", force=True)
            for _ in range(100):
                with self.assertRaisesRegex(RuntimeError, "automatic retry"):
                    server.broker_fetch(key, 60, failing, "test")
        self.assertEqual(len(calls), 1)
        server.invalidate_broker_key(key)

    def test_outbound_connectivity_classifies_failures_and_reports_privacy_safe_metrics(self):
        before = server.outbound_health_payload()
        self.assertEqual(server.outbound_error_kind(socket.gaierror(-2, "Name or service not known")), "dns")
        self.assertEqual(server.outbound_error_kind(ConnectionRefusedError(111, "Connection refused")), "refused")
        self.assertEqual(server.outbound_error_kind(TimeoutError("timed out")), "timeout")
        self.assertEqual(server.outbound_error_kind(ssl.SSLError("certificate verify failed")), "tls")
        self.assertEqual(server.outbound_error_kind(status=429), "rate-limit")
        self.assertEqual(server.outbound_error_kind(status=503), "provider")
        with mock.patch.object(server, "safe_fetch", side_effect=socket.gaierror(-2, "Name or service not known")), mock.patch.object(server.time, "sleep"):
            with self.assertRaises(socket.gaierror):
                server.resilient_safe_fetch("https://example.test/", attempts=2)
        after = server.outbound_health_payload()
        self.assertEqual(after["failures"], before["failures"] + 1)
        self.assertEqual(after["retries"], before["retries"] + 1)
        self.assertEqual(after["lastFailureKind"], "dns")
        self.assertGreaterEqual(after["failureKinds"].get("dns", 0), 1)
        self.assertNotIn("example.test", json.dumps(after))

    def test_connectivity_recovery_releases_only_transient_broker_backoff(self):
        transient_key = "recovery-transient"
        auth_key = "recovery-auth"
        with server.BROKER_LOCK:
            server.BROKER_STATUS[transient_key] = {"errorKind": "timeout", "retryAt": 2_000_000_000, "status": "stale"}
            server.BROKER_STATUS[auth_key] = {"errorKind": "authentication", "retryAt": 2_000_000_000, "status": "error"}
        before = server.outbound_health_payload()
        released = server.broker_release_transient_backoff()
        after = server.outbound_health_payload()
        with server.BROKER_LOCK:
            transient = dict(server.BROKER_STATUS.pop(transient_key))
            auth = dict(server.BROKER_STATUS.pop(auth_key))
        self.assertEqual(released, 1)
        self.assertEqual(transient["retryAt"], 0)
        self.assertEqual(auth["retryAt"], 2_000_000_000)
        self.assertEqual(after["recoverySignals"], before["recoverySignals"] + 1)
        self.assertEqual(after["releasedBackoffs"], before["releasedBackoffs"] + 1)

    def test_remote_clients_use_server_config_as_authoritative_state(self):
        self.assertIn("const serverWins=!!serverObj&&(!localObj||!bootstrapApi.LOCAL_CLIENT_MODE||ss>=ls);", HTML)
        self.assertIn("const chosen=serverWins?serverObj:localObj;", HTML)
        self.assertIn("const CFG_DEFAULTS=JSON.parse(JSON.stringify(cfg));", HTML)
        self.assertIn("if(chosen){cfg={...CFG_DEFAULTS,...chosen};if(serverWins)cfg._savedAt=ss;}", HTML)
        self.assertIn("if(serverConfigAvailable&&bootstrapApi.LOCAL_CLIENT_MODE&&localObj&&(!serverObj||ls>ss))void persistCfgToServer(JSON.parse(JSON.stringify(cfg)));", HTML)
        self.assertIn("const mergedRemote=(remote&&typeof remote==='object')?{...configApi.CFG_DEFAULTS,...remote,_savedAt:remoteSaved}:null;", HTML)
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


    def test_frontend_actively_recovers_after_server_or_network_reconnect(self):
        for marker in (
            "SERVER_RECOVERY_DELAYS_MS=[1000,3000,8000,15000,30000,60000]",
            "async function recoverServerConnection",
            "serverPath('/api/session-info')",
            "scheduleServerRecovery('event-stream',0)",
            "remote.recoverServerConnection('browser-online')",
            "recoverServerConnection('browser-offline-hint')",
            "sendDisplayHeartbeat(true)",
            "connectivityRecovered:!!connectivityRecovered",
            "scheduleDisplayHeartbeat(0)",
        ):
            self.assertIn(marker, HTML)

    def test_corrupt_config_recovers_from_known_good_previous_copy(self):
        primary = server.CONFIG_PATH
        backup = server.CONFIG_BACKUP_PATH
        recovery_state = server.CONFIG_RECOVERY_STATE_PATH
        recovery_dir = server.CONFIG_RECOVERY_DIR
        for path in (primary, backup, recovery_state):
            path.unlink(missing_ok=True)
        for path in recovery_dir.glob("main-*-corrupt*.json"):
            path.unlink(missing_ok=True)
        primary.write_text('{"broken":', encoding="utf-8")
        backup.write_text(json.dumps({"marker": "known-good", "_savedAt": 123}) + "\n", encoding="utf-8")
        recovered = server.load_endpoint_config_resilient("main")
        self.assertEqual(recovered.get("marker"), "known-good")
        self.assertEqual(json.loads(primary.read_text(encoding="utf-8")).get("marker"), "known-good")
        self.assertEqual(json.loads(backup.read_text(encoding="utf-8")).get("marker"), "known-good")
        state = json.loads(recovery_state.read_text(encoding="utf-8"))
        self.assertEqual(state.get("endpoint"), "main")
        quarantined = recovery_dir / state.get("quarantinedFile")
        self.assertTrue(quarantined.is_file())
        self.assertEqual(quarantined.read_text(encoding="utf-8"), '{"broken":')
        primary.unlink(missing_ok=True);backup.unlink(missing_ok=True);recovery_state.unlink(missing_ok=True);quarantined.unlink(missing_ok=True)

    def test_native_watchdog_records_recovery_and_backs_off_restart_loops(self):
        for marker in (
            'watchdog-state.json',
            'write_watchdog_state "server-start-failed"',
            'write_watchdog_state "server-health-failed"',
            'write_watchdog_state "browser-exited"',
            'write_watchdog_state "browser-heartbeat-stale"',
            'SERVER_RESTART_DELAY',
            'BROWSER_RESTART_DELAY',
            '[ "$SERVER_RESTART_DELAY" -le 30 ] || SERVER_RESTART_DELAY=30',
        ):
            self.assertIn(marker, START)

    def test_system_health_reports_recovery_without_secret_data(self):
        with tempfile.TemporaryDirectory(prefix="libredisplay-recovery-health-") as tmp:
            root = Path(tmp)
            watchdog = root / "watchdog-state.json"
            config_state = root / "config-recovery-state.json"
            watchdog.write_text(json.dumps({"serverRestarts": 2, "browserRestarts": 1, "lastReason": "server-health-failed", "lastRecoveryAt": 123}), encoding="utf-8")
            config_state.write_text(json.dumps({"recoveredAt": 456, "endpoint": "main", "recoveredFrom": "dashboard_config.previous.json", "quarantinedFile": "main-corrupt.json", "secret": "do-not-expose"}), encoding="utf-8")
            with mock.patch.object(server, "WATCHDOG_STATE_PATH", watchdog), mock.patch.object(server, "CONFIG_RECOVERY_STATE_PATH", config_state):
                payload = server.system_health_payload()
        recovery = payload["recovery"]
        self.assertEqual(recovery["watchdog"]["serverRestarts"], 2)
        self.assertEqual(recovery["watchdog"]["browserRestarts"], 1)
        self.assertEqual(recovery["config"]["endpoint"], "main")
        self.assertNotIn("secret", json.dumps(recovery).lower())
        self.assertIn('system-health-recovery', HTML)

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
                    "connectivity": {"requests": 12, "successes": 10, "failures": 2, "timeouts": 1, "retries": 3, "inFlight": 1, "lastLatencyMs": 250, "averageLatencyMs": 180, "lastSuccessAt": 1234, "lastFailureAt": 1200, "online": True, "token": "not-allowed"},
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
        self.assertEqual(kiosk["frontendPerformance"]["connectivity"]["timeouts"], 1)
        self.assertEqual(kiosk["frontendPerformance"]["connectivity"]["retries"], 3)
        self.assertNotIn("userAgent", kiosk)
        self.assertNotIn("token", json.dumps(kiosk).lower())

    def test_v180_data_first_startup_and_background_reuse_are_present(self):
        settings = (ROOT / "app" / "js" / "settings" / "index.js").read_text(encoding="utf-8")
        backgrounds = (ROOT / "app" / "js" / "backgrounds" / "index.js").read_text(encoding="utf-8")
        config = (ROOT / "app" / "js" / "core" / "config.js").read_text(encoding="utf-8")
        self.assertIn("backgroundStartupPriority:true", config)
        self.assertIn("backgroundStartupDelayMs:700", config)
        self.assertIn("restoreLastBackground", backgrounds)
        self.assertIn("LAST_BACKGROUND_KEY='libredisplay_last_background_v2'", backgrounds)
        self.assertIn("restoreLastBackground(cacheOnly=false)", backgrounds)
        self.assertIn("backgroundSourceFingerprint", backgrounds)
        self.assertIn("sourceKey:backgroundSourceFingerprint(cfg)", backgrounds)
        self.assertIn("saved.sourceKey&&saved.sourceKey!==backgroundSourceFingerprint(cfg)", backgrounds)
        self.assertIn("backgrounds.restoreLastBackground(true)", settings)
        self.assertIn("backgroundStartAt=Date.now()+", settings)
        self.assertIn("setTimeout(loadBackgroundSource", settings)
        self.assertIn("getAirQualityData().catch", settings)

    def test_v180_weather_effects_are_fully_configurable_and_accessibility_safe(self):
        effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
        config = (ROOT / "app" / "js" / "core" / "config.js").read_text(encoding="utf-8")
        css = (ROOT / "app" / "css" / "dashboard.css").read_text(encoding="utf-8")
        for marker in (
            "weatherAnimationsEnabled:false", "weatherWidgetAnimations:true", "weatherFullscreenEffects:false",
            "weatherEffectIntensity:50", "weatherEffectOpacity:34", "weatherEffectSpeed:100",
            "weatherEffectAutoIntensity:true", "weatherEffectAtmosphere:55", "weatherEffectParticleScale:100",
            "weatherEffectWindStrength:100", "weatherEffectLightningFrequency:'normal'", "weatherEffectLightningBrightness:65",
            "weatherEffectRespectReducedMotion:true", "weatherEffectPauseWhenDimmed:true",
        ):
            self.assertIn(marker, config)
        for control in (
            'id="s-weather-animations"', 'id="s-weather-widget-animations"', 'id="s-weather-fullscreen-effects"',
            'id="s-weather-effect-mode"', 'id="s-weather-effect-intensity"', 'id="s-weather-effect-opacity"',
            'id="s-weather-effect-speed"', 'id="s-weather-effect-auto-intensity"', 'id="s-weather-effect-atmosphere"',
            'id="s-weather-effect-particle-scale"', 'id="s-weather-effect-wind-strength"', 'id="s-weather-effect-lightning-frequency"',
            'id="s-weather-effect-lightning-brightness"', 'id="s-weather-effect-lightning"', 'id="s-weather-effect-reduced-motion"',
            'id="s-weather-effect-pause-dimmed"',
        ):
            self.assertIn(control, HTML)
        self.assertIn("document.documentElement.classList.contains('ld-reduce-motion')", effects)
        self.assertIn("document.body.classList.contains('ld-burnin-dim')", effects)
        self.assertIn("weatherGlyphEnabled", effects)
        self.assertIn("syncWeatherGlyphVisibility(source,widgetOn)", effects)
        self.assertIn(".ld-weather-glyph.ld-weather-glyph-active{display:inline-block}", css)
        self.assertIn(".ld-weather-emoji-fallback.ld-weather-emoji-hidden{display:none}", css)
        self.assertNotIn("body.ld-weather-widget-motion .ld-weather-emoji-fallback{display:none}", css)
        self.assertIn(".weather-fx-partly::before", css)
        self.assertIn(".weather-fx-rain.weather-fx-no-clouds::before", css)
        self.assertIn("host.classList.toggle('weather-fx-no-clouds'", effects)
        self.assertIn("host.classList.toggle('weather-fx-no-sun'", effects)
        self.assertIn("function weatherEffectSource(source){return source&&typeof source==='object'?source:uiCfg();}", effects)
        self.assertIn("function refreshWeatherEffects(){applyWeatherEffects(configApi.wxData);}", effects)
        self.assertIn("attributeOldValue:true", effects)
        self.assertIn("weatherPauseClassSignature", effects)
        self.assertIn("effects.decorateWeatherIcon(currentIcon,c.weather_code,wi(c.weather_code),ui)", (ROOT / "app" / "js" / "weather" / "index.js").read_text(encoding="utf-8"))
        self.assertIn("#weather-effects-overlay{position:fixed;inset:0;z-index:1", css)
        self.assertIn("#app {", css)


    def test_v183_weather_overlay_immediate_activation_and_live_depth_controls(self):
        appearance = (ROOT / "app" / "js" / "appearance" / "index.js").read_text(encoding="utf-8")
        effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
        css = (ROOT / "app" / "css" / "dashboard.css").read_text(encoding="utf-8")
        self.assertIn("function ensureWeatherAnimationMaster(control)", appearance)
        self.assertIn("['s-weather-widget-animations','s-weather-fullscreen-effects'].includes(control.id)", appearance)
        self.assertIn("function weatherAnimationControlChanged(control){ensureWeatherAnimationMaster(control);previewAppearance();}", appearance)
        self.assertIn("applyWeatherEffectPreset('immersive')", HTML)
        self.assertIn("previewCurrentWeatherOverlay()", HTML)
        self.assertIn("weatherEffectIntensityForData", effects)
        self.assertIn("liveIntensityMultiplier", effects)
        self.assertIn("weatherWindProfile", effects)
        self.assertIn("weatherEffectStatusText", effects)
        self.assertIn("--weather-fx-atmosphere", effects)
        self.assertIn("--weather-fx-lightning-duration", effects)
        self.assertIn("weather-effect-live-status", HTML)
        self.assertIn(".weather-effect-status", css)
        self.assertIn(".weather-fx-wind-reverse", css)

    def test_v184_fullscreen_weather_is_authoritative_and_self_healing(self):
        effects = (ROOT / "app" / "js" / "weather" / "effects.js").read_text(encoding="utf-8")
        config = (ROOT / "app" / "js" / "core" / "config.js").read_text(encoding="utf-8")
        weather = (ROOT / "app" / "js" / "weather" / "index.js").read_text(encoding="utf-8")
        css = (ROOT / "app" / "css" / "dashboard.css").read_text(encoding="utf-8")
        self.assertIn("if(cfg.weatherFullscreenEffects)cfg.weatherAnimationsEnabled=true", config)
        self.assertIn("ensureCfgDefaults();\n  cfg._savedAt=Date.now();", config)
        self.assertIn("fullOn:!!source.weatherFullscreenEffects&&!pauseReason&&allowed", effects)
        self.assertNotIn("fullOn:!!source.weatherAnimationsEnabled&&!!source.weatherFullscreenEffects", effects)
        self.assertIn("function fullscreenPauseReason(source)", effects)
        self.assertIn("function weatherOverlayNeedsRepair", effects)
        self.assertIn("function ensureWeatherOverlayLive", effects)
        self.assertIn("setInterval(()=>ensureWeatherOverlayLive(),2500)", effects)
        self.assertIn("requestAnimationFrame(()=>effects.ensureWeatherOverlayLive(d,ui))", weather)
        self.assertIn("body.ld-weather-respect-reduced-motion #weather-effects-overlay", css)
        self.assertIn("--fx-static-y", effects)
        self.assertIn("ld-weather-pause-dimmed", css)

    def test_v183_weather_cold_start_does_not_render_an_old_location(self):
        weather = (ROOT / "app" / "js" / "weather" / "index.js").read_text(encoding="utf-8")
        settings = (ROOT / "app" / "js" / "settings" / "index.js").read_text(encoding="utf-8")
        remote = (ROOT / "app" / "js" / "remote" / "index.js").read_text(encoding="utf-8")
        self.assertIn("function weatherLocationKey(source=cfg)", weather)
        self.assertIn("function weatherPayloadMatchesRequest(data,source)", weather)
        self.assertIn("function invalidateWeatherIfLocationChanged(force=false)", weather)
        self.assertIn("Waiting for saved location verification", weather)
        self.assertIn("requestSerial!==weatherFetchSerial||requestKey!==weatherLocationKey(cfg)", weather)
        self.assertIn("Weather response does not match the saved location", weather)
        self.assertIn("weather.invalidateWeatherIfLocationChanged();", settings)
        self.assertIn("configApi.serverConfigAvailable=true;configApi.serverConfigLastError=''", remote)
        self.assertIn("resumeOnVisible:true,immediate:true", remote)

    def test_v180_screen_care_controls_are_independent(self):
        config = (ROOT / "app" / "js" / "core" / "config.js").read_text(encoding="utf-8")
        appearance = (ROOT / "app" / "js" / "appearance" / "index.js").read_text(encoding="utf-8")
        for marker in (
            "burnInIdleDimmingEnabled:null", "burnInQuietHoursEnabled:null", "burnInQuietWakeEnabled:true",
            "burnInPauseAnimationsDimmed:true",
        ):
            self.assertIn(marker, config)
        self.assertIn("source?.burnInIdleDimmingEnabled||source?.burnInQuietHoursEnabled||source?.burnInDeepProtection", appearance)
        self.assertIn("source?.burnInCareEnabled&&!!source?.burnInPixelShift", appearance)
        self.assertIn('id="s-burnin-pixel-shift"', HTML)
        self.assertIn('id="s-burnin-idle-dimming"', HTML)
        self.assertIn('id="s-burnin-quiet-hours"', HTML)
        self.assertIn('id="s-burnin-deep-protection"', HTML)

    def test_image_broker_allows_short_private_browser_cache(self):
        source = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        self.assertIn('str(content_type or "").lower().startswith("image/")', source)
        self.assertIn('headers["Cache-Control"] = "private, max-age=900"', source)


if __name__ == "__main__":
    unittest.main()
