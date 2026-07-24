import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { useSearch } from '../context/SearchContext';
import DashboardLayout from '../components/DashboardLayout';
import AttendanceMatrix from '../components/AttendanceMatrix';
import SummaryCards from '../components/SummaryCards';
import Select from '../components/Select';
import { Users, Calendar, Pulse, CheckCircle, Warning, DownloadSimple, BookOpen } from '@phosphor-icons/react';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';

export default function LecturerHistory() {
  const { searchQuery } = useSearch();
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filters, setFilters] = useState({ course_code: '', class_id: '' });
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadFilters = useCallback(async () => {
    try {
      const [coursesRes, classesRes] = await Promise.all([
        api.get('/api/lecturer/courses'),
        api.get('/api/lecturer/classes'),
      ]);
      setCourses(coursesRes.data.courses);
      setClasses(classesRes.data.classes);
    } catch {
      setError("Couldn't load filters.");
    }
  }, []);

  useEffect(() => { loadFilters(); }, [loadFilters]);

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
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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

  const filteredHistoryData = useMemo(() => {
    if (!historyData || !searchQuery) return historyData;
    const q = searchQuery.toLowerCase();
    const filteredStudents = historyData.students.filter((s) =>
      [s.student_name, s.index_number].some((v) => v?.toLowerCase().includes(q))
    );
    const filteredMatrix = {};
    const filteredPercentages = {};
    const filteredAtRisk = {};
    for (const s of filteredStudents) {
      if (historyData.matrix[s.id]) filteredMatrix[s.id] = historyData.matrix[s.id];
      if (historyData.percentages[s.id] !== undefined) filteredPercentages[s.id] = historyData.percentages[s.id];
      if (historyData.at_risk?.[s.id] !== undefined) filteredAtRisk[s.id] = historyData.at_risk[s.id];
    }
    return {
      ...historyData,
      students: filteredStudents,
      matrix: filteredMatrix,
      percentages: filteredPercentages,
      at_risk: filteredAtRisk,
    };
  }, [historyData, searchQuery]);

  return (
    <DashboardLayout>
      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {error && (
        <div style={{
          background: '#fef2f2',
          color: '#dc2626',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontSize: '0.8125rem',
          fontWeight: 500,
          marginBottom: '1rem',
          border: '1px solid #fecaca',
        }}>
          {error}
        </div>
      )}

      <div style={{ maxWidth: '100%' }}>
        {/* Filter Card */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid #f0f0f0',
          overflow: 'hidden',
          marginBottom: '1.25rem',
        }}>
          <div style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1a1a2e' }}>History</h3>
            <button
              onClick={handleExport}
              disabled={!filters.course_code || !filters.class_id || exporting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 1rem',
                background: (!filters.course_code || !filters.class_id) ? '#e5e7eb' : BRAND,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
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
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>Course</label>
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
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>Class / Cohort</label>
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
            background: '#fff',
            borderRadius: '12px',
            padding: '3rem',
            textAlign: 'center',
            color: '#6b7280',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #f0f0f0',
          }}>
            Loading...
          </div>
        )}

        {filteredHistoryData && !loading && (
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #f0f0f0',
            overflow: 'hidden',
          }}>
            <div style={{ padding: 0 }}>
              <AttendanceMatrix data={filteredHistoryData} />
            </div>
          </div>
        )}

        {!filters.course_code && !loading && (
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #f0f0f0',
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

const BRAND = '#0730A3';
