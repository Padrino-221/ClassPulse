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

  const [campusValidating, setCampusValidating] = useState(false);
  const [campusInfo, setCampusInfo] = useState(null);
  const [campusError, setCampusError] = useState(null);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'course_code' || e.target.name === 'pin') {
      setCampusInfo(null);
      setCampusError(null);
    }
  };

  const validateCampus = useCallback(async () => {
    const { course_code, pin } = form;
    if (!course_code || !pin || pin.length < 4) return;

    setCampusValidating(true);
    setCampusError(null);
    setCampusInfo(null);

    try {
      const res = await api.get('/api/attendance/campus-info', {
        params: { course_code, pin },
      });
      setCampusInfo(res.data);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Session not found.';
      setCampusError(errorMsg);
    } finally {
      setCampusValidating(false);
    }
  }, [form.course_code, form.pin]);

  const handleBlur = (e) => {
    if (e.target.name === 'pin' || e.target.name === 'course_code') {
      validateCampus();
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
    campusInfo &&
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
      setCampusInfo(null);
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

  return (
    <div className="attend-page">
      <div className="attend-card">
        <div className="attend-card-brand">
          <div className="attend-logo">CP</div>
          <h1>ClassPulse</h1>
          <p className="attend-tagline">Mark your attendance</p>
        </div>

        <div className={`attend-geo-bar attend-geo-${geoStatusType}`}>
          <span className="attend-geo-dot" />
          {geoLoading && (
            <span>
              Acquiring GPS...
              {accuracy && <span className="attend-geo-accuracy"> &middot; &plusmn;{Math.round(accuracy)}m</span>}
            </span>
          )}
          {geoError && <span>{geoError}</span>}
          {!geoLoading && !geoError && coords && (
            <span>
              Location ready
              {accuracy && (
                <span className="attend-geo-accuracy">
                  {' '}&middot; &plusmn;{Math.round(accuracy)}m
                </span>
              )}
            </span>
          )}
        </div>

        {accuracyPoor && !geoLoading && (
          <div className="attend-accuracy-warning">
            GPS accuracy is low ({Math.round(accuracy)}m). Move outdoors or near a window for better signal.
          </div>
        )}

        {isLocallyLocked && (
          <div className="attend-locked-bar">
            <ShieldCheck weight="duotone" size={16} />
            Already marked for this session.
          </div>
        )}

        {showSuccess && messageType === 'success' && (
          <div className="attend-success-card">
            <div className="attend-success-icon">
              <CheckCircle weight="duotone" size={32} />
            </div>
            <p className="attend-success-text">Attendance recorded!</p>
          </div>
        )}

        {message && messageType === 'error' && (
          <div className="attend-error-bar">
            <XCircle weight="duotone" size={16} />
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="attend-form">
          <div className="attend-field-row">
            <div className="form-group">
              <label htmlFor="course_code">Course Code</label>
              <input
                id="course_code"
                name="course_code"
                type="text"
                placeholder="e.g. CS101"
                value={form.course_code}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="pin">Session PIN</label>
              <input
                id="pin"
                name="pin"
                type="text"
                placeholder="e.g. 482916"
                value={form.pin}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                maxLength={6}
                disabled={submitting}
                className="attend-pin-input"
              />
            </div>
          </div>

          {campusValidating && (
            <div className="attend-campus-status attend-campus-loading">
              <span className="attend-campus-spinner" />
              Verifying session...
            </div>
          )}
          {campusInfo && (
            <div className="attend-campus-status attend-campus-ok">
              <Check weight="bold" size={14} />
              {campusInfo.campus_name} &middot; Week {campusInfo.week_number}
            </div>
          )}
          {campusError && (
            <div className="attend-campus-status attend-campus-err">
              <XCircle weight="duotone" size={14} />
              {campusError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="e.g. Ama Mensah"
              value={form.name}
              onChange={handleChange}
              required
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <label htmlFor="index_number">Index Number</label>
            <input
              id="index_number"
              name="index_number"
              type="text"
              placeholder="e.g. CS2024001"
              value={form.index_number}
              onChange={handleChange}
              required
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="attend-submit-btn"
            disabled={!canSubmit}
          >
            {submitting ? (
              <span className="attend-btn-loading">
                <span className="attend-spinner" />
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

        <div className="attend-footer">
          Powered by ClassPulse
        </div>
      </div>
    </div>
  );
}
