"""DuckDNS Manager for ServerCraft
Handles DuckDNS dynamic DNS updates for clusters and nodes
"""

import json
import aiohttp
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, List

class DuckDNSManager:
    """Manages DuckDNS dynamic DNS updates"""
    
    DUCKDNS_UPDATE_URL = "https://www.duckdns.org/update"
    
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.duckdns_file = data_path / "duckdns.json"
        self._ensure_file()
        self._update_tasks = {}
    
    def _ensure_file(self):
        """Create DuckDNS config file if it doesn't exist"""
        if not self.duckdns_file.exists():
            self._save_config({
                "configs": [],
                "update_logs": []
            })
    
    def _load_config(self) -> Dict:
        try:
            with open(self.duckdns_file, 'r') as f:
                return json.load(f)
        except:
            return {"configs": [], "update_logs": []}
    
    def _save_config(self, data: Dict):
        with open(self.duckdns_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def _mask_token(self, token: str) -> str:
        """Mask token for display (show last 4 chars)"""
        if len(token) <= 4:
            return "*" * len(token)
        return "*" * (len(token) - 4) + token[-4:]
    
    def get_configs(self) -> List[Dict]:
        """Get all DuckDNS configurations"""
        data = self._load_config()
        configs = data.get("configs", [])
        
        # Mask tokens for display
        for config in configs:
            config["token_masked"] = self._mask_token(config.get("token", ""))
        
        return configs
    
    def get_config(self, config_id: str) -> Optional[Dict]:
        """Get a single DuckDNS configuration"""
        configs = self.get_configs()
        for config in configs:
            if config["id"] == config_id:
                return config
        return None
    
    def get_config_by_reference(self, reference_type: str, reference_id: str) -> Optional[Dict]:
        """Get DuckDNS config by cluster or node reference"""
        configs = self.get_configs()
        for config in configs:
            if config.get("reference_type") == reference_type and config.get("reference_id") == reference_id:
                return config
        return None
    
    def create_config(self, domain: str, token: str, 
                      reference_type: str = "cluster",
                      reference_id: str = None,
                      ip: str = None,
                      update_interval: int = 300) -> Dict:
        """Create a new DuckDNS configuration"""
        import uuid
        
        data = self._load_config()
        
        config = {
            "id": str(uuid.uuid4()),
            "domain": domain,  # subdomain.duckdns.org
            "token": token,
            "reference_type": reference_type,  # "cluster" or "node"
            "reference_id": reference_id,
            "ip": ip,  # Optional - if None, uses detected IP
            "update_interval": update_interval,  # seconds
            "enabled": True,
            "last_update": None,
            "last_status": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        data["configs"].append(config)
        self._save_config(data)
        
        return config
    
    def update_config(self, config_id: str, updates: Dict) -> Optional[Dict]:
        """Update a DuckDNS configuration"""
        data = self._load_config()
        
        for i, config in enumerate(data["configs"]):
            if config["id"] == config_id:
                allowed_fields = ["domain", "token", "ip", "update_interval", "enabled"]
                for field in allowed_fields:
                    if field in updates:
                        data["configs"][i][field] = updates[field]
                
                self._save_config(data)
                return self.get_config(config_id)
        
        return None
    
    def delete_config(self, config_id: str) -> bool:
        """Delete a DuckDNS configuration"""
        data = self._load_config()
        
        original_length = len(data["configs"])
        data["configs"] = [c for c in data["configs"] if c["id"] != config_id]
        
        if len(data["configs"]) < original_length:
            # Stop any running update task
            if config_id in self._update_tasks:
                self._update_tasks[config_id].cancel()
                del self._update_tasks[config_id]
            
            self._save_config(data)
            return True
        
        return False
    
    async def update_dns(self, config_id: str, force_ip: str = None) -> Dict:
        """Update DuckDNS record"""
        config = self.get_config(config_id)
        if not config:
            return {"success": False, "error": "Configuration not found"}
        
        if not config.get("enabled", False):
            return {"success": False, "error": "Configuration is disabled"}
        
        # Extract subdomain from domain
        domain = config["domain"]
        if domain.endswith(".duckdns.org"):
            subdomain = domain.replace(".duckdns.org", "")
        else:
            subdomain = domain
        
        # Build update URL
        params = {
            "domains": subdomain,
            "token": config["token"],
            "verbose": "true"
        }
        
        # Use specified IP or let DuckDNS detect
        ip_to_use = force_ip or config.get("ip")
        if ip_to_use:
            params["ip"] = ip_to_use
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.DUCKDNS_UPDATE_URL, params=params, 
                                       timeout=aiohttp.ClientTimeout(total=10)) as response:
                    text = await response.text()
                    lines = text.strip().split('\n')
                    
                    success = lines[0] == "OK" if lines else False
                    
                    result = {
                        "success": success,
                        "response": text,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    
                    if success and len(lines) >= 2:
                        result["detected_ip"] = lines[1] if len(lines) > 1 else None
                    
                    # Update config with last status
                    self._update_last_status(config_id, result)
                    
                    # Log the update
                    self._log_update(config_id, result)
                    
                    return result
        
        except asyncio.TimeoutError:
            result = {
                "success": False,
                "error": "Request timeout",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            self._update_last_status(config_id, result)
            return result
        
        except Exception as e:
            result = {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            self._update_last_status(config_id, result)
            return result
    
    def _update_last_status(self, config_id: str, result: Dict):
        """Update the last status of a configuration"""
        data = self._load_config()
        
        for i, config in enumerate(data["configs"]):
            if config["id"] == config_id:
                data["configs"][i]["last_update"] = result.get("timestamp")
                data["configs"][i]["last_status"] = "success" if result.get("success") else "error"
                data["configs"][i]["last_error"] = result.get("error")
                self._save_config(data)
                break
    
    def _log_update(self, config_id: str, result: Dict):
        """Log a DuckDNS update"""
        data = self._load_config()
        
        log_entry = {
            "config_id": config_id,
            "timestamp": result.get("timestamp"),
            "success": result.get("success", False),
            "error": result.get("error"),
            "ip": result.get("detected_ip")
        }
        
        data["update_logs"].append(log_entry)
        
        # Keep only last 100 log entries
        if len(data["update_logs"]) > 100:
            data["update_logs"] = data["update_logs"][-100:]
        
        self._save_config(data)
    
    def get_update_logs(self, config_id: str = None, limit: int = 20) -> List[Dict]:
        """Get DuckDNS update logs"""
        data = self._load_config()
        logs = data.get("update_logs", [])
        
        if config_id:
            logs = [l for l in logs if l.get("config_id") == config_id]
        
        return logs[-limit:][::-1]  # Return newest first
    
    async def test_config(self, domain: str, token: str) -> Dict:
        """Test a DuckDNS configuration without saving"""
        # Extract subdomain
        if domain.endswith(".duckdns.org"):
            subdomain = domain.replace(".duckdns.org", "")
        else:
            subdomain = domain
        
        params = {
            "domains": subdomain,
            "token": token,
            "verbose": "true"
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.DUCKDNS_UPDATE_URL, params=params,
                                       timeout=aiohttp.ClientTimeout(total=10)) as response:
                    text = await response.text()
                    lines = text.strip().split('\n')
                    
                    success = lines[0] == "OK" if lines else False
                    
                    return {
                        "success": success,
                        "response": text,
                        "message": "Configuration is valid" if success else "Invalid domain or token"
                    }
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to connect to DuckDNS"
            }
    
    def get_full_domain(self, config: Dict) -> str:
        """Get the full domain URL for a config"""
        domain = config.get("domain", "")
        if not domain.endswith(".duckdns.org"):
            return f"{domain}.duckdns.org"
        return domain
