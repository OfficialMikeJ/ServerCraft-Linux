"""SteamCMD Manager - Handles SteamCMD installation, login, and game downloads"""

import asyncio
import subprocess
import os
import sys
import shutil
import logging
import tarfile
import aiohttp
from pathlib import Path
from typing import Dict, Optional, Callable
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

STEAMCMD_URL = "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz"


class SteamCMDManager:
    def __init__(self, config_manager):
        self.config_manager = config_manager
        self.steamcmd_path = config_manager.get_steamcmd_path()
        self.steamcmd_exe = self.steamcmd_path / "steamcmd.sh"
        
        self._process: Optional[asyncio.subprocess.Process] = None
        self._guard_code_event = asyncio.Event()
        self._guard_code: Optional[str] = None
        self._install_status: Dict[str, Dict] = {}
        self._console_callbacks: list = []
    
    def is_installed(self) -> bool:
        """Check if SteamCMD is installed"""
        return self.steamcmd_exe.exists()
    
    def is_logged_in(self) -> bool:
        """Check if Steam is logged in"""
        creds = self.config_manager.get_credentials()
        return creds.get("steam_logged_in", False)
    
    def get_current_user(self) -> Optional[str]:
        """Get current Steam username"""
        return self.config_manager.get_steam_username()
    
    async def install(self) -> bool:
        """Download and install SteamCMD"""
        try:
            logger.info("Installing SteamCMD...")
            
            # Create directory
            self.steamcmd_path.mkdir(parents=True, exist_ok=True)
            
            # Download SteamCMD (Linux tarball)
            tar_path = self.steamcmd_path / "steamcmd_linux.tar.gz"

            async with aiohttp.ClientSession() as session:
                async with session.get(STEAMCMD_URL) as response:
                    if response.status == 200:
                        with open(tar_path, 'wb') as f:
                            f.write(await response.read())
                    else:
                        logger.error(f"Failed to download SteamCMD: {response.status}")
                        return False

            # Extract tarball
            with tarfile.open(tar_path, 'r:gz') as tar:
                tar.extractall(self.steamcmd_path)

            # Make executable
            self.steamcmd_exe.chmod(0o755)

            # Cleanup
            tar_path.unlink()

            # Run initial update to self-bootstrap
            await self._run_steamcmd(["+quit"])
            
            logger.info("SteamCMD installed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to install SteamCMD: {e}")
            return False
    
    async def login(self, username: str, password: str, guard_code: Optional[str] = None) -> Dict:
        """Login to Steam"""
        try:
            logger.info(f"Logging in as {username}...")
            
            # Build login command
            args = ["+login", username, password]
            if guard_code:
                args.extend([guard_code])
            args.append("+quit")
            
            result = await self._run_steamcmd_interactive(args, username)
            
            if result["success"]:
                self.config_manager.set_steam_login(username)
                logger.info(f"Successfully logged in as {username}")
            
            return result
            
        except Exception as e:
            logger.error(f"Login failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def _run_steamcmd_interactive(self, args: list, username: str) -> Dict:
        """Run SteamCMD with interactive input support for Steam Guard"""
        if not self.is_installed():
            return {"success": False, "error": "SteamCMD not installed"}
        
        try:
            cmd = [str(self.steamcmd_exe)] + args
            
            self._process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.steamcmd_path)
            )
            
            output_lines = []
            requires_guard = False
            
            while True:
                try:
                    line = await asyncio.wait_for(
                        self._process.stdout.readline(),
                        timeout=30.0
                    )
                    
                    if not line:
                        break
                    
                    line_str = line.decode('utf-8', errors='ignore').strip()
                    output_lines.append(line_str)
                    logger.debug(f"SteamCMD: {line_str}")
                    
                    # Check for Steam Guard prompt
                    if "Steam Guard" in line_str or "Two-factor" in line_str:
                        requires_guard = True
                        return {
                            "success": False,
                            "requires_guard": True,
                            "message": "Steam Guard code required",
                            "output": output_lines
                        }
                    
                    # Check for success
                    if "Logged in OK" in line_str:
                        await self._process.wait()
                        return {
                            "success": True,
                            "message": "Login successful",
                            "output": output_lines
                        }
                    
                    # Check for failure
                    if "FAILED" in line_str or "Invalid Password" in line_str:
                        await self._process.wait()
                        return {
                            "success": False,
                            "error": "Invalid credentials",
                            "output": output_lines
                        }
                    
                except asyncio.TimeoutError:
                    # Timeout - might be waiting for input
                    if requires_guard:
                        return {
                            "success": False,
                            "requires_guard": True,
                            "message": "Steam Guard code required"
                        }
                    break
            
            await self._process.wait()
            
            return {
                "success": self._process.returncode == 0,
                "output": output_lines
            }
            
        except Exception as e:
            logger.error(f"SteamCMD error: {e}")
            return {"success": False, "error": str(e)}
    
    async def submit_guard_code(self, code: str) -> Dict:
        """Submit Steam Guard code"""
        if self._process and self._process.returncode is None:
            try:
                self._process.stdin.write(f"{code}\n".encode())
                await self._process.stdin.drain()
                return {"success": True, "message": "Code submitted"}
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        self._guard_code = code
        self._guard_code_event.set()
        return {"success": True, "message": "Code received"}
    
    def logout(self):
        """Logout from Steam"""
        self.config_manager.clear_steam_login()
    
    async def _run_steamcmd(self, args: list, on_output=None) -> tuple:
        """Run SteamCMD with arguments, streaming output line by line via optional async callback"""
        if not self.is_installed():
            raise Exception("SteamCMD not installed")

        cmd = [str(self.steamcmd_exe)] + args

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(self.steamcmd_path)
        )

        all_lines = []
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            line_str = line.decode('utf-8', errors='ignore').rstrip()
            if line_str:
                all_lines.append(line_str)
                if on_output:
                    await on_output(line_str)

        await process.wait()
        return '\n'.join(all_lines), '', process.returncode
    
    async def install_game(self, server_id: str, app_id: str, requires_login: bool = False, on_output=None) -> Dict:
        """Install a game server"""
        try:
            servers_path = self.config_manager.get_servers_path()
            install_path = servers_path / server_id
            install_path.mkdir(parents=True, exist_ok=True)
            
            self._install_status[server_id] = {
                "status": "installing",
                "progress": 0,
                "message": "Starting installation...",
                "started_at": datetime.now(timezone.utc).isoformat()
            }

            if on_output:
                await on_output(f"[SteamCMD] Installing App ID {app_id} ...")

            # Build command
            if requires_login:
                username = self.get_current_user()
                if not username:
                    return {"success": False, "error": "Login required for this game"}
                args = [
                    "+force_install_dir", str(install_path),
                    "+login", username,
                    "+app_update", app_id, "validate",
                    "+quit"
                ]
            else:
                args = [
                    "+force_install_dir", str(install_path),
                    "+login", "anonymous",
                    "+app_update", app_id, "validate",
                    "+quit"
                ]
            
            stdout, stderr, returncode = await self._run_steamcmd(args, on_output=on_output)

            if returncode == 0:
                self._install_status[server_id] = {
                    "status": "complete",
                    "progress": 100,
                    "message": "Installation complete",
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }
                if on_output:
                    await on_output("[SteamCMD] Installation complete!")
                return {"success": True, "message": "Game installed successfully"}
            else:
                self._install_status[server_id] = {
                    "status": "error",
                    "progress": 0,
                    "message": f"Installation failed"
                }
                if on_output:
                    await on_output(f"[SteamCMD] Installation failed (exit code {returncode})")
                return {"success": False, "error": "Installation failed"}
            
        except Exception as e:
            logger.error(f"Failed to install game: {e}")
            self._install_status[server_id] = {
                "status": "error",
                "message": str(e)
            }
            return {"success": False, "error": str(e)}
    
    def get_install_status(self, server_id: str) -> Dict:
        """Get installation status for a server"""
        return self._install_status.get(server_id, {"status": "unknown"})
    
    async def update_game(self, server_id: str, app_id: str) -> Dict:
        """Update a game server"""
        return await self.install_game(server_id, app_id)
    
    async def download_workshop_mod(self, workshop_app_id: str, mod_id: str, install_path: Path) -> Dict:
        """Download a workshop mod"""
        try:
            args = [
                "+login", self.get_current_user() or "anonymous",
                "+workshop_download_item", workshop_app_id, mod_id,
                "+quit"
            ]
            
            stdout, stderr, returncode = await self._run_steamcmd(args)
            
            if returncode == 0:
                # Move mod to install path
                workshop_path = self.steamcmd_path / "steamapps" / "workshop" / "content" / workshop_app_id / mod_id
                if workshop_path.exists():
                    target_path = install_path / mod_id
                    if target_path.exists():
                        shutil.rmtree(target_path)
                    shutil.copytree(workshop_path, target_path)
                
                return {"success": True, "mod_id": mod_id}
            else:
                return {"success": False, "error": stderr}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
