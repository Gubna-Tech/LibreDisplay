# LibreDisplay

**Your home. Your dashboard. Your data.**  
Free, open-source, self-hosted home dashboards for Raspberry Pi, Docker, NAS, mini PCs, and modern browsers.

<p align="center">
  <img src="assets/libredisplay-promo.png" alt="LibreDisplay dashboard" width="720">
</p>

## Quick start — Raspberry Pi

Use a current Raspberry Pi OS **with Desktop**, then paste this into Terminal:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Gubna-Tech/LibreDisplay/v1.11.14/scripts/install-one-line.sh)"
```

The bootstrap validates the pinned **v1.11.14** release before starting the installer. It will not overwrite an existing `~/libredisplay`; existing users should use `libredisplay update`. Reboot when prompted.

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

<p><strong>❓ FAQ &amp; troubleshooting</strong></p>

> **Looking for an answer quickly?** The FAQ stays collapsed to keep this README compact; open it for setup, Remote Access, display, calendar, performance, privacy, update, and recovery help.

<details>
<summary><strong>FAQ</strong></summary>

**Common questions & troubleshooting**

**Does LibreDisplay need a cloud account?** No. LibreDisplay itself is self-hosted and does not require a LibreDisplay account. Only outside services and integrations you choose to configure contact their providers.

**Does LibreDisplay send analytics or telemetry?** No LibreDisplay analytics or telemetry are required. Your dashboard data stays on your server except for external sources you explicitly configure, such as weather, calendars, photos, or integrations.

**Can I manage LibreDisplay remotely?** Yes, on a trusted home LAN or private VPN. Enable Remote management from the local wall display, use the Owner pairing link once on a trusted browser, then keep the shorter reconnect address for later visits.

**Why do I not see “Pair an Owner browser” from a remote Settings session?** Owner pairing links are intentionally issued only by the local display. Open Settings on the LibreDisplay wall/server itself, enable Remote management, and copy the pairing link there. Already-paired browsers should use the reconnect address instead.

**What is the difference between the pairing link, reconnect address, and Display Link?** The Owner pairing link (`/pair?access=…`) grants a trusted browser an Owner session once; `/login` is the reusable reconnect/sign-in address; `/display/<id>?access=…` is a read-only link for a specific display. Treat token-bearing links like passwords.

**Should I expose LibreDisplay directly to the public Internet?** No. Do not port-forward the built-in server. Use it on a trusted local network or through a private VPN.

**Can one server run several screens?** Yes. Named displays can keep independent layouts/settings and have separate read-only Display Links while sharing one LibreDisplay server.

**Can a phone, tablet, TV, or desktop be a viewer?** Yes, if it has a compatible modern browser and can reach the LibreDisplay server. A browser-only device does not need to run the LibreDisplay server itself.

**Which Raspberry Pi models are supported?** Raspberry Pi 3, 4, and 5 are supported with Raspberry Pi OS Desktop. LibreDisplay includes device-aware rendering/performance behavior so lower-power Pi hardware can use a lighter presentation where needed.

**Can I use Raspberry Pi OS Lite?** Not with the native wall-kiosk installer, because that workflow expects a desktop/browser session. Use Raspberry Pi OS with Desktop, or run LibreDisplay through Docker and view it from another browser.

**What if animations are too heavy on my display?** Start with Automatic performance mode. LibreDisplay also provides animation/performance controls and Pi-specific behavior so you can favor smoothness, reduced motion, or static NatureScape presentation without giving up the dashboard itself.

**Can I protect an OLED or other always-on display?** Yes. Display-care controls include independently configurable pixel shifting, idle dimming, quiet hours, deep-black protection, temporary wake behavior, and related timing/intensity options.

**Can I use my own calendars?** Yes. LibreDisplay supports ICS/iCalendar feeds and `.ics` imports. Calendar sources can be enabled, disabled, colored, ordered, and refreshed independently.

**Are holidays and other calendar extras built in?** Optional civic, Christian, Jewish, Islamic, astronomy/clock-change, and cultural calendar groups are available. They are opt-in and off by default, and individual groups can be selected without losing those choices when the master add-on switch is temporarily disabled.

**Can I use local photos or NAS media as backgrounds?** Yes. LibreDisplay supports local media/folders and NAS-backed media, along with stock and supported photo sources. Use `setup-media.sh` and `setup-nas.sh` for the native installation helpers.

**What happens if the Internet goes down?** The local dashboard and locally stored content remain available. Features that depend on outside providers cannot fetch fresh data while offline; cached/stale data may continue to be shown where that source supports LibreDisplay caching.

**Are my settings preserved during updates?** Supported updates are designed to preserve dashboard configuration, display endpoints, local data/media, profiles, and custom plugins. The updater also creates recovery/backup material before replacing the application files.

**How do I back up LibreDisplay?** Use `~/libredisplay/scripts/backup.sh` on a native installation. Keep important backups somewhere other than the display device itself.

**Can I roll back after a bad update?** LibreDisplay includes update recovery/rollback support. If the UI is unavailable, the command-line maintenance tooling and backups provide a recovery path.

**Does Docker keep my configuration between container updates?** Yes when installed with the provided Docker/Compose workflow and its persistent data mapping. Use the supplied Docker update/backup commands instead of treating the container filesystem as permanent storage.

**Can I customize the layout per display?** Yes. Each named display can have its own layout and presentation, including Arrange controls and per-block/integration styling.

**Can I add integrations or custom data?** Yes. LibreDisplay includes built-in integration/plugin support and custom data blocks. Only configure providers you trust, especially when credentials or API keys are required.

**Where should I start if something looks wrong after changing Settings?** First reopen Settings and confirm the relevant control, then use the refresh/reload controls if the feature fetches external data. For display-specific problems, confirm you are editing the correct named display. A full browser refresh is also useful after an application update.

**Why is a Remote Access link different after I rotate it?** Rotating access credentials intentionally invalidates the old token-bearing links/sessions. Copy and redistribute the new pairing or Display Link only to devices that should retain access.

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

The **Owner pairing link** authorizes a trusted browser once, the **reconnect address** returns that browser later, and each **Display Link** is read-only for one screen.

LibreDisplay needs no cloud account and sends no analytics or telemetry. External integrations only contact services you choose.

## Open source

LibreDisplay is released under the **[MIT License](LICENSE)**.  
Copyright (c) 2026 Gubna.
