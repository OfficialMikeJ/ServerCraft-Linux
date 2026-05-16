/**
 * FeedbackView Component for ServerCraft
 * Monthly feedback form with questions and additional feedback
 */

import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

function FeedbackView({ showToast }) {
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [additionalFeedback, setAdditionalFeedback] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [deviceId, setDeviceId] = useState('');
    
    // Fetch questions on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get questions
                const questionsRes = await fetch(`${API_BASE}/api/feedback/questions`);
                if (questionsRes.ok) {
                    const data = await questionsRes.json();
                    setQuestions(data);
                }
                
                // Get device ID
                const deviceRes = await fetch(`${API_BASE}/api/analytics/device`);
                if (deviceRes.ok) {
                    const device = await deviceRes.json();
                    setDeviceId(device.device_id);
                }
            } catch (error) {
                console.error('Failed to fetch feedback data:', error);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, []);
    
    const handleAnswerChange = (questionId, value) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: value
        }));
    };
    
    const handleMultipleSelect = (questionId, value) => {
        setAnswers(prev => {
            const current = prev[questionId] || [];
            if (current.includes(value)) {
                return {
                    ...prev,
                    [questionId]: current.filter(v => v !== value)
                };
            }
            return {
                ...prev,
                [questionId]: [...current, value]
            };
        });
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate all questions answered
        const unanswered = questions.filter(q => {
            const answer = answers[q.id];
            if (q.type === 'multiple') {
                return !answer || answer.length === 0;
            }
            return !answer;
        });
        
        if (unanswered.length > 0) {
            showToast('Please answer all questions', 'warning');
            return;
        }
        
        setSubmitting(true);
        
        try {
            const response = await fetch(`${API_BASE}/api/feedback/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answers,
                    additional_feedback: additionalFeedback
                })
            });
            
            if (response.ok) {
                setSubmitted(true);
                showToast('Thank you for your feedback!', 'success');
            } else {
                showToast('Failed to submit feedback', 'error');
            }
        } catch (error) {
            showToast('Failed to submit feedback', 'error');
        } finally {
            setSubmitting(false);
        }
    };
    
    if (loading) {
        return (
            <div className="view-container feedback-view">
                <div className="loading-state">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Loading feedback form...</p>
                </div>
            </div>
        );
    }
    
    if (submitted) {
        return (
            <div className="view-container feedback-view">
                <div className="feedback-success">
                    <i className="fas fa-check-circle"></i>
                    <h2>Thank You!</h2>
                    <p>Your feedback has been submitted successfully.</p>
                    <p className="device-id">Device ID: {deviceId}</p>
                    <button className="btn btn-primary" onClick={() => {
                        setSubmitted(false);
                        setAnswers({});
                        setAdditionalFeedback('');
                    }}>
                        Submit Another Response
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="view-container feedback-view">
            <div className="view-header">
                <h2><i className="fas fa-comment-alt"></i> Feedback</h2>
                <p className="subtitle">Help us improve ServerCraft</p>
            </div>
            
            <div className="feedback-form-container">
                <div className="feedback-intro">
                    <i className="fas fa-clipboard-list"></i>
                    <div>
                        <h3>Monthly Feedback Survey</h3>
                        <p>Your feedback helps us make ServerCraft better. All responses are anonymous but linked to your Device ID for record keeping.</p>
                        <span className="device-badge"><i className="fas fa-fingerprint"></i> {deviceId?.slice(0, 8)}...</span>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="feedback-form">
                    {questions.map((question, index) => (
                        <div key={question.id} className="feedback-question">
                            <label className="question-label">
                                <span className="question-number">{index + 1}</span>
                                {question.question}
                            </label>
                            
                            {question.type === 'rating' && (
                                <div className="rating-options">
                                    {question.options.map(option => (
                                        <label key={option} className={`rating-option ${answers[question.id] === option ? 'selected' : ''}`}>
                                            <input
                                                type="radio"
                                                name={question.id}
                                                value={option}
                                                checked={answers[question.id] === option}
                                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                            
                            {question.type === 'single' && (
                                <div className="single-options">
                                    {question.options.map(option => (
                                        <label key={option} className={`single-option ${answers[question.id] === option ? 'selected' : ''}`}>
                                            <input
                                                type="radio"
                                                name={question.id}
                                                value={option}
                                                checked={answers[question.id] === option}
                                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                            
                            {question.type === 'multiple' && (
                                <div className="multiple-options">
                                    {question.options.map(option => (
                                        <label key={option} className={`multiple-option ${(answers[question.id] || []).includes(option) ? 'selected' : ''}`}>
                                            <input
                                                type="checkbox"
                                                value={option}
                                                checked={(answers[question.id] || []).includes(option)}
                                                onChange={() => handleMultipleSelect(question.id, option)}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    
                    <div className="feedback-question additional">
                        <label className="question-label">
                            <span className="question-number"><i className="fas fa-pen"></i></span>
                            Additional Feedback (Optional)
                        </label>
                        <textarea
                            className="feedback-textarea"
                            value={additionalFeedback}
                            onChange={(e) => setAdditionalFeedback(e.target.value)}
                            placeholder="Share any additional thoughts, suggestions, bug reports, or feature requests..."
                            rows={6}
                        />
                    </div>
                    
                    <div className="feedback-submit">
                        <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                            {submitting ? (
                                <><i className="fas fa-spinner fa-spin"></i> Submitting...</>
                            ) : (
                                <><i className="fas fa-paper-plane"></i> Submit Feedback</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default FeedbackView;
