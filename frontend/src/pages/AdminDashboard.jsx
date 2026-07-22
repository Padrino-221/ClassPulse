import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import api from '../utils/api';
import { useSearch } from '../context/SearchContext';
import DashboardLayout from '../components/DashboardLayout';
import Select from '../components/Select';
import MultiSelect from '../components/MultiSelect';
import Pagination from '../components/Pagination';
import { useToast } from '../components/Toast';
import {
  BookOpen, Users, UserCheck, GraduationCap, MapPin, Plus, PencilSimple, Trash, MagnifyingGlass,
} from '@phosphor-icons/react';

const PAGE_SIZE = 20;

const tileIcons = {
  courses: <BookOpen weight="duotone" size={22} />,
  lecturers: <UserCheck weight="duotone" size={22} />,
  classes: <Users weight="duotone" size={22} />,
  students: <GraduationCap weight="duotone" size={22} />,
  campuses: <MapPin weight="duotone" size={22} />,
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Edit {entityLabel}</div>
        <div className="modal-subtitle">Update the record details below.</div>
        {error && <div className="message error">{error}</div>}
        <form onSubmit={handleSubmit}>
          {fields.map((f) => (
            <div key={f.name} className="form-group" style={{ marginBottom: '0.75rem' }}>
              {f.type === 'multiselect' ? (
                <MultiSelect
                  label={f.label}
                  options={f.options || []}
                  value={Array.isArray(form[f.name]) ? form[f.name] : []}
                  onChange={(vals) => setForm((prev) => ({ ...prev, [f.name]: vals }))}
                />
              ) : (
                <>
                  <label>{f.label}</label>
                  {f.type === 'select' ? (
                    <Select name={f.name} value={form[f.name]} onChange={handleChange}>
                      <option value="">Select {f.label}</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  ) : (
                    <input
                      type={f.type || 'text'}
                      name={f.name}
                      value={form[f.name]}
                      onChange={handleChange}
                      min={f.min}
                      max={f.max}
                      required
                    />
                  )}
                </>
              )}
            </div>
          ))}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="submit-btn" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EntityTable({ columns, data, onDelete, onEdit, emptyMsg = 'No data.', searchQuery = '' }) {
  const filtered = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        if (Array.isArray(val)) {
          return val.some((v) => String(v.name ?? v).toLowerCase().includes(q));
        }
        return String(val ?? '').toLowerCase().includes(q);
      })
    );
  }, [data, searchQuery, columns]);

  return (
    <div className="table-container" style={{ marginTop: '1rem' }}>
      <table className="matrix-table">
        <thead>
          <tr>
            {columns.map((col) => <th key={col.key}>{col.label}</th>)}
            {(onEdit || onDelete) && <th style={{ textAlign: 'right' }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}>
                <div className="entity-empty">
                  <div className="entity-empty-icon">
                    <MagnifyingGlass weight="duotone" size={48} />
                  </div>
                  <div className="entity-empty-title">{emptyMsg}</div>
                  <div className="entity-empty-desc">Add a new record using the form above.</div>
                </div>
              </td>
            </tr>
          )}
          {filtered.map((row, i) => (
            <tr key={row.id || row.class_id || row.course_code || i}>
              {columns.map((col) => <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>)}
              {(onEdit || onDelete) && (
                <td>
                  <div className="entity-actions">
                    {onEdit && (
                      <button className="icon-btn" title="Edit" onClick={() => onEdit(row)}>
                        <PencilSimple weight="duotone" size={14} />
                      </button>
                    )}
                    {onDelete && (
                      <button className="icon-btn icon-btn-danger" title="Delete" onClick={() => onDelete(row.id || row.class_id || row.course_code)}>
                        <Trash weight="duotone" size={14} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddForm({ entityLabel, fields, onSubmit, buttonText = 'Add', extraButtons }) {
  const [form, setForm] = useState(() => fields.reduce((acc, f) => ({ ...acc, [f.name]: '' }), {}));
  const [error, setError] = useState('');
  const toast = useToast();

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSubmit(form);
      toast.success(`${entityLabel} added successfully`);
      setForm(fields.reduce((acc, f) => ({ ...acc, [f.name]: f.type === 'multiselect' ? [] : '' }), {}));
    } catch (err) {
      const msg = err.response?.data?.error || "Couldn't add.";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="entity-toolbar">
      <div className="entity-toolbar-header">
        <Plus weight="duotone" size={18} />
        <span>New {entityLabel}</span>
      </div>
      <div className="entity-toolbar-body">
        <form className="inline-form" onSubmit={handleSubmit}>
          {error && <div className="message error" style={{ width: '100%' }}>{error}</div>}
          {fields.map((f) => (
            <div key={f.name} className="form-group">
              {f.type === 'multiselect' ? (
                <MultiSelect
                  label={f.label}
                  options={f.options || []}
                  value={Array.isArray(form[f.name]) ? form[f.name] : []}
                  onChange={(vals) => setForm((prev) => ({ ...prev, [f.name]: vals }))}
                />
              ) : (
                <>
                  <label>{f.label}</label>
                  {f.type === 'select' ? (
                    <Select name={f.name} value={form[f.name]} onChange={handleChange}>
                      <option value="">Select {f.label}</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  ) : (
                    <input type={f.type || 'text'} name={f.name} value={form[f.name]} onChange={handleChange} placeholder={f.placeholder || ''} min={f.min} max={f.max} />
                  )}
                </>
              )}
            </div>
          ))}
          <button type="submit" className="submit-btn" style={{ width: 'auto' }}>{buttonText}</button>
          {extraButtons}
        </form>
      </div>
    </div>
  );
}

function CampusesPage() {
  const { searchQuery } = useSearch();
  const [campuses, setCampuses] = useState([]);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const res = await api.get('/api/campuses');
    setCampuses(res.data.campuses);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (form) => {
    await api.post('/api/campuses', {
      name: form.name,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      radius: parseInt(form.radius),
    });
    await load();
  };

  const saveEdit = async (form) => {
    await api.put(`/api/campuses/${editing.id}`, {
      name: form.name,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      radius: parseInt(form.radius),
    });
    await load();
  };

  const remove = async (id) => {
    await api.delete(`/api/campuses/${id}`);
    toast.success('Campus deleted');
    await load();
  };

  return (
    <div>
      <AddForm
        entityLabel="Campus"
        fields={[
          { name: 'name', label: 'Name', placeholder: 'e.g. Main Campus' },
          { name: 'latitude', label: 'Latitude', type: 'number', placeholder: 'e.g. 5.650000' },
          { name: 'longitude', label: 'Longitude', type: 'number', placeholder: 'e.g. -0.186000' },
          { name: 'radius', label: 'Radius (m)', type: 'number', min: 100, max: 5000 },
        ]}
        onSubmit={add}
        buttonText="Add Campus"
      />
      <EntityTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'latitude', label: 'Latitude' },
          { key: 'longitude', label: 'Longitude' },
          { key: 'radius', label: 'Radius (m)' },
        ]}
        data={campuses}
        onEdit={(row) => setEditing(row)}
        onDelete={remove}
        searchQuery={searchQuery}
      />
      {editing && (
        <EditModal
          entityLabel="Campus"
          fields={[
            { name: 'name', label: 'Name' },
            { name: 'latitude', label: 'Latitude', type: 'number' },
            { name: 'longitude', label: 'Longitude', type: 'number' },
            { name: 'radius', label: 'Radius (m)', type: 'number', min: 100, max: 5000 },
          ]}
          data={editing}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AdminOverviewPage({ courses, lecturers, classes, students, campuses }) {
  const tiles = [
    {
      to: '/admin/courses',
      icon: tileIcons.courses,
      title: 'Courses',
      count: courses.length,
      desc: 'Manage course offerings, assign lecturers, and set attendance policies.',
    },
    {
      to: '/admin/classes',
      icon: tileIcons.classes,
      title: 'Classes',
      count: classes.length,
      desc: 'Organize student cohorts and class groupings.',
    },
    {
      to: '/admin/lecturers',
      icon: tileIcons.lecturers,
      title: 'Lecturers',
      count: lecturers.length,
      desc: 'Add or update lecturer accounts and credentials.',
    },
    {
      to: '/admin/students',
      icon: tileIcons.students,
      title: 'Students',
      count: students.length,
      desc: 'Manage student rosters, bulk import, and index numbers.',
    },
    {
      to: '/admin/campuses',
      icon: tileIcons.campuses,
      title: 'Campuses',
      count: campuses.length,
      desc: 'Define campus locations and geofence radii for attendance verification.',
    },
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-title">Admin Dashboard</div>
        <div className="page-subtitle">Manage courses, classes, lecturers, and students across the system.</div>
      </div>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header">
          <h3>Management</h3>
        </div>
        <div className="card-body">
          <div className="admin-tiles-grid">
            {tiles.map((tile) => (
              <Link key={tile.to} to={tile.to} className="admin-tile">
                <div className="admin-tile-icon">{tile.icon}</div>
                <div className="admin-tile-body">
                  <div className="admin-tile-title">{tile.title}</div>
                  <div className="admin-tile-meta">{tile.count} {tile.title.toLowerCase()}</div>
                  <div className="admin-tile-desc">{tile.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function CoursesPage() {
  const { searchQuery } = useSearch();
  const [courses, setCourses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lecturers, setLecturers] = useState([]);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const load = useCallback(async (p) => {
    const [cRes, lRes] = await Promise.all([
      api.get('/api/admin/courses', { params: { limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE } }),
      api.get('/api/admin/lecturers'),
    ]);
    setCourses(cRes.data.courses);
    setTotal(cRes.data.total);
    setLecturers(lRes.data.lecturers);
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const add = async (form) => {
    await api.post('/api/admin/courses', {
      course_code: form.course_code,
      course_name: form.course_name,
      total_weeks: parseInt(form.total_weeks),
      lecturer_ids: Array.isArray(form.lecturer_ids) ? form.lecturer_ids.map(Number) : [],
      min_attendance_pct: parseInt(form.min_attendance_pct) || 70,
    });
    setPage(1);
    await load(1);
  };

  const saveEdit = async (form) => {
    await api.put(`/api/admin/courses/${editing.course_code}`, {
      course_name: form.course_name,
      total_weeks: parseInt(form.total_weeks),
      lecturer_ids: Array.isArray(form.lecturer_ids) ? form.lecturer_ids.map(Number) : [],
      min_attendance_pct: parseInt(form.min_attendance_pct) || 70,
    });
    await load(page);
  };

  const remove = async (code) => {
    await api.delete(`/api/admin/courses/${code}`);
    toast.success('Course deleted');
    await load(page);
  };

  const lecturerOptions = lecturers.map((l) => ({ value: l.id, label: l.name }));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <AddForm
        entityLabel="Course"
        fields={[
          { name: 'course_code', label: 'Code', placeholder: 'e.g. CS101' },
          { name: 'course_name', label: 'Name', placeholder: 'Intro to CS' },
          { name: 'total_weeks', label: 'Weeks', type: 'number', min: 1, max: 52 },
          { name: 'lecturer_ids', label: 'Lecturers', type: 'multiselect', options: lecturerOptions },
          { name: 'min_attendance_pct', label: 'Min %', type: 'number', min: 0, max: 100 },
        ]}
        onSubmit={add}
        buttonText="Add Course"
      />
      <EntityTable
        columns={[
          { key: 'course_code', label: 'Code' },
          { key: 'course_name', label: 'Name' },
          { key: 'total_weeks', label: 'Weeks' },
          { key: 'lecturers', label: 'Lecturers', render: (row) => {
            const lecs = row.lecturers;
            return Array.isArray(lecs) && lecs.length > 0
              ? lecs.map((l) => l.name).join(', ')
              : '—';
          }},
          { key: 'min_attendance_pct', label: 'Min %' },
        ]}
        data={courses}
        onEdit={(row) => setEditing(row)}
        onDelete={remove}
        searchQuery={searchQuery}
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      {editing && (
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
    </div>
  );
}

function ClassesPage() {
  const { searchQuery } = useSearch();
  const [classes, setClasses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lecturers, setLecturers] = useState([]);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const load = useCallback(async (p) => {
    const [cRes, lRes] = await Promise.all([
      api.get('/api/admin/classes', { params: { limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE } }),
      api.get('/api/admin/lecturers'),
    ]);
    setClasses(cRes.data.classes);
    setTotal(cRes.data.total);
    setLecturers(lRes.data.lecturers);
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const add = async (form) => {
    await api.post('/api/admin/classes', {
      class_name: form.class_name,
      lecturer_ids: Array.isArray(form.lecturer_ids) ? form.lecturer_ids.map(Number) : [],
    });
    setPage(1);
    await load(1);
  };

  const saveEdit = async (form) => {
    await api.put(`/api/admin/classes/${editing.class_id}`, {
      class_name: form.class_name,
      lecturer_ids: Array.isArray(form.lecturer_ids) ? form.lecturer_ids.map(Number) : [],
    });
    await load(page);
  };

  const remove = async (id) => {
    await api.delete(`/api/admin/classes/${id}`);
    toast.success('Class deleted');
    await load(page);
  };

  const lecturerOptions = lecturers.map((l) => ({ value: l.id, label: l.name }));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <AddForm
        entityLabel="Class"
        fields={[
          { name: 'class_name', label: 'Class Name', placeholder: 'e.g. BSc CS Year 1' },
          { name: 'lecturer_ids', label: 'Lecturers', type: 'multiselect', options: lecturerOptions },
        ]}
        onSubmit={add}
        buttonText="Add Class"
      />
      <EntityTable
        columns={[
          { key: 'class_id', label: 'ID' },
          { key: 'class_name', label: 'Name' },
          { key: 'student_count', label: 'Students' },
          { key: 'lecturers', label: 'Lecturers', render: (row) => {
            const lecs = row.lecturers;
            return Array.isArray(lecs) && lecs.length > 0
              ? lecs.map((l) => l.name).join(', ')
              : '—';
          }},
        ]}
        data={classes}
        onEdit={(row) => setEditing(row)}
        onDelete={remove}
        searchQuery={searchQuery}
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      {editing && (
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
    </div>
  );
}

function LecturersPage() {
  const { searchQuery } = useSearch();
  const [lecturers, setLecturers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const load = useCallback(async (p) => {
    const res = await api.get('/api/admin/lecturers', { params: { limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE } });
    setLecturers(res.data.lecturers);
    setTotal(res.data.total);
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const add = async (form) => {
    await api.post('/api/admin/lecturers', form);
    setPage(1);
    await load(1);
  };

  const saveEdit = async (form) => {
    const payload = { name: form.name, email: form.email };
    if (form.password) payload.password = form.password;
    await api.put(`/api/admin/lecturers/${editing.id}`, payload);
    await load(page);
  };

  const remove = async (id) => {
    await api.delete(`/api/admin/lecturers/${id}`);
    toast.success('Lecturer deleted');
    await load(page);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <AddForm
        entityLabel="Lecturer"
        fields={[
          { name: 'name', label: 'Name', placeholder: 'Dr. Name' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'password', label: 'Password', type: 'password' },
        ]}
        onSubmit={add}
        buttonText="Add Lecturer"
      />
      <EntityTable
        columns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }]}
        data={lecturers}
        onEdit={(row) => setEditing(row)}
        onDelete={remove}
        searchQuery={searchQuery}
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      {editing && (
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
  const { searchQuery } = useSearch();
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const loadClasses = useCallback(async () => { const res = await api.get('/api/admin/classes'); setClasses(res.data.classes); }, []);
  const loadStudents = useCallback(async (classId, p) => {
    const params = { limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE };
    if (classId) params.class_id = classId;
    const res = await api.get('/api/admin/students', { params });
    setStudents(res.data.students);
    setTotal(res.data.total);
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadStudents(selectedClass, page); }, [selectedClass, page, loadStudents]);

  const add = async (form) => {
    await api.post('/api/admin/students', { ...form, class_id: parseInt(selectedClass) });
    setPage(1);
    await loadStudents(selectedClass, 1);
  };

  const saveEdit = async (form) => {
    await api.put(`/api/admin/students/${editing.id}`, form);
    await loadStudents(selectedClass, page);
    setEditing(null);
  };

  const remove = async (id) => {
    await api.delete(`/api/admin/students/${id}`);
    toast.success('Student deleted');
    await loadStudents(selectedClass, page);
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
      await loadStudents(selectedClass, page);
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
      <div className="form-group" style={{ maxWidth: 320, marginBottom: '1.25rem' }}>
        <label>Filter by Class</label>
        <Select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setPage(1); }}>
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
        </Select>
      </div>
      {selectedClass && (
        <>
          <input type="file" accept=".csv" ref={fileRef} onChange={handleBulkImport} style={{ display: 'none' }} />
          <AddForm
            entityLabel="Student"
            fields={[
              { name: 'index_number', label: 'Index Number', placeholder: 'e.g. CS2024001' },
              { name: 'student_name', label: 'Student Name', placeholder: 'Full name' },
            ]}
            onSubmit={add}
            buttonText="Add Student"
            extraButtons={
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={importing}
                  onClick={() => fileRef.current?.click()}
                  style={{ alignSelf: 'flex-end', height: 38 }}
                >
                  {importing ? 'Importing...' : 'Import CSV'}
                </button>
                {importResult && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: importResult.error ? 'var(--error)' : 'var(--success)',
                    alignSelf: 'center',
                  }}>
                    {importResult.error
                        ? importResult.error
                        : `${importResult.added} students added`}
                  </span>
                )}
              </>
            }
          />

          <EntityTable
            columns={[{ key: 'index_number', label: 'Index' }, { key: 'student_name', label: 'Name' }]}
            data={students}
            onEdit={(row) => setEditing(row)}
            onDelete={remove}
            searchQuery={searchQuery}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          {editing && (
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
    </div>
  );
}

export default function AdminDashboard() {
  const [courses, setCourses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [campuses, setCampuses] = useState([]);

  const load = useCallback(async () => {
    try {
      const [cRes, lRes, clRes, sRes, campRes] = await Promise.all([
        api.get('/api/admin/courses'),
        api.get('/api/admin/lecturers'),
        api.get('/api/admin/classes'),
        api.get('/api/admin/students'),
        api.get('/api/campuses'),
      ]);
      setCourses(cRes.data.courses || []);
      setLecturers(lRes.data.lecturers || []);
      setClasses(clRes.data.classes || []);
      setStudents(sRes.data.students || []);
      setCampuses(campRes.data.campuses || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div className="workspace-grid single">
        <Routes>
          <Route index element={<AdminOverviewPage courses={courses} lecturers={lecturers} classes={classes} students={students} campuses={campuses} />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="lecturers" element={<LecturersPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="campuses" element={<CampusesPage />} />
        </Routes>
      </div>
    </DashboardLayout>
  );
}
