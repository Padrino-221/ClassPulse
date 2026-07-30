import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { Eye, EyeSlash, EnvelopeSimple, LockKey, CheckCircle } from '@phosphor-icons/react';
import ClassPulseLogo from '../components/ClassPulseLogo';

export default function LecturerLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

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
      background: '#F5F5F5',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    leftPanel: {
      flex: '0 0 60%',
      background: '#F5F5F5',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2.5rem',
      position: 'relative',
    },
    leftHeader: {
      position: 'absolute',
      top: '1.5rem',
      left: '2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    },
    logoCircle: {
      width: '38px',
      height: '38px',
      borderRadius: '50%',
      background: '#DC2626',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: '700',
      fontSize: '0.95rem',
    },
    logoText: {
      fontWeight: '700',
      fontSize: '1.1rem',
      color: '#1A1A1A',
    },
    card: {
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      width: '100%',
      maxWidth: '420px',
      padding: '2.5rem 2rem',
    },
    heading: {
      fontSize: '1.5rem',
      fontWeight: '700',
      color: '#1A1A1A',
      marginBottom: '0.25rem',
    },
    subtitle: {
      color: '#6B7280',
      fontSize: '0.875rem',
      marginBottom: '1.5rem',
    },
    error: {
      padding: '0.875rem 1rem',
      background: '#FEE2E2',
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
      color: '#1A1A1A',
      marginBottom: '0.4rem',
    },
    inputWrapper: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    },
    inputIcon: {
      position: 'absolute',
      left: '0.85rem',
      color: '#9CA3AF',
      fontSize: '1.05rem',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
    },
    input: {
      width: '100%',
      padding: '0.7rem 0.85rem 0.7rem 2.6rem',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      background: '#F5F5F5',
      color: '#1A1A1A',
      fontSize: '0.875rem',
      fontFamily: 'inherit',
      outline: 'none',
      transition: 'border-color 0.2s, background 0.2s',
    },
    passwordToggle: {
      position: 'absolute',
      right: '0.75rem',
      background: 'none',
      border: 'none',
      color: '#9CA3AF',
      fontSize: '1.1rem',
      padding: '0.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'color 0.2s',
    },
    formExtras: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '1.5rem',
    },
    rememberMe: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    checkbox: {
      width: '16px',
      height: '16px',
      accentColor: '#DC2626',
      cursor: 'pointer',
    },
    rememberLabel: {
      fontSize: '0.8125rem',
      color: '#6B7280',
      cursor: 'pointer',
    },
    forgotLink: {
      fontSize: '0.8125rem',
      color: '#DC2626',
      fontWeight: '600',
      cursor: 'pointer',
      background: 'none',
      border: 'none',
      padding: 0,
      transition: 'opacity 0.2s',
      fontFamily: 'inherit',
    },
    submitBtn: {
      width: '100%',
      height: '44px',
      background: loading ? '#F87171' : '#DC2626',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      fontSize: '0.9375rem',
      fontWeight: '600',
      cursor: loading ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      transition: 'background 0.2s',
      fontFamily: 'inherit',
    },
    spinner: {
      width: '18px',
      height: '18px',
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
    },
    divider: {
      border: 'none',
      borderTop: '1px solid #E5E7EB',
      margin: '1.5rem 0',
    },
    footer: {
      textAlign: 'center',
      fontSize: '0.8125rem',
      color: '#6B7280',
    },
    rightPanel: {
      flex: '0 0 40%',
      background: '#DC2626',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem',
      position: 'relative',
      overflow: 'hidden',
    },
    decorCircle1: {
      position: 'absolute',
      width: '500px',
      height: '500px',
      borderRadius: '50%',
      background: '#B91C1C',
      opacity: '0.35',
      top: '-120px',
      right: '-160px',
      pointerEvents: 'none',
    },
    decorCircle2: {
      position: 'absolute',
      width: '300px',
      height: '300px',
      borderRadius: '50%',
      background: '#B91C1C',
      opacity: '0.2',
      bottom: '-80px',
      left: '-80px',
      pointerEvents: 'none',
    },
    rightContent: {
      position: 'relative',
      zIndex: 1,
      textAlign: 'center',
      maxWidth: '320px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
    },
    brandHeading: {
      fontSize: '2rem',
      fontWeight: '800',
      color: '#fff',
      margin: 0,
    },
    brandSubtitle: {
      fontSize: '1rem',
      color: 'rgba(255,255,255,0.8)',
      marginBottom: '2.5rem',
      fontWeight: '400',
    },
    featureList: {
      listStyle: 'none',
      textAlign: 'left',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      margin: 0,
      padding: 0,
    },
    featureItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      color: 'rgba(255,255,255,0.92)',
      fontSize: '0.9375rem',
      fontWeight: '500',
    },
    featureIcon: {
      fontSize: '1.25rem',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
    },
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .lp-input:focus {
          border-color: #DC2626 !important;
          background: #FFFFFF !important;
        }
        .lp-input::placeholder {
          color: #9CA3AF;
        }
        .lp-submit:hover:not(:disabled) {
          background: #B91C1C !important;
        }
        .lp-forgot-link:hover {
          opacity: 0.8;
        }
        .lp-pw-toggle:hover {
          color: #6B7280 !important;
        }
        @media (max-width: 900px) {
          .lp-right-panel { display: none !important; }
          .lp-left-panel { flex: 1 !important; }
        }
        @media (max-width: 480px) {
          .lp-left-panel { padding: 1.5rem 1rem !important; }
          .lp-card { padding: 1.75rem 1.25rem !important; }
        }
      `}</style>
      <div style={styles.container}>
        {/* LEFT SIDE — FORM */}
        <div className="lp-left-panel" style={styles.leftPanel}>
          <div className="lp-card" style={styles.card}>
            <h1 style={styles.heading}>Welcome back</h1>
            <p style={styles.subtitle}>Sign in to your account</p>

            {error && <div style={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit}>
              {/* EMAIL */}
              <div style={styles.formGroup}>
                <label style={styles.label} htmlFor="email">Email</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputIcon}>
                    <EnvelopeSimple size={18} />
                  </span>
                  <input
                    className="lp-input"
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@classpulse.edu"
                    value={form.email}
                    onChange={handleChange}
                    style={styles.input}
                    required
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div style={styles.formGroup}>
                <label style={styles.label} htmlFor="password">Password</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputIcon}>
                    <LockKey size={18} />
                  </span>
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
                    className="lp-pw-toggle"
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

              {/* REMEMBER / FORGOT */}
              <div style={styles.formExtras}>
                <div style={styles.rememberMe}>
                  <input
                    type="checkbox"
                    id="remember"
                    style={styles.checkbox}
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label htmlFor="remember" style={styles.rememberLabel}>Remember me</label>
                </div>
                <Link to="/forgot-password" className="lp-forgot-link" style={styles.forgotLink}>Forgot password?</Link>
              </div>

              {/* SIGN IN */}
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

              <hr style={styles.divider} />

              {/* FOOTER */}
              <p style={styles.footer}>Don't have an account? Contact your administrator</p>
            </form>
          </div>
        </div>

        {/* RIGHT SIDE — BRANDING */}
        <div className="lp-right-panel" style={styles.rightPanel}>
          <div style={styles.decorCircle1} />
          <div style={styles.decorCircle2} />
          <div style={styles.rightContent}>
            <ClassPulseLogo size={64} />
            <h2 style={styles.brandHeading}>ClassPulse</h2>
            <p style={styles.brandSubtitle}>Smart Attendance Management</p>
            <ul style={styles.featureList}>
              <li style={styles.featureItem}>
                <span style={styles.featureIcon}><CheckCircle weight="fill" size={20} /></span>
                Real-time attendance tracking
              </li>
              <li style={styles.featureItem}>
                <span style={styles.featureIcon}><CheckCircle weight="fill" size={20} /></span>
                GPS-verified check-ins
              </li>
              <li style={styles.featureItem}>
                <span style={styles.featureIcon}><CheckCircle weight="fill" size={20} /></span>
                Automated reporting
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
