import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { EnvelopeSimple, ArrowLeft, CheckCircle, Warning } from '@phosphor-icons/react';
import api from '../utils/api';
import Spinner from '../components/Spinner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/api/auth/forgot-password', { email });
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
    iconCircle: {
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      background: '#DC2626',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '1.25rem',
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
      marginBottom: '2rem',
    },
    successBox: {
      padding: '0.875rem 1rem',
      background: '#F0FDF4',
      color: '#16A34A',
      borderRadius: '8px',
      fontSize: '0.8125rem',
      fontWeight: '500',
      marginBottom: '1.25rem',
      border: '1px solid rgba(22, 163, 74, 0.12)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.5rem',
    },
    errorBox: {
      padding: '0.875rem 1rem',
      background: '#FEF2F2',
      color: '#DC2626',
      borderRadius: '8px',
      fontSize: '0.8125rem',
      fontWeight: '500',
      marginBottom: '1.25rem',
      border: '1px solid rgba(220, 38, 38, 0.12)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.5rem',
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
      left: '0.875rem',
      color: '#9CA3AF',
      pointerEvents: 'none',
    },
    input: {
      width: '100%',
      height: '46px',
      padding: '0 1rem 0 2.75rem',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      fontSize: '0.9375rem',
      background: '#F5F5F5',
      color: '#1A1A1A',
      transition: 'all 0.2s ease',
      outline: 'none',
      boxSizing: 'border-box',
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
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
    },
  };

  return (
    <>
      <style>{`
        .fp-input:focus {
          border-color: #DC2626 !important;
        }
        .fp-input::placeholder {
          color: #9CA3AF;
        }
        .fp-submit:hover:not(:disabled) {
          background: #B91C1C !important;
        }
        .fp-back:hover {
          color: #DC2626 !important;
        }
      `}</style>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={styles.iconCircle}>
              <EnvelopeSimple weight="fill" size={28} />
            </div>
            <h1 style={styles.title}>Reset Your Password</h1>
            <p style={styles.subtitle}>We'll send you a reset link</p>
          </div>

          {message && (
            <div style={styles.successBox}>
              <CheckCircle weight="fill" size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{message}</span>
            </div>
          )}
          {error && (
            <div style={styles.errorBox}>
              <Warning weight="fill" size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="email">Email</label>
              <div style={styles.inputWrapper}>
                <EnvelopeSimple size={18} style={styles.inputIcon} />
                <input
                  className="fp-input"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="fp-submit"
              style={styles.submitBtn}
              disabled={loading}
            >
              {loading ? <><Spinner size={14} /> Sending...</> : 'Send Reset Link'}
            </button>
          </form>

          <p style={styles.backLink}>
            <Link to="/lecturer/login" className="fp-back" style={styles.backLinkA}>
              <ArrowLeft size={14} />
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
