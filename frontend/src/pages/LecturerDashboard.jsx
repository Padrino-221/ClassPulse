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
import Spinner from '../components/Spinner';

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

  const barWidth = expiresIn > 0 ? ((expiresIn / 60000) * 100) : 0;
  const secondsLeft = Math.ceil(expiresIn / 1000);

  const pinLabel = loading
    ? 'Session PIN'
    : !pinSpinning
      ? 'Session PIN (static)'
      : 'Session PIN (rolling — refreshes every 60s)';

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2rem 1.5rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        color: '#fff',
      }}>
        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85, marginBottom: '0.75rem' }}>
          {pinLabel}
        </span>
        <span style={{ fontSize: '3rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em' }}>---</span>
      </div>
    );
  }

  if (!pinSpinning) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2rem 1.5rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        color: '#fff',
      }}>
        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85, marginBottom: '0.75rem' }}>
          {pinLabel}
        </span>
        <span style={{ fontSize: '3rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em' }}>{pin}</span>
      </div>
    );
  }

  const barColor = secondsLeft <= 10 ? '#ef4444' : secondsLeft <= 20 ? '#f59e0b' : '#667eea';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem 1.5rem',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '16px',
      color: '#fff',
    }}>
      <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85, marginBottom: '0.75rem' }}>
        {pinLabel}
      </span>
      <span style={{ fontSize: '3rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em' }}>
        {pin}
      </span>
      <div style={{ width: '100%', marginTop: '1rem' }}>
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${barWidth}%`,
              height: '100%',
              background: barColor,
              borderRadius: '3px',
              transition: 'width 1s linear',
            }}
          />
        </div>
        <span style={{ display: 'block', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem', color: barColor, fontWeight: 600 }}>
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

  const cardStyle = {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  };

  const cardHeaderStyle = {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #f3f4f6',
  };

  const cardBodyStyle = {
    padding: '1.5rem',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '0.4rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  const inputStyle = {
    width: '100%',
    padding: '0.6rem 0.85rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.9rem',
    color: '#111827',
    background: '#fff',
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  return (
    <DashboardLayout>
      {error && (
        <div style={{
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          fontSize: '0.9rem',
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {!hasActive ? (
        <>
          <SummaryCards cards={summaryCards} />
          <div style={{ ...cardStyle, marginTop: '1.25rem' }}>
            <div style={cardHeaderStyle}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>New Session</h3>
            </div>
            <div style={cardBodyStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', maxWidth: '600px' }}>
                <div>
                  <label style={labelStyle}>Course</label>
                  <Select name="course_code" value={form.course_code} onChange={handleChange}>
                    <option value="">Select Course</option>
                    {courses.map((c) => (
                      <option key={c.course_code} value={c.course_code}>
                        {c.course_code} - {c.course_name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <MultiSelect
                    label="Classes"
                    options={classes.map((c) => ({ value: c.class_id, label: c.class_name }))}
                    value={form.class_ids}
                    onChange={(val) => setForm((prev) => ({ ...prev, class_ids: val }))}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: '0 0 120px' }}>
                    <label style={labelStyle}>Week</label>
                    <input
                      type="number"
                      name="week_number"
                      min="1"
                      max="52"
                      value={form.week_number}
                      onChange={handleChange}
                      placeholder="e.g. 1"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Building</label>
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
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '0.25rem' }}>
                  <input
                    type="checkbox"
                    checked={form.pin_spinning}
                    onChange={(e) => setForm((prev) => ({ ...prev, pin_spinning: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: '#667eea' }}
                  />
                  <span style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>Rolling PIN</span>
                </label>
                <button
                  onClick={activateSession}
                  disabled={activating || !form.course_code || form.class_ids.length === 0 || !form.week_number || !form.building_id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.7rem 1.5rem',
                    background: activating || !form.course_code || form.class_ids.length === 0 || !form.week_number || !form.building_id ? '#93c5fd' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: activating || !form.course_code || form.class_ids.length === 0 || !form.week_number || !form.building_id ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                    marginTop: '0.5rem',
                    alignSelf: 'flex-start',
                  }}
                >
                  {activating ? <><Spinner size={14} /> Starting...</> : 'Start Session'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <SummaryCards cards={summaryCards} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
            {activeSessions.map((s) => (
              <div key={s.session_id} style={cardStyle}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid #f3f4f6',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827' }}>
                      {s.course_code} &middot; {s.class_name}
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.2rem 0.65rem',
                      background: '#eff6ff',
                      color: '#3b82f6',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      Week {s.week_number}
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.2rem 0.65rem',
                      background: '#f3f4f6',
                      color: '#6b7280',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      Ends {new Date(s.expires_at).toLocaleTimeString()}
                    </span>
                    {s.pin_spinning === false && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.2rem 0.65rem',
                        background: '#fef3c7',
                        color: '#92400e',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}>
                        Static PIN
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setManualSessionId(s.session_id)}
                      style={{
                        padding: '0.45rem 1rem',
                        background: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                    >
                      Manual
                    </button>
                    <button
                      onClick={() => deactivateSession(s.session_id)}
                      style={{
                        padding: '0.45rem 1rem',
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                    >
                      End
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '1.5rem' }}>
                    <RollingPinDisplay sessionId={s.session_id} pinSpinning={s.pin_spinning !== false} />
                  </div>
                  <div style={{ borderTop: '1px solid #f3f4f6' }}>
                    <LiveTracker sessionId={s.session_id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ ...cardStyle, marginTop: '1.25rem' }}>
        <div style={cardHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>Past Sessions</h3>
        </div>
        <div style={cardBodyStyle}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  {['Course', 'Class', 'Week', 'Status', 'Marked', 'Date'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '0.75rem 1rem',
                        borderBottom: '2px solid #e5e7eb',
                        color: '#6b7280',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', color: '#9ca3af' }}>
                        <CalendarBlank weight="duotone" size={40} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                        <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>No sessions yet</div>
                        <div style={{ fontSize: '0.85rem' }}>Your past sessions will appear here.</div>
                      </div>
                    </td>
                  </tr>
                )}
                {filteredSessions.map((s, idx) => (
                  <tr
                    key={s.session_id}
                    style={{
                      background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0f4ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafbfc'}
                  >
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6', color: '#111827', fontWeight: 500 }}>{s.course_code}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{s.class_name}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>Week {s.week_number}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: s.is_active ? '#dcfce7' : '#f3f4f6',
                        color: s.is_active ? '#166534' : '#6b7280',
                      }}>
                        {s.is_active ? 'Active' : 'Closed'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{s.attendance_count}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Pagination page={sessionPage} totalPages={totalPages} onPageChange={handleSessionPageChange} />
          </div>
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
