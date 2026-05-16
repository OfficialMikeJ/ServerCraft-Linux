"""Server Sales Manager for ServerCraft
Handles selling game servers with PayPal integration
"""

import json
import hashlib
import base64
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, List
import aiohttp

class ServerSalesManager:
    """Manages server selling feature with PayPal integration"""
    
    DEFAULT_PACKAGES = [
        {
            "id": "basic",
            "name": "Basic Server",
            "description": "Perfect for small communities",
            "specs": {
                "cpu_cores": 2,
                "ram_gb": 4,
                "storage_gb": 20,
                "player_slots": 10
            },
            "price": 9.99,
            "currency": "EUR"
        },
        {
            "id": "standard",
            "name": "Standard Server",
            "description": "Great for medium-sized groups",
            "specs": {
                "cpu_cores": 4,
                "ram_gb": 8,
                "storage_gb": 50,
                "player_slots": 32
            },
            "price": 19.99,
            "currency": "EUR"
        },
        {
            "id": "premium",
            "name": "Premium Server",
            "description": "For large communities",
            "specs": {
                "cpu_cores": 8,
                "ram_gb": 16,
                "storage_gb": 100,
                "player_slots": 64
            },
            "price": 39.99,
            "currency": "EUR"
        }
    ]
    
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.sales_file = data_path / "server_sales.json"
        self._ensure_files()
    
    def _ensure_files(self):
        """Create data files if they don't exist"""
        if not self.sales_file.exists():
            self._save_json(self.sales_file, {
                "enabled": False,
                "packages": self.DEFAULT_PACKAGES,
                "paypal_mode": "sandbox",  # sandbox or live
                "paypal_client_id_encrypted": None,
                "paypal_secret_encrypted": None,
                "paypal_configured": False,
                "secondary_subdomain": None,
                "orders": []
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
    
    def _encrypt_credential(self, credential: str) -> str:
        """Simple encryption for storing credentials"""
        # Use base64 encoding (in production, use proper encryption)
        return base64.b64encode(credential.encode()).decode()
    
    def _decrypt_credential(self, encrypted: str) -> str:
        """Decrypt stored credential"""
        return base64.b64decode(encrypted.encode()).decode()
    
    def get_sales_config(self) -> Dict:
        """Get sales configuration (without sensitive data)"""
        data = self._load_json(self.sales_file)
        
        # Hide sensitive credentials
        safe_data = data.copy()
        if safe_data.get("paypal_client_id_encrypted"):
            safe_data["paypal_client_id_masked"] = "********"
        if safe_data.get("paypal_secret_encrypted"):
            safe_data["paypal_secret_masked"] = "********"
        
        # Remove encrypted fields from response
        safe_data.pop("paypal_client_id_encrypted", None)
        safe_data.pop("paypal_secret_encrypted", None)
        
        return safe_data
    
    def toggle_sales(self, enabled: bool) -> Dict:
        """Enable or disable server sales"""
        data = self._load_json(self.sales_file)
        data["enabled"] = enabled
        self._save_json(self.sales_file, data)
        return {"success": True, "enabled": enabled}
    
    def update_packages(self, packages: List[Dict]) -> Dict:
        """Update server packages"""
        data = self._load_json(self.sales_file)
        data["packages"] = packages
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._save_json(self.sales_file, data)
        return {"success": True, "message": "Packages updated"}
    
    def configure_paypal(self, client_id: str, secret: str, mode: str = "sandbox") -> Dict:
        """Configure PayPal credentials"""
        data = self._load_json(self.sales_file)
        
        data["paypal_client_id_encrypted"] = self._encrypt_credential(client_id)
        data["paypal_secret_encrypted"] = self._encrypt_credential(secret)
        data["paypal_mode"] = mode
        data["paypal_configured"] = True
        data["paypal_configured_at"] = datetime.now(timezone.utc).isoformat()
        
        self._save_json(self.sales_file, data)
        return {"success": True, "message": "PayPal credentials saved"}
    
    async def test_paypal_connection(self) -> Dict:
        """Test PayPal API connection"""
        data = self._load_json(self.sales_file)
        
        if not data.get("paypal_configured"):
            return {"success": False, "error": "PayPal not configured"}
        
        try:
            client_id = self._decrypt_credential(data["paypal_client_id_encrypted"])
            secret = self._decrypt_credential(data["paypal_secret_encrypted"])
            mode = data.get("paypal_mode", "sandbox")
            
            # PayPal OAuth endpoint
            base_url = "https://api-m.sandbox.paypal.com" if mode == "sandbox" else "https://api-m.paypal.com"
            auth_url = f"{base_url}/v1/oauth2/token"
            
            # Get access token
            auth = aiohttp.BasicAuth(client_id, secret)
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    auth_url,
                    auth=auth,
                    data={"grant_type": "client_credentials"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        return {
                            "success": True,
                            "message": f"PayPal connection successful ({mode} mode)",
                            "mode": mode
                        }
                    else:
                        error_data = await response.text()
                        return {
                            "success": False,
                            "error": f"PayPal authentication failed: {error_data}"
                        }
        except Exception as e:
            return {
                "success": False,
                "error": f"Connection test failed: {str(e)}"
            }
    
    def set_secondary_subdomain(self, subdomain: str) -> Dict:
        """Set secondary subdomain for server sales"""
        data = self._load_json(self.sales_file)
        data["secondary_subdomain"] = subdomain.strip().lower()
        data["subdomain_updated_at"] = datetime.now(timezone.utc).isoformat()
        self._save_json(self.sales_file, data)
        return {"success": True, "message": "Secondary subdomain saved"}
    
    def get_packages(self) -> List[Dict]:
        """Get all server packages"""
        data = self._load_json(self.sales_file)
        return data.get("packages", self.DEFAULT_PACKAGES)
