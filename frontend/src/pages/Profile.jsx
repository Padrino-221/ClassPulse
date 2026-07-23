import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import DashboardLayout from '../components/DashboardLayout';
import Spinner from '../components/Spinner';
import { User, ShieldCheck } from '@phosphor-icons/react';

export default function Profile() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/auth/profile');
        setName(res.data.user.name);
        setEmail(res.data.user.email);
      } catch {
        toast.error("Couldn't load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/api/auth/profile', { name, email });
      localStorage.setItem('user', JSON.stringify(res.data.user));
      if (res.data.token) localStorage.setItem('token', res.data.token);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error('New passwords do not match.');
    }
    setChangingPw(true);
    try {
      await api.put('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Password changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setChangingPw(false);
    }
  };

  if (loading) return <DashboardLayout><div className="loading-indicator">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="workspace-grid single">
        <div className="page-header">
          <div className="page-title">My Profile</div>
          <div className="page-subtitle">Manage your account settings.</div>
        </div>

        <div className="profile-grid">
          <div className="card">
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User weight="duotone" size={18} /> Personal Information
              </h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSaveProfile}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={saving} style={{ width: 'auto' }}>
                  {saving ? <><Spinner size={14} /> Saving...</> : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck weight="duotone" size={18} /> Change Password
              </h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label>Current Password</label>
                  <div className="password-field">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="password-toggle" onClick={() => setShowCurrent((p) => !p)}>
                      {showCurrent ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <div className="password-field">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                    <button type="button" className="password-toggle" onClick={() => setShowNew((p) => !p)}>
                      {showNew ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={changingPw} style={{ width: 'auto' }}>
                  {changingPw ? <><Spinner size={14} /> Changing...</> : 'Change Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
