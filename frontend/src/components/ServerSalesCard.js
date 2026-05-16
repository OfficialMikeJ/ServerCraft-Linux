import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

function ServerSalesCard({ showToast }) {
    const [config, setConfig] = useState({});
    const [enabled, setEnabled] = useState(false);
    const [packages, setPackages] = useState([]);
    const [showPayPalSetup, setShowPayPalSetup] = useState(false);
    const [clientId, setClientId] = useState('');
    const [secret, setSecret] = useState('');
    const [mode, setMode] = useState('sandbox');
    const [testing, setTesting] = useState(false);
    const [editingPackage, setEditingPackage] = useState(null);
    
    const getToken = () => localStorage.getItem('servercraft_auth_token') || '';
    
    useEffect(() => {
        fetchConfig();
    }, []);
    
    const fetchConfig = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/server-sales/config?token=${getToken()}`);
            const data = await res.json();
            setConfig(data);
            setEnabled(data.enabled || false);
            setPackages(data.packages || []);
            setMode(data.paypal_mode || 'sandbox');
        } catch (error) {
            console.error('Failed to fetch sales config:', error);
        }
    };
    
    const handleToggle = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/server-sales/toggle?token=${getToken()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !enabled })
            });
            
            const data = await res.json();
            if (data.success) {
                setEnabled(!enabled);
                showToast(`Server sales ${!enabled ? 'enabled' : 'disabled'}`, 'success');
            }
        } catch (error) {
            showToast('Failed to toggle', 'error');
        }
    };
    
    const handleSavePayPal = async () => {
        if (!clientId || !secret) {
            showToast('Please enter both Client ID and Secret', 'error');
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE}/api/server-sales/paypal/configure?token=${getToken()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: clientId, secret, mode })
            });
            
            const data = await res.json();
            if (data.success) {
                showToast('PayPal credentials saved', 'success');
                setShowPayPalSetup(false);
                setClientId('');
                setSecret('');
                await fetchConfig();
            }
        } catch (error) {
            showToast('Failed to save', 'error');
        }
    };
    
    const handleTestPayPal = async () => {
        setTesting(true);
        try {
            const res = await fetch(`${API_BASE}/api/server-sales/paypal/test?token=${getToken()}`, {
                method: 'POST'
            });
            
            const data = await res.json();
            if (data.success) {
                showToast(`✅ ${data.message}`, 'success');
            } else {
                showToast(`❌ ${data.error}`, 'error');
            }
        } catch (error) {
            showToast('Test failed', 'error');
        }
        setTesting(false);
    };
    
    const handleUpdatePackage = async (pkg) => {
        const updatedPackages = packages.map(p => p.id === pkg.id ? pkg : p);
        
        try {
            const res = await fetch(`${API_BASE}/api/server-sales/packages?token=${getToken()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPackages)
            });
            
            const data = await res.json();
            if (data.success) {
                setPackages(updatedPackages);
                setEditingPackage(null);
                showToast('Package updated', 'success');
            }
        } catch (error) {
            showToast('Failed to update', 'error');
        }
    };
    
    return (
        <div className="card">
            <div className="card-header">
                <h3><i className="fas fa-shopping-cart"></i> Server Selling (Advanced)</h3>
                <div className="toggle-switch">
                    <input
                        type="checkbox"
                        id="sales-toggle"
                        checked={enabled}
                        onChange={handleToggle}
                    />
                    <label htmlFor="sales-toggle"></label>
                </div>
            </div>
            <div className="card-body">
                <p className="setting-description">
                    <i className="fas fa-info-circle"></i> Optional advanced feature for selling game servers directly from ServerCraft. Requires PayPal API credentials.
                </p>
                
                {enabled && (
                    <>
                        {/* PayPal Configuration */}
                        <div className="subsection">
                            <h4><i className="fab fa-paypal"></i> PayPal Configuration</h4>
                            <div className="status-row">
                                <span>Status:</span>
                                <span className={config.paypal_configured ? 'status-success' : 'status-warning'}>
                                    {config.paypal_configured ? (
                                        <><i className="fas fa-check-circle"></i> Configured</>
                                    ) : (
                                        <><i className="fas fa-exclamation-circle"></i> Not Configured</>
                                    )}
                                </span>
                            </div>
                            
                            {config.paypal_configured && (
                                <>
                                    <div className="status-row">
                                        <span>Client ID:</span>
                                        <span>{config.paypal_client_id_masked}</span>
                                    </div>
                                    <div className="status-row">
                                        <span>Secret:</span>
                                        <span>{config.paypal_secret_masked}</span>
                                    </div>
                                    <div className="status-row">
                                        <span>Mode:</span>
                                        <span className="mode-badge">{config.paypal_mode}</span>
                                    </div>
                                </>
                            )}
                            
                            <div className="button-group">
                                <button 
                                    className="btn btn-secondary"
                                    onClick={() => setShowPayPalSetup(!showPayPalSetup)}
                                >
                                    <i className="fas fa-cog"></i> {config.paypal_configured ? 'Update' : 'Configure'} PayPal
                                </button>
                                
                                {config.paypal_configured && (
                                    <button 
                                        className="btn btn-primary"
                                        onClick={handleTestPayPal}
                                        disabled={testing}
                                    >
                                        {testing ? (
                                            <><i className="fas fa-spinner fa-spin"></i> Testing...</>
                                        ) : (
                                            <><i className="fas fa-vial"></i> Test Connection</>
                                        )}
                                    </button>
                                )}
                            </div>
                            
                            {showPayPalSetup && (
                                <div className="paypal-setup-box">
                                    <h5>PayPal API Credentials</h5>
                                    <div className="form-group">
                                        <label>Mode</label>
                                        <select 
                                            className="form-input"
                                            value={mode}
                                            onChange={(e) => setMode(e.target.value)}
                                        >
                                            <option value="sandbox">Sandbox (Testing)</option>
                                            <option value="live">Live (Production)</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Client ID</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={clientId}
                                            onChange={(e) => setClientId(e.target.value)}
                                            placeholder="Enter PayPal Client ID"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Secret</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={secret}
                                            onChange={(e) => setSecret(e.target.value)}
                                            placeholder="Enter PayPal Secret"
                                        />
                                    </div>
                                    <button className="btn btn-primary" onClick={handleSavePayPal}>
                                        <i className="fas fa-save"></i> Save Credentials
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* Server Packages */}
                        <div className="subsection">
                            <h4><i className="fas fa-box"></i> Server Packages</h4>
                            <div className="packages-grid">
                                {packages.map(pkg => (
                                    <div key={pkg.id} className="package-card">
                                        {editingPackage?.id === pkg.id ? (
                                            <>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={editingPackage.name}
                                                    onChange={(e) => setEditingPackage({...editingPackage, name: e.target.value})}
                                                />
                                                <textarea
                                                    className="form-input"
                                                    value={editingPackage.description}
                                                    onChange={(e) => setEditingPackage({...editingPackage, description: e.target.value})}
                                                />
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="form-input"
                                                    value={editingPackage.price}
                                                    onChange={(e) => setEditingPackage({...editingPackage, price: parseFloat(e.target.value)})}
                                                />
                                                <select
                                                    className="form-input"
                                                    value={editingPackage.currency}
                                                    onChange={(e) => setEditingPackage({...editingPackage, currency: e.target.value})}
                                                >
                                                    <option value="EUR">EUR (€)</option>
                                                    <option value="USD">USD ($)</option>
                                                    <option value="GBP">GBP (£)</option>
                                                </select>
                                                <button className="btn btn-success btn-sm" onClick={() => handleUpdatePackage(editingPackage)}>
                                                    <i className="fas fa-check"></i> Save
                                                </button>
                                                <button className="btn btn-gray btn-sm" onClick={() => setEditingPackage(null)}>
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <h5>{pkg.name}</h5>
                                                <p>{pkg.description}</p>
                                                <div className="package-specs">
                                                    <span><i className="fas fa-microchip"></i> {pkg.specs.cpu_cores} Cores</span>
                                                    <span><i className="fas fa-memory"></i> {pkg.specs.ram_gb} GB RAM</span>
                                                    <span><i className="fas fa-hdd"></i> {pkg.specs.storage_gb} GB Storage</span>
                                                    <span><i className="fas fa-users"></i> {pkg.specs.player_slots} Slots</span>
                                                </div>
                                                <div className="package-price">
                                                    {pkg.price} {pkg.currency}
                                                </div>
                                                <button 
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setEditingPackage(pkg)}
                                                >
                                                    <i className="fas fa-edit"></i> Edit
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default ServerSalesCard;
