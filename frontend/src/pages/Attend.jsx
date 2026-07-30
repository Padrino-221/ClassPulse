import React, { useState } from 'react';
import useGeolocation from '../hooks/useGeolocation';
import { generateFingerprint } from '../utils/fingerprint';
import api from '../utils/api';
import { CheckCircle, XCircle, Check, MapPin, ArrowLeft } from '@phosphor-icons/react';
import ClassPulseLogo from '../components/ClassPulseLogo';

export default function Attend() {
  const { coords, error: geoError, accuracy, startWatching } = useGeolocation();

  const [form, setForm] = useState({ name: '', index_number: '', pin: '' });
  const [step, setStep] = useState('form');     // form | confirm | loading | success | error
  const [sessionInfo, setSessionInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [validating, setValidating] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setValidating(true);

    try {
      const pinRes = await api.post('/api/attendance/validate-pin', { pin: form.pin });
      setSessionInfo(pinRes.data);
      setStep('confirm');
      startWatching();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Invalid PIN. Try again.');
    } finally {
      setValidating(false);
    }
  };

  const handleCheckIn = async () => {
    setStep('loading');
    setErrorMessage('');

    if (!coords) {
      startWatching();
      setErrorMessage('Waiting for GPS signal. Please allow location access and try again.');
      setStep('confirm');
      return;
    }

    try {
      let fingerprint = '';
      try {
        fingerprint = await generateFingerprint();
      } catch {
        fingerprint = `${navigator.userAgent}-${Date.now()}`;
      }

      await api.post('/api/attendance/check-in', {
        name: form.name,
        index_number: form.index_number,
        pin: form.pin,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        device_fingerprint: fingerprint,
      });

      setStep('success');
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Check-in failed. Try again.');
      setStep('error');
    }
  };

  const handleBack = () => {
    setStep('form');
    setSessionInfo(null);
    setErrorMessage('');
  };

  const handleRetry = () => {
    setStep('form');
    setSessionInfo(null);
    setErrorMessage('');
  };

  const now = new Date();
  const hours = now.getHours() % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM';

  const s = {
    page: {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', background: 'var(--bg-hover)',
    },
    container: {
      maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '1.25rem',
    },
    logoSection: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem',
    },
    logoCircle: {
      width: '56px', height: '56px', borderRadius: '50%', background: 'var(--brand)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.5rem', fontWeight: '800',
    },
    brandText: { fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' },
    subtitle: { fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '500', marginTop: '-0.25rem' },
    card: {
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: '8px', width: '100%',
    },
    formCard: { padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
    label: {
      display: 'block', fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-primary)',
      marginBottom: '0.375rem',
    },
    input: {
      width: '100%', padding: '0.6875rem 0.875rem', background: 'var(--bg-hover)',
      border: '1px solid transparent', borderRadius: '8px', fontSize: '0.875rem',
      color: 'var(--text-primary)', outline: 'none', transition: 'all 0.2s', fontFamily: 'inherit',
    },
    btn: {
      width: '100%', padding: '0.8125rem', background: 'var(--brand)', color: '#fff',
      border: 'none', borderRadius: '6px', fontSize: '0.9375rem', fontWeight: '700',
      cursor: 'pointer', transition: 'background 0.15s',
    },
    confirmBtn: {
      width: '100%', padding: '0.8125rem', background: 'var(--brand)', color: '#fff',
      border: 'none', borderRadius: '6px', fontSize: '0.9375rem', fontWeight: '700',
      cursor: 'pointer', transition: 'background 0.15s',
    },
    backBtn: {
      width: '100%', padding: '0.625rem', background: 'transparent', color: 'var(--text-secondary)',
      border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: '600',
      cursor: 'pointer', transition: 'all 0.15s',
    },
    formNote: {
      textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: '500',
    },
    confirmCard: { padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
    confirmTitle: {
      fontSize: '0.9375rem', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'center',
    },
    confirmGrid: {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
    },
    confirmItem: {
      display: 'flex', flexDirection: 'column', gap: '0.125rem',
    },
    confirmLabel: { fontSize: '0.6875rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
    confirmValue: { fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' },
    confirmFull: { gridColumn: '1 / -1' },
    gpsStatus: {
      display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
      borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500,
    },
    loadingCard: {
      padding: '3rem 1.25rem', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '1rem',
    },
    spinner: {
      width: '40px', height: '40px', border: '3px solid var(--border)',
      borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    },
    loadingText: { fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)' },
    successCard: {
      padding: '3rem 1.25rem', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '0.75rem',
    },
    successIcon: {
      width: '56px', height: '56px', borderRadius: '50%', background: 'var(--success-bg)',
      color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.75rem',
    },
    successTitle: { fontSize: '1.0625rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' },
    successDesc: { fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.5' },
    successTime: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500', marginTop: '0.25rem' },
    errorCard: {
      padding: '3rem 1.25rem', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '0.75rem',
    },
    errorIcon: {
      width: '56px', height: '56px', borderRadius: '50%', background: 'var(--error-bg)',
      color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.75rem',
    },
    errorTitle: { fontSize: '1.0625rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' },
    errorDesc: { fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.5' },
    retryBtn: {
      marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)',
      background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
      padding: '0.375rem 1rem', cursor: 'pointer', transition: 'all 0.15s',
    },
    footer: { fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: '500', paddingTop: '0.5rem' },
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .att-input:focus { border-color: var(--brand, #DC2626) !important; background: var(--bg-card) !important; }
        .att-input::placeholder { color: var(--text-muted); }
        .att-btn:hover:not(:disabled) { background: var(--brand-dark, #B91C1C) !important; }
        .att-btn:disabled { background: var(--error-border, #FCA5A5) !important; cursor: not-allowed; }
        .att-confirm-btn:hover:not(:disabled) { background: var(--brand-dark, #B91C1C) !important; }
        .att-confirm-btn:disabled { background: var(--error-border, #FCA5A5) !important; cursor: not-allowed; }
      `}</style>
      <div style={s.page}>
        <div style={s.container}>
          <div style={s.logoSection}>
            <ClassPulseLogo size={48} />
            <div style={s.brandText}>ClassPulse</div>
            <div style={s.subtitle}>Student Attendance</div>
          </div>

          {/* STEP 1: Enter details + PIN */}
          {step === 'form' && (
            <div style={s.card}>
              <form onSubmit={handleVerifyPin} style={s.formCard}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div>
                    <label style={s.label}>Full Name</label>
                    <input
                      className="att-input" name="name" type="text"
                      placeholder="e.g. John Doe" value={form.name}
                      onChange={handleChange} style={s.input} required
                    />
                  </div>
                  <div>
                    <label style={s.label}>Index Number</label>
                    <input
                      className="att-input" name="index_number" type="text"
                      placeholder="e.g. UG/2024/001" value={form.index_number}
                      onChange={handleChange} style={s.input} required
                    />
                  </div>
                  <div>
                    <label style={s.label}>Session PIN</label>
                    <input
                      className="att-input" name="pin" type="text"
                      placeholder="e.g. CS101-482916" value={form.pin}
                      onChange={handleChange} style={s.input} required maxLength={30}
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div style={{
                    ...s.gpsStatus, background: 'var(--error-bg)', color: 'var(--brand)',
                  }}>
                    <XCircle weight="duotone" size={16} />
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit" className="att-btn" style={s.btn}
                  disabled={!form.name || !form.index_number || !form.pin || validating}
                >
                  {validating ? 'Verifying...' : 'Verify PIN'}
                </button>
                <div style={s.formNote}>Enter your details and the session PIN from your lecturer</div>
              </form>
            </div>
          )}

          {/* STEP 2: Confirm session details + Mark Attendance */}
          {step === 'confirm' && sessionInfo && (
            <div style={s.card}>
              <div style={s.confirmCard}>
                <div style={s.confirmTitle}>Confirm Session Details</div>

                <div style={s.confirmGrid}>
                  <div style={s.confirmItem}>
                    <span style={s.confirmLabel}>Course</span>
                    <span style={s.confirmValue}>{sessionInfo.course_code}</span>
                  </div>
                  <div style={s.confirmItem}>
                    <span style={s.confirmLabel}>Class</span>
                    <span style={s.confirmValue}>{sessionInfo.class_name}</span>
                  </div>
                  <div style={s.confirmItem}>
                    <span style={s.confirmLabel}>Week</span>
                    <span style={s.confirmValue}>Week {sessionInfo.week_number}</span>
                  </div>
                  <div style={s.confirmItem}>
                    <span style={s.confirmLabel}>Hall</span>
                    <span style={s.confirmValue}>{sessionInfo.lecture_hall_name}</span>
                  </div>
                </div>

                <div style={{
                  ...s.gpsStatus,
                  background: geoError ? 'var(--error-bg)' : coords ? 'var(--success-bg)' : '#FFF7ED',
                  color: geoError ? 'var(--brand)' : coords ? 'var(--success)' : '#D97706',
                }}>
                  <MapPin weight="duotone" size={16} />
                  {coords
                    ? `GPS Ready (${Math.round(accuracy)}m accuracy)`
                    : geoError
                      ? geoError
                      : 'Acquiring GPS...'
                  }
                </div>

                {errorMessage && (
                  <div style={{
                    ...s.gpsStatus, background: 'var(--error-bg)', color: 'var(--brand)',
                  }}>
                    <XCircle weight="duotone" size={16} />
                    {errorMessage}
                  </div>
                )}

                <button
                  className="att-confirm-btn" style={s.confirmBtn}
                  onClick={handleCheckIn}
                  disabled={!coords}
                >
                  {!coords ? 'Waiting for GPS...' : 'Mark Attendance'}
                </button>
                <button style={s.backBtn} onClick={handleBack}>
                  <ArrowLeft weight="duotone" size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
                  Change PIN
                </button>
              </div>
            </div>
          )}

          {/* LOADING */}
          {step === 'loading' && (
            <div style={s.card}>
              <div style={s.loadingCard}>
                <div style={s.spinner} />
                <div style={s.loadingText}>Verifying attendance...</div>
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {step === 'success' && (
            <div style={s.card}>
              <div style={s.successCard}>
                <div style={s.successIcon}>
                  <CheckCircle weight="fill" size={32} />
                </div>
                <div style={s.successTitle}>Attendance Marked!</div>
                <div style={s.successDesc}>Your attendance has been recorded successfully.</div>
                <div style={s.successTime}>Marked at {hours}:{minutes} {ampm}</div>
              </div>
            </div>
          )}

          {/* ERROR */}
          {step === 'error' && (
            <div style={s.card}>
              <div style={s.errorCard}>
                <div style={s.errorIcon}>
                  <XCircle weight="fill" size={32} />
                </div>
                <div style={s.errorTitle}>Check-in Failed</div>
                <div style={s.errorDesc}>{errorMessage}</div>
                <button style={s.retryBtn} onClick={handleRetry}>Try Again</button>
              </div>
            </div>
          )}

          <div style={s.footer}>Powered by ClassPulse</div>
        </div>
      </div>
    </>
  );
}
