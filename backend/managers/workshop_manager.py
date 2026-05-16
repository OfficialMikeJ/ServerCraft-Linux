"""Workshop Manager - Steam Workshop mod management with caching"""

import re
import logging
import shutil
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime, timezone
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class WorkshopManager:
    def __init__(self, steamcmd_manager, mod_cache_manager=None):
        self.steamcmd_manager = steamcmd_manager
        self.config_manager = steamcmd_manager.config_manager
        self.mods_path = self.config_manager.get_mods_path()
        self.mods_path.mkdir(parents=True, exist_ok=True)
        self.cache_manager = mod_cache_manager
    
    def set_cache_manager(self, cache_manager):
        """Set the cache manager (called after initialization)"""
        self.cache_manager = cache_manager
    
    def parse_arma3_modlist(self, html_content: str) -> List[str]:
        """
        Parse Arma 3 modlist.html file to extract mod IDs
        The HTML contains Workshop links like:
        <a href="https://steamcommunity.com/sharedfiles/filedetails/?id=463939057">
        """
        mod_ids = []
        
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Find all links
            for link in soup.find_all('a', href=True):
                href = link['href']
                
                # Match Steam Workshop URLs
                match = re.search(r'steamcommunity\.com/sharedfiles/filedetails/\?id=(\d+)', href)
                if match:
                    mod_id = match.group(1)
                    if mod_id not in mod_ids:
                        mod_ids.append(mod_id)
                
                # Also check for workshop URL format
                match = re.search(r'steamcommunity\.com/workshop/filedetails/\?id=(\d+)', href)
                if match:
                    mod_id = match.group(1)
                    if mod_id not in mod_ids:
                        mod_ids.append(mod_id)
            
            # Also try to find mod IDs in data attributes or text
            for tag in soup.find_all(attrs={"data-type": "ModContainer"}):
                data_id = tag.get('data-id')
                if data_id and data_id not in mod_ids:
                    mod_ids.append(data_id)
            
            logger.info(f"Parsed {len(mod_ids)} mod IDs from modlist")
            return mod_ids
        
        except Exception as e:
            logger.error(f"Failed to parse modlist: {e}")
            return []
    
    def _get_game_key_from_workshop_id(self, workshop_app_id: str) -> Optional[str]:
        """Reverse-lookup game key from workshop app ID"""
        from server import GAME_DEFINITIONS
        for key, gdef in GAME_DEFINITIONS.items():
            if gdef.get("workshop_id") == workshop_app_id:
                return key
        return None
    
    async def download_mods(self, workshop_app_id: str, mod_ids: List[str]) -> Dict:
        """Download multiple workshop mods with cache support"""
        game_key = self._get_game_key_from_workshop_id(workshop_app_id)
        
        results = {
            "success": True,
            "total": len(mod_ids),
            "downloaded": 0,
            "from_cache": 0,
            "failed": 0,
            "mods": []
        }
        
        game_mods_path = self.mods_path / workshop_app_id
        game_mods_path.mkdir(parents=True, exist_ok=True)
        
        for mod_id in mod_ids:
            # Check cache first
            if self.cache_manager and game_key and self.cache_manager.is_cached(game_key, mod_id):
                restore = self.cache_manager.restore_from_cache(game_key, mod_id, game_mods_path)
                if restore.get("success"):
                    results["from_cache"] += 1
                    results["downloaded"] += 1
                    results["mods"].append({
                        "mod_id": mod_id,
                        "status": "success",
                        "from_cache": True,
                        "path": str(game_mods_path / mod_id)
                    })
                    logger.info(f"Restored mod {mod_id} from cache")
                    continue
            
            # Download fresh via SteamCMD
            result = await self.steamcmd_manager.download_workshop_mod(
                workshop_app_id,
                mod_id,
                game_mods_path
            )
            
            if result.get("success"):
                results["downloaded"] += 1
                results["mods"].append({
                    "mod_id": mod_id,
                    "status": "success",
                    "from_cache": False,
                    "path": str(game_mods_path / mod_id)
                })
                # Cache the newly downloaded mod
                if self.cache_manager and game_key:
                    mod_path = game_mods_path / mod_id
                    if mod_path.exists():
                        cache_result = self.cache_manager.cache_mod(game_key, mod_id, mod_path)
                        if cache_result.get("success"):
                            logger.info(f"Cached mod {mod_id} ({cache_result.get('size_mb', 0)} MB)")
            else:
                results["failed"] += 1
                results["mods"].append({
                    "mod_id": mod_id,
                    "status": "failed",
                    "from_cache": False,
                    "error": result.get("error", "Unknown error")
                })
        
        results["success"] = results["failed"] == 0
        return results
    
    async def download_single_mod(self, game: str, mod_id: str) -> Dict:
        """Download a single workshop mod with cache support"""
        from server import GAME_DEFINITIONS
        
        if game not in GAME_DEFINITIONS:
            return {"success": False, "error": "Unsupported game"}
        
        workshop_id = GAME_DEFINITIONS[game].get("workshop_id")
        if not workshop_id:
            return {"success": False, "error": "Game does not support workshop"}
        
        game_mods_path = self.mods_path / workshop_id
        game_mods_path.mkdir(parents=True, exist_ok=True)
        
        # Check cache first
        if self.cache_manager and self.cache_manager.is_cached(game, mod_id):
            restore = self.cache_manager.restore_from_cache(game, mod_id, game_mods_path)
            if restore.get("success"):
                logger.info(f"Restored single mod {mod_id} from cache for {game}")
                return {"success": True, "mod_id": mod_id, "from_cache": True}
        
        # Download fresh
        result = await self.steamcmd_manager.download_workshop_mod(
            workshop_id,
            mod_id,
            game_mods_path
        )
        
        # Cache on success
        if result.get("success") and self.cache_manager:
            mod_path = game_mods_path / mod_id
            if mod_path.exists():
                self.cache_manager.cache_mod(game, mod_id, mod_path)
        
        if result.get("success"):
            result["from_cache"] = False
        
        return result
    
    def get_installed_mods(self, game: str) -> List[Dict]:
        """Get list of installed mods for a game"""
        from server import GAME_DEFINITIONS
        
        if game not in GAME_DEFINITIONS:
            return []
        
        workshop_id = GAME_DEFINITIONS[game].get("workshop_id")
        if not workshop_id:
            return []
        
        game_mods_path = self.mods_path / workshop_id
        
        if not game_mods_path.exists():
            return []
        
        mods = []
        for mod_dir in game_mods_path.iterdir():
            if mod_dir.is_dir():
                mod_info = {
                    "id": mod_dir.name,
                    "path": str(mod_dir),
                    "size_mb": self._get_dir_size(mod_dir) / (1024 * 1024),
                    "cached": bool(self.cache_manager and self.cache_manager.is_cached(game, mod_dir.name))
                }
                
                # Try to get mod name from meta.cpp or other files
                meta_file = mod_dir / "meta.cpp"
                if meta_file.exists():
                    try:
                        content = meta_file.read_text()
                        name_match = re.search(r'name\s*=\s*"([^"]+)"', content)
                        if name_match:
                            mod_info["name"] = name_match.group(1)
                    except Exception:
                        pass
                
                if "name" not in mod_info:
                    mod_info["name"] = f"Mod {mod_dir.name}"
                
                mods.append(mod_info)
        
        return mods
    
    def _get_dir_size(self, path: Path) -> int:
        """Get total size of directory in bytes"""
        total = 0
        try:
            for entry in path.rglob('*'):
                if entry.is_file():
                    total += entry.stat().st_size
        except OSError:
            pass
        return total
    
    def delete_mod(self, game: str, mod_id: str) -> Dict:
        """Delete an installed mod"""
        from server import GAME_DEFINITIONS
        
        if game not in GAME_DEFINITIONS:
            return {"success": False, "error": "Unsupported game"}
        
        workshop_id = GAME_DEFINITIONS[game].get("workshop_id")
        if not workshop_id:
            return {"success": False, "error": "Game does not support workshop"}
        
        mod_path = self.mods_path / workshop_id / mod_id
        
        if not mod_path.exists():
            return {"success": False, "error": "Mod not found"}
        
        try:
            shutil.rmtree(mod_path)
            logger.info(f"Deleted mod: {mod_id}")
            return {"success": True, "mod_id": mod_id}
        except Exception as e:
            logger.error(f"Failed to delete mod: {e}")
            return {"success": False, "error": str(e)}
    
    def link_mods_to_server(self, server_id: str, mod_ids: List[str], game: str) -> Dict:
        """Create symlinks or copy mods to server directory"""
        from server import GAME_DEFINITIONS
        
        servers_path = self.config_manager.get_servers_path()
        server_path = servers_path / server_id
        
        if not server_path.exists():
            return {"success": False, "error": "Server not found"}
        
        workshop_id = GAME_DEFINITIONS.get(game, {}).get("workshop_id")
        if not workshop_id:
            return {"success": False, "error": "Game does not support workshop"}
        
        results = []
        
        for mod_id in mod_ids:
            source = self.mods_path / workshop_id / mod_id
            
            if not source.exists():
                results.append({"mod_id": mod_id, "success": False, "error": "Mod not found"})
                continue
            
            # Determine target path based on game
            if game == "arma3":
                target = server_path / f"@{mod_id}"
            elif game == "arma_reforger":
                target = server_path / "addons" / mod_id
            else:
                target = server_path / "mods" / mod_id
            
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                
                if target.exists():
                    shutil.rmtree(target)
                
                # Try symlink first, fall back to copy
                try:
                    target.symlink_to(source)
                except OSError:
                    shutil.copytree(source, target)
                
                results.append({"mod_id": mod_id, "success": True})
            except Exception as e:
                results.append({"mod_id": mod_id, "success": False, "error": str(e)})
        
        return {
            "success": all(r["success"] for r in results),
            "results": results
        }
