"""Two-Factor Authentication Manager for ServerCraft
Handles TOTP-based 2FA with QR code generation for Google Authenticator
"""

import json
import base64
import pyotp
import qrcode
from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict

class TwoFactorAuthManager:
    """Manages TOTP-based two-factor authentication with QR code support"""
    
    # App name displayed in authenticator apps
    APP_NAME = "ServerCraft"
    
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.twofa_file = data_path / "twofa_config.json"
        self._ensure_files()
    
    def _ensure_files(self):
        """Create data files if they don't exist"""
        if not self.twofa_file.exists():
            self._save_json(self.twofa_file, {
                "enabled": False,
                "secret": None,
                "instance_id": None,
                "setup_completed": False,
                "backup_codes": [],
                "created_at": None,
                "last_verified": None
            })
    
    def _load_json(self, filepath: Path) -> Dict:
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except Exception:
            return {}
    
    def _save_json(self, filepath: Path, data: Dict):
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    def get_status(self) -> Dict:
        """Get current 2FA status"""
        data = self._load_json(self.twofa_file)
        return {
            "enabled": data.get("enabled", False),
            "setup_completed": data.get("setup_completed", False),
            "instance_id": data.get("instance_id"),
            "has_backup_codes": len(data.get("backup_codes", [])) > 0,
            "last_verified": data.get("last_verified")
        }
    
    def generate_secret(self, instance_id: str, username: str) -> Dict:
        """Generate a new TOTP secret and QR code for setup"""
        # Generate a new random secret
        secret = pyotp.random_base32()
        
        # Create TOTP instance
        totp = pyotp.TOTP(secret)
        
        # Generate provisioning URI for QR code
        # Format: otpauth://totp/ServerCraft:username@instance_id?secret=XXX&issuer=ServerCraft
        provisioning_uri = totp.provisioning_uri(
            name=f"{username}@{instance_id[:8]}",
            issuer_name=self.APP_NAME
        )
        
        # Generate QR code as base64 image
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        # Generate backup codes
        backup_codes = [pyotp.random_base32()[:8] for _ in range(10)]
        
        # Store pending setup (not enabled until verified)
        data = self._load_json(self.twofa_file)
        data.update({
            "pending_secret": secret,
            "instance_id": instance_id,
            "pending_backup_codes": backup_codes,
            "setup_initiated_at": datetime.now(timezone.utc).isoformat()
        })
        self._save_json(self.twofa_file, data)
        
        return {
            "success": True,
            "qr_code": f"data:image/png;base64,{qr_base64}",
            "secret": secret,  # For manual entry if QR scan fails
            "instance_id": instance_id,
            "backup_codes": backup_codes,
            "message": "Scan this QR code with Google Authenticator or any TOTP app"
        }
    
    def verify_and_enable(self, code: str) -> Dict:
        """Verify a TOTP code and enable 2FA if correct"""
        data = self._load_json(self.twofa_file)
        
        pending_secret = data.get("pending_secret")
        if not pending_secret:
            return {
                "success": False,
                "error": "No pending 2FA setup found. Please generate a new QR code."
            }
        
        # Verify the code
        totp = pyotp.TOTP(pending_secret)
        if not totp.verify(code, valid_window=1):  # Allow 1 window tolerance
            return {
                "success": False,
                "error": "Invalid verification code. Please try again."
            }
        
        # Code is valid - enable 2FA
        data.update({
            "enabled": True,
            "secret": pending_secret,
            "backup_codes": data.get("pending_backup_codes", []),
            "setup_completed": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_verified": datetime.now(timezone.utc).isoformat(),
            "pending_secret": None,
            "pending_backup_codes": None
        })
        self._save_json(self.twofa_file, data)
        
        return {
            "success": True,
            "message": "Two-factor authentication has been enabled successfully!"
        }
    
    def verify_code(self, code: str) -> Dict:
        """Verify a TOTP code during login"""
        data = self._load_json(self.twofa_file)
        
        if not data.get("enabled"):
            return {"success": True, "message": "2FA not enabled"}
        
        secret = data.get("secret")
        if not secret:
            return {"success": False, "error": "2FA configuration error"}
        
        # Check TOTP code
        totp = pyotp.TOTP(secret)
        if totp.verify(code, valid_window=1):
            # Update last verified time
            data["last_verified"] = datetime.now(timezone.utc).isoformat()
            self._save_json(self.twofa_file, data)
            return {"success": True, "message": "Code verified"}
        
        # Check backup codes
        backup_codes = data.get("backup_codes", [])
        if code.upper() in [bc.upper() for bc in backup_codes]:
            # Remove used backup code
            backup_codes = [bc for bc in backup_codes if bc.upper() != code.upper()]
            data["backup_codes"] = backup_codes
            data["last_verified"] = datetime.now(timezone.utc).isoformat()
            self._save_json(self.twofa_file, data)
            return {
                "success": True, 
                "message": "Backup code used",
                "warning": f"You have {len(backup_codes)} backup codes remaining"
            }
        
        return {"success": False, "error": "Invalid verification code"}
    
    def disable(self, verification_code: str) -> Dict:
        """Disable 2FA (requires current code for security)"""
        # First verify the code
        verify_result = self.verify_code(verification_code)
        if not verify_result.get("success"):
            return {
                "success": False,
                "error": "Invalid verification code. Cannot disable 2FA."
            }
        
        # Disable 2FA
        data = self._load_json(self.twofa_file)
        data.update({
            "enabled": False,
            "secret": None,
            "backup_codes": [],
            "setup_completed": False,
            "disabled_at": datetime.now(timezone.utc).isoformat()
        })
        self._save_json(self.twofa_file, data)
        
        return {
            "success": True,
            "message": "Two-factor authentication has been disabled"
        }
    
    def regenerate_backup_codes(self, verification_code: str) -> Dict:
        """Regenerate backup codes (requires current code)"""
        # First verify the code
        verify_result = self.verify_code(verification_code)
        if not verify_result.get("success"):
            return {
                "success": False,
                "error": "Invalid verification code"
            }
        
        # Generate new backup codes
        new_codes = [pyotp.random_base32()[:8] for _ in range(10)]
        
        data = self._load_json(self.twofa_file)
        data["backup_codes"] = new_codes
        self._save_json(self.twofa_file, data)
        
        return {
            "success": True,
            "backup_codes": new_codes,
            "message": "New backup codes generated. Save them securely!"
        }
    
    def is_enabled(self) -> bool:
        """Check if 2FA is enabled"""
        data = self._load_json(self.twofa_file)
        return data.get("enabled", False)
    
    def get_instance_id(self) -> Optional[str]:
        """Get the instance ID linked to 2FA"""
        data = self._load_json(self.twofa_file)
        return data.get("instance_id")
