"""Cluster Manager for ServerCraft
Handles node clustering, resource pooling, port allocation, and UDP node discovery
"""

import json
import uuid
import asyncio
import aiohttp
import socket
import struct
import threading
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

# UDP Discovery Constants
DISCOVERY_PORT = 19847
DISCOVERY_MAGIC = b"SERVERCRAFT_DISCOVERY"
DISCOVERY_TIMEOUT = 3  # seconds

class ClusterManager:
    """Manages node clusters, resources, and port allocations"""
    
    # Resource tag colors (matching frontend)
    RESOURCE_TAGS = {
        "cpu": {"name": "CPU", "color": "#3b82f6"},      # Blue
        "ram": {"name": "RAM", "color": "#22c55e"},      # Green
        "storage": {"name": "Storage", "color": "#a855f7"}, # Purple
        "ports": {"name": "Ports", "color": "#f97316"},  # Orange
        "master": {"name": "Master", "color": "#eab308"}, # Yellow
        "worker": {"name": "Worker", "color": "#6b7280"}  # Gray
    }
    
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.clusters_file = data_path / "clusters.json"
        self.nodes_file = data_path / "nodes.json"
        self.ports_file = data_path / "port_allocations.json"
        self.storage_file = data_path / "storage_paths.json"
        self.discovery_file = data_path / "discovered_nodes.json"
        self._ensure_files()
        
        # Discovery service state
        self._discovery_running = False
        self._discovery_thread = None
        self._discovered_nodes: List[Dict] = []
    
    def _ensure_files(self):
        """Create data files if they don't exist"""
        if not self.clusters_file.exists():
            self._save_json(self.clusters_file, {"clusters": []})
        if not self.nodes_file.exists():
            self._save_json(self.nodes_file, {"nodes": []})
        if not self.ports_file.exists():
            self._save_json(self.ports_file, {"allocations": []})
        if not self.storage_file.exists():
            self._save_json(self.storage_file, {"paths": []})
        if not self.discovery_file.exists():
            self._save_json(self.discovery_file, {"discovered": [], "last_scan": None})
    
    def _load_json(self, filepath: Path) -> Dict:
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except:
            return {}
    
    def _save_json(self, filepath: Path, data: Dict):
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    # ==================== CLUSTER OPERATIONS ====================
    
    def get_clusters(self) -> List[Dict]:
        """Get all clusters with their nodes and resources"""
        data = self._load_json(self.clusters_file)
        clusters = data.get("clusters", [])
        
        # Enrich with node data
        for cluster in clusters:
            cluster["nodes"] = self.get_nodes_by_cluster(cluster["id"])
            cluster["node_count"] = len(cluster["nodes"])
            cluster["resources"] = self._calculate_cluster_resources(cluster["id"])
        
        return clusters
    
    def get_cluster(self, cluster_id: str) -> Optional[Dict]:
        """Get a single cluster by ID"""
        clusters = self.get_clusters()
        for cluster in clusters:
            if cluster["id"] == cluster_id:
                return cluster
        return None
    
    def create_cluster(self, name: str, description: str = "") -> Dict:
        """Create a new cluster"""
        data = self._load_json(self.clusters_file)
        
        cluster = {
            "id": str(uuid.uuid4()),
            "name": name,
            "description": description,
            "master_node_id": None,
            "duckdns": {
                "enabled": False,
                "domain": "",
                "token": "",
                "update_interval": 300  # 5 minutes
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        data["clusters"].append(cluster)
        self._save_json(self.clusters_file, data)
        
        return cluster
    
    def update_cluster(self, cluster_id: str, updates: Dict) -> Optional[Dict]:
        """Update a cluster"""
        data = self._load_json(self.clusters_file)
        
        for i, cluster in enumerate(data["clusters"]):
            if cluster["id"] == cluster_id:
                # Update allowed fields
                allowed_fields = ["name", "description", "duckdns"]
                for field in allowed_fields:
                    if field in updates:
                        data["clusters"][i][field] = updates[field]
                
                data["clusters"][i]["updated_at"] = datetime.now(timezone.utc).isoformat()
                self._save_json(self.clusters_file, data)
                return self.get_cluster(cluster_id)
        
        return None
    
    def delete_cluster(self, cluster_id: str) -> bool:
        """Delete a cluster and all its nodes"""
        data = self._load_json(self.clusters_file)
        
        # Find and remove cluster
        original_length = len(data["clusters"])
        data["clusters"] = [c for c in data["clusters"] if c["id"] != cluster_id]
        
        if len(data["clusters"]) < original_length:
            self._save_json(self.clusters_file, data)
            
            # Remove all nodes in this cluster
            nodes_data = self._load_json(self.nodes_file)
            nodes_data["nodes"] = [n for n in nodes_data["nodes"] if n.get("cluster_id") != cluster_id]
            self._save_json(self.nodes_file, nodes_data)
            
            # Remove port allocations for this cluster
            ports_data = self._load_json(self.ports_file)
            node_ids = [n["id"] for n in self.get_nodes_by_cluster(cluster_id)]
            ports_data["allocations"] = [p for p in ports_data["allocations"] if p.get("node_id") not in node_ids]
            self._save_json(self.ports_file, ports_data)
            
            return True
        
        return False
    
    # ==================== NODE OPERATIONS ====================
    
    def get_nodes_by_cluster(self, cluster_id: str) -> List[Dict]:
        """Get all nodes in a cluster"""
        data = self._load_json(self.nodes_file)
        nodes = [n for n in data.get("nodes", []) if n.get("cluster_id") == cluster_id]
        
        # Enrich with port allocations and storage
        for node in nodes:
            node["port_allocations"] = self.get_port_allocations_by_node(node["id"])
            node["storage_paths"] = self.get_storage_paths_by_node(node["id"])
            node["tags"] = self._get_node_tags(node)
        
        return nodes
    
    def get_node(self, node_id: str) -> Optional[Dict]:
        """Get a single node by ID"""
        data = self._load_json(self.nodes_file)
        for node in data.get("nodes", []):
            if node["id"] == node_id:
                node["port_allocations"] = self.get_port_allocations_by_node(node_id)
                node["storage_paths"] = self.get_storage_paths_by_node(node_id)
                node["tags"] = self._get_node_tags(node)
                return node
        return None
    
    def add_node(self, cluster_id: str, name: str, ip: str, 
                 cpu_cores: int = 0, ram_gb: float = 0, 
                 description: str = "") -> Dict:
        """Add a node to a cluster"""
        data = self._load_json(self.nodes_file)
        clusters_data = self._load_json(self.clusters_file)
        
        # Check if this is the first node (becomes master)
        existing_nodes = [n for n in data.get("nodes", []) if n.get("cluster_id") == cluster_id]
        is_master = len(existing_nodes) == 0
        
        node = {
            "id": str(uuid.uuid4()),
            "cluster_id": cluster_id,
            "name": name,
            "ip": ip,
            "description": description,
            "is_master": is_master,
            "status": "pending",  # pending, online, offline, error
            "cpu_cores": cpu_cores,
            "cpu_threads": cpu_cores * 2,  # Assume hyperthreading
            "ram_gb": ram_gb,
            "last_seen": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        data["nodes"].append(node)
        self._save_json(self.nodes_file, data)
        
        # Update cluster master if this is the first node
        if is_master:
            for i, cluster in enumerate(clusters_data["clusters"]):
                if cluster["id"] == cluster_id:
                    clusters_data["clusters"][i]["master_node_id"] = node["id"]
                    self._save_json(self.clusters_file, clusters_data)
                    break
        
        return node
    
    def update_node(self, node_id: str, updates: Dict) -> Optional[Dict]:
        """Update a node"""
        data = self._load_json(self.nodes_file)
        
        for i, node in enumerate(data["nodes"]):
            if node["id"] == node_id:
                allowed_fields = ["name", "ip", "description", "cpu_cores", "ram_gb", "status"]
                for field in allowed_fields:
                    if field in updates:
                        data["nodes"][i][field] = updates[field]
                
                # Update cpu_threads if cpu_cores changed
                if "cpu_cores" in updates:
                    data["nodes"][i]["cpu_threads"] = updates["cpu_cores"] * 2
                
                self._save_json(self.nodes_file, data)
                return self.get_node(node_id)
        
        return None
    
    def remove_node(self, node_id: str) -> bool:
        """Remove a node from its cluster"""
        data = self._load_json(self.nodes_file)
        
        # Find the node
        node_to_remove = None
        for node in data["nodes"]:
            if node["id"] == node_id:
                node_to_remove = node
                break
        
        if not node_to_remove:
            return False
        
        # Remove the node
        data["nodes"] = [n for n in data["nodes"] if n["id"] != node_id]
        self._save_json(self.nodes_file, data)
        
        # Remove associated port allocations
        ports_data = self._load_json(self.ports_file)
        ports_data["allocations"] = [p for p in ports_data["allocations"] if p.get("node_id") != node_id]
        self._save_json(self.ports_file, ports_data)
        
        # Remove associated storage paths
        storage_data = self._load_json(self.storage_file)
        storage_data["paths"] = [s for s in storage_data["paths"] if s.get("node_id") != node_id]
        self._save_json(self.storage_file, storage_data)
        
        # If this was the master, promote another node
        if node_to_remove.get("is_master"):
            cluster_id = node_to_remove.get("cluster_id")
            remaining_nodes = [n for n in data["nodes"] if n.get("cluster_id") == cluster_id]
            
            if remaining_nodes:
                # Promote first remaining node to master
                new_master_id = remaining_nodes[0]["id"]
                self.set_master_node(cluster_id, new_master_id)
        
        return True
    
    def set_master_node(self, cluster_id: str, node_id: str) -> bool:
        """Set a node as the master of its cluster"""
        nodes_data = self._load_json(self.nodes_file)
        clusters_data = self._load_json(self.clusters_file)
        
        # Update all nodes in the cluster
        for i, node in enumerate(nodes_data["nodes"]):
            if node.get("cluster_id") == cluster_id:
                nodes_data["nodes"][i]["is_master"] = (node["id"] == node_id)
        
        self._save_json(self.nodes_file, nodes_data)
        
        # Update cluster master_node_id
        for i, cluster in enumerate(clusters_data["clusters"]):
            if cluster["id"] == cluster_id:
                clusters_data["clusters"][i]["master_node_id"] = node_id
                self._save_json(self.clusters_file, clusters_data)
                return True
        
        return False
    
    def _get_node_tags(self, node: Dict) -> List[Dict]:
        """Get resource tags for a node"""
        tags = []
        
        if node.get("is_master"):
            tags.append(self.RESOURCE_TAGS["master"])
        else:
            tags.append(self.RESOURCE_TAGS["worker"])
        
        if node.get("cpu_cores", 0) > 0:
            tags.append(self.RESOURCE_TAGS["cpu"])
        
        if node.get("ram_gb", 0) > 0:
            tags.append(self.RESOURCE_TAGS["ram"])
        
        if node.get("storage_paths") and len(node["storage_paths"]) > 0:
            tags.append(self.RESOURCE_TAGS["storage"])
        
        if node.get("port_allocations") and len(node["port_allocations"]) > 0:
            tags.append(self.RESOURCE_TAGS["ports"])
        
        return tags
    
    # ==================== PORT ALLOCATION ====================
    
    def get_port_allocations_by_node(self, node_id: str) -> List[Dict]:
        """Get all port allocations for a node"""
        data = self._load_json(self.ports_file)
        return [p for p in data.get("allocations", []) if p.get("node_id") == node_id]
    
    def get_port_allocations_by_cluster(self, cluster_id: str) -> List[Dict]:
        """Get all port allocations for a cluster"""
        node_ids = [n["id"] for n in self.get_nodes_by_cluster(cluster_id)]
        data = self._load_json(self.ports_file)
        return [p for p in data.get("allocations", []) if p.get("node_id") in node_ids]
    
    def create_port_allocation(self, node_id: str, ip: str, 
                               port_start: int, port_end: int,
                               alias: str = "", notes: str = "") -> Dict:
        """Create a port allocation range for a node (Pterodactyl-style)"""
        data = self._load_json(self.ports_file)
        
        # Validate no overlap with existing allocations
        for alloc in data.get("allocations", []):
            if alloc.get("ip") == ip:
                existing_start = alloc.get("port_start", 0)
                existing_end = alloc.get("port_end", 0)
                
                # Check for overlap
                if not (port_end < existing_start or port_start > existing_end):
                    raise ValueError(f"Port range overlaps with existing allocation: {existing_start}-{existing_end}")
        
        allocation = {
            "id": str(uuid.uuid4()),
            "node_id": node_id,
            "ip": ip,
            "port_start": port_start,
            "port_end": port_end,
            "alias": alias,
            "notes": notes,
            "assigned_servers": [],  # List of server IDs using this allocation
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        data["allocations"].append(allocation)
        self._save_json(self.ports_file, data)
        
        return allocation
    
    def update_port_allocation(self, allocation_id: str, updates: Dict) -> Optional[Dict]:
        """Update a port allocation"""
        data = self._load_json(self.ports_file)
        
        for i, alloc in enumerate(data["allocations"]):
            if alloc["id"] == allocation_id:
                allowed_fields = ["alias", "notes"]
                for field in allowed_fields:
                    if field in updates:
                        data["allocations"][i][field] = updates[field]
                
                self._save_json(self.ports_file, data)
                return data["allocations"][i]
        
        return None
    
    def delete_port_allocation(self, allocation_id: str) -> bool:
        """Delete a port allocation"""
        data = self._load_json(self.ports_file)
        
        original_length = len(data["allocations"])
        data["allocations"] = [a for a in data["allocations"] if a["id"] != allocation_id]
        
        if len(data["allocations"]) < original_length:
            self._save_json(self.ports_file, data)
            return True
        
        return False
    
    def get_available_ports(self, cluster_id: str, count: int = 1) -> List[Dict]:
        """Find available ports across the cluster"""
        allocations = self.get_port_allocations_by_cluster(cluster_id)
        available = []
        
        for alloc in allocations:
            assigned_ports = set()
            for server in alloc.get("assigned_servers", []):
                if isinstance(server, dict):
                    assigned_ports.add(server.get("port"))
            
            for port in range(alloc["port_start"], alloc["port_end"] + 1):
                if port not in assigned_ports:
                    available.append({
                        "allocation_id": alloc["id"],
                        "node_id": alloc["node_id"],
                        "ip": alloc["ip"],
                        "port": port
                    })
                    if len(available) >= count:
                        return available
        
        return available
    
    # ==================== STORAGE PATHS ====================
    
    def get_storage_paths_by_node(self, node_id: str) -> List[Dict]:
        """Get all storage paths for a node"""
        data = self._load_json(self.storage_file)
        return [s for s in data.get("paths", []) if s.get("node_id") == node_id]
    
    def add_storage_path(self, node_id: str, path: str, 
                         storage_type: str = "local",
                         total_gb: float = 0, alias: str = "") -> Dict:
        """Add a storage path to a node"""
        data = self._load_json(self.storage_file)
        
        storage = {
            "id": str(uuid.uuid4()),
            "node_id": node_id,
            "path": path,
            "type": storage_type,  # local, nfs, smb, iscsi
            "alias": alias,
            "total_gb": total_gb,
            "used_gb": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        data["paths"].append(storage)
        self._save_json(self.storage_file, data)
        
        return storage
    
    def update_storage_path(self, storage_id: str, updates: Dict) -> Optional[Dict]:
        """Update a storage path"""
        data = self._load_json(self.storage_file)
        
        for i, storage in enumerate(data["paths"]):
            if storage["id"] == storage_id:
                allowed_fields = ["path", "type", "alias", "total_gb", "used_gb"]
                for field in allowed_fields:
                    if field in updates:
                        data["paths"][i][field] = updates[field]
                
                self._save_json(self.storage_file, data)
                return data["paths"][i]
        
        return None
    
    def delete_storage_path(self, storage_id: str) -> bool:
        """Delete a storage path"""
        data = self._load_json(self.storage_file)
        
        original_length = len(data["paths"])
        data["paths"] = [s for s in data["paths"] if s["id"] != storage_id]
        
        if len(data["paths"]) < original_length:
            self._save_json(self.storage_file, data)
            return True
        
        return False
    
    # ==================== RESOURCE AGGREGATION ====================
    
    def _calculate_cluster_resources(self, cluster_id: str) -> Dict:
        """Calculate total resources across all nodes in a cluster"""
        nodes = self.get_nodes_by_cluster(cluster_id)
        
        total_cpu_cores = 0
        total_cpu_threads = 0
        total_ram_gb = 0
        total_storage_gb = 0
        total_ports = 0
        online_nodes = 0
        
        for node in nodes:
            total_cpu_cores += node.get("cpu_cores", 0)
            total_cpu_threads += node.get("cpu_threads", 0)
            total_ram_gb += node.get("ram_gb", 0)
            
            if node.get("status") == "online":
                online_nodes += 1
            
            # Sum storage
            for storage in node.get("storage_paths", []):
                total_storage_gb += storage.get("total_gb", 0)
            
            # Count available ports
            for alloc in node.get("port_allocations", []):
                port_range = alloc.get("port_end", 0) - alloc.get("port_start", 0) + 1
                total_ports += port_range
        
        return {
            "total_cpu_cores": total_cpu_cores,
            "total_cpu_threads": total_cpu_threads,
            "total_ram_gb": total_ram_gb,
            "total_storage_gb": total_storage_gb,
            "total_ports": total_ports,
            "total_nodes": len(nodes),
            "online_nodes": online_nodes
        }
    
    # ==================== NODE HEALTH CHECK ====================
    
    async def check_node_health(self, node_id: str) -> Dict:
        """Check if a node is online and get its current stats"""
        node = self.get_node(node_id)
        if not node:
            return {"status": "error", "message": "Node not found"}
        
        try:
            async with aiohttp.ClientSession() as session:
                # Try to reach the node's ServerCraft API
                url = f"http://{node['ip']}:8001/api/stats/system"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    if response.status == 200:
                        stats = await response.json()
                        
                        # Update node status
                        self.update_node(node_id, {"status": "online"})
                        
                        # Update last_seen
                        nodes_data = self._load_json(self.nodes_file)
                        for i, n in enumerate(nodes_data["nodes"]):
                            if n["id"] == node_id:
                                nodes_data["nodes"][i]["last_seen"] = datetime.now(timezone.utc).isoformat()
                                self._save_json(self.nodes_file, nodes_data)
                                break
                        
                        return {
                            "status": "online",
                            "stats": stats
                        }
                    else:
                        self.update_node(node_id, {"status": "error"})
                        return {"status": "error", "message": f"HTTP {response.status}"}
        
        except asyncio.TimeoutError:
            self.update_node(node_id, {"status": "offline"})
            return {"status": "offline", "message": "Connection timeout"}
        except Exception as e:
            self.update_node(node_id, {"status": "error"})
            return {"status": "error", "message": str(e)}
    
    async def check_cluster_health(self, cluster_id: str) -> Dict:
        """Check health of all nodes in a cluster"""
        nodes = self.get_nodes_by_cluster(cluster_id)
        results = {}
        
        for node in nodes:
            results[node["id"]] = await self.check_node_health(node["id"])
        
        return results
    
    # ==================== RESOURCE TAGS ====================
    
    def get_resource_tags(self) -> Dict:
        """Get all available resource tags with colors"""
        return self.RESOURCE_TAGS
    
    # ==================== UDP NODE DISCOVERY ====================
    
    def _get_broadcast_addresses(self) -> List[str]:
        """Get all broadcast addresses for local network interfaces"""
        broadcast_addrs = []
        try:
            # Get all network interfaces
            import netifaces
            for iface in netifaces.interfaces():
                addrs = netifaces.ifaddresses(iface)
                if netifaces.AF_INET in addrs:
                    for addr in addrs[netifaces.AF_INET]:
                        if 'broadcast' in addr:
                            broadcast_addrs.append(addr['broadcast'])
        except ImportError:
            # Fallback if netifaces not available - use common broadcast
            broadcast_addrs = ['192.168.1.255', '192.168.0.255', '10.0.0.255', '172.16.0.255']
        
        # Always include limited broadcast
        broadcast_addrs.append('255.255.255.255')
        return list(set(broadcast_addrs))
    
    def _get_local_node_info(self) -> Dict:
        """Get this node's info for discovery response"""
        hostname = socket.gethostname()
        try:
            local_ip = socket.gethostbyname(hostname)
        except:
            local_ip = "127.0.0.1"
        
        return {
            "hostname": hostname,
            "ip": local_ip,
            "port": 8001,
            "version": "2026.1.6.44D",
            "discovered_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def discover_local_nodes(self, timeout: float = DISCOVERY_TIMEOUT) -> List[Dict]:
        """
        Scan local network for other ServerCraft nodes using UDP broadcast.
        Returns list of discovered nodes with their info.
        """
        discovered = []
        responses = []
        
        # Create UDP socket for broadcast
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.settimeout(0.5)  # Short timeout for recv
        
        try:
            # Send discovery broadcast to all interfaces
            discovery_msg = json.dumps({
                "type": "SERVERCRAFT_DISCOVER",
                "version": "2026.1.6.44D",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }).encode('utf-8')
            
            broadcast_addrs = self._get_broadcast_addresses()
            for addr in broadcast_addrs:
                try:
                    sock.sendto(discovery_msg, (addr, DISCOVERY_PORT))
                except:
                    pass
            
            # Also try direct HTTP probe to common subnet IPs
            local_ip = self._get_local_node_info()["ip"]
            subnet_base = '.'.join(local_ip.split('.')[:3])
            
            # Listen for responses
            start_time = asyncio.get_event_loop().time()
            while (asyncio.get_event_loop().time() - start_time) < timeout:
                try:
                    data, addr = sock.recvfrom(1024)
                    try:
                        response = json.loads(data.decode('utf-8'))
                        if response.get("type") == "SERVERCRAFT_RESPONSE":
                            node_info = {
                                "ip": addr[0],
                                "hostname": response.get("hostname", "Unknown"),
                                "port": response.get("port", 8001),
                                "version": response.get("version", "Unknown"),
                                "status": "discovered",
                                "discovered_at": datetime.now(timezone.utc).isoformat()
                            }
                            # Avoid duplicates
                            if not any(n["ip"] == node_info["ip"] for n in discovered):
                                discovered.append(node_info)
                    except json.JSONDecodeError:
                        pass
                except socket.timeout:
                    await asyncio.sleep(0.1)
                    continue
                except Exception:
                    break
            
            # Also probe common subnet IPs via HTTP (fallback)
            http_discovered = await self._http_probe_subnet(subnet_base)
            for node in http_discovered:
                if not any(n["ip"] == node["ip"] for n in discovered):
                    discovered.append(node)
        
        finally:
            sock.close()
        
        # Save discovered nodes
        self._discovered_nodes = discovered
        self._save_json(self.discovery_file, {
            "discovered": discovered,
            "last_scan": datetime.now(timezone.utc).isoformat()
        })
        
        return discovered
    
    async def _http_probe_subnet(self, subnet_base: str, port: int = 8001) -> List[Dict]:
        """Probe subnet IPs via HTTP to find ServerCraft instances"""
        discovered = []
        
        async def probe_ip(ip: str) -> Optional[Dict]:
            try:
                async with aiohttp.ClientSession() as session:
                    url = f"http://{ip}:{port}/api/discovery/info"
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=1)) as response:
                        if response.status == 200:
                            data = await response.json()
                            return {
                                "ip": ip,
                                "hostname": data.get("hostname", "Unknown"),
                                "port": data.get("port", port),
                                "version": data.get("version", "Unknown"),
                                "device_id": data.get("device_id"),
                                "status": "online",
                                "discovered_at": datetime.now(timezone.utc).isoformat()
                            }
            except:
                pass
            return None
        
        # Probe common IPs in subnet (1-254)
        tasks = []
        for i in range(1, 255):
            ip = f"{subnet_base}.{i}"
            tasks.append(probe_ip(ip))
        
        # Run probes concurrently with limit
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in results:
            if isinstance(result, dict) and result is not None:
                discovered.append(result)
        
        return discovered
    
    def start_discovery_listener(self):
        """Start UDP listener for discovery broadcasts (runs in background)"""
        if self._discovery_running:
            return
        
        self._discovery_running = True
        self._discovery_thread = threading.Thread(target=self._discovery_listener_loop, daemon=True)
        self._discovery_thread.start()
    
    def stop_discovery_listener(self):
        """Stop UDP discovery listener"""
        self._discovery_running = False
        if self._discovery_thread:
            self._discovery_thread.join(timeout=2)
    
    def _discovery_listener_loop(self):
        """Background loop listening for discovery broadcasts"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.settimeout(1.0)
        
        try:
            sock.bind(('', DISCOVERY_PORT))
            
            while self._discovery_running:
                try:
                    data, addr = sock.recvfrom(1024)
                    try:
                        msg = json.loads(data.decode('utf-8'))
                        if msg.get("type") == "SERVERCRAFT_DISCOVER":
                            # Respond to discovery request
                            response = json.dumps({
                                "type": "SERVERCRAFT_RESPONSE",
                                **self._get_local_node_info()
                            }).encode('utf-8')
                            sock.sendto(response, addr)
                    except:
                        pass
                except socket.timeout:
                    continue
                except Exception as e:
                    print(f"Discovery listener error: {e}")
                    break
        finally:
            sock.close()
    
    def get_discovery_status(self) -> Dict:
        """Get current discovery service status"""
        data = self._load_json(self.discovery_file)
        return {
            "listener_running": self._discovery_running,
            "last_scan": data.get("last_scan"),
            "discovered_count": len(data.get("discovered", [])),
            "discovered_nodes": data.get("discovered", [])
        }
    
    def get_discovered_nodes(self) -> List[Dict]:
        """Get previously discovered nodes"""
        data = self._load_json(self.discovery_file)
        return data.get("discovered", [])
