# ServerCraft — Linux Edition

> Game server management panel for Ubuntu 22.04 / 24.04 LTS and Debian 11 (Bullseye) / 12 (Bookworm)  
> Manage Arma 3, DayZ, Rust, Arma Reforger, Project Zomboid, Valheim, Squad, Minecraft, and more — all from a single web dashboard.

---

## Table of Contents

- [Requirements](#requirements)
- [Option 1 — Native Install (Recommended)](#option-1--native-install-recommended)
- [Option 2 — Docker Compose (Standard)](#option-2--docker-compose-standard)
- [Option 3 — AAPanel + Docker (Recommended for Docker)](#option-3--aapanel--docker-recommended-for-docker)
- [First Login](#first-login)
- [Managing the Service](#managing-the-service)
- [Port Reference](#port-reference)
- [Updating](#updating)
- [Uninstalling](#uninstalling)
- [Supported Games](#supported-games)
- [Troubleshooting](#troubleshooting)

---

## Requirements

| | Native | Docker |
|---|---|---|
| OS | Ubuntu 22.04/24.04 LTS or Debian 11/12 | Any Linux with Docker Engine |
| RAM | 1 GB minimum, 2 GB recommended | 1 GB minimum |
| Disk | 10 GB minimum | 10 GB minimum |
| Access | `sudo` / root | `sudo` / root |

---

## Option 1 — Native Install (Recommended)

The install script handles everything automatically:

- Python 3.11, Node.js 20 LTS, Yarn
- React frontend build
- Python virtual environment + all dependencies
- systemd service (auto-starts on reboot)
- UFW firewall rules

**Run on your Ubuntu server:**

```bash
git clone https://github.com/OfficialMikeJ/ServerCraft-Linux.git
cd ServerCraft-Linux
sudo bash install.sh
```

The script prints your panel URL with your server's local IP address when it finishes.

**Custom port (default is 8080):**

```bash
sudo SERVERCRAFT_PORT=9090 bash install.sh
```

---

## Option 2 — Docker Compose (Standard)

Use this if you prefer Docker without AAPanel.

**1. Install Docker Engine** (skip if already installed):

```bash
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER   # log out and back in after this
```

**2. Clone and start:**

```bash
git clone https://github.com/OfficialMikeJ/ServerCraft-Linux.git
cd ServerCraft-Linux
docker compose up -d --build
```

The panel will be available at `http://<your-server-ip>:8080`.

**Custom port:**

```bash
PANEL_PORT=9090 docker compose up -d --build
```

**Useful commands:**

```bash
docker compose logs -f servercraft      # live logs
docker compose restart servercraft      # restart
docker compose down                     # stop
docker compose up -d --build            # rebuild after an update
```

---

## Option 3 — AAPanel + Docker (Recommended for Docker)

AAPanel (宝塔面板) manages Nginx for you, making it easy to add a domain name and SSL certificate on top of ServerCraft.

### Step 1 — Install AAPanel

```bash
wget -O install.sh https://www.aapanel.com/script/install_6.0_en.sh
bash install.sh aapanel
```

Follow the on-screen instructions. Note down the AAPanel URL and credentials it gives you.

### Step 2 — Install Docker via AAPanel

In the AAPanel dashboard:

1. Go to **App Store** → search **Docker Manager** → Install
2. Once installed, open **Docker Manager** → confirm Docker is running

### Step 3 — Deploy ServerCraft

SSH into your server and run:

```bash
git clone https://github.com/OfficialMikeJ/ServerCraft-Linux.git
cd ServerCraft-Linux
docker compose -f docker-compose.aapanel.yml up -d --build
```

This binds the panel to `127.0.0.1:8080` (localhost only — not exposed to the internet directly).

### Step 4 — Add a Reverse Proxy in AAPanel

1. In AAPanel → **Website** → **Add Site** → enter your domain name
2. Under the site settings → **Reverse Proxy** → **Add Reverse Proxy**
   - Target URL: `http://127.0.0.1:8080`
   - Enable: ✅
3. *(Optional)* Go to **SSL** → **Let's Encrypt** → apply a free certificate for HTTPS

Your panel will now be accessible at `https://your-domain.com`.

### Step 5 — Open firewall ports in AAPanel

In AAPanel → **Security** → add the following rules:

| Port | Protocol | Purpose |
|---|---|---|
| 80 | TCP | HTTP (redirect to HTTPS) |
| 443 | TCP | HTTPS (panel with SSL) |
| 27000–27020 | TCP + UDP | Steam game servers |
| 9600–9630 | TCP + UDP | Additional game ports |

---

## First Login

After any installation method, open the panel URL in your browser.

| Field | Value |
|---|---|
| Username | `Admin` |
| Password | `Password123!` |

> **Change your password immediately after logging in.**  
> Go to the user icon in the top-right corner → Change Password.

---

## Managing the Service

### Native (systemd)

```bash
# Status
systemctl status servercraft

# Start / Stop / Restart
systemctl start servercraft
systemctl stop servercraft
systemctl restart servercraft

# Live logs
journalctl -u servercraft -f

# Logs (last 100 lines)
journalctl -u servercraft -n 100
```

### Docker

```bash
# Status
docker compose ps

# Live logs
docker compose logs -f servercraft

# Restart
docker compose restart servercraft

# Stop everything
docker compose down

# Stop and remove all data (destructive!)
docker compose down -v
```

---

## Port Reference

| Port | Protocol | Purpose |
|---|---|---|
| 8080 | TCP | ServerCraft web panel |
| 27000–27020 | TCP + UDP | Steam / Source engine game servers |
| 9600–9630 | TCP + UDP | Additional game server ports |

Ports can be customised in `docker-compose.yml` or by setting `SERVERCRAFT_PORT` before running the installer.

---

## Updating

### Native

```bash
cd ServerCraft-Linux
git pull
sudo bash install.sh
```

The installer is safe to re-run — it will update files, rebuild the frontend, and restart the service.

### Docker

```bash
cd ServerCraft-Linux
git pull
docker compose up -d --build
```

Your data volumes are preserved across rebuilds.

---

## Uninstalling

### Native

```bash
sudo systemctl stop servercraft
sudo systemctl disable servercraft
sudo rm /etc/systemd/system/servercraft.service
sudo systemctl daemon-reload
sudo rm -rf /opt/servercraft
sudo userdel servercraft
```

### Docker

```bash
docker compose down
# Remove data as well (optional, irreversible):
# docker compose down -v
# rm -rf data servers mods logs steamcmd
```

---

## Supported Games

| Game | Steam App ID | Anonymous Login |
|---|---|---|
| Arma 3 | 233780 | No (Steam account required) |
| Arma Reforger | 1874900 | No |
| DayZ | 223350 | No |
| Rust | 258550 | No |
| Project Zomboid | 380870 | Yes |
| Valheim | 896660 | Yes |
| Squad | 403240 | No |
| Ground Branch | 16900 | No |
| ICARUS | 2089820 | No |
| No One Survived | 1963200 | No |
| FiveM | — | — |
| Minecraft | — | — |
| TeamSpeak 3 | — | — |
| Source Engine games | varies | Yes |

---

## Troubleshooting

**Panel not loading after install**

```bash
# Check the service is running
systemctl status servercraft

# Check for startup errors
journalctl -u servercraft -n 50
```

**Port already in use**

```bash
sudo lsof -i :8080
# Use a different port:
sudo SERVERCRAFT_PORT=9090 bash install.sh
```

**Frontend shows blank page**

The React build may not have completed. Re-run the installer or manually rebuild:

```bash
cd /opt/servercraft/frontend
yarn build
sudo rsync -a --delete build/ /opt/servercraft/backend/static/
sudo systemctl restart servercraft
```

**SteamCMD install fails**

Ensure `lib32gcc-s1` is installed (required for SteamCMD on 64-bit Linux):

```bash
sudo apt-get install -y lib32gcc-s1
```

**Docker: permission denied**

```bash
sudo usermod -aG docker $USER
# Log out and back in, then retry
```

---

## License

© 2026 TierOne Development. All rights reserved.
