import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import PageHeader from '../components/PageHeader';
import AttendanceMatrix from '../components/AttendanceMatrix';
import SummaryCards from '../components/SummaryCards';
import Select from '../components/Select';
import { Users, Calendar, Pulse, CheckCircle, Warning, DownloadSimple, BookOpen } from '@phosphor-icons/react';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';

export default function LecturerHistory() {
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filters, setFilters] = useState({ course_code: '', class_id: '' });
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadFilters = useCallback(async () => {
    try {
      const coursesRes = await api.get('/api/lecturer/courses');
      setCourses(coursesRes.data.courses);
    } catch {
      setError("Couldn't load filters.");
    }
  }, []);

  useEffect(() => { loadFilters(); }, [loadFilters]);

  // Fetch filtered classes when course changes
  useEffect(() => {
    if (!filters.course_code) {
      setClasses([]);
      return;
    }
    const fetchClasses = async () => {
      try {
        const res = await api.get(`/api/lecturer/courses/${filters.course_code}/classes`);
        setClasses(res.data);
      } catch {
        setClasses([]);
      }
    };
    fetchClasses();
  }, [filters.course_code]);

  useEffect(() => {
    if (!filters.course_code || !filters.class_id) return;
    const loadHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/api/lecturer/history', {
          params: { course_code: filters.course_code, class_id: filters.class_id },
        });
        setHistoryData(res.data);
      } catch {
        setError("Couldn't load history.");
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [filters.course_code, filters.class_id]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      if (name === 'course_code') {
        return { course_code: value, class_id: '' };
      }
      return { ...prev, [name]: value };
    });
  };

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!filters.course_code || !filters.class_id) return;
    setExporting(true);
    setError('');
    try {
      const res = await api.get(`/api/lecturer/history/export`, {
        params: { course_code: filters.course_code, class_id: filters.class_id },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_${filters.course_code}_${filters.class_id}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const totalStudents = historyData?.students?.length || 0;
  const totalWeeks = historyData?.weeks?.length || 0;
  const activeWeeks = historyData?.active_weeks?.length || 0;
  const avgPct = historyData?.students?.length
    ? Math.round(historyData.students.reduce((sum, s) => sum + (historyData.percentages[s.id] || 0), 0) / historyData.students.length)
    : 0;
  const atRiskCount = historyData?.at_risk
    ? Object.values(historyData.at_risk).filter(Boolean).length
    : 0;

  const summaryCards = [
    { value: totalStudents, label: 'Students', icon: <Users weight="duotone" size={24} /> },
    { value: totalWeeks, label: 'Weeks', icon: <Calendar weight="duotone" size={24} /> },
    { value: activeWeeks, label: 'Active', change: totalWeeks > 0 ? Math.round((activeWeeks / totalWeeks) * 100) : 0, icon: <Pulse weight="duotone" size={24} /> },
    { value: `${avgPct}%`, label: 'Avg %', icon: <CheckCircle weight="duotone" size={24} /> },
    ...(historyData?.min_attendance_pct ? [{ value: atRiskCount, label: 'At Risk', icon: <Warning weight="duotone" size={24} /> }] : []),
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Lecturer History"
        description="Review past class sessions and student attendance records."
      />

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {error && (
        <div style={{
          background: 'var(--error-bg, #fef2f2)',
          color: 'var(--error, #dc2626)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md, 8px)',
          fontSize: '0.8125rem',
          fontWeight: 500,
          marginBottom: '1rem',
          border: '1px solid var(--error)',
        }}>
          {error}
        </div>
      )}

      <div style={{ maxWidth: '100%' }}>
        {/* Filter Card */}
        <div style={{
          background: 'var(--bg-card, #fff)',
          borderRadius: 'var(--radius-lg, 8px)',
          boxShadow: 'none',
          border: '1px solid var(--border-light, #E5E7EB)',
          overflow: 'hidden',
          marginBottom: '1.25rem',
        }}>
          <div style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #E5E7EB)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary, #1A1A1A)' }}>History</h3>
            <button
              onClick={handleExport}
              disabled={!filters.course_code || !filters.class_id || exporting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 1rem',
                background: (!filters.course_code || !filters.class_id) ? 'var(--border)' : BRAND,
                color: (!filters.course_code || !filters.class_id) ? 'var(--text-muted)' : 'var(--text-inverse)',
                border: 'none',
                borderRadius: 'var(--radius-full, 6px)',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: (!filters.course_code || !filters.class_id || exporting) ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.7 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <DownloadSimple weight="duotone" size={16} />
              {exporting ? <><Spinner size={14} /> Exporting...</> : 'Export'}
            </button>
          </div>
          <div style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Course</label>
                <Select name="course_code" value={filters.course_code} onChange={handleFilterChange}>
                  <option value="">All Courses</option>
                  {courses.map((c) => (
                    <option key={c.course_code} value={c.course_code}>
                      {c.course_code} - {c.course_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Class / Cohort</label>
                <Select name="class_id" value={filters.class_id} onChange={handleFilterChange}>
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div style={{
            background: 'var(--bg-card, #fff)',
            borderRadius: 'var(--radius-lg, 8px)',
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--text-secondary, #6b7280)',
            boxShadow: 'none',
            border: '1px solid var(--border-light, #E5E7EB)',
          }}>
            Loading...
          </div>
        )}

        {historyData && !loading && (
          <div style={{
            background: 'var(--bg-card, #fff)',
            borderRadius: 'var(--radius-lg, 8px)',
            boxShadow: 'none',
            border: '1px solid var(--border-light, #E5E7EB)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: 0 }}>
              <AttendanceMatrix data={historyData} />
            </div>
          </div>
        )}

        {!filters.course_code && !loading && (
          <div style={{
            background: 'var(--bg-card, #fff)',
            borderRadius: 'var(--radius-lg, 8px)',
            boxShadow: 'none',
            border: '1px solid var(--border-light, #E5E7EB)',
            overflow: 'hidden',
          }}>
            <EmptyState
              icon={<BookOpen weight="duotone" size={64} />}
              title="Select a course and class"
              description="Choose a course and class from the filters above to view attendance history."
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const BRAND = 'var(--brand)';
