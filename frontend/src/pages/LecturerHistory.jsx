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
      <SummaryCards cards={summaryCards} />

      {error && <div className="message error">{error}</div>}

      <div className="workspace-grid single">
        <div className="card filters-card">
          <div className="card-header">
            <h3>History</h3>
            <button
              className="btn-primary"
              onClick={handleExport}
              disabled={!filters.course_code || !filters.class_id || exporting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <DownloadSimple weight="duotone" size={16} />
              {exporting ? <><Spinner size={14} /> Exporting...</> : 'Export'}
            </button>
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label>Course</label>
                <Select name="course_code" value={filters.course_code} onChange={handleFilterChange}>
                  <option value="">All Courses</option>
                  {courses.map((c) => (
                    <option key={c.course_code} value={c.course_code}>
                      {c.course_code} - {c.course_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="form-group">
                <label>Class / Cohort</label>
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

        {loading && <div className="loading-indicator">Loading...</div>}

        {filteredHistoryData && !loading && (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <AttendanceMatrix data={filteredHistoryData} />
            </div>
          </div>
        )}

        {!filters.course_code && !loading && (
          <div className="card">
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
