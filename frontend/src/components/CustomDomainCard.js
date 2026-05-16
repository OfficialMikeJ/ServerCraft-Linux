import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

function CustomDomainCard({ showToast }) {
    const [config, setConfig] = useState({});
    const [domain, setDomain] = useState('');
    const [subdomain, setSubdomain] = useState('');
    const [isDynamicIP, setIsDynamicIP] = useState(true);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    
    const getToken = () => localStorage.getItem('servercraft_auth_token') || '';
    
    useEffect(() => {
        fetchConfig();
    }, []);
    
    const fetchConfig = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/custom-domain/config?token=${getToken()}`);
            const data = await res.json();
            setConfig(data);
            setDomain(data.domain || '');
            setSubdomain(data.subdomain || '');
            setIsDynamicIP(data.is_dynamic_ip !== false);
        } catch (error) {
            console.error('Failed to fetch domain config:', error);
        }
    };
    
    const handleSave = async () => {
        if (!domain) {
            showToast('Please enter a domain name', 'error');
            return;
        }
        
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/custom-domain/save?token=${getToken()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: domain.trim(),
                    subdomain: subdomain.trim() || null,
                    is_dynamic_ip: isDynamicIP
                })
            });
            
            const data = await res.json();
            if (data.success) {
                showToast('Domain configuration saved!', 'success');
                await fetchConfig();
            } else {
                showToast(data.error || 'Failed to save', 'error');
            }
        } catch (error) {
            showToast('Connection failed', 'error');
        }
        setLoading(false);
    };
    
    const handleCheckPropagation = async () => {
        setChecking(true);
        try {
            const res = await fetch(`${API_BASE}/api/custom-domain/check-propagation?token=${getToken()}`, {
                method: 'POST'
            });
            
            const data = await res.json();
            if (data.success) {
                if (data.propagated) {
                    showToast('✅ Your domain has fully propagated!', 'success');
                } else {
                    showToast('⏳ DNS propagation in progress...', 'info');
                }
                await fetchConfig();
            } else {
                showToast(data.error || 'Check failed', 'error');
            }
        } catch (error) {
            showToast('Connection failed', 'error');
        }
        setChecking(false);
    };
    
    return (
        <div className="card">
            <div className="card-header">
                <h3><i className="fas fa-globe"></i> Custom Domain Configuration</h3>
            </div>
            <div className="card-body">
                <p className="setting-description">
                    Configure your own custom domain for your ServerCraft panel. Use Nginx Proxy Manager for SSL and reverse proxy.
                </p>
                
                {/* Domain Input */}
                <div className="form-group">
                    <label><i className="fas fa-link"></i> Domain Name</label>
                    <input
                        type="text"
                        className="form-input"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder="example.com"
                    />
                    <small>Enter your root domain (e.g., example.com)</small>
                </div>
                
                {/* Subdomain Input */}
                <div className="form-group">
                    <label><i className="fas fa-sitemap"></i> Subdomain (Optional)</label>
                    <input
                        type="text"
                        className="form-input"
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value)}
                        placeholder="servers"
                    />
                    <small>Optional: Add a subdomain (e.g., servers.example.com)</small>
                </div>
                
                {/* IP Type Selection */}
                <div className="form-group">
                    <label><i className="fas fa-network-wired"></i> IP Address Type</label>
                    <div className="radio-group">
                        <label className="radio-label">
                            <input
                                type="radio"
                                checked={isDynamicIP}
                                onChange={() => setIsDynamicIP(true)}
                            />
                            <span>Dynamic IP (DDNS/CNAME)</span>
                        </label>
                        <label className="radio-label">
                            <input
                                type="radio"
                                checked={!isDynamicIP}
                                onChange={() => setIsDynamicIP(false)}
                            />
                            <span>Static IP</span>
                        </label>
                    </div>
                </div>
                
                {/* Setup Instructions */}
                <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowInstructions(!showInstructions)}
                >
                    <i className="fas fa-book"></i> {showInstructions ? 'Hide' : 'Show'} Setup Instructions
                </button>
                
                {showInstructions && (
                    <div className="instructions-box">
                        <h4><i className="fas fa-info-circle"></i> Setup Instructions</h4>
                        {isDynamicIP ? (
                            <>
                                <h5>Dynamic DNS with Nginx Proxy Manager:</h5>
                                <ol>
                                    <li>Set up Nginx Proxy Manager (see Settings &gt; NPM Integration)</li>
                                    <li>Go to your domain's DNS settings (e.g., Namecheap, GoDaddy, Cloudflare)</li>
                                    <li>Add a <strong>CNAME record</strong>:
                                        <ul>
                                            <li><strong>Host:</strong> {subdomain || '@'}</li>
                                            <li><strong>Target:</strong> your-server-ip or DDNS hostname</li>
                                            <li><strong>TTL:</strong> 1 minute (60 seconds)</li>
                                        </ul>
                                    </li>
                                    <li>Create a proxy host in NPM pointing to ServerCraft port 8001</li>
                                    <li>Enable SSL with Let's Encrypt for HTTPS</li>
                                </ol>
                            </>
                        ) : (
                            <>
                                <h5>Static IP Configuration:</h5>
                                <ol>
                                    <li>Go to your domain's DNS settings</li>
                                    <li>Add an <strong>A record</strong>:
                                        <ul>
                                            <li><strong>Host:</strong> {subdomain || '@'}</li>
                                            <li><strong>Value:</strong> Your server's static IP address</li>
                                            <li><strong>TTL:</strong> Automatic or 3600 (1 hour)</li>
                                        </ul>
                                    </li>
                                    <li><strong>Port Forward on your Router/Modem:</strong>
                                        <ul>
                                            <li>Access your router's admin panel (typically 192.168.1.1 or 192.168.0.1)</li>
                                            <li>Navigate to Port Forwarding settings</li>
                                            <li>Forward <strong>Port 80</strong> (HTTP) to your server's local IP</li>
                                            <li>Forward <strong>Port 443</strong> (HTTPS) to your server's local IP</li>
                                            <li><strong>Note:</strong> CG-NAT (Carrier-Grade NAT) networks are <strong>NOT supported</strong>. Contact your ISP if you're behind CG-NAT.</li>
                                        </ul>
                                    </li>
                                    <li>Save changes and wait for DNS propagation</li>
                                </ol>
                            </>
                        )}
                    </div>
                )}
                
                {/* Propagation Status */}
                {config.enabled && config.full_domain && (
                    <div className="propagation-status">
                        <div className="status-row">
                            <span><strong>Configured Domain:</strong></span>
                            <span>{config.full_domain}</span>
                        </div>
                        <div className="status-row">
                            <span><strong>DNS Status:</strong></span>
                            <span className={`status-badge ${config.propagated ? 'status-success' : 'status-pending'}`}>
                                {config.propagated ? (
                                    <><i className="fas fa-heartbeat heartbeat-pulsate"></i> Fully Propagated</>
                                ) : (
                                    <><i className="fas fa-heart"></i> Not Propagated</>
                                )}
                            </span>
                        </div>
                        {config.last_check && (
                            <div className="status-row">
                                <span><strong>Last Checked:</strong></span>
                                <span>{new Date(config.last_check).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Actions */}
                <div className="button-group">
                    <button 
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={loading}
                    >
                        {loading ? (
                            <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                        ) : (
                            <><i className="fas fa-save"></i> Save Configuration</>
                        )}
                    </button>
                    
                    {config.enabled && (
                        <button 
                            className="btn btn-success"
                            onClick={handleCheckPropagation}
                            disabled={checking}
                        >
                            {checking ? (
                                <><i className="fas fa-spinner fa-spin"></i> Checking...</>
                            ) : (
                                <><i className="fas fa-sync-alt"></i> Check DNS Propagation</>
                            )}
                        </button>
                    )}
                </div>
                
                {config.propagated && (
                    <div className="success-message">
                        <i className="fas fa-check-circle"></i>
                        <p><strong>Your domain has fully propagated!</strong> Please test it before sharing or using your custom domain name.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CustomDomainCard;
