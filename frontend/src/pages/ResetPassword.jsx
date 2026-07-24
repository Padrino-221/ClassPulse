import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../utils/api';
import Spinner from '../components/Spinner';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
      setError(err.response?.data?.error || 'Something went wrong.');
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
      background: '#f1f5f9',
    },
    card: {
      background: '#fff',
      borderRadius: '20px',
      padding: '2.5rem',
      width: '100%',
      maxWidth: '420px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 10px 30px rgba(0, 0, 0, 0.06)',
    },
    header: {
      textAlign: 'center',
      marginBottom: '2rem',
    },
    logo: {
      width: '56px',
      height: '56px',
      borderRadius: '14px',
      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.25rem',
      fontWeight: '800',
      letterSpacing: '-0.5px',
      marginBottom: '1rem',
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: '700',
      color: '#1e293b',
      marginBottom: '0.375rem',
    },
    subtitle: {
      color: '#64748b',
      fontSize: '0.875rem',
    },
    success: {
      padding: '0.875rem 1rem',
      background: '#f0fdf4',
      color: '#16a34a',
      borderRadius: '10px',
      fontSize: '0.8125rem',
      fontWeight: '500',
      marginBottom: '1.25rem',
      border: '1px solid rgba(22, 163, 74, 0.12)',
    },
    error: {
      padding: '0.875rem 1rem',
      background: '#fef2f2',
      color: '#dc2626',
      borderRadius: '10px',
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
      color: '#475569',
    },
    input: {
      width: '100%',
      height: '46px',
      padding: '0 1rem',
      border: '1.5px solid #e2e8f0',
      borderRadius: '10px',
      fontSize: '0.9375rem',
      background: '#fff',
      color: '#1e293b',
      transition: 'all 0.2s ease',
      outline: 'none',
    },
    submitBtn: {
      width: '100%',
      height: '48px',
      padding: '0 1.5rem',
      background: loading ? '#60a5fa' : '#2563eb',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
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
      color: '#64748b',
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
      color: '#1e293b',
      marginBottom: '0.5rem',
    },
    invalidSubtitle: {
      color: '#64748b',
      fontSize: '0.9375rem',
      marginBottom: '1.5rem',
    },
  };

  if (!token) {
    return (
      <>
        <style>{`
          .rp-back:hover {
            color: #2563eb !important;
          }
        `}</style>
        <div style={styles.page}>
          <div style={styles.card}>
            <div style={styles.header}>
              <div style={styles.logo}>CP</div>
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
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1) !important;
        }
        .rp-input::placeholder {
          color: #94a3b8;
        }
        .rp-submit:hover:not(:disabled) {
          background: #1d4ed8 !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        .rp-back:hover {
          color: #2563eb !important;
        }
      `}</style>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.logo}>CP</div>
            <h1 style={styles.title}>ClassPulse</h1>
            <p style={styles.subtitle}>Set New Password</p>
          </div>

          {message && <div style={styles.success}>{message}</div>}
          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="password">New Password</label>
              <input
                className="rp-input"
                id="password"
                name="password"
                type="password"
                placeholder="min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
                minLength={6}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="confirm">Confirm Password</label>
              <input
                className="rp-input"
                id="confirm"
                name="confirm"
                type="password"
                placeholder="repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={styles.input}
                required
              />
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
