"""Configuration Manager - JSON-based storage"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class ConfigManager:
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.config_file = self.data_dir / "config.json"
        self.servers_file = self.data_dir / "servers.json"
        self.credentials_file = self.data_dir / "credentials.json"
        
        self._init_files()
    
    def _init_files(self):
        """Initialize JSON files if they don't exist"""
        default_config = {
            "steamcmd_path": str(self.data_dir.parent / "steamcmd"),
            "servers_path": str(self.data_dir.parent / "servers"),
            "mods_path": str(self.data_dir.parent / "mods"),
            "upnp_enabled": False,
            "theme": "dark",
            "auto_update_servers": False,
            "console_buffer_size": 1000,
            "clustering_enabled": False,  # Node Clustering - default OFF
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        default_servers = {
            "servers": {},
            "states": {}
        }
        
        default_credentials = {
            "steam_username": None,
            "steam_logged_in": False
        }
        
        if not self.config_file.exists():
            self._save_json(self.config_file, default_config)
        
        if not self.servers_file.exists():
            self._save_json(self.servers_file, default_servers)
        
        if not self.credentials_file.exists():
            self._save_json(self.credentials_file, default_credentials)
    
    def _load_json(self, file_path: Path) -> Dict:
        """Load JSON file"""
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load {file_path}: {e}")
            return {}
    
    def _save_json(self, file_path: Path, data: Dict):
        """Save JSON file"""
        try:
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save {file_path}: {e}")
    
    # Config methods
    def get_config(self) -> Dict:
        return self._load_json(self.config_file)
    
    def update_config(self, updates: Dict):
        config = self.get_config()
        config.update(updates)
        self._save_json(self.config_file, config)
    
    def get_settings(self) -> Dict:
        """Get settings with defaults for missing values"""
        config = self.get_config()
        # Ensure clustering_enabled has a default
        if 'clustering_enabled' not in config:
            config['clustering_enabled'] = False
        return config
    
    def update_settings(self, settings: Dict):
        self.update_config(settings)
    
    # Server methods
    def get_servers_data(self) -> Dict:
        return self._load_json(self.servers_file)
    
    def save_servers_data(self, data: Dict):
        self._save_json(self.servers_file, data)
    
    def get_server(self, server_id: str) -> Optional[Dict]:
        data = self.get_servers_data()
        return data.get("servers", {}).get(server_id)
    
    def save_server(self, server_id: str, server_data: Dict):
        data = self.get_servers_data()
        if "servers" not in data:
            data["servers"] = {}
        data["servers"][server_id] = server_data
        self.save_servers_data(data)
    
    def delete_server(self, server_id: str):
        data = self.get_servers_data()
        if server_id in data.get("servers", {}):
            del data["servers"][server_id]
        if server_id in data.get("states", {}):
            del data["states"][server_id]
        self.save_servers_data(data)
    
    def get_server_state(self, server_id: str) -> Dict:
        data = self.get_servers_data()
        return data.get("states", {}).get(server_id, {"status": "stopped"})
    
    def save_server_state(self, server_id: str, state: Dict):
        data = self.get_servers_data()
        if "states" not in data:
            data["states"] = {}
        data["states"][server_id] = state
        self.save_servers_data(data)
    
    # Credentials methods
    def get_credentials(self) -> Dict:
        return self._load_json(self.credentials_file)
    
    def save_credentials(self, credentials: Dict):
        self._save_json(self.credentials_file, credentials)
    
    def get_steam_username(self) -> Optional[str]:
        creds = self.get_credentials()
        return creds.get("steam_username")
    
    def set_steam_login(self, username: str):
        creds = self.get_credentials()
        creds["steam_username"] = username
        creds["steam_logged_in"] = True
        self.save_credentials(creds)
    
    def clear_steam_login(self):
        creds = self.get_credentials()
        creds["steam_logged_in"] = False
        self.save_credentials(creds)
    
    # Path helpers
    def get_steamcmd_path(self) -> Path:
        config = self.get_config()
        return Path(config.get("steamcmd_path", self.data_dir.parent / "steamcmd"))
    
    def get_servers_path(self) -> Path:
        config = self.get_config()
        return Path(config.get("servers_path", self.data_dir.parent / "servers"))
    
    def get_mods_path(self) -> Path:
        config = self.get_config()
        return Path(config.get("mods_path", self.data_dir.parent / "mods"))
