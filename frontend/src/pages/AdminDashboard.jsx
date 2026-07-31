import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import api, { getStoredUser } from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import Select from '../components/Select';
import MultiSelect from '../components/MultiSelect';
import Pagination from '../components/Pagination';
import { useToast } from '../components/Toast';
import {
  BookOpen, Users, UserCheck, GraduationCap, MapPin, Plus, PencilSimple, Trash,
  DownloadSimple, Warning, CalendarBlank, Buildings, TreeEvergreen, Clock, ShieldCheck,
  Eye, EyeSlash, ChartLineUp,
} from '@phosphor-icons/react';
import ReportsPage from './ReportsPage';
import PageHeader from '../components/PageHeader';
import CreateModal from '../components/CreateModal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';

const PAGE_SIZE = 20;

const tileIcons = {
  courses: <BookOpen weight="duotone" size={22} />,
  lecturers: <UserCheck weight="duotone" size={22} />,
  classes: <Users weight="duotone" size={22} />,
  students: <GraduationCap weight="duotone" size={22} />,
  lecture_halls: <MapPin weight="duotone" size={22} />,
};

function EditModal({ entityLabel, fields, data, onSave, onClose }) {
  const [form, setForm] = useState(() => fields.reduce((acc, f) => {
    if (f.type === 'multiselect') {
      const raw = data?.[f.name];
      return { ...acc, [f.name]: Array.isArray(raw) ? raw : [] };
    }
    return { ...acc, [f.name]: data?.[f.name] ?? '' };
  }, {}));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});
  const toast = useToast();

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      toast.success(`${entityLabel} updated`);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || "Couldn't save.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card, #fff)', borderRadius: 'var(--radius-xl, 8px)', boxShadow: 'none',
          width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto',
          padding: '2rem', margin: '1rem', border: '1px solid var(--border-light, #E5E7EB)',
        }}
      >
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #1A1A1A)', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
          Edit {entityLabel}
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #6b7280)', marginBottom: '1.25rem' }}>
          Update the record details below.
        </div>
        {error && (
          <div style={{
            backgroundColor: 'var(--brand-light)', color: 'var(--brand)', padding: '0.75rem 1rem',
            borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid #FCA5A5',
          }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {fields.map((f) => (
            <div key={f.name} style={{ marginBottom: '1rem' }}>
              {f.type === 'multiselect' ? (
                <MultiSelect
                  label={f.label}
                  options={f.options || []}
                  value={Array.isArray(form[f.name]) ? form[f.name] : []}
                  onChange={(vals) => setForm((prev) => ({ ...prev, [f.name]: vals }))}
                />
              ) : (
                <>
                  <label style={{
                    display: 'block', fontSize: '0.8rem', fontWeight: 600,
                    color: 'var(--text-secondary)', marginBottom: '0.375rem',
                  }}>
                    {f.label}
                  </label>
                  {f.type === 'select' ? (
                    <Select name={f.name} value={form[f.name]} onChange={handleChange}>
                      <option value="">Select {f.label}</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  ) : (
                    f.type === 'password' ? (
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPasswords[f.name] ? 'text' : 'password'}
                          name={f.name}
                          value={form[f.name]}
                          onChange={handleChange}
                          required
                          style={{
                            width: '100%', padding: '0.625rem 0.875rem', paddingRight: '2.5rem', fontSize: '0.875rem',
                            border: '1px solid var(--border, #e5e7eb)', borderRadius: 'var(--radius-md, 8px)', outline: 'none',
                            backgroundColor: 'var(--bg-input, #F5F5F5)', transition: 'all 0.2s', height: '42px', boxSizing: 'border-box',
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = 'var(--brand, #DC2626)';
                            e.target.style.backgroundColor = 'var(--bg-card, #fff)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'var(--border, #e5e7eb)';
                            e.target.style.backgroundColor = 'var(--bg-input, #F5F5F5)';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords((p) => ({ ...p, [f.name]: !p[f.name] }))}
                          style={{
                            position: 'absolute', right: '0.625rem', top: '50%',
                            transform: 'translateY(-50%)', background: 'none', border: 'none',
                            cursor: 'pointer', color: 'var(--text-muted)', padding: '2px',
                            display: 'flex', alignItems: 'center',
                          }}
                        >
                          {showPasswords[f.name] ? <EyeSlash size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    ) : (
                      <input
                        type={f.type || 'text'}
                        name={f.name}
                        value={form[f.name]}
                        onChange={handleChange}
                        min={f.min}
                        max={f.max}
                        required
                        style={{
                          width: '100%', padding: '0.625rem 0.875rem', fontSize: '0.875rem',
                          border: '1px solid var(--border, #e5e7eb)', borderRadius: 'var(--radius-md, 8px)', outline: 'none',
                          backgroundColor: 'var(--bg-input, #F5F5F5)', transition: 'all 0.2s', height: '42px',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--brand, #DC2626)';
                          e.target.style.backgroundColor = 'var(--bg-card, #fff)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--border, #e5e7eb)';
                          e.target.style.backgroundColor = 'var(--bg-input, #F5F5F5)';
                        }}
                      />
                    )
                  )}
                </>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light, #F5F5F5)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.625rem 1.25rem', fontSize: '0.8125rem', fontWeight: 600,
                color: 'var(--text-secondary, #6b7280)', backgroundColor: 'var(--bg-hover, #F5F5F5)', border: 'none',
                borderRadius: 'var(--radius-full, 6px)', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--border, #e5e7eb)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--bg-hover, #F5F5F5)'}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.625rem 1.5rem', fontSize: '0.8125rem', fontWeight: 600,
                color: 'var(--text-inverse)', backgroundColor: 'var(--brand, #DC2626)', border: 'none',
                borderRadius: 'var(--radius-full, 6px)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s',
                opacity: saving ? 0.7 : 1,
              }}
              onMouseEnter={(e) => !saving && (e.target.style.backgroundColor = 'var(--brand-dark, #DC2626)')}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--brand, #DC2626)'}
            >
              {saving ? <><Spinner size={14} /> Saving...</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}





function LectureHallsPage() {
  const [lectureHalls, setLectureHalls] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const res = await api.get('/api/lecture-halls');
    setLectureHalls(res.data.lecture_halls);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (form) => {
    await api.post('/api/lecture-halls', {
      name: form.name,
      latitude: form.latitude,
      longitude: form.longitude,
      radius: form.radius,
    });
    toast.success('Lecture Hall created');
    await load();
  };

  const saveEdit = async (form) => {
    await api.put(`/api/lecture-halls/${editing.id}`, {
      name: form.name,
      latitude: form.latitude,
      longitude: form.longitude,
      radius: form.radius,
    });
    await load();
  };

  const remove = async (id) => {
    await api.delete(`/api/lecture-halls/${id}`);
    toast.success('Lecture Hall deleted');
    await load();
  };

  return (
    <div>
      <PageHeader
        title="Lecture Halls"
        description="Register lecture halls with geo-coordinates for proximity-based check-in."
        action={() => setShowCreate(true)}
        actionLabel="New Hall"
        actionIcon={Plus}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {lectureHalls.map((h) => (
          <div key={h.id} style={{
            background: 'var(--bg-card, #fff)', borderRadius: '8px',
            border: '1px solid var(--border-light, #e5e7eb)', padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '6px',
                background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <MapPin weight="duotone" size={20} color="var(--brand)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary, #1A1A1A)' }}>{h.name}</div>
                <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 600, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                    {Number(h.latitude).toFixed(4)}, {Number(h.longitude).toFixed(4)}
                  </span>
                  <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700, background: 'var(--brand-light)', color: '#DC2626' }}>
                    {h.radius}m radius
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                <button onClick={() => setEditing(h)} style={{
                  width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-light, #e5e7eb)',
                  background: 'var(--bg-card, #fff)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted, #6b7280)', transition: 'all 0.15s',
                }}>
                  <PencilSimple size={14} />
                </button>
                <button onClick={() => setDeleting(h)} style={{
                  width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FCA5A5',
                  background: 'var(--brand-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--brand)', transition: 'all 0.15s',
                }}>
                  <Trash size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {lectureHalls.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #9ca3af)', fontSize: '0.875rem', gridColumn: '1 / -1' }}>
            No lecture halls yet.
          </div>
        )}
      </div>
      {showCreate && (
        <CreateModal
          entityLabel="Lecture Hall"
          fields={[
            { name: 'name', label: 'Name', placeholder: 'e.g. Main Lecture Hall' },
            { name: 'latitude', label: 'Latitude', type: 'number', placeholder: 'e.g. 5.650000' },
            { name: 'longitude', label: 'Longitude', type: 'number', placeholder: 'e.g. -0.186000' },
            { name: 'radius', label: 'Radius (m)', type: 'number', min: 10, max: 5000, step: 1 },
          ]}
          onSave={add}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editing && (
        <EditModal
          entityLabel="Lecture Hall"
          fields={[
            { name: 'name', label: 'Name' },
            { name: 'latitude', label: 'Latitude', type: 'number' },
            { name: 'longitude', label: 'Longitude', type: 'number' },
            { name: 'radius', label: 'Radius (m)', type: 'number', min: 10, max: 5000, step: 1 },
          ]}
          data={editing}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete Lecture Hall"
          message={`Are you sure you want to delete "${deleting.name}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => { await remove(deleting.id); setDeleting(null); }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function ScopeFilter({ user, schools, departments, filterSchool, setFilterSchool, filterDepartment, setFilterDepartment, setPage, extraReset }) {
  const isUniversity = user?.admin_level === 'university';
  const isSchoolAdmin = user?.admin_level === 'school';
  if (!isUniversity && !isSchoolAdmin) return null;

  const filteredDepts = filterSchool
    ? departments.filter(d => String(d.school_id) === String(filterSchool))
    : departments;

  const handleSchoolChange = (val) => {
    setFilterSchool(val);
    setFilterDepartment('');
    if (extraReset) extraReset();
    setPage(1);
  };

  const handleDeptChange = (val) => {
    setFilterDepartment(val);
    if (extraReset) extraReset();
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'flex-end' }}>
      {isUniversity && (
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>School</label>
          <Select value={filterSchool} onChange={(e) => handleSchoolChange(e.target.value)}>
            <option value="">All Schools</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      )}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Department</label>
        <Select value={filterDepartment} onChange={(e) => handleDeptChange(e.target.value)}>
          <option value="">All Departments</option>
          {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </div>
    </div>
  );
}

function AdminOverviewPage({ courses, lecturers, classes, students, lectureHalls }) {
  const user = useMemo(() => {
    try { return getStoredUser(); } catch { return null; }
  }, []);
  const isUniversity = user?.admin_level === 'university';
  const isSchoolAdmin = user?.admin_level === 'school';

  const [uniStats, setUniStats] = useState(null);
  const [schoolStats, setSchoolStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    if (isUniversity) {
      api.get('/api/admin/university-stats').then((r) => setUniStats(r.data)).catch(() => {});
    }
    if (isSchoolAdmin) {
      api.get('/api/admin/school-stats').then((r) => setSchoolStats(r.data)).catch(() => {});
      api.get('/api/admin/recent-activity').then((r) => setRecentActivity(r.data)).catch(() => {});
      if (user?.institution_name) setSchoolName(user.institution_name);
    }
  }, [isUniversity, isSchoolAdmin, user]);

  useEffect(() => {
    api.get('/api/admin/recent-sessions').then((r) => setRecentSessions(r.data)).catch(() => {});
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'Admin';

  const greetingTime = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const allTiles = [
    { to: '/admin/schools', icon: <Buildings weight="duotone" size={20} />, title: 'Schools', count: uniStats?.schools ?? 0, desc: 'Academic divisions.', color: '#DC2626', bg: 'var(--brand-light)', uniOnly: true },
    { to: '/admin/departments', icon: <TreeEvergreen weight="duotone" size={20} />, title: 'Departments', count: uniStats?.departments ?? 0, desc: 'Across all schools.', color: '#DC2626', bg: 'var(--brand-light)', uniOnly: true },
    { to: '/admin/courses', icon: <BookOpen weight="duotone" size={20} />, title: 'Courses', count: uniStats?.courses ?? courses.length, desc: 'Active offerings.', color: '#DC2626', bg: 'var(--brand-light)', uniOnly: false },
    { to: '/admin/classes', icon: <Users weight="duotone" size={20} />, title: 'Classes', count: uniStats?.classes ?? classes.length, desc: 'Active groups.', color: '#DC2626', bg: 'var(--brand-light)', uniOnly: false },
    { to: '/admin/lecturers', icon: <UserCheck weight="duotone" size={20} />, title: 'Lecturers', count: uniStats?.lecturers ?? lecturers.length, desc: 'Assigned faculty.', color: '#DC2626', bg: 'var(--brand-light)', uniOnly: false },
    { to: '/admin/students', icon: <GraduationCap weight="duotone" size={20} />, title: 'Students', count: uniStats?.students ?? students.length, desc: 'Currently enrolled.', color: '#DC2626', bg: 'var(--brand-light)', uniOnly: false },
    { to: '/admin/lecture-halls', icon: <MapPin weight="duotone" size={20} />, title: 'Lecture Halls', count: uniStats?.lecture_halls ?? lectureHalls.length, desc: 'With geofence setup.', color: '#DC2626', bg: 'var(--brand-light)', uniOnly: true },
  ];
  const tiles = isUniversity ? allTiles : allTiles.filter((t) => !t.uniOnly);

  const schoolTiles = [
    { to: '/admin/departments', icon: <TreeEvergreen weight="duotone" size={20} />, title: 'Departments', count: schoolStats?.departments ?? 0, desc: 'Across all academic divisions.', color: '#DC2626', bg: 'var(--brand-light)' },
    { to: '/admin/lecturers', icon: <UserCheck weight="duotone" size={20} />, title: 'Lecturers', count: schoolStats?.lecturers ?? 0, desc: 'Assigned across departments.', color: '#DC2626', bg: 'var(--brand-light)' },
    { to: '/admin/students', icon: <GraduationCap weight="duotone" size={20} />, title: 'Students', count: schoolStats?.students ?? 0, desc: 'Currently enrolled.', color: '#DC2626', bg: 'var(--brand-light)' },
    { to: null, icon: <ChartLineUp weight="duotone" size={20} />, title: 'Avg Attendance', count: schoolStats?.avg_attendance != null ? `${Math.round(schoolStats.avg_attendance)}%` : '—', desc: 'This semester.', color: '#DC2626', bg: 'var(--brand-light)' },
  ];

  const quickStatsData = isUniversity && uniStats
    ? [
        { icon: <Buildings weight="duotone" size={18} />, value: uniStats.schools, label: 'Schools', color: '#DC2626', bg: 'var(--brand-light)' },
        { icon: <TreeEvergreen weight="duotone" size={18} />, value: uniStats.departments, label: 'Departments', color: '#DC2626', bg: 'var(--brand-light)' },
        { icon: <ShieldCheck weight="duotone" size={18} />, value: uniStats.admins, label: 'Admins', color: '#DC2626', bg: 'var(--brand-light)' },
        { icon: <Clock weight="duotone" size={18} />, value: uniStats.active_sessions, label: 'Active Sessions', color: '#DC2626', bg: 'var(--brand-light)' },
      ]
    : isSchoolAdmin && schoolStats
    ? [
        { icon: <TreeEvergreen weight="duotone" size={18} />, value: schoolStats.departments, label: 'Departments', color: '#DC2626', bg: 'var(--brand-light)' },
        { icon: <UserCheck weight="duotone" size={18} />, value: schoolStats.lecturers, label: 'Lecturers', color: '#DC2626', bg: 'var(--brand-light)' },
        { icon: <GraduationCap weight="duotone" size={18} />, value: schoolStats.students, label: 'Students', color: '#DC2626', bg: 'var(--brand-light)' },
        { icon: <ChartLineUp weight="duotone" size={18} />, value: `${Math.round(schoolStats.avg_attendance)}%`, label: 'Avg Attendance', color: '#DC2626', bg: 'var(--brand-light)' },
      ]
    : [
        { icon: <BookOpen weight="duotone" size={18} />, value: courses.length, label: 'Courses', color: '#DC2626', bg: 'var(--brand-light)' },
        { icon: <Users weight="duotone" size={18} />, value: classes.length, label: 'Classes', color: '#DC2626', bg: 'var(--brand-light)' },
        { icon: <UserCheck weight="duotone" size={18} />, value: lecturers.length, label: 'Lecturers', color: '#DC2626', bg: 'var(--brand-light)' },
        { icon: <GraduationCap weight="duotone" size={18} />, value: students.length, label: 'Students', color: '#DC2626', bg: 'var(--brand-light)' },
      ];

  const heroSubtitle = isUniversity
    ? `System Owner — ${uniStats?.active_sessions || 0} active session${uniStats?.active_sessions === 1 ? '' : 's'} running across ${uniStats?.schools || 0} schools.`
    : isSchoolAdmin
    ? `${schoolName || 'School'} — ${schoolStats?.departments || 0} departments, ${schoolStats?.lecturers || 0} lecturers, ${(schoolStats?.students || 0).toLocaleString()} students. ${schoolStats?.avg_attendance != null ? `${Math.round(schoolStats.avg_attendance)}% average attendance this semester.` : ''}`
    : `${uniStats?.active_sessions || 0} active session${uniStats?.active_sessions === 1 ? '' : 's'} running today.`;

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Hero Banner */}
      <div style={{
        background: '#DC2626', borderRadius: 'var(--radius-md, 8px)', padding: '2rem 2.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem',
        color: 'var(--text-inverse)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>
            {greetingTime()}, {firstName}
          </div>
          <div style={{ fontSize: '0.875rem', opacity: 0.8, fontWeight: 500, marginBottom: '0.5rem' }}>{today}</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>{heroSubtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', position: 'relative', zIndex: 1, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem',
            background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 'var(--radius-md, 8px)', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80', flexShrink: 0 }} />
            {isUniversity ? uniStats?.active_sessions || 0 : schoolStats?.active_sessions || 0} Active Sessions
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem',
            background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 'var(--radius-md, 8px)', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FBBF24', flexShrink: 0 }} />
            {isUniversity ? `${uniStats?.schools || 0} Schools` : isSchoolAdmin ? `${Math.round(schoolStats?.avg_attendance || 0)}% Attendance` : 'Dashboard'}
          </div>
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Category Cards */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {isSchoolAdmin ? (schoolName || 'School') : 'Management'}
              </h3>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {(isSchoolAdmin ? schoolTiles : tiles).map((tile) =>
                  tile.to ? (
                    <Link key={tile.title} to={tile.to} style={{ textDecoration: 'none' }}>
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
                        padding: '1.125rem', borderRadius: 'var(--radius-md, 8px)',
                        border: '1px solid var(--border)', background: 'var(--bg-card)',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 'var(--radius-sm, 6px)',
                          background: tile.bg, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: tile.color, flexShrink: 0,
                        }}>
                          {tile.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.125rem' }}>{tile.title}</div>
                          <div style={{ fontSize: '0.75rem', color: tile.color, fontWeight: 700, marginBottom: '0.25rem' }}>{tile.count} {tile.title.toLowerCase()}</div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{tile.desc}</div>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div key={tile.title} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
                      padding: '1.125rem', borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid var(--border)', background: 'var(--bg-card)',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-sm, 6px)',
                        background: tile.bg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: tile.color, flexShrink: 0,
                      }}>
                        {tile.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.125rem' }}>{tile.title}</div>
                        <div style={{ fontSize: '0.75rem', color: tile.color, fontWeight: 700, marginBottom: '0.25rem' }}>{tile.count}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{tile.desc}</div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Recent Sessions */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Recent Sessions</h3>
            </div>
            <div style={{ padding: 0 }}>
              {recentSessions.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Course', 'Date', 'Attendance', 'Status'].map((h) => (
                        <th key={h} style={{
                          textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)',
                          padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentSessions.slice(0, 7).map((s, i) => (
                      <tr key={s.id || i} style={{ transition: 'background 0.1s' }}>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>{s.course_name || s.course || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>{s.date || s.session_date || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>{s.attendance_rate != null ? `${s.attendance_rate}%` : '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm, 6px)',
                            fontSize: '0.6875rem', fontWeight: 600,
                            ...(s.status === 'completed' ? { background: 'var(--success-bg)', color: 'var(--success)' }
                              : s.status === 'in_progress' ? { background: 'var(--warning-bg)', color: 'var(--warning)' }
                              : { background: 'var(--error-bg)', color: 'var(--error)' }),
                          }}>
                            {s.status === 'completed' ? '✓' : s.status === 'in_progress' ? '●' : '✕'} {s.status === 'completed' ? 'Completed' : s.status === 'in_progress' ? 'In Progress' : 'Cancelled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No recent sessions.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '5rem' }}>
          {/* Quick Stats */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Quick Stats</h3>
            </div>
            <div style={{ padding: '0.5rem 1.25rem' }}>
              {quickStatsData.map((s, i) => (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 0',
                  borderBottom: i < quickStatsData.length - 1 ? '1px solid var(--border-light)' : 'none',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 'var(--radius-sm, 6px)',
                    background: s.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: s.color, flexShrink: 0,
                  }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{s.value}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity (school admin only) */}
          {isSchoolAdmin && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid var(--border)', overflow: 'hidden',
            }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Recent Activity</h3>
              </div>
              <div style={{ padding: '0.5rem 1.25rem' }}>
                {recentActivity.length > 0 ? (
                  recentActivity.slice(0, 5).map((a, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                      padding: '0.625rem 0',
                      borderBottom: i < Math.min(recentActivity.length, 5) - 1 ? '1px solid var(--border-light)' : 'none',
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-inverse)', flexShrink: 0,
                        background: a.status === 'completed' ? 'var(--success)' : a.status === 'in_progress' ? '#D97706' : '#DC2626',
                      }}>
                        {a.course_name?.split(' ')[0]?.substring(0, 2)?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4, margin: 0 }}>
                          <strong>{a.course_name || 'Session'}</strong> — {a.status === 'completed' ? `${a.rate}% attendance` : a.status === 'in_progress' ? 'Session in progress' : 'Completed'}
                        </p>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.125rem' }}>{timeAgo(a.created_at)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '0.75rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No recent activity.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lecturers, setLecturers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const user = useMemo(() => {
    try { return getStoredUser(); } catch { return null; }
  }, []);
  const isReadOnly = user?.admin_level !== 'department';
  const isUniversity = user?.admin_level === 'university';
  const isSchoolAdmin = user?.admin_level === 'school';

  const [schools, setSchools] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  useEffect(() => {
    if (isUniversity) api.get('/api/schools').then(r => setSchools(r.data)).catch(() => {});
    if (isUniversity || isSchoolAdmin) api.get('/api/departments').then(r => setDepartments(r.data)).catch(() => {});
  }, [isUniversity, isSchoolAdmin]);

  const filteredDepartments = useMemo(() => {
    if (!filterSchool) return departments;
    return departments.filter(d => String(d.school_id) === String(filterSchool));
  }, [departments, filterSchool]);

  const load = useCallback(async (p, schoolId, deptId) => {
    const params = { limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE };
    if (schoolId) params.school_id = schoolId;
    if (deptId) params.department_id = deptId;
    const [cRes, lRes] = await Promise.all([
      api.get('/api/admin/courses', { params }),
      api.get('/api/admin/lecturers'),
    ]);
    setCourses(cRes.data.courses);
    setTotal(cRes.data.total);
    setLecturers(lRes.data.lecturers);
  }, []);

  useEffect(() => { load(page, filterSchool, filterDepartment); }, [load, page, filterSchool, filterDepartment]);

  const add = async (form) => {
    await api.post('/api/admin/courses', {
      course_code: form.course_code,
      course_name: form.course_name,
      total_weeks: parseInt(form.total_weeks),
      lecturer_ids: Array.isArray(form.lecturer_ids) ? form.lecturer_ids.map(Number) : [],
      min_attendance_pct: parseInt(form.min_attendance_pct) || 70,
    });
    setPage(1);
    await load(1, filterSchool, filterDepartment);
  };

  const saveEdit = async (form) => {
    await api.put(`/api/admin/courses/${editing.course_code}`, {
      course_name: form.course_name,
      total_weeks: parseInt(form.total_weeks),
      lecturer_ids: Array.isArray(form.lecturer_ids) ? form.lecturer_ids.map(Number) : [],
      min_attendance_pct: parseInt(form.min_attendance_pct) || 70,
    });
    await load(page, filterSchool, filterDepartment);
  };

  const remove = async (code) => {
    await api.delete(`/api/admin/courses/${code}`);
    toast.success('Course deleted');
    await load(page, filterSchool, filterDepartment);
  };

  const lecturerOptions = lecturers.map((l) => ({ value: l.id, label: l.name }));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Courses"
        description={isReadOnly ? 'View all courses across the university.' : 'Create courses, assign lecturers, and configure attendance policies.'}
        action={isReadOnly ? undefined : () => setShowCreate(true)}
        actionLabel="New Course"
        actionIcon={Plus}
      />
      <ScopeFilter
        user={user} schools={schools} departments={departments}
        filterSchool={filterSchool} setFilterSchool={setFilterSchool}
        filterDepartment={filterDepartment} setFilterDepartment={setFilterDepartment}
        setPage={setPage}
      />
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="matrix-table" style={{ border: 'none', borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Course Name</th>
                <th>Code</th>
                <th>Weeks</th>
                <th>Min %</th>
                <th>Lecturers</th>
                {!isReadOnly && <th style={{ textAlign: 'center' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {courses.length === 0 && (
                <tr>
                  <td colSpan={isReadOnly ? 5 : 6}>
                    <div className="entity-empty">
                      <div className="entity-empty-icon">
                        <BookOpen weight="duotone" size={40} />
                      </div>
                      <div className="entity-empty-title">No courses yet</div>
                      <div className="entity-empty-desc">Courses will appear here once they are created.</div>
                    </div>
                  </td>
                </tr>
              )}
              {courses.map((c) => (
                <tr key={c.course_code}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.course_name}</td>
                  <td><span className="badge badge-error">{c.course_code}</span></td>
                  <td>{c.total_weeks}</td>
                  <td>{c.min_attendance_pct}%</td>
                  <td>{Array.isArray(c.lecturers) ? c.lecturers.map(l => l.name).join(', ') : ''}</td>
                  {!isReadOnly && (
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                        <button onClick={() => setEditing(c)} style={{
                          width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-light, #e5e7eb)',
                          background: 'var(--bg-card, #fff)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-muted, #6b7280)', transition: 'all 0.15s',
                        }}>
                          <PencilSimple size={14} />
                        </button>
                        <button onClick={() => setDeleting(c)} style={{
                          width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FCA5A5',
                          background: 'var(--brand-light)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--brand)', transition: 'all 0.15s',
                        }}>
                          <Trash size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'center' }}>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>
      {!isReadOnly && showCreate && (
        <CreateModal
          entityLabel="Course"
          fields={[
            { name: 'course_code', label: 'Code', placeholder: 'e.g. CS101' },
            { name: 'course_name', label: 'Name', placeholder: 'Intro to CS' },
            { name: 'total_weeks', label: 'Weeks', type: 'number', min: 1, max: 52 },
            { name: 'lecturer_ids', label: 'Lecturers', type: 'multiselect', options: lecturerOptions },
            { name: 'min_attendance_pct', label: 'Min %', type: 'number', min: 0, max: 100 },
          ]}
          onSave={add}
          onClose={() => setShowCreate(false)}
        />
      )}
      {!isReadOnly && editing && (
        <EditModal
          entityLabel="Course"
          fields={[
            { name: 'course_name', label: 'Name' },
            { name: 'total_weeks', label: 'Weeks', type: 'number', min: 1, max: 52 },
            { name: 'lecturer_ids', label: 'Lecturers', type: 'multiselect', options: lecturerOptions },
            { name: 'min_attendance_pct', label: 'Min %', type: 'number', min: 0, max: 100 },
          ]}
          data={{ ...editing, lecturer_ids: Array.isArray(editing.lecturers) ? editing.lecturers.map((l) => l.id) : [] }}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete Course"
          message={`Are you sure you want to delete "${deleting.course_name}" (${deleting.course_code})?`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => { await remove(deleting.course_code); setDeleting(null); }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lecturers, setLecturers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const user = useMemo(() => {
    try { return getStoredUser(); } catch { return null; }
  }, []);
  const isReadOnly = user?.admin_level !== 'department';
  const isUniversity = user?.admin_level === 'university';
  const isSchoolAdmin = user?.admin_level === 'school';

  const [schools, setSchools] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  useEffect(() => {
    if (isUniversity) api.get('/api/schools').then(r => setSchools(r.data)).catch(() => {});
    if (isUniversity || isSchoolAdmin) api.get('/api/departments').then(r => setDepartments(r.data)).catch(() => {});
  }, [isUniversity, isSchoolAdmin]);

  const filteredDepartments = useMemo(() => {
    if (!filterSchool) return departments;
    return departments.filter(d => String(d.school_id) === String(filterSchool));
  }, [departments, filterSchool]);

  const load = useCallback(async (p, schoolId, deptId) => {
    const params = { limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE };
    if (schoolId) params.school_id = schoolId;
    if (deptId) params.department_id = deptId;
    const [cRes, lRes] = await Promise.all([
      api.get('/api/admin/classes', { params }),
      api.get('/api/admin/lecturers'),
    ]);
    setClasses(cRes.data.classes);
    setTotal(cRes.data.total);
    setLecturers(lRes.data.lecturers);
  }, []);

  useEffect(() => { load(page, filterSchool, filterDepartment); }, [load, page, filterSchool, filterDepartment]);

  const add = async (form) => {
    await api.post('/api/admin/classes', {
      class_name: form.class_name,
      lecturer_ids: Array.isArray(form.lecturer_ids) ? form.lecturer_ids.map(Number) : [],
    });
    setPage(1);
    await load(1, filterSchool, filterDepartment);
  };

  const saveEdit = async (form) => {
    await api.put(`/api/admin/classes/${editing.class_id}`, {
      class_name: form.class_name,
      lecturer_ids: Array.isArray(form.lecturer_ids) ? form.lecturer_ids.map(Number) : [],
    });
    await load(page, filterSchool, filterDepartment);
  };

  const remove = async (id) => {
    await api.delete(`/api/admin/classes/${id}`);
    toast.success('Class deleted');
    await load(page, filterSchool, filterDepartment);
  };

  const lecturerOptions = lecturers.map((l) => ({ value: l.id, label: l.name }));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Classes"
        description={isReadOnly ? 'View all classes across the university.' : 'Create classes, assign lecturers, and enroll students.'}
        action={isReadOnly ? undefined : () => setShowCreate(true)}
        actionLabel="New Class"
        actionIcon={Plus}
      />
      <ScopeFilter
        user={user} schools={schools} departments={departments}
        filterSchool={filterSchool} setFilterSchool={setFilterSchool}
        filterDepartment={filterDepartment} setFilterDepartment={setFilterDepartment}
        setPage={setPage}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
        {classes.map((cls) => {
          const lecs = Array.isArray(cls.lecturers) ? cls.lecturers : [];
          return (
            <div key={cls.class_id} style={{
              background: 'var(--bg-card, #fff)', borderRadius: '8px',
              border: '1px solid var(--border-light, #e5e7eb)', padding: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '6px',
                  background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Users weight="duotone" size={20} color="var(--brand)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary, #1A1A1A)' }}>{cls.class_name}</div>
                  {lecs.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {lecs[0].name}
                      </span>
                    </div>
                  )}
                </div>
                {!isReadOnly && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    <button onClick={() => setEditing(cls)} style={{
                      width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-light, #e5e7eb)',
                      background: 'var(--bg-card, #fff)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted, #6b7280)', transition: 'all 0.15s',
                    }}>
                      <PencilSimple size={14} />
                    </button>
                    <button onClick={() => setDeleting(cls)} style={{
                      width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FCA5A5',
                      background: 'var(--brand-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--brand)', transition: 'all 0.15s',
                    }}>
                      <Trash size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div style={{
                marginTop: '0.875rem', padding: '0.6rem 0.875rem',
                background: 'var(--bg-global, #F5F5F5)', borderRadius: '6px', border: '1px solid var(--border-light, #F5F5F5)',
                fontSize: '0.8rem', color: 'var(--text-secondary, #6B7280)',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
                <GraduationCap size={14} color="#16A34A" />
                <span><strong>{cls.student_count || 0}</strong> students enrolled</span>
              </div>
              {lecs.length > 0 && (
                <div style={{ marginTop: '0.625rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {lecs.map((l) => (
                    <span key={l.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      padding: '0.2rem 0.5rem', background: 'var(--bg-global, #F5F5F5)', borderRadius: '6px',
                      fontSize: '0.7rem', color: 'var(--text-secondary, #6b7280)', border: '1px solid var(--border-light, #e5e7eb)',
                    }}>
                      {l.email}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      {!isReadOnly && showCreate && (
        <CreateModal
          entityLabel="Class"
          fields={[
            { name: 'class_name', label: 'Class Name', placeholder: 'e.g. BSc CS Year 1' },
            { name: 'lecturer_ids', label: 'Lecturers', type: 'multiselect', options: lecturerOptions },
          ]}
          onSave={add}
          onClose={() => setShowCreate(false)}
        />
      )}
      {!isReadOnly && editing && (
        <EditModal
          entityLabel="Class"
          fields={[
            { name: 'class_name', label: 'Class Name' },
            { name: 'lecturer_ids', label: 'Lecturers', type: 'multiselect', options: lecturerOptions },
          ]}
          data={{ ...editing, lecturer_ids: Array.isArray(editing.lecturers) ? editing.lecturers.map((l) => l.id) : [] }}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete Class"
          message={`Are you sure you want to delete "${deleting.class_name}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => { await remove(deleting.class_id); setDeleting(null); }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function LecturersPage() {
  const [lecturers, setLecturers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const user = useMemo(() => {
    try { return getStoredUser(); } catch { return null; }
  }, []);
  const isReadOnly = user?.admin_level !== 'department';
  const isUniversity = user?.admin_level === 'university';
  const isSchoolAdmin = user?.admin_level === 'school';

  const [schools, setSchools] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  useEffect(() => {
    if (isUniversity) api.get('/api/schools').then(r => setSchools(r.data)).catch(() => {});
    if (isUniversity || isSchoolAdmin) api.get('/api/departments').then(r => setDepartments(r.data)).catch(() => {});
  }, [isUniversity, isSchoolAdmin]);

  const filteredDepartments = useMemo(() => {
    if (!filterSchool) return departments;
    return departments.filter(d => String(d.school_id) === String(filterSchool));
  }, [departments, filterSchool]);

  const load = useCallback(async (p, schoolId, deptId) => {
    const params = { limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE };
    if (schoolId) params.school_id = schoolId;
    if (deptId) params.department_id = deptId;
    const res = await api.get('/api/admin/lecturers', { params });
    setLecturers(res.data.lecturers);
    setTotal(res.data.total);
  }, []);

  useEffect(() => { load(page, filterSchool, filterDepartment); }, [load, page, filterSchool, filterDepartment]);

  const add = async (form) => {
    await api.post('/api/admin/lecturers', form);
    setPage(1);
    await load(1, filterSchool, filterDepartment);
  };

  const saveEdit = async (form) => {
    const payload = { name: form.name, email: form.email };
    if (form.password) payload.password = form.password;
    await api.put(`/api/admin/lecturers/${editing.id}`, payload);
    await load(page, filterSchool, filterDepartment);
  };

  const remove = async (id) => {
    await api.delete(`/api/admin/lecturers/${id}`);
    toast.success('Lecturer deleted');
    await load(page, filterSchool, filterDepartment);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Lecturers"
        description={isReadOnly ? 'View all lecturers across the university.' : 'Manage lecturers and their credentials.'}
        action={isReadOnly ? undefined : () => setShowCreate(true)}
        actionLabel="New Lecturer"
        actionIcon={Plus}
      />
      <ScopeFilter
        user={user} schools={schools} departments={departments}
        filterSchool={filterSchool} setFilterSchool={setFilterSchool}
        filterDepartment={filterDepartment} setFilterDepartment={setFilterDepartment}
        setPage={setPage}
      />
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="matrix-table" style={{ border: 'none', borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                {!isReadOnly && <th style={{ textAlign: 'center' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {lecturers.length === 0 && (
                <tr>
                  <td colSpan={isReadOnly ? 3 : 4}>
                    <div className="entity-empty">
                      <div className="entity-empty-icon">
                        <UserCheck weight="duotone" size={40} />
                      </div>
                      <div className="entity-empty-title">No lecturers yet</div>
                      <div className="entity-empty-desc">Lecturers will appear here once they are created.</div>
                    </div>
                  </td>
                </tr>
              )}
              {lecturers.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.name}</td>
                  <td>{l.email}</td>
                  <td>{l.department_name || '\u2014'}</td>
                  {!isReadOnly && (
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                        <button onClick={() => setEditing(l)} style={{
                          width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-light, #e5e7eb)',
                          background: 'var(--bg-card, #fff)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-muted, #6b7280)', transition: 'all 0.15s',
                        }}>
                          <PencilSimple size={14} />
                        </button>
                        <button onClick={() => setDeleting(l)} style={{
                          width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FCA5A5',
                          background: 'var(--brand-light)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--brand)', transition: 'all 0.15s',
                        }}>
                          <Trash size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'center' }}>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>
      {!isReadOnly && showCreate && (
        <CreateModal
          entityLabel="Lecturer"
          fields={[
            { name: 'name', label: 'Name', placeholder: 'Dr. Name' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'password', label: 'Password', type: 'password' },
          ]}
          onSave={add}
          onClose={() => setShowCreate(false)}
        />
      )}
      {!isReadOnly && editing && (
        <EditModal
          entityLabel="Lecturer"
          fields={[
            { name: 'name', label: 'Name' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'password', label: 'New Password (leave blank to keep)', type: 'password' },
          ]}
          data={editing}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const user = useMemo(() => {
    try { return getStoredUser(); } catch { return null; }
  }, []);
  const isReadOnly = user?.admin_level !== 'department';
  const isUniversity = user?.admin_level === 'university';
  const isSchoolAdmin = user?.admin_level === 'school';

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const [schools, setSchools] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  useEffect(() => {
    if (isUniversity) api.get('/api/schools').then(r => setSchools(r.data)).catch(() => {});
    if (isUniversity || isSchoolAdmin) api.get('/api/departments').then(r => setDepartments(r.data)).catch(() => {});
  }, [isUniversity, isSchoolAdmin]);

  const filteredDepartments = useMemo(() => {
    if (!filterSchool) return departments;
    return departments.filter(d => String(d.school_id) === String(filterSchool));
  }, [departments, filterSchool]);

  const loadClasses = useCallback(async (schoolId, deptId) => {
    const params = {};
    if (schoolId) params.school_id = schoolId;
    if (deptId) params.department_id = deptId;
    const res = await api.get('/api/admin/classes', { params });
    setClasses(res.data.classes);
  }, []);

  const loadStudents = useCallback(async (classId, p, schoolId, deptId) => {
    const params = { limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE };
    if (classId) params.class_id = classId;
    else {
      if (schoolId) params.school_id = schoolId;
      if (deptId) params.department_id = deptId;
    }
    const res = await api.get('/api/admin/students', { params });
    setStudents(res.data.students);
    setTotal(res.data.total);
  }, []);

  useEffect(() => { loadClasses(filterSchool, filterDepartment); }, [loadClasses, filterSchool, filterDepartment]);
  useEffect(() => { loadStudents(selectedClass, page, filterSchool, filterDepartment); }, [selectedClass, page, filterSchool, filterDepartment, loadStudents]);

  const add = async (form) => {
    await api.post('/api/admin/students', { ...form, class_id: parseInt(selectedClass) });
    setPage(1);
    await loadStudents(selectedClass, 1, filterSchool, filterDepartment);
  };

  const saveEdit = async (form) => {
    await api.put(`/api/admin/students/${editing.id}`, form);
    await loadStudents(selectedClass, page, filterSchool, filterDepartment);
    setEditing(null);
  };

  const remove = async (id) => {
    await api.delete(`/api/admin/students/${id}`);
    toast.success('Student deleted');
    await loadStudents(selectedClass, page, filterSchool, filterDepartment);
  };

  const handleBulkImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('class_id', selectedClass);
      const res = await api.post('/api/admin/students/bulk', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(res.data);
      await loadStudents(selectedClass, page, filterSchool, filterDepartment);
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed.' });
    } finally {
      setImporting(false);
      fileRef.current.value = '';
      setTimeout(() => setImportResult(null), 5000);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Students"
        description={isReadOnly ? 'View students organized by class.' : 'Manage student roster by class, including bulk CSV import.'}
        action={isReadOnly ? undefined : (selectedClass ? () => setShowCreate(true) : undefined)}
        actionLabel="New Student"
        actionIcon={Plus}
        right={!isReadOnly && selectedClass ? (
          <>
            <input type="file" accept=".csv" ref={fileRef} onChange={handleBulkImport} style={{ display: 'none' }} />
            <button
              type="button"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                background: 'rgba(255,255,255,0.15)',
                color: 'var(--text-inverse)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >
              {importing ? 'Importing...' : 'Import CSV'}
            </button>
            {importResult && (
              <span style={{
                fontSize: '0.75rem', fontWeight: 600,
                color: importResult.error ? 'var(--brand)' : 'var(--success)',
                background: 'rgba(255,255,255,0.15)',
                padding: '0.3rem 0.75rem', borderRadius: '6px',
              }}>
                {importResult.error ? importResult.error : `${importResult.added} students added`}
              </span>
            )}
          </>
        ) : undefined}
      />
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'flex-end' }}>
        {(isUniversity || isSchoolAdmin) && (
          <>
            {isUniversity && (
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>School</label>
                <Select value={filterSchool} onChange={(e) => { setFilterSchool(e.target.value); setFilterDepartment(''); setSelectedClass(''); setPage(1); }}>
                  <option value="">All Schools</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
            )}
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Department</label>
              <Select value={filterDepartment} onChange={(e) => { setFilterDepartment(e.target.value); setSelectedClass(''); setPage(1); }}>
                <option value="">All Departments</option>
                {filteredDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
          </>
        )}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Class</label>
          <Select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setPage(1); }}>
            <option value="">All Classes</option>
            {classes.map((c) => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
          </Select>
        </div>
      </div>
      {(selectedClass || filterSchool || filterDepartment) && (
        <>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="matrix-table" style={{ border: 'none', borderRadius: 0 }}>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Index Number</th>
                    <th>Class</th>
                    {!isReadOnly && <th style={{ textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
        {students.length === 0 && (
                    <tr>
                      <td colSpan={isReadOnly ? 3 : 4}>
                        <div className="entity-empty">
                          <div className="entity-empty-icon">
                            <GraduationCap weight="duotone" size={40} />
                          </div>
                          <div className="entity-empty-title">No students yet</div>
                          <div className="entity-empty-desc">Students will appear here once they are enrolled.</div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.student_name}</td>
                      <td>{s.index_number}</td>
                      <td>{s.class_name}</td>
                      {!isReadOnly && (
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button onClick={() => setEditing(s)} style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-light, #e5e7eb)',
                              background: 'var(--bg-card, #fff)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--text-muted, #6b7280)', transition: 'all 0.15s',
                            }}>
                              <PencilSimple size={14} />
                            </button>
                            <button onClick={() => setDeleting(s)} style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FCA5A5',
                              background: 'var(--brand-light)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--brand)', transition: 'all 0.15s',
                            }}>
                              <Trash size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'center' }}>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>
          {!isReadOnly && showCreate && (
            <CreateModal
              entityLabel="Student"
              fields={[
                { name: 'index_number', label: 'Index Number', placeholder: 'e.g. CS2024001' },
                { name: 'student_name', label: 'Student Name', placeholder: 'Full name' },
              ]}
              onSave={add}
              onClose={() => setShowCreate(false)}
            />
          )}
          {!isReadOnly && editing && (
            <EditModal
              entityLabel="Student"
              fields={[{ name: 'index_number', label: 'Index Number' }, { name: 'student_name', label: 'Student Name' }]}
              data={editing}
              onSave={saveEdit}
              onClose={() => setEditing(null)}
            />
          )}
        </>
      )}
      {deleting && (
        <ConfirmModal
          title="Delete Student"
          message={`Are you sure you want to delete "${deleting.student_name}" (${deleting.index_number})?`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => { await remove(deleting.id); setDeleting(null); }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function SchoolsPage() {
  const [schools, setSchools] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const loadSchools = useCallback(async () => {
    try {
      const res = await api.get('/api/schools');
      setSchools(res.data);
    } catch { /* empty */ }
  }, []);

  useEffect(() => { loadSchools(); }, [loadSchools]);

  const add = async (form) => {
    const payload = { name: form.name, code: form.code, admin_email: form.admin_email, admin_name: form.admin_name, admin_password: form.admin_password };
    try {
      await api.post('/api/schools', payload);
      toast.success('School created.');
      loadSchools();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create school.';
      toast.error(msg);
      throw err;
    }
  };

  const saveEdit = async (form) => {
    await api.put(`/api/schools/${editing.id}`, form);
    toast.success('School updated.');
    loadSchools();
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/schools/${id}`);
      toast.success('School deleted.');
      loadSchools();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Schools"
        description="Organize departments under schools within the university."
        action={() => setShowCreate(true)}
        actionLabel="New School"
        actionIcon={Plus}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {schools.map((s) => (
          <div key={s.id} style={{
            background: 'var(--bg-card, #fff)', borderRadius: '8px',
            border: '1px solid var(--border-light, #e5e7eb)', padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '6px',
                background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Buildings weight="duotone" size={20} color="var(--brand)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary, #1A1A1A)' }}>{s.name}</div>
                <div style={{ marginTop: '0.25rem' }}>
                  <span style={{
                    display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '6px',
                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                    background: 'var(--brand-light)', color: '#DC2626',
                  }}>{s.code}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                <button onClick={() => setEditing(s)} style={{
                  width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-light, #e5e7eb)',
                  background: 'var(--bg-card, #fff)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted, #6b7280)', transition: 'all 0.15s',
                }}>
                  <PencilSimple size={14} />
                </button>
                <button onClick={() => setDeleting(s)} style={{
                  width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FCA5A5',
                  background: 'var(--brand-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--brand)', transition: 'all 0.15s',
                }}>
                  <Trash size={14} />
                </button>
              </div>
            </div>
            <div style={{
              marginTop: '0.875rem', padding: '0.6rem 0.875rem',
              background: 'var(--bg-global, #F5F5F5)', borderRadius: '6px', border: '1px solid var(--border-light, #F5F5F5)',
              fontSize: '0.8rem', color: 'var(--text-secondary, #6B7280)',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <TreeEvergreen size={14} color="var(--brand)" />
              <span><strong>{s.department_count || 0}</strong> departments</span>
            </div>
          </div>
        ))}
        {schools.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #9ca3af)', fontSize: '0.875rem', gridColumn: '1 / -1' }}>
            No schools yet.
          </div>
        )}
      </div>
      {showCreate && (
        <CreateModal
          entityLabel="School"
          fields={[
            { name: 'name', label: 'School Name', placeholder: 'e.g. School of Science' },
            { name: 'code', label: 'Code', placeholder: 'e.g. SOS' },
            { name: 'admin_email', label: 'Admin Email', type: 'email', placeholder: 'admin@school.edu' },
            { name: 'admin_name', label: 'Admin Name', placeholder: 'e.g. Dr. John Doe' },
            { name: 'admin_password', label: 'Admin Password', type: 'password', placeholder: 'Min 8 characters' },
          ]}
          onSave={add}
          onClose={() => setShowCreate(false)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete School"
          message={`Are you sure you want to delete "${deleting.name}"? All departments under this school will be removed.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
      {editing && (
        <EditModal
          entityLabel="School"
          fields={[
            { name: 'name', label: 'School Name' },
            { name: 'code', label: 'Code' },
          ]}
          data={editing}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [schools, setSchools] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [filterSchool, setFilterSchool] = useState('');
  const toast = useToast();

  const user = useMemo(() => {
    try { return getStoredUser(); } catch { return null; }
  }, []);

  const isReadOnly = user?.admin_level === 'university';
  const isSchoolAdmin = user?.admin_level === 'school';

  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.get('/api/departments');
      setDepartments(res.data);
    } catch { /* empty */ }
  }, []);

  const loadSchools = useCallback(async () => {
    try {
      const res = await api.get('/api/schools');
      setSchools(res.data);
    } catch { /* empty */ }
  }, []);

  useEffect(() => { loadDepartments(); loadSchools(); }, [loadDepartments, loadSchools]);

  const add = async (form) => {
    const payload = { name: form.name, code: form.code, admin_email: form.admin_email, admin_name: form.admin_name, admin_password: form.admin_password };
    if (isReadOnly && form.school_id) {
      payload.school_id = parseInt(form.school_id);
    }
    try {
      await api.post('/api/departments', payload);
      toast.success('Department created.');
      loadDepartments();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to create department.';
      toast.error(msg);
      throw err;
    }
  };

  const saveEdit = async (form) => {
    const payload = { name: form.name, code: form.code };
    await api.put(`/api/departments/${editing.id}`, payload);
    toast.success('Department updated.');
    loadDepartments();
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/departments/${id}`);
      toast.success('Department deleted.');
      loadDepartments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    }
  };

  const filtered = useMemo(() => {
    if (!filterSchool) return departments;
    return departments.filter((d) => String(d.school_id) === String(filterSchool));
  }, [departments, filterSchool]);

  const schoolOptions = schools.map((s) => ({ value: s.id, label: s.name }));

  const deptFields = [
    { name: 'name', label: 'Department Name', placeholder: 'e.g. Computer Science' },
    { name: 'code', label: 'Code', placeholder: 'e.g. CS' },
    { name: 'admin_email', label: 'Admin Email', type: 'email', placeholder: 'admin@department.edu' },
    { name: 'admin_name', label: 'Admin Name', placeholder: 'e.g. Dr. Jane Smith' },
    { name: 'admin_password', label: 'Admin Password', type: 'password', placeholder: 'Min 8 characters' },
  ];
  if (isReadOnly) {
    deptFields.splice(2);
    deptFields.push({ name: 'school_id', label: 'School', type: 'select', options: schoolOptions, placeholder: 'Select School' });
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        description={isReadOnly ? 'View departments organized under schools.' : 'Create departments within schools to organize courses and lecturers.'}
        action={isReadOnly ? undefined : () => setShowCreate(true)}
        actionLabel="New Department"
        actionIcon={Plus}
      />
      {isReadOnly && (
        <div style={{ maxWidth: '320px', marginBottom: '1.25rem' }}>
          <label style={{
            display: 'block', fontSize: '0.8rem', fontWeight: 600,
            color: 'var(--text-secondary)', marginBottom: '0.375rem',
          }}>
            Filter by School
          </label>
          <Select value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)}>
            <option value="">All Schools</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {filtered.map((d) => (
          <div key={d.id} style={{
            background: 'var(--bg-card, #fff)', borderRadius: '8px',
            border: '1px solid var(--border-light, #e5e7eb)', padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '6px',
                background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <TreeEvergreen weight="duotone" size={20} color="#16A34A" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary, #1A1A1A)' }}>{d.name}</div>
                <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '6px',
                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                    background: 'var(--success-bg)', color: 'var(--success)',
                  }}>{d.code}</span>
                  {d.school_name && (
                    <span style={{
                      display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '6px',
                      fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                      background: 'var(--brand-light)', color: '#DC2626',
                    }}>{d.school_name}</span>
                  )}
                </div>
              </div>
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  <button onClick={() => setEditing(d)} style={{
                    width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-light, #e5e7eb)',
                    background: 'var(--bg-card, #fff)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted, #6b7280)', transition: 'all 0.15s',
                  }}>
                    <PencilSimple size={14} />
                  </button>
                  <button onClick={() => setDeleting(d)} style={{
                    width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FCA5A5',
                    background: 'var(--brand-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--brand)', transition: 'all 0.15s',
                  }}>
                    <Trash size={14} />
                  </button>
                </div>
              )}
            </div>
            <div style={{
              marginTop: '0.875rem', padding: '0.6rem 0.875rem',
              background: 'var(--bg-global, #F5F5F5)', borderRadius: '6px', border: '1px solid var(--border-light, #F5F5F5)',
              fontSize: '0.8rem', color: 'var(--text-secondary, #6B7280)',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <BookOpen size={14} color="var(--brand)" />
                <strong>{d.course_count || 0}</strong> courses
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Users size={14} color="var(--brand)" />
                <strong>{d.lecturer_count || 0}</strong> lecturers
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #9ca3af)', fontSize: '0.875rem', gridColumn: '1 / -1' }}>
            No departments{filterSchool ? ' in this school' : ''} yet.
          </div>
        )}
      </div>
      {!isReadOnly && showCreate && (
        <CreateModal
          entityLabel="Department"
          fields={deptFields}
          onSave={add}
          onClose={() => setShowCreate(false)}
        />
      )}
      {!isReadOnly && editing && (
        <EditModal
          entityLabel="Department"
          fields={deptFields.filter(f => f.name !== 'school_id')}
          data={editing}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}
      {!isReadOnly && deleting && (
        <ConfirmModal
          title="Delete Department"
          message={`Are you sure you want to delete "${deleting.name}"? Courses and lecturers will be unassigned.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function AcademicTermsPage() {
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [editingYear, setEditingYear] = useState(null);
  const [editingSemester, setEditingSemester] = useState(null);
  const [showCreateYear, setShowCreateYear] = useState(false);
  const [showCreateSemester, setShowCreateSemester] = useState(false);
  const [deletingYear, setDeletingYear] = useState(null);
  const [deletingSemester, setDeletingSemester] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const [yRes, sRes] = await Promise.all([
      api.get('/api/admin/academic-years'),
      api.get('/api/admin/semesters'),
    ]);
    setAcademicYears(yRes.data.academic_years || []);
    setSemesters(sRes.data.semesters || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addYear = async (form) => {
    await api.post('/api/admin/academic-years', {
      label: form.label,
      start_year: parseInt(form.start_year),
      end_year: parseInt(form.end_year),
    });
    await load();
  };

  const removeYear = async (id) => {
    await api.delete(`/api/admin/academic-years/${id}`);
    toast.success('Academic year deleted');
    await load();
  };

  const addSemester = async (form) => {
    await api.post('/api/admin/semesters', {
      academic_year_id: parseInt(form.academic_year_id),
      number: parseInt(form.number),
      start_date: form.start_date,
      end_date: form.end_date,
    });
    await load();
  };

  const removeSemester = async (id) => {
    await api.delete(`/api/admin/semesters/${id}`);
    toast.success('Semester deleted');
    await load();
  };

  const activateSemester = async (id) => {
    try {
      await api.post(`/api/admin/semesters/${id}/activate`);
      toast.success('Semester activated');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to activate');
    }
  };

  const yearOptions = academicYears.map((y) => ({ value: y.id, label: y.label }));

  return (
    <div>
      <PageHeader
        title="Academic Terms"
        description="Manage academic years and semesters. Sessions are linked to the active semester."
      />

      {/* Academic Years */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary, #1A1A1A)' }}>Academic Years</h2>
        <button onClick={() => setShowCreateYear(true)} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600,
          color: '#DC2626', backgroundColor: 'var(--brand-light)', border: 'none', borderRadius: '6px',
          cursor: 'pointer',
        }}>
          <Plus size={14} /> New Year
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {academicYears.map((y) => (
          <div key={y.id} style={{
            background: 'var(--bg-card, #fff)', borderRadius: '8px',
            border: '1px solid var(--border-light, #e5e7eb)', padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '6px',
                background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <CalendarBlank weight="duotone" size={20} color="var(--brand)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary, #1A1A1A)' }}>{y.label}</div>
                <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 600, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                    {y.start_year} — {y.end_year}
                  </span>
                </div>
              </div>
              <button onClick={() => setDeletingYear(y)} style={{
                width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FCA5A5',
                background: 'var(--brand-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--brand)', transition: 'all 0.15s',
              }}>
                <Trash size={14} />
              </button>
            </div>
          </div>
        ))}
        {academicYears.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #9ca3af)', fontSize: '0.875rem', gridColumn: '1 / -1' }}>
            No academic years yet.
          </div>
        )}
      </div>

      {/* Semesters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary, #1A1A1A)' }}>Semesters</h2>
        <button onClick={() => setShowCreateSemester(true)} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600,
          color: '#DC2626', backgroundColor: 'var(--brand-light)', border: 'none', borderRadius: '6px',
          cursor: 'pointer',
        }}>
          <Plus size={14} /> New Semester
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {semesters.map((s) => (
          <div key={s.id} style={{
            background: 'var(--bg-card, #fff)', borderRadius: '8px',
            border: '1px solid var(--border-light, #e5e7eb)', padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '6px',
                background: s.is_active ? 'var(--success-bg)' : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Clock weight="duotone" size={20} color={s.is_active ? 'var(--success)' : 'var(--text-secondary)'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary, #1A1A1A)' }}>{s.label}</div>
                <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 600, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                    {new Date(s.start_date).toLocaleDateString()} — {new Date(s.end_date).toLocaleDateString()}
                  </span>
                  <span style={{
                    display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '6px',
                    fontSize: '0.65rem', fontWeight: 600,
                    background: s.is_active ? 'var(--success-bg)' : 'var(--bg-hover)',
                    color: s.is_active ? 'var(--success)' : 'var(--text-secondary)',
                  }}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                {!s.is_active && (
                  <button onClick={() => activateSemester(s.id)} style={{
                    padding: '0.35rem 0.75rem', fontSize: '0.7rem', fontWeight: 600,
                    color: '#DC2626', backgroundColor: 'var(--brand-light)', border: '1px solid #FCA5A5',
                    borderRadius: '6px', cursor: 'pointer',
                  }}>
                    Activate
                  </button>
                )}
                <button onClick={() => setDeletingSemester(s)} style={{
                  width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FCA5A5',
                  background: 'var(--brand-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--brand)', transition: 'all 0.15s',
                }}>
                  <Trash size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {semesters.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #9ca3af)', fontSize: '0.875rem', gridColumn: '1 / -1' }}>
            No semesters yet.
          </div>
        )}
      </div>

      {showCreateYear && (
        <CreateModal
          entityLabel="Academic Year"
          fields={[
            { name: 'label', label: 'Label', placeholder: 'e.g. 2026/2027' },
            { name: 'start_year', label: 'Start Year', type: 'number', min: 2020, max: 2100 },
            { name: 'end_year', label: 'End Year', type: 'number', min: 2020, max: 2100 },
          ]}
          onSave={addYear}
          onClose={() => setShowCreateYear(false)}
        />
      )}
      {showCreateSemester && (
        <CreateModal
          entityLabel="Semester"
          fields={[
            { name: 'academic_year_id', label: 'Academic Year', type: 'select', options: yearOptions, placeholder: 'Select Year' },
            { name: 'number', label: 'Number', type: 'select', options: [{ value: 1, label: 'Semester 1' }, { value: 2, label: 'Semester 2' }], placeholder: 'Select...' },
            { name: 'start_date', label: 'Start Date', type: 'date' },
            { name: 'end_date', label: 'End Date', type: 'date' },
          ]}
          onSave={addSemester}
          onClose={() => setShowCreateSemester(false)}
        />
      )}
      {editingYear && (
        <EditModal
          entityLabel="Academic Year"
          fields={[
            { name: 'label', label: 'Label' },
            { name: 'start_year', label: 'Start Year', type: 'number' },
            { name: 'end_year', label: 'End Year', type: 'number' },
          ]}
          data={editingYear}
          onSave={async (form) => {
            await api.put(`/api/admin/academic-years/${editingYear.id}`, {
              label: form.label,
              start_year: parseInt(form.start_year),
              end_year: parseInt(form.end_year),
            });
            await load();
          }}
          onClose={() => setEditingYear(null)}
        />
      )}
      {editingSemester && (
        <EditModal
          entityLabel="Semester"
          fields={[
            { name: 'academic_year_id', label: 'Academic Year', type: 'select', options: yearOptions },
            { name: 'number', label: 'Number', type: 'select', options: [{ value: 1, label: 'Semester 1' }, { value: 2, label: 'Semester 2' }] },
            { name: 'start_date', label: 'Start Date', type: 'date' },
            { name: 'end_date', label: 'End Date', type: 'date' },
          ]}
          data={editingSemester}
          onSave={async (form) => {
            await api.put(`/api/admin/semesters/${editingSemester.id}`, {
              academic_year_id: parseInt(form.academic_year_id),
              number: parseInt(form.number),
              start_date: form.start_date,
              end_date: form.end_date,
            });
            await load();
          }}
          onClose={() => setEditingSemester(null)}
        />
      )}
      {deletingYear && (
        <ConfirmModal
          title="Delete Academic Year"
          message={`Are you sure you want to delete "${deletingYear.label}"? This will also remove all semesters under this year.`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => { await removeYear(deletingYear.id); setDeletingYear(null); }}
          onCancel={() => setDeletingYear(null)}
        />
      )}
      {deletingSemester && (
        <ConfirmModal
          title="Delete Semester"
          message={`Are you sure you want to delete "${deletingSemester.label}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => { await removeSemester(deletingSemester.id); setDeletingSemester(null); }}
          onCancel={() => setDeletingSemester(null)}
        />
      )}
    </div>
  );
}

function ToolsPage() {
  const toast = useToast();
  const user = useMemo(() => {
    try { return getStoredUser(); } catch { return null; }
  }, []);
  const isUniversity = user?.admin_level === 'university';
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const [resetScope, setResetScope] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error('Select both start and end dates.');
      return;
    }
    if (startDate > endDate) {
      toast.error('Start date must be before end date.');
      return;
    }
    setExporting(true);
    try {
      const res = await api.get('/api/admin/export/semester', {
        params: { start_date: startDate, end_date: endDate },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `classpulse_export_${startDate}_to_${endDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleReset = async () => {
    if (!resetScope) {
      toast.error('Select a scope to clear.');
      return;
    }
    if (confirmText !== 'DELETE ALL') {
      toast.error('Type "DELETE ALL" to confirm.');
      return;
    }
    setResetting(true);
    try {
      const res = await api.post('/api/admin/reset', {
        scope: resetScope,
        confirm_text: confirmText,
      });
      toast.success(res.data.message);
      setResetScope('');
      setConfirmText('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Tools"
        description="Export data and manage semester records."
      />

      {/* Export Section */}
      <div style={{
        backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)', marginBottom: '1.5rem', overflow: 'hidden',
      }}>
        <div style={{
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--brand-light)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--brand)',
          }}>
            <DownloadSimple weight="duotone" size={16} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            Export to Excel
          </span>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Generate a multi-sheet Excel file containing courses, classes, sessions, attendance, and student summaries for a date range.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
              <label style={{
                display: 'block', fontSize: '0.6875rem', fontWeight: 700,
                color: 'var(--text-muted)', marginBottom: '0.375rem', textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%', padding: '0.625rem 0.875rem', fontSize: '0.875rem',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  outline: 'none', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)',
                  height: '42px', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
              <label style={{
                display: 'block', fontSize: '0.6875rem', fontWeight: 700,
                color: 'var(--text-muted)', marginBottom: '0.375rem', textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%', padding: '0.625rem 0.875rem', fontSize: '0.875rem',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  outline: 'none', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)',
                  height: '42px', boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              style={{
                padding: '0.625rem 1.5rem', fontSize: '0.8125rem', fontWeight: 600,
                color: 'var(--text-inverse)', backgroundColor: exporting ? 'var(--brand-dark)' : 'var(--brand)',
                border: 'none', borderRadius: 'var(--radius-full)', cursor: exporting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', height: '42px', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}
            >
              {exporting ? <><Spinner size={14} /> Exporting...</> : <><DownloadSimple weight="bold" size={16} /> Export</>}
            </button>
          </div>
        </div>
      </div>

      {/* Reset / Danger Zone — university admin only */}
      {isUniversity && (
      <div className="danger-zone-card">
        <div className="danger-zone-header">
          <div className="danger-zone-icon">
            <Warning weight="duotone" size={16} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--error)' }}>
            Danger Zone
          </span>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Permanently delete records from the database. This action cannot be undone.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 220px', minWidth: '180px' }}>
              <label style={{
                display: 'block', fontSize: '0.6875rem', fontWeight: 700,
                color: 'var(--text-muted)', marginBottom: '0.375rem', textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>Scope</label>
              <Select value={resetScope} onChange={(e) => setResetScope(e.target.value)}>
                <option value="">Select what to clear</option>
                <option value="attendance">Attendance Records Only</option>
                <option value="sessions">Sessions + Attendance</option>
                <option value="all">Full Reset (Everything)</option>
              </Select>
            </div>
            <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
              <label style={{
                display: 'block', fontSize: '0.6875rem', fontWeight: 700,
                color: 'var(--text-muted)', marginBottom: '0.375rem', textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>Type "DELETE ALL" to confirm</label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE ALL"
                style={{
                  width: '100%', padding: '0.625rem 0.875rem', fontSize: '0.875rem',
                  border: '1px solid var(--error)', borderRadius: 'var(--radius-md)',
                  outline: 'none', backgroundColor: 'var(--bg-input)', height: '42px', boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              type="button"
              disabled={resetting || confirmText !== 'DELETE ALL' || !resetScope}
              onClick={handleReset}
              style={{
                padding: '0.625rem 1.5rem', fontSize: '0.8125rem', fontWeight: 600,
                color: 'var(--text-inverse)', backgroundColor: 'var(--error)',
                border: 'none', borderRadius: 'var(--radius-full)',
                cursor: resetting || confirmText !== 'DELETE ALL' || !resetScope ? 'not-allowed' : 'pointer',
                opacity: resetting || confirmText !== 'DELETE ALL' || !resetScope ? 0.5 : 1,
                transition: 'all 0.2s', height: '42px', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}
            >
              {resetting ? <><Spinner size={14} /> Clearing...</> : <><Trash weight="bold" size={16} /> Clear Records</>}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [courses, setCourses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [lectureHalls, setLectureHalls] = useState([]);

  const load = useCallback(async () => {
    try {
      const [cRes, lRes, clRes, sRes, lhRes] = await Promise.all([
        api.get('/api/admin/courses'),
        api.get('/api/admin/lecturers'),
        api.get('/api/admin/classes'),
        api.get('/api/admin/students'),
        api.get('/api/lecture-halls'),
      ]);
      setCourses(cRes.data.courses || []);
      setLecturers(lRes.data.lecturers || []);
      setClasses(clRes.data.classes || []);
      setStudents(sRes.data.students || []);
      setLectureHalls(lhRes.data.lecture_halls || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
        <Routes>
          <Route index element={<AdminOverviewPage courses={courses} lecturers={lecturers} classes={classes} students={students} lectureHalls={lectureHalls} />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="lecturers" element={<LecturersPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="lecture-halls" element={<LectureHallsPage />} />
          <Route path="academic-terms" element={<AcademicTermsPage />} />
          <Route path="schools" element={<SchoolsPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="tools" element={<ToolsPage />} />
        </Routes>
      </div>
    </DashboardLayout>
  );
}
