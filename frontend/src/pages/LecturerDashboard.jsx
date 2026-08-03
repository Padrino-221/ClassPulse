import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pulse, BookOpen, Users, CheckCircle, CalendarBlank, ArrowRight, Clock, MapPin } from '@phosphor-icons/react';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import PageHeader from '../components/PageHeader';
import SummaryCards from '../components/SummaryCards';

const RECENT_LIMIT = 5;

export default function LecturerDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [coursesRes, classesRes] = await Promise.all([
        api.get('/api/lecturer/courses'),
        api.get('/api/lecturer/classes'),
      ]);
      const courses = coursesRes.data.courses || [];
      const classes = classesRes.data.classes || [];

      let sessions = [];
      let scheduled = [];
      try {
        const [sessionsRes, scheduledRes] = await Promise.all([
          api.get('/api/lecturer/sessions', { params: { limit: 100, offset: 0 } }),
          api.get('/api/lecturer/scheduled'),
        ]);
        sessions = sessionsRes.data.sessions || [];
        scheduled = scheduledRes.data || [];
      } catch {
        // sessions/scheduled may fail on production; courses/classes still load
      }

      const active = sessions.filter((s) => s.is_active && (!s.expires_at || new Date(s.expires_at) > new Date()));
      const todayTotal = sessions.reduce((sum, s) => sum + parseInt(s.attendance_count || 0), 0);
      const recent = [...sessions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, RECENT_LIMIT);
      setData({
        courses,
        classes,
        sessions,
        scheduled,
        active,
        todayTotal,
        recent,
        totalCourses: courses.length,
        totalClasses: classes.length,
        totalSessions: sessions.length,
      });
    } catch {
      setError("Couldn't load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        value: data.active.length,
        label: 'Active Sessions',
        change: null,
        icon: <Pulse weight="duotone" size={24} />,
      },
      {
        value: data.todayTotal,
        label: "Today's Attendance",
        change: null,
        icon: <CheckCircle weight="duotone" size={24} />,
      },
      {
        value: data.totalCourses,
        label: 'Courses',
        change: null,
        icon: <BookOpen weight="duotone" size={24} />,
      },
      {
        value: data.totalClasses,
        label: 'Classes',
        change: null,
        icon: <Users weight="duotone" size={24} />,
      },
    ];
  }, [data]);

  const cardStyle = {
    background: 'var(--bg-card, #fff)',
    borderRadius: 'var(--radius-lg, 8px)',
    border: '1px solid var(--border-light, #e5e7eb)',
    overflow: 'hidden',
  };

  const cardHeaderStyle = {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--border-light, #F5F5F5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const cardBodyStyle = {
    padding: '1.5rem',
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageHeader title="Dashboard" description="Overview of your teaching activity." />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-muted)' }}>Loading...</div>
      </DashboardLayout>
    );
  }

  const firstActive = data?.active?.[0];

  return (
    <DashboardLayout>
      {error && (
        <div style={{
          background: 'var(--brand-light)', color: 'var(--brand-dark)', border: '1px solid var(--brand)',
          borderRadius: '6px', padding: '0.85rem 1.25rem', marginBottom: '1.25rem',
          fontSize: '0.9rem', fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      <PageHeader title="Dashboard" description="Overview of your teaching activity." />

      <SummaryCards cards={summaryCards} />

      {/* Active Session Banner */}
      {firstActive && (
        <div style={{ ...cardStyle, marginTop: '1.25rem' }}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '6px',
                background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Pulse weight="duotone" size={18} color="var(--brand)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Active Session — {firstActive.course_code} &middot; {firstActive.class_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                  Week {firstActive.week_number} &middot; Ends {new Date(firstActive.expires_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/lecturer/live-session')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.5rem 1rem', background: 'var(--brand)', color: 'var(--text-inverse)',
                border: 'none', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              Go to Live Session <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
        {/* Recent Sessions */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Sessions</h3>
            <button
              onClick={() => navigate('/lecturer/live-session')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                border: 'none', background: 'none', color: 'var(--brand)', fontSize: '0.75rem',
                fontWeight: 600, cursor: 'pointer', padding: 0,
              }}
            >
              View All <ArrowRight size={12} />
            </button>
          </div>
          <div style={cardBodyStyle}>
            {data?.recent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No sessions yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {data?.recent.map((s) => (
                  <div
                    key={s.session_id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.625rem 0', borderBottom: '1px solid var(--border-light, #F5F5F5)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <Clock size={16} color="var(--text-muted, #9CA3AF)" weight="duotone" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                          {s.course_code} &middot; {s.class_name}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          Week {s.week_number} &middot; {new Date(s.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.6875rem',
                      fontWeight: 600, background: s.is_active ? 'var(--success-bg)' : 'var(--bg-hover)',
                      color: s.is_active ? 'var(--success)' : 'var(--text-secondary)',
                    }}>
                      {s.is_active ? 'Active' : 'Closed'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Scheduled */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Upcoming Scheduled</h3>
            <button
              onClick={() => navigate('/lecturer/live-session')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                border: 'none', background: 'none', color: 'var(--brand)', fontSize: '0.75rem',
                fontWeight: 600, cursor: 'pointer', padding: 0,
              }}
            >
              Manage <ArrowRight size={12} />
            </button>
          </div>
          <div style={cardBodyStyle}>
            {data?.scheduled.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No upcoming scheduled sessions.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {data?.scheduled.map((s) => (
                  <div
                    key={s.session_id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.625rem 0', borderBottom: '1px solid var(--border-light, #F5F5F5)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <CalendarBlank size={16} color="var(--text-muted, #9CA3AF)" weight="duotone" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                          {s.course_code} &middot; {s.class_name}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          Week {s.week_number} &middot; {s.lecture_hall_name}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      {new Date(s.scheduled_at).toLocaleDateString()} at {new Date(s.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ ...cardStyle, marginTop: '1.25rem' }}>
        <div style={cardHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Quick Actions</h3>
        </div>
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/lecturer/live-session')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.625rem 1.25rem', background: 'var(--brand)', color: 'var(--text-inverse)',
              border: 'none', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <Pulse size={16} weight="duotone" /> Start New Session
          </button>
          <button
            onClick={() => navigate('/lecturer/history')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.625rem 1.25rem', background: 'var(--bg-hover)', color: 'var(--text-primary)',
              border: '1px solid var(--border, #E5E7EB)', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <Clock size={16} weight="duotone" /> View History
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
