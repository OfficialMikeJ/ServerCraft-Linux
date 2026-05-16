"""Server Manager - Handles game server processes"""

import asyncio
import subprocess
import psutil
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime, timezone
import uuid
import json

logger = logging.getLogger(__name__)


class ServerManager:
    def __init__(self, config_manager):
        self.config_manager = config_manager
        self.servers_path = config_manager.get_servers_path()
        self.servers_path.mkdir(parents=True, exist_ok=True)
        
        self._processes: Dict[str, subprocess.Popen] = {}
        self._console_buffers: Dict[str, List[str]] = {}
        self._max_buffer_size = 1000
    
    def get_all_servers(self) -> List[Dict]:
        """Get all servers with their current status"""
        data = self.config_manager.get_servers_data()
        servers = []
        
        for server_id, server_config in data.get("servers", {}).items():
            state = data.get("states", {}).get(server_id, {})
            server = {**server_config, "id": server_id}
            
            # Check if process is actually running
            if server_id in self._processes:
                process = self._processes[server_id]
                if process.poll() is None:
                    server["status"] = "running"
                    server["pid"] = process.pid
                else:
                    server["status"] = "stopped"
                    del self._processes[server_id]
            else:
                server["status"] = state.get("status", "stopped")
            
            servers.append(server)
        
        return servers
    
    def get_server(self, server_id: str) -> Optional[Dict]:
        """Get a single server"""
        server_config = self.config_manager.get_server(server_id)
        if not server_config:
            return None
        
        state = self.config_manager.get_server_state(server_id)
        server = {**server_config, "id": server_id}
        
        if server_id in self._processes:
            process = self._processes[server_id]
            if process.poll() is None:
                server["status"] = "running"
                server["pid"] = process.pid
            else:
                server["status"] = "stopped"
        else:
            server["status"] = state.get("status", "stopped")
        
        return server
    
    def create_server(self, server_data: Dict) -> Dict:
        """Create a new server"""
        server_id = str(uuid.uuid4())
        server_data["id"] = server_id
        server_data["created_at"] = datetime.now(timezone.utc).isoformat()
        server_data["status"] = "stopped"
        
        # Create server directory
        server_path = self.servers_path / server_id
        server_path.mkdir(parents=True, exist_ok=True)
        
        # Save server config
        self.config_manager.save_server(server_id, server_data)
        self.config_manager.save_server_state(server_id, {"status": "stopped"})
        
        self._console_buffers[server_id] = []
        
        logger.info(f"Created server: {server_data['name']} ({server_id})")
        return server_data
    
    def update_server(self, server_id: str, server_data: Dict) -> Optional[Dict]:
        """Update server configuration"""
        existing = self.config_manager.get_server(server_id)
        if not existing:
            return None
        
        # Preserve some fields
        server_data["id"] = server_id
        server_data["created_at"] = existing.get("created_at")
        server_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        self.config_manager.save_server(server_id, server_data)
        logger.info(f"Updated server: {server_id}")
        return server_data
    
    def delete_server(self, server_id: str) -> bool:
        """Delete a server"""
        if not self.config_manager.get_server(server_id):
            return False
        
        # Stop if running
        if server_id in self._processes:
            asyncio.create_task(self.stop_server(server_id))
        
        # Delete config
        self.config_manager.delete_server(server_id)
        
        # Clean up console buffer
        if server_id in self._console_buffers:
            del self._console_buffers[server_id]
        
        logger.info(f"Deleted server: {server_id}")
        return True
    
    async def start_server(self, server_id: str, game_definitions: Dict) -> Dict:
        """Start a server"""
        server = self.config_manager.get_server(server_id)
        if not server:
            return {"success": False, "error": "Server not found"}
        
        if server_id in self._processes:
            if self._processes[server_id].poll() is None:
                return {"success": False, "error": "Server already running"}
        
        game = server.get("game")
        if game not in game_definitions:
            return {"success": False, "error": "Unsupported game"}
        
        game_def = game_definitions[game]
        server_path = self.servers_path / server_id
        
        if not server_path.exists():
            return {"success": False, "error": "Server files not installed"}
        
        try:
            # Build start command based on game
            cmd = self._build_start_command(server, game_def, server_path)
            
            if not cmd:
                return {"success": False, "error": "Could not build start command"}
            
            # Start process
            process = subprocess.Popen(
                cmd,
                cwd=str(server_path),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if hasattr(subprocess, 'CREATE_NEW_PROCESS_GROUP') else 0
            )
            
            self._processes[server_id] = process
            self._console_buffers[server_id] = []
            
            # Start console reader
            asyncio.create_task(self._read_console(server_id, process))
            
            # Update state
            self.config_manager.save_server_state(server_id, {
                "status": "running",
                "pid": process.pid,
                "started_at": datetime.now(timezone.utc).isoformat()
            })
            
            logger.info(f"Started server: {server['name']} (PID: {process.pid})")
            return {"success": True, "pid": process.pid}
            
        except Exception as e:
            logger.error(f"Failed to start server: {e}")
            return {"success": False, "error": str(e)}
    
    def _build_start_command(self, server: Dict, game_def: Dict, server_path: Path) -> Optional[List[str]]:
        """Build the start command for a game server"""
        exe = game_def.get("executable")
        game = server.get("game")
        
        exe_path = server_path / exe
        if not exe_path.exists():
            # Try to find executable
            for pattern in ["*.exe", "*.bat", "*.jar"]:
                matches = list(server_path.glob(pattern))
                if matches:
                    exe_path = matches[0]
                    break
        
        if not exe_path.exists():
            return None
        
        # Base command
        if str(exe_path).endswith(".jar"):
            cmd = ["java", "-Xmx4G", "-jar", str(exe_path), "nogui"]
        else:
            cmd = [str(exe_path)]
        
        # Add game-specific parameters
        port = server.get("port", game_def.get("default_port", 27015))
        max_players = server.get("max_players", 32)
        server_name = server.get("name", "ServerCraft Server")
        query_port = server.get("query_port", port + 1)
        
        if game == "arma3":
            cmd.extend([
                f"-port={port}",
                f"-name={server_name}",
                "-config=server.cfg",
                "-profiles=profiles"
            ])
            if server.get("mods"):
                mods_str = ";".join(server["mods"])
                cmd.append(f"-mod={mods_str}")
        
        elif game == "arma_reforger":
            # Arma Reforger uses Enfusion engine with JSON config
            cmd.extend([
                "-config", "ServerConfig.json",
                f"-maxPlayers {max_players}",
                f"-bindPort {port}",
                f"-publicPort {port}",
                f"-a2sPort {query_port}",
                "-backendlog",
                "-nothrow",
                "-logStats", "5000"
            ])
            if server.get("password"):
                cmd.append(f"-password {server['password']}")
            if server.get("mods"):
                # Reforger mods use -addons flag
                for mod_id in server["mods"]:
                    cmd.extend(["-addons", mod_id])
        
        elif game in ("dayz_vanilla", "dayz_modded"):
            cmd.extend([
                f"-port={port}",
                "-config=serverDZ.cfg",
                "-profiles=profiles"
            ])
            if game == "dayz_modded" and server.get("mods"):
                mods_str = ";".join(server["mods"])
                cmd.append(f"-mod={mods_str}")
        
        elif game == "rust":
            cmd.extend([
                "-batchmode",
                f"+server.port {port}",
                f"+server.maxplayers {max_players}",
                f"+server.hostname \"{server_name}\""
            ])
        
        elif game == "valheim":
            cmd.extend([
                "-nographics",
                "-batchmode",
                f"-port {port}",
                f"-name \"{server_name}\"",
                "-world \"ServerCraft\""
            ])
        
        elif game == "project_zomboid":
            # PZ uses batch file
            pass
        
        elif game == "squad":
            cmd.extend([
                f"Port={port}",
                f"QueryPort={query_port}"
            ])
        
        elif game == "ground_branch":
            cmd.extend([
                f"-Port={port}",
                f"-QueryPort={query_port}",
                f"-MaxPlayers={max_players}"
            ])
        
        elif game == "icarus":
            cmd.extend([
                f"-Port={port}",
                f"-QueryPort={query_port}",
                f"-SteamServerName=\"{server_name}\""
            ])
        
        elif game == "no_one_survived":
            cmd.extend([
                f"-port={port}",
                f"-queryport={query_port}",
                f"-maxplayers={max_players}"
            ])
        
        elif game == "fivem":
            # FiveM uses server.cfg, not command line params for most settings
            cmd.extend([
                "+exec", "server.cfg"
            ])
        
        elif game == "source_engine":
            cmd.extend([
                "-console",
                f"-port {port}",
                f"+maxplayers {max_players}",
                f"+hostname \"{server_name}\""
            ])
        
        elif game == "teamspeak3":
            cmd.extend([
                f"voice_port={port}",
                f"query_port={query_port}",
                f"filetransfer_port={port + 2}",
                f"serveradmin_password={server.get('password', '')}",
                f"default_virtualserver_name=\"{server_name}\"",
                f"default_virtualserver_maxclients={max_players}",
                "dbplugin=ts3db_sqlite3",
                "logpath=logs"
            ])
        
        # Add custom parameters
        if server.get("custom_params"):
            cmd.extend(server["custom_params"].split())
        
        return cmd
    
    async def stop_server(self, server_id: str) -> Dict:
        """Stop a server"""
        if server_id not in self._processes:
            return {"success": False, "error": "Server not running"}
        
        process = self._processes[server_id]
        
        try:
            # Try graceful shutdown first
            process.terminate()
            
            # Wait for process to end
            try:
                process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                # Force kill
                process.kill()
                process.wait(timeout=10)
            
            del self._processes[server_id]
            
            # Update state
            self.config_manager.save_server_state(server_id, {
                "status": "stopped",
                "stopped_at": datetime.now(timezone.utc).isoformat()
            })
            
            logger.info(f"Stopped server: {server_id}")
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Failed to stop server: {e}")
            return {"success": False, "error": str(e)}
    
    async def restart_server(self, server_id: str, game_definitions: Dict) -> Dict:
        """Restart a server"""
        await self.stop_server(server_id)
        await asyncio.sleep(2)
        return await self.start_server(server_id, game_definitions)
    
    async def _read_console(self, server_id: str, process: subprocess.Popen):
        """Read console output from process"""
        try:
            while process.poll() is None:
                line = await asyncio.get_event_loop().run_in_executor(
                    None, process.stdout.readline
                )
                
                if line:
                    line_str = line.decode('utf-8', errors='ignore').strip()
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    formatted_line = f"[{timestamp}] {line_str}"
                    
                    if server_id not in self._console_buffers:
                        self._console_buffers[server_id] = []
                    
                    self._console_buffers[server_id].append(formatted_line)
                    
                    # Trim buffer
                    if len(self._console_buffers[server_id]) > self._max_buffer_size:
                        self._console_buffers[server_id] = self._console_buffers[server_id][-self._max_buffer_size:]
        
        except Exception as e:
            logger.error(f"Console reader error: {e}")
    
    def get_console_output(self, server_id: str, lines: int = 100) -> Dict:
        """Get console output for a server"""
        if server_id not in self._console_buffers:
            return {"lines": [], "server_id": server_id}
        
        return {
            "lines": self._console_buffers[server_id][-lines:],
            "server_id": server_id
        }
    
    async def send_command(self, server_id: str, command: str) -> Dict:
        """Send command to server stdin"""
        if server_id not in self._processes:
            return {"success": False, "error": "Server not running"}
        
        process = self._processes[server_id]
        
        try:
            process.stdin.write(f"{command}\n".encode())
            process.stdin.flush()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_server_stats(self, server_id: str) -> Dict:
        """Get resource usage for a server"""
        if server_id not in self._processes:
            return {"running": False}
        
        process = self._processes[server_id]
        if process.poll() is not None:
            return {"running": False}
        
        try:
            proc = psutil.Process(process.pid)
            
            return {
                "running": True,
                "pid": process.pid,
                "cpu_percent": proc.cpu_percent(interval=0.1),
                "memory_mb": proc.memory_info().rss / 1024 / 1024,
                "memory_percent": proc.memory_percent(),
                "threads": proc.num_threads(),
                "uptime": (datetime.now() - datetime.fromtimestamp(proc.create_time())).total_seconds()
            }
        except Exception as e:
            logger.error(f"Failed to get server stats: {e}")
            return {"running": True, "error": str(e)}
    
    def get_all_server_stats(self) -> Dict[str, Dict]:
        """Get stats for all running servers"""
        stats = {}
        for server_id in self._processes:
            stats[server_id] = self.get_server_stats(server_id)
        return stats
    
    async def auto_start_servers(self, game_definitions: Dict):
        """Auto-start servers marked for auto-start"""
        servers = self.get_all_servers()
        for server in servers:
            if server.get("auto_start"):
                logger.info(f"Auto-starting server: {server['name']}")
                await self.start_server(server["id"], game_definitions)
    
    def save_states(self):
        """Save current server states"""
        for server_id in self._processes:
            process = self._processes[server_id]
            if process.poll() is None:
                self.config_manager.save_server_state(server_id, {
                    "status": "running",
                    "pid": process.pid
                })
