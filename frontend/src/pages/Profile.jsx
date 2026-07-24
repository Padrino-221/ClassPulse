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
      <div style={{ maxWidth: '1000px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.25rem' }}>My Profile</div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Manage your account settings.</div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1.5rem',
          alignItems: 'start',
        }}>
          {/* Personal Information */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #f0f0f0',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <User weight="duotone" size={18} style={{ color: BRAND }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1a1a2e' }}>Personal Information</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <form onSubmit={handleSaveProfile}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
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
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #f0f0f0',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <ShieldCheck weight="duotone" size={18} style={{ color: BRAND }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1a1a2e' }}>Change Password</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <form onSubmit={handleChangePassword}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>Current Password</label>
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
                        border: '1px solid #d1d5db',
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
                      color: '#6b7280',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}>
                      {showCurrent ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>New Password</label>
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
                        border: '1px solid #d1d5db',
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
                      color: '#6b7280',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}>
                      {showNew ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  />
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

const BRAND = '#0730A3';
