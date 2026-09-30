import importlib.util
import json
import unittest
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "plugins") not in sys.path:
    sys.path.insert(0, str(ROOT / "plugins"))


def load_plugin(name):
    path = ROOT / "plugins" / name / "plugin.py"
    spec = importlib.util.spec_from_file_location("plugin_" + name.replace("-", "_"), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeContext:
    def __init__(self, responses=None):
        self.responses = list(responses or [])
        self.calls = []

    def request(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if not self.responses:
            raise AssertionError("unexpected request")
        return self.responses.pop(0)

    def request_private(self, url, **kwargs):
        return self.request(url, **kwargs)

    def fetch_bytes(self, url, **kwargs):
        status, headers, data, final = self.request(url, **kwargs)
        if status >= 400:
            raise RuntimeError(f"HTTP {status}")
        return data, headers.get("Content-Type", "application/octet-stream")


class TodoistTests(unittest.TestCase):
    def setUp(self):
        self.plugin = load_plugin("todoist")

    def test_fetch_normalizes_task_payload(self):
        payload = {"results": [{"id": "123", "content": "Buy milk", "description": "2%", "priority": 3, "due": {"date": "2026-10-01"}, "labels": ["home"], "project_id": "p1"}]}
        ctx = FakeContext([(200, {"Content-Type": "application/json"}, json.dumps(payload).encode(), self.plugin.API + "/tasks")])
        result = self.plugin.fetch({"token": "abc", "maxTasks": 20, "showDescriptions": True}, ctx)
        self.assertEqual(result["provider"], "Todoist")
        self.assertEqual(result["tasks"][0]["title"], "Buy milk")
        self.assertEqual(result["tasks"][0]["due"], "2026-10-01")
        self.assertIn("Bearer abc", ctx.calls[0][1]["headers"]["Authorization"])

    def test_complete_uses_close_action(self):
        ctx = FakeContext([(204, {}, b"", self.plugin.API + "/tasks/123/close")])
        result = self.plugin.action({"token": "abc"}, ctx, "complete", {"id": "123"})
        self.assertTrue(result["completed"])
        self.assertEqual(ctx.calls[0][1]["method"], "POST")
        self.assertTrue(ctx.calls[0][0].endswith("/tasks/123/close"))


class CalDavTests(unittest.TestCase):
    def setUp(self):
        self.plugin = load_plugin("caldav-tasks")
        self.settings = {"collectionUrl": "https://cloud.example.test/remote.php/dav/calendars/u/tasks/", "username": "u", "password": "p", "verifyTls": True, "showCompleted": False}

    def test_report_parses_vtodo(self):
        xml = b'''<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/remote.php/dav/calendars/u/tasks/a.ics</d:href><d:propstat><d:prop><d:getetag>"abc"</d:getetag><c:calendar-data>BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:one\r\nSUMMARY:Take bins out\r\nDUE:20261001T200000Z\r\nSTATUS:NEEDS-ACTION\r\nEND:VTODO\r\nEND:VCALENDAR\r\n</c:calendar-data></d:prop></d:propstat></d:response></d:multistatus>'''
        ctx = FakeContext([(207, {"Content-Type": "application/xml"}, xml, self.settings["collectionUrl"])])
        result = self.plugin.fetch(self.settings, ctx)
        self.assertEqual(result["tasks"][0]["title"], "Take bins out")
        self.assertFalse(result["tasks"][0]["completed"])
        self.assertEqual(ctx.calls[0][1]["method"], "REPORT")
        self.assertEqual(ctx.calls[0][1]["headers"]["Depth"], "1")

    def test_complete_gets_then_puts_with_etag(self):
        raw = b"BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:one\r\nSUMMARY:Task\r\nSTATUS:NEEDS-ACTION\r\nPERCENT-COMPLETE:0\r\nEND:VTODO\r\nEND:VCALENDAR\r\n"
        ctx = FakeContext([
            (200, {"Content-Type": "text/calendar", "ETag": '"old"'}, raw, "https://cloud.example.test/t.ics"),
            (204, {}, b"", "https://cloud.example.test/t.ics"),
        ])
        result = self.plugin.action(self.settings, ctx, "complete", {"id": "one", "href": "/remote.php/dav/calendars/u/tasks/t.ics", "etag": '"old"'})
        self.assertTrue(result["completed"])
        self.assertEqual(ctx.calls[1][1]["method"], "PUT")
        self.assertEqual(ctx.calls[1][1]["headers"]["If-Match"], '"old"')
        body = ctx.calls[1][1]["body"].decode()
        self.assertIn("STATUS:COMPLETED", body)
        self.assertIn("PERCENT-COMPLETE:100", body)

    def test_http_requires_explicit_opt_in(self):
        settings = dict(self.settings, collectionUrl="http://192.168.1.20/tasks/")
        with self.assertRaises(ValueError):
            self.plugin.fetch(settings, FakeContext())


    def test_task_href_cannot_change_origin(self):
        with self.assertRaises(ValueError):
            self.plugin._task_url("https://cloud.example/remote.php/dav/calendars/u/tasks/", "http://cloud.example/task.ics")
        with self.assertRaises(ValueError):
            self.plugin._task_url("https://cloud.example/remote.php/dav/calendars/u/tasks/", "https://cloud.example:444/task.ics")
        self.assertEqual(
            self.plugin._task_url("https://cloud.example/remote.php/dav/calendars/u/tasks/", "/remote.php/dav/calendars/u/tasks/a.ics"),
            "https://cloud.example/remote.php/dav/calendars/u/tasks/a.ics",
        )


class SonosTests(unittest.TestCase):
    def setUp(self):
        self.plugin = load_plugin("sonos-now-playing")
        self.settings = {"speaker": "192.168.1.42", "port": 1400}

    def test_now_playing_metadata(self):
        didl = '&lt;DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"&gt;&lt;item&gt;&lt;dc:title&gt;Song&lt;/dc:title&gt;&lt;dc:creator&gt;Artist&lt;/dc:creator&gt;&lt;upnp:album&gt;Album&lt;/upnp:album&gt;&lt;upnp:albumArtURI&gt;/getaa?s=1&lt;/upnp:albumArtURI&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;'
        position = ('<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>'
                    '<u:GetPositionInfoResponse xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">'
                    '<TrackDuration>00:03:30</TrackDuration><RelTime>00:01:05</RelTime><TrackMetaData>' + didl +
                    '</TrackMetaData><TrackURI>x-sonos-http:test</TrackURI></u:GetPositionInfoResponse></s:Body></s:Envelope>').encode()
        transport = b'<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:GetTransportInfoResponse xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><CurrentTransportState>PLAYING</CurrentTransportState></u:GetTransportInfoResponse></s:Body></s:Envelope>'
        ctx = FakeContext([
            (200, {"Content-Type": "text/xml"}, position, "http://192.168.1.42:1400/MediaRenderer/AVTransport/Control"),
            (200, {"Content-Type": "text/xml"}, transport, "http://192.168.1.42:1400/MediaRenderer/AVTransport/Control"),
        ])
        result = self.plugin.fetch(self.settings, ctx)
        self.assertEqual(result["title"], "Song")
        self.assertEqual(result["artist"], "Artist")
        self.assertTrue(result["isPlaying"])
        self.assertEqual(result["progressMs"], 65000)
        self.assertEqual(result["durationMs"], 210000)
        self.assertTrue(result["image"].startswith("http://192.168.1.42:1400/"))

    def test_invalid_sonos_host_is_rejected(self):
        with self.assertRaises(ValueError):
            self.plugin.fetch({"speaker": "http://user:pass@192.168.1.42/"}, FakeContext())


class SpotifyTests(unittest.TestCase):
    def setUp(self):
        self.plugin = load_plugin("spotify-now-playing")
        self.plugin._TOKEN_CACHE.clear()

    def test_direct_access_token_now_playing(self):
        payload = {
            "is_playing": True,
            "progress_ms": 12000,
            "currently_playing_type": "track",
            "item": {
                "type": "track", "name": "Song", "duration_ms": 200000,
                "artists": [{"name": "Artist"}],
                "album": {"name": "Album", "images": [{"url": "https://i.scdn.co/image/test"}]},
                "external_urls": {"spotify": "https://open.spotify.com/track/abc"},
            },
        }
        ctx = FakeContext([(200, {"Content-Type": "application/json"}, json.dumps(payload).encode(), self.plugin.NOW_URL)])
        result = self.plugin.fetch({"accessToken": "token"}, ctx)
        self.assertEqual(result["title"], "Song")
        self.assertEqual(result["artist"], "Artist")
        self.assertEqual(result["durationMs"], 200000)
        self.assertIn("Bearer token", ctx.calls[0][1]["headers"]["Authorization"])

    def test_refresh_token_flow(self):
        token_payload = {"access_token": "fresh", "token_type": "Bearer", "expires_in": 3600}
        now_payload = {"is_playing": False, "progress_ms": 0, "item": None}
        ctx = FakeContext([
            (200, {"Content-Type": "application/json"}, json.dumps(token_payload).encode(), self.plugin.TOKEN_URL),
            (200, {"Content-Type": "application/json"}, json.dumps(now_payload).encode(), self.plugin.NOW_URL),
        ])
        result = self.plugin.fetch({"clientId": "id", "clientSecret": "secret", "refreshToken": "refresh"}, ctx)
        self.assertEqual(result["provider"], "Spotify")
        self.assertEqual(ctx.calls[0][1]["method"], "POST")
        self.assertIn(b"grant_type=refresh_token", ctx.calls[0][1]["body"])


class GoogleTasksTests(unittest.TestCase):
    def setUp(self):
        self.plugin = load_plugin("google-tasks")
        self.plugin._TOKEN_CACHE.clear()

    def test_fetch_normalizes_google_tasks(self):
        payload = {"items": [{"id": "g1", "title": "Call dentist", "notes": "Ask about Thursday", "status": "needsAction", "due": "2026-10-02T00:00:00.000Z"}]}
        ctx = FakeContext([(200, {"Content-Type": "application/json"}, json.dumps(payload).encode(), self.plugin.API)])
        result = self.plugin.fetch({"accessToken": "token", "taskListId": "@default", "maxTasks": 20, "showDescriptions": True}, ctx)
        self.assertEqual(result["provider"], "Google Tasks")
        self.assertEqual(result["tasks"][0]["title"], "Call dentist")
        self.assertEqual(result["tasks"][0]["dueText"], "2026-10-02")
        self.assertIn("Bearer token", ctx.calls[0][1]["headers"]["Authorization"])

    def test_refresh_token_flow_and_complete(self):
        token_payload = {"access_token": "fresh", "expires_in": 3600}
        ctx = FakeContext([
            (200, {"Content-Type": "application/json"}, json.dumps(token_payload).encode(), self.plugin.TOKEN_URL),
            (200, {"Content-Type": "application/json"}, b'{}', self.plugin.API),
        ])
        settings = {"refreshToken": "refresh", "clientId": "client", "clientSecret": "secret", "taskListId": "@default"}
        result = self.plugin.action(settings, ctx, "complete", {"id": "g1"})
        self.assertTrue(result["completed"])
        self.assertEqual(ctx.calls[0][1]["method"], "POST")
        self.assertIn(b"grant_type=refresh_token", ctx.calls[0][1]["body"])
        self.assertEqual(ctx.calls[1][1]["method"], "PATCH")
        self.assertIn(b'"status":"completed"', ctx.calls[1][1]["body"])


class MicrosoftTodoTests(unittest.TestCase):
    def setUp(self):
        self.plugin = load_plugin("microsoft-todo")
        self.plugin._TOKEN_CACHE.clear()

    def test_fetch_selected_list_and_reopen(self):
        payload = {"value": [{"id": "m1", "title": "Pack bag", "status": "completed", "importance": "high", "body": {"contentType": "text", "content": "Shoes"}, "dueDateTime": {"dateTime": "2026-10-03T17:00:00", "timeZone": "UTC"}}]}
        ctx = FakeContext([
            (200, {"Content-Type": "application/json"}, json.dumps(payload).encode(), self.plugin.GRAPH),
            (200, {"Content-Type": "application/json"}, b'{}', self.plugin.GRAPH),
        ])
        settings = {"accessToken": "token", "taskListId": "list1", "showCompleted": True, "showDescriptions": True, "maxTasks": 20}
        result = self.plugin.fetch(settings, ctx)
        self.assertEqual(result["tasks"][0]["listId"], "list1")
        self.assertEqual(result["tasks"][0]["description"], "Shoes")
        action = self.plugin.action(settings, ctx, "reopen", {"id": "m1", "listId": "list1"})
        self.assertFalse(action["completed"])
        self.assertEqual(ctx.calls[1][1]["method"], "PATCH")
        self.assertIn(b'"status":"notStarted"', ctx.calls[1][1]["body"])

    def test_refresh_token_flow(self):
        token_payload = {"access_token": "fresh-ms", "expires_in": 3600}
        task_payload = {"value": []}
        ctx = FakeContext([
            (200, {"Content-Type": "application/json"}, json.dumps(token_payload).encode(), "https://login.microsoftonline.com/common/oauth2/v2.0/token"),
            (200, {"Content-Type": "application/json"}, json.dumps(task_payload).encode(), self.plugin.GRAPH),
        ])
        self.plugin.fetch({"refreshToken": "refresh", "clientId": "client", "tenant": "common", "taskListId": "list1"}, ctx)
        self.assertIn(b"offline_access", ctx.calls[0][1]["body"])
        self.assertIn("Bearer fresh-ms", ctx.calls[1][1]["headers"]["Authorization"])


class TrelloTests(unittest.TestCase):
    def setUp(self):
        self.plugin = load_plugin("trello")

    def test_fetch_filters_and_normalizes_cards(self):
        payload = [
            {"id": "c1", "name": "Order filters", "desc": "HVAC", "due": "2026-10-04T12:00:00.000Z", "dueComplete": False, "idBoard": "b1", "idList": "l1", "closed": False},
            {"id": "c2", "name": "Other", "dueComplete": False, "idBoard": "b2", "idList": "l2", "closed": False},
        ]
        ctx = FakeContext([(200, {"Content-Type": "application/json"}, json.dumps(payload).encode(), self.plugin.API)])
        result = self.plugin.fetch({"accessToken": "token", "boardId": "b1", "showDescriptions": True, "maxTasks": 20}, ctx)
        self.assertEqual(len(result["tasks"]), 1)
        self.assertEqual(result["tasks"][0]["description"], "HVAC")
        self.assertIn("Bearer token", ctx.calls[0][1]["headers"]["Authorization"])

    def test_due_complete_toggle_with_api_key_token_credentials(self):
        ctx = FakeContext([(200, {"Content-Type": "application/json"}, b'{}', self.plugin.API)])
        result = self.plugin.action({"apiKey": "key", "apiToken": "token"}, ctx, "complete", {"id": "c1"})
        self.assertTrue(result["completed"])
        self.assertEqual(ctx.calls[0][1]["method"], "PUT")
        self.assertIn("key=key", ctx.calls[0][0])
        self.assertIn(b'"dueComplete":true', ctx.calls[0][1]["body"])


class AsanaTests(unittest.TestCase):
    def setUp(self):
        self.plugin = load_plugin("asana")

    def test_workspace_my_tasks_fetch(self):
        payload = {"data": [{"gid": "a1", "name": "Book service", "notes": "Car", "due_on": "2026-10-05", "completed": False, "memberships": [{"project": {"name": "Home"}}]}]}
        ctx = FakeContext([(200, {"Content-Type": "application/json"}, json.dumps(payload).encode(), self.plugin.API)])
        result = self.plugin.fetch({"token": "pat", "workspaceGid": "w1", "showDescriptions": True, "maxTasks": 20}, ctx)
        self.assertEqual(result["provider"], "Asana")
        self.assertEqual(result["tasks"][0]["projectName"], "Home")
        self.assertIn("assignee=me", ctx.calls[0][0])
        self.assertIn("workspace=w1", ctx.calls[0][0])

    def test_complete_task(self):
        ctx = FakeContext([(200, {"Content-Type": "application/json"}, b'{"data":{}}', self.plugin.API)])
        result = self.plugin.action({"token": "pat"}, ctx, "complete", {"id": "a1"})
        self.assertTrue(result["completed"])
        self.assertEqual(ctx.calls[0][1]["method"], "PUT")
        self.assertIn(b'"completed":true', ctx.calls[0][1]["body"])


class NewIntegrationTests(unittest.TestCase):
    def test_flickr_album_normalizes_public_urls(self):
        plugin = load_plugin("flickr-photos")
        payload = {"stat":"ok","photoset":{"photo":[{"id":"p1","title":"Lake","url_l":"https://live.staticflickr.com/test.jpg"}]}}
        ctx = FakeContext([(200,{"Content-Type":"application/json"},json.dumps(payload).encode(),"https://www.flickr.com/services/rest/")])
        result = plugin.fetch({"apiKey":"k","userId":"u","photosetId":"set","maxPhotos":10,"intervalSec":30},ctx)
        self.assertEqual(result["kind"],"photos")
        self.assertEqual(result["photos"][0]["name"],"Lake")
        self.assertFalse(result["protected"])

    def test_onedrive_photo_listing_is_protected(self):
        plugin = load_plugin("onedrive-photos")
        payload = {"value":[{"id":"1","name":"Photo.jpg","file":{"mimeType":"image/jpeg"}},{"id":"2","name":"notes.txt","file":{"mimeType":"text/plain"}}]}
        ctx = FakeContext([(200,{"Content-Type":"application/json"},json.dumps(payload).encode(),"https://graph.microsoft.com/v1.0/me/drive/root/children")])
        result = plugin.fetch({"accessToken":"token","folderId":"root","maxPhotos":20,"intervalSec":30},ctx)
        self.assertEqual(len(result["photos"]),1)
        self.assertTrue(result["protected"])
        self.assertNotIn("token",json.dumps(result))

    def test_box_media_follows_signed_download_redirect_without_auth_header(self):
        plugin = load_plugin("box-photos")
        ctx = FakeContext([
            (302,{"Location":"https://dl.boxcloud.com/signed","Content-Type":"text/html"},b"","https://api.box.com/2.0/files/10/content"),
            (200,{"Content-Type":"image/jpeg"},b"JPEG","https://dl.boxcloud.com/signed"),
        ])
        body, ctype = plugin.media({"accessToken":"token"},ctx,"10")
        self.assertEqual(body,b"JPEG")
        self.assertEqual(ctype,"image/jpeg")
        self.assertIn("Authorization",ctx.calls[0][1]["headers"])
        self.assertNotIn("Authorization",ctx.calls[1][1].get("headers",{}))

    def test_weather_company_pws_uses_current_unit_codes(self):
        plugin = load_plugin("weather-company-pws")
        unit_field = next(x for x in plugin.MANIFEST["settings"] if x.get("key") == "units")
        self.assertEqual([x["value"] for x in unit_field["options"]], ["e", "m", "h"])
        payload = {"observations": [{"stationID": "TEST", "humidity": 50, "obsTimeLocal": "2026-09-30 12:00:00", "metric": {"temp": 21, "windSpeed": 8, "pressure": 1015}}]}
        ctx = FakeContext([(200, {"Content-Type": "application/json"}, json.dumps(payload).encode(), "https://api.weather.com/v2/pws/observations/current")])
        result = plugin.fetch({"apiKey": "key", "stationId": "TEST", "units": "m"}, ctx)
        self.assertEqual(result["value"], 21)
        self.assertIn("units=m", ctx.calls[0][0])

    def test_frankfurter_v2_rate_conversion(self):
        plugin = load_plugin("frankfurter")
        payload = [{"date":"2026-09-30","base":"USD","quote":"EUR","rate":0.85}]
        ctx = FakeContext([(200,{"Content-Type":"application/json"},json.dumps(payload).encode(),"https://api.frankfurter.dev/v2/rates")])
        result = plugin.fetch({"base":"USD","quote":"EUR","amount":10},ctx)
        self.assertEqual(result["value"],8.5)
        self.assertEqual(result["suffix"]," EUR")

    def test_gtfs_realtime_minimal_decoder(self):
        plugin = load_plugin("gtfs-realtime")
        def varint(n):
            out=bytearray()
            while True:
                b=n&127;n>>=7
                if n: out.append(b|128)
                else: out.append(b); return bytes(out)
        def fld(num, payload): return varint((num<<3)|2)+varint(len(payload))+payload
        def vint(num,val): return varint((num<<3)|0)+varint(val)
        now=2000000000
        trip=fld(5,b"R1")
        event=vint(2,now+600)
        stop=fld(2,event)+fld(4,b"STOP")
        update=fld(1,trip)+fld(2,stop)
        entity=fld(3,update)
        feed=fld(2,entity)
        ctx=FakeContext([(200,{"Content-Type":"application/x-protobuf"},feed,"https://agency.example/gtfs.pb")])
        old_time=plugin.time.time
        try:
            plugin.time.time=lambda: now
            result=plugin.fetch({"feedUrl":"https://agency.example/gtfs.pb","stopId":"STOP","routeId":"R1","maxArrivals":4,"label":"Bus"},ctx)
        finally:
            plugin.time.time=old_time
        self.assertEqual(result["arrivals"][0]["minutes"],10)
        self.assertEqual(result["arrivals"][0]["routeId"],"R1")


if __name__ == "__main__":
    unittest.main()
