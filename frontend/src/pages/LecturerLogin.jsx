import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { Eye, EyeSlash } from '@phosphor-icons/react';

const carouselContent = [
  {
    headline: 'Speedy, Easy and Fast',
    description: 'Track attendance in real-time, generate instant reports, and manage your classes efficiently with smart analytics.',
  },
  {
    headline: 'Smart Analytics Dashboard',
    description: 'Get instant insights into attendance patterns, trends, and generate comprehensive reports with just one click.',
  },
  {
    headline: 'GPS & Geofencing',
    description: 'Verify student location with GPS tracking and geofencing to ensure accurate attendance records.',
  },
];

export default function LecturerLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

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
      background: 'linear-gradient(155deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)',
      display: 'flex',
      flexDirection: 'column',
      padding: '2.5rem 3rem',
      position: 'relative',
      overflow: 'hidden',
    },
    brandOverlay: {
      position: 'absolute',
      inset: 0,
      opacity: 0.08,
      backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.4) 1px, transparent 0)`,
      backgroundSize: '32px 32px',
    },
    decorCircle1: {
      position: 'absolute',
      top: '-15%',
      right: '-10%',
      width: '400px',
      height: '400px',
      borderRadius: '50%',
      background: 'rgba(255, 255, 255, 0.06)',
    },
    decorCircle2: {
      position: 'absolute',
      bottom: '-20%',
      left: '-15%',
      width: '350px',
      height: '350px',
      borderRadius: '50%',
      background: 'rgba(255, 255, 255, 0.04)',
    },
    decorLines: {
      position: 'absolute',
      top: '15%',
      right: '8%',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      opacity: 0.3,
    },
    decorLine: {
      width: '24px',
      height: '3px',
      background: '#fff',
      borderRadius: '2px',
    },
    decorDots: {
      position: 'absolute',
      bottom: '12%',
      left: '6%',
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 8px)',
      gap: '8px',
      opacity: 0.25,
    },
    decorDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: '#fff',
    },
    brandHeader: {
      position: 'relative',
      zIndex: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      marginBottom: '2rem',
    },
    logoBox: {
      width: '42px',
      height: '42px',
      borderRadius: '12px',
      background: 'rgba(255, 255, 255, 0.18)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.125rem',
      fontWeight: '800',
      color: '#fff',
      letterSpacing: '-0.5px',
    },
    logoText: {
      fontSize: '1.375rem',
      fontWeight: '700',
      color: '#fff',
      letterSpacing: '-0.3px',
    },
    cardsContainer: {
      position: 'relative',
      zIndex: 2,
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '320px',
    },
    dashboardCard: {
      width: '320px',
      background: '#fff',
      borderRadius: '16px',
      padding: '1.25rem',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
      position: 'relative',
    },
    dashboardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '1rem',
    },
    statBox: {
      flex: 1,
    },
    statLabel: {
      fontSize: '0.6875rem',
      color: '#64748b',
      marginBottom: '0.25rem',
      fontWeight: '500',
    },
    statValue: {
      fontSize: '1.125rem',
      fontWeight: '700',
      color: '#1e293b',
    },
    chartArea: {
      height: '80px',
      background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0.02) 100%)',
      borderRadius: '8px',
      marginBottom: '1rem',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'flex-end',
      padding: '0 0.5rem 0.5rem',
      gap: '6px',
    },
    chartBar: {
      flex: 1,
      background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
      borderRadius: '4px 4px 0 0',
      minHeight: '8px',
    },
    transactionList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.625rem',
    },
    transactionItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '0.75rem',
    },
    transactionLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    transactionIcon: {
      width: '28px',
      height: '28px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.75rem',
    },
    transactionName: {
      color: '#1e293b',
      fontWeight: '500',
    },
    transactionTime: {
      color: '#94a3b8',
      fontSize: '0.6875rem',
    },
    transactionAmount: {
      fontWeight: '600',
    },
    successCard: {
      position: 'absolute',
      bottom: '20px',
      left: '-30px',
      background: '#fff',
      borderRadius: '12px',
      padding: '0.875rem 1rem',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      zIndex: 3,
    },
    successIcon: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      background: '#dcfce7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1rem',
    },
    successText: {
      fontSize: '0.75rem',
      color: '#1e293b',
      fontWeight: '500',
    },
    successSubtext: {
      fontSize: '0.6875rem',
      color: '#64748b',
    },
    notificationCard: {
      position: 'absolute',
      top: '10px',
      right: '-20px',
      background: '#fff',
      borderRadius: '10px',
      padding: '0.625rem 0.875rem',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      zIndex: 3,
    },
    notifIcon: {
      width: '28px',
      height: '28px',
      borderRadius: '8px',
      background: '#dbeafe',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.875rem',
    },
    notifText: {
      fontSize: '0.6875rem',
      color: '#1e293b',
      fontWeight: '500',
    },
    notifAmount: {
      fontSize: '0.75rem',
      color: '#16a34a',
      fontWeight: '600',
    },
    brandBottom: {
      position: 'relative',
      zIndex: 2,
      marginTop: 'auto',
      color: '#fff',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    brandHeadline: {
      fontSize: '1.75rem',
      fontWeight: '800',
      marginBottom: '0.75rem',
      letterSpacing: '-0.5px',
      lineHeight: 1.2,
    },
    brandDescription: {
      fontSize: '0.9375rem',
      opacity: 0.85,
      lineHeight: 1.6,
      marginBottom: '1.5rem',
      maxWidth: '380px',
    },
    paginationDots: {
      display: 'flex',
      gap: '8px',
      cursor: 'pointer',
    },
    dot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: 'rgba(255, 255, 255, 0.4)',
      transition: 'all 0.3s ease',
    },
    dotActive: {
      width: '24px',
      height: '8px',
      borderRadius: '4px',
      background: '#fff',
      transition: 'all 0.3s ease',
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
        .lp-carousel-dot {
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .lp-carousel-dot:hover {
          background: rgba(255, 255, 255, 0.7) !important;
        }
        @media (max-width: 1024px) {
          .lp-brand-panel { width: 38% !important; }
        }
        @media (max-width: 768px) {
          .lp-brand-panel { display: none !important; }
          .lp-form-panel { padding: 2rem 1.5rem !important; }
        }
      `}</style>
      <div style={styles.container}>
        <div className="lp-brand-panel" style={styles.brandPanel}>
          <div style={styles.brandOverlay} />
          <div style={styles.decorCircle1} />
          <div style={styles.decorCircle2} />
          
          <div style={styles.decorLines}>
            <div style={styles.decorLine} />
            <div style={{ ...styles.decorLine, width: '16px' }} />
            <div style={styles.decorLine} />
          </div>
          
          <div style={styles.decorDots}>
            {[...Array(12)].map((_, i) => (
              <div key={i} style={styles.decorDot} />
            ))}
          </div>

          <div style={styles.brandHeader}>
            <div style={styles.logoBox}>CP</div>
            <span style={styles.logoText}>ClassPulse</span>
          </div>

          <div style={styles.cardsContainer}>
            <div style={styles.dashboardCard}>
              <div style={styles.dashboardHeader}>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Present</div>
                  <div style={{ ...styles.statValue, color: '#16a34a' }}>245</div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Absent</div>
                  <div style={{ ...styles.statValue, color: '#dc2626' }}>12</div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Late</div>
                  <div style={{ ...styles.statValue, color: '#f59e0b' }}>8</div>
                </div>
              </div>

              <div style={styles.chartArea}>
                <div style={{ ...styles.chartBar, height: '65%' }} />
                <div style={{ ...styles.chartBar, height: '85%' }} />
                <div style={{ ...styles.chartBar, height: '45%' }} />
                <div style={{ ...styles.chartBar, height: '90%' }} />
                <div style={{ ...styles.chartBar, height: '70%' }} />
                <div style={{ ...styles.chartBar, height: '55%' }} />
                <div style={{ ...styles.chartBar, height: '80%' }} />
              </div>

              <div style={styles.transactionList}>
                <div style={styles.transactionItem}>
                  <div style={styles.transactionLeft}>
                    <div style={{ ...styles.transactionIcon, background: '#dcfce7' }}>&#10003;</div>
                    <div>
                      <div style={styles.transactionName}>CS101 - Checked in</div>
                      <div style={styles.transactionTime}>Today at 9:00 AM</div>
                    </div>
                  </div>
                  <div style={{ ...styles.transactionAmount, color: '#16a34a' }}>+42</div>
                </div>
                <div style={styles.transactionItem}>
                  <div style={styles.transactionLeft}>
                    <div style={{ ...styles.transactionIcon, background: '#fee2e2' }}>&#10007;</div>
                    <div>
                      <div style={styles.transactionName}>MATH201 - Absent</div>
                      <div style={styles.transactionTime}>Today at 8:30 AM</div>
                    </div>
                  </div>
                  <div style={{ ...styles.transactionAmount, color: '#dc2626' }}>-3</div>
                </div>
              </div>

              <div style={styles.successCard}>
                <div style={styles.successIcon}>&#10003;</div>
                <div>
                  <div style={styles.successText}>Attendance synced!</div>
                  <div style={styles.successSubtext}>All records updated</div>
                </div>
              </div>

              <div style={styles.notificationCard}>
                <div style={styles.notifIcon}>&#128202;</div>
                <div>
                  <div style={styles.notifText}>Report Generated</div>
                  <div style={styles.notifAmount}>Weekly summary ready</div>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.brandBottom}>
            <h2 style={styles.brandHeadline}>{carouselContent[activeSlide].headline}</h2>
            <p style={styles.brandDescription}>
              {carouselContent[activeSlide].description}
            </p>
            <div style={styles.paginationDots}>
              {carouselContent.map((_, index) => (
                <div
                  key={index}
                  className="lp-carousel-dot"
                  style={activeSlide === index ? styles.dotActive : styles.dot}
                  onClick={() => setActiveSlide(index)}
                />
              ))}
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
