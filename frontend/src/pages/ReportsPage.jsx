import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLineUp, CalendarBlank, Users, GraduationCap, Download } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import api from '../utils/api';
import Select from '../components/Select';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';

const BRAND = '#0730A3';
const BRAND_LIGHT = '#3B5FCC';
const SUCCESS = '#16A34A';
const WARNING = '#D97706';

function StatCard({ icon, label, value, sub }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      border: '1px solid #f0f0f0',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        background: '#eff6ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: BRAND,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500, marginTop: '2px' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  );
}

function CourseBarChart({ data }) {
  if (data.length === 0) return null;
  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid #f0f0f0',
    }}>
      <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: '#1a1a2e' }}>Attendance by Course</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="course_code" width={80} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => [`${v}%`, 'Avg Attendance']} />
          <Bar dataKey="avg_attendance_pct" fill={BRAND} radius={[0, 4, 4, 0]} barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClassBarChart({ data }) {
  if (data.length === 0) return null;
  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid #f0f0f0',
    }}>
      <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: '#1a1a2e' }}>Attendance by Class</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="class_name" width={140} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => [`${v}%`, 'Avg Attendance']} />
          <Bar dataKey="avg_attendance_pct" fill={SUCCESS} radius={[0, 4, 4, 0]} barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function WeeklyLineChart({ data }) {
  if (data.length === 0) return null;

  // Group by class
  const classMap = {};
  data.forEach((d) => {
    const key = d.class_name;
    if (!classMap[key]) classMap[key] = [];
    classMap[key].push(d);
  });
  const classNames = Object.keys(classMap);
  const colors = [BRAND, SUCCESS, WARNING, '#8B5CF6', '#EC4899', '#06B6D4'];

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid #f0f0f0',
    }}>
      <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: '#1a1a2e' }}>Weekly Attendance Trend</h4>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis dataKey="week_number" tickFormatter={(v) => `W${v}`} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(v) => [`${v}%`, 'Attendance']} labelFormatter={(v) => `Week ${v}`} />
          <Legend />
          {classNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey="attendance_pct"
              data={classMap[name]}
              name={name}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ReportsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ courses: [], classes: [] });
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [summary, setSummary] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [exporting, setExporting] = useState(false);

  const loadFilters = useCallback(async () => {
    try {
      const res = await api.get('/api/reports/filters');
      setFilters(res.data);
    } catch {
      toast.error('Failed to load filters.');
    }
  }, [toast]);

  const loadSummary = useCallback(async () => {
    try {
      const params = {};
      if (selectedCourse) params.course_code = selectedCourse;
      if (selectedClass) params.class_id = selectedClass;
      const res = await api.get('/api/reports/summary', { params });
      setSummary(res.data);
    } catch {
      toast.error('Failed to load report data.');
    }
  }, [selectedCourse, selectedClass, toast]);

  const loadWeekly = useCallback(async () => {
    try {
      const params = {};
      if (selectedCourse) params.course_code = selectedCourse;
      if (selectedClass) params.class_id = selectedClass;
      const res = await api.get('/api/reports/weekly', { params });
      setWeekly(res.data.weekly);
    } catch {
      // Non-critical — chart just won't render
    }
  }, [selectedCourse, selectedClass]);

  useEffect(() => { loadFilters(); }, [loadFilters]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSummary(), loadWeekly()]).finally(() => setLoading(false));
  }, [loadSummary, loadWeekly]);

  const handleExport = () => {
    setExporting(true);
    const params = new URLSearchParams();
    if (selectedCourse) params.set('course_code', selectedCourse);
    if (selectedClass) params.set('class_id', selectedClass);
    const token = localStorage.getItem('token');
    const url = `${api.defaults.baseURL}/api/reports/export?${params.toString()}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'attendance_report.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success('Report downloaded.');
      })
      .catch(() => toast.error('Export failed.'))
      .finally(() => setExporting(false));
  };

  const overall = summary?.overall || {};
  const avgPct = overall.total_sessions > 0 && overall.total_students > 0
    ? Math.round((overall.total_checkins / (overall.total_students * overall.total_sessions)) * 1000) / 10
    : 0;

  return (
    <div style={{ padding: '0', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.25rem' }}>Reports</div>
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Attendance summary across courses and classes.</div>
      </div>

      {/* Filters + Export */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: '#fff',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #f0f0f0',
        marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 180, flex: 1 }}>
            <label>Course</label>
            <Select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
              <option value="">All Courses</option>
              {filters.courses.map((c) => (
                <option key={c.course_code} value={c.course_code}>{c.course_code} — {c.course_name}</option>
              ))}
            </Select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 180, flex: 1 }}>
            <label>Class</label>
            <Select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">All Classes</option>
              {filters.classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
              ))}
            </Select>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: '#fff',
            color: BRAND,
            border: `1px solid ${BRAND}`,
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.8125rem',
            cursor: exporting ? 'not-allowed' : 'pointer',
            opacity: exporting ? 0.7 : 1,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <Download weight="duotone" size={16} />
          {exporting ? <><Spinner size={14} /> Exporting...</> : 'Export CSV'}
        </button>
      </div>

      {loading ? (
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
          color: '#6b7280',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid #f0f0f0',
        }}>
          Loading report data...
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}>
            <StatCard
              icon={<CalendarBlank weight="duotone" size={22} />}
              label="Total Sessions"
              value={overall.total_sessions || 0}
            />
            <StatCard
              icon={<GraduationCap weight="duotone" size={22} />}
              label="Total Students"
              value={overall.total_students || 0}
            />
            <StatCard
              icon={<ArrowLineUp weight="duotone" size={22} />}
              label="Total Check-ins"
              value={overall.total_checkins || 0}
            />
            <StatCard
              icon={<Users weight="duotone" size={22} />}
              label="Avg Attendance"
              value={`${avgPct}%`}
              sub="across all sessions"
            />
          </div>

          {/* Charts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1.25rem',
            marginBottom: '1.25rem',
          }}>
            <CourseBarChart data={summary?.courses || []} />
            <ClassBarChart data={summary?.classes || []} />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <WeeklyLineChart data={weekly} />
          </div>

          {/* Per-Class Table */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #f0f0f0',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #f0f0f0',
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1a1a2e' }}>Per-Class Breakdown</h3>
            </div>
            <div style={{ padding: '0', overflowX: 'auto' }}>
              <table className="matrix-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>Class</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>Students</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>Sessions</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>Check-ins</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>Avg Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.classes || []).length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#6b7280' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>No data available</div>
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>Create sessions and record attendance to see reports.</div>
                      </td>
                    </tr>
                  )}
                  {(summary?.classes || []).map((c) => (
                    <tr key={c.class_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', color: '#1a1a2e', fontWeight: 500 }}>{c.class_name}</td>
                      <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', color: '#374151' }}>{c.total_students}</td>
                      <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', color: '#374151' }}>{c.total_sessions}</td>
                      <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', color: '#374151' }}>{c.total_checkins}</td>
                      <td style={{ padding: '0.75rem 1.5rem' }}>
                        <span className={`badge ${c.avg_attendance_pct >= 70 ? 'badge-success' : c.avg_attendance_pct >= 50 ? 'badge-warning' : ''}`}
                          style={{
                            ...(c.avg_attendance_pct < 50 ? { background: 'var(--error-bg)', color: 'var(--error)' } : {}),
                            padding: '0.25rem 0.625rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}>
                          {c.avg_attendance_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
