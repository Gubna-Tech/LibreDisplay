# LibreDisplay

**Your home. Your dashboard. Your data.**  
A free, open-source home dashboard for Raspberry Pi, Docker, NAS, mini PCs, and browsers.

LibreDisplay brings calendars, weather, photos, family chores, tasks, media, charts, alerts, and custom data together on one clean display. It is designed to stay simple for everyday use while keeping advanced controls out of the way until you need them.

<p align="center">
  <img src="assets/libredisplay-promo.png" alt="LibreDisplay self-hosted dashboard with calendar, weather, alerts, photo background, remote Settings, and Raspberry Pi hardware" width="720">
</p>

## Quick start — Raspberry Pi

**Best choice for a dedicated wall display.** LibreDisplay v1.6.0 targets Raspberry Pi 3 and Raspberry Pi 4 with a current Raspberry Pi OS **with Desktop**. Pi 4 remains the primary performance baseline. LibreDisplay also includes a conservative capability-based low-power path for constrained devices, including Pi 3 and lower-memory Pi 4 configurations.

Open **Terminal**, then run these commands **one at a time, in order**. You can copy and paste each box separately.

**1. Update Raspberry Pi OS package information:**

```bash
sudo apt update
```

**2. Install the small tools needed for setup:**

```bash
sudo apt install -y curl unzip
```

**3. Create a clean LibreDisplay setup folder:**

```bash
rm -rf ~/LibreDisplay-Setup && mkdir -p ~/LibreDisplay-Setup
```

**4. Download the latest LibreDisplay release:**

```bash
curl -fL https://github.com/Gubna-Tech/LibreDisplay/archive/refs/tags/v1.6.0.zip -o /tmp/LibreDisplay.zip
```

**5. Extract LibreDisplay:**

```bash
unzip -q /tmp/LibreDisplay.zip -d ~/LibreDisplay-Setup
```

**6. Open the LibreDisplay setup folder:**

```bash
cd ~/LibreDisplay-Setup/LibreDisplay-1.6.0
```

**7. Allow the installer to run:**

```bash
chmod +x install.sh
```

**8. Start the installer:**

```bash
./install.sh
```

That is it. Reboot when prompted and LibreDisplay will open automatically.

> Raspberry Pi OS Lite is not supported by the native kiosk installer. Use Raspberry Pi OS with Desktop, or run LibreDisplay with Docker instead.

## First setup

A new installation opens LibreDisplay's guided setup automatically. The wizard uses the same real Settings controls as the full configuration screen, so there is no separate hidden setup format to keep in sync.

The guided flow walks through:

1. **Display name** — give the screen a clear room/purpose name for multi-display management.
2. **Weather location** — search and choose the exact city/region/country result, including verified coordinates and timezone.
3. **Calendars** — add ICS feeds or import local `.ics` files, or skip calendars entirely.
4. **Background** — choose stock images, Google Photos, local/NAS folders, or no photo background.
5. **Weather alerts and appearance** — choose the essentials without entering the power-user layout controls.
6. **Remote management** — optionally enable pairing on a trusted LAN/private VPN.
7. **Recovery** — optionally create an **Initial setup baseline** restore point immediately after the configuration is saved.
8. **Review & health check** — save once, then verify server persistence, weather, calendars, background readiness, remote access, recovery, host health, and software status.

Experienced users can choose **Open full settings** at any point and configure LibreDisplay directly. The wizard can also be rerun later from **Settings > Home > Run setup wizard**.

Settings open in the simpler **Essentials** view by default. Switch to **All** only when you want advanced and troubleshooting options.

## Everyday use

LibreDisplay is designed to run quietly in the background. Once configured, your display updates itself and the Settings button stays out of the way.

Useful places to remember:

- **Weather** — location, forecasts, details, and severe-weather alerts
- **Calendars** — calendar feeds, imported ICS files, and event display rules
- **Backgrounds** — photo sources, local/NAS folders, slideshow behavior, and seamless next-photo preloading
- **Family** — household members, chores, points, and rewards
- **Personalization** — themes, templates, typography, and accessibility
- **Layout** — visual layout presets with schematic previews, full-screen live preview, dashboard visibility, geometry, and the Arrange editor
- **Arrange editor** — move/resize blocks, drag the inspector out of the way, and fine-tune individual text sections such as calendar event titles/times without changing day/date headers. When editing remotely, Arrange waits for a fresh wall-display heartbeat and mirrors the Pi’s actual dashboard viewport. The target canvas is scaled independently while the editor toolbar and inspector stay at normal laptop size, so editing controls remain readable and selectable without changing the dashboard geometry.
- **Integrations** — connect supported services and check their status
- **System** — host health, software updates, displays, display profiles, accounts, backups, diagnostics, remote access, and advanced options

Small **?** buttons beside less-obvious controls provide quick hover/click help without filling the interface with extra instructions.

Remote browsers treat the Pi's saved display configuration as authoritative whenever the server is reachable. Browser-local state is only a recovery fallback, so a phone/laptop view cannot silently outrank the wall display with an older local copy of the background, layout, or other settings.

Photo slideshows use a double-buffered background renderer. With **Preload the next photo** enabled (the default), LibreDisplay loads and decodes the exact upcoming Google Photos or local/NAS image in a hidden layer before the rotation is due. The current photo remains fully visible until the replacement is ready, then the new image fades over it. Slow storage or network-backed photos therefore delay the transition instead of exposing a blank/black frame. Stock-photo changes use the same hold-current-until-ready transition once the next stock image URL is returned.


### Display profiles and templates

Open **Settings > System > Display profiles** to save a known-good dashboard as a named profile, duplicate it before experimenting, capture another configured display as a profile, or explicitly apply a profile to a selected display. Profile application is per-display and never edits the saved profile itself. Scenes & schedules can continue using those profiles for time-based switching.

Layout presets are shown as visual cards so you can see the intended arrangement before trying it. The expanded layout library includes original family-command, split photo/planner, gallery-first, calendar-wall, planner-rail, weather-center, across-the-room, compact-tablet, minimal-photo, and portrait compositions, plus showcase screens for **Morning Briefing**, **Smart Home Hub**, **Family Operations**, **Team Board**, **Markets & Conditions**, and **Travel Day**. These showcase layouts demonstrate how LibreDisplay can combine configured integrations such as Home Assistant, Spotify/Sonos, task services, Slack, RSS, package tracking, market data, transit/travel data, and maps. Compatible blocks you already configured can snap into the labeled showcase slots during preview and when you apply that showcase layout; empty slots are visual suggestions only and are never saved as fake data. Credentials and provider configuration are never replaced. Each preset carries a tuned content-density profile—calendar range and columns, forecast range, typography, spacing, alignment, and responsive content fitting—so complete calendar and forecast content remains visible instead of squeezing or clipping inside smaller blocks. Selecting a preset stages only the LibreDisplay presentation; choose **Preview selected layout** to inspect it full-screen with your real dashboard content. The saved display is untouched until **Save & Apply**. Applying a preset replaces prior built-in Arrange positions/alignment and the preset-controlled density values, while accounts, data sources, integrations, theme, background, and unmatched custom blocks remain intact. **Cancel/Esc restores the exact saved layout.** Starter templates use the same preview pipeline while also staging their documented presentation settings; Weather Details selection/order and data-source/account configuration remain preserved.

## Updating LibreDisplay

Native Raspberry Pi installations check the official GitHub releases automatically whenever **Settings** opens and every 15 minutes while Settings remains open. **Settings > System > Software update** still includes **Check now** for an immediate manual refresh. When a newer release is available, owners see an update notice and can choose **Update now**. LibreDisplay creates a safety backup, downloads the official release, keeps your settings, media, and custom plugins, installs the update, and restarts the device.

The terminal updater remains available as a recovery/advanced path:

```bash
libredisplay check
```

```bash
libredisplay update
```

The first upgrade from a pre-v1.5.0 release may ask for `sudo` in Terminal once so LibreDisplay can install its narrowly scoped update helper. After that, supported native installations can install future releases from Settings without entering a terminal command. Automatic unattended updates are not enabled; installing an update always requires an explicit owner action.

Docker installations still update from the Docker host with `./scripts/docker-setup.sh update`; LibreDisplay shows available releases in Settings but does not attempt to rebuild its own host container.

### Update history and version rollback

Supported native updates now create a private **pre-update rollback snapshot** before replacing application files. Open **Settings > System > Update history & rollback** to see the previous release snapshots retained on the Pi. LibreDisplay keeps the newest five automatically.

A version rollback is intentionally stronger than a normal Settings restore point: it verifies the stored snapshot, first creates a fresh recovery snapshot of the current installation, then restores the previous LibreDisplay application together with the settings, media, plugins, and project `.env` captured immediately before that update. The device restarts afterward. This makes a bad release recoverable without requiring a terminal while still keeping the state you are rolling back from recoverable.

Rollback snapshots are private local maintenance data and are not exposed to display/viewer sessions. Docker rollback remains host-managed because a container should not replace its own host deployment.

## System health and diagnostics

Open **Settings > System > Data sources & providers** for one privacy-safe troubleshooting view of weather, calendar feeds, background sources, weather alerts, integrations, and remote-data cache fallback. LibreDisplay distinguishes healthy, delayed/cached, misconfigured, and failed sources without displaying private URLs, tokens, or coordinates.

Open **Settings > System > System health** to see the deployment type, host uptime, free storage, data-directory write status, platform, load average, host hardware, and the latest privacy-safe kiosk-browser performance snapshot. The Home page also keeps a compact health summary for weather, calendars, backgrounds, alerts, integrations, offline cache, and software updates.

For support or troubleshooting, choose **Download diagnostics**. The generated JSON intentionally omits private calendar/background URLs, integration credentials, and weather coordinates, while keeping useful version, provider state, refresh timing, cache state, layout, recovery, and host-health information.

### Display readiness and kiosk resilience

Open **Settings > System > Display readiness & kiosk resilience** to check the target screen without changing its layout. LibreDisplay reports the currently observed viewport, portrait/landscape orientation, browser visual scale/device-pixel ratio, and the most recent local kiosk heartbeat. It warns when a viewport is unusually small or browser scaling is not at 100%, which helps separate display/zoom problems from saved Arrange geometry.

Native kiosk installations now have two local watchdogs in `scripts/start.sh`: the server is restarted after repeated `/healthz` failures, and Chromium is restarted when the local dashboard heartbeat stops advancing while the browser process is still alive. The browser heartbeat contains only privacy-safe local endpoint/version/viewport timing plus bounded frontend performance counters (capability tier, page uptime, managed-job counts, long-task timing, and Chromium JS-heap totals when available). It does not include feed URLs, coordinates, credentials, account data, or browsing history. The screen-side page also tracks EventSource/network state, continues showing last-known cached provider data while disconnected, and automatically refreshes saved configuration/data when the LibreDisplay server reconnects. Brief EventSource handoffs and momentary Wi-Fi/LAN jitter are handled silently with a reconnect grace period, so the display does not flash a connection warning for self-healing sub-eight-second interruptions; persistent losses still surface a calm status while automatic retry continues. Screen-only Viewer installs keep Chromium background timers/rendering enabled so long-running weather/calendar refreshes are not throttled simply because the window is kiosked.

Under **Settings > Personalization > Accessibility & language**, optional **Always-on display care** can dim the entire rendered screen after 15, 30, 60, or 120 minutes without local interaction. Any pointer, touch, wheel, or keyboard interaction wakes it immediately. This uses a non-interactive overlay only: it does not move, resize, or rewrite any saved Arrange element. Screen care is off by default.

### Pi 3 / Pi 4 field-readiness soak

For v1.6.0 release qualification, native installs include a privacy-safe soak collector. Keep the wall-display kiosk open and run:

```bash
libredisplay field-check --duration-minutes 120 --label pi3-living-room
```

Repeat on a Pi 4 with a different label for the regression baseline. The command samples every 15 seconds by default and writes both JSON and Markdown reports under `~/libredisplay/data/`. It records host load, temperature, available memory, storage, kiosk-heartbeat freshness, browser capability tier, page uptime/reload indications, long-task timing, managed refresh-job counts, and Chromium JS heap when the browser exposes it. It deliberately does **not** copy private calendar/background URLs, weather coordinates, integration credentials, account secrets, or browser history.

Use `libredisplay field-check --once` for a quick instrumentation check, or change `--interval-seconds` and `--output` for a longer controlled run. A soak report supports release review rather than acting as an automatic performance verdict; compare Pi 3 observations with the Pi 4 baseline and investigate any temperature, heartbeat, restart, memory, or long-task outliers before publishing.

### Portable backups and restore points

Open **Settings > System > Backup & recovery** for day-to-day migration and rollback tools:

- **Export portable backup** downloads this display's saved configuration, the server's Profiles, and only this display's Scene rules as JSON. It is intended for moving a setup between LibreDisplay installations without copying media, account passwords, pairing secrets, or host/NAS credentials.
- **Import portable backup** creates a local safety restore point first, then imports the saved display configuration, merges the bundled Profiles, and replaces only the current display's Scene rules while leaving other displays' Scene rules intact.
- **Local restore points** keep up to 20 private snapshots on the LibreDisplay host so you can return to a known-good configuration after experimentation. They include the current display configuration plus the server-wide Profiles and Scenes stores; restoring one can therefore affect scheduled profiles used by other displays. Restoring a point automatically creates a new **Before restore** point first.

Portable JSON may still contain private calendar URLs or integration credentials from the display configuration, so store it securely. For a complete machine/server backup including media, plugins, `.env`, pairing/account data, or managed NAS host state, keep using the full `.ldbackup` tools documented below.

## Docker

Docker is a good choice when LibreDisplay runs from a NAS, mini PC, or home server and your screens connect through a browser.

From the extracted LibreDisplay folder, run these commands **one at a time, in order**.

**1. Allow the Docker setup helper to run:**

```bash
chmod +x scripts/docker-setup.sh
```

**2. Start LibreDisplay for your home network:**

```bash
./scripts/docker-setup.sh --lan
```

Then open the address shown by the script on a trusted device on your home network.

### Updating a Docker installation

From the existing LibreDisplay Docker folder, run:

```bash
./scripts/docker-setup.sh update
```

The Docker updater checks the latest GitHub release, stops LibreDisplay before taking a safety backup, preserves `data`, `media`, `.env`, and custom plugin folders, replaces only release-managed source files, rebuilds the container, and waits for its health check. If the new deployment cannot start cleanly, the previous source is restored automatically. Safety backups are kept under `./backups`.

Docker self-update starts with v1.2.0. Docker installations older than v1.2.0 need one manual move to the v1.2.0 release files before this command is available; updates after that use the command above.

To make a Docker backup without updating, run:

```bash
./scripts/docker-setup.sh backup
```

Rerunning `./scripts/docker-setup.sh start` keeps existing Docker UID/GID and advanced `.env` values instead of resetting them.

### Add a screen-only Raspberry Pi to a Docker server

**1. On the LibreDisplay server, show the available Display Links:**

```bash
./scripts/docker-setup.sh links
```

Copy the Display Link for the screen you want to use.

On the viewer Raspberry Pi, run the next commands **one at a time, in order**.

**2. Download the viewer setup helper:**

```bash
curl -fL https://raw.githubusercontent.com/Gubna-Tech/LibreDisplay/v1.6.0/scripts/viewer-setup.sh -o /tmp/libredisplay-viewer-setup.sh
```

**3. Allow the viewer installer to run:**

```bash
chmod +x /tmp/libredisplay-viewer-setup.sh
```

**4. Install the Display Link:**

```bash
/tmp/libredisplay-viewer-setup.sh install 'PASTE_DISPLAY_LINK_HERE'
```

<details>
<summary><strong>What LibreDisplay includes</strong></summary>

- Calendars and imported ICS files
- Weather, alerts, UV, pollen, tides, and personal weather stations
- Local folders, NAS photos, OneDrive, Dropbox, Box, Flickr, and public iCloud Shared Albums
- Todoist, Google Tasks, Microsoft To Do, CalDAV/Nextcloud Tasks, Trello, and Asana
- Family/touch mode with recurring chores, points, rewards, and optional PIN protection
- YouTube, Vimeo, Spotify now-playing, and Sonos now-playing
- Stocks, crypto, currency, traffic/travel time, transit, maps, package tracking, and flight status
- Fitbit activity and Slack messages
- Value cards, gauges, progress bars, sparklines, line charts, bar charts, and tables
- Multiple displays from one server
- Owner, Editor, and Viewer roles with optional display restrictions
- Full backup/restore
- Local folders and read-only NAS storage
- Raspberry Pi kiosk mode and Docker deployment

</details>

<details>
<summary><strong>Calendars, photos, and multiple displays</strong></summary>

### Calendars

Go to **Settings > Calendars > Calendars > Add calendar**.

LibreDisplay accepts normal ICS/iCalendar subscription links, including links from Google Calendar, Proton Calendar, Outlook/Microsoft 365, iCloud shared calendars, Nextcloud, Fastmail, and other compatible providers. `webcal://` links work too.

You can also import a local `.ics` file.

### Photos and NAS folders

For another local photo folder:

```bash
~/libredisplay/scripts/setup-media.sh
```

For an SMB/CIFS or NFS share:

```bash
~/libredisplay/scripts/setup-nas.sh
```

Then choose the folder under **Settings > Backgrounds > Pictures & Backgrounds**.

### Multiple displays

Go to **Settings > Home > Displays > Add display**.

Each display can have its own calendars, weather, photos, theme, layout, and read-only Display Link. One LibreDisplay server can therefore run a kitchen screen, office screen, bedroom screen, and more without separate server installations.

</details>

<details>
<summary><strong>Integrations</strong></summary>

Open **Settings > Integrations** to browse the integrations installed with LibreDisplay. Configured blocks show live connection health, refresh interval, last successful refresh, last connection check, cached/stale state, and a privacy-safe error category when something fails. **Test connection** forces a live provider request while preserving the last known good cache if the provider is temporarily offline. **Test all configured** checks multiple providers with limited concurrency so troubleshooting does not flood external services. Saved credentials are never rendered in the health payload.

Included integrations cover:

- Home Assistant
- Todoist
- CalDAV / Nextcloud Tasks
- Google Tasks
- Microsoft To Do
- Trello
- Asana
- Sonos
- Spotify
- OneDrive Photos
- Dropbox Photos
- Box Photos
- Flickr Photos
- iCloud Shared Albums
- Alpha Vantage stocks
- CoinGecko crypto
- Frankfurter currency
- Mapbox travel time
- OpenStreetMap
- GTFS-Realtime transit
- AfterShip package tracking
- aviationstack flight status
- Google Pollen
- Open-Meteo UV
- NOAA tides
- Weather Company personal weather stations
- Fitbit
- Slack
- Generic Web API data

Some providers require your own API key or OAuth credentials. LibreDisplay stores provider credentials on the server and strips them from read-only display responses.

</details>

<details>
<summary><strong>Backup and restore</strong></summary>

For normal configuration migration or a quick **settings** rollback, use **Settings > System > Backup & recovery** first. Portable backups move one display's configuration plus Profiles and Scenes, while local restore points provide fast on-device configuration rollback without touching media or host secrets. To return the entire native installation to a previous LibreDisplay release after an update, use **Settings > System > Update history & rollback** instead.

For a full native Raspberry Pi installation backup, create a sensitive `.ldbackup` with:

```bash
~/libredisplay/scripts/backup.sh
```

Native backups are stored under `~/libredisplay-backups/` by default. For a Docker installation, use:

```bash
./scripts/docker-setup.sh backup
```

Docker backups are stored under `./backups` in the LibreDisplay Docker folder.

For a native Raspberry Pi installation, restore one with:

```bash
~/libredisplay/scripts/restore.sh ~/libredisplay-backups/YOUR-BACKUP.ldbackup
```

A full backup can contain passwords, API tokens, display links, settings, media, and plugins. Keep it private.

If you use LibreDisplay-managed NAS mounts and want their host settings included too:

```bash
sudo ~/libredisplay/scripts/backup.sh --include-host
```

</details>

<details>
<summary><strong>Remote access, accounts, and privacy</strong></summary>

LibreDisplay is designed for a trusted home network or private VPN. Native Raspberry Pi remote editing is off by default.

Available local roles:

- **Owner** — full administration
- **Editor** — can edit assigned displays
- **Viewer** — can view assigned displays only

The physical local display remains Owner access. Each display also has a dedicated read-only Display Link.

Read-only Display Links cannot perform write actions against external task integrations. Changing a local account's role, assigned displays, enabled state, or password invalidates that account's existing remote sessions so the new permissions take effect immediately.

Do **not** port-forward LibreDisplay directly to the public Internet. Use a private VPN such as WireGuard or Tailscale if you need remote access.

The built-in LibreDisplay server does not terminate TLS. When signing in or editing from another device, keep the traffic on a trusted home network or, preferably for access away from home, inside a private VPN tunnel.

LibreDisplay does not require a LibreDisplay cloud account and does not include telemetry. External integrations only contact the services you choose to configure.

Custom plugins are trusted local code and execute with the LibreDisplay service account. Install only plugins whose source you trust. Full `.ldbackup` archives are intentionally portable rather than encrypted, and their embedded checksum manifest detects accidental corruption rather than proving who created the archive. Keep them private and restore only backups you created or otherwise trust.

The native and Docker update helpers prefer the exact `LibreDisplay-vX.Y.Z.zip` GitHub release asset when GitHub supplies SHA-256 metadata, and verify both its recorded size and digest before extraction. If that metadata is unavailable, LibreDisplay falls back to GitHub's HTTPS tag archive and still applies its path, symlink, size, version, and required-file validation before installation.

If you discover a security issue, please report it privately to the project owner rather than posting exploit details publicly.

</details>

<details>
<summary><strong>Troubleshooting</strong></summary>

Start LibreDisplay manually:

```bash
~/libredisplay/scripts/start.sh
```

Check that the local server is running:

```bash
curl http://127.0.0.1:8787/healthz
```

If a remote display does not connect, make sure both devices are on the same trusted network and that remote access is enabled when required.

</details>

<details>
<summary><strong>Uninstall LibreDisplay</strong></summary>

Remove LibreDisplay while preserving a copy of dashboard data and local project media:

```bash
~/libredisplay/uninstall.sh
```

Completely erase LibreDisplay-managed application data and backups:

**1. Run the purge uninstall:**

```bash
~/libredisplay/uninstall.sh --purge
```

**2. After the uninstall finishes, reboot:**

```bash
sudo reboot
```

Photos stored outside LibreDisplay or on a NAS are not intentionally deleted.

</details>

## Frontend architecture

LibreDisplay **v1.6.0** continues the native ES-module refactor by splitting the first-round feature modules into smaller responsibility-focused source files while keeping the dashboard self-contained and build-tool-light. No Node.js, bundler, or frontend package manager is required on the Pi.

- `app/dashboard.html` is the HTML shell.
- `app/css/dashboard.css` owns the dashboard and Settings presentation.
- `app/js/core/` owns bootstrap, configuration, the shared `uiCfg()` / remote-text helpers, the module runtime, and the low-power scheduling/performance layer.
- `app/js/integrations/` owns integration discovery and health/configuration UI.
- `app/js/weather/` separates forecast/details from alert runtime; `calendar/` separates ICS parsing, recurrence expansion, and rendering; `backgrounds/` separates Google Photos parsing from rotation/source control.
- `app/js/blocks/` owns custom and integration block rendering.
- `app/js/layout/` keeps the protected Arrange core in `index.js` and separates remote-preview and persistence commands.
- `app/js/appearance/` separates core presentation controls, layout presets, and backup/recovery workflows.
- `app/js/remote/` owns server sync, connection state, display heartbeat, and remote display state.
- `app/js/system/` separates health/update/diagnostics from Profiles and scheduled Scenes.
- `app/js/onboarding/` owns setup; `settings/` separates the shell/apply flow, navigation/search, quick actions, interaction helpers, and local-account administration.
- `app/js/lifecycle/` is the startup/recovery orchestrator and calls subsystems through the module registry.

The v1.6.0 second-stage refactor keeps logical module APIs stable while allowing several smaller source files to contribute to one module. `app/js/module-manifest.json` records the physical load order and ownership of those source pieces, and the full graph is module-preloaded so split files can fetch in parallel while still evaluating deterministically. Installer, updater, and CI all run the same manifest verifier before accepting the frontend tree. Generic helpers such as `uiCfg()`, remote-text fetching, HTML escaping, URL validation, color normalization, and responsive clamp formatting now have a real shared-core owner instead of being borrowed from unrelated feature modules. Parser/helper modules for ICS, recurrence, and Google Photos are API-only, and bootstrap/config callable operations plus Bootstrap/session/device state are consumed through explicit live module APIs rather than broad compatibility globals. Weather, Calendar, Backgrounds, Alerts, Integrations, Remote, Onboarding, Profiles/Scenes, Appearance, Settings, and System Health state has been migrated substantially to its owning module API. Only nine compatibility state globals remain, intentionally covering central configuration/block state and the protected Layout/Arrange compatibility seam. The module smoke currently measures 263 compatibility globals (254 functions and 9 state bindings), down from 440 / 186 states at the start of Phase 2, and enforces ceilings of 270 total globals, 260 function globals, and 10 state globals so that surface cannot silently grow again. The remaining function bridge primarily supports generated/inline UI handlers and established cross-module call sites and will be reduced deliberately rather than through a risky pre-release bulk rewrite.

Raspberry Pi 3 is an explicit v1.6.0 support target. The frontend uses managed non-overlapping refresh jobs, an adaptive clock, and a capability-based constrained-device path that reduces JavaScript motion and compositor blur on lower-resource hardware while preserving the standard path on devices with more headroom. Settings > System reports host model, CPU count, memory, and temperature so Pi 3 soak results can be measured. Deeper Pi 3 profiling and optimization remain the next performance phase after the architecture is field-proven.

## Changelog

Release history and the current v1.6.0 release-candidate notes are maintained in [`CHANGELOG.md`](CHANGELOG.md).

## Open source

LibreDisplay is released under the **[MIT License](LICENSE)**.

Copyright (c) 2026 Gubna.
