import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Pulse, CheckCircle, BookOpen, Users, CalendarBlank } from '@phosphor-icons/react';
import api from '../utils/api';
import { useSearch } from '../context/SearchContext';
import { useToast } from '../components/Toast';
import DashboardLayout from '../components/DashboardLayout';
import PageHeader from '../components/PageHeader';
import SummaryCards from '../components/SummaryCards';
import LiveTracker from '../components/LiveTracker';
import ManualOverrideModal from '../components/ManualOverrideModal';
import MultiSelect from '../components/MultiSelect';
import Select from '../components/Select';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
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
        background: 'linear-gradient(135deg, #B91C1C 0%, #DC2626 50%, #F87171 100%)',
        borderRadius: '8px',
        color: 'var(--bg-card)',
      }}>
        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85, marginBottom: '0.75rem' }}>
          {pinLabel}
        </span>
        <span style={{ fontSize: '3.5rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>---</span>
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
        background: 'linear-gradient(135deg, #B91C1C 0%, #DC2626 50%, #F87171 100%)',
        borderRadius: '8px',
        color: 'var(--bg-card)',
      }}>
        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85, marginBottom: '0.75rem' }}>
          {pinLabel}
        </span>
        <span style={{ fontSize: '3.5rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>{pin}</span>
      </div>
    );
  }

  const barColor = secondsLeft <= 10 ? '#EF4444' : secondsLeft <= 20 ? '#F59E0B' : '#F87171';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem 1.5rem',
      background: 'linear-gradient(135deg, #B91C1C 0%, #DC2626 50%, #F87171 100%)',
      borderRadius: '8px',
      color: 'var(--bg-card)',
    }}>
      <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85, marginBottom: '0.75rem' }}>
        {pinLabel}
      </span>
      <span style={{ fontSize: '3.5rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>
        {pin}
      </span>
      <div style={{ width: '100%', marginTop: '1.25rem' }}>
        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.25)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${barWidth}%`,
              height: '100%',
              background: barColor,
              borderRadius: '4px',
              transition: 'width 1s linear',
            }}
          />
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginTop: '0.75rem',
          padding: '0.375rem 0.75rem',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: '8px',
          width: 'fit-content',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          <span style={{ fontSize: '1rem', color: 'var(--bg-card)', fontWeight: 700 }}>
            {secondsLeft}s left
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LecturerLiveSession() {
  const { searchQuery } = useSearch();
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [lectureHalls, setLectureHalls] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [manualSessionId, setManualSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [sessionPage, setSessionPage] = useState(1);

  const [form, setForm] = useState({
    course_code: '',
    class_ids: [],
    week_number: '',
    lecture_hall_id: '',
    pin_spinning: true,
    duration_minutes: 120,
  });
  const [activating, setActivating] = useState(false);
  const toast = useToast();

  const [scheduleForm, setScheduleForm] = useState({
    course_code: '',
    class_ids: [],
    scheduled_date: '',
    duration_minutes: 120,
    week_number: '',
    lecture_hall_id: '',
  });
  const [scheduledSessions, setScheduledSessions] = useState([]);
  const [scheduling, setScheduling] = useState(false);

  const loadData = useCallback(async (page) => {
    try {
      const [coursesRes, classesRes, sessionsRes, lectureHallsRes, scheduledRes] = await Promise.all([
        api.get('/api/lecturer/courses'),
        api.get('/api/lecturer/classes'),
        api.get('/api/lecturer/sessions', { params: { limit: PAGE_SIZE, offset: ((page || 1) - 1) * PAGE_SIZE } }),
        api.get('/api/lecturer/lecture-halls'),
        api.get('/api/lecturer/scheduled'),
      ]);
      setCourses(coursesRes.data.courses);
      setClasses(classesRes.data.classes);
      setSessions(sessionsRes.data.sessions);
      setTotal(sessionsRes.data.total || 0);
      setLectureHalls(lectureHallsRes.data.lecture_halls);
      setScheduledSessions(scheduledRes.data);

      const active = sessionsRes.data.sessions?.filter((s) => s.is_active) || [];
      setActiveSessions(active);
    } catch {
      toast.error("Couldn't load.");
    }
  }, []);

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  useEffect(() => {
    const poll = setInterval(() => loadData(sessionPage), 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') loadData(sessionPage); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadData, sessionPage]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const activateSession = async () => {
    if (!form.lecture_hall_id) {
      toast.error('Select a lecture hall.');
      return;
    }
    if (form.class_ids.length === 0) {
      toast.error('Select at least one class.');
      return;
    }
    setActivating(true);
    try {
      await api.post('/api/lecturer/activate', {
        course_code: form.course_code,
        class_ids: form.class_ids,
        week_number: parseInt(form.week_number),
        lecture_hall_id: parseInt(form.lecture_hall_id),
        pin_spinning: form.pin_spinning,
        duration_minutes: parseInt(form.duration_minutes),
      });
      setForm((prev) => ({ ...prev, class_ids: [] }));
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || "Couldn't start session.";
      if (err.response?.status === 409) {
        toast.error(msg);
      } else {
        toast.error(msg);
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
      toast.error("Couldn't end session.");
    }
  };

  const scheduleSession = async () => {
    if (!scheduleForm.lecture_hall_id) {
      toast.error('Select a lecture hall for scheduling.');
      return;
    }
    if (scheduleForm.class_ids.length === 0) {
      toast.error('Select at least one class for scheduling.');
      return;
    }
    if (!scheduleForm.scheduled_date) {
      toast.error('Select a date and time for the scheduled session.');
      return;
    }
    setScheduling(true);
    try {
      await api.post('/api/lecturer/schedule', {
        course_code: scheduleForm.course_code,
        class_ids: scheduleForm.class_ids,
        scheduled_date: scheduleForm.scheduled_date,
        duration_minutes: parseInt(scheduleForm.duration_minutes),
        week_number: parseInt(scheduleForm.week_number),
        lecture_hall_id: parseInt(scheduleForm.lecture_hall_id),
      });
      setScheduleForm({
        course_code: '', class_ids: [], scheduled_date: '',
        duration_minutes: 120, week_number: '', lecture_hall_id: '',
      });
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || "Couldn't schedule sessions.";
      if (err.response?.status === 409) {
        toast.error(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setScheduling(false);
    }
  };

  const cancelScheduled = async (sessionId) => {
    try {
      await api.delete(`/api/lecturer/scheduled/${sessionId}`);
      setScheduledSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    } catch {
      toast.error("Couldn't cancel scheduled session.");
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
    background: 'var(--bg-card, #fff)',
    borderRadius: 'var(--radius-lg, 8px)',
    boxShadow: 'none',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  };

  const cardHeaderStyle = {
    padding: '1.125rem 1.5rem',
    borderBottom: '1px solid var(--border-light, #F5F5F5)',
  };

  const cardBodyStyle = {
    padding: '1.5rem',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary, #6B7280)',
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  const inputStyle = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    border: '1px solid var(--border, #E5E7EB)',
    borderRadius: 'var(--radius-md, 8px)',
    fontSize: '0.875rem',
    color: 'var(--text-primary, #1A1A1A)',
    background: 'var(--bg-input, #fff)',
    outline: 'none',
    transition: 'border-color 0.15s',
    height: '42px',
  };

  const scheduleSection = (
    <div style={{ ...cardStyle }}>
      <div style={cardHeaderStyle}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Schedule Session</h3>
      </div>
      <div style={cardBodyStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', maxWidth: '600px' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Course</label>
              <Select name="course_code" value={scheduleForm.course_code} onChange={(e) => setScheduleForm((prev) => ({ ...prev, course_code: e.target.value, class_ids: [] }))}>
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c.course_code} value={c.course_code}>{c.course_code} - {c.course_name}</option>
                ))}
              </Select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Lecture Hall</label>
              <Select name="lecture_hall_id" value={scheduleForm.lecture_hall_id} onChange={(e) => setScheduleForm((prev) => ({ ...prev, lecture_hall_id: e.target.value }))}>
                <option value="">Select Hall</option>
                {lectureHalls.map((lh) => (
                  <option key={lh.id} value={lh.id}>{lh.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <MultiSelect
              label="Classes"
              options={classes.map((c) => ({ value: c.class_id, label: c.class_name }))}
              value={scheduleForm.class_ids}
              onChange={(val) => setScheduleForm((prev) => ({ ...prev, class_ids: val }))}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date & Time</label>
              <input type="datetime-local" name="scheduled_date" value={scheduleForm.scheduled_date} onChange={(e) => setScheduleForm((prev) => ({ ...prev, scheduled_date: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ flex: '0 0 140px' }}>
              <label style={labelStyle}>Duration (min)</label>
              <input type="number" name="duration_minutes" min="1" max="480" value={scheduleForm.duration_minutes} onChange={(e) => setScheduleForm((prev) => ({ ...prev, duration_minutes: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ flex: '0 0 100px' }}>
              <label style={labelStyle}>Week</label>
              <input type="number" name="week_number" min="1" max="52" value={scheduleForm.week_number} onChange={(e) => setScheduleForm((prev) => ({ ...prev, week_number: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <button
            onClick={scheduleSession}
            disabled={scheduling || !scheduleForm.course_code || scheduleForm.class_ids.length === 0 || !scheduleForm.scheduled_date || !scheduleForm.lecture_hall_id || !scheduleForm.week_number}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.625rem 1.5rem',
              background: scheduling || !scheduleForm.course_code || scheduleForm.class_ids.length === 0 || !scheduleForm.scheduled_date || !scheduleForm.lecture_hall_id || !scheduleForm.week_number ? '#FCA5A5' : 'var(--brand)',
              color: 'var(--bg-card)', border: 'none', borderRadius: 'var(--radius-full, 6px)',
              fontSize: '0.875rem', fontWeight: 600,
              cursor: scheduling || !scheduleForm.course_code || scheduleForm.class_ids.length === 0 || !scheduleForm.scheduled_date || !scheduleForm.lecture_hall_id || !scheduleForm.week_number ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', marginTop: '0.5rem', alignSelf: 'flex-start',
            }}
          >
            {scheduling ? <><Spinner size={14} /> Scheduling...</> : 'Schedule Session'}
          </button>
        </div>

        {scheduledSessions.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Upcoming Scheduled</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {scheduledSessions.map((s) => (
                <div key={s.session_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-hover)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{s.course_code} &middot; {s.class_name}</span>
                    <span style={{ padding: '0.15rem 0.6rem', background: 'var(--brand-light)', color: 'var(--brand)', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600 }}>Week {s.week_number}</span>
                    <span style={{ padding: '0.15rem 0.6rem', background: 'var(--bg-hover)', color: 'var(--text-secondary)', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600 }}>{s.lecture_hall_name}</span>
                    {s.pin && <span style={{ padding: '0.15rem 0.6rem', background: 'var(--brand-light)', color: 'var(--brand)', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'monospace' }}>{s.pin}</span>}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(s.scheduled_at).toLocaleDateString()} at {new Date(s.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <button
                    onClick={() => cancelScheduled(s.session_id)}
                    style={{ padding: '0.4rem 0.8rem', background: 'var(--brand-light)', color: 'var(--brand)', border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Live Session"
        description={hasActive ? 'Live session in progress — students can check in with the displayed PIN.' : 'Start a session to begin tracking attendance.'}
      />

      {!hasActive ? (
        <>
          <SummaryCards cards={summaryCards} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
            <div style={{ ...cardStyle, margin: 0 }}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>New Session</h3>
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
                      <label style={labelStyle}>Lecture Hall</label>
                      <Select name="lecture_hall_id" value={form.lecture_hall_id} onChange={handleChange}>
                        <option value="">Select Lecture Hall</option>
                        {lectureHalls.map((lh) => (
                          <option key={lh.id} value={lh.id}>
                            {lh.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div style={{ flex: '0 0 140px' }}>
                      <label style={labelStyle}>Duration (min)</label>
                      <input
                        type="number"
                        name="duration_minutes"
                        min="1"
                        max="480"
                        value={form.duration_minutes}
                        onChange={handleChange}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '0.25rem' }}>
                    <input
                      type="checkbox"
                      checked={form.pin_spinning}
                      onChange={(e) => setForm((prev) => ({ ...prev, pin_spinning: e.target.checked }))}
                      style={{ width: '18px', height: '18px', accentColor: '#667eea' }}
                    />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Rolling PIN</span>
                  </label>
                  <button
                    onClick={activateSession}
                    disabled={activating || !form.course_code || form.class_ids.length === 0 || !form.week_number || !form.lecture_hall_id || !form.duration_minutes}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.625rem 1.5rem',
                      background: activating || !form.course_code || form.class_ids.length === 0 || !form.week_number || !form.lecture_hall_id || !form.duration_minutes ? '#FCA5A5' : 'var(--brand)',
                      color: 'var(--bg-card)',
                      border: 'none',
                      borderRadius: 'var(--radius-full, 6px)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: activating || !form.course_code || form.class_ids.length === 0 || !form.week_number || !form.lecture_hall_id || !form.duration_minutes ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      marginTop: '0.5rem',
                      alignSelf: 'flex-start',
                    }}
                  >
                    {activating ? <><Spinner size={14} /> Starting...</> : 'Start Session'}
                  </button>
                </div>
              </div>
            </div>
            {scheduleSection}
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
                  borderBottom: '1px solid var(--border-light, #F5F5F5)',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary, #1A1A1A)' }}>
                      {s.course_code} &middot; {s.class_name}
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.25rem 0.75rem',
                      background: 'var(--brand-light, #FEF2F2)',
                      color: 'var(--brand, #DC2626)',
                      borderRadius: 'var(--radius-full, 6px)',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}>
                      Week {s.week_number}
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.25rem 0.75rem',
                      background: 'var(--bg-hover, #F5F5F5)',
                      color: 'var(--text-secondary, #6b7280)',
                      borderRadius: 'var(--radius-full, 6px)',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}>
                      Ends {new Date(s.expires_at).toLocaleTimeString()}
                    </span>
                    {s.pin_spinning === false && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.25rem 0.75rem',
                        background: 'var(--warning-bg, #fef3c7)',
                        color: 'var(--warning, #92400e)',
                        borderRadius: 'var(--radius-full, 6px)',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}>
                        Static PIN
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setManualSessionId(s.session_id)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'var(--bg-hover, #F5F5F5)',
                        color: 'var(--text-secondary, #6B7280)',
                        border: '1px solid var(--border, #E5E7EB)',
                        borderRadius: 'var(--radius-full, 6px)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      Manual
                    </button>
                    <button
                      onClick={() => deactivateSession(s.session_id)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'var(--error, #EF4444)',
                        color: 'var(--bg-card)',
                        border: 'none',
                        borderRadius: 'var(--radius-full, 6px)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
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
                  <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: '1rem' }}>
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
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Past Sessions</h3>
        </div>
        <div style={cardBodyStyle}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-bordered" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  {['Course', 'Class', 'Week', 'Status', 'Marked', 'Date'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '0.75rem 1rem',
                        borderBottom: '2px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
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
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <CalendarBlank weight="duotone" size={40} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>No sessions yet</div>
                        <div style={{ fontSize: '0.85rem' }}>Your past sessions will appear here.</div>
                      </div>
                    </td>
                  </tr>
                )}
                {filteredSessions.map((s, idx) => (
                  <tr
                    key={s.session_id}
                    style={{
                      background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--brand-light)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)'}
                  >
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 500 }}>{s.course_code}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{s.class_name}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Week {s.week_number}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: s.is_active ? 'var(--success-bg)' : 'var(--bg-hover)',
                        color: s.is_active ? 'var(--success)' : 'var(--text-secondary)',
                      }}>
                        {s.is_active ? 'Active' : 'Closed'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{s.attendance_count}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{new Date(s.created_at).toLocaleDateString()}</td>
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

    </DashboardLayout>
  );
}
