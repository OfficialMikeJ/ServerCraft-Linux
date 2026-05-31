"""Authentication Manager for ServerCraft
Handles local user authentication, password reset, and session management
"""

import json
import hashlib
import secrets
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

class AuthManager:
    """Manages local authentication for ServerCraft"""
    
    # Default security questions
    SECURITY_QUESTIONS = [
        "What is your pet's name?",
        "What city were you born in?",
        "What is your mother's maiden name?",
        "What was the name of your first school?",
        "What is your favorite movie?"
    ]
    
    # Default credentials that must be changed
    DEFAULT_USERNAME = "Admin"
    DEFAULT_PASSWORD = "Password123!"
    
    # Session timeout in minutes
    SESSION_TIMEOUT_MINUTES = 15
    REMEMBER_ME_DAYS = 30
    
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.auth_file = data_path / "auth.json"
        self.sessions_file = data_path / "sessions.json"
        self._ensure_auth_file()
    
    def _ensure_auth_file(self):
        """Create auth file with default credentials if it doesn't exist"""
        if not self.auth_file.exists():
            default_auth = {
                "user": {
                    "username": self.DEFAULT_USERNAME,
                    "password_hash": self._hash_password(self.DEFAULT_PASSWORD),
                    "must_change_password": True,
                    "security_questions": [],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "last_login": None
                }
            }
            self._save_auth(default_auth)
        
        if not self.sessions_file.exists():
            self._save_sessions({})
    
    def _get_salt(self) -> str:
        """Return a per-installation salt, generating and persisting one on first call.
        Existing installs fall back to the legacy static salt so stored hashes stay valid."""
        salt_file = self.data_path / ".auth_salt"
        if salt_file.exists():
            return salt_file.read_text().strip()
        # Existing install: preserve the old hash by writing the legacy salt
        # New install: generate a cryptographically random salt
        salt = "servercraft_2026" if self.auth_file.exists() else secrets.token_hex(32)
        salt_file.write_text(salt)
        return salt

    def _hash_password(self, password: str) -> str:
        """Hash password using SHA-256 with a per-installation salt."""
        return hashlib.sha256(f"{self._get_salt()}{password}".encode()).hexdigest()
    
    def _load_auth(self) -> Dict:
        """Load auth data from file"""
        try:
            with open(self.auth_file, 'r') as f:
                return json.load(f)
        except:
            return {}
    
    def _save_auth(self, auth_data: Dict):
        """Save auth data to file"""
        with open(self.auth_file, 'w') as f:
            json.dump(auth_data, f, indent=2)
    
    def _load_sessions(self) -> Dict:
        """Load sessions from file"""
        try:
            with open(self.sessions_file, 'r') as f:
                return json.load(f)
        except:
            return {}
    
    def _save_sessions(self, sessions: Dict):
        """Save sessions to file"""
        with open(self.sessions_file, 'w') as f:
            json.dump(sessions, f, indent=2)
    
    def _generate_session_token(self) -> str:
        """Generate a secure session token"""
        return secrets.token_urlsafe(32)
    
    def login(self, username: str, password: str, remember_me: bool = False) -> Dict[str, Any]:
        """Attempt to login with credentials"""
        auth_data = self._load_auth()
        user = auth_data.get("user", {})
        
        if not user:
            return {"success": False, "error": "No user configured"}
        
        # Check credentials
        if user["username"].lower() != username.lower():
            return {"success": False, "error": "Invalid username or password"}
        
        if user["password_hash"] != self._hash_password(password):
            return {"success": False, "error": "Invalid username or password"}
        
        # Generate session
        session_token = self._generate_session_token()
        
        # Calculate expiry
        if remember_me:
            expiry = datetime.now(timezone.utc) + timedelta(days=self.REMEMBER_ME_DAYS)
        else:
            expiry = datetime.now(timezone.utc) + timedelta(minutes=self.SESSION_TIMEOUT_MINUTES)
        
        # Save session
        sessions = self._load_sessions()
        sessions[session_token] = {
            "username": user["username"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expiry.isoformat(),
            "remember_me": remember_me,
            "last_activity": datetime.now(timezone.utc).isoformat()
        }
        self._save_sessions(sessions)
        
        # Update last login
        auth_data["user"]["last_login"] = datetime.now(timezone.utc).isoformat()
        self._save_auth(auth_data)
        
        return {
            "success": True,
            "token": session_token,
            "username": user["username"],
            "must_change_password": user.get("must_change_password", False),
            "has_security_questions": len(user.get("security_questions", [])) >= 3,
            "expires_at": expiry.isoformat()
        }
    
    def validate_session(self, token: str) -> Dict[str, Any]:
        """Validate a session token and refresh if valid"""
        if not token:
            return {"valid": False, "error": "No token provided"}
        
        sessions = self._load_sessions()
        session = sessions.get(token)
        
        if not session:
            return {"valid": False, "error": "Invalid session"}
        
        # Check expiry
        expires_at = datetime.fromisoformat(session["expires_at"])
        now = datetime.now(timezone.utc)
        
        if now > expires_at:
            # Session expired, remove it
            del sessions[token]
            self._save_sessions(sessions)
            return {"valid": False, "error": "Session expired"}
        
        # Refresh session if not remember_me
        if not session.get("remember_me", False):
            session["expires_at"] = (now + timedelta(minutes=self.SESSION_TIMEOUT_MINUTES)).isoformat()
        
        session["last_activity"] = now.isoformat()
        sessions[token] = session
        self._save_sessions(sessions)
        
        auth_data = self._load_auth()
        user = auth_data.get("user", {})
        
        return {
            "valid": True,
            "username": session["username"],
            "must_change_password": user.get("must_change_password", False),
            "has_security_questions": len(user.get("security_questions", [])) >= 3,
            "expires_at": session["expires_at"]
        }
    
    def logout(self, token: str) -> bool:
        """Logout and invalidate session"""
        sessions = self._load_sessions()
        if token in sessions:
            del sessions[token]
            self._save_sessions(sessions)
            return True
        return False
    
    def change_password(self, token: str, current_password: str, new_password: str) -> Dict[str, Any]:
        """Change user password"""
        # Validate session first
        session_result = self.validate_session(token)
        if not session_result.get("valid"):
            return {"success": False, "error": "Invalid session"}
        
        auth_data = self._load_auth()
        user = auth_data.get("user", {})
        
        # Verify current password
        if user["password_hash"] != self._hash_password(current_password):
            return {"success": False, "error": "Current password is incorrect"}
        
        # Validate new password
        if len(new_password) < 8:
            return {"success": False, "error": "Password must be at least 8 characters"}
        
        if new_password == self.DEFAULT_PASSWORD:
            return {"success": False, "error": "Please choose a different password"}
        
        # Update password
        auth_data["user"]["password_hash"] = self._hash_password(new_password)
        auth_data["user"]["must_change_password"] = False
        auth_data["user"]["password_changed_at"] = datetime.now(timezone.utc).isoformat()
        self._save_auth(auth_data)
        
        return {"success": True, "message": "Password changed successfully"}
    
    def change_username(self, token: str, new_username: str) -> Dict[str, Any]:
        """Change username"""
        session_result = self.validate_session(token)
        if not session_result.get("valid"):
            return {"success": False, "error": "Invalid session"}
        
        if not new_username or len(new_username) < 3:
            return {"success": False, "error": "Username must be at least 3 characters"}
        
        if new_username.lower() == self.DEFAULT_USERNAME.lower():
            return {"success": False, "error": "Please choose a different username"}
        
        auth_data = self._load_auth()
        auth_data["user"]["username"] = new_username
        self._save_auth(auth_data)
        
        # Update sessions
        sessions = self._load_sessions()
        if token in sessions:
            sessions[token]["username"] = new_username
            self._save_sessions(sessions)
        
        return {"success": True, "message": "Username changed successfully"}
    
    def setup_security_questions(self, token: str, questions: list) -> Dict[str, Any]:
        """Set up security questions for password reset"""
        session_result = self.validate_session(token)
        if not session_result.get("valid"):
            return {"success": False, "error": "Invalid session"}
        
        if len(questions) < 3:
            return {"success": False, "error": "Must provide at least 3 security questions"}
        
        # Validate format
        for q in questions:
            if "question" not in q or "answer" not in q:
                return {"success": False, "error": "Invalid question format"}
            if len(q["answer"]) < 2:
                return {"success": False, "error": "Answers must be at least 2 characters"}
        
        auth_data = self._load_auth()
        # Hash the answers
        hashed_questions = [
            {
                "question": q["question"],
                "answer_hash": self._hash_password(q["answer"].lower().strip())
            }
            for q in questions
        ]
        auth_data["user"]["security_questions"] = hashed_questions
        self._save_auth(auth_data)
        
        return {"success": True, "message": "Security questions saved"}
    
    def verify_security_answers(self, answers: list) -> Dict[str, Any]:
        """Verify security question answers for password reset"""
        auth_data = self._load_auth()
        user = auth_data.get("user", {})
        stored_questions = user.get("security_questions", [])
        
        if len(stored_questions) < 3:
            return {"success": False, "error": "Security questions not set up"}
        
        if len(answers) != len(stored_questions):
            return {"success": False, "error": "Invalid number of answers"}
        
        # Verify each answer
        correct = 0
        for i, stored in enumerate(stored_questions):
            answer_hash = self._hash_password(answers[i].lower().strip())
            if answer_hash == stored["answer_hash"]:
                correct += 1
        
        # Require all answers to be correct
        if correct == len(stored_questions):
            # Generate reset token
            reset_token = self._generate_session_token()
            
            # Store reset token with short expiry
            sessions = self._load_sessions()
            sessions[f"reset_{reset_token}"] = {
                "type": "password_reset",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
            }
            self._save_sessions(sessions)
            
            return {"success": True, "reset_token": reset_token}
        
        return {"success": False, "error": "Security answers incorrect"}
    
    def reset_password(self, reset_token: str, new_password: str) -> Dict[str, Any]:
        """Reset password using reset token"""
        sessions = self._load_sessions()
        session_key = f"reset_{reset_token}"
        session = sessions.get(session_key)
        
        if not session or session.get("type") != "password_reset":
            return {"success": False, "error": "Invalid reset token"}
        
        # Check expiry
        expires_at = datetime.fromisoformat(session["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            del sessions[session_key]
            self._save_sessions(sessions)
            return {"success": False, "error": "Reset token expired"}
        
        # Validate new password
        if len(new_password) < 8:
            return {"success": False, "error": "Password must be at least 8 characters"}
        
        # Update password
        auth_data = self._load_auth()
        auth_data["user"]["password_hash"] = self._hash_password(new_password)
        auth_data["user"]["must_change_password"] = False
        auth_data["user"]["password_changed_at"] = datetime.now(timezone.utc).isoformat()
        self._save_auth(auth_data)
        
        # Remove reset token
        del sessions[session_key]
        self._save_sessions(sessions)
        
        return {"success": True, "message": "Password reset successfully"}
    
    def get_security_questions(self) -> list:
        """Get the list of stored security questions (without answers)"""
        auth_data = self._load_auth()
        user = auth_data.get("user", {})
        stored = user.get("security_questions", [])
        
        return [q["question"] for q in stored]
    
    def get_available_questions(self) -> list:
        """Get list of available security questions"""
        return self.SECURITY_QUESTIONS
    
    def get_auth_status(self) -> Dict[str, Any]:
        """Get current auth status (for initial load)"""
        auth_data = self._load_auth()
        user = auth_data.get("user", {})

        return {
            "configured": bool(user),
            "must_change_password": user.get("must_change_password", True),
            "has_security_questions": len(user.get("security_questions", [])) >= 3,
            "username": user.get("username", "")
        }

    def is_first_run(self) -> bool:
        """Return True if the admin password has never been changed from the default"""
        auth_data = self._load_auth()
        user = auth_data.get("user", {})
        if not user:
            return True
        default_hash = self._hash_password(self.DEFAULT_PASSWORD)
        return user.get("password_hash") == default_hash

    def complete_initial_setup(self, username: str, password: str) -> Dict[str, Any]:
        """Set custom admin credentials during first-run setup"""
        if not username or len(username.strip()) < 3:
            return {"success": False, "error": "Username must be at least 3 characters"}
        if not password or len(password) < 8:
            return {"success": False, "error": "Password must be at least 8 characters"}

        auth_data = self._load_auth()
        user = auth_data.get("user", {})

        user["username"] = username.strip()
        user["password_hash"] = self._hash_password(password)
        user["must_change_password"] = False
        user["setup_completed_at"] = datetime.now(timezone.utc).isoformat()

        auth_data["user"] = user
        self._save_auth(auth_data)

        return {"success": True}
    
    def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        sessions = self._load_sessions()
        now = datetime.now(timezone.utc)
        
        to_remove = []
        for token, session in sessions.items():
            expires_at = datetime.fromisoformat(session["expires_at"])
            if now > expires_at:
                to_remove.append(token)
        
        for token in to_remove:
            del sessions[token]
        
        if to_remove:
            self._save_sessions(sessions)
        
        return len(to_remove)
