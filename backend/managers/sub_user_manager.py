"""Sub-User Manager for ServerCraft
Multi-user system with role-based access control for server management
Roles: admin (full access), moderator (manage assigned servers), viewer (read-only)
"""

import json
import hashlib
import secrets
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any

ROLES = {
    "admin": {
        "label": "Administrator",
        "description": "Full access to all features and servers",
        "permissions": ["*"]
    },
    "moderator": {
        "label": "Moderator",
        "description": "Can start/stop/restart assigned servers, view console, manage mods",
        "permissions": [
            "server.view", "server.start", "server.stop", "server.restart",
            "server.console", "server.command", "workshop.view", "workshop.download",
            "workshop.delete", "marketplace.browse", "marketplace.download"
        ]
    },
    "viewer": {
        "label": "Viewer",
        "description": "Read-only access to assigned servers and system stats",
        "permissions": [
            "server.view", "server.console", "stats.view",
            "marketplace.browse"
        ]
    }
}


class SubUserManager:
    """Manages sub-users with role-based permissions"""
    
    SALT = "servercraft_subuser_2026"
    SESSION_TIMEOUT_MINUTES = 60
    
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.users_file = data_path / "sub_users.json"
        self.sessions_file = data_path / "sub_user_sessions.json"
        self._ensure_files()
    
    def _ensure_files(self):
        if not self.users_file.exists():
            self._save_json(self.users_file, {"users": [], "enabled": True})
        if not self.sessions_file.exists():
            self._save_json(self.sessions_file, {"sessions": {}})
    
    def _load_json(self, filepath: Path) -> Dict:
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except Exception:
            return {}
    
    def _save_json(self, filepath: Path, data: Dict):
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    def _hash_password(self, password: str) -> str:
        return hashlib.sha256(f"{self.SALT}{password}".encode()).hexdigest()
    
    def is_enabled(self) -> bool:
        data = self._load_json(self.users_file)
        return data.get("enabled", True)
    
    def toggle_feature(self, enabled: bool) -> Dict:
        data = self._load_json(self.users_file)
        data["enabled"] = enabled
        self._save_json(self.users_file, data)
        return {"success": True, "enabled": enabled}
    
    def get_roles(self) -> Dict:
        return ROLES
    
    def get_users(self) -> List[Dict]:
        """Get all sub-users (without password hashes)"""
        data = self._load_json(self.users_file)
        users = []
        for user in data.get("users", []):
            users.append({
                "id": user["id"],
                "username": user["username"],
                "role": user["role"],
                "role_label": ROLES.get(user["role"], {}).get("label", user["role"]),
                "assigned_servers": user.get("assigned_servers", []),
                "created_at": user.get("created_at"),
                "last_login": user.get("last_login"),
                "active": user.get("active", True)
            })
        return users
    
    def get_user(self, user_id: str) -> Optional[Dict]:
        data = self._load_json(self.users_file)
        for user in data.get("users", []):
            if user["id"] == user_id:
                return {
                    "id": user["id"],
                    "username": user["username"],
                    "role": user["role"],
                    "role_label": ROLES.get(user["role"], {}).get("label", user["role"]),
                    "assigned_servers": user.get("assigned_servers", []),
                    "permissions": ROLES.get(user["role"], {}).get("permissions", []),
                    "created_at": user.get("created_at"),
                    "last_login": user.get("last_login"),
                    "active": user.get("active", True)
                }
        return None
    
    def create_user(self, username: str, password: str, role: str, assigned_servers: List[str] = None) -> Dict:
        """Create a new sub-user"""
        if role not in ROLES:
            return {"success": False, "error": f"Invalid role. Must be one of: {', '.join(ROLES.keys())}"}
        
        if len(username) < 3:
            return {"success": False, "error": "Username must be at least 3 characters"}
        
        if len(password) < 8:
            return {"success": False, "error": "Password must be at least 8 characters"}
        
        data = self._load_json(self.users_file)
        
        # Check username uniqueness
        for user in data.get("users", []):
            if user["username"].lower() == username.lower():
                return {"success": False, "error": "Username already exists"}
        
        user = {
            "id": str(uuid.uuid4()),
            "username": username,
            "password_hash": self._hash_password(password),
            "role": role,
            "assigned_servers": assigned_servers or [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None,
            "active": True
        }
        
        data.setdefault("users", []).append(user)
        self._save_json(self.users_file, data)
        
        return {
            "success": True,
            "user_id": user["id"],
            "message": f"User '{username}' created with role '{ROLES[role]['label']}'"
        }
    
    def update_user(self, user_id: str, updates: Dict) -> Dict:
        """Update a sub-user's role, assigned servers, or active status"""
        data = self._load_json(self.users_file)
        
        for i, user in enumerate(data.get("users", [])):
            if user["id"] == user_id:
                if "role" in updates and updates["role"] in ROLES:
                    data["users"][i]["role"] = updates["role"]
                if "assigned_servers" in updates:
                    data["users"][i]["assigned_servers"] = updates["assigned_servers"]
                if "active" in updates:
                    data["users"][i]["active"] = updates["active"]
                if "password" in updates and len(updates["password"]) >= 8:
                    data["users"][i]["password_hash"] = self._hash_password(updates["password"])
                
                self._save_json(self.users_file, data)
                return {"success": True, "message": "User updated"}
        
        return {"success": False, "error": "User not found"}
    
    def delete_user(self, user_id: str) -> Dict:
        """Delete a sub-user"""
        data = self._load_json(self.users_file)
        original_count = len(data.get("users", []))
        data["users"] = [u for u in data.get("users", []) if u["id"] != user_id]
        
        if len(data["users"]) < original_count:
            self._save_json(self.users_file, data)
            # Also remove sessions
            sessions_data = self._load_json(self.sessions_file)
            sessions = sessions_data.get("sessions", {})
            sessions = {k: v for k, v in sessions.items() if v.get("user_id") != user_id}
            sessions_data["sessions"] = sessions
            self._save_json(self.sessions_file, sessions_data)
            return {"success": True, "message": "User deleted"}
        
        return {"success": False, "error": "User not found"}
    
    def login(self, username: str, password: str) -> Dict:
        """Login a sub-user"""
        data = self._load_json(self.users_file)
        
        for user in data.get("users", []):
            if user["username"].lower() == username.lower():
                if not user.get("active", True):
                    return {"success": False, "error": "Account is deactivated"}
                
                if user["password_hash"] != self._hash_password(password):
                    return {"success": False, "error": "Invalid credentials"}
                
                # Generate session
                token = secrets.token_urlsafe(32)
                expiry = datetime.now(timezone.utc) + timedelta(minutes=self.SESSION_TIMEOUT_MINUTES)
                
                sessions_data = self._load_json(self.sessions_file)
                sessions_data.setdefault("sessions", {})[token] = {
                    "user_id": user["id"],
                    "username": user["username"],
                    "role": user["role"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": expiry.isoformat()
                }
                self._save_json(self.sessions_file, sessions_data)
                
                # Update last login
                for i, u in enumerate(data["users"]):
                    if u["id"] == user["id"]:
                        data["users"][i]["last_login"] = datetime.now(timezone.utc).isoformat()
                        break
                self._save_json(self.users_file, data)
                
                return {
                    "success": True,
                    "token": token,
                    "user_id": user["id"],
                    "username": user["username"],
                    "role": user["role"],
                    "role_label": ROLES.get(user["role"], {}).get("label", user["role"]),
                    "assigned_servers": user.get("assigned_servers", []),
                    "permissions": ROLES.get(user["role"], {}).get("permissions", [])
                }
        
        return {"success": False, "error": "Invalid credentials"}
    
    def validate_session(self, token: str) -> Optional[Dict]:
        """Validate a sub-user session token"""
        sessions_data = self._load_json(self.sessions_file)
        session = sessions_data.get("sessions", {}).get(token)
        
        if not session:
            return None
        
        expires_at = datetime.fromisoformat(session["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            del sessions_data["sessions"][token]
            self._save_json(self.sessions_file, sessions_data)
            return None
        
        # Refresh session
        session["expires_at"] = (datetime.now(timezone.utc) + timedelta(minutes=self.SESSION_TIMEOUT_MINUTES)).isoformat()
        sessions_data["sessions"][token] = session
        self._save_json(self.sessions_file, sessions_data)
        
        # Get user data for assigned servers
        user = self.get_user(session["user_id"])
        
        return {
            "valid": True,
            "user_id": session["user_id"],
            "username": session["username"],
            "role": session["role"],
            "assigned_servers": user.get("assigned_servers", []) if user else [],
            "permissions": ROLES.get(session["role"], {}).get("permissions", [])
        }
    
    def check_permission(self, token: str, permission: str, server_id: str = None) -> bool:
        """Check if a sub-user has a specific permission"""
        session = self.validate_session(token)
        if not session:
            return False
        
        role_perms = ROLES.get(session["role"], {}).get("permissions", [])
        
        # Admin has all permissions
        if "*" in role_perms:
            return True
        
        # Check specific permission
        if permission not in role_perms:
            return False
        
        # Check server assignment for server-specific permissions
        if server_id and session["role"] != "admin":
            assigned = session.get("assigned_servers", [])
            if assigned and server_id not in assigned:
                return False
        
        return True
    
    def logout(self, token: str) -> Dict:
        sessions_data = self._load_json(self.sessions_file)
        if token in sessions_data.get("sessions", {}):
            del sessions_data["sessions"][token]
            self._save_json(self.sessions_file, sessions_data)
        return {"success": True}
