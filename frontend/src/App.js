/**
 * ServerCraft Linux Edition - React Application
 * Version: 2026.1.6.44D
 * Copyright 2026 TierOne Development
 */

const ServerCraftLogo = ({ size = 28, className = '' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#12121a"/>
        <rect x="4" y="5" width="24" height="7" rx="2" fill="#6366f1"/>
        <circle cx="24" cy="8.5" r="1.5" fill="#10b981"/>
        <rect x="7" y="7.5" width="10" height="2" rx="1" fill="rgba(255,255,255,0.25)"/>
        <rect x="4" y="13.5" width="24" height="7" rx="2" fill="#4f46e5"/>
        <circle cx="24" cy="17" r="1.5" fill="#10b981"/>
        <rect x="7" y="16" width="10" height="2" rx="1" fill="rgba(255,255,255,0.25)"/>
        <rect x="4" y="22" width="24" height="5" rx="2" fill="#3730a3"/>
        <circle cx="24" cy="24.5" r="1.5" fill="#f59e0b"/>
        <rect x="7" y="23.5" width="10" height="2" rx="1" fill="rgba(255,255,255,0.25)"/>
    </svg>
);

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import ClustersView from './ClustersView';
import FeedbackView from './FeedbackView';
import CustomDomainCard from './components/CustomDomainCard';
import BackgroundSlideshow from './components/BackgroundSlideshow';
import ServerSalesCard from './components/ServerSalesCard';

// API Base URL from environment
const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Game default ports with port ranges for auto-allocation
const GAME_DEFAULTS = {
    arma3: { port: 2302, queryPort: 2303, requiresOwnership: true, portRange: { start: 2302, end: 2401 } },
    dayz_vanilla: { port: 2402, queryPort: 30116, requiresOwnership: false, portRange: { start: 2402, end: 2501 } },
    dayz_modded: { port: 2502, queryPort: 30216, requiresOwnership: false, portRange: { start: 2502, end: 2601 } },
    rust: { port: 28015, queryPort: 28016, requiresOwnership: false, portRange: { start: 28015, end: 28114 } },
    arma_reforger: { port: 2001, queryPort: 17777, requiresOwnership: true, portRange: { start: 2001, end: 2100 } },
    project_zomboid: { port: 16261, queryPort: 16262, requiresOwnership: false, portRange: { start: 16261, end: 16360 } },
    valheim: { port: 2456, queryPort: 2457, requiresOwnership: false, portRange: { start: 2456, end: 2555 } },
    squad: { port: 7787, queryPort: 27165, requiresOwnership: false, portRange: { start: 7787, end: 7886 } },
    ground_branch: { port: 7777, queryPort: 7777, requiresOwnership: false, portRange: { start: 7777, end: 7876 } },
    icarus: { port: 17777, queryPort: 17777, requiresOwnership: false, portRange: { start: 17777, end: 17876 } },
    no_one_survived: { port: 7900, queryPort: 7900, requiresOwnership: false, portRange: { start: 7900, end: 7999 } },
    fivem: { port: 30120, queryPort: 30120, requiresOwnership: false, portRange: { start: 30120, end: 30219 } },
    source_engine: { port: 27015, queryPort: 27015, requiresOwnership: false, portRange: { start: 27015, end: 27114 } },
    minecraft: { port: 25565, queryPort: 25565, requiresOwnership: false, portRange: { start: 25565, end: 25664 } }
};

// Resource-conservative polling intervals (in ms) - v1.6.2026.0C optimized
const POLL_INTERVALS = {
    STATS_IDLE: 10000,     // 10 seconds when no servers running (was 5s)
    STATS_ACTIVE: 3000,    // 3 seconds when servers are running (was 2s)
    SERVERS_IDLE: 30000,   // 30 seconds when idle (was 15s)
    SERVERS_ACTIVE: 5000,  // 5 seconds when active
    WORKSHOP_BROWSE: 60000 // 60 seconds for workshop data refresh
};

// Security Questions List
const SECURITY_QUESTIONS = [
    "What is your pet's name?",
    "What city were you born in?",
    "What is your mother's maiden name?",
    "What was the name of your first school?",
    "What is your favorite movie?"
];

// ==================== AUTH COMPONENTS ====================

// Login Screen Component
function LoginScreen({ onLogin, onSubUserLogin, showPasswordReset, setShowPasswordReset }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSubUser, setIsSubUser] = useState(false);
    
    // 2FA State
    const [requires2FA, setRequires2FA] = useState(false);
    const [tempToken, setTempToken] = useState('');
    const [twoFACode, setTwoFACode] = useState('');
    
    // Password Reset State
    const [resetStep, setResetStep] = useState(1);
    const [securityQuestions, setSecurityQuestions] = useState([]);
    const [securityAnswers, setSecurityAnswers] = useState(['', '', '']);
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // Load saved remember me preference
    const savedRemember = localStorage.getItem('servercraft_remember_me') === 'true';
    
    // Set initial remember me state from localStorage
    useEffect(() => {
        if (savedRemember && !rememberMe) {
            setRememberMe(true);
        }
    }, [savedRemember, rememberMe]);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        if (isSubUser) {
            // Sub-user login
            const result = await onSubUserLogin(username, password);
            setLoading(false);
            if (!result.success) {
                setError(result.error);
            }
        } else {
            // Admin login
            const result = await onLogin(username, password, rememberMe);
            setLoading(false);
            if (!result.success) {
                setError(result.error);
            } else if (result.requires_2fa) {
                setRequires2FA(true);
                setTempToken(result.temp_token);
            }
        }
    };
    
    const handle2FASubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            const response = await fetch(`${API_BASE}/api/auth/2fa/verify-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    temp_token: tempToken,
                    code: twoFACode 
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                setError(error.detail || 'Invalid 2FA code');
                setLoading(false);
                return;
            }
            
            const data = await response.json();
            
            // Store token and complete login
            localStorage.setItem('servercraft_auth_token', data.token);
            localStorage.setItem('servercraft_remember_me', rememberMe.toString());
            
            // Call parent's login completion handler
            const loginResult = { 
                success: true, 
                token: data.token,
                username: data.username,
                must_change_password: data.must_change_password,
                has_security_questions: data.has_security_questions
            };
            
            // Pass the complete data to parent
            await onLogin(null, null, null, loginResult);
            
        } catch (error) {
            setError('Connection failed');
        }
        
        setLoading(false);
    };
    
    const loadSecurityQuestions = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/security-questions`);
            const data = await response.json();
            if (data.questions && data.questions.length >= 3) {
                setSecurityQuestions(data.questions);
                setSecurityAnswers(new Array(data.questions.length).fill(''));
                return true;
            }
            setError('Security questions not set up. Contact administrator.');
            return false;
        } catch (e) {
            setError('Failed to load security questions');
            return false;
        }
    };
    
    const handleForgotPassword = async () => {
        const loaded = await loadSecurityQuestions();
        if (loaded) {
            setShowPasswordReset(true);
            setResetStep(1);
        }
    };
    
    const handleVerifyAnswers = async () => {
        setError('');
        setLoading(true);
        
        try {
            const response = await fetch(`${API_BASE}/api/auth/verify-security`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: securityAnswers })
            });
            
            if (response.ok) {
                const data = await response.json();
                setResetToken(data.reset_token);
                setResetStep(2);
            } else {
                setError('Security answers incorrect. Please try again.');
            }
        } catch (e) {
            setError('Verification failed');
        }
        
        setLoading(false);
    };
    
    const handleResetPassword = async () => {
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        
        setError('');
        setLoading(true);
        
        try {
            const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reset_token: resetToken, new_password: newPassword })
            });
            
            if (response.ok) {
                setShowPasswordReset(false);
                setResetStep(1);
                setError('');
                alert('Password reset successfully! Please login with your new password.');
            } else {
                const data = await response.json();
                setError(data.detail || 'Reset failed');
            }
        } catch (e) {
            setError('Reset failed');
        }
        
        setLoading(false);
    };
    
    if (showPasswordReset) {
        return (
            <div className="login-screen">
                <div className="login-container">
                    <div className="login-header">
                        <ServerCraftLogo size={52} className="login-logo" />
                        <h1>ServerCraft</h1>
                        <p>Password Reset</p>
                    </div>
                    
                    {resetStep === 1 ? (
                        <div className="login-form">
                            <h3><i className="fas fa-shield-alt"></i> Security Questions</h3>
                            <p className="reset-instructions">Please answer your security questions to reset your password.</p>
                            
                            {securityQuestions.map((question, index) => (
                                <div className="form-group" key={index}>
                                    <label>{question}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={securityAnswers[index]}
                                        onChange={(e) => {
                                            const newAnswers = [...securityAnswers];
                                            newAnswers[index] = e.target.value;
                                            setSecurityAnswers(newAnswers);
                                        }}
                                        placeholder="Your answer..."
                                    />
                                </div>
                            ))}
                            
                            {error && <div className="login-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
                            
                            <div className="form-actions">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary"
                                    onClick={() => setShowPasswordReset(false)}
                                >
                                    <i className="fas fa-arrow-left"></i> Back to Login
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary"
                                    onClick={handleVerifyAnswers}
                                    disabled={loading || securityAnswers.some(a => !a.trim())}
                                >
                                    {loading ? <><i className="fas fa-spinner fa-spin"></i> Verifying...</> : <><i className="fas fa-check"></i> Verify</>}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="login-form">
                            <h3><i className="fas fa-key"></i> Set New Password</h3>
                            
                            <div className="form-group">
                                <label>New Password</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password..."
                                />
                            </div>
                            
                            <div className="form-group">
                                <label>Confirm Password</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password..."
                                />
                            </div>
                            
                            {error && <div className="login-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
                            
                            <button 
                                type="button" 
                                className="btn btn-primary login-btn"
                                onClick={handleResetPassword}
                                disabled={loading || !newPassword || !confirmPassword}
                            >
                                {loading ? <><i className="fas fa-spinner fa-spin"></i> Resetting...</> : <><i className="fas fa-save"></i> Reset Password</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    
    // Show 2FA verification screen if required
    if (requires2FA) {
        return (
            <div className="login-screen">
                <Snowflakes />
                <div className="login-container">
                    <div className="login-header">
                        <ServerCraftLogo size={52} className="login-logo" />
                        <h1>Two-Factor Authentication</h1>
                        <p>Enter your 6-digit code</p>
                    </div>
                    
                    <form className="login-form" onSubmit={handle2FASubmit}>
                        <div className="form-group">
                            <label><i className="fas fa-mobile-alt"></i> Authentication Code</label>
                            <input
                                type="text"
                                className="form-input"
                                value={twoFACode}
                                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="Enter 6-digit code..."
                                maxLength={6}
                                autoFocus
                                style={{ textAlign: 'center', fontSize: '1.5em', letterSpacing: '0.5em' }}
                            />
                            <small style={{ display: 'block', marginTop: '0.5em', color: '#aaa' }}>
                                Open your authenticator app and enter the 6-digit code
                            </small>
                        </div>
                        
                        {error && <div className="login-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
                        
                        <button type="submit" className="btn btn-primary login-btn" disabled={loading || twoFACode.length !== 6}>
                            {loading ? <><i className="fas fa-spinner fa-spin"></i> Verifying...</> : <><i className="fas fa-check-circle"></i> Verify</>}
                        </button>
                        
                        <button 
                            type="button" 
                            className="forgot-password-link" 
                            onClick={() => {
                                setRequires2FA(false);
                                setTwoFACode('');
                                setError('');
                            }}
                        >
                            <i className="fas fa-arrow-left"></i> Back to Login
                        </button>
                    </form>
                    
                    <div className="login-footer">
                        <p className="copyright">© 2026 TierOne Development</p>
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="login-screen">
            <Snowflakes />
            <div className="login-container">
                <div className="login-header">
                    <ServerCraftLogo size={52} className="login-logo" />
                    <h1>ServerCraft</h1>
                    <p>Linux</p>
                </div>
                
                <form className="login-form" onSubmit={handleSubmit}>
                    {/* Login Type Toggle */}
                    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button type="button" onClick={() => { setIsSubUser(false); setError(''); }} data-testid="admin-login-tab" style={{ flex: 1, padding: '8px', background: !isSubUser ? 'rgba(59,130,246,0.2)' : 'transparent', color: !isSubUser ? '#3b82f6' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: !isSubUser ? '600' : '400', fontSize: '13px' }}>
                            <i className="fas fa-user-shield"></i> Admin
                        </button>
                        <button type="button" onClick={() => { setIsSubUser(true); setError(''); }} data-testid="subuser-login-tab" style={{ flex: 1, padding: '8px', background: isSubUser ? 'rgba(34,197,94,0.2)' : 'transparent', color: isSubUser ? '#22c55e' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: isSubUser ? '600' : '400', fontSize: '13px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                            <i className="fas fa-users"></i> Sub-User
                        </button>
                    </div>
                    
                    <div className="form-group">
                        <label><i className={`fas ${isSubUser ? 'fa-user-cog' : 'fa-user'}`}></i> Username</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={isSubUser ? "Sub-user username..." : "Enter username..."}
                            autoFocus
                            data-testid="login-username-input"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label><i className="fas fa-lock"></i> Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password..."
                            data-testid="login-password-input"
                        />
                    </div>
                    
                    {!isSubUser && (
                        <div className="form-checkbox">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <span>Remember me for 30 days</span>
                            </label>
                        </div>
                    )}
                    
                    {error && <div className="login-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
                    
                    <button type="submit" className="btn btn-primary login-btn" disabled={loading || !username || !password} data-testid="login-submit-btn">
                        {loading ? <><i className="fas fa-spinner fa-spin"></i> Signing in...</> : <><i className="fas fa-sign-in-alt"></i> {isSubUser ? 'Sign In as Sub-User' : 'Sign In'}</>}
                    </button>
                    
                    {!isSubUser && (
                        <button type="button" className="forgot-password-link" onClick={handleForgotPassword}>
                            <i className="fas fa-question-circle"></i> Forgot Password?
                        </button>
                    )}
                </form>
                
                <div className="login-footer">
                    {!isSubUser && <p>Default: Admin / Password123!</p>}
                    {isSubUser && <p style={{ color: '#22c55e', fontSize: '12px' }}>Contact your admin for sub-user credentials</p>}
                    <p className="copyright">© 2026 TierOne Development</p>
                </div>
            </div>
        </div>
    );
}

// Password Change Screen (First Login)
function PasswordChangeScreen({ currentUsername, isFirstTime, onPasswordChange, onUsernameChange, onLogout }) {
    const [step, setStep] = useState(1);
    const [newUsername, setNewUsername] = useState(currentUsername === 'Admin' ? '' : currentUsername);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const handleUsernameSubmit = async () => {
        if (newUsername.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }
        if (newUsername.toLowerCase() === 'admin') {
            setError('Please choose a different username');
            return;
        }
        
        setError('');
        setLoading(true);
        
        const result = await onUsernameChange(newUsername);
        setLoading(false);
        
        if (result.success) {
            setStep(2);
        } else {
            setError(result.error);
        }
    };
    
    const handlePasswordSubmit = async () => {
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword === 'Password123!') {
            setError('Please choose a different password');
            return;
        }
        
        setError('');
        setLoading(true);
        
        const result = await onPasswordChange(currentPassword, newPassword);
        setLoading(false);
        
        if (!result.success) {
            setError(result.error);
        }
    };
    
    return (
        <div className="login-screen">
            <Snowflakes />
            <div className="login-container password-change">
                <div className="login-header">
                    <ServerCraftLogo size={52} className="login-logo" />
                    <h1>Account Setup</h1>
                    <p>{isFirstTime ? 'Please change your default credentials' : 'Change your password'}</p>
                </div>
                
                <div className="setup-progress">
                    <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
                        <span className="step-number">1</span>
                        <span className="step-label">Username</span>
                    </div>
                    <div className="progress-line"></div>
                    <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
                        <span className="step-number">2</span>
                        <span className="step-label">Password</span>
                    </div>
                </div>
                
                {step === 1 ? (
                    <div className="login-form">
                        <div className="form-group">
                            <label><i className="fas fa-user"></i> New Username</label>
                            <input
                                type="text"
                                className="form-input"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="Choose a username..."
                                autoFocus
                            />
                            <small>Current: {currentUsername}</small>
                        </div>
                        
                        {error && <div className="login-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
                        
                        <button 
                            type="button" 
                            className="btn btn-primary login-btn"
                            onClick={handleUsernameSubmit}
                            disabled={loading || !newUsername}
                        >
                            {loading ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <><i className="fas fa-arrow-right"></i> Continue</>}
                        </button>
                    </div>
                ) : (
                    <div className="login-form">
                        <div className="form-group">
                            <label><i className="fas fa-key"></i> Current Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password..."
                                autoFocus
                            />
                        </div>
                        
                        <div className="form-group">
                            <label><i className="fas fa-lock"></i> New Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Choose a new password..."
                            />
                            <small>Minimum 8 characters</small>
                        </div>
                        
                        <div className="form-group">
                            <label><i className="fas fa-lock"></i> Confirm Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password..."
                            />
                        </div>
                        
                        {error && <div className="login-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
                        
                        <div className="form-actions">
                            <button 
                                type="button" 
                                className="btn btn-secondary"
                                onClick={() => setStep(1)}
                            >
                                <i className="fas fa-arrow-left"></i> Back
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-primary"
                                onClick={handlePasswordSubmit}
                                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                            >
                                {loading ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <><i className="fas fa-save"></i> Complete Setup</>}
                            </button>
                        </div>
                    </div>
                )}
                
                <button className="logout-link" onClick={onLogout}>
                    <i className="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        </div>
    );
}

// Security Questions Setup Screen
function SecurityQuestionsSetup({ onSetup, onSkip }) {
    const [selectedQuestions, setSelectedQuestions] = useState([
        { question: SECURITY_QUESTIONS[0], answer: '' },
        { question: SECURITY_QUESTIONS[1], answer: '' },
        { question: SECURITY_QUESTIONS[2], answer: '' }
    ]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const handleQuestionChange = (index, newQuestion) => {
        const updated = [...selectedQuestions];
        updated[index].question = newQuestion;
        setSelectedQuestions(updated);
    };
    
    const handleAnswerChange = (index, answer) => {
        const updated = [...selectedQuestions];
        updated[index].answer = answer;
        setSelectedQuestions(updated);
    };
    
    const handleSubmit = async () => {
        // Validate
        for (let q of selectedQuestions) {
            if (!q.answer || q.answer.trim().length < 2) {
                setError('All answers must be at least 2 characters');
                return;
            }
        }
        
        // Check for duplicate questions
        const questions = selectedQuestions.map(q => q.question);
        if (new Set(questions).size !== questions.length) {
            setError('Please select different questions');
            return;
        }
        
        setError('');
        setLoading(true);
        
        const result = await onSetup(selectedQuestions);
        setLoading(false);
        
        if (!result.success) {
            setError(result.error);
        }
    };
    
    const getAvailableQuestions = (currentIndex) => {
        const selected = selectedQuestions
            .filter((_, i) => i !== currentIndex)
            .map(q => q.question);
        return SECURITY_QUESTIONS.filter(q => !selected.includes(q));
    };
    
    return (
        <div className="login-screen">
            <Snowflakes />
            <div className="login-container security-setup">
                <div className="login-header">
                    <ServerCraftLogo size={52} className="login-logo" />
                    <h1>Security Setup</h1>
                    <p>Set up security questions for password recovery</p>
                </div>
                
                <div className="login-form">
                    <div className="security-notice">
                        <i className="fas fa-info-circle"></i>
                        <p>These questions will be used to verify your identity if you forget your password.</p>
                    </div>
                    
                    {selectedQuestions.map((q, index) => (
                        <div className="security-question-group" key={index}>
                            <div className="form-group">
                                <label>Question {index + 1}</label>
                                <select
                                    className="form-select"
                                    value={q.question}
                                    onChange={(e) => handleQuestionChange(index, e.target.value)}
                                >
                                    {getAvailableQuestions(index).map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                    {/* Include current selection */}
                                    {!getAvailableQuestions(index).includes(q.question) && (
                                        <option value={q.question}>{q.question}</option>
                                    )}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Answer</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={q.answer}
                                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                                    placeholder="Your answer..."
                                />
                            </div>
                        </div>
                    ))}
                    
                    {error && <div className="login-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
                    
                    <button 
                        type="button" 
                        className="btn btn-primary login-btn"
                        onClick={handleSubmit}
                        disabled={loading || selectedQuestions.some(q => !q.answer.trim())}
                    >
                        {loading ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <><i className="fas fa-save"></i> Save Security Questions</>}
                    </button>
                    
                    <button className="skip-link" onClick={onSkip}>
                        Skip for now (not recommended)
                    </button>
                </div>
            </div>
        </div>
    );
}

// ==================== ONBOARDING WIZARD ====================
function OnboardingWizard({ systemStats, upnpStatus, onComplete, onSkip }) {
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedGames, setSelectedGames] = useState([]);
    const [upnpChoice, setUpnpChoice] = useState(null); // null, 'enable', 'skip'
    const [loading, setLoading] = useState(false);
    const [recommendations, setRecommendations] = useState(null);
    
    const API_BASE = process.env.REACT_APP_BACKEND_URL || '';
    
    const SUPPORTED_GAMES = [
        { id: 'arma3', name: 'Arma 3', icon: '🎖️', requiresSteam: true },
        { id: 'arma_reforger', name: 'Arma Reforger', icon: '🪖', requiresSteam: true },
        { id: 'dayz_vanilla', name: 'DayZ (Vanilla)', icon: '🧟', requiresSteam: false },
        { id: 'dayz_modded', name: 'DayZ (Modded)', icon: '🧟‍♂️', requiresSteam: false },
        { id: 'rust', name: 'Rust', icon: '🦀', requiresSteam: false },
        { id: 'project_zomboid', name: 'Project Zomboid', icon: '🧟', requiresSteam: false },
        { id: 'valheim', name: 'Valheim', icon: '⚔️', requiresSteam: false },
        { id: 'squad', name: 'Squad', icon: '🎯', requiresSteam: false },
        { id: 'ground_branch', name: 'Ground Branch', icon: '🔫', requiresSteam: false },
        { id: 'icarus', name: 'ICARUS', icon: '🌍', requiresSteam: false },
        { id: 'no_one_survived', name: 'No One Survived', icon: '☠️', requiresSteam: false },
        { id: 'fivem', name: 'FiveM (GTA V RP)', icon: '🚗', requiresSteam: false },
        { id: 'source_engine', name: 'Source Engine Games', icon: '🎮', requiresSteam: false },
        { id: 'minecraft', name: 'Minecraft', icon: '⛏️', requiresSteam: false }
    ];
    
    const toggleGame = (gameId) => {
        if (selectedGames.includes(gameId)) {
            setSelectedGames(selectedGames.filter(id => id !== gameId));
        } else {
            setSelectedGames([...selectedGames, gameId]);
        }
    };
    
    const generateRecommendations = () => {
        const cpuCores = systemStats?.cpu?.cores || 4;
        const totalRam = systemStats?.memory?.total_gb || 8;
        const availableRam = systemStats?.memory?.available_gb || 4;
        
        const recommendations = {
            maxServers: Math.floor(cpuCores / 2), // Conservative estimate
            ramPerServer: Math.floor(availableRam / (selectedGames.length || 1)),
            selectedGames: selectedGames.map(id => SUPPORTED_GAMES.find(g => g.id === id)?.name),
            warnings: []
        };
        
        if (totalRam < 8) {
            recommendations.warnings.push('⚠️ Low RAM detected. Consider running 1-2 servers maximum.');
        }
        if (cpuCores < 4) {
            recommendations.warnings.push('⚠️ Limited CPU cores. Performance may be impacted with multiple servers.');
        }
        if (selectedGames.length > recommendations.maxServers) {
            recommendations.warnings.push(`⚠️ You selected ${selectedGames.length} games but your system is recommended for ${recommendations.maxServers} concurrent servers.`);
        }
        
        setRecommendations(recommendations);
    };
    
    const handleNext = () => {
        if (currentStep === 2 && selectedGames.length > 0) {
            generateRecommendations();
        }
        setCurrentStep(currentStep + 1);
    };
    
    const handleComplete = async () => {
        setLoading(true);
        
        // Save onboarding preferences
        const onboardingData = {
            completed: true,
            selectedGames,
            upnpEnabled: upnpChoice === 'enable',
            completedAt: new Date().toISOString()
        };
        
        localStorage.setItem('servercraft_onboarding', JSON.stringify(onboardingData));
        
        // If user chose to enable UPnP, trigger it
        if (upnpChoice === 'enable') {
            try {
                await fetch(`${API_BASE}/api/upnp/enable`, { method: 'POST' });
            } catch (error) {
                console.error('Failed to enable UPnP:', error);
            }
        }
        
        setLoading(false);
        onComplete(onboardingData);
    };
    
    return (
        <div className="onboarding-overlay">
            <Snowflakes />
            <div className="onboarding-container">
                {/* Progress Bar */}
                <div className="onboarding-progress">
                    <div className="progress-bar">
                        {[1, 2, 3, 4].map(step => (
                            <div 
                                key={step} 
                                className={`progress-step ${currentStep >= step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
                            >
                                <div className="step-circle">{step}</div>
                                <div className="step-label">
                                    {step === 1 && 'Welcome'}
                                    {step === 2 && 'Select Games'}
                                    {step === 3 && 'Network Setup'}
                                    {step === 4 && 'Recommendations'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Step Content */}
                <div className="onboarding-content">
                    {/* Step 1: Welcome */}
                    {currentStep === 1 && (
                        <div className="onboarding-step">
                            <div className="step-header">
                                <i className="fas fa-rocket step-icon"></i>
                                <h2>Welcome to ServerCraft!</h2>
                                <p>Let's get you set up in just a few quick steps</p>
                            </div>
                            <div className="step-body">
                                <div className="feature-list">
                                    <div className="feature-item">
                                        <i className="fas fa-server"></i>
                                        <h4>Easy Server Management</h4>
                                        <p>Create and manage game servers with just a few clicks</p>
                                    </div>
                                    <div className="feature-item">
                                        <i className="fas fa-download"></i>
                                        <h4>Automatic Updates</h4>
                                        <p>Keep your servers up-to-date with SteamCMD integration</p>
                                    </div>
                                    <div className="feature-item">
                                        <i className="fas fa-network-wired"></i>
                                        <h4>Smart Port Management</h4>
                                        <p>Automatic port allocation and UPnP configuration</p>
                                    </div>
                                </div>
                            </div>
                            <div className="step-actions">
                                <button className="btn btn-primary" onClick={handleNext}>
                                    <i className="fas fa-arrow-right"></i> Get Started
                                </button>
                                <button className="btn btn-gray" onClick={onSkip}>
                                    Skip Setup
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* Step 2: Select Games */}
                    {currentStep === 2 && (
                        <div className="onboarding-step">
                            <div className="step-header">
                                <i className="fas fa-gamepad step-icon"></i>
                                <h2>Which games will you host?</h2>
                                <p>Select the games you're interested in (you can add more later)</p>
                            </div>
                            <div className="step-body">
                                <div className="game-grid">
                                    {SUPPORTED_GAMES.map(game => (
                                        <div 
                                            key={game.id}
                                            className={`game-card ${selectedGames.includes(game.id) ? 'selected' : ''}`}
                                            onClick={() => toggleGame(game.id)}
                                        >
                                            <span className="game-icon">{game.icon}</span>
                                            <span className="game-name">{game.name}</span>
                                            {game.requiresSteam && <span className="steam-badge">🔑 Steam</span>}
                                            {selectedGames.includes(game.id) && <i className="fas fa-check-circle selected-icon"></i>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="step-actions">
                                <button className="btn btn-gray" onClick={() => setCurrentStep(1)}>
                                    <i className="fas fa-arrow-left"></i> Back
                                </button>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={handleNext}
                                    disabled={selectedGames.length === 0}
                                >
                                    Continue ({selectedGames.length} selected) <i className="fas fa-arrow-right"></i>
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* Step 3: Network Setup */}
                    {currentStep === 3 && (
                        <div className="onboarding-step">
                            <div className="step-header">
                                <i className="fas fa-network-wired step-icon"></i>
                                <h2>Network Configuration</h2>
                                <p>Configure automatic port forwarding (optional)</p>
                            </div>
                            <div className="step-body">
                                <div className="upnp-explanation">
                                    <div className="info-card">
                                        <h4><i className="fas fa-question-circle"></i> What is UPnP?</h4>
                                        <p>UPnP (Universal Plug and Play) automatically opens ports on your router so players can connect to your servers from the internet.</p>
                                    </div>
                                    
                                    <div className="upnp-status-card">
                                        <h4>Your Router Status</h4>
                                        <div className="status-row">
                                            <span>UPnP Available:</span>
                                            <span className={upnpStatus.available ? 'status-yes' : 'status-no'}>
                                                {upnpStatus.available ? '✅ Yes' : '❌ No'}
                                            </span>
                                        </div>
                                        {upnpStatus.external_ip && (
                                            <div className="status-row">
                                                <span>External IP:</span>
                                                <span>{upnpStatus.external_ip}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="choice-cards">
                                        <div 
                                            className={`choice-card ${upnpChoice === 'enable' ? 'selected' : ''} ${!upnpStatus.available ? 'disabled' : ''}`}
                                            onClick={() => upnpStatus.available && setUpnpChoice('enable')}
                                        >
                                            <i className="fas fa-check-circle choice-icon"></i>
                                            <h4>Enable UPnP</h4>
                                            <p>Recommended for most users. Automatically configures your router.</p>
                                            {!upnpStatus.available && <p className="disabled-note">Not available on your router</p>}
                                        </div>
                                        <div 
                                            className={`choice-card ${upnpChoice === 'skip' ? 'selected' : ''}`}
                                            onClick={() => setUpnpChoice('skip')}
                                        >
                                            <i className="fas fa-cog choice-icon"></i>
                                            <h4>Manual Setup</h4>
                                            <p>I'll configure port forwarding manually on my router.</p>
                                        </div>
                                    </div>
                                    
                                    {upnpChoice === 'skip' && (
                                        <div className="warning-card">
                                            <i className="fas fa-exclamation-triangle"></i>
                                            <p><strong>Note:</strong> You'll need to manually forward ports on your router for players to connect from the internet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="step-actions">
                                <button className="btn btn-gray" onClick={() => setCurrentStep(2)}>
                                    <i className="fas fa-arrow-left"></i> Back
                                </button>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={handleNext}
                                    disabled={upnpChoice === null}
                                >
                                    Continue <i className="fas fa-arrow-right"></i>
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* Step 4: Recommendations */}
                    {currentStep === 4 && recommendations && (
                        <div className="onboarding-step">
                            <div className="step-header">
                                <i className="fas fa-chart-line step-icon"></i>
                                <h2>System Recommendations</h2>
                                <p>Based on your hardware and selected games</p>
                            </div>
                            <div className="step-body">
                                <div className="recommendations-grid">
                                    <div className="rec-card">
                                        <i className="fas fa-server"></i>
                                        <h4>Recommended Servers</h4>
                                        <div className="rec-value">{recommendations.maxServers}</div>
                                        <p>Concurrent servers</p>
                                    </div>
                                    <div className="rec-card">
                                        <i className="fas fa-memory"></i>
                                        <h4>RAM per Server</h4>
                                        <div className="rec-value">{recommendations.ramPerServer} GB</div>
                                        <p>Average allocation</p>
                                    </div>
                                    <div className="rec-card">
                                        <i className="fas fa-microchip"></i>
                                        <h4>System Resources</h4>
                                        <div className="rec-value">{systemStats?.cpu?.cores || 4} Cores</div>
                                        <p>{systemStats?.memory?.total_gb || 8} GB RAM Total</p>
                                    </div>
                                </div>
                                
                                {recommendations.warnings.length > 0 && (
                                    <div className="warnings-section">
                                        <h4><i className="fas fa-exclamation-triangle"></i> Important Notes</h4>
                                        {recommendations.warnings.map((warning, i) => (
                                            <div key={i} className="warning-item">{warning}</div>
                                        ))}
                                    </div>
                                )}
                                
                                <div className="selected-games-summary">
                                    <h4>Your Selected Games:</h4>
                                    <div className="games-list">
                                        {recommendations.selectedGames.map((game, i) => (
                                            <span key={i} className="game-tag">{game}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="step-actions">
                                <button className="btn btn-gray" onClick={() => setCurrentStep(3)}>
                                    <i className="fas fa-arrow-left"></i> Back
                                </button>
                                <button 
                                    className="btn btn-success" 
                                    onClick={handleComplete}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <><i className="fas fa-spinner fa-spin"></i> Finishing Setup...</>
                                    ) : (
                                        <><i className="fas fa-check"></i> Complete Setup</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ==================== SNOWFLAKES COMPONENT ====================
function Snowflakes() {
    const [isWinter, setIsWinter] = useState(false);
    const [snowflakeStyles, setSnowflakeStyles] = useState([]);
    
    useEffect(() => {
        const month = new Date().getMonth();
        // December (11), January (0), February (1)
        const winterMonth = month === 11 || month === 0 || month === 1;
        setIsWinter(winterMonth);
        
        // Generate random styles only once on mount
        if (winterMonth) {
            const styles = Array.from({ length: 50 }, () => ({
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${10 + Math.random() * 20}s`,
                opacity: 0.3 + Math.random() * 0.7,
                fontSize: `${8 + Math.random() * 12}px`
            }));
            setSnowflakeStyles(styles);
        }
    }, []);
    
    if (!isWinter || snowflakeStyles.length === 0) return null;
    
    return (
        <div className="snowflakes-container">
            {snowflakeStyles.map((style, i) => (
                <div key={i} className="snowflake" style={style}>
                    ❄
                </div>
            ))}
        </div>
    );
}

// ==================== END AUTH COMPONENTS ====================

// ==================== FIRST-RUN SETUP SCREEN ====================
function FirstRunSetupScreen({ apiBase, onComplete }) {
    const [step, setStep] = useState(1);
    const TOTAL_STEPS = 4;

    // Step 2 fields
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [fieldError, setFieldError] = useState('');

    // Step 3 fields
    const GAMES = ['Minecraft', 'Valheim', 'Rust', 'ARK', 'CS2', 'Terraria', 'V Rising', 'Palworld', 'Project Zomboid', '7 Days to Die'];
    const [selectedGames, setSelectedGames] = useState([]);

    // Step 4 fields
    const [upnpEnabled, setUpnpEnabled] = useState(false);

    const [submitting, setSubmitting] = useState(false);

    const toggleGame = (game) => {
        setSelectedGames(prev =>
            prev.includes(game) ? prev.filter(g => g !== game) : [...prev, game]
        );
    };

    const validateStep2 = () => {
        if (!username.trim() || username.trim().length < 3) {
            setFieldError('Username must be at least 3 characters'); return false;
        }
        if (password.length < 8) {
            setFieldError('Password must be at least 8 characters'); return false;
        }
        if (password !== confirmPassword) {
            setFieldError('Passwords do not match'); return false;
        }
        setFieldError(''); return true;
    };

    const handleNext = () => {
        if (step === 2 && !validateStep2()) return;
        setStep(s => s + 1);
    };

    const handleFinish = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`${apiBase}/api/setup/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password }),
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('servercraft_onboarding', JSON.stringify({
                    completed: true,
                    selectedGames,
                    upnpEnabled,
                    completedAt: new Date().toISOString(),
                }));
                onComplete();
            } else {
                setFieldError(data.error || 'Setup failed. Please try again.');
                setStep(2);
            }
        } catch {
            setFieldError('Could not reach the server. Please try again.');
            setStep(2);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="onboarding-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#0a0a0a', zIndex: 10000, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="onboarding-container" style={{ maxWidth: 520, width: '100%', padding: '40px 20px', color: '#f5f5f5' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>⚙️</div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>ServerCraft Setup</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 14 }}>
                        First-time configuration — this only runs once
                    </p>
                </div>

                {/* Progress bar */}
                <div className="onboarding-progress" style={{ marginBottom: 28 }}>
                    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                        <div
                            key={i}
                            className={`onboarding-step ${i + 1 <= step ? 'active' : ''}`}
                        />
                    ))}
                </div>

                {/* Step 1 — Welcome */}
                {step === 1 && (
                    <div className="onboarding-content">
                        <h2 style={{ marginBottom: 12 }}>Welcome to ServerCraft</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            ServerCraft is your self-hosted game server management panel.
                            This wizard will help you configure your installation in about a minute.
                        </p>
                        <ul style={{ color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, marginTop: 12 }}>
                            <li>Create your admin account</li>
                            <li>Choose which games you want to host</li>
                            <li>Configure network settings</li>
                        </ul>
                        <button className="btn-primary" style={{ width: '100%', marginTop: 24 }} onClick={handleNext}>
                            Get Started →
                        </button>
                    </div>
                )}

                {/* Step 2 — Create admin account */}
                {step === 2 && (
                    <div className="onboarding-content">
                        <h2 style={{ marginBottom: 6 }}>Create Admin Account</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
                            This is the account you will use to log in to the panel.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Username</label>
                                <input
                                    type="text"
                                    className="auth-input"
                                    placeholder="e.g. admin"
                                    value={username}
                                    onChange={e => { setUsername(e.target.value); setFieldError(''); }}
                                    autoComplete="username"
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="auth-input"
                                        placeholder="Min. 8 characters"
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setFieldError(''); }}
                                        autoComplete="new-password"
                                        style={{ paddingRight: 44 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(s => !s)}
                                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16 }}
                                    >
                                        {showPassword ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Confirm Password</label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="auth-input"
                                    placeholder="Repeat password"
                                    value={confirmPassword}
                                    onChange={e => { setConfirmPassword(e.target.value); setFieldError(''); }}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        {fieldError && (
                            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
                                {fieldError}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
                            <button className="btn-primary" style={{ flex: 2 }} onClick={handleNext}>Continue →</button>
                        </div>
                    </div>
                )}

                {/* Step 3 — Game selection */}
                {step === 3 && (
                    <div className="onboarding-content">
                        <h2 style={{ marginBottom: 6 }}>Which games will you host?</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                            Select all that apply — you can change this later.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                            {GAMES.map(game => (
                                <button
                                    key={game}
                                    onClick={() => toggleGame(game)}
                                    style={{
                                        padding: '7px 14px',
                                        borderRadius: 20,
                                        border: `1px solid ${selectedGames.includes(game) ? 'var(--accent)' : 'var(--border)'}`,
                                        background: selectedGames.includes(game) ? 'var(--accent)' : 'transparent',
                                        color: selectedGames.includes(game) ? '#fff' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {game}
                                </button>
                            ))}
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20 }}>
                            {selectedGames.length === 0 ? 'None selected — you can always add games later.' : `${selectedGames.length} selected`}
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</button>
                            <button className="btn-primary" style={{ flex: 2 }} onClick={handleNext}>Continue →</button>
                        </div>
                    </div>
                )}

                {/* Step 4 — Network */}
                {step === 4 && (
                    <div className="onboarding-content">
                        <h2 style={{ marginBottom: 6 }}>Network Configuration</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                            UPnP lets ServerCraft automatically open ports on your router so players can connect without manual port forwarding.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { value: true, label: 'Enable UPnP', desc: 'Automatic port forwarding — recommended for home networks' },
                                { value: false, label: 'Disable UPnP', desc: 'Manual port forwarding — recommended for VPS / cloud servers' },
                            ].map(opt => (
                                <button
                                    key={String(opt.value)}
                                    onClick={() => setUpnpEnabled(opt.value)}
                                    style={{
                                        textAlign: 'left',
                                        padding: '14px 16px',
                                        borderRadius: 10,
                                        border: `2px solid ${upnpEnabled === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                                        background: upnpEnabled === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{opt.label}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 3 }}>{opt.desc}</div>
                                </button>
                            ))}
                        </div>

                        {fieldError && (
                            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
                                {fieldError}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(3)}>← Back</button>
                            <button
                                className="btn-primary"
                                style={{ flex: 2, opacity: submitting ? 0.7 : 1 }}
                                onClick={handleFinish}
                                disabled={submitting}
                            >
                                {submitting ? 'Setting up...' : '✓ Complete Setup'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
// ==================== END FIRST-RUN SETUP SCREEN ====================

function App() {
    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authToken, setAuthToken] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [showLoginScreen, setShowLoginScreen] = useState(true);
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [needsSecurityQuestions, setNeedsSecurityQuestions] = useState(false);
    const [currentUsername, setCurrentUsername] = useState('');
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingCompleted, setOnboardingCompleted] = useState(false);
    const [needsFirstRunSetup, setNeedsFirstRunSetup] = useState(false);
    
    // AFK timeout state
    const lastActivityRef = useRef(null);
    const afkTimeoutRef = useRef(null);
    const AFK_TIMEOUT = 15 * 60 * 1000; // 15 minutes
    
    // Initialize lastActivityRef on mount
    useEffect(() => {
        lastActivityRef.current = Date.now();
        // Load background settings from localStorage
        const savedInterval = localStorage.getItem('servercraft_bg_interval');
        const savedCategory = localStorage.getItem('servercraft_bg_category');
        if (savedInterval) setBgInterval(parseInt(savedInterval) || 15);
        if (savedCategory) setBgCategory(savedCategory);
    }, []);
    
    // State
    const [currentView, setCurrentView] = useState('dashboard');
    const [servers, setServers] = useState([]);
    const [games, setGames] = useState({});
    const [systemStats, setSystemStats] = useState(null);
    const [openTabs, setOpenTabs] = useState([]);
    const [activeTab, setActiveTab] = useState(null);
    const [steamcmdStatus, setSteamcmdStatus] = useState({ installed: false });
    const [upnpStatus, setUpnpStatus] = useState({});
    const [settings, setSettings] = useState({});
    const [toasts, setToasts] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [consoleOutputs, setConsoleOutputs] = useState({});
    const [showSpecsModal, setShowSpecsModal] = useState(false);
    
    // Self-update system state
    const [updateInfo, setUpdateInfo] = useState(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [updateDismissed, setUpdateDismissed] = useState(false);
    
    // Installed templates state
    const [installedTemplates, setInstalledTemplates] = useState([]);
    const [templateUpdatesCount, setTemplateUpdatesCount] = useState(0);
    
    // Background slideshow settings
    const [bgInterval, setBgInterval] = useState(15);
    const [bgCategory, setBgCategory] = useState('all');
    
    // Sub-user role-based access
    const getSubUserData = () => {
        try {
            const raw = localStorage.getItem('servercraft_sub_user');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    };
    const subUserData = getSubUserData();
    const isSubUser = !!subUserData;
    const userRole = subUserData?.role || 'admin';
    const userPermissions = subUserData?.permissions || ['*'];
    const assignedServers = subUserData?.assigned_servers || [];
    
    const hasPermission = (perm) => {
        if (!isSubUser) return true; // Admin panel user = full access
        if (userPermissions.includes('*')) return true;
        return userPermissions.includes(perm);
    };
    
    // Nav tabs filtered by role
    const getVisibleNavTabs = () => {
        const allTabs = ['dashboard', 'servers', ...(settings.clustering_enabled ? ['clusters'] : []), 'steamcmd', 'workshop', 'marketplace', 'users', 'feedback', 'settings', 'about'];
        
        if (!isSubUser) return allTabs; // Admin = all tabs
        
        if (userRole === 'admin') return allTabs;
        
        if (userRole === 'moderator') {
            // Moderators: can see servers, workshop, marketplace, feedback, about
            return allTabs.filter(t => !['users', 'settings', 'steamcmd', 'clusters'].includes(t));
        }
        
        if (userRole === 'viewer') {
            // Viewers: dashboard, servers (read-only), marketplace (browse), about
            return ['dashboard', 'servers', 'marketplace', 'about'];
        }
        
        return allTabs;
    };
    
    // Refs for WebSocket and intervals
    const statsWsRef = useRef(null);
    const pollIntervalRef = useRef(null);
    
    // Reset activity timer on user interaction
    const resetActivityTimer = useCallback(() => {
        lastActivityRef.current = Date.now();
    }, []);
    
    // Set up activity listeners
    useEffect(() => {
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, resetActivityTimer));
        return () => {
            events.forEach(event => window.removeEventListener(event, resetActivityTimer));
        };
    }, [resetActivityTimer]);
    
    // AFK check interval - uses inline logout to avoid declaration order issues
    useEffect(() => {
        if (!isAuthenticated) return;
        
        const checkAFK = async () => {
            const rememberMe = localStorage.getItem('servercraft_remember_me') === 'true';
            
            // Don't auto-logout if remember me is enabled
            if (rememberMe) return;
            
            const timeSinceActivity = Date.now() - lastActivityRef.current;
            if (timeSinceActivity > AFK_TIMEOUT) {
                // Auto logout due to inactivity - inline logout
                const token = localStorage.getItem('servercraft_auth_token');
                if (token) {
                    try {
                        await fetch(`${API_BASE}/api/auth/logout?token=${token}`, { method: 'POST' });
                    } catch (err) {
                        // Ignore logout errors
                    }
                }
                localStorage.removeItem('servercraft_auth_token');
                setAuthToken(null);
                setIsAuthenticated(false);
                setShowLoginScreen(true);
                setMustChangePassword(false);
                setNeedsSecurityQuestions(false);
            }
        };
        
        afkTimeoutRef.current = setInterval(checkAFK, 60000); // Check every minute
        return () => {
            if (afkTimeoutRef.current) clearInterval(afkTimeoutRef.current);
        };
    }, [isAuthenticated, AFK_TIMEOUT]);
    
    // Validate session on mount
    useEffect(() => {
        const validateStoredSession = async () => {
            // Check first-run setup before anything else
            try {
                const setupRes = await fetch(`${API_BASE}/api/setup/status`);
                const setupData = await setupRes.json();
                if (setupData.needs_setup) {
                    setNeedsFirstRunSetup(true);
                    setAuthLoading(false);
                    return;
                }
            } catch (e) {
                // Backend unreachable — fall through to normal login
            }

            const savedToken = localStorage.getItem('servercraft_auth_token');
            const savedSubUser = localStorage.getItem('servercraft_sub_user');

            if (!savedToken) {
                setAuthLoading(false);
                setShowLoginScreen(true);
                return;
            }
            
            // Check if this is a sub-user session
            if (savedSubUser) {
                try {
                    const response = await fetch(`${API_BASE}/api/sub-users/validate?sub_token=${savedToken}`, {
                        method: 'POST'
                    });
                    const data = await response.json();
                    
                    if (data && data.valid) {
                        const subUserData = JSON.parse(savedSubUser);
                        setAuthToken(savedToken);
                        setIsAuthenticated(true);
                        setCurrentUsername(`${subUserData.username} (${subUserData.role_label})`);
                        setMustChangePassword(false);
                        setNeedsSecurityQuestions(false);
                        setShowLoginScreen(false);
                        setAuthLoading(false);
                        return;
                    }
                } catch (error) {
                    console.error('Sub-user session validation error:', error);
                }
                // Sub-user token invalid, clear and fall through
                localStorage.removeItem('servercraft_sub_user');
            }
            
            // Try admin session validation
            try {
                const response = await fetch(`${API_BASE}/api/auth/validate?token=${savedToken}`, {
                    method: 'POST'
                });
                const data = await response.json();
                
                if (data.valid) {
                    setAuthToken(savedToken);
                    setIsAuthenticated(true);
                    setCurrentUsername(data.username);
                    setMustChangePassword(data.must_change_password);
                    setNeedsSecurityQuestions(!data.has_security_questions);
                    setShowLoginScreen(false);
                } else {
                    // Token invalid, clear it
                    localStorage.removeItem('servercraft_auth_token');
                    localStorage.removeItem('servercraft_remember_me');
                    localStorage.removeItem('servercraft_sub_user');
                    setShowLoginScreen(true);
                }
            } catch (error) {
                console.error('Session validation error:', error);
                setShowLoginScreen(true);
            }
            
            setAuthLoading(false);
        };
        
        validateStoredSession();
    }, []);
    
    // Handle login
    const handleLogin = async (username, password, rememberMe, completedLoginData = null) => {
        try {
            // If completedLoginData is provided, we're completing a 2FA login
            if (completedLoginData) {
                setAuthToken(completedLoginData.token);
                setIsAuthenticated(true);
                setCurrentUsername(completedLoginData.username);
                setMustChangePassword(completedLoginData.must_change_password || false);
                setNeedsSecurityQuestions(!completedLoginData.has_security_questions);
                setShowLoginScreen(false);
                return { success: true };
            }
            
            // Regular login flow
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, remember_me: rememberMe })
            });
            
            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.detail || 'Login failed' };
            }
            
            const data = await response.json();
            
            // Check if 2FA is required
            if (data.requires_2fa) {
                return { 
                    success: true, 
                    requires_2fa: true,
                    temp_token: data.temp_token,
                    username: data.username
                };
            }
            
            // No 2FA required - complete login
            localStorage.setItem('servercraft_auth_token', data.token);
            localStorage.setItem('servercraft_remember_me', rememberMe.toString());
            localStorage.removeItem('servercraft_sub_user');
            
            setAuthToken(data.token);
            setIsAuthenticated(true);
            setCurrentUsername(data.username);
            setMustChangePassword(data.must_change_password);
            setNeedsSecurityQuestions(!data.has_security_questions);
            setShowLoginScreen(false);
            
            return { success: true };
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    };
    
    // Handle sub-user login
    const handleSubUserLogin = async (username, password) => {
        try {
            const response = await fetch(`${API_BASE}/api/sub-users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.detail || 'Login failed' };
            }
            
            const data = await response.json();
            
            localStorage.setItem('servercraft_auth_token', data.token);
            localStorage.setItem('servercraft_sub_user', JSON.stringify({
                user_id: data.user_id,
                username: data.username,
                role: data.role,
                role_label: data.role_label,
                assigned_servers: data.assigned_servers,
                permissions: data.permissions
            }));
            
            setAuthToken(data.token);
            setIsAuthenticated(true);
            setCurrentUsername(`${data.username} (${data.role_label})`);
            setMustChangePassword(false);
            setNeedsSecurityQuestions(false);
            setShowLoginScreen(false);
            
            return { success: true };
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    };
    
    // Handle logout
    const handleLogout = async (isAFK = false) => {
        const token = localStorage.getItem('servercraft_auth_token');
        
        if (token) {
            try {
                await fetch(`${API_BASE}/api/auth/logout?token=${token}`, { method: 'POST' });
            } catch (err) {
                // Ignore logout API errors - user still gets logged out locally
            }
        }
        
        localStorage.removeItem('servercraft_auth_token');
        localStorage.removeItem('servercraft_sub_user');
        // Keep remember_me setting for next login
        
        setAuthToken(null);
        setIsAuthenticated(false);
        setShowLoginScreen(true);
        setMustChangePassword(false);
        setNeedsSecurityQuestions(false);
        
        if (isAFK) {
            showToast('You have been logged out due to inactivity', 'warning');
        }
    };
    
    // Handle password change
    const handlePasswordChange = async (currentPassword, newPassword) => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/change-password?token=${authToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            });
            
            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.detail || 'Password change failed' };
            }
            
            setMustChangePassword(false);
            showToast('Password changed successfully', 'success');
            return { success: true };
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    };
    
    // Handle username change
    const handleUsernameChange = async (newUsername) => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/change-username?token=${authToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_username: newUsername })
            });
            
            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.detail || 'Username change failed' };
            }
            
            setCurrentUsername(newUsername);
            showToast('Username changed successfully', 'success');
            return { success: true };
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    };
    
    // Handle security questions setup
    const handleSecurityQuestionsSetup = async (questions) => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/security-questions/setup?token=${authToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions })
            });
            
            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.detail || 'Setup failed' };
            }
            
            setNeedsSecurityQuestions(false);
            
            // Check if onboarding should be shown for first-time users
            const onboardingData = localStorage.getItem('servercraft_onboarding');
            if (!onboardingData) {
                setShowOnboarding(true);
            }
            
            showToast('Security questions saved', 'success');
            return { success: true };
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    };
    
    // Check if onboarding should be shown (for existing users who haven't seen it)
    useEffect(() => {
        if (!isAuthenticated || needsSecurityQuestions || mustChangePassword) return;
        
        // Skip onboarding for sub-users
        const savedSubUser = localStorage.getItem('servercraft_sub_user');
        if (savedSubUser) return;
        
        const onboardingData = localStorage.getItem('servercraft_onboarding');
        const specsAcknowledged = localStorage.getItem('servercraft_specs_acknowledged');
        
        // Show onboarding if not completed and specs modal not shown yet
        if (!onboardingData && !specsAcknowledged) {
            setShowOnboarding(true);
        } else if (!specsAcknowledged && !onboardingData) {
            // Only show specs modal if onboarding was already completed/skipped
            setShowSpecsModal(true);
        } else if (!specsAcknowledged && onboardingData) {
            // Onboarding was completed, now show specs modal
            setShowSpecsModal(true);
        }
    }, [isAuthenticated, needsSecurityQuestions, mustChangePassword]);
    
    const acknowledgeSpecs = () => {
        localStorage.setItem('servercraft_specs_acknowledged', 'true');
        setShowSpecsModal(false);
    };

    // Toast notification
    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    // Load data
    const loadGames = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/games`);
            const data = await response.json();
            setGames(data);
        } catch (error) {
            console.error('Failed to load games:', error);
        }
    }, []);
    
    // Check for ServerCraft updates
    const checkForUpdates = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/updates/check`);
            const data = await res.json();
            if (data.update_available) {
                // Check if dismissed
                const dismissedRes = await fetch(`${API_BASE}/api/updates/dismissed`);
                const dismissedData = await dismissedRes.json();
                const dismissed = dismissedData.dismissed || [];
                
                if (!dismissed.includes(data.latest_version)) {
                    setUpdateInfo(data);
                    setShowUpdateModal(true);
                } else {
                    setUpdateInfo(data);
                    setUpdateDismissed(true);
                }
            }
        } catch (e) { console.log('Update check skipped'); }
    }, []);
    
    // Load installed templates
    const loadInstalledTemplates = useCallback(async () => {
        const token = localStorage.getItem('servercraft_auth_token') || '';
        try {
            const res = await fetch(`${API_BASE}/api/templates/installed?token=${token}`);
            const data = await res.json();
            setInstalledTemplates(data.installed || []);
            setTemplateUpdatesCount(data.updates_available || 0);
        } catch (e) { console.log('Installed templates check skipped'); }
    }, []);

    const loadServers = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/servers`);
            const data = await response.json();
            setServers(data);
        } catch (error) {
            console.error('Failed to load servers:', error);
        }
    }, []);

    const checkSteamCMDStatus = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/steamcmd/status`);
            const data = await response.json();
            setSteamcmdStatus(data);
        } catch (error) {
            console.error('Failed to check SteamCMD status:', error);
        }
    }, []);

    const checkUPnPStatus = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/upnp/status`);
            const data = await response.json();
            setUpnpStatus(data);
        } catch (error) {
            console.error('Failed to check UPnP status:', error);
        }
    }, []);

    const loadSettings = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/settings`);
            const data = await response.json();
            setSettings(data);
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }, []);

    // Resource-conservative stats polling - adjusts based on server activity
    const pollSystemStats = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/stats/system`);
            if (response.ok) {
                const data = await response.json();
                setSystemStats(data);
            }
        } catch (error) {
            // Silent fail - reduce console spam
        }
    }, []);

    // Determine if any servers are running for adaptive polling
    const hasRunningServers = servers.some(s => s.status === 'running');

    // Resource-conservative polling with adaptive intervals
    useEffect(() => {
        if (!isAuthenticated) return;

        let wsConnected = false;

        // Calculate poll interval based on server activity
        const getPollInterval = () => hasRunningServers ? POLL_INTERVALS.STATS_ACTIVE : POLL_INTERVALS.STATS_IDLE;

        const connectStatsWs = () => {
            try {
                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsHost = API_BASE
                    ? API_BASE.replace(/^https?:\/\//, '')
                    : window.location.host;
                statsWsRef.current = new WebSocket(`${wsProtocol}//${wsHost}/ws/stats`);

                statsWsRef.current.onopen = () => {
                    wsConnected = true;
                    if (pollIntervalRef.current) {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                    }
                };

                statsWsRef.current.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    setSystemStats(data.system);
                };

                statsWsRef.current.onclose = () => {
                    wsConnected = false;
                    // Start resource-conservative polling fallback
                    if (!pollIntervalRef.current) {
                        pollSystemStats();
                        pollIntervalRef.current = setInterval(pollSystemStats, getPollInterval());
                    }
                    // Try to reconnect WebSocket after longer delay (resource conservative)
                    setTimeout(connectStatsWs, 10000);
                };

                statsWsRef.current.onerror = () => {
                    wsConnected = false;
                    statsWsRef.current.close();
                };
            } catch (error) {
                // Start polling fallback with adaptive interval
                if (!pollIntervalRef.current) {
                    pollSystemStats();
                    pollIntervalRef.current = setInterval(pollSystemStats, getPollInterval());
                }
            }
        };

        connectStatsWs();
        pollSystemStats();

        return () => {
            if (statsWsRef.current) {
                statsWsRef.current.close();
            }
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [isAuthenticated, pollSystemStats, hasRunningServers]);

    // Initial load with resource-conservative polling
    useEffect(() => {
        loadGames();
        loadServers();
        checkSteamCMDStatus();
        checkUPnPStatus();
        loadSettings();
        checkForUpdates();
        loadInstalledTemplates();

        // Adaptive server polling - more frequent when servers are running
        const serverPollInterval = hasRunningServers ? POLL_INTERVALS.SERVERS_ACTIVE : POLL_INTERVALS.SERVERS_IDLE;
        const interval = setInterval(loadServers, serverPollInterval);
        
        // Check for updates every hour
        const updateInterval = setInterval(checkForUpdates, 3600000);
        
        return () => { clearInterval(interval); clearInterval(updateInterval); };
    }, [loadGames, loadServers, checkSteamCMDStatus, checkUPnPStatus, loadSettings, hasRunningServers, checkForUpdates, loadInstalledTemplates]);

    // Server actions
    const startServer = async (serverId) => {
        try {
            const response = await fetch(`${API_BASE}/api/servers/${serverId}/start`, {
                method: 'POST'
            });
            if (response.ok) {
                showToast('Server starting...', 'success');
                loadServers();
            } else {
                const data = await response.json();
                showToast(data.detail || 'Failed to start server', 'error');
            }
        } catch (error) {
            showToast('Failed to start server', 'error');
        }
    };

    const stopServer = async (serverId) => {
        try {
            const response = await fetch(`${API_BASE}/api/servers/${serverId}/stop`, {
                method: 'POST'
            });
            if (response.ok) {
                showToast('Server stopped', 'success');
                loadServers();
            } else {
                const data = await response.json();
                showToast(data.detail || 'Failed to stop server', 'error');
            }
        } catch (error) {
            showToast('Failed to stop server', 'error');
        }
    };

    const restartServer = async (serverId) => {
        try {
            const response = await fetch(`${API_BASE}/api/servers/${serverId}/restart`, {
                method: 'POST'
            });
            if (response.ok) {
                showToast('Server restarting...', 'success');
                loadServers();
            } else {
                showToast('Failed to restart server', 'error');
            }
        } catch (error) {
            showToast('Failed to restart server', 'error');
        }
    };

    const installServer = async (serverId) => {
        setConsoleOutputs(prev => ({ ...prev, [serverId]: ['>>> Starting installation — output will appear below...'] }));
        showToast('Installing server files...', 'info');
        try {
            const response = await fetch(`${API_BASE}/api/servers/${serverId}/install`, {
                method: 'POST'
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Server installed successfully', 'success');
            } else {
                showToast(data.detail || 'Installation failed', 'error');
                appendConsoleOutput(serverId, `>>> ERROR: ${data.detail || 'Installation failed'}`);
            }
        } catch (error) {
            showToast('Failed to install server', 'error');
            appendConsoleOutput(serverId, '>>> ERROR: Connection to backend lost');
        }
    };

    const deleteServer = async (serverId) => {
        if (!window.confirm('Are you sure you want to delete this server?')) return;
        try {
            const response = await fetch(`${API_BASE}/api/servers/${serverId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast('Server deleted', 'success');
                closeServerTab(serverId);
                loadServers();
            } else {
                showToast('Failed to delete server', 'error');
            }
        } catch (error) {
            showToast('Failed to delete server', 'error');
        }
    };

    const createServer = async (serverData) => {
        try {
            const response = await fetch(`${API_BASE}/api/servers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverData)
            });
            if (response.ok) {
                const server = await response.json();
                showToast('Server created successfully', 'success');
                setShowCreateModal(false);
                loadServers();
                openServerTab(server.id);
            } else {
                const data = await response.json();
                showToast(data.detail || 'Failed to create server', 'error');
            }
        } catch (error) {
            showToast('Failed to create server', 'error');
        }
    };

    // Tab management
    const openServerTab = (serverId) => {
        setCurrentView('servers');
        if (!openTabs.includes(serverId)) {
            setOpenTabs(prev => [...prev, serverId]);
        }
        setActiveTab(serverId);
        loadConsoleOutput(serverId);
    };

    const closeServerTab = (serverId) => {
        setOpenTabs(prev => prev.filter(id => id !== serverId));
        if (activeTab === serverId) {
            const remaining = openTabs.filter(id => id !== serverId);
            setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1] : null);
        }
    };

    const loadConsoleOutput = async (serverId) => {
        try {
            const response = await fetch(`${API_BASE}/api/servers/${serverId}/console`);
            const data = await response.json();
            setConsoleOutputs(prev => ({ ...prev, [serverId]: data.lines || [] }));
        } catch (error) {
            console.error('Failed to load console:', error);
        }
    };

    const appendConsoleOutput = (serverId, line) => {
        setConsoleOutputs(prev => ({
            ...prev,
            [serverId]: [...(prev[serverId] || []), line],
        }));
    };

    const sendConsoleCommand = async (serverId, command) => {
        try {
            await fetch(`${API_BASE}/api/servers/${serverId}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });
            setConsoleOutputs(prev => ({
                ...prev,
                [serverId]: [...(prev[serverId] || []), `> ${command}`]
            }));
        } catch (error) {
            showToast('Failed to send command', 'error');
        }
    };

    // SteamCMD actions
    const installSteamCMD = async () => {
        showToast('Installing SteamCMD...', 'info');
        try {
            const response = await fetch(`${API_BASE}/api/steamcmd/install`, {
                method: 'POST'
            });
            if (response.ok) {
                showToast('SteamCMD installed successfully', 'success');
                checkSteamCMDStatus();
            } else {
                showToast('Failed to install SteamCMD', 'error');
            }
        } catch (error) {
            showToast('Failed to install SteamCMD', 'error');
        }
    };

    const steamLogin = async (username, password, guardCode) => {
        try {
            const response = await fetch(`${API_BASE}/api/steamcmd/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, guard_code: guardCode || null })
            });
            const data = await response.json();
            if (data.requires_guard) {
                showToast('Steam Guard code required', 'info');
                return { requiresGuard: true };
            } else if (data.success) {
                showToast('Logged in successfully', 'success');
                checkSteamCMDStatus();
                return { success: true };
            } else {
                showToast(data.error || 'Login failed', 'error');
                return { error: data.error };
            }
        } catch (error) {
            showToast('Login failed', 'error');
            return { error: 'Login failed' };
        }
    };

    const steamLogout = async () => {
        try {
            await fetch(`${API_BASE}/api/steamcmd/logout`, { method: 'POST' });
            showToast('Logged out', 'success');
            checkSteamCMDStatus();
        } catch (error) {
            showToast('Logout failed', 'error');
        }
    };

    // Calculate stats
    const runningServers = servers.filter(s => s.status === 'running').length;
    const stoppedServers = servers.filter(s => s.status !== 'running').length;
    
    // Show loading screen while checking auth
    if (authLoading) {
        return (
            <div className="auth-loading">
                <div className="auth-loading-content">
                    <i className="fas fa-gamepad fa-spin"></i>
                    <p>Loading ServerCraft...</p>
                </div>
            </div>
        );
    }
    
    // First-run setup — show before login on a fresh install
    if (needsFirstRunSetup) {
        return (
            <>
                <BackgroundSlideshow intervalSeconds={bgInterval} category={bgCategory} key="setup-bg" />
                <FirstRunSetupScreen
                    apiBase={API_BASE}
                    onComplete={() => {
                        setNeedsFirstRunSetup(false);
                        setShowLoginScreen(true);
                    }}
                />
            </>
        );
    }

    // Show login screen if not authenticated
    if (showLoginScreen || !isAuthenticated) {
        return (
            <>
                <BackgroundSlideshow intervalSeconds={bgInterval} category={bgCategory} key="login-bg" />
                <LoginScreen
                    onLogin={handleLogin}
                    onSubUserLogin={handleSubUserLogin}
                    showPasswordReset={showPasswordReset}
                    setShowPasswordReset={setShowPasswordReset}
                />
            </>
        );
    }
    
    // Show password change screen if required
    if (mustChangePassword) {
        return (
            <>
                <BackgroundSlideshow intervalSeconds={bgInterval} category={bgCategory} key="pwchange-bg" />
                <PasswordChangeScreen
                currentUsername={currentUsername}
                isFirstTime={true}
                onPasswordChange={handlePasswordChange}
                onUsernameChange={handleUsernameChange}
                onLogout={handleLogout}
            />
            </>
        );
    }
    
    // Show security questions setup if needed
    if (needsSecurityQuestions) {
        return (
            <SecurityQuestionsSetup
                onSetup={handleSecurityQuestionsSetup}
                onSkip={() => setNeedsSecurityQuestions(false)}
            />
        );
    }
    
    // Show onboarding wizard if not completed
    if (showOnboarding && !onboardingCompleted) {
        return (
            <OnboardingWizard
                systemStats={systemStats}
                upnpStatus={upnpStatus}
                onComplete={(data) => {
                    setOnboardingCompleted(true);
                    setShowOnboarding(false);
                    showToast('Welcome to ServerCraft! You\'re all set up.', 'success');
                }}
                onSkip={() => {
                    setShowOnboarding(false);
                    showToast('You can always access setup guides in the About tab', 'info');
                }}
            />
        );
    }

    return (
        <div className="app">
            {/* Background Slideshow - same key as login so React preserves timer */}
            <BackgroundSlideshow intervalSeconds={bgInterval} category={bgCategory} key="dashboard-bg" />
            
            {/* Snowflakes - Only show in winter months (Dec-Feb) */}
            <Snowflakes />
            
            {/* Header */}
            <header className="app-header">
                <div className="header-brand">
                    <span className="brand-icon"><ServerCraftLogo size={28} /></span>
                    <span className="brand-text">ServerCraft</span>
                    <span className="brand-edition">Linux</span>
                </div>
                <nav className="header-nav">
                    {getVisibleNavTabs().map(view => (
                        <button
                            key={view}
                            className={`nav-btn ${currentView === view ? 'active' : ''}`}
                            onClick={() => setCurrentView(view)}
                            data-testid={`nav-${view}`}
                        >
                            {view.charAt(0).toUpperCase() + view.slice(1)}
                        </button>
                    ))}
                </nav>
                <div className="header-actions">
                    <span className="user-badge" title="Logged in as">
                        <i className={`fas ${isSubUser ? (userRole === 'moderator' ? 'fa-user-cog' : userRole === 'viewer' ? 'fa-eye' : 'fa-user-shield') : 'fa-user'}`}></i> {currentUsername}
                    </span>
                    {isSubUser && (
                        <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', background: userRole === 'admin' ? 'rgba(239,68,68,0.12)' : userRole === 'moderator' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)', color: userRole === 'admin' ? '#ef4444' : userRole === 'moderator' ? '#f59e0b' : '#3b82f6' }} data-testid="role-badge">
                            {subUserData?.role_label || userRole}
                        </span>
                    )}
                    <span className="version-badge" data-testid="version-badge">v2026.3.0-BETA</span>
                    {updateInfo && updateDismissed && (
                        <button onClick={() => { setShowUpdateModal(true); setUpdateDismissed(false); }} title="Update available" data-testid="update-available-badge" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px', color: '#22c55e', fontWeight: '600', marginLeft: '4px' }}>
                            <i className="fas fa-arrow-circle-up"></i> {updateInfo.latest_version}
                        </button>
                    )}
                    <button className="logout-btn" onClick={() => handleLogout(false)} title="Logout">
                        <i className="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="app-main">
                {/* Dashboard */}
                {currentView === 'dashboard' && (
                    <DashboardView
                        systemStats={systemStats}
                        servers={isSubUser && userRole !== 'admin' && assignedServers.length > 0 ? servers.filter(s => assignedServers.includes(s.id)) : servers}
                        games={games}
                        runningServers={runningServers}
                        stoppedServers={stoppedServers}
                        onStartServer={hasPermission('server.start') ? startServer : null}
                        onStopServer={hasPermission('server.stop') ? stopServer : null}
                        onOpenServer={openServerTab}
                        onNavigate={setCurrentView}
                    />
                )}

                {/* Servers */}
                {currentView === 'servers' && (
                    <ServersView
                        servers={isSubUser && userRole !== 'admin' && assignedServers.length > 0 ? servers.filter(s => assignedServers.includes(s.id)) : servers}
                        games={games}
                        openTabs={openTabs}
                        activeTab={activeTab}
                        consoleOutputs={consoleOutputs}
                        onOpenTab={openServerTab}
                        onCloseTab={closeServerTab}
                        onSetActiveTab={setActiveTab}
                        onStartServer={hasPermission('server.start') ? startServer : null}
                        onStopServer={hasPermission('server.stop') ? stopServer : null}
                        onRestartServer={hasPermission('server.restart') ? restartServer : null}
                        onInstallServer={hasPermission('server.start') ? installServer : null}
                        onDeleteServer={!isSubUser ? deleteServer : null}
                        onSendCommand={hasPermission('server.command') ? sendConsoleCommand : null}
                        onCreateServer={!isSubUser ? () => setShowCreateModal(true) : null}
                        onAppendConsole={appendConsoleOutput}
                    />
                )}

                {/* Clusters - Only show if enabled in settings */}
                {currentView === 'clusters' && settings.clustering_enabled && (
                    <ClustersView showToast={showToast} />
                )}

                {/* SteamCMD */}
                {currentView === 'steamcmd' && (
                    <SteamCMDView
                        status={steamcmdStatus}
                        onInstall={installSteamCMD}
                        onLogin={steamLogin}
                        onLogout={steamLogout}
                    />
                )}

                {/* Workshop */}
                {currentView === 'workshop' && (
                    <WorkshopView games={games} showToast={showToast} />
                )}

                {/* Marketplace (Disabled Preview) */}
                {currentView === 'marketplace' && (
                    <MarketplaceView showToast={showToast} />
                )}

                {/* Sub-User Management - Admin only */}
                {currentView === 'users' && (
                    isSubUser && userRole !== 'admin' ? (
                        <section className="view-section" data-testid="access-denied-users">
                            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                                <i className="fas fa-lock" style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px', display: 'block' }}></i>
                                <h2>Access Restricted</h2>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>User management is only accessible to administrators.</p>
                            </div>
                        </section>
                    ) : (
                        <SubUserManagementView showToast={showToast} />
                    )
                )}

                {/* Feedback */}
                {currentView === 'feedback' && (
                    <FeedbackView showToast={showToast} />
                )}

                {/* Settings - Admin only */}
                {currentView === 'settings' && (
                    isSubUser && userRole !== 'admin' ? (
                        <section className="view-section" data-testid="access-denied">
                            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                                <i className="fas fa-lock" style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px', display: 'block' }}></i>
                                <h2>Access Restricted</h2>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Settings are only accessible to administrators. Contact your admin for access.</p>
                            </div>
                        </section>
                    ) : (
                    <SettingsView
                        settings={settings}
                        upnpStatus={upnpStatus}
                        showToast={showToast}
                        bgInterval={bgInterval}
                        setBgInterval={setBgInterval}
                        bgCategory={bgCategory}
                        setBgCategory={setBgCategory}
                    />
                    )
                )}

                {/* About */}
                {currentView === 'about' && (
                    <AboutView />
                )}
            </main>

            {/* Footer */}
            <footer className="app-footer" data-testid="app-footer">
                <span>© 2026 TierOne Development</span>
            </footer>

            {/* Create Server Modal */}
            {showCreateModal && (
                <CreateServerModal
                    games={games}
                    onClose={() => setShowCreateModal(false)}
                    onCreate={createServer}
                />
            )}

            {/* System Specs Acknowledgment Modal */}
            {showSpecsModal && (
                <SpecsAcknowledgmentModal onAcknowledge={acknowledgeSpecs} />
            )}

            {/* ServerCraft Self-Update Modal */}
            {showUpdateModal && updateInfo && (
                <div className="modal" data-testid="update-modal" style={{ zIndex: 10000 }}>
                    <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.7)' }}></div>
                    <div className="modal-content" style={{ maxWidth: '560px', border: '2px solid rgba(34,197,94,0.3)', boxShadow: '0 0 40px rgba(34,197,94,0.1)' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ borderBottom: '1px solid rgba(34,197,94,0.2)', padding: '20px 24px' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <i className="fas fa-arrow-circle-up" style={{ color: '#22c55e' }}></i>
                                ServerCraft Update Available
                            </h3>
                        </div>
                        <div className="modal-body" style={{ padding: '24px', textAlign: 'center' }}>
                            {/* Update type badge */}
                            <div style={{ marginBottom: '16px' }}>
                                <span style={{ 
                                    padding: '4px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase',
                                    background: updateInfo.update_type === 'major' ? 'rgba(59,130,246,0.15)' : updateInfo.update_type === 'hotfix' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                                    color: updateInfo.update_type === 'major' ? '#3b82f6' : updateInfo.update_type === 'hotfix' ? '#f59e0b' : '#22c55e'
                                }}>
                                    {updateInfo.update_type === 'major' ? 'Major Update' : updateInfo.update_type === 'hotfix' ? 'Hotfix' : updateInfo.update_type === 'feature' ? 'Feature Update' : 'Beta'}
                                </span>
                            </div>
                            
                            {/* Version comparison */}
                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '20px' }}>
                                <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                                    <small style={{ color: 'var(--text-secondary)', display: 'block' }}>Current</small>
                                    <div style={{ fontWeight: '700', fontSize: '16px' }}>{updateInfo.current_version}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', color: '#22c55e', fontSize: '20px' }}>
                                    <i className="fas fa-arrow-right"></i>
                                </div>
                                <div style={{ padding: '12px 20px', background: 'rgba(34,197,94,0.08)', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.2)' }}>
                                    <small style={{ color: '#22c55e', display: 'block' }}>New</small>
                                    <div style={{ fontWeight: '700', fontSize: '16px', color: '#22c55e' }}>{updateInfo.latest_version}</div>
                                </div>
                            </div>
                            
                            {/* Release name */}
                            {updateInfo.release_name && updateInfo.release_name !== updateInfo.latest_version && (
                                <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)' }}>"{updateInfo.release_name}"</h4>
                            )}
                            
                            {/* Changelog */}
                            {updateInfo.changelog && (
                                <div style={{ textAlign: 'left', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto', marginBottom: '16px', fontSize: '13px', lineHeight: '1.6' }}>
                                    <strong style={{ display: 'block', marginBottom: '6px' }}>What's New:</strong>
                                    <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{updateInfo.changelog.slice(0, 500)}{updateInfo.changelog.length > 500 ? '...' : ''}</div>
                                </div>
                            )}
                            
                            {/* Download assets */}
                            {updateInfo.assets?.length > 0 && (
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                    {updateInfo.assets.map((asset, i) => (
                                        <span key={i}>{asset.name} ({asset.size_mb} MB){i < updateInfo.assets.length - 1 ? ' | ' : ''}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer" style={{ padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button 
                                className="btn" 
                                data-testid="update-now-btn"
                                onClick={() => { window.open(updateInfo.html_url || GITHUB_RELEASES_PAGE, '_blank'); }}
                                style={{ background: '#22c55e', color: '#fff', padding: '10px 32px', fontSize: '15px', fontWeight: '700', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                            >
                                <i className="fas fa-download"></i> Yes, Update Now
                            </button>
                            <button 
                                className="btn"
                                data-testid="update-later-btn"
                                onClick={async () => { 
                                    setShowUpdateModal(false); 
                                    setUpdateDismissed(true);
                                    await fetch(`${API_BASE}/api/updates/dismiss?version=${updateInfo.latest_version}`, { method: 'POST' });
                                }}
                                style={{ background: '#ef4444', color: '#fff', padding: '10px 32px', fontSize: '15px', fontWeight: '700', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                            >
                                <i className="fas fa-clock"></i> No, Update Later
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Container */}
            <div id="toast-container" data-testid="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// System Specs Acknowledgment Modal
function SpecsAcknowledgmentModal({ onAcknowledge }) {
    return (
        <div className="modal specs-modal" data-testid="specs-modal" onClick={onAcknowledge}>
            <div className="modal-overlay"></div>
            <div className="modal-content specs-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><i className="fas fa-exclamation-triangle"></i> System Requirements</h2>
                    <button className="modal-close" onClick={onAcknowledge}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <p className="specs-intro">
                        ServerCraft manages game servers which can be resource-intensive. 
                        Please review the requirements below before proceeding.
                    </p>
                    
                    <div className="specs-section">
                        <h3><i className="fas fa-circle" style={{color: '#ef4444', fontSize: '10px', marginRight: '8px'}}></i>Minimum Requirements</h3>
                        <div className="specs-grid">
                            <div className="spec-item">
                                <span className="spec-label">CPU:</span>
                                <span className="spec-value">4 Cores / 4 Threads</span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">RAM:</span>
                                <span className="spec-value">8 GB</span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">Storage:</span>
                                <span className="spec-value">50 GB SSD</span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">Network:</span>
                                <span className="spec-value">10 Mbps Up/Down</span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">OS:</span>
                                <span className="spec-value">Ubuntu 22.04+ / Debian 12+</span>
                            </div>
                        </div>
                    </div>

                    <div className="specs-section">
                        <h3><i className="fas fa-circle" style={{color: '#22c55e', fontSize: '10px', marginRight: '8px'}}></i>Recommended Requirements</h3>
                        <div className="specs-grid">
                            <div className="spec-item">
                                <span className="spec-label">CPU:</span>
                                <span className="spec-value">8+ Cores / 16 Threads</span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">RAM:</span>
                                <span className="spec-value">32 GB or more</span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">Storage:</span>
                                <span className="spec-value">500 GB+ NVMe SSD</span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">Network:</span>
                                <span className="spec-value">100+ Mbps Up/Down</span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">OS:</span>
                                <span className="spec-value">Ubuntu 24.04 LTS / Debian 12</span>
                            </div>
                        </div>
                    </div>

                    <div className="specs-note">
                        <h4><i className="fas fa-chart-bar"></i> Resource Usage Notes:</h4>
                        <ul>
                            <li><strong>ServerCraft Panel:</strong> ~50MB RAM, &lt;1% CPU when idle</li>
                            <li><strong>Per Game Server:</strong> 2-16 GB RAM depending on game and player count</li>
                            <li><strong>Network:</strong> Varies by game - typically 1-5 Mbps per connected player</li>
                        </ul>
                    </div>

                    <div className="specs-warning">
                        <p><i className="fas fa-exclamation-triangle" style={{color: '#ef4444', marginRight: '8px'}}></i>Running game servers below minimum specifications may result in:</p>
                        <ul>
                            <li>Poor server performance and lag</li>
                            <li>Crashes and instability</li>
                            <li>Degraded gaming experience for players</li>
                        </ul>
                    </div>

                    <div className="specs-resource-warning">
                        <p><i className="fas fa-exclamation-triangle" style={{color: '#eab308', marginRight: '8px'}}></i>Running game servers can use an undetermined amount of resources in heavier instances like large gunfights, large scale maps and more. Please ensure your Linux host has enough resources available before setting up ServerCraft.</p>
                    </div>

                    <div className="specs-disclaimer">
                        <p><strong>DISCLAIMER:</strong> TierOne Development is not responsible for any damage done to any servers, computers or the hardware ServerCraft is running on. Absolutely no warranty will be given when running ServerCraft.</p>
                    </div>
                </div>
                <div className="modal-footer">
                    <button 
                        className="btn btn-green" 
                        onClick={onAcknowledge}
                        data-testid="acknowledge-specs-btn"
                    >
                        I acknowledge the risks of running ServerCraft with below the minimum Spec&apos;d recommendation
                    </button>
                </div>
            </div>
        </div>
    );
}

// Dashboard View Component
function DashboardView({ systemStats, servers, games, runningServers, stoppedServers, onStartServer, onStopServer, onOpenServer, onNavigate }) {
    const updateGauge = (percent) => {
        const dashLength = (percent / 100) * 110;
        return `${dashLength} 110`;
    };

    return (
        <section className="view active" data-testid="dashboard-view">
            <div className="view-header">
                <h1>Dashboard</h1>
                <p className="subtitle">System Overview & Server Status</p>
            </div>

            {/* System Stats */}
            <div className="stats-grid">
                <div className="stat-card" data-testid="stat-cpu">
                    <div className="stat-header">
                        <span className="stat-icon"><i className="fas fa-microchip"></i></span>
                        <span className="stat-title">CPU</span>
                    </div>
                    <div className="stat-gauge">
                        <svg viewBox="0 0 100 50" className="gauge-svg">
                            <path className="gauge-bg" d="M10,45 A35,35 0 0,1 90,45"></path>
                            <path className="gauge-fill gauge-blue" d="M10,45 A35,35 0 0,1 90,45" 
                                  strokeDasharray={updateGauge(systemStats?.cpu?.percent || 0)}></path>
                        </svg>
                        <div className="gauge-value">{Math.round(systemStats?.cpu?.percent || 0)}%</div>
                    </div>
                    <div className="stat-details">
                        <span>{systemStats?.cpu?.cores || 0} Cores</span>
                    </div>
                </div>

                <div className="stat-card" data-testid="stat-memory">
                    <div className="stat-header">
                        <span className="stat-icon"><i className="fas fa-memory"></i></span>
                        <span className="stat-title">Memory</span>
                    </div>
                    <div className="stat-gauge">
                        <svg viewBox="0 0 100 50" className="gauge-svg">
                            <path className="gauge-bg" d="M10,45 A35,35 0 0,1 90,45"></path>
                            <path className="gauge-fill gauge-green" d="M10,45 A35,35 0 0,1 90,45" 
                                  strokeDasharray={updateGauge(systemStats?.memory?.percent || 0)}></path>
                        </svg>
                        <div className="gauge-value">{Math.round(systemStats?.memory?.percent || 0)}%</div>
                    </div>
                    <div className="stat-details">
                        <span>{systemStats?.memory?.used_gb || 0} / {systemStats?.memory?.total_gb || 0} GB</span>
                    </div>
                </div>

                <div className="stat-card" data-testid="stat-network">
                    <div className="stat-header">
                        <span className="stat-icon"><i className="fas fa-wifi"></i></span>
                        <span className="stat-title">Network</span>
                    </div>
                    <div className="network-stats">
                        <div className="network-row">
                            <span className="network-label">↑ Upload</span>
                            <span className="network-value">{systemStats?.network?.upload_speed_mbps?.toFixed(2) || '0.00'} MB/s</span>
                        </div>
                        <div className="network-row">
                            <span className="network-label">↓ Download</span>
                            <span className="network-value">{systemStats?.network?.download_speed_mbps?.toFixed(2) || '0.00'} MB/s</span>
                        </div>
                    </div>
                </div>

                <div className="stat-card" data-testid="stat-disk">
                    <div className="stat-header">
                        <span className="stat-icon"><i className="fas fa-hdd"></i></span>
                        <span className="stat-title">Disk</span>
                    </div>
                    <div className="stat-gauge">
                        <svg viewBox="0 0 100 50" className="gauge-svg">
                            <path className="gauge-bg" d="M10,45 A35,35 0 0,1 90,45"></path>
                            <path className="gauge-fill gauge-brown" d="M10,45 A35,35 0 0,1 90,45" 
                                  strokeDasharray={updateGauge(systemStats?.disk?.percent || 0)}></path>
                        </svg>
                        <div className="gauge-value">{Math.round(systemStats?.disk?.percent || 0)}%</div>
                    </div>
                    <div className="stat-details">
                        <span>{systemStats?.disk?.used_gb || 0} / {systemStats?.disk?.total_gb || 0} GB</span>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="quick-stats">
                <div className="quick-stat" data-testid="total-servers-card">
                    <span className="quick-stat-value">{servers.length}</span>
                    <span className="quick-stat-label">Total Servers</span>
                </div>
                <div className="quick-stat" data-testid="running-servers-card">
                    <span className="quick-stat-value">{runningServers}</span>
                    <span className="quick-stat-label">Running</span>
                </div>
                <div className="quick-stat" data-testid="stopped-servers-card">
                    <span className="quick-stat-value">{stoppedServers}</span>
                    <span className="quick-stat-label">Stopped</span>
                </div>
            </div>

            {/* Server Overview */}
            <div className="section">
                <div className="section-header">
                    <h2>Server Overview</h2>
                </div>
                <div className="server-grid" data-testid="server-overview">
                    {servers.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-icon"><i className="fas fa-server"></i></span>
                            <p>No servers yet. Create your first server to get started!</p>
                            <button className="btn btn-blue" onClick={() => onNavigate('servers')} data-testid="create-server-btn">
                                Create Server
                            </button>
                        </div>
                    ) : (
                        servers.map(server => (
                            <div key={server.id} className="server-card" onClick={() => onOpenServer(server.id)}>
                                <div className="server-card-header">
                                    <div>
                                        <div className="server-card-title">{server.name}</div>
                                        <div className="server-card-game">{games[server.game]?.name || server.game}</div>
                                        {games[server.game]?.tags && (
                                            <div className="server-card-tags">
                                                {games[server.game].tags.slice(0, 3).map((tag, idx) => (
                                                    <span key={idx} className="game-tag" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}>
                                                        #{tag.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`status-indicator status-${server.status}`}>
                                        <span className="status-dot"></span>
                                        <span>{server.status}</span>
                                    </div>
                                </div>
                                <div className="server-card-stats">
                                    <div className="server-stat">
                                        <span className="server-stat-label">Port:</span>
                                        <span className="server-stat-value">{server.port}</span>
                                    </div>
                                    <div className="server-stat">
                                        <span className="server-stat-label">Players:</span>
                                        <span className="server-stat-value">0/{server.max_players}</span>
                                    </div>
                                </div>
                                <div className="server-card-actions">
                                    {server.status === 'running' ? (
                                        <button className="btn btn-red btn-sm" onClick={(e) => { e.stopPropagation(); onStopServer(server.id); }}>Stop</button>
                                    ) : (
                                        <button className="btn btn-green btn-sm" onClick={(e) => { e.stopPropagation(); onStartServer(server.id); }}>Start</button>
                                    )}
                                    <button className="btn btn-gray btn-sm" onClick={(e) => { e.stopPropagation(); onOpenServer(server.id); }}>Manage</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
}

// Servers View Component
function ServersView({ servers, games, openTabs, activeTab, consoleOutputs, onOpenTab, onCloseTab, onSetActiveTab, onStartServer, onStopServer, onRestartServer, onInstallServer, onDeleteServer, onSendCommand, onCreateServer, onAppendConsole }) {
    const [commandInput, setCommandInput] = useState('');
    const [serverSubTab, setServerSubTab] = useState('console');
    const [serverFiles, setServerFiles] = useState([]);
    const [filesPath, setFilesPath] = useState('');
    const [filesLoading, setFilesLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const consoleWsRef = useRef(null);
    const consoleBottomRef = useRef(null);
    const fileInputRef = useRef(null);
    const activeServer = servers.find(s => s.id === activeTab);

    // Console WebSocket — reconnect whenever active server tab changes
    useEffect(() => {
        if (consoleWsRef.current) {
            consoleWsRef.current.close();
            consoleWsRef.current = null;
        }
        if (!activeTab) return;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = API_BASE
            ? API_BASE.replace(/^https?:\/\//, '')
            : window.location.host;
        const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/console/${activeTab}`);

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.line != null) {
                    onAppendConsole(activeTab, msg.line);
                }
            } catch (e) {}
        };
        ws.onerror = () => {};
        consoleWsRef.current = ws;

        return () => { ws.close(); };
    }, [activeTab]);

    // Auto-scroll console to bottom when new lines arrive
    useEffect(() => {
        consoleBottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [consoleOutputs, activeTab]);

    // Reset file browser when switching servers
    useEffect(() => {
        setFilesPath('');
        setServerFiles([]);
    }, [activeTab]);

    const handleSendCommand = () => {
        if (!commandInput.trim() || !activeTab) return;
        const ws = consoleWsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(`CMD:${commandInput.trim()}`);
        } else if (onSendCommand) {
            onSendCommand(activeTab, commandInput.trim());
        }
        setCommandInput('');
    };

    const loadFiles = async (path = '') => {
        if (!activeTab) return;
        setFilesLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/servers/${activeTab}/files?path=${encodeURIComponent(path)}`);
            const data = await res.json();
            setServerFiles(data.files || []);
            setFilesPath(path);
        } catch (e) {}
        setFilesLoading(false);
    };

    const handleSubTabChange = (tab) => {
        setServerSubTab(tab);
        if (tab === 'files') loadFiles('');
    };

    const handleFileDrop = async (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) await doUpload(file);
    };

    const doUpload = async (file) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(
                `${API_BASE}/api/servers/${activeTab}/files/upload?path=${encodeURIComponent(filesPath)}`,
                { method: 'POST', body: formData }
            );
            if (res.ok) loadFiles(filesPath);
        } catch (e) {}
        setUploading(false);
    };

    const deleteFile = async (name, isDir) => {
        if (!window.confirm(`Delete ${isDir ? 'folder' : 'file'} "${name}"? This cannot be undone.`)) return;
        const fp = filesPath ? `${filesPath}/${name}` : name;
        await fetch(`${API_BASE}/api/servers/${activeTab}/files/${encodeURIComponent(fp)}`, { method: 'DELETE' });
        loadFiles(filesPath);
    };

    const navigateTo = (folder) => {
        const newPath = filesPath ? `${filesPath}/${folder}` : folder;
        loadFiles(newPath);
    };

    const navigateUp = () => {
        const parts = filesPath.split('/').filter(Boolean);
        parts.pop();
        loadFiles(parts.join('/'));
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    return (
        <section className="view active" data-testid="servers-view">
            <div className="view-header">
                <h1>Servers</h1>
                <button className="btn btn-green" onClick={onCreateServer} data-testid="new-server-btn">
                    <span>+</span> New Server
                </button>
            </div>

            {/* Server Tabs */}
            <div className="server-tabs">
                <div className="tabs-container">
                    {openTabs.map(serverId => {
                        const server = servers.find(s => s.id === serverId);
                        if (!server) return null;
                        return (
                            <button
                                key={serverId}
                                className={`server-tab ${activeTab === serverId ? 'active' : ''}`}
                                onClick={() => onSetActiveTab(serverId)}
                            >
                                <span className="status-dot" style={{ background: `var(--status-${server.status})` }}></span>
                                <span>{server.name}</span>
                                <span className="tab-close" onClick={(e) => { e.stopPropagation(); onCloseTab(serverId); }}>&times;</span>
                            </button>
                        );
                    })}
                </div>
                <button className="tab-add-btn" onClick={onCreateServer} data-testid="tab-add-btn">+</button>
            </div>

            {/* Server Content */}
            <div className="server-content" data-testid="server-content">
                {!activeServer ? (
                    <div className="empty-state">
                        <span className="empty-icon"><i className="fas fa-terminal"></i></span>
                        <p>Select a server tab or create a new server</p>
                    </div>
                ) : (
                    <div className="server-panel active">
                        <div className="server-panel-header">
                            <div className="server-panel-title">
                                <span className="status-dot" style={{ background: `var(--status-${activeServer.status})`, width: '12px', height: '12px' }}></span>
                                <h3>{activeServer.name}</h3>
                                <span className={`status-badge status-${activeServer.status}`}>{activeServer.status}</span>
                            </div>
                            <div className="server-panel-controls">
                                {activeServer.status === 'running' ? (
                                    <>
                                        <button className="btn btn-red" onClick={() => onStopServer(activeServer.id)}>⏹ Stop</button>
                                        <button className="btn btn-brown" onClick={() => onRestartServer(activeServer.id)}><i className="fas fa-sync-alt"></i> Restart</button>
                                    </>
                                ) : (
                                    <button className="btn btn-green" onClick={() => onStartServer(activeServer.id)}>▶ Start</button>
                                )}
                                <button className="btn btn-blue" onClick={() => onInstallServer(activeServer.id)}><i className="fas fa-download"></i> Install/Update</button>
                                <button className="btn btn-gray" onClick={() => onDeleteServer(activeServer.id)}><i className="fas fa-trash-alt"></i> Delete</button>
                            </div>
                        </div>

                        <div className="server-panel-stats">
                            <div className="panel-stat">
                                <div className="panel-stat-value">0%</div>
                                <div className="panel-stat-label">CPU</div>
                            </div>
                            <div className="panel-stat">
                                <div className="panel-stat-value">0 MB</div>
                                <div className="panel-stat-label">Memory</div>
                            </div>
                            <div className="panel-stat">
                                <div className="panel-stat-value">0/{activeServer.max_players}</div>
                                <div className="panel-stat-label">Players</div>
                            </div>
                            <div className="panel-stat">
                                <div className="panel-stat-value">0h 0m</div>
                                <div className="panel-stat-label">Uptime</div>
                            </div>
                        </div>

                        {/* Sub-tab switcher: Console | Files */}
                        <div className="server-subtabs">
                            <button
                                className={`server-subtab ${serverSubTab === 'console' ? 'active' : ''}`}
                                onClick={() => handleSubTabChange('console')}
                            >
                                <i className="fas fa-terminal" style={{ marginRight: 6 }}></i>Console
                            </button>
                            <button
                                className={`server-subtab ${serverSubTab === 'files' ? 'active' : ''}`}
                                onClick={() => handleSubTabChange('files')}
                            >
                                <i className="fas fa-folder-open" style={{ marginRight: 6 }}></i>Files
                            </button>
                        </div>

                        {/* Console tab */}
                        {serverSubTab === 'console' && (
                            <div className="console-container">
                                <div className="console">
                                    <div className="console-output">
                                        {(consoleOutputs[activeServer.id] || []).map((line, i) => (
                                            <div key={i} className="console-line">{line}</div>
                                        ))}
                                        <div ref={consoleBottomRef} />
                                    </div>
                                    <div className="console-input-container">
                                        <input
                                            type="text"
                                            className="console-input"
                                            placeholder="Enter command..."
                                            value={commandInput}
                                            onChange={(e) => setCommandInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSendCommand()}
                                        />
                                        <button className="console-send" onClick={handleSendCommand}>Send</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Files tab */}
                        {serverSubTab === 'files' && (
                            <div className="file-browser">
                                {/* Toolbar */}
                                <div className="file-browser-toolbar">
                                    <div className="file-breadcrumb">
                                        <button onClick={() => loadFiles('')}>root</button>
                                        {filesPath.split('/').filter(Boolean).map((seg, i, arr) => {
                                            const path = arr.slice(0, i + 1).join('/');
                                            return (
                                                <span key={path}>
                                                    <span style={{ color: 'var(--text-secondary)', margin: '0 3px' }}>/</span>
                                                    <button onClick={() => loadFiles(path)}>{seg}</button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                    {filesPath && (
                                        <button className="file-action-btn" onClick={navigateUp}>⬆ Up</button>
                                    )}
                                    <button className="file-action-btn" onClick={() => loadFiles(filesPath)}>↻ Refresh</button>
                                    <button
                                        className="file-action-btn"
                                        style={{ borderColor: '#6366f1', color: '#6366f1' }}
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                    >
                                        {uploading ? 'Uploading...' : '⬆ Upload File'}
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        style={{ display: 'none' }}
                                        onChange={(e) => e.target.files[0] && doUpload(e.target.files[0])}
                                    />
                                </div>

                                {/* Drag-and-drop upload zone */}
                                <div
                                    className="upload-zone"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleFileDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploading ? 'Uploading...' : 'Drop a file here or click to upload mods / configs'}
                                </div>

                                {/* File table */}
                                {filesLoading ? (
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '8px 0' }}>Loading...</div>
                                ) : serverFiles.length === 0 ? (
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '8px 0' }}>
                                        No files found. Install the server first or upload files above.
                                    </div>
                                ) : (
                                    <table className="file-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Size</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {serverFiles.map(f => (
                                                <tr key={f.name}>
                                                    <td>
                                                        {f.is_dir ? (
                                                            <button className="file-name-btn" onClick={() => navigateTo(f.name)}>
                                                                📁 {f.name}
                                                            </button>
                                                        ) : (
                                                            <span>📄 {f.name}</span>
                                                        )}
                                                    </td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>
                                                        {f.is_dir ? '—' : formatSize(f.size)}
                                                    </td>
                                                    <td>
                                                        <div className="file-actions">
                                                            {!f.is_dir && (
                                                                <a
                                                                    className="file-action-btn"
                                                                    href={`${API_BASE}/api/servers/${activeServer.id}/files/download/${filesPath ? filesPath + '/' + f.name : f.name}`}
                                                                    download={f.name}
                                                                >
                                                                    ⬇ Download
                                                                </a>
                                                            )}
                                                            <button
                                                                className="file-action-btn danger"
                                                                onClick={() => deleteFile(f.name, f.is_dir)}
                                                            >
                                                                🗑 Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        <div className="card" style={{ margin: 'var(--spacing-md)' }}>
                            <div className="card-header">
                                <h3>Server Configuration</h3>
                            </div>
                            <div className="card-body">
                                <div className="info-row">
                                    <span className="info-label">Game:</span>
                                    <span className="info-value">{games[activeServer.game]?.name || activeServer.game}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Port:</span>
                                    <span className="info-value">{activeServer.port}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Query Port:</span>
                                    <span className="info-value">{activeServer.query_port || 'N/A'}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Max Players:</span>
                                    <span className="info-value">{activeServer.max_players}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">UPnP:</span>
                                    <span className="info-value">{activeServer.upnp_enabled ? 'Enabled' : 'Disabled'}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Auto-Start:</span>
                                    <span className="info-value">{activeServer.auto_start ? 'Yes' : 'No'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

// SteamCMD View Component
function SteamCMDView({ status, onInstall, onLogin, onLogout }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [guardCode, setGuardCode] = useState('');
    const [showGuardInput, setShowGuardInput] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        const result = await onLogin(username, password, guardCode || null);
        setIsLoggingIn(false);
        if (result.requiresGuard) {
            setShowGuardInput(true);
        } else if (result.success) {
            setShowGuardInput(false);
            setUsername('');
            setPassword('');
            setGuardCode('');
        }
    };

    return (
        <section className="view active" data-testid="steamcmd-view">
            <div className="view-header">
                <h1>SteamCMD</h1>
                <p className="subtitle">Steam Command Line Tool Management</p>
            </div>

            <div className="steamcmd-content">
                <div className="card">
                    <div className="card-header">
                        <h3>SteamCMD Status</h3>
                        <span className={`status-badge ${status.installed ? 'status-installed' : 'status-not-installed'}`} data-testid="steamcmd-status">
                            {status.installed ? 'Installed' : 'Not Installed'}
                        </span>
                    </div>
                    <div className="card-body">
                        {!status.installed ? (
                            <div className="steamcmd-install-prompt">
                                <p>SteamCMD is not installed. Click below to install it.</p>
                                <button className="btn btn-blue" onClick={onInstall} data-testid="install-steamcmd-btn">
                                    Install SteamCMD
                                </button>
                            </div>
                        ) : (
                            <div className="steamcmd-info">
                                <div className="info-row">
                                    <span className="info-label">Path:</span>
                                    <span className="info-value">{status.path}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Logged In:</span>
                                    <span className="info-value">{status.logged_in ? 'Yes' : 'No'}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Username:</span>
                                    <span className="info-value">{status.username || '-'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3>Steam Login</h3>
                    </div>
                    <div className="card-body">
                        <p className="card-description">Some games require Steam account ownership to download server files.</p>
                        <form onSubmit={handleLogin}>
                            <div className="form-group">
                                <label>Username</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Steam username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    data-testid="steam-username-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    placeholder="Steam password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    data-testid="steam-password-input"
                                />
                            </div>
                            {showGuardInput && (
                                <div className="form-group">
                                    <label>Steam Guard Code</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Enter code from email/app"
                                        value={guardCode}
                                        onChange={(e) => setGuardCode(e.target.value)}
                                        maxLength={5}
                                        data-testid="steam-guard-input"
                                    />
                                    <p className="form-hint">Check your email or Steam app for the code</p>
                                </div>
                            )}
                            <div className="form-actions">
                                {!status.logged_in ? (
                                    <button type="submit" className="btn btn-blue" disabled={isLoggingIn} data-testid="steam-login-btn">
                                        {isLoggingIn ? 'Logging in...' : 'Login'}
                                    </button>
                                ) : (
                                    <button type="button" className="btn btn-gray" onClick={onLogout} data-testid="steam-logout-btn">
                                        Logout
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
}

// Workshop View Component
function WorkshopView({ games, showToast }) {
    const [selectedGame, setSelectedGame] = useState('');
    const [modId, setModId] = useState('');
    const [parsedMods, setParsedMods] = useState([]);
    const [workshopTab, setWorkshopTab] = useState('browse'); // browse, download, import, installed
    const [searchQuery, setSearchQuery] = useState('');
    const [installedMods, setInstalledMods] = useState({});
    const [workshopStatus, setWorkshopStatus] = useState(null);
    const [loadingMods, setLoadingMods] = useState(false);
    
    // API key & search state
    const [steamApiKey, setSteamApiKey] = useState('');
    const [hasSteamApiKey, setHasSteamApiKey] = useState(false);
    const [apiKeyMasked, setApiKeyMasked] = useState('');
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchTotal, setSearchTotal] = useState(0);
    const [cacheStats, setCacheStats] = useState(null);
    
    const getToken = () => localStorage.getItem('servercraft_auth_token') || '';

    // Load workshop status and installed mods on mount
    useEffect(() => {
        const loadWorkshopData = async () => {
            try {
                const statusRes = await fetch(`${API_BASE}/api/workshop/status`);
                if (statusRes.ok) {
                    const status = await statusRes.json();
                    setWorkshopStatus(status);
                    setHasSteamApiKey(status.has_steam_api_key || false);
                    setApiKeyMasked(status.steam_api_key_masked || '');
                    setCacheStats(status.cache_stats || null);
                }
            } catch (error) {
                console.log('Failed to load workshop status');
            }
        };
        loadWorkshopData();
    }, []);

    // Load installed mods when switching to installed tab or selecting a game
    useEffect(() => {
        const loadInstalledMods = async () => {
            if (workshopTab === 'installed') {
                setLoadingMods(true);
                try {
                    const res = await fetch(`${API_BASE}/api/workshop/mods`);
                    if (res.ok) {
                        const data = await res.json();
                        setInstalledMods(data);
                    }
                } catch (error) {
                    console.log('Failed to load installed mods');
                } finally {
                    setLoadingMods(false);
                }
            }
        };
        loadInstalledMods();
    }, [workshopTab]);

    const deleteMod = async (game, modId) => {
        try {
            const res = await fetch(`${API_BASE}/api/workshop/mods/${game}/${modId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                showToast('Mod deleted successfully', 'success');
                // Refresh mods list
                const modsRes = await fetch(`${API_BASE}/api/workshop/mods`);
                if (modsRes.ok) {
                    setInstalledMods(await modsRes.json());
                }
            } else {
                showToast('Failed to delete mod', 'error');
            }
        } catch (error) {
            showToast('Failed to delete mod', 'error');
        }
    };

    const handleModlistUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const response = await fetch(`${API_BASE}/api/workshop/parse-modlist`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ game: 'arma3', html_content: event.target.result })
                });
                const data = await response.json();
                setParsedMods(data.mod_ids);
                showToast(`Found ${data.count} mods`, 'success');
            } catch (error) {
                showToast('Failed to parse modlist', 'error');
            }
        };
        reader.readAsText(file);
    };

    const downloadMod = async (e) => {
        e.preventDefault();
        let extractedModId = modId;
        const urlMatch = modId.match(/id=(\d+)/);
        if (urlMatch) extractedModId = urlMatch[1];

        try {
            const response = await fetch(`${API_BASE}/api/workshop/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game: selectedGame, mod_ids: [extractedModId] })
            });
            if (response.ok) {
                showToast('Mod download started', 'success');
            } else {
                showToast('Failed to download mod', 'error');
            }
        } catch (error) {
            showToast('Failed to download mod', 'error');
        }
    };

    const downloadAllParsedMods = async () => {
        if (parsedMods.length === 0) return;
        showToast('Starting mod downloads...', 'info');
        try {
            const response = await fetch(`${API_BASE}/api/workshop/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game: 'arma3', mod_ids: parsedMods })
            });
            const data = await response.json();
            const cacheInfo = data.from_cache ? ` (${data.from_cache} from cache)` : '';
            showToast(`Downloaded ${data.downloaded}/${data.total} mods${cacheInfo}`, data.success ? 'success' : 'error');
        } catch (error) {
            showToast('Failed to download mods', 'error');
        }
    };
    
    const saveSteamApiKey = async () => {
        if (!steamApiKey.trim()) { showToast('Please enter your Steam API key', 'error'); return; }
        try {
            const res = await fetch(`${API_BASE}/api/workshop/api-key?token=${getToken()}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: steamApiKey })
            });
            const data = await res.json();
            if (data.success) {
                setHasSteamApiKey(true);
                setApiKeyMasked(data.masked);
                setSteamApiKey('');
                setShowApiKeyInput(false);
                showToast('Steam API key saved! You can now search mods.', 'success');
                // Refresh workshop status to update cache stats
                try {
                    const statusRes = await fetch(`${API_BASE}/api/workshop/status`);
                    if (statusRes.ok) {
                        const status = await statusRes.json();
                        setWorkshopStatus(status);
                        setCacheStats(status.cache_stats || null);
                    }
                } catch (e) {}
            }
        } catch (e) { showToast('Failed to save key', 'error'); }
    };
    
    const removeSteamApiKey = async () => {
        try {
            await fetch(`${API_BASE}/api/workshop/api-key?token=${getToken()}`, { method: 'DELETE' });
            setHasSteamApiKey(false);
            setApiKeyMasked('');
            setSearchResults([]);
            showToast('Steam API key removed', 'info');
        } catch (e) { showToast('Failed to remove key', 'error'); }
    };
    
    const searchWorkshopMods = async (page = 1) => {
        if (!selectedGame) { showToast('Select a game first', 'error'); return; }
        if (!hasSteamApiKey) { showToast('Steam API key required. Add your key above.', 'error'); return; }
        setSearchLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/workshop/search?game=${selectedGame}&query=${encodeURIComponent(searchQuery)}&page=${page}&token=${getToken()}`);
            const data = await res.json();
            if (data.success) {
                setSearchResults(data.mods || []);
                setSearchTotal(data.total || 0);
            } else {
                showToast(data.error || 'Search failed', 'error');
            }
        } catch (e) { showToast('Search failed', 'error'); }
        setSearchLoading(false);
    };
    
    const downloadSearchMod = async (modIdToDownload) => {
        if (!selectedGame) return;
        showToast('Downloading mod...', 'info');
        try {
            const res = await fetch(`${API_BASE}/api/workshop/download`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game: selectedGame, mod_ids: [modIdToDownload] })
            });
            const data = await res.json();
            if (data.success || data.downloaded > 0) {
                const fromCache = data.from_cache > 0 ? ' (from cache!)' : '';
                showToast(`Mod downloaded successfully${fromCache}`, 'success');
            } else { showToast('Download failed', 'error'); }
        } catch (e) { showToast('Download failed', 'error'); }
    };
    
    // WebSocket mod download progress
    const [downloadProgress, setDownloadProgress] = useState(null);
    const [downloadLog, setDownloadLog] = useState([]);
    const wsRef = useRef(null);
    
    const startBatchDownloadWs = (game, modIds) => {
        if (!game || modIds.length === 0) return;
        
        const wsProtocol = API_BASE.startsWith('https') ? 'wss' : 'ws';
        const wsHost = API_BASE.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}://${wsHost}/ws/mod-download`;
        
        setDownloadProgress({ total: modIds.length, downloaded: 0, from_cache: 0, failed: 0, percent: 0, active: true, current_mod: '' });
        setDownloadLog([]);
        
        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;
            
            ws.onopen = () => {
                ws.send(JSON.stringify({ action: 'download_batch', game, mod_ids: modIds }));
            };
            
            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                
                if (msg.type === 'batch_start') {
                    setDownloadLog(prev => [...prev, `Starting batch: ${msg.total} mods for ${msg.game_name}`]);
                } else if (msg.type === 'mod_start') {
                    setDownloadProgress(prev => prev ? { ...prev, percent: msg.percent, current_mod: msg.mod_id } : prev);
                    setDownloadLog(prev => [...prev, `[${msg.index}/${msg.total}] Downloading ${msg.mod_id}...`]);
                } else if (msg.type === 'mod_complete') {
                    setDownloadProgress(prev => prev ? { ...prev, downloaded: (prev.downloaded || 0) + 1, from_cache: (prev.from_cache || 0) + (msg.from_cache ? 1 : 0), percent: msg.percent } : prev);
                    setDownloadLog(prev => [...prev, `[${msg.index}/${msg.total}] ${msg.mod_id} - ${msg.from_cache ? 'Restored from cache' : 'Downloaded'}`]);
                } else if (msg.type === 'mod_failed') {
                    setDownloadProgress(prev => prev ? { ...prev, failed: (prev.failed || 0) + 1, percent: msg.percent } : prev);
                    setDownloadLog(prev => [...prev, `[${msg.index}/${msg.total}] ${msg.mod_id} - FAILED: ${msg.error}`]);
                } else if (msg.type === 'batch_complete') {
                    setDownloadProgress(prev => prev ? { ...prev, percent: 100, active: false, downloaded: msg.downloaded, from_cache: msg.from_cache, failed: msg.failed } : prev);
                    setDownloadLog(prev => [...prev, `Batch complete: ${msg.downloaded} downloaded, ${msg.from_cache} from cache, ${msg.failed} failed`]);
                    showToast(`Batch download complete: ${msg.downloaded}/${msg.total} mods${msg.from_cache > 0 ? ` (${msg.from_cache} from cache)` : ''}`, msg.failed > 0 ? 'warning' : 'success');
                    ws.close();
                } else if (msg.type === 'error') {
                    showToast(msg.message, 'error');
                    setDownloadProgress(prev => prev ? { ...prev, active: false } : prev);
                }
            };
            
            ws.onerror = () => {
                showToast('WebSocket connection error - falling back to HTTP', 'warning');
                setDownloadProgress(null);
            };
            
            ws.onclose = () => { wsRef.current = null; };
        } catch (e) {
            showToast('Failed to start WebSocket download', 'error');
            setDownloadProgress(null);
        }
    };

    // Get games that have workshop support
    const workshopGames = Object.entries(games).filter(([key, game]) => game.workshop_id);

    return (
        <section className="view active" data-testid="workshop-view">
            <div className="view-header">
                <h1><i className="fas fa-wrench"></i> Workshop</h1>
                <p className="subtitle">Steam Workshop Mod Management - Browse & Download Mods</p>
            </div>

            {/* Workshop Navigation Tabs */}
            <div className="workshop-tabs">
                <button 
                    className={`workshop-tab ${workshopTab === 'browse' ? 'active' : ''}`}
                    onClick={() => setWorkshopTab('browse')}
                >
                    <i className="fas fa-globe"></i> Browse Mods
                </button>
                <button 
                    className={`workshop-tab ${workshopTab === 'download' ? 'active' : ''}`}
                    onClick={() => setWorkshopTab('download')}
                >
                    <i className="fas fa-download"></i> Download by ID
                </button>
                <button 
                    className={`workshop-tab ${workshopTab === 'import' ? 'active' : ''}`}
                    onClick={() => setWorkshopTab('import')}
                >
                    <i className="fas fa-file-import"></i> Import Modlist
                </button>
                <button 
                    className={`workshop-tab ${workshopTab === 'installed' ? 'active' : ''}`}
                    onClick={() => setWorkshopTab('installed')}
                >
                    <i className="fas fa-box"></i> Installed Mods
                </button>
            </div>

            <div className="workshop-content">
                {/* Browse Mods Tab */}
                {workshopTab === 'browse' && (
                    <div className="workshop-browse">
                        <div className="card">
                            <div className="card-header">
                                <h3><i className="fas fa-globe"></i> Browse Steam Workshop</h3>
                            </div>
                            <div className="card-body">
                                {/* Steam API Key Section */}
                                <div style={{ padding: '14px 16px', background: hasSteamApiKey ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.08)', borderRadius: '8px', border: `1px solid ${hasSteamApiKey ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`, marginBottom: '16px' }} data-testid="steam-api-key-section">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <i className={`fas ${hasSteamApiKey ? 'fa-check-circle' : 'fa-key'}`} style={{ color: hasSteamApiKey ? '#22c55e' : '#f59e0b', fontSize: '18px' }}></i>
                                            <div>
                                                <strong style={{ color: hasSteamApiKey ? '#22c55e' : '#f59e0b' }}>
                                                    {hasSteamApiKey ? 'Steam API Key Active' : 'Steam Web API Key Required'}
                                                </strong>
                                                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                    {hasSteamApiKey 
                                                        ? `Key: ${apiKeyMasked} - You can now search and browse mods directly.`
                                                        : <>Get your free key at <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>steamcommunity.com/dev/apikey</a></>
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {hasSteamApiKey ? (
                                                <>
                                                    <button className="btn btn-gray btn-sm" onClick={() => setShowApiKeyInput(!showApiKeyInput)}><i className="fas fa-edit"></i> Change</button>
                                                    <button className="btn btn-danger btn-sm" onClick={removeSteamApiKey}><i className="fas fa-trash"></i></button>
                                                </>
                                            ) : (
                                                <button className="btn btn-primary btn-sm" onClick={() => setShowApiKeyInput(true)} data-testid="add-api-key-btn"><i className="fas fa-plus"></i> Add Key</button>
                                            )}
                                        </div>
                                    </div>
                                    {showApiKeyInput && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                            <input type="password" className="form-input" placeholder="Paste your Steam Web API key here" value={steamApiKey} onChange={e => setSteamApiKey(e.target.value)} style={{ flex: 1 }} data-testid="steam-api-key-input" />
                                            <button className="btn btn-green btn-sm" onClick={saveSteamApiKey} data-testid="save-api-key-btn"><i className="fas fa-save"></i> Save</button>
                                            <button className="btn btn-gray btn-sm" onClick={() => setShowApiKeyInput(false)}><i className="fas fa-times"></i></button>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Cache Stats */}
                                {cacheStats && cacheStats.total_cached > 0 && (
                                    <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.15)', marginBottom: '16px', fontSize: '13px' }}>
                                        <i className="fas fa-database" style={{ color: '#3b82f6', marginRight: '8px' }}></i>
                                        <strong>Mod Cache:</strong> {cacheStats.total_cached} mods cached ({cacheStats.total_size_mb} MB) | {cacheStats.cache_hits} cache hits
                                    </div>
                                )}
                                
                                <div className="workshop-game-select">
                                    <label>Select Game:</label>
                                    <select 
                                        value={selectedGame} 
                                        onChange={(e) => { setSelectedGame(e.target.value); setSearchResults([]); }}
                                        className="form-select"
                                    >
                                        <option value="">-- Select a game --</option>
                                        {workshopGames.map(([key, game]) => (
                                            <option key={key} value={key}>
                                                {game.name} {!game.requires_ownership && '(No ownership required)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {selectedGame && games[selectedGame] && (
                                    <div className="selected-game-info">
                                        <div className="game-info-header">
                                            <h4>{games[selectedGame].name}</h4>
                                            <div className="game-tags-list">
                                                {games[selectedGame].tags?.map((tag, idx) => (
                                                    <span key={idx} className="game-tag-large" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}>
                                                        #{tag.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="game-description">{games[selectedGame].description}</p>
                                        {/* TeamSpeak 3 licensing notice */}
                                        {games[selectedGame].license_notice && (
                                            <div style={{ padding: '12px 16px', background: 'rgba(255,140,0,0.08)', borderRadius: '8px', border: '1px solid rgba(255,140,0,0.2)', borderLeft: '4px solid #ff8c00', marginBottom: '12px' }} data-testid="ts3-license-notice">
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                    <i className="fas fa-exclamation-triangle" style={{ color: '#ff8c00', marginTop: '2px' }}></i>
                                                    <div>
                                                        <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--text-primary)' }}>{games[selectedGame].license_notice}</p>
                                                        {games[selectedGame].license_url && (
                                                            <a href={games[selectedGame].license_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '500' }}>
                                                                <i className="fas fa-external-link-alt"></i> {games[selectedGame].license_url}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="game-workshop-link">
                                            <a href={`https://steamcommunity.com/app/${games[selectedGame].workshop_id}/workshop/`} target="_blank" rel="noopener noreferrer" className="btn btn-blue btn-sm">
                                                <i className="fas fa-external-link-alt"></i> Open Steam Workshop
                                            </a>
                                            <span className="workshop-id">Workshop ID: {games[selectedGame].workshop_id}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="workshop-search" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <input 
                                        type="text" 
                                        placeholder={hasSteamApiKey ? "Search mods by name..." : "Add Steam API key to enable search"} 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && searchWorkshopMods()}
                                        className="form-input"
                                        disabled={!hasSteamApiKey}
                                        data-testid="workshop-search-input"
                                        style={{ flex: 1 }}
                                    />
                                    <button className="btn btn-primary" onClick={() => searchWorkshopMods()} disabled={!hasSteamApiKey || !selectedGame || searchLoading} data-testid="workshop-search-btn">
                                        <i className={`fas ${searchLoading ? 'fa-spinner fa-spin' : 'fa-search'}`}></i> Search
                                    </button>
                                </div>
                                
                                {/* Search Results */}
                                {searchResults.length > 0 && (
                                    <div style={{ marginTop: '16px' }}>
                                        <h4 style={{ margin: '0 0 10px 0' }}><i className="fas fa-search"></i> Results ({searchTotal} total)</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {searchResults.map(mod => (
                                                <div key={mod.id} data-testid={`search-result-${mod.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                    {mod.preview_url && <img src={mod.preview_url} alt="" style={{ width: '64px', height: '64px', borderRadius: '6px', objectFit: 'cover' }} />}
                                                    <div style={{ flex: 1 }}>
                                                        <strong>{mod.title}</strong>
                                                        {mod.cached && <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>CACHED</span>}
                                                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{mod.description}</p>
                                                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                            <span><i className="fas fa-users"></i> {mod.subscriptions?.toLocaleString()}</span>
                                                            <span><i className="fas fa-star"></i> {mod.favorited?.toLocaleString()}</span>
                                                            {mod.file_size > 0 && <span><i className="fas fa-file"></i> {(mod.file_size / 1024 / 1024).toFixed(1)} MB</span>}
                                                            {mod.tags?.slice(0, 3).map((t, i) => <span key={i} style={{ color: '#6b7280' }}>#{t}</span>)}
                                                        </div>
                                                    </div>
                                                    <button className="btn btn-green btn-sm" onClick={() => downloadSearchMod(mod.id)} data-testid={`download-mod-${mod.id}`}>
                                                        <i className="fas fa-download"></i> {mod.cached ? 'Restore' : 'Download'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Download by ID Tab */}
                {workshopTab === 'download' && (
                    <div className="workshop-download">
                        <div className="card">
                            <div className="card-header">
                                <h3><i className="fas fa-download"></i> Download Mod by ID</h3>
                            </div>
                            <div className="card-body">
                                <p className="card-description">Enter a Steam Workshop URL or Mod ID to download directly.</p>
                                <form onSubmit={downloadMod} className="mod-download-form">
                                    <div className="form-group">
                                        <label>Game:</label>
                                        <select value={selectedGame} onChange={(e) => setSelectedGame(e.target.value)} className="form-select" required>
                                            <option value="">Select Game</option>
                                            {workshopGames.map(([key, game]) => (
                                                <option key={key} value={key}>{game.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Workshop URL or Mod ID:</label>
                                        <input 
                                            type="text" 
                                            placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=123456 or 123456" 
                                            value={modId}
                                            onChange={(e) => setModId(e.target.value)}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="btn btn-green">Download Mod</button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Import Modlist Tab */}
                {workshopTab === 'import' && (
                    <div className="workshop-import">
                        <div className="card">
                            <div className="card-header">
                                <h3><i className="fas fa-file-import"></i> Arma 3 Modlist Import</h3>
                            </div>
                            <div className="card-body">
                                <p className="card-description">Upload your Arma 3 modlist.html file to automatically import mods.</p>
                                <div className="file-upload-zone" data-testid="modlist-dropzone">
                                    <input type="file" accept=".html" onChange={handleModlistUpload} style={{ display: 'none' }} id="modlist-file" />
                                    <span className="upload-icon"><i className="fas fa-file-upload"></i></span>
                                    <p>Drop modlist.html here or <button className="link-btn" onClick={() => document.getElementById('modlist-file').click()}>browse</button></p>
                                </div>
                                {parsedMods.length > 0 && (
                                    <div className="modlist-preview">
                                        <h4>Found Mods: {parsedMods.length}</h4>
                                        <div className="mod-list" data-testid="mod-list">
                                            {parsedMods.map(id => (
                                                <div key={id} className="mod-item"><span>{id}</span></div>
                                            ))}
                                        </div>
                                        <button className="btn btn-green" onClick={() => startBatchDownloadWs('arma3', parsedMods)} disabled={downloadProgress?.active} data-testid="download-mods-btn">
                                            {downloadProgress?.active ? <><i className="fas fa-spinner fa-spin"></i> Downloading...</> : <><i className="fas fa-download"></i> Download All Mods</>}
                                        </button>
                                    </div>
                                )}
                                
                                {/* Download Progress */}
                                {downloadProgress && (
                                    <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(34,197,94,0.06)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.15)' }} data-testid="download-progress">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <strong>{downloadProgress.active ? 'Downloading...' : 'Download Complete'}</strong>
                                            <span style={{ color: '#22c55e', fontWeight: '600' }}>{downloadProgress.percent}%</span>
                                        </div>
                                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                                            <div style={{ height: '100%', width: `${downloadProgress.percent}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            <span><i className="fas fa-check" style={{ color: '#22c55e' }}></i> {downloadProgress.downloaded || 0} downloaded</span>
                                            <span><i className="fas fa-database" style={{ color: '#3b82f6' }}></i> {downloadProgress.from_cache || 0} from cache</span>
                                            {downloadProgress.failed > 0 && <span><i className="fas fa-times" style={{ color: '#ef4444' }}></i> {downloadProgress.failed} failed</span>}
                                            {downloadProgress.current_mod && downloadProgress.active && <span><i className="fas fa-spinner fa-spin"></i> {downloadProgress.current_mod}</span>}
                                        </div>
                                        {downloadLog.length > 0 && (
                                            <div style={{ marginTop: '10px', maxHeight: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '8px', fontSize: '11px', fontFamily: 'monospace' }}>
                                                {downloadLog.map((line, i) => (
                                                    <div key={i} style={{ color: line.includes('FAILED') ? '#ef4444' : line.includes('cache') ? '#3b82f6' : 'var(--text-secondary)', padding: '1px 0' }}>{line}</div>
                                                ))}
                                            </div>
                                        )}
                                        {!downloadProgress.active && (
                                            <button className="btn btn-gray btn-sm" onClick={() => setDownloadProgress(null)} style={{ marginTop: '8px' }}>
                                                <i className="fas fa-times"></i> Dismiss
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Installed Mods Tab */}
                {workshopTab === 'installed' && (
                    <div className="workshop-installed">
                        <div className="card">
                            <div className="card-header">
                                <h3><i className="fas fa-box"></i> Installed Mods</h3>
                                <span className="header-badge">
                                    {Object.values(installedMods).reduce((acc, g) => acc + g.count, 0)} total
                                </span>
                            </div>
                            <div className="card-body">
                                {/* Workshop Status */}
                                {workshopStatus && (
                                    <div className="workshop-status-bar">
                                        <span className={`status-item ${workshopStatus.steamcmd_installed ? 'status-ok' : 'status-warn'}`}>
                                            {workshopStatus.steamcmd_installed ? <i className="fas fa-check-circle"></i> : <i className="fas fa-exclamation-triangle"></i>} SteamCMD: {workshopStatus.steamcmd_installed ? 'Installed' : 'Not Installed'}
                                        </span>
                                        <span className={`status-item ${workshopStatus.logged_in ? 'status-ok' : 'status-info'}`}>
                                            {workshopStatus.logged_in ? <i className="fas fa-check-circle"></i> : <i className="fas fa-info-circle"></i>} Steam: {workshopStatus.logged_in ? 'Logged In' : 'Anonymous'}
                                        </span>
                                    </div>
                                )}

                                <div className="workshop-game-select">
                                    <label>Filter by Game:</label>
                                    <select 
                                        value={selectedGame} 
                                        onChange={(e) => setSelectedGame(e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="">All Games</option>
                                        {workshopGames.map(([key, game]) => (
                                            <option key={key} value={key}>{game.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {loadingMods ? (
                                    <div className="loading-state">Loading mods...</div>
                                ) : Object.keys(installedMods).length === 0 ? (
                                    <div className="empty-state">
                                        <span className="empty-icon"><i className="fas fa-inbox"></i></span>
                                        <p>No mods installed yet</p>
                                        <p className="empty-hint">Download mods from the Workshop to see them here</p>
                                    </div>
                                ) : (
                                    <div className="installed-mods-by-game">
                                        {Object.entries(installedMods)
                                            .filter(([gameKey]) => !selectedGame || gameKey === selectedGame)
                                            .map(([gameKey, gameData]) => (
                                            <div key={gameKey} className="game-mods-section">
                                                <div className="game-mods-header">
                                                    <h4>{gameData.game_name}</h4>
                                                    <span className="mod-count">{gameData.count} mods</span>
                                                </div>
                                                <div className="mods-list">
                                                    {gameData.mods.map(mod => (
                                                        <div key={mod.id} className="installed-mod-item">
                                                            <div className="mod-info">
                                                                <span className="mod-name">{mod.name}</span>
                                                                <span className="mod-id">ID: {mod.id}</span>
                                                                <span className="mod-size">{mod.size_mb?.toFixed(1) || '?'} MB</span>
                                                            </div>
                                                            <div className="mod-actions">
                                                                <button 
                                                                    className="btn btn-red btn-sm"
                                                                    onClick={() => deleteMod(gameKey, mod.id)}
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

// Settings View Component
function SettingsView({ settings, upnpStatus, showToast, bgInterval, setBgInterval, bgCategory, setBgCategory }) {
    const [upnpEnabled, setUpnpEnabled] = useState(settings.upnp_enabled || false);
    const [clusteringEnabled, setClusteringEnabled] = useState(settings.clustering_enabled || false);
    
    // NPM state
    const [npmStatus, setNpmStatus] = useState({});
    const [npmUrl, setNpmUrl] = useState('');
    const [npmEmail, setNpmEmail] = useState('');
    const [npmPassword, setNpmPassword] = useState('');
    const [npmTesting, setNpmTesting] = useState(false);
    const [npmProxyHosts, setNpmProxyHosts] = useState([]);
    const [showSetupGuide, setShowSetupGuide] = useState(false);
    const [setupGuide, setSetupGuide] = useState(null);
    
    // 2FA state
    const [twoFAStatus, setTwoFAStatus] = useState({ enabled: false, setup_completed: false });
    const [showSetup2FA, setShowSetup2FA] = useState(false);
    const [qrCodeData, setQrCodeData] = useState(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [backupCodes, setBackupCodes] = useState([]);
    const [showBackupCodes, setShowBackupCodes] = useState(false);
    const [disableCode, setDisableCode] = useState('');
    
    // Sub-user state
    const [subUsers, setSubUsers] = useState([]);
    const [subUsersEnabled, setSubUsersEnabled] = useState(true);
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [newSubUser, setNewSubUser] = useState({ username: '', password: '', role: 'viewer', assigned_servers: [] });
    const [availableServers, setAvailableServers] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    
    const getToken = () => localStorage.getItem('servercraft_auth_token') || '';
    
    useEffect(() => {
        fetch2FAStatus();
        fetchNPMStatus();
        fetchSubUsers();
        fetchServers();
    }, []);
    
    const fetchNPMStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/npm/status`);
            const data = await res.json();
            setNpmStatus(data);
            if (data.url) { setNpmUrl(data.url); setNpmEmail(data.email); }
        } catch (e) { console.error('NPM status error:', e); }
    };
    
    const fetchNPMGuide = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/npm/setup-guide`);
            const data = await res.json();
            setSetupGuide(data);
            setShowSetupGuide(true);
        } catch (e) { showToast('Failed to load setup guide', 'error'); }
    };
    
    const saveNPMConnection = async () => {
        try {
            await fetch(`${API_BASE}/api/npm/connect`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: npmUrl, email: npmEmail, password: npmPassword })
            });
            showToast('NPM connection saved', 'success');
            fetchNPMStatus();
        } catch (e) { showToast('Failed to save', 'error'); }
    };
    
    const testNPMConnection = async () => {
        setNpmTesting(true);
        try {
            const res = await fetch(`${API_BASE}/api/npm/test`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast('Connected to NPM successfully!', 'success');
                fetchNPMStatus();
                // Fetch proxy hosts
                const hostsRes = await fetch(`${API_BASE}/api/npm/proxy-hosts`);
                const hostsData = await hostsRes.json();
                if (hostsData.success) setNpmProxyHosts(hostsData.hosts || []);
            } else {
                showToast(data.error || 'Connection failed', 'error');
            }
        } catch (e) { showToast('Connection test failed', 'error'); }
        setNpmTesting(false);
    };
    
    const disconnectNPM = async () => {
        await fetch(`${API_BASE}/api/npm/disconnect`, { method: 'POST' });
        setNpmStatus({});
        setNpmProxyHosts([]);
        showToast('Disconnected from NPM', 'info');
        fetchNPMStatus();
    };
    
    const fetchSubUsers = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/sub-users?token=${getToken()}`);
            const data = await res.json();
            setSubUsers(data.users || []);
            setSubUsersEnabled(data.enabled !== false);
        } catch (e) { console.error('Sub-users error:', e); }
    };
    
    const fetchServers = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/servers`);
            const data = await res.json();
            setAvailableServers(Array.isArray(data) ? data : []);
        } catch (e) { console.error('Servers error:', e); }
    };
    
    const createSubUser = async () => {
        if (!newSubUser.username || !newSubUser.password) {
            showToast('Username and password are required', 'error');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/sub-users?token=${getToken()}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSubUser)
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || 'User created', 'success');
                setShowCreateUser(false);
                setNewSubUser({ username: '', password: '', role: 'viewer', assigned_servers: [] });
                fetchSubUsers();
            } else {
                showToast(data.detail || 'Failed to create user', 'error');
            }
        } catch (e) { showToast('Failed to create user', 'error'); }
    };
    
    const deleteSubUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            const res = await fetch(`${API_BASE}/api/sub-users/${userId}?token=${getToken()}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('User deleted', 'success');
                fetchSubUsers();
            }
        } catch (e) { showToast('Failed to delete user', 'error'); }
    };
    
    const updateSubUser = async (userId, updates) => {
        try {
            const res = await fetch(`${API_BASE}/api/sub-users/${userId}?token=${getToken()}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                showToast('User updated', 'success');
                setEditingUser(null);
                fetchSubUsers();
            }
        } catch (e) { showToast('Failed to update user', 'error'); }
    };
    
    const toggleSubServerUser = (serverId) => {
        setNewSubUser(prev => {
            const servers = prev.assigned_servers.includes(serverId)
                ? prev.assigned_servers.filter(id => id !== serverId)
                : [...prev.assigned_servers, serverId];
            return { ...prev, assigned_servers: servers };
        });
    };
    
    const fetch2FAStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/2fa/status`);
            const data = await res.json();
            setTwoFAStatus(data);
        } catch (error) {
            console.error('Failed to fetch 2FA status:', error);
        }
    };
    
    const initiate2FASetup = async () => {
        const token = getToken();
        try {
            const res = await fetch(`${API_BASE}/api/auth/2fa/setup?token=${token}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setQrCodeData(data);
                setBackupCodes(data.backup_codes);
                setShowSetup2FA(true);
            } else {
                showToast(data.error || 'Failed to initiate 2FA setup', 'error');
            }
        } catch (error) {
            showToast('Failed to initiate 2FA setup', 'error');
        }
    };
    
    const verify2FASetup = async () => {
        if (verificationCode.length !== 6) {
            showToast('Please enter a 6-digit code', 'error');
            return;
        }
        const token = getToken();
        try {
            const res = await fetch(`${API_BASE}/api/auth/2fa/verify-setup?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: verificationCode })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Two-factor authentication enabled successfully!', 'success');
                setShowSetup2FA(false);
                setShowBackupCodes(true);
                fetch2FAStatus();
            } else {
                showToast(data.error || 'Invalid verification code', 'error');
            }
        } catch (error) {
            showToast('Failed to verify code', 'error');
        }
    };
    
    const disable2FA = async () => {
        if (!disableCode) {
            showToast('Please enter your current 2FA code', 'error');
            return;
        }
        const token = getToken();
        try {
            const res = await fetch(`${API_BASE}/api/auth/2fa/disable?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: disableCode })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Two-factor authentication disabled', 'success');
                setDisableCode('');
                fetch2FAStatus();
            } else {
                showToast(data.error || 'Invalid code', 'error');
            }
        } catch (error) {
            showToast('Failed to disable 2FA', 'error');
        }
    };

    const toggleUPnP = async () => {
        const newValue = !upnpEnabled;
        setUpnpEnabled(newValue);
        try {
            await fetch(`${API_BASE}/api/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ upnp_enabled: newValue })
            });
            showToast(`UPnP ${newValue ? 'enabled' : 'disabled'}`, 'success');
        } catch (error) {
            showToast('Failed to update setting', 'error');
        }
    };

    const toggleClustering = async () => {
        const newValue = !clusteringEnabled;
        setClusteringEnabled(newValue);
        try {
            await fetch(`${API_BASE}/api/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clustering_enabled: newValue })
            });
            showToast(`Node Clustering ${newValue ? 'enabled' : 'disabled'}. Refresh to see changes.`, 'success');
            // Reload settings to update nav
            window.location.reload();
        } catch (error) {
            showToast('Failed to update setting', 'error');
            setClusteringEnabled(!newValue); // Revert on error
        }
    };

    return (
        <section className="view active" data-testid="settings-view">
            <div className="view-header">
                <h1>Settings</h1>
                <p className="subtitle">Application Configuration</p>
            </div>

            <div className="settings-content">
                {/* Background Slideshow Settings */}
                <div className="card" data-testid="bg-settings-card">
                    <div className="card-header">
                        <h3><i className="fas fa-images"></i> Background Slideshow</h3>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                            Gaming screenshots cycle as the panel background. Adjust the interval and category below.
                        </p>
                        
                        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            {/* Interval Slider */}
                            <div style={{ flex: 1, minWidth: '280px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                    <i className="fas fa-clock" style={{ color: '#22c55e', marginRight: '6px' }}></i> 
                                    Background Interval (In Seconds):
                                </label>
                                <div className="bg-slider-container">
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>10s</span>
                                    <input 
                                        type="range" 
                                        className="bg-interval-slider"
                                        min="10" 
                                        max="60" 
                                        step="1"
                                        value={bgInterval} 
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setBgInterval(val);
                                            localStorage.setItem('servercraft_bg_interval', val.toString());
                                            // Update fill
                                            e.target.style.setProperty('--slider-fill', `${((val - 10) / 50) * 100}%`);
                                        }}
                                        style={{ '--slider-fill': `${((bgInterval - 10) / 50) * 100}%` }}
                                        data-testid="bg-interval-slider"
                                    />
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>60s</span>
                                    <span className="bg-slider-value" data-testid="bg-interval-value">{bgInterval}s</span>
                                </div>
                            </div>
                            
                            {/* Category Select */}
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                    <i className="fas fa-folder" style={{ color: '#22c55e', marginRight: '6px' }}></i>
                                    Image Category
                                </label>
                                <select 
                                    className="form-select" 
                                    value={bgCategory}
                                    onChange={(e) => {
                                        setBgCategory(e.target.value);
                                        localStorage.setItem('servercraft_bg_category', e.target.value);
                                    }}
                                    data-testid="bg-category-select"
                                >
                                    <option value="all">All Categories (Shuffled)</option>
                                    <option value="random">Random (10 images)</option>
                                    <option value="arma3">Arma 3 (5 images)</option>
                                    <option value="arma_reforger">Arma Reforger (2 images)</option>
                                    <option value="dayz">DayZ (8 images)</option>
                                    <option value="rust">Rust (6 images)</option>
                                    <option value="valheim">Valheim (6 images)</option>
                                    <option value="squad" disabled>Squad (coming soon)</option>
                                    <option value="project_zomboid" disabled>Project Zomboid (coming soon)</option>
                                    <option value="minecraft" disabled>Minecraft (coming soon)</option>
                                    <option value="teamspeak3" disabled>TeamSpeak 3 (coming soon)</option>
                                    <option value="ground_branch" disabled>Ground Branch (coming soon)</option>
                                    <option value="icarus" disabled>ICARUS (coming soon)</option>
                                    <option value="fivem" disabled>FiveM (coming soon)</option>
                                    <option value="source_engine" disabled>Source Engine (coming soon)</option>
                                    <option value="no_one_survived" disabled>No One Survived (coming soon)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                            <span><i className="fas fa-image"></i> Random: 10</span>
                            <span><i className="fas fa-image"></i> Arma 3: 5</span>
                            <span><i className="fas fa-image"></i> Arma Reforger: 2</span>
                            <span><i className="fas fa-image"></i> DayZ: 8</span>
                            <span><i className="fas fa-image"></i> Rust: 6</span>
                            <span><i className="fas fa-image"></i> Valheim: 6</span>
                            <span style={{ fontWeight: '600', color: '#22c55e' }}><i className="fas fa-images"></i> Total: 37 images</span>
                        </div>
                    </div>
                </div>

                {/* Nginx Proxy Manager Integration */}
                <div className="card" data-testid="npm-config-card">
                    <div className="card-header">
                        <h3><i className="fas fa-shield-alt"></i> Nginx Proxy Manager (Reverse Proxy & SSL)</h3>
                        <span className="beta-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>BETA</span>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                            Connect to your Nginx Proxy Manager instance to secure ServerCraft with SSL and custom domains. 
                            Replaces DuckDNS for easier local and remote access.
                        </p>
                        
                        {!npmStatus.connected ? (
                            <div className="npm-setup">
                                <div className="form-group">
                                    <label>NPM URL</label>
                                    <input type="text" className="form-input" placeholder="http://your-server:81" value={npmUrl} onChange={e => setNpmUrl(e.target.value)} data-testid="npm-url-input" />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input type="email" className="form-input" placeholder="admin@example.com" value={npmEmail} onChange={e => setNpmEmail(e.target.value)} data-testid="npm-email-input" />
                                    </div>
                                    <div className="form-group">
                                        <label>Password</label>
                                        <input type="password" className="form-input" placeholder="NPM password" value={npmPassword} onChange={e => setNpmPassword(e.target.value)} data-testid="npm-password-input" />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <button className="btn btn-primary" onClick={() => { saveNPMConnection(); }} data-testid="npm-save-btn">
                                        <i className="fas fa-save"></i> Save
                                    </button>
                                    <button className="btn btn-green" onClick={testNPMConnection} disabled={npmTesting} data-testid="npm-test-btn">
                                        <i className={`fas ${npmTesting ? 'fa-spinner fa-spin' : 'fa-plug'}`}></i> {npmTesting ? 'Testing...' : 'Test Connection'}
                                    </button>
                                    <button className="btn btn-gray" onClick={fetchNPMGuide} data-testid="npm-guide-btn">
                                        <i className="fas fa-book"></i> Setup Guide
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="npm-connected">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px', background: 'rgba(34,197,94,0.08)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)' }}>
                                    <i className="fas fa-check-circle" style={{ color: '#22c55e', fontSize: '20px' }}></i>
                                    <div>
                                        <strong style={{ color: '#22c55e' }}>Connected to NPM</strong>
                                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{npmStatus.url} | {npmStatus.proxy_host_count} proxy hosts | {npmStatus.ssl_cert_count} SSL certs</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-gray" onClick={testNPMConnection}><i className="fas fa-sync"></i> Refresh</button>
                                    <button className="btn btn-danger btn-sm" onClick={disconnectNPM}><i className="fas fa-unlink"></i> Disconnect</button>
                                    <button className="btn btn-gray btn-sm" onClick={fetchNPMGuide}><i className="fas fa-book"></i> Guide</button>
                                </div>
                                {npmProxyHosts.length > 0 && (
                                    <div style={{ marginTop: '16px' }}>
                                        <h4 style={{ margin: '0 0 8px 0' }}>Proxy Hosts</h4>
                                        {npmProxyHosts.slice(0, 5).map((host, i) => (
                                            <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '4px', fontSize: '13px' }}>
                                                <strong>{host.domain_names?.join(', ')}</strong> &rarr; {host.forward_host}:{host.forward_port}
                                                {host.ssl_forced && <span style={{ color: '#22c55e', marginLeft: '8px' }}><i className="fas fa-lock"></i> SSL</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Setup Guide Modal */}
                        {showSetupGuide && setupGuide && (
                            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.15)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h4 style={{ margin: 0 }}><i className="fas fa-book"></i> {setupGuide.title}</h4>
                                    <button className="btn btn-gray btn-sm" onClick={() => setShowSetupGuide(false)}><i className="fas fa-times"></i></button>
                                </div>
                                {setupGuide.steps?.map((step, i) => (
                                    <div key={i} style={{ marginBottom: '16px', paddingLeft: '16px', borderLeft: '3px solid rgba(59,130,246,0.3)' }}>
                                        <h5 style={{ color: '#3b82f6', margin: '0 0 4px 0' }}>Step {step.step}: {step.title}</h5>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>{step.description}</p>
                                        {step.commands?.map((cmd, j) => (
                                            <code key={j} style={{ display: 'block', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontSize: '12px', marginBottom: '4px', wordBreak: 'break-all' }}>{cmd}</code>
                                        ))}
                                        {step.note && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#f59e0b', fontStyle: 'italic' }}>{step.note}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sub-User Management (Beta) */}
                <div className="card" data-testid="sub-users-card">
                    <div className="card-header">
                        <h3><i className="fas fa-users-cog"></i> Sub-Server Users</h3>
                        <span className="beta-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>BETA</span>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                            Create sub-users with different permission levels to manage specific servers. 
                            Roles: <strong>Admin</strong> (full access), <strong>Moderator</strong> (manage assigned servers), <strong>Viewer</strong> (read-only).
                        </p>
                        
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button className="btn btn-green" onClick={() => setShowCreateUser(true)} data-testid="create-sub-user-btn">
                                <i className="fas fa-user-plus"></i> Create User
                            </button>
                        </div>
                        
                        {/* Create User Form */}
                        {showCreateUser && (
                            <div style={{ padding: '16px', background: 'rgba(34,197,94,0.06)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.15)', marginBottom: '16px' }}>
                                <h4 style={{ margin: '0 0 12px 0', color: '#22c55e' }}><i className="fas fa-user-plus"></i> New Sub-User</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Username</label>
                                        <input type="text" className="form-input" value={newSubUser.username} onChange={e => setNewSubUser({...newSubUser, username: e.target.value})} placeholder="username" data-testid="sub-user-username" />
                                    </div>
                                    <div className="form-group">
                                        <label>Password</label>
                                        <input type="password" className="form-input" value={newSubUser.password} onChange={e => setNewSubUser({...newSubUser, password: e.target.value})} placeholder="min 8 chars" data-testid="sub-user-password" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Role</label>
                                    <select className="form-select" value={newSubUser.role} onChange={e => setNewSubUser({...newSubUser, role: e.target.value})} data-testid="sub-user-role">
                                        <option value="viewer">Viewer - Read-only access</option>
                                        <option value="moderator">Moderator - Manage assigned servers</option>
                                        <option value="admin">Administrator - Full access</option>
                                    </select>
                                </div>
                                {newSubUser.role !== 'admin' && availableServers.length > 0 && (
                                    <div className="form-group">
                                        <label>Assign Servers</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {availableServers.map(server => (
                                                <label key={server.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: newSubUser.assigned_servers.includes(server.id) ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', border: newSubUser.assigned_servers.includes(server.id) ? '1px solid rgba(34,197,94,0.3)' : '1px solid transparent' }}>
                                                    <input type="checkbox" checked={newSubUser.assigned_servers.includes(server.id)} onChange={() => toggleSubServerUser(server.id)} />
                                                    {server.name}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <button className="btn btn-green" onClick={createSubUser} data-testid="submit-sub-user-btn"><i className="fas fa-check"></i> Create</button>
                                    <button className="btn btn-gray" onClick={() => setShowCreateUser(false)}><i className="fas fa-times"></i> Cancel</button>
                                </div>
                            </div>
                        )}
                        
                        {/* Users List */}
                        {subUsers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                                <i className="fas fa-users" style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.3 }}></i>
                                <p>No sub-users created yet</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {subUsers.map(user => (
                                    <div key={user.id} data-testid={`sub-user-${user.username}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <i className={`fas ${user.role === 'admin' ? 'fa-user-shield' : user.role === 'moderator' ? 'fa-user-cog' : 'fa-user'}`} style={{ color: user.role === 'admin' ? '#ef4444' : user.role === 'moderator' ? '#f59e0b' : '#3b82f6', fontSize: '18px' }}></i>
                                            <div>
                                                <strong>{user.username}</strong>
                                                <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: user.role === 'admin' ? 'rgba(239,68,68,0.15)' : user.role === 'moderator' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: user.role === 'admin' ? '#ef4444' : user.role === 'moderator' ? '#f59e0b' : '#3b82f6' }}>{user.role_label}</span>
                                                {!user.active && <span style={{ marginLeft: '6px', color: '#ef4444', fontSize: '12px' }}>(Disabled)</span>}
                                                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                    {user.assigned_servers?.length > 0 ? `${user.assigned_servers.length} server(s) assigned` : user.role === 'admin' ? 'All servers' : 'No servers assigned'}
                                                    {user.last_login && ` | Last login: ${new Date(user.last_login).toLocaleDateString()}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button className="btn btn-gray btn-sm" onClick={() => updateSubUser(user.id, { active: !user.active })} title={user.active ? 'Deactivate' : 'Activate'}>
                                                <i className={`fas ${user.active ? 'fa-ban' : 'fa-check'}`}></i>
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => deleteSubUser(user.id)} title="Delete user">
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3><i className="fas fa-network-wired"></i> Features</h3>
                    </div>
                    <div className="card-body">
                        <div className="setting-row">
                            <div className="setting-info">
                                <span className="setting-label">Node Clustering</span>
                                <span className="setting-description">Enable multi-machine server management. Only needed if you have multiple PCs/servers.</span>
                            </div>
                            <label className="toggle">
                                <input type="checkbox" checked={clusteringEnabled} onChange={toggleClustering} data-testid="clustering-toggle" />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Two-Factor Authentication Card */}
                <div className="card twofa-card">
                    <div className="card-header">
                        <h3><i className="fas fa-shield-alt"></i> Two-Factor Authentication (2FA)</h3>
                    </div>
                    <div className="card-body">
                        <div className="twofa-status">
                            <div className="status-indicator">
                                <span className={`status-badge ${twoFAStatus.enabled ? 'enabled' : 'disabled'}`}>
                                    <i className={`fas ${twoFAStatus.enabled ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                                    {twoFAStatus.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                            <p className="twofa-description">
                                Add an extra layer of security to your ServerCraft panel using Google Authenticator or any TOTP-compatible app.
                                Each ServerCraft instance has its own unique QR code tied to your panel ID.
                            </p>
                        </div>

                        {!twoFAStatus.enabled ? (
                            <div className="twofa-setup">
                                {!showSetup2FA ? (
                                    <button className="btn btn-primary" onClick={initiate2FASetup}>
                                        <i className="fas fa-qrcode"></i> Enable 2FA
                                    </button>
                                ) : (
                                    <div className="twofa-setup-wizard">
                                        <div className="setup-step">
                                            <h4><i className="fas fa-mobile-alt"></i> Step 1: Scan QR Code</h4>
                                            <p>Scan this QR code with Google Authenticator, Authy, or any TOTP app:</p>
                                            {qrCodeData && (
                                                <div className="qr-code-container">
                                                    <img src={qrCodeData.qr_code} alt="2FA QR Code" className="qr-code-img" />
                                                    <p className="instance-id">Instance ID: <code>{qrCodeData.instance_id?.substring(0, 8)}...</code></p>
                                                </div>
                                            )}
                                            <p className="manual-entry">
                                                Can't scan? Enter this key manually: <code className="secret-code">{qrCodeData?.secret}</code>
                                            </p>
                                        </div>
                                        
                                        <div className="setup-step">
                                            <h4><i className="fas fa-key"></i> Step 2: Enter Verification Code</h4>
                                            <p>Enter the 6-digit code from your authenticator app:</p>
                                            <div className="verification-input">
                                                <input 
                                                    type="text" 
                                                    className="form-input code-input"
                                                    value={verificationCode}
                                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    placeholder="000000"
                                                    maxLength={6}
                                                />
                                                <button className="btn btn-success" onClick={verify2FASetup}>
                                                    <i className="fas fa-check"></i> Verify & Enable
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <button className="btn btn-gray" onClick={() => setShowSetup2FA(false)}>
                                            <i className="fas fa-times"></i> Cancel Setup
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="twofa-enabled">
                                <div className="enabled-info">
                                    <p><i className="fas fa-check-circle" style={{color: '#22c55e'}}></i> Two-factor authentication is active on this ServerCraft instance.</p>
                                    {twoFAStatus.instance_id && (
                                        <p className="instance-info">Instance ID: <code>{twoFAStatus.instance_id.substring(0, 8)}...</code></p>
                                    )}
                                </div>
                                
                                <div className="twofa-actions">
                                    <div className="disable-section">
                                        <h4><i className="fas fa-ban"></i> Disable 2FA</h4>
                                        <p>Enter your current 2FA code to disable:</p>
                                        <div className="disable-input">
                                            <input 
                                                type="text" 
                                                className="form-input code-input"
                                                value={disableCode}
                                                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                placeholder="000000"
                                                maxLength={6}
                                            />
                                            <button className="btn btn-danger" onClick={disable2FA}>
                                                <i className="fas fa-trash"></i> Disable 2FA
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Backup Codes Modal */}
                        {showBackupCodes && backupCodes.length > 0 && (
                            <div className="backup-codes-display">
                                <div className="backup-header">
                                    <h4><i className="fas fa-key"></i> Backup Codes</h4>
                                    <p>Save these codes securely. Each can be used once if you lose access to your authenticator app.</p>
                                </div>
                                <div className="backup-codes-grid">
                                    {backupCodes.map((code, index) => (
                                        <code key={index} className="backup-code">{code}</code>
                                    ))}
                                </div>
                                <button className="btn btn-primary" onClick={() => setShowBackupCodes(false)}>
                                    <i className="fas fa-check"></i> I've Saved My Codes
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3><i className="fas fa-globe"></i> Network Settings</h3>
                    </div>
                    <div className="card-body">
                        <div className="setting-row">
                            <div className="setting-info">
                                <span className="setting-label">UPnP Auto Port Forward</span>
                                <span className="setting-description">Automatically open ports on your router</span>
                            </div>
                            <label className="toggle">
                                <input type="checkbox" checked={upnpEnabled} onChange={toggleUPnP} data-testid="upnp-toggle" />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                        <div className="upnp-status">
                            <div className="info-row">
                                <span className="info-label">UPnP Status:</span>
                                <span className="info-value" data-testid="upnp-status-text">
                                    {upnpStatus.available ? (upnpStatus.initialized ? 'Available' : 'Not initialized') : 'Not available'}
                                </span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">External IP:</span>
                                <span className="info-value" data-testid="upnp-external-ip">{upnpStatus.external_ip || '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Custom Domain Configuration */}
                <CustomDomainCard showToast={showToast} />

                {/* Server Selling Feature */}
                <ServerSalesCard showToast={showToast} />

                <div className="card">
                    <div className="card-header">
                        <h3><i className="fas fa-folder"></i> Paths</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>Servers Directory</label>
                            <div className="path-input">
                                <input type="text" className="form-input" readOnly value={settings.servers_path || ''} data-testid="servers-path" />
                                <button className="btn btn-gray btn-sm">Browse</button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Mods Directory</label>
                            <div className="path-input">
                                <input type="text" className="form-input" readOnly value={settings.mods_path || ''} data-testid="mods-path" />
                                <button className="btn btn-gray btn-sm">Browse</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3><i className="fas fa-info-circle"></i> About</h3>
                    </div>
                    <div className="card-body">
                        <div className="about-info">
                            <div className="info-row">
                                <span className="info-label">Version:</span>
                                <span className="info-value" data-testid="about-version">2026.1.6.44D</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Build:</span>
                                <span className="info-value">Linux</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// Marketplace View Component - Full Implementation
function MarketplaceView({ showToast }) {
    const [eligibility, setEligibility] = useState(null);
    const [uploadEligibility, setUploadEligibility] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('browse'); // browse, upload, my-templates
    const [tosAgreed, setTosAgreed] = useState(false);
    const [tosContent, setTosContent] = useState('');
    const [showTosModal, setShowTosModal] = useState(false);
    const [tosCheckbox, setTosCheckbox] = useState(false);
    const [selectedGame, setSelectedGame] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [myTemplates, setMyTemplates] = useState([]);
    
    // Installed templates tracking
    const [installedList, setInstalledList] = useState([]);
    const [installedUpdates, setInstalledUpdates] = useState(0);
    
    // External Auth state (ServerCraft website login for template creators)
    const [extAuthUsername, setExtAuthUsername] = useState('');
    const [extAuthPassword, setExtAuthPassword] = useState('');
    const [extAuthStatus, setExtAuthStatus] = useState(null);
    const [extAuthLoading, setExtAuthLoading] = useState(false);
    
    // Version check state
    const [versionMismatch, setVersionMismatch] = useState(null);
    
    // Upload form state with required security fields
    const [uploadForm, setUploadForm] = useState({
        template_name: '',
        version_id: '',
        author_name: '',
        template_date: new Date().toISOString().split('T')[0],
        template_identifier_id: '',
        game: '',
        description: '',
        screenshots: [],
        config: {},
        tags: [],
        min_servercraft_version: ''
    });
    const [screenshotPreviews, setScreenshotPreviews] = useState([]);

    const API_BASE = process.env.REACT_APP_BACKEND_URL || '';
    
    // Get auth token from localStorage
    const getToken = () => localStorage.getItem('servercraft_auth_token') || '';

    useEffect(() => {
        checkEligibility();
    }, []);

    const checkEligibility = async () => {
        setLoading(true);
        const token = getToken();
        try {
            // Check marketplace access eligibility
            const eligRes = await fetch(`${API_BASE}/api/marketplace/check-eligibility?token=${token}`);
            const eligData = await eligRes.json();
            setEligibility(eligData);

            if (eligData.eligible) {
                // Check upload eligibility
                const uploadRes = await fetch(`${API_BASE}/api/marketplace/check-upload-eligibility?token=${token}`);
                const uploadData = await uploadRes.json();
                setUploadEligibility(uploadData);

                // Check ToS status
                const tosStatusRes = await fetch(`${API_BASE}/api/marketplace/tos/status?token=${token}`);
                const tosData = await tosStatusRes.json();
                setTosAgreed(tosData.agreed);

                // Load templates
                await loadTemplates();
                await loadMyTemplates();
                await loadInstalledTemplates();
            }
        } catch (error) {
            console.error('Error checking eligibility:', error);
            setEligibility({ eligible: false, reason: 'error', message: 'Failed to check eligibility' });
        }
        setLoading(false);
    };

    const loadTemplates = async (game = '') => {
        const token = getToken();
        try {
            const url = game 
                ? `${API_BASE}/api/marketplace/templates?game=${game}&token=${token}` 
                : `${API_BASE}/api/marketplace/templates?token=${token}`;
            const res = await fetch(url);
            const data = await res.json();
            setTemplates(data.templates || []);
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    };

    const loadMyTemplates = async () => {
        const token = getToken();
        try {
            const res = await fetch(`${API_BASE}/api/marketplace/my-templates?token=${token}`);
            const data = await res.json();
            setMyTemplates(data.templates || []);
        } catch (error) {
            console.error('Error loading my templates:', error);
        }
    };
    
    const loadInstalledTemplates = async () => {
        const token = getToken();
        try {
            const res = await fetch(`${API_BASE}/api/templates/installed?token=${token}`);
            const data = await res.json();
            setInstalledList(data.installed || []);
            setInstalledUpdates(data.updates_available || 0);
        } catch (e) { console.log('Installed templates load skipped'); }
    };
    
    const handleOneClickUpdate = async (templateId) => {
        const token = getToken();
        try {
            const res = await fetch(`${API_BASE}/api/templates/installed/${templateId}/update?token=${token}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                const blob = new Blob([JSON.stringify(data.template.config, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${data.template.name.replace(/\s+/g, '_')}_v${data.new_version}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast(`Updated to v${data.new_version}!`, 'success');
                loadInstalledTemplates();
            } else if (data.error === 'version_mismatch') {
                setVersionMismatch(data);
            } else {
                showToast(data.message || 'Update failed', 'error');
            }
        } catch (e) { showToast('Failed to update template', 'error'); }
    };
    
    const removeInstalledTemplate = async (templateId) => {
        const token = getToken();
        await fetch(`${API_BASE}/api/templates/installed/${templateId}?token=${token}`, { method: 'DELETE' });
        loadInstalledTemplates();
        showToast('Template removed from installed list', 'info');
    };

    const loadTos = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/marketplace/tos`);
            const data = await res.json();
            setTosContent(data.tos);
            setShowTosModal(true);
        } catch (error) {
            showToast('Failed to load Terms of Service', 'error');
        }
    };

    const handleAgreeToTos = async () => {
        if (!tosCheckbox) {
            showToast('Please check the box to agree to the Terms of Service', 'error');
            return;
        }
        const token = getToken();
        try {
            await fetch(`${API_BASE}/api/marketplace/tos/agree?token=${token}`, { method: 'POST' });
            setTosAgreed(true);
            setShowTosModal(false);
            showToast('You have agreed to the Terms of Service', 'success');
            // Refresh upload eligibility
            const uploadRes = await fetch(`${API_BASE}/api/marketplace/check-upload-eligibility?token=${token}`);
            const uploadData = await uploadRes.json();
            setUploadEligibility(uploadData);
        } catch (error) {
            showToast('Failed to record agreement', 'error');
        }
    };

    const handleScreenshotUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length + screenshotPreviews.length > 10) {
            showToast('Maximum 10 screenshots allowed', 'error');
            return;
        }

        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setScreenshotPreviews(prev => [...prev, reader.result]);
                setUploadForm(prev => ({
                    ...prev,
                    screenshots: [...prev.screenshots, reader.result]
                }));
            };
            reader.readAsDataURL(file);
        });
    };

    const removeScreenshot = (index) => {
        setScreenshotPreviews(prev => prev.filter((_, i) => i !== index));
        setUploadForm(prev => ({
            ...prev,
            screenshots: prev.screenshots.filter((_, i) => i !== index)
        }));
    };

    const handleUploadTemplate = async (e) => {
        e.preventDefault();

        // Validation for required security fields
        const missingFields = [];
        if (!uploadForm.template_name) missingFields.push('Template Name');
        if (!uploadForm.version_id) missingFields.push('Version ID');
        if (!uploadForm.author_name) missingFields.push('Author Name');
        if (!uploadForm.template_date) missingFields.push('Template Date');
        if (!uploadForm.template_identifier_id) missingFields.push('Template Identifier ID');
        if (!uploadForm.game) missingFields.push('Game');
        if (!uploadForm.description) missingFields.push('Description');

        if (missingFields.length > 0) {
            showToast(`Template rejected. Missing required fields: ${missingFields.join(', ')}. Please fill in all required information and resubmit.`, 'error');
            return;
        }

        if (uploadForm.screenshots.length < 3) {
            showToast('Template rejected. At least 3 screenshots are required. Please add more screenshots and resubmit.', 'error');
            return;
        }

        if (!tosAgreed) {
            showToast('You must agree to the Terms of Service first', 'error');
            loadTos();
            return;
        }

        const token = getToken();
        try {
            const res = await fetch(`${API_BASE}/api/marketplace/templates?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(uploadForm)
            });
            const data = await res.json();
            if (data.success) {
                showToast('Template uploaded successfully! It will be reviewed before publishing.', 'success');
                setUploadForm({ 
                    template_name: '', 
                    version_id: '', 
                    author_name: '',
                    template_date: new Date().toISOString().split('T')[0],
                    template_identifier_id: '',
                    game: '', 
                    description: '', 
                    screenshots: [], 
                    config: {}, 
                    tags: [] 
                });
                setScreenshotPreviews([]);
                await loadMyTemplates();
                setActiveTab('my-templates');
            } else {
                // Show detailed rejection message
                if (data.rejected && data.missing_fields?.length > 0) {
                    showToast(`Template rejected. Missing required fields: ${data.missing_fields.join(', ')}. Please resubmit with all required information.`, 'error');
                } else if (data.reason === 'malicious_code' || data.suspend_account) {
                    // Critical security rejection - malicious code detected
                    showToast(data.message || 'Template rejected due to malicious code.', 'error');
                } else {
                    showToast(data.message || data.errors?.join(', ') || 'Upload failed', 'error');
                }
            }
        } catch (error) {
            showToast('Failed to upload template', 'error');
        }
    };

    const handleDownloadTemplate = async (templateId) => {
        const token = getToken();
        try {
            // Version check first
            const versionRes = await fetch(`${API_BASE}/api/marketplace/version-check?template_id=${templateId}`, { method: 'POST' });
            const versionData = await versionRes.json();
            
            if (versionData && !versionData.compatible) {
                setVersionMismatch(versionData);
                return;
            }
            
            const res = await fetch(`${API_BASE}/api/marketplace/templates/${templateId}/download?token=${token}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                const template = data.template;
                const blob = new Blob([JSON.stringify(template.config, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${template.name.replace(/\s+/g, '_')}_v${template.version}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Template downloaded successfully!', 'success');
                
                // Track installed template
                await fetch(`${API_BASE}/api/templates/installed/track?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        template_id: templateId,
                        version: template.version,
                        name: template.name,
                        game: template.game || ''
                    })
                });
                loadInstalledTemplates();
            }
        } catch (error) {
            showToast('Failed to download template', 'error');
        }
    };

    const handleReportTemplate = async (templateId, reason) => {
        const token = getToken();
        try {
            await fetch(`${API_BASE}/api/marketplace/templates/${templateId}/report?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });
            showToast('Report submitted. Thank you for helping keep the marketplace safe!', 'success');
        } catch (error) {
            showToast('Failed to submit report', 'error');
        }
    };
    
    const [ratingValue, setRatingValue] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [templateReviews, setTemplateReviews] = useState([]);
    
    const handleRateTemplate = async (templateId) => {
        if (ratingValue < 1 || ratingValue > 5) { showToast('Select a rating (1-5 stars)', 'error'); return; }
        const token = getToken();
        try {
            const res = await fetch(`${API_BASE}/api/marketplace/templates/${templateId}/rate?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: ratingValue, review: reviewText })
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || 'Rating submitted!', 'success');
                setRatingValue(0);
                setReviewText('');
                loadTemplates(selectedGame);
                // Reload reviews
                if (selectedTemplate) {
                    loadReviews(templateId);
                    setSelectedTemplate(prev => prev ? { ...prev, rating: data.new_rating, ratings_count: data.ratings_count } : null);
                }
            } else {
                showToast(data.detail || 'Failed to submit rating', 'error');
            }
        } catch (e) { showToast('Failed to submit rating', 'error'); }
    };
    
    const loadReviews = async (templateId) => {
        const token = getToken();
        try {
            const res = await fetch(`${API_BASE}/api/marketplace/templates/${templateId}/reviews?token=${token}`);
            const data = await res.json();
            setTemplateReviews(data.reviews || []);
        } catch (e) { setTemplateReviews([]); }
    };
    
    const renderStars = (rating, interactive = false, onSelect = null) => {
        return (
            <span style={{ display: 'inline-flex', gap: '2px' }}>
                {[1, 2, 3, 4, 5].map(star => (
                    <i key={star} className={`fas fa-star`}
                        style={{ color: star <= rating ? '#f59e0b' : 'rgba(255,255,255,0.1)', cursor: interactive ? 'pointer' : 'default', fontSize: interactive ? '20px' : '14px' }}
                        onClick={() => interactive && onSelect && onSelect(star)}
                        data-testid={interactive ? `rate-star-${star}` : undefined}
                    />
                ))}
            </span>
        );
    };

    // Loading state
    if (loading) {
        return (
            <section className="view-section marketplace-view" data-testid="marketplace-view">
                <div className="section-header">
                    <h2><i className="fas fa-store"></i> Template Marketplace</h2>
                </div>
                <div className="loading-container">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Checking eligibility...</p>
                </div>
            </section>
        );
    }

    // Not eligible - show message
    if (!eligibility?.eligible) {
        return (
            <section className="view-section marketplace-view" data-testid="marketplace-view">
                <div className="section-header">
                    <h2><i className="fas fa-store"></i> Template Marketplace</h2>
                </div>
                <div className="marketplace-content">
                    <div className="marketplace-disabled-overlay">
                        <div className="disabled-message-card account-too-new">
                            <div className="disabled-icon">
                                <i className="fas fa-clock"></i>
                            </div>
                            <h3><i className="fas fa-exclamation-triangle"></i> Account Too New</h3>
                            <p className="disabled-text">
                                {eligibility?.message || "This account is too new to access our template marketplace. Please wait 24 hours. If you are facing any issues please submit a bug report in our Discord server."}
                            </p>
                            {eligibility?.hours_remaining && (
                                <div className="time-remaining">
                                    <i className="fas fa-hourglass-half"></i>
                                    <span>{Math.ceil(eligibility.hours_remaining)} hours remaining</span>
                                </div>
                            )}
                            <a 
                                href="https://discord.gg/ykkkjwDnAD" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="discord-link"
                            >
                                <i className="fab fa-discord"></i> Report Issue on Discord
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="view-section marketplace-view" data-testid="marketplace-view">
            <div className="section-header">
                <h2><i className="fas fa-store"></i> Template Marketplace</h2>
            </div>

            {/* Tabs */}
            <div className="marketplace-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'browse' ? 'active' : ''}`}
                    onClick={() => setActiveTab('browse')}
                >
                    <i className="fas fa-search"></i> Browse Templates
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
                    onClick={() => setActiveTab('upload')}
                >
                    <i className="fas fa-upload"></i> Upload Template
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'my-templates' ? 'active' : ''}`}
                    onClick={() => setActiveTab('my-templates')}
                >
                    <i className="fas fa-folder"></i> My Templates
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'installed' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('installed'); loadInstalledTemplates(); }}
                    data-testid="installed-tab"
                >
                    <i className="fas fa-box-open"></i> Installed
                    {installedUpdates > 0 && (
                        <span style={{ marginLeft: '6px', padding: '1px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>{installedUpdates}</span>
                    )}
                </button>
            </div>

            {/* Browse Tab */}
            {activeTab === 'browse' && (
                <div className="marketplace-browse">
                    {/* Filters */}
                    <div className="marketplace-filters">
                        <select 
                            value={selectedGame} 
                            onChange={(e) => { setSelectedGame(e.target.value); loadTemplates(e.target.value); }}
                            className="form-select"
                        >
                            <option value="">All Games</option>
                            <option value="arma3">Arma 3</option>
                            <option value="arma_reforger">Arma Reforger</option>
                            <option value="dayz_vanilla">DayZ (Vanilla)</option>
                            <option value="dayz_modded">DayZ (Modded)</option>
                            <option value="rust">Rust</option>
                            <option value="minecraft">Minecraft</option>
                            <option value="valheim">Valheim</option>
                            <option value="squad">Squad</option>
                            <option value="project_zomboid">Project Zomboid</option>
                            <option value="ground_branch">Ground Branch</option>
                            <option value="icarus">ICARUS</option>
                            <option value="no_one_survived">No One Survived</option>
                            <option value="fivem">GTA V RP (FiveM)</option>
                            <option value="source_engine">Source Engine</option>
                        </select>
                    </div>

                    {/* Templates Grid */}
                    <div className="templates-grid">
                        {templates.length === 0 ? (
                            <div className="no-templates">
                                <i className="fas fa-box-open"></i>
                                <p>No templates found. Be the first to upload one!</p>
                            </div>
                        ) : (
                            templates.map(template => (
                                <div key={template.id} className="template-card" data-testid={`template-card-${template.id}`} style={{ background: 'transparent', border: '1px solid rgba(34,197,94,0.2)', backdropFilter: 'blur(8px)' }}>
                                    <div className="template-image">
                                        {template.screenshots?.[0] ? (
                                            <img src={template.screenshots[0]} alt={template.name} />
                                        ) : (
                                            <div className="template-image-placeholder">
                                                <i className="fas fa-image"></i>
                                            </div>
                                        )}
                                    </div>
                                    <div className="template-info">
                                        <h4 style={{ color: '#22c55e' }}>{template.name}</h4>
                                        <p className="template-version" style={{ color: '#4ade80' }}>v{template.version}{template.version_history?.length > 0 && ` (${template.version_history.length + 1} versions)`}</p>
                                        <p className="template-author" style={{ color: '#86efac' }}>by {template.author_name || template.author}</p>
                                        <div className="template-stats" style={{ color: '#bbf7d0' }}>
                                            <span><i className="fas fa-download"></i> {template.downloads}</span>
                                            <span><i className="fas fa-gamepad"></i> {template.game}</span>
                                            <span>{renderStars(template.rating || 0)} ({template.ratings_count || 0})</span>
                                        </div>
                                    </div>
                                    <div className="template-actions">
                                        <button 
                                            className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                                            onClick={() => handleDownloadTemplate(template.id)}
                                            data-testid={`download-template-${template.id}`}
                                        >
                                            <i className="fas fa-download"></i> Download
                                        </button>
                                        <button 
                                            className="btn btn-gray btn-sm"
                                            onClick={() => setSelectedTemplate(template)}
                                            data-testid={`view-template-${template.id}`}
                                        >
                                            <i className="fas fa-eye"></i> View
                                        </button>
                                        <button 
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleReportTemplate(template.id, 'spam')}
                                            title="Report template"
                                        >
                                            <i className="fas fa-flag"></i>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Upload Tab */}
            {activeTab === 'upload' && (
                <div className="marketplace-upload">
                    {/* External Auth Notice - Creators must login via ServerCraft website */}
                    <div style={{ padding: '16px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.15)', marginBottom: '20px' }} data-testid="external-auth-section">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <i className="fas fa-globe" style={{ color: '#3b82f6', fontSize: '20px' }}></i>
                            <div>
                                <strong>Template Creator Authentication</strong>
                                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    To upload templates, plugins, or add-ons, you must register and login via the ServerCraft website. 
                                    Your website account is separate from your ServerCraft panel admin account.
                                </p>
                            </div>
                        </div>
                        {!extAuthStatus?.authenticated ? (
                            <div>
                                <div className="form-row" style={{ marginBottom: '8px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <input type="text" className="form-input" placeholder="Website username" value={extAuthUsername} onChange={e => setExtAuthUsername(e.target.value)} data-testid="ext-auth-username" />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <input type="password" className="form-input" placeholder="Website password" value={extAuthPassword} onChange={e => setExtAuthPassword(e.target.value)} data-testid="ext-auth-password" />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button type="button" className="btn btn-primary btn-sm" disabled={extAuthLoading || !extAuthUsername || !extAuthPassword}
                                        onClick={async () => {
                                            setExtAuthLoading(true);
                                            try {
                                                const res = await fetch(`${API_BASE}/api/marketplace/external-auth/login`, {
                                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ username: extAuthUsername, password: extAuthPassword })
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                    setExtAuthStatus({ authenticated: true, username: data.username });
                                                    showToast(`Logged in as ${data.username}`, 'success');
                                                } else {
                                                    showToast(data.error || 'Login failed', 'error');
                                                }
                                            } catch (e) { showToast('Authentication failed', 'error'); }
                                            setExtAuthLoading(false);
                                        }}
                                        data-testid="ext-auth-login-btn"
                                    >
                                        <i className={`fas ${extAuthLoading ? 'fa-spinner fa-spin' : 'fa-sign-in-alt'}`}></i> Login
                                    </button>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        Don't have an account? Register at the ServerCraft website (coming soon)
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ color: '#22c55e' }}><i className="fas fa-check-circle"></i> Logged in as <strong>{extAuthStatus.username}</strong></span>
                                <button type="button" className="btn btn-gray btn-sm" onClick={async () => {
                                    await fetch(`${API_BASE}/api/marketplace/external-auth/logout?username=${extAuthStatus.username}`, { method: 'POST' });
                                    setExtAuthStatus(null);
                                }}>
                                    <i className="fas fa-sign-out-alt"></i> Logout
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Upload eligibility check */}
                    {!uploadEligibility?.eligible ? (
                        <div className="upload-blocked">
                            <div className="card warning-card">
                                <div className="card-body">
                                    <i className="fas fa-exclamation-triangle"></i>
                                    <h4>Cannot Upload</h4>
                                    <p>{uploadEligibility?.message || "You are not eligible to upload at this time."}</p>
                                    {uploadEligibility?.reason === 'tos_not_agreed' && (
                                        <button className="btn btn-primary" onClick={loadTos}>
                                            <i className="fas fa-file-contract"></i> View Terms of Service
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleUploadTemplate} className="upload-form">
                            <div className="upload-info-card">
                                <h4><i className="fas fa-shield-alt"></i> Required Template Information</h4>
                                <p>All fields marked with * are required for security verification. Templates missing any required information will be rejected.</p>
                                <ul>
                                    <li><strong>Version ID</strong> - Unique version identifier</li>
                                    <li><strong>Author Name</strong> - Your display name</li>
                                    <li><strong>Template Date</strong> - Creation date</li>
                                    <li><strong>Template Name</strong> - Descriptive name</li>
                                    <li><strong>Template Identifier ID</strong> - Unique template ID</li>
                                    <li>At least 3 screenshots required</li>
                                    <li>You can upload 1 template per month</li>
                                </ul>
                            </div>

                            <div className="form-group">
                                <label>Template Name *</label>
                                <input 
                                    type="text" 
                                    className="form-input"
                                    value={uploadForm.template_name}
                                    onChange={(e) => setUploadForm({...uploadForm, template_name: e.target.value})}
                                    placeholder="My Awesome Server Template"
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Version ID *</label>
                                    <input 
                                        type="text" 
                                        className="form-input"
                                        value={uploadForm.version_id}
                                        onChange={(e) => setUploadForm({...uploadForm, version_id: e.target.value})}
                                        placeholder="1.0.0"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Template Identifier ID *</label>
                                    <input 
                                        type="text" 
                                        className="form-input"
                                        value={uploadForm.template_identifier_id}
                                        onChange={(e) => setUploadForm({...uploadForm, template_identifier_id: e.target.value})}
                                        placeholder="unique-template-id-123"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Author Name *</label>
                                    <input 
                                        type="text" 
                                        className="form-input"
                                        value={uploadForm.author_name}
                                        onChange={(e) => setUploadForm({...uploadForm, author_name: e.target.value})}
                                        placeholder="Your display name"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Template Date *</label>
                                    <input 
                                        type="date" 
                                        className="form-input"
                                        value={uploadForm.template_date}
                                        onChange={(e) => setUploadForm({...uploadForm, template_date: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ position: 'relative' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="fas fa-code-branch" style={{ color: '#3b82f6' }}></i> Minimum ServerCraft Version 
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '400' }}>(optional)</span>
                                </label>
                                <input 
                                    type="text" 
                                    className="form-input"
                                    value={uploadForm.min_servercraft_version}
                                    onChange={(e) => setUploadForm({...uploadForm, min_servercraft_version: e.target.value})}
                                    placeholder="e.g. 2026.3.0"
                                    data-testid="min-version-input"
                                    style={{ borderColor: uploadForm.min_servercraft_version ? 'rgba(59,130,246,0.3)' : undefined }}
                                />
                                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                                    <i className="fas fa-info-circle" style={{ marginRight: '4px' }}></i>
                                    Leave blank for no version requirement. Users with older versions will see a "version mismatch" error with a link to update.
                                </small>
                            </div>

                            <div className="form-group">
                                <label>Game *</label>
                                <select 
                                    className="form-select"
                                    value={uploadForm.game}
                                    onChange={(e) => setUploadForm({...uploadForm, game: e.target.value})}
                                    required
                                >
                                    <option value="">Select Game</option>
                                    <option value="arma3">Arma 3</option>
                                    <option value="arma_reforger">Arma Reforger</option>
                                    <option value="dayz_vanilla">DayZ (Vanilla)</option>
                                    <option value="dayz_modded">DayZ (Modded)</option>
                                    <option value="rust">Rust</option>
                                    <option value="minecraft">Minecraft</option>
                                <option value="teamspeak3">TeamSpeak 3</option>
                                    <option value="valheim">Valheim</option>
                                    <option value="squad">Squad</option>
                                    <option value="project_zomboid">Project Zomboid</option>
                                    <option value="ground_branch">Ground Branch</option>
                                    <option value="icarus">ICARUS</option>
                                    <option value="no_one_survived">No One Survived</option>
                                    <option value="fivem">GTA V RP (FiveM)</option>
                                    <option value="source_engine">Source Engine</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Description *</label>
                                <textarea 
                                    className="form-textarea"
                                    value={uploadForm.description}
                                    onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})}
                                    placeholder="Describe your template..."
                                    rows={4}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Screenshots * (Minimum 3, Maximum 10)</label>
                                <div className="screenshot-upload">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        multiple 
                                        onChange={handleScreenshotUpload}
                                        id="screenshot-input"
                                        style={{display: 'none'}}
                                    />
                                    <label htmlFor="screenshot-input" className="btn btn-gray">
                                        <i className="fas fa-images"></i> Add Screenshots ({screenshotPreviews.length}/10)
                                    </label>
                                </div>
                                <div className="screenshot-previews">
                                    {screenshotPreviews.map((preview, index) => (
                                        <div key={index} className="screenshot-preview">
                                            <img src={preview} alt={`Screenshot ${index + 1}`} />
                                            <button 
                                                type="button"
                                                className="remove-screenshot"
                                                onClick={() => removeScreenshot(index)}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {screenshotPreviews.length < 3 && (
                                    <p className="help-text error">
                                        <i className="fas fa-exclamation-circle"></i> {3 - screenshotPreviews.length} more screenshot(s) required
                                    </p>
                                )}
                            </div>

                            {!tosAgreed && (
                                <div className="tos-agreement">
                                    <button type="button" className="btn btn-gray" onClick={loadTos}>
                                        <i className="fas fa-file-contract"></i> Read Terms of Service
                                    </button>
                                    <p className="help-text">You must agree to the Terms of Service before uploading</p>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                className="btn btn-primary btn-lg"
                                disabled={!tosAgreed || screenshotPreviews.length < 3}
                            >
                                <i className="fas fa-upload"></i> Upload Template
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* My Templates Tab */}
            {activeTab === 'my-templates' && (
                <div className="my-templates">
                    {myTemplates.length === 0 ? (
                        <div className="no-templates">
                            <i className="fas fa-folder-open"></i>
                            <p>You haven't uploaded any templates yet.</p>
                            <button className="btn btn-primary" onClick={() => setActiveTab('upload')}>
                                <i className="fas fa-upload"></i> Upload Your First Template
                            </button>
                        </div>
                    ) : (
                        <div className="templates-list">
                            {myTemplates.map(template => (
                                <div key={template.id} className="my-template-card">
                                    <div className="template-status">
                                        <span className={`status-badge ${template.status}`}>
                                            {template.status === 'pending_review' && <><i className="fas fa-clock"></i> Pending Review</>}
                                            {template.status === 'approved' && <><i className="fas fa-check"></i> Approved</>}
                                            {template.status === 'rejected' && <><i className="fas fa-times"></i> Rejected</>}
                                        </span>
                                    </div>
                                    <h4>{template.name} <span className="version">v{template.version}</span></h4>
                                    <p>{template.description}</p>
                                    <div className="template-meta">
                                        <span><i className="fas fa-gamepad"></i> {template.game}</span>
                                        <span><i className="fas fa-download"></i> {template.downloads} downloads</span>
                                        <span><i className="fas fa-calendar"></i> {new Date(template.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Installed Templates Tab */}
            {activeTab === 'installed' && (
                <div className="installed-templates" data-testid="installed-templates-section">
                    {installedUpdates > 0 && (
                        <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.06)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.15)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className="fas fa-arrow-circle-up" style={{ color: '#22c55e', fontSize: '20px' }}></i>
                            <div>
                                <strong style={{ color: '#22c55e' }}>{installedUpdates} update{installedUpdates > 1 ? 's' : ''} available</strong>
                                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Click "Update" to download the latest version of each template.</p>
                            </div>
                        </div>
                    )}
                    
                    {installedList.length === 0 ? (
                        <div className="no-templates">
                            <i className="fas fa-box-open"></i>
                            <p>No templates installed yet. Browse the marketplace to find templates for your servers.</p>
                            <button className="btn btn-primary" onClick={() => setActiveTab('browse')}>
                                <i className="fas fa-search"></i> Browse Templates
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {installedList.map(inst => (
                                <div key={inst.template_id} data-testid={`installed-${inst.template_id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: inst.update_available ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.03)', borderRadius: '10px', border: `1px solid ${inst.update_available ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: inst.update_available ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)' }}>
                                            <i className={`fas ${inst.update_available ? 'fa-arrow-circle-up' : 'fa-puzzle-piece'}`} style={{ color: inst.update_available ? '#22c55e' : '#3b82f6' }}></i>
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <strong style={{ fontSize: '15px' }}>{inst.name}</strong>
                                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>v{inst.installed_version}</span>
                                                {inst.update_available && (
                                                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: '600' }}>v{inst.latest_version} available</span>
                                                )}
                                            </div>
                                            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                {inst.game && <><i className="fas fa-gamepad"></i> {inst.game} | </>}
                                                Installed: {inst.installed_at ? new Date(inst.installed_at).toLocaleDateString() : 'Unknown'}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {inst.update_available && (
                                            <button className="btn btn-sm" style={{ background: '#22c55e', color: '#fff', border: 'none', fontWeight: '600' }} onClick={() => handleOneClickUpdate(inst.template_id)} data-testid={`update-template-${inst.template_id}`}>
                                                <i className="fas fa-download"></i> Update
                                            </button>
                                        )}
                                        <button className="btn btn-gray btn-sm" onClick={() => removeInstalledTemplate(inst.template_id)} title="Remove from installed list">
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Terms of Service Modal */}
            {showTosModal && (
                <div className="modal tos-modal">
                    <div className="modal-overlay" onClick={() => setShowTosModal(false)}></div>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3><i className="fas fa-file-contract"></i> Terms of Service</h3>
                            <button className="modal-close" onClick={() => setShowTosModal(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body tos-content">
                            <pre>{tosContent}</pre>
                        </div>
                        <div className="modal-footer tos-footer">
                            <label className="tos-checkbox">
                                <input 
                                    type="checkbox" 
                                    checked={tosCheckbox}
                                    onChange={(e) => setTosCheckbox(e.target.checked)}
                                />
                                <span>I have read and agree to the Terms of Service</span>
                            </label>
                            <button 
                                className="btn btn-danger btn-lg tos-agree-btn"
                                onClick={handleAgreeToTos}
                                disabled={!tosCheckbox}
                            >
                                I Agree to the Terms of Service
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Detail Modal */}
            {selectedTemplate && (
                <div className="modal template-detail-modal">
                    <div className="modal-overlay" onClick={() => { setSelectedTemplate(null); setTemplateReviews([]); setRatingValue(0); setReviewText(''); }}></div>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>{selectedTemplate.name}</h3>
                            <button className="modal-close" onClick={() => { setSelectedTemplate(null); setTemplateReviews([]); }}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                            <div className="template-screenshots">
                                {selectedTemplate.screenshots?.map((ss, i) => (
                                    <img key={i} src={ss} alt={`Screenshot ${i + 1}`} />
                                ))}
                            </div>
                            <div className="template-details">
                                <p><strong>Version:</strong> {selectedTemplate.version}</p>
                                <p><strong>Author:</strong> {selectedTemplate.author_name || selectedTemplate.author}</p>
                                <p><strong>Game:</strong> {selectedTemplate.game}</p>
                                <p><strong>Downloads:</strong> {selectedTemplate.downloads}</p>
                                <p><strong>Rating:</strong> {renderStars(selectedTemplate.rating || 0)} ({selectedTemplate.ratings_count || 0} reviews)</p>
                                {selectedTemplate.min_servercraft_version && <p><strong>Requires:</strong> ServerCraft {selectedTemplate.min_servercraft_version}+</p>}
                                <p><strong>Description:</strong></p>
                                <p>{selectedTemplate.description}</p>
                            </div>
                            
                            {/* Rate & Review */}
                            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(245,158,11,0.06)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.15)' }}>
                                <h4 style={{ margin: '0 0 10px 0' }}><i className="fas fa-star" style={{ color: '#f59e0b' }}></i> Rate This Template</h4>
                                <div style={{ marginBottom: '10px' }}>
                                    {renderStars(ratingValue, true, setRatingValue)}
                                    {ratingValue > 0 && <span style={{ marginLeft: '10px', color: '#f59e0b', fontWeight: '600' }}>{ratingValue}/5</span>}
                                </div>
                                <textarea 
                                    className="form-textarea" 
                                    placeholder="Write a review (optional)..." 
                                    value={reviewText}
                                    onChange={e => setReviewText(e.target.value)}
                                    rows={3}
                                    style={{ marginBottom: '10px', width: '100%' }}
                                    data-testid="review-text-input"
                                />
                                <button className="btn btn-primary btn-sm" onClick={() => handleRateTemplate(selectedTemplate.id)} disabled={ratingValue < 1} data-testid="submit-review-btn">
                                    <i className="fas fa-paper-plane"></i> Submit Review
                                </button>
                            </div>
                            
                            {/* Reviews List */}
                            {templateReviews.length === 0 && selectedTemplate && (() => { loadReviews(selectedTemplate.id); return null; })()}
                            {templateReviews.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <h4><i className="fas fa-comments"></i> Reviews ({templateReviews.length})</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                        {templateReviews.map((review, idx) => (
                                            <div key={idx} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <strong>{review.username}</strong>
                                                    {renderStars(review.rating)}
                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{new Date(review.created_at).toLocaleDateString()}</span>
                                                </div>
                                                {review.review && <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{review.review}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="btn btn-primary"
                                onClick={() => { handleDownloadTemplate(selectedTemplate.id); setSelectedTemplate(null); }}
                            >
                                <i className="fas fa-download"></i> Download Template
                            </button>
                            <button 
                                className="btn btn-danger"
                                onClick={() => { handleReportTemplate(selectedTemplate.id, 'inappropriate'); setSelectedTemplate(null); }}
                            >
                                <i className="fas fa-flag"></i> Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Version Mismatch Modal */}
            {versionMismatch && (
                <div className="modal" data-testid="version-mismatch-modal">
                    <div className="modal-overlay" onClick={() => setVersionMismatch(null)}></div>
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header" style={{ borderBottom: '2px solid rgba(239,68,68,0.3)' }}>
                            <h3 style={{ color: '#ef4444' }}><i className="fas fa-exclamation-triangle"></i> Version Mismatch</h3>
                            <button className="modal-close" onClick={() => setVersionMismatch(null)}><i className="fas fa-times"></i></button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '24px' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px', color: '#ef4444' }}><i className="fas fa-code-branch"></i></div>
                            <p style={{ fontSize: '15px', marginBottom: '16px' }}>{versionMismatch.message}</p>
                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '16px' }}>
                                <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                    <small style={{ color: 'var(--text-secondary)' }}>Your Version</small>
                                    <div style={{ fontWeight: '700', color: '#ef4444' }}>{versionMismatch.current_version}</div>
                                </div>
                                <div style={{ padding: '10px 16px', background: 'rgba(34,197,94,0.1)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)' }}>
                                    <small style={{ color: 'var(--text-secondary)' }}>Required</small>
                                    <div style={{ fontWeight: '700', color: '#22c55e' }}>{versionMismatch.required_version}</div>
                                </div>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                Please update your ServerCraft to the latest version to download this template.
                            </p>
                            <div style={{ padding: '10px', background: 'rgba(59,130,246,0.08)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.15)', fontSize: '13px', wordBreak: 'break-all' }}>
                                <i className="fas fa-link" style={{ color: '#3b82f6', marginRight: '6px' }}></i>
                                <a href={versionMismatch.update_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }} data-testid="update-link">
                                    {versionMismatch.update_url}
                                </a>
                                <button className="btn btn-gray btn-sm" style={{ marginLeft: '8px' }} onClick={() => { navigator.clipboard.writeText(versionMismatch.update_url); showToast('Link copied!', 'success'); }}>
                                    <i className="fas fa-copy"></i> Copy
                                </button>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-gray" onClick={() => setVersionMismatch(null)}><i className="fas fa-times"></i> Close</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

// Sub-User Management Full View Component
function SubUserManagementView({ showToast }) {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState({});
    const [servers, setServers] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer', assigned_servers: [] });
    
    const getToken = () => localStorage.getItem('servercraft_auth_token') || '';
    
    useEffect(() => {
        fetchAll();
    }, []);
    
    const fetchAll = async () => {
        try {
            const [usersRes, rolesRes, serversRes] = await Promise.all([
                fetch(`${API_BASE}/api/sub-users?token=${getToken()}`),
                fetch(`${API_BASE}/api/sub-users/roles`),
                fetch(`${API_BASE}/api/servers`)
            ]);
            const usersData = await usersRes.json();
            const rolesData = await rolesRes.json();
            const serversData = await serversRes.json();
            setUsers(usersData.users || []);
            setRoles(rolesData);
            setServers(Array.isArray(serversData) ? serversData : []);
        } catch (e) { console.error(e); }
    };
    
    const createUser = async () => {
        if (!newUser.username || !newUser.password) { showToast('Fill in all fields', 'error'); return; }
        try {
            const res = await fetch(`${API_BASE}/api/sub-users?token=${getToken()}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            const data = await res.json();
            if (res.ok) { showToast(data.message, 'success'); setShowCreate(false); setNewUser({ username: '', password: '', role: 'viewer', assigned_servers: [] }); fetchAll(); }
            else { showToast(data.detail || 'Failed', 'error'); }
        } catch (e) { showToast('Error creating user', 'error'); }
    };
    
    const deleteUser = async (id) => {
        if (!window.confirm('Delete this user?')) return;
        await fetch(`${API_BASE}/api/sub-users/${id}?token=${getToken()}`, { method: 'DELETE' });
        showToast('User deleted', 'success');
        fetchAll();
    };
    
    const toggleActive = async (id, active) => {
        await fetch(`${API_BASE}/api/sub-users/${id}?token=${getToken()}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !active })
        });
        fetchAll();
    };
    
    const toggleServer = (serverId) => {
        setNewUser(prev => ({
            ...prev,
            assigned_servers: prev.assigned_servers.includes(serverId)
                ? prev.assigned_servers.filter(id => id !== serverId)
                : [...prev.assigned_servers, serverId]
        }));
    };

    return (
        <section className="view-section" data-testid="users-view">
            <div className="section-header">
                <h2><i className="fas fa-users-cog"></i> Sub-Server Users <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: '600', marginLeft: '8px' }}>BETA</span></h2>
            </div>
            
            <div style={{ padding: '16px', background: 'rgba(34,197,94,0.06)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.15)', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                    Create and manage sub-users with different permission levels. Sub-users can be assigned specific servers to manage.
                    <strong> Roles:</strong> Admin (full access), Moderator (manage assigned servers), Viewer (read-only).
                </p>
            </div>
            
            <button className="btn btn-green" onClick={() => setShowCreate(true)} data-testid="create-user-main-btn" style={{ marginBottom: '16px' }}>
                <i className="fas fa-user-plus"></i> Create New User
            </button>
            
            {showCreate && (
                <div className="card" style={{ marginBottom: '20px', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div className="card-header"><h3 style={{ color: '#22c55e' }}><i className="fas fa-user-plus"></i> New Sub-User</h3></div>
                    <div className="card-body">
                        <div className="form-row">
                            <div className="form-group"><label>Username *</label><input type="text" className="form-input" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} placeholder="username" data-testid="new-user-username" /></div>
                            <div className="form-group"><label>Password *</label><input type="password" className="form-input" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="min 8 characters" data-testid="new-user-password" /></div>
                        </div>
                        <div className="form-group">
                            <label>Role</label>
                            <select className="form-select" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} data-testid="new-user-role">
                                {Object.entries(roles).map(([key, role]) => (
                                    <option key={key} value={key}>{role.label} - {role.description}</option>
                                ))}
                            </select>
                        </div>
                        {newUser.role !== 'admin' && servers.length > 0 && (
                            <div className="form-group">
                                <label>Assign Servers (for {newUser.role}s)</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {servers.map(s => (
                                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: newUser.assigned_servers.includes(s.id) ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)', borderRadius: '8px', cursor: 'pointer', border: newUser.assigned_servers.includes(s.id) ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                                            <input type="checkbox" checked={newUser.assigned_servers.includes(s.id)} onChange={() => toggleServer(s.id)} />
                                            <span>{s.name} <small style={{color:'var(--text-secondary)'}}>({s.game})</small></span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-green" onClick={createUser} data-testid="submit-new-user"><i className="fas fa-check"></i> Create User</button>
                            <button className="btn btn-gray" onClick={() => setShowCreate(false)}><i className="fas fa-times"></i> Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Users Table */}
            <div className="card">
                <div className="card-header"><h3><i className="fas fa-users"></i> All Users ({users.length})</h3></div>
                <div className="card-body">
                    {users.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            <i className="fas fa-user-slash" style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.2 }}></i>
                            <p>No sub-users yet. Create one to get started.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {users.map(user => (
                                <div key={user.id} data-testid={`user-row-${user.username}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: user.active ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.05)', borderRadius: '10px', border: `1px solid ${user.active ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.15)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: user.role === 'admin' ? 'rgba(239,68,68,0.12)' : user.role === 'moderator' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)' }}>
                                            <i className={`fas ${user.role === 'admin' ? 'fa-user-shield' : user.role === 'moderator' ? 'fa-user-cog' : 'fa-eye'}`} style={{ color: user.role === 'admin' ? '#ef4444' : user.role === 'moderator' ? '#f59e0b' : '#3b82f6' }}></i>
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <strong style={{ fontSize: '15px' }}>{user.username}</strong>
                                                <span style={{ padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: user.role === 'admin' ? 'rgba(239,68,68,0.12)' : user.role === 'moderator' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)', color: user.role === 'admin' ? '#ef4444' : user.role === 'moderator' ? '#f59e0b' : '#3b82f6' }}>{user.role_label}</span>
                                                {!user.active && <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>DISABLED</span>}
                                            </div>
                                            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                {user.assigned_servers?.length > 0 ? `${user.assigned_servers.length} server(s)` : user.role === 'admin' ? 'All servers' : 'No servers'}
                                                {user.last_login && ` | Last: ${new Date(user.last_login).toLocaleDateString()}`}
                                                {user.created_at && ` | Created: ${new Date(user.created_at).toLocaleDateString()}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button className="btn btn-gray btn-sm" onClick={() => toggleActive(user.id, user.active)} title={user.active ? 'Deactivate' : 'Activate'} data-testid={`toggle-user-${user.username}`}>
                                            <i className={`fas ${user.active ? 'fa-ban' : 'fa-check'}`}></i> {user.active ? 'Disable' : 'Enable'}
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => deleteUser(user.id)} title="Delete" data-testid={`delete-user-${user.username}`}>
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

// About View Component
// Fallback version history data
const FALLBACK_VERSION_HISTORY = [
    {
        version: "2026.3.0-BETA",
        date: "2026-03-XX",
        type: "major",
        changes: [
            "Nginx Proxy Manager Integration - Replace DuckDNS with NPM for SSL & reverse proxy",
            "Full Sub-Server User System (Beta) - Admin/Moderator/Viewer roles with server assignment",
            "Template Marketplace Polish & Versioning - Update existing templates with version history",
            "Transparent marketplace cards with green-themed text",
            "Full Mod Caching System - cached_mods/<game>/ structure for faster redownloads",
            "Arma Reforger fully integrated end-to-end in all views",
            "All 14+ games now listed in Create Server, Marketplace, and Workshop views",
            "NPM Setup Guide with step-by-step Docker installation instructions",
            "Sub-user permission checks for server-level access control",
            "Mod cache statistics dashboard with per-game breakdown",
            "Removed DuckDNS integration in favor of Nginx Proxy Manager"
        ]
    },
    {
        version: "2026.1.6.44D",
        date: "2026-01-06",
        type: "major",
        changes: [
            "Added Node Clustering system for multi-machine server management",
            "Node Cluster Linking via local Machine IPs - first node becomes master",
            "Resource pooling: CPU Cores/Threads, RAM, Storage, and Port Allocations",
            "Pterodactyl-style port allocation with IP:Port range assignments",
            "Color-coded resource tags (CPU=blue, RAM=green, Storage=purple, Ports=orange)",
            "Cluster health monitoring and node status tracking",
            "Shared network storage support (NAS/SAN paths)",
            "Central port registry to prevent conflicts across nodes",
            "Custom Domain Support with Nginx Proxy Manager integration",
            "DNS Propagation Checker with real-time status indicators",
            "Dynamic DNS Setup Instructions (NPM method)",
            "📝 Static IP Configuration Support",
            "🛒 Server Selling Feature (Optional) - Sell game servers directly from ServerCraft",
            "💳 PayPal Integration with sandbox/live mode testing",
            "📦 3 Default Server Packages (Basic/Standard/Premium)",
            "💰 Customizable pricing and currency support",
            "🔐 Secure API credential storage with masked display",
            "🌐 Secondary subdomain support for server sales",
            "Masked API key display for security",
            "Full CRUD operations for clusters, nodes, ports, and storage",
            "🚀 QOL: Auto-Discovery of Local Network Nodes via UDP broadcast",
            "🎯 QOL: Automatic Port Management - Smart port allocation with 100-port range per game",
            "🛒 Template Marketplace preview (Coming Soon - Currently Disabled)",
            "🔐 Two-Factor Authentication (2FA) with QR code setup",
            "🌐 Website Integration: Connected to servercraft.dev for analytics sync"
        ]
    },
    {
        version: "2025.20.12.21C-bug",
        date: "2025-12-21",
        type: "minor",
        changes: [
            "Added local authentication system with username/password login",
            "Default credentials (Admin/Password123!) must be changed on first login",
            "Added security questions for password recovery (3 of 5 questions)",
            "Added 'Remember me for 30 days' option to stay logged in",
            "Added AFK auto-logout after 15 minutes of inactivity",
            "Added winter theme with animated falling snowflakes (Dec-Feb)",
            "Added user badge and logout button to header",
            "Replaced all placeholder emojis with Font Awesome icons"
        ]
    },
    {
        version: "2026.6.1.C",
        date: "2026-01-06",
        type: "major",
        changes: [
            "Added 6 new supported games: Ground Branch, ICARUS, No One Survived, GTA V RP (FiveM), Source Engine, expanded DayZ support",
            "Added game tags with color coding (milsim, survival, pvp, roleplay, etc.)",
            "Further optimized resource usage for both offline and online servers",
            "Added resource warning about heavy gameplay instances",
            "Started Steam Workshop integration - browse and download mods for any game",
            "Enhanced mod support for games not requiring ownership",
            "Added disclaimer and warranty notice to specs popup"
        ]
    },
    {
        version: "2025.19.12.19B-fix",
        date: "2025-12-19",
        type: "fix",
        changes: [
            "Fixed PyInstaller executable crash on startup",
            "Added comprehensive error handling and debugging output",
            "Added Start-ServerCraft.bat launcher for better error visibility",
            "Added 30+ hidden imports for PyInstaller compatibility",
            "Error logs now saved to servercraft_error.log",
            "Console window now shows import status during startup"
        ]
    },
    {
        version: "2025.19.12.0B",
        date: "2025-12-19",
        type: "minor",
        changes: [
            "Recompiled the full panel into a proper portable executable file instead of unpacked data",
            "Added PyInstaller to the required packages to compile the panel properly",
            "Added About tab with version history and update notes"
        ]
    },
    {
        version: "2025.18.12.0A",
        date: "2025-12-18",
        type: "major",
        changes: [
            "Initial release of ServerCraft Linux",
            "Docker-based Linux deployment for cross-distro compatibility",
            "SteamCMD integration for downloading and updating game servers",
            "Support for Steam Guard 2FA codes",
            "UPnP automatic port forwarding",
            "Real-time system monitoring (CPU, RAM, Network, Disk)",
            "Tabbed interface for managing multiple servers",
            "Steam Workshop mod downloading support",
            "Support for Arma 3, DayZ, Rust, Arma Reforger, Project Zomboid, Valheim, Squad, Minecraft"
        ]
    }
];

function AboutView() {
    const [aboutData, setAboutData] = useState({
        name: 'ServerCraft - Linux',
        version: '2026.1.6.44D',
        copyright: '© 2026 TierOne Development',
        version_history: FALLBACK_VERSION_HISTORY
    });

    useEffect(() => {
        const fetchAbout = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/about`);
                if (response.ok) {
                    const data = await response.json();
                    setAboutData(data);
                }
            } catch (error) {
                // Use fallback data - already set in initial state
                console.log('Using fallback about data');
            }
        };
        fetchAbout();
    }, []);

    return (
        <section className="view-section about-view" data-testid="about-view">
            <div className="section-header">
                <h2>About ServerCraft</h2>
            </div>
            <div className="about-content">
                {/* App Info Card */}
                <div className="card about-card">
                    <div className="card-header">
                        <h3><i className="fas fa-gamepad"></i> Application Info</h3>
                    </div>
                    <div className="card-body">
                        <div className="app-branding">
                            <div className="app-logo"><i className="fas fa-gamepad"></i></div>
                            <div className="app-details">
                                <h1 className="app-title">{aboutData?.name || 'ServerCraft - Linux'}</h1>
                                <p className="app-version">Version {aboutData?.version || '2025.19.12.0B'}</p>
                                <p className="app-copyright">{aboutData?.copyright || '© 2026 TierOne Development'}</p>
                            </div>
                        </div>
                        <div className="app-description">
                            <p>
                                ServerCraft is a powerful, lightweight game server management panel designed for Linux.
                                Manage multiple game servers with ease using our intuitive interface.
                            </p>
                        </div>
                        <div className="app-features">
                            <h4>Key Features:</h4>
                            <ul>
                                <li><i className="fas fa-crosshairs"></i> Multi-game server management</li>
                                <li><i className="fas fa-chart-line"></i> Real-time system monitoring</li>
                                <li><i className="fab fa-steam"></i> SteamCMD integration</li>
                                <li><i className="fas fa-network-wired"></i> UPnP automatic port forwarding</li>
                                <li><i className="fas fa-puzzle-piece"></i> Steam Workshop mod support</li>
                                <li><i className="fas fa-server"></i> Docker-based — runs on any Linux distro</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Version History Card */}
                <div className="card version-history-card">
                    <div className="card-header">
                        <h3><i className="fas fa-history"></i> Version History</h3>
                    </div>
                    <div className="card-body">
                        <div className="version-list">
                            {aboutData?.version_history?.map((release, index) => (
                                <div key={release.version} className={`version-item ${index === 0 ? 'latest' : ''} ${release.type === 'fix' ? 'fix-release' : ''}`}>
                                    <div className="version-header">
                                        <span className="version-number">{release.version}</span>
                                        <span className={`version-type ${release.type}`}>
                                            {release.type === 'major' ? <><i className="fas fa-rocket"></i> Major Release</> : release.type === 'fix' ? <><i className="fas fa-wrench"></i> Bug Fix</> : <><i className="fas fa-code-branch"></i> Minor Update</>}
                                        </span>
                                        <span className="version-date">{release.date}</span>
                                    </div>
                                    <ul className="version-changes">
                                        {release.changes.map((change, i) => (
                                            <li key={i}>{change}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* System Info Card */}
                <div className="card system-info-card">
                    <div className="card-header">
                        <h3><i className="fas fa-desktop"></i> System Requirements</h3>
                    </div>
                    <div className="card-body">
                        <div className="requirements-grid">
                            <div className="requirement-section">
                                <h4><i className="fas fa-circle" style={{color: '#ef4444', fontSize: '8px', marginRight: '8px'}}></i>Minimum</h4>
                                <ul>
                                    <li><strong>CPU:</strong> 4 Cores</li>
                                    <li><strong>RAM:</strong> 8 GB</li>
                                    <li><strong>Storage:</strong> 50 GB SSD</li>
                                    <li><strong>OS:</strong> Ubuntu 22.04+ / Debian 12+</li>
                                </ul>
                            </div>
                            <div className="requirement-section">
                                <h4><i className="fas fa-circle" style={{color: '#22c55e', fontSize: '8px', marginRight: '8px'}}></i>Recommended</h4>
                                <ul>
                                    <li><strong>CPU:</strong> 8+ Cores</li>
                                    <li><strong>RAM:</strong> 32 GB+</li>
                                    <li><strong>Storage:</strong> 500 GB+ NVMe</li>
                                    <li><strong>OS:</strong> Ubuntu 24.04 LTS</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Credits Card */}
                <div className="card credits-card">
                    <div className="card-header">
                        <h3><i className="fas fa-users"></i> Credits</h3>
                    </div>
                    <div className="card-body">
                        <p><strong>Developed by:</strong> TierOne Development</p>
                        <p><strong>Built with:</strong> Python, FastAPI, React</p>
                        <p><strong>Special Thanks:</strong> The gaming community</p>
                    </div>
                </div>
            </div>
        </section>
    );
}

// Create Server Modal Component
function CreateServerModal({ games, onClose, onCreate }) {
    const [formData, setFormData] = useState({
        name: '',
        game: '',
        port: 27015,
        query_port: 27016,
        max_players: 32,
        custom_params: '',
        auto_start: false,
        upnp_enabled: false
    });

    const handleGameChange = (e) => {
        const game = e.target.value;
        const defaults = GAME_DEFAULTS[game] || { port: 27015, queryPort: 27016 };
        setFormData(prev => ({
            ...prev,
            game,
            port: defaults.port,
            query_port: defaults.queryPort
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onCreate(formData);
    };

    const requiresOwnership = formData.game && GAME_DEFAULTS[formData.game]?.requiresOwnership;

    return (
        <div className="modal" data-testid="create-server-modal">
            <div className="modal-overlay" onClick={onClose}></div>
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Create New Server</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Server Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="My Awesome Server"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                required
                                data-testid="server-name-input"
                            />
                        </div>
                        <div className="form-group">
                            <label>Game</label>
                            <select
                                className="form-select"
                                value={formData.game}
                                onChange={handleGameChange}
                                required
                                data-testid="server-game-select"
                            >
                                <option value="">Select a game...</option>
                                <option value="arma3">Arma 3</option>
                                <option value="arma_reforger">Arma Reforger</option>
                                <option value="dayz_vanilla">DayZ (Vanilla)</option>
                                <option value="dayz_modded">DayZ (Modded)</option>
                                <option value="rust">Rust</option>
                                <option value="project_zomboid">Project Zomboid</option>
                                <option value="valheim">Valheim</option>
                                <option value="squad">Squad</option>
                                <option value="ground_branch">Ground Branch</option>
                                <option value="icarus">ICARUS</option>
                                <option value="no_one_survived">No One Survived</option>
                                <option value="fivem">GTA V RP (FiveM)</option>
                                <option value="source_engine">Source Engine</option>
                                <option value="minecraft">Minecraft</option>
                                <option value="teamspeak3">TeamSpeak 3</option>
                            </select>
                            {requiresOwnership && (
                                <p className="form-warning">
                                    This game requires Steam account ownership to download server files.
                                </p>
                            )}
                            {formData.game === 'teamspeak3' && (
                                <div style={{ padding: '12px 16px', background: 'rgba(255,140,0,0.08)', borderRadius: '8px', border: '1px solid rgba(255,140,0,0.2)', borderLeft: '4px solid #ff8c00', marginTop: '8px' }} data-testid="ts3-create-notice">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                        <i className="fas fa-exclamation-triangle" style={{ color: '#ff8c00', marginTop: '2px' }}></i>
                                        <div>
                                            <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--text-primary)' }}>
                                                TeamSpeak 3 servers are free with up to 32 slots available. Servers that require more than 32 slots will require a license from TeamSpeak.
                                            </p>
                                            <a href="https://www.teamspeak.com/en/features/licensing/" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '500' }}>
                                                <i className="fas fa-external-link-alt"></i> https://www.teamspeak.com/en/features/licensing/
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Game Port</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.port}
                                    onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                                    required
                                    data-testid="server-port-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Query Port</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.query_port}
                                    onChange={(e) => setFormData(prev => ({ ...prev, query_port: parseInt(e.target.value) }))}
                                    data-testid="server-query-port-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Max Players</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.max_players}
                                    onChange={(e) => setFormData(prev => ({ ...prev, max_players: parseInt(e.target.value) }))}
                                    min="1"
                                    max="256"
                                    data-testid="server-max-players-input"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Custom Parameters</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Additional launch parameters"
                                value={formData.custom_params}
                                onChange={(e) => setFormData(prev => ({ ...prev, custom_params: e.target.value }))}
                                data-testid="server-custom-params-input"
                            />
                        </div>
                        <div className="form-row">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={formData.auto_start}
                                    onChange={(e) => setFormData(prev => ({ ...prev, auto_start: e.target.checked }))}
                                    data-testid="server-auto-start-checkbox"
                                />
                                <span>Auto-start on launch</span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={formData.upnp_enabled}
                                    onChange={(e) => setFormData(prev => ({ ...prev, upnp_enabled: e.target.checked }))}
                                    data-testid="server-upnp-checkbox"
                                />
                                <span>Enable UPnP</span>
                            </label>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-gray" onClick={onClose} data-testid="cancel-create-btn">Cancel</button>
                        <button type="submit" className="btn btn-green" data-testid="submit-create-btn">Create Server</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default App;
