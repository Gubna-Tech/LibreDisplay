import hashlib
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"


PROTECTED_ARRANGE_HASHES = {
    "placeSelectedLayoutBlock": "1ef04287a75ee3076397f0321d0770aaae2958c9cf3d886e205959fb6a239132",
    "selectLayoutBlock": "91628141697604adfa06c57e8e2af032e59e343b1878f8c0a7b91b05c90c47a0",
    "updateLayoutSelectedInfo": "31fa9938a75129b730afebb9b9e76f9f2e1dfb8e1960fd04b558ef9c4042dc48",
    "beginLayoutPointer": "936bb28dc21eda58aa13e39d11d6eaa3e37feaf07a5f1f7faa19ca4cf538a945",
    "moveLayoutPointer": "9e878796247b08fd63a018963ba0ff61272b34e3a9ba5164ca69ae56eaecccb3",
    "endLayoutPointer": "cfbfc4ba7b1a8332667bb27271e2a32d43f296d9d5e6fa9e19ec1acb6197ec94",
    "setLayoutEditorGrid": "a149c7ab6f90fd2d4add5758f85b96461e15794d9d562f8e24ec35c8a364ab3e",
    "setLayoutEditorSnap": "c21f61f3dd0f3ed20e3b2f20c80a54aee5056617d7b86900a786c29f6303018d",
    "startLayoutEditor": "417082d1660d523bc627f76e7733473b61df371a38c343c4096a3e5f0b46a2b1",
    "saveLayoutEditor": "6119f7baf6bb54d222a1e442b05050440508581b14a55b8ba3d91c0ab2d4a1a7",
}


def extract_function(source: str, name: str) -> str:
    match = re.search(rf"(?m)^(?:async\s+)?function\s+{re.escape(name)}\s*\(", source)
    if not match:
        raise AssertionError(f"missing function {name}")
    brace = source.find("{", match.start())
    depth = 0
    quote = None
    escape = False
    for index in range(brace, len(source)):
        ch = source[index]
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            continue
        if ch in "'\"`":
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return source[match.start():index + 1]
    raise AssertionError(f"unterminated function {name}")


class FrontendArchitectureTests(unittest.TestCase):
    def test_dashboard_is_thin_shell_with_external_assets(self):
        html = (APP / "dashboard.html").read_text(encoding="utf-8")
        self.assertLess(len(html.splitlines()), 1200)
        self.assertLess(len(html.encode("utf-8")), 300_000)
        self.assertIn('<link rel="stylesheet" href="/css/dashboard.css">', html)
        self.assertIn('<script type="module" src="/js/app.js"></script>', html)
        self.assertNotIn("<style>", html)
        self.assertNotRegex(html, r"<script>\s*const DASHBOARD_BUILD")

    def test_expected_native_module_boundaries_exist(self):
        manifest = json.loads((APP / "js" / "module-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual([row["order"] for row in manifest], list(range(1, len(manifest) + 1)))
        logical = list(dict.fromkeys(row["module"] for row in manifest))
        self.assertEqual(logical, [
            "bootstrap", "shared", "integrations", "config", "performance", "weather", "calendar",
            "backgrounds", "blocks", "layout", "appearance", "remote",
            "system", "onboarding", "settings", "lifecycle",
        ])
        self.assertEqual(sum(row["functions"] for row in manifest), 790)
        self.assertGreaterEqual(len(manifest), 28)
        split_modules = {name: sum(row["module"] == name for row in manifest) for name in logical}
        for name in ("weather", "calendar", "backgrounds", "layout", "appearance", "system", "settings"):
            self.assertGreater(split_modules[name], 1, name)
        for row in manifest:
            path = APP / "js" / row["path"].removeprefix("/js/")
            self.assertTrue(path.is_file(), row["path"])
            self.assertEqual(row["lines"], len(path.read_text(encoding="utf-8").splitlines()))
            self.assertGreater(row["functions"], 0)
            self.assertLessEqual(row["lines"], 550, row["path"])
        self.assertTrue((APP / "js" / "core" / "runtime.js").is_file())
        self.assertTrue((APP / "css" / "dashboard.css").is_file())

    def test_shared_helpers_are_owned_by_core_before_feature_modules(self):
        shared = (APP / "js" / "core" / "shared.js").read_text(encoding="utf-8")
        weather = (APP / "js" / "weather" / "index.js").read_text(encoding="utf-8")
        calendar = (APP / "js" / "calendar" / "index.js").read_text(encoding="utf-8")
        appearance = (APP / "js" / "appearance" / "index.js").read_text(encoding="utf-8")
        self.assertIn("function uiCfg()", shared)
        self.assertIn("async function fetchRemoteText", shared)
        self.assertNotIn("function uiCfg()", appearance)
        self.assertNotIn("async function fetchRemoteText", calendar)
        self.assertIn("fetchRemoteText(", weather)


    def test_performance_scheduler_supports_low_power_frontends(self):
        source = (APP / "js" / "core" / "performance.js").read_text(encoding="utf-8")
        self.assertIn("function runExclusiveTask", source)
        self.assertIn("function startManagedInterval", source)
        self.assertIn("function frontendCapabilities", source)
        self.assertIn("memoryGB<=2", source)
        self.assertIn("hardwareConcurrency", source)
        self.assertIn("pageUptimeMs", source)
        self.assertIn("longTaskObserverActive", source)
        self.assertIn("performance.memory.usedJSHeapSize", source)

    def test_lifecycle_orchestration_uses_module_interfaces(self):
        source = (APP / "js" / "lifecycle" / "index.js").read_text(encoding="utf-8")
        for name in ("appearance", "settings", "integrations", "blocks", "config", "system", "onboarding", "weather", "calendar", "remote"):
            self.assertIn(f"LibreDisplayRuntime.getModule('{name}')", source)
        self.assertIn("remote.startLiveDisplayConnection();", source)
        self.assertIn("remote.startRemoteConfigPolling();", source)
        self.assertIn("await config.loadCfg();", source)


    def test_refresh_loops_use_managed_non_overlapping_scheduler(self):
        settings = (APP / "js" / "settings" / "index.js").read_text(encoding="utf-8")
        remote = (APP / "js" / "remote" / "index.js").read_text(encoding="utf-8")
        for key in ("weather-refresh", "calendar-refresh", "alert-refresh"):
            self.assertIn(f"startManagedInterval('{key}'", settings)
            self.assertIn(f"runExclusiveTask('{key}'", settings)
        self.assertIn("startManagedInterval('display-heartbeat'", remote)
        self.assertIn("startManagedInterval('remote-config-poll'", remote)

    def test_low_power_motion_path_stops_js_driven_scrollers(self):
        appearance = (APP / "js" / "appearance" / "index.js").read_text(encoding="utf-8")
        alerts = (APP / "js" / "weather" / "alerts.js").read_text(encoding="utf-8")
        calendar = (APP / "js" / "calendar" / "index.js").read_text(encoding="utf-8")
        css = (APP / "css" / "dashboard.css").read_text(encoding="utf-8")
        self.assertIn("frontendCapabilities().constrained", appearance)
        self.assertIn("classList.contains('ld-reduce-motion')", alerts)
        self.assertIn("classList.contains('ld-reduce-motion')", calendar)
        self.assertIn(".ld-constrained-device", css)

    def test_frontend_static_asset_route_is_path_confined(self):
        source = (APP / "dashboard_server.py").read_text(encoding="utf-8")
        self.assertIn("def serve_frontend_asset(self, parsed):", source)
        self.assertIn("not _path_within(target, asset_root)", source)
        self.assertIn('expected_suffix = ".js" if asset_kind == "js" else ".css"', source)
        self.assertIn('parsed.path.startswith("/js/") or parsed.path.startswith("/css/")', source)

    def test_protected_arrange_engine_is_unchanged_from_v158(self):
        source = (APP / "js" / "layout" / "index.js").read_text(encoding="utf-8")
        for name, expected in PROTECTED_ARRANGE_HASHES.items():
            actual = hashlib.sha256(extract_function(source, name).encode("utf-8")).hexdigest()
            self.assertEqual(actual, expected, name)



    def test_all_runtime_sources_are_modulepreloaded_for_parallel_fetch(self):
        manifest = json.loads((APP / "js" / "module-manifest.json").read_text(encoding="utf-8"))
        html = (APP / "dashboard.html").read_text(encoding="utf-8")
        expected = ["/js/core/runtime.js"] + [row["path"] for row in manifest]
        for path in expected:
            self.assertIn(f'<link rel="modulepreload" href="{path}">', html, path)

    def test_module_bootstrap_order_matches_manifest(self):
        manifest = json.loads((APP / "js" / "module-manifest.json").read_text(encoding="utf-8"))
        app_source = (APP / "js" / "app.js").read_text(encoding="utf-8")
        expected = ["/js/core/runtime.js"] + [row["path"] for row in manifest]
        for earlier, later in zip(expected, expected[1:]):
            self.assertLess(app_source.index(f'"{earlier}"'), app_source.index(f'"{later}"'))


    def test_install_and_update_run_frontend_manifest_verifier(self):
        install = (ROOT / "install.sh").read_text(encoding="utf-8")
        update = (ROOT / "update.sh").read_text(encoding="utf-8")
        verifier = ROOT / "scripts" / "verify-frontend.py"
        self.assertTrue(verifier.is_file())
        self.assertIn('scripts/verify-frontend.py" "$SRC_DIR"', install)
        self.assertIn('scripts/verify-frontend.py" "$SRC_DIR"', update)
        self.assertIn('[ -f "$SRC_DIR/scripts/verify-frontend.py" ]', update)
        self.assertNotIn('[ -x "$SRC_DIR/scripts/verify-frontend.py" ]', update)

    def test_install_update_and_docker_ship_frontend_assets(self):
        docker = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        install = (ROOT / "install.sh").read_text(encoding="utf-8")
        update = (ROOT / "update.sh").read_text(encoding="utf-8")
        self.assertIn("COPY --chown=libredisplay:libredisplay app /app/", docker)
        self.assertIn('find "$INSTALL_DIR/app/js" "$INSTALL_DIR/app/css" -type f -exec chmod 644 {} +', install)
        self.assertIn('cp -a "$SRC_DIR/app" "$SRC_DIR/scripts" "$SRC_DIR/assets" "$STAGE_DIR/"', update)
        self.assertIn('find "$INSTALL_DIR/app/js" "$INSTALL_DIR/app/css" -type f -exec chmod 644 {} +', update)



    def test_shared_core_owns_generic_frontend_utilities(self):
        shared = (APP / "js" / "core" / "shared.js").read_text(encoding="utf-8")
        for name in ("escHtml", "esc", "safeHttpUrl", "normalizeHexColor", "scaledClamp"):
            self.assertIn(f"function {name}", shared)
        former_owners = {
            "blocks/index.js": ("escHtml", "safeHttpUrl"),
            "calendar/index.js": ("esc",),
            "onboarding/index.js": ("normalizeHexColor",),
            "backgrounds/index.js": ("scaledClamp",),
        }
        for relative, names in former_owners.items():
            source = (APP / "js" / relative).read_text(encoding="utf-8")
            for name in names:
                self.assertNotIn(f"function {name}", source, relative)

    def test_helper_modules_use_api_only_exports_and_bridge_is_selective(self):
        shared = (APP / "js" / "core" / "shared.js").read_text(encoding="utf-8")
        parser = (APP / "js" / "calendar" / "ics-parser.js").read_text(encoding="utf-8")
        recurrence = (APP / "js" / "calendar" / "recurrence.js").read_text(encoding="utf-8")
        photos = (APP / "js" / "backgrounds" / "google-photos.js").read_text(encoding="utf-8")
        self.assertIn("{globals:false}", shared)
        self.assertIn("{globals:false}", parser)
        self.assertIn("{globals:false}", recurrence)
        self.assertIn("{globals:false}", photos)
        for relative in (
            "weather/index.js", "calendar/index.js", "backgrounds/index.js", "blocks/index.js",
            "layout/index.js", "appearance/index.js", "onboarding/index.js",
        ):
            source = (APP / "js" / relative).read_text(encoding="utf-8")
            self.assertIn("LibreDisplayRuntime.getModule(", source, relative)
        selective = 0
        for path in (APP / "js").rglob("*.js"):
            if "globalFunctions:[" in path.read_text(encoding="utf-8"):
                selective += 1
        self.assertGreaterEqual(selective, 20)

    def test_module_runtime_has_registry_and_compatibility_bridge(self):
        runtime = (APP / "js" / "core" / "runtime.js").read_text(encoding="utf-8")
        app = (APP / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("const registry = new Map();", runtime)
        self.assertIn("function getModule(name)", runtime)
        self.assertIn("Object.defineProperties(globalThis, globalStates);", runtime)
        self.assertIn("Object.defineProperties(api,stateDescriptors);", runtime)
        self.assertIn("const previous = registry.get(name);", runtime)
        self.assertIn("Object.getOwnPropertyDescriptors(previous)", runtime)
        self.assertIn("Object.assign(api,functions)", runtime)
        self.assertIn("const exportOwners = new Map();", runtime)
        self.assertIn("global export collision", runtime)
        self.assertIn("function describeModules()", runtime)
        self.assertIn("options.globals!==false", runtime)
        self.assertIn("options.globalFunctions", runtime)
        self.assertIn("function describeBridge()", runtime)
        self.assertIn("globalThis.LibreDisplayModules = LibreDisplayRuntime.finalizeModules();", app)



    def test_modules_do_not_rely_on_unbridged_cross_file_identifiers(self):
        js_files = sorted((APP / "js").rglob("*.js"))

        def mask_strings_and_comments(source: str) -> str:
            out = list(source)
            i = 0
            quote = None
            escape = False
            line_comment = False
            block_comment = False
            while i < len(source):
                ch = source[i]
                nxt = source[i + 1] if i + 1 < len(source) else ""
                if line_comment:
                    if ch == "\n":
                        line_comment = False
                    else:
                        out[i] = " "
                elif block_comment:
                    if ch == "*" and nxt == "/":
                        out[i] = out[i + 1] = " "
                        i += 1
                        block_comment = False
                    elif ch != "\n":
                        out[i] = " "
                elif quote:
                    if ch == "\n" and quote != "`":
                        quote = None
                    elif escape:
                        escape = False
                        if ch != "\n":
                            out[i] = " "
                    elif ch == "\\":
                        escape = True
                        out[i] = " "
                    elif ch == quote:
                        out[i] = " "
                        quote = None
                    elif ch != "\n":
                        out[i] = " "
                elif ch == "/" and nxt == "/":
                    out[i] = out[i + 1] = " "
                    i += 1
                    line_comment = True
                elif ch == "/" and nxt == "*":
                    out[i] = out[i + 1] = " "
                    i += 1
                    block_comment = True
                elif ch in "'\"`":
                    quote = ch
                    out[i] = " "
                i += 1
            return "".join(out)

        bridged = set()
        masked = {}
        local_declarations = {}
        destructured_bindings = {}
        bare_references = {}
        declaration_pattern = re.compile(r"\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)\b")
        destructure_pattern = re.compile(r"\b(?:const|let|var)\s*\{([^}]*)\}\s*=", re.S)
        identifier_pattern = re.compile(r"(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)\b")

        for path in js_files:
            source = path.read_text(encoding="utf-8")
            clean = mask_strings_and_comments(source)
            masked[path] = clean
            for key in ("globalFunctions", "globalStates"):
                for match in re.finditer(rf"{key}\s*:\s*\[([^\]]*)\]", source, re.S):
                    bridged.update(re.findall(r"['\"]([A-Za-z_$][\w$]*)['\"]", match.group(1)))
            local_declarations[path] = {match.group(1) for match in declaration_pattern.finditer(clean)}
            destructured = set()
            for match in destructure_pattern.finditer(clean):
                destructured.update(re.findall(r"\b([A-Za-z_$][\w$]*)\b", match.group(1)))
            destructured_bindings[path] = destructured
            refs = {}
            for match in identifier_pattern.finditer(clean):
                name = match.group(1)
                index = match.start(1)
                if index > 0 and clean[index - 1] == "." and not (index >= 3 and clean[index - 3:index] == "..."):
                    continue
                refs.setdefault(name, clean.count("\n", 0, index) + 1)
            bare_references[path] = refs

        definitions = []
        top_level_pattern = re.compile(r"^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)\b")
        for path, source in masked.items():
            for line_no, line in enumerate(source.splitlines(), 1):
                match = top_level_pattern.match(line)
                if match:
                    definitions.append((match.group(1), path, line_no))

        failures = []
        for name, defining_path, line_no in definitions:
            if name in bridged or len(name) < 3:
                continue
            for path in js_files:
                if path == defining_path or name in local_declarations[path] or name in destructured_bindings[path]:
                    continue
                target_line = bare_references[path].get(name)
                if target_line is None:
                    continue
                failures.append(
                    f"{name} defined in {defining_path.relative_to(ROOT)}:{line_no} "
                    f"is referenced bare from {path.relative_to(ROOT)}:{target_line}"
                )
        self.assertEqual(failures, [], "\n".join(failures))

    def test_custom_block_periodic_work_uses_managed_scheduler_and_has_no_detached_photo_timer(self):
        source = (ROOT / "app" / "js" / "blocks" / "index.js").read_text(encoding="utf-8")
        self.assertIn("const performanceApi=LibreDisplayRuntime.getModule('performance');", source)
        self.assertIn("performanceApi.startManagedInterval", source)
        self.assertIn("performanceApi.stopManagedInterval", source)
        self.assertNotIn("setInterval(", source)
        self.assertNotIn("_photoTimer", source)
    def test_all_frontend_network_requests_use_resilient_fetch_wrapper(self):
        import re
        raw_fetch = re.compile(r"\bfetch\s*\(")
        offenders = []
        for path in sorted((ROOT / "app" / "js").rglob("*.js")):
            if path.relative_to(ROOT).as_posix() == "app/js/core/shared.js":
                continue
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if raw_fetch.search(line):
                    offenders.append(f"{path.relative_to(ROOT)}:{number}")
        self.assertEqual(offenders, [], "raw frontend fetch() bypasses resilientFetch: " + ", ".join(offenders))

    def test_server_generated_login_fetch_is_explicitly_bounded(self):
        source = (ROOT / "app" / "dashboard_server.py").read_text(encoding="utf-8")
        self.assertEqual(source.count("fetch('/api/login'"), 1)
        segment = source[source.index("fetch('/api/login'") - 300:source.index("fetch('/api/login'") + 700]
        self.assertIn("AbortController", segment)
        self.assertIn("signal:c.signal", segment)
        self.assertIn("setTimeout(()=>c.abort(),8000)", segment)


if __name__ == "__main__":
    unittest.main()
