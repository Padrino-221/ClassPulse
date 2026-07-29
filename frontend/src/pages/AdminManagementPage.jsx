import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Plus, Trash, UserCheck, Buildings } from '@phosphor-icons/react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import CreateModal from '../components/CreateModal';
import ConfirmModal from '../components/ConfirmModal';

const roleConfig = {
  school: { bg: '#FEF2F2', color: '#DC2626', icon: Buildings, label: 'School Admin' },
  university: { bg: '#FFFBEB', color: '#D97706', icon: ShieldCheck, label: 'University Admin' },
};

function AdminEmptyState() {
  return (
    <div className="empty-state">
      <div style={{
        width: '64px', height: '64px', borderRadius: '50%',
        background: 'var(--brand-light)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', marginBottom: '1rem',
      }}>
        <UserCheck weight="duotone" size={28} color="var(--brand)" />
      </div>
      <div className="empty-state-title">No admin accounts yet</div>
      <div className="empty-state-desc">
        Create your first admin account to manage schools and departments.
      </div>
    </div>
  );
}

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState([]);
  const [schools, setSchools] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        api.get('/api/admin/admin-users'),
        api.get('/api/schools'),
      ]);
      setAdmins(aRes.data.admins || []);
      setSchools(sRes.data || []);
    } catch { /* empty */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form) => {
    const payload = {
      name: form.name,
      email: form.email,
      password: form.password,
      role: 'school',
      school_id: parseInt(form.school_id),
    };
    await api.post('/api/admins', payload);
    toast.success('Admin created successfully.');
    load();
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/admins/${id}`);
      toast.success('Admin deleted.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete admin.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Admin Management"
        description="Create and manage school admin accounts."
        action={() => setShowCreate(true)}
        actionLabel="New School Admin"
        actionIcon={Plus}
      />

      {admins.length === 0 ? (
        <AdminEmptyState />
      ) : (
        <div className="admin-cards-grid">
          {admins.map((a) => {
            const cfg = roleConfig[a.role] || { bg: '#F3F4F6', color: '#6B7280', icon: UserCheck, label: a.role };
            const RoleIcon = cfg.icon;
            return (
              <div key={a.id} className="admin-card">
                {/* Top row: Avatar + Name + Delete */}
                <div className="admin-card-top">
                  <div className="admin-card-identity">
                    <div
                      className="admin-card-avatar"
                      style={{ background: cfg.bg }}
                    >
                      <RoleIcon weight="duotone" size={22} color={cfg.color} />
                    </div>
                    <div>
                      <div className="admin-card-name">{a.name}</div>
                      <div className="admin-card-email">{a.email}</div>
                    </div>
                  </div>
                  <button
                    className="admin-card-delete"
                    onClick={() => setDeleting(a)}
                    title="Delete admin"
                  >
                    <Trash size={15} />
                  </button>
                </div>

                {/* Bottom row: Role badge + Scope info */}
                <div className="admin-card-bottom">
                  <span
                    className="badge"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                  {(a.school_name || a.department_name) && (
                    <span className="admin-card-scope-dot">
                      {a.department_name || a.school_name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateModal
          entityLabel="School Admin"
          fields={[
            { name: 'name', label: 'Name', placeholder: 'Full name' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'password', label: 'Password', type: 'password' },
            { name: 'school_id', label: 'School', type: 'select', options: schools.map((s) => ({ value: s.id, label: s.name })), placeholder: 'Select school' },
          ]}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete Admin"
          message={`Are you sure you want to delete "${deleting.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
