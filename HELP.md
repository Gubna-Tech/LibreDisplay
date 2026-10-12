# LibreDisplay Help & Setup Guide

This is the practical handbook for installing, configuring, operating, troubleshooting, and recovering LibreDisplay. It is intentionally detailed, but it is organized so you only need to open the part you are working on. The README stays short; this guide holds the deeper explanations and recovery material.

> **Security boundary:** LibreDisplay is designed for a trusted home LAN or private VPN. Do not expose the built-in server directly to the public Internet.

## Start here

You do not need to read this guide from top to bottom. Pick the task you are trying to complete, then open the matching section below.

| If you want to... | Open this section |
| --- | --- |
| Install LibreDisplay or complete first-time setup | **1. Getting started and Raspberry Pi host modes** |
| Run a Pi without a local webpage | **1. Getting started and Raspberry Pi host modes** or use the SSH commands below |
| Add an Owner device or understand Remote Access | **2. Remote Access and multiple displays** |
| Understand a Settings page or dashboard layout control | **3. Settings and layout reference** |
| Administer LibreDisplay over SSH | **4. Terminal and SSH reference** |
| Back up, update, restore, or recover an installation | **5. Maintenance, updates, and recovery** |
| Tune Raspberry Pi performance or protect an OLED display | **6. Performance, display care, and server deployments** |
| Diagnose something that is not working | **7. Troubleshooting** |
| Learn operating practices, privacy details, or quick recovery commands | **8. Tips, privacy, and quick recovery** |

### Server-only mode over SSH

These commands are supported on native Raspberry Pi installations and are safe to run from an SSH session:

```bash
libredisplay server-only status
libredisplay server-only on
libredisplay server-only off
```

For people who prefer explicit words, v1.12.3 also accepts:

```bash
libredisplay server-only enable
libredisplay server-only disable
```

`on` and `enable` mean the same thing: keep the LibreDisplay server running but stop/do not launch the local Chromium dashboard. `off` and `disable` return the Pi to **Display + server** mode.

If the LibreDisplay server is temporarily offline, the CLI still saves the requested Server-only state directly so it can take effect on the next start. An environment-level `DASHBOARD_NO_BROWSER=1` override is stronger than the saved preference and must be removed before a local browser can be started.

### Most useful SSH commands

```bash
libredisplay status
libredisplay addresses
libredisplay connect
libredisplay remote status
libredisplay server-only status
libredisplay doctor
libredisplay logs
libredisplay backup
libredisplay check
```

Run `libredisplay --help` for the complete command list or `libredisplay <command> --help` for one command.

## How to use this guide

The eight major sections below are collapsed by default to keep this file approachable. Open only the section you need. Inside each section, normal headings break the subject into smaller tasks and explanations. No operational detail from the previous guide has been removed; the material has been regrouped around the way people actually use LibreDisplay.

For a problem you cannot immediately place, start with **7. Troubleshooting**. For an SSH-only recovery, start with **4. Terminal and SSH reference**, then use **5. Maintenance, updates, and recovery** if needed.

## Guide sections

<details>
<summary><strong>1. Getting started and Raspberry Pi host modes</strong><br>Architecture, installation, first-time setup, Display + server mode, and Server-only mode.</summary>

## How LibreDisplay is structured

LibreDisplay has two distinct jobs:

1. **The server** stores configuration, serves the dashboard, talks to integrations/providers, manages accounts and display endpoints, handles backups/updates, and coordinates remote access.
2. **The display browser** renders a dashboard in Chromium or another modern browser.

A normal Raspberry Pi installation can do both jobs on the same device. A Pi in **Server-only mode** does only the first job. Other Pis, tablets, TVs, mini PCs, or browsers can then handle the display role.

### Important terms

**Display endpoint**  
A named LibreDisplay dashboard such as `main`, `kitchen`, or `office`. Each endpoint can keep its own settings and layout.

**Owner device**  
A trusted browser authorized to administer LibreDisplay. Owner devices are enrolled with a short-lived one-time code or QR and can later be renamed or revoked.

**Display Link**  
A read-only credential for one display endpoint. It is intended for wall screens or viewers that should never change Settings.

**Owner / Editor / Viewer account**  
Optional named accounts for repeat sign-in. Owners can administer the whole server; Editors are limited to assigned displays; Viewers are read-only.

**Local display**  
The Chromium browser launched by LibreDisplay on a native Raspberry Pi wall-display installation.

---

## Installation

### Raspberry Pi native installation

Use a current Raspberry Pi OS **with Desktop**. LibreDisplay's native installer expects the Pi desktop/browser stack even if you later switch that Pi to Server-only mode.

Run the command shown in the README from Terminal. The installer places LibreDisplay at:

```text
~/libredisplay
```

and installs the main CLI as:

```text
/usr/local/bin/libredisplay
```

After the installer finishes, reboot when prompted. LibreDisplay starts automatically with the desktop session.

### Why Pi OS Lite is not the native installer target

The native path includes kiosk/window management, display diagnostics, graphics recovery, and a browser watchdog. Those features rely on the desktop environment. If the Pi is intended only as a server, you can still install on Pi OS Desktop and then enable **Server-only mode** so Chromium no longer opens.

For a completely browserless server operating system, use a Docker/server deployment instead of the native kiosk installer.

### Existing installations

Do not run the first-install bootstrap over an existing `~/libredisplay` directory. Use:

```bash
libredisplay check
libredisplay update
```

Supported updates preserve LibreDisplay data and create recovery material before application files are replaced.

---

## First-time setup

The first-run wizard uses the same real settings that the full Settings panel uses; there is no hidden second configuration system.

### 1. Display name

Choose a name that describes the physical screen or purpose, for example:

- Living Room
- Kitchen
- Office
- Family Board
- Weather Display

This is a friendly label. The internal endpoint ID remains stable.

### 2. Weather location

Search for the exact place and select the correct city/region/country match. LibreDisplay stores coordinates and timezone information so duplicate city names are not confused.

The optional display label is cosmetic and does not change the forecast coordinates.

### 3. Calendars

Add ICS/iCalendar feeds you actually use. You can skip calendars during setup and add them later.

Use feed checking before assuming a missing event is a layout problem. Calendar sources can fail because of authentication changes, provider outages, invalid subscription URLs, or timezone mismatches.

### 4. Background

Choose one of the supported background types:

- stock images
- supported photo sources
- local folders
- NAS folders
- no photo background

For local/NAS media, see the helper scripts later in this guide.

### 5. Visual performance

The wizard provides performance presets. Start conservatively on a Pi 3 or heavily customized dashboard. It is easier to enable richer effects later than to diagnose an overloaded unattended display.

### 6. Alerts and appearance

Choose severe-weather alert behavior, theme, font, and other presentation basics. Everything remains editable later.

### 7. Remote Access

Remote Access is optional but strongly recommended if this Pi will be Server-only. Keep it restricted to a trusted LAN or private VPN.

### 8. Pi host mode

Choose:

**Display + server**  
The Pi runs LibreDisplay and launches the local Chromium dashboard.

**Server only**  
The Pi keeps LibreDisplay's server running but intentionally does not open a local webpage. Other devices connect to the Pi instead.

The host mode is operational state, not part of an individual display profile. Changing display layouts or loading Profiles does not silently change the Pi's host mode.

### 9. Recovery baseline

Creating the initial restore point is recommended. It gives you a known-good local configuration before deeper customization.

---

## Raspberry Pi host modes

### Display + server

This is the standard wall-display mode. The Pi:

- starts the LibreDisplay server
- launches Chromium
- monitors the browser heartbeat
- monitors server health
- uses bounded Chromium graphics recovery on supported Pi hardware
- restarts Chromium if the managed kiosk becomes unhealthy

### Server-only mode

Server-only mode is designed for a Pi that should host LibreDisplay for other devices without wasting resources on a local webpage.

The Pi still runs:

- the LibreDisplay Python server
- saved display endpoints
- Remote Access and Owner-device enrollment
- Profiles and Scenes/schedules
- integrations and server-side provider work
- backup/update/recovery tooling
- configuration persistence

The Pi intentionally does **not** launch the local Chromium kiosk.

### Enable or disable in Settings

Open:

**Settings > System > Raspberry Pi host mode**

Toggle **Server-only mode — do not launch a webpage on this Pi**.

The change is applied immediately. The server remains online while the local Chromium process stops or starts.

### Enable or disable over SSH

```bash
libredisplay server-only status
libredisplay server-only on
libredisplay server-only off
libredisplay server-only enable   # alias for on
libredisplay server-only disable  # alias for off
```

The `on`/`enable` forms are equivalent, as are `off`/`disable`. These commands are safe to run over SSH. If the server is temporarily offline, LibreDisplay writes the saved host-mode request directly so it takes effect on the next start. This is also the recovery path if you enabled Server-only mode and later want the local dashboard back.

### Environment-forced no-browser mode

Advanced deployments can still force no-browser behavior with `DASHBOARD_NO_BROWSER=1`. When that override is active, the Settings toggle is intentionally disabled because the host environment is stronger than the saved UI preference.

### Server-only and Remote Access

For normal use, enable Remote Access before making a physically unattended Pi Server-only. If Remote Access is disabled, SSH remains the recovery/admin path.

Useful SSH commands:

```bash
libredisplay addresses
libredisplay connect
libredisplay remote status
libredisplay remote on
```

---

</details>

<details>
<summary><strong>2. Remote Access and multiple displays</strong><br>Owner devices, connection codes, accounts, Display Links, endpoints, profiles, scenes, and multi-screen operation.</summary>

## Remote Access and Owner devices

### Recommended Owner-device workflow

1. Enable Remote Access on the trusted LAN/private VPN.
2. Choose **Add Owner Device** in Settings, or run `libredisplay connect` over SSH.
3. On the new device, open one of the displayed `/connect` addresses.
4. Enter the one-time code, or scan the QR.
5. Give the browser a recognizable name.
6. The browser becomes an Owner device and appears in the device list.

Connection codes are intentionally short-lived and single-use.

### From SSH

Show stable connection addresses:

```bash
libredisplay addresses
```

Create an Owner connection code:

```bash
libredisplay connect
```

If Remote Access is currently disabled and you intentionally want the command to enable it:

```bash
libredisplay connect --enable-remote
```

The default CLI output keeps the code separate from the stable `/connect` address. This is safer to read and copy manually.

To print the direct temporary-code URL as well:

```bash
libredisplay connect --show-direct
```

Treat that direct URL as a short-lived credential.

### Remote Access status

```bash
libredisplay remote status
libredisplay remote on
libredisplay remote off
```

Disabling Remote Access invalidates active remote credentials according to LibreDisplay's security policy. Do not toggle it casually on a server you can only reach remotely.

### Owner devices

In Settings, the Owner-device list shows trusted browsers. Use it to:

- rename a device
- identify the current browser
- review last-seen/session information
- revoke a lost, retired, or untrusted browser

The physical/local LibreDisplay remains the recovery Owner on a native installation.

### Named accounts

Use named accounts when a person should repeatedly sign in with a username/password instead of enrolling a browser as an Owner device.

Use the least-powerful role that works:

- **Owner** — whole server
- **Editor** — assigned displays
- **Viewer** — read-only assigned displays

### Display Links

Display Links are for viewers, not administrators. They are scoped to one endpoint and contain a credential.

The CLI hides Display Links by default. To intentionally print them:

```bash
libredisplay addresses --include-display-links
```

Do not paste Display Links into public chats, tickets, screenshots, or documentation.

---

## Multiple displays

One LibreDisplay server can serve several named display endpoints.

Typical arrangement:

```text
Pi 4 server-only host
├── Living Room Pi browser -> main
├── Kitchen Pi browser     -> kitchen
├── Tablet                 -> family
└── Owner laptop           -> Settings/admin
```

### Profiles

Profiles are reusable dashboard snapshots. They can be created from one display and intentionally applied to another.

Use Profiles when you want repeatable configurations such as:

- weekday layout
- nighttime layout
- holiday layout
- minimal performance profile
- common room template

### Scenes and schedules

Scenes apply Profiles according to server-side schedules. They continue working even if no Settings browser is open.

### Read-only endpoints

Use a separate Display Link per screen whenever the viewer should render the dashboard but never administer the server.

---

</details>

<details>
<summary><strong>3. Settings and layout reference</strong><br>A section-by-section Settings explanation plus Arrange mode and layout behavior.</summary>

## Settings guide

LibreDisplay has many controls because unattended displays benefit from granular behavior. This section explains what each major area is for rather than listing every slider mechanically.

### Home / overview

Use Home to:

- see setup status
- rerun the guided wizard
- review saved/unsaved state
- jump into the major configuration areas

If you are unsure where to begin after a reset or migration, rerun the wizard from Home.

### Displays

The Displays area covers multi-display administration and Remote Access.

Use it for:

- display endpoint names
- read-only Display Links
- Owner-device enrollment
- authorized Owner-device management
- named Owner/Editor/Viewer accounts
- Profiles
- Scenes and schedules

A display endpoint is not the same thing as an Owner device. One is a dashboard configuration; the other is a trusted administration browser.

### Location & Weather

The location controls determine forecast coordinates and timezone behavior.

Weather settings cover:

- units
- current conditions
- Daily/Hourly forecast presentation
- weather detail cards
- refresh intervals
- fullscreen weather effects
- hazard presentation
- NatureScape effects
- dog companion behavior

Performance-heavy visual effects can be reduced independently of the core forecast data.

### Calendars

Calendar settings cover:

- ICS feed URLs
- local `.ics` imports
- source labels/colors
- enable/disable state
- order/priority
- refresh interval
- display range and continuation behavior
- optional built-in add-ons

Optional Calendar Add-ons are off by default. The master add-on toggle controls participation without erasing subgroup selections.

### Backgrounds

Background settings control:

- source type
- stock search/category/resolution
- supported photo sources
- local/NAS folders
- recursive media discovery
- playback order
- rotation interval
- preloading
- motion/video allowance
- offline background reserve
- startup priority/delay

If a wall display stutters, animated/video backgrounds are one of the first things to temporarily disable during diagnosis.

### Appearance

Appearance controls the broad visual system:

- theme
- font
- text colors
- panel opacity/style
- overall sizing
- clock/calendar/weather sizing
- forecast presentation
- spacing and alignment

Use Arrange mode for exact placement; use Appearance for broad visual behavior.

### Arrange dashboard

Arrange provides per-element positioning/sizing and detailed component controls. It is the right place for exact layout work after the broad Appearance choices are stable.

Save a Profile before a large layout experiment if you want an easy return point.

### Alerts

Alert settings determine whether severe-weather alerts are active, how large they appear, their motion/scroll behavior, and refresh timing.

Use test mode when adjusting presentation instead of waiting for a real hazard.

### Integrations

The Integrations directory describes whether each provider is:

- local/self-hosted
- no-key/no-signup
- account/API-key based

LibreDisplay favors freedom-first/local providers when practical. The health section lets you test configured integrations without displaying saved secrets.

### Family & touch mode

Family features provide local household members, chores, points, rewards, and optional PIN protection. Add the Family Chores block through Arrange mode for a wall-friendly touch interface.

### System

System contains operational rather than visual controls:

- **Raspberry Pi host mode**
- provider/data-source health
- display readiness
- kiosk/browser health
- storage/temperature/load
- graphics/throttling diagnostics
- physical-display performance benchmark
- diagnostics export
- software update
- rollback/recovery information

Server-only mode appears here because it changes how the host runs, not how one dashboard endpoint looks.

---

## Arrange mode and layouts

### Recommended workflow

1. Get data sources working first.
2. Choose a theme and broad Appearance settings.
3. Save a Profile.
4. Enter Arrange mode.
5. Move/resize blocks.
6. Check the real target display, not only a remote admin browser.
7. Save another Profile after major milestones.

### Avoiding accidental layout confusion

When managing several screens, always confirm the active display endpoint before editing. A correct layout applied to the wrong endpoint can look like lost settings even though the intended display was never changed.

### Remote editing versus physical rendering

A remote Settings browser is an administration surface, not a substitute for the target kiosk's hardware. Performance tests that need the physical display are dispatched to the attached kiosk browser and returned to Settings.

---

</details>

<details>
<summary><strong>4. Terminal and SSH reference</strong><br>The complete `libredisplay` command reference, including Remote Access, Server-only mode, diagnostics, backups, updates, and field checks.</summary>

## Terminal / SSH command reference

Run:

```bash
libredisplay --help
```

or:

```bash
libredisplay <command> --help
```

### `libredisplay status`

Shows the installed version, server health, native Pi host mode, local kiosk state, basic hardware information, and Remote Access state.

```bash
libredisplay status
```

Use this first after SSHing into a Pi.

### `libredisplay addresses`

Shows stable LAN/VPN addresses for Owner-device connection and login.

```bash
libredisplay addresses
```

By default it does not print credential-bearing read-only Display Links.

```bash
libredisplay addresses --include-display-links
```

Use the latter only when you deliberately need those credentials.

### `libredisplay connect`

Creates a one-time Owner-device code.

```bash
libredisplay connect
```

Enable Remote Access first if necessary:

```bash
libredisplay remote on
```

or intentionally combine the two:

```bash
libredisplay connect --enable-remote
```

Machine-readable output:

```bash
libredisplay connect --json
```

Include the temporary direct-code URL:

```bash
libredisplay connect --show-direct
```

### `libredisplay remote`

```bash
libredisplay remote status
libredisplay remote on
libredisplay remote off
```

Remote Access is for trusted LAN/private-VPN clients only.

### `libredisplay server-only`

```bash
libredisplay server-only status
libredisplay server-only on
libredisplay server-only off
libredisplay server-only enable   # alias for on
libredisplay server-only disable  # alias for off
```

Use `on` or `enable` to stop the local Chromium dashboard while leaving the server online. Use `off` or `disable` to restore Display + server mode. If the server is online, the CLI updates the runtime through the local API. If the server is down, the CLI safely writes the saved mode request so it takes effect on the next LibreDisplay start.

### `libredisplay display-mode`

Switch the managed local Pi browser between fullscreen kiosk and windowed device-use mode:

```bash
libredisplay display-mode kiosk
libredisplay display-mode windowed
```

This command applies only to the local native display manager.

### `libredisplay doctor`

Runs quick checks for:

- required installation files
- writable data directory
- `/healthz`
- system-health API
- host mode
- startup integrity

```bash
libredisplay doctor
```

Use this before manually changing files.

### `libredisplay logs`

Recent Chromium/browser log:

```bash
libredisplay logs
```

More or fewer lines:

```bash
libredisplay logs --lines 250
```

Update log:

```bash
libredisplay logs --type update
```

Rollback log:

```bash
libredisplay logs --type rollback
```

### `libredisplay backup`

Creates a sensitive `.ldbackup` using the same backup engine as the maintenance scripts.

```bash
libredisplay backup
```

You may pass the same extra arguments supported by `server-backup.py backup`.

### `libredisplay restore`

Restores a `.ldbackup` using the LibreDisplay backup engine.

```bash
libredisplay restore /path/to/LibreDisplay-backup.ldbackup
```

Restores can replace active configuration and may require elevated privileges when host/NAS state is included. Read the prompt carefully.

### `libredisplay check`

Checks GitHub for a newer release.

```bash
libredisplay check
```

### `libredisplay update`

Creates recovery material and updates to the latest supported GitHub release.

```bash
libredisplay update
```

To install without the normal reboot step:

```bash
libredisplay update --no-reboot
```

### `libredisplay field-check`

Collects privacy-safe field-readiness/performance data for a real Pi display.

```bash
libredisplay field-check --once
```

See command help for longer soak and release-gate options.

### `libredisplay version`

```bash
libredisplay version
```

---

</details>

<details>
<summary><strong>5. Maintenance, updates, and recovery</strong><br>Backup, update, restore, interrupted-update recovery, Server-only recovery, and Remote Access recovery.</summary>

## Backups, updates, and recovery

### Before major changes

Create both:

1. a Profile for quick dashboard/layout rollback
2. a full `.ldbackup` for server data/recovery

### Backup

```bash
libredisplay backup
```

Store important backups somewhere other than the Pi itself.

### Update

```bash
libredisplay check
libredisplay update
```

LibreDisplay verifies release structure and uses bounded rollback/recovery behavior around updates.

### Interrupted update

The native startup path checks for an interrupted update transaction before starting the server. If the previous update lost power mid-transaction, LibreDisplay attempts to recover the verified pre-update snapshot before continuing.

### Server-only recovery

If the local screen is blank because Server-only mode is enabled intentionally:

```bash
libredisplay server-only status
libredisplay server-only off
```

Do not delete browser profiles or configuration files just to restore the webpage.

### Remote Access recovery

If an Owner device was lost/revoked:

1. SSH to the Pi.
2. Check Remote Access:

```bash
libredisplay remote status
```

3. Enable it if appropriate:

```bash
libredisplay remote on
```

4. Generate a new one-time code:

```bash
libredisplay connect
```

### Basic server recovery check

```bash
libredisplay doctor
curl http://127.0.0.1:8787/healthz
```

A healthy `/healthz` with a missing local display usually indicates a browser/host-mode issue rather than a server failure.

---

</details>

<details>
<summary><strong>6. Performance, display care, and server deployments</strong><br>Pi 3/4/5 guidance, Server-only performance, OLED protection, Docker, NAS, and browserless server deployments.</summary>

## Performance and Raspberry Pi guidance

### Pi 3

Prioritize stability and static presentation. Automatic mode may reduce or stop expensive continuous animation while preserving the dashboard's visual information.

Recommended troubleshooting order:

1. disable video/animated backgrounds
2. reduce fullscreen weather/NatureScape effects
3. reduce wildlife/seasonal intensity
4. check browser graphics/runtime health
5. run the physical-display bottleneck test

### Pi 4

Pi 4 normally has more visual headroom, but heavy forecast strips, motion, large custom layouts, video, and overlays can still combine into a bottleneck.

Use the physical-display performance test rather than judging only from the remote Settings browser.

### Pi 5

Pi 5 should generally keep full presentation quality while avoiding unnecessary duplicated animation/rendering work.

### Server-only Pi

A server-only Pi does not need to spend CPU/GPU/memory on the managed local Chromium dashboard. This is useful when:

- the Pi is hidden in a cabinet/rack
- all displays are separate devices
- you want one Pi to centralize several endpoints
- the server hardware is not connected to a screen

Server-side provider work and integrations still consume normal resources.

---

## OLED and always-on display care

LibreDisplay intentionally keeps these protections independent:

- pixel shifting
- idle dimming
- Quiet Hours
- deep-black / 0% protection
- temporary wake behavior
- motion suppression while dimmed
- timing/intensity controls

You do not need to enable every protection feature together.

For example, you can run pixel shifting continuously while leaving Quiet Hours disabled.

---

## Docker, NAS, and server deployments

Docker/NAS installations already behave like server hosts; they do not use LibreDisplay's native Raspberry Pi Chromium manager.

Typical Docker flow:

```bash
chmod +x scripts/docker-setup.sh
./scripts/docker-setup.sh --lan
```

Maintenance:

```bash
./scripts/docker-setup.sh update
./scripts/docker-setup.sh backup
```

Persistent data must stay in the configured volume/mapping. Do not treat the container filesystem itself as permanent storage.

The native **Server-only mode** toggle is intentionally reported as unsupported on deployments that do not use the native Pi kiosk manager, because those deployments already have no managed local kiosk to stop.

---

</details>

<details>
<summary><strong>7. Troubleshooting</strong><br>Symptom-based diagnosis for display, network, Owner enrollment, Settings, calendars, weather, backgrounds, performance, browser stability, updates, Docker, and credential recovery.</summary>

## Troubleshooting

Use this section as a decision tree.

### Nothing appears on the Pi screen

First determine whether this is intentional.

```bash
libredisplay status
libredisplay server-only status
```

If Server-only mode is on and you want the local dashboard:

```bash
libredisplay server-only off
```

If Server-only mode is off, run:

```bash
libredisplay doctor
libredisplay logs --lines 200
```

Also verify:

```bash
curl http://127.0.0.1:8787/healthz
```

If `/healthz` works, focus on Chromium/display-session issues rather than server configuration.

### The server cannot be reached from another device

1. On the Pi:

```bash
libredisplay status
libredisplay remote status
libredisplay addresses
```

2. Confirm both devices are on the same trusted LAN/private VPN.
3. Try a numeric LAN address if `.local` does not resolve.
4. Do not test through a public port-forward; that is unsupported and unsafe.

### I need to authorize a new Owner but the wall display is unavailable

SSH to the server:

```bash
libredisplay remote on
libredisplay connect
```

Open one of the printed `/connect` addresses on the new device and enter the code.

### Connection code says invalid or expired

Codes are single-use and short-lived. Create a new one:

```bash
libredisplay connect
```

Do not reuse an already-redeemed QR/link.

### `.local` hostname does not work

Some networks/devices do not resolve mDNS reliably. Run:

```bash
libredisplay addresses
```

Use one of the numeric private-LAN addresses instead.

### Settings changes do not appear on the intended screen

- confirm the active display endpoint
- save the settings
- refresh the target display
- make sure you did not edit a Profile without applying it
- check whether a Scene schedule is intentionally applying another Profile

### Calendar does not update

- verify the feed is enabled
- use Check/Test feed
- confirm the provider URL is still valid
- verify timezone expectations
- look for provider/network errors
- temporarily reduce the problem to one calendar source

### Weather location is wrong

Search again and choose the exact region/country match. The display label does not change the coordinates.

### Background is blank

- verify the selected source
- test network access for remote photo sources
- verify local/NAS mounts
- run the media/NAS helper again if mount paths changed
- temporarily choose a stock or no-photo background to isolate the problem

### Pi display is stuttering

- run the physical-display bottleneck test
- disable video/animated backgrounds first
- reduce fullscreen effects
- inspect System Health for software graphics or throttling
- check temperature and power quality
- use the Pi-specific performance guidance above

### Browser keeps restarting

Check:

```bash
libredisplay logs --lines 300
libredisplay doctor
```

System Health also records browser recovery and graphics profile information.

### Update failed

Check:

```bash
libredisplay logs --type update
libredisplay logs --type rollback
```

Do not immediately delete rollback directories or transaction markers; they are part of the safety path.

### I think configuration is corrupted

Before editing JSON manually:

1. run `libredisplay doctor`
2. use the previous-settings/restore-point tools if available
3. restore a known-good `.ldbackup` if necessary

LibreDisplay maintains resilience/recovery paths specifically so manual file surgery is not the first option.

### Docker container starts but no dashboard configuration remains

Check the persistent volume/mapping. Configuration inside an ephemeral container layer disappears when that container is replaced.

### Remote Access should be completely reset

Use **Reset all remote credentials** from Owner Settings. This resets remote credentials without deleting normal dashboard configuration/layout/media settings.

---

</details>

<details>
<summary><strong>8. Tips, privacy, and quick recovery</strong><br>Operational tips, privacy/security boundaries, and the compact recovery command card.</summary>

## Tips and tricks

### Use the Pi as a dedicated server

For a clean central-server setup:

```bash
libredisplay remote on
libredisplay server-only on
libredisplay addresses
```

Then use read-only Display Links on the viewing devices and enroll one or more trusted Owner devices for administration.

### Keep one emergency SSH path

If you depend on Server-only mode, make sure SSH access is tested before placing the Pi somewhere physically inconvenient.

### Name everything clearly

Good names make multi-display administration much easier:

- `Living Room Display`
- `Kitchen Tablet`
- `Office Owner Laptop`
- `Family Board Profile`

Avoid generic names such as `device2` once the system grows.

### Save Profiles before major experiments

A Profile is faster for layout rollback than restoring a full server backup.

### Use a full backup before upgrades or infrastructure changes

Profiles are not a substitute for a `.ldbackup` when changing hosts, NAS mounts, plugins, or other server-level state.

### Diagnose with subtraction

When a visual/performance issue appears, disable one expensive category at a time rather than changing ten settings simultaneously. This makes the actual cause measurable.

### Use read-only Display Links for unattended screens

Do not enroll every wall screen as an Owner device. A read-only viewer has a much smaller security footprint.

### Prefer stable connection addresses

Use the stable `/connect` address plus a one-time code for manual enrollment. Avoid saving temporary direct-code URLs.

### Keep Remote Access private

A private VPN is appropriate for reaching LibreDisplay from away from home. Public port-forwarding is not.

---

## Privacy and security

LibreDisplay is intentionally self-hosted and does not require a LibreDisplay cloud identity.

### Local data

Configuration, authorized-device state, profiles, scenes, backups, and other server data stay with your LibreDisplay installation unless you explicitly move or back them up elsewhere.

### External providers

Weather, calendars, photo services, integrations, and other external sources necessarily contact the provider you configure. Review provider requirements before adding credentials or private URLs.

### Remote credentials

Treat these as secrets:

- read-only Display Links
- direct one-time-code enrollment URLs while valid
- named-account passwords
- backups containing sensitive configuration

Normal `/connect` addresses without a code are not sufficient by themselves to authorize a new Owner.

### Recommended security posture

- trusted LAN or private VPN only
- no public port-forwarding
- revoke old Owner devices
- use Viewer/Editor roles where Owner is unnecessary
- use read-only Display Links for wall screens
- keep backups protected
- keep the server updated

---

## Quick recovery card

When you SSH into a Pi and do not know what is wrong, run these in order:

```bash
libredisplay status
libredisplay doctor
libredisplay server-only status
libredisplay remote status
libredisplay addresses
libredisplay logs --lines 120
```

If you need a new administrative browser:

```bash
libredisplay remote on
libredisplay connect
```

If you need the Pi's own webpage back:

```bash
libredisplay server-only off
```

If the server itself is healthy but another screen cannot connect, troubleshoot LAN/VPN reachability and the connection address before changing LibreDisplay configuration.

</details>
