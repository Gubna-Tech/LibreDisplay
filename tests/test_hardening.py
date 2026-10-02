import importlib.util
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
_TEMP = tempfile.TemporaryDirectory(prefix="libredisplay-hardening-")
os.environ["DASHBOARD_DATA_DIR"] = _TEMP.name
os.environ["DASHBOARD_REMOTE_ENABLED"] = "0"
spec = importlib.util.spec_from_file_location("libredisplay_dashboard_server_hardening", ROOT / "app" / "dashboard_server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)
shared_spec = importlib.util.spec_from_file_location("libredisplay_plugin_shared_hardening", ROOT / "plugins" / "_shared.py")
shared = importlib.util.module_from_spec(shared_spec)
shared_spec.loader.exec_module(shared)


class _Response:
    def __init__(self, status, location=None, body=b"ok"):
        self.status = status
        self._location = location
        self._body = body
    def getheaders(self):
        rows = []
        if self._location:
            rows.append(("Location", self._location))
        rows.append(("Content-Length", str(len(self._body))))
        return rows
    def getheader(self, name):
        if name.lower() == "location":
            return self._location
        if name.lower() == "content-length":
            return str(len(self._body))
        return None
    def read(self, amount=None):
        return self._body if amount is None else self._body[:amount]


class HardeningTests(unittest.TestCase):
    def test_malformed_password_hash_cannot_request_unbounded_pbkdf_work(self):
        encoded = "pbkdf2-sha256$999999999$" + ("ab" * 16) + "$" + ("cd" * 32)
        with mock.patch.object(server.hashlib, "pbkdf2_hmac") as pbkdf:
            self.assertFalse(server.account_password_valid("long enough password", encoded))
            pbkdf.assert_not_called()

    def test_unknown_account_still_performs_password_verification_work(self):
        with mock.patch.object(server, "account_lookup", return_value=None), mock.patch.object(server, "account_password_valid", return_value=False) as check:
            self.assertIsNone(server.authenticate_account("missing-user", "wrong password"))
        check.assert_called_once()

    def test_malformed_pin_hash_cannot_request_unbounded_pbkdf_work(self):
        encoded = "pbkdf2-sha256$999999999$" + ("ab" * 16) + "$" + ("cd" * 32)
        with mock.patch.object(server.hashlib, "pbkdf2_hmac") as pbkdf:
            self.assertFalse(server.pin_valid("1234", encoded))
            pbkdf.assert_not_called()

    def test_public_integration_error_redacts_json_and_basic_credentials(self):
        message = 'HTTP 400 {"access_token":"secret-token","client_secret":"client-secret","password":"p4ss"} Authorization: Basic dXNlcjpwYXNz'
        clean = server.public_integration_error(message)
        for secret in ("secret-token", "client-secret", "p4ss", "dXNlcjpwYXNz"):
            self.assertNotIn(secret, clean)
        self.assertIn("[redacted]", clean)

    def test_broker_status_records_only_redacted_errors(self):
        server.BROKER_STATUS.clear()
        with self.assertRaises(RuntimeError):
            server.broker_fetch("hardening-secret", 60, lambda: (_ for _ in ()).throw(RuntimeError('token=super-secret')), "test", force=True)
        self.assertNotIn("super-secret", json.dumps(server.BROKER_STATUS))

    def test_response_header_values_strip_control_characters(self):
        clean = server.safe_response_header_value("image/jpeg\r\nX-Evil: yes\x00")
        self.assertNotIn("\r", clean)
        self.assertNotIn("\n", clean)
        self.assertNotIn("\x00", clean)

    def test_provider_error_body_is_not_reflected_into_exception(self):
        class Context:
            def request(self, *args, **kwargs):
                return 401, {}, b'{"access_token":"provider-secret"}', "https://provider.example/api"
        with self.assertRaises(RuntimeError) as caught:
            shared.request_json(Context(), "https://provider.example/api")
        self.assertEqual(str(caught.exception), "HTTP 401")
        self.assertNotIn("provider-secret", str(caught.exception))

    def test_oauth_cache_key_does_not_embed_refresh_token(self):
        shared._TOKEN_CACHE.clear()
        class Context:
            def request(self, *args, **kwargs):
                return 200, {}, b'{"access_token":"short-lived","expires_in":3600}', "https://provider.example/token"
        settings = {"refreshToken":"refresh-secret-value", "clientId":"client"}
        self.assertEqual(shared.bearer(settings, Context(), token_url="https://provider.example/token", cache_prefix="test"), "short-lived")
        self.assertTrue(shared._TOKEN_CACHE)
        self.assertNotIn("refresh-secret-value", repr(list(shared._TOKEN_CACHE.keys())))

    def test_private_outbound_validator_requires_every_dns_answer_to_be_private(self):
        private = [(None, None, None, None, ("192.168.1.20", 8123))]
        mixed = private + [(None, None, None, None, ("8.8.8.8", 8123))]
        with mock.patch.object(server.socket, "getaddrinfo", return_value=private):
            parsed, port, addresses = server.validate_private_outbound_url("http://homeassistant.local:8123")
        self.assertEqual(parsed.hostname, "homeassistant.local")
        self.assertEqual(port, 8123)
        self.assertEqual(addresses, ["192.168.1.20"])
        with mock.patch.object(server.socket, "getaddrinfo", return_value=mixed):
            with self.assertRaises(ValueError):
                server.validate_private_outbound_url("http://homeassistant.local:8123")

    def test_cross_origin_redirect_drops_sensitive_request_headers(self):
        sent = []
        responses = [_Response(302, "http://other.test/final"), _Response(200, body=b"done")]
        class FakeConnection:
            def __init__(self, *args, **kwargs): pass
            def request(self, method, path, body=None, headers=None): sent.append((method, path, dict(headers or {})))
            def getresponse(self): return responses.pop(0)
            def close(self): pass
        def validate(url):
            parsed = urlparse(url)
            return parsed, 80, ["93.184.216.34"]
        with mock.patch.object(server, "validate_outbound_url", side_effect=validate), mock.patch.object(server, "PinnedHTTPConnection", FakeConnection):
            status, _, data, final = server.safe_fetch(
                "http://start.test/source", headers={"Authorization":"Bearer secret", "Cookie":"session=x", "X-Api-Key":"abc", "Accept":"application/json"}, redirects=2
            )
        self.assertEqual(status, 200)
        self.assertEqual(data, b"done")
        self.assertEqual(final, "http://other.test/final")
        self.assertIn("Authorization", sent[0][2])
        second = {k.lower(): v for k, v in sent[1][2].items()}
        self.assertNotIn("authorization", second)
        self.assertNotIn("cookie", second)
        self.assertNotIn("x-api-key", second)
        self.assertEqual(second.get("accept"), "application/json")

    def test_remote_session_store_is_bounded_per_user_and_globally(self):
        server.REMOTE_SESSIONS.clear()
        with mock.patch.object(server, "MAX_REMOTE_SESSIONS_PER_USER", 3), mock.patch.object(server, "MAX_REMOTE_SESSIONS", 5):
            for _ in range(6):
                server.create_remote_session({"username":"same", "role":"editor", "endpoints":["main"]})
            self.assertLessEqual(len(server.REMOTE_SESSIONS), 3)
            for idx in range(8):
                server.create_remote_session({"username":f"u{idx}", "role":"editor", "endpoints":["main"]})
            self.assertLessEqual(len(server.REMOTE_SESSIONS), 5)

    def test_remote_account_session_revalidates_current_account_permissions(self):
        with tempfile.TemporaryDirectory() as td:
            users = Path(td) / "users.json"
            old_users = server.USERS_PATH
            server.USERS_PATH = users
            server.REMOTE_SESSIONS.clear()
            try:
                server.save_user_store({"users":[{"username":"alex","passwordHash":server.account_password_hash("correct horse battery"),"role":"editor","endpoints":["main"],"enabled":True}]})
                token = server.create_remote_session({"username":"alex","role":"editor","endpoints":["main"]})
                self.assertEqual(server.remote_session_principal(token)["role"], "editor")
                store = server.load_user_store(); store["users"][0]["role"] = "viewer"; server.save_user_store(store)
                self.assertEqual(server.remote_session_principal(token)["role"], "viewer")
                store = server.load_user_store(); store["users"][0]["enabled"] = False; server.save_user_store(store)
                self.assertIsNone(server.remote_session_principal(token))
            finally:
                server.USERS_PATH = old_users
                server.REMOTE_SESSIONS.clear()

    def test_auth_failure_tracking_prunes_stale_and_excess_clients(self):
        server.AUTH_FAILURES.clear()
        now = 1000.0
        for idx in range(12):
            server.AUTH_FAILURES[f"10.0.0.{idx}"] = [now - idx]
        server.AUTH_FAILURES["stale"] = [now - 120]
        with mock.patch.object(server, "MAX_AUTH_FAILURE_CLIENTS", 5):
            server.prune_auth_failures(now)
        self.assertNotIn("stale", server.AUTH_FAILURES)
        self.assertLessEqual(len(server.AUTH_FAILURES), 5)

    def test_atomic_json_writes_do_not_share_a_fixed_temp_name(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "state.json"
            errors = []
            def writer(value):
                try:
                    server.atomic_write_json_file(path, {"value": value})
                except Exception as exc:
                    errors.append(exc)
            threads = [threading.Thread(target=writer, args=(i,)) for i in range(20)]
            for t in threads: t.start()
            for t in threads: t.join()
            self.assertEqual(errors, [])
            self.assertIn(json.loads(path.read_text())["value"], range(20))
            self.assertEqual(list(Path(td).glob("*.tmp")), [])

    def test_write_integrations_require_write_authorization_and_user_updates_revoke_sessions(self):
        source = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        action = source.split('if parsed.path == "/api/integration-action":', 1)[1].split('if parsed.path == "/api/device-heartbeat":', 1)[0]
        self.assertIn("require_authorized(parsed)", action)
        self.assertNotIn("require_display_authorized(parsed)", action)
        users = source.split('if parsed.path == "/api/users":', 1)[1].split('if parsed.path == "/api/remote-access":', 1)[0]
        self.assertIn('if action == "update":', users)
        self.assertIn('clear_remote_sessions_for_user(existing["username"])', users)
        html = (ROOT / "app" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIn("canWrite=SESSION_ROLE==='owner'||SESSION_ROLE==='editor'", html)
        self.assertIn("Read-only display", html)

    def test_home_assistant_uses_pinned_private_client(self):
        source = (ROOT / "plugins" / "home-assistant" / "plugin.py").read_text(encoding="utf-8")
        self.assertIn("context.request_private(", source)
        self.assertIn("require_private=True", source)
        self.assertNotIn("urllib.request", source)
        self.assertNotIn("socket.getaddrinfo", source)


if __name__ == "__main__":
    unittest.main()
