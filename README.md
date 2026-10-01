# LibreDisplay

**Your home. Your dashboard. Your data.**  
A free, open-source home dashboard for Raspberry Pi, Docker, NAS, mini PCs, and browsers.

LibreDisplay brings calendars, weather, photos, family chores, tasks, media, charts, alerts, and custom data together on one clean display. It is designed to stay simple for everyday use while keeping advanced controls out of the way until you need them.

<p align="center">
  <img src="assets/libredisplay-promo.png" alt="LibreDisplay self-hosted dashboard with calendar, weather, alerts, photo background, remote Settings, and Raspberry Pi hardware" width="720">
</p>

## Quick start — Raspberry Pi

**Best choice for a dedicated wall display.** Use a current Raspberry Pi OS **with Desktop**.

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
curl -fL https://github.com/Gubna-Tech/LibreDisplay/archive/refs/tags/v1.3.1.zip -o /tmp/LibreDisplay.zip
```

**5. Extract LibreDisplay:**

```bash
unzip -q /tmp/LibreDisplay.zip -d ~/LibreDisplay-Setup
```

**6. Open the LibreDisplay setup folder:**

```bash
cd ~/LibreDisplay-Setup/LibreDisplay-1.3.1
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

When LibreDisplay opens:

1. Open **Settings**.
2. Add your calendar, weather location, photos, and any integrations you want.
3. Open **Personalization** to choose a theme and arrange the dashboard.
4. Add more displays later from **Home > Displays** if you want LibreDisplay in multiple rooms.

Settings open in the simpler **Essentials** view by default. Switch to **All** only when you want advanced and troubleshooting options.

## Everyday use

LibreDisplay is designed to run quietly in the background. Once configured, your display updates itself and the Settings button stays out of the way.

Useful places to remember:

- **Content** — calendars, photos, weather, feeds, and dashboard content
- **Family** — household members, chores, points, and rewards
- **Personalization** — themes, templates, accessibility, blocks, and layout
- **Arrange editor** — move/resize blocks, drag the inspector out of the way, and fine-tune individual text sections such as calendar event titles/times without changing day/date headers. When editing remotely, Arrange requests fresh wall-display metrics and mirrors the Pi’s actual dashboard viewport so positions, wrapping, and responsive sizing stay aligned even after HDMI, resolution, orientation, or display-mode changes.
- **Integrations** — connect supported services and check their status
- **System** — displays, accounts, backups, remote access, and advanced options

Small **?** buttons beside less-obvious controls provide quick hover/click help without filling the interface with extra instructions.

## Updating LibreDisplay

After the first native Raspberry Pi installation, updating is one command. Open **Terminal** and run:

```bash
libredisplay update
```

LibreDisplay checks the official GitHub release, downloads the newest version, creates a safety backup, keeps your settings, media, and custom plugins, installs the update, and reboots.

To check for an update without installing anything, run:

```bash
libredisplay check
```

Settings also shows when a newer release is available and reminds you of the same update command.

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
curl -fL https://raw.githubusercontent.com/Gubna-Tech/LibreDisplay/v1.3.1/scripts/viewer-setup.sh -o /tmp/libredisplay-viewer-setup.sh
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

Go to **Settings > Content > Calendar sources > Add calendar**.

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

Then choose the folder under **Settings > Content > Background source**.

### Multiple displays

Go to **Settings > Home > Displays > Add display**.

Each display can have its own calendars, weather, photos, theme, layout, and read-only Display Link. One LibreDisplay server can therefore run a kitchen screen, office screen, bedroom screen, and more without separate server installations.

</details>

<details>
<summary><strong>Integrations</strong></summary>

Open **Settings > Integrations** to browse the integrations installed with LibreDisplay. The page shows what is configured and whether each provider is healthy without exposing saved credentials to display-only browsers.

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

For a native Raspberry Pi installation, create a full LibreDisplay backup with:

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

Do **not** port-forward LibreDisplay directly to the public Internet. Use a private VPN such as WireGuard or Tailscale if you need remote access.

LibreDisplay does not require a LibreDisplay cloud account and does not include telemetry. External integrations only contact the services you choose to configure.

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

## Open source

LibreDisplay is released under the **[MIT License](LICENSE)**.

Copyright (c) 2026 Gubna.
