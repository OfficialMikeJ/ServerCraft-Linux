"""Analytics Manager for ServerCraft
Handles device registration, analytics tracking, and feedback collection
"""

import json
import uuid
import platform
import hashlib
import aiohttp
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

class AnalyticsManager:
    """Manages analytics, device registration, and feedback"""
    
    # Current version for tracking
    CURRENT_VERSION = "2026.1.6.44D"
    
    # Monthly feedback questions (hardcoded, update each month)
    FEEDBACK_QUESTIONS = [
        {
            "id": "q1",
            "question": "How would you rate your overall experience with ServerCraft?",
            "type": "rating",
            "options": ["1 - Poor", "2 - Fair", "3 - Good", "4 - Very Good", "5 - Excellent"]
        },
        {
            "id": "q2", 
            "question": "Which feature do you use the most?",
            "type": "single",
            "options": ["Server Management", "SteamCMD", "Workshop Mods", "Node Clustering", "Other"]
        },
        {
            "id": "q3",
            "question": "What games do you primarily host servers for?",
            "type": "multiple",
            "options": ["Arma 3", "DayZ", "Rust", "Valheim", "Project Zomboid", "Minecraft", "Other"]
        },
        {
            "id": "q4",
            "question": "How likely are you to recommend ServerCraft to others?",
            "type": "rating",
            "options": ["1 - Not likely", "2 - Somewhat unlikely", "3 - Neutral", "4 - Somewhat likely", "5 - Very likely"]
        },
        {
            "id": "q5",
            "question": "What would you like to see improved or added?",
            "type": "single",
            "options": ["More game support", "Better UI/UX", "Performance improvements", "More documentation", "Mobile app", "Other"]
        }
    ]
    
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.analytics_file = data_path / "analytics.json"
        self.device_file = data_path / "device.json"
        self.feedback_file = data_path / "feedback_submissions.json"
        self._ensure_files()
    
    def _ensure_files(self):
        """Create data files if they don't exist"""
        if not self.device_file.exists():
            # Generate new Device ID on first run
            device_data = {
                "device_id": str(uuid.uuid4()),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "platform": platform.system(),
                "platform_version": platform.version(),
                "first_version": self.CURRENT_VERSION
            }
            self._save_json(self.device_file, device_data)
        
        if not self.analytics_file.exists():
            analytics_data = {
                "total_launches": 0,
                "total_servers_created": 0,
                "total_nodes_deployed": 0,
                "current_servers_running": 0,
                "last_launch": None,
                "version_history": [self.CURRENT_VERSION],
                "events": [],
                # Extended metrics for admin dashboard
                "total_workshop_mods_downloaded": 0,
                "total_password_resets": 0,
                "server_metrics": {},  # Per-server metrics
                "last_sync_to_admin": None
            }
            self._save_json(self.analytics_file, analytics_data)
        
        if not self.feedback_file.exists():
            self._save_json(self.feedback_file, {"submissions": []})
    
    def _load_json(self, filepath: Path) -> Dict:
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except:
            return {}
    
    def _save_json(self, filepath: Path, data: Dict):
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    # ==================== DEVICE ID ====================
    
    def get_device_id(self) -> str:
        """Get the unique device ID"""
        device_data = self._load_json(self.device_file)
        return device_data.get("device_id", "")
    
    def get_device_info(self) -> Dict:
        """Get full device information"""
        return self._load_json(self.device_file)
    
    # ==================== ANALYTICS TRACKING ====================
    
    def track_launch(self):
        """Track app launch"""
        analytics = self._load_json(self.analytics_file)
        analytics["total_launches"] = analytics.get("total_launches", 0) + 1
        analytics["last_launch"] = datetime.now(timezone.utc).isoformat()
        
        # Track version if new
        if self.CURRENT_VERSION not in analytics.get("version_history", []):
            analytics.setdefault("version_history", []).append(self.CURRENT_VERSION)
        
        self._save_json(self.analytics_file, analytics)
        return analytics
    
    def track_server_created(self):
        """Track when a server is created"""
        analytics = self._load_json(self.analytics_file)
        analytics["total_servers_created"] = analytics.get("total_servers_created", 0) + 1
        self._save_json(self.analytics_file, analytics)
    
    def track_node_deployed(self):
        """Track when a node is deployed to a cluster"""
        analytics = self._load_json(self.analytics_file)
        analytics["total_nodes_deployed"] = analytics.get("total_nodes_deployed", 0) + 1
        self._save_json(self.analytics_file, analytics)
    
    def update_running_servers(self, count: int):
        """Update count of currently running servers"""
        analytics = self._load_json(self.analytics_file)
        analytics["current_servers_running"] = count
        self._save_json(self.analytics_file, analytics)
    
    def track_event(self, event_type: str, data: Dict = None):
        """Track a custom event"""
        analytics = self._load_json(self.analytics_file)
        event = {
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data or {}
        }
        analytics.setdefault("events", []).append(event)
        
        # Keep only last 100 events
        if len(analytics["events"]) > 100:
            analytics["events"] = analytics["events"][-100:]
        
        self._save_json(self.analytics_file, analytics)
    
    # ==================== EXTENDED METRICS FOR ADMIN DASHBOARD ====================
    
    def track_workshop_download(self):
        """Track workshop mod download"""
        analytics = self._load_json(self.analytics_file)
        analytics["total_workshop_mods_downloaded"] = analytics.get("total_workshop_mods_downloaded", 0) + 1
        self._save_json(self.analytics_file, analytics)
    
    def track_password_reset(self):
        """Track admin password reset"""
        analytics = self._load_json(self.analytics_file)
        analytics["total_password_resets"] = analytics.get("total_password_resets", 0) + 1
        self._save_json(self.analytics_file, analytics)
    
    def update_server_metrics(self, server_id: str, metrics: Dict):
        """Update per-server metrics
        
        metrics should contain:
        - storage_used_gb: float
        - ram_used_gb: float
        - network_download_mbps: float
        - network_upload_mbps: float
        - uptime_seconds: int
        - downtime_seconds: int
        - total_runtime_seconds: int
        - is_running: bool
        """
        analytics = self._load_json(self.analytics_file)
        server_metrics = analytics.setdefault("server_metrics", {})
        
        if server_id not in server_metrics:
            server_metrics[server_id] = {
                "created_at": datetime.now(timezone.utc).isoformat(),
                "storage_used_gb": 0,
                "ram_used_gb": 0,
                "network_download_mbps": 0,
                "network_upload_mbps": 0,
                "uptime_seconds": 0,
                "downtime_seconds": 0,
                "total_runtime_seconds": 0,
                "is_running": False,
                "last_updated": None
            }
        
        # Update metrics
        server_metrics[server_id].update(metrics)
        server_metrics[server_id]["last_updated"] = datetime.now(timezone.utc).isoformat()
        
        self._save_json(self.analytics_file, analytics)
    
    def get_aggregated_metrics(self) -> Dict:
        """Get aggregated metrics for all servers"""
        analytics = self._load_json(self.analytics_file)
        server_metrics = analytics.get("server_metrics", {})
        
        total_storage = 0
        total_ram = 0
        total_download = 0
        total_upload = 0
        total_uptime = 0
        total_downtime = 0
        total_runtime = 0
        
        for server_id, metrics in server_metrics.items():
            total_storage += metrics.get("storage_used_gb", 0)
            total_ram += metrics.get("ram_used_gb", 0)
            total_download += metrics.get("network_download_mbps", 0)
            total_upload += metrics.get("network_upload_mbps", 0)
            total_uptime += metrics.get("uptime_seconds", 0)
            total_downtime += metrics.get("downtime_seconds", 0)
            total_runtime += metrics.get("total_runtime_seconds", 0)
        
        return {
            "total_storage_used_gb": round(total_storage, 2),
            "total_ram_used_gb": round(total_ram, 2),
            "total_network_download_mbps": round(total_download, 2),
            "total_network_upload_mbps": round(total_upload, 2),
            "total_uptime_seconds": total_uptime,
            "total_downtime_seconds": total_downtime,
            "total_runtime_seconds": total_runtime,
            "total_servers": len(server_metrics)
        }
    
    def get_analytics(self) -> Dict:
        """Get all analytics data"""
        analytics = self._load_json(self.analytics_file)
        device = self.get_device_info()
        aggregated = self.get_aggregated_metrics()
        
        return {
            "device_id": device.get("device_id"),
            "platform": device.get("platform"),
            "current_version": self.CURRENT_VERSION,
            "first_version": device.get("first_version"),
            "registered_at": device.get("created_at"),
            "total_launches": analytics.get("total_launches", 0),
            "total_servers_created": analytics.get("total_servers_created", 0),
            "total_nodes_deployed": analytics.get("total_nodes_deployed", 0),
            "current_servers_running": analytics.get("current_servers_running", 0),
            "last_launch": analytics.get("last_launch"),
            "version_history": analytics.get("version_history", []),
            # Extended metrics
            "total_workshop_mods_downloaded": analytics.get("total_workshop_mods_downloaded", 0),
            "total_password_resets": analytics.get("total_password_resets", 0),
            "aggregated_metrics": aggregated,
            "server_metrics": analytics.get("server_metrics", {}),
            "last_sync_to_admin": analytics.get("last_sync_to_admin")
        }
    
    # ==================== FEEDBACK ====================
    
    def get_feedback_questions(self) -> List[Dict]:
        """Get current month's feedback questions"""
        return self.FEEDBACK_QUESTIONS
    
    def submit_feedback(self, answers: Dict, additional_feedback: str, ip_address: str = None) -> Dict:
        """Submit feedback form"""
        device = self.get_device_info()
        
        submission = {
            "id": str(uuid.uuid4()),
            "device_id": device.get("device_id"),
            "ip_address": ip_address or "unknown",
            "platform": device.get("platform"),
            "version": self.CURRENT_VERSION,
            "answers": answers,
            "additional_feedback": additional_feedback,
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Save locally
        feedback_data = self._load_json(self.feedback_file)
        feedback_data.setdefault("submissions", []).append(submission)
        self._save_json(self.feedback_file, feedback_data)
        
        return submission
    
    def get_local_feedback(self) -> List[Dict]:
        """Get locally stored feedback submissions"""
        data = self._load_json(self.feedback_file)
        return data.get("submissions", [])
    
    # ==================== REMOTE SYNC ====================
    
    async def sync_to_admin_dashboard(self, api_endpoint: str = "https://servercraft.dev") -> Dict:
        """Sync comprehensive analytics to servercraft.dev admin dashboard"""
        analytics = self.get_analytics()
        
        payload = {
            "type": "admin_analytics_sync",
            "device_id": analytics.get("device_id"),
            "platform": analytics.get("platform"),
            "version": analytics.get("current_version"),
            "metrics": {
                "total_servers_installed": analytics.get("total_servers_created", 0),
                "total_workshop_mods_downloaded": analytics.get("total_workshop_mods_downloaded", 0),
                "total_password_resets": analytics.get("total_password_resets", 0),
                "total_storage_used_gb": analytics.get("aggregated_metrics", {}).get("total_storage_used_gb", 0),
                "total_ram_used_gb": analytics.get("aggregated_metrics", {}).get("total_ram_used_gb", 0),
                "total_network_download_mbps": analytics.get("aggregated_metrics", {}).get("total_network_download_mbps", 0),
                "total_network_upload_mbps": analytics.get("aggregated_metrics", {}).get("total_network_upload_mbps", 0),
                "total_uptime_seconds": analytics.get("aggregated_metrics", {}).get("total_uptime_seconds", 0),
                "total_downtime_seconds": analytics.get("aggregated_metrics", {}).get("total_downtime_seconds", 0),
                "total_runtime_seconds": analytics.get("aggregated_metrics", {}).get("total_runtime_seconds", 0),
                "servers_per_instance": analytics.get("server_metrics", {})
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{api_endpoint}/api/admin/analytics/receive",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        # Update last sync time
                        analytics_data = self._load_json(self.analytics_file)
                        analytics_data["last_sync_to_admin"] = datetime.now(timezone.utc).isoformat()
                        self._save_json(self.analytics_file, analytics_data)
                        return {"success": True, "message": "Synced to admin dashboard"}
                    else:
                        error_text = await response.text()
                        return {"success": False, "error": f"HTTP {response.status}: {error_text}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def sync_to_server(self, api_endpoint: str) -> Dict:
        """Sync analytics and feedback to remote server"""
        analytics = self.get_analytics()
        
        payload = {
            "type": "analytics_sync",
            "device_id": analytics.get("device_id"),
            "data": analytics,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{api_endpoint}/api/analytics/receive",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        return {"success": True, "message": "Synced successfully"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_feedback_to_server(self, api_endpoint: str, submission: Dict) -> Dict:
        """Send feedback submission to remote server"""
        payload = {
            "type": "feedback_submission",
            **submission
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{api_endpoint}/api/analytics/feedback",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        return {"success": True, "message": "Feedback submitted"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status}"}
        except Exception as e:
            return {"success": False, "error": str(e)}


# ==================== ADMIN ANALYTICS (Server-side) ====================

class AdminAnalyticsManager:
    """Server-side analytics aggregation for admin dashboard"""
    
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.received_analytics_file = data_path / "received_analytics.json"
        self.received_feedback_file = data_path / "received_feedback.json"
        self.admin_users_file = data_path / "admin_users.json"
        self._ensure_files()
    
    def _ensure_files(self):
        if not self.received_analytics_file.exists():
            self._save_json(self.received_analytics_file, {
                "devices": {},
                "total_downloads": 0,
                "total_updates": 5,  # Count of released versions
                "aggregate_stats": {
                    "total_servers_running": 0,
                    "total_nodes_deployed": 0
                }
            })
        
        if not self.received_feedback_file.exists():
            self._save_json(self.received_feedback_file, {"submissions": []})
        
        if not self.admin_users_file.exists():
            # Default admin credentials
            import hashlib
            default_hash = hashlib.sha256("servercraft_admin_2026!AdminPass".encode()).hexdigest()
            self._save_json(self.admin_users_file, {
                "admins": [
                    {
                        "username": "admin",
                        "password_hash": default_hash,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                ]
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
    
    def receive_analytics(self, device_id: str, data: Dict) -> bool:
        """Receive comprehensive analytics from a ServerCraft instance"""
        analytics = self._load_json(self.received_analytics_file)
        
        # Update device data with comprehensive metrics
        analytics.setdefault("devices", {})[device_id] = {
            "last_sync": datetime.now(timezone.utc).isoformat(),
            "platform": data.get("platform"),
            "version": data.get("version"),
            "metrics": data.get("metrics", {}),
            "full_data": data
        }
        
        # Increment download count if new device
        if device_id not in analytics.get("devices", {}):
            analytics["total_downloads"] = analytics.get("total_downloads", 0) + 1
        
        # Update aggregate stats for all devices
        total_servers = 0
        total_nodes = 0
        total_mods = 0
        total_password_resets = 0
        total_storage = 0
        total_ram = 0
        total_download = 0
        total_upload = 0
        total_uptime = 0
        total_downtime = 0
        total_runtime = 0
        
        for dev_id, dev_data in analytics.get("devices", {}).items():
            metrics = dev_data.get("metrics", {})
            total_servers += metrics.get("total_servers_installed", 0)
            total_mods += metrics.get("total_workshop_mods_downloaded", 0)
            total_password_resets += metrics.get("total_password_resets", 0)
            total_storage += metrics.get("total_storage_used_gb", 0)
            total_ram += metrics.get("total_ram_used_gb", 0)
            total_download += metrics.get("total_network_download_mbps", 0)
            total_upload += metrics.get("total_network_upload_mbps", 0)
            total_uptime += metrics.get("total_uptime_seconds", 0)
            total_downtime += metrics.get("total_downtime_seconds", 0)
            total_runtime += metrics.get("total_runtime_seconds", 0)
        
        analytics["aggregate_stats"] = {
            "total_servers_installed": total_servers,
            "total_workshop_mods_downloaded": total_mods,
            "total_password_resets": total_password_resets,
            "total_storage_used_gb": round(total_storage, 2),
            "total_ram_used_gb": round(total_ram, 2),
            "total_network_download_mbps": round(total_download, 2),
            "total_network_upload_mbps": round(total_upload, 2),
            "total_uptime_seconds": total_uptime,
            "total_downtime_seconds": total_downtime,
            "total_runtime_seconds": total_runtime,
            "total_devices": len(analytics.get("devices", {})),
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        self._save_json(self.received_analytics_file, analytics)
        return True
    
    def receive_feedback(self, submission: Dict) -> bool:
        """Receive feedback submission"""
        feedback = self._load_json(self.received_feedback_file)
        feedback.setdefault("submissions", []).append({
            **submission,
            "received_at": datetime.now(timezone.utc).isoformat()
        })
        self._save_json(self.received_feedback_file, feedback)
        return True
    
    def get_public_stats(self) -> Dict:
        """Get stats for public display"""
        analytics = self._load_json(self.received_analytics_file)
        
        return {
            "total_downloads": analytics.get("total_downloads", 0),
            "total_updates": analytics.get("total_updates", 5),
            "total_servers_running": analytics.get("aggregate_stats", {}).get("total_servers_running", 0),
            "total_nodes_deployed": analytics.get("aggregate_stats", {}).get("total_nodes_deployed", 0),
            "total_devices": len(analytics.get("devices", {}))
        }
    
    def get_all_analytics(self) -> Dict:
        """Get all analytics for admin dashboard"""
        return self._load_json(self.received_analytics_file)
    
    def get_all_feedback(self) -> List[Dict]:
        """Get all feedback submissions for admin dashboard"""
        feedback = self._load_json(self.received_feedback_file)
        return feedback.get("submissions", [])
    
    def admin_login(self, username: str, password: str) -> Optional[str]:
        """Authenticate admin user"""
        import hashlib
        import secrets
        
        admins = self._load_json(self.admin_users_file)
        password_hash = hashlib.sha256(f"servercraft_admin_2026!{password}".encode()).hexdigest()
        
        for admin in admins.get("admins", []):
            if admin["username"] == username and admin["password_hash"] == password_hash:
                # Generate session token
                token = secrets.token_urlsafe(32)
                
                # Store session
                admins.setdefault("sessions", {})[token] = {
                    "username": username,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                self._save_json(self.admin_users_file, admins)
                
                return token
        
        return None
    
    def validate_admin_session(self, token: str) -> bool:
        """Validate admin session token"""
        admins = self._load_json(self.admin_users_file)
        return token in admins.get("sessions", {})
    
    def admin_logout(self, token: str):
        """Logout admin session"""
        admins = self._load_json(self.admin_users_file)
        if token in admins.get("sessions", {}):
            del admins["sessions"][token]
            self._save_json(self.admin_users_file, admins)
