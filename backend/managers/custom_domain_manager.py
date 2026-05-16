"""Custom Domain Manager for ServerCraft
Handles custom domain configuration with DNS propagation checking
"""

import json
import asyncio
import aiohttp
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict

class CustomDomainManager:
    """Manages custom domain configuration and DNS propagation checking"""
    
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.domain_file = data_path / "custom_domain.json"
        self._ensure_files()
    
    def _ensure_files(self):
        """Create data files if they don't exist"""
        if not self.domain_file.exists():
            self._save_json(self.domain_file, {
                "enabled": False,
                "domain": None,
                "subdomain": None,
                "is_dynamic_ip": True,
                "propagated": False,
                "last_check": None,
                "setup_instructions_acknowledged": False
            })
    
    def _load_json(self, filepath: Path) -> Dict:
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except:
            return {}
    
    def _save_json(self, filepath: Path, data: Dict):
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    def get_domain_config(self) -> Dict:
        """Get current domain configuration"""
        return self._load_json(self.domain_file)
    
    def save_domain_config(self, domain: str, subdomain: Optional[str] = None, is_dynamic_ip: bool = True) -> Dict:
        """Save domain configuration"""
        data = self._load_json(self.domain_file)
        
        # Clean domain input
        domain = domain.strip().lower()
        if subdomain:
            subdomain = subdomain.strip().lower()
        
        data.update({
            "enabled": True,
            "domain": domain,
            "subdomain": subdomain,
            "full_domain": f"{subdomain}.{domain}" if subdomain else domain,
            "is_dynamic_ip": is_dynamic_ip,
            "configured_at": datetime.now(timezone.utc).isoformat()
        })
        
        self._save_json(self.domain_file, data)
        return {"success": True, "message": "Domain configuration saved"}
    
    async def check_dns_propagation(self, domain: Optional[str] = None) -> Dict:
        """Check if DNS has fully propagated using external DNS checkers"""
        config = self._load_json(self.domain_file)
        
        # Use provided domain or get from config
        check_domain = domain or config.get("full_domain") or config.get("domain")
        
        if not check_domain:
            return {"success": False, "error": "No domain configured"}
        
        try:
            # Check multiple DNS resolvers for consistency
            resolvers = [
                "https://dns.google/resolve",  # Google DNS
                "https://cloudflare-dns.com/dns-query",  # Cloudflare
            ]
            
            results = []
            async with aiohttp.ClientSession() as session:
                for resolver in resolvers:
                    try:
                        params = {"name": check_domain, "type": "A"}
                        async with session.get(resolver, params=params, timeout=aiohttp.ClientTimeout(total=5)) as response:
                            if response.status == 200:
                                data = await response.json()
                                # Check if we got valid A records
                                has_records = False
                                if "Answer" in data and len(data["Answer"]) > 0:
                                    has_records = True
                                results.append(has_records)
                    except:
                        continue
            
            # Consider propagated if at least one resolver returns records
            propagated = any(results) if results else False
            
            # Update config
            config["propagated"] = propagated
            config["last_check"] = datetime.now(timezone.utc).isoformat()
            self._save_json(self.domain_file, config)
            
            return {
                "success": True,
                "propagated": propagated,
                "domain": check_domain,
                "checked_at": config["last_check"],
                "message": "DNS has fully propagated" if propagated else "DNS propagation in progress"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"DNS check failed: {str(e)}"
            }
    
    def acknowledge_setup(self) -> Dict:
        """Mark setup instructions as acknowledged"""
        data = self._load_json(self.domain_file)
        data["setup_instructions_acknowledged"] = True
        self._save_json(self.domain_file, data)
        return {"success": True}
    
    def disable_domain(self) -> Dict:
        """Disable custom domain"""
        data = self._load_json(self.domain_file)
        data["enabled"] = False
        self._save_json(self.domain_file, data)
        return {"success": True, "message": "Custom domain disabled"}
