"""UPnP Manager - Handles automatic port forwarding"""

import asyncio
import logging
import socket
from typing import Dict, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Try to import miniupnpc (optional dependency)
try:
    import miniupnpc
    UPNP_AVAILABLE = True
except ImportError:
    UPNP_AVAILABLE = False
    logger.warning("miniupnpc not available - UPnP features disabled")


class UPnPManager:
    def __init__(self):
        self._upnp = None
        self._mappings: Dict[str, Dict] = {}
        self._available = UPNP_AVAILABLE
        self._initialized = False
        self._external_ip = None
        self._gateway = None
    
    def _init_upnp(self) -> bool:
        """Initialize UPnP client"""
        if not self._available:
            return False
        
        if self._initialized:
            return True
        
        try:
            self._upnp = miniupnpc.UPnP()
            self._upnp.discoverdelay = 200
            
            # Discover UPnP devices
            devices = self._upnp.discover()
            logger.info(f"Found {devices} UPnP device(s)")
            
            if devices > 0:
                # Select IGD (Internet Gateway Device)
                self._upnp.selectigd()
                self._external_ip = self._upnp.externalipaddress()
                self._gateway = self._upnp.lanaddr
                self._initialized = True
                logger.info(f"UPnP initialized - External IP: {self._external_ip}")
                return True
            else:
                logger.warning("No UPnP devices found")
                return False
                
        except Exception as e:
            logger.error(f"Failed to initialize UPnP: {e}")
            return False
    
    def get_status(self) -> Dict:
        """Get UPnP status"""
        if not self._available:
            return {
                "available": False,
                "message": "UPnP library not installed (miniupnpc)"
            }
        
        initialized = self._init_upnp()
        
        return {
            "available": self._available,
            "initialized": initialized,
            "external_ip": self._external_ip,
            "gateway": self._gateway,
            "active_mappings": len(self._mappings)
        }
    
    async def add_port_mapping(
        self,
        port: int,
        protocol: str = "UDP",
        description: str = "ServerCraft"
    ) -> Dict:
        """Add a port mapping"""
        if not self._available:
            return {"success": False, "error": "UPnP not available"}
        
        if not self._init_upnp():
            return {"success": False, "error": "Failed to initialize UPnP"}
        
        try:
            # Get local IP
            local_ip = self._get_local_ip()
            
            # Add port mapping
            result = self._upnp.addportmapping(
                port,           # External port
                protocol,       # Protocol (TCP/UDP)
                local_ip,       # Internal IP
                port,           # Internal port
                description,    # Description
                ''              # Remote host (empty = any)
            )
            
            if result:
                mapping_key = f"{port}/{protocol}"
                self._mappings[mapping_key] = {
                    "port": port,
                    "protocol": protocol,
                    "local_ip": local_ip,
                    "external_ip": self._external_ip,
                    "description": description,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                logger.info(f"Added UPnP port mapping: {port}/{protocol}")
                return {
                    "success": True,
                    "external_ip": self._external_ip,
                    "port": port,
                    "protocol": protocol
                }
            else:
                return {"success": False, "error": "Failed to add port mapping"}
            
        except Exception as e:
            logger.error(f"Failed to add port mapping: {e}")
            return {"success": False, "error": str(e)}
    
    async def remove_port_mapping(self, port: int, protocol: str = "UDP") -> Dict:
        """Remove a port mapping"""
        if not self._available:
            return {"success": False, "error": "UPnP not available"}
        
        if not self._init_upnp():
            return {"success": False, "error": "Failed to initialize UPnP"}
        
        try:
            self._upnp.deleteportmapping(port, protocol)
            
            mapping_key = f"{port}/{protocol}"
            if mapping_key in self._mappings:
                del self._mappings[mapping_key]
            
            logger.info(f"Removed UPnP port mapping: {port}/{protocol}")
            return {"success": True, "port": port, "protocol": protocol}
            
        except Exception as e:
            logger.error(f"Failed to remove port mapping: {e}")
            return {"success": False, "error": str(e)}
    
    def get_mappings(self) -> List[Dict]:
        """Get all active port mappings"""
        return list(self._mappings.values())
    
    def _get_local_ip(self) -> str:
        """Get local IP address"""
        try:
            # Connect to external address to determine local IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except Exception:
            return "127.0.0.1"
    
    async def add_server_ports(self, server: Dict) -> Dict:
        """Add all required port mappings for a server"""
        results = []
        
        # Main game port (usually UDP)
        main_result = await self.add_port_mapping(
            server.get("port"),
            "UDP",
            f"ServerCraft - {server.get('name')} Game"
        )
        results.append(main_result)
        
        # Query port (usually UDP)
        if server.get("query_port"):
            query_result = await self.add_port_mapping(
                server.get("query_port"),
                "UDP",
                f"ServerCraft - {server.get('name')} Query"
            )
            results.append(query_result)
        
        # RCON port (usually TCP)
        if server.get("rcon_port"):
            rcon_result = await self.add_port_mapping(
                server.get("rcon_port"),
                "TCP",
                f"ServerCraft - {server.get('name')} RCON"
            )
            results.append(rcon_result)
        
        return {
            "success": all(r.get("success") for r in results),
            "results": results
        }
    
    async def remove_server_ports(self, server: Dict) -> Dict:
        """Remove all port mappings for a server"""
        results = []
        
        results.append(await self.remove_port_mapping(server.get("port"), "UDP"))
        
        if server.get("query_port"):
            results.append(await self.remove_port_mapping(server.get("query_port"), "UDP"))
        
        if server.get("rcon_port"):
            results.append(await self.remove_port_mapping(server.get("rcon_port"), "TCP"))
        
        return {
            "success": all(r.get("success") for r in results),
            "results": results
        }
