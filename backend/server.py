"""ServerCraft Linux Edition - Main Server
Version: 2025.18.12.0A
Copyright 2026 TierOne Development
"""

import sys
import os

def early_error_handler(exc_type, exc_value, exc_traceback):
    import traceback
    error_msg = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))
    print(f"\n{'='*60}")
    print("FATAL ERROR - ServerCraft failed to start:")
    print('='*60)
    print(error_msg)
    print('='*60)
    try:
        with open('servercraft_error.log', 'w') as f:
            f.write(error_msg)
        print("Error log saved to: servercraft_error.log")
    except Exception:
        pass
    sys.exit(1)

sys.excepthook = early_error_handler

print("ServerCraft - Starting up...")
print(f"Python version: {sys.version}")

try:
    from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Request
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import HTMLResponse, FileResponse
except ImportError as e:
    print(f"Failed to import FastAPI: {e}")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError as e:
    print(f"Failed to import dotenv: {e}")
    sys.exit(1)

try:
    from starlette.middleware.cors import CORSMiddleware
except ImportError as e:
    print(f"Failed to import starlette: {e}")
    sys.exit(1)

import json
import asyncio
import logging
from pathlib import Path

try:
    from pydantic import BaseModel, Field
except ImportError as e:
    print(f"Failed to import pydantic: {e}")
    sys.exit(1)

from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

try:
    import psutil
except ImportError as e:
    print(f"Failed to import psutil: {e}")
    sys.exit(1)

import socket


BASE_DIR = Path(__file__).parent
ROOT_DIR = Path(os.environ.get("SERVERCRAFT_ROOT_DIR", str(BASE_DIR)))

# Add managers to path
sys.path.insert(0, str(BASE_DIR))

# Create required directories on first run
def ensure_directories():
    """Create required directories if they don't exist"""
    dirs = [
        ROOT_DIR / 'data',
        ROOT_DIR / 'servers',
        ROOT_DIR / 'mods',
        ROOT_DIR / 'logs',
        ROOT_DIR / 'steamcmd'
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    
    # Create default config files if they don't exist
    config_file = ROOT_DIR / 'data' / 'config.json'
    if not config_file.exists():
        import json as _json
        config_file.write_text(_json.dumps({
            "upnp_enabled": False,
            "servers_path": str(ROOT_DIR / "servers"),
            "mods_path": str(ROOT_DIR / "mods"),
            "steamcmd_path": str(ROOT_DIR / "steamcmd"),
        }))
    
    servers_file = ROOT_DIR / 'data' / 'servers.json'
    if not servers_file.exists():
        servers_file.write_text('{}')
    
    states_file = ROOT_DIR / 'data' / 'states.json'
    if not states_file.exists():
        states_file.write_text('{}')

# Ensure directories exist before importing managers
ensure_directories()

from managers.steamcmd_manager import SteamCMDManager
from managers.server_manager import ServerManager
from managers.upnp_manager import UPnPManager
from managers.system_monitor import SystemMonitor
from managers.workshop_manager import WorkshopManager
from managers.config_manager import ConfigManager
from managers.auth_manager import AuthManager
from managers.cluster_manager import ClusterManager
from managers.analytics_manager import AnalyticsManager, AdminAnalyticsManager
from managers.marketplace_manager import MarketplaceManager, MARKETPLACE_TOS
from managers.twofa_manager import TwoFactorAuthManager
from managers.custom_domain_manager import CustomDomainManager
from managers.server_sales_manager import ServerSalesManager
from managers.nginx_proxy_manager import NginxProxyManager
from managers.sub_user_manager import SubUserManager, ROLES as SUB_USER_ROLES
from managers.mod_cache_manager import ModCacheManager

# Load env from data path
load_dotenv(ROOT_DIR / '.env')

# Initialize managers with error handling
try:
    config_manager = ConfigManager(ROOT_DIR / 'data')
    auth_manager = AuthManager(ROOT_DIR / 'data')
    cluster_manager = ClusterManager(ROOT_DIR / 'data')
    analytics_manager = AnalyticsManager(ROOT_DIR / 'data')
    admin_analytics = AdminAnalyticsManager(ROOT_DIR / 'data')
    marketplace_manager = MarketplaceManager(ROOT_DIR / 'data')
    twofa_manager = TwoFactorAuthManager(ROOT_DIR / 'data')
    custom_domain_manager = CustomDomainManager(ROOT_DIR / 'data')
    server_sales_manager = ServerSalesManager(ROOT_DIR / 'data')
    nginx_proxy_manager = NginxProxyManager(ROOT_DIR / 'data')
    sub_user_manager = SubUserManager(ROOT_DIR / 'data')
    mod_cache_manager = ModCacheManager(ROOT_DIR)
    steamcmd_manager = SteamCMDManager(config_manager)
    server_manager = ServerManager(config_manager)
    upnp_manager = UPnPManager()
    system_monitor = SystemMonitor()
    workshop_manager = WorkshopManager(steamcmd_manager, mod_cache_manager)
    
    # Track app launch
    analytics_manager.track_launch()
except Exception as e:
    import traceback
    print(f"ERROR initializing managers: {e}")
    traceback.print_exc()
    sys.exit(1)


# App version
APP_VERSION = "2026.3.0-BETA"
APP_NAME = "ServerCraft - Linux Edition"
COPYRIGHT = "© 2026 TierOne Development"

# GitHub releases URL for self-update
GITHUB_RELEASES_URL = "https://api.github.com/repos/OfficialMikeJ/ServerCraft-Linux/releases/latest"
GITHUB_RELEASES_PAGE = "https://github.com/OfficialMikeJ/ServerCraft-Linux/releases"

# Update channel configuration
UPDATE_CONFIG = {
    "check_interval_seconds": 3600,  # Check every hour
    "auto_check_enabled": True,
    "release_goal": "2026.12.20",  # December 20th 2026 - last 2026 release
    "v1_target": "December 2026"
}

# Version History
VERSION_HISTORY = [
    {
        "version": "2026.3.0-BETA",
        "date": "2026-03-XX",
        "type": "major",
        "changes": [
            "Nginx Proxy Manager Integration - Replace DuckDNS with NPM for SSL & reverse proxy",
            "Full Sub-Server User System (Beta) - Admin/Moderator/Viewer roles",
            "Template Marketplace Polish & Versioning System",
            "Full Mod Caching System for faster re-downloads",
            "Arma Reforger fully integrated end-to-end",
            "All 14+ supported games listed across all views",
            "Removed DuckDNS integration"
        ]
    },
    {
        "version": "2026.2.0",
        "date": "2026-02-XX",
        "type": "major",
        "changes": [
            "🛒 FULL Template Marketplace Implementation",
            "📤 Template Export & Upload System with version numbers",
            "📸 Required Screenshots (minimum 3) for template submissions",
            "👤 Username-based spam reporting system",
            "⏱️ Rate Limiting: 1 template upload per month per user",
            "🔒 Account Age Requirement: 24 hours to access marketplace",
            "📜 Terms of Service agreement with checkbox confirmation",
            "🛡️ IP & Geo-location logging for admin spam prevention",
            "📊 Marketplace admin dashboard for moderation",
            "⬇️ Template download with automatic JSON export"
        ]
    },
    {
        "version": "2026.1.6.C",
        "date": "2026-01-06",
        "type": "major",
        "changes": [
            "Added Node Clustering and Node Linking for multi-machine resource pooling",
            "Implemented Pterodactyl-style port allocation system for clusters",
            "Added optional clustering feature with toggle in settings",
            "Created comprehensive cluster management interface",
            "🚀 QOL: Auto-Discovery of Local Network Nodes via UDP broadcast",
            "🔗 QOL: One-Click Node Pairing - Use pairing codes to connect nodes instantly",
            "⚡ QOL: Zero-Config Node Setup - Intelligent defaults for storage, ports, and resources",
            "🎯 QOL: Automatic Port Management - Smart port allocation with 100-port range per game",
            "📊 QOL: Node Health Dashboard - Real-time monitoring with connection status",
            "🌐 Enhanced: DuckDNS Integration (Early Access) - Improved domain management",
            "🛒 Template Marketplace preview (Coming Soon)",
            "🌐 Website Integration: Connected to servercraft.dev for analytics sync"
        ]
    },
    {
        "version": "2025.20.12.21C-bug",
        "date": "2025-12-21",
        "type": "minor",
        "changes": [
            "Added local authentication system with username/password login",
            "Default credentials (Admin/Password123!) must be changed on first login",
            "Added security questions for password recovery (3 of 5 questions)",
            "Added 'Remember me for 30 days' option to stay logged in",
            "Added AFK auto-logout after 15 minutes of inactivity",
            "Added winter theme with animated falling snowflakes (Dec-Feb)",
            "Added user badge and logout button to header",
            "Replaced all placeholder emojis with Font Awesome icons"
        ]
    },
    {
        "version": "2026.6.1.C",
        "date": "2026-01-06",
        "type": "major",
        "changes": [
            "Added 6 new supported games: Ground Branch, ICARUS, No One Survived, GTA V RP (FiveM), Source Engine games, expanded DayZ support",
            "Added game tags with color coding (milsim, survival, pvp, roleplay, etc.)",
            "Further optimized resource usage for both offline and online servers",
            "Added resource warning about heavy gameplay instances",
            "Started Steam Workshop integration - browse and download mods for any game",
            "Enhanced mod support for games not requiring ownership",
            "Added disclaimer and warranty notice to specs popup"
        ]
    },
    {
        "version": "2025.19.12.19B-fix",
        "date": "2025-12-19",
        "type": "fix",
        "changes": [
            "Fixed PyInstaller executable crash on startup",
            "Added comprehensive error handling and debugging output",
            "Added Start-ServerCraft.bat launcher for better error visibility",
            "Added 30+ hidden imports for PyInstaller compatibility",
            "Error logs now saved to servercraft_error.log",
            "Console window now shows import status during startup"
        ]
    },
    {
        "version": "2025.19.12.0B",
        "date": "2025-12-19",
        "type": "minor",
        "changes": [
            "Recompiled the full panel into a proper portable executable file instead of unpacked data",
            "Added PyInstaller to the required packages to compile the panel properly",
            "Added About tab with version history and update notes"
        ]
    },
    {
        "version": "2025.18.12.0A",
        "date": "2025-12-18",
        "type": "major",
        "changes": [
            "Initial release of ServerCraft Windows Edition",
            "Native Windows application without Docker dependency",
            "SteamCMD integration for downloading and updating game servers",
            "Support for Steam Guard 2FA codes",
            "UPnP automatic port forwarding",
            "Real-time system monitoring (CPU, RAM, Network, Disk)",
            "Tabbed interface for managing multiple servers",
            "Steam Workshop mod downloading support",
            "Support for Arma 3, DayZ, Rust, Arma Reforger, Project Zomboid, Valheim, Squad, Minecraft"
        ]
    }
]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title=APP_NAME, version=APP_VERSION)
api_router = APIRouter(prefix="/api")

# WebSocket connections for real-time updates
active_connections: Dict[str, List[WebSocket]] = {
    "console": [],
    "stats": [],
    "servers": []
}

# Pydantic Models
class ServerConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    game: str
    port: int
    query_port: Optional[int] = None
    rcon_port: Optional[int] = None
    max_players: int = 32
    map_name: Optional[str] = None
    password: Optional[str] = None
    rcon_password: Optional[str] = None
    mods: List[str] = Field(default_factory=list)
    custom_params: str = ""
    auto_start: bool = False
    upnp_enabled: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CreateServerRequest(BaseModel):
    name: str
    game: str
    port: int
    query_port: Optional[int] = None
    rcon_port: Optional[int] = None
    max_players: int = 32
    map_name: Optional[str] = None
    password: Optional[str] = None
    rcon_password: Optional[str] = None
    custom_params: str = ""
    auto_start: bool = False
    upnp_enabled: bool = False

class SteamLoginRequest(BaseModel):
    username: str
    password: str
    guard_code: Optional[str] = None

class SteamGuardRequest(BaseModel):
    code: str

class UPnPRequest(BaseModel):
    enabled: bool
    port: int
    protocol: str = "UDP"
    description: str = "ServerCraft"

class WorkshopModRequest(BaseModel):
    game: str
    mod_ids: List[str]

class ModlistUploadRequest(BaseModel):
    game: str
    html_content: str

# Auth Models
class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ChangeUsernameRequest(BaseModel):
    new_username: str

class SecurityQuestionsRequest(BaseModel):
    questions: List[Dict[str, str]]

class VerifySecurityRequest(BaseModel):
    answers: List[str]

class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str

# Cluster Models
class CreateClusterRequest(BaseModel):
    name: str
    description: str = ""

class UpdateClusterRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class AddNodeRequest(BaseModel):
    name: str
    ip: str
    cpu_cores: int = 0
    ram_gb: float = 0
    description: str = ""

class UpdateNodeRequest(BaseModel):
    name: Optional[str] = None
    ip: Optional[str] = None
    cpu_cores: Optional[int] = None
    ram_gb: Optional[float] = None
    description: Optional[str] = None

class CreatePortAllocationRequest(BaseModel):
    ip: str
    port_start: int
    port_end: int
    alias: str = ""
    notes: str = ""

class UpdatePortAllocationRequest(BaseModel):
    alias: Optional[str] = None
    notes: Optional[str] = None

class AddStoragePathRequest(BaseModel):
    path: str
    storage_type: str = "local"
    total_gb: float = 0
    alias: str = ""

class UpdateStoragePathRequest(BaseModel):
    path: Optional[str] = None
    storage_type: Optional[str] = None
    total_gb: Optional[float] = None
    alias: Optional[str] = None

# Nginx Proxy Manager Models
class NPMConnectionRequest(BaseModel):
    url: str
    email: str
    password: str

class NPMProxyHostRequest(BaseModel):
    domain_names: List[str]
    forward_host: str
    forward_port: int = 8001
    ssl: bool = True

# Sub-User Models
class CreateSubUserRequest(BaseModel):
    username: str
    password: str
    role: str = "viewer"
    assigned_servers: List[str] = Field(default_factory=list)

class UpdateSubUserRequest(BaseModel):
    role: Optional[str] = None
    assigned_servers: Optional[List[str]] = None
    active: Optional[bool] = None
    password: Optional[str] = None

class SubUserLoginRequest(BaseModel):
    username: str
    password: str

# Analytics & Feedback Models
class FeedbackSubmission(BaseModel):
    answers: Dict[str, Any]
    additional_feedback: str

class AnalyticsReceive(BaseModel):
    type: str
    device_id: str
    data: Dict
    timestamp: str

class AdminLoginRequest(BaseModel):
    username: str
    password: str

# Game definitions with Steam App IDs and Tags
# Game-specific port ranges (100 ports each for auto-allocation)
# Ranges are carefully designed to avoid overlaps
GAME_PORT_RANGES = {
    "arma3": {"start": 2302, "end": 2401, "query_offset": 1},
    "dayz_vanilla": {"start": 2602, "end": 2701, "query_offset": 27714},
    "dayz_modded": {"start": 2702, "end": 2801, "query_offset": 27714},
    "rust": {"start": 28015, "end": 28114, "query_offset": 1},
    "arma_reforger": {"start": 2001, "end": 2100, "query_offset": 15776},
    "project_zomboid": {"start": 16261, "end": 16360, "query_offset": 1},
    "valheim": {"start": 2456, "end": 2555, "query_offset": 1},
    "squad": {"start": 7900, "end": 7999, "query_offset": 19378},
    "ground_branch": {"start": 7777, "end": 7876, "query_offset": 0},
    "icarus": {"start": 17777, "end": 17876, "query_offset": 0},
    "no_one_survived": {"start": 8000, "end": 8099, "query_offset": 0},
    "fivem": {"start": 30120, "end": 30219, "query_offset": 0},
    "source_engine": {"start": 27015, "end": 27114, "query_offset": 0},
    "minecraft": {"start": 25565, "end": 25664, "query_offset": 0},
    "teamspeak3": {"start": 9987, "end": 10086, "query_offset": 10024}
}

GAME_DEFINITIONS = {
    "arma3": {
        "name": "Arma 3",
        "app_id": "233780",
        "server_app_id": "233780",
        "requires_login": True,
        "requires_ownership": True,
        "default_port": 2302,
        "port_range": GAME_PORT_RANGES["arma3"],
        "executable": "arma3server_x64.exe",
        "workshop_id": "107410",
        "tags": [
            {"name": "milsim", "color": "#22c55e"},
            {"name": "open-world", "color": "#3b82f6"},
            {"name": "tactical", "color": "#f59e0b"}
        ],
        "description": "Military simulation with massive open-world battles"
    },
    "dayz_vanilla": {
        "name": "DayZ (Vanilla)",
        "app_id": "221100",
        "server_app_id": "223350",
        "requires_login": True,
        "requires_ownership": False,
        "default_port": 2302,
        "port_range": GAME_PORT_RANGES["dayz_vanilla"],
        "executable": "DayZServer_x64.exe",
        "workshop_id": "221100",
        "tags": [
            {"name": "survival", "color": "#ef4444"},
            {"name": "zombie", "color": "#8b5cf6"},
            {"name": "open-world", "color": "#3b82f6"}
        ],
        "description": "Post-apocalyptic survival - vanilla experience"
    },
    "dayz_modded": {
        "name": "DayZ (Modded)",
        "app_id": "221100",
        "server_app_id": "223350",
        "requires_login": True,
        "requires_ownership": False,
        "default_port": 2302,
        "port_range": GAME_PORT_RANGES["dayz_modded"],
        "executable": "DayZServer_x64.exe",
        "workshop_id": "221100",
        "tags": [
            {"name": "survival", "color": "#ef4444"},
            {"name": "zombie", "color": "#8b5cf6"},
            {"name": "modded", "color": "#ec4899"}
        ],
        "description": "Post-apocalyptic survival with full mod support"
    },
    "rust": {
        "name": "Rust",
        "app_id": "252490",
        "server_app_id": "258550",
        "requires_login": False,
        "requires_ownership": False,
        "default_port": 28015,
        "port_range": GAME_PORT_RANGES["rust"],
        "executable": "RustDedicated.exe",
        "workshop_id": "252490",
        "tags": [
            {"name": "survival", "color": "#ef4444"},
            {"name": "pvp", "color": "#f97316"},
            {"name": "base-building", "color": "#14b8a6"}
        ],
        "description": "Hardcore survival with base building and PvP"
    },
    "arma_reforger": {
        "name": "Arma Reforger",
        "app_id": "1874900",
        "server_app_id": "1874900",
        "requires_login": True,
        "requires_ownership": True,
        "default_port": 2001,
        "port_range": GAME_PORT_RANGES["arma_reforger"],
        "executable": "ArmaReforgerServer.exe",
        "workshop_id": "1874900",
        "tags": [
            {"name": "milsim", "color": "#22c55e"},
            {"name": "tactical", "color": "#f59e0b"},
            {"name": "next-gen", "color": "#06b6d4"}
        ],
        "description": "Next-generation military simulation on Enfusion engine"
    },
    "project_zomboid": {
        "name": "Project Zomboid",
        "app_id": "108600",
        "server_app_id": "380870",
        "requires_login": False,
        "requires_ownership": False,
        "default_port": 16261,
        "port_range": GAME_PORT_RANGES["project_zomboid"],
        "executable": "StartServer64.bat",
        "workshop_id": "108600",
        "tags": [
            {"name": "survival", "color": "#ef4444"},
            {"name": "zombie", "color": "#8b5cf6"},
            {"name": "isometric", "color": "#a855f7"}
        ],
        "description": "Isometric zombie survival with deep crafting systems"
    },
    "valheim": {
        "name": "Valheim",
        "app_id": "892970",
        "server_app_id": "896660",
        "requires_login": False,
        "requires_ownership": False,
        "default_port": 2456,
        "port_range": GAME_PORT_RANGES["valheim"],
        "executable": "valheim_server.exe",
        "workshop_id": "892970",
        "tags": [
            {"name": "survival", "color": "#ef4444"},
            {"name": "viking", "color": "#f59e0b"},
            {"name": "co-op", "color": "#22c55e"}
        ],
        "description": "Viking survival with exploration and boss battles"
    },
    "squad": {
        "name": "Squad",
        "app_id": "393380",
        "server_app_id": "403240",
        "requires_login": False,
        "requires_ownership": False,
        "default_port": 7787,
        "port_range": GAME_PORT_RANGES["squad"],
        "executable": "SquadGameServer.exe",
        "workshop_id": "393380",
        "tags": [
            {"name": "milsim", "color": "#22c55e"},
            {"name": "tactical", "color": "#f59e0b"},
            {"name": "teamwork", "color": "#3b82f6"}
        ],
        "description": "Large-scale combined arms combat with emphasis on teamwork"
    },
    "ground_branch": {
        "name": "Ground Branch",
        "app_id": "16900",
        "server_app_id": "476400",
        "requires_login": False,
        "requires_ownership": False,
        "default_port": 7777,
        "port_range": GAME_PORT_RANGES["ground_branch"],
        "executable": "GroundBranchServer.exe",
        "workshop_id": "16900",
        "tags": [
            {"name": "tactical", "color": "#f59e0b"},
            {"name": "milsim", "color": "#22c55e"},
            {"name": "cqb", "color": "#ef4444"}
        ],
        "description": "Tactical shooter focused on CQB and special operations"
    },
    "icarus": {
        "name": "ICARUS",
        "app_id": "1149460",
        "server_app_id": "1149480",
        "requires_login": False,
        "requires_ownership": False,
        "default_port": 17777,
        "port_range": GAME_PORT_RANGES["icarus"],
        "executable": "IcarusServer.exe",
        "workshop_id": "1149460",
        "tags": [
            {"name": "survival", "color": "#ef4444"},
            {"name": "sci-fi", "color": "#06b6d4"},
            {"name": "crafting", "color": "#14b8a6"}
        ],
        "description": "Session-based survival on an alien world"
    },
    "no_one_survived": {
        "name": "No One Survived",
        "app_id": "1963370",
        "server_app_id": "1963370",
        "requires_login": True,
        "requires_ownership": False,
        "default_port": 7777,
        "port_range": GAME_PORT_RANGES["no_one_survived"],
        "executable": "NoOneSurvivedServer.exe",
        "workshop_id": "1963370",
        "tags": [
            {"name": "survival", "color": "#ef4444"},
            {"name": "zombie", "color": "#8b5cf6"},
            {"name": "open-world", "color": "#3b82f6"}
        ],
        "description": "Open-world zombie survival with base building"
    },
    "fivem": {
        "name": "GTA V RP (FiveM)",
        "app_id": None,
        "server_app_id": None,
        "requires_login": False,
        "requires_ownership": False,
        "default_port": 30120,
        "port_range": GAME_PORT_RANGES["fivem"],
        "executable": "FXServer.exe",
        "workshop_id": None,
        "custom_install": True,
        "tags": [
            {"name": "roleplay", "color": "#ec4899"},
            {"name": "open-world", "color": "#3b82f6"},
            {"name": "custom", "color": "#8b5cf6"}
        ],
        "description": "GTA V roleplay servers with custom scripts and mods"
    },
    "source_engine": {
        "name": "Source Engine (Generic)",
        "app_id": None,
        "server_app_id": "232250",
        "requires_login": False,
        "requires_ownership": False,
        "default_port": 27015,
        "port_range": GAME_PORT_RANGES["source_engine"],
        "executable": "srcds.exe",
        "workshop_id": None,
        "tags": [
            {"name": "fps", "color": "#f97316"},
            {"name": "classic", "color": "#6b7280"},
            {"name": "modular", "color": "#14b8a6"}
        ],
        "description": "Source Engine dedicated server for various games"
    },
    "minecraft": {
        "name": "Minecraft",
        "app_id": None,
        "server_app_id": None,
        "requires_login": False,
        "requires_ownership": False,
        "default_port": 25565,
        "port_range": GAME_PORT_RANGES["minecraft"],
        "executable": "server.jar",
        "workshop_id": None,
        "custom_install": True,
        "tags": [
            {"name": "sandbox", "color": "#22c55e"},
            {"name": "creative", "color": "#f59e0b"},
            {"name": "survival", "color": "#ef4444"}
        ],
        "description": "The iconic block-building sandbox game"
    },
    "teamspeak3": {
        "name": "TeamSpeak 3",
        "app_id": None,
        "server_app_id": None,
        "requires_login": False,
        "requires_ownership": False,
        "default_port": 9987,
        "port_range": GAME_PORT_RANGES["teamspeak3"],
        "executable": "ts3server.exe",
        "workshop_id": None,
        "custom_install": True,
        "tags": [
            {"name": "voice-chat", "color": "#3b82f6"},
            {"name": "communication", "color": "#8b5cf6"},
            {"name": "community", "color": "#06b6d4"}
        ],
        "description": "TeamSpeak 3 voice communication server. Free up to 32 slots.",
        "license_notice": "TeamSpeak 3 servers are free with up to 32 slots available. Servers that require more than 32 slots will require a license from TeamSpeak.",
        "license_url": "https://www.teamspeak.com/en/features/licensing/"
    }
}

# Helper function to get next available port for a game
def get_next_available_port(game: str, existing_servers: list) -> dict:
    """Get the next available port for a game from its port range"""
    if game not in GAME_DEFINITIONS:
        return {"port": 27015, "query_port": 27016}
    
    game_def = GAME_DEFINITIONS[game]
    port_range = game_def.get("port_range", {"start": game_def["default_port"], "end": game_def["default_port"] + 99, "query_offset": 1})
    
    # Get all ports currently in use for this game
    used_ports = set()
    for server in existing_servers:
        if server.get("game") == game:
            used_ports.add(server.get("port", 0))
    
    # Find next available port in range
    for port in range(port_range["start"], port_range["end"] + 1):
        if port not in used_ports:
            query_port = port + port_range.get("query_offset", 1)
            return {"port": port, "query_port": query_port}
    
    # Fallback to default if range is full
    return {"port": game_def["default_port"], "query_port": game_def["default_port"] + 1}

# WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {
            "console": [],
            "stats": [],
            "servers": []
        }
    
    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = []
        self.active_connections[channel].append(websocket)
    
    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_connections:
            if websocket in self.active_connections[channel]:
                self.active_connections[channel].remove(websocket)
    
    async def broadcast(self, message: dict, channel: str):
        if channel in self.active_connections:
            for connection in self.active_connections[channel]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

# API Routes
@api_router.get("/health")
async def health_check():
    return {"status": "ok"}

@api_router.get("/info")
async def get_app_info():
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "copyright": COPYRIGHT
    }

@api_router.get("/about")
async def get_about_info():
    """Get detailed about information including version history"""
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "copyright": COPYRIGHT,
        "version_history": VERSION_HISTORY
    }

# ==================== SETUP ROUTES ====================
@api_router.get("/setup/status")
async def get_setup_status():
    """Check whether first-run setup is still needed"""
    return {"needs_setup": auth_manager.is_first_run()}

class InitialSetupRequest(BaseModel):
    username: str
    password: str

@api_router.post("/setup/complete")
async def complete_setup(request: InitialSetupRequest):
    """Complete first-run setup by setting admin credentials"""
    if not auth_manager.is_first_run():
        return {"success": False, "error": "Setup has already been completed"}
    return auth_manager.complete_initial_setup(request.username, request.password)

# ==================== AUTH ROUTES ====================
@api_router.get("/auth/status")
async def get_auth_status():
    """Get current auth configuration status"""
    return auth_manager.get_auth_status()

@api_router.post("/auth/login")
async def login(request: LoginRequest):
    """Login with username and password"""
    result = auth_manager.login(request.username, request.password, request.remember_me)
    if not result.get("success"):
        raise HTTPException(status_code=401, detail=result.get("error", "Login failed"))
    
    # Check if 2FA is enabled
    if twofa_manager.is_enabled():
        # Store temporary session data for 2FA verification
        temp_token = result.get("token")
        return {
            "success": True,
            "requires_2fa": True,
            "temp_token": temp_token,
            "username": result.get("username")
        }
    
    return result

class TwoFALoginRequest(BaseModel):
    temp_token: str
    code: str

@api_router.post("/auth/2fa/verify-login")
async def verify_2fa_login(request: TwoFALoginRequest):
    """Verify 2FA code during login and return final session token"""
    # Verify the 2FA code
    verify_result = twofa_manager.verify_code(request.code)
    
    if not verify_result.get("success"):
        raise HTTPException(status_code=401, detail=verify_result.get("error", "Invalid 2FA code"))
    
    # Validate the temporary token and get user data
    user_data = get_user_from_token(request.temp_token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Return the full login response with the token
    return {
        "success": True,
        "token": request.temp_token,
        "username": user_data.get("username"),
        "must_change_password": user_data.get("must_change_password", False),
        "has_security_questions": user_data.get("has_security_questions", False),
        "message": verify_result.get("message", "2FA verified successfully")
    }

@api_router.post("/auth/logout")
async def logout(token: str = None):
    """Logout and invalidate session"""
    if token:
        auth_manager.logout(token)
    return {"success": True}

@api_router.post("/auth/validate")
async def validate_session(token: str):
    """Validate a session token"""
    result = auth_manager.validate_session(token)
    return result

@api_router.post("/auth/change-password")
async def change_password(request: ChangePasswordRequest, token: str = None):
    """Change user password"""
    if not token:
        raise HTTPException(status_code=401, detail="No session token")
    result = auth_manager.change_password(token, request.current_password, request.new_password)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@api_router.post("/auth/change-username")
async def change_username(request: ChangeUsernameRequest, token: str = None):
    """Change username"""
    if not token:
        raise HTTPException(status_code=401, detail="No session token")
    result = auth_manager.change_username(token, request.new_username)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@api_router.get("/auth/security-questions/available")
async def get_available_security_questions():
    """Get list of available security questions"""
    return {"questions": auth_manager.get_available_questions()}

@api_router.get("/auth/security-questions")
async def get_user_security_questions():
    """Get user's configured security questions (without answers)"""
    return {"questions": auth_manager.get_security_questions()}

@api_router.post("/auth/security-questions/setup")
async def setup_security_questions(request: SecurityQuestionsRequest, token: str = None):
    """Set up security questions for password reset"""
    if not token:
        raise HTTPException(status_code=401, detail="No session token")
    result = auth_manager.setup_security_questions(token, request.questions)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@api_router.post("/auth/verify-security")
async def verify_security_answers(request: VerifySecurityRequest):
    """Verify security answers for password reset"""
    result = auth_manager.verify_security_answers(request.answers)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using reset token from security verification"""
    result = auth_manager.reset_password(request.reset_token, request.new_password)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    # Track password reset for analytics
    analytics_manager.track_password_reset()
    
    return result

# ==================== END AUTH ROUTES ====================

# ==================== TWO-FACTOR AUTH ROUTES ====================

@api_router.get("/auth/2fa/status")
async def get_2fa_status():
    """Get current 2FA status"""
    return twofa_manager.get_status()

@api_router.post("/auth/2fa/setup")
async def setup_2fa(token: str = None):
    """Generate QR code for 2FA setup"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get instance ID from device info
    device_info = analytics_manager.get_device_info()
    instance_id = device_info.get("device_id", "unknown")
    
    return twofa_manager.generate_secret(instance_id, user_data.get("username", "User"))

class TwoFAVerifyRequest(BaseModel):
    code: str

@api_router.post("/auth/2fa/verify-setup")
async def verify_2fa_setup(request: TwoFAVerifyRequest, token: str = None):
    """Verify code and enable 2FA"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return twofa_manager.verify_and_enable(request.code)

@api_router.post("/auth/2fa/verify")
async def verify_2fa_code(request: TwoFAVerifyRequest):
    """Verify a 2FA code during login"""
    return twofa_manager.verify_code(request.code)

@api_router.post("/auth/2fa/disable")
async def disable_2fa(request: TwoFAVerifyRequest, token: str = None):
    """Disable 2FA (requires current code)"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return twofa_manager.disable(request.code)

@api_router.post("/auth/2fa/regenerate-backup")
async def regenerate_backup_codes(request: TwoFAVerifyRequest, token: str = None):
    """Regenerate backup codes (requires current code)"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return twofa_manager.regenerate_backup_codes(request.code)

# ==================== END TWO-FACTOR AUTH ROUTES ====================

# ==================== CLUSTER ROUTES ====================

@api_router.get("/clusters")
async def get_clusters():
    """Get all clusters with nodes and resources"""
    return cluster_manager.get_clusters()

@api_router.get("/clusters/tags")
async def get_resource_tags():
    """Get available resource tags with colors"""
    return cluster_manager.get_resource_tags()

@api_router.post("/clusters")
async def create_cluster(request: CreateClusterRequest):
    """Create a new cluster"""
    return cluster_manager.create_cluster(request.name, request.description)

@api_router.get("/clusters/{cluster_id}")
async def get_cluster(cluster_id: str):
    """Get a single cluster by ID"""
    cluster = cluster_manager.get_cluster(cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return cluster

@api_router.put("/clusters/{cluster_id}")
async def update_cluster(cluster_id: str, request: UpdateClusterRequest):
    """Update a cluster"""
    updates = {k: v for k, v in request.dict().items() if v is not None}
    cluster = cluster_manager.update_cluster(cluster_id, updates)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return cluster

@api_router.delete("/clusters/{cluster_id}")
async def delete_cluster(cluster_id: str):
    """Delete a cluster and all its nodes"""
    if cluster_manager.delete_cluster(cluster_id):
        return {"success": True}
    raise HTTPException(status_code=404, detail="Cluster not found")

# Node Routes
@api_router.get("/clusters/{cluster_id}/nodes")
async def get_cluster_nodes(cluster_id: str):
    """Get all nodes in a cluster"""
    return cluster_manager.get_nodes_by_cluster(cluster_id)

@api_router.post("/clusters/{cluster_id}/nodes")
async def add_node(cluster_id: str, request: AddNodeRequest):
    """Add a node to a cluster"""
    return cluster_manager.add_node(
        cluster_id, request.name, request.ip,
        request.cpu_cores, request.ram_gb, request.description
    )

@api_router.get("/clusters/{cluster_id}/nodes/{node_id}")
async def get_node(cluster_id: str, node_id: str):
    """Get a single node"""
    node = cluster_manager.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@api_router.put("/clusters/{cluster_id}/nodes/{node_id}")
async def update_node(cluster_id: str, node_id: str, request: UpdateNodeRequest):
    """Update a node"""
    updates = {k: v for k, v in request.dict().items() if v is not None}
    node = cluster_manager.update_node(node_id, updates)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@api_router.delete("/clusters/{cluster_id}/nodes/{node_id}")
async def remove_node(cluster_id: str, node_id: str):
    """Remove a node from a cluster"""
    if cluster_manager.remove_node(node_id):
        return {"success": True}
    raise HTTPException(status_code=404, detail="Node not found")

@api_router.post("/clusters/{cluster_id}/nodes/{node_id}/set-master")
async def set_master_node(cluster_id: str, node_id: str):
    """Set a node as the master of its cluster"""
    if cluster_manager.set_master_node(cluster_id, node_id):
        return {"success": True}
    raise HTTPException(status_code=404, detail="Cluster or node not found")

@api_router.get("/clusters/{cluster_id}/nodes/{node_id}/health")
async def check_node_health(cluster_id: str, node_id: str):
    """Check node health and connectivity"""
    return await cluster_manager.check_node_health(node_id)

@api_router.get("/clusters/{cluster_id}/health")
async def check_cluster_health(cluster_id: str):
    """Check health of all nodes in a cluster"""
    return await cluster_manager.check_cluster_health(cluster_id)

# Port Allocation Routes
@api_router.get("/clusters/{cluster_id}/ports")
async def get_cluster_ports(cluster_id: str):
    """Get all port allocations for a cluster"""
    return cluster_manager.get_port_allocations_by_cluster(cluster_id)

@api_router.post("/clusters/{cluster_id}/nodes/{node_id}/ports")
async def create_port_allocation(cluster_id: str, node_id: str, request: CreatePortAllocationRequest):
    """Create a port allocation for a node (Pterodactyl-style)"""
    try:
        return cluster_manager.create_port_allocation(
            node_id, request.ip, request.port_start, request.port_end,
            request.alias, request.notes
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.put("/clusters/{cluster_id}/ports/{allocation_id}")
async def update_port_allocation(cluster_id: str, allocation_id: str, request: UpdatePortAllocationRequest):
    """Update a port allocation"""
    updates = {k: v for k, v in request.dict().items() if v is not None}
    allocation = cluster_manager.update_port_allocation(allocation_id, updates)
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")
    return allocation

@api_router.delete("/clusters/{cluster_id}/ports/{allocation_id}")
async def delete_port_allocation(cluster_id: str, allocation_id: str):
    """Delete a port allocation"""
    if cluster_manager.delete_port_allocation(allocation_id):
        return {"success": True}
    raise HTTPException(status_code=404, detail="Allocation not found")

@api_router.get("/clusters/{cluster_id}/ports/available")
async def get_available_ports(cluster_id: str, count: int = 1):
    """Find available ports across the cluster"""
    return cluster_manager.get_available_ports(cluster_id, count)

# Storage Routes
@api_router.post("/clusters/{cluster_id}/nodes/{node_id}/storage")
async def add_storage_path(cluster_id: str, node_id: str, request: AddStoragePathRequest):
    """Add a storage path to a node"""
    return cluster_manager.add_storage_path(
        node_id, request.path, request.storage_type,
        request.total_gb, request.alias
    )

@api_router.put("/clusters/{cluster_id}/storage/{storage_id}")
async def update_storage_path(cluster_id: str, storage_id: str, request: UpdateStoragePathRequest):
    """Update a storage path"""
    updates = {k: v for k, v in request.dict().items() if v is not None}
    storage = cluster_manager.update_storage_path(storage_id, updates)
    if not storage:
        raise HTTPException(status_code=404, detail="Storage path not found")
    return storage

@api_router.delete("/clusters/{cluster_id}/storage/{storage_id}")
async def delete_storage_path(cluster_id: str, storage_id: str):
    """Delete a storage path"""
    if cluster_manager.delete_storage_path(storage_id):
        return {"success": True}
    raise HTTPException(status_code=404, detail="Storage path not found")

# ==================== NGINX PROXY MANAGER ROUTES ====================

@api_router.get("/npm/status")
async def get_npm_status():
    """Get NPM connection status"""
    return nginx_proxy_manager.get_connection_status()

@api_router.post("/npm/connect")
async def save_npm_connection(request: NPMConnectionRequest):
    """Save NPM connection credentials"""
    return nginx_proxy_manager.save_connection(request.url, request.email, request.password)

@api_router.post("/npm/test")
async def test_npm_connection():
    """Test connection to NPM"""
    return await nginx_proxy_manager.test_connection()

@api_router.get("/npm/proxy-hosts")
async def get_npm_proxy_hosts():
    """Get proxy hosts from NPM"""
    return await nginx_proxy_manager.get_proxy_hosts()

@api_router.post("/npm/proxy-hosts")
async def create_npm_proxy_host(request: NPMProxyHostRequest):
    """Create a proxy host in NPM"""
    return await nginx_proxy_manager.create_proxy_host(
        request.domain_names, request.forward_host, request.forward_port, request.ssl
    )

@api_router.get("/npm/certificates")
async def get_npm_certificates():
    """Get SSL certificates from NPM"""
    return await nginx_proxy_manager.get_ssl_certificates()

@api_router.post("/npm/disconnect")
async def disconnect_npm():
    """Disconnect from NPM"""
    return nginx_proxy_manager.disconnect()

@api_router.get("/npm/setup-guide")
async def get_npm_setup_guide():
    """Get NPM setup guide"""
    return nginx_proxy_manager.get_setup_guide()

@api_router.post("/npm/setup-guide/dismiss")
async def dismiss_npm_setup_guide():
    """Dismiss setup guide"""
    return nginx_proxy_manager.dismiss_setup_guide()

# ==================== SUB-USER ROUTES ====================

@api_router.get("/sub-users/roles")
async def get_sub_user_roles():
    """Get available roles"""
    return sub_user_manager.get_roles()

@api_router.get("/sub-users")
async def get_sub_users(token: str = None):
    """Get all sub-users (admin only)"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"users": sub_user_manager.get_users(), "enabled": sub_user_manager.is_enabled()}

@api_router.post("/sub-users")
async def create_sub_user(request: CreateSubUserRequest, token: str = None):
    """Create a new sub-user (admin only)"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = sub_user_manager.create_user(request.username, request.password, request.role, request.assigned_servers)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@api_router.get("/sub-users/{user_id}")
async def get_sub_user(user_id: str, token: str = None):
    """Get a specific sub-user"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = sub_user_manager.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.put("/sub-users/{user_id}")
async def update_sub_user(user_id: str, request: UpdateSubUserRequest, token: str = None):
    """Update a sub-user"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    updates = {k: v for k, v in request.dict().items() if v is not None}
    result = sub_user_manager.update_user(user_id, updates)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@api_router.delete("/sub-users/{user_id}")
async def delete_sub_user(user_id: str, token: str = None):
    """Delete a sub-user"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = sub_user_manager.delete_user(user_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@api_router.post("/sub-users/toggle")
async def toggle_sub_users(enabled: bool, token: str = None):
    """Enable/disable sub-user feature"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return sub_user_manager.toggle_feature(enabled)

@api_router.post("/sub-users/login")
async def sub_user_login(request: SubUserLoginRequest):
    """Login as a sub-user"""
    result = sub_user_manager.login(request.username, request.password)
    if not result["success"]:
        raise HTTPException(status_code=401, detail=result["error"])
    return result

@api_router.post("/sub-users/validate")
async def validate_sub_user_session(sub_token: str = None):
    """Validate sub-user session"""
    if not sub_token:
        return {"valid": False}
    result = sub_user_manager.validate_session(sub_token)
    return result or {"valid": False}

@api_router.post("/sub-users/logout")
async def sub_user_logout(sub_token: str = None):
    """Logout sub-user"""
    if sub_token:
        sub_user_manager.logout(sub_token)
    return {"success": True}

# ==================== MOD CACHE ROUTES ====================

@api_router.get("/mods/cache/stats")
async def get_mod_cache_stats():
    """Get mod cache statistics"""
    return mod_cache_manager.get_cache_stats()

@api_router.get("/mods/cache/{game_key}")
async def get_cached_mods(game_key: str):
    """Get cached mods for a game"""
    return {
        "mods": mod_cache_manager.get_cached_mods_for_game(game_key),
        "game_key": game_key
    }

@api_router.get("/mods/cache/{game_key}/{mod_id}/check")
async def check_mod_cached(game_key: str, mod_id: str):
    """Check if a specific mod is cached"""
    return {
        "cached": mod_cache_manager.is_cached(game_key, mod_id),
        "info": mod_cache_manager.get_cached_mod_info(game_key, mod_id)
    }

@api_router.delete("/mods/cache/{game_key}")
async def clear_game_cache(game_key: str, token: str = None):
    """Clear cache for a specific game"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return mod_cache_manager.clear_cache(game_key)

@api_router.delete("/mods/cache")
async def clear_all_cache(token: str = None):
    """Clear all mod cache"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return mod_cache_manager.clear_cache()

# ==================== MARKETPLACE VERSIONING & RATINGS ROUTES ====================

@api_router.get("/marketplace/templates/{template_id}/versions")
async def get_template_versions(template_id: str, token: str = None):
    """Get version history for a template"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return marketplace_manager.get_template_versions(template_id)

@api_router.post("/marketplace/templates/{template_id}/update")
async def update_template_version(template_id: str, request: Request, token: str = None):
    """Upload a new version of an existing template"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    data = await request.json()
    ip_address = request.client.host if request.client else "unknown"
    
    result = marketplace_manager.update_template(
        template_id, user_data.get("username", ""), data, ip_address
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Update failed"))
    return result

class RateTemplateRequest(BaseModel):
    rating: int
    review: str = ""

@api_router.post("/marketplace/templates/{template_id}/rate")
async def rate_template(template_id: str, request_body: RateTemplateRequest, token: str = None):
    """Rate and review a template (1-5 stars)"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = marketplace_manager.rate_template(
        template_id, user_data.get("username", ""),
        request_body.rating, request_body.review
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@api_router.get("/marketplace/templates/{template_id}/reviews")
async def get_template_reviews(template_id: str, token: str = None):
    """Get reviews for a template"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return marketplace_manager.get_template_reviews(template_id)

# ==================== END MARKETPLACE VERSIONING & RATINGS ====================

# ==================== MARKETPLACE EXTERNAL AUTH & VERSION CHECK ====================

class ExternalAuthRequest(BaseModel):
    username: str
    password: str

class ExternalAuthCallbackRequest(BaseModel):
    username: str
    external_token: str
    user_data: dict = {}

# External auth API endpoint URL - will be provided by the ServerCraft website
# For now, this is a configurable placeholder
EXTERNAL_AUTH_API_URL = ""  # Will be set to servercraft.dev API endpoint

@api_router.post("/marketplace/external-auth/login")
async def marketplace_external_login(request: ExternalAuthRequest):
    """
    Authenticate via external ServerCraft website API.
    Users register on the main website and login here to access template uploads.
    """
    import aiohttp
    
    if not EXTERNAL_AUTH_API_URL:
        return {
            "success": False,
            "error": "External authentication is not yet configured. The ServerCraft website API endpoint will be available soon.",
            "auth_configured": False
        }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{EXTERNAL_AUTH_API_URL}/api/auth/login",
                json={"username": request.username, "password": request.password},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("success"):
                        # Store session locally
                        marketplace_manager.store_external_session(
                            request.username, data.get("token", ""), data
                        )
                        return {
                            "success": True,
                            "username": request.username,
                            "display_name": data.get("display_name", request.username),
                            "role": data.get("role", "creator"),
                            "message": "Logged in via ServerCraft website"
                        }
                    return {"success": False, "error": data.get("error", "Login failed")}
                elif response.status == 401:
                    return {"success": False, "error": "Invalid credentials. Register at servercraft.dev"}
                else:
                    return {"success": False, "error": f"Auth server error ({response.status})"}
    except aiohttp.ClientError:
        return {"success": False, "error": "Could not reach authentication server. Please try again later."}

@api_router.post("/marketplace/external-auth/callback")
async def marketplace_external_callback(request: ExternalAuthCallbackRequest):
    """Callback from external auth - store session"""
    marketplace_manager.store_external_session(
        request.username, request.external_token, request.user_data
    )
    return {"success": True, "username": request.username}

@api_router.get("/marketplace/external-auth/status")
async def marketplace_external_auth_status(username: str = None):
    """Check if user has an active external auth session"""
    if not username:
        return {"authenticated": False, "auth_configured": bool(EXTERNAL_AUTH_API_URL)}
    
    return {
        "authenticated": marketplace_manager.validate_external_session(username),
        "auth_configured": bool(EXTERNAL_AUTH_API_URL),
        "username": username
    }

@api_router.post("/marketplace/external-auth/logout")
async def marketplace_external_logout(username: str = None):
    """Logout from external auth"""
    if username:
        marketplace_manager.clear_external_session(username)
    return {"success": True}

@api_router.post("/marketplace/version-check")
async def marketplace_version_check(template_id: str = None, min_version: str = None):
    """Check if current ServerCraft version is compatible with a template"""
    current_version = APP_VERSION
    
    if template_id:
        # Look up template's min version
        data = marketplace_manager._load_json(marketplace_manager.templates_file)
        for template in data.get("templates", []):
            if template.get("id") == template_id:
                min_version = template.get("min_servercraft_version", "")
                break
    
    if not min_version:
        return {"compatible": True, "message": "No version requirement", "current_version": current_version}
    
    result = marketplace_manager.check_version_compatibility(min_version, current_version)
    result["current_version"] = current_version
    return result

# ==================== END MARKETPLACE EXTERNAL AUTH ====================

# ==================== SERVERCRAFT SELF-UPDATE SYSTEM ====================

@api_router.get("/updates/check")
async def check_for_updates():
    """Check GitHub releases for a newer version of ServerCraft"""
    import aiohttp
    
    current_version = APP_VERSION
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                GITHUB_RELEASES_URL,
                headers={"Accept": "application/vnd.github.v3+json", "User-Agent": "ServerCraft-UpdateChecker"},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    release = await response.json()
                    latest_tag = release.get("tag_name", "").lstrip("v").strip()
                    release_name = release.get("name", latest_tag)
                    published_at = release.get("published_at", "")
                    body = release.get("body", "")
                    html_url = release.get("html_url", GITHUB_RELEASES_PAGE)
                    prerelease = release.get("prerelease", False)
                    
                    # Parse assets for download links
                    assets = []
                    for asset in release.get("assets", []):
                        assets.append({
                            "name": asset.get("name"),
                            "download_url": asset.get("browser_download_url"),
                            "size_mb": round(asset.get("size", 0) / (1024 * 1024), 1),
                            "download_count": asset.get("download_count", 0)
                        })
                    
                    # Determine update type
                    update_type = "hotfix"
                    if body:
                        body_lower = body.lower()
                        if "major" in body_lower or "big update" in body_lower:
                            update_type = "major"
                        elif "feature" in body_lower:
                            update_type = "feature"
                    if prerelease:
                        update_type = "beta"
                    
                    # Compare versions
                    def parse_ver(v):
                        import re
                        clean = re.sub(r'[-.]?[A-Za-z].*$', '', v.strip())
                        parts = []
                        for p in clean.split('.'):
                            try: parts.append(int(p))
                            except: parts.append(0)
                        return tuple(parts)
                    
                    is_newer = False
                    try:
                        is_newer = parse_ver(latest_tag) > parse_ver(current_version)
                    except Exception:
                        is_newer = latest_tag != current_version
                    
                    return {
                        "update_available": is_newer,
                        "current_version": current_version,
                        "latest_version": latest_tag,
                        "release_name": release_name,
                        "update_type": update_type,
                        "published_at": published_at,
                        "changelog": body,
                        "html_url": html_url,
                        "assets": assets,
                        "prerelease": prerelease,
                        "releases_page": GITHUB_RELEASES_PAGE
                    }
                elif response.status == 404:
                    return {
                        "update_available": False,
                        "current_version": current_version,
                        "message": "No releases found",
                        "releases_page": GITHUB_RELEASES_PAGE
                    }
                else:
                    return {
                        "update_available": False,
                        "current_version": current_version,
                        "error": f"GitHub API returned {response.status}"
                    }
    except Exception as e:
        return {
            "update_available": False,
            "current_version": current_version,
            "error": f"Update check failed: {str(e)}",
            "releases_page": GITHUB_RELEASES_PAGE
        }

@api_router.get("/updates/config")
async def get_update_config():
    """Get update configuration"""
    return {
        "current_version": APP_VERSION,
        "config": UPDATE_CONFIG,
        "releases_page": GITHUB_RELEASES_PAGE
    }

@api_router.post("/updates/dismiss")
async def dismiss_update(version: str = None):
    """Dismiss an update notification (Update Later)"""
    settings = config_manager.get_settings()
    dismissed = settings.get("dismissed_updates", [])
    if version and version not in dismissed:
        dismissed.append(version)
    config_manager.update_settings({"dismissed_updates": dismissed})
    return {"success": True, "dismissed": version}

@api_router.get("/updates/dismissed")
async def get_dismissed_updates():
    """Get list of dismissed update versions"""
    settings = config_manager.get_settings()
    return {"dismissed": settings.get("dismissed_updates", [])}

# ==================== INSTALLED TEMPLATES TRACKER ====================

@api_router.get("/templates/installed")
async def get_installed_templates(token: str = None):
    """Get list of installed templates with update check"""
    user_data = get_user_from_token(token)
    if not user_data:
        # Try sub-user
        if token:
            sub = sub_user_manager.validate_session(token)
            if not sub:
                raise HTTPException(status_code=401, detail="Not authenticated")
    
    settings = config_manager.get_settings()
    installed = settings.get("installed_templates", [])
    
    # Check each installed template for updates
    templates_data = marketplace_manager._load_json(marketplace_manager.templates_file)
    all_templates = templates_data.get("templates", [])
    
    result = []
    for inst in installed:
        template_id = inst.get("template_id")
        installed_version = inst.get("version")
        
        # Find current marketplace version
        update_available = False
        latest_version = installed_version
        template_name = inst.get("name", "Unknown")
        
        for t in all_templates:
            if t.get("id") == template_id:
                latest_version = t.get("version_id") or t.get("version", installed_version)
                template_name = t.get("name", template_name)
                
                # Compare versions
                if latest_version != installed_version:
                    update_available = True
                break
        
        result.append({
            "template_id": template_id,
            "name": template_name,
            "installed_version": installed_version,
            "latest_version": latest_version,
            "update_available": update_available,
            "installed_at": inst.get("installed_at"),
            "game": inst.get("game", "")
        })
    
    updates_count = sum(1 for r in result if r["update_available"])
    
    return {
        "installed": result,
        "total": len(result),
        "updates_available": updates_count
    }

@api_router.post("/templates/installed/track")
async def track_installed_template(request: Request, token: str = None):
    """Track a newly installed template"""
    user_data = get_user_from_token(token)
    if not user_data:
        if token:
            sub = sub_user_manager.validate_session(token)
            if not sub:
                raise HTTPException(status_code=401, detail="Not authenticated")
    
    data = await request.json()
    template_id = data.get("template_id")
    version = data.get("version")
    name = data.get("name")
    game = data.get("game", "")
    
    if not template_id or not version:
        raise HTTPException(status_code=400, detail="template_id and version required")
    
    settings = config_manager.get_settings()
    installed = settings.get("installed_templates", [])
    
    # Update or add
    found = False
    for i, inst in enumerate(installed):
        if inst.get("template_id") == template_id:
            installed[i]["version"] = version
            installed[i]["updated_at"] = datetime.now(timezone.utc).isoformat()
            found = True
            break
    
    if not found:
        installed.append({
            "template_id": template_id,
            "name": name,
            "version": version,
            "game": game,
            "installed_at": datetime.now(timezone.utc).isoformat()
        })
    
    config_manager.update_settings({"installed_templates": installed})
    return {"success": True, "tracked": template_id}

@api_router.post("/templates/installed/{template_id}/update")
async def update_installed_template(template_id: str, token: str = None):
    """One-click update an installed template to the latest version"""
    user_data = get_user_from_token(token)
    if not user_data:
        if token:
            sub = sub_user_manager.validate_session(token)
            if not sub:
                raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find the template in marketplace
    templates_data = marketplace_manager._load_json(marketplace_manager.templates_file)
    
    for template in templates_data.get("templates", []):
        if template.get("id") == template_id:
            new_version = template.get("version_id") or template.get("version")
            
            # Version check
            compat = marketplace_manager.check_version_compatibility(
                template.get("min_servercraft_version", ""), APP_VERSION
            )
            if not compat.get("compatible", True):
                return {
                    "success": False,
                    "error": "version_mismatch",
                    "message": compat.get("message"),
                    "update_url": compat.get("update_url")
                }
            
            # Update the installed record
            settings = config_manager.get_settings()
            installed = settings.get("installed_templates", [])
            for i, inst in enumerate(installed):
                if inst.get("template_id") == template_id:
                    installed[i]["version"] = new_version
                    installed[i]["updated_at"] = datetime.now(timezone.utc).isoformat()
                    break
            config_manager.update_settings({"installed_templates": installed})
            
            # Increment download count
            marketplace_manager.increment_download_count(template_id)
            
            return {
                "success": True,
                "template_id": template_id,
                "new_version": new_version,
                "template": {
                    "name": template.get("name"),
                    "config": template.get("config"),
                    "version": new_version
                }
            }
    
    raise HTTPException(status_code=404, detail="Template not found")

@api_router.delete("/templates/installed/{template_id}")
async def remove_installed_template(template_id: str, token: str = None):
    """Remove a template from installed list"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    settings = config_manager.get_settings()
    installed = settings.get("installed_templates", [])
    installed = [i for i in installed if i.get("template_id") != template_id]
    config_manager.update_settings({"installed_templates": installed})
    return {"success": True}

# ==================== END SELF-UPDATE & TEMPLATE TRACKER ====================

# ==================== ANALYTICS & FEEDBACK ROUTES ====================

@api_router.get("/analytics/device")
async def get_device_info():
    """Get device ID and info"""
    return analytics_manager.get_device_info()

@api_router.get("/analytics")
async def get_analytics():
    """Get local analytics data"""
    return analytics_manager.get_analytics()

@api_router.post("/analytics/sync-to-admin")
async def sync_to_admin_dashboard():
    """Manually trigger sync to servercraft.dev admin dashboard"""
    result = await analytics_manager.sync_to_admin_dashboard()
    if result.get("success"):
        return result
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Sync failed"))

@api_router.post("/analytics/update-server-metrics")
async def update_server_metrics(request: Request, token: str = None):
    """Update per-server metrics for analytics"""
    if not token:
        raise HTTPException(status_code=401, detail="No session token")
    
    data = await request.json()
    server_id = data.get("server_id")
    metrics = data.get("metrics", {})
    
    if not server_id:
        raise HTTPException(status_code=400, detail="server_id required")
    
    analytics_manager.update_server_metrics(server_id, metrics)
    return {"success": True}

@api_router.get("/feedback/questions")
async def get_feedback_questions():
    """Get current feedback questions"""
    return analytics_manager.get_feedback_questions()

@api_router.post("/feedback/submit")
async def submit_feedback(submission: FeedbackSubmission, request: Request):
    """Submit feedback form"""
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    
    # Submit locally
    result = analytics_manager.submit_feedback(
        submission.answers,
        submission.additional_feedback,
        client_ip
    )
    
    return {"success": True, "submission_id": result["id"]}

# Public stats endpoint (for website)
@api_router.get("/public/stats")
async def get_public_stats():
    """Get public statistics for website display"""
    return admin_analytics.get_public_stats()

@api_router.get("/version-history")
async def get_version_history():
    """Get version history for public display"""
    return VERSION_HISTORY

# Analytics receiving endpoints (for servercraft.dev backend)
@api_router.post("/analytics/receive")
async def receive_analytics(data: AnalyticsReceive):
    """Receive analytics from ServerCraft instances"""
    admin_analytics.receive_analytics(data.device_id, data.data)
    return {"success": True}

@api_router.post("/admin/analytics/receive")
async def receive_admin_analytics(request: Request):
    """Receive comprehensive analytics for admin dashboard (servercraft.dev endpoint)"""
    data = await request.json()
    device_id = data.get("device_id")
    metrics_data = data.get("metrics", {})
    
    if not device_id:
        raise HTTPException(status_code=400, detail="device_id required")
    
    # Process and store the analytics
    admin_analytics.receive_analytics(device_id, data)
    return {"success": True, "message": "Analytics received"}

@api_router.post("/analytics/feedback")
async def receive_feedback(request: Request):
    """Receive feedback submission from ServerCraft instances"""
    data = await request.json()
    admin_analytics.receive_feedback(data)
    return {"success": True}

# Admin routes
@api_router.post("/admin/login")
async def admin_login(credentials: AdminLoginRequest):
    """Admin login for dashboard"""
    token = admin_analytics.admin_login(credentials.username, credentials.password)
    if token:
        return {"success": True, "token": token}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@api_router.post("/admin/logout")
async def admin_logout(token: str = None):
    """Admin logout"""
    if token:
        admin_analytics.admin_logout(token)
    return {"success": True}

@api_router.get("/admin/analytics")
async def get_admin_analytics(token: str = None):
    """Get all analytics for admin dashboard"""
    if not token or not admin_analytics.validate_admin_session(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return admin_analytics.get_all_analytics()

@api_router.get("/admin/feedback")
async def get_admin_feedback(token: str = None):
    """Get all feedback for admin dashboard"""
    if not token or not admin_analytics.validate_admin_session(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return admin_analytics.get_all_feedback()

@api_router.get("/admin/validate")
async def validate_admin_session(token: str = None):
    """Validate admin session"""
    if token and admin_analytics.validate_admin_session(token):
        return {"valid": True}
    return {"valid": False}

# ==================== END ANALYTICS ROUTES ====================

# ==================== PORT ALLOCATION ROUTES ====================

@api_router.get("/ports/next/{game}")
async def get_next_port(game: str):
    """Get the next available port for a game"""
    existing_servers = server_manager.get_all_servers()
    return get_next_available_port(game, existing_servers)

@api_router.get("/ports/ranges")
async def get_port_ranges():
    """Get all game port ranges"""
    return GAME_PORT_RANGES

# ==================== NODE DISCOVERY ROUTES ====================

@api_router.get("/discovery/info")
async def get_discovery_info():
    """Get this node's discovery info for UDP broadcast"""
    device_info = analytics_manager.get_device_info()
    
    # Get local IP addresses
    hostname = socket.gethostname()
    try:
        local_ips = socket.gethostbyname_ex(hostname)[2]
    except Exception:
        local_ips = ["127.0.0.1"]
    
    return {
        "device_id": device_info.get("device_id"),
        "hostname": hostname,
        "ips": local_ips,
        "port": 8001,
        "version": APP_VERSION,
        "name": APP_NAME,
        "platform": device_info.get("platform", "Windows")
    }

@api_router.post("/discovery/scan")
async def scan_for_nodes():
    """Scan local network for other ServerCraft nodes via UDP broadcast"""
    discovered = await cluster_manager.discover_local_nodes()
    return {"nodes": discovered}

@api_router.get("/discovery/status")
async def get_discovery_status():
    """Get the current discovery service status"""
    return cluster_manager.get_discovery_status()

@api_router.get("/games")
async def get_supported_games():
    return GAME_DEFINITIONS

# System Stats
@api_router.get("/stats/system")
async def get_system_stats():
    return system_monitor.get_stats()

# SteamCMD Routes
@api_router.get("/steamcmd/status")
async def get_steamcmd_status():
    return {
        "installed": steamcmd_manager.is_installed(),
        "path": str(steamcmd_manager.steamcmd_path),
        "logged_in": steamcmd_manager.is_logged_in(),
        "username": steamcmd_manager.get_current_user()
    }

@api_router.post("/steamcmd/install")
async def install_steamcmd():
    success = await steamcmd_manager.install()
    if success:
        return {"success": True, "message": "SteamCMD installed successfully"}
    raise HTTPException(status_code=500, detail="Failed to install SteamCMD")

@api_router.post("/steamcmd/login")
async def steam_login(request: SteamLoginRequest):
    result = await steamcmd_manager.login(
        request.username,
        request.password,
        request.guard_code
    )
    return result

@api_router.post("/steamcmd/guard")
async def submit_steam_guard(request: SteamGuardRequest):
    result = await steamcmd_manager.submit_guard_code(request.code)
    return result

@api_router.post("/steamcmd/logout")
async def steam_logout():
    steamcmd_manager.logout()
    return {"success": True, "message": "Logged out"}

# Server Management Routes
@api_router.get("/servers")
async def get_servers():
    return server_manager.get_all_servers()

@api_router.get("/servers/{server_id}")
async def get_server(server_id: str):
    server = server_manager.get_server(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server

@api_router.post("/servers")
async def create_server(request: CreateServerRequest):
    server = server_manager.create_server(request.model_dump())
    await manager.broadcast({"type": "server_created", "server": server}, "servers")
    return server

@api_router.put("/servers/{server_id}")
async def update_server(server_id: str, request: CreateServerRequest):
    server = server_manager.update_server(server_id, request.model_dump())
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    await manager.broadcast({"type": "server_updated", "server": server}, "servers")
    return server

@api_router.delete("/servers/{server_id}")
async def delete_server(server_id: str):
    success = server_manager.delete_server(server_id)
    if not success:
        raise HTTPException(status_code=404, detail="Server not found")
    await manager.broadcast({"type": "server_deleted", "server_id": server_id}, "servers")
    return {"success": True}

@api_router.post("/servers/{server_id}/start")
async def start_server(server_id: str):
    result = await server_manager.start_server(server_id, GAME_DEFINITIONS)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to start server"))
    await manager.broadcast({"type": "server_started", "server_id": server_id}, "servers")
    return result

@api_router.post("/servers/{server_id}/stop")
async def stop_server(server_id: str):
    result = await server_manager.stop_server(server_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to stop server"))
    await manager.broadcast({"type": "server_stopped", "server_id": server_id}, "servers")
    return result

@api_router.post("/servers/{server_id}/restart")
async def restart_server(server_id: str):
    result = await server_manager.restart_server(server_id, GAME_DEFINITIONS)
    await manager.broadcast({"type": "server_restarted", "server_id": server_id}, "servers")
    return result

@api_router.get("/servers/{server_id}/stats")
async def get_server_stats(server_id: str):
    return server_manager.get_server_stats(server_id)

@api_router.get("/servers/{server_id}/console")
async def get_server_console(server_id: str, lines: int = 100):
    return server_manager.get_console_output(server_id, lines)

@api_router.post("/servers/{server_id}/command")
async def send_server_command(server_id: str, command: dict):
    result = await server_manager.send_command(server_id, command.get("command", ""))
    return result

# Game Installation Routes
@api_router.post("/servers/{server_id}/install")
async def install_game_server(server_id: str):
    server = server_manager.get_server(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    game = server.get("game")
    if game not in GAME_DEFINITIONS:
        raise HTTPException(status_code=400, detail="Unsupported game")

    game_def = GAME_DEFINITIONS[game]

    # Minecraft uses a custom install — download server JAR directly from Mojang
    if game == "minecraft":
        return await _install_minecraft(server_id)

    result = await steamcmd_manager.install_game(
        server_id,
        game_def["server_app_id"],
        game_def.get("requires_login", False)
    )
    return result


async def _install_minecraft(server_id: str) -> dict:
    """Download the latest Minecraft server JAR from Mojang."""
    import aiohttp
    server_path = server_manager.servers_path / server_id
    server_path.mkdir(parents=True, exist_ok=True)
    jar_path = server_path / "server.jar"

    try:
        async with aiohttp.ClientSession() as session:
            # Step 1: get version manifest
            async with session.get("https://launchermeta.mojang.com/mc/game/version_manifest.json") as r:
                if r.status != 200:
                    return {"success": False, "error": "Could not reach Mojang servers"}
                manifest = await r.json(content_type=None)

            latest = manifest["latest"]["release"]
            version_url = next(v["url"] for v in manifest["versions"] if v["id"] == latest)

            # Step 2: get server jar URL for that version
            async with session.get(version_url) as r:
                version_data = await r.json(content_type=None)

            jar_url = version_data["downloads"]["server"]["url"]

            # Step 3: download server jar
            async with session.get(jar_url) as r:
                with open(jar_path, "wb") as f:
                    f.write(await r.read())

        # Write eula.txt so server starts without manual acceptance
        (server_path / "eula.txt").write_text("eula=true\n")

        # Write a minimal server.properties
        props = server_path / "server.properties"
        if not props.exists():
            props.write_text(
                "online-mode=false\n"
                "server-port=25565\n"
                "max-players=20\n"
                "motd=ServerCraft Minecraft Server\n"
            )

        return {"success": True, "message": f"Minecraft {latest} server installed successfully"}

    except Exception as e:
        logger.error(f"Minecraft install failed: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/servers/{server_id}/install/status")
async def get_install_status(server_id: str):
    return steamcmd_manager.get_install_status(server_id)

# UPnP Routes
@api_router.get("/upnp/status")
async def get_upnp_status():
    return upnp_manager.get_status()

@api_router.post("/upnp/enable")
async def enable_upnp(request: UPnPRequest):
    if request.enabled:
        result = await upnp_manager.add_port_mapping(
            request.port,
            request.protocol,
            request.description
        )
    else:
        result = await upnp_manager.remove_port_mapping(
            request.port,
            request.protocol
        )
    return result

@api_router.get("/upnp/mappings")
async def get_upnp_mappings():
    return upnp_manager.get_mappings()

# Workshop Routes
@api_router.get("/workshop/status")
async def get_workshop_status():
    """Get workshop integration status"""
    settings = config_manager.get_settings()
    steam_api_key = settings.get("steam_api_key", "")
    return {
        "enabled": True,
        "steamcmd_installed": steamcmd_manager.is_installed(),
        "logged_in": steamcmd_manager.is_logged_in(),
        "mods_path": str(workshop_manager.mods_path),
        "has_steam_api_key": bool(steam_api_key),
        "steam_api_key_masked": ("*" * (len(steam_api_key) - 4) + steam_api_key[-4:]) if len(steam_api_key) > 4 else "",
        "cache_stats": mod_cache_manager.get_cache_stats(),
        "supported_games": [
            {"key": key, "name": game["name"], "workshop_id": game.get("workshop_id")}
            for key, game in GAME_DEFINITIONS.items()
            if game.get("workshop_id")
        ]
    }

class SteamApiKeyRequest(BaseModel):
    api_key: str

@api_router.post("/workshop/api-key")
async def set_steam_api_key(request: SteamApiKeyRequest, token: str = None):
    """Set the user's Steam Web API key for mod browsing"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    config_manager.update_settings({"steam_api_key": request.api_key})
    masked = ("*" * (len(request.api_key) - 4) + request.api_key[-4:]) if len(request.api_key) > 4 else ""
    return {"success": True, "message": "Steam API key saved", "masked": masked}

@api_router.delete("/workshop/api-key")
async def remove_steam_api_key(token: str = None):
    """Remove the Steam Web API key"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    config_manager.update_settings({"steam_api_key": ""})
    return {"success": True, "message": "Steam API key removed"}

@api_router.get("/workshop/search")
async def search_workshop_mods(game: str, query: str = "", page: int = 1, token: str = None):
    """Search Steam Workshop mods using the user's API key"""
    settings = config_manager.get_settings()
    steam_api_key = settings.get("steam_api_key", "")
    
    if not steam_api_key:
        raise HTTPException(status_code=400, detail="Steam Web API key required. Go to Settings > Workshop to add your key.")
    
    if game not in GAME_DEFINITIONS:
        raise HTTPException(status_code=400, detail="Unsupported game")
    
    game_def = GAME_DEFINITIONS[game]
    workshop_id = game_def.get("workshop_id")
    if not workshop_id:
        raise HTTPException(status_code=400, detail="Game does not support workshop")
    
    # Use Steam Web API to search
    import aiohttp
    try:
        params = {
            "key": steam_api_key,
            "appid": workshop_id,
            "search_text": query,
            "return_tags": True,
            "return_previews": True,
            "numperpage": 20,
            "page": page,
            "query_type": 1,  # RankedByPublicationDate
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/",
                params=params,
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    files = data.get("response", {}).get("publishedfiledetails", [])
                    total = data.get("response", {}).get("total", 0)
                    
                    mods = []
                    for f in files:
                        mods.append({
                            "id": f.get("publishedfileid"),
                            "title": f.get("title", "Unknown"),
                            "description": (f.get("short_description") or f.get("file_description", ""))[:200],
                            "preview_url": f.get("preview_url", ""),
                            "subscriptions": f.get("subscriptions", 0),
                            "favorited": f.get("favorited", 0),
                            "file_size": f.get("file_size", 0),
                            "time_updated": f.get("time_updated", 0),
                            "tags": [t.get("tag", "") for t in f.get("tags", [])],
                            "cached": mod_cache_manager.is_cached(game, f.get("publishedfileid", ""))
                        })
                    
                    return {"success": True, "mods": mods, "total": total, "page": page}
                elif response.status == 403:
                    return {"success": False, "error": "Invalid Steam API key. Please check your key in Settings."}
                else:
                    return {"success": False, "error": f"Steam API returned status {response.status}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@api_router.post("/workshop/download")
async def download_workshop_mods(request: WorkshopModRequest):
    if request.game not in GAME_DEFINITIONS:
        raise HTTPException(status_code=400, detail="Unsupported game")
    
    game_def = GAME_DEFINITIONS[request.game]
    if not game_def.get("workshop_id"):
        raise HTTPException(status_code=400, detail="Game does not support workshop")
    
    result = await workshop_manager.download_mods(
        game_def["workshop_id"],
        request.mod_ids
    )
    
    # Track workshop downloads
    if result.get("success"):
        for _ in request.mod_ids:
            analytics_manager.track_workshop_download()
    
    return result

@api_router.post("/workshop/download-single")
async def download_single_mod(game: str, mod_id: str):
    """Download a single workshop mod"""
    if game not in GAME_DEFINITIONS:
        raise HTTPException(status_code=400, detail="Unsupported game")
    
    result = await workshop_manager.download_single_mod(game, mod_id)
    
    # Track workshop download
    if result.get("success"):
        analytics_manager.track_workshop_download()
    
    return result

@api_router.post("/workshop/parse-modlist")
async def parse_modlist_html(request: ModlistUploadRequest):
    mod_ids = workshop_manager.parse_arma3_modlist(request.html_content)
    return {"mod_ids": mod_ids, "count": len(mod_ids)}

@api_router.get("/workshop/mods/{game}")
async def get_installed_mods(game: str):
    return workshop_manager.get_installed_mods(game)

@api_router.get("/workshop/mods")
async def get_all_installed_mods():
    """Get all installed mods for all games"""
    all_mods = {}
    for game_key, game_def in GAME_DEFINITIONS.items():
        if game_def.get("workshop_id"):
            mods = workshop_manager.get_installed_mods(game_key)
            if mods:
                all_mods[game_key] = {
                    "game_name": game_def["name"],
                    "mods": mods,
                    "count": len(mods)
                }
    return all_mods

@api_router.delete("/workshop/mods/{game}/{mod_id}")
async def delete_mod(game: str, mod_id: str):
    """Delete an installed mod"""
    result = workshop_manager.delete_mod(game, mod_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to delete mod"))
    return result

@api_router.post("/workshop/link-to-server")
async def link_mods_to_server(server_id: str, mod_ids: list, game: str):
    """Link downloaded mods to a server"""
    result = workshop_manager.link_mods_to_server(server_id, mod_ids, game)
    return result

# Settings Routes
@api_router.get("/settings")
async def get_settings():
    return config_manager.get_settings()

@api_router.put("/settings")
async def update_settings(settings: dict):
    config_manager.update_settings(settings)
    return {"success": True}

# ==================== MARKETPLACE ROUTES ====================

def get_user_from_token(token: str):
    """Helper to get user info from token"""
    if not token:
        return None
    result = auth_manager.validate_session(token)
    if not result.get("valid"):
        return None
    auth_data = auth_manager._load_auth()
    user = auth_data.get("user", {})
    return {
        "username": result.get("username"),
        "created_at": user.get("created_at", datetime.now(timezone.utc).isoformat())
    }

@api_router.get("/marketplace/check-eligibility")
async def check_marketplace_eligibility(request: Request, token: str = None):
    """Check if current user can access the marketplace"""
    user_data = get_user_from_token(token)
    
    # Check if sub-user (bypass account age)
    is_sub_user = False
    if not user_data and token:
        sub_session = sub_user_manager.validate_session(token)
        if sub_session:
            user_data = {"username": sub_session.get("username", ""), "created_at": datetime.now(timezone.utc).isoformat()}
            is_sub_user = True
    
    if not user_data:
        return {"eligible": False, "reason": "not_authenticated", "message": "Please log in first"}
    
    username = user_data.get("username", "")
    created_at = user_data.get("created_at", datetime.now(timezone.utc).isoformat())
    
    # Log access attempt with IP
    ip_address = request.client.host if request.client else "unknown"
    geo_location = {"ip": ip_address}
    marketplace_manager.log_marketplace_access(username, ip_address, geo_location, "eligibility_check")
    
    return marketplace_manager.check_account_eligibility(username, created_at, is_sub_user=is_sub_user)

@api_router.get("/marketplace/check-upload-eligibility")
async def check_upload_eligibility(request: Request, token: str = None):
    """Check if user can upload a template"""
    user_data = get_user_from_token(token)
    if not user_data:
        return {"eligible": False, "reason": "not_authenticated"}
    
    username = user_data.get("username", "")
    created_at = user_data.get("created_at", datetime.now(timezone.utc).isoformat())
    
    return marketplace_manager.check_upload_eligibility(username, created_at)

@api_router.get("/marketplace/tos")
async def get_marketplace_tos():
    """Get Terms of Service content"""
    return {"tos": MARKETPLACE_TOS, "version": "1.0"}

@api_router.post("/marketplace/tos/agree")
async def agree_to_tos(request: Request, token: str = None):
    """Record user's agreement to ToS"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    username = user_data.get("username", "")
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    
    return marketplace_manager.record_tos_agreement(username, ip_address, user_agent)

@api_router.get("/marketplace/tos/status")
async def get_tos_status(token: str = None):
    """Check if user has agreed to ToS"""
    user_data = get_user_from_token(token)
    if not user_data:
        return {"agreed": False}
    
    return {"agreed": marketplace_manager.has_agreed_to_tos(user_data.get("username", ""))}

@api_router.get("/marketplace/templates")
async def get_marketplace_templates(request: Request, token: str = None, game: str = None, limit: int = 50, offset: int = 0):
    """Get marketplace templates"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check eligibility
    eligibility = marketplace_manager.check_account_eligibility(
        user_data.get("username", ""),
        user_data.get("created_at", datetime.now(timezone.utc).isoformat())
    )
    
    if not eligibility["eligible"]:
        raise HTTPException(status_code=403, detail=eligibility["message"])
    
    # Log access
    ip_address = request.client.host if request.client else "unknown"
    marketplace_manager.log_marketplace_access(user_data.get("username", ""), ip_address, {}, "browse")
    
    return marketplace_manager.get_templates(game=game, limit=limit, offset=offset)

@api_router.get("/marketplace/templates/{template_id}")
async def get_template_detail(template_id: str, request: Request, token: str = None):
    """Get a specific template"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    template = marketplace_manager.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template

@api_router.post("/marketplace/templates/{template_id}/download")
async def download_template(template_id: str, request: Request, token: str = None):
    """Download a template"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check eligibility
    eligibility = marketplace_manager.check_account_eligibility(
        user_data.get("username", ""),
        user_data.get("created_at", datetime.now(timezone.utc).isoformat())
    )
    
    if not eligibility["eligible"]:
        raise HTTPException(status_code=403, detail=eligibility["message"])
    
    ip_address = request.client.host if request.client else "unknown"
    return marketplace_manager.download_template(
        template_id, 
        user_data.get("username", ""), 
        ip_address
    )

class TemplateUpload(BaseModel):
    name: str
    version: str
    game: str
    description: str
    screenshots: List[str]  # Base64 encoded images
    config: dict
    tags: List[str] = []

@api_router.post("/marketplace/templates")
async def upload_template(template: TemplateUpload, request: Request, token: str = None):
    """Upload a new template"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    username = user_data.get("username", "")
    created_at = user_data.get("created_at", datetime.now(timezone.utc).isoformat())
    
    # Check upload eligibility
    eligibility = marketplace_manager.check_upload_eligibility(username, created_at)
    if not eligibility["eligible"]:
        raise HTTPException(status_code=403, detail=eligibility["message"])
    
    ip_address = request.client.host if request.client else "unknown"
    geo_location = {"ip": ip_address}
    
    return marketplace_manager.upload_template(
        username,
        template.dict(),
        ip_address,
        geo_location
    )

class TemplateExport(BaseModel):
    server_id: str
    name: str
    version: str
    description: str

@api_router.post("/marketplace/export")
async def export_template(export_data: TemplateExport, token: str = None):
    """Export a server configuration as a template file"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    server = server_manager.get_server(export_data.server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    return marketplace_manager.export_template(
        server,
        export_data.name,
        export_data.version,
        export_data.description
    )

class TemplateReport(BaseModel):
    reason: str
    details: str = None

@api_router.post("/marketplace/templates/{template_id}/report")
async def report_template(template_id: str, report: TemplateReport, request: Request, token: str = None):
    """Report a template for review"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    ip_address = request.client.host if request.client else "unknown"
    return marketplace_manager.report_template(
        template_id,
        user_data.get("username", ""),
        report.reason,
        report.details,
        ip_address
    )

@api_router.get("/marketplace/my-templates")
async def get_my_templates(token: str = None):
    """Get current user's templates"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return {"templates": marketplace_manager.get_user_templates(user_data.get("username", ""))}

# ==================== END MARKETPLACE ROUTES ====================


# ==================== CUSTOM DOMAIN ROUTES ====================

@api_router.get("/custom-domain/config")
async def get_custom_domain_config(token: str = None):
    """Get custom domain configuration"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return custom_domain_manager.get_domain_config()

class CustomDomainConfig(BaseModel):
    domain: str
    subdomain: Optional[str] = None
    is_dynamic_ip: bool = True

@api_router.post("/custom-domain/save")
async def save_custom_domain(config: CustomDomainConfig, token: str = None):
    """Save custom domain configuration"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return custom_domain_manager.save_domain_config(
        config.domain,
        config.subdomain,
        config.is_dynamic_ip
    )

@api_router.post("/custom-domain/check-propagation")
async def check_dns_propagation(token: str = None, domain: Optional[str] = None):
    """Check DNS propagation status"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return await custom_domain_manager.check_dns_propagation(domain)

@api_router.post("/custom-domain/acknowledge-setup")
async def acknowledge_domain_setup(token: str = None):
    """Acknowledge setup instructions"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return custom_domain_manager.acknowledge_setup()

@api_router.post("/custom-domain/disable")
async def disable_custom_domain(token: str = None):
    """Disable custom domain"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return custom_domain_manager.disable_domain()

# ==================== SERVER SALES ROUTES ====================

@api_router.get("/server-sales/config")
async def get_sales_config(token: str = None):
    """Get server sales configuration"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return server_sales_manager.get_sales_config()

@api_router.post("/server-sales/toggle")
async def toggle_server_sales(request: Request, token: str = None):
    """Toggle server sales feature"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    data = await request.json()
    enabled = data.get("enabled", False)
    return server_sales_manager.toggle_sales(enabled)

@api_router.get("/server-sales/packages")
async def get_sales_packages():
    """Get available server packages (public endpoint)"""
    return server_sales_manager.get_packages()

class ServerPackage(BaseModel):
    id: str
    name: str
    description: str
    specs: Dict
    price: float
    currency: str

@api_router.post("/server-sales/packages")
async def update_sales_packages(packages: List[ServerPackage], token: str = None):
    """Update server packages"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    packages_dict = [p.dict() for p in packages]
    return server_sales_manager.update_packages(packages_dict)

class PayPalConfig(BaseModel):
    client_id: str
    secret: str
    mode: str = "sandbox"

@api_router.post("/server-sales/paypal/configure")
async def configure_paypal(config: PayPalConfig, token: str = None):
    """Configure PayPal credentials"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return server_sales_manager.configure_paypal(
        config.client_id,
        config.secret,
        config.mode
    )

@api_router.post("/server-sales/paypal/test")
async def test_paypal_connection(token: str = None):
    """Test PayPal API connection"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return await server_sales_manager.test_paypal_connection()

class SecondarySubdomain(BaseModel):
    subdomain: str

@api_router.post("/server-sales/subdomain")
async def set_secondary_subdomain(config: SecondarySubdomain, token: str = None):
    """Set secondary subdomain for server sales"""
    user_data = get_user_from_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return server_sales_manager.set_secondary_subdomain(config.subdomain)

# ==================== END CUSTOM DOMAIN & SALES ROUTES ====================


# WebSocket endpoints
@app.websocket("/ws/console/{server_id}")
async def websocket_console(websocket: WebSocket, server_id: str):
    await manager.connect(websocket, f"console_{server_id}")
    try:
        while True:
            data = await websocket.receive_text()
            # Handle console input (including Steam Guard codes)
            if data.startswith("CMD:"):
                command = data[4:]
                await server_manager.send_command(server_id, command)
            elif data.startswith("GUARD:"):
                code = data[6:]
                await steamcmd_manager.submit_guard_code(code)
    except WebSocketDisconnect:
        manager.disconnect(websocket, f"console_{server_id}")

@app.websocket("/ws/mod-download")
async def websocket_mod_download(websocket: WebSocket):
    """WebSocket for real-time mod download progress"""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "download_batch":
                game = data.get("game")
                mod_ids = data.get("mod_ids", [])
                
                if not game or game not in GAME_DEFINITIONS:
                    await websocket.send_json({"type": "error", "message": "Invalid game"})
                    continue
                
                game_def = GAME_DEFINITIONS[game]
                workshop_id = game_def.get("workshop_id")
                if not workshop_id:
                    await websocket.send_json({"type": "error", "message": "Game does not support workshop"})
                    continue
                
                total = len(mod_ids)
                game_mods_path = workshop_manager.mods_path / workshop_id
                game_mods_path.mkdir(parents=True, exist_ok=True)
                
                await websocket.send_json({
                    "type": "batch_start",
                    "total": total,
                    "game": game,
                    "game_name": game_def["name"]
                })
                
                downloaded = 0
                from_cache = 0
                failed = 0
                
                for i, mod_id in enumerate(mod_ids):
                    await websocket.send_json({
                        "type": "mod_start",
                        "mod_id": mod_id,
                        "index": i + 1,
                        "total": total,
                        "percent": round((i / total) * 100)
                    })
                    
                    # Check cache first
                    cached = False
                    if mod_cache_manager.is_cached(game, mod_id):
                        restore = mod_cache_manager.restore_from_cache(game, mod_id, game_mods_path)
                        if restore.get("success"):
                            cached = True
                            from_cache += 1
                            downloaded += 1
                            await websocket.send_json({
                                "type": "mod_complete",
                                "mod_id": mod_id,
                                "index": i + 1,
                                "total": total,
                                "from_cache": True,
                                "percent": round(((i + 1) / total) * 100)
                            })
                            continue
                    
                    # Download fresh
                    result = await steamcmd_manager.download_workshop_mod(
                        workshop_id, mod_id, game_mods_path
                    )
                    
                    if result.get("success"):
                        downloaded += 1
                        # Cache the mod
                        mod_path = game_mods_path / mod_id
                        if mod_path.exists():
                            mod_cache_manager.cache_mod(game, mod_id, mod_path)
                        
                        await websocket.send_json({
                            "type": "mod_complete",
                            "mod_id": mod_id,
                            "index": i + 1,
                            "total": total,
                            "from_cache": False,
                            "percent": round(((i + 1) / total) * 100)
                        })
                    else:
                        failed += 1
                        await websocket.send_json({
                            "type": "mod_failed",
                            "mod_id": mod_id,
                            "index": i + 1,
                            "total": total,
                            "error": result.get("error", "Unknown error"),
                            "percent": round(((i + 1) / total) * 100)
                        })
                    
                    # Track analytics
                    if result.get("success"):
                        analytics_manager.track_workshop_download()
                
                await websocket.send_json({
                    "type": "batch_complete",
                    "total": total,
                    "downloaded": downloaded,
                    "from_cache": from_cache,
                    "failed": failed,
                    "percent": 100
                })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass

@app.websocket("/ws/stats")
async def websocket_stats(websocket: WebSocket):
    await manager.connect(websocket, "stats")
    try:
        while True:
            stats = system_monitor.get_stats()
            servers_stats = server_manager.get_all_server_stats()
            await websocket.send_json({
                "system": stats,
                "servers": servers_stats
            })
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        manager.disconnect(websocket, "stats")

@app.websocket("/ws/servers")
async def websocket_servers(websocket: WebSocket):
    await manager.connect(websocket, "servers")
    try:
        while True:
            await asyncio.sleep(5)
            servers = server_manager.get_all_servers()
            await websocket.send_json({"type": "servers_update", "servers": servers})
    except WebSocketDisconnect:
        manager.disconnect(websocket, "servers")

# Include router
app.include_router(api_router)

# CORS — allow_credentials=True is incompatible with allow_origins=["*"] in Starlette 0.28+
# Auth uses bearer tokens in headers/query params (not cookies), so credentials not needed.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static React frontend
static_path = BASE_DIR / "static"
if static_path.exists():
    # React build outputs assets into build/static/ — mount that subfolder at /static
    assets_path = static_path / "static"
    if assets_path.exists():
        app.mount("/static", StaticFiles(directory=str(assets_path)), name="static")
    
    @app.get("/", response_class=HTMLResponse)
    async def serve_frontend():
        index_file = static_path / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return HTMLResponse("<h1>ServerCraft</h1><p>Frontend not found</p>")
    
    @app.get("/{path:path}")
    async def serve_frontend_routes(path: str):
        # Try to serve static file first
        file_path = static_path / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        # Fall back to index.html for SPA routing
        index_file = static_path / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        raise HTTPException(status_code=404, detail="Not found")

# Startup/Shutdown events
@app.on_event("startup")
async def startup_event():
    logger.info(f"{APP_NAME} v{APP_VERSION} starting...")
    
    # Create data directories if they don't exist
    (ROOT_DIR / "data").mkdir(exist_ok=True)
    (ROOT_DIR / "servers").mkdir(exist_ok=True)
    (ROOT_DIR / "mods").mkdir(exist_ok=True)
    (ROOT_DIR / "logs").mkdir(exist_ok=True)
    
    # Start background analytics sync task
    asyncio.create_task(analytics_sync_task())
    
    # Auto-start servers marked for auto-start
    await server_manager.auto_start_servers(GAME_DEFINITIONS)
    
    port = int(os.environ.get("SERVERCRAFT_PORT", 8080))
    local_ip = socket.gethostbyname(socket.gethostname())
    logger.info(f"Startup complete — Panel: http://{local_ip}:{port}")

async def analytics_sync_task():
    """Background task to collect server metrics and sync to admin dashboard"""
    # Wait 5 minutes before first sync
    await asyncio.sleep(300)
    
    while True:
        try:
            # Collect metrics from all running servers
            servers = server_manager.get_all_servers()
            system_stats = system_monitor.get_system_stats()
            
            for server in servers:
                server_id = server.get("id")
                if not server_id:
                    continue
                
                # Get server-specific metrics
                server_state = server_manager.get_server_stats(server_id) or {}
                is_running = server.get("status") == "running"
                
                # Calculate storage for server (simplified - you can enhance this)
                server_path = ROOT_DIR / "servers" / server_id
                storage_gb = 0
                if server_path.exists():
                    try:
                        total_size = sum(f.stat().st_size for f in server_path.rglob('*') if f.is_file())
                        storage_gb = total_size / (1024**3)  # Convert to GB
                    except:
                        pass
                
                # Get RAM usage for this server process
                ram_gb = 0
                if is_running and server.get("pid"):
                    try:
                        process = psutil.Process(server.get("pid"))
                        ram_gb = process.memory_info().rss / (1024**3)  # Convert to GB
                    except:
                        pass
                
                # Update server metrics
                metrics = {
                    "storage_used_gb": round(storage_gb, 2),
                    "ram_used_gb": round(ram_gb, 2),
                    "network_download_mbps": 0,  # Would need network monitoring
                    "network_upload_mbps": 0,    # Would need network monitoring
                    "uptime_seconds": server_state.get("uptime_seconds", 0),
                    "downtime_seconds": server_state.get("downtime_seconds", 0),
                    "total_runtime_seconds": server_state.get("total_runtime_seconds", 0),
                    "is_running": is_running
                }
                
                analytics_manager.update_server_metrics(server_id, metrics)
            
            # Sync to admin dashboard every 1 hour
            logger.info("Syncing analytics to servercraft.dev admin dashboard...")
            result = await analytics_manager.sync_to_admin_dashboard()
            if result.get("success"):
                logger.info("Analytics synced successfully")
            else:
                logger.warning(f"Analytics sync failed: {result.get('error')}")
        
        except Exception as e:
            logger.error(f"Analytics sync task error: {e}")
        
        # Wait 1 hour before next sync
        await asyncio.sleep(3600)

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down...")
    # Save all server states
    server_manager.save_states()
    logger.info("Shutdown complete")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("SERVERCRAFT_PORT", 8080))
    try:
        print(f"\n{'='*50}")
        print(f"  {APP_NAME}")
        print(f"  Version: {APP_VERSION}")
        print(f"  {COPYRIGHT}")
        print(f"{'='*50}")
        print(f"\n  Root directory : {ROOT_DIR}")
        print(f"  Listening on   : http://0.0.0.0:{port}\n")
        uvicorn.run(app, host="0.0.0.0", port=port)
    except Exception as e:
        import traceback
        print(f"\nERROR: Server failed to start: {e}")
        traceback.print_exc()
        sys.exit(1)
