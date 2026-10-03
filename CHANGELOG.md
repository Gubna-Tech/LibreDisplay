# Changelog

## LibreDisplay v1.6.0

A major internal architecture overhaul focused on long-term maintainability,
reliability, and future performance work.

This release intentionally preserves LibreDisplay's existing user experience
while replacing the monolithic frontend architecture with clear native
browser-module boundaries.

### Frontend architecture
- Reduced `app/dashboard.html` from roughly 9,000 lines to an under-900-line
  application shell (878 lines in the current v1.6.0 RC).
- Extracted dashboard presentation into `app/css/dashboard.css`.
- Split frontend behavior into native JavaScript modules for:
  - core/bootstrap
  - configuration and state
  - integrations
  - weather and alerts
  - calendar
  - backgrounds and slideshow
  - custom blocks
  - layout and Arrange
  - appearance
  - remote synchronization and connection state
  - system health, updates, profiles, and scenes
  - onboarding
  - Settings
  - application lifecycle
- Added a lightweight frontend module registry and explicit subsystem APIs.
- Added a controlled compatibility bridge so legacy global bindings can be
  retired gradually instead of through a risky all-at-once rewrite.
- Added an explicit frontend startup failure notice when required modules are
  missing after an incomplete installation/update.

### Second-stage modularization
- Continued breaking the largest first-pass frontend modules into smaller,
  responsibility-focused source files.
- Added dedicated module boundaries for shared core helpers, weather alerts,
  ICS parsing, calendar recurrence, Google Photos parsing, remote Arrange
  behavior, layout persistence, appearance presets, backup/recovery,
  profiles/scenes, Settings navigation/actions/interactions, and account
  management.
- Moved shared `uiCfg()` and `fetchRemoteText()` helpers into
  `app/js/core/shared.js` so common functionality no longer depends on
  unrelated feature-module load order.
- Updated the frontend module runtime so multiple physical source files can
  contribute safely to the same logical subsystem API.
- Expanded `module-manifest.json` to record physical source load order and
  logical ownership.
- Preloads the complete runtime + manifest module graph so the browser can fetch
  split sources in parallel while preserving deterministic evaluation order.
- Added a frontend module load-order smoke test.
- Added an architecture regression limit of 550 lines for manifest-listed
  frontend source files.
- Reduced several oversized first-pass modules substantially, including
  Settings, Calendar, Weather, Appearance, Backgrounds, System, and Layout.
- Preserved existing logical module APIs so the additional physical splitting
  does not require widespread caller rewrites.

### Clean architecture hardening
- Added ownership tracking to the frontend module runtime so two logical
  modules cannot silently publish conflicting compatibility globals.
- Added module contribution and compatibility-bridge metadata through
  `LibreDisplayRuntime.describeModules()` and `describeBridge()` for
  diagnostics and future bridge-retirement work.
- Logical module APIs now preserve live state descriptors in addition to
  callable exports, allowing feature state to migrate away from globals
  without turning it into stale snapshots.
- Compatibility publishing is now selective: modules explicitly allowlist
  which functions and state bindings still need the legacy bridge rather than
  exposing every export automatically.
- Audited every compatibility state binding and stopped publishing file-local
  implementation state that has no external consumer; 76 accidental state
  globals were removed without changing module APIs.
- Migrated split-file Layout and Settings state sharing to live logical-module
  API descriptors, eliminating another 17 legacy state globals while keeping
  the protected Arrange function bodies unchanged.
- Added API-only module mode and moved Performance, Lifecycle, shared-core
  helpers, ICS parsing, recurrence expansion, and Google Photos parsing off
  the compatibility-global bridge entirely.
- Moved generic HTML escaping, URL validation, color normalization, responsive
  clamp formatting, `uiCfg()`, and remote-text fetching into shared core
  ownership instead of borrowing those helpers from unrelated feature modules.
- Bootstrap and Configuration callable operations such as `serverPath()`,
  `saveCfg()`, and `ensureCfgDefaults()` are consumed through logical module
  APIs instead of compatibility globals. Bootstrap/session/device state is also
  consumed through live Bootstrap descriptors instead of broad window state.
- Migrated feature-runtime state for weather, calendar, backgrounds, alerts,
  integrations, remote displays, onboarding, Profiles/Scenes, Appearance, and
  System Health to live owning-module APIs.
- Replaced onboarding wizard inline state-assignment handlers with explicit DOM
  listeners that write through the Config module API.
- Normal Weather, Calendar, Backgrounds, Integrations, Remote, Onboarding,
  Settings, and System orchestration now uses explicit module APIs or lazy
  module lookups instead of broad function globals. Generated/inline UI
  handlers that genuinely require global names remain intentionally bridged.
- Compatibility state cleanup is now at its protected boundary: only nine state
  bindings remain globally bridged, covering central configuration/block state
  and the protected Layout/Arrange compatibility seam. They are intentionally
  retained rather than modifying the proven Arrange implementation merely to
  reach a zero-global metric.
- Frontend smoke validation now measures 263 compatibility globals
  (254 functions and 9 state bindings), down from 440 / 186 states at the
  start of this Phase 2 cleanup. It enforces ceilings of 270 total globals,
  260 function globals, and 10 state globals so the bridge cannot silently
  expand again.
- Audited the remaining 254 function globals: none is an obvious low-reference
  dead export. They primarily serve generated/inline UI handlers and legacy
  cross-module call sites, so further removal will be handled deliberately
  rather than through risky bulk deletion before release.
- Settings invokes Weather, Calendar, Backgrounds, Appearance, and Performance
  through explicit module APIs for its apply/refresh orchestration.
- Added `app/js/core/performance.js` as the shared owner for periodic-task
  scheduling, overlap prevention, capability detection, idle work, and
  frontend performance diagnostics.
- Weather, calendar, alert, remote-config, and display-heartbeat refresh loops
  now use managed non-overlapping scheduling instead of independent raw
  intervals.
- Managed data refreshes pause while the document is hidden and refresh when
  it becomes visible again; the kiosk heartbeat intentionally continues while
  hidden so watchdog behavior is preserved.

### Raspberry Pi 3 readiness
- Raspberry Pi 4 remains the primary performance baseline while Raspberry Pi 3
  is an explicit v1.6.0 support target.
- Added a conservative browser capability tier that activates only when the
  browser reports both a low memory budget and four-or-fewer CPU cores.
- `motionPreference: auto` now selects the existing reduced-motion path on a
  constrained device; choosing `Full` motion still explicitly overrides it.
- JavaScript-driven weather-alert and calendar auto-scrolling now honor the
  reduced-motion path instead of continuing expensive background animation.
- Backdrop-filter blur is disabled automatically on constrained devices to
  reduce GPU/compositor cost on constrained hardware while retaining the standard path on devices with more headroom.
- Optimized the dashboard clock so minute/date DOM work is only performed when
  values change; when seconds are hidden, the clock wakes once per minute
  instead of once per second.
- System Health now exposes hardware model, CPU count, available/total memory,
  and thermal temperature when the host provides them.
- Downloaded diagnostics now include host hardware information and frontend
  performance snapshots, including the current page plus the local kiosk when
  its heartbeat is available.
- Local kiosk heartbeats now carry a bounded privacy-safe browser-performance
  snapshot: capability tier, page uptime, managed-job counts, long-task
  timing, and Chromium JS-heap totals when exposed by the browser.
- Added `libredisplay field-check`, a native Pi 3/Pi 4 soak collector that
  writes JSON and Markdown reports for host load, temperature, memory,
  storage, heartbeat freshness, browser restarts, long tasks, and heap usage
  without copying private feed URLs, coordinates, credentials, or history.
- System Health now shows the latest local kiosk-browser performance summary
  so constrained-device behavior can be checked without downloading a report.
- Pi 3 remains a release-candidate field gate until a real Pi 3 display soak
  confirms startup, background rotation, weather/calendar refresh, alerts,
  remote management, Arrange, Settings, and update/rollback behavior.

### Arrange safety
- Preserved the proven Arrange editor implementation during the refactor.
- All 10 protected Arrange functions remain exact source-hash matches to
  v1.5.8.
- Added permanent regression coverage for the protected Arrange engine.
- Kept protected Arrange functions in their canonical implementation module
  while moving surrounding remote and persistence responsibilities into
  dedicated modules.

### Installation and update hardening
- Native installation now deploys the complete modular `app/` tree.
- Update validation requires the modular JavaScript and CSS frontend assets.
- Browser update flow verifies required modular assets before installation.
- Docker now copies the complete application tree.
- Rollback continues to snapshot the entire `app/` tree recursively.
- Installer/update paths normalize JavaScript and CSS permissions.
- CI validates every JavaScript module individually.
- CI validates frontend module load order.
- Added a reusable frontend-manifest verifier shared by installer, updater, and
  CI so incomplete modular release trees are rejected before installation.

### Static frontend serving
- Native server now serves path-confined `.js` and `.css` assets from the
  application directories.
- Added traversal protection regression coverage for frontend asset routes.

### Future performance work
- The subsystem boundaries and managed scheduler prepare LibreDisplay for
  deeper profiling and optimization on Raspberry Pi 3 without another
  monolithic rewrite.
- Later profiling can independently lazy-load, pause, defer, or optimize
  backgrounds, integrations, Settings, weather, calendar, remote sync, and
  layout work using measured Pi 3 data.

### Pre-publication deep audit
- Audited the complete public tree for runtime defects, stale assumptions, sensitive output, and unintended development artifacts.
- Fixed a custom-block slideshow timer leak that could retain detached photo block elements after block re-renders.
- Moved custom-block countdown, schedule, family, air-quality, RSS, JSON, integration, and photo rotation timers onto the shared managed scheduler so periodic work cannot overlap and pauses safely while the page is hidden.
- Custom-block periodic jobs now appear in the same managed-job diagnostics used by Pi 3 / Pi 4 field-readiness reports.
- Removed a console warning that could print a configured remote background URL.
- Clarified capability-based low-power behavior so lower-memory Pi 4 systems are documented accurately alongside Pi 3.
- Corrected backup validation wording to describe the checksum manifest accurately.
- Added deterministic public-release packaging rules that exclude runtime caches, temporary/backup files, working notes, and runtime data.
- Synchronized frontend manifest metadata and release regression contracts with the current staged updater, configuration persistence, and modular Settings flows.

### Validation
- 208 automated unit/security/architecture regression tests pass from source.
- 208 automated unit/security/architecture regression tests pass again from a
  fresh release extraction.
- All 31 frontend JavaScript source files pass syntax validation.
- The 29-source frontend manifest verifies 16 logical modules and enforces the
  550-line per-source architecture limit.
- Frontend module load-order smoke testing passes.
- Python source/CLI parsing/compilation passes for all 53 Python entries.
- Shell syntax passes for all 10 `.sh` scripts plus the extensionless privileged helper.
- All 32 referenced frontend assets are served successfully through the native
  LibreDisplay server.
- All 10 protected Arrange functions remain source-hash identical.
- Release archives are checked for CRC/decompression, source-byte fidelity,
  executable permission preservation, symlinks, world-writable files, cache
  files, and bytecode.

### Release candidate note
v1.6.0 should remain an RC until it completes real Pi 3 and Pi 4 display soak
testing, including remote access, background rotation, integrations, Arrange,
Settings, profiles/scenes, update/rollback workflows, and extended browser
runtime testing.
