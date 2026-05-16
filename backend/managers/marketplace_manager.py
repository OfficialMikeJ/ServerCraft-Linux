"""Marketplace Manager for ServerCraft
Handles template sharing, uploads, downloads, and spam prevention
"""

import json
import uuid
import base64
import hashlib
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any

class MarketplaceManager:
    """Manages the template marketplace with spam prevention and moderation tools"""
    
    # Rate limits
    TEMPLATES_PER_MONTH = 1
    MIN_ACCOUNT_AGE_HOURS = 24
    MIN_SCREENSHOTS = 3
    MAX_SCREENSHOTS = 10
    MAX_TEMPLATE_SIZE_MB = 50
    
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.templates_file = data_path / "marketplace_templates.json"
        self.uploads_log_file = data_path / "marketplace_uploads.json"
        self.access_log_file = data_path / "marketplace_access_log.json"
        self.tos_agreements_file = data_path / "marketplace_tos.json"
        self.reports_file = data_path / "marketplace_reports.json"
        self.templates_dir = data_path / "templates"
        self._ensure_files()
    
    def _ensure_files(self):
        """Create data files if they don't exist"""
        self.templates_dir.mkdir(exist_ok=True)
        
        if not self.templates_file.exists():
            self._save_json(self.templates_file, {"templates": []})
        if not self.uploads_log_file.exists():
            self._save_json(self.uploads_log_file, {"uploads": []})
        if not self.access_log_file.exists():
            self._save_json(self.access_log_file, {"access_logs": []})
        if not self.tos_agreements_file.exists():
            self._save_json(self.tos_agreements_file, {"agreements": []})
        if not self.reports_file.exists():
            self._save_json(self.reports_file, {"reports": []})
    
    def _load_json(self, filepath: Path) -> Dict:
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except Exception:
            return {}
    
    def _save_json(self, filepath: Path, data: Dict):
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    # ==================== ACCESS CONTROL ====================
    
    def check_account_eligibility(self, username: str, account_created_at: str, is_sub_user: bool = False) -> Dict:
        """Check if account meets marketplace requirements"""
        # Admin-created sub-users bypass account age requirement
        if is_sub_user:
            return {
                "eligible": True,
                "reason": None,
                "message": "Sub-user account eligible for marketplace access (admin-created bypass)"
            }
        
        try:
            created_dt = datetime.fromisoformat(account_created_at.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            age_hours = (now - created_dt).total_seconds() / 3600
            
            if age_hours < self.MIN_ACCOUNT_AGE_HOURS:
                remaining_hours = self.MIN_ACCOUNT_AGE_HOURS - age_hours
                return {
                    "eligible": False,
                    "reason": "account_too_new",
                    "message": f"This account is too new to access our template marketplace. Please wait {int(remaining_hours)} more hours. If you are facing any issues please submit a bug report in our Discord server.",
                    "hours_remaining": round(remaining_hours, 1)
                }
            
            return {
                "eligible": True,
                "reason": None,
                "message": "Account eligible for marketplace access"
            }
        except Exception as e:
            return {
                "eligible": False,
                "reason": "invalid_account",
                "message": f"Unable to verify account eligibility: {str(e)}"
            }
    
    def check_upload_eligibility(self, username: str, account_created_at: str) -> Dict:
        """Check if user can upload a template (account age + rate limit)"""
        # First check account age
        eligibility = self.check_account_eligibility(username, account_created_at)
        if not eligibility["eligible"]:
            return eligibility
        
        # Check monthly upload limit
        uploads_data = self._load_json(self.uploads_log_file)
        user_uploads = [
            u for u in uploads_data.get("uploads", [])
            if u.get("username") == username
        ]
        
        # Check uploads in the last 30 days
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        recent_uploads = [
            u for u in user_uploads
            if datetime.fromisoformat(u["uploaded_at"].replace('Z', '+00:00')) > thirty_days_ago
        ]
        
        if len(recent_uploads) >= self.TEMPLATES_PER_MONTH:
            last_upload = max(recent_uploads, key=lambda x: x["uploaded_at"])
            last_upload_dt = datetime.fromisoformat(last_upload["uploaded_at"].replace('Z', '+00:00'))
            next_allowed = last_upload_dt + timedelta(days=30)
            days_remaining = (next_allowed - datetime.now(timezone.utc)).days
            
            return {
                "eligible": False,
                "reason": "rate_limited",
                "message": f"You can only upload 1 template per month. You can upload again in {days_remaining} days.",
                "days_remaining": days_remaining,
                "last_upload": last_upload["uploaded_at"]
            }
        
        # Check ToS agreement
        if not self.has_agreed_to_tos(username):
            return {
                "eligible": False,
                "reason": "tos_not_agreed",
                "message": "You must agree to the Terms of Service before uploading templates."
            }
        
        return {
            "eligible": True,
            "reason": None,
            "message": "You can upload a template",
            "uploads_remaining": self.TEMPLATES_PER_MONTH - len(recent_uploads)
        }
    
    # ==================== TERMS OF SERVICE ====================
    
    def has_agreed_to_tos(self, username: str) -> bool:
        """Check if user has agreed to ToS"""
        data = self._load_json(self.tos_agreements_file)
        return any(a.get("username") == username for a in data.get("agreements", []))
    
    def record_tos_agreement(self, username: str, ip_address: str, user_agent: str = None) -> Dict:
        """Record user's ToS agreement"""
        data = self._load_json(self.tos_agreements_file)
        
        agreement = {
            "id": str(uuid.uuid4()),
            "username": username,
            "agreed_at": datetime.now(timezone.utc).isoformat(),
            "ip_address": ip_address,
            "user_agent": user_agent,
            "tos_version": "1.0"
        }
        
        data.setdefault("agreements", []).append(agreement)
        self._save_json(self.tos_agreements_file, data)
        
        return {"success": True, "agreement_id": agreement["id"]}
    
    # ==================== ACCESS LOGGING (Admin Only) ====================
    
    def log_marketplace_access(self, username: str, ip_address: str, geo_location: Dict = None, action: str = "view"):
        """Log marketplace access for spam prevention (admin dashboard only)"""
        data = self._load_json(self.access_log_file)
        
        log_entry = {
            "id": str(uuid.uuid4()),
            "username": username,
            "ip_address": ip_address,
            "geo_location": geo_location or {},
            "action": action,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        data.setdefault("access_logs", []).append(log_entry)
        
        # Keep only last 10000 entries
        if len(data["access_logs"]) > 10000:
            data["access_logs"] = data["access_logs"][-10000:]
        
        self._save_json(self.access_log_file, data)
        return log_entry["id"]
    
    def get_access_logs(self, limit: int = 100, username: str = None, ip_address: str = None) -> List[Dict]:
        """Get access logs (admin only)"""
        data = self._load_json(self.access_log_file)
        logs = data.get("access_logs", [])
        
        if username:
            logs = [log for log in logs if log.get("username") == username]
        if ip_address:
            logs = [log for log in logs if log.get("ip_address") == ip_address]
        
        return sorted(logs, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]
    
    # ==================== TEMPLATE MANAGEMENT ====================
    
    # Required template metadata fields for security validation
    REQUIRED_TEMPLATE_FIELDS = [
        "version_id",
        "author_name", 
        "template_date",
        "template_name",
        "template_identifier_id"
    ]
    
    # Dangerous patterns that could indicate malicious code
    DANGEROUS_PATTERNS = [
        # Code execution
        "eval(", "exec(", "compile(", "execfile(", "__import__(",
        "subprocess", "os.system", "os.popen", "os.exec",
        "commands.getoutput", "commands.getstatusoutput",
        "spawn", "shell=True", "Popen(",
        # File system attacks
        "rm -rf", "del /f", "format c:", "rmdir /s",
        "shutil.rmtree", "os.remove", "os.unlink", "os.rmdir",
        # Shell/powershell
        "powershell", "cmd.exe", "bash -c", "sh -c", "/bin/sh",
        "Start-Process", "Invoke-Expression", "Invoke-WebRequest",
        "New-Object System.Net", "DownloadFile(", "DownloadString(",
        # Executable/binary
        ".exe", ".dll", ".bat", ".ps1", ".vbs", ".scr", ".com", ".msi",
        ".cmd", ".wsf", ".wsh", ".pif",
        # Network/data exfiltration
        "socket.connect", "urllib.request", "requests.post",
        "requests.get", "httplib", "ftplib", "smtplib",
        "webhook", "discord.com/api/webhooks", "telegram.org/bot",
        # Credential harvesting
        "password", "credential", "token", "api_key", "secret_key",
        "private_key", "ssh_key", "auth_token", "session_id",
        "keylogger", "keystroke", "clipboard",
        "GetClipboardData", "SetClipboardData",
        # Registry/system modification
        "winreg", "RegSetValue", "RegCreateKey", "RegDeleteKey",
        "HKEY_LOCAL_MACHINE", "HKEY_CURRENT_USER",
        "schtasks", "sc create", "net user",
        # Web injection
        "<script>", "javascript:", "onerror=", "onclick=", "onload=",
        "onmouseover=", "<iframe", "<object", "<embed",
        "document.cookie", "document.write", "innerHTML",
        "XMLHttpRequest", "fetch(", "navigator.sendBeacon",
        # Encoding/obfuscation
        "\\x", "\\u00", "base64.decode", "base64.b64decode",
        "atob(", "btoa(", "String.fromCharCode",
        "charCodeAt", "unescape(", "decodeURIComponent(",
        # Crypto mining
        "coinhive", "cryptonight", "monero", "stratum+tcp",
        "minergate", "hashrate",
        # Reverse shells
        "reverse_tcp", "meterpreter", "netcat", "nc -e",
        "bind_shell", "/dev/tcp/",
        # Python-specific attacks
        "pickle.loads", "yaml.load", "marshal.loads",
        "__builtins__", "__globals__", "__subclasses__",
        "ctypes.windll", "ctypes.cdll",
        # DLL injection / process manipulation
        "CreateRemoteThread", "VirtualAllocEx", "WriteProcessMemory",
        "LoadLibrary", "GetProcAddress", "NtCreateThread"
    ]
    
    # Blocked file extensions in template content
    BLOCKED_EXTENSIONS = [
        ".exe", ".dll", ".bat", ".ps1", ".vbs", ".scr", ".com",
        ".msi", ".cmd", ".wsf", ".wsh", ".pif", ".cpl", ".inf",
        ".reg", ".rgs", ".sct", ".shb", ".sys", ".drv"
    ]
    
    # Malicious code detection result message
    MALICIOUS_CODE_MESSAGE = (
        "Your project contains malicious code that is harmful and will not be allowed on our platform. "
        "Your account is now suspended and will be terminated effective immediately. "
        "Your ISP & IP Address will be logged for ban evasion. "
        "Any attempts to circumvent any of these systems will result in local law enforcement being contacted "
        "and all information will be shared for criminal charges."
    )
    
    def validate_template(self, template_data: Dict) -> Dict:
        """Validate template before upload - includes security checks"""
        errors = []
        missing_fields = []
        
        # Check required metadata fields
        if not template_data.get("version_id"):
            missing_fields.append("Version ID")
        
        if not template_data.get("author_name"):
            missing_fields.append("Author Name")
        
        if not template_data.get("template_date"):
            missing_fields.append("Template Date")
        
        if not template_data.get("template_name") and not template_data.get("name"):
            missing_fields.append("Template Name")
        
        if not template_data.get("template_identifier_id"):
            missing_fields.append("Template Identifier ID")
        
        # If any required fields are missing, reject immediately
        if missing_fields:
            return {
                "valid": False,
                "rejected": True,
                "reason": "missing_required_fields",
                "missing_fields": missing_fields,
                "errors": [f"Missing required field: {field}" for field in missing_fields],
                "message": f"Template rejected. Missing required fields: {', '.join(missing_fields)}. Please resubmit with all required information."
            }
        
        # Check other required fields
        if not template_data.get("name") and not template_data.get("template_name"):
            errors.append("Template name is required")
        
        if not template_data.get("version") and not template_data.get("version_id"):
            errors.append("Version number is required")
        
        if not template_data.get("game"):
            errors.append("Game type is required")
        
        if not template_data.get("description"):
            errors.append("Description is required")
        
        # Check screenshots
        screenshots = template_data.get("screenshots", [])
        if len(screenshots) < self.MIN_SCREENSHOTS:
            errors.append(f"At least {self.MIN_SCREENSHOTS} screenshots are required")
        elif len(screenshots) > self.MAX_SCREENSHOTS:
            errors.append(f"Maximum {self.MAX_SCREENSHOTS} screenshots allowed")
        
        # Check template content
        if not template_data.get("config"):
            errors.append("Template configuration is required")
        
        # Security scan - check for potentially malicious content
        security_issues = self._security_scan_template(template_data)
        if security_issues:
            return {
                "valid": False,
                "rejected": True,
                "reason": "malicious_code",
                "suspend_account": True,
                "errors": security_issues,
                "message": self.MALICIOUS_CODE_MESSAGE
            }
        
        if errors:
            return {"valid": False, "errors": errors}
        
        return {"valid": True, "errors": []}
    
    def _security_scan_template(self, template_data: Dict) -> List[str]:
        """Deep security scan for malicious content"""
        issues = []
        
        # Convert template to string for pattern scanning
        template_str = json.dumps(template_data).lower()
        
        # Check dangerous patterns
        for pattern in self.DANGEROUS_PATTERNS:
            if pattern.lower() in template_str:
                issues.append(f"Dangerous pattern detected: '{pattern}'")
        
        # Check for blocked file extensions in any string values
        def scan_for_extensions(obj, path=""):
            if isinstance(obj, str):
                for ext in self.BLOCKED_EXTENSIONS:
                    if ext in obj.lower():
                        issues.append(f"Blocked file type '{ext}' found at {path}")
            elif isinstance(obj, dict):
                for k, v in obj.items():
                    scan_for_extensions(v, f"{path}.{k}")
            elif isinstance(obj, list):
                for i, v in enumerate(obj):
                    scan_for_extensions(v, f"{path}[{i}]")
        
        scan_for_extensions(template_data.get("config", {}), "config")
        
        # Check for suspicious base64 encoded content
        config = template_data.get("config", {})
        if isinstance(config, dict):
            config_str = json.dumps(config)
            # Size limit
            if len(config_str) > 100000:
                issues.append("Configuration data exceeds size limit (potential code injection)")
            
            # Check for long base64-like strings (obfuscated payloads)
            import re
            b64_matches = re.findall(r'[A-Za-z0-9+/=]{100,}', config_str)
            if b64_matches:
                issues.append(f"Suspicious encoded data detected ({len(b64_matches)} block(s))")
            
            # Check for hex-encoded strings
            hex_matches = re.findall(r'(?:\\x[0-9a-fA-F]{2}){4,}', config_str)
            if hex_matches:
                issues.append(f"Hex-encoded data detected ({len(hex_matches)} block(s))")
        
        # Check for IP addresses (potential C2 servers)
        import re
        ip_pattern = r'\b(?:\d{1,3}\.){3}\d{1,3}\b'
        ips = re.findall(ip_pattern, template_str)
        # Filter out common safe IPs
        suspicious_ips = [ip for ip in ips if ip not in ('127.0.0.1', '0.0.0.0', '255.255.255.255', '192.168.1.1')]
        if len(suspicious_ips) > 3:
            issues.append(f"Multiple IP addresses detected ({len(suspicious_ips)}) - potential C2 communication")
        
        return issues
    
    def validate_template_file(self, template_content: str) -> Dict:
        """Validate a template file that's being imported"""
        try:
            template_data = json.loads(template_content)
        except json.JSONDecodeError:
            return {
                "valid": False,
                "rejected": True,
                "reason": "invalid_format",
                "errors": ["Invalid template file format. Must be valid JSON."],
                "message": "Template file rejected. The file format is invalid."
            }
        
        return self.validate_template(template_data)
    
    def upload_template(self, username: str, template_data: Dict, ip_address: str, geo_location: Dict = None) -> Dict:
        """Upload a new template to the marketplace"""
        # Validate template
        validation = self.validate_template(template_data)
        if not validation["valid"]:
            return {
                "success": False, 
                "rejected": validation.get("rejected", False),
                "reason": validation.get("reason"),
                "missing_fields": validation.get("missing_fields", []),
                "errors": validation["errors"],
                "message": validation.get("message", "Template validation failed")
            }
        
        # Create template entry
        template_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Use either the new field names or fallback to old ones
        template_name = template_data.get("template_name") or template_data.get("name")
        version = template_data.get("version_id") or template_data.get("version")
        
        template = {
            "id": template_id,
            "template_identifier_id": template_data.get("template_identifier_id"),
            "name": template_name,
            "version_id": version,
            "version": version,  # Keep for backwards compatibility
            "template_date": template_data.get("template_date"),
            "author_name": template_data.get("author_name") or username,
            "game": template_data["game"],
            "description": template_data["description"],
            "author": username,  # System author (account username)
            "screenshots": template_data["screenshots"],
            "config": template_data["config"],
            "tags": template_data.get("tags", []),
            "min_servercraft_version": template_data.get("min_servercraft_version", ""),
            "downloads": 0,
            "rating": 0,
            "ratings_count": 0,
            "created_at": now,
            "updated_at": now,
            "status": "pending_review",  # pending_review, approved, rejected
            "featured": False,
            "security_scanned": True,
            "security_passed": True
        }
        
        # Save template
        templates_data = self._load_json(self.templates_file)
        templates_data.setdefault("templates", []).append(template)
        self._save_json(self.templates_file, templates_data)
        
        # Log upload
        uploads_data = self._load_json(self.uploads_log_file)
        uploads_data.setdefault("uploads", []).append({
            "template_id": template_id,
            "username": username,
            "uploaded_at": now,
            "ip_address": ip_address,
            "geo_location": geo_location or {}
        })
        self._save_json(self.uploads_log_file, uploads_data)
        
        # Log access
        self.log_marketplace_access(username, ip_address, geo_location, "upload")
        
        return {
            "success": True,
            "template_id": template_id,
            "message": "Template uploaded successfully and is pending review"
        }
    
    def get_templates(self, game: str = None, status: str = "approved", limit: int = 50, offset: int = 0) -> Dict:
        """Get marketplace templates"""
        data = self._load_json(self.templates_file)
        templates = data.get("templates", [])
        
        # Filter by status
        if status:
            templates = [t for t in templates if t.get("status") == status]
        
        # Filter by game
        if game:
            templates = [t for t in templates if t.get("game") == game]
        
        # Sort by downloads and date
        templates = sorted(templates, key=lambda x: (x.get("featured", False), x.get("downloads", 0)), reverse=True)
        
        total = len(templates)
        templates = templates[offset:offset + limit]
        
        return {
            "templates": templates,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    
    def get_template(self, template_id: str) -> Optional[Dict]:
        """Get a specific template"""
        data = self._load_json(self.templates_file)
        for template in data.get("templates", []):
            if template.get("id") == template_id:
                return template
        return None
    
    def download_template(self, template_id: str, username: str, ip_address: str, geo_location: Dict = None) -> Dict:
        """Download a template (increments download count)"""
        data = self._load_json(self.templates_file)
        
        for template in data.get("templates", []):
            if template.get("id") == template_id:
                if template.get("status") != "approved":
                    return {"success": False, "error": "Template not available"}
                
                # Increment downloads
                template["downloads"] = template.get("downloads", 0) + 1
                self._save_json(self.templates_file, data)
                
                # Log access
                self.log_marketplace_access(username, ip_address, geo_location, f"download:{template_id}")
                
                return {
                    "success": True,
                    "template": template
                }
        
        return {"success": False, "error": "Template not found"}
    
    def export_template(self, server_config: Dict, name: str, version: str, description: str) -> Dict:
        """Export a server configuration as a template (for local saving)"""
        template = {
            "name": name,
            "version": version,
            "description": description,
            "game": server_config.get("game"),
            "config": {
                "port": server_config.get("port"),
                "query_port": server_config.get("query_port"),
                "max_players": server_config.get("max_players"),
                "parameters": server_config.get("parameters", {}),
                "mods": server_config.get("mods", []),
                "startup_params": server_config.get("startup_params", "")
            },
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "servercraft_version": "2026.2.0"
        }
        
        return {
            "success": True,
            "template": template,
            "filename": f"{name.replace(' ', '_')}_{version}.json"
        }
    
    # ==================== REPORTING SYSTEM ====================
    
    def report_template(self, template_id: str, reporter_username: str, reason: str, details: str = None, ip_address: str = None) -> Dict:
        """Report a template for review"""
        data = self._load_json(self.reports_file)
        
        report = {
            "id": str(uuid.uuid4()),
            "template_id": template_id,
            "reporter": reporter_username,
            "reason": reason,
            "details": details,
            "ip_address": ip_address,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        data.setdefault("reports", []).append(report)
        self._save_json(self.reports_file, data)
        
        return {"success": True, "report_id": report["id"]}
    
    # ==================== RATINGS & REVIEWS ====================
    
    def rate_template(self, template_id: str, username: str, rating: int, review: str = "") -> Dict:
        """Rate and optionally review a template (1-5 stars)"""
        if rating < 1 or rating > 5:
            return {"success": False, "error": "Rating must be between 1 and 5"}
        
        data = self._load_json(self.templates_file)
        
        for i, template in enumerate(data.get("templates", [])):
            if template.get("id") == template_id:
                # Initialize reviews list
                reviews = template.get("reviews", [])
                
                # Check if user already reviewed - update if so
                existing_idx = None
                for j, r in enumerate(reviews):
                    if r.get("username") == username:
                        existing_idx = j
                        break
                
                review_entry = {
                    "username": username,
                    "rating": rating,
                    "review": review[:500] if review else "",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                
                if existing_idx is not None:
                    review_entry["created_at"] = reviews[existing_idx].get("created_at", review_entry["created_at"])
                    reviews[existing_idx] = review_entry
                else:
                    reviews.append(review_entry)
                
                data["templates"][i]["reviews"] = reviews
                
                # Recalculate average rating
                total_rating = sum(r["rating"] for r in reviews)
                data["templates"][i]["rating"] = round(total_rating / len(reviews), 1)
                data["templates"][i]["ratings_count"] = len(reviews)
                
                self._save_json(self.templates_file, data)
                
                return {
                    "success": True,
                    "message": "Review submitted" if existing_idx is None else "Review updated",
                    "new_rating": data["templates"][i]["rating"],
                    "ratings_count": len(reviews)
                }
        
        return {"success": False, "error": "Template not found"}
    
    def get_template_reviews(self, template_id: str) -> Dict:
        """Get all reviews for a template"""
        data = self._load_json(self.templates_file)
        
        for template in data.get("templates", []):
            if template.get("id") == template_id:
                reviews = template.get("reviews", [])
                return {
                    "template_id": template_id,
                    "rating": template.get("rating", 0),
                    "ratings_count": template.get("ratings_count", 0),
                    "reviews": sorted(reviews, key=lambda x: x.get("created_at", ""), reverse=True)
                }
        
        return {"template_id": template_id, "reviews": [], "rating": 0, "ratings_count": 0}
    
    def get_reports(self, status: str = None, limit: int = 50) -> List[Dict]:
        """Get template reports (admin only)"""
        data = self._load_json(self.reports_file)
        reports = data.get("reports", [])
        
        if status:
            reports = [r for r in reports if r.get("status") == status]
        
        return sorted(reports, key=lambda x: x.get("created_at", ""), reverse=True)[:limit]
    
    # ==================== ADMIN FUNCTIONS ====================
    
    def approve_template(self, template_id: str, admin_username: str) -> Dict:
        """Approve a template for public listing"""
        data = self._load_json(self.templates_file)
        
        for template in data.get("templates", []):
            if template.get("id") == template_id:
                template["status"] = "approved"
                template["approved_by"] = admin_username
                template["approved_at"] = datetime.now(timezone.utc).isoformat()
                self._save_json(self.templates_file, data)
                return {"success": True, "message": "Template approved"}
        
        return {"success": False, "error": "Template not found"}
    
    def reject_template(self, template_id: str, admin_username: str, reason: str) -> Dict:
        """Reject a template"""
        data = self._load_json(self.templates_file)
        
        for template in data.get("templates", []):
            if template.get("id") == template_id:
                template["status"] = "rejected"
                template["rejected_by"] = admin_username
                template["rejected_at"] = datetime.now(timezone.utc).isoformat()
                template["rejection_reason"] = reason
                self._save_json(self.templates_file, data)
                return {"success": True, "message": "Template rejected"}
        
        return {"success": False, "error": "Template not found"}
    
    def get_pending_templates(self) -> List[Dict]:
        """Get templates pending review (admin only)"""
        return self.get_templates(status="pending_review", limit=100)["templates"]
    
    def get_user_templates(self, username: str) -> List[Dict]:
        """Get all templates by a user"""
        data = self._load_json(self.templates_file)
        return [t for t in data.get("templates", []) if t.get("author") == username]
    
    def get_marketplace_stats(self) -> Dict:
        """Get marketplace statistics (admin dashboard)"""
        templates_data = self._load_json(self.templates_file)
        uploads_data = self._load_json(self.uploads_log_file)
        access_data = self._load_json(self.access_log_file)
        
        templates = templates_data.get("templates", [])
        
        return {
            "total_templates": len(templates),
            "approved_templates": len([t for t in templates if t.get("status") == "approved"]),
            "pending_templates": len([t for t in templates if t.get("status") == "pending_review"]),
            "total_downloads": sum(t.get("downloads", 0) for t in templates),
            "total_uploads": len(uploads_data.get("uploads", [])),
            "unique_authors": len(set(t.get("author") for t in templates)),
            "access_logs_count": len(access_data.get("access_logs", []))
        }
    
    # ==================== TEMPLATE VERSIONING ====================
    
    def get_template_versions(self, template_id: str) -> Dict:
        """Get version history for a template"""
        data = self._load_json(self.templates_file)
        
        for template in data.get("templates", []):
            if template.get("id") == template_id:
                versions = template.get("version_history", [])
                # Always include current version
                current = {
                    "version": template.get("version_id") or template.get("version"),
                    "updated_at": template.get("updated_at") or template.get("created_at"),
                    "changes": template.get("changelog", "Initial release"),
                    "current": True
                }
                return {
                    "template_id": template_id,
                    "template_name": template.get("name"),
                    "current_version": current["version"],
                    "versions": [current] + versions
                }
        
        return {"template_id": template_id, "versions": [], "error": "Template not found"}
    
    def update_template(self, template_id: str, username: str, update_data: Dict, ip_address: str) -> Dict:
        """Upload a new version of an existing template"""
        data = self._load_json(self.templates_file)
        
        for i, template in enumerate(data.get("templates", [])):
            if template.get("id") == template_id:
                # Only author can update
                if template.get("author") != username:
                    return {"success": False, "error": "Only the template author can update it"}
                
                new_version = update_data.get("version_id") or update_data.get("version")
                if not new_version:
                    return {"success": False, "error": "New version number is required"}
                
                # Save current version to history
                version_entry = {
                    "version": template.get("version_id") or template.get("version"),
                    "updated_at": template.get("updated_at") or template.get("created_at"),
                    "changes": update_data.get("changelog", "Version update"),
                    "current": False
                }
                
                history = template.get("version_history", [])
                history.insert(0, version_entry)
                
                # Update template with new version data
                now = datetime.now(timezone.utc).isoformat()
                data["templates"][i]["version_id"] = new_version
                data["templates"][i]["version"] = new_version
                data["templates"][i]["updated_at"] = now
                data["templates"][i]["version_history"] = history
                data["templates"][i]["changelog"] = update_data.get("changelog", "")
                
                if update_data.get("description"):
                    data["templates"][i]["description"] = update_data["description"]
                if update_data.get("config"):
                    data["templates"][i]["config"] = update_data["config"]
                if update_data.get("screenshots"):
                    data["templates"][i]["screenshots"] = update_data["screenshots"]
                
                # Set back to pending review for new version
                data["templates"][i]["status"] = "pending_review"
                
                self._save_json(self.templates_file, data)
                
                # Log
                self.log_marketplace_access(username, ip_address, {}, f"update:{template_id}:v{new_version}")
                
                return {
                    "success": True,
                    "message": f"Template updated to version {new_version}. Pending review.",
                    "new_version": new_version
                }
        
        return {"success": False, "error": "Template not found"}
    
    # ==================== VERSION COMPATIBILITY CHECK ====================
    
    @staticmethod
    def check_version_compatibility(template_min_version: str, current_version: str) -> Dict:
        """Check if current ServerCraft version is compatible with a template"""
        if not template_min_version:
            return {"compatible": True, "message": "No version requirement"}
        
        def parse_version(v: str) -> tuple:
            import re
            clean = re.sub(r'[-.]?[A-Za-z]+$', '', v.strip())
            parts = clean.split('.')
            result = []
            for p in parts:
                try:
                    result.append(int(p))
                except ValueError:
                    result.append(0)
            return tuple(result)
        
        try:
            current = parse_version(current_version)
            required = parse_version(template_min_version)
            
            if current >= required:
                return {"compatible": True, "message": "Version compatible"}
            else:
                return {
                    "compatible": False,
                    "message": f"Version mismatch - This template requires ServerCraft {template_min_version} or newer. "
                               f"Your version: {current_version}. Please update to the latest version.",
                    "current_version": current_version,
                    "required_version": template_min_version,
                    "update_url": "https://github.com/OfficialMikeJ/ServerCraft-Windows-Beta/releases"
                }
        except Exception:
            return {"compatible": True, "message": "Unable to verify version"}
    
    # ==================== EXTERNAL AUTH (ServerCraft Website) ====================
    
    def store_external_session(self, username: str, external_token: str, user_data: Dict) -> Dict:
        """Store an externally authenticated session from servercraft.dev"""
        data = self._load_json(self.tos_agreements_file)
        session_entry = {
            "username": username,
            "external_token": external_token,
            "authenticated_at": datetime.now(timezone.utc).isoformat(),
            "user_data": user_data
        }
        data.setdefault("external_sessions", {})[username] = session_entry
        self._save_json(self.tos_agreements_file, data)
        return {"success": True, "username": username}
    
    def validate_external_session(self, username: str) -> bool:
        """Check if user has a valid external session"""
        data = self._load_json(self.tos_agreements_file)
        session = data.get("external_sessions", {}).get(username)
        if not session:
            return False
        try:
            auth_time = datetime.fromisoformat(session["authenticated_at"].replace('Z', '+00:00'))
            if (datetime.now(timezone.utc) - auth_time).total_seconds() > 86400:
                return False
        except Exception:
            return False
        return True
    
    def clear_external_session(self, username: str):
        """Clear external session"""
        data = self._load_json(self.tos_agreements_file)
        if username in data.get("external_sessions", {}):
            del data["external_sessions"][username]
            self._save_json(self.tos_agreements_file, data)
MARKETPLACE_TOS = """
# ServerCraft Template Marketplace Terms of Service

By uploading content to the ServerCraft Template Marketplace, you agree to the following terms:

## 1. Content Ownership
- You must own or have rights to all content you upload
- You grant ServerCraft a license to distribute your templates
- You retain ownership of your original content

## 2. Prohibited Content
- No malicious code, malware, or exploits
- No copyrighted content without permission
- No offensive, illegal, or inappropriate content
- No spam or duplicate submissions

## 3. User Conduct
- One template upload per month to prevent spam
- Accurate descriptions and screenshots required
- Report violations to our moderation team

## 4. Moderation
- All uploads are reviewed before publication
- We reserve the right to remove any content
- Violations may result in account restrictions

## 5. Privacy
- Your username will be publicly displayed
- IP addresses are logged for security purposes
- We do not sell your personal information

## 6. Disclaimer
- Templates are provided as-is
- ServerCraft is not responsible for third-party content
- Use templates at your own risk

By clicking "I Agree", you confirm you have read and accept these terms.
"""
