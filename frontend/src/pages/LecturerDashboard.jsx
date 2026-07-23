import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Pulse, CheckCircle, BookOpen, Users, CalendarBlank } from '@phosphor-icons/react';
import api from '../utils/api';
import { useSearch } from '../context/SearchContext';
import DashboardLayout from '../components/DashboardLayout';
import SummaryCards from '../components/SummaryCards';
import LiveTracker from '../components/LiveTracker';
import ManualOverrideModal from '../components/ManualOverrideModal';
import MultiSelect from '../components/MultiSelect';
import Select from '../components/Select';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import AlertModal from '../components/AlertModal';

const PAGE_SIZE = 15;

function RollingPinDisplay({ sessionId, pinSpinning }) {
  const [pin, setPin] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const tickRef = useRef(null);

  const fetchPin = useCallback(async () => {
    try {
      const res = await api.get(`/api/lecturer/session/${sessionId}/pin`);
      if (res.data.active) {
        setPin(res.data.pin);
        setExpiresIn(res.data.expiresIn);
      } else {
        setPin('--');
        setExpiresIn(0);
      }
    } catch {
      setPin('--');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchPin();
    intervalRef.current = setInterval(fetchPin, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPin]);

  useEffect(() => {
    if (!pinSpinning) return;
    tickRef.current = setInterval(() => {
      setExpiresIn((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [pinSpinning]);

  if (loading) {
    return (
      <div className="pin-hero">
        <span className="pin-hero-label">Session PIN</span>
        <span className="pin-hero-value">---</span>
      </div>
    );
  }

  if (!pinSpinning) {
    return (
      <div className="pin-hero">
        <span className="pin-hero-label">Session PIN (static)</span>
        <span className="pin-hero-value">{pin}</span>
      </div>
    );
  }

  const barWidth = expiresIn > 0 ? ((expiresIn / 60000) * 100) : 0;
  const secondsLeft = Math.ceil(expiresIn / 1000);
  const barColor = secondsLeft <= 10 ? 'var(--error)' : secondsLeft <= 20 ? 'var(--warning)' : 'var(--brand)';

  return (
    <div className="pin-hero">
      <span className="pin-hero-label">Session PIN (rolling — refreshes every 60s)</span>
      <span className="pin-hero-value">{pin}</span>
      <div className="pin-hero-timer">
        <div className="pin-hero-bar-track">
          <div
            className="pin-hero-bar-fill"
            style={{ width: `${barWidth}%`, background: barColor }}
          />
        </div>
        <span className="pin-hero-countdown" style={{ color: barColor }}>
          {secondsLeft}s left
        </span>
      </div>
    </div>
  );
}

export default function LecturerDashboard() {
  const { searchQuery } = useSearch();
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [manualSessionId, setManualSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [sessionPage, setSessionPage] = useState(1);

  const [form, setForm] = useState({
    course_code: '',
    class_ids: [],
    week_number: '',
    building_id: '',
    pin_spinning: true,
  });
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [alertMsg, setAlertMsg] = useState('');

  const loadData = useCallback(async (page) => {
    try {
      const [coursesRes, classesRes, sessionsRes, buildingsRes] = await Promise.all([
        api.get('/api/lecturer/courses'),
        api.get('/api/lecturer/classes'),
        api.get('/api/lecturer/sessions', { params: { limit: PAGE_SIZE, offset: ((page || 1) - 1) * PAGE_SIZE } }),
        api.get('/api/lecturer/buildings'),
      ]);
      setCourses(coursesRes.data.courses);
      setClasses(classesRes.data.classes);
      setSessions(sessionsRes.data.sessions);
      setTotal(sessionsRes.data.total || 0);
      setBuildings(buildingsRes.data.buildings);

      const active = sessionsRes.data.sessions?.filter((s) => s.is_active) || [];
      setActiveSessions(active);
    } catch {
      setError("Couldn't load.");
    }
  }, []);

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const activateSession = async () => {
    if (!form.building_id) {
      setError('Select a building.');
      return;
    }
    if (form.class_ids.length === 0) {
      setError('Select at least one class.');
      return;
    }
    setActivating(true);
    setError('');
    try {
      await api.post('/api/lecturer/activate', {
        course_code: form.course_code,
        class_ids: form.class_ids,
        week_number: parseInt(form.week_number),
        building_id: parseInt(form.building_id),
        pin_spinning: form.pin_spinning,
      });
      setForm((prev) => ({ ...prev, class_ids: [] }));
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || "Couldn't start session.";
      if (err.response?.status === 409) {
        setAlertMsg(msg);
      } else {
        setError(msg);
      }
    } finally {
      setActivating(false);
    }
  };

  const handleSessionPageChange = (p) => {
    setSessionPage(p);
    loadData(p);
  };

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) =>
      [s.course_code, s.class_name, String(s.week_number), s.course_name]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const deactivateSession = async (sessionId) => {
    try {
      await api.post(`/api/lecturer/deactivate/${sessionId}`);
      setActiveSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      loadData();
    } catch {
      setError("Couldn't end session.");
    }
  };

  const todayTotal = sessions.reduce((sum, s) => sum + parseInt(s.attendance_count || 0), 0);

  const summaryCards = [
    {
      value: activeSessions.length,
      label: 'Active Sessions',
      change: null,
      icon: <Pulse weight="duotone" size={24} />,
    },
    {
      value: todayTotal,
      label: "Today's Total",
      change: sessions.length > 0 ? 12 : null,
      icon: <CheckCircle weight="duotone" size={24} />,
    },
    {
      value: courses.length,
      label: 'Courses',
      change: null,
      icon: <BookOpen weight="duotone" size={24} />,
    },
    {
      value: classes.length,
      label: 'Classes',
      change: null,
      icon: <Users weight="duotone" size={24} />,
    },
  ];

  const hasActive = activeSessions.length > 0;

  return (
    <DashboardLayout>
      {error && <div className="message error">{error}</div>}

      {!hasActive ? (
        <>
          <SummaryCards cards={summaryCards} />
          <div className="card session-form-card">
              <div className="card-header">
                  <h3>New Session</h3>
              </div>
              <div className="card-body session-form-stack">
                <div className="form-group">
                  <label>Course</label>
                  <Select name="course_code" value={form.course_code} onChange={handleChange}>
                    <option value="">Select Course</option>
                    {courses.map((c) => (
                      <option key={c.course_code} value={c.course_code}>
                        {c.course_code} - {c.course_name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="form-group">
                  <MultiSelect
                    label="Classes"
                    options={classes.map((c) => ({ value: c.class_id, label: c.class_name }))}
                    value={form.class_ids}
                    onChange={(val) => setForm((prev) => ({ ...prev, class_ids: val }))}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: '0 0 100px' }}>
                    <label>Week</label>
                    <input type="number" name="week_number" min="1" max="52" value={form.week_number} onChange={handleChange} placeholder="e.g. 1" />
                  </div>
                  <div className="form-group">
                    <label>Building</label>
                    <Select name="building_id" value={form.building_id} onChange={handleChange}>
                      <option value="">Select Building</option>
                      {buildings.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={form.pin_spinning}
                    onChange={(e) => setForm((prev) => ({ ...prev, pin_spinning: e.target.checked }))}
                  />
                  <span className="toggle-track" />
                  <span className="toggle-label">Rolling PIN</span>
                </label>
                <button
                  className="submit-btn session-form-submit"
                  onClick={activateSession}
                  disabled={activating || !form.course_code || form.class_ids.length === 0 || !form.week_number || !form.building_id}
                >
                    {activating ? 'Starting...' : 'Start Session'}
                </button>
              </div>
            </div>
        </>
      ) : (
        <>
          <SummaryCards cards={summaryCards} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {activeSessions.map((s) => (
              <div key={s.session_id} className="card active-session-card">
                <div className="session-active-header">
                  <div className="session-active-info">
                    <span className="session-active-title">{s.course_code} &middot; {s.class_name}</span>
                    <span className="session-active-chip">Week {s.week_number}</span>
                    <span className="session-active-chip">Ends {new Date(s.expires_at).toLocaleTimeString()}</span>
                    {s.pin_spinning === false && <span className="session-active-chip chip-static">Static PIN</span>}
                  </div>
                  <div className="session-active-actions">
                    <button className="btn-secondary" onClick={() => setManualSessionId(s.session_id)}>Manual</button>
                    <button className="btn-danger" onClick={() => deactivateSession(s.session_id)}>End</button>
                  </div>
                </div>
                <div className="session-active-body-stacked">
                  <div className="session-active-pin-top">
                    <RollingPinDisplay sessionId={s.session_id} pinSpinning={s.pin_spinning !== false} />
                  </div>
                  <div className="session-active-live-bottom">
                    <LiveTracker sessionId={s.session_id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header">
          <h3>Past Sessions</h3>
        </div>
        <div className="card-body">
          <div className="table-container">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Class</th>
                  <th>Week</th>
                  <th>Status</th>
                  <th>Marked</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 && (
                  <tr><td colSpan={6}>
                    <div className="entity-empty" style={{ padding: '2rem 1rem' }}>
                      <div className="entity-empty-icon">
                        <CalendarBlank weight="duotone" size={40} />
                      </div>
                      <div className="entity-empty-title">No sessions yet</div>
                      <div className="entity-empty-desc">Your past sessions will appear here.</div>
                    </div>
                  </td></tr>
                )}
                {filteredSessions.map((s) => (
                  <tr key={s.session_id}>
                    <td>{s.course_code}</td>
                    <td>{s.class_name}</td>
                    <td>Week {s.week_number}</td>
                    <td>
                      <span className={`badge ${s.is_active ? 'badge-success' : ''}`}>
                        {s.is_active ? 'Active' : 'Closed'}
                      </span>
                    </td>
                    <td>{s.attendance_count}</td>
                    <td>{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={sessionPage} totalPages={totalPages} onPageChange={handleSessionPageChange} />
        </div>
      </div>

      {manualSessionId && (
        <ManualOverrideModal
          sessionId={manualSessionId}
          onClose={() => setManualSessionId(null)}
          onSuccess={() => { setManualSessionId(null); loadData(); }}
        />
      )}

      {alertMsg && (
        <AlertModal type="warning" message={alertMsg} onClose={() => setAlertMsg('')} />
      )}
    </DashboardLayout>
  );
}
