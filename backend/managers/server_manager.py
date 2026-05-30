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
    
    async def start_server(self, server_id: str, game_definitions: Dict, output_callback=None) -> Dict:
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
            # Generate game-specific config files before starting
            if game == "arma_reforger":
                port = server.get("port", game_def.get("default_port", 2001))
                query_port = server.get("query_port", port + 1)
                self._generate_reforger_config(server, server_path, port, query_port)

            elif game == "assetto_corsa":
                port = server.get("port", game_def.get("default_port", 9600))
                self._generate_ac_config(server, server_path, port)

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

            # Start console reader — pass broadcast callback so output streams to WS
            asyncio.create_task(self._read_console(server_id, process, output_callback))

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
    
    def _generate_reforger_config(self, server: Dict, server_path: Path, port: int, query_port: int) -> None:
        """Write ServerConfig.json for Arma Reforger, merging server settings into the template."""
        config_path = server_path / "ServerConfig.json"

        # Preserve any keys the user may have hand-edited outside ServerCraft
        existing = {}
        if config_path.exists():
            try:
                with open(config_path) as f:
                    existing = json.load(f)
            except Exception:
                pass

        mods = [{"modId": m, "name": m} for m in server.get("mods", [])]

        game_block = existing.get("game", {})
        game_block.update({
            "name": server.get("name", "ServerCraft Server"),
            "password": server.get("password", ""),
            "passwordAdmin": server.get("admin_password", "admin"),
            "scenarioId": server.get("scenario_id",
                "{ECC61978EDCC2B5A}Missions/23_Campaign.conf"),
            "maxPlayers": server.get("max_players", 32),
            "mods": mods,
        })
        game_block.setdefault("admins", [])
        game_block.setdefault("visible", True)
        game_block.setdefault("crossPlatform", True)
        game_block.setdefault("supportedPlatforms", ["PLATFORM_PC", "PLATFORM_XBL"])
        game_block.setdefault("gameProperties", {
            "serverMaxViewDistance": 2500,
            "serverMinGrassDistance": 50,
            "networkViewDistance": 1500,
            "disableThirdPerson": False,
            "fastValidation": True,
            "battlEye": True,
            "VONDisableUI": False,
            "VONDisableDirectSpeechUI": False,
            "missionHeader": {
                "m_iPlayerCount": server.get("max_players", 40),
                "m_eEditableGameFlags": 6,
                "m_eDefaultGameFlags": 6,
            },
        })

        config = {
            "bindAddress": existing.get("bindAddress", "0.0.0.0"),
            "bindPort": port,
            "publicAddress": existing.get("publicAddress", ""),
            "publicPort": port,
            "a2s": {"address": "0.0.0.0", "port": query_port},
            "rcon": existing.get("rcon", {
                "address": "0.0.0.0",
                "port": 19999,
                "password": "",
                "permission": "admin",
                "blacklist": [],
                "whitelist": [],
            }),
            "game": game_block,
            "operating": existing.get("operating", {
                "lobbyPlayerSynchronise": True,
                "joinQueue": {"maxSize": 0},
                "disableNavmeshStreaming": None,
                "disableServerShutdown": False,
                "disableCrashReporter": False,
                "disableAI": False,
                "playerSaveTime": 120,
                "aiLimit": -1,
                "slotReservationTimeout": 60,
            }),
        }

        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)

        logger.info(f"Generated ServerConfig.json for Arma Reforger server '{server.get('name')}'")

    def _generate_ac_config(self, server: Dict, server_path: Path, port: int) -> None:
        """Write cfg/server_cfg.ini and cfg/entry_list.ini for Assetto Corsa."""
        cfg_dir = server_path / "cfg"
        cfg_dir.mkdir(parents=True, exist_ok=True)

        name = server.get("name", "ServerCraft AC Server")
        password = server.get("password", "")
        admin_password = server.get("admin_password", "admin")
        max_clients = server.get("max_players", 16)
        track = server.get("ac_track", "monza")
        track_config = server.get("ac_track_config", "")
        cars = server.get("ac_cars", "lotus_exige_s")
        http_port = port + 81  # e.g. 9681 for HTTP lobby

        server_cfg = cfg_dir / "server_cfg.ini"
        existing_cfg = {}
        if server_cfg.exists():
            import configparser
            cp = configparser.RawConfigParser()
            cp.read(server_cfg)
            for section in cp.sections():
                existing_cfg[section] = dict(cp[section])

        weather = existing_cfg.get("WEATHER_0", {})

        lines = [
            "[SERVER]",
            f"NAME={name}",
            f"PASSWORD={password}",
            f"ADMIN_PASSWORD={admin_password}",
            f"UDP_PORT={port}",
            f"TCP_PORT={port}",
            f"HTTP_PORT={http_port}",
            f"MAX_CLIENTS={max_clients}",
            "SLEEP_TIME=1",
            "CLIENT_SEND_INTERVAL_HZ=18",
            "SEND_BUFFER_SIZE=0",
            "RECV_BUFFER_SIZE=0",
            "REGISTER_TO_LOBBY=1",
            "NUM_THREADS=2",
            f"TRACK={track}",
            f"CARS={cars}",
            f"CONFIG_TRACK={track_config}",
            "TYRE_BLANKETS_ALLOWED=1",
            "SUN_ANGLE=-8",
            "ALLOWED_TYRES_OUT=2",
            "ABS_ALLOWED=1",
            "TC_ALLOWED=1",
            "STABILITY_ALLOWED=0",
            "AUTOCLUTCH_ALLOWED=1",
            "TYRE_RATE=1",
            "DAMAGE_MULTIPLIER=100",
            "FUEL_RATE=100",
            "QUALIFY_MAX_WAIT_PERC=120",
            "TIME_OF_DAY_MULT=1",
            "RACE_OVER_TIME=30",
            "RACE_GAS_PENALTY_DISABLED=0",
            "RESULT_SCREEN_TIME=60",
            "MAX_CONTACTS_PER_KM=0",
            "WELCOME_MESSAGE=",
            "",
            "[PRACTICE]",
            "NAME=Practice",
            "TIME=60",
            "IS_OPEN=1",
            "",
            "[QUALIFY]",
            "NAME=Qualify",
            "TIME=15",
            "IS_OPEN=1",
            "MAX_PLAYERS_WAIT=20",
            "",
            "[RACE]",
            "NAME=Race",
            "LAPS=5",
            "WAIT_TIME=30",
            "IS_OPEN=1",
            "",
            "[DYNAMIC_TRACK]",
            "SESSION_START=98",
            "RANDOMNESS=2",
            "SESSION_TRANSFER=50",
            "LAP_GAIN=1",
            "",
            "[WEATHER_0]",
            f"GRAPHICS={weather.get('graphics', '3_mid_rolling_start_wind_from_west')}",
            f"BASE_TEMPERATURE_AMBIENT={weather.get('base_temperature_ambient', '20')}",
            f"BASE_TEMPERATURE_ROAD={weather.get('base_temperature_road', '8')}",
            f"VARIATION_AMBIENT={weather.get('variation_ambient', '2')}",
            f"VARIATION_ROAD={weather.get('variation_road', '2')}",
            f"WIND_BASE_SPEED_MIN={weather.get('wind_base_speed_min', '3')}",
            f"WIND_BASE_SPEED_MAX={weather.get('wind_base_speed_max', '15')}",
            f"WIND_BASE_DIRECTION={weather.get('wind_base_direction', '30')}",
            f"WIND_VARIATION_DIRECTION={weather.get('wind_variation_direction', '15')}",
        ]

        with open(server_cfg, "w") as f:
            f.write("\n".join(lines) + "\n")

        # Write entry_list.ini only if it doesn't already exist (preserve user edits)
        entry_list = cfg_dir / "entry_list.ini"
        if not entry_list.exists():
            car_list = [c.strip() for c in cars.split(";") if c.strip()]
            entry_lines = []
            for i, car in enumerate(car_list):
                entry_lines += [
                    f"[CAR_{i}]",
                    f"MODEL={car}",
                    "SKIN=",
                    "SPECTATOR_MODE=0",
                    "DRIVERNAME=",
                    "TEAM=",
                    "GUID=",
                    "BALLAST=0",
                    "RESTRICTOR=0",
                    "",
                ]
            with open(entry_list, "w") as f:
                f.write("\n".join(entry_lines))

        logger.info(f"Generated AC config files for server '{server.get('name')}'")

    def _build_start_command(self, server: Dict, game_def: Dict, server_path: Path) -> Optional[List[str]]:
        """Build the start command for a game server"""
        exe = game_def.get("executable")
        game = server.get("game")
        
        exe_path = server_path / exe
        if not exe_path.exists():
            # Fallback: look for common executable types (Windows) or
            # executable files without extension (Linux).
            for pattern in ["*.exe", "*.bat", "*.jar"]:
                matches = list(server_path.glob(pattern))
                if matches:
                    exe_path = matches[0]
                    break
            else:
                import os
                for candidate in server_path.iterdir():
                    if candidate.is_file() and os.access(candidate, os.X_OK) and "." not in candidate.name:
                        exe_path = candidate
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
            # Arma Reforger uses Enfusion engine with JSON config.
            # ServerConfig.json is generated by start_server before this runs.
            cmd.extend([
                "-config", "ServerConfig.json",
                "-maxPlayers", str(max_players),
                "-bindPort", str(port),
                "-publicPort", str(port),
                "-a2sPort", str(query_port),
                "-backendlog",
                "-nothrow",
                "-logStats", "5000",
            ])
        
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
        
        elif game == "assetto_corsa":
            # AC reads all config from cfg/server_cfg.ini — no CLI overrides needed.
            # cfg/ is generated by _generate_ac_config before this runs.
            pass

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
    
    async def restart_server(self, server_id: str, game_definitions: Dict, output_callback=None) -> Dict:
        """Restart a server"""
        await self.stop_server(server_id)
        await asyncio.sleep(2)
        return await self.start_server(server_id, game_definitions, output_callback)
    
    async def _read_console(self, server_id: str, process: subprocess.Popen, output_callback=None):
        """Read console output from process, buffering it and optionally streaming via callback"""
        try:
            loop = asyncio.get_running_loop()
            while process.poll() is None:
                line = await loop.run_in_executor(None, process.stdout.readline)

                if line:
                    line_str = line.decode('utf-8', errors='ignore').strip()
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    formatted_line = f"[{timestamp}] {line_str}"

                    if server_id not in self._console_buffers:
                        self._console_buffers[server_id] = []

                    self._console_buffers[server_id].append(formatted_line)

                    if len(self._console_buffers[server_id]) > self._max_buffer_size:
                        self._console_buffers[server_id] = self._console_buffers[server_id][-self._max_buffer_size:]

                    if output_callback:
                        try:
                            await output_callback(formatted_line)
                        except Exception:
                            pass

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
