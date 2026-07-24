import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { Eye, EyeSlash } from '@phosphor-icons/react';

export default function LecturerLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/api/auth/login', form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      if (res.data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/lecturer/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't sign in.");
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      background: '#f8fafc',
    },
    brandPanel: {
      width: '42%',
      background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem',
      position: 'relative',
      overflow: 'hidden',
    },
    brandOverlay: {
      position: 'absolute',
      inset: 0,
      opacity: 0.1,
      backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)`,
      backgroundSize: '40px 40px',
    },
    brandContent: {
      position: 'relative',
      zIndex: 1,
      maxWidth: '360px',
      color: '#fff',
    },
    logo: {
      width: '72px',
      height: '72px',
      borderRadius: '16px',
      background: 'rgba(255, 255, 255, 0.15)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.75rem',
      fontWeight: '800',
      letterSpacing: '-0.5px',
      marginBottom: '2rem',
    },
    title: {
      fontSize: '2.25rem',
      fontWeight: '800',
      marginBottom: '0.5rem',
      letterSpacing: '-0.5px',
    },
    subtitle: {
      fontSize: '1.0625rem',
      opacity: 0.85,
      marginBottom: '2.75rem',
      lineHeight: 1.6,
    },
    features: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    },
    feature: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.875rem',
      fontSize: '0.9375rem',
      opacity: 0.92,
    },
    featureIcon: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: 'rgba(255, 255, 255, 0.18)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.8125rem',
      flexShrink: 0,
    },
    formPanel: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem',
    },
    card: {
      width: '100%',
      maxWidth: '420px',
      background: '#fff',
      borderRadius: '16px',
      padding: '2.5rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 10px 30px rgba(0, 0, 0, 0.06)',
    },
    heading: {
      fontSize: '1.625rem',
      fontWeight: '700',
      marginBottom: '0.375rem',
      color: '#1e293b',
    },
    description: {
      color: '#64748b',
      fontSize: '0.9375rem',
      marginBottom: '2rem',
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
    inputWrapper: {
      position: 'relative',
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
    passwordToggle: {
      position: 'absolute',
      right: '0.75rem',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'none',
      border: 'none',
      padding: '0.25rem',
      cursor: 'pointer',
      color: '#94a3b8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'color 0.15s ease',
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
      marginTop: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
    },
    spinner: {
      width: '18px',
      height: '18px',
      border: '2px solid rgba(255, 255, 255, 0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
    },
    footer: {
      marginTop: '1.5rem',
      textAlign: 'center',
      fontSize: '0.875rem',
    },
    footerLink: {
      color: '#64748b',
      textDecoration: 'none',
      fontWeight: '500',
      transition: 'color 0.15s ease',
    },
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .lp-input:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .lp-input::placeholder {
          color: #94a3b8;
        }
        .lp-submit:hover:not(:disabled) {
          background: #1d4ed8 !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        .lp-footer-link:hover {
          color: #2563eb !important;
        }
        @media (max-width: 768px) {
          .lp-brand-panel { display: none !important; }
          .lp-form-panel { padding: 2rem 1.5rem !important; }
        }
      `}</style>
      <div style={styles.container}>
        <div className="lp-brand-panel" style={styles.brandPanel}>
          <div style={styles.brandOverlay} />
          <div style={styles.brandContent}>
            <div style={styles.logo}>CP</div>
            <h1 style={styles.title}>ClassPulse</h1>
            <p style={styles.subtitle}>Smart Attendance Management</p>
            <div style={styles.features}>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>&#10003;</span>
                <span>Real-time attendance tracking</span>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>&#10003;</span>
                <span>GPS & Rolling Pin</span>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>&#10003;</span>
                <span>Instant analytics dashboard</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-form-panel" style={styles.formPanel}>
          <div style={styles.card}>
            <h2 style={styles.heading}>Welcome back</h2>
            <p style={styles.description}>Sign in to your account to continue</p>

            {error && <div style={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <div style={styles.formGroup}>
                <label style={styles.label} htmlFor="email">Email</label>
                <input
                  className="lp-input"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={form.email}
                  onChange={handleChange}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label} htmlFor="password">Password</label>
                <div style={styles.inputWrapper}>
                  <input
                    className="lp-input"
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={handleChange}
                    style={{ ...styles.input, paddingRight: '3rem' }}
                    required
                  />
                  <button
                    type="button"
                    style={styles.passwordToggle}
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeSlash weight="duotone" size={18} />
                    ) : (
                      <Eye weight="duotone" size={18} />
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="lp-submit"
                style={styles.submitBtn}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span style={styles.spinner} />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div style={styles.footer}>
              <Link to="/forgot-password" className="lp-footer-link" style={styles.footerLink}>Forgot password?</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
