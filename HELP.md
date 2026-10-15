# LibreDisplay Help & Setup Guide

LibreDisplay turns a browser-connected screen into a customizable, self-hosted dashboard. This guide covers setup, everyday changes, remote administration, troubleshooting, recovery, and the deeper options you may want later.

You do not need to read it cover to cover. Start with the task that matches what you are doing, then open the more detailed sections only when you need them.

> **Security boundary:** LibreDisplay is designed for a trusted home LAN or private VPN. Do not expose the built-in LibreDisplay server directly to the public Internet with port forwarding.

---

## Start here: what do you want to do?

| Your goal | Best place to start |
| --- | --- |
| Install LibreDisplay on a Raspberry Pi with a screen | [Install on a Raspberry Pi](#install-on-a-raspberry-pi) |
| Use a Pi only as the LibreDisplay server | [Server-only deployment](#server-only-deployment) |
| Finish the first-time setup wizard | [First-time setup](#first-time-setup) |
| Connect a phone, tablet, or computer as an Owner | [Add an Owner device](#add-an-owner-device) |
| Add another read-only wall screen | [Add a read-only display](#add-a-read-only-display) |
| Understand a Settings category | [Settings encyclopedia](#settings-encyclopedia) |
| Rearrange or resize the dashboard | [Arrange mode](#arrange-mode) |
| Administer LibreDisplay over SSH | [Terminal and SSH reference](#terminal-and-ssh-reference) |
| Back up, update, restore, or roll back | [Maintenance and recovery](#maintenance-and-recovery) |
| Improve Raspberry Pi performance | [Performance and device guidance](#performance-and-device-guidance) |
| Run LibreDisplay with Docker, NAS, or a browserless host | [Server deployments](#server-deployments) |
| Fix something that is not working | [Troubleshooting by symptom](#troubleshooting-by-symptom) |
| Understand privacy, credentials, and security boundaries | [Privacy and security](#privacy-and-security) |
| Find a practical example for a common task | [Task recipes](#task-recipes) |

### Something broken right now?

SSH into the LibreDisplay host and run these commands in order:

```bash
libredisplay status
libredisplay doctor
libredisplay server-only status
libredisplay remote status
libredisplay addresses
libredisplay logs --lines 120
```

If the server itself responds but the Pi screen is blank, check Server-only mode before changing anything else:

```bash
libredisplay server-only status
libredisplay server-only off
```

If you need to authorize a new Owner device and cannot reach Settings locally:

```bash
libredisplay remote on
libredisplay connect
```

If you only want to confirm the server is alive:

```bash
curl http://127.0.0.1:8787/healthz
```

### Five things worth knowing before you customize

1. **The server and the display browser are separate jobs.** One Pi can do both, or a server-only Pi can host dashboards for other devices.
2. **A display endpoint is not an Owner device.** Endpoints are dashboards; Owner devices are trusted administration browsers.
3. **Read-only Display Links are credentials.** Treat them like secrets even though they are meant for unattended screens.
4. **Profiles are for fast dashboard/layout rollback.** Full `.ldbackup` files are for server-level recovery and migration.
5. **If a setting exists in both broad appearance and Arrange mode, use broad settings first and fine-tune in Arrange mode second.**

---

## How to use this guide

The 15 main chapters below are collapsed by default. Open the one you need and leave the rest alone until it becomes useful.

If you are setting up LibreDisplay for the first time, this order works well:

1. installation and first-time setup
2. Remote Access and Owner devices
3. Settings encyclopedia
4. Arrange mode
5. backups and updates
6. troubleshooting only when needed

Running LibreDisplay headless or mostly over SSH? Jump straight to **Server-only mode**, **Terminal and SSH reference**, and **Maintenance and recovery**.

---

<a id="install-on-a-raspberry-pi"></a>
<details>
<summary><strong>1. Installation and deployment choices</strong><br>Choose the right host type, install LibreDisplay, understand the directory layout, and avoid common first-install mistakes.</summary>

## Decide what kind of LibreDisplay host you want

LibreDisplay can be used in three common ways.

### Raspberry Pi: Display + server

Use this when the Pi is physically connected to the screen you want to show LibreDisplay on.

The Pi runs:

- the LibreDisplay Python server
- the local Chromium dashboard
- browser watchdog and display-health checks
- Remote Access and Owner-device enrollment
- integrations and provider refreshes
- backups, updates, profiles, scenes, and schedules

This is the normal wall-display setup.

### Raspberry Pi: Server only

Use this when the Pi should host LibreDisplay but another device will render the dashboard.

The Pi still runs the full server, but LibreDisplay intentionally does not launch the local Chromium dashboard. This is useful for:

- a Pi in a cabinet or rack
- one server feeding several display devices
- a Pi with no attached monitor
- reducing local browser/GPU overhead
- using tablets, TVs, mini PCs, or separate Pis as viewers

Server-only mode can be selected during first-time setup or changed later from Settings or SSH.

### Docker / NAS / general server

Use this when the host is not meant to run LibreDisplay's native Raspberry Pi kiosk manager.

Docker/server deployments already behave like server-only hosts. They serve dashboards to browsers but do not manage a local Chromium kiosk through the native Pi display subsystem.

---

## Native Raspberry Pi requirements

Use a current Raspberry Pi OS **with Desktop** for the native installation path. The native installer includes browser management, display diagnostics, kiosk recovery, and graphics-health behavior that expect a desktop/browser environment.

If you want a completely browserless operating system, use Docker or another server-style deployment instead of installing the native kiosk stack on Pi OS Lite.

### Installation directory

A normal native installation lives at:

```text
~/libredisplay
```

Important locations include:

```text
~/libredisplay/README.md
~/libredisplay/HELP.md
~/libredisplay/app/
~/libredisplay/assets/
~/libredisplay/plugins/
~/libredisplay/scripts/
~/libredisplay/data/
```

The main administration CLI is installed as:

```text
/usr/local/bin/libredisplay
```

---

## First installation

Use the one-line installer shown in `README.md`. The bootstrap validates the pinned release before performing the native installation.

Important rules:

- do not run the normal installer directly as root unless the documented installer flow invokes privileged helpers itself
- do not overwrite an existing `~/libredisplay` directory with the first-install command
- reboot when the installer asks you to
- keep SSH available until first-time setup and display behavior are confirmed

### Existing installation

For an existing LibreDisplay installation, use the supported updater instead of reinstalling over the directory:

```bash
libredisplay check
libredisplay update
```

The updater creates recovery material and validates the replacement release before committing the new runtime.

---

## After installation

Start with:

```bash
libredisplay status
```

On a normal Display + server Pi you should see:

- the installed version
- server online status
- host mode
- local kiosk state
- detected hardware information when available
- Remote Access state

If the server is healthy but the browser is not visible, do not immediately reinstall. See the troubleshooting section for host-mode and Chromium checks.

---

## Installation safety notes

LibreDisplay's native install/update path validates release structure, required startup files, the bundled QR dependency, archive integrity, and other startup-critical material. The one-command release extractor also rejects unsafe archive conditions such as traversal paths, symlinks, duplicate normalized members, oversized members, and unreasonable decompressed totals.

You should still keep an external backup before major host changes, storage migration, or operating-system reinstallation.

</details>

<a id="first-time-setup"></a>
<details>
<summary><strong>2. First-time setup and the first hour</strong><br>Walk through the setup wizard, make the first safe choices, and establish a recovery baseline before deep customization.</summary>

## First-time setup

### What the setup wizard actually does

The first-time wizard writes the same real configuration used by the full Settings interface. It is not a temporary setup layer and there is no hidden second configuration system.

You can change every major wizard choice later.

### Quick setup or full guided setup

The welcome screen offers two paths:

- **Quick setup** — the recommended first-run path: location, starter layout, calendars, background, review, and health checks. Performance, alerts, remote access, host mode, recovery, and other advanced choices keep safe defaults and remain editable later.
- **Full guided setup** — walks through every first-run decision, including display naming, performance, alerts, appearance, remote access, Pi host mode, and recovery.

Neither mode removes or locks settings. Quick setup only postpones decisions that a new user does not need to make before seeing a working dashboard.

### Continue setup from another device

If configuring the wall display itself is awkward, choose **Set up from another device** on the welcome screen. LibreDisplay creates a short-lived, one-time Owner connection and brings up a QR/code workflow for a trusted phone, tablet, or computer on the same private network. Remote editing stays disabled unless you explicitly choose this option.

The numbered steps below describe the complete guided path. Quick setup uses the relevant subset and then takes you straight to review and health checks.

---

## 1. Name the display

Use a name that identifies the physical screen or purpose rather than the hardware model.

Good examples:

```text
Living Room
Kitchen
Office
Family Board
Weather Display
Hallway
```

The friendly display name is for people. LibreDisplay also keeps a stable internal endpoint ID for routing and multi-display management.

---

## 2. Set the weather location

Search for the exact city/region/country match. LibreDisplay stores coordinates and timezone-related information so duplicate city names can be distinguished correctly.

The visible location label is cosmetic. Renaming the label does not move the weather coordinates.

If weather later appears to come from the wrong place, search and select the location again instead of only editing the label.

---

## 3. Add calendars

Calendar sources can be added during setup or later.

Prefer a small number of known-good sources first. Once the first feed is confirmed, add more.

Common calendar problems are caused by:

- expired or changed subscription URLs
- authentication changes at the calendar provider
- timezone assumptions
- disabled feeds
- provider/network outages
- event-range filters rather than fetch failures

Use the calendar feed check/test controls before treating a missing event as a layout bug.

---

## 4. Choose a background source

You can use:

- stock/background sources
- supported photo integrations
- local folders
- NAS folders
- no photo background

For a first boot on lower-power hardware, a static or simple background is easier to validate than a video or highly dynamic source.

Local and NAS setup helpers are described later in this guide.

---

## 5. Choose a visual performance starting point

Use **Automatic** unless you already know the target hardware needs a specific mode.

The purpose of the initial performance choice is to establish a stable unattended display. You can add richer motion and denser NatureScape behavior later.

For Pi 3 especially, start conservatively and let the static-scene behavior do its job before forcing continuous motion.

---

## 6. Configure alerts and appearance basics

Choose the basics first:

- severe-weather alert behavior
- theme
- typography
- general presentation preferences

Do not spend an hour perfecting exact block positions during the wizard. Finish setup, confirm the data sources work, then use Arrange mode.

---

## 7. Decide whether to enable Remote Access

Remote Access is optional but strongly recommended when:

- the Pi will run Server-only
- the display is mounted where keyboard/mouse access is inconvenient
- you want to manage LibreDisplay from a laptop or phone
- you have multiple display endpoints

Keep Remote Access restricted to a trusted LAN or private VPN.

---

## 8. Choose Raspberry Pi host mode

Choose one:

**Display + server**  
The Pi runs the LibreDisplay server and opens the local Chromium dashboard.

**Server only**  
The Pi runs the LibreDisplay server but intentionally does not launch a local webpage.

This is a host-level choice. It is not part of a Profile and does not change when you load a Scene or rearrange a dashboard endpoint.

---

## 9. Create a recovery baseline

Before heavy customization, create:

1. a Profile for the working dashboard layout
2. a full `.ldbackup` for server-level recovery

A Profile is quick to restore for layout experiments. A `.ldbackup` protects much more of the server state.

---

## Recommended first-hour checklist

After the wizard, confirm these before deeper customization:

- `libredisplay status` reports the server online
- the intended dashboard endpoint renders
- weather location is correct
- at least one calendar source works if you use calendars
- Remote Access works if you plan to administer remotely
- one Owner device is authorized and named clearly
- the Pi host mode matches how you intend to use it
- a recovery Profile exists
- a backup exists before major experimentation

</details>

<a id="server-only-deployment"></a>
<details>
<summary><strong>3. Raspberry Pi Server-only mode</strong><br>Run a Pi as the LibreDisplay server without a local browser, switch modes safely, and recover over SSH.</summary>

## What Server-only mode changes

Server-only mode stops or prevents LibreDisplay's managed local Chromium kiosk from running on that Pi.

It does **not** stop the LibreDisplay server.

The Pi continues to provide:

- dashboard endpoints
- Owner-device enrollment and Remote Access
- named accounts and Display Links
- integrations and data providers
- Profiles, Scenes, and schedules
- configuration persistence
- backups, updates, and recovery tooling
- APIs used by connected displays

This makes Server-only mode suitable for a dedicated central host.

---

## Enable or disable Server-only mode from Settings

Open:

**Settings > System & Maintenance > Raspberry Pi host mode**

Use the Server-only toggle.

The change is applied live:

- switching to Server-only stops the managed local browser while the server stays online
- switching back to Display + server starts the local dashboard again without intentionally stopping the server

---

## Enable or disable Server-only mode over SSH

Status:

```bash
libredisplay server-only status
```

Enable:

```bash
libredisplay server-only on
```

or:

```bash
libredisplay server-only enable
```

Disable and restore the local dashboard:

```bash
libredisplay server-only off
```

or:

```bash
libredisplay server-only disable
```

`on` and `enable` are equivalent. `off` and `disable` are equivalent.

If the LibreDisplay server is temporarily offline, the CLI can still save the requested host mode so it takes effect when LibreDisplay starts again.

---

## Environment-forced no-browser mode

Advanced deployments may use:

```text
DASHBOARD_NO_BROWSER=1
```

This is stronger than the saved Server-only preference. If the environment forces no browser, turning Server-only off in Settings cannot override that host-level instruction.

If the UI says the mode is forced by the environment, remove or change the environment setting before expecting the local kiosk to start.

---

## Recommended Server-only setup order

Before placing a Pi somewhere physically inconvenient:

```bash
libredisplay remote on
libredisplay addresses
libredisplay connect
libredisplay server-only on
libredisplay status
```

Then confirm from another device that:

- the server address is reachable
- the Owner device can open Settings
- at least one display endpoint renders remotely
- SSH still works

Only then remove the local keyboard/monitor if the installation will be unattended.

---

## Restore the local webpage if Server-only was enabled accidentally

SSH into the Pi:

```bash
libredisplay server-only status
libredisplay server-only off
```

Then check:

```bash
libredisplay status
libredisplay logs --lines 120
```

Do not delete Chromium profiles or dashboard configuration merely because the screen is blank; Server-only mode is intentionally designed to produce a blank local display.

</details>

<a id="add-an-owner-device"></a>
<details>
<summary><strong>4. Remote Access, Owner devices, QR enrollment, and accounts</strong><br>Connect trusted administration devices, understand the one-time code/QR workflow, manage roles, and recover access safely.</summary>

## Remote Access model

Remote Access is intended for trusted devices on a private LAN or private VPN.

There are three different access concepts:

| Access type | Purpose | Can change Settings? | Typical use |
| --- | --- | ---: | --- |
| Owner device | Trusted browser administration | Yes | Your laptop, phone, tablet |
| Named account | Repeated sign-in with a role | Depends on role | Household user, editor, viewer |
| Display Link | Read-only display credential | No | Wall screen, TV browser, kiosk viewer |

Do not use Owner enrollment for every wall screen. Read-only screens should normally use Display Links.

---

## Add an Owner device

From local Settings:

1. Open **Settings > Displays & Access > Remote access**.
2. Make sure Remote Access is enabled.
3. Choose **Add Owner Device**.
4. LibreDisplay generates a short-lived one-time code and a QR.
5. LibreDisplay automatically brings the QR card into view and highlights it; the card is centered in the Settings viewport and focused so it is difficult to miss.
6. On the new device, either scan the QR or open the stable `/connect` address and enter the code manually.
7. Give the new device a recognizable name.
8. Confirm it appears in the Owner-device list.

Connection codes are short-lived and single-use. If one expires or is redeemed, generate another rather than trying to reuse it.

---

## Add an Owner device from SSH

Show stable addresses:

```bash
libredisplay addresses
```

Create a one-time code:

```bash
libredisplay connect
```

If Remote Access is disabled and you intentionally want the command to enable it:

```bash
libredisplay connect --enable-remote
```

Print machine-readable output:

```bash
libredisplay connect --json
```

Print the direct temporary-code URL as well:

```bash
libredisplay connect --show-direct
```

The default output intentionally keeps the stable `/connect` address separate from the temporary code. The direct URL contains the temporary code and should be treated as a short-lived secret.

---

## How the QR enrollment works

The QR represents a temporary enrollment route, not a permanent Owner password.

The flow is:

```text
Generate one-time code
        |
        v
QR / temporary enrollment address
        |
        v
LibreDisplay validates code, expiry, reuse, rate limits, and access boundary
        |
        v
Browser receives its own authenticated Owner session
        |
        v
One-time code becomes unusable
```

The QR is generated locally by LibreDisplay. The normal workflow does not require an external QR website or cloud QR service.

Pending codes intentionally disappear if the server restarts. Already-authorized Owner-device sessions are a different thing and survive normal restarts according to LibreDisplay's session policy.

---

## Manage Owner devices

The Owner-device list lets you:

- see trusted browsers
- identify the current browser
- name or rename devices clearly
- review source/last-seen/session information
- revoke old, lost, or untrusted devices

Good names are descriptive:

```text
Office Laptop
Kitchen iPad
John Phone
Living Room Admin Tablet
```

Avoid generic names such as `Chrome 2` once the system grows.

Revoking the current browser signs it out. Keep at least one tested recovery path, such as SSH or another Owner device, before revoking the only remote administration browser.

---

## Remote Access commands

```bash
libredisplay remote status
libredisplay remote on
libredisplay remote off
```

Disabling Remote Access clears active remote credentials according to LibreDisplay's security policy. Do not disable it casually on a server you can only reach remotely unless SSH recovery is confirmed.

---

## Named accounts

Named accounts are useful when a person should log in repeatedly rather than enrolling the browser itself as an Owner device.

Use the least-powerful role that is sufficient:

**Owner**  
Full server administration.

**Editor**  
Can modify the displays assigned to that account but should not have unrestricted server administration.

**Viewer**  
Read-only access to assigned displays.

---

<a id="add-a-read-only-display"></a>
## Add a read-only display

Use a Display Link for a wall screen or viewer that should render one endpoint but never administer the server.

Display Links contain credentials. The CLI hides them by default.

To intentionally print them:

```bash
libredisplay addresses --include-display-links
```

Do not paste Display Links into public issues, screenshots, chats, or documentation.

---

## Remote Access recovery

If your Owner browser is lost or revoked:

```bash
libredisplay remote status
libredisplay remote on
libredisplay connect
```

Use the newly generated code from another trusted device.

If you want to invalidate all remote credentials, use **Reset all remote credentials** from Owner Settings. That resets Remote Access credentials without deleting ordinary dashboard layout, weather, calendar, media, or appearance configuration.

</details>

<details>
<summary><strong>5. Displays, endpoints, Profiles, Scenes, and multi-display setups</strong><br>Understand what a display is, reuse layouts safely, schedule changes, and build one-server/many-screen installations.</summary>

## Display endpoints

A display endpoint is a named dashboard configuration served by the LibreDisplay server.

Examples:

```text
main
kitchen
family
office
weather
```

An endpoint can have its own layout and display-oriented configuration.

A display endpoint is not:

- an Owner device
- a named user account
- the Raspberry Pi host itself

Keeping these concepts separate makes multi-display systems much easier to reason about.

---

## Typical multi-display architecture

```text
LibreDisplay server
├── main endpoint       -> Living Room Pi
├── kitchen endpoint    -> Kitchen tablet
├── family endpoint     -> Hallway touch display
├── office endpoint     -> Office monitor
└── Owner administration -> Laptop / phone
```

The server can be the same Pi as one of the displays or a separate Server-only machine.

---

## Profiles

A Profile is a reusable dashboard/configuration snapshot intended for intentional reuse and fast rollback.

Good uses:

- save a known-good layout before rearranging
- create a daytime and nighttime arrangement
- copy a baseline design to another display
- create a holiday presentation
- create a low-motion troubleshooting profile

Profiles are not a substitute for full backups when changing server infrastructure, integrations, NAS mounts, or credentials.

---

## Scenes and schedules

Scenes apply Profiles according to server-side scheduling rules.

They continue operating even when no Settings browser is open.

Before troubleshooting a display that “keeps changing back,” check whether a Scene schedule is intentionally applying another Profile.

---

## Practical multi-display rules

- give every endpoint a descriptive name
- give every Owner device a different descriptive name
- use read-only Display Links for unattended viewers
- verify the active endpoint before editing remotely
- save a Profile before large layout changes
- test performance on the physical target display, not only on the admin laptop

</details>

<a id="settings-encyclopedia"></a>
<details>
<summary><strong>6. Settings encyclopedia</strong><br>A complete map of the Settings interface: what each category controls, when to use it, and what commonly causes confusion.</summary>

## How Settings is organized

LibreDisplay Settings has an **Essentials** view and an **All** view.

Use **Essentials** for normal configuration. Use **All** when you need power-user controls, troubleshooting options, or the more granular visual settings.

Settings also includes:

- search with aliases and direct editing for many matching controls
- a **Favorites** bucket at the end of the Start here group
- per-setting favorite stars and exact numeric entry for sliders
- a **Modified only** filter that shows settings changed from their defaults
- category navigation and per-category section jump menus
- reusable section presets that become **Custom** as soon as you fine-tune a control
- one centralized **Preview dashboard** action at the bottom of Settings so visual changes can be checked without repeating preview controls throughout the page
- expand/collapse controls
- contextual `?` help tips
- live saved/unsaved state

If you know a word but not the category, Settings search is usually faster than hunting manually. Search opens a dedicated results workspace, ranks setting names and aliases ahead of broader section context, searches advanced controls even while Essentials is selected, and understands common alternate words such as dog, puppy, pet, companion, wind, and forecast. Matching settings show their category and section path, safe current values, and an expandable **Quick edit** control when inline editing makes sense. Press **Enter** from the search box to open the best match, or **Esc** to clear the search and return to the category you were using.

### Favorites and Modified only

Use the star control beside any setting to place it in **Favorites**. Favorites is the last item in the first Start here group, so frequently used controls stay close without changing the organization of the full Settings tree. Favorites are live proxies for the original controls; changing a favorite changes the real setting. Use the up/down actions to organize the bucket.

Use **Modified only** when you want to see what differs from LibreDisplay defaults. Modified controls are marked in their normal sections as well. Reset actions stay at meaningful section, preset, or feature boundaries instead of being repeated beside every individual control.

### Sliders and presets

Range controls keep the ordinary slider for quick adjustment and add a precise numeric field without cluttering every row with another reset button. Where a section has presets, treat them as starting points rather than locked modes: choosing a preset fills the controls, and changing any individual value turns that section into **Custom**.

---

## Home

Use Home for orientation and common tasks.

Typical reasons to open it:

- check overall setup state
- see shortcuts into common configuration areas
- confirm save state
- rerun or revisit guided setup
- review current project/release information

If an installation was restored or migrated and you do not know what is configured, Home is the safest starting point.

---

## Device & Performance

This category is about the hardware driving the actual display.

It includes:

- detected hardware guidance
- Raspberry Pi 3 / Pi 4 / Pi 5 recommendations
- Lightweight mode
- animation performance mode
- Pi 3 static-scene refresh cadence
- performance status and measured behavior

### Lightweight mode

Lightweight mode is a temporary relief switch. It suppresses expensive visual behavior without deleting your saved preferences. Turn it off and the saved visual settings return.

Use it when:

- a display suddenly struggles
- you need to isolate whether the problem is visual load
- you are testing an older Pi

### Animation performance

Automatic is the recommended default.

Pi 3 Automatic prioritizes high-quality static scenery rather than continuous expensive animation. Pi 4 has adaptive pacing with more headroom. Pi 5 generally has more motion budget.

Do not force maximum fidelity merely because a remote laptop looks smooth; the physical kiosk hardware is what matters.

---

## Layout

Layout is where broad arrangement and exact geometry meet.

Use it for:

- starter templates
- dashboard element sizing
- geometry/range behavior
- entering Arrange mode
- positioning and sizing blocks
- exact layout relationships

Use templates first when you want a clean base. Use Arrange mode second for exact placement.

---

## Personalization

Personalization covers the general visual language of the dashboard and Settings interface.

It includes:

- theme and typography
- text/panel appearance
- accessibility preferences
- language-related presentation
- Settings interface size

Use Personalization for broad look-and-feel choices rather than exact block geometry.

---

## Backgrounds

Background settings cover the source and behavior of the large dashboard background.

They can include:

- stock images
- supported photo sources
- local folders
- NAS folders
- slideshow order
- rotation timing
- recursive media discovery
- preloading
- motion/video allowance
- offline reserve behavior
- background blur and appearance

### Troubleshooting advice

If a dashboard starts stuttering, video or moving backgrounds are one of the first things to disable temporarily. This isolates background decoding/compositing from weather/NatureScape load.

If a local/NAS background is blank, verify the mount/path before changing visual settings.

---

## Calendars

Calendars covers calendar sources and how events participate in the dashboard.

Typical controls include:

- ICS feed URLs
- local `.ics` data
- source labels and colors
- enable/disable state
- ordering
- refresh behavior
- event range/count behavior

### Event rules

Open **Calendars > Event rules** for no-code event presentation rules. A rule can match an event title, calendar, location, or all-day state and can hide the match, add a short prefix such as an emoji, recolor it, or change emphasis. Rules affect LibreDisplay presentation only; they do not edit the source calendar.

Calendar presentation also has Compact, Balanced, and Roomy starting points. These presets never lock the individual event spacing, padding, corner radius, title size, time size, or line-height controls.

### When events are missing

Check in this order:

1. feed enabled
2. feed URL/source still valid
3. feed test/check result
4. timezone expectations
5. display range/event-count filters
6. layout visibility

---

## Holidays

Holidays sits beside Calendars in the **Calendar & Holidays** Settings bucket so date-based features are kept together instead of being mixed with the dog companion.

### Calendar holidays & observances

Built-in calendar add-ons are off by default. The master add-on control governs participation without erasing the detailed choices underneath. Each category has an editable label and default color. Open a category to hide individual dates, rename them for your household, or give a specific date its own color while keeping the rest of the category enabled.

Built-in groups include civic holidays and observances, Christian dates, Jewish dates, Islamic dates, astronomy and clock changes, and cultural or seasonal dates.

### Holiday overlays & scenes

Holiday overlays are optional special-day scenery. Enable the master switch, choose the holidays LibreDisplay may celebrate, adjust overlay intensity, and use Holiday Test to preview a scene without changing the system date.

Calendar add-ons control which built-in dates appear as calendar events. Holiday overlays control special-day visual scenery. They are related by date, but each can be enabled and customized independently.

---

## Weather

Weather contains data-oriented weather preferences rather than the full visual effect system.

Use it for:

- location
- units
- current-condition preferences
- forecast presentation choices
- weather detail fields
- refresh behavior

If the location is wrong, reselect the geographic result. Editing only the display label does not change coordinates.

---

## Weather Effects

Weather Effects controls the visual atmosphere drawn around the dashboard.

Areas include:

- rain
- snow
- fog and mist
- sky/cloud/sun/wind behavior
- thunderstorms and lightning
- preview/test behavior

These effects are separate from weather data. You can keep a forecast visible while reducing or disabling expensive fullscreen visuals.

LibreDisplay maps the full Open-Meteo/WMO condition set used by the dashboard, including freezing drizzle and freezing rain. In Pi 3 Automatic mode, the fullscreen weather scene is intentionally static between synchronized scene refreshes: rain, snow, fog, clouds, storm structure, and other atmospheric layers are placed across the window and reseeded with the same scene timer used by NatureScape. Rain, freezing rain/drizzle, snow, and storms replace seasonal leaves/grass while active. Pi 4 and Pi 5 Automatic modes keep their animated weather paths, including moving precipitation, cloud/fog motion, and storm atmosphere.

---

## Weather Alerts

Weather Alerts controls severe-weather messaging and hazard-scene behavior.

It includes:

- alert enablement
- severity filtering
- card behavior
- motion/scroll presentation
- alert appearance
- hazard previews
- flood/wind scenes
- major storm scenes
- visibility/heat/fire-weather presentation

Use test/preview behavior to tune presentation instead of waiting for a real alert.

On Pi 3 Automatic mode, severe-weather scenes follow the same synchronized static-scene refresh cadence as normal weather overlays and remain still between refreshes. Pi 4 and Pi 5 retain animated hazard scenes. Weather-driven scenes that conflict with seasonal foliage suppress leaves and grass while the hazard is active.

Hazard visuals should never be treated as a substitute for official safety instructions from local authorities.

---

## Nature & Seasons

Nature & Seasons controls seasonal and environmental decorative behavior.

It includes areas such as:

- NatureScape behavior
- leaves
- grass
- petals
- winter atmosphere
- seasonal density/intensity

These controls can add substantial motion. If you are diagnosing performance, reduce the highest-motion categories one at a time rather than changing everything simultaneously.

---

## Wildlife

Wildlife controls animated ambient creatures and regional behavior.

Areas include:

- bees and butterflies
- fireflies
- dragonflies
- ladybugs
- moths
- birds
- regional wildlife
- owls

On Pi hardware, wildlife density and motion interact with the rest of NatureScape and weather rendering. Use Automatic performance mode unless you have measured the physical display and know the available headroom.

---

## Companion

Companion is dedicated to the dog so its controls stay separate from calendar and holiday features.

This category controls:

- dog companion behavior
- dog breed and appearance options
- accessories
- activity and behavior weighting
- weather and shelter behavior

### Dog behavior mix

The simple **Companion activity** control still changes the dog's overall pace. In **All** settings, **Dog behavior mix** adds independent frequency controls for rest, sit, sleep, sniff, watching surroundings, wandering, inspecting the dashboard, surveying the room, stretching, scratching, digging, rolling over, fetch/chase-ball play, and bird watching/chasing.

`100%` is LibreDisplay's natural weighting, `0%` disables that behavior, and higher values make it more likely. Calm, Natural, Playful, and Very active are editable starting presets; changing any behavior immediately makes the mix **Custom**. Use the single **Preview dashboard** action at the bottom of Settings to check the overall companion presentation without adding a Preview button to every behavior row.

The dog is a presentation feature; it should not affect weather data itself.

---

## Family

Family features support household-oriented wall-board behavior.

They can include:

- household members
- chores
- points
- rewards
- optional PIN protection
- touch-friendly Family blocks

Use Arrange mode to add/configure the Family Chores block on a touch display.

---

## Integrations

Integrations is where external/local providers are configured and tested.

LibreDisplay supports a mixture of:

- local/self-hosted sources
- no-key public sources
- account-based services
- API-key services

The interface should tell you what a provider requires before you enable it.

Do not expose API keys or private feed URLs in screenshots or issue reports.

A provider can be configured correctly yet temporarily unavailable because of the provider's network/API state. Use integration health/testing before assuming the dashboard renderer is broken.

---

## Display Care

Display Care is intentionally granular so always-on display protection is not one all-or-nothing mode.

Independent controls can include:

- pixel shifting
- idle dimming
- Quiet Hours
- deep-black / 0% protection
- temporary wake behavior
- motion suppression while dimmed
- timing and intensity controls

Example: you can enable pixel shifting all day while leaving Quiet Hours disabled.

For OLED users, combine the protections that match the room and screen instead of blindly enabling every option.

Pixel shift moves the complete persistent dashboard presentation, including fullscreen weather/NatureScape and fixed status controls. Quiet Hours only wakes on local input when **Temporarily wake on local input during quiet hours** is enabled. Deep brightness at 0% renders a fully black software output; it does not power off the monitor or replace the display manufacturer's own panel-care features.

---

## Displays & Access

This Owner-only category combines multi-display administration and access control.

It includes:

- display endpoints
- Remote Access
- Add Owner Device
- QR/connection-code enrollment
- authorized Owner devices
- named accounts
- Display Links
- Profiles
- Scenes and schedules
- family/touch-related display configuration where applicable

Remember:

- endpoints are dashboards
- Owner devices are trusted browsers
- accounts are people/roles
- Display Links are read-only credentials
- Profiles are reusable dashboard snapshots
- Scenes schedule Profile application

---

## System & Maintenance

This Owner-only category covers the host and maintenance layer.

Areas include:

- Raspberry Pi host mode
- display readiness and kiosk resilience
- System Health
- full-device restart
- update controls
- update history and rollback
- backup and recovery
- utilities
- provider/data-source health
- physical-display diagnostics

This is where you go when the question is “is LibreDisplay itself healthy?” rather than “how should my dashboard look?”

---

## Multi-display customization without overwriting everything

For homes with more than one LibreDisplay screen, **Displays & Access** can copy only one settings section from one display to another. This is useful when you want to share calendars, weather, backgrounds, companion settings, or another group without replacing the target display's unrelated layout and preferences.

A secondary display can also follow selected **Main** sections as household defaults. Inherited sections are labeled **Inherited from Main**. Editing an inherited section on the secondary display automatically makes that section local again, so inheritance never traps the user in a parent configuration.

---

## Settings habits that prevent mistakes

- use Settings search instead of guessing a category
- confirm the active display before making display-specific changes
- save a Profile before large layout changes
- change one performance-heavy category at a time while diagnosing
- use test/preview controls for alerts/weather rather than waiting for live conditions
- verify the target physical screen after remote layout changes
- use Owner-only maintenance controls carefully when connected remotely

</details>

<a id="arrange-mode"></a>
<details>
<summary><strong>7. Arrange mode and dashboard design</strong><br>Move, size, align, and customize dashboard blocks without losing a known-good layout.</summary>

## Arrange mode workflow

A reliable layout workflow is:

1. make sure weather/calendars/integrations are working
2. choose theme and broad appearance
3. save a Profile
4. enter Arrange mode
5. position and resize elements
6. verify on the physical target display
7. save another Profile when the layout reaches a milestone

This avoids confusing data-source problems with geometry problems.

---

## Flow versus free placement

Flow-style layout behavior is safer for unattended displays because elements participate in predictable relationships.

Free placement is useful when you intentionally need exact coordinates or overlap, but it can create conflicts if several blocks occupy the same region.

Selecting an element does not automatically mean you should put it into free placement.

---

## Geometry

Arrange mode can expose controls such as:

- X position
- Y position
- width
- height
- layer/Z order
- gap
- alignment
- justification
- quick-position presets

For unusual aspect ratios, verify the layout on the real target. A remote administration browser can have very different dimensions from the wall display.

---

## Editing visible content

Some integration blocks allow local overrides for visible text, links, or image alt text.

Use overrides when you deliberately want presentation different from the live/provider value. Use the reset option to return to the provider's current data.

Unsafe executable URLs are rejected.

---

## Common layout mistakes

### Editing the wrong display

Confirm the active endpoint before moving anything.

### A Scene keeps changing the layout

Check whether a scheduled Scene is applying another Profile.

### Remote layout looks fine but physical display does not

Use the target display as the final authority. Physical screen size, browser viewport, hardware class, and display scaling can differ.

### Too many changes at once

Save Profiles at milestones so you can compare clean states instead of trying to reverse dozens of small edits manually.

</details>

<details>
<summary><strong>8. Integrations and data providers</strong><br>Understand provider types, credentials, health checks, privacy boundaries, and the bundled provider ecosystem.</summary>

## Provider model

LibreDisplay integrations fall into several broad classes:

- local/self-hosted service
- public/no-key service
- account OAuth/token-style service
- API-key service
- private feed or local file

Each provider has different reliability and privacy characteristics. A provider outage is not necessarily a LibreDisplay outage.

---

## Bundled integration families

The release includes provider modules for services and data categories such as:

### Tasks and productivity

- Asana
- Google Tasks
- Microsoft To Do
- Todoist
- Trello
- CalDAV tasks
- Slack messages

### Photos and media

- Dropbox Photos
- Box Photos
- OneDrive Photos
- Flickr Photos
- iCloud shared photos
- Spotify now playing
- Sonos now playing
- Grateful Dead / Deadhead content

### Finance and reference data

- Alpha Vantage
- CoinGecko
- Frankfurter currency data

### Travel and transit

- Aviationstack
- GTFS Realtime
- Mapbox travel
- OpenStreetMap
- OSRM travel
- AfterShip

### Weather, environment, and location data

- Google Pollen
- Open-Meteo Pollen
- Open-Meteo UV
- NOAA tides
- Weather Company personal weather station support

### Home and custom APIs

- Home Assistant
- generic Web API integration

The exact credentials or account requirements vary by provider. Use the Settings integration description and health/test controls as the source of truth for a specific provider.

---

## Integration troubleshooting order

1. confirm the integration is enabled
2. confirm required credentials/URLs are present
3. run the provider health/test control
4. check network/DNS reachability
5. check provider service status separately if possible
6. confirm the dashboard block is enabled and visible
7. only then investigate layout/rendering

---

## Credential safety

Treat these as secrets:

- API keys
- OAuth/access tokens
- private calendar URLs
- private photo-share credentials
- custom Web API credentials
- Display Links
- backup files containing configuration

Do not include them in screenshots or public bug reports.

</details>

<a id="terminal-and-ssh-reference"></a>
<details>
<summary><strong>9. Terminal and SSH reference</strong><br>Complete `libredisplay` command reference with practical examples, safe defaults, and recovery use cases.</summary>

## Discover commands

```bash
libredisplay --help
```

For one command:

```bash
libredisplay <command> --help
```

---

## `libredisplay status`

```bash
libredisplay status
```

Shows the installed version, server status, host mode, kiosk state, basic hardware information when available, and Remote Access state.

Use this first after SSHing into an unfamiliar or malfunctioning host.

---

## `libredisplay addresses`

```bash
libredisplay addresses
```

Shows stable LAN/VPN addresses used to reach LibreDisplay.

By default, credential-bearing read-only Display Links are hidden.

To intentionally print them:

```bash
libredisplay addresses --include-display-links
```

Treat the resulting Display Links as credentials.

---

## `libredisplay connect`

Create a short-lived one-time Owner-device connection code:

```bash
libredisplay connect
```

Enable Remote Access first if necessary:

```bash
libredisplay connect --enable-remote
```

Machine-readable output:

```bash
libredisplay connect --json
```

Include the direct temporary-code URL:

```bash
libredisplay connect --show-direct
```

The direct URL contains the temporary code. The normal stable `/connect` address does not authorize a device by itself.

---

## `libredisplay remote`

```bash
libredisplay remote status
libredisplay remote on
libredisplay remote off
```

Remote Access is designed for trusted LAN/private-VPN clients only.

---

## `libredisplay server-only`

```bash
libredisplay server-only status
libredisplay server-only on
libredisplay server-only off
libredisplay server-only enable
libredisplay server-only disable
```

`on`/`enable` keep the server running but stop/prevent the managed local Chromium dashboard. `off`/`disable` restore Display + server mode.

---

## `libredisplay display-mode`

```bash
libredisplay display-mode kiosk
libredisplay display-mode windowed
```

Switches the managed local Pi browser between fullscreen kiosk and windowed device-use mode.

This applies to the native Pi display manager, not to remote browsers.

---

## `libredisplay doctor`

```bash
libredisplay doctor
```

Runs quick installation and runtime checks such as:

- required installation files
- writable data directory
- local `/healthz`
- system-health API
- host mode
- startup integrity

Use `doctor` before manually editing internal files.

---

## `libredisplay logs`

Browser log:

```bash
libredisplay logs
```

More lines:

```bash
libredisplay logs --lines 300
```

Update log:

```bash
libredisplay logs --type update
```

Rollback log:

```bash
libredisplay logs --type rollback
```

---

## `libredisplay backup`

Create a sensitive `.ldbackup` archive:

```bash
libredisplay backup
```

Choose a destination:

```bash
libredisplay backup /path/to/my-backup.ldbackup
```

Include LibreDisplay-managed host configuration when appropriate:

```bash
libredisplay backup --include-host
```

Host-level backup material may require elevated privileges.

---

## `libredisplay restore`

Verify without changing files:

```bash
libredisplay restore /path/to/backup.ldbackup --verify-only
```

Restore interactively:

```bash
libredisplay restore /path/to/backup.ldbackup
```

Non-interactive confirmation:

```bash
libredisplay restore /path/to/backup.ldbackup --yes
```

Restores can replace active configuration. Keep a copy of the current state when possible.

---

## `libredisplay check`

```bash
libredisplay check
```

Checks GitHub for a newer supported LibreDisplay release.

---

## `libredisplay update`

```bash
libredisplay update
```

Creates recovery material, validates the new release, and updates LibreDisplay.

Skip the normal reboot step:

```bash
libredisplay update --no-reboot
```

Headless SSH updates keep server availability in mind even when the current SSH session cannot launch a graphical kiosk.

---

## `libredisplay field-check`

One immediate sample:

```bash
libredisplay field-check --once
```

Longer sampling:

```bash
libredisplay field-check --duration-minutes 60 --interval-seconds 15
```

Strict long-running release field gate:

```bash
libredisplay field-check --release-gate
```

Resume an interrupted soak:

```bash
libredisplay field-check --resume
```

Useful options also include `--label` and `--output`.

Field checks are designed for privacy-safe physical-display readiness/performance evidence.

---

## `libredisplay version`

```bash
libredisplay version
```

Prints the installed LibreDisplay version.

---

## SSH quick-reference table

| Task | Command |
| --- | --- |
| Overall status | `libredisplay status` |
| Quick diagnostics | `libredisplay doctor` |
| Connection addresses | `libredisplay addresses` |
| New Owner code | `libredisplay connect` |
| Remote Access status | `libredisplay remote status` |
| Enable Remote Access | `libredisplay remote on` |
| Disable Remote Access | `libredisplay remote off` |
| Server-only status | `libredisplay server-only status` |
| Enable Server-only | `libredisplay server-only on` |
| Disable Server-only | `libredisplay server-only off` |
| Windowed local browser | `libredisplay display-mode windowed` |
| Kiosk local browser | `libredisplay display-mode kiosk` |
| Browser log | `libredisplay logs` |
| Update log | `libredisplay logs --type update` |
| Backup | `libredisplay backup` |
| Check for update | `libredisplay check` |
| Install update | `libredisplay update` |

</details>

<a id="maintenance-and-recovery"></a>
<details>
<summary><strong>10. Maintenance, backup, update, rollback, and recovery</strong><br>Protect your configuration, update safely, verify backups, and recover from interrupted or failed maintenance.</summary>

## Understand the recovery layers

LibreDisplay has several different recovery tools. They solve different problems.

### Profile

Best for:

- layout rollback
- presentation experiments
- reusing a dashboard design

### Previous settings / restore point

Best for:

- recent configuration mistakes
- local settings rollback where available

### `.ldbackup`

Best for:

- server migration
- major update safety
- configuration/data recovery
- infrastructure changes

### Updater rollback material

Best for:

- failed application update
- interrupted replacement of application files

Do not use one recovery layer as a substitute for every other layer.

---

## Before major changes

Recommended sequence:

```bash
libredisplay status
libredisplay backup
libredisplay check
```

Also save a Profile when the upcoming work includes layout changes.

Keep important backup archives somewhere other than the Pi itself.

---

## Verify a backup before you need it

```bash
libredisplay restore /path/to/backup.ldbackup --verify-only
```

A backup you have never successfully verified is less useful than one you know LibreDisplay can read.

---

## Restart the entire device

From **Settings > System & Maintenance > Restart device**, an Owner can request a full host reboot on native LibreDisplay installations. This is different from refreshing the dashboard or restarting Chromium: the operating system itself restarts, so the local display and remote Settings are unavailable briefly. LibreDisplay asks for confirmation before sending the reboot request. Docker and source/development deployments leave host restart to the host administrator.

From SSH, the equivalent host-level action is the normal operating-system reboot command.

---

## Update

```bash
libredisplay check
libredisplay update
```

The native updater validates release structure and startup-critical files and keeps rollback/recovery state around the application swap.

If preparation, staging, or validation fails, the updater attempts to preserve/restore the previously working runtime rather than turning a failed update into unnecessary downtime.

---

## Interrupted update

LibreDisplay checks update transaction/recovery state during startup. If power was lost at the wrong time, the recovery path can use the verified pre-update snapshot rather than blindly continuing with a partially replaced installation.

Do not delete rollback directories or transaction markers immediately after an update problem; they may be part of the recovery mechanism.

---

## Update from headless SSH

`libredisplay update --no-reboot` is useful when you are maintaining a Server-only or remote host.

A headless SSH environment may not have a usable graphical session for Chromium. LibreDisplay distinguishes “server can restart” from “browser can launch right now” so the host can come back online without pretending a GUI is available in the SSH session.

---

## Server-only recovery

```bash
libredisplay server-only status
libredisplay server-only off
```

If the server is healthy and the local screen is intentionally disabled, this is the correct recovery path.

---

## Remote Access recovery

```bash
libredisplay remote status
libredisplay remote on
libredisplay connect
```

Use this when the wall display is inaccessible but SSH still works.

---

## Basic server recovery

```bash
libredisplay doctor
curl http://127.0.0.1:8787/healthz
```

If `/healthz` is healthy but the local screen is not rendering, focus on host mode, Chromium, graphics/session state, and browser logs instead of server configuration.

---

## When to restore a full backup

A full restore is appropriate when:

- configuration/data is genuinely damaged
- migrating to another host
- a previous known-good state is preferable to continued manual repair
- server-level state changed beyond what a Profile can restore

Before restoring, verify the archive and understand what will be replaced.

</details>

<a id="performance-and-device-guidance"></a>
<details>
<summary><strong>11. Performance, Raspberry Pi guidance, and display care</strong><br>Tune Pi 3/4/5 systems, diagnose stutter, use Lightweight mode, and protect always-on displays.</summary>

## General rule

Measure the physical display, not the administration computer.

A powerful laptop opening Settings remotely says very little about how smoothly a Pi-driven wall display is rendering.

Use System Health, physical-display diagnostics, and the bottleneck/performance tooling when performance matters.

---

## Raspberry Pi 3

Prioritize stability.

Recommended starting point:

- Automatic performance mode
- static full-quality weather/NatureScape scenery with scene-refresh dog repositioning
- moderate static-scene refresh cadence
- no video background while diagnosing
- conservative wildlife/motion density

Pi 3 Automatic is designed to remove continuous scene-motion cost without reducing artwork quality. Weather, severe-weather, leaves, grass, wildlife, and the dog remain static between the configured scene refreshes. Outside shelter conditions the dog is placed at a new safe position when the scene refreshes, which gives the impression that it wandered while avoiding low-quality walking animation. During rain, snow, storms, and severe-weather scenes, leaves and grass are hidden and the dog can remain safely sheltered in its home without changing shelter position.

Troubleshooting order:

1. disable video/moving backgrounds
2. enable Lightweight mode temporarily
3. reduce fullscreen weather/NatureScape motion
4. reduce wildlife/seasonal density
5. inspect System Health
6. run the physical-display bottleneck test

---

## Raspberry Pi 4

Pi 4 has more headroom, but combined load still matters.

Heavy combinations can include:

- large custom layouts
- video backgrounds
- forecast strips
- fullscreen weather overlays
- NatureScape motion
- many wildlife actors
- several translucent/blurred panels

Automatic performance mode is the recommended default because it can adapt pacing to measured headroom. Pi 4 Automatic keeps animated weather and severe-weather overlays active; precipitation and cloud/fog motion are not replaced by the Pi 3 static-scene model.

---

## Raspberry Pi 5

Pi 5 generally supports richer motion and denser presentation while maintaining good headroom. Automatic mode retains animated weather and severe-weather overlays, including moving precipitation, cloud/fog motion, and storm atmosphere.

Avoid using the extra hardware as a reason to duplicate unnecessary animation layers. Stable unattended rendering is still the priority.

---

## Server-only Pi

Server-only removes the local Chromium rendering workload, but the Pi still performs server work such as:

- provider refreshes
- integrations
- schedules
- backup/update operations
- serving multiple browsers

A Server-only Pi can therefore be much lighter graphically while still having normal CPU/network/storage work.

---

## Lightweight mode

Lightweight mode is a diagnostic and relief switch, not a destructive reset.

It temporarily suppresses expensive visual features while preserving the selected settings underneath.

If performance improves immediately with Lightweight mode, re-enable it and then reduce expensive categories one at a time to find the actual bottleneck.

---

## OLED and always-on display care

LibreDisplay keeps protection controls independent so you can choose the strategy appropriate to the display.

Options can include:

- pixel shifting
- idle dimming
- Quiet Hours
- deep-black / 0% behavior
- temporary wake behavior
- motion suppression while dimmed
- delay/intensity controls

Example strategies:

**Low intervention**  
Pixel shifting enabled, Quiet Hours disabled.

**Night protection**  
Pixel shifting plus Quiet Hours and deeper overnight dimming.

**Aggressive static-content protection**  
Pixel shifting, idle dimming, deeper black behavior, and reduced motion when dimmed.

Choose based on the actual panel and room rather than enabling everything automatically.

</details>

<a id="server-deployments"></a>
<details>
<summary><strong>12. Docker, NAS, local media, and server deployments</strong><br>Run LibreDisplay without the native Pi kiosk, keep persistent data safe, and connect local/NAS media.</summary>

## Docker behavior

Docker deployments serve LibreDisplay but do not use the native Pi Chromium/kiosk manager.

A typical LAN-oriented setup uses:

```bash
chmod +x scripts/docker-setup.sh
./scripts/docker-setup.sh --lan
```

Maintenance examples:

```bash
./scripts/docker-setup.sh update
./scripts/docker-setup.sh backup
```

The native Raspberry Pi Server-only toggle is intentionally unsupported in deployments that have no native kiosk manager; those hosts are already effectively server-only.

---

## Persistent data

For Docker/NAS deployments, configuration must live in the configured persistent volume/mapping.

Do not store important LibreDisplay state only inside an ephemeral container layer. Replacing that container can remove anything that was not mapped persistently.

---

## Local media

Native installs include a local media helper:

```bash
~/libredisplay/scripts/setup-media.sh
```

Use it when you want LibreDisplay to read local media folders in a supported way.

---

## NAS media

Native installs include:

```bash
~/libredisplay/scripts/setup-nas.sh
```

Use it to establish supported NAS access/mount behavior rather than manually inventing a path and then troubleshooting permissions later.

If a previously working NAS background becomes blank, confirm the mount is still present and readable before changing slideshow or visual settings.

---

## One server, several display devices

A useful server deployment pattern is:

```text
Server-only Pi / Docker host
├── read-only Living Room screen
├── read-only Kitchen screen
├── read-only Office screen
└── trusted Owner laptop/phone
```

Use separate endpoints and Display Links for the viewers, then keep administration on Owner devices.

</details>

<a id="troubleshooting-by-symptom"></a>
<details>
<summary><strong>13. Troubleshooting by symptom</strong><br>Decision-oriented diagnosis for blank screens, network failures, Owner enrollment, data sources, performance, updates, Docker, and configuration problems.</summary>

## Troubleshooting method

When possible, answer these questions in order:

1. Is the LibreDisplay server running?
2. Is the problem only the local browser, or all clients?
3. Is the correct display endpoint being viewed/edited?
4. Is the data source healthy?
5. Is the content present but hidden by layout/presentation?
6. Is the issue performance-related?
7. Did the problem begin after an update, restore, host change, or network change?

This prevents a visual problem from turning into unnecessary configuration surgery.

---

## Nothing appears on the Pi screen

Check whether the blank screen is intentional:

```bash
libredisplay status
libredisplay server-only status
```

If Server-only is on and you want the local display:

```bash
libredisplay server-only off
```

If Server-only is off:

```bash
libredisplay doctor
libredisplay logs --lines 200
curl http://127.0.0.1:8787/healthz
```

Healthy `/healthz` plus a missing local display points toward Chromium/display-session/graphics behavior rather than a dead server.

---

## The server cannot be reached from another device

On the host:

```bash
libredisplay status
libredisplay remote status
libredisplay addresses
```

Then check:

- both devices are on the same trusted LAN/private VPN
- firewall/router client isolation is not blocking local traffic
- Remote Access is enabled when administration is required
- a numeric private-LAN address works if `.local` does not

Do not “fix” this by forwarding the LibreDisplay port to the public Internet.

---

## `.local` does not resolve

Run:

```bash
libredisplay addresses
```

Use a numeric LAN address printed there.

mDNS/`.local` reliability depends on the network and client operating system; failure to resolve `.local` does not necessarily mean LibreDisplay is down.

---

## I need a new Owner device but cannot use the wall display

```bash
libredisplay remote on
libredisplay connect
```

Open the printed stable `/connect` address on the new trusted device and enter the code.

---

## The Owner code is invalid or expired

Generate another:

```bash
libredisplay connect
```

One-time codes are meant to fail after expiry, redemption, cancellation, or server restart.

---

## QR appears but scanning does not complete enrollment

Try the manual path:

1. note the one-time code
2. run `libredisplay addresses` if needed
3. open a stable `/connect` address manually
4. type the code

This separates camera/QR handling from LibreDisplay enrollment itself.

---

## Settings changes are not visible on the intended screen

Check:

- active display endpoint
- save state
- target browser refresh/reconnect
- Profile currently applied
- scheduled Scene that may be reapplying a Profile
- whether you changed broad Appearance but later Arrange-mode overrides are still active

---

## Calendar does not update

Check in order:

1. source enabled
2. feed URL still valid
3. feed check/test result
4. provider/network status
5. timezone expectations
6. event range/count filters
7. calendar block visible in layout

Temporarily reduce to one calendar source if several feeds are configured.

---

## Weather location is wrong

Search again and choose the exact region/country match. Changing the visible label does not change coordinates.

---

## Background is blank

Check:

- selected source type
- provider/network access for remote sources
- local/NAS path still exists
- NAS mount still active
- file permissions
- whether the source has usable images/video

Temporarily switch to a stock/static background. If stock works, the dashboard renderer is probably fine and the problem is source-specific.

---

## Pi display is stuttering

Try:

1. Lightweight mode
2. disable video/moving backgrounds
3. reduce fullscreen weather/NatureScape effects
4. reduce wildlife density
5. check System Health for throttling/software rendering
6. check temperature/power quality
7. run physical-display performance/bottleneck diagnostics

Change one major category at a time so the result is measurable.

---

## Browser keeps restarting

```bash
libredisplay logs --lines 300
libredisplay doctor
```

Also inspect System Health for graphics profile, kiosk heartbeat, recovery events, and throttling information.

---

## Update failed

```bash
libredisplay logs --type update
libredisplay logs --type rollback
```

Do not immediately delete update transaction or rollback material.

Run:

```bash
libredisplay doctor
libredisplay status
```

The v1.12.x updater is designed to restore the previously working runtime when update preparation/staging/validation fails.

---

## Configuration seems corrupted

Before editing JSON manually:

1. run `libredisplay doctor`
2. identify whether only one display/Profile is wrong
3. use previous-settings/restore-point tools when appropriate
4. verify a known-good backup
5. restore the backup only when you understand the scope

Manual file editing should be the last option, not the first.

---

## Docker starts but configuration is missing

Check the persistent volume/mapping. Data stored only in the old container layer disappears when that container is replaced.

---

## Remote Access should be reset completely

Use **Reset all remote credentials** from Owner Settings.

This resets Remote Access credentials without deleting normal weather, layout, media, appearance, or calendar configuration.

---

## The Help guide says a command exists but the host does not recognize it

Check the installed version:

```bash
libredisplay version
```

Then verify the CLI path:

```bash
command -v libredisplay
```

If the application was upgraded but host-installed CLI files are stale, inspect the update log and run the supported update/recovery path rather than copying random scripts between release directories.

</details>

<a id="privacy-and-security"></a>
<details>
<summary><strong>14. Privacy, security, credentials, and data boundaries</strong><br>Know what stays local, what contacts external providers, and which URLs/files must be protected.</summary>

## Local-first model

LibreDisplay is self-hosted and does not require a LibreDisplay cloud identity.

Configuration, Owner-device authorization state, Profiles, Scenes, backups, and other server data live with your installation unless you intentionally move, synchronize, or back them up elsewhere.

---

## External providers

Weather, calendars, photos, task services, music services, maps, transit, and other integrations necessarily contact the provider you configure.

A self-hosted LibreDisplay server does not make those third-party services local. Review each provider's own privacy and credential requirements.

---

## Treat these as secrets

- Display Links
- direct one-time enrollment URLs while valid
- named-account passwords
- API keys
- OAuth/access tokens
- private calendar subscription URLs
- private photo-source credentials
- `.ldbackup` files containing sensitive configuration

The stable `/connect` address without a code is not sufficient to authorize a new Owner by itself.

---

## Recommended security posture

- trusted LAN or private VPN only
- no direct public port forwarding
- use read-only Display Links for unattended screens
- use Viewer/Editor roles where Owner is unnecessary
- revoke retired Owner devices
- protect backup files
- keep the host updated
- keep SSH recovery available for Server-only deployments

---

## If remote access from outside home is required

Use a private VPN that places your trusted device onto the private network. Do not expose LibreDisplay directly to the public Internet merely to make the URLs reachable from anywhere.

</details>

<a id="task-recipes"></a>
<details>
<summary><strong>15. Task recipes, operating tips, glossary, and quick reference</strong><br>Common tasks, useful habits, plain-English terminology, and a quick recovery card.</summary>

## Recipe: one Pi, one wall display

1. Install on Raspberry Pi OS Desktop.
2. Use Display + server mode.
3. Complete weather/calendar/background setup.
4. Enable Remote Access.
5. Enroll your laptop or phone as an Owner device.
6. Save a Profile.
7. Create a backup.
8. Mount the display and use remote administration afterward.

---

## Recipe: one server-only Pi, several screens

On the server Pi:

```bash
libredisplay remote on
libredisplay connect
libredisplay server-only on
libredisplay addresses
```

Then:

1. enroll an Owner laptop/phone
2. create the required display endpoints
3. create read-only Display Links for the viewers
4. open those links on each screen device
5. name endpoints clearly
6. use Profiles for shared designs
7. use Scenes only after the baseline displays are stable

---

## Recipe: recover a server-only Pi when all Owner browsers are gone

SSH to the Pi:

```bash
libredisplay status
libredisplay remote on
libredisplay connect
```

Enroll a new Owner device.

If you also want the Pi's own screen back:

```bash
libredisplay server-only off
```

---

## Recipe: performance diagnosis without destroying your design

1. Save a Profile.
2. Turn on Lightweight mode.
3. Observe whether performance improves.
4. Turn Lightweight mode back off.
5. Disable video/moving backgrounds.
6. Reduce weather/NatureScape motion.
7. Reduce wildlife density.
8. Check System Health.
9. Run the target-display performance test.
10. Re-enable features one at a time.

This preserves the original configuration and identifies the real load source.

---

## Recipe: prepare for an update

```bash
libredisplay status
libredisplay backup
libredisplay check
libredisplay update
```

Also save a Profile if you have recently changed the dashboard layout.

---

## Recipe: migrate to another host

1. create and verify a `.ldbackup`
2. record NAS/local-media mount requirements
3. install the matching/supported LibreDisplay release on the new host
4. restore the backup using supported tooling
5. verify server health
6. verify Remote Access
7. verify all endpoints/integrations
8. update viewer devices only after the new host is confirmed

---

## Recipe: troubleshoot one broken integration

1. leave the rest of LibreDisplay alone
2. open the integration's Settings entry
3. test provider health
4. verify credentials/URL
5. verify network reachability
6. confirm the corresponding block is visible
7. only then inspect layout or rendering

---

## Operational tips

### Keep one emergency SSH path

This is especially important for Server-only installations.

### Name everything clearly

Use names that identify purpose and location rather than browser type or hardware model.

### Save Profiles before experiments

Profiles make layout experimentation much less stressful.

### Keep full backups off the Pi

A backup on the same failing storage device is not enough for disaster recovery.

### Diagnose by subtraction

Disable one expensive or suspicious component at a time. Ten simultaneous changes destroy useful evidence.

### Use read-only viewer credentials for unattended displays

Do not give every wall screen Owner rights.

### Prefer stable connection addresses

For manual enrollment, use the stable `/connect` address plus the separate one-time code rather than saving temporary direct-code URLs.

---

## Glossary

**Display endpoint**  
A named dashboard configuration served by the LibreDisplay server.

**Owner device**  
A trusted browser with administrative authorization created through one-time enrollment.

**Display Link**  
A read-only credential scoped to a display endpoint.

**Profile**  
A reusable dashboard/configuration snapshot used for repeatable presentation and quick rollback.

**Scene**  
A server-side scheduled application of Profiles.

**Display + server**  
Native Pi mode where the host runs both the server and the managed local Chromium dashboard.

**Server-only**  
Native Pi mode where the host runs the server but not the managed local Chromium dashboard.

**Lightweight mode**  
A temporary suppression of expensive visual behavior that preserves your saved visual choices underneath.

**Restore point / previous settings**  
A configuration-oriented recovery mechanism distinct from a full `.ldbackup`.

**`.ldbackup`**  
LibreDisplay's sensitive backup archive used for broader server recovery/migration.

---

## Quick recovery card

When you SSH into a Pi and do not know what is wrong:

```bash
libredisplay status
libredisplay doctor
libredisplay server-only status
libredisplay remote status
libredisplay addresses
libredisplay logs --lines 120
```

New Owner device:

```bash
libredisplay remote on
libredisplay connect
```

Restore the Pi's own dashboard:

```bash
libredisplay server-only off
```

Check only the local server:

```bash
curl http://127.0.0.1:8787/healthz
```

Verify a backup without restoring it:

```bash
libredisplay restore /path/to/backup.ldbackup --verify-only
```

If the server is healthy but another display cannot connect, investigate LAN/VPN reachability and the display address before changing LibreDisplay configuration.

</details>
