# LibreDisplay

**Your home. Your dashboard. Your data.**  
Free, open-source, self-hosted home dashboards for Raspberry Pi, Docker, NAS, mini PCs, and modern browsers.

<p align="center">
  <img src="assets/libredisplay-promo.png" alt="LibreDisplay dashboard" width="720">
</p>

## Quick start — Raspberry Pi

Use a current Raspberry Pi OS **with Desktop**, then paste this into Terminal:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Gubna-Tech/LibreDisplay/v1.11.12/scripts/install-one-line.sh)"
```

The bootstrap validates the pinned **v1.11.12** release before starting the installer. It will not overwrite an existing `~/libredisplay`; existing users should use `libredisplay update`. Reboot when prompted.

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

<details>
<summary><strong>FAQ</strong></summary>

**Does it need the cloud?** No. Only integrations you configure contact outside services.

**Can I manage it remotely?** Yes, on a trusted LAN/private VPN. Pair a trusted browser once, then bookmark its reconnect address.

**Can one server run several screens?** Yes. Named displays can keep independent settings and read-only Display Links.

**Are holidays built in?** Optional civic, religious, astronomy, and seasonal calendar groups are available and off by default.

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
