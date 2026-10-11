# LibreDisplay

**Your home. Your dashboard. Your data.**  
Free, open-source, self-hosted home dashboards for Raspberry Pi, Docker, NAS, mini PCs, and modern browsers.

<p align="center">
  <img src="assets/libredisplay-promo.png" alt="LibreDisplay dashboard" width="720">
</p>

## Quick start — Raspberry Pi

Use a current Raspberry Pi OS **with Desktop**, then paste this into Terminal:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Gubna-Tech/LibreDisplay/v1.12.0/scripts/install-one-line.sh)"
```

The bootstrap validates the pinned **v1.12.0** release before starting the installer. It will not overwrite an existing `~/libredisplay`; existing users should use `libredisplay update`. Reboot when prompted.

> Raspberry Pi OS Lite is not supported by the native kiosk installer. Use Pi OS with Desktop, or run LibreDisplay with Docker.

## First setup

A new installation opens the setup wizard automatically for the display name, weather location, calendars, background, appearance, and optional remote management. Skip anything you do not need; rerun it anytime from **Settings > Home > Run setup wizard**.

## Using LibreDisplay

<details>
<summary><strong>Features &amp; highlights</strong></summary>

- Weather, forecasts, alerts, NatureScape scenes, and optional dog companion
- ICS/iCalendar feeds, `.ics` imports, plus optional holiday/astronomy add-ons
- Stock, Google Photos, local media, and NAS backgrounds
- Family, chores, rewards, tasks, alerts, integrations, and custom data
- Per-display layouts, themes, accessibility, and deep Arrange controls
- Multiple displays, Owner/Editor/Viewer roles, and read-only Display Links
- OLED care: dimming, quiet hours, deep protection, and pixel shifting
- Self-hosted operation with no LibreDisplay cloud account or telemetry

</details>

**Compatible devices**

| Device / role | Run server | Native wall kiosk | Read-only viewer | Remote settings |
|---|:---:|:---:|:---:|:---:|
| Raspberry Pi 3 / 4 / 5 + Pi OS Desktop | ✅ | ✅ | ✅ | ✅ |
| Linux mini PC / Docker host | ✅ | ❌ | ✅ | ✅ |
| NAS with Docker / Compose | ✅ | ❌ | ❌ | ✅* |
| Tablet, TV, phone, or desktop browser | ❌ | ❌ | ✅ | ✅ |

\*Use a browser connected to the LibreDisplay server.

For local media or NAS shares:

```bash
~/libredisplay/scripts/setup-media.sh
```

```bash
~/libredisplay/scripts/setup-nas.sh
```

<p align="center"><strong>❓ FAQ &amp; troubleshooting</strong></p>

> **Need an answer or fixing something?** Open the FAQ below. It stays collapsed so this README remains easy to scan, but it contains detailed help for setup, Remote Access, Owner devices, displays, calendars, performance, privacy, updates, recovery, and common problems.

<details>
<summary><strong>❓ Open FAQ &amp; troubleshooting — setup, Remote Access, displays, performance &amp; recovery</strong></summary>

**Getting started & privacy**

**Does LibreDisplay need a cloud account?** No. LibreDisplay itself is self-hosted and does not require a LibreDisplay account. Only outside services and integrations you choose to configure contact their providers.

**Does LibreDisplay send analytics or telemetry?** No LibreDisplay analytics or telemetry are required. Dashboard data stays on your server except for outside sources you explicitly configure, such as weather, calendars, photos, or integrations.

**Should I expose LibreDisplay directly to the public Internet?** No. Do not port-forward the built-in server. Use it on a trusted home LAN or through a private VPN.

**What should I do first after installation?** Complete the setup wizard, confirm the weather location and display name, then add only the calendars, backgrounds, integrations, and Remote Access features you actually need. You can rerun the wizard later from Settings.

**Can I change everything later?** Yes. The setup wizard is only a starting point. Settings and Arrange remain available afterward, and each named display can be configured independently.

**Remote Access & Owner devices**

**How does Remote Access work?** Enable Remote Access from the local LibreDisplay, choose **Add Owner Device**, then use the short-lived one-time code or QR on the phone, tablet, or computer you want to trust. The code is single-use and expires automatically.

**What is an Owner device?** It is a browser that has been explicitly authorized to manage LibreDisplay with Owner privileges. Authorized devices appear in Settings with a name, last-seen information, and controls to rename or revoke them.

**How do I connect a new Owner device?** In **Settings > Displays > Remote access**, press **Add Owner Device**. Scan the QR or open the shown `/connect` address on the new device, confirm the one-time code, give the device a recognizable name, and connect it.

**Do I still need to copy a long Owner pairing URL?** No for normal use. The current Remote Access system replaces the old password-like pairing-link workflow with one-time connection codes and QR. Existing `/pair?access=…` links remain accepted temporarily for upgrade compatibility but are no longer the normal UI workflow.

**How long does a connection code last?** By default about 10 minutes. It can be used only once. Creating a new code does not authorize anything until another device successfully redeems it.

**What if a QR code does not scan?** Use the connection address shown beneath it and enter the displayed code manually. LibreDisplay can offer more than one reachable LAN/mDNS address when available.

**Can an already-authorized Owner add another Owner device?** Yes. An authenticated Owner can create a fresh one-time connection code without returning to the wall display, provided Remote Access remains enabled.

**How do I remove access from a lost phone or old computer?** Open the **Owner devices** list and choose **Revoke** next to that device. Its stored Owner session is invalidated immediately.

**Can I rename Owner devices?** Yes. Use descriptive names such as “Kitchen iPad”, “My phone”, or “Office laptop” so the authorized-device list stays understandable.

**What happens if I revoke the browser I am currently using?** That browser is signed out immediately. The local LibreDisplay remains the recovery Owner and cannot be remotely revoked.

**What is the Owner sign-in/reconnect address?** `/login` remains the stable account/reconnect page. A still-authorized Owner device normally keeps its trusted session; `/login` is useful when that session expires or when using a named Owner/Editor/Viewer account.

**What is a Display Link?** A Display Link is a separate read-only credential for one named display. Use it for a wall viewer, tablet, TV, or browser that should show the dashboard but never change Settings.

**Can a Display Link change Settings?** No. It is intentionally read-only and scoped to one display endpoint.

**What does Reset all remote credentials do?** It invalidates Owner sessions, legacy pairing credentials, active one-time codes, and read-only Display Links. Use it if you believe remote credentials were exposed or you want a complete Remote Access reset.

**Why can I not connect from another device?** Confirm Remote Access is enabled, both devices are on the same trusted LAN/private VPN, the shown address is reachable from the new device, and the one-time code has not expired or already been used. If `.local` names do not resolve on that device, try the numeric LAN address shown by LibreDisplay.

**Displays & hardware**

**Can one server run several screens?** Yes. Named displays can keep independent layouts/settings and separate read-only Display Links while sharing one LibreDisplay server.

**Can a phone, tablet, TV, or desktop be a viewer?** Yes, if it has a compatible modern browser and can reach the LibreDisplay server. A browser-only viewer does not need to run the LibreDisplay server.

**Which Raspberry Pi models are supported?** Raspberry Pi 3, 4, and 5 are supported with Raspberry Pi OS Desktop. LibreDisplay includes device-aware rendering/performance behavior so lower-power Pi hardware can use lighter presentation where needed.

**Can I use Raspberry Pi OS Lite?** Not with the native wall-kiosk installer, because that workflow expects a desktop/browser session. Use Raspberry Pi OS with Desktop, or run LibreDisplay through Docker and view it from another browser.

**Can I run LibreDisplay on a mini PC or Linux server?** Yes. Linux/Docker hosts can run the server and can serve one or many browser displays. The native Raspberry Pi kiosk helper is Pi-specific, but the dashboard itself is browser-based.

**Can I run LibreDisplay on a NAS?** Yes when the NAS can run the provided Docker/Compose workflow. The NAS hosts the server; use browsers or separate display devices for the dashboard view.

**Performance, motion & OLED care**

**What if animations are too heavy on my display?** Start with Automatic performance mode. LibreDisplay also provides animation/performance controls and Pi-specific behavior so you can favor smoothness, reduced motion, or static NatureScape presentation without losing the dashboard itself.

**Why does Pi 3 look less animated than Pi 4/5?** Automatic mode intentionally protects the lower-power device by using lighter/static presentation where appropriate. You can adjust performance settings, but stable unattended operation should take priority over unnecessary effects.

**Can I protect an OLED or other always-on display?** Yes. Display-care controls include independently configurable pixel shifting, idle dimming, quiet hours, deep-black protection, temporary wake behavior, and related timing/intensity options.

**Can Quiet Hours be disabled while keeping pixel shifting?** Yes. OLED/display-protection features are independent so you can keep pixel shifting without forcing scheduled dim/black periods.

**Calendars, weather & media**

**Can I use my own calendars?** Yes. LibreDisplay supports ICS/iCalendar feeds and `.ics` imports. Calendar sources can be enabled, disabled, colored, ordered, and refreshed independently.

**Are holidays and other calendar extras built in?** Optional civic, Christian, Jewish, Islamic, astronomy/clock-change, and cultural calendar groups are available. They are opt-in and off by default, and individual selections are preserved if the master add-on switch is temporarily disabled.

**Why is a calendar missing events?** Confirm the source is enabled and reachable, verify the calendar URL/file, check time-zone expectations, then use the calendar test/refresh controls. For external feeds, temporary provider/network failures can delay fresh data.

**Can I use local photos or NAS media as backgrounds?** Yes. LibreDisplay supports local folders and NAS-backed media along with stock and supported photo sources. Use `setup-media.sh` and `setup-nas.sh` for native installation helpers.

**What happens if the Internet goes down?** The local dashboard and locally stored content remain available. Features that depend on outside providers cannot fetch fresh data while offline; cached/stale data may continue to be shown where that source supports LibreDisplay caching.

**Updates, backups & recovery**

**Are my settings preserved during updates?** Supported updates are designed to preserve dashboard configuration, display endpoints, local data/media, profiles, and custom plugins. The updater also creates recovery/backup material before replacing application files.

**How do I back up LibreDisplay?** Use `~/libredisplay/scripts/backup.sh` on a native installation. Keep important backups somewhere other than the display device itself.

**Can I roll back after a bad update?** LibreDisplay includes update recovery/rollback support. If the UI is unavailable, command-line maintenance tooling and backups provide a recovery path.

**Does Docker keep my configuration between container updates?** Yes when installed with the provided Docker/Compose workflow and its persistent data mapping. Use the supplied Docker update/backup commands instead of treating the container filesystem as permanent storage.

**What should I do if Settings looks wrong after an update?** First perform a full browser refresh so the updated frontend is loaded. Then verify you are editing the intended named display. If a problem persists, check the Software Update/diagnostic controls and restart the LibreDisplay service before changing data manually.

**What should I do if the dashboard itself will not load?** From the server, check `curl http://127.0.0.1:8787/healthz`, verify the LibreDisplay service/container is running, and confirm the browser can reach the server address. Native installs can also use the maintenance/recovery scripts from Terminal.

**Can I reset Remote Access without resetting my dashboard configuration?** Yes. **Reset all remote credentials** affects Remote Access credentials/sessions and Display Links; it does not erase normal dashboard configuration, layouts, calendars, or media settings.

**Customization & integrations**

**Can I customize the layout per display?** Yes. Each named display can have its own layout and presentation, including Arrange controls and per-block/integration styling.

**Can I add integrations or custom data?** Yes. LibreDisplay includes built-in integration/plugin support and custom data blocks. Only configure providers you trust, especially when credentials or API keys are required.

**Where should I start if one feature looks wrong after changing Settings?** Reopen Settings and confirm the relevant control, then use the feature-specific refresh/reload action if it fetches outside data. Confirm the correct named display is selected, and perform a full browser refresh after application updates.

</details>

## Updating LibreDisplay

Native Pi installs show updates in **Settings > System > Software update**. From Terminal:

```bash
libredisplay check
```

```bash
libredisplay update
```

Supported updates keep settings, media, display endpoints, and custom plugins.

## Docker

From the extracted LibreDisplay folder:

```bash
chmod +x scripts/docker-setup.sh
```

```bash
./scripts/docker-setup.sh --lan
```

Open the address shown on your home network. For maintenance:

```bash
./scripts/docker-setup.sh update
```

```bash
./scripts/docker-setup.sh backup
```

## Useful commands

Start a native Pi install:

```bash
~/libredisplay/scripts/start.sh
```

Check the local server:

```bash
curl http://127.0.0.1:8787/healthz
```

Create a backup:

```bash
~/libredisplay/scripts/backup.sh
```

Uninstall while preserving local dashboard data:

```bash
~/libredisplay/uninstall.sh
```

## Remote access and privacy

LibreDisplay is for a trusted home network or private VPN. Do **not** port-forward it directly to the public Internet.

Use **Add Owner Device** to authorize a trusted browser with a short-lived, single-use code or QR. Authorized Owner devices can be named and revoked individually. The `/login` address remains available for named-account sign-in/reconnect, and each **Display Link** is read-only for one screen.

LibreDisplay needs no cloud account and sends no analytics or telemetry. External integrations only contact services you choose.

## Open source

LibreDisplay is released under the **[MIT License](LICENSE)**.  
Copyright (c) 2026 Gubna.
