import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLineUp, CalendarBlank, Users, GraduationCap, Download } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import api from '../utils/api';
import Select from '../components/Select';
import { useToast } from '../components/Toast';

const BRAND = '#0730A3';
const BRAND_LIGHT = '#3B5FCC';
const SUCCESS = '#16A34A';
const WARNING = '#D97706';

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="report-stat-card">
      <div className="report-stat-icon">{icon}</div>
      <div className="report-stat-body">
        <div className="report-stat-value">{value}</div>
        <div className="report-stat-label">{label}</div>
        {sub && <div className="report-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function CourseBarChart({ data }) {
  if (data.length === 0) return null;
  return (
    <div className="report-chart-card">
      <h4>Attendance by Course</h4>
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
    <div className="report-chart-card">
      <h4>Attendance by Class</h4>
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
    <div className="report-chart-card">
      <h4>Weekly Attendance Trend</h4>
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
      .catch(() => toast.error('Export failed.'));
  };

  const overall = summary?.overall || {};
  const avgPct = overall.total_sessions > 0 && overall.total_students > 0
    ? Math.round((overall.total_checkins / (overall.total_students * overall.total_sessions)) * 1000) / 10
    : 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Reports</div>
        <div className="page-subtitle">Attendance summary across courses and classes.</div>
      </div>

      {/* Filters + Export */}
      <div className="report-filters">
        <div className="report-filter-group">
          <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
            <label>Course</label>
            <Select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
              <option value="">All Courses</option>
              {filters.courses.map((c) => (
                <option key={c.course_code} value={c.course_code}>{c.course_code} — {c.course_name}</option>
              ))}
            </Select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
            <label>Class</label>
            <Select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">All Classes</option>
              {filters.classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
              ))}
            </Select>
          </div>
        </div>
        <button className="btn-secondary report-export-btn" onClick={handleExport}>
          <Download weight="duotone" size={16} />
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="entity-empty" style={{ padding: '3rem 1rem' }}>
          <div className="entity-empty-title">Loading report data...</div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="report-stats-grid">
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
          <div className="report-charts-grid">
            <CourseBarChart data={summary?.courses || []} />
            <ClassBarChart data={summary?.classes || []} />
          </div>

          <WeeklyLineChart data={weekly} />

          {/* Per-Class Table */}
          <div className="card" style={{ marginTop: '1.25rem' }}>
            <div className="card-header">
              <h3>Per-Class Breakdown</h3>
            </div>
            <div className="card-body">
              <div className="table-container">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Students</th>
                      <th>Sessions</th>
                      <th>Check-ins</th>
                      <th>Avg Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.classes || []).length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <div className="entity-empty" style={{ padding: '2rem 1rem' }}>
                            <div className="entity-empty-title">No data available</div>
                            <div className="entity-empty-desc">Create sessions and record attendance to see reports.</div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {(summary?.classes || []).map((c) => (
                      <tr key={c.class_id}>
                        <td>{c.class_name}</td>
                        <td>{c.total_students}</td>
                        <td>{c.total_sessions}</td>
                        <td>{c.total_checkins}</td>
                        <td>
                          <span className={`badge ${c.avg_attendance_pct >= 70 ? 'badge-success' : c.avg_attendance_pct >= 50 ? 'badge-warning' : ''}`}
                            style={c.avg_attendance_pct < 50 ? { background: 'var(--error-bg)', color: 'var(--error)' } : {}}>
                            {c.avg_attendance_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
