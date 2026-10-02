import datetime
import importlib.util
import json
import os
import tempfile
import unittest
from unittest import mock
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_TEMP = tempfile.TemporaryDirectory(prefix="libredisplay-tests-")
os.environ["DASHBOARD_DATA_DIR"] = _TEMP.name
os.environ["DASHBOARD_REMOTE_ENABLED"] = "0"
os.environ["DASHBOARD_MEDIA_ROOTS"] = str(ROOT / "media")
spec = importlib.util.spec_from_file_location("libredisplay_dashboard_server_test", ROOT / "app" / "dashboard_server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class HouseholdTests(unittest.TestCase):
    def setUp(self):
        self.household = Path(_TEMP.name) / "dashboard_household.json"
        self.household.unlink(missing_ok=True)
        server.HOUSEHOLD_PATH = self.household

    def seed(self, locked=False):
        store = {
            "members": [{"id": "alex", "name": "Alex", "emoji": "A", "points": 0}],
            "chores": [{"id": "feed-dog", "title": "Feed dog", "memberId": "alex", "points": 3, "recurrence": "daily"}],
            "rewards": [{"id": "movie", "title": "Movie", "cost": 2, "memberId": "alex"}],
            "completions": {},
            "history": [],
            "childLock": {"enabled": locked},
        }
        if locked:
            store["childLock"]["pinHash"] = server.pin_hash("1234")
        server.atomic_write_json_file(self.household, server.normalize_household_store(store, preserve_secret=True))

    def test_child_lock_hash_is_not_exposed(self):
        self.seed(locked=True)
        public = server.household_public_payload()
        self.assertTrue(public["childLock"]["pinSet"])
        self.assertNotIn("pinHash", json.dumps(public))
        admin = server.household_public_payload(include_admin=True)
        self.assertNotIn("pinHash", json.dumps(admin))

    def test_completion_awards_once_and_can_be_reversed(self):
        self.seed()
        first = server.household_complete("feed-dog", True)
        self.assertEqual(first["members"][0]["points"], 3)
        second = server.household_complete("feed-dog", True)
        self.assertEqual(second["members"][0]["points"], 3)
        third = server.household_complete("feed-dog", False)
        self.assertEqual(third["members"][0]["points"], 0)

    def test_child_lock_rejects_bad_pin(self):
        self.seed(locked=True)
        with self.assertRaises(PermissionError):
            server.household_complete("feed-dog", True, "0000")
        saved = server.household_complete("feed-dog", True, "1234")
        self.assertEqual(saved["members"][0]["points"], 3)

    def test_reward_spends_points(self):
        self.seed()
        server.household_complete("feed-dog", True)
        saved = server.household_redeem("movie", "alex")
        self.assertEqual(saved["members"][0]["points"], 1)
        self.assertEqual(saved["history"][-1]["kind"], "reward")

    def test_custom_recurrence_respects_day(self):
        chore = {"recurrence": "custom", "days": [0]}
        sunday = datetime.datetime(2026, 10, 4, 9, 0, 0)
        monday = datetime.datetime(2026, 10, 5, 9, 0, 0)
        self.assertTrue(server.household_chore_due(chore, sunday))
        self.assertFalse(server.household_chore_due(chore, monday))


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.users = Path(_TEMP.name) / "dashboard_users.json"
        self.users.unlink(missing_ok=True)
        server.USERS_PATH = self.users

    def test_password_hash_roundtrip(self):
        encoded = server.account_password_hash("correct horse battery")
        self.assertTrue(server.account_password_valid("correct horse battery", encoded))
        self.assertFalse(server.account_password_valid("wrong password", encoded))
        self.assertNotIn("correct horse", encoded)

    def test_role_endpoint_scope(self):
        editor = {"username": "ed", "role": "editor", "endpoints": ["kitchen"]}
        viewer = {"username": "view", "role": "viewer", "endpoints": ["kitchen"]}
        owner = {"username": "own", "role": "owner", "endpoints": []}
        self.assertTrue(server.principal_allows_endpoint(editor, "kitchen", write=True))
        self.assertFalse(server.principal_allows_endpoint(editor, "office", write=True))
        self.assertTrue(server.principal_allows_endpoint(viewer, "kitchen", write=False))
        self.assertFalse(server.principal_allows_endpoint(viewer, "kitchen", write=True))
        self.assertTrue(server.principal_allows_endpoint(owner, "office", write=True))

    def test_public_user_payload_never_contains_hash(self):
        store = server.save_user_store({"users": [{"username": "alex", "passwordHash": server.account_password_hash("long password"), "role": "editor", "endpoints": ["main"]}]})
        payload = server.public_users(store)
        self.assertEqual(payload[0]["username"], "alex")
        self.assertNotIn("passwordHash", json.dumps(payload))


class SecurityTests(unittest.TestCase):
    def test_public_broker_rejects_private_addresses(self):
        with self.assertRaises(ValueError):
            server.validate_outbound_url("http://127.0.0.1:8787/private")
        with self.assertRaises(ValueError):
            server.validate_outbound_url("http://192.168.1.10/private")

    def test_trusted_url_rejects_embedded_credentials(self):
        with self.assertRaises(ValueError):
            server.validate_trusted_outbound_url("https://user:pass@example.com/tasks")

    def test_pin_format(self):
        encoded = server.pin_hash("9876")
        self.assertTrue(server.pin_valid("9876", encoded))
        self.assertFalse(server.pin_valid("9875", encoded))
        with self.assertRaises(ValueError):
            server.pin_hash("12ab")

    def test_layout_preview_is_only_same_origin_frame_exception(self):
        handler = object.__new__(server.DashboardHandler)
        handler.path = "/layout-preview?endpoint=main&layoutPreview=1"
        self.assertTrue(handler.same_origin_layout_preview())
        handler.path = "/dashboard.html?endpoint=main&layoutPreview=1"
        self.assertFalse(handler.same_origin_layout_preview())
        handler.path = "/settings"
        self.assertFalse(handler.same_origin_layout_preview())




class UpdateStatusTests(unittest.TestCase):
    def setUp(self):
        server.UPDATE_CHECK_CACHE.clear()

    def test_semantic_version_tuple(self):
        self.assertEqual(server.semantic_version_tuple("v2.3.4"), (2, 3, 4))
        self.assertIsNone(server.semantic_version_tuple("latest"))

    def test_github_update_status_reports_newer_release_without_secrets(self):
        payload = json.dumps({
            "tag_name": "v9.9.9",
            "name": "LibreDisplay v9.9.9",
            "html_url": "https://github.com/Gubna-Tech/LibreDisplay/releases/tag/v9.9.9",
            "published_at": "2026-10-01T12:00:00Z",
        }).encode("utf-8")
        with mock.patch.object(server, "safe_fetch", return_value=(200, {"Content-Type": "application/json"}, payload, server.GITHUB_RELEASE_API)):
            result = server.github_update_status(force=True)
        self.assertTrue(result["ok"])
        self.assertTrue(result["updateAvailable"])
        self.assertEqual(result["latestVersion"], "9.9.9")
        self.assertEqual(result["releaseUrl"], "https://github.com/Gubna-Tech/LibreDisplay/releases/tag/v9.9.9")
        self.assertNotIn("token", json.dumps(result).lower())
        self.assertNotIn("assets_url", result)
        self.assertIn(result["deployment"], {"native", "docker", "source"})

    def test_in_app_update_capability_is_disabled_outside_native_install(self):
        with mock.patch.object(server, "update_deployment_mode", return_value="docker"):
            capable, reason = server.in_app_update_capability()
        self.assertFalse(capable)
        self.assertIn("Docker", reason)

    def test_start_in_app_update_launches_existing_cli_only_after_release_check(self):
        server.UPDATE_RUN_STATE.clear()
        server.UPDATE_RUN_STATE.update({"state": "idle", "startedAt": 0, "targetVersion": "", "error": ""})
        status = {"ok": True, "currentVersion": server.APP_VERSION, "latestVersion": "9.9.9", "updateAvailable": True, "deployment": "native", "canUpdateInApp": True}
        proc = mock.Mock(pid=4321)
        proc.wait.return_value = 1
        with tempfile.TemporaryDirectory(prefix="libredisplay-update-test-") as tmp, \
             mock.patch.object(server, "UPDATE_LOG_PATH", Path(tmp) / "update.log"), \
             mock.patch.object(server, "github_update_status", return_value=status), \
             mock.patch.object(server.subprocess, "Popen", return_value=proc) as popen, \
             mock.patch.object(server.threading, "Thread") as thread:
            result = server.start_in_app_update()
        self.assertTrue(result["ok"])
        self.assertEqual(result["state"], "running")
        self.assertEqual(result["targetVersion"], "9.9.9")
        args = popen.call_args.args[0]
        self.assertEqual(args[-1], "update")
        self.assertTrue(str(args[0]).endswith("scripts/libredisplay"))
        thread.assert_called_once()

    def test_system_health_payload_is_privacy_safe(self):
        payload = server.system_health_payload()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["version"], server.APP_VERSION)
        self.assertIn(payload["deployment"], {"native", "docker", "source"})
        text = json.dumps(payload).lower()
        self.assertNotIn("dashboard_config", text)
        self.assertNotIn("token", text)


class ReleaseContractTests(unittest.TestCase):
    def test_plugin_manifests_load(self):
        ids = {x["id"] for x in server.plugin_manifests()}
        self.assertIn("todoist", ids)
        self.assertIn("caldav-tasks", ids)
        self.assertIn("home-assistant", ids)
        self.assertIn("sonos-now-playing", ids)
        self.assertIn("spotify-now-playing", ids)
        self.assertIn("google-tasks", ids)
        self.assertIn("microsoft-todo", ids)
        self.assertIn("trello", ids)
        self.assertIn("asana", ids)

    def test_trusted_private_plugin_scope_is_narrow(self):
        self.assertEqual(server.TRUSTED_PRIVATE_PLUGINS, {"home-assistant", "caldav-tasks", "sonos-now-playing"})

    def test_plugin_setting_keys_preserve_manifest_case(self):
        manifests = {row["id"]: row for row in server.plugin_manifests()}
        google_keys = {field["key"] for field in manifests["google-tasks"]["settings"]}
        caldav_keys = {field["key"] for field in manifests["caldav-tasks"]["settings"]}
        self.assertIn("taskListId", google_keys)
        self.assertIn("accessToken", google_keys)
        self.assertIn("collectionUrl", caldav_keys)
        self.assertNotIn("tasklistid", google_keys)

    def test_normalized_plugin_setting_keys_are_accepted(self):
        plugin = server.PLUGINS["google-tasks"]
        block = {"config": {"settings": {
            "tasklistid": "saved-list",
            "accesstoken": "saved-token",
            "showcompleted": True,
            "maxtasks": 17,
        }}}
        cleaned = server.integration_clean_settings(block, plugin)
        self.assertEqual(cleaned["taskListId"], "saved-list")
        self.assertEqual(cleaned["accessToken"], "saved-token")
        self.assertTrue(cleaned["showCompleted"])
        self.assertEqual(cleaned["maxTasks"], 17.0)


    def test_manifest_exposes_safe_directory_metadata(self):
        manifests = {row["id"]: row for row in server.plugin_manifests()}
        self.assertEqual(manifests["google-tasks"]["category"], "Planning")
        self.assertEqual(manifests["onedrive-photos"]["category"], "Photos")
        self.assertEqual(manifests["openstreetmap"]["category"], "Maps")
        self.assertIn(manifests["google-tasks"]["auth"], {"oauth", "credential", "none"})

    def test_integration_status_never_exposes_settings_or_secrets(self):
        config_path = server.endpoint_config_path("main")
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config = {"customBlocks": [{
            "id": "tasks-1", "type": "integration", "name": "Tasks",
            "config": {"plugin": "google-tasks", "settings": {
                "taskListId": "list-1", "accessToken": "super-secret-token",
                "refreshToken": "another-secret", "clientId": "client-id", "clientSecret": "client-secret",
            }}
        }]}
        config_path.write_text(json.dumps(config), encoding="utf-8")
        rows = server.integration_status_rows("main")
        self.assertEqual(rows[0]["pluginId"], "google-tasks")
        payload = json.dumps(rows)
        for secret in ("super-secret-token", "another-secret", "client-secret"):
            self.assertNotIn(secret, payload)
        self.assertNotIn("settings", rows[0])

    def test_integration_error_classification_is_actionable(self):
        self.assertEqual(server.integration_error_kind("HTTP 401 Unauthorized"), "authentication")
        self.assertEqual(server.integration_error_kind("HTTP 429 Too Many Requests"), "rate-limit")
        self.assertEqual(server.integration_error_kind("Connection timed out"), "network")
        self.assertEqual(server.integration_error_kind("Missing required setting: Token"), "configuration")

    def test_public_integration_error_redacts_credentials_and_url_details(self):
        message = "Bearer abc.def request https://api.example.test/tasks?token=secret123 failed api_key=anothersecret"
        clean = server.public_integration_error(message)
        self.assertIn("api.example.test", clean)
        for secret in ("abc.def", "secret123", "anothersecret"):
            self.assertNotIn(secret, clean)

    def test_integration_status_includes_refresh_and_safe_timestamps(self):
        config_path = server.endpoint_config_path("main")
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config = {"customBlocks": [{
            "id": "tasks-health", "type": "integration", "name": "Tasks health",
            "config": {"plugin": "google-tasks", "refreshMin": 7, "settings": {
                "taskListId": "@default", "accessToken": "health-secret",
            }}
        }]}
        config_path.write_text(json.dumps(config), encoding="utf-8")
        plugin = server.PLUGINS["google-tasks"]
        clean_settings = server.integration_clean_settings(config["customBlocks"][0], plugin)
        key = server.integration_cache_key("google-tasks", clean_settings)
        now = 2_000_000_000
        with mock.patch.object(server.time, "time", return_value=now):
            with server.BROKER_LOCK:
                server.BROKER_STATUS[key] = {
                    "status": "stale", "savedAt": now - 600, "age": 600,
                    "lastSuccessAt": now - 600, "lastAttemptAt": now - 5,
                    "error": "HTTP 401 Unauthorized",
                }
            row = server.integration_status_rows("main")[0]
        self.assertEqual(row["refreshMin"], 7)
        self.assertEqual(row["lastSuccessAt"], now - 600)
        self.assertEqual(row["lastAttemptAt"], now - 5)
        self.assertEqual(row["errorKind"], "authentication")
        self.assertEqual(row["nextRefreshAt"], now - 600 + 7 * 60)
        self.assertNotIn("health-secret", json.dumps(row))
        with server.BROKER_LOCK:
            server.BROKER_STATUS.pop(key, None)

    def test_force_live_broker_check_preserves_last_good_cache_on_failure(self):
        key = "health-force-live-cache"
        server.invalidate_broker_key(key)
        server.broker_save(key, b'{"ok":true}', "application/json", "plugin:test")
        with mock.patch.object(server.time, "time", return_value=2_000_000_100):
            data, content_type, state, age = server.broker_fetch(
                key, 300, lambda: (_ for _ in ()).throw(RuntimeError("Connection timed out")),
                "plugin:test", force=True,
            )
        self.assertEqual(data, b'{"ok":true}')
        self.assertEqual(content_type, "application/json")
        self.assertEqual(state, "stale")
        self.assertTrue(server.broker_load(key))
        with server.BROKER_LOCK:
            status = dict(server.BROKER_STATUS.get(key) or {})
        self.assertEqual(status.get("status"), "stale")
        self.assertEqual(status.get("lastAttemptAt"), 2_000_000_100)
        server.invalidate_broker_key(key)

    def test_integration_catalog_has_expected_plugins(self):
        manifests = server.plugin_manifests()
        self.assertEqual(len(manifests), 29)
        ids = {x["id"] for x in manifests}
        for required in {"onedrive-photos", "dropbox-photos", "box-photos", "flickr-photos", "icloud-shared-photos", "alpha-vantage", "coingecko", "frankfurter", "mapbox-travel", "openstreetmap", "gtfs-realtime", "aftership", "aviationstack", "google-pollen", "open-meteo-uv", "noaa-tides", "weather-company-pws", "fitbit", "slack-messages"}:
            self.assertIn(required, ids)

    def test_new_native_integration_kinds_are_declared(self):
        manifests = {row["id"]: row for row in server.plugin_manifests()}
        self.assertEqual(manifests["onedrive-photos"]["kind"], "photos")
        self.assertEqual(manifests["openstreetmap"]["kind"], "map")
        self.assertEqual(manifests["slack-messages"]["kind"], "messages")
        self.assertEqual(manifests["fitbit"]["kind"], "status")


if __name__ == "__main__":
    unittest.main()
