import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeSlash } from '@phosphor-icons/react';
import api from '../utils/api';
import Spinner from '../components/Spinner';
import ClassPulseLogo from '../components/ClassPulseLogo';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/api/auth/reset-password', { token, password });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    page: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: '#F5F5F5',
    },
    card: {
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '2.5rem',
      width: '100%',
      maxWidth: '420px',
    },
    header: {
      textAlign: 'center',
      marginBottom: '2rem',
    },
    logo: {
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      background: '#DC2626',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '1rem',
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: '700',
      color: '#1A1A1A',
      marginBottom: '0.375rem',
    },
    subtitle: {
      color: '#6B7280',
      fontSize: '0.875rem',
    },
    success: {
      padding: '0.875rem 1rem',
      background: '#f0fdf4',
      color: '#16a34a',
      borderRadius: '6px',
      fontSize: '0.8125rem',
      fontWeight: '500',
      marginBottom: '1.25rem',
      border: '1px solid rgba(22, 163, 74, 0.12)',
    },
    error: {
      padding: '0.875rem 1rem',
      background: '#fef2f2',
      color: '#DC2626',
      borderRadius: '6px',
      fontSize: '0.8125rem',
      fontWeight: '500',
      marginBottom: '1.25rem',
      border: '1px solid rgba(220, 38, 38, 0.12)',
    },
    formGroup: {
      marginBottom: '1.25rem',
    },
    label: {
      display: 'block',
      fontSize: '0.8125rem',
      fontWeight: '600',
      marginBottom: '0.5rem',
      color: '#1A1A1A',
    },
    inputWrapper: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    },
    inputIcon: {
      position: 'absolute',
      left: '12px',
      color: '#9CA3AF',
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'none',
    },
    input: {
      width: '100%',
      height: '46px',
      padding: '0 2.75rem 0 2.5rem',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      fontSize: '0.9375rem',
      background: '#F5F5F5',
      color: '#1A1A1A',
      transition: 'all 0.2s ease',
      outline: 'none',
      boxSizing: 'border-box',
    },
    eyeToggle: {
      position: 'absolute',
      right: '12px',
      background: 'none',
      border: 'none',
      padding: '4px',
      cursor: 'pointer',
      color: '#9CA3AF',
      display: 'flex',
      alignItems: 'center',
    },
    submitBtn: {
      width: '100%',
      height: '48px',
      padding: '0 1.5rem',
      background: loading ? '#F87171' : '#DC2626',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      fontSize: '0.9375rem',
      fontWeight: '600',
      cursor: loading ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
    },
    backLink: {
      marginTop: '1.5rem',
      textAlign: 'center',
      fontSize: '0.875rem',
    },
    backLinkA: {
      color: '#6B7280',
      textDecoration: 'none',
      fontWeight: '500',
      transition: 'color 0.15s ease',
    },
    invalidCard: {
      textAlign: 'center',
    },
    invalidTitle: {
      fontSize: '1.5rem',
      fontWeight: '700',
      color: '#1A1A1A',
      marginBottom: '0.5rem',
    },
    invalidSubtitle: {
      color: '#6B7280',
      fontSize: '0.9375rem',
      marginBottom: '1.5rem',
    },
  };

  if (!token) {
    return (
      <>
        <style>{`
          .rp-back:hover {
            color: #DC2626 !important;
          }
        `}</style>
        <div style={styles.page}>
          <div style={styles.card}>
            <div style={styles.header}>
              <div style={styles.logo}><ClassPulseLogo size={28} /></div>
              <h1 style={styles.title}>ClassPulse</h1>
            </div>
            <div style={styles.invalidCard}>
              <p style={styles.invalidSubtitle}>Invalid reset link.</p>
              <p style={styles.backLink}>
                <Link to="/lecturer/login" className="rp-back" style={styles.backLinkA}>Back to Sign In</Link>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        .rp-input:focus {
          border-color: #DC2626 !important;
        }
        .rp-input::placeholder {
          color: #9CA3AF;
        }
        .rp-submit:hover:not(:disabled) {
          background: #B91C1C !important;
        }
        .rp-back:hover {
          color: #DC2626 !important;
        }
        .rp-eye:hover {
          color: #6B7280 !important;
        }
      `}</style>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.logo}><ClassPulseLogo size={28} /></div>
            <h1 style={styles.title}>Set New Password</h1>
            <p style={styles.subtitle}>Enter your new password below</p>
          </div>

          {message && <div style={styles.success}>{message}</div>}
          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="password">New Password</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>
                  <Lock size={18} />
                </span>
                <input
                  className="rp-input"
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="rp-eye"
                  style={styles.eyeToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="confirm">Confirm Password</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>
                  <Lock size={18} />
                </span>
                <input
                  className="rp-input"
                  id="confirm"
                  name="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="repeat password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={styles.input}
                  required
                />
                <button
                  type="button"
                  className="rp-eye"
                  style={styles.eyeToggle}
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="rp-submit"
              style={styles.submitBtn}
              disabled={loading}
            >
              {loading ? <><Spinner size={14} /> Resetting...</> : 'Reset Password'}
            </button>
          </form>

          <p style={styles.backLink}>
            <Link to="/lecturer/login" className="rp-back" style={styles.backLinkA}>Back to Sign In</Link>
          </p>
        </div>
      </div>
    </>
  );
}
