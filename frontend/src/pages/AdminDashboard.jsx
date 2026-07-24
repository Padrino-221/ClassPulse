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
import ReportsPage from './ReportsPage';
import Spinner from '../components/Spinner';

const PAGE_SIZE = 20;

const tileIcons = {
  courses: <BookOpen weight="duotone" size={22} />,
  lecturers: <UserCheck weight="duotone" size={22} />,
  classes: <Users weight="duotone" size={22} />,
  students: <GraduationCap weight="duotone" size={22} />,
  buildings: <MapPin weight="duotone" size={22} />,
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
          backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
          width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto',
          padding: '2rem', margin: '1rem',
        }}
      >
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.25rem' }}>
          Edit {entityLabel}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.25rem' }}>
          Update the record details below.
        </div>
        {error && (
          <div style={{
            backgroundColor: '#fef2f2', color: '#dc2626', padding: '0.75rem 1rem',
            borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid #fecaca',
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
                    color: '#374151', marginBottom: '0.375rem',
                  }}>
                    {f.label}
                  </label>
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
                      style={{
                        width: '100%', padding: '0.625rem 0.875rem', fontSize: '0.9rem',
                        border: '1.5px solid #e5e7eb', borderRadius: '10px', outline: 'none',
                        backgroundColor: '#f9fafb', transition: 'all 0.2s',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
                        e.target.style.backgroundColor = '#fff';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                        e.target.style.backgroundColor = '#f9fafb';
                      }}
                    />
                  )}
                </>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 600,
                color: '#6b7280', backgroundColor: '#f3f4f6', border: 'none',
                borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e7eb'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 600,
                color: '#fff', backgroundColor: '#3b82f6', border: 'none',
                borderRadius: '10px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s',
                opacity: saving ? 0.7 : 1,
              }}
              onMouseEnter={(e) => !saving && (e.target.style.backgroundColor = '#2563eb')}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
            >
              {saving ? <><Spinner size={14} /> Saving...</> : 'Save Changes'}
            </button>
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
    <div style={{ marginTop: '1rem' }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
              {columns.map((col) => (
                <th key={col.key} style={{
                  padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600,
                  color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {col.label}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th style={{
                  padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600,
                  color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} style={{ padding: '3rem 1rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#d1d5db', marginBottom: '0.75rem' }}>
                      <MagnifyingGlass weight="duotone" size={48} />
                    </div>
                    <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>{emptyMsg}</div>
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Add a new record using the form above.</div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((row, i) => (
              <tr
                key={row.id || row.class_id || row.course_code || i}
                style={{
                  backgroundColor: i % 2 === 0 ? '#fff' : '#fafbfc',
                  borderBottom: '1px solid #f3f4f6',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f7ff'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#fff' : '#fafbfc'}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: '0.75rem 1rem', color: '#1f2937' }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                      {onEdit && (
                        <button
                          title="Edit"
                          onClick={() => onEdit(row)}
                          style={{
                            width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', border: 'none', borderRadius: '8px',
                            backgroundColor: '#eff6ff', color: '#3b82f6', cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#3b82f6';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#eff6ff';
                            e.currentTarget.style.color = '#3b82f6';
                          }}
                        >
                          <PencilSimple weight="duotone" size={14} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          title="Delete"
                          onClick={() => onDelete(row.id || row.class_id || row.course_code)}
                          style={{
                            width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', border: 'none', borderRadius: '8px',
                            backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#dc2626';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#fef2f2';
                            e.currentTarget.style.color = '#dc2626';
                          }}
                        >
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
    <div style={{
      backgroundColor: '#fff', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      marginBottom: '1rem', overflow: 'hidden',
    }}>
      <div style={{
        padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#eff6ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6',
        }}>
          <Plus weight="duotone" size={16} />
        </div>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2937' }}>
          New {entityLabel}
        </span>
      </div>
      <div style={{ padding: '1.25rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          {error && (
            <div style={{
              width: '100%', backgroundColor: '#fef2f2', color: '#dc2626', padding: '0.75rem 1rem',
              borderRadius: '10px', fontSize: '0.85rem', border: '1px solid #fecaca',
            }}>
              {error}
            </div>
          )}
          {fields.map((f) => (
            <div key={f.name} style={{ flex: '1 1 180px', minWidth: '160px' }}>
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
                    display: 'block', fontSize: '0.75rem', fontWeight: 600,
                    color: '#6b7280', marginBottom: '0.375rem', textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}>
                    {f.label}
                  </label>
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
                      placeholder={f.placeholder || ''}
                      min={f.min}
                      max={f.max}
                      style={{
                        width: '100%', padding: '0.6rem 0.875rem', fontSize: '0.875rem',
                        border: '1.5px solid #e5e7eb', borderRadius: '10px', outline: 'none',
                        backgroundColor: '#f9fafb', transition: 'all 0.2s', boxSizing: 'border-box',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
                        e.target.style.backgroundColor = '#fff';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                        e.target.style.backgroundColor = '#f9fafb';
                      }}
                    />
                  )}
                </>
              )}
            </div>
          ))}
          <button
            type="submit"
            style={{
              padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 600,
              color: '#fff', backgroundColor: '#3b82f6', border: 'none',
              borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
              height: '40px', whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            {buttonText}
          </button>
          {extraButtons}
        </form>
      </div>
    </div>
  );
}

function BuildingsPage() {
  const { searchQuery } = useSearch();
  const [buildings, setBuildings] = useState([]);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const res = await api.get('/api/buildings');
    setBuildings(res.data.buildings);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (form) => {
    await api.post('/api/buildings', {
      name: form.name,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      radius: parseInt(form.radius),
    });
    await load();
  };

  const saveEdit = async (form) => {
    await api.put(`/api/buildings/${editing.id}`, {
      name: form.name,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      radius: parseInt(form.radius),
    });
    await load();
  };

  const remove = async (id) => {
    await api.delete(`/api/buildings/${id}`);
    toast.success('Building deleted');
    await load();
  };

  return (
    <div>
      <AddForm
        entityLabel="Building"
        fields={[
          { name: 'name', label: 'Name', placeholder: 'e.g. Main Building' },
          { name: 'latitude', label: 'Latitude', type: 'number', placeholder: 'e.g. 5.650000' },
          { name: 'longitude', label: 'Longitude', type: 'number', placeholder: 'e.g. -0.186000' },
          { name: 'radius', label: 'Radius (m)', type: 'number', min: 100, max: 5000 },
        ]}
        onSubmit={add}
        buttonText="Add Building"
      />
      <EntityTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'latitude', label: 'Latitude' },
          { key: 'longitude', label: 'Longitude' },
          { key: 'radius', label: 'Radius (m)' },
        ]}
        data={buildings}
        onEdit={(row) => setEditing(row)}
        onDelete={remove}
        searchQuery={searchQuery}
      />
      {editing && (
        <EditModal
          entityLabel="Building"
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

function AdminOverviewPage({ courses, lecturers, classes, students, buildings }) {
  const tiles = [
    {
      to: '/admin/courses',
      icon: tileIcons.courses,
      title: 'Courses',
      count: courses.length,
      desc: 'Manage course offerings, assign lecturers, and set attendance policies.',
      color: '#3b82f6',
      bg: '#eff6ff',
    },
    {
      to: '/admin/classes',
      icon: tileIcons.classes,
      title: 'Classes',
      count: classes.length,
      desc: 'Organize student cohorts and class groupings.',
      color: '#8b5cf6',
      bg: '#f5f3ff',
    },
    {
      to: '/admin/lecturers',
      icon: tileIcons.lecturers,
      title: 'Lecturers',
      count: lecturers.length,
      desc: 'Add or update lecturer accounts and credentials.',
      color: '#10b981',
      bg: '#ecfdf5',
    },
    {
      to: '/admin/students',
      icon: tileIcons.students,
      title: 'Students',
      count: students.length,
      desc: 'Manage student rosters, bulk import, and index numbers.',
      color: '#f59e0b',
      bg: '#fffbeb',
    },
    {
      to: '/admin/buildings',
      icon: tileIcons.buildings,
      title: 'Buildings',
      count: buildings.length,
      desc: 'Define building locations and geofence radii for attendance verification.',
      color: '#ef4444',
      bg: '#fef2f2',
    },
  ];

  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.25rem' }}>
          Admin Dashboard
        </div>
        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          Manage courses, classes, lecturers, and students across the system.
        </div>
      </div>

      <div style={{
        backgroundColor: '#fff', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>Management</h3>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}>
            {tiles.map((tile) => (
              <Link
                key={tile.to}
                to={tile.to}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '1rem',
                  padding: '1.25rem', borderRadius: '12px', border: '1.5px solid #f3f4f6',
                  textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer',
                  backgroundColor: '#fff',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = tile.color + '40';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#f3f4f6';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px', backgroundColor: tile.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: tile.color,
                  flexShrink: 0,
                }}>
                  {tile.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1f2937', marginBottom: '0.125rem' }}>
                    {tile.title}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: tile.color, fontWeight: 600, marginBottom: '0.375rem' }}>
                    {tile.count} {tile.title.toLowerCase()}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', lineHeight: '1.4' }}>
                    {tile.desc}
                  </div>
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
      <div style={{ maxWidth: '320px', marginBottom: '1.25rem' }}>
        <label style={{
          display: 'block', fontSize: '0.8rem', fontWeight: 600,
          color: '#374151', marginBottom: '0.375rem',
        }}>
          Filter by Class
        </label>
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
                  disabled={importing}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    alignSelf: 'flex-end', height: '40px', padding: '0.6rem 1.25rem',
                    fontSize: '0.85rem', fontWeight: 600, color: '#374151',
                    backgroundColor: '#f3f4f6', border: 'none', borderRadius: '10px',
                    cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e7eb'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                >
                  {importing ? 'Importing...' : 'Import CSV'}
                </button>
                {importResult && (
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: importResult.error ? '#dc2626' : '#10b981',
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
  const [buildings, setBuildings] = useState([]);

  const load = useCallback(async () => {
    try {
      const [cRes, lRes, clRes, sRes, bRes] = await Promise.all([
        api.get('/api/admin/courses'),
        api.get('/api/admin/lecturers'),
        api.get('/api/admin/classes'),
        api.get('/api/admin/students'),
        api.get('/api/buildings'),
      ]);
      setCourses(cRes.data.courses || []);
      setLecturers(lRes.data.lecturers || []);
      setClasses(clRes.data.classes || []);
      setStudents(sRes.data.students || []);
      setBuildings(bRes.data.buildings || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
        <Routes>
          <Route index element={<AdminOverviewPage courses={courses} lecturers={lecturers} classes={classes} students={students} buildings={buildings} />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="lecturers" element={<LecturersPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="buildings" element={<BuildingsPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Routes>
      </div>
    </DashboardLayout>
  );
}
