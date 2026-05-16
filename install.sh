#!/bin/bash
# ┌─────────────────────────────────────────────────────────────────────────────┐
# │              ServerCraft Linux Edition — Installer                          │
# │    Ubuntu 22.04 LTS / 24.04 LTS  •  Debian 11 (Bullseye) / 12 (Bookworm)  │
# │                                                                             │
# │  Usage:                                                                     │
# │    sudo bash install.sh                    # default port 8080              │
# │    sudo SERVERCRAFT_PORT=9000 bash install.sh  # custom port               │
# │    sudo bash install.sh --docker           # Docker setup instead           │
# └─────────────────────────────────────────────────────────────────────────────┘
set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
step()  { echo -e "\n${CYAN}${BOLD}▶  $*${NC}"; }
ok()    { echo -e "${GREEN}✔${NC}  $*"; }

# ── Configuration ──────────────────────────────────────────────────────────────
PANEL_PORT="${SERVERCRAFT_PORT:-8080}"
INSTALL_DIR="/opt/servercraft"
SERVICE_USER="servercraft"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_MODE="native"  # native | docker

# Parse flags
for arg in "$@"; do
    case "$arg" in
        --docker) INSTALL_MODE="docker" ;;
        --port=*) PANEL_PORT="${arg#--port=}" ;;
        *) ;;
    esac
done

# ── Root check ─────────────────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || error "Run as root:  sudo bash install.sh"

# ── OS check ──────────────────────────────────────────────────────────────────
if [ ! -f /etc/os-release ]; then
    error "Cannot detect OS. Ubuntu 22.04+ or Debian 11+ required."
fi
. /etc/os-release
if [ "$ID" != "ubuntu" ] && [ "$ID" != "debian" ]; then
    error "This installer requires Ubuntu 22.04+ or Debian 11+. Detected: $ID $VERSION_ID"
fi
OS_MAJOR=$(echo "$VERSION_ID" | cut -d. -f1)
OS_MINOR=$(echo "$VERSION_ID" | cut -d. -f2)
if [ "$ID" = "ubuntu" ] && [ "$OS_MAJOR" -lt 22 ]; then
    error "Ubuntu 22.04 LTS or newer required. Detected: $VERSION_ID"
fi
if [ "$ID" = "debian" ] && [ "$OS_MAJOR" -lt 11 ]; then
    error "Debian 11 (Bullseye) or newer required. Detected: $VERSION_ID"
fi

# ── Banner ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         ServerCraft Linux Edition Installer          ║${NC}"
echo -e "${CYAN}║         ${ID^} ${VERSION_ID} — Mode: ${INSTALL_MODE}                  ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
info "Install directory : $INSTALL_DIR"
info "Panel port        : $PANEL_PORT"
info "Service user      : $SERVICE_USER"
info "Source directory  : $SCRIPT_DIR"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
#  DOCKER MODE
# ─────────────────────────────────────────────────────────────────────────────
if [ "$INSTALL_MODE" = "docker" ]; then
    step "Docker install mode selected"

    # Install Docker if missing
    if ! command -v docker &>/dev/null; then
        info "Installing Docker Engine..."
        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg lsb-release
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL "https://download.docker.com/linux/${ID}/gpg" \
            | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/${ID} $(lsb_release -cs) stable" \
            > /etc/apt/sources.list.d/docker.list
        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
        systemctl enable --now docker
        ok "Docker installed"
    else
        ok "Docker already installed: $(docker --version)"
    fi

    # Ensure docker compose v2
    if ! docker compose version &>/dev/null 2>&1; then
        apt-get install -y -qq docker-compose-plugin
    fi

    # Create data directories on the host
    mkdir -p \
        "$SCRIPT_DIR/data" \
        "$SCRIPT_DIR/servers" \
        "$SCRIPT_DIR/mods" \
        "$SCRIPT_DIR/logs" \
        "$SCRIPT_DIR/steamcmd"

    # Build and start
    info "Building Docker image and starting containers..."
    cd "$SCRIPT_DIR"
    docker compose up -d --build

    LOCAL_IP=$(hostname -I | awk '{print $1}')
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           Docker Installation Complete!              ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BOLD}Panel URL      :${NC} http://${LOCAL_IP}:${PANEL_PORT}"
    echo -e "  ${BOLD}Localhost      :${NC} http://localhost:${PANEL_PORT}"
    echo -e "  ${BOLD}Default login  :${NC} Admin / Password123!"
    echo ""
    echo -e "  ${YELLOW}⚠  Change your password immediately after first login!${NC}"
    echo ""
    echo -e "  Useful commands:"
    echo -e "    docker compose logs -f servercraft"
    echo -e "    docker compose restart servercraft"
    echo -e "    docker compose down"
    echo ""
    exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
#  NATIVE / SYSTEMD MODE
# ─────────────────────────────────────────────────────────────────────────────

# ── Step 1: System packages ────────────────────────────────────────────────────
step "Step 1/7 — Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
    curl wget git ca-certificates gnupg lsb-release \
    software-properties-common build-essential \
    lib32gcc-s1 libssl-dev libffi-dev \
    ufw net-tools rsync
ok "System packages ready"

# ── Python setup ───────────────────────────────────────────────────────────────
if [ "$ID" = "ubuntu" ] && [ "$OS_MAJOR" -eq 22 ]; then
    # Ubuntu 22.04 ships Python 3.10; pull 3.11 from deadsnakes PPA
    info "Ubuntu 22.04: Adding deadsnakes PPA for Python 3.11..."
    add-apt-repository -y ppa:deadsnakes/ppa -n
    apt-get update -qq
    apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip
    PYTHON_BIN="python3.11"
elif [ "$ID" = "ubuntu" ]; then
    # Ubuntu 24.04+ ships Python 3.12
    apt-get install -y -qq python3 python3-venv python3-dev python3-pip python3.12-venv
    PYTHON_BIN="python3"
elif [ "$ID" = "debian" ] && [ "$OS_MAJOR" -le 11 ]; then
    # Debian 11 (Bullseye) ships Python 3.9; pull 3.11 from official backports
    info "Debian 11: Installing Python 3.11 from bullseye-backports..."
    echo "deb http://deb.debian.org/debian bullseye-backports main" \
        > /etc/apt/sources.list.d/backports.list
    apt-get update -qq
    apt-get install -y -t bullseye-backports -qq python3.11 python3.11-venv python3.11-dev
    apt-get install -y -qq python3-pip
    PYTHON_BIN="python3.11"
else
    # Debian 12+ (Bookworm) ships Python 3.11 built-in
    apt-get install -y -qq python3 python3-venv python3-dev python3-pip
    PYTHON_BIN="python3"
fi
ok "Python ready: $($PYTHON_BIN --version)"

# ── Step 2: Node.js 20 LTS ────────────────────────────────────────────────────
step "Step 2/7 — Installing Node.js 20 LTS"
NODE_MAJOR=0
if command -v node &>/dev/null; then
    NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
fi
if [ "$NODE_MAJOR" -lt 20 ]; then
    info "Installing Node.js 20 LTS from NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
    apt-get install -y -qq nodejs
fi
ok "Node.js $(node --version)"

if ! command -v yarn &>/dev/null; then
    npm install -g yarn --silent
fi
ok "Yarn $(yarn --version)"

# ── Step 3: Service user and directories ──────────────────────────────────────
step "Step 3/7 — Creating user and directory structure"
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd -r -s /bin/bash -d "$INSTALL_DIR" -m "$SERVICE_USER"
    ok "Created system user: $SERVICE_USER"
else
    ok "User $SERVICE_USER already exists"
fi

mkdir -p \
    "$INSTALL_DIR/backend" \
    "$INSTALL_DIR/frontend" \
    "$INSTALL_DIR/data" \
    "$INSTALL_DIR/servers" \
    "$INSTALL_DIR/mods" \
    "$INSTALL_DIR/logs" \
    "$INSTALL_DIR/steamcmd"

# ── Step 4: Copy application files ────────────────────────────────────────────
step "Step 4/7 — Installing application files"
rsync -a \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='*.pyo' \
    --exclude='.git' \
    "$SCRIPT_DIR/backend/" "$INSTALL_DIR/backend/"

rsync -a \
    --exclude='node_modules' \
    --exclude='build' \
    --exclude='.git' \
    "$SCRIPT_DIR/frontend/" "$INSTALL_DIR/frontend/"

ok "Application files copied"

# ── Step 5: Python virtual environment ────────────────────────────────────────
step "Step 5/7 — Setting up Python virtual environment"
if [ ! -d "$INSTALL_DIR/venv" ]; then
    $PYTHON_BIN -m venv "$INSTALL_DIR/venv"
fi

"$INSTALL_DIR/venv/bin/pip" install --upgrade pip wheel setuptools --quiet
"$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/backend/requirements.txt" --quiet
ok "Python requirements installed"

# ── Step 6: Build React frontend ──────────────────────────────────────────────
step "Step 6/7 — Building React frontend"
cd "$INSTALL_DIR/frontend"
export NODE_OPTIONS="--max-old-space-size=2048"

# Install node_modules
yarn install --silent

yarn build --silent
ok "React build complete"

# Deploy built files to backend/static/ (where FastAPI looks)
mkdir -p "$INSTALL_DIR/backend/static"
rsync -a --delete "$INSTALL_DIR/frontend/build/" "$INSTALL_DIR/backend/static/"
ok "Frontend deployed to backend/static/"

# ── Permissions ────────────────────────────────────────────────────────────────
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# ── Step 7: Systemd service ───────────────────────────────────────────────────
step "Step 7/7 — Installing systemd service and firewall"
cat > /etc/systemd/system/servercraft.service << UNIT
[Unit]
Description=ServerCraft Linux Edition — Game Server Panel
Documentation=https://github.com/OfficialMikeJ/ServerCraft-Linux
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}/backend

ExecStart=${INSTALL_DIR}/venv/bin/uvicorn server:app \
    --host 0.0.0.0 \
    --port ${PANEL_PORT} \
    --log-level info

Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=servercraft

# Environment
Environment=SERVERCRAFT_PORT=${PANEL_PORT}
Environment=SERVERCRAFT_ROOT_DIR=${INSTALL_DIR}/backend

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${INSTALL_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable servercraft
systemctl restart servercraft
ok "systemd service installed and started"

# ── Firewall ───────────────────────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
    ufw allow "${PANEL_PORT}/tcp"   comment "ServerCraft Panel"    2>/dev/null || true
    ufw allow "27000:27050/tcp"     comment "Steam game servers"   2>/dev/null || true
    ufw allow "27000:27050/udp"     comment "Steam game servers"   2>/dev/null || true
    ufw allow "9600:9630/tcp"       comment "ServerCraft game UDP" 2>/dev/null || true
    ufw allow "9600:9630/udp"       comment "ServerCraft game UDP" 2>/dev/null || true
    ok "UFW rules added"
fi

# ── Done ───────────────────────────────────────────────────────────────────────
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Installation Complete!                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Panel URL      :${NC} http://${LOCAL_IP}:${PANEL_PORT}"
echo -e "  ${BOLD}Localhost      :${NC} http://localhost:${PANEL_PORT}"
echo -e "  ${BOLD}Install dir    :${NC} $INSTALL_DIR"
echo -e "  ${BOLD}Default login  :${NC} Admin / Password123!"
echo ""
echo -e "  ${YELLOW}⚠  Change your password immediately after first login!${NC}"
echo ""
echo -e "  Service commands:"
echo -e "    systemctl status servercraft"
echo -e "    systemctl restart servercraft"
echo -e "    journalctl -u servercraft -f"
echo ""
