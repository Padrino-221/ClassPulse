import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import DashboardLayout from '../components/DashboardLayout';
import Spinner from '../components/Spinner';
import { User, ShieldCheck, Eye, EyeSlash } from '@phosphor-icons/react';

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
  const [showConfirm, setShowConfirm] = useState(false);

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
      const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
      storage.setItem('user', JSON.stringify(res.data.user));
      if (res.data.token) storage.setItem('token', res.data.token);
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
      <div style={{ maxWidth: '1000px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A1A', marginBottom: '0.25rem' }}>My Profile</div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Manage your account settings.</div>
        </div>

        <div className="profile-grid" style={{
          display: 'grid',
          gap: '1.5rem',
          alignItems: 'start',
        }}>
          {/* Personal Information */}
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: 'none',
            border: '1px solid #E5E7EB',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <User weight="duotone" size={18} style={{ color: BRAND }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1A1A1A' }}>Personal Information</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <form onSubmit={handleSaveProfile}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280' }}>Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280' }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1.25rem',
                    background: BRAND,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {saving ? <><Spinner size={14} /> Saving...</> : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>

          {/* Change Password */}
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: 'none',
            border: '1px solid #E5E7EB',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <ShieldCheck weight="duotone" size={18} style={{ color: BRAND }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1A1A1A' }}>Change Password</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <form onSubmit={handleChangePassword}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280' }}>Current Password</label>
                  <div className="password-field" style={{ position: 'relative' }}>
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'border-color 0.15s ease',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button type="button" onClick={() => setShowCurrent((p) => !p)} style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#9CA3AF',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      {showCurrent ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280' }}>New Password</label>
                  <div className="password-field" style={{ position: 'relative' }}>
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6}
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'border-color 0.15s ease',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button type="button" onClick={() => setShowNew((p) => !p)} style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#9CA3AF',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      {showNew ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#6B7280' }}>Confirm New Password</label>
                  <div className="password-field" style={{ position: 'relative' }}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={6}
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        paddingRight: '2.5rem',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'border-color 0.15s ease',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button type="button" onClick={() => setShowConfirm((p) => !p)} style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#9CA3AF',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      {showConfirm ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={changingPw}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1.25rem',
                    background: BRAND,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: changingPw ? 'not-allowed' : 'pointer',
                    opacity: changingPw ? 0.7 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
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

const BRAND = '#DC2626';
