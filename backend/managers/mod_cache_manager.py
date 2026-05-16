"""Mod Cache Manager for ServerCraft
Handles mod caching for faster subsequent downloads
Cache structure: cached_mods/<game_key>/<mod_id>/
"""

import json
import shutil
import logging
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class ModCacheManager:
    """Manages mod caching for faster downloads after initial fetch"""
    
    def __init__(self, root_path: Path):
        self.root_path = root_path
        self.cache_root = root_path / "cached_mods"
        self.cache_root.mkdir(parents=True, exist_ok=True)
        self.cache_index_file = root_path / "data" / "mod_cache_index.json"
        self._ensure_index()
    
    def _ensure_index(self):
        if not self.cache_index_file.exists():
            self._save_index({"cached_mods": {}, "stats": {"total_cached": 0, "total_size_bytes": 0, "cache_hits": 0}})
    
    def _load_index(self) -> Dict:
        try:
            with open(self.cache_index_file, 'r') as f:
                return json.load(f)
        except Exception:
            return {"cached_mods": {}, "stats": {}}
    
    def _save_index(self, data: Dict):
        with open(self.cache_index_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def get_cache_path(self, game_key: str) -> Path:
        """Get the cache directory for a specific game"""
        path = self.cache_root / game_key
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def is_cached(self, game_key: str, mod_id: str) -> bool:
        """Check if a mod is already cached"""
        cache_path = self.cache_root / game_key / mod_id
        if not cache_path.exists():
            return False
        
        # Verify cache has actual content
        index = self._load_index()
        cache_key = f"{game_key}:{mod_id}"
        entry = index.get("cached_mods", {}).get(cache_key)
        
        return entry is not None and cache_path.exists() and any(cache_path.iterdir())
    
    def get_cached_mod_info(self, game_key: str, mod_id: str) -> Optional[Dict]:
        """Get info about a cached mod"""
        index = self._load_index()
        cache_key = f"{game_key}:{mod_id}"
        entry = index.get("cached_mods", {}).get(cache_key)
        
        if entry and self.is_cached(game_key, mod_id):
            return entry
        return None
    
    def cache_mod(self, game_key: str, mod_id: str, source_path: Path) -> Dict:
        """Cache a downloaded mod by copying it to the cache directory"""
        if not source_path.exists():
            return {"success": False, "error": "Source mod path does not exist"}
        
        cache_path = self.cache_root / game_key / mod_id
        
        try:
            # Remove old cache if exists
            if cache_path.exists():
                shutil.rmtree(cache_path)
            
            # Copy mod to cache
            shutil.copytree(source_path, cache_path)
            
            # Calculate size
            total_size = sum(f.stat().st_size for f in cache_path.rglob('*') if f.is_file())
            
            # Update index
            index = self._load_index()
            cache_key = f"{game_key}:{mod_id}"
            index.setdefault("cached_mods", {})[cache_key] = {
                "game_key": game_key,
                "mod_id": mod_id,
                "cached_at": datetime.now(timezone.utc).isoformat(),
                "size_bytes": total_size,
                "size_mb": round(total_size / (1024 * 1024), 2),
                "file_count": sum(1 for _ in cache_path.rglob('*') if _.is_file()),
                "cache_path": str(cache_path)
            }
            
            # Update stats
            stats = index.setdefault("stats", {})
            stats["total_cached"] = len(index["cached_mods"])
            stats["total_size_bytes"] = sum(e.get("size_bytes", 0) for e in index["cached_mods"].values())
            
            self._save_index(index)
            
            logger.info(f"Cached mod {mod_id} for {game_key} ({total_size / (1024*1024):.1f} MB)")
            return {"success": True, "size_mb": round(total_size / (1024*1024), 2)}
            
        except Exception as e:
            logger.error(f"Failed to cache mod {mod_id}: {e}")
            return {"success": False, "error": str(e)}
    
    def restore_from_cache(self, game_key: str, mod_id: str, target_path: Path) -> Dict:
        """Restore a mod from cache to the target directory"""
        cache_path = self.cache_root / game_key / mod_id
        
        if not cache_path.exists() or not any(cache_path.iterdir()):
            return {"success": False, "error": "Mod not in cache", "from_cache": False}
        
        try:
            target_mod_path = target_path / mod_id
            
            if target_mod_path.exists():
                shutil.rmtree(target_mod_path)
            
            # Copy from cache
            shutil.copytree(cache_path, target_mod_path)
            
            # Update cache hit stats
            index = self._load_index()
            stats = index.setdefault("stats", {})
            stats["cache_hits"] = stats.get("cache_hits", 0) + 1
            self._save_index(index)
            
            logger.info(f"Restored mod {mod_id} from cache for {game_key}")
            return {"success": True, "from_cache": True, "message": "Restored from cache"}
            
        except Exception as e:
            logger.error(f"Failed to restore mod {mod_id} from cache: {e}")
            return {"success": False, "error": str(e), "from_cache": False}
    
    def get_cache_stats(self) -> Dict:
        """Get overall cache statistics"""
        index = self._load_index()
        cached_mods = index.get("cached_mods", {})
        stats = index.get("stats", {})
        
        # Group by game
        games = {}
        for cache_key, entry in cached_mods.items():
            game_key = entry.get("game_key", "unknown")
            if game_key not in games:
                games[game_key] = {"count": 0, "size_bytes": 0}
            games[game_key]["count"] += 1
            games[game_key]["size_bytes"] += entry.get("size_bytes", 0)
        
        # Convert sizes
        for game_key in games:
            games[game_key]["size_mb"] = round(games[game_key]["size_bytes"] / (1024 * 1024), 2)
        
        total_size = stats.get("total_size_bytes", 0)
        
        return {
            "total_cached": len(cached_mods),
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "total_size_gb": round(total_size / (1024 * 1024 * 1024), 3),
            "cache_hits": stats.get("cache_hits", 0),
            "games": games,
            "cache_path": str(self.cache_root)
        }
    
    def get_cached_mods_for_game(self, game_key: str) -> List[Dict]:
        """Get all cached mods for a specific game"""
        index = self._load_index()
        mods = []
        for cache_key, entry in index.get("cached_mods", {}).items():
            if entry.get("game_key") == game_key:
                mods.append(entry)
        return mods
    
    def clear_cache(self, game_key: str = None) -> Dict:
        """Clear cache for a specific game or all games"""
        index = self._load_index()
        
        if game_key:
            # Clear specific game cache
            cache_path = self.cache_root / game_key
            if cache_path.exists():
                shutil.rmtree(cache_path)
                cache_path.mkdir(parents=True, exist_ok=True)
            
            # Remove from index
            to_remove = [k for k, v in index.get("cached_mods", {}).items() if v.get("game_key") == game_key]
            for key in to_remove:
                del index["cached_mods"][key]
        else:
            # Clear all cache
            if self.cache_root.exists():
                shutil.rmtree(self.cache_root)
                self.cache_root.mkdir(parents=True, exist_ok=True)
            index["cached_mods"] = {}
        
        # Update stats
        stats = index.setdefault("stats", {})
        stats["total_cached"] = len(index.get("cached_mods", {}))
        stats["total_size_bytes"] = sum(e.get("size_bytes", 0) for e in index.get("cached_mods", {}).values())
        
        self._save_index(index)
        
        return {"success": True, "message": f"Cache cleared {'for ' + game_key if game_key else 'completely'}"}
    
    def remove_cached_mod(self, game_key: str, mod_id: str) -> Dict:
        """Remove a single mod from cache"""
        cache_path = self.cache_root / game_key / mod_id
        
        if cache_path.exists():
            shutil.rmtree(cache_path)
        
        index = self._load_index()
        cache_key = f"{game_key}:{mod_id}"
        if cache_key in index.get("cached_mods", {}):
            del index["cached_mods"][cache_key]
            stats = index.setdefault("stats", {})
            stats["total_cached"] = len(index["cached_mods"])
            stats["total_size_bytes"] = sum(e.get("size_bytes", 0) for e in index["cached_mods"].values())
            self._save_index(index)
        
        return {"success": True}
