import React, { useState, useCallback } from 'react';
import useGeolocation from '../hooks/useGeolocation';
import useLocalStorage from '../hooks/useLocalStorage';
import { generateFingerprint } from '../utils/fingerprint';
import api from '../utils/api';
import { ShieldCheck, CheckCircle, XCircle, Check } from '@phosphor-icons/react';
import '../styles/attend.css';

export default function Attend() {
  const { coords, error: geoError, loading: geoLoading, accuracy } = useGeolocation();
  const [submittedSessions, setSubmittedSessions] = useLocalStorage('attended_sessions', []);

  const [form, setForm] = useState({
    name: '',
    index_number: '',
    course_code: '',
    pin: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const [buildingValidating, setBuildingValidating] = useState(false);
  const [buildingInfo, setBuildingInfo] = useState(null);
  const [buildingError, setBuildingError] = useState(null);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'course_code' || e.target.name === 'pin') {
      setBuildingInfo(null);
      setBuildingError(null);
    }
  };

  const validateBuilding = useCallback(async () => {
    const { course_code, pin } = form;
    if (!course_code || !pin || pin.length < 4) return;

    setBuildingValidating(true);
    setBuildingError(null);
    setBuildingInfo(null);

    try {
      const res = await api.get('/api/attendance/building-info', {
        params: { course_code, pin },
      });
      setBuildingInfo(res.data);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Session not found.';
      setBuildingError(errorMsg);
    } finally {
      setBuildingValidating(false);
    }
  }, [form.course_code, form.pin]);

  const handleBlur = (e) => {
    if (e.target.name === 'pin' || e.target.name === 'course_code') {
      validateBuilding();
    }
  };

  const isLocallyLocked = submittedSessions.some(
    (s) => s.course_code === form.course_code && s.pin === form.pin
  );

  const accuracyPoor = accuracy && accuracy > 50;

  const canSubmit =
    !geoLoading &&
    !geoError &&
    coords &&
    form.name &&
    form.index_number &&
    form.course_code &&
    form.pin &&
    buildingInfo &&
    !submitting &&
    !isLocallyLocked;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setMessage(null);

    try {
      let fingerprint = '';
      try {
        fingerprint = await generateFingerprint();
      } catch (fpErr) {
        console.warn('Fingerprint failed, using fallback:', fpErr);
        fingerprint = `${navigator.userAgent}-${Date.now()}`;
      }

      await api.post('/api/attendance/check-in', {
        name: form.name,
        index_number: form.index_number,
        course_code: form.course_code,
        pin: form.pin,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        device_fingerprint: fingerprint,
      });

      setShowSuccess(true);
      setMessage('Attendance recorded!');
      setMessageType('success');

      const sessionKey = { course_code: form.course_code, pin: form.pin };
      setSubmittedSessions([...submittedSessions, sessionKey]);
      setForm({ name: '', index_number: '', course_code: '', pin: '' });
      setBuildingInfo(null);
    } catch (err) {
      console.error('Attendance error:', err);
      const errorMsg =
        err.response?.data?.error || 'Check-in failed. Try again.';
      setMessage(errorMsg);
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  };

  const geoStatusType = geoLoading
    ? 'loading'
    : geoError
      ? 'error'
      : accuracyPoor
        ? 'warning'
        : 'success';

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
      padding: '2rem',
      width: '100%',
      maxWidth: '500px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 10px 30px rgba(0, 0, 0, 0.06)',
    },
    brand: {
      textAlign: 'center',
      marginBottom: '1.75rem',
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
      marginBottom: '0.875rem',
    },
    brandTitle: {
      fontSize: '1.5rem',
      fontWeight: '700',
      marginBottom: '0.25rem',
      color: '#1e293b',
    },
    tagline: {
      color: '#64748b',
      fontSize: '0.875rem',
    },
    geoBar: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1rem',
      borderRadius: '10px',
      fontSize: '0.8125rem',
      fontWeight: '500',
      marginBottom: '1rem',
    },
    geoDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      flexShrink: 0,
    },
    lockedBar: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1rem',
      background: '#f0fdf4',
      color: '#16a34a',
      borderRadius: '10px',
      fontSize: '0.8125rem',
      fontWeight: '500',
      marginBottom: '1rem',
    },
    successCard: {
      textAlign: 'center',
      padding: '1.5rem',
      marginBottom: '1rem',
      background: '#f0fdf4',
      borderRadius: '14px',
    },
    successIcon: {
      width: '60px',
      height: '60px',
      borderRadius: '50%',
      background: '#16a34a',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '0.75rem',
    },
    successText: {
      color: '#16a34a',
      fontSize: '1rem',
      fontWeight: '600',
    },
    errorBar: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1rem',
      background: '#fef2f2',
      color: '#dc2626',
      borderRadius: '10px',
      fontSize: '0.8125rem',
      fontWeight: '500',
      marginBottom: '1rem',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    },
    fieldRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1rem',
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
    },
    label: {
      fontSize: '0.8125rem',
      fontWeight: '600',
      marginBottom: '0.5rem',
      color: '#475569',
    },
    input: {
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
    pinInput: {
      fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
      letterSpacing: '0.15em',
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    buildingStatus: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.625rem 1rem',
      borderRadius: '10px',
      fontSize: '0.8125rem',
      fontWeight: '500',
    },
    submitBtn: {
      width: '100%',
      height: '50px',
      background: canSubmit ? '#2563eb' : '#94a3b8',
      color: '#fff',
      border: 'none',
      borderRadius: '12px',
      fontSize: '0.9375rem',
      fontWeight: '600',
      cursor: canSubmit ? 'pointer' : 'not-allowed',
      transition: 'all 0.15s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      marginTop: '0.25rem',
    },
    btnLoading: {
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
      fontSize: '0.75rem',
      color: '#94a3b8',
    },
    warning: {
      padding: '0.625rem 0.875rem',
      background: '#fffbeb',
      color: '#d97706',
      borderRadius: '10px',
      fontSize: '0.75rem',
      fontWeight: '500',
      marginBottom: '1rem',
      lineHeight: 1.4,
    },
  };

  const geoBarStyle = {
    loading: { background: '#fffbeb', color: '#d97706' },
    error: { background: '#fef2f2', color: '#dc2626' },
    warning: { background: '#fffbeb', color: '#d97706' },
    success: { background: '#f0fdf4', color: '#16a34a' },
  };

  const geoDotStyle = {
    loading: { background: '#d97706', animation: 'pulse 1.2s ease-in-out infinite' },
    error: { background: '#dc2626' },
    warning: { background: '#d97706' },
    success: { background: '#16a34a', boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.2)' },
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .att-input:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1) !important;
        }
        .att-input::placeholder {
          color: #94a3b8;
        }
        .att-submit:hover:not(:disabled) {
          background: #1d4ed8 !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          transform: translateY(-1px);
        }
        .att-submit:active:not(:disabled) {
          transform: translateY(0);
        }
        @media (max-width: 480px) {
          .att-field-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.brand}>
            <div style={styles.logo}>CP</div>
            <h1 style={styles.brandTitle}>ClassPulse</h1>
            <p style={styles.tagline}>Mark your attendance</p>
          </div>

          <div style={{ ...styles.geoBar, ...geoBarStyle[geoStatusType] }}>
            <span style={{ ...styles.geoDot, ...geoDotStyle[geoStatusType] }} />
            {geoLoading && (
              <span>
                Acquiring GPS...
                {accuracy && <span style={{ opacity: 0.75 }}> &middot; &plusmn;{Math.round(accuracy)}m</span>}
              </span>
            )}
            {geoError && <span>{geoError}</span>}
            {!geoLoading && !geoError && coords && (
              <span>
                Location ready
                {accuracy && (
                  <span style={{ opacity: 0.75 }}>
                    {' '}&middot; &plusmn;{Math.round(accuracy)}m
                  </span>
                )}
              </span>
            )}
          </div>

          {accuracyPoor && !geoLoading && (
            <div style={styles.warning}>
              GPS accuracy is low ({Math.round(accuracy)}m). Move outdoors or near a window for better signal.
            </div>
          )}

          {isLocallyLocked && (
            <div style={styles.lockedBar}>
              <ShieldCheck weight="duotone" size={16} />
              Already marked for this session.
            </div>
          )}

          {showSuccess && messageType === 'success' && (
            <div style={styles.successCard}>
              <div style={styles.successIcon}>
                <CheckCircle weight="duotone" size={32} />
              </div>
              <p style={styles.successText}>Attendance recorded!</p>
            </div>
          )}

          {message && messageType === 'error' && (
            <div style={styles.errorBar}>
              <XCircle weight="duotone" size={16} />
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div className="att-field-row" style={styles.fieldRow}>
              <div style={styles.formGroup}>
                <label style={styles.label} htmlFor="course_code">Course Code</label>
                <input
                  className="att-input"
                  id="course_code"
                  name="course_code"
                  type="text"
                  placeholder="e.g. CS101"
                  value={form.course_code}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={styles.input}
                  required
                  disabled={submitting}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label} htmlFor="pin">Session PIN</label>
                <input
                  className="att-input"
                  id="pin"
                  name="pin"
                  type="text"
                  placeholder="e.g. 482916"
                  value={form.pin}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={{ ...styles.input, ...styles.pinInput }}
                  required
                  maxLength={6}
                  disabled={submitting}
                />
              </div>
            </div>

            {buildingValidating && (
              <div style={{ ...styles.buildingStatus, background: '#fffbeb', color: '#d97706' }}>
                <span style={{ width: '14px', height: '14px', border: '2px solid rgba(217, 119, 6, 0.2)', borderTopColor: '#d97706', borderRadius: '50%', animation: 'spin 0.6s linear infinite', flexShrink: 0 }} />
                Verifying session...
              </div>
            )}
            {buildingInfo && (
              <div style={{ ...styles.buildingStatus, background: '#f0fdf4', color: '#16a34a' }}>
                <Check weight="bold" size={14} />
                {buildingInfo.building_name} &middot; Week {buildingInfo.week_number}
              </div>
            )}
            {buildingError && (
              <div style={{ ...styles.buildingStatus, background: '#fef2f2', color: '#dc2626' }}>
                <XCircle weight="duotone" size={14} />
                {buildingError}
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="name">Full Name</label>
              <input
                className="att-input"
                id="name"
                name="name"
                type="text"
                placeholder="e.g. Ama Mensah"
                value={form.name}
                onChange={handleChange}
                style={styles.input}
                required
                disabled={submitting}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="index_number">Index Number</label>
              <input
                className="att-input"
                id="index_number"
                name="index_number"
                type="text"
                placeholder="e.g. CS2024001"
                value={form.index_number}
                onChange={handleChange}
                style={styles.input}
                required
                disabled={submitting}
              />
            </div>

            <button
              type="submit"
              className="att-submit"
              style={styles.submitBtn}
              disabled={!canSubmit}
            >
              {submitting ? (
                <span style={styles.btnLoading}>
                  <span style={styles.spinner} />
                  Checking in...
                </span>
              ) : (
                <>
                  <Check weight="bold" size={18} />
                  Check In
                </>
              )}
            </button>
          </form>

          <div style={styles.footer}>
            Powered by ClassPulse
          </div>
        </div>
      </div>
    </>
  );
}
