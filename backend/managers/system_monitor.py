"""System Monitor - Real-time system resource monitoring"""

import psutil
import platform
import logging
from typing import Dict, List
from datetime import datetime, timezone
import asyncio

logger = logging.getLogger(__name__)


class SystemMonitor:
    def __init__(self):
        self._history_size = 60  # Keep 60 data points (1 minute at 1s intervals)
        self._cpu_history: List[float] = []
        self._memory_history: List[float] = []
        self._network_history: List[Dict] = []
        self._last_net_io = None
        self._last_net_time = None
    
    def get_stats(self) -> Dict:
        """Get current system statistics"""
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()
            
            # Memory
            memory = psutil.virtual_memory()
            
            # Disk
            disk = psutil.disk_usage('/')
            
            # Network
            net_io = psutil.net_io_counters()
            net_speed = self._calculate_network_speed(net_io)
            
            # Update history
            self._update_history(cpu_percent, memory.percent)
            
            return {
                "cpu": {
                    "percent": cpu_percent,
                    "cores": cpu_count,
                    "frequency_mhz": cpu_freq.current if cpu_freq else 0,
                    "history": self._cpu_history[-30:]  # Last 30 points
                },
                "memory": {
                    "percent": memory.percent,
                    "used_gb": round(memory.used / (1024 ** 3), 2),
                    "total_gb": round(memory.total / (1024 ** 3), 2),
                    "available_gb": round(memory.available / (1024 ** 3), 2),
                    "history": self._memory_history[-30:]
                },
                "disk": {
                    "percent": disk.percent,
                    "used_gb": round(disk.used / (1024 ** 3), 2),
                    "total_gb": round(disk.total / (1024 ** 3), 2),
                    "free_gb": round(disk.free / (1024 ** 3), 2)
                },
                "network": {
                    "bytes_sent": net_io.bytes_sent,
                    "bytes_recv": net_io.bytes_recv,
                    "upload_speed_mbps": round(net_speed["upload"] / (1024 * 1024), 2),
                    "download_speed_mbps": round(net_speed["download"] / (1024 * 1024), 2)
                },
                "system": {
                    "platform": platform.system(),
                    "platform_release": platform.release(),
                    "platform_version": platform.version(),
                    "architecture": platform.machine(),
                    "hostname": platform.node(),
                    "python_version": platform.python_version()
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        except Exception as e:
            logger.error(f"Failed to get system stats: {e}")
            return {"error": str(e)}
    
    def _calculate_network_speed(self, current_io) -> Dict:
        """Calculate network speed in bytes per second"""
        now = datetime.now()
        
        if self._last_net_io is None or self._last_net_time is None:
            self._last_net_io = current_io
            self._last_net_time = now
            return {"upload": 0, "download": 0}
        
        time_delta = (now - self._last_net_time).total_seconds()
        
        if time_delta == 0:
            return {"upload": 0, "download": 0}
        
        upload_speed = (current_io.bytes_sent - self._last_net_io.bytes_sent) / time_delta
        download_speed = (current_io.bytes_recv - self._last_net_io.bytes_recv) / time_delta
        
        self._last_net_io = current_io
        self._last_net_time = now
        
        return {
            "upload": max(0, upload_speed),
            "download": max(0, download_speed)
        }
    
    def _update_history(self, cpu_percent: float, memory_percent: float):
        """Update history arrays"""
        self._cpu_history.append(cpu_percent)
        self._memory_history.append(memory_percent)
        
        # Trim to history size
        if len(self._cpu_history) > self._history_size:
            self._cpu_history = self._cpu_history[-self._history_size:]
        if len(self._memory_history) > self._history_size:
            self._memory_history = self._memory_history[-self._history_size:]
    
    def get_process_list(self, top_n: int = 10) -> List[Dict]:
        """Get top N processes by CPU/Memory usage"""
        processes = []
        
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    pinfo = proc.info
                    processes.append({
                        "pid": pinfo['pid'],
                        "name": pinfo['name'],
                        "cpu_percent": pinfo['cpu_percent'] or 0,
                        "memory_percent": pinfo['memory_percent'] or 0
                    })
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            # Sort by CPU usage
            processes.sort(key=lambda x: x['cpu_percent'], reverse=True)
            return processes[:top_n]
        
        except Exception as e:
            logger.error(f"Failed to get process list: {e}")
            return []
    
    def get_disk_io(self) -> Dict:
        """Get disk I/O statistics"""
        try:
            disk_io = psutil.disk_io_counters()
            return {
                "read_bytes": disk_io.read_bytes,
                "write_bytes": disk_io.write_bytes,
                "read_count": disk_io.read_count,
                "write_count": disk_io.write_count
            }
        except Exception as e:
            logger.error(f"Failed to get disk I/O: {e}")
            return {}
