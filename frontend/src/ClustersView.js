/**
 * ClustersView Component for ServerCraft
 * Manages Node Clustering, Port Allocations, Storage, and DuckDNS
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Resource tag colors
const TAG_COLORS = {
    cpu: '#3b82f6',      // Blue
    ram: '#22c55e',      // Green
    storage: '#a855f7',  // Purple
    ports: '#f97316',    // Orange
    master: '#eab308',   // Yellow
    worker: '#6b7280'    // Gray
};

function ClustersView({ showToast }) {
    // State
    const [clusters, setClusters] = useState([]);
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [showCreateCluster, setShowCreateCluster] = useState(false);
    const [showAddNode, setShowAddNode] = useState(false);
    const [showAddPorts, setShowAddPorts] = useState(false);
    const [showAddStorage, setShowAddStorage] = useState(false);
    const [showDuckDNS, setShowDuckDNS] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    
    // Form states
    const [clusterForm, setClusterForm] = useState({ name: '', description: '' });
    const [nodeForm, setNodeForm] = useState({ name: '', ip: '', cpu_cores: 0, ram_gb: 0, description: '' });
    const [portForm, setPortForm] = useState({ ip: '', port_start: '', port_end: '', alias: '', notes: '' });
    const [storageForm, setStorageForm] = useState({ path: '', storage_type: 'local', total_gb: 0, alias: '' });
    const [duckdnsForm, setDuckdnsForm] = useState({ domain: '', token: '', update_interval: 300 });
    const [showToken, setShowToken] = useState(false);
    
    // Fetch clusters
    const fetchClusters = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/clusters`);
            if (response.ok) {
                const data = await response.json();
                setClusters(data);
                
                // Update selected cluster if exists
                if (selectedCluster) {
                    const updated = data.find(c => c.id === selectedCluster.id);
                    if (updated) {
                        setSelectedCluster(updated);
                        // Update selected node if exists
                        if (selectedNode) {
                            const updatedNode = updated.nodes?.find(n => n.id === selectedNode.id);
                            setSelectedNode(updatedNode || null);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch clusters:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedCluster, selectedNode]);
    
    useEffect(() => {
        fetchClusters();
        const interval = setInterval(fetchClusters, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchClusters]);
    
    // Cluster CRUD
    const createCluster = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/clusters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clusterForm)
            });
            if (response.ok) {
                showToast('Cluster created successfully', 'success');
                setShowCreateCluster(false);
                setClusterForm({ name: '', description: '' });
                fetchClusters();
            }
        } catch (error) {
            showToast('Failed to create cluster', 'error');
        }
    };
    
    const deleteCluster = async (clusterId) => {
        if (!window.confirm('Delete this cluster and all its nodes?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/clusters/${clusterId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast('Cluster deleted', 'success');
                setSelectedCluster(null);
                setSelectedNode(null);
                fetchClusters();
            }
        } catch (error) {
            showToast('Failed to delete cluster', 'error');
        }
    };
    
    // Node CRUD
    const addNode = async () => {
        if (!selectedCluster) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/clusters/${selectedCluster.id}/nodes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...nodeForm,
                    cpu_cores: parseInt(nodeForm.cpu_cores) || 0,
                    ram_gb: parseFloat(nodeForm.ram_gb) || 0
                })
            });
            if (response.ok) {
                showToast('Node added successfully', 'success');
                setShowAddNode(false);
                setNodeForm({ name: '', ip: '', cpu_cores: 0, ram_gb: 0, description: '' });
                fetchClusters();
            }
        } catch (error) {
            showToast('Failed to add node', 'error');
        }
    };
    
    const removeNode = async (nodeId) => {
        if (!selectedCluster) return;
        if (!window.confirm('Remove this node from the cluster?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/clusters/${selectedCluster.id}/nodes/${nodeId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast('Node removed', 'success');
                if (selectedNode?.id === nodeId) setSelectedNode(null);
                fetchClusters();
            }
        } catch (error) {
            showToast('Failed to remove node', 'error');
        }
    };
    
    const setMasterNode = async (nodeId) => {
        if (!selectedCluster) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/clusters/${selectedCluster.id}/nodes/${nodeId}/set-master`, {
                method: 'POST'
            });
            if (response.ok) {
                showToast('Master node updated', 'success');
                fetchClusters();
            }
        } catch (error) {
            showToast('Failed to update master node', 'error');
        }
    };
    
    // Port Allocation CRUD
    const addPortAllocation = async () => {
        if (!selectedCluster || !selectedNode) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/clusters/${selectedCluster.id}/nodes/${selectedNode.id}/ports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...portForm,
                    port_start: parseInt(portForm.port_start),
                    port_end: parseInt(portForm.port_end)
                })
            });
            if (response.ok) {
                showToast('Port allocation created', 'success');
                setShowAddPorts(false);
                setPortForm({ ip: '', port_start: '', port_end: '', alias: '', notes: '' });
                fetchClusters();
            } else {
                const error = await response.json();
                showToast(error.detail || 'Failed to create port allocation', 'error');
            }
        } catch (error) {
            showToast('Failed to create port allocation', 'error');
        }
    };
    
    const deletePortAllocation = async (allocationId) => {
        if (!selectedCluster) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/clusters/${selectedCluster.id}/ports/${allocationId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast('Port allocation deleted', 'success');
                fetchClusters();
            }
        } catch (error) {
            showToast('Failed to delete port allocation', 'error');
        }
    };
    
    // Storage CRUD
    const addStoragePath = async () => {
        if (!selectedCluster || !selectedNode) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/clusters/${selectedCluster.id}/nodes/${selectedNode.id}/storage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...storageForm,
                    total_gb: parseFloat(storageForm.total_gb) || 0
                })
            });
            if (response.ok) {
                showToast('Storage path added', 'success');
                setShowAddStorage(false);
                setStorageForm({ path: '', storage_type: 'local', total_gb: 0, alias: '' });
                fetchClusters();
            }
        } catch (error) {
            showToast('Failed to add storage path', 'error');
        }
    };
    
    const deleteStoragePath = async (storageId) => {
        if (!selectedCluster) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/clusters/${selectedCluster.id}/storage/${storageId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast('Storage path deleted', 'success');
                fetchClusters();
            }
        } catch (error) {
            showToast('Failed to delete storage path', 'error');
        }
    };
    
    // DuckDNS
    const saveDuckDNS = async () => {
        if (!selectedCluster) return;
        
        try {
            // First test the configuration
            const testResponse = await fetch(`${API_BASE}/api/duckdns/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: duckdnsForm.domain, token: duckdnsForm.token })
            });
            const testResult = await testResponse.json();
            
            if (!testResult.success) {
                showToast('Invalid DuckDNS configuration: ' + testResult.message, 'error');
                return;
            }
            
            // Save configuration
            const response = await fetch(`${API_BASE}/api/duckdns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...duckdnsForm,
                    reference_type: 'cluster',
                    reference_id: selectedCluster.id
                })
            });
            
            if (response.ok) {
                showToast('DuckDNS configuration saved', 'success');
                setShowDuckDNS(false);
                fetchClusters();
            }
        } catch (error) {
            showToast('Failed to save DuckDNS configuration', 'error');
        }
    };
    
    // Mask token display
    const maskToken = (token) => {
        if (!token || token.length <= 4) return '*'.repeat(token?.length || 0);
        return '*'.repeat(token.length - 4) + token.slice(-4);
    };
    
    // Render resource tags
    const renderTags = (tags) => (
        <div className="cluster-tags">
            {tags?.map((tag, i) => (
                <span 
                    key={i} 
                    className="cluster-tag"
                    style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
                >
                    {tag.name}
                </span>
            ))}
        </div>
    );
    
    if (loading) {
        return (
            <div className="view-container clusters-view">
                <div className="loading-state">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Loading clusters...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="view-container clusters-view">
            <div className="view-header">
                <h2><i className="fas fa-network-wired"></i> Node Clusters</h2>
                <button className="btn btn-primary" onClick={() => setShowCreateCluster(true)}>
                    <i className="fas fa-plus"></i> New Cluster
                </button>
            </div>
            
            <div className="clusters-layout">
                {/* Cluster List Sidebar */}
                <div className="clusters-sidebar">
                    <div className="sidebar-header">
                        <h3><i className="fas fa-server"></i> Clusters</h3>
                    </div>
                    
                    {clusters.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-network-wired"></i>
                            <p>No clusters yet</p>
                            <small>Create a cluster to start managing nodes</small>
                        </div>
                    ) : (
                        <div className="clusters-list">
                            {clusters.map(cluster => (
                                <div 
                                    key={cluster.id}
                                    className={`cluster-item ${selectedCluster?.id === cluster.id ? 'active' : ''}`}
                                    onClick={() => { setSelectedCluster(cluster); setSelectedNode(null); }}
                                >
                                    <div className="cluster-item-header">
                                        <span className="cluster-name">{cluster.name}</span>
                                        <span className="cluster-node-count">
                                            <i className="fas fa-server"></i> {cluster.node_count}
                                        </span>
                                    </div>
                                    <div className="cluster-item-stats">
                                        <span><i className="fas fa-microchip"></i> {cluster.resources?.total_cpu_cores || 0} cores</span>
                                        <span><i className="fas fa-memory"></i> {cluster.resources?.total_ram_gb || 0} GB</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Main Content */}
                <div className="clusters-content">
                    {!selectedCluster ? (
                        <div className="empty-state large">
                            <i className="fas fa-hand-pointer"></i>
                            <p>Select a cluster to view details</p>
                        </div>
                    ) : (
                        <>
                            {/* Cluster Header */}
                            <div className="cluster-detail-header">
                                <div className="cluster-info">
                                    <h3>{selectedCluster.name}</h3>
                                    <p>{selectedCluster.description || 'No description'}</p>
                                </div>
                                <div className="cluster-actions">
                                    <button className="btn btn-danger" onClick={() => deleteCluster(selectedCluster.id)}>
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Resource Summary */}
                            <div className="cluster-resources">
                                <div className="resource-card" style={{ borderColor: TAG_COLORS.cpu }}>
                                    <i className="fas fa-microchip" style={{ color: TAG_COLORS.cpu }}></i>
                                    <div className="resource-info">
                                        <span className="resource-value">{selectedCluster.resources?.total_cpu_cores || 0}</span>
                                        <span className="resource-label">CPU Cores</span>
                                    </div>
                                </div>
                                <div className="resource-card" style={{ borderColor: TAG_COLORS.ram }}>
                                    <i className="fas fa-memory" style={{ color: TAG_COLORS.ram }}></i>
                                    <div className="resource-info">
                                        <span className="resource-value">{selectedCluster.resources?.total_ram_gb || 0} GB</span>
                                        <span className="resource-label">RAM</span>
                                    </div>
                                </div>
                                <div className="resource-card" style={{ borderColor: TAG_COLORS.storage }}>
                                    <i className="fas fa-hdd" style={{ color: TAG_COLORS.storage }}></i>
                                    <div className="resource-info">
                                        <span className="resource-value">{selectedCluster.resources?.total_storage_gb || 0} GB</span>
                                        <span className="resource-label">Storage</span>
                                    </div>
                                </div>
                                <div className="resource-card" style={{ borderColor: TAG_COLORS.ports }}>
                                    <i className="fas fa-ethernet" style={{ color: TAG_COLORS.ports }}></i>
                                    <div className="resource-info">
                                        <span className="resource-value">{selectedCluster.resources?.total_ports || 0}</span>
                                        <span className="resource-label">Ports</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Tabs */}
                            <div className="cluster-tabs">
                                <button 
                                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('overview')}
                                >
                                    <i className="fas fa-th-large"></i> Overview
                                </button>
                                <button 
                                    className={`tab-btn ${activeTab === 'nodes' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('nodes')}
                                >
                                    <i className="fas fa-server"></i> Nodes ({selectedCluster.nodes?.length || 0})
                                </button>
                                <button 
                                    className={`tab-btn ${activeTab === 'ports' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('ports')}
                                >
                                    <i className="fas fa-ethernet"></i> Port Allocations
                                </button>
                                <button 
                                    className={`tab-btn ${activeTab === 'storage' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('storage')}
                                >
                                    <i className="fas fa-hdd"></i> Storage
                                </button>
                            </div>
                            
                            {/* Tab Content */}
                            <div className="cluster-tab-content">
                                {activeTab === 'overview' && (
                                    <div className="overview-tab">
                                        <div className="nodes-grid">
                                            {selectedCluster.nodes?.map(node => (
                                                <div key={node.id} className="node-card">
                                                    <div className="node-card-header">
                                                        <h4>{node.name}</h4>
                                                        {renderTags(node.tags)}
                                                    </div>
                                                    <div className="node-card-body">
                                                        <div className="node-stat">
                                                            <span className="stat-label">IP Address</span>
                                                            <span className="stat-value">{node.ip}</span>
                                                        </div>
                                                        <div className="node-stat">
                                                            <span className="stat-label">CPU</span>
                                                            <span className="stat-value">{node.cpu_cores} cores / {node.cpu_threads} threads</span>
                                                        </div>
                                                        <div className="node-stat">
                                                            <span className="stat-label">RAM</span>
                                                            <span className="stat-value">{node.ram_gb} GB</span>
                                                        </div>
                                                        <div className="node-stat">
                                                            <span className="stat-label">Status</span>
                                                            <span className={`status-badge ${node.status}`}>{node.status}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {activeTab === 'nodes' && (
                                    <div className="nodes-tab">
                                        <div className="tab-header">
                                            <h4>Cluster Nodes</h4>
                                            <button className="btn btn-primary btn-sm" onClick={() => setShowAddNode(true)}>
                                                <i className="fas fa-plus"></i> Add Node
                                            </button>
                                        </div>
                                        
                                        <div className="nodes-table">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>IP Address</th>
                                                        <th>CPU</th>
                                                        <th>RAM</th>
                                                        <th>Role</th>
                                                        <th>Status</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedCluster.nodes?.map(node => (
                                                        <tr key={node.id} className={selectedNode?.id === node.id ? 'selected' : ''}>
                                                            <td onClick={() => setSelectedNode(node)} style={{cursor:'pointer'}}>
                                                                <strong>{node.name}</strong>
                                                            </td>
                                                            <td><code>{node.ip}</code></td>
                                                            <td>{node.cpu_cores} / {node.cpu_threads}</td>
                                                            <td>{node.ram_gb} GB</td>
                                                            <td>
                                                                {node.is_master ? (
                                                                    <span className="role-badge master">Master</span>
                                                                ) : (
                                                                    <span className="role-badge worker">Worker</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className={`status-badge ${node.status}`}>{node.status}</span>
                                                            </td>
                                                            <td>
                                                                {!node.is_master && (
                                                                    <button 
                                                                        className="btn btn-xs btn-secondary"
                                                                        onClick={() => setMasterNode(node.id)}
                                                                        title="Promote to Master"
                                                                    >
                                                                        <i className="fas fa-crown"></i>
                                                                    </button>
                                                                )}
                                                                <button 
                                                                    className="btn btn-xs btn-danger"
                                                                    onClick={() => removeNode(node.id)}
                                                                    title="Remove Node"
                                                                >
                                                                    <i className="fas fa-trash"></i>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                
                                {activeTab === 'ports' && (
                                    <div className="ports-tab">
                                        <div className="tab-header">
                                            <h4>Port Allocations</h4>
                                            {selectedNode && (
                                                <button className="btn btn-primary btn-sm" onClick={() => {
                                                    setPortForm({ ...portForm, ip: selectedNode.ip });
                                                    setShowAddPorts(true);
                                                }}>
                                                    <i className="fas fa-plus"></i> Add Ports to {selectedNode.name}
                                                </button>
                                            )}
                                        </div>
                                        
                                        {!selectedNode && (
                                            <div className="info-box">
                                                <i className="fas fa-info-circle"></i>
                                                <p>Select a node from the Nodes tab to add port allocations</p>
                                            </div>
                                        )}
                                        
                                        <div className="ports-table">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Node</th>
                                                        <th>IP Address</th>
                                                        <th>Port Range</th>
                                                        <th>Alias</th>
                                                        <th>Available</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedCluster.nodes?.flatMap(node => 
                                                        node.port_allocations?.map(alloc => (
                                                            <tr key={alloc.id}>
                                                                <td>{node.name}</td>
                                                                <td><code>{alloc.ip}</code></td>
                                                                <td><code>{alloc.port_start} - {alloc.port_end}</code></td>
                                                                <td>{alloc.alias || '-'}</td>
                                                                <td>{alloc.port_end - alloc.port_start + 1 - (alloc.assigned_servers?.length || 0)}</td>
                                                                <td>
                                                                    <button 
                                                                        className="btn btn-xs btn-danger"
                                                                        onClick={() => deletePortAllocation(alloc.id)}
                                                                    >
                                                                        <i className="fas fa-trash"></i>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        )) || []
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                
                                {activeTab === 'storage' && (
                                    <div className="storage-tab">
                                        <div className="tab-header">
                                            <h4>Storage Paths</h4>
                                            {selectedNode && (
                                                <button className="btn btn-primary btn-sm" onClick={() => setShowAddStorage(true)}>
                                                    <i className="fas fa-plus"></i> Add Storage to {selectedNode.name}
                                                </button>
                                            )}
                                        </div>
                                        
                                        {!selectedNode && (
                                            <div className="info-box">
                                                <i className="fas fa-info-circle"></i>
                                                <p>Select a node from the Nodes tab to add storage paths</p>
                                            </div>
                                        )}
                                        
                                        <div className="storage-table">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Node</th>
                                                        <th>Path</th>
                                                        <th>Type</th>
                                                        <th>Total</th>
                                                        <th>Alias</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedCluster.nodes?.flatMap(node => 
                                                        node.storage_paths?.map(storage => (
                                                            <tr key={storage.id}>
                                                                <td>{node.name}</td>
                                                                <td><code>{storage.path}</code></td>
                                                                <td><span className="storage-type-badge">{storage.type.toUpperCase()}</span></td>
                                                                <td>{storage.total_gb} GB</td>
                                                                <td>{storage.alias || '-'}</td>
                                                                <td>
                                                                    <button 
                                                                        className="btn btn-xs btn-danger"
                                                                        onClick={() => deleteStoragePath(storage.id)}
                                                                    >
                                                                        <i className="fas fa-trash"></i>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        )) || []
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            {/* Create Cluster Modal */}
            {showCreateCluster && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3><i className="fas fa-network-wired"></i> Create Cluster</h3>
                            <button className="modal-close" onClick={() => setShowCreateCluster(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Cluster Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={clusterForm.name}
                                    onChange={(e) => setClusterForm({ ...clusterForm, name: e.target.value })}
                                    placeholder="e.g., Main Production Cluster"
                                />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    className="form-input"
                                    value={clusterForm.description}
                                    onChange={(e) => setClusterForm({ ...clusterForm, description: e.target.value })}
                                    placeholder="Optional description..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreateCluster(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={createCluster} disabled={!clusterForm.name}>
                                <i className="fas fa-plus"></i> Create Cluster
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Add Node Modal */}
            {showAddNode && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3><i className="fas fa-server"></i> Add Node</h3>
                            <button className="modal-close" onClick={() => setShowAddNode(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Node Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={nodeForm.name}
                                    onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })}
                                    placeholder="e.g., Node-01"
                                />
                            </div>
                            <div className="form-group">
                                <label>IP Address</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={nodeForm.ip}
                                    onChange={(e) => setNodeForm({ ...nodeForm, ip: e.target.value })}
                                    placeholder="e.g., 192.168.1.100"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>CPU Cores</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={nodeForm.cpu_cores}
                                        onChange={(e) => setNodeForm({ ...nodeForm, cpu_cores: e.target.value })}
                                        placeholder="e.g., 16"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>RAM (GB)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={nodeForm.ram_gb}
                                        onChange={(e) => setNodeForm({ ...nodeForm, ram_gb: e.target.value })}
                                        placeholder="e.g., 64"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={nodeForm.description}
                                    onChange={(e) => setNodeForm({ ...nodeForm, description: e.target.value })}
                                    placeholder="Optional description..."
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddNode(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={addNode} disabled={!nodeForm.name || !nodeForm.ip}>
                                <i className="fas fa-plus"></i> Add Node
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Add Ports Modal */}
            {showAddPorts && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3><i className="fas fa-ethernet"></i> Add Port Allocation</h3>
                            <button className="modal-close" onClick={() => setShowAddPorts(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="info-box">
                                <i className="fas fa-info-circle"></i>
                                <p>Pterodactyl-style port allocation: Assign an IP and port range to this node.</p>
                            </div>
                            <div className="form-group">
                                <label>IP Address</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={portForm.ip}
                                    onChange={(e) => setPortForm({ ...portForm, ip: e.target.value })}
                                    placeholder="e.g., 192.168.1.100"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Port Start</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={portForm.port_start}
                                        onChange={(e) => setPortForm({ ...portForm, port_start: e.target.value })}
                                        placeholder="e.g., 2302"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Port End</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={portForm.port_end}
                                        onChange={(e) => setPortForm({ ...portForm, port_end: e.target.value })}
                                        placeholder="e.g., 2397"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Alias</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={portForm.alias}
                                    onChange={(e) => setPortForm({ ...portForm, alias: e.target.value })}
                                    placeholder="e.g., Arma 3 Server Ports"
                                />
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea
                                    className="form-input"
                                    value={portForm.notes}
                                    onChange={(e) => setPortForm({ ...portForm, notes: e.target.value })}
                                    placeholder="Optional notes..."
                                    rows={2}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddPorts(false)}>Cancel</button>
                            <button 
                                className="btn btn-primary" 
                                onClick={addPortAllocation} 
                                disabled={!portForm.ip || !portForm.port_start || !portForm.port_end}
                            >
                                <i className="fas fa-plus"></i> Add Ports
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Add Storage Modal */}
            {showAddStorage && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3><i className="fas fa-hdd"></i> Add Storage Path</h3>
                            <button className="modal-close" onClick={() => setShowAddStorage(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Storage Path</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={storageForm.path}
                                    onChange={(e) => setStorageForm({ ...storageForm, path: e.target.value })}
                                    placeholder="e.g., //nas/gameservers or D:\Servers"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Storage Type</label>
                                    <select
                                        className="form-select"
                                        value={storageForm.storage_type}
                                        onChange={(e) => setStorageForm({ ...storageForm, storage_type: e.target.value })}
                                    >
                                        <option value="local">Local</option>
                                        <option value="nfs">NFS</option>
                                        <option value="smb">SMB/CIFS</option>
                                        <option value="iscsi">iSCSI</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Total Size (GB)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={storageForm.total_gb}
                                        onChange={(e) => setStorageForm({ ...storageForm, total_gb: e.target.value })}
                                        placeholder="e.g., 1000"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Alias</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={storageForm.alias}
                                    onChange={(e) => setStorageForm({ ...storageForm, alias: e.target.value })}
                                    placeholder="e.g., Game Server Storage"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddStorage(false)}>Cancel</button>
                            <button 
                                className="btn btn-primary" 
                                onClick={addStoragePath} 
                                disabled={!storageForm.path}
                            >
                                <i className="fas fa-plus"></i> Add Storage
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* DuckDNS Modal */}
            {showDuckDNS && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3><i className="fas fa-globe"></i> DuckDNS Configuration</h3>
                            <button className="modal-close" onClick={() => setShowDuckDNS(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="info-box">
                                <i className="fas fa-duck"></i>
                                <p>Configure DuckDNS to give your cluster a domain name. Get your token from <a href="https://www.duckdns.org" target="_blank" rel="noopener noreferrer">duckdns.org</a></p>
                            </div>
                            <div className="form-group">
                                <label>Domain</label>
                                <div className="input-with-suffix">
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={duckdnsForm.domain}
                                        onChange={(e) => setDuckdnsForm({ ...duckdnsForm, domain: e.target.value })}
                                        placeholder="yoursubdomain"
                                    />
                                    <span className="input-suffix">.duckdns.org</span>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>API Token</label>
                                <div className="input-with-toggle">
                                    <input
                                        type={showToken ? 'text' : 'password'}
                                        className="form-input"
                                        value={duckdnsForm.token}
                                        onChange={(e) => setDuckdnsForm({ ...duckdnsForm, token: e.target.value })}
                                        placeholder="Your DuckDNS token"
                                    />
                                    <button 
                                        type="button"
                                        className="input-toggle"
                                        onClick={() => setShowToken(!showToken)}
                                    >
                                        <i className={`fas fa-eye${showToken ? '-slash' : ''}`}></i>
                                    </button>
                                </div>
                                <small>Token will be stored securely and displayed as: {maskToken(duckdnsForm.token || 'abc123xyz')}</small>
                            </div>
                            <div className="form-group">
                                <label>Update Interval (seconds)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={duckdnsForm.update_interval}
                                    onChange={(e) => setDuckdnsForm({ ...duckdnsForm, update_interval: parseInt(e.target.value) })}
                                    placeholder="300"
                                />
                                <small>How often to update the DNS record (default: 300 = 5 minutes)</small>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDuckDNS(false)}>Cancel</button>
                            <button 
                                className="btn btn-primary" 
                                onClick={saveDuckDNS} 
                                disabled={!duckdnsForm.domain || !duckdnsForm.token}
                            >
                                <i className="fas fa-save"></i> Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ClustersView;
