"""Nginx Proxy Manager Integration for ServerCraft
Replaces DuckDNS with NPM for securing the panel locally and remotely
"""

import json
import aiohttp
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, List
import uuid
import logging

logger = logging.getLogger(__name__)


class NginxProxyManager:
    """Manages Nginx Proxy Manager integration for reverse proxy and SSL"""
    
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.config_file = data_path / "nginx_proxy_manager.json"
        self._ensure_file()
        self._token = None
        self._token_expires = None
    
    def _ensure_file(self):
        if not self.config_file.exists():
            self._save_config({
                "connection": {
                    "url": "",
                    "email": "",
                    "password": "",
                    "connected": False,
                    "last_check": None
                },
                "proxy_hosts": [],
                "ssl_certificates": [],
                "setup_guide_dismissed": False
            })
    
    def _load_config(self) -> Dict:
        try:
            with open(self.config_file, 'r') as f:
                return json.load(f)
        except Exception:
            return {"connection": {}, "proxy_hosts": [], "ssl_certificates": []}
    
    def _save_config(self, data: Dict):
        with open(self.config_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def get_connection_status(self) -> Dict:
        """Get current NPM connection status"""
        data = self._load_config()
        conn = data.get("connection", {})
        return {
            "configured": bool(conn.get("url")),
            "url": conn.get("url", ""),
            "email": conn.get("email", ""),
            "connected": conn.get("connected", False),
            "last_check": conn.get("last_check"),
            "proxy_host_count": len(data.get("proxy_hosts", [])),
            "ssl_cert_count": len(data.get("ssl_certificates", []))
        }
    
    def save_connection(self, url: str, email: str, password: str) -> Dict:
        """Save NPM connection credentials"""
        data = self._load_config()
        data["connection"] = {
            "url": url.rstrip("/"),
            "email": email,
            "password": password,
            "connected": False,
            "last_check": None
        }
        self._save_config(data)
        return {"success": True, "message": "Connection saved. Test connection to verify."}
    
    async def _get_token(self, url: str, email: str, password: str) -> Optional[str]:
        """Authenticate with NPM API and get JWT token"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{url}/api/tokens",
                    json={"identity": email, "secret": password},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("token")
                    return None
        except Exception as e:
            logger.error(f"NPM auth failed: {e}")
            return None
    
    async def test_connection(self) -> Dict:
        """Test connection to NPM instance"""
        data = self._load_config()
        conn = data.get("connection", {})
        
        if not conn.get("url"):
            return {"success": False, "error": "No NPM URL configured"}
        
        token = await self._get_token(conn["url"], conn.get("email", ""), conn.get("password", ""))
        
        if token:
            self._token = token
            data["connection"]["connected"] = True
            data["connection"]["last_check"] = datetime.now(timezone.utc).isoformat()
            self._save_config(data)
            return {"success": True, "message": "Connected to Nginx Proxy Manager successfully"}
        else:
            data["connection"]["connected"] = False
            data["connection"]["last_check"] = datetime.now(timezone.utc).isoformat()
            self._save_config(data)
            return {"success": False, "error": "Failed to connect. Check URL, email, and password."}
    
    async def get_proxy_hosts(self) -> Dict:
        """Fetch proxy hosts from NPM"""
        data = self._load_config()
        conn = data.get("connection", {})
        
        if not conn.get("url") or not conn.get("connected"):
            return {"success": False, "error": "Not connected to NPM", "hosts": []}
        
        token = await self._get_token(conn["url"], conn.get("email", ""), conn.get("password", ""))
        if not token:
            return {"success": False, "error": "Authentication failed", "hosts": []}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{conn['url']}/api/nginx/proxy-hosts",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        hosts = await response.json()
                        data["proxy_hosts"] = hosts
                        self._save_config(data)
                        return {"success": True, "hosts": hosts}
                    return {"success": False, "error": f"API error: {response.status}", "hosts": []}
        except Exception as e:
            return {"success": False, "error": str(e), "hosts": []}
    
    async def create_proxy_host(self, domain_names: List[str], forward_host: str, forward_port: int, ssl: bool = True) -> Dict:
        """Create a proxy host in NPM for ServerCraft panel access"""
        data = self._load_config()
        conn = data.get("connection", {})
        
        if not conn.get("url") or not conn.get("connected"):
            return {"success": False, "error": "Not connected to NPM"}
        
        token = await self._get_token(conn["url"], conn.get("email", ""), conn.get("password", ""))
        if not token:
            return {"success": False, "error": "Authentication failed"}
        
        proxy_config = {
            "domain_names": domain_names,
            "forward_scheme": "http",
            "forward_host": forward_host,
            "forward_port": forward_port,
            "block_exploits": True,
            "allow_websocket_upgrade": True,
            "access_list_id": "0",
            "certificate_id": 0,
            "ssl_forced": ssl,
            "http2_support": True,
            "meta": {"servercraft": True}
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{conn['url']}/api/nginx/proxy-hosts",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json=proxy_config,
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as response:
                    if response.status in (200, 201):
                        host = await response.json()
                        return {"success": True, "host": host, "message": "Proxy host created"}
                    else:
                        error_text = await response.text()
                        return {"success": False, "error": f"Failed to create proxy host: {error_text}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_ssl_certificates(self) -> Dict:
        """Fetch SSL certificates from NPM"""
        data = self._load_config()
        conn = data.get("connection", {})
        
        if not conn.get("url") or not conn.get("connected"):
            return {"success": False, "error": "Not connected", "certificates": []}
        
        token = await self._get_token(conn["url"], conn.get("email", ""), conn.get("password", ""))
        if not token:
            return {"success": False, "error": "Auth failed", "certificates": []}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{conn['url']}/api/nginx/certificates",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        certs = await response.json()
                        return {"success": True, "certificates": certs}
                    return {"success": False, "error": f"API error: {response.status}", "certificates": []}
        except Exception as e:
            return {"success": False, "error": str(e), "certificates": []}
    
    def disconnect(self) -> Dict:
        """Disconnect from NPM"""
        data = self._load_config()
        data["connection"]["connected"] = False
        data["connection"]["password"] = ""
        self._token = None
        self._save_config(data)
        return {"success": True, "message": "Disconnected from NPM"}
    
    def dismiss_setup_guide(self) -> Dict:
        """Dismiss the setup guide"""
        data = self._load_config()
        data["setup_guide_dismissed"] = True
        self._save_config(data)
        return {"success": True}
    
    def get_setup_guide(self) -> Dict:
        """Return the NPM setup guide content"""
        return {
            "title": "Nginx Proxy Manager Setup Guide",
            "dismissed": self._load_config().get("setup_guide_dismissed", False),
            "steps": [
                {
                    "step": 1,
                    "title": "Install Nginx Proxy Manager",
                    "description": "Install NPM on your server using Docker or bare metal. Docker is recommended.",
                    "commands": [
                        "docker run -d --name npm -p 80:80 -p 443:443 -p 81:81 jc21/nginx-proxy-manager:latest"
                    ],
                    "note": "Default login: admin@example.com / changeme"
                },
                {
                    "step": 2,
                    "title": "Access NPM Dashboard",
                    "description": "Open your browser and navigate to http://your-server-ip:81 to access the NPM admin panel.",
                    "note": "Change the default admin password immediately after first login."
                },
                {
                    "step": 3,
                    "title": "Connect ServerCraft to NPM",
                    "description": "Enter your NPM URL (e.g., http://localhost:81), email, and password in the connection settings above.",
                    "note": "ServerCraft will use the NPM API to manage proxy hosts and SSL certificates."
                },
                {
                    "step": 4,
                    "title": "Create a Proxy Host",
                    "description": "Create a proxy host pointing your domain to ServerCraft's port (8001). Enable SSL with Let's Encrypt for HTTPS.",
                    "note": "Make sure your domain's DNS A record points to your server's public IP."
                },
                {
                    "step": 5,
                    "title": "Enable SSL (Let's Encrypt)",
                    "description": "When creating the proxy host, enable 'Force SSL' and request a Let's Encrypt certificate. This gives you free HTTPS.",
                    "note": "Ports 80 and 443 must be accessible from the internet for certificate validation."
                }
            ]
        }
