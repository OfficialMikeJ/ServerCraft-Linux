# ServerCraft — Linux Edition: Full Installation Guide

> **Supported operating systems**  
> Ubuntu 22.04 LTS · Ubuntu 24.04 LTS · Debian 11 (Bullseye) · Debian 12 (Bookworm)

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Pre-Installation Checklist](#2-pre-installation-checklist)
3. [Method 1 — Native Install via install.sh (Recommended)](#3-method-1--native-install-via-installsh-recommended)
4. [Method 2 — Docker Compose (Standard)](#4-method-2--docker-compose-standard)
5. [Method 3 — AAPanel + Docker (Recommended for Docker)](#5-method-3--aapanel--docker-recommended-for-docker)
6. [First Login](#6-first-login)
7. [Managing the Service](#7-managing-the-service)
8. [Updating ServerCraft](#8-updating-servercraft)
9. [Uninstalling](#9-uninstalling)
10. [Environment Variables Reference](#10-environment-variables-reference)
11. [Port Reference](#11-port-reference)
12. [Error Reference & Troubleshooting](#12-error-reference--troubleshooting)

---

## 1. System Requirements

| Requirement | Native Install | Docker Install |
|---|---|---|
| **OS** | Ubuntu 22.04/24.04 LTS or Debian 11/12 | Any Linux with Docker Engine 20+ |
| **RAM** | 1 GB minimum · 2 GB recommended | 1 GB minimum · 2 GB recommended |
| **Disk** | 10 GB minimum (more for game servers) | 10 GB minimum |
| **CPU** | 1 core minimum · 2+ recommended | 1 core minimum |
| **Access** | `sudo` or root | `sudo` or root |
| **Network** | Outbound internet (SteamCMD downloads) | Outbound internet |
| **Python** | Auto-installed by script | Not required (Docker handles it) |
| **Node.js** | Auto-installed by script | Not required (Docker handles it) |

### Python version per OS

| OS | Default Python | What the installer uses |
|---|---|---|
| Ubuntu 22.04 | 3.10 | 3.11 (via deadsnakes PPA) |
| Ubuntu 24.04 | 3.12 | 3.12 (system) |
| Debian 11 | 3.9 | 3.11 (via bullseye-backports) |
| Debian 12 | 3.11 | 3.11 (system) |

---

## 2. Pre-Installation Checklist

Before you begin, confirm the following:

- [ ] You are logged in as a user with `sudo` privileges, or directly as root
- [ ] Your server has at least 1 GB RAM and 10 GB free disk space
- [ ] Your server has an internet connection (the installer downloads dependencies)
- [ ] Ports 8080 (or your chosen port), 27000–27020, and 9600–9630 are not already in use
- [ ] You have cloned the repository to your server

**Clone the repository:**

```bash
git clone https://github.com/OfficialMikeJ/ServerCraft-Linux.git
cd ServerCraft-Linux
```

---

## 3. Method 1 — Native Install via install.sh (Recommended)

This is the recommended installation method. The script installs all dependencies, builds the frontend, deploys the backend, creates a systemd service, and configures the firewall automatically.

### What the installer does

1. Installs system packages (`curl`, `wget`, `git`, `build-essential`, `lib32gcc-s1`, etc.)
2. Installs Python 3.11/3.12 (version depends on your OS — see table above)
3. Installs Node.js 20 LTS via NodeSource and Yarn
4. Creates a dedicated `servercraft` system user
5. Copies application files to `/opt/servercraft/`
6. Creates a Python virtual environment and installs all Python dependencies
7. Builds the React frontend and deploys it into `backend/static/`
8. Installs and starts a systemd service (`servercraft.service`)
9. Opens the required UFW firewall ports

### Running the installer

**Default (port 8080):**

```bash
sudo bash install.sh
```

**Custom port:**

```bash
sudo SERVERCRAFT_PORT=9090 bash install.sh
```

The script prints your panel URL at the end, including your server's local IP address.

### What gets installed where

| Path | Contents |
|---|---|
| `/opt/servercraft/backend/` | Python backend (FastAPI) |
| `/opt/servercraft/backend/static/` | Built React frontend (served by FastAPI) |
| `/opt/servercraft/backend/data/` | Panel data (users, server configs, etc.) |
| `/opt/servercraft/venv/` | Python virtual environment |
| `/opt/servercraft/frontend/` | React source (kept for rebuilds) |
| `/opt/servercraft/servers/` | Game server files |
| `/opt/servercraft/mods/` | Game mods |
| `/opt/servercraft/steamcmd/` | SteamCMD installation |
| `/etc/systemd/system/servercraft.service` | systemd unit file |

### Re-running the installer

The installer is safe to re-run at any time. It will update files, rebuild the frontend, and restart the service. This is also the update procedure — see [Updating](#8-updating-servercraft).

---

## 4. Method 2 — Docker Compose (Standard)

Use this method if you prefer Docker without a control panel.

### Step 1 — Install Docker Engine

Skip this step if Docker is already installed.

```bash
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
```

> **Important:** After running `usermod`, log out and back in (or run `newgrp docker`) before continuing. Without this, Docker commands will fail with a permission error.

Verify Docker is working:

```bash
docker --version
docker compose version
```

Both commands must succeed before continuing.

### Step 2 — Clone the repository

```bash
git clone https://github.com/OfficialMikeJ/ServerCraft-Linux.git
cd ServerCraft-Linux
```

### Step 3 — Build and start

```bash
docker compose up -d --build
```

The first build takes several minutes as it downloads base images, installs Python packages, and compiles the React frontend. Subsequent starts are fast.

**Custom port:**

```bash
PANEL_PORT=9090 docker compose up -d --build
```

### Step 4 — Verify

```bash
docker compose ps
```

The `servercraft` container should show `Up` and `healthy` after about 30 seconds.

```bash
docker compose logs -f servercraft
```

Look for `Uvicorn running on http://0.0.0.0:8080` in the output. Once you see it, the panel is ready.

### Persistent data

All game server data lives on the host, not inside the container. These directories are created automatically and survive container restarts and rebuilds:

| Host path | Container path | Purpose |
|---|---|---|
| `./data` | `/opt/servercraft/backend/data` | Panel configuration & user data |
| `./servers` | `/opt/servercraft/servers` | Game server installations |
| `./mods` | `/opt/servercraft/mods` | Game mods |
| `./logs` | `/opt/servercraft/logs` | Game server logs |
| `./steamcmd` | `/opt/servercraft/steamcmd` | SteamCMD installation |

### Docker management commands

```bash
# View running containers
docker compose ps

# Follow live logs
docker compose logs -f servercraft

# Restart the panel
docker compose restart servercraft

# Stop the panel
docker compose down

# Stop and delete all data volumes (DESTRUCTIVE — irreversible)
docker compose down -v
```

---

## 5. Method 3 — AAPanel + Docker (Recommended for Docker)

AAPanel (宝塔面板) manages Nginx for you, making it simple to add a domain name and SSL certificate. The panel binds to `127.0.0.1` only; AAPanel's Nginx handles all external traffic.

### Step 1 — Install AAPanel

On your server, run:

```bash
wget -O install.sh https://www.aapanel.com/script/install_6.0_en.sh
bash install.sh aapanel
```

Follow the on-screen prompts. When it finishes, note down the AAPanel URL, username, and password it displays.

### Step 2 — Install Docker via AAPanel

1. Log into the AAPanel dashboard
2. Go to **App Store** → search **Docker Manager** → click **Install**
3. Once installed, open **Docker Manager** and confirm the Docker daemon shows as running

### Step 3 — Clone the repository and deploy

SSH into your server and run:

```bash
git clone https://github.com/OfficialMikeJ/ServerCraft-Linux.git
cd ServerCraft-Linux
docker compose -f docker-compose.aapanel.yml up -d --build
```

This binds the panel to `127.0.0.1:8080` (localhost only — not directly reachable from the internet).

Verify the container is healthy:

```bash
docker compose -f docker-compose.aapanel.yml ps
docker compose -f docker-compose.aapanel.yml logs -f servercraft
```

### Step 4 — Add a reverse proxy in AAPanel

1. In AAPanel → **Website** → **Add Site**
   - Enter your domain name (e.g. `panel.example.com`)
   - Leave PHP version as **Pure static** or **No PHP**
   - Click **Submit**

2. Click your site → **Reverse Proxy** tab → **Add Reverse Proxy**
   - **Proxy name:** ServerCraft
   - **Target URL:** `http://127.0.0.1:8080`
   - Enable the proxy → click **Save**

3. *(Optional but recommended)* SSL tab → **Let's Encrypt** → select your domain → **Apply**

Your panel is now accessible at `https://your-domain.com`.

### Step 5 — Open firewall ports in AAPanel

In AAPanel → **Security** → **Firewall**, add the following rules:

| Port | Protocol | Purpose |
|---|---|---|
| 80 | TCP | HTTP (redirect to HTTPS) |
| 443 | TCP | HTTPS (panel with SSL) |
| 27000–27020 | TCP + UDP | Steam / Source engine game servers |
| 9600–9630 | TCP + UDP | Additional game server ports |

> You do **not** need to open port 8080 externally when using AAPanel — Nginx handles it internally.

### Nginx config (advanced)

If you need to configure Nginx manually instead of using AAPanel's UI, paste this into your site's Nginx config:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

---

## 6. First Login

After any installation method, open the panel URL in your browser.

| Field | Value |
|---|---|
| Username | `Admin` |
| Password | `Password123!` |

> **Change your password immediately.**  
> Click the user icon in the top-right corner → **Change Password**.

---

## 7. Managing the Service

### Native install (systemd)

```bash
# Check status
systemctl status servercraft

# Start
systemctl start servercraft

# Stop
systemctl stop servercraft

# Restart
systemctl restart servercraft

# Follow live logs
journalctl -u servercraft -f

# Show last 100 log lines
journalctl -u servercraft -n 100

# Show logs from the last boot
journalctl -u servercraft -b
```

### Docker (both Standard and AAPanel)

```bash
# Replace "docker compose" with "docker compose -f docker-compose.aapanel.yml" if using AAPanel

# Check container status
docker compose ps

# Follow live logs
docker compose logs -f servercraft

# Restart
docker compose restart servercraft

# Stop
docker compose down

# Rebuild after a code change
docker compose up -d --build

# Stop and wipe all data (DESTRUCTIVE)
docker compose down -v
```

---

## 8. Updating ServerCraft

### Native install

```bash
cd ServerCraft-Linux
git pull
sudo bash install.sh
```

The installer is safe to re-run — it overwrites application files, rebuilds the frontend, and restarts the service. Your data in `/opt/servercraft/data/` and `/opt/servercraft/servers/` is not touched.

### Docker

```bash
cd ServerCraft-Linux
git pull
docker compose up -d --build
```

Data volumes (`./data`, `./servers`, etc.) are preserved across rebuilds.

---

## 9. Uninstalling

### Native install

```bash
sudo systemctl stop servercraft
sudo systemctl disable servercraft
sudo rm /etc/systemd/system/servercraft.service
sudo systemctl daemon-reload
sudo rm -rf /opt/servercraft
sudo userdel servercraft
```

To also remove UFW rules:

```bash
sudo ufw delete allow 8080/tcp
sudo ufw delete allow 27000:27020/tcp
sudo ufw delete allow 27000:27020/udp
sudo ufw delete allow 9600:9630/tcp
sudo ufw delete allow 9600:9630/udp
```

### Docker

```bash
cd ServerCraft-Linux
docker compose down

# Also remove all data (irreversible):
# docker compose down -v
# rm -rf data servers mods logs steamcmd
```

---

## 10. Environment Variables Reference

Set these before running the installer or in your `docker-compose.yml`.

| Variable | Default | Description |
|---|---|---|
| `SERVERCRAFT_PORT` | `8080` | Port the panel listens on (native install) |
| `PANEL_PORT` | `8080` | Port mapping for Docker (`PANEL_PORT:8080`) |
| `SERVERCRAFT_ROOT_DIR` | `backend/` | Root directory for data, servers, etc. |
| `OPENAI_API_KEY` | — | Optional: OpenAI API key for AI features |
| `GOOGLE_API_KEY` | — | Optional: Google Gemini API key |
| `MONGO_URI` | — | Optional: MongoDB connection string |
| `AWS_ACCESS_KEY_ID` | — | Optional: AWS access key |
| `AWS_SECRET_ACCESS_KEY` | — | Optional: AWS secret key |
| `AWS_DEFAULT_REGION` | — | Optional: AWS region |

For the native install, environment variables can be set in the systemd unit file at `/etc/systemd/system/servercraft.service` under the `[Service]` section:

```ini
Environment=OPENAI_API_KEY=sk-...
```

Then reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart servercraft
```

---

## 11. Port Reference

| Port | Protocol | Purpose | Required |
|---|---|---|---|
| 8080 | TCP | ServerCraft web panel | Yes |
| 27000–27020 | TCP + UDP | Steam / Source engine game servers | For Steam games |
| 9600–9630 | TCP + UDP | Additional game server ports | For some games |
| 80 | TCP | HTTP (AAPanel only) | AAPanel only |
| 443 | TCP | HTTPS / SSL (AAPanel only) | AAPanel only |

To use a different panel port, set `SERVERCRAFT_PORT` (native) or `PANEL_PORT` (Docker) before installation.

---

## 12. Error Reference & Troubleshooting

### Installation errors

---

#### `Run as root: sudo bash install.sh`

**Cause:** The installer was run without root privileges.

**Fix:**
```bash
sudo bash install.sh
```

---

#### `Ubuntu 22.04 LTS or newer required` / `Debian 11 (Bullseye) or newer required`

**Cause:** Your OS version is too old. The installer checks `/etc/os-release` and requires Ubuntu 22.04+ or Debian 11+.

**Fix:** Upgrade your operating system or use the Docker installation method, which runs on any Linux with Docker Engine installed.

---

#### `This installer requires Ubuntu 22.04+ or Debian 11+. Detected: <other-os>`

**Cause:** You are running a non-supported distribution (e.g. CentOS, AlmaLinux, Fedora).

**Fix:** Use the Docker installation method — Docker runs on any Linux distribution.

---

#### `E: Unable to locate package python3.11` (Ubuntu 22.04)

**Cause:** The deadsnakes PPA was not added successfully, or the apt cache was not refreshed after adding it.

**Fix:**
```bash
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3.11-dev
```

---

#### `E: Unable to locate package python3.11` (Debian 11)

**Cause:** The bullseye-backports repository was not added or the cache was not refreshed.

**Fix:**
```bash
echo "deb http://deb.debian.org/debian bullseye-backports main" \
    | sudo tee /etc/apt/sources.list.d/backports.list
sudo apt-get update
sudo apt-get install -y -t bullseye-backports python3.11 python3.11-venv python3.11-dev
```

---

#### `error: command 'gcc' failed` or `error: Microsoft Visual C++ 14.0 is required`

**Cause:** Build tools are missing. Needed for Python packages like `cffi` and `cryptography`.

**Fix:**
```bash
sudo apt-get install -y build-essential libssl-dev libffi-dev python3-dev
```

Then re-run the installer or re-run pip install:
```bash
sudo /opt/servercraft/venv/bin/pip install -r /opt/servercraft/backend/requirements.txt
```

---

#### `Could not install packages due to an OSError` / pip `Permission denied`

**Cause:** Pip is attempting to write to a location it does not own, or the virtual environment belongs to the wrong user.

**Fix:** Ensure the venv is owned by the service user:
```bash
sudo chown -R servercraft:servercraft /opt/servercraft/venv
sudo -u servercraft /opt/servercraft/venv/bin/pip install -r /opt/servercraft/backend/requirements.txt
```

---

#### `curl: (6) Could not resolve host: deb.nodesource.com`

**Cause:** No internet connectivity, or DNS is not working.

**Fix:**
```bash
# Test connectivity
curl -I https://google.com

# Test DNS
nslookup deb.nodesource.com

# If DNS is the issue, add a public DNS server
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

---

#### `yarn: command not found`

**Cause:** Node.js or Yarn was not installed correctly, or the PATH was not updated in the current session.

**Fix:**
```bash
sudo npm install -g yarn
# Reload PATH
export PATH="$PATH:$(npm root -g)/.bin"
yarn --version
```

---

#### `error There appears to be trouble with your network connection`

**Cause:** Yarn lost connectivity while downloading npm packages.

**Fix:**
```bash
cd /opt/servercraft/frontend
sudo yarn install --network-timeout 100000
```

---

#### `JavaScript heap out of memory` during `yarn build`

**Cause:** The React build process exceeded Node.js's default memory limit. Occurs on servers with less than 1 GB RAM.

**Fix:** Increase the Node.js heap size:
```bash
export NODE_OPTIONS="--max-old-space-size=2048"
cd /opt/servercraft/frontend
sudo yarn build
sudo rsync -a --delete build/ /opt/servercraft/backend/static/
sudo systemctl restart servercraft
```

If your server has less than 1 GB RAM, add a swap file first:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

#### `rsync: [sender] change_dir "/opt/servercraft/frontend/build" failed: No such file or directory`

**Cause:** The `yarn build` step failed silently (no `build/` directory was created).

**Fix:** Run the build manually to see the real error:
```bash
cd /opt/servercraft/frontend
sudo yarn build
```

Address whichever error appears, then re-run rsync:
```bash
sudo rsync -a --delete /opt/servercraft/frontend/build/ /opt/servercraft/backend/static/
sudo systemctl restart servercraft
```

---

### Service startup errors

---

#### Panel not loading after install — service fails to start

**Diagnosis:**
```bash
systemctl status servercraft
journalctl -u servercraft -n 50
```

**Common causes and fixes:**

| Log message | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'fastapi'` | pip install did not complete | Re-run: `sudo /opt/servercraft/venv/bin/pip install -r /opt/servercraft/backend/requirements.txt` |
| `Address already in use` | Another process is using port 8080 | See [Port already in use](#port-8080-already-in-use) below |
| `Permission denied` on data directory | Wrong ownership | `sudo chown -R servercraft:servercraft /opt/servercraft` |
| `No such file or directory: server.py` | Backend files not copied | Re-run `sudo bash install.sh` |

---

#### `Address already in use` / Port 8080 already in use

**Cause:** Something else is already listening on port 8080.

**Diagnosis:**
```bash
sudo lsof -i :8080
sudo ss -tlnp | grep 8080
```

**Fix option A** — Kill the conflicting process:
```bash
sudo kill -9 <PID>
sudo systemctl restart servercraft
```

**Fix option B** — Use a different port:
```bash
sudo systemctl stop servercraft
sudo SERVERCRAFT_PORT=9090 bash install.sh
```

---

#### `ProtectSystem=strict` causes write failures

**Cause:** The systemd security hardening prevents writes to paths not listed in `ReadWritePaths`.

**Fix:** Add the path to the service file:
```bash
sudo systemctl edit servercraft
```

Add under `[Service]`:
```ini
ReadWritePaths=/opt/servercraft /your/extra/path
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl restart servercraft
```

---

### Frontend / browser errors

---

#### Panel shows a blank white page

**Cause:** The React build was not deployed to `backend/static/`, so FastAPI has no frontend files to serve.

**Fix:**
```bash
cd /opt/servercraft/frontend
sudo NODE_OPTIONS="--max-old-space-size=2048" yarn build
sudo rsync -a --delete build/ /opt/servercraft/backend/static/
sudo systemctl restart servercraft
```

---

#### `404 Not Found` on all panel routes (except `/api/`)

**Cause:** FastAPI is running but `backend/static/` is empty or missing the `index.html`.

**Diagnosis:**
```bash
ls /opt/servercraft/backend/static/
```

If empty, re-deploy the frontend as shown above.

---

#### Browser shows `ERR_CONNECTION_REFUSED`

**Cause:** The service is not running, or is listening on a different port.

**Fix:**
```bash
systemctl status servercraft
journalctl -u servercraft -n 20
```

If the service is running, confirm the port:
```bash
sudo ss -tlnp | grep uvicorn
```

---

#### Browser shows `ERR_CONNECTION_TIMED_OUT`

**Cause:** The firewall is blocking the port.

**Fix:**
```bash
# Check if UFW is enabled
sudo ufw status

# Allow the panel port
sudo ufw allow 8080/tcp comment "ServerCraft"
sudo ufw reload
```

If you are on a cloud provider (AWS, GCP, Azure, DigitalOcean, Hetzner), also check your cloud-level security group / firewall rules — they are separate from UFW.

---

### Docker errors

---

#### `docker: Got permission denied while trying to connect to the Docker daemon socket`

**Cause:** Your user is not in the `docker` group, or you have not re-logged after being added to it.

**Fix:**
```bash
sudo usermod -aG docker $USER
# Log out and back in, then retry
```

Or run with sudo:
```bash
sudo docker compose up -d --build
```

---

#### `docker: command not found`

**Cause:** Docker Engine is not installed.

**Fix:**
```bash
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
```

Log out and back in, then verify:
```bash
docker --version
```

---

#### `docker compose: command not found` (but `docker-compose` works)

**Cause:** You have the old standalone `docker-compose` (v1) but the compose files require Docker Compose v2 (`docker compose` as a plugin).

**Fix:**
```bash
sudo apt-get install -y docker-compose-plugin
docker compose version   # should show v2.x
```

---

#### Docker build fails: `error: [Errno 28] No space left on device`

**Cause:** The server's disk is full. Docker build layers require temporary space.

**Fix:**
```bash
# Check disk usage
df -h

# Clean up old Docker images and build cache
docker system prune -af
```

---

#### Docker build fails: `exec /usr/local/bin/docker-entrypoint.sh: exec format error`

**Cause:** You are running an arm64 server (e.g. AWS Graviton, Raspberry Pi) and the base image or a package is built for amd64.

**Fix:** The `Dockerfile` uses `ubuntu:22.04` which supports both `amd64` and `arm64`. If a Python package wheel is not available for arm64, install extra build tools:

```bash
# In the Dockerfile, add before pip install:
RUN apt-get install -y gcc g++ make
```

---

#### Container starts then immediately exits

**Diagnosis:**
```bash
docker compose logs servercraft
```

**Common causes:**

| Log message | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError` | Python package install failed during build | Rebuild: `docker compose up -d --build --no-cache` |
| `Address already in use` | Host port 8080 is taken | Use `PANEL_PORT=9090 docker compose up -d --build` |
| `Permission denied` on `/opt/servercraft/...` | Volume mount ownership issue | `sudo chown -R 1000:1000 ./data ./servers ./mods ./logs ./steamcmd` |

---

#### `WARN: No resource found for ...` / volume mount errors

**Cause:** The host directories (`./data`, `./servers`, etc.) do not exist or are owned by root.

**Fix:**
```bash
mkdir -p data servers mods logs steamcmd
sudo chown -R $USER:$USER data servers mods logs steamcmd
docker compose up -d
```

---

### SteamCMD errors

---

#### SteamCMD download fails / `steamcmd.sh: not found`

**Cause:** SteamCMD did not download or extract correctly.

**Fix:**
```bash
# Check if lib32gcc-s1 is installed (required on 64-bit Linux)
sudo apt-get install -y lib32gcc-s1

# Manually download and extract SteamCMD
mkdir -p /opt/servercraft/steamcmd
cd /opt/servercraft/steamcmd
wget https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz
tar -xvzf steamcmd_linux.tar.gz
chmod +x steamcmd.sh
./steamcmd.sh +quit
```

---

#### `Error! App '...' state is 0x202 after update job`

**Cause:** SteamCMD cannot download the game — usually a Steam login issue or the game requires a paid Steam account.

**Fix:** Ensure you have provided valid Steam credentials for games that require a login (e.g. Arma 3, DayZ, Rust). Anonymous login only works for free-to-download server binaries (e.g. Project Zomboid, Valheim).

---

#### `SIGILL / Illegal instruction` from steamcmd

**Cause:** The server CPU does not support SSE2 instructions (very old hardware) or you are running under an emulated environment.

**Fix:** SteamCMD requires at minimum a CPU with SSE2. If you are running in a VM, ensure the host exposes the full CPU instruction set to the guest.

---

### AAPanel / Nginx errors

---

#### `502 Bad Gateway` behind AAPanel

**Cause:** Nginx cannot reach the panel — the container or service is not running, or is listening on the wrong address/port.

**Diagnosis:**

1. Confirm the service is up: `docker compose -f docker-compose.aapanel.yml ps`
2. Confirm it is listening on `127.0.0.1:8080`: `sudo ss -tlnp | grep 8080`
3. Test locally: `curl http://127.0.0.1:8080/api/health`

**Fix:**
```bash
docker compose -f docker-compose.aapanel.yml restart servercraft
```

---

#### `504 Gateway Timeout` for long operations

**Cause:** Nginx's default proxy timeout is too short for long-running tasks (e.g. installing a large game server).

**Fix:** In your AAPanel Nginx config for the site, increase the timeout:

```nginx
proxy_read_timeout 3600;
proxy_connect_timeout 60;
proxy_send_timeout 600;
```

---

#### WebSocket connections fail / console shows `WebSocket connection failed`

**Cause:** The Nginx reverse proxy is not forwarding WebSocket upgrade headers.

**Fix:** Ensure your Nginx config includes these lines inside the `location /` block:

```nginx
proxy_http_version 1.1;
proxy_set_header   Upgrade $http_upgrade;
proxy_set_header   Connection "upgrade";
proxy_read_timeout 86400;
```

---

#### Let's Encrypt SSL fails in AAPanel

**Cause:** Port 80 is blocked by a cloud firewall, or the domain does not point to your server's IP yet.

**Fix:**
1. Confirm your domain's A record resolves to your server's public IP: `nslookup your-domain.com`
2. Ensure port 80 is open in your cloud security group / AAPanel firewall
3. Try again in AAPanel → SSL → Let's Encrypt

---

### General diagnostics

**Get all service logs:**
```bash
# Native
journalctl -u servercraft --since "1 hour ago"

# Docker
docker compose logs --since 1h servercraft
```

**Check what is listening on all ports:**
```bash
sudo ss -tlnp
```

**Check disk and memory:**
```bash
df -h
free -h
```

**Test the API directly:**
```bash
curl http://localhost:8080/api/health
```

A healthy response looks like:
```json
{"status": "ok"}
```

---

*ServerCraft Linux Edition — © 2026 TierOne Development. All rights reserved.*
