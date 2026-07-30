import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLineUp, CalendarBlank, Users, GraduationCap, Download } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import api from '../utils/api';
import Select from '../components/Select';
import Spinner from '../components/Spinner';
import Pagination from '../components/Pagination';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';

const BRAND = '#DC2626';
const BRAND_LIGHT = '#FEF2F2';
const SUCCESS = '#16A34A';
const WARNING = '#F59E0B';
const PAGE_SIZE = 10;

function StatCard({ icon, label, value, sub }) {
  return (
    <div style={{
      background: 'var(--bg-card, #fff)',
      borderRadius: 'var(--radius-lg, 8px)',
      padding: '1.25rem 1.5rem',
      boxShadow: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      border: '1px solid var(--border-light, #E5E7EB)',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: 'var(--radius-lg, 8px)',
        background: 'var(--kpi-icon-bg, #eff6ff)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: BRAND,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary, #1A1A1A)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary, #6b7280)', fontWeight: 600, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #9ca3af)', marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  );
}

function CourseBarChart({ data }) {
  if (data.length === 0) return null;
  return (
    <div style={{
      background: 'var(--bg-card, #fff)',
      borderRadius: 'var(--radius-lg, 8px)',
      padding: '1.25rem 1.5rem',
      boxShadow: 'none',
      border: '1px solid var(--border-light, #E5E7EB)',
    }}>
      <h4 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary, #1A1A1A)' }}>Attendance by Course</h4>
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
      background: 'var(--bg-card, #fff)',
      borderRadius: 'var(--radius-lg, 8px)',
      padding: '1.25rem 1.5rem',
      boxShadow: 'none',
      border: '1px solid var(--border-light, #E5E7EB)',
    }}>
      <h4 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary, #1A1A1A)' }}>Attendance by Class</h4>
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
  const colors = [BRAND, SUCCESS, WARNING, '#F87171', '#EC4899', '#06B6D4'];

  return (
    <div style={{
      background: 'var(--bg-card, #fff)',
      borderRadius: 'var(--radius-lg, 8px)',
      padding: '1.25rem 1.5rem',
      boxShadow: 'none',
      border: '1px solid var(--border-light, #E5E7EB)',
    }}>
      <h4 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary, #1A1A1A)' }}>Weekly Attendance Trend</h4>
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
  const [filters, setFilters] = useState({ schools: [], departments: [], courses: [], classes: [], lecturers: [] });
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedLecturer, setSelectedLecturer] = useState('');
  const [summary, setSummary] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [classPage, setClassPage] = useState(1);

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
      if (selectedSchool) params.school_id = selectedSchool;
      if (selectedDepartment) params.department_id = selectedDepartment;
      if (selectedCourse) params.course_code = selectedCourse;
      if (selectedClass) params.class_id = selectedClass;
      if (selectedLecturer) params.lecturer_id = selectedLecturer;
      const res = await api.get('/api/reports/summary', { params });
      setSummary(res.data);
    } catch {
      toast.error('Failed to load report data.');
    }
  }, [selectedSchool, selectedDepartment, selectedCourse, selectedClass, selectedLecturer, toast]);

  const loadWeekly = useCallback(async () => {
    try {
      const params = {};
      if (selectedSchool) params.school_id = selectedSchool;
      if (selectedDepartment) params.department_id = selectedDepartment;
      if (selectedCourse) params.course_code = selectedCourse;
      if (selectedClass) params.class_id = selectedClass;
      if (selectedLecturer) params.lecturer_id = selectedLecturer;
      const res = await api.get('/api/reports/weekly', { params });
      setWeekly(res.data.weekly);
    } catch {
      // Non-critical — chart just won't render
    }
  }, [selectedSchool, selectedDepartment, selectedCourse, selectedClass, selectedLecturer]);

  useEffect(() => { loadFilters(); }, [loadFilters]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSummary(), loadWeekly()]).finally(() => setLoading(false));
  }, [loadSummary, loadWeekly]);

  // Cascading resets
  const handleSchoolChange = (val) => {
    setSelectedSchool(val);
    setSelectedDepartment('');
    setSelectedCourse('');
    setSelectedClass('');
    setSelectedLecturer('');
  };
  const handleDepartmentChange = (val) => {
    setSelectedDepartment(val);
    setSelectedCourse('');
    setSelectedClass('');
    setSelectedLecturer('');
  };

  // Filter dropdowns based on cascading selection
  const visibleDepartments = selectedSchool
    ? filters.departments.filter(d => d.school_id === selectedSchool)
    : filters.departments;
  const visibleCourses = selectedDepartment
    ? filters.courses.filter(c => c.department_id === parseInt(selectedDepartment))
    : selectedSchool
      ? filters.courses.filter(c => visibleDepartments.some(d => d.id === c.department_id))
      : filters.courses;
  const visibleClasses = selectedDepartment
    ? filters.classes.filter(c => c.department_id === parseInt(selectedDepartment))
    : selectedSchool
      ? filters.classes.filter(c => visibleDepartments.some(d => d.id === c.department_id))
      : filters.classes;
  const visibleLecturers = selectedDepartment
    ? filters.lecturers.filter(l => l.department_id === parseInt(selectedDepartment))
    : selectedSchool
      ? filters.lecturers.filter(l => visibleDepartments.some(d => d.id === l.department_id))
      : filters.lecturers;

  const handleExport = () => {
    setExporting(true);
    const params = new URLSearchParams();
    if (selectedSchool) params.set('school_id', selectedSchool);
    if (selectedDepartment) params.set('department_id', selectedDepartment);
    if (selectedCourse) params.set('course_code', selectedCourse);
    if (selectedClass) params.set('class_id', selectedClass);
    if (selectedLecturer) params.set('lecturer_id', selectedLecturer);
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
      <PageHeader
        title="Reports"
        description="Attendance summary across courses and classes."
      />

      {/* Filters + Export */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'var(--bg-card, #fff)',
        borderRadius: 'var(--radius-lg, 8px)',
        padding: '1rem 1.25rem',
        boxShadow: 'none',
        border: '1px solid var(--border-light, #E5E7EB)',
        marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1, alignItems: 'flex-end' }}>
          {filters.schools.length > 0 && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160, flex: 1 }}>
              <label>School</label>
              <Select value={selectedSchool} onChange={(e) => handleSchoolChange(e.target.value)}>
                <option value="">All Schools</option>
                {filters.schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          )}
          {visibleDepartments.length > 0 && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160, flex: 1 }}>
              <label>Department</label>
              <Select value={selectedDepartment} onChange={(e) => handleDepartmentChange(e.target.value)}>
                <option value="">All Departments</option>
                {visibleDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160, flex: 1 }}>
            <label>Course</label>
            <Select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
              <option value="">All Courses</option>
              {visibleCourses.map((c) => (
                <option key={c.course_code} value={c.course_code}>{c.course_code} — {c.course_name}</option>
              ))}
            </Select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160, flex: 1 }}>
            <label>Class</label>
            <Select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">All Classes</option>
              {visibleClasses.map((c) => (
                <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
              ))}
            </Select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160, flex: 1 }}>
            <label>Lecturer</label>
            <Select value={selectedLecturer} onChange={(e) => setSelectedLecturer(e.target.value)}>
              <option value="">All Lecturers</option>
              {visibleLecturers.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              height: '42px',
              padding: '0 1.25rem',
              background: '#fff',
              color: BRAND,
              border: `1px solid ${BRAND}`,
              borderRadius: 'var(--radius-full, 6px)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.7 : 1,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <Download weight="duotone" size={16} />
            {exporting ? <><Spinner size={14} /> Exporting...</> : 'Export CSV'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{
          background: 'var(--bg-card, #fff)',
          borderRadius: 'var(--radius-lg, 8px)',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-secondary, #6b7280)',
          boxShadow: 'none',
          border: '1px solid var(--border-light, #E5E7EB)',
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
            background: 'var(--bg-card, #fff)',
            borderRadius: 'var(--radius-lg, 8px)',
            boxShadow: 'none',
            border: '1px solid var(--border-light, #E5E7EB)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--border-light, #E5E7EB)',
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary, #1A1A1A)' }}>Per-Class Breakdown</h3>
            </div>
            <div style={{ padding: '0', overflowX: 'auto' }}>
              <table className="matrix-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg-global, #F5F5F5)', borderBottom: '1px solid var(--border-light, #E5E7EB)' }}>Class</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg-global, #F5F5F5)', borderBottom: '1px solid var(--border-light, #E5E7EB)' }}>Students</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg-global, #F5F5F5)', borderBottom: '1px solid var(--border-light, #E5E7EB)' }}>Sessions</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg-global, #F5F5F5)', borderBottom: '1px solid var(--border-light, #E5E7EB)' }}>Check-ins</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg-global, #F5F5F5)', borderBottom: '1px solid var(--border-light, #E5E7EB)' }}>Avg Attendance</th>
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
                  {(() => {
                    const classes = summary?.classes || [];
                    const totalPages = Math.ceil(classes.length / PAGE_SIZE);
                    const startIdx = (classPage - 1) * PAGE_SIZE;
                    const pageClasses = classes.slice(startIdx, startIdx + PAGE_SIZE);
                    return pageClasses.map((c) => (
                    <tr key={c.class_id} style={{ borderBottom: '1px solid var(--border-light, #E5E7EB)' }}>
                      <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-primary, #1A1A1A)', fontWeight: 600 }}>{c.class_name}</td>
                      <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary, #6B7280)' }}>{c.total_students}</td>
                      <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary, #6B7280)' }}>{c.total_sessions}</td>
                      <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary, #6B7280)' }}>{c.total_checkins}</td>
                      <td style={{ padding: '0.75rem 1.5rem' }}>
                        <span className={`badge ${c.avg_attendance_pct >= 70 ? 'badge-success' : c.avg_attendance_pct >= 50 ? 'badge-warning' : ''}`}
                          style={{
                            ...(c.avg_attendance_pct < 50 ? { background: 'var(--error-bg)', color: 'var(--error)' } : {}),
                            padding: '0.25rem 0.75rem',
                            borderRadius: 'var(--radius-full, 6px)',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                          }}>
                          {c.avg_attendance_pct}%
                        </span>
                      </td>
                    </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '1rem 1.5rem' }}>
              <Pagination
                page={classPage}
                totalPages={Math.ceil((summary?.classes || []).length / PAGE_SIZE)}
                onPageChange={setClassPage}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
